import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRdap, dnsHost, sourceFamily, referrerShifts, gradeDomain, gradeDeploys, speedRegression,
  gradeSpeed, gradeTraffic, gradeOutcome, summarize, createJourney, formatPct,
} from '../server/journey.mjs';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const DAY = 86_400_000;

test('parseRdap reads expiry, registrar and nameservers', () => {
  const r = parseRdap({
    events: [{ eventAction: 'registration', eventDate: '2025-08-21T21:23:26Z' }, { eventAction: 'expiration', eventDate: '2027-08-21T21:23:26Z' }],
    entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'HOSTINGER operations, UAB']]] }],
    nameservers: [{ ldhName: 'NS1.DNS-PARKING.COM' }, { ldhName: 'NS2.DNS-PARKING.COM' }],
  });
  assert.equal(r.expires, Date.parse('2027-08-21T21:23:26Z'));
  assert.equal(r.registrar, 'HOSTINGER operations, UAB');
  assert.deepEqual(r.nameservers, ['ns1.dns-parking.com', 'ns2.dns-parking.com']);
  assert.equal(dnsHost(r.nameservers), 'Hostinger');
  assert.equal(dnsHost(['amy.ns.cloudflare.com']), 'Cloudflare');
  assert.equal(dnsHost(['ns.example.net']), '');
});

test('sourceFamily groups GA4 sources; referrerShifts ranks by gain', () => {
  assert.equal(sourceFamily('out.reddit.com'), 'Reddit');
  assert.equal(sourceFamily('reddit'), 'Reddit');
  assert.equal(sourceFamily('news.ycombinator.com'), 'Hacker News');
  assert.equal(sourceFamily('t.co'), 'X');
  assert.equal(sourceFamily('google'), 'Google');
  assert.equal(sourceFamily('(direct)'), 'Direct');
  assert.equal(sourceFamily('blog.example.co.uk'), 'example.co.uk');
  const shifts = referrerShifts(
    [{ source: 'reddit.com', sessions: 40 }, { source: 'old.reddit.com', sessions: 10 }, { source: 'google', sessions: 30 }],
    [{ source: 'reddit.com', sessions: 2 }, { source: 'google', sessions: 35 }],
  );
  assert.deepEqual(shifts.map((s) => [s.label, s.value, s.gain]), [['Reddit', 50, 48], ['Google', 30, -5]]);
  // Daily comparison: previous week scaled to a typical day.
  assert.equal(referrerShifts([{ source: 'google', sessions: 10 }], [{ source: 'google', sessions: 70 }], { scale: 1 / 7 })[0].previous, 10);
});

test('gradeDomain flags expiring domains, failing renewals and broken DNS', () => {
  const ok = { rdap: { expires: NOW + 300 * DAY, registrar: 'Hostinger' }, tls: { validTo: NOW + 60 * DAY, trusted: true, issuer: 'LE' }, dns: { a: ['1.2.3.4'], aaaa: [], cname: [] } };
  assert.equal(gradeDomain(ok, NOW).status, 'good');
  const soon = gradeDomain({ ...ok, rdap: { expires: NOW + 33 * DAY } }, NOW);
  assert.equal(soon.status, 'warn');
  assert.match(soon.headline, /Domain expires in 33d/);
  assert.equal(gradeDomain({ ...ok, tls: { validTo: NOW + 5 * DAY, trusted: true } }, NOW).status, 'bad');
  assert.equal(gradeDomain({ ...ok, tls: { validTo: NOW + 60 * DAY, trusted: false, error: 'CERT_HAS_EXPIRED' } }, NOW).status, 'bad');
  assert.equal(gradeDomain({ ...ok, dns: { a: [], aaaa: [], cname: [] } }, NOW).status, 'bad');
  // No RDAP is unknown, not a failure.
  assert.equal(gradeDomain({ ...ok, rdap: null, rdapError: 'HTTP 403' }, NOW).status, 'good');
});

test('gradeDeploys spots a 5xx jump after the latest deploy', () => {
  const dates = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
  const ships = [{ id: 'd1', date: '2026-10-27', label: 'Deploy: abc', kind: 'deploy' }];
  const requests = [1000, 1000, 1000, 1000, 1000];
  const calm = gradeDeploys({ ships, dates, requests, errors: [1, 2, 1, 2, 1] });
  assert.equal(calm.status, 'good');
  assert.equal(calm.lastDeploy, '2026-10-27');
  const spike = gradeDeploys({ ships, dates, requests, errors: [1, 2, 1, 40, 30] });
  assert.equal(spike.status, 'warn');
  assert.match(spike.headline, /Server errors up since the deploy on Tue 27 Oct/);
  assert.equal(gradeDeploys({ ships: [], dates }).status, 'idle');
});

test('speedRegression compares mobile LCP before and after a deploy', () => {
  const at = (d) => Date.parse(`${d}T06:00:00Z`);
  const runs = [
    { strategy: 'mobile', at: at('2026-10-20'), lcp: 2000 },
    { strategy: 'mobile', at: at('2026-10-21'), lcp: 2100 },
    { strategy: 'desktop', at: at('2026-10-28'), lcp: 900 },
    { strategy: 'mobile', at: at('2026-10-28'), lcp: 3200 },
  ];
  assert.deepEqual(speedRegression(runs, '2026-10-27'), { before: 2100, after: 3200 });
  assert.equal(speedRegression(runs.slice(0, 2), '2026-10-27'), null);
  const graded = gradeSpeed({ uptime: { last: { ok: true }, week: { pct: 1 } }, vitals: {} }, { regression: { before: 2100, after: 3200 }, deployDate: '2026-10-27' });
  assert.equal(graded.status, 'warn');
  assert.equal(graded.headline, 'Page load got slower after the deploy on Tue 27 Oct');
});

