import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  tagSites,
  createAlerts, detectAnomaly, detectDrop, detectStarSpike, denseSeries, mergeAlerts, normalizeSettings,
  lastDays, localDay, desktopNotify, postWebhook, digestText, alertNotice, digestNotice,
} from '../server/alerts.mjs';
import { ValidationError } from '../server/store.mjs';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 30, 10, 0, 0).getTime(); // local 10:00

function memoryStore(initial = {}) {
  const state = { sites: [], extensions: [], showDemo: false, ...initial };
  return {
    dir: '',
    async get() {
      return state;
    },
    async update(fn) {
      await fn(state);
      return state;
    },
    async sites() {
      return state.sites;
    },
  };
}

function fakeNotify() {
  const sent = [];
  return {
    sent,
    desktop: async (title, body) => (sent.push({ via: 'desktop', title, body }), { ok: true }),
    webhook: async (url, text) => (sent.push({ via: 'webhook', url, text }), { ok: true }),
  };
}

test('detectAnomaly needs volume, % change and z-score', () => {
  const flat = Array(28).fill(100).map((v, i) => v + (i % 3) - 1);
  assert.equal(detectAnomaly(104, flat, { pct: 0.5, minVolume: 20, z: 2 }), null);
  const spike = detectAnomaly(260, flat, { pct: 0.5, minVolume: 20, z: 2 });
  assert.equal(spike.direction, 'up');
  assert.ok(spike.change > 1.5);
  const drop = detectAnomaly(10, flat, { pct: 0.5, minVolume: 20, z: 2 });
  assert.equal(drop.direction, 'down');
  // Tiny sites don't page anyone over 2 → 6 visits.
  assert.equal(detectAnomaly(6, Array(28).fill(2), { pct: 0.5, minVolume: 20, z: 2 }), null);
  // A constant window has no spread; the % rule alone decides.
  assert.ok(detectAnomaly(60, Array(28).fill(30), { pct: 0.5, minVolume: 20, z: 2 }));
  assert.equal(detectAnomaly(60, [30, 30], { pct: 0.5, minVolume: 20, z: 2 }), null);
});

test('detectDrop, detectStarSpike and denseSeries', () => {
  assert.deepEqual(detectDrop(50, [58, 57, null], { pct: 0.05, minDrop: 3 }), { peak: 58, latest: 50, drop: 8, change: -8 / 58 });
  assert.equal(detectDrop(57, [58], { pct: 0.05, minDrop: 3 }), null);
  assert.equal(detectDrop(60, [58], { minDrop: 0 }), null);

  const steady = [10, 10, 11, 11, 12, 12, 13];
  assert.equal(detectStarSpike(steady, { minGain: 3, multiple: 3 }), null);
  assert.deepEqual(detectStarSpike([...steady, 25], { minGain: 3, multiple: 3 }).gain, 12);

  assert.deepEqual(denseSeries([{ date: '20261028', sessions: '5' }, { date: '2026-10-30', sessions: 2 }], ['2026-10-28', '2026-10-29', '2026-10-30'], 'sessions'), [5, 0, 2]);
});

test('lastDays ends yesterday in local time', () => {
  const days = lastDays(NOW, 3);
  assert.deepEqual(days, [localDay(NOW - 3 * DAY), localDay(NOW - 2 * DAY), localDay(NOW - DAY)]);
});

test('normalizeSettings fills defaults, clamps and rejects bad webhooks', () => {
  const s = normalizeSettings({ digestHour: 30, rules: { traffic: { pct: '0.8', enabled: false }, stars: { minGain: -2 } } });
  assert.equal(s.digestHour, 23);
  assert.equal(s.rules.traffic.pct, 0.8);
  assert.equal(s.rules.traffic.enabled, false);
  assert.equal(s.rules.traffic.minVolume, 20);
  assert.equal(s.rules.stars.minGain, 0);
  assert.equal(s.rules.issues.enabled, true);
  assert.throws(() => normalizeSettings({ webhookUrl: 'http://hooks.slack.com/x' }), ValidationError);
  assert.equal(normalizeSettings({ webhookUrl: ' https://discord.com/api/webhooks/1/abc ' }).webhookUrl, 'https://discord.com/api/webhooks/1/abc');
});

