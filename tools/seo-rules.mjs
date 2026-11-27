// SEO and GEO rules for every public page Kauzl publishes: the free tools, the
// guides and the home page. tools/build.mjs runs them on every page it writes
// and refuses to finish if one fails; test/seo-rules.test.js runs them on the
// home page and on the built site. Each rule says why it exists, so a failure
// tells you what to change. docs/seo-rules.md explains them for people.
//
// SEO: what Google and Bing check (and Bing Webmaster Tools flags).
// GEO: what makes AI assistants (ChatGPT, Claude, Perplexity, Copilot) find a
// page, trust it and quote it: a direct answer near the top, questions with
// self-contained answers, honest disclosure, dates, and machine-readable data.

import { COURSE } from './course.mjs';

export const LIMITS = {
  title: { min: 15, max: 60 }, // Google cuts at about 600px (~60 characters); Bing flags long titles
  description: { min: 25, max: 160 }, // Bing Webmaster Tools flags outside 25-160
  headline: { max: 110 }, // schema.org Article headline, as Google reads it
  inShort: { min: 3, max: 5 }, // the answer-first summary AI assistants quote
  faq: { min: 3 },
  faqAnswer: { max: 320 }, // an answer short enough to be quoted whole
};

export const SITE_ORIGIN = 'https://kauzl.com';
const COURSE_NAME = COURSE.name;

