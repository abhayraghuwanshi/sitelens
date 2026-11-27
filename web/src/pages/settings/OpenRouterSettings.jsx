import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section, Steps, Gets, Facts, SecretField } from './ConnectionKit.jsx';

// OpenRouter: one key for the answer checks in ChatGPT, Gemini, Perplexity and
// Grok, each with its provider's own web search. Claude keeps its own page.
export function OpenRouterSettings() {
  const status = useAsync(() => api.get('/ai-search/status'), []);
  const [models, setModels] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const s = status.data || {};
  const engines = (s.engines || []).filter((e) => e.via === 'openrouter');

  async function save(body, done) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/ai-search/settings', body);
      if (done) setMsg({ ok: true, text: done });
      status.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'The same questions asked in ChatGPT, Gemini, Perplexity and Grok',
          'Each one answers with its own web search, as your customers see it',
          'Whether each assistant names you and cites your pages, side by side',
        ]} />
      </Section>

      {!s.openrouter && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Create a key', body: 'One OpenRouter key reaches all four assistants.', href: 'https://openrouter.ai/keys', cta: 'OpenRouter keys' },
            { title: 'Add a few dollars of credit', body: 'Checks are paid per question.', href: 'https://openrouter.ai/credits', cta: 'Credits' },
            { title: 'Paste the key below' },
          ]} />
        </Section>
      )}

      <Section title="API key">
        <SecretField label="OpenRouter API key" placeholder="sk-or-…" source={s.openrouter || ''} envName="OPENROUTER_API_KEY"
          onSave={async (openrouterKey) => { await save({ openrouterKey }); return 'Saved.'; }}
          onRemove={async () => { await save({ openrouterKey: '' }); return 'Removed the saved key.'; }} />
      </Section>

      {engines.length > 0 && (
        <Section title="Assistants" sub="Each uses the newest model OpenRouter lists for it, unless you pin one.">
          <div class="cx-list">
            {engines.map((e) => (
              <div key={e.key} class="cx-list-row">
                <label class="cx-toggle m-0">
                  <input type="checkbox" checked={e.on} disabled={busy} onChange={(ev) => save({ engines: { [e.key]: ev.currentTarget.checked } }, `${e.label} ${ev.currentTarget.checked ? 'on' : 'off'}.`).catch(() => {})} />
                  <span><b>{e.label}</b><span class="small muted">{e.custom ? 'Pinned model' : e.model ? 'Newest model' : 'Add a key to see its model'}</span></span>
                </label>
                <form class="row gap-6" onSubmit={(ev) => { ev.preventDefault(); save({ models: { [e.key]: models[e.key] ?? '' } }, models[e.key] ? `${e.label} uses ${models[e.key]}.` : `${e.label} uses the newest model.`).catch(() => {}); }}>
                  <input type="text" class="mono" style={{ width: '260px' }} placeholder={e.model || 'model id'} value={models[e.key] ?? (e.custom ? e.model : '')}
                    onInput={(ev) => setModels({ ...models, [e.key]: ev.currentTarget.value })} aria-label={`${e.label} model`} />
                  <button class="btn ghost" type="submit" disabled={busy}>Pin</button>
                </form>
              </div>
            ))}
          </div>
          {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
        </Section>
      )}

      <Section title="Good to know">
        <Facts items={[
          { label: 'Cost', value: 'About $0.01–0.05 per question per assistant (tokens, plus about $0.005–0.015 per web search)' },
          { label: 'Runs', value: 'When you press Run, or weekly if it’s on in Claude’s page' },
        ]} />
      </Section>
    </>
  );
}