test('mergeAlerts dedupes by key and caps', () => {
  const old = [{ key: 'a', id: 1 }];
  const { fresh, all } = mergeAlerts(old, [{ key: 'a', id: 2 }, { key: 'b', id: 3 }, { key: 'b', id: 4 }], 2);
  assert.deepEqual(fresh.map((a) => a.id), [3]);
  assert.deepEqual(all.map((a) => a.id), [3, 1]);
});

function trafficSite() {
  return { id: 's1', label: 'Shop', host: 'shop.test', propertyId: '123', searchSite: 'sc-domain:shop.test' };
}

function fakeEngines({ yesterday = 400 } = {}) {
  const calls = [];
  return {
    calls,
    async portfolio([site], range) {
      calls.push(['portfolio', site.id, range]);
      const trend = lastDays(NOW, 40, 0).map((d, i, all) => ({
        date: d.replaceAll('-', ''),
        sessions: i === all.length - 2 ? yesterday : 100 + (i % 3),
        activeUsers: 80 + (i % 2),
      }));
      return [{ id: site.id, trend }];
    },
    async search(site) {
      calls.push(['search', site.id]);
      return { trend: lastDays(NOW, 20, 3).map((date) => ({ date, clicks: 30 })) };
    },
  };
}

test('daily run alerts on a traffic spike once, and delivers to desktop + webhook', async () => {
  const store = memoryStore({ sites: [trafficSite()], alertSettings: { webhookUrl: 'https://hooks.slack.com/services/x' } });
  const notify = fakeNotify();
  const engines = fakeEngines();
  const alerts = createAlerts({ store, engines, extensions: { list: async () => [] }, github: null, now: () => NOW, notify });

  const first = await alerts.run({ daily: true, digest: true });
  assert.deepEqual(first.errors, []);
  assert.equal(first.fired.length, 1);
  assert.equal(first.fired[0].rule, 'traffic');
  assert.equal(first.fired[0].key, `traffic:s1:sessions:${localDay(NOW - DAY)}`);
  assert.match(first.fired[0].title, /Shop: sessions spiked/);
  assert.equal(first.digest.sites[0].sessions, 400);
  assert.equal(first.digest.sites[0].clicks, 30);
  assert.match(first.digest.text, /Shop: 400 sessions/);
  assert.deepEqual(notify.sent.map((s) => s.via), ['desktop', 'desktop', 'webhook']);
  assert.match(notify.sent.at(-1).text, /spiked[\s\S]*SiteLens digest/);

  const second = await alerts.run({ daily: true });
  assert.equal(second.fired.length, 0, 'same alert key must not fire twice');
  assert.equal((await alerts.feed()).alerts.length, 1);
  assert.equal((await alerts.unread()).unread, 1);
  await alerts.markRead({ all: true });
  assert.equal((await alerts.unread()).unread, 0);
});

test('hourly tick skips GA4 until the digest hour, then runs daily once', async () => {
  let t = new Date(2026, 9, 30, 7, 0, 0).getTime();
  const store = memoryStore({ sites: [trafficSite()], alertSettings: { digestHour: 9, desktop: false } });
  const engines = fakeEngines();
  const alerts = createAlerts({ store, engines, extensions: { list: async () => [] }, github: null, now: () => t, notify: fakeNotify() });
  await alerts.tick();
  assert.equal(engines.calls.length, 0);
  t += 3 * 3_600_000;
  const r = await alerts.tick();
  assert.equal(r.daily, true);
  assert.ok(r.digest);
  const n = engines.calls.length;
  t += 3_600_000;
  await alerts.tick();
  assert.equal(engines.calls.length, n, 'daily checks run once per day');
});

