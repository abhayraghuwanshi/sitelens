import { useEffect, useState } from 'preact/hooks';
import { formatRelative } from '@shared/format.js';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, Empty } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { AlertsSettings } from './settings/AlertsSettings.jsx';

// #/alerts is the feed and digest; #/alerts?view=settings is the rules and where alerts go.
export function Alerts({ params }) {
  if (params?.get('view') === 'settings') {
    return (
      <>
        <a class="back-link" href="#/alerts">← Alerts</a>
        <AlertsSettings />
      </>
    );
  }
  return <AlertsFeed />;
}

function AlertsFeed() {
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
      <a class="btn" href="#/alerts?view=settings"><Icon name="settings" size={13} /> Settings</a>
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
          <a class="btn" href="#/alerts?view=settings">Alert settings</a>
        </div>
      )}
      {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}

      <div class="grid cols-2">
        <Card title="Feed" sub={lastRun ? `Last check ${formatRelative(lastRun.at)}${lastRun.daily ? ' · full' : ' · GitHub & Web Store'}` : 'Not checked yet'} actions={runNow}>
          {alerts.length === 0 ? (
            <p class="note m-0">
              No alerts yet. Kauzl checks GitHub and Web Store snapshots every hour, and GA4 and Search Console once a day after {hourLabel(settings.digestHour)}.
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
        <div class="muted small mt-2">{label} · {formatRelative(alert.at)}</div>
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
              <tr key={s.id}><td><b>{s.label}</b></td><td colspan={4} class="small text-bad">{s.error}</td></tr>
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
        <p class="small m-0">
          <Icon name="chat" size={13} /> Mentions: <b>{n(digest.mentions.count)}</b> new · top <a href={digest.mentions.link} target="_blank" rel="noreferrer">{digest.mentions.top}</a>
        </p>
      )}
      {digest.github && (
        <p class="small m-0">
          <Icon name="github" size={13} /> GitHub: <b>+{n(digest.github.stars)}</b> stars, <b>{n(digest.github.views)}</b> repo views
          {digest.github.top && <> · most viewed <a href={`#/github?repo=${encodeURIComponent(digest.github.top)}`}>{digest.github.top}</a></>}
        </p>
      )}
      <p class="small m-0">
        {digest.alerts.length ? `${digest.alerts.length} alert${digest.alerts.length === 1 ? '' : 's'} in the 24 hours before it.` : 'No alerts in the 24 hours before it.'}
      </p>
    </div>
  );
}

// Unread alert count; refreshes every 5 minutes and after actions on the Alerts page.
// Returns { unread, bySite }.
export function useUnreadAlerts() {
  const [unread, setUnread] = useState({ unread: 0, bySite: {} });
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/alerts/unread').then((r) => alive && setUnread(r)).catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60_000);
    window.addEventListener('alerts-changed', load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('alerts-changed', load);
    };
  }, []);
  return unread;
}

const n = (v) => Number(v || 0).toLocaleString();
const pct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
