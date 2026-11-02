import { useEffect, useState } from 'preact/hooks';
import { api, qs } from '../../api.js';
import { useAsync, navigate } from '../../hooks.js';
import { Card, ErrorState, Loading } from '../../components/ui.jsx';
import { Icon } from '../../components/icons.jsx';
import { GoalsEditor } from './Goals.jsx';

// Settings → Products: a product is set up stage by stage, the same order as its
// journey: domains & hosting → analytics → code & releases → distribution → community → goals.
export function ProductsCard({ params }) {
  const data = useAsync(() => api.get('/products/setup'), []);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const editId = params?.get('edit') || '';

  useEffect(() => {
    if (!data.data) return;
    // edit=new&site=<id> starts a product for that site.
    if (editId === 'new') setEditing(params.get('site') ? { siteId: params.get('site') } : {});
    else if (editId) setEditing(data.data.products.find((p) => p.id === editId) || null);
  }, [editId, data.data]);

  async function add(product) {
    setError(null);
    try {
      const saved = await api.post('/products/setup', product);
      navigate(`/product/${saved.id}`);
    } catch (err) {
      setError(err);
    }
  }

  async function remove(id) {
    setError(null);
    try {
      await api.del(`/products/${id}`);
      data.reload();
    } catch (err) {
      setError(err);
    }
  }

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading height={120} />;
  const setup = data.data;
  const { products, suggestions } = setup;
  const hostingLabel = (p) => setup.hosting.find((h) => h.key === p.hosting?.provider)?.label;

  if (editing) {
    return (
      <ProductForm key={editing.id || 'new'} initial={editing} setup={setup} focus={params?.get('focus') || ''}
        onCancel={() => { setEditing(null); navigate('/settings?tab=products'); }}
        onSaved={(p) => navigate(`/product/${p.id}`)} />
    );
  }

  return (
    <Card title="Products" sub="Everything one product runs on: domains, hosting, analytics, code, store listings and community"
      actions={
        <div class="row">
          {suggestions.map((s) => (
            <button key={s.id} class="btn" type="button" onClick={() => add(s)}><Icon name="sparkles" size={13} /> Add {s.label}</button>
          ))}
          <button class="btn primary" type="button" onClick={() => setEditing({})}><Icon name="plus" size={13} /> Add product</button>
        </div>
      } flush>
      {products.length > 0 && (
        <table class="data">
          <thead><tr><th>Product</th><th>Domains</th><th>Hosting</th><th>Sources</th><th /></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><a href={`#/product/${p.id}`}><b>{p.label}</b></a></td>
                <td class="small mono">{(p.domains || []).map((d) => d.name).join(', ') || <span class="muted">from site</span>}</td>
                <td class="small">{hostingLabel(p) || <span class="muted">not set</span>}</td>
                <td class="small muted">{[p.siteId && 'GA4', p.repos.length && `${p.repos.length} repo${p.repos.length > 1 ? 's' : ''}`, p.extensionIds.length && `${p.extensionIds.length} extension${p.extensionIds.length > 1 ? 's' : ''}`, p.keywords?.length && `${p.keywords.length} keywords`, p.goals?.length && `${p.goals.length} goal${p.goals.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</td>
                <td class="num" style={{ whiteSpace: 'nowrap' }}>
                  <button class="btn ghost" type="button" onClick={() => setEditing(p)}>Edit</button>
                  <button class="btn ghost danger" type="button" onClick={() => remove(p.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!products.length && <p class="muted" style={{ padding: '8px 16px' }}>No products yet.</p>}
      {error && <div style={{ padding: '0 16px 12px' }}><ErrorState error={error} /></div>}
    </Card>
  );
}

const bareHost = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

function ProductForm({ initial, setup, focus, onCancel, onSaved }) {
  const { options } = setup;
  const site = (id) => options.sites.find((s) => s.id === id);
  const [form, setForm] = useState(() => {
    const s = site(initial.siteId);
    return {
      label: initial.label || '',
      siteId: initial.siteId || '',
      repos: initial.repos || [],
      extensionIds: initial.extensionIds || [],
      domains: initial.domains || (s && !s.demo && s.host ? [{ name: bareHost(s.host) }] : []),
      hosting: initial.hosting || hostingFromLinks(setup, initial.siteId),
      keywords: initial.keywords || [],
      goals: initial.goals || [],
    };
  });
  // #/settings?tab=products&edit=<id>&focus=goals (from the Outcomes page) jumps to that section.
  useEffect(() => {
    const el = focus && document.getElementById(`stage-${focus}`);
    // Offset for the sticky page header.
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72 });
  }, [focus]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function pickSite(siteId) {
    const s = site(siteId);
    const patch = { siteId };
    // A fresh product picks up the site's domain and existing hosting link.
    if (s && !s.demo && s.host && !form.domains.length) patch.domains = [{ name: bareHost(s.host) }];
    if (!form.hosting?.provider) patch.hosting = hostingFromLinks(setup, siteId);
    set(patch);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.post('/products/setup', { ...form, id: initial.id, previousId: initial.id }));
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <form class="stack" onSubmit={save}>
      <Card title={initial.id ? `Set up ${initial.label}` : 'Add a product'} sub="Each section feeds one stage of the product’s journey. Skip what doesn’t apply.">
        <label class="field" style={{ maxWidth: '360px' }}>Product name
          <input required value={form.label} placeholder="Cooldesk" onInput={(e) => set({ label: e.currentTarget.value })} />
        </label>
      </Card>

      <Stage icon="globe" title="Domains" sub="Expiry, DNS and SSL are checked from public records. No registrar login needed." done={form.domains.length > 0}>
        <Domains domains={form.domains} registrars={setup.registrars} hostingNames={Object.fromEntries(setup.hosting.map((h) => [h.key, h.label]))} onChange={(domains) => set({ domains })}
          onHostingGuess={(provider) => !form.hosting?.provider && set({ hosting: { provider } })} />
      </Stage>

      <Stage icon="rocket" title="Hosting & deploys" sub="Where the site runs. Firebase and Vercel give Studio a deploy feed; other hosts are recorded for context." done={hostingState(form.hosting)}>
        <Hosting hosting={form.hosting || {}} setup={setup} siteId={form.siteId} onChange={(hosting) => set({ hosting })} />
      </Stage>

      <Stage icon="chart" title="Analytics" sub="The GA4 site behind traffic, referrers and the day drawer." done={Boolean(form.siteId)}>
        <label class="field" style={{ maxWidth: '360px' }}>GA4 site
          <select value={form.siteId} onChange={(e) => pickSite(e.currentTarget.value)}>
            <option value="">— none —</option>
            {options.sites.map((s) => <option key={s.id} value={s.id}>{s.label}{s.demo ? ' (demo)' : ` · ${s.host}`}</option>)}
          </select>
          <small>Missing? Add it in <a href="#/settings?tab=sites">Settings → Sites</a>.</small>
        </label>
      </Stage>

      <Stage icon="github" title="Code & releases" sub="GitHub releases mark the timeline; release downloads count as an outcome." done={form.repos.length > 0}>
        <Repos repos={options.repos} selected={form.repos} onChange={(repos) => set({ repos })} />
      </Stage>

      <Stage icon="puzzle" title="Distribution" sub="Chrome Web Store listings: installs, users, rating and version changes." done={form.extensionIds.length > 0}>
        {options.extensions.length ? options.extensions.map((x) => (
          <label class="check" key={x.id}>
            <input type="checkbox" checked={form.extensionIds.includes(x.id)}
              onChange={(e) => set({ extensionIds: e.currentTarget.checked ? [...form.extensionIds, x.id] : form.extensionIds.filter((v) => v !== x.id) })} /> {x.label}
          </label>
        )) : <small class="muted">Track one on the <a href="#/extensions">Extensions</a> page first.</small>}
      </Stage>

      <Stage icon="chat" title="Community" sub="Posts and threads that bring traffic. The product name, domain and repos are searched automatically; add other names people use." done={form.keywords.length > 0}>
        <Keywords keywords={form.keywords} onChange={(keywords) => set({ keywords })} />
        <div class="row small">
          <Ready ok label="Hacker News" />
          <Ready ok={setup.community.reddit.ready} label="Reddit" href="#/settings?i=mentions" />
          <Ready ok={setup.community.ph.ready} label="Product Hunt" href="#/settings?i=mentions" />
        </div>
        <p class="note" style={{ margin: 0 }}>Tip: when you post a link yourself, add <span class="mono">?utm_source=reddit&amp;utm_campaign=&lt;post&gt;</span> so GA4 can tie visits to that exact post.</p>
      </Stage>

      <Stage id="goals" icon="target" title="Goals" sub="What counts as progress and what counts as a result: a purchase, a sign-up, an install, a download. Outcomes measures these." done={form.goals.length > 0}>
        <GoalsEditor goals={form.goals} onChange={(goals) => set({ goals })} siteId={form.siteId} hasStore={form.extensionIds.length > 0} hasRepos={form.repos.length > 0} />
      </Stage>

      {error && <ErrorState error={error} />}
      <div class="row">
        <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
        <button class="btn ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function hostingFromLinks(setup, siteId) {
  if (!siteId) return {};
  const fb = setup.firebase.links.find((l) => l.siteId === siteId);
  if (fb) return { provider: 'firebase', firebase: { project: fb.project, service: fb.service, location: fb.location } };
  const vc = setup.vercel.matches[siteId];
  if (vc) return { provider: 'vercel', vercel: { projectId: vc } };
  return {};
}

// Set, or picked but its deploy feed still needs a backend/project ('warn').
function hostingState(h) {
  if (!h?.provider) return false;
  if (h.provider === 'firebase' && !h.firebase?.service) return 'warn';
  if (h.provider === 'vercel' && !h.vercel?.projectId) return 'warn';
  return true;
}

function Stage({ id, icon, title, sub, done, children }) {
  return (
    <section class="card setup-stage" id={id ? `stage-${id}` : undefined}>
      <header class="card-head">
        <Icon name={icon} size={15} />
        <h2>{title}</h2>
        <span class={`status-dot ${done === 'warn' ? 'warn' : done ? 'good' : 'off'}`} title={done === 'warn' ? 'Needs one more step' : done ? 'Set' : 'Not set'} />
        <span class="spacer" />
      </header>
      <div class="card-body stack" style={{ gap: '10px' }}>
        <p class="note" style={{ margin: 0 }}>{sub}</p>
        {children}
      </div>
    </section>
  );
}

function Ready({ ok, label, href }) {
  return (
    <span class="chip" style={ok ? undefined : { opacity: 0.75 }}>
      <span class={`status-dot ${ok ? 'good' : 'off'}`} /> {label}
      {!ok && href && <> · <a href={href}>connect</a></>}
    </span>
  );
}

function Domains({ domains, registrars, hostingNames, onChange, onHostingGuess }) {
  const [input, setInput] = useState('');
  function add(e) {
    e.preventDefault();
    const name = bareHost(input.trim().replace(/^https?:\/\//, '').replace(/[/:].*$/, ''));
    if (name && !domains.some((d) => d.name === name)) onChange([...domains, { name }]);
    setInput('');
  }
  const update = (name, patch) => onChange(domains.map((d) => (d.name === name ? { ...d, ...patch } : d)));
  return (
    <div class="stack" style={{ gap: '8px' }}>
      {domains.map((d) => (
        <DomainRow key={d.name} domain={d} registrars={registrars} hostingNames={hostingNames} onChange={(patch) => update(d.name, patch)}
          onRemove={() => onChange(domains.filter((x) => x.name !== d.name))} onHostingGuess={onHostingGuess} />
      ))}
      <div class="row">
        <input value={input} placeholder="example.com" aria-label="Add a domain" style={{ maxWidth: '260px' }}
          onInput={(e) => setInput(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && add(e)} />
        <button class="btn" type="button" onClick={add} disabled={!input.trim()}><Icon name="plus" size={13} /> Add domain</button>
      </div>
    </div>
  );
}

function DomainRow({ domain, registrars, hostingNames, onChange, onRemove, onHostingGuess }) {
  const found = useAsync(() => api.get(`/products/detect${qs({ host: domain.name })}`), [domain.name]);
  const info = found.data;
  useEffect(() => {
    if (!info) return;
    // Fill blanks from what the domain says about itself; never overwrite a choice.
    if (!domain.registrar && info.registrar) onChange({ registrar: info.registrar });
    if (info.hosting) onHostingGuess(info.hosting);
  }, [info]);
  const days = (ms) => Math.floor((ms - Date.now()) / 86_400_000);
  return (
    <div class="domain-row">
      <div class="domain-name mono">{domain.name}</div>
      <label class="field">Registrar
        <select value={domain.registrar || ''} onChange={(e) => onChange({ registrar: e.currentTarget.value })}>
          <option value="">— unknown —</option>
          {registrars.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </label>
      <div class="small domain-facts">
        {found.loading && <span class="muted">Checking registry, DNS and SSL…</span>}
        {found.error && <span class="muted">{found.error.message}</span>}
        {info && (
          <>
            <span>{info.expires ? `Expires in ${days(info.expires)}d` : 'Expiry not published'}{info.registrarName ? ` · ${info.registrarName}` : ''}</span>
            <span>{info.resolves ? `DNS${info.dnsHost ? ` at ${info.dnsHost}` : ' resolves'}` : 'DNS doesn’t resolve'}</span>
            <span>{info.ssl ? `SSL ${info.ssl.trusted ? `valid ${days(info.ssl.validTo)}d` : 'not trusted'} · ${info.ssl.issuer}` : 'No SSL'}</span>
            {info.hosting && <span class="muted">looks hosted on {hostingNames[info.hosting] || info.hosting}</span>}
          </>
        )}
      </div>
      <button class="btn ghost danger" type="button" onClick={onRemove} aria-label={`Remove ${domain.name}`}><Icon name="x" size={13} /></button>
    </div>
  );
}

function Hosting({ hosting, setup, siteId, onChange }) {
  const provider = hosting.provider || '';
  const chosen = setup.hosting.find((h) => h.key === provider);
  return (
    <div class="stack" style={{ gap: '10px' }}>
      <div class="provider-grid" role="radiogroup" aria-label="Hosting provider">
        {setup.hosting.map((h) => (
          <button key={h.key} type="button" role="radio" aria-checked={provider === h.key} class={`provider${provider === h.key ? ' on' : ''}`}
            onClick={() => onChange(provider === h.key ? {} : { provider: h.key, ...(h.key === 'firebase' ? { firebase: hosting.firebase } : {}), ...(h.key === 'vercel' ? { vercel: hosting.vercel } : {}) })}>
            <b>{h.label}</b>
            <small>{h.feed ? 'Deploy feed' : 'Recorded only'}</small>
          </button>
        ))}
      </div>
      {provider === 'firebase' && <FirebaseBackend value={hosting.firebase || {}} siteId={siteId} onChange={(firebase) => onChange({ ...hosting, firebase })} />}
      {provider === 'vercel' && (
        setup.vercel.connected ? (
          <label class="field" style={{ maxWidth: '360px' }}>Vercel project
            <select value={hosting.vercel?.projectId || ''} onChange={(e) => onChange({ ...hosting, vercel: e.currentTarget.value ? { projectId: e.currentTarget.value } : undefined })}>
              <option value="">— pick a project —</option>
              {setup.vercel.projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.domains[0] ? ` · ${p.domains[0]}` : ''}</option>)}
            </select>
            {setup.vercel.error && <small>{setup.vercel.error}</small>}
            {!siteId && <small>Pick the GA4 site below too: deploys are matched to it.</small>}
          </label>
        ) : <p class="note" style={{ margin: 0 }}>Connect Vercel in <a href="#/settings?i=vercel">Integrations → Vercel</a> to read deploys.</p>
      )}
      {chosen && !chosen.feed && (
        <>
          <label class="field" style={{ maxWidth: '360px' }}><span class="field-label">Plan or note <small>optional</small></span>
            <input value={hosting.note || ''} placeholder={provider === 'hostinger' ? 'Business Web Hosting, renews Mar' : ''} onInput={(e) => onChange({ ...hosting, note: e.currentTarget.value })} />
          </label>
          <p class="note" style={{ margin: 0 }}>{chosen.label} has no deploy feed Studio can read, so the Deploys stage uses GitHub releases, Web Store versions and the notes you add on charts.</p>
        </>
      )}
    </div>
  );
}

function FirebaseBackend({ value, siteId, onChange }) {
  const [project, setProject] = useState(value.project || '');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function discover() {
    setBusy(true);
    setError('');
    try {
      const { services } = await api.get(`/firebase/discover${qs({ project })}`);
      setFound(services);
      if (services.length === 1) onChange({ project, service: services[0].service, location: services[0].location });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="stack" style={{ gap: '8px' }}>
      <div class="row" style={{ alignItems: 'flex-end' }}>
        <label class="field">Firebase project ID
          <input value={project} placeholder="my-app-12345" onInput={(e) => setProject(e.currentTarget.value.trim())} />
        </label>
        <button class="btn" type="button" disabled={!project || busy} onClick={discover}>{busy ? 'Looking…' : 'Find backends'}</button>
      </div>
      {found && !found.length && <small class="muted">No App Hosting traffic in that project in the last 3 days.</small>}
      {found?.map((s) => (
        <label class="check" key={s.service}>
          <input type="radio" name="fb-backend" checked={value.service === s.service} onChange={() => onChange({ project, service: s.service, location: s.location })} />
          <span class="mono">{s.service}</span> <span class="muted small">{s.hosts?.[0] || ''} · {s.requests} requests</span>
        </label>
      ))}
      {value.service && <small>Linked backend: <span class="mono">{value.project} / {value.service}</span></small>}
      {value.service && !siteId && <small class="muted">Pick the GA4 site below too: request logs are stored per site.</small>}
      {error && <small class="muted">{error}</small>}
    </div>
  );
}

export function Repos({ repos, selected, onChange }) {
  const [filter, setFilter] = useState('');
  if (!repos.length) return <small class="muted">Add a GitHub token in <a href="#/settings?i=github">Integrations → GitHub</a> to pick repos.</small>;
  const q = filter.trim().toLowerCase();
  const shown = repos.filter((r) => selected.includes(r) || (q && r.toLowerCase().includes(q)));
  return (
    <>
      <input type="search" placeholder={`Search ${repos.length} synced repos`} value={filter} onInput={(e) => setFilter(e.currentTarget.value)} aria-label="Search repos" style={{ maxWidth: '360px' }} />
      {shown.slice(0, 20).map((r) => (
        <label class="check mono small" key={r}>
          <input type="checkbox" checked={selected.includes(r)} onChange={(e) => onChange(e.currentTarget.checked ? [...selected, r] : selected.filter((v) => v !== r))} /> {r}
        </label>
      ))}
    </>
  );
}

function Keywords({ keywords, onChange }) {
  const [input, setInput] = useState('');
  function add(e) {
    e.preventDefault();
    const k = input.trim().toLowerCase();
    if (k.length >= 4 && !keywords.includes(k)) onChange([...keywords, k]);
    setInput('');
  }
  return (
    <div class="row">
      {keywords.map((k) => (
        <span class="chip" key={k}>{k}
          <button type="button" class="chip-x" aria-label={`Remove ${k}`} onClick={() => onChange(keywords.filter((x) => x !== k))}><Icon name="x" size={10} /></button>
        </span>
      ))}
      <input value={input} placeholder="cool desk, cooldesk app" aria-label="Add a keyword" style={{ maxWidth: '220px' }}
        onInput={(e) => setInput(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && add(e)} />
      <button class="btn" type="button" onClick={add} disabled={input.trim().length < 4}><Icon name="plus" size={13} /> Add</button>
    </div>
  );
}
