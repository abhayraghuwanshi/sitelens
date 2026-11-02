// Dry-runs every SQL builder against Google's public GA4 sample (free: dry runs
// are never billed), so syntax and schema errors show up before any dashboard does.
//
//   BQ_TOKEN=ya29.xxx BQ_PROJECT=my-gcp-project npm run check-sql
//
// BQ_PROJECT is any project you can create jobs in; the data itself is public.

import { createBigQuery, humanBytes } from '../server/bigquery.mjs';
import * as sql from '../server/sql.mjs';

const token = process.env.BQ_TOKEN;
const project = process.env.BQ_PROJECT;
if (!token || !project) {
  console.error('\n  Set BQ_TOKEN (OAuth access token with the bigquery scope) and BQ_PROJECT.\n');
  process.exit(1);
}

const bq = {
  billingProject: project,
  dataProject: process.env.BQ_DATA_PROJECT || 'bigquery-public-data',
  dataset: process.env.BQ_DATASET || 'ga4_obfuscated_sample_ecommerce',
  location: process.env.BQ_LOCATION || 'US',
  streamId: process.env.BQ_STREAM || '',
};
const range = sql.warehouseRange('28d', { endDate: process.env.BQ_END_DATE ?? '2021-01-31' });
const client = createBigQuery({ getToken: async () => token });

const paths = sql.pathsSql(bq, range, { startPath: '/' });
const detail = sql.eventDetailSql(bq, range, 'purchase');
const checks = [
  ['paths', paths],
  ['paths.exits', paths.exits],
  ['funnel', sql.funnelSql(bq, range, [{ kind: 'page', value: '/' }, { kind: 'event', value: 'add_to_cart' }, { kind: 'event', value: 'purchase' }])],
  ['cohorts', sql.cohortsSql(bq, range)],
  ['sessions', sql.sessionsListSql(bq, range, { converted: 'purchase' })],
  ['events', sql.eventsCatalogSql(bq, range)],
  ['event.keys', detail.keys],
  ['event.trend', detail.trend],
  ['breakdown', sql.paramBreakdownSql(bq, range, 'purchase', 'currency')],
  ['console', sql.expandConsoleSql(bq, range, 'SELECT ARRAY_LENGTH(pages) n, COUNT(*) c FROM {{sessions}} GROUP BY 1')],
];

let failed = 0;
for (const [name, built] of checks) {
  try {
    const plan = await client.dryRun({ project, sql: built.sql, params: built.params, location: bq.location });
    console.log(`  ✔ ${name.padEnd(12)} ${humanBytes(plan.bytes).padStart(9)}  ${plan.statementType}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✖ ${name.padEnd(12)} ${err.message}${err.hint ? `\n      ${err.hint}` : ''}`);
  }
}
console.log(failed ? `\n  ${failed} failed\n` : '\n  all queries valid\n');
process.exitCode = failed ? 1 : 0;
