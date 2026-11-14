// Local-first persistence: one JSON file under .data/ (or STUDIO_DATA_DIR),
// written atomically with owner-only permissions because it holds tokens.
// Hosted, each user's file is sealed with AES-256-GCM under a key only the
// server holds, so a copy of the disk alone gives no one their tokens.

import { readFile, writeFile, rename, mkdir, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { normalizeGroups } from './search-demand.mjs';

export const DEMO_SITE = Object.freeze({
  id: 'demo',
  demo: true,
  label: 'Demo site',
  host: 'example.com',
  propertyId: '',
  streamName: '',
  includeSubdomains: false,
  searchSite: 'sc-domain:example.com',
  bq: null,
});

const EMPTY = { auth: null, sites: [], showDemo: true, extensions: [], sources: {} };

export function createStore(dir = process.env.STUDIO_DATA_DIR || resolve('.data'), { key = null } = {}) {
  const file = join(dir, 'studio.json');
  let state = null;
  let writing = Promise.resolve();

  async function load() {
    if (state) return state;
    try {
      state = { ...EMPTY, ...JSON.parse(open(await readFile(file, 'utf8'), key)) };
      if (moveSiteRepos(state)) await save();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      state = structuredClone(EMPTY);
    }
    return state;
  }

  async function save() {
    const snapshot = seal(JSON.stringify(state, null, 2), key);
    writing = writing.then(async () => {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot, { mode: 0o600 });
      await rename(tmp, file);
      await chmod(file, 0o600);
    });
    return writing;
  }

  return {
    dir,
    async get() {
      return load();
    },
    async update(fn) {
      await load();
      const next = (await fn(state)) || state;
      state = next;
      await save();
      return state;
    },
    async sites() {
      const s = await load();
      return [...(s.showDemo ? [DEMO_SITE] : []), ...s.sites];
    },
    async site(id) {
      return (await this.sites()).find((site) => site.id === id) || null;
    },
    async saveSite(input) {
      const site = normalizeSite(input);
      await this.update((s) => {
        const index = s.sites.findIndex((x) => x.id === site.id);
        // Settings edits don't send query groups; keep the saved ones.
        if (index >= 0 && site.searchGroups === undefined && s.sites[index].searchGroups) site.searchGroups = s.sites[index].searchGroups;
        if (index >= 0 && site.leaveOut === undefined && s.sites[index].leaveOut) site.leaveOut = s.sites[index].leaveOut;
        if (index >= 0) s.sites[index] = site;
        else s.sites.push(site);
      });
      return site;
    },
    async removeSite(id) {
      await this.update((s) => {
        if (id === DEMO_SITE.id) s.showDemo = false;
        else s.sites = s.sites.filter((x) => x.id !== id);
      });
    },
  };
}

