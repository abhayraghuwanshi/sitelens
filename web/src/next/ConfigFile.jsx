import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { FileHome, FileLink, SourceLink } from '../pages/Setup.jsx';

// A site's .sitelens.yml, whole: where it lives, what's in it, and the file itself to read
// and edit. Replaces the old "What Kauzl measures" sections (goals, funnels, search, alerts
// each with their own Edit / Move to repo). Saving keeps the file in Kauzl, where it applies
// at once (the same as Claude's save_site_config); the repo isn't changed.
const PARTS = { goals: 'goals', funnels: 'funnels', search: 'search topics', alerts: 'alert thresholds', questions: 'AI answer questions', content: 'content rules' };

export function ConfigFile({ site }) {
  const file = useAsync(() => api.get(`/sites/${site.id}/config?check=1`), [site.id]);
  const [text, setText] = useState(null); // what's in the editor
  const [check, setCheck] = useState(null); // the last check of `text`
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [where, setWhere] = useState(false);
  useEffect(() => { if (file.data && text === null) setText(file.data.found ? file.data.text || '' : ''); }, [file.data]);

  if (file.error) return <ErrorState error={file.error} onRetry={file.reload} />;
  if (!file.data || text === null) return <Loading height={280} />;
  const f = file.data;
  const local = f.source?.type === 'local';
  const changed = text !== (f.found ? f.text || '' : '');
  const inFile = Object.keys(PARTS).filter((k) => f.config?.[k] !== undefined);
  const problems = check ? check.errors || [] : f.errors || [];
  const notes = check ? check.warnings || [] : f.warnings || [];

  async function run(kind) {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === 'draft') {
        const d = await api.get(`/sites/${site.id}/config/draft`);
        setText(d.yaml || '');
        setCheck(null);
        setMsg({ ok: true, text: 'A start from what Kauzl uses today. Check it, then save.' });
      } else if (kind === 'check') {
        const out = await api.post(`/sites/${site.id}/config/check`, { yaml: text });
        setCheck(out);
        setMsg(out.errors?.length ? null : { ok: true, text: 'Looks good.' });
      } else if (kind === 'save') {
        const out = await api.post(`/sites/${site.id}/config/check`, { yaml: text });
        setCheck(out);
        if (out.errors?.length) return;
        await api.post(`/sites/${site.id}/config/local`, { yaml: text });
        setMsg({ ok: true, text: 'Saved. It applies now.' });
        setText(null);
        setCheck(null);
        file.reload();
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <section class="card cf">
      <header class="cf-head">
        <span class="cf-ic"><Icon name="code" size={16} /></span>
        <div class="cf-id">
          <h2>.sitelens.yml</h2>
          <small>
            {site.demo ? 'The demo site’s built-in file. It can’t be changed.'
              : local ? 'Kept in Kauzl. Changes apply as soon as you save.'
              : f.found ? <>Read from <SourceLink source={f.source} />. Saving here keeps a copy in Kauzl, which wins from then on.</>
              : 'Not created yet. Kauzl uses its own settings and guesses until it is.'}
          </small>
          {inFile.length > 0 && <span class="cf-parts">{inFile.map((k) => <span key={k} class="cf-part">{PARTS[k]}</span>)}</span>}
        </div>
        {!site.demo && <button type="button" class="btn ghost" aria-expanded={where} onClick={() => setWhere(!where)}>Where it lives</button>}
      </header>

      {where && !site.demo && (
        <div class="cf-where">
          <FileHome site={site} file={f} onSaved={() => { setText(null); file.reload(); }} />
          {!local && <FileLink site={site} file={f} onSaved={() => { setText(null); file.reload(); }} />}
        </div>
      )}

      {!f.found && !text && !site.demo ? (
        <div class="cf-empty">
          <p class="m-0">Goals, funnels, search topics and alerts can live in one file, so they’re easy to read, copy and hand to Claude.</p>
          <button type="button" class="btn primary" disabled={Boolean(busy)} onClick={() => run('draft')}>{busy === 'draft' ? 'Writing…' : 'Start from my current settings'}</button>
        </div>
      ) : (
        <>
          <textarea class="cf-text" spellcheck={false} readOnly={site.demo} value={text} rows={Math.min(32, Math.max(10, text.split('\n').length + 1))}
            onInput={(e) => { setText(e.currentTarget.value); setCheck(null); setMsg(null); }} aria-label=".sitelens.yml" />
          {problems.length > 0 && <ul class="cf-msgs bad">{problems.map((m) => <li key={m}>{m}</li>)}</ul>}
          {notes.length > 0 && <ul class="cf-msgs">{notes.map((m) => <li key={m}>{m}</li>)}</ul>}
          {!site.demo && (
            <div class="cf-foot">
              <button type="button" class="btn primary" disabled={!changed || Boolean(busy)} onClick={() => run('save')}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
              <button type="button" class="btn" disabled={Boolean(busy)} onClick={() => run('check')}>{busy === 'check' ? 'Checking…' : 'Check'}</button>
              {changed && <button type="button" class="btn ghost" disabled={Boolean(busy)} onClick={() => { setText(f.found ? f.text || '' : ''); setCheck(null); setMsg(null); }}>Undo changes</button>}
            </div>
          )}
        </>
      )}
      {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
    </section>
  );
}
