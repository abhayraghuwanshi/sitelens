// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.
// Deterministic sample data for Demo mode and the local preview page.
// It mirrors the exact shapes returned by the real GA4 report layer.

import { getRange } from './reports.js';
import { normalizePagePath } from './site.js';
import { searchRange, searchOpportunities, searchPageUrl } from './gsc.js';

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < String(value).length; i++) {
    h ^= String(value).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAGE_SEEDS = [
  ['/', 'Home', 0.24, 58, 0.63],
  ['/pricing', 'Pricing', 0.14, 104, 0.71],
  ['/features', 'Features', 0.11, 96, 0.66],
  ['/blog/how-to-measure-product-engagement', 'How to measure product engagement', 0.09, 214, 0.78],
  ['/docs/getting-started', 'Getting started', 0.08, 186, 0.74],
  ['/integrations', 'Integrations', 0.07, 88, 0.61],
  ['/customers', 'Customers', 0.06, 122, 0.69],
  ['/signup', 'Create your account', 0.05, 46, 0.55],
  ['/about', 'About us', 0.04, 74, 0.58],
  ['/blog/ga4-vs-plausible', 'GA4 vs Plausible', 0.04, 175, 0.73],
  ['/changelog', 'Changelog', 0.03, 68, 0.6],
  ['/contact', 'Contact', 0.02, 51, 0.52],
  ['/careers', 'Careers', 0.02, 92, 0.5],
  ['/legal/privacy', 'Privacy', 0.01, 38, 0.44],
];

const CHANNEL_SEEDS = [
  ['Organic Search', 0.38],
  ['Direct', 0.3],
  ['Referral', 0.11],
  ['Organic Social', 0.08],
  ['Paid Search', 0.06],
  ['Email', 0.04],
  ['Unassigned', 0.02],
  ['Display', 0.01],
];

const COUNTRY_SEEDS = [
  ['US', 0.34],
  ['IN', 0.19],
  ['GB', 0.1],
  ['DE', 0.08],
  ['CA', 0.07],
  ['FR', 0.05],
  ['AU', 0.04],
  ['BR', 0.03],
];

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function daysFor(rangeKey) {
  return getRange(rangeKey).days;
}

function makeTrend(days, rand, scale, endOffset = 0) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i - endOffset);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6 ? 0.72 : 1;
    const growth = 1 + (days - i) / days * 0.12;
    const noise = 0.86 + rand() * 0.3;
    const users = Math.max(4, Math.round(scale * weekend * growth * noise));
    out.push({
      date: dateKey(date),
      activeUsers: users,
      sessions: Math.round(users * (1.12 + rand() * 0.16)),
      screenPageViews: Math.round(users * (2.3 + rand() * 0.9)),
    });
  }
  return out;
}

// A day is shaped like a real traffic curve: quiet at night, two peaks around
// lunch and late afternoon. Only the hours that have happened so far are
// emitted, so "Today" in the demo never shows future traffic.
const HOUR_CURVE = [
  0.34, 0.26, 0.2, 0.18, 0.2, 0.28, 0.44, 0.62, 0.82, 0.96, 1.06, 1.12,
  1.16, 1.12, 1.06, 1.0, 0.95, 0.9, 0.84, 0.78, 0.7, 0.58, 0.48, 0.4,
];

function makeHourlyTrend(hours, rand, scale, dayOffset = 0) {
  const day = new Date();
  day.setDate(day.getDate() - dayOffset);
  const date = dateKey(day);
  const out = [];
  for (let hour = 0; hour < hours; hour++) {
    const noise = 0.82 + rand() * 0.36;
    const users = Math.max(0, Math.round(scale * 0.055 * HOUR_CURVE[hour] * noise));
    out.push({
      date,
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      activeUsers: users,
      sessions: Math.round(users * (1.1 + rand() * 0.2)),
      screenPageViews: Math.round(users * (1.9 + rand() * 0.8)),
    });
  }
  return out;
}

