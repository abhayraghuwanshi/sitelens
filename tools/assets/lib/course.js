// The owl's course progress: the saved shape
// { v, done, steps, quiz, path, at } plus pure functions over it, and a thin
// storage wrapper. No DOM here, so the tests run it in Node as-is.

export const STORAGE_KEY = 'kauzl.course.v1';

export function emptyState() {
  return { v: 1, done: [], steps: {}, quiz: {}, path: {}, at: '' };
}

export const today = () => new Date().toISOString().slice(0, 10);

// Drop progress for slugs that are not lessons of the course any more.
export function prune(state, order = []) {
  const src = state || emptyState();
  const keep = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !order.length || order.includes(k)));
  return { ...src, done: [...new Set((src.done || []).filter((s) => !order.length || order.includes(s)))], steps: keep(src.steps), quiz: keep(src.quiz), path: src.path || {} };
}

// A lesson is done; the slug is dropped if it is not a lesson of this course.
export function markDone(state, slug, { order = [], at = today() } = {}) {
  const next = prune(state, order);
  if (order.length && !order.includes(slug)) return next;
  return { ...next, done: [...new Set([...next.done, slug])], at };
}

// Tick or un-tick one step of a lesson.
export function toggleStep(state, slug, index, { order = [] } = {}) {
  const next = prune(state, order);
  const list = [...(next.steps?.[slug] || [])];
  const i = list.indexOf(index);
  if (i >= 0) list.splice(i, 1); else list.push(index);
  return { ...next, steps: { ...(next.steps || {}), [slug]: list } };
}

// Record that a check question was answered (the owl finishes a lesson once all
// of a lesson's questions are asked).
export function answer(state, slug, question, { order = [] } = {}) {
  const next = prune(state, order);
  const asked = [...new Set([...(next.quiz?.[slug] || []), question])];
  return { ...next, quiz: { ...(next.quiz || {}), [slug]: asked } };
}

// The first lesson of the course that is not done yet, or null when done.
export function nextLesson(state, order = []) {
  const done = new Set(state?.done || []);
  for (const slug of order) if (!done.has(slug)) return slug;
  return null;
}

// { done, total, finished } for one module of the course.
export function moduleProgress(state, lessonSlugs) {
  const done = new Set(state?.done || []);
  const total = lessonSlugs.length;
  const finished = lessonSlugs.filter((s) => done.has(s)).length;
  return { done: finished, total, finished: total > 0 && finished === total };
}

// The owl picks a lesson path from the visitor's three answers. The key is
// `${building}|${stage}|${worry}`, '*' is a wildcard, first match wins.
export function pickPath(answers, paths) {
  const a = answers || [];
  const val = (v) => v ?? '';
  const hit = (rule, v) => rule === '*' || rule === val(v);
  for (const k of Object.keys(paths || {})) {
    const [b, s, w] = k.split('|');
    if (hit(b, a[0]) && hit(s, a[1]) && hit(w, a[2])) return paths[k];
  }
  return paths?.['*|*|*'] || [];
}

// Remember the visitor's picked path.
export function savePath(state, answers, slugs) {
  const next = { ...(state || emptyState()), path: { answers: answers || [], slugs: slugs || [] } };
  return next;
}

// Read the saved progress; a blocked or broken store means a fresh start.
export function loadState() {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem?.(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed, done: Array.isArray(parsed?.done) ? parsed.done : [], steps: parsed?.steps && typeof parsed.steps === 'object' ? parsed.steps : {}, quiz: parsed?.quiz && typeof parsed.quiz === 'object' ? parsed.quiz : {}, path: parsed?.path && typeof parsed.path === 'object' ? parsed.path : {} };
  } catch { return emptyState(); }
}

export function saveState(state) {
  try { if (typeof localStorage !== 'undefined' && localStorage.setItem) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked: progress just won't persist */ }
  return state;
}
