// Content cycles: publish many articles, then every cycle (14 days by default)
// see which ones each engine picks up, grow the ones that bring readers who act,
// and cut the ones nothing finds. Per cycle and article, for that exact window:
//   - Google: clicks, impressions, position and top query (Search Console)
//   - Bing: the same (Bing Webmaster Tools; its index also feeds Copilot,
//     DuckDuckGo and ChatGPT search)
//   - AI: visits sent by assistants (GA4) and how often the answer checks cite
//     the article (ai-search.mjs), so "is AI picking it up" has a number
//   - readers: landing visits, engaged visits ("convinced": stayed and read) and
//     goal users ("acted": downloaded, installed, signed up), split by engine
// Articles are grouped into categories (the site's search topics, else the URL
// section, else your own label) so content is compared like with like, and each
// category says which article Google, Bing and AI each favour.
//
// When a cycle ends (plus the days Search Console lags), it is measured once and
// kept in .data/content-cycles.db; the live cycle is measured on demand. Each
// article gets a verdict against its previous cycle: grow, keep, improve, watch,
// cut or too new. Verdicts are suggestions: acting on one records a page
// decision (page-review.mjs), the same as the Pages review.
// Settings live in studio.json `contentCycles[siteId]`.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';
import { querySearchAnalytics, hostPageFilter } from '../shared/sitelens/gsc.js';
import { sourceFamily } from './journey.mjs';
import { classifyEvents } from './outcomes.mjs';
import { searchGroups } from './site-config.mjs';
import { AI_FAMILIES, normPath } from './articles.mjs';
import { ValidationError } from './store.mjs';
import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const CYCLE_DAYS = 14;
const SEARCH_LAG_DAYS = 3; // a cycle is measured once Search Console has its last day
const NEW_DAYS = 28;
const LIVE_TTL = 30 * 60_000;
const MAX_CATEGORY = 40;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cycles (site_id TEXT NOT NULL, n INTEGER NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  closed_at INTEGER NOT NULL, goals TEXT, sources TEXT, PRIMARY KEY (site_id, n));
CREATE TABLE IF NOT EXISTS snapshots (site_id TEXT NOT NULL, n INTEGER NOT NULL, path TEXT NOT NULL, data TEXT NOT NULL,
  PRIMARY KEY (site_id, n, path));
