// ORDRE 464: verify:kritik-464. Intet netvaerk og ingen browser; kun mine gemte
// maalinger i outputs/kritik-464 (koert mod main e5089f7) og dokumenterne.
//   node outputs/kritik-464/verify-kritik-464.mjs 1   blok 1: A1-A9 og det Vaidya aendrede ud over ordren
//   node outputs/kritik-464/verify-kritik-464.mjs 2   blok 1 + blok 2: kaeldertesten, KRITIK-app-push-2, RAPPORT-464
// Kontrollen er, at maalingerne findes, er hele og siger det, dokumenterne paastaar.
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HERE, '..', '..', 'docs', 'kritik-464')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-464/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const tjekAf = (r, navn) => r?.tjek?.find(t => t.navn.startsWith(navn))
const png = readdirSync(HERE).filter(f => f.endsWith('.png'))

// --- blok 1 ------------------------------------------------------------------------
// A1-A3, A5 (atleten): begge kaelderuger (uge-446 og uge-446-b2 fra coach-koerslen).
for (const f of ['uge-446.json', 'uge-446-b2.json']) {
  const u = json(f)
  if (!u) continue
  ok(!u.fejl, `${f} stoppede: ${String(u.fejl).slice(0, 200)}`)
  for (const n of ['intet saet tabt', 'ingen dubletter', 'hvert saet har tiden fra Godkendt', 'hver rekord fejres een gang', 'Fremgang viser hver rekord een gang', 'RPE 9 og note', 'ingen konsolfejl', 'ingen vandret rul']) ok(tjekAf(u, n)?.ok, `${f}: "${n}" holder ikke`)
  ok(tjekAf(u, 'genaabnet uden net: vaegtfeltet er udfyldt')?.ok && tjekAf(u, 'ingen vaegtoevelse gemt med 0 kg')?.ok, `A1 aaben (${f})`)
  ok(tjekAf(u, 'Spring over virker uden net')?.ok && !u.springOverErstattet, `A2 aaben (${f})`)
  ok(tjekAf(u, 'vurderingerne givet uden net')?.ok, `A3 aaben (${f})`)
  const prs = (u.personalRecords || []).map(p => `${p.oevelse} ${p.weight}x${p.reps}`)
  ok(tjekAf(u, 'en rekord sat uden net staar ogsaa i personal_records')?.ok && prs.length === new Set(prs).size && prs.length === (u.fejringPrSaet || []).length, `A5 aaben (${f}): ${prs.join(', ')}`)
}
// A4: graensen (top uden for de nyeste raekker, med og uden loft 1000).
const gr = json('graense-446.json')
if (gr) {
  ok(gr.koersler?.length === 3 && gr.koersler[2]?.loft === 1000, 'graense: tre koersler, den sidste med loft 1000')
  for (const x of gr.koersler || []) ok(!x.fejring && x.bedstFoerSquatE1rm === 128 && x.historikRaekker > 4000, `A4 aaben: top for ${x.topForUger} uger, loft ${x.loft}: ${JSON.stringify(x)}`)
}
// A2 (coachen), A5-A8: coach-koerslen paa 390 og 1280.
const c = json('coach-446.json')
if (c) {
  ok(!c.fejl, `coach stoppede: ${String(c.fejl).slice(0, 200)}`)
  const t = (n) => tjekAf(c, n)?.ok === true
  for (const b of ['390', '1280']) {
    ok(t(`${b}: Log viser baenkpres 4 i pas 2 som sprunget over`), `A2 aaben hos coachen (${b})`)
    ok(t(`${b}: PR-tidslinjen har kaelderens`), `A5 aaben: PR-tidslinjen (${b})`)
    ok(c.bredder?.[b]?.kopi?.nyeUger?.length === 1, `A6 aaben (${b}): ${c.bredder?.[b]?.kopi?.nyeUger?.length} uger`)
    ok(t(`${b}: forsiden siger aldrig "Ingen logs"`), `A7 aaben (${b})`)
    ok(t(`${b}: Log viser datoer paa dansk`) && !/\d{4}-\d{2}-\d{2}/.test(c.bredder?.[b]?.prTidslinje || ''), `A8 aaben (${b})`)
    for (const n of ['forsiden siger 4 af 4 pas', '"Kraever dit blik" viser atletens linje', 'Log viser det sprungne saet fra pas 3', 'Log viser noten og RPE 9']) ok(t(`${b}: ${n}`), `coach ${b}: "${n}" holder ikke`)
  }
  ok(c.bredder?.['390']?.kopi?.tryk === 'dobbelttryk (250 ms)', 'A6: telefonen skal maales med et dobbelttryk')
}
// A9: tid (Slow 4G + 4x CPU, median af 3 genaabninger).
const tid = json('tid-446.json')
if (tid) {
  const m = Object.fromEntries(tid.maalinger.map(x => [`${x.historik}-${x.version}`, x]))
  ok(['let-foer', 'let-efter', 'tung-foer', 'tung-efter'].every(k => m[k]?.runder?.length === 3) && tid.drosling?.cpu === 4, 'tid: fire kombinationer a 3 aabninger, 4x CPU')
  if (m['tung-efter'] && m['tung-foer']) {
    ok(m['tung-efter'].medianBrugbartMs - m['tung-foer'].medianBrugbartMs < 1000, `A9 aaben: tung ${m['tung-efter'].medianBrugbartMs} mod ${m['tung-foer'].medianBrugbartMs} ms`)
    ok(m['tung-efter'].runder.every(r => r.historikFaerdigMs > r.brugbartMs && r.historikBytes < 100000), 'A9: historikken hentes foer Dagens pas eller er stor')
  }
}
// Ud over ordren: indeks v2, sider med loft 1000/100, kopi ved 60/120 ms.
const e = json('ekstra-464.json')
if (e) {
  ok(!e.fejl, `ekstra stoppede: ${String(e.fejl).slice(0, 200)}`)
  ok(e.indeks?.map(r => r.loft).join() === 'ingen,1000,100', 'ekstra: tre indeks-koersler (ingen, 1000, 100)')
  for (const r of e.indeks || []) {
    const n = `indeks (loft ${r.loft})`
    ok(r.indeksVedKlik?.v === 2 && !r.indeksVedKlik.bygget, `${n}: 450-indekset (v1) blev ikke kasseret ved foerste aabning`)
    ok(!r.fejretUnderOpbygning?.length, `${n}: fejret under opbygningen: ${r.fejretUnderOpbygning}`)
    ok(r.indeksEfter?.v === 2 && r.indeksEfter.squat === 128, `${n}: indekset efter opbygning ${JSON.stringify(r.indeksEfter)}`)
    ok(r.fejretRigtigRekord?.some(t => /Ny rekord: Squat e1RM 134/.test(t)), `${n}: et rigtigt rekordsaet (115 x 5) blev ikke fejret`)
    ok(r.genaabnetIndeks?.v === 2 && r.genaabnetSider <= 3, `${n}: genaabnet henter ${r.genaabnetSider} sider (skal kun hente det nye)`)
    ok(r.logs?.filter(x => x === '100x5').length === 1, `${n}: saet 1 (100 x 5) gemt ${r.logs?.filter(x => x === '100x5').length} gange`)
  }
  const [ingen, l1000, l100] = e.indeks || []
  ok(l1000?.sider >= 5 && l1000.raekker > 4000, 'loft 1000: ikke side for side')
  ok(l100?.sider >= 30 && l100.raekker > 2900, 'loft 100: ikke side for side')
  ok(ingen && l100 && l100.logIndTilBrugbartMs < ingen.logIndTilBrugbartMs + 1000, 'loft 100 goer Dagens pas mere end 1 s langsommere')
  for (const k of e.kopi || []) ok(k.nyeUger?.length === 1 && k.knapVedAndetTryk?.disabled, `A6: dobbelttryk ${k.msMellem} ms gav ${k.nyeUger?.length} uger`)
  ok(e.kopi?.length === 2, 'ekstra: to dobbelttryk (60, 120 ms)')
}
const loft = existsSync(path.join(HERE, 'koersel-loft100-130uger.txt')) ? readFileSync(path.join(HERE, 'koersel-loft100-130uger.txt'), 'utf8') : ''
ok(/Uge 100 er klaret/.test(loft) && /200 100 weeks\?/.test(loft), 'loft 100 med 130 uger: diagnosen (weeks klippes, "Uge 100 er klaret") mangler')
ok(png.some(f => f.startsWith('U-')) && png.some(f => f.startsWith('G-')) && png.some(f => f.startsWith('C-390-')) && png.some(f => f.startsWith('E-indeks-')), 'blok 1: skaermbilleder mangler')
const status = tekst('STATUS-A1-A9.md')
if (status) {
  for (let i = 1; i <= 9; i++) ok(new RegExp(`\\| A${i} [^\\n]*\\| lukket`).test(status), `STATUS: A${i} staar ikke som lukket`)
  ok(/Max rows/.test(status) && /Uge 100 er klaret/.test(status), 'STATUS: fundet om loft 100 og weeks mangler')
}

