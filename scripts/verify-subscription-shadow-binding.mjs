import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const bindingConfig = resolve(root, 'config', 'subscription-shadow-binding.json');
const SAFE_ENV_KEYS = new Set([
  'VITE_SUB_SUPABASE_URL',
  'VITE_SUB_SUPABASE_PROJECT_REF',
]);

export function parseSafeEnv(source) {
  const values = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || !SAFE_ENV_KEYS.has(match[1])) continue;

    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    values[match[1]] = value;
  }

  return values;
}

export function projectRefFromSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const match = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i);
  return url.protocol === 'https:' && match ? match[1].toLowerCase() : null;
}

export function verifyShadowBinding({ source, expectedProjectRef }) {
  const env = parseSafeEnv(source);
  const configuredRef = env.VITE_SUB_SUPABASE_PROJECT_REF?.toLowerCase();
  const urlRef = env.VITE_SUB_SUPABASE_URL
    ? projectRefFromSupabaseUrl(env.VITE_SUB_SUPABASE_URL)
    : null;
  const expected = expectedProjectRef?.toLowerCase();

  if (!expected || !/^[a-z0-9]{20}$/.test(expected)) {
    return { ok: false, reason: 'authoritative shadow project reference is invalid' };
  }
  if (!configuredRef) {
    return { ok: false, reason: 'VITE_SUB_SUPABASE_PROJECT_REF is missing' };
  }
  if (!urlRef) {
    return { ok: false, reason: 'VITE_SUB_SUPABASE_URL is missing or not an HTTPS Supabase project URL' };
  }
  if (configuredRef !== urlRef) {
    return { ok: false, reason: 'configured project reference and URL host do not match' };
  }
  if (configuredRef !== expected) {
    return { ok: false, reason: 'configured project is not the authorised subscription shadow project' };
  }

  return { ok: true };
}

function cli() {
  const args = process.argv.slice(2);
  const envFlag = args.indexOf('--env-file');
  const envFile = envFlag === -1 ? '.env.local' : args[envFlag + 1];
  if (envFlag !== -1 && !envFile) {
    console.error('FAIL shadow binding: --env-file requires a path. No database action was attempted.');
    process.exitCode = 1;
    return;
  }

  let config;
  let source;
  try {
    config = JSON.parse(readFileSync(bindingConfig, 'utf8'));
    source = readFileSync(resolve(root, envFile), 'utf8');
  } catch {
    console.error('FAIL shadow binding: binding config or env file is unavailable. No database action was attempted.');
    process.exitCode = 1;
    return;
  }

  const result = verifyShadowBinding({ source, expectedProjectRef: config.expectedProjectRef });
  if (!result.ok) {
    console.error(`FAIL shadow binding: ${result.reason}.`);
    console.error('Next safe action: correct only the local shadow URL/reference, then rerun this verifier. Do not run DRAFT SQL.');
    process.exitCode = 1;
    return;
  }

  console.log('PASS shadow binding: local configuration matches the authorised shadow project. No network or database action was attempted.');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) cli();
