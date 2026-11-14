// AI search visibility: how a site shows up in ChatGPT, Perplexity, Claude,
// Gemini and Copilot.
//
// Three signals, from cheapest to most direct:
//   1. Referral sessions from AI assistants (GA4) — people who clicked through.
//   2. AI bots in the server logs (Firebase) — assistant fetches mean an AI
//      read the page live to answer someone; crawlers index/train.
//   3. Answer checks (opt-in, costs API credits) — AI assistants with web
//      search answer the questions you care about; Studio records whether each
//      answer names the product and cites the site, and who else it cites.
//      Claude is asked directly (Anthropic key); ChatGPT, Gemini, Perplexity
//      and Grok through OpenRouter (one key), each with its provider's own web
//      search. Results go to .data/ai-search.db so the mention rate has history.
//
// Google AI Overviews clicks are counted as Google organic in Search Console
// and GA4, and can't be separated.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { runReport } from './ga-limit.mjs';
import { getRange, hostFilter, AI_REFERRER_SOURCES, AI_CHANNEL_GROUP, AI_MEDIUM } from '../shared/sitelens/reports.js';
import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';
import { aiQuestions } from './site-config.mjs';

export const CHECK_MODEL = 'claude-opus-5-5';

// The assistants a check can ask. The OpenRouter ones resolve to the newest
// model matching `match` in OpenRouter's catalog (or a model you set), so they
// stay current without code changes.
export const ENGINES = [
  { key: 'claude', label: 'Claude', via: 'anthropic' },
  { key: 'chatgpt', label: 'ChatGPT', via: 'openrouter', match: /^openai\/gpt-\d+(\.\d+)?$/ },
  { key: 'gemini', label: 'Gemini', via: 'openrouter', match: /^google\/gemini-\d+(\.\d+)?-(pro|flash)$/ },
  { key: 'perplexity', label: 'Perplexity', via: 'openrouter', fixed: 'perplexity/sonar' },
  { key: 'grok', label: 'Grok', via: 'openrouter', match: /^x-ai\/grok-\d+(\.\d+)?$/ },
];
export const ENGINE_ON = { claude: true, chatgpt: true, gemini: true, perplexity: true, grok: false };
const OPENROUTER = 'https://openrouter.ai/api/v1';
const MODEL_ID = /^[\w.-]+\/[\w.:-]+$/;
const MAX_PROMPTS = 12;
const DAY = 86_400_000;
const HOUR = 3_600_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL, run_id TEXT NOT NULL, prompt TEXT NOT NULL, ts INTEGER NOT NULL,
  model TEXT, mentioned INTEGER, cited INTEGER, rank INTEGER, answer TEXT, sources TEXT, searches INTEGER,
  input_tokens INTEGER, output_tokens INTEGER, error TEXT
);
CREATE INDEX IF NOT EXISTS checks_site ON checks (site_id, prompt, ts);
`;
// Added with multi-assistant checks; rows from before are Claude's.
const MIGRATIONS = ['ALTER TABLE checks ADD COLUMN engine TEXT'];

// Answer like an AI search assistant would, without knowing whose site is being checked.
const SYSTEM = `You are an AI search assistant. Search the web, then answer the user's question the way a search assistant does:
name the specific products, tools, sites or resources you'd recommend, briefly say why, and cite your sources.`;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const bare = (host) => String(host || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/:].*$/, '');

/* ---------- pure helpers (unit-tested) ---------- */

const ASSISTANTS = [
  [/chatgpt|openai/, 'ChatGPT'],
  [/perplexity/, 'Perplexity'],
  [/claude|anthropic/, 'Claude'],
  [/gemini|bard\.google/, 'Gemini'],
  [/copilot|bing\.com\/chat/, 'Copilot'],
  [/(^|\.)you\.com/, 'You.com'],
  [/phind/, 'Phind'],
  [/(^|\.)poe\.com/, 'Poe'],
  [/grok/, 'Grok'],
  [/deepseek/, 'DeepSeek'],
  [/mistral/, 'Mistral'],
  [/meta\.ai/, 'Meta AI'],
];

export function assistantName(source) {
  const s = String(source || '').toLowerCase().trim();
  for (const [re, label] of ASSISTANTS) if (re.test(s)) return label;
  return s || 'Unknown';
}

// GA4 filter for AI traffic: the AI Assistant channel, its medium, or a known referrer.
export function aiTrafficFilter() {
  return {
    orGroup: {
      expressions: [
        { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: AI_CHANNEL_GROUP, caseSensitive: false } } },
        { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', value: AI_MEDIUM, caseSensitive: false } } },
        { filter: { fieldName: 'sessionSource', inListFilter: { values: AI_REFERRER_SOURCES, caseSensitive: false } } },
      ],
    },
  };
}

// Dates for an API range key, oldest first (GA4 reports them as YYYYMMDD).
export function rangeDates(rangeKey, now = Date.now()) {
  const days = Math.max(1, getRange(rangeKey, new Date(now)).days || 1);
  return Array.from({ length: days }, (_, i) => isoDay(now - (days - 1 - i) * DAY));
}
const gaDay = (v) => (/^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v);

