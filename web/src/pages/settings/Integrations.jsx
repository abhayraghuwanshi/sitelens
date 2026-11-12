import { api } from '../../api.js';
import { useAsync, navigate } from '../../hooks.js';
import { Loading, ErrorState } from '../../components/ui.jsx';
import { Icon } from '../../components/icons.jsx';

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
    title: 'Data sources',
    items: [
      {
        key: 'github', name: 'GitHub', icon: 'github', panel: 'github',
        desc: 'Repo traffic, stars, clones and release downloads, synced hourly.',
        status: ({ github: g }) => (g.source
          ? { on: !g.lastError, text: g.lastError || `${g.repos} repos · ${via(g.source, 'token')}`, warn: Boolean(g.lastError) }
          : { on: false, text: 'Not connected' }),
      },
      {
        key: 'firebase', name: 'Firebase App Hosting', icon: 'flame', panel: 'firebase',
        desc: 'Server-side page loads, AI crawlers, errors and deploys from Cloud Run logs.',
        status: ({ firebase: f, google }) => (!has(google.scopes, 'logging.read')
          ? { on: false, text: 'Google sign-in needs Cloud logs access', warn: google.connected }
          : f.errors.length ? { on: false, text: f.errors[0], warn: true }
            : f.links ? { on: true, text: `${f.links} ${f.links === 1 ? 'site' : 'sites'} linked` } : { on: true, text: 'Logs connected · no App Hosting site found yet' }),
      },
      {
        key: 'vercel', name: 'Vercel', icon: 'triangle', panel: 'vercel',
        desc: 'Deployments and Web Analytics for projects hosted on Vercel.',
        status: ({ vercel: v }) => (v.source
          ? { on: !v.error, text: v.error || (v.login ? `Signed in as ${v.login}` : via(v.source, 'token')), warn: Boolean(v.error) }
          : { on: false, text: 'Needs an access token' }),
      },
      {
        key: 'metrics', name: 'Custom metrics', icon: 'database', panel: 'metrics',
        desc: 'Daily numbers from your own databases, like daily pings from Cloudflare D1, charted on Overview.',
        status: ({ customMetrics: m }) => (m.count
          ? { on: true, text: `${m.count} ${m.count === 1 ? 'metric' : 'metrics'}${m.sources.length ? ` · ${m.sources.join(', ')}` : ''}` }
          : m.sources.length ? { on: true, text: `${m.sources.join(', ')} connected · add a metric to chart it` } : { on: false, text: 'Needs a source and a query' }),
      },
      {
        key: 'bing', name: 'Bing Webmaster Tools', icon: 'search', panel: 'bing',
        desc: 'Bing search clicks, queries and crawl health. Also feeds DuckDuckGo, Copilot and ChatGPT search.',
        status: ({ bing: b }) => (b?.source ? { on: true, text: via(b.source, 'API key') } : { on: false, text: 'Needs an API key' }),
      },
      {
        key: 'anthropic', name: 'Claude (AI answer checks)', icon: 'sparkles', panel: 'anthropic',
        desc: 'Asks Claude with web search the questions your customers ask, and tracks whether answers name and cite you.',
        status: ({ anthropic: a }) => (a?.source ? { on: true, text: `${via(a.source, 'API key')}${a.weekly ? ' · weekly' : ''}` } : { on: false, text: 'Needs an API key' }),
      },
      {
        key: 'openrouter', name: 'OpenRouter (ChatGPT, Gemini, Perplexity, Grok)', icon: 'sparkles', panel: 'openrouter',
        desc: 'One key to ask the same questions in ChatGPT, Gemini, Perplexity and Grok, each with its own web search.',
        status: ({ openrouter: o }) => (o?.source
          ? { on: true, text: `${via(o.source, 'API key')} · ${o.on.join(', ') || 'no assistants on'}` }
          : { on: false, text: 'Needs an API key' }),
      },
      {
        key: 'cws', name: 'Chrome Web Store', icon: 'puzzle', href: '#/extensions',
        desc: 'Users, ratings and versions of your extensions, plus listing installs via GA4.',
        status: ({ extensions: e }) => (e.count ? { on: true, text: `${e.count} ${e.count === 1 ? 'extension' : 'extensions'} tracked` } : { on: false, text: 'No extensions added' }),
      },
    ],
  },
  {
    title: 'Mentions',
    items: [
      {
        key: 'hn', name: 'Hacker News', icon: 'chat', panel: 'mentions',
        desc: 'Stories and comments that mention your sites, repos and extensions.',
        status: () => ({ on: true, text: 'Always on · no key needed' }),
      },
      {
        key: 'reddit', name: 'Reddit', icon: 'chat', panel: 'mentions',
        desc: 'Posts and comments, through Reddit’s official API.',
        status: ({ reddit: r }) => (r.source ? { on: true, text: via(r.source, 'App credentials') } : { on: false, text: 'Needs a Reddit app' }),
      },
      {
        key: 'producthunt', name: 'Product Hunt', icon: 'star', panel: 'mentions',
        desc: 'Votes and comments on the launches you watch.',
        status: ({ productHunt: p }) => (p.source ? { on: true, text: via(p.source, 'Token') } : { on: false, text: 'Needs a developer token' }),
      },
    ],
  },
  {
    title: 'Agents',
    items: [
      {
        key: 'mcp', name: 'Claude Code & Claude Desktop (MCP)', icon: 'terminal', panel: 'mcp',
        desc: 'Ask your agent about traffic, search and launches, and have it leave comments on your charts.',
        status: ({ hosted }) => ({ on: false, text: hosted ? 'Set up once per agent with an access token' : 'Set up once per agent · no key needed' }),
      },
    ],
  },
  {
    title: 'Monitoring & notifications',
    items: [
      {
        key: 'pagespeed', name: 'PageSpeed & CrUX', icon: 'pulse', panel: 'pagespeed',
        desc: 'Lighthouse runs and Core Web Vitals history for Site health.',
        status: ({ pagespeedKey: k, google }) => (k.source
          ? { on: true, text: via(k.source, 'API key') }
          : google.connected ? { on: true, text: 'Runs on your Google sign-in' } : { on: false, text: 'Needs Google sign-in' }),
      },
      {
        key: 'notify', name: 'Slack / Discord & desktop', icon: 'bell', href: '#/alerts?view=settings',
        desc: 'Where alerts and the daily digest go.',
        status: ({ notifications: n }) => (!n.enabled ? { on: false, text: 'Alerts are paused' }
          : { on: n.webhook || n.desktop, text: [n.webhook && 'Webhook', n.desktop && 'macOS notifications'].filter(Boolean).join(' · ') || 'No destination yet' }),
      },
    ],
  },
];

