// Kritik 603 (kopi af 590s, plus 602s "staar stille"/"Halv vaerdi" og genindlaesninger): opsummer en elev-603-*.json (min elev): "+N", pauser, niveau-, bonus- og loft-linjer, rygsaekken.
//   node outputs/kritik-590/opsummer-elev-590.mjs elev-603-efter-525.json
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HER = path.dirname(fileURLToPath(import.meta.url))
const j = JSON.parse(readFileSync(path.join(HER, process.argv[2]), 'utf8'))
const mm = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const ud = { spil: j.spil, seed: j.seed, net: j.net, jsFejl: j.jsFejl, koersler: [] }
for (const k of j.koersler) {
  const f = k.tid.flyvere.map((x) => x.t)
  const pts = [0, ...f, k.ur.s]
  let best = [0, 0, 0]
  for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > best[0]) best = [pts[i] - pts[i - 1], pts[i - 1], pts[i]]
  const gaps = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b)
  const slut = j.slut.find((s) => s.variant === k.variant && s.bredde === k.bredde)
  ud.koersler.push({
    variant: k.variant, bredde: k.bredde, opgaver: k.opg.antal, rigtigeFoerste: k.opg.rigtigeFoerste, forsoeg: k.opg.foresloeg,
    plusN: f.length, xpFlyvere: k.tid.xp.length, laengstUden: `${mm(best[0])} (${mm(best[1])}-${mm(best[2])})`, median: gaps[Math.floor(gaps.length / 2)] ?? null,
    nytNiveau: k.tid.nytNiveau.map((x) => `${mm(x.t)} ${x.tekst}`), bonus: (k.tid.bonus ?? []).map((x) => `${mm(x.t)} ${x.tekst}`), halv: (k.tid.halv ?? []).map((x) => `${mm(x.t)} ${x.tekst.slice(0, 90)}`), bonusHalv: (k.tid.bonusHalv ?? []).map((x) => `${mm(x.t)} ${x.tekst.slice(0, 90)}`), genindlaest: k.tid.genindlaest ?? 0, loft: (k.tid.loft ?? []).map((x) => `${mm(x.t)} ${x.tekst.slice(0, 60)}`),
    iPausen: k.log.filter((e) => e.t >= best[1] && e.t <= best[2] && e.art !== 'opgave').map((e) => `${mm(e.t)} ${e.art}`),
    rygsaek: (slut?.bibliotek ?? []).filter((b) => b.point > 0).map((b) => `${b.id} ${b.point} ${b.niveau}`), niveau: slut?.figur?.niveau, oevHer: slut?.oevHerTop?.tekst?.replace(/\n/g, ' / ') ?? null, oevHerBund: slut?.oevHerTop?.bund ?? null,
    steder: [...new Set(k.log.filter((e) => e.art === 'gaar-til').map((e) => e.sted))],
  })
}
console.log(JSON.stringify(ud, null, 1))
