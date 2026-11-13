import { useState } from 'preact/hooks';
import { formatNumber, formatRelative, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { taggedLink, slug } from '../../../shared/utm.js';
import { Card, KpiStrip, Loading, ErrorState, Empty } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { LineChart } from '../charts/LineChart.jsx';

// Where a post opens inside Studio (ids carry ':' and '/', so they're encoded).
export const postHref = (id) => `#/posts/${encodeURIComponent(id)}`;

// Your own posts across platforms, with the traffic each one likely brought;
// #/posts/<id> opens one post.
export function Posts({ range, id }) {
  return id ? <PostDetail key={id} id={decodeURIComponent(id)} /> : <PostList range={range} />;
}

function PostList({ range }) {
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
      <LinkBuilder data={d} />

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
                    <a href={postHref(p.id)}>{p.title}</a>
                    {' '}<a href={p.permalink} target="_blank" rel="noreferrer" class="muted" title="Open the post" aria-label="Open the post"><Icon name="external" size={12} /></a>
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

      <Campaigns data={d} />
      <p class="note">Sessions marked ~ are inferred from timing. For exact numbers, share a tagged link from <b>Make a tagged link</b> above.</p>
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
      return <span class="account-state bad"><span class="status-dot warn" /> Needs a Product Hunt token · <a href="#/settings?i=mentions">set up</a></span>;
    }
    const saved = data.accounts.find((a) => a.platform === r.platform && a.handle.toLowerCase() === r.handle.trim().replace(/^(u\/|@|~)/i, '').toLowerCase());
    const err = saved && data.errors[`${saved.platform}:${saved.handle}`];
    if (err) return <span class="account-state bad"><span class="status-dot bad" /> {err}</span>;
    const feedOnly = p.key === 'reddit' && p.scores === false;
    return (
      <span class="account-state"><span class={`status-dot ${saved ? 'good' : 'off'}`} /> {saved ? 'Syncing' : 'Not saved yet'}
        {feedOnly && <> · public feed, no upvotes · <a href="#/settings?i=mentions">add a Reddit app</a></>}
      </span>
    );
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
          {error && <span class="small text-bad">{error}</span>}
        </div>
        <p class="note" style={{ margin: 0 }}>No login needed: Studio reads public profiles. LinkedIn and X can’t be read that way (their APIs need partner approval or a paid plan), so add those by URL below.</p>
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
          {error && <span class="small text-bad">{error}</span>}
        </div>
      </form>
    </details>
  );
}

// A link to your page with utm_* tags, so GA4 counts the visits a post brings exactly.
function LinkBuilder({ data }) {
  const withSite = data.products.filter((p) => p.url);
  const [form, setForm] = useState(() => ({ url: withSite[0]?.url || '', platform: 'reddit', source: '', campaign: '', content: '' }));
  const [copied, setCopied] = useState(false);
  const set = (patch) => { setForm({ ...form, ...patch }); setCopied(false); };
  const other = form.platform === 'other';
  let link = '';
  let error = '';
  try {
    link = form.url && form.campaign ? taggedLink({ ...form, medium: other ? 'referral' : 'social' }) : '';
  } catch (err) {
    error = err.message;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <details class="card posts-panel">
      <summary class="card-head">
        <h2>Make a tagged link</h2>
        <span class="sub">Share this instead of the bare URL, and the sessions it brings are counted exactly</span>
        <Icon name="chevron" size={14} class="chev" />
      </summary>
      <div class="card-body stack" style={{ gap: '12px' }}>
        <div class="post-form">
          <label class="field">Page
            <input type="url" list="link-builder-sites" value={form.url} placeholder="https://your-site.com/blog/post" onInput={(e) => set({ url: e.currentTarget.value })} />
            <datalist id="link-builder-sites">{withSite.map((p) => <option key={p.id} value={p.url}>{p.label}</option>)}</datalist>
          </label>
          <label class="field">Where you’ll post it
            <select value={form.platform} onChange={(e) => set({ platform: e.currentTarget.value })}>
              {data.platforms.filter((p) => p.utmSource || p.key === 'other').map((p) => <option key={p.key} value={p.key}>{p.key === 'other' ? 'Somewhere else' : p.label}</option>)}
            </select>
          </label>
          {other && <label class="field">Source<input value={form.source} placeholder="newsletter, discord, indiehackers" onInput={(e) => set({ source: e.currentTarget.value })} /></label>}
          <label class="field">Campaign<input value={form.campaign} placeholder="launch-post" onInput={(e) => set({ campaign: e.currentTarget.value })} onBlur={(e) => set({ campaign: slug(e.currentTarget.value) })} /></label>
          <label class="field"><span class="field-label">Variant <small>optional</small></span><input value={form.content} placeholder="r-sideproject" onInput={(e) => set({ content: e.currentTarget.value })} /></label>
        </div>
        {link ? (
          <div class="row" style={{ flexWrap: 'wrap' }}>
            <code class="mono small" style={{ wordBreak: 'break-all', flex: '1 1 320px' }}>{link}</code>
            <button class="btn primary" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
        ) : (
          <p class="small muted" style={{ margin: 0 }}>{error || 'Pick the page and name the campaign; one campaign per post keeps the numbers apart.'}</p>
        )}
      </div>
    </details>
  );
}

