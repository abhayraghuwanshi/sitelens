import { useEffect, useState } from 'preact/hooks';
import { api, qs } from '../../api.js';
import { useAsync, navigate } from '../../hooks.js';
import { Card, ErrorState, Loading } from '../../components/ui.jsx';
import { Icon } from '../../components/icons.jsx';
import { GoalsEditor } from './Goals.jsx';
import { BrandIcon } from '../../components/BrandIcon.jsx';

const HOST_BRAND = { firebase: 'firebase', vercel: 'vercel', 'github-pages': 'github' };

// Settings → Sites & products: a product is set up stage by stage, the same order as its
// journey: domains & hosting → analytics → code & releases → distribution → community → goals.
const bareHost = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

// Form state for a product (or a site's product), with defaults from its site.
export function productFormState(initial, setup) {
  const s = setup.options.sites.find((x) => x.id === initial.siteId);
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
}

// #/settings?…&focus=goals (from the Outcomes page) jumps to that section.
export function useFocusStage(focus, ready = true) {
  useEffect(() => {
    const el = ready && focus && document.getElementById(`stage-${focus}`);
    // Offset for the sticky page header.
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72 });
  }, [focus, ready]);
}

// Products without a website. A site's product is edited with the site (Settings → Sites & products).
export function ProductForm({ initial, setup, focus, onCancel, onSaved, onRemove }) {
  const { options } = setup;
  const [form, setForm] = useState(() => productFormState(initial, setup));
  useFocusStage(focus);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

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
      <Card title={initial.id ? `Set up ${initial.label}` : 'Add a product'} sub="For a product without its own website, like an extension or a CLI. Each section feeds one stage of its journey; skip what doesn’t apply.">
        <label class="field" style={{ maxWidth: '360px' }}>Product name
          <input required value={form.label} placeholder="Cooldesk" onInput={(e) => set({ label: e.currentTarget.value })} />
        </label>
        {!options.sites.length || (
          <small class="muted">Has a website? <a href="#/account?tab=sites&edit=new">Add it as a site instead</a>: the site and everything it runs on are set up together.</small>
        )}
      </Card>
      <ProductStages form={form} set={set} setup={setup} />

      {error && <ErrorState error={error} />}
      <div class="row">
        <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
        <button class="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        {onRemove && <button class="btn ghost danger" type="button" onClick={onRemove}>Remove {initial.label}</button>}
      </div>
    </form>
  );
}

