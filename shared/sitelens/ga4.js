// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.
// Thin, dependency-free client for the Google Analytics Data + Admin APIs.

const DATA_BASE = 'https://analyticsdata.googleapis.com';
const ADMIN_BASE = 'https://analyticsadmin.googleapis.com';

export class GaApiError extends Error {
  constructor(message, { status = 0, kind = 'unknown', detail = '', endpoint = '' } = {}) {
    super(message);
    this.name = 'GaApiError';
    this.status = status;
    this.kind = kind;
    this.detail = detail;
    this.endpoint = endpoint;
  }
}

export function cleanToken(raw) {
  let token = String(raw || '').trim();
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, '');
  return token.replace(/\s+/g, '');
}

function classify(status, message, details = '') {
  const text = `${message} ${details}`.toLowerCase();
  if (status === 401 || text.includes('invalid authentication') || text.includes('invalid credentials')) {
    return 'auth';
  }
  if (status === 403) {
    if (text.includes('has not been used in project') || text.includes('is disabled') || text.includes('service_disabled')) {
      return 'disabled';
    }
    if (text.includes('quota') || text.includes('rate limit')) return 'quota';
    return 'permission';
  }
  if (status === 429) return 'quota';
  if (status === 404) return 'notfound';
  if (status === 400) {
    if (text.includes('unknown dimension') || text.includes('unknown metric')) return 'schema';
    return 'request';
  }
  return status >= 500 ? 'server' : 'unknown';
}

function friendly(kind, status, rawMessage, endpoint) {
  switch (kind) {
    case 'auth':
      return 'Google rejected the access token. It probably expired — paste a fresh token in Settings.';
    case 'disabled':
      return 'The Google Analytics Data API is not enabled for this token\'s Google Cloud project. Enable it, then try again.';
    case 'permission':
      return 'This token does not have access to that GA4 property. Use an account with at least Viewer access.';
    case 'quota':
      return 'GA4 rate limit reached. Wait about a minute, then refresh.';
    case 'notfound':
      return 'That GA4 property could not be found. Check the property ID.';
    case 'schema':
      return `GA4 rejected one of the report fields. ${rawMessage || ''}`.trim();
    case 'server':
      return 'Google Analytics is having trouble right now. Try again in a moment.';
    case 'network':
      return 'Could not reach Google Analytics. Check your internet connection.';
    default:
      return rawMessage || `Google Analytics request failed (HTTP ${status}).`;
  }
}