const titleFor = (path, name, host) => `${name} · ${host.replace(/^www\./, '')}`;

export function demoSiteReports(host = 'example.com', rangeKey = '28d') {
  const rand = mulberry32(hashString(`${host}:${rangeKey}`));
  const range = getRange(rangeKey);
  const days = daysFor(rangeKey);
  const baseDaily = 96 + rand() * 150;

  const trend = range.hourly
    ? makeHourlyTrend(new Date().getHours() + 1, rand, baseDaily)
    : makeTrend(days, rand, baseDaily);
  // Live ranges compare like for like: today against yesterday at the same
  // hour, week-to-date against last week's matching weekdays.
  const previousTrend = range.hourly
    ? makeHourlyTrend(new Date().getHours() + 1, mulberry32(hashString(`${host}:prev`)), baseDaily * 0.9, 1)
    : makeTrend(days, mulberry32(hashString(`${host}:prev`)), baseDaily * (0.82 + rand() * 0.12), days);

  const sum = (rows, key) => rows.reduce((acc, row) => acc + row[key], 0);
  const sessions = sum(trend, 'sessions');
  const users = sum(trend, 'activeUsers');
  const views = sum(trend, 'screenPageViews');
  const prevSessions = sum(previousTrend, 'sessions');
  const prevUsers = sum(previousTrend, 'activeUsers');
  const prevViews = sum(previousTrend, 'screenPageViews');

  const pages = PAGE_SEEDS.map(([path, name, weight, duration, engagement], index) => {
    const jitter = 0.82 + rand() * 0.4;
    const pageViews = Math.max(3, Math.round(views * weight * jitter));
    return {
      path,
      title: titleFor(path, name, host),
      views: pageViews,
      users: Math.round(pageViews * (0.42 + rand() * 0.22)),
      avgDuration: Math.round(duration * (0.82 + rand() * 0.4)),
      engagementRate: Math.min(0.94, Math.max(0.28, engagement * (0.92 + rand() * 0.15))),
      index,
    };
  }).sort((a, b) => b.views - a.views);

  const sessionsTotal = Math.round(sessions);
  const scaleChannel = (weight) => Math.max(0, Math.round(sessionsTotal * weight));
  const channels = CHANNEL_SEEDS.map(([channel, weight]) => ({
    channel,
    sessions: scaleChannel(weight * (0.9 + rand() * 0.2)),
    users: Math.round(scaleChannel(weight) * (0.72 + rand() * 0.15)),
    engagementRate: Math.min(0.9, 0.42 + rand() * 0.38),
  })).sort((a, b) => b.sessions - a.sessions);

  const devices = [
    { device: 'mobile', sessions: Math.round(sessionsTotal * 0.58), users: Math.round(users * 0.55), engagementRate: 0.58 },
    { device: 'desktop', sessions: Math.round(sessionsTotal * 0.36), users: Math.round(users * 0.39), engagementRate: 0.71 },
    { device: 'tablet', sessions: Math.round(sessionsTotal * 0.06), users: Math.round(users * 0.06), engagementRate: 0.55 },
  ];

  const countries = COUNTRY_SEEDS.map(([country, weight]) => ({
    country,
    users: Math.round(users * weight * (0.88 + rand() * 0.22)),
    sessions: Math.round(sessions * weight * (0.88 + rand() * 0.22)),
  })).sort((a, b) => b.users - a.users);

  const entryPages = [
    ['/', 0.3],
    ['/pricing', 0.16],
    ['/blog/how-to-measure-product-engagement', 0.12],
    ['/features', 0.11],
    ['/docs/getting-started', 0.09],
    ['/integrations', 0.07],
    ['/customers', 0.06],
    ['/blog/ga4-vs-plausible', 0.05],
  ].map(([path, weight]) => {
    const page = pages.find((p) => p.path === path);
    const rowSessions = Math.max(2, Math.round(sessionsTotal * weight * (0.85 + rand() * 0.25)));
    return {
      path,
      sessions: rowSessions,
      users: Math.round(rowSessions * (0.74 + rand() * 0.12)),
      engagementRate: page ? Math.max(0.25, page.engagementRate - 0.08) : 0.5,
      avgDuration: page ? Math.round(page.avgDuration * 0.9) : 60,
    };
  });

  const transitions = [
    ['/', '/pricing', 640],
    ['/', '/features', 505],
    ['/pricing', '/signup', 410],
    ['/features', '/pricing', 360],
    ['/blog/how-to-measure-product-engagement', '/', 300],
    ['/docs/getting-started', '/integrations', 260],
    ['/', '/docs/getting-started', 240],
    ['/customers', '/pricing', 205],
    ['/blog/ga4-vs-plausible', '/blog/how-to-measure-product-engagement', 180],
    ['/pricing', '/docs/getting-started', 155],
    ['/signup', '/docs/getting-started', 120],
    ['/features', '/integrations', 110],
    ['/integrations', '/docs/getting-started', 95],
    ['/about', '/careers', 70],
    ['/changelog', '/features', 45],
  ].map(([from, to, count]) => ({
    referrer: `https://${host}${from}`,
    path: to,
    count: Math.round(count * (0.7 + rand() * 0.6)),
  }));

  const current = {
    activeUsers: users,
    newUsers: Math.round(users * (0.58 + rand() * 0.12)),
    sessions: sessionsTotal,
    screenPageViews: views,
    engagementRate: 0.56 + rand() * 0.12,
    averageSessionDuration: 108 + rand() * 46,
    keyEvents: Math.round(sessionsTotal * (0.028 + rand() * 0.014)),
  };
  const previous = {
    activeUsers: prevUsers,
    newUsers: Math.round(prevUsers * 0.58),
    sessions: prevSessions,
    screenPageViews: prevViews,
    engagementRate: current.engagementRate - 0.02 + rand() * 0.04,
    averageSessionDuration: current.averageSessionDuration - 4 + rand() * 12,
    keyEvents: Math.round(prevSessions * 0.03),
  };

  return {
    range: {
      key: range.key,
      label: range.label,
      title: range.title,
      days: range.days,
      startLabel: range.startLabel,
      endLabel: range.endLabel,
    },
    overview: { current, previous },
    trend,
    pages,
    channels,
    devices,
    countries,
    entryPages,
    transitions,
    warnings: [],
  };
}

