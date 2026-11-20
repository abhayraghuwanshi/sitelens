import { useEffect, useState } from 'preact/hooks';
import { formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useTodos, todoApi, NewTodo, TodoData, WriteUp, TodoGoal, CHANGED } from '../components/Todos.jsx';
import { Page } from './Page.jsx';
import { Drawer, hrefWith } from './Drawer.jsx';
import { hrefFor } from './nav.js';

// Inbox: what is waiting on you, for one site or every site. Alerts (what
// moved) and to-dos (changes to make) in one list, newest first; read alerts
// and done to-dos fold away under "Earlier". An item opens in the drawer
// (?open=<id>): a to-do as its thread (who did what, the change, why, what to
// expect), an alert with what it saw. Adding a to-do is its own view (?add=1).
const FILTERS = [['all', 'All'], ['alerts', 'Alerts'], ['todos', 'To-dos'], ['goals', 'Goals']];
// Goals you set on pages, by where they stand. All shows the ones behind.
const GOAL_STATES = [['behind', 'Behind', 'down'], ['on-track', 'On track', 'up'], ['waiting', 'Not measured yet', 'muted'], ['reached', 'Reached', 'up']];
const goalValue = (g, v) => (v === null || v === undefined ? '—' : g.metric === 'position' ? `#${Math.round(v * 10) / 10}` : ['ctr', 'rate', 'engagement'].includes(g.metric) ? `${(v * 100).toFixed(1)}%` : Math.round(v).toLocaleString('en-US'));
const alertsChanged = () => dispatchEvent(new Event('alerts-changed'));
const day = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// MCP clients by the name they give in `initialize`.
const CLIENTS = {
  'claude-code': ['Claude Code', 'C', 'claude'], 'claude-ai': ['Claude Desktop', 'C', 'claude'], claude: ['Claude', 'C', 'claude'],
  cursor: ['Cursor', 'Cu', 'ink'], 'cursor-vscode': ['Cursor', 'Cu', 'ink'], chatgpt: ['ChatGPT', 'G', 'gpt'], openai: ['ChatGPT', 'G', 'gpt'],
  windsurf: ['Windsurf', 'W', 'ink'], vscode: ['VS Code', 'VS', 'ink'], zed: ['Zed', 'Z', 'ink'],
};
export function agentOf(e) {
  if (e.author !== 'claude') return { name: 'You', short: 'Y', tone: 'you', mcp: false };
  const known = CLIENTS[(e.client || '').toLowerCase()];
  return { name: known?.[0] || e.client || 'Claude', short: known?.[1] || 'C', tone: known?.[2] || 'claude', model: e.model, mcp: true };
}

export function Agent({ entry, small = false }) {
  const a = agentOf(entry);
  return (
    <span class={`nx-agent ${a.tone}`}>
      <span class="nx-av" aria-hidden="true">{a.short}</span><b>{a.name}</b>
      {!small && a.model && <small>{a.model}</small>}
      {!small && a.mcp && <small class="nx-via">via MCP</small>}
    </span>
  );
}

// Where a to-do stands, from its write-ups.
function stageOf(t) {
  if (t.status === 'done') return ['Done', 'up'];
  const last = t.entries?.at(-1);
  if (last?.author === 'claude') return [last.changes ? 'Needs your look' : 'Has a write-up', 'warn'];
  if (t.entries?.length) return ['In progress', ''];
  return ['Not started', 'muted'];
}
const lastAt = (t) => Math.max(t.createdAt || 0, t.doneAt || 0, ...(t.entries || []).map((e) => e.at || 0));

