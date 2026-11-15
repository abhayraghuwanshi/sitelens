// The hosted server's own small pages: sign-in, the early-access waitlist and
// the admin page. Plain HTML forms, no script (the public CSP allows none inline).
// Same look as the home page in dark: charcoal, the owl, amber only for actions.
import { owl, FAVICON, FONTS } from './home.mjs';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

const CSS = `
  :root { color-scheme: dark; --ink: #0E0F12; --ink-2: #17181D; --ink-3: #1F2026; --line: #2A2C33; --text: #F4F4F5; --muted: #A1A1AA; --soft: #D4D4D8; --amber: #F5A524; --err: #FF8A80; --good: #5FD08A; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; background: var(--ink); color: var(--text); font: 15px/1.55 Inter, system-ui, sans-serif; }
  body::before { content: ""; position: fixed; inset: 0; background-image: radial-gradient(rgb(255 255 255 / .07) 1px, transparent 1.2px); background-size: 22px 22px; pointer-events: none; }
  a { color: var(--text); }
  a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
  header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 1120px; width: 100%; margin: 0 auto; padding: 0 24px; height: 64px; }
  .brand { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; font: 800 24px/1 "Bricolage Grotesque", Inter, sans-serif; letter-spacing: -0.045em; }
  header nav { display: flex; gap: 22px; }
  header nav a { color: var(--soft); text-decoration: none; font-size: 14px; } header nav a:hover { color: #fff; }
  .stage { position: relative; flex: 1; display: grid; place-items: center; padding: 72px 16px 48px; }
  main.card { position: relative; background: var(--ink-2); border: 1px solid var(--line); border-radius: 22px; padding: 60px 32px 32px; max-width: 400px; width: 100%; box-shadow: 0 30px 70px rgb(0 0 0 / .45); }
  main.card > svg.owl { position: absolute; top: -44px; left: 50%; transform: translateX(-50%); filter: drop-shadow(0 10px 18px rgb(0 0 0 / .4)); }
  svg.owl .eyes { transform-box: fill-box; transform-origin: center; animation: blink 7s infinite; }
  @keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(.08); } 97% { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) { svg.owl .eyes { animation: none; } }
  h1 { font: 800 28px/1.1 "Bricolage Grotesque", Inter, sans-serif; letter-spacing: -0.035em; margin: 0 0 8px; }
  main.card h1, main.card .lead { text-align: center; }
  .lead { color: var(--soft); margin: 0 0 24px; }
  .google { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; background: #fff; color: #1F1F1F; text-decoration: none; padding: 10px 16px; border-radius: 12px; font-weight: 600; transition: filter .15s; }
  .google:hover { filter: brightness(.94); }
  .err, .ok { border-radius: 10px; padding: 9px 12px; margin: 0 0 16px; text-align: center; }
  .err { color: var(--err); background: rgb(255 138 128 / .1); }
  .ok { color: var(--good); background: rgb(95 208 138 / .1); }
  .or { display: flex; align-items: center; gap: 12px; margin: 24px 0 14px; color: var(--muted); font-size: 13px; }
  .or::before, .or::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  .join { display: flex; gap: 8px; }
  .join input[type=email] { flex: 1; min-width: 0; min-height: 44px; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--line); background: var(--ink); color: var(--text); font: inherit; }
  .join input[type=email]::placeholder { color: var(--muted); }
  .join input[type=email]:focus { outline: none; border-color: var(--amber); }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 16px; border-radius: 11px; border: 0; background: var(--amber); color: #121522; font: 600 14px Inter, system-ui, sans-serif; cursor: pointer; white-space: nowrap; text-decoration: none; }
  .btn:hover { filter: brightness(1.06); }
  .btn.quiet { background: transparent; border: 1px solid var(--line); color: var(--soft); min-height: 32px; padding: 5px 11px; font-size: 13px; }
  .btn.quiet:hover { border-color: var(--soft); color: #fff; filter: none; }
  .note { margin: 8px 0 0; font-size: 13px; color: var(--muted); }
  .links { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
  .opt { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; color: inherit; text-decoration: none; transition: border-color .15s, background .15s; }
  .opt:hover { border-color: var(--amber); background: var(--ink-3); }
  .opt span { flex: 1; display: flex; flex-direction: column; }
  .opt b { font-weight: 600; font-size: 14px; } .opt small { color: var(--muted); font-size: 13px; }
  .opt svg { color: var(--muted); flex: none; } .opt:hover svg { color: var(--amber); }
`;

