import { useEffect, useLayoutEffect, useState } from 'preact/hooks';

// A short walk through the Timeline: one tip at a time, pointing at the part it
// explains. Shown once on a first visit (studio:tour-timeline), and again from
// "Tour" in the page header (or View options on a phone). Steps whose part isn't
// on screen (no Add button on a shared site, no side panel on a phone) are skipped.
const STEPS = [
  { at: '.tl-map', title: 'Every square is a day', body: 'Darker days had more visits. Icons on a day are things that happened: a deploy, a post, an alert.', phone: 'Darker days had more visits. Dots on a day are things that happened: a deploy, a post, an alert.' },
  { at: '.tl-map .tl-day:not(.fut):not(.blank):not(.nodata)', title: 'Click a day to open it', body: 'The panel beside the calendar then shows that day: its numbers, where people came from, and what changed.', phone: 'The sheet below then shows that day. Drag it up for more, or swipe sideways for the day before or after.' },
  { at: '.tl-period', title: 'Pick the period', body: 'Last 7 days, a month, or the last 12 months. The arrows step back and forward.' },
  { at: '[data-tour="by"]', title: 'Choose what colours the days', body: 'Daily totals, change against a usual day, or break it down by landing pages, sources, searches or goals.' },
  { at: '[data-tour="opts"]', title: 'View options', body: 'Choose what colours the days, draw it as a line, and pick which marks show.' },
  { at: '[data-tour="marks"]', title: 'Marks', body: 'Turn kinds of marks on or off: deploys, releases, posts, ads, mentions, notes, alerts.' },
  { at: '.tl-insp', title: 'The whole period at a glance', body: 'With no day picked, this side shows what’s moving, the best and worst days, and what happened.' },
  { at: '[data-tour="add"]', title: 'Add your own', body: 'Note something you did, log a custom event, or set a goal. It shows on its day.' },
];

const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

export function TimelineTour({ phone, onDone }) {
  const steps = STEPS.filter((s) => visible(document.querySelector(s.at)));
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const step = steps[Math.min(i, steps.length - 1)];

  useLayoutEffect(() => {
    if (!step) return undefined;
    const el = document.querySelector(step.at);
    if (!el) return undefined;
    // Bring it into view only if it's off screen; a part taller than the screen stays put.
    const r0 = el.getBoundingClientRect();
    if (r0.bottom < 80 || r0.top > innerHeight - 80) el.scrollIntoView({ block: r0.height > innerHeight - 200 ? 'start' : 'center', behavior: 'instant' });
    const read = () => { const r = el.getBoundingClientRect(); setBox({ top: r.top, left: r.left, width: r.width, height: r.height }); };
    read();
    addEventListener('resize', read);
    addEventListener('scroll', read, true);
    return () => { removeEventListener('resize', read); removeEventListener('scroll', read, true); };
  }, [step?.at]);

  const last = i >= steps.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onDone();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') back();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });

  if (!step || !box) return null;
  const pad = 6;
  const ring = { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
  // The tip goes under the part if there's room, else over it, else beside it, else inside its top.
  const W = Math.min(320, innerWidth - 24);
  const H = 170;
  const gap = 12;
  const clampX = (x) => Math.max(12, Math.min(innerWidth - W - 12, x));
  const clampY = (y) => Math.max(12, Math.min(innerHeight - H - 12, y));
  const below = ring.top + ring.height + gap;
  const above = ring.top - gap - H;
  const right = ring.left + ring.width + gap;
  const leftOf = ring.left - gap - W;
  const [left, top] = below + H < innerHeight ? [clampX(box.left), below]
    : above > 0 ? [clampX(box.left), above]
    : right + W < innerWidth ? [right, clampY(ring.top)]
    : leftOf > 0 ? [leftOf, clampY(ring.top)]
    : [clampX(box.left + 12), clampY(ring.top + 12)];
  return (
    <div class="tl-tour" role="dialog" aria-modal="true" aria-labelledby="tl-tour-t">
      <div class="tl-tour-block" onClick={(e) => e.stopPropagation()} />
      <div class="tl-tour-ring" style={`top:${ring.top}px;left:${ring.left}px;width:${ring.width}px;height:${ring.height}px`} />
      <div class="tl-tour-tip" style={`top:${top}px;left:${left}px;width:${W}px;min-height:${H}px`}>
        <span class="tl-tour-n">{i + 1} of {steps.length}</span>
        <h3 id="tl-tour-t">{step.title}</h3>
        <p>{(phone && step.phone) || step.body}</p>
        <div class="tl-tour-acts">
          <button type="button" class="btn ghost small" onClick={onDone}>{last ? 'Close' : 'Skip'}</button>
          <span>
            {i > 0 && <button type="button" class="btn ghost small" onClick={back}>Back</button>}
            <button type="button" class="btn primary small" onClick={next} autoFocus>{last ? 'Done' : 'Next'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
