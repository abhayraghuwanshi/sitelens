import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section, Steps, Gets, Facts, SecretField } from './ConnectionKit.jsx';

export function VercelSettings() {
  const status = useAsync(() => api.get('/vercel/status'), []);
  const connect = useAsync(() => api.get('/connect').catch(() => ({})), []);
  const canConnect = Boolean(connect.data?.vercel);
  const [teamId, setTeamId] = useState(null);
  const s = status.data || {};
  const team = teamId ?? s.teamId ?? '';

  async function saveToken(token) {
    const r = await api.post('/vercel/token', { token, teamId: team });
    status.reload();
    return r.login ? `Saved. Signed in as ${r.login}.` : 'Saved.';
  }
  async function remove() {
    await api.post('/vercel/token', { token: '', teamId: '' });
    setTeamId(null);
    status.reload();
    return 'Removed the saved token.';
  }

  const teamField = (
    <label class="field m-0">Team ID <span class="muted small">(optional)</span>
      <input class="mono" placeholder="team_…" value={team} onInput={(e) => setTeamId(e.currentTarget.value)} />
      <small>Leave empty to use your default team.</small>
    </label>
  );

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'Production deploys as moments on each site’s Timeline',
          'Web Analytics for projects hosted on Vercel',
          'A deploy lined up with the traffic change that followed it',
        ]} />
      </Section>

      {!s.tokenSource && (
        <Section title="Set up">
          <Steps items={canConnect ? [
            { title: 'Connect Vercel below', body: 'Pick the account or team that owns your projects. Kauzl only reads them.' },
          ] : [
            { title: 'Create an access token', body: 'Scope it to the team that owns your projects.', href: 'https://vercel.com/account/settings/tokens', cta: 'Vercel tokens' },
            { title: 'Paste it below', body: 'Add the team ID if your projects aren’t in your default team.' },
          ]} />
        </Section>
      )}

      <Section title={canConnect ? 'Account' : 'Access token'}>
        {canConnect && (
          <div class="cx-key-saved">
            <div class="cx-key-text">
              <b>{s.tokenSource === 'oauth' ? `Connected${s.login ? ` as ${s.login}` : ''}` : 'Sign in with Vercel'}</b>
              <span class="small muted">{s.tokenSource === 'oauth' ? 'Refreshes on its own.' : 'The quickest way: no token to copy.'}</span>
            </div>
            <div class="row gap-6">
              <a class={`btn${s.tokenSource === 'oauth' ? ' ghost' : ' primary'}`} href="/auth/vercel">{s.tokenSource === 'oauth' ? 'Connect again' : 'Connect Vercel'}</a>
              {s.tokenSource === 'oauth' && <button class="btn ghost danger" type="button" onClick={remove}>Disconnect</button>}
            </div>
          </div>
        )}
        {(!canConnect || s.tokenSource === 'settings' || s.tokenSource === 'env') && (
          <SecretField label="Vercel access token" placeholder="Paste the token" source={s.tokenSource === 'oauth' ? '' : s.tokenSource || ''} envName="VERCEL_TOKEN"
            extra={teamField} onSave={saveToken} onRemove={remove} />
        )}
        {s.lastError && <p class="small text-bad m-0">{s.lastError}</p>}
      </Section>

      {s.tokenSource && (
        <Section title="Signed in">
          <Facts items={[
            { label: 'Signed in as', value: s.login },
            { label: 'Team', value: s.teamId && <span class="mono">{s.teamId}</span> },
          ]} />
        </Section>
      )}
    </>
  );
}