export function Inbox({ site, sites, tab, params, counts, goals }) {
  const scope = site ? site.id : 'all';
  const filter = FILTERS.some(([k]) => k === tab) ? tab : 'all';
  const feed = useAsync(() => api.get(`/alerts${qs(site ? { site: site.id } : {})}`), [site?.id]);
  const todos = useTodos(site ? { site: site.id } : {});
  const [earlier, setEarlier] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    const reload = () => feed.reload();
    addEventListener('alerts-changed', reload);
    return () => removeEventListener('alerts-changed', reload);
  }, [feed.reload]);

  const open = params.get('open') || '';
  const close = () => { location.hash = hrefWith('open', '').slice(1); };

  if (params.get('add')) {
    return (
      <Page title="Add a to-do" sub={site ? `A change to make on ${site.label}` : 'A change to make'} back={{ href: hrefWith('add', ''), label: 'Inbox' }}>
        <section class="card card-plain nx-form-view">
          <NewTodo site={site} onAdded={(t) => { location.hash = `${hrefFor(scope, 'inbox', 'todos').slice(1)}&open=${t.id}`; }} />
          <p class="note">Add it here, or from a page’s timeline or Diagnose. Tick it off when the change is live: it goes on the Timeline that day, so the charts show whether it helped. An agent with the Kauzl MCP can pick it up and post what it found and changed.</p>
        </section>
      </Page>
    );
  }

  const run = async (kind, fn, say) => {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await fn();
      const text = say?.(r);
      if (text) setMsg(text);
      alertsChanged();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  const loading = !feed.data || !todos.data;
  const groups = feed.data ? grouped(feed.data.alerts) : [];
  const items = [
    ...groups.map((g) => ({ kind: 'alert', id: g[0].id, at: g[0].at, done: g.every((a) => a.read), group: g })),
    ...(todos.data?.todos || []).map((t) => ({ kind: 'todo', id: t.id, at: lastAt(t), done: t.status === 'done', todo: t })),
  ].sort((a, b) => b.at - a.at);
  const shown = items.filter((x) => filter === 'all' || (filter === 'alerts' ? x.kind === 'alert' : x.kind === 'todo'));
  const myGoals = (goals.data || []).filter((g) => !site || g.site === site.id);
  const behind = myGoals.filter((g) => g.status === 'behind');
  const now = shown.filter((x) => !x.done);
  const past = shown.filter((x) => x.done);
  // Rows waiting, once loaded (alerts on the same thing count once); the sidebar's counts until then.
  const waitingOf = (kind) => items.filter((x) => !x.done && x.kind === kind).length;
  const count = loading ? { all: counts.alerts + counts.todos + behind.length, alerts: counts.alerts, todos: counts.todos, goals: myGoals.length }
    : { all: waitingOf('alert') + waitingOf('todo') + behind.length, alerts: waitingOf('alert'), todos: waitingOf('todo'), goals: myGoals.length };
  const goalRow = (g) => <GoalRow key={`${g.site}:${g.path}`} g={g} site={!site && sites.find((s) => s.id === g.site)} />;
  const opened = items.find((x) => x.id === open);
  const failed = feed.data?.lastRun?.errors?.length || 0;

  const row = (x) => <Row key={x.id} item={x} labels={feed.data?.labels || {}} site={!site && sites.find((s) => s.id === (x.todo?.site || x.group?.[0].site))} on={open === x.id} />;

  return (
    <Page title="Inbox" sub={site ? `What is waiting on you for ${site.label}` : 'What is waiting on you, on every site'}
      actions={(
        <>
          <button type="button" class="nx-icon-btn" title="Check for new alerts now" aria-label="Check for new alerts now" disabled={Boolean(busy)}
            onClick={() => run('check', () => api.post('/alerts/run', { digest: true }), (r) => `Checked: ${r.fired.length ? `${r.fired.length} new` : 'nothing new'}${r.errors.length ? `, ${r.errors.length} source${r.errors.length === 1 ? '' : 's'} failed` : ''}.`)}>
            <Icon name="refresh" size={15} />
          </button>
          <a class="nx-icon-btn" href="#/alerts?view=settings" title="Alert settings" aria-label="Alert settings"><Icon name="bell" size={15} /></a>
          <a class="btn primary" href={hrefWith('add', '1')}><Icon name="plus" size={13} /> To-do</a>
        </>
      )}>
      <div class="nx-chips" role="group" aria-label="Show">
        {FILTERS.map(([k, l]) => (
          <a key={k} class={`nx-chip${filter === k ? ' on' : ''}`} href={hrefFor(scope, 'inbox', k === 'all' ? '' : k)} aria-current={filter === k ? 'true' : undefined}>
            {l} <span>{count[k]}</span>
          </a>
        ))}
      </div>
      {feed.data && !feed.data.settings.enabled && (
        <a class="nx-note-line warn" href="#/alerts?view=settings"><Icon name="bell" size={14} /><span><b>Alerts are paused.</b> Nothing is checked in the background.</span><span class="nx-go">Turn on →</span></a>
      )}
      {msg && <p class="muted small m-0" role="status">{msg}</p>}
      {feed.error ? <ErrorState error={feed.error} onRetry={feed.reload} />
        : todos.error ? <ErrorState error={todos.error} onRetry={todos.reload} />
        : loading ? <Loading height={240} />
        : (
          <>
            {filter === 'goals' ? (
              myGoals.length ? GOAL_STATES.map(([k, l]) => {
                const list = myGoals.filter((g) => g.status === k);
                return list.length ? <section key={k} class="nx-inbox" aria-label={l}><h2 class="nx-label-sm nx-ibh">{l} · {list.length}</h2>{list.map(goalRow)}</section> : null;
              }) : (
                <p class="nx-empty">No goals set yet. Open a page from <a href={site ? `#/site/${site.id}/pages` : '#/pages'}>Pages</a> and save its next goal: it shows here, behind or on track, until it’s reached.</p>
              )
            ) : (
            <div class="nx-inbox">
              {filter === 'all' && behind.map(goalRow)}
              {now.length || (filter === 'all' && behind.length) ? now.map(row) : <p class="nx-empty">Nothing waiting{filter === 'alerts' ? ' in alerts' : filter === 'todos' ? ' in to-dos' : ''}.{filter !== 'alerts' && <> <a href={hrefWith('add', '1')}>Add a to-do</a></>}</p>}
            </div>
            )}
            {filter !== 'goals' && past.length > 0 && (
              <>
                <button type="button" class="todo-link nx-earlier" aria-expanded={earlier} onClick={() => setEarlier(!earlier)}>
                  {earlier ? 'Hide earlier' : `Earlier · ${past.length} read or done`}
                </button>
                {earlier && <div class="nx-inbox earlier">{past.map(row)}</div>}
              </>
            )}
            <p class="muted small m-0">
              {feed.data.lastRun ? `Last checked ${formatRelative(feed.data.lastRun.at)}` : 'Not checked yet'} · GitHub and Web Store hourly, GA4 and Search Console daily
              {failed ? <> · <a href={hrefWith('open', 'checks')}>{failed} source{failed === 1 ? '' : 's'} couldn’t be read</a></> : null}
            </p>
          </>
        )}

      {opened?.kind === 'todo' && <TodoThread todo={opened.todo} sites={sites} onClose={close} />}
      {opened?.kind === 'alert' && (
        <AlertPanel group={opened.group} label={feed.data.labels[opened.group[0].rule]} site={sites.find((s) => s.id === opened.group[0].site)} onClose={close}
          onRead={() => run('read', () => api.post('/alerts/read', { ids: opened.group.map((a) => a.id) }))} />
      )}
      {open === 'checks' && feed.data && (
        <Drawer title="Sources that couldn’t be read" onClose={close}>
          <ul class="nx-plain-list">{feed.data.lastRun?.errors?.map((e) => <li key={e}>{e}</li>)}</ul>
          <p class="muted small">Most of these clear up once the sign-in behind them works again: <a href="#/account">Account</a>.</p>
        </Drawer>
      )}
    </Page>
  );
}

