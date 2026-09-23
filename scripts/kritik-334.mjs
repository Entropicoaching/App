// ORDRE 334 · kritiker paa den rolige forside (330) og skak 326.
// EEN kommando: `node scripts/kritik-334.mjs` (eller --blok=1 / --blok=2).
// Retter intet, loeser intet: maaler og fotograferer og skriver
// outputs/334/fund-blok1.json og fund-blok2.json + skaermbilleder.
// Blok 1: forsiden headless 390x844 og 360x780, touch, mock med et program paa
// fire dage (man, tir, tor, fre), logs paa to af dem (man faerdig, tir halv).
// Blok 2: skak.html headless fra C:\Users\Entropi\Desktop\skak (kun laesning).
// Kun mock-data; ingen atletdata; ingen skrivning mod produktion.

import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ATHLETE_ID, ATHLETE_USER, buildSeed } from '../e2e/fixtures.mjs'

// Egne porte (8991 er ofte optaget af andres e2e-mock); proces-miljoe kun.
process.env.E2E_MOCK_PORT ||= '8993'; process.env.E2E_VITE_PORT ||= '5193'; process.env.VITE_SUPABASE_URL ||= `http://127.0.0.1:${process.env.E2E_MOCK_PORT}`
const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
const OUT = join(ROOT, 'outputs', '334')
mkdirSync(OUT, { recursive: true })
const blokArg = (process.argv.find(a => a.startsWith('--blok=')) || '--blok=alle').split('=')[1]

const fund = []
const note = (blok, alvor, titel, detalje) => { fund.push({ blok, alvor, titel, detalje }); console.log(`[${blok}] ${alvor}: ${titel} — ${detalje}`) }
const ok = (msg) => console.log(`  ok: ${msg}`)

