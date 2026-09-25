// npm run verify:storage-policies (ordre 365)
// 1) beviset: testen med de to migrationer som fixtures
// 2) vagten: alle supabase/migrations/*.sql i navneorden
// Fejler (exit 1) hvis en storage-policy har et ukvalificeret `name` inde i
// exists (select ... from <tabel med kolonnen name> ...). Se storage-policy-guard.mjs.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFiles } from './storage-policy-guard.mjs';
import { runTests } from './storage-policy-guard.test.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');

console.log('Bevis (fixtures):');
const proof = runTests();

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => ({ file: `supabase/migrations/${f}`, sql: readFileSync(join(migrationsDir, f), 'utf8') }));
const { policies, findings } = checkFiles(files);
console.log(`\nVagt: ${files.length} migrationer, ${policies} policies paa storage.objects.`);
for (const f of findings) console.log(`  FEJL  ${f.file}:${f.line}  policy "${f.policy}": ${f.message}`);

const ok = proof.failed === 0 && findings.length === 0;
console.log(ok
  ? `\nGROEN: ${proof.passed}/${proof.passed} beviser, 0 fund i migrationerne.`
  : `\nROED: ${proof.failed} beviser fejlede, ${findings.length} fund i migrationerne.`);
process.exit(ok ? 0 : 1);
