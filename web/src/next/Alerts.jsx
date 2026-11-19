import { useEffect, useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

// Alert settings (#/alerts?view=settings): the rules, and where alerts go.
// The alerts themselves are in the Inbox (Inbox.jsx). Changes tell the sidebar.
const changed = () => dispatchEvent(new Event('alerts-changed'));
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;

/* --- Settings --- */

const FIELDS = {
  pct: { label: 'Change', unit: '%', scale: 100 },
  minVolume: { label: 'Min volume', unit: '/day' },
  z: { label: 'z-score', unit: 'σ' },
  minDrop: { label: 'Drop', unit: '' },
  minGain: { label: 'Gain', unit: '/day' },
  multiple: { label: 'Usual pace ×', unit: '' },
  minNew: { label: 'New', unit: '' },
  minPoints: { label: 'Points', unit: '' },
};

const GROUPS = [
  { label: 'Sites', rules: { traffic: 'Sessions & users', search: 'Search Console clicks', goals: 'Goals', }, note: { goals: 'Goals marked to alert in each site’s .sitelens.yml' } },
  { label: 'Chrome extensions', rules: { installs: 'Listing installs', extUsers: 'Users drop', rating: 'Rating drop' } },
  { label: 'GitHub & mentions', rules: { stars: 'Stars spike', issues: 'New issues', mentions: 'Mentions on HN, Reddit, Product Hunt' } },
];

export function AlertSettings() {
  const data = useAsync(() => api.get('/alerts/settings'), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (data.data) setForm(structuredClone(data.data));
  }, [data.data]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!form) return <Loading height={240} />;

  const set = (patch) => setForm({ ...form, ...patch });
  const setRule = (key, field, value) => setForm({ ...form, rules: { ...form.rules, [key]: { ...form.rules[key], [field]: value } } });
  const dirty = JSON.stringify(form) !== JSON.stringify(data.data);

  async function act(kind, fn, done) {
    setBusy(kind);
    setMsg(null);
    try {
      setMsg({ ok: true, text: done(await fn()) });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }
  const save = (e) => {
    e.preventDefault();
    act('save', async () => {
      const saved = await api.post('/alerts/settings', form);
      data.reload();
      changed();
      return saved;
    }, () => 'Saved.');
  };
  const known = new Set(GROUPS.flatMap((g) => Object.keys(g.rules)));
  const groups = [...GROUPS, { label: 'Other', rules: Object.fromEntries(Object.keys(form.rules).filter((k) => !known.has(k)).map((k) => [k, k])) }];

  return (
    <form class="alert-settings" onSubmit={save}>
      <section class="card card-plain">
        <h2 class="nx-h2">Checking</h2>
        <label class="alert-toggle">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
          <span><b>Check in the background</b><span class="muted small">GitHub and Web Store every hour, GA4 and Search Console once a day.</span></span>
        </label>
        <label class="alert-toggle">
          <input type="checkbox" checked={form.includeDemo} onChange={(e) => set({ includeDemo: e.currentTarget.checked })} />
          <span><b>Include the demo site</b><span class="muted small">Its sample data can raise alerts too.</span></span>
        </label>
        <label class="alert-field">
          <span>Daily check and digest at</span>
          <select value={form.digestHour} onChange={(e) => set({ digestHour: Number(e.currentTarget.value) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
      </section>

      <section class="card card-plain">
        <h2 class="nx-h2">Where alerts go</h2>
        <p class="note">Every alert lands in Kauzl. You can also send it to these:</p>
        <label class="alert-toggle">
          <input type="checkbox" checked={form.desktop} onChange={(e) => set({ desktop: e.currentTarget.checked })} />
          <span><b>macOS notifications</b><span class="muted small">From the desktop app, while it’s running.</span></span>
        </label>
        <label class="alert-field wide">
          <span>Slack or Discord webhook</span>
          <input type="url" placeholder="https://hooks.slack.com/services/… or https://discord.com/api/webhooks/…" value={form.webhookUrl}
            onInput={(e) => set({ webhookUrl: e.currentTarget.value })} />
        </label>
        <div class="alert-actions start">
          <button type="button" class="btn" disabled={Boolean(busy)}
            onClick={() => act('test', () => api.post('/alerts/test'), (r) => ['desktop', 'webhook'].map((k) => `${k === 'desktop' ? 'macOS' : 'Webhook'}: ${r[k].ok ? 'sent' : r[k].error}`).join(' · '))}>
            {busy === 'test' ? 'Sending…' : 'Send a test'}
          </button>
          <span class="muted small">Test uses the saved settings.</span>
        </div>
      </section>

      <section class="card card-plain">
        <h2 class="nx-h2">What to watch</h2>
        <p class="note">
          A metric alerts when it moves past the change against its 7-day average, the bigger side has the minimum volume, and its z-score on the last 28 days passes the limit.
          Each alert fires once. A site’s .sitelens.yml can tune its own traffic and search limits.
        </p>
        {groups.filter((g) => Object.keys(g.rules).some((k) => form.rules[k])).map((g) => (
          <div key={g.label} class="alert-group">
            <span class="nx-label-sm">{g.label}</span>
            {Object.entries(g.rules).filter(([k]) => form.rules[k]).map(([key, name]) => {
              const rule = form.rules[key];
              return (
                <div key={key} class={`alert-rule${rule.enabled ? '' : ' off'}`}>
                  <label class="alert-rule-name">
                    <input type="checkbox" checked={rule.enabled} onChange={(e) => setRule(key, 'enabled', e.currentTarget.checked)} />
                    <span>{name}{g.note?.[key] && <span class="muted small">{g.note[key]}</span>}</span>
                  </label>
                  <div class="alert-limits">
                    {Object.keys(rule).filter((f) => f !== 'enabled').map((field) => {
                      const meta = FIELDS[field] || { label: field, unit: '' };
                      const scale = meta.scale || 1;
                      return (
                        <label key={field} class="alert-limit">
                          <span>{meta.label}</span>
                          <span class="alert-num">
                            <input type="number" min="0" step="any" disabled={!rule.enabled} value={Math.round(rule[field] * scale * 100) / 100}
                              onInput={(e) => setRule(key, field, Number(e.currentTarget.value) / scale)} aria-label={`${name}: ${meta.label}`} />
                            {meta.unit && <i>{meta.unit}</i>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <div class="alert-save">
        <button type="submit" class="btn primary" disabled={Boolean(busy) || !dirty}>{busy === 'save' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        {dirty && <button type="button" class="btn" onClick={() => setForm(structuredClone(data.data))}>Discard</button>}
        {msg && <span class={`small ${msg.ok ? 'good' : 'nx-error'}`} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}
