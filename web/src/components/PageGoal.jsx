import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading } from './ui.jsx';
import { AddTodo, useTodos, GoalHistory } from './Todos.jsx';
import { value, span, goalTodo } from '../../../shared/goal-format.js';

export { value };

// A page's goal (server/page-goals.mjs): what it's for, whether it does that,
// and the next realistic target, which you can set and then track. Kept to a
// few lines: the reasoning folds away under "How to get there".
const PURPOSES = [
  { key: 'search', label: 'Bring visitors from search' },
  { key: 'convert', label: 'Turn visitors into users' },
  { key: 'help', label: 'Help people who arrive' },
];
const SERVING = { yes: 'good', partly: 'warn', no: 'bad' };
const CURVE = 'Estimated with a generic click-rate-by-position curve: a way to size a target, not a forecast.';
const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// "+52 clicks a month" when the goal is sized in clicks, else its own words.
const worth = (n) => (n.gainValue !== undefined ? `+${Math.round(n.gainValue).toLocaleString('en-US')} clicks a month` : n.gain);

export function GoalPanel({ site, path, goal, onSaved, close = [] }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const todos = useTodos({ site: site.id });
  const post = async (what, body) => {
    setBusy(what);
    setError('');
    try {
      await api.post(`/sites/${site.id}/page-goals`, { path, ...body });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };
  const n = goal.next;
  const t = goal.target;
  const p = goal.progress;
  const shown = t || n;
  const key = `goal:${path}:${shown.key}`;
  const added = (todos.data?.todos || []).find((x) => x.from === key);
  const todo = t ? goalTodo(t, path, site.id) : { ...goalTodo(n, path, site.id), detail: `${n.why} ${n.how}` };

  return (
    <div class="page-goal">
      <div class="page-goal-row">
        <select value={goal.purpose} disabled={busy === 'purpose'} aria-label="What this page is for" onChange={(e) => post('purpose', { purpose: e.currentTarget.value })}>
          {PURPOSES.map((o) => <option key={o.key} value={o.key}>{o.label}{!goal.chosen && o.key === goal.purpose ? ' (guessed)' : ''}</option>)}
        </select>
        <span class={`goal-serving ${SERVING[goal.serving]}`}><i aria-hidden="true" />{goal.servingText}</span>
      </div>

      <div class={`goal-box${t ? ' tracked' : ''}`}>
        <div class="goal-head">
          <span class="small muted">{t ? `Your goal, set ${day(t.setAt)}` : 'Next goal'}</span>
          <span class="small muted">check by {day(shown.checkBy)}</span>
        </div>
        <b class="goal-title">{shown.title}</b>
        {t && p ? (
          <>
            <div class="goal-bar" role="progressbar" aria-valuenow={Math.round(p.share * 100)} aria-valuemin="0" aria-valuemax="100" aria-label="Progress toward the goal">
              <span style={{ width: `${Math.round(p.share * 100)}%` }} />
            </div>
            <p class="goal-line">{span(t.metric, t.from, t.to, goal.days)} · now {value(t.metric, p.now)}{p.reached && <b class="good"> · reached</b>}</p>
          </>
        ) : t ? (
          <p class="goal-line muted">{span(t.metric, t.from, t.to, goal.days)} · no numbers for it yet this period</p>
        ) : (
          <p class="goal-line">
            {n.metric !== 'clicks' && <>{span(n.metric, n.from, n.to, goal.days)} · </>}
            <span class="good" title={n.gainValue !== undefined ? CURVE : ''}>{worth(n)}</span>
          </p>
        )}
        <div class="goal-actions">
          {t
            ? (p?.reached
              ? <button type="button" class="btn primary" disabled={Boolean(busy)} onClick={() => post('next', { set: 'next' })}>Set the next goal</button>
              : <button type="button" class="btn ghost" disabled={Boolean(busy)} onClick={() => post('clear', { clear: true })}>Drop it</button>)
            : <button type="button" class="btn primary" disabled={Boolean(busy)} onClick={() => post('next', { set: 'next' })}>{busy === 'next' ? 'Setting…' : 'Set as the goal'}</button>}
          <AddTodo site={site} added={added} class="btn" label="To-do" todo={todo} />
        </div>
        {!t && (
          <details class="goal-more">
            <summary>How to get there</summary>
            <p>{n.why}</p>
            <p>{n.how}</p>
          </details>
        )}
        <details class="goal-more">
          <summary>Past goals for this page</summary>
          <GoalHistory siteId={site.id} path={path} goal={goal} />
        </details>
        {close.length > 0 && (
          <details class="goal-more">
            <summary>{close.length} other search{close.length === 1 ? '' : 'es'} close to winning</summary>
            <ul>{close.map((c) => <li key={c.query}><b>{c.query}</b> · {c.text}</li>)}</ul>
          </details>
        )}
      </div>
      {goal.note && <p class="small muted">{goal.note}</p>}
      {error && <p class="small text-bad">{error}</p>}
    </div>
  );
}

// The article editor's goal card: loads the page's goal on its own. `close`:
// the article's other near-win searches, folded into the card.
export function ArticleGoal({ site, path, close = [] }) {
  const d = useAsync(() => api.get(`/sites/${site.id}/page-goal${qs({ path })}`), [site.id, path]);
  if (d.error) return <p class="small muted">{d.error.message}</p>;
  if (!d.data) return <Loading height={120} />;
  const main = d.data.goal?.target?.query || d.data.goal?.next?.query;
  return <GoalPanel site={site} path={path} goal={d.data.goal} onSaved={d.reload} close={close.filter((c) => c.query !== main)} />;
}
