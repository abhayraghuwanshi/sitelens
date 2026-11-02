import { useEffect, useState } from 'preact/hooks';
import { formatRelative } from '@shared/format.js';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, Empty } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

export function Alerts() {
  const data = useAsync(() => api.get('/alerts'), []);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  async function act(kind, fn, done) {
    setBusy(kind);
    setMsg(null);
    try {
      const result = await fn();
      setMsg({ ok: true, text: done(result) });
      data.reload();
      window.dispatchEvent(new Event('alerts-changed'));
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={360} />;
  const { alerts, unread, digest, lastRun, settings, labels } = data.data;

  const runNow = (
    <div class="row">
      {unread > 0 && <button class="btn" type="button" disabled={Boolean(busy)}
        onClick={() => act('read', () => api.post('/alerts/read', { all: true }), (r) => `Marked ${r.changed} as read.`)}>Mark all read</button>}
      <button class="btn primary" type="button" disabled={Boolean(busy)}
        onClick={() => act('run', () => api.post('/alerts/run', { digest: true }),
          (r) => `Checked everything${r.fired.length ? ` — ${r.fired.length} new alert${r.fired.length === 1 ? '' : 's'}` : ' — nothing new'}${r.errors.length ? `; ${r.errors.length} source${r.errors.length === 1 ? '' : 's'} failed` : ''}.`)}>
        <Icon name="refresh" size={13} /> {busy === 'run' ? 'Checking…' : 'Run now'}</button>
    </div>
  );

  return (
    <>
      {!settings.enabled && (
        <div class="state">
          <h3>Alerts are paused</h3>
          <p>Nothing is checked in the background until you turn them back on.</p>
          <a class="btn" href="#/settings?tab=alerts">Alert settings</a>
        </div>
      )}
      {msg && <p class="small" style={{ margin: 0, color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}

      <div class="grid cols-2">
        <Card title="Feed" sub={lastRun ? `Last check ${formatRelative(lastRun.at)}${lastRun.daily ? ' · full' : ' · GitHub & Web Store'}` : 'Not checked yet'} actions={runNow}>
          {alerts.length === 0 ? (
            <p class="note" style={{ margin: 0 }}>
              No alerts yet. Studio checks GitHub and Web Store snapshots every hour, and GA4 and Search Console once a day after {hourLabel(settings.digestHour)}.
            </p>
          ) : (
            <div class="insights">
              {alerts.map((a) => <AlertRow key={a.id} alert={a} label={labels[a.rule]}
                onRead={() => act('read', () => api.post('/alerts/read', { ids: [a.id] }), () => 'Marked as read.')} />)}
            </div>
          )}
        </Card>

        <Card title="Daily digest" sub={digest ? `${digest.day} · built ${formatRelative(digest.at)}` : `Builds once a day after ${hourLabel(settings.digestHour)}`}>
          {digest ? <Digest digest={digest} /> : (
            <Empty title="No digest yet">Run now builds one immediately, or wait for {hourLabel(settings.digestHour)}.</Empty>
          )}
        </Card>
      </div>

      {lastRun?.errors?.length > 0 && (
        <Card title="Sources that failed last time">
          <ul class="small" style={{ margin: 0, paddingLeft: '18px' }}>
            {lastRun.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Card>
      )}
    </>
  );
}

function AlertRow({ alert, label, onRead }) {
  const external = alert.link?.startsWith('http');
  return (
    <div class={`insight ${alert.direction === 'up' ? 'good' : 'bad'}`} style={{ opacity: alert.read ? '0.6' : '1' }}>
      <span class="mark" />
      <div>
        <div class="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: '8px' }}>
          <a class="title" href={alert.link} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{alert.title}</a>
          {!alert.read && <button class="icon-btn" type="button" title="Mark as read" aria-label="Mark as read" onClick={onRead}><Icon name="x" size={12} /></button>}
        </div>
        <div class="detail">{alert.detail}</div>
        <div class="muted small" style={{ marginTop: '2px' }}>{label} · {formatRelative(alert.at)}</div>
      </div>
    </div>
  );
}

function Digest({ digest }) {
  return (
    <div class="stack">
      {digest.sites.length > 0 && (
        <table class="data">
          <thead><tr><th>Site</th><th>Sessions</th><th>vs 7d</th><th>Users</th><th>Search clicks</th></tr></thead>
          <tbody>
            {digest.sites.map((s) => s.error ? (
              <tr key={s.id}><td><b>{s.label}</b></td><td colspan={4} class="small" style={{ color: 'var(--critical-ink)' }}>{s.error}</td></tr>
            ) : (
              <tr key={s.id}>
                <td><a href={`#/site/${s.id}/overview`}><b>{s.label}</b></a></td>
                <td>{n(s.sessions)}</td>
                <td class={`delta ${s.sessionsChange > 0 ? 'up' : s.sessionsChange < 0 ? 'down' : 'flat'}`}>{pct(s.sessionsChange)}</td>
                <td>{n(s.users)}</td>
                <td>{s.clicks === undefined ? <span class="muted">—</span> : <>{n(s.clicks)} <span class="muted small">{s.clicksDay?.slice(5)}</span></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.extensions.length > 0 && (
        <table class="data">
          <thead><tr><th>Extension</th><th>Users</th><th>Rating</th><th>Listing installs</th></tr></thead>
          <tbody>
            {digest.extensions.map((e) => (
              <tr key={e.id}>
                <td><a href="#/extensions"><b>{e.label}</b></a></td>
                <td>{e.users === null ? '—' : n(e.users)}</td>
                <td>{e.rating ? `${e.rating}★` : '—'}</td>
                <td>{e.installs === undefined ? <span class="muted">—</span> : n(e.installs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.mentions && (
        <p class="small" style={{ margin: 0 }}>
          <Icon name="chat" size={13} /> Mentions: <b>{n(digest.mentions.count)}</b> new · top <a href={digest.mentions.link} target="_blank" rel="noreferrer">{digest.mentions.top}</a>
        </p>
      )}
      {digest.github && (
        <p class="small" style={{ margin: 0 }}>
          <Icon name="github" size={13} /> GitHub: <b>+{n(digest.github.stars)}</b> stars, <b>{n(digest.github.views)}</b> repo views
          {digest.github.top && <> · most viewed <a href={`#/github?repo=${encodeURIComponent(digest.github.top)}`}>{digest.github.top}</a></>}
        </p>
      )}
      <p class="small" style={{ margin: 0 }}>
        {digest.alerts.length ? `${digest.alerts.length} alert${digest.alerts.length === 1 ? '' : 's'} in the 24 hours before it.` : 'No alerts in the 24 hours before it.'}
      </p>
    </div>
  );
}

// Sidebar entry with an unread count; refreshes every 5 minutes and after actions here.
export function AlertsNavItem({ active }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/alerts/unread').then((r) => alive && setUnread(r.unread)).catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60_000);
    window.addEventListener('alerts-changed', load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('alerts-changed', load);
    };
  }, []);
  return (
    <a class={`nav-item${active ? ' active' : ''}`} href="#/alerts">
      <Icon name="bell" /> Alerts {unread > 0 && <span class="count badge">{unread}</span>}
    </a>
  );
}

const n = (v) => Number(v || 0).toLocaleString();
const pct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
