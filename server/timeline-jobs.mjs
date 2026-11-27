import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { guardedAgent } from './net-guard.mjs';
import { ValidationError } from './store.mjs';

const DAY = 86_400_000;
const MAX_JOBS = 30;
const MAX_BYTES = 512 * 1024;
const KINDS = ['github', 'api', 'sql'];
const GITHUB_METRICS = ['releases', 'views', 'pulls', 'issues'];
const isReleaseSync = (job) => job.type === 'github' && (!job.githubMetric || job.githubMetric === 'releases');
const dateOf = (ms) => new Date(ms).toISOString().slice(0, 10);

function apiUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw new ValidationError('Enter a public HTTPS API URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !url.hostname.includes('.') || isIP(url.hostname) || (url.port && url.port !== '443')) {
    throw new ValidationError('Use a public HTTPS URL without credentials, a fragment, or a custom port.');
  }
  return url.href;
}

async function readValue(response, path) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`API returned HTTP ${response.status}.`);
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body || []) {
    length += chunk.length;
    if (length > MAX_BYTES) throw new Error('API response exceeded 512 KB.');
    chunks.push(chunk);
  }
  let value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  for (const part of path ? path.split('.') : []) value = value != null && Object.hasOwn(value, part) ? value[part] : undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('The selected JSON field must contain a number.');
  return value;
}

