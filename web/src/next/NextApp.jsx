import { useEffect } from 'preact/hooks';
import { usePersistent } from '../hooks.js';
import { Icon } from '../components/icons.jsx';
import { Logo } from '../components/Logo.jsx';
import { ErrorState } from '../components/ui.jsx';
import { Calendar } from '../pages/Calendar.jsx';
import { Setup } from '../pages/Setup.jsx';
import { Settings } from '../pages/Settings.jsx';
import { Outcomes } from '../pages/Outcomes.jsx';
import { Extensions } from '../pages/Extensions.jsx';
import { Health } from '../pages/Health.jsx';
import { Alerts } from '../pages/Alerts.jsx';
import { GitHub } from '../pages/GitHub.jsx';
import { Posts } from '../pages/Posts.jsx';
import { Mentions } from '../pages/Mentions.jsx';
import { Page } from './Page.jsx';
import { Sites } from './Sites.jsx';
import { Story } from './Story.jsx';
import { ExploreFrame, EXPLORE_TABS } from './Explore.jsx';
import './next.css';

// The story-first layout: Sites → one site's Story, its Timeline, Explore for
// every full report, and Setup. It lives beside the classic layout (App.jsx)
// and reuses its pages, so nothing has to be rebuilt to fit in.
// Routes: #/ · #/site/<id>[/story|timeline|explore|setup|<explore view>] · #/account
// Classic routes (#/calendar, #/settings, #/outcomes…) still open here.
const WIDE = { outcomes: Outcomes, extensions: Extensions, github: GitHub, posts: Posts, mentions: Mentions };

export function NextApp({ state, route, onClassic, onTheme, themeIcon }) {
  const { sites, auth } = state;
  const [lastSite, setLastSite] = usePersistent('site', 'demo');
  const [section, siteId, view = 'story'] = route.parts;
  const site = section === 'site' ? sites.find((s) => s.id === siteId) : null;
  const current = site || sites.find((s) => s.id === route.params.get('site')) || sites.find((s) => s.id === lastSite) || sites[0];
  useEffect(() => {
    if (site && site.id !== lastSite) setLastSite(site.id);
  }, [site?.id]);

  const tab = !section ? 'sites'
    : section === 'site' ? (['story', 'timeline', 'setup'].includes(view) ? view : 'explore')
    : section === 'calendar' ? 'timeline'
    : section === 'settings' || section === 'account' ? 'account'
    : 'explore';

  let body;
  if (!section) body = <Sites sites={sites} />;
  else if (section === 'site' && !site) body = <ErrorState error={{ message: 'That site was removed or never existed.' }} />;
  else if (section === 'site' && view === 'story') body = <Story key={site.id} site={site} params={route.params} />;
  else if (section === 'site' && view === 'timeline') body = <Page title="Timeline" sub="Every day, and what shipped on it"><Calendar sites={sites} params={withSite(route.params, site.id)} /></Page>;
  else if (section === 'calendar') body = <Page title="Timeline" sub="Every day, and what shipped on it"><Calendar sites={sites} params={route.params} /></Page>;
  else if (section === 'site' && view === 'setup') body = <Page title="Setup" sub={`What Studio reads and measures for ${site.label}`}><Setup site={site} /></Page>;
  else if (section === 'site') body = <ExploreFrame site={site} view={view} params={route.params} auth={auth} ranges={state.ranges} />;
  else if (section === 'settings' || section === 'account') body = <Page title="Account" sub="Sign-ins and keys, once for all your sites"><Settings state={state} params={route.params} onChange={() => location.reload()} /></Page>;
  else if (section === 'health') body = <Page title="Site health"><Health sites={sites} params={route.params} /></Page>;
  else if (section === 'alerts') body = <Page title="Alerts"><Alerts /></Page>;
  else if (WIDE[section]) {
    const View = WIDE[section];
    body = <Page title={section[0].toUpperCase() + section.slice(1)}><View id={siteId} range={route.params.get('range') || '28d'} params={route.params} onChange={() => {}} sync={state.sources?.github} onSynced={() => {}} /></Page>;
  } else body = <ErrorState error={{ message: 'This page isn’t in the new layout yet.' }} />;

  const href = (t) => (t === 'story' ? `#/site/${current.id}` : t === 'explore' ? `#/site/${current.id}/${EXPLORE_TABS[0].key}` : `#/site/${current.id}/${t}`);

  return (
    <div class="nx">
      <aside class="nx-side">
        <a class="nx-brand" href="#/" aria-label="SiteLens Studio, all sites">
          <Logo size={26} title="" />
          <span>SiteLens <span class="nx-dim">Studio</span></span>
        </a>
        <nav class="nx-nav" aria-label="Main">
          <NavItem href="#/" icon="grid" active={tab === 'sites'}>Sites <span class="nx-count">{sites.length}</span></NavItem>
        </nav>
        {current && (
          <>
            <label class="nx-label" for="nx-site">Site</label>
            <select id="nx-site" class="nx-site" value={current.id}
              onChange={(e) => { location.hash = `/site/${e.currentTarget.value}/${tab === 'sites' || tab === 'account' ? 'story' : tab === 'explore' ? view : tab}`; }}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.label}{s.demo ? ' (sample)' : ''}</option>)}
            </select>
            <nav class="nx-nav" aria-label={current.label}>
              <NavItem href={href('story')} icon="sparkles" active={tab === 'story'}>Story</NavItem>
              <NavItem href={href('timeline')} icon="calendar" active={tab === 'timeline'}>Timeline</NavItem>
              <NavItem href={href('explore')} icon="layers" active={tab === 'explore'}>Explore</NavItem>
              <NavItem href={href('setup')} icon="settings" active={tab === 'setup'}>Setup</NavItem>
            </nav>
          </>
        )}
        <div class="nx-foot">
          <NavItem href="#/account" icon="lock" active={tab === 'account'}>Account</NavItem>
          <div class="nx-foot-row">
            <span class="nx-conn" title={auth.email || ''}>
              <span class={`nx-dot${auth.connected && !auth.expired ? ' on' : ''}`} aria-hidden="true" />
              {auth.connected ? (auth.expired ? 'Token expired' : 'Google connected') : 'Not connected'}
            </span>
            <button type="button" class="nx-icon-btn" onClick={onTheme} aria-label="Switch theme" title="Switch theme"><Icon name={themeIcon} /></button>
          </div>
          <button type="button" class="nx-switch" onClick={onClassic}>Back to the classic layout</button>
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