// Rows of { date, sessionSource, sessions, engagedSessions, keyEvents } → per-assistant totals and daily series.
export function summarizeReferrals(rows, dates, siteDaily = []) {
  const index = new Map(dates.map((d, i) => [d, i]));
  const by = new Map();
  for (const r of rows) {
    const name = assistantName(r.sessionSource);
    const a = by.get(name) || { assistant: name, sources: new Set(), sessions: 0, engaged: 0, keyEvents: 0, daily: dates.map(() => 0) };
    a.sources.add(r.sessionSource);
    a.sessions += r.sessions || 0;
    a.engaged += r.engagedSessions || 0;
    a.keyEvents += r.keyEvents || 0;
    const i = index.get(gaDay(r.date));
    if (i !== undefined) a.daily[i] += r.sessions || 0;
    by.set(name, a);
  }
  const assistants = [...by.values()]
    .map((a) => ({ ...a, sources: [...a.sources], engagementRate: a.sessions ? a.engaged / a.sessions : null }))
    .sort((a, b) => b.sessions - a.sessions);
  const siteByDay = new Map(siteDaily.map((r) => [gaDay(r.date), r]));
  const site = siteDaily.reduce((t, r) => ({ sessions: t.sessions + (r.sessions || 0), engaged: t.engaged + (r.engagedSessions || 0), keyEvents: t.keyEvents + (r.keyEvents || 0) }), { sessions: 0, engaged: 0, keyEvents: 0 });
  const sessions = assistants.reduce((n, a) => n + a.sessions, 0);
  const engaged = assistants.reduce((n, a) => n + a.engaged, 0);
  return {
    sessions,
    keyEvents: assistants.reduce((n, a) => n + a.keyEvents, 0),
    engagementRate: sessions ? engaged / sessions : null,
    share: site.sessions ? sessions / site.sessions : null,
    site: { sessions: site.sessions, keyEvents: site.keyEvents, engagementRate: site.sessions ? site.engaged / site.sessions : null },
    assistants,
    daily: dates.map((_, i) => assistants.reduce((n, a) => n + a.daily[i], 0)),
    siteDaily: dates.map((d) => siteByDay.get(d)?.sessions || 0),
  };
}

// Names that count as "the answer mentions us": product labels, the site label,
// and the domain's name part with and without separators (cool-desk → cooldesk).
export function brandTerms(site, products = [], declared = []) {
  const terms = new Set();
  const add = (t) => {
    const v = String(t || '').trim().toLowerCase();
    if (v.length >= 3) terms.add(v);
  };
  for (const t of declared) add(t);
  for (const p of products) if (p.siteId === site.id) add(p.label);
  add(site.label);
  const host = bare(site.host);
  if (host) {
    add(host);
    const name = host.split('.').slice(0, -1).join('.') || host;
    add(name);
    add(name.replace(/[-_.]/g, ''));
    add(name.replace(/[-_.]/g, ' '));
  }
  return [...terms];
}

// Questions to start with: what people would ask an AI that should lead to you.
export function defaultPrompts(site, products = []) {
  const own = products.filter((p) => p.siteId === site.id);
  const name = own[0]?.label || site.label || bare(site.host);
  const keywords = [...new Set(own.flatMap((p) => p.keywords || []))];
  const out = [`What is ${name}?`, `What are the best alternatives to ${name}?`];
  for (const k of keywords.slice(0, 4)) out.push(`What is the best ${k}?`);
  return out;
}

export function normalizePrompts(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : String(list || '').split('\n')) {
    const p = String(raw).trim().replace(/\s+/g, ' ');
    if (!p) continue;
    if (p.length > 300) throw new EngineError('Keep each question under 300 characters.', { kind: 'validation' });
    if (!out.includes(p)) out.push(p);
  }
  if (out.length > MAX_PROMPTS) throw new EngineError(`Up to ${MAX_PROMPTS} questions per site.`, { kind: 'validation' });
  return out;
}

const containsTerm = (text, term) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text);
};

// Content blocks from a web-search answer → what it said and where it looked.
export function readAnswer(blocks) {
  const text = [];
  const cited = [];
  const searched = [];
  let searches = 0;
  for (const b of blocks) {
    if (b.type === 'text') {
      text.push(b.text);
      for (const c of b.citations || []) if (c.type === 'web_search_result_location' && c.url) cited.push({ url: c.url, title: c.title || '' });
    } else if (b.type === 'server_tool_use' && b.name === 'web_search') {
      searches += 1;
    } else if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.type === 'web_search_result' && r.url) searched.push({ url: r.url, title: r.title || '' });
    }
  }
  return { text: text.join('').trim(), cited, searched, searches };
}

// An OpenRouter chat completion → the same shape readAnswer gives. Citations
// come as message.annotations of type url_citation for every model (older
// Perplexity responses also list `citations` URLs).
export function readOpenRouter(json) {
  const msg = json?.choices?.[0]?.message || {};
  const text = typeof msg.content === 'string' ? msg.content
    : Array.isArray(msg.content) ? msg.content.map((p) => p?.text || '').join('') : '';
  const cited = [];
  for (const a of msg.annotations || []) {
    if (a?.type !== 'url_citation') continue;
    const c = a.url_citation || a;
    if (c.url) cited.push({ url: c.url, title: c.title || '' });
  }
  if (!cited.length) for (const u of json?.citations || []) cited.push({ url: typeof u === 'string' ? u : u?.url, title: u?.title || '' });
  const urls = cited.filter((c) => c.url);
  return { text: text.trim(), cited: urls, searched: urls, searches: urls.length ? 1 : 0 };
}

