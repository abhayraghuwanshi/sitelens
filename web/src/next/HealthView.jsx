import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo } from '../components/Todos.jsx';
import { Drawer, hrefWith } from './Drawer.jsx';

// Pages → Health (docs/redesign → Pages → Health): one sentence on what's
// wrong, then Can search show it? (Google and Bing bars over the busiest pages,
// one row per page with a problem, its detail in the drawer), Speed on phones
// and computers (the site's real-visitor numbers, then a 0–5 s track per page),
// and Dead ends (missing pages people reached). Uptime sits at the end.
const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('en-US'));
const secs = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`);
const band = (ms) => (ms === null || ms === undefined ? ['', 'muted'] : ms <= 2500 ? ['Fast', 'up'] : ms <= 4000 ? ['Slowish', 'warn'] : ['Slow', 'down']);
const X = (ms) => Math.min(98, ((ms || 0) / 5000) * 100);
const pageName = (p) => (p === '/' ? 'Home page' : p);

export function HealthView({ site, params }) {
  const ix = useAsync((o) => api.get(`/sites/${site.id}/health/index${qs({ fresh: o?.fresh ? 1 : undefined })}`), [site.id]);
  const speed = useAsync((o) => api.get(`/sites/${site.id}/health/speed${qs({ fresh: o?.fresh ? 1 : undefined })}`), [site.id]);
  const vitals = useAsync(() => (site.host ? api.get(`/vitals/sites/${site.id}${qs({ range: '7d' })}`).catch(() => null) : null), [site.id]);
  const logs = useAsync(() => api.get(`/firebase/sites/${site.id}${qs({ range: '28d' })}`).catch(() => null), [site.id]);
  const open = params.get('ix') || '';

  const pages = ix.data?.pages || [];
  const problems = pages.filter((p) => p.kind && !p.onPurpose);
  const hidden = pages.filter((p) => p.onPurpose);
  const unknown = pages.length > 0 && pages.every((p) => p.google[0] === 'unknown' && p.bing[0] === 'unknown');
  const top = [...problems].sort((a, b) => b.visits - a.visits)[0];
  const slow = (speed.data?.pages || []).filter((p) => p.phone?.lcp > 2500);
  const opened = pages.find((p) => p.path === open);

  return (
    <div class="hv">
      {ix.data && speed.data && (
        <p class="nx-answer">
          {problems.length
            ? <><b>{problems.length} {problems.length === 1 ? 'page' : 'pages'}</b> can’t show up properly in search, and the one that matters most is <b>{top.title === top.path ? pageName(top.path) : top.title}</b>: {top.kind === 'canon' ? 'Google picked a different address for it' : INDEX_SHORT[top.kind]}.</>
            : unknown ? <>Kauzl couldn’t ask Google or Bing about the pages yet.</>
            : <>Google and Bing can show all of the <b>{pages.length}</b> busiest pages.</>}
          {' '}{slow.length ? <>On phones, <b>{slow.length} {slow.length === 1 ? 'page is' : 'pages are'}</b> slow to load.</> : speed.data.pages.length ? 'They all load fast on phones.' : ''}
        </p>
      )}

      <section class="nx-block" aria-label="Can search show it?">
        <div class="hv-head">
          <h2 class="nx-h2">Can search show it? <span class="nx-h2-sub">Google’s and Bing’s own checks of the {pages.length || ''} busiest pages</span></h2>
          {ix.data && <button type="button" class="todo-link" disabled={ix.loading} onClick={() => ix.reload({ fresh: true })}><Icon name="refresh" size={11} /> {ix.loading ? 'Checking…' : 'Check again'}</button>}
        </div>
        {ix.error ? <ErrorState error={ix.error} onRetry={ix.reload} />
          : !ix.data ? <Loading height={200} owl label="Asking Google and Bing about the busiest pages…" />
          : (
            <>
              <div class="card card-plain hv-sum">
                <EngineBar label="Google" pages={pages} which="google" />
                <EngineBar label="Bing" pages={pages} which="bing" />
                <span class="nx-legend">
                  <span><i class="dot hv-ok" />Shown</span><span><i class="dot hv-warn" />Needs a fix</span><span><i class="dot hv-bad" />Not shown</span><span><i class="dot hv-off" />Hidden on purpose</span>
                  {pages.some((p) => p.google[0] === 'unknown' || p.bing[0] === 'unknown') && <span><i class="dot hv-unk" />Not checked</span>}
                </span>
              </div>
              {problems.length > 0 ? (
                <div class="card card-plain nx-tight">
                  {problems.map((p) => (
                    <a key={p.path} class={`hv-row${open === p.path ? ' on' : ''}`} href={hrefWith('ix', p.path)}>
                      <span class="nx-ob"><b>{p.title === p.path ? pageName(p.path) : p.title}</b><small class="muted">{INDEX_TITLE(p)} · {fmt(p.visits)} visits in 90 days</small></span>
                      <span class="hv-e"><small>Google</small><Pill s={p.google} /></span>
                      <span class="hv-e"><small>Bing</small><Pill s={p.bing} /></span>
                      <Icon name="chevron" size={13} />
                    </a>
                  ))}
                </div>
              ) : !unknown && <p class="nx-empty">No problems on the busiest pages.</p>}
              {unknown && <p class="muted small m-0">{pages[0].google[2] || pages[0].bing[2]}</p>}
              {hidden.length > 0 && (
                <p class="muted small m-0">
                  {hidden.map((p) => pageName(p.path)).join(', ')} {hidden.length > 1 ? 'are' : 'is'} hidden on purpose (noindex). <a href={hrefWith('ix', hidden[0].path)}>See why</a>
                </p>
              )}
            </>
          )}
      </section>

      <section class="nx-block" aria-label="Speed on phones and computers">
        <div class="hv-head">
          <h2 class="nx-h2">Speed on phones and computers</h2>
          {speed.data && <button type="button" class="todo-link" disabled={speed.loading} onClick={() => speed.reload({ fresh: true })}><Icon name="refresh" size={11} /> {speed.loading ? 'Measuring…' : 'Measure again'}</button>}
        </div>
        <SiteVitals v={vitals.data?.vitals} />
        {speed.error ? <ErrorState error={speed.error} onRetry={speed.reload} />
          : !speed.data ? <Loading height={200} owl label="Running PageSpeed on the busiest pages. The first time takes about a minute." />
          : <SpeedList site={site} pages={speed.data.pages} />}
      </section>

      <section class="nx-block" aria-label="Dead ends">
        <h2 class="nx-h2">Dead ends <span class="nx-h2-sub">missing pages people actually reached</span></h2>
        <DeadEnds site={site} logs={logs} />
      </section>

      {vitals.data?.uptime && (
        <p class="muted small m-0">
          Up {(vitals.data.uptime.pct * 100).toFixed(vitals.data.uptime.pct === 1 ? 0 : 2)}% this week · {vitals.data.incidents?.length ? `${vitals.data.incidents.length} outage${vitals.data.incidents.length === 1 ? '' : 's'}` : 'no outages'} · responds in {fmt(vitals.data.uptime.avgMs)} ms on average · <a href={`#/health?site=${site.id}&full=1`}>Uptime and PageSpeed history</a>
        </p>
      )}

      {opened && <IndexPanel site={site} p={opened} onClose={() => { location.hash = hrefWith('ix', '').slice(1); }} onAgain={() => ix.reload({ fresh: true })} />}
    </div>
  );
}

