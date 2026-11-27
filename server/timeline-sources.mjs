import { githubStatus } from './github.mjs';

// How often each source syncs in the background (the timers in calendar-store,
// bing, github-sync, cws and firebase), so the Jobs page can say when it runs next.
const MIN = 60_000;
export const SYNC_EVERY = { analytics: 30 * MIN, search: 30 * MIN, bing: 12 * 60 * MIN, github: 60 * MIN, extensions: 6 * 60 * MIN, firebase: 30 * MIN };

export function createTimelineSources({ store, history, auth, github, githubSource, firebase, vercel, bing, fly = null }) {
  return async function automaticJobs(siteId) {
    const site = await store.site(siteId);
    if (!site || site.demo) return [];
    const state = await store.get();
    const products = (state.products || []).filter((product) => product.siteId === siteId);
    const repos = [...new Set(products.flatMap((product) => product.repos || []))];
    const extIds = new Set(products.flatMap((product) => product.extensionIds || []));
    const tracked = (state.extensions || []).filter((extension) => extIds.has(extension.id));
    const edit = `#/account?tab=sites&edit=${encodeURIComponent(siteId)}`;
    const rows = [];
    const signIn = site.propertyId || site.searchSite ? await auth.status() : null;
    const googleState = signIn && (!signIn.connected || signIn.expired || signIn.broken) ? 'Needs Google sign-in' : '';
    const sync = signIn ? history.status().sites.find((row) => row.site === siteId) : null;

    if (site.propertyId) rows.push({
      id: 'analytics', label: 'Google Analytics', output: 'Visits, people, page views, landing pages and traffic sources',
      status: googleState || (sync?.error ? 'Sync needs attention' : sync?.ga_at ? 'Synced' : 'Waiting for first sync'),
      lastSync: sync?.ga_at, settings: googleState ? '#/account?i=google' : `${edit}&part=analytics`, timeline: { m: 'sessions' },
    });
    if (site.searchSite) rows.push({
      id: 'search', label: 'Google Search Console', output: 'Search clicks and queries',
      status: googleState || (sync?.sc_at ? 'Synced' : 'Waiting for first sync'),
      lastSync: sync?.sc_at, settings: googleState ? '#/account?i=google' : `${edit}&part=analytics`, timeline: { by: 'query' },
    });

    const bingStatus = await bing?.timelineStatus(site);
    if (bingStatus) rows.push({
      id: 'bing', label: 'Bing Webmaster Tools', output: 'Bing search clicks and impressions',
      status: bingStatus.status, lastReported: bingStatus.lastReported, settings: '#/account?i=bing',
      timeline: bingStatus.siteUrl ? { by: 'bing', f: 'clicks' } : null,
    });

    const githubConnected = Boolean(githubSource(state.sources));
    if (githubConnected || repos.length) {
      const status = github.status();
      const lastSync = status.lastRun || (github.hasDb() ? githubStatus(github.dbPath).lastSync : null);
      rows.push({
        id: 'github', label: 'GitHub', output: repos.length ? 'Releases and repo activity for linked repositories' : 'Account sync. Link a repository to show its releases on this Timeline.',
        status: !githubConnected ? 'Needs GitHub connection' : status.running ? 'Syncing' : status.lastError ? 'Sync needs attention' : !repos.length ? 'Link a repository' : lastSync ? 'Synced' : 'Waiting for first sync',
        lastSync, settings: githubConnected ? `${edit}&part=code` : '#/account?i=github', timeline: repos.length ? {} : null,
      });
    }
    if (extIds.size) {
      const lastSync = Math.max(0, ...tracked.map(({ checkedAt }) => checkedAt || 0));
      rows.push({
        id: 'extensions', label: 'Extension stores', output: 'Extension versions and listing snapshots',
        status: tracked.length < extIds.size ? 'Check linked extensions' : lastSync ? 'Synced' : 'Waiting for first sync',
        lastSync, settings: `${edit}&part=distribution`, timeline: {},
      });
    }
    if (state.firebase?.links?.[siteId]) {
      const status = await firebase.status();
      const link = status.links.find((item) => item.siteId === siteId);
      rows.push({
        id: 'firebase', label: 'Firebase App Hosting', output: 'Deploys on Timeline',
        status: link?.error ? 'Sync needs attention' : status.syncing ? 'Syncing' : link?.lastSync ? 'Synced' : 'Waiting for first sync',
        lastSync: link?.lastSync, settings: `${edit}&part=hosting`, timeline: {},
      });
    }
    if (state.vercel?.projectMap?.[siteId]) {
      const status = await vercel.status();
      rows.push({
        id: 'vercel', label: 'Vercel', output: 'Production deploys on Timeline',
        status: !status.tokenSource ? 'Needs Vercel connection' : status.lastError ? 'Connection needs attention' : 'Fetched when Timeline loads',
        settings: status.tokenSource ? `${edit}&part=hosting` : '#/account?i=vercel', timeline: {},
      });
    }
    if (fly && (await fly.status()).tokenSource) {
      const matched = await fly.matches([site]).catch(() => ({}));
      if (matched[siteId]?.app) {
        const status = await fly.status();
        rows.push({
          id: 'fly', label: 'Fly.io', output: `Releases of ${matched[siteId].app} on Timeline`,
          status: status.lastError ? 'Connection needs attention' : 'Fetched when Timeline loads',
          settings: '#/account?i=fly', timeline: {},
        });
      }
    }
    // vercel and fly have no timer: they're read when the Timeline loads (every: null).
    return rows.map((row) => ({ ...row, every: SYNC_EVERY[row.id] ?? null }));
  };
}
