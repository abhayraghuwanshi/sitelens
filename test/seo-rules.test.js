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

// The free course, as the build writes it: one Course, and lessons that are
// Article + LearningResource of that course.
const COURSE_ID = 'https://kauzl.com/guides/#course';
const COURSE_LD = (course = {}) => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Course', '@id': COURSE_ID, name: 'Learn web analytics for your app', description: 'A free course in short lessons.', url: 'https://kauzl.com/guides/',
  provider: { '@type': 'Organization', name: 'Kauzl', url: 'https://kauzl.com/' }, isAccessibleForFree: true, educationalLevel: 'Beginner', inLanguage: 'en',
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' },
  hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: 'PT89M' },
  teaches: ['Know what to measure, and set up the free tools every site needs.'],
  syllabusSections: [{ '@type': 'Syllabus', name: 'Basics', description: 'What to measure.', timeRequired: 'PT17M' }],
  hasPart: [{ '@type': 'Article', '@id': 'https://kauzl.com/guides/web-analytics-tools/#lesson', headline: 'Web analytics tools, mapped.', url: 'https://kauzl.com/guides/web-analytics-tools/', position: 1 }],
  ...course,
})}</script>`;
const COURSE_PAGE = ({ ld = COURSE_LD(), crumbs = true } = {}) => `<!doctype html><html lang="en"><head>
<title>Learn Web Analytics: A Free Course | Kauzl</title><meta name="description" content="A free course in short lessons: set up analytics, choose your tools, read the numbers, get found in AI search.">
<link rel="canonical" href="https://kauzl.com/guides/">
<meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:url" content="https://kauzl.com/guides/">
<meta property="og:image" content="https://kauzl.com/tools/assets/og.png"><meta property="og:image:alt" content="x"><meta name="twitter:card" content="summary_large_image">
${ld}${crumbs ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Learn web analytics for your app', item: 'https://kauzl.com/guides/' }] })}</script>` : ''}
</head><body><main><h1>Learn web analytics for your app.</h1></main></body></html>`;

const LESSON_LD = (lesson = {}) => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': ['Article', 'LearningResource'], '@id': 'https://kauzl.com/guides/web-analytics-tools/#lesson', headline: 'Web analytics tools, mapped: which kind does your app need?', description: 'Seven kinds of analytics tools.',
  datePublished: '2026-11-22', dateModified: '2026-11-22', mainEntityOfPage: 'https://kauzl.com/guides/web-analytics-tools/',
  author: { '@type': 'Organization', name: 'Kauzl', url: 'https://kauzl.com' }, publisher: { '@type': 'Organization', name: 'Kauzl', url: 'https://kauzl.com' },
  isPartOf: { '@type': 'Course', '@id': COURSE_ID, name: 'Learn web analytics for your app', url: 'https://kauzl.com/guides/' },
  position: 1, learningResourceType: 'Lesson', educationalLevel: 'Beginner', timeRequired: 'PT4M', teaches: [], ...lesson,
})}</script>`;
const BREADCRUMB_LD = (items = 3) => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Learn web analytics for your app', item: 'https://kauzl.com/guides/' },
    { '@type': 'ListItem', position: 2, name: 'Basics', item: 'https://kauzl.com/guides/#module-basics' },
    { '@type': 'ListItem', position: 3, name: 'Web analytics tools, mapped: which kind does your app need?', item: 'https://kauzl.com/guides/web-analytics-tools/' },
  ].slice(0, items),
})}</script>`;
const LESSON_PAGE = ({ ld = LESSON_LD(), crumbs = true } = {}) => `<!doctype html><html lang="en"><head>
<title>Web Analytics Tools: Which Kind Do You Need? | Kauzl</title><meta name="description" content="Seven kinds of analytics tools, the question each one answers, and the names in each: GA4, Plausible, Umami, Clarity, Semrush, Sentry and more.">
<link rel="canonical" href="https://kauzl.com/guides/web-analytics-tools/">
<meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:url" content="https://kauzl.com/guides/web-analytics-tools/">
<meta property="og:image" content="https://kauzl.com/tools/assets/og.png"><meta property="og:image:alt" content="x"><meta name="twitter:card" content="summary_large_image">
${ld}${crumbs ? BREADCRUMB_LD() : ''}
</head><body><main><h1>Web analytics tools, mapped: which kind does your app need?</h1></main></body></html>`;

test('the course page validates as one free Course with its parts', () => {
  assert.deepEqual(checkPage(COURSE_PAGE(), { url: 'https://kauzl.com/guides/' }), []);
  // The free Offer, instance, provider and syllabus are the course, not a competitor's paid product.
  assert.ok(rules(checkPage(COURSE_PAGE({ ld: COURSE_LD({ offers: { '@type': 'Offer', price: 9, priceCurrency: 'USD', category: 'Paid' } }) }), { url: 'https://kauzl.com/guides/' })).includes('structured-data'));
  assert.deepEqual(checkPage(COURSE_PAGE({ crumbs: false }), { url: 'https://kauzl.com/guides/' }), []);
});

test('a lesson validates as an Article and LearningResource of the course', () => {
  assert.deepEqual(checkPage(LESSON_PAGE(), { url: 'https://kauzl.com/guides/web-analytics-tools/' }), []);
  assert.ok(rules(checkPage(LESSON_PAGE({ ld: LESSON_LD({ isPartOf: undefined }) }), { url: 'https://kauzl.com/guides/web-analytics-tools/' })).includes('structured-data'));
  assert.deepEqual(checkPage(LESSON_PAGE({ crumbs: false }), { url: 'https://kauzl.com/guides/web-analytics-tools/' }), []);
});

test('lessons: goal, steps and check are optional, and valid when present', () => {
  const base = { ...GUIDE };
  // Not written for every lesson yet: the final content phase makes them required.
  assert.deepEqual(checkGuide(base), []);
  assert.deepEqual(checkGuide({ ...base, goal: ['Know what to measure before you set up any tracking tool at all', 'Pick the right analytics tool for your site'] }), []);
  assert.ok(rules(checkGuide({ ...base, goal: ['Know what to measure before you set up any tracking tool at all'] })).includes('goal'));
  assert.ok(rules(checkGuide({ ...base, goal: ['Know what to measure before you set up any tracking tool at all and then some extra words here'] })).includes('goal'));
  assert.ok(rules(checkGuide({ ...base, goal: ['Know what to measure before you set up any tracking tool at all', 'Pick the right analytics tool for your site', 'Check the numbers after launch ok', 'Watch the sources ok'] })).includes('goal'));
  assert.deepEqual(checkGuide({ ...base, steps: [
    { text: 'Write down the one question you most want your analytics to answer.' },
    { text: 'Tag the next link you share.', href: '/tools/utm-builder/' },
  ] }), []);
  assert.ok(rules(checkGuide({ ...base, steps: [{ text: 'Only one step.' }] })).includes('steps'));
  assert.ok(rules(checkGuide({ ...base, steps: [{ text: 'x'.repeat(141) }] })).includes('steps'));
  assert.ok(rules(checkGuide({ ...base, steps: [{ text: 'Do the thing.', href: 'javascript:evil' }] })).includes('steps'));
  assert.deepEqual(checkGuide({ ...base, check: [
    { q: 'Which kind of tool shows what a visitor saw before leaving a page?', options: ['Web analytics', 'Session replay', 'Search data', 'Error tracking'], answer: 1, why: 'Session replay rebuilds the visitor’s screen; web analytics only counts the visit.' },
  ] }), []);
  assert.ok(rules(checkGuide({ ...base, check: [{ q: 'Which kind of tool shows what a visitor saw before leaving a page?', options: ['Web analytics', 'Session replay', 'Search data', 'Error tracking'], answer: 9, why: 'Because.' }] })).includes('check'));
  assert.ok(rules(checkGuide({ ...base, check: [{ q: 'Which kind of tool shows what a visitor saw before leaving a page?', options: ['Web analytics'], answer: 0, why: 'Because.' }] })).includes('check'));
  assert.ok(rules(checkGuide({ ...base, check: [{ q: 'Which kind of tool shows what a visitor saw before leaving a page', options: ['Web analytics', 'Session replay'], answer: 0, why: 'x'.repeat(201) }] })).includes('check'));
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
