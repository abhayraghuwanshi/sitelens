// Calendar: every day of a month with its traffic against a typical same
// weekday, the day's dated events (annotations) and alerts, and a per-day story
// that explains the change: which sources and landing pages moved, what shipped
// or was posted that day or the day before, plus search, GitHub and extension
// numbers.
//
// Real sites read their days from calendar-store.mjs (.data/calendar.db),
// which keeps ~14 months locally and syncs small deltas; the sample site is
// generated here.
//
// Baseline = the median of the same weekday over the previous 4 weeks, so
// weekends aren't flagged as drops every week and one spike doesn't make the
// following weeks look like drops.

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { ValidationError } from './store.mjs';
import { localDay } from './alerts.mjs';
import { sourceFamily } from './journey.mjs';

const DAY = 86_400_000;
const WEEKS = 4;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 500;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- Pure helpers (unit-tested) ---------- */

export function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export function weekdayName(iso) {
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

export function monthDays(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

// Median of the same weekday over the previous `weeks` weeks. Days before the
// series starts don't count; days inside it with no row are real zeros.
export function weekdayBaseline(values, date, { weeks = WEEKS, start = '' } = {}) {
  const seen = [];
  for (let w = 1; w <= weeks; w++) {
    const d = addDays(date, -7 * w);
    if (start && d < start) break;
    seen.push(values.get(d) || 0);
  }
  if (!seen.length) return null;
  seen.sort((a, b) => a - b);
  const mid = Math.floor(seen.length / 2);
  return seen.length % 2 ? seen[mid] : (seen[mid - 1] + seen[mid]) / 2;
}

// Change vs baseline and a 5-step tone for the cell colour. Tiny numbers stay neutral.
export function dayTone(value, baseline, { minVolume = 5 } = {}) {
  if (value === null || value === undefined || baseline === null || baseline === undefined) return { change: null, tone: 'none' };
  if (Math.max(value, baseline) < minVolume) return { change: baseline ? (value - baseline) / baseline : null, tone: 'flat' };
  const change = baseline ? (value - baseline) / baseline : Infinity;
  const tone = change >= 0.4 ? 'up2' : change >= 0.15 ? 'up' : change <= -0.4 ? 'down2' : change <= -0.15 ? 'down' : 'flat';
  return { change, tone };
}

// The day an alert is about: the date its key ends with, else the day it fired.
export function alertDay(alert) {
  return String(alert.key || '').match(/(\d{4}-\d{2}-\d{2})$/)?.[1] || localDay(alert.at);
}

// Rows of { key, value } for the day vs the window before it, scaled so the
// window's total matches the day's expected total. Sorted by gain.
export function shiftRows(current, previous, { key = (r) => r.key, scale = 1 } = {}) {
  const group = (rows) => {
    const out = new Map();
    for (const r of rows) out.set(key(r), (out.get(key(r)) || 0) + (Number(r.value) || 0));
    return out;
  };
  const cur = group(current);
  const prev = group(previous);
  return [...new Set([...cur.keys(), ...prev.keys()])]
    .map((label) => {
      const value = cur.get(label) || 0;
      const expected = Math.round((prev.get(label) || 0) * scale * 10) / 10;
      return { label, value, expected, gain: Math.round((value - expected) * 10) / 10 };
    })
    .sort((a, b) => b.gain - a.gain || b.value - a.value);
}

const num = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');
const pct = (v) => `${Math.round(Math.abs(v) * 100)}%`;
const signed = (v) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v))}`;

// The day as a few plain sentences. Every input is optional.
export function composeStory({ date, today = '', sessions = null, baseline = null, sites = [], events = [], eventsBefore = [], alerts = [], github = null, extensions = [] }) {
  const lines = [];
  const weekday = weekdayName(date);
  const partial = date === today;
  const { change, tone } = dayTone(sessions, baseline);
  let headline;
  if (sessions === null) headline = 'No traffic data for this day.';
  else if (partial) headline = `So far today: ${num(sessions)} sessions${baseline ? ` (a full ${weekday} is usually ~${num(baseline)}).` : '.'}`;
  else if (baseline === null || change === null) headline = `${num(sessions)} sessions.`;
  else if (tone === 'up2') headline = `Big day: ${num(sessions)} sessions, ${pct(change)} above a typical ${weekday}.`;
  else if (tone === 'up') headline = `Busier than usual: ${num(sessions)} sessions, ${pct(change)} above a typical ${weekday}.`;
  else if (tone === 'down2') headline = `Quiet day: ${num(sessions)} sessions, ${pct(change)} below a typical ${weekday}.`;
  else if (tone === 'down') headline = `Slower than usual: ${num(sessions)} sessions, ${pct(change)} below a typical ${weekday}.`;
  else headline = `A typical ${weekday}: ${num(sessions)} sessions (usually ~${num(baseline)}).`;

  const moved = !partial && (tone === 'up' || tone === 'up2' || tone === 'down' || tone === 'down2');
  const up = tone === 'up' || tone === 'up2';
  const multi = sites.length > 1;
  for (const s of sites) {
    const where = multi ? `${s.label}: ` : '';
    const st = dayTone(s.sessions, s.baseline);
    if (multi && s.sessions !== null && s.sessions !== undefined) {
      lines.push({ kind: 'site', tone: st.tone, href: `#/site/${s.id}/overview`, text: `${s.label}: ${num(s.sessions)} sessions${st.change !== null && Number.isFinite(st.change) && !partial ? ` (${st.change >= 0 ? '+' : '−'}${pct(st.change)} vs usual)` : ''}.` });
    }
    if (s.error) lines.push({ kind: 'error', text: `${where}${s.error}` });
    const siteMoved = multi ? !partial && ['up', 'up2', 'down', 'down2'].includes(st.tone) : moved;
    const siteUp = multi ? st.tone === 'up' || st.tone === 'up2' : up;
    if (siteMoved && s.sources?.length) {
      const pick = siteUp ? s.sources[0] : s.sources.at(-1);
      if (pick && Math.abs(pick.gain) >= 3) {
        lines.push({ kind: 'source', text: siteUp
          ? `${where}Most of the extra traffic came from ${pick.label} (${num(pick.value)} sessions, usually ~${num(pick.expected)}).`
          : `${where}The drop was mostly ${pick.label} (${num(pick.value)} sessions, usually ~${num(pick.expected)}).` });
      }
    }
    if (siteMoved && siteUp && s.pages?.length) {
      const page = s.pages[0];
      if (page.gain >= 3) lines.push({ kind: 'page', text: `${where}${page.label} drew ${num(page.value)} landing sessions (usually ~${num(page.expected)}).` });
    }
    if (s.search?.pending) lines.push({ kind: 'search', text: `${where}Search Console hasn’t reported this day yet; it lags 2–3 days.` });
    else if (s.search && s.search.clicks !== null) {
      const sc = dayTone(s.search.clicks, s.search.baseline);
      const vs = sc.change !== null && Number.isFinite(sc.change) && sc.tone !== 'flat' ? ` (${sc.change >= 0 ? '+' : '−'}${pct(sc.change)} vs usual)` : '';
      const top = s.search.queries?.[0];
      lines.push({ kind: 'search', text: `${where}Search: ${num(s.search.clicks)} click${s.search.clicks === 1 ? '' : 's'}${vs}${top ? `, top query “${top.query}”` : ''}.` });
    }
  }
  // Claude's comments are analysis of the day, not things that happened on it.
  const happened = events.filter((e) => e.kind !== 'claude');
  const happenedBefore = eventsBefore.filter((e) => e.kind !== 'claude');
  if (happened.length) lines.push({ kind: 'event', text: `That day: ${happened.map((e) => e.label).join('; ')}.` });
  if (happenedBefore.length && moved) lines.push({ kind: 'event', text: `The day before: ${happenedBefore.map((e) => e.label).join('; ')}.` });
  if (github?.stars) lines.push({ kind: 'github', text: `GitHub: ${signed(github.stars)} stars${github.top ? ` (most on ${github.top})` : ''}.` });
  for (const e of extensions) {
    if (e.users === null || e.users === undefined) continue;
    lines.push({ kind: 'extension', text: `${e.label}: ${num(e.users)} users${e.delta ? ` (${signed(e.delta)} vs the day before)` : ''}.` });
  }
  if (alerts.length) lines.push({ kind: 'alert', text: `${alerts.length === 1 ? 'Alert' : `${alerts.length} alerts`}: ${alerts.map((a) => a.title).join('; ')}.` });
  return { headline, tone: partial ? 'none' : tone, change, lines };
}

