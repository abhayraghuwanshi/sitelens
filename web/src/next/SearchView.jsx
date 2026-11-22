import { useEffect, useRef, useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo } from '../components/Todos.jsx';
import { Drawer, hrefWith } from './Drawer.jsx';
import { usePhoneWidth } from './Page.jsx';
import { HoverLayer } from './HoverChart.jsx';

// Search: the short answer, then a ladder (one row per search, from Top 3 to
// Not showing, a dot where it ranks now, a ring where Google and Bing disagree),
// the searches the engines disagree on, the three closest to paying off, and
// every search as a list on demand. A search opens in the drawer (?q=).
// One engine at a time: adding Google's and Bing's numbers together read as one engine and confused.
const ENGINES = [{ key: 'google', label: 'Google' }, { key: 'bing', label: 'Bing' }];
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const fmtDay = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
const rank = (p) => (p == null ? '—' : `#${Math.round(p)}`);
// A usual click rate by position, to size what moving up is worth (an estimate to rank them, not a forecast).
const ctrAt = (p) => (p == null ? 0 : p <= 1.5 ? 0.28 : p <= 2.5 ? 0.15 : p <= 3.5 ? 0.11 : p <= 5.5 ? 0.07 : p <= 10.5 ? 0.03 : p <= 20.5 ? 0.01 : 0.002);
const posOf = (r, eng) => {
  const g = r.google?.position ?? null;
  const b = r.bing?.position ?? null;
  return eng === 'google' ? g : eng === 'bing' ? b : g == null ? b : b == null ? g : Math.min(g, b);
};
// Where it ranked in the period before (null when it didn't show then).
const beforeOf = (r, eng) => {
  const g = r.google ? r.google.before ?? null : null;
  const b = r.bing ? r.bing.before ?? null : null;
  return eng === 'google' ? g : eng === 'bing' ? b : g == null ? b : b == null ? g : Math.min(g, b);
};
const clicksOf = (r, eng) => (eng === 'google' ? r.google?.clicks || 0 : eng === 'bing' ? r.bing?.clicks || 0 : (r.google?.clicks || 0) + (r.bing?.clicks || 0));
const seenOf = (r, eng) => (eng === 'google' ? r.google?.impressions || 0 : eng === 'bing' ? r.bing?.impressions || 0 : r.impressions || 0);
// A search's words, for spotting close wordings: lower case, plurals folded, filler dropped.
const FILLER = new Set(['for', 'the', 'a', 'an', 'to', 'in', 'on', 'of', 'and', 'with', 'vs', 'best', 'free', 'top']);
export const wordsOf = (q) => new Set(String(q).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !FILLER.has(w)).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)));
// Other searches one engine reports that say the same thing in other words (one's words inside the other's).
export function nearOn(r, all, engine) {
  const mine = wordsOf(r.key);
  if (!mine.size) return [];
  const inside = (a, b) => [...a].every((w) => b.has(w));
  return all.filter((o) => o.key !== r.key && o[engine]?.position != null)
    .filter((o) => { const w = wordsOf(o.key); return w.size && (inside(mine, w) || inside(w, mine)); })
    .sort((a, b) => (b[engine].impressions || 0) - (a[engine].impressions || 0)).slice(0, 3);
}
const listNear = (near, engine) => near.map((o) => `“${o.key}” (${rank(o[engine].position)})`).join(near.length > 2 ? ', ' : ' and ');
// The engines disagree: only one shows it, or they're 5+ places apart. An engine that reports
// nothing for this exact wording may still show the site for a close one: that's said, not "missing".
function disagree(r, all = []) {
  const g = r.google?.position ?? null;
  const b = r.bing?.position ?? null;
  if (g == null && b == null) return null;
  for (const [engine, name, pos] of [['bing', 'Bing', b], ['google', 'Google', g]]) {
    if (pos != null) continue;
    const near = nearOn(r, all, engine);
    return near.length
      ? { bad: name, word: `Other wording on ${name}`, why: `${name} reports nothing for this exact wording, but shows the site for ${listNear(near, engine)}.`, near }
      : { bad: name, word: `Missing on ${name}`, why: `${name} reports no searches for this wording in this period: it doesn’t show the site for it, or too rarely to be counted.` };
  }
  if (Math.abs(g - b) < 5) return null;
  return b > g ? { bad: 'Bing', word: 'Lower on Bing', why: `Bing ranks it ${Math.round(b - g)} places below Google.` } : { bad: 'Google', word: 'Lower on Google', why: `Google ranks it ${Math.round(g - b)} places below Bing.` };
}
function stateOf(r, eng) {
  const p = posOf(r, eng);
  const seen = seenOf(r, eng);
  const gain = Math.round(seen * Math.max(0, ctrAt(3) - ctrAt(p)));
  if (p == null) return { k: 'none', word: 'Not showing', gain: 0, tone: 'muted' };
  if (p <= 3.5) return { k: 'top', word: 'Top 3', gain: 0, tone: 'up' };
  if (p <= 10.5) return { k: 'p1', word: 'Page 1', gain, tone: '' };
  return { k: 'p2', word: p <= 20.5 ? 'Page 2' : 'Further back', gain, tone: 'down' };
}
// Where on the track a position sits (%).
const xOf = (p) => (p == null ? 91 : p <= 3 ? 2 + ((p - 1) / 2) * 14 : p <= 10 ? 20 + ((p - 4) / 6) * 28 : p <= 20 ? 52 + ((p - 11) / 9) * 26 : 80 + Math.min(p - 21, 6));
const pageName = (path) => (path === '/' ? 'Home page' : path);
// Where a rank sits, in words (the phone list says it instead of drawing the strip).
const zoneOf = (p) => (p == null ? ['Not showing', 'off'] : p <= 3.5 ? ['Top 3', 'top'] : p <= 10.5 ? ['Page 1', 'p1'] : p <= 20.5 ? ['Page 2', 'p2'] : ['Past page 2', 'off']);

