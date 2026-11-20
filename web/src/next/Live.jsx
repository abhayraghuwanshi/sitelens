import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { Icon } from '../components/icons.jsx';
import { ErrorState, OwlLoader } from '../components/ui.jsx';
import { LiveMap } from './LiveMap.jsx';

// Live: who is on a site right now (GA4 realtime, last 5 minutes), minute by
// minute over the last 30, what they read, where from, and what shipped or was
// posted just before (server: /api/sites/<id>/live/detail, /api/live).
// Realtime calls have their own GA4 quota, so polling stops while the tab is hidden.

const SITE_POLL = 30_000;
const ALL_POLL = 45_000;
const PEOPLE_POLL = 60_000;

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

// What kind of place a source is, for the colour of its badge.
export function sourceKind(src) {
  const s = String(src || '').toLowerCase();
  if (!s) return 'none';
  if (s === '(direct)' || s === 'direct') return 'direct';
  if (/chatgpt|openai|perplexity|claude|gemini|copilot|you\.com|phind/.test(s)) return 'ai';
  if (/google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|brave|startpage|qwant/.test(s)) return 'search';
  if (/reddit|twitter|x\.com|t\.co|facebook|instagram|linkedin|youtube|ycombinator|threads|bsky|mastodon|tiktok|pinterest|discord/.test(s)) return 'social';
  return 'link';
}
const SOURCE_NAME = (s) => (s === '(direct)' ? 'Direct' : s === '(not set)' ? 'Unknown' : /^[a-z]+$/.test(s || '') ? cap(s) : s);
const EVENT_NAME = (e) => ({ sign_up: 'Signed up', purchase: 'Bought', file_download: 'Downloaded', section_view: 'Scrolled through sections', downloads_section_view: 'Saw the downloads section', form_start: 'Started a form', form_submit: 'Sent a form', video_start: 'Played a video', view_search_results: 'Searched the site', generate_lead: 'Left their details', begin_checkout: 'Started checkout', add_to_cart: 'Added to cart', login: 'Logged in' }[e]
  || clicked(e)
  || e.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));
