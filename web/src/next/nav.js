// Where everything lives in the app (docs/redesign/README.md → Navigation).
// One scope (a site, or All sites) and one view. Routes:
//   All sites:  #/ (Sites) · #/inbox · #/timeline · #/live · #/<report> (pick a site)
//   One site:   #/site/<id> (its Timeline, the site's home) · #/site/<id>/<view>[?tab=<tab>]
// Older links (#/todos, #/alerts, #/calendar, #/site/<id>/<old report>…) land in
// the right view and tab through LEGACY below.

// View registry. Report routes remain available for Timeline drill-downs.
export const VIEWS = [
  // 'story' is All sites' home: the Sites list. A site's home is its Timeline (Story was removed 2026-11-20).
  { key: 'story', label: 'Sites', icon: 'grid', allOnly: true },
  { key: 'timeline', label: 'Timeline', icon: 'calendar' },
  { key: 'jobs', label: 'Jobs', icon: 'database' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'pages', label: 'Pages', icon: 'pages', report: true },
  { key: 'search', label: 'Search', icon: 'search', report: true },
  { key: 'traffic', label: 'Traffic', icon: 'arrows', report: true },
  { key: 'journeys', label: 'Journeys', icon: 'route', report: true, warehouse: true },
  { key: 'goals', label: 'Goals', icon: 'target', report: true },
  { key: 'diagnose', label: 'Page checks', icon: 'terminal', report: true },
];

// Each report's question and its tabs. Components are attached in Section.jsx.
export const SECTIONS = {
  pages: { label: 'Pages', q: 'Which content works', tabs: [['pages', 'All pages'], ['health', 'Health']] },
  search: { label: 'Search', q: 'How Google, Bing and AI tools show you', tabs: [['queries', 'Searches'], ['ai', 'AI answers']] },
  traffic: { label: 'Traffic', q: 'Where people come from', tabs: [['sources', 'Traffic']] },
  journeys: { label: 'Journeys', q: 'What people do once they’re here', tabs: [['journeys', 'Journeys']] },
  goals: { label: 'Goals', q: 'Is it working', tabs: [['numbers', 'Goals']] },
  // Not in the sidebar: each page's Checks box runs these and links here for all of them.
  diagnose: { label: 'Page checks', q: 'Run a check on a page', tabs: [['run', 'Page checks']] },
  raw: { label: 'Raw data', q: 'Every event, and the warehouse itself', tabs: [['events', 'Events'], ['paths', 'Sessions'], ['sql', 'SQL']] },
};

// Old view names → [view, tab, extra params]. Covers Explore's tabs and the old sidebar.
export const LEGACY = {
  todos: ['inbox', 'todos'],
  alerts: ['inbox', 'alerts'],
  articles: ['pages', 'pages'],
  cycles: ['pages', 'pages'],
  health: ['pages', 'health'],
  search: ['search', 'queries'],
  searches: ['search', 'queries'],
  bing: ['search', 'queries'],
  demand: ['search', 'queries'],
  ai: ['search', 'ai'],
  campaigns: ['traffic', 'sources'],
  overview: ['timeline', ''],
  story: ['timeline', ''],
  posts: ['traffic', 'sources'],
  mentions: ['traffic', 'sources'],
  sessions: ['raw', 'paths'],
  paths: ['raw', 'paths'],
  funnels: ['journeys', 'funnels'],
  routes: ['journeys', 'journeys'],
  retention: ['journeys', 'retention'],
  events: ['raw', 'events'],
  sql: ['raw', 'sql'],
  outcomes: ['goals', 'numbers'],
  explore: ['pages', 'pages'],
};

const VIEW_KEYS = new Set([...VIEWS.map((v) => v.key), 'live', 'raw', 'setup']);

// The route as { scope, view, tab }. `scope` is a site id or 'all'; `view` is a
// VIEWS key, 'live', 'raw', 'setup', 'account' or 'health' (the old all-sites page).
export function resolve(parts, params) {
  const [section, siteId, rawView] = parts;
  if (params.get('section') === 'jobs' && (section === 'timeline' || (section === 'site' && (!rawView || rawView === 'timeline')))) {
    return { scope: section === 'site' ? siteId : 'all', view: 'jobs', tab: '' };
  }
  if (section === 'site') {
    let view = rawView === 'story' ? 'timeline' : rawView || 'timeline';
    let tab = params.get('tab') || '';
    // Pages' old searches view (?view=searches) is Search now.
    if (view === 'pages' && params.get('view') === 'searches') [view, tab] = ['search', 'queries'];
    else if (!VIEW_KEYS.has(view) && LEGACY[view]) {
      // Old links carried their own params (an open article, a funnel); keep them, but not ?tab.
      [view, tab] = [LEGACY[view][0], LEGACY[view][1]];
    }
    // The Story links to one route (?open=); that's the Routes tab, not the default Steps.
    if (view === 'journeys' && !tab && params.get('open')) tab = 'journeys';
    return { scope: siteId, view, tab };
  }
  if (!section) return { scope: 'all', view: 'story', tab: '' };
  if (section === 'calendar') return { scope: params.get('site') || 'all', view: 'timeline', tab: '' };
  if (section === 'todos') return { scope: 'all', view: 'inbox', tab: 'todos' };
  if (section === 'alerts') return { scope: 'all', view: params.get('view') === 'settings' ? 'alert-settings' : 'inbox', tab: 'alerts' };
  if (section === 'settings' || section === 'account') return { scope: 'all', view: 'account', tab: '' };
  // The full uptime and PageSpeed history (?full=1) is still its own page.
  if (section === 'health' && params.get('site') && !params.get('full')) return { scope: params.get('site'), view: 'pages', tab: 'health' };
  if (VIEW_KEYS.has(section)) return { scope: 'all', view: section, tab: params.get('tab') || '' };
  return { scope: 'all', view: section, tab: '' };
}

// The link for a scope + view (+ tab).
export function hrefFor(scope, view, tab = '') {
  const q = tab ? `?tab=${encodeURIComponent(tab)}` : '';
  if (view === 'account') return '#/account';
  if (scope === 'all') return view === 'story' ? '#/' : `#/${view}${q}`;
  return view === 'story' || (view === 'timeline' && !q) ? `#/site/${scope}` : `#/site/${scope}/${view}${q}`;
}

// Views a site shows: Journeys and Raw data need its BigQuery export.
export const hasWarehouse = (site) => !site || site.modes?.warehouse !== false;
export function viewsFor(site) {
  return VIEWS.filter((v) => (!v.warehouse || hasWarehouse(site)) && !(v.allOnly && site) && !(v.key === 'jobs' && site?.shared));
}

// Phone: Timeline and Inbox are the primary tabs.
export const PHONE_TABS = ['timeline', 'inbox'];
export const MORE_VIEWS = [
  { key: 'story', icon: 'grid', label: 'Sites', fact: 'Every site at a glance', allOnly: true },
  { key: 'jobs', icon: 'database', label: 'Jobs', fact: 'Fetch data for Timeline' },
  { key: 'journeys', icon: 'route', label: 'Journeys', fact: 'What people do once here', warehouse: true },
];
