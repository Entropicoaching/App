// ORDRE 483, blok 1: tegn Yantras fejlfigurer (476 + 481) som PNG, saa de kan ses som en coach ser dem.
// Laeser kun fra entropi-loeftmodel-dhruva (main), skriver kun i outputs/kritik-483.
// Brug: node outputs/kritik-483/figurer-483.mjs
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL('C:/Users/Entropi/Desktop/skak/node_modules/playwright/index.mjs').href)

const HER = path.dirname(fileURLToPath(import.meta.url))
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const svg = [
  'outputs/476/side-om-side-dl-hofte-foerst.svg',
  'outputs/481/side-om-side-dl-hofte-foerst-skulder-frem.svg',
  'outputs/476/side-om-side-dl-stang-frem.svg',
  'outputs/481/side-om-side-dl-stang-frem-kroppen-bagud.svg',
  'outputs/476/side-om-side-bp.svg',
]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const net = []
page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()) })
const ud = {}
for (const s of svg) {
  // SVG'en direkte giver timeout i Playwrights fullPage-skaermbillede, og about:blank maa ikke hente file://.
  // En lille HTML-ramme i %TEMP% med <img> virker.
  const ramme = path.join(tmpdir(), 'kritik-483-ramme.html')
  writeFileSync(ramme, '<body style="margin:0;background:#fff"><img id=f src="' + pathToFileURL(path.join(LM, s)).href + '" style="display:block;width:1400px"></body>')
  await page.goto(pathToFileURL(ramme).href)
  await page.waitForFunction(() => document.getElementById('f').complete && document.getElementById('f').naturalWidth > 0)
  const navn = 'F-' + path.basename(s, '.svg') + '.png'
  await page.locator('#f').screenshot({ path: path.join(HER, navn) })
  ud[s] = navn
}
// Siden paa 390 og 1280: vandret rul, raekkefoelge af A/B, og om forbeholdene staar sidst.
for (const b of [390, 1280]) {
  const p = await browser.newPage({ viewport: { width: b, height: 900 } })
  p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()) })
  await p.goto(pathToFileURL(path.join(LM, 'dist/loeft-fejl/index.html')).href)
  ud['side' + b] = await p.evaluate(() => ({
    vandretRul: document.documentElement.scrollWidth > innerWidth,
    hoejde: document.documentElement.scrollHeight,
    billeder: document.images.length,
    overskrifter: [...document.querySelectorAll('h1,h2,h3')].map(h => h.textContent.trim()),
    naevnerVariant: (document.body.innerText.match(/Variant A|ny i 481|476|481/g) || []).length,
    naevnerMarc: (document.body.innerText.match(/Marc/g) || []).length,
    naevnerBhishak: (document.body.innerText.match(/Bhishak/g) || []).length,
    // Hvor langt skal en atlet rulle fra foerste "skulder" med et fald til forbeholdet om skulderen?
    skulderAfstandPx: (() => {
      const alle = [...document.querySelectorAll('li, p, figcaption')]
      const fald = alle.find(e => /skulderen −\d+ %/.test(e.textContent))
      const forb = [...document.querySelectorAll('h3')].find(h => /Skulderen i bænken/.test(h.textContent))
      return fald && forb ? Math.round(forb.getBoundingClientRect().top - fald.getBoundingClientRect().top) : null
    })(),
  }))
  await p.close()
}
ud.netvaerk = net
// SVG'erne kopieres til sitet, som de er (Rapport dag 63/64). Hvad staar i dem selv, uden siden omkring?
const { readFileSync, readdirSync } = await import('node:fs')
ud.svgTekst = {}
for (const f of readdirSync(path.join(LM, 'dist/loeft-fejl')).filter(f => f.endsWith('.svg'))) {
  const t = readFileSync(path.join(LM, 'dist/loeft-fejl', f), 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  ud.svgTekst[f] = {
    skulderFald: (t.match(/skulder −\d+ %/g) || []),
    laendFald: (t.match(/lænd −\d+ %/g) || []),
    forbehold: /kender ikke skulder|forbehold|ikke skånsom/i.test(t),
  }
}
await browser.close()
writeFileSync(path.join(HER, 'figurer-483.json'), JSON.stringify(ud, null, 2))
console.log(JSON.stringify(ud, null, 2))
