import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card } from '../../components/ui.jsx';

export function AnthropicSettings() {
  const status = useAsync(() => api.get('/ai-search/status'), []);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const s = status.data || {};

  async function save(body, done) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/ai-search/settings', body);
      setMsg({ ok: true, text: done });
      setKey('');
      status.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Claude" sub="Powers answer checks in each site’s AI search view: Claude answers your questions with live web search, and Studio records whether it names and cites you.">
      <div class="stack">
        <div class="row small">
          <span class={`dot${s.source ? ' on' : ''}`} />
          {s.source ? <>API key from {s.source === 'env' ? <code>ANTHROPIC_API_KEY</code> : 'Settings'} · model <code>{s.model}</code></> : 'Not connected'}
        </div>
        <form class="row" onSubmit={(e) => { e.preventDefault(); save({ key }, 'Saved.'); }}>
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '240px', maxWidth: '420px' }} placeholder="sk-ant-…" value={key}
            onInput={(e) => setKey(e.currentTarget.value)} aria-label="Anthropic API key" />
          <button class="btn primary" type="submit" disabled={busy || !key.trim()}>Save</button>
          {s.source === 'settings' && <button class="btn ghost danger" type="button" disabled={busy} onClick={() => save({ key: '' }, 'Removed the saved key.')}>Remove</button>}
        </form>
        <label class="row small">
          <input type="checkbox" checked={Boolean(s.weekly)} disabled={busy} onChange={(e) => save({ weekly: e.currentTarget.checked }, e.currentTarget.checked ? 'Weekly checks on.' : 'Weekly checks off.')} />
          Re-run every site’s saved questions once a week
        </label>
        {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
        <p class="note m-0">
          Create a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com → API keys</a>.
          Prefer <code>ANTHROPIC_API_KEY=…</code> in <code>.env</code> (restart the server after); a key pasted here is stored in <code>.data/studio.json</code>.
          Each question costs roughly $0.05–0.20 per run (tokens plus $10 per 1,000 web searches). Checks only run when you press Run, or weekly if turned on.
        </p>
      </div>
    </Card>
  );
}
