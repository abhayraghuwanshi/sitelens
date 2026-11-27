import { api } from '../../api.js';
import { useAsync, navigate } from '../../hooks.js';
import { Loading, ErrorState } from '../../components/ui.jsx';
import { Icon } from '../../components/icons.jsx';
import { BrandIcon } from '../../components/BrandIcon.jsx';

const has = (scopes, s) => (scopes || []).some((x) => x.endsWith(s) || x.endsWith('cloud-platform'));
const via = (source, what) => (source === 'oauth' ? 'Connected' : source === 'env' ? `${what} from .env` : `${what} saved`);

// What the one Google sign-in unlocks, scope by scope.
export const GOOGLE_CAPS = [
  { label: 'Analytics', scope: 'analytics.readonly' },
  { label: 'Search Console', scope: 'webmasters.readonly' },
  { label: 'BigQuery', scope: '/bigquery' },
  { label: 'Cloud logs', scope: 'logging.read' },
];

// Tiles: status(i) → { on, text, warn? }. `panel` opens a settings panel,
// `href` goes to the page where that integration is managed.
const GROUPS = [
  {
    title: 'Integrations',
    items: [
      {
        // One sign-in for several Google products: who's signed in, and what it may read.
        key: 'google', brand: 'google', name: 'Google', icon: 'users', panel: 'google',
        status: ({ google: g }) => {
          const missing = g.connected ? GOOGLE_CAPS.filter((c) => !has(g.scopes, c.scope)) : [];
          if (!g.connected) return { on: false, text: 'Not signed in' };
          if (g.expired) return { on: false, text: `${g.email || 'Signed in'} · token expired`, warn: true, action: 'Sign in again' };
          if (g.broken) return { on: false, text: `${g.email || 'Signed in'} · needs signing in again`, warn: true, action: 'Sign in again' };
          if (missing.length) return { on: true, text: `${g.email || 'Signed in'} · not allowed: ${missing.map((c) => c.label).join(', ')}`, warn: true, action: 'Reconnect' };
          return { on: true, text: g.email || 'Signed in' };
        },
        desc: ({ google: g }) => (g.connected && !g.broken && !g.expired
          ? `Covers ${GOOGLE_CAPS.filter((c) => has(g.scopes, c.scope)).map((c) => c.label).join(', ')}, plus PageSpeed.`
          : 'One sign-in for GA4, Search Console, BigQuery, PageSpeed and Firebase logs.'),
      },
      {
        key: 'github', brand: 'github', name: 'GitHub', icon: 'github', panel: 'github',
        desc: 'Repo traffic, stars, clones and release downloads, synced hourly.',
        status: ({ github: g }) => (g.source
          ? { on: !g.lastError, text: g.lastError || `${g.repos} repos · ${via(g.source, 'token')}`, warn: Boolean(g.lastError) }
          : { on: false, text: 'Not connected' }),
      },
      {
        key: 'firebase', brand: 'firebase', name: 'Firebase App Hosting', icon: 'flame', panel: 'firebase',
        desc: 'Server-side page loads, AI crawlers, errors and deploys from Cloud Run logs.',
        status: ({ firebase: f, google }) => (!has(google.scopes, 'logging.read')
          ? { on: false, text: 'Google sign-in needs Cloud logs access', warn: google.connected }
          : f.errors.length ? { on: false, text: f.errors[0], warn: true }
            : f.links ? { on: true, text: `${f.links} ${f.links === 1 ? 'site' : 'sites'} linked` } : { on: true, text: 'Logs connected · no App Hosting site found yet' }),
      },
      {
        key: 'fly', brand: 'fly', name: 'Fly.io', icon: 'rocket', panel: 'fly',
        desc: 'Releases on each site’s Timeline, plus edge traffic, errors and machines per app.',
        status: ({ fly: f }) => (f?.source
          ? { on: !f.error, text: f.error || (f.login ? `Signed in as ${f.login}` : via(f.source, 'token')), warn: Boolean(f.error) }
          : { on: false, text: 'Needs an access token' }),
      },
      {
        key: 'netlify', brand: 'netlify', name: 'Netlify', icon: 'rocket', panel: 'netlify',
        desc: 'Production deploys on each site’s Timeline, including the ones that failed.',
        status: ({ netlify: n }) => (n?.source
          ? { on: !n.error, text: n.error || (n.login ? `Signed in as ${n.login}` : via(n.source, 'token')), warn: Boolean(n.error) }
          : { on: false, text: 'Needs a personal access token' }),
      },
      {
        key: 'vercel', brand: 'vercel', name: 'Vercel', icon: 'triangle', panel: 'vercel',
        desc: 'Deployments and Web Analytics for projects hosted on Vercel.',
        status: ({ vercel: v }) => (v.source
          ? { on: !v.error, text: v.error || (v.login ? `Signed in as ${v.login}` : via(v.source, 'token')), warn: Boolean(v.error) }
          : { on: false, text: 'Needs an access token' }),
      },
      {
        key: 'bing', brand: 'bing', name: 'Bing Webmaster Tools', icon: 'search', panel: 'bing',
        desc: 'Bing search clicks, queries and crawl health. Also feeds DuckDuckGo, Copilot and ChatGPT search.',
        status: ({ bing: b }) => (b?.source ? { on: true, text: via(b.source, 'API key') } : { on: false, text: 'Needs an API key' }),
      },
    ],
  },
  {
    title: 'AI answer checks',
    items: [
      {
        key: 'anthropic', brand: 'claude', name: 'Claude', icon: 'sparkles', panel: 'anthropic',
        desc: 'Asks Claude with web search the questions your customers ask, and tracks whether answers name and cite you.',
        status: ({ anthropic: a }) => (a?.source ? { on: true, text: `${via(a.source, 'API key')}${a.weekly ? ' · weekly' : ''}` } : { on: false, text: 'Needs an API key' }),
      },
      {
        key: 'openrouter', brand: 'openrouter', name: 'OpenRouter (ChatGPT, Gemini, Perplexity, Grok)', icon: 'sparkles', panel: 'openrouter',
        desc: 'One key to ask the same questions in ChatGPT, Gemini, Perplexity and Grok, each with its own web search.',
        status: ({ openrouter: o }) => (o?.source
          ? { on: true, text: `${via(o.source, 'API key')} · ${o.on.join(', ') || 'no assistants on'}` }
          : { on: false, text: 'Needs an API key' }),
      },
    ],
  },
  {
    title: 'Mentions',
    items: [
      {
        key: 'hn', brand: 'hn', name: 'Hacker News', icon: 'chat', panel: 'mentions',
        desc: 'Stories and comments that mention your sites, repos and extensions.',
        status: () => ({ on: true, text: 'Always on · no key needed' }),
      },
      {
        key: 'reddit', brand: 'reddit', name: 'Reddit', icon: 'chat', panel: 'mentions',
        desc: 'Posts and comments, through Reddit’s official API.',
        status: ({ reddit: r }) => (r.source ? { on: true, text: via(r.source, 'App credentials') } : { on: false, text: 'Needs a Reddit app' }),
      },
      {
        key: 'producthunt', brand: 'producthunt', name: 'Product Hunt', icon: 'star', panel: 'mentions',
        desc: 'Votes and comments on the launches you watch.',
        status: ({ productHunt: p }) => (p.source ? { on: true, text: via(p.source, 'Token') } : { on: false, text: 'Needs a developer token' }),
      },
    ],
  },
  {
    title: 'Monitoring & notifications',
    items: [
      {
        key: 'pagespeed', brand: 'pagespeed', name: 'PageSpeed & CrUX', icon: 'pulse', panel: 'pagespeed',
        desc: 'Lighthouse runs and Core Web Vitals history for Site health.',
        status: ({ pagespeedKey: k, google }) => (k.source
          ? { on: true, text: via(k.source, 'API key') }
          : google.connected ? { on: true, text: 'Runs on your Google sign-in' } : { on: false, text: 'Needs Google sign-in' }),
      },
      {
        key: 'notify', brand: 'slack', name: 'Slack / Discord & desktop', icon: 'bell', href: '#/alerts?view=settings',
        desc: 'Where alerts and the daily digest go.',
        status: ({ notifications: n }) => (!n.enabled ? { on: false, text: 'Alerts are paused' }
          : { on: n.webhook || n.desktop, text: [n.webhook && 'Webhook', n.desktop && 'macOS notifications'].filter(Boolean).join(' · ') || 'No destination yet' }),
      },
    ],
  },
];

