import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { ErrorState, Loading } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { BrandIcon } from '../components/BrandIcon.jsx';
import { Page } from './Page.jsx';
import { TimelineDialog } from './TimelineDialog.jsx';

const TYPES = { github: 'GitHub', api: 'JSON API', sql: 'SQL metric' };
const GITHUB_METRICS = { views: 'Repository views', pulls: 'Open pull requests', issues: 'Open issues', releases: 'Sync releases' };
const timelineHref = (site) => site ? `#/site/${encodeURIComponent(site.id)}/timeline` : '#/timeline';

export function TimelineJobs({ site, sites }) {
  const base = timelineHref(site);
  const writable = sites.filter((item) => !item.shared && !item.demo);
  const own = site && !site.shared && !site.demo;
  const [creating, setCreating] = useState(false);
  return (
    <Page title="Jobs" sub={own ? 'What Kauzl collects for this site, and when.' : writable.length ? 'What Kauzl collects for each site, and when. Pick a site:' : 'What Kauzl collects for each site, and when.'}
      back={{ href: base, label: 'Timeline' }}
      actions={own && <button type="button" class="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={14} /> New job</button>}>
      {own ? <JobManager key={site.id} site={site} base={base} creating={creating} setCreating={setCreating} />
        : writable.length ? (
          // Your own sites, one click each (sample and shared sites don't run jobs).
          <div class="nx-pick">
            {writable.map((item) => (
              <a key={item.id} class="nx-pick-row" href={`#/site/${encodeURIComponent(item.id)}/jobs`}>
                <b>{item.label}</b><span class="muted">{item.host}</span>
              </a>
            ))}
          </div>
        ) : (
          <section class="card card-plain stack tl-jobs">
            <p class="m-0">
              {site?.demo ? 'The Demo site is sample data, so it doesn’t run jobs.'
                : site?.shared ? `${site.label} is shared with you to view, so its jobs are set up by ${site.shared.by}.`
                : 'Jobs run for your own sites, and you haven’t added one yet.'}
              {' '}Add your site and Kauzl starts collecting its visits, searches and releases.
            </p>
            <div class="row"><a class="btn primary" href="#/account?tab=sites&edit=new"><Icon name="plus" size={14} /> Add a site</a></div>
          </section>
        )}
    </Page>
  );
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

// "5 min", "3 h", "2 days"; for "… ago" and "in …".
function span(ms) {
  const m = Math.max(1, Math.round(Math.abs(ms) / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}
const ago = (at, now) => (now - at < MIN ? 'just now' : `${span(now - at)} ago`);
const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fullTime = (at) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function every(ms) {
  if (!ms) return 'When Timeline opens';
  if (ms >= DAY) return ms === DAY ? 'Daily' : `Every ${span(ms)}`;
  return ms % (60 * MIN) === 0 ? (ms === 60 * MIN ? 'Hourly' : `Every ${ms / (60 * MIN)} h`) : `Every ${ms / MIN} min`;
}

// A status the user has to act on, and what Kauzl is doing otherwise.
const needsYou = (status) => /attention|^Needs|^Check|^Link a/.test(status || '');

// One row's cells, the same for both kinds: state, schedule, last run, next run.
function runCells({ state, schedule, last, next, now }) {
  return (
    <>
      <td class="tl-sched-when">{schedule}</td>
      <td class="tl-sched-last">
        <span class={`tl-run ${state}`}><span class={`nx-dot${state === 'ok' ? ' on' : state === 'bad' ? ' bad' : ''}`} aria-hidden="true" />
          {last.at ? <span title={fullTime(last.at)}>{last.label} {ago(last.at, now)}</span> : <span>{last.label}</span>}
        </span>
      </td>
      <td class="tl-sched-next">{next}</td>
    </>
  );
}

function nextRun({ lastAt, everyMs, now, paused, running }) {
  if (running) return <span class="tl-run run">Running…</span>;
  if (paused) return <span class="muted">Paused</span>;
  if (!everyMs) return <span class="muted">—</span>;
  if (!lastAt) return <span class="muted">—</span>;
  const at = lastAt + everyMs;
  return at <= now ? 'Due now' : <span title={fullTime(at)}>in {span(at - now)}</span>;
}

function JobManager({ site, base, creating, setCreating }) {
  const url = `/sites/${site.id}/timeline-jobs`;
  const data = useAsync(() => api.get(url), [url]);
  const [running, setRunning] = useState({});
  const [error, setError] = useState(null);

  async function act(job, remove = false) {
    if (remove && !confirm(`Remove “${job.label}” and its saved Timeline values?`)) return;
    setError(null);
    setRunning((current) => ({ ...current, [job.id]: true }));
    try {
      if (remove) await api.del(`${url}/${job.id}`);
      else await api.post(`${url}/${job.id}/run`, {});
      data.reload();
    } catch (err) {
      setError(err);
    } finally {
      setRunning((current) => ({ ...current, [job.id]: false }));
    }
  }

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={240} />;
  const now = Date.now();
  const auto = (data.data.automatic || []).map((job) => autoRow(job, now));
  const own = data.data.jobs.map((job) => ownRow(job, now, running[job.id]));
  const openKey = new URLSearchParams(location.hash.split('?')[1] || '').get('job');
  const open = [...auto, ...own].find((row) => row.key === openKey);
  const jobsHref = `#/site/${encodeURIComponent(site.id)}/jobs`;
  const href = (key) => `${jobsHref}?job=${encodeURIComponent(key)}`;
  const go = (key) => { location.hash = href(key); };

  return (
    <div class="stack tl-jobs">
      {error && <ErrorState error={error} />}
      {creating && <TimelineDialog title="New Timeline job" onClose={() => setCreating(false)}>
        <JobForm site={site} url={url} metrics={data.data.metrics} onClose={() => setCreating(false)} onSaved={() => {
          setCreating(false);
          data.reload();
        }} />
      </TimelineDialog>}

      <div class="card tl-sched-wrap">
        <table class="data tl-sched">
          <thead>
            <tr><th>Job</th><th>Schedule</th><th>Last run</th><th>Next run</th><th><span class="sr-only">Open</span></th></tr>
          </thead>
          <tbody>
            <tr class="tl-sched-group"><th colSpan={5} scope="colgroup">
              <span>Built in · from your connections</span>
              <a class="todo-link" href={`#/account?tab=sites&edit=${encodeURIComponent(site.id)}`}>Manage connections →</a>
            </th></tr>
            {auto.length ? auto.map((row) => <SchedRow key={row.key} row={row} href={href(row.key)} onOpen={() => go(row.key)} selected={row.key === openKey} now={now} />)
              : <tr><td colSpan={5} class="muted">Connect a data source and its sync shows up here.</td></tr>}
            <tr class="tl-sched-group"><th colSpan={5} scope="colgroup"><span>Your jobs</span></th></tr>
            {own.length ? own.map((row) => <SchedRow key={row.key} row={row} href={href(row.key)} onOpen={() => go(row.key)} selected={row.key === openKey} now={now} />)
              : <tr><td colSpan={5} class="muted">None yet. A job can sync GitHub, or collect one number a day from an API or a SQL query, and show it on the Timeline.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <JobPanel row={open} close={jobsHref} now={now}>
          {open.custom ? (
            <OwnJobPanel job={open.job} row={open} site={site} url={url} base={base} metrics={data.data.metrics} busy={open.running}
              onRun={() => act(open.job)} onRemove={async () => { await act(open.job, true); location.hash = jobsHref; }}
              onSaved={data.reload} />
          ) : <AutoJobPanel job={open.job} base={base} />}
        </JobPanel>
      )}
    </div>
  );
}

// A built-in sync, as one scheduler row.
function autoRow(job, now) {
  const bad = needsYou(job.status);
  return {
    key: `auto:${job.id}`, job, custom: false, brand: job.id, label: job.label, sub: job.output,
    state: bad ? 'bad' : job.lastSync || job.lastReported ? 'ok' : 'wait',
    schedule: every(job.every),
    last: bad ? { label: job.status } : job.lastSync ? { label: 'Synced', at: job.lastSync }
      : job.lastReported ? { label: `Data to ${shortDay(job.lastReported)}` } : { label: job.every ? 'Not run yet' : job.status },
    next: nextRun({ lastAt: job.lastSync, everyMs: job.every, now, paused: bad, running: job.status === 'Syncing' }),
    running: job.status === 'Syncing',
  };
}

// A job you made, as one scheduler row.
function ownRow(job, now, clicked) {
  const busy = Boolean(clicked || job.running);
  const failed = Boolean(job.error);
  return {
    key: `job:${job.id}`, job, custom: true, brand: job.type, label: job.label, error: job.error,
    sub: [job.type === 'github' ? GITHUB_METRICS[job.githubMetric || 'releases'] : TYPES[job.type], job.repo].filter(Boolean).join(' · '),
    state: failed ? 'bad' : job.lastSuccess ? 'ok' : 'wait',
    schedule: job.schedule === 'daily' ? 'Daily' : 'On demand',
    last: job.lastRun ? { label: failed ? 'Failed' : 'Succeeded', at: job.lastRun } : { label: 'Never run' },
    next: nextRun({ lastAt: job.lastRun, everyMs: job.schedule === 'daily' ? DAY : 0, now, running: busy }),
    running: busy,
  };
}

// The whole row opens the job; the name is the link, for keyboards and new tabs.
function SchedRow({ row, href, onOpen, selected, now }) {
  return (
    <tr class={`clickable${selected ? ' selected' : ''}`} onClick={(e) => { if (!e.target.closest('a')) onOpen(); }}>
      <td class="tl-sched-job"><div class="tl-sched-id">
        <BrandIcon name={row.brand} />
        <div>
          <a class="tl-sched-name" href={href}>{row.label}</a>
          <small>{row.sub}</small>
          {row.error && <small class="bad">{row.error}</small>}
        </div>
      </div></td>
      {runCells({ ...row, now })}
      <td class="tl-sched-go" aria-hidden="true"><Icon name="chevron" size={14} /></td>
    </tr>
  );
}

// One side panel for the clicked job, like the app's day and page panels; a sheet on phones.
function JobPanel({ row, close, now, children }) {
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') location.hash = close; };
    addEventListener('keydown', onKey);
    box.current?.focus();
    return () => removeEventListener('keydown', onKey);
  }, [row.key]);
  return (
    <div class="nx-drawer-wrap">
      <a class="nx-drawer-scrim" href={close} aria-label="Close the panel" tabIndex={-1} />
      <aside ref={box} tabIndex={-1} class="nx-drawer sp" role="dialog" aria-modal="true" aria-label={row.label}>
        <span class="nx-grab nx-drawer-grab" aria-hidden="true" />
        <header class="sp-h">
          <div class="sp-bar">
            <nav class="sp-trail" aria-label="Kind"><span class="sp-kind">{row.custom ? 'Your job' : 'Built-in sync'}</span></nav>
            <a class="nx-icon-btn" href={close} aria-label="Close"><Icon name="x" size={14} /></a>
          </div>
          <div class="tl-jp-id">
            <BrandIcon name={row.brand} large />
            <div>
              <h2 class="sp-title">{row.label}</h2>
              {row.sub && <p class="muted small m-0">{row.sub}</p>}
            </div>
          </div>
        </header>
        <div class="nx-drawer-body tl-jp">
          <dl class="tl-jp-facts">
            <dt>Schedule</dt><dd>{row.schedule}</dd>
            <dt>Last run</dt><dd><span class={`tl-run ${row.state}`}><span class={`nx-dot${row.state === 'ok' ? ' on' : row.state === 'bad' ? ' bad' : ''}`} aria-hidden="true" />
              {row.last.at ? `${row.last.label} ${ago(row.last.at, now)} · ${fullTime(row.last.at)}` : row.last.label}</span></dd>
            <dt>Next run</dt><dd>{row.next}</dd>
          </dl>
          {row.error && <p class="bad small m-0" role="status">{row.error}</p>}
          {children}
        </div>
      </aside>
    </div>
  );
}

function AutoJobPanel({ job, base }) {
  const timeline = job.timeline && (Object.keys(job.timeline).length ? `${base}?${new URLSearchParams(job.timeline)}` : base);
  const bad = needsYou(job.status);
  return (
    <>
      <div class="row gap-8">
        {timeline && <a class="btn primary" href={timeline}>See on Timeline</a>}
        <a class="btn" href={job.settings}>{bad ? 'Fix the connection' : 'Connection settings'}</a>
      </div>
      <p class="note m-0">Kauzl runs this sync for you on the schedule above. What it collects is set in the connection’s settings.</p>
    </>
  );
}

function OwnJobPanel({ job, row, site, url, base, metrics, busy, onRun, onRemove, onSaved }) {
  const releases = job.type === 'github' && (!job.githubMetric || job.githubMetric === 'releases');
  const [saved, setSaved] = useState(false);
  return (
    <>
      <div class="row gap-8">
        <button type="button" class="btn primary" disabled={busy} onClick={onRun}>{busy ? 'Running…' : 'Run now'}</button>
        {job.lastSuccess && <a class="btn" href={releases ? base : `${base}?by=job&f=${encodeURIComponent(job.id)}`}>See on Timeline</a>}
      </div>
      <section class="tl-jp-config" aria-labelledby="tl-jp-config">
        <h3 id="tl-jp-config" class="nx-label-sm">Configure</h3>
        <JobForm key={`${job.id}:${job.updatedAt || ''}`} site={site} url={url} metrics={metrics} job={job}
          onSaved={() => { setSaved(true); onSaved(); }} onChange={() => setSaved(false)} />
        {saved && <p class="good small m-0" role="status">Saved.</p>}
      </section>
      <section class="tl-jp-danger">
        <button type="button" class="btn ghost danger" disabled={busy} onClick={onRemove}>Remove job</button>
        <span class="muted small">Its values leave the Timeline too.</span>
      </section>
    </>
  );
}

export function NewTimelineJob({ site, onClose, onSaved }) {
  const url = `/sites/${site.id}/timeline-jobs`;
  const data = useAsync(() => api.get(url), [url]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={120} />;
  return <JobForm site={site} url={url} metrics={data.data.metrics} onClose={onClose} onSaved={onSaved} />;
}

// New job (no `job`), or a saved job's configuration (`job`), which saves in place.
function JobForm({ site, url, metrics, job = null, onClose, onSaved, onChange }) {
  const [form, setForm] = useState(job
    ? { type: job.type, label: job.label, schedule: job.schedule, url: job.url || '', path: job.path || '', token: '', clearToken: false, metricId: job.metricId || '', githubMetric: job.githubMetric || 'releases', repo: job.repo || '' }
    : { type: 'github', label: '', schedule: 'manual', url: '', path: '', token: '', metricId: '', githubMetric: 'views', repo: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const field = (key) => (event) => {
    const value = event.currentTarget.type === 'checkbox' ? event.currentTarget.checked : event.currentTarget.value;
    setForm((current) => ({ ...current, [key]: value }));
    onChange?.();
  };

  async function save(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post(job ? `${url}/${job.id}` : url, form);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="stack tl-job-form" onSubmit={save}>
      <div class="tl-create-fields">
        <label>Job name<input value={form.label} maxLength={80} required onInput={field('label')} /></label>
        <label>Source<select value={form.type} onChange={field('type')}>{Object.entries(TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Run<select value={form.schedule} onChange={field('schedule')}><option value="manual">On demand</option><option value="daily">Daily</option></select></label>
      </div>
      {form.type === 'github' && (
        <>
          <div class="tl-create-fields">
            <label>Metric<select value={form.githubMetric} onChange={field('githubMetric')}>
              {Object.entries(GITHUB_METRICS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></label>
            {form.githubMetric !== 'releases' && <label>Repository<input value={form.repo} required maxLength={150} placeholder="owner/repo" onInput={field('repo')} /></label>}
          </div>
          <p class="muted small m-0">Uses your connected GitHub account. <a href="#/account?i=github">GitHub settings</a></p>
        </>
      )}
      {form.type === 'api' && (
        <div class="tl-create-fields">
          <label>Public HTTPS endpoint<input type="url" value={form.url} required onInput={field('url')} placeholder="https://example.com/stats" /></label>
          <label>Numeric JSON field<input value={form.path} onInput={field('path')} placeholder="e.g. totals.visits" /></label>
          <label>Bearer token (optional)<input value={form.token} type="password" autoComplete="off" maxLength={4096} onInput={field('token')}
            placeholder={job?.authenticated && !form.clearToken ? 'Saved. Leave blank to keep it' : ''} disabled={form.clearToken} /></label>
        </div>
      )}
      {form.type === 'api' && job?.authenticated && (
        <label class="tl-check"><input type="checkbox" checked={form.clearToken} onChange={field('clearToken')} /> Remove the saved token</label>
      )}
      {form.type === 'api' && <p class="muted small m-0">The job uses GET and saves one value per day. Leave the field blank if the response is a single number.</p>}
      {form.type === 'sql' && (
        <>
          {metrics.length > 0 && <label>Connected SQL metric<select required value={form.metricId} onChange={field('metricId')}>
            <option value="">Choose a query</option>
            {metrics.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select></label>}
          <a class="todo-link" href={`#/account?${new URLSearchParams({ i: 'metrics', edit: 'new', site: site.id, timeline: 'jobs' })}`}>Set up a read-only SQL query →</a>
        </>
      )}
      {error && <ErrorState error={error} />}
      <div class="row gap-8">
        <button type="submit" class={`btn${job ? '' : ' primary'}`} disabled={busy || (form.type === 'sql' && !form.metricId)}>{busy ? 'Saving…' : job ? 'Save changes' : 'Create job'}</button>
        {onClose && <button type="button" class="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>}
      </div>
      {job && <p class="muted small m-0">Changing where the number comes from starts its Timeline values over.</p>}
    </form>
  );
}
