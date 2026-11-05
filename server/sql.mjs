// SQL builders for the GA4 BigQuery export. Pure functions: (site.bq, range,
// options) → { sql, params }. User-supplied values always travel as named
// parameters; identifiers and dates are validated before they are inlined.
//
// Every analysis is written against one `sessions` shape:
//   user_id, session_id, session_date, first_touch_date, started_at, ended_at,
//   device, country, source, medium, pages ARRAY<STRING>,
//   seq ARRAY<STRUCT<k STRING, ts INT64>>   -- 'page:/pricing' | 'event:sign_up'
// It comes from raw events, or from the table `rollupSql` materializes.

const IDENT = /^[A-Za-z0-9_.:$-]+$/;
const YMD = /^\d{8}$/;

function ident(...parts) {
  for (const part of parts) {
    if (!part || !IDENT.test(part)) throw new Error(`Invalid BigQuery identifier: ${part}`);
  }
  return `\`${parts.join('.')}\``;
}

function ymdToIso(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function ymd(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export const WAREHOUSE_RANGES = [
  { key: '7d', label: '7d', days: 7 },
  { key: '28d', label: '28d', days: 28 },
  { key: '90d', label: '90d', days: 90 },
];

// The daily export lands the next day, so ranges end yesterday — or at a fixed
// endDate for static datasets such as Google's public GA4 sample.
export function warehouseRange(rangeKey = '28d', { endDate = '', now = new Date() } = {}) {
  const option = WAREHOUSE_RANGES.find((r) => r.key === rangeKey) || WAREHOUSE_RANGES[1];
  const end = endDate ? new Date(`${endDate}T12:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  const start = new Date(end);
  start.setDate(start.getDate() - (option.days - 1));
  const range = { key: option.key, days: option.days, start: ymd(start), end: ymd(end) };
  return { ...range, startDate: ymdToIso(range.start), endDate: ymdToIso(range.end), fixedEnd: Boolean(endDate) };
}

export function eventsTable(bq) {
  return `${ident(bq.dataProject || bq.billingProject, bq.dataset).slice(0, -1)}.events_*\``;
}

const SUFFIX = /^(intraday_)?\d{8}$/;

// For each day in the range, pick the daily table when it exists, else the
// streaming export's intraday table — never both, so no day is double counted.
// tableIds: table names in the dataset (events_20261022, events_intraday_20261023…).
export function planSuffixes(tableIds, range) {
  const daily = new Set();
  const intraday = new Set();
  for (const id of tableIds) {
    const m = /^events_(intraday_)?(\d{8})$/.exec(id);
    if (!m || m[2] < range.start || m[2] > range.end) continue;
    (m[1] ? intraday : daily).add(m[2]);
  }
  const days = [...new Set([...daily, ...intraday])].sort();
  const suffixes = days.map((d) => (daily.has(d) ? d : `intraday_${d}`));
  return {
    suffixes,
    dailyDays: days.filter((d) => daily.has(d)).length,
    intradayDays: days.filter((d) => !daily.has(d)).length,
    firstDay: days[0] || '',
    lastDay: days.at(-1) || '',
  };
}

export function eventFilter(bq, range, { stream = true } = {}) {
  if (!YMD.test(range.start) || !YMD.test(range.end)) throw new Error('Invalid range');
  // Date-sharded tables prune on _TABLE_SUFFIX only when it is compared to constants.
  let clause = `_TABLE_SUFFIX BETWEEN '${range.start}' AND '${range.end}'`;
  if (Array.isArray(range.suffixes)) {
    if (!range.suffixes.every((x) => SUFFIX.test(x))) throw new Error('Invalid table suffix');
    clause = range.suffixes.length ? `_TABLE_SUFFIX IN (${range.suffixes.map((x) => `'${x}'`).join(', ')})` : 'FALSE';
  }
  const clauses = [clause];
  if (stream && bq.streamId) clauses.push(`stream_id = @stream_id`);
  return clauses.join('\n    AND ');
}

function baseParams(bq) {
  return bq.streamId ? { stream_id: String(bq.streamId) } : {};
}

const PATH_OF = (expr) => `IFNULL(REGEXP_EXTRACT(${expr}, r'^https?://[^/?#]+(/[^?#]*)'), '/')`;
const PARAM = (key, kind = 'string_value') => `(SELECT value.${kind} FROM UNNEST(event_params) WHERE key = '${key}')`;

export function sessionsFromEvents(bq, range) {
  return `SELECT
    user_id, session_id, session_date, first_touch_date, started_at, ended_at,
    device, country, source, medium,
    -- Collapse reloads: drop a page view that repeats the previous one.
    ARRAY(
      SELECT p FROM UNNEST(raw_pages) AS p WITH OFFSET o
      WHERE o = 0 OR p != raw_pages[SAFE_OFFSET(o - 1)]
      ORDER BY o
    ) AS pages,
    seq
  FROM (
    SELECT
      user_id,
      session_id,
      MIN(event_date) AS session_date,
      DATE(TIMESTAMP_MICROS(MIN(first_touch))) AS first_touch_date,
      MIN(ts) AS started_at,
      MAX(ts) AS ended_at,
      ANY_VALUE(device) AS device,
      ANY_VALUE(country) AS country,
      ANY_VALUE(source) AS source,
      ANY_VALUE(medium) AS medium,
      ARRAY_AGG(IF(event_name = 'page_view', path, NULL) IGNORE NULLS ORDER BY ts) AS raw_pages,
      ARRAY_AGG(STRUCT(
        IF(event_name = 'page_view', CONCAT('page:', path), CONCAT('event:', event_name)) AS k,
        ts AS ts
      ) ORDER BY ts LIMIT 500) AS seq
    FROM (
      SELECT
        user_pseudo_id AS user_id,
        ${PARAM('ga_session_id', 'int_value')} AS session_id,
        PARSE_DATE('%Y%m%d', event_date) AS event_date,
        user_first_touch_timestamp AS first_touch,
        event_timestamp AS ts,
        event_name,
        ${PATH_OF(PARAM('page_location'))} AS path,
        device.category AS device,
        geo.country AS country,
        traffic_source.source AS source,
        traffic_source.medium AS medium
      FROM ${eventsTable(bq)}
      WHERE ${eventFilter(bq, range)}
    )
    WHERE session_id IS NOT NULL
    GROUP BY user_id, session_id
  )`;
}

// The materialized table (see rollupSql) replaces the raw scan when configured.
function sessionsSource(bq, range) {
  if (bq.sessionsTable) {
    const [project, dataset, table] = bq.sessionsTable.split('.');
    return `SELECT * FROM ${ident(project, dataset, table)}
    WHERE session_date BETWEEN DATE '${ymdToIso(range.start)}' AND DATE '${ymdToIso(range.end)}'`;
  }
  return sessionsFromEvents(bq, range);
}

function withSessions(bq, range, body, ctes = []) {
  const extra = ctes.map((cte) => `,\n${cte}`).join('');
  return `WITH sessions AS (\n  ${sessionsSource(bq, range)}\n)${extra}\n${body}`;
}

// The raw scan filters stream_id; a materialized table was already built for one stream.
function sessionParams(bq) {
  return bq.sessionsTable ? {} : baseParams(bq);
}

/* ---------- analyses ---------- */

export function pathsSql(bq, range, { depth = 4, startPath = '', top = 12 } = {}) {
  const sql = withSessions(
    bq,
    range,
    `SELECT step, from_path, to_path, COUNT(*) AS sessions
FROM (
  SELECT i AS step, p AS from_path, IFNULL(pages[SAFE_OFFSET(i + 1)], '(exit)') AS to_path
  FROM sessions, UNNEST(pages) AS p WITH OFFSET i
  WHERE i < @depth AND (@start_path = '' OR pages[SAFE_OFFSET(0)] = @start_path)
)
GROUP BY step, from_path, to_path
QUALIFY ROW_NUMBER() OVER (PARTITION BY step ORDER BY COUNT(*) DESC) <= @top
ORDER BY step, sessions DESC`,
  );
  // Exact per-page exit rates plus the session total, from the same CTE in one job.
  const exits = withSessions(
    bq,
    range,
    `SELECT page, views, exits, total
FROM (
  SELECT p AS page, COUNT(*) AS views, COUNTIF(i = ARRAY_LENGTH(pages) - 1) AS exits
  FROM sessions, UNNEST(pages) AS p WITH OFFSET i
  WHERE @start_path = '' OR pages[SAFE_OFFSET(0)] = @start_path
  GROUP BY page
)
CROSS JOIN (
  SELECT COUNT(*) AS total FROM sessions
  WHERE ARRAY_LENGTH(pages) > 0 AND (@start_path = '' OR pages[SAFE_OFFSET(0)] = @start_path)
)
ORDER BY views DESC
LIMIT 40`,
  );
  const params = { ...sessionParams(bq), depth: clampInt(depth, 1, 8), start_path: String(startPath), top: clampInt(top, 3, 40) };
  return { sql, params, exits: { sql: exits, params: { ...sessionParams(bq), start_path: String(startPath) } } };
}

export function stepKey(step) {
  const value = String(step.value || '').trim();
  return step.kind === 'event' ? `event:${value}` : `page:${value}`;
}

// Strictly ordered, within one session: step N must happen after step N-1.
export function funnelSql(bq, range, steps) {
  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 8) throw new Error('A funnel needs 2–8 steps.');
  const params = { ...sessionParams(bq) };
  const ctes = [];
  // t<i> stays NULL once a step is missed (`ts > NULL` matches nothing), so one
  // pass over the last CTE counts every step.
  steps.forEach((step, i) => {
    params[`k${i}`] = stepKey(step);
    const after = i === 0 ? '' : ` AND ts > t${i - 1}`;
    ctes.push(`f${i} AS (
  SELECT *, (SELECT MIN(ts) FROM UNNEST(seq) WHERE k = @k${i}${after}) AS t${i}
  FROM ${i === 0 ? 'sessions' : `f${i - 1}`}
)`);
  });
  const select = steps
    .map((_, i) => {
      const gap = i === 0 ? '' : `,\n  AVG((t${i} - t${i - 1}) / 1e6) AS avg_seconds_${i}`;
      return `COUNTIF(t${i} IS NOT NULL) AS step_${i}${gap}`;
    })
    .join(',\n  ');
  const sql = withSessions(bq, range, `SELECT\n  ${select}\nFROM f${steps.length - 1}`, ctes);
  return { sql, params };
}

// GA4's automatic events say nothing about intent, so funnel suggestions skip them.
export const AUTO_EVENTS = ['page_view', 'session_start', 'first_visit', 'user_engagement', 'scroll'];

// Per session: the landing page and when each other event first fired, for
// suggesting funnels. Sessions with only automatic events are left out.
export function funnelDiscoverySql(bq, range) {
  const sql = withSessions(
    bq,
    range,
    `SELECT landing, started_at, firsts FROM (
  SELECT
    pages[SAFE_OFFSET(0)] AS landing,
    started_at,
    ARRAY(
      SELECT AS STRUCT SUBSTR(k, 7) AS name, MIN(ts) AS ts
      FROM UNNEST(seq)
      WHERE STARTS_WITH(k, 'event:') AND SUBSTR(k, 7) NOT IN UNNEST(@auto_events)
      GROUP BY k
      ORDER BY ts
    ) AS firsts
  FROM sessions
)
WHERE ARRAY_LENGTH(firsts) > 0
LIMIT 20000`,
  );
  return { sql, params: { ...sessionParams(bq), auto_events: AUTO_EVENTS } };
}

// Weekly new-user cohorts by first-touch week; cell = users active N weeks later.
export function cohortsSql(bq, range) {
  const activity = `activity AS (
  SELECT DISTINCT
    user_id,
    DATE_TRUNC(first_touch_date, WEEK(MONDAY)) AS cohort,
    DATE_TRUNC(session_date, WEEK(MONDAY)) AS week
  FROM sessions
  WHERE first_touch_date BETWEEN DATE '${ymdToIso(range.start)}' AND DATE '${ymdToIso(range.end)}'
)`;
  const sql = withSessions(
    bq,
    range,
    `SELECT cohort, DATE_DIFF(week, cohort, WEEK(MONDAY)) AS week_offset, COUNT(DISTINCT user_id) AS users
FROM activity
WHERE week >= cohort
GROUP BY cohort, week_offset
ORDER BY cohort, week_offset`,
    [activity],
  );
  return { sql, params: sessionParams(bq) };
}

export function sessionsListSql(bq, range, { path = '', converted = '', limit = 50 } = {}) {
  const sql = withSessions(
    bq,
    range,
    `SELECT user_id, session_id, started_at, ended_at, device, country, source, medium,
  ARRAY(SELECT p FROM UNNEST(pages) AS p WITH OFFSET o WHERE o < 30 ORDER BY o) AS pages,
  ARRAY_LENGTH(pages) AS page_count,
  ARRAY_LENGTH(seq) AS event_count,
  (SELECT COUNT(*) FROM UNNEST(seq) WHERE k = @converted) AS conversions
FROM sessions
WHERE (@path = '' OR @path IN UNNEST(pages))
  AND (@converted = '' OR EXISTS (SELECT 1 FROM UNNEST(seq) WHERE k = @converted))
ORDER BY started_at DESC
LIMIT @limit`,
  );
  return {
    sql,
    params: {
      ...sessionParams(bq),
      path: String(path),
      converted: converted ? `event:${converted}` : '',
      limit: clampInt(limit, 1, 200),
    },
  };
}

/* ---------- raw-event analyses (event parameters only exist there) ---------- */

export function eventsCatalogSql(bq, range) {
  return {
    sql: `SELECT event_name, COUNT(*) AS events, COUNT(DISTINCT user_pseudo_id) AS users
FROM ${eventsTable(bq)}
WHERE ${eventFilter(bq, range)}
GROUP BY event_name
ORDER BY events DESC
LIMIT 100`,
    params: baseParams(bq),
  };
}

// Who reached a step but didn't convert, grouped by what they were on. Steps and
// the outcome are the site's own goal events (its config), named in the SQL, so
// they must be plain event names. Rows: { grp, step, n, quick, converted } —
// step '' is the group's total; quick = left within 10 seconds of landing.
export const LEAVER_GROUPS = ['Phones and tablets', 'Chromebooks', 'Mac', 'Windows', 'Linux', 'Other'];
const EVENT_NAME = /^[A-Za-z][\w]{0,39}$/;

export function leaversSql(bq, range, { steps = [], outcome = '' } = {}) {
  const names = [...new Set(steps)].filter((s) => EVENT_NAME.test(s)).slice(0, 4);
  if (!names.length || !EVENT_NAME.test(outcome)) throw new Error('Leavers need step events and an outcome event from the site’s goals.');
  const list = names.map((n) => `'${n}'`).join(', ');
  const sql = `WITH e AS (
  SELECT CONCAT(user_pseudo_id, '.', CAST(${PARAM('ga_session_id', 'int_value')} AS STRING)) AS sid,
    event_name, event_timestamp AS ts, device.category AS device, device.operating_system AS os
  FROM ${eventsTable(bq)}
  WHERE ${eventFilter(bq, range)} AND ${PARAM('ga_session_id', 'int_value')} IS NOT NULL
),
s AS (
  SELECT sid,
    CASE
      WHEN ANY_VALUE(device) IN ('mobile', 'tablet') THEN 'Phones and tablets'
      WHEN ANY_VALUE(os) = 'Chrome OS' THEN 'Chromebooks'
      WHEN ANY_VALUE(os) IN ('Macintosh', 'macOS') THEN 'Mac'
      WHEN ANY_VALUE(os) = 'Windows' THEN 'Windows'
      WHEN ANY_VALUE(os) = 'Linux' THEN 'Linux'
      ELSE 'Other'
    END AS grp,
    MAX(ts) - MIN(ts) AS span,
    COUNTIF(event_name IN (${list})) > 0 AS reached,
    COUNTIF(event_name = '${outcome}') > 0 AS converted,
    ARRAY_AGG(DISTINCT IF(event_name IN (${list}), event_name, NULL) IGNORE NULLS) AS hit
  FROM e
  GROUP BY sid
)
SELECT grp, '' AS step, COUNTIF(reached AND NOT converted) AS n,
  COUNTIF(reached AND NOT converted AND span < 10000000) AS quick, COUNTIF(reached AND converted) AS converted
FROM s GROUP BY grp
UNION ALL
SELECT grp, step, COUNT(*) AS n, 0 AS quick, 0 AS converted
FROM s, UNNEST(hit) AS step
WHERE reached AND NOT converted
GROUP BY grp, step`;
  return { sql, params: baseParams(bq) };
}

export function eventDetailSql(bq, range, eventName) {
  const params = { ...baseParams(bq), event_name: String(eventName) };
  return {
    keys: {
      sql: `SELECT p.key AS key, COUNT(*) AS events,
  COUNT(DISTINCT COALESCE(p.value.string_value, CAST(p.value.int_value AS STRING),
    CAST(p.value.double_value AS STRING), CAST(p.value.float_value AS STRING))) AS distinct_values
FROM ${eventsTable(bq)}, UNNEST(event_params) AS p
WHERE ${eventFilter(bq, range)} AND event_name = @event_name
GROUP BY key
ORDER BY events DESC
LIMIT 60`,
      params,
    },
    trend: {
      sql: `SELECT event_date AS date, COUNT(*) AS events, COUNT(DISTINCT user_pseudo_id) AS users
FROM ${eventsTable(bq)}
WHERE ${eventFilter(bq, range)} AND event_name = @event_name
GROUP BY date
ORDER BY date`,
      params,
    },
  };
}

export function paramBreakdownSql(bq, range, eventName, key) {
  return {
    sql: `SELECT
  COALESCE(p.value.string_value, CAST(p.value.int_value AS STRING),
    CAST(p.value.double_value AS STRING), CAST(p.value.float_value AS STRING), '(not set)') AS value,
  COUNT(*) AS events,
  COUNT(DISTINCT user_pseudo_id) AS users
FROM ${eventsTable(bq)}, UNNEST(event_params) AS p
WHERE ${eventFilter(bq, range)} AND event_name = @event_name AND p.key = @param_key
GROUP BY value
ORDER BY events DESC
LIMIT 50`,
    params: { ...baseParams(bq), event_name: String(eventName), param_key: String(key) },
  };
}

/* ---------- console + rollup ---------- */

// {{events}}, {{sessions}}, {{range}}, {{start}} and {{end}} expand so console queries prune by default.
// {{range}} is the full table filter (daily tables, or intraday ones where no daily table exists).
export function expandConsoleSql(bq, range, sql) {
  const text = String(sql || '').trim().replace(/;\s*$/, '');
  if (!text) throw new Error('Write a query first.');
  const expanded = text
    .replaceAll('{{events}}', eventsTable(bq))
    .replaceAll('{{range}}', `(${eventFilter(bq, range, { stream: false })})`)
    .replaceAll('{{start}}', `'${range.start}'`)
    .replaceAll('{{end}}', `'${range.end}'`);
  if (expanded.includes('{{sessions}}')) {
    return { sql: withSessions(bq, range, expanded.replaceAll('{{sessions}}', 'sessions')), params: sessionParams(bq) };
  }
  return { sql: expanded, params: bq.streamId && expanded.includes('@stream_id') ? baseParams(bq) : {} };
}

export function rollupTarget(bq, propertyHint = '') {
  const suffix = (bq.dataset.replace(/^analytics_/, '') || propertyHint).replace(/[^A-Za-z0-9_]/g, '_');
  return { project: bq.billingProject, dataset: `sitelens_${suffix}`, table: 'sessions' };
}

export function rollupSql(bq, range) {
  const target = rollupTarget(bq);
  return {
    target,
    sql: `CREATE OR REPLACE TABLE ${ident(target.project, target.dataset, target.table)}
PARTITION BY session_date
CLUSTER BY user_id
OPTIONS (description = 'SiteLens Studio sessions rollup ${range.startDate} → ${range.endDate}')
AS
${sessionsFromEvents(bq, range)}`,
    params: baseParams(bq),
  };
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
