import { useEffect, useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, ErrorState, Loading, humanBytes } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { ProductsCard, ProductForm, ProductStages, productFormState, useFocusStage } from './settings/Products.jsx';
import { BingSettings, KeyForm } from './settings/BingSettings.jsx';
import { AnthropicSettings } from './settings/AnthropicSettings.jsx';
import { OpenRouterSettings } from './settings/OpenRouterSettings.jsx';
import { SiteHealthCard } from './settings/SiteHealth.jsx';
import { VercelSettings } from './settings/VercelSettings.jsx';
import { FirebaseSettings } from './settings/FirebaseSettings.jsx';
import { MentionsSettings } from './settings/MentionsSettings.jsx';
import { IntegrationGrid } from './settings/Integrations.jsx';
import { McpSettings } from './settings/McpSettings.jsx';
import { CustomMetricsSettings } from './settings/CustomMetrics.jsx';

const PUBLIC_SAMPLE = {
  label: 'Google Merchandise Store (public sample)',
  host: 'shop.googlemerchandisestore.com',
  bq: { dataProject: 'bigquery-public-data', dataset: 'ga4_obfuscated_sample_ecommerce', location: 'US', endDate: '2021-01-31' },
};

const TABS = [
  { key: 'integrations', label: 'Integrations' },
  { key: 'mcp', label: 'MCP' },
  { key: 'sites', label: 'Sites & products' },
];

const PANELS = {
  google: { title: 'Google account', render: ({ state, onChange }) => <ConnectCard auth={state.auth} onChange={onChange} /> },
  github: { title: 'GitHub', render: ({ state, onChange }) => <GitHubSettings state={state} sources={state.sources} onChange={onChange} /> },
  firebase: { title: 'Firebase App Hosting', render: ({ state }) => <FirebaseSettings auth={state.auth} /> },
  vercel: { title: 'Vercel', render: () => <VercelSettings /> },
  metrics: { title: 'Custom metrics', render: ({ state, params }) => <CustomMetricsSettings sites={state.sites} params={params} /> },
  mentions: { title: 'Mentions', render: () => <MentionsSettings /> },
  pagespeed: { title: 'PageSpeed & CrUX', render: () => <SiteHealthCard /> },
  bing: { title: 'Bing Webmaster Tools', render: () => <BingSettings /> },
  anthropic: { title: 'Claude', render: () => <AnthropicSettings /> },
  openrouter: { title: 'OpenRouter', render: () => <OpenRouterSettings /> },
  mcp: { title: 'Claude Code & Claude Desktop', render: ({ state }) => <McpSettings hosted={state.hosted} /> },
};

// Settings: #/settings?tab=<tab> · #/settings?i=<integration> opens one integration's panel.
export function Settings({ state, params, onChange, siteExtras }) {
  const flashError = params.get('error');
  const connected = params.get('connected');
  // MCP has its own tab so it's easy to find; old ?i=mcp links land there.
  const panel = params.get('i') !== 'mcp' && PANELS[params.get('i')] ? params.get('i') : connected ? 'google' : '';
  // Sites and products share one tab: old ?tab=products links (with ?edit=<product id>) land there.
  const asked = params.get('tab') === 'products' ? 'sites' : params.get('tab');
  const tab = params.get('i') === 'mcp' ? 'mcp' : panel ? 'integrations' : TABS.some((t) => t.key === asked) ? asked : 'integrations';

  // Alert settings moved to the Alerts page; old ?tab=alerts links land there.
  useEffect(() => {
    if (params.get('tab') === 'alerts') location.replace('#/alerts?view=settings');
  }, [params.get('tab')]);

  // Pick up the new sign-in once, then drop the flag so a reload can't repeat it.
  useEffect(() => {
    if (!connected) return;
    onChange();
    const hash = location.hash.replace(/([?&])connected=1&?/, '$1').replace(/[?&]$/, '');
    history.replaceState(null, '', hash || '#/');
  }, [connected]);

  return (
    <>
      <nav class="tabs" aria-label="Settings sections">
        {TABS.map((t) => (
          <a key={t.key} href={`#/settings?tab=${t.key}`} class={t.key === tab ? 'active' : ''} aria-current={t.key === tab ? 'page' : undefined}>{t.label}</a>
        ))}
      </nav>
      {flashError && <ErrorState error={{ message: flashError }} />}
      {tab === 'integrations' && (panel ? (
        <>
          <a class="back-link" href="#/settings?tab=integrations">← All integrations</a>
          {PANELS[panel].render({ state, params, onChange })}
        </>
      ) : <IntegrationGrid onOpen={(key) => navigate(`/settings?i=${key}`)} />)}
      {tab === 'mcp' && <McpSettings hosted={state.hosted} />}
      {tab === 'sites' && <SitesSettings state={state} params={params} onChange={onChange} siteExtras={siteExtras} />}
    </>
  );
}

