// My articles: what you published on your own site, and what each piece brings.
// Three inputs, each optional:
//   - the sitemap (robots.txt → Sitemap:, else /sitemap.xml): every URL and its
//     lastmod; article pages are then read for title, description and publish date
//   - the site's code on GitHub (the repos funnel suggestions use): Markdown/MDX
//     content files with their front matter, matched to URLs by slug, so posts
//     missing from the sitemap and sitemap pages with no source both show up
//   - traffic: GA4 views and landing sessions by source, Search Console clicks,
//     impressions and top queries per URL
// Nothing is stored; sitemap and page reads are cached for hours, traffic for minutes.

import { gunzipSync } from 'node:zlib';
import { runReport } from '../shared/sitelens/ga4.js';
import { getRange, hostFilter } from '../shared/sitelens/reports.js';
import { querySearchAnalytics, searchRange, hostPageFilter } from '../shared/sitelens/gsc.js';
import { sourceFamily } from './journey.mjs';
import { githubGet, siteRepos, tarEntries } from './funnel-suggest.mjs';
import { createCache } from './cache.mjs';

const USER_AGENT = 'Mozilla/5.0 (compatible; SiteLensStudio/0.2; +local analytics dashboard)';
const SITEMAP_TTL = 6 * 60 * 60_000;
const PAGE_TTL = 24 * 60 * 60_000;
const TRAFFIC_TTL = 5 * 60_000;
const CODE_TTL = 60 * 60_000;
const MAX_SITEMAPS = 25;
const MAX_URLS = 5000;
const MAX_PAGE_READS = 120;
const MAX_TARBALL = 60_000_000;

/* ---------- which URLs and files are articles (pure) ---------- */

const ARTICLE_SECTION = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(blog|posts?|articles?|news|guides?|tutorials?|docs?|documentation|learn|insights|stories|writing|notes|changelog|resources|help|kb|knowledge-base|case-studies)\/[^/]+/i;
const DATED_PATH = /\/(19|20)\d{2}\/\d{2}\//;
const LISTING = /\/(page|tags?|categor(y|ies)|authors?|archives?|feed)(\/|$)/i;

export function isArticlePath(path) {
  return (ARTICLE_SECTION.test(path) || DATED_PATH.test(path)) && !LISTING.test(path);
}

export function normPath(path) {
  return String(path || '/').replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
}

const lastSegment = (path) => normPath(path).split('/').pop().toLowerCase();

const bare = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

/* ---------- sitemap ---------- */

const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (block, name) => {
  const m = new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i').exec(block);
  return m ? decode(m[1]) : '';
};

// { sitemaps: [nested sitemap URLs], urls: [{ loc, lastmod }] } from one sitemap file.
export function parseSitemap(xml) {
  const text = String(xml);
  const sitemaps = [...text.matchAll(/<(?:\w+:)?sitemap>([\s\S]*?)<\/(?:\w+:)?sitemap>/gi)].map((m) => tag(m[1], 'loc')).filter(Boolean);
  const urls = [...text.matchAll(/<(?:\w+:)?url>([\s\S]*?)<\/(?:\w+:)?url>/gi)]
    .map((m) => ({ loc: tag(m[1], 'loc'), lastmod: tag(m[1], 'lastmod') }))
    .filter((u) => u.loc);
  return { sitemaps, urls };
}

export function robotsSitemaps(text) {
  return [...String(text).matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
}

/* ---------- article pages ---------- */

function attrs(tagText) {
  const out = {};
  for (const m of tagText.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? '');
  return out;
}

// Title, description and publish date from an article's HTML head.
export function parseArticleHtml(html) {
  const text = String(html);
  const meta = {};
  for (const m of text.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = a.content;
  }
  const title = meta['og:title'] || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1] || '');
  const ld = /"datePublished"\s*:\s*"([^"]+)"/.exec(text)?.[1] || '';
  const published = meta['article:published_time'] || meta.datepublished || meta['date'] || ld || '';
  return {
    title: title.replace(/\s+/g, ' '),
    description: (meta.description || meta['og:description'] || '').replace(/\s+/g, ' '),
    published: validDate(published),
  };
}

