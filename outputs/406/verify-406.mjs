// ORDRE 406 blok 3: kopi af outputs/kritik-403/verify-kritik-403.mjs (Bhishak, ordre 403),
// med forventningen vendt for de fund, 406 retter.
//   1. Koerer outputs/406/scenarier.mjs (Bhishaks ni scenarier + o2-anden-telefon, headless
//      mod e2e-mocken, aldrig prod). VERIFY406_KUN_RESULTATER=1 springer koerslen over og
//      tjekker de gemte outputs/406/resultat-*.json.
//   2. Invarianterne fra 403 (uaendrede): intet saet tabt, ingen dublet af sig selv, koeen toem.
//   3. Rettet: O1 (Dagens pas viser "Sæt 4/4" efter afsendelsen), O2 (ingen dublet, og saettet
//      beholder sin foerste tid, naar skaermen ikke kender raekken), O3 (log ud naevner de
//      usendte saet, login uden net siger "Ingen forbindelse").
//   4. Stadig til stede (ikke rettet i 406): O5 (telefonens ur).
//   5. docs/RAPPORT-406.md starter med "Ordre 406" og har de fem afsnit.
// Kun ASCII i beskederne. Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = path.join(HERE, '..', '..')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const lig = (a, b) => JSON.stringify(a) === JSON.stringify(b)

if (!process.env.VERIFY406_KUN_RESULTATER) {
  console.log('Koerer de ti scenarier (ca. 6 min) ...')
  const k = spawnSync(process.execPath, [path.join(HERE, 'scenarier.mjs')], { cwd: ROOT, stdio: 'inherit' })
  ok(k.status === 0, `scenarier.mjs sluttede med ${k.status}`)
}

const res = (navn) => {
  const f = path.join(HERE, `resultat-${navn}.json`)
  if (!existsSync(f)) { fejl.push(`resultat-${navn}.json mangler`); return {} }
  const r = JSON.parse(readFileSync(f, 'utf8'))
  ok(r.koerselOk, `${navn}: koerslen fejlede: ${String(r.fejl).split('\n')[0]}`)
  return r
}

// --- invarianter (som i 403) ---
const kaelder = res('kaelder')
ok(lig(kaelder.squatPrSaet, [1, 1, 1, 1]) && lig(kaelder.baenkPrSaet, [1, 0]), `kaelder: raekker squat ${JSON.stringify(kaelder.squatPrSaet)} baenk ${JSON.stringify(kaelder.baenkPrSaet)}, ventet [1,1,1,1] og [1,0]`)
ok(kaelder.koeGenaabnet === 4, `kaelder: saet 4 (appen lukket ved "Godkendt") skulle ligge i koeen, fik ${kaelder.koeGenaabnet}`)
ok(kaelder.koeTomt && kaelder.tidRigtig, 'kaelder: koeen ikke toem, eller tiden fra "Godkendt" ikke bevaret')
const online = res('online-start')
ok(lig(online.raekkerEfterSendt, [1, 1, 1, 0]) && online.koeTomt, `online-start: efter afsendelse ${JSON.stringify(online.raekkerEfterSendt)}, ventet [1,1,1,0]`)
const aabn = res('aabn-med-net')
ok(lig(aabn.raekker, [1, 1, 1, 0]) && aabn.koeTomt, `aabn-med-net: ${JSON.stringify(aabn.raekker)}, ventet [1,1,1,0]`)
const haeng = res('haenger')
ok(lig(haeng.raekker, [1, 1, 1, 0]) && haeng.koeTomt, `haenger: ${JSON.stringify(haeng.raekker)}, ventet [1,1,1,0]`)
const faner = res('to-faner')
ok(lig(faner.raekker, [1, 1, 0, 0]) && faner.koeTomt, `to-faner: ${JSON.stringify(faner.raekker)}, ventet [1,1,0,0]`)
const logud = res('log-ud')
ok(logud.koeEfterLogUd === 2 && lig(logud.raekker, [1, 1, 0, 0]), `log-ud: koeen efter log ud ${logud.koeEfterLogUd}, raekker ${JSON.stringify(logud.raekker)}`)
const skift = res('skift-atlet')
ok(skift.aRaekkerMensB === 0 && skift.bSerAsSaet === false && skift.aKoeMensB === 2, 'skift-atlet: atlet B saa eller sendte atlet A\'s saet')
ok(lig(skift.aRaekker, [1, 1, 0, 0]) && skift.bRaekkerEfter === 0, `skift-atlet: A ${JSON.stringify(skift.aRaekker)}, B ${skift.bRaekkerEfter}`)
const sw = res('sw-opdatering')
ok(lig(sw.raekker, [1, 1, 0, 0]) && sw.koeTomt, `sw-opdatering: ${JSON.stringify(sw.raekker)}, ventet [1,1,0,0]`)
const ur = res('forkert-ur')
ok(ur.koeTomt && (ur.loggedAt || []).length === 2, 'forkert-ur: to saet skulle vaere sendt')

