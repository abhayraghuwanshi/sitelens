import { useEffect, useState } from 'preact/hooks';
import { formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

// Alerts in the new layout, shaped like to-dos: one site's alerts at
// #/site/<id>/alerts, every site's at #/alerts, and the rules and where they're
// sent at #/alerts?view=settings. Anything that changes them tells the sidebar.
const changed = () => dispatchEvent(new Event('alerts-changed'));
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
const n = (v) => Number(v || 0).toLocaleString('en-US');
const pct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);

export function AlertsPage({ site, sites }) {
  const feed = useAsync(() => api.get(`/alerts${qs(site ? { site: site.id } : {})}`), [site?.id]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [showRead, setShowRead] = useState(false);

  useEffect(() => {
    const reload = () => feed.reload();
    addEventListener('alerts-changed', reload);
    return () => removeEventListener('alerts-changed', reload);
  }, [feed.reload]);

  async function act(kind, fn, done) {
    setBusy(kind);
    setMsg(null);
    try {
      const text = done(await fn());
      if (text) setMsg({ ok: true, text });
      changed();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  if (feed.error) return <ErrorState error={feed.error} onRetry={feed.reload} />;
  if (!feed.data) return <Loading height={240} />;
  const { alerts, unread, digest, lastRun, settings, labels } = feed.data;
  const fresh = alerts.filter((a) => !a.read);
  const read = alerts.filter((a) => a.read);
  const markRead = (ids) => act('read', () => api.post('/alerts/read', { ids }), () => '');
  const row = (group) => <AlertItem key={group[0].id} group={group} label={labels[group[0].rule]} site={!site && sites.find((s) => s.id === group[0].site)}
    onRead={() => markRead(group.filter((a) => !a.read).map((a) => a.id))} />;
  const siteDigest = site && digest?.sites.find((s) => s.id === site.id);

  return (
    <>
      {!settings.enabled && (
        <section class="card card-plain nx-warn alert-paused">
          <div>
            <b>Alerts are paused.</b> <span class="muted">Nothing is checked in the background until you turn them back on.</span>
          </div>
          <a class="btn" href="#/alerts?view=settings">Turn on</a>
        </section>
      )}

      <section class="card card-plain">
        <div class="alert-bar">
          <div class="alert-status">
            <span class="alert-big">{unread ? `${unread} unread` : 'All caught up'}</span>
            <span class="muted small">
              {lastRun ? `Last checked ${formatRelative(lastRun.at)}${lastRun.daily ? '' : ' (GitHub & Web Store only)'}` : 'Not checked yet'}
              {' · '}GitHub and Web Store hourly, GA4 and Search Console daily after {hourLabel(settings.digestHour)}
            </span>
          </div>
          <div class="alert-actions">
            {unread > 0 && (
              <button type="button" class="btn" disabled={Boolean(busy)}
                onClick={() => act('read', () => api.post('/alerts/read', { all: true, site: site?.id || '' }), (r) => `Marked ${r.changed} as read.`)}>
                Mark all read
              </button>
            )}
            <a class="btn" href="#/alerts?view=settings"><Icon name="settings" size={13} /> Settings</a>
            <button type="button" class="btn primary" disabled={Boolean(busy)}
              onClick={() => act('run', () => api.post('/alerts/run', { digest: true }),
                (r) => `Checked everything: ${r.fired.length ? `${r.fired.length} new alert${r.fired.length === 1 ? '' : 's'}` : 'nothing new'}${r.errors.length ? `, ${r.errors.length} source${r.errors.length === 1 ? '' : 's'} failed` : ''}.`)}>
              <Icon name="refresh" size={13} /> {busy === 'run' ? 'Checking…' : 'Check now'}
            </button>
          </div>
        </div>
        {siteDigest && !siteDigest.error && (
          <p class="note">
            Latest digest ({digest.day}): <b>{n(siteDigest.sessions)}</b> sessions ({pct(siteDigest.sessionsChange)} vs the 7-day average), <b>{n(siteDigest.users)}</b> users
            {siteDigest.clicks !== undefined && <>, <b>{n(siteDigest.clicks)}</b> search clicks</>}.
          </p>
        )}
        {msg && <p class={`small ${msg.ok ? 'good' : 'nx-error'} m-0`} role="status">{msg.text}</p>}
        {lastRun?.errors?.length > 0 && (
          <details class="alert-failed">
            <summary>{lastRun.errors.length} source{lastRun.errors.length === 1 ? '' : 's'} couldn’t be read last time</summary>
            <ul>{lastRun.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </details>
        )}
      </section>

      <section class="card card-plain" aria-label="Alerts">
        {fresh.length ? <ul class="alerts">{grouped(fresh).map(row)}</ul> : (
          <p class="muted m-0">
            {alerts.length ? 'No new alerts.' : `No alerts${site ? ` for ${site.label}` : ''} yet. When traffic, search clicks, goals, stars or installs move past their limits, they show up here.`}
          </p>
        )}
        {read.length > 0 && (
          <>
            <button type="button" class="todo-link" aria-expanded={showRead} onClick={() => setShowRead(!showRead)}>
              {showRead ? 'Hide' : 'Show'} {read.length} read
            </button>
            {showRead && <ul class="alerts">{grouped(read).map(row)}</ul>}
          </>
        )}
      </section>

      {!site && digest && <DigestCard digest={digest} />}
    </>
  );
}

// The same rule on the same thing (an extension's users dropping day after day)
// is one row: the newest alert, with the earlier ones a click away. Newest first.
function grouped(alerts) {
  const groups = new Map();
  for (const a of alerts) {
    const key = `${a.rule}:${a.subject?.type}:${a.subject?.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  return [...groups.values()];
}

function AlertItem({ group, label, site, onRead }) {
  const [open, setOpen] = useState(false);
  const [alert, ...earlier] = group;
  const external = alert.link?.startsWith('http');
  const up = alert.direction === 'up';
  const read = group.every((a) => a.read);
  return (
    <li class={`alert-item${read ? ' read' : ''}`}>
      <span class={`alert-dir ${up ? 'up' : 'down'}`} aria-label={up ? 'Up' : 'Down'}>{up ? '↑' : '↓'}</span>
      <div class="todo-body">
        <span class="todo-title">{alert.title}</span>
        {alert.detail && <span class="todo-detail">{alert.detail}</span>}
        <span class="todo-meta">
          {site && <a href={`#/site/${site.id}/alerts`}>{site.label}</a>}
          {label && <span>{label}</span>}
          <span>{formatRelative(alert.at)}</span>
          {alert.link && <a href={alert.link} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>Open <Icon name="chevron" size={11} /></a>}
          {earlier.length > 0 && (
            <button type="button" class="todo-link" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? 'Hide' : `${earlier.length} earlier`}
            </button>
          )}
          {!read && <button type="button" class="todo-link" onClick={onRead}>{group.length > 1 ? 'Mark all read' : 'Mark read'}</button>}
        </span>
        {open && (
          <ul class="alert-earlier">
            {earlier.map((a) => <li key={a.id}><span>{a.title}</span> <span class="muted">{formatRelative(a.at)}</span></li>)}
          </ul>
        )}
      </div>
    </li>
  );
}

function DigestCard({ digest }) {
  return (
    <section class="card card-plain">
      <div class="nx-section-head">
        <h2 class="nx-h2">Daily digest</h2>
        <span class="muted small">{digest.day} · built {formatRelative(digest.at)}</span>
      </div>
      {digest.sites.length > 0 && (
        <table class="todo-table">
          <thead><tr><th>Site</th><th>Sessions</th><th>vs 7d</th><th>Users</th><th>Search clicks</th></tr></thead>
          <tbody>
            {digest.sites.map((s) => s.error ? (
              <tr key={s.id}><td><a href={`#/site/${s.id}/alerts`}>{s.label}</a></td><td colspan={4} class="nx-error small">{s.error}</td></tr>
            ) : (
              <tr key={s.id}>
                <td><a href={`#/site/${s.id}/alerts`}>{s.label}</a></td>
                <td>{n(s.sessions)}</td>
                <td class={s.sessionsChange > 0 ? 'good' : s.sessionsChange < 0 ? 'bad' : 'muted'}>{pct(s.sessionsChange)}</td>
                <td>{n(s.users)}</td>
                <td>{s.clicks === undefined ? <span class="muted">–</span> : n(s.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.extensions.length > 0 && (
        <table class="todo-table">
          <thead><tr><th>Extension</th><th>Users</th><th>Rating</th><th>Listing installs</th></tr></thead>
          <tbody>
            {digest.extensions.map((e) => (
              <tr key={e.id}>
                <td>{e.label}</td>
                <td>{e.users === null ? '–' : n(e.users)}</td>
                <td>{e.rating ? `${e.rating}★` : '–'}</td>
                <td>{e.installs === undefined ? '–' : n(e.installs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(digest.mentions || digest.github) && (
        <p class="note">
          {digest.github && <>GitHub: <b>+{n(digest.github.stars)}</b> stars, <b>{n(digest.github.views)}</b> repo views. </>}
          {digest.mentions && <>Mentions: <b>{n(digest.mentions.count)}</b> new, top <a href={digest.mentions.link} target="_blank" rel="noreferrer">{digest.mentions.top}</a>.</>}
        </p>
      )}
    </section>
  );
}

/* --- Settings --- */

const FIELDS = {
  pct: { label: 'Change', unit: '%', scale: 100 },
  minVolume: { label: 'Min volume', unit: '/day' },
  z: { label: 'z-score', unit: 'σ' },
  minDrop: { label: 'Drop', unit: '' },
  minGain: { label: 'Gain', unit: '/day' },
  multiple: { label: 'Usual pace ×', unit: '' },
  minNew: { label: 'New', unit: '' },
  minPoints: { label: 'Points', unit: '' },
};

const GROUPS = [
  { label: 'Sites', rules: { traffic: 'Sessions & users', search: 'Search Console clicks', goals: 'Goals', }, note: { goals: 'Goals marked to alert in each site’s .sitelens.yml' } },
  { label: 'Chrome extensions', rules: { installs: 'Listing installs', extUsers: 'Users drop', rating: 'Rating drop' } },
  { label: 'GitHub & mentions', rules: { stars: 'Stars spike', issues: 'New issues', mentions: 'Mentions on HN, Reddit, Product Hunt' } },
];

export function AlertSettings() {
  const data = useAsync(() => api.get('/alerts/settings'), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (data.data) setForm(structuredClone(data.data));
  }, [data.data]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!form) return <Loading height={240} />;

  const set = (patch) => setForm({ ...form, ...patch });
  const setRule = (key, field, value) => setForm({ ...form, rules: { ...form.rules, [key]: { ...form.rules[key], [field]: value } } });
  const dirty = JSON.stringify(form) !== JSON.stringify(data.data);

  async function act(kind, fn, done) {
    setBusy(kind);
    setMsg(null);
    try {
      setMsg({ ok: true, text: done(await fn()) });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }
  const save = (e) => {
    e.preventDefault();
    act('save', async () => {
      const saved = await api.post('/alerts/settings', form);
      data.reload();
      changed();
      return saved;
    }, () => 'Saved.');
  };
  const known = new Set(GROUPS.flatMap((g) => Object.keys(g.rules)));
  const groups = [...GROUPS, { label: 'Other', rules: Object.fromEntries(Object.keys(form.rules).filter((k) => !known.has(k)).map((k) => [k, k])) }];

  return (
    <form class="alert-settings" onSubmit={save}>
      <section class="card card-plain">
        <h2 class="nx-h2">Checking</h2>
        <label class="alert-toggle">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
          <span><b>Check in the background</b><span class="muted small">GitHub and Web Store every hour, GA4 and Search Console once a day.</span></span>
        </label>
        <label class="alert-toggle">
          <input type="checkbox" checked={form.includeDemo} onChange={(e) => set({ includeDemo: e.currentTarget.checked })} />
          <span><b>Include the demo site</b><span class="muted small">Its sample data can raise alerts too.</span></span>
        </label>
        <label class="alert-field">
          <span>Daily check and digest at</span>
          <select value={form.digestHour} onChange={(e) => set({ digestHour: Number(e.currentTarget.value) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
      </section>

      <section class="card card-plain">
        <h2 class="nx-h2">Where alerts go</h2>
        <p class="note">Every alert lands in Kauzl. You can also send it to these:</p>
        <label class="alert-toggle">
          <input type="checkbox" checked={form.desktop} onChange={(e) => set({ desktop: e.currentTarget.checked })} />
          <span><b>macOS notifications</b><span class="muted small">From the desktop app, while it’s running.</span></span>
        </label>
        <label class="alert-field wide">
          <span>Slack or Discord webhook</span>
          <input type="url" placeholder="https://hooks.slack.com/services/… or https://discord.com/api/webhooks/…" value={form.webhookUrl}
            onInput={(e) => set({ webhookUrl: e.currentTarget.value })} />
        </label>
        <div class="alert-actions start">
          <button type="button" class="btn" disabled={Boolean(busy)}
            onClick={() => act('test', () => api.post('/alerts/test'), (r) => ['desktop', 'webhook'].map((k) => `${k === 'desktop' ? 'macOS' : 'Webhook'}: ${r[k].ok ? 'sent' : r[k].error}`).join(' · '))}>
            {busy === 'test' ? 'Sending…' : 'Send a test'}
          </button>
          <span class="muted small">Test uses the saved settings.</span>
        </div>
      </section>

      <section class="card card-plain">
        <h2 class="nx-h2">What to watch</h2>
        <p class="note">
          A metric alerts when it moves past the change against its 7-day average, the bigger side has the minimum volume, and its z-score on the last 28 days passes the limit.
          Each alert fires once. A site’s .sitelens.yml can tune its own traffic and search limits.
        </p>
        {groups.filter((g) => Object.keys(g.rules).some((k) => form.rules[k])).map((g) => (
          <div key={g.label} class="alert-group">
            <span class="nx-label-sm">{g.label}</span>
            {Object.entries(g.rules).filter(([k]) => form.rules[k]).map(([key, name]) => {
              const rule = form.rules[key];
              return (
                <div key={key} class={`alert-rule${rule.enabled ? '' : ' off'}`}>
                  <label class="alert-rule-name">
                    <input type="checkbox" checked={rule.enabled} onChange={(e) => setRule(key, 'enabled', e.currentTarget.checked)} />
                    <span>{name}{g.note?.[key] && <span class="muted small">{g.note[key]}</span>}</span>
                  </label>
                  <div class="alert-limits">
                    {Object.keys(rule).filter((f) => f !== 'enabled').map((field) => {
                      const meta = FIELDS[field] || { label: field, unit: '' };
                      const scale = meta.scale || 1;
                      return (
                        <label key={field} class="alert-limit">
                          <span>{meta.label}</span>
                          <span class="alert-num">
                            <input type="number" min="0" step="any" disabled={!rule.enabled} value={Math.round(rule[field] * scale * 100) / 100}
                              onInput={(e) => setRule(key, field, Number(e.currentTarget.value) / scale)} aria-label={`${name}: ${meta.label}`} />
                            {meta.unit && <i>{meta.unit}</i>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <div class="alert-save">
        <button type="submit" class="btn primary" disabled={Boolean(busy) || !dirty}>{busy === 'save' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        {dirty && <button type="button" class="btn" onClick={() => setForm(structuredClone(data.data))}>Discard</button>}
        {msg && <span class={`small ${msg.ok ? 'good' : 'nx-error'}`} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}
