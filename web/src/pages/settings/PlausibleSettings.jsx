import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section, Steps, Gets, Facts, SecretField } from './ConnectionKit.jsx';

const DEFAULT_BASE = 'https://plausible.io';

// Plausible: a Stats API key and, for self-hosted installs, the server URL. Each
// Kauzl site is matched to a Plausible site_id by domain; a hand-picked one wins.
export function PlausibleSettings() {
  const status = useAsync(() => api.get('/plausible/status'), []);
  const list = useAsync(() => api.get('/plausible/sites').catch(() => null), []);
  const s = status.data || {};
  const connected = Boolean(s.keySource);
  const [baseUrl, setBaseUrl] = useState(null);
  const base = baseUrl ?? s.baseUrl ?? DEFAULT_BASE;

  async function saveKey(key) {
    const r = await api.post('/plausible/settings', { key, baseUrl: base });
    status.reload();
    list.reload();
    return key
      ? `Saved${r.sites === undefined ? '' : ` · ${r.sites} site${r.sites === 1 ? '' : 's'} in Plausible`}.`
      : 'Removed the saved key.';
  }
  async function remove() {
    await api.post('/plausible/settings', { key: '', baseUrl: base });
    setBaseUrl(null);
    status.reload();
    list.reload();
    return 'Removed the saved key.';
  }
  async function match(siteId, plausibleSite) {
    await api.post('/plausible/match', { siteId, plausibleSite });
    list.reload();
  }

  const baseField = (
    <label class="field m-0">Plausible URL
      <input class="mono" placeholder={DEFAULT_BASE} value={base} onInput={(e) => setBaseUrl(e.currentTarget.value)} />
      <small>Leave as {DEFAULT_BASE}, or use your self-hosted Plausible’s address.</small>
    </label>
  );

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'Daily visitors, pageviews, visits and bounce rate for each site',
          'Top pages, the sources that sent people, and goal conversions',
          'Traffic alerts when a site has no GA4 property',
        ]} />
      </Section>

      {!connected && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Create a Stats API key', body: 'In Plausible: Settings → API keys → New API key, choose Stats API.', href: 'https://plausible.io/settings/api-keys', cta: 'Plausible API keys' },
            { title: 'Paste it below', body: 'Kauzl reads the sites in that key’s team and matches them to your sites by domain.' },
          ]} />
        </Section>
      )}

      <Section title="API key">
        <SecretField label="Plausible Stats API key" placeholder="Paste the key" source={s.keySource || ''} envName="PLAUSIBLE_API_KEY"
          extra={baseField} onSave={saveKey} onRemove={remove} />
        {s.lastError && <p class="small text-bad m-0">{s.lastError}</p>}
      </Section>

      {connected && (
        <Section title="Server">
          <Facts items={[
            { label: 'Plausible URL', value: <span class="mono">{s.baseUrl}</span> },
            { label: 'API key', value: s.keySource === 'env' ? 'From .env' : 'Saved in Kauzl' },
          ]} />
        </Section>
      )}

      {connected && list.data && (
        <Section title="Your sites in Plausible" sub="Matched by domain, ignoring www. Pick the Plausible site by hand if it guessed wrong.">
          {list.data.matches?.length ? (
            <div class="cx-list">
              {list.data.matches.map((m) => (
                <div key={m.id} class="cx-list-row">
                  <span class="cx-list-name">
                    <b>{m.label}</b>
                    <span class="small muted">{m.host || 'no address'}{m.manual ? ' · picked by hand' : m.siteId ? ' · matched by domain' : ''}</span>
                  </span>
                  <select value={m.siteId} aria-label={`Plausible site for ${m.label}`} onChange={(e) => match(m.id, e.currentTarget.value)}>
                    <option value="">Not in Plausible</option>
                    {list.data.sites.map((x) => <option key={x.domain} value={x.domain}>{x.domain}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ) : <p class="muted m-0">Add a site in Settings → Sites & products first.</p>}
        </Section>
      )}
    </>
  );
}