test('gradeSpeed uses plain names and the worst grade', () => {
  const s = gradeSpeed({
    uptime: { last: { ok: true }, week: { pct: 1 } },
    vitals: { lcp: { value: 3200, rating: 'needs-improvement', source: 'field' }, inp: { value: 150, metric: 'tbt', rating: 'good', source: 'lab' }, cls: { value: 0.02, rating: 'good' } },
  });
  assert.equal(s.status, 'warn');
  assert.equal(s.headline, 'Page load: needs work · 3.2 s');
  assert.ok(s.items.some((i) => i.label === 'Main-thread blocking' && /lab/.test(i.text)));
  assert.equal(gradeSpeed({ uptime: { last: { ok: false, error: 'timeout' }, week: { pct: 0.99 } }, vitals: {} }).status, 'bad');
  assert.equal(gradeSpeed(undefined).status, 'off');
});

test('gradeTraffic names the cause, skipping Direct, and quotes a matching post', () => {
  const gainers = [{ label: 'Direct', gain: 30 }, { label: 'Reddit', gain: 120 }, { label: 'Google', gain: 10 }];
  const mentions = [{ source: 'reddit', title: 'I built a new-tab dashboard', points: 340, permalink: 'https://reddit.com/x' }];
  const t = gradeTraffic({ sessions: { value: 400, previous: 240 }, gainers, mentions, days: 7 });
  assert.equal(t.headline, 'Traffic +67%, mostly from Reddit (“I built a new-tab dashboard”)');
  const led = gradeTraffic({ sessions: { value: 400, previous: 240 }, gainers: [{ label: 'Google', gain: 40 }], mentions: [], days: 7 });
  assert.equal(led.headline, 'Traffic +67%, led by Google');
  assert.equal(gradeTraffic({ sessions: { value: 100, previous: 240 }, gainers: [], mentions: [], days: 7 }).status, 'bad');
  assert.equal(gradeTraffic({ days: 7 }).status, 'off');
  assert.equal(formatPct(-0.1), '−10%');
});

test('gradeOutcome and summarize roll stages into one sentence', () => {
  const outcome = gradeOutcome([{ key: 'installs', label: 'Store installs', value: 32, previous: 11 }, { key: 'sessions', label: 'x', value: 1 }]);
  assert.equal(outcome.headline, 'Store installs 32 (+191%)');
  const stages = [
    { key: 'domain', label: 'Domain & hosting', status: 'good', headline: 'fine' },
    { key: 'deploy', label: 'Deploys', status: 'good', headline: '2 ships' },
    { key: 'speed', label: 'Speed', status: 'warn', headline: 'Page load got slower after the deploy on Tue 27 Oct' },
    { key: 'traffic', label: 'Traffic', status: 'good', headline: 'Traffic +18%, mostly from Reddit' },
    { key: 'outcome', label: 'Outcome', status: 'off', headline: '' },
  ];
  assert.deepEqual(summarize('Cooldesk', 7, stages), {
    text: 'Cooldesk, last 7 days: traffic +18%, mostly from Reddit. Page load got slower after the deploy on Tue 27 Oct. Domain & hosting and deploys are fine.',
    status: 'warn',
  });
  assert.equal(summarize('X', 7, stages.map((s) => ({ ...s, status: s.key === 'speed' ? 'good' : s.status }))).text, 'X, last 7 days: traffic +18%, mostly from Reddit. Nothing needs attention.');
});

test('journey service: every source fails on its own and domain checks are injected', async () => {
  const site = { id: 's1', host: 'cool-desk.com', propertyId: '' };
  const product = { id: 'cooldesk', label: 'Cooldesk', siteId: 's1', repos: [], extensionIds: [] };
  const journey = createJourney({
    now: () => NOW,
    store: { sites: async () => [site] },
    products: { list: async () => [product], get: async () => ({ kpis: [{ key: 'sessions', label: 'Site sessions', value: 120, previous: 100 }] }) },
    vitals: { summary: async () => { throw new Error('vitals db locked'); }, detail: async () => ({}) },
    firebase: { overview: async () => { throw Object.assign(new Error('not linked'), { kind: 'needs-firebase' }); } },
    mentions: { between: async () => [] },
    annotations: { list: async () => [{ id: 'r1', date: '2026-10-29', label: 'v1.2', kind: 'release' }] },
    auth: { token: async () => 'x' },
    checks: {
      rdap: async () => ({ expires: NOW + 20 * DAY, registrar: 'Hostinger', nameservers: ['ns1.dns-parking.com'] }),
      tls: async () => ({ validTo: NOW + 60 * DAY, trusted: true, issuer: 'LE' }),
      dns: async () => ({ a: ['1.1.1.1'], aaaa: [], cname: [] }),
    },
  });
  const j = await journey.get('cooldesk', '7d');
  const by = Object.fromEntries(j.stages.map((s) => [s.key, s]));
  assert.equal(by.domain.status, 'warn');
  assert.equal(by.deploy.status, 'good');
  assert.equal(by.speed.status, 'off');
  assert.equal(by.traffic.headline, 'Traffic +20%');
  assert.deepEqual(Object.keys(j.errors), ['vitals']);
  assert.match(j.summary.text, /^Cooldesk, last 7 days: traffic \+20%\. Domain expires in 20d/);

  const day = await journey.day('cooldesk', '2026-10-29');
  assert.equal(day.annotations.length, 1);
  assert.equal(day.sessions, null);
  await assert.rejects(() => journey.day('cooldesk', 'nope'), /Pick a day/);
  await assert.rejects(() => journey.get('missing', '7d'), /Unknown product/);
});
