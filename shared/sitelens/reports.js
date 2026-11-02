// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.
// GA4 report definitions + lightweight aggregation.
// Everything here is pure data-in/data-out so it can be unit tested.

import { runReport, runRealtimeReport, runFunnelReport, GaApiError } from './ga4.js';
import { baseDomain, normalizePagePath, stripTrailingSlash } from './site.js';
import { formatDate } from './format.js';

export const RANGE_OPTIONS = [
  // Live ranges: the panel auto-refreshes these every 60s because today's
  // numbers keep moving. `week` is calendar week-to-date (Monday first).
  { key: 'today', label: 'Today', title: 'Today so far', days: 1, live: true, hourly: true },
  { key: 'week', label: 'Week', title: 'This week so far', days: 0, live: true },
  { key: '7d', label: '7d', title: 'Last 7 days', days: 7 },
  { key: '28d', label: '28d', title: 'Last 28 days', days: 28 },
  { key: '90d', label: '90d', title: 'Last 90 days', days: 90 },
];

const CORE_METRICS = [
  'activeUsers',
  'newUsers',
  'sessions',
  'screenPageViews',
  'engagementRate',
  'averageSessionDuration',
  'keyEvents',
];

const CORE_METRICS_NO_KEY_EVENTS = CORE_METRICS.filter((m) => m !== 'keyEvents');

export function getRange(key, now = new Date()) {
  const option =
    RANGE_OPTIONS.find((r) => r.key === key) || RANGE_OPTIONS.find((r) => r.key === '28d');

  // Today is a partial day, so the trend switches to hourly buckets and the
  // previous period is yesterday (the same partial-day comparison GA4 shows).
  if (option.key === 'today') {
    const label = formatDate(now, { withYear: true });
    return {
      ...option,
      days: 1,
      current: { startDate: 'today', endDate: 'today' },
      previous: { startDate: 'yesterday', endDate: 'yesterday' },
      startLabel: label,
      endLabel: label,
    };
  }

  // Week-to-date: Monday 00:00 through today, with a length-matched previous
  // window (last Monday through the same weekday) so the deltas stay fair.
  if (option.key === 'week') {
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    const days = dow + 1;
    const start = new Date(now);
    start.setDate(start.getDate() - dow);
    return {
      ...option,
      days,
      current: { startDate: `${days - 1}daysAgo`, endDate: 'today' },
      previous: { startDate: `${days * 2 - 1}daysAgo`, endDate: `${days}daysAgo` },
      startLabel: formatDate(start, { withYear: true }),
      endLabel: formatDate(now, { withYear: true }),
    };
  }

  const { days } = option;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  const prevEnd = new Date(now);
  prevEnd.setDate(prevEnd.getDate() - days);
  const prevStart = new Date(now);
  prevStart.setDate(prevStart.getDate() - (days * 2 - 1));
  return {
    ...option,
    current: { startDate: `${days - 1}daysAgo`, endDate: 'today' },
    previous: { startDate: `${days * 2 - 1}daysAgo`, endDate: `${days}daysAgo` },
    startLabel: formatDate(start, { withYear: true }),
    endLabel: formatDate(now, { withYear: true }),
  };
}

export function hostFilter(host, { includeSubdomains = false, filterValue = '' } = {}) {
  const value = includeSubdomains ? filterValue || baseDomain(host) : host;
  return {
    filter: {
      fieldName: 'hostName',
      stringFilter: {
        matchType: includeSubdomains ? 'CONTAINS' : 'EXACT',
        value,
        caseSensitive: false,
      },
    },
  };
}

export function pathFilter(path) {
  return {
    filter: {
      fieldName: 'pagePath',
      stringFilter: { matchType: 'EXACT', value: normalizePagePath(path), caseSensitive: true },
    },
  };
}

function andFilter(...expressions) {
  const list = expressions.filter(Boolean);
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  return { andGroup: { expressions: list } };
}

function orFilter(...expressions) {
  const list = expressions.filter(Boolean);
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  return { orGroup: { expressions: list } };
}

