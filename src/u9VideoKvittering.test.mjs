import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ui, dom } from './uploadRetryFakes.mjs'
import { feedbackText } from './entropi2/conversation/conversationModel.mjs'

// U9 punkt 3 (Marc 11. nov.): "savner en bekræftelse på videoen er sendt ordentligt til coach".
// Efter afsendelse en tydelig kvittering med tidspunkt, der bliver stående; samme status i beskedtråden.
// Fejler den: "Ikke sendt · Prøv igen".
const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
const success = html.slice(html.indexOf('async function vcAthleteUploadAndGo'), html.indexOf('function vcAthleteCancelUpload'))

test('U9 3: videosiden kvitterer "Sendt til Marc ✓" med klokkeslæt i statuskortet, som bliver stående', () => {
  assert.match(success, /setAthleteState\('sent', `kl\. \$\{/)
  assert.match(html, /sent: \['Sendt til Marc ✓'/)
  assert.doesNotMatch(success, /athleteStatusEl\.hidden = true/, 'kvitteringen skjules ikke længere')
  assert.doesNotMatch(success, /setTimeout\(\(\) => say\(''\)/, 'kvitteringen forsvinder ikke efter 8 sekunder')
})

test('U9 3: fejl siger "Ikke sendt · Prøv igen" både i banner og panel', async () => {
  assert.match(success, /Ikke sendt · Prøv igen/)
  const f = dom()
  let calls = 0, status
  const send = () => status.run(async () => { calls++; if (calls === 1) throw Error('offline'); return 'ok' })
  status = ui.mountUploadRetry(f.document, send, () => ({ getItem: () => '1' }))
  const [text] = f.document.body.children[0].children
  await assert.rejects(send(), /offline/)
  assert.match(text.textContent, /^Ikke sendt · Prøv igen\./)
  await send()
  assert.match(text.textContent, /^Sendt til Marc ✓ kl\. \d{2}\.\d{2}/)
})

test('U9 3: beskedtråden viser samme status med tidspunkt, også med atletens note', () => {
  const row = { id: 'v1', status: 'draft', source_mode: 'athlete_submission', created_at: '2026-11-11T10:04:00Z' }
  assert.equal(feedbackText(row), 'Sendt til Marc ✓ kl. 11.04 · afventer feedback')
  assert.equal(feedbackText({ ...row, session_context: { athlete_note: 'Tung i bunden' } }),
    'Sendt til Marc ✓ kl. 11.04 · afventer feedback\nTung i bunden')
  assert.equal(feedbackText({ ...row, created_at: null }), 'Sendt til Marc ✓ · afventer feedback')
})
