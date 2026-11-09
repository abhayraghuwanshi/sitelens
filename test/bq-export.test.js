import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBigQuery } from '../server/bigquery.mjs';

// Two projects; the export lives in the second.
function fakeGoogle({ link = null } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.endsWith('/projects?maxResults=200')) {
      return Response.json({ projects: [
        { projectReference: { projectId: 'side-project' }, numericId: '111', friendlyName: 'Side' },
        { projectReference: { projectId: 'main-project' }, numericId: '222', friendlyName: 'Main' },
      ] });
    }
    if (u.includes('/bigQueryLinks')) return link ? Response.json({ bigqueryLinks: [link] }) : new Response('{}', { status: 403 });
    if (u.includes('/side-project/datasets')) return Response.json({ datasets: [{ datasetReference: { datasetId: 'other' }, location: 'US' }] });
    if (u.includes('/main-project/datasets')) return Response.json({ datasets: [{ datasetReference: { datasetId: 'analytics_123' }, location: 'asia-south1' }] });
    throw new Error(`unexpected ${u}`);
  };
  return { calls, bigquery: createBigQuery({ getToken: async () => 't', fetchImpl }) };
}

test('finds the export by searching projects when the GA4 link is not readable', async () => {
  const { bigquery } = fakeGoogle();
  const found = await bigquery.findExport('123');
  assert.equal(found.found, true);
  assert.equal(found.dataProject, 'main-project');
  assert.equal(found.billingProject, 'main-project');
  assert.equal(found.dataset, 'analytics_123');
  assert.equal(found.location, 'asia-south1');
});

test('uses the GA4 BigQuery link to go straight to the right project', async () => {
  const { bigquery, calls } = fakeGoogle({ link: { project: 'projects/222', datasetLocation: 'asia-south1' } });
  const found = await bigquery.findExport('123');
  assert.equal(found.dataProject, 'main-project');
  assert.ok(!calls.some((u) => u.includes('/side-project/datasets')));
});

test('a link whose first export has not landed says so', async () => {
  const { bigquery } = fakeGoogle({ link: { project: 'projects/111' } });
  const found = await bigquery.findExport('123');
  assert.equal(found.found, false);
  assert.equal(found.linked, true);
  assert.equal(found.project, 'side-project');
});

test('no export anywhere', async () => {
  const { bigquery } = fakeGoogle();
  const found = await bigquery.findExport('999');
  assert.deepEqual({ found: found.found, linked: found.linked }, { found: false, linked: false });
});