// ga: the Google tag ID, when kauzl.com's analytics are on (scripts come from /tools/assets).
// event: something that just happened, sent once by site.js: { name, detail, then }.
// `then` is where to go next, after the event is sent (or 1.5 s, whichever is first).
function shell({ title, nav = '', body, extraCss = '', ga = '', event = null, head = '' }) {
  const attrs = event ? ` data-event="${escapeHtml(event.name)}"${event.detail ? ` data-event-detail="${escapeHtml(event.detail)}"` : ''}${event.then ? ` data-then="${escapeHtml(event.then)}"` : ''}` : '';
  const scripts = ga ? `<script type="module" src="/tools/assets/site.js"></script>\n<script defer src="/tools/assets/ga.js" data-ga="${escapeHtml(ga)}"></script>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title><link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}${extraCss}</style>${head}</head>
<body data-page="page:"${attrs}>
<header>
  <a class="brand" href="/home" aria-label="Kauzl home">${owl(28, { variant: 'paper' })}kauzl</a>
  <nav aria-label="Site">${nav}</nav>
</header>
${body}
${scripts}
</body></html>`;
}

// The early-access form. `from` says which page it was on (kept with the email).
export function joinForm(from, { email = '' } = {}) {
  return `<form class="join" method="post" action="/waitlist">
    <input type="hidden" name="from" value="${escapeHtml(from)}">
    <label class="hp" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
    <input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@company.com" aria-label="Your email" value="${escapeHtml(email)}">
    <button class="btn" type="submit">Get early access</button>
  </form>`;
}

export function loginPage(error, { tools = false, ga = '', joined = false } = {}) {
  return shell({
    title: 'Sign in · Kauzl',
    ga,
    event: joined ? { name: 'waitlist_join', detail: 'sign-in' } : null,
    nav: `${tools ? '<a href="/tools/">Free tools</a>' : ''}<a href="/home">← Back to home</a>`,
    body: `<div class="stage"><main class="card">
  ${owl(80, { variant: 'paper' })}
  <h1>Sign in to Kauzl</h1>
  <p class="lead">Kauzl is in early access. Use the Google account you were invited with.</p>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
  <a class="google" href="/login/google">${G}Sign in with Google</a>
  <p class="or">Not invited yet?</p>
  ${joinForm('login')}
  <p class="note">We’ll email you when your spot opens. Nothing else.</p>
  <div class="links">
    <a class="opt" href="/login/google?viewer=1"><span><b>Someone shared a site with you</b><small>Sign in to view it, read-only</small></span>${ARROW}</a>
    <a class="opt" href="/demo"><span><b>Look around the demo</b><small>No sign-in needed</small></span>${ARROW}</a>
  </div>
</main></div>`,
  });
}

// /waitlist: the form on its own, the thank-you, or what went wrong.
const JOIN_SOURCES = new Set(['home', 'login', 'waitlist']);
export function waitlistPage({ joined = '', error = '', tools = false, ga = '' } = {}) {
  const inner = joined
    ? `<h1>You’re on the list</h1>
  <p class="lead">Thanks. We’ll email you when your spot opens, with a link to sign in.</p>
  <div class="links"><a class="opt" href="/demo"><span><b>Look around the demo meanwhile</b><small>No sign-in needed</small></span>${ARROW}</a>
  ${tools ? `<a class="opt" href="/tools/"><span><b>Try the free tools</b><small>They run in your browser</small></span>${ARROW}</a>` : ''}</div>`
    : `<h1>Get early access</h1>
  <p class="lead">Kauzl is in early access. Leave your email and we’ll invite you as spots open.</p>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
  ${joinForm('waitlist')}
  <p class="note">We’ll only use it to invite you.</p>`;
  return shell({
    title: joined ? 'You’re on the list · Kauzl' : 'Early access · Kauzl',
    ga,
    event: JOIN_SOURCES.has(joined) ? { name: 'waitlist_join', detail: joined } : null,
    nav: `${tools ? '<a href="/tools/">Free tools</a>' : ''}<a href="/home">← Back to home</a>`,
    body: `<div class="stage"><main class="card">${owl(80, { variant: 'paper' })}${inner}</main></div>`,
  });
}

