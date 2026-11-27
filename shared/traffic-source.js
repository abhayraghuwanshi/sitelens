// Where a visit came from, cleaned up. Tags are typed by hand, so the same
// place shows up as `Facebook`, `fb`, `facebook.com` and `m.facebook.com`, and
// the same campaign as `Launch_Post` and `launch-post`. These helpers turn
// them into one name each.
//
// Pure and dependency-free so it runs in the browser too: the Campaigns page
// uses it on GA4 rows today, and Kauzl's own tracker will use attribute() on
// the landing URL + referrer.

// Canonical source ids. They match the utm_source values taggedLink() writes
// (shared/utm.js), so links Kauzl builds and links typed by hand line up.
const SOURCES = [
  ['reddit', /^(reddit|rd)$|(^|\.)reddit\.com$|^redd\.it$|com\.reddit\.frontpage/],
  ['hackernews', /^(hn|hackernews|hacker-news|ycombinator)$|news\.ycombinator\.com$/],
  ['producthunt', /^(ph|producthunt|product-hunt)$|(^|\.)producthunt\.com$/],
  ['x', /^(x|twitter|tw)$|^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$|com\.twitter\.android/],
  ['linkedin', /^(linkedin|li)$|(^|\.)linkedin\.com$|^lnkd\.in$|com\.linkedin\.android/],
  ['facebook', /^(facebook|fb|meta)$|(^|\.)facebook\.com$|^fb\.me$|com\.facebook\.(katana|orca)/],
  ['instagram', /^(instagram|ig|insta)$|(^|\.)instagram\.com$|com\.instagram\.android/],
  ['threads', /^threads$|(^|\.)threads\.(net|com)$/],
  ['bluesky', /^(bluesky|bsky)$|(^|\.)bsky\.(app|social)$/],
  ['mastodon', /^mastodon$|mastodon\.|^mstdn\.|fosstodon\.org$|hachyderm\.io$|infosec\.exchange$/],
  ['lobsters', /^(lobsters|lobste\.rs)$|(^|\.)lobste\.rs$/],
  ['devto', /^(devto|dev\.to|dev-to)$/],
  ['medium', /^medium$|(^|\.)medium\.com$/],
  ['youtube', /^(youtube|yt)$|(^|\.)youtube\.com$|^youtu\.be$|com\.google\.android\.youtube/],
  ['tiktok', /^tiktok$|(^|\.)tiktok\.com$/],
  ['pinterest', /^pinterest$|(^|\.)pinterest\.[a-z.]+$|^pin\.it$/],
  ['discord', /^discord$|(^|\.)discord(app)?\.com$|^discord\.gg$/],
  ['slack', /^slack$|(^|\.)slack\.com$/],
  ['telegram', /^telegram$|^t\.me$|(^|\.)telegram\.org$|org\.telegram/],
  ['whatsapp', /^whatsapp$|(^|\.)whatsapp\.com$|^wa\.me$|com\.whatsapp/],
  ['github', /^github$|(^|\.)github\.com$/],
  ['stackoverflow', /^stackoverflow$|(^|\.)stackoverflow\.com$/],
  ['gmail', /^gmail$|^mail\.google\.com$|com\.google\.android\.gm/],
  ['chatgpt', /^(chatgpt|openai)$|(^|\.)chatgpt\.com$|^chat\.openai\.com$/],
  ['perplexity', /^perplexity$|(^|\.)perplexity\.ai$/],
  ['claude', /^claude$|^claude\.ai$/],
  ['gemini', /^gemini$|^gemini\.google\.com$/],
  ['copilot', /^copilot$|^copilot\.microsoft\.com$/],
  ['google', /^google$|^(www\.|m\.)?google\.[a-z.]+$|com\.google\.android\.googlequicksearchbox/],
  ['bing', /^bing$|(^|\.)bing\.com$/],
  ['duckduckgo', /^(duckduckgo|ddg)$|(^|\.)duckduckgo\.com$/],
  ['yahoo', /^yahoo$|(^|\.)search\.yahoo\.com$/],
  ['ecosia', /^ecosia$|(^|\.)ecosia\.org$/],
  ['brave', /^brave$|^search\.brave\.com$/],
  ['yandex', /^yandex$|(^|\.)yandex\.[a-z.]+$/],
  ['baidu', /^baidu$|(^|\.)baidu\.com$/],
  ['chromewebstore', /^chromewebstore$|^chromewebstore\.google\.com$|^chrome\.google\.com$/],
];