`;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const ms = (day) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day, n) => isoDay(ms(day) + n * DAY);
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const plural = (count, word) => `${fmt(count)} ${word}${Math.round(count) === 1 ? '' : 's'}`;

/* ---------- cycles and categories (pure) ---------- */

// Cycle n (1-based) of a schedule that began on `start`.
export function cycleWindow(start, days, n) {
  const from = addDays(start, (n - 1) * days);
  return { n, start: from, end: addDays(from, days - 1), days };
}

// The cycle today falls in (≥ 1).
export function cycleOn(start, days, today) {
  return Math.max(1, Math.floor((ms(today) - ms(start)) / DAY / days) + 1);
}

// The engine a GA4 session source belongs to, for splitting readers by who sent them.
export function engineOf(source) {
  const family = sourceFamily(source);
  if (family === 'Google') return 'google';
  if (family === 'Bing' || family === 'DuckDuckGo') return 'bing';
  if (AI_FAMILIES.has(family) || AI_FAMILIES.has(source)) return 'ai';
  return 'other';
}

const SECTION_NAMES = { blog: 'Blog', post: 'Blog', posts: 'Blog', article: 'Articles', articles: 'Articles', guide: 'Guides', guides: 'Guides', docs: 'Docs', doc: 'Docs', tutorial: 'Tutorials', tutorials: 'Tutorials', news: 'News', learn: 'Learn' };

// Your label first; then the search topic whose page this is, or whose queries
// it ranks for most (first match wins, as in Demand); then its URL section.
export function categoryOf(row, { override = '', groups = [], topicPages = new Map() } = {}) {
  if (override) return { name: override, from: 'you' };
  if (topicPages.has(row.path)) return { name: topicPages.get(row.path), from: 'topic' };
  const queries = row.queries || [];
  if (groups.length && queries.length) {
    const votes = new Map();
    for (const q of queries) {
      const g = groups.find((x) => new RegExp(x.pattern, 'i').test(q.query));
      if (g && g.name !== 'Brand' && g.name !== 'Competitors') votes.set(g.name, (votes.get(g.name) || 0) + (q.impressions || 1));
    }
    const best = [...votes].sort((a, b) => b[1] - a[1])[0];
    if (best) return { name: best[0], from: 'topic' };
  }
  const groupsTitle = groups.find((g) => g.name !== 'Brand' && g.name !== 'Competitors' && row.title && new RegExp(g.pattern, 'i').test(row.title));
  if (groupsTitle) return { name: groupsTitle.name, from: 'topic' };
  const segs = normPath(row.path).split('/').filter(Boolean);
  const section = segs.length > 1 ? segs[segs.length - 2].toLowerCase() : '';
  if (section && !/^(19|20)\d{2}$|^\d{2}$/.test(section)) return { name: SECTION_NAMES[section] || section.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()), from: 'url' };
  return { name: 'Uncategorized', from: 'url' };
}

/* ---------- verdicts (pure) ---------- */

const ZERO = { clicks: 0, impressions: 0, position: null };

// What one article earned this cycle, as one number to rank it in its category:
// a landing visit is 1, a reader who acted (downloaded, signed up…) 5, and an
// AI answer citing it 3, since that reader never shows up as a visit.
export function valueOf(r) {
  return (r.visits || 0) + 5 * (r.conversions || 0) + 3 * (r.ai?.cited || 0);
}

export const VERDICTS = {
  grow: { label: 'Grow: write more like it', order: 0, tone: 'good' },
  improve: { label: 'Improve', order: 1, tone: 'warn' },
  keep: { label: 'Keep', order: 2, tone: 'good' },
  watch: { label: 'Watch: nothing this cycle', order: 3, tone: 'warn' },
  cut: { label: 'Cut: merge or remove', order: 4, tone: 'bad' },
  new: { label: 'Too new to judge', order: 5, tone: 'idle' },
};

// One article's verdict for a cycle, with the reason in plain words.
//   r, prev: snapshots (prev is the article's previous cycle, or null)
//   ctx: { days, today, rank (1 = best in category), size (articles in it),
//          prevScale (the previous cycle's share of this window's length, for a cycle still running) }
export function cycleVerdict(r, prev, { days = CYCLE_DAYS, today, rank = 1, size = 1, prevScale = 1 } = {}) {
  const g = r.google || ZERO;
  const b = r.bing || ZERO;
  const clicks = g.clicks + b.clicks;
  const impressions = g.impressions + b.impressions;
  const ai = (r.ai?.cited || 0) + (r.ai?.sessions || 0);
  const value = valueOf(r);
  const scale = days / CYCLE_DAYS;
  const born = r.published || '';
  const age = born ? Math.floor((ms(today) - ms(born.slice(0, 10))) / DAY) : null;
  const was = prev ? valueOf(prev) * prevScale : null;
  const change = was ? value / was - 1 : 0;
  const trend = was === null ? '' : was === 0 ? (value ? ' New readers this cycle.' : '')
    : Math.abs(change) < 0.05 ? ' Same as the cycle before.' : ` ${change > 0 ? 'Up' : 'Down'} ${pct(Math.abs(change))} on the cycle before.`;
  const stayed = r.visits ? r.engaged / r.visits : 0;
  const said = `${plural(r.visits, 'visit')}, ${plural(clicks, 'search click')} (Google ${fmt(g.clicks)}, Bing ${fmt(b.clicks)}), ${plural(impressions, 'impression')}${ai ? `, AI ${fmt(r.ai.sessions)} visits and ${fmt(r.ai.cited)} citations` : ''}${r.conversions ? `, ${plural(r.conversions, 'reader')} who acted` : ''}.`;
  const deadNow = r.visits < 2 * scale && !clicks && !ai && !r.conversions;
  const deadBefore = prev ? (prev.visits || 0) < 2 * scale && !((prev.google?.clicks || 0) + (prev.bing?.clicks || 0)) && !((prev.ai?.cited || 0) + (prev.ai?.sessions || 0)) && !prev.conversions : null;
  const query = g.query || b.query || '';

  if (deadNow && age !== null && age >= 0 && age < NEW_DAYS) return { verdict: 'new', why: `Published ${age} day${age === 1 ? '' : 's'} ago: Google and Bing usually take a few weeks to place a new page. ${said}` };
  if (deadNow) {
    if (deadBefore || (deadBefore === null && (age === null || age >= 90))) {
      return { verdict: 'cut', why: `Nothing found it${deadBefore ? ' two cycles running' : ''}: no search clicks, no AI citations, no readers. Merge it into a stronger page on the same topic, or remove it and redirect. ${said}` };
    }
    return { verdict: 'watch', why: `Nothing found it this cycle. If the next one is the same, cut it. Check it’s indexed in both Google and Bing. ${said}` };
  }
  const top = Math.max(1, Math.ceil(size / 3));
  if (rank <= top && value >= 10 * scale && (r.visits < 10 * scale || stayed >= 0.3)) {
    return { verdict: 'grow', why: `One of the strongest in its category (#${rank} of ${size}). Write follow-ups${query ? ` around “${query}”` : ''} and link them from here.${trend} ${said}` };
  }
  if (r.visits >= 10 * scale && stayed < 0.3) {
    return { verdict: 'improve', why: `Readers arrive but only ${pct(stayed)} stay: it doesn’t convince them. Answer the question they came with sooner.${trend} ${said}` };
  }
  // Far down the results a low click rate is the position, not the title.
  if (g.impressions >= 100 * scale && g.clicks / g.impressions < 0.015 && g.position && g.position <= 15) {
    return { verdict: 'improve', why: `Google shows it ${fmt(g.impressions)} times${g.position ? ` around position ${g.position.toFixed(1)}` : ''} but ${pct(g.clicks / g.impressions)} click: rewrite the title and description${query ? ` for “${query}”` : ''}.${trend} ${said}` };
  }
  return { verdict: 'keep', why: `${value >= 10 * scale ? 'Earns its place, though others in its category do more.' : 'Earns a little.'}${trend} ${said}` };
}