export function demoPageDetail(siteData, path = '/') {
  const target = normalizePagePath(path);
  const page = siteData.pages.find((p) => normalizePagePath(p.path) === target);
  const current = siteData.overview.current;
  const row = page || {
    path: target,
    views: 0,
    users: 0,
    avgDuration: 0,
    engagementRate: 0,
  };
  return {
    path: target,
    activeUsers: row.users,
    newUsers: Math.round(row.users * 0.6),
    sessions: Math.round(row.users * 1.2),
    screenPageViews: row.views,
    engagementRate: row.engagementRate,
    averageSessionDuration: row.avgDuration,
    keyEvents: Math.round(row.views * 0.02),
    previous: {
      activeUsers: Math.round(row.users * 0.88),
      newUsers: Math.round(row.users * 0.5),
      sessions: Math.round(row.users * 1.05),
      screenPageViews: Math.round(row.views * 0.9),
      engagementRate: Math.max(0, row.engagementRate - 0.03),
      averageSessionDuration: row.avgDuration - 6,
      keyEvents: Math.round(row.views * 0.018),
    },
    isSample: row.views === 0 ? true : undefined,
    siteEngagement: current.engagementRate,
  };
}

export function demoPageTrend(siteData, path = '/') {
  const target = normalizePagePath(path);
  const page = siteData.pages.find((row) => normalizePagePath(row.path) === target);
  const totalViews = siteData.overview?.current?.screenPageViews || 0;
  const share = page && totalViews ? Math.min(1, page.views / totalViews) : 0.04;
  const rand = mulberry32(hashString(`page-trend:${target}`));
  return (siteData.trend || []).map((row) => {
    const wobble = 0.8 + rand() * 0.4;
    return {
      date: row.date,
      ...(row.label ? { label: row.label, hour: row.hour } : {}),
      activeUsers: Math.max(0, Math.round(row.activeUsers * share * wobble)),
      sessions: Math.max(0, Math.round(row.sessions * share * wobble)),
      screenPageViews: Math.max(0, Math.round(row.screenPageViews * share * wobble)),
    };
  });
}

