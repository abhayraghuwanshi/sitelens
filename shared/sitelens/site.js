// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.
// URL / domain helpers. Kept intentionally small and dependency-free.

const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.kr', 'or.kr', 'ne.kr',
  'com.br', 'net.br', 'org.br',
  'com.mx', 'com.ar', 'com.co', 'com.pe', 'com.cl',
  'com.sg', 'com.hk', 'com.tw', 'com.cn', 'com.tr', 'com.my',
  'co.za', 'org.za', 'co.il', 'co.id', 'co.th', 'co.ve',
  'com.pl', 'com.ua', 'com.ru', 'co.at', 'or.at',
]);

const SKIP_SCHEMES = /^(chrome|chrome-extension|edge|about|devtools|view-source|moz-extension|safari-extension):/i;

export function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isAnalyzableUrl(url) {
  if (!url || typeof url !== 'string' || SKIP_SCHEMES.test(url)) return false;
  const parsed = parseUrl(url);
  if (!parsed) return false;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  // Local dev hosts are valid, but chrome web store pages are not analyzable.
  if (parsed.hostname === 'chromewebstore.google.com') return false;
  return true;
}

export function hostFromUrl(url) {
  const parsed = parseUrl(url);
  return parsed ? parsed.hostname.toLowerCase() : '';
}

export function baseDomain(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

// Map lookup keys, most specific first: full host, then registrable domain.
export function hostKeys(hostname) {
  const host = String(hostname || '').toLowerCase();
  const keys = [];
  if (host) keys.push(host);
  const base = baseDomain(host);
  if (base && base !== host) keys.push(base);
  // Treat www.example.com and example.com as the same site.
  if (host.startsWith('www.')) {
    const bare = host.slice(4);
    if (!keys.includes(bare)) keys.push(bare);
  }
  return [...new Set(keys)];
}

export function displayHost(hostname) {
  return String(hostname || '').replace(/^www\./i, '');
}

export function currentPath(url) {
  const parsed = parseUrl(url);
  if (!parsed) return '/';
  return parsed.pathname || '/';
}

export function currentPathWithSearch(url) {
  const parsed = parseUrl(url);
  if (!parsed) return '/';
  return `${parsed.pathname || '/'}${parsed.search || ''}`;
}

export function stripTrailingSlash(path) {
  const p = String(path || '/');
  const stripped = p.replace(/\/+$/, '');
  return stripped || '/';
}

// GA4 pagePath usually has no query string, and "/" is stored as "/".
export function normalizePagePath(path) {
  let p = String(path || '/').split('#')[0];
  p = p.split('?')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  return stripTrailingSlash(p) || '/';
}

export function prettyPath(path, max = 38) {
  const p = String(path || '/');
  const clean = p === '/' ? '/' : p.replace(/\/$/, '');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function faviconUrl(siteUrl, size = 32) {
  try {
    return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(siteUrl)}&size=${size}`;
  } catch {
    return '';
  }
}

export function countryName(code) {
  const c = String(code || '').trim();
  if (!c) return 'Unknown';
  if (c === '(not set)') return 'Unknown';
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(c.toUpperCase()) || c;
  } catch {
    return c;
  }
}

export function flagForCountry(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '🌐';
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}
