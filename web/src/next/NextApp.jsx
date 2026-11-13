import { useEffect, useState } from 'preact/hooks';
import { usePersistent } from '../hooks.js';
import { Icon } from '../components/icons.jsx';
import { Logo } from '../components/Logo.jsx';
import { ErrorState } from '../components/ui.jsx';
import { Calendar } from '../pages/Calendar.jsx';
import { Setup } from '../pages/Setup.jsx';
import { SiteAccess } from './SiteAccess.jsx';
import { Settings } from '../pages/Settings.jsx';
import { Outcomes } from '../pages/Outcomes.jsx';
import { Extensions } from '../pages/Extensions.jsx';
import { Health } from '../pages/Health.jsx';
import { useUnreadAlerts } from '../pages/Alerts.jsx';
import { AlertsPage, AlertSettings } from './Alerts.jsx';
import { GitHub } from '../pages/GitHub.jsx';
import { Posts } from '../pages/Posts.jsx';
import { Mentions } from '../pages/Mentions.jsx';
import { Page } from './Page.jsx';
import { LeaveOut } from './LeaveOut.jsx';
import { JourneysPage } from './Journeys.jsx';
import { Sites, ADD_SITE } from './Sites.jsx';
import { Story } from './Story.jsx';
import { OutcomesPage } from './Outcomes.jsx';
import { ExploreFrame, EXPLORE_TABS } from './Explore.jsx';
import { TodosPage, useTodos } from '../components/Todos.jsx';
import './next.css';

// The story-first layout: Sites → one site's Story, its Timeline, Explore for
// every full report, and Setup. It lives beside the classic layout (App.jsx)
// and reuses its pages, so nothing has to be rebuilt to fit in.
// Routes: #/ · #/site/<id>[/story|todos|outcomes|timeline|explore|setup|<explore view>] · #/todos · #/account
// Classic routes (#/calendar, #/settings, #/outcomes…) still open here.
const WIDE = { outcomes: Outcomes, extensions: Extensions, github: GitHub, posts: Posts, mentions: Mentions };

