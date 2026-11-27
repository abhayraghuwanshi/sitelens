// Campaigns: where visits come from and which tagged links bring results.
//
// All from GA4, per site (host-filtered):
//   - Tagged campaigns: utm_campaign with its sources, mediums and variants
//     (utm_content), visits, engaged visits, GA4 key events and the site's own
//     event goals (.sitelens.yml), against the period before, and the first day
//     each campaign showed up in the last 90 days.
//   - Sources: every source / medium, tagged or not, so untagged traffic shows too.
//   - Google Ads: cost, clicks and key events per Ads campaign, when the GA4
//     property is linked to Google Ads. Advertiser metrics can't be filtered by
//     host, so they cover the whole property.
//
// GA4 fills sessionCampaignName with labels like (organic), (referral) or
// (direct) when a visit has no utm_campaign; those aren't campaigns.

import { runReport } from './ga-limit.mjs';
import { getRange, hostFilter } from '../shared/sitelens/reports.js';
import { createCache } from './cache.mjs';
import { ValidationError } from './store.mjs';
import { cleanPair, campaignKey } from '../shared/traffic-source.js';

const TTL = 10 * 60_000;
const MAX_GOALS = 3;
const n = (v) => Number(v) || 0;
const isoFromGa = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

export const isTagged = (name) => {
  const c = String(name || '').trim();
  return Boolean(c) && !/^\(.*\)$/.test(c);
};

// The site's own outcome goals that GA4 can count per campaign: event goals.
export function campaignGoals(config) {
  return (config?.goals || [])
    .filter((g) => g.source === 'event' && g.match && (g.role || 'outcome') === 'outcome')
    .slice(0, MAX_GOALS)
    .map((g) => ({ id: g.id || g.match, label: g.label || g.match, event: g.match }));
}

// GA4 rows → one entry per campaign, its source/medium/variant rows inside.
// rows: { sessionCampaignName, sessionSource, sessionMedium, sessionManualAdContent, sessions, engagedSessions, keyEvents }
// previous: { sessionCampaignName, sessions }; goalRows: { sessionCampaignName, sessionSource, sessionMedium, eventName, totalUsers }
// firstSeen: { sessionCampaignName, date }
export function summarizeCampaigns({ rows = [], previous = [], goalRows = [], firstSeen = [], goals = [] }) {
  const byName = new Map();
  // Launch_Post, launch post and launch-post are one campaign.
  const key = campaignKey;
  const get = (name) => {
    const k = key(name);
    if (!byName.has(k)) byName.set(k, { campaign: String(name).trim(), sessions: 0, engaged: 0, keyEvents: 0, previous: 0, goals: {}, firstDay: null, parts: new Map() });
    return byName.get(k);
  };
  for (const r of rows) {
    if (!isTagged(r.sessionCampaignName)) continue;
    const c = get(r.sessionCampaignName);
    const content = isTagged(r.sessionManualAdContent) ? campaignKey(r.sessionManualAdContent) : '';
    const { source, medium } = cleanPair(r.sessionSource, r.sessionMedium);
    const pk = `${source}|${medium}|${content}`;
    const p = c.parts.get(pk) || { source, medium, content, sessions: 0, engaged: 0, keyEvents: 0, goals: {} };
    for (const t of [c, p]) {
      t.sessions += n(r.sessions);
      t.engaged += n(r.engagedSessions);
      t.keyEvents += n(r.keyEvents);
    }
    c.parts.set(pk, p);
  }
  for (const r of previous) if (isTagged(r.sessionCampaignName)) get(r.sessionCampaignName).previous += n(r.sessions);
  const goalOf = new Map(goals.map((g) => [g.event, g.id]));
  for (const r of goalRows) {
    if (!isTagged(r.sessionCampaignName) || !goalOf.has(r.eventName)) continue;
    const c = get(r.sessionCampaignName);
    const id = goalOf.get(r.eventName);
    c.goals[id] = (c.goals[id] || 0) + n(r.totalUsers);
    // Variants aren't in the goal report; credit the source/medium row.
    const pair = cleanPair(r.sessionSource, r.sessionMedium);
    for (const p of c.parts.values()) {
      if (p.source === pair.source && p.medium === pair.medium) {
        p.goals[id] = (p.goals[id] || 0) + n(r.totalUsers);
        break;
      }
    }
  }
  for (const r of firstSeen) {
    if (!isTagged(r.sessionCampaignName) || !n(r.sessions)) continue;
    const c = byName.get(key(r.sessionCampaignName));
    if (!c) continue;
    const day = isoFromGa(r.date);
    if (!c.firstDay || day < c.firstDay) c.firstDay = day;
  }
  return [...byName.values()]
    .filter((c) => c.sessions || c.previous)
    .map(({ parts, ...c }) => ({ ...c, parts: [...parts.values()].sort((a, b) => b.sessions - a.sessions) }))
    .sort((a, b) => b.sessions - a.sessions || b.previous - a.previous);
}

