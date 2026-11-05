import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Segmented, Loading, ErrorState } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { Page } from './Page.jsx';

// One site's period as a story: what's failing, what happened, who brought the
// visits, where they landed, and what to do next. Each part is one sentence and
// a short list; "Explore" opens the full report behind it.
const RANGES = [{ key: '7d', label: '7 days' }, { key: '28d', label: '28 days' }, { key: '90d', label: '90 days' }];
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const short = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const today = () => new Date().toISOString().slice(0, 10);
const KIND_ICON = { deploy: 'rocket', release: 'github', post: 'megaphone', extension: 'puzzle', mention: 'chat', note: 'star', claude: 'sparkles' };

export function Story({ site, params }) {
  const [saved, setSaved] = usePersistent('storyRange', '28d');
  const wanted = params.get('range') || saved;
  const range = RANGES.some((r) => r.key === wanted) ? wanted : '28d';
  const pick = (key) => {
    setSaved(key);
    location.hash = `/site/${site.id}?range=${key}`;
  };

  const story = useAsync(() => api.get(`/sites/${site.id}/story${qs({ range })}`), [site.id, range]);
  const r = story.data?.range;
  const span = r ? { site: site.id, from: r.from, to: r.to } : null;
  const metrics = useAsync(() => (span ? api.get(`/calendar/metrics${qs(span)}`) : null), [span?.from, span?.to, site.id]);
  const sources = useAsync(() => (span ? api.get(`/calendar/breakdown${qs({ ...span, by: 'source', limit: 6 })}`) : null), [span?.from, span?.to, site.id]);
  const pages = useAsync(() => (span ? api.get(`/calendar/breakdown${qs({ ...span, by: 'page', limit: 5 })}`) : null), [span?.from, span?.to, site.id]);
  const marks = useAsync(() => (span ? api.get(`/annotations${qs({ from: span.from, to: span.to, scope: `site:${site.id}` })}`) : null), [span?.from, span?.to, site.id]);

  return (
    <Page title={site.label}
      sub={r ? `${short(r.from)} – ${short(r.to)}, against the ${range.replace('d', '')} days before · whole days only` : site.host}
      actions={<Segmented label="Period" value={range} options={RANGES} onChange={pick} />}>
      <NeedsYou site={site} />
      {story.error ? <ErrorState error={story.error} onRetry={story.reload} /> : !story.data ? <Loading height={260} /> : (
        <>
          <Traffic site={site} story={story.data} metrics={metrics.data} marks={marks.data?.annotations || []} />
          <Sources site={site} rows={sources.data?.rows} changes={story.data.changes} range={range} />
          <Landing site={site} rows={pages.data?.rows} range={range} />
          <NextSteps site={site} />
        </>
      )}
    </Page>
  );
}

