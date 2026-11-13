import { useState, useEffect } from 'preact/hooks';
import { formatNumber, formatPercent, formatDuration } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Loading, ErrorState, WarehouseMeta } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

const DEFAULT_STEPS = [
  { kind: 'page', value: '/pricing' },
  { kind: 'page', value: '/signup' },
  { kind: 'event', value: 'sign_up' },
];
const CUSTOM = '__custom__';

// Funnels: pick one (yours from .sitelens.yml, or a suggested one), see it left
// to right with the drop between each step, read what it means, and edit the
// steps only when you want to.
export function Funnels({ site, range }) {
  const [saved, setSaved] = usePersistent(`funnel:${site.id}`, DEFAULT_STEPS);
  const [steps, setSteps] = useState(saved);
  const [editing, setEditing] = useState(false);
  // Never edited (still the placeholder): wait for the best suggestion instead of querying placeholder steps.
  const untouched = JSON.stringify(saved) === JSON.stringify(DEFAULT_STEPS);
  // Nothing runs until the site's .sitelens.yml is known: its funnels win over anything saved here.
  const [run, setRun] = useState(null);
  const config = useAsync(() => api.get(`/sites/${site.id}/config`), [site.id]);
  const declared = config.data?.config?.funnels || [];
  const goals = config.data?.config?.goals || [];
  const events = useAsync(() => api.get(`/sites/${site.id}/warehouse/events${qs({ range })}`), [site.id, range]);
  const result = useAsync(() => (run ? api.post(`/sites/${site.id}/warehouse/funnel`, { range, steps: run }) : null), [site.id, range, JSON.stringify(run)]);
  const suggestions = useAsync(() => api.get(`/sites/${site.id}/warehouse/funnel-suggestions${qs({ range })}`), [site.id, range]);

  // With funnels in the file, edits here are for exploring and aren't kept.
  const keep = (next) => !declared.length && setSaved(next);
  const use = (next) => {
    setSteps(next);
    setRun(next);
    keep(next);
  };
  const best = suggestions.data?.funnels[0];
  const configKnown = Boolean(config.data || config.error);
  useEffect(() => {
    if (!configKnown || run) return;
    if (declared.length) use(declared[0].steps);
    else if (!untouched) setRun(saved);
    else if (suggestions.data || suggestions.error) {
      if (best) use(best.steps);
      else setRun(saved);
    }
  }, [configKnown, untouched, suggestions.data, suggestions.error]);

  const apply = () => {
    const clean = steps.filter((s) => s.value.trim());
    setRun(clean);
    keep(clean);
  };

  // Every funnel on offer, yours first; the one showing is matched by its steps.
  const choices = [
    ...declared.map((f) => ({ key: `yours:${f.name}`, name: f.name, steps: f.steps, from: 'yours' })),
    ...(suggestions.data?.funnels || []).map((f) => ({ key: `suggested:${f.name}:${f.goal}`, name: f.name, steps: f.steps, from: 'suggested', why: f.why })),
  ].filter((c, i, all) => all.findIndex((o) => JSON.stringify(o.steps) === JSON.stringify(c.steps)) === i);
  const runKey = JSON.stringify(run);
  const current = choices.find((c) => JSON.stringify(c.steps) === runKey);
  const label = labeller(goals);

  return (
    <div class="stack gap-16">
      <nav class="nx-fn-picker" aria-label="Funnels">
        {choices.map((c) => (
          <button key={c.key} type="button" class={`nx-fn-chip${current?.key === c.key ? ' active' : ''}`} title={c.why || c.steps.map(label.short).join(' → ')}
            aria-pressed={current?.key === c.key} onClick={() => { setEditing(false); use(c.steps); }}>
            {c.name}{c.from === 'suggested' && <span class="nx-fn-tag">suggested</span>}
          </button>
        ))}
        {!suggestions.data && !suggestions.error && <span class="muted small">Finding suggestions…</span>}
        <button type="button" class={`nx-fn-chip ghost${editing || (run && !current) ? ' active' : ''}`} onClick={() => setEditing(!editing)} aria-expanded={editing}>
          <Icon name={editing ? 'x' : 'plus'} size={12} /> {editing ? 'Close editor' : current ? 'Edit steps' : 'Custom funnel'}
        </button>
      </nav>

      {editing && (
        <Editor site={site} steps={steps} setSteps={setSteps} apply={() => { apply(); setEditing(false); }} declared={declared}
          eventNames={(events.data?.events || []).map((e) => e.name)} run={run} label={label} />
      )}

      <section class="nx-card" aria-label="Funnel">
        {result.error ? <ErrorState error={result.error} onRetry={result.reload} />
          : !result.data ? <Loading height={340} />
          : <FunnelView data={result.data} name={current?.name || 'Custom funnel'} label={label} />}
      </section>
    </div>
  );
}

