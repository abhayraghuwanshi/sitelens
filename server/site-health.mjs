// Pages → Health (docs/redesign → Pages → Health): can search show each page,
// and how fast the busiest pages are on phones and computers.
//
//  - Index: Google's URL Inspection and Bing's URL info for the site's busiest
//    pages (search-hub.mjs, which caches each answer), sorted into Shown, Needs
//    a fix, Not shown and Hidden on purpose, with why and what to do.
//  - Speed: PageSpeed on phones and computers for the busiest pages
//    (vitals.psiUrl), not only the home page.
//
// Both are slow to gather (one call per page per engine), so each answer is
// cached and only one gathering runs per site at a time.

import { createCache } from './cache.mjs';

const HOUR = 3_600_000;
const INDEX_PAGES = 12;
const SPEED_PAGES = 5;

// What each kind of problem means, why it usually happens, and the fix.
export const INDEX_KINDS = {
  canon: { title: 'Google picked a different address', why: 'Google shows another version of this page, so its visits and rank are split between two addresses.', fix: 'Point every link and the sitemap at one address, and redirect the other to it.' },
  crawled: { title: 'Crawled, not indexed', why: 'Google read the page and chose not to show it yet: often thin, too similar to another page, or with no links to it.', fix: 'Link to it from pages that already get visits, make it clearly different from its neighbours, then ask Google to look again.' },
  notyet: { title: 'Not crawled yet', why: 'The engine knows the page exists (or doesn’t yet) but hasn’t read it.', fix: 'Make sure the sitemap lists it and a busy page links to it; for Bing, submit it (IndexNow) and it usually shows within days.' },
  redirect: { title: 'Listed, but it redirects', why: 'The sitemap or links point at an address that sends people elsewhere.', fix: 'List the address it redirects to instead, and take the old one out of the sitemap.' },
  missing: { title: 'The engine gets an error', why: 'When the engine last asked for the page, it didn’t get it.', fix: 'Check the page loads for everyone, then ask the engine to look again.' },
  noindex: { title: 'Told not to show it', why: 'The page has a noindex tag or header, so engines leave it out on purpose.', fix: 'Nothing, if you meant it. Otherwise remove the noindex.' },
};

// Google's inspection → [state, word, its own words], kind. state: ok | warn | bad | off | unknown.
export function googleState(g) {
  if (!g || g.note) return { state: ['unknown', 'Not checked', g?.note || ''], kind: null };
  const cov = String(g.coverage || '');
  const say = [cov, g.lastCrawled && `crawled ${g.lastCrawled}`].filter(Boolean).join(' · ') || g.verdict;
  if (/noindex/i.test(cov) || /NOINDEX/.test(g.indexing || '')) return { state: ['off', 'Hidden', say], kind: 'noindex' };
  if (/redirect/i.test(cov)) return { state: ['warn', 'Redirects', say], kind: 'redirect' };
  if (/not found|404|soft 404|server error/i.test(cov)) return { state: ['bad', 'Error', say], kind: 'missing' };
  // Even a trailing slash counts: two addresses split the page's visits and rank.
  const differ = Boolean(g.googleCanonical && g.userCanonical && g.googleCanonical !== g.userCanonical);
  if (/canonical/i.test(cov) || (g.indexed && differ)) return { state: ['warn', 'Different address', say], kind: 'canon' };
  if (g.indexed) return { state: ['ok', 'Shown', say], kind: null };
  if (/crawled/i.test(cov)) return { state: ['bad', 'Not shown', say], kind: 'crawled' };
  if (/discovered|unknown/i.test(cov)) return { state: ['warn', 'Not crawled', say], kind: 'notyet' };
  return { state: ['bad', 'Not shown', say], kind: 'crawled' };
}

// Bing's URL info → the same shape.
export function bingState(b) {
  if (!b || b.note) return { state: ['unknown', 'Not checked', b?.note || ''], kind: null };
  if (!b.known) return { state: ['warn', 'Not crawled', 'URL not found in Bing’s index'], kind: 'notyet' };
  const say = [b.httpStatus && `HTTP ${b.httpStatus}`, b.lastCrawled && `crawled ${b.lastCrawled}`, b.discovered && `found ${b.discovered}`].filter(Boolean).join(' · ');
  if (b.httpStatus >= 300 && b.httpStatus < 400) return { state: ['warn', 'Redirects', say], kind: 'redirect' };
  if (b.httpStatus >= 400) return { state: ['bad', 'Error', say], kind: 'missing' };
  if (!b.lastCrawled) return { state: ['warn', 'Not crawled', say || 'Discovered, not crawled'], kind: 'notyet' };
  return { state: ['ok', 'Shown', say], kind: null };
}