function validDate(value) {
  const t = Date.parse(String(value || '').trim());
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
}

/* ---------- content files in code ---------- */

const CONTENT_FILE = /\.(mdx?|markdoc)$/i;
// Any folder named like content: blog/, _posts/, blog-posts/, src/content/, docs/…
const CONTENT_DIR = /(^|\/)[\w-]*(content|posts?|blog|articles?|docs?|guides?|tutorials?|news|writing|notes|changelog)[\w-]*\//i;
const SKIP_FILE = /(^|\/)\._|(^|\/)(node_modules|dist|build|out|vendor|\.github|\.changeset)\/|(^|\/)(README|CHANGELOG|LICENSE|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY)\.mdx?$/i;
const MAX_FILE = 500_000;

// Flat `key: value` front matter; enough for title/date/slug/draft.
export function frontMatter(text) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(String(text));
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (kv) out[kv[1].toLowerCase()] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

// One content file → { file, slug, title, published, draft }.
export function contentEntry(path, text) {
  const fm = frontMatter(text);
  const parts = path.split('/');
  let name = parts.pop().replace(CONTENT_FILE, '');
  if (/^(index|readme|\+page)$/i.test(name)) name = parts[parts.length - 1] || name;
  const dated = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(name);
  const slug = (fm.slug || (fm.permalink ? lastSegment(fm.permalink) : '') || (dated ? dated[2] : name)).toLowerCase();
  const heading = /^#\s+(.+)$/m.exec(String(text).replace(/^---[\s\S]*?\n---/, ''))?.[1] || '';
  return {
    file: path,
    slug,
    title: fm.title || heading.trim(),
    published: validDate(fm.date || fm.pubdate || fm.publishdate || fm.published || fm.publishedat || fm.created || fm.createdat || (dated ? dated[1] : '')),
    draft: /^(true|yes)$/i.test(fm.draft || '') || /^(false|no)$/i.test(fm.published || ''),
  };
}

export function scanContent(gz) {
  const entries = [];
  for (const entry of tarEntries(gunzipSync(gz))) {
    if (!CONTENT_FILE.test(entry.path) || !CONTENT_DIR.test(entry.path) || SKIP_FILE.test(entry.path) || entry.size > MAX_FILE) continue;
    const item = contentEntry(entry.path, entry.body.toString('utf8'));
    if (!item.draft && item.slug) entries.push(item);
  }
  return entries;
}

// The candidate path sharing the most trailing segments with the file wins
// (docs/setup/index.md and docs/api/index.md both have the slug "setup"/"api";
// two "introduction" pages are told apart by their folder).
export function matchFile(entry, paths) {
  const want = entry.slug;
  const fileSegs = entry.file.replace(CONTENT_FILE, '').toLowerCase().split('/');
  let best = null;
  let bestScore = -1;
  for (const p of paths) {
    const segs = normPath(p).toLowerCase().split('/');
    if (segs[segs.length - 1] !== want) continue;
    let score = 0;
    for (let i = 2; i <= segs.length && fileSegs.includes(segs[segs.length - i]); i++) score++;
    if (score > bestScore) [best, bestScore] = [p, score];
  }
  return best;
}

/* ---------- joining it all (pure) ---------- */

