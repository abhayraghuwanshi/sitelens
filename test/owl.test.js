import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eye, owlSays } from '../tools/assets/lib/owl.js';

test('eye renders a ring before (todo) and a filled amber dot after (done)', () => {
  const before = eye('todo', 16);
  assert.match(before, /aria-label="not done"/);
  assert.match(before, /stroke="#F5A524"/);
  assert.doesNotMatch(before, /fill="#F5A524"/);
  assert.match(before, /viewBox="0 0 64 64" width="16" height="16"/);
  // The sclera is white, the ring is amber.
  assert.match(before, /fill="#FFFFFF"/);
});

test('eye renders a filled amber pupil after a lesson is done', () => {
  const after = eye('done', 16);
  assert.match(after, /aria-label="done"/);
  assert.match(after, /fill="#F5A524"/);
  assert.doesNotMatch(after, /stroke="#F5A524"/);
});

test('eye sizes the svg from the second argument', () => {
  assert.match(eye('todo', 14), /width="14" height="14"/);
});

test('owlSays keeps the owl talking only in empty states', () => {
  assert.match(owlSays('New here? Three quick questions.', 44), /class="owl-says"/);
  assert.match(owlSays('New here? Three quick questions.', 44), /class="bubble"/);
});
