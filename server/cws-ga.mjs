// Store-listing analytics from the GA4 property Chrome Web Store creates when a
// developer turns on Google Analytics for an item (Developer Dashboard → Store
// listing → Google Analytics). Google names that property after the extension
// ID and puts it in a "Chrome Web Store developer properties" account. It
// records visits to the listing page (page_view…) and an `install` event when a
// visitor installs from that page — so installs that bypass the listing (policy
// installs, side-loading) are not in it.

import { runReport, listAccountSummaries, GaApiError } from '../shared/sitelens/ga4.js';

// Finds the property Google created for this extension: named exactly after its ID.
export function findListingProperty(properties, extensionId) {
  return properties.find((p) => p.name === extensionId) || null;
}

async function report(token, propertyId, body) {
  try {
    return await runReport({ token, propertyId, body });
  } catch (err) {
    // GA's Data API has transient timeouts/5xx/quota blips; one retry clears most.
    if (err instanceof GaApiError && ['timeout', 'network', 'server', 'quota'].includes(err.kind)) {
      await new Promise((r) => setTimeout(r, 1200));
      return runReport({ token, propertyId, body });
    }
    throw err;
  }
}

const INSTALL = { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'install' } } };
const n = (v) => Number(v) || 0;
const isoFromGa = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

// range: historyRange() shape ({ start, end, dates[] } in YYYY-MM-DD).
export async function listingAnalytics({ token, propertyId, range }) {
  const dateRanges = [{ startDate: range.start, endDate: range.end }];
  const [daily, dailyInstalls, totals, installTotals, sources, sourceInstalls, countries] = await Promise.all([
    report(token, propertyId, { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], limit: 1000 }),
    report(token, propertyId, { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'eventCount' }], dimensionFilter: INSTALL, limit: 1000 }),
    report(token, propertyId, { dateRanges, metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'sessions' }] }),
    report(token, propertyId, { dateRanges, metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: INSTALL }),
    report(token, propertyId, { dateRanges, dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'totalUsers' }], limit: 25, orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }] }),
    report(token, propertyId, { dateRanges, dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: INSTALL, limit: 25 }),
    report(token, propertyId, { dateRanges, dimensions: [{ name: 'country' }], metrics: [{ name: 'eventCount' }], dimensionFilter: INSTALL, limit: 10, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }),
  ]);

  const byDay = (rows, field) => {
    const map = new Map(rows.map((r) => [isoFromGa(r.date), n(r[field])]));
    return range.dates.map((d) => map.get(d) || 0);
  };

  const t = totals.rows[0] || {};
  const it = installTotals.rows[0] || {};
  const visitors = n(t.totalUsers);
  const installers = n(it.totalUsers);

  // Join visitors and installs per source so conversion is per channel.
  const installsBySource = new Map(sourceInstalls.rows.map((r) => [r.sessionSource, { installs: n(r.eventCount), installers: n(r.totalUsers) }]));
  const sourceRows = sources.rows.map((r) => {
    const inst = installsBySource.get(r.sessionSource) || { installs: 0, installers: 0 };
    installsBySource.delete(r.sessionSource);
    return { source: r.sessionSource, visitors: n(r.totalUsers), ...inst, conversion: n(r.totalUsers) ? inst.installers / n(r.totalUsers) : 0 };
  });
  for (const [source, inst] of installsBySource) sourceRows.push({ source, visitors: 0, ...inst, conversion: 0 });

  return {
    propertyId,
    totals: {
      views: n(t.screenPageViews),
      visitors,
      sessions: n(t.sessions),
      installs: n(it.eventCount),
      installers,
      conversion: visitors ? installers / visitors : 0,
    },
    series: {
      views: byDay(daily.rows, 'screenPageViews'),
      visitors: byDay(daily.rows, 'activeUsers'),
      installs: byDay(dailyInstalls.rows, 'eventCount'),
    },
    sources: sourceRows.sort((a, b) => b.installs - a.installs || b.visitors - a.visitors),
    countries: countries.rows.map((r) => ({ country: r.country, installs: n(r.eventCount) })),
  };
}

export async function listProperties(token) {
  return listAccountSummaries({ token });
}
