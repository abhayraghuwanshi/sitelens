import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { usePersistent, useAsync } from '../hooks.js';
import { api } from '../api.js';
import { Icon } from '../components/icons.jsx';
import { Logo } from '../components/Logo.jsx';
import { ErrorState } from '../components/ui.jsx';
import { Timeline } from './Timeline.jsx';
import { Setup } from '../pages/Setup.jsx';
import { SiteAccess } from './SiteAccess.jsx';
import { Settings } from '../pages/Settings.jsx';
import { Outcomes } from '../pages/Outcomes.jsx';
import { Extensions } from '../pages/Extensions.jsx';
import { Health } from '../pages/Health.jsx';
import { useUnreadAlerts } from '../pages/Alerts.jsx';
import { AlertSettings } from './Alerts.jsx';
import { GitHub } from '../pages/GitHub.jsx';
import { Posts } from '../pages/Posts.jsx';
import { Mentions } from '../pages/Mentions.jsx';
import { Page } from './Page.jsx';
import { LeaveOut } from './LeaveOut.jsx';
import { Sites, ADD_SITE } from './Sites.jsx';
import { Story } from './Story.jsx';
import { useTodos } from '../components/Todos.jsx';
import { LivePage, LiveAll, useLiveCounts } from './Live.jsx';
import { Inbox } from './Inbox.jsx';
import { Section, PickSite } from './Section.jsx';
import { Jump } from './Jump.jsx';
import { SECTIONS, resolve, hrefFor, viewsFor, hasWarehouse, PHONE_TABS, MORE_VIEWS } from './nav.js';
import './next.css';

// The app's one layout (docs/redesign/README.md). One scope switcher (a site, or
// All sites), then Story · Inbox · Timeline and the reports: Pages · Search ·
// Traffic · Journeys · Goals. Account sits at the bottom. On phones the sidebar
// becomes a top bar (scope, jump, account) and a tab bar (Story, Inbox, Pages,
// Search, More); the scope list, More and the account menu open as sheets.
// Routes are in nav.js; older links still land in the right place.
const WIDE = { outcomes: Outcomes, extensions: Extensions, github: GitHub, posts: Posts, mentions: Mentions };
const MORE_KEYS = new Set(['timeline', 'traffic', 'journeys', 'goals', 'live', 'raw', 'account']);

