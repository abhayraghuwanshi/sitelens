// Plain JS (no JSX) so node tests can import it.

const KIND_COLORS = {
  release: 'var(--series-7)',
  extension: 'var(--series-3)',
  deploy: 'var(--series-4)',
  alert: 'var(--critical)',
  mention: 'var(--series-5)',
  post: 'var(--series-2)',
  note: 'var(--text-3)',
};
export const kindColor = (kind) => KIND_COLORS[kind] || KIND_COLORS.note;

// Groups annotations by the chart index whose date matches; unmatched dates are dropped.
export function placeAnnotations(annotations, dates) {
  if (!annotations?.length || !dates?.length) return [];
  const first = new Map();
  dates.forEach((d, i) => {
    const day = isoDay(d);
    if (!first.has(day)) first.set(day, i);
  });
  const byIndex = new Map();
  for (const a of annotations) {
    const i = first.get(a.date);
    if (i === undefined) continue;
    if (!byIndex.has(i)) byIndex.set(i, []);
    byIndex.get(i).push(a);
  }
  return [...byIndex].map(([i, items]) => ({ i, items })).sort((a, b) => a.i - b.i);
}

function isoDay(value) {
  const s = String(value);
  return /^\d{8}/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s.slice(0, 10);
}