// --- rettet i 406 ---
ok(online.skaermEfterSendt?.naesteSaet === 'Sæt 4/4', `O1: online-start viser "${online.skaermEfterSendt?.naesteSaet}" efter afsendelsen, ventet "Saet 4/4"`)
ok(aabn.skaermEfter28s?.naesteSaet === 'Sæt 4/4', `O1: aabn-med-net viser "${aabn.skaermEfter28s?.naesteSaet}" efter 28 s, ventet "Saet 4/4"`)
ok(!online.atletTrykkerIgen && !aabn.atletTrykkerIgen, 'O1: atleten saa et forkert saet og trykkede igen')
const o2 = res('o2-anden-telefon')
ok(o2.aSkaermFoer?.naesteSaet === 'Sæt 1/4', 'O2: telefon A skulle vise "Saet 1/4" (kender ikke raekken fra telefon B)')
ok(lig(o2.raekker, [1, 0, 0, 0]), `O2: telefon A's "Godkendt" gav ${JSON.stringify(o2.raekker)}, ventet [1,0,0,0] (ingen dublet)`)
ok(o2.bTid && o2.saet1Tid === o2.bTid, `O2: saet 1's tid flyttet fra ${o2.bTid} til ${o2.saet1Tid}`)
ok(/Du har 2 sæt, der ikke er sendt endnu/.test(logud.bekraeftTekst || ''), `O3: log ud-spoergsmaalet naevner ikke de 2 usendte saet: "${logud.bekraeftTekst}"`)
ok(/Ingen forbindelse/.test(logud.loginUdenNetTekst || ''), `O3: login uden net siger "${logud.loginUdenNetTekst}", ventet "Ingen forbindelse"`)

// --- stadig til stede (ikke en del af 406) ---
ok(ur.afvigelseDage === 7, 'O5 genskabes ikke laengere. Er den rettet? Opdater forventningen her')

// --- rapporten ---
const rapportSti = path.join(ROOT, 'docs/RAPPORT-406.md')
if (existsSync(rapportSti)) {
  const rapport = readFileSync(rapportSti, 'utf8').replace(/\r/g, '')
  ok(rapport.split('\n')[0].trim() === 'Ordre 406', 'RAPPORT-406.md skal starte med "Ordre 406"')
  for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rapport.includes(a), `RAPPORT-406.md mangler et af de fem afsnit (${a.normalize('NFD').replace(/[^\x20-\x7e]/g, '')})`)
} else fejl.push('docs/RAPPORT-406.md mangler')

if (fejl.length) {
  console.error(`verify-406 ROED (${fejl.length}):\n - ${fejl.join('\n - ')}`)
  process.exit(1)
}
console.log('verify-406 GROEN: invarianterne holder (intet tabt, ingen dublet af sig selv), O1/O2/O3 rettet, O5 stadig til stede, rapporten i orden')
