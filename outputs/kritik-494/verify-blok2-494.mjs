// ORDRE 494, blok 2 i verify:kritik-494: Min krop gentjek (min-krop-494.json) mod MIN-KROP-GENTJEK og RAPPORT-494.
import { existsSync } from 'node:fs'
import path from 'node:path'

export function verifyBlok2({ ok, json, tekst, alleGroenne, HERE }) {
  const g = tekst('MIN-KROP-GENTJEK.md')
  if (g) {
    ok(/^Min krop klar til sitet: (ja|nej)\b/.test(g.split('\n')[0]), 'MIN-KROP-GENTJEK: foerste linje skal vaere "Min krop klar til sitet: ja/nej"')
    for (const m of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']) ok(new RegExp(`^\\| ${m} \\|`, 'm').test(g), `MIN-KROP-GENTJEK: ${m} mangler i tabellen`)
    ok(/\*\*M8\./.test(g), 'MIN-KROP-GENTJEK: M8 mangler')
  }
  const r = json('min-krop-494.json')
  alleGroenne(r, 'min-krop-494')
  if (r && g) {
    ok(r.linjer.B.squatBund.includes('overkrop og skinneben tilsammen'), 'M1: krop B i bunden')
    ok(Object.values(r.plus2).every((v) => v < 4) && Math.max(...Object.values(r.plus2)) === 3.5, 'M2: 2 cm-fejlen')
    ok(r.side[390].res.alle114.figurer === 0 && /203 cm/.test(r.side[390].res.alle114.besked) && g.includes('203 cm'), 'M3: 114 % paa 390')
    ok(r.haand.grebCm === 9.6 && r.haand.plus8Gammel === 11 && r.haand.nyReach === r.haand.gammelReach && g.includes('11,0 cm'), 'M4: haanden')
    ok(r.tegningBredde.trochanter === 46 && r.tegningBredde.hoftekam === 39 && r.tegningBredde.talje === 35, 'M5: tegningens bredder')
    ok(r.side[390].hoejde === 9841 && g.includes('9841 px'), 'M7: sidens hoejde paa 390')
    ok(r.tjek.find((t) => /5 cm for hoejt/.test(t.hvad))?.data?.sumPct === 100 && g.includes('59,3°'), 'M8: hoftepunktet 5 cm')
  }
  for (const f of ['K-390-krop-B.png', 'K-1280-krop-B.png', 'K-390-114.png', 'K-1280-114.png']) ok(existsSync(path.join(HERE, f)), `${f} mangler`)
  const rp = tekst('RAPPORT-494.md')
  if (rp) {
    ok(rp.split('\n')[0].trim() === 'Ordre 494', 'RAPPORT-494: foerste linje skal vaere "Ordre 494"')
    for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rp.includes(a), `RAPPORT-494: afsnittet "${a}" mangler`)
    ok(/Mål dit billede klar til sitet: nej/i.test(rp) && /Min krop klar til sitet: ja/i.test(rp), 'RAPPORT-494: begge domme skal staa')
    ok(/Yantra/.test(rp) && /Setu/.test(rp), 'RAPPORT-494: "Hvad er naeste" skal naevne Yantra og Setu')
  }
}
