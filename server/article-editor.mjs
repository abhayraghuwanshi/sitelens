// Article editor: one published article with everything needed to make it
// earn more search traffic, and a way to ship the change.
//
//  - detail: the source file from GitHub, the live title/description and where
//    in the repo they're set (front matter, or another file found by code
//    search, e.g. a blogs.ts list), every Search Console query for the page,
//    checks and opportunities computed from those, and before/after numbers
//    for the last update made here
//  - suggest: Claude reads the article and its real queries and returns a new
//    title and description plus exact find/replace edits and new sections;
//    nothing changes until the owner applies them
//  - publish: a branch, one commit per changed file, and a pull request
//    against the default branch; a dated note marks the change on every chart
//  - trials: give a page a set time (28 days) to earn search traffic after
//    tuning it, then a verdict on whether to keep it or take it off the site;
//    stored in studio.json `pageTrials`, compared like-for-like with the days
//    before it started

import Anthropic from '@anthropic-ai/sdk';
import { querySearchAnalytics, searchRange, searchOpportunities } from '../shared/sitelens/gsc.js';
import { githubGet } from './funnel-suggest.mjs';
import { aiKeyError } from './ai-search.mjs';
import { EngineError } from './engines.mjs';
import { normPath } from './articles.mjs';
import { splitFrontMatter, frontMatterValue, firstHeading, headings, lede, sameText, startsLike } from '../shared/article-md.js';

export const EDITOR_MODEL = 'claude-opus-5-5';
const DAY = 86_400_000;
const SEARCH_LAG_DAYS = 2;
const NOTE_PREFIX = 'Article update: ';
const TRIAL_PREFIX = 'Page trial: ';
export const TRIAL_DAYS = 28;
const TRIAL_DECISIONS = ['keep', 'remove', 'cancel'];
const STOPWORDS = new Set('a an and are as at be best by can do does for from how i in is it its me my of on or the to vs what when where which who why will with you your 2024 2025 2026 2027'.split(' '));

/* ---------- markdown helpers (pure) ---------- */

const words = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
const countOf = (hay, needle) => (needle ? hay.split(needle).length - 1 : 0);

// Query words (not stopwords) that the title/description/headings never use.
export function missingTerms(query, text) {
  const have = new Set(words(text).flatMap((w) => [w, w.replace(/s$/, '')]));
  return words(query).filter((w) => w.length > 2 && !STOPWORDS.has(w) && !have.has(w) && !have.has(w.replace(/s$/, '')));
}

// Mechanical checks a reader of search results sees first.
export function articleChecks({ title, description, md, queries }) {
  const out = [];
  const body = splitFrontMatter(md).body;
  const wordCount = words(body.replace(/[#*_>`|-]/g, ' ')).length;
  if (!title) out.push({ level: 'bad', text: 'No title found on the live page.' });
  else if (title.length > 65) out.push({ level: 'warn', text: `Title is ${title.length} characters; Google usually cuts it near 60.` });
  else if (title.length < 30) out.push({ level: 'warn', text: `Title is only ${title.length} characters; there is room to name what readers search for.` });
  if (!description) out.push({ level: 'bad', text: 'No meta description; Google will pick a snippet itself.' });
  else if (description.length > 165) out.push({ level: 'warn', text: `Description is ${description.length} characters; it will be cut after about 155.` });
  else if (description.length < 70) out.push({ level: 'warn', text: `Description is ${description.length} characters; a longer one can answer the query in the result.` });
  if (wordCount) out.push({ level: wordCount < 600 ? 'warn' : 'ok', text: `${wordCount.toLocaleString('en-US')} words${wordCount < 600 ? ': thin for a query that has competition' : ''}.` });
  const h1 = (body.match(/^#\s+/gm) || []).length;
  if (h1 > 1) out.push({ level: 'warn', text: `${h1} top-level (#) headings; keep one.` });
  const seen = `${title} ${description} ${headings(md).map((h) => h.text).join(' ')}`;
  const top = [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 12);
  for (const q of top) {
    const missing = missingTerms(q.query, seen);
    if (missing.length) out.push({ level: 'warn', text: `“${q.query}” (${q.impressions.toLocaleString('en-US')} impressions) — the title, description and headings never say ${missing.map((w) => `“${w}”`).join(', ')}.`, query: q.query });
  }
  return out;
}

/* ---------- Claude ---------- */

const SUGGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Two or three sentences: what is holding this article back in search and what these changes do about it.' },
    title: {
      type: 'object', additionalProperties: false, required: ['value', 'why'],
      properties: { value: { type: 'string' }, why: { type: 'string' } },
    },
    description: {
      type: 'object', additionalProperties: false, required: ['value', 'why'],
      properties: { value: { type: 'string' }, why: { type: 'string' } },
    },
    edits: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['find', 'replace', 'why', 'query'],
        properties: {
          find: { type: 'string', description: 'Exact text copied from the markdown, long enough to occur once.' },
          replace: { type: 'string' },
          why: { type: 'string' },
          query: { type: 'string', description: 'The search query this targets, or empty.' },
        },
      },
    },
    sections: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['after', 'markdown', 'why', 'query'],
        properties: {
          after: { type: 'string', description: 'Exact text of the existing heading (without #) to insert after its section, or empty for the end.' },
          markdown: { type: 'string', description: 'The new section, starting with its ## heading.' },
          why: { type: 'string' },
          query: { type: 'string' },
        },
      },
    },
  },
  required: ['summary', 'title', 'description', 'edits', 'sections'],
};

