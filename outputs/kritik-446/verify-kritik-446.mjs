// ORDRE 446: verify:kritik-446. Intet netvaerk og ingen browser; kun de gemte
// maalinger (koert med tid-446, graense-446, uge-446 og coach-446) og dokumenterne.
//   node outputs/kritik-446/verify-kritik-446.mjs 1   blok 1 (atleten)
//   node outputs/kritik-446/verify-kritik-446.mjs 2   blok 1 + blok 2 (coachen)
//   node outputs/kritik-446/verify-kritik-446.mjs 3   alt + KRITIK-app-push og RAPPORT-446
// Kontrollen er, at maalingerne findes, er hele og siger det, KRITIK'en paastaar.
// Rettes et fund i appen og maales igen, bliver den tilsvarende linje roed: saa
// skal KRITIK'en opdateres. Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 3)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HERE, '..', '..', 'docs', 'kritik-446')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-446/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const tjekAf = (r, navn) => r?.tjek?.find(t => t.navn.startsWith(navn))

// --- blok 1: atleten ------------------------------------------------------------
const tid = json('tid-446.json')
if (tid) {
  const m = Object.fromEntries(tid.maalinger.map(x => [`${x.historik}-${x.version}`, x]))
  ok(['let-foer', 'let-efter', 'tung-foer', 'tung-efter'].every(k => m[k]?.runder?.length === 3), 'tid-446: fire kombinationer a 3 aabninger')
  ok(tid.drosling?.cpu === 4 && tid.drosling?.net?.latency === 150, 'tid-446: droslingen er ikke Slow 4G + 4x CPU')
  if (m['tung-efter'] && m['tung-foer'] && m['let-efter'] && m['let-foer']) {
    const tungForskel = m['tung-efter'].medianBrugbartMs - m['tung-foer'].medianBrugbartMs
    const letForskel = Math.abs(m['let-efter'].medianBrugbartMs - m['let-foer'].medianBrugbartMs)
    ok(tungForskel >= 1000, `A-tid: tung historik er kun ${tungForskel} ms langsommere efter 439 (KRITIK siger ca. 2 s)`)
    ok(letForskel < 300, `let historik afviger ${letForskel} ms foer/efter 439 (ventet ingen forskel)`)
    ok(m['tung-efter'].runder.every(r => r.historikBytes > 500000 && r.historikFaerdigMs > r.brugbartMs), 'A-tid: historik-kaldet er ikke laengere > 500 kB og faerdigt efter Dagens pas')
    ok(m['tung-efter'].saetDerTaeller > 4000, 'tung historik skal vaere over graensen 4000')
  }
}
const gr = json('graense-446.json')
if (gr) {
  const k = gr.koersler
  ok(k.length === 3, 'graense-446: tre koersler')
  ok(/Ny rekord/.test(k[0]?.fejring || ''), 'A-rekord genskabes ikke: top for 130 uger siden (uden for 4000) fejres ikke laengere falsk')
  ok(!k[1]?.fejring, 'top for 60 uger siden (inden for 4000) fejres falsk; det burde den ikke')
  ok(/Ny rekord/.test(k[2]?.fejring || '') && k[2]?.historikRaekker === 1000, 'A-rekord med loft 1000 genskabes ikke')
}
const uge = json('uge-446.json')
if (uge) {
  ok(!uge.fejl, `uge-446 stoppede: ${String(uge.fejl).slice(0, 200)}`)
  const t = (n) => tjekAf(uge, n)
  ok(t('intet saet tabt')?.ok, 'uge: et saet er tabt')
  ok(t('ingen dubletter')?.ok, 'uge: dubletter i mocken')
  ok(t('hvert saet har tiden fra Godkendt')?.ok, 'uge: et saet har forkert tid')
  ok(t('hver rekord fejres een gang')?.ok, 'uge: en rekord fejres to gange')
  ok(t('Fremgang viser hver rekord een gang')?.ok, 'uge: Fremgang viser en rekord to gange')
  ok(t('RPE 9 og note')?.ok, 'uge: RPE/note fra kaelderen naaede ikke frem')
  // Fundene, som KRITIK'en bygger paa (roede, naar de er rettet):
  ok(t('Spring over virker uden net')?.ok === false, 'A-spring: "Spring over" virker nu uden net - opdater KRITIK')
  ok(t('vurderingerne givet uden net')?.ok === false, 'A-vurdering: vurderingen uden net naar nu frem - opdater KRITIK')
  ok(t('genaabnet uden net: vaegtfeltet er udfyldt')?.ok === false, 'A-felt: vaegtfeltet er nu udfyldt efter genaabning uden net - opdater KRITIK')
  ok(t('ingen vaegtoevelse gemt med 0 kg')?.ok === false, 'A-felt: ingen 0 kg-saet mere - opdater KRITIK')
  ok(t('en rekord sat uden net staar ogsaa i personal_records')?.ok === false, 'A-pr: offline-rekorden staar nu i personal_records - opdater KRITIK')
  ok(t('ingen konsolfejl')?.ok, 'uge: konsolfejl')
}
const png = readdirSync(HERE).filter(f => f.endsWith('.png'))
ok(png.some(f => f.startsWith('U-')) && png.some(f => f.startsWith('G-')), 'blok 1: skaermbilleder mangler')