// A connection page's header: name, logo, what it gives and where to manage it
// on the service, plus its live status from the same rows as the list.
const HERO = {
  google: { tagline: 'One sign-in for GA4, Search Console, BigQuery, PageSpeed and Firebase logs.', link: { label: 'Google permissions', href: 'https://myaccount.google.com/connections' } },
  github: { tagline: 'Repo traffic, stars, clones and release downloads, synced hourly.', link: { label: 'GitHub tokens', href: 'https://github.com/settings/tokens' } },
  firebase: { tagline: 'Server-side page loads, AI crawlers, errors and deploys from your Cloud Run request log.', link: { label: 'Firebase console', href: 'https://console.firebase.google.com' } },
  fly: { tagline: 'Releases on each site’s Timeline, plus edge requests, errors, response time and machines per app.', link: { label: 'Fly dashboard', href: 'https://fly.io/dashboard' } },
  netlify: { tagline: 'Production deploys on each site’s Timeline, including the ones that failed.', link: { label: 'Netlify tokens', href: 'https://app.netlify.com/user/applications#personal-access-tokens' } },
  vercel: { tagline: 'Deployments and Web Analytics for projects hosted on Vercel.', link: { label: 'Vercel dashboard', href: 'https://vercel.com/dashboard' } },
  bing: { tagline: 'Bing search clicks, queries and crawl health. Bing also feeds DuckDuckGo, Copilot and ChatGPT search.', link: { label: 'Bing Webmaster Tools', href: 'https://www.bing.com/webmasters' } },
  anthropic: { tagline: 'Asks Claude, with live web search, the questions your customers ask, and tracks whether the answers name and cite you.', link: { label: 'Claude Console', href: 'https://console.anthropic.com/settings/keys' } },
  openrouter: { tagline: 'One key to ask the same questions in ChatGPT, Gemini, Perplexity and Grok.', link: { label: 'OpenRouter', href: 'https://openrouter.ai/keys' } },
  mentions: { name: 'Mentions', brand: 'hn', tagline: 'Hacker News, Reddit and Product Hunt posts that mention your sites, repos and extensions.' },
  pagespeed: { tagline: 'Lighthouse runs and Core Web Vitals history for each site’s health.', link: { label: 'PageSpeed Insights', href: 'https://pagespeed.web.dev' } },
};