// The newest catalog model matching an engine (or its fixed id). Pure.
export function pickModel(catalog, engine) {
  if (engine.fixed) return catalog.some((m) => m.id === engine.fixed) || !catalog.length ? engine.fixed : '';
  const hits = catalog.filter((m) => engine.match?.test(m.id)).sort((a, b) => (b.created || 0) - (a.created || 0));
  return hits[0]?.id || '';
}

export function openRouterError(status, json, model) {
  const message = json?.error?.message || `HTTP ${status}`;
  if (status === 401) return new EngineError('OpenRouter rejected the API key.', { status: 401, kind: 'ai-key', hint: 'Create a key at openrouter.ai/keys and paste it in Settings → Integrations → OpenRouter.' });
  if (status === 402) return new EngineError('The OpenRouter account is out of credits.', { status: 402, kind: 'ai-credits', hint: 'Add credits at openrouter.ai/credits.' });
  if (status === 429) return new EngineError(`OpenRouter rate limit for ${model}: try again in a minute.`, { status: 429, kind: 'ai-quota' });
  return new EngineError(`OpenRouter (${model}): ${message}`, { status: 502, kind: 'ai' });
}

// Did the answer name us, cite us, and how high? `rank` is our domain's
// position among the distinct domains in citation order (1 = cited first).
export function analyzeAnswer(answer, { host, terms }) {
  const own = bare(host);
  const isOwn = (url) => {
    try {
      const h = bare(new URL(url).hostname);
      return h === own || h.endsWith(`.${own}`);
    } catch {
      return false;
    }
  };
  const domainOf = (url) => {
    try {
      return bare(new URL(url).hostname);
    } catch {
      return '';
    }
  };
  const order = [];
  const counts = new Map();
  for (const c of answer.cited) {
    const d = domainOf(c.url);
    if (!d) continue;
    if (!counts.has(d)) order.push(d);
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  const rankIndex = order.findIndex((d) => d === own || d.endsWith(`.${own}`));
  const searchedOwn = answer.searched.some((r) => isOwn(r.url));
  return {
    mentioned: terms.some((t) => containsTerm(answer.text, t)),
    cited: rankIndex >= 0,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    inResults: searchedOwn,
    domains: order.map((d) => ({ domain: d, citations: counts.get(d), own: d === own || d.endsWith(`.${own}`) })),
  };
}

export function aiKeyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new EngineError('Anthropic rejected the API key.', { status: 401, kind: 'ai-key', hint: 'Create a new key at console.anthropic.com → API keys.' });
  if (err instanceof Anthropic.PermissionDeniedError) return new EngineError('This Anthropic key can’t use web search.', { status: 403, kind: 'ai-key', hint: 'An org admin can enable web search in the Claude Console → Settings → Privacy.' });
  if (err instanceof Anthropic.RateLimitError) return new EngineError('Anthropic rate limit hit — try again in a minute.', { status: 429, kind: 'ai-quota' });
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) return new EngineError('The Anthropic account is out of credits.', { status: 402, kind: 'ai-credits', hint: 'Add credits at console.anthropic.com → Billing.' });
  if (err instanceof Anthropic.APIError) return new EngineError(`Claude API: ${err.message}`, { status: 502, kind: 'ai' });
  return err;
}

/* ---------- service ---------- */

