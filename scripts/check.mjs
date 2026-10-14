import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
async function check(folder) {
  for (const entry of await readdir(new URL(folder, import.meta.url), { withFileTypes: true })) {
    const relative = `${folder}${entry.name}`;
    if (entry.isDirectory()) await check(`${relative}/`);
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(
        process.execPath,
        ['--check', fileURLToPath(new URL(relative, import.meta.url))],
        { cwd: root, encoding: 'utf8' },
      );
      if (result.status !== 0) {
        console.error(result.stderr);
        process.exitCode = 1;
      }
    }
  }
}
for (const folder of ['../src/', '../public/js/', '../public/presentation/', '../test/'])
  await check(folder);
if (!process.exitCode)
  console.log('All server, browser, and test JavaScript passed syntax checks.');
