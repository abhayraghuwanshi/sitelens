import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyEvents, autoGoals, buildFunnel, goalRates, byFamily, listingFamilies, RULES, insights, headline, rollup, lowerWord } from '../server/outcomes.mjs';
import { normalizeGoals } from '../server/products.mjs';

const EVENTS = [
  { name: 'page_view', events: 900, users: 480 },
  { name: 'downloads_section_view', events: 300, users: 212 },
  { name: 'download_cta_click', events: 43, users: 34 },
  { name: 'hero_cta_click', events: 39, users: 32 },
  { name: 'file_download', events: 31, users: 26 },
  { name: 'widget_row_scroll', events: 33, users: 7 },
  { name: 'new_tab_theme_preview', events: 5, users: 1 },
];

test('classifyEvents splits completions, intents and the downloads section', () => {
  const g = classifyEvents(EVENTS);
  assert.deepEqual(g.completions.map((e) => e.name), ['file_download']);
  assert.deepEqual(g.intents.map((e) => e.name), ['download_cta_click', 'hero_cta_click']);
  assert.equal(g.section.name, 'downloads_section_view');
});

// Auto goals with the counts the service would measure for them.
const measuredAuto = (opts = { hasStore: true, hasRepos: true }) => {
  const users = Object.fromEntries(EVENTS.map((e) => [e.name, e.users]));
  return autoGoals(classifyEvents(EVENTS), opts).map((g) => ({ ...g, count: g.match ? users[g.match] : 0 }));
};

test('autoGoals: section and top click are steps; a site download is a step when release downloads count', () => {
  const g = autoGoals(classifyEvents(EVENTS), { hasStore: true, hasRepos: true });
  assert.deepEqual(g.map((x) => [x.match || x.source, x.role]), [
    ['downloads_section_view', 'step'], ['download_cta_click', 'step'], ['file_download', 'step'], ['installs', 'outcome'], ['downloads', 'outcome'],
  ]);
  assert.equal(autoGoals(classifyEvents(EVENTS)).find((x) => x.match === 'file_download').role, 'outcome');
});

test('buildFunnel orders site goals (steps first), rates each and finds the biggest drop', () => {
  const f = buildFunnel({ visitors: 496, goals: measuredAuto(), listingFromSite: 9, installsFromSite: 2 });
  assert.deepEqual(f.steps.map((s) => s.event || s.key), ['visitors', 'downloads_section_view', 'download_cta_click', 'file_download']);
  assert.deepEqual(f.steps.map((s) => s.kind), ['visit', 'view', 'click', 'click']);
  assert.equal(f.leak.to.event, 'download_cta_click');
  assert.ok(Math.abs(f.store.rate - 9 / 496) < 1e-9);
});

test('buildFunnel puts steps biggest first, whatever order the goals were written in', () => {
  const goals = [
    { id: 'click', label: 'Clicked to download', source: 'event', match: 'download_cta_click', role: 'step', count: 47 },
    { id: 'view', label: 'Saw the downloads section', source: 'event', match: 'downloads_section_view', role: 'step', count: 243 },
    { id: 'dl', label: 'Started a download', source: 'event', match: 'file_download', role: 'outcome', count: 37 },
  ];
  const f = buildFunnel({ visitors: 570, goals });
  assert.deepEqual(f.steps.map((s) => s.key), ['visitors', 'view', 'click', 'dl']);
  assert.ok(f.steps.every((s) => s.rate === undefined || s.rate <= 1));
  assert.equal(f.leak.to.key, 'click');
});

test('goalRates takes session_start as visitors and the best goal event; byFamily merges sources', () => {
  const rows = [
    { key: 'google', event: 'session_start', users: 150 },
    { key: 'google', event: 'download_cta_click', users: 20 },
    { key: 'google', event: 'file_download', users: 12 },
    { key: 'google.com', event: 'session_start', users: 50 },
    { key: 'google.com', event: 'file_download', users: 8 },
    { key: '(direct)', event: 'session_start', users: 225 },
  ];
  const rates = goalRates(rows, ['download_cta_click', 'file_download']);
  assert.deepEqual(rates.find((r) => r.key === 'google'), { key: 'google', visitors: 150, goalUsers: 20, rate: 20 / 150 });
  const fam = byFamily(rates);
  assert.equal(fam.find((r) => r.key === 'Google').visitors, 200);
  assert.equal(fam.find((r) => r.key === 'Direct').goalUsers, 0);
});

test('listingFamilies groups store sources with install rate', () => {
  const l = listingFamilies([
    { source: 'reddit.com', visitors: 30, installs: 6, installers: 4 },
    { source: 'old.reddit.com', visitors: 2, installs: 0, installers: 0 },
    { source: 'google', visitors: 8, installs: 5, installers: 5 },
  ]);
  assert.equal(l[0].key, 'Reddit');
  assert.equal(l[0].visitors, 32);
  assert.equal(l[1].rate, 5 / 8);
});

test('untracked fires only when GA4 has no key events but goal events exist', () => {
  const eventGoals = ['file_download', 'download_cta_click'];
  assert.equal(RULES.untracked({ keyEvents: 0, eventGoals, site: { propertyId: '1' } }).tone, 'bad');
  assert.equal(RULES.untracked({ keyEvents: 4, eventGoals, site: {} }), null);
  assert.equal(RULES.untracked({ keyEvents: 0, eventGoals: [], site: {} }), null);
});

