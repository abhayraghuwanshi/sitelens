import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { checkPage, checkGuide, checkSite, LIMITS } from '../tools/seo-rules.mjs';
import { homePage } from '../server/home.mjs';
import { robotsTxt } from '../server/hosted.mjs';

const rules = (problems) => problems.map((p) => p.rule);

// A page that passes every rule; each test below breaks one thing.
const GOOD = ({ title = 'UTM Builder for GA4 | Kauzl', description = 'Build UTM-tagged campaign links for Google Analytics 4 in seconds.', body = '<h1>UTM builder</h1><h2>How</h2>', head = '' } = {}) => `<!doctype html><html lang="en"><head>
<title>${title}</title><meta name="description" content="${description}">
<link rel="canonical" href="https://kauzl.com/tools/utm-builder/">
<meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:url" content="https://kauzl.com/tools/utm-builder/">
<meta property="og:image" content="https://kauzl.com/tools/assets/og.png"><meta property="og:image:alt" content="x"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"x"}</script>${head}
</head><body>${body}</body></html>`;
const url = 'https://kauzl.com/tools/utm-builder/';

test('a clean page passes', () => {
  assert.deepEqual(checkPage(GOOD(), { url }), []);
});

test('titles and descriptions outside the limits fail, counted in characters not bytes', () => {
  assert.deepEqual(rules(checkPage(GOOD({ title: 'x'.repeat(LIMITS.title.max + 1) }), { url })), ['title']);
  assert.deepEqual(rules(checkPage(GOOD({ description: 'x'.repeat(LIMITS.description.max + 1) }), { url })), ['description']);
  assert.deepEqual(rules(checkPage(GOOD({ description: 'Too short' }), { url })), ['description']);
  // Curly quotes and entities count as one character each.
  assert.deepEqual(checkPage(GOOD({ title: `${'’'.repeat(LIMITS.title.max - 8)} | Kauzl` }), { url }), []);
  assert.deepEqual(checkPage(GOOD({ title: `${'&amp;'.repeat(40)}` }), { url }), []);
});

test('one h1, no skipped heading levels, alt text, a canonical of its own', () => {
  assert.ok(rules(checkPage(GOOD({ body: '<h1>a</h1><h1>b</h1>' }), { url })).includes('h1'));
  assert.ok(rules(checkPage(GOOD({ body: '<h1>a</h1><h3>b</h3>' }), { url })).includes('headings'));
  assert.ok(rules(checkPage(GOOD({ body: '<h1>a</h1><img src="x.png">' }), { url })).includes('alt'));
  assert.deepEqual(checkPage(GOOD({ body: '<h1>a</h1><img src="x.png" alt="">' }), { url }), []);
  assert.ok(rules(checkPage(GOOD(), { url: 'https://kauzl.com/tools/other/' })).includes('canonical'));
  assert.ok(rules(checkPage(GOOD({ head: '<meta name="robots" content="noindex">' }), { url })).includes('noindex'));
});

test('link previews and structured data are required', () => {
  const noImage = GOOD().replace(/<meta property="og:image" [^>]*>/, '');
  assert.ok(rules(checkPage(noImage, { url })).includes('social'));
  const noLd = GOOD().replace(/<script type="application\/ld\+json">.*?<\/script>/s, '');
  assert.ok(rules(checkPage(noLd, { url })).includes('structured-data'));
  const thinArticle = GOOD({ head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"x"}</script>' });
  assert.ok(checkPage(thinArticle, { url }).some((p) => p.message.includes('datePublished')));
});

const GUIDE = {
  kicker: 'Compare', lead: 'We make Kauzl, so read with that in mind.', published: '2026-11-16',
  inShort: ['a', 'b', 'c'], body: '<h2>a</h2><h2>b</h2><h2>c</h2>',
  faq: [['Is it good?', 'Plausible is good.'], ['Why?', 'Because.'], ['When?', 'Now.']],
};

test('guides: answer first, quotable FAQ, dates, structure', () => {
  assert.deepEqual(checkGuide(GUIDE), []);
  assert.ok(rules(checkGuide({ ...GUIDE, inShort: ['a'] })).includes('answer-first'));
  assert.ok(rules(checkGuide({ ...GUIDE, faq: GUIDE.faq.slice(0, 2) })).includes('faq'));
  assert.ok(rules(checkGuide({ ...GUIDE, faq: [...GUIDE.faq, ['Not a question', 'Answer.']] })).includes('faq'));
  assert.ok(rules(checkGuide({ ...GUIDE, faq: [...GUIDE.faq, ['Is it?', 'It depends on the site.']] })).includes('faq'));
  assert.deepEqual(checkGuide({ ...GUIDE, faq: [...GUIDE.faq, ['Is it?', 'Yes, for most sites.']] }), []);
  assert.ok(rules(checkGuide({ ...GUIDE, faq: [...GUIDE.faq, ['Long?', 'x'.repeat(LIMITS.faqAnswer.max + 1)]] })).includes('faq'));
  assert.ok(rules(checkGuide({ ...GUIDE, published: 'Nov 16' })).includes('dates'));
  assert.ok(rules(checkGuide({ ...GUIDE, body: '<h2>only one</h2>' })).includes('structure'));
});

test('comparisons disclose who wrote them and quote no prices', () => {
  assert.ok(rules(checkGuide({ ...GUIDE, lead: 'An honest look.' })).includes('disclosure'));
  assert.ok(rules(checkGuide({ ...GUIDE, body: `${GUIDE.body}<p>Plausible costs $9 a month.</p>` })).includes('no-prices'));
  // Other guides may mention money (BigQuery costs, ad spend).
  assert.deepEqual(checkGuide({ ...GUIDE, kicker: 'Google Analytics 4', lead: 'x', body: `${GUIDE.body}<p>About $5 per TB.</p>` }), []);
});

test('site: unique titles and descriptions, all pages in the sitemap and llms.txt', () => {
  const a = { url: 'https://kauzl.com/a/', html: GOOD(), inLlms: true };
  const b = { url: 'https://kauzl.com/b/', html: GOOD(), inLlms: true };
  const problems = checkSite({ pages: [a, b], sitemap: '<loc>https://kauzl.com/a/</loc>', llms: 'https://kauzl.com/a/' });
  assert.deepEqual(rules(problems).sort(), ['llms', 'sitemap', 'unique', 'unique']);
});

test('robots.txt keeps search and AI-search crawlers in, and points to the sitemap', () => {
  assert.deepEqual(checkSite({ pages: [], robots: robotsTxt('https://kauzl.com', { tools: true }) }), []);
  assert.ok(rules(checkSite({ pages: [], robots: 'User-agent: OAI-SearchBot\nDisallow: /\n\nSitemap: https://kauzl.com/sitemap.xml' })).includes('robots'));
  assert.ok(rules(checkSite({ pages: [], robots: 'User-agent: *\nDisallow: /api/' })).includes('robots'));
});

test('the home page follows the rules, signed in or not', () => {
  for (const signedIn of [false, true]) assert.deepEqual(checkPage(homePage({ signedIn, tools: true }), { url: 'https://kauzl.com/' }), []);
});

test('every guide follows the GEO rules', async () => {
  const dir = new URL('../tools/guides/', import.meta.url);
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.mjs'))) {
    const g = (await import(new URL(f, dir))).default;
    assert.deepEqual(checkGuide(g), [], `tools/guides/${f}`);
  }
});
