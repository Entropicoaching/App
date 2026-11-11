// Generalprøve (ordre 80): nattens database-trin mod en lokal kopi af produktionens skema.
// Kopien er bygget fra et læsende katalogudtræk, og den kostplan-migration, der faktisk blev kørt
// live 8. nov., godkender den med sine egne kontroller. Appens egne datamoduler og edge-funktionen
// u8-push kaldes gennem appens PostgREST-klient mod en lille PostgREST over PGlite, så RLS,
// kolonnerettigheder og triggere virker som i produktionen. Kun syntetiske brugere; intet net.
// Rækkefølgen er nattens: U7 (B og C) op, U8 (D) op, D ned, U7 ned, og op igen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createECDH, randomBytes } from 'node:crypto'
import { PostgrestClient } from '@supabase/postgrest-js'
import { createRehearsalDb, read, FILES, PEOPLE, ATHLETES, U7_TABLES, U8_TABLES, KOSTPLAN_TABLES } from '../../../scripts/generalproeve/proeveDb.mjs'
import { listenPgRest } from '../../../e2e/pglite-postgrest.mjs'
import { readDaily, saveDaily, readTargets, appendTarget, forgetTableState } from '../u7/dayData.mjs'
import { readPushSetup, enablePush, saveTime, disablePush } from '../u8/pushData.mjs'
import { createPlanAdapter } from '../kostplan/planAdapter.mjs'
import { createHandler } from '../../../supabase/functions-udkast/u8-push/handler.mjs'

const root = new URL('../../../', import.meta.url)
const keyScript = spawnSync(process.execPath, ['scripts/u8-vapid-noegler.mjs'], { cwd: root, encoding: 'utf8' })
const secrets = Object.fromEntries([...keyScript.stdout.matchAll(/^([A-Z0-9_]+) = (\S+)$/gm)].map(m => [m[1], m[2]]))

function danishNow(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) }
}
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

