// ORDRE 433: coachens uge del 2. Een verificeringskommando pr. blok:
//   node outputs/433/verify-433.mjs --blok 1   C4 (sprungne saet i Log) og C5 ("Kraever dit blik" paa telefon), 390 og 1280 px
//   node outputs/433/verify-433.mjs --blok 2   coachen paa telefonen (390 px): forside, uge, Log, kommentar, video
//   node outputs/433/verify-433.mjs --blok 3   build, offline-bevis, VideoCoach-test, RAPPORT-433.md
// Flag: --foer (skriv til outputs/433/foer uden krav; koeres paa main-koden),
// --no-build (genbrug dist/). Headless Chromium mod e2e-mocken med syntetisk
// coach og 6 syntetiske atleter (../428/coach-faelles.mjs). Ingen prod, ingen atletdata.
import path from 'node:path'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { ROOT, byg, start, telefonTjek } from './faelles.mjs'

const arg = (n) => process.argv.includes(n)
const blok = process.argv[process.argv.indexOf('--blok') + 1]
if (!['1', '2', '3'].includes(blok)) { console.error('brug: --blok 1|2|3'); process.exit(2) }
const DIR = path.join(ROOT, 'outputs', '433')

if (blok === '3') {
  const koer = (navn, cmd, env = {}) => {
    console.log(`== ${navn}`)
    const r = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', env: { ...process.env, ...env } })
    const ud = (r.stdout || '') + (r.stderr || '')
    writeFileSync(path.join(DIR, `koersel-${navn}.txt`), ud)
    console.log(ud.trim().split('\n').slice(-3).join('\n'))
    assert.equal(r.status, 0, `${navn} fejlede (se outputs/433/koersel-${navn}.txt)`)
  }
  koer('lint', 'npm run lint')
  koer('build', 'npm run build')
  koer('offline-bevis', 'node outputs/414/offline-bevis.mjs', { BEVIS_UD: 'outputs/433/offline-bevis' })
  for (const t of ['upload-flow', 'submission', 'buttons-layout', 'upload', 'labels', 'film-guide', 'zoom', 'clip']) koer(`videocoach-${t}`, `npm run verify:videocoach-${t}`)
  koer('build-igen', 'npm run build')
  const r = readFileSync(path.join(ROOT, 'docs', 'RAPPORT-433.md'), 'utf8')
  assert.equal(r.split('\n')[0].trim(), 'Ordre 433', 'foerste linje skal vaere "Ordre 433"')
  for (const h of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) assert.ok(r.includes(h), `RAPPORT-433 mangler afsnit: ${h}`)
  const naeste = r.split('## Hvad er næste')[1].split('\n## ')[0]
  const efterPush = (naeste.split(/\*\*Det Marc kan mærke efter push:\*\*/)[1] || '').split('\n\n')[1] || ''
  const linjer = efterPush.split('\n').filter(l => l.trim().startsWith('-'))
  assert.ok(linjer.length >= 1 && linjer.length <= 4, `"efter push" skal vaere 1-4 linjer (er ${linjer.length})`)
  for (const b of r.match(/outputs\/433\/[\w/.-]+\.png/g) || []) assert.ok(existsSync(path.join(ROOT, b)), `billede mangler: ${b}`)
  console.log('GROEN: blok 3')
  process.exit(0)
}

const FOER = arg('--foer')
const UD = path.join(DIR, FOER ? 'foer' : 'efter')
mkdirSync(UD, { recursive: true })
if (!arg('--no-build')) { console.log('Bygger mod mocken ...'); byg() }
const { session, luk, konsolFejl } = await start()
const maaling = { blok, foer: FOER, tid: new Date().toISOString(), fund: {}, konsolFejl }
const shot = (page, navn, opt = {}) => page.screenshot({ path: path.join(UD, `${navn}.png`), ...opt })

async function aabnAtlet(page, navn, fane) {
  await page.locator('[role="button"]', { hasText: navn }).last().click()
  await page.waitForTimeout(1000)
  if (fane) { await page.getByRole('button', { name: new RegExp(`${fane}$`) }).first().click(); await page.waitForTimeout(900) }
}

