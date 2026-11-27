// Builds Kauzl's free tools and guides into static HTML: one page per tool
// (tools/pages) and per article (tools/guides), each with its own title,
// description, FAQ and structured data, plus indexes and one sitemap for the
// whole of kauzl.com. No framework and no server: the output in tools/dist can go on
// any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, Fly).
//
//   node tools/build.mjs            -> tools/dist/tools/...
//   SITE=https://kauzl.com BASE=/tools node tools/build.mjs
//   npx serve tools/dist            -> http://localhost:3000/tools/

import { readdir, rm, mkdir, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkPage, checkGuide, checkSite, describe } from './seo-rules.mjs';
import { owl, eye, owlSays } from './assets/lib/owl.js';
import { COURSE, MODULES, COURSE_ORDER, PATHS, lessonNo, moduleOf, inCourseOrder } from './course.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// Asset URLs carry a hash of the assets folder, so a deploy never pairs new
// pages with a stylesheet or script the browser cached from the last one.
const ASSET_V = await (async function hashDir(dir, h = createHash('sha256')) {
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) await hashDir(f, h); else h.update(e.name).update(await readFile(f));
  }
  return h;
})(path.join(here, 'assets')).then((h) => h.digest('hex').slice(0, 10));
const SITE = (process.env.SITE || 'https://kauzl.com').replace(/\/$/, '');
const BASE = `/${(process.env.BASE ?? '/tools').replace(/^\/|\/$/g, '')}`.replace(/^\/$/, '');
const APP = process.env.APP_URL || 'https://kauzl.com';
// Google tag for these public pages: a Tag Manager (GTM-…) or GA4 (G-…) ID,
// from tools/site.config.json or GOOGLE_TAG_ID.
const CONFIG = JSON.parse(await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'site.config.json'), 'utf8').catch(() => '{}'));
const TAG = process.env.GOOGLE_TAG_ID || CONFIG.googleTagId || '';
const GA = /^(GTM|G)-[A-Z0-9]+$/.test(TAG) ? TAG : '';
const OUT = path.join(here, 'dist', BASE);
const GUIDES = '/guides';
const GOUT = path.join(here, 'dist', GUIDES);

// Order shown on the index page and in the footer.
const ORDER = [
  'utm-builder', 'did-it-work', 'ab-test-calculator', 'sample-size-calculator',
  'ai-robots-txt-generator', 'ai-crawler-log-analyzer', 'llms-txt-generator',
  'serp-preview', 'open-graph-preview', 'schema-generator',
];

// The owl's line on the course page before anyone has answered anything.
const COURSE_WELCOME = 'New here? Three quick questions, and I’ll pick your lessons.';

// 24px line icons, drawn with currentColor (no emoji).
const ICON_PATHS = {
  'utm-builder': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  'did-it-work': '<path d="M4 19h16"/><path d="M7 15v-3"/><path d="M11 15V9"/><path d="M15 15V6"/><path d="M19 15V4"/>',
  'ab-test-calculator': '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  'sample-size-calculator': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M10 2h4"/>',
  'ai-robots-txt-generator': '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  'ai-crawler-log-analyzer': '<path d="M4 6h10"/><path d="M4 11h7"/><path d="M4 16h5"/><circle cx="16" cy="15" r="4"/><path d="M19 18l2.5 2.5"/>',
  'llms-txt-generator': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  'serp-preview': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/><path d="M8 9h6"/><path d="M8 13h4"/>',
  'open-graph-preview': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="16" cy="8.5" r="1.5"/>',
  'schema-generator': '<path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3"/><path d="M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3"/>',
};
const icon = (slug) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[slug] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;
const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="#121522"/><path d="M14 30 L15 9 L27 18 L37 18 L49 9 L50 30 L50 41 Q50 56 32 56 Q14 56 14 41 Z" fill="#F6F7F9"/><circle cx="25" cy="35" r="7" fill="#F5A524"/><circle cx="39" cy="35" r="7" fill="#F5A524"/></svg>')}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const url = (slug) => `${SITE}${BASE}/${slug ? `${slug}/` : ''}`;
const href = (slug) => `${BASE}/${slug ? `${slug}/` : ''}`;
const gurl = (slug) => `${SITE}${GUIDES}/${slug ? `${slug}/` : ''}`;
const ghref = (slug) => `${GUIDES}/${slug ? `${slug}/` : ''}`;
const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

