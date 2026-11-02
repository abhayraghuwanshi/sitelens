// The sidebar reads top to bottom as a visitor's journey: what you changed and
// who noticed (causes) come before who arrived, what they did and whether it
// paid off (effects). When a number at the bottom moves, walk up to find why.
// A tab is either a site view (`view`, under #/site/<id>/) or a workspace-wide
// page (`section`, its own #/ route). Every tab keeps the URL it always had.
export const STAGES = [
  {
    key: 'overview', label: 'Overview', icon: 'chart', question: 'The whole journey at a glance',
    tabs: [{ view: 'overview', label: 'Overview' }],
  },
  {
    key: 'ship', step: 1, label: 'Ship', icon: 'rocket', question: 'What did we change?',
    tabs: [
      { section: 'github', label: 'GitHub' },
      { section: 'vercel', label: 'Vercel' },
      { section: 'firebase', label: 'Firebase' },
      { section: 'posts', label: 'My posts' },
      { view: 'articles', label: 'My articles' },
      { section: 'health', label: 'Site health', siteParam: true },
    ],
  },
  {
    key: 'found', step: 2, label: 'Get found', icon: 'search', question: 'Who noticed?',
    tabs: [
      { view: 'search', label: 'Google' },
      { view: 'bing', label: 'Bing' },
      { view: 'ai', label: 'AI search' },
      { view: 'demand', label: 'Demand' },
      { section: 'mentions', label: 'Mentions' },
    ],
  },
  {
    key: 'arrive', step: 3, label: 'Arrive', icon: 'pages', question: 'Who came, and where did they land?',
    tabs: [
      { view: 'pages', label: 'Pages' },
      { view: 'sessions', label: 'Sessions' },
    ],
  },
  {
    key: 'engage', step: 4, label: 'Engage', icon: 'flow', question: 'What did they do?',
    tabs: [
      { view: 'paths', label: 'Paths' },
      { view: 'funnels', label: 'Funnels' },
      { view: 'events', label: 'Events' },
    ],
  },
  {
    key: 'payoff', step: 5, label: 'Pay off', icon: 'target', question: 'Did it work, and did they come back?',
    tabs: [
      { section: 'outcomes', label: 'Outcomes' },
      { view: 'retention', label: 'Retention' },
      { section: 'product', label: 'Products' },
      { section: 'extensions', label: 'Extensions' },
    ],
  },
];

export const tabId = (tab) => tab.view || tab.section;

// Health picks among sites with a host, so only pass one it can show.
export function tabHref(tab, site) {
  if (tab.view) return `#/site/${site.id}/${tab.view}`;
  return tab.siteParam && site?.host ? `#/${tab.section}?site=${site.id}` : `#/${tab.section}`;
}

// Which stage and tab the current route belongs to (none for Settings, Alerts, SQL…).
export function locate(section, viewKey) {
  for (const stage of STAGES) {
    const tab = stage.tabs.find((t) => (section === 'site' ? t.view === viewKey : t.section === section));
    if (tab) return { stage, tab };
  }
  return { stage: null, tab: null };
}

export function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  return i >= 0 ? STAGES[i + 1] || null : null;
}
