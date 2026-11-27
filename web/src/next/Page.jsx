import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/icons.jsx';
import { SegmentedAsMenu } from '../components/ui.jsx';

// A report's tab row (Section.jsx). Pages that draw their own header (Journeys,
// Outcomes) still show their section's tabs under it.
export const SectionTabs = createContext(null);
// On a phone the tabs fold into the title: "All pages ⌄" opens a menu of them.
export const SectionTitle = createContext(null);

const PHONE = '(max-width: 640px)';
export function usePhoneWidth() {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(PHONE).matches);
  useEffect(() => {
    const m = matchMedia(PHONE);
    const set = () => setOn(m.matches);
    m.addEventListener('change', set);
    return () => m.removeEventListener('change', set);
  }, []);
  return on;
}

// A page: a title, an optional line under it, and on the right its time range, view
// options (engine, sort…) and actions (buttons). Pages opened from another get a link
// back: the desktop app has no back button. On a phone the time range and options
// stay in one line as iOS pull-downs ("90d ⌄", "Most visits ⌄"); actions stay as they are.
// corner: a small action top right (a phone's "Edit"): on the back link's line, else the title's.
export function Page({ title, sub, time, actions, options, back, corner, children }) {
  const tabs = useContext(SectionTabs);
  const titleMenu = useContext(SectionTitle);
  const phone = usePhoneWidth();
  return (
    <div class="nx-page">
      <header class="nx-head">
        <div>
          {corner && back ? (
            <div class="nx-topline"><a class="nx-back" href={back.href}>← {back.label}</a>{corner}</div>
          ) : back && <a class="nx-back" href={back.href}>← {back.label}</a>}
          {/* With no back link, the corner action sits on the title's line, right-aligned. */}
          {corner && !back ? (
            <div class="nx-titleline"><h1>{phone && titleMenu ? titleMenu : title}</h1>{corner}</div>
          ) : <h1>{phone && titleMenu ? titleMenu : title}</h1>}
          {sub && <p class="nx-sub">{sub}</p>}
        </div>
        {(time || actions || options) && (
          <div class="nx-head-r">
            <SegmentedAsMenu.Provider value={phone}>
              {phone ? <>{time}{options}</> : <>{options}{time}</>}
            </SegmentedAsMenu.Provider>
            {actions}
          </div>
        )}
      </header>
      {phone && titleMenu ? null : tabs}
      {children}
    </div>
  );
}

// One button for a page's view options on a phone. Its label reads what's picked in
// them (pressed or checked buttons), so the options stay mounted, hidden until opened.
export function OptionsSheet({ title, label = '', children }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState('');
  const box = useRef(null);
  useEffect(() => {
    const read = () => {
      const on = [...(box.current?.querySelectorAll('[aria-pressed="true"], [aria-checked="true"]') || [])]
        .map((b) => b.getAttribute('aria-label') || b.textContent.trim()).filter(Boolean);
      setPicked(on.join(' · '));
    };
    read();
    const watch = new MutationObserver(read);
    if (box.current) watch.observe(box.current, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-checked'], childList: true });
    return () => watch.disconnect();
  }, []);
  // A pick inside closes the sheet, as on iOS; a menu that keeps choices open (checkboxes) doesn't.
  const onPick = (e) => {
    const b = e.target.closest('button, a');
    if (b && !b.matches('[role="menuitemcheckbox"]')) setTimeout(() => setOpen(false), 120);
  };
  return (
    <>
      <button type="button" class="nx-opts" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="sliders" size={14} /><span>{label || picked || 'Options'}</span><Icon name="updown" size={11} />
      </button>
      <div class={`nx-sheet-wrap nx-opts-wrap${open ? ' open' : ''}`} hidden={!open}>
        <div class="nx-scrim" onClick={() => setOpen(false)} />
        <div class="nx-sheet nx-opts-sheet" role="dialog" aria-modal="true" aria-label={title} ref={box} onClick={onPick}>
          <span class="nx-grab" aria-hidden="true" />
          <h2 class="nx-label-sm">{title}</h2>
          {children}
        </div>
      </div>
    </>
  );
}