async function loadGuides() {
  const dir = path.join(here, 'guides');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mjs'));
  const guides = await Promise.all(files.map(async (f) => ({ slug: f.replace(/\.mjs$/, ''), ...(await import(pathToFileURL(path.join(dir, f)))).default })));
  for (const g of guides) g.minutes = Math.max(3, Math.round(strip([g.body, ...(g.inShort || []), ...(g.faq || []).flat()].join(' ')).split(' ').length / 200));
  const bad = guides.map((g) => describe(`guides/${g.slug}`, checkGuide(g))).filter(Boolean);
  if (bad.length) throw new Error(`Guides break the GEO rules (tools/seo-rules.mjs, docs/seo-rules.md):\n${bad.join('\n')}`);
  const badPath = Object.values(PATHS).flat().filter((s) => !guides.some((g) => g.slug === s));
  if (badPath.length) throw new Error(`The course paths (tools/course.mjs) name lessons that are not in the course: ${[...new Set(badPath)].join(', ')}`);
  ALL_GUIDES = guides;
  return inCourseOrder(guides);
}

async function loadPages() {
  const dir = path.join(here, 'pages');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mjs'));
  const pages = await Promise.all(files.map(async (f) => ({ slug: f.replace(/\.mjs$/, ''), ...(await import(pathToFileURL(path.join(dir, f)))).default })));
  const rank = (p) => (ORDER.includes(p.slug) ? ORDER.indexOf(p.slug) : 99);
  return pages.sort((a, b) => rank(a) - rank(b));
}

let footer = '';

// Every page the build writes, so tools/seo-rules.mjs can check it (and the
// site as a whole) before the build counts as done.
const BUILT = [];
// The link preview image for every page (Reddit, X, LinkedIn, Slack).
const OG_IMAGE = `${SITE}${BASE}/assets/og.png`;
const OG_ALT = 'Kauzl, the analytics calendar: an owl over a month of website traffic, one day picked and explained.';

