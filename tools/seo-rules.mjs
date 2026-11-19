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

export const LIMITS = {
  title: { min: 15, max: 60 }, // Google cuts at about 600px (~60 characters); Bing flags long titles
  description: { min: 25, max: 160 }, // Bing Webmaster Tools flags outside 25-160
  headline: { max: 110 }, // schema.org Article headline, as Google reads it
  inShort: { min: 3, max: 5 }, // the answer-first summary AI assistants quote
  faq: { min: 3 },
  faqAnswer: { max: 320 }, // an answer short enough to be quoted whole
};

export const SITE_ORIGIN = 'https://kauzl.com';

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
  for (const [, json] of blocks) {
    let data;
    try { data = JSON.parse(json); } catch { fail('structured-data', 'A JSON-LD block is not valid JSON.'); continue; }
    for (const item of [data].flat()) {
      if (!item['@context'] || !item['@type']) fail('structured-data', 'Every JSON-LD block needs @context and @type.');
      if (item['@type'] === 'Article') {
        for (const k of ['headline', 'datePublished', 'dateModified', 'author', 'publisher']) if (!item[k]) fail('structured-data', `The Article needs ${k}.`);
        if (item.headline && text(item.headline) > LIMITS.headline.max) fail('structured-data', `The Article headline is over ${LIMITS.headline.max} characters.`);
      }
      if (item['@type'] === 'FAQPage' && !(item.mainEntity?.length >= LIMITS.faq.min)) fail('structured-data', `An FAQPage needs at least ${LIMITS.faq.min} questions.`);
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