export async function gaFetch(endpoint, { token, method = 'GET', body, timeoutMs = 25000 } = {}) {
  const authed = cleanToken(token);
  if (!authed) {
    throw new GaApiError('Add a Google Analytics access token in Settings to load data.', {
      kind: 'auth',
      endpoint,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${authed}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err?.name === 'AbortError';
    throw new GaApiError(
      aborted ? 'The Google Analytics request timed out. Try again.' : friendly('network', 0, err?.message, endpoint),
      { kind: aborted ? 'timeout' : 'network', endpoint },
    );
  }
  clearTimeout(timer);

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const apiError = payload?.error || {};
    const message = apiError.message || text.slice(0, 300) || `HTTP ${response.status}`;
    const details = Array.isArray(apiError.details)
      ? apiError.details.map((d) => d?.reason || d?.message || '').join(' ')
      : '';
    const kind = classify(response.status, message, details);
    throw new GaApiError(friendly(kind, response.status, message, endpoint), {
      status: response.status,
      kind,
      detail: message,
      endpoint,
    });
  }

  return payload || {};
}

/* ---------- response parsing ---------- */

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseReport(response) {
  const dimensions = (response?.dimensionHeaders || []).map((h) => h.name);
  const metrics = (response?.metricHeaders || []).map((h) => h.name);
  const rows = (response?.rows || []).map((row) => {
    const out = {};
    dimensions.forEach((name, i) => {
      out[name] = row?.dimensionValues?.[i]?.value ?? '';
    });
    metrics.forEach((name, i) => {
      out[name] = toNumber(row?.metricValues?.[i]?.value);
    });
    return out;
  });
  const totals = (response?.totals || []).map((row) => {
    const out = {};
    metrics.forEach((name, i) => {
      out[name] = toNumber(row?.metricValues?.[i]?.value);
    });
    return out;
  });
  return {
    dimensions,
    metrics,
    rows,
    totals,
    rowCount: response?.rowCount ?? rows.length,
    quota: response?.propertyQuota || null,
    metadata: response?.metadata || null,
  };
}

export function parseFunnel(response) {
  const table = response?.funnelTable || {};
  const dimensions = (table.dimensionHeaders || []).map((h) => h.name);
  const metrics = (table.metricHeaders || []).map((h) => h.name);
  const steps = (table.rows || []).map((row, index) => {
    const out = { index };
    dimensions.forEach((name, i) => {
      out[name] = row?.dimensionValues?.[i]?.value ?? '';
    });
    metrics.forEach((name, i) => {
      out[name] = toNumber(row?.metricValues?.[i]?.value);
    });
    out.name =
      out.funnelStepName ||
      out.stepName ||
      dimensions.map((d) => out[d]).find(Boolean) ||
      `Step ${index + 1}`;
    out.users = out.activeUsers ?? 0;
    out.completionRate = out.completionRate ?? 0;
    out.abandonments = out.abandonments ?? 0;
    out.abandonmentRate = out.abandonmentRate ?? 0;
    return out;
  });
  return { steps, metrics, dimensions, visualization: response?.funnelVisualization || null };
}

/* ---------- endpoints ---------- */

export async function runReport({ token, propertyId, body }) {
  const pid = String(propertyId || '').replace(/^properties\//, '').trim();
  if (!pid) throw new GaApiError('No GA4 property is linked to this site.', { kind: 'notfound' });
  const payload = await gaFetch(`${DATA_BASE}/v1beta/properties/${encodeURIComponent(pid)}:runReport`, {
    token,
    method: 'POST',
    body,
  });
  return parseReport(payload);
}

export async function runRealtimeReport({ token, propertyId, body }) {
  const pid = String(propertyId || '').replace(/^properties\//, '').trim();
  if (!pid) throw new GaApiError('No GA4 property is linked to this site.', { kind: 'notfound' });
  const payload = await gaFetch(`${DATA_BASE}/v1beta/properties/${encodeURIComponent(pid)}:runRealtimeReport`, {
    token,
    method: 'POST',
    body,
  });
  return parseReport(payload);
}

export async function runFunnelReport({ token, propertyId, body }) {
  const pid = String(propertyId || '').replace(/^properties\//, '').trim();
  if (!pid) throw new GaApiError('No GA4 property is linked to this site.', { kind: 'notfound' });
  const payload = await gaFetch(`${DATA_BASE}/v1alpha/properties/${encodeURIComponent(pid)}:runFunnelReport`, {
    token,
    method: 'POST',
    body,
  });
  return parseFunnel(payload);
}

export async function listAccountSummaries({ token }) {
  const properties = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ pageSize: '200' });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await gaFetch(`${ADMIN_BASE}/v1beta/accountSummaries?${params.toString()}`, { token });
    for (const account of payload.accountSummaries || []) {
      for (const property of account.propertySummaries || []) {
        const id = String(property.property || '').replace(/^properties\//, '');
        if (!id) continue;
        properties.push({
          id,
          name: property.displayName || `Property ${id}`,
          account: account.displayName || '',
          type: property.propertyType || '',
        });
      }
    }
    pageToken = payload.nextPageToken || '';
    if (!pageToken) break;
  }
  properties.sort((a, b) => a.name.localeCompare(b.name));
  return properties;
}

export async function listDataStreams({ token, propertyId }) {
  const pid = String(propertyId || '').replace(/^properties\//, '').trim();
  if (!pid) return [];
  const payload = await gaFetch(
    `${ADMIN_BASE}/v1beta/properties/${encodeURIComponent(pid)}/dataStreams?pageSize=200`,
    { token },
  );
  return (payload.dataStreams || [])
    .filter((stream) => stream.type === 'WEB_DATA_STREAM')
    .map((stream) => ({
      id: String(stream.name || '').split('/').pop(),
      name: stream.displayName || 'Web stream',
      measurementId: stream.webStreamData?.measurementId || '',
      defaultUri: stream.webStreamData?.defaultUri || '',
    }));
}

export async function verifyToken({ token }) {
  const properties = await listAccountSummaries({ token });
  return { properties };
}

export const _internals = { gaFetch, classify, toNumber };