function layout({ slug, page = 'page:', canonical = url(slug), ogType = 'website', skip = 'Skip to the tool', title, description, band, body, ld = [], scripts = [] }) {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="Kauzl">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${OG_IMAGE}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(OG_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#121522">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="${BASE}/assets/site.css?v=${ASSET_V}">
${ld.map(jsonLd).join('\n')}
</head><body data-page="${page}">
<a class="skip" href="#main">${skip}</a>
<header class="top"><div class="wrap">
  <div class="brand"><a class="home-link" href="${APP}/home" aria-label="Kauzl home">${owl(30, { variant: 'paper' })}<span class="word">kauzl</span></a><a class="tag" href="${href('')}">free tools</a></div>
  <nav aria-label="Main"><a href="${href('')}">Tools</a><a href="${ghref('')}">Course</a><a href="${APP}/tour/">Look inside</a><a class="btn amber small" href="#early-access">Get early access</a></nav>
</div></header>
${band}
<main class="wrap" id="main">${body}</main>
${footer}
<script type="module" src="${BASE}/assets/site.js?v=${ASSET_V}"></script>
${GA ? `<script defer src="${BASE}/assets/ga.js?v=${ASSET_V}" data-ga="${GA}"></script>` : ''}
${scripts.map((s) => `<script type="module" src="${BASE}/assets/${s}?v=${ASSET_V}"></script>`).join('\n')}
</body></html>
`;
  BUILT.push({ url: canonical, html });
  return html;
}

// Kauzl is invite-only: the call to action is the early-access form, posted to
// the app's /waitlist (same origin when the tools are served at kauzl.com/tools/).
// from= records where people joined: tools or guides.
function cta(c = {}, from = 'tools') {
  return `<aside class="cta" id="early-access" aria-label="Get early access to Kauzl">
<div class="cta-copy">${owl(56, { variant: 'paper' })}
<h2>${c.title || 'See what happened on your site, day by day.'}</h2>
<p>${c.text || 'Kauzl is an analytics calendar: each day’s traffic, search and AI answers next to what you shipped, posted and launched, and what moved and why.'}</p>
<form class="join" method="post" action="${APP}/waitlist">
<input type="hidden" name="from" value="${from}">
<label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
<input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@company.com" aria-label="Your email">
<button class="btn amber" type="submit">Get early access</button>
</form>
<p class="fine">Kauzl is opening to a few teams at a time. <a href="${APP}/tour/">Look inside first</a> · <a href="${APP}/login">Sign in</a></p></div>
<div class="cta-chart" aria-hidden="true"><span class="lbl">Your last launch</span>
<div class="bars"><i class="b"></i><i class="a"></i></div><div class="keys"><span>Before</span><span>After</span></div></div>
</aside>`;
}

const perks = `<ul class="perks"><li>${CHECK}Free</li><li>${CHECK}No sign-up</li><li>${CHECK}Runs in your browser</li></ul>`;

function toolPage(p, pages, guides = []) {
  const reading = guides.filter((g) => (g.tools || []).includes(p.slug)).slice(0, 3);
  const related = pages.filter((o) => o.slug !== p.slug && (p.related || []).includes(o.slug));
  const more = related.length ? related : pages.filter((o) => o.slug !== p.slug).slice(0, 3);
  const band = `<section class="band"><div class="wrap band-in">
<div class="band-copy"><p class="crumbs"><a href="${href('')}">Free tools</a><span aria-hidden="true"> / </span>${esc(p.name)}</p>
<h1>${p.h1}</h1><p class="lead">${p.intro}</p>${perks}</div>
<div class="perch" aria-hidden="true">${owl(150, { variant: 'paper', className: 'hero-owl' })}<span class="branch"></span></div>
</div></section>`;
  const body = `
${p.tool}
${cta(p.cta)}
<article class="content">${p.content || ''}
${p.faq?.length ? `<h2>Questions</h2><div class="faq">${p.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>` : ''}
</article>
${reading.length ? `<h2 class="section-title">Learn it in the course</h2><div class="col more-guides"><ul>${reading.map(guideRow).join('')}</ul></div>` : ''}
<h2 class="section-title">More free tools</h2>
<div class="grid">${more.map(tile).join('')}</div>`;
  const ld = [{
    '@context': 'https://schema.org', '@type': 'WebApplication', name: p.name, url: url(p.slug),
    description: p.description, applicationCategory: 'BusinessApplication', operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'Kauzl', url: APP },
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Free tools', item: url('') },
      { '@type': 'ListItem', position: 2, name: p.name, item: url(p.slug) },
    ],
  }];
  if (p.faq?.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) });
  return layout({ slug: p.slug, page: `tool:${p.slug}`, title: p.title, description: p.description, band, body, ld, scripts: p.script ? [p.script] : [] });
}

// The guides are one free course, "Learn web analytics for your app": five
// modules of numbered lessons, read in order or dipped into. The course itself
// (name, modules, lesson order) lives in tools/course.mjs, the one source of
// truth; a guide must be listed there to get a lesson number, one that isn't is
// appended at the end.

// The two lessons at the top of the index, each with a small picture of its point.
const GUIDE_FEATURED = {
  'web-analytics-tools': {
    line: 'Seven kinds of analytics tool, the one question each answers, and which your app needs first.',
    visual: `<ul class="fv-map"><li><span>Who came, and from where?</span><b>GA4 · Plausible · Umami</b></li><li><span>What do users do?</span><b>PostHog · Mixpanel</b></li><li><span>Why did they leave?</span><b>Clarity · Hotjar</b></li><li><span>Did my change work?</span><b class="a">Kauzl</b></li></ul>`,
  },
  'generative-engine-optimization': {
    line: 'Why AI assistants skip small products, and what gets you named. With numbers from our own sites.',
    visual: `<div class="fv-ba"><span>Used as a source</span><span class="t"><i style="width:23%"></i></span><b>5 of 22</b><span>Recommended</span><span class="t a"><i style="width:14%"></i></span><b>3 of 22</b></div><p class="fv-foot">Claude’s answers about three small products · Nov 2026</p>`,
  },
};
let ALL_GUIDES = [];
const guideRow = (g) => `<li><a class="row" href="${ghref(g.slug)}"><span class="course-eyebrow">${eye('todo', 16)}<span class="ic num" aria-label="Lesson ${lessonNo(g, ALL_GUIDES)}">${lessonNo(g, ALL_GUIDES)}</span></span><span><b>${esc(g.short || g.h1 || g.title)}</b><small>${esc(g.blurb || g.description)}</small><small class="mins">${g.minutes} min read</small></span></a></li>`;
const guideFeature = (g) => `<a class="feature" href="${ghref(g.slug)}"><div><p class="kick">Lesson ${lessonNo(g, ALL_GUIDES)} · ${g.minutes} min read</p><h3>${esc(g.short || g.h1)}</h3><p>${GUIDE_FEATURED[g.slug].line}</p><span class="go">Start the lesson →</span></div><div class="fv" aria-hidden="true">${GUIDE_FEATURED[g.slug].visual}</div></a>`;
const lessonLink = (g, dir) => g ? `<a class="lesson-link ${dir}" href="${ghref(g.slug)}"><span>${dir === 'prev' ? '← Previous' : 'Next →'} · Lesson ${lessonNo(g, ALL_GUIDES)}</span><b>${esc(g.short || g.h1)}</b></a>` : '<span></span>';

// One lesson: hero with its place in the course, an "In short" box, the body,
// FAQ, previous and next lessons, the tools it uses, and the rest of its module.
function guidePage(g, guides, pages) {
  const tools = pages.filter((p) => (g.tools || []).includes(p.slug));
  const ordered = inCourseOrder(guides);
  const i = ordered.indexOf(g);
  const n = lessonNo(g, guides);
  const m = moduleOf(g.slug);
  const modName = m >= 0 ? `Module ${m + 1}: ${MODULES[m].name}` : 'More lessons';
  // The owl can only ever say the welcome and the module-finished lines; the
  // checkpoint's own answers live in the goal/steps/check the build renders.
  const checkpoint = (g) => {
    if (!g.steps?.length && !g.check?.length) return '';
    let html = `<h2>Checkpoint</h2>`;
    if (g.steps?.length) html += `<h3>Do it now</h3><ul class="do-now">${g.steps.map((s, i) => `<li><label><input type="checkbox" data-step="${i}" /> <span>${s.text}${s.href ? ` <a href="${esc(s.href)}">${esc(s.href)}</a>` : ''}</span></label></li>`).join('')}</ul>`;
    if (g.check?.length) html += `<h3>Check yourself</h3>${g.check.map((q, qi) => `<fieldset class="check"><legend>${q.q}</legend>${q.options.map((o, oi) => `<label><input type="radio" name="check-${qi}" value="${oi}"${q.answer === oi ? ' checked' : ''}> ${o}</label>`).join('')}${q.why ? `<details class="check-why"><summary>Why</summary><p>${q.why}</p></details>` : ''}</fieldset>`).join('')}`;
    return html;
  };
  // Module crumb and breadcrumb: the module is a section of the course, so it
  // links there rather than to a lesson.
  const modCrumb = m >= 0 ? `<a href="${SITE}${GUIDES}/#module-${MODULES[m].id}">${esc(MODULES[m].name)}</a>` : esc(modName);
  const sameModule = ordered.filter((o) => o !== g && moduleOf(o.slug) === m && m >= 0);
  const band = `<section class="band article-band"><div class="wrap band-in">
<div class="band-copy"><p class="crumbs"><a href="${ghref('')}">${esc(COURSE.name)}</a><span aria-hidden="true"> / </span>${modCrumb}</p>
<h1>${esc(g.h1 || g.title)}</h1><p class="lead">${g.lead || g.description}</p>
<p class="article-meta"><span class="lesson-badge">Lesson ${n} of ${guides.length}</span><span class="lesson-head-eyes" aria-hidden="true">${m >= 0 ? MODULES[m].lessons.map((l) => eye('todo', 16)).join('') : ''}</span> By the Kauzl team · Updated <time datetime="${g.updated || g.published}">${fmtDate(g.updated || g.published)}</time> · ${g.minutes} min read</p></div>
<div class="perch" aria-hidden="true">${owl(132, { variant: 'paper', className: 'hero-owl' })}<span class="branch"></span></div>
</div></section>`;
  const body = `
<article class="content article">
${g.inShort?.length ? `<aside class="in-short"><p class="lbl">In short</p><ul>${g.inShort.map((x) => `<li>${x}</li>`).join('')}</ul></aside>` : ''}
${g.goal?.length ? `<h2>By the end of this lesson</h2><ul>${g.goal.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
${g.body}
${checkpoint(g)}
${g.faq?.length ? `<h2>Questions</h2><div class="faq">${g.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>` : ''}
</article>
<div class="mark-done"><button type="button" class="btn" id="mark-done"><span class="eye" data-state="todo">${eye('todo', 16)}</span> Mark as done</button></div>
<nav class="lesson-nav" aria-label="Course lessons">${lessonLink(ordered[i - 1], 'prev')}${lessonLink(ordered[i + 1], 'next')}</nav>
${cta(g.cta, 'guides')}
${tools.length ? `<h2 class="section-title">Free tools for this</h2><div class="grid">${tools.map(tile).join('')}</div>` : ''}
${sameModule.length ? `<h2 class="section-title">Also in ${esc(modName)}</h2>
<div class="col more-guides"><ul>${sameModule.map(guideRow).join('')}</ul></div>` : ''}`;
  const ld = [{
    '@context': 'https://schema.org', '@type': ['Article', 'LearningResource'], '@id': `${gurl(g.slug)}#lesson`,
    headline: g.h1 || g.title, description: g.description,
    datePublished: g.published, dateModified: g.updated || g.published, mainEntityOfPage: gurl(g.slug),
    author: { '@type': 'Organization', name: 'Kauzl', url: APP }, publisher: { '@type': 'Organization', name: 'Kauzl', url: APP },
    isPartOf: { '@type': 'Course', '@id': `${SITE}${GUIDES}/#course`, name: COURSE.name, url: gurl('') },
    position: n, learningResourceType: 'Lesson', educationalLevel: 'Beginner', timeRequired: `PT${g.minutes}M`,
    teaches: g.goal || [],
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: COURSE.name, item: gurl('') },
      ...(m >= 0 ? [{ '@type': 'ListItem', position: 2, name: MODULES[m].name, item: `${SITE}${GUIDES}/#module-${MODULES[m].id}` }] : []),
      { '@type': 'ListItem', position: m >= 0 ? 3 : 2, name: g.h1 || g.title, item: gurl(g.slug) },
    ],
  }];
  if (g.faq?.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) });
  return layout({ canonical: gurl(g.slug), page: `guide:${g.slug}`, ogType: 'article', skip: 'Skip to the lesson', title: g.title, description: g.description, band, body, ld });
}