const SYSTEM = `You are the search editor inside SiteLens Studio. The owner of a website wants one of their published articles to earn more organic search traffic. You get the article's markdown, its live title and meta description, and the Search Console queries it already shows up for, with clicks, impressions, CTR and average position.

Work from that data:
- Queries with many impressions at positions 4-20 are the best chances: make sure the article clearly answers them, in a heading or a sentence that uses the reader's words.
- High position but low CTR means the title and description don't sell the click: rewrite them for the query people actually type.
- Titles under 60 characters, descriptions 120-155 characters. Keep the brand name only if the current title has it.
- Suggest internal links to the other articles listed when they genuinely help the reader.

Keep the article honest and in the owner's voice:
- Never invent facts, prices, features, numbers or claims about other products. If something needs a fact you don't have, leave it out.
- Keep markup patterns that repeat across sections (bold labels, list formats, tables, FAQ shape) exactly as they are; the site's template may parse them.
- Prefer a few high-value changes over many small ones. No keyword stuffing.

Each edit's "find" must be copied exactly from the markdown and occur once in it. Return new sections only when a query has no good answer in the article yet.`;

const WHERE = {
  frontmatter: (f) => `The ${f} is the "${f}" field in the front matter.`,
  heading: () => 'The page title is the article\'s # heading, so your title suggestion replaces that heading.',
  lede: (f, m) => `The meta description is the article's first paragraph${m.cut ? ` (the site cuts it at ${m.cut} characters)` : ''}, so your description suggestion replaces that paragraph; keep it readable as the article's opening.`,
  file: (f, m) => `The ${f} is set in ${m.file}, outside the markdown.`,
};

function suggestPrompt({ site, url, title, description, md, queries, totals, others, meta }) {
  const q = queries.slice(0, 60).map((x) => `${x.query}\t${x.clicks}\t${x.impressions}\t${(x.ctr * 100).toFixed(1)}%\t${x.position.toFixed(1)}`).join('\n');
  return [
    `Site: ${site.host}\nArticle: ${url}`,
    `Live title: ${title || '(none)'}\nLive meta description: ${description || '(none)'}`,
    meta ? ['title', 'description'].map((f) => meta[f]?.where && WHERE[meta[f].where](f, meta[f])).filter(Boolean).join('\n') : '',
    `Search Console, last 28 days: ${totals.clicks} clicks, ${totals.impressions} impressions, CTR ${(totals.ctr * 100).toFixed(1)}%, average position ${totals.position.toFixed(1)}.`,
    `Queries (query, clicks, impressions, CTR, position):\n${q || '(no queries yet)'}`,
    others.length ? `Other articles on the site:\n${others.map((o) => `${o.title} — ${o.path}`).join('\n')}` : '',
    `The article's markdown:\n<article>\n${md}\n</article>`,
  ].filter(Boolean).join('\n\n');
}