// One page's verdict from both engines: the problem worth fixing first.
const ORDER = ['canon', 'crawled', 'missing', 'redirect', 'notyet', 'noindex'];
export function pageIndex(row, status) {
  const g = googleState(status?.google);
  const b = bingState(status?.bing);
  const kind = ORDER.find((k) => k === g.kind || k === b.kind) || null;
  return {
    path: row.path, title: row.title || row.path, visits: row.visits || 0,
    google: g.state, bing: b.state, kind,
    ...(kind ? { problem: INDEX_KINDS[kind].title, why: INDEX_KINDS[kind].why, fix: INDEX_KINDS[kind].fix } : {}),
    onPurpose: kind === 'noindex',
    ...(g.kind === 'canon' ? { yours: status.google.userCanonical, theirs: status.google.googleCanonical } : {}),
  };
}

// The busiest pages, which matter most if search can't show them.
function busiest(rows, n) {
  return [...rows].filter((r) => r.inSitemap || r.visits > 0).sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, n);
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (i < list.length) {
      const k = i++;
      out[k] = await fn(list[k]);
    }
  }));
  return out;
}

export function createSiteHealth({ pageReview, hub, vitals, now = Date.now }) {
  const cache = createCache();

  async function index(site, { fresh = false } = {}) {
    return cache.wrap(`index:${site.id}`, 6 * HOUR, fresh, async () => {
      const { rows } = await pageReview.review(site, '90d');
      const pages = busiest(rows, INDEX_PAGES);
      const results = site.demo ? demoIndex(pages)
        : await mapLimit(pages, 4, async (r) => pageIndex(r, await hub.indexStatus(site, { path: r.path }).catch((err) => ({ google: { note: err.message }, bing: { note: err.message } }))));
      return { at: now(), checked: results.length, pages: results };
    });
  }

  async function speed(site, { fresh = false } = {}) {
    return cache.wrap(`speed:${site.id}`, 24 * HOUR, fresh, async () => {
      const { rows } = await pageReview.review(site, '90d');
      const host = String(site.host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const pages = busiest(rows, SPEED_PAGES);
      const results = site.demo ? demoSpeed(pages)
        : await mapLimit(pages, 2, async (r) => {
          const url = r.url || `https://${host}${r.path}`;
          const [phone, computer] = await Promise.all([vitals.psiUrl(url, 'mobile'), vitals.psiUrl(url, 'desktop')]);
          return { path: r.path, title: r.title || r.path, visits: r.visits || 0, phone, computer };
        });
      return { at: now(), pages: results };
    });
  }

  return { index, speed };
}

// The sample site: a spread of verdicts, so the design shows what each looks like.
function demoIndex(pages) {
  const shown = (r) => ({ google: { indexed: true, coverage: 'Submitted and indexed', lastCrawled: '2026-11-12' }, bing: { known: true, httpStatus: 200, lastCrawled: '2026-11-10' } });
  const kinds = [
    (r) => ({ google: { indexed: true, coverage: 'Duplicate, Google chose different canonical than user', lastCrawled: '2026-11-15', userCanonical: `https://example.com${r.path}`, googleCanonical: `https://example.com${r.path}/` }, bing: { known: true, httpStatus: 200, lastCrawled: '2026-11-15' } }),
    (r) => ({ google: { indexed: false, coverage: 'Crawled - currently not indexed', lastCrawled: '2026-11-12' }, bing: { known: false } }),
    (r) => ({ google: { indexed: true, coverage: 'Submitted and indexed', lastCrawled: '2026-11-09' }, bing: { known: true, httpStatus: 200, discovered: '2026-11-08', lastCrawled: null } }),
    (r) => ({ google: { indexed: false, coverage: "Excluded by 'noindex' tag", indexing: 'BLOCKED_BY_META_TAG_NOINDEX' }, bing: { known: true, httpStatus: 200, lastCrawled: '2026-11-01' } }),
  ];
  return pages.map((r, i) => pageIndex(r, (i === 0 ? kinds[0] : i === pages.length - 3 ? kinds[1] : i === pages.length - 2 ? kinds[2] : i === pages.length - 1 ? kinds[3] : shown)(r)));
}

function demoSpeed(pages) {
  const sample = [[3600, 1800], [2200, 1100], [2600, 1400], [4400, 2300], [2000, 1200]];
  return pages.map((r, i) => {
    const [ph, pc] = sample[i % sample.length];
    return { path: r.path, title: r.title || r.path, visits: r.visits || 0, phone: { strategy: 'mobile', lcp: ph, cls: i === 2 ? 0.18 : 0.04, score: Math.round(100 - ph / 60), error: null }, computer: { strategy: 'desktop', lcp: pc, cls: 0.02, score: Math.round(100 - pc / 40), error: null } };
  });
}

export function siteHealthRoutes({ health, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/health\/index$/, async ({ match, query }) => health.index(await siteOr404(match[1]), { fresh: query.has('fresh') })],
    ['GET', /^\/api\/sites\/([\w-]+)\/health\/speed$/, async ({ match, query }) => health.speed(await siteOr404(match[1]), { fresh: query.has('fresh') })],
  ];
}
