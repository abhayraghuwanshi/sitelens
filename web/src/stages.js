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
      { section: 'github', label: 'GitHub', siteParam: true },
      { section: 'vercel', label: 'Vercel', siteParam: true },
      { section: 'firebase', label: 'Firebase', siteParam: true },
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
    ],
  },
  {
    key: 'engage', step: 4, label: 'Engage', icon: 'flow', question: 'What did they do?',
    // Its summary page is the stage; the deeper tools are in Explore.
    tabs: [],
  },
  {
    key: 'payoff', step: 5, label: 'Pay off', icon: 'target', question: 'Did it work, and did they come back?',
    tabs: [
      { section: 'outcomes', label: 'Outcomes', siteParam: true },
      { section: 'extensions', label: 'Extensions', siteParam: true },
    ],
  },
];

// ?site= scopes a workspace page to one site: just its repos, Vercel project,
// Firebase traffic, health, outcomes or extensions, never the rest of the
// account. Only a site with a host can have any of those.
export function tabHref(tab, site) {
  if (tab.view) return `#/site/${site.id}/${tab.view}`;
  return tab.siteParam && site?.host ? `#/${tab.section}?site=${site.id}` : `#/${tab.section}`;
}

// A stage opens its first report in Explore.
export function stageHref(stage, site) {
  return tabHref(stage.tabs[0], site);
}