const INDEX_SHORT = {
  crawled: 'Google read it and chose not to show it',
  notyet: 'an engine hasn’t read it yet',
  redirect: 'it’s listed, but it redirects',
  missing: 'an engine gets an error for it',
};

function Pill({ s }) {
  const cls = { ok: 'up', warn: 'warn', bad: 'down', off: 'muted', unknown: 'muted' }[s[0]];
  return <span class={`nx-pill ${cls}`} title={s[2]}>{s[1]}</span>;
}

function EngineBar({ label, pages, which }) {
  const n = (st) => pages.filter((p) => p[which][0] === st).length;
  const shown = n('ok');
  return (
    <div class="hv-bar">
      <span class="hv-bl"><b>{label}</b><span class="muted small">{shown} of {pages.length} pages shown</span></span>
      <span class="hv-track" role="img" aria-label={`${label}: ${shown} shown, ${n('warn')} need a fix, ${n('bad')} not shown, ${n('off')} hidden`}>
        <i class="hv-ok" style={`flex:${n('ok')}`} /><i class="hv-warn" style={`flex:${n('warn')}`} /><i class="hv-bad" style={`flex:${n('bad')}`} /><i class="hv-off" style={`flex:${n('off')}`} /><i class="hv-unk" style={`flex:${n('unknown')}`} />
      </span>
    </div>
  );
}

