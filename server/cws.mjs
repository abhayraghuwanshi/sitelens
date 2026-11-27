// Extension store stats: Chrome Web Store, Microsoft Edge Add-ons and Firefox
// Add-ons. None has an analytics API for listings, so Studio builds its own
// history: each listing's users, rating and version, snapshotted once a day.
// Chrome also takes CSV exports from its developer dashboard (installs,
// uninstalls, weekly users…). Any "date + numeric columns" CSV works.
//
// Where each store's numbers come from:
//  - chrome: the public listing page (HTML, parsed).
//  - edge: the store's own JSON for a listing, by its 32-letter ID.
//  - firefox: addons.mozilla.org's public API (v5), by slug or numeric ID.
//
// IDs: Chrome and Edge use the 32-letter extension ID; a Firefox add-on is
// `firefox-<numeric id>`, which stays put when its slug changes.

import { SourceError } from './github.mjs';

const ID_RE = /^[a-p]{32}$/;
// Every ID an extension can have here, for routes and product links.
export const EXTENSION_ID_RE = /^(?:[a-p]{32}|firefox-\d{1,12})$/;
const LISTING = (id) => `https://chromewebstore.google.com/detail/${id}?hl=en`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

export const STORES = {
  chrome: { label: 'Chrome Web Store', url: (id) => `https://chromewebstore.google.com/detail/${id}` },
  edge: { label: 'Edge Add-ons', url: (id) => `https://microsoftedge.microsoft.com/addons/detail/${id}` },
  firefox: { label: 'Firefox Add-ons', url: (id) => `https://addons.mozilla.org/firefox/addon/${id.replace(/^firefox-/, '')}/` },
};

// Accepts a bare ID or any Web Store URL containing one.
export function parseExtensionId(input) {
  const match = String(input || '').trim().match(/[a-p]{32}/);
  if (!match || !ID_RE.test(match[0])) throw new SourceError('Paste a Chrome Web Store link or the 32-letter extension ID.', { kind: 'validation' });
  return match[0];
}

