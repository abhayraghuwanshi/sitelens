// To-dos: the changes you mean to make, kept in studio.json `todos`. They're
// added by hand, from the Story's "What to do next", or from an article. Ticking
// one off puts a "Done:" note on the Timeline that day, so every chart shows
// when the change went out and whether it helped; reopening removes the note.
//
// Todo: { id, title, detail?, site?, link?, from?, subject?, baseline?, entries?, status: 'open' | 'done', createdAt, doneAt?, noteId? }
//   site: a site id; link: an in-app (#/…) or https link to where the work is;
//   from: what suggested it (e.g. 'search:/blog/x'), so a suggestion is only added once;
//   subject: what it's about ({ kind: source|page|query|search|outcome|posts, key }), so its
//     data can be shown with it (server/todo-context.mjs); baseline: the numbers when it was added;
//   entries: write-ups by you or Claude: { id, at, author, summary?, changes?, expected? }
//     (what was found, what was changed, what should happen).

import { randomUUID } from 'node:crypto';
import { ValidationError } from './store.mjs';

const TITLE_MAX = 200;
const DETAIL_MAX = 2000;
const SITE = /^[\w-]{1,64}$/;
const FROM = /^[\w:./#?&=%+@-]{1,300}$/;
const ENTRY_MAX = 3000;
const SUBJECTS = ['source', 'page', 'query', 'search', 'outcome', 'posts'];
const AUTHORS = ['you', 'claude'];
const isoDay = (ms) => new Date(ms).toLocaleDateString('en-CA');

// A few numbers and short strings, as the suggestion had them.
function cleanBaseline(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [k, v] of Object.entries(input).slice(0, 12)) {
    if (!/^\w{1,30}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.length <= 100) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function normalizeEntry(input = {}) {
  const pick = (k) => String(input[k] || '').trim();
  const entry = { summary: pick('summary'), changes: pick('changes'), expected: pick('expected') };
  if (!entry.summary && !entry.changes && !entry.expected) throw new ValidationError('Write what you found, what changed, or what should happen.');
  for (const [k, v] of Object.entries(entry)) {
    if (v.length > ENTRY_MAX) throw new ValidationError(`Keep each part under ${ENTRY_MAX} characters.`);
    if (!v) delete entry[k];
  }
  const author = String(input.author || 'you');
  if (!AUTHORS.includes(author)) throw new ValidationError(`Author must be one of: ${AUTHORS.join(', ')}.`);
  return { author, ...entry };
}

export function normalizeTodo(input = {}) {
  const title = String(input.title || '').trim().replace(/\s+/g, ' ');
  const detail = String(input.detail || '').trim();
  const site = String(input.site || '').trim();
  const link = String(input.link || '').trim();
  const from = String(input.from || '').trim();
  if (!title) throw new ValidationError('Write what needs doing.');
  if (title.length > TITLE_MAX) throw new ValidationError(`Keep the to-do under ${TITLE_MAX} characters; put the rest in the details.`);
  if (detail.length > DETAIL_MAX) throw new ValidationError(`Keep the details under ${DETAIL_MAX} characters.`);
  if (site && !SITE.test(site)) throw new ValidationError('That isn’t a site id.');
  if (link && !/^(#\/|https:\/\/)/.test(link)) throw new ValidationError('A link must be a page in Kauzl (#/…) or an https:// address.');
  if (from && !FROM.test(from)) throw new ValidationError('That isn’t a suggestion key.');
  const subject = input.subject && SUBJECTS.includes(input.subject.kind) && typeof input.subject.key === 'string' && input.subject.key.length <= 300
    ? { kind: input.subject.kind, key: input.subject.key } : null;
  const baseline = cleanBaseline(input.baseline);
  return {
    title, ...(detail ? { detail } : {}), ...(site ? { site } : {}), ...(link ? { link: link.slice(0, 500) } : {}), ...(from ? { from } : {}),
    ...(subject ? { subject } : {}), ...(baseline ? { baseline } : {}),
  };
}

// `context(todo)` → the data behind a to-do (server/todo-context.mjs), shown with it.
export function createTodos({ store, annotations, context = async () => null, now = () => Date.now() }) {
  // The Story's old "Start" button wrote "Started: …" notes; they become open to-dos once.
  async function importStarted() {
    if ((await store.get()).todosImported) return;
    await store.update((s) => {
      if (s.todosImported) return;
      const todos = s.todos || [];
      for (const n of s.annotations || []) {
        if ((n.author || 'you') !== 'you' || !n.label?.startsWith('Started: ')) continue;
        const site = n.scope?.startsWith('site:') ? n.scope.slice(5) : '';
        todos.push({
          id: `todo-${randomUUID().slice(0, 8)}`, title: n.label.slice(9), ...(n.body ? { detail: n.body } : {}),
          ...(site ? { site } : {}), status: 'open', createdAt: Date.parse(`${n.date}T12:00:00`) || now(),
        });
      }
      s.todos = todos;
      s.todosImported = true;
    });
  }

  async function list({ site = '', status = '' } = {}) {
    await importStarted();
    const all = (await store.get()).todos || [];
    const todos = all
      .filter((t) => (!site || t.site === site) && (!status || t.status === status))
      // Open first, newest first; done ones by when they were done.
      .sort((a, b) => (a.status === b.status ? (b.doneAt || b.createdAt) - (a.doneAt || a.createdAt) : a.status === 'open' ? -1 : 1));
    return { todos, open: all.filter((t) => t.status === 'open' && (!site || t.site === site)).length };
  }

  async function add(input) {
    const fields = normalizeTodo(input);
    let todo = null;
    await store.update((s) => {
      // The same suggestion again: hand back the one already there.
      todo = fields.from ? (s.todos || []).find((t) => t.from === fields.from && t.site === fields.site) : null;
      if (todo) return;
      todo = { id: `todo-${randomUUID().slice(0, 8)}`, ...fields, status: 'open', createdAt: now() };
      s.todos = [...(s.todos || []), todo];
    });
    return todo;
  }

  async function find(id) {
    const todo = ((await store.get()).todos || []).find((t) => t.id === id);
    if (!todo) throw new ValidationError('That to-do isn’t there any more.');
    return todo;
  }

  async function update(id, patch = {}) {
    const todo = await find(id);
    const next = { ...todo };
    if (patch.title !== undefined || patch.detail !== undefined || patch.link !== undefined) {
      const { subject, baseline, ...kept } = todo;
      const fields = normalizeTodo({ ...kept, ...patch });
      next.title = fields.title;
      next.link = fields.link;
      next.detail = fields.detail;
      if (!next.link) delete next.link;
      if (!next.detail) delete next.detail;
    }
    if (patch.status !== undefined && patch.status !== todo.status) {
      if (!['open', 'done'].includes(patch.status)) throw new ValidationError('A to-do is open or done.');
      next.status = patch.status;
      if (patch.status === 'done') {
        next.doneAt = now();
        // The Timeline note carries the latest write-up: what changed and what should happen.
        const last = (next.entries || []).at(-1);
        const body = last ? [last.changes && `Changed: ${last.changes}`, last.expected && `Expected: ${last.expected}`].filter(Boolean).join('\n') : next.detail || '';
        const note = await annotations.addNote({ date: isoDay(next.doneAt), label: `Done: ${next.title}`.slice(0, 140), scope: next.site ? `site:${next.site}` : '', body: body.slice(0, 4000) });
        next.noteId = note.id;
      } else {
        if (todo.noteId) await annotations.removeNote(todo.noteId).catch(() => {});
        delete next.doneAt;
        delete next.noteId;
      }
    }
    await store.update((s) => {
      s.todos = (s.todos || []).map((t) => (t.id === id ? next : t));
    });
    return next;
  }

  // A write-up: what was found, what changed, what should happen. With
  // `status: 'done'` it also ticks the to-do off (once the change is live).
  async function addEntry(id, input = {}) {
    await find(id);
    const entry = { id: `e-${randomUUID().slice(0, 8)}`, at: now(), ...normalizeEntry(input) };
    await store.update((s) => {
      s.todos = (s.todos || []).map((t) => (t.id === id ? { ...t, entries: [...(t.entries || []), entry] } : t));
    });
    if (input.status === 'done' || input.status === 'open') return update(id, { status: input.status });
    return find(id);
  }

  // One to-do with the data behind it, fresh.
  async function get(id) {
    const todo = await find(id);
    let data = null;
    try {
      data = await context(todo);
    } catch (err) {
      data = { errors: [err.message] };
    }
    return { todo, context: data };
  }

  // Deleting a done to-do leaves its Timeline note: the change still went out.
  async function remove(id) {
    await find(id);
    await store.update((s) => {
      s.todos = (s.todos || []).filter((t) => t.id !== id);
    });
    return { ok: true };
  }

  return { list, get, add, update, addEntry, remove };
}

export function todoRoutes({ todos }) {
  return [
    ['GET', /^\/api\/todos$/, async ({ query }) => todos.list({ site: query.get('site') || '', status: query.get('status') || '' })],
    ['POST', /^\/api\/todos$/, async ({ body }) => todos.add(body)],
    ['GET', /^\/api\/todos\/(todo-[\w]+)$/, async ({ match }) => todos.get(match[1])],
    ['POST', /^\/api\/todos\/(todo-[\w]+)$/, async ({ match, body }) => todos.update(match[1], body)],
    ['POST', /^\/api\/todos\/(todo-[\w]+)\/entries$/, async ({ match, body }) => todos.addEntry(match[1], body)],
    ['DELETE', /^\/api\/todos\/(todo-[\w]+)$/, async ({ match }) => todos.remove(match[1])],
  ];
}