// "download_intent_click" → "Clicked download", "hero_cta_click" → "Clicked the main button".
function clicked(e) {
  const m = /^(.*?)_?(?:intent_)?click$/.exec(e.replace(/_intent_click$/, '_click'));
  if (!m || !m[1]) return '';
  const what = m[1].replace(/^hero_?cta$|^cta$|^hero$/, 'the main button').replace(/_?cta$/, ' button').replace(/_/g, ' ').trim();
  return `Clicked ${what}`;
}
// ["Google", "Direct", "Google"] → [{ name: 'Google', users: 2 }, …]
const tally = (names) => [...names.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map())].map(([name, users]) => ({ name, users })).sort((a, b) => b.users - a.users);
const minAgo = (m) => (m === 0 ? 'now' : `${m} min ago`);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function LivePage({ site }) {
  const { data, error, at } = usePoll(`/sites/${site.id}/live/detail`, SITE_POLL);
  // One row per visitor where the site streams GA4 into BigQuery.
  const streamed = Boolean(site.bq && !site.demo);
  const crowd = usePoll(`/sites/${site.id}/live/people`, PEOPLE_POLL, streamed);
  const people = crowd.data?.available ? crowd.data.people : null;
  const updated = useAgo(at);
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;
  if (!data && error) return <ErrorState error={error} />;
  if (!data) return <OwlLoader label="Asking Google Analytics who’s on the site…" />;
  const max = Math.max(1, ...data.perMinute);
  const wins = data.wins ? data.wins.reduce((n, w) => n + w.count, 0) : null;
  const top = data.pages?.[0];
  return (
    <>
      <section class="lv-night" aria-label="Right now">
        <div class="lv-top">
          <div class="lv-count">
            <span class={`lv-pulse${data.now ? ' on' : ''}`} aria-hidden="true" />
            <b>{fmt(data.now)}</b>
            <span>
              <span>{data.now === 1 ? 'person' : 'people'} on {site.label} right now</span>
              <small>{data.now && top ? `Most on “${top.title}”` : 'Last 5 minutes'}</small>
            </span>
          </div>
          <div class="lv-side">
            <div class="lv-stat"><b>{fmt(data.last30)}</b><small>last 30 min</small></div>
            {wins !== null && <div class="lv-stat"><b class="amber">{fmt(wins)}</b><small>{wins === 1 ? 'goal reached' : 'goals reached'}</small></div>}
            <div class="lv-spark">
              <div class="lv-bars" role="img" aria-label={`People each minute for the last 30 minutes, ${data.perMinute[29]} this minute`}>
                {data.perMinute.map((n, i) => <i key={i} style={{ height: `${Math.max(8, (n / max) * 100)}%` }} title={`${i === 29 ? 'This minute' : `${29 - i} min ago`}: ${fmt(n)}`} />)}
              </div>
              <small>each minute, last 30</small>
            </div>
          </div>
        </div>
        {people ? <LiveMap feed={people.map(personPlace)} phone={phone} /> : data.feed && <LiveMap feed={data.feed} phone={phone} />}
        <p class="lv-meta">Updates every 30 seconds{updated ? ` · checked ${updated}` : ''}{error ? ' · the last refresh failed, showing the one before' : ''}</p>
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

      {people ? <People people={people} wins={data.wins} /> : <Feed data={data} streamed={streamed} reason={crowd.data?.reason} loading={streamed && !crowd.data && !crowd.error} />}

      <section class="card card-plain lv-grid" aria-label="Breakdown">
        <Mini title="Reading now" icon="pages" kind="page" rows={data.pages.map((p) => ({ name: p.title, users: p.users }))} empty="Nobody reading" />
        <Mini title="Countries" icon="globe" kind="country" rows={data.countries} empty="Nobody yet" />
        <Mini title="Sources" icon="arrows" kind="source" rows={people ? tally(people.map((p) => p.source || '(not set)')) : data.sources} empty={people || data.sources ? 'Nobody yet' : 'Google doesn’t give this live'} />
        <Mini title="Devices" icon="monitor" kind="device" rows={data.devices} empty="Nobody yet" />
      </section>

      {!data.scopedByStream && !site.demo && (
        <p class="muted nx-live-note">This counts the whole Google Analytics property. Name this site’s data stream on its Edit page to count only {site.host || site.label}.</p>
      )}
    </>
  );
}

