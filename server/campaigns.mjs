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

import { runReport } from '../shared/sitelens/ga4.js';
import { getRange, hostFilter } from '../shared/sitelens/reports.js';
import { createCache } from './cache.mjs';

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
  const key = (c) => String(c).trim().toLowerCase();
  const get = (name) => {
    const k = key(name);
    if (!byName.has(k)) byName.set(k, { campaign: String(name).trim(), sessions: 0, engaged: 0, keyEvents: 0, previous: 0, goals: {}, firstDay: null, parts: new Map() });
    return byName.get(k);
  };
  for (const r of rows) {
    if (!isTagged(r.sessionCampaignName)) continue;
    const c = get(r.sessionCampaignName);
    const content = isTagged(r.sessionManualAdContent) ? r.sessionManualAdContent : '';
    const pk = `${r.sessionSource}|${r.sessionMedium}|${content}`;
    const p = c.parts.get(pk) || { source: r.sessionSource || '(not set)', medium: r.sessionMedium || '(not set)', content, sessions: 0, engaged: 0, keyEvents: 0, goals: {} };
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
    for (const p of c.parts.values()) {
      if (p.source === r.sessionSource && p.medium === r.sessionMedium) {
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

// Every source / medium, tagged or not.
export function summarizeSources(rows = [], previous = []) {
  const prev = new Map(previous.map((r) => [`${r.sessionSource}|${r.sessionMedium}`, n(r.sessions)]));
  const total = rows.reduce((t, r) => t + n(r.sessions), 0);
  return rows
    .map((r) => ({
      source: r.sessionSource || '(not set)',
      medium: r.sessionMedium || '(not set)',
      sessions: n(r.sessions),
      engaged: n(r.engagedSessions),
      keyEvents: n(r.keyEvents),
      previous: prev.get(`${r.sessionSource}|${r.sessionMedium}`) || 0,
      share: total ? n(r.sessions) / total : 0,
    }))
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

export function createCampaigns({ auth, siteConfig = null, now = Date.now }) {
  const cache = createCache();

  async function build(site, rangeKey) {
    const range = getRange(rangeKey, new Date(now()));
    const host = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
    const token = await auth.token();
    const report = async (body, filtered = true) => (await runReport({ token, propertyId: site.propertyId, body: filtered ? { ...body, dimensionFilter: body.dimensionFilter ? { andGroup: { expressions: [host, body.dimensionFilter] } } : host } : body })).rows;
    const dims = (...names) => names.map((name) => ({ name }));
    const mets = (...names) => names.map((name) => ({ name }));
    const goals = campaignGoals(await siteConfig?.applied(site).catch(() => null));

    const [campaignRows, prevCampaigns, sourceRows, prevSources, goalRows, firstSeen, ads] = await Promise.all([
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
    ]);

    const campaigns = summarizeCampaigns({ rows: campaignRows, previous: prevCampaigns, goalRows, firstSeen, goals });
    const sources = summarizeSources(sourceRows, prevSources);
    const total = sources.reduce((t, s) => t + s.sessions, 0);
    const tagged = campaigns.reduce((t, c) => t + c.sessions, 0);
    return { range: rangeKey, goals, campaigns, sources, ads, totals: { sessions: total, tagged, taggedShare: total ? tagged / total : 0 } };
  }

  return {
    async get(site, rangeKey = '28d', { fresh = false } = {}) {
      if (site.demo) return demoCampaigns(rangeKey);
      if (!site.propertyId) return null;
      return cache.wrap(`campaigns:${site.id}:${rangeKey}`, TTL, fresh, () => build(site, rangeKey));
    },
  };
}

export function campaignRoutes({ campaigns, siteOr404 }) {
  return [
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
    totals: { sessions: total, tagged, taggedShare: tagged / total },
  };
}
