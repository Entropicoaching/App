// ORDRE 370 · SQL-paritet: koerer training-signals-v1.sql og den IKKE-koerte
// v2-migration i PGlite (Postgres i WASM, i hukommelsen) paa de syntetiske
// atleter og sammenligner med src/coachBriefingRules.js. Ingen rigtig database
// roeres. Tabellerne oprettes efter det skema migrationen antager.
//
//   npm i --no-save @electric-sql/pglite@0.2 && node scripts/briefing-370-sql-paritet.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const { PGlite } = await import('@electric-sql/pglite').catch(() => {
  console.error('Mangler PGlite: npm i --no-save @electric-sql/pglite@0.2')
  process.exit(2)
})
const imp = p => import(pathToFileURL(join(repo, p)).href)
const { default: fixtures } = await imp('test/fixtures/briefing/index.mjs')
const rules = await imp('src/coachBriefingRules.js')

const DAY = 86400000
const realToday = new Date().toISOString().slice(0, 10)
const shiftDays = Math.round((Date.parse(realToday) - Date.parse(fixtures[0].today)) / DAY)
const sh = iso => iso == null ? null : new Date(Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso) + shiftDays * DAY).toISOString()
const shd = iso => iso == null ? null : sh(iso).slice(0, 10)
const shiftFixture = f => ({
  ...f, today: shd(f.today),
  weeks: f.weeks.map(w => ({ ...w, start_date: shd(w.start_date) })),
  logs: f.logs.map(l => ({ ...l, logged_at: sh(l.logged_at) })),
  readiness: f.readiness.map(r => ({ ...r, logged_date: shd(r.logged_date) })),
  personal_records: f.personal_records.map(p => ({ ...p, created_at: sh(p.created_at) })),
})

async function run(sqlFile) {
  const db = new PGlite()
  await db.exec(`
    set timezone = 'UTC';
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table athletes(id uuid primary key, name text, coach_id uuid, hidden boolean, status text, vacation_until date);
    create table weeks(id uuid primary key, athlete_id uuid, week_number int, start_date date);
    create table sessions(id uuid primary key, week_id uuid, title text, session_order int, athlete_comment text);
    create table exercises(id uuid primary key, session_id uuid, name text);
    create table exercise_logs(id serial, athlete_id uuid, exercise_id uuid, logged_at timestamptz, weight numeric, reps_completed int, rpe_planned numeric, rpe_actual numeric, skipped boolean);
    create table readiness_logs(athlete_id uuid, logged_date date, energy int, soreness_level int, sore_zones text[]);
    create table personal_records(athlete_id uuid, exercise_name text, weight numeric, reps int, created_at timestamptz);
  `)
  const coach = '00000000-0000-0000-0000-00000000c0ac'
  const u = `md5($1)::uuid`
  for (const f0 of fixtures) {
    const f = shiftFixture(f0)
    const a = f.athlete
    await db.query(`insert into athletes values (${u}, $2, $3, false, $4, $5)`, [a.id, a.name, coach, a.status, a.vacation_until])
    for (const w of f.weeks) {
      await db.query(`insert into weeks values (${u}, md5($2)::uuid, $3, $4)`, [w.id, a.id, w.week_number, w.start_date])
      for (const [i, s] of w.sessions.entries()) {
        await db.query(`insert into sessions values (${u}, md5($2)::uuid, $3, $4, $5)`, [s.id, w.id, s.title, i, s.athlete_comment])
      }
    }
    const seenEx = new Set()
    for (const l of f.logs) {
      if (!seenEx.has(l.exercise_id)) {
        seenEx.add(l.exercise_id)
        await db.query(`insert into exercises values (${u}, md5($2)::uuid, $3)`, [l.exercise_id, l.session_id, l.name])
      }
      await db.query(`insert into exercise_logs(athlete_id, exercise_id, logged_at, weight, reps_completed, rpe_planned, rpe_actual, skipped) values (${u}, md5($2)::uuid, $3, $4, $5, $6, $7, $8)`,
        [a.id, l.exercise_id, l.logged_at, l.weight, l.reps_completed, l.rpe_planned, l.rpe_actual, l.skipped])
    }
    for (const r of f.readiness) {
      await db.query(`insert into readiness_logs values (${u}, $2, $3, $4, $5)`, [a.id, r.logged_date, r.energy, r.soreness_level, r.sore_zones])
    }
    for (const p of f.personal_records) {
      await db.query(`insert into personal_records values (${u}, $2, $3, $4, $5)`, [a.id, p.exercise_name, p.weight, p.reps, p.created_at])
    }
  }
  await db.exec(readFileSync(join(repo, sqlFile), 'utf8'))
  await db.exec(`set request.jwt.claim.sub = '${coach}'`)
  const { rows } = await db.query(`select o_athlete_name, o_detector, o_severity, o_headline, o_detail, o_metrics from public.entropi_training_signals_v1() order by 1, 2, 4`)
  return rows
}

const key = s => `${s.athlete_name}|${s.detector}|${s.severity}|${s.headline}|${s.detail}`
const report = (label, sqlRows, jsSignals) => {
  const sql = sqlRows.map(r => key({ athlete_name: r.o_athlete_name, detector: r.o_detector, severity: r.o_severity, headline: r.o_headline, detail: r.o_detail })).sort()
  const js = jsSignals.map(key).sort()
  const onlySql = sql.filter(k => !js.includes(k))
  const onlyJs = js.filter(k => !sql.includes(k))
  console.log(`\n== ${label}: SQL ${sql.length} raekker, JS ${js.length}; kun SQL ${onlySql.length}, kun JS ${onlyJs.length}`)
  onlySql.forEach(k => console.log('  SQL:', k))
  onlyJs.forEach(k => console.log('  JS: ', k))
  return onlySql.length + onlyJs.length
}

const shifted = fixtures.map(shiftFixture)
// v1: alle raekker (ogsaa ok/insufficient). Stagnation-detaljer: JS runder e1RM som SQL.
const v1sql = await run('supabase/sql/training-signals-v1.sql')
let diffs = report('v1 alle raekker', v1sql, shifted.flatMap(rules.detectSignalsV1))
// v2: det briefingen faar (alert/context).
const v2sql = await run('supabase/migrations/20260925120000_training_signals_v2.sql')
diffs += report('v2 alert/context', v2sql.filter(r => ['alert', 'context'].includes(r.o_severity)), shifted.flatMap(rules.detectSignalsV2))
const v2Action = v2sql.filter(r => ['alert', 'context'].includes(r.o_severity) && r.o_metrics?.action !== r.o_detail)
console.log(`v2: raekker hvor metrics.action != detail: ${v2Action.length}`)
console.log(`v2 ikke-fyrende raekker (til appen): ${v2sql.filter(r => !['alert', 'context'].includes(r.o_severity)).length}, v1: ${v1sql.filter(r => !['alert', 'context'].includes(r.o_severity)).length}`)
const ok = diffs + v2Action.length === 0
console.log(ok ? '\nPARITET OK' : '\nPARITET AFVIGER')
if (!ok) process.exitCode = 1
