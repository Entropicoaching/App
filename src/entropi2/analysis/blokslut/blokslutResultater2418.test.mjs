// Ordre 2418: Dine resultater viser løft før og nu, kropsvægt før og nu og gennemførte pas; mangler en kilde, udelades linjen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { blokslutModel } from './blokslutModel.mjs'
import { programBlokslutModel, readBlokslutWeights, renderProgramBlokslut } from './programBlokslut.mjs'
import { snapshot } from './blokslutFixture.mjs'

// Blok 19.10-08.11, nu = 4. nov. (uge 3 er i gang): før = 19.-25. okt., nu = 29. okt.-4. nov.
const w = (logged_at, weight) => ({ logged_at, weight })
const model = weightLogs => blokslutModel(snapshot({ weightLogs }))
const html = m => renderToStaticMarkup(renderProgramBlokslut(createElement, m, { open: true, onRetry() {} }))

test('kropsvægt: første uge mod de sidste 7 dage, nyeste og ældste log på hver side', () => {
  const m = model([w('2026-10-20', '82,0'), w('2026-10-22', 81.5), w('2026-10-31', 80.4), w('2026-11-03', '80,0')])
  assert.deepEqual(m.weight, { before: 82, now: 80, delta: -2 })
})

test('kropsvægt udelades uden begge sider, med én dag eller uden gyldige tal', () => {
  assert.equal(model(undefined).weight, null)
  assert.equal(model([]).weight, null)
  assert.equal(model([w('2026-10-20', 82)]).weight, null)
  assert.equal(model([w('2026-11-03', 80)]).weight, null)
  assert.equal(model([w('2026-11-03', 80), w('2026-10-31', 80)]).weight, null, 'ingen log i første uge')
  assert.equal(model([w('2026-10-20', 'x'), w('2026-11-03', 80)]).weight, null)
  assert.equal(model([w('2026-10-20', 5), w('2026-11-03', 80)]).weight, null, 'urimelig vægt tæller ikke')
  assert.equal(model([w('2026-10-20', 82), w('2026-11-05', 79)]).weight, null, 'log efter opgørelsesdagen tæller ikke')
  assert.equal(model([w('2026-10-20', 82), w('2026-10-27', 81)]).weight, null, 'midt i blokken er ikke de sidste 7 dage')
})

test('kortet viser før og nu for løft og vægt samt pas; ingen vægtlinje uden data', () => {
  const m = model([w('2026-10-20', 82), w('2026-11-03', 80.5)])
  const card = html(m)
  assert.match(card, /Dine resultater/)
  assert.match(card, /Gennemførte pas: 3 af 3/)
  assert.match(card, /Squat: 110 → 121 kg \(\+11\)/)
  assert.match(card, /Kropsvægt: 82 → 80,5 kg\./)
  assert.doesNotMatch(html(model(undefined)), /Kropsvægt/)
})

test('et løft uden fremgang vises uden plus, og uden sammenlignelige sæt står der ingen tal', () => {
  const m = model(undefined)
  m.lifts[0] = { ...m.lifts[0], delta: -5, current: { ...m.lifts[0].current, value: 105 } }
  assert.match(html(m), /Squat: 110 → 105 kg \(-5\)/)
  const none = html({ ...m, lifts: m.lifts.map(l => ({ ...l, delta: null })) })
  assert.match(none, /Styrkefremgang kan endnu ikke sammenlignes sikkert/)
  assert.doesNotMatch(none, /→/)
})

test('visningsvinduet: kortet findes kun i blokkens sidste uge og 7 dage efter', async () => {
  const { selectProgramBlock } = await import('./programBlokslut.mjs')
  const weeks = ['2026-10-19', '2026-10-26', '2026-11-02'].map((start_date, i) => ({ id: 'u' + i, start_date, block_name: 'Styrke' }))
  assert.equal(selectProgramBlock(weeks, '2026-11-01'), null, 'før sidste uge')
  assert.ok(selectProgramBlock(weeks, '2026-11-02'), 'første dag i sidste uge')
  assert.ok(selectProgramBlock(weeks, '2026-11-15'), 'sidste dag, 7 dage efter blokkens slut')
  assert.equal(selectProgramBlock(weeks, '2026-11-16'), null, 'dagen efter vinduet')
})

test('vægtlæsningen følger atletten, sider og fejl giver ingen vægtlinje', async () => {
  const block = { start_date: '2026-10-19', end_date: '2026-11-08' }
  const pages = []
  const rows = await readBlokslutWeights('atlet-x', block, (from, to) => {
    pages.push([from, to])
    return { data: from ? [w('2026-11-03', 80)] : Array.from({ length: 500 }, () => w('2026-10-20', 82)) }
  })
  assert.equal(rows.length, 501); assert.deepEqual(pages, [[0, 499], [500, 999]])
  assert.equal(await readBlokslutWeights('atlet-x', block, () => ({ error: { message: 'raw' } })), null)
  assert.equal(await readBlokslutWeights('atlet-x', block, () => { throw Error('raw') }), null)
  assert.equal(await readBlokslutWeights('', block, () => ({ data: [] })), null)
  const full = snapshot()
  const ok = await programBlokslutModel({ athleteId: 'atlet-x', block: full.block, now: full.now,
    readPage: () => ({ data: full.exerciseLogs }), readWeightPage: () => { throw Error('raw') } })
  assert.equal(ok.status, 'ready'); assert.equal(ok.weight, null)
  assert.equal(ok.lifts[0].delta, 11, 'vægtfejl vælter ikke løftene')
})