// Steps named the way the site's goals name them (“Saw the downloads
// section”), with the raw page or event underneath.
function labeller(goals) {
  const byEvent = new Map(goals.filter((g) => g.source === 'event' && g.match).map((g) => [g.match, g.label]));
  const name = (s) => (s.kind === 'event' ? byEvent.get(s.value) || null : s.value === '/' ? 'Home page' : null);
  return {
    title: (s) => name(s) || (s.kind === 'page' ? `Viewed ${s.value}` : s.value.replace(/_/g, ' ')),
    raw: (s) => (name(s) ? (s.kind === 'page' ? s.value : s.value) : s.kind === 'page' ? 'page view' : 'event'),
    short: (s) => name(s) || s.value,
  };
}

function FunnelView({ data, name, label }) {
  const steps = data.steps;
  const first = steps[0]?.sessions || 0;
  if (!first) return <p class="muted">No visits reached the first step in this period.</p>;
  const last = steps.at(-1);
  // The step that loses the largest share of the people who reached the one before it.
  const leak = steps.slice(1).reduce((worst, s, k) => (s.stepRate < 1 && (!worst || s.stepRate < worst.s.stepRate) ? { s, i: k + 1 } : worst), null);
  const notes = findings(steps, leak, label);
  return (
    <div class="nx-fn">
      <div class="nx-jsum-bar">
        <div>
          <h3 class="nx-fn-title">{name}</h3>
          <p class="muted small m-0">Visits that did each step in this order, in one visit.</p>
        </div>
      </div>
      <div class="nx-jsum-stats nx-tiles">
        <div><b>{formatNumber(first)}</b><span class="muted small">started · {label.short(steps[0])}</span></div>
        <div><b class={last.sessions ? 'good' : ''}>{formatNumber(last.sessions)}</b><span class="muted small">finished · {label.short(last)}</span></div>
        <div><b>{formatPercent(last.rate)}</b><span class="muted small">made it all the way</span></div>
        {leak && <div><b class="bad">−{formatPercent(1 - leak.s.stepRate, 0)}</b><span class="muted small">biggest drop · before step {leak.i + 1}</span></div>}
      </div>

      <div class="nx-fn-flow" role="list">
        {steps.map((s, i) => {
          const prev = i ? steps[i - 1] : null;
          const isLeak = leak && leak.i === i;
          return (
            <>
              {prev && (
                <div class={`nx-fn-drop${isLeak ? ' leak' : ''}`} key={`d${i}`} aria-label={`${formatPercent(1 - s.stepRate, 0)} dropped`}>
                  <span class="nx-fn-arrow" aria-hidden="true">→</span>
                  {prev.sessions > s.sessions
                    ? <><b>−{formatPercent(1 - s.stepRate, 0)}</b><span class="small">{formatNumber(prev.sessions - s.sessions)} left</span></>
                    : <b class="good">none lost</b>}
                  {s.avgSeconds !== null && <span class="small muted">~{formatDuration(s.avgSeconds)}</span>}
                </div>
              )}
              <div class="nx-fn-step" role="listitem" key={`s${i}`}>
                <div class="nx-fn-head">
                  <span class="nx-fn-n">{i + 1}</span>
                  <span class="nx-fn-name" title={s.value}>{label.title(s)}</span>
                  <code class="nx-fn-raw" title={s.value}>{label.raw(s)}</code>
                </div>
                <div class="nx-fn-bararea">
                  {prev && <span class="nx-fn-ghost" style={{ height: `${Math.max(1, (prev.sessions / first) * 100)}%` }} />}
                  <span class={`nx-fn-bar${i === steps.length - 1 ? ' last' : ''}`} style={{ height: `${Math.max(1, (s.sessions / first) * 100)}%` }} />
                </div>
                <div class="nx-fn-count"><b>{formatNumber(s.sessions)}</b> <span class="muted small">{formatPercent(s.rate, s.rate < 0.1 ? 1 : 0)}</span></div>
              </div>
            </>
          );
        })}
      </div>

      {notes.length > 0 && (
        <div>
          <h3 class="nx-jsum-h">What it means</h3>
          <ul class="nx-jfind nx-jfind-3">
            {notes.map((n) => <li key={n.title} class={`tone-${n.tone}`}><b>{n.title}</b><span class="muted small">{n.detail}</span></li>)}
          </ul>
        </div>
      )}
      <WarehouseMeta data={data} />
    </div>
  );
}