// Drops edits Claude got wrong (find text missing or ambiguous) rather than applying them blindly.
export function checkSuggestions(raw, md) {
  const edits = (raw.edits || []).map((e) => ({ ...e, ok: countOf(md, e.find) === 1 && e.find !== e.replace }));
  const heads = new Set(headings(md).map((h) => h.text));
  const sections = (raw.sections || []).map((s) => ({ ...s, after: heads.has(s.after) ? s.after : '' }));
  return { ...raw, edits: edits.filter((e) => e.ok).map(({ ok, ...e }) => e), dropped: edits.filter((e) => !e.ok).length, sections };
}

/* ---------- service ---------- */

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/* ---------- page trials (pure) ---------- */

// Did the page earn its place? Same-length windows either side of the start,
// per day. Lift: clicks or impressions up a fifth (on more than a trickle), or
// two places higher. No lift and no clicks: remove. No lift but some clicks:
// flat, the owner's call. Before the trial ends there is no verdict.
export function trialVerdict({ days, elapsed, before, after }) {
  if (elapsed < days) return { status: 'running', verdict: null };
  const up = (a, b) => b > 0 ? a / b - 1 : a > 0 ? Infinity : 0;
  const clicks = up(after.clicks, before.clicks);
  const impressions = up(after.impressions, before.impressions);
  const higher = after.impressions && before.impressions ? before.position - after.position : 0;
  if (!after.impressions) return { status: 'done', verdict: 'remove', why: `Google didn’t show it once in ${days} days.` };
  if ((clicks >= 0.2 && after.clicks >= 3) || (impressions >= 0.2 && after.impressions >= 30) || higher >= 2) {
    return { status: 'done', verdict: 'keep', why: 'Search picked it up: more clicks, more impressions or a better position than before.' };
  }
  if (!after.clicks) return { status: 'done', verdict: 'remove', why: `Shown ${after.impressions} time${after.impressions === 1 ? '' : 's'} but never clicked, and no better than before.` };
  return { status: 'done', verdict: 'flat', why: 'No clear change. Remove it, or redirect it into a stronger page on the same topic.' };
}

