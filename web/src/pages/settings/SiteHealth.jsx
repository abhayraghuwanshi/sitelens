import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card } from '../../components/ui.jsx';

// Google API key for PageSpeed Insights + Chrome UX Report (Settings → Site health).
export function SiteHealthCard() {
  const status = useAsync(() => api.get('/vitals'), []);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const source = status.data?.key.source || '';

  async function save(value) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post('/vitals/key', { key: value });
      setMsg({ ok: true, text: value ? 'Key works — PageSpeed and CrUX will use it.' : r.source === 'env' ? 'Removed. GOOGLE_API_KEY from .env is used now.' : 'Removed.' });
      setKey('');
      status.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Site health" sub="Uptime every 5 minutes, PageSpeed Insights daily, Core Web Vitals from CrUX">
      <div class="stack">
        <div class="row small">
          <span class={`dot${source ? ' on' : ''}`} />
          {source === 'settings' ? 'API key saved in Settings' : source === 'env' ? <>API key from <code>GOOGLE_API_KEY</code></> : 'No API key needed — PageSpeed and CrUX run on your Google sign-in'}
        </div>
        <form class="row" onSubmit={(e) => { e.preventDefault(); save(key.trim()); }}>
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '260px' }} placeholder="AIza…" value={key}
            onInput={(e) => setKey(e.currentTarget.value)} aria-label="Google API key" />
          <button class="btn primary" type="submit" disabled={!key.trim() || busy}>{busy ? 'Checking…' : 'Save key'}</button>
          {source === 'settings' && <button class="btn ghost danger" type="button" disabled={busy} onClick={() => save('')}>Remove</button>}
        </form>
        <p class="note">
          PageSpeed runs on your Google sign-in once the <b>PageSpeed Insights API</b> is enabled in the sign-in client’s project.
          CrUX history comes monthly from BigQuery’s public CrUX dataset (about 0.4 GB per site, weekly at most), billed to your sites’ BigQuery project.
          Optional: an <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">API key</a> for the PageSpeed Insights
          and Chrome UX Report APIs switches to weekly CrUX history. Paste it here (stored in <code>.data/studio.json</code>, owner-only) or set <code>GOOGLE_API_KEY</code> in <code>.env</code>.
        </p>
        {msg && <p class="small" style={{ margin: 0, color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}
      </div>
    </Card>
  );
}
