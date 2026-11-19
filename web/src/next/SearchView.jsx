import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AddTodo } from '../components/Todos.jsx';
import { SearchHub } from '../pages/SearchHub.jsx';
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
const clicksOf = (r, eng) => (eng === 'google' ? r.google?.clicks || 0 : eng === 'bing' ? r.bing?.clicks || 0 : (r.google?.clicks || 0) + (r.bing?.clicks || 0));
const seenOf = (r, eng) => (eng === 'google' ? r.google?.impressions || 0 : eng === 'bing' ? r.bing?.impressions || 0 : r.impressions || 0);
// The engines disagree: only one shows it, or they're 5+ places apart.
function disagree(r) {
  const g = r.google?.position ?? null;
  const b = r.bing?.position ?? null;
  if (g == null && b == null) return null;
  if (b == null) return { bad: 'Bing', word: 'Missing on Bing', why: 'Bing doesn’t show the site for it. It may not have crawled the page yet.' };
  if (g == null) return { bad: 'Google', word: 'Missing on Google', why: 'Google doesn’t show the site for it yet; the page may need links or time.' };
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

export function SearchView({ site, range, params }) {
  const hub = useAsync(() => api.get(`/sites/${site.id}/search-hub${qs({ range })}`), [site.id, range]);
  const eng = ENGINES.some((e) => e.key === params.get('eng')) ? params.get('eng') : 'both';
  const [all, setAll] = useState(false);
  const [list, setList] = useState(false);
  const setEng = (key) => { location.hash = hrefWith('eng', key === 'both' ? '' : key).slice(1); };

  if (hub.error) return <ErrorState error={hub.error} onRetry={hub.reload} />;
  if (!hub.data) return <Loading height={320} owl label="Reading Google and Bing…" />;
  const h = hub.data;
  const pageFor = new Map();
  for (const qp of h.queryPages) if (!pageFor.has(qp.query) || pageFor.get(qp.query).impressions < qp.impressions) pageFor.set(qp.query, qp);
  // Comparing engines only means something when both answered.
  const both = !h.google?.error && !h.bing?.error;
  const rows = h.queries
    .map((r) => ({ ...r, pos: posOf(r, eng), s: stateOf(r, eng), d: eng === 'both' && both ? disagree(r) : null, page: pageFor.get(r.key)?.path || '' }))
    .filter((r) => eng === 'both' || (eng === 'google' ? r.google : r.bing));
  const total = rows.reduce((n, r) => n + clicksOf(r, eng), 0);
  const close = rows.filter((r) => (r.s.k === 'p1' || r.s.k === 'p2') && r.s.gain > 0).sort((a, b) => b.s.gain - a.s.gain);
  const best = [...rows].sort((a, b) => clicksOf(b, eng) - clicksOf(a, eng))[0];
  const gain = close.reduce((n, r) => n + r.s.gain, 0);
  const split = rows.filter((r) => r.d).sort((a, b) => b.impressions - a.impressions);
  const ladder = [...rows].sort((a, b) => seenOf(b, eng) - seenOf(a, eng));
  const shown = all ? ladder : ladder.slice(0, 10);
  const open = params.get('q') || '';
  const opened = rows.find((r) => r.key === open);
  const engName = eng === 'google' ? 'Google' : eng === 'bing' ? 'Bing' : 'Google and Bing';
  const errors = [h.google?.error && ['Google', h.google.error], h.bing?.error && ['Bing', h.bing.error]].filter(Boolean);

  return (
    <div class="nx-search">
      <div class="nx-row-between">
        <Segmented label="Search engine" value={eng} options={ENGINES} onChange={setEng} />
        {errors.map(([name, e]) => <span key={name} class="muted small">{name}: {e.message}</span>)}
      </div>
      {rows.length ? (
        <p class="nx-answer">
          <b>{fmt(total)}</b> search clicks from {engName} in this period{best && clicksOf(best, eng) ? <>, most from “{best.key}” ({rank(best.pos)})</> : null}.
          {close.length > 0 && <> <b>{close.length}</b> searches are close: the top 3 for them would bring about <b>{fmt(gain)}</b> more visits.</>}
          {split.length > 0 && <> <b>{split.length}</b> do well on one engine and badly on the other.</>}
        </p>
      ) : <p class="nx-answer">No searches from {engName} in this period yet.</p>}

      {rows.length > 0 && (
        <section class="card card-plain nx-ladder" aria-label="Where each search ranks">
          <h2 class="nx-h2">Where each search ranks <span class="muted small">· further left is better</span></h2>
          <div class="nx-lrow nx-lhead" aria-hidden="true">
            <span />
            <span class="nx-ltrack-h"><span style="left:1%">Top 3</span><span style="left:19%">Page 1</span><span style="left:51%">Page 2</span><span style="left:79%">Not showing</span></span>
            <span class="nx-num">Seen</span>
          </div>
          {shown.map((r) => (
            <a key={r.key} class={`nx-lrow${open === r.key ? ' on' : ''}`} href={hrefWith('q', r.key)}>
              <span class="nx-lname"><b>“{r.key}”</b>
                <small>{[r.page && pageName(r.page), r.pos != null && rank(r.pos), r.d && <span class="bad">{r.d.word.toLowerCase()}</span>].filter(Boolean).reduce((acc, x, i) => (i ? [...acc, ' · ', x] : [x]), [])}</small>
              </span>
              <span class="nx-ltrack" title={r.pos == null ? 'Not in the results yet' : `${rank(r.pos)} now`}>
                <span class="nx-lz" style="left:0;width:18%" /><span class="nx-lz alt" style="left:18%;width:32%" /><span class="nx-lz" style="left:50%;width:28%" /><span class="nx-lz alt" style="left:78%;width:22%" />
                <span class={`nx-ldot${r.pos == null ? ' gap' : ''}${r.d ? ' dis' : ''}`} style={`left:${xOf(r.pos)}%`} />
              </span>
              <span class="nx-num">{fmt(seenOf(r, eng))}</span>
            </a>
          ))}
          <div class="nx-lfoot">
            <span class="nx-legend"><span><i class="dot" />Now</span>{eng === 'both' && both && <span><i class="ring" />Google and Bing disagree</span>}<span class="muted">Seen: times shown in results</span></span>
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
                <b class="bad">{r.d.word}</b>
              </a>
            ))}
            <p class="muted small m-0">Bing matters more than its clicks: ChatGPT search and Copilot lean on Bing’s index.</p>
          </div>
        </section>
      )}

      {close.length > 0 && (
        <section class="nx-block" aria-label="Next moves">
          <h2 class="nx-h2">Next moves <span class="muted small">· the searches closest to paying off</span></h2>
          <div class="nx-moves">
            {close.slice(0, 3).map((r) => (
              <a key={r.key} class="nx-move" href={hrefWith('q', r.key)}>
                <small>{r.page ? pageName(r.page) : 'No page tied to it'} · {rank(r.pos)} now</small>
                <b>“{r.key}”</b>
                <span><span class="good">+{fmt(r.s.gain)}</span> <small>visits in the top 3</small></span>
              </a>
            ))}
          </div>
        </section>
      )}

      <div class="nx-cards2">
        <a class="card card-plain nx-linkcard" href={`#/site/${site.id}/search?tab=ai`}>
          <span class="nx-label-sm">AI answers</span>
          <span>Whether ChatGPT, Perplexity and the rest mention {site.label} for the questions you track.</span>
          <span class="nx-go">See the questions →</span>
        </a>
        <div class="card card-plain nx-linkcard">
          <span class="nx-label-sm">Bing crawl</span>
          <span>{h.bing?.crawl ? <>{fmt(h.bing.crawl.errorsInRange)} crawl errors in this period{h.bing.crawl.errorsBefore != null ? `, ${fmt(h.bing.crawl.errorsBefore)} the period before` : ''}.</> : 'Connect Bing Webmaster Tools to see how Bing crawls the site.'}</span>
          <button type="button" class="todo-link nx-go" onClick={() => setList(true)}>Every search, demand and crawl →</button>
        </div>
      </div>

      <button type="button" class="todo-link" aria-expanded={list} onClick={() => setList(!list)}>{list ? 'Hide the full lists' : 'See every search as a list, plus what people search for'}</button>
      {list && <SearchHub site={site} range={range} part="details" />}
      <p class="muted small m-0">Extra visits are an estimate from a usual click-rate curve, to rank searches, not a forecast.</p>

      {opened && <QueryPanel site={site} r={opened} eng={eng} onClose={() => { location.hash = hrefWith('q', '').slice(1); }} />}
    </div>
  );
}

function QueryPanel({ site, r, eng, onClose }) {
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
      {r.d && <p class="nx-note-line warn"><b>{r.d.word}.</b> <span>{r.d.why}{r.d.bad === 'Bing' ? ' ChatGPT search and Copilot lean on Bing, so this also costs AI answers.' : ''}</span></p>}
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
