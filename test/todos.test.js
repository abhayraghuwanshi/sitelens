import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createAnnotations } from '../server/annotations.mjs';
import { createTodos, normalizeTodo } from '../server/todos.mjs';
import { buildNextSteps, byPage } from '../server/next-steps.mjs';
import { createTodoContext, subjectOf } from '../server/todo-context.mjs';

const NOW = new Date(2026, 10, 7, 15, 0, 0).getTime();

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'studio-todos-'));
  const store = createStore(dir);
  const annotations = createAnnotations({ store, log: {} });
  return { store, annotations, todos: createTodos({ store, annotations, now: () => NOW }), done: () => rm(dir, { recursive: true, force: true }) };
}

test('normalizeTodo: needs a title, checks links and keys', () => {
  assert.deepEqual(normalizeTodo({ title: '  Fix   the title ', site: 'abc', link: '#/site/abc/search' }), { title: 'Fix the title', site: 'abc', link: '#/site/abc/search' });
  assert.throws(() => normalizeTodo({ title: '' }), /what needs doing/);
  assert.throws(() => normalizeTodo({ title: 'x', link: 'javascript:alert(1)' }), /link/);
  assert.throws(() => normalizeTodo({ title: 'x'.repeat(201) }), /under 200/);
});

test('to-dos: added once per suggestion, done puts a note on the Timeline, reopening takes it off', async () => {
  const { store, todos, done } = await setup();
  try {
    const a = await todos.add({ title: 'Rewrite /blog/x', site: 'abc', from: 'search:/blog/x' });
    const again = await todos.add({ title: 'Rewrite /blog/x', site: 'abc', from: 'search:/blog/x' });
    assert.equal(again.id, a.id);
    await todos.add({ title: 'Something else', site: 'other' });
    assert.deepEqual((await todos.list({ site: 'abc' })).todos.map((t) => t.title), ['Rewrite /blog/x']);

    const finished = await todos.update(a.id, { status: 'done' });
    const note = (await store.get()).annotations.find((n) => n.id === finished.noteId);
    assert.deepEqual([note.label, note.date, note.scope], ['Done: Rewrite /blog/x', '2026-11-07', 'site:abc']);
    assert.equal((await todos.list({ site: 'abc' })).open, 0);

    await todos.update(a.id, { status: 'open' });
    assert.equal((await store.get()).annotations.length, 0);
    await todos.update(a.id, { title: 'Rewrite the title of /blog/x', detail: 'Use “raycast for windows”' });
    assert.equal((await todos.list()).todos.find((t) => t.id === a.id).detail, 'Use “raycast for windows”');
    await todos.remove(a.id);
    await assert.rejects(todos.update(a.id, { status: 'done' }), /isn’t there/);
  } finally {
    await done();
  }
});

test('to-dos: the old "Started:" notes come in once as open to-dos', async () => {
  const { store, annotations, todos, done } = await setup();
  try {
    await annotations.addNote({ date: '2026-11-01', label: 'Started: Rewrite the title and description of /blog/raycast-alternatives-windows', scope: 'site:abc', body: 'shown 900 times' });
    await annotations.addNote({ date: '2026-11-01', label: 'Shipped v2' });
    const first = await todos.list();
    assert.deepEqual(first.todos.map((t) => [t.title, t.site, t.status, t.detail]), [['Rewrite the title and description of /blog/raycast-alternatives-windows', 'abc', 'open', 'shown 900 times']]);
    await todos.remove(first.todos[0].id);
    assert.equal((await todos.list()).todos.length, 0);
    assert.equal((await store.get()).annotations.length, 2);
  } finally {
    await done();
  }
});

test('next steps: drops to fix, searches to win, outcome leaks, and more of what worked', () => {
  const story = {
    changes: [
      { kind: 'source', key: 'reddit.com', delta: -40, text: 'reddit.com sent 40 fewer visits.' },
      { kind: 'page', key: '/pricing', delta: -12, text: '/pricing drew 12 fewer.' },
      { kind: 'query', key: 'raycast windows', delta: 9, text: '“raycast windows” got 9 more search clicks.' },
      { kind: 'source', key: 'news.ycombinator.com', delta: 30, text: 'HN sent 30 more.', cause: { label: 'Show HN post' } },
    ],
  };
  const search = {
    opportunities: [{ query: 'raycast alternative windows', type: 'striking', impressions: 900, clicks: 9, position: 8.2, ctr: 0.01, potential: 60 }],
    queryPages: [{ query: 'raycast alternative windows', path: '/blog/raycast-alternatives-windows', impressions: 900 }],
  };
  const insights = [{ key: 'leak', tone: 'bad', title: 'Most visitors never reach the download', detail: '80% leave.', action: 'Move the button up.' }, { key: 'best-channel', tone: 'good', title: 'Reddit converts' }];
  const posts = { byPlatform: [{ key: 'hn', label: 'Hacker News', posts: 2, sessions: 120 }], items: [{ platform: 'hn', title: 'Show HN: CoolDesk', sessions: 100 }] };
  const { steps } = buildNextSteps({ siteId: 's1', story, search, insights, posts, canEdit: true });
  assert.deepEqual(steps.map((s) => [s.group, s.key]), [
    ['fix', 'fix:source:reddit.com'],
    ['fix', 'fix:page:/pricing'],
    ['found', 'search:/blog/raycast-alternatives-windows'],
    ['convert', 'outcome:leak'],
    ['grow', 'grow:posts:hn'],
    ['grow', 'grow:query:raycast windows'],
  ]);
  const found = steps.find((s) => s.group === 'found');
  assert.equal(found.title, 'Rewrite the title and description of /blog/raycast-alternatives-windows');
  assert.equal(found.link, '#/site/s1/articles?article=%2Fblog%2Fraycast-alternatives-windows');
  assert.match(steps.find((s) => s.group === 'grow').why, /2 posts there brought 120 visits, most from “Show HN: CoolDesk”/);
  assert.deepEqual(buildNextSteps({ siteId: 's1' }).steps, []);
  assert.equal(byPage(search)[0].potential, 60);
});

