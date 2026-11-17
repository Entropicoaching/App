import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { invitationTekst, kopierInvitation, KOPIERING_FEJLET } from './invitationTekst.mjs'
import { normalizeAthleteLoginEmail } from '../athleteOnboarding.js'

const kilde = fil => readFileSync(new URL(fil, import.meta.url), 'utf8')

test('teksten indeholder mailen og appens adresse', () => {
  const t = invitationTekst({ email: 'atlet.t@example.dk', appAdresse: 'https://app.entropicoaching.dk' })
  assert.match(t, /atlet\.t@example\.dk/)
  assert.match(t, /https:\/\/app\.entropicoaching\.dk/)
  assert.match(t, /netop denne mail/)
  assert.match(t, /første uge/)
})

test('mailen normaliseres som normalizeAthleteLoginEmail', () => {
  const raa = '  Atlet.T@Example.DK '
  assert.ok(invitationTekst({ email: raa, appAdresse: 'x.dk' }).includes(normalizeAthleteLoginEmail(raa)))
  assert.ok(!invitationTekst({ email: raa, appAdresse: 'x.dk' }).includes('Atlet.T'))
})

test('tom eller blank mail giver ingen tekst og dermed ingen knap', () => {
  for (const email of ['', '   ', null, undefined]) assert.equal(invitationTekst({ email, appAdresse: 'x.dk' }), null)
  assert.equal(invitationTekst(), null)
})

test('adresse uden https faar https, og skraastreg til sidst fjernes', () => {
  assert.match(invitationTekst({ email: 'a@b.dk', appAdresse: 'app.entropicoaching.dk/' }), /: https:\/\/app\.entropicoaching\.dk\n/)
})

test('ingen tankestreger i teksten', () => {
  assert.doesNotMatch(invitationTekst({ email: 'a@b.dk', appAdresse: 'app.entropicoaching.dk' }), /[–—]| - /)
})

test('kopiering lykkes med stub og fejler synligt uden clipboard eller ved afvisning', async () => {
  const set = []
  const ok = await kopierInvitation('tekst', { writeText: async t => { set.push(t) } })
  assert.deepEqual([ok.ok, set], [true, ['tekst']])
  for (const clip of [undefined, { writeText: async () => { throw new Error('nej') } }]) {
    const r = await kopierInvitation('tekst', clip)
    assert.equal(r.ok, false)
    assert.equal(r.besked, KOPIERING_FEJLET)
  }
})

test('knappen staar eet sted (profilkortet), vises kun uden koblet konto og har 44 px trykflade', () => {
  assert.equal((kilde('./ProfilHoved.jsx').match(/<InvitationKnap /g) || []).length, 1)
  const k = kilde('./InvitationKnap.jsx')
  assert.match(k, /a\.user_id\) return null/)
  assert.match(k, /minHeight: 44/)
  assert.match(k, /role=\{svar\.ok \? 'status' : 'alert'\}/)
  assert.match(kilde('../../vite.config.js'), /__APP_ADRESSE__.*public.*CNAME/s)
})