// The course page: two lessons to start with, then the syllabus by module.
function guidesIndex(guides) {
  const ordered = inCourseOrder(guides);
  const total = ordered.reduce((s, g) => s + g.minutes, 0);
  const band = `<section class="band home"><div class="wrap band-in">
<div class="band-copy"><p class="eyebrow">A free course from kauzl</p>
<h1>Learn web analytics for your app.</h1>
<p class="lead">${guides.length} short lessons, from your first tracking script to being recommended by ChatGPT. Compare the tools, read your numbers, and know when a change worked. Each lesson stands alone and comes with a free tool.</p>
<p class="course-meta"><a class="btn amber" href="${ghref(ordered[0].slug)}">Start with lesson 1 →</a><span>${MODULES.length} modules · about ${total >= 60 ? `${Math.round(total / 30) / 2} hours` : `${total} minutes`} in all</span></p></div>
<div class="perch" aria-hidden="true">${owl(190, { variant: 'paper', className: 'hero-owl' })}<span class="branch"></span></div>
</div></section>`;
  const bySlug = Object.fromEntries(guides.map((g) => [g.slug, g]));
  const rest = ordered.filter((g) => !COURSE_ORDER.includes(g.slug));
  const mod = (m, i) => `<section id="module-${m.id}" class="col module"><p class="mod-no">Module ${i + 1}</p><h3>${m.name}</h3><p class="col-sub">${m.sub}</p><ul>${m.lessons.filter((l) => bySlug[l.slug]).map((l) => guideRow(bySlug[l.slug])).join('')}</ul><div class="module-eyes" data-module="${m.id}">${m.lessons.filter((l) => bySlug[l.slug]).map((l) => eye('todo', 16)).join('')}</div></section>`;
  const body = `<div id="course-welcome" class="course-welcome">${owlSays(COURSE_WELCOME, 44)}<div class="course-welcome-actions"><a class="btn amber" href="${ghref(ordered[0].slug)}">Start at lesson 1</a><button type="button" class="btn" id="pick-path">Pick my path</button></div></div>
<section class="group"><h2 class="section-title">Start here</h2><p class="section-sub">The map of the market, and the question everyone is asking about AI search.</p>
<div class="features">${Object.keys(GUIDE_FEATURED).filter((s) => bySlug[s]).map((s) => guideFeature(bySlug[s])).join('')}</div></section>
<section class="group"><h2 class="section-title">The lessons</h2><p class="section-sub">In order, or jump to the module you need.</p>
<div class="cols syllabus">${MODULES.map(mod).join('')}
${rest.length ? `<div class="col module"><p class="mod-no">More</p><h3>More lessons</h3><ul>${rest.map(guideRow).join('')}</ul></div>` : ''}</div></section>
${cta({}, 'guides')}`;
  const courseUrl = `${SITE}${GUIDES}/#course`;
  const courseLd = {
    '@context': 'https://schema.org', '@type': 'Course', '@id': courseUrl, name: COURSE.name, description: COURSE.description, url: gurl(''),
    provider: { '@type': 'Organization', name: 'Kauzl', url: `${SITE}/` }, isAccessibleForFree: true, educationalLevel: 'Beginner', inLanguage: 'en',
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: `PT${total}M` },
    teaches: MODULES.map((m) => m.teaches),
    syllabusSections: MODULES.map((m) => ({ '@type': 'Syllabus', name: m.name, description: m.sub, timeRequired: `PT${m.lessons.reduce((s, l) => s + (bySlug[l.slug]?.minutes || 0), 0)}M` })),
    hasPart: ordered.map((g) => ({ '@type': 'Article', '@id': `${gurl(g.slug)}#lesson`, headline: g.h1 || g.title, url: gurl(g.slug), position: lessonNo(g, guides) })),
  };
  const ld = [courseLd, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: COURSE.name, item: gurl('') }] }];
  return layout({
    canonical: gurl(''), page: 'index:guides', skip: 'Skip to the lessons', title: 'Learn Web Analytics: A Free Course for Your App | Kauzl',
    description: 'A free course in short lessons: GA4 and UTMs, analytics tools compared, A/B tests, AI search, and connecting your data to Claude and ChatGPT.',
    band, body, ld,
  });
}

