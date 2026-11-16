// How a page goal's numbers read, and the to-do made from one: shared by the
// goal card (web PageGoal.jsx), the to-do list (Todos.jsx) and the server,
// which moves a page's to-do on to its next goal (server/todos.mjs).

export function value(metric, v) {
  if (v === null || v === undefined) return '—';
  if (metric === 'position') return `position ${Number(v).toFixed(1)}`;
  if (['ctr', 'rate', 'engagement'].includes(metric)) return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
  const n = Math.round(v);
  return `${n.toLocaleString('en-US')} ${n === 1 ? metric.replace(/s$/, '') : metric}`;
}

// "position 5.3 → 3", "1.2% → 3%": the unit once.
// Counts (impressions, clicks) are totals over the review's days, so it says so.
export const span = (metric, from, to, days) => (metric === 'position' ? `position ${Number(from).toFixed(1)} → ${Math.round(to * 10) / 10}`
  : ['impressions', 'clicks'].includes(metric) ? `${Math.round(from).toLocaleString('en-US')} → ${value(metric, to)}${days ? ` in ${days} days` : ''}`
  : `${value(metric, from)} → ${value(metric, to)}`);

// The to-do for a page's goal. One per page: `from` names the goal, and when the
// next goal is set the same to-do moves on to it.
export function goalTodo(target, path, siteId) {
  return {
    title: `${target.title} (${path})`,
    detail: `From ${value(target.metric, target.from)} to ${value(target.metric, target.to)} by ${target.checkBy}.`,
    link: `#/site/${siteId}/articles?article=${encodeURIComponent(path)}`,
    from: `goal:${path}:${target.key}`,
    subject: { kind: 'search', key: path },
    baseline: { metric: target.metric, from: target.from, to: target.to },
  };
}