export function demoAiTraffic(host = 'example.com', rangeKey = '28d') {
  const site = demoSiteReports(host, rangeKey);
  const rand = mulberry32(hashString(`${host}:ai:${rangeKey}`));
  const totalSessions = site.overview?.current?.sessions || 0;
  const sessions = Math.max(2, Math.round(totalSessions * (0.026 + rand() * 0.028)));

  const seeds = [
    ['chatgpt.com', 0.5],
    ['perplexity.ai', 0.17],
    ['gemini.google.com', 0.13],
    ['claude.ai', 0.11],
    ['copilot.microsoft.com', 0.09],
  ];
  const sources = seeds
    .map(([source, weight]) => ({
      source,
      sessions: Math.max(0, Math.round(sessions * weight * (0.85 + rand() * 0.3))),
      users: 0,
    }))
    .filter((row) => row.sessions > 0);
  const allocated = sources.reduce((sum, row) => sum + row.sessions, 0);
  if (sources.length) sources[0].sessions += Math.max(0, sessions - allocated);
  for (const row of sources) row.users = Math.max(1, Math.round(row.sessions * 0.86));

  const landingPaths = ['/pricing', '/features', '/blog/ga4-vs-plausible', '/', '/docs/getting-started'];
  let left = sessions;
  const landing = [];
  for (let i = 0; i < 4 && left > 0; i++) {
    const share = i === 3 ? 1 : 0.34 + rand() * 0.2;
    const count = Math.max(1, Math.round(left * share));
    left -= count;
    landing.push({
      path: landingPaths[i % landingPaths.length],
      sessions: count,
      engagementRate: 0.45 + rand() * 0.35,
    });
  }

  return { sessions, users: Math.round(sessions * 0.82), sources, landing, channel: 'AI Assistant' };
}

export function demoOverlayData(host = 'example.com', path = '/', rangeKey = '28d') {
  const site = demoSiteReports(host, rangeKey);
  const detail = demoPageDetail(site, path);
  const target = normalizePagePath(path);
  const listed = site.pages.find((page) => normalizePagePath(page.path) === target);
  const page = {
    ...detail,
    title: listed?.title || '',
    views: listed?.views ?? detail.screenPageViews,
    users: listed?.users ?? detail.activeUsers,
    avgDuration: listed?.avgDuration ?? detail.averageSessionDuration,
    engagementRate: listed?.engagementRate ?? detail.engagementRate,
    rank: listed ? site.pages.findIndex((item) => item.path === listed.path) + 1 : null,
    share: (listed?.views || 0) / (site.overview.current.screenPageViews || 1),
  };
  const viewed = Math.max(1, page.views || 1);
  const users = Math.max(1, page.users || 1);
  const count = (name, ratio) => {
    const variance = 0.88 + (hashString(`${host}:${target}:${rangeKey}:${name}`) % 24) / 100;
    return Math.max(1, Math.round(viewed * ratio * variance));
  };
  const events = [
    { name: 'page_view', count: viewed, users },
    { name: 'nav_click', count: count('nav_click', 0.24), users: Math.round(users * 0.48) },
    { name: 'cta_click', count: count('cta_click', 0.18), users: Math.round(users * 0.41) },
    { name: 'plan_select', count: count('plan_select', 0.12), users: Math.round(users * 0.3) },
    { name: 'signup_start', count: count('signup_start', 0.075), users: Math.round(users * 0.21) },
    { name: 'download_click', count: count('download_click', 0.09), users: Math.round(users * 0.26) },
    { name: 'faq_open', count: count('faq_open', 0.052), users: Math.round(users * 0.16) },
    { name: 'footer_click', count: count('footer_click', 0.04), users: Math.round(users * 0.12) },
  ].sort((a, b) => b.count - a.count);
  const eventCount = (name) => events.find((event) => event.name === name)?.count || count(name, 0.05);
  const eventUsers = (name) => events.find((event) => event.name === name)?.users || Math.round(users * 0.14);
  const eventIds = [
    ['hero-cta', 'signup_start'],
    ['plan-starter', 'plan_select'],
    ['plan-team', 'plan_select'],
    ['plan-scale', 'plan_select'],
    ['nav-pricing', 'nav_click'],
    ['footer-contact', 'footer_click'],
  ].map(([id, eventName]) => {
    const count = Math.max(1, Math.round(eventCount(eventName) * (0.18 + (hashString(id) % 28) / 100)));
    const users = Math.min(count, Math.max(1, Math.round(eventUsers(eventName) * (0.2 + (hashString(id) % 22) / 100))));
    return { id, eventName, count, users };
  });

  return {
    page,
    pages: site.pages,
    siteViews: site.overview.current.screenPageViews || 1,
    events,
    eventIds,
    idMapped: true,
    range: site.range,
    warnings: [],
  };
}