// Every group of visitors in the last 30 minutes, newest first, with goals
// reached in between. Google gives counts per place and page, not single people.
function Feed({ data, streamed, reason, loading }) {
  const [all, setAll] = useState(false);
  if (!data.feed) {
    return <section class="card card-plain"><h2 class="nx-h2">Just now</h2><p class="muted m-0">Google Analytics didn’t give a breakdown by place and page for this property, so only the totals above are live.</p></section>;
  }
  const items = [
    ...data.feed.map((r) => ({ kind: 'visit', ...r })),
    ...(data.wins || []).map((w) => ({ kind: 'win', ...w })),
  ].sort((a, b) => a.ago - b.ago || (a.kind === 'win' ? -1 : 1));
  const shown = all ? items : items.slice(0, 12);
  const kinds = new Set(data.feed.map((r) => sourceKind(r.source)));
  return (
    <section class="lv-sec" aria-label="Just now">
      <div class="lv-sh"><h2 class="nx-h2">Just now</h2><p class="muted">Everyone in the last 30 minutes, newest first, grouped by place and page</p></div>
      <div class="card card-plain lv-feed">
        {!items.length && <p class="muted lv-empty">Nobody in the last 30 minutes.</p>}
        {shown.map((x, i) => (x.kind === 'win' ? (
          <div class="lv-fi lv-person win" key={`w${i}`}>
            <span class="lv-who lv-owl goal fresh" aria-hidden="true"><Owl seed={`${x.event}${i}`} awake /><span class="lv-badge"><Icon name="check" size={9} /></span></span>
            <span class="lv-fw"><span><b>{EVENT_NAME(x.event)}</b>{x.count > 1 ? <span class="muted"> · {x.count} times</span> : ''}</span><small>A goal on the site</small></span>
            <span class="lv-fo"><span class="nx-pill good">Goal</span><small>{minAgo(x.ago)}</small></span>
          </div>
        ) : (
          <div class="lv-fi lv-person" key={`v${i}`}>
            <span class={`lv-who lv-owl src-${sourceKind(x.source)}${x.ago < 5 ? ' fresh' : ''}`} title={`${x.source ? `From ${SOURCE_NAME(x.source)}` : 'Source not given'} · ${x.ago < 5 ? 'in the last 5 minutes' : 'earlier'}`}>
              <Owl seed={`${x.city}${x.country}${x.page}${x.ago}`} awake={x.ago < 5} />
              {DEVICE_ICON[x.device] && <span class="lv-dev"><Icon name={DEVICE_ICON[x.device]} size={10} /></span>}
            </span>
            <span class="lv-fw">
              <span><b>{x.city || x.country}</b>{x.city && <span class="muted"> {x.country}</span>}</span>
              <small>{x.page}{x.source ? ` · from ${SOURCE_NAME(x.source)}` : ''}{x.device ? ` · ${cap(x.device)}` : ''}</small>
            </span>
            <span class="lv-fo"><span>{people(x.users)}</span><small>{minAgo(x.ago)}</small></span>
          </div>
        )))}
        {items.length > 12 && <button type="button" class="link-btn lv-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${items.length}`}</button>}
      </div>
      {!loading && <p class="muted small m-0">{streamed && reason === 'no-streaming'
        ? 'To see each visitor (browser, phone or desktop, where from, every page), turn on “Streaming” in Google Analytics → Admin → BigQuery links for this property.'
        : 'Google’s live data only gives counts. To see each visitor with their browser and every page, link this site’s GA4 BigQuery export with streaming on (Edit site → BigQuery).'}</p>}
      {data.feed.some((r) => r.source) && (
        <div class="lv-legend">
          {[['search', 'Search'], ['ai', 'AI answers'], ['social', 'Social'], ['direct', 'Direct'], ['link', 'Other sites']].filter(([k]) => kinds.has(k)).map(([k, l]) => <span key={k}><span class={`lv-who lv-owl sm src-${k} fresh`}><Owl seed={k} awake still /></span>{l}</span>)}
          <span class="muted">· eyes shut: not in the last 5 minutes</span>
        </div>
      )}
    </section>
  );
}

// GA4's country name → its code, for the map and the badge.
const REGION = (() => {
  const out = {};
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    for (let a = 65; a <= 90; a += 1) for (let b = 65; b <= 90; b += 1) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      // First code wins: FR before the old FX (“Metropolitan France”), which some engines also call France.
      if (name && name !== code && !out[name]) out[name] = code;
    }
  } catch { /* no Intl.DisplayNames: badges show ·· */ }
  out['United States'] = 'US';
  out['United Kingdom'] = 'GB';
  out['South Korea'] = 'KR';
  out.Czechia = 'CZ';
  out.Türkiye = 'TR';
  return out;
})();
const minsAgo = (ms) => Math.max(0, Math.floor((Date.now() - ms) / 60_000));
function personPlace(p) {
  return { ago: minsAgo(p.last), code: REGION[p.country] || '', country: p.country || '(not set)', city: p.city, users: 1 };
}
const OS = { Macintosh: 'Mac', 'Chrome OS': 'ChromeOS', 'Windows': 'Windows', 'iOS': 'iPhone', 'Android': 'Android', 'Linux': 'Linux' };
// "Getting Started with CoolDesk — Install, Spaces and Shortcuts" → "Getting Started with CoolDesk".
const shortTitle = (pg) => {
  const t = (pg.title || '').split(/\s[—|·–-]\s|:\s/)[0].trim();
  return pg.path === '/' ? 'Home' : t && t.length <= 48 ? t : pg.path;
};
const forHow = (p) => {
  const s = Math.round((p.last - p.first) / 1000);
  return s < 10 ? '' : s < 60 ? `for ${s}s` : `for ${Math.round(s / 60)} min`;
};

