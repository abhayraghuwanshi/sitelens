import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRealtimeDetail } from '../shared/sitelens/reports.js';
import { demoLiveDetail } from '../shared/sitelens/demo.js';

// A GA4 realtime response for one dimension, as the Data API returns it.
const report = (dimension, rows) => ({
  dimensionHeaders: [{ name: dimension }],
  metricHeaders: [{ name: 'activeUsers', type: 'TYPE_INTEGER' }],
  rows: rows.map(([d, n]) => ({ dimensionValues: [{ value: d }], metricValues: [{ value: String(n) }] })),
  totals: [{ dimensionValues: [{ value: 'RESERVED_TOTAL' }], metricValues: [{ value: String(rows.reduce((a, [, n]) => a + n, 0)) }] }],
  rowCount: rows.length,
});

function fakeGa({ sources = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const name = body.dimensions[0].name;
    if (name === 'firstUserSource' && !sources) return new Response(JSON.stringify({ error: { code: 400, message: 'Did you mean firstUserSource?', status: 'INVALID_ARGUMENT' } }), { status: 400 });
    const data = {
      unifiedScreenName: [['Home', 3], ['Pricing', 2]],
      minutesAgo: [['0', 4], ['1', 2], ['29', 1]],
      country: [['India', 4], ['Germany', 3]],
      deviceCategory: [['desktop', 5], ['mobile', 2]],
      firstUserSource: [['reddit.com', 4], ['google', 3]],
    }[name];
    return Response.json(report(name, data));
  };
  return { fetchImpl, calls };
}

test('realtime detail: now is the last 5 minutes, minutes run oldest to newest', async (t) => {
  const { fetchImpl, calls } = fakeGa();
  t.mock.method(globalThis, 'fetch', fetchImpl);
  const live = await fetchRealtimeDetail({ token: 't', propertyId: '123', streamName: 'kauzl.com' });
  assert.equal(live.now, 5);
  assert.equal(live.last30, 7);
  assert.equal(live.perMinute.length, 30);
  assert.equal(live.perMinute[29], 4); // this minute
  assert.equal(live.perMinute[28], 2);
  assert.equal(live.perMinute[0], 1); // 29 minutes ago
  assert.deepEqual(live.pages[0], { title: 'Home', users: 3 });
  assert.equal(live.sources[0].name, 'reddit.com');
  const nowCall = calls.find((c) => c.dimensions[0].name === 'unifiedScreenName');
  assert.deepEqual(nowCall.minuteRanges, [{ startMinutesAgo: 4, endMinutesAgo: 0 }]);
  assert.equal(nowCall.dimensionFilter.filter.stringFilter.value, 'kauzl.com');
});

test('realtime detail: a property without realtime sources still loads the rest', async (t) => {
  const { fetchImpl } = fakeGa({ sources: false });
  t.mock.method(globalThis, 'fetch', fetchImpl);
  const live = await fetchRealtimeDetail({ token: 't', propertyId: '123' });
  assert.equal(live.sources, null);
  assert.equal(live.countries.length, 2);
});

test('demo live detail is steady within a minute and moves between minutes', () => {
  const at = Date.parse('2026-11-16T10:00:10Z');
  assert.deepEqual(demoLiveDetail('x.com', at), demoLiveDetail('x.com', at + 20_000));
  assert.notDeepEqual(demoLiveDetail('x.com', at).perMinute, demoLiveDetail('x.com', at + 60_000).perMinute);
  assert.ok(demoLiveDetail('x.com', at).now > 0);
});
