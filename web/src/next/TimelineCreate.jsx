import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { BrandIcon } from '../components/BrandIcon.jsx';
import { TimelineDialog } from './TimelineDialog.jsx';
import { NewTimelineJob } from './TimelineJobs.jsx';
import { TimelineAdd } from '../pages/Calendar.jsx';
import { GoalsEdit } from './GoalsEdit.jsx';

// Things you add yourself; each opens its own form in place of the chooser.
const ADD = [
  { key: 'note', icon: 'star', label: 'Note or post', fact: 'Something you did: a launch, a post, a newsletter' },
  { key: 'custom', icon: 'calendar', label: 'Manual event', fact: 'A dated event with a number, like webinar signups' },
  { key: 'goal', icon: 'target', label: 'Goal', fact: 'What counts as success on this site', site: true },
  { key: 'jobs', icon: 'database', label: 'Job', fact: 'One number a day from an API, SQL or GitHub', site: true },
];

// Sources that put data on the Timeline by themselves once connected. `id` matches
// the site's built-in jobs (server/timeline-sources.mjs), which say what's on already.
const SOURCES = [
  { id: 'analytics', label: 'Google Analytics', fact: 'Visits, pages and where people came from', part: 'analytics' },
  { id: 'search', label: 'Search Console', fact: 'Google search clicks and queries', part: 'analytics' },
  { id: 'fly', label: 'Fly.io', fact: 'Releases, marked on the day they ship', href: '#/account?i=fly' },
  { id: 'netlify', label: 'Netlify', fact: 'Production deploys, failed ones too, on the day they ship', href: '#/account?i=netlify' },
  { id: 'vercel', label: 'Vercel', fact: 'Production deploys, marked on the day they ship', part: 'hosting' },
  { id: 'firebase', label: 'Firebase App Hosting', fact: 'Rollouts, marked on the day they ship', part: 'hosting' },
  { id: 'github', label: 'GitHub', fact: 'Releases and repository activity', part: 'code' },
  { id: 'bing', label: 'Bing Webmaster Tools', fact: 'Bing search clicks and impressions', href: '#/account?i=bing' },
  { id: 'extensions', label: 'Extension stores', fact: 'Extension versions and listing changes', part: 'distribution' },
  { id: 'sql', label: 'SQL metric', fact: 'A number from your own database, each day', metric: true },
];

export function TimelineCreate({ scope, sites, date, today, customTypes, jobsHref, onClose, onAdded, onGoalSaved }) {
  const [mode, setMode] = useState('');
  const [goalSite, setGoalSite] = useState(scope === 'all' ? '' : scope);
  const writable = sites.filter((site) => !site.shared && !site.demo);
  const target = writable.find((site) => site.id === goalSite);
  const picked = ADD.find((item) => item.key === mode);
  const sitePicker = scope === 'all' && writable.length > 0 && (
    <label class="tl-add-site">Site <select value={goalSite} onChange={(e) => setGoalSite(e.currentTarget.value)}>
      <option value="">Choose a site</option>
      {writable.map((site) => <option key={site.id} value={site.id}>{site.label}</option>)}
    </select></label>
  );

  // One form at a time, with a way back to the chooser.
  if (picked) {
    return (
      <TimelineDialog title={picked.label} onClose={onClose}>
        <button type="button" class="todo-link tl-add-back" onClick={() => setMode('')}>← Add something else</button>
        {mode === 'note' && <TimelineAdd site={scope} sites={sites} date={date} today={today} onClose={() => setMode('')} onAdded={() => onAdded()} />}
        {mode === 'custom' && <CustomEvent scope={scope} date={date} today={today} customTypes={customTypes} onAdded={onAdded} />}
        {picked.site && sitePicker}
        {mode === 'jobs' && target && <NewTimelineJob key={target.id} site={target} onClose={() => setMode('')} onSaved={() => {
          location.hash = `/site/${encodeURIComponent(target.id)}/jobs`;
          onClose();
        }} />}
        {mode === 'jobs' && <a class="todo-link" href={jobsHref}>All jobs →</a>}
        {mode === 'goal' && target && <GoalsEdit key={target.id} site={target} done={(result) => {
          if (result?.saved) onGoalSaved(target);
          else setMode('');
        }} />}
      </TimelineDialog>
    );
  }

  return (
    <TimelineDialog title="Add to Timeline" onClose={onClose}>
      <section class="tl-add-sec" aria-labelledby="tl-add-yours">
        <h3 id="tl-add-yours" class="nx-label-sm">Add something</h3>
        <div class="tl-add-grid">
          {ADD.filter((item) => !item.site || writable.length > 0).map((item) => (
            <button key={item.key} type="button" class="tl-add-opt" onClick={() => setMode(item.key)}>
              <span class="tl-add-ic"><Icon name={item.icon} size={16} /></span>
              <span class="tl-add-b"><b>{item.label}</b><small>{item.fact}</small></span>
            </button>
          ))}
        </div>
      </section>
      <section class="tl-add-sec" aria-labelledby="tl-add-src">
        <div class="tl-add-head">
          <h3 id="tl-add-src" class="nx-label-sm">Connect a source</h3>
          <a class="todo-link small" href="#/account?tab=integrations">All connections →</a>
        </div>
        {sitePicker}
        {target ? <SourceList site={target} /> : !writable.length
          ? <a class="btn self-start" href="#/account?tab=sites&edit=new">Set up a site first</a>
          : <p class="muted small m-0">Choose a site to see what’s connected.</p>}
      </section>
    </TimelineDialog>
  );
}

