// Posts a short update to your own subreddit from the terminal, for sharing
// what you're working on. It shows the post first and asks before sending.
//
//   npm run post -- "Title" "Some text"         # a text post
//   npm run post -- "Title" --git               # text = today's commit subjects
//   npm run post -- "Title" --git 5             # text = the last 5 commit subjects
//   npm run post -- "Title" --link https://...  # a link post
//   echo "longer text" | npm run post -- "Title"
//
// Options: --sub <name> (default REDDIT_SUBREDDIT, else "kauzl"), --yes (no
// question), --dry-run (show it, send nothing).
//
// Needs a Reddit "script" app (reddit.com/prefs/apps) and these in .env:
//   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
// With two-factor login on, add the current code: REDDIT_PASSWORD=pass:123456
// works for one run. Post only to a subreddit you run: posting the same thing
// across other communities gets accounts banned.

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const opts = { title: '', text: '', link: '', git: null, sub: '', yes: false, dryRun: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--sub') opts.sub = String(argv[++i] || '').replace(/^\/?r\//, '');
    else if (a === '--link') opts.link = argv[++i] || '';
    else if (a === '--git') {
      const n = Number(argv[i + 1]);
      opts.git = Number.isInteger(n) && n > 0 ? (i++, n) : 'today';
    } else rest.push(a);
  }
  [opts.title = '', opts.text = ''] = rest;
  return opts;
}

// Commit subjects → a bullet list, oldest first, merge commits left out.
export function commitsToText(subjects) {
  return subjects.filter((s) => s && !/^Merge /.test(s)).reverse().map((s) => `- ${s}`).join('\n');
}

function gitSubjects(git) {
  const args = ['log', '--no-merges', '--format=%s'];
  if (git === 'today') args.push('--since=midnight');
  else args.push(`-${git}`);
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
}

// → the form Reddit's /api/submit takes.
export function submitForm({ sub, title, text, link }) {
  const form = { sr: sub, title, api_type: 'json', resubmit: 'true', sendreplies: 'true' };
  if (link) Object.assign(form, { kind: 'link', url: link });
  else Object.assign(form, { kind: 'self', text });
  return new URLSearchParams(form);
}

export function checkPost({ sub, title, link }) {
  if (!sub) return 'Say which subreddit with --sub, or set REDDIT_SUBREDDIT.';
  if (!title) return 'Give a title: npm run post -- "Title" "Text"';
  if (title.length > 300) return `The title is ${title.length} characters; Reddit allows 300.`;
  if (link && !/^https?:\/\//.test(link)) return 'The --link needs to start with http:// or https://.';
  return '';
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  return s.trim();
}

async function signIn({ id, secret, username, password, agent }) {
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'User-Agent': agent,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'password', username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Reddit sign-in failed (${res.status}${json.error ? `, ${json.error}` : ''}). Check the four REDDIT_ values in .env, and that the app is a "script" app.`);
  }
  return json.access_token;
}

async function main() {
  if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
  const env = process.env;
  const opts = parseArgs(process.argv.slice(2));
  const sub = opts.sub || env.REDDIT_SUBREDDIT || 'kauzl';

  let text = opts.text;
  if (opts.git) {
    const commits = commitsToText(gitSubjects(opts.git));
    if (!commits) throw new Error(opts.git === 'today' ? 'No commits today. Try --git 5 for the last five.' : 'No commits found.');
    text = text ? `${text}\n\n${commits}` : commits;
  }
  if (!text && !opts.link) text = await readStdin();

  const post = { sub, title: opts.title, text, link: opts.link };
  const problem = checkPost(post);
  if (problem) throw new Error(problem);

  console.log(`\nr/${sub}\n${'─'.repeat(40)}\n${post.title}\n`);
  console.log(post.link ? post.link : post.text || '(no text)');
  console.log(`${'─'.repeat(40)}\n`);
  if (opts.dryRun) return console.log('Dry run: nothing was posted.');

  if (!opts.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Post this? [y/N] ');
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) return console.log('Not posted.');
  }

  const { REDDIT_CLIENT_ID: id, REDDIT_CLIENT_SECRET: secret, REDDIT_USERNAME: username, REDDIT_PASSWORD: password } = env;
  if (!id || !secret || !username || !password) {
    throw new Error('Add REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME and REDDIT_PASSWORD to .env (see the top of scripts/post.mjs).');
  }
  const agent = `node:kauzl-post:0.1 (by /u/${username})`;
  const token = await signIn({ id, secret, username, password, agent });
  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': agent, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: submitForm(post),
  });
  const json = await res.json().catch(() => ({}));
  const errors = json?.json?.errors || [];
  if (!res.ok || errors.length) {
    const why = errors.map((e) => e.slice(1).filter(Boolean).join(': ')).join('; ');
    throw new Error(`Reddit didn't take the post (${res.status})${why ? `: ${why}` : ''}`);
  }
  console.log(`Posted: ${json?.json?.data?.url || `https://www.reddit.com/r/${sub}/new`}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
