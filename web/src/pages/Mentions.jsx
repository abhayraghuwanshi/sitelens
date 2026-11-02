import { useState } from 'preact/hooks';
import { formatNumber, formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented, Empty } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { dayLabel } from './GitHub.jsx';

const SOURCES = [
  { key: 'hn', label: 'Hacker News', color: 'var(--series-4)' },
  { key: 'reddit', label: 'Reddit', color: 'var(--series-6)' },
  { key: 'ph', label: 'Product Hunt', color: 'var(--series-5)' },
];
const sourceLabel = (key) => SOURCES.find((s) => s.key === key)?.label || key;

export function Mentions({ range }) {
  const [source, setSource] = useState('');
  const data = useAsync(() => api.get(`/mentions${qs({ range, source })}`), [range, source]);
  const [sync, setSync] = useState({ busy: false, msg: null });

  async function syncNow() {
    setSync({ busy: true, msg: null });
    try {
      const r = await api.post('/mentions/sync');
      const added = Object.values(r.added || {}).reduce((a, b) => a + b, 0);
      const errors = Object.entries(r.errors || {}).map(([k, v]) => `${sourceLabel(k)}: ${v}`);
      setSync({ busy: false, msg: errors.length ? { ok: false, text: errors.join(' · ') } : { ok: true, text: added ? `${added} new mention${added === 1 ? '' : 's'}.` : 'Up to date, nothing new.' } });
      data.reload();
    } catch (err) {
      setSync({ busy: false, msg: { ok: false, text: err.message } });
    }
  }

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;
  const d = data.data;
  const total = d.totals.hn + d.totals.reddit + d.totals.ph;

  return (
    <>
      <div class="meta-line" style={{ alignItems: 'center' }}>
        <span><Icon name="search" size={13} /> {d.terms.length} search term{d.terms.length === 1 ? '' : 's'}</span>
        <span>{d.lastSync ? `synced ${formatRelative(d.lastSync)}` : 'not synced yet'} · every 30 minutes</span>
        <button class="btn ghost" type="button" disabled={sync.busy || d.syncing} onClick={syncNow}>
          <Icon name="refresh" size={13} /> {sync.busy || d.syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {sync.msg && <span class="small" style={{ color: sync.msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{sync.msg.text}</span>}
      </div>

      <SourceStatus sources={d.sources} />

      <KpiStrip items={[
        { label: 'Mentions', value: formatNumber(total), meta: 'in range' },
        ...SOURCES.map((s) => ({ label: s.label, value: d.sources[s.key].ready ? formatNumber(d.totals[s.key]) : '—', meta: d.sources[s.key].ready ? '' : 'not connected' })),
      ]} />

      <Card title="Mentions per day" sub="Stories, posts, launches and comments, by the day they were posted"
        actions={<Segmented label="Source" value={source} onChange={setSource}
          options={[{ key: '', label: 'All' }, ...SOURCES.filter((s) => d.sources[s.key].ready).map(({ key, label }) => ({ key, label }))]} />}>
        <LineChart height={200} labels={d.daily.map((r) => dayLabel(r.date))} area={false} format={(v) => formatNumber(v)}
          series={SOURCES.filter((s) => d.sources[s.key].ready).map((s) => ({ label: s.label, color: s.color, values: d.daily.map((r) => r[s.key]) }))} />
      </Card>

      <Card title="Feed" sub={source ? sourceLabel(source) : 'All sources, newest first'} flush>
        {d.items.length ? (
          <ul class="mention-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {d.items.map((m) => <MentionRow key={m.id} m={m} />)}
          </ul>
        ) : (
          <div style={{ padding: '16px' }}>
            <Empty title="No mentions in this range">
              Studio searches for {d.terms.slice(0, 4).map((t) => `“${t.term}”`).join(', ')}{d.terms.length > 4 ? ` and ${d.terms.length - 4} more` : ''}.
              Add keywords in <a href="#/settings?i=mentions">Settings → Mentions</a>.
            </Empty>
          </div>
        )}
      </Card>
    </>
  );
}

function MentionRow({ m }) {
  return (
    <li style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
      <div class="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <a href={m.permalink} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{m.title || '(untitled)'}</a>
          {m.text && <div class="muted small" style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>{m.text}</div>}
          <div class="small muted" style={{ marginTop: '4px' }}>
            <span class="chip">{sourceLabel(m.source)}</span>{' '}
            {m.community && <>{m.community} · </>}
            {m.author && <>{m.author} · </>}
            {formatRelative(m.createdAt)} · matched “{m.term.replace(/^ph:/, '')}”
            {m.url && <> · <a href={m.url} target="_blank" rel="noreferrer">link</a></>}
          </div>
        </div>
        {m.kind !== 'comment' && (
          <div class="small" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <b>{formatNumber(m.points)}</b> {m.source === 'ph' ? 'votes' : 'pts'}
            <div class="muted">{formatNumber(m.comments)} comments</div>
          </div>
        )}
      </div>
    </li>
  );
}

function SourceStatus({ sources }) {
  const notes = [];
  if (sources.hn.error) notes.push({ bad: true, text: `Hacker News: ${sources.hn.error}` });
  if (sources.reddit.error) notes.push({ bad: true, text: sources.reddit.error });
  else if (!sources.reddit.ready) notes.push({ text: 'Reddit isn’t connected: add a Reddit app’s client ID and secret in Settings → Mentions.' });
  if (sources.ph.error) notes.push({ bad: true, text: `Product Hunt: ${sources.ph.error}` });
  else if (!sources.ph.hasToken) notes.push({ text: 'Product Hunt isn’t connected: add a developer token and your launch’s slug in Settings → Mentions.' });
  else if (!sources.ph.slugs.length) notes.push({ text: 'Product Hunt has a token but no launch to watch: add your post’s slug in Settings → Mentions.' });
  if (!notes.length) return null;
  return (
    <div class="stack" style={{ marginBottom: '12px' }}>
      {notes.map((n) => (
        <p key={n.text} class="note small" style={{ margin: 0, color: n.bad ? 'var(--critical-ink)' : undefined }}>
          {n.text} <a href="#/settings?i=mentions">Open settings</a>
        </p>
      ))}
    </div>
  );
}
