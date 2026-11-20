// ORDRE 2019 (Marc 20. nov.: "husk jeg er pt den eneste træner, kan vi arbejde på at optimere mit orkflow"):
// fra rækken "Ulæst besked" på coachens forside skal svarfeltet stå klar i Beskeder uden at rulle.
// Dag og tid er sat fast (mandag 23. nov. 2026) af buildMandag og page.clock.
// Kørsel: E2E_VITE_PORT=5291 E2E_MOCK_PORT=8992 VITE_SUPABASE_URL=http://127.0.0.1:8992 node e2e/besked-svarfelt-2019.spec.mjs
// E2E_BREDDE=1280 for desktop, E2E_TEMA=lys for lyst tema, E2E_2019_FOER=1 måler uden at kræve rulningen.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { buildMandag } from './coach-uge-2005a.spec.mjs'

const FOER = process.env.E2E_2019_FOER === '1'
const DESKTOP = process.env.E2E_BREDDE === '1280'
const LYS = process.env.E2E_TEMA === 'lys'
const LABEL = `${FOER ? 'foer' : 'efter'}-${DESKTOP ? 1280 : 390}${LYS ? '-lys' : ''}`
const FAST_TID = '2026-11-23T08:00:00Z'

const maal = page => page.evaluate(() => {
  const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) } }
  const felt = document.querySelector('textarea[aria-label="Din besked"]')
  const send = [...(felt?.parentElement?.querySelectorAll('button') || [])].find(b => /^(Send|Sender)/.test(b.textContent.trim()))
  const besked = [...document.querySelectorAll('li')].find(li => li.textContent.includes('Hej coach, mandag gik fint.'))
  return { hoejde: window.innerHeight, scrollY: Math.round(window.scrollY), felt: rect(felt), send: rect(send), besked: rect(besked),
    sendTekst: send?.textContent || null, fokus: document.activeElement?.tagName || null }
})

async function main() {
  const mock = createMockSupabase(buildMandag())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: DESKTOP ? { width: 1280, height: 900 } : { width: 390, height: 844 },
      colorScheme: LYS ? 'light' : 'dark' })
    const errors = []
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
    await page.clock.setFixedTime(new Date(FAST_TID))
    await page.goto(APP_URL)
    if (LYS) { await page.evaluate(() => localStorage.setItem('entropi:tema', 'lys')); await page.reload() }
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: /Åbn programmet for Atlet Sendt/ }).waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1500)
    const raekke = page.locator('button', { hasText: /Atlet Besked · 1 ulæst besked/ }).first()
    await raekke.waitFor({ state: 'attached', timeout: 15000 })
    if (!(await raekke.isVisible())) {
      const lukket = await raekke.evaluate(el => { let o = null; for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) o = p; o?.querySelector(':scope > summary')?.setAttribute('data-2019', '1'); return !!o })
      if (lukket) await page.locator('summary[data-2019="1"]').first().click()
    }
    await raekke.click()
    await page.getByText('Hej coach, mandag gik fint.').first().waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForTimeout(1500)
    const m = await maal(page)
    console.log(`MAAL ${LABEL} ${JSON.stringify(m)}`)
    await page.screenshot({ path: join(process.env.E2E_2019_OUT || OUT_DIR, `besked-svarfelt-2019-${LABEL}.png`), fullPage: false })
    const indenfor = r => !!r && r.top >= 0 && r.bottom <= m.hoejde
    const synligt = indenfor(m.felt) && indenfor(m.send)
    console.log(`SVARFELT ${LABEL} synligt uden at rulle: ${synligt ? 'ja' : 'nej'}`)
    if (!FOER) {
      assert.ok(synligt, `svarfeltet og Send skal stå inden for skærmen: ${JSON.stringify(m)}`)
      assert.ok(m.besked && m.besked.bottom > 0 && m.besked.top < m.felt.top, `beskeden skal kunne ses over feltet: ${JSON.stringify(m)}`)
      assert.notEqual(m.fokus, 'TEXTAREA', 'feltet må ikke have fokus (intet tastatur)')
      console.log(`\nGRØN: svarfeltet står klar ${LABEL}.`)
    }
    const bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(bred <= 0, `ingen vandret scroll, fandt ${bred}px`)
    assert.deepEqual(errors, [], `Ingen sidefejl forventet: ${JSON.stringify(errors)}`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}

main()
