import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from './api.js';
import { useRoute, useAsync, usePersistent, navigate, withParam } from './hooks.js';
import { Icon } from './components/icons.jsx';
import { Logo } from './components/Logo.jsx';
import { Segmented, Loading, ErrorState } from './components/ui.jsx';
import { Portfolio } from './pages/Portfolio.jsx';
import { Overview } from './pages/Overview.jsx';
import { Pages } from './pages/Pages.jsx';
import { Search } from './pages/Search.jsx';
import { Demand } from './pages/Demand.jsx';
import { Paths } from './pages/Paths.jsx';
import { Funnels } from './pages/Funnels.jsx';
import { Retention } from './pages/Retention.jsx';
import { Events } from './pages/Events.jsx';
import { Sessions } from './pages/Sessions.jsx';
import { Explore } from './pages/Explore.jsx';
import { Settings } from './pages/Settings.jsx';
import { GitHub } from './pages/GitHub.jsx';
import { Extensions } from './pages/Extensions.jsx';
import { Product } from './pages/Product.jsx';
import { Outcomes } from './pages/Outcomes.jsx';
import { Health } from './pages/Health.jsx';
import { Alerts, AlertsNavItem } from './pages/Alerts.jsx';
import { Mentions } from './pages/Mentions.jsx';
import { Posts } from './pages/Posts.jsx';
import { Vercel } from './pages/Vercel.jsx';
import { Firebase } from './pages/Firebase.jsx';
import { Bing } from './pages/Bing.jsx';
import { AiSearch } from './pages/AiSearch.jsx';
import { Calendar } from './pages/Calendar.jsx';

// group: sidebar sub-heading. mode: which connection a view needs. API views share the GA4 range list; warehouse views use 7/28/90d.
export const VIEWS = [
  { key: 'overview', group: 'Traffic', label: 'Overview', icon: 'chart', mode: 'api', component: Overview },
  { key: 'pages', group: 'Traffic', label: 'Pages', icon: 'pages', mode: 'api', component: Pages },
  { key: 'search', group: 'Search', label: 'Search', icon: 'search', mode: 'search', component: Search },
  { key: 'bing', group: 'Search', label: 'Bing search', icon: 'search', mode: 'bing', component: Bing },
  { key: 'ai', group: 'Search', label: 'AI search', icon: 'sparkles', mode: 'api', component: AiSearch },
  { key: 'demand', group: 'Search', label: 'Search demand', icon: 'trend', mode: 'search', component: Demand },
  { key: 'paths', group: 'Warehouse', label: 'Paths', icon: 'flow', mode: 'warehouse', component: Paths },
  { key: 'funnels', group: 'Warehouse', label: 'Funnels', icon: 'funnel', mode: 'warehouse', component: Funnels },
  { key: 'retention', group: 'Warehouse', label: 'Retention', icon: 'cohort', mode: 'warehouse', component: Retention },
  { key: 'events', group: 'Warehouse', label: 'Events', icon: 'bolt', mode: 'warehouse', component: Events },
  { key: 'sessions', group: 'Warehouse', label: 'Sessions', icon: 'users', mode: 'warehouse', component: Sessions },
  { key: 'sql', group: 'Warehouse', label: 'SQL console', icon: 'terminal', mode: 'warehouse', component: Explore },
];

