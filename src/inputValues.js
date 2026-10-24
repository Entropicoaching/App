import { parseInputNumber } from './athlete/kostNumbers.mjs'
export { parseInputNumber }
export function inputInteger(value, empty = null) {
  const n = parseInputNumber(value, empty)
  return Number.isSafeInteger(n) ? n : null
}
export function optionalInput(value) {
  return value === null || value === undefined || (typeof value === 'string' && !value.trim())
}
export function finiteProduct(...values) {
  const numbers = values.map(v => parseInputNumber(v))
  if (numbers.some(n => n === null)) return 0
  const result = numbers.reduce((a, b) => a * b, 1)
  return Number.isFinite(result) ? result : 0
}
export function finiteAdd(a, b) {
  return a > Number.MAX_VALUE - b ? Number.MAX_VALUE : a + b
}

export function finiteMean(values) {
  if (!values.length) return null
  const scale = Math.max(...values)
  if (!scale) return 0
  return scale * Math.min(1, values.reduce((sum, value) => sum + (value / scale) / values.length, 0))
}
