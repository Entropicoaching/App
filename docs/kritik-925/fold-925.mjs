// ORDRE 920: tjek at HHH-boksen foldes efter foerste rigtige svar (ny syntetisk elev, 390). Kun maaling.
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const url = pathToFileURL(path.join(path.resolve(process.argv[2]), 'spil.html')).href
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.route(/^https?:/, (r) => r.abort())
const p = await ctx.newPage()
await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.goto(url)
await p.fill('#op-navn', 'Tulle'); await p.locator('.opret-udseende').nth(1).click(); await p.click('#op-start')
await p.waitForSelector('#min-helt-knap'); await p.waitForTimeout(600)
const aaben = async () => p.locator('#hhh-forklaring').isVisible().catch(() => false)
const foer = await aaben()
// den foerste opgave er "5 lige store brod, 1 solgt": 1/5 er rigtigt
for (let i = 0; i < 3; i++) { await p.locator('#quest-svar button[data-i="' + i + '"]').click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(300); if (await p.locator('#quest-videre').isVisible().catch(() => false)) break }
await p.waitForTimeout(1500)
const efter = await aaben()
await p.screenshot({ path: path.resolve('outputs/kritik-925/E925-fold-390-efter-foerste.png') })
console.log(JSON.stringify({ aabenFoer: foer, aabenEfter: efter }))
await b.close()


