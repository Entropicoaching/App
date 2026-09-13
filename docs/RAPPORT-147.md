# RAPPORT-147 — kritikerpakke til ekstern gennemgang

## Gren

`kritikerpakke`, base `main` (`4dd8998`, ordre 139 med). Ét commit:

- `edc0b24` — docs(kritikerpakke): `docs/KRITIK-PAKKE.md`.

Rent træ. Ikke pushet, ikke merget. Ingen kodeændring (kort ordre, som bedt om).

## Hvad ændret

`docs/KRITIK-PAKKE.md` (131 linjer, under grænsen på 200): en selvbærende
pakke Marc kan sætte direkte ind hos en ekstern kritiker (ChatGPT), da selve
appen ikke kan vedhæftes (for stor, atletdata bag login). Seks afsnit:

1. **Prompt til kritikeren** (hvad appen er, hvem der bruger den, fem
   spørgsmål: arkitektur-skrøbelighed, hvilke af de sidste to ugers ændringer
   der lugter af lappeløsninger, testdækning, en atlets oplevelse på en
   gammel telefon i en hal, tre ting kritikeren ville gøre først).
2. **Arkitektur** (25 linjer): mapper, nøglefiler med linjetal, dataflow
   (atlet → Supabase/RLS → coach), videocoach-broen (`postMessage` mellem
   `AthleteView.jsx` og `public/videocoach.html`), upload-og-gå.
3. **Ændringsliste ordre 105-139**, én linje pr. ordre (hvad/hvorfor/ærlig
   grænse), bygget af de 14 rapporter der faktisk findes i
   `docs/RAPPORT-*.md` og `docs/videocoach/RAPPORT-*.md` — resten af
   intervallet har ingen fil i det navngivne mønster og er derfor ikke med;
   noteret eksplicit i pakken så kritikeren ikke tror listen er udtømmende.
4. **Kendte huller**: kontrast-palette, Coach Briefing A/B, sort skive med
   lys nav, 1,1x-grænsen, ingen rigtig magic-link-test.
5. **Læserækkefølge**: fem filer i den rækkefølge en kritiker bør åbne dem.
6. **Svarformat**: tabel `fil/ordre | fund | alvor | forslag`.

Ingen atletnavne, ingen nøgler, ingen URL'er med tokens — kun filnavne og
linjetal. Kildemateriale: de 14 eksisterende `RAPPORT-*.md`-filer plus en
direkte gennemgang af `src/App.jsx`, `src/supabase.js`, `src/AthleteView.jsx`
(kun bro-koden, ~linje 1930-2120), mappestrukturen og `wc -l` på nøglefiler.

## Testresultat

- `npm run lint`: **0 fejl, 0 advarsler**.
- Ingen kode ændret → ingen `verify:*`-scripts er relevante for dette
  område; ingen kørt.
- `git status --short`: tomt, rent træ på `kritikerpakke`.

## Hvad er næste

- Marc sætter `docs/KRITIK-PAKKE.md` ind hos kritikeren og bringer svaret
  tilbage, hvis han vil have det fulgt op.
- Ændringslisten dækker kun de 14 ordrer der har en rapportfil i det
  navngivne mønster — mangler Marc dækning af de øvrige ordrenumre i
  105-139, kræver det en ny ordre der navngiver deres kildefiler eksplicit.

## Ærlige grænser

- Jeg har ikke selv vurderet om de 14 rapporters egne "ærlige grænser" er
  fuldstændige eller opdaterede — de er gengivet som skrevet af de ordrer
  der lavede arbejdet.
- Linjetal (fx `AthleteView.jsx` 6.563, `videocoach.html` 10.156) er målt nu,
  ikke på det tidspunkt hver rapport blev skrevet — kan derfor afvige en
  smule fra tal nævnt i selve ordreteksten (fx "9.600 linjer" for
  videocoach.html).
- Ingen atletdata læst eller brugt noget sted i denne ordre.

## Delmål (Hara)

Sporet er "Appen mærkbart bedre for atleterne"
(spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a). Dette arbejde er ikke selv
en forbedring af appen, men gør det muligt for Marc at få en uafhængig,
ekstern kritisk gennemgang af de sidste to ugers arbejde på sporet — relevant
for Hara som forudsætning for næste runde af forbedringer, ikke som en
forbedring i sig selv. Intet Delmål lukkes.