export function createAiSearch({ dbPath, store, auth, firebase, siteConfig = null, env = process.env, now = Date.now, log = console, createClient = (apiKey) => new Anthropic({ apiKey }), fetchImpl = fetch }) {
  let db = null;
  let timers = [];
  const cache = createCache();
  const running = new Map(); // siteId → { runId, total, done, startedAt }

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    for (const sql of MIGRATIONS) {
      try {
        db.exec(sql);
      } catch { /* already applied */ }
    }
    return db;
  }

  async function config() {
    const s = await store.get();
    const saved = s.sources?.anthropicKey || '';
    return {
      key: saved || env.ANTHROPIC_API_KEY || '',
      source: saved ? 'settings' : env.ANTHROPIC_API_KEY ? 'env' : '',
      prompts: s.aiSearch?.prompts || {},
      weekly: Boolean(s.aiSearch?.weekly),
      products: s.products || [],
      orKey: s.sources?.openrouterKey || env.OPENROUTER_API_KEY || '',
      orSource: s.sources?.openrouterKey ? 'settings' : env.OPENROUTER_API_KEY ? 'env' : '',
      on: { ...ENGINE_ON, ...(s.aiSearch?.engines || {}) },
      models: s.aiSearch?.models || {},
    };
  }

  // OpenRouter's public model list, for picking each assistant's newest model.
  async function catalog() {
    return cache.wrap('openrouter:models', DAY, false, async () => {
      const res = await fetchImpl(`${OPENROUTER}/models`, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`OpenRouter models: HTTP ${res.status}`);
      return ((await res.json()).data || []).map((m) => ({ id: m.id, created: m.created || 0 }));
    }).catch(() => []);
  }

  // Every assistant with whether it's on, has a key, and the model it uses.
  async function engines(cfg) {
    const list = cfg.orKey ? await catalog() : [];
    return ENGINES.map((e) => {
      const model = e.via === 'anthropic' ? CHECK_MODEL : cfg.models[e.key] || pickModel(list, e);
      const ready = e.via === 'anthropic' ? Boolean(cfg.key) : Boolean(cfg.orKey && model);
      return { key: e.key, label: e.label, via: e.via, model, on: Boolean(cfg.on[e.key]), ready, custom: Boolean(cfg.models[e.key]) };
    });
  }

  // One question to one OpenRouter model with its provider's web search.
  async function askOpenRouter(key, model, prompt) {
    const res = await fetchImpl(`${OPENROUTER}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Kauzl' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
        plugins: [{ id: 'web', max_results: 5 }],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw openRouterError(res.ok ? json.error?.code || 502 : res.status, json, model);
    return { answer: readOpenRouter(json), usage: { input: json.usage?.prompt_tokens || 0, output: json.usage?.completion_tokens || 0 }, model: json.model || model };
  }

  /* ----- GA4 referrals ----- */

  async function referrals(site, rangeKey, { fresh = false } = {}) {
    const dates = rangeDates(rangeKey, now());
    if (site.demo) return demoReferrals(site, dates);
    if (!site.propertyId) return null;
    return cache.wrap(`ref:${site.id}:${rangeKey}:${dates.at(-1)}`, 10 * 60_000, fresh, async () => {
      const token = await auth.token();
      const range = getRange(rangeKey, new Date(now()));
      const host = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
      const ai = { andGroup: { expressions: [host, aiTrafficFilter()] } };
      const report = (dateRange, dimensions, metrics, dimensionFilter, limit = 10000) =>
        runReport({ token, propertyId: site.propertyId, body: { dateRanges: [dateRange], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), dimensionFilter, limit } });
      const [daily, siteDaily, landing, previous] = await Promise.all([
        report(range.current, ['date', 'sessionSource'], ['sessions', 'engagedSessions', 'keyEvents'], ai),
        report(range.current, ['date'], ['sessions', 'engagedSessions', 'keyEvents'], host),
        report(range.current, ['landingPagePlusQueryString', 'sessionSource'], ['sessions', 'engagedSessions', 'keyEvents'], ai, 200),
        report(range.previous, [], ['sessions'], ai),
      ]);
      return {
        ...summarizeReferrals(daily.rows, dates, siteDaily.rows),
        previous: previous.rows[0]?.sessions ?? 0,
        landing: landingPages(landing.rows),
      };
    });
  }

  /* ----- answer checks ----- */

  // The site's .sitelens.yml (search: ask_ai) first, then questions saved in
  // Studio, then generic ones made from the product's name.
  async function promptsFor(site) {
    const cfg = await config();
    const declared = aiQuestions((await siteConfig?.applied(site))?.search);
    if (declared.length) return { prompts: declared.map((q) => q.prompt), topics: declared, custom: true, from: 'file' };
    const saved = cfg.prompts[site.id];
    return { prompts: saved || defaultPrompts(site, cfg.products), custom: Boolean(saved), from: saved ? 'settings' : 'auto' };
  }

  async function termsFor(site, products) {
    return brandTerms(site, products, (await siteConfig?.applied(site))?.search?.brand || []);
  }

  async function savePrompts(site, list) {
    if (site.demo) throw new EngineError('The demo site’s questions can’t be saved — try them on your own site.', { kind: 'validation' });
    if ((await promptsFor(site)).from === 'file') throw new EngineError('This site’s questions come from search: ask_ai in its .sitelens.yml. Change them there.', { kind: 'validation' });
    const prompts = normalizePrompts(list);
    await store.update((s) => {
      const all = { ...(s.aiSearch?.prompts || {}) };
      if (prompts.length) all[site.id] = prompts;
      else delete all[site.id];
      s.aiSearch = { ...(s.aiSearch || {}), prompts: all };
    });
    return promptsFor(site);
  }

  async function ask(client, prompt) {
    const blocks = [];
    const usage = { input: 0, output: 0 };
    let messages = [{ role: 'user', content: prompt }];
    let model = CHECK_MODEL;
    // A long search turn can pause; send it back as-is and the server resumes.
    for (let turn = 0; turn < 4; turn++) {
      const res = await client.beta.messages.create({
        model: CHECK_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        // The basic web search on purpose: its answers carry citations (which sites
        // the assistant relied on). The dynamic-filtering version (_20260209) searches
        // from inside code execution and returns its answer without any citations, so
        // "cited" could never be measured.
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages,
      });
      usage.input += res.usage?.input_tokens || 0;
      usage.output += res.usage?.output_tokens || 0;
      model = res.model || model;
      if (res.stop_reason === 'refusal') throw new EngineError('Claude declined to answer this question.', { kind: 'ai-refusal' });
      blocks.push(...res.content);
      if (res.stop_reason !== 'pause_turn') break;
      messages = [...messages, { role: 'assistant', content: res.content }];
    }
    return { blocks, usage, model };
  }

  async function checkOne(engine, ctx, site, terms, prompt, runId) {
    const ts = now();
    try {
      let answer;
      let usage;
      let model;
      if (engine.via === 'anthropic') {
        const r = await ask(ctx.client, prompt);
        answer = readAnswer(r.blocks);
        ({ usage, model } = r);
      } else {
        ({ answer, usage, model } = await askOpenRouter(ctx.orKey, engine.model, prompt));
      }
      const a = analyzeAnswer(answer, { host: site.host, terms });
      open().prepare(`INSERT INTO checks (site_id, run_id, prompt, ts, model, mentioned, cited, rank, answer, sources, searches, input_tokens, output_tokens, engine)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(site.id, runId, prompt, ts, model, Number(a.mentioned), Number(a.cited), a.rank,
        answer.text, JSON.stringify({ domains: a.domains, inResults: a.inResults, cited: answer.cited.slice(0, 40) }), answer.searches, usage.input, usage.output, engine.key);
    } catch (raw) {
      const err = raw instanceof EngineError ? raw : aiKeyError(raw);
      open().prepare('INSERT INTO checks (site_id, run_id, prompt, ts, error, engine) VALUES (?, ?, ?, ?, ?, ?)').run(site.id, runId, prompt, ts, err.message, engine.key);
      if (['ai-key', 'ai-credits'].includes(err.kind)) throw err;
    }
  }

  // Starts a run in the background; the page polls checks() for progress.
  async function run(site) {
    if (site.demo) throw new EngineError('Answer checks run on your own sites — the demo shows sample results.', { kind: 'validation' });
    if (running.has(site.id)) return { started: false, running: running.get(site.id) };
    const cfg = await config();
    const asking = (await engines(cfg)).filter((e) => e.on && e.ready);
    if (!asking.length) {
      throw new EngineError('Answer checks need an Anthropic or OpenRouter API key, and at least one assistant turned on.', {
        status: 409, kind: 'needs-anthropic', hint: 'Paste a key in Settings → Integrations → Claude (Anthropic) or OpenRouter (ChatGPT, Gemini, Perplexity, Grok).',
      });
    }
    const { prompts } = await promptsFor(site);
    if (!prompts.length) throw new EngineError('Add at least one question first.', { kind: 'validation' });
    const ctx = { client: asking.some((e) => e.via === 'anthropic') ? createClient(cfg.key) : null, orKey: cfg.orKey };
    const terms = await termsFor(site, cfg.products);
    const queue = prompts.flatMap((prompt) => asking.map((engine) => ({ prompt, engine })));
    const state = { runId: `${now()}`, total: queue.length, done: 0, startedAt: now(), error: '', engines: asking.map((e) => e.key), stopped: {} };
    running.set(site.id, state);
    // A bad key or empty credits stops that assistant (or that provider) only.
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        const via = item.engine.via;
        if (state.stopped[via]) {
          state.done += 1;
          continue;
        }
        try {
          await checkOne(item.engine, ctx, site, terms, item.prompt, state.runId);
        } catch (err) {
          state.stopped[via] = err.message;
          state.error = Object.values(state.stopped).join(' ');
          log.error('[ai-search]', err.message);
        }
        state.done += 1;
      }
    };
    const job = Promise.all([worker(), worker(), worker()])
      .catch((err) => {
        state.error = err.message;
        log.error('[ai-search]', err.message);
      })
      .finally(() => running.delete(site.id));
    return { started: true, running: state, job };
  }

  async function checks(site) {
    const { prompts, custom, from, topics = [] } = await promptsFor(site);
    const cfg = await config();
    const terms = await termsFor(site, cfg.products);
    const topicOf = (prompt) => topics.find((q) => q.prompt === prompt);
    if (site.demo) {
      const results = demoChecks(site, prompts, now()).map((r) => ({ ...r, ...topicOf(r.prompt) }));
      // The sample has been "run" (its latest answers), so the Story doesn't ask for a key.
      const lastRun = Math.max(0, ...results.map((r) => r.latest.ts)) || null;
      return { prompts, custom: false, from, keySource: cfg.source, running: null, results, lastRun, terms, sample: true };
    }
    const d = open();
    const rows = d.prepare('SELECT * FROM checks WHERE site_id = ? ORDER BY ts DESC LIMIT 3000').all(site.id).map((r) => ({ ...r, engine: r.engine || 'claude' }));
    const all = await engines(cfg);
    // Columns: assistants turned on and ready, plus any that has results.
    const shown = all.filter((e) => (e.on && e.ready) || rows.some((r) => r.engine === e.key));
    const summarize = (mine) => {
      const ok = mine.filter((r) => !r.error);
      return {
        latest: mine[0] ? shapeCheck(mine[0]) : null,
        history: ok.slice(0, 12).reverse().map((r) => ({ ts: r.ts, mentioned: Boolean(r.mentioned), cited: Boolean(r.cited), rank: r.rank })),
        mentionRate: ok.length ? ok.filter((r) => r.mentioned).length / ok.length : null,
        citeRate: ok.length ? ok.filter((r) => r.cited).length / ok.length : null,
        runs: ok.length,
      };
    };
    const results = prompts.map((prompt) => {
      const mine = rows.filter((r) => r.prompt === prompt);
      const byEngine = Object.fromEntries(shown.map((e) => [e.key, summarize(mine.filter((r) => r.engine === e.key))]));
      const latest = shown.map((e) => byEngine[e.key].latest).filter((l) => l && !l.error);
      const ok = mine.filter((r) => !r.error);
      return {
        ...topicOf(prompt),
        prompt,
        // Claude's own fields, as before (the Story and MCP read them).
        ...summarize(mine.filter((r) => r.engine === 'claude')),
        byEngine,
        namedBy: latest.filter((l) => l.mentioned).length,
        citedBy: latest.filter((l) => l.cited).length,
        askedBy: latest.length,
        // Across every assistant and run.
        hitRate: ok.length ? ok.filter((r) => r.mentioned).length / ok.length : null,
      };
    });
    const lastRun = rows.find((r) => !r.error)?.ts || null;
    return {
      prompts, custom, from, keySource: cfg.source || cfg.orSource, weekly: cfg.weekly, running: running.get(site.id) || null, results, lastRun, terms,
      model: CHECK_MODEL, engines: shown.map(({ key, label, model, via }) => ({ key, label, model, via })),
    };
  }

  // Latest run per prompt → share mentioned/cited, for the KPI strip.
  // Latest answer per question and assistant → how many named or cited you.
  function scoreOf(results) {
    const latest = results.flatMap((r) => Object.values(r.byEngine || { claude: { latest: r.latest } }).map((e) => e.latest)).filter((l) => l && !l.error);
    if (!latest.length) return null;
    return {
      asked: latest.length,
      mentioned: latest.filter((l) => l.mentioned).length,
      cited: latest.filter((l) => l.cited).length,
    };
  }

  async function overview(site, rangeKey = '28d', { fresh = false } = {}) {
    const [ref, crawl, answer] = await Promise.all([
      referrals(site, rangeKey, { fresh }).then((data) => ({ data }), (err) => ({ error: { message: err.message, kind: err.kind || '', hint: err.hint || '' } })),
      site.demo ? demoCrawlers(rangeDates(rangeKey, now())) : firebase?.aiActivity(site.id, rangeKey === 'today' || rangeKey === 'week' ? '7d' : rangeKey).catch(() => null),
      checks(site),
    ]);
    return { range: rangeKey, dates: rangeDates(rangeKey, now()), referrals: ref.data || null, referralsError: ref.error || null, crawlers: crawl || null, answers: { ...answer, score: scoreOf(answer.results) } };
  }

  // key: Anthropic; openrouterKey: OpenRouter; engines: { chatgpt: true, … };
  // models: { chatgpt: 'openai/gpt-…' } to pin a model ('' goes back to the newest).
  async function saveSettings({ key, weekly, openrouterKey, engines: on, models } = {}) {
    if (models) {
      for (const [k, v] of Object.entries(models)) {
        if (!ENGINES.some((e) => e.key === k && e.via === 'openrouter')) throw new EngineError(`Unknown assistant: ${k}.`, { kind: 'validation' });
        if (v && !MODEL_ID.test(String(v))) throw new EngineError('A model is an OpenRouter id like openai/gpt-5.5.', { kind: 'validation' });
      }
    }
    await store.update((s) => {
      s.sources = s.sources || {};
      if (key !== undefined) {
        const k = String(key || '').trim();
        if (k) s.sources.anthropicKey = k;
        else delete s.sources.anthropicKey;
      }
      if (openrouterKey !== undefined) {
        const k = String(openrouterKey || '').trim();
        if (k) s.sources.openrouterKey = k;
        else delete s.sources.openrouterKey;
      }
      const ai = { ...(s.aiSearch || {}) };
      if (weekly !== undefined) ai.weekly = Boolean(weekly);
      if (on) ai.engines = { ...(ai.engines || {}), ...Object.fromEntries(Object.entries(on).filter(([k]) => ENGINES.some((e) => e.key === k)).map(([k, v]) => [k, Boolean(v)])) };
      if (models) {
        const next = { ...(ai.models || {}) };
        for (const [k, v] of Object.entries(models)) {
          if (v) next[k] = String(v).trim();
          else delete next[k];
        }
        ai.models = next;
      }
      s.aiSearch = ai;
    });
    return status();
  }

  async function status() {
    const cfg = await config();
    return { source: cfg.source, openrouter: cfg.orSource, weekly: cfg.weekly, model: CHECK_MODEL, engines: await engines(cfg) };
  }

  // Weekly re-check of every real site with its own questions (in its
  // .sitelens.yml or saved here), if turned on. Generic questions aren't re-run.
  async function weeklyRun() {
    const cfg = await config();
    if (!cfg.weekly || (!cfg.key && !cfg.orKey)) return;
    for (const site of (await store.sites()).filter((s) => !s.demo)) {
      if ((await promptsFor(site)).from === 'auto') continue;
      const last = open().prepare('SELECT MAX(ts) AS ts FROM checks WHERE site_id = ? AND error IS NULL').get(site.id)?.ts || 0;
      if (now() - last < 7 * DAY - HOUR) continue;
      const r = await run(site).catch((err) => log.error('[ai-search]', err.message));
      await r?.job;
    }
  }

  // Which of the site's pages the assistants cited between two times, from the
  // answer checks: path → { cited, prompts, engines }, plus how many answers there were.
  function citations(site, fromMs, toMs) {
    const pages = new Map();
    if (site.demo) return { asked: 0, pages };
    const rows = open().prepare('SELECT prompt, engine, sources FROM checks WHERE site_id = ? AND ts >= ? AND ts <= ? AND error IS NULL').all(site.id, fromMs, toMs);
    const own = bare(site.host);
    for (const r of rows) {
      const seen = new Set();
      for (const c of JSON.parse(r.sources || '{}').cited || []) {
        let url;
        try { url = new URL(c.url); } catch { continue; }
        const h = bare(url.hostname);
        if (h !== own && !h.endsWith(`.${own}`)) continue;
        const path = url.pathname.replace(/\/+$/, '') || '/';
        if (seen.has(path)) continue;
        seen.add(path);
        const p = pages.get(path) || { cited: 0, prompts: new Set(), engines: new Set() };
        p.cited += 1;
        p.prompts.add(r.prompt);
        p.engines.add(r.engine || 'claude');
        pages.set(path, p);
      }
    }
    return { asked: rows.length, pages };
  }

  return {
    overview, referrals, checks, run, savePrompts, saveSettings, status, promptsFor, citations,
    start() {
      if (timers.length) return;
      const safe = () => weeklyRun().catch((err) => log.error('[ai-search]', err.message));
      timers.push(setTimeout(safe, 5 * 60_000));
      timers.push(setInterval(safe, 6 * HOUR));
      for (const timer of timers) timer.unref?.();
    },
    stop() {
      timers.forEach((timer) => clearInterval(timer));
      timers = [];
      db?.close();
      db = null;
    },
  };
}