function metric(name) {
  return { name };
}

function dim(name) {
  return { name };
}

function orderByMetric(name, desc = true) {
  return { metric: { metricName: name }, desc };
}

function orderByDimension(name, desc = false) {
  return { dimension: { dimensionName: name }, desc };
}

/* ---------- public report fetchers ---------- */

export async function fetchOverview({ token, propertyId, host, includeSubdomains, filterValue, rangeKey, path = '' }) {
  const range = getRange(rangeKey);
  const filter = path
    ? andFilter(hostFilter(host, { includeSubdomains, filterValue }), pathFilter(path))
    : hostFilter(host, { includeSubdomains, filterValue });

  const base = {
    dimensionFilter: filter,
    limit: 1,
  };

  const run = (metrics, dateRange) =>
    runReport({
      token,
      propertyId,
      body: { ...base, dateRanges: [dateRange], metrics: metrics.map(metric) },
    });

  const pick = (report) => report.rows[0] || report.totals[0] || {};

  let current;
  let previous;
  try {
    [current, previous] = await Promise.all([run(CORE_METRICS, range.current), run(CORE_METRICS, range.previous)]);
  } catch (err) {
    if (err instanceof GaApiError && err.kind === 'schema') {
      [current, previous] = await Promise.all([
        run(CORE_METRICS_NO_KEY_EVENTS, range.current),
        run(CORE_METRICS_NO_KEY_EVENTS, range.previous),
      ]);
    } else {
      throw err;
    }
  }

  return {
    range: {
      key: range.key,
      label: range.label,
      title: range.title,
      days: range.days,
      startLabel: range.startLabel,
      endLabel: range.endLabel,
    },
    current: normalizeMetrics(pick(current)),
    previous: normalizeMetrics(pick(previous)),
  };
}

function normalizeMetrics(row) {
  return {
    activeUsers: Number(row.activeUsers) || 0,
    newUsers: Number(row.newUsers) || 0,
    sessions: Number(row.sessions) || 0,
    screenPageViews: Number(row.screenPageViews) || 0,
    engagementRate: Number(row.engagementRate) || 0,
    averageSessionDuration: Number(row.averageSessionDuration) || 0,
    keyEvents: Number(row.keyEvents) || 0,
  };
}

export async function fetchTrend({ token, propertyId, host, includeSubdomains, filterValue, rangeKey, path = '' }) {
  const range = getRange(rangeKey);
  const hourly = Boolean(range.hourly);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim(hourly ? 'dateHour' : 'date')],
      metrics: [metric('activeUsers'), metric('sessions'), metric('screenPageViews')],
      dimensionFilter: path
        ? andFilter(hostFilter(host, { includeSubdomains, filterValue }), pathFilter(path))
        : hostFilter(host, { includeSubdomains, filterValue }),
      orderBys: [orderByDimension(hourly ? 'dateHour' : 'date')],
      limit: 400,
    },
  });
  return report.rows.map((row) => {
    const values = {
      activeUsers: Number(row.activeUsers) || 0,
      sessions: Number(row.sessions) || 0,
      screenPageViews: Number(row.screenPageViews) || 0,
    };
    if (!hourly) {
      return { date: row.date, ...values };
    }
    // dateHour arrives as YYYYMMDDHH. Keep the day for the tooltip and add a
    // readable hour label so the axis does not show 24 identical dates.
    const raw = String(row.dateHour || '');
    const hour = Number(raw.slice(8, 10)) || 0;
    return {
      date: raw.slice(0, 8),
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      ...values,
    };
  });
}

// Same daily series, narrowed to one pagePath — powers the trend chart in the
// page deep-dive.
export function fetchPageTrend(args) {
  return fetchTrend(args);
}

