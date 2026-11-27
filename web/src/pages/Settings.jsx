import { useEffect, useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, ErrorState, Loading, humanBytes, PullDown } from '../components/ui.jsx';
import { usePhoneWidth } from '../next/Page.jsx';
import { BrandIcon } from '../components/BrandIcon.jsx';
import { SiteIcon } from '../components/SiteIcon.jsx';
import { Icon } from '../components/icons.jsx';
import { ProductForm, ProductStages, productFormState, useFocusStage } from './settings/Products.jsx';
import { BingSettings, KeyForm } from './settings/BingSettings.jsx';
import { AnthropicSettings } from './settings/AnthropicSettings.jsx';
import { OpenRouterSettings } from './settings/OpenRouterSettings.jsx';
import { SiteHealthCard } from './settings/SiteHealth.jsx';
import { VercelSettings } from './settings/VercelSettings.jsx';
import { PlausibleSettings } from './settings/PlausibleSettings.jsx';
import { PostHogSettings } from './settings/PostHogSettings.jsx';
import { FlySettings } from './settings/FlySettings.jsx';
import { NetlifySettings } from './settings/NetlifySettings.jsx';
import { FirebaseSettings } from './settings/FirebaseSettings.jsx';
import { MentionsSettings } from './settings/MentionsSettings.jsx';
import { IntegrationGrid, connectionHero } from './settings/Integrations.jsx';
import { ConnectionHero, CHANGED as CONNECTION_CHANGED } from './settings/ConnectionKit.jsx';
import { McpSettings } from './settings/McpSettings.jsx';
import { CustomMetricsSettings } from './settings/CustomMetrics.jsx';

const PUBLIC_SAMPLE = {
  label: 'Google Merchandise Store (public sample)',
  host: 'shop.googlemerchandisestore.com',
  bq: { dataProject: 'bigquery-public-data', dataset: 'ga4_obfuscated_sample_ecommerce', location: 'US', endDate: '2021-01-31' },
};

const TABS = [
  { key: 'sites', label: 'Sites & products' },
  { key: 'integrations', label: 'Connections' },
  { key: 'mcp', label: 'Claude & agents' },
];

const PANELS = {
  google: { title: 'Google account', render: ({ state, onChange }) => <ConnectCard auth={state.auth} onChange={onChange} /> },
  github: { title: 'GitHub', render: ({ state, onChange }) => <GitHubSettings state={state} sources={state.sources} onChange={onChange} /> },
  firebase: { title: 'Firebase App Hosting', render: ({ state }) => <FirebaseSettings auth={state.auth} /> },
  vercel: { title: 'Vercel', render: () => <VercelSettings /> },
  plausible: { title: 'Plausible', render: () => <PlausibleSettings /> },
  posthog: { title: 'PostHog', render: () => <PostHogSettings /> },
  fly: { title: 'Fly.io', render: () => <FlySettings /> },
  netlify: { title: 'Netlify', render: () => <NetlifySettings /> },
  metrics: { title: 'Databases', render: ({ state, params }) => <CustomMetricsSettings sites={state.sites} params={params} /> },
  mentions: { title: 'Mentions', render: () => <MentionsSettings /> },
  pagespeed: { title: 'PageSpeed & CrUX', render: () => <SiteHealthCard /> },
  bing: { title: 'Bing Webmaster Tools', render: () => <BingSettings /> },
  anthropic: { title: 'Claude', render: () => <AnthropicSettings /> },
  openrouter: { title: 'OpenRouter', render: () => <OpenRouterSettings /> },
  mcp: { title: 'Claude Code & Claude Desktop', render: ({ state }) => <McpSettings hosted={state.hosted} /> },
};

