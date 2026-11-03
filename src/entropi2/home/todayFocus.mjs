import { homeModel } from './homeModel.mjs'
import { calendarDay } from '../../calendarDate.js'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'

const mobility = 'Dagens fokus: Giv plads til mobilitet.'

// Same read-only props as homeModel plus nutritionToday (the Home snapshot).
// now is required: never read the wall clock. Unknown dates/data use mobility.
// An undated open session follows homeModel's existing "today" semantics.
// Mobility is a general fallback, with no invented routine or completion state.
export function todayFocus(props = {}) {
  const today = calendarDay(props?.now ?? null)
  if (!today) return mobility
  if (homeModel(props).kind === 'today') return 'Dagens fokus: Gennemfør dagens pas.'

  const snapshot = props.nutritionToday
  if (snapshot?.date === today) {
    for (const [totalKey, targetKey] of [['kcal', 'kcalTarget'], ['protein', 'proteinTarget']]) {
      const total = parseInputNumber(snapshot[totalKey])
      const target = parseInputNumber(snapshot[targetKey])
      // Match nutritionTodayModel: missing totals are not zero; no unsafe values.
      if (total !== null && target !== null && target >= 1 &&
          total <= Number.MAX_SAFE_INTEGER && target <= Number.MAX_SAFE_INTEGER && total < target) {
        return 'Dagens fokus: Arbejd hen imod dagens kostmål.'
      }
    }
  }
  return mobility
}
