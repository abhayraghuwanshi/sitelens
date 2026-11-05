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
      { section: 'outcomes', label: 'Outcomes' },
      { section: 'product', label: 'Products', siteParam: true },
      { section: 'extensions', label: 'Extensions' },
    ],
  },
];

// The power tools on the GA4 BigQuery export: questions the journey doesn't
// ask for you. Their own area, so the stages stay a story; stage pages still
// link to the ones that fit them.
export const EXPLORE = {
  key: 'explore', label: 'Explore', icon: 'database', question: 'Ask the raw events anything',
  tabs: [
    { view: 'funnels', label: 'Funnels', icon: 'funnel', about: 'Any steps, pages or events, in order, and where people drop off between them.' },
    { view: 'paths', label: 'Paths', icon: 'flow', about: 'The real routes through the site, page by page, with where each one ends.' },
    { view: 'retention', label: 'Retention', icon: 'cohort', about: 'Weekly cohorts of new visitors, and how many come back each week after.' },
    { view: 'sessions', label: 'Sessions', icon: 'layers', about: 'Single visits that saw a page or fired an event, with everything they did.' },
    { view: 'events', label: 'Events', icon: 'bolt', about: 'Every event the site sends, with all its parameters and their values.' },
    { view: 'sql', label: 'SQL console', icon: 'terminal', about: 'Your own SELECT on the export. Dry-run first and capped, so it can’t run up a bill.' },
  ],
};

export const tabId = (tab) => tab.view || tab.section;

// Health picks among sites with a host, so only pass one it can show; GitHub,
// Vercel and Products use it to show just that site's repos, project or product.
export function tabHref(tab, site) {
  if (tab.view) return `#/site/${site.id}/${tab.view}`;
  return tab.siteParam && site?.host ? `#/${tab.section}?site=${site.id}` : `#/${tab.section}`;
}

// A numbered stage opens its summary page (pages/Stage.jsx), whose cards lead
// to its tabs, and Explore opens its list of tools; Overview is its own page.
export function stageHref(stage, site) {
  return stage.step || stage === EXPLORE ? `#/site/${site.id}/${stage.key}` : tabHref(stage.tabs[0], site);
}

// Which stage and tab the current route belongs to (none for Settings, Alerts, SQL…).
// A stage's summary page has the stage and no tab.
export function locate(section, viewKey) {
  for (const stage of [...STAGES, EXPLORE]) {
    if ((stage.step || stage === EXPLORE) && section === 'site' && viewKey === stage.key) return { stage, tab: null };
    const tab = stage.tabs.find((t) => (section === 'site' ? t.view === viewKey : t.section === section));
    if (tab) return { stage, tab };
  }
  return { stage: null, tab: null };
}

export function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  return i >= 0 ? STAGES[i + 1] || null : null;
}
