import { useState } from 'preact/hooks';
import { api, qs } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Icon } from '../../components/icons.jsx';
import { BrandIcon } from '../../components/BrandIcon.jsx';

// Settings → Sites & products → Goals: what a product counts as progress (steps) and
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

// What each kind of goal counts, in words, and its mark.
const KIND = {
  event: { icon: 'bolt', says: (g) => (g.match ? <>When your site sends <code>{g.match}</code></> : 'Pick the event your site sends') },
  page: { icon: 'pages', says: (g) => (g.match ? <>Visits to <code>{g.match}</code></> : 'Pick the page') },
  installs: { brand: 'extensions', says: () => 'Chrome Web Store installs' },
  downloads: { brand: 'github', says: () => 'Downloads of your GitHub releases' },
  stars: { brand: 'github', says: () => 'New stars on your repos' },
};
const money = (v) => (v == null || v === '' ? '' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} each`);
const alertWords = (a) => (a ? `Alerts if it ${a.when === 'spike' ? 'jumps' : a.when === 'both' ? 'drops or jumps' : 'drops'} ${Math.round(a.pct * 100)}%` : '');

// `fromFile`: the rows are the site's .sitelens.yml goals, so the note pointing there is left out
// and each event or page result can carry its alert (only the file sets those).
// Results and steps are two lists; a goal reads as a sentence and opens to edit, one at a time.
export function GoalsEditor({ goals, onChange, siteId, hasStore, hasRepos, fromFile = false }) {
  const info = useAsync(() => api.get(`/outcomes/goals${qs({ site: siteId, store: hasStore, repos: hasRepos })}`), [siteId, hasStore, hasRepos]);
  const has = { site: Boolean(siteId), store: hasStore, repos: hasRepos };
  const events = info.data?.events || [];
  const suggested = info.data?.suggested || [];
  const [open, setOpen] = useState(-1);
  const update = (i, patch) => onChange(goals.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const add = (g, edit = false) => {
    if (goals.some((x) => same(x, g) && g.match)) return;
    onChange([...goals, { label: g.label, source: g.source, match: g.match || '', role: g.role || 'outcome' }]);
    if (edit) setOpen(goals.length);
  };
  const remove = (i) => { onChange(goals.filter((_, j) => j !== i)); setOpen(-1); };
  const unusedEvents = events.filter((e) => !goals.some((g) => g.source === 'event' && g.match === e.name)).slice(0, 8);
  const config = useAsync(() => (siteId ? api.get(`/sites/${siteId}/config`) : null), [siteId]);
  const fileGoals = config.data?.config?.goals?.length || 0;
  const presets = PRESETS.filter((p) => has[p.needs] && !goals.some((g) => same(g, p)));

  const list = (role) => goals.map((g, i) => ({ g, i })).filter(({ g }) => (g.role === 'step' ? 'step' : 'outcome') === role);
  const row = ({ g, i }) => {
    const type = TYPES.find((t) => t.key === g.source);
    const kind = KIND[g.source] || KIND.event;
    const missing = type && !has[type.needs];
    const unseen = g.source === 'event' && g.match && events.length > 0 && !events.some((e) => e.name === g.match);
    const warn = missing ? (type.needs === 'site' ? 'Pick the GA4 site under Analytics.' : `Link a ${type.needs === 'store' ? 'store listing' : 'repo'} to count this.`)
      : unseen ? `Your site hasn’t sent “${g.match}” in the last 28 days. Check the name, or send it from your code.` : '';
    if (open === i) {
      return (
        <li key={i} class="gl-item gl-open">
          <GoalForm g={g} events={events} has={has} fromFile={fromFile} onChange={(patch) => update(i, patch)} />
          {warn && <small class="goal-warn">{warn}</small>}
          <div class="gl-form-foot">
            <button class="btn" type="button" onClick={() => setOpen(-1)}>Done</button>
            <button class="btn ghost danger" type="button" onClick={() => remove(i)}>Remove goal</button>
          </div>
        </li>
      );
    }
    return (
      <li key={i} class="gl-item">
        <button type="button" class="gl-sum" onClick={() => setOpen(i)} aria-label={`Edit ${g.label || 'goal'}`}>
          {kind.brand ? <BrandIcon name={kind.brand} /> : <span class="gl-ic"><Icon name={kind.icon} size={15} /></span>}
          <span class="gl-b">
            <b>{g.label || 'Untitled goal'}</b>
            <small>{kind.says(g)}</small>
            {(g.alert || g.value != null || warn) && (
              <span class="gl-tags">
                {g.alert && <span class="gl-tag"><Icon name="bell" size={11} /> {alertWords(g.alert)}</span>}
                {g.value != null && <span class="gl-tag">{money(g.value)}</span>}
                {warn && <span class="gl-tag warn"><Icon name="triangle" size={11} /> {missing ? 'Needs setup' : 'Not seen lately'}</span>}
              </span>
            )}
          </span>
          <span class="gl-edit">Edit</span>
        </button>
        <button class="gl-x" type="button" aria-label={`Remove ${g.label || 'goal'}`} onClick={() => remove(i)}><Icon name="x" size={13} /></button>
      </li>
    );
  };

  return (
    <div class="gl">
      {fileGoals > 0 && !fromFile && (
        <p class="note m-0">
          <b>The site’s repo file sets {fileGoals} goal{fileGoals === 1 ? '' : 's'}</b>, and those are the ones measured; the goals here aren’t used while it does.{' '}
          <a href={`#/account?tab=sites&edit=${encodeURIComponent(siteId)}&part=config`}>Open the config file</a>
        </p>
      )}
      {!goals.length && (
        <div class="goal-auto">
          <p class="note m-0">
            <b>No goals yet.</b> {suggested.length ? <>From your site’s events, these look like goals: {suggested.map((g) => g.label).join(', ')}.</> : 'Pick what counts as a win below.'}
          </p>
          {suggested.length > 0 && <button class="btn primary" type="button" onClick={() => onChange(suggested.map((g) => ({ ...g, match: g.match || '' })))}>Use these</button>}
        </div>
      )}

      <section class="gl-sec">
        <header class="gl-head"><h3>Results</h3><small>What counts as a win: an install, a sign-up, a purchase. These add up to your outcomes.</small></header>
        {list('outcome').length > 0 && <ul class="gl-list">{list('outcome').map(row)}</ul>}
        <div class="gl-add">
          {presets.filter((p) => p.role === 'outcome').map((p) => (
            <button key={p.label} class="chip" type="button" onClick={() => add(p)}>+ {p.label}</button>
          ))}
          <button class="btn ghost" type="button" onClick={() => add({ label: '', source: has.site ? 'event' : 'installs', role: 'outcome' }, true)}><Icon name="plus" size={13} /> Add a result</button>
        </div>
      </section>

      <section class="gl-sec">
        <header class="gl-head"><h3>Steps on the way</h3><small>What people do before a win, like viewing pricing. Each one is a stage in Journeys.</small></header>
        {list('step').length > 0 && <ul class="gl-list">{list('step').map(row)}</ul>}
        <div class="gl-add">
          {presets.filter((p) => p.role === 'step').map((p) => (
            <button key={p.label} class="chip" type="button" onClick={() => add(p)}>+ {p.label}</button>
          ))}
          {unusedEvents.map((e) => (
            <button key={e.name} class="chip mono" type="button" title={`${e.users} users in the last 28 days`}
              onClick={() => add({ label: e.name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), source: 'event', match: e.name, role: 'step' })}>
              + {e.name} <span class="muted">{e.users}</span>
            </button>
          ))}
          <button class="btn ghost" type="button" onClick={() => add({ label: '', source: has.site ? 'event' : 'installs', role: 'step' }, true)}><Icon name="plus" size={13} /> Add a step</button>
        </div>
        {unusedEvents.length > 0 && <small class="muted">Chips with a number are events your site already sends, with people in the last 28 days.</small>}
      </section>
      <datalist id="goal-events">{events.map((e) => <option key={e.name} value={e.name}>{e.users} users</option>)}</datalist>
    </div>
  );
}

