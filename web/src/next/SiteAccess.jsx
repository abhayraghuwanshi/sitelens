import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

// The hosted Studio (fly.toml's STUDIO_HOST), where sharing lives.
const HOSTED = 'https://kauzl.com';

export function SiteAccess({ site, hosted }) {
  if (!hosted) return <DesktopNote site={site} />;
  return <SharedList site={site} />;
}

// The desktop app runs on this computer, so no one else can open it: say where
// sharing happens instead of hiding it.
function DesktopNote({ site }) {
  return (
    <section class="card card-plain nx-access" aria-label="People with access">
      <div>
        <h3 class="nx-fn-title">People with access</h3>
        <p class="muted small m-0">
          This desktop app runs on your computer, so only you can open it. To let others view {site.label} (view only, just this site), share it from the hosted Kauzl:
          add the site there, then add people by email on its Edit page.
        </p>
      </div>
      <div class="nx-access-add">
        <input type="email" placeholder="name@example.com" disabled aria-label="Email address (hosted Kauzl only)" />
        <a class="btn primary" href={`${HOSTED}/login`} target="_blank" rel="noreferrer"><Icon name="plus" size={13} /> Share from the hosted Kauzl</a>
      </div>
    </section>
  );
}

// Site Edit page → People with access (hosted): the people this site is shared with,
// view only. They sign in with Google at /login; the gateway (server/hosted.mjs)
// sends their reads of this site to your workspace and refuses everything else.
function SharedList({ site }) {
  const list = useAsync(() => api.get(`/shares${qs({ site: site.id })}`), [site.id]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const signIn = `${location.origin}/login`;

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      list.reload();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const add = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (await run(() => api.post('/shares', { site: site.id, email: email.trim() }))) setEmail('');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(signIn);
      setCopied(true);
    } catch { /* clipboard refused */ }
  };
  const people = list.data?.people || [];

  return (
    <section class="card card-plain nx-access" aria-label="People with access">
      <div class="nx-jsum-bar">
        <div>
          <h3 class="nx-fn-title">People with access</h3>
          <p class="muted small m-0">
            They can look at {site.label}’s dashboards and reports. They can’t change anything, see your other sites, or reach your Google, GitHub or other accounts.
          </p>
        </div>
      </div>
      <form class="nx-access-add" onSubmit={add}>
        <label class="sr-only" for="share-email">Email address</label>
        <input id="share-email" type="email" placeholder="name@example.com" value={email} autocomplete="off"
          onInput={(e) => setEmail(e.currentTarget.value)} />
        <button class="btn primary" type="submit" disabled={busy || !email.trim()}><Icon name="plus" size={13} /> Add</button>
      </form>
      {error && <p class="nx-error small m-0" role="alert">{error}</p>}
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
        : !list.data ? <Loading height={60} />
        : people.length ? (
          <ul class="nx-access-list">
            {people.map((p) => (
              <li key={p.email}>
                <span class="nx-access-avatar" aria-hidden="true">{p.email[0].toUpperCase()}</span>
                <span class="nx-access-who">
                  <b>{p.email}</b>
                  <span class="muted small">View only · added {day(p.addedAt)} · {p.lastSeen ? `last here ${day(p.lastSeen)}` : 'hasn’t signed in yet'}</span>
                </span>
                <button class="btn ghost" type="button" disabled={busy} onClick={() => run(() => api.del(`/shares${qs({ site: site.id, email: p.email })}`))}
                  aria-label={`Remove ${p.email}`}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p class="muted small m-0">Only you can see this site.</p>}
      <p class="muted small nx-access-how">
        Send them this link; they sign in with the Google account for that email: <code>{signIn}</code>{' '}
        <button class="btn ghost" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        <br />Removing someone ends their access straight away. Their visits run your BigQuery queries, on your Google Cloud bill.
      </p>
    </section>
  );
}

const day = (ms) => new Date(ms).toLocaleDateString('en', { month: 'short', day: 'numeric' });
