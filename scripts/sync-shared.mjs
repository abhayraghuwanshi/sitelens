// Copies the extension's portable report layer into shared/sitelens/.
// These files are plain fetch + data code (no chrome.* calls on the paths
// Studio uses), so both apps compute GA4 and Search Console numbers the same way.
//
//   npm run sync                       # from ../site-analytics-extension
//   npm run sync -- /path/to/extension

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.argv[2] || join(root, '..', 'site-analytics-extension'), 'src/lib');
const target = join(root, 'shared/sitelens');

const FILES = ['ga4.js', 'gsc.js', 'reports.js', 'insights.js', 'format.js', 'demo.js', 'site.js'];
const HEADER = '// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.\n';

await mkdir(target, { recursive: true });
for (const file of FILES) {
  const text = await readFile(join(source, file), 'utf8');
  await writeFile(join(target, file), HEADER + text.replace(/^\/\/ Synced from .*\n/, ''));
  console.log(`  synced ${file}`);
}
