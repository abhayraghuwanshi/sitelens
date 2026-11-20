import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo } from '../components/Todos.jsx';
import { Drawer, hrefWith } from './Drawer.jsx';

// Search: the short answer, then a ladder (one row per search, from Top 3 to
// Not showing, a dot where it ranks now, a ring where Google and Bing disagree),
// the searches the engines disagree on, the three closest to paying off, and
// every search as a list on demand. A search opens in the drawer (?q=).
const ENGINES = [{ key: 'both', label: 'Both' }, { key: 'google', label: 'Google' }, { key: 'bing', label: 'Bing' }];
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
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

// The engine switch, in the page header next to the period (Section puts it there).
export const engineOf = (params) => (ENGINES.some((e) => e.key === params.get('eng')) ? params.get('eng') : 'both');
export const engineSub = (eng) => (eng === 'google' ? 'Google only' : eng === 'bing' ? 'Bing only' : 'Google and Bing together');
export function EngineSwitch({ params }) {
  const set = (key) => { location.hash = hrefWith('eng', key === 'both' ? '' : key).slice(1); };
  return <Segmented label="Search engine" value={engineOf(params)} options={ENGINES} onChange={set} />;
}

export function SearchView({ site, range, params }) {
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
    .map((r) => ({ ...r, pos: posOf(r, eng), was: beforeOf(r, eng), s: stateOf(r, eng), d: eng === 'both' && both ? disagree(r, h.queries) : null, page: pageFor.get(r.key)?.path || '' }))
    .filter((r) => eng === 'both' || (eng === 'google' ? r.google : r.bing));
  const total = rows.reduce((n, r) => n + clicksOf(r, eng), 0);
  const close = rows.filter((r) => (r.s.k === 'p1' || r.s.k === 'p2') && r.s.gain > 0).sort((a, b) => b.s.gain - a.s.gain);
  const best = [...rows].sort((a, b) => clicksOf(b, eng) - clicksOf(a, eng))[0];
  const gain = close.reduce((n, r) => n + r.s.gain, 0);
  const split = rows.filter((r) => r.d).sort((a, b) => b.impressions - a.impressions);
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
      {errors.length > 0 && <p class="nx-note-line warn">{errors.map(([name, e]) => `${name}: ${e.message}`).join(' · ')}</p>}
      {rows.length ? (
        <p class="nx-answer">
          <b>{fmt(total)}</b> search clicks from {engName} in this period{best && clicksOf(best, eng) ? <>, most from “{best.key}” ({rank(best.pos)})</> : null}.
          {close.length > 0 && <> <b>{close.length}</b> searches are close: the top 3 for them would bring about <b>{fmt(gain)}</b> more visits.</>}
          {split.length > 0 && <> <b>{split.length}</b> do well on one engine and badly on the other.</>}
        </p>
      ) : <p class="nx-answer">No searches from {engName} in this period yet.</p>}

      {rows.length > 0 && (
        <section class="card card-plain nx-ladder" aria-label="Where each search ranks">
          <h2 class="nx-h2">Where each search ranks <span class="muted small">· further left is better{moved ? ' · arrows show the move since the period before' : ''}</span></h2>
          <div class="nx-lrow nx-lhead" aria-hidden="true">
            <span />
            <span class="nx-ltrack-h"><span style="left:1%">Top 3</span><span style="left:19%">Page 1</span><span style="left:51%">Page 2</span><span style="left:79%">Not showing</span></span>
            <span class="nx-num">Seen</span>
          </div>
          {shown.map((r) => (
            <a key={r.key} class={`nx-lrow${open === r.key ? ' on' : ''}`} href={hrefWith('q', r.key)}>
              <span class="nx-lname"><b>“{r.key}”</b>
                <small>{[r.page && pageName(r.page), r.pos != null && rank(r.pos), moveOf(r) && <span class={moveOf(r) === 'up' ? 'good' : 'bad'}>{moveOf(r)} from {rank(r.was)}</span>, r.d && <span class={r.d.near ? 'muted' : 'bad'}>{r.d.word.toLowerCase()}</span>].filter(Boolean).reduce((acc, x, i) => (i ? [...acc, ' · ', x] : [x]), [])}</small>
              </span>
              <span class="nx-ltrack" title={r.pos == null ? 'Not in the results yet' : `${rank(r.pos)} now${r.was != null ? `, ${rank(r.was)} the period before` : ''}`}>
                <span class="nx-lz" style="left:0;width:18%" /><span class="nx-lz alt" style="left:18%;width:32%" /><span class="nx-lz" style="left:50%;width:28%" /><span class="nx-lz alt" style="left:78%;width:22%" />
                {moveOf(r) && <span class={`nx-larr ${moveOf(r)}`} style={`left:${Math.min(xOf(r.was), xOf(r.pos))}%;width:${Math.abs(xOf(r.was) - xOf(r.pos))}%`}><i /></span>}
                <span class={`nx-ldot${r.pos == null ? ' gap' : ''}${r.d && !r.d.near ? ' dis' : ''}`} style={`left:${xOf(r.pos)}%`} />
              </span>
              <span class="nx-num">{fmt(seenOf(r, eng))}</span>
            </a>
          ))}
          <div class="nx-lfoot">
            <span class="nx-legend"><span><i class="dot" />Now</span>{moved && <><span><i class="ar up" />Moved up</span><span><i class="ar down" />Slipped</span></>}{eng === 'both' && both && <span><i class="ring" />Google and Bing disagree</span>}<span class="muted">Seen: times shown in results</span></span>
            {ladder.length > 10 && <button type="button" class="todo-link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${ladder.length}`}</button>}
          </div>
        </section>
      )}

      {split.length > 0 && (
        <section class="nx-block" aria-label="Google and Bing disagree">
          <h2 class="nx-h2">Google and Bing disagree <span class="muted small">· doing well on one engine and badly on the other</span></h2>
          <div class="card card-plain nx-tight">
            {split.slice(0, 8).map((r) => (
              <a key={r.key} class="nx-drow" href={hrefWith('q', r.key)}>
                <span class="nx-qn">“{r.key}”</span>
                <span class={`nx-eng${r.google ? '' : ' off'}`}>Google {rank(r.google?.position)}</span>
                <span class={`nx-eng${r.bing ? '' : ' off'}`}>Bing {rank(r.bing?.position)}</span>
                <b class={r.d.near ? 'muted' : 'bad'}>{r.d.word}</b>
              </a>
            ))}
            <p class="muted small m-0">Bing matters more than its clicks: ChatGPT search and Copilot lean on Bing’s index.</p>
          </div>
        </section>
      )}

      {close.length > 0 && (
        <section class="nx-block" aria-label="Next moves">
          <h2 class="nx-h2">Next moves <span class="muted small">· the {Math.min(3, close.length) === 1 ? 'search' : `${Math.min(3, close.length)} searches`} closest to paying off</span></h2>
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
  if (!unseen.length) return null;
  const v = vol.data || {};
  const list = [...unseen].sort((a, b) => (v[b.q] || 0) - (v[a.q] || 0));
  const max = Math.max(1, ...list.map((x) => v[x.q] || 0));
  const size = (n) => (n ? 0.95 + 0.55 * Math.sqrt(n / max) : 0.95);
  return (
    <section class="nx-block" aria-label="Gaps">
      <h2 class="nx-h2">Gaps <span class="muted small">· searches you aim for that nothing on your site shows up for{vol.data && Object.values(v).some(Boolean) ? ', sized by how often people search them' : ''}</span></h2>
      <div class="nx-gaps">
        {list.map((x) => (
          <span key={x.q} class="nx-gap" style={`font-size:${size(v[x.q]).toFixed(2)}rem`} title={`${x.topic} · neither Google nor Bing shows ${site.label} for it yet${v[x.q] ? ` · about ${fmt(v[x.q])} Bing searches a month` : ''}`}>
            “{x.q}”{v[x.q] ? <small>{fmt(v[x.q])}</small> : null}
          </span>
        ))}
      </div>
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
  const crawl = (() => {
    if (!r.d || !ix.data) return '';
    if (r.d.bad === 'Bing') {
      const b = ix.data.bing || {};
      return b.note ? '' : b.lastCrawled ? `Bing crawled ${pageName(r.page)} on ${b.lastCrawled}, so it has the page.` : b.known ? `Bing found ${pageName(r.page)} but hasn’t crawled it yet.` : `Bing doesn’t know ${pageName(r.page)} yet: submit it in Bing Webmaster Tools.`;
    }
    const g = ix.data.google || {};
    return g.note ? '' : g.indexed ? `Google has ${pageName(r.page)} indexed (crawled ${g.lastCrawled}).` : `Google: ${String(g.coverage || 'not indexed').toLowerCase()}.`;
  })();
  const ctr = (x) => (x?.impressions ? `${((x.clicks / x.impressions) * 100).toFixed(1)}%` : '—');
  const rowsOf = [
    ['Google', r.google], ['Bing', r.bing],
  ];
  return (
    <Drawer title={`“${r.key}”`} onClose={onClose}>
      <p class="nx-big">
        {r.pos == null ? 'Neither engine shows the site for it in this period.'
          : <>{r.page ? pageName(r.page) : 'The site'} shows up {[r.google && <>at <b>{rank(r.google.position)}</b> on Google</>, r.bing && <>at <b>{rank(r.bing.position)}</b> on Bing</>].filter(Boolean).reduce((acc, x, i) => (i ? [...acc, ' and ', x] : [x]), [])}, and got {fmt(clicksOf(r, 'both'))} clicks.
            {r.s.gain ? <> In the top 3 it would get about <b>{fmt(r.s.gain)}</b> more.</> : null}</>}
      </p>
      {r.d && <p class={`nx-note-line${r.d.near ? '' : ' warn'}`}><b>{r.d.word}.</b> <span>{r.d.why}{crawl ? ` ${crawl}` : ''}{r.d.bad === 'Bing' && !r.d.near ? ' ChatGPT search and Copilot lean on Bing, so this also costs AI answers.' : ''}</span></p>}
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
