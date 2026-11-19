import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { LABELS, TONE } from '../pages/PageReview.jsx';

// All pages: one line per page, by its title: one status word, its visits,
// its search clicks, and what its best search would add in the top 3. The
// page's own view (its searches, goal, changes, decision) is a click away.
const SHORT = { cut: 'Cut', 'improve-content': 'Improve', 'improve-title': 'New title', 'not-found': 'Not in search', watch: 'Small', new: 'Too new', keep: 'Working', needed: 'Needed' };
const TONE_PILL = { bad: 'down', warn: 'warn', idle: 'muted', good: 'up' };
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const ctrAt = (p) => (p == null ? 0 : p <= 1.5 ? 0.28 : p <= 2.5 ? 0.15 : p <= 3.5 ? 0.11 : p <= 5.5 ? 0.07 : p <= 10.5 ? 0.03 : p <= 20.5 ? 0.01 : 0.002);
const SORTS = [{ key: 'visits', label: 'Most visits' }, { key: 'chance', label: 'Biggest chance' }];

// Its best chance: the search that would add most in the top 3.
function chanceOf(r) {
  let best = null;
  for (const q of r.google?.queries || []) {
    if (!q.position || q.position <= 3.5) continue;
    const gain = Math.round((q.impressions || 0) * Math.max(0, ctrAt(3) - ctrAt(q.position)));
    if (!best || gain > best.gain) best = { query: q.query, gain };
  }
  return best;
}

export function PagesList({ site, range }) {
  const [only, setOnly] = useState('');
  const [sort, setSort] = useState('visits');
  const [all, setAll] = useState(false);
  const data = useAsync((o) => api.get(`/sites/${site.id}/page-review${qs({ range, fresh: o?.fresh ? 1 : undefined })}`), [site.id, range]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={360} owl label="Reading every page: the sitemap, GA4, Google and Bing…" />;
  const d = data.data;
  const rows = d.rows.map((r) => ({ ...r, chance: chanceOf(r), clicks: (r.google?.clicks || 0) + (r.bing?.clicks || 0) }));
  const order = Object.keys(LABELS).filter((k) => d.counts[k]);
  const list = rows
    .filter((r) => !only || r.suggestion === only)
    .sort((a, b) => (sort === 'chance' ? (b.chance?.gain || 0) - (a.chance?.gain || 0) : b.visits - a.visits || b.clicks - a.clicks));
  const shown = all ? list : list.slice(0, 25);
  const href = (r) => `#/site/${site.id}/pages?article=${encodeURIComponent(r.path)}`;

  return (
    <div class="nx-pages">
      <div class="nx-row-between">
        <div class="nx-chips" role="group" aria-label="Show">
          <button type="button" class={`nx-chip${!only ? ' on' : ''}`} onClick={() => setOnly('')}>All <span>{d.rows.length}</span></button>
          {order.map((k) => (
            <button type="button" key={k} class={`nx-chip${only === k ? ' on' : ''}`} title={LABELS[k]} onClick={() => setOnly(only === k ? '' : k)}>{SHORT[k]} <span>{d.counts[k]}</span></button>
          ))}
        </div>
        <Segmented label="Sort" value={sort} options={SORTS} onChange={setSort} />
      </div>
      <div class="card card-plain nx-tight">
        <div class="nx-prow nx-phead" aria-hidden="true"><span>Page</span><span>Now</span><span class="nx-num">Visits</span><span class="nx-num">Search clicks</span><span class="nx-num">In the top 3</span></div>
        {shown.map((r) => (
          <a key={r.path} class="nx-prow" href={href(r)} title={r.path}>
            <span class="nx-ob"><b>{r.title || r.path}</b>{r.title && <small class="muted">{r.path}{!r.inSitemap ? ' · not in the sitemap' : ''}</small>}</span>
            <span><span class={`nx-pill ${TONE_PILL[TONE[r.suggestion]] || ''}`} title={r.reason}>{SHORT[r.suggestion] || r.suggestion}</span></span>
            <span class="nx-num">{fmt(r.visits)}</span>
            <span class="nx-num">{r.google || r.bing ? fmt(r.clicks) : <span class="muted">—</span>}</span>
            <span class={`nx-num ${r.chance?.gain >= 10 ? 'good' : 'muted'}`} title={r.chance ? `“${r.chance.query}”` : ''}>{r.chance?.gain >= 10 ? `+${fmt(r.chance.gain)}` : '—'}</span>
          </a>
        ))}
        {list.length > 25 && <button type="button" class="todo-link nx-more-rows" onClick={() => setAll(!all)}>{all ? 'Show the top 25' : `Show all ${list.length} pages`}</button>}
      </div>
      <p class="muted small m-0">
        {d.rows.length} pages{d.sources?.sitemap ? `, ${d.sources.sitemap} from the sitemap` : ''}; numbers cover {d.period?.label || 'the period'}, the word is judged on 90 days.
        “In the top 3” is the extra visits its best search would bring there (an estimate).{' '}
        <button type="button" class="todo-link" onClick={() => data.reload({ fresh: true })} disabled={data.loading}><Icon name="refresh" size={11} /> Read again</button>
      </p>
    </div>
  );
}
