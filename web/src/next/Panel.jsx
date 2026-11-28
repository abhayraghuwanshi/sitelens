import { useEffect, useRef } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { useBottomSheet } from './sheet.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { useTodos } from '../components/Todos.jsx';
import { PageTimeline } from './PageTimeline.jsx';
import { TodoBody } from './Inbox.jsx';

// One side panel for the whole app (docs/redesign/prototype.html → places and one panel).
// Only the sidebar changes the place; a day, a page or a to-do clicked anywhere opens
// here, over the current place, and following one thing to the next pushes onto a trail:
//   ‹ back   Sun 15 Nov › /blog/x › To-do: …   Open ↗   ✕
// "Open ↗" is the only deliberate jump to the item's full place. On phones it's a sheet.
// The trail lives in the address (?panel=day:2026-11-15,page:%2Fblog%2Fx,todo:todo-ab12),
// so it can be linked and Back walks it; a sidebar link has no ?panel, so it clears it.
const KINDS = new Set(['day', 'page', 'todo']);
const KIND_LABEL = { day: 'Day', page: 'Page', todo: 'To-do' };
const fmtD = (d, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');

export function parsePanel(value) {
  return String(value || '').split(',').filter(Boolean).map((part) => {
    const i = part.indexOf(':');
    return { kind: part.slice(0, i), key: decodeURIComponent(part.slice(i + 1)) };
  }).filter((x) => KINDS.has(x.kind) && x.key).slice(-8);
}
const encode = (items) => items.map((x) => `${x.kind}:${encodeURIComponent(x.key)}`).join(',');

// The current address with the panel's trail replaced ([] closes it).
export function panelHref(items) {
  const [path, search = ''] = location.hash.replace(/^#/, '').split('?');
  const p = new URLSearchParams(search);
  if (items.length) p.set('panel', encode(items));
  else p.delete('panel');
  const q = p.toString();
  return `#${path || '/'}${q ? `?${q}` : ''}`;
}

// The address that opens an item on top of the trail. An item already on the trail is
// gone back to instead of being added twice.
export function pushPanel(item) {
  const search = location.hash.split('?')[1] || '';
  const items = parsePanel(new URLSearchParams(search).get('panel'));
  const at = items.findIndex((x) => x.kind === item.kind && x.key === item.key);
  return panelHref(at >= 0 ? items.slice(0, at + 1) : [...items, item]);
}

// "#/site/<id>/pages?article=%2Fx" → "/x": an in-app link to a page's view.
export function pageOfLink(link) {
  const m = /^#\/site\/[\w-]+\/pages\?(.*)$/.exec(String(link || ''));
  if (!m) return '';
  const p = new URLSearchParams(m[1]);
  return p.get('edit') ? '' : p.get('article') || p.get('path') || '';
}

export function SidePanel({ site, sites, params }) {
  const items = parsePanel(params.get('panel'));
  const todos = useTodos({});
  const box = useRef(null);
  const top = items.at(-1);
  const close = () => { location.hash = panelHref([]); };
  useBottomSheet(box, close, { open: Boolean(top) });
  useEffect(() => {
    if (!top) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    box.current?.focus();
    return () => removeEventListener('keydown', onKey);
  }, [top?.kind, top?.key]);
  if (!top) return null;

  const scope = site?.id || 'all';
  const todoOf = (id) => (todos.data?.todos || []).find((t) => t.id === id);
  const label = (x) => (x.kind === 'day' ? fmtD(x.key) : x.kind === 'page' ? x.key : todoOf(x.key)?.title || 'To-do');
  const full = top.kind === 'day' ? (site ? `#/site/${site.id}/timeline?day=${top.key}&month=${top.key.slice(0, 7)}` : `#/timeline?day=${top.key}&month=${top.key.slice(0, 7)}`)
    : top.kind === 'page' ? (site ? `#/site/${site.id}/pages?article=${encodeURIComponent(top.key)}` : '')
    : `#/${todoOf(top.key)?.site ? `site/${todoOf(top.key).site}/` : ''}inbox?tab=todos&open=${top.key}`;

  let body;
  if (top.kind === 'day') body = <DayBody scope={scope} site={site} date={top.key} />;
  else if (top.kind === 'page') body = site ? <PageTimeline key={top.key} site={site} path={top.key} /> : <p class="muted">Pick a site to open its pages.</p>;
  else {
    const t = todoOf(top.key);
    body = todos.error ? <ErrorState error={todos.error} onRetry={todos.reload} /> : !todos.data ? <Loading height={200} />
      : t ? <TodoBody todo={t} sites={sites} onClose={close} /> : <p class="muted">That to-do isn’t there any more.</p>;
  }

  return (
    <div class="nx-drawer-wrap">
      <a class="nx-drawer-scrim" href={panelHref([])} aria-label="Close the panel" tabIndex={-1} />
      <aside ref={box} tabIndex={-1} class={`nx-drawer sp${top.kind === 'page' ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label(top)}>
        <span class="nx-grab nx-drawer-grab" aria-hidden="true" />
        <header class="sp-h">
          <div class="sp-bar">
            {items.length > 1 && <a class="nx-icon-btn" href={panelHref(items.slice(0, -1))} aria-label={`Back to ${label(items.at(-2))}`}><Icon name="chevron" size={14} class="flip" /></a>}
            <nav class="sp-trail" aria-label="Where you came from">
              {items.slice(0, -1).map((x, i) => <span key={i}><a href={panelHref(items.slice(0, i + 1))}>{label(x)}</a><i aria-hidden="true">›</i></span>)}
              <span class="sp-kind">{KIND_LABEL[top.kind]}</span>
            </nav>
            {full && <a class="btn sp-open" href={full}>Open <Icon name="external" size={11} /></a>}
            <a class="nx-icon-btn" href={panelHref([])} aria-label="Close"><Icon name="x" size={14} /></a>
          </div>
          <h2 class="sp-title" aria-current="page">{label(top)}</h2>
        </header>
        <div class="nx-drawer-body">{body}</div>
      </aside>
    </div>
  );
}

// A day, wherever it was clicked: how it went, why, the pages people landed on (each opens
// on the trail), and what happened. The full day, with its comparisons, is "Open ↗".
function DayBody({ scope, site, date }) {
  const d = useAsync(() => api.get(`/calendar/day${qs({ site: scope, date })}`), [scope, date]);
  if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Loading height={200} />;
  const x = d.data;
  const pages = (x.sites || []).flatMap((s) => (s.pages || []).map((p) => ({ ...p, site: s.id }))).sort((a, b) => b.value - a.value).slice(0, 6);
  return (
    <div class="sp-day">
      <p class={`sp-dhead ${String(x.tone || '').startsWith('up') ? 'good' : String(x.tone || '').startsWith('down') ? 'bad' : ''}`}><b>{x.headline}</b></p>
      {x.lines?.length > 0 && <ul class="sp-lines">{x.lines.map((l, i) => <li key={i}>{l.text}</li>)}</ul>}
      {pages.length > 0 && (
        <section aria-label="Where people landed">
          <h3 class="nx-label-sm">Where people landed</h3>
          <ul class="sp-pages">
            {pages.map((p) => (
              <li key={`${p.site}${p.label}`}>
                {site && p.site === site.id && p.label.startsWith('/') ? <a href={pushPanel({ kind: 'page', key: p.label })}>{p.label}</a> : <span>{p.label}</span>}
                <span class="nx-num">{fmt(p.value)}</span>
                <span class="muted small">{p.expected != null ? `usually ${fmt(p.expected)}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(x.events?.length > 0 || x.alerts?.length > 0) && (
        <section aria-label="What happened">
          <h3 class="nx-label-sm">What happened</h3>
          <ul class="sp-lines">
            {(x.events || []).map((e, i) => <li key={`e${i}`}>{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a> : e.label}</li>)}
            {(x.alerts || []).map((a) => <li key={a.id}>{a.title}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
