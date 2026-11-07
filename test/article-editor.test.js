import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontMatterValue, setFrontMatter, firstHeading, setFirstHeading, lede, setLede, startsLike, metaValue, setMetaValue } from '../shared/article-md.js';
import { missingTerms, articleChecks, checkSuggestions, createArticleEditor, trialVerdict } from '../server/article-editor.mjs';

const MD = `# Best Dock Apps for Windows

Want a macOS-style dock on Windows? Here's an honest comparison.

## Winstep Nexus

**What it's best at:** customization.
`;

test('article-md: heading, lede and front matter read and write in place', () => {
  assert.equal(firstHeading(MD), 'Best Dock Apps for Windows');
  assert.equal(lede(MD), "Want a macOS-style dock on Windows? Here's an honest comparison.");
  assert.equal(firstHeading(setFirstHeading(MD, 'New title')), 'New title');
  // Typing word by word: a trailing space survives the round trip.
  let typed = setFirstHeading(MD, '');
  assert.equal(firstHeading(typed), '');
  for (const ch of 'Free docks') typed = setFirstHeading(typed, firstHeading(typed) + ch);
  assert.equal(firstHeading(typed), 'Free docks');
  assert.equal(lede(setLede(MD, 'Ends with space ')), 'Ends with space ');
  const relede = setLede(MD, 'A shorter lede.');
  assert.equal(lede(relede), 'A shorter lede.');
  assert.ok(relede.includes('## Winstep Nexus'));

  const fm = '---\ntitle: Old\ndate: 2026-01-01\n---\n# Heading\n\nBody';
  assert.equal(frontMatterValue(fm, 'title'), 'Old');
  assert.equal(frontMatterValue(setFrontMatter(fm, 'title', 'New "quoted" $& title'), 'title'), 'New "quoted" $& title');
  assert.equal(frontMatterValue(setFrontMatter(fm, 'description', 'Added'), 'description'), 'Added');
  assert.equal(metaValue(fm, 'title', 'frontmatter'), 'Old');
  assert.equal(firstHeading(setMetaValue(MD, 'title', 'heading', 'X')), 'X');
  assert.ok(startsLike("Want a macOS-style dock on Windows? Here's an honest comparison of everything", 'Want a macOS-style dock on Windows? Here’s an honest comparison'));
});

test('missingTerms and articleChecks: query words the result never uses', () => {
  assert.deepEqual(missingTerms('mydockfinder free alternative', 'Best Dock Apps MyDockFinder'), ['free', 'alternative']);
  assert.deepEqual(missingTerms('best dock apps', 'Best Dock App list'), []);
  const checks = articleChecks({ title: 'Best Dock Apps for Windows', description: 'x'.repeat(200), md: MD, queries: [{ query: 'free dock windows', impressions: 50 }] });
  assert.ok(checks.some((c) => /cut after about 155/.test(c.text)));
  assert.ok(checks.some((c) => c.query === 'free dock windows' && /“free”/.test(c.text)));
});

test('checkSuggestions: keeps only edits whose text occurs exactly once', () => {
  const out = checkSuggestions({
    summary: 's', title: { value: 't', why: '' }, description: { value: 'd', why: '' },
    edits: [{ find: 'customization.', replace: 'deep customization.', why: '', query: '' }, { find: 'not in the text', replace: 'x', why: '', query: '' }, { find: 'Windows', replace: 'PC', why: '', query: '' }],
    sections: [{ after: 'Winstep Nexus', markdown: '## FAQ', why: '', query: '' }, { after: 'Nope', markdown: '## More', why: '', query: '' }],
  }, MD);
  assert.deepEqual(out.edits.map((e) => e.find), ['customization.']);
  assert.equal(out.dropped, 2);
  assert.deepEqual(out.sections.map((s) => s.after), ['Winstep Nexus', '']);
});

function fakeGitHub(files) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path: u.pathname + u.search, body });
    const contents = /^\/repos\/me\/site\/contents\/(.+)$/.exec(u.pathname);
    if (method === 'GET' && contents) {
      const file = decodeURIComponent(contents[1]);
      if (!(file in files)) return new Response('{}', { status: 404 });
      return Response.json({ content: Buffer.from(files[file]).toString('base64'), sha: `sha-${file}` });
    }
    if (method === 'GET' && u.pathname === '/repos/me/site/git/ref/heads/main') return Response.json({ object: { sha: 'base-sha' } });
    if (method === 'POST' && u.pathname === '/repos/me/site/git/refs') return Response.json({ ref: body.ref });
    if (method === 'PUT' && contents) return Response.json({ content: { sha: 'new' } });
    if (method === 'POST' && u.pathname === '/repos/me/site/pulls') return Response.json({ html_url: 'https://github.com/me/site/pull/7', number: 7 });
    return new Response('{}', { status: 404 });
  };
  return { fetchImpl, calls };
}

