import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card } from '../../components/ui.jsx';
import { KeyForm } from './BingSettings.jsx';

export function VercelSettings() {
  const status = useAsync(() => api.get('/vercel/status'), []);
  const connect = useAsync(() => api.get('/connect').catch(() => ({})), []);
  const canConnect = Boolean(connect.data?.vercel);
  const [token, setToken] = useState('');
  const [teamId, setTeamId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const s = status.data || {};
  const team = teamId ?? s.teamId ?? '';

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post('/vercel/token', { token, teamId: team });
      setMsg({ ok: true, text: r.login ? `Saved — signed in as ${r.login}.` : 'Saved.' });
      setToken('');
      status.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.post('/vercel/token', { token: '', teamId: '' });
      setTeamId(null);
      setMsg({ ok: true, text: 'Removed the saved token.' });
      status.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Vercel" sub="Deployments and Web Analytics for projects hosted on Vercel">
      <div class="stack">
        <div class="row small">
          <span class={`dot${s.tokenSource ? ' on' : ''}`} />
          {s.tokenSource
            ? <>{s.tokenSource === 'oauth' ? 'Connected to Vercel' : <>Token from {s.tokenSource === 'env' ? <code>VERCEL_TOKEN</code> : 'Settings'}</>}{s.login && <> · <b>{s.login}</b></>}
                {s.teamId && <> · <span class="mono">{s.teamId}</span></>}
                {s.lastError && <span class="text-bad"> · {s.lastError}</span>}</>
            : 'No token yet'}
        </div>
        {canConnect && (
          <div class="row">
            <a class="btn primary" href="/auth/vercel">{s.tokenSource === 'oauth' ? 'Connect again' : 'Connect Vercel'}</a>
            {s.tokenSource === 'oauth' && <button class="btn ghost danger" type="button" disabled={busy} onClick={remove}>Disconnect</button>}
          </div>
        )}
        <KeyForm open={!canConnect}>
        <form class="row" onSubmit={save}>
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '240px' }} placeholder="Vercel access token" value={token}
            onInput={(e) => setToken(e.currentTarget.value)} aria-label="Vercel token" />
          <input style={{ width: '250px' }} placeholder="team_… (optional)" value={team}
            onInput={(e) => setTeamId(e.currentTarget.value)} aria-label="Vercel team ID" />
          <button class="btn primary" type="submit" disabled={busy || (!token.trim() && !s.tokenSource)}>{busy ? 'Checking…' : 'Save'}</button>
          {s.tokenSource === 'settings' && <button class="btn ghost danger" type="button" disabled={busy} onClick={remove}>Remove</button>}
        </form>
        </KeyForm>
        <p class="note">
          {canConnect && <>Connect picks the account or team that owns your projects; Kauzl only reads them. </>}
          {!canConnect && <>Create a token at <a href="https://vercel.com/account/settings/tokens" target="_blank" rel="noreferrer">vercel.com/account/settings/tokens</a> scoped
          to the team that owns your projects. It's stored in <code>.data/studio.json</code> (owner-only), or set <code>VERCEL_TOKEN</code> (and
          optionally <code>VERCEL_TEAM_ID</code>) in <code>.env</code>. Leave the team empty to use your default team.</>}
        </p>
        {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
