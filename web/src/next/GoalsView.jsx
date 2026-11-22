import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Spark } from './Timeline.jsx';
import { Results } from './Results.jsx';
import { Sources, GoalsMeasured } from './Outcomes.jsx';
import { formatNumber } from '@shared/format.js';

// Goals: one page for "is it working". What the visits led to (GA4 events on the
// site, store installs and downloads, the app's own numbers), what each page is
// for and whether it serves that, then who converts. Where people drop off lives
// in Journeys; what stands out on a day, in the Timeline and Inbox.
const SOURCE = { d1: 'Your database', github: 'GitHub', cws: 'Chrome Web Store', ga4: 'GA4 event', firebase: 'Firebase', http: 'Any URL', manual: 'Typed in' };
const SERVING = { yes: ['Serving it', 'up'], partly: ['Partly', 'warn'], no: ['Not yet', 'down'] };
const fmt = (v) => (v === null || v === undefined ? '—' : formatNumber(v));

export function GoalsView({ site, range }) {
  const products = useAsync(() => api.get('/products').catch(() => null), []);
  const product = products.data?.products?.find((p) => p.siteId === site.id);
  const outUrl = products.data ? (product ? `/outcomes/${product.id}` : `/sites/${site.id}/outcomes`) : '';
  const out = useAsync((o) => (outUrl ? api.get(`${outUrl}${qs({ range, fresh: o?.fresh })}`).catch(() => null) : null), [outUrl, range]);
  const metrics = useAsync(() => api.get(`/sites/${site.id}/metrics${qs({ range })}`), [site.id, range]);
  const pages = useAsync(() => api.get(`/sites/${site.id}/page-review${qs({ range: '90d' })}`), [site.id]);
  const list = metrics.data?.metrics || [];
  const goals = (pages.data?.rows || []).filter((r) => r.goal).sort((a, b) => Number(Boolean(b.goal.target)) - Number(Boolean(a.goal.target)) || b.visits - a.visits);

  // Where the goals come from, and one obvious way to set them: the site's own form (its Goals step),
  // or, when the repo's .sitelens.yml sets them, the editor for that file.
  const g = out.data?.goals;
  const fromFile = g?.from === 'file';

  return (
    <div class="nx-goals-view">
      {/* What everything below is measured against: one line, unfolds to the goals (Edit goals is in the header). */}
      {g && (g.list.length || g.custom || fromFile
        ? <GoalsMeasured d={out.data} site={site} noEdit onRefresh={() => out.reload({ fresh: true })} refreshing={out.loading} />
        : <p class="nx-goalsrc"><Icon name="target" size={14} /><span><b>No goals yet.</b> Use Edit goals to pick what counts as a result (a sign-up, a download, a purchase).</span></p>)}
      <Results site={site} range={range} n="" title="Outcomes" more={false} usage={false} />
      {list.length > 0 && (
        <section class="nx-block" aria-label="Your numbers">
          <h2 class="nx-h2">Who keeps using it <span class="nx-h2-sub">your app’s own numbers, from your database or the site’s .sitelens.yml</span></h2>
          <div class="nx-mgrid">
            {list.map((m) => <MetricCard key={m.id} m={m} />)}
            <a class="nx-mcard nx-madd" href="#/account?i=metrics&edit=new">
              <Icon name="plus" size={18} /><b>Add a metric</b>
              <small>A number from your database, or one the site’s .sitelens.yml declares.</small>
            </a>
          </div>
        </section>
      )}

      <section class="nx-block" aria-label="Page goals">
        <h2 class="nx-h2">Page goals <span class="nx-h2-sub">what each page is for, and the next step up</span></h2>
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

      {out.data && <Sources d={out.data} />}

      {site.modes?.warehouse && (
        <a class="nx-note-line" href={`#/site/${site.id}/journeys`}>
          <Icon name="route" size={14} /><span><b>Where people drop off</b> on the way to each goal is in Journeys.</span><span class="nx-go">Open →</span>
        </a>
      )}

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
