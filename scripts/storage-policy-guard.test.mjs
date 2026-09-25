// Bevis for vagten (ordre 365). Fixtures er kopier af de to migrationer;
// migrationerne selv roeres ikke. Koeres af `npm run verify:storage-policies`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFiles } from './storage-policy-guard.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'storage-policies');
const load = (file) => ({ file, sql: readFileSync(join(dir, file), 'utf8') });
const BROKEN_REPO = load('20260905_video_upload_and_go_v1.sql');
const BROKEN_AS_RUN = load('20260905_video_upload_and_go_v1.as-run.sql');
const FIX = load('20260923120000_video_upload_policy_name_fix_v1.sql');
const FOUR = ['vc_upload_athlete_insert_own', 'vc_upload_athlete_select_own', 'vc_upload_coach_delete', 'vc_upload_coach_select'];

export const tests = [
  ['20260905 som den koerte i produktion fejler alene: 4 fund, eet pr. policy', () => {
    const r = checkFiles([BROKEN_AS_RUN]);
    assert.equal(r.policies, 4);
    assert.deepEqual(r.findings.map((f) => f.policy).sort(), FOUR);
    assert.ok(r.findings.every((f) => f.tables.includes('public.athletes')));
  }],
  ['repoets 20260905-fil har kun policyerne som kommentar (0 policies at tjekke)', () => {
    const r = checkFiles([BROKEN_REPO]);
    assert.equal(r.policies, 0);
  }],
  ['20260905 efterfulgt af 20260923 er groen: rettelsen afloeser alle fire', () => {
    const r = checkFiles([BROKEN_AS_RUN, FIX]);
    assert.equal(r.policies, 4);
    assert.deepEqual(r.findings, []);
  }],
  ['20260923 alene er groen', () => {
    assert.deepEqual(checkFiles([FIX]).findings, []);
  }],
  ['20260923 med objects.name skiftet tilbage til name giver 4 fund', () => {
    const r = checkFiles([{ file: 'mutant.sql', sql: FIX.sql.replaceAll('objects.name', 'name') }]);
    assert.equal(r.findings.length, 4);
  }],
  ['tabel oprettet i en migration med kolonnen name fanges; tabel uden name gaar fri', () => {
    const schema = 'create table if not exists public.teams (\n  id uuid primary key,\n  "name" text not null,\n  constraint teams_name_len check (length(name) > 0)\n);\ncreate table public.plain (id uuid, owner uuid);';
    const policy = (table) => `create policy p_${table} on storage.objects for select using (exists (select 1 from public.${table} t where t.id::text = (storage.foldername(name))[1]));`;
    assert.equal(checkFiles([{ file: 's.sql', sql: `${schema}\n${policy('teams')}` }]).findings.length, 1);
    assert.equal(checkFiles([{ file: 's.sql', sql: `${schema}\n${policy('plain')}` }]).findings.length, 0);
  }],
  ['kolonne tilfoejet med alter table add column taeller ogsaa', () => {
    const sql = 'alter table public.plain add column if not exists name text;\ncreate policy q on storage.objects for select using (exists (select 1 from public.plain p where p.id::text = (storage.foldername(name))[1]));';
    assert.equal(checkFiles([{ file: 'a.sql', sql }]).findings.length, 1);
  }],
  ['name i kommentar, streng eller kvalificeret form er ikke et fund', () => {
    const sql = "create policy r on storage.objects for select using (exists (select 1 from public.athletes a -- name\n where a.id::text = (storage.foldername(objects.name))[1] and a.name <> 'name'));";
    assert.deepEqual(checkFiles([{ file: 'r.sql', sql }]).findings, []);
  }],
  ['policy paa en anden tabel end storage.objects ignoreres', () => {
    const sql = 'create policy s on public.video_analyses for select using (exists (select 1 from public.athletes a where a.name = name));';
    assert.equal(checkFiles([{ file: 's.sql', sql }]).policies, 0);
  }],
];

export function runTests(log = console.log) {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { fn(); log(`  ok    ${name}`); } catch (err) { failed++; log(`  FEJL  ${name}\n        ${err.message.split('\n')[0]}`); }
  }
  return { passed: tests.length - failed, failed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { failed } = runTests();
  process.exit(failed ? 1 : 0);
}
