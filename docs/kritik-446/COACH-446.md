# Kritik 446, blok 2: coachen efter atletens offline-uge

Målt mod main `dd68c77`, headless, mod e2e-mocken. Først kører atletens uge fra blok 1 én gang til, med samme
scenarie og samme ældre telefon. Den eneste forskel er, at Planke sæt 2 i pas 3 springes over med net, så coachen
har et rigtigt sprunget sæt at se.

Derefter logger den syntetiske coach ind på samme mock. Det sker to gange: på en telefon (390 px, drosslet som i
blok 1) og på en computer (1280 px, udrosslet).

Signalerne til "Kræver dit blik" er regnet med appens JS-spejl (`detectSignalsV2`) på mockens tabeller, som i
428/433. Script og tal: `outputs/kritik-446/coach-446.mjs`, `coach-446.json`, `uge-446-b2.json`, `C-*.png`.

## Det, coachen ser rigtigt

- **Forsiden:** "Uge 131 · Styrke · 4 af 4 pas · I dag · ★ 4/5 · skulder lidt oem". Noten fra kælderen står som
  ugens stemme. Det gælder både 390 og 1280.
- **"Kræver dit blik":** atletens linje fra "din uge" står som BESKED ("Om uge 131: Kaelderen var uden net …"), og
  videoen står som "Ny måling fra et sæt · Squat". Begge står én gang.
- **Log:** hvert pas står én gang, og sættene står én gang hver (ingen dubletter efter kælderen og den afbrudte
  afsendelse). Noten og RPE 9 fra kælderen er med. Det sprungne sæt med net vises ærligt: "7/8 sæt · 1 sprunget
  over", "Planke 1/2 sæt · 1 sprunget over", "S2 ✕".
- **Tider:** sættene fra kælderen står på samme dag og i samme pas som resten. Tiden er "Godkendt", ikke
  afsendelsen.
- **Video:** én række (`awaiting_analysis`), ét punkt på forsiden.
- **"Kopiér seneste uge" på 1280, ét tryk:** én ny uge 132 (start 28. sep) med 4 pas og 12 øvelser, på ca. 4 s.
- Ingen konsolfejl og ingen vandret rul, hverken på forsiden eller i Log (390 og 1280).

## Det, coachen ser forkert

| Hvad | 390 | 1280 | Kommer fra |
|---|---|---|---|
| **Bænkpres 4 i pas 2 står som lavet.** Atleten ville springe det over i kælderen, men kunne ikke (blok 1). Dagen står som "10/10 sæt". | ja | ja | A2 |
| **0 kg-sæt:** Rows S2–S3 og Triceps S1–S3 står som "0kg × 10/12" med grøn bjælke ("3/3 sæt"). | ja | ja | A1 |
| **Vurderingerne af pas 1 og 2 mangler.** Forsiden viser ★ 4/5 fra pas 4 alene. | ja | ja | A3 |
| **PR-tidslinjen** mangler kælderens bænkpres-rekorder (70 × 8 og 80 × 6) og har dubletter: 72,5 × 6, 95 × 6, 85 × 4 og 140 × 3 står to gange hver. | ja | ja | A5 |
| **Datoen er UTC.** Log siger "2026-09-26", og PR-tidslinjen "26 sep 2026", for sæt logget kl. ca. 01.30 dansk tid den 27. Atleten ser "27. sep" i Fremgang. | ja | ja | A8 |
| **Forsiden på telefonen siger "0 af 4 pas · Ingen logs"** i ca. 5 s (fra 3,8 s til 8,7 s efter login), før den skifter til "4 af 4 pas · I dag". Log-fanen var klar efter 8,4 s. | ja | nej (1 s) | A7 |
| **Dobbelttryk på "Kopiér seneste uge"** (250 ms mellem trykkene, telefonen) giver **to** uger 132 med samme startdato, hver med 4 pas og 12 øvelser. | ja | ikke prøvet | A6 |

Ét tryk på 1280 giver én uge. Dobbelttrykket er kun prøvet på telefonen. Knappen har ingen spærre, mens kopien
kører (`programHandlinger.js` `copyWeek`), og på den droslede telefon tog kopien 7,9 s.
