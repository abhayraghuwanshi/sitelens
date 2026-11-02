import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { historyRange } from '../server/github.mjs';
import {
  normalizeProduct, spanRange, halves, carrySnapshots, suggestProducts, blankLeadingZeros, productRoutes,
} from '../server/products.mjs';

test('normalizeProduct: slug id, deduped lists, validation', () => {
  const p = normalizeProduct({ label: ' Cool Desk! ', siteId: 'abc', repos: ['me/app', 'me/app'], extensionIds: ['ioggffobciopdddacpclplkeodllhjko'] });
  assert.deepEqual(p, { id: 'cool-desk', label: 'Cool Desk!', siteId: 'abc', repos: ['me/app'], extensionIds: ['ioggffobciopdddacpclplkeodllhjko'] });
  assert.throws(() => normalizeProduct({ label: '' }), /name/);
  assert.throws(() => normalizeProduct({ label: 'X' }), /at least/);
  assert.throws(() => normalizeProduct({ label: 'X', repos: ['nope'] }), /owner\/name/);
  assert.throws(() => normalizeProduct({ label: 'X', extensionIds: ['zzz'] }), /extension ID/);
});

test('spanRange doubles the range and halves splits it back', () => {
  const range = historyRange('7d', Date.parse('2026-10-30T12:00:00Z'));
  const span = spanRange(range);
  assert.equal(span.dates.length, 14);
  assert.equal(span.start, '2026-10-17');
  assert.equal(span.dates[7], range.start);
  assert.equal(span.end, range.end);
  const [prev, cur] = halves(span.dates.map((_, i) => i), 7);
  assert.deepEqual(prev, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(cur, [7, 8, 9, 10, 11, 12, 13]);
});

test('carrySnapshots carries the last value forward and is null before the first', () => {
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
  const points = [{ date: '2026-10-02', users: 50 }, { date: '2026-10-04', users: 58 }, { date: '2026-10-03', users: null }];
  assert.deepEqual(carrySnapshots(points, 'users', dates), [null, 50, 50, 58]);
  assert.deepEqual(blankLeadingZeros([0, 0, 3, 0, 4]), [null, null, 3, 0, 4]);
});

test('suggestProducts offers Cooldesk from what is tracked, once', () => {
  const input = {
    products: [],
    sites: [{ id: 'demo', demo: true, host: 'example.com' }, { id: 's1', host: 'www.cool-desk.com' }],
    repos: ['me/cooldesk-extension', 'me/other'],
    extensions: [{ id: 'ioggffobciopdddacpclplkeodllhjko' }, { id: 'lgmmijdpaemlkihjmelodijggablcgdf' }],
  };
  assert.deepEqual(suggestProducts(input), [{ id: 'cooldesk', label: 'Cooldesk', siteId: 's1', repos: ['me/cooldesk-extension'], extensionIds: ['ioggffobciopdddacpclplkeodllhjko'] }]);
  assert.deepEqual(suggestProducts({ ...input, products: [{ id: 'cooldesk' }] }), []);
  assert.deepEqual(suggestProducts({ products: [], sites: [], repos: [], extensions: [] }), []);
});

async function routesFor(dir) {
  const store = createStore(dir);
  const extensions = { list: async () => (await store.get()).extensions || [] };
  const auth = { token: async () => { throw Object.assign(new Error('Not connected to Google.'), { kind: 'auth' }); } };
  const githubDb = () => { throw Object.assign(new Error('No GitHub data yet.'), { kind: 'needs-github' }); };
  const routes = productRoutes({ store, auth, extensions, listingProperty: async () => '1', githubDb });
  const call = (method, path, body = {}) => {
    const [, re, handler] = routes.find(([m, r]) => m === method && r.test(path.split('?')[0]));
    const url = new URL(path, 'http://x');
    return handler({ match: url.pathname.match(re), query: url.searchParams, body });
  };
  return { store, call };
}

test('product routes: CRUD, and each source fails on its own', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'products-'));
  try {
    const { store, call } = await routesFor(dir);
    await store.update((s) => {
      s.extensions = [{ id: 'ioggffobciopdddacpclplkeodllhjko', title: 'New Tab', history: [{ date: '2026-01-01', users: 58, rating: 4.9, ratings: 7 }] }];
    });
    const saved = await call('POST', '/api/products', { label: 'Cooldesk', siteId: 'demo', repos: ['me/app'], extensionIds: ['ioggffobciopdddacpclplkeodllhjko'] });
    assert.equal(saved.id, 'cooldesk');
    assert.equal((await call('GET', '/api/products')).products.length, 1);

    const view = await call('GET', '/api/products/cooldesk?range=7d');
    const byType = Object.fromEntries(view.sources.map((s) => [s.type, s]));
    assert.equal(byType.site.ok, true, 'demo site still renders');
    assert.equal(byType.extension.kind, 'auth', 'GA4 listing failure is per source');
    assert.equal(byType.repos.kind, 'needs-github');
    assert.equal(view.series.sessions.length, 7);
    assert.ok(view.kpis.some((k) => k.key === 'storeUsers' && k.value === 58), 'snapshots survive a GA4 failure');
    assert.ok(view.kpis.some((k) => k.key === 'rating' && k.value === 4.9));
    assert.deepEqual(view.scopes, ['site:demo', 'repo:me/app', 'ext:ioggffobciopdddacpclplkeodllhjko']);

    await call('DELETE', '/api/products/cooldesk');
    assert.equal((await call('GET', '/api/products')).products.length, 0);
    await assert.rejects(() => call('GET', '/api/products/cooldesk'), /Unknown product/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a product on the demo site alone gets a full sample page', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'products-'));
  try {
    const { call } = await routesFor(dir);
    await call('POST', '/api/products', { label: 'Sample', siteId: 'demo' });
    const view = await call('GET', '/api/products/sample?range=28d');
    assert.equal(view.demo, true);
    assert.ok(view.sources.every((s) => s.ok));
    for (const key of ['sessions', 'installs', 'stars', 'downloads']) assert.equal(view.series[key].length, 28, key);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
