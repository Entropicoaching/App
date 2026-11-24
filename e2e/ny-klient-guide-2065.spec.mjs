// ORDRE 2065: ny klients guide lover kun det, klienten ser, og lander rigtigt (mock, 390x844).
// (a) uge starter naeste mandag: ingen "Start dagens pas"-loefte, guiden siger hvornaar foerste pas er og hvor det findes, landing Hjem med "Start næste pas" og datoen.
// (b) pas i dag: guiden lander paa Hjem med "Start dagens pas".
// Egen koersel: `npm run e2e:ny-klient-guide-2065` (MAAL=1 skriver kun, hvad guiden siger).
import assert from 'node:assert/strict'
import { COACH_USER, ATHLETE_ID, WEEK_ID, SESSION_ID, EXERCISE_ID, buildSeed } from './fixtures.mjs'

const MAIL = 'klient@e2e.test'
const MAAL = process.env.MAAL === '1'

function seedFor(naesteMandag) {
  const seed = buildSeed(); const t = seed.tables
  const w = t.weeks[0]
  if (naesteMandag) {
    const d = new Date(w.start_date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 7)
    w.start_date = d.toISOString().slice(0, 10)
    t.sessions[0].weekday = 0
  }
  t.exercises[0].intensity = null; t.exercises[0].recommended_weight = null
  Object.assign(t.athletes[0], { name: 'Testklient', user_id: null, email: MAIL, onboarding_completed_at: null })
  t.profiles = t.profiles.filter(p => p.id !== t.athletes[0].user_id && p.email !== 'atlet@e2e.test')
  return seed
}

async function kor(browser, createMockSupabase, MOCK_PORT, APP_URL, naesteMandag) {
  const mock = createMockSupabase(seedFor(naesteMandag))
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const ap = await ctx.newPage()
    ap.on('pageerror', err => console.error('[browser pageerror]', err)); ap.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text().slice(0, 300)) })
    await ap.goto(APP_URL)
    await ap.getByText('Opret her').click()
    await ap.locator('#athlete-auth-email').fill(MAIL)
    await ap.locator('#athlete-auth-password').fill('e2e-pass-klient-1')
    await ap.getByRole('button', { name: /Opret konto/ }).click()
    await ap.getByRole('button', { name: /Videre/i }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(async e => { console.error('SIDE:', (await ap.locator('body').innerText()).slice(0, 500)); throw e })
    const trin = []; let tryk = 0
    for (let i = 0; i < 8; i++) {
      const v = ap.getByRole('button', { name: /Videre|Se dit program|Gå til forsiden/i })
      if (!(await v.count())) break
      trin.push((await ap.locator('h1, p').allInnerTexts()).join(' | '))
      await v.first().click(); tryk++; await ap.waitForTimeout(600)
    }
    const hjem = await ap.getByRole('button', { name: /Start dagens pas/ }).count()
    const hjemNaeste = await ap.getByRole('button', { name: /Start næste pas/ }).count()
    const program = await ap.getByRole('button', { name: /^Dag 1 Squat/ }).count()
    const body = await ap.locator('body').innerText()
    let hjemTekst = null
    if (MAAL) {
      await ap.getByRole('button', { name: /^Hjem$/ }).first().click(); await ap.waitForTimeout(800)
      hjemTekst = (await ap.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500) + ' || KNAPPER: ' + (await ap.getByRole('button').allInnerTexts()).join(' / ').slice(0, 600)
    }
    return { trin, tryk, hjem, hjemNaeste, program, body, hjemTekst }
  } finally { await ctx.close(); await mock.close().catch(() => {}) }
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  try {
    const a = await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, true)
    const b = await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, false)
    if (MAAL) {
      for (const [n, r] of [['a (uge naeste mandag)', a], ['b (pas i dag)', b]]) {
        console.log(`\n== ${n}: ${r.tryk} tryk i guiden; landing: Start dagens pas-knap=${r.hjem}, programliste=${r.program}`)
        r.trin.forEach((t, i) => console.log(`trin ${i + 1}: ${t}`))
        console.log('landing-tekst:', r.body.replace(/\s+/g, ' ').slice(0, 400))
        console.log('hjem-tekst:', r.hjemTekst)
      }
      return
    }
    // (a) ingen loefte om "Start dagens pas"; foerste pas og sted naevnes; landing paa Program.
    const aTekst = a.trin.join(' ')
    assert.doesNotMatch(aTekst, /Start dagens pas/, 'a: guiden lover Start dagens pas uden pas i dag')
    assert.match(aTekst, /Start næste pas/, 'a: guiden naevner ikke Start næste pas')
    assert.match(aTekst, /første pas er mandag den \d+\. \w+/i, 'a: guiden siger ikke hvornaar foerste pas er')
    assert.match(aTekst, /under Program/, 'a: guiden siger ikke hvor passet findes')
    assert.equal(a.hjem, 0); assert.ok(a.hjemNaeste > 0, 'a: lander ikke paa Hjem med Start næste pas')
    assert.match(a.body, /\d+\. (jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i, 'a: landingen viser ingen dato')
    // (b) pas i dag: guiden peger paa Hjem og lander der med knappen.
    assert.match(b.trin.join(' '), /Start dagens pas/, 'b: guiden nævner ikke Start dagens pas')
    assert.ok(b.hjem > 0, 'b: lander ikke paa Hjem med Start dagens pas')
    assert.ok(a.tryk <= 3 && b.tryk <= 3, `guiden er for lang: a ${a.tryk}, b ${b.tryk} tryk`)
    console.log('ny-klient-guide-2065: OK (a: foerste pas + Hjem med Start næste pas, b: Hjem med Start dagens pas, max 3 tryk)')
  } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
}
main().catch(err => { console.error(err); process.exit(1) })