export function demoLive(tabTitle = 'Home', host = 'example.com') {
  const titles = [
    tabTitle,
    titleFor('/pricing', 'Pricing', host),
    titleFor('/features', 'Features', host),
    titleFor('/blog/ga4-vs-plausible', 'GA4 vs Plausible', host),
  ];
  const rows = titles
    .filter((title, index, list) => list.indexOf(title) === index)
    .map((title, index) => ({ title, users: Math.max(1, 15 - index * 4) }));
  return {
    total: rows.reduce((acc, row) => acc + row.users, 0),
    rows,
    top: rows,
    scopedByStream: true,
  };
}

export function demoOpenTabs(host, currentPath, rangeKey = '28d') {
  const site = demoSiteReports(host, rangeKey);
  const paths = [...new Set([currentPath || '/', '/pricing', '/blog/ga4-vs-plausible', '/docs/getting-started'])];
  return paths.map((path, index) => {
    const metrics = site.pages.find((p) => p.path === path) || null;
    return {
      id: -(index + 1),
      title: metrics?.title || `${path} · ${host}`,
      url: `https://${host}${path}`,
      path,
      active: index === 0,
      pinned: false,
      windowId: -1,
      demo: true,
      metrics: metrics
        ? { views: metrics.views, users: metrics.users, engagementRate: metrics.engagementRate }
        : null,
    };
  });
}

export function demoFunnel(steps, rangeKey = '28d') {
  const clean = steps.map((step) => normalizePagePath(step));
  const start = 900 + (hashString(clean.join('')) % 700);
  let users = start;
  const result = clean.map((step, index) => {
    if (index > 0) users = Math.round(users * (0.62 + ((hashString(step) % 20) / 100)));
    return {
      index,
      name: `${index + 1}. ${step}`,
      funnelStepName: `${index + 1}. ${step}`,
      activeUsers: users,
      users,
      completionRate: users / start,
      abandonments: index === 0 ? 0 : Math.round(start * 0.1),
      abandonmentRate: index === 0 ? 0 : 0.1,
    };
  });
  return {
    steps: result,
    range: getRange(rangeKey),
    funnel: clean,
    demo: true,
  };
}