test('write-ups: by you or Claude, and one can tick the to-do off with what changed on the Timeline', async () => {
  const { store, todos, done } = await setup();
  try {
    const t = await todos.add({ title: 'Find out why Google search sent fewer visits', site: 'abc', subject: { kind: 'source', key: 'Google' }, baseline: { metric: 'visits', value: 77, previous: 84, junk: { a: 1 } } });
    assert.deepEqual(t.baseline, { metric: 'visits', value: 77, previous: 84 });
    await assert.rejects(todos.addEntry(t.id, {}), /what you found/);
    await assert.rejects(todos.addEntry(t.id, { summary: 'x', author: 'bot' }), /Author/);
    await todos.addEntry(t.id, { summary: '“raycast windows” lost 5 clicks', author: 'claude' });
    const finished = await todos.addEntry(t.id, { changes: 'New title in PR #12', expected: 'CTR up within 2 weeks', author: 'claude', status: 'done' });
    assert.equal(finished.status, 'done');
    assert.deepEqual(finished.entries.map((e) => e.author), ['claude', 'claude']);
    const note = (await store.get()).annotations.find((n) => n.id === finished.noteId);
    assert.equal(note.body, 'Changed: New title in PR #12\nExpected: CTR up within 2 weeks');
  } finally {
    await done();
  }
});

test('context: a source to-do brings its visits, the searches and pages that moved, and since-done numbers', async () => {
  const rows = {
    source: [{ key: 'Google', value: 77, previous: 84 }, { key: 'Reddit', value: 28, previous: 6 }],
    page: [{ key: '/blog/raycast-alternatives-windows', value: 30, previous: 41 }, { key: '/', value: 50, previous: 48 }],
    query: [{ key: 'raycast windows', value: 4, previous: 9 }],
  };
  const calls = [];
  const calendar = { breakdown: async ({ by, from, to }) => (calls.push([by, from, to]), { rows: rows[by] }) };
  const search = { current: { clicks: 60, impressions: 4000, ctr: 0.015, position: 9.2 }, queryPages: [{ query: 'raycast windows', path: '/blog/raycast-alternatives-windows', clicks: 4, impressions: 900, ctr: 0.0044, position: 8.4 }], pages: [] };
  const store = { sites: async () => [{ id: 'abc', searchSite: 'sc-domain:a.com' }], get: async () => ({}) };
  const context = createTodoContext({ calendar, engines: { search: async () => search }, outcomes: {}, store, today: () => '2026-11-07' });

  const c = await context({ site: 'abc', subject: { kind: 'source', key: 'Google' }, status: 'done', doneAt: new Date(2026, 9, 27, 12).getTime() });
  assert.deepEqual(c.period, { from: '2026-10-10', to: '2026-11-06', comparedWith: '2026-09-12 to 2026-10-09' });
  assert.deepEqual(c.source, { key: 'Google', value: 77, previous: 84 });
  assert.deepEqual(c.searchesThatMoved.rows, [{ key: 'raycast windows', value: 4, previous: 9, change: -5 }]);
  assert.equal(c.pagesThatMoved.rows[0].key, '/blog/raycast-alternatives-windows');
  assert.equal(c.searchTotals.ctr, 1.5);
  assert.deepEqual([c.sinceDone.from, c.sinceDone.days, c.sinceDone.value, c.sinceDone.before], ['2026-10-27', 11, 77, 84]);

  // An article to-do written by hand: read from its link.
  const a = await context({ site: 'abc', link: '#/site/abc/articles?article=%2Fblog%2Fraycast-alternatives-windows' });
  assert.deepEqual(a.subject, { kind: 'search', key: '/blog/raycast-alternatives-windows' });
  assert.deepEqual(a.searches, [{ query: 'raycast windows', clicks: 4, impressions: 900, ctr: 0.4, position: 8.4 }]);
  assert.match((await context({ site: 'abc', title: 'x' })).note, /written by hand/);
  assert.deepEqual(subjectOf({ link: '#/site/abc/pages?range=28d&path=%2Fpricing' }), { kind: 'page', key: '/pricing' });
});
