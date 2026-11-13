// Data engines. The API engine reuses the extension's report layer verbatim
// (shared/sitelens); the warehouse engine runs sql.mjs on BigQuery, or the
// demo warehouse for the demo site. Both normalize to the same shapes.

import { fetchSiteReports, fetchRealtime, fetchAiReferrals, fetchTrend, fetchOverview, getRange, RANGE_OPTIONS } from '../shared/sitelens/reports.js';
import { fetchSearchReports } from '../shared/sitelens/gsc.js';
import { buildInsights } from '../shared/sitelens/insights.js';
import { demoSiteReports, demoLive, demoAiTraffic, demoPageTrend, demoSearch } from '../shared/sitelens/demo.js';
import * as sql from './sql.mjs';
import * as demo from './demo-warehouse.mjs';
import { createCache } from './cache.mjs';

export class EngineError extends Error {
  constructor(message, { status = 400, kind = 'bad-request', hint = '' } = {}) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.hint = hint;
  }
}

const API_TTL = 5 * 60_000;
const LIVE_TTL = 40_000;
const WAREHOUSE_TTL = 60 * 60_000;
// Past its TTL, a result still shows (up to this age) while a fresh one loads.
const STALE_FOR = 24 * 60 * 60_000;

export function createEngines({ auth, bigquery, cacheDb = null }) {
  const cache = createCache({ db: cacheDb, name: 'engines', staleFor: cacheDb ? STALE_FOR : 0 });
  // Real-time numbers are never shown stale.
  const liveCache = createCache();

  function apiArgs(site, token, rangeKey) {
    if (!site.propertyId) throw new EngineError('Link a GA4 property to this site to see API reports.', { kind: 'needs-property' });
    return {
      token,
      propertyId: site.propertyId,
      host: site.host,
      includeSubdomains: site.includeSubdomains,
      filterValue: '',
      rangeKey,
    };
  }

  /* ---------- API mode (GA4 Data API + Search Console) ---------- */

  async function dashboard(site, rangeKey, { fresh = false } = {}) {
    return cache.wrap(`dash:${site.id}:${rangeKey}`, API_TTL, fresh, async () => {
      if (site.demo) {
        const reports = demoSiteReports(site.host, rangeKey);
        const live = demoLive('Home', site.host);
        const ai = demoAiTraffic(site.host, rangeKey);
        return { reports, live, ai, insights: buildInsights({ ...reports, live }) };
      }
      const token = await auth.token();
      const args = apiArgs(site, token, rangeKey);
      const [reports, live, ai] = await Promise.all([
        fetchSiteReports(args),
        fetchRealtime({ token, propertyId: site.propertyId, streamName: site.streamName }).catch(() => null),
        fetchAiReferrals(args).catch(() => null),
      ]);
      return { reports, live, ai, insights: buildInsights({ ...reports, live }) };
    });
  }

  async function live(site) {
    return liveCache.wrap(`live:${site.id}`, LIVE_TTL, false, async () => {
      if (site.demo) return demoLive('Home', site.host);
      const token = await auth.token();
      return fetchRealtime({ token, propertyId: site.propertyId, streamName: site.streamName });
    });
  }

  async function pageTrend(site, path, rangeKey) {
    return cache.wrap(`page:${site.id}:${rangeKey}:${path}`, API_TTL, false, async () => {
      if (site.demo) return demoPageTrend(demoSiteReports(site.host, rangeKey), path);
      const token = await auth.token();
      return fetchTrend({ ...apiArgs(site, token, rangeKey), path });
    });
  }

  async function search(site, rangeKey, { fresh = false } = {}) {
    return cache.wrap(`search:${site.id}:${rangeKey}`, API_TTL, fresh, async () => {
      if (site.demo) return demoSearch(site.host, `https://${site.host}/`, rangeKey).site;
      if (!site.searchSite) throw new EngineError('Pick a Search Console property for this site in Settings.', { kind: 'needs-search' });
      const token = await auth.token();
      return fetchSearchReports({
        token,
        siteUrl: site.searchSite,
        host: site.host,
        includeSubdomains: site.includeSubdomains,
        rangeKey,
      });
    });
  }

  // Portfolio: headline numbers + trend for every site, partial failures allowed.
  async function portfolio(sites, rangeKey) {
    return Promise.all(
      sites.map(async (site) => {
        try {
          if (site.demo) {
            const r = demoSiteReports(site.host, rangeKey);
            return { id: site.id, overview: r.overview, trend: r.trend };
          }
          if (!site.propertyId) return { id: site.id, error: 'No GA4 property linked.' };
          return await cache.wrap(`port:${site.id}:${rangeKey}`, API_TTL, false, async () => {
            const token = await auth.token();
            const args = apiArgs(site, token, rangeKey);
            const [overview, trend] = await Promise.all([fetchOverview(args), fetchTrend(args)]);
            return { id: site.id, overview, trend };
          });
        } catch (err) {
          return { id: site.id, error: err.message, kind: err.kind || '' };
        }
      }),
    );
  }

  /* ---------- Warehouse mode (GA4 BigQuery export) ---------- */

  function requireBq(site) {
    if (!site.bq) {
      throw new EngineError('Connect this site’s GA4 BigQuery export in Settings to unlock event-level analysis.', {
        kind: 'needs-warehouse',
      });
    }
    // The site's leave-out rule travels with its BigQuery settings into every query.
    return site.leaveOut ? { ...site.bq, leaveOut: site.leaveOut } : site.bq;
  }

  // Resolves which export tables cover the range. Listing tables is free metadata;
  // if it fails (e.g. list permission missing) fall back to the daily-table range.
  async function rangeFor(site, rangeKey) {
    if (site.demo) return sql.warehouseRange(rangeKey);
    const bq = requireBq(site);
    const range = sql.warehouseRange(rangeKey, { endDate: bq.endDate || '' });
    // Session views on a rollup table filter by session_date, not by export tables.
    if (bq.sessionsTable) return range;
    try {
      const tables = await cache.wrap(`tables:${site.id}`, 10 * 60_000, false, () =>
        bigquery.listTables({ project: bq.dataProject || bq.billingProject, dataset: bq.dataset }));
      const plan = sql.planSuffixes(tables, range);
      if (!plan.suffixes.length) {
        throw new EngineError(`No GA4 export tables between ${range.startDate} and ${range.endDate} in ${bq.dataset}.`, {
          kind: 'no-data',
          hint: tables.some((t) => t.startsWith('events_'))
            ? 'Pick a longer range, or check the fixed end date in this site’s settings.'
            : 'The dataset has no events_* tables yet. The first export appears within a day of linking GA4 to BigQuery.',
        });
      }
      return { ...range, ...plan };
    } catch (err) {
      if (err instanceof EngineError || err.kind === 'auth') throw err;
      return range;
    }
  }

  // Analyses that read raw events (not the rollup) always need the table plan.
  const eventsRange = (site, rangeKey) => rangeFor({ ...site, bq: site.bq && { ...site.bq, sessionsTable: '' } }, rangeKey);

  async function run(site, built, { ttl = WAREHOUSE_TTL, fresh = false, maxBytes } = {}) {
    const bq = requireBq(site);
    const key = `bq:${site.id}:${built.sql}:${JSON.stringify(built.params)}`;
    return cache.wrap(key, ttl, fresh, () =>
      bigquery.query({
        project: bq.billingProject,
        sql: built.sql,
        params: built.params,
        location: bq.location,
        maxBytes: maxBytes || bq.maxBytes,
      }),
    );
  }

  function meta(site, range, results = []) {
    const list = results.filter(Boolean);
    return {
      range,
      source: site.demo ? 'demo' : site.bq?.sessionsTable ? 'rollup' : 'bigquery',
      bytes: list.reduce((acc, r) => acc + (r.bytes || 0), 0),
      cacheHit: list.length > 0 && list.every((r) => r.cacheHit),
      ms: list.reduce((acc, r) => acc + (r.ms || 0), 0),
    };
  }

  async function paths(site, rangeKey, options, flags) {
    const range = await rangeFor(site, rangeKey);
    if (site.demo) {
      const { rows, exits, total } = demo.demoPaths(range, options);
      return { ...meta(site, range), total, edges: normalizeEdges(rows), exits: normalizeExits(exits) };
    }
    const built = sql.pathsSql(requireBq(site), range, options);
    const [edges, exits] = await Promise.all([run(site, built, flags), run(site, built.exits, flags)]);
    return {
      ...meta(site, range, [edges, exits]),
      total: Number(exits.rows[0]?.total) || 0,
      edges: normalizeEdges(edges.rows),
      exits: normalizeExits(exits.rows),
    };
  }

  async function funnel(site, rangeKey, steps, flags) {
    const clean = (Array.isArray(steps) ? steps : [])
      .map((s) => ({ kind: s.kind === 'event' ? 'event' : 'page', value: String(s.value || '').trim().slice(0, 200) }))
      .filter((s) => s.value);
    if (clean.length < 2) throw new EngineError('Add at least two funnel steps.');
    if (clean.length > 8) throw new EngineError('Funnels support up to eight steps.');
    const range = await rangeFor(site, rangeKey);
    let row;
    let result = null;
    if (site.demo) row = demo.demoFunnel(range, clean);
    else {
      result = await run(site, sql.funnelSql(requireBq(site), range, clean), flags);
      row = result.rows[0] || {};
    }
    const first = Number(row.step_0) || 0;
    return {
      ...meta(site, range, [result]),
      steps: clean.map((step, i) => {
        const sessions = Number(row[`step_${i}`]) || 0;
        const prev = i === 0 ? sessions : Number(row[`step_${i - 1}`]) || 0;
        return {
          ...step,
          sessions,
          rate: first ? sessions / first : 0,
          stepRate: prev ? sessions / prev : 0,
          avgSeconds: i === 0 ? null : row[`avg_seconds_${i}`] ?? null,
        };
      }),
    };
  }

  // Per session, when each non-automatic event first fired; see funnel-suggest.mjs.
  async function funnelDiscovery(site, rangeKey, flags) {
    const range = await rangeFor(site, rangeKey);
    if (site.demo) return { meta: meta(site, range), sessions: demo.demoFunnelDiscovery(range) };
    const result = await run(site, sql.funnelDiscoverySql(requireBq(site), range), flags);
    return {
      meta: meta(site, range, [result]),
      sessions: result.rows.map((r) => ({ landing: r.landing || '', start: Number(r.started_at), events: (r.firsts || []).map((f) => ({ name: f.name, ts: Number(f.ts) })) })),
    };
  }

  async function cohorts(site, rangeKey, flags) {
    const range = await rangeFor(site, rangeKey);
    let rows;
    let result = null;
    if (site.demo) rows = demo.demoCohorts(range);
    else {
      result = await run(site, sql.cohortsSql(requireBq(site), range), flags);
      rows = result.rows.map((r) => ({ ...r, cohort: String(r.cohort) }));
    }
    // The export can start after the range does: say from when, and mark the
    // week the data starts in as partial.
    const first = range.firstDay ? `${range.firstDay.slice(0, 4)}-${range.firstDay.slice(4, 6)}-${range.firstDay.slice(6, 8)}` : '';
    return { ...meta(site, range, [result]), dataFrom: first, cohorts: normalizeCohorts(rows, first) };
  }

  async function sessions(site, rangeKey, options, flags) {
    const range = await rangeFor(site, rangeKey);
    let rows;
    let result = null;
    if (site.demo) rows = demo.demoSessionsList(range, options);
    else {
      result = await run(site, sql.sessionsListSql(requireBq(site), range, options), flags);
      rows = result.rows;
    }
    return {
      ...meta(site, range, [result]),
      sessions: rows.map((r) => ({
        user: r.user_id,
        sessionId: String(r.session_id),
        startedAt: Math.round(Number(r.started_at) / 1000),
        durationSec: Math.max(0, Math.round((Number(r.ended_at) - Number(r.started_at)) / 1e6)),
        pages: r.pages || [],
        pageCount: Number(r.page_count) || 0,
        eventCount: Number(r.event_count) || 0,
        conversions: Number(r.conversions) || 0,
        device: r.device || '',
        country: r.country || '',
        source: r.source || '',
        medium: r.medium || '',
        visitSource: r.visit_source || '',
        system: r.system || '',
        browser: r.browser && r.browser !== '(not set)' ? r.browser : '',
        returning: Boolean(r.returning),
      })),
    };
  }

  // The totals and top lists behind the sessions list (same filters).
  async function sessionsSummary(site, rangeKey, options, flags) {
    const range = await rangeFor(site, rangeKey);
    if (site.demo) return { ...meta(site, range), summary: null };
    const result = await run(site, sql.sessionsSummarySql(requireBq(site), range, options), flags);
    const r = result.rows[0] || {};
    const top = (list) => (list || []).filter((f) => f && f.value != null).map((f) => ({ name: String(f.value), n: Number(f.count) || 0 }));
    const num = (v) => Number(v) || 0;
    const lists = {};
    for (const k of ['landing', 'exit', 'source', 'system', 'browser', 'country']) {
      const conv = Object.fromEntries(top(r[`conv_${k}`]).map((x) => [x.name, x.n]));
      lists[k] = top(r[`top_${k}`]).map((x) => ({ ...x, converted: conv[x.name] || 0 }));
    }
    return {
      ...meta(site, range, [result]),
      summary: {
        sessions: num(r.sessions), people: num(r.people), returning: num(r.returning),
        onePage: num(r.one_page), quick: num(r.quick), medianSec: Math.round(num(r.median_us) / 1e6),
        converted: num(r.converted), convertedReturning: num(r.converted_returning),
        ...lists,
      },
    };
  }

  async function events(site, rangeKey, flags) {
    const range = await eventsRange(site, rangeKey);
    if (site.demo) return { ...meta(site, range), events: demo.demoEventsCatalog(range).map(eventRow) };
    const result = await run(site, sql.eventsCatalogSql(requireBq(site), range), flags);
    return { ...meta(site, range, [result]), events: result.rows.map(eventRow) };
  }

  // Journeys by source × landing page; step counts come back as a map.
  async function journeys(site, rangeKey, goals, flags) {
    const range = await rangeFor(site, rangeKey);
    if (site.demo) return { ...meta(site, range), journeys: [], systems: [] };
    const bq = requireBq(site);
    const built = sql.journeysSql(bq, range, goals);
    const [result, summary] = await Promise.all([run(site, built, flags), run(site, sql.journeysSummarySql(bq, range, goals), flags)]);
    const top = (list) => Object.fromEntries((list || []).filter((f) => f && f.value != null).map((f) => [String(f.value), Number(f.count) || 0]));
    return {
      ...meta(site, range, [result, summary]),
      // Every visit in the period, by system × browser (not only the listed journeys).
      systems: summary.rows.map((r) => ({
        name: r.grp, browser: r.browser, sessions: Number(r.sessions) || 0, engaged: Number(r.engaged) || 0,
        converted: Number(r.converted) || 0, noReferrer: Number(r.no_referrer) || 0,
      })),
      journeys: result.rows.map((r) => ({
        source: r.source, medium: r.medium, landing: r.landing,
        sessions: Number(r.sessions) || 0, engaged: Number(r.engaged) || 0, converted: Number(r.converted) || 0,
        steps: Object.fromEntries(built.steps.map((name, i) => [name, Number(r[`step_${i}`]) || 0])),
        systems: top(r.systems),
        systemsConverted: top(r.systems_converted),
        browsers: top(r.browsers),
        browsersConverted: top(r.browsers_converted),
        firstSources: (r.first_sources || []).filter((f) => f && f.value != null).map((f) => ({ source: String(f.value), n: Number(f.count) || 0 })),
      })),
    };
  }

  // How many sessions the leave-out rule removes from the BigQuery views.
  async function leftOut(site, rangeKey, flags) {
    const range = await eventsRange(site, rangeKey);
    if (site.demo || !site.leaveOut?.countries?.length) return { ...meta(site, range), rule: site.leaveOut || null, total: 0, leftOut: 0 };
    const result = await run(site, sql.leftOutSql(requireBq(site), range), flags);
    const row = result.rows[0] || {};
    return { ...meta(site, range, [result]), rule: site.leaveOut, total: Number(row.total) || 0, leftOut: Number(row.left_out) || 0 };
  }

  // Sessions that reached a step but didn't convert, by device and system.
  async function leavers(site, rangeKey, goals, flags) {
    const range = await eventsRange(site, rangeKey);
    if (site.demo) return { ...meta(site, range), groups: [] };
    const result = await run(site, sql.leaversSql(requireBq(site), range, goals), flags);
    return { ...meta(site, range, [result]), groups: leaverGroups(result.rows) };
  }

  async function eventDetail(site, rangeKey, name, flags) {
    if (!name) throw new EngineError('Pick an event.');
    const range = await eventsRange(site, rangeKey);
    if (site.demo) return { ...meta(site, range), event: name, ...demo.demoEventDetail(range, name) };
    const built = sql.eventDetailSql(requireBq(site), range, name);
    const [keys, trend] = await Promise.all([run(site, built.keys, flags), run(site, built.trend, flags)]);
    return { ...meta(site, range, [keys, trend]), event: name, keys: keys.rows, trend: trend.rows };
  }

  async function breakdown(site, rangeKey, name, key, flags) {
    if (!name || !key) throw new EngineError('Pick an event and a parameter.');
    const range = await eventsRange(site, rangeKey);
    if (site.demo) return { ...meta(site, range), event: name, key, values: demo.demoParamBreakdown(range, name, key) };
    const result = await run(site, sql.paramBreakdownSql(requireBq(site), range, name, key), flags);
    return { ...meta(site, range, [result]), event: name, key, values: result.rows };
  }

  async function consoleQuery(site, rangeKey, text, { confirmBytes = 0 } = {}) {
    if (site.demo) {
      throw new EngineError('The SQL console runs on BigQuery. Connect a dataset — Google’s public GA4 sample works — to try it.', {
        kind: 'needs-warehouse',
      });
    }
    const bq = requireBq(site);
    const range = await eventsRange(site, rangeKey);
    let built;
    try {
      built = sql.expandConsoleSql(bq, range, text);
    } catch (err) {
      throw new EngineError(err.message);
    }
    // The user may approve one specific over-cap scan size, never an open-ended one.
    const maxBytes = confirmBytes > bq.maxBytes ? confirmBytes : bq.maxBytes;
    const result = await bigquery.query({ project: bq.billingProject, sql: built.sql, params: built.params, location: bq.location, maxBytes });
    return { ...meta(site, range, [result]), columns: result.columns, rows: result.rows.slice(0, 2000), truncated: result.truncated || result.rows.length > 2000, sql: built.sql };
  }

  async function estimate(site, rangeKey, text) {
    const bq = requireBq(site);
    const built = sql.expandConsoleSql(bq, await eventsRange(site, rangeKey), text);
    const plan = await bigquery.dryRun({ project: bq.billingProject, sql: built.sql, params: built.params, location: bq.location });
    return { ...plan, cap: bq.maxBytes };
  }

  async function rollup(site, rangeKey = '90d') {
    const bq = requireBq(site);
    const range = await eventsRange(site, rangeKey);
    const built = sql.rollupSql(bq, range);
    await bigquery.ensureDataset?.({ project: built.target.project, dataset: built.target.dataset, location: bq.location });
    const result = await bigquery.query({
      project: bq.billingProject,
      sql: built.sql,
      params: built.params,
      location: bq.location,
      maxBytes: bq.maxBytes,
      allowedTypes: ['CREATE_TABLE_AS_SELECT'],
    });
    cache.clear(`bq:${site.id}:`);
    const table = `${built.target.project}.${built.target.dataset}.${built.target.table}`;
    const count = await bigquery.query({
      project: bq.billingProject,
      sql: `SELECT COUNT(*) AS sessions FROM \`${table}\``,
      location: bq.location,
      maxBytes: bq.maxBytes,
    });
    return { table, range, bytes: result.bytes, sessions: Number(count.rows[0]?.sessions) || 0 };
  }

  return {
    ranges: { api: RANGE_OPTIONS.map(({ key, label, title }) => ({ key, label, title })), warehouse: sql.WAREHOUSE_RANGES },
    getRange,
    dashboard,
    live,
    pageTrend,
    search,
    portfolio,
    paths,
    funnel,
    funnelDiscovery,
    cohorts,
    leavers,
    leftOut,
    journeys,
    sessions,
    sessionsSummary,
    events,
    eventDetail,
    breakdown,
    consoleQuery,
    estimate,
    rollup,
    clearSite: (id) => cache.clear(`:${id}:`),
  };
}

