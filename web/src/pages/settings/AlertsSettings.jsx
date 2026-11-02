import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card, Loading, ErrorState } from '../../components/ui.jsx';

// Field labels for each rule's thresholds; `pct` values are fractions shown as %.
const FIELDS = {
  pct: { label: 'Change ≥', unit: '%', scale: 100 },
  minVolume: { label: 'Min volume', unit: '/day' },
  z: { label: 'z-score ≥', unit: 'σ' },
  minDrop: { label: 'Drop ≥', unit: '' },
  minGain: { label: 'Gain ≥', unit: '/day' },
  multiple: { label: 'Usual pace ×', unit: '' },
  minNew: { label: 'New ≥', unit: '' },
  minPoints: { label: 'Points ≥', unit: '' },
};

const LABELS = {
  traffic: 'GA4 sessions & users',
  search: 'Search Console clicks',
  installs: 'Web Store listing installs',
  extUsers: 'Extension users drop',
  rating: 'Extension rating drop',
  stars: 'GitHub stars spike',
  issues: 'New GitHub issues',
  mentions: 'New mentions (HN, Reddit, Product Hunt)',
};

export function AlertsSettings() {
  const data = useAsync(() => api.get('/alerts/settings'), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (data.data) setForm(structuredClone(data.data));
  }, [data.data]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!form) return <Loading height={160} />;

  const set = (patch) => setForm({ ...form, ...patch });
  const setRule = (key, field, value) => setForm({ ...form, rules: { ...form.rules, [key]: { ...form.rules[key], [field]: value } } });

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

  return (
    <Card title="Alerts & digest" sub="Checks GitHub and Web Store hourly, GA4 and Search Console once a day">
      <form class="stack" onSubmit={(e) => {
        e.preventDefault();
        act('save', async () => setForm(await api.post('/alerts/settings', form)), () => 'Saved.');
      }}>
        <div class="row">
          <label class="check"><input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} /> Run checks in the background</label>
          <label class="check"><input type="checkbox" checked={form.desktop} onChange={(e) => set({ desktop: e.currentTarget.checked })} /> macOS notifications</label>
          <label class="check"><input type="checkbox" checked={form.includeDemo} onChange={(e) => set({ includeDemo: e.currentTarget.checked })} /> Include the demo site</label>
          <label class="check">Daily digest at
            <select value={form.digestHour} onChange={(e) => set({ digestHour: Number(e.currentTarget.value) })} aria-label="Digest hour">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </label>
        </div>
        <div class="row">
          <input style={{ flex: '1', minWidth: '260px' }} placeholder="https://hooks.slack.com/services/… or https://discord.com/api/webhooks/…" value={form.webhookUrl}
            onInput={(e) => set({ webhookUrl: e.currentTarget.value })} aria-label="Webhook URL" />
        </div>
        <p class="note" style={{ margin: 0 }}>
          The webhook gets <code>{'{ text, content }'}</code> JSON, which works for both Slack incoming webhooks and Discord. A metric alerts when it moves past
          the change threshold against its previous 7-day average, the bigger side has the minimum volume, and its z-score on the last 28 days passes the limit. Each alert fires once.
        </p>
        <table class="data">
          <thead><tr><th>Rule</th><th>On</th><th>Thresholds</th></tr></thead>
          <tbody>
            {Object.entries(form.rules).map(([key, rule]) => (
              <tr key={key}>
                <td><b>{LABELS[key] || key}</b></td>
                <td><input type="checkbox" checked={rule.enabled} onChange={(e) => setRule(key, 'enabled', e.currentTarget.checked)} aria-label={`${LABELS[key]} enabled`} /></td>
                <td>
                  <div class="row" style={{ gap: '12px' }}>
                    {Object.keys(rule).filter((f) => f !== 'enabled').map((field) => {
                      const meta = FIELDS[field] || { label: field, unit: '' };
                      const scale = meta.scale || 1;
                      return (
                        <label class="check" key={field}>{meta.label}
                          <input type="number" min="0" step="any" style={{ width: '72px' }} value={Math.round(rule[field] * scale * 100) / 100}
                            onInput={(e) => setRule(key, field, Number(e.currentTarget.value) / scale)} aria-label={`${LABELS[key]} ${meta.label}`} />
                          {meta.unit && <span class="muted">{meta.unit}</span>}
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="row">
          <button class="btn primary" type="submit" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save alert settings'}</button>
          <button class="btn" type="button" disabled={Boolean(busy)}
            onClick={() => act('test', () => api.post('/alerts/test'), (r) =>
              ['desktop', 'webhook'].map((k) => `${k}: ${r[k].ok ? 'sent' : r[k].error}`).join(' · '))}>
            {busy === 'test' ? 'Sending…' : 'Send test notification'}</button>
          <a class="btn" href="#/alerts">Open alerts</a>
        </div>
        {msg && <p class="small" style={{ margin: 0, color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}
      </form>
    </Card>
  );
}