export function App() {
  const route = useRoute();
  const state = useAsync(() => api.get('/state'), []);
  const [range, setRange] = usePersistent('range', '28d');
  const [theme, setTheme] = usePersistent('theme', '');
  const [lastSite, setLastSite] = usePersistent('site', 'demo');
  const systemDark = useSystemDark();

  // Opening a link with ?range= makes it the remembered range too (Health has its own ranges).
  const linkedRange = route.parts[0] !== 'health' ? route.params.get('range') : null;
  useEffect(() => {
    if (linkedRange) setRange(linkedRange);
  }, [linkedRange]);

  const routedSite = route.parts[0] === 'site' ? route.parts[1] : '';
  useEffect(() => {
    if (routedSite) setLastSite(routedSite);
  }, [routedSite]);

  useEffect(() => {
    document.querySelector('.sidebar-scroll .nav-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [route.parts.join('/'), state.data]);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  if (state.loading && !state.data) return <div style={{ padding: '32px' }}><Loading height={400} /></div>;
  if (state.error) return <div style={{ padding: '32px' }}><ErrorState error={state.error} onRetry={state.reload} /></div>;

  const { sites, auth, ranges } = state.data;
  const [section, siteId, viewKey = 'overview'] = route.parts;
  const site = section === 'site' ? sites.find((s) => s.id === siteId) : null;
  const current = site || sites.find((s) => s.id === lastSite) || sites[0];
  const view = VIEWS.find((v) => v.key === viewKey) || VIEWS[0];
  const isWarehouse = section === 'site' && view.mode === 'warehouse';
  const isHistory = section === 'github' || section === 'extensions' || section === 'product' || section === 'outcomes' || section === 'vercel' || section === 'firebase' || section === 'mentions' || section === 'posts';
  // Bing keeps its own daily history, so it takes the long history ranges.
  const rangeOptions = isHistory || (section === 'site' && view.mode === 'bing') ? ranges.history : isWarehouse ? ranges.warehouse : ranges.api;
  // A ?range= in the URL wins (bookmarks, shared links); otherwise the last one picked anywhere.
  const showRange = section !== 'settings' && section !== 'health' && section !== 'calendar';
  const urlRange = showRange ? route.params.get('range') : '';
  const wanted = urlRange && rangeOptions.some((r) => r.key === urlRange) ? urlRange : range;
  const effectiveRange = rangeOptions.some((r) => r.key === wanted) ? wanted : '28d';
  const pickRange = (key) => {
    setRange(key);
    navigate(withParam('range', key));
  };


  let body;
  let title;
  if (section === 'settings') {
    title = 'Settings';
    body = <Settings state={state.data} params={route.params} onChange={() => state.reload()} />;
  } else if (section === 'github') {
    title = 'GitHub';
    body = <GitHub range={effectiveRange} params={route.params} sync={state.data.sources.github} onSynced={() => state.reload()} />;
  } else if (section === 'product') {
    title = 'Product';
    body = <Product id={siteId} range={effectiveRange} params={route.params} />;
  } else if (section === 'outcomes') {
    title = 'Outcomes';
    body = <Outcomes id={siteId} range={effectiveRange} />;
  } else if (section === 'health') {
    title = 'Site health';
    body = <Health sites={sites} params={route.params} />;
  } else if (section === 'calendar') {
    title = 'Calendar';
    body = <Calendar sites={sites} params={route.params} />;
  } else if (section === 'alerts') {
    title = 'Alerts';
    body = <Alerts />;
  } else if (section === 'mentions') {
    title = 'Mentions';
    body = <Mentions range={effectiveRange} />;
  } else if (section === 'posts') {
    title = 'My posts';
    body = <Posts range={effectiveRange} />;
  } else if (section === 'firebase') {
    title = 'Firebase';
    body = <Firebase range={effectiveRange} params={route.params} />;
  } else if (section === 'vercel') {
    title = 'Vercel';
    body = <Vercel range={effectiveRange} params={route.params} />;
  } else if (section === 'extensions') {
    title = 'Chrome extensions';
    body = <Extensions range={effectiveRange} onChange={() => state.reload()} />;
  } else if (section === 'site' && site) {
    const View = view.component;
    title = view.label;
    body = <View key={`${site.id}:${view.key}`} site={site} range={effectiveRange} params={route.params} auth={auth} />;
  } else if (section === 'site') {
    title = 'Site not found';
    body = <ErrorState error={{ message: 'That site was removed or never existed.' }} />;
  } else {
    title = 'All sites';
    body = <Portfolio sites={sites} range={ranges.api.some((r) => r.key === range) ? range : '28d'} auth={auth} />;
  }

  return (
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/" aria-label="SiteLens Studio home">
          <Logo size={30} title="" />
          <div>
            SiteLens <span class="brand-studio">Studio</span>
            <small>Analytics workspace</small>
          </div>
        </a>

        <div class="sidebar-scroll">
        <div class="nav-group">
          <div class="nav-label">Workspace</div>
          <nav class="nav-group" aria-label="Workspace">
            <NavLink href="#/" icon="grid" active={!section} count={sites.length}>All sites</NavLink>
            <NavLink href="#/calendar" icon="calendar" active={section === 'calendar'}>Calendar</NavLink>
            <NavLink href="#/product" icon="layers" active={section === 'product'}>Products</NavLink>
            <NavLink href="#/outcomes" icon="target" active={section === 'outcomes'}>Outcomes</NavLink>
          </nav>
        </div>

        {current && (
          <div class="nav-group">
            <div class="nav-label">Site</div>
            <SiteSwitcher sites={sites} current={current} view={section === 'site' ? view.key : 'overview'} />
            <nav class="nav-group" aria-label={`${current.label} views`} style={{ marginTop: '6px' }}>
              {VIEWS.map((v, i) => {
                const available = current.modes[v.mode];
                const active = section === 'site' && site?.id === current.id && view.key === v.key;
                return (
                  <Fragment key={v.key}>
                    {v.group !== VIEWS[i - 1]?.group && <div class="nav-sublabel">{v.group}</div>}
                    <a class={`nav-item${active ? ' active' : ''}`} href={`#/site/${current.id}/${v.key}`}
                      title={available ? v.label : `${v.label} needs ${v.mode === 'warehouse' ? 'BigQuery' : v.mode === 'search' ? 'Search Console' : v.mode === 'bing' ? 'a real site (not the sample)' : 'a GA4 property'}`}>
                      <Icon name={v.icon} /> {v.label}
                      {!available && <span class="lock"><Icon name="lock" size={12} /></span>}
                    </a>
                  </Fragment>
                );
              })}
            </nav>
          </div>
        )}

        <div class="nav-group">
          <div class="nav-label">Sources</div>
          <nav class="nav-group" aria-label="Sources">
            <NavLink href="#/github" icon="github" active={section === 'github'}
              count={state.data.sources.github.data.ok ? state.data.sources.github.data.repos : 0}>GitHub</NavLink>
            <NavLink href="#/extensions" icon="puzzle" active={section === 'extensions'} count={state.data.sources.extensions}>Extensions</NavLink>
            <NavLink href="#/firebase" icon="flame" active={section === 'firebase'}>Firebase</NavLink>
            <NavLink href="#/vercel" icon="triangle" active={section === 'vercel'}>Vercel</NavLink>
          </nav>
        </div>

        <div class="nav-group">
          <div class="nav-label">Monitoring</div>
          <nav class="nav-group" aria-label="Monitoring">
            <NavLink href="#/health" icon="pulse" active={section === 'health'}>Site health</NavLink>
            <NavLink href="#/mentions" icon="chat" active={section === 'mentions'}>Mentions</NavLink>
            <NavLink href="#/posts" icon="megaphone" active={section === 'posts'}>My posts</NavLink>
            <AlertsNavItem active={section === 'alerts'} />
          </nav>
        </div>
        </div>

        <div class="sidebar-foot">
          <NavLink href="#/settings" icon="settings" active={section === 'settings'}>Settings</NavLink>
          <div class="foot-row">
            <div class="conn" title={auth.email || ''}>
              <span class={`dot${auth.connected && !auth.expired ? ' on' : ''}`} aria-hidden="true" />
              <span>{auth.connected ? (auth.expired ? 'Token expired' : auth.email || 'Google connected') : 'Demo only · not connected'}</span>
            </div>
            <button class="theme-btn" type="button" onClick={() => setTheme(resolvedTheme(theme, systemDark) === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${resolvedTheme(theme, systemDark) === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${resolvedTheme(theme, systemDark) === 'dark' ? 'light' : 'dark'} theme`}>
              <Icon name={resolvedTheme(theme, systemDark) === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <h1>{title}</h1>
            {section === 'site' && site && <div class="crumb">{site.label}{site.demo ? ' · sample data' : ''}</div>}
          </div>
          <span class="spacer" />
          {showRange && <Segmented label="Date range" value={effectiveRange} options={rangeOptions} onChange={pickRange} />}
        </header>
        <div class="content">{body}</div>
      </main>
    </div>
  );
}

function NavLink({ href, icon, active, count, children }) {
  return (
    <a class={`nav-item${active ? ' active' : ''}`} href={href}>
      <Icon name={icon} /> {children}
      {count > 0 && <span class="count">{count}</span>}
    </a>
  );
}

function SiteSwitcher({ sites, current, view }) {
  if (sites.length < 2) {
    return (
      <div class="site-switch" style={{ cursor: 'default' }}>
        <SiteLabel site={current} />
      </div>
    );
  }
  return (
    <>
      <label class="sr-only" for="site-select">Site</label>
      <select id="site-select" class="site-switch" value={current.id} onChange={(e) => navigate(`/site/${e.currentTarget.value}/${view}`)}>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>{s.label}{s.demo ? ' (demo)' : ''}</option>
        ))}
      </select>
    </>
  );
}

function SiteLabel({ site }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div class="host">{site.label}</div>
      <div class="sub">{site.demo ? 'Sample data' : site.host}</div>
    </div>
  );
}

function resolvedTheme(theme, systemDark) {
  return theme || (systemDark ? 'dark' : 'light');
}

function useSystemDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const onChange = () => setDark(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return dark;
}