// Sites & products. The list and a form are never on screen together: the list
// (sites, then products without a website) with both "Add" buttons on top, or
// one form on its own with a way back. The URL says which, so Back works:
//   ?tab=sites                    the list
//   ?tab=sites&edit=new|<site>    add / edit a site (and what it runs on)
//   ?tab=sites&product=new|<id>   add / edit a product without a website
//   ?tab=products&edit=<id>       older product links, sent to the right form
// siteExtras(site): what the new layout shows under an existing site's form
// (sharing, left-out visits, what Studio measures), so a site is set up in one place.
function SitesSettings({ state, params, onChange, siteExtras }) {
  const { auth, sites } = state;
  const setup = useAsync(() => api.get('/products/setup'), []);
  const base = location.hash.startsWith('#/account') ? '/account' : '/settings';
  const go = (extra = {}) => navigate(`${base}${qs({ tab: 'sites', ...extra })}`);

  const legacy = params.get('tab') === 'products' ? params.get('edit') || '' : '';
  const legacyProduct = legacy && legacy !== 'new' ? setup.data?.products.find((p) => p.id === legacy) : null;
  // A site's product is edited with its site.
  const legacySite = legacyProduct?.siteId || (legacy === 'new' && params.get('site')) || '';
  useEffect(() => {
    if (legacySite) go({ edit: legacySite, focus: params.get('focus') });
  }, [legacySite]);

  const siteEdit = legacy ? '' : params.get('edit') || '';
  const productEdit = params.get('product') || (legacy && !legacySite ? legacy : '');
  const back = <a class="back-link" href={`#${base}?tab=sites`}>← Sites &amp; products</a>;

  if (siteEdit) {
    const site = siteEdit === 'new' ? {} : sites.find((s) => s.id === siteEdit && !s.demo);
    if (!site) return <>{back}<ErrorState error={{ message: 'That site was removed or can’t be edited.' }} /></>;
    return (
      <>
        {back}
        <SiteForm key={site.id || 'new'} initial={site} auth={auth} focus={params.get('focus') || ''}
          onCancel={() => go()}
          onSaved={(saved) => { onChange(); navigate(`/site/${saved.id}`); }} />
        {site.id && siteExtras?.(site)}
      </>
    );
  }

  if (setup.error) return <ErrorState error={setup.error} onRetry={setup.reload} />;

  if (productEdit) {
    if (!setup.data) return <>{back}<Loading height={200} /></>;
    if (legacySite) return <Loading height={200} />;
    const product = productEdit === 'new' ? {} : setup.data.products.find((p) => p.id === productEdit && !p.siteId);
    if (!product) return <>{back}<ErrorState error={{ message: 'That product was removed, or it belongs to a site: edit it from the site.' }} /></>;
    return (
      <>
        {back}
        <ProductForm key={product.id || 'new'} initial={product} setup={setup.data} focus={params.get('focus') || ''}
          onCancel={() => go()}
          onSaved={(saved) => navigate(`/product/${saved.id}`)} />
      </>
    );
  }

  const productOf = (id) => setup.data?.products.find((p) => p.siteId === id);
  return (
    <>
      <div class="sp-head">
        <p class="muted small">A site is set up with everything it runs on: analytics, domains, hosting, repos, store listings and goals. A product without a website, like an extension or a CLI, is set up on its own.</p>
        <div class="row">
          <button class="btn primary" type="button" onClick={() => go({ edit: 'new' })}><Icon name="plus" size={13} /> Add a site</button>
          <button class="btn" type="button" onClick={() => go({ product: 'new' })}><Icon name="plus" size={13} /> Add a product without a website</button>
        </div>
      </div>

      <Card title={`Sites (${sites.length})`} flush>
        <table class="data">
          <thead><tr><th>Site</th><th>GA4</th><th>Search Console</th><th>BigQuery</th><th>Runs on</th><th /></tr></thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id}>
                <td><b>{s.label}</b><div class="muted small">{s.demo ? 'Built-in sample data' : s.host}</div></td>
                <td class="small">{s.demo ? 'demo' : s.propertyId || <span class="muted">—</span>}</td>
                <td class="small">{s.demo ? 'demo' : s.searchSite || <span class="muted">—</span>}</td>
                <td class="small mono">{s.demo ? 'demo events' : s.bq ? `${s.bq.dataProject}.${s.bq.dataset}` : <span class="muted">—</span>}
                  {s.bq?.sessionsTable && <div class="chip accent" style={{ marginTop: '3px' }}>rollup</div>}</td>
                <td class="small">{s.demo ? 'demo' : productSummary(productOf(s.id), setup.data) || <span class="muted">—</span>}</td>
                <td class="num" style={{ whiteSpace: 'nowrap' }}>
                  {(s.demo || !siteExtras) && <a class="btn ghost" href={`#/site/${s.id}/setup`}>Setup</a>}
                  {!s.demo && <button class="btn ghost" type="button" onClick={() => go({ edit: s.id })}>Edit</button>}
                  <button class="btn ghost danger" type="button" onClick={async () => { await api.del(`/sites/${s.id}`); onChange(); setup.reload(); }}>
                    {s.demo ? 'Hide' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sites.length && <p class="muted" style={{ padding: '8px 16px' }}>No sites yet. Add one above.</p>}
      </Card>

      {setup.data ? <ProductsCard setup={setup.data} onReload={setup.reload} onEdit={(id) => go({ product: id })} /> : <Loading height={120} />}
    </>
  );
}

