import { api, qs } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Icon } from '../../components/icons.jsx';

// Settings → Products → Goals: what a product counts as progress (steps) and
// as a result (outcomes). Empty means Studio guesses from the site's event names.
const TYPES = [
  { key: 'event', label: 'Site event', needs: 'site' },
  { key: 'page', label: 'Page visited', needs: 'site' },
  { key: 'installs', label: 'Store installs', needs: 'store' },
  { key: 'downloads', label: 'Release downloads', needs: 'repos' },
  { key: 'stars', label: 'New GitHub stars', needs: 'repos' },
];

// One-click goals for the usual business results.
const PRESETS = [
  { label: 'Store installs', source: 'installs', role: 'outcome', needs: 'store' },
  { label: 'Desktop downloads', source: 'downloads', role: 'outcome', needs: 'repos' },
  { label: 'GitHub stars', source: 'stars', role: 'outcome', needs: 'repos' },
  { label: 'Purchase', source: 'event', match: 'purchase', role: 'outcome', needs: 'site' },
  { label: 'Sign-up', source: 'event', match: 'sign_up', role: 'outcome', needs: 'site' },
  { label: 'Viewed pricing', source: 'page', match: '/pricing', role: 'step', needs: 'site' },
];

const same = (a, b) => a.source === b.source && (a.match || '') === (b.match || '');

export function GoalsEditor({ goals, onChange, siteId, hasStore, hasRepos }) {
  const info = useAsync(() => api.get(`/outcomes/goals${qs({ site: siteId, store: hasStore, repos: hasRepos })}`), [siteId, hasStore, hasRepos]);
  const has = { site: Boolean(siteId), store: hasStore, repos: hasRepos };
  const events = info.data?.events || [];
  const suggested = info.data?.suggested || [];
  const update = (i, patch) => onChange(goals.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const add = (g) => !goals.some((x) => same(x, g)) && onChange([...goals, { label: g.label, source: g.source, match: g.match || '', role: g.role || 'outcome' }]);
  const unusedEvents = events.filter((e) => !goals.some((g) => g.source === 'event' && g.match === e.name)).slice(0, 8);
  const config = useAsync(() => (siteId ? api.get(`/sites/${siteId}/config`) : null), [siteId]);
  const fileGoals = config.data?.config?.goals?.length || 0;

  return (
    <div class="stack" style={{ gap: '10px' }}>
      {fileGoals > 0 && (
        <p class="note" style={{ margin: 0 }}>
          <b>The site’s repo file sets {fileGoals} goal{fileGoals === 1 ? '' : 's'}</b>, and those are the ones measured; the goals here aren’t used while it does.{' '}
          <a href={`#/site/${siteId}/setup`}>Edit them in Setup</a>
        </p>
      )}
      {!goals.length && (
        <div class="goal-auto">
          <p class="note" style={{ margin: 0 }}>
            <b>No goals set.</b> Studio is guessing from your event names
            {suggested.length ? <>: {suggested.map((g) => `${g.label} (${g.role})`).join(', ')}.</> : ', and found nothing that looks like a goal yet.'}
          </p>
          {suggested.length > 0 && <button class="btn" type="button" onClick={() => onChange(suggested.map((g) => ({ ...g, match: g.match || '' })))}>Start from these</button>}
        </div>
      )}

      {goals.length > 0 && (
        <div class="goal-rows" role="table" aria-label="Goals">
          <div class="goal-row goal-head" role="row">
            <span>Name</span><span>Measured by</span><span>Event or page</span><span>Counts as</span><span>Value each</span><span />
          </div>
          {goals.map((g, i) => {
            const type = TYPES.find((t) => t.key === g.source);
            const missing = type && !has[type.needs];
            return (
              <div class="goal-row" role="row" key={i}>
                <input aria-label="Goal name" value={g.label} placeholder="Purchase" onInput={(e) => update(i, { label: e.currentTarget.value })} />
                <select aria-label="Measured by" value={g.source} onChange={(e) => update(i, { source: e.currentTarget.value, match: '' })}>
                  {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                {g.source === 'event' ? (
                  <input aria-label="GA4 event name" class="mono" list="goal-events" value={g.match} placeholder="purchase" onInput={(e) => update(i, { match: e.currentTarget.value.trim() })} />
                ) : g.source === 'page' ? (
                  <input aria-label="Page path" class="mono" value={g.match} placeholder="/pricing" onInput={(e) => update(i, { match: e.currentTarget.value.trim() })} />
                ) : (
                  <span class="small muted">{missing ? `link a ${type.needs === 'store' ? 'store listing' : 'repo'} above` : 'from synced data'}</span>
                )}
                <select aria-label="Counts as" value={g.role} onChange={(e) => update(i, { role: e.currentTarget.value })}>
                  <option value="step">Step</option>
                  <option value="outcome">Outcome</option>
                </select>
                <input aria-label="Value per conversion" type="number" min="0" step="0.01" value={g.value ?? ''} placeholder="—"
                  onInput={(e) => update(i, { value: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} />
                <button class="btn ghost" type="button" aria-label={`Remove ${g.label}`} onClick={() => onChange(goals.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>
                {g.source === 'event' && g.match && events.length > 0 && !events.some((e) => e.name === g.match) && (
                  <small class="goal-warn">Your site hasn’t sent “{g.match}” in the last 28 days. Check the name, or send it from your code.</small>
                )}
                {missing && type.needs === 'site' && <small class="goal-warn">Pick the GA4 site under Analytics.</small>}
              </div>
            );
          })}
        </div>
      )}
      <datalist id="goal-events">{events.map((e) => <option key={e.name} value={e.name}>{e.users} users</option>)}</datalist>

      <div class="row small">
        <button class="btn" type="button" onClick={() => add({ label: '', source: has.site ? 'event' : 'installs', role: 'outcome' })}><Icon name="plus" size={13} /> Add goal</button>
        {PRESETS.filter((p) => has[p.needs] && !goals.some((g) => same(g, p))).map((p) => (
          <button key={p.label} class="chip" type="button" onClick={() => add(p)}>+ {p.label}</button>
        ))}
      </div>
      {unusedEvents.length > 0 && (
        <div class="row small">
          <span class="muted">Events your site sends:</span>
          {unusedEvents.map((e) => (
            <button key={e.name} class="chip mono" type="button" title={`${e.users} users in the last 28 days`}
              onClick={() => add({ label: e.name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), source: 'event', match: e.name, role: 'step' })}>
              + {e.name} <span class="muted">{e.users}</span>
            </button>
          ))}
        </div>
      )}
      <p class="note" style={{ margin: 0 }}>
        <b>Step</b>: progress towards a result, drawn as a funnel stage. <b>Outcome</b>: the result itself, added into the Outcomes total.
        A value turns counts into money; events that carry a GA4 <span class="mono">value</span> (like <span class="mono">purchase</span>) use it instead.
      </p>
    </div>
  );
}
