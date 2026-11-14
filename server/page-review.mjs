// Page review: every page on the site (sitemap + repo + anything GA4 saw, from
// articles.mjs) with what it earns, and a suggestion for what to do with it:
// keep it, rewrite its title, improve its content, get it found, or merge or
// remove it. Four signals, over 90 days by default:
//  - people: visits that landed on it and how many stayed (GA4);
//  - search: impressions, clicks and position in Google and Bing;
//  - AI: visits sent by ChatGPT, Perplexity and other assistants;
//  - age: a page younger than ~6 weeks hasn't had a fair chance yet.
// Pages a site needs whatever their traffic (home, pricing, legal, docs…) are kept.
//
// The suggestion is a starting point; the decision is yours and is kept in
// studio.json `pageDecisions[siteId][path]` = { decision, note?, mergeInto?, at }.

import { ValidationError } from './store.mjs';
import { createCache } from './cache.mjs';
import { nextGoal, progress, currentValue, PURPOSES } from './page-goals.mjs';

const DAY = 86_400_000;
export const DECISIONS = ['keep', 'improve', 'merge', 'remove'];
const NEEDED = /^\/(?:$|(?:privacy|terms|legal|cookies?|contact|about|login|log-in|signin|sign-in|signup|sign-up|register|account|download|downloads|install|pricing|changelog|docs?|help|faq|support|security|imprint|careers|press|status|404)(?:[/.-]|$))/i;
const NEW_DAYS = 45;
const pathOf = (url) => {
  try {
    return new URL(url).pathname.replace(/(.)\/$/, '$1') || '/';
  } catch {
    return '';
  }
};
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (v) => `${Math.round((v || 0) * 100)}%`;

export const SUGGESTIONS = {
  needed: { label: 'Keep: needed', order: 6 },
  keep: { label: 'Keep', order: 5 },
  new: { label: 'Too new to judge', order: 4 },
  'improve-content': { label: 'Improve the content', order: 1 },
  'improve-title': { label: 'Rewrite title and description', order: 2 },
  'not-found': { label: 'Not found in search', order: 3 },
  cut: { label: 'Merge or remove', order: 0 },
  watch: { label: 'Small but alive', order: 4.5 },
};

