// Small marks for the services Kauzl reads from, drawn here in each brand's
// colours so a list reads at a glance (Jobs page and its panel, Account → Connections). They're
// simplified stand-ins for the official logos, used only to name the service.
// Monochrome marks (GitHub, Vercel) and the generic ones use currentColor, so
// they follow the theme.

const GITHUB = 'M12 2.2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.6.4-1.1.7-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2.2z';

const MARKS = {
  // Google Analytics: three bars, the short one a dot.
  analytics: (
    <>
      <rect x="15" y="2" width="6" height="20" rx="3" fill="var(--brand-ga-yellow)" />
      <rect x="9" y="9" width="6" height="13" rx="3" fill="var(--brand-ga-orange)" />
      <circle cx="6" cy="19" r="3" fill="var(--brand-ga-orange)" />
    </>
  ),
  // Search Console: a magnifier in Google's colours.
  search: (
    <>
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="var(--brand-g-blue)" stroke-width="3" />
      <path d="M15 15l5.5 5.5" stroke="var(--brand-g-green)" stroke-width="3.2" stroke-linecap="round" />
      <circle cx="10" cy="10" r="2.2" fill="var(--brand-g-yellow)" />
    </>
  ),
  // Bing: the "b" ribbon.
  bing: <path d="M5.7 1.5l4.1 1.4v13.8l5-2.9-2.5-1.2-1.6-4 8.4 2.9v4.4l-9.3 5.4-4.1-2.3z" fill="var(--brand-bing)" />,
  github: <path d={GITHUB} fill="currentColor" />,
  // Chrome Web Store: the Chrome wheel.
  extensions: (
    <>
      <path d="M12 12L3.34 7A10 10 0 0 1 20.66 7z" fill="var(--brand-g-red)" />
      <path d="M12 12l8.66-5A10 10 0 0 1 12 22z" fill="var(--brand-g-yellow)" />
      <path d="M12 12v10A10 10 0 0 1 3.34 7z" fill="var(--brand-g-green)" />
      <circle cx="12" cy="12" r="5" fill="var(--brand-white)" />
      <circle cx="12" cy="12" r="3.8" fill="var(--brand-g-blue)" />
    </>
  ),
  // Firebase: the flame.
  firebase: (
    <>
      <path d="M4.5 18.5L7 3c.1-.6.9-.7 1.2-.2l2.6 4.9z" fill="var(--brand-fb-amber)" />
      <path d="M13.2 10.2l-2.4-4.6c-.2-.4-.8-.4-1 0L4.5 18.5z" fill="var(--brand-fb-orange)" />
      <path d="M4.5 18.5l14-14c.4-.4 1-.1 1 .4l1.1 13.6-7.4 4.1c-.5.3-1 .3-1.5 0z" fill="var(--brand-fb-yellow)" />
    </>
  ),
  vercel: <path d="M12 3.5l9.5 16.5h-19z" fill="currentColor" />,
  // BigQuery: a magnifier in a blue hexagon.
  bigquery: (
    <>
      <path d="M6.2 2.5h11.6L23.5 12l-5.7 9.5H6.2L.5 12z" fill="var(--brand-g-blue)" />
      <circle cx="11" cy="11" r="4" fill="none" stroke="var(--brand-white)" stroke-width="1.8" />
      <path d="M14 14l3.2 3.2" stroke="var(--brand-white)" stroke-width="2" stroke-linecap="round" />
    </>
  ),
  // Google: the four-colour G.
  google: (
    <>
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="var(--brand-g-blue)" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="var(--brand-g-green)" />
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="var(--brand-g-yellow)" />
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" fill="var(--brand-g-red)" />
    </>
  ),
  // Edge: a blue disc with the green wave.
  edge: (
    <>
      <circle cx="12" cy="12" r="10" fill="var(--brand-edge-blue)" />
      <path d="M5.5 13.5c0-4 3-6.6 6.8-6.6 3.5 0 6.2 2.2 6.2 5 0 1.7-1.3 2.7-3.1 2.7H9.6c.3 2.4 2.5 3.9 5.1 3.9 1.5 0 2.9-.4 4-1.1A9 9 0 0 1 5.5 13.5z" fill="var(--brand-edge-green)" />
    </>
  ),
  // Firefox: the orange fox round a purple globe.
  firefox: (
    <>
      <circle cx="12" cy="12" r="10" fill="var(--brand-ff-orange)" />
      <circle cx="13" cy="12.5" r="5.6" fill="var(--brand-ff-purple)" />
      <path d="M2.5 9.5C4 5 7.5 2.5 11.5 2.3 9 3.6 8 5.5 8.3 7.6 6 7.8 4 8.6 2.5 9.5z" fill="var(--brand-ff-yellow)" />
    </>
  ),
  // Fly.io: a hot-air balloon.
  fly: (
    <>
      <path d="M12 2.5c-4 0-7 3-7 7 0 3.2 2.3 6 4.6 7.6h4.8C16.7 15.5 19 12.7 19 9.5c0-4-3-7-7-7z" fill="var(--brand-fly)" />
      <path d="M12 2.5c-1.5 1.8-2.2 4.3-2.2 7 0 2.8.8 5.5 1.9 7.6h.6c1.1-2.1 1.9-4.8 1.9-7.6 0-2.7-.7-5.2-2.2-7z" fill="var(--brand-fly-light)" />
      <rect x="9.6" y="18.6" width="4.8" height="3" rx="1" fill="var(--brand-fly)" />
    </>
  ),
  // Databases.
  postgres: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--brand-pg)" />
      <text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" font-family="system-ui, sans-serif" fill="var(--brand-white)">Pg</text>
    </>
  ),
  supabase: <path d="M13.6 2.2 4 14.3h7.6l-1.2 7.5 9.6-12.1h-7.6z" fill="var(--brand-supabase)" />,
  neon: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--brand-neon)" />
      <path d="M7.5 17V7l9 8.2V7" fill="none" stroke="var(--brand-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </>
  ),
  mysql: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--brand-mysql)" />
      <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" font-family="system-ui, sans-serif" fill="var(--brand-white)">My</text>
    </>
  ),
  planetscale: (
    <g fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 18.4 18.4 5.6" stroke-linecap="round" />
    </g>
  ),
  turso: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--brand-turso)" />
      <path d="M7 8h10M12 8v9" fill="none" stroke="var(--brand-ink)" stroke-width="2.4" stroke-linecap="round" />
    </>
  ),
  d1: <path d="M17.6 18H6.2a3.7 3.7 0 0 1-.6-7.4 5.8 5.8 0 0 1 11.2-1.5A4.5 4.5 0 0 1 17.6 18z" fill="var(--brand-cloudflare)" />,
  sqlite: (
    <g fill="none" stroke="var(--brand-sqlite)" stroke-width="2">
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </g>
  ),
  // AI answer checks.
  claude: <path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3 5.3 18.7" fill="none" stroke="var(--brand-claude)" stroke-width="2.6" stroke-linecap="round" />,
  openrouter: <path d="M3 12h4.5c2.5 0 3.5-5.5 7-5.5H21M7.5 12c2.5 0 3.5 5.5 7 5.5H21M17.5 3.5 21 6.5l-3.5 3M17.5 14.5l3.5 3-3.5 3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />,
  // Mentions.
  hn: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="3" fill="var(--brand-hn)" />
      <path d="M8 7l4 5.5L16 7M12 12.5V17.5" fill="none" stroke="var(--brand-white)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </>
  ),
  reddit: (
    <>
      <circle cx="12" cy="12" r="10" fill="var(--brand-reddit)" />
      <ellipse cx="12" cy="13.5" rx="6" ry="4.2" fill="var(--brand-white)" />
      <circle cx="9.6" cy="13" r="1.1" fill="var(--brand-reddit)" />
      <circle cx="14.4" cy="13" r="1.1" fill="var(--brand-reddit)" />
      <circle cx="16" cy="6.5" r="1.4" fill="var(--brand-white)" />
      <path d="M12 9.3 13 5.6l3 .9" fill="none" stroke="var(--brand-white)" stroke-width="1.1" />
    </>
  ),
  producthunt: (
    <>
      <circle cx="12" cy="12" r="10" fill="var(--brand-ph)" />
      <path d="M9.5 17V7.5h3.4a2.6 2.6 0 0 1 0 5.2H9.5" fill="none" stroke="var(--brand-white)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </>
  ),
  // Monitoring.
  pagespeed: (
    <>
      <path d="M3.5 17a8.5 8.5 0 1 1 17 0" fill="none" stroke="var(--brand-g-blue)" stroke-width="2.6" stroke-linecap="round" />
      <path d="M12 17l4-6" stroke="var(--brand-g-red)" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="12" cy="17" r="1.8" fill="var(--brand-g-red)" />
    </>
  ),
  slack: (
    <>
      <rect x="9.5" y="2" width="3.6" height="9" rx="1.8" fill="var(--brand-slack-blue)" />
      <rect x="13" y="9.5" width="9" height="3.6" rx="1.8" fill="var(--brand-slack-green)" />
      <rect x="10.9" y="13" width="3.6" height="9" rx="1.8" fill="var(--brand-slack-yellow)" />
      <rect x="2" y="10.9" width="9" height="3.6" rx="1.8" fill="var(--brand-slack-red)" />
    </>
  ),
  // Your own jobs: a JSON endpoint, a SQL query.
  api: <path d="M8 4c-2 0-2.5 1-2.5 2.5v3C5.5 11 4.5 12 3 12c1.5 0 2.5 1 2.5 2.5v3C5.5 19 6 20 8 20M16 4c2 0 2.5 1 2.5 2.5v3c0 1.5 1 2.5 2.5 2.5-1.5 0-2.5 1-2.5 2.5v3c0 1.5-.5 2.5-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />,
  sql: (
    <g fill="none" stroke="currentColor" stroke-width="1.8">
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </g>
  ),
};

