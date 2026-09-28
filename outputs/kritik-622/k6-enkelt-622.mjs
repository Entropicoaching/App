// KRITIK 622 blok 1: kapitel 6 paa squat efter Setus 615 (9ae75d5). Setus tabeller viser billedet uden
// klikfejl og kalder et tal "inden for", naar |uden klik - model| <= spredningen af eet klik (klikSD).
// En laeser, der klikker sit eget billede een gang, faar et tal med klikfejl. Her: over 200 seeds x 5 klik
// (samme loeftmodel-kopi som Setu, setu-607/lm, kun laest), hvor tit et ENKELT klik giver samme
// "inden for"/"uden for" som tabellen, og hvor tit alle fem raekker i en kolonne passer paa een gang.
// Samme regnet med et bredere baand, 2 x klikSD (ca. 95 % for eet klik), og om tabellens domme saa aendres.
// Tjekker ogsaa, at artiklens tal (udtrukket af artikel-squat.html paa 9ae75d5) er k6-robust.json's.
//   node outputs/kritik-622/k6-enkelt-622.mjs <sti til artikel-squat.html>  -> k6-enkelt-622.json
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const LM = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-607/lm/src/'
const ROBUST = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-615/k6-robust.json'
const imp = (f) => import(pathToFileURL(LM + f).href)
const { indstilling } = await imp('minKrop.js')
const { modelFase, SAMMEN_RAEKKER } = await imp('maalBilledeModel.js')
const { squatBilleder, KLIKFEJL, gauss } = await imp('fejlgenkendelseMaaling.js')
const { maal, skalaFraKrop } = await imp('maalBillede.js')
const { KAMERAER, KAMHOEJDE, i3D, kamera, foto } = await imp('fejlPinhole.js')

const I = indstilling('squat', { hoejde: 183, vaegt: 120 }, { gennemsnit: true })
const B = squatBilleder(I)
const kam = KAMERAER.find((k) => k.id === 'vinkelret')
const sd = KLIKFEJL.omhyggelig
const N = 5, SEEDS = 200
const robust = JSON.parse(readFileSync(ROBUST, 'utf8'))
const valg = {
  'squat-bund': [B.normal['squat-bund'][0], B.fejl['sq-kun-knae-bund'][0]],
  'squat-midt': [B.normal['squat-midt'][0], B.fejl['sq-kun-knae-midt'][0]],
}
const ud = { seeds: SEEDS, N, faser: {}, artikel: {} }
for (const [faseId, billeder] of Object.entries(valg)) {
  const mf = modelFase(faseId, I)
  ud.faser[faseId] = {}
  for (const { navn, P } of billeder) {
    const rb = robust.faser[faseId].billeder[navn]
    const klik0 = foto(i3D(P, 'squat', { medNav: true }), kamera(kam.k(KAMHOEJDE.squat, P)))
    const k = skalaFraKrop(klik0, mf.L)
    const rk = {}
    for (const r of rb.raekker) rk[r.id] = { tabel: r.indenFor ? 'inden' : 'uden', tabel2SD: Math.abs(r.afv) <= 2 * r.klikSD ? 'inden' : 'uden', klikSD: r.klikSD, afvUdenKlik: r.afv, enigeEnkelt: 0, enigeEnkelt2SD: 0 }
    let alleEnige = 0, alleEnige2 = 0, n = 0
    for (let s = 1; s <= SEEDS; s++) {
      const g = gauss(s)
      for (let i = 0; i < N; i++) {
        const klik = {}
        for (const [id, p] of Object.entries(klik0)) { const e = (sd[id] ?? 0.5) / k; klik[id] = { x: p.x + g() * e, y: p.y + g() * e } }
        const m = maal(klik, { fase: faseId, cmPrPx: skalaFraKrop(klik, mf.L) })
        let alle = true, alle2 = true
        for (const r of SAMMEN_RAEKKER.squat) {
          const x = rk[r.id]; if (!x) continue
          const inden = Math.abs(r.billede(m) - r.model(mf.tal)) <= x.klikSD
          if ((inden ? 'inden' : 'uden') === x.tabel) x.enigeEnkelt++; else alle = false
          const inden2 = Math.abs(r.billede(m) - r.model(mf.tal)) <= 2 * x.klikSD
          if ((inden2 ? 'inden' : 'uden') === x.tabel2SD) x.enigeEnkelt2SD++; else alle2 = false
        }
        if (alle) alleEnige++
        if (alle2) alleEnige2++
        n++
      }
    }
    for (const x of Object.values(rk)) { x.andelEnige = +(x.enigeEnkelt / n).toFixed(3); x.andelEnige2SD = +(x.enigeEnkelt2SD / n).toFixed(3); x.dommenAendres2SD = x.tabel !== x.tabel2SD }
    ud.faser[faseId][navn] = { klik: n, raekker: rk, alleFemSomTabellen: +(alleEnige / n).toFixed(3), alleFemSomTabellen2SD: +(alleEnige2 / n).toFixed(3) }
  }
}