// rows: one per article with traffic, search and code attached.
export function buildArticles({ sitemap = [], pages = new Map(), views = new Map(), landings = new Map(), search = new Map(), files = [], all = false }) {
  const byPath = new Map();
  const add = (path, patch) => {
    const key = normPath(path);
    const row = byPath.get(key) || { path: key, url: '', title: '', description: '', published: '', lastmod: '', inSitemap: false, file: null };
    byPath.set(key, Object.assign(row, patch));
    return row;
  };
  for (const u of sitemap) add(u.path, { url: u.loc, lastmod: validDate(u.lastmod), inSitemap: true });

  // Code files match sitemap URLs first, then any path GA4 saw.
  const pool = [...byPath.keys(), ...[...views.keys()].filter((p) => !byPath.has(p))];
  const orphans = [];
  for (const f of files) {
    const path = matchFile(f, pool);
    if (path) add(path, { file: f });
    else orphans.push(f);
  }
  // A repo whose files match no URL isn't where the site's content lives
  // (an extension's docs/privacy.md); only a content repo's leftovers are posts missing from the site.
  const contentRepos = new Set([...byPath.values()].filter((r) => r.file).map((r) => r.file.repo || ''));

  const rows = [];
  for (const row of byPath.values()) {
    if (!all && !row.file && !isArticlePath(row.path)) continue;
    const page = pages.get(row.path) || {};
    const v = views.get(row.path) || {};
    const l = landings.get(row.path) || { sessions: 0, sources: new Map() };
    const s = search.get(row.path) || null;
    rows.push({
      ...row,
      title: row.file?.title || page.title || '',
      description: page.description || '',
      published: row.file?.published || page.published || '',
      views: v.views || 0,
      users: v.users || 0,
      engagementRate: v.engagementRate || 0,
      avgDuration: v.avgDuration || 0,
      sessions: l.sessions,
      sources: [...l.sources].map(([label, sessions]) => ({ label, sessions })).sort((a, b) => b.sessions - a.sessions).slice(0, 4),
      search: s && { clicks: s.clicks, impressions: s.impressions, position: s.position, queries: s.queries.slice(0, 3) },
    });
  }
  for (const f of orphans.filter((o) => contentRepos.has(o.repo || ''))) {
    rows.push({ path: '', url: '', title: f.title, description: '', published: f.published, lastmod: '', inSitemap: false, file: f,
      views: 0, users: 0, engagementRate: 0, avgDuration: 0, sessions: 0, sources: [], search: null });
  }
  return rows.sort((a, b) => b.sessions - a.sessions || b.views - a.views || String(b.published || b.lastmod).localeCompare(String(a.published || a.lastmod)));
}

export function articleTotals(rows, { siteSessions = 0, searchLinked = false, codeRead = false } = {}) {
  const live = rows.filter((r) => r.path);
  const sessions = live.reduce((a, r) => a + r.sessions, 0);
  return {
    articles: rows.length,
    withTraffic: live.filter((r) => r.sessions || r.views).length,
    noTraffic: live.filter((r) => !r.sessions && !r.views).length,
    sessions,
    share: siteSessions ? sessions / siteSessions : null,
    notInGoogle: searchLinked ? live.filter((r) => !r.search?.impressions).length : null,
    notInSitemap: rows.filter((r) => r.file && !r.inSitemap).length,
    noSource: codeRead ? live.filter((r) => r.inSitemap && !r.file).length : null,
  };
}

/* ---------- service ---------- */