// What a visitor is up to, as one icon: a goal reached, a click toward one,
// looking at downloads, browsing several pages, or reading one.
function doing(p) {
  const goal = p.did.find((d) => d.kind === 'goal');
  if (goal) return { icon: 'check', tone: 'goal', label: EVENT_NAME(goal.name) };
  const intents = p.did.filter((d) => d.kind === 'intent');
  const intent = intents.find((d) => /download|install/.test(d.name)) || intents[0];
  if (intent) return { icon: /download|install/.test(intent.name) ? 'download' : 'target', tone: 'intent', label: EVENT_NAME(intent.name) };
  const look = p.did.find((d) => /download|install|pricing|checkout|signup|sign_up/.test(d.name));
  if (look) return { icon: 'download', tone: 'look', label: EVENT_NAME(look.name) };
  if (p.pages.length > 1) return { icon: 'pages', tone: 'browse', label: `Browsing · ${p.pages.length} pages` };
  return { icon: 'eye', tone: 'read', label: 'Reading' };
}
const DEVICE_ICON = { mobile: 'phone', tablet: 'tablet', desktop: 'monitor' };

// One small Kauzl owl per visitor, in the colour of what they're doing. Awake
// (active in the last 5 minutes) it looks around and blinks; idle, it dozes.
// Each visitor's owl tilts its head and looks its own way, from their id.
function Owl({ seed = '', awake, still }) {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tilt = still ? 0 : (h % 17) - 8;
  const dx = still ? 0 : ((h >> 5) % 5) - 2;
  const dy = still ? 0 : ((h >> 9) % 3) - 1;
  const delay = `-${(h % 40) / 10}s`;
  return (
    <svg class="lv-owl-svg" viewBox="0 0 64 64" aria-hidden="true" style={{ transform: `rotate(${tilt}deg)` }}>
      <path class="lv-owl-body" d="M11 26 L12 6 L25 15 Q32 13 39 15 L52 6 L53 26 Q56 34 56 38 Q56 58 32 58 Q8 58 8 38 Q8 34 11 26 Z" />
      <circle class="lv-owl-disc" cx="22.5" cy="34" r="10" />
      <circle class="lv-owl-disc" cx="41.5" cy="34" r="10" />
      {awake ? (
        <g class="lv-owl-eyes" style={{ animationDelay: delay }}>
          <circle cx={22.5 + dx} cy={34 + dy} r="4.6" class="lv-owl-ring" />
          <circle cx={41.5 + dx} cy={34 + dy} r="5.2" class="lv-owl-amber" />
        </g>
      ) : (
        <g class="lv-owl-shut">
          <path d="M16.5 35 Q22.5 39 28.5 35" />
          <path d="M35.5 35 Q41.5 39 47.5 35" />
        </g>
      )}
      <path class="lv-owl-amber" d="M32 44.5 L29 48 L32 52 L35 48 Z" />
    </svg>
  );
}