// The same rule on the same thing is one row: the newest alert, earlier ones inside.
function grouped(alerts) {
  const groups = new Map();
  for (const a of alerts) {
    const key = `${a.rule}:${a.subject?.type}:${a.subject?.id}:${a.site}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  return [...groups.values()];
}

function Row({ item, labels, site, on }) {
  if (item.kind === 'alert') {
    const a = item.group[0];
    const up = a.direction === 'up';
    return (
      <a class={`nx-msg${on ? ' on' : ''}${item.done ? ' read' : ''}`} href={hrefWith('open', item.id)}>
        <span class={`nx-k ${up ? 'up' : 'down'}`} aria-label={up ? 'Went up' : 'Went down'}><Icon name="bell" size={14} /></span>
        <span class="nx-mt">{site && <span class="nx-tag">{site.label}</span>}{a.title}</span>
        <small>{[labels[a.rule], formatRelative(a.at), item.group.length > 1 && `${item.group.length - 1} earlier`].filter(Boolean).join(' · ')}</small>
      </a>
    );
  }
  const t = item.todo;
  const [stage, tone] = stageOf(t);
  const last = t.entries?.at(-1);
  return (
    <a class={`nx-msg${on ? ' on' : ''}${item.done ? ' read' : ''}`} href={hrefWith('open', item.id)}>
      <span class="nx-k k-todo"><Icon name="check" size={14} /></span>
      <span class="nx-mt">{site && <span class="nx-tag">{site.label}</span>}{t.title} <span class={`nx-pill ${tone}`}>{stage}</span></span>
      <small>{last ? `${agentOf(last).name} · ${day(last.at)}` : `To-do · added ${day(t.createdAt)}`}{t.entries?.length > 1 ? ` · ${t.entries.length} write-ups` : ''}</small>
    </a>
  );
}

// A goal saved on a page: where it is now, against where it's going, and by when.
function GoalRow({ g, site }) {
  const state = GOAL_STATES.find(([k]) => k === g.status) || GOAL_STATES[2];
  const due = new Date(`${g.checkBy}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <a class="nx-msg nx-goalmsg" href={`#/site/${g.site}/pages?article=${encodeURIComponent(g.path)}`}>
      <span class="nx-k goal"><Icon name="target" size={14} /></span>
      <span class="nx-mt">{site && <span class="nx-tag">{site.label}</span>}<b>{g.title}</b>: {g.goal} <span class={`nx-pill ${state[2]}`}>{state[1]}</span></span>
      <span class="nx-gbar">
        {g.share !== null && <span class="nx-prog"><i style={`width:${Math.round(g.share * 100)}%`} /></span>}
        <small>{g.now !== null ? `now ${goalValue(g, g.now)}, aiming` : 'Aiming'} for {goalValue(g, g.to)} · {g.status === 'reached' ? 'reached' : `check by ${due}`}</small>
      </span>
    </a>
  );
}

