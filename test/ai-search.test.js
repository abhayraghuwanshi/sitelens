import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import {
  assistantName, summarizeReferrals, brandTerms, defaultPrompts, normalizePrompts, readAnswer, analyzeAnswer, rangeDates, createAiSearch,
  readOpenRouter, pickModel, ENGINES,
} from '../server/ai-search.mjs';

test('assistant names from GA4 sources', () => {
  assert.equal(assistantName('chatgpt.com'), 'ChatGPT');
  assert.equal(assistantName('chat.openai.com'), 'ChatGPT');
  assert.equal(assistantName('www.perplexity.ai'), 'Perplexity');
  assert.equal(assistantName('claude.ai'), 'Claude');
  assert.equal(assistantName('gemini.google.com'), 'Gemini');
  assert.equal(assistantName('gemini'), 'Gemini');
  assert.equal(assistantName('copilot.microsoft.com'), 'Copilot');
  assert.equal(assistantName('newbot.example'), 'newbot.example');
});

test('summarizeReferrals groups sources by assistant per day', () => {
  const dates = ['2026-10-28', '2026-10-29'];
  const rows = [
    { date: '20261028', sessionSource: 'chatgpt.com', sessions: 4, engagedSessions: 2, keyEvents: 1 },
    { date: '20261029', sessionSource: 'chat.openai.com', sessions: 2, engagedSessions: 2, keyEvents: 0 },
    { date: '20261029', sessionSource: 'perplexity.ai', sessions: 1, engagedSessions: 0, keyEvents: 0 },
  ];
  const site = [{ date: '20261028', sessions: 50, engagedSessions: 25, keyEvents: 2 }, { date: '20261029', sessions: 20, engagedSessions: 10, keyEvents: 0 }];
  const s = summarizeReferrals(rows, dates, site);
  assert.equal(s.sessions, 7);
  assert.equal(s.share, 0.1);
  assert.deepEqual(s.daily, [4, 3]);
  assert.deepEqual(s.siteDaily, [50, 20]);
  assert.equal(s.assistants[0].assistant, 'ChatGPT');
  assert.deepEqual(s.assistants[0].daily, [4, 2]);
  assert.deepEqual(s.assistants[0].sources, ['chatgpt.com', 'chat.openai.com']);
  assert.equal(s.assistants[0].engagementRate, 4 / 6);
  assert.equal(s.site.engagementRate, 0.5);
});

test('rangeDates ends today', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const d = rangeDates('7d', now);
  assert.equal(d.length, 7);
  assert.equal(d.at(-1), '2026-10-30');
  assert.equal(d[0], '2026-10-24');
});

test('brand terms and default questions come from the site and its product', () => {
  const site = { id: 's1', label: 'cooldesk', host: 'cool-desk.com' };
  const products = [{ id: 'cooldesk', label: 'Cooldesk', siteId: 's1', keywords: ['new tab extension'] }, { label: 'Other', siteId: 'x' }];
  const terms = brandTerms(site, products);
  for (const t of ['cooldesk', 'cool-desk.com', 'cool-desk', 'cool desk']) assert.ok(terms.includes(t), t);
  assert.ok(!terms.includes('other'));
  assert.deepEqual(defaultPrompts(site, products), ['What is Cooldesk?', 'What are the best alternatives to Cooldesk?', 'What is the best new tab extension?']);
  assert.deepEqual(normalizePrompts('  a  question \n\nA second\na question'), ['a question', 'A second']);
  assert.throws(() => normalizePrompts(Array.from({ length: 13 }, (_, i) => `q${i}`)), /Up to 12/);
});

const answerBlocks = [
  { type: 'server_tool_use', name: 'web_search', id: 'x', input: { query: 'best new tab extension' } },
  { type: 'web_search_tool_result', tool_use_id: 'x', content: [
    { type: 'web_search_result', url: 'https://www.momentumdash.com/', title: 'Momentum' },
    { type: 'web_search_result', url: 'https://cool-desk.com/features', title: 'Cooldesk' },
  ] },
  { type: 'text', text: 'Top picks: Momentum is popular. ', citations: [{ type: 'web_search_result_location', url: 'https://www.momentumdash.com/', title: 'Momentum', cited_text: '' }] },
  { type: 'text', text: 'CoolDesk adds workspaces.', citations: [{ type: 'web_search_result_location', url: 'https://cool-desk.com/features', title: 'Cooldesk', cited_text: '' }] },
];

