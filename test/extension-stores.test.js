import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { parseExtensionInput, parseEdgeListing, parseFirefoxListing, createExtensionTracker, extensionView, EXTENSION_ID_RE } from '../server/cws.mjs';
import { extensionVersions } from '../server/annotations.mjs';

const CRX = 'odfafepnkmbhccpbejgmiehpchacaeak';

test('parseExtensionInput: the store comes from the link, else the picked store', () => {
  assert.deepEqual(parseExtensionInput(`https://chromewebstore.google.com/detail/ublock/${CRX}`), { store: 'chrome', ref: CRX });
  assert.deepEqual(parseExtensionInput(`https://microsoftedge.microsoft.com/addons/detail/ublock-origin/${CRX}`, 'chrome'), { store: 'edge', ref: CRX });
  assert.deepEqual(parseExtensionInput('https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/?src=search'), { store: 'firefox', ref: 'ublock-origin' });
  assert.deepEqual(parseExtensionInput(CRX), { store: 'chrome', ref: CRX });
  assert.deepEqual(parseExtensionInput(CRX, 'edge'), { store: 'edge', ref: CRX });
  assert.deepEqual(parseExtensionInput('ublock-origin', 'firefox'), { store: 'firefox', ref: 'ublock-origin' });
  assert.throws(() => parseExtensionInput('hello world'), /Chrome Web Store, Edge Add-ons or Firefox/);
  assert.ok(EXTENSION_ID_RE.test(CRX) && EXTENSION_ID_RE.test('firefox-607454') && !EXTENSION_ID_RE.test('firefox-x'));
});

test('Edge and Firefox listings become the same shape as Chrome’s', () => {
  const edge = parseEdgeListing({ name: 'uBlock Origin', activeInstallCount: 14724137, averageRating: 4.46, ratingCount: 2691, version: '1.77.2', lastUpdateDate: 1795651881.5, logoUrl: '//store-images.s-microsoft.com/x' });
  assert.deepEqual(edge, { title: 'uBlock Origin', users: 14724137, usersPlus: false, rating: 4.5, ratings: 2691, version: '1.77.2', updated: 'November 26, 2026', icon: 'https://store-images.s-microsoft.com/x' });
  assert.equal(parseEdgeListing({ availability: [] }), null, 'an unknown ID has no name');
  const ff = parseFirefoxListing({ id: 607454, slug: 'ublock-origin', name: { 'en-US': 'uBlock Origin' }, average_daily_users: 11740715, ratings: { average: 4.8024, count: 22354 }, current_version: { version: '1.77.4' }, last_updated: '2026-11-27T14:02:07Z', icon_url: 'https://addons.mozilla.org/i.png' });
  assert.equal(ff.amoId, 607454);
  assert.equal(ff.users, 11740715);
  assert.equal(ff.rating, 4.8);
  assert.equal(ff.updated, 'November 27, 2026');
});

test('adding a Firefox add-on keys it by its numeric ID; snapshots, view and version marks use its store', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-ext-'));
  const store = createStore(dir);
  let version = '1.0';
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return { ok: true, status: 200, json: async () => ({ id: 607454, slug: 'ublock-origin', name: { 'en-US': 'uBlock Origin' }, average_daily_users: 100, ratings: { average: 4.8, count: 10 }, current_version: { version }, last_updated: '2026-11-27T14:02:07Z' }) };
  };
  const tracker = createExtensionTracker({ store, fetchImpl, log: {} });
  try {
    const added = await tracker.add('https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/', '', 'chrome');
    assert.equal(added.id, 'firefox-607454');
    assert.equal(added.store, 'firefox');
    assert.equal(urls[0], 'https://addons.mozilla.org/api/v5/addons/addon/ublock-origin/');
    await tracker.snapshot('firefox-607454');
    assert.equal(urls.at(-1), 'https://addons.mozilla.org/api/v5/addons/addon/607454/', 'snapshots use the numeric ID, which outlives a slug change');
    const [ext] = await tracker.list();
    assert.equal(ext.store, 'firefox');
    const view = extensionView(ext, { start: '2000-01-01', end: '2100-01-01', dates: [] });
    assert.equal(view.storeLabel, 'Firefox Add-ons');
    assert.equal(view.url, 'https://addons.mozilla.org/firefox/addon/607454/');
    const marks = extensionVersions([{ ...ext, history: [{ date: '2026-11-01', version: '1.0' }, { date: '2026-11-02', version: '1.1' }] }]);
    assert.equal(marks[0].url, 'https://addons.mozilla.org/firefox/addon/607454/');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('an Edge extension is fetched from Edge, and a Chrome one stays without a store field', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-ext-'));
  const store = createStore(dir);
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return { ok: true, status: 200, json: async () => ({ name: 'X', activeInstallCount: 5, version: '2.0', lastUpdateDate: 1795651881 }) };
  };
  const tracker = createExtensionTracker({ store, fetchImpl, log: {} });
  try {
    await tracker.add(CRX, 'Mine', 'edge');
    assert.match(urls[0], /microsoftedge\.microsoft\.com\/addons\/getproductdetailsbycrxid\/odfafepnkmbhccpbejgmiehpchacaeak/);
    const [ext] = await tracker.list();
    assert.equal(ext.store, 'edge');
    assert.equal(ext.history.at(-1).users, 5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
