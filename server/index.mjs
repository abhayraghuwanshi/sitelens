// SiteLens Studio server: JSON API + the built web app, bound to 127.0.0.1.

import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, publicSite, ValidationError, normalizeLeaveOut } from './store.mjs';
import { createAuth, AuthError } from './auth.mjs';
import { createBigQuery, BigQueryError } from './bigquery.mjs';
import { createEngines, EngineError } from './engines.mjs';
import { listAccountSummaries, listDataStreams, GaApiError } from '../shared/sitelens/ga4.js';
import { listSearchSites } from '../shared/sitelens/gsc.js';
import { githubOverview, githubRepo, githubStatus, HISTORY_RANGES, historyRange, SourceError } from './github.mjs';
import { createExtensionTracker, extensionView } from './cws.mjs';
import { listingAnalytics, findListingProperty, listProperties } from './cws-ga.mjs';
import { createCache, openCacheDb, requestContext } from './cache.mjs';
import { createGitHubSync } from './github-sync.mjs';
import { fetchDemand, demoDemand, defaultGroups, normalizeGroups } from './search-demand.mjs';
import { fetchTopics, demoTopics } from './search-topics.mjs';
import { createAnnotations, annotationRoutes } from './annotations.mjs';
import { detectMcpClients } from './mcp-clients.mjs';
import { createFunnelSuggest, funnelSuggestRoutes, linkedRepos, siteRepos } from './funnel-suggest.mjs';
import { createArticles, articleRoutes } from './articles.mjs';
import { createArticleEditor, articleEditorRoutes } from './article-editor.mjs';
import { productRoutes, createProducts } from './products.mjs';
import { createJourney, journeyRoutes } from './journey.mjs';
import { createOutcomes, outcomeRoutes } from './outcomes.mjs';
import { createProductSetup, productSetupRoutes } from './product-setup.mjs';
import { createPosts, postRoutes } from './posts.mjs';
import { createBing, bingRoutes } from './bing.mjs';
import { createVitals, vitalsRoutes } from './vitals.mjs';
import { createAlerts, alertRoutes } from './alerts.mjs';
import { createVercel, vercelRoutes } from './vercel.mjs';
import { createMentions, mentionRoutes } from './mentions.mjs';
import { createFirebase, firebaseRoutes } from './firebase.mjs';
import { createAiSearch, aiSearchRoutes, ENGINES, ENGINE_ON } from './ai-search.mjs';
import { createCalendar, calendarRoutes } from './calendar.mjs';
import { storyRoutes, createStory } from './story.mjs';
import { createTodos, todoRoutes } from './todos.mjs';
import { createTodoContext } from './todo-context.mjs';
import { nextStepRoutes } from './next-steps.mjs';
import { createSearchHub, searchHubRoutes } from './search-hub.mjs';
import { createPageReview, pageReviewRoutes } from './page-review.mjs';
import { createContentCycles, contentCycleRoutes } from './content-cycles.mjs';
import { createPageJourney, pageJourneyRoutes } from './page-journey.mjs';
import { createCalendarStore } from './calendar-store.mjs';
import { createAnalyst, analystRoutes } from './claude-analyst.mjs';
import { createCustomMetrics, customMetricRoutes } from './custom-metrics.mjs';
import { createConnect } from './connect.mjs';
import { createSiteConfig, siteConfigRoutes, searchGroups } from './site-config.mjs';

