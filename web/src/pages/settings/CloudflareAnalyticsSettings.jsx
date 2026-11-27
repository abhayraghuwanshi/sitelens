import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section, Steps, Gets, Facts, SecretField } from './ConnectionKit.jsx';

// Cloudflare Web Analytics: an account ID and an API token. Each Kauzl site is
// matched to a Cloudflare siteTag/zone by domain; a hand-picked one wins.
export function CloudflareAnalyticsSettings() {
  const status = useAsync(() => api.get('/cloudflare/status').catch(() => api.get('/cloudflare-analytics/status')), []);
  const list = useAsync(() => api.get('/cloudflare/sites').catch(() => api.get('/cloudflare-analytics/sites')).catch(() => null), []);
  const s = status.data || {};
  const connected = Boolean(s.tokenSource);
  const [accountId, setAccountId] = useState(null);
  const account = accountId ?? s.accountId ?? '';

  async function saveToken(token) {
    const r = await api.post('/cloudflare/settings', { accountId: account, token });
    status.reload();
    list.reload();
    return token ? `Saved${r?.sites === undefined ? '' : ` · ${r.sites} site${r.sites === 1 ? '' : 's'} in Cloudflare`}.` : 'Removed the saved token.';
  }
  async function remove() {
    await api.post('/cloudflare/settings', { accountId: account, token: '' });
    setAccountId(null);
    status.reload();
    list.reload();
    return 'Removed the saved token.';
  }
  async function match(siteId, siteTag) {
    await api.post('/cloudflare/match', { siteId, siteTag });
    list.reload();
  }

  const accountField = (
    <label class="field m-0">Account ID
      <input class="mono" placeholder="32 hex characters" value={account} onInput={(e) => setAccountId(e.currentTarget.value)} />
      <small>On the right of the Cloudflare dashboard’s Workers &amp; Pages page.</small>
    </label>
  );

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'Daily unique visits and pageviews from Cloudflare Web Analytics',
          'Top pages and top referrers for each site',
          'Traffic alerts when a site has no GA4 property',
        ]} />
      </Section>

      {!connected && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Create an API token', body: 'In Cloudflare: My Profile → API Tokens → Create Token, with Account → Analytics → Read.', href: 'https://dash.cloudflare.com/profile/api-tokens', cta: 'Cloudflare API tokens' },
            { title: 'Paste it below', body: 'Kauzl reads Web Analytics for the sites in that account and matches them to your sites by domain.' },
          ]} />
        </Section>
      )}

      <Section title="Account">
        <SecretField label="Cloudflare API token" placeholder="Paste the token" source={s.tokenSource || ''} envName="CLOUDFLARE_API_TOKEN"
          extra={accountField} onSave={saveToken} onRemove={remove} />
        {s.lastError && <p class="small text-bad m-0">{s.lastError}</p>}
      </Section>

      {connected && (
        <Section title="Account">
          <Facts items={[
            { label: 'Account ID', value: <span class="mono">{s.accountId}</span> },
            { label: 'API token', value: s.tokenSource === 'env' ? 'From .env' : 'Saved in Kauzl' },
          ]} />
        </Section>
      )}

      {connected && list.data && (
        <Section title="Your sites in Cloudflare" sub="Matched by domain, ignoring www. Pick the siteTag/zone by hand if it guessed wrong.">
          {list.data.matches?.length ? (
            <div class="cx-list">
              {list.data.matches.map((m) => (
                <div key={m.id} class="cx-list-row">
                  <span class="cx-list-name">
                    <b>{m.label}</b>
                    <span class="small muted">{m.host || 'no address'}{m.manual ? ' · picked by hand' : m.siteTag ? ' · matched by domain' : ''}</span>
                  </span>
                  <input class="mono" value={m.siteTag || ''} placeholder="siteTag/zone" aria-label={`Cloudflare site for ${m.label}`}
                    onBlur={(e) => match(m.id, e.currentTarget.value)} />
                </div>
              ))}
            </div>
          ) : <p class="muted m-0">Add a site in Settings → Sites &amp; products first.</p>}
        </Section>
      )}
    </>
  );
}