// C4: Bravo sprang rows over paa dag 2 (3 saet). Hvad siger Log?
async function c4(bredde) {
  const { page, slut } = await session(bredde)
  await aabnAtlet(page, 'Bravo Testsen', 'Log')
  await page.getByText('Dag 2 — Bænk').first().waitFor({ timeout: 10000 })
  const f = await page.evaluate(() => {
    const titel = [...document.querySelectorAll('div')].find(d => d.children.length === 0 && d.textContent === 'Dag 2 — Bænk')
    const pas = titel.closest('div[style*="margin-bottom: 1.75rem"]')
    const hoved = pas.firstElementChild.innerText.replace(/\s+/g, ' ')
    const rows = [...pas.querySelectorAll('div[style*="border-left"]')].find(d => d.innerText.startsWith('Rows'))
    const bjaelke = rows.querySelector('div[style*="height: 3px"] > div')
    return {
      hoved,
      rows: rows.innerText.replace(/\s+/g, ' ').slice(0, 120),
      rowsKant: getComputedStyle(rows).borderLeftColor,
      rowsBjaelkeBredde: bjaelke ? bjaelke.getBoundingClientRect().width : 0,
      rowsBjaelkeFarve: bjaelke ? getComputedStyle(bjaelke).backgroundColor : null,
    }
  })
  await page.getByText('Dag 2 — Bænk').first().scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -80))
  await shot(page, `C4-log-dag2-${bredde}`)
  await slut()
  return f
}

// C5: hvor meget af overskrift og handling i "Kraever dit blik" kan laeses?
async function c5(bredde) {
  const { page, slut } = await session(bredde)
  const f = await page.evaluate(() => [...document.querySelectorAll('[data-coach-briefing-point], div')]
    .filter(d => d.querySelector(':scope > button') && d.innerText.includes('→') && d.style.minHeight === '58px').slice(0, 3).map(d => {
      const knap = d.querySelector(':scope > button')
      const inder = knap.children[1]
      const titel = inder.firstElementChild.firstElementChild
      const handling = inder.children[1]
      const andel = (el) => el ? Math.min(1, Math.round(Math.min(el.clientWidth / el.scrollWidth, el.clientHeight / el.scrollHeight) * 100) / 100) : null
      return { titel: titel.textContent.slice(0, 50), titelAndel: andel(titel), handlingAndel: andel(handling), titelHoejde: Math.round(titel.getBoundingClientRect().height), kerneSynlig: (() => {
        // Kernen er hvem og hvad: teksten foer en eventuel "(kilde ...)".
        const tekst = titel.firstChild
        if (!tekst || tekst.nodeType !== 3) return null
        const slut = tekst.textContent.indexOf(' (') > 0 ? tekst.textContent.indexOf(' (') : tekst.textContent.length
        const r = document.createRange(); r.setStart(tekst, 0); r.setEnd(tekst, slut)
        const kasser = [...r.getClientRects()]; const t = titel.getBoundingClientRect()
        return kasser.every(k => k.bottom <= t.bottom + 1 && k.right <= t.right + 1)
      })() }
    }))
  const blik = page.getByText('Kræver dit blik').first()
  await blik.scrollIntoViewIfNeeded()
  await shot(page, `C5-kraever-dit-blik-${bredde}`)
  await slut()
  return f
}

// Telefonturen (390): forside, en atlets uge, Log, en kommentar, en video.
async function tur() {
  const r = {}
  {
    const { page, slut } = await session(390)
    r.forside = await telefonTjek(page)
    r.forsideStemme = await page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Ugens stemme"], button[aria-label^="Åbn gemt måling"]')].map(b => ({ el: b.getAttribute('aria-label').slice(0, 40), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })))
    await page.locator('button[aria-label^="Ugens stemme fra Foxtrot"]').scrollIntoViewIfNeeded()
    await shot(page, 'T-forside-atletliste-390')
    // En kommentar: tryk paa Bravos "ugens stemme" -> Log
    await page.locator('button[aria-label^="Ugens stemme fra Bravo"]').click()
    await page.getByText('Knæet gør ondt, stoppede rows').first().waitFor({ timeout: 10000 })
    r.kommentar = await telefonTjek(page)
    r.logTekst = await page.evaluate(() => {
      const chip = [...document.querySelectorAll('div')].find(d => d.children.length && [...d.children].every(c => c.tagName === 'SPAN') && /^S1 80kg/.test(d.innerText))
      const note = [...document.querySelectorAll('span')].find(s => s.textContent === 'Smerte i venstre knæ')
      return { chipPx: chip ? parseFloat(getComputedStyle(chip).fontSize) : null, notePx: note ? parseFloat(getComputedStyle(note).fontSize) : null, noteFarve: note ? getComputedStyle(note).color : null }
    })
    await page.getByText('Smerte i venstre knæ').first().scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -200))
    await shot(page, 'T-log-kommentar-390')
    await slut()
  }
  {
    const { page, slut } = await session(390)
    await aabnAtlet(page, 'Bravo Testsen')
    await page.getByText('▼').last().click(); await page.waitForTimeout(800)
    r.uge = await telefonTjek(page)
    r.ugePas = await page.evaluate(() => {
      const op = document.querySelector('button[aria-label^="Flyt Dag 1"][aria-label$=" op"]')
      const raekke = op.parentElement.parentElement
      const titel = raekke.firstElementChild
      return { titelBredde: Math.round(titel.getBoundingClientRect().width), raekkeBredde: Math.round(raekke.getBoundingClientRect().width), titelHoejde: Math.round(titel.firstElementChild.getBoundingClientRect().height), opBredde: Math.round(op.getBoundingClientRect().width) }
    })
    await page.getByText('Dag 1 — Squat').last().click(); await page.waitForTimeout(700)
    r.ugeOevelse = await page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Flyt Squat"], button[aria-label^="Rediger Squat"], button[aria-label^="Slet Squat"]')].map(b => ({ el: b.getAttribute('aria-label'), w: Math.round(b.getBoundingClientRect().width) })))
    r.ugeAabnet = await telefonTjek(page)
    await page.getByText('Dag 1 — Squat').last().scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -120))
    await shot(page, 'T-uge-dag1-390')
    await slut()
  }
  {
    const { page, slut } = await session(390)
    await page.locator('button', { hasText: 'Ny måling fra et sæt' }).first().click(); await page.waitForTimeout(2500)
    r.video = await telefonTjek(page)
    await shot(page, 'T-video-390')
    await slut()
  }
  return r
}

