// ORDRE 433: faelles session til coachen paa 390/1280 px. Syntetisk coach og
// 6 syntetiske atleter fra 428 (coach-faelles.mjs), e2e-mocken, headless
// Chromium. Ingen prod, ingen atletdata.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { MOCK_PORT, startStaticServer, byg, hentChromium, bygCoachSeed, signalerFraSeed } from '../428/coach-faelles.mjs'
import { ensureSyntheticClip } from '../../e2e/harness.mjs'
export { ROOT } from '../428/coach-faelles.mjs'
export { byg }

function mockKald(method, sti, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: MOCK_PORT, path: sti, method, agent: false, headers: body ? { 'content-type': 'video/mp4', 'content-length': body.length } : {} }, res => {
      let d = ''; res.on('data', c => { d += c }); res.on('end', () => resolve(d))
    })
    req.on('error', reject); if (body) req.write(body); req.end()
  })
}

export async function start() {
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const fx = await import('../../e2e/fixtures.mjs')
  const { server, port } = await startStaticServer()
  const browser = await hentChromium().launch({ headless: true })
  const konsolFejl = []
  // Frisk mock og side pr. opgave.
  async function session(bredde) {
    const { seed } = bygCoachSeed(fx.buildSeed, fx)
    const mock = createMockSupabase(seed)
    await mock.listen(MOCK_PORT)
    const v = seed.tables.video_analyses[0]
    await mockKald('POST', `/storage/v1/object/videocoach-uploads/${v.video_path}`, readFileSync(ensureSyntheticClip()))
    const mobil = bredde < 600
    const context = await browser.newContext(mobil
      ? { viewport: { width: bredde, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: bredde, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', e => konsolFejl.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') konsolFejl.push(m.text().slice(0, 200)) })
    const signaler = await signalerFraSeed(seed)
    await page.route('**/rest/v1/rpc/entropi_training_signals_v1', r => r.fulfill({ json: signaler }))
    await page.goto(`http://127.0.0.1:${port}/`)
    await page.locator('#athlete-auth-email').fill(fx.COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(fx.COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Alfa Testsen').first().waitFor({ timeout: 30000 })
    await page.getByText(/åbne ting/).first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(1200)
    const slut = async () => { await context.close(); await mock.close() }
    return { page, slut, seed, port }
  }
  const luk = async () => { await browser.close(); server.close() }
  return { session, luk, konsolFejl, port }
}

// Telefon-tjek af den aktuelle skaerm: sidelaens rul, elementer der stikker ud
// over kanten, tekst under 10 px (skal zoomes) og trykbare ting under 32 px.
export function telefonTjek(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const synlig = (el) => {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      const b = el.getBoundingClientRect()
      return b.width > 0 && b.height > 0
    }
    const navn = (el) => (el.innerText || el.getAttribute('aria-label') || el.title || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50)
    // Klippet af en forfaelder med overflow hidden/auto taeller ikke som "stikker ud".
    const klippet = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if (o !== 'visible') { const b = p.getBoundingClientRect(); if (b.right <= vw + 1) return true }
      }
      return false
    }
    const udover = []
    for (const el of document.querySelectorAll('body *')) {
      if (!synlig(el)) continue
      const b = el.getBoundingClientRect()
      if ((b.right > vw + 1 || b.left < -1) && !klippet(el)) udover.push({ el: navn(el), tag: el.tagName, left: Math.round(b.left), right: Math.round(b.right) })
    }
    const smaa = []
    const tjekket = new Set()
    for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, textarea, summary')) {
      if (!synlig(el) || el.disabled) continue
      const b = el.getBoundingClientRect()
      if (b.bottom < 0) continue
      if (b.height < 32 || b.width < 32) { const n = navn(el); if (!tjekket.has(n)) { tjekket.add(n); smaa.push({ el: n, w: Math.round(b.width), h: Math.round(b.height) }) } }
    }
    const lilleTekst = new Map()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim()
      if (!t || !n.parentElement || !synlig(n.parentElement)) continue
      const fs = parseFloat(getComputedStyle(n.parentElement).fontSize)
      if (fs < 10) lilleTekst.set(t.slice(0, 40), Math.round(fs * 10) / 10)
    }
    return {
      sidelaens: document.documentElement.scrollWidth - vw,
      udover: udover.slice(0, 15),
      smaaTryk: smaa,
      lilleTekst: [...lilleTekst].map(([t, fs]) => ({ t, fs })),
    }
  })
}
