import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section, Steps, Gets, SecretField } from './ConnectionKit.jsx';

export function BingSettings() {
  const status = useAsync(() => api.get('/bing/status'), []);
  const connect = useAsync(() => api.get('/connect').catch(() => ({})), []);
  const canConnect = Boolean(connect.data?.bing);
  const s = status.data || { sites: [], matches: [] };

  async function saveKey(key) {
    const r = await api.post('/bing/key', { key });
    status.reload();
    return key ? `Saved. ${r.sites.length} site${r.sites.length === 1 ? '' : 's'} in your Bing account.` : 'Removed.';
  }

  async function match(siteId, siteUrl) {
    await api.post('/bing/match', { siteId, siteUrl });
    status.reload();
  }

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'Bing search clicks, impressions and the queries behind them',
          'Which pages Bing shows, and its crawl health',
          'A read on DuckDuckGo, Copilot and ChatGPT search, which use Bing’s index',
        ]} />
      </Section>

      {!s.source && (
        <Section title="Set up">
          <Steps items={canConnect ? [
            { title: 'Add your sites to Bing Webmaster Tools', body: '“Import from Google Search Console” adds them all in one click.', href: 'https://www.bing.com/webmasters', cta: 'Bing Webmaster Tools' },
            { title: 'Connect Bing below', body: 'Kauzl only reads, and matches Bing sites to yours by domain.' },
          ] : [
            { title: 'Add your sites to Bing Webmaster Tools', body: '“Import from Google Search Console” adds them all in one click.', href: 'https://www.bing.com/webmasters', cta: 'Bing Webmaster Tools' },
            { title: 'Generate an API key', body: 'Settings (gear) → API access → API key → Generate.' },
            { title: 'Paste it below', body: 'Sites are matched to yours by domain.' },
          ]} />
        </Section>
      )}

      <Section title={canConnect ? 'Account' : 'API key'}>
        {canConnect && (
          <div class="cx-key-saved">
            <div class="cx-key-text">
              <b>{s.source === 'oauth' ? 'Connected to Bing' : 'Sign in with Microsoft'}</b>
              <span class="small muted">{s.source === 'oauth' ? `${s.sites.length} site${s.sites.length === 1 ? '' : 's'} in your Bing account` : 'The quickest way: no key to copy.'}</span>
            </div>
            <div class="row gap-6">
              <a class={`btn${s.source === 'oauth' ? ' ghost' : ' primary'}`} href="/auth/bing">{s.source === 'oauth' ? 'Connect again' : 'Connect Bing'}</a>
              {s.source === 'oauth' && <button class="btn ghost danger" type="button" onClick={() => saveKey('')}>Disconnect</button>}
            </div>
          </div>
        )}
        {(!canConnect || s.source === 'settings' || s.source === 'env') && (
          <SecretField label="Bing Webmaster API key" placeholder="Paste the key from API access" source={s.source === 'oauth' ? '' : s.source || ''} envName="BING_WEBMASTER_KEY"
            onSave={saveKey} onRemove={() => saveKey('')} />
        )}
        {canConnect && !s.source && (
          <details class="key-form"><summary>Or paste an API key instead</summary>
            <SecretField label="Bing Webmaster API key" placeholder="Paste the key from API access" source="" envName="BING_WEBMASTER_KEY" onSave={saveKey} />
          </details>
        )}
        {s.error && <p class="small text-bad m-0">{s.error}</p>}
      </Section>

      {s.source && s.matches.length > 0 && (
        <Section title="Your sites in Bing" sub="Matched by domain. Change one if it picked the wrong Bing site.">
          <div class="cx-list">
            {s.matches.map((m) => (
              <div key={m.siteId} class="cx-list-row">
                <span class="cx-list-name"><b>{m.label}</b><span class="small muted">{m.host}</span></span>
                <span class="row gap-6">
                  <select value={m.siteUrl} aria-label={`Bing site for ${m.label}`} onChange={(e) => match(m.siteId, e.currentTarget.value)}>
                    <option value="">Not in Bing</option>
                    {s.sites.map((b) => <option key={b.url} value={b.url}>{b.url}{b.verified ? '' : ' (not verified)'}</option>)}
                  </select>
                  {!m.siteUrl && <a class="small" href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">Add it ↗</a>}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
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
