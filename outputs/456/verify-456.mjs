// ORDRE 456: KOPI af outputs/kritik-446/verify-kritik-446.mjs (Bhishak) med de
// opdaterede forventninger: fundene A1-A9 maa IKKE genskabes. Det, der holdt i
// 446 (intet tabt, ingen dubletter, rigtig tid, een fejring pr. rekord, RPE og
// note, coachens Log og "Kraever dit blik"), tjekkes uaendret. Laeser de nye
// maalinger i outputs/456 (samme filnavne som 446) og docs/RAPPORT-456.md.
// Intet netvaerk og ingen browser.
//   node outputs/456/verify-456.mjs 1   blok 1 (atleten: A1-A4, A9)
//   node outputs/456/verify-456.mjs 2   + blok 2 (coachen: A5-A8)
//   node outputs/456/verify-456.mjs 3   + RAPPORT-456
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 3)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tjekAf = (r, navn) => r?.tjek?.find(t => t.navn.startsWith(navn))

// --- blok 1: atleten ------------------------------------------------------------
const tid = json('tid-446.json')
if (tid) {
  const m = Object.fromEntries(tid.maalinger.map(x => [`${x.historik}-${x.version}`, x]))
  ok(['let-foer', 'let-efter', 'tung-foer', 'tung-efter'].every(k => m[k]?.runder?.length === 3), 'tid: fire kombinationer a 3 aabninger')
  ok(tid.drosling?.cpu === 4 && tid.drosling?.net?.latency === 150, 'tid: droslingen er ikke Slow 4G + 4x CPU')
  if (m['tung-efter'] && m['tung-foer'] && m['let-efter'] && m['let-foer']) {
    const tungForskel = m['tung-efter'].medianBrugbartMs - m['tung-foer'].medianBrugbartMs
    const letForskel = Math.abs(m['let-efter'].medianBrugbartMs - m['let-foer'].medianBrugbartMs)
    // A9: Dagens pas er ikke laengere ca. 2 s langsommere med tung historik.
    ok(tungForskel < 1000, `A9 genskabt: tung historik er ${tungForskel} ms langsommere end foer 439`)
    ok(letForskel < 500, `let historik afviger ${letForskel} ms foer/efter`)
    // A9: historikken hentes efter Dagens pas, og ved en genaabning kun det nye.
    ok(m['tung-efter'].runder.every(r => r.historikFaerdigMs == null || r.historikFaerdigMs > r.brugbartMs), 'A9: historikken hentes foer Dagens pas er brugbart')
    ok(m['tung-efter'].runder.every(r => r.historikBytes == null || r.historikBytes < 100000), `A9: en genaabning henter stadig hele historikken (${m['tung-efter'].runder.map(r => r.historikBytes).join(', ')} bytes)`)
    ok(m['tung-efter'].saetDerTaeller > 4000, 'tung historik skal vaere over 4000 saet')
  }
}
const gr = json('graense-446.json')
if (gr) {
  const k = gr.koersler
  ok(k.length === 3, 'graense: tre koersler')
  for (const x of k || []) {
    ok(!x.fejring, `A4 genskabt: top for ${x.topForUger} uger siden, loft ${x.loft}: falsk fejring "${x.fejring}"`)
    ok(x.bedstFoerSquatE1rm === 128, `A4: "bedst foer" er ${x.bedstFoerSquatE1rm}, ikke den gamle top 128 (top for ${x.topForUger} uger siden, loft ${x.loft})`)
    ok(x.historikRaekker > 4000, `A4: kun ${x.historikRaekker} raekker hentet (top for ${x.topForUger} uger siden, loft ${x.loft})`)
  }
  ok(k?.[2]?.loft === 1000, 'graense: tredje koersel skal have loftet 1000 (Max rows)')
}
const uge = json('uge-446.json')
if (uge) {
  ok(!uge.fejl, `uge stoppede: ${String(uge.fejl).slice(0, 200)}`)
  const t = (n) => tjekAf(uge, n)
  for (const n of ['intet saet tabt', 'ingen dubletter', 'hvert saet har tiden fra Godkendt', 'hver rekord fejres een gang', 'Fremgang viser hver rekord een gang', 'RPE 9 og note', 'ingen konsolfejl', 'ingen vandret rul']) ok(t(n)?.ok, `uge: "${n}" holder ikke`)
  // Fundene fra 446, nu rettet:
  ok(t('Spring over virker uden net')?.ok === true, 'A2 genskabt: "Spring over" virker ikke uden net')
  ok(!uge.springOverErstattet, 'A2 genskabt: atleten maatte godkende et saet i stedet for at springe det over')
  ok(t('vurderingerne givet uden net')?.ok === true, 'A3 genskabt: vurderingen givet uden net naaede ikke frem')
  ok(t('genaabnet uden net: vaegtfeltet er udfyldt')?.ok === true, 'A1 genskabt: vaegtfeltet er tomt efter genaabning uden net')
  ok(t('ingen vaegtoevelse gemt med 0 kg')?.ok === true, 'A1 genskabt: et 0 kg-saet paa en vaegtoevelse')
  ok(t('en rekord sat uden net staar ogsaa i personal_records')?.ok === true, 'A5 genskabt: rekorden sat uden net mangler i personal_records')
  const prs = (uge.personalRecords || []).map(p => `${p.oevelse} ${p.weight}x${p.reps}`)
  ok(prs.length === new Set(prs).size, `A5 genskabt: dubletter i personal_records: ${prs.join(', ')}`)
  ok(prs.length === (uge.fejringPrSaet || []).length, `A5: ${prs.length} raekker i personal_records mod ${(uge.fejringPrSaet || []).length} fejrede rekorder`)
}
const png = readdirSync(HERE).filter(f => f.endsWith('.png'))
ok(png.some(f => f.startsWith('U-')) && png.some(f => f.startsWith('G-')), 'blok 1: skaermbilleder mangler')

