import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createCalendar, calendarRoutes, addDays, monthDays, weekdayBaseline, dayTone, alertDay, shiftRows, composeStory, githubDaily, demoDay,
} from '../server/calendar.mjs';
import { createCalendarStore, HISTORY_DAYS } from '../server/calendar-store.mjs';
import { DEMO_SITE, ValidationError } from '../server/store.mjs';

const NOW = new Date(2026, 10, 2, 15, 0, 0).getTime(); // Mon 2 Nov 2026, local 15:00

function memoryStore(initial = {}) {
  const state = { sites: [], ...initial };
  return {
    async get() {
      return state;
    },
    async sites() {
      return state.sites;
    },
  };
}

test('date helpers: addDays, monthDays', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(monthDays('2026-02').length, 28);
  assert.equal(monthDays('2028-02').at(-1), '2028-02-29');
  assert.equal(monthDays('2026-10')[0], '2026-10-01');
});

test('weekdayBaseline takes the median of the same weekday, stopping at the series start', () => {
  const values = new Map([['2026-10-07', 100], ['2026-10-14', 200], ['2026-10-21', 300], ['2026-09-30', 400]]);
  assert.equal(weekdayBaseline(values, '2026-10-28'), 250);
  // One spike doesn't lift the next weeks' baseline.
  assert.equal(weekdayBaseline(new Map([['2026-10-07', 100], ['2026-10-14', 900], ['2026-10-21', 110], ['2026-09-30', 90]]), '2026-10-28'), 105);
  // Missing days inside the window are zeros (GA4 omits zero rows).
  assert.equal(weekdayBaseline(new Map([['2026-10-21', 80], ['2026-10-14', 60]]), '2026-10-28'), 30);
  assert.equal(weekdayBaseline(values, '2026-10-28', { weeks: 3 }), 200);
  assert.equal(weekdayBaseline(values, '2026-10-28', { start: '2026-10-10' }), 250);
  assert.equal(weekdayBaseline(values, '2026-10-28', { start: '2026-10-25' }), null);
});

test('dayTone: thresholds, small volumes and missing data', () => {
  assert.equal(dayTone(150, 100).tone, 'up2');
  assert.equal(dayTone(120, 100).tone, 'up');
  assert.equal(dayTone(105, 100).tone, 'flat');
  assert.equal(dayTone(80, 100).tone, 'down');
  assert.equal(dayTone(50, 100).tone, 'down2');
  assert.equal(dayTone(4, 1).tone, 'flat');
  assert.deepEqual(dayTone(null, 100), { change: null, tone: 'none' });
  assert.equal(dayTone(10, 0).change, Infinity);
});

test('alertDay reads the date from the key, else the day it fired', () => {
  assert.equal(alertDay({ key: 'traffic:a:sessions:2026-10-14', at: NOW }), '2026-10-14');
  assert.equal(alertDay({ key: 'mention:abc', at: new Date(2026, 9, 3, 12).getTime() }), '2026-10-03');
});

test('shiftRows scales the window to the expected day and sorts by gain', () => {
  const rows = shiftRows(
    [{ key: 'google', value: 50 }, { key: 'reddit.com', value: 120 }],
    [{ key: 'google', value: 1400 }, { key: 'reddit.com', value: 140 }, { key: 't.co', value: 60 }],
    { scale: 1 / 28 },
  );
  assert.deepEqual(rows.map((r) => r.label), ['reddit.com', 'google', 't.co']);
  assert.equal(rows[0].expected, 5);
  assert.equal(rows[0].gain, 115);
  assert.equal(rows[1].gain, 0);
  assert.equal(rows.at(-1).gain, -2.1);
});