// The engine switch, in the page header next to the period (Section puts it there).
export const engineOf = (params) => (params.get('eng') === 'bing' ? 'bing' : 'google');
export const engineSub = (eng) => (eng === 'bing' ? 'Bing search' : 'Google search');
export function EngineSwitch({ params }) {
  const set = (key) => { location.hash = hrefWith('eng', key === 'google' ? '' : key).slice(1); };
  return <Segmented label="Search engine" value={engineOf(params)} options={ENGINES} onChange={set} />;
}

export function SearchView({ site, range, params }) {
  const phone = usePhoneWidth();
  const hub = useAsync(() => api.get(`/sites/${site.id}/search-hub${qs({ range })}`), [site.id, range]);
  const ai = useAsync(() => api.get(`/ai-search/sites/${site.id}/checks`).catch(() => null), [site.id]);
  // Page titles for the Next-moves cards (paths are hard to read); paths until they arrive.
  const review = useAsync(() => api.get(`/sites/${site.id}/page-review${qs({ range })}`).catch(() => null), [site.id, range]);
  const eng = engineOf(params);
  const [all, setAll] = useState(false);
  const [list, setList] = useState(false);

  if (hub.error) return <ErrorState error={hub.error} onRetry={hub.reload} />;
  if (!hub.data) return <Loading height={320} owl label="Reading Google and Bing…" />;
  const h = hub.data;
  const pageFor = new Map();
  for (const qp of h.queryPages) if (!pageFor.has(qp.query) || pageFor.get(qp.query).impressions < qp.impressions) pageFor.set(qp.query, qp);
  // Comparing engines only means something when both answered.
  const both = !h.google?.error && !h.bing?.error;
  const rows = h.queries
    .map((r) => ({ ...r, pos: posOf(r, eng), was: beforeOf(r, eng), s: stateOf(r, eng), d: both ? disagree(r, h.queries) : null, page: pageFor.get(r.key)?.path || '' }))
    .filter((r) => eng === 'both' || (eng === 'google' ? r.google : r.bing));
  const total = rows.reduce((n, r) => n + clicksOf(r, eng), 0);
  const close = rows.filter((r) => (r.s.k === 'p1' || r.s.k === 'p2') && r.s.gain > 0).sort((a, b) => b.s.gain - a.s.gain);
  const best = [...rows].sort((a, b) => clicksOf(b, eng) - clicksOf(a, eng))[0];
  const gain = close.reduce((n, r) => n + r.s.gain, 0);
  // Missing on the other engine: this engine shows the site for it, the other doesn't at all (and no
  // other wording of it either). The one comparison worth acting on: submit the page, check its crawl.
  const other = eng === 'bing' ? 'Google' : 'Bing';
  const missingOf = (r) => Boolean(r.d && !r.d.near && r.d.bad === other && r.d.word.startsWith('Missing'));
  const split = rows.filter(missingOf).sort((a, b) => seenOf(b, eng) - seenOf(a, eng));
  // Moved: a whole place or more since the period before.
  const moveOf = (r) => (r.pos == null || r.was == null || Math.abs(r.was - r.pos) < 1 ? null : r.was > r.pos ? 'up' : 'down');
  const moved = rows.some((r) => moveOf(r));
  const ladder = [...rows].sort((a, b) => seenOf(b, eng) - seenOf(a, eng));
  const shown = all ? ladder : ladder.slice(0, 10);
  const open = params.get('q') || '';
  const opened = rows.find((r) => r.key === open);
  const titleOf = (path) => review.data?.rows?.find((x) => x.path === path)?.title || pageName(path);
  const engName = eng === 'google' ? 'Google' : eng === 'bing' ? 'Bing' : 'Google and Bing';
  const errors = [h.google?.error && ['Google', h.google.error], h.bing?.error && ['Bing', h.bing.error]].filter(Boolean);

  return (
    <div class="nx-search">
      <TrendLookup site={site} pages={review.data?.rows || []} known={new Set(rows.map((r) => r.key))} />
      {errors.length > 0 && <p class="nx-note-line warn">{errors.map(([name, e]) => `${name}: ${e.message}`).join(' · ')}</p>}
      {rows.length ? (
        <p class="nx-answer">
          <b>{fmt(total)}</b> search clicks from {engName} in this period{best && clicksOf(best, eng) ? <>, most from “{best.key}” ({rank(best.pos)})</> : null}.
          {close.length > 0 && <> <b>{close.length}</b> searches are close: the top 3 for them would bring about <b>{fmt(gain)}</b> more visits.</>}
          {split.length > 0 && <> <b>{split.length}</b> {split.length === 1 ? 'doesn’t' : 'don’t'} show you on {other} at all.</>}
        </p>
      ) : <p class="nx-answer">No searches from {engName} in this period yet.</p>}

      {rows.length > 0 && (
        <section class="card card-plain nx-ladder" aria-label="Where each search ranks">
          <h2 class="nx-h2">Where each search ranks <span class="nx-h2-sub">{phone ? 'your place in the results, most-seen searches first' : `further left is better${moved ? ' · arrows show the move since the period before' : ''}`}</span></h2>
          {phone ? (
            <div class="nx-mlist nx-rlist">
              {shown.map((r) => {
                const [zone, zk] = zoneOf(r.pos);
                const mv = moveOf(r);
                return (
                  <a key={r.key} class="nx-mrow" href={hrefWith('q', r.key)}>
                    <span class="nx-mrow-main">
                      <b>“{r.key}”</b>
                      <span class="nx-mrow-sub">
                        {mv && <span class={`nx-rmove ${mv}`}>{mv === 'up' ? '↑' : '↓'} from {rank(r.was)}</span>}
                        <span>{fmt(seenOf(r, eng))} seen</span>
                        {missingOf(r) && <span class="bad">missing on {other}</span>}
                      </span>
                    </span>
                    <span class={`nx-rpos ${zk}`}><b>{r.pos == null ? '—' : rank(r.pos)}</b><small>{zone}</small></span>
                    <Icon name="chevron" size={13} class="nx-mrow-go" />
                  </a>
                );
              })}
              {ladder.length > 10 && <button type="button" class="nx-mrow-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${ladder.length}`}</button>}
            </div>
          ) : <>
          <div class="nx-lrow nx-lhead" aria-hidden="true">
            <span />
            <span class="nx-ltrack-h"><span style="left:1%">Top 3</span><span style="left:19%">Page 1</span><span style="left:51%">Page 2</span><span style="left:79%">Not showing</span></span>
            <span class="nx-num">Seen</span>
          </div>
          {shown.map((r) => (
            <a key={r.key} class={`nx-lrow${open === r.key ? ' on' : ''}`} href={hrefWith('q', r.key)}>
              <span class="nx-lname"><b>“{r.key}”</b>
                <small>{[r.page && pageName(r.page), r.pos != null && rank(r.pos), moveOf(r) && <span class={moveOf(r) === 'up' ? 'good' : 'bad'}>{moveOf(r)} from {rank(r.was)}</span>, missingOf(r) && <span class="bad">missing on {other}</span>].filter(Boolean).reduce((acc, x, i) => (i ? [...acc, ' · ', x] : [x]), [])}</small>
              </span>
              <span class="nx-ltrack" title={r.pos == null ? 'Not in the results yet' : `${rank(r.pos)} now${r.was != null ? `, ${rank(r.was)} the period before` : ''}`}>
                <span class="nx-lz" style="left:0;width:18%" /><span class="nx-lz alt" style="left:18%;width:32%" /><span class="nx-lz" style="left:50%;width:28%" /><span class="nx-lz alt" style="left:78%;width:22%" />
                {moveOf(r) && <span class={`nx-larr ${moveOf(r)}`} style={`left:${Math.min(xOf(r.was), xOf(r.pos))}%;width:${Math.abs(xOf(r.was) - xOf(r.pos))}%`}><i /></span>}
                <span class={`nx-ldot${r.pos == null ? ' gap' : ''}${missingOf(r) ? ' dis' : ''}`} style={`left:${xOf(r.pos)}%`} />
              </span>
              <span class="nx-num">{fmt(seenOf(r, eng))}</span>
            </a>
          ))}
          <div class="nx-lfoot">
            <span class="nx-legend"><span><i class="dot" />Now</span>{moved && <><span><i class="ar up" />Moved up</span><span><i class="ar down" />Slipped</span></>}{split.length > 0 && <span><i class="ring" />Missing on {other}</span>}<span class="muted">Seen: times shown in results</span></span>
            {ladder.length > 10 && <button type="button" class="todo-link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${ladder.length}`}</button>}
          </div>
          </>}
        </section>
      )}

      {split.length > 0 && (
        <section class="nx-block" aria-label={`Missing on ${other}`}>
          <h2 class="nx-h2">Missing on {other} <span class="nx-h2-sub">{engName} shows you for these; {other} doesn’t show you at all</span></h2>
          <div class="nx-mlist">
            {split.slice(0, 8).map((r) => (
              <a key={r.key} class="nx-mrow" href={hrefWith('q', r.key)}>
                <span class="nx-mrow-main">
                  <b>“{r.key}”</b>
                  <span class="nx-mrow-sub"><span>{rank(r.pos)} on {engName}</span>{r.page && <span class="nx-mrow-path">{pageName(r.page)}</span>}</span>
                </span>
                <span />
                <Icon name="chevron" size={13} class="nx-mrow-go" />
              </a>
            ))}
            {other === 'Bing' && <p class="nx-miss-note">ChatGPT search and Copilot lean on Bing’s index, so a page Bing skips is also missing from their answers.</p>}
          </div>
        </section>
      )}

      {close.length > 0 && (
        <section class="nx-block" aria-label="Next moves">
          <h2 class="nx-h2">Next moves <span class="nx-h2-sub">the {Math.min(3, close.length) === 1 ? 'search' : `${Math.min(3, close.length)} searches`} closest to paying off</span></h2>
          <div class="nx-moves">
            {close.slice(0, 3).map((r) => (
              <a key={r.key} class="nx-move" href={hrefWith('q', r.key)}>
                <small class="nx-mvp"><span>{r.page ? titleOf(r.page) : 'No page tied to it'}</span><span>· {rank(r.pos)} now</span></small>
                <b>“{r.key}”</b>
                <span class="nx-mg"><b class="good">+{fmt(r.s.gain)}</b><small>visits {range === '28d' ? 'a month ' : ''}in the top 3</small></span>
              </a>
            ))}
          </div>
        </section>
      )}

      <Gaps site={site} />

      <button type="button" class="todo-link nx-listlink" aria-expanded={list} onClick={() => setList(!list)}>{list ? 'Hide the list' : 'See every search as a list'}</button>
      {list && <SearchList rows={rows} eng={eng} both={both} titleOf={titleOf} open={open} moveOf={moveOf} />}

      <div class="nx-cards2">
        <a class="card card-plain nx-linkcard" href={`#/site/${site.id}/search?tab=ai`}>
          <b class="nx-lc-h">AI answers</b>
          <span>{aiLine(ai.data, site)}</span>
          <span class="nx-go">See the questions →</span>
        </a>
        <a class="card card-plain nx-linkcard" href={`#/site/${site.id}/pages?tab=health`}>
          <b class="nx-lc-h">Indexing</b>
          <span>{h.bing?.crawl ? <>Bing hit <b>{fmt(h.bing.crawl.errorsInRange)}</b> crawl errors in this period{h.bing.crawl.errorsBefore != null ? `, against ${fmt(h.bing.crawl.errorsBefore)} the period before` : ''}.</> : 'Connect Bing Webmaster Tools to see how Bing crawls the site.'}</span>
          <span class="nx-go">Check each page →</span>
        </a>
      </div>

      <p class="muted small m-0">Click a search for the full detail. Extra visits are an estimate from a usual click-rate curve, to rank searches, not a forecast.</p>

      {opened && <QueryPanel site={site} r={opened} eng={eng} onClose={() => { location.hash = hrefWith('q', '').slice(1); }} />}
    </div>
  );
}

// Every search as one short list: what the ladder above leaves out (clicks,
// each engine's rank, the move), with quick filters. A row opens the drawer.
const LIST_FILTERS = [['all', 'All'], ['close', 'Close to the top 3'], ['down', 'Slipped'], ['bing', 'Missing on Bing'], ['new', 'New']];
function SearchList({ rows, eng, both, titleOf, open, moveOf }) {
  const [f, setF] = useState('all');
  const [all, setAll] = useState(false);
  const [as, setAs] = usePersistent('searchListAs', 'graph');
  const test = {
    all: () => true,
    close: (r) => (r.s.k === 'p1' || r.s.k === 'p2') && r.s.gain > 0,
    down: (r) => moveOf(r) === 'down',
    bing: (r) => both && r.google && !r.bing,
    new: (r) => r.pos != null && r.was == null,
  };
  const filters = LIST_FILTERS.map(([k, l]) => [k, l, rows.filter(test[k]).length]).filter(([k, , n]) => k === 'all' || n > 0);
  const byClicks = (a, b) => clicksOf(b, eng) - clicksOf(a, eng) || seenOf(b, eng) - seenOf(a, eng);
  const bySeen = (a, b) => seenOf(b, eng) - seenOf(a, eng) || clicksOf(b, eng) - clicksOf(a, eng);
  const list = rows.filter(test[f] || test.all).sort(as === 'graph' ? bySeen : byClicks);
  const shown = all ? list : list.slice(0, 15);
  const showEngines = eng === 'both';
  return (
    <section class="nx-block" aria-label="Every search">
      <div class="nx-slbar">
        <div class="nx-chips" role="group" aria-label="Show">
          {filters.map(([k, l, n]) => <button key={k} type="button" class={`nx-chip${f === k ? ' on' : ''}`} onClick={() => { setF(k); setAll(false); }}>{l} <span>{n}</span></button>)}
        </div>
        <Segmented label="Show as" value={as} options={[{ key: 'graph', label: 'Graph' }, { key: 'table', label: 'Table' }]} onChange={setAs} />
      </div>
      {as === 'graph' ? <SearchBars list={shown} eng={eng} titleOf={titleOf} open={open} more={list.length > 15 && <button type="button" class="todo-link nx-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>} /> : (
      <div class="card card-plain nx-tight">
        <div class={`nx-srow nx-thead${showEngines ? '' : ' one'}`} aria-hidden="true"><span>Search</span><span class="nx-num">Clicks</span>{showEngines ? <><span class="nx-num">Google</span><span class="nx-num">Bing</span></> : <span class="nx-num">Rank</span>}<span class="nx-num">Move</span></div>
        {shown.map((r) => {
          const m = moveOf(r);
          return (
            <a key={r.key} class={`nx-srow${showEngines ? '' : ' one'}${open === r.key ? ' on' : ''}`} href={hrefWith('q', r.key)}>
              <span class="nx-ob"><b>“{r.key}”</b><small class="muted">{r.page ? titleOf(r.page) : 'No page tied to it'}</small></span>
              <span class="nx-num">{fmt(clicksOf(r, eng))}</span>
              {showEngines ? <>
                <span class="nx-num">{rank(r.google?.position)}</span>
                <span class={`nx-num${both && r.google && !r.bing ? ' bad' : ''}`}>{rank(r.bing?.position)}</span>
              </> : <span class="nx-num">{rank(r.pos)}</span>}
              <span class={`nx-num ${m === 'up' ? 'good' : m === 'down' ? 'bad' : 'muted'}`}>{r.pos != null && r.was == null ? 'new' : m ? `${m === 'up' ? '↑' : '↓'} ${Math.round(Math.abs(r.was - r.pos))}` : '—'}</span>
            </a>
          );
        })}
        {list.length > 15 && <button type="button" class="todo-link nx-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
      </div>
      )}
    </section>
  );
}

// The same searches as bars: how often each showed the site (the light bar) and
// how many of those clicked (the dark part), with its rank at the end. Numbers on hover.
function SearchBars({ list, eng, titleOf, open, more }) {
  const max = Math.max(1, ...list.map((r) => seenOf(r, eng)));
  return (
    <div class="card card-plain nx-tight">
      <p class="nx-sbkey muted small m-0"><i class="seen" /> Seen in results <i class="clicked" /> Clicked <span>· rank at the end</span></p>
      {list.map((r) => {
        const seen = seenOf(r, eng);
        const clicks = clicksOf(r, eng);
        const w = (seen / max) * 100;
        return (
          <a key={r.key} class={`nx-sb${open === r.key ? ' on' : ''}`} href={hrefWith('q', r.key)}>
            <span class="nx-sbl"><b>“{r.key}”</b><small class="muted">{r.page ? titleOf(r.page) : 'No page tied to it'}</small></span>
            <span class="nx-sbt">
              <span class="nx-sbs" style={`width:${Math.max(0.5, w)}%`}><span class={`nx-sbc${clicks ? ' some' : ''}`} style={`width:${seen ? (clicks / seen) * 100 : 0}%`} /></span>
              <span class="nx-sbr">{rank(r.pos)}</span>
              <span class="nx-sbtip">Seen <b>{fmt(seen)}</b> times · <b>{fmt(clicks)}</b> click{clicks === 1 ? '' : 's'}{seen ? ` (${((clicks / seen) * 100).toFixed(1)}%)` : ''}{eng === 'both' ? ` · Google ${rank(r.google?.position)} · Bing ${rank(r.bing?.position)}` : ''}</span>
            </span>
          </a>
        );
      })}
      {more}
    </div>
  );
}

// Gaps: the target searches in .sitelens.yml (search.topics[].targets) that
// neither Google nor Bing shows the site for, sized by Bing's monthly volume.
function Gaps({ site }) {
  const topics = useAsync(() => api.get(`/sites/${site.id}/search-topics${qs({ range: '90d' })}`).catch(() => null), [site.id]);
  const unseen = (topics.data?.topics || []).flatMap((t) => (t.targets || []).filter((x) => x.status === 'unseen').map((x) => ({ q: x.query, topic: t.name })));
  const key = unseen.map((x) => x.q).join('|');
  const vol = useAsync(async () => {
    if (!unseen.length) return {};
    const out = {};
    for (let i = 0; i < unseen.length; i += 10) {
      const r = await api.get(`/search/keywords${qs({ q: unseen.slice(i, i + 10).map((x) => x.q).join(',') })}`).catch(() => null);
      for (const k of r?.keywords || []) out[k.keyword] = k.last4Weeks;
    }
    return out;
  }, [key]);
  const [pick, setPick] = useState('');
  if (!unseen.length) return null;
  const v = vol.data || {};
  const on = unseen.find((x) => x.q === pick);
  const list = [...unseen].sort((a, b) => (v[b.q] || 0) - (v[a.q] || 0));
  const max = Math.max(1, ...list.map((x) => v[x.q] || 0));
  const size = (n) => (n ? 0.95 + 0.55 * Math.sqrt(n / max) : 0.95);
  return (
    <section class="nx-block" aria-label="Gaps">
      <h2 class="nx-h2">Gaps <span class="nx-h2-sub">searches you aim for that nothing on your site shows up for{vol.data && Object.values(v).some(Boolean) ? ', sized by how often people search them' : ''}</span></h2>
      <div class="nx-gaps">
        {list.map((x) => (
          <button type="button" key={x.q} class={`nx-gap${pick === x.q ? ' on' : ''}`} aria-expanded={pick === x.q} style={`font-size:${size(v[x.q]).toFixed(2)}rem`} onClick={() => setPick(pick === x.q ? '' : x.q)}
            title={`${x.topic} · neither Google nor Bing shows ${site.label} for it yet${v[x.q] ? ` · about ${fmt(v[x.q])} Bing searches a month` : ''}`}>
            “{x.q}”{v[x.q] ? <small>{fmt(v[x.q])}</small> : null}
          </button>
        ))}
      </div>
      {on && (
        <div class="nx-gap-card" role="region" aria-label={`Gap: ${on.q}`}>
          <p class="m-0"><b>“{on.q}”</b> <span class="muted">· {on.topic}</span></p>
          <p class="m-0 muted small">Neither Google nor Bing shows {site.label} for it yet{v[on.q] ? <>. About <b>{fmt(v[on.q])}</b> Bing searches a month in the US.</> : vol.loading ? '.' : '. Bing has no numbers for it, so few people search this exact wording.'} A page that answers it is the way in.</p>
          <div class="nx-gap-act">
            <AddTodo site={site} class="btn primary" label="To-do: write a page for it" todo={{ title: `Write a page for “${on.q}”`, from: `gap:${on.q}`, subject: { kind: 'query', key: on.q }, link: '' }} />
            <button type="button" class="btn" onClick={() => dispatchEvent(new CustomEvent('kauzl:trend', { detail: on.q }))}><Icon name="trend" size={13} /> See its trend</button>
          </div>
        </div>
      )}
    </section>
  );
}

// The AI answers card: how often assistants name the site for the questions tracked.
function aiLine(d, site) {
  if (!d) return `Whether ChatGPT, Perplexity and the rest mention ${site.label} for the questions you track.`;
  const asked = (d.results || []).filter((r) => r.askedBy > 0);
  if (!d.prompts?.length) return 'No questions tracked yet. Add the questions people ask assistants, and Kauzl checks whether they name you.';
  if (!asked.length) return `${d.prompts.length} questions are set up, but the checks haven’t run yet.`;
  const named = asked.filter((r) => r.namedBy > 0).length;
  return <>{site.label} is named in <b>{named} of {asked.length}</b> questions you track.</>;
}

function QueryPanel({ site, r, eng, onClose }) {
  // When one engine reports nothing, say whether it has even read the page, rather than guess.
  const ix = useAsync(() => (r.d && r.page ? api.get(`/sites/${site.id}/index-status${qs({ path: r.page })}`).catch(() => null) : null), [site.id, r.key]);
  // How many people search this exact wording on Bing at all (Bing keyword research, US): often the
  // real reason Bing has no row is that nobody searches it there.
  const kw = useAsync(() => api.get(`/search/keywords${qs({ q: r.key })}`).catch(() => null), [r.key]);
  const trend = useAsync(() => api.get(`/sites/${site.id}/query-trend${qs({ q: r.key })}`).catch(() => null), [site.id, r.key]);
  const demand = (() => {
    const k = kw.data?.keywords?.[0];
    if (!k || r.d?.bad !== 'Bing') return '';
    const weeks = (k.weeks || []).slice(-8);
    const exact = weeks.reduce((n, w) => n + (w.impressions || 0), 0), broad = weeks.reduce((n, w) => n + (w.broad || 0), 0);
    if (!weeks.length || (!exact && !broad)) return { main: 'None', note: 'no searches at all in Bing’s US data' };
    const a = (n) => Math.round(n / 8) || '<1';
    return !exact ? { main: '0 a week', note: `for this exact wording, in the US${broad ? ` · about ${a(broad)} a week for longer searches that contain it` : ''}` }
      : { main: `~${a(exact)} a week`, note: 'in the US' };
  })();
  // Nobody searches it on Bing: Bing having no row is expected, not a gap to fix.
  const unsearched = Boolean(demand && (demand.main === 'None' || demand.main === '0 a week'));
  const crawl = (() => {
    if (!r.d || !ix.data) return null;
    if (r.d.bad === 'Bing') {
      const b = ix.data.bing || {};
      return b.note ? null : b.lastCrawled ? { main: 'Crawled', note: `${fmtDay(b.lastCrawled)} · Bing has ${pageName(r.page)}`, tone: 'good' } : b.known ? { main: 'Found, not crawled', note: pageName(r.page), tone: 'warn' } : { main: 'Not known', note: `submit ${pageName(r.page)} in Bing Webmaster Tools`, tone: 'bad' };
    }
    const g = ix.data.google || {};
    return g.note ? null : g.indexed ? { main: 'Indexed', note: `crawled ${fmtDay(g.lastCrawled)} · ${pageName(r.page)}`, tone: 'good' } : { main: 'Not indexed', note: String(g.coverage || '').toLowerCase(), tone: 'bad' };
  })();
  const ctr = (x) => (x?.impressions ? `${((x.clicks / x.impressions) * 100).toFixed(1)}%` : '—');
  const rowsOf = [
    ['Google', r.google], ['Bing', r.bing],
  ];
  return (
    <Drawer title={`“${r.key}”`} onClose={onClose}>
      <p class="nx-big">
        {r.pos == null ? 'Neither engine shows the site for it in this period.'
          : <>{r.page ? pageName(r.page) : 'The site'} shows up {[r.google && <>at <b>{rank(r.google.position)}</b> on Google</>, r.bing && <>at <b>{rank(r.bing.position)}</b> on Bing</>].filter(Boolean).reduce((acc, x, i) => (i ? [...acc, ' and ', x] : [x]), [])}, and got {fmt(clicksOf(r, 'both'))} {clicksOf(r, 'both') === 1 ? 'click' : 'clicks'}.
            {r.s.gain ? <> In the top 3 it would get about <b>{fmt(r.s.gain)}</b> more.</> : null}</>}
      </p>
      {r.d && (
        <section class={`qp-why${r.d.near || unsearched ? '' : ' warn'}`} aria-label={unsearched && !r.d.near ? 'Not searched on Bing' : r.d.word}>
          <span class={`nx-pill${r.d.near || unsearched ? '' : ' down'}`}>{unsearched && !r.d.near ? 'Not searched on Bing' : r.d.word}</span>
          <dl class="qp-facts">
            {demand && <><dt>Searches on Bing</dt><dd><b>{demand.main}</b><small>{demand.note}</small></dd></>}
            {r.d.near ? (
              <><dt>{r.d.bad} shows you for</dt><dd class="qp-near">{r.d.near.map((o) => (
                <a key={o.key} class="qp-chip" href={hrefWith('q', o.key)}>“{o.key}”<i>{rank(o[r.d.bad === 'Bing' ? 'bing' : 'google'].position)}</i></a>
              ))}</dd></>
            ) : <><dt>What {r.d.bad} says</dt><dd><small>{r.d.why}</small></dd></>}
            {crawl && <><dt>The page</dt><dd><b class={crawl.tone}>{crawl.main}</b><small>{crawl.note}</small></dd></>}
          </dl>
          {r.d.bad === 'Bing' && !r.d.near && !unsearched && <p class="muted small m-0">ChatGPT search and Copilot lean on Bing, so this also costs AI answers.</p>}
        </section>
      )}
      <QueryTrend days={trend.data?.days} from={trend.data?.from} to={trend.data?.to} bingWeeks={kw.data?.keywords?.[0]?.weeks} loading={trend.loading} />
      <table class="nx-mini-table">
        <thead><tr><th /><th>Position</th><th>Seen</th><th>Clicks</th><th>Click rate</th></tr></thead>
        <tbody>
          {rowsOf.map(([name, x]) => (
            <tr key={name}><th>{name}</th><td>{x ? rank(x.position) : '—'}</td><td>{x ? fmt(x.impressions) : '—'}</td><td>{x ? fmt(x.clicks) : '—'}</td><td>{ctr(x)}</td></tr>
          ))}
        </tbody>
      </table>
      <p class="muted small m-0">Where it stands{eng !== 'both' ? ` on ${eng === 'google' ? 'Google' : 'Bing'}` : ''}: <span class={`nx-pill ${r.s.tone}`}>{r.s.word}</span></p>
      <div class="nx-btns">
        {r.page && <a class="btn" href={`#/site/${site.id}/pages?article=${encodeURIComponent(r.page)}`}><Icon name="pages" size={13} /> Open the page</a>}
        <AddTodo site={site} todo={{ title: `Move up for “${r.key}”${r.page ? ` (${r.page})` : ''}`, from: `search:${r.key}`, subject: { kind: 'query', key: r.key }, link: r.page ? `#/site/${site.id}/pages?article=${encodeURIComponent(r.page)}` : '' }} label="To-do: move it up" />
      </div>
    </Drawer>
  );
}

// A search over 13 weeks, as two small panels on the same weeks: how many searched it (Google, and
// Bing's US data when it has any), and where you ranked on Google (#1 at the top). The headline numbers
// sit above; each line is labelled at its ends; one hover reads out a week across both.
function QueryTrend({ days, to, bingWeeks, loading, market = 'US' }) {
  if (!days) return loading ? <div class="qt qt-load" aria-hidden="true" /> : null;
  if (!days.length) return null;
  const DAYMS = 86_400_000;
  const N = 13;
  const end = Date.parse(`${to}T00:00:00Z`);
  const weekOf = (d) => N - 1 - Math.floor((end - Date.parse(`${d}T00:00:00Z`)) / (7 * DAYMS));
  const W = Array.from({ length: N }, (_, i) => ({ start: new Date(end - (N - 1 - i) * 7 * DAYMS - 6 * DAYMS).toISOString().slice(0, 10), g: 0, pos: 0, b: 0 }));
  for (const d of days) {
    const i = weekOf(d.date);
    if (i < 0 || i >= N) continue;
    W[i].g += d.impressions || 0;
    W[i].pos += (d.position || 0) * (d.impressions || 0);
  }
  for (const w of W) w.p = w.g ? w.pos / w.g : null;
  for (const bw of bingWeeks || []) {
    const i = weekOf(new Date(Date.parse(`${bw.week}T00:00:00Z`) + 6 * DAYMS).toISOString().slice(0, 10));
    if (i >= 0 && i < N) W[i].b += Math.max(bw.broad || 0, bw.impressions || 0);
  }
  const hasBing = W.some((w) => w.b > 0);
  const sum = (a, b, k) => W.slice(a, b).reduce((n, w) => n + (w[k] || 0), 0);
  const gNow = sum(N - 4, N, 'g'), gBefore = sum(N - 8, N - 4, 'g');
  const change = gBefore ? Math.round((gNow / gBefore - 1) * 100) : null;
  const ps = W.filter((w) => w.p != null);
  const firstP = ps[0]?.p, lastP = ps.at(-1)?.p;
  const short = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const f = (v) => Math.round(v).toLocaleString('en-US');
  const X = (i) => (i / (N - 1)) * 100;

  // Searches panel: 0 at the bottom, a little headroom on top.
  const sMax = Math.max(1, ...W.map((w) => Math.max(w.g, w.b))) * 1.15;
  const SY = (v) => 100 - (v / sMax) * 100;
  const gLine = W.map((w, i) => `${X(i)},${SY(w.g)}`).join(' ');
  const bLine = W.map((w, i) => `${X(i)},${SY(w.b)}`).join(' ');
  // Position panel: #1 on top; the range covers the line and at least #1–#5.
  const pTop = 1, pBottom = Math.max(5, Math.ceil(Math.max(...ps.map((w) => w.p), 1)));
  const PY = (p) => ((p - pTop) / (pBottom - pTop)) * 100;
  const pLine = W.map((w, i) => (w.p == null ? null : `${X(i)},${PY(w.p)}`)).filter(Boolean).join(' ');
  // Guide lines with labels: #1 and the bottom always; #3/#10/#20 only with room (22px apart at the panel’s 64px).
  const POS_H = 64, GAP = 22;
  const guides = [1, pBottom];
  for (const g of [3, 10, 20]) {
    if (g >= pBottom) continue;
    const y = (PY(g) / 100) * POS_H;
    if (guides.every((o) => Math.abs((PY(o) / 100) * POS_H - y) >= GAP)) guides.push(g);
  }
  guides.sort((a, b) => a - b);
  const tip = (i) => [`Week of ${short(W[i].start)}`, `${f(W[i].g)} Google searches`, hasBing ? `${f(W[i].b)} Bing` : '', W[i].p != null ? `#${W[i].p.toFixed(1)}` : 'not shown'].filter(Boolean).join(' · ');
  const endLabel = (val, y, cls = '') => <span class={`qt-end ${cls}`} style={`top:${y}%`}>{val}</span>;

  return (
    <section class="qt" aria-label="Trend, 13 weeks">
      <div class="qt-stats">
        <div><small>Searches a week</small><b>{f(gNow / 4)}</b><span class={change == null ? 'muted' : change >= 10 ? 'good' : change <= -10 ? 'bad' : 'muted'}>{!gNow && !gBefore ? 'none for your site on Google' : change == null ? 'new' : `${change > 0 ? '↑' : change < 0 ? '↓' : ''}${Math.abs(change)}% vs 4 weeks before`}</span>{hasBing && <span class="muted">Bing ({market}): about {f(sum(N - 4, N, 'b') / 4)} a week</span>}</div>
        <div><small>Your Google position</small><b>{lastP != null ? `#${Math.round(lastP)}` : '—'}</b><span class={firstP != null && lastP != null && firstP - lastP >= 1 ? 'good' : firstP != null && lastP != null && lastP - firstP >= 1 ? 'bad' : 'muted'}>{firstP != null && lastP != null ? (Math.abs(firstP - lastP) >= 1 ? `was #${Math.round(firstP)} 13 weeks ago` : 'held for 13 weeks') : ''}</span></div>
      </div>
      <div class="qt-panels">
        <div class="qt-p">
          <small class="qt-pl">Searches a week{hasBing ? <> · <i class="qt-key g" />Google <i class="qt-key b" />Bing ({market} keyword data)</> : ` · Google · Bing’s ${market} keyword data has none`}</small>
          <div class="qt-box">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points={`0,100 ${gLine} 100,100`} class="qt-ga" />
              <polyline points={gLine} class="qt-gl" vector-effect="non-scaling-stroke" />
              {hasBing && <polyline points={bLine} class="qt-bl" vector-effect="non-scaling-stroke" />}
            </svg>
            {endLabel(f(W[0].g), SY(W[0].g), 'l')}
            {endLabel(f(W[N - 1].g), SY(W[N - 1].g), 'r')}
            <HoverLayer count={N} text={tip} />
          </div>
        </div>
        <div class="qt-p">
          <small class="qt-pl">Your Google position · #1 at the top</small>
          <div class="qt-box pos">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {guides.map((g) => <line key={g} x1="0" x2="100" y1={PY(g)} y2={PY(g)} class="qt-guide" vector-effect="non-scaling-stroke" />)}
              {pLine && <polyline points={pLine} class="qt-pline" vector-effect="non-scaling-stroke" />}
            </svg>
            {guides.map((g) => <span key={g} class="qt-gl-l" style={`top:${PY(g)}%`}>#{g}</span>)}
            {firstP != null && endLabel(`#${Math.round(firstP)}`, PY(firstP), 'l p')}
            {lastP != null && endLabel(`#${Math.round(lastP)}`, PY(lastP), 'r p')}
            <HoverLayer count={N} text={tip} />
          </div>
        </div>
      </div>
      <div class="qt-x"><span>{short(W[0].start)}</span><span>{short(to)}</span></div>
    </section>
  );
}

// Look up any search's trend, at the top of Search. Ideas come from the site's sitemap: each page's
// title (before " — " or ":") and the words in its address, busiest pages first. The trend is the
// same chart as a search's panel: Google = how often your site showed for it and where; Bing = how
// many people search it in the US (Bing's keyword data), so it works for wordings you don't rank for yet.
export function trendIdeas(pages, brand = '') {
  const strip = (t) => String(t || '').split(/\s+[—–|:-]\s+|:\s/)[0].replace(/\(\d{4}\)/g, '').replace(new RegExp(`\\b${brand}\\b`, 'ig'), '').replace(/\s+/g, ' ').trim().toLowerCase();
  const fromPath = (p) => (p === '/' ? '' : p.split('/').filter(Boolean).pop().replace(/[-_]+/g, ' ').toLowerCase());
  const seen = new Set();
  const out = [];
  for (const r of [...pages].filter((x) => x.inSitemap !== false).sort((a, b) => (b.visits || 0) - (a.visits || 0))) {
    for (const t of [strip(r.title), fromPath(r.path)]) {
      if (t.split(' ').length < 2 || t.length > 60 || seen.has(t)) continue;
      seen.add(t);
      out.push({ q: t, path: r.path });
    }
  }
  return out;
}

const MARKETS = [['us/en-US', 'US'], ['gb/en-GB', 'UK'], ['in/en-IN', 'India'], ['ca/en-CA', 'Canada'], ['au/en-AU', 'Australia'], ['de/de-DE', 'Germany']];
const GENERIC = new Set(['app', 'apps', 'best', 'free', 'online', 'download', 'for', 'the', 'a', 'to', 'how', 'what', 'and', 'of', 'in', 'on', 'with', 'vs']);

function TrendLookup({ site, pages, known }) {
  const brand = String(site.label || '').replace(/[^\w]/g, '');
  const ideas = trendIdeas(pages, brand);
  const phone = usePhoneWidth();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [market, setMarket] = usePersistent('trendMarket', 'us/en-US');
  const trend = useAsync(() => (q ? api.get(`/sites/${site.id}/query-trend${qs({ q })}`).catch(() => null) : null), [site.id, q]);
  const kw = useAsync(() => (q ? api.get(`/search/keywords${qs({ q, market })}`).catch(() => null) : null), [q, market]);
  const go = (v) => { const t = String(v || '').trim().toLowerCase(); if (t) { setText(t); setQ(t); } };
  // A gap (or anything else on the page) can ask for a search's trend: show it here, in view.
  const box = useRef(null);
  useEffect(() => {
    const on = (e) => { go(e.detail); box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    addEventListener('kauzl:trend', on);
    return () => removeEventListener('kauzl:trend', on);
  }, []);
  const k = kw.data?.keywords?.[0];
  const bingWeeks = k?.weeks || [];
  // Search Console returns a row for every day, zeros included: only days with impressions count as data.
  const googleDays = (trend.data?.days || []).filter((d) => d.impressions > 0);
  const bingHas = bingWeeks.some((w) => w.impressions || w.broad);
  const where = MARKETS.find(([m]) => m === market)?.[1] || 'US';
  // Related wordings Bing has numbers for, only when they share a real word with this one.
  const words = String(q).split(/\s+/).filter((w) => w && !GENERIC.has(w));
  const related = (k?.related || []).filter((r) => words.some((w) => r.keyword.toLowerCase().split(/\s+/).some((x) => x.startsWith(w.slice(0, 4))))).slice(0, 6);
  const loading = trend.loading || kw.loading;
  const trendsLink = `https://trends.google.com/trends/explore?date=today%203-m&q=${encodeURIComponent(q)}`;
  return (
    <section class="tlk" ref={box} aria-label="Look up a search’s trend">
      <form class="tlk-f" onSubmit={(e) => { e.preventDefault(); go(text); }}>
        <Icon name="trend" size={16} />
        <label class="sr-only" for="tlk-q">Look up a search’s trend</label>
        <input id="tlk-q" type="search" list="tlk-ideas" autocomplete="off" maxLength={120} value={text} placeholder={phone ? 'Look up a search’s trend' : 'Look up any search’s trend, e.g. “dock for windows”'} onInput={(e) => setText(e.currentTarget.value)} />
        <datalist id="tlk-ideas">{ideas.map((x) => <option key={x.q} value={x.q} />)}</datalist>
        <label class="sr-only" for="tlk-m">Country for Bing’s numbers</label>
        <select id="tlk-m" class="tlk-m" value={market} onChange={(e) => setMarket(e.currentTarget.value)} title="Country for Bing’s search numbers">
          {MARKETS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        <button type="submit" class="btn primary" disabled={!text.trim()}>{phone ? 'Go' : 'Trend'}</button>
        {q && <button type="button" class="nx-link" onClick={() => { setQ(''); setText(''); }}>Clear</button>}
      </form>
      {!q && ideas.length > 0 && (
        <div class="tlk-ideas"><small class="muted">From your sitemap:</small>{ideas.slice(0, phone ? 8 : 6).map((x) => <button key={x.q} type="button" class="nx-chip" onClick={() => go(x.q)} title={x.path}>{x.q}</button>)}</div>
      )}
      {q && (
        <div class="tlk-r">
          <div class="tlk-rh"><b>“{q}”</b><span class="tlk-links">{known.has(q) && <a class="todo-link small" href={hrefWith('q', q)}>Open its full detail →</a>}<a class="todo-link small" href={trendsLink} target="_blank" rel="noopener noreferrer">See it on Google Trends ↗</a></span></div>
          {loading ? <div class="qt qt-load" aria-hidden="true" />
            : !googleDays.length && !bingHas ? (
              <div class="tlk-none">
                <p class="m-0"><b>No numbers for this wording.</b></p>
                <ul class="tlk-why">
                  <li><b>Google:</b> your site hasn’t shown for it in 13 weeks. Kauzl only sees Google searches your site appears in (there’s no public Google Trends API), so check <a href={trendsLink} target="_blank" rel="noopener noreferrer">Google Trends ↗</a> for everyone’s.</li>
                  <li><b>Bing ({where}):</b> too few people search it for Bing to report. Try another country, or a shorter, more common wording.</li>
                </ul>
                {related.length > 0 && <div class="tlk-ideas"><small class="muted">Bing has numbers for:</small>{related.map((r) => <button key={r.keyword} type="button" class="nx-chip" onClick={() => go(r.keyword)}>{r.keyword} <span>{Math.round((r.impressions || r.broad) / 13).toLocaleString('en-US')}/wk</span></button>)}</div>}
              </div>
            )
            : <QueryTrend days={googleDays.length ? trend.data.days : [{ date: trend.data?.to || new Date().toISOString().slice(0, 10), impressions: 0 }]} to={trend.data?.to || new Date().toISOString().slice(0, 10)} bingWeeks={bingWeeks} market={where} />}
          <p class="muted small m-0">Google: how often your site showed for it, and where. Bing: everyone searching it in {where === 'US' ? 'the US' : where === 'UK' ? 'the UK' : where}.</p>
        </div>
      )}
    </section>
  );
}