// Every source / medium, tagged or not. Spellings of one place merge
// (Facebook / Social, fb / social, m.facebook.com / referral → facebook /
// social); `aka` lists the raw spellings that were merged in.
export function summarizeSources(rows = [], previous = []) {
  const pairKey = (r) => {
    const { source, medium } = cleanPair(r.sessionSource, r.sessionMedium);
    return `${source}|${medium}`;
  };
  const prev = new Map();
  for (const r of previous) prev.set(pairKey(r), (prev.get(pairKey(r)) || 0) + n(r.sessions));
  const total = rows.reduce((t, r) => t + n(r.sessions), 0);
  const byPair = new Map();
  for (const r of rows) {
    const k = pairKey(r);
    const [source, medium] = k.split('|');
    const s = byPair.get(k) || { source, medium, sessions: 0, engaged: 0, keyEvents: 0, previous: prev.get(k) || 0, share: 0, aka: [] };
    s.sessions += n(r.sessions);
    s.engaged += n(r.engagedSessions);
    s.keyEvents += n(r.keyEvents);
    const raw = `${r.sessionSource || '(not set)'} / ${r.sessionMedium || '(not set)'}`;
    if (raw !== `${source} / ${medium}` && !s.aka.includes(raw)) s.aka.push(raw);
    byPair.set(k, s);
  }
  return [...byPair.values()]
    .map((s) => ({ ...s, share: total ? s.sessions / total : 0 }))
    .sort((a, b) => b.sessions - a.sessions);
}

// Google Ads rows → per Ads campaign, with cost per key event. No cost and no
// clicks anywhere means the property isn't linked to Google Ads.
export function summarizeAds(rows = []) {
  const list = rows
    .filter((r) => isTagged(r.sessionGoogleAdsCampaignName))
    .map((r) => {
      const cost = n(r.advertiserAdCost);
      const keyEvents = n(r.keyEvents);
      return {
        campaign: r.sessionGoogleAdsCampaignName,
        cost,
        clicks: n(r.advertiserAdClicks),
        impressions: n(r.advertiserAdImpressions),
        sessions: n(r.sessions),
        keyEvents,
        costPerKeyEvent: keyEvents ? cost / keyEvents : null,
      };
    })
    .filter((r) => r.cost || r.clicks || r.sessions)
    .sort((a, b) => b.cost - a.cost || b.sessions - a.sessions);
  return { linked: list.some((r) => r.cost || r.clicks), campaigns: list, cost: list.reduce((t, r) => t + r.cost, 0) };
}

// ---------- ad spend you enter (Reddit, X, Meta, LinkedIn…) and ad earnings ----------

// studio.json `adSpend[siteId]` = [{ id, platform, name, campaign, start, end, amount, note }].
// GA4 never sees money spent outside Google Ads, so each entry is matched to the
// visits its links brought: by utm_campaign when given, else by the platform's
// sources with a paid medium.
export const PLATFORMS = {
  google: { label: 'Google Ads', sources: ['google'] },
  reddit: { label: 'Reddit Ads', sources: ['reddit', 'reddit.com'] },
  x: { label: 'X Ads', sources: ['x', 'twitter', 't.co', 'x.com', 'twitter.com'] },
  meta: { label: 'Meta Ads', sources: ['facebook', 'fb', 'instagram', 'ig', 'meta', 'facebook.com', 'instagram.com', 'm.facebook.com', 'l.facebook.com'] },
  linkedin: { label: 'LinkedIn Ads', sources: ['linkedin', 'linkedin.com', 'lnkd.in'] },
  other: { label: 'Other', sources: [] },
};
const PAID_MEDIUM = /^(cpc|ppc|paid|paid[-_ ]?social|paidsocial|display|cpm|cpv|ads?|sponsored)$/i;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const dayMs = (d) => Date.parse(`${d}T00:00:00Z`);