const SEARCH = new Set(['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'brave', 'yandex', 'baidu']);
const SOCIAL = new Set(['reddit', 'hackernews', 'producthunt', 'x', 'linkedin', 'facebook', 'instagram', 'threads', 'bluesky',
  'mastodon', 'lobsters', 'devto', 'medium', 'youtube', 'tiktok', 'pinterest', 'discord', 'slack', 'telegram', 'whatsapp']);
const EMAIL = new Set(['gmail', 'newsletter', 'email', 'mailchimp', 'substack', 'convertkit', 'beehiiv', 'buttondown']);

// Hand-typed mediums → the few that mean something.
const MEDIUMS = [
  ['cpc', /^(cpc|ppc|paid|paid-?search|sem|search-?ads?|adwords|google-?ads)$/],
  ['paid-social', /^(paid-?social|social-?paid|paidsocial|social-?ads?|sponsored)$/],
  ['display', /^(display|banner|cpm|programmatic)$/],
  ['social', /^(social|social-?media|sm|social-?network|sn|post|organic-?social)$/],
  ['email', /^(e-?mail|newsletter|mail|edm)$/],
  ['affiliate', /^(affiliates?|partners?)$/],
  ['referral', /^(referral|referrer|link|backlink)$/],
  ['organic', /^(organic|seo|search)$/],
  ['video', /^(video|youtube)$/],
];

// Ad click ids added to landing URLs. fbclid is left out on purpose: Facebook
// adds it to ordinary (unpaid) link clicks too.
const CLICK_IDS = [
  ['gclid', 'google', 'cpc'], ['gbraid', 'google', 'cpc'], ['wbraid', 'google', 'cpc'], ['dclid', 'google', 'display'],
  ['msclkid', 'bing', 'cpc'], ['ttclid', 'tiktok', 'paid-social'], ['li_fat_id', 'linkedin', 'paid-social'],
  ['twclid', 'x', 'paid-social'], ['rdt_cid', 'reddit', 'paid-social'], ['epik', 'pinterest', 'paid-social'],
];

const TRACKING_PARAM = /^(utm_[a-z_]+|gclid|gbraid|wbraid|dclid|msclkid|fbclid|ttclid|li_fat_id|twclid|rdt_cid|epik|mc_cid|mc_eid|_hsenc|_hsmi|ref_src)$/i;

const isPlaceholder = (v) => /^\(.*\)$/.test(String(v || '').trim());
const words = (v) => String(v || '').trim().toLowerCase().replace(/\+/g, ' ').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

// A host from a URL, an app referrer (android-app://com.reddit.frontpage/) or
// a bare domain, without www.
function hostOf(value) {
  const v = String(value || '').trim().toLowerCase();
  const app = v.match(/^android-app:\/\/([^/]+)/);
  if (app) return app[1];
  const m = v.match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#:]+)/) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/.test(v) ? [null, v.split('/')[0]] : null);
  return m ? m[1].replace(/^www\./, '') : '';
}

// `Facebook`, `fb`, `https://m.facebook.com/…` → `facebook`. Unknown sites
// keep their domain (`blog.example.com` → `blog.example.com`); unknown names
// are tidied (`Spring Newsletter` → `spring-newsletter`). GA4 placeholders
// like `(direct)` pass through.
export function cleanSource(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (isPlaceholder(v)) return v.toLowerCase();
  const host = hostOf(v);
  const key = host || words(v).replace(/^www\./, '');
  for (const [id, re] of SOURCES) if (re.test(key)) return id;
  return host || words(v);
}

// `Social Media`, `PPC`, `e-mail` → `social`, `cpc`, `email`. Others are tidied.
export function cleanMedium(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (isPlaceholder(v)) return v.toLowerCase();
  const w = words(v);
  for (const [id, re] of MEDIUMS) if (re.test(w)) return id;
  return w;
}

// A campaign's grouping key: `Launch_Post`, `launch post` and `launch-post`
// are one campaign. Show the name as first seen; group by this.
export const campaignKey = (raw) => (isPlaceholder(raw) ? String(raw).trim().toLowerCase() : words(raw));

// What a missing or `(none)` medium most likely was, from the source.
export function guessMedium(source) {
  if (SEARCH.has(source)) return 'organic';
  if (SOCIAL.has(source)) return 'social';
  if (EMAIL.has(source)) return 'email';
  return 'referral';
}

// A source / medium pair cleaned together. A tagged link with no medium gets
// one guessed from its source, so `utm_source=reddit` alone lands with the
// rest of reddit / social.
export function cleanPair(source, medium) {
  const s = cleanSource(source) || '(not set)';
  let m = cleanMedium(medium);
  if (!m || m === '(not set)') m = isPlaceholder(s) ? '(not set)' : guessMedium(s);
  return { source: s, medium: m };
}

function params(url) {
  try {
    const u = new URL(url, 'https://x.invalid');
    const out = new Map();
    // Keys case-insensitive (UTM_Source happens); the first value wins.
    for (const [k, v] of u.searchParams) if (!out.has(k.toLowerCase())) out.set(k.toLowerCase(), v);
    return out;
  } catch {
    return new Map();
  }
}

// Where one visit came from: { source, medium, campaign, content, term, via }.
// `via` says what decided it: 'utm', 'click-id', 'referrer' or 'direct'.
// Returns null for an internal referrer (a page of the same site), which
// means "still the same visit": keep the visit's first answer.
//   url      the landing page URL, query string included
//   referrer document.referrer
//   host     the site's own host, to spot internal referrers
export function attribute({ url = '', referrer = '', host = '' } = {}) {
  const p = params(url);
  const empty = { campaign: '', content: '', term: '' };
  // ?ref=producthunt is a common hand-made tag; treat it like utm_source.
  const utmSource = p.get('utm_source') || p.get('ref') || '';
  const refHost = hostOf(referrer);
  const own = String(host || '').toLowerCase().replace(/^www\./, '');
  const internal = Boolean(own && refHost && (refHost === own || refHost.endsWith(`.${own}`)));

  if (utmSource || p.get('utm_campaign') || p.get('utm_medium')) {
    // A tagged link with only a campaign or medium: take the source from the referrer.
    const pair = cleanPair(utmSource || (internal ? '' : refHost) || '(not set)', p.get('utm_medium'));
    return {
      ...pair,
      campaign: p.get('utm_campaign') ? words(p.get('utm_campaign')) : '',
      content: p.get('utm_content') ? words(p.get('utm_content')) : '',
      term: String(p.get('utm_term') || '').trim().toLowerCase(),
      via: 'utm',
    };
  }
  for (const [id, source, medium] of CLICK_IDS) {
    if (p.get(id)) return { source, medium, ...empty, via: 'click-id' };
  }
  if (internal) return null;
  if (refHost) {
    const source = cleanSource(refHost);
    return { source, medium: guessMedium(source), ...empty, via: 'referrer' };
  }
  return { source: '(direct)', medium: '(none)', ...empty, via: 'direct' };
}

// The URL without utm_* and ad click ids, for history.replaceState once the
// visit's source is recorded: shared links stay clean and don't re-credit the
// campaign. Other params and the #hash are kept.
export function stripTracking(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}
