import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/icons.jsx';
import { SECTIONS, hrefFor, viewsFor, hasWarehouse } from './nav.js';

// ⌘K: jump to a site, a view or one of a report's tabs. Typing filters; Enter
// opens the first match; arrows move; Escape closes.
export function Jump({ sites, scope, onClose, viewer }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);

  const cur = sites.find((s) => s.id === scope) || null;
  const here = cur ? cur.label : 'All sites';
  const list = [
    ...sites.map((s) => ({ t: s.label, m: s.demo ? 'Site · sample data' : 'Site', href: hrefFor(s.id, 'story'), i: 'grid' })),
    { t: 'All sites', m: 'Scope', href: '#/', i: 'grid' },
    ...viewsFor(cur).map((v) => ({ t: v.key === 'story' && !cur ? 'Sites' : v.label, m: here, href: hrefFor(scope, v.key), i: v.icon })),
    { t: 'Live', m: here, href: hrefFor(scope, 'live'), i: 'pulse' },
    ...(cur ? Object.entries(SECTIONS)
      .filter(([k]) => (k !== 'journeys' && k !== 'raw') || hasWarehouse(cur))
      .flatMap(([k, sec]) => sec.tabs.map(([tk, tl]) => ({ t: tl, m: `${sec.label} · ${cur.label}`, href: hrefFor(cur.id, k, tk), i: 'layers' }))) : []),
    ...(viewer ? [] : [
      { t: 'Account', m: 'Sites, sign-ins, keys', href: '#/account', i: 'settings' },
      { t: 'Connect Claude (MCP)', m: 'Account', href: '#/account?tab=mcp', i: 'terminal' },
      { t: 'Add a site', m: 'Account', href: '#/account?tab=sites&edit=new', i: 'plus' },
    ]),
  ];
  const ql = q.trim().toLowerCase();
  const seen = new Set();
  const hits = list
    .filter((x) => !ql || x.t.toLowerCase().includes(ql) || x.m.toLowerCase().includes(ql))
    .filter((x) => !seen.has(x.href) && seen.add(x.href))
    .slice(0, ql ? 12 : 9);
  const pick = Math.min(at, Math.max(0, hits.length - 1));

  function go(x) {
    if (!x) return;
    location.hash = x.href.slice(1);
    onClose();
  }
  function onKey(e) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setAt((pick + 1) % Math.max(1, hits.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((pick - 1 + hits.length) % Math.max(1, hits.length)); }
    else if (e.key === 'Enter') go(hits[pick]);
  }

  return (
    <>
      <div class="nx-scrim" onClick={onClose} />
      <div class="nx-cmd" role="dialog" aria-modal="true" aria-label="Jump to">
        <input ref={input} value={q} placeholder="Jump to a site, view or report…" autocomplete="off" aria-label="Jump to"
          onInput={(e) => { setQ(e.currentTarget.value); setAt(0); }} onKeyDown={onKey} />
        <div class="nx-cmd-res" role="listbox">
          {hits.map((x, i) => (
            <a key={x.href} href={x.href} role="option" aria-selected={i === pick} class={`nx-cmd-row${i === pick ? ' on' : ''}`}
              onMouseEnter={() => setAt(i)} onClick={onClose}>
              <Icon name={x.i} size={15} />{x.t}<small>{x.m}</small>
            </a>
          ))}
          {!hits.length && <p class="muted nx-cmd-empty">No match.</p>}
        </div>
      </div>
    </>
  );
}