const NAMES = {
  analytics: 'Google Analytics', search: 'Google Search Console', bing: 'Bing', github: 'GitHub', extensions: 'Chrome Web Store', firebase: 'Firebase', vercel: 'Vercel', bigquery: 'BigQuery', api: 'JSON API', sql: 'SQL',
  fly: 'Fly.io', google: 'Google', edge: 'Edge Add-ons', firefox: 'Firefox Add-ons', postgres: 'PostgreSQL', supabase: 'Supabase', neon: 'Neon', mysql: 'MySQL', planetscale: 'PlanetScale', turso: 'Turso', d1: 'Cloudflare D1', sqlite: 'SQLite',
  claude: 'Claude', openrouter: 'OpenRouter', hn: 'Hacker News', reddit: 'Reddit', producthunt: 'Product Hunt', pagespeed: 'PageSpeed', slack: 'Slack',
};

export const hasBrand = (name) => Boolean(MARKS[name]);

/** A brand mark in a small tile (`large` for a panel header). `name` is a job source: analytics, search, bing, github, extensions, firebase, vercel, api or sql. */
export function BrandIcon({ name, large = false, small = false, title }) {
  const mark = MARKS[name];
  if (!mark) return null;
  return (
    <span class={`brand-tile${large ? ' lg' : small ? ' sm' : ''}`} role="img" aria-label={title || NAMES[name]} title={title || NAMES[name]}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{mark}</svg>
    </span>
  );
}