// Daily star gains per day from ghstats' repo_stats, carrying the last known
// count forward (0 means "not recorded"). `repos` null = every visible repo.
export function githubDaily(path, { from, to, repos = null }) {
  if (!path || !existsSync(path)) return new Map();
  const db = new DatabaseSync(path, { readOnly: true, timeout: 3000 });
  let rows;
  try {
    rows = db.prepare(`SELECT r.name, substr(s.date, 1, 10) AS date, s.stars FROM repo_stats s JOIN repos r ON r.id = s.repo_id
      WHERE r.hidden = 0 AND substr(s.date, 1, 10) <= ? ORDER BY s.date`).all(to);
  } finally {
    db.close();
  }
  const wanted = repos ? new Set(repos) : null;
  const byRepo = new Map();
  for (const r of rows) {
    if (wanted && !wanted.has(r.name)) continue;
    if (!byRepo.has(r.name)) byRepo.set(r.name, []);
    byRepo.get(r.name).push(r);
  }
  const out = new Map();
  for (const [name, list] of byRepo) {
    let last = 0;
    for (const r of list) {
      if (!r.stars) continue;
      const gain = last ? r.stars - last : 0;
      last = r.stars;
      if (r.date < from || gain <= 0) continue;
      const day = out.get(r.date) || { stars: 0, top: '', topGain: 0 };
      day.stars += gain;
      if (gain > day.topGain) Object.assign(day, { top: name, topGain: gain });
      out.set(r.date, day);
    }
  }
  return out;
}

