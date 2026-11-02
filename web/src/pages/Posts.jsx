import { useState } from 'preact/hooks';
import { formatNumber, formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Empty } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

// Your own posts across platforms, with the traffic each one likely brought.
export function Posts({ range }) {
  const [product, setProduct] = useState('');
  const [platform, setPlatform] = useState('');
  const data = useAsync(() => api.get(`/posts${qs({ range, product, platform })}`), [range, product, platform]);
  const [sync, setSync] = useState({ busy: false, msg: null });

  async function syncNow() {
    setSync({ busy: true, msg: null });
    try {
      const r = await api.post('/posts/sync');
      const added = Object.values(r.added || {}).reduce((a, b) => a + b, 0);
      const errors = Object.entries(r.errors || {}).map(([k, v]) => `${k}: ${v}`);
      setSync({ busy: false, msg: errors.length ? { ok: false, text: errors.join(' · ') } : { ok: true, text: added ? `${added} new post${added === 1 ? '' : 's'}.` : 'Up to date.' } });
      data.reload();
    } catch (err) {
      setSync({ busy: false, msg: { ok: false, text: err.message } });
    }
  }

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;
  const d = data.data;
  const label = (key) => d.platforms.find((p) => p.key === key)?.label || key;

  return (
    <>
      <div class="meta-line" style={{ alignItems: 'center' }}>
        <span><Icon name="users" size={13} /> {d.accounts.length} account{d.accounts.length === 1 ? '' : 's'}</span>
        <span>{d.lastSync ? `synced ${formatRelative(d.lastSync)}` : 'not synced yet'} · every 6 hours</span>
        <button class="btn ghost" type="button" disabled={sync.busy || d.syncing || !d.accounts.length} onClick={syncNow}>
          <Icon name="refresh" size={13} /> {sync.busy || d.syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {sync.msg && <span class="small" style={{ color: sync.msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{sync.msg.text}</span>}
      </div>

      <Accounts data={d} open={!d.accounts.length} onSaved={data.reload} />
      <AddByUrl products={d.products} onAdded={data.reload} />

      {Object.entries(d.errors).filter(([k]) => k.startsWith('ga4:')).map(([k, v]) => <p class="note" key={k} style={{ margin: 0 }}><b>Traffic for {d.products.find((p) => `ga4:${p.id}` === k)?.label || k}:</b> {v}</p>)}

      <KpiStrip items={[
        { label: 'Posts', value: formatNumber(d.totals.posts), meta: 'in range' },
        { label: 'Upvotes & reactions', value: formatNumber(d.totals.points) },
        { label: 'Comments', value: formatNumber(d.totals.comments) },
        { label: 'Sessions brought', value: formatNumber(d.totals.sessions), meta: 'GA4, 3 days after each post', help: 'Exact for links with utm_campaign; otherwise that platform’s referrer sessions in the 3 days after posting, split between overlapping posts.' },
      ]} />

      {d.byPlatform.length > 1 && (
        <Card title="By platform" flush>
          <table class="data">
            <thead><tr><th>Platform</th><th class="num">Posts</th><th class="num">Upvotes</th><th class="num">Comments</th><th class="num">Sessions</th><th class="num">Per post</th></tr></thead>
            <tbody>
              {d.byPlatform.map((p) => (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  <td class="num">{formatNumber(p.posts)}</td>
                  <td class="num">{formatNumber(p.points)}</td>
                  <td class="num">{formatNumber(p.comments)}</td>
                  <td class="num">{formatNumber(p.sessions)}</td>
                  <td class="num muted">{formatNumber(Math.round(p.sessions / p.posts))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Your posts" sub="Newest first · assign a product when it isn’t picked up from the text"
        actions={
          <div class="row">
            <select aria-label="Product" value={product} onChange={(e) => setProduct(e.currentTarget.value)}>
              <option value="">All products</option>
              {d.products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.currentTarget.value)}>
              <option value="">All platforms</option>
              {d.platforms.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
        } flush>
        {d.items.length ? (
          <table class="data posts-table">
            <thead><tr><th>Date</th><th>Post</th><th class="num">Upvotes</th><th class="num">Comments</th><th class="num">Sessions</th><th>Product</th><th /></tr></thead>
            <tbody>
              {d.items.map((p) => (
                <tr key={p.id}>
                  <td class="small muted mono" style={{ whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toISOString().slice(0, 10)}</td>
                  <td>
                    <a href={p.permalink} target="_blank" rel="noreferrer">{p.title}</a>
                    <div class="small muted">{label(p.platform)}{p.community ? ` · ${p.community}` : ''}{p.manual ? ' · added by hand' : ''}</div>
                  </td>
                  <td class="num">{p.points === null ? '—' : formatNumber(p.points)}</td>
                  <td class="num">{p.comments === null ? '—' : formatNumber(p.comments)}</td>
                  <td class="num" title={p.attribution === 'utm' ? 'Exact: utm_campaign sessions' : p.attribution === 'timing' ? 'Likely: referrer sessions in the 3 days after posting' : 'No GA4 site for this post’s product'}>
                    {p.sessions === null ? '—' : `${p.attribution === 'timing' ? '~' : ''}${formatNumber(p.sessions)}`}
                  </td>
                  <td>
                    <select aria-label="Product" value={p.product} class={p.assigned ? '' : 'muted'}
                      onChange={async (e) => { await api.post('/posts/product', { id: p.id, product: e.currentTarget.value }); data.reload(); }}>
                      <option value="">—</option>
                      {d.products.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </td>
                  <td class="num">
                    <button class="btn ghost" type="button" title={p.manual ? 'Delete' : 'Hide'} aria-label={p.manual ? 'Delete post' : 'Hide post'}
                      onClick={async () => { await api.post('/posts/hide', { id: p.id }); data.reload(); }}><Icon name="x" size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '16px' }}>
            <Empty title={d.accounts.length ? 'No posts in this range' : 'Add your accounts'}>
              {d.accounts.length ? 'Try a longer range, or sync now.' : 'Name your usernames above and Studio pulls in everything you’ve posted.'}
            </Empty>
          </div>
        )}
      </Card>
      <p class="note">Sessions marked ~ are inferred from timing. For exact numbers, post links with <span class="mono">?utm_source=reddit&amp;utm_campaign=my-post</span>.</p>
    </>
  );
}

function Accounts({ data, open, onSaved }) {
  const fetchable = data.platforms.filter((p) => p.fetch);
  const [rows, setRows] = useState(() => (data.accounts.length ? data.accounts : [{ platform: 'reddit', handle: '' }]));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const labelOf = (key) => data.platforms.find((p) => p.key === key)?.label || key;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/posts/accounts', { accounts: rows.filter((r) => r.handle.trim()) });
      setTimeout(onSaved, 2500);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // One line per account: what's missing, the last sync error, or ready.
  function state(r, p) {
    if (!p) return null;
    if (!p.ready) {
      return <span class="account-state bad"><span class="status-dot warn" /> Needs {p.key === 'reddit' ? 'a Reddit app' : 'a Product Hunt token'} · <a href="#/settings?i=mentions">set up</a></span>;
    }
    const err = data.errors[`${r.platform}:${r.handle.trim().replace(/^(u\/|@)/i, '')}`];
    if (err) return <span class="account-state bad"><span class="status-dot bad" /> {err}</span>;
    const saved = data.accounts.some((a) => a.platform === r.platform && a.handle === r.handle.trim());
    return <span class="account-state"><span class={`status-dot ${saved ? 'good' : 'off'}`} /> {saved ? 'Syncing' : 'Not saved yet'}</span>;
  }

  return (
    <details class="card posts-panel" open={open}>
      <summary class="card-head">
        <h2>Your accounts</h2>
        <span class="sub">{data.accounts.map((a) => `${labelOf(a.platform)} · ${a.handle}`).join(', ') || 'none yet'}</span>
        <Icon name="chevron" size={14} class="chev" />
      </summary>
      <form class="card-body stack" onSubmit={save} style={{ gap: '8px' }}>
        {rows.map((r, i) => {
          const p = fetchable.find((x) => x.key === r.platform);
          return (
            <div class="account-row" key={i}>
              <select aria-label="Platform" value={r.platform} onChange={(e) => update(i, { platform: e.currentTarget.value })}>
                {fetchable.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
              <input aria-label="Username" value={r.handle} placeholder={p?.handle} onInput={(e) => update(i, { handle: e.currentTarget.value })} />
              {state(r, p)}
              <button class="btn ghost icon-btn" type="button" aria-label="Remove account" title="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>
            </div>
          );
        })}
        <div class="row" style={{ marginTop: '4px' }}>
          <button class="btn" type="button" onClick={() => setRows([...rows, { platform: 'hn', handle: '' }])}><Icon name="plus" size={13} /> Add account</button>
          <button class="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save and sync'}</button>
          {error && <span class="small" style={{ color: 'var(--critical-ink)' }}>{error}</span>}
        </div>
        <p class="note" style={{ margin: 0 }}>LinkedIn and X can’t be fetched (no API for your own posts without partner approval or a paid plan). Add those by URL below.</p>
      </form>
    </details>
  );
}

function AddByUrl({ products, onAdded }) {
  const empty = { url: '', title: '', date: new Date().toISOString().slice(0, 10), points: '', comments: '', product: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const set = (patch) => setForm({ ...form, ...patch });
  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/posts/manual', form);
      setForm(empty);
      onAdded();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <details class="card posts-panel">
      <summary class="card-head">
        <h2>Add a post by URL</h2>
        <span class="sub">LinkedIn, X, Indie Hackers, a blog: anything without an API</span>
        <Icon name="chevron" size={14} class="chev" />
      </summary>
      <form class="card-body stack" onSubmit={add} style={{ gap: '12px' }}>
        <div class="post-form">
          <label class="field">Post URL<input required type="url" value={form.url} placeholder="https://www.linkedin.com/posts/…" onInput={(e) => set({ url: e.currentTarget.value })} /></label>
          <label class="field">Posted on<input type="date" value={form.date} onInput={(e) => set({ date: e.currentTarget.value })} /></label>
          <label class="field">Product
            <select value={form.product} onChange={(e) => set({ product: e.currentTarget.value })}>
              <option value="">Match from title</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label class="field">Title<input value={form.title} placeholder="What it was about" onInput={(e) => set({ title: e.currentTarget.value })} /></label>
          <label class="field"><span class="field-label">Reactions <small>optional</small></span><input type="number" min="0" value={form.points} placeholder="0" onInput={(e) => set({ points: e.currentTarget.value })} /></label>
          <label class="field"><span class="field-label">Comments <small>optional</small></span><input type="number" min="0" value={form.comments} placeholder="0" onInput={(e) => set({ comments: e.currentTarget.value })} /></label>
        </div>
        <div class="row">
          <button class="btn primary" type="submit"><Icon name="plus" size={13} /> Add post</button>
          {error && <span class="small" style={{ color: 'var(--critical-ink)' }}>{error}</span>}
        </div>
      </form>
    </details>
  );
}