// After Google sign-in: a moment on a public page so kauzl.com's analytics see
// the sign-in (the app itself loads no tag), then on into the app.
export function signedInPage({ event, ga }) {
  return shell({
    title: 'Signing you in · Kauzl',
    ga,
    event: { name: event, detail: 'google', then: '/' },
    head: '<meta http-equiv="refresh" content="3;url=/">',
    body: `<div class="stage"><main class="card">${owl(80, { variant: 'paper' })}<h1>${event === 'sign_up' ? 'Welcome to Kauzl' : 'Welcome back'}</h1>
  <p class="lead">Opening your Kauzl…</p><p class="note" style="text-align:center"><a href="/">Not moving? Open it here</a></p></main></div>`,
  });
}

/* ---------- Admin ---------- */

const ADMIN_CSS = `
  .admin { position: relative; max-width: 1120px; width: 100%; margin: 0 auto; padding: 24px 24px 64px; }
  .admin h1 { font-size: 32px; margin: 8px 0 4px; }
  .admin h2 { font: 800 20px/1.2 "Bricolage Grotesque", Inter, sans-serif; letter-spacing: -0.02em; margin: 0; }
  .admin .sub { color: var(--muted); margin: 0 0 24px; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
  .stat { background: var(--ink-2); border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; }
  .stat b { display: block; font: 800 30px/1.1 "Bricolage Grotesque", Inter, sans-serif; }
  .stat span { color: var(--muted); font-size: 13px; }
  .stat.live b { color: var(--good); }
  .panel { background: var(--ink-2); border: 1px solid var(--line); border-radius: 18px; padding: 20px; margin-bottom: 20px; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .panel-head p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-top: 1px solid var(--line); vertical-align: middle; }
  th { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); border-top: 0; }
  td.when { color: var(--soft); white-space: nowrap; }
  td.acts { text-align: right; white-space: nowrap; }
  td.acts form { display: inline; margin-left: 6px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--line); margin-right: 8px; vertical-align: 1px; }
  .dot.on { background: var(--good); box-shadow: 0 0 0 3px rgb(95 208 138 / .18); }
  .tag { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 99px; background: var(--ink-3); color: var(--soft); white-space: nowrap; }
  .empty { color: var(--muted); margin: 6px 0 0; font-size: 14px; }
  .invite-form { display: flex; gap: 8px; max-width: 460px; }
  .invite-form input { flex: 1; min-width: 0; min-height: 40px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--ink); color: var(--text); font: inherit; }
  .invite-form .btn { min-height: 40px; }
  .funnel { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 4px 0 20px; }
  .funnel .step { background: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .funnel b { display: block; font: 800 24px/1.1 "Bricolage Grotesque", Inter, sans-serif; }
  .funnel span { display: block; font-size: 13px; color: var(--soft); } .funnel small { color: var(--muted); font-size: 12px; }
  h3.mini { font-size: 13px; font-weight: 600; color: var(--muted); margin: 18px 0 10px; }
  .dau { display: grid; grid-template-columns: repeat(14, 1fr); gap: 6px; height: 110px; align-items: end; }
  .dau .d { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 4px; }
  .dau i { display: block; width: 100%; min-height: 2px; border-radius: 5px 5px 2px 2px; background: var(--amber); }
  .dau span { font-size: 11px; color: var(--muted); }
  table.ret td.cell { text-align: center; color: #121522; font-weight: 600; background: rgb(245 165 36 / var(--a)); border: 2px solid var(--ink-2); border-radius: 6px; }
  table.ret td.cell.none { background: transparent; }
  table.ret td.cell.lo { color: var(--text); }
  @media (max-width: 760px) { .stats, .funnel { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const LIVE_MS = 5 * 60_000;

function ago(ms, now) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

// A ready-to-send "you're in" email, opened in the admin's own mail app.
function inviteMail(email, origin) {
  const subject = 'You’re in: your Kauzl early access';
  const body = `Hi,\n\nYour Kauzl early access is ready. Sign in with this Google account (${email}) here:\n\n${origin}/login\n\nReply to this email if anything looks off. I read every one.\n`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Retention from the server's own record of active days (the activity table):
// people grouped by the week they first used Kauzl, and the share active in each week after.
const WEEK = 7 * 86_400_000;
const mondayOf = (dayStr) => {
  const d = new Date(`${dayStr}T00:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
};
export function retention(activity, now, weeks = 6) {
  const byUser = new Map();
  for (const { email, day: d } of activity) (byUser.get(email) || byUser.set(email, new Set()).get(email)).add(d);
  const cohorts = new Map();
  for (const [email, days] of byUser) {
    const first = mondayOf([...days].sort()[0]);
    (cohorts.get(first) || cohorts.set(first, []).get(first)).push(days);
  }
  const thisWeek = mondayOf(new Date(now).toISOString().slice(0, 10));
  return [...cohorts.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 8).map(([week, people]) => {
    const start = Date.parse(`${week}T00:00:00Z`);
    const reached = Math.min(weeks, Math.round((Date.parse(`${thisWeek}T00:00:00Z`) - start) / WEEK) + 1);
    const cells = Array.from({ length: reached }, (_, w) => {
      const lo = new Date(start + w * WEEK).toISOString().slice(0, 10);
      const hi = new Date(start + (w + 1) * WEEK).toISOString().slice(0, 10);
      const n = people.filter((days) => [...days].some((x) => x >= lo && x < hi)).length;
      return { n, rate: n / people.length };
    });
    return { week, size: people.length, cells };
  });
}