const QUERY_SEEDS = [
  // query, impressions weight, position, page
  ['ga4 vs plausible', 0.16, 2.1, '/blog/ga4-vs-plausible'],
  ['how to measure product engagement', 0.12, 6.4, '/blog/how-to-measure-product-engagement'],
  ['{brand}', 0.1, 1.1, '/'],
  ['{brand} pricing', 0.06, 1.3, '/pricing'],
  ['product analytics tool', 0.11, 11.8, '/features'],
  ['engagement rate ga4', 0.09, 8.7, '/blog/how-to-measure-product-engagement'],
  ['plausible alternative', 0.08, 4.6, '/blog/ga4-vs-plausible'],
  ['analytics getting started', 0.05, 3.2, '/docs/getting-started'],
  ['website analytics integrations', 0.06, 14.2, '/integrations'],
  ['{brand} login', 0.03, 1.0, '/signup'],
  ['privacy friendly analytics', 0.07, 17.5, '/features'],
  ['{brand} changelog', 0.02, 1.4, '/changelog'],
];

function demoCtr(position, rand) {
  const curve = [0.31, 0.17, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025, 0.02];
  const base = position > 10.5 ? 0.008 : curve[Math.max(1, Math.round(position)) - 1];
  return base * (0.7 + rand() * 0.6);
}