test('extension user drop, rating drop and listing installs', async () => {
  const history = [
    { date: '2026-10-25', users: 60, rating: 4.9 },
    { date: '2026-10-28', users: 58, rating: 4.9 },
    { date: '2026-10-29', users: 50, rating: 4.6, ratings: 8 },
  ];
  const ext = { id: 'a'.repeat(32), title: 'Cooldesk', history };
  const store = memoryStore({ extensions: [ext] });
  const report = async ({ propertyId, body }) => {
    assert.equal(propertyId, '521233089');
    assert.equal(body.dimensionFilter.filter.stringFilter.value, 'install');
    return { rows: lastDays(NOW, 29).map((d, i) => ({ date: d.replaceAll('-', ''), eventCount: i === 28 ? 20 : 1 + (i % 2) })) };
  };
  const alerts = createAlerts({
    store, engines: fakeEngines(), github: null, now: () => NOW, notify: fakeNotify(), report,
    extensions: { list: async () => store.get().then((s) => s.extensions) },
    auth: { token: async () => 'tok' },
    listingProperty: async () => '521233089',
  });
  const r = await alerts.run({ daily: true, digest: true });
  assert.deepEqual(r.fired.map((a) => a.rule).sort(), ['extUsers', 'installs', 'rating']);
  assert.equal(r.digest.extensions[0].installs, 20);
});

