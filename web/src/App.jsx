import { useEffect, useState } from 'preact/hooks';
import { api } from './api.js';
import { useRoute, useAsync, usePersistent, useLoading, navigate, withParam } from './hooks.js';
import { Icon } from './components/icons.jsx';
import { Logo } from './components/Logo.jsx';
import { Segmented, Loading, ErrorState } from './components/ui.jsx';
import { Portfolio } from './pages/Portfolio.jsx';
import { Overview } from './pages/Overview.jsx';
import { Pages } from './pages/Pages.jsx';
import { Articles } from './pages/Articles.jsx';
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
import { STAGES, EXPLORE, stageHref, locate, nextStage } from './stages.js';
import { ExploreHome } from './pages/ExploreHome.jsx';
import { StagePage } from './pages/Stage.jsx';
import { Setup } from './pages/Setup.jsx';

// Per-site views. mode: which connection a view needs. API views share the GA4 range list; warehouse views use 7/28/90d.
// Where each one sits in the sidebar is decided by STAGES (stages.js).
export const VIEWS = [
  { key: 'overview', label: 'Overview', mode: 'api', component: Overview },
  { key: 'pages', label: 'Pages', mode: 'api', component: Pages },
  { key: 'articles', label: 'My articles', mode: 'content', component: Articles },
  { key: 'search', label: 'Google search', mode: 'search', component: Search },
  { key: 'bing', label: 'Bing search', mode: 'bing', component: Bing },
  { key: 'ai', label: 'AI search', mode: 'api', component: AiSearch },
  { key: 'demand', label: 'Search demand', mode: 'search', component: Demand },
  { key: 'paths', label: 'Paths', mode: 'warehouse', component: Paths },
  { key: 'funnels', label: 'Funnels', mode: 'warehouse', component: Funnels },
  { key: 'retention', label: 'Retention', mode: 'warehouse', component: Retention },
  { key: 'events', label: 'Events', mode: 'warehouse', component: Events },
  { key: 'sessions', label: 'Sessions', mode: 'warehouse', component: Sessions },
  { key: 'sql', label: 'SQL console', mode: 'warehouse', component: Explore },
  { key: 'setup', label: 'Setup', mode: 'setup', component: Setup },
  { key: 'explore', label: 'Explore', mode: 'explore', component: ExploreHome },
  // Each numbered stage's summary page, at #/site/<id>/<stage key>.
  ...STAGES.filter((s) => s.step).map((s) => ({ key: s.key, label: s.label, mode: 'stage', component: (props) => <StagePage {...props} stage={s} /> })),
];


export function App() {
  const route = useRoute();
  const state = useAsync(() => api.get('/state'), []);
  const [range, setRange] = usePersistent('range', '28d');
  const [theme, setTheme] = usePersistent('theme', '');
  const [lastSite, setLastSite] = usePersistent('site', 'demo');
  const systemDark = useSystemDark();
  const loading = useLoading();
  // After a range switch, dim the old numbers until the new ones arrive.
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    if (!loading.busy) setSwitching(false);
  }, [loading.busy]);

  // Opening a link with ?range= makes it the remembered range too (Health has its own ranges).
  const linkedRange = route.parts[0] !== 'health' ? route.params.get('range') : null;
  useEffect(() => {
    if (linkedRange) setRange(linkedRange);
  }, [linkedRange]);

  const routedSite = route.parts[0] === 'site' ? route.parts[1] : '';
  useEffect(() => {
    if (routedSite) setLastSite(routedSite);
  }, [routedSite]);

  const here = locate(route.parts[0] || '', route.parts[0] === 'site' ? route.parts[2] || 'overview' : '');
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
  const showRange = section !== 'settings' && section !== 'health' && section !== 'calendar' && !(section === 'site' && (view.mode === 'setup' || view.mode === 'explore'));
  const urlRange = showRange ? route.params.get('range') : '';
  const wanted = urlRange && rangeOptions.some((r) => r.key === urlRange) ? urlRange : range;
  const effectiveRange = rangeOptions.some((r) => r.key === wanted) ? wanted : '28d';
  const pickRange = (key) => {
    if (key === effectiveRange) return;
    setSwitching(true);
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

  // Site not found keeps its own title, even though its view key belongs to a stage.
  const stage = section === 'site' && !site ? null : here.stage;
  const stageLink = (s) => stageHref(s, current);
  const next = stage && nextStage(stage);
  // A stage's own page (numbered stages and Explore), or one of the pages it opens.
  const summary = Boolean(stage && !here.tab);
  const detail = Boolean(stage && here.tab && stage.key !== 'overview');

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
          </nav>
        </div>

        {current && (
          <div class="nav-group">
            <div class="nav-label">Journey</div>
            <SiteSwitcher sites={sites} current={current} view={section === 'site' ? view.key : 'overview'} />
            <nav class="nav-group stage-nav" aria-label={`${current.label} journey`} style={{ marginTop: '6px' }}>
              {STAGES.map((s) => (
                <a key={s.key} class={`nav-item${stage === s ? ' active' : ''}`} href={stageLink(s)} title={s.question}
                  aria-current={stage === s ? 'page' : undefined}>
                  {s.step ? <span class="step-num" aria-hidden="true">{s.step}</span> : <Icon name={s.icon} />}
                  <span class="stage-text">
                    {s.label}
                    {s.step && <small>{s.question}</small>}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        )}

        {current && (
          <div class="nav-group">
            <div class="nav-label">Go deeper</div>
            <NavLink href={stageLink(EXPLORE)} icon={EXPLORE.icon} active={stage === EXPLORE}>{EXPLORE.label}</NavLink>
          </div>
        )}
        </div>

        <div class="sidebar-foot">
          <AlertsNavItem active={section === 'alerts'} />
          {current && (
            <NavLink href={`#/site/${current.id}/setup`} icon="layers" active={section === 'site' && view.key === 'setup'}>Setup</NavLink>
          )}
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
            <h1>
              {summary && stage.step && <span class="step-num" aria-hidden="true">{stage.step}</span>}
              {summary || !stage ? (stage ? stage.label : title) : here.tab.label}
            </h1>
            {(stage || (section === 'site' && site)) && (
              <div class="crumb">
                {detail && <><a href={stageLink(stage)}>← {stage.step ? `${stage.step}. ` : ''}{stage.label}</a>{site && ' · '}</>}
                {[summary && stage.question, site && `${site.label}${site.demo ? ' · sample data' : ''}`].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <span class="spacer" />
          {loading.shown && <span class="loading-label" role="status">Loading…</span>}
          {showRange && <Segmented label="Date range" value={effectiveRange} options={rangeOptions} onChange={pickRange} />}
          {loading.shown && <span class="loading-bar" aria-hidden="true" />}
        </header>
        <div class={`content${switching && loading.shown ? ' updating' : ''}`} aria-busy={loading.busy ? 'true' : undefined}>
          {body}
          {next && !detail && (
            <a class="next-stage" href={stageLink(next)}>
              <span class="muted small">Next</span>
              <span><span class="step-num" aria-hidden="true">{next.step}</span> {next.label}: {next.question}</span>
              <Icon name="chevron" size={14} />
            </a>
          )}
        </div>
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