export function createArticles({ auth, store, getToken, fetchImpl = fetch, now = Date.now }) {
  const cache = createCache();
  const pageCache = new Map(); // url → { at, value }
  const codeCache = new Map(); // repo → { at, pushedAt, entries }

  async function fetchText(url, { timeout = 10_000 } = {}) {
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  }

  async function readSitemap(site) {
    return cache.wrap(`sitemap:${site.host}`, SITEMAP_TTL, false, async () => {
      const origin = `https://${site.host}`;
      let roots = [];
      try {
        roots = robotsSitemaps(await fetchText(`${origin}/robots.txt`));
      } catch { /* no robots.txt is fine */ }
      if (!roots.length) roots = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
      const queue = [...roots];
      const read = [];
      const failed = [];
      const urls = new Map();
      while (queue.length && read.length + failed.length < MAX_SITEMAPS && urls.size < MAX_URLS) {
        const next = queue.shift();
        if (read.includes(next)) continue;
        try {
          const parsed = parseSitemap(await fetchText(next));
          read.push(next);
          queue.push(...parsed.sitemaps.filter((s) => !read.includes(s)));
          for (const u of parsed.urls) {
            let parsedUrl;
            try { parsedUrl = new URL(u.loc); } catch { continue; }
            if (bare(parsedUrl.hostname) !== bare(site.host)) continue;
            const path = normPath(parsedUrl.pathname);
            if (!urls.has(path)) urls.set(path, { ...u, path });
          }
        } catch {
          failed.push(next);
        }
      }
      // Guessed locations that 404 aren't worth reporting once one worked.
      return { sitemaps: read, failed: read.length ? [] : failed, urls: [...urls.values()].slice(0, MAX_URLS) };
    });
  }

  // Head metadata for article pages, a few at a time, cached for a day.
  async function readPages(site, paths) {
    const out = new Map();
    const todo = [];
    for (const path of paths) {
      const hit = pageCache.get(`${site.host}${path}`);
      if (hit && now() - hit.at < PAGE_TTL) out.set(path, hit.value);
      else todo.push(path);
    }
    const queue = todo.slice(0, MAX_PAGE_READS);
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const path = queue.shift();
        try {
          const value = parseArticleHtml((await fetchText(`https://${site.host}${path}`, { timeout: 8000 })).slice(0, 300_000));
          pageCache.set(`${site.host}${path}`, { at: now(), value });
          out.set(path, value);
        } catch { /* a page that won't load just keeps its path as the title */ }
      }
    }));
    return out;
  }

  async function readCode(site) {
    const token = await getToken();
    if (!token) return { files: [], repos: [], read: false, note: 'Add a GitHub token in Settings → GitHub to match articles to their source files.' };
    let repos;
    try {
      repos = await siteRepos({ store, site, token, fetchImpl });
    } catch (err) {
      return { files: [], repos: [], read: false, note: `Couldn’t list your GitHub repos: ${err.message}` };
    }
    if (!repos.length) return { files: [], repos: [], read: false, note: `No GitHub repo has ${site.host} as its homepage.` };
    const files = [];
    const read = [];
    const failed = [];
    for (const repo of repos) {
      try {
        const hit = codeCache.get(repo.name);
        let entries;
        if (hit && (repo.pushedAt ? hit.pushedAt === repo.pushedAt : now() - hit.at < CODE_TTL)) entries = hit.entries;
        else {
          const res = await githubGet(fetchImpl, `/repos/${repo.name}/tarball`, token);
          if (Number(res.headers.get('content-length')) > MAX_TARBALL) throw new Error('too large to scan');
          entries = scanContent(Buffer.from(await res.arrayBuffer()));
          codeCache.set(repo.name, { at: now(), pushedAt: repo.pushedAt, entries });
        }
        read.push({ name: repo.name, files: entries.length });
        const branch = repo.branch || 'HEAD';
        for (const e of entries) files.push({ ...e, repo: repo.name, branch, href: `https://github.com/${repo.name}/blob/${branch}/${e.file}` });
      } catch (err) {
        failed.push(`${repo.name} (${err.message})`);
      }
    }
    return { files, repos: read, read: read.length > 0, note: failed.length ? `Couldn’t read ${failed.join(', ')}.` : '' };
  }

  async function readGa4(site, rangeKey) {
    const token = await auth.token();
    const range = getRange(rangeKey);
    const filter = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
    const [pagesReport, landingReport] = await Promise.all([
      runReport({ token, propertyId: site.propertyId, body: {
        dateRanges: [range.current], dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'engagementRate' }, { name: 'averageSessionDuration' }],
        dimensionFilter: filter, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10000,
      } }),
      runReport({ token, propertyId: site.propertyId, body: {
        dateRanges: [range.current], dimensions: [{ name: 'landingPage' }, { name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: filter, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 25000,
      } }),
    ]);
    const views = new Map();
    for (const r of pagesReport.rows) {
      const path = normPath(r.pagePath);
      const prev = views.get(path);
      const row = { views: Number(r.screenPageViews) || 0, users: Number(r.activeUsers) || 0, engagementRate: Number(r.engagementRate) || 0, avgDuration: Number(r.averageSessionDuration) || 0 };
      // /post and /post/ are one article.
      views.set(path, prev ? { ...prev, views: prev.views + row.views, users: prev.users + row.users } : row);
    }
    const landings = new Map();
    let siteSessions = 0;
    for (const r of landingReport.rows) {
      const path = normPath(r.landingPage);
      const sessions = Number(r.sessions) || 0;
      siteSessions += sessions;
      const l = landings.get(path) || { sessions: 0, sources: new Map() };
      l.sessions += sessions;
      const family = sourceFamily(r.sessionSource);
      l.sources.set(family, (l.sources.get(family) || 0) + sessions);
      landings.set(path, l);
    }
    return { views, landings, siteSessions };
  }

  async function readSearch(site, rangeKey) {
    const token = await auth.token();
    const range = searchRange(rangeKey);
    const pageFilter = hostPageFilter(site.searchSite, site.host, { includeSubdomains: site.includeSubdomains });
    const run = (dimensions, rowLimit) => querySearchAnalytics({ token, siteUrl: site.searchSite, body: {
      ...range.current, dimensions, rowLimit, ...(pageFilter ? { dimensionFilterGroups: [{ groupType: 'and', filters: [pageFilter] }] } : {}),
    } });
    const [pages, pageQueries] = await Promise.all([run(['page'], 5000), run(['page', 'query'], 10000)]);
    const pathOf = (url) => { try { return normPath(new URL(url).pathname); } catch { return ''; } };
    const out = new Map();
    for (const r of pages) {
      const path = pathOf(r.key);
      if (!path) continue;
      const prev = out.get(path);
      if (prev) Object.assign(prev, { clicks: prev.clicks + r.clicks, impressions: prev.impressions + r.impressions });
      else out.set(path, { clicks: r.clicks, impressions: r.impressions, position: r.position, queries: [] });
    }
    for (const r of pageQueries) {
      const row = out.get(pathOf(r.keys[0]));
      if (row) row.queries.push({ query: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position });
    }
    for (const row of out.values()) row.queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
    return out;
  }

  async function list(site, rangeKey = '28d', { all = false, fresh = false } = {}) {
    if (site.demo) return demoArticles(rangeKey, all);
    if (!site.host) return { range: rangeKey, rows: [], totals: articleTotals([]), notes: { sitemap: 'This site has no address yet. Add one in Settings.' }, sitemaps: [], repos: [] };
    if (fresh) {
      cache.clear(site.host);
      cache.clear(`${site.id}:`);
    }
    const settle = (p) => p.then((value) => ({ value }), (err) => ({ error: err.message || String(err) }));
    const [sitemap, code, ga4, search] = await Promise.all([
      settle(readSitemap(site)),
      settle(cache.wrap(`code:${site.id}`, CODE_TTL, fresh, () => readCode(site))),
      site.propertyId ? settle(cache.wrap(`ga4:${site.id}:${rangeKey}`, TRAFFIC_TTL, fresh, () => readGa4(site, rangeKey))) : null,
      site.searchSite ? settle(cache.wrap(`gsc:${site.id}:${rangeKey}`, TRAFFIC_TTL, fresh, () => readSearch(site, rangeKey))) : null,
    ]);

    const urls = sitemap.value?.urls || [];
    const files = code.value?.files || [];
    const views = ga4?.value?.views || new Map();
    const candidates = buildArticles({ sitemap: urls, views, files, all });
    const pages = await readPages(site, candidates.filter((r) => r.path && !r.file?.title).map((r) => r.path));
    const rows = buildArticles({
      sitemap: urls, pages, views, files, all,
      landings: ga4?.value?.landings, search: search?.value,
    });

    const sm = sitemap.value;
    return {
      range: rangeKey,
      host: site.host,
      all,
      rows,
      totals: articleTotals(rows, { siteSessions: ga4?.value?.siteSessions || 0, searchLinked: Boolean(search?.value), codeRead: rows.some((r) => r.file && r.path) }),
      sitemaps: sm?.sitemaps || [],
      sitemapUrls: urls.length,
      repos: code.value?.repos || [],
      notes: {
        sitemap: sitemap.error || (!sm?.sitemaps.length ? `No sitemap found at ${site.host} (checked robots.txt and /sitemap.xml).` : ''),
        code: code.error || code.value?.note || '',
        ga4: !ga4 ? 'Link a GA4 property to see views and where readers came from.' : ga4.error || '',
        search: !search ? 'Pick a Search Console property in Settings to see clicks and queries per article.' : search.error || '',
      },
    };
  }

  // One article's row (with its source file and live title/description).
  async function find(site, path, rangeKey = '28d') {
    const want = normPath(path);
    const page = await list(site, rangeKey, { all: true });
    const row = page.rows.find((r) => r.path === want);
    if (!row) return null;
    const meta = pageCache.get(`${site.host}${want}`)?.value || null;
    return { ...row, meta };
  }

  return { list, find, readPage: (site, path) => readPages(site, [normPath(path)]).then((m) => m.get(normPath(path)) || null) };
}

