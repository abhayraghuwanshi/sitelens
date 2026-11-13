import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo, useTodos } from '../components/Todos.jsx';
import { PageDetail } from './SearchHub.jsx';

// All pages (server/page-review.mjs): every page with what it earns from
// people, search and AI, a suggestion, and your decision. Pages nobody visits
// and search doesn't show are there too: they come from the sitemap and repo.
// A row opens the page itself (the article editor), where PageVerdict shows the
// suggestion, your decision and index status next to its goal and searches.
export const LABELS = {
  cut: 'Merge or remove', 'improve-content': 'Improve the content', 'improve-title': 'Rewrite title and description',
  'not-found': 'Not found in search', watch: 'Small but alive', new: 'Too new to judge', keep: 'Keep', needed: 'Keep: needed',
};
export const TONE = { cut: 'bad', 'improve-content': 'warn', 'improve-title': 'warn', 'not-found': 'warn', watch: 'idle', new: 'idle', keep: 'good', needed: 'good' };
const DECISIONS = [
  { key: '', label: 'Not decided' },
  { key: 'keep', label: 'Keep' },
  { key: 'improve', label: 'Improve' },
  { key: 'merge', label: 'Merge into…' },
  { key: 'remove', label: 'Remove' },
];
const num = (v) => (v ? formatNumber(v) : <span class="muted">0</span>);

// `range`: the period the numbers cover (the Pages tab's switch). Suggestions
// and goals are judged on 90 days whatever it is.
export function PageReview({ site, range = '90d' }) {
  const [only, setOnly] = useState('');
  const [all, setAll] = useState(false);
  const data = useAsync((o) => api.get(`/sites/${site.id}/page-review${qs({ range, fresh: o?.fresh ? 1 : undefined })}`), [site.id, range]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) {
    return (
      <>
        <p class="note">Reading every page: the sitemap, GA4, Google and Bing, and the site’s repo. The first time takes up to a minute; after that it opens at once and refreshes in the background.</p>
        <Loading height={420} />
      </>
    );
  }
  const d = data.data;
  const matching = d.rows.filter((r) => !only || (only === 'decided' ? r.decision : r.suggestion === only));
  // The pages that most need a decision come first; the rest are a click away.
  const rows = all ? matching : matching.slice(0, 20);
  const order = Object.keys(LABELS).filter((k) => d.counts[k]);
  const notes = Object.entries(d.notes || {}).filter(([, v]) => v);

  return (
    <>
      <div class="review-head">
        <p class="note m-0">
          {d.rows.length} pages{d.sources.sitemap ? `, ${d.sources.sitemap} from the sitemap` : ''}. Numbers cover {d.period?.label || 'the last 90 days'}{d.period?.search ? ` (search: ${d.period.search})` : ''}. Suggestions are judged on 90 days of visits, Google{d.sources.bing ? ', Bing' : ''} and AI, so a quiet day doesn’t change them; the decision is yours.
          {' '}<button class="btn ghost" type="button" title="Read the sitemap, GA4, Google and Bing again" onClick={() => data.reload({ fresh: true })} disabled={data.loading}><Icon name="refresh" size={12} /> Refresh</button>
        </p>
      </div>
      {notes.length > 0 && <p class="note">{notes.map(([k, v]) => v).join(' ')}</p>}

      <div class="review-chips" role="group" aria-label="Filter by suggestion">
        <button type="button" class={`rv-chip${!only ? ' on' : ''}`} onClick={() => setOnly('')}>All <b>{d.rows.length}</b></button>
        {order.map((k) => (
          <button type="button" key={k} class={`rv-chip tone-${TONE[k]}${only === k ? ' on' : ''}`} onClick={() => setOnly(only === k ? '' : k)}>{LABELS[k]} <b>{d.counts[k]}</b></button>
        ))}
        <button type="button" class={`rv-chip${only === 'decided' ? ' on' : ''}`} onClick={() => setOnly(only === 'decided' ? '' : 'decided')}>Decided <b>{d.decided}</b></button>
      </div>

      <Card flush>
        <div class="table-wrap">
          <table class="data review">
            <thead>
              <tr>
                <th>Page</th>
                <th class="num" title="Visits that started on this page">Visits</th>
                <th class="num" title="Share of those visits that engaged">Stayed</th>
                <th class="num" title="Search impressions · clicks, Google and Bing together">Search</th>
                <th class="num" title="Average position in Google">Pos.</th>
                <th class="num" title="Visits sent by ChatGPT, Perplexity and other assistants">AI</th>
                <th>Suggestion</th>
                <th>Your decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                  <tr key={r.path} class="clickable" title="Open the page: its goal, searches, to-dos and index status"
                    onClick={() => { location.hash = `/site/${site.id}/pages?article=${encodeURIComponent(r.path)}`; }}>
                    <td class="cell-path">
                      <div class="review-page">{r.title || <code>{r.path}</code>}</div>
                      {r.title && <code class="small muted">{r.path}</code>}
                      {!r.inSitemap && <span class="rv-tag warn">not in sitemap</span>}
                    </td>
                    <td class="num" data-label="Visits">{num(r.visits)}</td>
                    <td class="num" data-label="Stayed">{r.visits ? formatPercent(r.engagementRate, 0) : '—'}</td>
                    <td class="num" data-label="Search" title={`Google ${formatNumber(r.google?.impressions || 0)} · ${formatNumber(r.google?.clicks || 0)}, Bing ${formatNumber(r.bing?.impressions || 0)} · ${formatNumber(r.bing?.clicks || 0)}`}>
                      {r.google || r.bing ? <>{num((r.google?.impressions || 0) + (r.bing?.impressions || 0))} <span class="muted">· {formatNumber((r.google?.clicks || 0) + (r.bing?.clicks || 0))}</span></> : <span class="muted">—</span>}
                    </td>
                    <td class="num" data-label="Pos.">{r.google?.position ? formatDecimal(r.google.position, 1) : '—'}</td>
                    <td class="num" data-label="AI">{num(r.ai)}</td>
                    <td class="cell-suggest"><span class={`rv-tag ${TONE[r.suggestion]}`}>{LABELS[r.suggestion]}</span>{r.goal?.target && <span class="rv-goal" title={`Goal: ${r.goal.target.title}`}>{r.goal.progress?.reached ? '✓ goal' : 'goal set'}</span>}</td>
                    <td class="cell-decide" onClick={(e) => e.stopPropagation()}><DecisionSelect site={site} row={r} onSaved={data.reload} /></td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
        {matching.length > rows.length && (
          <button type="button" class="btn ghost" style={{ margin: '8px 16px' }} onClick={() => setAll(true)}>Show all {matching.length} pages</button>
        )}
        {all && matching.length > 20 && (
          <button type="button" class="btn ghost" style={{ margin: '8px 16px' }} onClick={() => setAll(false)}>Show the top 20</button>
        )}
      </Card>
    </>
  );
}