/* ---------- Demo data: deterministic, so any month of the sample site has a story ---------- */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const unit = (seed) => (hash(seed) % 10_000) / 10_000;

const DEMO_SOURCES = [['google', 0.42], ['(direct)', 0.24], ['newsletter', 0.07], ['bing', 0.05], ['github.com', 0.05], ['duckduckgo', 0.04], ['chatgpt.com', 0.04], ['t.co', 0.03], ['reddit.com', 0.03], ['news.ycombinator.com', 0.03]];
const DEMO_PAGES = [['/', 0.34], ['/docs', 0.18], ['/pricing', 0.12], ['/blog/ga4-bigquery-guide', 0.11], ['/features', 0.09], ['/changelog', 0.06], ['/blog/local-first-analytics', 0.05], ['/about', 0.05]];
const DEMO_QUERIES = [['coolsite analytics', 0.3], ['ga4 bigquery export', 0.22], ['ga4 funnel without alpha api', 0.14], ['local analytics dashboard', 0.12], ['search console regex groups', 0.1], ['ga4 retention cohorts', 0.12]];
const DEMO_EVENTS = [
  { lift: 2.2, source: 'reddit.com', page: '/blog/local-first-analytics', kind: 'post', label: 'Your Reddit post: Why I moved my analytics off the cloud' },
  { lift: 1.8, source: 'news.ycombinator.com', page: '/', kind: 'mention', label: 'Show HN: a local GA4 + BigQuery dashboard' },
  { lift: 0.7, source: 'google', page: '/docs', kind: 'deploy', label: 'Deploy: docs moved to /docs/v2 (old links 404)' },
  { lift: 1.4, source: 'newsletter', page: '/changelog', kind: 'release', label: 'app v1.8 released' },
];

export function demoEvent(siteId, date) {
  return DEMO_EVENTS[hash(`${siteId}:event:${date}`) % 23] || null;
}

// One day of the sample site: totals, sources, landing pages and search.
export function demoDay(siteId, date) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekday = [0.58, 1.04, 1.1, 1.08, 1.02, 0.92, 0.55][dow];
  const growth = 1 + (Date.parse(date) - Date.parse('2026-01-01')) / DAY * 0.001;
  const base = 380 * weekday * growth * (0.9 + unit(`${siteId}:${date}`) * 0.2);
  const event = demoEvent(siteId, date);
  const sessions = Math.round(base * (event?.lift || 1));
  const extra = sessions - base;
  const split = (mix, hit) => mix.map(([key, share]) => ({ key, value: Math.max(0, Math.round(base * share + (key === hit ? extra : 0))) }));
  const clicks = Math.round(base * 0.2 * (event?.source === 'google' ? event.lift : 1));
  return {
    sessions,
    users: Math.round(sessions * 0.78),
    views: Math.round(sessions * 2.3),
    clicks,
    sources: split(DEMO_SOURCES, event?.source),
    pages: split(DEMO_PAGES, event?.page),
    queries: DEMO_QUERIES.map(([query, share]) => ({ query, clicks: Math.round(clicks * share) })),
    event,
  };
}