const tile = (p) => `<a class="tile" href="${href(p.slug)}"><span class="ic">${icon(p.slug)}</span><h3>${esc(p.name)}</h3><p>${esc(p.blurb || p.description)}</p><span class="go" aria-hidden="true">Open →</span></a>`;

// The index page: two featured tools with a small picture of what they do,
// then everything else as short lists under three headings.
const SHORT = {
  'did-it-work': 'Did it work?', 'ab-test-calculator': 'A/B test significance', 'sample-size-calculator': 'A/B test sample size',
  'ai-robots-txt-generator': 'AI robots.txt', 'ai-crawler-log-analyzer': 'AI crawler log analyzer', 'open-graph-preview': 'Open Graph preview',
  'serp-preview': 'Google snippet preview', 'schema-generator': 'Schema markup',
};
const FEATURED = {
  'did-it-work': {
    kick: 'Most used', line: 'Paste daily numbers from before and after a launch. Get a straight answer: real change, or noise.',
    visual: `<div class="fv-ba"><span>Before</span><span class="t"><i style="width:62%"></i></span><b>412/day</b><span>After</span><span class="t a"><i style="width:84%"></i></span><b>538/day</b></div><p class="fv-foot"><b class="good">+31%</b> · very likely real</p>`,
  },
  'utm-builder': {
    kick: 'Campaigns', line: 'Tag every link you share, in bulk, with naming checks so GA4 reports stay clean.',
    visual: `<p class="fv-url">kauzl.com/pricing<span>?utm_source=</span><b>reddit</b><span>&amp;utm_medium=</span><b>social</b><span>&amp;utm_campaign=</span><b>launch</b></p><p class="fv-foot">3 links tagged · names checked</p>`,
  },
};
const feature = (p) => `<a class="feature" href="${href(p.slug)}"><div><p class="kick">${FEATURED[p.slug].kick}</p><h3>${esc(SHORT[p.slug] || p.name)}</h3><p>${FEATURED[p.slug].line}</p><span class="go">Open the tool →</span></div><div class="fv" aria-hidden="true">${FEATURED[p.slug].visual}</div></a>`;
const row = (p) => `<li><a class="row" href="${href(p.slug)}"><span class="ic">${icon(p.slug)}</span><span><b>${esc(SHORT[p.slug] || p.name)}</b><small>${esc(p.blurb || p.description)}</small></span></a></li>`;

