// ORDRE 234 · commit 3 — ét sted at se det hele. Kører alle enhedstests
// (*.test.js under src/ og public/, via node --test), alle verify:*-scripts
// fra package.json (læst derfra, ikke hardkodet — listen kan aldrig drive fra
// den ægte kommando), og e2e (npm run e2e) hvis port 8991 er fri. Skriver én
// samlet tabel til outputs/_seneste/proever.md: navn, resultat, varighed, og
// hvad prøven venter på (se docs/PROEVER-KORT.md for den fulde analyse bag
// hver kategori — dette script gengiver kun en kort, praktisk linje pr. type).
//
// Formålet er ordre 234's egen pointe: Dhruva skal kunne læse ÉT facit før en
// merge, i stedet for at stole på en rapports ord om at "alt er grønt".
//
// Kørsel: npm run proever
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createServer } from 'node:net'

const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
const OUT_DIR = join(ROOT, 'outputs', '_seneste')
mkdirSync(OUT_DIR, { recursive: true })
const OUT_PATH = join(OUT_DIR, 'proever.md')

function findTestFiles(dir, out = []) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) findTestFiles(full, out)
    else if (entry.name.endsWith('.test.js')) out.push(full)
  }
  return out
}

function tail(result) {
  const out = `${result.stdout || ''}${result.stderr || ''}`.trim()
  const lines = out.split('\n').filter(Boolean)
  return lines.slice(-3).join(' / ').slice(0, 300)
}

function runNode(name, args, venterPaa, kind) {
  const t0 = Date.now()
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' })
  const ms = Date.now() - t0
  const ok = result.status === 0
  return { name, kind, ok, ms, venterPaa, tail: ok ? '' : tail(result) }
}