export async function fetchTopPages({ token, propertyId, host, includeSubdomains, filterValue, rangeKey, limit = 30 }) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('pagePath')],
      metrics: [
        metric('screenPageViews'),
        metric('activeUsers'),
        metric('averageSessionDuration'),
        metric('engagementRate'),
      ],
      dimensionFilter: hostFilter(host, { includeSubdomains, filterValue }),
      orderBys: [orderByMetric('screenPageViews')],
      limit,
    },
  });
  return report.rows.map((row) => ({
    path: row.pagePath || '/',
    views: Number(row.screenPageViews) || 0,
    users: Number(row.activeUsers) || 0,
    avgDuration: Number(row.averageSessionDuration) || 0,
    engagementRate: Number(row.engagementRate) || 0,
  }));
}

export async function fetchChannels({ token, propertyId, host, includeSubdomains, filterValue, rangeKey }) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('sessionDefaultChannelGroup')],
      metrics: [metric('sessions'), metric('activeUsers'), metric('engagementRate')],
      dimensionFilter: hostFilter(host, { includeSubdomains, filterValue }),
      orderBys: [orderByMetric('sessions')],
      limit: 10,
    },
  });
  return report.rows.map((row) => ({
    channel: row.sessionDefaultChannelGroup || 'Unassigned',
    sessions: Number(row.sessions) || 0,
    users: Number(row.activeUsers) || 0,
    engagementRate: Number(row.engagementRate) || 0,
  }));
}

// Referrals from AI assistants (ChatGPT, Perplexity, Claude, Gemini, Copilot…)
// arrive as ordinary referral sessions; this is the only reliable way to see
// them in GA4. Google AI Overviews clicks are still counted as Google organic
// inside Search Console and cannot be separated.
export const AI_REFERRER_SOURCES = [
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'perplexity.ai',
  'www.perplexity.ai',
  'www.chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'bard.google.com',
  'copilot.microsoft.com',
  'you.com',
  'phind.com',
  'poe.com',
  'grok.com',
  'deepseek.com',
  'chat.deepseek.com',
];

// GA4 assigns this channel/medium automatically when a referrer is a known AI
// assistant (rolled out May 2026). Older data and unlisted assistants still
// only show up as referrer domains, so both are combined.
export const AI_CHANNEL_GROUP = 'AI Assistant';
export const AI_MEDIUM = 'ai-assistant';

export async function fetchAiReferrals({ token, propertyId, host, includeSubdomains, filterValue, rangeKey }) {
  const range = getRange(rangeKey);
  const aiTraffic = orFilter(
    {
      filter: {
        fieldName: 'sessionDefaultChannelGroup',
        stringFilter: { matchType: 'EXACT', value: AI_CHANNEL_GROUP, caseSensitive: false },
      },
    },
    {
      filter: {
        fieldName: 'sessionMedium',
        stringFilter: { matchType: 'EXACT', value: AI_MEDIUM, caseSensitive: false },
      },
    },
    {
      filter: {
        fieldName: 'sessionSource',
        inListFilter: { values: AI_REFERRER_SOURCES, caseSensitive: false },
      },
    },
  );
  const dimensionFilter = andFilter(hostFilter(host, { includeSubdomains, filterValue }), aiTraffic);

  const [sources, landing] = await Promise.all([
    runReport({
      token,
      propertyId,
      body: {
        dateRanges: [range.current],
        dimensions: [dim('sessionSource')],
        metrics: [metric('sessions'), metric('activeUsers')],
        dimensionFilter,
        orderBys: [orderByMetric('sessions')],
        limit: 10,
      },
    }),
    runReport({
      token,
      propertyId,
      body: {
        dateRanges: [range.current],
        dimensions: [dim('landingPagePlusQueryString')],
        metrics: [metric('sessions'), metric('engagementRate')],
        dimensionFilter,
        orderBys: [orderByMetric('sessions')],
        limit: 5,
      },
    }),
  ]);

  const sourceRows = sources.rows.map((row) => ({
    source: row.sessionSource || 'unknown',
    sessions: Number(row.sessions) || 0,
    users: Number(row.activeUsers) || 0,
  }));

  return {
    sessions: sourceRows.reduce((sum, row) => sum + row.sessions, 0),
    users: sourceRows.reduce((sum, row) => sum + row.users, 0),
    sources: sourceRows,
    landing: landing.rows.map((row) => ({
      path: row.landingPagePlusQueryString || '/',
      sessions: Number(row.sessions) || 0,
      engagementRate: Number(row.engagementRate) || 0,
    })),
    channel: AI_CHANNEL_GROUP,
  };
}

