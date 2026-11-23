// Ordre 2044: send-program-ugedag.ps1 mod den rigtige create_program_week i PGlite.
// Funktionen Get-SessionerEfterUgedag koeres i PowerShell (intet net, ingen noegler); dens
// session_order/weekday kobles til de sessioner, RPC'en faktisk skrev (syntetiske data).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const dir = fileURLToPath(new URL('.', import.meta.url))
const rpcSql = readFileSync(`${dir}sql/create_program_week.sql`, 'utf8')
const ATHLETE = '00000000-0000-4000-8000-000000002044'

const schema = `
  create role service_role; create role anon; create role authenticated;
  create table athletes (id uuid primary key);
  create table weeks (id uuid primary key default gen_random_uuid(), athlete_id uuid, week_number int,
    block_name text, coach_note text, start_date date, unique (athlete_id, start_date));
  create table sessions (id uuid primary key default gen_random_uuid(), week_id uuid, title text,
    session_order int, weekday int);
  create table exercises (id uuid primary key default gen_random_uuid(), session_id uuid, name text,
    sets int, reps text, intensity text, note text, recommended_weight numeric, exercise_order int);
  insert into athletes values ('${ATHLETE}');`

// Scriptets egen funktion; Order og Weekday som PowerShell regner dem.
function psKobling(sessions) {
  const json = JSON.stringify(sessions).replace(/'/g, "''")
  const cmd = `$ErrorActionPreference='Stop'; . '${dir}send-program-ugedag.ps1'; ` +
    `$s = '${json}' | ConvertFrom-Json; ` +
    `ConvertTo-Json -Compress -InputObject @(Get-SessionerEfterUgedag $s | ForEach-Object { [pscustomobject]@{ Label = $_.Session.label; Weekday = $_.Weekday; Order = $_.Order } })`
  return JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8' }))
}

async function koer(dage) {
  const db = new PGlite()
  await db.exec(schema)
  await db.exec(rpcSql)
  const sessions = dage.map((day, i) => ({ ...(day ? { day } : {}), label: `Pas ${i + 1}`,
    exercises: [{ name: 'Ovelse', sets: [{ reps: 5, weight: 100 }] }] }))
  const r = await db.query('select create_program_week($1::jsonb) r', [JSON.stringify({ athleteId: ATHLETE, sessions })])
  const weekId = r.rows[0].r.week_id
  // Scriptets kobling: weekday paa den session, hvis session_order PowerShell regnede ud
  for (const p of psKobling(sessions)) {
    if (p.Weekday !== null) {
      await db.query('update sessions set weekday = $1 where week_id = $2 and session_order = $3', [p.Weekday, weekId, p.Order])
    }
  }
  const { rows } = await db.query('select title, weekday from sessions where week_id = $1 order by title', [weekId])
  await db.close()
  return Object.fromEntries(rows.map(x => [x.title, x.weekday]))
}

test('pas i raekkefoelgen torsdag, mandag, loerdag: hver session faar sin egen ugedag', { timeout: 60000 }, async () => {
  assert.deepEqual(await koer(['thursday', 'monday', 'saturday']), { 'Pas 1': 3, 'Pas 2': 0, 'Pas 3': 5 })
})

test('mandag, onsdag, fredag: uaendret adfaerd', { timeout: 60000 }, async () => {
  assert.deepEqual(await koer(['monday', 'wednesday', 'friday']), { 'Pas 1': 0, 'Pas 2': 2, 'Pas 3': 4 })
})

test('pas uden day: ingen weekday sat; blandet raekkefoelge holder', { timeout: 60000 }, async () => {
  assert.deepEqual(await koer([null, null]), { 'Pas 1': null, 'Pas 2': null })
  assert.deepEqual(await koer([null, 'friday', 'tirsdag']), { 'Pas 1': null, 'Pas 2': 4, 'Pas 3': 1 })
})