function indexPage(pages) {
  const groups = [
    ['Experiments', 'Know when a test is done, and who won.', ['ab-test-calculator', 'sample-size-calculator']],
    ['AI search', 'Decide who reads your site, and see who does.', ['ai-robots-txt-generator', 'ai-crawler-log-analyzer', 'llms-txt-generator']],
    ['Before you publish', 'How your page looks before anyone clicks.', ['serp-preview', 'open-graph-preview', 'schema-generator']],
  ];
  const bySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
  const listed = new Set([...Object.keys(FEATURED), ...groups.flatMap(([, , s]) => s)]);
  const rest = pages.filter((p) => !listed.has(p.slug));
  const band = `<section class="band home"><div class="wrap band-in">
<div class="band-copy"><p class="eyebrow">Free tools from kauzl</p>
<h1>Small tools for your website.</h1>
<p class="lead">Tag a campaign, check whether a launch moved anything, size an A/B test, and get ready for AI search. Everything runs in your browser. Nothing to sign up for, and nothing you type leaves the page.</p>${perks}</div>
<div class="perch" aria-hidden="true">${owl(210, { variant: 'paper', className: 'hero-owl' })}<span class="branch"></span></div>
</div></section>`;
  const body = `
<section class="group"><h2 class="section-title">Start here</h2><p class="section-sub">The two questions every launch asks.</p>
<div class="features">${Object.keys(FEATURED).filter((s) => bySlug[s]).map((s) => feature(bySlug[s])).join('')}</div></section>
<section class="group"><h2 class="section-title">More tools</h2>
<div class="cols">${groups.map(([name, sub, slugs]) => `<div class="col"><h3>${name}</h3><p class="col-sub">${sub}</p><ul>${slugs.filter((s) => bySlug[s]).map((s) => row(bySlug[s])).join('')}</ul></div>`).join('')}
${rest.length ? `<div class="col"><h3>More</h3><ul>${rest.map(row).join('')}</ul></div>` : ''}</div></section>
${cta()}`;
  return layout({
    slug: '', page: 'index:tools', title: 'Free Marketing & Analytics Tools | Kauzl',
    description: 'Free browser tools for marketers and founders: UTM builder, A/B test calculators, launch checker, AI robots.txt and llms.txt, SERP and OG previews.',
    band, body, ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Kauzl free tools', url: url(''), hasPart: pages.map((p) => ({ '@type': 'WebApplication', name: p.name, url: url(p.slug) })) }],
  });
}