/* ---------- a cycle's report (pure) ---------- */

const sumOf = (rows, fn) => rows.reduce((a, r) => a + (fn(r) || 0), 0);

// Per engine in one category: what it sent, and the article it favours.
export function engineBoard(rows) {
  const engines = {
    google: (r) => r.google?.clicks || 0,
    bing: (r) => r.bing?.clicks || 0,
    ai: (r) => (r.ai?.sessions || 0) + (r.ai?.cited || 0),
  };
  const out = {};
  for (const [key, fn] of Object.entries(engines)) {
    const best = [...rows].sort((a, b) => fn(b) - fn(a))[0];
    out[key] = {
      value: sumOf(rows, fn),
      impressions: key === 'ai' ? null : sumOf(rows, (r) => r[key]?.impressions),
      visits: sumOf(rows, (r) => r.byEngine?.[key]?.visits),
      engaged: sumOf(rows, (r) => r.byEngine?.[key]?.engaged),
      conversions: sumOf(rows, (r) => r.byEngine?.[key]?.conversions),
      leader: best && fn(best) > 0 ? { path: best.path, title: best.title, value: fn(best) } : null,
    };
  }
  const leaders = Object.values(out).map((e) => e.leader?.path).filter(Boolean);
  out.agree = leaders.length > 1 ? new Set(leaders).size === 1 : null;
  return out;
}

// rows: this cycle's snapshots; prev: path → the previous cycle's snapshot.
// For a cycle still running, prevScale (days so far / a cycle's days) puts the
// previous cycle on the same footing.
export function buildCycle({ rows, prev = new Map(), days = CYCLE_DAYS, today, prevScale = 1 }) {
  const byCat = new Map();
  for (const r of rows) {
    const list = byCat.get(r.category) || [];
    list.push(r);
    byCat.set(r.category, list);
  }
  const judged = [];
  const categories = [];
  for (const [name, list] of byCat) {
    const ranked = [...list].sort((a, b) => valueOf(b) - valueOf(a));
    const withVerdicts = ranked.map((r, i) => {
      const before = prev.get(r.path) || null;
      return { ...r, value: valueOf(r), previous: before ? valueOf(before) * prevScale : null, ...cycleVerdict(r, before, { days, today, rank: i + 1, size: ranked.length, prevScale }) };
    });
    judged.push(...withVerdicts);
    const visits = sumOf(list, (r) => r.visits);
    const counts = {};
    for (const r of withVerdicts) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
    categories.push({
      name, articles: list.length, visits,
      engaged: sumOf(list, (r) => r.engaged), conversions: sumOf(list, (r) => r.conversions),
      value: sumOf(list, valueOf), previous: list.some((r) => prev.has(r.path)) ? prevScale * sumOf(list, (r) => (prev.has(r.path) ? valueOf(prev.get(r.path)) : 0)) : null,
      engines: engineBoard(list), counts,
    });
  }
  judged.sort((a, b) => VERDICTS[a.verdict].order - VERDICTS[b.verdict].order || b.value - a.value);
  categories.sort((a, b) => b.value - a.value);
  const counts = {};
  for (const r of judged) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  return {
    rows: judged, categories, counts,
    totals: {
      articles: judged.length, visits: sumOf(judged, (r) => r.visits), engaged: sumOf(judged, (r) => r.engaged), conversions: sumOf(judged, (r) => r.conversions),
      google: sumOf(judged, (r) => r.google?.clicks), bing: sumOf(judged, (r) => r.bing?.clicks),
      aiCited: sumOf(judged, (r) => r.ai?.cited), aiVisits: sumOf(judged, (r) => r.ai?.sessions),
      unseen: judged.filter((r) => !r.google?.impressions && !r.bing?.impressions).length,
    },
  };
}

/* ---------- service ---------- */