export function NextApp({ state, route, onClassic, onTheme, themeIcon, onReload }) {
  const { sites, auth } = state;
  const [lastSite, setLastSite] = usePersistent('site', 'demo');
  const [section, siteId, view = 'story'] = route.parts;
  const site = section === 'site' ? sites.find((s) => s.id === siteId) : null;
  const current = site || sites.find((s) => s.id === route.params.get('site')) || sites.find((s) => s.id === lastSite) || sites[0];
  useEffect(() => {
    if (site && site.id !== lastSite) setLastSite(site.id);
  }, [site?.id]);
  // Phones: the sidebar folds into a top bar, and the menu closes once you go somewhere.
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [route.parts.join('/'), route.params.toString()]);

  const todos = useTodos({ status: 'open' });
  const alertCounts = useUnreadAlerts();
  const openFor = (id) => (todos.data?.todos || []).filter((t) => t.site === id).length;
  const story = current ? { href: `#/site/${current.id}${route.params.get('range') ? `?range=${route.params.get('range')}` : ''}`, label: `${current.label} story` } : null;

  const tab = !section ? 'sites'
    : section === 'todos' ? 'todos'
    : section === 'site' ? (view === 'journeys' || view === 'outcomes' ? 'story' : ['story', 'todos', 'alerts', 'timeline', 'setup'].includes(view) ? view : 'explore')
    : section === 'calendar' ? 'timeline'
    : section === 'alerts' ? 'alerts'
    : (section === 'settings' || section === 'account') && (route.params.get('tab') === 'mcp' || route.params.get('i') === 'mcp') ? 'mcp'
    : section === 'settings' || section === 'account' ? 'account'
    : 'explore';

  let body;
  if (!section) body = <Sites sites={sites} auth={auth} viewer={state.viewer} />;
  else if (section === 'site' && !site) body = <ErrorState error={{ message: 'That site was removed or never existed.' }} />;
  else if (section === 'site' && view === 'story') body = <Story key={site.id} site={site} params={route.params} />;
  else if (section === 'site' && view === 'journeys') body = <JourneysPage key={site.id} site={site} params={route.params} />;
  else if (section === 'site' && view === 'todos') body = <Page title="To-dos" sub={`Changes to make on ${site.label}`}><TodosPage key={site.id} site={site} sites={sites} /></Page>;
  else if (section === 'site' && view === 'alerts') body = <Page title="Alerts" sub={`What moved on ${site.label}`}><AlertsPage key={site.id} site={site} sites={sites} /></Page>;
  else if (section === 'todos') body = <Page title="To-dos" sub="Every site’s changes to make"><TodosPage sites={sites} /></Page>;
  else if (section === 'site' && view === 'outcomes') body = <OutcomesPage key={site.id} site={site} params={route.params} back={story} />;
  else if (section === 'site' && view === 'timeline') body = <Page title="Timeline" sub="Every day, and what shipped on it"><Calendar sites={sites} params={withSite(route.params, site.id)} /></Page>;
  else if (section === 'calendar') body = <Page title="Timeline" sub="Every day, and what shipped on it"><Calendar sites={sites} params={route.params} /></Page>;
  else if (section === 'site' && view === 'setup' && site.shared) body = <ErrorState error={{ message: `Setup is for ${site.shared.by}, who shared ${site.label} with you to view.` }} />;
  else if (section === 'site' && view === 'setup') body = <Page title="Setup" sub={`What Studio reads and measures for ${site.label}`}>{!site.demo && <SiteAccess site={site} hosted={state.hosted} />}<LeaveOut site={site} onSaved={onReload} /><Setup site={site} /></Page>;
  else if (section === 'site') body = <ExploreFrame site={site} view={view} params={route.params} auth={auth} ranges={state.ranges} />;
  else if (section === 'settings' || section === 'account') body = <Page title="Account" sub="Sign-ins and keys, once for all your sites"><Settings state={state} params={route.params} onChange={onReload} /></Page>;
  else if (section === 'health') body = <Page title="Site health"><Health sites={sites} params={route.params} /></Page>;
  else if (section === 'alerts' && route.params.get('view') === 'settings') body = <Page title="Alert settings" sub="What to watch on every site, and where alerts go" back={{ href: '#/alerts', label: 'All alerts' }}><AlertSettings /></Page>;
  else if (section === 'alerts') body = <Page title="All alerts" sub="What moved on every site"><AlertsPage sites={sites} /></Page>;
  else if (WIDE[section]) {
    const View = WIDE[section];
    body = <Page title={section[0].toUpperCase() + section.slice(1)} back={story}><View id={siteId} range={route.params.get('range') || '28d'} params={route.params} onChange={() => {}} sync={state.sources?.github} onSynced={() => {}} /></Page>;
  } else body = <ErrorState error={{ message: 'This page isn’t in the new layout yet.' }} />;

  const href = (t) => (t === 'story' ? `#/site/${current.id}` : t === 'explore' ? `#/site/${current.id}/${EXPLORE_TABS[0].key}` : `#/site/${current.id}/${t}`);

  return (
    <div class="nx">
      <aside class={`nx-side${menu ? ' open' : ''}`}>
        <div class="nx-side-top">
          <a class="nx-brand" href="#/" aria-label="SiteLens Studio, all sites">
            <Logo size={26} title="" />
            <span>SiteLens <span class="nx-dim">Studio</span></span>
          </a>
          <button type="button" class="nx-icon-btn nx-menu-btn" onClick={() => setMenu(!menu)}
            aria-expanded={menu} aria-controls="nx-side-body" aria-label={menu ? 'Close menu' : 'Open menu'}>
            <Icon name={menu ? 'x' : 'menu'} />
          </button>
        </div>
        <div class="nx-side-body" id="nx-side-body">
        <nav class="nx-nav" aria-label="Main">
          <NavItem href="#/" icon="grid" active={tab === 'sites'}>Sites <span class="nx-count">{sites.length}</span></NavItem>
          <NavItem href="#/todos" icon="check" active={section === 'todos'}>All to-dos {todos.data?.open ? <span class="nx-count">{todos.data.open}</span> : null}</NavItem>
          <NavItem href="#/alerts" icon="bell" active={section === 'alerts'}>All alerts {alertCounts.unread ? <span class="nx-count">{alertCounts.unread}</span> : null}</NavItem>
          {!state.viewer && <NavItem href={ADD_SITE} icon="plus" active={section === 'account' && route.params.get('edit') === 'new'}>Add a site</NavItem>}
        </nav>
        {current && (
          <>
            <label class="nx-label" for="nx-site">Site</label>
            <select id="nx-site" class="nx-site" value={current.id}
              onChange={(e) => { location.hash = `/site/${e.currentTarget.value}/${tab === 'sites' || tab === 'account' || tab === 'mcp' ? 'story' : tab === 'explore' ? view : tab}`; }}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.label}{s.demo ? ' (sample)' : s.shared ? ' (shared with you)' : ''}</option>)}
            </select>
            {current.shared && <p class="nx-shared" title={`Shared by ${current.shared.by}`}><Icon name="eye" size={13} /> View only · shared by {current.shared.by}</p>}
            <nav class="nx-nav" aria-label={current.label}>
              <NavItem href={href('story')} icon="sparkles" active={tab === 'story'}>Story</NavItem>
              <NavItem href={href('todos')} icon="check" active={tab === 'todos' && section === 'site'}>To-dos {openFor(current.id) ? <span class="nx-count">{openFor(current.id)}</span> : null}</NavItem>
              <NavItem href={href('alerts')} icon="bell" active={tab === 'alerts' && section === 'site'}>Alerts {alertCounts.bySite[current.id] ? <span class="nx-count">{alertCounts.bySite[current.id]}</span> : null}</NavItem>
              <NavItem href={href('timeline')} icon="calendar" active={tab === 'timeline'}>Timeline</NavItem>
              <NavItem href={href('explore')} icon="layers" active={tab === 'explore'}>Explore</NavItem>
              {!current.shared && <NavItem href={href('setup')} icon="settings" active={tab === 'setup'}>Setup</NavItem>}
            </nav>
          </>
        )}
        <div class="nx-foot">
          {!state.viewer && <NavItem href="#/account?tab=mcp" icon="terminal" active={tab === 'mcp'}>MCP</NavItem>}
          {!state.viewer && <NavItem href="#/account" icon="lock" active={tab === 'account'}>Account</NavItem>}
          <div class="nx-foot-row">
            {state.viewer ? <span class="nx-conn"><Icon name="eye" size={13} /> Viewing shared sites</span> : (
            <span class="nx-conn" title={auth.email || ''}>
              <span class={`nx-dot${auth.connected && !auth.expired ? ' on' : ''}`} aria-hidden="true" />
              {auth.connected ? (auth.expired ? 'Token expired' : 'Google connected') : 'Not connected'}
            </span>)}
            <button type="button" class="nx-icon-btn" onClick={onTheme} aria-label="Switch theme" title="Switch theme"><Icon name={themeIcon} /></button>
          </div>
          {!state.hosted && <button type="button" class="nx-switch" onClick={onClassic}>Back to the classic layout</button>}
          {state.hosted && (
            <form method="post" action="/logout">
              <button type="submit" class="nx-switch nx-signout">Sign out</button>
            </form>
          )}
        </div>
        </div>
      </aside>
      <main class="nx-main">{body}</main>
    </div>
  );
}

function NavItem({ href, icon, active, children }) {
  return (
    <a class={`nx-item${active ? ' active' : ''}`} href={href} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} size={16} /> <span>{children}</span>
    </a>
  );
}

function withSite(params, id) {
  const next = new URLSearchParams(params);
  if (!next.get('site')) next.set('site', id);
  return next;
}
