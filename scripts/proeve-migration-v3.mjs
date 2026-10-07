// Ordre 1508: proeve af migrationen 20261006120000_training_signals_v3_tunge_saet.sql paa en
// LOKAL Postgres (pglite, in-memory). Ingen Docker, ingen noegler, ingen forbindelse til
// Supabase. Koer: npm run proeve:migration-v3
//   1. minimalt skema + alle migrationer i raekkefoelge (de der ikke kan koeres uden prod-tabeller meldes)
//   2. syntetiske atleter ind
//   3. v2 -> v3 (foer ret, fra ordre-1502) -> v3 (rettet) -> v2 igen (tilbagerulning)
//   4. SQL-stagnationssignalerne holdes op mod appens JS-regel (detectSignalsV2) paa de SAMME data
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { detectSignalsV2 } from '../src/coachBriefingRules.js'
import { byggDatasaet, COACH_ID } from './proeve-migration-v3/data.mjs'

const rod = join(dirname(fileURLToPath(import.meta.url)), '..')
const migDir = join(rod, 'supabase', 'migrations')
const V2 = '20260925120000_training_signals_v2.sql'
const V3 = '20261006120000_training_signals_v3_tunge_saet.sql'
const les = p => readFileSync(p, 'utf8').replace(/^﻿/, '')
const linjer = []
const ud = (s = '') => { linjer.push(s); console.log(s) }

const db = new PGlite()
await db.exec(les(join(rod, 'scripts', 'proeve-migration-v3', 'skema-minimalt.sql')))

// 1. alle migrationer i raekkefoelge; v2 og v3 koeres bagefter hver for sig
ud('## Migrationer paa lokal Postgres (pglite)')
const filer = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort()
for (const f of filer) {
  if (f === V2 || f === V3) continue
  try { await db.exec(les(join(migDir, f))); ud(`- ${f}: koert`) }
  catch (e) { ud(`- ${f}: kunne ikke koeres uden prod-tabeller (${String(e.message).split('\n')[0]})`) }
}

// 2. syntetiske data
const today = (await db.query('select current_date::text d')).rows[0].d
const atleter = byggDatasaet(today)
await db.query('insert into auth.users(id) values ($1)', [COACH_ID])
let exNr = 0
for (const a of atleter) {
  await db.query('insert into public.athletes(id, coach_id, name, hidden, status) values ($1,$2,$3,false,$4)', [a.athlete.id, COACH_ID, a.athlete.name, a.athlete.status])
  for (const w of a.weeks) {
    await db.query('insert into public.weeks(id, athlete_id, week_number, start_date, block_name) values ($1,$2,$3,$4,$5)', [w.id, w.athlete_id, w.week_number, w.start_date, w.block_name])
    for (const s of w.sessions) await db.query('insert into public.sessions(id, week_id, title, session_order) values ($1,$2,$3,$4)', [s.id, w.id, s.title, s.session_order])
  }
  const exIds = new Map()
  for (const l of a.logs) {
    if (!exIds.has(l.exercise_key)) {
      exNr += 1
      const id = `e0000000-0000-4000-8000-${String(exNr).padStart(12, '0')}`
      exIds.set(l.exercise_key, id)
      await db.query('insert into public.exercises(id, session_id, name) values ($1,$2,$3)', [id, l.session_id, l.name])
    }
    await db.query('insert into public.exercise_logs(athlete_id, exercise_id, logged_at, weight, reps_completed, rpe_planned, rpe_actual, skipped) values ($1,$2,$3,$4,$5,$6,$7,false)',
      [l.athlete_id, exIds.get(l.exercise_key), l.logged_at, l.weight, l.reps_completed, l.rpe_planned, l.rpe_actual])
  }
}
const antal = (await db.query('select (select count(*) from public.athletes) a, (select count(*) from public.exercise_logs) l, (select count(distinct name) from public.exercises) n')).rows[0]
ud(`\nSyntetiske data (i dag = ${today}): ${antal.a} atleter, ${antal.l} saet, ${antal.n} oevelsesnavne.`)

// 3. v2 / v3 foer / v3 rettet / v2 igen
const v3Foer = (() => { try { return execFileSync('git', ['show', `ordre-1502:supabase/migrations/${V3}`], { cwd: rod, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/^﻿/, '') } catch { return null } })()
const signaler = async () => {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [COACH_ID])
  return (await db.query('select * from public.entropi_training_signals_v1()')).rows
}
const varianter = {}
await db.exec(les(join(migDir, V2))); varianter.v2 = await signaler()
if (v3Foer) { await db.exec(v3Foer); varianter.v3Foer = await signaler() }
await db.exec(les(join(migDir, V3))); varianter.v3 = await signaler()
await db.exec(les(join(migDir, V2))); varianter.v2Igen = await signaler()
await db.exec(les(join(migDir, V3))); varianter.v3Igen = await signaler()