export function createContentCycles({ dbPath, store, auth, articles, bing, aiSearch, siteConfig = null, annotations = null, pageReview = null, now = Date.now, log = console }) {
  let db = null;
  let timer = null;
  const cache = createCache();
  const closing = new Set();

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    return db;
  }

  const today = () => isoDay(now());
  async function settingsOf(site) {
    return (await store.get()).contentCycles?.[site.id] || null;
  }

  async function saveSettings(site, input = {}) {
    if (site.demo) throw new EngineError('The sample site runs on sample cycles. Open one of your own sites to start one.', { kind: 'demo' });
    const days = input.days === undefined ? undefined : Number(input.days);
    if (days !== undefined && (!Number.isInteger(days) || days < 7 || days > 60)) throw new ValidationError('A cycle is between 7 and 60 days.');
    if (input.on && !site.searchSite && !site.propertyId) throw new ValidationError('Link Search Console or GA4 in Settings first: a cycle is judged on what they report.');
    let out;
    await store.update((s) => {
      const all = { ...(s.contentCycles || {}) };
      const cur = all[site.id] || {};
      const next = { ...cur };
      if (input.on !== undefined) next.on = Boolean(input.on);
      if (days !== undefined) next.days = days;
      if (input.askAi !== undefined) next.askAi = Boolean(input.askAi);
      // A schedule starts the day it's first turned on; changing the length starts a new one.
      if (next.on && (!next.start || (days !== undefined && days !== cur.days))) next.start = today();
      next.days = next.days || CYCLE_DAYS;
      next.categories = next.categories || {};
      all[site.id] = next;
      s.contentCycles = all;
      out = next;
    });
    cache.clear(`${site.id}:`);
    if (input.on && out.askAi) startAiChecks(site);
    return overview(site);
  }

  async function setCategory(site, { path, category = '' } = {}) {
    const p = normPath(path);
    if (!String(path || '').startsWith('/')) throw new ValidationError('Give the article’s path, e.g. /blog/post.');
    const name = String(category || '').trim().slice(0, MAX_CATEGORY);
    await store.update((s) => {
      const all = { ...(s.contentCycles || {}) };
      const cur = { days: CYCLE_DAYS, ...(all[site.id] || {}) };
      const cats = { ...(cur.categories || {}) };
      if (name) cats[p] = name;
      else delete cats[p];
      all[site.id] = { ...cur, categories: cats };
      s.contentCycles = all;
    });
    cache.clear(`${site.id}:`);
    return { path: p, category: name || null };
  }

  /* ----- measuring a window ----- */

  async function gsc(site, start, end) {
    if (!site.searchSite) return null;
    const token = await auth.token();
    const filter = hostPageFilter(site.searchSite, site.host, { includeSubdomains: site.includeSubdomains });
    const run = (dimensions, rowLimit) => querySearchAnalytics({ token, siteUrl: site.searchSite, body: {
      startDate: start, endDate: end, dimensions, rowLimit, ...(filter ? { dimensionFilterGroups: [{ groupType: 'and', filters: [filter] }] } : {}),
    } });
    const [pages, pageQueries] = await Promise.all([run(['page'], 5000), run(['page', 'query'], 10000)]);
    const out = new Map();
    const pathOf = (url) => { try { return normPath(new URL(url).pathname); } catch { return ''; } };
    for (const r of pages) {
      const path = pathOf(r.key);
      if (!path) continue;
      const prev = out.get(path);
      const weighted = (prev ? prev.position * prev.impressions : 0) + r.position * r.impressions;
      const impressions = (prev?.impressions || 0) + r.impressions;
      out.set(path, { clicks: (prev?.clicks || 0) + r.clicks, impressions, position: impressions ? weighted / impressions : null, queries: prev?.queries || [] });
    }
    for (const r of pageQueries) out.get(pathOf(r.keys[0]))?.queries.push({ query: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position });
    for (const row of out.values()) row.queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
    return out;
  }

  async function ga4(site, start, end) {
    if (!site.propertyId) return null;
    const token = await auth.token();
    const filter = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
    const report = (body) => runReport({ token, propertyId: site.propertyId, body: { dateRanges: [{ startDate: start, endDate: end }], ...body, dimensionFilter: body.dimensionFilter ? { andGroup: { expressions: [filter, body.dimensionFilter] } } : filter } }).then((r) => r.rows);
    const [landings, events] = await Promise.all([
      report({ dimensions: [{ name: 'landingPage' }, { name: 'sessionSource' }], metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }], limit: 25000 }),
      report({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], limit: 250 }),
    ]);
    // The site's goals: what Outcomes counts as finishing (a download, an
    // install, a sign-up), else the clicks that lead there.
    const classified = classifyEvents(events.map((e) => ({ name: e.eventName, events: Number(e.eventCount) || 0, users: Number(e.totalUsers) || 0 })));
    const goals = (classified.completions.length ? classified.completions : classified.intents.slice(0, 2)).map((e) => e.name);
    const acted = goals.length ? await report({
      dimensions: [{ name: 'landingPage' }, { name: 'sessionSource' }], metrics: [{ name: 'totalUsers' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: goals } } }, limit: 25000,
    }) : [];
    const out = new Map();
    const at = (page, source) => {
      const path = normPath(page);
      const row = out.get(path) || { visits: 0, engaged: 0, conversions: 0, ai: 0, byEngine: {} };
      const engine = engineOf(source);
      row.byEngine[engine] = row.byEngine[engine] || { visits: 0, engaged: 0, conversions: 0 };
      out.set(path, row);
      return { row, e: row.byEngine[engine], engine };
    };
    for (const r of landings) {
      const { row, e, engine } = at(r.landingPage, r.sessionSource);
      const n = Number(r.sessions) || 0;
      const engaged = Number(r.engagedSessions) || 0;
      row.visits += n;
      row.engaged += engaged;
      e.visits += n;
      e.engaged += engaged;
      if (engine === 'ai') row.ai += n;
    }
    for (const r of acted) {
      const { row, e } = at(r.landingPage, r.sessionSource);
      const n = Number(r.totalUsers) || 0;
      row.conversions += n;
      e.conversions += n;
    }
    return { pages: out, goals };
  }

  async function bingPages(site, start, end) {
    const list = await bing.pageStats(site, start, end).catch(() => null);
    if (!list) return null;
    const out = new Map();
    for (const p of list) {
      let path;
      try { path = normPath(new URL(p.page).pathname); } catch { continue; }
      const prev = out.get(path);
      const impressions = (prev?.impressions || 0) + p.impressions;
      const weighted = (prev ? (prev.position || 0) * prev.impressions : 0) + (p.position || 0) * p.impressions;
      out.set(path, { clicks: (prev?.clicks || 0) + p.clicks, impressions, position: impressions ? weighted / impressions : null });
    }
    return out;
  }

  // Every article's snapshot for one window.
  async function measure(site, win) {
    const settings = await settingsOf(site);
    const settle = (p) => p.then((value) => ({ value }), (err) => ({ error: err.message || String(err) }));
    const [list, search, ga, bingData, config] = await Promise.all([
      articles.list(site, '28d', { waitForTitles: false, waitForCode: false }),
      settle(gsc(site, win.start, win.end)),
      settle(ga4(site, win.start, win.end)),
      settle(bingPages(site, win.start, win.end)),
      settle(Promise.resolve(siteConfig?.applied(site))),
    ]);
    const cites = aiSearch?.citations ? aiSearch.citations(site, ms(win.start), ms(win.end) + DAY - 1) : { asked: 0, pages: new Map() };
    const declared = config.value?.search;
    const groups = searchGroups(declared, { all: true });
    const topicPages = new Map((declared?.topics || []).filter((t) => t.page).map((t) => [normPath(t.page), t.name]));
    const overrides = settings?.categories || {};
    const rows = list.rows.filter((r) => r.path).map((r) => {
      const g = search.value?.get(r.path);
      const b = bingData.value?.get(r.path);
      const a = ga.value?.pages.get(r.path);
      const c = cites.pages.get(r.path);
      const cat = categoryOf({ path: r.path, title: r.title, queries: g?.queries || r.search?.queries || [] }, { override: overrides[r.path], groups, topicPages });
      return {
        path: r.path, title: r.title, published: r.published || '', inSitemap: r.inSitemap,
        category: cat.name, categoryFrom: cat.from,
        google: g ? { clicks: g.clicks, impressions: g.impressions, position: g.position, query: g.queries[0]?.query || '' } : null,
        bing: b ? { clicks: b.clicks, impressions: b.impressions, position: b.position } : null,
        ai: { sessions: a?.ai || 0, cited: c?.cited || 0, prompts: c ? [...c.prompts].slice(0, 3) : [], engines: c ? [...c.engines] : [] },
        visits: a?.visits || 0, engaged: a?.engaged || 0, conversions: a?.conversions || 0, byEngine: a?.byEngine || {},
      };
    });
    return {
      rows,
      goals: ga.value?.goals || [],
      sources: {
        google: search.value ? true : site.searchSite ? search.error : false,
        bing: bingData.value ? true : bingData.error || false,
        ga4: ga.value ? true : site.propertyId ? ga.error : false,
        ai: cites.asked,
      },
    };
  }

  /* ----- stored cycles ----- */

  function storedCycles(site) {
    return open().prepare('SELECT * FROM cycles WHERE site_id = ? ORDER BY n').all(site.id)
      .map((c) => ({ n: c.n, start: c.start, end: c.end, closedAt: c.closed_at, goals: JSON.parse(c.goals || '[]'), sources: JSON.parse(c.sources || '{}') }));
  }

  function snapshotsOf(site, n) {
    return new Map(open().prepare('SELECT path, data FROM snapshots WHERE site_id = ? AND n = ?').all(site.id, n).map((r) => [r.path, JSON.parse(r.data)]));
  }

  async function close(site, n) {
    const s = await settingsOf(site);
    if (!s?.start) throw new ValidationError('Start a cycle first.');
    const win = cycleWindow(s.start, s.days, n);
    const key = `${site.id}:${n}`;
    if (closing.has(key)) return null;
    closing.add(key);
    try {
      const m = await measure(site, win);
      const d = open();
      d.exec('BEGIN');
      try {
        d.prepare('DELETE FROM snapshots WHERE site_id = ? AND n = ?').run(site.id, n);
        const put = d.prepare('INSERT INTO snapshots (site_id, n, path, data) VALUES (?, ?, ?, ?)');
        for (const r of m.rows) put.run(site.id, n, r.path, JSON.stringify(r));
        d.prepare('INSERT OR REPLACE INTO cycles (site_id, n, start, end, closed_at, goals, sources) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(site.id, n, win.start, win.end, now(), JSON.stringify(m.goals), JSON.stringify(m.sources));
        d.exec('COMMIT');
      } catch (err) {
        d.exec('ROLLBACK');
        throw err;
      }
      const built = buildCycle({ rows: m.rows, prev: snapshotsOf(site, n - 1), days: win.days, today: addDays(win.end, 1) });
      const c = built.counts;
      try {
        await annotations?.addNote({
          date: addDays(win.end, 1), scope: `site:${site.id}`, label: `Content cycle ${n} measured`,
          body: `${win.start} to ${win.end}: ${fmt(c.grow || 0)} to grow, ${fmt(c.improve || 0)} to improve, ${fmt(c.cut || 0)} to cut, across ${plural(built.categories.length, 'category')}.`,
        });
      } catch { /* the snapshot is what matters */ }
      cache.clear(`${site.id}:`);
      return win;
    } finally {
      closing.delete(key);
    }
  }

  // Measures every cycle that has ended (and whose search data is in) but isn't
  // stored yet. After a long gap only the last ended cycle is measured.
  async function catchUp(site) {
    const s = await settingsOf(site);
    if (!s?.on || !s.start) return [];
    const ended = cycleOn(s.start, s.days, addDays(today(), -SEARCH_LAG_DAYS)) - 1;
    if (ended < 1) return [];
    const have = new Set(storedCycles(site).map((c) => c.n));
    if (have.has(ended)) return [];
    const done = [await close(site, ended)];
    // A new cycle starts with fresh answer checks, so citations land inside it.
    if (s.askAi) startAiChecks(site);
    return done;
  }

  function startAiChecks(site) {
    if (!aiSearch?.run) return;
    aiSearch.run(site).catch((err) => log.error('[content-cycles]', `answer checks: ${err.message}`));
  }

  async function tick() {
    const all = (await store.get()).contentCycles || {};
    for (const site of (await store.sites()).filter((x) => !x.demo && all[x.id]?.on)) {
      await catchUp(site).catch((err) => log.error('[content-cycles]', `${site.id}: ${err.message}`));
    }
  }

  /* ----- what the page shows ----- */

  async function overview(site, { cycle = null, fresh = false } = {}) {
    if (site.demo) return demoOverview(today(), cycle);
    const s = await settingsOf(site);
    const base = {
      settings: { on: Boolean(s?.on), days: s?.days || CYCLE_DAYS, start: s?.start || null, askAi: Boolean(s?.askAi), categories: s?.categories || {} },
      needs: { search: !site.searchSite, ga4: !site.propertyId },
    };
    if (!s?.start) return { ...base, cycles: [], current: null, report: null };
    if (s.on) await catchUp(site).catch((err) => log.error('[content-cycles]', err.message));
    const stored = storedCycles(site);
    const liveN = cycleOn(s.start, s.days, today());
    const live = cycleWindow(s.start, s.days, liveN);
    const lastData = addDays(today(), -SEARCH_LAG_DAYS + 1);
    const current = { ...live, day: Math.min(s.days, Math.floor((ms(today()) - ms(live.start)) / DAY) + 1), measuredTo: lastData < live.start ? null : lastData < live.end ? lastData : live.end };
    const history = stored.map((c) => {
      const rows = [...snapshotsOf(site, c.n).values()];
      return { n: c.n, start: c.start, end: c.end, visits: sumOf(rows, (r) => r.visits), conversions: sumOf(rows, (r) => r.conversions),
        google: sumOf(rows, (r) => r.google?.clicks), bing: sumOf(rows, (r) => r.bing?.clicks), aiCited: sumOf(rows, (r) => r.ai?.cited), articles: rows.length };
    });

    // The report: a stored cycle (the last one by default), or the live one so far.
    const want = cycle === 'live' ? null : cycle ? Number(cycle) : stored.at(-1)?.n ?? null;
    let report;
    if (want && stored.some((c) => c.n === want)) {
      const c = stored.find((x) => x.n === want);
      report = { kind: 'closed', ...c, ...buildCycle({ rows: [...snapshotsOf(site, want).values()], prev: snapshotsOf(site, want - 1), days: s.days, today: addDays(c.end, 1) }) };
    } else if (current.measuredTo) {
      const win = { ...live, end: current.measuredTo };
      const m = await cache.wrap(`${site.id}:live:${win.end}`, LIVE_TTL, fresh, () => measure(site, win));
      const prevWin = stored.find((c) => c.n === liveN - 1);
      const so = Math.floor((ms(win.end) - ms(win.start)) / DAY) + 1;
      // The cycle so far against the one before, scaled to the same number of days.
      report = { kind: 'live', ...win, goals: m.goals, sources: m.sources, partial: win.end < live.end, ...buildCycle({ rows: m.rows, prev: prevWin ? snapshotsOf(site, prevWin.n) : new Map(), days: so, today: today(), prevScale: so / s.days }) };
    } else {
      report = null;
    }
    if (report) {
      const decisions = (await store.get()).pageDecisions?.[site.id] || {};
      report.rows = report.rows.map((r) => ({ ...r, decision: decisions[r.path] || null }));
    }
    return { ...base, cycles: history, current, report };
  }

  // A verdict acted on: grow/keep → keep, improve → improve, cut → remove (or merge).
  async function act(site, { path, verdict, mergeInto = '' } = {}) {
    if (!pageReview) throw new EngineError('Page decisions aren’t available.', { status: 501 });
    const decision = { grow: 'keep', keep: 'keep', improve: 'improve', cut: mergeInto ? 'merge' : 'remove', clear: '' }[verdict];
    if (decision === undefined) throw new ValidationError('Act on grow, keep, improve or cut (or clear).');
    return pageReview.decide(site, { path, decision, mergeInto, note: decision ? `From content cycle verdict: ${VERDICTS[verdict].label}.` : '' });
  }

  return {
    overview, saveSettings, setCategory, close, act, tick,
    start() {
      if (timer) return;
      const safe = () => tick().catch((err) => log.error('[content-cycles]', err.message));
      timer = [setTimeout(safe, 3 * 60_000), setInterval(safe, 6 * HOUR)];
      for (const t of timer) t.unref?.();
    },
    stop() {
      for (const t of timer || []) clearInterval(t);
      timer = null;
      db?.close();
      db = null;
    },
  };
}

