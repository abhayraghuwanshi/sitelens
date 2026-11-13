import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Segmented, Loading, ErrorState } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo, useTodos } from '../components/Todos.jsx';
import { Page } from './Page.jsx';
import { Results, SectionHead } from './Story.jsx';

// One site's outcomes (server/outcomes.mjs), in the order you'd act on them:
// what it led to, what to do about it, where people drop off, and which
// channels and pages bring the people who convert. The goals behind it are
// at the bottom, one link from the site's Edit page.
const RANGES = [{ key: '7d', label: '7 days' }, { key: '28d', label: '28 days' }, { key: '90d', label: '90 days' }];
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (v) => (v === null || v === undefined ? '–' : `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`);
const short = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const SOURCE_LABEL = { event: 'Site event', page: 'Page visited', installs: 'Store installs', downloads: 'Release downloads', stars: 'GitHub stars' };

export function OutcomesPage({ site, params, back }) {
  const [saved, setSaved] = usePersistent('outcomesRange', '28d');
  const wanted = params.get('range') || saved;
  const range = RANGES.some((r) => r.key === wanted) ? wanted : '28d';
  const pick = (key) => {
    setSaved(key);
    location.hash = `/site/${site.id}/outcomes?range=${key}`;
  };
  const products = useAsync(() => api.get('/products'), []);
  const product = products.data?.products?.find((p) => p.siteId === site.id);

  let body;
  if (products.error) body = <ErrorState error={products.error} onRetry={products.reload} />;
  else if (!products.data) body = <Loading height={260} />;
  else if (!product) {
    body = (
      <section class="nx-card">
        <p class="nx-lede">Outcomes are measured per product: this site plus its store listing or repos, and the goals that count as a result (a download, an install, a sign-up).</p>
        <div class="nx-action-row"><a class="btn primary" href={`#/site/${site.id}/setup`}>Set up goals</a></div>
      </section>
    );
  } else body = <OutcomeBody key={`${product.id}:${range}`} site={site} product={product} range={range} />;

  return (
    <Page title="Outcomes" back={back}
      sub={`What ${site.label}’s visits led to, what to do about it, and where people drop off`}
      actions={<Segmented label="Period" value={range} options={RANGES} onChange={pick} />}>
      {body}
    </Page>
  );
}

