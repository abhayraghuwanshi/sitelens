import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card } from '../../components/ui.jsx';

export function BingSettings() {
  const status = useAsync(() => api.get('/bing/status'), []);
  const connect = useAsync(() => api.get('/connect').catch(() => ({})), []);
  const canConnect = Boolean(connect.data?.bing);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const s = status.data || { sites: [], matches: [] };

  async function save(event, value = key) {
    event?.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post('/bing/key', { key: value });
      setMsg({ ok: true, text: value ? `Saved. ${r.sites.length} site${r.sites.length === 1 ? '' : 's'} in your Bing account.` : 'Removed the saved key.' });
      setKey('');
      status.reload();
    } catch (err) {
      setMsg({ ok: false, text: `${err.message}${err.hint ? ` ${err.hint}` : ''}` });
    } finally {
      setBusy(false);
    }
  }

  async function match(siteId, siteUrl) {
    await api.post('/bing/match', { siteId, siteUrl });
    status.reload();
  }

  return (
    <Card title="Bing Webmaster Tools" sub="Bing search clicks, queries, pages and crawl health. Bing also feeds DuckDuckGo, Copilot and ChatGPT search.">
      <div class="stack">
        <div class="row small">
          <span class={`dot${s.source ? ' on' : ''}`} />
          {s.source
            ? <>{s.source === 'oauth' ? 'Connected to Bing' : <>API key from {s.source === 'env' ? <code>BING_WEBMASTER_KEY</code> : 'Settings'}</>} · {s.sites.length} site{s.sites.length === 1 ? '' : 's'}
                {s.error && <span class="text-bad"> · {s.error}</span>}</>
            : 'Not connected'}
        </div>
        {canConnect && (
          <div class="row">
            <a class="btn primary" href="/auth/bing">{s.source === 'oauth' ? 'Connect again' : 'Connect Bing'}</a>
            {s.source === 'oauth' && <button class="btn ghost danger" type="button" disabled={busy} onClick={() => save(null, '')}>Disconnect</button>}
          </div>
        )}
        <KeyForm open={!canConnect}>
          <form class="row" onSubmit={save}>
            <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '240px', maxWidth: '420px' }} placeholder="Bing Webmaster API key" value={key}
              onInput={(e) => setKey(e.currentTarget.value)} aria-label="Bing Webmaster API key" />
            <button class="btn primary" type="submit" disabled={busy || !key.trim()}>{busy ? 'Checking…' : 'Save'}</button>
            {s.source === 'settings' && <button class="btn ghost danger" type="button" disabled={busy} onClick={() => save(null, '')}>Remove</button>}
          </form>
        </KeyForm>
        {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}

        {s.source && s.matches.length > 0 && (
          <table class="data">
            <thead><tr><th>Kauzl site</th><th>Bing site</th></tr></thead>
            <tbody>
              {s.matches.map((m) => (
                <tr key={m.siteId}>
                  <td>{m.label} <span class="muted small">{m.host}</span></td>
                  <td>
                    <select value={m.siteUrl} aria-label={`Bing site for ${m.label}`} onChange={(e) => match(m.siteId, e.currentTarget.value)}>
                      <option value="">— not in Bing —</option>
                      {s.sites.map((b) => <option key={b.url} value={b.url}>{b.url}{b.verified ? '' : ' (not verified)'}</option>)}
                    </select>
                    {!m.siteUrl && <span class="small muted"> Add it at <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">bing.com/webmasters</a></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p class="note m-0">
          {canConnect
            ? <>Your sites need to be in <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">Bing Webmaster Tools</a> first: there, “Import from Google Search Console” adds them all in one click.
                Kauzl only reads; sites are matched to yours by domain.</>
            : <>In <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">Bing Webmaster Tools</a>: add your site (importing from Google Search Console is one click),
                then Settings (gear) → API access → API key → Generate. The key is stored in <code>.data/studio.json</code>, or set <code>BING_WEBMASTER_KEY</code> in <code>.env</code>.
                Sites are matched to Kauzl sites by domain.</>}
        </p>
      </div>
    </Card>
  );
}

// The paste-a-key form, folded away when a Connect button does the job.
export function KeyForm({ open, children }) {
  if (open) return children;
  return (
    <details class="key-form">
      <summary>Or paste a key instead</summary>
      {children}
    </details>
  );
}
