import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createAnnotations } from '../server/annotations.mjs';
import { createAnalyst, ANALYST_MODEL } from '../server/claude-analyst.mjs';

const SITE = { id: 'a', label: 'Cool Desk', host: 'cool-desk.com' };

// Replays scripted responses and records every request.
function fakeClient(script) {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        create: async (req) => {
          requests.push(structuredClone(req));
          const next = script.shift();
          if (!next) throw new Error('script ran out');
          return { model: ANALYST_MODEL, usage: { input_tokens: 100, output_tokens: 20 }, ...next };
        },
      },
    },
  };
}

async function setup(script, { key = 'sk-test' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'studio-analyst-'));
  const store = createStore(dir);
  if (key) await store.update((s) => { s.sources = { anthropicKey: key }; });
  const annotations = createAnnotations({ store, log: {} });
  const fetched = [];
  const fetchImpl = async (url) => {
    fetched.push(url);
    return Response.json([{ date: '2026-10-14', sessions: 2318, baseline: 1577 }]);
  };
  const client = fakeClient(script);
  const analyst = createAnalyst({ store, annotations, baseUrl: 'http://studio', fetchImpl, env: {}, now: () => Date.parse('2026-11-02T10:00:00Z'), createClient: () => client });
  return { dir, store, annotations, analyst, client, fetched };
}

test('analyze: reads with the MCP tools, then saves one Claude comment on the finding’s day', async () => {
  const { dir, annotations, analyst, client, fetched } = await setup([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'daily_metrics', input: { from: '2026-10-01', to: '2026-10-31', site: 'a' } }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'save_comment', input: { date: '2026-10-14', title: 'HN drove +47% sessions', body: 'Sessions 2,318 vs 1,577.\n- news.ycombinator.com +612' } }] },
  ]);
  try {
    const out = await analyst.analyze(SITE, { from: '2026-10-01', to: '2026-10-31', question: 'Why the spike?' });
    assert.equal(out.comment.label, 'HN drove +47% sessions');
    assert.equal(out.comment.date, '2026-10-14');
    assert.equal(out.comment.kind, 'claude');
    assert.equal(out.comment.via, 'app');
    assert.equal(out.comment.scope, 'site:a');
    assert.deepEqual(out.usage, { input: 200, output: 40, cacheRead: 0 });

    assert.equal(fetched[0], 'http://studio/api/calendar/metrics?from=2026-10-01&to=2026-10-31&site=a');
    const [first, second] = client.requests;
    assert.equal(first.model, ANALYST_MODEL);
    assert.match(first.messages[0].content, /Cool Desk[\s\S]*2026-10-01 to 2026-10-31[\s\S]*Why the spike\?/);
    const names = first.tools.map((t) => t.name);
    assert.ok(names.includes('save_comment') && names.includes('list_comments'));
    assert.ok(!names.includes('add_comment') && !names.includes('delete_comment'), 'no MCP write tools in-app');
    const result = second.messages[2].content[0];
    assert.equal(result.type, 'tool_result');
    assert.equal(result.tool_use_id, 't1');
    assert.match(result.content, /2318/);

    const saved = await annotations.list({ author: 'claude' });
    assert.equal(saved.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('analyze: a day outside the range lands on the last day; plain-text endings get one nudge', async () => {
  const { dir, analyst, client } = await setup([
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Looks fine.' }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 's', name: 'save_comment', input: { date: '2020-01-01', title: 'Quiet day', body: 'Nothing moved.' } }] },
  ]);
  try {
    const out = await analyst.analyze(SITE, { date: '2026-10-20' });
    assert.equal(out.comment.date, '2026-10-20');
    assert.equal(client.requests[1].messages.at(-1).content, 'Save your analysis now with save_comment.');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('analyze: explains a missing key, bad dates and a refusal', async () => {
  const noKey = await setup([], { key: '' });
  try {
    await assert.rejects(noKey.analyst.analyze(SITE, { date: '2026-10-20' }), /Add an Anthropic API key/);
    await assert.rejects(noKey.analyst.analyze(SITE, { from: '2026-10-31', to: '2026-10-01' }), /YYYY-MM-DD/);
  } finally {
    await rm(noKey.dir, { recursive: true, force: true });
  }
  const refused = await setup([{ stop_reason: 'refusal', content: [] }]);
  try {
    await assert.rejects(refused.analyst.analyze(SITE, { date: '2026-10-20' }), /declined/);
    assert.deepEqual((await refused.analyst.status()).running, []);
  } finally {
    await rm(refused.dir, { recursive: true, force: true });
  }
});