export async function fetchDevices({ token, propertyId, host, includeSubdomains, filterValue, rangeKey }) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('deviceCategory')],
      metrics: [metric('sessions'), metric('activeUsers'), metric('engagementRate')],
      dimensionFilter: hostFilter(host, { includeSubdomains, filterValue }),
      orderBys: [orderByMetric('sessions')],
      limit: 6,
    },
  });
  return report.rows.map((row) => ({
    device: row.deviceCategory || 'unknown',
    sessions: Number(row.sessions) || 0,
    users: Number(row.activeUsers) || 0,
    engagementRate: Number(row.engagementRate) || 0,
  }));
}

export async function fetchCountries({ token, propertyId, host, includeSubdomains, filterValue, rangeKey }) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('country')],
      metrics: [metric('activeUsers'), metric('sessions')],
      dimensionFilter: hostFilter(host, { includeSubdomains, filterValue }),
      orderBys: [orderByMetric('activeUsers')],
      limit: 8,
    },
  });
  return report.rows.map((row) => ({
    country: row.country || '',
    users: Number(row.activeUsers) || 0,
    sessions: Number(row.sessions) || 0,
  }));
}

export async function fetchEntryPages({ token, propertyId, host, includeSubdomains, filterValue, rangeKey }) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('landingPagePlusQueryString')],
      metrics: [
        metric('sessions'),
        metric('activeUsers'),
        metric('engagementRate'),
        metric('averageSessionDuration'),
      ],
      dimensionFilter: hostFilter(host, { includeSubdomains, filterValue }),
      orderBys: [orderByMetric('sessions')],
      limit: 12,
    },
  });
  return report.rows.map((row) => ({
    path: row.landingPagePlusQueryString || '/',
    sessions: Number(row.sessions) || 0,
    users: Number(row.activeUsers) || 0,
    engagementRate: Number(row.engagementRate) || 0,
    avgDuration: Number(row.averageSessionDuration) || 0,
  }));
}

export async function fetchTransitions({ token, propertyId, host, includeSubdomains, filterValue, rangeKey }) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('pageReferrer'), dim('pagePath')],
      metrics: [metric('screenPageViews')],
      dimensionFilter: hostFilter(host, { includeSubdomains, filterValue }),
      orderBys: [orderByMetric('screenPageViews')],
      limit: 200,
    },
  });
  return report.rows.map((row) => ({
    referrer: row.pageReferrer || '',
    path: row.pagePath || '/',
    count: Number(row.screenPageViews) || 0,
  }));
}

export async function fetchRealtime({ token, propertyId, streamName = '' }) {
  const body = {
    dimensions: [dim('unifiedScreenName')],
    metrics: [metric('activeUsers')],
    limit: 25,
    metricAggregations: ['TOTAL'],
  };
  if (streamName) {
    body.dimensionFilter = {
      filter: {
        fieldName: 'streamName',
        stringFilter: { matchType: 'EXACT', value: streamName, caseSensitive: false },
      },
    };
  }
  const report = await runRealtimeReport({ token, propertyId, body });
  const rows = report.rows
    .map((row) => ({ title: row.unifiedScreenName || 'Untitled', users: Number(row.activeUsers) || 0 }))
    .filter((row) => row.users > 0)
    .sort((a, b) => b.users - a.users);
  const total = Number(report.totals?.[0]?.activeUsers) || rows.reduce((acc, row) => acc + row.users, 0);
  return { total, rows, top: rows.slice(0, 5), scopedByStream: Boolean(streamName) };
}