// { sealed: 1, iv, tag, data }, all base64. Without a key the file stays plain JSON.
function seal(text, key) {
  if (!key) return text;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return JSON.stringify({ sealed: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
}

function open(text, key) {
  const parsed = JSON.parse(text);
  if (!parsed.sealed) {
    // A sealed store never reads a plain file: that would be a planted one.
    if (key) throw new Error('studio.json is not sealed but this store expects it to be.');
    return text;
  }
  if (!key) throw new Error('studio.json is sealed; this store has no key to open it.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parsed.data, 'base64')), decipher.final()]).toString('utf8');
}

const HOST_RE = /^[a-z0-9.-]+$/i;
const PROJECT_RE = /^[a-z0-9][a-z0-9.:_-]{1,120}$/i;
const DATASET_RE = /^[A-Za-z0-9_]{1,1024}$/;
const TABLE_RE = /^[a-z0-9][a-z0-9.:_-]{1,120}\.[A-Za-z0-9_]{1,1024}\.[A-Za-z0-9_$-]{1,1024}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ValidationError extends Error {}

function text(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeSite(input = {}) {
  const host = text(input.host).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!host || !HOST_RE.test(host)) throw new ValidationError('Enter a hostname like example.com.');
  const propertyId = text(input.propertyId).replace(/^properties\//, '');
  if (propertyId && !/^\d+$/.test(propertyId)) throw new ValidationError('GA4 property IDs are numeric.');

  let bq = null;
  if (input.bq && (input.bq.dataset || input.bq.billingProject)) {
    const billingProject = text(input.bq.billingProject);
    const dataProject = text(input.bq.dataProject) || billingProject;
    const dataset = text(input.bq.dataset);
    if (!PROJECT_RE.test(billingProject)) throw new ValidationError('Enter the GCP project that pays for BigQuery queries.');
    if (!PROJECT_RE.test(dataProject)) throw new ValidationError('The data project ID is not valid.');
    if (!DATASET_RE.test(dataset)) throw new ValidationError('The dataset looks like analytics_123456789.');
    const endDate = text(input.bq.endDate);
    if (endDate && !DATE_RE.test(endDate)) throw new ValidationError('End date must be YYYY-MM-DD.');
    const sessionsTable = text(input.bq.sessionsTable, 400);
    if (sessionsTable && !TABLE_RE.test(sessionsTable)) throw new ValidationError('Sessions table must be project.dataset.table.');
    const streamId = text(input.bq.streamId);
    if (streamId && !/^\d+$/.test(streamId)) throw new ValidationError('Stream IDs are numeric.');
    bq = {
      billingProject,
      dataProject,
      dataset,
      location: text(input.bq.location, 40),
      streamId,
      endDate,
      sessionsTable,
      maxBytes: Math.max(0, Number(input.bq.maxBytes) || 0) || 5e9,
    };
  }

  return {
    id: text(input.id) && input.id !== DEMO_SITE.id ? text(input.id) : randomUUID().slice(0, 8),
    label: text(input.label) || host,
    host,
    propertyId,
    streamName: text(input.streamName),
    includeSubdomains: Boolean(input.includeSubdomains),
    searchSite: text(input.searchSite, 300),
    bq,
    ...(Array.isArray(input.searchGroups) ? { searchGroups: normalizeGroups(input.searchGroups) } : {}),
    ...(input.leaveOut ? { leaveOut: normalizeLeaveOut(input.leaveOut) } : {}),
  };
}

// Visits a site leaves out of its BigQuery views: from these countries, and
// (by default) only when GA4 didn't count the visit as engaged, so real
// readers there still count. Country names are GA4's, e.g. "Singapore".
const COUNTRY_RE = /^[\p{L}][\p{L} .()’-]{1,59}$/u;

export function normalizeLeaveOut(input = {}) {
  const countries = [...new Set((Array.isArray(input.countries) ? input.countries : []).map((c) => text(c, 60)).filter(Boolean))];
  const bad = countries.find((c) => !COUNTRY_RE.test(c));
  if (bad) throw new ValidationError(`“${bad}” doesn’t look like a country name.`);
  if (countries.length > 20) throw new ValidationError('Leave out up to 20 countries.');
  return { countries, unengagedOnly: input.unengagedOnly !== false };
}

// Repos picked on a site briefly lived on the site; they belong to the site's
// product, which the site editor now edits. Moves them there once.
export function moveSiteRepos(state) {
  let moved = false;
  for (const site of state.sites || []) {
    if (!Array.isArray(site.repos)) continue;
    if (site.repos.length) {
      state.products ||= [];
      let product = state.products.find((p) => p.siteId === site.id);
      if (!product) {
        const base = String(site.label || site.host).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || site.id;
        const id = state.products.some((p) => p.id === base) ? `${base}-${site.id}` : base;
        product = { id, label: site.label || site.host, siteId: site.id, repos: [], extensionIds: [] };
        state.products.push(product);
      }
      product.repos = [...new Set([...(product.repos || []), ...site.repos])];
    }
    delete site.repos;
    moved = true;
  }
  return moved;
}

// What the browser may see: everything except credentials.
export function publicSite(site) {
  return {
    ...site,
    modes: {
      api: Boolean(site.demo || site.propertyId),
      search: Boolean(site.demo || site.searchSite),
      warehouse: Boolean(site.demo || site.bq),
      bing: !site.demo && Boolean(site.host),
      content: Boolean(site.demo || site.host),
    },
  };
}