// How old a stored Google answer may be and still show while a fresh one loads.
const STALE_FOR = 24 * 3_600_000;
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const DIST = join(ROOT, 'web/dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

export function createApp({ store = createStore(), port = 4318, env = process.env, fetchImpl = fetch } = {}) {
  const auth = createAuth({ store, port, env, fetchImpl });
  const bigquery = createBigQuery({ getToken: () => auth.token(), fetchImpl });
  // Google answers kept on disk, so a restart (or a stale entry) answers at once.
  const cacheDb = openCacheDb(join(store.dir, 'cache.db'));
  const engines = createEngines({ auth, bigquery, cacheDb });
  const appUrl = env.STUDIO_APP_URL || '/';
  // Hosted (server/hosted.mjs): one app per signed-in user behind a gateway,
  // answering to the public host, with the desktop-only routes switched off.
  const hosted = env.STUDIO_HOSTED === '1';
  const hosts = ['127.0.0.1', 'localhost', '[::1]', ...(env.STUDIO_HOST ? [env.STUDIO_HOST] : [])];
  const extensions = createExtensionTracker({ store, fetchImpl });
  const sourceCache = createCache({ db: cacheDb, name: 'sources', staleFor: STALE_FOR });

  // The GA4 property Chrome Web Store created for this extension: a saved link,
  // else auto-detected (Google names it after the extension ID) and saved.
  async function listingProperty(id) {
    const ext = (await extensions.list()).find((e) => e.id === id);
    if (!ext) throw new SourceError('Unknown extension.', { kind: 'notfound' });
    if (ext.gaPropertyId) return ext.gaPropertyId;
    const token = await auth.token();
    const properties = await sourceCache.wrap('ga:properties', 30 * 60_000, false, () => listProperties(token));
    const match = findListingProperty(properties, id);
    if (!match) {
      throw new SourceError('No GA4 property for this extension’s store listing.', {
        kind: 'needs-listing-ga',
        hint: 'Turn it on in the Chrome Web Store Developer Dashboard → your item → Store listing → Google Analytics. Google creates a property named after the extension ID; data starts from that day.',
      });
    }
    await store.update((s) => {
      const e = (s.extensions || []).find((x) => x.id === id);
      if (e) e.gaPropertyId = match.id;
    });
    return match.id;
  }

  // GitHub stats are Studio's own: a token (Settings, else GITHUB_TOKEN in .env)
  // synced hourly into .data/github.db. No dependency on other projects.
  async function githubToken() {
    const { sources } = await store.get();
    return sources?.githubToken || env.GITHUB_TOKEN || '';
  }
  const vercel = createVercel({ store, env, cacheDb, fetchImpl });
  // Which repos belong to a site: the same rule Articles and Funnels use (picked
  // for its product, its Vercel project's repo, or homepage set to the site). Cached so the tab stays quick; a changed link list misses.
  const siteRepoCache = new Map(); // site id → { at, linked, value }
  async function siteRepoScope(site) {
    const linked = await linkedRepos({ store, site, vercel });
    const hit = siteRepoCache.get(site.id);
    if (hit && hit.linked === linked.join() && Date.now() - hit.at < 10 * 60_000) return hit.value;
    const token = await githubToken();
    let value;
    if (!token) value = { siteId: site.id, host: site.host || '', repos: linked, note: linked.length ? '' : 'Add a GitHub token in Settings → GitHub to find this site’s repos.' };
    else {
      try {
        value = { siteId: site.id, host: site.host || '', repos: (await siteRepos({ store, site, token, vercel, fetchImpl })).map((r) => r.name), note: '' };
      } catch (err) {
        return { siteId: site.id, host: site.host || '', repos: linked, note: `Couldn’t list your GitHub repos: ${err.message}` };
      }
    }
    siteRepoCache.set(site.id, { at: Date.now(), linked: linked.join(), value });
    return value;
  }
  const github = createGitHubSync({ dbPath: join(store.dir, 'github.db'), getToken: githubToken, fetchImpl });
  const funnelSuggest = createFunnelSuggest({ store, engines, getToken: githubToken, vercel, fetchImpl });
  const articles = createArticles({ auth, store, getToken: githubToken, vercel, cacheDb, fetchImpl });
  const annotations = createAnnotations({ store, githubDbPath: () => (github.hasDb() ? github.dbPath : null), extensions });
  const editor = createArticleEditor({ auth, store, articles, annotations, getToken: githubToken, env, fetchImpl });
  const vitals = createVitals({ dbPath: join(store.dir, 'vitals.db'), store, env, getToken: () => auth.token(), bigquery, fetchImpl });
  const siteConfig = createSiteConfig({ dir: join(store.dir, 'config'), cacheDb, repos: async (site) => (await siteRepoScope(site)).repos, getToken: githubToken, fetchImpl });
  const mentions = createMentions({ dbPath: join(store.dir, 'mentions.db'), store, env, siteConfig, fetchImpl });
  const alerts = createAlerts({ store, engines, github, extensions, auth, listingProperty, mentions, siteConfig, fetchImpl });
  annotations.registerSource('vercel', (q) => vercel.annotations(q));
  annotations.registerSource('mentions', (q) => mentions.annotations(q));
  const firebase = createFirebase({ dbPath: join(store.dir, 'firebase.db'), store, getToken: () => auth.token(), bigquery, fetchImpl });
  annotations.registerSource('firebase', (q) => firebase.annotations(q));
  const products = createProducts({ store, auth, extensions, listingProperty, githubDb });
  const bing = createBing({ dbPath: join(store.dir, 'bing.db'), store, env, fetchImpl });
  const searchHub = createSearchHub({ engines, bing, auth, fetchImpl });
  const journey = createJourney({ store, products, vitals, firebase, mentions, annotations, auth, bing, fetchImpl });
  const outcomes = createOutcomes({ store, products, auth, listingProperty, siteConfig });
  const pageReview = createPageReview({ articles, bing, store, outcomes, cacheDb });
  const pageJourney = createPageJourney({ engines, outcomes, store, auth, cacheDb });
  const setup = createProductSetup({ products, store, firebase, vercel, journey, mentions, outcomes });
  const history = createCalendarStore({ dbPath: join(store.dir, 'calendar.db'), store, auth });
  const posts = createPosts({ dbPath: join(store.dir, 'posts.db'), store, mentions, auth, history, cacheDb, fetchImpl });
  annotations.registerSource('posts', (q) => posts.annotations(q));
  const aiSearch = createAiSearch({ dbPath: join(store.dir, 'ai-search.db'), store, auth, firebase, siteConfig, env });
  const contentCycles = createContentCycles({ dbPath: join(store.dir, 'content-cycles.db'), store, auth, articles, bing, aiSearch, siteConfig, annotations, pageReview });
  // Hosted, the analyst's calls to this app stay in-process: over the network
  // they would reach the gateway, which knows no session for them.
  const analyst = createAnalyst({ store, annotations, baseUrl: `http://127.0.0.1:${port}`, env, fetchImpl: hosted ? (url, init) => selfFetch(handle, url, init) : fetchImpl });
  const customMetrics = createCustomMetrics({ store, env, fetchImpl });
  const connect = createConnect({ store, env, fetchImpl, baseUrl: env.STUDIO_HOST ? `https://${env.STUDIO_HOST}` : `http://127.0.0.1:${port}` });
  const calendar = createCalendar({ store, history, annotations, extensions, githubDbPath: () => (github.hasDb() ? github.dbPath : null) });
  // Calendar days are local, so the story's "today" is too.
  const story = createStory({ calendar, today: () => new Date().toLocaleDateString('en-CA') });
  const todos = createTodos({ store, annotations, context: createTodoContext({ calendar, engines, outcomes, store, today: () => new Date().toLocaleDateString('en-CA') }) });
  function githubDb() {
    if (!github.hasDb()) {
      throw new SourceError('No GitHub data yet.', {
        kind: 'needs-github',
        hint: 'Add a GitHub token in Settings → GitHub; the first sync starts right away and takes about a minute.',
      });
    }
    return github.dbPath;
  }

  async function siteOr404(id) {
    const site = await store.site(id);
    if (!site) throw new EngineError('Unknown site.', { status: 404, kind: 'notfound' });
    return site;
  }

  const routes = [
    ...annotationRoutes({ annotations }),
    ...vitalsRoutes({ vitals, store, siteOr404, fetchImpl }),
    ...alertRoutes(alerts),
    ...mentionRoutes({ mentions }),
    ...postRoutes({ posts }),
    ...bingRoutes({ bing, siteOr404 }),
    ...searchHubRoutes({ hub: searchHub, bing, siteOr404 }),
    ...pageReviewRoutes({ review: pageReview, siteOr404 }),
    ...pageJourneyRoutes({ journey: pageJourney, siteOr404 }),
    ...vercelRoutes({ vercel, store, siteOr404, auth }),
    ...firebaseRoutes({ firebase }),
    ...aiSearchRoutes({ aiSearch, siteOr404 }),
    ...analystRoutes({ analyst, siteOr404 }),
    ...funnelSuggestRoutes({ funnelSuggest, siteOr404 }),
    ...articleRoutes({ articles, siteOr404 }),
    ...contentCycleRoutes({ cycles: contentCycles, siteOr404 }),
    ...articleEditorRoutes({ editor, siteOr404 }),
    ...calendarRoutes({ calendar, history }),
    ...storyRoutes({ story, siteOr404 }),
    ...todoRoutes({ todos }),
    ...nextStepRoutes({ story, engines, outcomes, posts, store, siteOr404 }),
    ...customMetricRoutes({ metrics: customMetrics, siteOr404 }),
    ...siteConfigRoutes({
      siteConfig,
      siteOr404,
      // What the site really sent, to flag config names that never fire.
      async firedEvents(site) {
        if (site.propertyId) return outcomes.eventNames(site);
        if (site.demo || site.bq) return new Set((await engines.events(site, '28d')).events.map((e) => e.name));
        return null;
      },
      // A starting file: the product's goals (or Studio's guesses) and suggested funnels.
      async draftInputs(site) {
        const product = ((await store.get()).products || []).find((p) => p.siteId === site.id);
        const hasStore = Boolean(product?.extensionIds?.length);
        const hasRepos = Boolean(product?.repos?.length);
        const guessed = !product?.goals?.length;
        const goals = guessed ? (await outcomes.suggest({ siteId: site.id, hasStore, hasRepos }).catch(() => ({ suggested: [] }))).suggested : product.goals;
        const funnels = site.demo || site.bq ? (await funnelSuggest.suggest(site, '28d').catch(() => ({ funnels: [] }))).funnels.slice(0, 3) : [];
        // What's set up by hand today: query groups become topics, saved AI
        // questions stay questions, and the product's name is the brand.
        const topics = (site.searchGroups || []).map((g) => ({ name: g.name, match: g.pattern }));
        const asked = await aiSearch.promptsFor(site).catch(() => null);
        const brand = topics.some((t) => /^brand$/i.test(t.name)) ? [] : [...new Set([product?.label, site.label].filter((x) => x && x.length >= 2))];
        return { goals, funnels, guessed, search: { brand, competitors: [], topics, ask_ai: asked?.from === 'auto' ? [] : asked?.prompts || [] } };
      },
      // What each section falls back to when the file doesn't set it.
      async studioSetup(site) {
        const product = ((await store.get()).products || []).find((p) => p.siteId === site.id);
        const asked = await aiSearch.promptsFor(site).catch(() => null);
        const rules = (await alerts.settings()).rules;
        const groups = site.searchGroups || [];
        const pct = (r) => (r.enabled ? `±${Math.round(r.pct * 100)}%` : 'off');
        return {
          goals: product?.goals?.length
            ? { from: 'studio', items: product.goals.map((g) => `${g.label}${g.role === 'step' ? ' (step)' : ''}`), edit: `#/settings?tab=sites&edit=${site.id}&focus=goals` }
            : { from: 'auto', items: ['Guessed from the events the site sends'], edit: `#/settings?tab=sites&edit=${site.id}&focus=goals` },
          funnels: { from: 'auto', items: ['Suggested from the site’s events and code'], edit: `#/site/${site.id}/funnels` },
          search: {
            from: groups.length || asked?.from === 'settings' ? 'studio' : 'auto',
            items: [
              groups.length ? `Query groups: ${groups.map((g) => g.name).join(', ')}` : 'Query groups: a Brand guess from the site’s name',
              asked?.from === 'settings' ? `${asked.prompts.length} AI question${asked.prompts.length === 1 ? '' : 's'}` : 'AI questions: generic ones from the product’s name',
            ],
            edit: `#/site/${site.id}/demand`,
          },
          alerts: {
            from: 'studio', items: [`Sessions & users: ${pct(rules.traffic)}`, `Search clicks: ${pct(rules.search)}`], edit: '#/settings?tab=alerts',
            // The draft file has no alerts, so start from the thresholds used today.
            draft: ['alerts:', ...['traffic', 'search'].map((k) => `  ${k}: ${rules[k].enabled ? `{ pct: ${Math.round(rules[k].pct * 100)}, min: ${rules[k].minVolume} }` : 'off'}`)].join('\n'),
          },
        };
      },
      async onChange(site) {
        for (const p of (await store.get()).products || []) if (p.siteId === site.id) outcomes.clear(p.id);
      },
    }),
    ['GET', /^\/api\/state$/, async () => {
      return {
        hosted,
        auth: await auth.status(),
        sites: (await store.sites()).map(publicSite),
        ranges: { ...engines.ranges, history: HISTORY_RANGES.map(({ key, label }) => ({ key, label })) },
        sources: {
          github: {
            tokenSource: (await store.get()).sources?.githubToken ? 'settings' : env.GITHUB_TOKEN ? 'env' : '',
            ...github.status(),
            data: github.hasDb() ? githubStatus(github.dbPath) : { ok: false },
          },
          extensions: (await extensions.list()).length,
        },
      };
    }],
    // One status line per integration for Settings → Integrations.
    ['GET', /^\/api\/integrations$/, async () => {
      const saved = await store.get();
      const src = saved.sources || {};
      const from = (settingsValue, envValue) => (settingsValue ? 'settings' : envValue ? 'env' : '');
      const [firebaseStatus, vercelStatus, vitalsStatus, alertSettings, metricStatus] = await Promise.all([
        firebase.status(), vercel.status(), vitals.summary().catch(() => ({ key: { source: '' } })), alerts.settings().catch(() => ({})), customMetrics.status(),
      ]);
      return {
        google: await auth.status(),
        github: { source: from(src.githubToken, env.GITHUB_TOKEN), ...github.status(), repos: github.hasDb() ? githubStatus(github.dbPath).repos || 0 : 0 },
        firebase: { links: firebaseStatus.links.length, errors: firebaseStatus.links.filter((l) => l.error).map((l) => l.error) },
        vercel: { source: vercelStatus.tokenSource, login: vercelStatus.login, error: vercelStatus.lastError },
        extensions: { count: (await extensions.list()).length },
        reddit: { source: from(src.redditClientId, env.REDDIT_CLIENT_ID) },
        productHunt: { source: from(src.productHuntToken, env.PRODUCTHUNT_TOKEN) },
        pagespeedKey: { source: vitalsStatus.key?.source || '' },
        bing: { source: src.bingApiKey ? 'settings' : src.bingOAuth?.refreshToken ? 'oauth' : from('', env.BING_WEBMASTER_KEY) },
        anthropic: { source: from(src.anthropicKey, env.ANTHROPIC_API_KEY), weekly: Boolean(saved.aiSearch?.weekly) },
        openrouter: {
          source: from(src.openrouterKey, env.OPENROUTER_API_KEY),
          on: ENGINES.filter((e) => e.via === 'openrouter' && { ...ENGINE_ON, ...(saved.aiSearch?.engines || {}) }[e.key]).map((e) => e.label),
        },
        customMetrics: { count: metricStatus.metrics.length, sources: metricStatus.connectors.filter((c) => c.secret.source).map((c) => c.label) },
        notifications: { webhook: Boolean(alertSettings.webhookUrl), desktop: Boolean(alertSettings.desktop), enabled: Boolean(alertSettings.enabled) },
      };
    }],
    // What an MCP client needs to launch server/mcp.mjs with this install's
    // Node and data folder (in the desktop app, both live inside the bundle).
    ['GET', /^\/api\/mcp\/setup$/, async () => {
      if (hosted) throw new SourceError('MCP setup is for the desktop app.', { kind: 'notfound' });
      const mcpPath = join(ROOT, 'server', 'mcp.mjs');
      return {
        command: stableNode(process.execPath),
        args: ['--no-warnings=ExperimentalWarning', mcpPath],
        env: { STUDIO_DATA_DIR: store.dir, ...(port !== 4318 ? { STUDIO_URL: `http://127.0.0.1:${port}` } : {}) },
        clients: await detectMcpClients({ mcpPath, cwd: ROOT }),
      };
    }],
    ['POST', /^\/api\/github\/token$/, async ({ body }) => {
      const token = String(body.token ?? '').trim();
      if (token) {
        const who = await github.verify(token);
        await store.update((s) => {
          s.sources = { ...(s.sources || {}), githubToken: token };
        });
        github.sync().catch(() => {});
        return { ok: true, ...who };
      }
      await store.update((s) => {
        if (s.sources) delete s.sources.githubToken;
      });
      return { ok: true };
    }],
    ['POST', /^\/api\/github\/sync$/, async () => github.sync()],
    ['POST', /^\/api\/github\/import$/, async ({ body }) => ({ imported: github.importFrom(String(body.path || '').trim()) })],

    ['GET', /^\/api\/github\/overview$/, async ({ query }) => {
      const range = query.get('range') || '28d';
      const site = query.get('site') && (await store.sites()).find((s) => s.id === query.get('site'));
      if (!site) return githubOverview(githubDb(), range);
      const scope = await siteRepoScope(site);
      return { ...githubOverview(githubDb(), range, new Set(scope.repos)), scope };
    }],
    ['GET', /^\/api\/github\/repo$/, async ({ query }) => githubRepo(githubDb(), query.get('name') || '', query.get('range') || '28d')],

    ['GET', /^\/api\/extensions$/, async ({ query }) => {
      const range = historyRange(query.get('range') || '28d');
      return { range, extensions: (await extensions.list()).map((e) => extensionView(e, range)) };
    }],
    ['POST', /^\/api\/extensions$/, async ({ body }) => extensions.add(body.id, body.label)],
    ['DELETE', /^\/api\/extensions\/([a-p]{32})$/, async ({ match }) => {
      await extensions.remove(match[1]);
      return { ok: true };
    }],
    ['GET', /^\/api\/extensions\/([a-p]{32})\/analytics$/, async ({ match, query }) => {
      const range = historyRange(query.get('range') || '28d');
      const propertyId = await listingProperty(match[1]);
      return sourceCache.wrap(`listing:${propertyId}:${range.key}:${range.end}`, 10 * 60_000, query.has('fresh'), async () =>
        ({ range, ...(await listingAnalytics({ token: await auth.token(), propertyId, range })) }));
    }],
    ['POST', /^\/api\/extensions\/([a-p]{32})\/refresh$/, async ({ match }) => extensions.snapshot(match[1])],
    ['POST', /^\/api\/extensions\/([a-p]{32})\/import$/, async ({ match, body }) => extensions.importCsv(match[1], body.filename, body.csv)],

    ['POST', /^\/api\/auth\/token$/, async ({ body }) => auth.usePastedToken(body.token)],
    ['POST', /^\/api\/auth\/signout$/, async () => {
      await auth.signOut();
      return { ok: true };
    }],

    ['GET', /^\/api\/google\/properties$/, async () => listAccountSummaries({ token: await auth.token() })],
    ['GET', /^\/api\/google\/streams$/, async ({ query }) =>
      listDataStreams({ token: await auth.token(), propertyId: query.get('property') })],
    ['GET', /^\/api\/google\/search-sites$/, async () => listSearchSites({ token: await auth.token() })],
    ['GET', /^\/api\/google\/bq-projects$/, async () => bigquery.listProjects()],
    ['GET', /^\/api\/connect$/, async () => ({ bing: connect.available('bing'), vercel: connect.available('vercel') })],
    ['GET', /^\/api\/google\/bq-export$/, async ({ query }) => {
      const property = String(query.get('property') || '');
      if (!/^\d+$/.test(property)) throw new ValidationError('GA4 property IDs are numeric.');
      return bigquery.findExport(property);
    }],
    ['GET', /^\/api\/google\/bq-datasets$/, async ({ query }) => bigquery.listDatasets(query.get('project') || '')],

    ['POST', /^\/api\/sites$/, async ({ body }) => {
      const site = await store.saveSite(body);
      engines.clearSite(site.id);
      return publicSite(site);
    }],
    ['DELETE', /^\/api\/sites\/([\w-]+)$/, async ({ match }) => {
      await store.removeSite(match[1]);
      engines.clearSite(match[1]);
      history.forget(match[1]);
      return { ok: true };
    }],

    // Before productRoutes: /api/products/setup would otherwise match /api/products/:id.
    ...productSetupRoutes({ setup }),
    ...productRoutes({ products }),
    ...journeyRoutes({ journey }),
    ...outcomeRoutes({ outcomes }),
    ['GET', /^\/api\/portfolio$/, async ({ query }) => engines.portfolio(await store.sites(), query.get('range') || '28d')],

    ['GET', /^\/api\/sites\/([\w-]+)\/dashboard$/, async ({ match, query }) =>
      engines.dashboard(await siteOr404(match[1]), query.get('range') || '28d', { fresh: query.has('fresh') })],
    ['GET', /^\/api\/sites\/([\w-]+)\/live$/, async ({ match }) => engines.live(await siteOr404(match[1]))],
    ['GET', /^\/api\/sites\/([\w-]+)\/page-trend$/, async ({ match, query }) =>
      engines.pageTrend(await siteOr404(match[1]), query.get('path') || '/', query.get('range') || '28d')],
    ['GET', /^\/api\/sites\/([\w-]+)\/search$/, async ({ match, query }) =>
      engines.search(await siteOr404(match[1]), query.get('range') || '28d', { fresh: query.has('fresh') })],

    ['GET', /^\/api\/sites\/([\w-]+)\/search-demand$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      const rangeKey = query.get('range') || '28d';
      // The site's .sitelens.yml first, then groups saved here, then a Brand guess.
      const fromFile = searchGroups((await siteConfig.applied(site))?.search);
      const groupsFrom = fromFile.length ? 'file' : site.searchGroups ? 'settings' : 'auto';
      const groups = fromFile.length ? fromFile : site.searchGroups || defaultGroups(site);
      const meta = { groupsFrom, defaultGroups: groupsFrom === 'auto' };
      if (site.demo) return { groups: groups, ...demoDemand({ site, rangeKey, groups }), ...meta };
      if (!site.searchSite) throw new EngineError('Pick a Search Console property for this site in Settings.', { kind: 'needs-search' });
      const key = `demand:${site.id}:${rangeKey}:${JSON.stringify(groups)}`;
      const data = await sourceCache.wrap(key, 10 * 60_000, query.has('fresh'), async () =>
        fetchDemand({ token: await auth.token(), site, rangeKey, groups }));
      return { ...data, ...meta };
    }],
    // How each search topic in the site's .sitelens.yml does in Google.
    ['GET', /^\/api\/sites\/([\w-]+)\/search-topics$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      const rangeKey = query.get('range') || '28d';
      const search = (await siteConfig.applied(site))?.search;
      if (!search?.topics?.length) return { topics: [] };
      if (site.demo) return demoTopics({ site, rangeKey, search });
      if (!site.searchSite) throw new EngineError('Pick a Search Console property for this site in Settings.', { kind: 'needs-search' });
      const key = `topics:${site.id}:${rangeKey}:${JSON.stringify(search)}`;
      return sourceCache.wrap(key, 10 * 60_000, query.has('fresh'), async () => fetchTopics({ token: await auth.token(), site, rangeKey, search }));
    }],
    ['POST', /^\/api\/sites\/([\w-]+)\/search-groups$/, async ({ match, body }) => {
      const site = await siteOr404(match[1]);
      if (searchGroups((await siteConfig.applied(site))?.search).length) {
        throw new EngineError('This site’s query groups come from search: in its .sitelens.yml. Change them there.', { kind: 'validation' });
      }
      const groups = normalizeGroups(body.groups || []);
      if (site.demo) throw new EngineError('The demo site’s groups can’t be saved — try them on your own site.', { kind: 'validation' });
      await store.saveSite({ ...site, searchGroups: groups });
      return { groups };
    }],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/paths$/, async ({ match, query }) =>
      engines.paths(await siteOr404(match[1]), query.get('range'), {
        depth: Number(query.get('depth')) || 4,
        startPath: query.get('start') || '',
        top: Number(query.get('top')) || 12,
      }, flags(query))],
    ['POST', /^\/api\/sites\/([\w-]+)\/warehouse\/funnel$/, async ({ match, body }) =>
      engines.funnel(await siteOr404(match[1]), body.range, body.steps, { fresh: Boolean(body.fresh) })],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/cohorts$/, async ({ match, query }) =>
      engines.cohorts(await siteOr404(match[1]), query.get('range'), flags(query))],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/sessions$/, async ({ match, query }) =>
      engines.sessions(await siteOr404(match[1]), query.get('range'), {
        path: query.get('path') || '',
        converted: query.get('converted') || '',
        limit: Number(query.get('limit')) || 50,
      }, flags(query))],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/events$/, async ({ match, query }) =>
      engines.events(await siteOr404(match[1]), query.get('range'), flags(query))],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/journeys$/, async ({ match, query }) =>
      engines.journeys(await siteOr404(match[1]), query.get('range'), {
        steps: (query.get('steps') || '').split(',').filter(Boolean),
        outcome: query.get('outcome') || '',
        min: Number(query.get('min')) || 3,
      }, flags(query))],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/left-out$/, async ({ match, query }) =>
      engines.leftOut(await siteOr404(match[1]), query.get('range'), flags(query))],
    ['POST', /^\/api\/sites\/([\w-]+)\/leave-out$/, async ({ match, body }) => {
      const site = await siteOr404(match[1]);
      if (site.demo) throw new EngineError('The demo site’s rule can’t be saved — try it on your own site.', { kind: 'validation' });
      const saved = await store.saveSite({ ...site, leaveOut: normalizeLeaveOut(body) });
      engines.clearSite(site.id);
      return { leaveOut: saved.leaveOut };
    }],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/leavers$/, async ({ match, query }) =>
      engines.leavers(await siteOr404(match[1]), query.get('range'), {
        steps: (query.get('steps') || '').split(',').filter(Boolean),
        outcome: query.get('outcome') || '',
      }, flags(query))],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/event$/, async ({ match, query }) =>
      engines.eventDetail(await siteOr404(match[1]), query.get('range'), query.get('name'), flags(query))],
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/breakdown$/, async ({ match, query }) =>
      engines.breakdown(await siteOr404(match[1]), query.get('range'), query.get('name'), query.get('key'), flags(query))],
    ['POST', /^\/api\/sites\/([\w-]+)\/warehouse\/estimate$/, async ({ match, body }) =>
      engines.estimate(await siteOr404(match[1]), body.range, body.sql)],
    ['POST', /^\/api\/sites\/([\w-]+)\/warehouse\/sql$/, async ({ match, body }) =>
      engines.consoleQuery(await siteOr404(match[1]), body.range, body.sql, { confirmBytes: Number(body.confirmBytes) || 0 })],
    ['POST', /^\/api\/sites\/([\w-]+)\/warehouse\/rollup$/, async ({ match, body }) => {
      const site = await siteOr404(match[1]);
      const result = await engines.rollup(site, body.range || '90d');
      // Never point a site at an empty rollup: every session view would go blank.
      result.linked = Boolean(body.use && result.sessions > 0);
      if (result.linked) await store.saveSite({ ...site, bq: { ...site.bq, sessionsTable: result.table } });
      return result;
    }],
  ];

  async function handle(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');

    // DNS-rebinding guard: this server only answers to loopback names (and,
    // hosted, its public one).
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (!hosts.includes(host)) return send(res, 421, { error: 'Misdirected request' });

    if (url.pathname === '/auth/google') {
      try {
        res.writeHead(302, { Location: auth.startUrl() }).end();
      } catch (err) {
        redirectWithError(res, appUrl, err.message);
      }
      return;
    }
    if (url.pathname === '/auth/callback') {
      try {
        if (url.searchParams.get('error')) throw new AuthError(`Google sign-in was cancelled (${url.searchParams.get('error')}).`);
        await auth.finish({ code: url.searchParams.get('code'), state: url.searchParams.get('state') });
        res.writeHead(302, { Location: `${appUrl}#/settings?connected=1` }).end();
      } catch (err) {
        redirectWithError(res, appUrl, err.message);
      }
      return;
    }

    // "Connect Bing" / "Connect Vercel": out to the provider and back.
    const linking = url.pathname.match(/^\/auth\/(bing|vercel)(\/callback)?$/);
    if (linking) {
      const [, name, callback] = linking;
      try {
        if (!callback) return res.writeHead(302, { Location: connect.startUrl(name) }).end();
        await connect.finish(name, url.searchParams);
        (name === 'bing' ? bing : vercel).reset();
        res.writeHead(302, { Location: `${appUrl}#/settings?i=${name}` }).end();
      } catch (err) {
        redirectWithError(res, appUrl, err.message);
      }
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      // CSRF guard: state-changing calls need a header a cross-site form cannot send.
      if (req.method !== 'GET' && req.headers['x-studio'] !== '1') return send(res, 403, { error: 'Missing X-Studio header.' });
      const route = routes.find(([method, re]) => method === req.method && re.test(url.pathname));
      if (!route) return send(res, 404, { error: 'Not found' });
      // A response built from stale data says so; the web app then asks again
      // with X-Studio-Wait, which waits for the refreshes already under way.
      const ctx = { wait: req.headers['x-studio-wait'] === '1', stale: false, refreshes: [] };
      try {
        const body = req.method === 'GET' ? {} : await readJson(req);
        const data = await requestContext.run(ctx, () => route[2]({ match: url.pathname.match(route[1]), query: url.searchParams, body, req }));
        return send(res, 200, data ?? {}, ctx.stale ? { 'X-Studio-Stale': '1' } : {});
      } catch (err) {
        return sendError(res, err);
      }
    }

    return serveStatic(url.pathname, res);
  }

  return { handle, store, auth, todos, engines, extensions, github, annotations, vitals, alerts, vercel, mentions, firebase, posts, bing, aiSearch, contentCycles, calendar, history, customMetrics };
}

