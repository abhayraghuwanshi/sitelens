import { useEffect, useRef } from 'preact/hooks';
import { Icon } from '../components/icons.jsx';
import { useBottomSheet } from './sheet.js';

// Detail for one item (a to-do, an alert, a source, a search): a panel on the
// right on desktop, a sheet from the bottom on phones. The list stays where it
// was underneath. Escape or the scrim closes it.
// `back`: the phone's Back button closes it (for drawers not kept in the address).
export function Drawer({ title, onClose, children, wide = false, back = false }) {
  const panel = useRef(null);
  useBottomSheet(panel, onClose, { back });
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="nx-drawer-wrap">
      <div class="nx-drawer-scrim" onClick={onClose} />
      <aside ref={panel} tabIndex={-1} class={`nx-drawer${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Detail'}>
        <span class="nx-grab nx-drawer-grab" aria-hidden="true" />
        <header class="nx-drawer-h">
          <b>{title}</b>
          <button type="button" class="nx-icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </header>
        <div class="nx-drawer-body">{children}</div>
      </aside>
    </div>
  );
}

// Keeps which item is open in the address (?open=<id>), so it can be linked and Back closes it.
export function openParam(params, key = 'open') {
  return params.get(key) || '';
}
export function hrefWith(key, value) {
  const [path, search = ''] = location.hash.replace(/^#/, '').split('?');
  const p = new URLSearchParams(search);
  if (value) p.set(key, value);
  else p.delete(key);
  const q = p.toString();
  return `#${path || '/'}${q ? `?${q}` : ''}`;
}
