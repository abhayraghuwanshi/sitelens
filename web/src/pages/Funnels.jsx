import { useState, useEffect } from 'preact/hooks';
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
  // Never edited (still the placeholder): wait for the best suggestion instead of querying placeholder steps.
  const untouched = JSON.stringify(saved) === JSON.stringify(DEFAULT_STEPS);
  const [run, setRun] = useState(untouched ? null : saved);
  const events = useAsync(() => api.get(`/sites/${site.id}/warehouse/events${qs({ range })}`), [site.id, range]);
  const result = useAsync(() => (run ? api.post(`/sites/${site.id}/warehouse/funnel`, { range, steps: run }) : null), [site.id, range, JSON.stringify(run)]);
  const suggestions = useAsync(() => api.get(`/sites/${site.id}/warehouse/funnel-suggestions${qs({ range })}`), [site.id, range]);

  const use = (next) => {
    setSteps(next);
    setRun(next);
    setSaved(next);
  };
  const best = suggestions.data?.funnels[0];
  useEffect(() => {
    if (!untouched || !(suggestions.data || suggestions.error)) return;
    if (best) use(best.steps);
    else setRun(saved);
  }, [untouched, suggestions.data, suggestions.error]);

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

      <div class="stack" style={{ gap: '16px', minWidth: 0 }}>
      <Suggestions data={suggestions} current={run} onUse={use} />
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
    </div>
  );
}

const stepLabel = (s) => s.value;

// Funnels built from the site's own events (and its code on GitHub); see server/funnel-suggest.mjs.
function Suggestions({ data, current, onUse }) {
  const currentKey = JSON.stringify(current);
  if (data.error) return <Card title="Suggested funnels"><ErrorState error={data.error} onRetry={data.reload} /></Card>;
  if (!data.data) {
    return (
      <Card title="Suggested funnels" sub="Reading your events and your site’s code…">
        <Loading height={120} />
      </Card>
    );
  }
  const { funnels, code, sessions } = data.data;
  return (
    <Card title="Suggested funnels" sub={`From ${formatNumber(sessions)} sessions${code.repos.length ? ' and your site’s code' : ''}`}>
      <div class="stack" style={{ gap: '10px' }}>
        {!funnels.length && (
          <p class="muted small" style={{ margin: 0 }}>
            No sign-up, download, purchase or CTA events fired in this range, so there’s nothing to build a funnel toward yet. Try a longer range, or track one with
            <code> gtag('event', 'sign_up')</code>.
          </p>
        )}
        {funnels.map((f) => {
          const active = JSON.stringify(f.steps) === currentKey;
          return (
            <div key={f.name + f.goal} class={`suggestion${active ? ' active' : ''}`}>
              <div class="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: '8px' }}>
                <b class="small">{f.name}</b>
                <button class={`btn${active ? '' : ' primary'}`} type="button" disabled={active} onClick={() => onUse(f.steps)}>{active ? 'In use' : 'Use'}</button>
              </div>
              <div class="suggestion-steps">
                {f.steps.map((s, i) => (
                  <span key={i}>{i > 0 && <span class="muted" aria-hidden="true"> → </span>}<code>{stepLabel(s)}</code></span>
                ))}
              </div>
              <p class="muted small" style={{ margin: 0 }}>{f.why}</p>
            </div>
          );
        })}
        {code.repos.some((r) => r.events) && (
          <p class="note" style={{ margin: 0 }}>
            Read {formatNumber(code.tracked)} tracked events from {code.repos.filter((r) => r.events).map((r) => r.name).join(', ')}.
            {code.unseen.length > 0 && <> In the code but not fired in this range: {code.unseen.map((n, i) => <span key={n}>{i > 0 && ', '}<code>{n}</code></span>)}.</>}
          </p>
        )}
        {code.note && <p class="note" style={{ margin: 0 }}>{code.note}</p>}
      </div>
    </Card>
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
