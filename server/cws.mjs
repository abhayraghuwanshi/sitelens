// Chrome Web Store stats. The store has no analytics API, so Studio builds its
// own history from two sources:
//  - the public listing page (users, rating, version), snapshotted once a day;
//  - CSV exports from the developer dashboard (installs, uninstalls, weekly
//    users…) that the user uploads. Any "date + numeric columns" CSV works.

import { SourceError } from './github.mjs';

const ID_RE = /^[a-p]{32}$/;
const LISTING = (id) => `https://chromewebstore.google.com/detail/${id}?hl=en`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

// Accepts a bare ID or any Web Store URL containing one.
export function parseExtensionId(input) {
  const match = String(input || '').trim().match(/[a-p]{32}/);
  if (!match || !ID_RE.test(match[0])) throw new SourceError('Paste a Chrome Web Store link or the 32-letter extension ID.', { kind: 'validation' });
  return match[0];
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
    const listing = await fetchListing(id, fetchImpl);
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
    async add(input, label = '') {
      const id = parseExtensionId(input);
      const listing = await fetchListing(id, fetchImpl);
      await store.update((s) => {
        s.extensions ||= [];
        if (!s.extensions.some((e) => e.id === id)) s.extensions.push({ id, label: String(label).slice(0, 80), history: [], imports: {} });
      });
      await snapshot(id);
      return { id, ...listing };
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
            log.warn?.(`  Web Store snapshot failed for ${ext.id}: ${err.message}`);
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
  return {
    id: ext.id,
    label: ext.label || ext.title || ext.id,
    title: ext.title || '',
    icon: ext.icon || '',
    version: ext.version || '',
    updated: ext.updated || '',
    checkedAt: ext.checkedAt || 0,
    url: LISTING(ext.id).replace('?hl=en', ''),
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
