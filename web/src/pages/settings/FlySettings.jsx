import { useState } from 'preact/hooks';
import { formatNumber, formatRelative } from '@shared/format.js';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Loading, ErrorState } from '../../components/ui.jsx';
import { Section, Steps, Gets, Facts, SecretField } from './ConnectionKit.jsx';

// Fly.io: a token, then each app with the site it serves, its machines, edge
// traffic and recent releases. Releases show on the matched site's Timeline.
export function FlySettings() {
  const status = useAsync(() => api.get('/fly/status'), []);
  const s = status.data || {};
  const connected = Boolean(s.tokenSource);

  async function saveToken(token) {
    const r = await api.post('/fly/token', { token });
    status.reload();
    return token ? `Saved${r.login ? `. Signed in as ${r.login}` : ''}.` : 'Removed the saved token.';
  }

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'Every release as a moment on the site’s Timeline, so a deploy sits next to the traffic change after it',
          'Edge requests, 5xx errors and response time per app, from Fly’s own metrics',
          'Machines per region and their state, at a glance',
        ]} />
      </Section>

      {!connected && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Make a read-only token', body: <>In a terminal: <code>fly tokens create readonly personal</code> (or your org’s name). <code>fly auth token</code> works too.</>, href: 'https://fly.io/dashboard/personal/tokens', cta: 'Fly tokens' },
            { title: 'Paste it below', body: 'Kauzl lists your apps and matches each to a site by its domain.' },
          ]} />
        </Section>
      )}

      <Section title="Access token">
        <SecretField label="Fly.io token" placeholder="FlyV1 fm2_…" source={s.tokenSource || ''} envName="FLY_API_TOKEN" onSave={saveToken} onRemove={() => saveToken('')} />
        {s.lastError && <p class="small text-bad m-0">{s.lastError}</p>}
      </Section>

      {connected && <FlyApps />}

      <Section title="Good to know">
        <Facts items={[
          { label: 'Signed in as', value: s.login },
          { label: 'Organizations', value: s.orgs?.length ? s.orgs.map((o) => o.name || o.slug).join(', ') : '' },
          { label: 'Reads', value: 'Apps, releases, machines and edge metrics. Kauzl never deploys, scales or changes anything on Fly.' },
          { label: 'Metrics', value: 'Fly keeps edge metrics for a limited time, so traffic here covers recent days only.' },
        ]} />
      </Section>
    </>
  );
}

