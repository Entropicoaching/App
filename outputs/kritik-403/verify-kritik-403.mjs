// ORDRE 403 blok 3: verify:kritik-403.
//   1. Koerer outputs/kritik-403/scenarier.mjs igen (alle ni scenarier, headless mod
//      e2e-mocken, aldrig prod). KRITIK403_KUN_DOKS=1 springer koerslen over og
//      tjekker de gemte resultat-*.json.
//   2. Invarianter (skal altid holde): intet saet tabt, ingen dublet uden at atleten
//      selv trykker igen, koeen toem efter nettet er tilbage.
//   3. Fund (skal kunne genskabes, saa laenge KRITIK-offline-pas.md siger de findes):
//      O1, O2, O3, O5. Er et fund rettet, fejler verify med besked om at opdatere kritikken.
//   4. Dokumenterne: KRITIK har O1..O8 og "Klar til push:", RAPPORT-403 starter med
//      "Ordre 403" og har de fem afsnit.
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = path.join(HERE, '..', '..')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const lig = (a, b) => JSON.stringify(a) === JSON.stringify(b)

if (!process.env.KRITIK403_KUN_DOKS) {
  console.log('Koerer scenarierne (ca. 5 min) ...')
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

// --- invarianter ---
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

// --- fund der skal kunne genskabes ---
const rettet = (o) => `${o} genskabes ikke laengere. Er den rettet? Opdater docs/kritik-403/KRITIK-offline-pas.md`
ok(online.skaermEfterSendt?.naesteSaet === 'Sæt 1/4' && aabn.skaermEfter28s?.naesteSaet === 'Sæt 1/4', rettet('O1'))
ok(online.atletTrykkerIgen?.raekker?.[0] === 2, rettet('O2'))
ok(typeof logud.bekraeftTekst === 'string' && !/\d+ sæt|usendt|ikke sendt/i.test(logud.bekraeftTekst), rettet('O3'))
ok(ur.afvigelseDage === 7, rettet('O5'))

// --- dokumenterne ---
const kritik = readFileSync(path.join(ROOT, 'docs/kritik-403/KRITIK-offline-pas.md'), 'utf8')
for (let i = 1; i <= 8; i++) ok(kritik.includes(`**O${i}**`), `KRITIK mangler O${i}`)
ok(/\*\*Klar til push: (ja|nej), fordi\*\*/.test(kritik), 'KRITIK mangler linjen "Klar til push: ja/nej, fordi"')
ok(kritik.indexOf('**O1**') < kritik.indexOf('## Hvad der holder'), 'fundene skal staa oeverst i KRITIK')
const rapportSti = path.join(ROOT, 'docs/kritik-403/RAPPORT-403.md')
if (existsSync(rapportSti)) {
  const rapport = readFileSync(rapportSti, 'utf8').replace(/\r/g, '')
  ok(rapport.split('\n')[0].trim() === 'Ordre 403', 'RAPPORT-403.md skal starte med "Ordre 403"')
  for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rapport.includes(a), `RAPPORT-403.md mangler "${a}"`)
} else fejl.push('docs/kritik-403/RAPPORT-403.md mangler')

if (fejl.length) {
  console.error(`verify:kritik-403 ROED (${fejl.length}):\n - ${fejl.join('\n - ')}`)
  process.exit(1)
}
console.log('verify:kritik-403 GROEN: invarianterne holder (intet tabt, ingen dublet af sig selv), O1/O2/O3/O5 genskabt, dokumenterne i orden')