export function livePageCount(live, title) {
  if (!live || !title) return 0;
  const target = title.trim().toLowerCase();
  return live.rows?.find((row) => row.title.trim().toLowerCase() === target)?.users || 0;
}

export async function fetchPageDetail({ token, propertyId, host, includeSubdomains, filterValue, rangeKey, path }) {
  const overview = await fetchOverview({
    token,
    propertyId,
    host,
    includeSubdomains,
    filterValue,
    rangeKey,
    path,
  });
  return {
    path: normalizePagePath(path),
    ...overview.current,
    previous: overview.previous,
  };
}

/* ---------- on-page event map ---------- */

export async function fetchPageEvents({
  token,
  propertyId,
  host,
  includeSubdomains,
  filterValue,
  rangeKey,
  path,
}) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('eventName')],
      metrics: [metric('eventCount'), metric('activeUsers')],
      dimensionFilter: andFilter(
        hostFilter(host, { includeSubdomains, filterValue }),
        pathFilter(path),
      ),
      orderBys: [orderByMetric('eventCount')],
      limit: 50,
    },
  });
  return report.rows
    .map((row) => ({
      name: row.eventName || '',
      count: Number(row.eventCount) || 0,
      users: Number(row.activeUsers) || 0,
    }))
    .filter((row) => row.name && row.name !== '(not set)' && row.count > 0);
}

// Optional, exact element mapping. Requires a GA4 event-scoped custom
// dimension whose API name is `customEvent:sitelens_id`. If the dimension is
// not registered, GA4 returns a schema error and the overlay falls back to
// event-name matching.
export async function fetchPageEventIds({
  token,
  propertyId,
  host,
  includeSubdomains,
  filterValue,
  rangeKey,
  path,
}) {
  const range = getRange(rangeKey);
  const report = await runReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      dimensions: [dim('eventName'), dim('customEvent:sitelens_id')],
      metrics: [metric('eventCount'), metric('activeUsers')],
      dimensionFilter: andFilter(
        hostFilter(host, { includeSubdomains, filterValue }),
        pathFilter(path),
      ),
      orderBys: [orderByMetric('eventCount')],
      limit: 100,
    },
  });
  return report.rows
    .map((row) => ({
      id: row['customEvent:sitelens_id'] || '',
      eventName: row.eventName || '',
      count: Number(row.eventCount) || 0,
      users: Number(row.activeUsers) || 0,
    }))
    .filter(
      (row) =>
        row.id &&
        row.id !== '(not set)' &&
        row.eventName &&
        row.eventName !== '(not set)' &&
        row.count > 0,
    );
}

/* ---------- journey helpers (pure) ---------- */

export function isSameSiteReferrer(value, host, base) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const refHost = url.hostname.toLowerCase();
    return refHost === host || refHost === base || refHost.endsWith(`.${base}`);
  } catch {
    return false;
  }
}

export function referrerToPath(value, host, base) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const refHost = url.hostname.toLowerCase();
    if (refHost === host || refHost === base || refHost.endsWith(`.${base}`)) {
      return normalizePagePath(url.pathname);
    }
    return `${refHost} ↗`;
  } catch {
    return '';
  }
}