function IndexPanel({ site, p, onClose, onAgain }) {
  return (
    <Drawer title={p.title === p.path ? pageName(p.path) : p.title} onClose={onClose}>
      <p class="nx-big"><b>{p.title && p.kind ? INDEX_TITLE(p) : 'Shown'}.</b> {p.why}</p>
      {p.yours && (
        <div class="hv-addr">
          <span class="nx-tl">You say</span><code>{p.yours}</code>
          <span class="nx-tl">Google uses</span><code class="warn">{p.theirs}</code>
        </div>
      )}
      <div class="nx-drawer-sec">
        <h3 class="nx-label-sm">What each engine says</h3>
        {[['Google', p.google], ['Bing', p.bing]].map(([n, s]) => (
          <div key={n} class="hv-eng"><span class="hv-eh"><b>{n}</b><Pill s={s} /></span>{s[2] && <code>{s[2]}</code>}</div>
        ))}
      </div>
      <div class="nx-drawer-sec"><h3 class="nx-label-sm">Fix</h3><p class="m-0 small">{p.fix}</p></div>
      <div class="nx-btns">
        {!p.onPurpose && <AddTodo site={site} class="btn primary" todo={{ title: `${p.kind === 'canon' ? 'Fix the address Google uses for' : 'Get search to show'} ${p.path}`, detail: `${p.why} ${p.fix}`, from: `index:${p.path}`, subject: { kind: 'page', key: p.path }, link: `#/site/${site.id}/pages?article=${encodeURIComponent(p.path)}` }} label="To-do" />}
        <a class="btn" href={`#/site/${site.id}/pages?article=${encodeURIComponent(p.path)}`}>Open the page</a>
        <button type="button" class="btn ghost" onClick={onAgain}>Check again now</button>
      </div>
      <p class="muted small m-0">A to-do can go to Claude Code, which reads the same check through the Kauzl MCP (index_status).</p>
    </Drawer>
  );
}
const INDEX_TITLE = (p) => ({ canon: 'Google picked a different address', crawled: 'Crawled, not indexed', notyet: 'Not crawled yet', redirect: 'Listed, but it redirects', missing: 'The engine gets an error', noindex: 'Told not to show it' })[p.kind];

// The site as real Chrome visitors get it (CrUX, 3 in 4 visits).
function SiteVitals({ v }) {
  if (!v) return null;
  const tiles = [
    ['Loads', v.lcp, (x) => `${(x / 1000).toFixed(1)} s`, 'on phones · fast is under 2.5 s', (x) => (x <= 2500 ? ['Fast', 'up'] : x <= 4000 ? ['Slowish', 'warn'] : ['Slow', 'down'])],
    ['Responds to taps', v.inp, (x) => `${Math.round(x)} ms`, 'fast is under 200 ms', (x) => (x <= 200 ? ['Fast', 'up'] : x <= 500 ? ['Slowish', 'warn'] : ['Slow', 'down'])],
    ['Stays still', v.cls, (x) => x.toFixed(2), 'how much it jumps while loading · fine is under 0.1', (x) => (x <= 0.1 ? ['Steady', 'up'] : x <= 0.25 ? ['Jumpy', 'warn'] : ['Very jumpy', 'down'])],
  ].filter(([, m]) => m && Number.isFinite(m.value));
  if (!tiles.length) return null;
  return (
    <>
      <p class="muted small m-0">Across the site: what 3 in 4 real visitors get, from Chrome’s own measurements.</p>
      <div class="hv-tiles">
        {tiles.map(([l, m, f, d, rate]) => {
          const [w, c] = rate(m.value);
          return <div key={l} class="hv-tile"><span class="muted small">{l}</span><b>{f(m.value)}</b><span class={`nx-pill ${c}`}>{w}</span><small>{d}</small></div>;
        })}
      </div>
    </>
  );
}

