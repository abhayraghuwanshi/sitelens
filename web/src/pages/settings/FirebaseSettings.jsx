import { useState } from 'preact/hooks';
import { formatNumber, formatRelative } from '@shared/format.js';
import { api, qs } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card } from '../../components/ui.jsx';
import { Icon } from '../../components/icons.jsx';

const LOGGING_SCOPE = 'https://www.googleapis.com/auth/logging.read';

// Studio site ↔ App Hosting backend (a Cloud Run service). Found automatically
// from the hosts in each project's request log, or set by hand.
export function FirebaseSettings({ auth }) {
  const status = useAsync(() => api.get('/firebase/status'), []);
  const [draft, setDraft] = useState({ siteId: '', project: '', service: '' });
  const [services, setServices] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const s = status.data || { links: [], sites: [] };
  const hasScope = auth.connected && (auth.scopes || []).includes(LOGGING_SCOPE);
  const unlinked = s.sites.filter((site) => !s.links.some((l) => l.siteId === site.id));

  async function act(name, fn, done) {
    setBusy(name);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: true, text: done(r) });
      status.reload();
    } catch (err) {
      setMsg({ ok: false, text: `${err.message}${err.hint ? ` ${err.hint}` : ''}` });
    } finally {
      setBusy('');
    }
  }

  const find = () => act('find', () => api.post('/firebase/auto-link'), (r) => (r.linked.length
    ? `Linked ${r.linked.map((l) => `${l.siteId} → ${l.service}`).join(', ')}. The first sync is running.`
    : `No new matches in ${r.scanned.length} projects.${r.services.length ? ` Backends seen: ${r.services.map((x) => `${x.project}/${x.service}`).join(', ')}.` : ''}`));
  const lookup = () => act('lookup', async () => {
    const r = await api.get(`/firebase/discover${qs({ project: draft.project.trim() })}`);
    setServices(r.services);
    if (r.services.length === 1) setDraft((d) => ({ ...d, service: r.services[0].service }));
    return r;
  }, (r) => (r.services.length ? `${r.services.length} backend${r.services.length > 1 ? 's' : ''} with traffic in the last 3 days.` : 'No Cloud Run traffic in that project in the last 3 days.'));
  const link = (event) => {
    event.preventDefault();
    act('link', () => api.post('/firebase/link', { siteId: draft.siteId || unlinked[0]?.id, link: { project: draft.project.trim(), service: draft.service.trim() } }),
      () => 'Linked. The first sync pulls 30 days of logs.');
  };
  const unlink = (siteId) => act(`unlink:${siteId}`, () => api.post('/firebase/link', { siteId, link: null }), () => 'Unlinked and removed its synced requests.');

  return (
    <Card title="Firebase App Hosting" sub="Server-side traffic, bots, errors and deploys from your backend's Cloud Run request log">
      <div class="stack">
        <div class="row small">
          <span class={`dot${hasScope ? ' on' : ''}`} />
          {hasScope ? 'Google sign-in can read Cloud logs'
            : auth.connected ? <>The Google sign-in is missing log access. Sign out above, then sign in again and allow “View log data”.</>
              : 'Connect a Google account above first.'}
        </div>

        {s.links.length > 0 && (
          <table class="data">
            <thead><tr><th>Site</th><th>Backend</th><th class="num">Requests</th><th>Sync</th><th /></tr></thead>
            <tbody>
              {s.links.map((l) => (
                <tr key={l.siteId}>
                  <td><b>{l.label}</b><div class="muted small">{l.host}</div></td>
                  <td class="small"><span class="mono">{l.project}</span> / <b>{l.service}</b></td>
                  <td class="num">{formatNumber(l.requests)}</td>
                  <td class="small">
                    {l.error ? <span class="text-bad">{l.error}</span> : l.lastSync ? formatRelative(l.lastSync) : <span class="muted">pending</span>}
                  </td>
                  <td class="num"><button class="btn ghost danger" type="button" disabled={Boolean(busy)} onClick={() => unlink(l.siteId)}>Unlink</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {unlinked.length > 0 && (
          <>
            <div class="row">
              <button class="btn primary" type="button" disabled={!hasScope || Boolean(busy)} onClick={find}>
                <Icon name="search" size={13} /> {busy === 'find' ? 'Searching…' : 'Find my backends'}
              </button>
              <span class="small muted">Scans your Google Cloud projects for the backend serving {unlinked.map((x) => x.host).join(', ')}.</span>
            </div>
            <details class="advanced">
            <summary>Advanced: link a backend by hand</summary>
            <form class="row" onSubmit={link}>
              {unlinked.length > 1 && (
                <select aria-label="Site" value={draft.siteId || unlinked[0].id} onChange={(e) => setDraft({ ...draft, siteId: e.currentTarget.value })}>
                  {unlinked.map((site) => <option key={site.id} value={site.id}>{site.label}</option>)}
                </select>
              )}
              <input style={{ width: '200px' }} placeholder="Project ID (my-app-12345)" value={draft.project} aria-label="Google Cloud project ID"
                onInput={(e) => setDraft({ ...draft, project: e.currentTarget.value })} />
              <button class="btn" type="button" disabled={!hasScope || !draft.project.trim() || Boolean(busy)} onClick={lookup}>{busy === 'lookup' ? 'Looking…' : 'List backends'}</button>
              {services?.length ? (
                <select aria-label="Backend" value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.currentTarget.value })}>
                  <option value="">Pick a backend</option>
                  {services.map((x) => <option key={x.service} value={x.service}>{x.service}{x.hosts.length ? ` (${x.hosts[0]})` : ''}</option>)}
                </select>
              ) : (
                <input style={{ width: '160px' }} placeholder="Backend ID" value={draft.service} aria-label="App Hosting backend ID"
                  onInput={(e) => setDraft({ ...draft, service: e.currentTarget.value })} />
              )}
              <button class="btn" type="submit" disabled={!hasScope || !draft.project.trim() || !draft.service.trim() || Boolean(busy)}>Link</button>
            </form>
            </details>
          </>
        )}

        <p class="note">
          App Hosting runs each backend as a Cloud Run service with the same name, so Kauzl reads its request log with read-only log access, never
          the App Hosting API (that needs full project access). Logs are synced into <code>.data/firebase.db</code> every 30 minutes; IP addresses are
          hashed with a daily salt and never stored.
        </p>
        {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