test('GitHub star spike and new issues (first sight only records)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alerts-gh-'));
  const dbPath = join(dir, 'github.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE repos (id INTEGER PRIMARY KEY, name TEXT, hidden BOOLEAN DEFAULT 0, archived BOOLEAN DEFAULT 0);
    CREATE TABLE repo_stats (repo_id INTEGER, date TEXT, stars INTEGER DEFAULT 0, issues INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0);
    INSERT INTO repos (id, name) VALUES (1, 'me/app');`);
  const iso = (offset) => `${new Date(NOW + offset * DAY).toISOString().slice(0, 10)}T00:00:00Z`;
  const ins = db.prepare('INSERT INTO repo_stats (repo_id, date, stars, issues, views_count) VALUES (1, ?, ?, ?, ?)');
  ins.run(iso(-40), 10, 2, 0); // before the 30-day window: carried forward
  ins.run(iso(-1), 11, 0, 30);
  ins.run(iso(0), 30, 0, 5);
  db.close();

  const store = memoryStore();
  const github = { hasDb: () => true, dbPath };
  const alerts = createAlerts({ store, engines: fakeEngines(), github, extensions: { list: async () => [] }, now: () => NOW, notify: fakeNotify() });
  const first = await alerts.run();
  assert.deepEqual(first.fired.map((a) => a.rule), ['stars']);
  assert.match(first.fired[0].title, /\+19 stars/);
  assert.equal((await store.get()).alertState.issues['me/app'], 2);

  const db2 = new DatabaseSync(dbPath);
  db2.prepare('UPDATE repo_stats SET issues = 5 WHERE date = ?').run(iso(0));
  db2.close();
  const second = await alerts.run({ digest: true });
  assert.deepEqual(second.fired.map((a) => a.rule), ['issues']);
  assert.match(second.fired[0].title, /3 new open issues/);
  assert.equal(second.digest.github.views, 30);
});

test('desktopNotify passes text as argv, never inside the script', async () => {
  let seen;
  const exec = (cmd, args, opts, cb) => {
    seen = { cmd, args };
    cb(null);
  };
  const r = await desktopNotify('Title "x"', 'body"; do shell script "rm -rf ~"', { exec, platform: 'darwin' });
  assert.deepEqual(r, { ok: true });
  assert.equal(seen.cmd, 'osascript');
  assert.doesNotMatch(seen.args[1], /rm -rf/);
  assert.equal(seen.args[3], 'body"; do shell script "rm -rf ~"');
  assert.equal((await desktopNotify('a', 'b', { exec, platform: 'linux' })).ok, false);
});

test('postWebhook sends Slack- and Discord-compatible JSON', async () => {
  let body;
  const ok = await postWebhook('https://example.test/hook', 'hello', async (url, init) => {
    body = JSON.parse(init.body);
    return { ok: true };
  });
  assert.deepEqual(ok, { ok: true });
  assert.equal(body.text, 'hello');
  assert.equal(body.content, 'hello');
  const bad = await postWebhook('https://example.test/hook', 'x', async () => ({ ok: false, status: 404 }));
  assert.equal(bad.ok, false);
  assert.match(digestText({ day: '2026-10-29', sites: [], extensions: [], github: null, alerts: [] }), /No alerts/);
});

test('goals marked alert in .sitelens.yml alert on a drop, and the file tunes site rules', async () => {
  const dates = lastDays(NOW, 29);
  // sign_up: ~20 users a day, then 4 yesterday; purchase rises, but only drops are watched.
  const rows = dates.flatMap((d, i) => [
    { date: d.replaceAll('-', ''), eventName: 'sign_up', totalUsers: i === dates.length - 1 ? 4 : 20 + (i % 3) },
    { date: d.replaceAll('-', ''), eventName: 'purchase', totalUsers: i === dates.length - 1 ? 30 : 10 },
  ]);
  const reports = [];
  const report = async ({ body }) => (reports.push(body), { rows });
  const siteConfig = {
    applied: async () => ({
      goals: [
        { id: 'event-sign-up', label: 'Sign-ups', source: 'event', match: 'sign_up', role: 'outcome', alert: { when: 'drop', pct: 0.5, min: 5 } },
        { id: 'event-purchase', label: 'purchase', source: 'event', match: 'purchase', role: 'outcome', alert: { when: 'drop', pct: 0.5, min: 5 } },
        { id: 'page-pricing', label: '/pricing', source: 'page', match: '/pricing', role: 'step' },
      ],
      // The traffic spike from fakeEngines would alert; this site turns it off.
      alerts: { traffic: { enabled: false } },
    }),
  };
  const store = memoryStore({ sites: [trafficSite()], products: [{ id: 'shop', siteId: 's1' }], alertSettings: { desktop: false } });
  const alerts = createAlerts({
    store, engines: fakeEngines(), extensions: { list: async () => [] }, github: null, auth: { token: async () => 't' },
    siteConfig, report, now: () => NOW, notify: fakeNotify(),
  });
  const run = await alerts.run({ daily: true });
  assert.deepEqual(run.errors, []);
  assert.deepEqual(run.fired.map((a) => a.rule), ['goals']);
  assert.equal(run.fired[0].key, `goal:s1:event-sign-up:${localDay(NOW - DAY)}`);
  assert.match(run.fired[0].title, /Shop: Sign-ups dropped -8\d%/);
  assert.equal(run.fired[0].link, '#/outcomes/shop');
  // One report for both event goals; the step without alert isn't queried.
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0].dimensionFilter.andGroup.expressions[1].filter.inListFilter.values, ['sign_up', 'purchase']);
});

test('desktop notices: title, subtitle and detail, several items one per line', () => {
  const one = alertNotice([{ title: 'New Tab by Cooldesk: users down 3 (-6%)', detail: '50 users on the listing.', subject: { label: 'New Tab by Cooldesk' } }]);
  assert.deepEqual(one, { title: 'New Tab by Cooldesk', subtitle: 'users down 3 (-6%)', body: '50 users on the listing.' });
  const many = alertNotice(['A', 'B', 'C', 'D', 'E'].map((t) => ({ title: t, detail: '' })));
  assert.equal(many.subtitle, '5 new alerts');
  assert.deepEqual(many.body.split('\n'), ['• A', '• B', '• C', 'and 2 more in Alerts']);
  const d = digestNotice({ day: '2026-11-07', sites: [{ label: 'cooldesk', sessions: 28, sessionsChange: 0.75 }, { label: 'infraplan', error: 'x' }], extensions: [{ label: 'New Tab', users: 50 }], alerts: [{}] });
  assert.deepEqual(d, { title: 'SiteLens daily digest', subtitle: 'Saturday 7 Nov · 1 alert', body: 'cooldesk: 28 visits (+75%)\ninfraplan: couldn’t read\nNew Tab: 50 users' });
});

test('tagSites files alerts under a site directly or through its product', () => {
  const products = [{ siteId: 'cooldesk', repos: ['Me/CoolDesk-Extension'], extensionIds: ['abcdefghijklmnopabcdefghijklmnop'] }, { siteId: '', repos: ['me/lib'] }];
  const tagged = tagSites([
    { id: '1', subject: { type: 'site', id: 'infraplan' } },
    { id: '2', subject: { type: 'repo', id: 'me/cooldesk-extension' } },
    { id: '3', subject: { type: 'extension', id: 'abcdefghijklmnopabcdefghijklmnop' } },
    { id: '4', subject: { type: 'repo', id: 'me/lib' } },
    { id: '5', subject: { type: 'mention', id: 'cooldesk' } },
  ], products);
  assert.deepEqual(tagged.map((a) => a.site), ['infraplan', 'cooldesk', 'cooldesk', '', '']);
});