function OutcomeBody({ site, product, range }) {
  const data = useAsync((o) => api.get(`/outcomes/${product.id}${qs({ range, fresh: o?.fresh })}`), [product.id, range]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={160} /><Loading height={260} /></>;
  const d = data.data;
  const errors = Object.entries(d.errors);
  return (
    <>
      {errors.length > 0 && <p class="nx-leftout">{errors.map(([k, msg]) => <span key={k}><b>{k}:</b> {msg}</span>)}</p>}
      <Results site={site} range={range} n="1" title="What it led to" more={false} />
      <Actions site={site} insights={d.insights} range={range} />
      <Path funnel={d.funnel} host={d.site?.host} series={d.series} />
      <Sources d={d} />
      <Goals d={d} site={site} onRefresh={() => data.reload({ fresh: true })} refreshing={data.loading} />
    </>
  );
}

// Findings as things to do. What's broken or leaking comes first and can go on
// your to-dos (the same to-do Story's "What to do next" offers); what works and
// what's only worth knowing sit under it, smaller.
function Actions({ site, insights, range }) {
  const todos = useTodos({ site: site.id });
  const added = new Map((todos.data?.todos || []).filter((t) => t.from).map((t) => [t.from, t]));
  const fix = insights.filter((i) => i.tone === 'bad' || i.tone === 'warn');
  const keep = insights.filter((i) => i.tone === 'good');
  const know = insights.filter((i) => i.tone === 'info');

  return (
    <section class="nx-card nx-next" aria-label="What to do">
      <SectionHead n="2" title="What to do" more={{ href: `#/site/${site.id}/todos`, label: 'Your to-dos' }} />
      {!insights.length && <p class="muted">Nothing stands out yet. Findings appear once there’s enough traffic and at least one goal event.</p>}
      {fix.length > 0 && (
        <div class="nx-step-group">
          <div class="nx-label-sm"><Icon name="triangle" size={12} /> Fix first</div>
          <div class="nx-actions">
            {fix.map((i) => <Finding key={i.key} site={site} item={i} range={range} todo={added.get(`outcome:${i.key}`)} />)}
          </div>
        </div>
      )}
      {keep.length > 0 && (
        <div class="nx-step-group">
          <div class="nx-label-sm"><Icon name="trend" size={12} /> Working, do more of it</div>
          <div class="nx-actions">
            {keep.map((i) => <Finding key={i.key} site={site} item={i} range={range} todo={added.get(`outcome:${i.key}`)} />)}
          </div>
        </div>
      )}
      {know.length > 0 && (
        <div class="nx-step-group">
          <div class="nx-label-sm"><Icon name="star" size={12} /> Worth knowing</div>
          <ul class="nx-list">
            {know.map((i) => (
              <li key={i.key}>
                <b>{i.title}.</b> <span class="muted">{i.detail}{i.action && ` ${i.action}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Finding({ site, item, range, todo }) {
  const why = [item.detail, item.action && `Do: ${item.action}`].filter(Boolean).join(' ');
  const link = item.link || (item.day ? `#/site/${site.id}/timeline${qs({ month: item.day.slice(0, 7), day: item.day })}` : '');
  return (
    <div class={`nx-action${todo ? ' started' : ''}${item.tone === 'bad' ? ' nx-action-bad' : ''}`}>
      <b>{item.title}</b>
      {item.detail && <span class="muted">{item.detail}</span>}
      {item.action && <span><b class="nx-do">Do</b> {item.action}</span>}
      {(item.action || link) && <div class="nx-action-row">
        {link && (
          <a class="btn" href={link} {...(link.startsWith('https:') ? { target: '_blank', rel: 'noreferrer' } : {})}>
            {item.link ? <>Open GA4 <Icon name="external" size={11} /></> : 'See that day'}
          </a>
        )}
        {item.action && (
          <AddTodo site={site} added={todo} class="btn ghost"
            todo={{ title: item.title, detail: why, link: item.link || `#/site/${site.id}/outcomes?range=${range}`, from: `outcome:${item.key}`, subject: { kind: 'outcome', key: item.key } }} />
        )}
      </div>}
    </div>
  );
}

// From visit to outcome on the site, with the step that loses the most marked,
// and the outcomes per day beside it.
function Path({ funnel, host, series }) {
  const top = funnel.steps[0]?.users || 0;
  const chart = [
    ...(series.installs.length ? [{ label: 'Store installs', values: series.installs }] : []),
    ...(series.goals.some(Boolean) || !series.installs.length ? [{ label: series.goalsLabel, values: series.goals }] : []),
  ];
  return (
    <section class="nx-card" aria-label="Where people drop off">
      <SectionHead n="3" title="Where people drop off" />
      {funnel.leak && (
        <p class="nx-lede">
          The biggest drop is from “{funnel.leak.from.label}” to “{funnel.leak.to.label}”: {pct(funnel.leak.rate)} go on, {fmt(funnel.leak.from.users - funnel.leak.to.users)} don’t.
        </p>
      )}
      <div class="nx-cols">
        <div>
          <div class="nx-label-sm">This period, people at each step</div>
          {top ? (
            <div class="nx-funnel">
              {funnel.steps.map((s, i) => {
                const leak = funnel.leak?.to.key === s.key;
                return (
                  <div class={`nx-fstep${leak ? ' leak' : ''}`} key={s.key}>
                    <span class="nx-path" title={s.event || ''}>{s.label}</span>
                    <div class="nx-bar"><span class={i === funnel.steps.length - 1 ? 'last' : ''} style={{ width: `${Math.max(1.5, Math.min(100, (s.users / top) * 100))}%` }} /></div>
                    <span class="nx-num">{fmt(s.users)}</span>
                    <span class={`small ${leak ? 'bad' : 'muted'}`}>{i ? `${pct(s.rate)} go on` : ''}</span>
                  </div>
                );
              })}
            </div>
          ) : <p class="muted">No site visitors in this range, or the site isn’t linked to a GA4 property.</p>}
          {funnel.store && (
            <p class="note mt-10">
              Beside it, to the Web Store: {fmt(funnel.store.visitors)} listing visitors came from {host || 'the site'} ({pct(funnel.store.rate)} of site visitors), and {fmt(funnel.store.installs)} installed.
            </p>
          )}
        </div>
        <div>
          <div class="nx-label-sm">Per day</div>
          <LineChart labels={series.dates.map(short)} series={chart} format={(v) => fmt(v)} height={200} area={false} />
        </div>
      </div>
    </section>
  );
}

// Who converts, one cut at a time instead of four tables at once.
function Sources({ d }) {
  const conv = d.rateLabel;
  const cuts = [
    d.channels.length && { key: 'channels', label: 'Channels', rows: d.channels, col: conv, n: 'goalUsers', note: `Site visitors from each channel, and how many ${conv.toLowerCase()}.`, engaged: true },
    d.listing.length && { key: 'listing', label: 'Store', rows: d.listing, col: 'Installs', n: 'installs', note: 'Web Store listing visitors from each source, and how many installed.' },
    d.pages.length && { key: 'pages', label: 'Landing pages', rows: d.pages, col: conv, n: 'goalUsers', note: 'Where visitors start, and how many go on to convert.', mono: true },
    d.countries.length && { key: 'countries', label: 'Countries', rows: d.countries, col: conv, n: 'goalUsers', note: 'Low engagement and no conversions usually means bots.', engaged: true },
  ].filter(Boolean);
  const [pick, setPick] = useState(cuts[0]?.key);
  if (!cuts.length) return null;
  const cut = cuts.find((c) => c.key === pick) || cuts[0];
  const best = Math.max(0, ...cut.rows.filter((r) => r.visitors >= 5).map((r) => r.rate || 0));

  return (
    <section class="nx-card" aria-label="Who converts">
      <div class="nx-section-head">
        <h2 class="nx-h2"><span class="nx-step" aria-hidden="true">4</span>Who converts</h2>
        {cuts.length > 1 && <Segmented label="Split by" value={cut.key} options={cuts.map((c) => ({ key: c.key, label: c.label }))} onChange={setPick} />}
      </div>
      <p class="note">{cut.note} The best rate with at least 5 visitors is marked.</p>
      <div class={`nx-table nx-conv${cut.engaged ? ' engaged' : ''}`}>
        <div class="nx-tr nx-th"><span /><span class="nx-num">Visitors</span><span class="nx-num">{cut.col}</span><span>Rate</span>{cut.engaged && <span class="nx-num">Engaged</span>}</div>
        {cut.rows.slice(0, 12).map((r) => {
          const hot = r.visitors >= 5 && best > 0 && r.rate === best;
          return (
            <div class={`nx-tr${hot ? ' hot' : ''}`} key={r.key}>
              <span class={`nx-path${cut.mono ? ' mono' : ''}`} title={r.key}>{r.key}{hot && <span class="good small"> · best</span>}</span>
              <span class="nx-num">{fmt(r.visitors)}</span>
              <span class="nx-num">{fmt(r[cut.n])}</span>
              <span class="nx-rate"><span class="nx-bar"><span style={{ width: `${Math.min(100, (r.rate || 0) * 100)}%` }} /></span><span class="small">{pct(r.rate)}</span></span>
              {cut.engaged && <span class={`nx-num small${r.engagement !== null && r.engagement < 0.25 ? ' bad' : ''}`}>{pct(r.engagement)}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// The site's .sitelens.yml: on GitHub it opens in a new tab; a local or demo
// file has no page of its own, so it opens the site's Edit page, which shows it.
function FileLink({ file, site }) {
  const name = file?.type === 'repo' ? `${file.repo}/${file.path}` : file?.type === 'demo' ? 'the built-in demo file' : file?.path ? file.path.split('/').pop() : 'the site’s repo file';
  const stop = (e) => e.stopPropagation();
  if (file?.url) return <a href={file.url} target="_blank" rel="noreferrer" onClick={stop} title="Open on GitHub"><code>{name}</code> <Icon name="external" size={11} /></a>;
  return <a href={`#/site/${site.id}/setup`} onClick={stop} title={file?.path || ''}><code>{name}</code></a>;
}

// The goals everything above is measured against, folded away.
function Goals({ d, site, onRefresh, refreshing }) {
  const g = d.goals;
  const fromFile = g.from === 'file';
  const edit = fromFile ? `#/site/${site.id}/setup` : `#/settings?tab=products&edit=${d.product?.id || ''}&focus=goals`;
  return (
    <details class="nx-card nx-goals">
      <summary>
        <span><b>Measured against {g.list.length} goal{g.list.length === 1 ? '' : 's'}</b>
          <span class="muted"> · {fromFile ? <>from <FileLink file={g.file} site={site} /></> : g.custom ? 'set by you' : 'guessed by Studio until you set your own'}</span></span>
        <span class="nx-action-row">
          <a class="btn" href={edit}><Icon name="target" size={13} /> {fromFile ? 'Edit goals' : g.custom ? 'Edit goals' : 'Set goals'}</a>
          <button class="btn" type="button" disabled={refreshing} onClick={(e) => { e.preventDefault(); onRefresh(); }}><Icon name="refresh" size={13} /> Refresh</button>
        </span>
      </summary>
      <div class="nx-table nx-goal-table">
        <div class="nx-tr nx-th"><span>Goal</span><span>Measured by</span><span>Counts as</span><span class="nx-num">This period</span><span class="nx-num">Before</span></div>
        {g.list.map((x) => (
          <div class="nx-tr" key={x.id}>
            <span>{x.label}</span>
            <span class="small muted">{SOURCE_LABEL[x.source]}{x.match && <> · <span class="mono">{x.match}</span></>}</span>
            <span class="small">{x.role === 'outcome' ? 'Outcome' : 'Step'}</span>
            <span class="nx-num">{x.unavailable ? <span class="muted small">{x.unavailable}</span> : fmt(x.count)}</span>
            <span class="nx-num muted">{x.previous === null || x.previous === undefined ? '–' : fmt(x.previous)}</span>
          </div>
        ))}
      </div>
      {g.keyEvents === 0 && g.list.some((x) => x.source === 'event') && <p class="note">GA4 has none of these events marked as key events, so its own reports show 0 conversions.</p>}
    </details>
  );
}
