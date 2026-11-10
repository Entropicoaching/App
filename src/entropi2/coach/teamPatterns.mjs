import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { exerciseSetView } from '../../exerciseSetView.js'
import { buildStrengthTrend } from '../tracking/strengthTrend.mjs'
import { mealDays } from '../u3/nutritionWeek.mjs'
import { onVacation } from '../u3/couplings.mjs'
import { formatNumber } from '../u3/format.mjs'

// U3-planen afsnit 3: mønstre i gruppen uden navne. Ingen navne, ingen id'er,
// intet grundlag under 5 atleter, og tællere mellem 1 og 4 skrives "under 5".
export const MIN_GROUP = 5
export const KOST_DAYS = 4
export const PROTEIN_HIT = 0.9
export const TEAM_LIFTS = Object.freeze(['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'].map(name => ({ key: exerciseSetView(name).key, name })))

// Atleter, der tæller: ikke skjulte og ikke på ferie. De fjernes, før der læses.
export function teamAthletes(athletes, day, hiddenIds = new Set()) {
  return (Array.isArray(athletes) ? athletes : []).filter(a => typeof a?.id === 'string' && !a.hidden &&
    !hiddenIds.has?.(a.id) && !onVacation(a, day))
}

// "n af total" med værn mod genkendelse. null betyder, at spørgsmålet ikke vises.
export function groupCount(n, total) {
  if (!Number.isSafeInteger(total) || total < MIN_GROUP || !Number.isSafeInteger(n) || n < 0 || n > total) return null
  if (n >= 1 && n <= 4) return `under 5 af ${total}`
  if (total - n >= 1 && total - n <= 4) return `alle på nær under 5 af ${total}`
  return `${n} af ${total}`
}

const median = values => {
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function teamPatterns({ athletes, meals, logs, targets = new Map(), today } = {}) {
  const day = calendarDay(today)
  const ids = (Array.isArray(athletes) ? athletes : []).map(a => a.id)
  const out = { g1: null, g2: null, g3: null }
  if (!day || !ids.length) return out
  const from = addCalendarDays(day, -7)

  // G1 og G2: 7 afsluttede dage, i dag minus 7 til i går (R5-kostdage).
  if (Array.isArray(meals)) {
    const loggers = []
    for (const id of ids) {
      const days = mealDays(meals.filter(r => r?.athlete_id === id && r.date >= from), { today: day })
      if (days.length >= KOST_DAYS) loggers.push({ id, days })
    }
    const g1 = groupCount(loggers.length, ids.length)
    if (g1) out.g1 = { text: `${g1} logger kost mindst ${KOST_DAYS} af 7 dage`, n: loggers.length, total: ids.length }
    const shares = loggers.map(({ id, days }) => {
      const target = Number(targets.get(id))
      const proteins = days.map(d => d.protein)
      if (!(target > 0) || proteins.some(p => p === null)) return null
      return proteins.reduce((n, p) => n + p, 0) / proteins.length / target
    }).filter(v => v !== null)
    const hits = shares.filter(s => s >= PROTEIN_HIT).length
    const g2 = groupCount(hits, shares.length)
    if (g2) out.g2 = { text: `${g2} rammer protein, median ${formatNumber(Math.round(median(shares) * 100))} % af målet`, n: hits, total: shares.length }
  }

  // G3: plateau eller fald i buildStrengthTrend blandt atleter med alle 4 seneste afsluttede uger.
  if (Array.isArray(logs)) {
    const trends = ids.map(id => buildStrengthTrend(logs.filter(r => r?.athlete_id === id), { today: day }))
    out.g3 = TEAM_LIFTS.map(lift => {
      let total = 0, n = 0
      for (const trend of trends) {
        const series = trend?.lifts?.find(l => l.key === lift.key)
        if (!series || series.plateau === null || series.drop === null) continue
        total++
        if (series.plateau === true || series.drop === true) n++
      }
      const text = groupCount(n, total)
      return { key: lift.key, name: lift.name, text: text ? `${text} står stille eller falder` : null, n, total }
    })
  }
  return out
}