// --- blok 2: coachen -------------------------------------------------------------
if (blok >= 2) {
  const c = json('coach-446.json')
  if (c) {
    ok(!c.fejl, `coach-446 stoppede: ${String(c.fejl).slice(0, 200)}`)
    for (const b of ['390', '1280']) ok(c.bredder?.[b]?.log, `coach ${b}: Log ikke maalt`)
    const t = (n) => tjekAf(c, n)
    for (const b of ['390', '1280']) {
      ok(t(`${b}: forsiden siger 4 af 4 pas`)?.ok, `coach ${b}: forsiden siger ikke 4 af 4 pas`)
      ok(t(`${b}: "Kraever dit blik" viser atletens linje`)?.ok, `coach ${b}: atletens linje fra "din uge" mangler`)
      ok(t(`${b}: Log viser det sprungne saet fra pas 3`)?.ok, `coach ${b}: et sprunget saet (med net) staar ikke i Log`)
      ok(t(`${b}: Log viser noten og RPE 9`)?.ok, `coach ${b}: noten fra kaelderen staar ikke i Log`)
      // Fund (roede, naar de er rettet):
      ok(t(`${b}: Log viser baenkpres 4 i pas 2 som sprunget over`)?.ok === false, `A-spring (${b}): coachen ser nu kaelderens spring - opdater KRITIK`)
      ok(t(`${b}: PR-tidslinjen har kaelderens`)?.ok === false, `A-pr (${b}): PR-tidslinjen har nu kaelderens rekorder - opdater KRITIK`)
      ok(c.bredder[b].kopi?.nyeUger?.length >= 1, `coach ${b}: "Kopier seneste uge" ikke maalt`)
    }
    ok(c.bredder['390'].kopi?.nyeUger?.length === 2, 'A-kopi: dobbelttryk paa telefonen giver ikke laengere to uger - opdater KRITIK')
    ok(c.bredder['1280'].kopi?.nyeUger?.length === 1, 'coach 1280: et tryk paa "Kopier seneste uge" gav ikke een uge')
    ok(c.bredder['390'].forsideRigtigMs - c.bredder['390'].forsideMs >= 2000, 'A-forside: telefonens forside viser ikke laengere "Ingen logs" i flere sekunder - opdater KRITIK')
    ok(c.personalRecords?.length > new Set(c.personalRecords).size, 'A-pr: personal_records har ikke laengere dubletter - opdater KRITIK')
    ok(!c.konsolFejl?.length, `coach: konsolfejl ${c.konsolFejl?.join(' | ')}`)
  }
  ok(png.some(f => f.startsWith('C-390-')) && png.some(f => f.startsWith('C-1280-')), 'blok 2: skaermbilleder mangler')
}

// --- blok 3: dom og rapport -----------------------------------------------------
if (blok >= 3) {
  const k = tekst('KRITIK-app-push.md')
  if (k) {
    ok(/^klar til push: (ja|nej), fordi /m.test(k), 'KRITIK: linjen "klar til push: ja/nej, fordi" mangler')
    ok(k.indexOf('A1') > -1 && k.indexOf('A1') < k.indexOf('klar til push') + 2000, 'KRITIK: fund A1 ... skal staa oeverst')
  }
  const r = tekst('RAPPORT-446.md')
  if (r) {
    ok(r.split('\n')[0].trim() === 'Ordre 446', 'RAPPORT: foerste linje skal vaere "Ordre 446"')
    for (const h of ['Hvad blev lavet', 'Hvad blev testet', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
  }
}

if (fejl.length) { console.error(`verify:kritik-446 (blok ${blok}) ROED:\n - ${fejl.join('\n - ')}`); process.exit(1) }
console.log(`verify:kritik-446 (blok ${blok}) GROEN`)