export function DecisionSelect({ site, row, onSaved }) {
  const [busy, setBusy] = useState(false);
  const save = async (decision) => {
    setBusy(true);
    try {
      await api.post(`/sites/${site.id}/page-decisions`, { path: row.path, decision, note: row.decision?.note || '', mergeInto: row.decision?.mergeInto || '' });
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <select value={row.decision?.decision || ''} disabled={busy} aria-label={`Decision for ${row.path}`} onChange={(e) => save(e.currentTarget.value)}>
      {DECISIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

// The top of a page's view: the suggestion and why, your decision (with a note,
// where to merge it, and a to-do), and whether Google and Bing have it indexed.
// The page's row from All pages (the same 90 days), for its view.
export function usePageRow(site, path, range = '90d') {
  return useAsync(() => api.get(`/sites/${site.id}/page-goal${qs({ path, range })}`), [site.id, path, range]);
}

export function PageVerdict({ site, path, page: d }) {
  const todos = useTodos({ site: site.id });
  if (d.error || !d.data) return null;
  const row = d.data;
  return (
    <Card>
      <div class="verdict">
        <div class="verdict-why">
          <span class={`rv-tag ${TONE[row.suggestion]}`}>{LABELS[row.suggestion]}</span>
          <span class="small">{row.reason}</span>
        </div>
        <div class="verdict-decide">
          <span class="small muted">Your decision</span>
          <DecisionSelect site={site} row={row} onSaved={d.reload} />
        </div>
      </div>
      {row.decision && <DecisionNote site={site} row={row} todo={(todos.data?.todos || []).find((t) => t.from === `page:${row.path}`)} onSaved={d.reload} />}
      <PageDetail site={site} path={path} links={false} />
    </Card>
  );
}

export function DecisionNote({ site, row, todo, onSaved }) {
  const dec = row.decision.decision;
  const [note, setNote] = useState(row.decision.note || '');
  const [into, setInto] = useState(row.decision.mergeInto || '');
  const [msg, setMsg] = useState('');
  const save = async () => {
    setMsg('');
    try {
      await api.post(`/sites/${site.id}/page-decisions`, { path: row.path, decision: dec, note, mergeInto: into });
      onSaved();
    } catch (err) {
      setMsg(err.message);
    }
  };
  const task = dec === 'merge' ? `Merge ${row.path} into ${into || 'a related page'} and redirect it`
    : dec === 'remove' ? `Remove ${row.path} and redirect it to a related page`
    : dec === 'improve' ? `${row.suggestion === 'improve-title' ? 'Rewrite the title and description of' : row.suggestion === 'not-found' ? 'Get Google and Bing to show' : 'Improve the content of'} ${row.path}`
    : '';
  return (
    <div class="review-decision">
      {dec === 'merge' && <input type="text" value={into} placeholder="Into, e.g. /blog/best-launchers-windows" aria-label="Merge into page" onInput={(e) => setInto(e.currentTarget.value)} onBlur={() => into !== (row.decision.mergeInto || '') && save()} />}
      <input type="text" value={note} placeholder="Why (optional)" aria-label="Decision note" onInput={(e) => setNote(e.currentTarget.value)} onBlur={() => note !== (row.decision.note || '') && save()} />
      {task && <AddTodo site={site} added={todo} class="btn" label="To-do"
        todo={{ title: task, detail: [row.reason, note].filter(Boolean).join(' '), link: `#/site/${site.id}/pages?article=${encodeURIComponent(row.path)}`, from: `page:${row.path}`, subject: { kind: 'search', key: row.path } }} />}
      {msg && <span class="small muted">{msg}</span>}
    </div>
  );
}
