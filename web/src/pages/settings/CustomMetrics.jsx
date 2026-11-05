import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card, Loading, ErrorState } from '../../components/ui.jsx';
import { MetricChart } from '../CustomMetrics.jsx';

const EXAMPLE_SQL = `SELECT date(created_at) AS day,
       count(DISTINCT install_id) AS value,
       version AS dimension
FROM pings
WHERE created_at >= {{start}} AND created_at < {{end}}
GROUP BY 1, 3`;

const SUMMARIES = [
  { key: 'sum', label: 'Sum of the days', help: 'Pings, signups, revenue' },
  { key: 'average', label: 'Daily average', help: 'Daily active installs' },
  { key: 'latest', label: 'Latest day', help: 'Running totals' },
];

const blank = (sites) => ({ siteId: sites[0]?.id || '', label: '', unit: '', summary: 'sum', source: { type: 'd1', accountId: '', databaseId: '' }, sql: EXAMPLE_SQL });

// Settings → Custom metrics: the source tokens, then one editor per metric.
export function CustomMetricsSettings({ sites, params }) {
  const status = useAsync(() => api.get('/metrics'), []);
  const [editing, setEditing] = useState(null);
  const real = sites.filter((s) => !s.demo);
  if (status.error) return <ErrorState error={status.error} onRetry={status.reload} />;
  if (!status.data) return <Loading height={320} />;
  const { connectors, metrics } = status.data;
  const fromLink = params.get('edit') && metrics.find((m) => m.id === params.get('edit'));
  const current = editing || (fromLink && editing !== false ? fromLink : null);
  const siteLabel = (id) => real.find((s) => s.id === id)?.label || id;

  return (
    <div class="stack" style={{ gap: '16px' }}>
      {connectors.map((c) => <SecretCard key={c.type} connector={c} onChange={status.reload} />)}

      {current ? (
        <MetricEditor initial={current} sites={real} connectors={connectors}
          onDone={() => { setEditing(false); status.reload(); }} />
      ) : (
        <Card title="Custom metrics" sub="Daily numbers from your own databases, charted on each site’s Overview" flush
          actions={<button class="btn primary" type="button" disabled={!real.length} onClick={() => setEditing(blank(real))}>Add metric</button>}>
          {metrics.length ? (
            <table class="data">
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.id}>
                    <td><b>{m.label}</b><div class="muted small">{siteLabel(m.siteId)}</div></td>
                    <td class="small">{connectors.find((c) => c.type === m.source.type)?.label || m.source.type}</td>
                    <td class="small muted">{SUMMARIES.find((s) => s.key === m.summary)?.label}</td>
                    <td class="num" style={{ whiteSpace: 'nowrap' }}>
                      <button class="btn ghost" type="button" onClick={() => setEditing(m)}>Edit</button>
                      <button class="btn ghost danger" type="button" onClick={async () => { await api.del(`/metrics/${m.id}`); status.reload(); }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p class="muted" style={{ padding: '8px 16px' }}>{real.length ? 'No custom metrics yet.' : 'Add a site first; each metric belongs to one site.'}</p>
          )}
        </Card>
      )}
    </div>
  );
}

function SecretCard({ connector: c, onChange }) {
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function save(value) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/metrics/token', { type: c.type, token: value });
      setMsg({ ok: true, text: value ? 'Saved. Use Test in a metric to check it.' : 'Removed the saved token.' });
      setToken('');
      onChange();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={c.label} sub={c.secret.label}>
      <div class="stack">
        <div class="row small">
          <span class={`dot${c.secret.source ? ' on' : ''}`} />
          {c.secret.source ? <>Token from {c.secret.source === 'env' ? <code>{c.secret.env}</code> : 'Settings'}</> : 'No token yet'}
        </div>
        <form class="row" onSubmit={(e) => { e.preventDefault(); save(token); }}>
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '240px' }} placeholder={c.secret.label} value={token}
            onInput={(e) => setToken(e.currentTarget.value)} aria-label={c.secret.label} />
          <button class="btn primary" type="submit" disabled={busy || !token.trim()}>Save</button>
          {c.secret.source === 'settings' && <button class="btn ghost danger" type="button" disabled={busy} onClick={() => save('')}>Remove</button>}
        </form>
        {c.type === 'd1' && (
          <p class="note" style={{ margin: 0 }}>
            Create a token at <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">dash.cloudflare.com/profile/api-tokens</a> with
            {' '}<b>Account → D1 → Read</b> for the account that holds the database. It’s stored in <code>.data/studio.json</code> (owner-only), or
            set <code>{c.secret.env}</code> in <code>.env</code>.
          </p>
        )}
        {msg && <p class="small" style={{ margin: 0, color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}
      </div>
    </Card>
  );
}

