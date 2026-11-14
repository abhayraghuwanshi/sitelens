import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeyFromPaths } from '../server/page-journey.mjs';

test('journeyFromPaths: next pages, exits and the step after, from sessions that started on the page', () => {
  const paths = {
    total: 32,
    edges: [
      { step: 0, from: '/blog/x', to: '(exit)', sessions: 29 },
      { step: 0, from: '/blog/x', to: '/', sessions: 3 },
      { step: 1, from: '/', to: '(exit)', sessions: 2 },
      { step: 1, from: '/', to: '/vs/raycast', sessions: 1 },
      { step: 0, from: '/other', to: '/', sessions: 9 },
    ],
  };
  const j = journeyFromPaths(paths, '/blog/x');
  assert.equal(j.landed, 32);
  assert.deepEqual(j.next, [{ page: '/', sessions: 3, share: 3 / 32 }]);
  assert.deepEqual(j.exit, { sessions: 29, share: 29 / 32 });
  assert.deepEqual(j.then['/'].map((t) => [t.page, t.sessions]), [['(exit)', 2], ['/vs/raycast', 1]]);
});
