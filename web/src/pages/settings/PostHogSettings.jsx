import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section, Steps, Gets, Facts } from './ConnectionKit.jsx';

const DEFAULT_BASE = 'https://us.posthog.com';
const EU_BASE = 'https://eu.posthog.com';

// PostHog: a personal API key, the project_id and (for EU / self-hosted) the
// base URL. Each Kauzl site is matched to a PostHog site by the `$host` on
// `$pageview` events, ignoring www; a hand-picked one wins. Built with ConnectionKit.
export function PostHogSettings() {
  const status = useAsync(() => api.get('/posthog/status'), []);
  const list = useAsync(() => api.get('/posthog/sites').catch(() => null), []);
  const s = status.data || {};
  const connected = Boolean(s.keySource) && Boolean(s.projectId);
  const [baseUrl, setBaseUrl] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const base = baseUrl ?? s.baseUrl ?? DEFAULT_BASE;
  const project = projectId ?? s.projectId ?? '';

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/posthog/settings', { key, projectId: project, baseUrl: base });
      setKey('');
      setMsg({ ok: true, text: 'Saved.' });
      status.reload();
      list.reload();
    } catch (err) {
      setMsg({ ok: false, text: `${err.message}${err.hint ? ` ${err.hint}` : ''}` });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/posthog/settings', { key: '', projectId: project, baseUrl: base });
      setKey('');
      setMsg({ ok: true, text: 'Removed the saved key.' });
      status.reload();
      list.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function match(siteId, posthogSite) {
    await api.post('/posthog/match', { siteId, posthogSite });
    list.reload();
  }

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'Daily unique visitors, pageviews, sessions and bounce rate for each site',
          'Top pages, top referrers and custom conversion events',
          'Traffic alerts when a site has no GA4 property',
        ]} />
      </Section>

      {!connected && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Create a personal API key', body: 'In PostHog: Settings → Personal API keys → Create personal API key. Kauzl only reads.', href: 'https://us.posthog.com/settings/user-api-keys', cta: 'PostHog API keys' },
            { title: 'Find your project_id', body: 'In PostHog: Settings → Project → Project ID.' },
            { title: 'Paste both below', body: 'Pick US or EU cloud, or a self-hosted PostHog URL. Kauzl matches sites by domain.' },
          ]} />
        </Section>
      )}

      <Section title="PostHog">
        <form class="cx-key-form" onSubmit={save}>
          <label class="field m-0">PostHog base URL
            <input class="mono" placeholder={DEFAULT_BASE} value={base} onInput={(e) => setBaseUrl(e.currentTarget.value)} />
            <small>{DEFAULT_BASE} (US), {EU_BASE} (EU), or your self-hosted PostHog address.</small>
          </label>
          <label class="field m-0">Personal API Key
            <input type="password" class="mono" autocomplete="off" spellcheck={false} placeholder={s.keySource ? '•••••••••••• (saved)' : 'phx_…'} value={key} onInput={(e) => setKey(e.currentTarget.value)} />
            <small>{s.keySource === 'env' ? <>From <code>POSTHOG_API_KEY</code> in .env</> : s.keySource ? 'A key is saved. Leave blank to keep it.' : <>Or set <code>POSTHOG_API_KEY</code> in <code>.env</code>.</>}</small>
          </label>
          <label class="field m-0">Project ID
            <input class="mono" inputmode="numeric" placeholder="12345" value={project} onInput={(e) => setProjectId(e.currentTarget.value)} />
            <small>{s.projectSource === 'env' ? <>From <code>POSTHOG_PROJECT_ID</code> in .env</> : <>Or set <code>POSTHOG_PROJECT_ID</code> in <code>.env</code>.</>}</small>
          </label>
          <div class="row gap-6">
            <button class="btn primary" type="submit" disabled={busy || !project.trim() || (!key.trim() && !s.keySource)}>{busy ? 'Checking…' : 'Save'}</button>
            {s.keySource === 'settings' && <button class="btn ghost danger" type="button" disabled={busy} onClick={remove}>Remove</button>}
          </div>
        </form>
        {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
        {s.lastError && <p class="small text-bad m-0">{s.lastError}</p>}
      </Section>

      {connected && (
        <Section title="PostHog">
          <Facts items={[
            { label: 'PostHog URL', value: <span class="mono">{s.baseUrl}</span> },
            { label: 'Project ID', value: s.projectId && <span class="mono">{s.projectId}</span> },
            { label: 'API key', value: s.keySource === 'env' ? 'From .env' : 'Saved in Kauzl' },
          ]} />
        </Section>
      )}

      {connected && list.data && (
        <Section title="Your sites in PostHog" sub="Matched by the $host on $pageview events, ignoring www. Pick the PostHog site by hand if it guessed wrong.">
          {list.data.matches?.length ? (
            <div class="cx-list">
              {list.data.matches.map((m) => (
                <div key={m.id} class="cx-list-row">
                  <span class="cx-list-name">
                    <b>{m.label}</b>
                    <span class="small muted">{m.host || 'no address'}{m.manual ? ' · picked by hand' : m.siteId ? ' · matched by domain' : ''}</span>
                  </span>
                  <select value={m.siteId} aria-label={`PostHog site for ${m.label}`} onChange={(e) => match(m.id, e.currentTarget.value)}>
                    <option value="">Not in PostHog</option>
                    {list.data.sites.map((x) => <option key={x.host} value={x.host}>{x.host}</option>)}
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
