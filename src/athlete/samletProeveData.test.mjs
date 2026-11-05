// Supplemental actual-module fixture checks. These do not replace React SSR.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scenario, tabs } from './samletProeveData.mjs'
import { homeModel } from '../entropi2/home/homeModel.mjs'
import { volumeModel } from '../entropi2/volume/volumeModel.mjs'
import { profileModel } from '../entropi2/profile/profileModel.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const modes = ['athlete', 'preview', 'own']

test('every shared snapshot uses existing host state and distinct production role identities', () => {
  const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  const names = new Set([...source.matchAll(/const \[([\w]+),\s*[^\]]+\] = useState\(/g)].map(match => match[1]))
  for (const mode of modes) for (const tab of tabs) for (const state of ['ready', 'empty', 'loading', 'error']) {
    const { seed, props } = scenario(mode, tab, state)
    for (const key of Object.keys(seed)) assert.ok(names.has(key), `Invented host state: ${key}`)
    assert.equal(props.entropi2, true)
    assert.equal(props.role, mode === 'athlete' ? 'athlete' : 'coach')
    if (state === 'ready') {
      assert.equal(seed.currentWeek.athlete_id, seed.athlete.id)
      assert.equal(seed.exerciseLogs[0].athlete_id, seed.athlete.id)
      assert.equal(seed.athlete.user_id === props.session.user.id, mode !== 'preview')
    }
  }
})

test('actual Home model accepts each production-shaped ready/empty/error fixture', () => {
  for (const mode of modes) {
    const seed = scenario(mode, 'hjem').seed
    const ready = homeModel({ ...seed, now })
    assert.equal(ready.kind, 'today')
    assert.equal(ready.target.session.id, 'synthetic-session')
    assert.equal(ready.logged, 1)
    assert.equal(ready.total, 3)
    assert.equal(homeModel({ ...scenario(mode, 'hjem', 'empty').seed, now }).kind, 'no-program')
    assert.equal(homeModel({ ...seed, now, programError: true }).kind, 'missing')
    const done = [1, 2, 3].map(set_number => ({ ...seed.exerciseLogs[0], set_number }))
    assert.equal(homeModel({ ...seed, now, exerciseLogs: done }).kind, 'done')
  }
})

test('actual Volume model counts fixture sets and keeps missing/loading/error separate', () => {
  for (const mode of modes) {
    const seed = scenario(mode, 'volumen').seed
    const ready = volumeModel({ ...seed, now, volumeLoading: false })
    assert.equal(ready.state, 'ready')
    assert.equal(ready.empty, false)
    assert.ok(ready.rows.some(row => row.current > 0))
    assert.equal(volumeModel({ volumeLogs: [], volumeLoading: false, now }).empty, true)
    assert.equal(volumeModel({ volumeLogs: null, volumeLoading: false, now }).state, 'unavailable')
    assert.equal(volumeModel({ volumeLoading: true, now }).state, 'loading')
    // AthleteView now forwards the reader's explicit error state.
    assert.equal(volumeModel({ volumeError: true, now }).state, 'error')
  }
})

test('actual Profile model displays existing targets and honest missing values', () => {
  for (const mode of modes) {
    const model = profileModel(scenario(mode, 'profil').seed.athlete)
    assert.equal(model.name, 'Testfornavn Testefternavn')
    assert.equal(model.goal, 'Testmål')
    assert.match(model.kcal, /2.400 kcal/)
    assert.equal(model.protein, '150 g')
  }
  assert.equal(profileModel({}).goal, 'Intet mål angivet endnu')
  assert.equal(profileModel({}).kcal, 'Ikke angivet endnu')
})
