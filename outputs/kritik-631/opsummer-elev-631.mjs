// Kritik 631: opsummer alle elev-631-*.json (min elev) til en tabel: niveau, Hoved-Haand-Hjerte, hjulpne og venner efter
// 20 og 40 min, Broeker, rigtigt i foerste forsoeg efter sidens "Rigtigt!", 626's ven-linje under hvilen og "kommer forbi".
//   node outputs/kritik-631/opsummer-elev-631.mjs   -> elev-631-tabel.json
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HER = path.dirname(fileURLToPath(import.meta.url))
const filer = readdirSync(HER).filter((f) => /^elev-631-.*\.json$/.test(f) && f !== 'elev-631-tabel.json').sort()
const niv = (f) => (f ? `${f.niveau}${f.niveauPoint ? '½' : ''}` : '?')
const hhh = (f) => (f ? `${f.hoved}-${f.haand}-${f.hjerte}` : '?')
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const raekker = []
for (const fil of filer) {
  const j = JSON.parse(readFileSync(path.join(HER, fil), 'utf8'))
  const elev = j.model.GAET ? 'gaetter' : j.model.P[0] <= 0.4 ? 'svag aerlig' : j.model.P[0] >= 0.9 ? 'dygtig' : `aerlig ${j.model.P[0]}`
  for (const k of j.koersler) {
    const u = j.udgaver[k.variant][k.bredde]
    const slut = j.slut.find((s) => s.variant === k.variant && s.bredde === k.bredde)
    const L = k.log
    const broek = (slut?.bibliotek ?? []).find((b) => b.id === 'broeker')?.point ?? null
    const hvil = L.filter((e) => e.art === 'hvil')
    const snap = u.snap
    raekker.push({
      koersel: fil.replace(/^elev-631-|\.json$/g, ''), spil: j.spil, ref: j.ref, seed: j.seed, elev, variant: k.variant === 'foelger' ? 'hjaelper' : 'travl', bredde: k.bredde,
      m20: { niveau: niv(snap), hhh: hhh(snap), hjulpet: snap?.klaret?.length ?? '?', venner: snap?.venner?.length ?? 0, tilbage: snap?.tilbage?.length ?? 0, opgaver: snap?.opgaver },
      m40: { niveau: niv(slut?.figur), hhh: hhh(slut?.figur), hjerte: slut?.figur?.hjerte, hjulpet: (slut?.klaret ?? []).length, venner: (slut?.venner ?? []).length, tilbage: (slut?.tilbage ?? []).length, opgaver: u.opgaver, broeker: broek, sideFoerste: u.sideFoerste, knapper: u.knapper },
      hjaelpTryk: L.filter((e) => e.art === 'hjaelper').length,
      hvilede: hvil.length,
      venLinjer: hvil.filter((e) => /blev ved, til alle var løst/.test(e.tekst)).map((e) => ({ t: mmss(e.t), tekst: e.tekst.slice(-220) })),
      tilbageLinjer: L.filter((e) => e.art === 'tilbage').map((e) => ({ t: mmss(e.t), blevVed: /Du blev ved med/.test(e.tekst), tekst: e.tekst.slice(0, 160) })),
      niveauOp: L.filter((e) => e.art === 'niveau-op').map((e) => ({ t: mmss(e.t), tekst: e.tekst.slice(0, 140) })),
      halv: (k.faerdighed?.halv ?? []).length, fortsaet: u.fortsaet, valgBegge: `${u.valgBegge.filter(Boolean).length}/${u.valgBegge.length}`,
      jsFejl: u.jsFejl, net: j.net,
    })
  }
}
writeFileSync(path.join(HER, 'elev-631-tabel.json'), JSON.stringify(raekker, null, 1) + '\n')
for (const r of raekker) console.log(`${r.koersel.padEnd(16)} ${r.spil} ${r.elev.padEnd(11)} ${r.variant.padEnd(8)} 20m: niv ${r.m20.niveau.padEnd(3)} ${r.m20.hhh.padEnd(7)} hj ${r.m20.hjulpet} ven ${r.m20.venner} opg ${r.m20.opgaver} | 40m: niv ${r.m40.niveau.padEnd(3)} ${r.m40.hhh.padEnd(7)} hj ${r.m40.hjulpet} ven ${r.m40.venner} tilb ${r.m40.tilbage} opg ${r.m40.opgaver} side ${r.m40.sideFoerste.join('/')} broek ${r.m40.broeker} | hjaelp ${r.hjaelpTryk} hvil ${r.hvilede} venlinje ${r.venLinjer.length} blevVed-forbi ${r.tilbageLinjer.filter((x) => x.blevVed).length} forbi ${r.tilbageLinjer.length} halv ${r.halv} js ${r.jsFejl} net ${r.net}`)
