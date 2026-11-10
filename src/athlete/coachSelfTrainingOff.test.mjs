import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { withoutU2 } from './u2AthleteViewLine.mjs'
import { withoutU3 } from './u3AthleteViewLine.mjs'
import { invertCoachSelfTraining, coachSelfSourceDeltas, invertTrainingSetWrites, coachSelfSetDeltas } from './coachSelfTrainingOffFixture.mjs'
const source = withoutU3(withoutU2(readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8'))).replace(/\r\n/g, '\n')
const hash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex')
const baselineHash = "6c2deb31ac020fc1ad02e3866e7eeeb74a8bad52b97e44c3b646049df03b9cb8"
test('OFF fixture restores the exact pinned production AthleteView, in LF and CRLF', () => {
  assert.equal(hash(invertCoachSelfTraining(source)), baselineHash)
  assert.equal(hash(invertCoachSelfTraining(source.replace(/\n/g, '\r\n'))), baselineHash)
})
test('OFF fixture rejects each missing, duplicate and independently changed hotfix hunk', () => {
  for (const [added] of coachSelfSourceDeltas) {
    assert.throws(() => invertCoachSelfTraining(source.replace(added, '')), /Exact coach self-training/)
    assert.throws(() => invertCoachSelfTraining(source + added), /Exact coach self-training/)
    assert.throws(() => invertCoachSelfTraining(source.replace(added, added.replace(/\w/, 'X'))), /Exact coach self-training/)
  }
})
test('OFF fixture cannot erase unrelated legacy changes or unknown source/module additions', () => {
  for (const mutated of [source.replace("const indbakke2 =", "const brokenInbox ="),
    source + "\nimport unknown from './unknown.mjs'\n", source.replace("weightInput,", "unrelatedWeightInput,"),
    source.replace("'hjem', 'program', 'mobilisering', 'fremgang'", "'kost'")]) {
    try { assert.notEqual(hash(invertCoachSelfTraining(mutated)), baselineHash) }
    catch (error) { assert.match(error.message, /Exact coach self-training/) }
  }
})

test('OFF set-writer fixture restores the pinned production writer and rejects every altered delta', () => {
  const writer = readFileSync(new URL('./saetSkrivning.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.equal(hash(invertTrainingSetWrites(writer)), "decdcc9ecc76bf86f7c52888807b915e7e45177d4a44aa99254c47ed57c59280")
  for (const [added] of coachSelfSetDeltas) {
    for (const mutant of [writer.replace(added, ''), writer + added, writer.replace(added, added.replace(/\w/, 'X'))])
      assert.throws(() => invertTrainingSetWrites(mutant), /Exact coach self-training writer delta/)
  }
  assert.notEqual(hash(invertTrainingSetWrites(writer + '\n// unexpected change\n')), hash(invertTrainingSetWrites(writer)))
})
