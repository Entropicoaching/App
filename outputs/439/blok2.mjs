// ORDRE 439, blok 2: "din uge". Kaldes fra verify-439.mjs --blok 2.
// Seeden: ugens fire pas er logget på nær det allersidste sæt (Dag 4, Pull-ups
// sæt 3/3), med de anbefalede vægte (squat 100 kg × 5 slår sidste uges 97,5).
// Dag 1-3 har atletens egne vurderinger (4, 3, 5). Sidste sæt, vurderingen af
// Dag 4 og linjen til coachen gøres i appen.
import assert from 'node:assert/strict'
import { PAS } from '../419/uge-faelles.mjs'

const uid = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const VURDERINGER = [4, 3, 5]

function mandag() {
  const d = new Date()
  const js = d.getDay()
  d.setDate(d.getDate() - (js === 0 ? 6 : js - 1))
  d.setHours(9, 0, 0, 0)
  return d
}

export function forbered(seed, exerciseIds, fx) {
  let n = 1
  const senest = Date.now() - 2 * 3600000
  PAS.forEach((p, pi) => {
    const sessId = seed.tables.exercises.find(e => e.id === exerciseIds[pi][0]).session_id
    if (pi < 3) seed.tables.sessions.find(s => s.id === sessId).athlete_rating = VURDERINGER[pi]
    const dag = Math.min(mandag().getTime() + p.ugedag * 86400000, senest - (3 - pi) * 3600000)
    p.oevelser.forEach((o, oi) => {
      const sidste = pi === PAS.length - 1 && oi === p.oevelser.length - 1
      for (let s = 1; s <= o.saet; s++) {
        if (sidste && s === o.saet) continue
        const reps = parseInt(o.reps, 10) || 8
        const vaegt = o.kg ?? (o.navn === 'Pull-ups' || o.navn === 'Planke' ? 0 : 20 + oi * 5)
        seed.tables.exercise_logs.push({ id: uid(n++), exercise_id: exerciseIds[pi][oi], athlete_id: fx.ATHLETE_ID, set_number: s, weight: vaegt, reps_completed: reps, note: null, rpe_actual: 7.5, rpe_planned: 7.5, skipped: false, logged_at: new Date(dag + (oi * 10 + s) * 120000).toISOString() })
      }
    })
  })
}

const tabel = async (mockUrl, navn) => (await (await fetch(`${mockUrl}/__e2e/table?name=${navn}`)).json())