// Calls handle() as if over HTTP and returns a fetch Response.
export async function selfFetch(handle, url, { method = 'GET', headers = {}, body } = {}) {
  const u = new URL(url);
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, url: u.pathname + u.search, headers: { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])), host: u.host } });
  return new Promise((resolve) => {
    let status = 200;
    let head = {};
    const res = {
      writeHead(code, h = {}) {
        status = code;
        head = h;
        return res;
      },
      end(data = '') {
        resolve(new Response(status === 204 ? null : data, { status, headers: head }));
      },
    };
    handle(req, res);
  });
}

function flags(query) {
  return { fresh: query.has('fresh') };
}

function redirectWithError(res, appUrl, message) {
  res.writeHead(302, { Location: `${appUrl}#/settings?error=${encodeURIComponent(message)}` }).end();
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5_000_000) throw new EngineError('Request body too large.', { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new EngineError('Body must be JSON.');
  }
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

function sendError(res, err) {
  if (err instanceof ValidationError) return send(res, 400, { error: err.message, kind: 'validation' });
  if (err instanceof AuthError) return send(res, 401, { error: err.message, kind: 'auth' });
  if (err instanceof EngineError) return send(res, err.status, { error: err.message, kind: err.kind, hint: err.hint });
  if (err instanceof SourceError) {
    const status = { validation: 400, notfound: 404, auth: 401, 'needs-github': 409, 'needs-listing-ga': 409 }[err.kind] || 502;
    return send(res, status, { error: err.message, kind: err.kind, hint: err.hint });
  }
  if (err instanceof BigQueryError) {
    const status = err.kind === 'auth' ? 401 : err.kind === 'over-cap' ? 409 : err.kind === 'forbidden' ? 400 : 502;
    return send(res, status, { error: err.message, kind: err.kind, hint: err.hint, bytes: err.bytes });
  }
  if (err instanceof GaApiError) {
    const status = err.kind === 'auth' ? 401 : err.kind === 'permission' ? 403 : err.kind === 'quota' ? 429 : 502;
    return send(res, status, { error: err.message, kind: err.kind });
  }
  console.error(err);
  return send(res, 500, { error: 'Unexpected server error. See the terminal for details.', kind: 'server' });
}

async function serveStatic(pathname, res) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, safe);
  if (!file.startsWith(DIST)) return send(res, 400, { error: 'Bad path' });
  try {
    if (!(await stat(file)).isFile()) file = join(DIST, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    const data = await readFile(file);
    const immutable = file.includes(`${DIST}/assets/`);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  } catch {
    res.writeHead(503, { 'Content-Type': 'text/plain' }).end('Web app not built yet. Run `npm run build` or use `npm run dev`.');
  }
}

