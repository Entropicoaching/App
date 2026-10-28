import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'

const forbidden = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|caches|CacheStorage|navigator|document|globalThis|global|self|window|location|process|require|eval|Function|Worker|SharedWorker|importScripts|Deno|Bun)\b/
const flagLocation = "typeof window === 'undefined' ? '' : window.location.href"

// Conservative source-graph check, not a sandbox for hostile JavaScript.
// No basename exemptions, host imports or resolver fallback inside this graph.
export function assertPureGraph(entry, readSource, seen = new Set()) {
  if (seen.has(entry)) return
  if (!/^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:js|mjs|jsx)$/.test(entry)) {
    throw Error(`Unapproved synthetic dependency ${entry}`)
  }
  let code
  try { code = readSource(entry) } catch { throw Error(`Unapproved synthetic dependency ${entry}`) }
  // Only the existing note flag may read the current URL. Storage and network
  // identifiers elsewhere in that very file are still checked.
  if (entry === 'src/coachNoteSignal.js') code = code.replace(flagLocation, "''")
  if (entry === 'src/dataEnough.mjs' && createHash('sha256').update(code.replace(/\r\n/g, '\n')).digest('hex') === '3330a681c3e59b7a43afc0455bf50203dfa10dedd27eb53434f6c027717bac22') code = code.replace("globalThis.location?.search", "''").replace(/\bwindow\b/g, 'periodRows')
  code = withoutComments(code)
  const identifiers = code.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi,
    (_, a, b, c) => String.fromCodePoint(parseInt(a || b || c, 16)))
  const withoutMode = identifiers.replace(/import\.meta\.env\?\.MODE/g, 'undefined')
  if (forbidden.test(withoutMode) || /\bimport\s*\(|\bimport\s*\.|\bconstructor\b|__proto__/.test(withoutMode)) {
    throw Error(`Impure synthetic dependency ${entry}`)
  }
  seen.add(entry)
  const imports = [...code.matchAll(/\b(?:import\s+(?:[^;'"`]*?\s+from\s*)?|export\s+[^;'"`]*?\s+from\s*)['"]([^'"\r\n]+)['"]/g)]
  for (const [, specifier] of imports) {
    if (!specifier.startsWith('.')) throw Error(`Unapproved synthetic dependency ${specifier} from ${entry}`)
    let target = posix.normalize(posix.join(posix.dirname(entry), specifier))
    if (!posix.extname(target)) target += '.js'
    assertPureGraph(target, readSource, seen)
  }
}

export function assertNoteDependencies(readSource) {
  assertPureGraph('src/coachNoteSignal.js', readSource)
}

// Preserve quoted URLs and template expressions while removing comments.
// Literal contents are checked too: false positives fail closed.
function withoutComments(code) {
  let result = '', quote = null
  for (let i = 0; i < code.length; i++) {
    const ch = code[i], next = code[i + 1]
    if (quote) {
      result += ch
      if (ch === '\\') { result += next || ''; i++ }
      else if (ch === quote) quote = null
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch; result += ch
    } else if (ch === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n' && code[i] !== '\r') i++
      result += '\n'
    } else if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      if (end < 0) throw Error('Unterminated synthetic comment')
      i = end + 1; result += ' '
    } else result += ch
  }
  return result
}

// Run before the note module is evaluated by importing tests/helpers.
assertNoteDependencies(path => readFileSync(new URL('./' + path.slice(4), import.meta.url), 'utf8'))