/* ---------- demo ---------- */

const DEMO_ARTICLES = [
  ['/blog/ga4-vs-plausible', 'GA4 vs Plausible: what you actually lose', 'Analytics tools', '2026-07-14', [60, 300, 40, 15, 18, 'ga4 vs plausible']],
  ['/blog/plausible-alternatives', 'Plausible alternatives that keep your data', 'Analytics tools', '2026-08-30', [22, 90, 30, 12, 6, 'plausible alternative']],
  ['/blog/fathom-review', 'Fathom Analytics, a year in', 'Analytics tools', '2026-04-11', [2, 0, 0, 1, 0, '']],
  ['/blog/search-console-api-guide', 'The Search Console API, start to finish', 'Search Console', '2026-05-02', [35, 210, 18, 2, 9, 'search console api']],
  ['/blog/gsc-regex-filters', 'Regex filters in Search Console', 'Search Console', '2026-09-20', [9, 50, 14, 0, 2, 'search console regex']],
  ['/blog/indexing-api-myths', 'Five myths about the Indexing API', 'Search Console', '2025-12-02', [0, 0, 0, 0, 0, '']],
  ['/blog/ai-referrals', 'Tracking ChatGPT and Perplexity referrals', 'AI search', '2026-10-28', [4, 6, 3, 9, 1, 'chatgpt referral traffic']],
  ['/blog/llms-txt', 'Do you need an llms.txt?', 'AI search', '2026-06-18', [12, 40, 22, 30, 3, 'llms.txt']],
  ['/blog/bigquery-export-costs', 'What the GA4 BigQuery export really costs', 'BigQuery', '2026-09-08', [14, 120, 6, 1, 4, 'ga4 bigquery cost']],
  ['/blog/launch-week-recap', 'Launch week recap', 'Blog', '2026-02-21', [0, 2, 0, 0, 0, '']],
];