// Homebrew's execPath is versioned (…/Cellar/node/26.7.0/bin/node) and vanishes on
// upgrade; prefer the stable bin/node symlink that points at it.
function stableNode(execPath) {
  const cellar = execPath.match(/^(.*)\/Cellar\/node(?:@[\d.]+)?\/[^/]+\/bin\/node$/);
  return cellar && existsSync(join(cellar[1], 'bin', 'node')) ? join(cellar[1], 'bin', 'node') : execPath;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET live in .env (gitignored); real env vars win.
  // The desktop app keeps its .env beside its data, so check STUDIO_DATA_DIR first.
  for (const dir of [process.env.STUDIO_DATA_DIR, ROOT].filter(Boolean)) {
    try {
      process.loadEnvFile(join(dir, '.env'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  const port = Number(process.env.PORT) || 4318;
  const app = createApp({ port });
  app.extensions.start();
  app.github.start();
  app.vitals.start();
  app.alerts.start();
  app.mentions.start();
  app.firebase.start();
  app.posts.start();
  app.bing.start();
  app.aiSearch.start();
  app.contentCycles.start();
  app.history.start();
  createServer((req, res) => app.handle(req, res)).listen(port, '127.0.0.1', () => {
    console.log(`\n  SiteLens Studio  →  http://127.0.0.1:${port}\n`);
    if (!app.auth.oauthAvailable) console.log('  Google sign-in disabled (no GOOGLE_CLIENT_ID); paste-a-token works.\n');
  });
}