function MetricEditor({ initial, sites, connectors, onDone }) {
  const [form, setForm] = useState(() => structuredClone(initial));
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const connector = connectors.find((c) => c.type === form.source.type) || connectors[0];
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSource = (patch) => setForm((f) => ({ ...f, source: { ...f.source, ...patch } }));

  async function act(kind) {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'test') setPreview(await api.post('/metrics/preview', { ...form, range: '28d' }));
      else {
        await api.post('/metrics', form);
        onDone();
      }
    } catch (err) {
      setError(err);
      if (kind === 'test') setPreview(null);
    } finally {
      setBusy('');
    }
  }

  return (
    <form class="stack" onSubmit={(e) => { e.preventDefault(); act('save'); }}>
      <Card title={initial.id ? `Edit ${initial.label}` : 'Add a custom metric'} sub="A query that returns one row per day: day, value, and optionally dimension">
        <div class="stack">
          <div class="settings-grid">
            <label class="field">Site
              <select value={form.siteId} onChange={(e) => set({ siteId: e.currentTarget.value })}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label class="field">Name<input required value={form.label} placeholder="Daily pings" onInput={(e) => set({ label: e.currentTarget.value })} /></label>
            <label class="field">Unit<input value={form.unit} placeholder="optional, e.g. installs" onInput={(e) => set({ unit: e.currentTarget.value })} /></label>
            <label class="field">Headline number
              <select value={form.summary} onChange={(e) => set({ summary: e.currentTarget.value })}>
                {SUMMARIES.map((s) => <option key={s.key} value={s.key}>{s.label} · {s.help}</option>)}
              </select>
            </label>
            <label class="field">Source
              <select value={form.source.type} onChange={(e) => setSource({ type: e.currentTarget.value })}>
                {connectors.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
              </select>
            </label>
            {connector.fields.map((f) => (
              <label key={f.key} class="field">{f.label}
                <input required class="mono" value={form.source[f.key] || ''} onInput={(e) => setSource({ [f.key]: e.currentTarget.value })} />
                <small>{f.hint}</small>
              </label>
            ))}
          </div>
          <label class="field">Query
            <textarea rows={8} spellcheck={false} value={form.sql} onInput={(e) => set({ sql: e.currentTarget.value })} />
            <small>
              SELECT only. <code>{'{{start}}'}</code> / <code>{'{{end}}'}</code> are YYYY-MM-DD dates (end is exclusive);
              use <code>{'{{start_ms}}'}</code> / <code>{'{{end_ms}}'}</code> or <code>_s</code> for epoch timestamps. Studio asks for the range and the
              period before it, so keep the WHERE on those placeholders.
            </small>
          </label>
          {error && <ErrorState error={error} />}
          <div class="row">
            <button class="btn" type="button" disabled={Boolean(busy)} onClick={() => act('test')}>{busy === 'test' ? 'Running…' : 'Test (last 28 days)'}</button>
            <button class="btn primary" type="submit" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            <button class="btn ghost" type="button" disabled={Boolean(busy)} onClick={onDone}>Cancel</button>
          </div>
        </div>
      </Card>

      {preview && (
        <Card title="Preview" sub={`${preview.rows} rows matched · first rows as the source returned them`}>
          <div class="stack">
            <MetricChart metric={{ ...preview, label: form.label, unit: form.unit, summary: form.summary }} height={180} />
            {preview.sample.length > 0 && (
              <div class="table-wrap">
                <table class="data compact">
                  <thead><tr>{Object.keys(preview.sample[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>
                    {preview.sample.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} class="small mono">{String(v)}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </form>
  );
}
