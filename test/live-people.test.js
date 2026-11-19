import test from 'node:test';
import assert from 'node:assert/strict';
import { livePeopleSql } from '../server/sql.mjs';
import { personOf } from '../server/engines.mjs';

const bq = { billingProject: 'bill', dataProject: 'data', dataset: 'analytics_1', streamId: '42' };

test('livePeopleSql: intraday tables only, the stream, and the leave-out rule', () => {
  const q = livePeopleSql({ ...bq, leaveOut: { countries: ['India'] } }, ['intraday_20261118', 'intraday_20261119']);
  assert.match(q.sql, /_TABLE_SUFFIX IN \('intraday_20261118', 'intraday_20261119'\)/);
  assert.match(q.sql, /stream_id = @stream_id/);
  assert.match(q.sql, /INTERVAL 30 MINUTE/);
  assert.match(q.sql, /WHERE NOT \(IFNULL\(country, ''\) IN \('India'\)/);
  assert.deepEqual(q.params, { stream_id: '42' });
  assert.throws(() => livePeopleSql(bq, ['20261119']), /Invalid intraday/);
  assert.throws(() => livePeopleSql(bq, []), /Invalid intraday/);
});

test('personOf: pages in order, goals vs routine events, and the source', () => {
  const p = personOf({
    visitor: '123.456789', first_ms: 1000, last_ms: 61000, device: 'mobile', browser: 'Safari', os: 'iOS', city: 'Berlin', country: 'Germany',
    source: null, referrer: 'https://www.reddit.com/r/x', first_source: '(direct)', engaged: true,
    events: [
      { ms: 1000, name: 'first_visit', path: '/', title: 'Home' },
      { ms: 1000, name: 'page_view', path: '/', title: 'Home' },
      { ms: 2000, name: 'scroll', path: '/', title: 'Home' },
      { ms: 30000, name: 'page_view', path: '/pricing', title: 'Pricing' },
      { ms: 31000, name: 'page_view', path: '/pricing', title: 'Pricing' },
      { ms: 61000, name: 'sign_up', path: '/pricing', title: 'Pricing' },
    ],
  });
  assert.equal(p.id, '456789');
  assert.deepEqual(p.pages.map((x) => x.path), ['/', '/pricing']);
  assert.deepEqual(p.did, [{ name: 'sign_up', kind: 'goal', ms: 61000 }]);
  assert.equal(p.source, 'reddit.com');
  assert.equal(p.new, true);
  assert.equal(personOf({ visitor: 'a', events: [], first_source: '(direct)' }).source, '(direct)');
  assert.equal(personOf({ visitor: 'a', events: [], source: 'newsletter' }).source, 'newsletter');
});