export async function blok2({ page, context, port, shot, trin, resultat, mockUrl, exerciseIds, venterPaa, godkendt }) {
  const skrivninger = []
  context.on('request', (r) => {
    const m = r.url().match(/\/rest\/v1\/((?:rpc\/)?[a-z_0-9]+)/)
    // rpc/get_* er læsninger (PostgREST kalder funktioner med POST).
    if (m && !m[1].startsWith('rpc/get_') && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(r.method())) skrivninger.push(m[1])
  })
  const ugensIds = new Set(exerciseIds.flat())

  // Ugens sidste sæt.
  await venterPaa('Pull-ups', 3)
  assert.equal(await page.locator('[data-din-uge]').count(), 0, '"din uge" må ikke stå, før ugens sidste pas er klaret')
  trin('før sidste sæt: Dagens pas står på Pull-ups sæt 3/3, intet "din uge"-kort')
  await page.waitForTimeout(300)
  await godkendt().click()
  const kort = page.locator('[data-din-uge]')
  await kort.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(800)

  const rows = (await tabel(mockUrl, 'exercise_logs')).filter(r => ugensIds.has(r.exercise_id) && !r.skipped)
  const tonnage = rows.reduce((s, r) => s + r.weight * r.reps_completed, 0)
  const forventetTonnage = `${Math.round(tonnage).toLocaleString('da-DK')} kg`
  const tekst = (await kort.innerText()).replace(/\s+/g, ' ')
  resultat.fund.kortTekst = tekst
  trin(`kortet: "${tekst.slice(0, 220)}"`)
  assert.match(tekst, /Uge 4 er klaret\./)
  assert.match(tekst, /4\/4 Pas/i, 'fire pas af fire')
  assert.ok(tekst.toLowerCase().replace(/(\d) kg/, '$1kg').includes(`${forventetTonnage.replace(' kg', 'kg')} tonnage`), `tonnagen skal være mockens ${forventetTonnage}`)
  const antalRekorder = await page.locator('[data-din-uge-rekorder]').getAttribute('data-din-uge-rekorder')
  assert.ok(Number(antalRekorder) >= 1, 'ugens rekorder skal stå på kortet')
  assert.match(tekst, /Squat e1RM 117 kg \+3 kg/, 'squat-rekorden fra ugen')
  assert.match(tekst, new RegExp(`${antalRekorder} Rekorder`, 'i'))
  trin(`tal: 4/4 pas, ${forventetTonnage} (= mockens ${rows.length} gennemførte sæt), ${antalRekorder} rekorder`)

  // Dag 4 vurderes på Dagens pas-kortet (419); vurderingen står derefter i "din uge".
  const foer = await page.locator('[data-vurdering]').evaluateAll(els => els.map(e => e.getAttribute('data-vurdering')))
  await page.getByRole('button', { name: 'Passet gik: 4 af 5', exact: true }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('[data-vurdering]')].map(e => e.getAttribute('data-vurdering')).join(',') === '4,3,5,4', null, { timeout: 8000 })
  trin(`vurderinger: før ${JSON.stringify(foer)}, efter Dag 4 = 4: [4,3,5,4]`)
  await kort.scrollIntoViewIfNeeded()
  await shot('03-din-uge')

  // Linjen til coachen: en almindelig besked.
  const beskederFoer = (await tabel(mockUrl, 'messages')).length
  await page.locator('#din-uge-linje').fill('Squatten føltes let i denne uge.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.locator('[data-din-uge-sendt]').waitFor({ state: 'visible', timeout: 8000 })
  const beskeder = await tabel(mockUrl, 'messages')
  const nye = beskeder.slice(beskederFoer)
  resultat.fund.nyeBeskeder = nye.map(b => ({ sender_role: b.sender_role, category: b.category, content: b.content }))
  trin(`sendt: ${nye.length} ny besked ${JSON.stringify(resultat.fund.nyeBeskeder)}`)
  assert.equal(nye.length, 1)
  assert.equal(nye[0].sender_role, 'athlete')
  assert.equal(nye[0].category, 'besked')
  assert.equal(nye[0].content, 'Om uge 4: Squatten føltes let i denne uge.')
  await kort.scrollIntoViewIfNeeded()
  await shot('04-din-uge-sendt')

  // Genåbnet: kortet står der stadig, linjen er ikke til at sende igen.
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('[data-din-uge]').waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(800)
  assert.equal(await page.locator('[data-din-uge-sendt]').count(), 1, 'efter genåbning: "sendt", ingen ny linje')
  assert.equal((await tabel(mockUrl, 'messages')).length, beskederFoer + 1, 'ingen ekstra besked')
  trin('genåbnet: kortet står stadig, linjen står som sendt, stadig én besked')

  // Coachen ser intet nyt: kun de tabeller appen i forvejen skriver til.
  const tabeller = [...new Set(skrivninger)].sort()
  resultat.fund.skrevetTil = tabeller
  trin(`skrivninger i forløbet: ${tabeller.join(', ')}`)
  const tilladt = new Set(['exercise_logs', 'sessions', 'messages', 'personal_records', 'profiles'])
  assert.ok(tabeller.every(t => tilladt.has(t)), `uventet skrivning: ${tabeller.join(', ')}`)
  const bredde = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }))
  assert.ok(bredde.scroll <= bredde.inner, 'ingen vandret scroll på 390 px')
}
