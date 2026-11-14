import { useState } from 'preact/hooks';
import { formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { kindColor } from '../charts/LineChart.jsx';
import { Icon } from './icons.jsx';

export const toIso = (d) => {
  const s = String(d || '');
  return /^\d{8}/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s.slice(0, 10);
};

// Annotations for a chart's date span. `dates` are the chart's x values; scopes
// narrow to e.g. ['site:abc'] (global notes always come along).
export function useAnnotations(scopes, dates) {
  const from = dates?.length ? toIso(dates[0]) : '';
  const to = dates?.length ? toIso(dates[dates.length - 1]) : '';
  const scope = (scopes || []).join(',');
  const state = useAsync(() => (from ? api.get(`/annotations${qs({ from, to, scope })}`) : { annotations: [] }), [from, to, scope]);
  return { annotations: state.data?.annotations || [], reload: state.reload };
}

// "Add note" affordance plus a compact list of this range's annotations; notes can be deleted.
export function AnnotationBar({ annotations, scope, scopeLabel = 'this chart', onChange }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState('');
  const [onlyHere, setOnlyHere] = useState(Boolean(scope));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/annotations', { date, label, scope: onlyHere ? scope : '' });
      setLabel('');
      setOpen(false);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await api.del(`/annotations/${id}`);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div class="stack gap-6 mt-8">
      <div class="row gap-6">
        {annotations.map((a) => (
          <span class="chip gap-6" key={a.id} title={a.kind === 'claude' ? `${a.date} · Claude\n\n${a.body || ''}` : `${a.date} · ${a.source}`}>
            <i aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: kindColor(a.kind), display: 'inline-block' }} />
            <span class="muted">{formatDate(a.date.replaceAll('-', ''))}</span>
            {a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.label}</a> : a.label}
            {(a.kind === 'note' || a.kind === 'claude') && (
              <button type="button" class="btn ghost" aria-label={`Delete note ${a.label}`} onClick={() => remove(a.id)}
                style={{ padding: '0 4px', minHeight: '0', lineHeight: '1' }}>×</button>
            )}
          </span>
        ))}
        {!open && (
          <button class="btn ghost" type="button" onClick={() => setOpen(true)} style={{ fontSize: 'var(--text-sm)' }}>
            <Icon name="plus" size={12} /> Add note
          </button>
        )}
      </div>
      {open && (
        <form class="row gap-6" onSubmit={save}>
          <label class="sr-only" for="annotation-date">Date</label>
          <input id="annotation-date" type="date" value={date} required onInput={(e) => setDate(e.currentTarget.value)}
            style={{ font: 'inherit', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text)' }} />
          <label class="sr-only" for="annotation-label">Note</label>
          <input id="annotation-label" type="text" maxLength={140} placeholder="Posted on Reddit, changed pricing…" value={label}
            onInput={(e) => setLabel(e.currentTarget.value)} style={{ flex: '1', minWidth: '200px' }} />
          {scope && (
            <label class="small muted row gap-4">
              <input type="checkbox" checked={onlyHere} onChange={(e) => setOnlyHere(e.currentTarget.checked)} /> Only {scopeLabel}
            </label>
          )}
          <button class="btn primary" type="submit" disabled={busy || !label.trim()}>{busy ? 'Saving…' : 'Save'}</button>
          <button class="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      )}
      {error && <p class="small m-0 text-bad">{error}</p>}
    </div>
  );
}