function AlertPanel({ group, label, site, onClose, onRead }) {
  const [a, ...earlier] = group;
  const external = a.link?.startsWith('http');
  const iso = new Date(a.at).toISOString().slice(0, 10);
  return (
    <Drawer title={a.title} onClose={onClose}>
      <p class="nx-lead-line"><span class={`nx-pill ${a.direction === 'up' ? 'up' : 'down'}`}>{a.direction === 'up' ? 'Up' : 'Down'}</span> {label || 'Alert'} · {formatRelative(a.at)}{site ? ` · ${site.label}` : ''}</p>
      {a.detail && <p class="nx-big">{a.detail}</p>}
      <div class="nx-btns">
        {a.link && <a class="btn primary" href={a.link} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>Open what moved</a>}
        {site && <a class="btn" href={`#/site/${site.id}/timeline?month=${iso.slice(0, 7)}&day=${iso}`}>See the day</a>}
        {!group.every((x) => x.read) && <button type="button" class="btn" onClick={onRead}>{group.length > 1 ? 'Mark all read' : 'Mark read'}</button>}
      </div>
      {earlier.length > 0 && (
        <div class="nx-drawer-sec">
          <h3 class="nx-label-sm">Earlier · {earlier.length}</h3>
          <ol class="nx-hist">{earlier.map((x) => <li key={x.id}><span class="muted">{day(x.at)}</span><span>{x.title}</span></li>)}</ol>
        </div>
      )}
    </Drawer>
  );
}

