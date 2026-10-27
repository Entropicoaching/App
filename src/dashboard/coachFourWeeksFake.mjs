export { useState, useRef } from './coachFourWeeksDom.mjs'
import { h } from './coachFourWeeksDom.mjs'
export const createElement = (type, props, ...children) => h(type, props, null, ...children)
export const effects = []
export const useEffect = (fn, deps) => effects.push({ fn, deps })
export const calls = []
export const pending = []
export const supabase = { from(table) {
  const call = { table, steps: [] }; calls.push(call)
  const query = new Proxy({}, { get(_, key) {
    if (key === 'then') return (yes, no) => {
      const result = pending.shift()
      if (!result) throw new Error('Unexpected synthetic read: ' + table)
      return Promise.resolve(result).then(yes, no)
    }
    return (...args) => { call.steps.push([key, ...args]); return query }
  } })
  return query
} }
export const withRetry = fn => fn()