// "27daysAgo" / "today" / "yesterday" / ISO → ISO, from `today`.
export function isoOf(rel, today) {
  if (YMD.test(rel)) return rel;
  if (rel === 'today') return today;
  if (rel === 'yesterday') return new Date(dayMs(today) - DAY).toISOString().slice(0, 10);
  const m = /^(\d+)daysAgo$/.exec(rel);
  return m ? new Date(dayMs(today) - Number(m[1]) * DAY).toISOString().slice(0, 10) : today;
}

export function normalizeSpend(input = {}) {
  const platform = PLATFORMS[input.platform] ? input.platform : 'other';
  const name = String(input.name || '').trim().slice(0, 120);
  const campaign = String(input.campaign || '').trim().slice(0, 120);
  const start = String(input.start || '');
  const end = String(input.end || input.start || '');
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!name) throw new Error('Give the campaign a name.');
  if (!YMD.test(start) || !YMD.test(end)) throw new Error('Pick the dates it ran.');
  if (end < start) throw new Error('The end date is before the start.');
  if (!(amount > 0) || amount > 1e8) throw new Error('Enter what you spent, as a number.');
  if (platform === 'other' && !campaign) throw new Error('For “Other”, give the utm_campaign its links use, so its visits can be found.');
  return { platform, name, campaign, start, end, amount, note: String(input.note || '').trim().slice(0, 300) };
}

// Entries × this period's GA4 rows → spend in the period (pro-rated by days)
// and the visits, key events and goals it brought.
// rows: { sessionCampaignName, sessionSource, sessionMedium, sessions, keyEvents }
export function summarizeSpend(entries = [], rows = [], { start, end }) {
  const lc = (v) => String(v || '').trim().toLowerCase();
  const out = entries.map((e) => {
    const from = e.start > start ? e.start : start;
    const to = e.end < end ? e.end : end;
    const days = Math.max(0, (dayMs(to) - dayMs(from)) / DAY + 1);
    const total = (dayMs(e.end) - dayMs(e.start)) / DAY + 1;
    const spent = days ? Math.round((e.amount * days) / total * 100) / 100 : 0;
    const sources = new Set(PLATFORMS[e.platform]?.sources || []);
    const match = e.campaign
      ? (r) => lc(r.sessionCampaignName) === lc(e.campaign)
      : (r) => sources.has(lc(r.sessionSource)) && PAID_MEDIUM.test(String(r.sessionMedium || ''));
    const hit = days ? rows.filter(match) : [];
    const sessions = hit.reduce((t, r) => t + n(r.sessions), 0);
    const keyEvents = hit.reduce((t, r) => t + n(r.keyEvents), 0);
    return {
      ...e, spent, inPeriod: days > 0, sessions, keyEvents,
      matchedBy: e.campaign ? 'campaign' : 'platform',
      costPerVisit: sessions ? spent / sessions : null,
      costPerKeyEvent: keyEvents ? spent / keyEvents : null,
    };
  });
  return { entries: out.sort((a, b) => b.start.localeCompare(a.start)), total: out.reduce((t, e) => t + e.spent, 0) };
}

