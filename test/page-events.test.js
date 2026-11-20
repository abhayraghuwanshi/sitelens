import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildTimeline, createPageEvents, effectOf, foldRepeats, onePerDay, parsePatch, seriesWindow, spikeEvents, stageOf } from '../server/page-events.mjs';

const TODAY = '2026-11-20';
const days = (from, n, f) => Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), visits: f(i, addDays(from, i)) }));
const series = days('2026-08-23', 90, (i, d) => (d >= '2026-09-30' ? 6 : 10));

test('parsePatch keeps changed lines with one line of context and counts them', () => {
  const patch = ['@@ -1,8 +1,6 @@', ' # What is a UTM code?', '-A UTM code is a tag on a link.', '-| Tag | Example |', ' ', ' one', ' two', ' three', ' four', '+UTM codes began at Urchin.'].join('\n');
  const d = parsePatch(patch);
  assert.equal(d.additions, 1);
  assert.equal(d.deletions, 2);
  assert.deepEqual(d.lines[0], [' ', '# What is a UTM code?']);
  assert.deepEqual(d.lines[1], ['-', 'A UTM code is a tag on a link.']);
  assert.ok(d.lines.some(([op, t]) => op === '…' && /unchanged/.test(t)), 'far-off context is collapsed');
  assert.deepEqual(d.lines.at(-1), ['+', 'UTM codes began at Urchin.']);
});

test('parsePatch cuts long patches with a "more lines" row', () => {
  const patch = ['@@ -0,0 +1,40 @@', ...Array.from({ length: 40 }, (_, i) => `+line ${i}`)].join('\n');
  const d = parsePatch(patch, { max: 10 });
  assert.equal(d.lines.length, 10);
  assert.match(d.lines.at(-1)[1], /31 more lines/);
  assert.equal(d.additions, 40);
});

test('a commit becomes a change event with the diff and what happened after', () => {
  const t = buildTimeline({ path: '/guides/utm', today: TODAY, series, commits: [{ sha: '4e1a9c2aaaa', date: '2026-09-30', message: 'Shortened the intro', author: 'abhay', url: 'https://github.com/x/y/commit/4e1a9c2', file: 'content/guides/utm.md', additions: 0, deletions: 3, patch: '@@ -1 +1 @@\n-A UTM code is a tag.' }] });
  const e = t.events.find((x) => x.kind === 'change');
  assert.equal(e.title, 'Shortened the intro');
  assert.equal(e.who, 'you');
  assert.equal(e.tone, 'down', 'visits fell 40% after it');
  assert.equal(e.attachment.diff.src, 'commit 4e1a9c2');
  assert.deepEqual(e.attachment.diff.lines, [['-', 'A UTM code is a tag.']]);
  assert.equal(e.attachment.cells[0].value, '−40%');
  assert.equal(e.attachment.series.mark, '2026-09-30');
  assert.equal(e.attachment.series.days.length, 28);
});

test('effectOf waits for 3 days and enough visits', () => {
  assert.equal(effectOf(series, '2026-11-19', TODAY), null);
  assert.equal(effectOf(days('2026-11-01', 20, () => 0), '2026-11-10', TODAY), null);
  assert.equal(Math.round(effectOf(series, '2026-09-30', TODAY).change * 100), -40);
});

test('seriesWindow ends 10 days after the event, or today', () => {
  assert.deepEqual([seriesWindow(series, '2026-09-30', TODAY).from, seriesWindow(series, '2026-09-30', TODAY).to], ['2026-09-13', '2026-10-10']);
  assert.equal(seriesWindow(series, '2026-11-18', TODAY).to, TODAY);
});

test('a spike is a day at 2.5× the usual, titled with the result', () => {
  const s = days('2026-10-01', 30, (i) => (i === 20 ? 32 : 10));
  const [e] = spikeEvents({ series: s, today: TODAY });
  assert.equal(e.date, '2026-10-21');
  assert.equal(e.title, 'Visits spiked to 3.2× usual');
  assert.equal(e.who, 'kauzl');
  assert.equal(spikeEvents({ series: days('2026-10-01', 30, (i) => (i === 20 ? 8 : 1)), today: TODAY }).length, 0, 'under 10 visits is noise');
});

test('rule 1: check titles carry the result, not who ran it', () => {
  const t = buildTimeline({ path: '/p', today: TODAY, checks: [{ date: '2026-11-10', tool: 'speed', by: 'you', key: '4.4 s', headline: '4.4 s on phones' }] });
  assert.equal(t.events[0].title, 'Speed test: 4.4 s on phones');
  assert.equal(t.events[0].who, 'you');
  assert.ok(!/you ran/i.test(t.events[0].title));
});