test('composeStory: headline by tone, drivers only when the day moved', () => {
  const sources = [{ label: 'Reddit', value: 300, expected: 10, gain: 290 }, { label: 'Google', value: 90, expected: 100, gain: -10 }];
  const pages = [{ label: '/blog/post', value: 280, expected: 5, gain: 275 }];
  const big = composeStory({
    date: '2026-10-17', today: '2026-11-02', sessions: 650, baseline: 300,
    sites: [{ id: 'a', label: 'A', sessions: 650, baseline: 300, sources, pages, search: { clicks: 40, baseline: 38, queries: [{ query: 'foo', clicks: 9 }] } }],
    events: [{ label: 'Your Reddit post: hello' }],
    eventsBefore: [{ label: 'app v1.2' }],
    alerts: [{ title: 'A: sessions spiked +117%' }],
    github: { stars: 12, top: 'me/app' },
  });
  assert.equal(big.tone, 'up2');
  assert.equal(big.headline, 'Big day: 650 visits, 2.2× a usual Saturday (~300).');
  const text = big.lines.map((l) => l.text);
  assert.ok(text.includes('300 visits came from Reddit (usually ~10).'));
  assert.ok(text.includes('/blog/post got the most extra: 280 visits started there (usually ~5).'));
  assert.ok(text.includes('Clicks from Google and Bing results: 40. Top search: “foo”.'));
  assert.ok(text.includes('That day: Your Reddit post: hello.'));
  assert.ok(text.includes('The day before: app v1.2.'));
  assert.ok(text.includes('GitHub: +12 stars (most on me/app).'));
  assert.ok(text.some((t) => t.startsWith('Alert: A: sessions spiked')));

  const calm = composeStory({ date: '2026-10-14', sessions: 302, baseline: 300, sites: [{ id: 'a', label: 'A', sessions: 302, baseline: 300, sources, pages }], eventsBefore: [{ label: 'x' }] });
  assert.match(calm.headline, /^A typical Wednesday/);
  assert.equal(calm.lines.length, 0);

  const drop = composeStory({ date: '2026-10-14', sessions: 100, baseline: 300, sites: [{ id: 'a', label: 'A', sessions: 100, baseline: 300, sources, pages, search: { pending: true } }] });
  assert.match(drop.headline, /^Quiet day/);
  assert.equal(drop.headline, 'Quiet day: 100 visits, 67% fewer than a usual Wednesday (~300).');
  assert.ok(drop.lines.some((l) => l.text === 'Fewer came from Google search: 90 visits, usually ~100.'));
  assert.ok(drop.lines.some((l) => /lags 2–3 days/.test(l.text)));

  const today = composeStory({ date: '2026-11-02', today: '2026-11-02', sessions: 120, baseline: 400 });
  assert.equal(today.tone, 'none');
  assert.equal(today.headline, 'So far today: 120 visits (a full Monday is usually ~400).');

  // "Direct" is said in plain words, with what it means; the home page by name.
  const direct = composeStory({ date: '2026-11-19', sessions: 133, baseline: 36,
    sites: [{ id: 'a', label: 'A', sessions: 133, baseline: 36, sources: [{ label: 'Direct', value: 67, expected: 15, gain: 52 }], pages: [{ label: '/', value: 26, expected: 12, gain: 14 }] }] });
  assert.equal(direct.headline, 'Big day: 133 visits, 3.7× a usual Thursday (~36).');
  assert.equal(direct.lines[0].text, '67 visits came straight to the site (usually ~15). That’s visits with no link we can see: someone typed the address, used a bookmark, or tapped a link in an app or chat.');
  assert.equal(direct.lines[1].text, 'The home page got the most extra: 26 visits started there (usually ~12).');
  assert.equal(composeStory({ date: '2026-11-01' }).headline, 'No traffic data for this day.');
});

test('composeStory lists each site when several are in view', () => {
  const story = composeStory({
    date: '2026-10-14', sessions: 600, baseline: 400,
    sites: [{ id: 'a', label: 'A', sessions: 500, baseline: 200, sources: [{ label: 'HN', value: 300, expected: 5, gain: 295 }], pages: [] }, { id: 'b', label: 'B', sessions: 100, baseline: 200, sources: [], pages: [] }],
  });
  const text = story.lines.map((l) => l.text);
  assert.ok(text.includes('A: 500 visits (150% more than usual).'));
  assert.ok(text.includes('A: 300 visits came from HN (usually ~5).'));
  assert.ok(text.includes('B: 100 visits (50% fewer than usual).'));
  assert.equal(story.lines[0].href, '#/site/a/overview');
});

