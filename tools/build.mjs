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
import { owl } from './assets/lib/owl.js';

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
  return guides.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
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
const OG_ALT = 'Kauzl: you shipped it. Did it work? An owl over a before-and-after chart.';

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
  <nav aria-label="Main"><a href="${href('')}">Tools</a><a href="${ghref('')}">Guides</a><a href="${APP}/tour/">Look inside</a><a class="btn amber small" href="#early-access">Get early access</a></nav>
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
<h2>${c.title || 'You shipped it. Did it work?'}</h2>
<p>${c.text || 'Kauzl lines up every change you ship with what happened next: traffic, search, mentions and AI answers. A straight answer, not another dashboard.'}</p>
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
${reading.length ? `<h2 class="section-title">Read the guide</h2><div class="grid">${reading.map(guideTile).join('')}</div>` : ''}
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

const guideTile = (g) => `<a class="tile guide" href="${ghref(g.slug)}"><span class="kick">Guide · ${g.minutes} min read</span><h3>${esc(g.h1 || g.title)}</h3><p>${esc(g.blurb || g.description)}</p><span class="go" aria-hidden="true">Read →</span></a>`;

// One article: hero with title and date, an "In short" box, the body, FAQ,
// the tools it uses, and the other guides.
function guidePage(g, guides, pages) {
  const tools = pages.filter((p) => (g.tools || []).includes(p.slug));
  const others = guides.filter((o) => o.slug !== g.slug).slice(0, 3);
  const band = `<section class="band article-band"><div class="wrap band-in">
<div class="band-copy"><p class="crumbs"><a href="${ghref('')}">Guides</a><span aria-hidden="true"> / </span>${esc(g.kicker || 'Analytics')}</p>
<h1>${esc(g.h1 || g.title)}</h1><p class="lead">${g.lead || g.description}</p>
<p class="article-meta">By the Kauzl team · Updated <time datetime="${g.updated || g.published}">${fmtDate(g.updated || g.published)}</time> · ${g.minutes} min read</p></div>
<div class="perch" aria-hidden="true">${owl(132, { variant: 'paper', className: 'hero-owl' })}<span class="branch"></span></div>
</div></section>`;
  const body = `
<article class="content article">
${g.inShort?.length ? `<aside class="in-short"><p class="lbl">In short</p><ul>${g.inShort.map((x) => `<li>${x}</li>`).join('')}</ul></aside>` : ''}
${g.body}
${g.faq?.length ? `<h2>Questions</h2><div class="faq">${g.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>` : ''}
</article>
${cta(g.cta, 'guides')}
${tools.length ? `<h2 class="section-title">Free tools for this</h2><div class="grid">${tools.map(tile).join('')}</div>` : ''}
<h2 class="section-title">More guides</h2>
<div class="grid">${others.map(guideTile).join('')}</div>`;
  const ld = [{
    '@context': 'https://schema.org', '@type': 'Article', headline: g.h1 || g.title, description: g.description,
    datePublished: g.published, dateModified: g.updated || g.published, mainEntityOfPage: gurl(g.slug),
    author: { '@type': 'Organization', name: 'Kauzl', url: APP }, publisher: { '@type': 'Organization', name: 'Kauzl', url: APP },
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Guides', item: gurl('') },
      { '@type': 'ListItem', position: 2, name: g.h1 || g.title, item: gurl(g.slug) },
    ],
  }];
  if (g.faq?.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) });
  return layout({ canonical: gurl(g.slug), page: `guide:${g.slug}`, ogType: 'article', skip: 'Skip to the article', title: g.title, description: g.description, band, body, ld });
}

function guidesIndex(guides) {
  const band = `<section class="band home"><div class="wrap band-in">
<div class="band-copy"><p class="eyebrow">Guides from kauzl</p>
<h1>Analytics, explained plainly.</h1>
<p class="lead">How to set up Google Analytics, tag campaigns, track traffic from ChatGPT, read an A/B test, and tell whether a change you shipped actually worked. No jargon, and every guide comes with a free tool.</p></div>
<div class="perch" aria-hidden="true">${owl(190, { variant: 'paper', className: 'hero-owl' })}<span class="branch"></span></div>
</div></section>`;
  const body = `<section class="group"><h2 class="section-title">All guides</h2><p class="section-sub">${guides.length} guides, newest ideas first.</p>
<div class="grid">${guides.map(guideTile).join('')}</div></section>
${cta({}, 'guides')}`;
  return layout({
    canonical: gurl(''), page: 'index:guides', skip: 'Skip to the guides', title: 'Analytics Guides: GA4, UTMs, AI Traffic, A/B Tests | Kauzl',
    description: 'Plain-English guides to Google Analytics 4, UTM parameters, ChatGPT and AI traffic, AI crawlers, Search Console and A/B testing, each with a free tool.',
    band, body, ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Kauzl guides', url: gurl(''), hasPart: guides.map((g) => ({ '@type': 'Article', headline: g.h1 || g.title, url: gurl(g.slug) })) }],
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
<h1>Small tools for people who ship.</h1>
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
<div class="foot-brand">${owl(40)}<div><p class="word">kauzl</p><p>The owl that watches what you ship.</p></div></div>
<div class="foot-lists"><p class="foot-h">Free tools</p><ul>${pages.map((p) => `<li><a href="${href(p.slug)}">${esc(p.name)}</a></li>`).join('')}</ul>
<p class="foot-h">Guides</p><ul>${guides.map((g) => `<li><a href="${ghref(g.slug)}">${esc(g.short || g.h1 || g.title)}</a></li>`).join('')}</ul></div>
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
// at kauzl.com/llms.txt. Every guide and tool, with its one-line description.
const llms = `# Kauzl

> Kauzl is analytics for people who ship. It reads Google Analytics 4, Search Console and Bing, puts your releases, posts and campaigns on the same timeline, and says what changed, why, and whether it is real. These are its free guides and browser tools.

## Guides

${guides.map((g) => `- [${g.short || g.h1}](${gurl(g.slug)}): ${g.description}`).join('\n')}

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
