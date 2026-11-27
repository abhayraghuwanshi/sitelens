import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Icon } from '../components/icons.jsx';

// Setup that stops a part of the story from being told (not an alert, so not in the Inbox).
export function SetupNote({ site }) {
  const ai = useAsync(() => api.get(`/ai-search/sites/${site.id}/checks`).catch(() => null), [site.id]);
  if (!ai.data || ai.data.lastRun || !ai.data.prompts?.length) return null;
  return (
    <a class="nx-callout" href={`#/site/${site.id}/search?tab=ai`}>
      <Icon name="triangle" size={14} />
      <span><b>AI answer checks have never run.</b> {ai.data.prompts.length} questions are set up{ai.data.keySource ? '' : ' but no Anthropic key is set'}, so Kauzl can’t say whether assistants name you.</span>
    </a>
  );
}