// What a site's product runs on, in one line: hosting, repos, extensions, goals.
function productSummary(p, setup) {
  if (!p) return '';
  const hosting = setup?.hosting.find((h) => h.key === p.hosting?.provider)?.label;
  const n = (count, word) => count && `${count} ${word}${count > 1 ? 's' : ''}`;
  return [hosting, n(p.repos.length, 'repo'), n(p.extensionIds.length, 'extension'), n(p.goals?.length, 'goal')].filter(Boolean).join(' · ');
}

function GitHubSettings({ state, sources, onChange }) {
  const gh = sources.github;
  const connect = useAsync(() => api.get('/connect').catch(() => ({})), []);
  const canConnect = Boolean(connect.data?.github);
  const [token, setToken] = useState('');
  const [importPath, setImportPath] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');

  async function act(kind, fn, done) {
    setBusy(kind);
    setMsg(null);
    try {
      const result = await fn();
      setMsg({ ok: true, text: done(result) });
      onChange();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <Card title="GitHub" sub={canConnect ? 'Traffic, stars and release downloads for the repos you choose' : 'Traffic, stars and release downloads for every repo the token can push to'}>
      <div class="stack">
        <div class="row small">
          <span class={`dot${gh.tokenSource ? ' on' : ''}`} />
          {gh.tokenSource
            ? <>{gh.tokenSource === 'oauth' ? 'Connected to GitHub' : <>Token from {gh.tokenSource === 'env' ? <code>GITHUB_TOKEN</code> : 'Settings'}</>}{gh.login && <> · <b>@{gh.login}</b></>}
                {gh.data.ok && <> · {gh.data.repos} repos stored</>}
                {gh.lastError && <span class="text-bad"> · {gh.lastError}</span>}</>
            : 'No token yet'}
        </div>
        {canConnect && (
          <div class="row">
            <a class="btn primary" href="/auth/github">{gh.tokenSource === 'oauth' ? 'Connect again' : 'Connect GitHub'}</a>
            {gh.tokenSource === 'oauth' && <a class="btn" href={connect.data.githubRepos} target="_blank" rel="noreferrer">Choose repos</a>}
            {gh.tokenSource === 'oauth' && <button class="btn" type="button" disabled={Boolean(busy)}
              onClick={() => act('sync', () => api.post('/github/sync'), (r) => `Synced ${r.repos} repos${r.failures ? `, ${r.failures} failed` : ''}.`)}>
              {busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>}
            {gh.tokenSource === 'oauth' && <button class="btn ghost danger" type="button" disabled={Boolean(busy)}
              onClick={() => act('disconnect', () => api.post('/github/token', { token: '' }), () => 'Disconnected.')}>Disconnect</button>}
          </div>
        )}
        <KeyForm open={!canConnect}>
        <form class="row" onSubmit={(e) => {
          e.preventDefault();
          act('token', () => api.post('/github/token', { token }), (r) => `Saved — signed in as @${r.login}. First sync started.`);
          setToken('');
        }}>
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '260px' }} placeholder="github_pat_… or ghp_…" value={token}
            onInput={(e) => setToken(e.currentTarget.value)} aria-label="GitHub token" />
          <button class="btn primary" type="submit" disabled={!token.trim() || Boolean(busy)}>{busy === 'token' ? 'Checking…' : 'Save token'}</button>
          {gh.tokenSource && <button class="btn" type="button" disabled={Boolean(busy)}
            onClick={() => act('sync', () => api.post('/github/sync'), (r) => `Synced ${r.repos} repos${r.failures ? `, ${r.failures} failed` : ''}.`)}>
            {busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>}
        </form>
        </KeyForm>
        <p class="note">
          {canConnect
            ? <>Connect asks GitHub which repos Studio may see; change them any time with Choose repos. Studio reads traffic and stars, and only writes when you open a pull request from the article editor.</>
            : <>Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> with
          repository access to your repos and <b>Administration: read</b> (traffic needs it) plus <b>Metadata: read</b> — or a classic token with <code>repo</code>.
          It's stored in <code>.data/studio.json</code> (owner-only), or set <code>GITHUB_TOKEN</code> in <code>.env</code>. Studio syncs hourly into <code>.data/github.db</code>.</>}
        </p>
        {!state.hosted && <details class="advanced">
        <summary>Advanced: import older history</summary>
        <form class="stack" onSubmit={(e) => {
          e.preventDefault();
          act('import', () => api.post('/github/import', { path: importPath }),
            (r) => `Imported ${Object.entries(r.imported).map(([t, n]) => `${n} ${t}`).join(', ')}.`);
        }}>
          <p class="note" style={{ margin: 0 }}>
            GitHub only serves the last 14 days of traffic. If you ran ghstats before, copy its history in once — Studio keeps no link to that file afterwards.
          </p>
          <div class="row">
            <input style={{ flex: '1', minWidth: '260px' }} placeholder="/path/to/ghstats/data/ghstats.db" value={importPath} onInput={(e) => setImportPath(e.currentTarget.value)} aria-label="ghstats database to import" />
            <button class="btn" type="submit" disabled={!importPath.trim() || Boolean(busy)}>{busy === 'import' ? 'Importing…' : 'Import once'}</button>
          </div>
        </form>
        </details>}
        {msg && <p class="small" style={{ margin: 0, color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}
      </div>
    </Card>
  );
}

function ConnectCard({ auth, onChange }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function paste(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/token', { token });
      setToken('');
      onChange();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const scopes = auth.scopes || [];
  const has = (s) => scopes.some((x) => x.endsWith(s));
  return (
    <Card title="Google account" sub={auth.connected ? (auth.mode === 'oauth' ? 'Signed in · refreshes automatically' : 'Pasted access token') : 'Not connected'}>
      <div class="stack">
        {auth.connected && (
          <div class="row">
            <span class={`dot${auth.expired ? '' : ' on'}`} />
            <b>{auth.email || 'Connected'}</b>
            <span class="chip">{has('analytics.readonly') ? '✓' : '✗'} Analytics</span>
            <span class="chip">{has('webmasters.readonly') ? '✓' : '✗'} Search Console</span>
            <span class="chip">{has('/bigquery') || has('cloud-platform') ? '✓' : '✗'} BigQuery</span>
            <span class="chip">{has('logging.read') || has('cloud-platform') ? '✓' : '✗'} Cloud logs</span>
            {auth.expiresAt && <span class="muted small">{auth.expired ? 'expired' : `expires ${new Date(auth.expiresAt).toLocaleTimeString()}`}</span>}
            <span class="grow" style={{ flex: 1 }} />
            <button class="btn ghost danger" type="button" onClick={async () => { await api.post('/auth/signout'); onChange(); }}>Sign out</button>
          </div>
        )}
        <div class="stack">
          <div class="stack">
            {auth.oauthAvailable ? (
              <>
                <a class="btn primary" href="/auth/google" style={{ alignSelf: 'flex-start' }}>{auth.connected ? 'Sign in again' : 'Continue with Google'}</a>
                {auth.connected && <p class="note" style={{ margin: 0 }}>Signing in again picks up permissions added since you last connected, like Cloud logs for Firebase.</p>}
              </>
            ) : (
              <p class="note">
                Disabled. Create an OAuth client (type <b>Web application</b>, redirect URI <code>http://127.0.0.1:4318/auth/callback</code>) in Google Cloud,
                then start Studio with <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>. Sign-in stores a refresh token locally so you stay connected.
              </p>
            )}
          </div>
          <details class="advanced">
          <summary>Advanced: paste an access token instead</summary>
          <form class="stack" onSubmit={paste}>
            <input type="password" placeholder="ya29.…" value={token} onInput={(e) => setToken(e.currentTarget.value)} aria-label="Access token" autocomplete="off" />
            <p class="note">
              From the <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noreferrer">OAuth Playground</a> with scopes
              <code> analytics.readonly webmasters.readonly bigquery logging.read</code>. Lasts about an hour — same as the extension.
            </p>
            <button class="btn" type="submit" disabled={busy || !token.trim()} style={{ alignSelf: 'flex-start' }}>{busy ? 'Verifying…' : 'Verify token'}</button>
            {error && <p class="small" style={{ color: 'var(--critical-ink)', margin: 0 }}>{error.message}</p>}
          </form>
          </details>
        </div>
      </div>
    </Card>
  );
}

// A site and its product are edited together: the site's GA4, Search Console
// and BigQuery first, then what the product runs on (domains, hosting, repos…).
// What the export search found, in words, and what to do if it found nothing.
function BqExportStatus({ propertyId, live, result }) {
  if (!live) return <p class="note">Connect Google above and Studio finds the export for you.</p>;
  if (!propertyId) return <p class="note">Pick the GA4 property above and Studio finds its BigQuery export for you.</p>;
  if (result.loading) return <p class="note">Looking for this property’s BigQuery export…</p>;
  const found = result.data;
  if (found?.found) {
    return (
      <p class="note bq-found"><Icon name="check" size={13} /> Found <code>{found.dataset}</code> in <b>{found.dataProject}</b>{found.location ? ` (${found.location})` : ''}. Nothing else to fill in.</p>
    );
  }
  if (found?.linked) {
    return (
      <p class="note">This property is linked to BigQuery{found.project ? <> in <b>{found.project}</b></> : ''}, but its first daily export hasn’t arrived yet. That takes up to a day. Save now and it starts working when the data lands.</p>
    );
  }
  return (
    <div class="note stack" style={{ gap: '6px' }}>
      <span>{result.error ? `Couldn’t look for the export: ${result.error.message}.` : 'No BigQuery export found for this property.'} To turn it on:</span>
      <ol style={{ margin: 0, paddingLeft: '18px' }}>
        <li>In Google Analytics, open <b>Admin → Product links → BigQuery links</b> and click <b>Link</b>.</li>
        <li>Choose a Google Cloud project, tick <b>Daily</b> export, and submit.</li>
        <li>Come back and check again. The first day’s data arrives within 24 hours.</li>
      </ol>
      <span class="row" style={{ gap: '8px' }}>
        <a class="btn ghost" href="https://analytics.google.com/analytics/web/" target="_blank" rel="noopener noreferrer">Open GA4 Admin</a>
        <button class="btn ghost" type="button" onClick={() => result.reload()}>Check again</button>
      </span>
    </div>
  );
}

function SiteForm({ initial, auth, focus, onCancel, onSaved }) {
  const [form, setForm] = useState(() => ({
    id: initial.id || '',
    label: initial.label || '',
    host: initial.host || '',
    propertyId: initial.propertyId || '',
    streamName: initial.streamName || '',
    includeSubdomains: Boolean(initial.includeSubdomains),
    searchSite: initial.searchSite || '',
    bq: { billingProject: '', dataProject: '', dataset: '', location: '', streamId: '', endDate: '', sessionsTable: '', maxBytes: 5e9, ...(initial.bq || {}) },
    useBq: Boolean(initial.bq),
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const live = auth.connected && !auth.expired;

  const properties = useAsync(() => (live ? api.get('/google/properties') : Promise.resolve([])), [live]);
  const streams = useAsync(() => (live && form.propertyId ? api.get(`/google/streams?property=${form.propertyId}`) : Promise.resolve([])), [live, form.propertyId]);
  const searchSites = useAsync(() => (live ? api.get('/google/search-sites').catch(() => []) : Promise.resolve([])), [live]);
  const setup = useAsync(() => api.get('/products/setup'), []);
  const existing = initial.id ? setup.data?.products.find((p) => p.siteId === initial.id) : null;
  const [product, setProduct] = useState(null);
  useEffect(() => {
    if (setup.data && !product) setProduct(productFormState(existing || { siteId: initial.id || '' }, setup.data));
  }, [setup.data]);
  useFocusStage(focus, Boolean(product));
  const setProductPatch = (patch) => setProduct((p) => ({ ...p, ...patch }));
  const projects = useAsync(() => (live && form.useBq ? api.get('/google/bq-projects').catch(() => []) : Promise.resolve([])), [live, form.useBq]);
  // The property's BigQuery export, found for you: project, dataset and location.
  const bqExport = useAsync(() => (live && /^\d+$/.test(form.propertyId) ? api.get(`/google/bq-export?property=${form.propertyId}`) : Promise.resolve(null)), [live, form.propertyId]);
  useEffect(() => {
    const found = bqExport.data;
    if (!found?.found && !(found?.linked && found.project)) return;
    // Fill in only what's empty or was found for another property.
    if (form.bq.dataset && !(form.bq.dataset.startsWith('analytics_') && form.bq.dataset !== found.dataset)) return;
    const project = found.found ? found.dataProject : found.project;
    setForm((f) => ({
      ...f,
      useBq: f.useBq || (!initial.id && found.found),
      bq: { ...f.bq, billingProject: project, dataProject: project, dataset: found.dataset, location: found.location || '' },
    }));
  }, [bqExport.data]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setBq = (patch) => setForm((f) => ({ ...f, bq: { ...f.bq, ...patch } }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { useBq, ...rest } = form;
      const site = await api.post('/sites', { ...rest, bq: useBq ? form.bq : null });
      // A retry after a product error updates this site rather than adding another.
      set({ id: site.id });
      if (product) {
        await api.post('/products/setup', {
          ...product,
          siteId: site.id,
          label: existing?.label || site.label,
          id: existing?.id,
          previousId: existing?.id,
          domains: product.domains.length ? product.domains : [{ name: site.host.replace(/^www\./, '') }],
        });
      }
      onSaved(site);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <form class="stack" onSubmit={save}>
      <Card title={initial.id ? `Edit ${initial.label}` : 'Add a site'} sub="The site’s analytics first, then everything it runs on. Skip what doesn’t apply."
        actions={!initial.id && (
          <button class="btn ghost" type="button" onClick={() => setForm((f) => ({ ...f, label: PUBLIC_SAMPLE.label, host: PUBLIC_SAMPLE.host, useBq: true, bq: { ...f.bq, ...PUBLIC_SAMPLE.bq } }))}>
            <Icon name="database" size={13} /> Use Google’s public GA4 sample
          </button>
        )}>
        <div class="stack">
        <div class="settings-grid">
          <label class="field">Hostname<input required value={form.host} placeholder="example.com" onInput={(e) => set({ host: e.currentTarget.value })} /></label>
          <label class="field">Label<input value={form.label} placeholder="Marketing site" onInput={(e) => set({ label: e.currentTarget.value })} /></label>
          <label class="field">GA4 property
            {properties.data?.length ? (
              <select value={form.propertyId} onChange={(e) => set({ propertyId: e.currentTarget.value, streamName: '' })}>
                <option value="">— none —</option>
                {properties.data.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.account} ({p.id})</option>)}
              </select>
            ) : (
              <input value={form.propertyId} placeholder="123456789" onInput={(e) => set({ propertyId: e.currentTarget.value })} />
            )}
            <small>Powers Overview and Pages through the GA4 Data API.</small>
          </label>
          <label class="field">Web data stream
            <select value={form.streamName} onChange={(e) => {
              const stream = (streams.data || []).find((s) => s.name === e.currentTarget.value);
              set({ streamName: e.currentTarget.value });
              if (stream && form.useBq && !form.bq.streamId) setBq({ streamId: stream.id });
            }}>
              <option value="">Whole property</option>
              {(streams.data || []).map((s) => <option key={s.id} value={s.name}>{s.name} · {s.defaultUri}</option>)}
            </select>
            <small>Scopes live users to this site.</small>
          </label>
          <label class="field">Search Console property
            {searchSites.data?.length ? (
              <select value={form.searchSite} onChange={(e) => set({ searchSite: e.currentTarget.value })}>
                <option value="">— none —</option>
                {searchSites.data.map((s) => <option key={s.siteUrl || s} value={s.siteUrl || s}>{s.siteUrl || s}</option>)}
              </select>
            ) : (
              <input value={form.searchSite} placeholder="sc-domain:example.com" onInput={(e) => set({ searchSite: e.currentTarget.value })} />
            )}
          </label>
          <label class="check" style={{ alignSelf: 'end', paddingBottom: '8px' }}>
            <input type="checkbox" checked={form.includeSubdomains} onChange={(e) => set({ includeSubdomains: e.currentTarget.checked })} /> Include subdomains
          </label>
        </div>

        <div class="divider" />
        <label class="check"><input type="checkbox" checked={form.useBq} onChange={(e) => set({ useBq: e.currentTarget.checked })} /> <b>Connect the GA4 BigQuery export</b> — unlocks Paths, Funnels, Retention, Events, Sessions and SQL</label>
        {form.useBq && (
          <>
            <BqExportStatus propertyId={form.propertyId} live={live} result={bqExport} />
            <details class="bq-advanced">
              <summary>Advanced: project, dataset, location, limits</summary>
              <div class="settings-grid">
                <label class="field">Billing project
                  {projects.data?.length ? (
                    <select value={form.bq.billingProject} onChange={(e) => setBq({ billingProject: e.currentTarget.value })}>
                      <option value="">Choose…</option>
                      {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                    </select>
                  ) : (
                    <input value={form.bq.billingProject} placeholder="my-gcp-project" onInput={(e) => setBq({ billingProject: e.currentTarget.value })} />
                  )}
                  <small>Runs and pays for the queries (1 TB/month free).</small>
                </label>
                <label class="field">Data project<input value={form.bq.dataProject} placeholder="same as billing" onInput={(e) => setBq({ dataProject: e.currentTarget.value })} /></label>
                <label class="field">Dataset<input value={form.bq.dataset} placeholder="analytics_123456789" onInput={(e) => setBq({ dataset: e.currentTarget.value })} /></label>
                <label class="field">Location<input value={form.bq.location} placeholder="US, EU, asia-south1…" onInput={(e) => setBq({ location: e.currentTarget.value })} /></label>
                <label class="field">Stream ID<input value={form.bq.streamId} placeholder="optional, numeric" onInput={(e) => setBq({ streamId: e.currentTarget.value })} />
                  <small>Filters a multi-site property to this site.</small></label>
                <label class="field">Fixed end date<input value={form.bq.endDate} placeholder="YYYY-MM-DD (static datasets)" onInput={(e) => setBq({ endDate: e.currentTarget.value })} /></label>
                <label class="field">Scan cap (GB)<input type="number" min="0.1" step="0.1" value={form.bq.maxBytes / 1e9} onInput={(e) => setBq({ maxBytes: Number(e.currentTarget.value) * 1e9 })} />
                  <small>Queries above this are refused before they run.</small></label>
                <label class="field">Sessions rollup table<input value={form.bq.sessionsTable} placeholder="project.dataset.sessions" onInput={(e) => setBq({ sessionsTable: e.currentTarget.value })} />
                  <small>Optional. Build it below after saving.</small></label>
              </div>
            </details>
            {initial.id && initial.bq && <Rollup site={initial} />}
          </>
        )}

        </div>
      </Card>

      {product
        ? <ProductStages form={{ ...product, siteId: initial.id || '' }} set={setProductPatch} setup={setup.data} inSite />
        : setup.error ? <ErrorState error={setup.error} onRetry={setup.reload} /> : <Loading height={120} />}

      {error && <ErrorState error={error} />}
      <div class="row">
        <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save site'}</button>
        <button class="btn ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Rollup({ site }) {
  const [state, setState] = useState({ busy: false, result: null, error: null });
  async function build() {
    setState({ busy: true, result: null, error: null });
    try {
      const result = await api.post(`/sites/${site.id}/warehouse/rollup`, { range: '90d', use: true });
      setState({ busy: false, result, error: null });
    } catch (error) {
      setState({ busy: false, result: null, error });
    }
  }
  return (
    <div class="state" style={{ borderStyle: 'solid' }}>
      <h3>Materialize sessions</h3>
      <p>
        Builds a partitioned <code>sessions</code> table (last 90 days) in your billing project. Paths, funnels, retention and sessions then read that
        table instead of re-scanning raw events — usually 10–50× less data per view. Re-run it daily, or schedule the same SQL as a BigQuery scheduled query.
      </p>
      <button class="btn" type="button" disabled={state.busy} onClick={build}>{state.busy ? 'Building…' : 'Build & use rollup'}</button>
      {state.result && (
        <p class="small">
          Built <code>{state.result.table}</code> with {state.result.sessions.toLocaleString()} sessions from {humanBytes(state.result.bytes)} of events.{' '}
          {state.result.linked ? 'Linked — session views now read it.' : 'Not linked because it is empty; session views keep reading raw events.'}
        </p>
      )}
      {state.error && <ErrorState error={state.error} />}
    </div>
  );
}
