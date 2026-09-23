import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findShadowedFolderNameArgs } from './storagePolicySql.js'

const root = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
const migrationsDir = join(root, 'supabase', 'migrations')

// Ordret den policy video_upload_and_go_v1 (ORDRE 57) kørte i produktion
// 5. sep (læst fra supabase_migrations.schema_migrations, ORDRE 333).
const PRODUCTION_POLICY_0905 = `
drop policy if exists "vc_upload_athlete_insert_own" on storage.objects;
create policy "vc_upload_athlete_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videocoach-uploads'
    and exists (
      select 1 from public.athletes a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = (select auth.uid())
    )
  );
`

test('fanger policyen der brød "upload og gå" (foldername(name) i en athletes-underforespørgsel)', () => {
  assert.deepEqual(findShadowedFolderNameArgs(PRODUCTION_POLICY_0905),
    [{ policy: 'vc_upload_athlete_insert_own', arg: 'name' }])
})

test('godtager objects.name og en policy uden underforespørgsel', () => {
  assert.deepEqual(findShadowedFolderNameArgs(PRODUCTION_POLICY_0905.replace('foldername(name)', 'foldername(objects.name)')), [])
  assert.deepEqual(findShadowedFolderNameArgs(`create policy p on storage.objects for select to authenticated
    using (bucket_id = 'b' and (storage.foldername(name))[1] = auth.uid()::text);`), [])
})

test('ingen SQL-fil i supabase/migrations har en skygget foldername(name)', () => {
  for (const file of readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))) {
    assert.deepEqual(findShadowedFolderNameArgs(readFileSync(join(migrationsDir, file), 'utf8')), [], file)
  }
})

test('rettelsen (ORDRE 333) retter alle fire videocoach-uploads-policies med objects.name', () => {
  const fix = readFileSync(join(migrationsDir, '20260923120000_video_upload_policy_name_fix_v1.sql'), 'utf8')
  for (const name of ['vc_upload_athlete_insert_own', 'vc_upload_athlete_select_own', 'vc_upload_coach_select', 'vc_upload_coach_delete']) {
    assert.match(fix, new RegExp(`alter policy "${name}" on storage\\.objects[\\s\\S]*?foldername\\(objects\\.name\\)`), name)
  }
  assert.equal((fix.match(/foldername\(objects\.name\)/g) || []).length, 4)
})
