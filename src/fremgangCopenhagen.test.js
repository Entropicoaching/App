import { test } from 'node:test'
import process from 'node:process'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const progressUrl = new URL('./exerciseProgress.js', import.meta.url).href
const coachUrl = new URL('./coachFremgang.js', import.meta.url).href
const weekUrl = new URL('./dashboard/coachUgeFeedback.js', import.meta.url).href

function inZone(timeZone, body) {
  const script = `
    import assert from 'node:assert/strict'
    import { bestHeavySetPerDay } from ${JSON.stringify(progressUrl)}
    import { lokalDag, smerteNoter, planlagtLetUge } from ${JSON.stringify(coachUrl)}
    import { erAfsluttetUge } from ${JSON.stringify(weekUrl)}
    ${body}
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8', env: { ...process.env, TZ: timeZone },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

for (const timeZone of ['UTC', 'America/Los_Angeles', 'Europe/Copenhagen']) {
  test(`styrkekurven bruger dansk kalenderdag ved begge tidsskift i ${timeZone}`, () => {
    inZone(timeZone, `
      const times = ['2026-03-28T23:30:00Z', '2026-03-29T22:30:00Z', '2026-10-24T22:30:00Z', '2026-10-25T23:30:00Z']
      const rows = times.map(logged_at => ({ logged_at, weight: 100, reps_completed: 5, exercises: { name: 'Squat' } }))
      const points = bestHeavySetPerDay(rows)
      assert.deepEqual(points.map(p => p.dag), ['2026-03-29', '2026-03-30', '2026-10-25', '2026-10-26'])
      assert.ok(points.every(p => Number.isFinite(p.e1rm)))
      const repeatedHour = bestHeavySetPerDay(['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'].map((logged_at, i) => ({ logged_at, weight: 100 + i * 10, reps_completed: 5, exercises: { name: 'Squat' } })))
      assert.equal(repeatedHour.length, 1)
      assert.equal(repeatedHour[0].dag, '2026-10-25')
      assert.equal(repeatedHour[0].weight, 110)
      assert.deepEqual(bestHeavySetPerDay([{ logged_at: '2026-10-26', weight: 100, reps_completed: 5, exercises: { name: 'Squat' } }]).map(p => p.dag), ['2026-10-26'])
    `)
  })

  test(`coachens aktuelle dato følger København i ${timeZone}`, () => {
    inZone(timeZone, `
      assert.equal(lokalDag(new Date('2026-03-29T22:30:00Z')), '2026-03-30')
      assert.equal(lokalDag(new Date('2026-10-25T23:30:00Z')), '2026-10-26')
    `)
  })

  test(`coachens smertenoter får dansk dato og korrekt historikgrænse i ${timeZone}`, () => {
    inZone(timeZone, `
      const log = logged_at => ({ logged_at, exercise_id: 'sq', note: 'Ondt i knæet', exercises: { name: 'Squat' } })
      const recent = smerteNoter([log('2026-10-25T23:30:00Z')], '2026-10-26')
      assert.equal(recent[0].dag, '2026-10-26')
      const boundary = smerteNoter([log('2026-10-11T22:30:00Z')], '2026-10-26')
      assert.equal(boundary.length, 1)
      assert.equal(boundary[0].dag, '2026-10-12')
    `)
  })

  test(`coachens lette uge bruger dansk historikgrænse i ${timeZone}`, () => {
    inZone(timeZone, `
      const log = logged_at => ({ logged_at, exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } })
      assert.equal(planlagtLetUge([log('2026-10-15T22:30:00Z')], '2026-10-26'), true)
      assert.equal(planlagtLetUge([log('2026-10-14T22:30:00Z')], '2026-10-26'), false)
    `)
  })

  test(`coachens uge lukker ved dansk mandag efter begge tidsskift i ${timeZone}`, () => {
    inZone(timeZone, `
      assert.equal(erAfsluttetUge({ start_date: '2026-03-23' }, new Date('2026-03-29T21:59:59.999Z')), false)
      assert.equal(erAfsluttetUge({ start_date: '2026-03-23' }, new Date('2026-03-29T22:00:00Z')), true)
      assert.equal(erAfsluttetUge({ start_date: '2026-10-19' }, new Date('2026-10-25T22:59:59.999Z')), false)
      assert.equal(erAfsluttetUge({ start_date: '2026-10-19' }, new Date('2026-10-25T23:00:00Z')), true)
    `)
  })
}