test('generalprøve: nattens database-trin mod produktionens skema, med appens egne kald', { timeout: 180000 }, async t => {
  assert.equal(keyScript.status, 0)
  const rehearsal = await createRehearsalDb()
  const { db, rest, tables, count } = rehearsal
  const server = await listenPgRest(rest, 0)
  const pushed = []
  let keysSet = false
  const env = name => ({ ...(keysSet ? secrets : {}), SUPABASE_URL: server.url, SUPABASE_SERVICE_ROLE_KEY: 'service' })[name]
  const http = async (url, init) => {
    if (String(url).startsWith(server.url)) return fetch(url, init)
    pushed.push({ url: String(url), ttl: init?.headers?.TTL ?? init?.headers?.ttl })
    return new Response(null, { status: 201 })
  }
  const fn = createHandler({ env, fetch: http, sendEnabled: true })
  // Samme byggesten som src/supabase.js: PostgREST med brugerens token og funktionerne ved siden af.
  const clientFor = person => {
    const headers = { apikey: 'anon-proeve', Authorization: `Bearer tok-${person.id}` }
    const restClient = new PostgrestClient(`${server.url}/rest/v1`, { schema: 'public', headers })
    return { from: table => restClient.from(table), rpc: (...a) => restClient.rpc(...a),
      functions: { invoke: async (name, { body }) => {
        const answer = await fn(new Request(`${server.url}/functions/v1/${name}`, { method: 'POST', body: JSON.stringify(body) }))
        return answer.ok ? { data: await answer.json(), error: null } : { data: null, error: { status: answer.status } }
      } } }
  }
  const { coach, athlete, otherCoach, otherAthlete } = PEOPLE
  const today = danishNow().day
  // En atlets telefon: syntetisk push-tilmelding og tilladelse.
  const phone = endpoint => {
    let sub = null
    const ecdh = createECDH('prime256v1'); ecdh.generateKeys()
    const keys = { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }
    return { notification: { permission: 'granted', requestPermission: async () => 'granted' },
      registration: { pushManager: {
        getSubscription: async () => sub,
        subscribe: async ({ applicationServerKey }) => (sub = { endpoint, options: { applicationServerKey: applicationServerKey.buffer },
          toJSON: () => ({ endpoint, keys }),
          unsubscribe: async () => { sub = null; return true } }),
      } } }
  }
  const approvedPlan = async client => createPlanAdapter({ enabled: true, client, athleteId: ATHLETES.mine, date: today }).loadActive()

  try {
    // ===== Før: produktionen i dag. Kostplanen er live og har en godkendt plan. =====
    await t.test('før: kostplanen er live; B, C og D findes ikke; appen falder pænt tilbage', async () => {
      const coachRest = clientFor(coach)
      const plan = '9c000000-0000-4000-8000-000000000001', version = '9c000000-0000-4000-8000-000000000002'
      assert.equal((await coachRest.from('kostplan_v1_plans').insert({ id: plan, athlete_id: ATHLETES.mine, valid_from: today })).error, null)
      const meals = [{ name: 'Morgenmad', portions: [{ grams: 100, food: { id: 'havregryn', name: 'Havregryn', preparation: 'tør', basisGrams: 100,
        nutrientsPer100g: { energyKcal: 370, proteinG: 13 }, source: { citation: 'syntetisk', verification: 'syntetisk' } } }] }]
      const basis = { weight_trend: null, training_volume: null, training_intensity: null, food_log: null, readiness: null, competition_date: null }
      assert.equal((await coachRest.from('kostplan_v1_versions').insert({ id: version, plan_id: plan, version_no: 1, effective_from: today,
        basis_as_of: today, calculation_basis: basis, rationale: 'Syntetisk plan fra før i nat', goal: 'vedligehold', intensity: 0.5, meals })).error, null)
      assert.equal((await coachRest.from('kostplan_v1_approvals').insert({ version_id: version, approval_kind: 'coach' })).error, null)
      assert.ok(await approvedPlan(clientFor(athlete)), 'atleten ser den godkendte plan i dag')
      for (const table of [...U7_TABLES, ...U8_TABLES]) assert.ok(!(await tables()).includes(table), table)
      const old = clientFor(athlete)
      assert.equal((await readDaily({ client: old, athleteId: ATHLETES.mine, from: today, to: today })).state, 'missing')
      assert.equal(await saveDaily({ client: old, athleteId: ATHLETES.mine, date: today, patch: { water_ml: 250 } }), 'missing')
      assert.equal((await readPushSetup({ client: old })).status, 'missing')
    })

    // ===== Trin 1: U7-pakken (B og C). =====
    await t.test('U7-pakken kører på produktionens skema, rører ikke kostplanen, og første mål kommer fra athletes', async () => {
      const before = (await db.query('select count(*)::int n from public.kostplan_v1_plans')).rows[0].n
      await rehearsal.step('u7Up')
      for (const table of U7_TABLES) assert.ok((await tables()).includes(table), table)
      assert.equal((await db.query('select count(*)::int n from public.kostplan_v1_plans')).rows[0].n, before)
      const seeded = (await db.query(`select athlete_id, kcal, protein_g, water_ml, set_by, effective_from::text d
        from public.nutrition_targets_v1 order by athlete_id`)).rows
      assert.deepEqual(seeded, [
        { athlete_id: ATHLETES.mine, kcal: 2800, protein_g: 180, water_ml: null, set_by: coach.id, d: today },
        { athlete_id: ATHLETES.unclaimed, kcal: null, protein_g: 120, water_ml: null, set_by: coach.id, d: today },
        { athlete_id: ATHLETES.coachSelf, kcal: 3000, protein_g: 200, water_ml: null, set_by: coach.id, d: today },
        { athlete_id: ATHLETES.other, kcal: 2500, protein_g: 150, water_ml: null, set_by: otherCoach.id, d: today },
      ].sort((a, b) => a.athlete_id.localeCompare(b.athlete_id)))
    })

    await t.test('efter U7: atleten gemmer og læser sin dag; coachen ser den; andre ser intet', async () => {
      const mine = clientFor(athlete)
      assert.equal(await saveDaily({ client: mine, athleteId: ATHLETES.mine, date: today, patch: { sleep_quality: 4, pain: 3 } }), 'saved')
      assert.equal(await saveDaily({ client: mine, athleteId: ATHLETES.mine, date: today, patch: { water_ml: 750, pain_location: 'venstre knæ' } }), 'saved')
      assert.equal(await saveDaily({ client: mine, athleteId: ATHLETES.mine, date: addDays(today, -1), patch: { kost_done_at: `${addDays(today, -1)}T20:00:00.000Z` } }), 'saved')
      const own = await readDaily({ client: mine, athleteId: ATHLETES.mine, from: addDays(today, -1), to: today })
      assert.equal(own.state, 'ready')
      assert.deepEqual(own.rows.map(r => [r.logged_date, r.sleep_quality, r.pain, r.pain_location, r.water_ml]),
        [[addDays(today, -1), null, null, null, null], [today, 4, 3, 'venstre knæ', 750]])
      assert.equal(await appendTarget({ client: mine, athleteId: ATHLETES.mine, day: today, fields: { water_ml: 3000 } }), 'saved')
      assert.equal(await appendTarget({ client: mine, athleteId: ATHLETES.mine, day: today, fields: { kcal: 9000 } }), 'error', 'atleten må ikke sætte kcal')
      const coachSees = await readDaily({ client: clientFor(coach), athleteId: ATHLETES.mine, from: today, to: today })
      assert.equal(coachSees.rows.length, 1)
      assert.equal(await appendTarget({ client: clientFor(coach), athleteId: ATHLETES.mine, day: today, fields: { kcal: 2900, protein_g: 185 } }), 'saved')
      const targets = await readTargets({ client: clientFor(coach), athleteIds: [ATHLETES.mine] })
      assert.equal(targets.state, 'ready')
      assert.equal(targets.rows.length, 3)
      // En anden atlet og en anden coach: ingen rækker, og skrivning afvises.
      for (const stranger of [otherAthlete, otherCoach]) {
        const c = clientFor(stranger)
        assert.deepEqual((await readDaily({ client: c, athleteId: ATHLETES.mine, from: today, to: today })).rows, [])
        assert.deepEqual((await readTargets({ client: c, athleteIds: [ATHLETES.mine] })).rows, [])
        assert.equal(await saveDaily({ client: c, athleteId: ATHLETES.mine, date: addDays(today, -3), patch: { pain: 9 } }), 'error')
      }
      // Coachens egen træning (coachen er også atlet): skriver sin egen dag.
      assert.equal(await saveDaily({ client: clientFor(coach), athleteId: ATHLETES.coachSelf, date: today, patch: { sleep_quality: 5 } }), 'saved')
      assert.ok(await approvedPlan(clientFor(athlete)), 'kostplanen virker stadig')
    })

    await t.test('en fane, der var åben før U7, bliver ved at bruge telefonen, til den genindlæses', async () => {
      const old = clientFor(athlete)
      forgetTableState(old)
      // Simulerer fanen fra før: dens første prøve så tabellen mangle.
      const before = clientFor(athlete)
      await rehearsal.rest.exec('alter table public.tracking_daily_v1 rename to tracking_daily_v1_skjult')
      assert.equal(await saveDaily({ client: before, athleteId: ATHLETES.mine, date: today, patch: { water_ml: 1000 } }), 'missing')
      await rehearsal.rest.exec('alter table public.tracking_daily_v1_skjult rename to tracking_daily_v1')
      assert.equal(await saveDaily({ client: before, athleteId: ATHLETES.mine, date: today, patch: { water_ml: 1000 } }), 'missing', 'samme fane husker "mangler"')
      assert.equal(await saveDaily({ client: clientFor(athlete), athleteId: ATHLETES.mine, date: today, patch: { water_ml: 1000 } }), 'saved', 'ny indlæsning gemmer')
    })

    // ===== Trin 2: U8-pakken (D) og nøglerne. =====
    await t.test('U8-pakken kører; uden nøgle er push skjult; med nøgle slår atleten til og fra', async () => {
      await rehearsal.step('u8Up')
      for (const table of U8_TABLES) assert.ok((await tables()).includes(table), table)
      assert.equal((await readPushSetup({ client: clientFor(athlete) })).status, 'missing', 'tabel uden nøgle: som U7')
      keysSet = true
      const mine = clientFor(athlete)
      const setup = await readPushSetup({ client: mine })
      assert.equal(setup.status, 'ready')
      const device = phone('https://push.example.test/generalproeve-atlet')
      assert.equal(await enablePush({ client: mine, ...device, publicKey: setup.publicKey, time: '07:30', userAgent: 'generalprøve' }), 'on')
      assert.equal(await saveTime({ client: mine, time: '19:00' }), 'saved')
      const again = await readPushSetup({ client: clientFor(athlete) })
      assert.equal(again.prefs.remind_at.slice(0, 5), '19:00')
      assert.deepEqual(again.endpoints, ['https://push.example.test/generalproeve-atlet'])
      // Andre ser ingen tilmelding og kan ikke slette den.
      const other = clientFor(otherAthlete)
      assert.deepEqual((await readPushSetup({ client: other })).endpoints, [])
      await other.from('push_subscriptions_v1').delete().eq('endpoint', 'https://push.example.test/generalproeve-atlet')
      assert.equal(await count('push_subscriptions_v1'), 1)
      const anon = new PostgrestClient(`${server.url}/rest/v1`, { headers: { apikey: 'anon-proeve' } })
      for (const table of U8_TABLES) assert.ok((await anon.from(table).select('*')).error, `anon må ikke læse ${table}`)
      assert.ok((await mine.from('push_log_v1').select('*')).error, 'loggen er kun for funktionen')
      // Slå fra og til igen.
      assert.equal(await disablePush({ client: mine, registration: device.registration }), 'off')
      assert.equal(await count('push_subscriptions_v1'), 0)
      assert.equal(await enablePush({ client: mine, ...device, publicKey: setup.publicKey, time: '19:00', userAgent: 'generalprøve' }), 'on')
    })

    await t.test('edge-funktionen sender påmindelse og coachsvar med service_role mod pakke D', async () => {
      // Påmindelsen gælder nu: tidspunktet sættes til kvarteret lige før.
      const { minute } = danishNow()
      const quarter = Math.max(6 * 60, Math.min(22 * 60, minute - (minute % 15)))
      await db.query(`update public.push_preferences_v1 set remind_at = make_time($1, $2, 0) where user_id = $3`,
        [Math.floor(quarter / 60), quarter % 60, athlete.id])
      await db.query(`insert into public.messages (athlete_id, sender_role, content) values ($1, 'coach', 'Syntetisk svar')`, [ATHLETES.mine])
      const cron = { 'x-u8-cron': secrets.U8_CRON_SECRET }
      const run = async () => (await fn(new Request(`${server.url}/functions/v1/u8-push`, { method: 'POST', headers: cron, body: JSON.stringify({ action: 'send' }) }))).json()
      const first = await run()
      if (minute >= 6 * 60 && minute < 22 * 60 + 15) assert.equal(first.reminders, 1, JSON.stringify(first))
      assert.equal(first.replies, 1, JSON.stringify(first))
      assert.equal(first.failed, 0, JSON.stringify(first))
      const second = await run()
      assert.deepEqual([second.reminders, second.replies, second.sent], [0, 0, 0], 'ingen dobbeltafsendelse')
      assert.ok(pushed.length >= 1)
    })

    // ===== Tilbagerulning: D, så U7. =====
    await t.test('tilbagerulning af D: push skjules igen; U7-data og kostplanen bliver', async () => {
      const openTab = clientFor(athlete)
      assert.equal((await readPushSetup({ client: openTab })).status, 'ready')
      await rehearsal.step('u8Down')
      for (const table of U8_TABLES) assert.ok(!(await tables()).includes(table), table)
      assert.equal((await readPushSetup({ client: clientFor(athlete) })).status, 'missing')
      // Den åbne fane: et tryk på "Slå til" giver en fejl, ikke et nedbrud, og næste læsning skjuler kortet.
      assert.equal(await saveTime({ client: openTab, time: '20:00' }), 'error')
      assert.equal((await readPushSetup({ client: openTab })).status, 'missing')
      assert.ok(await count('tracking_daily_v1') >= 2)
      assert.ok(await approvedPlan(clientFor(athlete)))
    })

    await t.test('tilbagerulning af U7: B og C væk, kostplanen og dens rækker bliver, appen falder tilbage', async () => {
      const plans = await count('kostplan_v1_plans')
      await rehearsal.step('u7Down')
      for (const table of U7_TABLES) assert.ok(!(await tables()).includes(table), table)
      for (const table of KOSTPLAN_TABLES) assert.ok((await tables()).includes(table), table)
      assert.equal(await count('kostplan_v1_plans'), plans)
      assert.ok(await approvedPlan(clientFor(athlete)), 'atleten ser stadig den godkendte plan')
      assert.equal(await saveDaily({ client: clientFor(athlete), athleteId: ATHLETES.mine, date: today, patch: { water_ml: 500 } }), 'missing')
      assert.equal((await readTargets({ client: clientFor(coach), athleteIds: [ATHLETES.mine] })).state, 'missing')
    })

    await t.test('op igen efter tilbagerulning: begge pakker kører en gang til', async () => {
      await rehearsal.step('u7Up')
      await rehearsal.step('u8Up')
      assert.equal(await saveDaily({ client: clientFor(athlete), athleteId: ATHLETES.mine, date: today, patch: { water_ml: 500 } }), 'saved')
      await rehearsal.step('u8Down')
      await rehearsal.step('u7Down')
    })
  } finally {
    await server.close()
    await db.close()
  }
})

test('generalprøve: nattens filer er dem, KLAR-filen nævner, og U7-pakken indeholder ikke kostplanen', () => {
  const up = read(FILES.u7Up), down = read(FILES.u7Down)
  assert.doesNotMatch(up.replace(/--[^\n]*/g, ''), /kostplan_v1/, 'kostplanen (A) er live siden 8. nov. og må ikke oprettes igen')
  assert.doesNotMatch(down.replace(/--[^\n]*/g, ''), /kostplan_v1/, 'tilbagerulningen må aldrig fjerne den live kostplan')
})
