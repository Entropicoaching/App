// Generalprøve (ordre 80): én lokal kopi af produktionens database i PGlite, med de syntetiske
// brugere og atleter som e2e-mocken også bruger, og nattens trin som funktioner.
// Bruges af src/entropi2/generalproeve/generalproeve.sql.test.mjs (datalaget) og
// e2e/generalproeve.mjs (appen i browseren). Ingen nøgler, intet net, ingen rigtige data.
import { readFileSync } from 'node:fs'
import { createPgRest } from '../../e2e/pglite-postgrest.mjs'

const root = new URL('../../', import.meta.url)
export const read = path => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n')

// Nattens filer i den rækkefølge, de køres. A (kostplanen) er allerede live siden 8. nov.
export const FILES = Object.freeze({
  base: 'scripts/generalproeve/prod-skema-20261108.sql',
  liveKostplan: 'scripts/generalproeve/live/20261108122354_kostplan_v1_identity_and_plans_20261107.sql',
  extra: 'scripts/generalproeve/prod-ekstra-proeve.sql',
  u7Up: 'supabase/sql/udkast/20261111000000_u7_kost_som_data_B_C_DRAFT.sql',
  u7Down: 'supabase/sql/udkast/20261111000000_u7_kost_som_data_B_C_DRAFT_ROLLBACK.sql',
  u8Up: 'supabase/sql/udkast/20261111120000_u8_push_D_DRAFT.sql',
  u8Down: 'supabase/sql/udkast/20261111120000_u8_push_D_DRAFT_ROLLBACK.sql',
})
export const U7_TABLES = ['tracking_daily_v1', 'nutrition_targets_v1']
export const U8_TABLES = ['push_subscriptions_v1', 'push_preferences_v1', 'push_log_v1']
export const KOSTPLAN_TABLES = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']

const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`
// Samme id'er som e2e/fixtures.mjs, så browseren og databasen taler om de samme personer.
export const PEOPLE = Object.freeze({
  coach: { id: '11111111-1111-4111-8111-111111111111', email: 'coach@e2e.test', role: 'coach' },
  athlete: { id: '22222222-2222-4222-8222-222222222222', email: 'atlet@e2e.test', role: 'athlete' },
  otherCoach: { id: id('9a000000', 1), email: 'coach2@generalproeve.test', role: 'coach' },
  otherAthlete: { id: id('9a000000', 2), email: 'atlet2@generalproeve.test', role: 'athlete' },
})
export const ATHLETES = Object.freeze({
  mine: '33333333-3333-4333-8333-333333333333',
  other: id('9b000000', 1),
  unclaimed: id('9b000000', 2),
  coachSelf: id('9b000000', 3),
})

export async function createRehearsalDb({ PGlite, withExtra = true } = {}) {
  if (!PGlite) ({ PGlite } = await import('@electric-sql/pglite'))
  const db = new PGlite()
  await db.exec(read(FILES.base))
  // Kostplanen, som den faktisk blev kørt live 8. nov. Dens egne kontroller godkender kopien.
  await db.exec('begin;\n' + read(FILES.liveKostplan) + '\ncommit;')
  if (withExtra) await db.exec(read(FILES.extra))
  const { coach, athlete, otherCoach, otherAthlete } = PEOPLE
  for (const p of [coach, athlete, otherCoach, otherAthlete]) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [p.id, p.email])
    await db.query('insert into public.profiles (id, role, email) values ($1, $2, $3)', [p.id, p.role, p.email])
  }
  const add = (aid, coachId, userId, email, kcal, protein) => db.query(`insert into public.athletes
    (id, coach_id, user_id, email, name, kcal_target, protein_target) values ($1,$2,$3,$4,'Syntetisk',$5,$6)`,
  [aid, coachId, userId, email, kcal, protein])
  await add(ATHLETES.mine, coach.id, athlete.id, athlete.email, 2800, 180)
  await add(ATHLETES.other, otherCoach.id, otherAthlete.id, otherAthlete.email, 2500, 150)
  await add(ATHLETES.unclaimed, coach.id, null, 'ny@generalproeve.test', null, 120)
  await add(ATHLETES.coachSelf, coach.id, coach.id, coach.email, 3000, 200)
  const claims = new Map([...Object.values(PEOPLE)].map(p => [`tok-${p.id}`, { sub: p.id, email: p.email, role: 'authenticated', aud: 'authenticated' }]))
  claims.set('service', { role: 'service_role' })
  const rest = createPgRest({ db, tokenToClaims: token => claims.get(token) })
  const tables = async () => (await db.query(`select relname from pg_class where relnamespace = 'public'::regnamespace
    and relkind = 'r' order by 1`)).rows.map(r => r.relname)
  const count = async table => Number((await db.query(`select count(*) n from public.${table}`)).rows[0].n)
  return { db, rest, tables, count, claims, step: name => rest.exec(read(FILES[name])) }
}
