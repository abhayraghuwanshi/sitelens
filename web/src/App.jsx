import { useEffect, useState } from 'preact/hooks';
import { api } from './api.js';
import { useRoute, useAsync, usePersistent } from './hooks.js';
import { Loading, ErrorState } from './components/ui.jsx';
import { NextApp } from './next/NextApp.jsx';

// Studio has one layout: the story-first one in next/NextApp.jsx. This loads
// the workspace state, keeps the theme and the remembered range, and hands over.
export function App() {
  const route = useRoute();
  const state = useAsync(() => api.get('/state'), []);
  const [, setRange] = usePersistent('range', '28d');
  const [theme, setTheme] = usePersistent('theme', '');
  const systemDark = useSystemDark();

  // Opening a link with ?range= makes it the remembered range too (Health has its own ranges).
  const linkedRange = route.parts[0] !== 'health' ? route.params.get('range') : null;
  useEffect(() => {
    if (linkedRange) setRange(linkedRange);
  }, [linkedRange]);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  if (state.loading && !state.data) return <div style={{ padding: '32px' }}><Loading height={400} /></div>;
  if (state.error) return <div style={{ padding: '32px' }}><ErrorState error={state.error} onRetry={state.reload} /></div>;

  const dark = resolvedTheme(theme, systemDark) === 'dark';
  return <NextApp state={state.data} route={route} onTheme={() => setTheme(dark ? 'light' : 'dark')} onReload={() => state.reload()}
    themeIcon={dark ? 'sun' : 'moon'} />;
}

function resolvedTheme(theme, systemDark) {
  return theme || (systemDark ? 'dark' : 'light');
}

function useSystemDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const onChange = () => setDark(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return dark;
}