function demoOverview(todayIso, cycle) {
  const days = CYCLE_DAYS;
  const start = addDays(todayIso, -days * 3 - 5);
  const rowsFor = (n, part = 1) => DEMO_ARTICLES.map(([path, title, category, published, [clicks, visits, bingClicks, ai, acts, query]]) => {
    const live = ms(published) <= ms(addDays(cycleWindow(start, days, n).end, 0));
    const f = live ? part * [0.6, 0.85, 1, 1.15][n - 1] * (path.includes('plausible-alt') ? n / 2 : 1) * (path.includes('fathom') ? 1 / n : 1) : 0;
    const v = Math.round(visits * f);
    return {
      path, title, published, inSitemap: true, category, categoryFrom: 'topic',
      google: { clicks: Math.round(clicks * f), impressions: Math.round(clicks * f * 28 + (v ? 40 : 0)), position: clicks ? 6 + (10 - clicks / 7) : 38, query },
      bing: { clicks: Math.round(bingClicks * f), impressions: Math.round(bingClicks * f * 20), position: bingClicks ? 4.5 : null },
      ai: { sessions: Math.round(ai * f * 0.6), cited: Math.round(ai * f * 0.4), prompts: ai ? [`best ${category.toLowerCase()} for a small site`] : [], engines: ai ? ['claude', 'perplexity'] : [] },
      visits: v, engaged: Math.round(v * (path.includes('bigquery') ? 0.22 : 0.6)), conversions: Math.round(acts * f),
      byEngine: {
        google: { visits: Math.round(clicks * f), engaged: Math.round(clicks * f * 0.6), conversions: Math.min(Math.round(clicks * f * 0.6), Math.round(acts * f * 0.4)) },
        bing: { visits: Math.round(bingClicks * f), engaged: Math.round(bingClicks * f * 0.7), conversions: Math.min(Math.round(bingClicks * f * 0.7), Math.round(acts * f * 0.35)) },
        ai: { visits: Math.round(ai * f * 0.6), engaged: Math.round(ai * f * 0.5), conversions: Math.min(Math.round(ai * f * 0.5), Math.round(acts * f * 0.25)) },
      },
    };
  });
  const closed = [1, 2, 3].map((n) => ({ ...cycleWindow(start, days, n), rows: rowsFor(n) }));
  const live = cycleWindow(start, days, 4);
  const want = cycle === 'live' ? 4 : Number(cycle) || 3;
  const soFar = Math.floor((ms(addDays(todayIso, -2)) - ms(live.start)) / DAY) + 1;
  const pick = want === 4 ? { ...live, end: addDays(todayIso, -2), rows: rowsFor(4, soFar / days) } : closed[want - 1];
  const prev = new Map((want > 1 ? (want === 4 ? closed[2] : closed[want - 2]).rows : []).map((r) => [r.path, r]));
  return {
    demo: true,
    settings: { on: true, days, start, askAi: true, categories: {} },
    needs: { search: false, ga4: false },
    cycles: closed.map((c) => ({ n: c.n, start: c.start, end: c.end, articles: c.rows.length, visits: sumOf(c.rows, (r) => r.visits), conversions: sumOf(c.rows, (r) => r.conversions),
      google: sumOf(c.rows, (r) => r.google.clicks), bing: sumOf(c.rows, (r) => r.bing.clicks), aiCited: sumOf(c.rows, (r) => r.ai.cited) })),
    current: { ...live, day: Math.floor((ms(todayIso) - ms(live.start)) / DAY) + 1, measuredTo: addDays(todayIso, -2) },
    report: {
      kind: want === 4 ? 'live' : 'closed', n: want, start: pick.start, end: pick.end, partial: want === 4,
      goals: ['file_download'], sources: { google: true, bing: true, ga4: true, ai: 24 },
      ...(() => {
        const so = want === 4 ? Math.floor((ms(pick.end) - ms(pick.start)) / DAY) + 1 : days;
        return buildCycle({ rows: pick.rows, prev, days: so, today: want === 4 ? todayIso : addDays(pick.end, 1), prevScale: so / days });
      })(),
    },
  };
}

export function contentCycleRoutes({ cycles, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/content-cycles$/, async ({ match, query }) =>
      cycles.overview(await siteOr404(match[1]), { cycle: query.get('cycle') || null, fresh: query.has('fresh') })],
    ['POST', /^\/api\/sites\/([\w-]+)\/content-cycles$/, async ({ match, body }) => cycles.saveSettings(await siteOr404(match[1]), body || {})],
    ['POST', /^\/api\/sites\/([\w-]+)\/content-cycles\/category$/, async ({ match, body }) => cycles.setCategory(await siteOr404(match[1]), body || {})],
    ['POST', /^\/api\/sites\/([\w-]+)\/content-cycles\/act$/, async ({ match, body }) => cycles.act(await siteOr404(match[1]), body || {})],
  ];
}
