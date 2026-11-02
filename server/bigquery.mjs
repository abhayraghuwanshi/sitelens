// BigQuery REST client (ported from site-analytics-extension/dev/bq-probe.mjs).
// Every query is dry-run first; the real run carries maximumBytesBilled so a
// bad query fails instead of billing.

const API = 'https://bigquery.googleapis.com/bigquery/v2/projects';

export class BigQueryError extends Error {
  constructor(message, { status = 0, kind = 'bigquery', hint = '', bytes = 0 } = {}) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.hint = hint;
    this.bytes = bytes;
  }
}

function hintFor(status, text) {
  const t = text.toLowerCase();
  if (t.includes('has not been used in project') || t.includes('is disabled')) {
    return 'Enable the BigQuery API for the billing project: https://console.cloud.google.com/apis/library/bigquery.googleapis.com';
  }
  if (t.includes('not found')) {
    return 'Check the dataset: it is analytics_<GA4 property id> and only exists after the GA4 → BigQuery link exports its first day.';
  }
  if (t.includes('location')) return 'Set the dataset location (US, EU, asia-south1…) in the site settings.';
  if (t.includes('bytes billed') || t.includes('bytesbilled')) return 'Raise the scan cap for this site, or narrow the date range.';
  if (status === 401) return 'The Google session expired. Reconnect in Settings.';
  if (status === 403) return 'The token lacks the BigQuery scope, or the account cannot run jobs in the billing project.';
  return '';
}

async function call(token, path, init = {}, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.text();
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = { raw: body };
  }
  if (!res.ok) {
    const error = payload.error || {};
    const message = error.message || body.slice(0, 300) || `HTTP ${res.status}`;
    throw new BigQueryError(message, {
      status: res.status,
      kind: res.status === 401 ? 'auth' : 'bigquery',
      hint: hintFor(res.status, `${message} ${(error.errors || []).map((e) => e.reason).join(' ')}`),
    });
  }
  return payload;
}

// { name: value } → BigQuery named parameters. Arrays become ARRAY<STRING|INT64>.
export function toQueryParameters(params = {}) {
  return Object.entries(params).map(([name, value]) => {
    if (Array.isArray(value)) {
      const type = value.every((v) => Number.isInteger(v)) && value.length ? 'INT64' : 'STRING';
      return {
        name,
        parameterType: { type: 'ARRAY', arrayType: { type } },
        parameterValue: { arrayValues: value.map((v) => ({ value: String(v) })) },
      };
    }
    const type = Number.isInteger(value) ? 'INT64' : typeof value === 'number' ? 'FLOAT64' : 'STRING';
    return { name, parameterType: { type }, parameterValue: { value: String(value) } };
  });
}

// REST rows are { f: [{ v }] } with nested records/arrays; turn them into plain objects.
function decode(field, v) {
  if (v === null || v === undefined) return null;
  if (field.mode === 'REPEATED') return v.map((item) => decode({ ...field, mode: 'NULLABLE' }, item.v));
  switch (field.type) {
    case 'RECORD':
    case 'STRUCT':
      return Object.fromEntries(field.fields.map((sub, i) => [sub.name, decode(sub, v.f[i]?.v)]));
    case 'INTEGER':
    case 'INT64':
    case 'FLOAT':
    case 'FLOAT64':
    case 'NUMERIC':
    case 'BIGNUMERIC':
      return Number(v);
    case 'BOOLEAN':
    case 'BOOL':
      return v === 'true';
    default:
      return v;
  }
}

export function decodeRows(schema, rows = []) {
  const fields = schema?.fields || [];
  return rows.map((row) => Object.fromEntries(fields.map((field, i) => [field.name, decode(field, row.f[i]?.v)])));
}