test('githubDaily: star gains per day with carry-forward, filtered by repo', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-cal-'));
  try {
    const path = join(dir, 'github.db');
    const db = new DatabaseSync(path);
    db.exec(`
      CREATE TABLE repos (id INTEGER PRIMARY KEY, name TEXT, hidden BOOLEAN DEFAULT 0);
      CREATE TABLE repo_stats (repo_id INTEGER, date TEXT, stars INTEGER);
      INSERT INTO repos VALUES (1, 'me/app', 0), (2, 'me/lib', 0);
      INSERT INTO repo_stats VALUES (1, '2026-09-30', 10), (1, '2026-10-01', 0), (1, '2026-10-02', 15), (1, '2026-10-03', 15),
        (2, '2026-10-01', 4), (2, '2026-10-02', 6);
    `);
    db.close();
    const all = githubDaily(path, { from: '2026-10-01', to: '2026-10-31' });
    assert.deepEqual(all.get('2026-10-02'), { stars: 7, top: 'me/app', topGain: 5 });
    assert.equal(all.has('2026-10-01'), false);
    assert.equal(githubDaily(path, { from: '2026-10-01', to: '2026-10-31', repos: ['me/lib'] }).get('2026-10-02').stars, 2);
    assert.equal(githubDaily(join(dir, 'missing.db'), { from: '2026-10-01', to: '2026-10-31' }).size, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('demo month: deterministic days, events from the demo story, future and today marked', async () => {
  const store = memoryStore({ sites: [DEMO_SITE], alerts: [{ id: 'x', key: 'traffic:demo:sessions:2026-11-01', at: NOW, title: 'Demo: sessions spiked', subject: { type: 'site', id: 'demo' } }] });
  const notes = [{ id: 'n1', date: '2026-11-01', label: 'Changed pricing', kind: 'note', source: 'notes' }];
  const calendar = createCalendar({ store, history: null, annotations: { list: async () => notes }, now: () => NOW });
  const m = await calendar.month({ month: '2026-11' });
  assert.equal(m.days.length, 30);
  assert.equal(m.days[0].sessions, demoDay('demo', '2026-11-01').sessions);
  assert.ok(m.days[0].baseline > 0);
  assert.equal(m.days[1].partial, true);
  assert.equal(m.days[1].tone, 'none');
  assert.ok(m.days[1].sessions < demoDay('demo', '2026-11-02').sessions);
  assert.equal(m.days[2].future, true);
  assert.equal(m.days[2].sessions, null);
  assert.equal(m.days[0].alerts.length, 1);
  assert.ok(m.days[0].events.some((e) => e.label === 'Changed pricing'));
  // Search Console lags: the last days of the window are pending, not zero.
  assert.equal(m.days[0].clicks, null);
  assert.equal(m.searchLast, '2026-10-30');

  const oct = await calendar.month({ month: '2026-10' });
  const eventDay = oct.days.find((d) => d.events.some((e) => e.source === 'demo'));
  assert.ok(eventDay, 'the demo month has at least one story day');
  const story = await calendar.day({ date: eventDay.date });
  assert.ok(story.lines.some((l) => l.kind === 'event'));
  assert.equal(story.trend.length, 29);
  assert.ok(story.sites[0].sources.length > 0);

  await assert.rejects(calendar.day({ date: '2026-11-09' }), ValidationError);
  await assert.rejects(calendar.day({ date: 'nope' }), ValidationError);
  await assert.rejects(calendar.month({ site: 'missing' }), ValidationError);
});

test('real sites read the local store: totals, story breakdowns and per-site errors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-cal-'));
  const site = { id: 'a', label: 'Site A', host: 'a.com', propertyId: '123', searchSite: 'sc-domain:a.com' };
  const broken = { id: 'b', label: 'Site B', host: 'b.com', propertyId: '456' };
  const reports = [];
  const report = async ({ propertyId, body }) => {
    reports.push({ propertyId, body });
    if (propertyId === '456') throw Object.assign(new Error('No access'), { kind: 'permission' });
    if (body.dimensions.length === 2) {
      return { rows: [
        { date: '20261014', sessionSource: 'reddit.com', landingPage: '/post', sessions: 60 },
        { date: '20261014', sessionSource: 'google', landingPage: '/', sessions: 30 },
        { date: '20261007', sessionSource: 'google', landingPage: '/', sessions: 30 },
      ] };
    }
    return { rows: [{ date: '20261014', sessions: 90, activeUsers: 70, screenPageViews: 200 }, { date: '20261007', sessions: 30, activeUsers: 20, screenPageViews: 60 }] };
  };
  const search = async ({ body }) => (body.dimensions.length === 1
    ? [{ key: '2026-10-14', keys: ['2026-10-14'], clicks: 12 }, { key: '2026-10-28', keys: ['2026-10-28'], clicks: 3 }]
    : [{ key: '2026-10-14', keys: ['2026-10-14', 'foo'], clicks: 7 }]);
  const store = memoryStore({ sites: [site, broken, DEMO_SITE] });
  const history = createCalendarStore({ dbPath: join(dir, 'calendar.db'), auth: { token: async () => 't' }, report, search, now: () => NOW, log: {} });
  const calendar = createCalendar({ store, history, annotations: { list: async () => [] }, now: () => NOW });
  try {
    const m = await calendar.month({ month: '2026-10' });
    assert.deepEqual(m.sites.map((s) => s.id), ['a', 'b']);
    // The first sync pulls the whole history window at once.
    assert.equal(reports[0].body.dateRanges[0].startDate, addDays('2026-11-02', -HISTORY_DAYS));
    const d14 = m.days.find((d) => d.date === '2026-10-14');
    assert.equal(d14.sessions, 90);
    assert.equal(d14.clicks, 12);
    assert.equal(m.days.find((d) => d.date === '2026-10-15').sessions, 0);
    assert.equal(m.days.find((d) => d.date === '2026-10-29').clicks, null);
    assert.deepEqual(m.errors.map((e) => e.site), ['Site B']);

    const story = await calendar.day({ date: '2026-10-14', site: 'a' });
    assert.equal(story.sites[0].sources[0].label, 'Reddit');
    assert.equal(story.sites[0].pages[0].label, '/post');
    assert.deepEqual(story.sites[0].search.queries, [{ query: 'foo', clicks: 7 }]);

    // A second look at the same day is served from the store.
    const before = reports.length;
    await calendar.day({ date: '2026-10-14', site: 'a' });
    assert.equal(reports.length, before);

    const metrics = await calendar.metrics({ from: '2026-10-13', to: '2026-10-15', site: 'a' });
    assert.deepEqual(metrics.days.map((d) => d.sessions), [0, 90, 0]);
    assert.equal(metrics.days[1].baseline, 0); // median of 30, 0, 0, 0
    assert.equal(metrics.totals.clicks, 12);
    const sources = await calendar.breakdown({ from: '2026-10-14', to: '2026-10-14', site: 'a', by: 'source' });
    assert.deepEqual(sources.rows.map((r) => [r.key, r.value]), [['Reddit', 60], ['Google', 30]]);
    // daily: each row's value on every date of the window, for the Timeline's lenses.
    const daily = await calendar.breakdown({ from: '2026-10-13', to: '2026-10-15', site: 'a', by: 'source', daily: true });
    assert.deepEqual(daily.dates, ['2026-10-13', '2026-10-14', '2026-10-15']);
    assert.deepEqual(daily.rows.find((r) => r.key === 'Reddit').days, [0, 60, 0]);
    assert.equal(sources.dates, undefined);
    const one = await calendar.breakdown({ from: '2026-10-13', to: '2026-10-15', site: 'a', by: 'source', daily: true, key: 'Google' });
    assert.deepEqual(one.rows.map((r) => r.key), ['Google']);
    await assert.rejects(calendar.breakdown({ from: '2026-10-14', to: '2026-10-14', by: 'nope' }), ValidationError);
    await assert.rejects(calendar.metrics({ from: '2024-01-01', to: '2026-10-14' }), /at most 500 days/);
  } finally {
    history.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('calendarRoutes pass month, site and date through', async () => {
  const calls = [];
  const routes = calendarRoutes({ calendar: { month: async (q) => (calls.push(['month', q]), {}), day: async (q) => (calls.push(['day', q]), {}) } });
  const call = (path) => {
    const url = new URL(`http://x${path}`);
    const route = routes.find(([, re]) => re.test(url.pathname));
    return route[2]({ query: url.searchParams });
  };
  await call('/api/calendar?month=2026-10&site=a&fresh=1');
  await call('/api/calendar/day?date=2026-10-14');
  assert.deepEqual(calls, [['month', { month: '2026-10', site: 'a', fresh: true }], ['day', { date: '2026-10-14', site: 'all' }]]);
});

test('goal breakdown: people per goal per day, every goal listed even on days with none', async () => {
  const site = { id: 'a', label: 'Site A', host: 'a.com', propertyId: '123' };
  const asked = [];
  const goalDays = async (s, from, to) => {
    asked.push([s.id, from, to]);
    return {
      goals: [{ key: 'Signed up' }, { key: 'Saw pricing' }],
      rows: [{ date: '2026-10-14', key: 'Signed up', value: 4 }, { date: '2026-10-13', key: 'Signed up', value: 1 }],
    };
  };
  const calendar = createCalendar({ store: memoryStore({ sites: [site] }), history: null, annotations: { list: async () => [] }, goalDays, now: () => NOW });
  const out = await calendar.breakdown({ from: '2026-10-13', to: '2026-10-15', site: 'a', by: 'goal', daily: true });
  assert.equal(out.metric, 'people');
  assert.deepEqual(out.rows.map((r) => [r.key, r.value, r.days]), [['Signed up', 5, [1, 4, 0]], ['Saw pricing', 0, [0, 0, 0]]]);
  assert.deepEqual(asked, [['a', '2026-10-10', '2026-10-15']]);
});

test('Timeline goals include product counts and preserve gaps in database averages', async () => {
  const site = { id: 'a', label: 'Site A', host: 'a.com' };
  const goalDays = async () => ({
    goals: [{ key: 'Extension installs' }, { key: 'Desktop downloads', sparse: true }],
    rows: [{ date: '2026-10-14', key: 'Extension installs', value: 4 }],
  });
  const customMetrics = {
    forSite: async (id, _, { window }) => {
      assert.equal(id, site.id);
      return { metrics: [{
        id: 'active', label: 'Active installs', summary: 'average', unit: 'installs',
        values: window.dates.map((date) => ({ '2026-10-13': 3, '2026-10-15': 5 })[date] ?? null),
      }] };
    },
  };
  const calendar = createCalendar({ store: memoryStore({ sites: [site] }), history: null, annotations: { list: async () => [] }, goalDays, customMetrics, now: () => NOW });
  const out = await calendar.breakdown({ from: '2026-10-13', to: '2026-10-15', site: 'a', by: 'goal', daily: true });
  const rows = new Map(out.rows.map((row) => [row.key, row]));
  assert.deepEqual(rows.get('Extension installs').days, [0, 4, 0]);
  assert.deepEqual(rows.get('Desktop downloads').days, [null, null, null]);
  assert.deepEqual(rows.get('metric:active').days, [3, null, 5]);
  assert.equal(rows.get('metric:active').summary, 'average');
  assert.equal(rows.get('metric:active').value, 4);
  const connected = await calendar.breakdown({ from: '2026-10-13', to: '2026-10-15', site: 'a', by: 'metric', daily: true });
  assert.equal(connected.metric, 'value');
  assert.deepEqual(connected.rows.map(({ key, days }) => [key, days]), [['metric:active', [3, null, 5]]]);
});

test('citation sources distinguish unchecked days from checked days with no citations', async () => {
  const site = { id: 'a', label: 'Site A', host: 'a.com' };
  const citationDays = async () => ({
    dates: ['2026-10-13', '2026-10-15'],
    rows: [
      { date: '2026-10-13', key: 'answers', value: 1 },
      { date: '2026-10-13', key: 'citing', value: 1 },
      { date: '2026-10-13', key: 'domain:example.com', value: 1 },
      { date: '2026-10-15', key: 'answers', value: 1 },
    ],
  });
  const calendar = createCalendar({ store: memoryStore({ sites: [site] }), history: null, annotations: { list: async () => [] }, citationDays, now: () => NOW });
  const out = await calendar.breakdown({ from: '2026-10-13', to: '2026-10-15', site: 'a', by: 'citation', daily: true });
  assert.deepEqual(out.rows.map((r) => [r.key, r.days]), [
    ['answers', [1, null, 1]],
    ['citing', [1, null, 0]],
    ['own', [0, null, 0]],
    ['domain:example.com', [1, null, 0]],
  ]);
  assert.equal(out.rows.at(-1).label, 'example.com');
});

test('Bing Timeline keeps unreleased days blank and charts reported zero clicks', async () => {
  const site = { id: 'a', label: 'Site A' };
  const calendar = createCalendar({
    store: memoryStore({ sites: [site] }), now: () => NOW,
    bingDays: async () => [{ date: '2026-10-13', clicks: 0, impressions: 4 }, { date: '2026-10-14', clicks: 2, impressions: 11 }],
  });
  const out = await calendar.breakdown({ from: '2026-10-13', to: '2026-10-15', site: 'a', by: 'bing', daily: true });
  assert.deepEqual(Object.fromEntries(out.rows.map((row) => [row.key, row.days])), { clicks: [0, 2, null], impressions: [4, 11, null] });
});
