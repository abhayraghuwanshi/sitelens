import { useMemo, useState } from 'preact/hooks';
import { formatNumber, formatPercent } from '@shared/format.js';
import { useElementWidth } from '../hooks.js';

const EXIT = '(exit)';
const OTHER = '(other pages)';

// Step-indexed Sankey: column i holds pages seen at position i of a session.
// edges: [{ step, from, to, sessions }] — from is at column step, to at step+1.
export function Sankey({ edges, total, maxNodes = 7, height = 460, onSelect }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  const layout = useMemo(() => buildLayout(edges, { width, height, maxNodes }), [edges, width, height, maxNodes]);

  if (!edges.length) return <p class="muted">No page-to-page movement in this range.</p>;

  return (
    <div class="chart" ref={ref}>
      {width > 0 && layout && (
        <svg height={height} role="img" aria-label="Page flow between session steps">
          <g class="axis">
            {layout.columns.map((col, i) => (
              <text key={i} x={col.x + (i === layout.columns.length - 1 ? layout.nodeWidth : 0)} y={10}
                text-anchor={i === layout.columns.length - 1 ? 'end' : 'start'}>
                {i === 0 ? 'Landing page' : `Step ${i + 1}`}
              </text>
            ))}
          </g>
          <g>
            {layout.links.map((link, i) => {
              const active = hover && (hover.type === 'link' ? hover.index === i : hover.node === link.source.id || hover.node === link.target.id);
              const dim = hover && !active;
              return (
                <path key={i} d={link.path} fill="none"
                  stroke={link.target.name === EXIT ? 'var(--series-muted)' : 'var(--series-1)'}
                  stroke-width={Math.max(1, link.width)}
                  opacity={dim ? 0.06 : active ? 0.42 : link.target.name === EXIT ? 0.16 : 0.2}
                  onMouseEnter={() => setHover({ type: 'link', index: i, link })}
                  onMouseLeave={() => setHover(null)} />
              );
            })}
          </g>
          <g>
            {layout.nodes.map((node) => {
              const muted = node.name === EXIT || node.name === OTHER;
              const labelRight = node.col < layout.columns.length - 1;
              return (
                <g key={node.id} onMouseEnter={() => setHover({ type: 'node', node: node.id, data: node })} onMouseLeave={() => setHover(null)}
                  style={{ cursor: onSelect && !muted ? 'pointer' : 'default' }}
                  onClick={() => onSelect && !muted && onSelect(node.name)}>
                  <rect x={node.x} y={node.y} width={layout.nodeWidth} height={Math.max(2, node.h)} rx={2}
                    fill={muted ? 'var(--series-muted)' : 'var(--series-1)'} />
                  {node.ly != null && (
                    <text x={labelRight ? node.x + layout.nodeWidth + 6 : node.x - 6} y={node.ly} dy="0.32em"
                      text-anchor={labelRight ? 'start' : 'end'} fill="var(--text)" style={{ fontSize: 'var(--text-sm)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>
                      {truncate(node.name, Math.max(12, Math.floor(layout.colGap / 7.5)))}
                      <tspan fill="var(--text-3)"> {formatNumber(node.value, { compact: true })}</tspan>
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {hover && <SankeyTooltip hover={hover} total={total} layout={layout} />}
    </div>
  );
}

function SankeyTooltip({ hover, total, layout }) {
  if (hover.type === 'link') {
    const { link } = hover;
    const out = link.source.out || 1;
    return (
      <div class="tooltip" style={{ left: `${(link.source.x + link.target.x) / 2 + layout.nodeWidth / 2}px`, top: `${(link.y0 + link.y1) / 2}px` }}>
        <div class="tt-title">{link.source.name} → {link.target.name}</div>
        <div class="tt-row"><span>Sessions</span><b>{formatNumber(link.value)}</b></div>
        <div class="tt-row"><span>Of sessions leaving {truncate(link.source.name, 18)}</span><b>{formatPercent(link.value / out)}</b></div>
      </div>
    );
  }
  const node = hover.data;
  return (
    <div class="tooltip" style={{ left: `${node.x + layout.nodeWidth / 2}px`, top: `${node.y}px` }}>
      <div class="tt-title">{node.name}</div>
      <div class="tt-row"><span>Sessions at step {node.col + 1}</span><b>{formatNumber(node.value)}</b></div>
      {total > 0 && <div class="tt-row"><span>Share of sessions</span><b>{formatPercent(node.value / total)}</b></div>}
      {node.exit > 0 && <div class="tt-row"><span>Left the site here</span><b>{formatPercent(node.exit / Math.max(1, node.out))}</b></div>}
    </div>
  );
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildLayout(edges, { width, height, maxNodes }) {
  if (!width || !edges.length) return null;
  const steps = Math.max(...edges.map((e) => e.step)) + 2;

  // Keep the busiest pages per column; fold the rest into "(other pages)".
  const colTotals = Array.from({ length: steps }, () => new Map());
  for (const e of edges) {
    colTotals[e.step].set(e.from, (colTotals[e.step].get(e.from) || 0) + e.sessions);
    colTotals[e.step + 1].set(e.to, (colTotals[e.step + 1].get(e.to) || 0) + e.sessions);
  }
  const keep = colTotals.map((m) => new Set([...m].filter(([name]) => name !== EXIT).sort((a, b) => b[1] - a[1]).slice(0, maxNodes).map(([name]) => name)));
  const nameAt = (col, name) => (name === EXIT || keep[col].has(name) ? name : OTHER);

  const nodes = new Map();
  const node = (col, name) => {
    const id = `${col}:${name}`;
    if (!nodes.has(id)) nodes.set(id, { id, col, name, in: 0, out: 0, exit: 0 });
    return nodes.get(id);
  };
  const linkMap = new Map();
  for (const e of edges) {
    const source = node(e.step, nameAt(e.step, e.from));
    // An exit ends the flow: draw it into a terminal node in the next column.
    const target = node(e.step + 1, nameAt(e.step + 1, e.to));
    const key = `${source.id}>${target.id}`;
    linkMap.set(key, { source, target, value: (linkMap.get(key)?.value || 0) + e.sessions });
    source.out += e.sessions;
    target.in += e.sessions;
    if (e.to === EXIT) source.exit += e.sessions;
  }
  for (const n of nodes.values()) n.value = Math.max(n.in, n.out);

  const nodeWidth = 10;
  const top = 22;
  const usable = height - top - 4;
  const gap = 8;
  const colGap = (width - nodeWidth) / Math.max(1, steps - 1);
  const columns = Array.from({ length: steps }, (_, i) => ({ x: i * colGap, nodes: [] }));
  for (const n of nodes.values()) columns[n.col].nodes.push(n);
  const rank = (n) => (n.name === EXIT ? 2 : n.name === OTHER ? 1 : 0);
  for (const col of columns) col.nodes.sort((a, b) => rank(a) - rank(b) || b.value - a.value);
  const scale = Math.min(...columns.filter((c) => c.nodes.length).map((c) => (usable - gap * (c.nodes.length - 1)) / c.nodes.reduce((a, n) => a + n.value, 0)));

  // Later columns hold fewer sessions (most leave early), so their bars are
  // short: spread them over the room the column has, up to a 30px gap.
  const LABEL = 15;
  for (const col of columns) {
    const sum = col.nodes.reduce((a, n) => a + n.value * scale, 0);
    const spread = col.nodes.length > 1 ? Math.min(30, Math.max(gap, (usable - sum) / (col.nodes.length - 1))) : gap;
    let y = top;
    let lastLabel = -Infinity;
    for (const n of col.nodes) {
      n.x = col.x;
      n.y = y;
      n.h = n.value * scale;
      n.outY = y;
      n.inY = y;
      // Every page gets a label, nudged down so labels never overlap; one that
      // would fall off the chart is left to the tooltip.
      const ly = Math.max(y + Math.max(2, n.h) / 2, lastLabel + LABEL);
      n.ly = ly <= height - 6 ? ly : null;
      if (n.ly != null) lastLabel = ly;
      y += n.h + spread;
    }
  }

  const links = [...linkMap.values()].sort((a, b) => a.source.y - b.source.y || a.target.y - b.target.y);
  for (const link of links) {
    link.width = link.value * scale;
    link.y0 = link.source.outY + link.width / 2;
    link.y1 = link.target.inY + link.width / 2;
    link.source.outY += link.width;
    link.target.inY += link.width;
    const x0 = link.source.x + nodeWidth;
    const x1 = link.target.x;
    const mx = (x0 + x1) / 2;
    link.path = `M${x0},${link.y0}C${mx},${link.y0} ${mx},${link.y1} ${x1},${link.y1}`;
  }

  return { nodes: [...nodes.values()], links, columns, nodeWidth, colGap };
}