test('rule 2: one event per thing per day', () => {
  const e = { date: '2026-11-10', track: 'speed', kind: 'check', tool: 'speed', id: 'a' };
  assert.equal(onePerDay([e, { ...e, id: 'b' }]).length, 1);
  assert.equal(onePerDay([e, { ...e, id: 'c', date: '2026-11-11' }]).length, 2);
});

test('rule 3: a check that repeats the last one becomes "no change" and folds', () => {
  const t = buildTimeline({ path: '/p', today: TODAY, checks: [
    { date: '2026-11-10', tool: 'speed', by: 'you', key: '4.4 s', headline: '4.4 s on phones' },
    { date: '2026-11-17', tool: 'speed', by: 'nightly', key: '4.4 s', headline: '4.4 s on phones' },
    { date: '2026-11-19', tool: 'speed', by: 'nightly', key: '2.6 s', headline: '2.6 s on phones' },
  ] });
  const [a, b, c] = t.events;
  assert.equal(a.quiet, undefined);
  assert.equal(b.title, 'Speed test: no change');
  assert.equal(b.detail, 'Still 4.4 s, as on 10 Nov.');
  assert.equal(b.quiet, true);
  assert.equal(c.title, 'Speed test: 2.6 s on phones');
  assert.equal(t.quiet, 1);
  assert.equal(t.tracks.speed, 2);
});

test('foldRepeats compares within a track only', () => {
  const out = foldRepeats([
    { date: '2026-11-01', kind: 'check', track: 'speed', tool: 'speed', key: '3' },
    { date: '2026-11-02', kind: 'check', track: 'content', tool: 'content', key: '3' },
  ]);
  assert.ok(out.every((e) => !e.quiet));
});

test('rule 4: every event has one attachment', () => {
  const t = buildTimeline({ path: '/guides/utm', today: TODAY, series, commits: [{ sha: 'abcdef1', date: '2026-09-30', message: 'x', author: '', file: 'f.md', patch: '' }],
    marks: [{ id: 'n1', date: '2026-10-02', label: 'Posted /guides/utm on Reddit', kind: 'post' }, { id: 'n2', date: '2026-10-03', label: 'Unrelated note', kind: 'note' }] });
  assert.ok(t.events.length >= 2);
  for (const e of t.events) assert.ok(e.attachment && e.attachment.title, e.id);
  assert.ok(!t.events.some((e) => e.title === 'Unrelated note'), 'notes that do not name the page are left out');
});

test('Kauzl editor notes become change events', () => {
  const t = buildTimeline({ path: '/guides/utm', today: TODAY, series, marks: [{ id: 'u', date: '2026-10-05', label: 'Article update: /guides/utm', kind: 'note', source: 'notes' }] });
  assert.equal(t.events[0].kind, 'change');
  assert.equal(t.events[0].title, 'Edited in Kauzl');
});

test('to-do stages come from what is recorded on it', () => {
  const at = Date.parse('2026-11-01T10:00:00Z');
  assert.equal(stageOf({ status: 'open', createdAt: at }, TODAY), 'open');
  assert.equal(stageOf({ status: 'open', createdAt: at, entries: [{ changes: 'New title in a draft PR' }] }, TODAY), 'proposed');
  assert.equal(stageOf({ status: 'open', createdAt: at, entries: [{ changes: 'PR #209 merged' }] }, TODAY), 'changed');
  assert.equal(stageOf({ status: 'done', createdAt: at, doneAt: Date.parse('2026-11-10T00:00:00Z') }, TODAY), 'live');
  assert.equal(stageOf({ status: 'done', createdAt: at, doneAt: Date.parse('2026-10-01T00:00:00Z') }, TODAY), 'checked');
});

