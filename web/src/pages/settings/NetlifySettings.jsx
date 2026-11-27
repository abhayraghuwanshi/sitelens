import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Loading, ErrorState } from '../../components/ui.jsx';
import { BrandIcon } from '../../components/BrandIcon.jsx';
import { ConnectionHero, Section, Steps, Gets, Facts, SecretField } from './ConnectionKit.jsx';

// Netlify: a personal access token, then each site it hosts. Production deploys
// — including the failed ones — show on the matched site's Timeline.
const TOKENS_URL = 'https://app.netlify.com/user/applications#personal-access-tokens';

export function NetlifySettings() {
  const status = useAsync(() => api.get('/netlify/status'), []);
  const s = status.data || {};
  const connected = Boolean(s.tokenSource);

  async function saveToken(token) {
    const r = await api.post('/netlify/token', { token });
    status.reload();
    return token ? `Saved${r.login ? `. Signed in as ${r.login}` : ''}.` : 'Removed the saved token.';
  }

  return (
    <>
      <ConnectionHero
        brand="netlify"
        name="Netlify"
        tagline="Production deploys on each site’s Timeline, including the ones that failed."
        status={status.data ? {
          on: connected,
          warn: Boolean(s.lastError),
          text: s.lastError || (connected ? `Token from ${s.tokenSource === 'env' ? '.env' : 'Settings'}${s.login ? ` · ${s.login}` : ''}` : 'No token yet'),
        } : null}
        link={{ label: 'Netlify tokens', href: TOKENS_URL }}
      />

      <Section title="What you get">
        <Gets items={[
          'Every production deploy as a moment on the site’s Timeline',
          'Failed deploys too, so a broken build sits next to the traffic that followed it',
          'Sites matched by domain, or picked by hand when the guess is wrong',
        ]} />
      </Section>

      {!connected && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Make a personal access token', body: <>In Netlify, open User settings → Applications → Personal access tokens → New access token. Kauzl only reads your sites and deploys.</>, href: TOKENS_URL, cta: 'Netlify tokens' },
            { title: 'Paste it below', body: 'Kauzl lists your sites and matches each one to a site in Kauzl by its domain.' },
          ]} />
        </Section>
      )}

      <Section title="Personal access token">
        <SecretField label="Netlify token" placeholder="Paste your personal access token" source={s.tokenSource || ''} envName="NETLIFY_TOKEN" onSave={saveToken} onRemove={() => saveToken('')} />
        {s.lastError && <p class="small text-bad m-0">{s.lastError}</p>}
      </Section>

      {connected && <NetlifySites />}

      <Section title="Good to know">
        <Facts items={[
          { label: 'Signed in as', value: s.login },
          { label: 'Reads', value: 'Your user, sites and deploys. Kauzl never builds, publishes or changes anything on Netlify.' },
          { label: 'Deploys', value: 'Only production deploys show on the Timeline. Previews and branch deploys stay out.' },
          { label: 'Token', value: 'Saved in Kauzl, or read from NETLIFY_TOKEN in .env when no token is saved.' },
        ]} />
      </Section>
    </>
  );
}

function NetlifySites() {
  const list = useAsync((o) => api.get(`/netlify/sites${o?.fresh ? '?fresh=1' : ''}`), []);
  if (list.error) return <Section title="Your sites on Netlify"><ErrorState error={list.error} onRetry={list.reload} /></Section>;
  if (!list.data) return <Section title="Your sites on Netlify"><Loading height={160} /></Section>;
  const { netlifySites, sites } = list.data;
  const matched = sites.filter((x) => x.siteId);

  async function match(siteId, netlifySiteId) {
    await api.post('/netlify/match', { siteId, netlifySiteId });
    list.reload();
  }

  return (
    <>
      <Section title="Your sites on Netlify" sub="Matched by domain. Pick one by hand if it guessed wrong; its production deploys then show on that site’s Timeline."
        actions={<button class="btn ghost" type="button" onClick={() => list.reload({ fresh: true })}>Refresh</button>}>
        <div class="cx-list">
          {sites.map((x) => (
            <div key={x.id} class="cx-list-row">
              <span class="cx-list-name"><b>{x.label}</b><span class="small muted">{x.host || 'no address'}{x.manual ? ' · picked by hand' : x.siteId ? ' · matched by domain' : ''}</span></span>
              <select value={x.siteId} aria-label={`Netlify site for ${x.label}`} onChange={(e) => match(x.id, e.currentTarget.value)}>
                <option value="">Not on Netlify</option>
                {netlifySites.map((n) => <option key={n.id} value={n.id}>{n.name}{n.customDomain || n.netlifyDomain ? ` · ${n.customDomain || n.netlifyDomain}` : ''}</option>)}
              </select>
            </div>
          ))}
        </div>
        {!sites.length && <p class="muted m-0">No sites yet. Add one under Sites &amp; products first.</p>}
      </Section>

      <Section title={`Matched sites (${matched.length})`}>
        {matched.length ? (
          <div class="ag-rows">
            {matched.map((x) => {
              const n = netlifySites.find((site) => site.id === x.siteId);
              return (
                <div key={x.id} class="ag-row">
                  <div class="ag-row-head">
                    <span class="brand-tile"><BrandIcon name="netlify" /></span>
                    <span class="ag-row-name"><b>{n?.name || x.siteId}</b><span class="small muted">{n?.customDomain || n?.netlifyDomain || x.host} · {x.label}</span></span>
                    <a class="small" href={`https://app.netlify.com/sites/${encodeURIComponent(n?.name || x.siteId)}/deploys`} target="_blank" rel="noreferrer">Open in Netlify ↗</a>
                  </div>
                  <div class="ag-row-body"><SiteDeploys siteId={x.siteId} /></div>
                </div>
              );
            })}
          </div>
        ) : <p class="muted m-0">None of your sites matched a Netlify site. Pick one above.</p>}
      </Section>
    </>
  );
}

// The last few production deploys Netlify has for one site, failures included.
function SiteDeploys({ siteId }) {
  const d = useAsync(() => api.get(`/netlify/sites/${siteId}/deploys`), [siteId]);
  if (d.error) return <p class="small text-bad m-0">Couldn’t read deploys: {d.error.message}</p>;
  if (!d.data) return <Loading height={80} />;
  const rows = (d.data.deploys || [])
    .filter((x) => x.context === 'production' && (x.state === 'ready' || x.state === 'failed' || x.state === 'error'))
    .slice(0, 5);
  if (!rows.length) return <p class="small muted m-0">No production deploys yet.</p>;
  return (
    <div class="cx-list">
      {rows.map((x) => (
        <div key={x.id} class="cx-list-row">
          <span class="cx-list-name"><b>{x.commit || `Deploy ${x.id.slice(0, 7)}`}</b><span class="small muted">{new Date(x.created).toLocaleDateString()} · {x.ref || 'main'}</span></span>
          <span class={`small ${x.state === 'ready' ? 'muted' : 'text-bad'}`}>{x.state === 'ready' ? 'Ready' : 'Failed'}</span>
        </div>
      ))}
    </div>
  );
}
