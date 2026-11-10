import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './trin1Loader.mjs'
const hooks = install()
const catalog = JSON.parse(readFileSync(new URL('./trin1Flagoversigt.json', import.meta.url), 'utf8'))
const saved = { location: globalThis.location, window: globalThis.window, localStorage: globalThis.localStorage }
const emptyStorage = { getItem: () => null }
globalThis.location = { search: '' }
globalThis.window = { location: { search: '', href: 'https://synthetic.invalid/' }, localStorage: emptyStorage }
globalThis.localStorage = emptyStorage
const root = new URL('../', import.meta.url)
const { trin1AppData2, UDGIVELSE_TRIN } = await import('./udgivelseTrin.mjs')
const data = await import('./dataEnough.mjs')

test('profile accepts supported release steps and step 1 only activates appData2 for every URL', () => {
  assert.ok([0, 1].includes(UDGIVELSE_TRIN))
  assert.equal(data.dataEnoughEnabled(), UDGIVELSE_TRIN === 1)
  for (const search of ['', '?x=1', '?appData2=0', '?appData2=true']) {
    assert.equal(trin1AppData2(search, 0), false)
    assert.equal(trin1AppData2(search, 1), true)
  }
  for (const trin of [false, true, '1', 2, null]) assert.equal(trin1AppData2('', trin), false)
  assert.equal(trin1AppData2('?appData2=1', 0), true)
  assert.equal(trin1AppData2('?appData2=0&appData2=1', 0), false, 'legacy first-value parsing')
  assert.equal(data.withDataEnoughFlag('/program'), UDGIVELSE_TRIN === 1 ? '/program?appData2=1' : '/program')
  globalThis.location.search = '?appData2=1'
  assert.equal(data.withDataEnoughFlag('/program?week=2'), '/program?week=2&appData2=1')
  globalThis.location.search = ''
})

for (const row of catalog.filter(row => row.probe)) {
  test(`default OFF actual import: ${row.name}`, async () => {
    const module = await import(new URL(row.module, root))
    assert.equal(module[row.probe], false, row.module + ':' + row.probe)
  })
}

test('actual URL and storage readers remain OFF without intervention', async () => {
  const gates = [
    ['rel1030.mjs', 'rel1030Enabled'], ['coachRyd.mjs', 'coachRydEnabled'],
    ['dashboard/coachWeekOverview.mjs', 'coachWeekFlag'], ['dashboard/coachNotes.mjs', 'coachNotesFlag'],
    ['dashboard/coachFollowUp.mjs', 'coachFollowUpFlag'], ['dashboard/coachMeetSoon.mjs', 'coachMeetSoonFlag'],
    ['dashboard/coachMorningSource.mjs', 'coachMorningFlag'], ['dashboard/profileWeekSummary.mjs', 'profileWeekFlag'],
    ['dashboard/analyseConclusion.mjs', 'analyseConclusionEnabled'], ['dashboard/analyseSamlet.mjs', 'analyseSamletEnabled'],
    ['dashboard/analyseSammenlign.mjs', 'analyseSammenlignEnabled'],
  ]
  for (const [path, name] of gates) assert.equal((await import(new URL(path, import.meta.url)))[name](''), false)
  for (const [path, name] of [
    ['athlete/videoFeedbackPlayback.mjs', 'videoFeedbackPlaybackEnabled'],
    ['videoMarkerReplies.mjs', 'markerRepliesEnabled'], ['dashboard/videoReviewLayout.mjs', 'readVideoReviewFlag'],
    ['athlete/contactLatest.mjs', 'contactLatestEnabled'],
  ]) assert.equal((await import(new URL(path, import.meta.url)))[name](emptyStorage, ''), false)
  // U4 (ordre 68) har tændt uploadmodulet med "Prøv igen" for alle.
  assert.equal((await import('./videoUploadRetry.mjs')).videoUploadRetryEnabled(), true)
  assert.equal((await import('./e2eTestFlags.mjs')).fridayTestEnabled('production', window.location.href), false)
  assert.deepEqual((await import('./release3TestFlags.mjs')).release3TestFlags('production', window.location.href), { athlete: {}, coach: {} })
})

test('catalog identifies actual prop defaults and complete launch table', () => {
  assert.equal(new Set(catalog.map(row => row.name)).size, catalog.length)
  for (const row of catalog.filter(row => !row.probe && row.module.endsWith('.jsx'))) {
    // Prop declarations have no exported flag constant. Component behavior is
    // exercised separately for Program; root wiring is inspected as source.
    const source = readFileSync(new URL(row.module, root), 'utf8')
    assert.match(source, new RegExp('\\b' + row.name + '\\s*=\\s*false\\b'))
  }
  for (const name of ['appData2', 'rel1030', 'VIDEO_SLET', 'videoSetSelection', 'VIDEO_STORAGE_USAGE_ENABLED',
    'enkelPrototype', 'forenklinger', 'mobilitetCoach', 'mobilitetHjemme', 'coachRyd', 'analyseSamlet',
    'vc-svar1', 'VIDEO_QUEUE_WAIT_ENABLED']) assert.ok(catalog.some(row => row.name === name))
})

test.after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
  hooks.deregister()
})