export function createTimelineJobs({ store, github, metrics, automaticJobs = async () => [], fetchImpl = fetch, now = Date.now }) {
  const running = new Map();
  let dispatcher;
  let timer;
  const jobs = async () => (await store.get()).timelineJobs || [];
  const view = ({ points, token, ...job }) => ({ ...job, authenticated: Boolean(token), running: running.has(job.id) });

  async function list(siteId) {
    const configured = (await metrics.list()).filter((metric) => metric.siteId === siteId);
    return {
      automatic: await automaticJobs(siteId),
      jobs: (await jobs()).filter((job) => job.siteId === siteId).map(view),
      metrics: configured.map(({ id, label }) => ({ id, label })),
    };
  }

  // The checks for a new or edited job. On an edit, a blank token keeps the saved one
  // (it's never sent back to the browser); clearToken removes it.
  async function shape(siteId, input, previous = null) {
    const type = input?.type;
    const label = String(input?.label || '').trim();
    if (!KINDS.includes(type) || !label || label.length > 80) throw new ValidationError('Choose a job type and a name of up to 80 characters.');
    const job = { type, label, schedule: input.schedule === 'daily' ? 'daily' : 'manual' };
    if (type === 'github') {
      job.githubMetric = input.githubMetric || 'releases';
      if (!GITHUB_METRICS.includes(job.githubMetric)) throw new ValidationError('Choose a GitHub metric.');
      if (!isReleaseSync(job)) {
        job.repo = String(input.repo || '').trim();
        if (job.repo.length > 150 || !/^[\w.-]+\/[\w.-]+$/.test(job.repo) || job.repo.split('/').some((part) => part === '.' || part === '..')) throw new ValidationError('Enter a GitHub repository as owner/repo.');
      }
    }
    if (type === 'api') {
      job.url = apiUrl(input.url);
      job.path = String(input.path || '').trim();
      const typed = String(input.token || '').trim();
      const token = typed || (!input.clearToken && previous?.type === 'api' ? previous.token || '' : '');
      if (token && (token.length > 4096 || !/^[!-~]+$/.test(token))) throw new ValidationError('Enter a bearer token without spaces or line breaks.');
      if (token) job.token = token;
      if (job.path && (job.path.length > 200 || !/^[\w-]+(?:\.[\w-]+)*$/.test(job.path))) {
        throw new ValidationError('Enter a dot-separated JSON field path, such as totals.visits.');
      }
    }
    if (type === 'sql') {
      const metric = (await metrics.list()).find((m) => m.id === input.metricId && m.siteId === siteId);
      if (!metric) throw new ValidationError('Choose a connected SQL metric for this site.');
      job.metricId = metric.id;
    }
    return job;
  }

  // What a job measures: when this changes, its old values no longer belong to it.
  const measures = (job) => JSON.stringify([job.type, job.githubMetric || '', job.repo || '', job.url || '', job.path || '', job.metricId || '']);

  async function create(siteId, input) {
    const job = { id: randomUUID(), siteId, ...(await shape(siteId, input)), createdAt: now(), points: {} };
    await store.update((state) => {
      const saved = state.timelineJobs || [];
      if (saved.filter((item) => item.siteId === siteId).length >= MAX_JOBS) throw new ValidationError(`Keep at most ${MAX_JOBS} jobs per site.`);
      state.timelineJobs = [...saved, job];
    });
    return view(job);
  }

  async function update(siteId, id, input) {
    const previous = (await jobs()).find((job) => job.id === id && job.siteId === siteId);
    if (!previous) throw new ValidationError('That job no longer exists.');
    if (running.has(id)) throw new ValidationError('Wait for this run to finish, then save.');
    const next = await shape(siteId, input, previous);
    const fresh = measures(next) !== measures(previous);
    let saved;
    await store.update((state) => {
      const index = (state.timelineJobs || []).findIndex((job) => job.id === id && job.siteId === siteId);
      if (index < 0) throw new ValidationError('That job no longer exists.');
      const { id: keepId, siteId: keepSite, createdAt, points, lastRun, lastSuccess, error } = state.timelineJobs[index];
      saved = { id: keepId, siteId: keepSite, createdAt, ...next, updatedAt: now(), points: fresh ? {} : points,
        ...(fresh ? {} : { lastRun, lastSuccess, error }) };
      state.timelineJobs[index] = saved;
    });
    return view(saved);
  }

  async function run(job) {
    const at = now();
    let error = '';
    let result = {};
    try {
      if (job.type === 'github') {
        if (isReleaseSync(job)) {
          const sync = await github.sync();
          if (sync.failures) throw new Error(`GitHub synced with errors in ${sync.failures} repositories.`);
        } else {
          result = await github.timelineMetric(job.repo, job.githubMetric, dateOf(at));
        }
      } else if (job.type === 'sql') {
        const metric = (await metrics.list()).find((m) => m.id === job.metricId && m.siteId === job.siteId);
        if (!metric) throw new Error('The connected SQL metric has been removed.');
        const data = await metrics.run(metric, '28d', { fresh: true });
        result = Object.fromEntries(data.dates.map((date, i) => [date, data.values[i]]));
      } else {
        dispatcher ||= guardedAgent();
        const response = await fetchImpl(job.url, {
          method: 'GET', redirect: 'error', dispatcher,
          headers: { Accept: 'application/json', ...(job.token ? { Authorization: `Bearer ${job.token}` } : {}) }, signal: AbortSignal.timeout(15_000),
        });
        result = { [dateOf(at)]: await readValue(response, job.path) };
      }
    } catch (err) {
      // fetch says only "fetch failed"; say which address couldn't be reached.
      const unreachable = err instanceof TypeError && /fetch failed/i.test(err.message) && job.url;
      const message = err instanceof SyntaxError ? 'The API response was not valid JSON.'
        : unreachable ? `Couldn’t reach ${new URL(job.url).host}. Check the address, and that it answers from the internet.`
          : err.message || 'The job failed.';
      error = (job.token ? message.replaceAll(job.token, '[hidden]') : message).slice(0, 300);
    }
    let saved;
    await store.update((state) => {
      const current = state.timelineJobs?.find((item) => item.id === job.id);
      if (!current) return;
      current.lastRun = at;
      current.error = error;
      if (!error) {
        current.lastSuccess = now();
        const cutoff = dateOf(at - 400 * DAY);
        current.points = Object.fromEntries(Object.entries({ ...current.points, ...result }).filter(([date, value]) => date >= cutoff && Number.isFinite(value)));
      }
      saved = current;
    });
    return saved;
  }

  async function runNow(siteId, id) {
    const job = (await jobs()).find((item) => item.id === id && item.siteId === siteId);
    if (!job) throw new ValidationError('That job no longer exists.');
    if (!running.has(id)) running.set(id, run(job).finally(() => running.delete(id)));
    const saved = await running.get(id);
    return saved ? view(saved) : null;
  }

  async function remove(siteId, id) {
    await store.update((state) => {
      state.timelineJobs = (state.timelineJobs || []).filter((job) => job.id !== id || job.siteId !== siteId);
    });
    return { ok: true };
  }

  async function tick() {
    const sites = new Set((await store.sites()).map((site) => site.id));
    const due = (await jobs()).filter((job) => sites.has(job.siteId) && job.schedule === 'daily' && now() - (job.lastRun || 0) >= DAY);
    for (const job of due) {
      if (running.has(job.id)) continue;
      try {
        await runNow(job.siteId, job.id);
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
      }
    }
  }

  async function series(siteId) {
    return (await jobs()).filter((job) => job.siteId === siteId && !isReleaseSync(job))
      .map(({ id, label, points }) => ({ id, label, points }));
  }

  return {
    list, create, update, runNow, remove, series, tick,
    start() {
      if (timer) return;
      const sync = () => tick().catch((err) => console.warn('[timeline jobs]', err.message));
      sync();
      timer = setInterval(sync, 60_000);
      timer.unref?.();
    },
  };
}

export function timelineJobRoutes({ jobs, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/timeline-jobs$/, async ({ match }) => jobs.list((await siteOr404(match[1])).id)],
    ['POST', /^\/api\/sites\/([\w-]+)\/timeline-jobs$/, async ({ match, body }) => jobs.create((await siteOr404(match[1])).id, body)],
    ['POST', /^\/api\/sites\/([\w-]+)\/timeline-jobs\/([\w-]+)$/, async ({ match, body }) => jobs.update((await siteOr404(match[1])).id, match[2], body)],
    ['POST', /^\/api\/sites\/([\w-]+)\/timeline-jobs\/([\w-]+)\/run$/, async ({ match }) => jobs.runNow((await siteOr404(match[1])).id, match[2])],
    ['DELETE', /^\/api\/sites\/([\w-]+)\/timeline-jobs\/([\w-]+)$/, async ({ match }) => jobs.remove((await siteOr404(match[1])).id, match[2])],
  ];
}
