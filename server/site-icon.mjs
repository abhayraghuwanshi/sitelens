// A site's own icon, for lists of sites: read the homepage's <link rel="icon">,
// fall back to /favicon.ico, and keep the answer for a day. Fetched by the
// server (on the public internet only, through net-guard) so the browser
// loads it from our origin, under our CSP.

import { guardedAgent } from './net-guard.mjs';

const DAY = 86_400_000;
const MAX_HTML = 512 * 1024;
const MAX_ICON = 200 * 1024;
const TIMEOUT = 6000;
const IMAGE = /^image\/(png|x-icon|vnd\.microsoft\.icon|svg\+xml|jpeg|gif|webp|avif)$/;

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((v) => v !== undefined) ?? '';

// The best icon a page declares: an SVG (sharp at any size), else the largest
// raster up to 192px, else any icon. Apple touch icons only when nothing else.
export function pickIcon(html) {
  const links = [...String(html).matchAll(/<link\b[^>]*>/gi)].map(([tag]) => ({
    rel: attr(tag, 'rel').toLowerCase().split(/\s+/),
    href: attr(tag, 'href').trim(),
    type: attr(tag, 'type').toLowerCase(),
    size: Math.max(0, ...attr(tag, 'sizes').split(/\s+/).map((s) => Number(s.split('x')[0]) || 0)),
  })).filter((l) => l.href && !l.href.startsWith('data:'));
  const icons = links.filter((l) => l.rel.includes('icon'));
  const svg = icons.find((l) => l.type === 'image/svg+xml' || /\.svg(\?|$)/i.test(l.href));
  if (svg) return svg.href;
  const sized = icons.filter((l) => l.size && l.size <= 192).sort((a, b) => b.size - a.size)[0];
  if (sized) return sized.href;
  if (icons[0]) return icons[0].href;
  return links.find((l) => l.rel.includes('apple-touch-icon'))?.href || '';
}

async function readCapped(res, max) {
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body || []) {
    size += chunk.length;
    if (size > max) {
      await res.body?.cancel?.().catch(() => {});
      throw new Error('too large');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createSiteIcons({ fetchImpl = fetch, now = Date.now, guard = true } = {}) {
  const cache = new Map(); // host → { at, icon: { type, body } | null }
  const pending = new Map();
  let dispatcher;

  async function get(url) {
    dispatcher ||= guard ? guardedAgent() : undefined;
    return fetchImpl(url, { redirect: 'follow', ...(dispatcher ? { dispatcher } : {}), headers: { 'User-Agent': 'Kauzl site icon' }, signal: AbortSignal.timeout(TIMEOUT) });
  }

  async function iconAt(url) {
    const res = await get(url).catch(() => null);
    if (!res?.ok) return null;
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!IMAGE.test(type)) {
      await res.body?.cancel?.().catch(() => {});
      return null;
    }
    const body = await readCapped(res, MAX_ICON).catch(() => null);
    return body?.length ? { type, body } : null;
  }

  async function find(host) {
    const home = `https://${host}/`;
    const page = await get(home).catch(() => null);
    let declared = '';
    if (page?.ok && /text\/html/i.test(page.headers.get('content-type') || '')) {
      declared = pickIcon((await readCapped(page, MAX_HTML).catch(() => Buffer.alloc(0))).toString('utf8'));
    } else await page?.body?.cancel?.().catch(() => {});
    const base = page?.url || home;
    for (const candidate of [declared, '/favicon.ico'].filter(Boolean)) {
      let url;
      try { url = new URL(candidate, base); } catch { continue; }
      if (url.protocol !== 'https:') continue;
      const icon = await iconAt(url.href);
      if (icon) return icon;
    }
    return null;
  }

  // The icon for a site host, or null when it has none we can show.
  async function icon(host) {
    const key = String(host || '').toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(key)) return null;
    const hit = cache.get(key);
    if (hit && now() - hit.at < DAY) return hit.icon;
    if (!pending.has(key)) {
      pending.set(key, find(key).catch(() => null).then((found) => {
        cache.set(key, { at: now(), icon: found });
        return found;
      }).finally(() => pending.delete(key)));
    }
    return pending.get(key);
  }

  return { icon };
}