const site = { id: 's1', host: 'a.com', searchSite: '' };
const row = { path: '/blog/dock', url: 'https://a.com/blog/dock', title: 'Best Dock Apps for Windows', file: { repo: 'me/site', branch: 'main', file: 'posts/dock.md', href: '' } };
const articles = {
  find: async () => row,
  readPage: async () => ({ title: 'Best Dock Apps for Windows', description: 'Set in code: the dock list.' }),
  list: async () => ({ rows: [row, { path: '/blog/other', title: 'Other post' }] }),
};

test('publish: branch, one commit per file, pull request, and a dated note', async () => {
  const { fetchImpl, calls } = fakeGitHub({ 'posts/dock.md': MD, 'src/blogs.ts': "description: 'Set in code: the dock list.'," });
  const notes = [];
  const editor = createArticleEditor({
    auth: {}, store: { get: async () => ({}) }, articles, getToken: async () => 'tok', fetchImpl, now: () => Date.parse('2026-11-02T10:30:00Z'),
    annotations: { addNote: async (n) => { notes.push(n); return n; }, list: async () => [] },
  });
  const out = await editor.publish(site, {
    path: '/blog/dock', baseSha: 'sha-posts/dock.md', markdown: setFirstHeading(MD, 'Best Free Dock Apps for Windows'),
    metaFiles: [{ field: 'description', file: 'src/blogs.ts', old: 'Set in code: the dock list.', next: 'Free and paid docks for Windows, compared.' }],
  });
  assert.equal(out.url, 'https://github.com/me/site/pull/7');
  assert.deepEqual(out.files, ['posts/dock.md', 'src/blogs.ts']);
  assert.match(out.branch, /^sitelens\/dock-20261102-1030$/);
  const puts = calls.filter((c) => c.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[0].body.branch, out.branch);
  assert.equal(puts[0].body.sha, 'sha-posts/dock.md');
  assert.match(Buffer.from(puts[1].body.content, 'base64').toString(), /Free and paid docks/);
  const pr = calls.find((c) => c.path === '/repos/me/site/pulls');
  assert.equal(pr.body.base, 'main');
  assert.deepEqual(notes.map((n) => [n.date, n.label, n.scope]), [['2026-11-02', 'Article update: /blog/dock', 'site:s1']]);
});

test('publish: refuses when the file moved on GitHub, or when nothing changed', async () => {
  const { fetchImpl } = fakeGitHub({ 'posts/dock.md': MD });
  const editor = createArticleEditor({ auth: {}, store: { get: async () => ({}) }, articles, getToken: async () => 'tok', fetchImpl, annotations: { addNote: async () => null, list: async () => [] } });
  await assert.rejects(editor.publish(site, { path: '/blog/dock', baseSha: 'stale', markdown: 'x' }), /changed on GitHub/);
  await assert.rejects(editor.publish(site, { path: '/blog/dock', baseSha: 'sha-posts/dock.md', markdown: MD }), /Nothing changed/);
});

test('suggest: one structured call with the article, queries and where meta lives', async () => {
  const { fetchImpl } = fakeGitHub({ 'posts/dock.md': MD });
  let request;
  const createClient = () => ({ beta: { messages: { create: async (req) => {
    request = req;
    return { stop_reason: 'end_turn', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify({
      summary: 'Ranks 5th; the title never says free.', title: { value: 'Best Free Dock Apps for Windows', why: 'w' }, description: { value: 'd', why: 'w' },
      edits: [{ find: 'customization.', replace: 'customization, free.', why: 'w', query: 'free dock' }], sections: [],
    }) }] };
  } } } });
  const editor = createArticleEditor({
    auth: {}, store: { get: async () => ({ sources: { anthropicKey: 'k' } }) }, articles, getToken: async () => 'tok', fetchImpl, createClient,
    annotations: { addNote: async () => null, list: async () => [] },
  });
  const out = await editor.suggest(site, { path: '/blog/dock', markdown: MD });
  assert.equal(request.model, 'claude-opus-5-5');
  assert.equal(request.output_config.format.type, 'json_schema');
  assert.equal(request.fallbacks, 'default');
  const prompt = request.messages[0].content;
  assert.match(prompt, /# heading/);
  assert.match(prompt, /Other post — \/blog\/other/);
  assert.match(prompt, /<article>\n# Best Dock Apps/);
  assert.equal(out.edits.length, 1);
  assert.equal(out.title.value, 'Best Free Dock Apps for Windows');
});

