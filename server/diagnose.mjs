// Diagnose (docs/redesign/prototype.html → Diagnose): run a check on one page.
// Every run is stored, and each one becomes an event on that page's timeline
// (server/page-events.mjs → checkEvents), so a check is never a dead end: it
// lands where the page's story is told, next to its changes and to-dos.
//
// The tools reuse what Kauzl already has:
//   content  the article editor's checks (title, description, length, headings vs the searches it gets)
//   speed    PageSpeed on phones (vitals.psiUrl)
//   index    Google's URL Inspection and Bing's URL info (search-hub.indexStatus)
//   bots     the page fetched as Googlebot and as GPTBot: status, noindex, how many words they get
//
// Each tool's raw answer is turned into one run, the shape page-events reads as a check:
//   { id, path, tool, date, at, by: 'you' | 'nightly', key, headline, tone, cells, findings, detail }
// `key` is the run's main reading; a later run with the same key is shown as "no change".
// Runs are kept in studio.json `diagnoseRuns[siteId]`, newest last, at most RUNS_KEPT per site.

import { randomUUID } from 'node:crypto';
import { ValidationError } from './store.mjs';
import { googleState, bingState, INDEX_KINDS } from './site-health.mjs';

const RUNS_KEPT = 400;
const PATH = /^\/[^\s?#]{0,300}$/;
export const TOOLS = [
  { key: 'content', name: 'Content check', desc: 'The title, description, length and headings, against the searches it gets.' },
  { key: 'speed', name: 'Speed test', desc: 'How fast it loads on a phone (PageSpeed).' },
  { key: 'index', name: 'Index status', desc: 'Whether Google and Bing can show it, and if not, why.' },
  { key: 'bots', name: 'As Googlebot and GPTBot', desc: 'What search and AI crawlers get when they fetch it.' },
];
const TOOL_KEYS = new Set(TOOLS.map((t) => t.key));
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const SEV = { bad: 'high', warn: 'mid', ok: 'ok' };

/* --- each tool's answer → one run (pure, tested) --- */

export function contentRun(checks = []) {
  const problems = checks.filter((c) => c.level === 'bad' || c.level === 'warn');
  const bad = problems.some((c) => c.level === 'bad');
  const words = checks.find((c) => /^\d[\d,]* words/.test(c.text));
  const p0 = problems[0];
  const first = p0 ? (p0.query ? `“${p0.query}” isn’t in the title or headings` : p0.text.replace(/[;:].*$/, '').replace(/\.$/, '')) : '';
  return {
    key: problems.length ? plural(problems.length, 'problem') : 'no problems',
    headline: problems.length ? `${plural(problems.length, 'problem')}${first ? ` · ${p0.query ? first : `${first[0].toLowerCase()}${first.slice(1)}`}` : ''}` : 'nothing to fix',
    tone: bad ? 'down' : problems.length ? 'warn' : 'up',
    cells: [
      { label: 'Problems', value: String(problems.length), note: bad ? 'one is serious' : '', tone: bad ? 'down' : problems.length ? 'warn' : 'up' },
      ...(words ? [{ label: 'Words', value: words.text.match(/^[\d,]+/)[0], note: words.level === 'warn' ? 'thin' : '', tone: words.level === 'warn' ? 'warn' : '' }] : []),
    ],
    findings: problems.slice(0, 4).map((c) => ({ sev: SEV[c.level] || '', text: c.text, note: c.query ? 'from Search Console' : '' })),
  };
}

export function speedRun(phone) {
  if (!phone || phone.error || phone.lcp == null) return { key: null, headline: 'couldn’t run', tone: 'muted', cells: [], findings: [{ sev: 'mid', text: phone?.error || 'PageSpeed gave no answer.', note: '' }], failed: true };
  const s = (phone.lcp / 1000).toFixed(1);
  const tone = phone.lcp <= 2500 ? 'up' : phone.lcp <= 4000 ? 'warn' : 'down';
  return {
    key: `${s} s`,
    headline: `${s} s on phones`,
    tone,
    cells: [
      { label: 'Main content shows', value: `${s} s`, note: 'fast is under 2.5 s', tone },
      ...(phone.score != null ? [{ label: 'PageSpeed score', value: String(Math.round(phone.score)), note: 'out of 100', tone: '' }] : []),
      ...(phone.cls != null ? [{ label: 'Layout shift', value: phone.cls.toFixed(2), note: 'good is under 0.1', tone: phone.cls <= 0.1 ? 'up' : 'warn' }] : []),
    ],
    findings: [
      ...(phone.lcp > 2500 ? [{ sev: phone.lcp > 4000 ? 'high' : 'mid', text: 'The main content shows late on phones: Google counts this against the page.', note: 'large images and scripts above the text are the usual cause' }] : []),
      ...(phone.tbt != null && phone.tbt > 300 ? [{ sev: 'mid', text: `Scripts block the page for ${Math.round(phone.tbt)} ms while it loads.`, note: '' }] : []),
    ],
  };
}

export function indexRun(status) {
  const g = googleState(status?.google), b = bingState(status?.bing);
  const kind = g.kind || b.kind;
  const both = g.state[0] === 'ok' && b.state[0] === 'ok';
  const tone = both ? 'up' : [g.state[0], b.state[0]].includes('bad') ? 'down' : [g.state[0], b.state[0]].every((s) => s === 'unknown') ? 'muted' : 'warn';
  return {
    key: `${g.state[1]} / ${b.state[1]}`,
    headline: both ? 'shown by Google and Bing' : kind ? INDEX_KINDS[kind].title.replace(/^./, (c) => c.toLowerCase()) : `Google: ${g.state[1].toLowerCase()} · Bing: ${b.state[1].toLowerCase()}`,
    tone,
    cells: [
      { label: 'Google', value: g.state[1], note: g.state[2], tone: g.state[0] === 'ok' ? 'up' : g.state[0] === 'bad' ? 'down' : g.state[0] === 'warn' ? 'warn' : 'muted' },
      { label: 'Bing', value: b.state[1], note: b.state[2], tone: b.state[0] === 'ok' ? 'up' : b.state[0] === 'bad' ? 'down' : b.state[0] === 'warn' ? 'warn' : 'muted' },
    ],
    findings: kind ? [{ sev: tone === 'down' ? 'high' : 'mid', text: INDEX_KINDS[kind].why, note: 'why' }, { sev: '', text: INDEX_KINDS[kind].fix, note: 'the fix' }] : [],
  };
}

// What a crawler gets from the page's HTML: visible words, title, and whether it's told to stay away.
export function readHtml(html = '', headers = {}) {
  const head = String(html);
  const noindex = /<meta[^>]+name=["']?(robots|googlebot)["']?[^>]+content=["'][^"']*noindex/i.test(head) || /noindex/i.test(String(headers['x-robots-tag'] || ''));
  const title = (/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] || '').trim()
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const text = head.replace(/<(script|style|noscript|template|svg|title)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  return { words, title, noindex };
}

export function botsRun({ google, gpt }) {
  const say = (r) => (r.error ? 'Couldn’t fetch' : r.status >= 400 ? `HTTP ${r.status}` : r.noindex ? 'Told to stay away' : plural(r.words, 'word'));
  const low = (r) => !r.error && r.status < 400 && !r.noindex && r.words < 200;
  const bad = (r) => r.error || r.status >= 400 || r.noindex;
  const tone = bad(google) || bad(gpt) ? 'down' : low(google) || low(gpt) ? 'warn' : 'up';
  const findings = [];
  if (low(gpt) && !low(google)) findings.push({ sev: 'mid', text: `GPTBot gets ${plural(gpt.words, 'word')}: AI crawlers don’t run JavaScript, so text drawn in the browser is missing for them.`, note: 'render the text on the server' });
  else if (low(google) || low(gpt)) findings.push({ sev: 'mid', text: 'Crawlers get under 200 words: most of the page is drawn by JavaScript or it is very short.', note: '' });
  for (const [name, r] of [['Googlebot', google], ['GPTBot', gpt]]) {
    if (r.error) findings.push({ sev: 'high', text: `${name}: ${r.error}`, note: '' });
    else if (r.status >= 400) findings.push({ sev: 'high', text: `${name} gets HTTP ${r.status}.`, note: 'a firewall or bot rule may be blocking it' });
    else if (r.noindex) findings.push({ sev: 'mid', text: `${name} is told not to index it (noindex).`, note: 'fine if you meant it' });
  }
  return {
    key: `${say(google)} / ${say(gpt)}`,
    headline: !bad(google) && !bad(gpt) && google.words === gpt.words ? `both crawlers get ${plural(google.words, 'word')}` : bad(google) || bad(gpt) ? `Googlebot: ${say(google).toLowerCase()} · GPTBot: ${say(gpt).toLowerCase()}` : `${plural(google.words, 'word')} for Googlebot, ${plural(gpt.words, 'word')} for GPTBot`,
    tone,
    cells: [{ label: 'Googlebot gets', value: say(google), note: google.title ? `“${google.title.slice(0, 60)}”` : '', tone: bad(google) ? 'down' : low(google) ? 'warn' : '' }, { label: 'GPTBot gets', value: say(gpt), note: '', tone: bad(gpt) ? 'down' : low(gpt) ? 'warn' : '' }],
    findings: findings.slice(0, 4),
  };
}

/* --- running and keeping runs --- */

const UA = {
  google: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  gpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)',
};

export function createDiagnose({ store, editor, vitals, hub, fetchImpl = fetch, now = Date.now, today = () => new Date().toLocaleDateString('en-CA') }) {
  const urlOf = (site, path) => `https://${String(site.host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')}${path}`;

  async function fetchAs(url, ua) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': ua, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      const html = (await res.text()).slice(0, 2_000_000);
      return { status: res.status, ...readHtml(html, { 'x-robots-tag': res.headers.get('x-robots-tag') }) };
    } catch (err) {
      return { status: 0, words: 0, title: '', noindex: false, error: err.name === 'TimeoutError' ? 'Timed out after 20 s.' : err.message };
    }
  }

  const TOOL_RUN = {
    content: async (site, path) => contentRun((await editor.detail(site, path, '28d')).checks),
    speed: async (site, path) => speedRun(await vitals.psiUrl(urlOf(site, path), 'mobile')),
    index: async (site, path) => indexRun(await hub.indexStatus(site, { path })),
    bots: async (site, path) => {
      const url = urlOf(site, path);
      const [google, gpt] = await Promise.all([fetchAs(url, UA.google), fetchAs(url, UA.gpt)]);
      return botsRun({ google, gpt });
    },
  };

  async function run(site, { path = '', tool = '', by = 'you' } = {}) {
    if (!PATH.test(path)) throw new ValidationError('Pick a page: a path like /pricing.');
    if (!TOOL_KEYS.has(tool)) throw new ValidationError(`Unknown check. Pick one of: ${[...TOOL_KEYS].join(', ')}.`);
    if (site.demo) throw new ValidationError('The sample site can’t be checked. Open one of your own sites.');
    let result;
    try {
      result = await TOOL_RUN[tool](site, path);
    } catch (err) {
      result = { key: null, headline: 'couldn’t run', tone: 'muted', cells: [], findings: [{ sev: 'mid', text: err.message, note: err.hint || '' }], failed: true };
    }
    const entry = { id: `run-${randomUUID().slice(0, 8)}`, path, tool, date: today(), at: now(), by: by === 'nightly' ? 'nightly' : 'you', ...result };
    if (!entry.failed) {
      await store.update((s) => {
        s.diagnoseRuns ||= {};
        s.diagnoseRuns[site.id] = [...(s.diagnoseRuns[site.id] || []), entry].slice(-RUNS_KEPT);
      });
    }
    return entry;
  }

  async function runs(site, { path = '', since = '' } = {}) {
    const all = ((await store.get()).diagnoseRuns || {})[site.id] || [];
    return all.filter((r) => (!path || r.path === path) && (!since || r.date >= since));
  }

  // The Diagnose place: the tools, each with this page's last run, and the page's recent runs.
  async function overview(site, { path = '' } = {}) {
    const list = await runs(site, { path });
    return {
      path,
      tools: TOOLS.map((t) => ({ ...t, last: [...list].reverse().find((r) => r.tool === t.key) || null })),
      runs: [...list].reverse().slice(0, 20),
    };
  }

  return { run, runs, overview };
}

export function diagnoseRoutes({ diagnose, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/diagnose$/, async ({ match, query }) => diagnose.overview(await siteOr404(match[1]), { path: query.get('path') || '' })],
    ['POST', /^\/api\/sites\/([\w-]+)\/diagnose\/run$/, async ({ match, body }) => diagnose.run(await siteOr404(match[1]), { path: body?.path, tool: body?.tool, by: 'you' })],
  ];
}