function eventRow(r) {
  return { name: r.event_name, events: Number(r.events) || 0, users: Number(r.users) || 0 };
}

function normalizeEdges(rows) {
  return rows.map((r) => ({ step: Number(r.step), from: r.from_path, to: r.to_path, sessions: Number(r.sessions) || 0 }));
}

function normalizeExits(rows) {
  return rows.map((r) => ({ page: r.page, views: Number(r.views) || 0, exits: Number(r.exits) || 0 }));
}

// Rows from leaversSql → one entry per group, biggest first, steps as a map.
export function leaverGroups(rows) {
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(r.grp) || { group: r.grp, left: 0, quick: 0, converted: 0, steps: {} };
    if (r.step) g.steps[r.step] = Number(r.n) || 0;
    else Object.assign(g, { left: Number(r.n) || 0, quick: Number(r.quick) || 0, converted: Number(r.converted) || 0 });
    groups.set(r.grp, g);
  }
  return [...groups.values()].filter((g) => g.left || g.converted).sort((a, b) => b.left - a.left);
}

// Cohorts by week of first visit. A cohort with no new users in range (people
// first seen before the data starts, coming back now) is dropped: it has no base.
export function normalizeCohorts(rows, dataFrom = '') {
  const map = new Map();
  for (const r of rows) {
    const cohort = String(r.cohort).slice(0, 10);
    const entry = map.get(cohort) || { cohort, size: 0, cells: [] };
    const users = Number(r.users) || 0;
    if (Number(r.week_offset) === 0) entry.size = users;
    entry.cells[Number(r.week_offset)] = users;
    map.set(cohort, entry);
  }
  return [...map.values()]
    .filter((c) => c.size > 0)
    .sort((a, b) => a.cohort.localeCompare(b.cohort))
    .map((c) => ({
      cohort: c.cohort,
      size: c.size,
      partial: Boolean(dataFrom) && c.cohort < dataFrom,
      cells: Array.from({ length: c.cells.length }, (_, i) => ({
        offset: i,
        users: c.cells[i] || 0,
        rate: c.size ? (c.cells[i] || 0) / c.size : 0,
      })),
    }));
}