// Shown only while something is wrong: this site's unread alerts, and setup that
// stops a part of the story from being told.
function NeedsYou({ site }) {
  const alerts = useAsync(() => api.get('/alerts?limit=100'), []);
  const ai = useAsync(() => api.get(`/ai-search/sites/${site.id}/checks`).catch(() => null), [site.id]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const items = (alerts.data?.alerts || [])
    .filter((a) => !a.read && a.at >= weekAgo && a.subject?.type === 'site' && a.subject.id === site.id)
    .slice(0, 4)
    .map((a) => ({ key: a.id, title: a.title, detail: a.detail, href: a.link }));
  if (ai.data && !ai.data.lastRun && ai.data.prompts?.length) {
    items.push({ key: 'ai', title: 'AI answer checks have never run.', detail: `${ai.data.prompts.length} questions are set up${ai.data.keySource ? '' : ' but no Anthropic key is set'}, so Studio can’t say whether assistants name you.`, href: `#/site/${site.id}/ai` });
  }
  if (!items.length) return null;
  return (
    <section class="nx-card nx-warn" aria-label="Needs you">
      <h2 class="nx-h2"><Icon name="triangle" size={16} /> {items.length === 1 ? '1 thing needs you' : `${items.length} things need you`}</h2>
      <ul class="nx-list">
        {items.map((i) => (
          <li key={i.key}><a href={i.href}><b>{i.title}</b> <span class="nx-dim">{i.detail}</span></a></li>
        ))}
      </ul>
    </section>
  );
}

function Traffic({ site, story, metrics, marks }) {
  const days = metrics?.days || [];
  const traffic = story.metric === 'sessions';
  return (
    <section class="nx-card" aria-label="Traffic">
      <SectionHead n="1" title="What happened" more={{ href: `#/site/${site.id}/timeline`, label: 'Timeline' }} />
      <p class={`nx-headline tone-${story.tone}`}>{story.headline}</p>
      {days.length > 1 && (
        <LineChart height={200}
          labels={days.map((d) => short(d.date))} dates={days.map((d) => d.date)}
          series={traffic
            ? [{ label: 'Visits', values: days.map((d) => d.sessions ?? NaN) }, { label: 'A usual day', values: days.map((d) => d.baseline ?? NaN) }]
            : [{ label: 'Search clicks', values: days.map((d) => d.clicks ?? NaN) }]}
          annotations={marks}
          onSelect={(i) => { location.hash = `/site/${site.id}/timeline?month=${days[i].date.slice(0, 7)}&day=${days[i].date}`; }} />
      )}
      <div class="nx-cols">
        <div>
          <div class="nx-label-sm">What moved it</div>
          {story.changes.length ? (
            <ul class="nx-list">
              {story.changes.map((c) => (
                <li key={c.kind + c.key}>
                  <a href={`#/site/${site.id}/${c.kind === 'query' ? 'search' : 'pages'}`}>{c.text}</a>
                  {c.cause && <Cause e={c.cause} lead="Around then" />}
                </li>
              ))}
            </ul>
          ) : <p class="nx-dim">No single source or page moved much.</p>}
        </div>
        <div>
          <div class="nx-label-sm">Days that stood out</div>
          {story.days.length ? (
            <ul class="nx-list">
              {story.days.map((d) => (
                <li key={d.date}>
                  <a href={`#/site/${site.id}/timeline?month=${d.date.slice(0, 7)}&day=${d.date}`}>{d.text}</a>
                  {d.events.map((e) => <Cause key={e.label + e.date} e={e} lead={e.date === d.date ? 'Same day' : 'Day before'} />)}
                  {!d.events.length && <span class="nx-cause nx-dim">Nothing you shipped around then.</span>}
                </li>
              ))}
            </ul>
          ) : <p class="nx-dim">Every day was close to a usual one for its weekday.</p>}
        </div>
      </div>
    </section>
  );
}

function Cause({ e, lead }) {
  const label = <><Icon name={KIND_ICON[e.kind] || 'star'} size={12} /> {lead}: {e.label}</>;
  return e.url
    ? <a class="nx-cause" href={e.url} target="_blank" rel="noreferrer">{label}</a>
    : <span class="nx-cause">{label}</span>;
}

function Sources({ site, rows, changes, range }) {
  if (!rows) return <section class="nx-card"><Loading height={160} /></section>;
  const max = Math.max(1, ...rows.map((r) => r.value || 0));
  const lead = changes.find((c) => c.kind === 'source');
  return (
    <section class="nx-card" aria-label="Who brings it">
      <SectionHead n="2" title="Who brings the visits" more={{ href: `#/site/${site.id}/pages?range=${range}`, label: 'All sources' }} />
      {lead && <p class="nx-lede">{lead.text}</p>}
      <div class="nx-table" role="table" aria-label="Visits by source">
        <div class="nx-tr nx-th" role="row"><span role="columnheader">Source</span><span role="columnheader">Visits</span><span role="columnheader">Change</span><span role="columnheader" aria-hidden="true" /></div>
        {rows.map((r) => (
          <div class="nx-tr" role="row" key={r.key}>
            <span role="cell"><b>{r.key}</b></span>
            <span role="cell" class="nx-num">{fmt(r.value)}</span>
            <span role="cell"><Change value={r.value} previous={r.previous} /></span>
            <span role="cell" class="nx-bar" aria-hidden="true"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <p class="nx-note">“Direct” is every visit without a referrer: typed links, app links and likely bots.</p>
    </section>
  );
}

function Landing({ site, rows, range }) {
  const search = useAsync(() => (site.modes?.search ? api.get(`/sites/${site.id}/search${qs({ range: '28d' })}`).catch(() => null) : null), [site.id]);
  if (!rows) return <section class="nx-card"><Loading height={160} /></section>;
  const top = search.data?.opportunities?.[0];
  return (
    <section class="nx-card" aria-label="Where they land">
      <SectionHead n="3" title="Where they land" more={{ href: `#/site/${site.id}/pages?range=${range}`, label: 'All pages' }} />
      <ul class="nx-rows">
        {rows.map((r) => (
          <li key={r.key}>
            <a href={`#/site/${site.id}/pages?range=${range}`}>
              <span class="nx-path">{capital(pageName(r.key))}</span>
              <span class="nx-num">{fmt(r.value)}</span>
              <Change value={r.value} previous={r.previous} />
            </a>
          </li>
        ))}
      </ul>
      {top && (
        <a class="nx-callout" href={`#/site/${site.id}/search`}>
          <Icon name="search" size={14} />
          <span>“{top.query}” is shown {fmt(top.impressions)} times at position {top.position.toFixed(1)}, but {(top.ctr * 100).toFixed(1)}% click. Last 28 days, from Search Console.</span>
        </a>
      )}
    </section>
  );
}

// Search Console's opportunities as actions. "Start" writes a note on the
// Timeline, so the day you acted sits on every chart from then on.
function NextSteps({ site }) {
  const search = useAsync(() => (site.modes?.search ? api.get(`/sites/${site.id}/search${qs({ range: '28d' })}`).catch(() => null) : null), [site.id]);
  const notes = useAsync(() => api.get(`/annotations${qs({ scope: `site:${site.id}`, author: 'you' })}`).catch(() => ({ annotations: [] })), [site.id]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const ops = byPage(search.data);
  if (!ops.length) return null;
  const started = new Map((notes.data?.annotations || []).filter((n) => n.label.startsWith('Started: ')).map((n) => [n.label.slice(9), n]));

  const title = (o) => o.type === 'low-ctr' && o.queries.length === 1
    ? `Win more clicks on “${o.queries[0].query}”`
    : `Rewrite the title and description of ${pageName(o.path)}`;
  const why = (o) => `${o.queries.map((q) => `“${q.query}”`).join(', ')}: shown ${fmt(o.impressions)} times at position ${o.position.toFixed(1)}; ${(o.ctr * 100).toFixed(1)}% click.`;
  const start = async (o) => {
    setBusy(o.path);
    setError('');
    try {
      await api.post('/annotations', { date: today(), label: `Started: ${title(o)}`.slice(0, 140), scope: `site:${site.id}`, body: why(o) });
      notes.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section class="nx-card nx-next" aria-label="What to do next">
      <SectionHead title="What to do next" more={{ href: `#/site/${site.id}/search`, label: 'All searches' }} />
      <p class="nx-dim">Ranked by the clicks each could win. Start one and it goes on the Timeline, so you can see whether it worked.</p>
      <div class="nx-actions">
        {ops.map((o, i) => {
          const done = started.get(title(o).slice(0, 131));
          return (
            <div class={`nx-action${done ? ' started' : ''}`} key={o.path}>
              <span class="nx-label-sm">{i + 1} · Get found</span>
              <b>{title(o)}</b>
              <span class="nx-dim">{why(o)}</span>
              <dl class="nx-kv"><dt>Worth</dt><dd class="good">about +{fmt(o.potential)} clicks a month</dd></dl>
              <div class="nx-action-row">
                <a class="nx-btn primary" href={`#/site/${site.id}/search`}>See the searches</a>
                {done
                  ? <a class="nx-btn done" href={`#/site/${site.id}/timeline?month=${done.date.slice(0, 7)}&day=${done.date}`}>✓ Started {short(done.date)}</a>
                  : <button type="button" class="nx-btn" disabled={busy === o.path} onClick={() => start(o)}>{busy === o.path ? 'Starting…' : 'Start'}</button>}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p class="nx-error" role="alert">{error}</p>}
    </section>
  );
}

// Search Console's opportunities, one per landing page: several searches that
// reach the same page are fixed by the same title and description.
function byPage(data) {
  if (!data?.opportunities?.length) return [];
  const pageOf = new Map();
  for (const qp of data.queryPages || []) if (!pageOf.has(qp.query) || pageOf.get(qp.query).impressions < qp.impressions) pageOf.set(qp.query, qp);
  const groups = new Map();
  for (const o of data.opportunities) {
    const path = pageOf.get(o.query)?.path || '';
    const g = groups.get(path) || { path, type: o.type, queries: [], impressions: 0, clicks: 0, weighted: 0, potential: 0 };
    g.queries.push(o);
    g.impressions += o.impressions;
    g.clicks += o.clicks;
    g.weighted += o.position * o.impressions;
    g.potential += o.potential || 0;
    if (o.type !== 'low-ctr') g.type = o.type;
    groups.set(path, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, position: g.weighted / Math.max(1, g.impressions), ctr: g.clicks / Math.max(1, g.impressions) }))
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 3);
}

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const pageName = (path) => (path === '/' ? 'the home page' : !path || path === '(not set)' ? 'no page recorded' : path);

// A change against the period before. From almost nothing, the starting
// number says more than a percentage does ("from 1", not "up 12200%").
function Change({ value, previous }) {
  if (!previous) return value ? <span class="good small">new</span> : <span class="nx-dim">–</span>;
  if (previous * 4 < value) return <span class="good small">from {fmt(previous)}</span>;
  const p = Math.round((value / previous - 1) * 100);
  if (!p) return <span class="nx-dim small">same</span>;
  return <span class={`${p > 0 ? 'good' : 'bad'} small`}>{p > 0 ? '↑' : '↓'} {Math.abs(p)}%</span>;
}

function SectionHead({ n, title, more }) {
  return (
    <div class="nx-section-head">
      <h2 class="nx-h2">{n && <span class="nx-step" aria-hidden="true">{n}</span>}{title}</h2>
      {more && <a class="nx-more" href={more.href}>{more.label} <Icon name="chevron" size={12} /></a>}
    </div>
  );
}
