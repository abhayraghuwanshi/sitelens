import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { Icon } from '../components/icons.jsx';
import { BarList, ErrorState, OwlLoader } from '../components/ui.jsx';

// Live: who is on a site right now (GA4 realtime, last 5 minutes), minute by
// minute over the last 30, what they read, where from, and what shipped or was
// posted just before (server: /api/sites/<id>/live/detail, /api/live).
// Realtime calls have their own GA4 quota, so polling stops while the tab is hidden.

const SITE_POLL = 30_000;
const ALL_POLL = 45_000;

// Runs `load` now and every `every` ms while the tab is visible, and again as
// soon as it comes back; `key` changing starts over. A failed refresh keeps the
// last numbers and the error.
function usePollFn(key, load, every, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, at: 0 });
  useEffect(() => {
    if (!enabled || !key) return undefined;
    let alive = true;
    setState({ data: null, error: null, at: 0 });
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      load().then(
        (data) => alive && setState({ data, error: null, at: Date.now() }),
        (error) => alive && setState((s) => ({ ...s, error, at: Date.now() })),
      );
    };
    tick();
    const id = setInterval(tick, every);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [key, every, enabled]);
  return state;
}

export const usePoll = (path, every, enabled = true) => usePollFn(path, () => api.get(path), every, enabled);

// Every site's count right now, for the sidebar and the All view. /api/live
// answers for your own sites; a site shared with you (or the demo's showcase)
// lives in someone else's app, so it is asked for on its own.
export function useLiveCounts(sites, enabled = true) {
  const ids = sites.map((s) => s.id);
  const load = async () => {
    const own = await api.get('/live').catch(() => ({ sites: [] }));
    const known = new Set(own.sites.map((s) => s.id));
    const others = await Promise.all(sites.filter((s) => !known.has(s.id) && (s.shared || s.showcase)).map(async (s) => {
      try {
        const live = await api.get(`/sites/${s.id}/live`);
        return { id: s.id, label: s.label, host: s.host, now: live.total, top: live.top?.[0]?.title || '' };
      } catch (err) {
        return { id: s.id, label: s.label, host: s.host, now: null, error: err.message };
      }
    }));
    // Only sites you can see (the demo's own app also knows the sample site).
    const rows = [...own.sites, ...others].filter((r) => ids.includes(r.id)).sort((a, b) => (b.now ?? -1) - (a.now ?? -1));
    return { sites: rows, total: rows.reduce((n, r) => n + (r.now || 0), 0) };
  };
  const { data, at } = usePollFn(ids.join(','), load, ALL_POLL, enabled);
  const bySite = {};
  for (const s of data?.sites || []) bySite[s.id] = s.now;
  return { total: data?.total ?? null, bySite, data, at };
}

// "12s ago", ticking.
function useAgo(at) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  return at ? ago(at) : '';
}

export function ago(at, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}

const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const people = (n) => `${fmt(n)} ${n === 1 ? 'person' : 'people'}`;
const KIND = { post: 'megaphone', deploy: 'rocket', release: 'rocket', extension: 'puzzle', mention: 'chat', note: 'star', claude: 'sparkles', alert: 'bell' };

// The headline: how many, and the freshest thing that may explain it.
export function liveHeadline(live, now = Date.now()) {
  const fresh = (live.recent || []).find((e) => e.at && now - e.at < 6 * 3_600_000);
  const who = live.now ? `${people(live.now)} on the site right now` : 'Nobody on the site right now';
  const top = live.pages?.[0];
  const reading = live.now && top ? `, most of them on “${top.title}”` : '';
  if (fresh) return `${who}${reading}. Just before: ${fresh.label} (${ago(fresh.at, now)}).`;
  return `${who}${reading}.${live.now ? '' : ` ${fmt(live.last30)} in the last 30 minutes.`}`;
}

