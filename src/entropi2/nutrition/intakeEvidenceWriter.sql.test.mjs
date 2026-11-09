import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { createFood } from '../kostplan/foedevarer/catalog.mjs'
import { createIntakeEvidenceRequest, readIntakeEvidence } from './intakeEvidence.mjs'
import { createIntakeEvidenceWriter } from './intakeEvidenceWriter.mjs'

const read = path => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')
const id = n => `8be20000-2222-4333-8444-${String(n).padStart(12, '0')}`
const athleteId = id(1), ownerId = id(2), coachId = id(3), foreignCoachId = id(4), date = '2026-11-09'
const food = createFood({ id: 'synthetic:writer:sql:v1', name: 'Synthetic SQL reference', preparation: 'cooked',
  nutrientsPer100g: { energyKcal: 208, proteinG: 16, carbohydrateG: 28, fatG: 4,
    ironMg: 3.2, calciumMg: 0, magnesiumMg: null },
  source: { citation: 'Synthetic SQL fixture, no measured intake', verification: 'unverified user reference' } })
const input = (n, patch = {}) => ({ athleteId, date, requestId: id(n), grams: 37.5,
  meal: 'Synthetic decimal portion', food, ...patch })

test('writer against actual accepted DRAFT SQL: one shared normal-role PGlite fixture', { timeout: 45000 }, async t => {
  const db = new PGlite()
  let loss = false, hold = null
  const calls = []
  const client = { async rpc(name, { p_request }) {
    assert.equal(name, 'record_meal_intake_evidence_v1')
    calls.push(JSON.stringify(p_request))
    let data
    try {
      data = (await db.query('select public.record_meal_intake_evidence_v1($1::jsonb) pair',
        [JSON.stringify(p_request)])).rows[0].pair
    } catch (e) { return { data: null, error: { code: e.code } } }
    // Actual SQL committed BEFORE transport loss or a delayed reply is simulated.
    if (loss) { loss = false; throw Error('synthetic response lost after real commit') }
    if (hold) await hold()
    return { data, error: null }
  } }
  let context = { enabled: true, writable: true, ownerId: coachId, athleteId, date, generation: 1, client }
  const writer = () => createIntakeEvidenceWriter({ enabled: true, client, getCurrentContext: () => context })
  const login = async uid => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [uid, JSON.stringify({ sub: uid, email: 'writer-coach@synthetic.invalid' })])
    await db.exec('set role authenticated')
  }
  const state = async () => {
    const out = {}
    for (const table of ['meal_logs', 'meal_intake_evidence_v1', 'meal_intake_requests_v1'])
      out[table] = (await db.query(`select to_jsonb(r) value from public.${table} r order by to_jsonb(r)::text`)).rows.map(r => r.value)
    return out
  }
  const fresh = async requestId => ({
    mealLog: (await db.query('select to_jsonb(m) value from public.meal_logs m where id=$1', [requestId])).rows[0]?.value,
    evidence: (await db.query('select to_jsonb(e) value from public.meal_intake_evidence_v1 e where request_id=$1', [requestId])).rows[0]?.value,
  })
  try {
    // Reuse verbatim the accepted public fixture; never create a second SQL oracle.
    const matches = [...read('src/entropi2/nutrition/intakeEvidence.sql.test.mjs')
      .matchAll(/await db\.exec\(`(create role anon[\s\S]*?)`\)/g)]
    assert.equal(matches.length, 1)
    await db.exec(matches[0][1])
    await db.query('insert into public.athletes(id,user_id,coach_id,email) values($1,$2,$3,$4)',
      [athleteId, ownerId, coachId, 'writer-owner@synthetic.invalid'])
    await db.exec(read('supabase/sql/udkast/20261104211000_kostplan_v1_DRAFT.sql'))
    await db.exec(read('supabase/sql/udkast/meal_intake_evidence_v1_DRAFT.sql'))
    await login(coachId)
    const actor = (await db.query(`select current_user actor,auth.uid() uid,r.rolsuper,r.rolbypassrls,
      (select bool_or(pg_get_userbyid(relowner)=current_user) from pg_class
        where oid in ('public.meal_logs'::regclass,'public.meal_intake_evidence_v1'::regclass,'public.meal_intake_requests_v1'::regclass)) owns_tables
      from pg_roles r where rolname=current_user`)).rows[0]
    assert.deepEqual(actor, { actor: 'authenticated', uid: coachId, rolsuper: false, rolbypassrls: false, owns_tables: false })

    await t.test('actual to_jsonb exact echo, decimal grams, known zero/null and canonical source', async () => {
      const w = writer(), raw = input(10), s = await w.submit(raw), p = await fresh(raw.requestId)
      assert.equal(s.status, 'success')
      assert.deepEqual(s.value, readIntakeEvidence(p.mealLog, p.evidence, { athleteId, date }))
      assert.equal(typeof p.evidence.grams, 'number'); assert.equal(typeof p.mealLog.date, 'string')
      assert.equal(s.value.grams, raw.grams); assert.deepEqual(s.value.food, createIntakeEvidenceRequest(raw).food)
      assert.ok(Math.abs(s.value.nutrients.ironMg - 1.2) < 1e-12)
      assert.equal(s.value.nutrients.calciumMg, 0); assert.equal(s.value.nutrients.magnesiumMg, null)
      const once = await state(), beforeCalls = calls.length
      assert.equal((await w.submit(raw)).status, 'success'); assert.equal(calls.length, beforeCalls)
      assert.deepEqual(await state(), once)
      w.dispose()
    })

    await t.test('commit THEN lost reply; explicit same bytes/UUID retry preserves all three tables', async () => {
      const w = writer(), raw = input(11), before = await state()
      loss = true
      assert.equal((await w.submit(raw)).status, 'uncertain')
      const once = await state()
      for (const table of Object.keys(before)) assert.equal(once[table].length, before[table].length + 1)
      assert.equal(w.prepare(input(12)).status, 'blocked')
      assert.equal(w.prepare(input(11, { grams: 38 })).status, 'conflict')
      assert.equal((await w.retry()).status, 'success')
      assert.equal(calls.at(-1), calls.at(-2))
      assert.deepEqual(await state(), once, 'identity, contents, timestamps and request count unchanged')
      w.dispose()
    })

    for (const action of ['edit', 'delete']) await t.test(`old parent ${action}: real 23505, no resurrection`, async () => {
      const w = writer(), raw = input(action === 'edit' ? 20 : 21)
      loss = true; assert.equal((await w.submit(raw)).status, 'uncertain')
      if (action === 'edit') await db.query("update public.meal_logs set meal='Allowed old parent edit' where id=$1", [raw.requestId])
      else await db.query('delete from public.meal_logs where id=$1', [raw.requestId])
      const changed = await state(), p = await fresh(raw.requestId)
      assert.equal(readIntakeEvidence(p.mealLog, p.evidence, { athleteId, date }), null)
      if (action === 'delete') {
        assert.equal(p.mealLog, undefined); assert.equal(p.evidence, undefined)
        assert.ok(changed.meal_intake_requests_v1.some(r => r.request_id === raw.requestId))
      }
      assert.equal((await w.retry()).status, 'conflict')
      assert.deepEqual(await state(), changed)
      assert.equal(w.prepare(input(22)).status, 'blocked', 'possible earlier commit still needs caller reconciliation')
      w.dispose()
    })

    await t.test('foreign coach real denial, UUID collision real conflict, and date context rejects before RPC', async () => {
      const before = await state()
      await login(foreignCoachId)
      context = { ...context, ownerId: foreignCoachId, generation: 2 }
      const foreign = writer()
      assert.equal((await foreign.submit(input(30))).status, 'denied')
      foreign.dispose(); await login(coachId)
      context = { ...context, ownerId: coachId, generation: 3 }
      assert.deepEqual(await state(), before)
      const collision = writer()
      assert.equal((await collision.submit(input(10, { meal: 'Changed under existing UUID' }))).status, 'conflict')
      assert.deepEqual(await state(), before)
      const count = calls.length, wrongDate = writer()
      assert.equal((await wrongDate.submit(input(31, { date: '2026-11-08' }))).status, 'invalid')
      assert.equal(calls.length, count); assert.deepEqual(await state(), before)
      collision.dispose(); wrongDate.dispose()
    })

    await t.test('scope retirement after actual commit hides reply; server rows can already exist', async () => {
      let release, committed
      const gate = new Promise(r => { release = r }), reached = new Promise(r => { committed = r })
      hold = async () => { committed(); await gate }
      const w = writer(), pending = w.submit(input(40))
      await reached
      context = { ...context, generation: 4 }
      release()
      assert.deepEqual(await pending, { status: 'retired', mayHaveCommitted: true })
      hold = null
      const p = await fresh(id(40)); assert.ok(readIntakeEvidence(p.mealLog, p.evidence, { athleteId, date }))
      assert.equal((await w.retry()).status, 'retired')
    })

    await t.test('synthetic unavailable metadata transport, not real server contract uninstall', async () => {
      const before = await state(), noContract = { async rpc() { return { data: null, error: { code: 'PGRST202' } } } }
      context = { ...context, client: noContract, generation: 5 }
      const w = createIntakeEvidenceWriter({ enabled: true, client: noContract, getCurrentContext: () => context })
      assert.equal((await w.submit(input(50))).status, 'unavailable')
      assert.deepEqual(await state(), before)
      w.dispose()
    })
    t.diagnostic('Actual RPC SQL JSON only; no PostgREST, production, INSERT RETURNING * or multiconnection stress claim.')
  } finally {
    await db.close()
    t.diagnostic('ONE_SYNTHETIC_PGLITE_CLOSED')
  }
})