// GA4 ad earnings (AdSense, AdMob, Ad Manager linked to the property).
// rows: { sessionSource, sessionMedium, totalAdRevenue, publisherAdImpressions, publisherAdClicks }
export function summarizeEarnings(rows = [], previous = 0) {
  const total = rows.reduce((t, r) => t + n(r.totalAdRevenue), 0);
  return {
    total, previous,
    impressions: rows.reduce((t, r) => t + n(r.publisherAdImpressions), 0),
    clicks: rows.reduce((t, r) => t + n(r.publisherAdClicks), 0),
    bySource: rows.filter((r) => n(r.totalAdRevenue) > 0)
      .map((r) => ({ source: r.sessionSource, medium: r.sessionMedium, revenue: n(r.totalAdRevenue) }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export function createCampaigns({ auth, siteConfig = null, store = null, now = Date.now }) {
  const cache = createCache();

  async function build(site, rangeKey) {
    const range = getRange(rangeKey, new Date(now()));
    const host = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
    const token = await auth.token();
    let currency = '';
    const report = async (body, filtered = true) => {
      const res = await runReport({ token, propertyId: site.propertyId, body: filtered ? { ...body, dimensionFilter: body.dimensionFilter ? { andGroup: { expressions: [host, body.dimensionFilter] } } : host } : body });
      currency ||= res.metadata?.currencyCode || '';
      return res.rows;
    };
    const dims = (...names) => names.map((name) => ({ name }));
    const mets = (...names) => names.map((name) => ({ name }));
    const goals = campaignGoals(await siteConfig?.applied(site).catch(() => null));

    const [campaignRows, prevCampaigns, sourceRows, prevSources, goalRows, firstSeen, ads, ...extra] = await Promise.all([
      report({ dateRanges: [range.current], dimensions: dims('sessionCampaignName', 'sessionSource', 'sessionMedium', 'sessionManualAdContent'), metrics: mets('sessions', 'engagedSessions', 'keyEvents'), limit: 2000 }),
      report({ dateRanges: [range.previous], dimensions: dims('sessionCampaignName'), metrics: mets('sessions'), limit: 1000 }),
      report({ dateRanges: [range.current], dimensions: dims('sessionSource', 'sessionMedium'), metrics: mets('sessions', 'engagedSessions', 'keyEvents'), limit: 50 }),
      report({ dateRanges: [range.previous], dimensions: dims('sessionSource', 'sessionMedium'), metrics: mets('sessions'), limit: 200 }),
      goals.length
        ? report({ dateRanges: [range.current], dimensions: dims('sessionCampaignName', 'sessionSource', 'sessionMedium', 'eventName'), metrics: mets('totalUsers'), dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: goals.map((g) => g.event) } } }, limit: 2000 })
        : [],
      // First day each campaign brought visits, within the last 90 days.
      report({ dateRanges: [{ startDate: '89daysAgo', endDate: 'today' }], dimensions: dims('date', 'sessionCampaignName'), metrics: mets('sessions'), limit: 10000 }),
      report({ dateRanges: [range.current], dimensions: dims('sessionGoogleAdsCampaignName'), metrics: mets('advertiserAdCost', 'advertiserAdClicks', 'advertiserAdImpressions', 'sessions', 'keyEvents'), limit: 100 }, false)
        .then((rows) => summarizeAds(rows))
        .catch((err) => ({ linked: false, campaigns: [], cost: 0, error: err.message })),
      // Ad earnings, by source, and the period before for the change.
      report({ dateRanges: [range.current], dimensions: dims('sessionSource', 'sessionMedium'), metrics: mets('totalAdRevenue', 'publisherAdImpressions', 'publisherAdClicks'), limit: 200 })
        .catch(() => null),
      report({ dateRanges: [range.previous], metrics: mets('totalAdRevenue') }).then((rows) => n(rows[0]?.totalAdRevenue)).catch(() => 0),
    ]);
    const [earnRows, earnBefore] = extra;

    const campaigns = summarizeCampaigns({ rows: campaignRows, previous: prevCampaigns, goalRows, firstSeen, goals });
    const sources = summarizeSources(sourceRows, prevSources);
    const total = sources.reduce((t, s) => t + s.sessions, 0);
    const tagged = campaigns.reduce((t, c) => t + c.sessions, 0);
    const today = new Date(now()).toISOString().slice(0, 10);
    const period = { start: isoOf(range.current.startDate, today), end: isoOf(range.current.endDate, today) };
    const entries = (await store?.get())?.adSpend?.[site.id] || [];
    const spend = summarizeSpend(entries, campaignRows, period);
    const earnings = earnRows ? summarizeEarnings(earnRows, earnBefore) : null;
    return {
      range: rangeKey, period, currency, goals, campaigns, sources, ads, spend, earnings,
      money: { spent: (ads.linked ? ads.cost : 0) + spend.total, earned: earnings?.total || 0 },
      totals: { sessions: total, tagged, taggedShare: total ? tagged / total : 0 },
    };
  }

  return {
    forget(site) { cache.clear(`campaigns:${site.id}:`); },
    async get(site, rangeKey = '28d', { fresh = false } = {}) {
      if (site.demo) return demoCampaigns(rangeKey);
      if (!site.propertyId) return null;
      return cache.wrap(`campaigns:${site.id}:${rangeKey}`, TTL, fresh, () => build(site, rangeKey));
    },
  };
}

// Entered spend spread evenly over the days it ran → date → amount.
export function spendByDay(entries = [], from, to) {
  const out = new Map();
  for (const e of entries) {
    const total = (dayMs(e.end) - dayMs(e.start)) / DAY + 1;
    const perDay = e.amount / total;
    const a = e.start > from ? e.start : from;
    const b = e.end < to ? e.end : to;
    for (let t = dayMs(a); t <= dayMs(b); t += DAY) {
      const d = new Date(t).toISOString().slice(0, 10);
      out.set(d, (out.get(d) || 0) + perDay);
    }
  }
  return out;
}

// Ad money per day for the Timeline: Google Ads cost (whole property) and ad
// earnings (this host) from GA4, plus entered spend. null when the site has
// none of either in the window, so the Timeline leaves the metric out.
export function createAdDays({ auth, store, now = Date.now }) {
  const cache = createCache();
  const adDays = async function adDays(site, from, to) {
    const key = `addays:${site.id}:${from}:${to}`;
    return cache.wrap(key, 60 * 60_000, false, async () => {
      const entries = site.demo ? [] : (await store.get()).adSpend?.[site.id] || [];
      const spent = spendByDay(entries, from, to);
      const earned = new Map();
      let currency = '';
      if (site.propertyId && !site.demo) {
        const token = await auth.token();
        const host = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
        const today = new Date(now()).toISOString().slice(0, 10);
        const range = { startDate: from, endDate: to < today ? to : today };
        const [cost, revenue] = await Promise.all([
          runReport({ token, propertyId: site.propertyId, body: { dateRanges: [range], dimensions: [{ name: 'date' }], metrics: [{ name: 'advertiserAdCost' }], limit: 1000 } }).catch(() => null),
          runReport({ token, propertyId: site.propertyId, body: { dateRanges: [range], dimensions: [{ name: 'date' }], metrics: [{ name: 'totalAdRevenue' }], dimensionFilter: host, limit: 1000 } }).catch(() => null),
        ]);
        currency = cost?.metadata?.currencyCode || revenue?.metadata?.currencyCode || '';
        for (const r of cost?.rows || []) if (n(r.advertiserAdCost)) spent.set(isoFromGa(r.date), (spent.get(isoFromGa(r.date)) || 0) + n(r.advertiserAdCost));
        for (const r of revenue?.rows || []) if (n(r.totalAdRevenue)) earned.set(isoFromGa(r.date), n(r.totalAdRevenue));
      }
      const round = (m) => new Map([...m].map(([d, v]) => [d, Math.round(v * 100) / 100]));
      return {
        currency,
        spent: [...spent.values()].some((v) => v > 0) ? round(spent) : null,
        earned: [...earned.values()].some((v) => v > 0) ? round(earned) : null,
      };
    });
  };
  // A changed entry: read the site's days again.
  adDays.forget = (site) => cache.clear(`addays:${site.id}:`);
  return adDays;
}

// Ad spend entries: list, add or change (id), remove. The campaigns cache is
// cleared so Traffic shows the change on its next read.
export function createAdSpend({ store, onChange = () => {} }) {
  const list = async (site) => (await store.get()).adSpend?.[site.id] || [];
  return {
    list,
    async save(site, input = {}) {
      const entry = normalizeSpend(input);
      let saved;
      await store.update((s) => {
        const all = { ...(s.adSpend || {}) };
        const mine = [...(all[site.id] || [])];
        const i = input.id ? mine.findIndex((e) => e.id === input.id) : -1;
        saved = { ...entry, id: i >= 0 ? mine[i].id : `ad_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() };
        if (i >= 0) mine[i] = saved; else mine.push(saved);
        all[site.id] = mine;
        s.adSpend = all;
      });
      onChange(site);
      return saved;
    },
    async remove(site, id) {
      await store.update((s) => {
        const all = { ...(s.adSpend || {}) };
        all[site.id] = (all[site.id] || []).filter((e) => e.id !== id);
        s.adSpend = all;
      });
      onChange(site);
      return { ok: true };
    },
  };
}

export function campaignRoutes({ campaigns, adSpend, siteOr404 }) {
  return [
    ...(adSpend ? [
      ['GET', /^\/api\/sites\/([\w-]+)\/ad-spend$/, async ({ match }) => ({ entries: await adSpend.list(await siteOr404(match[1])), platforms: Object.entries(PLATFORMS).map(([key, p]) => ({ key, label: p.label })) })],
      ['POST', /^\/api\/sites\/([\w-]+)\/ad-spend$/, async ({ match, body }) => {
        const site = await siteOr404(match[1]);
        if (site.demo) throw new ValidationError('The sample site can’t be changed.');
        try { return await adSpend.save(site, body || {}); } catch (err) { throw new ValidationError(err.message); }
      }],
      ['DELETE', /^\/api\/sites\/([\w-]+)\/ad-spend\/([\w-]+)$/, async ({ match }) => adSpend.remove(await siteOr404(match[1]), match[2])],
    ] : []),
    ['GET', /^\/api\/sites\/([\w-]+)\/campaigns$/, async ({ match, query }) =>
      (await campaigns.get(await siteOr404(match[1]), query.get('range') || '28d', { fresh: query.has('fresh') }))
        ?? { needsGa4: true }],
  ];
}

function demoCampaigns(rangeKey) {
  const goals = [{ id: 'sign_up', label: 'Sign-ups', event: 'sign_up' }];
  const part = (source, medium, content, sessions, engaged, keyEvents, signUps) => ({ source, medium, content, sessions, engaged, keyEvents, goals: { sign_up: signUps } });
  const camp = (campaign, firstDay, previous, parts) => ({
    campaign, firstDay, previous,
    sessions: parts.reduce((t, p) => t + p.sessions, 0),
    engaged: parts.reduce((t, p) => t + p.engaged, 0),
    keyEvents: parts.reduce((t, p) => t + p.keyEvents, 0),
    goals: { sign_up: parts.reduce((t, p) => t + p.goals.sign_up, 0) },
    parts,
  });
  const campaigns = [
    camp('launch-week', '2026-10-27', 0, [part('producthunt', 'social', '', 412, 251, 38, 31), part('newsletter', 'email', 'header-button', 188, 141, 22, 19), part('newsletter', 'email', 'footer-link', 41, 30, 4, 3)]),
    camp('ga4-vs-plausible', '2026-09-14', 96, [part('reddit', 'social', 'r-analytics', 133, 71, 6, 4), part('hackernews', 'social', '', 58, 22, 1, 1)]),
    camp('october-newsletter', '2026-10-02', 140, [part('newsletter', 'email', '', 97, 74, 9, 7)]),
  ];
  const src = (source, medium, sessions, engaged, keyEvents, previous) => ({ source, medium, sessions, engaged, keyEvents, previous });
  const list = [src('google', 'organic', 1840, 1104, 61, 1710), src('(direct)', '(none)', 920, 460, 30, 880), src('producthunt', 'social', 412, 251, 38, 0), src('newsletter', 'email', 326, 245, 35, 140), src('chatgpt.com', 'referral', 140, 98, 9, 92), src('reddit', 'social', 133, 71, 6, 96), src('bing', 'organic', 121, 70, 4, 110), src('google', 'cpc', 96, 41, 5, 0), src('hackernews', 'social', 58, 22, 1, 0)];
  const total = list.reduce((t, s) => t + s.sessions, 0);
  const sources = list.map((s) => ({ ...s, share: s.sessions / total }));
  const tagged = campaigns.reduce((t, c) => t + c.sessions, 0);
  return {
    range: rangeKey, goals, campaigns, sources,
    ads: { linked: true, cost: 182.4, campaigns: [{ campaign: 'Brand – search', cost: 64.1, clicks: 71, impressions: 1220, sessions: 66, keyEvents: 5, costPerKeyEvent: 12.82 }, { campaign: 'Competitor terms', cost: 118.3, clicks: 34, impressions: 2890, sessions: 30, keyEvents: 0, costPerKeyEvent: null }] },
    currency: 'USD',
    spend: { total: 120, entries: [{ id: 'demo-reddit', platform: 'reddit', name: 'r/analytics promoted post', campaign: 'ga4-vs-plausible', start: '2026-11-01', end: '2026-11-14', amount: 120, note: '', spent: 120, inPeriod: true, sessions: 133, keyEvents: 6, matchedBy: 'campaign', costPerVisit: 120 / 133, costPerKeyEvent: 20 }] },
    earnings: { total: 41.7, previous: 33.2, impressions: 18400, clicks: 96, bySource: [{ source: 'google', medium: 'organic', revenue: 24.1 }, { source: '(direct)', medium: '(none)', revenue: 9.8 }, { source: 'reddit', medium: 'social', revenue: 4.2 }] },
    money: { spent: 302.4, earned: 41.7 },
    totals: { sessions: total, tagged, taggedShare: tagged / total },
  };
}
