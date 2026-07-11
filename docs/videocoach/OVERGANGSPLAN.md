# OVERGANGSPLAN - lokal -> live (skrevet 8/7-2026 af Fable, Marc AFK)
Formaal: faa hele den lokale kraft ud til coach-mobil og (afgraenset) til
atleterne - i kontrollerede faser, saa intet uafproevet rammer klienterne.

## FASE 1 - DEPLOY AF MASTEREN (klar NU, venter kun paa Marcs "go")
Status: Marc har mobiltestet bar-trackeren paa masteren via dev-server
("ser ud til at virke fint"). Audit 8/7 bekraefter: alle nye coach-
funktioner (kort, eksport, skelet, kurve, sammenlign) er SKJULT for
atleter - atlet-oplevelsen aendres minimalt ved deploy, mens coach-mobil
faar ALT (skelet+kurve i bjaelken, kort/eksport/sammenlign i Mere).
Handling ved go: commit + push (arbejdskopien i public/ er allerede
masteren). Rollback: git revert.
RISIKO: lav. Trackeren er rig-testet + Marc-mobiltestet. UI paa coach-
mobil er IKKE finpudset endnu (fase 2) men funktionel.

## FASE 2 - COACH-MOBIL FINPUDS (efter Marcs foerste rigtige mobilbrug)
Kendte kanter der skal ses paa telefonen foer de jages:
- Mere-bakken er lang (~20 kontroller) - evt. gruppering.
- Sheet (analyse-ark) vs. fartgraf vs. klik-skelet-guide: rakkefoelge og
  overlap ved smaa skaerme.
- Klik-praecision for skelet-punkter paa lille skaerm (evt. zoom-lup?).
- 💾 paa mobil = JSON-download (aerligt maerket). RIGTIGT fix = fase 4.

## FASE 3 - ATLET-AFGRAENSNING (Marcs beslutning, forslag herunder)
Princip (Marcs): atleten skal have det SIMPLE - alt for meget = forvirring.
FORSLAG til atlet-tillaeg (begge delbare/motiverende, nul kompleksitet):
  A) 📈-fartgrafen (read-only indsigt i egne reps)
  B) Resultatkortet (delbart PNG = ogsaa organisk marketing for Entropi)
FORBLIVER coach-only: klik-skelet, sammenlign/overlay, AI/fund-detaljer,
gem, eksport. BESLUT: A/B/begge/ingen.

## FASE 4 - DATA-SLOEJFEN (naar fase 1-3 sidder)
- Supabase-gem fra coach-mobil (erstatter JSON-download). Kraever RLS-
  gennemgang + anon-key-strategi - IKKE autonomt arbejde, skal designes.
- Atletportal/del-link (PAA HOLD, "kravle foer loebe").
- VBT-PROFIL PR. ATLET (staerkt koncept, binder alt sammen): analyse-
  historik -> personlige fartzoner pr. loeft -> RPE/RIR-estimat pr. rep
  + "dagsform" (fart vs. baseline ved samme kg).
  DATA-STATUS 8/7: video_analyses i Supabase er TOM, lokale JSON'er vaek.
  => Profilen KAN ikke bygges endnu. SVINGHJULET: deploy (fase 1) ->
  Marc bruger 💾 i hverdagen -> data akkumuleres -> profil bygges paa
  RIGTIGE tal. Endnu en grund til at fase 1 er vigtigst.

## AI-STRATEGI (beslutningsramme til Marc - roadmap pkt. 6)
Anbefaling fra baade Opus og Fable: kernen ER de deterministiske fund
(offline, gratis, uafhaengig). Lokal Llama kan droppes naar fundene +
Marcs egen stemme daekker. Valgfri Claude-dybanalyse = coach-only, per
kald, kun online. BESLUT: (1) drop Llama? (2) Claude-knap til svaere
cases? (3) hvad betyder "uafhaengighed" konkret for dig?

## KONCEPT-KOE (prioriteret, fra brainstorm + Fables tilfoejelser)
1. VBT-profil pr. atlet (se fase 4) - stoerst coaching-vaerdi.
2. Stroboskop-billede paa resultatkortet (start/sticking/lockout-skelet
   + hele banen paa ET billede - "bevaegelsens aftryk", meget delbart).
3. Rep-fingeraftryk (alle reps' baner justeret til samme start - stramt
   bundt = konsistens). Naturlig plads: resultatkortet.
4. Cue-bibliotek (moenster -> foreslaaet cue). NB: AL atlet-tekst skal
   vaere Marcs egen stemme - byg som forslag KUN til coachen.
5. Symmetri V/H (kraever front-view - nyt kamera-setup, langt ude).

## TRAENINGSMODE - KONCEPT-SPEC (Marcs MAAL: "svinge op og tale ud fra")
Skrevet 8/7 efter Marcs formulering af maalet. MAX 3 TRYK fra video i
haanden til samtale med atleten:
  1. Aabn VideoCoach (hjemmeskaerms-genvej, ?coach=1)
  2. 📂 vaelg video (husker allerede atlet/oevelse fra sidst)
  3. Tap paa skiven (auto-kalibrering + analyse i FULD fart)
  -> AUTO efter analyse: klip+loop om reps, ½-fart, fartpanel synligt.
     Coachen taler. Ingen menuer, ingen ark der popper op i vejen.
IMPLEMENTERINGS-NOTER (naeste session):
- Efter loadFile i coach-tilstande: banner "Tryk paa skiven = analyse"
  og arm ⚡-wizard automatisk (skip knap-jagt). Skal kunne afvises ved
  bare at spole/tegne i stedet (wizard annulleres ved andet vaerktoej).
- Efter analyse i traeningsmode: saet trim = rep 1 start-0.5s til sidste
  rep +0.5s, loop TIL, fart 0.5, og vis IKKE analyse-arket automatisk
  (det daekker videoen - coachen vil TALE, ikke laese).
- Evt. URL-flag ?hurtig=1 til genvejen saa adfaerden er opt-in.
STATUS 8/7: forudsaetninger SHIPPET i vaerkstedet: analyse-fart 0.5 ->
0.75 mobil / 1.0 desktop (halveret ventetid), idle-throttle paa render-
loopet (koeligere telefon = mindre thermal-lag midt i sessionen).
Marcs lag-observation efter upload: formentlig iOS decode-warmup +
termik; throttlen adresserer den anden del. Observeres i felten.