// Everything a product runs on besides its GA4 site: domains, hosting, code,
// store listings, community and goals. `form.siteId` is the site it belongs to;
// `inSite` says the site editor holds them, so a site not saved yet still counts.
// only: one stage's key (domains, hosting, code, distribution, community, goals), for editing it on its own.
// `skip`: stages the caller draws itself (the site form puts Domains under the site's address).
// `hint`: the site's address, so repos and Vercel projects that match it are suggested.
export function ProductStages({ form, set, setup, inSite = false, only = '', skip = [], hint = '' }) {
  const { options } = setup;
  const show = (key) => (!only || only === key) && !skip.includes(key);
  return (
    <>
      {show('domains') && (
      <Stage icon="globe" title="Domains" sub="Expiry, DNS and SSL are checked from public records. No registrar login needed." done={form.domains.length > 0}>
        <Domains domains={form.domains} registrars={setup.registrars} hostingNames={Object.fromEntries(setup.hosting.map((h) => [h.key, h.label]))} onChange={(domains) => set({ domains })}
          onHostingGuess={(provider) => !form.hosting?.provider && set({ hosting: { provider } })} />
      </Stage>
      )}

      {show('hosting') && (
      <Stage icon="rocket" brand={HOST_BRAND[form.hosting?.provider]} title="Hosting & deploys" sub="Where the site runs. Firebase and Vercel send each deploy to the Timeline; other hosts are noted for context." done={hostingState(form.hosting)}>
        <Hosting hosting={form.hosting || {}} setup={setup} siteId={form.siteId || (inSite ? 'new' : '')} hint={hint} onChange={(hosting) => set({ hosting })} />
      </Stage>
      )}

      {show('code') && (
      <Stage icon="github" brand="github" title="Code & releases" sub="Releases from these repos mark the Timeline, and Articles and Funnels read their code. The Vercel project’s repo is added for you." done={form.repos.length > 0}>
        <Repos repos={options.repos} selected={form.repos} hint={hint || form.label} onChange={(repos) => set({ repos })} />
      </Stage>
      )}

      {show('distribution') && (
      <Stage icon="puzzle" title="Distribution" sub="Chrome Web Store listings: installs, users, rating and version changes." done={form.extensionIds.length > 0}>
        {options.extensions.length ? options.extensions.map((x) => (
          <label class="check" key={x.id}>
            <input type="checkbox" checked={form.extensionIds.includes(x.id)}
              onChange={(e) => set({ extensionIds: e.currentTarget.checked ? [...form.extensionIds, x.id] : form.extensionIds.filter((v) => v !== x.id) })} /> {x.label}
          </label>
        )) : <small class="muted">Track one on the <a href="#/extensions">Extensions</a> page first.</small>}
      </Stage>
      )}

      {/* Community (keywords for mentions) is hidden for now (2026-11-27); saved keywords are kept. */}
      {false && show('community') && (
      <Stage icon="chat" title="Community" sub="Posts and threads that bring traffic. The product name, domain and repos are searched automatically; add other names people use." done={form.keywords.length > 0}>
        <Keywords keywords={form.keywords} onChange={(keywords) => set({ keywords })} />
        <div class="row small">
          <Ready ok label="Hacker News" />
          <Ready ok={setup.community.reddit.ready} label="Reddit" href="#/settings?i=mentions" />
          <Ready ok={setup.community.ph.ready} label="Product Hunt" href="#/settings?i=mentions" />
        </div>
        <p class="note m-0">Tip: when you post a link yourself, add <span class="mono">?utm_source=reddit&amp;utm_campaign=&lt;post&gt;</span> so GA4 can tie visits to that exact post.</p>
      </Stage>
      )}

      {show('goals') && (
      <Stage id="goals" icon="target" title="Goals" sub="What counts as progress and what counts as a result: a purchase, a sign-up, an install, a download. Outcomes measures these." done={form.goals.length > 0}>
        <GoalsEditor goals={form.goals} onChange={(goals) => set({ goals })} siteId={form.siteId} hasStore={form.extensionIds.length > 0} hasRepos={form.repos.length > 0} />
      </Stage>
      )}
    </>
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

function Stage({ id, icon, brand = '', title, sub, done, children }) {
  return (
    <section class="card setup-stage" id={id ? `stage-${id}` : undefined}>
      <header class="card-head">
        {brand ? <BrandIcon name={brand} small /> : <Icon name={icon} size={15} />}
        <h2>{title}</h2>
        <span class={`status-dot ${done === 'warn' ? 'warn' : done ? 'good' : 'off'}`} title={done === 'warn' ? 'Needs one more step' : done ? 'Set' : 'Not set'} />
        <span class="spacer" />
      </header>
      <div class="card-body stack gap-10">
        <p class="note m-0">{sub}</p>
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
    <div class="stack gap-8">
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

// Words in a host or name that can match a repo: "cool-desk.com" → ["cooldesk"], "streamoverlay.kazekit.com" → ["streamoverlay"].
// Short words ("cool", "desk") would match too many unrelated repos, so only 5+ letters count.
function nameWords(text) {
  const base = String(text || '').toLowerCase().replace(/^www\./, '').split('.')[0];
  const parts = base.split(/[^a-z0-9]+/).filter((w) => w.length >= 5);
  const joined = base.replace(/[^a-z0-9]/g, '');
  return [...new Set([...parts, ...(joined.length >= 5 ? [joined] : [])])];
}

function Hosting({ hosting, setup, siteId, hint = '', onChange }) {
  const provider = hosting.provider || '';
  const chosen = setup.hosting.find((h) => h.key === provider);
  const host = String(hint || '').toLowerCase().replace(/^www\./, '');
  // The Vercel project that serves this address, if there is one.
  const vercelMatch = provider === 'vercel' && !hosting.vercel?.projectId && host
    ? setup.vercel.projects?.find((p) => p.domains?.some((d) => d.replace(/^www\./, '') === host)) : null;
  return (
    <div class="stack gap-10">
      <div class="provider-grid" role="radiogroup" aria-label="Hosting provider">
        {setup.hosting.map((h) => (
          <button key={h.key} type="button" role="radio" aria-checked={provider === h.key} class={`provider${provider === h.key ? ' on' : ''}`}
            onClick={() => onChange(provider === h.key ? {} : { provider: h.key, ...(h.key === 'firebase' ? { firebase: hosting.firebase } : {}), ...(h.key === 'vercel' ? { vercel: hosting.vercel } : {}) })}>
            {HOST_BRAND[h.key] ? <BrandIcon name={HOST_BRAND[h.key]} small /> : <span class="provider-letter" aria-hidden="true">{h.label[0]}</span>}
            <span class="provider-b"><b>{h.label}</b><small>{h.feed ? 'Deploys on Timeline' : 'Noted only'}</small></span>
          </button>
        ))}
      </div>

      {provider === 'firebase' && (
        <div class="host-panel">
          <p class="host-panel-h"><BrandIcon name="firebase" small /><b>Link the App Hosting backend</b></p>
          <FirebaseBackend value={hosting.firebase || {}} siteId={siteId} onChange={(firebase) => onChange({ ...hosting, firebase })} />
        </div>
      )}

      {provider === 'vercel' && (
        <div class="host-panel">
          <p class="host-panel-h"><BrandIcon name="vercel" small /><b>{setup.vercel.connected ? 'Pick the Vercel project' : 'Connect Vercel to read deploys'}</b></p>
          {setup.vercel.connected ? (
            <>
              {vercelMatch && (
                <button type="button" class="host-suggest" onClick={() => onChange({ ...hosting, vercel: { projectId: vercelMatch.id } })}>
                  <Icon name="sparkles" size={13} /><span><b>{vercelMatch.name}</b> serves {host}</span><span class="host-suggest-go">Use it</span>
                </button>
              )}
              <label class="field host-field">Project
                <select value={hosting.vercel?.projectId || ''} onChange={(e) => onChange({ ...hosting, vercel: e.currentTarget.value ? { projectId: e.currentTarget.value } : undefined })}>
                  <option value="">Choose a project…</option>
                  {setup.vercel.projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.domains[0] ? ` · ${p.domains[0]}` : ''}</option>)}
                </select>
                {setup.vercel.error && <small class="bad">{setup.vercel.error}</small>}
              </label>
              {!siteId && <small class="muted">Deploys are matched to a site: set this up from the site in <a href="#/account?tab=sites">Sites &amp; products</a>.</small>}
            </>
          ) : (
            <div class="host-connect">
              <span class="muted small">Kauzl reads production deploys and marks each one on the Timeline.</span>
              <a class="btn" href="#/account?i=vercel">Connect Vercel</a>
            </div>
          )}
        </div>
      )}

      {chosen && !chosen.feed && (
        <div class="host-panel">
          <label class="field host-field"><span class="field-label">Plan or note <small>optional</small></span>
            <input value={hosting.note || ''} placeholder={provider === 'hostinger' ? 'Business Web Hosting, renews Mar' : provider === 'fly' ? 'App name, e.g. my-app (one machine, sin)' : 'Anything worth remembering'} onInput={(e) => onChange({ ...hosting, note: e.currentTarget.value })} />
          </label>
          <small class="muted">{chosen.label} has no deploy feed Kauzl can read, so GitHub releases, Web Store versions and your own notes mark changes on the Timeline.</small>
        </div>
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
    <div class="stack gap-8">
      <div class="row" style={{ alignItems: 'flex-end' }}>
        <label class="field">Firebase project ID
          <input value={project} placeholder="my-app-12345" onInput={(e) => setProject(e.currentTarget.value.trim())} />
        </label>
        <button class="btn" type="button" disabled={!project || busy} onClick={discover}>{busy ? 'Looking…' : 'Find backends'}</button>
      </div>
      {found && !found.length && <small class="muted">No App Hosting traffic in that project in the last 3 days.</small>}
      {found?.length > 0 && (
        <div class="host-options" role="radiogroup" aria-label="App Hosting backend">
          {found.map((s) => (
            <button key={s.service} type="button" role="radio" aria-checked={value.service === s.service} class={`host-option${value.service === s.service ? ' on' : ''}`}
              onClick={() => onChange({ project, service: s.service, location: s.location })}>
              <b class="mono">{s.service}</b><small>{s.hosts?.[0] || s.location} · {s.requests} requests in 3 days</small>
            </button>
          ))}
        </div>
      )}
      {value.service && <p class="host-linked"><span class="nx-dot on" aria-hidden="true" />Linked to <span class="mono">{value.project} / {value.service}</span></p>}
      {value.service && !siteId && <small class="muted">Request logs are stored per site: set this up from the site in <a href="#/account?tab=sites">Sites &amp; products</a>.</small>}
      {error && <small class="muted">{error}</small>}
    </div>
  );
}

// Repos as chips: the linked ones, repos named like the site (one click), and search for the rest.
export function Repos({ repos, selected, onChange, hint = '' }) {
  const [filter, setFilter] = useState('');
  if (!repos.length) {
    return (
      <div class="host-connect">
        <span class="muted small">Connect GitHub to pick repos. Releases then show on the Timeline.</span>
        <a class="btn" href="#/account?i=github">Connect GitHub</a>
      </div>
    );
  }
  const add = (r) => onChange([...selected, r]);
  const drop = (r) => onChange(selected.filter((v) => v !== r));
  const words = nameWords(hint);
  const suggested = repos.filter((r) => !selected.includes(r) && words.some((w) => r.split('/')[1]?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(w))).slice(0, 4);
  const q = filter.trim().toLowerCase();
  const results = q ? repos.filter((r) => !selected.includes(r) && r.toLowerCase().includes(q)).slice(0, 8) : [];
  return (
    <div class="repo-pick">
      {selected.length > 0 && (
        <div class="repo-chips">
          {selected.map((r) => (
            <span key={r} class="repo-chip"><BrandIcon name="github" small /><span class="mono">{r}</span>
              <button type="button" class="chip-x" aria-label={`Unlink ${r}`} onClick={() => drop(r)}><Icon name="x" size={11} /></button>
            </span>
          ))}
        </div>
      )}
      {suggested.length > 0 && (
        <div class="repo-suggest">
          <span class="muted small">Looks like this site:</span>
          {suggested.map((r) => <button key={r} type="button" class="btn ghost" onClick={() => add(r)}><Icon name="plus" size={12} /> <span class="mono">{r}</span></button>)}
        </div>
      )}
      <div class="repo-search">
        <input type="search" placeholder={`Search ${repos.length} repos to link`} value={filter} onInput={(e) => setFilter(e.currentTarget.value)} aria-label="Search repos" />
        {results.length > 0 && (
          <ul class="repo-results">
            {results.map((r) => (
              <li key={r}><button type="button" onClick={() => { add(r); setFilter(''); }}><span class="mono">{r}</span><span class="repo-add">Link</span></button></li>
            ))}
          </ul>
        )}
        {q && !results.length && <small class="muted">No repo matches “{filter}”.</small>}
      </div>
    </div>
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
