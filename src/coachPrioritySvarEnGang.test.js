// Ordre 1665 (Marc 16. nov.: "pas på at det ikke er gentagelser på siderne"): atletens svar står kun i
// Samtale med atleten; kortet "Aktuel opgave" siger status og gentager ikke teksten.
import test from 'node:test'
import assert from 'node:assert/strict'
const { coachPriorityTaskContext } = await import('./coachPriority.js')

const TEKST = 'Jeg har vaeret syg i to dage, derfor sprang jeg et saet over.'
const besked = (track, count = 1) => ({ key: `message-a-${track}`, kind: 'message', track, label: 'Besked', title: 'Atlet B', detail: TEKST, count })

test('Aktuel opgave for en besked gentager ikke atletens tekst', () => {
  for (const track of ['besked', 'teknik']) {
    const ctx = coachPriorityTaskContext(besked(track))
    assert.ok(!ctx.summary.includes('syg'), ctx.summary)
    assert.equal(ctx.detail, null)
    assert.match(ctx.summary, /svar|skrevet/i)
    assert.match(ctx.summary, /samtale/i)
  }
})

test('flere ulæste beskeder får antal i status, signaler og video er uændrede', () => {
  assert.match(coachPriorityTaskContext(besked('besked', 3)).summary, /3/)
  const signal = coachPriorityTaskContext({ key: 's', kind: 'signal', title: 'Squat fladt', detail: 'Spørg atleten først' })
  assert.equal(signal.summary, 'Squat fladt')
  assert.equal(signal.detail, 'Spørg atleten først')
  assert.equal(coachPriorityTaskContext({ key: 'v', kind: 'video', title: 'Atlet B', detail: 'Ny video' }).summary, 'Ny video')
})