export function createArticleEditor({ auth, store, articles, annotations, getToken, env = process.env, fetchImpl = fetch, now = Date.now, createClient = (apiKey) => new Anthropic({ apiKey }) }) {
  const metaCache = new Map(); // repo:text → { file, at }

  async function gh(method, path, token, body) {
    if (method === 'GET') return (await githubGet(fetchImpl, path, token)).json();
    const res = await fetchImpl(`https://api.github.com${path}`, {
      method,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const detail = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 404) {
      throw new EngineError(`GitHub refused to ${method === 'POST' && path.endsWith('/pulls') ? 'open the pull request' : 'write to the repo'} (${res.status}).`, {
        status: 409, kind: 'github-write', hint: 'The GitHub token in Settings → GitHub needs Contents and Pull requests set to “Read and write” for this repo.',
      });
    }
    throw new EngineError(`GitHub ${res.status}: ${detail.message || 'request failed'}`, { status: 502, kind: 'github' });
  }

  async function readFile(token, repo, file, ref) {
    const data = await gh('GET', `/repos/${repo}/contents/${file.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`, token);
    return { text: Buffer.from(data.content || '', 'base64').toString('utf8'), sha: data.sha };
  }

  // Which repo file holds this exact text (a title or description set in code).
  async function locate(token, repo, text) {
    const probe = String(text || '').replace(/["\\]/g, ' ').trim().slice(0, 80).replace(/\s+\S*$/, '');
    if (probe.length < 12) return null;
    const key = `${repo}:${text}`;
    const hit = metaCache.get(key);
    if (hit && now() - hit.at < 60 * 60_000) return hit.file;
    let file = null;
    try {
      const res = await gh('GET', `/search/code?q=${encodeURIComponent(`"${probe}" repo:${repo}`)}&per_page=5`, token);
      file = (res.items || []).map((i) => i.path).find((p) => !/\.(md|mdx)$/i.test(p)) || null;
    } catch { /* code search is best-effort */ }
    metaCache.set(key, { file, at: now() });
    return file;
  }

  async function pageQueries(site, path, startDate, endDate, rowLimit = 250) {
    const token = await auth.token();
    const host = site.host.replace(/^www\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pathRe = normPath(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { dimension: 'page', operator: 'includingRegex', expression: `^https?://(www\\.)?${host}${pathRe === '/' ? '' : pathRe}/?([?#].*)?$` };
    const run = (dimensions, limit) => querySearchAnalytics({ token, siteUrl: site.searchSite, body: { startDate, endDate, dimensions, rowLimit: limit, dimensionFilterGroups: [{ groupType: 'and', filters: [filter] }] } });
    const [totals, queries] = await Promise.all([run([], 1), rowLimit ? run(['query'], rowLimit) : []]);
    const t = totals[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    return {
      totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position },
      queries: queries.map((q) => ({ query: q.key, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position })),
    };
  }

  // Updates made here, newest first, with search numbers either side of the latest.
  async function history(site, path) {
    const notes = (await annotations.list({ scopes: [`site:${site.id}`] }))
      .filter((n) => n.source === 'notes' && n.label === `${NOTE_PREFIX}${path}`)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!notes.length || !site.searchSite) return { updates: notes, compare: null };
    const since = Date.parse(notes[0].date);
    const lastData = now() - SEARCH_LAG_DAYS * DAY;
    const days = Math.min(28, Math.floor((lastData - since) / DAY) + 1);
    if (days < 3) return { updates: notes, compare: { days: Math.max(0, days), pending: true } };
    const [before, after] = await Promise.all([
      pageQueries(site, path, isoDay(since - days * DAY), isoDay(since - DAY), 0),
      pageQueries(site, path, isoDay(since), isoDay(since + (days - 1) * DAY), 0),
    ]);
    return { updates: notes, compare: { days, before: before.totals, after: after.totals } };
  }

  // The page's open trial (or its last decided one) with search numbers so far.
  async function trial(site, path) {
    const t = ((await store.get()).pageTrials || []).filter((x) => x.site === site.id && x.path === path).at(-1);
    if (!t) return null;
    const start = Date.parse(t.start);
    const out = { ...t, ends: isoDay(start + (t.days - 1) * DAY), elapsed: 0, before: null, after: null, status: t.decision ? 'decided' : 'running', verdict: null };
    if (t.decision) return out;
    const lastData = now() - SEARCH_LAG_DAYS * DAY;
    out.elapsed = Math.max(0, Math.min(t.days, Math.floor((lastData - start) / DAY) + 1));
    if (out.elapsed < 3 || !site.searchSite) return out;
    const n = out.elapsed;
    const [before, after] = await Promise.all([
      pageQueries(site, path, isoDay(start - n * DAY), isoDay(start - DAY), 0),
      pageQueries(site, path, isoDay(start), isoDay(start + (n - 1) * DAY), 0),
    ]);
    return { ...out, before: before.totals, after: after.totals, ...trialVerdict({ days: t.days, elapsed: n, before: before.totals, after: after.totals }) };
  }

  async function startTrial(site, input = {}) {
    const path = normPath(input.path);
    const days = Number(input.days) || TRIAL_DAYS;
    if (site.demo) throw new EngineError('The sample site’s pages can’t go on trial. Open one of your own sites.', { kind: 'demo' });
    if (!site.searchSite) throw new EngineError('Pick a Search Console property in Settings first: a trial is judged on search numbers.', { status: 400, kind: 'validation' });
    if (!Number.isInteger(days) || days < 7 || days > 90) throw new EngineError('A trial runs between 7 and 90 days.', { status: 400, kind: 'validation' });
    const start = isoDay(now());
    await store.update((s) => {
      const open = (s.pageTrials || []).find((x) => x.site === site.id && x.path === path && !x.decision);
      if (open) throw new EngineError(`This page is already on trial since ${open.start}.`, { status: 409, kind: 'validation' });
      s.pageTrials = [...(s.pageTrials || []), { site: site.id, path, start, days, createdAt: new Date(now()).toISOString() }];
    });
    try {
      await annotations.addNote({ date: start, label: `${TRIAL_PREFIX}${path}`, scope: `site:${site.id}`, body: `${days} days to earn search traffic, then keep or remove.` });
    } catch { /* the trial is what matters */ }
    return trial(site, path);
  }

  // keep / remove record the owner's call and close the trial; cancel drops it.
  async function decideTrial(site, input = {}) {
    const path = normPath(input.path);
    const decision = String(input.decision || '');
    if (!TRIAL_DECISIONS.includes(decision)) throw new EngineError(`Decision must be one of: ${TRIAL_DECISIONS.join(', ')}.`, { status: 400, kind: 'validation' });
    let found = false;
    await store.update((s) => {
      const list = s.pageTrials || [];
      const i = list.findLastIndex((x) => x.site === site.id && x.path === path && !x.decision);
      if (i < 0) return;
      found = true;
      s.pageTrials = decision === 'cancel' ? list.filter((_, j) => j !== i) : list.map((x, j) => (j === i ? { ...x, decision, decidedAt: isoDay(now()) } : x));
    });
    if (!found) throw new EngineError('This page has no open trial.', { status: 404, kind: 'notfound' });
    return trial(site, path);
  }

  // Every trial on the site, for the list: dates only, no search calls.
  async function trials(site) {
    const lastData = now() - SEARCH_LAG_DAYS * DAY;
    return ((await store.get()).pageTrials || []).filter((x) => x.site === site.id).map((t) => {
      const start = Date.parse(t.start);
      const elapsed = Math.max(0, Math.min(t.days, Math.floor((lastData - start) / DAY) + 1));
      return { ...t, ends: isoDay(start + (t.days - 1) * DAY), elapsed, due: !t.decision && elapsed >= t.days };
    });
  }

  // Where the live title and description come from, per field:
  // front matter, the # heading, the first paragraph, another repo file, or unknown.
  async function metaSources(token, repo, md, live) {
    const fm = { title: frontMatterValue(md, 'title'), description: frontMatterValue(md, 'description') };
    const h1 = firstHeading(md);
    const first = lede(md);
    const field = async (key) => {
      const shown = live[key] || '';
      if (fm[key] !== undefined) return { value: fm[key], where: 'frontmatter', live: shown };
      if (key === 'title' && h1 && (sameText(h1, shown) || startsLike(shown, h1, 10))) return { value: h1, where: 'heading', live: shown, suffix: sameText(h1, shown) ? '' : shown.slice(h1.length) };
      if (key === 'description' && first && shown && startsLike(first, shown)) return { value: first, where: 'lede', live: shown, cut: shown.length < first.length ? shown.length : null };
      const file = shown ? await locate(token, repo, shown) : null;
      return file ? { value: shown, where: 'file', file, live: shown } : { value: shown, where: null, live: shown };
    };
    return { title: await field('title'), description: await field('description') };
  }

  async function detail(site, path, rangeKey = '28d') {
    if (site.demo) throw new EngineError('The sample site has no articles to edit. Open one of your own sites.', { kind: 'demo' });
    const row = await articles.find(site, path, rangeKey);
    if (!row) throw new EngineError('That article isn’t in the sitemap or the site’s code.', { status: 404, kind: 'notfound' });
    const live = (await articles.readPage(site, row.path)) || { title: '', description: '' };
    const token = await getToken();
    const out = { article: row, live, source: null, meta: null, search: null, checks: [], opportunities: [], updates: [], compare: null, trial: null, notes: {} };

    if (row.file && token) {
      try {
        const branch = row.file.branch || 'HEAD';
        const { text, sha } = await readFile(token, row.file.repo, row.file.file, branch);
        out.source = { repo: row.file.repo, file: row.file.file, branch, sha, markdown: text, href: row.file.href };
        out.meta = await metaSources(token, row.file.repo, text, live);
      } catch (err) {
        out.notes.source = `Couldn’t read ${row.file.file}: ${err.message}`;
      }
    } else if (row.file) out.notes.source = 'Add a GitHub token in Settings → GitHub to load and edit this article.';
    else out.notes.source = 'No source file in your GitHub repos matches this URL, so it can’t be edited here.';

    if (site.searchSite) {
      try {
        const range = searchRange(rangeKey);
        const [cur, prev] = await Promise.all([
          pageQueries(site, row.path, range.current.startDate, range.current.endDate),
          pageQueries(site, row.path, range.previous.startDate, range.previous.endDate),
        ]);
        // Each search's numbers the period before, so the page's demand shows what's rising, new or falling.
        const before = new Map(prev.queries.map((q) => [q.query, q]));
        const queries = cur.queries.map((q) => ({ ...q, previous: { impressions: before.get(q.query)?.impressions || 0, clicks: before.get(q.query)?.clicks || 0 } }));
        const gone = prev.queries.filter((q) => !cur.queries.some((c) => c.query === q.query) && q.impressions >= 5)
          .map((q) => ({ query: q.query, clicks: 0, impressions: 0, ctr: 0, position: 0, previous: { impressions: q.impressions, clicks: q.clicks } }));
        out.search = { range: range.current, totals: cur.totals, previous: prev.totals, queries, gone };
        out.opportunities = searchOpportunities(cur.queries, { limit: 6 });
      } catch (err) {
        out.notes.search = err.message;
      }
    } else out.notes.search = 'Pick a Search Console property in Settings to see the queries this article ranks for.';

    const title = live.title || out.meta?.title.value || '';
    const description = live.description || out.meta?.description.value || '';
    out.checks = articleChecks({ title, description, md: out.source?.markdown || '', queries: out.search?.queries || [] });
    try {
      Object.assign(out, await history(site, row.path));
    } catch (err) {
      out.notes.history = err.message;
    }
    try {
      out.trial = await trial(site, row.path);
    } catch (err) {
      out.notes.trial = err.message;
    }
    return out;
  }

  async function aiKey() {
    const saved = (await store.get()).sources?.anthropicKey || '';
    return saved || env.ANTHROPIC_API_KEY || '';
  }

  async function suggest(site, input = {}) {
    const path = normPath(input.path);
    const md = String(input.markdown || '');
    if (!md.trim()) throw new EngineError('Load the article’s source first.', { kind: 'validation' });
    const key = await aiKey();
    if (!key) throw new EngineError('Add an Anthropic API key first.', { status: 400, kind: 'ai-key', hint: 'Settings → Integrations → Claude.' });
    const d = await detail(site, path, '28d');
    const list = await articles.list(site, '28d');
    const others = list.rows.filter((r) => r.path && r.path !== path).slice(0, 30).map((r) => ({ title: r.title || r.path, path: r.path }));
    const prompt = suggestPrompt({
      site, url: d.article.url || `https://${site.host}${path}`,
      title: String(input.title ?? d.live.title), description: String(input.description ?? d.live.description),
      md, queries: d.search?.queries || [], totals: d.search?.totals || { clicks: 0, impressions: 0, ctr: 0, position: 0 }, others, meta: d.meta,
    });
    let res;
    try {
      res = await createClient(key).beta.messages.create({
        model: EDITOR_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: SUGGEST_SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      throw aiKeyError(err);
    }
    if (res.stop_reason === 'refusal') throw new EngineError('Claude declined to edit this article.', { kind: 'ai-refusal' });
    if (res.stop_reason === 'max_tokens') throw new EngineError('Claude’s suggestions ran too long. Try again.', { kind: 'ai' });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new EngineError('Claude’s answer wasn’t in the expected shape. Try again.', { kind: 'ai' });
    }
    return { ...checkSuggestions(raw, md), model: res.model || EDITOR_MODEL };
  }

  // Branch → one commit per changed file → pull request → note on the charts.
  async function publish(site, input = {}) {
    if (site.demo) throw new EngineError('The sample site can’t be published.', { kind: 'demo' });
    const path = normPath(input.path);
    const token = await getToken();
    if (!token) throw new EngineError('Add a GitHub token in Settings → GitHub first.', { status: 400, kind: 'github-token' });
    const row = await articles.find(site, path);
    if (!row?.file) throw new EngineError('This article has no source file to change.', { kind: 'validation' });
    const repo = row.file.repo;
    const base = row.file.branch || (await gh('GET', `/repos/${repo}`, token)).default_branch;
    const current = await readFile(token, repo, row.file.file, base);
    if (input.baseSha && input.baseSha !== current.sha) {
      throw new EngineError(`${row.file.file} changed on GitHub since you opened it. Reload the article and apply your edits again.`, { status: 409, kind: 'conflict' });
    }

    // Title/description edits that live in the markdown arrive inside it; ones set
    // in another file arrive as exact replacements for that file.
    const changes = new Map(); // file → { text, sha, what[] }
    const markdown = String(input.markdown ?? current.text);
    if (markdown !== current.text) changes.set(row.file.file, { text: markdown, sha: current.sha, what: ['article'] });
    const skipped = [];
    for (const m of Array.isArray(input.metaFiles) ? input.metaFiles : []) {
      const field = m.field === 'description' ? 'description' : 'title';
      const old = String(m.old || '');
      const next = String(m.next || '').trim();
      if (!next || next === old) continue;
      if (!m.file || /(^|\/)\.\.(\/|$)/.test(m.file)) { skipped.push(field); continue; }
      const entry = changes.get(m.file) || { ...(await readFile(token, repo, m.file, base)), what: [] };
      if (countOf(entry.text, old) !== 1) { skipped.push(field); continue; }
      changes.set(m.file, { ...entry, text: entry.text.replace(old, () => next), what: [...entry.what, field] });
    }
    if (!changes.size) throw new EngineError(skipped.length ? `Couldn’t find the old ${skipped.join(' and ')} exactly once in its file, so there’s nothing to commit.` : 'Nothing changed.', { kind: 'validation' });

    const stamp = new Date(now()).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
    const branch = `sitelens/${path.split('/').pop() || 'home'}-${stamp}`;
    const head = await gh('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`, token);
    await gh('POST', `/repos/${repo}/git/refs`, token, { ref: `refs/heads/${branch}`, sha: head.object.sha });
    const title = String(input.message || '').trim() || `Search update: ${row.title || path}`;
    for (const [file, c] of changes) {
      await gh('PUT', `/repos/${repo}/contents/${file.split('/').map(encodeURIComponent).join('/')}`, token, {
        message: `${title} (${c.what.join(', ')})`, content: Buffer.from(c.text, 'utf8').toString('base64'), sha: c.sha, branch,
      });
    }
    const why = String(input.notes || '').trim();
    const pr = await gh('POST', `/repos/${repo}/pulls`, token, {
      title, head: branch, base,
      body: [
        `Changes to [${path}](https://${site.host}${path}) to bring in more search traffic.`,
        `**Changed:** ${[...changes].map(([f, c]) => `\`${f}\` (${c.what.join(', ')})`).join('; ')}`,
        skipped.length ? `**Not changed:** the ${skipped.join(' and ')} — couldn’t find where it is set.` : '',
        why,
        '_Opened from SiteLens Studio._',
      ].filter(Boolean).join('\n\n'),
    });
    let note = null;
    try {
      note = await annotations.addNote({ date: isoDay(now()), label: `${NOTE_PREFIX}${path}`, scope: `site:${site.id}`, body: `${pr.html_url}\n${[...changes.values()].flatMap((c) => c.what).join(', ')}` });
    } catch { /* the PR is what matters */ }
    return { url: pr.html_url, number: pr.number, branch, files: [...changes.keys()], skipped, note };
  }

  return { detail, suggest, publish, startTrial, decideTrial, trials };
}

export function articleEditorRoutes({ editor, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/articles\/detail$/, async ({ match, query }) =>
      editor.detail(await siteOr404(match[1]), query.get('path') || '/', query.get('range') || '28d')],
    ['POST', /^\/api\/sites\/([\w-]+)\/articles\/suggest$/, async ({ match, body }) => editor.suggest(await siteOr404(match[1]), body || {})],
    ['POST', /^\/api\/sites\/([\w-]+)\/articles\/publish$/, async ({ match, body }) => editor.publish(await siteOr404(match[1]), body || {})],
    ['GET', /^\/api\/sites\/([\w-]+)\/articles\/trials$/, async ({ match }) => ({ trials: await editor.trials(await siteOr404(match[1])) })],
    ['POST', /^\/api\/sites\/([\w-]+)\/articles\/trial$/, async ({ match, body }) => editor.startTrial(await siteOr404(match[1]), body || {})],
    ['POST', /^\/api\/sites\/([\w-]+)\/articles\/trial\/decide$/, async ({ match, body }) => editor.decideTrial(await siteOr404(match[1]), body || {})],
  ];
}