test('rule 5: Now is the open to-do, with the events that led to it and the proposal as a diff', () => {
  const made = Date.parse('2026-11-15T09:00:00Z');
  const t = buildTimeline({ path: '/pricing', today: TODAY,
    checks: [{ date: '2026-11-14', tool: 'content', by: 'nightly', key: 'weak title', headline: 'a weak title' }],
    todos: [
      { id: 't1', title: 'Approve the new title', status: 'open', createdAt: made, baseline: { was: 'Kauzl pricing: plans and prices', to: 'Simple analytics for small sites · Kauzl pricing', where: 'The title' }, entries: [{ id: 'e1', at: made + 3600e3, author: 'claude', changes: 'New title in draft PR #214', expected: '+18 visits a week' }] },
      { id: 't2', title: 'Fix the sign-up button on phones', status: 'open', createdAt: made },
    ] });
  assert.equal(t.now.todo, 't1');
  assert.equal(t.now.stage, 'proposed');
  assert.deepEqual(t.now.because, ['check:content:2026-11-14:0']);
  assert.deepEqual(t.now.diff.lines, [['-', 'Kauzl pricing: plans and prices'], ['+', 'Simple analytics for small sites · Kauzl pricing']]);
  assert.equal(t.now.proposal.by, 'agent');
  assert.deepEqual(t.now.more, [{ todo: 't2', title: 'Fix the sign-up button on phones' }]);
  assert.ok(t.events.some((e) => e.title.startsWith('Proposed: New title')));
});

test('createPageEvents gathers sources and reports the ones that failed', async () => {
  const pe = createPageEvents({ today: () => TODAY, sources: {
    series: async () => ({ series }),
    commits: async () => { throw new Error('GitHub 401'); },
    marks: async () => ({ marks: [] }),
    todos: async () => ({ todos: [] }),
  } });
  const t = await pe.timeline({ id: 's' }, '/guides/utm');
  assert.equal(t.from, '2026-08-23');
  assert.equal(t.notes.commits, 'GitHub 401');
  assert.ok(Array.isArray(t.events));
  assert.equal(t.now, null);
});

test('busy days in a row are one spike event', () => {
  const s = days('2026-10-01', 30, (i) => (i >= 20 && i <= 22 ? 40 : 10));
  const out = spikeEvents({ series: s, today: TODAY });
  assert.equal(out.length, 1);
  assert.match(out[0].detail, /Still above usual for 3 days, to 23 Oct\./);
});

test('a commit that adds the file is "Published"; a "Prefix: <path>" note is named by its prefix', () => {
  const t = buildTimeline({ path: '/blog/x', today: TODAY, series,
    commits: [{ sha: 'aaaaaaa1', date: '2026-10-05', message: 'homepage revamp; blog cleanup', author: 'me', file: 'blog/x.md', status: 'added', additions: 97, deletions: 0, patch: '@@ -0,0 +1 @@\n+# X' }],
    marks: [{ id: 'n', date: '2026-11-07', label: 'Page trial: /blog/x', kind: 'note' }] });
  assert.equal(t.events[0].title, 'Published');
  assert.match(t.events[0].detail, /97 lines in x\.md · homepage revamp/);
  assert.equal(t.events.find((e) => e.kind === 'mark').title, 'Page trial started');
});

test('a goal to-do has no diff in Now: its baseline holds numbers', () => {
  const t = buildTimeline({ path: '/p', today: TODAY, todos: [{ id: 'g', title: 'Get 78% of readers to stay', status: 'open', createdAt: Date.parse('2026-11-16T00:00:00Z'), baseline: { was: 0.68, to: 0.78 } }] });
  assert.equal(t.now.diff, null);
});

test('to-do titles drop the page path on its own timeline', () => {
  const t = buildTimeline({ path: '/blog/x', today: TODAY, todos: [{ id: 'a', title: 'Get 78% of readers to stay (/blog/x)', status: 'open', createdAt: Date.parse('2026-11-16T00:00:00Z') }] });
  assert.equal(t.events[0].title, 'To-do: Get 78% of readers to stay');
  assert.equal(t.now.title, 'Get 78% of readers to stay');
});

test('two runs of a check on one day: the later one is the day’s event', () => {
  const t = buildTimeline({ path: '/p', today: TODAY, checks: [
    { date: '2026-11-20', tool: 'speed', by: 'you', key: '4.4 s', headline: '4.4 s on phones' },
    { date: '2026-11-20', tool: 'speed', by: 'you', key: '3.5 s', headline: '3.5 s on phones' },
  ] });
  assert.deepEqual(t.events.map((e) => e.title), ['Speed test: 3.5 s on phones']);
});

test('a to-do is on a page only when it names that exact page', async () => {
  const { todoIsFor } = await import('../server/page-events.mjs');
  const founder = { title: 'Get shown for a search (/founder)', link: '#/site/s/pages?article=%2Ffounder', from: 'search:/founder' };
  assert.equal(todoIsFor(founder, '/'), false, 'the home page is not inside every link');
  assert.equal(todoIsFor(founder, '/founder'), true);
  assert.equal(todoIsFor({ title: 'x', from: 'goal:/blog/x:clicks' }, '/blog/x'), true);
  assert.equal(todoIsFor({ title: 'x', from: 'goal:/blog/x:clicks' }, '/blog'), false);
  assert.equal(todoIsFor({ title: 'Home', subject: { kind: 'page', key: '/' } }, '/'), true);
  assert.equal(todoIsFor({ title: 'Fix (/pricing)' }, '/pricing'), true);
});

