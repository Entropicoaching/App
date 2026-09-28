// Kritik 631, blok 2: paastande om M15, M17 og M14 ud fra elev-631-tabel.json (koer opsummer-elev-631.mjs foerst).
// Profiler: gaetter, svag aerlig (40 %), dygtig (90 %) x travl/hjaelper x m618 (main edd01b5) / o626 (e5e0573), terning 525,
// 390, 40 min med 20-minutters-snap. Gaetteren ogsaa med terning 731.
// Graensen (M14): HEL_VAERDI_ANDEL i src/faerdigheder.js paa begge udgaver (git show, traeet roeres ikke).
//   node outputs/kritik-631/elev-tjek-631.mjs   -> elev-631.json
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const HER = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const T = JSON.parse(readFileSync(path.join(HER, 'elev-631-tabel.json'), 'utf8'))
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }
const n = (s) => parseFloat(String(s).replace('½', '.5'))
const r = (ref, elev, variant, seed = 525) => T.find((x) => x.ref === ref && x.elev === elev && x.variant === variant && x.seed === seed)
const M = 'edd01b5', O = 'e5e0573'
const profiler = T.filter((x) => x.seed === 525).map((x) => ({ ref: x.ref, elev: x.elev, variant: x.variant, m20: x.m20.niveau, m40: x.m40.niveau, hjerte40: x.m40.hjerte, venner40: x.m40.venner, forbi: x.tilbageLinjer.length }))
paastaa('12 profiler med terning 525 (3 elever x travl/hjaelper x main/626) og 4 med 731 (gaetteren); 0 JS-fejl, 0 net', profiler.length === 12 && T.filter((x) => x.seed === 731).length === 4 && T.every((x) => !x.jsFejl && !x.net), profiler)

// M15: den svage aerlige, der hjaelper
const sm = r(M, 'svag aerlig', 'hjaelper'), so = r(O, 'svag aerlig', 'hjaelper'), st = r(O, 'svag aerlig', 'travl')
paastaa('M15 foer (main): den svage aerlige hjaelper har Hjerte 1, 0 venner og 0 "kommer forbi" efter 40 min', sm.m40.hjerte === 1 && !sm.m40.venner && !sm.tilbageLinjer.length, { niveau: sm.m40.niveau, hjerte: sm.m40.hjerte })
paastaa('M15 efter (626): hun faar venner, "Tak, fordi du blev ved" under hvilen, Hjerte over 1 og mindst een "kommer forbi"', so.m40.venner >= 1 && so.venLinjer.length >= 1 && so.m40.hjerte > 1 && so.tilbageLinjer.some((x) => x.blevVed), { venner: so.m40.venner, hjerte: so.m40.hjerte, venLinjer: so.venLinjer.map((x) => x.t), forbi: so.tilbageLinjer.map((x) => x.t) })
paastaa('M15: hjaelperen ligger over den travle svage aerlige efter 20 og 40 min (626), og over sig selv paa main efter 40', n(so.m20.niveau) > n(st.m20.niveau) && n(so.m40.niveau) > n(st.m40.niveau) && n(so.m40.niveau) > n(sm.m40.niveau), { h20: so.m20.niveau, t20: st.m20.niveau, h40: so.m40.niveau, t40: st.m40.niveau, main40: sm.m40.niveau })
// Det betaler sig altid at hjaelpe: hjaelperen ligger aldrig under den travle, for alle tre elever, 20 og 40 min, paa 626.
const par = ['gaetter', 'svag aerlig', 'dygtig'].flatMap((e) => [20, 40].map((m) => ({ e, m, h: r(O, e, 'hjaelper')[`m${m}`].niveau, t: r(O, e, 'travl')[`m${m}`].niveau })))
paastaa('626: hjaelperen ligger ikke under den travle for nogen elev efter 20 eller 40 min (terning 525)', par.every((p) => n(p.h) >= n(p.t)), par)
// Den dygtige er uroert af 626
const dm = r(M, 'dygtig', 'hjaelper'), dO = r(O, 'dygtig', 'hjaelper')
paastaa('Den dygtige (90 %) er den samme paa main og 626 (niveau, Hjerte, Broeker)', dm.m40.niveau === dO.m40.niveau && dm.m40.hjerte === dO.m40.hjerte && dm.m40.broeker === dO.m40.broeker, { main: [dm.m40.niveau, dm.m40.hjerte], o626: [dO.m40.niveau, dO.m40.hjerte] })