export function NextApp({ state, route, onTheme, themeIcon, onReload }) {
  const { sites, auth } = state;
  const [lastSite, setLastSite] = usePersistent('site', 'demo');
  const { scope, view, tab } = resolve(route.parts, route.params);
  const site = scope === 'all' ? null : sites.find((s) => s.id === scope) || null;
  useEffect(() => {
    if (site && site.id !== lastSite) setLastSite(site.id);
  }, [site?.id]);

  // One open overlay at a time: 'scopes' | 'user' | 'more' | 'jump'. Going anywhere closes it.
  const [pop, setPop] = useState(null);
  const where = route.parts.join('/') + route.params.toString();
  useEffect(() => { setPop(null); }, [where]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPop((p) => (p === 'jump' ? null : 'jump')); }
      else if (e.key === 'Escape') setPop(null);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const toggle = (name) => setPop((p) => (p === name ? null : name));

  // Setup moved onto the site's Edit page; the sample site can't be edited, so it keeps a read-only page.
  const setupMoved = view === 'setup' && site && !site.demo && !site.shared;
  useEffect(() => {
    if (setupMoved) location.replace(`#/account?tab=sites&edit=${encodeURIComponent(site.id)}`);
  }, [setupMoved, site?.id]);

  const todos = useTodos({ status: 'open' });
  // Goals saved on pages, every site: the ones behind wait in the Inbox too.
  const goals = useAsync(() => Promise.all(sites.map((s) => api.get(`/sites/${s.id}/goals`).then((r) => r.goals, () => []))).then((all) => all.flat()), [sites.map((s) => s.id).join()]);
  const behindFor = (id) => (goals.data || []).filter((g) => g.status === 'behind' && (!id || g.site === id)).length;
  const alertCounts = useUnreadAlerts();
  const live = useLiveCounts(sites);
  const openTodos = (id) => (todos.data?.todos || []).filter((t) => !id || t.site === id).length;
  const unread = (id) => (id ? alertCounts.bySite[id] || 0 : alertCounts.unread || 0);
  const waiting = (id) => openTodos(id) + unread(id) + behindFor(id);
  const liveFor = (id) => (id ? live.bySite[id] : live.total);
  const scopeId = site?.id || 'all';
  const editHref = (s) => `#/account?tab=sites&edit=${encodeURIComponent(s.id)}`;

  let body;
  if (scope !== 'all' && !site) body = <ErrorState error={{ message: 'That site was removed or never existed.' }} />;
  else if (view === 'account') body = <Page title="Account" sub="Sites, sign-ins and keys, once for all your sites"><Settings state={state} params={route.params} onChange={onReload} siteExtras={siteExtras} siteMeasures={siteMeasures} /></Page>;
  else if (view === 'alert-settings') body = <Page title="Alert settings" sub="What to watch on every site, and where alerts go" back={{ href: '#/inbox?tab=alerts', label: 'Inbox' }}><AlertSettings /></Page>;
  else if (view === 'inbox') body = <Inbox site={site} sites={sites} tab={tab} params={route.params} counts={{ alerts: unread(site?.id), todos: openTodos(site?.id) }} goals={goals} />;
  else if (view === 'live') body = site
    ? <Page title="Live" sub={`Who is on ${site.label} right now`}><LivePage key={site.id} site={site} /></Page>
    : <Page title="Live now" sub="Every site, right now"><LiveAll sites={sites} live={live} /></Page>;
  else if (view === 'timeline') body = <Timeline key={site?.id || 'all'} site={site} sites={sites} params={route.params} />;
  else if (view === 'story') body = site ? <Story key={site.id} site={site} params={route.params} /> : <Sites sites={sites} auth={auth} viewer={state.viewer} />;
  else if (view === 'setup' && site?.shared) body = <ErrorState error={{ message: `Settings are for ${site.shared.by}, who shared ${site.label} with you to view.` }} />;
  else if (setupMoved) body = null;
  else if (view === 'setup' && site) body = <Page title="What Kauzl measures" sub={`${site.label} is sample data, so this is read-only`}><Setup site={site} /></Page>;
  else if (SECTIONS[view] && !site) body = <PickSite view={view} sites={sites} />;
  else if (SECTIONS[view] && (view === 'journeys' || view === 'raw') && !hasWarehouse(site)) body = <Page title={SECTIONS[view].label}><p class="muted">{view === 'raw' ? 'Raw data' : 'Journeys'} need the site’s GA4 BigQuery export. Connect it in the <a href={editHref(site)}>site’s settings</a>.</p></Page>;
  else if (SECTIONS[view]) body = <Section key={`${site.id}:${view}`} view={view} tab={tab} site={site} params={route.params} auth={auth} ranges={state.ranges} />;
  else if (view === 'health') body = <Page title="Site health"><Health sites={sites} params={route.params} /></Page>;
  else if (WIDE[view]) {
    const View = WIDE[view];
    body = <Page title={view[0].toUpperCase() + view.slice(1)}><View id={route.parts[1]} range={route.params.get('range') || '28d'} params={route.params} onChange={() => {}} sync={state.sources?.github} onSynced={() => {}} /></Page>;
  } else body = <ErrorState error={{ message: 'There’s nothing at this address.' }} />;

  // Inside an existing site's Edit form: what Kauzl measures (goals, funnels, search, alerts).
  function siteMeasures(s) {
    return <Setup site={s} connections={false} />;
  }
  // Under it: who can see the site, and which visits it leaves out.
  function siteExtras(s) {
    return <><SiteAccess site={s} hosted={state.hosted} /><LeaveOut site={s} onSaved={onReload} /></>;
  }

  // Switching scope keeps the view where the new scope has it.
  const keep = view === 'account' || view === 'alert-settings' || view === 'health' || view === 'setup' || WIDE[view] ? 'story' : view;
  const scopeHref = (id) => {
    const s = sites.find((x) => x.id === id);
    const v = (keep === 'journeys' || keep === 'raw') && s && !hasWarehouse(s) ? 'story' : keep;
    return hrefFor(id, v, v === view ? tab : '');
  };
  const views = viewsFor(site);
  const conn = state.demo
    ? (sites.some((s) => s.showcase) ? 'Live demo · view only' : 'Demo · sample data')
    : state.viewer ? 'Viewing shared sites'
    : auth.connected ? (auth.expired ? 'Google sign-in expired' : auth.broken ? 'Google needs you' : 'Google connected') : 'Google not connected';
  const connOn = !state.demo && !state.viewer && auth.connected && !auth.expired && !auth.broken;
  const connBad = !state.demo && !state.viewer && auth.connected && (auth.expired || auth.broken);

  const scopeBtn = (phone) => (
    <button type="button" class="nx-scope" onClick={() => toggle('scopes')} aria-expanded={pop === 'scopes'} aria-haspopup="true">
      <Logo size={phone ? 24 : 28} title="" />
      <span class="nx-who"><b>{site ? site.label : 'All sites'}</b><small>{site ? (site.demo ? 'Sample data' : site.shared ? `Shared by ${site.shared.by}` : site.host || site.id) : `${sites.length} site${sites.length === 1 ? '' : 's'}`}</small></span>
      <Icon name="updown" size={15} />
    </button>
  );

  const scopeRows = (
    <div class="nx-pop-list" role="menu">
      <a role="menuitem" class={`nx-pop-row${!site ? ' on' : ''}`} href={scopeHref('all')}>
        <Icon name="grid" /><b>All sites</b><span class="nx-pop-meta">{liveFor() != null && <span>{liveFor()} now</span>}</span>
      </a>
      <hr />
      {sites.map((s) => (
        <div key={s.id} class={`nx-pop-row nx-pop-site${site?.id === s.id ? ' on' : ''}`}>
          <a role="menuitem" class="nx-pop-main" href={scopeHref(s.id)}>
            <span class={`nx-live-dot${liveFor(s.id) ? ' on' : ''}`} aria-hidden="true" />
            <span class="nx-pop-name">{s.label}{s.demo ? <span class="muted"> · sample</span> : s.shared ? <span class="muted"> · shared</span> : null}</span>
            <span class="nx-pop-meta">
              {[liveFor(s.id) != null && `${liveFor(s.id)} now`, waiting(s.id) && `${waiting(s.id)} waiting`].filter(Boolean).join(' · ')}
            </span>
          </a>
          {!state.viewer && !s.demo && !s.shared && (
            <a class="nx-pop-gear" href={editHref(s)} aria-label={`${s.label} settings`} title="Site settings"><Icon name="settings" size={14} /></a>
          )}
        </div>
      ))}
      {!state.viewer && <><hr /><a role="menuitem" class="nx-pop-row" href={ADD_SITE}><Icon name="plus" />Add a site</a></>}
    </div>
  );

  const userRows = (
    <div class="nx-pop-list" role="menu">
      {!state.viewer && <a role="menuitem" class="nx-pop-row" href="#/account"><Icon name="plug" />Sites and sign-ins</a>}
      {!state.viewer && <a role="menuitem" class="nx-pop-row" href="#/account?tab=mcp"><Icon name="terminal" />Connect Claude (MCP)</a>}
      <button type="button" role="menuitem" class="nx-pop-row" onClick={() => { onTheme(); setPop(null); }}><Icon name={themeIcon} />{themeIcon === 'sun' ? 'Light theme' : 'Dark theme'}</button>
      {state.hosted && (
        <>
          <hr />
          <form method="post" action="/logout">
            <button type="submit" role="menuitem" class="nx-pop-row"><Icon name="out" />{state.demo ? 'Leave demo' : 'Sign out'}</button>
          </form>
        </>
      )}
    </div>
  );

  const liveN = liveFor(site?.id);
  const morePanel = (
    <div class="nx-more-sheet">
      <span class="nx-more-head">{site ? site.label : 'All sites'}</span>
      <a class={`nx-mlive${view === 'live' ? ' on' : ''}`} href={hrefFor(scopeId, 'live')}>
        <span class={`nx-live-dot${liveN ? ' on' : ''}`} aria-hidden="true" />
        <span><b>{liveN == null ? 'Live' : `${liveN} on now`}</b><small>Who is on {site ? site.label : 'your sites'} right now</small></span>
        <span class="nx-mlive-go">See who →</span>
      </a>
      <div class="nx-mtiles">
        {MORE_VIEWS.filter((v) => !v.warehouse || hasWarehouse(site)).map((v) => (
          <a key={v.key} class={`nx-mtile${view === v.key ? ' on' : ''}`} href={hrefFor(scopeId, v.key)}>
            <span class="nx-mti"><Icon name={v.icon} size={18} /></span><b>{v.label}</b><small>{v.fact}</small>
          </a>
        ))}
      </div>
      <div class="nx-pop-list nx-mrows">
        {site && hasWarehouse(site) && <a class="nx-pop-row" href={hrefFor(site.id, 'raw', 'events')}><Icon name="layers" />Raw data<span class="nx-pop-meta">Events, SQL</span></a>}
        {!state.viewer && <a class="nx-pop-row" href="#/account"><Icon name="settings" />Account<span class="nx-pop-meta">Sites, sign-ins, keys</span></a>}
      </div>
    </div>
  );

  const inMore = MORE_KEYS.has(view);
  const moreView = MORE_VIEWS.find((v) => v.key === view) || (view === 'live' ? { icon: 'pulse', label: 'Live' } : view === 'raw' ? { icon: 'layers', label: 'Raw data' } : view === 'account' ? { icon: 'settings', label: 'Account' } : null);
  const inboxN = waiting(site?.id);

  return (
    <div class="nx">
      {/* Desktop */}
      <aside class="nx-side">
        <div class="nx-anchor">
          {scopeBtn(false)}
          {pop === 'scopes' && <div class="nx-pop nx-pop-scopes">{scopeRows}</div>}
        </div>
        {site?.shared && <p class="nx-shared" title={`Shared by ${site.shared.by}`}><Icon name="eye" size={13} /> View only · shared by {site.shared.by}</p>}
        <a class={`nx-livelink${view === 'live' ? ' on' : ''}`} href={hrefFor(scopeId, 'live')}>
          <span class={`nx-live-dot${liveN ? ' on' : ''}`} aria-hidden="true" />
          <span>{liveN == null ? 'Live' : <><b>{liveN}</b> on now</>}</span>
          <span class="nx-livelink-go">See who →</span>
        </a>
        <button type="button" class="nx-jump" onClick={() => toggle('jump')}>
          <Icon name="search" size={14} />Jump to…<kbd>⌘K</kbd>
        </button>
        <nav class="nx-nav" aria-label="Views">
          {views.map((v) => (
            <Fragment key={v.key}>
              {v.key === 'pages' && <span class="nx-label">Reports</span>}
              <NavItem href={hrefFor(scopeId, v.key)} icon={v.icon} active={view === v.key || (v.key === 'journeys' && view === 'raw')}>
                {v.key === 'story' && !site ? 'Sites' : v.label}
                {v.key === 'inbox' && inboxN ? <span class="nx-count">{inboxN}</span> : null}
              </NavItem>
            </Fragment>
          ))}
        </nav>
        <div class="nx-foot nx-anchor">
          {pop === 'user' && <div class="nx-pop nx-pop-user">{userRows}</div>}
          <button type="button" class={`nx-me${view === 'account' ? ' on' : ''}`} onClick={() => toggle('user')} aria-expanded={pop === 'user'} aria-haspopup="true">
            <span class="nx-avatar" aria-hidden="true">{initial(auth, state)}</span>
            <span class="nx-who"><b>{state.viewer ? 'Viewer' : 'Account'}</b><small class={connBad ? 'bad' : undefined}><span class={`nx-dot${connOn ? ' on' : connBad ? ' bad' : ''}`} aria-hidden="true" />{conn}</small></span>
          </button>
        </div>
      </aside>

      {/* Phone */}
      <header class="nx-ptop">
        {scopeBtn(true)}
        <button type="button" class="nx-icon-btn nx-ptop-btn" onClick={() => toggle('jump')} aria-label="Jump to"><Icon name="search" size={16} /></button>
        <button type="button" class="nx-avatar nx-ptop-btn" onClick={() => toggle('user')} aria-label="Account and theme" aria-expanded={pop === 'user'}>{initial(auth, state)}</button>
      </header>

      <main class="nx-main">{state.demo && <DemoBanner site={sites.find((s) => s.showcase)} />}{body}</main>

      <nav class="nx-tabbar" aria-label="Views">
        {PHONE_TABS.map((k) => {
          const v = views.find((x) => x.key === k);
          return (
            <a key={k} href={hrefFor(scopeId, k)} class={view === k ? 'on' : undefined} aria-current={view === k ? 'page' : undefined}>
              <Icon name={v.icon} size={21} />
              {k === 'inbox' && inboxN ? <span class="nx-badge">{inboxN}</span> : null}
              <span>{k === 'story' && !site ? 'Sites' : v.label}</span>
            </a>
          );
        })}
        <button type="button" class={inMore || pop === 'more' ? 'on' : undefined} onClick={() => toggle('more')} aria-expanded={pop === 'more'}>
          <Icon name={inMore && moreView && pop !== 'more' ? moreView.icon : 'more'} size={21} />
          <span>{inMore && moreView && pop !== 'more' ? moreView.label : 'More'}</span>
        </button>
      </nav>

      {(pop === 'scopes' || pop === 'more' || pop === 'user') && (
        <div class="nx-sheet-wrap">
          <div class="nx-scrim" onClick={() => setPop(null)} />
          <div class="nx-sheet" role="dialog" aria-modal="true" aria-label={pop === 'scopes' ? 'Sites' : pop === 'more' ? 'More' : 'Account'}>
            <span class="nx-grab" aria-hidden="true" />
            {pop === 'scopes' ? scopeRows : pop === 'more' ? morePanel : userRows}
          </div>
        </div>
      )}
      {pop === 'jump' && <Jump sites={sites} scope={scopeId} viewer={state.viewer} onClose={() => setPop(null)} />}
    </div>
  );
}

const initial = (auth, state) => (state.viewer ? 'V' : (auth.email || 'A')[0].toUpperCase());

// The public demo (kauzl.com/demo, server/hosted.mjs): say what this is and how to get your own.
// With a showcase site (DEMO_SITE) it's a real site's live numbers; otherwise sample data.
function DemoBanner({ site }) {
  return (
    <div class="nx-demo" role="note">
      {site
        ? <p class="m-0"><strong>You’re looking at {site.host || site.label}’s own analytics</strong>, live: its traffic, searches, sitemap pages and AI answers. View only.</p>
        : <p class="m-0"><strong>You’re looking around the demo.</strong> The numbers are sample data, and nothing here can be changed.</p>}
      <div class="nx-demo-actions">
        <a class="btn primary" href="/login">Sign in</a>
        <a class="btn" href="/home">About Kauzl</a>
      </div>
    </div>
  );
}

function NavItem({ href, icon, active, children }) {
  return (
    <a class={`nx-item${active ? ' active' : ''}`} href={href} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} size={16} /> <span class="nx-item-text">{children}</span>
    </a>
  );
}