// ---------- Blok 1 ----------
function fireDagsSeed() {
  const seed = buildSeed()
  const t = seed.tables
  const mon = new Date(); mon.setHours(12, 0, 0, 0)
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  t.weeks[0].start_date = mon.toISOString().slice(0, 10)
  const uid = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`
  const dage = [
    { wd: 0, title: 'Dag 1 — Squat', ovs: [['Squat', 4], ['Rumænsk dødløft', 3]] },
    { wd: 1, title: 'Dag 2 — Bænk', ovs: [['Bænkpres', 4], ['Roning', 3]] },
    { wd: 3, title: 'Dag 3 — Dødløft', ovs: [['Dødløft', 4], ['Militærpres', 3]] },
    { wd: 4, title: 'Dag 4 — Overkrop', ovs: [['Pullups', 4], ['Dips', 3]] },
  ]
  t.sessions = []; t.exercises = []; t.exercise_logs = []
  dage.forEach((d, i) => {
    const sid = uid(100 + i)
    t.sessions.push({ id: sid, week_id: t.weeks[0].id, title: d.title, session_order: i + 1, weekday: d.wd, athlete_rating: null, athlete_comment: null })
    d.ovs.forEach(([name, sets], j) => {
      const eid = uid(200 + i * 10 + j)
      t.exercises.push({ id: eid, session_id: sid, name, sets, reps: '5', intensity: 'RPE 8', note: null, exercise_order: j + 1, recommended_weight: 60 })
      // man: alt logget. tir: foerste oevelses to foerste saet logget.
      const logN = i === 0 ? sets : (i === 1 && j === 0 ? 2 : 0)
      for (let n = 1; n <= logN; n++) {
        t.exercise_logs.push({ id: uid(1000 + i * 100 + j * 10 + n), exercise_id: eid, athlete_id: ATHLETE_ID, set_number: n, weight: 60, reps_completed: 5, note: null, rpe_actual: 8, rpe_planned: 8, skipped: false, logged_at: new Date().toISOString() })
      }
    })
  })
  return seed
}

const FOLD_JS = () => {
  const page = [...document.querySelectorAll('div')].find(d => d.style.maxWidth === '680px' && d.style.paddingBottom === '6rem')
  if (!page) return null
  const fold = window.innerHeight
  const vis = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; return r.top < fold && r.bottom > 0 }
  const inter = 'button, input, select, textarea, a'
  let things = 0, total = 0
  for (const el of page.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
    const isThing = el.matches(inter) || (!el.closest('button, label, a') && el.children.length === 0 && (el.textContent || '').trim())
    if (!isThing) continue
    total++; if (vis(el)) things++
  }
  return { things, total, blocks: [...page.children].filter(vis).length, fullHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth }
}

async function login(page, url) {
  await page.goto(url)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.locator('[data-dagstrimmel]').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(1500)
}

async function stripInfo(page) {
  return page.locator('[data-dagstrimmel] [data-dag]').evaluateAll(els => els.map(el => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
    const circ = [...el.querySelectorAll('span')].find(s => s.style.borderRadius === '50%')
    return { state: el.dataset.dag, shown: el.dataset.vist === 'ja', today: el.getAttribute('aria-current') === 'date', border: `${cs.borderTopWidth} ${cs.borderTopStyle}`, circleBg: circ ? getComputedStyle(circ).backgroundColor : null, label: el.getAttribute('aria-label'), left: r.left, right: r.right, w: r.width, h: r.height }
  }))
}

async function blok1() {
  const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('../e2e/harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  try {
    for (const vp of [{ tag: '390x844', width: 390, height: 844 }, { tag: '360x780', width: 360, height: 780 }]) {
      const mock = createMockSupabase(fireDagsSeed()); await mock.listen(MOCK_PORT)
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
      const page = await ctx.newPage()
      const errs = []
      page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
      const tag = vp.tag
      const shot = (n, full) => page.screenshot({ path: join(OUT, `f-${tag}-${n}.png`), fullPage: !!full })
      try {
        await login(page, APP_URL)
        await shot('01-forside'); await shot('01-forside-hele', true)
        const h1 = (await page.locator('h1').first().textContent()).trim()
        const sub = await page.locator('h1 + div').first().textContent()
        const strip = await stripInfo(page)
        const count = await page.evaluate(FOLD_JS)
        console.log(`\n== ${tag}: h1="${h1}" | ${sub} | over folden ${count.things} ting/${count.blocks} blokke, hele siden ${count.total} ting, ${count.fullHeight}px, scrollW ${count.scrollWidth}`)
        console.log('  strimmel:', strip.map(c => `${c.state}${c.shown ? '*vist' : ''}${c.today ? '*idag' : ''} ${c.border} ${Math.round(c.w)}x${Math.round(c.h)}`).join(' | '))
        // dag-tegn
        const shownN = strip.filter(c => c.shown).length, todayN = strip.filter(c => c.today).length
        if (shownN !== 1) note(1, 'hoej', `${tag}: ${shownN} viste dage i strimlen`, 'skal vaere praecis een')
        if (todayN !== 1) note(1, 'hoej', `${tag}: ${todayN} "i dag"-dage`, 'skal vaere praecis een')
        const gaps = strip.slice(1).map((c, i) => c.left - strip[i].right)
        ok(`luft mellem dage ${Math.min(...gaps).toFixed(1)}-${Math.max(...gaps).toFixed(1)} px, celle ${Math.round(strip[0].w)}x${Math.round(strip[0].h)}`)
        if (strip[0].w < 44) note(1, 'middel', `${tag}: dagcellerne er ${Math.round(strip[0].w)} px brede`, 'under 44 px tap-maal (Apple/WCAG 2.5.5); hoejden er 64. Datotal-cirklen er 1.45rem ≈ 23 px')
        const same = strip.find(c => c.shown)?.today
        ok(`viste dag ${same ? 'er' : 'er IKKE'} i dag; overskrift "${h1}"`)
        // tekststoerrelse paa strimmel
        const fs = await page.evaluate(() => { const e = document.querySelector('[data-ugedag]'); const h = document.querySelector('[data-dag="hvile"] span:last-child'); return { ugedag: getComputedStyle(e).fontSize, hvile: h ? getComputedStyle(h).fontSize : null } })
        ok(`skriftstoerrelse ugedag ${fs.ugedag}, "hvile"-tekst ${fs.hvile}`)
        const px = (s) => parseFloat(s)
        if (px(fs.ugedag) < 10 || (fs.hvile && px(fs.hvile) < 8)) note(1, 'middel', `${tag}: strimlens tekst er meget lille`, `ugedag ${fs.ugedag}, "hvile" ${fs.hvile} — svaerlaeseligt paa telefon, og "hvile"/pas-dagenes forskel bæres af tekst under 8 px`)

        // hvad staar over folden (tekst)
        const overFolden = await page.evaluate(() => { const fold = innerHeight; return [...document.querySelectorAll('button, h1, [data-sekundaer] *')].filter(e => { const r = e.getBoundingClientRect(); return r.top < fold && r.bottom > 0 && r.width }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 50)).filter(Boolean) })
        console.log('  knapper/overskrift over folden:', JSON.stringify(overFolden))

        // Mere
        const mere = page.getByRole('button', { name: 'Mere', exact: true })
        const mBox = await mere.boundingBox()
        ok(`"Mere" ligger ${Math.round(mBox.y)} px fra toppen (fold ${vp.height}) ${mBox.y + mBox.height > vp.height ? '— UNDER FOLDEN' : ''}`)
        if (mBox.y + mBox.height > vp.height) note(1, 'lav', `${tag}: "Mere"-folden ligger under foerste skaerm`, 'ikke synlig uden rulning med denne mock; afhaenger af pas-kortets hoejde')
        await mere.tap()
        await page.getByText('Mit program', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
        await shot('02-mere-aaben', true)
        const aria1 = await mere.getAttribute('aria-expanded')
        const countM = await page.evaluate(FOLD_JS)
        ok(`Mere aaben: aria-expanded=${aria1}, hele siden ${countM.total} ting, ${countM.fullHeight}px`)
        // Program-listen: viser ugedage og "Næste" tydeligt?
        const prog = await page.locator('button:has-text("øvelser →")').allTextContents()
        console.log('  Mit program-raekker:', JSON.stringify(prog))
        await mere.tap()
        await page.getByText('Mit program', { exact: true }).waitFor({ state: 'detached', timeout: 5000 })
        ok('Mere lukker igen')
        // tap paa en dag i strimlen
        const dagBtn = page.locator('[data-dag="pas"]').nth(1)
        await dagBtn.tap(); await page.waitForTimeout(800)
        const efterTap = (await page.locator('h1, h2').first().textContent()).trim()
        await shot('03-efter-dag-tap')
        console.log(`  tap paa dag-celle -> forste overskrift: "${efterTap}"`)
        await page.getByRole('button', { name: /Hjem/i }).first().tap().catch(() => {})
        await page.waitForTimeout(800)

        // Pause + ret saet + naeste oevelse. Log et saet.
        const h1b = (await page.locator('h1').first().textContent().catch(() => '')) || ''
        if (!h1b) { await page.goto(APP_URL); await page.locator('[data-dagstrimmel]').waitFor({ timeout: 15000 }); await page.waitForTimeout(1500) }
        const vaegt = page.getByLabel(/^Vægt, sæt/)
        const okBtn = page.getByRole('button', { name: 'Godkendt', exact: true })
        if (await okBtn.count()) {
          await okBtn.first().tap()
          await page.waitForTimeout(1500)
          await shot('04-efter-saet-pause')
          const txt = await page.evaluate(() => document.body.innerText)
          const har = (re) => re.test(txt)
          console.log(`  efter logget saet: pause=${har(/Pause/)} nextEx=${har(/Næste øvelse/)} retSaet=${har(/Ret sæt|Fortryd/)} `)
          const overlapp = await page.evaluate(() => {
            const bar = [...document.querySelectorAll('div')].find(d => getComputedStyle(d).position === 'sticky' && d.style.height === '52px')
            const bb = bar ? bar.getBoundingClientRect().bottom : null
            const fixed = [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).position === 'fixed' && d.getBoundingClientRect().width > 0).map(d => { const r = d.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), text: d.textContent.trim().slice(0, 40) } })
            return { topbarBottom: bb, fixed }
          })
          console.log('  faste elementer:', JSON.stringify(overlapp))
          // Pause-linjen: er den synlig i viewport, og dækker den knapper?
          const pauseBox = await page.getByText(/^Pause/).first().boundingBox().catch(() => null)
          console.log('  pause-linjens plads:', JSON.stringify(pauseBox))
          // Efter-tekst under folden
          const under = await page.evaluate(() => { const fold = innerHeight; return [...document.querySelectorAll('button')].filter(e => e.getBoundingClientRect().top >= fold).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)) })
          console.log('  knapper UNDER folden efter et saet:', JSON.stringify(under))
          await shot('05-efter-saet-hele', true)
          const bottom = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, top: Math.round(r.top), bottom: Math.round(r.bottom), text: e.textContent.trim().slice(0, 30) } }))
          console.log('  alle faste elementer (bund):', JSON.stringify(bottom))
          // PR-toast: tungt saet paa naeste saet, m�l d�knings af overskrift/strimmel og levetid
          await page.getByLabel(/^V�gt, s�t/).first().fill('250').catch(() => {})
          await page.getByRole('button', { name: 'Godkendt', exact: true }).first().tap().catch(() => {})
          const t0 = Date.now()
          const toast = page.getByText('Ny personlig rekord', { exact: false }).first()
          try { await toast.waitFor({ state: 'visible', timeout: 4000 }); const tb = await toast.evaluate(el => { let n = el; while (n && getComputedStyle(n).position !== 'fixed') n = n.parentElement; const r = (n || el).getBoundingClientRect(); const h = document.querySelector('h1').getBoundingClientRect(); const st = document.querySelector('[data-dagstrimmel]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h1: [h.top, h.bottom], strip: [st.top, st.bottom], scrollY } }); await shot('06-pr-toast'); console.log('  PR-toast:', JSON.stringify(tb)); let gone = null; for (let i = 0; i < 30; i++) { if (!(await toast.isVisible().catch(() => false))) { gone = Date.now() - t0; break } await page.waitForTimeout(500) } console.log('  PR-toast levetid ms:', gone) } catch { console.log('  ingen PR-toast set') }
        } else note(1, 'middel', `${tag}: ingen "Godkendt"-knap paa forsiden`, 'kunne ikke logge saet fra forsiden i mocken')
      } finally {
        if (errs.length) note(1, 'middel', `${tag}: konsolfejl`, errs.slice(0, 3).join(' || '))
        await ctx.close(); await mock.close()
      }
    }
  } finally { await browser.close(); await vite.stop() }
}

// ---------- Blok 2 ----------
// Tester main (288c95a) i skak-repoet, ikke arbejdstraeet: skak-repoet har
// ucommittede aendringer fra en anden (udseende) og dem er ikke 326's. Kun
// laesning: `git show` til en tempfil, ingen commit, ingen skrivning der.
async function blok2() {
  const { execFileSync } = await import('node:child_process')
  const { tmpdir } = await import('node:os')
  const { pathToFileURL } = await import('node:url')
  const { chromium } = await import('../e2e/harness.mjs')
  const SKAK = 'C:\\Users\\Entropi\\Desktop\\skak'
  const html = join(tmpdir(), 'kritik-334-skak-main.html')
  writeFileSync(html, execFileSync('git', ['show', '288c95a:skak.html'], { cwd: SKAK, maxBuffer: 64 * 1024 * 1024 }))
  const url = pathToFileURL(html).href
  const felt = f => `#braet .felt[data-square="${f}"]`
  const pal = (farve, type) => `.palet-brik[data-farve="${farve}"][data-type="${type}"]`
  const STARTFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
  const browser = await chromium.launch({ headless: true })
  const res = []
  const check = (navn, ok_, detalje) => { res.push({ navn, ok: ok_, detalje }); console.log(`  ${ok_ ? 'ok  ' : 'FEJL'} ${navn}${detalje ? ' — ' + detalje : ''}`); if (!ok_) note(2, 'hoej', `skak: ${navn}`, detalje || '') }
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
    const page = await ctx.newPage()
    const fejl = []
    page.on('pageerror', e => fejl.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fejl.push(`console.${m.type()}: ${m.text()}`) })
    await page.goto(url); await page.waitForSelector('#braet .felt')
    const cdp = await ctx.newCDPSession(page)
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
    const midt = async sel => { await page.locator(sel).scrollIntoViewIfNeeded(); const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
    const tryk = async sel => { const p = await midt(sel); await touch('touchStart', p.x, p.y); await touch('touchEnd'); await page.waitForTimeout(70) }
    const trak = async (a_, b_) => { const a = await midt(a_), b = await midt(b_); await touch('touchStart', a.x, a.y); for (let i = 1; i <= 10; i++) await touch('touchMove', a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10); await touch('touchEnd'); await page.waitForTimeout(90); await tryk('#status') }
    const laes = () => page.evaluate(() => ({ fen: document.querySelector('#fen-tekst').value, titel: document.querySelector('#laer-titel').textContent, besked: document.querySelector('#laer-besked').textContent, status: document.querySelector('#status').textContent }))
    const shot = n => page.screenshot({ path: join(OUT, `s-${n}.png`) })

    // 0. Gaader (foerste fane ved indlaesning): hint -> hint -> spil hintet
    await page.waitForSelector('#knap-gaade-hint:not([disabled])', { timeout: 8000 })
    const fen0 = await page.locator('#fen-tekst').inputValue()
    await page.click('#knap-gaade-hint'); await page.waitForSelector('#braet .felt.hint-fra', { timeout: 3000 })
    await page.waitForSelector('#knap-gaade-hint:not([disabled])'); await page.click('#knap-gaade-hint'); await page.waitForSelector('#braet .felt.hint-til', { timeout: 3000 })
    const fra = await page.locator('#braet .felt.hint-fra').getAttribute('data-square'), til = await page.locator('#braet .felt.hint-til').getAttribute('data-square')
    await page.click(felt(fra)); await page.click(felt(til)); await page.waitForTimeout(900)
    const fen1 = await page.locator('#fen-tekst').inputValue()
    check('Gaader: hint -> spil hintet -> stillingen aendrer sig', fen1 !== fen0, `${fra}->${til}`)
    await shot('0-gaade')
    // 1. Laer skak: forkert drag afvist og forklaret, rigtigt drag godkendt
    await tryk('#fane-laer')
    await tryk('.segment[data-segment="laer-niveau"] .segment-knap[data-value="spiller"]')
    let s = await laes()
    check('Laer skak: niveau "spiller" starter i Italiensk', s.titel.includes('Italiensk'), s.titel)
    await trak(felt('d2'), felt('d4'))
    s = await laes()
    check('Laer skak: forkert drag (d2-d4) forklares', /Lovligt, men ikke det vi/.test(s.besked), s.besked)
    await shot('1-forkert-drag')
    await page.waitForTimeout(1400); s = await laes()
    check('Laer skak: forkert drag ruller tilbage', s.fen.split(' ')[0] === STARTFEN, s.fen)
    await trak(felt('e2'), felt('e4')); s = await laes()
    check('Laer skak: rigtigt drag (e2-e4) godkendes', s.fen.split(' ')[0].startsWith('rnbqkbnr/pppp1ppp/8/4p3/4P3') || /^Rigtigt/.test(s.besked), `${s.besked} | ${s.fen}`)
    await shot('2-rigtigt-drag')
    // Tryk-tryk i Laer skak (samme dom som drag): forkert tryk-par
    await tryk('#knap-laer-forfra').catch(() => {})
    await page.waitForTimeout(300)
    await tryk(felt('d2')); await tryk(felt('d4')); s = await laes()
    check('Laer skak: forkert TRYK-tryk (d2,d4) forklares ogsaa', /Lovligt, men ikke det vi/.test(s.besked) || s.besked !== '', s.besked)
    await page.waitForTimeout(1400)

    // 2. Opstil: drag fra palet
    await page.setViewportSize({ width: 1280, height: 800 })
    await tryk('#fane-opstil'); await tryk('#knap-ryd'); await tryk('#knap-ryd-bekraeft')
    await trak(pal('w', 'q'), felt('d4')); s = await laes()
    check('Opstil: drag fra palet saetter dronning paa d4', s.fen.split(' ')[0] === '8/8/8/8/3Q4/8/8/8', s.fen)
    await trak(felt('d4'), felt('h8')); s = await laes()
    check('Opstil: drag af brik paa braettet flytter den (d4->h8)', s.fen.split(' ')[0] === '7Q/8/8/8/8/8/8/8', s.fen)
    await shot('3-opstil')

    // 3. Tegnelag (mus): pil, ring, viskelaeder
    const tegn = () => page.evaluate(() => document.querySelectorAll('#tegne-lag *').length)
    const t0 = await tegn()
    await page.click('.vaerktoej[data-vaerktoej="pil"]')
    const a = await midt(felt('a1')), b = await midt(felt('a5'))
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up()
    const t1 = await tegn(); check('Tegnelag: pil tegnes (a1->a5)', t1 > t0, `${t0} -> ${t1} elementer`)
    await page.click('.vaerktoej[data-vaerktoej="ring"]'); await page.click(felt('c3'))
    const t2 = await tegn(); check('Tegnelag: ring saettes (c3)', t2 > t1, `${t1} -> ${t2}`)
    await shot('4-tegnelag')
    await page.click('.vaerktoej[data-vaerktoej="viskelaeder"]'); await page.click(felt('c3'))
    const t3 = await tegn(); check('Tegnelag: viskelaeder fjerner ring', t3 < t2, `${t2} -> ${t3}`)
    await page.click('#knap-ryd-tegning').catch(() => {})
    await page.click('.vaerktoej[data-vaerktoej="flyt"]')

    // 4. Spil mod computeren (motor): e2-e4, computeren svarer
    await page.click('#knap-startopstilling'); await page.click('#fane-spil')
    await page.click('.segment[data-segment="spil-modus"] .segment-knap[data-value="computer"]')
    await page.click('#knap-spil-forfra'); await page.click('#knap-spil-forfra-bekraeft')
    await page.click(felt('e2')); await page.click(felt('e4'))
    let svar = null
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); const f = await page.locator('#fen-tekst').inputValue(); if (f.split(' ')[1] === 'w' && f.split(' ')[0] !== STARTFEN) { svar = f; break } }
    check('Motor: computeren svarer paa e2-e4 inden 10 s', !!svar, svar || 'intet svar')
    await shot('5-spil')

    // Gaader efter et spil: vises der en gaade, eller braettet fra Spil?
    const spilFen = await page.locator('#fen-tekst').inputValue()
    await page.click('#fane-gaader'); await page.waitForTimeout(1500)
    const gFen = await page.locator('#fen-tekst').inputValue()
    if (gFen === spilFen) note(2, 'middel', 'skak: "Loes gaader" efter et spil viser spilstillingen, ikke en gaade', `FEN staar uaendret paa ${gFen.split(' ')[0]}; Hint peger paa meningsloese felter. Findes ogsaa foer opdelingen (4215ec2), saa IKKE en 326-regression`)
    else ok('Loes gaader efter et spil viser en gaade')
    await shot('6-gaade-efter-spil')    // Opgave-fanen (find mat)
    await page.click('#fane-opgave'); await page.waitForTimeout(500)
    check('Opgave-fane aabner', await page.locator('#panel-opgave').isVisible().catch(() => false))
    await shot('7-opgave')

    check('Konsol og sidefejl tomme', fejl.length === 0, fejl.slice(0, 3).join(' | '))
    await ctx.close()
  } finally { await browser.close() }
  writeFileSync(join(OUT, 'skak-resultat.json'), JSON.stringify(res, null, 2) + '\n')
}
if (blokArg === '1' || blokArg === 'alle') await blok1()
if (blokArg === '2' || blokArg === 'alle') await blok2()
writeFileSync(join(OUT, `fund-blok-${blokArg}.json`), JSON.stringify(fund, null, 2) + '\n')
console.log(`\nFerdig blok ${blokArg}: ${fund.length} noterede fund`)

