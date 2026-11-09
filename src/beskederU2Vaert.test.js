// U2 (ordre 50): læst/ulæst skal nå ud til fanens prik hos atleten og til
// coachens indbakke, når et svar læses i samtalen. Kildeprøve af koblingen i
// værtsfilerne; tallet og delingen prøves i entropi2/conversation/
// u2Paalidelighed.test.mjs og unreadHost.test.mjs, og hele vejen i
// e2e/beskeder-video-u2.spec.mjs. Dashboard.jsx er uændret; AthleteView.jsx
// får kun sine to eksisterende setters med til samtalen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('læst/ulæst: samtalen deler sit ulæst-tal med værten', () => {
  const entry = read('./entropi2/conversation/ConversationEntry.mjs')
  assert.match(entry, /onUnread: \(summary, previous\) => shareUnread\(live\.current\(\), summary, previous\)/)
})

test('læst/ulæst: atletens fane-prik får samtalens tal gennem værtens egne setters', () => {
  const athlete = read('./AthleteView.jsx')
  assert.match(athlete, /storage: \(\) => localStorage,\n {12}setUnreadMsgCount, setSharedVideoAnalyses,\n {10}\}\)\} \/>/)
})

test('læst/ulæst: coachens forside, kø og tal hentes igen, når samtalens tal ændrer sig', () => {
  const effects = read('./dashboard/useDashboardEffekter.js')
  assert.match(effects, /window\.addEventListener\('entropi2:samtale-ulaest', onUnread\)/)
  assert.match(effects, /window\.removeEventListener\('entropi2:samtale-ulaest', onUnread\)/)
  assert.match(effects, /Promise\.resolve\(refreshCoachInbox\(\)\)\.then\(again, again\)/)
  assert.equal(read('./Dashboard.jsx').includes('samtale-ulaest'), false)
})