// Settings: #/settings?tab=<tab> · #/settings?i=<integration> opens one integration's panel.
export function Settings({ state, params, onChange, siteExtras, siteMeasures }) {
  const flashError = params.get('error');
  const connected = params.get('connected');
  // MCP has its own tab so it's easy to find; old ?i=mcp links land there.
  const panel = params.get('i') !== 'mcp' && PANELS[params.get('i')] ? params.get('i') : connected ? 'google' : '';
  // Sites and products share one tab: old ?tab=products links (with ?edit=<product id>) land there.
  const asked = params.get('tab') === 'products' ? 'sites' : params.get('tab');
  const tab = params.get('i') === 'mcp' ? 'mcp' : panel ? 'integrations' : TABS.some((t) => t.key === asked) ? asked : 'sites';

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

  const phone = usePhoneWidth();
  return (
    <>
      {phone ? (
        <div class="sp-phone-tabs">
          <PullDown label="Account" value={tab} options={TABS} onChange={(k) => { location.hash = `#/account?tab=${k}`; }} />
        </div>
      ) : (
        <nav class="tabs" aria-label="Settings sections">
          {TABS.map((t) => (
            <a key={t.key} href={`#/account?tab=${t.key}`} class={t.key === tab ? 'active' : ''} aria-current={t.key === tab ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
      )}
      {state.auth?.broken && panel !== 'google' && (
        <a class="nx-note-line bad" href="#/account?i=google">
          <Icon name="triangle" size={15} /><span><b>Google needs you.</b> {state.auth.broken}</span><span class="nx-go">Sign in again →</span>
        </a>
      )}
      {flashError && <ErrorState error={{ message: flashError }} />}
      {tab === 'integrations' && (panel ? (
        <ConnectionDetail panel={panel}>{PANELS[panel].render({ state, params, onChange })}</ConnectionDetail>
      ) : <IntegrationGrid onOpen={(key) => navigate(`/settings?i=${key}`)} />)}
      {tab === 'mcp' && <McpSettings hosted={state.hosted} />}
      {tab === 'sites' && <SitesSettings state={state} params={params} onChange={onChange} siteExtras={siteExtras} siteMeasures={siteMeasures} />}
    </>
  );
}

// One connection's own page: back link, its header (logo, name, live status,
// what it gives, a link to the service), then its settings. Databases has its
// own views (list, source form, metric editor), and Netlify renders its header
// from its own live status, so both skip the shared header.
function ConnectionDetail({ panel, children }) {
  const data = useAsync(() => api.get('/integrations').catch(() => null), [panel]);
  useEffect(() => {
    window.addEventListener(CONNECTION_CHANGED, data.reload);
    return () => window.removeEventListener(CONNECTION_CHANGED, data.reload);
  }, [data.reload]);
  const hero = panel === 'metrics' || panel === 'netlify' ? null : connectionHero(panel, data.data);
  return (
    <div class="cx-page">
      <a class="back-link" href="#/account?tab=integrations">← All connections</a>
      {hero && <ConnectionHero {...hero} />}
      <div class="cx-body">{children}</div>
    </div>
  );
}

// Sites & products. The list and a form are never on screen together: the list
// (sites, then products without a website) with both "Add" buttons on top, or
// one form on its own with a way back. The URL says which, so Back works:
//   ?tab=sites                    the list
//   ?tab=sites&edit=new|<site>    add / edit a site (and what it runs on)
//   ?tab=sites&product=new|<id>   add / edit a product without a website
//   ?tab=products&edit=<id>       older product links, sent to the right form
// siteMeasures(site): what Studio measures, shown inside an existing site's form.
// siteExtras(site): what the new layout shows under it (sharing, left-out visits),
// so a site is set up in one place.
function SitesSettings({ state, params, onChange, siteExtras, siteMeasures }) {
  const { auth, sites } = state;
  const phone = usePhoneWidth();
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
    // An existing site: a list of its parts, each edited and saved on its own (?part=…). Older
    // ?focus= links open that part. A new site keeps the one form, to go through once.
    const part = site.id ? params.get('part') || FOCUS_PART[params.get('focus')] || '' : '';
    if (site.id && part === 'goals') { navigate(`/site/${site.id}/goals?edit=1`); return null; }
    const toList = () => go({ edit: site.id });
    if (site.id && !part) {
      return <>{back}<SiteParts site={site} setup={setup.data} onPart={(k) => go({ edit: site.id, part: k })} phone={phone} onRemove={async () => {
        if (!confirm(`Remove ${site.label} from Kauzl? Its data stays in GA4 and Search Console.`)) return;
        await api.del(`/sites/${site.id}`); onChange(); go();
      }} /></>;
    }
    const timeline = site.id && params.get('timeline') === '1' ? `#/site/${encodeURIComponent(site.id)}/timeline` : '';
    const partBack = timeline ? <a class="back-link" href={timeline}>← Timeline</a> : <a class="back-link" href={`#${base}?tab=sites&edit=${encodeURIComponent(site.id)}`}>← {site.label}</a>;
    // The config file (the old "What Kauzl measures" part opens it too).
    if (part === 'config' || part === 'measures') return <>{partBack}{siteMeasures?.(site)}</>;
    if (part === 'sharing' || part === 'leaveout') return <>{partBack}{siteExtras?.(site, part)}</>;
    return (
      <div class={site.id ? 'sp-wrap' : 'sp-new'}>
        {/* An existing site's parts read in a column; adding a new site uses the full width for its long form. */}
        {part ? partBack : back}
        {!site.id && <p class="note site-or-product">No website? <a href={`#${base}?tab=sites&product=new`}>Add an extension, app or CLI on its own →</a></p>}
        <SiteForm key={`${site.id || 'new'}:${part}`} initial={site} auth={auth} focus={params.get('focus') || ''} part={part}
          measures={site.id && !part ? siteMeasures?.(site) : null}
          onCancel={() => (timeline ? (location.hash = timeline) : part ? toList() : go())}
          onSaved={(saved) => {
            onChange();
            if (timeline) location.hash = timeline;
            else if (part) toList();
            else navigate(`/site/${saved.id}`);
          }} />
        {site.id && !part && siteExtras?.(site)}
      </div>
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
          onSaved={(saved) => navigate(`/product/${saved.id}`)}
          onRemove={product.id ? async () => {
            if (!confirm(`Remove ${product.label} from Kauzl?`)) return;
            await api.del(`/products/${product.id}`); setup.reload(); go();
          } : null} />
      </>
    );
  }

  const productOf = (id) => setup.data?.products.find((p) => p.siteId === id);
  // Sites and products are one list: a product without a website is a row like a site's,
  // with a letter for an icon and "No website" where the address goes. One Add button.
  const loneProducts = (setup.data?.products || []).filter((p) => !p.siteId);
  const siteHref = (s) => (s.demo ? `#/site/${s.id}/setup` : `#${base}?tab=sites&edit=${encodeURIComponent(s.id)}`);
  const productHref = (p) => `#${base}?tab=sites&product=${encodeURIComponent(p.id)}`;
  const productSub = (p) => ['No website', ...(p.domains || []).map((d) => d.name)].join(' · ');
  const total = sites.length + loneProducts.length;
  const suggestions = setup.data?.suggestions || [];
  async function addSuggested(product) {
    const saved = await api.post('/products/setup', product);
    navigate(`/product/${saved.id}`);
  }

  // Phone: the same list, iOS-settings style; a row opens it, where it can also be removed.
  if (phone) {
    return (
      <>
        <h2 class="nx-h2 sp-h">Sites &amp; products <span class="nx-h2-sub">Each with its analytics, hosting, repos, store listings and goals</span></h2>
        <div class="nx-mlist">
          {sites.map((s) => (
            <a key={s.id} class="nx-mrow site-mrow" href={siteHref(s)}>
              <SiteIcon site={s} />
              <span class="nx-mrow-main">
                <b>{s.label}</b>
                <span class="nx-mrow-sub"><span class="nx-mrow-path sp-host">{s.demo ? 'Built-in sample' : s.host}</span></span>
                {s.demo ? <span class="nx-mrow-sub"><span>Sample data</span></span> : <SiteSources site={s} product={productOf(s.id)} setup={setup.data} />}
              </span>
              <Icon name="chevron" size={13} class="nx-mrow-go" />
            </a>
          ))}
          {loneProducts.map((p) => (
            <a key={p.id} class="nx-mrow site-mrow" href={productHref(p)}>
              <SiteIcon site={{ id: p.id, label: p.label }} />
              <span class="nx-mrow-main">
                <b>{p.label}</b>
                <span class="nx-mrow-sub"><span>{productSub(p)}</span></span>
                <SiteSources site={{}} product={p} setup={setup.data} />
              </span>
              <Icon name="chevron" size={13} class="nx-mrow-go" />
            </a>
          ))}
          <button type="button" class="nx-mrow-more" onClick={() => go({ edit: 'new' })}>Add a site or product</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div class="sp-head">
        <p class="muted small">Everything you track, each with what it runs on: analytics, hosting, repos, store listings and goals. Something without a website, like an extension or a CLI, sits here too.</p>
        <div class="row">
          <button class="btn primary" type="button" onClick={() => go({ edit: 'new' })}><Icon name="plus" size={13} /> Add a site or product</button>
        </div>
      </div>

      <Card title={`Sites & products (${total})`} flush>
        <table class="data site-table">
          <thead><tr><th>Name</th><th>Connected</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} class="clickable" onClick={(e) => { if (!e.target.closest('a, button')) location.hash = siteHref(s); }}>
                <td>
                  <div class="site-id">
                    <SiteIcon site={s} />
                    <div>
                      <a class="site-name" href={siteHref(s)}>{s.label}</a>
                      <small>{s.demo ? 'Built-in sample data' : s.host}</small>
                    </div>
                  </div>
                </td>
                <td>{s.demo ? <span class="muted small">Sample data</span> : <SiteSources site={s} product={productOf(s.id)} setup={setup.data} />}</td>
                <td class="num nowrap">
                  {s.demo
                    ? <button class="btn ghost" type="button" onClick={async () => { await api.del(`/sites/${s.id}`); onChange(); setup.reload(); }}>Hide</button>
                    : <Icon name="chevron" size={14} class="site-go" />}
                </td>
              </tr>
            ))}
            {loneProducts.map((p) => (
              <tr key={p.id} class="clickable" onClick={(e) => { if (!e.target.closest('a, button')) location.hash = productHref(p); }}>
                <td>
                  <div class="site-id">
                    <SiteIcon site={{ id: p.id, label: p.label }} />
                    <div>
                      <a class="site-name" href={productHref(p)}>{p.label}</a>
                      <small>{productSub(p)}</small>
                    </div>
                  </div>
                </td>
                <td><SiteSources site={{}} product={p} setup={setup.data} /></td>
                <td class="num nowrap"><Icon name="chevron" size={14} class="site-go" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!total && <p class="muted inset">Nothing yet. Add a site, or a product without one, above.</p>}
        {suggestions.length > 0 && (
          <div class="site-suggest">
            <span class="muted small">Found in your connections:</span>
            {suggestions.map((sg) => <button key={sg.id} class="btn ghost" type="button" onClick={() => addSuggested(sg)}><Icon name="sparkles" size={13} /> Add {sg.label}</button>)}
          </div>
        )}
      </Card>
    </>
  );
}

// A site's parts, each edited on its own from the site's settings list.
const PARTS = [
  { key: 'analytics', title: 'Analytics', icon: 'chart' },
  { key: 'bigquery', title: 'BigQuery export', icon: 'database' },
  { key: 'domains', title: 'Domains', icon: 'globe' },
  { key: 'hosting', title: 'Hosting & deploys', icon: 'rocket' },
  { key: 'code', title: 'Code & releases', icon: 'github' },
  { key: 'distribution', title: 'Distribution', icon: 'puzzle' },
  { key: 'goals', title: 'Goals', icon: 'target' },
  { key: 'config', title: 'Config file', icon: 'code' },
  { key: 'sharing', title: 'Share with your team', icon: 'users' },
  { key: 'leaveout', title: 'Left-out visits', icon: 'eye' },
];
const FOCUS_PART = { goals: 'goals', domains: 'domains', hosting: 'hosting', repos: 'code', code: 'code', distribution: 'distribution' };

// The site's settings as a list: each part with what it's set to now; a row opens that part alone.
function SiteParts({ site, setup, onPart, onRemove }) {
  const p = setup?.products.find((x) => x.siteId === site.id);
  const n = (count, word) => (count ? `${count} ${word}${count > 1 ? 's' : ''}` : '');
  const hosting = setup?.hosting.find((h) => h.key === p?.hosting?.provider)?.label;
  const now = {
    analytics: [site.host, site.propertyId && 'GA4', site.searchSite && 'Search Console'].filter(Boolean).join(' · '),
    bigquery: site.bq ? `${site.bq.dataProject}.${site.bq.dataset}` : '',
    domains: (p?.domains || []).map((d) => d.name).join(', '),
    hosting: hosting || '',
    code: n(p?.repos?.length, 'repo'),
    distribution: n(p?.extensionIds?.length, 'extension'),
    goals: n(p?.goals?.length, 'goal'),
    config: '.sitelens.yml: goals, funnels, search topics and alerts in one file',
    sharing: 'People who can view this site, by email',
    leaveout: 'Bot-like visits, by country, kept out of the numbers',
  };
  // Parts that come from one service show its logo; the rest keep a plain icon.
  const host = p?.hosting?.provider;
  const brand = {
    analytics: 'analytics', bigquery: 'bigquery', code: 'github', distribution: 'extensions',
    hosting: host === 'github-pages' ? 'github' : ['firebase', 'vercel'].includes(host) ? host : '',
  };
  return (
    <div class="sp-wrap">
      <header class="sp-site-head">
        <SiteIcon site={site} large />
        <div class="sp-site-id">
          <h2>{site.label}</h2>
          <small>{site.host} · each part below saves on its own</small>
        </div>
        <a class="btn" href={`#/site/${encodeURIComponent(site.id)}/timeline`}>Open Timeline</a>
      </header>
      <div class="nx-mlist">
        {PARTS.map((x) => {
          const set = Boolean(now[x.key]);
          return (
            <button key={x.key} type="button" class={`nx-mrow sp-part${set ? '' : ' unset'}`} onClick={() => onPart(x.key)}>
              {brand[x.key] ? <BrandIcon name={brand[x.key]} /> : <span class="nx-hk"><Icon name={x.icon} size={15} /></span>}
              <span class="nx-mrow-main"><b>{x.title}</b><span class="nx-mrow-sub"><span>{now[x.key] || 'Not set yet'}</span></span></span>
              {set ? <Icon name="chevron" size={13} class="nx-mrow-go" /> : <span class="sp-setup">Set up</span>}
            </button>
          );
        })}
      </div>
      <div class="sp-danger">
        <button type="button" class="btn ghost danger" onClick={onRemove}>Remove {site.label}</button>
        <span class="muted small">Takes it out of Kauzl. Its data stays in GA4 and Search Console.</span>
      </div>
    </div>
  );
}

// What a site's product runs on, in one line: hosting, repos, extensions, goals.
// What a site is connected to, as a row of small logos; the details (IDs, names) are in each one's tooltip.
function SiteSources({ site, product, setup }) {
  const items = [];
  if (site.propertyId) items.push({ brand: 'analytics', title: `GA4 property ${site.propertyId}` });
  if (site.searchSite) items.push({ brand: 'search', title: `Search Console: ${site.searchSite}` });
  if (site.bq) items.push({ brand: 'bigquery', title: `BigQuery: ${site.bq.dataProject}.${site.bq.dataset}${site.bq.sessionsTable ? ' (rollup)' : ''}` });
  const host = product?.hosting?.provider;
  const hostLabel = setup?.hosting.find((h) => h.key === host)?.label || host;
  if (host) items.push({ brand: host === 'github-pages' ? 'github' : host, title: `Runs on ${hostLabel}`, text: ['firebase', 'vercel', 'github-pages'].includes(host) ? '' : hostLabel });
  if (product?.repos.length) items.push({ brand: 'github', title: product.repos.join(', '), count: product.repos.length });
  if (product?.extensionIds.length) items.push({ brand: 'extensions', title: `${product.extensionIds.length} Chrome extension${product.extensionIds.length > 1 ? 's' : ''}`, count: product.extensionIds.length });
  if (!items.length) return <span class="muted small">Nothing connected yet</span>;
  return (
    <span class="site-sources">
      {items.map((it) => (
        <span key={it.title} class="site-src" title={it.title}>
          {it.text ? <span class="site-src-text">{it.text}</span> : <BrandIcon name={it.brand} small title={it.title} />}
          {it.count > 1 && <span class="site-src-n">{it.count}</span>}
        </span>
      ))}
    </span>
  );
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
            ? <>Connect asks GitHub which repos Kauzl may see; change them any time with Choose repos. Kauzl reads traffic and stars, and only writes when you open a pull request from the article editor.</>
            : <>Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> with
          repository access to your repos and <b>Administration: read</b> (traffic needs it) plus <b>Metadata: read</b> — or a classic token with <code>repo</code>.
          It's stored in <code>.data/studio.json</code> (owner-only), or set <code>GITHUB_TOKEN</code> in <code>.env</code>. Kauzl syncs hourly into <code>.data/github.db</code>.</>}
        </p>
        {!state.hosted && <details class="advanced">
        <summary>Advanced: import older history</summary>
        <form class="stack" onSubmit={(e) => {
          e.preventDefault();
          act('import', () => api.post('/github/import', { path: importPath }),
            (r) => `Imported ${Object.entries(r.imported).map(([t, n]) => `${n} ${t}`).join(', ')}.`);
        }}>
          <p class="note m-0">
            GitHub only serves the last 14 days of traffic. If you ran ghstats before, copy its history in once — Kauzl keeps no link to that file afterwards.
          </p>
          <div class="row">
            <input style={{ flex: '1', minWidth: '260px' }} placeholder="/path/to/ghstats/data/ghstats.db" value={importPath} onInput={(e) => setImportPath(e.currentTarget.value)} aria-label="ghstats database to import" />
            <button class="btn" type="submit" disabled={!importPath.trim() || Boolean(busy)}>{busy === 'import' ? 'Importing…' : 'Import once'}</button>
          </div>
        </form>
        </details>}
        {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}

function ConnectCard({ auth, onChange }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [key, setKey] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState(null);

  async function useKey(e) {
    e.preventDefault();
    setKeyBusy(true);
    setKeyError(null);
    try {
      await api.post('/auth/service-account', { key });
      setKey('');
      onChange();
    } catch (err) {
      setKeyError(err);
    } finally {
      setKeyBusy(false);
    }
  }

  async function readKeyFile(e) {
    const file = e.currentTarget.files?.[0];
    if (file) setKey(await file.text());
  }

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
    <Card title="Google account" sub={auth.connected ? (auth.mode === 'oauth' ? 'Signed in · refreshes automatically' : auth.mode === 'service' ? 'Service account key · never expires' : 'Pasted access token') : 'Not connected'}>
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
            <button class="btn ghost danger" type="button" onClick={async () => { await api.post('/auth/signout'); onChange(); }}>{auth.mode === 'service' ? 'Remove key' : 'Sign out'}</button>
          </div>
        )}
        {auth.mode === 'service' && (
          <p class="note m-0">
            Add <code>{auth.email}</code> in GA4 (Admin → Property access management, Viewer) and in Search Console (Settings → Users and permissions, Restricted).
            For BigQuery, give it BigQuery Data Viewer and Job User in the project.
          </p>
        )}
        <form class="stack" onSubmit={useKey}>
          <b>Use a service account key, no sign-in</b>
          <textarea rows="4" placeholder='{ "type": "service_account", … }' value={key} onInput={(e) => setKey(e.currentTarget.value)} aria-label="Service account key (JSON)" autocomplete="off" spellcheck={false} />
          <input type="file" accept="application/json,.json" onChange={readKeyFile} aria-label="Or choose the key file" />
          <p class="note m-0">
            In Google Cloud: IAM → Service accounts → create one → Keys → Add key → JSON. Then add its email as a viewer in GA4 and a user in Search Console.
            It never expires, and Kauzl only reads.
          </p>
          <button class="btn self-start" type="submit" disabled={keyBusy || !key.trim()}>{keyBusy ? 'Checking…' : 'Use this key'}</button>
          {keyError && <p class="small text-bad m-0">{keyError.message}</p>}
        </form>
        <div class="stack">
          <div class="stack">
            {auth.oauthAvailable ? (
              <>
                <a class="btn primary self-start" href="/auth/google">{auth.connected ? 'Sign in again' : 'Continue with Google'}</a>
                {auth.connected && <p class="note m-0">Signing in again picks up permissions added since you last connected, like Cloud logs for Firebase.</p>}
              </>
            ) : (
              <p class="note">
                Disabled. Create an OAuth client (type <b>Web application</b>, redirect URI <code>http://127.0.0.1:4318/auth/callback</code>) in Google Cloud,
                then start Kauzl with <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>. Sign-in stores a refresh token locally so you stay connected.
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
            <button class="btn self-start" type="submit" disabled={busy || !token.trim()}>{busy ? 'Verifying…' : 'Verify token'}</button>
            {error && <p class="small text-bad m-0">{error.message}</p>}
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
  if (!live) return <p class="note">Connect Google above and Kauzl finds the export for you.</p>;
  if (!propertyId) return <p class="note">Pick the GA4 property above and Kauzl finds its BigQuery export for you.</p>;
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
    <div class="note stack gap-6">
      <span>{result.error ? `Couldn’t look for the export: ${result.error.message}.` : 'No BigQuery export found for this property.'} To turn it on:</span>
      <ol style={{ margin: 0, paddingLeft: '18px' }}>
        <li>In Google Analytics, open <b>Admin → Product links → BigQuery links</b> and click <b>Link</b>.</li>
        <li>Choose a Google Cloud project, tick <b>Daily</b> export, and submit.</li>
        <li>Come back and check again. The first day’s data arrives within 24 hours.</li>
      </ol>
      <span class="row gap-8">
        <a class="btn ghost" href="https://analytics.google.com/analytics/web/" target="_blank" rel="noopener noreferrer">Open GA4 Admin</a>
        <button class="btn ghost" type="button" onClick={() => result.reload()}>Check again</button>
        <a class="btn ghost" href="https://kauzl.com/guides/ga4-bigquery-export/" target="_blank" rel="noopener noreferrer">Step-by-step guide</a>
      </span>
    </div>
  );
}

// The domain someone registered for a host: shop.example.com → example.com, blog.site.co.uk → site.co.uk.
function registeredDomain(host) {
  const parts = String(host || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (parts.length < 2) return '';
  const two = parts.slice(-2).join('.');
  return parts.length > 2 && /^(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/.test(two) ? parts.slice(-3).join('.') : two;
}

function SiteForm({ initial, auth, focus, part = '', measures = null, onCancel, onSaved }) {
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
  // A new site: once its address is typed, pick the Search Console property for it (domain or URL-prefix).
  useEffect(() => {
    if (initial.id || form.searchSite || !form.host || !searchSites.data?.length) return;
    const host = form.host.replace(/^www\./, '').toLowerCase();
    const urls = searchSites.data.map((x) => x.siteUrl || x);
    const match = urls.find((u) => u === `sc-domain:${host}`)
      || urls.find((u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') === host);
    if (match) set({ searchSite: match });
  }, [form.host, searchSites.data]);
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
          // The address is the domain: watch the one that was registered (shop.example.com → example.com).
          domains: product.domains.length ? product.domains : [{ name: registeredDomain(site.host) || site.host.replace(/^www\./, '') }],
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
      {/* A whole new site: Save stays in reach, pinned at the top while the long form scrolls.
          One part: its card is the heading, and Save sits under its fields. */}
      {!part && <div class="form-bar">
        <b class="form-bar-title">{part ? PARTS.find((x) => x.key === part)?.title || 'Edit' : initial.id ? `Edit ${initial.label}` : 'Add a site'}</b>
        <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : part ? 'Save' : 'Save site'}</button>
        <button class="btn ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>}
      {error && <ErrorState error={error} />}
      {(!part || part === 'analytics' || part === 'bigquery') && (
      <Card title={part === 'bigquery' ? 'BigQuery export' : part ? 'Analytics' : 'Your site'} sub={part === 'bigquery' ? 'GA4’s raw events, for Journeys and Raw data.' : part ? 'The site’s address and where its numbers come from.' : 'Its address, then where its numbers come from. Skip what you don’t use.'}
        actions={!initial.id && (
          <button class="btn ghost" type="button" onClick={() => setForm((f) => ({ ...f, label: PUBLIC_SAMPLE.label, host: PUBLIC_SAMPLE.host, useBq: true, bq: { ...f.bq, ...PUBLIC_SAMPLE.bq } }))}>
            <Icon name="database" size={13} /> Use Google’s public GA4 sample
          </button>
        )}>
        <div class="stack">
        {part !== 'bigquery' && (
        <>
          {/* The site itself: its address, big, then what to call it. */}
          <div class="an-site">
            <label class="field an-host">Website address
              <span class="an-url">
                <span class="an-url-pre" aria-hidden="true">https://</span>
                <input required value={form.host} placeholder="example.com" autocomplete="off" spellcheck={false}
                  onInput={(e) => set({ host: e.currentTarget.value })}
                  onBlur={(e) => {
                    // A pasted URL keeps just its host.
                    const host = e.currentTarget.value.trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').toLowerCase();
                    if (host !== form.host) set({ host });
                  }} />
              </span>
            </label>
            <label class="field an-name">Name
              <input value={form.label} placeholder={form.host ? form.host.replace(/^www\./, '').split('.')[0] : 'Marketing site'} onInput={(e) => set({ label: e.currentTarget.value })} />
              <small>How it shows in Kauzl. Leave blank to use the address.</small>
            </label>
          </div>

          <div class="an-sources">
            <section class="an-src">
              <div class="an-src-id">
                <BrandIcon name="analytics" />
                <div>
                  <b>Google Analytics 4</b>
                  <small>Visits, pages and where people came from.</small>
                  <span class={`an-pill${form.propertyId ? ' on' : ''}`}>{form.propertyId ? 'Connected' : 'Recommended'}</span>
                </div>
              </div>
              <div class="an-src-fields">
                <label class="field">Property
                  {properties.data?.length ? (
                    <select value={form.propertyId} onChange={(e) => set({ propertyId: e.currentTarget.value, streamName: '' })}>
                      <option value="">Choose a property…</option>
                      {properties.data.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.account} ({p.id})</option>)}
                    </select>
                  ) : (
                    <input value={form.propertyId} placeholder="123456789" inputMode="numeric" onInput={(e) => set({ propertyId: e.currentTarget.value })} />
                  )}
                </label>
                <label class="field">Web stream
                  <select value={form.streamName} disabled={!form.propertyId} onChange={(e) => {
                    const stream = (streams.data || []).find((s) => s.name === e.currentTarget.value);
                    set({ streamName: e.currentTarget.value });
                    if (stream && form.useBq && !form.bq.streamId) setBq({ streamId: stream.id });
                  }}>
                    <option value="">Whole property</option>
                    {(streams.data || []).map((s) => <option key={s.id} value={s.name}>{s.name} · {s.defaultUri}</option>)}
                  </select>
                  <small>Pick one when a property has several sites.</small>
                </label>
              </div>
            </section>

            <section class="an-src">
              <div class="an-src-id">
                <BrandIcon name="search" />
                <div>
                  <b>Search Console</b>
                  <small>Google searches that show and click your site.</small>
                  <span class={`an-pill${form.searchSite ? ' on' : ''}`}>{form.searchSite ? 'Connected' : 'Recommended'}</span>
                </div>
              </div>
              <div class="an-src-fields">
                <label class="field">Property
                  {searchSites.data?.length ? (
                    <select value={form.searchSite} onChange={(e) => set({ searchSite: e.currentTarget.value })}>
                      <option value="">Choose a property…</option>
                      {searchSites.data.map((s) => <option key={s.siteUrl || s} value={s.siteUrl || s}>{s.siteUrl || s}</option>)}
                    </select>
                  ) : (
                    <input value={form.searchSite} placeholder="sc-domain:example.com" onInput={(e) => set({ searchSite: e.currentTarget.value })} />
                  )}
                </label>
                <label class="an-switch">
                  <input type="checkbox" role="switch" checked={form.includeSubdomains} onChange={(e) => set({ includeSubdomains: e.currentTarget.checked })} />
                  <span><b>Include subdomains</b><small>Count blog.{form.host || 'example.com'} and the like as this site.</small></span>
                </label>
              </div>
            </section>
          </div>
        </>
        )}

        {part !== 'analytics' && <>
        <section class={`an-src an-bq${form.useBq ? ' on' : ''}`}>
          <div class="an-src-id">
            <BrandIcon name="bigquery" />
            <div>
              <b>BigQuery export</b>
              <small>GA4’s raw events: unlocks Journeys, Funnels, Retention, Sessions and SQL. <a href="https://kauzl.com/guides/ga4-bigquery-export/" target="_blank" rel="noopener noreferrer">How to set it up</a></small>
              <span class={`an-pill${form.useBq ? ' on' : ''}`}>{form.useBq ? 'On' : 'Optional'}</span>
            </div>
          </div>
          <div class="an-src-fields">
            <label class="an-switch">
              <input type="checkbox" role="switch" checked={form.useBq} onChange={(e) => set({ useBq: e.currentTarget.checked })} />
              <span><b>{form.useBq ? 'Connected to the export' : 'Connect the export'}</b><small>Kauzl finds the dataset for you once GA4 is picked.</small></span>
            </label>
          </div>
        </section>
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
        </>}

        </div>
      </Card>
      )}

      {part === 'analytics' || part === 'bigquery' ? null : product
        ? <ProductStages form={{ ...product, siteId: initial.id || '' }} set={setProductPatch} setup={setup.data} inSite only={part} skip={part ? [] : ['domains']} hint={form.host} />
        : setup.error ? <ErrorState error={setup.error} onRetry={setup.reload} /> : <Loading height={120} />}

      {measures}
      {part && (
        <div class="row form-foot">
          <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button class="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        </div>
      )}
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
