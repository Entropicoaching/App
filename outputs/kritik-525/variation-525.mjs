// Kritik 525, blok 1: hvor ofte ser eleven den samme opgave igen inden for et forloeb?
// Spillets egne generatorer (Ganitas main via git archive), 500 salte. For hvert af
// Moellens 8 forloeb: de 12 opgaver i runde 0-3 (det, en elev, der ikke mestrer med
// det samme, moeder), andelen af gentagne opgavetekster og det hyppigste talpar.
//   node outputs/kritik-525/variation-525.mjs     -> variation-525.json
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const UD = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const SPIL = mkdtempSync(path.join(tmpdir(), 'kritik-525-v-'))
execSync(`git -C "${MAT}" archive main | tar -x -C "${SPIL.split(path.sep).join('/')}"`, { shell: 'bash' })
const quest = await import(pathToFileURL(path.join(SPIL, 'src/spil-quest.js')).href)
const ud = {}
for (const [sted, kaede] of Object.entries({ moellen: quest.QUEST_BANK.moellen })) {
  kaede.forEach((q, k) => {
    let gentagne = 0, alle = 0, tal = {}
    for (let s = 0; s < 500; s++) {
      quest.saetSpilSalt(s * 1999 + 17)
      const tekster = [0, 1, 2, 3].flatMap((r) => q.lavOpgaver(r).map((o) => o.tekst))
      alle += tekster.length
      gentagne += tekster.length - new Set(tekster).size
      for (const t of tekster) { const m = t.match(/\d+\/\d+[^\d]+\d+\/\d+/); if (m) tal[m[0].replace(/[^\d/]+/g, ' og ')] = (tal[m[0].replace(/[^\d/]+/g, ' og ')] ?? 0) + 1 }
    }
    const top = Object.entries(tal).sort((a, b) => b[1] - a[1])[0]
    ud[`${sted}-${k + 1}`] = { titel: q.titel, opgaverPrRunde: q.lavOpgaver(0).length, gentagetAndel: +(gentagne / alle).toFixed(3), hyppigstePar: top ? { par: top[0], andel: +(top[1] / alle).toFixed(3) } : null }
  })
}
writeFileSync(path.join(UD, 'variation-525.json'), JSON.stringify(ud, null, 2) + '\n')
console.log(ud)