// A store link (or a bare ID with the store picked) → { store, ref }. `ref` is
// the 32-letter ID for Chrome and Edge, a slug or numeric ID for Firefox.
export function parseExtensionInput(input, storeHint = '') {
  const text = String(input || '').trim();
  const amo = text.match(/addons\.mozilla\.org\/(?:[\w-]+\/)?(?:firefox|android)\/addon\/([^/?#\s]+)/i);
  if (amo) return { store: 'firefox', ref: decodeURIComponent(amo[1]) };
  if (/microsoftedge\.microsoft\.com/i.test(text)) return { store: 'edge', ref: parseExtensionId(text) };
  if (/chromewebstore\.google\.com|chrome\.google\.com/i.test(text)) return { store: 'chrome', ref: parseExtensionId(text) };
  if (/^firefox-\d+$/.test(text)) return { store: 'firefox', ref: text.slice(8) };
  if (storeHint === 'firefox') {
    if (!/^[\w.@{}-]{2,120}$/.test(text)) throw new SourceError('Paste a Firefox Add-ons link, like addons.mozilla.org/firefox/addon/your-addon/.', { kind: 'validation' });
    return { store: 'firefox', ref: text };
  }
  if (ID_RE.test(text)) return { store: storeHint === 'edge' ? 'edge' : 'chrome', ref: text };
  throw new SourceError('Paste a Chrome Web Store, Edge Add-ons or Firefox Add-ons link.', { kind: 'validation' });
}

function decode(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function count(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, '').match(/([\d.]+)\s*([KkMm])?/);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(Number(m[1]) * mult);
}

// Pure parser so it can be tested against saved HTML.
export function parseListing(html) {
  const pick = (re) => re.exec(html)?.[1] ?? null;
  const usersText = pick(/>\s*([\d,]+\+?)\s+users?\s*</) || pick(/([\d,]+\+?)\s+users?\b/);
  const listing = {
    title: decode(pick(/<title>([^<]+?)(?:\s+-\s+Chrome Web Store)?<\/title>/) || ''),
    users: count(usersText),
    usersPlus: Boolean(usersText && usersText.includes('+')),
    rating: pick(/(\d(?:\.\d)?)\s+out of 5/) ? Number(pick(/(\d(?:\.\d)?)\s+out of 5/)) : null,
    ratings: count(pick(/([\d,.]+[KkMm]?)\s+ratings?\b/)),
    version: decode(pick(/Version<\/div><div[^>]*>([^<]+)/) || ''),
    updated: decode(pick(/Updated<\/div><div[^>]*>([^<]+)/) || ''),
    icon: pick(/og:image" content="([^"]+)"/) || '',
  };
  if (listing.users === null && !listing.title) {
    throw new SourceError('Could not read the Web Store listing — Google may have changed the page.', { kind: 'parse' });
  }
  return listing;
}

const dayText = (ms) => (Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

async function getJson(url, fetchImpl, what) {
  let res;
  try {
    res = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new SourceError(`Couldn’t reach ${what}: ${err.message}`, { kind: 'source' });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new SourceError(`${what} returned HTTP ${res.status}.`, { kind: 'source' });
  return res.json();
}

// Edge's listing JSON: an unknown ID answers 200 with no name.
export function parseEdgeListing(j) {
  if (!j?.name) return null;
  const logo = j.logoUrl || '';
  return {
    title: String(j.name),
    users: Number.isFinite(j.activeInstallCount) ? j.activeInstallCount : null,
    usersPlus: false,
    rating: Number.isFinite(j.averageRating) ? Math.round(j.averageRating * 10) / 10 : null,
    ratings: Number.isFinite(j.ratingCount) ? j.ratingCount : null,
    version: String(j.version || ''),
    updated: dayText(j.lastUpdateDate * 1000),
    icon: logo.startsWith('//') ? `https:${logo}` : logo,
  };
}

export function parseFirefoxListing(j) {
  if (!j?.id) return null;
  const name = typeof j.name === 'string' ? j.name : j.name?.['en-US'] || Object.values(j.name || {})[0] || '';
  return {
    amoId: j.id,
    slug: j.slug || '',
    title: String(name),
    users: Number.isFinite(j.average_daily_users) ? j.average_daily_users : null,
    usersPlus: false,
    rating: Number.isFinite(j.ratings?.average) ? Math.round(j.ratings.average * 10) / 10 : null,
    ratings: Number.isFinite(j.ratings?.count) ? j.ratings.count : null,
    version: String(j.current_version?.version || ''),
    updated: dayText(Date.parse(j.last_updated)),
    icon: j.icon_url || '',
  };
}

// One listing from any store. For Firefox, `ref` may be a slug or numeric ID.
export async function fetchStoreListing(store, ref, fetchImpl = fetch) {
  if (store === 'edge') {
    const j = await getJson(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${ref}?hl=en-US&gl=US`, fetchImpl, 'Edge Add-ons');
    const listing = parseEdgeListing(j);
    if (!listing) throw new SourceError(`No Edge Add-ons listing for ${ref}.`, { kind: 'notfound' });
    return listing;
  }
  if (store === 'firefox') {
    const j = await getJson(`https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(String(ref).replace(/^firefox-/, ''))}/`, fetchImpl, 'Firefox Add-ons');
    const listing = parseFirefoxListing(j);
    if (!listing) throw new SourceError(`No Firefox add-on called “${ref}”.`, { kind: 'notfound' });
    return listing;
  }
  return fetchListing(ref, fetchImpl);
}

export async function fetchListing(id, fetchImpl = fetch) {
  const res = await fetchImpl(LISTING(id), {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) throw new SourceError(`No Chrome Web Store listing for ${id}.`, { kind: 'notfound' });
  if (!res.ok) throw new SourceError(`Chrome Web Store returned HTTP ${res.status}.`, { kind: 'source' });
  return parseListing(await res.text());
}

/* ---------- dashboard CSV import ---------- */

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toIsoDate(text) {
  const t = String(text).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t); // US M/D/YY — the dashboard's format
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = Date.parse(t);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

// Returns { metrics: { "<column>": { "<YYYY-MM-DD>": number } } }.
// Rows whose first cell isn't a date (titles, notes, totals) are skipped.
export function parseDashboardCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const headerIndex = lines.findIndex((l, i) => i + 1 < lines.length && toIsoDate(splitCsvLine(lines[i + 1])[0]) && !toIsoDate(splitCsvLine(l)[0]));
  if (headerIndex < 0) throw new SourceError('This CSV has no header row followed by dated rows.', { kind: 'validation' });
  const header = splitCsvLine(lines[headerIndex]);
  const metrics = {};
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line);
    const date = toIsoDate(cells[0]);
    if (!date) continue;
    header.slice(1).forEach((name, i) => {
      const value = Number(String(cells[i + 1] ?? '').replace(/,/g, ''));
      if (!name || !Number.isFinite(value) || cells[i + 1] === '') return;
      (metrics[name] ||= {})[date] = value;
    });
  }
  if (!Object.keys(metrics).length) throw new SourceError('No numeric columns found in this CSV.', { kind: 'validation' });
  return { metrics };
}

/* ---------- store-backed tracker ---------- */

const today = () => new Date().toISOString().slice(0, 10);

export function createExtensionTracker({ store, fetchImpl = fetch, log = console }) {
  async function list() {
    return (await store.get()).extensions || [];
  }

  async function snapshot(id) {
    const known = (await list()).find((e) => e.id === id);
    const listing = await fetchStoreListing(known?.store || 'chrome', id, fetchImpl);
    await store.update((s) => {
      const ext = (s.extensions ||= []).find((e) => e.id === id);
      if (!ext) return;
      Object.assign(ext, { title: listing.title, icon: listing.icon, version: listing.version, updated: listing.updated, checkedAt: Date.now() });
      const point = { date: today(), users: listing.users, usersPlus: listing.usersPlus, rating: listing.rating, ratings: listing.ratings, version: listing.version };
      ext.history ||= [];
      // One point per day; a later check the same day replaces it.
      if (ext.history.at(-1)?.date === point.date) ext.history[ext.history.length - 1] = point;
      else ext.history.push(point);
    });
    return listing;
  }

  return {
    list,
    async add(input, label = '', storeHint = '') {
      const { store: where, ref } = parseExtensionInput(input, storeHint);
      const listing = await fetchStoreListing(where, ref, fetchImpl);
      const id = where === 'firefox' ? `firefox-${listing.amoId}` : ref;
      await store.update((s) => {
        s.extensions ||= [];
        if (!s.extensions.some((e) => e.id === id)) {
          s.extensions.push({ id, ...(where === 'chrome' ? {} : { store: where }), label: String(label).slice(0, 80), history: [], imports: {} });
        }
      });
      await snapshot(id);
      return { id, store: where, ...listing };
    },
    async remove(id) {
      await store.update((s) => {
        s.extensions = (s.extensions || []).filter((e) => e.id !== id);
      });
    },
    snapshot,
    async importCsv(id, filename, csv) {
      const { metrics } = parseDashboardCsv(csv);
      let merged = 0;
      await store.update((s) => {
        const ext = (s.extensions || []).find((e) => e.id === id);
        if (!ext) throw new SourceError('Unknown extension.', { kind: 'notfound' });
        ext.imports ||= {};
        for (const [name, points] of Object.entries(metrics)) {
          // Re-importing an overlapping export updates days instead of duplicating them.
          ext.imports[name] = { ...(ext.imports[name] || {}), ...points };
          merged += Object.keys(points).length;
        }
        ext.lastImport = { filename: String(filename || 'export.csv').slice(0, 120), at: Date.now() };
      });
      return { metrics: Object.keys(metrics), points: merged };
    },
    // Daily snapshot loop: checks at start, then every 6 hours; skips extensions checked in the last 5h.
    start() {
      const run = async () => {
        for (const ext of await list()) {
          if (ext.checkedAt && Date.now() - ext.checkedAt < 5 * 3_600_000) continue;
          try {
            await snapshot(ext.id);
          } catch (err) {
            log.warn?.(`  Store snapshot failed for ${ext.id}: ${err.message}`);
          }
        }
      };
      run();
      const timer = setInterval(run, 6 * 3_600_000);
      timer.unref();
      return () => clearInterval(timer);
    },
  };
}

// View model for a range: history points and imported metrics inside it.
export function extensionView(ext, range) {
  const inRange = (d) => d >= range.start && d <= range.end;
  const history = (ext.history || []).filter((p) => inRange(p.date));
  const before = [...(ext.history || [])].reverse().find((p) => p.date < range.start);
  const latest = ext.history?.at(-1) || null;
  const baseline = before || history[0] || null;
  const where = STORES[ext.store] ? ext.store : 'chrome';
  return {
    id: ext.id,
    store: where,
    storeLabel: STORES[where].label,
    label: ext.label || ext.title || ext.id,
    title: ext.title || '',
    icon: ext.icon || '',
    version: ext.version || '',
    updated: ext.updated || '',
    checkedAt: ext.checkedAt || 0,
    url: STORES[where].url(ext.id),
    latest,
    usersChange: latest && baseline && latest.users !== null && baseline.users !== null && baseline !== latest ? latest.users - baseline.users : null,
    trackedSince: ext.history?.[0]?.date || '',
    history,
    imports: Object.fromEntries(
      Object.entries(ext.imports || {}).map(([name, points]) => [
        name,
        range.dates.map((d) => (d in points ? points[d] : null)),
      ]),
    ),
    lastImport: ext.lastImport || null,
  };
}