const text = (s) => [...String(s ?? '').replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[e])).trim()].length;
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`))?.[1];
const decode = (s) => String(s ?? '').replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[e]));

/**
 * Rules for one rendered page. `url` is where it is served (absolute).
 * Returns a list of problems: { rule, message }. Empty means it passes.
 */
export function checkPage(html, { url }) {
  const problems = [];
  const fail = (rule, message) => problems.push({ rule, message });

  if (!/<html[^>]*\blang="[a-z]{2}/.test(html)) fail('lang', 'Set <html lang="en">: search engines and screen readers use it.');

  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1]);
  if (!title) fail('title', 'Add a <title>.');
  else if (text(title) > LIMITS.title.max || text(title) < LIMITS.title.min) fail('title', `The title is ${text(title)} characters: keep it ${LIMITS.title.min}-${LIMITS.title.max} so Google and Bing show it whole. Put the search phrase first. (“${title}”)`);

  const description = meta(html, 'name', 'description');
  if (!description) fail('description', 'Add <meta name="description">.');
  else if (text(description) > LIMITS.description.max || text(description) < LIMITS.description.min) fail('description', `The description is ${text(description)} characters: keep it ${LIMITS.description.min}-${LIMITS.description.max}.`);

  const h1s = html.match(/<h1[\s>]/g)?.length || 0;
  if (h1s !== 1) fail('h1', `Use exactly one <h1> (found ${h1s}).`);

  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  const skip = levels.findIndex((l, i) => i > 0 && l > levels[i - 1] + 1);
  if (skip > 0) fail('headings', `Headings skip a level (h${levels[skip - 1]} then h${levels[skip]}): readers and AI parsers use the outline.`);

  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (!canonical) fail('canonical', 'Add <link rel="canonical">, or the same page under two URLs splits its ranking.');
  else if (canonical !== url) fail('canonical', `The canonical (${canonical}) should be this page's own URL (${url}).`);
  else if (!canonical.startsWith(`${SITE_ORIGIN}/`)) fail('canonical', `The canonical must be on ${SITE_ORIGIN}.`);

  if (/<meta name="robots" content="[^"]*noindex/.test(html)) fail('noindex', 'A public page is marked noindex.');

  for (const [attr, name] of [['property', 'og:title'], ['property', 'og:description'], ['property', 'og:url'], ['property', 'og:image'], ['property', 'og:image:alt'], ['name', 'twitter:card']]) {
    if (!meta(html, attr, name)) fail('social', `Add <meta ${attr}="${name}">: Reddit, X, LinkedIn and Slack build the link preview from it.`);
  }
  const image = meta(html, 'property', 'og:image');
  if (image && !/^https:\/\//.test(image)) fail('social', 'og:image must be an absolute https URL.');
  if (meta(html, 'property', 'og:url') && meta(html, 'property', 'og:url') !== canonical) fail('social', 'og:url should match the canonical URL.');

  const noAlt = html.match(/<img(?![^>]*\balt=)[^>]*>/g)?.length || 0;
  if (noAlt) fail('alt', `${noAlt} image(s) have no alt text (use alt="" for decoration).`);

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) fail('structured-data', 'Add JSON-LD structured data: it is how search engines and AI assistants know what the page is.');
  const lds = [];
  for (const [, json] of blocks) {
    let data;
    try { data = JSON.parse(json); } catch { fail('structured-data', 'A JSON-LD block is not valid JSON.'); continue; }
    lds.push(...[data].flat());
  }
  const courseUrl = `${SITE_ORIGIN}/guides/`;
  const courseId = `${SITE_ORIGIN}/guides/#course`;
  const isCoursePage = /^\/guides\/?$/i.test(new URL(url).pathname);
  const isLessonPage = /^\/guides\/[^/?#]+\/?$/i.test(new URL(url).pathname);
  const pageUrl = new URL(url).origin + new URL(url).pathname;
  const moduleOfCrumb = (item) => String(item || '').match(/#module-([a-z0-9-]+)$/i)?.[1];
  for (const item of lds) {
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    if (!item['@context'] || !item['@type']) fail('structured-data', 'Every JSON-LD block needs @context and @type.');
    if (types.includes('Article') || types.includes('LearningResource')) {
      const isLesson = types.includes('LearningResource');
      for (const k of ['headline', 'datePublished', 'dateModified', 'author', 'publisher']) if (!item[k]) fail('structured-data', `The Article needs ${k}.`);
      if (item.headline && text(item.headline) > LIMITS.headline.max) fail('structured-data', `The Article headline is over ${LIMITS.headline.max} characters.`);
      if (isLesson) {
        // A lesson is an Article and a LearningResource of the one Kauzl course.
        if (!types.includes('Article') || !types.includes('LearningResource')) fail('structured-data', 'A lesson should be an Article and a LearningResource.');
        if (item['@id'] !== `${pageUrl}#lesson`) fail('structured-data', `The lesson @id should end in #lesson (found ${item['@id']}).`);
        for (const k of ['learningResourceType', 'educationalLevel', 'timeRequired', 'position', 'teaches', 'isPartOf']) if (item[k] === undefined) fail('structured-data', `The lesson needs ${k}.`);
        if (item.learningResourceType !== 'Lesson') fail('structured-data', 'The lesson should be learningResourceType "Lesson".');
        if (item.educationalLevel !== 'Beginner') fail('structured-data', 'The lesson should be educationalLevel "Beginner".');
        if (!/^PT\d+M$/.test(String(item.timeRequired))) fail('structured-data', `The lesson timeRequired should be an ISO duration like "PT<minutes>M" (found ${item.timeRequired}).`);
        if (typeof item.position !== 'number') fail('structured-data', 'The lesson should have a numeric position.');
        if (!Array.isArray(item.teaches)) fail('structured-data', 'The lesson should teach its goal as an array of strings.');
        const part = item.isPartOf || {};
        if (part['@id'] !== courseId) fail('structured-data', `The lesson should be part of the course (${courseId}).`);
        if (part.name !== COURSE_NAME || part.url !== courseUrl) fail('structured-data', `The lesson isPartOf should name and link the course (${courseUrl}).`);
      }
    }
    if (types.includes('FAQPage') && !(item.mainEntity?.length >= LIMITS.faq.min)) fail('structured-data', `An FAQPage needs at least ${LIMITS.faq.min} questions.`);
    if (types.includes('Course')) {
      // The course page describes one free course, with its modules and parts.
      if (item['@id'] !== courseId) fail('structured-data', `The Course @id should be ${courseId}.`);
      for (const k of ['name', 'description', 'url', 'inLanguage', 'provider', 'isAccessibleForFree', 'educationalLevel', 'offers', 'hasCourseInstance', 'teaches', 'syllabusSections', 'hasPart']) if (item[k] === undefined) fail('structured-data', `The Course needs ${k}.`);
      if (item.inLanguage !== 'en') fail('structured-data', 'The Course should be inLanguage "en".');
      const provider = item.provider || {};
      // The plan pins the provider url to the bare origin with its trailing slash.
      if (provider['@type'] !== 'Organization' || provider.name !== 'Kauzl' || provider.url !== `${SITE_ORIGIN}/`) fail('structured-data', 'The Course should name Kauzl (Organization) as provider.');
      if (item.isAccessibleForFree !== true) fail('structured-data', 'The Course should be isAccessibleForFree.');
      if (item.educationalLevel !== 'Beginner') fail('structured-data', 'The Course should be educationalLevel "Beginner".');
      const offer = item.offers || {};
      if (Number(offer.price) !== 0 || offer.priceCurrency !== 'USD') fail('structured-data', 'The Course offer should be free: price 0, USD.');
      const instance = item.hasCourseInstance || {};
      if (instance.courseMode !== 'Online') fail('structured-data', 'The Course instance should be courseMode "Online".');
      if (!/^PT\d+M$/.test(String(instance.courseWorkload))) fail('structured-data', `The Course instance should have courseWorkload like "PT<minutes>M" (found ${instance.courseWorkload}).`);
      if (!Array.isArray(item.teaches) || !item.teaches.length) fail('structured-data', 'The Course should teach, one short line per module.');
      if (!Array.isArray(item.syllabusSections) || !item.syllabusSections.length) fail('structured-data', 'The Course should have syllabusSections.');
      for (const s of item.syllabusSections) if (!s?.name || !s?.description || !s?.timeRequired) fail('structured-data', 'Each course Syllabus should have name, description and timeRequired.');
      if (!Array.isArray(item.hasPart) || !item.hasPart.length) fail('structured-data', 'The Course should have hasPart, its lessons in order.');
    }
    if (types.includes('BreadcrumbList')) {
      const items = [...(item.itemListElement || [])].sort((a, b) => (a.position || 0) - (b.position || 0)).map((x) => x.item);
      if (isCoursePage && items.length !== 1) fail('structured-data', `The course page should have one breadcrumb item, the course (found ${items.length}).`);
      if (isLessonPage) {
        if (items.length !== 3) fail('structured-data', `A lesson page should have a 3-item BreadcrumbList: Course, module, lesson (found ${items.length}).`);
        if (items[0] !== courseUrl) fail('structured-data', `The first breadcrumb item should be the course (${courseUrl}).`);
        const moduleId = moduleOfCrumb(items[1]);
        if (!moduleId) fail('structured-data', `The second breadcrumb item should be the module (#module-<id>) (found ${items[1]}).`);
        if (items[2] !== pageUrl) fail('structured-data', `The third breadcrumb item should be the lesson (${items[2]}).`);
      }
    }
  }
  return problems;
}

/**
 * GEO rules for a guide's source (tools/guides/*.mjs), before it is rendered:
 * the parts AI assistants lift and the honesty that earns their trust.
 */
export function checkGuide(g) {
  const problems = [];
  const fail = (rule, message) => problems.push({ rule, message });
  const n = g.inShort?.length || 0;
  if (n < LIMITS.inShort.min || n > LIMITS.inShort.max) fail('answer-first', `Give ${LIMITS.inShort.min}-${LIMITS.inShort.max} “In short” bullets (found ${n}): the direct answer AI assistants quote.`);
  const faq = g.faq || [];
  if (faq.length < LIMITS.faq.min) fail('faq', `Add at least ${LIMITS.faq.min} FAQ questions (found ${faq.length}): they become FAQPage data and match how people ask.`);
  for (const [q, a] of faq) {
    if (!/\?$/.test(String(q).trim())) fail('faq', `Phrase “${q}” as a question.`);
    if (text(a) > LIMITS.faqAnswer.max) fail('faq', `The answer to “${q}” is ${text(a)} characters: keep it under ${LIMITS.faqAnswer.max} so it can be quoted whole.`);
    if (/^(it|this|that|they|yes|no)\b[ ,.]/i.test(String(a).trim()) && !/^(yes|no)[,.] /i.test(String(a).trim())) fail('faq', `The answer to “${q}” starts with “${String(a).trim().split(/\s/)[0]}”: start with the subject, so it makes sense quoted on its own.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.published || '')) fail('dates', 'Set published: YYYY-MM-DD.');
  if (g.updated && !(g.updated >= g.published)) fail('dates', 'updated must be on or after published.');
  if (!g.lead) fail('answer-first', 'Add a lead: one or two sentences under the title.');
  const h2s = (g.body || '').match(/<h2[\s>]/g)?.length || 0;
  if (h2s < 3) fail('structure', `Use at least 3 <h2> sections (found ${h2s}): AI assistants pick passages by heading.`);
  // Comparisons: say who wrote it, and don't quote competitors' prices (they change, and a wrong one is quoted for months).
  if (g.kicker === 'Compare') {
    if (!/we make kauzl/i.test(g.lead || '')) fail('disclosure', 'A comparison must say in its lead that we make Kauzl.');
    if (/[$€£]\s?\d/.test(`${g.body} ${(g.inShort || []).join(' ')} ${faq.flat().join(' ')}`)) fail('no-prices', 'Don’t quote prices in a comparison: they change, and AI assistants keep repeating the old one.');
  }
  // The lesson's own three halves: what it teaches (goal), what to do (steps)
  // and the self-check (check). Optional for now; the final content phase makes
  // them required for every lesson in MODULES.
  const goal = g.goal || [];
  if (goal.length) {
    if (goal.length < 2 || goal.length > 3) fail('goal', `A lesson should teach its goal in ${2}-3 items (found ${goal.length}).`);
    for (const t of goal) {
      const s = String(t || '');
      if (text(s) > 90) fail('goal', `Each goal item should be ${90} characters or fewer (found ${text(s)}).`);
      if (!/^(Use|Know|Pick|Write|Set|Check|Connect|Track|Read|Compare|Choose|Build|Add|Send|Ask|Test|Install|Tag|Find|Plan|Decide|Measure|Improve|Watch|Try|Turn)\b/.test(s.trim())) fail('goal', `Each goal should start with a verb (found “${s.trim()}”).`);
    }
  }
  const steps = g.steps || [];
  if (steps.length) {
    if (steps.length < 2 || steps.length > 5) fail('steps', `A lesson should have ${2}-5 steps (found ${steps.length}).`);
    for (const s of steps) {
      const t = String(s?.text || '');
      if (text(t) > 140) fail('steps', `Each step should be ${140} characters or fewer (found ${text(t)}).`);
      const href = String(s?.href || '');
      if (href && !/^(https?:\/\/|\/(tools|guides|home)\/)/.test(href)) fail('steps', `A step href should be absolute or a built page path (found ${href}).`);
    }
  }
  const check = g.check || [];
  if (check.length) {
    if (check.length < 1 || check.length > 3) fail('check', `A lesson should have ${1}-3 check questions (found ${check.length}).`);
    for (const q of check) {
      if (!/\?\s*$/.test(String(q?.q || ''))) fail('check', `Each check question should end in "?" (found “${q?.q || ''}”).`);
      const options = q?.options || [];
      if (options.length < 2 || options.length > 4) fail('check', `Each check question should have ${2}-4 options (found ${options.length}).`);
      if (!Number.isInteger(q?.answer) || q.answer < 0 || q.answer >= options.length) fail('check', `Each check answer should be a valid option index (found ${q?.answer}).`);
      if (text(String(q?.why || '')) > 200) fail('check', `Each check answer should be ${200} characters or fewer (found ${text(String(q?.why || ''))}).`);
    }
  }
  return problems;
}

/**
 * Rules across the whole site: unique titles and descriptions, every page in
 * the sitemap (and nothing that isn't a page), robots.txt open to search and AI
 * search crawlers, and an llms.txt that lists every page.
 */
export function checkSite({ pages, sitemap = '', robots = '', llms = '' }) {
  const problems = [];
  const fail = (rule, message) => problems.push({ rule, message });
  for (const key of ['title', 'description']) {
    const seen = new Map();
    for (const p of pages) {
      const v = key === 'title' ? decode(p.html.match(/<title>([^<]*)<\/title>/)?.[1]) : meta(p.html, 'name', 'description');
      if (seen.has(v)) fail('unique', `${p.url} has the same ${key} as ${seen.get(v)}.`);
      else seen.set(v, p.url);
    }
  }
  if (sitemap) {
    const listed = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    for (const p of pages) if (!listed.has(p.url) && !p.notInSitemap) fail('sitemap', `${p.url} is not in the sitemap.`);
  }
  if (robots) {
    // Search and AI-search crawlers must be able to read the public pages.
    const blocked = robots.split(/\n(?=User-agent)/i).filter((group) => /Disallow:\s*\/\s*$/m.test(group)).map((g) => g.match(/User-agent:\s*(\S+)/i)?.[1]);
    for (const bot of ['*', 'Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot']) {
      if (blocked.some((b) => b === bot || (b === '*' && bot === '*'))) fail('robots', `robots.txt blocks ${bot} from the whole site.`);
    }
    if (!/Sitemap:\s*https:\/\//i.test(robots)) fail('robots', 'robots.txt should point to the sitemap.');
  }
  if (llms) {
    for (const p of pages) if (p.inLlms && !llms.includes(p.url)) fail('llms', `${p.url} is missing from llms.txt.`);
  }
  return problems;
}

export const describe = (where, problems) => problems.map((p) => `  ${where}  [${p.rule}] ${p.message}`).join('\n');
