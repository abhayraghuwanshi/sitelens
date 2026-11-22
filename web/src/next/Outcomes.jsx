import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Segmented, SegmentedAsMenu, Loading, ErrorState } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { Page, usePhoneWidth } from './Page.jsx';
import { Results, SectionHead } from './Results.jsx';

// One site's outcomes (server/outcomes.mjs), in the order you'd act on them:
// what it led to, what stands out, where people drop off, and which
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
  else body = <OutcomeBody key={`${product?.id || `site:${site.id}`}:${range}`} site={site} product={product} range={range} />;

  return (
    <Page title="Goals" back={back}
      sub={`What ${site.label}’s visits led to, what stands out, and where people drop off`}
      time={<Segmented label="Period" value={range} options={RANGES} onChange={pick} />}>
      {body}
    </Page>
  );
}

function OutcomeBody({ site, product, range }) {
  const url = product ? `/outcomes/${product.id}` : `/sites/${site.id}/outcomes`;
  const data = useAsync((o) => api.get(`${url}${qs({ range, fresh: o?.fresh })}`), [url, range]);
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
      <GoalsMeasured d={d} site={site} onRefresh={() => data.reload({ fresh: true })} refreshing={data.loading} />
    </>
  );
}

// What the numbers show, as a plain list: what's leaking first, then what
// works, then what's only worth knowing. Acting on them happens in one place,
// the Story's "What to do next" (it turns the leaks into to-dos), so there are
// no buttons or advice here.
const ORDER = { bad: 0, warn: 1, good: 2, info: 3 };
const NOTE = { bad: 'Leaking', warn: 'Leaking', good: 'Working', info: 'Worth knowing' };

function Actions({ site, insights, range }) {
  const list = [...insights].sort((a, b) => (ORDER[a.tone] ?? 4) - (ORDER[b.tone] ?? 4));
  return (
    <section class="card card-plain nx-next" aria-label="What we noticed">
      <SectionHead n="2" title="What we noticed" more={{ href: `#/site/${site.id}?range=${range}`, label: 'What to do next' }} />
      {!list.length && <p class="muted m-0">Nothing stands out yet. Findings appear once there’s enough traffic and at least one goal event.</p>}
      {list.length > 0 && (
        <ul class="nx-nlist">
          {list.map((i) => {
            const link = i.link || (i.day ? `#/site/${site.id}/timeline${qs({ month: i.day.slice(0, 7), day: i.day })}` : '');
            const Main = link ? 'a' : 'div';
            return (
              <li class="nx-nrow nx-nrow-2" key={i.key}>
                <Main class="nx-nmain" {...(link ? { href: link, ...(link.startsWith('https:') ? { target: '_blank', rel: 'noreferrer' } : {}) } : {})}>
                  <b>{i.title}</b>
                  {i.detail && <span>{i.detail}</span>}
                </Main>
                <span class="nx-nworth">{NOTE[i.tone] || ''}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
    <section class="card card-plain" aria-label="Where people drop off">
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
export function Sources({ d }) {
  const phone = usePhoneWidth();
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
    <section class="card card-plain" aria-label="Who converts">
      <div class="nx-section-head">
        <h2 class="nx-h2">Who converts</h2>
        {cuts.length > 1 && (
          <SegmentedAsMenu.Provider value={phone}>
            <Segmented label="Split by" value={cut.key} options={cuts.map((c) => ({ key: c.key, label: c.label }))} onChange={setPick} />
          </SegmentedAsMenu.Provider>
        )}
      </div>
      <p class="note">{cut.note} The best rate with at least 5 visitors is marked.</p>
      <div class={`nx-table nx-conv${cut.engaged ? ' engaged' : ''}`}>
        <div class="nx-tr nx-th"><span /><span class="nx-num">Visitors</span><span class="nx-num" title={cut.col}>{phone ? (cut.col === 'Installs' ? 'Installs' : 'Reached') : cut.col}</span><span>Rate</span>{cut.engaged && <span class="nx-num">Engaged</span>}</div>
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
// short: just ".sitelens.yml" (the full repo path is in the tooltip).
function FileLink({ file, site, short = false }) {
  const full = file?.type === 'repo' ? `${file.repo}/${file.path}` : file?.type === 'demo' ? 'the built-in demo file' : file?.path ? file.path.split('/').pop() : 'the site’s repo file';
  const name = short ? '.sitelens.yml' : full;
  const stop = (e) => e.stopPropagation();
  if (file?.url) return <a href={file.url} target="_blank" rel="noreferrer" onClick={stop} title={`Open ${full} on GitHub`}><code>{name}</code> <Icon name="external" size={11} /></a>;
  return <a href={`#/site/${site.id}/setup`} onClick={stop} title={file?.path || full}><code>{name}</code></a>;
}

// The goals everything above is measured against, folded away.
// noEdit: the page's header already has Edit goals (Goals page), so the line only unfolds and refreshes.
export function GoalsMeasured({ d, site, onRefresh, refreshing, noEdit = false }) {
  const g = d.goals;
  const fromFile = g.from === 'file';
  const edit = fromFile ? `#/site/${site.id}/setup` : `#/site/${site.id}/goals?edit=1`;
  return (
    <details class={`card card-plain nx-goals${noEdit ? ' slim' : ''}`}>
      <summary>
        <span><b>Measured against {g.list.length} goal{g.list.length === 1 ? '' : 's'}</b>
          <span class="muted"> · {fromFile ? <>from <FileLink file={g.file} site={site} short={noEdit} /></> : g.custom ? 'set by you' : 'guessed by Kauzl until you set your own'}</span></span>
        {/* On the Goals page, Edit goals is in the header and the numbers reload with the page: no buttons here. */}
        {!noEdit && (
          <span class="nx-action-row">
            <a class="btn" href={edit}><Icon name="target" size={13} /> {fromFile ? 'Edit goals' : g.custom ? 'Edit goals' : 'Set goals'}</a>
            <button class="btn" type="button" disabled={refreshing} onClick={(e) => { e.preventDefault(); onRefresh(); }}><Icon name="refresh" size={13} /> Refresh</button>
          </span>
        )}
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
