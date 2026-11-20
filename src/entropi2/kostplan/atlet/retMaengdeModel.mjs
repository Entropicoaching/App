import { foodPortion } from '../../nutrition/controller.mjs'
import { parseInputNumber, nutritionValues } from '../../../athlete/kostNumbers.mjs'

// 1923 (Marc 19. nov.: "gøre en træls gentagelig handling lidt nemmere"): et logget
// fødevaremåltid i dag ("Fødevare · 60 g" eller "Fødevare · 1 stk (150 g)") rettes
// til en ny mængde i samme række. Ren model over kostloggens egen snapshot; ingen læsning.
const GRAM = /^(.+?) · (?:(\d+(?:[.,]\d+)?) g|[^·]*\((\d+(?:[.,]\d+)?) g\))$/

// Kun rækker, kostloggen selv lader rette (editableIds), og som har gram i navnet.
export function loggetIDag(snapshot) {
  if (!snapshot?.loaded || !Array.isArray(snapshot.logs)) return []
  const ret = new Set(snapshot.editableIds ?? [])
  return snapshot.logs.filter(row => ret.has(row?.id)).flatMap(row => {
    const m = GRAM.exec(String(row.meal ?? ''))
    const grams = m ? parseInputNumber(m[2] ?? m[3]) : null
    return grams > 0 ? [{ id: row.id, row, name: m[1], grams }] : []
  })
}

// Ny mængde i gram: fødevarens egne tal pr. 100 g, ellers rækkens tal skaleret.
export function nyMaengde(snapshot, item, amount) {
  const grams = parseInputNumber(amount)
  if (!item || !(grams > 0)) return null
  const food = (snapshot?.foods ?? []).find(f => f?.name === item.name)
  const portion = food ? foodPortion(food, String(grams), 0) : null
  if (portion) return portion
  const values = nutritionValues(item.row, grams / item.grams)
  return values && { meal: `${item.name} · ${Math.round(grams)} g`, ...values }
}
