// KRITIK 613 blok 1: kapitel 6 paa squat, Setus maaling (setu-607/lm/k6.mjs) koert igen med 200 seeds
// i stedet for kun seed 607. Kun laesning af Setus kopi af loeftmodellen (main 207d4ec) i ordrer/kilder.
// Maaler: hvor tit hvert tal er "inden for" (|middel - model| <= spaend/2,326, som i artiklen),
// den sande klik-SD (100 enkeltklik), og hvor tit "Ligner: Kun knaeene" / intet fund kommer.
//   node outputs/kritik-613/k6-seeds-613.mjs   -> outputs/kritik-613/k6-seeds-613.json
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const LM = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-607/lm/src/'
const imp = (f) => import(pathToFileURL(LM + f).href)
const { indstilling } = await imp('minKrop.js')
const { modelFase, SAMMEN_RAEKKER } = await imp('maalBilledeModel.js')
const { squatBilleder, KLIKFEJL, gauss } = await imp('fejlgenkendelseMaaling.js')
const { maal, skalaFraKrop, knaeFaseTjek } = await imp('maalBillede.js')
const { genkendFejl } = await imp('maalBilledeFejl.js')
const { KAMERAER, KAMHOEJDE, i3D, kamera, foto } = await imp('fejlPinhole.js')

const I = indstilling('squat', { hoejde: 183, vaegt: 120 }, { gennemsnit: true })
const B = squatBilleder(I)
const kam = KAMERAER.find((k) => k.id === 'vinkelret')
const sd = KLIKFEJL.omhyggelig
const N = 5, SEEDS = 200
const valg = {
  'squat-bund': [B.normal['squat-bund'][0], B.fejl['sq-kun-knae-bund'][0]],
  'squat-midt': [B.normal['squat-midt'][0], B.fejl['sq-kun-knae-midt'][0]],
}
const ud = { seeds: SEEDS, N, faser: {} }
for (const [faseId, billeder] of Object.entries(valg)) {
  const mf = modelFase(faseId, I)
  ud.faser[faseId] = {}
  for (const { navn, P } of billeder) {
    const klik0 = foto(i3D(P, 'squat', { medNav: true }), kamera(kam.k(KAMHOEJDE.squat, P)))
    const k = skalaFraKrop(klik0, mf.L)
    const m0 = maal(klik0, { fase: faseId, cmPrPx: k })
    const rk = {}
    for (const r of SAMMEN_RAEKKER.squat) rk[r.id] = { navn: r.navn, model: r.model(mf.tal), udenKlik: r.billede(m0), enkelt: [], inden: 0, afv: [] }
    let ligner = 0, ingen = 0, klikI = 0
    for (let s = 1; s <= SEEDS; s++) {
      const g = gauss(s)
      const runder = []
      for (let i = 0; i < N; i++) {
        const klik = {}
        for (const [id, p] of Object.entries(klik0)) { const e = (sd[id] ?? 0.5) / k; klik[id] = { x: p.x + g() * e, y: p.y + g() * e } }
        const m = maal(klik, { fase: faseId, cmPrPx: skalaFraKrop(klik, mf.L) })
        const gk = genkendFejl(m, mf.fejlPunkter || mf.punkter, { knaeFase: knaeFaseTjek(m) })
        klikI++
        if (gk.status === 'ligner' && gk.regel.id.startsWith('sq-kun-knae')) ligner++
        else if (gk.status === 'ligner') { rk.andetFund = (rk.andetFund || 0) + 1; (ud.andreRegler ??= {})[gk.regel.id] = 1 }
        else ingen++
        runder.push(m)
      }
      for (const r of SAMMEN_RAEKKER.squat) {
        const v = runder.map((m) => r.billede(m))
        const mean = v.reduce((a, b) => a + b, 0) / N
        const sdv = (Math.max(...v) - Math.min(...v)) / 2.326
        const x = rk[r.id]
        if (s <= 20) x.enkelt.push(...v)
        x.afv.push(mean - x.model)
        if (Math.abs(mean - x.model) <= sdv) x.inden++
      }
    }
    for (const x of Object.values(rk)) {
      if (!x.enkelt) continue
      const mu = x.enkelt.reduce((a, b) => a + b, 0) / x.enkelt.length
      x.klikSD = Math.sqrt(x.enkelt.reduce((a, b) => a + (b - mu) ** 2, 0) / (x.enkelt.length - 1))
      x.middelAfv = x.afv.reduce((a, b) => a + b, 0) / x.afv.length
      x.andelInden = x.inden / SEEDS
      delete x.enkelt; delete x.afv
    }
    ud.faser[faseId][navn] = { raekker: rk, klik: klikI, lignerKunKnae: ligner, ingenFund: ingen }
  }
}
const HERE = path.dirname(fileURLToPath(import.meta.url))
writeFileSync(path.join(HERE, 'k6-seeds-613.json'), JSON.stringify(ud, null, 1))
for (const [f, x] of Object.entries(ud.faser)) {
  console.log('==', f)
  for (const [navn, b] of Object.entries(x)) {
    console.log(' ', navn, `ligner kun knae ${b.lignerKunKnae}/${b.klik}, intet fund ${b.ingenFund}/${b.klik}`, b.raekker.andetFund ? `andet fund ${b.raekker.andetFund}` : '')
    for (const [id, r] of Object.entries(b.raekker)) if (r.navn) console.log('   ', r.navn.padEnd(30), 'model', r.model.toFixed(1), 'uden klik', r.udenKlik.toFixed(2), 'klikSD', r.klikSD.toFixed(2), 'middelafv', r.middelAfv.toFixed(2), 'inden for', (100 * r.andelInden).toFixed(0) + '%')
  }
}
