import { api } from './api.js';
import { useAsync } from './hooks.js';

// The product a site belongs to (its repos, store listings and goals), or null.
// Ship, Pay off and Overview read its health checks, growth and outcomes.
export function useSiteProduct(site) {
  return useAsync(async () => (site.demo ? null : (await api.get('/products')).products.find((p) => p.siteId === site.id) || null), [site.id]);
}

// The checks that are about the site staying up and fast, from the product
// journey (server/journey.mjs); traffic and outcome have their own stages.
export const HEALTH_STAGES = ['domain', 'deploy', 'speed'];
