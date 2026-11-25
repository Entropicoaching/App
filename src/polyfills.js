// Ordre 2344: små udfyldninger til ældre iPhones (iOS 15.3 og ældre), der mangler API'er appen bruger.
// Hver udfyldning kører kun, hvis API'et mangler. Må ikke importere andet og skal være første import i main.jsx.
// Dækket: Object.hasOwn, Array/String .at, findLast, findLastIndex, structuredClone (enkel kopi).
// Ikke dækket med vilje: toReversed (bruges kun i prøver), Object.groupBy, toSorted, toSpliced, .with,
// Promise.withResolvers og Array.fromAsync (bruges ikke i appen).

const define = (target, name, value) => {
  if (typeof target[name] !== 'function') Object.defineProperty(target, name, { value, writable: true, configurable: true })
}

define(Object, 'hasOwn', function hasOwn(object, key) {
  if (object == null) throw new TypeError('Cannot convert undefined or null to object')
  return Object.prototype.hasOwnProperty.call(Object(object), key)
})

function at(index) {
  if (this == null) throw new TypeError('Array.prototype.at called on null or undefined')
  const text = typeof this === 'string' || this instanceof String
  const length = text ? String(this).length : Object(this).length >>> 0
  let relative = Math.trunc(Number(index)) || 0
  if (relative < 0) relative += length
  if (relative < 0 || relative >= length) return undefined
  return text ? String(this).charAt(relative) : this[relative]
}
define(Array.prototype, 'at', at)
define(String.prototype, 'at', at)

define(Array.prototype, 'findLastIndex', function findLastIndex(test, thisArg) {
  for (let i = this.length - 1; i >= 0; i--) if (test.call(thisArg, this[i], i, this)) return i
  return -1
})
define(Array.prototype, 'findLast', function findLast(test, thisArg) {
  const i = this.findLastIndex(test, thisArg)
  return i < 0 ? undefined : this[i]
})

// Enkel kopi af det appen kloner: tal, tekst, boolean, null, undefined, lister, rene objekter, Date, Map og Set
// (også med gentagne og cirkulære referencer). Funktioner afvises som i den rigtige. Blob og File deles ved reference.
if (typeof globalThis.structuredClone !== 'function') {
  const kopi = (value, seen) => {
    if (typeof value === 'function' || typeof value === 'symbol') {
      const error = new Error(`${typeof value === 'symbol' ? 'Symbol' : 'function'} could not be cloned.`)
      error.name = 'DataCloneError'
      throw error
    }
    if (value === null || typeof value !== 'object') return value
    if (seen.has(value)) return seen.get(value)
    if (value instanceof Date) return new Date(value.getTime())
    if (typeof Blob === 'function' && value instanceof Blob) return value
    if (value instanceof ArrayBuffer) return value.slice(0)
    if (ArrayBuffer.isView(value)) return new value.constructor(value.buffer.slice(0), value.byteOffset, value.length)
    if (value instanceof Map) {
      const out = new Map(); seen.set(value, out)
      value.forEach((v, k) => out.set(kopi(k, seen), kopi(v, seen)))
      return out
    }
    if (value instanceof Set) {
      const out = new Set(); seen.set(value, out)
      value.forEach(v => out.add(kopi(v, seen)))
      return out
    }
    const out = Array.isArray(value) ? new Array(value.length) : {}
    seen.set(value, out)
    for (const key of Object.keys(value)) out[key] = kopi(value[key], seen)
    return out
  }
  Object.defineProperty(globalThis, 'structuredClone', {
    value: function structuredClone(value) { return kopi(value, new WeakMap()) },
    writable: true, configurable: true,
  })
}
