// "What to do next" for one site: the Story's list of changes worth making,
// each one a to-do away. Four kinds, from data Studio already has:
//  - fix: sources, pages and searches that sent fewer visits (the Story's movers);
//  - found: Search Console opportunities, one per landing page;
//  - convert: the Outcomes findings that say something is broken or leaking;
//  - grow: more of what worked (the platforms your posts brought visits from,
//    sources and searches that grew).
// Every step has a stable key, so one added to the to-dos shows as added.

import { STORY_DAYS } from './story.mjs';

const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const pageName = (path) => (path === '/' ? 'the home page' : !path || path === '(not set)' ? 'pages with no path recorded' : path);
const SEARCH_ENGINES = new Set(['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia']);
// How a post platform shows up as a GA4 source, so its posts and its source aren't suggested twice.
const SOURCE_NAMES = { hn: ['ycombinator', 'hacker news'], ph: ['producthunt', 'product hunt'], devto: ['dev.to'], x: ['t.co', 'twitter', 'x.com'], linkedin: ['linkedin', 'lnkd.in'], bluesky: ['bsky'] };

// Search Console's opportunities, one per landing page: several searches that
// reach the same page are fixed by the same title and description.
export function byPage(data, limit = 3) {
  if (!data?.opportunities?.length) return [];
  const pageOf = new Map();
  for (const qp of data.queryPages || []) if (!pageOf.has(qp.query) || pageOf.get(qp.query).impressions < qp.impressions) pageOf.set(qp.query, qp);
  const groups = new Map();
  for (const o of data.opportunities) {
    const path = pageOf.get(o.query)?.path || '';
    const g = groups.get(path) || { path, type: o.type, queries: [], impressions: 0, clicks: 0, weighted: 0, potential: 0 };
    g.queries.push(o);
    g.impressions += o.impressions;
    g.clicks += o.clicks;
    g.weighted += o.position * o.impressions;
    g.potential += o.potential || 0;
    if (o.type !== 'low-ctr') g.type = o.type;
    groups.set(path, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, position: g.weighted / Math.max(1, g.impressions), ctr: g.clicks / Math.max(1, g.impressions) }))
    .sort((a, b) => b.potential - a.potential)
    .slice(0, limit);
}