// M17: gaetteren, der hjaelper
const gm = r(M, 'gaetter', 'hjaelper'), go = r(O, 'gaetter', 'hjaelper')
paastaa('M17 er ikke lukket, men vaerre (FUND M18): gaetteren, der hjaelper, faar flere niveauer paa 626 end paa main (525) og flere venner end den svage aerlige', n(go.m40.niveau) > n(gm.m40.niveau) && go.m40.venner > so.m40.venner, { main: [gm.m20.niveau, gm.m40.niveau, gm.m40.hjerte], o626: [go.m20.niveau, go.m40.niveau, go.m40.hjerte, go.m40.venner, go.venLinjer.length, go.tilbageLinjer.length], svag626: [so.m40.niveau, so.m40.venner] })
paastaa('M17: gaetteren, der hjaelper, ligger langt over den svage aerlige hjaelper paa 626 (525) og taet paa den dygtige', n(go.m40.niveau) >= 2 * n(so.m40.niveau) && n(go.m40.niveau) >= n(dO.m40.niveau) - 2, { gaetter: go.m40.niveau, svag: so.m40.niveau, dygtig: dO.m40.niveau })
const g7m = r(M, 'gaetter', 'hjaelper', 731), g7o = r(O, 'gaetter', 'hjaelper', 731)
paastaa('Terning 731: gaetteren faar ogsaa mere paa 626 (venner uden klaret)', n(g7o.m40.niveau) > n(g7m.m40.niveau) && g7o.m40.venner > g7o.m40.hjulpet, { main: g7m.m40.niveau, o626: g7o.m40.niveau, venner: g7o.m40.venner, hjulpet: g7o.m40.hjulpet })

// M14: graensen
const andel = (ref) => (execSync(`git -C "${MAT}" show ${ref}:src/faerdigheder.js`).toString().match(/export const HEL_VAERDI_ANDEL = ([^;]+);/) || [])[1]
const diff = execSync(`git -C "${MAT}" diff --stat ${M} ${O} -- src/faerdigheder.js`).toString().trim()
const m14 = { main: andel(M), o626: andel(O), diff: diff || 'ingen', rigtigtFoerste: T.filter((x) => x.ref === O && x.seed === 525).map((x) => ({ e: x.elev, v: x.variant, side: x.m40.sideFoerste, pct: Math.round((100 * x.m40.sideFoerste[0]) / x.m40.sideFoerste[1]) })) }
paastaa('M14: graensen er uroert (HEL_VAERDI_ANDEL = 1 / 3 paa main og 626, ingen aendring i src/faerdigheder.js)', m14.main === '1 / 3' && m14.o626 === '1 / 3' && !diff, m14)
const ref626 = execSync(`git -C "${MAT}" rev-parse --short ordre-626`).toString().trim()
const merget = execSync(`git -C "${MAT}" branch --merged main`).toString().includes('ordre-626')
let rapport = true
try { execSync(`git -C "${MAT}" cat-file -e ordre-626:outputs/RAPPORT-626.md`, { stdio: 'ignore' }) } catch { rapport = false }
paastaa('626 er ikke merget, ordre-626 staar paa e5e0573 (kun blok 1, M15), og RAPPORT-626 findes ikke committet', ref626 === 'e5e0573' && !merget && !rapport, { ref626, merget, rapport })
writeFileSync(path.join(HER, 'elev-631.json'), JSON.stringify({ profiler, m14, tjek }, null, 1) + '\n')
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length}`)
