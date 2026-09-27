// ORDRE 483, blok 2 i verify:kritik-483: skaktimen (skaktime-483.json) mod SKAK-KRITIK og RAPPORT-483.
import { existsSync } from 'node:fs'
import path from 'node:path'

export function verifyBlok2({ ok, json, tekst, fund, HERE }) {
  const sk = tekst('SKAK-KRITIK.md')
  if (sk) {
    ok(/^skaktime med klassens storm klar: (ja|nej)\b/.test(sk.split('\n')[0]), 'SKAK-KRITIK: foerste linje skal vaere "skaktime med klassens storm klar: ja/nej"')
    const s = fund(sk, 'S')
    ok(s.length >= 3 && s.every((n, i) => Number(n) === i + 1), `SKAK-KRITIK: fund S1-Sn i orden (fandt ${s.join(',')})`)
  }
  const r = json('skaktime-483.json')
  if (r) {
    const t = (n) => r.tjek.find((x) => x.navn.startsWith(n))
    ok(!r.fejl, `skaktimen stoppede: ${String(r.fejl).slice(0, 200)}`)
    ok(r.sideFejl.length === 0 && r.netvaerk.length === 0, 'skaktimen: JavaScript-fejl eller netvaerk')
    ok(r.tjek.filter((x) => x.ok).length === 24 && r.tjek.filter((x) => !x.ok).length === 8, `skaktimen: ${r.tjek.filter((x) => x.ok).length} groenne og ${r.tjek.filter((x) => !x.ok).length} fund, dokumentet siger 24 og 8`)
    for (const n of ['bord 1-4 (rigtig dato) faar samme kode', 'bord 5 (forkert dato) faar en anden kode', 'bord 1-4: resultatlinjen', '25 elever: 12 borde', 'projektoren (1280x720) viser alle 12 borde', 'bord 2 (tid ude)', 'rundeuret siger tydeligt', '"Parr runde 2" er laast', 'efter genindlaesning husker']) ok(t(n)?.ok, `skaktimen: "${n}" er ikke groen`)
    // Fundene, som dokumentet bygger paa, skal stadig vaere fund i maalingen.
    ok(t('stormens projektorvindue skifter selv')?.ok === false, 'S3: stormens vindue skifter nu selv - ret SKAK-KRITIK')
    ok(r.elever['1']?.spil?.urStandard === 'intet' && r.elever['1']?.spil?.fritStandard === '15+10', 'S2: urets standard er ikke Intet / Frit 15+10')
    ok(r.maal.elev390.startStormenErPrimaer && !r.maal.elev390.dagensStormErPrimaer && r.maal.elev390.stormKortY > 844, 'S4: knapperne eller folden paa 390 er aendret')
    ok(!r.maal.projektorViserKode && !r.maal.laererViserKode, 'S5: projektoren eller laerersiden viser nu koden')
    ok(r.elever['5']?.knap === 'Dagens storm (27/9)', 'S5: pc\'en med forkert dato viser ikke 27/9 paa knappen')
    ok(t('bord 4 (90 s for sent)')?.ok === false && /på tid/.test(r.elever['4']?.meld ?? ''), 'S6: bord 4 er ikke stadig i gang ved 0:00')
    ok(r.maal.eleverDerSkalFlytteRunde2 === 22, `S1/S7: ${r.maal.eleverDerSkalFlytteRunde2} elever flytter, ikke 22`)
    ok(r.maal.runde1Indtastning?.tryk === 14 && r.maal.runde2Indtastning?.rundeurTryk === 2, 'S1: resultattryk / rundeurtryk passer ikke')
    ok(r.maal.navneTegn === 199 && r.maal.stillingSynlig?.['1280x720'] === 21 && r.maal.stillingSynlig?.['1024x768'] === 25, 'S8: navne/stilling passer ikke')
    ok(r.maal.stormIndtastning?.trykOgFeltskift === 36, 'stormens indtastning passer ikke')
    for (const f of r.skaermbilleder) ok(existsSync(path.join(HERE, f)), `${f} mangler`)
    ok(r.skaermbilleder.filter((f) => /S-390-/.test(f)).length >= 5 && r.skaermbilleder.filter((f) => /S-1280-/.test(f)).length >= 8, 'skaermbilleder paa 390 og 1280 mangler')
  }
  if (sk && r) {
    for (const s of ['24 tjek grønne og 8 fund', '(y 1157)', '(y 1209)', '(y 915', '22 af 24', '199 tegn', '21 af 25', '14 tryk']) ok(sk.includes(s), `SKAK-KRITIK citerer ikke "${s}"`)
  }
  const rp = tekst('RAPPORT-483.md')
  if (rp) {
    ok(rp.split('\n')[0].trim() === 'Ordre 483', 'RAPPORT-483: foerste linje skal vaere "Ordre 483"')
    for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rp.includes(a), `RAPPORT-483: afsnittet "${a}" mangler`)
    ok(/fejlfigurer klar til sitet: nej/i.test(rp) && /skaktime med klassens storm klar: nej/i.test(rp), 'RAPPORT-483: begge domme skal staa')
    ok(/Yantra/.test(rp) && /Chaturanga/.test(rp), 'RAPPORT-483: "Hvad er naeste" skal have Yantra og Chaturanga')
  }
}
