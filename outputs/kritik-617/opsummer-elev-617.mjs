// Kritik 617: opsummer alle elev-617-*.json (min elev) til en tabel: niveau, Hoved-Haand-Hjerte og hjulpne efter 20 og
// 40 min, opgaver, "Fortsaet", den sjove linje, valget (begge knapper), rul, JS-fejl og net.
//   node outputs/kritik-617/opsummer-elev-617.mjs            (alle)
//   node outputs/kritik-617/opsummer-elev-617.mjs m605-m40-525 (en)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HER = path.dirname(fileURLToPath(import.meta.url))
const filer = process.argv[2] ? [`elev-617-${process.argv[2]}.json`] : readdirSync(HER).filter((f) => /^elev-617-.*\.json$/.test(f) && f !== 'elev-617-tabel.json').sort()
const niv = (f) => (f ? `${f.niveau}${f.niveauPoint ? '½' : ''}` : '?')
const hhh = (f) => (f ? `${f.hoved}-${f.haand}-${f.hjerte}` : '?')
const raekker = []
for (const fil of filer) {
  const j = JSON.parse(readFileSync(path.join(HER, fil), 'utf8'))
  for (const k of j.koersler) {
    const u = j.udgaver[k.variant][k.bredde]
    const slut = j.slut.find((s) => s.variant === k.variant && s.bredde === k.bredde)
    const broek = (slut?.bibliotek ?? []).find((b) => b.id === 'broeker')?.point ?? null
    raekker.push({
      koersel: fil.replace(/^elev-617-|\.json$/g, ''), spil: j.spil, variant: k.variant === 'foelger' ? 'hjaelper' : 'travl', bredde: k.bredde,
      m20: { niveau: niv(u.snap), hhh: hhh(u.snap), hjulpet: u.snap?.klaret?.length ?? '?', tilbage: u.snap?.tilbage?.length ?? 0, opgaver: u.snap?.opgaver, forloeb: u.snap?.forloeb },
      m40: { niveau: niv(slut?.figur), hhh: hhh(slut?.figur), hjulpet: (slut?.klaret ?? []).length, opgaver: u.opgaver, rigtigeFoerste: u.rigtigeFoerste, forloeb: Object.values(slut?.questFremdrift ?? {}).flat().filter(Boolean).length, broeker: broek },
      fortsaet: u.fortsaet, valgBegge: `${u.valgBegge.filter(Boolean).length}/${u.valgBegge.length}`,
      sjov: u.sjov.map((s) => `${s.t} ${s.art} (${s.ord} ord, ${s.sammeSkaerm ? 'samme skaerm' : 'IKKE samme skaerm'}, bid ${s.gedebid}, ${s.hjaelpKnap?.length ? s.hjaelpKnap.join('/') : 'ingen Hjaelp-knap'}, "!" ${s.udraab?.length ?? 0})`),
      tilbageSet: u.tilbageSet, lappet: u.lappet, kort: u.kort, rul: u.rul, jsFejl: u.jsFejl, net: j.net, ukendt: u.ukendt,
    })
  }
}
const ud = path.join(HER, 'elev-617-tabel.json')
if (!process.argv[2]) writeFileSync(ud, JSON.stringify(raekker, null, 1) + '\n')
for (const r of raekker) console.log(`${r.koersel.padEnd(24)} ${r.spil} ${r.variant.padEnd(8)} ${r.bredde}  20m: niv ${r.m20.niveau.padEnd(3)} ${r.m20.hhh.padEnd(7)} hj ${r.m20.hjulpet} opg ${r.m20.opgaver}  40m: niv ${r.m40.niveau.padEnd(3)} ${r.m40.hhh.padEnd(7)} hj ${r.m40.hjulpet} opg ${r.m40.opgaver} (${r.m40.rigtigeFoerste}) forl ${r.m40.forloeb} broek ${r.m40.broeker}  fortsaet ${r.fortsaet} valg ${r.valgBegge} sjov ${r.sjov.length} tilbage ${r.tilbageSet} lappet ${r.lappet} rul ${r.rul} js ${r.jsFejl} net ${r.net} ukendt ${r.ukendt}`)
