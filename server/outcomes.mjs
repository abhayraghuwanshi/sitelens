// Outcomes: what the traffic actually produced, and what to do about it.
// The journey says whether each stage is healthy; this joins the stages into
// one funnel (site visitors → download intent → completions, plus store
// listing → installs) and turns the joins into ranked, evidence-backed
// insights. Goal events are detected from the event names the site already
// sends, so nothing needs configuring and GA4 "key events" aren't required.

import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';
import { baseDomain } from '../shared/sitelens/site.js';
import { listingAnalytics } from './cws-ga.mjs';
import { historyRange, SourceError } from './github.mjs';
import { sourceFamily, pctChange, formatPct } from './journey.mjs';
import { createCache } from './cache.mjs';

const DAY = 86_400_000;
const TTL = 15 * 60_000;
const n = (v) => Number(v) || 0;
const sum = (list) => list.reduce((a, b) => a + (b || 0), 0);
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date, d) => isoDay(Date.parse(`${date}T00:00:00Z`) + d * DAY);
const isoFromGa = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
const pct = (v) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)}%`;
const fmt = (v) => Math.round(v).toLocaleString('en-US');
const plural = (count, word) => `${fmt(count)} ${word}${count === 1 ? '' : 's'}`;
// "Traffic up" → "traffic up", but "GA4 counts" stays.
const lowerFirst = (text) => (/^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text);
// "Store installs" → "store installs", but "GitHub stars" and "GA4" keep their case.
export const lowerWord = (text) => (/^[A-Z][a-z]+\b/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text);
const shortDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// ---------- goal detection ----------

// Events that finish the job (a download started, an install, a sign-up) vs
// clicks that only show intent. Views of a section are context, not goals.
const COMPLETION = /^(file_download|install|sign_?up|purchase|subscribe|generate_lead|begin_checkout|download_complete)$/;
const INTENT = /(download|install|sign_?up|subscribe|get_started|add_to_chrome|cta|checkout|purchase|trial)/;
const NOT_GOAL = /(_view|_impression|_scroll|_preview|_hover)$|^(page_view|session_start|first_visit|user_engagement|scroll|click)$/;
const SECTION = /download.*_view$|_view.*download/;

export function classifyEvents(events = []) {
  const completions = [];
  const intents = [];
  let section = null;
  for (const e of events) {
    const name = String(e.name || '');
    if (COMPLETION.test(name)) completions.push(e);
    else if (!NOT_GOAL.test(name) && INTENT.test(name)) intents.push(e);
    else if (!section && SECTION.test(name)) section = e;
  }
  const byUsers = (a, b) => b.users - a.users;
  return { completions: completions.sort(byUsers), intents: intents.sort(byUsers), section };
}

// What Studio guesses when a product has no goals of its own: the downloads
// section and the top click as steps, store installs and release downloads as
// outcomes. A site download event is a step when release downloads are already
// counted, so the same download isn't an outcome twice.
export function autoGoals(classified, { hasStore = false, hasRepos = false } = {}) {
  const goals = [];
  const event = (e, label, role) => goals.push({ id: `auto-${e.name}`, label, source: 'event', match: e.name, role });
  if (classified.section) event(classified.section, 'Saw the downloads section', 'step');
  if (classified.intents[0]) event(classified.intents[0], 'Clicked to download or install', 'step');
  const done = classified.completions[0];
  if (done) event(done, done.name === 'file_download' ? 'Started a download' : humanize(done.name), hasRepos ? 'step' : 'outcome');
  if (hasStore) goals.push({ id: 'auto-installs', label: 'Store installs', source: 'installs', role: 'outcome' });
  if (hasRepos) goals.push({ id: 'auto-downloads', label: 'Desktop downloads', source: 'downloads', role: 'outcome' });
  return goals;
}

const humanize = (name) => name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// A page goal or an event named like a view is "reaching" something; an
// outcome is "finishing"; anything else is a click.
export function stepKind(goal) {
  if (goal.source === 'page' || /_view$|view_/.test(goal.match || '')) return 'view';
  return goal.role === 'outcome' ? 'complete' : 'click';
}

// ---------- funnel ----------

// Site visitors, then each site-measured goal in order (steps before
// outcomes). A step's users come from its single best event, since users
// can't be summed across events without double counting.
export function buildFunnel({ visitors, goals = [], listingFromSite = null, installsFromSite = null }) {
  const site = goals.filter((g) => g.source === 'event' || g.source === 'page');
  const ordered = [...site.filter((g) => g.role === 'step'), ...site.filter((g) => g.role !== 'step')];
  const steps = [{ key: 'visitors', label: 'Site visitors', users: visitors, kind: 'visit' }];
  for (const g of ordered) steps.push({ key: g.id, label: g.label, users: g.count || 0, event: g.match, kind: stepKind(g) });
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].users;
    steps[i].rate = prev ? steps[i].users / prev : null;
  }
  const store = listingFromSite === null ? null : {
    visitors: listingFromSite,
    installs: installsFromSite,
    rate: visitors ? listingFromSite / visitors : null,
  };
  // The biggest relative drop between consecutive steps is where to work first.
  let leak = null;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].rate === null || steps[i - 1].users < 20) continue;
    if (!leak || steps[i].rate < leak.rate) leak = { from: steps[i - 1], to: steps[i], rate: steps[i].rate };
  }
  return { steps, store, leak };
}

// ---------- tables ----------

// Rows of { key, event, users } (dims × eventName) → one row per key with
// visitors (session_start users) and goal users (best goal event).
export function goalRates(rows, goalNames, { min = 0 } = {}) {
  const goals = new Set(goalNames);
  const by = new Map();
  for (const r of rows) {
    const row = by.get(r.key) || { key: r.key, visitors: 0, goalUsers: 0 };
    if (r.event === 'session_start') row.visitors = Math.max(row.visitors, r.users);
    else if (goals.has(r.event)) row.goalUsers = Math.max(row.goalUsers, r.users);
    by.set(r.key, row);
  }
  return [...by.values()]
    .filter((r) => r.visitors >= min || r.goalUsers > 0)
    .map((r) => ({ ...r, rate: r.visitors ? Math.min(1, r.goalUsers / r.visitors) : null }))
    .sort((a, b) => b.visitors - a.visitors);
}

// Same rows grouped by referrer family (google, google.com → Google).
export function byFamily(rows) {
  const out = new Map();
  for (const r of rows) {
    const f = sourceFamily(r.key);
    const row = out.get(f) || { key: f, visitors: 0, goalUsers: 0 };
    row.visitors += r.visitors;
    row.goalUsers += r.goalUsers;
    out.set(f, row);
  }
  return [...out.values()]
    .map((r) => ({ ...r, rate: r.visitors ? Math.min(1, r.goalUsers / r.visitors) : null }))
    .sort((a, b) => b.visitors - a.visitors);
}

// Store listing sources by family, with conversion.
export function listingFamilies(sources = []) {
  const out = new Map();
  for (const s of sources) {
    const f = sourceFamily(s.source);
    const row = out.get(f) || { key: f, visitors: 0, installs: 0, installers: 0 };
    row.visitors += s.visitors;
    row.installs += s.installs;
    row.installers += s.installers;
    out.set(f, row);
  }
  return [...out.values()]
    .map((r) => ({ ...r, rate: r.visitors ? Math.min(1, r.installers / r.visitors) : null }))
    .sort((a, b) => b.installs - a.installs || b.visitors - a.visitors);
}

// ---------- insights (pure) ----------

// Each rule returns null or { key, tone, title, detail, action, impact }.
// impact (0-100) orders the list: how much acting on it could move outcomes.
export const RULES = {
  // GA4 reports 0 conversions while the site sends perfectly good goal events.
  untracked({ keyEvents, eventGoals = [], site }) {
    const named = eventGoals.slice(0, 3);
    if (keyEvents > 0 || !named.length) return null;
    return {
      key: 'untracked',
      tone: 'bad',
      title: 'GA4 counts 0 conversions',
      detail: `Your site already sends ${named.map((x) => `“${x}”`).join(', ')}, but none is marked as a key event, so GA4’s reports, Google Ads and Search Console can’t credit any channel with an outcome.`,
      action: `GA4 Admin → Data display → Events → star ${named.slice(0, 2).join(' and ')} as key events.`,
      link: site?.propertyId ? `https://analytics.google.com/analytics/web/#/a/p${site.propertyId}/admin/events/overview` : '',
      impact: 90,
    };
  },

  // Site visitors who reached the store listing.
  siteToStore({ funnel, siteHost }) {
    const s = funnel.store;
    if (!s || funnel.steps[0].users < 100) return null;
    if (s.rate >= 0.05) {
      return { key: 'site-to-store', tone: 'good', title: `${pct(s.rate)} of site visitors reach the store`, detail: `${fmt(s.visitors)} listing visitors came from ${siteHost}, with ${plural(s.installs, 'install')}.`, impact: 20 };
    }
    return {
      key: 'site-to-store',
      tone: 'warn',
      title: `Only ${pct(s.rate)} of site visitors reach the Web Store`,
      detail: `${fmt(funnel.steps[0].users)} people visited ${siteHost}, but the listing saw just ${fmt(s.visitors)} visitors referred by it${s.installs ? ` (${plural(s.installs, 'install')})` : ''}. Visitors who do arrive install at the normal rate, so the leak is on the site.`,
      action: 'Put an “Add to Chrome” button above the fold on the pages people land on (home and the top blog posts), linking straight to the listing.',
      impact: 80,
    };
  },

  // The weakest step of the on-site funnel.
  leak({ funnel }) {
    const l = funnel.leak;
    if (!l || l.rate >= 0.5) return null;
    return {
      key: 'leak',
      tone: 'warn',
      title: `Biggest drop: ${l.from.label.toLowerCase()} → ${l.to.label.toLowerCase()} (${pct(l.rate)})`,
      detail: `${fmt(l.from.users)} users ${l.from.kind === 'visit' ? 'visited' : `got to “${l.from.label}”`}, ${fmt(l.to.users)} went on to “${l.to.label}”${l.to.event ? ` (${l.to.event})` : ''}.`,
      action: l.to.kind === 'view'
        ? `Most visitors never get to “${l.to.label}”. Link to it from the top of the pages people land on, and again at the end of each.`
        : l.to.kind === 'click'
          ? `People reach “${l.from.label}” but don’t act. Make that button the obvious next step: one default choice, plain wording, what they get.`
          : `“${l.from.label}” doesn’t turn into “${l.to.label}”. Go through it yourself on each device and check nothing breaks or asks too much.`,
      impact: 70,
    };
  },

  // Did outcomes grow faster than traffic? That's conversion improving.
  efficiency({ outcomes, sessions, days }) {
    if (!sessions || sessions.previous <= 0 || outcomes.previous <= 0 || outcomes.value + outcomes.previous < 10) return null;
    const traffic = pctChange(sessions.value, sessions.previous);
    const result = pctChange(outcomes.value, outcomes.previous);
    const rateNow = outcomes.value / sessions.value;
    const rateBefore = outcomes.previous / sessions.previous;
    const better = rateNow > rateBefore * 1.15;
    const noun = !outcomes.basis || outcomes.basis === 'all' ? 'Outcomes' : outcomes.basis.charAt(0).toUpperCase() + outcomes.basis.slice(1);
    const worse = rateNow < rateBefore * 0.85;
    return {
      key: 'efficiency',
      tone: better ? 'good' : worse ? 'warn' : 'info',
      title: better ? `${noun} ${formatPct(result)} while traffic ${formatPct(traffic)}` : worse ? `Traffic ${formatPct(traffic)} but ${noun.toLowerCase()} only ${formatPct(result)}` : `${noun} are keeping pace with traffic`,
      detail: `${fmt(outcomes.value)} ${outcomes.basis && outcomes.basis !== 'all' ? lowerWord(outcomes.basis) : 'outcomes'} in ${days} days vs ${fmt(outcomes.previous)} before: ${(rateNow * 100).toFixed(1)} per 100 site sessions (was ${(rateBefore * 100).toFixed(1)}).`,
      action: worse ? 'The new traffic is less qualified. Check which source grew (Traffic stage) and whether it converts below.' : '',
      impact: better ? 30 : worse ? 60 : 10,
    };
  },

  // The channel that converts best vs the one that brings the most.
  bestChannel({ listing }) {
    const real = listing.filter((r) => r.key !== 'Direct' && r.key !== 'Unknown' && r.visitors >= 5);
    if (real.length < 2) return null;
    const total = { visitors: sum(listing.map((r) => r.visitors)), installers: sum(listing.map((r) => r.installers)) };
    const avg = total.visitors ? total.installers / total.visitors : 0;
    const best = [...real].sort((a, b) => b.rate - a.rate)[0];
    const biggest = [...real].sort((a, b) => b.visitors - a.visitors)[0];
    if (best.rate < avg * 1.3) return null;
    const same = best.key === biggest.key;
    return {
      key: 'best-channel',
      tone: 'good',
      title: `${best.key} visitors install at ${pct(best.rate)}${same ? '' : `, ${biggest.key} at ${pct(biggest.rate)}`}`,
      detail: `Store listing average is ${pct(avg)}. ${best.key} sent ${plural(best.visitors, 'visitor')} → ${plural(best.installs, 'install')}${same ? '' : `; ${biggest.key} sent the most (${fmt(biggest.visitors)}) → ${plural(biggest.installs, 'install')}`}.`,
      action: best.key === 'Google' || best.key === 'Bing'
        ? 'Search visitors already want this. Write more “X alternative” and comparison pages for the queries in Search demand.'
        : `Do more of what worked on ${best.key}.`,
      impact: 50,
    };
  },

  // Site channels with real volume that never produce a goal event.
  deadChannel({ channels, engagement }) {
    // Under 2%: a channel this size producing a download or two is noise, not a source.
    const dead = channels.filter((c) => c.visitors >= 40 && c.rate !== null && c.rate < 0.02 && c.key !== 'Unknown');
    if (!dead.length) return null;
    const top = dead[0];
    const eng = engagement.get(top.key);
    const botty = eng !== undefined && eng < 0.25;
    const share = sum(channels.map((c) => c.visitors));
    return {
      key: 'dead-channel',
      tone: 'warn',
      title: `${top.key}: ${pct(top.visitors / share)} of visitors, ${top.goalUsers ? `only ${fmt(top.goalUsers)}` : 'no'} conversion${top.goalUsers === 1 ? '' : 's'}`,
      detail: `${botty ? `Only ${pct(eng)} of these sessions engaged, which usually means bots or prefetches rather than people. ` : ''}${dead.length > 1 ? `Also no outcomes from ${dead.slice(1, 4).map((d) => d.key).join(', ')}.` : ''}`.trim() || 'None of these visitors reached a goal.',
      action: botty ? 'Treat this traffic as noise when judging growth; it inflates sessions without outcomes.' : `Check what ${top.key} visitors land on and whether the next step is obvious there.`,
      impact: botty ? 35 : 45,
    };
  },

  // Landing pages: which ones turn visitors into downloads.
  landing({ pages }) {
    const real = pages.filter((p) => p.visitors >= 20 && p.key !== '(not set)');
    if (real.length < 2) return null;
    const best = [...real].sort((a, b) => b.rate - a.rate)[0];
    const worst = [...real].sort((a, b) => a.rate - b.rate)[0];
    if (best.key === worst.key || best.rate - worst.rate < 0.03) return null;
    return {
      key: 'landing',
      tone: 'info',
      title: `${best.key} converts ${worst.rate ? `${(best.rate / worst.rate).toFixed(1)}×` : 'far'} better than ${worst.key}`,
      detail: `${best.key}: ${pct(best.rate)} of ${fmt(best.visitors)} visitors converted. ${worst.key}: ${pct(worst.rate)} of ${fmt(worst.visitors)}.`,
      action: `Copy what works on ${best.key} (its call to action and placement) onto ${worst.key}.`,
      impact: 55,
    };
  },

  // Countries with lots of visitors who never engage or convert.
  junkCountries({ countries }) {
    const junk = countries.filter((c) => c.visitors >= 30 && c.rate < 0.02 && c.engagement !== null && c.engagement < 0.3);
    if (!junk.length) return null;
    const total = sum(junk.map((c) => c.visitors));
    return {
      key: 'junk-countries',
      tone: 'info',
      title: `${plural(total, 'visitor')} from ${junk.map((c) => c.key).join(' and ')} look automated`,
      detail: `${junk.map((c) => `${c.key}: ${fmt(c.visitors)} visitors, ${pct(c.engagement)} engaged, ${plural(c.goalUsers, 'conversion')}`).join('; ')}.`,
      action: 'Exclude them when you read traffic growth; real growth is the rest.',
      impact: 25,
    };
  },

  // The biggest traffic day: did it convert?
  spike({ dates, sessionSeries: sessions, dailyOutcomes: outcomes }) {
    if (!sessions?.length || !outcomes?.length) return null;
    const sorted = [...sessions].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const peak = Math.max(...sessions);
    if (median <= 0 || peak < median * 2.5 || peak < 30) return null;
    const i = sessions.indexOf(peak);
    const window = (list, a, b) => sum(list.slice(Math.max(0, a), b));
    // A spike's outcomes can trail by a day.
    const got = window(outcomes, i, i + 2);
    const typical = sum(outcomes) / outcomes.length * 2;
    const converted = got > typical * 1.5;
    return {
      key: 'spike',
      tone: converted ? 'good' : 'warn',
      title: converted ? `The ${shortDate(dates[i])} spike converted` : `The ${shortDate(dates[i])} spike didn’t convert`,
      detail: `${fmt(peak)} sessions (typical ${fmt(median)}) and ${plural(got, 'outcome')} that day and the next (typical ${typical.toFixed(1)}).`,
      action: converted ? 'Find what caused it (click the day on the Product page) and repeat it.' : 'The extra visitors left without converting. Check where they landed; that page needs a clearer next step.',
      day: dates[i],
      impact: converted ? 30 : 40,
    };
  },
};

