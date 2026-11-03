// K-R10 fund 2: tidsfeedback skal bevare den valgte videos identitet (analysis.id) i den gemte
// besked, sammen med den læsevenlige etiket (løft, dato) og tidspunktet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { timestampContent } from './conversationModel.mjs'

const a = { id: 'syn-analyse-a', lift: 'squat', created_at: '2026-11-02T08:00:00Z' }
const b = { id: 'syn-analyse-b', lift: 'squat', created_at: '2026-11-02T17:30:00Z' }

test('R11: to squatvideoer samme dag giver forskellige gemte referencer', () => {
  const first = timestampContent(a, 3.5, 'Hold brystet oppe i bunden.')
  const second = timestampContent(b, 3.5, 'Hold brystet oppe i bunden.')
  assert.notEqual(first, second)
  assert.match(first, /syn-analyse-a/); assert.match(second, /syn-analyse-b/)
})

test('R11: beskeden har etiket, tidspunkt, tekst og video-id i fast rækkefølge', () => {
  const lines = timestampContent(a, 3.5, '  Hold brystet oppe i bunden.  ').split('\n')
  assert.equal(lines.length, 3)
  assert.match(lines[0], /^Squat-video 2\. nov\.? ved 3,5 s$/)
  assert.equal(lines[1], 'Hold brystet oppe i bunden.')
  assert.equal(lines[2], 'Video-id: syn-analyse-a')
})

test('R11: ugyldig video, tid eller tekst afvises fortsat', () => {
  for (const [row, seconds, text] of [[null, 1, 'x'], [{ id: 'ugyldigt id' }, 1, 'x'], [a, -1, 'x'], [a, 7200, 'x'],
    [a, Number.NaN, 'x'], [a, 1, '   '], [a, 1, 'x'.repeat(601)]])
    assert.throws(() => timestampContent(row, seconds, text), /Vælg video/)
})