// Each page: a track from 0 to 5 s, a filled dot for phones and a hollow one for computers.
function SpeedList({ site, pages }) {
  if (!pages.length) return <p class="nx-empty">No pages to measure yet.</p>;
  const cost = (p) => (p.visits || 0) * Math.max(0, (p.phone?.lcp || 0) - 2500);
  const rows = [...pages].sort((a, b) => cost(b) - cost(a) || b.visits - a.visits);
  const failed = pages.find((p) => p.phone?.error);
  return (
    <div class="card card-plain nx-tight">
      <div class="hv-srow hv-shead" aria-hidden="true"><span /><span class="hv-trh"><span style="left:0">0 s</span><span style={`left:${X(2500)}%`}>2.5 s</span><span style={`left:${X(4000)}%`}>4 s</span></span><span class="nx-num">Visits</span></div>
      {rows.map((p) => {
        const [w, c] = band(p.phone?.lcp);
        return (
          <a key={p.path} class="hv-srow" href={`#/site/${site.id}/pages?article=${encodeURIComponent(p.path)}`}>
            <span class="nx-ob"><b>{p.title === p.path ? pageName(p.path) : p.title}</b>
              <small class="muted">{p.phone?.error ? 'PageSpeed couldn’t measure it' : <>{secs(p.phone?.lcp)} on phones · {secs(p.computer?.lcp)} on computers{w && <> · <span class={c === 'up' ? 'good' : c === 'down' ? 'bad' : ''}>{w}</span></>}{p.phone?.cls > 0.1 ? ' · jumps while loading' : ''}</>}</small>
            </span>
            <span class="hv-tr">
              <span class="hv-z" style={`left:0;width:${X(2500)}%`} /><span class="hv-z mid" style={`left:${X(2500)}%;width:${X(4000) - X(2500)}%`} /><span class="hv-z bad" style={`left:${X(4000)}%;right:0`} />
              {p.phone?.lcp != null && p.computer?.lcp != null && <span class="hv-l" style={`left:${X(p.computer.lcp)}%;width:${Math.max(0, X(p.phone.lcp) - X(p.computer.lcp))}%`} />}
              {p.computer?.lcp != null && <span class="hv-d pc" style={`left:${X(p.computer.lcp)}%`} title={`Computers ${secs(p.computer.lcp)}`} />}
              {p.phone?.lcp != null && <span class={`hv-d ph ${c}`} style={`left:${X(p.phone.lcp)}%`} title={`Phones ${secs(p.phone.lcp)}`} />}
            </span>
            <span class="nx-num">{fmt(p.visits)}</span>
          </a>
        );
      })}
      <p class="muted small m-0 hv-note">Filled dot: phones · hollow: computers · time until the main content shows (PageSpeed lab test) · busiest slow pages first.{failed ? ` ${failed.phone.error}` : ''}</p>
    </div>
  );
}

function DeadEnds({ site, logs }) {
  if (logs.loading && !logs.data) return <Loading height={80} />;
  const errors = (logs.data?.errors || []).filter((e) => e.status === 404 && e.humans > 0);
  if (!logs.data || logs.data.error) {
    return <p class="nx-empty">Kauzl sees missing pages in the server’s own logs. Link this site’s Firebase App Hosting in <a href="#/account?i=firebase">Account</a> to see who reaches a page that isn’t there.</p>;
  }
  if (!errors.length) return <p class="nx-empty">Nobody reached a missing page in the last 28 days.</p>;
  return (
    <div class="card card-plain nx-tight">
      {errors.slice(0, 8).map((e) => (
        <div key={e.path} class="hv-dead">
          <span class="nx-ob"><b>{e.path}</b><small class="muted">{fmt(e.humans)} visits hit a missing page in 28 days</small></span>
          <AddTodo site={site} todo={{ title: `Redirect ${e.path} to the page people want`, detail: `${e.humans} visits in 28 days reached ${e.path}, which doesn’t exist.`, from: `dead:${e.path}` }} label="To-do: redirect it" />
        </div>
      ))}
    </div>
  );
}