/* ---------- demo ---------- */

function demoArticles(rangeKey, all) {
  const scale = (getRange(rangeKey).days || 28) / 28;
  const n = (v) => Math.round(v * scale);
  const mk = (path, title, published, sessions, sources, search, file, inSitemap = true) => ({
    path, url: `https://demo.sitelens.dev${path}`, title, description: '', published, lastmod: published, inSitemap,
    file: file ? { file, repo: 'demo/site', slug: path.split('/').pop(), title, published, href: '' } : null,
    views: n(sessions * 1.4), users: n(sessions * 0.9), engagementRate: 0.55, avgDuration: 95,
    sessions: n(sessions), sources: sources.map(([label, s]) => ({ label, sessions: n(s) })),
    search: search && { clicks: n(search[0]), impressions: n(search[1]), position: search[2], queries: search[3] || [] },
  });
  const rows = [
    mk('/blog/ga4-vs-plausible', 'GA4 vs Plausible: what you actually lose', '2026-07-14', 840, [['Google', 610], ['Reddit', 120], ['ChatGPT', 64]], [590, 14200, 6.1, [{ query: 'ga4 vs plausible', clicks: 210, impressions: 3900, position: 4.2 }]], 'content/blog/ga4-vs-plausible.mdx'),
    mk('/blog/search-console-api-guide', 'The Search Console API, start to finish', '2026-05-02', 512, [['Google', 430], ['Direct', 50]], [420, 9800, 8.4, [{ query: 'search console api', clicks: 160, impressions: 4100, position: 7.9 }]], 'content/blog/search-console-api-guide.mdx'),
    mk('/docs/getting-started', 'Getting started', '2026-01-20', 300, [['Direct', 150], ['GitHub', 110]], [40, 900, 12.3], 'docs/getting-started.md'),
    mk('/blog/bigquery-export-costs', 'What the GA4 BigQuery export really costs', '2026-09-08', 96, [['Hacker News', 70], ['Google', 20]], [18, 2600, 14.8], 'content/blog/bigquery-export-costs.mdx'),
    mk('/blog/launch-week-recap', 'Launch week recap', '2026-10-21', 12, [['Direct', 12]], [0, 40, 41], 'content/blog/launch-week-recap.mdx'),
    mk('/blog/old-pricing-post', 'Our pricing, explained', '2025-11-03', 0, [], null, null),
    mk('/blog/ai-referrals', 'Tracking ChatGPT and Perplexity referrals', '2026-10-28', 0, [], null, 'content/blog/ai-referrals.mdx', false),
  ];
  if (all) rows.push(mk('/pricing', 'Pricing', '', 650, [['Direct', 400], ['Google', 250]], [210, 3000, 3.1], null));
  rows.sort((a, b) => b.sessions - a.sessions);
  return {
    range: rangeKey, host: 'demo.sitelens.dev', all, demo: true, rows,
    totals: articleTotals(rows, { siteSessions: n(3600), searchLinked: true, codeRead: true }),
    sitemaps: ['https://demo.sitelens.dev/sitemap.xml'], sitemapUrls: 24, repos: [{ name: 'demo/site', files: 6 }],
    notes: { sitemap: '', code: '', ga4: '', search: '' },
  };
}

export function articleRoutes({ articles, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/articles$/, async ({ match, query }) =>
      articles.list(await siteOr404(match[1]), query.get('range') || '28d', { all: query.get('all') === '1', fresh: query.get('fresh') === '1' })],
  ];
}
