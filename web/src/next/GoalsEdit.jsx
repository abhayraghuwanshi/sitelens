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
  const fileGoals = config.data?.config?.goals?.length || 0;
  if (fileGoals) {
    return (
      <section class="card card-plain nx-goals-file">
        <p class="m-0"><Icon name="target" size={14} /> <b>{site.label}’s {fileGoals} goal{fileGoals === 1 ? '' : 's'} come from its <code>.sitelens.yml</code></b>, in the site’s repo. That file is what’s measured, so goals are changed there.</p>
        <div class="row">
          <a class="btn primary" href={`#/site/${site.id}/setup`}>Edit the file’s goals</a>
          <button class="btn ghost" type="button" onClick={done}>Back</button>
        </div>
        <p class="muted small m-0">Claude can change it for you too: ask it to update the site’s goals (the Kauzl MCP tools read and check the file).</p>
      </section>
    );
  }

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
      done();
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
