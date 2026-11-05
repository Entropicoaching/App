import test from 'node:test'
import assert from 'node:assert/strict'

// Genuine React only. npm test discovers this file. Missing pinned dependencies
// are an explicit Dhurva merge gate, never replaced with a synthetic renderer.
let h, render, Home, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup: render } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: Home } = await import('./AthleteHome.mjs'))
const gate = { skip: missing ? 'Pinned copy lacks React/react-dom; genuine React required at Dhurva merge.' : false }
const athlete = { id: 'synthetic-visual-react', name: 'Testfornavn Testefternavn' }
const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-session', weekday: 2, title: 'Syntetisk pas', exercises: [
    { id: 'synthetic-exercise', name: 'Syntetisk løft', sets: 2, note: 'Lang syntetisk note. '.repeat(50) },
  ] }] }
const html = extra => render(h(Home, { enabled: true, athlete, now: new Date('2026-11-04T12:00:00Z'),
  allWeeks: [week], currentWeek: week, exerciseLogs: [], storage: null, onStartSession() {}, ...extra }))

test('real React visual: Start precedes exercise list and long notes, retaining compact home functions', gate, () => {
  for (const now of [new Date('2026-11-04T12:00:00Z'), new Date('2026-11-03T12:00:00Z')]) {
    const markup = html({ now })
    const start = markup.search(/Start (dagens|næste) pas/)
    assert.ok(start >= 0 && start < markup.indexOf('<ul'))
    assert.ok(start < markup.indexOf('Lang syntetisk note'))
    assert.match(markup, /Testfornavn/); assert.doesNotMatch(markup, /Testefternavn/)
    assert.match(markup, /data-home-checkin/)
    assert.match(markup, /Ugen: 0 af 1 pas/)
    assert.match(markup, /0 af 2 sæt klaret/)
  }
})

test('real React visual: long coach message starts closed, is escaped once, and short messages have no disclosure', gate, () => {
  const content = 'Syntetisk '.repeat(30) + '<script>syntetisk</script>'
  const markup = html({ messages: [{ sender_role: 'coach', content }] })
  const card = markup.match(/<section[^>]*aria-label="Fra din coach"[^>]*>([\s\S]*?)<\/section>/)?.[1]
  assert.ok(card)
  assert.match(card, /<details(?:\s[^>]*)?><summary/)
  assert.doesNotMatch(card, /<details[^>]*\sopen(?:[\s=>])/)
  assert.match(card, /Læs resten af beskeden/)
  assert.doesNotMatch(card, /<script>/)
  assert.equal((card.match(/&lt;script&gt;/g) ?? []).length, 1)
  assert.match(card, /Se besked og video/)
  const short = html({ messages: [{ sender_role: 'coach', content: 'Kort syntetisk besked' }] })
  const shortCard = short.match(/<section[^>]*aria-label="Fra din coach"[^>]*>([\s\S]*?)<\/section>/)?.[1]
  assert.match(shortCard, /Kort syntetisk besked/)
  assert.doesNotMatch(shortCard, /<details|Læs resten/)
  assert.equal(render(h(Home, { enabled: false })), '')
})
