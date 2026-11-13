import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runReport, MAX_PER_PROPERTY } from '../server/ga-limit.mjs';
import { createOutcomes } from '../server/outcomes.mjs';

const ok = () => new Response(JSON.stringify({ dimensionHeaders: [], metricHeaders: [], rows: [] }), { status: 200 });

async function withFetch(fake, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

test('ga-limit: at most a few reports in flight per property, others unaffected', async () => {
  let active = { a: 0, b: 0 };
  let peak = { a: 0, b: 0 };
  await withFetch(async (url) => {
    const p = url.includes('/properties/a:') ? 'a' : 'b';
    active[p] += 1;
    peak[p] = Math.max(peak[p], active[p]);
    await new Promise((r) => setTimeout(r, 5));
    active[p] -= 1;
    return ok();
  }, () => Promise.all([
    ...Array.from({ length: 12 }, () => runReport({ token: 't', propertyId: 'a', body: {} })),
    ...Array.from({ length: 3 }, () => runReport({ token: 't', propertyId: 'properties/b', body: {} })),
  ]));
  assert.equal(peak.a, MAX_PER_PROPERTY);
  assert.equal(peak.b, 3);
});

test('ga-limit: a failed report frees its slot', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    return calls <= MAX_PER_PROPERTY ? new Response('{"error":{"message":"boom"}}', { status: 500 }) : ok();
  }, async () => {
    const results = await Promise.allSettled(Array.from({ length: MAX_PER_PROPERTY + 2 }, () => runReport({ token: 't', propertyId: 'c', body: {} })));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  });
});

test('outcomes: a partial failure is held briefly, then only the failed part is asked again', async () => {
  let clock = Date.parse('2026-11-13T12:00:00Z');
  const product = { id: 'p1', siteId: 's1', extensionIds: [], repos: [], goals: [] };
  let productCalls = 0;
  const outcomes = createOutcomes({
    store: { sites: async () => [{ id: 's1', host: 'example.com', propertyId: '9' }] },
    products: {
      list: async () => [product],
      get: async () => {
        productCalls += 1;
        return { kpis: [], series: {} };
      },
    },
    auth: { token: async () => 't' },
    listingProperty: async () => null,
    now: () => clock,
  });
  let gaCalls = 0;
  let limited = true;
  await withFetch(async () => {
    gaCalls += 1;
    return limited ? new Response('{"error":{"message":"rate limit"}}', { status: 429 }) : ok();
  }, async () => {
    const first = await outcomes.get('p1', '28d');
    assert.match(first.errors.site, /rate limit/);
    assert.equal(productCalls, 1);
    const callsAfterFirst = gaCalls;

    // Within a minute: the same answer, nothing sent.
    clock += 30_000;
    assert.equal(await outcomes.get('p1', '28d'), first);
    assert.equal(gaCalls, callsAfterFirst);

    // After it: GA4 asked again, but the product part that worked isn't.
    clock += 40_000;
    limited = false;
    const second = await outcomes.get('p1', '28d');
    assert.deepEqual(second.errors, {});
    assert.equal(productCalls, 1);
    assert.ok(gaCalls > callsAfterFirst);

    // A whole result is cached as usual.
    const calls = gaCalls;
    await outcomes.get('p1', '28d');
    assert.equal(gaCalls, calls);
  });
});
