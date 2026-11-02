// Local-first persistence: one JSON file under .data/ (or STUDIO_DATA_DIR),
// written atomically with owner-only permissions because it holds tokens.

import { readFile, writeFile, rename, mkdir, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
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

export function createStore(dir = process.env.STUDIO_DATA_DIR || resolve('.data')) {
  const file = join(dir, 'studio.json');
  let state = null;
  let writing = Promise.resolve();

  async function load() {
    if (state) return state;
    try {
      state = { ...EMPTY, ...JSON.parse(await readFile(file, 'utf8')) };
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      state = structuredClone(EMPTY);
    }
    return state;
  }

  async function save() {
    const snapshot = JSON.stringify(state, null, 2);
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
  };
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
    },
  };
}
