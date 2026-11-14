// Known AI and search crawlers, by the user-agent token they match in
// robots.txt and in access logs. kind: 'training' collects data to train
// models, 'search' builds an AI search index (can send you visitors),
// 'user' fetches a page because a person asked an assistant about it.

export const AI_BOTS = [
  { token: 'GPTBot', owner: 'OpenAI', kind: 'training', note: 'Collects pages to train OpenAI models.' },
  { token: 'OAI-SearchBot', owner: 'OpenAI', kind: 'search', note: 'Indexes pages for ChatGPT search results and citations.' },
  { token: 'ChatGPT-User', owner: 'OpenAI', kind: 'user', note: 'Opens a page when a ChatGPT user asks about it.' },
  { token: 'ClaudeBot', owner: 'Anthropic', kind: 'training', note: 'Collects pages to train Claude models.' },
  { token: 'Claude-SearchBot', owner: 'Anthropic', kind: 'search', note: 'Indexes pages for Claude’s search answers.' },
  { token: 'Claude-User', owner: 'Anthropic', kind: 'user', note: 'Opens a page when a Claude user asks about it.' },
  { token: 'PerplexityBot', owner: 'Perplexity', kind: 'search', note: 'Indexes pages for Perplexity answers.' },
  { token: 'Perplexity-User', owner: 'Perplexity', kind: 'user', note: 'Opens a page for a Perplexity user’s question.' },
  { token: 'Google-Extended', owner: 'Google', kind: 'training', robotsOnly: true, note: 'robots.txt switch for Gemini training. Doesn’t affect Google Search.' },
  { token: 'Applebot-Extended', owner: 'Apple', kind: 'training', robotsOnly: true, note: 'robots.txt switch for Apple AI training. Doesn’t affect Siri or Spotlight.' },
  { token: 'meta-externalagent', owner: 'Meta', kind: 'training', note: 'Collects pages to train Meta AI models.' },
  { token: 'CCBot', owner: 'Common Crawl', kind: 'training', note: 'Open web archive that many AI models train on.' },
  { token: 'Bytespider', owner: 'ByteDance', kind: 'training', note: 'Collects pages for ByteDance models.' },
  { token: 'Amazonbot', owner: 'Amazon', kind: 'search', note: 'Used for Alexa answers and Amazon AI.' },
  { token: 'DuckAssistBot', owner: 'DuckDuckGo', kind: 'user', note: 'Fetches pages for DuckDuckGo’s AI answers.' },
  { token: 'MistralAI-User', owner: 'Mistral', kind: 'user', note: 'Opens a page for a Le Chat user.' },
  { token: 'cohere-ai', owner: 'Cohere', kind: 'training', note: 'Cohere’s crawler.' },
];

// Classic search crawlers, so the log analyzer can compare AI to search.
export const SEARCH_BOTS = [
  { token: 'Googlebot', owner: 'Google', kind: 'classic' },
  { token: 'bingbot', owner: 'Microsoft', kind: 'classic' },
  { token: 'Applebot', owner: 'Apple', kind: 'classic' },
  { token: 'DuckDuckBot', owner: 'DuckDuckGo', kind: 'classic' },
  { token: 'YandexBot', owner: 'Yandex', kind: 'classic' },
];

export const KIND_LABEL = { training: 'Model training', search: 'AI search', user: 'Fetch for a user', classic: 'Search engine' };

// Which crawler sent this user-agent? Longer tokens first, so "Applebot"
// doesn't swallow "Applebot-Extended" and "Claude-User" beats "ClaudeBot".
const MATCHERS = [...AI_BOTS.filter((b) => !b.robotsOnly), ...SEARCH_BOTS]
  .sort((a, b) => b.token.length - a.token.length)
  .map((b) => ({ bot: b, needle: b.token.toLowerCase() }));

export function identifyBot(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  return MATCHERS.find((m) => ua.includes(m.needle))?.bot || null;
}

// robots.txt text for a policy: { [token]: 'allow' | 'block' }, plus paths
// to keep every crawler out of, and sitemap URLs.
export function buildRobots({ policy = {}, disallow = [], sitemaps = [] }) {
  const lines = [];
  const blocked = AI_BOTS.filter((b) => policy[b.token] === 'block');
  const allowed = AI_BOTS.filter((b) => policy[b.token] === 'allow');
  const paths = disallow.map((p) => p.trim()).filter(Boolean).map((p) => (p.startsWith('/') ? p : `/${p}`));
  if (blocked.length) {
    lines.push('# AI crawlers kept out');
    for (const b of blocked) lines.push(`User-agent: ${b.token}`);
    lines.push('Disallow: /', '');
  }
  if (allowed.length) {
    lines.push('# AI crawlers let in');
    for (const b of allowed) lines.push(`User-agent: ${b.token}`);
    lines.push(...(paths.length ? paths.map((p) => `Disallow: ${p}`) : ['Allow: /']), '');
  }
  lines.push('# Everyone else', 'User-agent: *');
  lines.push(...(paths.length ? paths.map((p) => `Disallow: ${p}`) : ['Allow: /']));
  const maps = sitemaps.map((s) => s.trim()).filter(Boolean);
  if (maps.length) lines.push('', ...maps.map((s) => `Sitemap: ${s}`));
  return `${lines.join('\n')}\n`;
}

// Parse access-log lines (combined log format, or JSON lines from Vercel,
// Netlify or Cloudflare) into { ua, path, status }.
export function parseLogLine(line) {
  const s = line.trim();
  if (!s) return null;
  if (s.startsWith('{')) {
    try {
      const j = JSON.parse(s);
      const pick = (...keys) => {
        for (const k of keys) {
          const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), j);
          if (v != null && v !== '') return String(v);
        }
        return '';
      };
      return {
        ua: pick('userAgent', 'user_agent', 'ua', 'request.headers.user-agent', 'proxy.userAgent', 'ClientRequestUserAgent', 'http.user_agent', 'headers.user-agent'),
        path: pick('path', 'request.path', 'proxy.path', 'url', 'ClientRequestURI', 'request.url', 'requestPath'),
        status: pick('status', 'statusCode', 'proxy.statusCode', 'EdgeResponseStatus', 'response.status'),
      };
    } catch { /* fall through to text parsing */ }
  }
  const req = s.match(/"(?:GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH) (\S+)[^"]*"\s+(\d{3})?/);
  const quoted = [...s.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return { ua: quoted.length ? quoted[quoted.length - 1] : s, path: req?.[1] || '', status: req?.[2] || '' };
}

export function analyzeLogs(text) {
  const byBot = new Map();
  let lines = 0, matched = 0;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const row = parseLogLine(raw);
    if (!row) continue;
    lines++;
    const bot = identifyBot(row.ua);
    if (!bot) continue;
    matched++;
    let e = byBot.get(bot.token);
    if (!e) byBot.set(bot.token, (e = { bot, hits: 0, paths: new Map(), errors: 0 }));
    e.hits++;
    if (/^[45]/.test(row.status)) e.errors++;
    const p = (row.path || '(unknown)').replace(/^https?:\/\/[^/]+/, '').split('?')[0] || '/';
    e.paths.set(p, (e.paths.get(p) || 0) + 1);
  }
  const bots = [...byBot.values()].sort((a, b) => b.hits - a.hits).map((e) => ({
    ...e, paths: [...e.paths].sort((a, b) => b[1] - a[1]).slice(0, 10),
  }));
  return { lines, matched, bots };
}