// --- blok 2: coachen -------------------------------------------------------------
if (blok >= 2) {
  const c = json('coach-446.json')
  if (c) {
    ok(!c.fejl, `coach stoppede: ${String(c.fejl).slice(0, 200)}`)
    const t = (n) => tjekAf(c, n)
    for (const b of ['390', '1280']) {
      ok(c.bredder?.[b]?.log, `coach ${b}: Log ikke maalt`)
      ok(t(`${b}: forsiden siger 4 af 4 pas`)?.ok, `coach ${b}: forsiden siger ikke 4 af 4 pas`)
      ok(t(`${b}: "Kraever dit blik" viser atletens linje`)?.ok, `coach ${b}: atletens linje fra "din uge" mangler`)
      ok(t(`${b}: Log viser det sprungne saet fra pas 3`)?.ok, `coach ${b}: et sprunget saet (med net) staar ikke i Log`)
      ok(t(`${b}: Log viser noten og RPE 9`)?.ok, `coach ${b}: noten fra kaelderen staar ikke i Log`)
      ok(t(`${b}: Log viser baenkpres 4 i pas 2 som sprunget over`)?.ok === true, `A2 genskabt (${b}): coachen ser ikke kaelderens spring`)
      ok(t(`${b}: PR-tidslinjen har kaelderens`)?.ok === true, `A5 genskabt (${b}): PR-tidslinjen mangler kaelderens rekorder`)
      ok(t(`${b}: forsiden siger aldrig "Ingen logs"`)?.ok === true, `A7 genskabt (${b}): forsiden siger "Ingen logs"/"0 af 4 pas", mens den henter`)
      ok(t(`${b}: Log viser datoer paa dansk`)?.ok === true, `A8 genskabt (${b}): Log viser en UTC-dato`)
      ok(c.bredder[b].kopi?.nyeUger?.length === 1, `A6 genskabt (${b}): "Kopier seneste uge" gav ${c.bredder[b].kopi?.nyeUger?.length} uger`)
      ok(!/\d{4}-\d{2}-\d{2}/.test(c.bredder[b].prTidslinje || '') && /\d{1,2} [a-z]{3} \d{4}/.test(c.bredder[b].prTidslinje || ''), `A8 (${b}): PR-tidslinjens datoer`)
    }
    ok(c.bredder?.['390']?.kopi?.tryk === 'dobbelttryk (250 ms)', 'A6: telefonen skal maales med et dobbelttryk')
    ok(c.personalRecords?.length > 0 && c.personalRecords.length === new Set(c.personalRecords).size, `A5 genskabt: personal_records har dubletter: ${c.personalRecords?.join(', ')}`)
    ok(!c.konsolFejl?.length, `coach: konsolfejl ${c.konsolFejl?.join(' | ')}`)
  }
  ok(png.some(f => f.startsWith('C-390-')) && png.some(f => f.startsWith('C-1280-')), 'blok 2: skaermbilleder mangler')
}

// --- blok 3: rapporten ------------------------------------------------------------
if (blok >= 3) {
  const p = path.join(ROOT, 'docs', 'RAPPORT-456.md')
  if (!existsSync(p)) fejl.push('docs/RAPPORT-456.md mangler')
  else {
    const r = readFileSync(p, 'utf8').replace(/\r/g, '')
    ok(r.split('\n')[0].trim() === 'Ordre 456', 'RAPPORT: foerste linje skal vaere "Ordre 456"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    ok(/Max rows/.test(naeste), 'RAPPORT: "Hvad er naeste" skal sige, hvad Marc ser efter i Supabase (Max rows)')
    const punkter = naeste.split('\n').filter(l => /^\d+\. /.test(l))
    ok(punkter.length >= 1 && punkter.length <= 8, `RAPPORT: pushet og kaeldertesten i hoejst otte punkter (${punkter.length})`)
  }
}

if (fejl.length) { console.error(`verify:456 (blok ${blok}) ROED:\n - ${fejl.join('\n - ')}`); process.exit(1) }
console.log(`verify:456 (blok ${blok}) GROEN`)