export function createBigQuery({ getToken, fetchImpl = fetch }) {
  async function dryRun({ project, sql, params, location }) {
    const token = await getToken();
    const dry = await call(
      token,
      `${encodeURIComponent(project)}/queries`,
      {
        method: 'POST',
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          dryRun: true,
          parameterMode: 'NAMED',
          queryParameters: toQueryParameters(params),
          ...(location ? { location } : {}),
        }),
      },
      fetchImpl,
    );
    return {
      bytes: Number(dry.totalBytesProcessed) || 0,
      statementType: dry.statistics?.query?.statementType || '',
    };
  }

  async function query({ project, sql, params = {}, location = '', maxBytes = 5e9, allowedTypes = ['SELECT'] }) {
    const plan = await dryRun({ project, sql, params, location });
    if (allowedTypes.length && plan.statementType && !allowedTypes.includes(plan.statementType)) {
      throw new BigQueryError(`Only ${allowedTypes.join('/')} statements are allowed here (got ${plan.statementType}).`, {
        kind: 'forbidden',
      });
    }
    if (plan.bytes > maxBytes) {
      throw new BigQueryError(`This query would scan ${humanBytes(plan.bytes)}, above the ${humanBytes(maxBytes)} cap.`, {
        kind: 'over-cap',
        bytes: plan.bytes,
        hint: 'Narrow the date range, materialize the sessions table, or raise the cap for this site.',
      });
    }

    const token = await getToken();
    const started = Date.now();
    let result = await call(
      token,
      `${encodeURIComponent(project)}/queries`,
      {
        method: 'POST',
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          parameterMode: 'NAMED',
          queryParameters: toQueryParameters(params),
          timeoutMs: 20_000,
          maxResults: 10_000,
          // Billing is rounded up per table; leave headroom over the dry-run estimate.
          maximumBytesBilled: String(Math.max(Math.ceil(plan.bytes * 1.2), 10 * 1024 * 1024)),
          ...(location ? { location } : {}),
        }),
      },
      fetchImpl,
    );

    const jobId = result.jobReference?.jobId;
    const jobLocation = result.jobReference?.location || location;
    for (let i = 0; !result.jobComplete && jobId && i < 90; i += 1) {
      await new Promise((r) => setTimeout(r, 700));
      const qs = new URLSearchParams({ maxResults: '10000', timeoutMs: '10000' });
      if (jobLocation) qs.set('location', jobLocation);
      result = await call(token, `${encodeURIComponent(project)}/queries/${encodeURIComponent(jobId)}?${qs}`, {}, fetchImpl);
    }
    if (!result.jobComplete) throw new BigQueryError('The query did not finish in time. Narrow the date range.');

    return {
      rows: decodeRows(result.schema, result.rows),
      columns: (result.schema?.fields || []).map((f) => ({ name: f.name, type: f.type, mode: f.mode })),
      bytes: plan.bytes,
      billedBytes: Number(result.totalBytesBilled) || 0,
      cacheHit: Boolean(result.cacheHit),
      ms: Date.now() - started,
      truncated: Boolean(result.pageToken),
    };
  }

  async function listDatasets(project) {
    const token = await getToken();
    const payload = await call(token, `${encodeURIComponent(project)}/datasets?all=false&maxResults=200`, {}, fetchImpl);
    return (payload.datasets || []).map((d) => ({
      id: d.datasetReference?.datasetId,
      location: d.location || '',
    }));
  }

  // Table names in a dataset (metadata only, never billed).
  async function listTables({ project, dataset }) {
    const token = await getToken();
    const ids = [];
    let pageToken = '';
    for (let page = 0; page < 20; page += 1) {
      const qs = new URLSearchParams({ maxResults: '1000' });
      if (pageToken) qs.set('pageToken', pageToken);
      const payload = await call(token, `${encodeURIComponent(project)}/datasets/${encodeURIComponent(dataset)}/tables?${qs}`, {}, fetchImpl);
      for (const t of payload.tables || []) ids.push(t.tableReference?.tableId);
      pageToken = payload.nextPageToken || '';
      if (!pageToken) break;
    }
    return ids.filter(Boolean);
  }

  async function listProjects() {
    const token = await getToken();
    const res = await fetchImpl('https://bigquery.googleapis.com/bigquery/v2/projects?maxResults=200', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new BigQueryError(payload.error?.message || `HTTP ${res.status}`, { status: res.status });
    return (payload.projects || []).map((p) => ({ id: p.projectReference?.projectId, name: p.friendlyName || '' }));
  }

  // Creates the rollup dataset next to the source data; an existing one is fine.
  async function ensureDataset({ project, dataset, location }) {
    const token = await getToken();
    try {
      await call(
        token,
        `${encodeURIComponent(project)}/datasets`,
        {
          method: 'POST',
          body: JSON.stringify({ datasetReference: { projectId: project, datasetId: dataset }, ...(location ? { location } : {}) }),
        },
        fetchImpl,
      );
    } catch (err) {
      if (err.status !== 409) throw err;
    }
  }

  return { query, dryRun, listDatasets, listProjects, listTables, ensureDataset };
}

export function humanBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
