import { useEffect, useRef } from 'preact/hooks';

// Bottom sheets on phones (the More, site and account sheets, view options, and the
// detail drawers): what a phone's own sheets do, which the browser doesn't give us.
//   - Pull down to close: from anywhere on the sheet, once its content is scrolled to
//     the top. A short pull springs back; a long one or a flick closes it.
//   - The page behind stays still while a sheet is open.
//   - With `back`, the phone's Back button closes the sheet instead of leaving the page
//     (for sheets that aren't already in the address, as ?open= drawers are).
export const PHONE = '(max-width: 820px)';
const phone = () => matchMedia(PHONE).matches;
let locks = 0;

export function useBottomSheet(ref, onClose, { open = true, back = false } = {}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || !phone()) return undefined;
    if (locks++ === 0) document.documentElement.classList.add('nx-sheet-open');
    return () => { if (--locks === 0) document.documentElement.classList.remove('nx-sheet-open'); };
  }, [open]);

  useEffect(() => {
    if (!open || !back || !phone()) return undefined;
    const mark = Math.random();
    history.pushState({ nxSheet: mark }, '');
    let popped = false;
    // Also fires when a link in the sheet changes the hash: the sheet closes then too.
    const onPop = () => { popped = true; closeRef.current(); };
    addEventListener('popstate', onPop);
    return () => {
      removeEventListener('popstate', onPop);
      // Closed by a tap: take back the history entry it added, unless we've moved on.
      if (!popped && history.state?.nxSheet === mark) history.back();
    };
  }, [open, back]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return undefined;
    const scrim = el.parentElement?.querySelector(':scope > .nx-scrim, :scope > .nx-drawer-scrim');
    const set = (y, animate) => {
      el.style.transition = animate ? 'transform .24s cubic-bezier(.2, .8, .2, 1)' : 'none';
      el.style.transform = y ? `translateY(${y}px)` : '';
      if (scrim) {
        scrim.style.transition = el.style.transition.replace('transform', 'opacity');
        scrim.style.opacity = y ? String(Math.max(0, 1 - y / el.offsetHeight)) : '';
      }
    };
    set(0, false);
    // The scrollable box the finger is in, inside the sheet (or the sheet itself).
    const scrollerOf = (t) => {
      for (let n = t; n && n !== el.parentElement; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
      }
      return null;
    };
    let g = null;
    const start = (e) => {
      if (!phone() || e.touches.length !== 1) { g = null; return; }
      const t = e.touches[0];
      g = { x: t.clientX, y: t.clientY, mode: null, sc: scrollerOf(e.target), last: [t.clientY, e.timeStamp], prev: [t.clientY, e.timeStamp] };
    };
    const move = (e) => {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      // Decided on the first move: once the browser starts scrolling it won't stop.
      if (!g.mode) {
        if (dx === 0 && dy === 0) return;
        if (Math.abs(dx) > Math.abs(dy)) g.mode = 'side';
        else if (dy > 0 && (!g.sc || g.sc.scrollTop <= 0)) g.mode = 'drag';
        else g.mode = g.sc ? 'scroll' : 'hold'; // nothing to scroll: don't scroll the page behind
      }
      if (g.mode === 'hold') { e.preventDefault(); return; }
      if (g.mode !== 'drag') return;
      e.preventDefault();
      g.prev = g.last;
      g.last = [t.clientY, e.timeStamp];
      set(Math.max(0, dy), false);
    };
    const end = (e) => {
      const st = g;
      g = null;
      if (!st || st.mode !== 'drag') return;
      const dy = st.last[0] - st.y;
      const v = (st.last[0] - st.prev[0]) / Math.max(1, st.last[1] - st.prev[1]); // px/ms, down is positive
      const h = el.offsetHeight;
      if (e.type !== 'touchcancel' && (dy > Math.min(160, h * 0.33) || (v > 0.45 && dy > 24))) {
        set(h, true);
        setTimeout(() => closeRef.current(), 200);
      } else set(0, true);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.style.transform = el.style.transition = '';
      if (scrim) scrim.style.opacity = scrim.style.transition = '';
    };
  }, [open]);
}