export function LivePage({ site }) {
  const { data, error, at } = usePoll(`/sites/${site.id}/live/detail`, SITE_POLL);
  const updated = useAgo(at);
  if (!data && error) return <ErrorState error={error} />;
  if (!data) return <OwlLoader label="Asking Google Analytics who’s on the site…" />;
  const max = Math.max(1, ...data.perMinute);
  return (
    <>
      <section class="card card-plain nx-live-top">
        <div class="nx-live-now">
          <p class="nx-live-num"><span class={`nx-live-dot${data.now ? ' on' : ''}`} aria-hidden="true" />{fmt(data.now)}</p>
          <p class="nx-live-cap">on the site now<span>last 5 minutes</span></p>
          <p class="nx-live-cap">{fmt(data.last30)}<span>in the last 30 minutes</span></p>
        </div>
        <div class="nx-live-chart">
          <p class="nx-headline">{liveHeadline(data)}</p>
          <div class="nx-live-bars" role="img" aria-label={`People on the site each minute for the last 30 minutes, from ${data.perMinute[0]} to ${data.perMinute[29]} now`}>
            {data.perMinute.map((n, i) => <i key={i} class={i === 29 ? 'now' : ''} style={{ height: `${Math.max(3, (n / max) * 100)}%` }} title={`${i === 29 ? 'This minute' : `${29 - i} min ago`}: ${fmt(n)}`} />)}
          </div>
          <div class="nx-live-axis"><span>30 min ago</span><span>now</span></div>
          <p class="nx-live-meta">
            Updates every 30 seconds{updated ? ` · checked ${updated}` : ''}{error ? ' · the last refresh failed, showing the one before' : ''}
          </p>
        </div>
      </section>

      {data.recent?.length > 0 && (
        <section class="card card-plain">
          <h2 class="nx-h2"><Icon name="calendar" size={16} /> Shipped or posted in the last day</h2>
          <ul class="nx-live-recent">
            {data.recent.map((e) => (
              <li key={e.id}>
                <Icon name={KIND[e.kind] || 'star'} size={14} />
                {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a> : <span>{e.label}</span>}
                <span class="muted">{e.at ? ago(e.at) : 'today'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div class="nx-live-grid">
        <LiveList title="Reading now" sub="last 5 minutes" rows={data.pages.map((p) => ({ name: p.title, users: p.users }))} empty="Nobody is reading anything right now." />
        <LiveList title="Where they came from" sub="last 30 minutes" rows={data.sources}
          empty={data.sources ? 'No sources yet.' : 'Google Analytics doesn’t give sources in real time for this property.'} />
        <LiveList title="Countries" sub="last 30 minutes" rows={data.countries} empty="No countries yet." />
        <LiveList title="Devices" sub="last 30 minutes" rows={data.devices.map((d) => ({ ...d, name: d.name[0].toUpperCase() + d.name.slice(1) }))} empty="No devices yet." />
      </div>

      {!data.scopedByStream && !site.demo && (
        <p class="muted nx-live-note">This counts the whole Google Analytics property. Name this site’s data stream on its Edit page to count only {site.host || site.label}.</p>
      )}
    </>
  );
}

function LiveList({ title, sub, rows, empty }) {
  return (
    <section class="card card-plain">
      <h2 class="nx-h2">{title} <span class="muted nx-live-sub">{sub}</span></h2>
      {rows?.length
        ? <BarList rows={rows.slice(0, 6)} value={(r) => r.users} label={(r) => r.name} format={fmt} />
        : <p class="muted m-0">{empty}</p>}
    </section>
  );
}

// `live` is useLiveCounts' answer, shared with the sidebar.
export function LiveAll({ sites, live }) {
  const { data, at } = live;
  const updated = useAgo(at);
  if (!data) return <OwlLoader label="Checking every site…" />;
  const label = (id) => sites.find((s) => s.id === id)?.label;
  return (
    <>
      <p class="nx-headline">
        {data.total ? `${people(data.total)} across your sites right now.` : 'Nobody is on any of your sites right now.'}
        <span class="muted nx-live-inline"> Last 5 minutes{updated ? `, checked ${updated}` : ''}.</span>
      </p>
      <section class="card nx-live-sites">
        {data.sites.map((s) => (
          <a key={s.id} href={`#/site/${s.id}/live`} class="nx-live-site">
            <span class={`nx-live-dot${s.now ? ' on' : ''}`} aria-hidden="true" />
            <span class="nx-live-name"><b>{label(s.id) || s.label}</b><span class="muted">{s.error ? s.error : s.top ? `Most read: ${s.top}` : s.host}</span></span>
            <span class="nx-live-count">{s.now == null ? '–' : fmt(s.now)}</span>
          </a>
        ))}
        {!data.sites.length && <p class="muted nx-live-note">Link a Google Analytics property to a site to see who is on it.</p>}
      </section>
    </>
  );
}