export function demoSearch(host = 'example.com', url = '', rangeKey = '28d') {
  const rand = mulberry32(hashString(`${host}:search:${rangeKey}`));
  const range = searchRange(rangeKey);
  const brand = host.replace(/^www\./, '').split('.')[0] || 'acme';
  const origin = `https://${host}`;
  const days = range.days;
  const dailyImpressions = 900 + rand() * 1400;

  const trend = [];
  const end = new Date(`${range.current.endDate}T12:00:00`);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end);
    date.setDate(date.getDate() - i);
    const weekend = date.getDay() === 0 || date.getDay() === 6 ? 0.7 : 1;
    const growth = 1 + ((days - i) / days) * 0.1;
    const impressions = Math.round(dailyImpressions * weekend * growth * (0.85 + rand() * 0.3));
    const ctr = 0.034 + rand() * 0.012;
    const clicks = Math.round(impressions * ctr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    trend.push({ date: `${y}-${m}-${d}`, clicks, impressions, ctr: clicks / impressions, position: 7.2 + rand() * 2.4 });
  }

  const totalImpressions = trend.reduce((acc, row) => acc + row.impressions, 0);
  const queries = QUERY_SEEDS.map(([query, weight, position, path]) => {
    const impressions = Math.round(totalImpressions * weight * (0.85 + rand() * 0.3));
    const ctr = demoCtr(position, rand);
    return {
      query: query.replace('{brand}', brand),
      clicks: Math.round(impressions * ctr),
      impressions,
      ctr,
      position: position + (rand() - 0.5) * 0.6,
      path,
    };
  }).sort((a, b) => b.clicks - a.clicks);

  // Search Console hides rare (anonymized) queries, so listed queries account
  // for most, not all, of the site's clicks. Scale the daily clicks to match.
  const queryClicks = queries.reduce((acc, q) => acc + q.clicks, 0);
  const queryImpressions = queries.reduce((acc, q) => acc + q.impressions, 0);
  const targetClicks = Math.round(queryClicks / 0.86);
  const trendClicks = trend.reduce((acc, row) => acc + row.clicks, 0) || 1;
  for (const row of trend) {
    row.clicks = Math.round((row.clicks * targetClicks) / trendClicks);
    row.ctr = row.impressions ? row.clicks / row.impressions : 0;
  }
  const totalClicks = trend.reduce((acc, row) => acc + row.clicks, 0);
  const current = {
    clicks: totalClicks,
    impressions: totalImpressions,
    ctr: totalClicks / totalImpressions,
    position: queries.reduce((acc, q) => acc + q.position * q.impressions, 0) / (queryImpressions || 1) + 1.4,
  };
  const previous = {
    clicks: Math.round(totalClicks * (0.8 + rand() * 0.12)),
    impressions: Math.round(totalImpressions * (0.86 + rand() * 0.1)),
    ctr: current.ctr * 0.94,
    position: current.position + 0.8,
  };

  const byPath = new Map();
  for (const q of queries) {
    const row = byPath.get(q.path) || { url: `${origin}${q.path}`, path: q.path, clicks: 0, impressions: 0, weighted: 0 };
    row.clicks += q.clicks;
    row.impressions += q.impressions;
    row.weighted += q.position * q.impressions;
    byPath.set(q.path, row);
  }
  const pages = [...byPath.values()]
    .map((row) => ({
      url: row.url,
      path: row.path,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.impressions ? row.clicks / row.impressions : 0,
      position: row.impressions ? row.weighted / row.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  // A query can earn clicks on more than one URL; show the primary landing page
  // plus an occasional secondary one so the demo exercises the expandable rows.
  const secondaryPaths = ['/features', '/pricing', '/', '/docs/getting-started'];
  const queryPages = [];
  for (const q of queries) {
    queryPages.push({
      query: q.query,
      url: `${origin}${q.path}`,
      path: q.path,
      host,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
    });
    if (q.clicks >= 20 && rand() > 0.45) {
      const alt = secondaryPaths[Math.floor(rand() * secondaryPaths.length)];
      if (alt && alt !== q.path) {
        const clicks = Math.max(1, Math.round(q.clicks * (0.1 + rand() * 0.15)));
        const impressions = Math.max(clicks * 4, Math.round(q.impressions * 0.18));
        queryPages.push({
          query: q.query,
          url: `${origin}${alt}`,
          path: alt,
          host,
          clicks,
          impressions,
          ctr: clicks / impressions,
          position: 9 + rand() * 6,
        });
      }
    }
  }
  queryPages.sort((a, b) => b.clicks - a.clicks);

  const devices = [
    ['Desktop', 0.58, 7.4],
    ['Mobile', 0.39, 8.9],
    ['Tablet', 0.03, 9.6],
  ].map(([device, share, position]) => ({
    device,
    clicks: Math.round(totalClicks * share),
    impressions: Math.round(totalImpressions * share),
    ctr: current.ctr * (device === 'Mobile' ? 0.88 : 1.06),
    position,
  }));

  const pageUrl = searchPageUrl(url || `${origin}/`);
  const pagePath = normalizePagePath(new URL(pageUrl).pathname);
  const pageQueries = queries
    .filter((q) => normalizePagePath(q.path) === pagePath)
    .map(({ path, ...q }) => q);
  const pageRow = pages.find((row) => normalizePagePath(row.path) === pagePath);
  const pageCurrent = pageRow
    ? { clicks: pageRow.clicks, impressions: pageRow.impressions, ctr: pageRow.ctr, position: pageRow.position }
    : { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  const cleanQueries = queries.map(({ path, ...q }) => q);
  return {
    site: {
      range,
      current,
      previous,
      trend,
      queries: cleanQueries,
      pages,
      queryPages,
      devices,
      opportunities: searchOpportunities(cleanQueries),
      warnings: [],
    },
    page: {
      url: pageUrl,
      current: pageCurrent,
      previous: {
        clicks: Math.round(pageCurrent.clicks * 0.86),
        impressions: Math.round(pageCurrent.impressions * 0.9),
        ctr: pageCurrent.ctr * 0.96,
        position: pageCurrent.position + 0.7,
      },
      queries: pageQueries,
    },
    inspection: {
      verdict: pageRow ? 'PASS' : 'NEUTRAL',
      coverageState: pageRow ? 'Submitted and indexed' : 'Discovered - currently not indexed',
      indexingState: 'INDEXING_ALLOWED',
      robotsTxtState: 'ALLOWED',
      pageFetchState: pageRow ? 'SUCCESSFUL' : 'PAGE_FETCH_STATE_UNSPECIFIED',
      lastCrawlTime: pageRow ? new Date(Date.now() - 3 * 86400000).toISOString() : '',
      crawledAs: 'MOBILE',
      googleCanonical: pageRow ? pageUrl : '',
      userCanonical: pageUrl,
      referringUrls: [],
      richResults: '',
      link: '',
    },
  };
}
