// Small marks beside names in lists: a traffic source, a country, a browser or
// an operating system. Everything is drawn here (letters on the brand's
// colour, flags from emoji): nothing is fetched, so no third party learns
// which sites send you visits, and the desktop app works offline.

// [pattern, key, letter]: the key picks the tile's colour (styles.css .mark-*).
const SOURCES = [
  [/^\(?direct\)?$|^no referrer$/, 'direct', '→'],
  [/^\(?not set\)?$|^unknown$|^\(?none\)?$/, 'unknown', '?'],
  [/^your own site$/, 'self', '⌂'],
  [/^google|google\./, 'google', 'G'],
  [/^bing|bing\./, 'bing', 'b'],
  [/duckduckgo/, 'duckduckgo', 'D'],
  [/ecosia/, 'ecosia', 'E'],
  [/yandex/, 'yandex', 'Я'],
  [/baidu/, 'baidu', '百'],
  [/reddit/, 'reddit', 'r'],
  [/hacker news|ycombinator/, 'hn', 'Y'],
  [/product ?hunt/, 'ph', 'P'],
  [/chatgpt|openai/, 'chatgpt', '◎'],
  [/perplexity/, 'perplexity', '✳'],
  [/gemini/, 'gemini', '✦'],
  [/^claude|claude\.ai/, 'claude', '✺'],
  [/copilot/, 'copilot', 'C'],
  [/github/, 'github', 'G'],
  [/^x$|^t\.co$|twitter|x\.com/, 'x', '𝕏'],
  [/linkedin|lnkd/, 'linkedin', 'in'],
  [/youtube/, 'youtube', '▶'],
  [/facebook|^fb$/, 'facebook', 'f'],
  [/instagram/, 'instagram', '◉'],
  [/chrome ?web ?store|chromewebstore/, 'cws', '◆'],
  [/newsletter|email|mail/, 'email', '✉'],
  [/dev\.to|^devto$/, 'devto', 'D'],
  [/medium/, 'medium', 'M'],
  [/bluesky|bsky/, 'bluesky', '☁'],
];

const BROWSERS = [
  [/^chrome/, 'chrome', 'C'], [/safari/, 'safari', 'S'], [/firefox/, 'firefox', 'F'], [/edge/, 'edge', 'e'],
  [/opera/, 'opera', 'O'], [/samsung/, 'samsung', 'S'], [/brave/, 'brave', 'B'],
  [/^windows/, 'windows', '⊞'], [/^mac$|^macintosh$|^mac ?os|^macos/, 'apple', '⌘'], [/^ios$|iphone|ipad/, 'apple', 'i'],
  [/android/, 'android', 'A'], [/linux/, 'linux', 'L'], [/chrome ?os|chromebook/, 'chrome', 'C'],
  [/phones? and tablets?|^phones?$/, 'device', '▯'],
  [/^desktop$/, 'device', '▭'], [/^mobile$/, 'device', '▯'], [/^tablet$/, 'device', '▢'],
];

function pick(list, name) {
  const s = String(name || '').trim().toLowerCase();
  for (const [re, key, letter] of list) if (re.test(s)) return { key, letter };
  return null;
}

function Tile({ k, letter }) {
  return <span class={`mark mark-${k}`} aria-hidden="true">{letter}</span>;
}

// Any other site gets its first letter on grey, so the column stays even.
export function SourceMark({ name }) {
  const hit = pick(SOURCES, name);
  if (hit) return <Tile k={hit.key} letter={hit.letter} />;
  const first = String(name || '').replace(/^(https?:\/\/)?(www\.)?/, '').charAt(0).toUpperCase();
  return <Tile k="other" letter={first || '?'} />;
}

export function BrowserMark({ name }) {
  const hit = pick(BROWSERS, name);
  return hit ? <Tile k={hit.key} letter={hit.letter} /> : <Tile k="other" letter={String(name || '?').charAt(0).toUpperCase()} />;
}

// GA4 names countries in English; the flag comes from the ISO code.
const ALIASES = {
  'united states': 'US', 'united kingdom': 'GB', 'south korea': 'KR', 'north korea': 'KP', russia: 'RU', vietnam: 'VN',
  'hong kong': 'HK', macao: 'MO', macau: 'MO', taiwan: 'TW', czechia: 'CZ', 'czech republic': 'CZ', türkiye: 'TR', turkey: 'TR',
  'myanmar (burma)': 'MM', myanmar: 'MM', "côte d’ivoire": 'CI', "cote d'ivoire": 'CI', 'ivory coast': 'CI', laos: 'LA', iran: 'IR',
  syria: 'SY', moldova: 'MD', bolivia: 'BO', venezuela: 'VE', tanzania: 'TZ', palestine: 'PS', 'bosnia & herzegovina': 'BA',
  'bosnia and herzegovina': 'BA', 'trinidad & tobago': 'TT', 'congo - kinshasa': 'CD', 'congo - brazzaville': 'CG', 'north macedonia': 'MK',
  eswatini: 'SZ', 'cape verde': 'CV', 'st. lucia': 'LC', 'st. kitts & nevis': 'KN', 'brunei': 'BN', 'kosovo': 'XK',
};
let byName = null;
function countryCode(name) {
  const s = String(name || '').trim().toLowerCase();
  if (!s || s === '(not set)') return '';
  if (ALIASES[s]) return ALIASES[s];
  if (!byName) {
    byName = new Map();
    try {
      const names = new Intl.DisplayNames(['en'], { type: 'region' });
      for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
          const code = String.fromCharCode(a, b);
          const n = names.of(code);
          if (n && n !== code) byName.set(n.toLowerCase(), code);
        }
      }
    } catch { /* no Intl region names: no flags */ }
  }
  return byName.get(s) || '';
}

export function flagOf(name) {
  const code = countryCode(name);
  return code ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
}

export function CountryMark({ name }) {
  const flag = flagOf(name);
  return flag ? <span class="mark mark-flag" aria-hidden="true">{flag}</span> : <Tile k="other" letter="·" />;
}

// The mark and the name together, for a list cell.
export function Marked({ kind, name, children }) {
  const Mark = kind === 'country' ? CountryMark : kind === 'browser' ? BrowserMark : SourceMark;
  return <span class="marked"><Mark name={name} /><span class="marked-name">{children ?? name}</span></span>;
}
