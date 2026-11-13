import { useEffect, useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from './ui.jsx';
import { Icon } from './icons.jsx';

// To-dos: changes you mean to make (server/todos.mjs). Anything that changes one
// tells the rest of the page, so the sidebar count and other lists keep up.
const CHANGED = 'studio:todos';
const changed = () => dispatchEvent(new Event(CHANGED));
const short = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const isoDay = (ms) => new Date(ms).toLocaleDateString('en-CA');

// GET /todos, reloaded whenever a to-do changes anywhere on the page.
export function useTodos(params = {}) {
  const key = qs(params);
  const list = useAsync(() => api.get(`/todos${key}`), [key]);
  useEffect(() => {
    const reload = () => list.reload();
    addEventListener(CHANGED, reload);
    return () => removeEventListener(CHANGED, reload);
  }, [list.reload]);
  return list;
}

export const todoApi = {
  add: (todo) => api.post('/todos', todo).then((t) => (changed(), t)),
  update: (id, patch) => api.post(`/todos/${id}`, patch).then((t) => (changed(), t)),
  remove: (id) => api.del(`/todos/${id}`).then((r) => (changed(), r)),
};

// "Add to to-dos" for something Studio suggested; once added, a link to the list.
export function AddTodo({ site, todo, added, label = 'Add to to-dos', class: cls = 'nx-btn' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (added) {
    return <a class={`${cls.replace(" primary", "")} done`} href={`#/site/${site.id}/todos`}>{added.status === 'done' ? `✓ Done ${short(added.doneAt)}` : '✓ In your to-dos'}</a>;
  }
  const add = async () => {
    setBusy(true);
    setError('');
    try {
      await todoApi.add({ site: site.id, ...todo });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" class={cls} disabled={busy} onClick={add}><Icon name="plus" size={13} /> {busy ? 'Adding…' : label}</button>
      {error && <span class="nx-error small" role="alert">{error}</span>}
    </>
  );
}

// A one-line form: what needs doing, plus optional details.
export function NewTodo({ site, link = '', placeholder = 'What needs doing? e.g. Rewrite the intro of /blog/raycast-alternatives-windows' }) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await todoApi.add({ title, detail, site: site?.id || '', link });
      setTitle('');
      setDetail('');
      setMore(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form class="todo-new" onSubmit={submit}>
      <div class="todo-new-row">
        <input type="text" value={title} placeholder={placeholder} aria-label="New to-do" maxLength={200}
          onInput={(e) => setTitle(e.currentTarget.value)} />
        <button type="submit" class="nx-btn primary" disabled={busy || !title.trim()}><Icon name="plus" size={13} /> {busy ? 'Adding…' : 'Add'}</button>
      </div>
      {more
        ? <textarea rows={3} value={detail} placeholder="Details: what to change, why, links…" aria-label="Details" onInput={(e) => setDetail(e.currentTarget.value)} />
        : <button type="button" class="todo-link" onClick={() => setMore(true)}>+ Add details</button>}
      {error && <p class="nx-error" role="alert">{error}</p>}
    </form>
  );
}

// One to-do: tick it off, open where the work is, edit or delete it.
function TodoItem({ todo, sites, showSite }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [detail, setDetail] = useState(todo.detail || '');
  const [error, setError] = useState('');
  const done = todo.status === 'done';
  const site = sites?.find((s) => s.id === todo.site);
  const run = (fn) => fn().catch((err) => setError(err.message));

  if (editing) {
    return (
      <li class="todo editing">
        <form class="todo-new" onSubmit={(e) => { e.preventDefault(); run(async () => { await todoApi.update(todo.id, { title, detail }); setEditing(false); }); }}>
          <input type="text" value={title} maxLength={200} aria-label="To-do" onInput={(e) => setTitle(e.currentTarget.value)} />
          <textarea rows={3} value={detail} placeholder="Details" aria-label="Details" onInput={(e) => setDetail(e.currentTarget.value)} />
          <div class="todo-new-row">
            <button type="submit" class="nx-btn primary">Save</button>
            <button type="button" class="nx-btn" onClick={() => { setEditing(false); setTitle(todo.title); setDetail(todo.detail || ''); }}>Cancel</button>
          </div>
          {error && <p class="nx-error" role="alert">{error}</p>}
        </form>
      </li>
    );
  }
  return (
    <li class={`todo${done ? ' done' : ''}`}>
      <input type="checkbox" checked={done} aria-label={done ? `Reopen “${todo.title}”` : `Mark “${todo.title}” done`}
        onChange={() => run(() => todoApi.update(todo.id, { status: done ? 'open' : 'done' }))} />
      <div class="todo-body">
        <span class="todo-title">{todo.title}</span>
        {todo.detail && (
          <span class={`todo-detail${long ? '' : ' clamped'}`} title={long ? '' : 'Show all'} onClick={() => setLong(!long)}>{todo.detail}</span>
        )}
        <span class="todo-meta">
          {showSite && site && <span>{site.label}</span>}
          {done
            ? <a href={`#/site/${todo.site}/timeline?month=${isoDay(todo.doneAt).slice(0, 7)}&day=${isoDay(todo.doneAt)}`}>Done {short(todo.doneAt)}, marked on the Timeline</a>
            : <span>Added {short(todo.createdAt)}</span>}
          {todo.link && <a href={todo.link} {...(todo.link.startsWith('https:') ? { target: '_blank', rel: 'noreferrer' } : {})}>Open <Icon name="chevron" size={11} /></a>}
          <button type="button" class="todo-link" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide details' : `Details${todo.entries?.length ? ` · ${todo.entries.length} write-up${todo.entries.length === 1 ? '' : 's'}` : ''}`}
          </button>
          <button type="button" class="todo-link" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" class="todo-link" onClick={() => run(() => todoApi.remove(todo.id))}>Delete</button>
        </span>
        {error && <span class="nx-error small" role="alert">{error}</span>}
        {open && <TodoDetails id={todo.id} site={todo.site} />}
      </div>
    </li>
  );
}

// The data behind a to-do (server/todo-context.mjs) and its write-ups, plus the
// line to hand it to Claude in a terminal (the MCP server reads the same thing).
function TodoDetails({ id, site }) {
  // The site goes along so a to-do on a site shared with you opens too (hosted).
  const d = useAsync(() => api.get(`/todos/${id}${qs({ site })}`), [id, site]);
  useEffect(() => {
    const reload = () => d.reload();
    addEventListener(CHANGED, reload);
    return () => removeEventListener(CHANGED, reload);
  }, [d.reload]);
  if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Loading height={80} />;
  const { todo, context: c } = d.data;
  const ask = `Work on SiteLens to-do ${todo.id}: read it with get_todo, and post what you found, changed and expect with report_todo.`;
  return (
    <div class="todo-details">
      {c && <TodoData c={c} />}
      <div class="todo-section">
        <span class="nx-label-sm">Write-ups</span>
        {todo.entries?.length ? (
          <ol class="todo-entries">
            {todo.entries.map((e) => (
              <li key={e.id}>
                <span class="todo-meta"><b>{e.author === 'claude' ? 'Claude' : 'You'}</b> · {new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {e.summary && <p><b>Found:</b> {e.summary}</p>}
                {e.changes && <p><b>Changed:</b> {e.changes}</p>}
                {e.expected && <p><b>Should happen:</b> {e.expected}</p>}
              </li>
            ))}
          </ol>
        ) : <p class="nx-dim small">None yet. Add yours below, or ask Claude to work on it.</p>}
        <WriteUp id={todo.id} />
      </div>
      <div class="todo-section">
        <span class="nx-label-sm">Ask Claude in a terminal</span>
        <div class="todo-ask">
          <code>{ask}</code>
          <button type="button" class="nx-btn" onClick={() => navigator.clipboard?.writeText(ask)}>Copy</button>
        </div>
      </div>
    </div>
  );
}

const num = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '–');
const delta = (r) => {
  const d = (r.value || 0) - (r.previous || 0);
  return <span class={d > 0 ? 'good' : d < 0 ? 'bad' : 'nx-dim'}>{d > 0 ? '+' : ''}{num(d)}</span>;
};

function Rows({ title, note, rows, cols }) {
  if (!rows?.length) return null;
  return (
    <div class="todo-section">
      <span class="nx-label-sm">{title}</span>
      {note && <span class="nx-dim small">{note}</span>}
      <table class="todo-table">
        <thead><tr>{cols.map(([label]) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([label, cell]) => <td key={label}>{cell(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const MOVED = [['', (r) => r.key], ['Now', (r) => num(r.value)], ['Before', (r) => num(r.previous)], ['Change', delta]];
const SEARCHES = [['Search', (r) => r.query], ['Clicks', (r) => num(r.clicks)], ['Impressions', (r) => num(r.impressions)], ['CTR', (r) => `${r.ctr}%`], ['Position', (r) => r.position]];

function TodoData({ c }) {
  if (c.note) return <p class="nx-dim small">{c.note}</p>;
  const main = c.source || c.page || c.query;
  const t = c.searchTotals;
  const added = c.whenAdded;
  return (
    <>
      <div class="todo-section">
        <span class="nx-label-sm">The numbers · {c.period.from} to {c.period.to}, against {c.period.comparedWith}</span>
        {main && <p><b>{main.key}</b>: {num(main.value)} {c.query ? 'search clicks' : 'visits'}, {num(main.previous)} before ({delta(main)}).</p>}
        {t && <p>In Google: {num(t.clicks)} clicks from {num(t.impressions)} impressions, {t.ctr}% CTR, average position {t.position}.</p>}
        {added && <p class="nx-dim small">When added: {Object.entries(added).filter(([k]) => !['from', 'to'].includes(k)).map(([k, v]) => `${k} ${typeof v === 'number' ? num(v) : v}`).join(' · ')}{added.from ? ` (${added.from} to ${added.to})` : ''}</p>}
        {c.sinceDone && <p class="todo-since">{c.sinceDone.value !== undefined ? <><b>Since done:</b> {num(c.sinceDone.value)} {c.sinceDone.metric} in {c.sinceDone.days} days, against {num(c.sinceDone.before)} in the {c.sinceDone.days} days before.</> : c.sinceDone.note}</p>}
        {c.finding && <p>{c.finding.title ? <><b>{c.finding.title}</b> {c.finding.detail} {c.finding.action && <>Do: {c.finding.action}</>}</> : c.finding.note}</p>}
      </div>
      <Rows title="Searches that moved" note={c.searchesThatMoved?.note} rows={c.searchesThatMoved?.rows} cols={MOVED} />
      <Rows title="Pages that moved" note={c.pagesThatMoved?.note} rows={c.pagesThatMoved?.rows} cols={MOVED} />
      <Rows title="Google searches it shows up for" rows={c.searches} cols={SEARCHES} />
      <Rows title="Pages that rank for it" rows={c.pagesRanking} cols={[['Page', (r) => r.path], ...SEARCHES.slice(1)]} />
    </>
  );
}

function WriteUp({ id }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ summary: '', changes: '', expected: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return <button type="button" class="todo-link" onClick={() => setOpen(true)}>+ Add a write-up</button>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.currentTarget.value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/todos/${id}/entries`, form);
      changed();
      setForm({ summary: '', changes: '', expected: '' });
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form class="todo-new" onSubmit={save}>
      <textarea rows={2} value={form.summary} placeholder="What you found" aria-label="What you found" onInput={set('summary')} />
      <textarea rows={2} value={form.changes} placeholder="What you changed (files, PR, old → new title)" aria-label="What you changed" onInput={set('changes')} />
      <textarea rows={2} value={form.expected} placeholder="What should happen, and when to look again" aria-label="What should happen" onInput={set('expected')} />
      <div class="todo-new-row">
        <button type="submit" class="nx-btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save write-up'}</button>
        <button type="button" class="nx-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p class="nx-error" role="alert">{error}</p>}
    </form>
  );
}

export function TodoList({ todos, sites, showSite = false, empty }) {
  const open = todos.filter((t) => t.status === 'open');
  const done = todos.filter((t) => t.status === 'done');
  const [showDone, setShowDone] = useState(false);
  return (
    <>
      {open.length ? (
        <ul class="todos">{open.map((t) => <TodoItem key={t.id + t.status} todo={t} sites={sites} showSite={showSite} />)}</ul>
      ) : <p class="nx-dim">{empty}</p>}
      {done.length > 0 && (
        <>
          <button type="button" class="todo-link" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide' : 'Show'} {done.length} done
          </button>
          {showDone && <ul class="todos">{done.map((t) => <TodoItem key={t.id + t.status} todo={t} sites={sites} showSite={showSite} />)}</ul>}
        </>
      )}
    </>
  );
}

// The page: one site's to-dos (or every site's), with a form on top.
export function TodosPage({ site, sites }) {
  const list = useTodos(site ? { site: site.id } : {});
  return (
    <>
      <section class="nx-card">
        <NewTodo site={site} />
        <p class="nx-note">Add them here, from “What to do next” on the Story, or from an article. Tick one off when the change is live: it goes on the Timeline that day, so the charts show whether it helped.</p>
      </section>
      <section class="nx-card" aria-label="To-dos">
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
          : !list.data ? <Loading height={120} />
          : <TodoList todos={list.data.todos} sites={sites} showSite={!site} empty="Nothing to do yet." />}
      </section>
    </>
  );
}

// For the article editor: this article's to-dos, and a quick way to add one.
export function ArticleTodos({ site, path }) {
  const link = `#/site/${site.id}/articles?article=${encodeURIComponent(path)}`;
  const list = useTodos({ site: site.id });
  const mine = (list.data?.todos || []).filter((t) => t.link === link || t.title.includes(path));
  return (
    <div class="todo-card">
      {list.data && <TodoList todos={mine} empty="Nothing to do on this article yet." />}
      <NewTodo site={site} link={link} placeholder="Add a change to make" />
      <a class="nx-more" href={`#/site/${site.id}/todos`}>All to-dos for {site.label} <Icon name="chevron" size={12} /></a>
    </div>
  );
}