/* ---------- The service ---------- */

export function createCalendar({ store, history, annotations, extensions = null, githubDbPath = () => null, now = () => Date.now() }) {
  // Which sites, repos and extensions a view covers. 'all' = every real site
  // (the sample only when there's nothing else); a site adds its product's repos and extensions.
  async function scope(siteParam = 'all') {
    const all = await store.sites();
    if (!siteParam || siteParam === 'all') {
      const real = all.filter((s) => !s.demo);
      return { key: 'all', sites: real.length ? real : all.filter((s) => s.demo), repos: null, extIds: null, scopes: null };
    }
    const site = all.find((s) => s.id === siteParam);
    if (!site) throw new ValidationError('Unknown site.');
    const products = ((await store.get()).products || []).filter((p) => p.siteId === site.id);
    const repos = [...new Set(products.flatMap((p) => p.repos || []))];
    const extIds = [...new Set(products.flatMap((p) => p.extensionIds || []))];
    return {
      key: site.id, sites: [site], repos, extIds,
      scopes: [`site:${site.id}`, ...repos.map((r) => `repo:${r}`), ...extIds.map((e) => `ext:${e}`)],
    };
  }

  /* --- per-site daily series --- */

  function demoSeries(site, from, to) {
    const today = localDay(now());
    const t = new Date(now());
    const elapsed = (t.getHours() * 60 + t.getMinutes()) / 1440;
    const ga = new Map();
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const v = demoDay(site.id, d);
      // Today is a partial day, like the real Data API.
      ga.set(d, d === today ? { ...v, sessions: Math.round(v.sessions * elapsed), users: Math.round(v.users * elapsed) } : v);
    }
    // Search Console lags: the last reported day is three days back.
    const last = addDays(today, -3);
    const values = new Map();
    for (let d = from; d <= to && d <= last; d = addDays(d, 1)) values.set(d, demoDay(site.id, d).clicks);
    return { ga, sc: { values, last } };
  }

  // { ga: Map date → {sessions, users, views} | null, sc: { values, last } | { error } | null }.
  async function siteSeries(site, from, to, { fresh = false } = {}) {
    if (site.demo) return demoSeries(site, from, to);
    return history.series(site, from, to, { force: fresh });
  }

  function demoAnnotations(sites, from, to) {
    const out = [];
    const today = localDay(now());
    if (to > today) to = today;
    for (const site of sites.filter((s) => s.demo)) {
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const e = demoEvent(site.id, d);
        if (e) out.push({ id: `demo-${site.id}-${d}`, date: d, label: e.label, kind: e.kind, source: 'demo', scope: `site:${site.id}` });
      }
    }
    return out;
  }

  async function eventsFor(sc, from, to) {
    const listed = await annotations.list({ from, to, scopes: sc.scopes });
    return [...listed, ...demoAnnotations(sc.sites, from, to)].sort((a, b) => a.date.localeCompare(b.date));
  }

  async function alertsFor(sc, from, to) {
    const repos = new Set(sc.repos || []);
    const exts = new Set(sc.extIds || []);
    const ids = new Set(sc.sites.map((s) => s.id));
    return ((await store.get()).alerts || [])
      .map((a) => ({ ...a, day: alertDay(a) }))
      .filter((a) => a.day >= from && a.day <= to)
      .filter((a) => sc.key === 'all' || (a.subject?.type === 'site' && ids.has(a.subject.id)) || (a.subject?.type === 'repo' && repos.has(a.subject.id)) || (a.subject?.type === 'extension' && exts.has(a.subject.id)));
  }

  /* --- month --- */

  async function month({ month: wanted = '', site = 'all', fresh = false } = {}) {
    const today = localDay(now());
    const m = MONTH.test(wanted) ? wanted : today.slice(0, 7);
    const days = monthDays(m);
    const sc = await scope(site);
    const from = addDays(days[0], -7 * WEEKS);
    const to = days.at(-1) < today ? days.at(-1) : today;
    const errors = [];

    const sessions = new Map();
    const users = new Map();
    const clicks = new Map();
    let searchLast = '';
    let hasSearch = false;
    let hasTraffic = false;
    if (days[0] <= today) {
      const results = await Promise.all(sc.sites.map(async (s) => {
        try {
          return { site: s, ...(await siteSeries(s, from, to, { fresh })) };
        } catch (err) {
          errors.push({ site: s.label, message: err.message, kind: err.kind || '' });
          return null;
        }
      }));
      for (const r of results.filter(Boolean)) {
        if (r.ga) {
          hasTraffic = true;
          for (const [d, v] of r.ga) {
            sessions.set(d, (sessions.get(d) || 0) + (v.sessions || 0));
            users.set(d, (users.get(d) || 0) + (v.users || 0));
          }
        }
        if (r.sc?.error) errors.push({ site: r.site.label, message: `Search Console: ${r.sc.error}`, kind: '' });
        else if (r.sc) {
          hasSearch = true;
          for (const [d, v] of r.sc.values) clicks.set(d, (clicks.get(d) || 0) + v);
          if (r.sc.last && (!searchLast || r.sc.last < searchLast)) searchLast = r.sc.last;
        }
      }
    }

    const [events, alerts] = await Promise.all([eventsFor(sc, days[0], days.at(-1)), alertsFor(sc, days[0], days.at(-1))]);
    const stars = githubDaily(githubDbPath(), { from: days[0], to: days.at(-1), repos: sc.repos });

    const rows = days.map((date) => {
      const future = date > today;
      const value = future || !hasTraffic ? null : sessions.get(date) || 0;
      const baseline = hasTraffic && !future ? weekdayBaseline(sessions, date, { start: from }) : null;
      const t = date === today ? { change: null, tone: 'none' } : dayTone(value, baseline);
      const click = hasSearch && !future && searchLast && date <= searchLast ? clicks.get(date) || 0 : null;
      const clickBase = click === null ? null : weekdayBaseline(clicks, date, { start: from });
      return {
        date,
        future,
        partial: date === today,
        sessions: value,
        users: future || !hasTraffic ? null : users.get(date) || 0,
        baseline: baseline === null ? null : Math.round(baseline),
        change: t.change,
        tone: t.tone,
        clicks: click,
        clicksBaseline: clickBase === null ? null : Math.round(clickBase),
        clicksTone: dayTone(click, clickBase).tone,
        events: events.filter((e) => e.date === date).map(({ id, label, kind, url, source }) => ({ id, label, kind, url, source })),
        alerts: alerts.filter((a) => a.day === date).map(({ id, title, direction, link }) => ({ id, title, direction, link })),
        stars: stars.get(date)?.stars || 0,
      };
    });

    const done = rows.filter((r) => r.sessions !== null && !r.partial);
    const ranked = done.filter((r) => r.change !== null && Number.isFinite(r.change) && r.tone !== 'flat');
    return {
      month: m,
      today,
      site: sc.key,
      sites: sc.sites.map((s) => ({ id: s.id, label: s.label, demo: Boolean(s.demo) })),
      hasTraffic,
      hasSearch,
      searchLast,
      days: rows,
      totals: {
        sessions: done.reduce((a, r) => a + r.sessions, 0),
        baseline: done.reduce((a, r) => a + (r.baseline || 0), 0),
        clicks: rows.some((r) => r.clicks !== null) ? rows.reduce((a, r) => a + (r.clicks || 0), 0) : null,
        events: rows.reduce((a, r) => a + r.events.length, 0),
        alerts: rows.reduce((a, r) => a + r.alerts.length, 0),
        stars: rows.reduce((a, r) => a + r.stars, 0),
        best: ranked.length ? ranked.reduce((a, b) => (b.change > a.change ? b : a)).date : null,
        worst: ranked.length ? ranked.reduce((a, b) => (b.change < a.change ? b : a)).date : null,
      },
      errors,
    };
  }

  /* --- one day --- */

  // Rows { date, key, value } per day; dim is 'source', 'page' or 'query' (clicks).
  async function dailyBreakdown(site, dim, from, to) {
    if (!site.demo) return history.breakdown(site, dim, from, to);
    const out = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const day = demoDay(site.id, d);
      const rows = dim === 'source' ? day.sources : dim === 'page' ? day.pages : day.queries.map((q) => ({ key: q.query, value: q.clicks }));
      out.push(...rows.map((r) => ({ date: d, key: r.key, value: r.value })));
    }
    return out;
  }

  // The day's mix vs the 28 days before it.
  async function breakdown(site, date, dim) {
    const rows = await dailyBreakdown(site, dim, addDays(date, -28), date);
    return { current: rows.filter((r) => r.date === date), previous: rows.filter((r) => r.date < date) };
  }

  async function topQueries(site, date) {
    const rows = await dailyBreakdown(site, 'query', date, date);
    return rows.sort((a, b) => b.value - a.value).slice(0, 5).map((r) => ({ query: r.key, clicks: r.value }));
  }

  // Reads the same span as the month view.
  async function siteDay(site, date, today, { detail }) {
    const days = monthDays(date.slice(0, 7));
    const from = addDays(days[0], -7 * WEEKS);
    const out = { id: site.id, label: site.label, sessions: null, baseline: null, sources: [], pages: [], search: null };
    try {
      const { ga, sc } = await siteSeries(site, from, days.at(-1) < today ? days.at(-1) : today);
      if (ga) {
        const series = new Map([...ga].map(([d, v]) => [d, v.sessions || 0]));
        out.sessions = series.get(date) || 0;
        out.users = ga.get(date)?.users || 0;
        out.baseline = weekdayBaseline(series, date, { start: from });
        out.trend = [...Array(29)].map((_, i) => addDays(date, i - 28)).map((d) => ({ date: d, sessions: series.get(d) || 0 }));
        if (detail && out.sessions + (out.baseline || 0) > 0) {
          const before = (rows) => rows.reduce((a, r) => a + r.value, 0);
          const [src, land] = await Promise.all([breakdown(site, date, 'source'), breakdown(site, date, 'page')]);
          const scale = (rows) => (before(rows) ? (out.baseline || 0) / before(rows) : 0);
          out.sources = shiftRows(src.current, src.previous, { key: (r) => sourceFamily(r.key), scale: scale(src.previous) });
          out.pages = shiftRows(land.current, land.previous, { scale: scale(land.previous) });
        }
      }
      if (sc?.error) out.search = { error: sc.error };
      else if (sc) {
        if (!sc.last || date > sc.last) out.search = { pending: true };
        else {
          const clicks = sc.values.get(date) || 0;
          out.search = { clicks, baseline: weekdayBaseline(sc.values, date, { start: from }), queries: clicks ? await topQueries(site, date) : [] };
        }
      }
    } catch (err) {
      out.error = err.message;
    }
    return out;
  }

  async function day({ date = '', site = 'all' } = {}) {
    if (!DATE.test(date) || Number.isNaN(Date.parse(date))) throw new ValidationError('Pick a date (YYYY-MM-DD).');
    const today = localDay(now());
    if (date > today) throw new ValidationError('That day hasn’t happened yet.');
    const sc = await scope(site);

    // A day not stored yet costs GA4 reports to break down, so only the biggest movers get one.
    const totals = await Promise.all(sc.sites.map((s) => siteDay(s, date, today, { detail: false })));
    const movers = new Set(totals
      .filter((t) => t.sessions !== null)
      .sort((a, b) => Math.abs(b.sessions - (b.baseline || 0)) - Math.abs(a.sessions - (a.baseline || 0)))
      .slice(0, 3).map((t) => t.id));
    const sites = await Promise.all(sc.sites.map((s, i) => (movers.has(s.id) ? siteDay(s, date, today, { detail: true }) : totals[i])));

    const withTraffic = sites.filter((s) => s.sessions !== null);
    const sessions = withTraffic.length ? withTraffic.reduce((a, s) => a + s.sessions, 0) : null;
    const baseline = withTraffic.some((s) => s.baseline !== null) ? withTraffic.reduce((a, s) => a + (s.baseline || 0), 0) : null;
    const trend = withTraffic.length
      ? withTraffic[0].trend.map((p, i) => ({ date: p.date, sessions: withTraffic.reduce((a, s) => a + (s.trend?.[i]?.sessions || 0), 0) }))
      : [];

    const prev = addDays(date, -1);
    const [allEvents, alerts] = await Promise.all([eventsFor(sc, prev, date), alertsFor(sc, date, date)]);
    const events = allEvents.filter((e) => e.date === date);
    const eventsBefore = allEvents.filter((e) => e.date === prev);
    const gh = githubDaily(githubDbPath(), { from: date, to: date, repos: sc.repos }).get(date) || null;
    const exts = [];
    for (const ext of extensions ? await extensions.list() : []) {
      if (sc.extIds && !sc.extIds.includes(ext.id)) continue;
      const history = ext.history || [];
      const i = history.findIndex((p) => p.date === date);
      if (i < 0) continue;
      const before = history[i - 1]?.users;
      exts.push({ id: ext.id, label: ext.title || ext.label || ext.id, users: history[i].users ?? null, delta: typeof before === 'number' && typeof history[i].users === 'number' ? history[i].users - before : 0 });
    }

    const story = composeStory({ date, today, sessions, baseline, sites, events, eventsBefore, alerts, github: gh, extensions: exts });
    return {
      date,
      weekday: weekdayName(date),
      partial: date === today,
      sessions,
      baseline: baseline === null ? null : Math.round(baseline),
      ...story,
      trend,
      sites: sites.map((s) => ({ ...s, baseline: s.baseline === null ? null : Math.round(s.baseline), sources: s.sources.slice(0, 6), losers: s.sources.filter((r) => r.gain < 0).slice(-3).reverse(), pages: s.pages.slice(0, 6), trend: undefined })),
      events,
      eventsBefore,
      alerts: alerts.map(({ id, title, detail, direction, link }) => ({ id, title, detail, direction, link })),
      github: gh,
      extensions: exts,
    };
  }

  /* --- ranges (for the MCP server and anything else that wants raw days) --- */

  function span(from, to) {
    const today = localDay(now());
    const ok = (d) => DATE.test(d) && !Number.isNaN(Date.parse(d));
    if (!ok(from) || !ok(to)) throw new ValidationError('Pass from and to as YYYY-MM-DD.');
    if (from > to) throw new ValidationError('from must be on or before to.');
    const end = to < today ? to : today;
    if (from > end) throw new ValidationError('That range hasn’t happened yet.');
    if ((Date.parse(end) - Date.parse(from)) / DAY_MS + 1 > MAX_SPAN_DAYS) throw new ValidationError(`Ask for at most ${MAX_SPAN_DAYS} days at a time.`);
    return { from, to: end, days: (Date.parse(end) - Date.parse(from)) / DAY_MS + 1 };
  }

  // Per day: sessions, users, views, search clicks and the weekday baseline.
  async function metrics({ from = '', to = '', site = 'all' } = {}) {
    const r = span(from, to);
    const sc = await scope(site);
    const lookback = addDays(r.from, -7 * WEEKS);
    const sums = { sessions: new Map(), users: new Map(), views: new Map(), clicks: new Map() };
    const add = (map, d, v) => map.set(d, (map.get(d) || 0) + (v || 0));
    const errors = [];
    let hasTraffic = false;
    let hasSearch = false;
    let searchLast = '';
    for (const s of sc.sites) {
      try {
        const { ga, sc: search } = await siteSeries(s, lookback, r.to);
        if (ga) {
          hasTraffic = true;
          for (const [d, v] of ga) {
            add(sums.sessions, d, v.sessions);
            add(sums.users, d, v.users);
            add(sums.views, d, v.views);
          }
        }
        if (search?.error) errors.push({ site: s.label, message: `Search Console: ${search.error}` });
        else if (search) {
          hasSearch = true;
          for (const [d, v] of search.values) add(sums.clicks, d, v);
          if (search.last && (!searchLast || search.last < searchLast)) searchLast = search.last;
        }
      } catch (err) {
        errors.push({ site: s.label, message: err.message });
      }
    }
    const days = [];
    for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
      const baseline = hasTraffic ? weekdayBaseline(sums.sessions, d, { start: lookback }) : null;
      const sessions = hasTraffic ? sums.sessions.get(d) || 0 : null;
      const t = dayTone(sessions, baseline);
      days.push({
        date: d,
        weekday: weekdayName(d),
        sessions,
        users: hasTraffic ? sums.users.get(d) || 0 : null,
        views: hasTraffic ? sums.views.get(d) || 0 : null,
        baseline: baseline === null ? null : Math.round(baseline),
        change: t.change === null || !Number.isFinite(t.change) ? null : Math.round(t.change * 1000) / 1000,
        clicks: hasSearch && searchLast && d <= searchLast ? sums.clicks.get(d) || 0 : null,
      });
    }
    return {
      from: r.from, to: r.to, site: sc.key,
      sites: sc.sites.map((s) => ({ id: s.id, label: s.label })),
      searchLast: searchLast || null,
      totals: {
        sessions: hasTraffic ? days.reduce((a, x) => a + x.sessions, 0) : null,
        views: hasTraffic ? days.reduce((a, x) => a + x.views, 0) : null,
        clicks: days.some((x) => x.clicks !== null) ? days.reduce((a, x) => a + (x.clicks || 0), 0) : null,
      },
      days,
      errors,
    };
  }

  // Totals per source family, landing page or search query over [from, to],
  // against the window of the same length just before it.
  // `back`: how many days earlier the "previous" window starts (default: the
  // span just before). One day is set against the same weekday with back = 7.
  async function rangeBreakdown({ from = '', to = '', site = 'all', by = 'source', limit = 25, back = 0 } = {}) {
    if (!['source', 'page', 'query'].includes(by)) throw new ValidationError('by must be source, page or query.');
    const r = span(from, to);
    const sc = await scope(site);
    const shift = Math.max(r.days, Math.min(366, Number(back) || 0));
    const prevFrom = addDays(r.from, -shift);
    const prevTo = addDays(r.to, -shift);
    const multi = sc.sites.length > 1;
    const cur = new Map();
    const prev = new Map();
    const errors = [];
    for (const s of sc.sites) {
      if (!s.demo && (by === 'query' ? !s.searchSite : !s.propertyId)) continue;
      try {
        for (const row of await dailyBreakdown(s, by, prevFrom, r.to)) {
          const base = by === 'source' ? sourceFamily(row.key) : row.key;
          const key = multi && by === 'page' ? `${s.label} ${base}` : base;
          const map = row.date >= r.from ? cur : row.date <= prevTo ? prev : null;
          if (!map) continue;
          map.set(key, (map.get(key) || 0) + row.value);
        }
      } catch (err) {
        errors.push({ site: s.label, message: err.message });
      }
    }
    const total = [...cur.values()].reduce((a, b) => a + b, 0);
    const rows = [...new Set([...cur.keys(), ...prev.keys()])]
      .map((key) => {
        const value = cur.get(key) || 0;
        const before = prev.get(key) || 0;
        return { key, value, previous: before, change: before ? Math.round(((value - before) / before) * 1000) / 1000 : null, share: total ? Math.round((value / total) * 1000) / 1000 : 0 };
      })
      .sort((a, b) => b.value - a.value || b.previous - a.previous)
      .slice(0, Math.min(200, Math.max(1, Number(limit) || 25)));
    return {
      from: r.from, to: r.to, previous: { from: prevFrom, to: addDays(r.from, -1) }, site: sc.key, by,
      metric: by === 'query' ? 'clicks' : 'sessions',
      note: 'Stored per day as the top 100 rows, so long-tail totals are slightly low.',
      rows,
      errors,
    };
  }

  async function rangeEvents({ from = '', to = '', site = 'all' } = {}) {
    const r = span(from, to);
    const sc = await scope(site);
    const [events, alerts] = await Promise.all([eventsFor(sc, r.from, r.to), alertsFor(sc, r.from, r.to)]);
    return {
      from: r.from, to: r.to, site: sc.key,
      events: events.map(({ id, date, label, kind, source, url, scope: sc2 }) => ({ id, date, label, kind, source, url, scope: sc2 })),
      alerts: alerts.map(({ id, day, title, detail, rule, direction, link }) => ({ id, date: day, title, detail, rule, direction, link })),
    };
  }

  return { month, day, metrics, breakdown: rangeBreakdown, events: rangeEvents };
}

export function calendarRoutes({ calendar, history }) {
  const range = (query) => ({ from: query.get('from') || '', to: query.get('to') || '', site: query.get('site') || 'all' });
  return [
    ['GET', /^\/api\/calendar\/metrics$/, async ({ query }) => calendar.metrics(range(query))],
    ['GET', /^\/api\/calendar\/breakdown$/, async ({ query }) => calendar.breakdown({ ...range(query), by: query.get('by') || 'source', limit: Number(query.get('limit')) || 25, back: Number(query.get('back')) || 0 })],
    ['GET', /^\/api\/calendar\/events$/, async ({ query }) => calendar.events(range(query))],
    ['GET', /^\/api\/calendar\/status$/, async () => history.status()],
    ['POST', /^\/api\/calendar\/sync$/, async () => ({ sites: await history.syncAll() })],
    ['GET', /^\/api\/calendar$/, async ({ query }) => calendar.month({ month: query.get('month') || '', site: query.get('site') || 'all', fresh: query.has('fresh') })],
    ['GET', /^\/api\/calendar\/day$/, async ({ query }) => calendar.day({ date: query.get('date') || '', site: query.get('site') || 'all' })],
  ];
}
