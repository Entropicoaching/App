import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { weeksToCompetition } from './calendarDate.js'

const now = new Date('2026-11-18T08:30:00Z')

test('49 dage til stævne er 7 uger, ikke 8', () => {
  assert.equal(weeksToCompetition('2027-01-06', now), 7)
})

test('uger rundes op på kalenderdage', () => {
  assert.equal(weeksToCompetition('2026-11-19', now), 1)
  assert.equal(weeksToCompetition('2026-11-25', now), 1)
  assert.equal(weeksToCompetition('2026-11-26', now), 2)
  assert.equal(weeksToCompetition('2026-11-18', now), 1)
  assert.ok(weeksToCompetition('2026-11-17', now) <= 0)
  assert.equal(weeksToCompetition('ikke en dato', now), null)
})

test('program, oversigt og hub bruger samme ugetal som Hjem', () => {
  for (const f of ['athlete/ProgramTab.jsx', 'dashboard/ProgramTab.jsx', 'dashboard/OversigtTab.jsx', 'dashboard/HubTab.jsx']) {
    const src = readFileSync(new URL('./' + f, import.meta.url), 'utf8')
    assert.ok(!/ceil\([^)]*7 \* 24 \* 3600/.test(src), f + ' regner stadig uger ud fra klokkeslæt')
    assert.match(src, /weeksToCompetition|timeZone: 'Europe\/Copenhagen'/, f)
  }
})

test('Program-fanerne uden ny import giver samme tal som weeksToCompetition', () => {
  for (const f of ['athlete/ProgramTab.jsx', 'dashboard/ProgramTab.jsx']) {
    const src = readFileSync(new URL('./' + f, import.meta.url), 'utf8')
    const udtryk = src.match(/const weeksToComp = (compDate \? \(\(\) => \{.*\}\)\(\) : null)/)[1]
    const regn = new Function('compDate', 'return ' + udtryk)
    const nu = new Date()
    const dag = n => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date(nu.getTime() + n * 86400000))
    for (const n of [-3, 0, 1, 7, 8, 14, 49, 50]) assert.equal(regn(dag(n)), weeksToCompetition(dag(n), nu), f + ' ' + n)
  }
})