test('suggest: needs an Anthropic key', async () => {
  const editor = createArticleEditor({ auth: {}, store: { get: async () => ({}) }, articles, getToken: async () => '', env: {}, annotations: { list: async () => [] } });
  await assert.rejects(editor.suggest(site, { path: '/blog/dock', markdown: MD }), /Anthropic API key/);
});

test('trialVerdict: no verdict until the end, then keep, flat or remove', () => {
  const t = (before, after, elapsed = 28) => trialVerdict({ days: 28, elapsed, before, after });
  const b = { clicks: 10, impressions: 400, position: 12 };
  assert.equal(t(b, { clicks: 30, impressions: 900, position: 8 }, 10).status, 'running');
  assert.equal(t(b, { clicks: 14, impressions: 420, position: 11 }).verdict, 'keep');
  assert.equal(t(b, { clicks: 10, impressions: 410, position: 9.5 }).verdict, 'keep');
  assert.equal(t(b, { clicks: 9, impressions: 380, position: 12.5 }).verdict, 'flat');
  assert.equal(t(b, { clicks: 0, impressions: 300, position: 30 }).verdict, 'remove');
  assert.equal(t({ clicks: 0, impressions: 0, position: 0 }, { clicks: 0, impressions: 0, position: 0 }).verdict, 'remove');
  // A trickle from nothing isn't a lift.
  assert.equal(t({ clicks: 0, impressions: 0, position: 0 }, { clicks: 1, impressions: 5, position: 40 }).verdict, 'flat');
});

test('trials: start once, show progress, then keep, remove or cancel', async () => {
  let state = {};
  const store = { get: async () => state, update: async (fn) => { const next = structuredClone(state); await fn(next); state = next; } };
  let today = Date.parse('2026-10-01T09:00:00Z');
  const notes = [];
  const editor = createArticleEditor({
    auth: {}, store, articles, getToken: async () => '', now: () => today,
    annotations: { addNote: async (n) => { notes.push(n); return n; }, list: async () => [] },
  });
  const gsc = { ...site, searchSite: 'sc-domain:a.com' };
  await assert.rejects(editor.startTrial(site, { path: '/blog/dock' }), /Search Console/);
  const started = await editor.startTrial(gsc, { path: '/blog/dock' });
  assert.deepEqual([started.start, started.ends, started.status, started.elapsed], ['2026-10-01', '2026-10-28', 'running', 0]);
  assert.deepEqual(notes.map((n) => n.label), ['Page trial: /blog/dock']);
  await assert.rejects(editor.startTrial(gsc, { path: '/blog/dock' }), /already on trial since 2026-10-01/);

  today = Date.parse('2026-10-12T09:00:00Z');
  assert.deepEqual((await editor.trials(gsc)).map((t) => [t.path, t.elapsed, t.due]), [['/blog/dock', 10, false]]);
  today = Date.parse('2026-11-06T09:00:00Z');
  assert.equal((await editor.trials(gsc))[0].due, true);

  await assert.rejects(editor.decideTrial(gsc, { path: '/blog/dock', decision: 'maybe' }), /keep, remove, cancel/);
  await editor.decideTrial(gsc, { path: '/blog/dock', decision: 'remove' });
  assert.deepEqual(state.pageTrials.map((t) => [t.decision, t.decidedAt]), [['remove', '2026-11-06']]);
  await assert.rejects(editor.decideTrial(gsc, { path: '/blog/dock', decision: 'keep' }), /no open trial/);

  // A new trial after a decided one; cancel drops it and leaves the old one.
  await editor.startTrial(gsc, { path: '/blog/dock' });
  await editor.decideTrial(gsc, { path: '/blog/dock', decision: 'cancel' });
  assert.equal(state.pageTrials.length, 1);
});
