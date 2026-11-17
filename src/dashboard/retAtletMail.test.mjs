import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { normalizeAthleteLoginEmail } from '../athleteOnboarding.js'

// Ordre 1600: coachen retter login-mailen paa en ikke koblet atlet. Kun syntetiske data.
registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier) || specifier.endsWith('/progressionState.js')) {
    return { url: new URL('../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { retAtletMail } = await import('./atletHandlinger.js')

const ATLET_T = { id: '33333333-3333-4333-8333-0000000000a1', name: 'Atlet T', email: 'atlet.t@e2e.test', user_id: null }

function klient(svar) {
  const kald = []
  return {
    kald,
    from(table) {
      const q = {
        update(payload) { kald.push(['update', table, payload]); return q },
        eq(k, v) { kald.push(['eq', k, v]); return q },
        is(k, v) { kald.push(['is', k, v]); return q },
        select() { kald.push(['select']); return q },
        then(ok, nej) { return (svar instanceof Error ? Promise.reject(svar) : Promise.resolve(svar)).then(ok, nej) },
      }
      return q
    },
  }
}

test('rettet mail gemmes normaliseret og kun paa en ikke koblet raekke', async () => {
  const db = klient({ data: [{ ...ATLET_T, email: 'atlet.t2@e2e.test' }], error: null })
  const svar = await retAtletMail({ athlete: ATLET_T, email: '  Atlet.T2@E2E.test ', client: db })
  assert.equal(svar.ok, true)
  assert.equal(svar.athlete.email, 'atlet.t2@e2e.test')
  assert.deepEqual(db.kald, [
    ['update', 'athletes', { email: normalizeAthleteLoginEmail('  Atlet.T2@E2E.test ') }],
    ['eq', 'id', ATLET_T.id], ['is', 'user_id', null], ['select'],
  ])
  assert.match(svar.besked, /Kopiér invitationen igen/)
})

test('koblet atlet kan ikke faa ny mail, og intet skrives', async () => {
  for (const user_id of ['99999999-0000-4000-8000-000000000002', undefined]) {
    const db = klient({ data: [], error: null })
    const svar = await retAtletMail({ athlete: { ...ATLET_T, user_id }, email: 'ny@e2e.test', client: db })
    assert.equal(svar.ok, false)
    assert.match(svar.besked, /koblet/)
    assert.deepEqual(db.kald, [])
  }
})

test('blev atleten koblet imens, rammer skrivningen ingen raekke og siger det', async () => {
  const svar = await retAtletMail({ athlete: ATLET_T, email: 'ny@e2e.test', client: klient({ data: [], error: null }) })
  assert.equal(svar.ok, false)
  assert.match(svar.besked, /ikke gemt/)
})

test('tom eller ugyldig mail afvises med synlig besked uden skrivning', async () => {
  for (const email of ['', '   ', null, 'atlet', 'atlet@', '@e2e.test', 'atlet t@e2e.test', 'atlet@e2e']) {
    const db = klient({ data: [], error: null })
    const svar = await retAtletMail({ athlete: ATLET_T, email, client: db })
    assert.equal(svar.ok, false, String(email))
    assert.match(svar.besked, /gyldig mail/)
    assert.deepEqual(db.kald, [])
  }
})

test('dublet, afvisning og netfejl giver en synlig fejl', async () => {
  const dublet = await retAtletMail({ athlete: ATLET_T, email: 'ny@e2e.test', client: klient({ data: null, error: { code: '23505', message: 'duplicate' } }) })
  assert.deepEqual([dublet.ok, /allerede den mail/.test(dublet.besked)], [false, true])
  for (const fejl of [{ data: null, error: { code: '42501', message: 'rls' } }, new Error('net')]) {
    const svar = await retAtletMail({ athlete: ATLET_T, email: 'ny@e2e.test', client: klient(fejl) })
    assert.deepEqual([svar.ok, svar.besked], [false, 'Mailen blev ikke gemt. Prøv igen.'])
  }
})

test('uaendret mail skriver intet', async () => {
  const db = klient({ data: [], error: null })
  const svar = await retAtletMail({ athlete: ATLET_T, email: ' ATLET.T@e2e.test', client: db })
  assert.equal(svar.ok, true)
  assert.deepEqual(db.kald, [])
})

test('feltet staar eet sted, kun uden koblet konto, med 44 px trykflade og synlig besked', () => {
  const k = readFileSync(new URL('./ProfilHoved.jsx', import.meta.url), 'utf8')
  assert.equal((k.match(/id="atlet-login-mail"/g) || []).length, 1)
  assert.match(k, /a\.user_id === null && \(\s*<form onSubmit=\{gemAtletMail\}/)
  assert.match(k, /await import\('\.\/atletHandlinger\.js'\)/)
  assert.match(k, /role=\{mailSvar\.ok \? 'status' : 'alert'\}/)
  assert.match(k, /minWidth: 0, minHeight: 44/)
  assert.doesNotMatch(k, /^import .*atletHandlinger/m)
  for (const fil of ['./OversigtTab.jsx', '../Dashboard.jsx']) assert.doesNotMatch(readFileSync(new URL(fil, import.meta.url), 'utf8'), /atlet-login-mail|retAtletMail/)
})
