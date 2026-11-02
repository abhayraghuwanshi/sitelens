import { useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDuration } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Card, Loading, ErrorState, WarehouseMeta } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

const DEFAULT_STEPS = [
  { kind: 'page', value: '/pricing' },
  { kind: 'page', value: '/signup' },
  { kind: 'event', value: 'sign_up' },
];

// Ordinal ramp (darkest = entry). Light steps stay ≥ 2:1 against the surface.
const ORDINAL = ['var(--seq-6)', 'var(--seq-5)', 'var(--seq-4)', 'var(--seq-3)', 'var(--seq-3)', 'var(--seq-3)', 'var(--seq-3)', 'var(--seq-3)'];

export function Funnels({ site, range }) {
  const [saved, setSaved] = usePersistent(`funnel:${site.id}`, DEFAULT_STEPS);
  const [steps, setSteps] = useState(saved);
  const [run, setRun] = useState(saved);
  const events = useAsync(() => api.get(`/sites/${site.id}/warehouse/events${qs({ range })}`), [site.id, range]);
  const result = useAsync(() => api.post(`/sites/${site.id}/warehouse/funnel`, { range, steps: run }), [site.id, range, JSON.stringify(run)]);

  const update = (i, patch) => setSteps(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const apply = () => {
    const clean = steps.filter((s) => s.value.trim());
    setRun(clean);
    setSaved(clean);
  };
  const eventNames = (events.data?.events || []).map((e) => e.name);

  return (
    <div class="grid cols-2-1" style={{ alignItems: 'start' }}>
      <Card title="Conversion funnel" sub="Strictly ordered steps within one session">
        {result.error ? (
          <ErrorState error={result.error} onRetry={result.reload} />
        ) : !result.data ? (
          <Loading height={300} />
        ) : (
          <FunnelChart data={result.data} />
        )}
      </Card>

      <Card title="Steps" actions={<button class="btn primary" type="button" onClick={apply}><Icon name="play" size={13} /> Run</button>}>
        <div class="funnel-steps">
          {steps.map((step, i) => (
            <div class="funnel-step" key={i}>
              <span class="n">{i + 1}</span>
              <select aria-label={`Step ${i + 1} type`} value={step.kind} onChange={(e) => update(i, { kind: e.currentTarget.value, value: '' })}>
                <option value="page">Page view</option>
                <option value="event">Event</option>
              </select>
              <input type="text" list={step.kind === 'event' ? 'funnel-events' : undefined} aria-label={`Step ${i + 1} ${step.kind === 'page' ? 'path' : 'event name'}`}
                placeholder={step.kind === 'page' ? '/path' : 'event_name'} value={step.value} onInput={(e) => update(i, { value: e.currentTarget.value })}
                onKeyDown={(e) => e.key === 'Enter' && apply()} />
              <button class="btn ghost icon-btn" type="button" aria-label={`Remove step ${i + 1}`} disabled={steps.length <= 2}
                onClick={() => setSteps(steps.filter((_, k) => k !== i))}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <datalist id="funnel-events">
            {eventNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div class="row" style={{ marginTop: '6px' }}>
            <button class="btn" type="button" disabled={steps.length >= 8} onClick={() => setSteps([...steps, { kind: 'event', value: '' }])}>
              <Icon name="plus" size={13} /> Add step
            </button>
          </div>
          <p class="note">
            Pages match the exact path. Events match GA4 event names from the export, including ones you never registered as key events.
            Unlike GA4’s funnel API, any step can be any event, and step N must happen after step N−1.
          </p>
        </div>
      </Card>
    </div>
  );
}

function FunnelChart({ data }) {
  const first = data.steps[0]?.sessions || 0;
  if (!first) return <p class="muted">No sessions reached the first step in this range.</p>;
  const biggest = data.steps.slice(1).reduce((worst, s, i) => (!worst || 1 - s.stepRate > 1 - worst.stepRate ? { ...s, i: i + 1 } : worst), null);
  return (
    <div class="stack">
      <div class="row" style={{ gap: '24px' }}>
        <div><div class="muted small">Overall conversion</div><div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{formatPercent(data.steps.at(-1).rate)}</div></div>
        <div><div class="muted small">Entered</div><div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{formatNumber(first)}</div></div>
        <div><div class="muted small">Completed</div><div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{formatNumber(data.steps.at(-1).sessions)}</div></div>
      </div>
      <div class="stack" style={{ gap: '10px' }} role="list">
        {data.steps.map((s, i) => (
          <div key={i} role="listitem">
            <div class="row" style={{ justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'nowrap' }}>
              <span class="small" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b>{i + 1}.</b> {s.kind === 'page' ? 'Viewed' : 'Fired'} <code>{s.value}</code>
              </span>
              <span class="small"><b>{formatNumber(s.sessions)}</b> <span class="muted">· {formatPercent(s.rate)}</span></span>
            </div>
            <div style={{ height: '22px', background: 'var(--surface-2)', borderRadius: '4px' }} title={`${formatNumber(s.sessions)} sessions`}>
              <div style={{ height: '100%', width: `${Math.max(0.5, s.rate * 100)}%`, background: ORDINAL[i], borderRadius: 4 }} />
            </div>
            {i > 0 && (
              <div class="small muted" style={{ marginTop: '3px' }}>
                {formatPercent(1 - s.stepRate)} dropped from step {i}
                {s.avgSeconds !== null && ` · avg ${formatDuration(s.avgSeconds)} after previous step`}
              </div>
            )}
          </div>
        ))}
      </div>
      {biggest && biggest.stepRate < 1 && (
        <p class="note"><b>Biggest leak:</b> step {biggest.i} → {biggest.i + 1} loses {formatPercent(1 - biggest.stepRate)} of sessions.</p>
      )}
      <WarehouseMeta data={data} />
    </div>
  );
}
