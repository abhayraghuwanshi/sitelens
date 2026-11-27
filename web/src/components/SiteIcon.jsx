import { useState } from 'preact/hooks';

// A site's own icon (the server reads it from the site: server/site-icon.mjs),
// or its first letter on a tile when it has none or it can't be reached.
export function SiteIcon({ site, large = false }) {
  const [failed, setFailed] = useState(false);
  const letter = (site.label || site.host || '?').trim()[0]?.toUpperCase() || '?';
  const cls = `site-icon${large ? ' lg' : ''}`;
  if (site.demo || !site.host || failed) return <span class={`${cls} site-icon-letter`} aria-hidden="true">{letter}</span>;
  return <img class={cls} src={`/api/sites/${encodeURIComponent(site.id)}/icon`} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