export function connectionHero(panel, data) {
  const item = GROUPS.flatMap((g) => g.items).find((i) => i.panel === panel);
  const extra = HERO[panel];
  if (!item && !extra) return null;
  return {
    name: extra?.name || item?.name,
    brand: extra?.brand || item?.brand,
    tagline: extra?.tagline || (typeof item?.desc === 'string' ? item.desc : ''),
    link: extra?.link,
    status: item && data && panel !== 'mentions' ? item.status(data) : null,
  };
}

export function IntegrationGrid({ onOpen }) {
  const data = useAsync(() => api.get('/integrations'), []);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={420} />;
  const d = data.data;

  return (
    <div class="stack gap-22">
      <DataSources metrics={d.customMetrics} />
      <ExtensionStores extensions={d.extensions} />

      {GROUPS.map((group) => (
        <section key={group.title} class="nx-block" aria-label={group.title}>
          <h2 class="nx-h2">{group.title}</h2>
          <div class="card card-plain nx-tight nx-conn-list">
            {group.items.map((item) => {
              const s = item.status(d);
              const action = s.action || (s.on ? 'Manage' : 'Connect');
              const desc = typeof item.desc === 'function' ? item.desc(d) : item.desc;
              const open = () => (item.href ? navigate(item.href.slice(1)) : onOpen(item.panel));
              return (
                <button key={item.key} type="button" class="nx-conn-row" onClick={open} aria-label={`${item.name}: ${s.text}. ${action}`}>
                  {item.brand ? <BrandIcon name={item.brand} title={item.name} /> : <span class="nx-hk"><Icon name={item.icon} size={15} /></span>}
                  <span class="nx-ob"><b>{item.name}</b><small class={s.warn ? 'bad' : 'muted'}><span class={`dot${s.on ? ' on' : ''}`} /> {s.text}</small></span>
                  <span class="nx-conn-desc muted small">{desc}</span>
                  <span class={`btn${s.on && !s.warn ? ' ghost' : ''}`} aria-hidden="true">{action}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// Your own databases, one row each, then the metrics read from them. A row opens
// that source's form; Add opens the platform picker.
function DataSources({ metrics: m }) {
  const go = (query) => navigate(`/settings?${new URLSearchParams({ i: 'metrics', ...query })}`);
  return (
    <section class="nx-block" aria-label="Data sources">
      <div class="nx-head-row">
        <h2 class="nx-h2">Data sources</h2>
        <button class="btn" type="button" onClick={() => go({ source: 'new' })}><Icon name="plus" size={14} /> Add data source</button>
      </div>
      <div class="card card-plain nx-tight nx-conn-list">
        {m.dataSources.map((ds) => {
          const missing = ds.secret === 'missing';
          const text = `${ds.platform}${ds.where ? ` · ${ds.where}` : ''}${missing ? ' · needs its key' : ''}`;
          return (
            <button key={ds.id} type="button" class="nx-conn-row" onClick={() => go({ source: ds.id })} aria-label={`${ds.name}: ${text}. Manage`}>
              <BrandIcon name={ds.platformKey} title={ds.platform} />
              <span class="nx-ob"><b>{ds.name}</b><small class={missing ? 'bad' : 'muted'}><span class={`dot${missing ? '' : ' on'}`} /> {text}</small></span>
              <span class="nx-conn-desc muted small">{ds.metrics ? `${ds.metrics} ${ds.metrics === 1 ? 'metric' : 'metrics'} read from it` : 'No metrics yet'}</span>
              <span class="btn ghost" aria-hidden="true">Manage</span>
            </button>
          );
        })}
        {(m.fromFiles || []).map((f) => (
          <button key={f.databaseId} type="button" class="nx-conn-row"
            onClick={() => go({ source: 'new', platform: 'd1', accountId: f.accountId, databaseId: f.databaseId })}
            aria-label={`Cloudflare D1 from .sitelens.yml. Manage`}>
            <BrandIcon name="d1" />
            <span class="nx-ob"><b>Cloudflare D1</b><small class="muted"><span class="dot on" /> From .sitelens.yml · {f.databaseId.slice(0, 8)}…</small></span>
            <span class="nx-conn-desc muted small">{f.metrics} {f.metrics === 1 ? 'metric' : 'metrics'} read from it</span>
            <span class="btn ghost" aria-hidden="true">Manage</span>
          </button>
        ))}
        {!m.dataSources.length && !(m.fromFiles || []).length && (
          <button type="button" class="nx-conn-row" onClick={() => go({ source: 'new' })} aria-label="Add your database">
            <span class="nx-hk"><Icon name="database" size={15} /></span>
            <span class="nx-ob"><b>Your database</b><small class="muted"><span class="dot" /> None added yet</small></span>
            <span class="nx-conn-desc muted small">Supabase, Neon, Postgres, MySQL, PlanetScale, Turso, Cloudflare D1 or SQLite.</span>
            <span class="btn" aria-hidden="true">Connect</span>
          </button>
        )}
        <button type="button" class="nx-conn-row" onClick={() => go({})} aria-label={`Metrics: ${m.count}. Manage`}>
          <span class="nx-hk"><Icon name="trend" size={15} /></span>
          <span class="nx-ob"><b>Metrics</b><small class="muted"><span class={`dot${m.count ? ' on' : ''}`} /> {m.count ? `${m.count} ${m.count === 1 ? 'metric' : 'metrics'}` : 'None yet'}</small></span>
          <span class="nx-conn-desc muted small">Daily numbers queried from your data sources, charted on each site’s Timeline.</span>
          <span class={`btn${m.count ? ' ghost' : ''}`} aria-hidden="true">{m.count ? 'Manage' : 'Add'}</span>
        </button>
      </div>
    </section>
  );
}

// Browser extensions, one row each, from whichever store lists them. A row and
// Add both go to the Extensions page, where they're tracked and added.
function ExtensionStores({ extensions: e }) {
  const go = () => navigate('/extensions');
  const fmt = (n) => (n === null ? '' : new Intl.NumberFormat('en', { notation: n >= 10_000 ? 'compact' : 'standard' }).format(n));
  return (
    <section class="nx-block" aria-label="Extensions">
      <div class="nx-head-row">
        <h2 class="nx-h2">Extensions</h2>
        <button class="btn" type="button" onClick={go}><Icon name="plus" size={14} /> Add extension</button>
      </div>
      <div class="card card-plain nx-tight nx-conn-list">
        {e.list.map((x) => {
          const text = [x.store, x.users !== null && `${fmt(x.users)} users`].filter(Boolean).join(' · ');
          return (
            <button key={x.id} type="button" class="nx-conn-row" onClick={go} aria-label={`${x.name}: ${text}. Manage`}>
              <BrandIcon name={x.storeKey === 'chrome' ? 'extensions' : x.storeKey} title={x.store} />
              <span class="nx-ob"><b>{x.name}</b><small class="muted"><span class="dot on" /> {text}</small></span>
              <span class="nx-conn-desc muted small">{x.version ? `v${x.version} · ` : ''}users, rating and version, checked daily</span>
              <span class="btn ghost" aria-hidden="true">Manage</span>
            </button>
          );
        })}
        {!e.list.length && (
          <button type="button" class="nx-conn-row" onClick={go} aria-label="Add an extension">
            <span class="nx-hk"><Icon name="puzzle" size={15} /></span>
            <span class="nx-ob"><b>Your extension</b><small class="muted"><span class="dot" /> None tracked yet</small></span>
            <span class="nx-conn-desc muted small">Chrome Web Store, Edge Add-ons or Firefox Add-ons: users, rating and version, checked daily.</span>
            <span class="btn" aria-hidden="true">Connect</span>
          </button>
        )}
      </div>
    </section>
  );
}
