import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Section, Steps, Gets, Facts, SecretField } from './ConnectionKit.jsx';

// Claude: answer checks with live web search, in each site's AI search view.
export function AnthropicSettings() {
  const status = useAsync(() => api.get('/ai-search/status'), []);
  const [msg, setMsg] = useState(null);
  const s = status.data || {};

  async function save(body) {
    await api.post('/ai-search/settings', body);
    status.reload();
  }

  async function weekly(on) {
    setMsg(null);
    try {
      await save({ weekly: on });
      setMsg({ ok: true, text: on ? 'Weekly checks on.' : 'Weekly checks off.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  return (
    <>
      <Section title="What you get">
        <Gets items={[
          'Claude answers the questions your customers ask, using live web search',
          'Whether each answer names you, and which pages it cites',
          'A history per question, so you see when you start (or stop) showing up',
        ]} />
      </Section>

      {!s.source && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Create an API key', body: 'In the Claude Console, under API keys.', href: 'https://console.anthropic.com/settings/keys', cta: 'Claude Console' },
            { title: 'Paste it below', body: 'Kauzl checks it and keeps it on this machine.' },
            { title: 'Add questions to a site', body: 'In the site’s AI search view, then press Run.' },
          ]} />
        </Section>
      )}

      <Section title="API key">
        <SecretField label="Anthropic API key" placeholder="sk-ant-…" source={s.source || ''} envName="ANTHROPIC_API_KEY"
          onSave={async (key) => { await save({ key }); return 'Saved.'; }}
          onRemove={async () => { await save({ key: '' }); return 'Removed the saved key.'; }} />
      </Section>

      {s.source && (
        <Section title="Checks">
          <label class="cx-toggle">
            <input type="checkbox" checked={Boolean(s.weekly)} onChange={(e) => weekly(e.currentTarget.checked)} />
            <span><b>Run weekly</b><span class="small muted">Re-run every site’s saved questions once a week.</span></span>
          </label>
          {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
        </Section>
      )}

      <Section title="Good to know">
        <Facts items={[
          { label: 'Model', value: s.model && <code>{s.model}</code> },
          { label: 'Cost', value: 'About $0.05–0.20 per question per run (tokens, plus $10 per 1,000 web searches)' },
          { label: 'Runs', value: s.weekly ? 'When you press Run, and weekly' : 'Only when you press Run' },
        ]} />
      </Section>
    </>
  );
}
