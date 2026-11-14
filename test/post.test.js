import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, commitsToText, submitForm, checkPost } from '../scripts/post.mjs';

test('parseArgs reads title, text and flags', () => {
  const o = parseArgs(['Hello', 'Body text', '--sub', 'r/kauzl', '--yes']);
  assert.equal(o.title, 'Hello');
  assert.equal(o.text, 'Body text');
  assert.equal(o.sub, 'kauzl');
  assert.equal(o.yes, true);
});

test('parseArgs --git takes an optional count', () => {
  assert.equal(parseArgs(['T', '--git']).git, 'today');
  assert.equal(parseArgs(['T', '--git', '5']).git, 5);
  const o = parseArgs(['--git', 'T']);
  assert.equal(o.git, 'today');
  assert.equal(o.title, 'T');
});

test('commitsToText lists oldest first and drops merges', () => {
  assert.equal(commitsToText(['Third', 'Merge branch x', 'First']), '- First\n- Third');
});

test('submitForm builds text and link posts', () => {
  const self = submitForm({ sub: 'kauzl', title: 'T', text: 'Hi', link: '' });
  assert.equal(self.get('kind'), 'self');
  assert.equal(self.get('text'), 'Hi');
  assert.equal(self.get('sr'), 'kauzl');
  const link = submitForm({ sub: 'kauzl', title: 'T', text: '', link: 'https://kauzl.com' });
  assert.equal(link.get('kind'), 'link');
  assert.equal(link.get('url'), 'https://kauzl.com');
  assert.equal(link.has('text'), false);
});

test('checkPost catches missing title, long titles and bad links', () => {
  assert.match(checkPost({ sub: 'kauzl', title: '' }), /title/);
  assert.match(checkPost({ sub: 'kauzl', title: 'x'.repeat(301) }), /300/);
  assert.match(checkPost({ sub: 'kauzl', title: 'T', link: 'kauzl.com' }), /http/);
  assert.equal(checkPost({ sub: 'kauzl', title: 'T', link: '' }), '');
});
