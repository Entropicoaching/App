// Ordre 1564: blokkens datoer står ét sted på Program, også første gang "Din blok" er åben.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { renderProgramBlokslut, programBlokslutModel, selectProgramBlock, blokhovedViserDatoen } from '../entropi2/analysis/blokslut/programBlokslut.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const weeks = ['2026-10-26', '2026-11-02'].map((start_date, i) => ({ id: `d-w${i}`, week_number: i + 1, start_date, block_name: 'Basis',
  sessions: [{ id: `d-s${i}`, exercises: [{ id: `d-e${i}`, name: 'Bench', sets: 1 }] }] }))
const block = selectProgramBlock(weeks, '2026-11-09')
const model = await programBlokslutModel({ athleteId: 'syntetisk', block, now: '2026-11-09', readPage: () => ({ data: [] }) })
const page = (open, skjulDato) => renderToStaticMarkup(createElement('div', null,
  createElement(Program, programQolFixture({ allWeeks: weeks, viewingWeekIdx: 1 })),
  renderProgramBlokslut(createElement, model, { open, skjulDato })))
const datoer = html => (html.match(/26\.10\.2026–08\.11\.2026|26\. okt\.? til 8\. nov\.?/g) || []).length

test('Din blok gentager ikke blokhovedets datoer, første gang eller bagefter', () => {
  assert.equal(blokhovedViserDatoen(weeks, model), true)
  for (const open of [true, false]) {
    const html = page(open, blokhovedViserDatoen(weeks, model))
    assert.equal(datoer(html), 1, 'datoteksten findes én gang')
    assert.match(html, /Gennemførte pas/)
  }
})
test('Din blok viser datoerne, når blokhovedet viser en anden blok', () => {
  assert.equal(blokhovedViserDatoen([{ start_date: '2026-11-09' }], model), false)
  assert.match(renderToStaticMarkup(renderProgramBlokslut(createElement, model, { open: true, skjulDato: false })), /26\.10\.2026–08\.11\.2026/)
})
