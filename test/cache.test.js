import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCache, openCacheDb, requestContext } from '../server/cache.mjs';

const MIN = 60_000;

function request(fn, wait = false) {
  const ctx = { wait, stale: false, refreshes: [] };
  return requestContext.run(ctx, fn).then((value) => ({ value, ctx }));
}

test('plain cache: TTL and concurrent loads shared', async () => {
  let t = 0;
  let loads = 0;
  const cache = createCache({ now: () => t });
  const load = async () => ++loads;
  const [a, b] = await Promise.all([cache.wrap('k', MIN, false, load), cache.wrap('k', MIN, false, load)]);
  assert.deepEqual([a, b, loads], [1, 1, 1]);
  t += 2 * MIN;
  assert.equal(await cache.wrap('k', MIN, false, load), 2);
});

test('staleFor: an expired entry answers at once, marks the request and refreshes behind it', async () => {
  let t = 0;
  let n = 0;
  let release;
  const cache = createCache({ staleFor: 60 * MIN, now: () => t });
  await cache.wrap('k', MIN, false, async () => ++n);
  t += 2 * MIN;
  const slow = () => new Promise((resolve) => (release = () => resolve(++n)));

  const first = await request(() => cache.wrap('k', MIN, false, slow));
  assert.equal(first.value, 1);
  assert.equal(first.ctx.stale, true);
  // While it refreshes, others still get the old value, and no second load starts.
  const other = await request(() => cache.wrap('k', MIN, false, slow));
  assert.equal(other.value, 1);

  // The follow-up waits for the refresh under way.
  const followUp = request(() => cache.wrap('k', MIN, false, slow), true);
  release();
  const { value, ctx } = await followUp;
  assert.equal(value, 2);
  assert.equal(ctx.stale, false);

  // Too old to show: wait for a fresh one.
  t += 2 * 60 * MIN;
  assert.equal(await cache.wrap('k', MIN, false, async () => 'new'), 'new');
  // fresh always loads.
  assert.equal(await cache.wrap('k', MIN, true, async () => 'forced'), 'forced');
});

test('db: entries survive a restart; non-JSON values and cleared keys do not', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-cache-'));
  try {
    let t = 0;
    const db = openCacheDb(join(dir, 'cache.db'));
    const one = createCache({ db, name: 'e', staleFor: 60 * MIN, now: () => t });
    await one.wrap('dash:a:28d', MIN, false, async () => ({ visits: 5 }));
    await one.wrap('dash:b:28d', MIN, false, async () => ({ visits: 7 }));
    await one.wrap('map', MIN, false, async () => new Map([[1, 2]]));
    one.clear(':b:');

    // A new process: answers from disk while it loads.
    const two = createCache({ db, name: 'e', staleFor: 60 * MIN, now: () => t });
    const never = async () => assert.fail('should answer from disk');
    assert.deepEqual(await two.wrap('dash:a:28d', MIN, false, never), { visits: 5 });
    t += 2 * MIN;
    const stale = await request(() => two.wrap('dash:a:28d', MIN, false, async () => ({ visits: 6 })));
    assert.deepEqual([stale.value, stale.ctx.stale], [{ visits: 5 }, true]);
    await Promise.all(stale.ctx.refreshes);
    assert.deepEqual(await two.wrap('dash:a:28d', MIN, false, never), { visits: 6 });
    assert.equal(await two.wrap('dash:b:28d', MIN, false, async () => 'gone'), 'gone');
    assert.equal(await two.wrap('map', MIN, false, async () => 'not stored'), 'not stored');
    // Another cache's name doesn't see these.
    const other = createCache({ db, name: 'x', staleFor: 60 * MIN, now: () => t });
    assert.equal(await other.wrap('dash:a:28d', MIN, false, async () => 'own'), 'own');
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