function shapeCheck(r) {
  if (r.error) return { ts: r.ts, error: r.error };
  const sources = JSON.parse(r.sources || '{}');
  return {
    ts: r.ts,
    model: r.model,
    mentioned: Boolean(r.mentioned),
    cited: Boolean(r.cited),
    rank: r.rank,
    inResults: Boolean(sources.inResults),
    domains: sources.domains || [],
    answer: r.answer || '',
    searches: r.searches || 0,
  };
}

// Landing pages: sessions per page with the assistant that sent the most.
function landingPages(rows) {
  const by = new Map();
  for (const r of rows) {
    const path = r.landingPagePlusQueryString || '/';
    const p = by.get(path) || { path, sessions: 0, engaged: 0, keyEvents: 0, assistants: new Map() };
    p.sessions += r.sessions || 0;
    p.engaged += r.engagedSessions || 0;
    p.keyEvents += r.keyEvents || 0;
    const name = assistantName(r.sessionSource);
    p.assistants.set(name, (p.assistants.get(name) || 0) + (r.sessions || 0));
    by.set(path, p);
  }
  return [...by.values()]
    .map((p) => ({
      path: p.path,
      sessions: p.sessions,
      keyEvents: p.keyEvents,
      engagementRate: p.sessions ? p.engaged / p.sessions : null,
      assistants: [...p.assistants.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20);
}

/* ---------- sample data for the demo site ---------- */

function seeded(seed) {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoReferrals(site, dates) {
  const rand = seeded(`${site.host}:ai:${dates.length}`);
  const mix = [['chatgpt.com', 6], ['perplexity.ai', 2.2], ['gemini.google.com', 1.4], ['claude.ai', 1.1], ['copilot.microsoft.com', 0.8]];
  const rows = [];
  const siteDaily = [];
  dates.forEach((d, i) => {
    const growth = 1 + i / dates.length;
    const date = d.replaceAll('-', '');
    let total = 0;
    for (const [source, base] of mix) {
      const sessions = Math.round(base * growth * (0.5 + rand()));
      total += sessions;
      rows.push({ date, sessionSource: source, sessions, engagedSessions: Math.round(sessions * (0.55 + rand() * 0.2)), keyEvents: rand() < 0.15 * growth ? 1 : 0 });
    }
    const all = Math.round(total * (14 + rand() * 6));
    siteDaily.push({ date, sessions: all, engagedSessions: Math.round(all * 0.52), keyEvents: Math.round(all * 0.02) });
  });
  const summary = summarizeReferrals(rows, dates, siteDaily);
  const pages = ['/features', '/pricing', '/blog/ga4-vs-plausible', '/', '/docs/getting-started', '/compare/plausible'];
  const landing = landingPages(pages.flatMap((path, i) => mix.slice(0, 3).map(([source], j) => ({
    landingPagePlusQueryString: path,
    sessionSource: source,
    sessions: Math.round((summary.sessions / (i + 2)) * (0.6 - j * 0.18) * (0.7 + rand() * 0.5)),
    engagedSessions: Math.round((summary.sessions / (i + 2)) * 0.3),
    keyEvents: i < 2 && j === 0 ? 2 : 0,
  }))));
  return { ...summary, previous: Math.round(summary.sessions * 0.7), landing };
}

function demoCrawlers(dates) {
  const rand = seeded(`crawl:${dates.length}`);
  const assistant = dates.map(() => Math.round(8 + rand() * 14));
  const crawler = dates.map(() => Math.round(30 + rand() * 60));
  const sum = (a) => a.reduce((n, v) => n + v, 0);
  const last = Date.now() - 2 * HOUR;
  return {
    dates,
    dataStart: dates[0],
    sample: true,
    series: { assistant, crawler },
    totals: { assistant: sum(assistant), crawler: sum(crawler) },
    bots: [
      { bot: 'GPTBot', kind: 'ai-crawler', label: 'AI crawler', hits: Math.round(sum(crawler) * 0.4), pages: 0, paths: 41, robots: 6, errors: 2, lastSeen: last },
      { bot: 'ChatGPT-User', kind: 'ai-assistant', label: 'AI assistant', hits: Math.round(sum(assistant) * 0.55), pages: 0, paths: 12, robots: 0, errors: 0, lastSeen: last },
      { bot: 'ClaudeBot', kind: 'ai-crawler', label: 'AI crawler', hits: Math.round(sum(crawler) * 0.3), pages: 0, paths: 33, robots: 4, errors: 0, lastSeen: last },
      { bot: 'Perplexity-User', kind: 'ai-assistant', label: 'AI assistant', hits: Math.round(sum(assistant) * 0.3), pages: 0, paths: 8, robots: 0, errors: 1, lastSeen: last },
      { bot: 'PerplexityBot', kind: 'ai-crawler', label: 'AI crawler', hits: Math.round(sum(crawler) * 0.2), pages: 0, paths: 19, robots: 3, errors: 0, lastSeen: last },
    ],
    paths: [
      { path: '/features', assistant: 61, crawler: 140, bots: ['ChatGPT-User', 'GPTBot', 'ClaudeBot'] },
      { path: '/pricing', assistant: 44, crawler: 120, bots: ['ChatGPT-User', 'Perplexity-User', 'GPTBot'] },
      { path: '/blog/ga4-vs-plausible', assistant: 23, crawler: 88, bots: ['Perplexity-User', 'ClaudeBot'] },
      { path: '/', assistant: 9, crawler: 210, bots: ['GPTBot', 'ClaudeBot', 'PerplexityBot'] },
    ],
  };
}

function demoChecks(site, prompts, nowMs) {
  const rand = seeded(`checks:${site.host}`);
  const competitors = ['plausible.io', 'usefathom.com', 'reddit.com', 'g2.com', 'matomo.org', 'simpleanalytics.com'];
  return prompts.map((prompt, i) => {
    const history = Array.from({ length: 6 }, (_, k) => {
      const mentioned = rand() < 0.45 + k * 0.06;
      return { ts: nowMs - (6 - k) * 7 * DAY, mentioned, cited: mentioned && rand() < 0.7, rank: mentioned ? 1 + Math.floor(rand() * 4) : null };
    });
    const last = history.at(-1);
    const domains = competitors.slice(i % 3, (i % 3) + 4).map((domain, k) => ({ domain, citations: 3 - Math.min(2, k), own: false }));
    if (last.cited) domains.splice(last.rank - 1, 0, { domain: bare(site.host), citations: 2, own: true });
    return {
      prompt,
      latest: { ts: last.ts, model: CHECK_MODEL, mentioned: last.mentioned, cited: last.cited, rank: last.cited ? last.rank : null, inResults: last.mentioned, domains, searches: 2, answer: 'Sample answer — run checks on your own site to see real ones.' },
      history,
      mentionRate: history.filter((h) => h.mentioned).length / history.length,
      citeRate: history.filter((h) => h.cited).length / history.length,
      runs: history.length,
    };
  });
}

export function aiSearchRoutes({ aiSearch, siteOr404 }) {
  return [
    ['GET', /^\/api\/ai-search\/status$/, async () => aiSearch.status()],
    ['POST', /^\/api\/ai-search\/settings$/, async ({ body }) => aiSearch.saveSettings(body)],
    ['GET', /^\/api\/ai-search\/sites\/([\w-]+)$/, async ({ match, query }) => aiSearch.overview(await siteOr404(match[1]), query.get('range') || '28d', { fresh: query.has('fresh') })],
    ['GET', /^\/api\/ai-search\/sites\/([\w-]+)\/checks$/, async ({ match }) => aiSearch.checks(await siteOr404(match[1]))],
    ['POST', /^\/api\/ai-search\/sites\/([\w-]+)\/prompts$/, async ({ match, body }) => aiSearch.savePrompts(await siteOr404(match[1]), body.prompts)],
    ['POST', /^\/api\/ai-search\/sites\/([\w-]+)\/run$/, async ({ match }) => {
      const { job, ...rest } = await aiSearch.run(await siteOr404(match[1]));
      return rest;
    }],
  ];
}