export function buildJourney(transitions, entryPages, host, base) {
  const internal = [];
  const external = [];
  for (const row of transitions || []) {
    const from = referrerToPath(row.referrer, host, base);
    const to = normalizePagePath(row.path);
    if (!from) {
      external.push({ from: 'Direct / no referrer', to, count: row.count });
      continue;
    }
    if (from.startsWith('/')) {
      if (stripTrailingSlash(from) === stripTrailingSlash(to)) continue;
      internal.push({ from, to, count: row.count });
    } else {
      external.push({ from, to, count: row.count });
    }
  }

  const byFrom = new Map();
  for (const flow of internal) {
    const current = byFrom.get(flow.from) || { from: flow.from, total: 0, next: [] };
    current.total += flow.count;
    current.next.push({ to: flow.to, count: flow.count });
    byFrom.set(flow.from, current);
  }
  const flows = [...byFrom.values()]
    .map((flow) => ({
      ...flow,
      next: flow.next.sort((a, b) => b.count - a.count).slice(0, 3),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const entries = (entryPages || []).slice(0, 8);
  const entryMap = new Map(
    entries.map((entry) => [stripTrailingSlash(normalizePagePath(entry.path)), entry.path]),
  );

  return {
    entries,
    flows,
    external: external.sort((a, b) => b.count - a.count).slice(0, 5),
    entryMap: [...entryMap.entries()],
  };
}

/* ---------- funnel ---------- */

export async function fetchFunnel({ token, propertyId, steps, rangeKey, isOpenFunnel = true }) {
  const cleanSteps = (steps || []).map((s) => normalizePagePath(s)).filter(Boolean);
  if (cleanSteps.length < 2) throw new Error('Add at least two pages to build a funnel.');
  if (cleanSteps.length > 5) throw new Error('A funnel can have at most 5 steps.');
  const range = getRange(rangeKey);
  const result = await runFunnelReport({
    token,
    propertyId,
    body: {
      dateRanges: [range.current],
      funnel: {
        isOpenFunnel: Boolean(isOpenFunnel),
        steps: cleanSteps.map((step, index) => ({
          name: `${index + 1}. ${step}`,
          filterExpression: {
            funnelFieldFilter: {
              fieldName: 'pagePath',
              stringFilter: { matchType: 'EXACT', value: step, caseSensitive: true },
            },
          },
        })),
      },
    },
  });
  return {
    steps: result.steps,
    range,
    funnel: cleanSteps,
  };
}

/* ---------- orchestration ---------- */

function isFatal(err) {
  return (
    err instanceof GaApiError &&
    ['auth', 'disabled', 'permission', 'notfound', 'schema'].includes(err.kind)
  );
}

async function retryQuota(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GaApiError && (err.kind === 'quota' || err.kind === 'server')) {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      return fn();
    }
    throw err;
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function fetchSiteReports({
  token,
  propertyId,
  host,
  filterValue,
  includeSubdomains,
  rangeKey,
}) {
  const args = { token, propertyId, host, includeSubdomains, filterValue, rangeKey };
  const tasks = [
    ['overview', () => fetchOverview(args)],
    ['trend', () => fetchTrend(args)],
    ['pages', () => fetchTopPages(args)],
    ['channels', () => fetchChannels(args)],
    ['devices', () => fetchDevices(args)],
    ['countries', () => fetchCountries(args)],
    ['entryPages', () => fetchEntryPages(args)],
    ['transitions', () => fetchTransitions(args)],
  ];

  const warnings = [];
  const results = await mapLimit(tasks, 4, async ([key, run]) => {
    try {
      return [key, await retryQuota(run), null];
    } catch (err) {
      // A partial site report can survive a missing trend or channel, but the
      // headline numbers are required to render the dashboard at all.
      if (isFatal(err) || key === 'overview') throw err;
      warnings.push(`${labelFor(key)}: ${err.message}`);
      return [key, null, err];
    }
  });

  const data = Object.fromEntries(results.map(([key, value]) => [key, value]));
  return {
    range: getRange(rangeKey),
    overview: data.overview,
    trend: data.trend || [],
    pages: data.pages || [],
    channels: data.channels || [],
    devices: data.devices || [],
    countries: data.countries || [],
    entryPages: data.entryPages || [],
    transitions: data.transitions || [],
    warnings,
  };
}

function labelFor(key) {
  return (
    {
      overview: 'Overview',
      trend: 'Traffic trend',
      pages: 'Top pages',
      channels: 'Traffic sources',
      devices: 'Devices',
      countries: 'Countries',
      entryPages: 'Landing pages',
      transitions: 'Journeys',
      live: 'Live users',
    }[key] || key
  );
}

export const _internals = { mapLimit, retryQuota, andFilter, normalizeMetrics };