// Everyone in the last 30 minutes, one row each, newest first.
function People({ people }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState('');
  const shown = all ? people : people.slice(0, 12);
  return (
    <section class="lv-sec" aria-label="Just now">
      <div class="lv-sh"><h2 class="nx-h2">Just now</h2><p class="muted">Everyone in the last 30 minutes, newest first · from the BigQuery stream, about a minute behind</p></div>
      <div class="card card-plain lv-feed">
        {!people.length && <p class="muted lv-empty">Nobody in the last 30 minutes.</p>}
        {shown.map((p) => {
          const goal = p.did.find((d) => d.kind === 'goal');
          const intent = p.did.filter((d) => d.kind === 'intent').sort((a, b) => /download|install/.test(b.name) - /download|install/.test(a.name))[0];
          const fresh = minsAgo(p.last) < 5;
          const state = doing(p);
          const on = [p.browser, OS[p.os] || p.os].filter(Boolean).join(' on ');
          const isOpen = open === p.id;
          return (
            <div class={`lv-fi lv-person${goal ? ' win' : ''}`} key={p.id}>
              <span class={`lv-who lv-owl ${state.tone}${fresh ? ' fresh' : ''}`} title={`${state.label} · ${cap(p.device) || 'Unknown device'} · from ${SOURCE_NAME(p.source)}`}>
                <Owl seed={p.id} awake={fresh} />
                {(state.tone === 'goal' || state.tone === 'intent') && <span class="lv-badge"><Icon name={state.icon} size={9} /></span>}
                {DEVICE_ICON[p.device] && <span class="lv-dev"><Icon name={DEVICE_ICON[p.device]} size={10} /></span>}
              </span>
              <span class="lv-fw">
                <span><b>{p.city || p.country || 'Somewhere'}</b>{p.city && p.country && <span class="muted"> {p.country}</span>}{p.new && <span class="nx-pill lv-new">New</span>}</span>
                <small>{[on, cap(p.device), `from ${SOURCE_NAME(p.source)}`].filter(Boolean).join(' · ')}</small>
                <button type="button" class="lv-path" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : p.id)} title="Every page and event">
                  {p.pages.length ? p.pages.map(shortTitle).join(' → ') : 'No page view yet'}
                  {p.did.filter((d) => d.kind !== 'other' || p.did.length <= 2).slice(0, 3).map((d) => <span key={d.name} class={`nx-pill${d.kind === 'goal' ? ' good' : ''}`}>{EVENT_NAME(d.name)}</span>)}
                </button>
                {isOpen && (
                  <ol class="lv-steps">
                    {[...p.pages.map((pg) => ({ ms: pg.ms, text: `Opened ${shortTitle(pg)}`, sub: pg.path })), ...p.did.map((d) => ({ ms: d.ms, text: EVENT_NAME(d.name), sub: d.kind === 'goal' ? 'goal' : '' }))]
                      .sort((a, b) => a.ms - b.ms).map((x, i) => (
                        <li key={i}><span class="muted">{new Date(x.ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> {x.text}{x.sub && <span class="muted"> · {x.sub}</span>}</li>
                      ))}
                  </ol>
                )}
              </span>
              <span class="lv-fo">
                {goal ? <span class="nx-pill good">{EVENT_NAME(goal.name)}</span> : intent ? <span class="nx-pill">{EVENT_NAME(intent.name)}</span> : <span class={fresh ? 'good' : 'muted'}>{fresh ? `${state.tone === 'browse' ? 'Browsing' : state.tone === 'look' ? 'Looking at downloads' : 'Reading'} now` : `${p.pages.length || 1} page${p.pages.length === 1 ? '' : 's'}`}</span>}
                <small>{minAgo(minsAgo(p.last))}{forHow(p) ? ` · ${forHow(p)}` : ''}</small>
              </span>
            </div>
          );
        })}
        {people.length > 12 && <button type="button" class="link-btn lv-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${people.length}`}</button>}
      </div>
      {people.length > 0 && <div class="lv-legend">
        {[['check', 'goal', 'Reached a goal'], ['download', 'intent', 'Clicked to download'], ['download', 'look', 'Looking at downloads'], ['pages', 'browse', 'Browsing'], ['eye', 'read', 'Reading']].map(([icon, tone, l]) => <span key={tone}><span class={`lv-who lv-owl sm ${tone} fresh`}><Owl seed={tone} awake still /></span>{l}</span>)}
        <span class="muted">· corner: phone or desktop · eyes shut: not active in the last 5 minutes · click a row for every step</span>
      </div>}
    </section>
  );
}

// One column of the breakdown: what each row is, its share of everyone, and a
// thin bar for that share. Empty, a dozing owl says so.
const FLAG = (code) => (code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '');
function Mini({ title, icon, kind, rows, empty }) {
  const list = (rows || []).filter((r) => r.users > 0);
  const sum = list.reduce((n, r) => n + r.users, 0) || 1;
  const lead = (r) => {
    if (kind === 'country') return <span class="lv-mflag" aria-hidden="true">{FLAG(REGION[r.name]) || <Icon name="globe" size={13} />}</span>;
    if (kind === 'device') return <span class="lv-mico" aria-hidden="true"><Icon name={DEVICE_ICON[String(r.name).toLowerCase()] || 'monitor'} size={13} /></span>;
    if (kind === 'source') return <span class={`lv-mdot src-${sourceKind(r.name)}`} aria-hidden="true" />;
    return <span class="lv-mico" aria-hidden="true"><Icon name="pages" size={13} /></span>;
  };
  const label = (r) => (kind === 'device' ? cap(r.name) : kind === 'source' ? SOURCE_NAME(r.name) : r.name);
  return (
    <div class="lv-mbox">
      <div class="lv-mhead">
        <span class="lv-mhi"><Icon name={icon} size={13} /></span>
        <h3>{title}</h3>
        {list.length > 0 && <span class="lv-mtot">{fmt(sum)}</span>}
      </div>
      {list.length ? list.slice(0, 4).map((r) => {
        const pct = Math.round((r.users / sum) * 100);
        return (
          <div class="lv-mrow" key={r.name} title={`${label(r)}: ${people(r.users)} · ${pct}%`}>
            {lead(r)}
            <span class="lv-mname">{label(r)}</span>
            <span class="lv-mnum"><b>{fmt(r.users)}</b><small>{pct}%</small></span>
            <span class="lv-mbar"><i style={{ width: `${pct}%` }} /></span>
          </div>
        );
      }) : (
        <div class="lv-mempty"><span class="lv-who lv-owl read" aria-hidden="true"><Owl seed={title} still /></span><span>{empty}</span></div>
      )}
      {list.length > 4 && <small class="muted">and {list.length - 4} more</small>}
    </div>
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
      <section class="lv-night" aria-label="Right now">
        <div class="lv-top">
          <div class="lv-count">
            <span class={`lv-pulse${data.total ? ' on' : ''}`} aria-hidden="true" />
            <b>{fmt(data.total)}</b>
            <span>
              <span>{data.total === 1 ? 'person' : 'people'} on your sites right now</span>
              <small>{data.total && data.sites[0]?.now ? `Most on ${label(data.sites[0].id) || data.sites[0].label}` : 'Last 5 minutes'}</small>
            </span>
          </div>
        </div>
        <p class="lv-meta">Updates every 45 seconds{updated ? ` · checked ${updated}` : ''} · open a site for its map and who’s on it</p>
      </section>
      <section class="lv-sec" aria-label="By site">
        <div class="lv-sh"><h2 class="nx-h2">By site</h2><p class="muted">Open one for its map and feed</p></div>
        <div class="lv-sites">
          {data.sites.map((s) => (
            <a key={s.id} href={`#/site/${s.id}/live`} class="lv-scard">
              <span class="lv-sch"><span class={`nx-live-dot${s.now ? ' on' : ''}`} aria-hidden="true" /><b>{label(s.id) || s.label}</b></span>
              <b class="lv-scn">{s.now == null ? '–' : fmt(s.now)}</b>
              <small>{s.error ? s.error : s.top ? `Most read: ${s.top}` : s.now ? s.host : 'Quiet'}</small>
            </a>
          ))}
        </div>
        {!data.sites.length && <p class="muted nx-live-note">Link a Google Analytics property to a site to see who is on it.</p>}
      </section>
    </>
  );
}