// → { steps: [{ key, group, subject, baseline?, title, why, worth?, link, linkLabel }] }. Pure.
//   subject and baseline go with the step onto the to-dos (server/todo-context.mjs).
//   story: buildStory's result; search: engines.search; insights: outcomes' findings;
//   posts: posts.overview for the site's product; canEdit: the site's articles can be opened.
export function buildNextSteps({ siteId, rangeKey = '28d', story = null, search = null, insights = [], posts = null, canEdit = false }) {
  const site = (path, params = '') => `#/site/${siteId}/${path}${params}`;
  const range = `?range=${rangeKey}`;
  const steps = [];
  // The numbers a step is based on, kept with the to-do it becomes.
  const base = (c, metric) => ({ metric, value: c.value, previous: c.previous, ...(story?.range ? { from: story.range.from, to: story.range.to } : {}) });

  // Fix: what sent fewer visits.
  const drops = (story?.changes || []).filter((c) => c.delta < 0);
  for (const c of drops.slice(0, 3)) {
    const around = c.cause ? ` Around then: ${c.cause.label}.` : '';
    if (c.kind === 'query') {
      steps.push({ key: `fix:query:${c.key}`, group: 'fix', subject: { kind: 'query', key: c.key }, baseline: base(c, 'search clicks'), title: `Win back the searches for “${c.key}”`, why: `${c.text}${around}`, worth: `${fmt(-c.delta)} fewer clicks`, link: site('search'), linkLabel: 'See the searches' });
    } else if (c.kind === 'page') {
      steps.push({ key: `fix:page:${c.key}`, group: 'fix', subject: { kind: 'page', key: c.key }, baseline: base(c, 'visits'), title: `Find out why ${pageName(c.key)} draws fewer visits`, why: `${c.text}${around}`, worth: `${fmt(-c.delta)} fewer visits`, link: site('pages', `${range}&path=${encodeURIComponent(c.key)}`), linkLabel: 'See the page' });
    } else {
      const engine = SEARCH_ENGINES.has(c.key.toLowerCase());
      steps.push({
        key: `fix:source:${c.key}`, group: 'fix', subject: { kind: 'source', key: c.key }, baseline: base(c, 'visits'),
        title: engine ? `Find out why ${c.key} search sent fewer visits` : `Find out why ${c.key} sent fewer visits`,
        why: `${c.text}${around}${c.key.toLowerCase() === '(direct)' || c.key.toLowerCase() === 'direct' ? ' Direct is often bots, so check engagement first.' : ''}`,
        worth: `${fmt(-c.delta)} fewer visits`,
        link: engine && c.key.toLowerCase() === 'google' ? site('search') : site('pages', range),
        linkLabel: engine && c.key.toLowerCase() === 'google' ? 'See the searches' : 'See the sources',
      });
    }
  }

  // Get found: Search Console opportunities.
  for (const o of byPage(search)) {
    const one = o.type === 'low-ctr' && o.queries.length === 1;
    const article = canEdit && o.path && o.path !== '/';
    steps.push({
      key: `search:${o.path || o.queries[0].query}`, group: 'found',
      subject: o.path ? { kind: 'search', key: o.path } : { kind: 'query', key: o.queries[0].query },
      baseline: { metric: 'search clicks', clicks: o.clicks, impressions: o.impressions, ctr: Math.round(o.ctr * 1000) / 10, position: Math.round(o.position * 10) / 10, potential: Math.round(o.potential) },
      title: one ? `Win more clicks on “${o.queries[0].query}”` : `Rewrite the title and description of ${pageName(o.path)}`,
      why: `${o.queries.map((q) => `“${q.query}”`).join(', ')}: shown ${fmt(o.impressions)} times at position ${o.position.toFixed(1)}; ${(o.ctr * 100).toFixed(1)}% click.`,
      worth: `about +${fmt(o.potential)} clicks a month`,
      link: article ? site('articles', `?article=${encodeURIComponent(o.path)}`) : site('search'),
      linkLabel: article ? 'Edit the article' : 'See the searches',
    });
  }

  // Convert: what Outcomes says is broken or leaking.
  for (const i of insights.filter((x) => x.tone === 'bad' || x.tone === 'warn').slice(0, 3)) {
    steps.push({
      key: `outcome:${i.key}`, group: 'convert', subject: { kind: 'outcome', key: i.key }, title: i.title,
      why: [i.detail, i.action && `Do: ${i.action}`].filter(Boolean).join(' '),
      link: i.link || site('outcomes', range), linkLabel: i.link ? 'Open GA4' : 'See outcomes',
    });
  }

  // Grow: more of what worked.
  const grow = [];
  const platforms = (posts?.byPlatform || []).filter((p) => p.sessions > 0).sort((a, b) => b.sessions - a.sessions);
  for (const p of platforms.slice(0, 2)) {
    const best = (posts.items || []).filter((i) => i.platform === p.key && i.sessions > 0).sort((a, b) => b.sessions - a.sessions)[0];
    grow.push({
      key: `grow:posts:${p.key}`, group: 'grow', subject: { kind: 'posts', key: p.key }, baseline: { metric: 'visits from posts', value: p.sessions, posts: p.posts }, title: `Post on ${p.label} again`,
      why: `Your ${p.posts === 1 ? 'post' : `${fmt(p.posts)} posts`} there brought ${fmt(p.sessions)} visits${best?.title ? `, most from “${best.title}”` : ''}.`,
      worth: `${fmt(p.sessions)} visits last time`, link: '#/posts', linkLabel: 'See your posts', words: SOURCE_NAMES[p.key] || [p.label.toLowerCase()],
    });
  }
  for (const c of (story?.changes || []).filter((x) => x.delta > 0)) {
    const key = c.key.toLowerCase();
    if (grow.some((g) => g.words?.some((w) => key.includes(w)))) continue;
    if (c.kind === 'query') {
      grow.push({ key: `grow:query:${c.key}`, group: 'grow', subject: { kind: 'query', key: c.key }, baseline: base(c, 'search clicks'), title: `Write more about “${c.key}”`, why: `${c.text} People are searching for it and finding you.`, worth: `+${fmt(c.delta)} clicks`, link: site('search'), linkLabel: 'See search demand' });
    } else if (c.kind === 'source' && !SEARCH_ENGINES.has(key) && key !== '(direct)' && key !== 'direct') {
      grow.push({ key: `grow:source:${c.key}`, group: 'grow', subject: { kind: 'source', key: c.key }, baseline: base(c, 'visits'), title: `Do more on ${c.key}`, why: `${c.text}${c.cause ? ` Around then: ${c.cause.label}.` : ''}`, worth: `+${fmt(c.delta)} visits`, link: site('pages', range), linkLabel: 'See the sources' });
    }
  }
  steps.push(...grow.slice(0, 3).map(({ words, ...g }) => g));

  return { steps };
}

// The route: the site's story, searches, outcome findings and posts, each optional.
export function nextStepRoutes({ story, engines, outcomes, posts, store, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/next-steps$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      const rangeKey = STORY_DAYS[query.get('range')] ? query.get('range') : '28d';
      const product = ((await store.get()).products || []).find((p) => p.siteId === site.id);
      const [told, search, found, posted] = await Promise.all([
        story.get(site, rangeKey).catch(() => null),
        site.demo || site.searchSite ? engines.search(site, '28d').catch(() => null) : null,
        product ? outcomes.get(product.id, rangeKey).catch(() => null) : null,
        product && !site.demo ? posts.overview({ rangeKey: '90d', product: product.id }).catch(() => null) : null,
      ]);
      return buildNextSteps({
        siteId: site.id, rangeKey, story: told, search, insights: found?.insights || [], posts: posted,
        canEdit: Boolean(site.demo || site.host),
      });
    }],
  ];
}
