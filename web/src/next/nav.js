// Where everything lives in the app (docs/redesign/README.md → Navigation).
// One scope (a site, or All sites) and one view. Routes:
//   All sites:  #/ (Sites) · #/inbox · #/timeline · #/live · #/<report> (pick a site)
//   One site:   #/site/<id> (Story) · #/site/<id>/<view>[?tab=<tab>]
// Older links (#/todos, #/alerts, #/calendar, #/site/<id>/<old report>…) land in
// the right view and tab through LEGACY below.

// The sidebar, in order. `report` items sit under the "Reports" label.
export const VIEWS = [
  { key: 'story', label: 'Story', icon: 'sparkles' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'timeline', label: 'Timeline', icon: 'calendar' },
  { key: 'pages', label: 'Pages', icon: 'pages', report: true },
  { key: 'search', label: 'Search', icon: 'search', report: true },
  { key: 'traffic', label: 'Traffic', icon: 'arrows', report: true },
  { key: 'journeys', label: 'Journeys', icon: 'route', report: true, warehouse: true },
  { key: 'goals', label: 'Goals', icon: 'target', report: true },
];

// Each report's question and its tabs. Components are attached in Section.jsx.
export const SECTIONS = {
  pages: { label: 'Pages', q: 'Which content works', tabs: [['pages', 'All pages'], ['cycles', 'Content cycles'], ['health', 'Health']] },
  search: { label: 'Search', q: 'How Google, Bing and AI tools show you', tabs: [['queries', 'Searches'], ['ai', 'AI answers']] },
  traffic: { label: 'Traffic', q: 'Where people come from', tabs: [['sources', 'Sources'], ['posts', 'Posts & mentions'], ['overview', 'GA4 summary']] },
  journeys: { label: 'Journeys', q: 'What people do once they’re here', tabs: [['funnels', 'Steps'], ['journeys', 'Routes'], ['paths', 'Paths'], ['retention', 'Retention']] },
  goals: { label: 'Goals', q: 'Is it working', tabs: [['numbers', 'Goals'], ['results', 'Results']] },
  raw: { label: 'Raw data', q: 'Every event, and the warehouse itself', tabs: [['events', 'Events'], ['sql', 'SQL']] },
};

// Old view names → [view, tab, extra params]. Covers Explore's tabs and the old sidebar.
export const LEGACY = {
  todos: ['inbox', 'todos'],
  alerts: ['inbox', 'alerts'],
  articles: ['pages', 'pages'],
  cycles: ['pages', 'cycles'],
  health: ['pages', 'health'],
  search: ['search', 'queries'],
  searches: ['search', 'queries'],
  bing: ['search', 'queries'],
  demand: ['search', 'queries'],
  ai: ['search', 'ai'],
  campaigns: ['traffic', 'sources'],
  overview: ['traffic', 'overview'],
  posts: ['traffic', 'posts'],
  mentions: ['traffic', 'posts'],
  sessions: ['journeys', 'paths'],
  paths: ['journeys', 'paths'],
  funnels: ['journeys', 'funnels'],
  retention: ['journeys', 'retention'],
  events: ['raw', 'events'],
  sql: ['raw', 'sql'],
  outcomes: ['goals', 'results'],
  explore: ['pages', 'pages'],
};

const VIEW_KEYS = new Set([...VIEWS.map((v) => v.key), 'live', 'raw', 'setup']);

// The route as { scope, view, tab }. `scope` is a site id or 'all'; `view` is a
// VIEWS key, 'live', 'raw', 'setup', 'account' or 'health' (the old all-sites page).
export function resolve(parts, params) {
  const [section, siteId, rawView] = parts;
  if (section === 'site') {
    let view = rawView || 'story';
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
  return view === 'story' ? `#/site/${scope}` : `#/site/${scope}/${view}${q}`;
}

// Views a site shows: Journeys and Raw data need its BigQuery export.
export const hasWarehouse = (site) => !site || site.modes?.warehouse !== false;
export function viewsFor(site) {
  return VIEWS.filter((v) => !v.warehouse || hasWarehouse(site));
}

// Phone: four views in the tab bar, the rest in More.
export const PHONE_TABS = ['story', 'inbox', 'pages', 'search'];
export const MORE_VIEWS = [
  { key: 'timeline', icon: 'calendar', label: 'Timeline', fact: 'Every day, and what shipped on it' },
  { key: 'traffic', icon: 'arrows', label: 'Traffic', fact: 'Where people come from' },
  { key: 'journeys', icon: 'route', label: 'Journeys', fact: 'What people do once here', warehouse: true },
  { key: 'goals', icon: 'target', label: 'Goals', fact: 'Is it working' },
];