test('readAnswer + analyzeAnswer: named, cited and rank', () => {
  const answer = readAnswer(answerBlocks);
  assert.equal(answer.searches, 1);
  assert.equal(answer.text, 'Top picks: Momentum is popular. CoolDesk adds workspaces.');
  const a = analyzeAnswer(answer, { host: 'cool-desk.com', terms: ['cooldesk', 'cool-desk.com'] });
  assert.equal(a.mentioned, true);
  assert.equal(a.cited, true);
  assert.equal(a.rank, 2);
  assert.deepEqual(a.domains.map((d) => d.domain), ['momentumdash.com', 'cool-desk.com']);

  const none = analyzeAnswer(readAnswer(answerBlocks.slice(0, 3)), { host: 'cool-desk.com', terms: ['cooldesk'] });
  assert.equal(none.mentioned, false);
  assert.equal(none.cited, false);
  assert.equal(none.inResults, true);
  // Whole-word matching: "cooldesks" isn't "cooldesk", but "cool-desk.com" in text is.
  assert.equal(analyzeAnswer({ text: 'see cooldesks', cited: [], searched: [] }, { host: 'x.com', terms: ['cooldesk'] }).mentioned, false);
});

test('a run asks every question and keeps history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-ai-'));
  try {
    const store = createStore(dir);
    const site = await store.saveSite({ label: 'cooldesk', host: 'cool-desk.com' });
    const calls = [];
    const fake = {
      beta: {
        messages: {
          create: async (body) => {
            calls.push(body);
            // First question pauses once, then finishes.
            if (calls.length === 1) return { stop_reason: 'pause_turn', content: answerBlocks.slice(0, 2), usage: { input_tokens: 10, output_tokens: 1 }, model: body.model };
            return { stop_reason: 'end_turn', content: answerBlocks.slice(2), usage: { input_tokens: 10, output_tokens: 5 }, model: body.model };
          },
        },
      },
    };
    const ai = createAiSearch({ dbPath: join(dir, 'ai.db'), store, env: { ANTHROPIC_API_KEY: 'k' }, createClient: () => fake, log: { error() {} } });
    await ai.savePrompts(site, ['What is the best new tab extension?']);
    const r = await ai.run(site);
    assert.equal(r.started, true);
    await r.job;
    assert.equal(calls.length, 2);
    assert.equal(calls[0].model, 'claude-opus-5-5');
    // The basic version: its answers carry citations; _20260209's come back with none.
    assert.equal(calls[0].tools[0].type, 'web_search_20250305');
    assert.equal(calls[1].messages.at(-1).role, 'assistant');
    const c = await ai.checks(site);
    assert.equal(c.running, null);
    assert.equal(c.results[0].latest.mentioned, true);
    assert.equal(c.results[0].latest.rank, 2);
    assert.equal(c.results[0].mentionRate, 1);
    ai.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('without a key the run explains how to add one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-ai-'));
  try {
    const store = createStore(dir);
    const site = await store.saveSite({ label: 'x', host: 'x.com' });
    const ai = createAiSearch({ dbPath: join(dir, 'ai.db'), store, env: {} });
    await assert.rejects(ai.run(site), (err) => err.kind === 'needs-anthropic');
    const demo = await ai.overview({ id: 'demo', demo: true, label: 'Demo', host: 'example.com' }, '28d');
    assert.ok(demo.referrals.sessions > 0);
    assert.ok(demo.crawlers.totals.assistant > 0);
    assert.equal(demo.answers.sample, true);
    ai.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('questions and brand names in .sitelens.yml win over saved and generic ones', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-ai-'));
  try {
    const store = createStore(dir);
    const site = await store.saveSite({ label: 'x', host: 'cool-desk.com' });
    let search = null;
    const siteConfig = { applied: async () => (search ? { search } : null) };
    const ai = createAiSearch({ dbPath: join(dir, 'ai.db'), store, siteConfig, env: {} });
    assert.equal((await ai.promptsFor(site)).from, 'auto');
    await ai.savePrompts(site, ['What is a good new tab page?']);
    assert.equal((await ai.promptsFor(site)).from, 'settings');

    search = { brand: ['Cool Desk HQ'], topics: [{ name: 'New tab', page: '/', ask_ai: ['Best new tab extension for focus?'] }], ask_ai: ['Is there a calm start page?'] };
    const p = await ai.promptsFor(site);
    assert.equal(p.from, 'file');
    assert.deepEqual(p.prompts, ['Best new tab extension for focus?', 'Is there a calm start page?']);
    await assert.rejects(ai.savePrompts(site, ['Anything?']), /\.sitelens\.yml/);
    const c = await ai.checks(site);
    assert.equal(c.from, 'file');
    assert.deepEqual([c.results[0].topic, c.results[0].page, c.results[1].topic], ['New tab', '/', undefined]);
    assert.equal(c.terms[0], 'cool desk hq');
    ai.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readOpenRouter: text and url_citation annotations (or older citation lists)', () => {
  const a = readOpenRouter({ choices: [{ message: { content: 'Try CoolDesk or Workona.', annotations: [
    { type: 'url_citation', url_citation: { url: 'https://cool-desk.com/', title: 'CoolDesk' } },
    { type: 'url_citation', url_citation: { url: 'https://workona.com/', title: 'Workona' } },
    { type: 'file', file: {} },
  ] } }] });
  assert.equal(a.text, 'Try CoolDesk or Workona.');
  assert.deepEqual(a.cited.map((c) => c.url), ['https://cool-desk.com/', 'https://workona.com/']);
  assert.equal(a.searches, 1);
  const old = readOpenRouter({ choices: [{ message: { content: 'x' } }], citations: ['https://alternativeto.net/'] });
  assert.deepEqual(old.cited.map((c) => c.url), ['https://alternativeto.net/']);
  const answer = analyzeAnswer(a, { host: 'cool-desk.com', terms: ['cooldesk'] });
  assert.deepEqual([answer.mentioned, answer.cited, answer.rank], [true, true, 1]);
});

test('pickModel: the newest model matching each assistant, fixed ids kept', () => {
  const catalog = [
    { id: 'openai/gpt-5.4', created: 1 }, { id: 'openai/gpt-5.5', created: 2 }, { id: 'openai/gpt-5.5-mini', created: 3 },
    { id: 'google/gemini-3.8-flash', created: 5 }, { id: 'google/gemini-3.9-flash-preview', created: 6 },
    { id: 'perplexity/sonar', created: 1 }, { id: 'x-ai/grok-4.7', created: 4 }, { id: 'x-ai/grok-4.7:batch', created: 4 },
  ];
  const by = (k) => pickModel(catalog, ENGINES.find((e) => e.key === k));
  assert.deepEqual(['chatgpt', 'gemini', 'perplexity', 'grok'].map(by), ['openai/gpt-5.5', 'google/gemini-3.8-flash', 'perplexity/sonar', 'x-ai/grok-4.7']);
});

test('a run asks every question in every assistant; a provider out of credits stops only itself', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-ai-or-'));
  try {
    const store = createStore(dir);
    const site = await store.saveSite({ label: 'cooldesk', host: 'cool-desk.com' });
    const fake = { beta: { messages: { create: async (body) => ({ stop_reason: 'end_turn', content: answerBlocks.slice(2), usage: { input_tokens: 1, output_tokens: 1 }, model: body.model }) } } };
    const asked = [];
    let credits = true;
    const fetchImpl = async (url, init) => {
      if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'openai/gpt-5.5', created: 2 }, { id: 'google/gemini-3.8-flash', created: 2 }, { id: 'perplexity/sonar', created: 1 }] }) };
      const body = JSON.parse(init.body);
      asked.push(body.model);
      assert.deepEqual(body.plugins, [{ id: 'web', max_results: 5 }]);
      if (!credits) return { ok: false, status: 402, json: async () => ({ error: { message: 'Insufficient credits' } }) };
      const named = body.model.startsWith('perplexity');
      return { ok: true, json: async () => ({ model: body.model, usage: { prompt_tokens: 3, completion_tokens: 4 }, choices: [{ message: {
        content: named ? 'CoolDesk is a good pick.' : 'Workona is a good pick.',
        annotations: [{ type: 'url_citation', url_citation: { url: named ? 'https://cool-desk.com/blog' : 'https://workona.com/', title: '' } }],
      } }] }) };
    };
    const ai = createAiSearch({ dbPath: join(dir, 'ai.db'), store, env: { ANTHROPIC_API_KEY: 'k', OPENROUTER_API_KEY: 'or' }, createClient: () => fake, fetchImpl, log: { error() {} } });
    await ai.savePrompts(site, ['What is the best new tab extension?']);
    const r = await ai.run(site);
    assert.equal(r.running.total, 4);
    await r.job;
    assert.deepEqual(asked.sort(), ['google/gemini-3.8-flash', 'openai/gpt-5.5', 'perplexity/sonar']);
    const c = await ai.checks(site);
    assert.deepEqual(c.engines.map((e) => e.key), ['claude', 'chatgpt', 'gemini', 'perplexity']);
    const q = c.results[0];
    assert.equal(q.byEngine.perplexity.latest.mentioned, true);
    assert.equal(q.byEngine.perplexity.latest.rank, 1);
    assert.equal(q.byEngine.chatgpt.latest.mentioned, false);
    assert.deepEqual([q.namedBy, q.askedBy], [2, 4]);

    // OpenRouter out of credits: its assistants record the error once, Claude still runs.
    credits = false;
    asked.length = 0;
    await ai.savePrompts(site, ['What is the best new tab extension?', 'How can I organize browser tabs by project?']);
    const r2 = await ai.run(site);
    await r2.job;
    const c2 = await ai.checks(site);
    assert.match(c2.results[0].byEngine.chatgpt.latest.error + c2.results[0].byEngine.gemini.latest.error + c2.results[0].byEngine.perplexity.latest.error, /out of credits/);
    assert.equal(c2.results[0].byEngine.claude.latest.error, undefined);
    // Six OpenRouter checks were queued; the ones after the first credit error are skipped.
    assert.ok(asked.length < 6, `asked ${asked.length} times`);
    ai.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
