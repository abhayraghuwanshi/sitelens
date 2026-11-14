// UTM link building and cleaning. Shared by the UTM builder page and tests.

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];

// Click IDs and tracking junk that ad platforms and email tools append.
export const TRACKING_KEYS = [
  ...UTM_KEYS, 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id',
  'igshid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'mkt_tok', 'yclid', 'srsltid', 'ref_src',
];

// Turn "Spring Sale 2026!" into "spring-sale-2026" (or keep case/spaces).
export function tidy(value, { lowercase = true, separator = '-' } = {}) {
  let v = String(value ?? '').trim();
  if (lowercase) v = v.toLowerCase();
  if (separator) v = v.replace(/\s+/g, separator);
  return v;
}

function parse(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
}

// Add UTM tags to a URL. Keeps its other query parameters and #fragment and
// replaces any utm_* already there instead of adding a second copy.
export function buildUtm(url, params, opts = {}) {
  const u = parse(url);
  if (!u) return { error: 'Enter a full page address, like https://example.com/pricing.' };
  for (const k of UTM_KEYS) u.searchParams.delete(k);
  for (const k of UTM_KEYS) {
    const short = k.slice(4);
    const v = tidy(params[short] ?? params[k], opts);
    if (v) u.searchParams.set(k, v);
  }
  const warnings = [];
  if (!params.source && !params.utm_source) warnings.push('utm_source is required: where the click comes from (newsletter, reddit, google).');
  if (!params.medium && !params.utm_medium) warnings.push('utm_medium is required: the kind of channel (email, social, cpc).');
  if (!params.campaign && !params.utm_campaign) warnings.push('utm_campaign tells your campaigns apart in reports.');
  const medium = tidy(params.medium ?? params.utm_medium, opts);
  if (medium && !GA4_MEDIUMS.has(medium)) warnings.push(`GA4 won't put medium "${medium}" in a default channel. Try one of: ${[...GA4_MEDIUMS].slice(0, 8).join(', ')}.`);
  return { url: u.toString(), warnings };
}

// Mediums GA4's default channel grouping recognises (Paid/Organic Social,
// Email, Referral, Affiliates, Display, Paid Search, Video...).
export const GA4_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsearch', 'email', 'e-mail', 'social', 'social-network', 'social-media', 'sm', 'paid-social', 'organic', 'referral', 'affiliate', 'display', 'banner', 'cpm', 'video', 'push', 'sms', 'audio', 'retargeting']);

// Read a URL's UTM tags back out, and give a copy with all tracking removed.
export function inspectUrl(url) {
  const u = parse(url);
  if (!u) return { error: 'That doesn’t look like a URL.' };
  const utm = {}, removed = [];
  for (const [k, v] of [...u.searchParams]) {
    if (UTM_KEYS.includes(k)) utm[k] = v;
    if (TRACKING_KEYS.includes(k.toLowerCase())) removed.push(k);
  }
  const clean = new URL(u);
  for (const k of removed) clean.searchParams.delete(k);
  return { utm, removed, clean: clean.toString() };
}