test('siteToStore warns under 5% and needs 100 visitors', () => {
  const funnel = (visitors, from) => buildFunnel({ visitors, goals: [], listingFromSite: from, installsFromSite: 1 });
  assert.equal(RULES.siteToStore({ funnel: funnel(496, 9), siteHost: 'x.com' }).tone, 'warn');
  assert.equal(RULES.siteToStore({ funnel: funnel(496, 60), siteHost: 'x.com' }).tone, 'good');
  assert.equal(RULES.siteToStore({ funnel: funnel(50, 1), siteHost: 'x.com' }), null);
});

test('deadChannel flags big low-engagement channels as bots', () => {
  const channels = [{ key: 'Direct', visitors: 225, goalUsers: 3, rate: 3 / 225 }, { key: 'Google', visitors: 202, goalUsers: 28, rate: 0.14 }];
  const r = RULES.deadChannel({ channels, engagement: new Map([['Direct', 0.2]]) });
  assert.match(r.title, /^Direct: 53% of visitors, only 3 conversions/);
  assert.match(r.detail, /bots/);
});

test('spike: converted vs not', () => {
  const dates = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const sessions = [10, 12, 11, 10, 60, 12, 10, 11, 10, 12];
  assert.equal(RULES.spike({ dates, sessionSeries: sessions, dailyOutcomes: [1, 1, 1, 1, 6, 3, 1, 1, 1, 1] }).tone, 'good');
  assert.equal(RULES.spike({ dates, sessionSeries: sessions, dailyOutcomes: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }).tone, 'warn');
  assert.equal(RULES.spike({ dates, sessionSeries: sessions.map(() => 10), dailyOutcomes: sessions }), null);
});

test('efficiency names its basis; insights sort by impact; headline keeps acronyms', () => {
  const e = RULES.efficiency({ outcomes: { value: 32, previous: 11, basis: 'Store installs' }, sessions: { value: 616, previous: 377 }, days: 28 });
  assert.match(e.title, /^Store installs \+191% while traffic \+63%/);
  const list = insights({
    keyEvents: 0, eventGoals: ['file_download'], site: {}, siteHost: 'x.com', days: 28,
    funnel: buildFunnel({ visitors: 496, goals: measuredAuto(), listingFromSite: 9, installsFromSite: 2 }),
    outcomes: { value: 32, previous: 11, basis: 'Store installs' }, sessions: { value: 616, previous: 377 },
    listing: [], channels: [], engagement: new Map(), pages: [], countries: [], dates: [],
  });
  assert.equal(list[0].key, 'untracked');
  assert.ok(list.every((x, i) => i === 0 || list[i - 1].impact >= x.impact));
  const h = headline({ label: 'Cooldesk', days: 28, outcomes: { value: 66, previous: null }, trend: { value: 32, previous: 11, basis: 'Store installs' }, parts: ['32 store installs', '34 desktop downloads'], funnel: { steps: [{ users: 496 }] }, list });
  assert.equal(h, 'Cooldesk, last 28 days: 66 outcomes (32 store installs, 34 desktop downloads), store installs +191%, 13.3 per 100 site visitors. Fix first: GA4 counts 0 conversions.');
});

test('rollup: totals outcomes, compares only goals with history, sums value', () => {
  const r = rollup([
    { label: 'Clicked', role: 'step', count: 34, previous: 13 },
    { label: 'Store installs', role: 'outcome', count: 32, previous: 11, revenue: 48 },
    { label: 'Desktop downloads', role: 'outcome', count: 34, previous: null },
    { label: 'GitHub stars', role: 'outcome', count: 0, previous: null },
  ]);
  assert.equal(r.outcomes.value, 66);
  assert.equal(r.outcomes.previous, null);
  assert.deepEqual(r.trend, { value: 32, previous: 11, basis: 'Store installs' });
  assert.equal(r.revenue, 48);
  // A zero goal without history neither shows up nor blocks the like-for-like comparison.
  assert.deepEqual(r.parts, ['32 store installs', '34 desktop downloads']);
  const whole = rollup([{ label: 'Purchase', role: 'outcome', count: 5, previous: 4 }, { label: 'GitHub stars', role: 'outcome', count: 0, previous: null }]);
  assert.equal(whole.trend.basis, 'all');
  assert.equal(whole.outcomes.previous, 4);
  assert.equal(lowerWord('GitHub stars'), 'GitHub stars');
  assert.equal(lowerWord('Store installs'), 'store installs');
});

test('normalizeGoals validates types, event names and paths', () => {
  const g = normalizeGoals([
    { label: 'Purchase', source: 'event', match: 'purchase', value: '19.99' },
    { source: 'page', match: 'https://cool-desk.com/pricing', role: 'step' },
    { source: 'installs', match: 'ignored' },
  ]);
  assert.deepEqual(g, [
    { id: 'event-purchase', label: 'Purchase', source: 'event', match: 'purchase', role: 'outcome', value: 19.99 },
    { id: 'page-pricing', label: '/pricing', source: 'page', match: '/pricing', role: 'step' },
    { id: 'installs-installs', label: 'Store installs', source: 'installs', role: 'outcome' },
  ]);
  assert.throws(() => normalizeGoals([{ source: 'event', match: 'bad name' }]), /GA4 event name/);
  assert.throws(() => normalizeGoals([{ source: 'page', match: 'pricing' }]), /page path/);
  assert.throws(() => normalizeGoals([{ source: 'mrr' }]), /Unknown goal type/);
  assert.throws(() => normalizeGoals([{ source: 'installs' }, { source: 'installs' }]), /twice/);
  assert.deepEqual(normalizeGoals(undefined), []);
});