// Every utm_campaign GA4 saw on your product sites, and the post it belongs to.
function Campaigns({ data }) {
  if (!data.campaigns?.length) return null;
  const productLabel = (id) => data.products.find((p) => p.id === id)?.label || id;
  return (
    <Card title="Tagged links" sub="GA4 sessions per utm_campaign in this range" flush>
      <table class="data">
        <thead><tr><th>Campaign</th><th>Source</th><th>Product</th><th>Post</th><th class="num">Sessions</th></tr></thead>
        <tbody>
          {data.campaigns.map((c) => (
            <tr key={`${c.product}:${c.campaign}`}>
              <td class="mono small">{c.campaign}</td>
              <td class="small">{c.sources.join(', ')}</td>
              <td class="small muted">{productLabel(c.product)}</td>
              <td class="small">{c.post ? <a href={c.post.permalink} target="_blank" rel="noreferrer">{c.post.title}</a> : <span class="muted">no post logged</span>}</td>
              <td class="num">{formatNumber(c.sessions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// One post: what it brought to your site, which pages those visits landed on,
// and whether they stayed. The post itself is a link out; the analysis stays here.
function PostDetail({ id }) {
  const data = useAsync(() => api.get(`/posts/item${qs({ id })}`), [id]);
  if (data.error) return <><a class="btn ghost" href="#/posts"><Icon name="chevron" size={13} class="flip" /> All posts</a><ErrorState error={data.error} onRetry={data.reload} /></>;
  if (!data.data) return <><Loading height={120} /><Loading height={300} /></>;
  const d = data.data;
  const p = d.post;
  const day = new Date(p.createdAt).toISOString().slice(0, 10);
  const w = d.window;
  const assign = async (product) => { await api.post('/posts/product', { id: p.id, product }); data.reload(); };

  return (
    <>
      <div class="post-head">
        <a class="btn ghost" href="#/posts"><Icon name="chevron" size={13} class="flip" /> All posts</a>
        <h2>{p.title}</h2>
        <div class="meta-line" style={{ alignItems: 'center' }}>
          <span>{d.platform.label}{p.community ? ` · ${p.community}` : ''}</span>
          <span>{longDate(day)}</span>
          {p.manual && <span>added by hand</span>}
          <label class="row" style={{ gap: '6px' }}>Product
            <select value={p.product} onChange={(e) => assign(e.currentTarget.value)}>
              <option value="">—</option>
              {d.products.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <a class="btn" href={p.permalink} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> Open on {d.platform.label}</a>
        </div>
      </div>

      {!d.site ? (
        <Card>
          <Empty title="No site to measure against">
            {d.product ? `${d.product.label} has no GA4 property linked, so there’s no traffic to show.` : 'Pick the product this post was about (above) and Studio shows what it brought to that product’s site.'}
          </Empty>
        </Card>
      ) : (
        <>
          {d.authError ? (
            <div class="state error" role="alert">
              <h3>Google sign-in expired</h3>
              <p class="small" style={{ margin: 0 }}>Studio can’t ask Google Analytics what this post brought. {d.stored ? 'The chart below is from the calendar’s stored copy; pages, referrers and engagement need a fresh sign-in.' : 'Sign in again to see it.'}</p>
              <a class="btn primary" href="#/settings?i=google">Sign in to Google again</a>
            </div>
          ) : d.error && <p class="note" style={{ margin: 0 }}><b>Google Analytics:</b> {d.error}</p>}
          {Date.now() - p.createdAt < 86_400_000 && (
            <p class="note" style={{ margin: 0 }}>Posted {formatRelative(p.createdAt)}. Google Analytics takes a few hours to report visits, so today’s numbers are still filling in.</p>
          )}
          <KpiStrip items={[
            { label: 'Sessions brought', value: d.sessions === null ? '—' : `${d.attribution === 'timing' ? '~' : ''}${formatNumber(d.sessions)}`,
              meta: d.attribution === 'utm' ? `exact: utm_campaign=${d.campaign}` : `${d.platform.label} referrals, ${d.windowDays} days`,
              help: d.attribution === 'utm' ? 'Sessions tagged with this post’s utm_campaign.' : 'This platform’s referrer sessions on the post day and the two after, split with your other posts from it in that window.' },
            { label: `Usual from ${d.platform.label}`, value: d.usual === null ? '—' : `${formatNumber(d.usual)}/day`, meta: 'median, 2 weeks before' },
            { label: 'Engaged', value: w?.sessions ? `${Math.round((w.engaged / w.sessions) * 100)}%` : '—', meta: w?.sessions ? `${formatNumber(w.engaged)} of ${formatNumber(w.sessions)} sessions` : '' },
            { label: 'New users', value: w ? formatNumber(w.newUsers) : '—' },
            { label: 'Key events', value: w ? formatNumber(w.keyEvents) : '—' },
            { label: 'Upvotes · comments', value: `${p.points === null ? '—' : formatNumber(p.points)} · ${p.comments === null ? '—' : formatNumber(p.comments)}`,
              meta: p.points !== null ? '' : p.manual ? 'added by hand: none recorded' : p.platform === 'reddit' ? 'add a Reddit app in Settings → Mentions' : '' },
          ]} />

          {d.series.length > 1 && (
            <Card title={`Visits from ${d.platform.label}`} sub="Each day, two weeks before the post to a week after">
              <LineChart height={220} series={[{ label: d.platform.label, values: d.series.map((x) => x.sessions) }]}
                labels={d.series.map((x) => formatDate(x.date.replaceAll('-', '')))} dates={d.series.map((x) => x.date)}
                annotations={[{ id: p.id, date: day, label: p.title, kind: 'post' }]} format={formatNumber} tooltipTitle="Sessions" />
            </Card>
          )}

          <div class="grid cols-2">
            <Card title="Where they landed" sub={w ? `${shortDate(w.start)}–${shortDate(w.end)}` : ''} flush>
              {d.landing.length ? (
                <table class="data">
                  <thead><tr><th>Page</th><th class="num">Sessions</th><th class="num">Engaged</th><th class="num">Key events</th></tr></thead>
                  <tbody>{d.landing.map((r) => (
                    <tr key={r.label}>
                      <td class="cell-path" title={r.label}><code>{r.label}</code></td>
                      <td class="num">{formatNumber(r.sessions)}</td>
                      <td class="num muted">{r.sessions ? `${Math.round((r.engaged / r.sessions) * 100)}%` : '—'}</td>
                      <td class="num">{formatNumber(r.keyEvents)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div style={{ padding: '16px' }}><Empty title={d.error ? 'Needs Google' : 'No visits yet'}>{d.error ? 'Landing pages come straight from Google Analytics.' : w ? 'Nothing from this post reached the site in its window.' : 'Traffic shows here once Google Analytics reports the post day.'}</Empty></div>}
            </Card>
            <Card title="Referrers" sub={d.attribution === 'utm' ? 'Sources carrying the campaign' : `${d.platform.label} domains`} flush>
              {d.sources.length ? (
                <table class="data">
                  <thead><tr><th>Source</th><th class="num">Sessions</th><th class="num">New users</th></tr></thead>
                  <tbody>{d.sources.map((r) => (
                    <tr key={r.label}><td>{r.label}</td><td class="num">{formatNumber(r.sessions)}</td><td class="num">{formatNumber(r.newUsers)}</td></tr>
                  ))}</tbody>
                </table>
              ) : <div style={{ padding: '16px' }}><Empty title={d.error ? 'Needs Google' : 'No referrers yet'} /></div>}
            </Card>
          </div>
          {d.attribution === 'timing' && <p class="note">Sessions marked ~ are inferred from timing: visits from {d.platform.label} around the post. Share a tagged link (My posts → Make a tagged link) for exact numbers.</p>}
        </>
      )}
      {p.text && <Card title="Post"><p class="post-text">{p.text.slice(0, 1200)}{p.text.length > 1200 ? '…' : ''}</p></Card>}
    </>
  );
}

const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
