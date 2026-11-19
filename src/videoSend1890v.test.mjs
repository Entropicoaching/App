// ORDRE 1890v (Marc 19. nov.): mellemrum i notatet til coachen, resultatpanelet kan foldes,
// og en fejlet afsendelse siger hvorfor. Browserprøven ligger i e2e/video-send-1890v.spec.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dom, ui } from './uploadRetryFakes.mjs'
import { videoSendCoachLoginReason } from './videoCoachUpload.js'

const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function shortcuts() {
  const start = html.indexOf("document.addEventListener('keydown', e => {\n  // ORDRE 1890v")
  assert.ok(start > 0, 'genvejslytteren findes')
  const body = html.slice(html.indexOf('{', start) + 1, html.indexOf('\n});', start))
  const calls = []
  const run = new Function('e', 'togglePlay', 'step', 'FRAME', body)
  return { calls, press(target, code = 'Space') {
    const event = { target, code, prevented: false, preventDefault() { this.prevented = true } }
    run(event, () => calls.push('play'), dt => calls.push(dt), 1)
    return event
  } }
}

test('1890v: mellemrum og piletaster i et felt rører ikke afspilningen', () => {
  const keys = shortcuts()
  const fields = [{ tagName: 'TEXTAREA' }, { tagName: 'INPUT' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]
  for (const field of fields) for (const code of ['Space', 'ArrowLeft', 'ArrowRight']) {
    const event = keys.press(field, code)
    assert.equal(event.prevented, false, `${field.tagName} ${code}: tegnet skal nå feltet`)
  }
  assert.deepEqual(keys.calls, [])
})

test('1890v: uden for et felt virker genvejene som før', () => {
  const keys = shortcuts()
  assert.equal(keys.press({ tagName: 'BODY' }).prevented, true)
  keys.press({ tagName: 'BUTTON' }, 'ArrowLeft')
  keys.press({ tagName: 'CANVAS' }, 'ArrowRight')
  assert.deepEqual(keys.calls, ['play', -1, 1])
})

test('1890v: notatet til coachen er et textarea, så genvejsværnet dækker det', () => {
  assert.match(html, /const athleteNoteInput = document\.createElement\('textarea'\);\n  athleteNoteInput\.id = 'athleteNoteInput';/)
})

test('1890v: resultatpanelet foldes til overskriften og åbnes igen, indholdet bliver i DOM', () => {
  const start = html.indexOf("const athleteInstantFoldBtn = document.createElement('button');")
  const end = html.indexOf('document.body.appendChild(athleteInstantResult);', start)
  assert.ok(start > 0 && end > start)
  const el = () => ({ dataset: {}, attrs: {}, children: [], textContent: '',
    append(...c) { this.children.push(...c) }, prepend(...c) { this.children.unshift(...c) },
    setAttribute(k, v) { this.attrs[k] = v } })
  const panel = el(), head = el(), rows = el(), actions = el()
  panel.append(head, rows, actions)
  const document = { createElement: () => el(), body: { dataset: {} } }
  const fold = new Function('document', 'athleteInstantResult', 'athleteInstantHead',
    `${html.slice(start, end)}; return { athleteInstantFoldBtn }`)(document, panel, head)
  const button = fold.athleteInstantFoldBtn
  assert.equal(panel.children[0], button, 'bjælken står øverst i panelet')
  assert.equal(button.children[0], head, 'overskriften (antal reps) er selve bjælken')
  assert.equal(panel.dataset.folded, 'false')
  assert.equal(button.attrs['aria-expanded'], 'true')
  button.onclick()
  assert.equal(panel.dataset.folded, 'true')
  assert.equal(document.body.dataset.instantFolded, 'true')
  assert.equal(button.attrs['aria-expanded'], 'false')
  assert.ok(panel.children.includes(rows) && panel.children.includes(actions), 'intet fjernes, mens panelet er foldet')
  button.onclick()
  assert.equal(panel.dataset.folded, 'false')
  // foldet vises kun bjælken; et nyt resultat åbner panelet igen
  assert.match(html, /#athleteInstantResult\[data-folded="true"\] > :not\(#athleteInstantFoldBtn\) \{ display:none; \}/)
  assert.match(html, /#athleteInstantFoldBtn \{[^}]*min-height:44px/)
  // stangbane-kortet bag panelet skjules også, så videoen ses i fuld højde
  assert.match(html, /body\.athlete\[data-athlete-state="done"\]\[data-instant-folded="true"\] #barPathHUD \{ display:none !important; \}/)
  const from = html.indexOf('showInstantResult = path => {')
  assert.match(html.slice(from, html.indexOf('athleteInstantResult.hidden = false;', from)), /setAthleteInstantFolded\(false\);/)
})

test('1890v: en fejlet afsendelse viser årsagen i panelet, og Prøv igen står der stadig', async () => {
  const { document } = dom()
  const retry = ui.mountUploadRetry(document, async () => {}, () => ({ getItem: () => '1' }), '')
  const [text, button] = document.body.children[0].children
  await assert.rejects(retry.run(async () => { throw Error('Video kunne ikke uploades: new row violates row-level security policy.') }))
  assert.match(text.textContent, /^Ikke sendt · Prøv igen\. Videoen er stadig valgt/)
  assert.match(text.textContent, / Årsag: Video kunne ikke uploades: new row violates row-level security policy\.$/)
  assert.equal(button.hidden, false)
  await assert.rejects(retry.run(async () => { throw Error('') }))
  assert.doesNotMatch(text.textContent, /Årsag/)
  await assert.rejects(retry.run(async () => { throw Object.assign(Error('Annulleret'), { vcAborted: true }) }))
  assert.equal(text.textContent, 'Annulleret. Videoen er stadig valgt.')
})

test('1890v: coach på egen profil får grunden på dansk, atletens eget login får teksten uændret', () => {
  const coach = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const text = 'Video kunne ikke uploades: new row violates row-level security policy'
  assert.equal(videoSendCoachLoginReason(text, { id: 'x', coach_id: coach, user_id: null }, coach),
    `Du er logget ind som coach, og video kan kun sendes fra atletens eget login (${text})`)
  assert.match(videoSendCoachLoginReason(text, { id: 'x', coach_id: coach, user_id: other }, coach), /^Du er logget ind som coach/)
  assert.equal(videoSendCoachLoginReason(text, { id: 'x', coach_id: coach, user_id: other }, other), text)
  assert.equal(videoSendCoachLoginReason(text, { id: 'x', coach_id: coach, user_id: coach }, coach), text)
  assert.equal(videoSendCoachLoginReason(text, { id: 'x' }, 'synthetic-user'), text)
  assert.equal(videoSendCoachLoginReason(text, null, undefined), text)
  const bro = readFileSync(new URL('./athlete/useVideoCoachBro.js', import.meta.url), 'utf8')
  assert.equal(bro.match(/reply\(\{ ok: false, error: coachLoginReason\(/g)?.length, 2, 'både upload og oprettelse af rækken')
})
