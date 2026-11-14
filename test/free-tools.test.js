import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normCdf, normInv, abTest, sampleSize, beforeAfter, parseSeries, tTwoSided } from '../tools/assets/lib/stats.js';
import { buildUtm, inspectUrl } from '../tools/assets/lib/utm.js';
import { identifyBot, buildRobots, analyzeLogs } from '../tools/assets/lib/bots.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) < tol, `${a} not within ${tol} of ${b}`);

test('normal distribution helpers', () => {
  near(normCdf(1.96), 0.975, 1e-4);
  near(normInv(0.975), 1.959964, 1e-5);
  near(normInv(0.01), -2.326348, 1e-5);
});

test('t distribution p-value', () => {
  near(tTwoSided(2.228, 10), 0.05, 1e-3);
  near(tTwoSided(1.96, 1e6), 0.05, 1e-3);
});

test('A/B test matches a textbook two-proportion z-test', () => {
  const r = abTest({ visitorsA: 1000, conversionsA: 100, visitorsB: 1000, conversionsB: 130 });
  near(r.z, 2.1, 0.02);
  near(r.pValue, 0.0357, 0.002);
  assert.equal(r.significant, true);
  near(r.lift, 0.3, 1e-9);
  assert.ok(r.chanceBBeatsA > 0.97);
  assert.ok(abTest({ visitorsA: 10, conversionsA: 20, visitorsB: 10, conversionsB: 1 }).error);
});

test('sample size matches the usual calculators', () => {
  // 10% baseline, +20% relative, 95% / 80% -> about 3,840 per variant.
  const r = sampleSize({ baseline: 0.1, mde: 0.2 });
  assert.ok(r.perVariant > 3700 && r.perVariant < 3900, String(r.perVariant));
});

test('before/after spots a real lift and ignores noise', () => {
  const before = [100, 104, 98, 101, 97, 60, 62, 99, 103, 100, 102, 98, 61, 59];
  const lifted = before.map((x) => x * 1.4);
  const up = beforeAfter(before, lifted);
  assert.equal(up.verdict, 'up');
  near(up.change, 0.4, 1e-9);
  assert.equal(up.method, 'paired');
  assert.equal(beforeAfter(before, lifted.slice(0, 10)).method, 'welch');
  const flat = beforeAfter(before, [...before].reverse());
  assert.equal(flat.verdict, 'none');
  assert.deepEqual(flat.warnings, []);
  assert.ok(beforeAfter([1, 2], [3, 4, 5]).error);
});

test('parseSeries reads lists and spreadsheet rows', () => {
  assert.deepEqual(parseSeries('1\n2\n3'), [1, 2, 3]);
  assert.deepEqual(parseSeries('4, 5, 6.5'), [4, 5, 6.5]);
  assert.deepEqual(parseSeries('2026-11-01\t1,204\n2026-11-02\t980'), [1204, 980]);
  assert.deepEqual(parseSeries('Nov 1, 2026  12'), [12]);
});

test('UTM builder keeps other params and replaces old tags', () => {
  const r = buildUtm('example.com/pricing?plan=pro&utm_source=old#faq', { source: 'Reddit', medium: 'social', campaign: 'Spring Sale' });
  assert.equal(r.url, 'https://example.com/pricing?plan=pro&utm_source=reddit&utm_medium=social&utm_campaign=spring-sale#faq');
  assert.deepEqual(r.warnings, []);
  assert.ok(buildUtm('https://x.com', { source: 'a', medium: 'newsletter' }).warnings.some((w) => w.includes('default channel')));
  assert.ok(buildUtm('', {}).error);
});

test('link cleaner strips click IDs', () => {
  const r = inspectUrl('https://example.com/a?id=3&utm_source=x&fbclid=abc&gclid=1');
  assert.equal(r.clean, 'https://example.com/a?id=3');
  assert.deepEqual(r.utm, { utm_source: 'x' });
});

test('bot detection prefers the most specific token', () => {
  assert.equal(identifyBot('Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)').token, 'Claude-User');
  assert.equal(identifyBot('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)').token, 'GPTBot');
  assert.equal(identifyBot('Mozilla/5.0 (Macintosh) Safari/605'), null);
});

test('robots.txt blocks training bots and keeps search open', () => {
  const txt = buildRobots({ policy: { GPTBot: 'block', ClaudeBot: 'block', 'OAI-SearchBot': 'allow' }, disallow: ['admin'], sitemaps: ['https://x.com/sitemap.xml'] });
  assert.match(txt, /User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: \/\n/);
  assert.match(txt, /User-agent: OAI-SearchBot\nDisallow: \/admin/);
  assert.match(txt, /User-agent: \*\nDisallow: \/admin\n\nSitemap: https:\/\/x.com\/sitemap.xml\n$/);
});

test('log analyzer reads combined logs and JSON lines', () => {
  const logs = [
    '1.2.3.4 - - [14/Nov/2026:10:00:00 +0000] "GET /blog/post?x=1 HTTP/1.1" 200 512 "-" "Mozilla/5.0 (compatible; GPTBot/1.2)"',
    '1.2.3.4 - - [14/Nov/2026:10:00:01 +0000] "GET /missing HTTP/1.1" 404 0 "-" "Mozilla/5.0 (compatible; GPTBot/1.2)"',
    '{"path":"/docs","statusCode":200,"userAgent":"PerplexityBot/1.0"}',
    '5.6.7.8 - - [14/Nov/2026:10:00:02 +0000] "GET / HTTP/1.1" 200 1 "-" "Mozilla/5.0 Safari"',
  ].join('\n');
  const r = analyzeLogs(logs);
  assert.equal(r.lines, 4);
  assert.equal(r.matched, 3);
  assert.equal(r.bots[0].bot.token, 'GPTBot');
  assert.equal(r.bots[0].errors, 1);
  assert.deepEqual(r.bots[0].paths[0], ['/blog/post', 1]);
  assert.equal(r.bots[1].paths[0][0], '/docs');
});