// One goal, opened: its name, what counts, result or step, worth, and its alert.
function GoalForm({ g, events, has, fromFile, onChange }) {
  return (
    <div class="gl-form">
      <label class="field">Name<input value={g.label} placeholder="Sign-up" autoFocus={!g.label} onInput={(e) => onChange({ label: e.currentTarget.value })} /></label>
      <div class="field">
        <span>What counts</span>
        <div class="gl-kinds" role="radiogroup" aria-label="What counts">
          {TYPES.map((t) => {
            const k = KIND[t.key];
            return (
              <button key={t.key} type="button" role="radio" aria-checked={g.source === t.key} class={`gl-kind${g.source === t.key ? ' on' : ''}`}
                disabled={!has[t.needs] && g.source !== t.key} title={!has[t.needs] ? `Needs a ${t.needs === 'store' ? 'store listing' : t.needs === 'repos' ? 'linked repo' : 'GA4 site'}` : ''}
                onClick={() => onChange({ source: t.key, match: '' })}>
                {k.brand ? <BrandIcon name={k.brand} small /> : <Icon name={k.icon} size={13} />} {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {g.source === 'event' && (
        <label class="field">Event name
          <input class="mono" list="goal-events" value={g.match} placeholder={events[0]?.name || 'sign_up'} onInput={(e) => onChange({ match: e.currentTarget.value.trim() })} />
          <small>The GA4 event your site sends. Start typing to see the ones it does.</small>
        </label>
      )}
      {g.source === 'page' && (
        <label class="field">Page
          <input class="mono" value={g.match} placeholder="/pricing" onInput={(e) => onChange({ match: e.currentTarget.value.trim() })} />
          <small>A path on your site. Each visit to it counts once.</small>
        </label>
      )}
      <div class="gl-form-row">
        <div class="field">
          <span>Counts as</span>
          <div class="gl-seg" role="radiogroup" aria-label="Counts as">
            <button type="button" role="radio" aria-checked={g.role !== 'step'} class={g.role !== 'step' ? 'on' : ''} onClick={() => onChange({ role: 'outcome' })}>A result</button>
            <button type="button" role="radio" aria-checked={g.role === 'step'} class={g.role === 'step' ? 'on' : ''} onClick={() => onChange({ role: 'step' })}>A step on the way</button>
          </div>
        </div>
        <label class="field gl-worth"><span>Worth each <span class="muted">(optional)</span></span>
          <span class="gl-money"><span aria-hidden="true">$</span>
            <input type="number" min="0" step="0.01" value={g.value ?? ''} placeholder="0"
              onInput={(e) => onChange({ value: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} />
          </span>
          <small>Events that carry a GA4 value, like purchase, use that instead.</small>
        </label>
      </div>
      {fromFile && (g.source === 'event' || g.source === 'page') && (g.role !== 'step' || g.alert) && <GoalAlert alert={g.alert} onChange={(alert) => onChange({ alert })} />}
    </div>
  );
}

// One goal's alert, as a sentence: off, or "Alert when it drops by 60% (on days with at least 2)".
function GoalAlert({ alert, onChange }) {
  const set = (patch) => onChange({ when: 'drop', pct: 0.5, min: 5, ...alert, ...patch });
  return (
    <div class="goal-alert small">
      <label class="an-switch gl-alert-switch">
        <input type="checkbox" role="switch" checked={Boolean(alert)} onChange={(e) => onChange(e.currentTarget.checked ? { when: 'drop', pct: 0.5, min: 5 } : null)} />
        <span><b>Alert me</b></span>
      </label>
      {alert && <>
        <span>when it</span>
        <select aria-label="Alert when it" value={alert.when} onChange={(e) => set({ when: e.currentTarget.value })}>
          <option value="drop">drops</option>
          <option value="spike">jumps</option>
          <option value="both">drops or jumps</option>
        </select>
        <span>by</span>
        <input aria-label="By percent" type="number" min="1" max="1000" value={Math.round(alert.pct * 100)}
          onInput={(e) => { const n = Number(e.currentTarget.value); if (n > 0) set({ pct: n / 100 }); }} />
        <span>% against its usual day, once it has at least</span>
        <input aria-label="Minimum a day" type="number" min="0" value={alert.min}
          onInput={(e) => { const n = Number(e.currentTarget.value); if (n >= 0) set({ min: n }); }} />
        <span>a day</span>
      </>}
    </div>
  );
}