const pages = await loadPages();
const guides = await loadGuides();
footer = `<footer class="foot"><div class="wrap">
<div class="foot-brand">${owl(40)}<div><p class="word">kauzl</p><p>The owl that watches your site, day by day.</p></div></div>
<div class="foot-lists"><p class="foot-h">Free tools</p><ul>${pages.map((p) => `<li><a href="${href(p.slug)}">${esc(p.name)}</a></li>`).join('')}</ul>
<p class="foot-h">Course</p><ul>${guides.map((g) => `<li><a href="${ghref(g.slug)}">${esc(g.short || g.h1 || g.title)}</a></li>`).join('')}</ul></div>
<p class="small">© ${new Date().getFullYear()} Kauzl · Free tools that run in your browser · <a href="${APP}">kauzl.com</a></p>
</div></footer>`;

await rm(path.join(here, 'dist'), { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(path.join(here, 'assets'), path.join(OUT, 'assets'), { recursive: true });
// Every page's link preview points here; a missing file is a broken preview everywhere.
await readFile(path.join(OUT, 'assets', 'og.png')).catch(() => { throw new Error('tools/assets/og.png is missing: every page uses it as og:image (1200×630).'); });
await writeFile(path.join(OUT, 'index.html'), indexPage(pages));
for (const p of pages) {
  await mkdir(path.join(OUT, p.slug), { recursive: true });
  await writeFile(path.join(OUT, p.slug, 'index.html'), toolPage(p, pages, guides));
}
await mkdir(GOUT, { recursive: true });
await writeFile(path.join(GOUT, 'index.html'), guidesIndex(guides));
for (const g of guides) {
  await mkdir(path.join(GOUT, g.slug), { recursive: true });
  await writeFile(path.join(GOUT, g.slug, 'index.html'), guidePage(g, guides, pages));
}
// One sitemap for kauzl.com (served at /sitemap.xml; the app's robots.txt points here).
const today = new Date().toISOString().slice(0, 10);
const entries = [
  [`${SITE}/`, today],
  [url(''), today], ...pages.map((p) => [url(p.slug), today]),
  [gurl(''), today], ...guides.map((g) => [gurl(g.slug), g.updated || g.published]),
];
await writeFile(path.join(here, 'dist', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(([loc, mod]) => `  <url><loc>${loc}</loc><lastmod>${mod}</lastmod></url>`).join('\n')}
</urlset>
`);
// llms.txt (llmstxt.org): a Markdown map of the site for AI assistants, served
// at kauzl.com/llms.txt. The free course is one course, with its modules and
// numbered lessons; every lesson and tool is still listed.
const llms = `# Kauzl

> Kauzl is an analytics calendar for your website. It reads Google Analytics 4, Plausible, PostHog, Cloudflare Web Analytics, Search Console and Bing, shows each day next to your releases, posts and campaigns, and says what changed, why, and whether it is real. These are its free guides and browser tools.

## Free course: ${COURSE.name}

${COURSE_ORDER.length} lessons in ${MODULES.length} modules. Course page: ${gurl('')}

${MODULES.map((m, i) => `### Module ${i + 1}: ${m.name}

${m.lessons.filter((l) => guides.some((g) => g.slug === l.slug)).map((l) => {
  const g = guides.find((x) => x.slug === l.slug);
  return `${COURSE_ORDER.indexOf(l.slug) + 1}. [${g.short || g.h1}](${gurl(l.slug)}): ${g.description}`;
}).join('\n')}
`).join('\n')}
### More lessons

${guides.filter((g) => !COURSE_ORDER.includes(g.slug)).map((g) => `- [${g.short || g.h1}](${gurl(g.slug)}): ${g.description}`).join('\n')}

## Free tools

${pages.map((p) => `- [${p.name}](${url(p.slug)}): ${p.description}`).join('\n')}

## Kauzl

- [Home](${SITE}/): what Kauzl does
- [Look inside](${SITE}/tour/): the Kauzl app with sample data, no sign-up
`;
await writeFile(path.join(here, 'dist', 'llms.txt'), llms);

// The SEO and GEO rules, on every page and on the site as a whole.
const sitemapXml = await readFile(path.join(here, 'dist', 'sitemap.xml'), 'utf8');
const failures = [
  ...BUILT.map((p) => describe(p.url.replace(SITE, ''), checkPage(p.html, { url: p.url }))),
  describe('site', checkSite({ pages: BUILT.map((p) => ({ ...p, inLlms: p.url !== url('') && p.url !== gurl('') })), sitemap: sitemapXml, llms })),
].filter(Boolean);
if (failures.length) {
  console.error(`The site breaks the SEO/GEO rules (tools/seo-rules.mjs, docs/seo-rules.md):\n${failures.join('\n')}`);
  process.exit(1);
}

// Only meaningful when the tools are the site root; otherwise add the
// sitemap line to the main site's robots.txt.
if (!BASE) await writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`${GA ? `Google tag ${GA} on every page. ` : 'No Google tag set (tools/site.config.json). '}Built ${pages.length} tools and ${guides.length} guides into ${path.relative(process.cwd(), path.join(here, 'dist'))} for ${SITE}`);