// Each source in its own colours, saying whether it already feeds this site's Timeline.
function SourceList({ site }) {
  const on = useAsync(() => api.get(`/sites/${site.id}/timeline-jobs`).catch(() => null), [site.id]);
  const live = new Set((on.data?.automatic || []).filter((row) => !/^Needs|attention/.test(row.status || '')).map((row) => row.id));
  const hasMetric = (on.data?.jobs || []).some((job) => job.type === 'sql');
  const siteHref = (part) => `#/account?${new URLSearchParams({ tab: 'sites', edit: site.id, timeline: '1', part })}`;
  const metricHref = `#/account?${new URLSearchParams({ i: 'metrics', edit: 'new', site: site.id, timeline: '1' })}`;
  return (
    <ul class="tl-src-list">
      {SOURCES.map((src) => {
        const connected = src.metric ? hasMetric : live.has(src.id);
        const href = src.metric ? metricHref : src.href || siteHref(src.part);
        return (
          <li key={src.id}>
            <a class="tl-src" href={href}>
              <BrandIcon name={src.id} />
              <span class="tl-src-b"><b>{src.label}</b><small>{src.fact}</small></span>
              {on.data && (connected
                ? <span class="tl-src-on"><span class="nx-dot on" aria-hidden="true" />On Timeline</span>
                : <span class="tl-src-go">{src.metric ? 'Add' : 'Connect'} →</span>)}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function CustomEvent({ scope, date, today, customTypes, onAdded }) {
  const [type, setType] = useState('');
  const [label, setLabel] = useState('');
  const [day, setDay] = useState(date > today ? today : date);
  const [value, setValue] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const added = await api.post('/annotations', {
        kind: 'custom', eventType: type, label, date: day, value, body: details,
        scope: scope === 'all' ? '' : `site:${scope}`,
      });
      onAdded(added);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="stack tl-create-event" onSubmit={save}>
      <div class="tl-create-fields">
        <label>Event type<input value={type} list="timeline-event-types" required maxLength={60} placeholder="e.g. Newsletter" onInput={(e) => setType(e.currentTarget.value)} /></label>
        <datalist id="timeline-event-types">{customTypes.map(({ key, label }) => <option key={key} value={label} />)}</datalist>
        <label>Date<input type="date" value={day} max={today} required onInput={(e) => setDay(e.currentTarget.value)} /></label>
        <label>Event name<input value={label} required maxLength={140} placeholder="e.g. November issue sent" onInput={(e) => setLabel(e.currentTarget.value)} /></label>
        <label>Chart value<input type="number" value={value} min="0" max="1000000000000" step="any" placeholder="1" onInput={(e) => setValue(e.currentTarget.value)} /></label>
      </div>
      <label>Details (optional)<textarea value={details} rows={2} maxLength={4000} onInput={(e) => setDetails(e.currentTarget.value)} /></label>
      <p class="muted small m-0">Events of the same type share a Timeline view. Leave the value blank to count this event as 1.</p>
      {error && <ErrorState error={error} />}
      <div><button class="btn primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add event'}</button></div>
    </form>
  );
}