function FlyApps() {
  const list = useAsync((o) => api.get(`/fly/apps${o?.fresh ? '?fresh=1' : ''}`), []);
  if (list.error) return <Section title="Your apps"><ErrorState error={list.error} onRetry={list.reload} /></Section>;
  if (!list.data) return <Section title="Your apps"><Loading height={160} /></Section>;
  const { apps, sites } = list.data;
  const siteFor = (app) => sites.find((x) => x.app === app);

  async function match(siteId, app) {
    await api.post('/fly/match', { siteId, app });
    list.reload();
  }

  return (
    <>
      <Section title="Your sites on Fly" sub="Matched by domain. Pick the app if it guessed wrong; its releases then show on that site’s Timeline.">
        <div class="cx-list">
          {sites.map((x) => (
            <div key={x.id} class="cx-list-row">
              <span class="cx-list-name"><b>{x.label}</b><span class="small muted">{x.host || 'no address'}{x.manual ? ' · picked by hand' : x.app ? ' · matched by domain' : ''}</span></span>
              <select value={x.app} aria-label={`Fly app for ${x.label}`} onChange={(e) => match(x.id, e.currentTarget.value)}>
                <option value="">Not on Fly</option>
                {apps.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Apps (${apps.length})`} actions={<button class="btn ghost" type="button" onClick={() => list.reload({ fresh: true })}>Refresh</button>}>
        {apps.length ? (
          <div class="ag-rows">
            {apps.map((a) => <FlyApp key={a.name} app={a} site={siteFor(a.name)} />)}
          </div>
        ) : <p class="muted m-0">This token sees no apps. A token made for one org only sees that org’s apps.</p>}
      </Section>
    </>
  );
}

const STATE_TONE = { deployed: 'on', running: 'on', started: 'on', suspended: 'off', stopped: 'off', pending: 'warn', failed: 'warn' };

function FlyApp({ app, site }) {
  const [open, setOpen] = useState(false);
  const tone = STATE_TONE[app.status] || (app.deployed ? 'on' : 'off');
  return (
    <div class="ag-row">
      <div class="ag-row-head">
        <span class="brand-tile"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill={tone === 'on' ? 'var(--good-ink)' : 'var(--text-3)'} /></svg></span>
        <span class="ag-row-name">
          <b>{app.name}</b>
          <span class="small muted">
            {app.domains[0] || app.hostname}{app.release ? ` · v${app.release.version} ${formatRelative(app.release.created)}` : ''}{site ? ` · ${site.label}` : ''}
          </span>
        </span>
        <span class={`cx-pill ${tone}`}><span class={`dot${tone === 'on' ? ' on' : ''}`} />{app.status || (app.deployed ? 'deployed' : 'not deployed')}</span>
        <button class="btn ghost" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Details'}</button>
      </div>
      {open && <div class="ag-row-body"><FlyAppDetail name={app.name} /></div>}
    </div>
  );
}

function FlyAppDetail({ name }) {
  const d = useAsync(() => api.get(`/fly/apps/${name}`), [name]);
  if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Loading height={120} />;
  const { traffic: t, machines, releases } = d.data;
  const num = (v) => (v === null || v === undefined ? '—' : formatNumber(v));
  const max = Math.max(1, ...(t.days || []).map((x) => x.requests));
  return (
    <div class="fly-detail">
      {t.error ? <p class="small text-bad m-0">Metrics: {t.error}</p> : (
        <div class="fly-kpis">
          <div><span class="small muted">Requests, 24h</span><b>{num(t.requests)}</b></div>
          <div><span class="small muted">5xx errors, 24h</span><b class={t.errors ? 'text-bad' : ''}>{num(t.errors)}</b></div>
          <div><span class="small muted">Response time p95</span><b>{t.p95ms === null ? '—' : `${formatNumber(t.p95ms)} ms`}</b></div>
        </div>
      )}
      {!t.error && t.days?.length > 0 && (
        <div class="fly-days" aria-label="Requests per day">
          {t.days.map((x) => (
            <div key={x.date} title={`${x.date}: ${formatNumber(x.requests)} requests`}>
              <span style={{ height: `${Math.max(2, (x.requests / max) * 100)}%` }} />
              <small class="muted">{x.date.slice(5)}</small>
            </div>
          ))}
        </div>
      )}
      <div>
        <h4 class="ag-group-h">Machines</h4>
        {machines.error ? <p class="small text-bad m-0">{machines.error}</p> : machines.length ? (
          <div class="row gap-6 wrap">
            {machines.map((m) => <span key={m.id} class={`chip${m.state === 'started' ? ' good' : ''}`}>{m.region} · {m.state}</span>)}
          </div>
        ) : <p class="small muted m-0">No machines.</p>}
      </div>
      <div>
        <h4 class="ag-group-h">Recent releases</h4>
        {releases.error ? <p class="small text-bad m-0">{releases.error}</p> : releases.length ? (
          <ul class="fly-releases">
            {releases.slice(0, 6).map((r) => (
              <li key={r.version}>
                <b>v{r.version}</b>
                <span class="small muted">{formatRelative(r.created)}{r.by ? ` · ${r.by}` : ''}{r.description ? ` · ${r.description}` : ''}</span>
                <span class={`small ${/fail/.test(r.status) ? 'text-bad' : 'muted'}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        ) : <p class="small muted m-0">No releases yet.</p>}
      </div>
      <a class="small" href={`https://fly.io/apps/${name}`} target="_blank" rel="noreferrer">Open in Fly ↗</a>
    </div>
  );
}
