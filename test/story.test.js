import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStory, causeFor } from '../server/story.mjs';

const day = (date, weekday, sessions, baseline) => ({ date, weekday, sessions, baseline, clicks: 0 });

const metrics = {
  totals: { sessions: 300, clicks: 40 },
  days: [
    day('2026-10-01', 'Thursday', 10, 10),
    day('2026-10-02', 'Friday', 60, 12),
    day('2026-10-03', 'Saturday', 9, 10),
  ],
};
const events = [
  { date: '2026-10-01', kind: 'post', label: 'Your Reddit post: Launch', url: 'https://www.reddit.com/r/x/1' },
  { date: '2026-10-02', kind: 'note', label: 'A note to self' },
  { date: '2026-09-20', kind: 'release', label: 'app v2.0', url: 'https://github.com/me/app/releases/v2.0' },
];

test('the headline compares with the previous period and sets the tone', () => {
  const up = buildStory({ metrics, previous: { sessions: 200 }, days: 28 });
  assert.equal(up.headline, 'Visits were up 50% on the previous 28 days: 300, against 200.');
  assert.equal(up.tone, 'good');
  assert.equal(buildStory({ metrics, previous: { sessions: 400 }, days: 28 }).tone, 'bad');
  assert.match(buildStory({ metrics, previous: { sessions: 295 }, days: 28 }).headline, /^Visits held steady/);
  assert.match(buildStory({ metrics, previous: { sessions: 0 }, days: 28 }).headline, /nothing to compare/);
});

test('a site without GA4 is told in search clicks', () => {
  const searchOnly = { totals: { sessions: 0, clicks: 40 }, days: [{ date: '2026-10-01', sessions: null, clicks: 40 }] };
  const story = buildStory({ metrics: searchOnly, previous: { clicks: 20 }, days: 7 });
  assert.equal(story.metric, 'clicks');
  assert.match(story.headline, /^Search clicks were up 100%/);
  assert.deepEqual(story.days, []);
});

test('movers: big ones first, in the headline’s direction, in plain words', () => {
  const story = buildStory({
    metrics, previous: { sessions: 200 }, days: 28, events,
    breakdowns: {
      source: [{ key: 'Google', value: 150, previous: 100 }, { key: 'Direct', value: 60, previous: 90 }, { key: 'Bing', value: 3, previous: 1 }],
      page: [{ key: '/', value: 120, previous: 80 }, { key: '/blog/new', value: 41, previous: 1 }],
      query: [{ key: 'acme', value: 30, previous: 10 }],
    },
  });
  assert.deepEqual(story.changes.map((c) => c.text), [
    'Google sent 50 more visits (150, up 50%).',
    'The home page drew 40 more visits (120, up 50%).',
    '/blog/new drew 40 more visits (41, from 1).',
  ]);
  assert.ok(!story.changes.some((c) => c.key === 'Bing'), 'too small to matter');
});

test('a smaller mover with a likely cause joins the list', () => {
  const story = buildStory({
    metrics, previous: { sessions: 200 }, days: 28, events,
    breakdowns: { source: [
      { key: 'Google', value: 150, previous: 100 }, { key: 'Direct', value: 140, previous: 100 },
      { key: 'Bing', value: 130, previous: 100 }, { key: 'Reddit', value: 30, previous: 5 },
    ] },
  });
  assert.equal(story.changes.length, 4);
  assert.equal(story.changes[3].key, 'Reddit');
  assert.equal(story.changes[3].cause.label, 'Your Reddit post: Launch');
});

test('causeFor matches sources and pages by name, never generic sources', () => {
  assert.equal(causeFor({ kind: 'source', key: 'Reddit' }, events).label, 'Your Reddit post: Launch');
  assert.equal(causeFor({ kind: 'source', key: 'Google' }, events), null);
  assert.equal(causeFor({ kind: 'page', key: '/' }, events), null);
  assert.equal(causeFor({ kind: 'page', key: '/releases/v2.0' }, events).kind, 'release');
  assert.equal(causeFor({ kind: 'source', key: 'A note' }, events), null, 'notes aren’t things you shipped');
});

test('notable days: far off a usual weekday, with what shipped that day or the day before', () => {
  const story = buildStory({ metrics: { ...metrics, totals: { sessions: 79 } }, previous: { sessions: 60 }, days: 3, events });
  assert.equal(story.days.length, 1);
  assert.equal(story.days[0].text, '2 Oct: 60 visits, 5× a usual Friday (12).');
  assert.deepEqual(story.days[0].events.map((e) => e.label), ['Your Reddit post: Launch']);
  assert.equal(story.shipped, 2);
});
