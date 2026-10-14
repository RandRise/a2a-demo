import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { connectionSettings } from '../ai/provider.mjs';

const localEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

export function loadLocalEnvironment(path = localEnvPath) {
  try {
    // Node preserves existing process variables. Never log file contents or values.
    loadEnvFile(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw new Error('Could not read the local .env file. Check its permissions and syntax.');
  }
}

export function settingsFromEnvironment(environment = process.env) {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return connectionSettings({
    provider: 'openai',
    apiKey,
    model: environment.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
  });
}