export function IntegrationGrid({ onOpen }) {
  const data = useAsync(() => api.get('/integrations'), []);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={420} />;
  const d = data.data;
  const g = d.google;
  const missing = g.connected ? GOOGLE_CAPS.filter((c) => !has(g.scopes, c.scope)) : [];

  return (
    <div class="stack" style={{ gap: '24px' }}>
      <section class="integration wide">
        <span class="integration-icon"><Icon name="users" size={18} /></span>
        <div class="integration-body">
          <div class="integration-head">
            <b>Google account</b>
            <span class="integration-status">
              <span class={`dot${g.connected && !g.expired && !missing.length ? ' on' : ''}`} />
              {g.connected ? (g.expired ? 'Token expired' : g.email || 'Connected') : 'Not connected'}
            </span>
          </div>
          <p>One sign-in covers GA4, Search Console, BigQuery, PageSpeed and Firebase logs.</p>
          {g.connected && (
            <div class="row" style={{ gap: '6px' }}>
              {GOOGLE_CAPS.map((c) => (
                <span key={c.label} class={`chip${has(g.scopes, c.scope) ? ' good' : ''}`}>{has(g.scopes, c.scope) ? '✓' : '✗'} {c.label}</span>
              ))}
            </div>
          )}
          {missing.length > 0 && <p class="small" style={{ color: 'var(--warning-ink, var(--critical-ink))', margin: 0 }}>Sign in again to allow {missing.map((c) => c.label).join(', ')}.</p>}
        </div>
        <button class={`btn${g.connected && !missing.length ? '' : ' primary'}`} type="button" onClick={() => onOpen('google')}>
          {g.connected ? (missing.length ? 'Reconnect' : 'Manage') : 'Connect'}
        </button>
      </section>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <div class="nav-label" style={{ padding: '0 0 8px' }}>{group.title}</div>
          <div class="integration-grid">
            {group.items.map((item) => {
              const s = item.status(d);
              const action = s.on ? 'Manage' : 'Connect';
              const open = () => (item.href ? navigate(item.href.slice(1)) : onOpen(item.panel));
              return (
                <button key={item.key} type="button" class="integration" onClick={open} aria-label={`${item.name}: ${s.text}. ${action}`}>
                  <span class="integration-icon"><Icon name={item.icon} size={18} /></span>
                  <span class="integration-body">
                    <span class="integration-head"><b>{item.name}</b></span>
                    <span class="desc">{item.desc}</span>
                    <span class="integration-status" style={s.warn ? { color: 'var(--critical-ink)' } : undefined}>
                      <span class={`dot${s.on ? ' on' : ''}`} /> {s.text}
                    </span>
                  </span>
                  <span class={`btn${s.on ? '' : ' primary'}`} aria-hidden="true">{action}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
