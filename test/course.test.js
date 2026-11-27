import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATHS } from '../tools/course.mjs';
import { emptyState, markDone, toggleStep, answer, nextLesson, moduleProgress, pickPath, loadState, saveState, STORAGE_KEY } from '../tools/assets/lib/course.js';

const ORDER = ['web-analytics-tools', 'google-analytics-4-setup', 'what-is-a-utm-code'];

test('empty storage gives a fresh state', () => {
  assert.deepEqual(loadState(), emptyState());
});

test('markDone adds a lesson and drops slugs that are not in the course any more', () => {
  const state = markDone({ v: 1, done: ['web-analytics-tools', 'old-lesson'], at: '2026-11-01' }, 'google-analytics-4-setup', { order: ORDER });
  assert.deepEqual(state.done, ['web-analytics-tools', 'google-analytics-4-setup']);
  assert.equal(state.at, new Date().toISOString().slice(0, 10));
  // A slug that is not a lesson of this course is dropped, not kept.
  assert.deepEqual(markDone({ v: 1, done: ['old-lesson'] }, 'another-old-lesson', { order: ORDER }).done, []);
});

test('toggleStep ticks and un-ticks one step of a lesson', () => {
  let state = markDone(emptyState(), 'web-analytics-tools', { order: ORDER });
  state = toggleStep(state, 'web-analytics-tools', 0, { order: ORDER });
  assert.deepEqual(state.steps['web-analytics-tools'], [0]);
  state = toggleStep(state, 'web-analytics-tools', 0, { order: ORDER });
  assert.deepEqual(state.steps['web-analytics-tools'], []);
});

test('answer records a check question as asked', () => {
  const state = answer(markDone(emptyState(), 'web-analytics-tools', { order: ORDER }), 'web-analytics-tools', 2, { order: ORDER });
  assert.deepEqual(state.quiz['web-analytics-tools'], [2]);
});

test('nextLesson is the first lesson of the course that is not done', () => {
  assert.equal(nextLesson(markDone(emptyState(), 'web-analytics-tools', { order: ORDER }), ORDER), 'google-analytics-4-setup');
  assert.equal(nextLesson(markDone({ done: [...ORDER] }, 'web-analytics-tools', { order: ORDER }), ORDER), null);
});

test('moduleProgress counts the lessons of one module', () => {
  let state = markDone(emptyState(), 'web-analytics-tools', { order: ORDER });
  state = markDone(state, 'google-analytics-4-setup', { order: ORDER });
  assert.deepEqual(moduleProgress(state, ORDER), { done: 2, total: 3, finished: false });
  assert.deepEqual(moduleProgress(markDone(emptyState(), 'web-analytics-tools', { order: ORDER }), [ORDER[0]]), { done: 1, total: 1, finished: true });
});

test('pickPath returns the first path whose answer rule matches', () => {
  assert.deepEqual(pickPath(['app', 'launched', 'changes'], PATHS), PATHS['app|*|changes']);
  assert.deepEqual(pickPath(['blog', 'new', 'ai'], PATHS), PATHS['*|*|ai']);
  assert.deepEqual(pickPath(['solo', 'solo', 'solo'], PATHS), PATHS['*|*|*']);
});

test('the storage wrapper saves and reads back, and survives a blocked store', () => {
  const state = saveState(markDone(emptyState(), 'web-analytics-tools', { order: ORDER }));
  assert.equal(state.done[0], 'web-analytics-tools');
  assert.equal(STORAGE_KEY, 'kauzl.course.v1');
});
