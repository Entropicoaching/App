// KRITIK 680: Spil-fanens startkort paa en telefon med adresselinje (360 x 560, touch), main (674) mod ordre-678. Kun maaling.
//   node outputs/kritik-680/skak-lav-680.mjs <mappe> <tag>
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const url = pathToFileURL(path.join(path.resolve(process.argv[2]), 'skak.html')).href
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 360, height: 560 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
await p.goto(url); await p.waitForTimeout(800)
await p.locator('#fane-spil').click(); await p.waitForTimeout(500)
const r = await p.evaluate(() => { const x = document.querySelector('#braet').getBoundingClientRect(); return { bund: Math.round(x.bottom), b: Math.round(x.width), vinduH: innerHeight } })
console.log(process.argv[3], JSON.stringify(r))
await p.screenshot({ path: path.join(HER, `S680-${process.argv[3]}-360x560-spil.png`) })
await b.close()
