import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import {
  assistantName, summarizeReferrals, brandTerms, defaultPrompts, normalizePrompts, readAnswer, analyzeAnswer, rangeDates, createAiSearch,
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
    assert.equal(calls[0].tools[0].type, 'web_search_20260209');
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