function portFree(port) {
  return new Promise(resolve => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

const rows = []

// ---- 1) Enhedstests: én række pr. *.test.js-fil ----
const testFiles = [...findTestFiles(join(ROOT, 'src')), ...findTestFiles(join(ROOT, 'public'))]
for (const file of testFiles.sort()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  rows.push(runNode(rel, ['--test', file], 'assert i koden (node --test, ingen browser, ingen timeout)', 'enhedstest'))
}

// ---- 2) Alle verify:*-scripts, læst fra package.json ----
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const verifyNames = Object.keys(pkg.scripts).filter(k => k.startsWith('verify:')).sort()
for (const scriptName of verifyNames) {
  const cmdLine = pkg.scripts[scriptName]
  const m = cmdLine.match(/^node\s+(\S+)(.*)$/)
  if (!m) { rows.push({ name: scriptName, kind: 'verify', ok: false, ms: 0, venterPaa: 'ukendt kommandoform', tail: cmdLine }); continue }
  const scriptPath = m[1]
  const extraArgs = m[2].trim().split(/\s+/).filter(Boolean)
  let venterPaa = 'statisk kildetjek eller enhedstest (ingen browser, ingen timeout)'
  try {
    const src = readFileSync(join(ROOT, scriptPath), 'utf8')
    if (/chromium|launchBrowser/.test(src)) venterPaa = 'browser: DOM-tilstand/global variabel/mock-tabel (se docs/PROEVER-KORT.md)'
  } catch { /* scriptet findes ikke — spawnSync nedenfor rapporterer selv fejlen */ }
  rows.push(runNode(scriptName, [scriptPath, ...extraArgs], venterPaa, 'verify'))
}

// ---- 3) e2e (kun hvis port 8991 er fri — samme grænse ordre 234 selv sætter) ----
if (await portFree(8991)) {
  rows.push(runNode('e2e (run-all.mjs)', [join('e2e', 'run-all.mjs')],
    'DOM-tilstand + mockens tabeller (se e2e/*.spec.mjs) — dækker IKKE ægte stangbane-sporing, se docs/PROEVER-KORT.md', 'e2e'))
} else {
  rows.push({ name: 'e2e (run-all.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 3b) "Film et sæt" — atlet-flowet, klik-igennem + kassér/gem (ordre 262)
// Genererer sit eget klip (scripts/make-test-clip.mjs's 'glat'-variant) - ingen
// afhængighed af lokalt test-clips/, derfor ubetinget (samme grænse: port
// 8991 fri) i modsætning til punkt 4's rigtige-klip-tjek nedenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (athlete-film-et-saet.mjs)', [join('e2e', 'athlete-film-et-saet.mjs')],
    'DOM-tilstand (athleteInstantResult) + mockens video_analyses-tabel (kassér=intet gemt, gem=awaiting_analysis-række)', 'e2e'))
} else {
  rows.push({ name: 'e2e (athlete-film-et-saet.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 3c) coachen ser en gemt måling uden at åbne VideoCoach (ordre 266)
if (await portFree(8991)) {
  rows.push(runNode('e2e (coach-ser-maaling.mjs)', [join('e2e', 'coach-ser-maaling.mjs')],
    'DOM-tekst (kompakt måling i atletlisten + Coach Briefing) + at reviewvisningen åbner på ét klik', 'e2e'))
} else {
  rows.push({ name: 'e2e (coach-ser-maaling.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 4) det rigtige klik-igennem-flow mod et rigtigt klip (ordre 245) ----
// 5/5 grønne, 29,6-29,9s, se docs/RAPPORT-245.md — går ind som fuld prøve.
// test-clips/ er git-ignoreret persondata: findes klippet ikke lokalt (fx på
// en anden maskine end den ordren blev leveret fra), springer selve scriptet
// ærligt over (samme mønster som port-tjekket ovenfor) — det tælles her som
// SPRUNGET OVER, ikke som en fejl.
if (await portFree(8991)) {
  const { clipAvailable } = await import('../e2e/coach-sporing-rigtigt-klip.mjs')
  if (clipAvailable()) {
    rows.push(runNode('e2e (coach-sporing-rigtigt-klip.mjs)', [join('e2e', 'coach-sporing-rigtigt-klip.mjs')],
      'det faktiske udfald (arket åbner med resultat, eller "Stangen blev tabt") på et rigtigt klip — ikke en banner-gætning, se docs/RAPPORT-245.md', 'e2e'))
  } else {
    rows.push({ name: 'e2e (coach-sporing-rigtigt-klip.mjs)', kind: 'e2e', ok: null, ms: 0,
      venterPaa: 'sprunget over: test-clips/marc-doedloeft-270.mov findes ikke lokalt (git-ignoreret)', tail: '' })
  }
} else {
  rows.push({ name: 'e2e (coach-sporing-rigtigt-klip.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 5) Dagens pas: næste sæt logges direkte fra Hjem, pausetimeren starter
// og tæller ned (ordre 263 · commit 4). Egen mock-instans (ikke i
// run-all.mjs's delte sekvens, se e2e/dagens-pas.spec.mjs's egen kommentar
// for hvorfor), så samme port-grænse gælder her for sig.
if (await portFree(8991)) {
  rows.push(runNode('e2e (dagens-pas.spec.mjs)', [join('e2e', 'dagens-pas.spec.mjs')],
    'DOM-tilstand + mockens exercise_logs, og at pausens sekundtal faktisk falder (ikke kun vises)', 'e2e'))
} else {
  rows.push({ name: 'e2e (dagens-pas.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 6) Check-in: forudfyldning + ét tryk, "hvad coachen ser"/"hvad der
// ændrede sig sidst" efter afsendelse, og ugens påmindelse i Dagens pas
// (ordre 267 · commit 4). Egen mock-instans (egen uge-/parathedshistorik i
// seeden), samme port-grænse som dagens-pas.spec.mjs ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (check-in.spec.mjs)', [join('e2e', 'check-in.spec.mjs')],
    'DOM-tilstand + mockens readiness_logs, og at nudge-linjen forsvinder efter afsendelse', 'e2e'))
} else {
  rows.push({ name: 'e2e (check-in.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 7) En atlets uge, i rækkefølge, som ÉN prøve (ordre 269 · commit 1):
// Dagens pas → tre sæt (pausetimer) → sidste gang-linjen → Volumen →
// check-in → Film et sæt → målingen. Egen mock-instans (egen "sidste
// gang"-seed), samme port-grænse som dagens-pas/check-in ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (atlet-uge.spec.mjs)', [join('e2e', 'atlet-uge.spec.mjs')],
    'DOM-tilstand + mockens exercise_logs/readiness_logs/video_analyses + iframets egen analyse-returværdi, i rækkefølge over hele flowet', 'e2e'))
} else {
  rows.push({ name: 'e2e (atlet-uge.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 8) Coachens atletliste sorteret efter afvigelse denne uge, et klik
// derhen og tilbage (ordre 277 · commit 3). Egen mock-instans (tre atleter i
// forskellige tilstande), samme port-grænse som ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (coach-afvigelse.spec.mjs)', [join('e2e', 'coach-afvigelse.spec.mjs')],
    'DOM-rækkefølge (størst afvigelse øverst, ingen plan nederst) + at sorteringen er uændret efter et klik derhen og tilbage', 'e2e'))
} else {
  rows.push({ name: 'e2e (coach-afvigelse.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 9) Fremgang-fanen på 360px, i rækkefølge (ordre 284 · commit 3): åbn
// fanen (Squat-kurven vises automatisk) → skift til en tom øvelse ("Ingen
// logninger endnu.") → kom tilbage til Squat, kurven uændret. Egen
// mock-instans (egen exercise_logs-historik i to kalenderuger), samme
// port-grænse som de øvrige atlet-specs ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (fremgang.spec.mjs)', [join('e2e', 'fremgang.spec.mjs')],
    'DOM-tekst (e1RM-kurven/"Ingen logninger endnu.") på en 360px-viewport, gennem skift af øvelse og tilbage', 'e2e'))
} else {
  rows.push({ name: 'e2e (fremgang.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 10) Mandagsrunden som én prøve: 20 atleter, sortér, gå ind på de tre
// øverste én ad gangen og tilbage — sorteringen OG rullepositionen skal
// holde (ordre 285 · commit 3). Egen mock-instans, samme port-grænse.
if (await portFree(8991)) {
  rows.push(runNode('e2e (coach-mandagsrunden.spec.mjs)', [join('e2e', 'coach-mandagsrunden.spec.mjs')],
    'DOM-rækkefølge (uændret efter tilbage) + faktisk scrollY før/efter, ikke antaget', 'e2e'))
} else {
  rows.push({ name: 'e2e (coach-mandagsrunden.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 11) Dagens pas' forudfyldning når historikken ankommer (ordre 293 · F3):
// planens tal først, så "sidste gang" (95/5); en vægt/reps atleten har trykket
// eller tastet før historikken kommer bliver stående. Historik-hentningen
// holdes tilbage i browseren, så rækkefølgen er deterministisk. Egen
// mock-instans, samme port-grænse som ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (dagens-pas-historik.spec.mjs)', [join('e2e', 'dagens-pas-historik.spec.mjs')],
    'felternes værdi (inputValue) før og efter at historikken slippes, samt at et trykket/tastet felt ikke overskrives', 'e2e'))
} else {
  rows.push({ name: 'e2e (dagens-pas-historik.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 12) Automatiseringsfejl i Indbakken (ordre 301 · commit 2): to uløste
// og en løst række i mockens automation_alerts vises uden overlap på 390x844
// og desktop, "Markeret som set" fjerner rækken, en manglende RPC fejler
// synligt ved rækken, og en Indbakke uden fejl er ordret som før. Egen
// mock-instans pr. viewport, samme port-grænse som ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (coach-automation-alerts.spec.mjs)', [join('e2e', 'coach-automation-alerts.spec.mjs')],
    'DOM (rækker, tekst, bokse uden overlap, ingen vandret rulning) + mockens resolved_at + fejlen ved rækken når RPC-funktionen mangler', 'e2e'))
} else {
  rows.push({ name: 'e2e (coach-automation-alerts.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 13) "Dagens pas" siger tydeligt hvilket sæt man er på (ordre 314):
// tre sæt i træk på 390×844 og 360×780, "Sæt N af M" stemmer hele vejen,
// klarede sæt kompakte, ingen vandret overflow (F4 fra docs/KRITIK-288.md).
// Egen mock-instans pr. viewport, samme port-grænse som ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (saet-nu.spec.mjs)', [join('e2e', 'saet-nu.spec.mjs')],
    'DOM-tekst ("Sæt N af M", klarede/næste-linjer) + document.documentElement.scrollWidth på to viewports', 'e2e'))
} else {
  rows.push({ name: 'e2e (saet-nu.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- 14) "ret" på et klaret sæt redigerer in place, sletter ikke (ordre
// 320): ret sæt 2 (vægt op 2,5 kg) — sæt 3 forbliver synligt, Sæt 4/4 er
// uændret, offline-køen fra 293 virker stadig ved "ret" (ret sæt 1 uden net,
// sendes uden dublet når forbindelsen kommer tilbage). Egen mock-instans pr.
// viewport, samme port-grænse som ovenfor.
if (await portFree(8991)) {
  rows.push(runNode('e2e (ret-saet.spec.mjs)', [join('e2e', 'ret-saet.spec.mjs')],
    'DOM-tekst (Sæt N/M, klarede-sæt-linjer, "gemt lokalt") + mockens exercise_logs (antal rækker, opdateret vægt) på to viewports', 'e2e'))
} else {
  rows.push({ name: 'e2e (ret-saet.spec.mjs)', kind: 'e2e', ok: null, ms: 0,
    venterPaa: 'sprunget over: port 8991 var optaget', tail: '' })
}

// ---- Skriv tabellen ----
const lines = []
lines.push('# Prøver — samlet facit (ordre 234)')
lines.push('')
lines.push(`Kørt: ${new Date().toISOString()}`)
lines.push('')
lines.push('| Type | Navn | Resultat | Varighed | Ventede på |')
lines.push('|---|---|---|---|---|')
for (const r of rows) {
  const resultat = r.ok === null ? 'SPRUNGET OVER' : r.ok ? 'GRØN' : 'FEJL'
  lines.push(`| ${r.kind} | ${r.name} | ${resultat} | ${(r.ms / 1000).toFixed(1)}s | ${r.venterPaa} |`)
}
lines.push('')

const failed = rows.filter(r => r.ok === false)
if (failed.length) {
  lines.push('## Fejlede (sidste linjer)')
  lines.push('')
  for (const r of failed) lines.push(`- **${r.name}**: ${r.tail}`)
  lines.push('')
}

const green = rows.filter(r => r.ok === true).length
const red = failed.length
const skipped = rows.filter(r => r.ok === null).length
lines.push(`**${green}/${rows.length} grønne** (${red} fejl, ${skipped} sprunget over).`)
lines.push('')
lines.push('Se `docs/PROEVER-KORT.md` for hvad hver kategori af prøve venter på, og hvorfor.')

const report = lines.join('\n') + '\n'
writeFileSync(OUT_PATH, report)
console.log(report)
console.log(`Skrevet: ${OUT_PATH}`)
process.exitCode = red > 0 ? 1 : 0
