import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteRequest, viewerUrl, cleanEmail } from '../server/sharing.mjs';

const u = (path) => new URL(`https://sitelens.test${path}`);

test('reads about a site name it and are allowed', () => {
  assert.deepEqual(siteRequest('GET', u('/api/sites/abc123/dashboard?range=28d')), { site: 'abc123', allowed: true });
  assert.deepEqual(siteRequest('GET', u('/api/sites/abc123/warehouse/journeys')), { site: 'abc123', allowed: true });
  assert.deepEqual(siteRequest('GET', u('/api/bing/sites/abc123')), { site: 'abc123', allowed: true });
  assert.deepEqual(siteRequest('GET', u('/api/alerts?site=abc123')), { site: 'abc123', allowed: true });
  assert.deepEqual(siteRequest('GET', u('/api/annotations?scope=site:abc123')), { site: 'abc123', allowed: true });
  // A funnel is a read sent as a POST.
  assert.deepEqual(siteRequest('POST', u('/api/sites/abc123/warehouse/funnel')), { site: 'abc123', allowed: true });
});

test('writes, SQL and anything unlisted about a site are refused', () => {
  assert.equal(siteRequest('DELETE', u('/api/sites/abc123')).allowed, false);
  assert.equal(siteRequest('POST', u('/api/sites/abc123/leave-out')).allowed, false);
  assert.equal(siteRequest('POST', u('/api/sites/abc123/warehouse/sql')).allowed, false);
  assert.equal(siteRequest('GET', u('/api/sites/abc123/warehouse/sql')).allowed, false);
  assert.equal(siteRequest('POST', u('/api/sites/abc123/warehouse/rollup')).allowed, false);
  assert.equal(siteRequest('GET', u('/api/sites/abc123/setup')).allowed, false);
  assert.equal(siteRequest('GET', u('/api/sites/abc123/config/draft')).allowed, false);
  assert.equal(siteRequest('GET', u('/api/sites/abc123/config')).allowed, true);
  assert.equal(siteRequest('POST', u('/api/todos?site=abc123')).allowed, false);
  assert.equal(siteRequest('GET', u('/api/posts?site=abc123')).allowed, false);
  assert.deepEqual(siteRequest('GET', u('/api/todos/todo-x1?site=abc123')), { site: 'abc123', allowed: true, check: 'todo' });
});

test('requests that name no site, or several, stay with the viewer', () => {
  assert.equal(siteRequest('GET', u('/api/state')), null);
  assert.equal(siteRequest('GET', u('/api/todos')), null);
  assert.equal(siteRequest('GET', u('/api/calendar?site=all')), null);
  assert.equal(siteRequest('GET', u('/api/annotations?scope=site:a,site:b')), null);
  assert.equal(siteRequest('GET', u('/api/annotations?scope=site:a,repo:x')), null);
  assert.equal(siteRequest('GET', u('/api/google/properties')), null);
});

test('viewers never force a fresh (billed) query, and emails are checked', () => {
  assert.equal(viewerUrl(u('/api/sites/a/warehouse/paths?range=28d&fresh=1')).search, '?range=28d');
  assert.equal(cleanEmail(' Carol@Example.COM '), 'carol@example.com');
  assert.equal(cleanEmail('not an email'), '');
  assert.equal(cleanEmail('a@b'), '');
});
