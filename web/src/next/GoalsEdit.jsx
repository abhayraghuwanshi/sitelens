import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { GoalsEditor } from '../pages/settings/Goals.jsx';
import { productFormState } from '../pages/settings/Products.jsx';

// Just a site's goals, on their own screen (Goals → Edit goals), instead of the whole
// site form. Goals live on the site's product, so saving writes that product back with
// only its goals changed, the same way the site form does.
export function GoalsEdit({ site, done }) {
  const setup = useAsync(() => api.get('/products/setup'), []);
  // A repo's .sitelens.yml overrides goals set here: point to it instead of an editor that wouldn't count.
  const config = useAsync(() => api.get(`/sites/${site.id}/config`).catch(() => null), [site.id]);
  const existing = setup.data?.products.find((p) => p.siteId === site.id) || null;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (setup.data && !form) setForm(productFormState(existing || { siteId: site.id }, setup.data));
  }, [setup.data]);

  if (setup.error) return <ErrorState error={setup.error} onRetry={setup.reload} />;
  if (!form || config.loading) return <Loading height={240} />;
  const fileGoals = config.data?.config?.goals;
  if (fileGoals?.length) return <FileGoalsEdit site={site} initial={fileGoals} file={config.data} form={form} done={done} />;

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/products/setup', {
        ...form,
        siteId: site.id,
        label: existing?.label || site.label,
        id: existing?.id,
        previousId: existing?.id,
        domains: form.domains.length ? form.domains : [{ name: String(site.host || '').replace(/^www\./, '') }],
      });
      done({ saved: true });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <form class="stack nx-goals-edit" onSubmit={save}>
      <section class="card card-plain">
        <GoalsEditor goals={form.goals} onChange={(goals) => setForm((f) => ({ ...f, goals }))} siteId={site.id}
          hasStore={form.extensionIds.length > 0} hasRepos={form.repos.length > 0} />
      </section>
      {error && <ErrorState error={error} />}
      <div class="row">
        <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save goals'}</button>
        <button class="btn ghost" type="button" onClick={done}>Cancel</button>
      </div>
    </form>
  );
}

// The goals in the site's .sitelens.yml, as the same form. Saving rewrites just the file's
// goals: part (each goal keeps its comment). By default it goes into Kauzl's own copy of the
// file, which applies right away; a file read from GitHub can instead get a pull request.
function FileGoalsEdit({ site, initial, file, form, done }) {
  const [goals, setGoals] = useState(initial);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState(null);
  const [pr, setPr] = useState(null);
  const inRepo = file.source?.type === 'repo';
  const where = inRepo ? `${file.source.repo}/${file.source.path}` : '';
  const yamlHref = `#/account?tab=sites&edit=${encodeURIComponent(site.id)}&part=config`;

  async function save(to) {
    setSaving(to);
    setError(null);
    try {
      const out = await api.post(`/sites/${site.id}/config/goals`, { goals, to });
      if (out.saved === 'pr') setPr(out);
      else done({ saved: true });
    } catch (err) {
      setError(err);
    } finally {
      setSaving('');
    }
  }

  if (pr) {
    return (
      <section class="card card-plain stack gap-10">
        <p class="m-0"><Icon name="target" size={14} /> Opened <a href={pr.url} target="_blank" rel="noreferrer">pull request #{pr.number}</a> on {pr.repo}. The new goals count once it’s merged.</p>
        <div class="row"><button class="btn primary" type="button" onClick={done}>Back to Goals</button></div>
      </section>
    );
  }
  return (
    <form class="stack nx-goals-edit" onSubmit={(e) => { e.preventDefault(); save('kauzl'); }}>
      <p class="note m-0">
        {inRepo
          ? <>These goals come from <code>{where}</code>. Saving keeps them in Kauzl and they count right away; Kauzl uses its own copy of the file from then on. To change the repo instead, open a pull request.</>
          : 'These goals are kept in Kauzl. Saving applies them right away.'}
        {' '}<a href={yamlHref}>Edit as YAML</a>
      </p>
      <section class="card card-plain">
        <GoalsEditor goals={goals} onChange={setGoals} siteId={site.id} fromFile
          hasStore={form.extensionIds.length > 0 || goals.some((g) => g.source === 'installs')}
          hasRepos={form.repos.length > 0 || goals.some((g) => g.source === 'downloads' || g.source === 'stars')} />
      </section>
      {error && <ErrorState error={error} />}
      <div class="row">
        <button class="btn primary" type="submit" disabled={Boolean(saving)}>{saving === 'kauzl' ? 'Saving…' : 'Save goals'}</button>
        {inRepo && <button class="btn" type="button" disabled={Boolean(saving)} onClick={() => save('repo')}>{saving === 'repo' ? 'Opening…' : 'Open pull request instead'}</button>}
        <button class="btn ghost" type="button" onClick={done}>Cancel</button>
      </div>
    </form>
  );
}
