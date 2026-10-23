import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source is data only. No application module is imported or executed.
const files = [
  '../athlete/ugeFeedback.js', './coachUgeFeedback.js',
  './coachTekstForslag.js', './coachTekstTree.js', './coachTekstData.js',
]
// Genuine Danish words with these letter pairs, not transliterations.
const genuineWords = new Set(['aerob', 'aerobe', 'aerobt', 'aerobisk', 'koefficient', 'koefficienter'])
// Exact machine values and JSON keys in the pinned source, never visible prose.
const machineValues = new Set([
  'gennemfoert', 'faerre_saet', 'faerre_reps', 'anden_vaegt', 'flere_saet', 'ingen_saet_planlagt',
  'manglende_oevelse', 'hoej_rpe', 'oevelser', 'bemaerkning',
  'automatiskProgramaendring', 'naarModulMelder',
])
function suspectWords(text) {
  return (text.match(/[\p{L}\p{N}_]+/gu) || []).filter(word =>
    /ae|oe|aa/i.test(word) && !genuineWords.has(word.toLocaleLowerCase('da')))
}
function literals(source) {
  // This is a bounded source reader for the pinned, comment-line based modules.
  // Template expressions are code; recursively retain their nested literals.
  const clean = source.split(/\r?\n/).filter(line => !/^\s*(?:\/\/|import\b)/.test(line)).join('\n')
  const values = []
  const pattern = /(['"`])((?:\\[\s\S]|(?!\1)[^\\])*?)\1/g
  for (const match of clean.matchAll(pattern)) {
    let value = match[2]
    if (match[1] === '`') value = value.replace(/\$\{([^{}]*)\}/g, (_, expression) => {
      values.push(...literals(expression))
      return ''
    })
    value = value.replace(/\{\w+\}/g, '') // Template data placeholders are identifiers.
    const prefix = clean.slice(0, match.index)
    const machineContext = /(?:===|!==|\bcase|\btype\s*:|\bstatus\s*[:=]|\bkeys\.push\(|\?)\s*$/.test(prefix)
    if (!(machineValues.has(value) && machineContext) && !/^#[\da-f]{3,8}$/i.test(value)) values.push(value)
  }
  return values
}
function publicTexts(source, file) {
  if (!file.endsWith('coachTekstData.js')) return literals(source)
  const data = JSON.parse(source.slice(source.indexOf('{')))
  return [data.bemaerkning, data.afslutning, ...Object.values(data.pladsholdere),
    ...Object.values(data.situationer).flatMap(s => [s.navn, s.tekst])]
}

test('APP-TXT2: public text uses Danish letters, with explicit genuine-word exceptions', () => {
  assert.deepEqual(suspectWords('aerob aerobisk koefficient koefficienter'), [])
  for (const word of ['saet', 'gennemfoert', 'haandteres', 'Oevelser', 'maaling', 'faar', 'baade'])
    assert.deepEqual(suspectWords(word), [word])
  assert.deepEqual(suspectWords('sæt gennemført håndteres Øvelser måling får både'), [])
  const failures = []
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    const texts = publicTexts(source, file)
    assert.deepEqual(publicTexts(source.replace(/\r?\n/g, '\r\n'), file), texts)
    assert.ok(texts.length > 0, `${file}: empty source extraction`)
    for (const text of texts) {
      const words = suspectWords(text.replace(/\{\w+\}/g, ''))
      if (words.length) failures.push({ file, text, words })
    }
  }
  assert.deepEqual(failures, [])
})