// A to-do as a thread: one line on where it stands, the latest change (what
// changed, why, what to expect), what to do next, and the history folded.
function TodoThread({ todo: t, sites, onClose }) {
  const [hist, setHist] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const site = sites.find((s) => s.id === t.site);
  const report = [...(t.entries || [])].reverse().find((e) => e.changes || e.summary || e.expected);
  const done = t.status === 'done';
  const [stage, tone] = stageOf(t);
  const ask = `Work on Kauzl to-do ${t.id}: read it with get_todo, make the change, and post what you found, changed and expect with report_todo.`;
  const run = (fn) => fn().catch((err) => setError(err.message));
  const copy = () => { navigator.clipboard?.writeText(ask); setCopied(true); };

  return (
    <Drawer title={t.title} onClose={onClose}>
      <p class="nx-lead-line">
        {done ? <><span class="nx-pill up">Done</span> {day(t.doneAt)}, marked on the Timeline</>
          : report ? <><Agent entry={report} small /> {report.author === 'claude' ? (report.changes ? 'made or proposes a change' : 'wrote up what it found') : 'added a note'} · {day(report.at)}</>
          : <><span class={`nx-pill ${tone}`}>{stage}</span> made {day(t.createdAt)}{site ? ` · ${site.label}` : ''}</>}
      </p>

      {report ? (
        <div class="nx-report">
          {report.changes && <div class="nx-change"><span class="nx-tl">Changed</span><span class="nx-now">{report.changes}</span></div>}
          {report.summary && <p class="nx-why">{report.summary}</p>}
          {report.expected && <p class="nx-expect"><b>Expect</b> {report.expected}</p>}
          {report.author === 'claude' && (report.client || report.model) && <p class="muted small m-0"><Agent entry={report} /></p>}
        </div>
      ) : (
        <>
          {t.detail && <p class="nx-why">{t.detail}</p>}
          {!done && t.from?.startsWith('goal:') && <TodoGoal todo={t} />}
          {!done && (
            <div class="nx-hand">
              <span class="muted small">Hand it to an agent with the Kauzl MCP</span>
              <div class="todo-ask"><code>{ask}</code><button type="button" class="btn" onClick={copy}>{copied ? 'Copied' : 'Copy prompt'}</button></div>
            </div>
          )}
        </>
      )}

      <div class="nx-btns">
        <button type="button" class={`btn${report && !done ? ' primary' : ''}`} onClick={() => run(() => todoApi.update(t.id, { status: done ? 'open' : 'done' }))}>
          {done ? 'Reopen' : 'Mark done: it’s live'}
        </button>
        {t.link && <a class="btn" href={t.link} {...(t.link.startsWith('https:') ? { target: '_blank', rel: 'noreferrer' } : {})}>Open the page</a>}
        {report && !done && <button type="button" class="btn ghost" onClick={copy}>{copied ? 'Prompt copied' : 'Send back to an agent'}</button>}
      </div>
      {error && <p class="nx-error small" role="alert">{error}</p>}

      <div class="nx-tfoot">
        <button type="button" class="todo-link" aria-expanded={hist} onClick={() => setHist(!hist)}>{hist ? 'Hide history' : `History · ${(t.entries?.length || 0) + 1}`}</button>
        <button type="button" class="todo-link" aria-expanded={numbers} onClick={() => setNumbers(!numbers)}>{numbers ? 'Hide the numbers' : 'The numbers behind it'}</button>
        <button type="button" class="todo-link" onClick={() => run(async () => { await todoApi.remove(t.id); onClose(); })}>Delete</button>
      </div>
      {hist && (
        <ol class="nx-hist">
          <li><span class="muted">{day(t.createdAt)}</span><span>Made{t.from ? ` from ${t.from.split(':')[0]}` : ''}</span></li>
          {(t.entries || []).map((e) => (
            <li key={e.id}><span class="muted">{day(e.at)}</span><span>{agentOf(e).name} · {(e.changes || e.summary || e.expected || '').split(/(?<=\.)\s/)[0]}</span></li>
          ))}
          {done && <li><span class="muted">{day(t.doneAt)}</span><span>Marked done</span></li>}
        </ol>
      )}
      {numbers && <Numbers id={t.id} site={t.site} />}
      <WriteUp id={t.id} />
    </Drawer>
  );
}

function Numbers({ id, site }) {
  const d = useAsync(() => api.get(`/todos/${id}${qs({ site })}`), [id, site]);
  useEffect(() => {
    const reload = () => d.reload();
    addEventListener(CHANGED, reload);
    return () => removeEventListener(CHANGED, reload);
  }, [d.reload]);
  if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Loading height={80} owl label="Reading the numbers behind this to-do…" />;
  return d.data.context ? <div class="todo-details"><TodoData c={d.data.context} /></div> : <p class="muted small">No numbers tied to this one.</p>;
}
