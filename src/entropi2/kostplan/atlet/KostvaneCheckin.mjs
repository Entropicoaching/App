import * as React from 'react'
import { kostvane, readDone, saveDone, KOSTDAGE_MAAL } from './kostvaneModel.mjs'
import { useDayRow } from '../../u7/useDayRow.mjs'
import { u7Enabled } from '../../u7/flag.mjs'

const h = React.createElement
const { useEffect, useState, useSyncExternalStore } = React
const card = { margin: 16, padding: 16, borderRadius: 12, background: '#24241f', border: '1px solid #414139', color: '#edeae2' }
const primary = { minHeight: 48, width: '100%', font: 'inherit', fontWeight: 600, background: '#edeae2', color: '#16160f', border: 0, borderRadius: 10, padding: '10px 14px', marginTop: 8 }
const none = Object.freeze({ loaded: false })
const noSubscribe = () => () => {}
// Read the local "done" mark once per athlete/day; remounts (day changes,
// StrictMode) never read storage again.
const doneCache = new Map()
const knownDone = (device, athleteId, date) => {
  const key = athleteId + '|' + date
  if (!doneCache.has(key)) doneCache.set(key, readDone(device, athleteId, date))
  return doneCache.get(key)
}

function Dots({ dage }) {
  const count = Math.min(dage.length, 7)
  return h('div', { 'aria-hidden': true, style: { display: 'flex', gap: 6, margin: '8px 0' } },
    ...Array.from({ length: Math.max(KOSTDAGE_MAAL, count) }, (_, i) => h('span', { key: i, style: {
      width: 14, height: 14, borderRadius: 7, display: 'inline-block',
      background: i < count ? '#5fb38a' : 'transparent', border: '2px solid ' + (i < count ? '#5fb38a' : '#6b6b60') } })))
}

// Dagens kostvane: tre korte trin. Bruger kostloggens egen controller (log, snapshot),
// så måltiderne gemmes i de samme logs som i dag. "Færdig for i dag" er kun lokal.
export default function KostvaneCheckin({ tracker, athleteId, date, storage, client, u7DayData }) {
  const s = useSyncExternalStore(tracker?.subscribe || noSubscribe, tracker?.snapshot || (() => none), tracker?.snapshot || (() => none))
  const device = storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : storage
  const [done, setDone] = useState(() => knownDone(device, athleteId, date))
  const [copy, setCopy] = useState(null)
  // U7: med tabellen følger "færdig for i dag" med til en ny telefon og ses af coachen.
  const day = useDayRow({ enabled: u7Enabled('dayData', u7DayData), client, athleteId, date, storage: device })
  const serverDone = day.status === 'ready' && day.row?.kost_done_at != null
  useEffect(() => {
    if (!serverDone || done) return
    saveDone(device, athleteId, date); doneCache.set(athleteId + '|' + date, true); setDone(true)
  }, [serverDone, done, device, athleteId, date])
  const v = kostvane(s?.athleteId === athleteId && s?.date === date ? s : none, done)
  const repeatYesterday = async () => {
    if (!tracker || copy?.running) return
    const meals = v.yesterday
    setCopy({ running: true, saved: 0, total: meals.length })
    let saved = 0
    for (const [index, meal] of meals.entries()) {
      if (await tracker.log(meal, `kostvane-i-gaar:${date}:${index}:${Date.now()}`) !== true) break
      saved++
      setCopy({ running: true, saved, total: meals.length })
    }
    setCopy({ running: false, saved, total: meals.length })
  }
  // A failed local save still checks the day in for this open view.
  const finish = () => {
    saveDone(device, athleteId, date); doneCache.set(athleteId + '|' + date, true); setDone(true)
    if (day.status === 'ready') day.save({ kost_done_at: new Date().toISOString() })
  }
  if (v.phase !== 'ready') return h('section', { 'aria-label': 'Dagens kostvane', style: card },
    h('h2', { style: { margin: 0, color: '#edeae2' } }, 'Dagens kostvane'), h('p', { role: 'status' }, 'Henter din kostlog…'))
  const stepText = ['Log dagens mad', 'Tjek dagens tal', 'Færdig for i dag']
  return h('section', { 'aria-label': 'Dagens kostvane', 'data-kostvane-trin': String(v.step), style: card },
    h('h2', { style: { margin: '0 0 4px', color: '#edeae2' } }, 'Dagens kostvane'),
    h('p', { style: { margin: 0, opacity: 0.85 } }, `Trin ${Math.min(v.step, 3)} af 3: ${stepText[Math.min(v.step, 3) - 1]}`),
    h(Dots, { dage: v.dage }),
    h('p', { role: 'status', style: { margin: '0 0 8px' } }, v.uge),
    v.mealsToday === 0 && h('div', null,
      v.yesterday.length > 0 && h('button', { type: 'button', style: primary, disabled: copy?.running || v.busy,
        onClick: repeatYesterday }, copy?.running ? `Logger ${copy.saved + 1} af ${copy.total}…`
        : `Jeg spiste som i går (${v.yesterday.length} ${v.yesterday.length === 1 ? 'måltid' : 'måltider'})`),
      h('p', { style: { margin: '8px 0 0' } }, v.yesterday.length ? 'Eller log det, du har spist, med Log mad lige herunder.' : 'Log det, du har spist, med Log mad lige herunder. Et måltid er nok til at tælle dagen med.'),
),
    // Shown in every step: a partial copy leaves the day with some meals logged.
    copy && !copy.running && copy.saved < copy.total && h('p', { role: 'alert' },
      `${copy.saved} af ${copy.total} måltider fra i går blev gemt. Log resten med Log mad herunder.`),
    v.mealsToday > 0 && h('div', null,
      h('p', { style: { margin: '4px 0' } }, `${v.mealsToday} ${v.mealsToday === 1 ? 'måltid' : 'måltider'} logget i dag.`),
      h('p', { 'data-kostvane-feedback': '', style: { margin: '4px 0', fontWeight: 600 } }, v.feedback),
      !v.done && h('button', { type: 'button', style: primary, onClick: finish }, 'Færdig for i dag'),
      !v.done && h('p', { style: { margin: '8px 0 0', opacity: 0.85 } }, 'Mangler et måltid? Brug Log mad herunder. Gram rettes i kostloggen.'),
      v.done && h('p', { role: 'status', style: { margin: '8px 0 0' } },
        `Dagen er tjekket ind. Glemte du noget, kan du stadig logge det nedenfor.`)))
}