// One page's suggestion, with the reason in plain words. Pure.
//   row: articles.mjs row (+ bing: { clicks, impressions, position } | null)
//   ctx: { days, siteSessions, today }
export function suggest(row, { days = 90, siteSessions = 0, today = new Date().toISOString().slice(0, 10) } = {}) {
  const visits = row.sessions || 0;
  const google = row.search || { clicks: 0, impressions: 0, position: null };
  const bing = row.bing || { clicks: 0, impressions: 0, position: null };
  const impressions = (google.impressions || 0) + (bing.impressions || 0);
  const clicks = (google.clicks || 0) + (bing.clicks || 0);
  const ai = row.aiSessions || 0;
  const born = row.published || row.lastmod || '';
  const age = born ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${born.slice(0, 10)}T00:00:00Z`)) / DAY) : null;
  const scale = days / 90;
  const low = Math.max(3 * scale, siteSessions * 0.001);
  const strong = Math.max(30 * scale, siteSessions * 0.01);
  const said = `${fmt(visits)} visits, ${fmt(impressions)} search impressions, ${fmt(clicks)} search clicks${ai ? `, ${fmt(ai)} from AI assistants` : ''} in ${days} days.`;
  const top = google.queries?.[0]?.query;

  if (NEEDED.test(row.path || '')) return { suggestion: 'needed', reason: `A page the site needs, whatever its traffic. ${said}` };
  const earning = visits >= strong || clicks >= 20 * scale || ai >= 5 * scale;
  // Only a page that isn't earning yet gets the benefit of the doubt for being new
  // (a recent edit moves lastmod, which says nothing about how it does).
  if (!earning && age !== null && age >= 0 && age < NEW_DAYS) return { suggestion: 'new', reason: `Published ${age} day${age === 1 ? '' : 's'} ago: search engines usually take 4–6 weeks to settle on a new page. ${said}` };

  if (earning) {
    if (visits >= 20 * scale && row.engagementRate && row.engagementRate < 0.35) {
      return { suggestion: 'improve-content', reason: `People come, but only ${pct(row.engagementRate)} stay engaged: the page doesn’t give them what they came for. ${said}` };
    }
    if (google.impressions >= 300 * scale && google.clicks / google.impressions < 0.015 && google.position && google.position <= 12) {
      return { suggestion: 'improve-title', reason: `Google shows it ${fmt(google.impressions)} times around position ${google.position.toFixed(1)}, but ${pct(google.clicks / google.impressions)} click: the title and description don’t win the click${top ? ` for “${top}”` : ''}. ${said}` };
    }
    if (google.impressions >= 300 * scale && google.position > 12 && google.position <= 30) {
      return { suggestion: 'improve-content', reason: `Earns visits, and Google shows it ${fmt(google.impressions)} times, but around position ${google.position.toFixed(1)}: page ${Math.ceil(google.position / 10)}${top ? ` for “${top}”` : ''}. Better content could reach page one. ${said}` };
    }
    return { suggestion: 'keep', reason: `Earns its place. ${said}` };
  }
  if (impressions >= 100 * scale) {
    const deep = google.position && google.position > 20;
    return deep
      ? { suggestion: 'improve-content', reason: `Search shows it, but around position ${google.position.toFixed(1)}, page ${Math.ceil(google.position / 10)}${top ? ` for “${top}”` : ''}: it needs better content to reach the first page. ${said}` }
      : { suggestion: 'improve-title', reason: `Shown ${fmt(impressions)} times in search, but few click: rewrite the title and description${top ? ` around “${top}”` : ''}. ${said}` };
  }
  if (impressions < 20 * scale && visits < low) {
    if (!row.inSitemap && row.path) return { suggestion: 'not-found', reason: `Not in the sitemap, and search engines don’t show it. Add it to the sitemap, or remove it. ${said}` };
    if (age === null || age >= 90) return { suggestion: 'cut', reason: `Nobody comes, search engines don’t show it, and no AI sends anyone. Check it’s indexed, then merge it into a related page or remove it and redirect. ${said}` };
    return { suggestion: 'not-found', reason: `Young, but search engines barely show it yet. Check it’s indexed. ${said}` };
  }
  if (impressions < 20 * scale) return { suggestion: 'not-found', reason: `People reach it other ways, but search engines don’t show it: check it’s indexed. ${said}` };
  return { suggestion: 'watch', reason: `Small but alive. ${said}` };
}

// The review for a site: rows with suggestions and decisions, and counts. Pure.
export function buildReview({ rows, bingPages = [], decisions = {}, days = 90, siteSessions = 0, today }) {
  const bing = new Map();
  for (const p of bingPages) {
    const path = pathOf(p.page);
    if (!path) continue;
    const b = bing.get(path) || { clicks: 0, impressions: 0, weighted: 0 };
    b.clicks += p.clicks || 0;
    b.impressions += p.impressions || 0;
    b.weighted += (p.position || 0) * (p.impressions || 0);
    bing.set(path, b);
  }
  const out = rows.filter((r) => r.path).map((r) => {
    const b = bing.get(r.path.replace(/(.)\/$/, '$1'));
    const row = { ...r, bing: b ? { clicks: b.clicks, impressions: b.impressions, position: b.impressions ? b.weighted / b.impressions : null } : null };
    return {
      path: r.path, url: r.url, title: r.title, published: r.published || r.lastmod || '', inSitemap: r.inSitemap, file: r.file ? { file: r.file.file, repo: r.file.repo } : null,
      visits: r.sessions || 0, views: r.views || 0, engagementRate: r.engagementRate || 0, ai: r.aiSessions || 0,
      google: r.search ? { clicks: r.search.clicks, impressions: r.search.impressions, position: r.search.position, queries: r.search.queries } : null,
      bing: row.bing,
      ...suggest(row, { days, siteSessions, today }),
      decision: decisions[r.path] || null,
    };
  });
  out.sort((a, b) => SUGGESTIONS[a.suggestion].order - SUGGESTIONS[b.suggestion].order || b.visits - a.visits);
  const counts = {};
  for (const r of out) counts[r.suggestion] = (counts[r.suggestion] || 0) + 1;
  return { rows: out, counts, decided: out.filter((r) => r.decision).length };
}

// The first review of a site reads its sitemap, 90 days of GA4, Search Console
// and Bing, and its repo, so the numbers are kept on disk (cacheDb) and shown
// stale while they refresh. Decisions are read fresh on every call.
// The periods the numbers can cover. Search Console runs 2–3 days behind, so for
// today and this week it shows its latest 7 days; Bing keeps whole days only.
export const PERIODS = {
  today: { days: 1, bing: '7d', label: 'today so far', search: 'the last 7 days Search Console has' },
  week: { days: 7, bing: '7d', label: 'this week so far', search: 'the last 7 days Search Console has' },
  '7d': { days: 7, bing: '7d', label: 'the last 7 days' },
  '28d': { days: 28, bing: '28d', label: 'the last 28 days' },
  '90d': { days: 90, bing: '90d', label: 'the last 90 days' },
};
const periodOf = (key) => ({ key, label: PERIODS[key].label, ...(PERIODS[key].search ? { search: PERIODS[key].search } : {}) });

// Outcome users / visitors over the landing pages Outcomes reports, or null without enough visitors.
export function siteRateOf(conversions) {
  const visitors = conversions.reduce((a, c) => a + (c.visitors || 0), 0);
  const users = conversions.reduce((a, c) => a + (c.goalUsers || 0), 0);
  return visitors >= 50 ? Math.min(1, users / visitors) : null;
}

export function createPageReview({ articles, bing, store, outcomes = null, cacheDb = null, today = () => new Date().toLocaleDateString('en-CA') }) {
  const cache = createCache({ db: cacheDb, name: 'page-review', staleFor: cacheDb ? 7 * 86_400_000 : 0 });

  // Suggestions and goals are always judged on 90 days (a page shouldn't look
  // dead because nobody came today); the numbers shown follow `rangeKey`.
  async function review(site, rangeKey = '90d', { fresh = false } = {}) {
    const key = PERIODS[rangeKey] ? rangeKey : '90d';
    const judged = await judge(site, fresh);
    if (key === '90d') return { ...judged, period: periodOf('90d') };
    const { rows, bingPages, siteSessions } = await cache.wrap(`${site.id}:${key}`, 30 * 60_000, fresh, () => gather(site, key, PERIODS[key].days, { goals: false }));
    const numbers = new Map(buildReview({ rows, bingPages, days: PERIODS[key].days, siteSessions, today: today() }).rows.map((r) => [r.path, r]));
    const none = { visits: 0, views: 0, engagementRate: 0, ai: 0, google: null, bing: null };
    return {
      ...judged,
      period: periodOf(key),
      rows: judged.rows.map((r) => {
        const n = numbers.get(r.path) || none;
        return { ...r, visits: n.visits, views: n.views, engagementRate: n.engagementRate, ai: n.ai, google: n.google, bing: n.bing };
      }),
    };
  }

  async function judge(site, fresh) {
    // `fresh` reaches the sitemap too, so pages just added to it show up.
    const { rows, bingPages, siteSessions, ...base } = await cache.wrap(`${site.id}:90d`, 30 * 60_000, fresh, () => gather(site, '90d', 90, { fresh }));
    const saved = await store.get();
    const decisions = saved.pageDecisions?.[site.id] || {};
    const goals = saved.pageGoals?.[site.id] || {};
    // Titles read in the background since the numbers were gathered.
    const titles = articles.titles?.(site, rows.filter((r) => !r.title).map((r) => r.path)) || new Map();
    const named = rows.map((r) => (r.title || !titles.get(r.path) ? r : { ...r, title: titles.get(r.path) }));
    const built = buildReview({ rows: named, bingPages, decisions, days: 90, siteSessions, today: today() });
    return { ...base, ...built, rows: withGoals(built.rows, base, goals, 90) };
  }

  // Each row's purpose, whether it serves it, its next goal, and a saved goal's progress.
  function withGoals(rows, base, goals, days) {
    const conv = new Map((base.conversions || []).map((c) => [c.path, c]));
    const engaged = rows.filter((r) => r.visits >= 10).map((r) => r.engagementRate).sort((a, b) => a - b);
    const siteEngagement = engaged.length ? engaged[Math.floor(engaged.length / 2)] : 0.5;
    return rows.map((r) => {
      const mine = goals[r.path] || {};
      const conversion = conv.get(r.path) || null;
      const goal = nextGoal(r, { days, today: today(), conversion, siteRate: base.siteRate ?? null, siteEngagement, outcome: base.outcome || 'converted', purpose: mine.purpose || '' });
      const target = mine.target || null;
      return { ...r, goal: { ...goal, days, ...(target ? { target, progress: progress(target, currentValue(target, r, conversion)) } : {}) } };
    });
  }

  // Your purpose for a page, and/or its next goal saved as the target to track.
  async function setGoal(site, { path, purpose, set = '', clear = false } = {}) {
    const p = String(path || '').trim();
    if (!p.startsWith('/')) throw new ValidationError('Give the page’s path, e.g. /blog/post.');
    if (purpose !== undefined && purpose !== '' && !PURPOSES[purpose]) throw new ValidationError(`A purpose is one of: ${Object.keys(PURPOSES).join(', ')}.`);
    let target;
    if (set === 'next') {
      // Saved from the goal as computed now, so it starts from today's numbers.
      const purposeNow = purpose !== undefined ? purpose : (await store.get()).pageGoals?.[site.id]?.[p]?.purpose || '';
      await store.update((s) => {
        const all = { ...(s.pageGoals || {}) };
        all[site.id] = { ...(all[site.id] || {}), [p]: { ...(all[site.id]?.[p] || {}), purpose: purposeNow || undefined } };
        s.pageGoals = all;
      });
      const row = (await review(site, '90d')).rows.find((r) => r.path === p);
      if (!row) throw new ValidationError('That page isn’t in the review.');
      const n = row.goal.next;
      target = { key: n.key, title: n.title, metric: n.metric, from: n.from, to: n.to, ...(n.query ? { query: n.query } : {}), checkBy: n.checkBy, setAt: today() };
    }
    await store.update((s) => {
      const all = { ...(s.pageGoals || {}) };
      const mine = { ...(all[site.id] || {}) };
      const entry = { ...(mine[p] || {}) };
      if (purpose !== undefined) {
        if (purpose) entry.purpose = purpose;
        else delete entry.purpose;
      }
      if (target) entry.target = target;
      if (clear) delete entry.target;
      if (entry.purpose || entry.target) mine[p] = entry;
      else delete mine[p];
      all[site.id] = mine;
      s.pageGoals = all;
    });
    return { path: p, goal: (await review(site, '90d')).rows.find((r) => r.path === p)?.goal || null };
  }

  // Everything but the decisions: plain JSON, so it keeps on disk.
  async function gather(site, key, days, { goals = true, fresh = false } = {}) {
    const product = goals ? ((await store.get()).products || []).find((p) => p.siteId === site.id) : null;
    const [list, bingData, out] = await Promise.all([
      // Titles already read come with it; the rest are read in the background.
      articles.list(site, key, { all: true, fresh, waitForTitles: false, waitForCode: false }),
      // Bing keeps days, not "today" or "this week": those read its last 7 days.
      site.demo ? null : bing.overview(site, PERIODS[key].bing).catch(() => null),
      product && outcomes ? outcomes.get(product.id, key).catch(() => null) : null,
    ]);
    // Which landing pages lead to the product's outcome goals, and the site's rate.
    const conversions = (out?.pages || []).map((p) => ({ path: String(p.key || '').split('?')[0].replace(/(.)\/$/, '$1') || '/', visitors: p.visitors, goalUsers: p.goalUsers, rate: p.rate }));
    const siteSessions = list.totals?.sessions && list.totals.share ? list.totals.sessions / list.totals.share : list.rows.reduce((a, r) => a + (r.sessions || 0), 0);
    return {
      range: key, days, host: list.host, rows: list.rows, bingPages: bingData?.pages || [], siteSessions,
      // The site's rate from its landing pages: visitors who went on to the outcome on the site.
      conversions, siteRate: siteRateOf(conversions), outcome: out?.rateLabel || '',
      sources: { sitemap: list.sitemapUrls ?? null, bing: Boolean(bingData) },
      notes: { ...list.notes, ...(bingData || site.demo ? {} : { bing: 'Connect Bing Webmaster Tools to count Bing search too.' }) },
    };
  }

  async function decide(site, { path, decision, note = '', mergeInto = '' } = {}) {
    const p = String(path || '').trim();
    if (!p.startsWith('/') || p.length > 500) throw new ValidationError('Give the page’s path, e.g. /blog/post.');
    if (decision && !DECISIONS.includes(decision)) throw new ValidationError(`A decision is one of: ${DECISIONS.join(', ')}.`);
    const into = String(mergeInto || '').trim();
    if (into && !into.startsWith('/')) throw new ValidationError('Merge into another page’s path, e.g. /blog/guide.');
    const entry = decision ? { decision, ...(note.trim() ? { note: note.trim().slice(0, 1000) } : {}), ...(decision === 'merge' && into ? { mergeInto: into } : {}), at: Date.now() } : null;
    await store.update((s) => {
      const all = { ...(s.pageDecisions || {}) };
      const mine = { ...(all[site.id] || {}) };
      if (entry) mine[p] = entry;
      else delete mine[p];
      all[site.id] = mine;
      s.pageDecisions = all;
    });
    return { path: p, decision: entry };
  }

  async function goalFor(site, path, rangeKey = '90d') {
    const all = await review(site, rangeKey);
    const row = all.rows.find((r) => r.path === path);
    if (!row) throw new ValidationError('That page isn’t in the review: it’s not in the sitemap, the repo or GA4.');
    return { ...row, period: all.period };
  }

  return { review, decide, setGoal, goalFor };
}

export function pageReviewRoutes({ review, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/page-review$/, async ({ match, query }) => review.review(await siteOr404(match[1]), query.get('range') || '90d', { fresh: query.has('fresh') })],
    ['POST', /^\/api\/sites\/([\w-]+)\/page-decisions$/, async ({ match, body }) => review.decide(await siteOr404(match[1]), body)],
    ['POST', /^\/api\/sites\/([\w-]+)\/page-goals$/, async ({ match, body }) => review.setGoal(await siteOr404(match[1]), body)],
    ['GET', /^\/api\/sites\/([\w-]+)\/page-goal$/, async ({ match, query }) => review.goalFor(await siteOr404(match[1]), query.get('path') || '', query.get('range') || '90d')],
  ];
}
