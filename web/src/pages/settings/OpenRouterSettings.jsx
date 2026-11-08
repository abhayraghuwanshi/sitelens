import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card } from '../../components/ui.jsx';

// OpenRouter: one key for the answer checks in ChatGPT, Gemini, Perplexity and
// Grok, each with its provider's own web search. Claude keeps its own panel.
export function OpenRouterSettings() {
  const status = useAsync(() => api.get('/ai-search/status'), []);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState({});
  const s = status.data || {};
  const engines = (s.engines || []).filter((e) => e.via === 'openrouter');

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
    <Card title="OpenRouter" sub="One key for answer checks in ChatGPT, Gemini, Perplexity and Grok. Each answers with its own web search, and Studio records whether it names and cites you.">
      <div class="stack">
        <div class="row small">
          <span class={`dot${s.openrouter ? ' on' : ''}`} />
          {s.openrouter ? <>API key from {s.openrouter === 'env' ? <code>OPENROUTER_API_KEY</code> : 'Settings'}</> : 'Not connected'}
        </div>
        <form class="row" onSubmit={(e) => { e.preventDefault(); save({ openrouterKey: key }, 'Saved.'); }}>
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '240px', maxWidth: '420px' }} placeholder="sk-or-…" value={key}
            onInput={(e) => setKey(e.currentTarget.value)} aria-label="OpenRouter API key" />
          <button class="btn primary" type="submit" disabled={busy || !key.trim()}>Save</button>
          {s.openrouter === 'settings' && <button class="btn ghost danger" type="button" disabled={busy} onClick={() => save({ openrouterKey: '' }, 'Removed the saved key.')}>Remove</button>}
        </form>

        {engines.length > 0 && (
          <div class="stack" style={{ gap: '8px' }}>
            <span class="small muted">Ask these assistants. Each uses the newest model OpenRouter lists for it, unless you set one.</span>
            {engines.map((e) => (
              <div key={e.key} class="row small" style={{ gap: '10px', flexWrap: 'wrap' }}>
                <label class="row" style={{ gap: '6px', minWidth: '120px' }}>
                  <input type="checkbox" checked={e.on} disabled={busy} onChange={(ev) => save({ engines: { [e.key]: ev.currentTarget.checked } }, `${e.label} ${ev.currentTarget.checked ? 'on' : 'off'}.`)} />
                  <b>{e.label}</b>
                </label>
                <form class="row" style={{ gap: '6px' }} onSubmit={(ev) => { ev.preventDefault(); save({ models: { [e.key]: models[e.key] ?? '' } }, models[e.key] ? `${e.label} uses ${models[e.key]}.` : `${e.label} uses the newest model.`); }}>
                  <input type="text" style={{ width: '240px' }} placeholder={e.model || 'set a key to see the model'} value={models[e.key] ?? (e.custom ? e.model : '')}
                    onInput={(ev) => setModels({ ...models, [e.key]: ev.currentTarget.value })} aria-label={`${e.label} model`} />
                  <button class="btn ghost" type="submit" disabled={busy}>Set</button>
                </form>
                <span class="muted">{e.custom ? 'pinned' : e.model ? 'newest' : ''}</span>
              </div>
            ))}
          </div>
        )}
        {msg && <p class="small" style={{ margin: 0, color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}
        <p class="note" style={{ margin: 0 }}>
          Create a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a> and add credits at <a href="https://openrouter.ai/credits" target="_blank" rel="noreferrer">openrouter.ai/credits</a>.
          Prefer <code>OPENROUTER_API_KEY=…</code> in <code>.env</code>; a key pasted here is stored in <code>.data/studio.json</code>.
          Each question costs roughly $0.01–0.05 per assistant (the model’s tokens plus about $0.005–0.015 per web search). Checks only run when you press Run, or weekly if turned on.
        </p>
      </div>
    </Card>
  );
}