const norm = r => `${r.o_athlete_name}|${r.o_detector}|${r.o_severity}|${r.o_headline}|${r.o_detail}`
const synlig = rows => rows.filter(r => ['alert', 'context'].includes(r.o_severity))
ud('\n## Tilbagerulning')
const ensRaekker = (x, y) => JSON.stringify(x.map(norm).sort()) === JSON.stringify(y.map(norm).sort())
const rulning = ensRaekker(varianter.v2Igen, varianter.v2)
const genkoersel = ensRaekker(varianter.v3Igen, varianter.v3)
ud(`- v2 efter v3 giver samme ${varianter.v2Igen.length} raekker som v2 foer v3: ${rulning ? 'JA' : 'NEJ'}`)
ud(`- v3 igen efter rulning giver samme raekker som v3 foerste gang: ${genkoersel ? 'JA' : 'NEJ'}`)

// 4. sammenligning pr. atlet paa stagnation (synlige signaler: alert/context)
const kort = (n, sev, h) => `${sev}: ${h.replace(`${n}: `, '')}`
const stag = rows => Object.fromEntries(atleter.map(a => [a.athlete.name,
  synlig(rows).filter(r => r.o_detector === 'stagnation' && r.o_athlete_name === a.athlete.name)
    .map(r => kort(a.athlete.name, r.o_severity, r.o_headline)).join(' / ') || '(intet)']))
const js = Object.fromEntries(atleter.map(a => [a.athlete.name,
  detectSignalsV2(a).filter(s => s.detector === 'stagnation' && ['alert', 'context'].includes(s.severity))
    .map(s => kort(a.athlete.name, s.severity, s.headline)).join(' / ') || '(intet)']))
const sv2 = stag(varianter.v2), sv3f = v3Foer ? stag(varianter.v3Foer) : null, sv3 = stag(varianter.v3)
ud('\n## Stagnationssignaler: appens JS-regel mod SQL (synlige: alert/context)')
ud('| Atlet | JS-regel (appen) | SQL v2 | SQL v3 foer ret | SQL v3 rettet | v3 rettet = JS |')
ud('|---|---|---|---|---|---|')
for (const a of atleter) {
  const n = a.athlete.name
  ud(`| ${n} | ${js[n]} | ${sv2[n]} | ${sv3f ? sv3f[n] : 'n/a'} | ${sv3[n]} | ${js[n] === sv3[n] ? 'ens' : 'AFVIGER'} |`)
}
const ovrige = rows => synlig(rows).filter(r => r.o_detector !== 'stagnation').map(norm).sort()
const andreUaendret = JSON.stringify(ovrige(varianter.v2)) === JSON.stringify(ovrige(varianter.v3))
ud(`\nAndre detektorer (smerte, RPE, frafald, mistede pas, PR) uaendret v2 -> v3: ${andreUaendret ? 'JA' : 'NEJ'}`)
const loeftSet = rows => [...new Set(rows.filter(r => r.o_detector === 'stagnation' && r.o_metrics?.lift).map(r => r.o_metrics.lift))].sort()
ud(`Loeft i stagnationsraekkerne, v3 foer ret: ${v3Foer ? loeftSet(varianter.v3Foer).join(', ') : 'n/a'}`)
ud(`Loeft i stagnationsraekkerne, v3 rettet: ${loeftSet(varianter.v3).join(', ')}`)

// Valgfri: PROEVE_UD=<mappe> gemmer tabellen som resultat.md (aldrig inde i repoet).
if (process.env.PROEVE_UD) {
  mkdirSync(process.env.PROEVE_UD, { recursive: true })
  writeFileSync(join(process.env.PROEVE_UD, 'resultat.md'), linjer.join('\n') + '\n')
}
await db.close()

// Ordre 1516: ingen kendte afvigelser; JS og SQL skal give samme signal for alle atleter (ogsaa deload).
const uventet = atleter.filter(a => js[a.athlete.name] !== sv3[a.athlete.name])
const sumoAdskilt = loeftSet(varianter.v3).includes('Sumo dødløft') && loeftSet(varianter.v3).includes('Dødløft')
if (uventet.length || !sumoAdskilt || !rulning || !genkoersel || !andreUaendret) {
  console.error(`\nPROEVEN FEJLEDE: ${uventet.length ? `uventet afvigelse: ${uventet.map(a => a.athlete.name).join(', ')}; ` : ''}sumoAdskilt=${sumoAdskilt} rulning=${rulning} genkoersel=${genkoersel} andreUaendret=${andreUaendret}`)
  process.exit(1)
}
console.log(`\nProeven er groen: JS og SQL v3 ens for alle ${atleter.length} atleter.`)
