import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLocalEnvironment, settingsFromEnvironment } from '../src/config/environment.mjs';

test('optional env file loads quoted values without overriding the shell', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'relay-env-fixture-'));
  const path = join(directory, '.env');
  const keys = ['OPENAI_API_KEY', 'OPENAI_MODEL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(async () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await unlink(path);
    await rmdir(directory);
  });
  // Invented marker only. Tests never read the operator's local .env.
  await writeFile(path, 'OPENAI_API_KEY="invented-file-marker"\nOPENAI_MODEL=fixture-model\n');
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  assert.equal(loadLocalEnvironment(path), true);
  assert.equal(settingsFromEnvironment().apiKey, 'invented-file-marker');
  assert.equal(settingsFromEnvironment().model, 'fixture-model');
  process.env.OPENAI_API_KEY = 'invented-shell-marker';
  loadLocalEnvironment(path);
  assert.equal(settingsFromEnvironment().apiKey, 'invented-shell-marker');
  assert.equal(loadLocalEnvironment(join(directory, 'missing.env')), false);
  assert.throws(() => loadLocalEnvironment(directory), /Could not read the local .env file/);
});

test('blank configuration keeps rehearsal available and invalid credentials fail locally', () => {
  assert.equal(settingsFromEnvironment({}), null);
  assert.equal(settingsFromEnvironment({ OPENAI_API_KEY: '  ' }), null);
  assert.throws(() => settingsFromEnvironment({ OPENAI_API_KEY: 'short' }), /API key/);
  assert.throws(
    () =>
      settingsFromEnvironment({
        OPENAI_API_KEY: 'invented-marker',
        OPENAI_MODEL: 'invalid model name',
      }),
    /model name/,
  );
});

test('real CLI startup keeps configured credentials out of HTTP and stdout', async (t) => {
  const marker = 'invented-startup-marker';
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../src/server.mjs', import.meta.url))],
    {
      cwd: tmpdir(),
      env: {
        ...process.env,
        OPENAI_API_KEY: marker,
        OPENAI_MODEL: 'fixture-model',
        PORT: '0',
        AGENT_PORT: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  t.after(() => child.kill());
  let output = '';
  let errors = '';
  child.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI startup timed out')), 15000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('CLI exited before readiness'));
    });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  const response = await fetch(`${url}/api/status`);
  const body = await response.text();
  assert.equal(JSON.parse(body).connection.configured, true);
  assert.equal(JSON.parse(body).connection.model, 'fixture-model');
  for (const path of ['/.env', '/.env.example', '/src/config/environment.mjs', '/../.env']) {
    assert.equal((await fetch(`${url}${path}`)).status, 404);
  }
  assert.ok(![body, output, errors].some((value) => value.includes(marker)));
});