function activitySection({ activity, users, waitlist, invitedSet, now }) {
  const days = Array.from({ length: 14 }, (_, i) => new Date(now - (13 - i) * 86_400_000).toISOString().slice(0, 10));
  const perDay = days.map((d) => activity.filter((a) => a.day === d).length);
  const top = Math.max(1, ...perDay);
  const activeDays = new Map();
  for (const a of activity) activeDays.set(a.email, (activeDays.get(a.email) || 0) + 1);
  const signedInvited = users.filter((u) => invitedSet.has(u.email)).length;
  const cameBack = [...activeDays.entries()].filter(([e, n]) => invitedSet.has(e) && n >= 2).length;
  const joined = new Set([...waitlist.map((w) => w.email), ...invitedSet]).size;
  const steps = [['Asked for access or invited', joined], ['Invited', invitedSet.size], ['Signed in', signedInvited], ['Came back on another day', cameBack]];
  const cohorts = retention(activity, now);
  const cols = Math.max(1, ...cohorts.map((c) => c.cells.length));
  const pct = (x) => `${Math.round(x * 100)}%`;
  return `<section class="panel"><div class="panel-head"><div><h2>Activity and retention</h2><p>From Kauzl’s own sign-ins: a day counts when someone used the app that day.</p></div></div>
    <div class="funnel">${steps.map(([label, n], i) => `<div class="step"><b>${n}</b><span>${label}</span>${i ? `<small>${steps[i - 1][1] ? pct(n / steps[i - 1][1]) : '–'} of the step before</small>` : ''}</div>`).join('')}</div>
    <h3 class="mini">People active per day, last 14 days</h3>
    <div class="dau" role="img" aria-label="People active per day over the last 14 days">${perDay.map((n, i) => `<div class="d" title="${days[i]}: ${n}"><i style="height:${Math.round((n / top) * 100)}%"></i><span>${n}</span></div>`).join('')}</div>
    <h3 class="mini">Weekly retention: of the people who started in a week, how many were active in each week after</h3>
    ${cohorts.length ? `<div class="scroll"><table class="ret"><thead><tr><th>Started week of</th><th>People</th>${Array.from({ length: cols }, (_, w) => `<th>${w ? `Week ${w}` : 'First week'}</th>`).join('')}</tr></thead><tbody>
      ${cohorts.map((c) => `<tr><td>${c.week}</td><td>${c.size}</td>${Array.from({ length: cols }, (_, w) => {
        const cell = c.cells[w];
        return cell ? `<td class="cell${cell.rate < 0.45 ? ' lo' : ''}" style="--a:${(0.12 + cell.rate * 0.88).toFixed(2)}">${pct(cell.rate)}</td>` : '<td class="cell none"></td>';
      }).join('')}</tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No activity yet. It fills in as people use Kauzl.</p>'}
  </section>`;
}

const SOURCES = { home: 'Home page', login: 'Sign-in page', waitlist: 'Early access page', 'sign-in': 'Tried to sign in' };

export function adminPage({ users, waitlist, invites, activity = [], envInvited, now, origin, flash = '' }) {
  const live = users.filter((u) => u.lastSeen && now - u.lastSeen < LIVE_MS);
  const today = users.filter((u) => u.lastSeen && now - u.lastSeen < 86_400_000);
  const invitedSet = new Set([...envInvited, ...invites.map((i) => i.email)]);
  const waiting = waitlist.filter((w) => !invitedSet.has(w.email));
  const post = (action, email, label) => `<form method="post" action="${action}"><input type="hidden" name="email" value="${escapeHtml(email)}"><button class="btn quiet" type="submit">${label}</button></form>`;

  const userRows = users.map((u) => `<tr><td><span class="dot${u.lastSeen && now - u.lastSeen < LIVE_MS ? ' on' : ''}"></span>${escapeHtml(u.email)}</td>
    <td><span class="tag">${invitedSet.has(u.email) ? 'Invited' : 'Viewer'}</span></td><td class="when">${ago(u.lastSeen, now)}</td><td class="when">${day(u.createdAt)}</td></tr>`).join('');
  // Everyone who joined, newest first; people already invited stay listed, marked.
  const waitRows = waitlist.map((w) => `<tr><td>${escapeHtml(w.email)}</td><td>${escapeHtml(SOURCES[w.source] || w.source || '')}</td><td class="when">${ago(w.createdAt, now)}</td>
    <td class="acts">${invitedSet.has(w.email) ? '<span class="tag">Invited</span>' : post('/admin/invite', w.email, 'Invite')}${post('/admin/waitlist/remove', w.email, 'Remove')}</td></tr>`).join('');
  const inviteRows = [
    ...[...envInvited].sort().map((email) => ({ email, env: true })),
    ...invites.filter((i) => !envInvited.has(i.email)),
  ].map((i) => {
    const u = users.find((x) => x.email === i.email);
    return `<tr><td>${escapeHtml(i.email)}</td><td class="when">${u ? `signed in · ${ago(u.lastSeen, now)}` : 'not signed in yet'}</td>
    <td class="acts"><a class="btn quiet" href="${escapeHtml(inviteMail(i.email, origin))}">Email the link</a>${i.env ? '<span class="tag" title="Set in ALLOWED_EMAILS on the server">Server list</span>' : post('/admin/revoke', i.email, 'Revoke')}</td></tr>`;
  }).join('');

  return shell({
    title: 'Admin · Kauzl',
    nav: '<a href="/">Open Kauzl</a><a href="/home">Home page</a>',
    extraCss: ADMIN_CSS,
    body: `<div class="admin">
  <h1>Early access</h1>
  <p class="sub">Who’s using Kauzl, who’s waiting, and who’s invited. “Live” means active in the last 5 minutes.</p>
  ${flash ? `<p class="ok">${escapeHtml(flash)}</p>` : ''}
  <div class="stats">
    <div class="stat live"><b>${live.length}</b><span>Live now</span></div>
    <div class="stat"><b>${today.length}</b><span>Active in the last 24 h</span></div>
    <div class="stat"><b>${invitedSet.size}</b><span>Invited</span></div>
    <div class="stat"><b>${waiting.length}</b><span>On the waitlist</span></div>
  </div>

  ${activitySection({ activity, users, waitlist, invitedSet, now })}

  <section class="panel"><div class="panel-head"><div><h2>Waitlist</h2><p>Everyone who asked for access, newest first (${waitlist.length} in all, ${waiting.length} not invited yet). Invite someone and they can sign in with that Google account right away.</p></div>
    <a class="btn quiet" href="/admin/waitlist.csv">Download CSV</a></div>
    ${waitlist.length ? `<div class="scroll"><table><thead><tr><th>Email</th><th>Where</th><th>Joined</th><th></th></tr></thead><tbody>${waitRows}</tbody></table></div>` : '<p class="empty">Nobody has joined yet. Share kauzl.com and they’ll show up here.</p>'}
  </section>

  <section class="panel"><div class="panel-head"><div><h2>Invited</h2><p>After inviting, send them the link. “Email the link” opens a ready-made email in your mail app.</p></div></div>
    <form class="invite-form" method="post" action="/admin/invite"><input type="email" name="email" required placeholder="Invite a test user by email" aria-label="Email to invite"><button class="btn" type="submit">Invite</button></form>
    ${inviteRows ? `<div class="scroll"><table><thead><tr><th>Email</th><th>Status</th><th></th></tr></thead><tbody>${inviteRows}</tbody></table></div>` : ''}
  </section>

  <section class="panel"><div class="panel-head"><div><h2>Everyone who has signed in</h2><p>Most recent first. Viewers are people a site was shared with.</p></div></div>
    ${users.length ? `<div class="scroll"><table><thead><tr><th>Email</th><th>Access</th><th>Last seen</th><th>First sign-in</th></tr></thead><tbody>${userRows}</tbody></table></div>` : '<p class="empty">Nobody yet.</p>'}
  </section>
</div>`,
  });
}

export function waitlistCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    // Quote, and keep spreadsheet apps from running anything that looks like a formula.
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return ['email,source,joined', ...rows.map((r) => [r.email, r.source, new Date(r.createdAt).toISOString()].map(cell).join(','))].join('\r\n') + '\r\n';
}
