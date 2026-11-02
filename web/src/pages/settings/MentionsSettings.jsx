import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card } from '../../components/ui.jsx';

// Keywords, Product Hunt launches and the Reddit / Product Hunt credentials (Settings → Mentions).
export function MentionsSettings() {
  const data = useAsync(() => api.get('/mentions?range=7d'), []);
  const [keywords, setKeywords] = useState('');
  const [slugs, setSlugs] = useState('');
  const [minPoints, setMinPoints] = useState('0');
  const [reddit, setReddit] = useState({ id: '', secret: '' });
  const [phToken, setPhToken] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/mentions/settings').then((s) => {
      setKeywords(s.keywords.map((k) => (k.scope ? `${k.term} | ${k.scope}` : k.term)).join('\n'));
      setSlugs(s.phSlugs.join('\n'));
      setMinPoints(String(s.minPoints));
    }).catch(() => {});
  }, []);

  async function run(fn, ok) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      const errors = Object.values(r?.errors || {});
      setMsg(errors.length ? { ok: false, text: errors.join(' · ') } : { ok: true, text: ok });
      data.reload();
      return true;
    } catch (err) {
      setMsg({ ok: false, text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
  const saveSettings = (e) => {
    e.preventDefault();
    run(() => api.post('/mentions/settings', {
      keywords: lines(keywords).map((l) => {
        const [term, scope] = l.split('|').map((x) => x.trim());
        return scope ? { term, scope } : { term };
      }),
      phSlugs: lines(slugs),
      minPoints: Number(minPoints) || 0,
    }), 'Saved. The next sync picks up new terms.');
  };
  const saveReddit = (e) => {
    e.preventDefault();
    run(() => api.post('/mentions/credentials', { redditClientId: reddit.id, redditClientSecret: reddit.secret }), 'Reddit connected and synced.')
      .then((saved) => saved && setReddit({ id: '', secret: '' }));
  };
  const savePh = (e) => {
    e.preventDefault();
    run(() => api.post('/mentions/credentials', { productHuntToken: phToken }), 'Product Hunt token saved and synced.').then((saved) => saved && setPhToken(''));
  };

  const src = data.data?.sources;
  const derived = (data.data?.terms || []).filter((t) => !t.origins.every((o) => o === 'keyword'));

  return (
    <Card title="Mentions" sub="Hacker News (no key), Reddit and Product Hunt mentions of your sites, repos and extensions">
      <div class="stack">
        {derived.length > 0 && (
          <p class="note" style={{ margin: 0 }}>
            Searched automatically: {derived.map((t) => <code key={t.term} style={{ marginRight: '6px' }}>{t.term}</code>)}
          </p>
        )}
        <form class="stack" onSubmit={saveSettings}>
          <label class="small">Extra keywords, one per line. Add <code>| site:&lt;id&gt;</code>, <code>| repo:owner/name</code> or <code>| ext:&lt;id&gt;</code> to tie one to a chart.
            <textarea rows={3} style={{ width: '100%', marginTop: '4px' }} value={keywords} onInput={(e) => setKeywords(e.currentTarget.value)} placeholder={'cool desk new tab\nnew tab by cooldesk'} />
          </label>
          <label class="small">Product Hunt launches to watch (post slug or URL), one per line
            <textarea rows={2} style={{ width: '100%', marginTop: '4px' }} value={slugs} onInput={(e) => setSlugs(e.currentTarget.value)} placeholder="https://www.producthunt.com/posts/cooldesk" />
          </label>
          <div class="row">
            <label class="small row">Chart markers and alerts for posts with ≥
              <input type="number" min="0" style={{ width: '70px' }} value={minPoints} onInput={(e) => setMinPoints(e.currentTarget.value)} /> points
            </label>
            <button class="btn primary" type="submit" disabled={busy}>Save</button>
          </div>
        </form>

        <div class="row small">
          <span class={`dot${src?.reddit.ready ? ' on' : ''}`} />
          {src?.reddit.ready ? <>Reddit app from {src.reddit.credentialSource === 'env' ? <code>REDDIT_CLIENT_ID</code> : 'Settings'}</> : 'Reddit: not connected'}
        </div>
        <form class="row" onSubmit={saveReddit}>
          <input autocomplete="off" style={{ flex: '1', minWidth: '180px' }} placeholder="Reddit client ID" value={reddit.id}
            onInput={(e) => setReddit({ ...reddit, id: e.currentTarget.value })} aria-label="Reddit client ID" />
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '180px' }} placeholder="Reddit secret" value={reddit.secret}
            onInput={(e) => setReddit({ ...reddit, secret: e.currentTarget.value })} aria-label="Reddit secret" />
          <button class="btn" type="submit" disabled={busy || !reddit.id.trim()}>Connect</button>
          {src?.reddit.credentialSource === 'settings' && (
            <button class="btn ghost danger" type="button" disabled={busy}
              onClick={() => run(() => api.post('/mentions/credentials', { redditClientId: '' }), 'Removed.')}>Remove</button>
          )}
        </form>
        <p class="note" style={{ margin: 0 }}>
          Create a “script” app at <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer">reddit.com/prefs/apps</a> (redirect URI can be
          {' '}<code>http://localhost</code>). Reddit may ask you to register for API access first. Or set <code>REDDIT_CLIENT_ID</code> and <code>REDDIT_CLIENT_SECRET</code> in <code>.env</code>.
        </p>

        <div class="row small">
          <span class={`dot${src?.ph.hasToken ? ' on' : ''}`} />
          {src?.ph.hasToken ? <>Product Hunt token from {src.ph.credentialSource === 'env' ? <code>PRODUCTHUNT_TOKEN</code> : 'Settings'}</> : 'Product Hunt: no token'}
        </div>
        <form class="row" onSubmit={savePh}>
          <input type="password" autocomplete="off" style={{ flex: '1', minWidth: '240px' }} placeholder="Product Hunt developer token" value={phToken}
            onInput={(e) => setPhToken(e.currentTarget.value)} aria-label="Product Hunt token" />
          <button class="btn" type="submit" disabled={busy || !phToken.trim()}>Save</button>
          {src?.ph.credentialSource === 'settings' && (
            <button class="btn ghost danger" type="button" disabled={busy}
              onClick={() => run(() => api.post('/mentions/credentials', { productHuntToken: '' }), 'Removed.')}>Remove</button>
          )}
        </form>
        <p class="note" style={{ margin: 0 }}>
          Create an app at <a href="https://www.producthunt.com/v2/oauth/applications" target="_blank" rel="noreferrer">producthunt.com/v2/oauth/applications</a> and
          copy its <b>developer token</b>, or set <code>PRODUCTHUNT_TOKEN</code> in <code>.env</code>. Product Hunt’s API has no search, so it watches the launches listed above.
        </p>
        {msg && <p class="small" style={{ margin: 0, color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}
      </div>
    </Card>
  );
}