try {
  if (blok === '1') {
    for (const b of [390, 1280]) { maaling.fund[`C4-${b}`] = await c4(b); maaling.fund[`C5-${b}`] = await c5(b) }
  } else {
    maaling.fund = await tur()
  }
} finally {
  await luk()
}
writeFileSync(path.join(UD, `maaling-blok${blok}.json`), JSON.stringify(maaling, null, 2))
console.log(JSON.stringify(maaling.fund, null, 1).slice(0, 4000))
console.log('konsolfejl:', konsolFejl.length)
if (FOER) process.exit(0)

const f = maaling.fund
if (blok === '1') {
  for (const b of [390, 1280]) {
    const c = f[`C4-${b}`]
    assert.match(c.hoved, /4\/7 sæt/i, `C4 ${b}: passet skal vise 4/7 saet (${c.hoved})`)
    assert.match(c.hoved, /3 sprunget over/i, `C4 ${b}: passet skal vise "3 sprunget over"`)
    assert.match(c.rows, /0\/3 sæt · sprunget over/, `C4 ${b}: Rows skal vise "0/3 saet · sprunget over" (${c.rows})`)
    assert.equal(c.rowsBjaelkeBredde, 0, `C4 ${b}: ingen bjaelke paa en sprunget oevelse`)
    assert.notEqual(c.rowsKant, 'rgb(108, 186, 108)', `C4 ${b}: kanten paa Rows maa ikke vaere groen`)
    const d = f[`C5-${b}`]
    assert.equal(d.length, 3, `C5 ${b}: tre punkter i "Kraever dit blik"`)
  }
  // C5 390: to linjer. Hvem og hvad (foer en eventuel kilde-parentes) skal kunne
  // laeses, handlingen helt, og hver overskrift mindst saa meget som foer.
  const foerSti = path.join(DIR, 'foer', 'maaling-blok1.json')
  const foer5 = existsSync(foerSti) ? JSON.parse(readFileSync(foerSti, 'utf8')).fund['C5-390'] : null
  f['C5-390'].forEach((p, i) => {
    assert.equal(p.kerneSynlig, true, `C5 390: hvem og hvad skal kunne laeses (${p.titel})`)
    assert.equal(p.handlingAndel, 1, `C5 390: handlingen skal kunne laeses helt (${p.titel}: ${p.handlingAndel})`)
    if (foer5?.[i]) assert.ok(p.titelAndel >= foer5[i].titelAndel, `C5 390: overskriften maa ikke vise mindre end foer (${p.titel})`)
  })
  if (foer5) {
    const rk = (b) => f[`C5-${b}`].map((p, i) => {
      const fo = JSON.parse(readFileSync(foerSti, 'utf8')).fund[`C5-${b}`][i]
      return `| ${b} px | ${p.titel.slice(0, 32)} | ${Math.round(fo.titelAndel * 100)} % / ${Math.round(fo.handlingAndel * 100)} % | ${Math.round(p.titelAndel * 100)} % / ${Math.round(p.handlingAndel * 100)} % |`
    })
    const c4 = (b) => { const fo = JSON.parse(readFileSync(foerSti, 'utf8')).fund[`C4-${b}`]; return `| ${b} px | ${fo.hoved.match(/\d+\/\d+ SÆT/i)?.[0]}, Rows "${fo.rows.match(/\d\/3 sæt[^S]*/)?.[0].trim()}", bjaelke ${Math.round(fo.rowsBjaelkeBredde)} px | ${f[`C4-${b}`].hoved.match(/\d+\/\d+ SÆT( \d+ SPRUNGET OVER)?/i)?.[0]}, Rows "${f[`C4-${b}`].rows.match(/\d\/3 sæt[^S]*/)?.[0].trim()}", bjaelke ${Math.round(f[`C4-${b}`].rowsBjaelkeBredde)} px |` }
    writeFileSync(path.join(UD, 'foer-efter-blok1.md'), ['| C4 Log, Bravo dag 2 | Foer | Efter |', '|---|---|---|', c4(390), c4(1280), '',
      '| C5 | Punkt | Foer: overskrift / handling synlig | Efter |', '|---|---|---|---|', ...rk(390), ...rk(1280)].join('\n') + '\n')
  }
  assert.deepEqual(konsolFejl, [], 'ingen konsolfejl')
  console.log('GROEN: blok 1')
}
if (blok === '2') {
  for (const s of ['forside', 'kommentar', 'uge', 'ugeAabnet', 'video']) assert.equal(f[s].sidelaens, 0, `${s}: ingen sidelaens rul`)
  // T1 uge: titlen har hele raekken, flyt-knapperne kan rammes
  assert.ok(f.ugePas.titelBredde >= f.ugePas.raekkeBredde * 0.8, `T1: pas-titlen skal have raekkens bredde (${f.ugePas.titelBredde}/${f.ugePas.raekkeBredde})`)
  assert.ok(f.ugePas.opBredde >= 44, `T1: flyt op/ned skal vaere mindst 44 px bred (${f.ugePas.opBredde})`)
  for (const k of f.ugeOevelse) assert.ok(k.w >= 44, `T1: ${k.el} skal vaere mindst 44 px bred (${k.w})`)
  // T2 Log: saet og noter kan laeses uden zoom
  assert.ok(f.logTekst.chipPx >= 11, `T2: saet i Log skal vaere mindst 11 px (${f.logTekst.chipPx})`)
  assert.ok(f.logTekst.notePx >= 11, `T2: noten skal vaere mindst 11 px (${f.logTekst.notePx})`)
  // T3 forside: ugens stemme og maaling kan trykkes
  for (const k of f.forsideStemme) assert.ok(k.w >= 44 && k.h >= 32, `T3: ${k.el} skal kunne trykkes (${k.w}x${k.h})`)
  const smaa = [...f.forside.smaaTryk, ...f.uge.smaaTryk, ...f.ugeAabnet.smaaTryk].filter(k => k.w < 32 || k.h < 32)
  assert.deepEqual(smaa.filter(k => k.el !== 'SET'), [], 'ingen trykbare ting under 32 px paa forside og uge (ud over "Set", som er 30x44)')
  assert.deepEqual(konsolFejl, [], 'ingen konsolfejl')
  const foerSti = path.join(DIR, 'foer', 'maaling-blok2.json')
  if (existsSync(foerSti)) {
    const fo = JSON.parse(readFileSync(foerSti, 'utf8')).fund
    const rk = (n, a, b) => `| ${n} | ${a} | ${b} |`
    writeFileSync(path.join(UD, 'foer-efter-blok2.md'), ['| Sted (390 px) | Foer | Efter |', '|---|---|---|',
      rk('Uge: pas-titel / raekke', `${fo.ugePas.titelBredde}/${fo.ugePas.raekkeBredde} px, ${fo.ugePas.titelHoejde} px hoej`, `${f.ugePas.titelBredde}/${f.ugePas.raekkeBredde} px, ${f.ugePas.titelHoejde} px hoej`),
      rk('Uge: flyt op (bredde)', `${fo.ugePas.opBredde} px`, `${f.ugePas.opBredde} px`),
      rk('Uge: oevelsens ↑ ↓ ✎ ✕ (mindste bredde)', `${Math.min(...fo.ugeOevelse.map(k => k.w))} px`, `${Math.min(...f.ugeOevelse.map(k => k.w))} px`),
      rk('Log: saet-tekst', `${fo.logTekst.chipPx} px`, `${f.logTekst.chipPx} px`),
      rk('Log: note paa saet', `${fo.logTekst.notePx} px, ${fo.logTekst.noteFarve}`, `${f.logTekst.notePx} px, ${f.logTekst.noteFarve}`),
      rk('Forside: ugens stemme / maaling (mindste bredde)', `${Math.min(...fo.forsideStemme.map(k => k.w))} px`, `${Math.min(...f.forsideStemme.map(k => k.w))} px`),
    ].join('\n') + '\n')
  }
  console.log('GROEN: blok 2')
}