// --- blok 2 ------------------------------------------------------------------------
if (blok >= 2) {
  const k = json('kaelder-464.json')
  if (k) {
    ok(!k.fejl, `kaelder stoppede: ${String(k.fejl).slice(0, 200)}`)
    for (const v of ['straks', 'vent']) {
      const r = k.varianter?.[v]
      ok(r, `kaelder: varianten "${v}" mangler`)
      if (!r) continue
      ok(r.foerPush?.bundt === k.prodBundt && r.foerPush?.styret, `kaelder ${v}: telefonen koerte ikke prod-versionen med service worker foer pushet`)
      ok(r.tjek?.length >= 14, `kaelder ${v}: kun ${r.tjek?.length} tjek`)
      r.aabneFund = (r.tjek || []).filter(t => !t.ok).map(t => `${t.pkt}: ${t.navn}`)
    }
    const krit = tekst('KRITIK-app-push-2.md')
    if (krit) {
      const linje = krit.split('\n').find(l => /^klar til push: (ja|nej), fordi /.test(l))
      ok(linje, 'KRITIK: linjen "klar til push: ja/nej, fordi" mangler')
      ok(krit.indexOf('## Fund') > -1 && krit.indexOf('## Fund') < krit.indexOf('## Det, der holder'), 'KRITIK: fund skal staa oeverst')
      // Hvert aabent kaelder-tjek skal staa i KRITIK'en.
      for (const v of ['straks', 'vent']) for (const f of k.varianter?.[v]?.aabneFund || []) ok(krit.includes(f.split(': ').slice(1).join(': ').slice(0, 40)), `KRITIK naevner ikke det aabne kaelder-tjek (${v}) "${f}"`)
      const jaNej = /^klar til push: ja/m.test(krit)
      const alleGroenne = ['straks', 'vent'].every(v => !(k.varianter?.[v]?.aabneFund || []).length)
      if (jaNej) ok(k.varianter?.vent && !(k.varianter.vent.aabneFund || []).length, 'KRITIK siger ja, men kaeldertesten (vent) har aabne tjek')
      if (!jaNej) ok(!alleGroenne || /fordi/.test(linje || ''), 'KRITIK siger nej uden grund')
    }
    ok(png.some(f => f.startsWith('K-straks-')) && png.some(f => f.startsWith('K-vent-')), 'blok 2: skaermbilleder mangler')
  }
  const rev = existsSync(path.join(HERE, 'kaelder-464-revert.txt')) ? readFileSync(path.join(HERE, 'kaelder-464-revert.txt'), 'utf8') : ''
  ok(/patch failed: package\.json/.test(rev) && /revert -m 1 e5089f7[\s\S]*OK: gaar rent/.test(rev), 'punkt 8: revert-tjekket mangler')
  const rap = tekst('RAPPORT-464.md')
  if (rap) {
    ok(rap.split('\n')[0].trim() === 'Ordre 464', 'RAPPORT: foerste linje skal vaere "Ordre 464"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(rap), `RAPPORT: afsnit "${h}" mangler`)
    ok(/Hara/.test(rap), 'RAPPORT: linjen til Hara mangler')
  }
}

if (fejl.length) { console.error(`verify:kritik-464 (blok ${blok}) ROED:\n - ${fejl.join('\n - ')}`); process.exit(1) }
console.log(`verify:kritik-464 (blok ${blok}) GROEN`)