test('crawls show up on their own: Google with its verdict, Bing found and crawled, and whether the engine has your change', async () => {
  const { crawlEvents } = await import('../server/page-events.mjs');
  const index = {
    google: { indexed: true, coverage: 'Submitted and indexed', lastCrawled: '2026-11-14', link: 'https://search.google.com/search-console/inspect?id=x' },
    bing: { known: true, discovered: '2026-10-13', lastCrawled: '2026-11-19' },
  };
  const evs = crawlEvents({ index, changes: [{ date: '2026-11-12' }, { date: '2026-10-26' }], from: '2026-08-23', today: TODAY });
  assert.deepEqual(evs.map((e) => [e.date, e.who, e.title]), [
    ['2026-11-14', 'google', 'Google crawled it: indexed'],
    ['2026-10-13', 'bing', 'Bing found it'],
    ['2026-11-19', 'bing', 'Bing crawled it'],
  ]);
  assert.equal(evs[0].detail, 'The first crawl since your 12 Nov change: Google now has the new version.');
  assert.equal(evs[0].tone, 'up');
  assert.match(evs[0].attachment.findings[0].note, /^https:/);
  const not = crawlEvents({ index: { google: { indexed: false, coverage: 'Crawled - currently not indexed', lastCrawled: '2026-11-10' }, bing: { known: false } }, today: TODAY });
  assert.equal(not[0].title, 'Google crawled it: crawled - currently not indexed');
  assert.equal(not[0].tone, 'down');
  assert.equal(not.length, 1, 'nothing from Bing when it doesn’t know the page');
});

test('a check whose result changed says what it was', () => {
  const t = buildTimeline({ path: '/p', today: TODAY, checks: [
    { date: '2026-11-05', tool: 'index', by: 'you', key: 'Not shown / Shown', headline: 'crawled, not indexed' },
    { date: '2026-11-18', tool: 'index', by: 'nightly', key: 'Shown / Shown', headline: 'shown by Google and Bing' },
  ] });
  assert.equal(t.events[1].title, 'Index status: shown by Google and Bing');
  assert.match(t.events[1].detail, /^Was Not shown \/ Shown on 5 Nov\./);
});

test('two checks on one track are not compared with each other', () => {
  const t = buildTimeline({ path: '/p', today: TODAY, checks: [
    { date: '2026-11-20', tool: 'bots', by: 'you', key: '900 words / 900 words', headline: 'both crawlers get 900 words' },
    { date: '2026-11-20', tool: 'index', by: 'you', key: 'Shown / Shown', headline: 'shown by Google and Bing' },
  ] });
  assert.ok(t.events.every((e) => !/^Was /.test(e.detail)));
});

test('every event has a short badge: the result in a word or a number', () => {
  const t = buildTimeline({ path: '/p', today: TODAY, series: days('2026-10-01', 50, (i) => (i === 30 ? 60 : 10)),
    commits: [{ sha: 'abcdef12', date: '2026-10-20', message: 'x', author: 'me', file: 'p.md', additions: 2, deletions: 1, patch: '' }],
    checks: [{ date: '2026-11-10', tool: 'speed', by: 'you', key: '3.5 s', headline: '3.5 s on phones' }, { date: '2026-11-12', tool: 'index', by: 'you', key: 'Shown / Shown', headline: 'shown by Google and Bing' }],
    index: { google: { indexed: true, coverage: 'Submitted and indexed', lastCrawled: '2026-11-14' }, bing: {} },
    todos: [{ id: 'a', title: 'Do x', status: 'open', createdAt: Date.parse('2026-11-15T00:00:00Z') }] });
  const by = Object.fromEntries(t.events.map((e) => [e.kind + ':' + (e.tool || ''), e.badge]));
  assert.equal(by['change:'], '+2 −1');
  assert.equal(by['spike:'], '6.0×');
  assert.equal(by['check:speed'], '3.5 s');
  assert.equal(by['check:index'], 'Shown');
  assert.equal(by['crawl:'], 'Indexed');
  assert.equal(by['todo:'], 'To-do');
  assert.ok(t.events.every((e) => e.badge), 'no event without a badge');
});