// What the funnel says, from its own numbers only.
function findings(steps, leak, label) {
  const out = [];
  const first = steps[0].sessions;
  const name = (s) => `“${label.short(s)}”`;
  if (leak) {
    const from = steps[leak.i - 1];
    const lost = from.sessions - leak.s.sessions;
    out.push({
      tone: 'bad',
      title: `Most are lost between ${name(from)} and ${name(leak.s)}`,
      detail: `${formatNumber(lost)} of ${formatNumber(from.sessions)} (${formatPercent(1 - leak.s.stepRate, 0)}) never got to step ${leak.i + 1}. ${from.kind === 'page'
        ? 'If the next step is further down the page, move it up or link to it from the top.'
        : 'Check what sits between these two steps: is the next action clear, and does it work on every device?'}`,
    });
  }
  const slow = steps.slice(1).map((s, k) => ({ s, i: k + 1 })).filter((x) => x.s.avgSeconds !== null && x.s.avgSeconds >= 180).sort((a, b) => b.s.avgSeconds - a.s.avgSeconds)[0];
  if (slow) {
    out.push({
      tone: 'warn',
      title: `Step ${slow.i + 1} takes ~${formatDuration(slow.s.avgSeconds)} on average`,
      detail: `People who make it from ${name(steps[slow.i - 1])} to ${name(slow.s)} take a while: they read first, or have to hunt for it.`,
    });
  }
  const smooth = steps.slice(1).map((s, k) => ({ s, i: k + 1 })).filter((x) => x.s.stepRate >= 0.8 && steps[x.i - 1].sessions >= 3);
  if (smooth.length) {
    const x = smooth[0];
    out.push({ tone: 'good', title: `${name(steps[x.i - 1])} → ${name(x.s)} works`, detail: `${formatPercent(x.s.stepRate, 0)} who reach step ${x.i} go on to step ${x.i + 1}.` });
  }
  if (first < 100) {
    out.push({ tone: 'neutral', title: `Only ${formatNumber(first)} visits started`, detail: 'With this few, one or two visits move the percentages a lot. Try 90 days for a steadier read.' });
  }
  return out.slice(0, 6);
}

function Editor({ site, steps, setSteps, apply, declared, eventNames, run, label }) {
  const update = (i, patch) => setSteps(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <section class="nx-card nx-fn-editor" aria-label="Edit funnel steps">
      <div class="nx-jsum-bar">
        <h3 class="nx-jsum-h">Steps, in order</h3>
        <button class="btn primary" type="button" onClick={apply}><Icon name="play" size={13} /> Show this funnel</button>
      </div>
      <div class="funnel-steps">
        {steps.map((step, i) => (
          <div class="funnel-step" key={i}>
            <span class="n">{i + 1}</span>
            <select aria-label={`Step ${i + 1} type`} value={step.kind} onChange={(e) => update(i, { kind: e.currentTarget.value, value: '' })}>
              <option value="page">Page</option>
              <option value="event">Event</option>
            </select>
            <input type="text" list={step.kind === 'event' ? 'funnel-events' : undefined} aria-label={`Step ${i + 1} ${step.kind === 'page' ? 'path' : 'event name'}`}
              placeholder={step.kind === 'page' ? '/path' : 'event_name'} title={step.value ? label.title(step) : undefined} value={step.value} onInput={(e) => update(i, { value: e.currentTarget.value })}
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
        <div class="row mt-6">
          <button class="btn" type="button" disabled={steps.length >= 8} onClick={() => setSteps([...steps, { kind: 'event', value: '' }])}>
            <Icon name="plus" size={13} /> Add step
          </button>
        </div>
        <p class="note">
          A page matches its exact path; an event matches its GA4 name. Each step has to happen after the one before, in the same visit.
          {' '}{declared.length
            ? <>Changes here are for exploring and aren’t saved. To keep a funnel, add it in <a href={`#/site/${site.id}/setup`}>the site’s settings</a>.</>
            : <>To keep it, add it in <a href={`#/site/${site.id}/setup`}>the site’s settings</a>: <CopyYaml steps={run || steps} /></>}
        </p>
      </div>
    </section>
  );
}

// Copies the funnel as a .sitelens.yml entry.
function CopyYaml({ steps }) {
  const [copied, setCopied] = useState(false);
  const text = `funnels:\n  - name: My funnel\n    steps: [${steps.filter((s) => s.value.trim()).map((s) => `${s.kind}:${s.value}`).join(', ')}]\n`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard refused */
    }
  }
  return <button class="btn ghost" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy as YAML'}</button>;
}
