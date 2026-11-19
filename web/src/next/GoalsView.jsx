import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Spark } from './Timeline.jsx';
import { formatNumber } from '@shared/format.js';

// Goals: every number you're trying to move, as the same card whatever it
// comes from (source tag, value, change, its line, progress to a target),
// then what each page is for and whether it serves that, then a way into
// Results (what visits led to) and Journeys (where people drop off).
const SOURCE = { d1: 'Your database', github: 'GitHub', cws: 'Chrome Web Store', ga4: 'GA4 event', firebase: 'Firebase', http: 'Any URL', manual: 'Typed in' };
const SERVING = { yes: ['Serving it', 'up'], partly: ['Partly', 'warn'], no: ['Not yet', 'down'] };
const fmt = (v) => (v === null || v === undefined ? '—' : formatNumber(v));

export function GoalsView({ site, range }) {
  const metrics = useAsync(() => api.get(`/sites/${site.id}/metrics${qs({ range })}`), [site.id, range]);
  const pages = useAsync(() => api.get(`/sites/${site.id}/page-review${qs({ range: '90d' })}`), [site.id]);
  const list = metrics.data?.metrics || [];
  const goals = (pages.data?.rows || []).filter((r) => r.goal).sort((a, b) => Number(Boolean(b.goal.target)) - Number(Boolean(a.goal.target)) || b.visits - a.visits);

  return (
    <div class="nx-goals-view">
      <section class="nx-block" aria-label="Your numbers">
        <h2 class="nx-h2">Your numbers <span class="muted small">· from your database, the site’s .sitelens.yml, or set up in Account</span></h2>
        {metrics.error ? <ErrorState error={metrics.error} onRetry={metrics.reload} /> : !metrics.data ? <Loading height={160} /> : (
          <div class="nx-mgrid">
            {list.map((m) => <MetricCard key={m.id} m={m} />)}
            <a class="nx-mcard nx-madd" href="#/account?i=metrics&edit=new">
              <Icon name="plus" size={18} /><b>Add a metric</b>
              <small>A number from your database, or one the site’s .sitelens.yml declares. Claude can write it for you with the MCP setup_site prompt.</small>
            </a>
          </div>
        )}
      </section>

      <section class="nx-block" aria-label="Page goals">
        <h2 class="nx-h2">Page goals <span class="muted small">· what each page is for, and the next step up</span></h2>
        {pages.error ? <ErrorState error={pages.error} onRetry={pages.reload} /> : !pages.data ? <Loading height={160} /> : goals.length ? (
          <div class="card card-plain nx-tight">
            {goals.slice(0, 8).map((r) => {
              const [word, tone] = SERVING[r.goal.serving] || ['', 'muted'];
              const share = r.goal.progress?.share;
              return (
                <a key={r.path} class="nx-pgrow" href={`#/site/${site.id}/pages?article=${encodeURIComponent(r.path)}`}>
                  <span class="nx-ob"><b>{r.title || r.path}</b><small class="muted">{r.goal.purposeLabel} · {r.goal.target ? `your goal: ${r.goal.target.title || r.goal.next?.title}` : `next: ${r.goal.next?.title || '—'}`}</small></span>
                  {share != null
                    ? <span class="nx-prog" title={`${Math.round(share * 100)}% of the way`}><i style={`width:${Math.round(share * 100)}%`} /></span>
                    : <span />}
                  <span class={`nx-pill ${tone}`}>{r.goal.progress?.reached ? 'Reached' : word}</span>
                </a>
              );
            })}
            <p class="muted small m-0">Each page’s goal is set on the page itself; open one to change it.</p>
          </div>
        ) : <p class="nx-empty">No pages with a goal yet.</p>}
      </section>

      <div class="nx-cards2">
        <a class="card card-plain nx-linkcard" href={`#/site/${site.id}/goals?tab=results`}>
          <span class="nx-label-sm">Results</span>
          <span>What {site.label}’s visits led to: downloads, installs, sign-ups, and what to do about it.</span>
          <span class="nx-go">See results →</span>
        </a>
        {site.modes?.warehouse && (
          <a class="card card-plain nx-linkcard" href={`#/site/${site.id}/journeys`}>
            <span class="nx-label-sm">Where people drop off</span>
            <span>The steps to each goal, and where people go instead, live in Journeys.</span>
            <span class="nx-go">Open Journeys →</span>
          </a>
        )}
      </div>
    </div>
  );
}

// One metric, the same card whatever its source.
function MetricCard({ m }) {
  const change = m.previous ? m.total / m.previous - 1 : null;
  const vals = m.values || [];
  return (
    <div class="nx-mcard">
      <span class="nx-mch">
        <span class="nx-msrc"><Icon name="database" size={12} />{SOURCE[m.source] || m.source}</span>
        {m.from === 'file' ? <span class="nx-yml">.sitelens.yml</span> : <a class="todo-link" href={`#/account?i=metrics&edit=${m.id}`}>Edit</a>}
      </span>
      <span class="nx-mname">{m.label}</span>
      {m.error ? (
        <span class="small bad">{m.error.message}{m.error.hint ? ` ${m.error.hint}` : ''}</span>
      ) : (
        <>
          <span class="nx-mval"><b>{fmt(m.total)}</b>{change !== null && <span class={change >= 0 ? 'good' : 'bad'}>{change >= 0 ? '+' : '−'}{Math.round(Math.abs(change) * 100)}%</span>}</span>
          {vals.length > 1 && <Spark vals={vals} dates={m.dates || m.range?.dates || []} unit={(m.unit || '').toLowerCase()} cls="goal" />}
          <small class="muted">{m.unit ? `${m.unit} · ` : ''}{{ sum: 'total', average: 'daily average', latest: 'latest day' }[m.summary || 'sum']} for the period</small>
        </>
      )}
    </div>
  );
}