export function insights(input) {
  return Object.values(RULES)
    .map((rule) => {
      try {
        return rule(input);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.impact - a.impact);
}

// One sentence for the top of the page.
export function headline({ label, days, outcomes, trend = outcomes, parts = [], funnel, list }) {
  const lead = `${label}, last ${days} days: ${plural(outcomes.value, 'outcome')}${parts.length > 1 ? ` (${parts.join(', ')})` : parts.length ? ` (${parts[0]})` : ''}`;
  const bits = [lead];
  const change = pctChange(trend.value, trend.previous);
  if (change !== null) bits[0] += `, ${trend.basis && trend.basis !== 'all' ? `${lowerWord(trend.basis)} ` : ''}${formatPct(change)}`;
  const visitors = funnel.steps[0]?.users;
  if (visitors) bits.push(`${(outcomes.value / visitors * 100).toFixed(1)} per 100 site visitors`);
  const first = list.find((i) => i.tone === 'bad' || i.tone === 'warn');
  return `${bits.join(', ')}.${first ? ` Fix first: ${lowerFirst(first.title)}.` : ''}`;
}

// Goals measured → outcome total, a like-for-like trend and the per-goal parts.
// Sources with nothing before this period usually have no history yet (GitHub
// download counts start at the first sync), so the trend skips them.
export function rollup(measured) {
  const outs = measured.filter((g) => g.role === 'outcome');
  const value = sum(outs.map((g) => g.count));
  // A goal with nothing now and no history (no stars this month) doesn't break the comparison.
  const active = outs.filter((g) => g.count > 0 || n(g.previous) > 0);
  const comparable = active.filter((g) => n(g.previous) > 0);
  const whole = comparable.length === active.length;
  const trend = {
    value: sum(comparable.map((g) => g.count)),
    previous: sum(comparable.map((g) => g.previous)),
    basis: whole ? 'all' : comparable.map((g) => g.label).join(' + ') || 'none',
  };
  const revenue = sum(measured.map((g) => g.revenue || 0));
  return { outcomes: { value, previous: whole ? trend.previous : null }, trend, revenue, parts: active.map((g) => `${fmt(g.count)} ${lowerWord(g.label)}`) };
}

// ---------- the service ----------

export function createOutcomes({ store, products, auth, listingProperty, siteConfig = null, now = Date.now }) {
  const cache = createCache();

  async function report(site, body) {
    const filter = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
    const dimensionFilter = body.dimensionFilter ? { andGroup: { expressions: [filter, body.dimensionFilter] } } : filter;
    const res = await runReport({ token: await auth.token(), propertyId: site.propertyId, body: { ...body, dimensionFilter } });
    return res.rows;
  }

  const eventIn = (names) => ({ filter: { fieldName: 'eventName', inListFilter: { values: names } } });
  const pageIs = (path) => ({ filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: path } } });
  const periods = (range) => {
    const prevEnd = addDays(range.start, -1);
    return { cur: [{ startDate: range.start, endDate: range.end }], prev: [{ startDate: addDays(prevEnd, -(range.days - 1)), endDate: prevEnd }] };
  };

  // Every event the site sends, this period and the one before, with any GA4 `value` summed.
  async function siteEvents(site, range) {
    const { cur, prev } = periods(range);
    const body = (dateRanges) => ({ dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }, { name: 'eventValue' }], limit: 250 });
    const [events, prevEvents, totals] = await Promise.all([
      report(site, body(cur)),
      report(site, body(prev)),
      report(site, { dateRanges: cur, metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'keyEvents' }] }),
    ]);
    const toEvents = (rows) => rows.map((r) => ({ name: r.eventName, events: n(r.eventCount), users: n(r.totalUsers), value: n(r.eventValue) }))
      .sort((a, b) => b.users - a.users);
    const t = totals[0] || {};
    return { events: toEvents(events), previous: toEvents(prevEvents), visitors: n(t.totalUsers), sessions: n(t.sessions), keyEvents: n(t.keyEvents) };
  }

  async function pageGoal(site, range, path) {
    const { cur, prev } = periods(range);
    const body = (dateRanges) => ({ dateRanges, metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }], dimensionFilter: pageIs(path) });
    const [a, b] = await Promise.all([report(site, body(cur)), report(site, body(prev))]);
    return { count: n(a[0]?.totalUsers), events: n(a[0]?.screenPageViews), previous: n(b[0]?.totalUsers) };
  }

  // Channel, landing page, country and daily splits for the goal events.
  async function siteSplits(site, range, rateNames, dailyNames) {
    const { cur } = periods(range);
    const names = ['session_start', ...rateNames];
    const split = async (dim) => (await report(site, { dateRanges: cur, dimensions: [{ name: dim }, { name: 'eventName' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: eventIn(names), limit: 2000 }))
      .map((r) => ({ key: r[dim], event: r.eventName, users: n(r.totalUsers) }));
    const [sources, pages, countries, countryEng, sourceEng, daily] = await Promise.all([
      rateNames.length ? split('sessionSource') : [],
      rateNames.length ? split('landingPage') : [],
      rateNames.length ? split('country') : [],
      report(site, { dateRanges: cur, dimensions: [{ name: 'country' }], metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 100 }),
      report(site, { dateRanges: cur, dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }], limit: 100 }),
      dailyNames.length ? report(site, { dateRanges: cur, dimensions: [{ name: 'date' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: eventIn(dailyNames), limit: 400 }) : [],
    ]);
    const engagement = new Map();
    for (const r of sourceEng) {
      const f = sourceFamily(r.sessionSource);
      const e = engagement.get(f) || { s: 0, e: 0 };
      e.s += n(r.sessions);
      e.e += n(r.engagedSessions);
      engagement.set(f, e);
    }
    const countryRate = new Map(countryEng.filter((r) => n(r.sessions)).map((r) => [r.country, n(r.engagedSessions) / n(r.sessions)]));
    const dayMap = new Map(daily.map((r) => [isoFromGa(r.date), n(r.totalUsers)]));
    return {
      sources: goalRates(sources, rateNames),
      pages: goalRates(pages, rateNames, { min: 5 }),
      countries: goalRates(countries, rateNames, { min: 5 }).map((c) => ({ ...c, engagement: countryRate.has(c.key) ? countryRate.get(c.key) : null })),
      daily: range.dates.map((d) => dayMap.get(d) || 0),
      engagement: new Map([...engagement].map(([k, v]) => [k, v.s ? v.e / v.s : 0])),
    };
  }

  async function build(id, rangeKey) {
    const product = (await products.list()).find((p) => p.id === id);
    if (!product) throw new SourceError('Unknown product.', { kind: 'notfound' });
    const range = historyRange(rangeKey, now());
    const site = product.siteId ? (await store.sites()).find((s) => s.id === product.siteId) || null : null;
    const live = site && !site.demo && site.propertyId;
    const errors = {};
    const safely = async (key, fn) => {
      try {
        return await fn();
      } catch (err) {
        errors[key] = err.message;
        return null;
      }
    };

    const [view, siteBase, listings] = await Promise.all([
      safely('product', () => products.get(id, rangeKey)),
      live ? safely('site', () => siteEvents(site, range)) : null,
      Promise.all(product.extensionIds.map((ext) => safely(`listing:${ext}`, async () => listingAnalytics({ token: await auth.token(), propertyId: await listingProperty(ext), range })))),
    ]);

    // The site's .sitelens.yml, else the product's own goals, else Studio's guess
    // from event names and linked sources.
    const fileGoals = (await siteConfig?.applied(site))?.goals || null;
    const goalsFrom = fileGoals?.length ? 'file' : product.goals?.length ? 'settings' : 'auto';
    const custom = goalsFrom !== 'auto';
    const goals = goalsFrom === 'file' ? fileGoals : custom ? product.goals : autoGoals(classifyEvents(siteBase?.events || []), { hasStore: product.extensionIds.length > 0, hasRepos: product.repos.length > 0 });

    const kpis = Object.fromEntries((view?.kpis || []).map((k) => [k.key, k]));
    const series = view?.series || {};
    const eventBy = new Map((siteBase?.events || []).map((e) => [e.name, e]));
    const prevBy = new Map((siteBase?.previous || []).map((e) => [e.name, e]));
    const pages = await Promise.all(goals.map((g) => (g.source === 'page' && live ? safely(`page:${g.match}`, () => pageGoal(site, range, g.match)) : null)));
    const known = (list) => list?.filter((v) => v !== null && v !== undefined) || [];

    const measured = goals.map((g, i) => {
      let m = { count: 0, previous: null, events: null, unavailable: '' };
      if (g.source === 'event') {
        const e = eventBy.get(g.match);
        m = siteBase ? { count: e?.users || 0, events: e?.events || 0, previous: prevBy.get(g.match)?.users || 0, eventValue: e?.value || 0 } : { ...m, unavailable: 'needs the GA4 site' };
        if (siteBase && !e) m.unavailable = 'not sent in this period';
      } else if (g.source === 'page') {
        m = pages[i] || { ...m, unavailable: live ? 'couldn’t read GA4' : 'needs the GA4 site' };
      } else if (g.source === 'installs') {
        m = kpis.installs ? { count: n(kpis.installs.value), previous: n(kpis.installs.previous) } : { ...m, unavailable: 'no store listing linked' };
      } else if (g.source === 'downloads') {
        m = kpis.downloads ? { count: n(kpis.downloads.value), previous: n(kpis.downloads.previous) || null } : { ...m, unavailable: 'no repo linked' };
      } else if (g.source === 'stars') {
        const s = known(series.stars);
        m = s.length ? { count: Math.max(0, s.at(-1) - s[0]), previous: null } : { ...m, unavailable: 'no repo linked' };
      }
      // A GA4 `value` on the event (purchase…) wins over a flat value per goal.
      const revenue = m.eventValue > 0 ? m.eventValue : g.value ? g.value * m.count : 0;
      return { ...g, ...m, revenue: Math.round(revenue * 100) / 100 };
    });

    const { outcomes, trend, revenue, parts } = rollup(measured);
    const eventGoals = measured.filter((g) => g.source === 'event' && !g.unavailable);
    // Tables split by the outcome events when there are any, else by any goal event.
    const outcomeEvents = eventGoals.filter((g) => g.role === 'outcome');
    const rateGoals = outcomeEvents.length ? outcomeEvents : eventGoals;
    const splits = live && siteBase ? await safely('splits', () => siteSplits(site, range, rateGoals.map((g) => g.match), rateGoals.map((g) => g.match))) : null;

    const listingSources = listings.filter(Boolean).flatMap((l) => l.sources);
    const listing = listingFamilies(listingSources);
    const siteHost = site?.host || '';
    const siteDomain = baseDomain(siteHost) || siteHost;
    const fromSite = siteDomain ? listingSources.filter((s) => s.source.includes(siteDomain)) : [];

    const funnel = buildFunnel({
      visitors: siteBase?.visitors || 0,
      goals: measured.filter((g) => !g.unavailable),
      listingFromSite: siteBase && listings.some(Boolean) ? sum(fromSite.map((s) => s.visitors)) : null,
      installsFromSite: sum(fromSite.map((s) => s.installs)),
    });
    const channels = splits ? byFamily(splits.sources) : [];
    const engagement = splits?.engagement || new Map();
    const installsGoal = measured.some((g) => g.source === 'installs' && g.role === 'outcome');
    // Daily outcomes: store installs (when an outcome) and the site goal events.
    // GitHub counts are cumulative snapshots, so they'd land on the first sync day.
    const dailyInstalls = range.dates.map((_, i) => (installsGoal ? n(series.installs?.[i]) : 0));
    const dailySite = splits?.daily || range.dates.map(() => 0);

    const all = insights({
      site,
      siteHost,
      days: range.days,
      keyEvents: siteBase ? siteBase.keyEvents : 1,
      eventGoals: eventGoals.filter((g) => g.count > 0).map((g) => g.match),
      funnel,
      outcomes: trend,
      sessions: kpis.sessions,
      listing,
      channels,
      engagement,
      pages: splits?.pages || [],
      countries: splits?.countries || [],
      dates: range.dates,
      sessionSeries: series.sessions,
      dailyOutcomes: dailyInstalls.map((v, i) => v + dailySite[i]),
    });

    const outs = measured.filter((g) => g.role === 'outcome');
    const rateLabel = rateGoals.length === 1 ? rateGoals[0].label : 'Converted';
    return {
      product: { id: product.id, label: product.label },
      range,
      site: site ? { id: site.id, host: site.host, demo: Boolean(site.demo), propertyId: site.propertyId || '' } : null,
      headline: headline({ label: product.label, days: range.days, outcomes, trend, parts, funnel, list: all }),
      scorecard: [
        { key: 'outcomes', label: 'Outcomes', value: outcomes.value, ...(outcomes.previous !== null ? { previous: outcomes.previous } : {}), meta: outs.map((g) => lowerWord(g.label)).join(' + ') || 'no outcome goal set' },
        ...(outs.length > 1 ? outs.map((g) => ({ key: g.id, label: g.label, value: g.count, ...(n(g.previous) > 0 ? { previous: g.previous } : {}), meta: g.unavailable || (g.previous === null ? 'no earlier history' : g.match || '') })) : []),
        revenue > 0 && { key: 'revenue', label: 'Value', value: revenue, format: 'money', meta: 'from event values and per-goal values' },
        siteBase?.visitors && { key: 'rate', label: 'Per 100 visitors', value: Math.round((outcomes.value / siteBase.visitors) * 1000) / 10, format: 'decimal', meta: `${fmt(siteBase.visitors)} site visitors` },
      ].filter(Boolean),
      funnel,
      goals: {
        custom,
        from: goalsFrom,
        list: measured,
        keyEvents: siteBase?.keyEvents ?? null,
        // For the goal editor: what the site sends, most used first.
        events: (siteBase?.events || []).filter((e) => !NOT_GOAL.test(e.name) || e.name === 'page_view').slice(0, 60).map((e) => ({ name: e.name, users: e.users })),
      },
      rateLabel,
      insights: all,
      channels: channels.slice(0, 10).map((c) => ({ ...c, engagement: engagement.has(c.key) ? engagement.get(c.key) : null })),
      listing: listing.slice(0, 10),
      pages: (splits?.pages || []).slice(0, 10),
      countries: (splits?.countries || []).slice(0, 10),
      series: { dates: range.dates, sessions: series.sessions || [], installs: installsGoal ? dailyInstalls : [], goals: dailySite, goalsLabel: rateLabel },
      errors,
    };
  }

  // The site's events with the goals Studio would suggest, for the goal editor.
  async function suggest({ siteId, hasStore, hasRepos, rangeKey = '28d' }) {
    const site = siteId ? (await store.sites()).find((s) => s.id === siteId) : null;
    const live = site && !site.demo && site.propertyId;
    const base = live ? await siteEvents(site, historyRange(rangeKey, now())) : null;
    const events = base?.events || [];
    return {
      events: events.filter((e) => !NOT_GOAL.test(e.name)).slice(0, 60).map((e) => ({ name: e.name, users: e.users })),
      suggested: autoGoals(classifyEvents(events), { hasStore, hasRepos }).map(({ id, ...g }) => g),
      siteLinked: Boolean(live),
    };
  }

  return {
    suggest,
    // Every event name the site sent in the range (GA4 API), or null without GA4.
    async eventNames(site, rangeKey = '28d') {
      if (!site || site.demo || !site.propertyId) return null;
      const { events } = await siteEvents(site, historyRange(rangeKey, now()));
      return new Set(events.map((e) => e.name));
    },
    clear(id) {
      cache.clear(`outcomes:${id}:`);
    },
    async get(id, rangeKey, { fresh = false } = {}) {
      const key = `outcomes:${id}:${rangeKey}:${historyRange(rangeKey, now()).end}`;
      const data = await cache.wrap(key, TTL, fresh, () => build(id, rangeKey));
      if (Object.keys(data.errors).length) cache.clear(key);
      return data;
    },
  };
}

export function outcomeRoutes({ outcomes }) {
  return [
    // Before /api/outcomes/:id, which would otherwise match "goals".
    ['GET', /^\/api\/outcomes\/goals$/, async ({ query }) => outcomes.suggest({ siteId: query.get('site') || '', hasStore: query.get('store') === '1', hasRepos: query.get('repos') === '1' })],
    ['GET', /^\/api\/outcomes\/([\w-]+)$/, async ({ match, query }) => outcomes.get(match[1], query.get('range') || '28d', { fresh: query.has('fresh') })],
  ];
}