// Artiklens tabeltal mod k6-robust.json (en decimal, komma).
const html = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : null
if (html) {
  const tal = (s) => +s.replace(',', '.').replace(/[^\d.-]/g, '')
  const tabeller = [...html.matchAll(/<table class="mom-tabel">([\s\S]*?)<\/table>/g)].map((m) => m[1]).slice(0, 2)
  const faser = ['squat-bund', 'squat-midt'], ids = ['torso', 'hofte', 'knae', 'stangFraMidtfod', 'stangHofte']
  const afvig = []
  tabeller.forEach((t, fi) => {
    const rows = [...t.matchAll(/<tr><th scope="row">[^<]*<span class="mom-model">model ([^<]+)<\/span><\/th>(.*?)<\/tr>/g)]
    rows.forEach((row, ri) => {
      const cells = [...row[2].matchAll(/<td class="mom-(ja|nej)"><span class="mom-maalt">([^<]+)<\/span><span class="mom-model">(.+?), (inden|uden) for<\/span><\/td>/g)]
      const fb = robust.faser[faser[fi]].billeder
      const r = { kk: fb['kun knæene'].raekker[ri], mo: fb[Object.keys(fb).find((k) => k !== 'kun knæene')].raekker[ri] }
      const chk = (hvad, a, b) => { if (Math.abs(a - b) > 0.051) afvig.push({ fase: faser[fi], id: ids[ri], hvad, artikel: a, robust: +b.toFixed(2) }) }
      chk('model', tal(row[1]), r.kk.model)
      ;[['kun knæene', cells[0], r.kk], ['model', cells[1], r.mo]].forEach(([nv, c, rr]) => {
        chk(nv + ' maalt', tal(c[2]), rr.maalt); chk(nv + ' afv', tal(c[3]), rr.afv)
        if ((c[4] === 'inden') !== rr.indenFor) afvig.push({ fase: faser[fi], id: ids[ri], hvad: nv + ' dom' })
        if ((c[1] === 'ja') !== (c[4] === 'inden')) afvig.push({ fase: faser[fi], id: ids[ri], hvad: nv + ' farve' })
      })
    })
    ud.artikel[faser[fi]] = rows.length
  })
  ud.artikel.afvigelser = afvig
}
const HERE = path.dirname(fileURLToPath(import.meta.url))
writeFileSync(path.join(HERE, 'k6-enkelt-622.json'), JSON.stringify(ud, null, 1))
for (const [f, x] of Object.entries(ud.faser)) for (const [navn, b] of Object.entries(x)) {
  console.log(f, navn, 'alle fem som tabellen ved et enkelt klik:', (100 * b.alleFemSomTabellen).toFixed(1) + ' %', '| med 2 x klikSD:', (100 * b.alleFemSomTabellen2SD).toFixed(1) + ' %')
  for (const [id, r] of Object.entries(b.raekker)) console.log('   ', id.padEnd(16), 'tabel', r.tabel, 'afv', r.afvUdenKlik.toFixed(2), 'klikSD', r.klikSD.toFixed(2), 'enkelt klik enig', (100 * r.andelEnige).toFixed(1) + ' %', '| 2SD enig', (100 * r.andelEnige2SD).toFixed(1) + ' %', r.dommenAendres2SD ? 'DOM AENDRES' : '')
}
console.log('artiklen mod k6-robust:', JSON.stringify(ud.artikel))
