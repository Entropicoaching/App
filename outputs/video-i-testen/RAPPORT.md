# ORDRE 73 — en rigtig video i testen

Spor (Harā): `spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a` ("Appen mærkbart
bedre for atleterne"), under `goal-coaching-vaerdigt-produkt`, planet Entropi
Coaching.

## Gren

`video-i-testen`, fra `main` `38822a5` (ordre 70 merget).

Commits:
- `b77d53a` — commit 1: et syntetisk, men rigtigt, testklip til trackeren
- `1b33eee` — commit 2: trackeren mod det rigtige klip, i en rigtig browser
- `227a91b` — commit 3: upload-og-gå ende til ende, uden produktion
- (denne rapport, separat commit)

Rent træ. De utrackede `drafts-*`-mapper og
`docs/videocoach/ENT0092-AUDIT-EE6D8A8.md` er urørt.

## Hvad ændret

**Commit 1 — `scripts/make-test-clip.mjs`.** Genererer en 20 sekunders,
720×1280 (portræt — videocoach-klip filmes i praksis lodret, samme sigt som
de eksisterende testriggees 480×640-scene), 30fps H.264-video af en tegnet
"skive" der bevæger sig som fem gentagelser med pause mellem hver, på en
støjet baggrund med let, deterministisk kameravaklen (sum af sinusser, ingen
Math.random — et rerun giver bit-for-bit samme klip og samme facit).
Skivens tekstur (kant-ring, midterring, centerprik, to roterende
"feature"-prikker) er 1:1 samme design som `tracker-live-bench.mjs`'s
syntetiske scene, skaleret op — allerede bevist at give `mpGoodFeatures` nok
kontrast til at initiere sporing.

Valgt: `ffmpeg-static` som ny dev-afhængighed (eksplicit sanktioneret af
ordren), rene RGB24-frames pisket til ffmpeg over stdin i stedet for
`canvas` (undgår en native afhængighed på Windows). Baggrundsstøjen er
rumlig og beregnes kun én gang for hele billedet; kun feltet omkring skiven
gentegnes pr. frame — 600 frames rendres og kodes (CRF 21) på under 5
sekunder. Klippet og dets facit-JSON (skivens kendte, tegnede position pr.
frame, inkl. vaklen, samt rep-vinduer) genereres til
`docs/videocoach/clip-cache/` (git-ignoreret, `npm run test:clip`).

**Commit 2 — `scripts/verify-videocoach-clip.mjs`.** Kører den FAKTISKE,
levende `startMultipointTracking`-kode udtrukket 1:1 fra
`public/videocoach.html` (samme udtræksteknik som `tracker-live-bench.mjs`)
mod commit 1's rigtige klip, i headless Chromium: et ægte `<video>`-element,
ægte `canvas.drawImage`/`getImageData`, ægte seek (venter på `'seeked'`) —
ikke en analytisk pixel-funktion. To ting måles: (A) fuld analyse af alle
fem reps mod facit, (B) "Vis mig nu" på tre hårdkodede vinduer (rep 1, 3, 5
— fra klippets egen facit-JSON, samme princip som `rep-preview-rig.mjs`).
Separat script, ikke lagt ind i `gate:tracker` (ordrens egen tilladelse —
se Testresultat).

**Commit 3 — `scripts/verify-videocoach-upload-flow.mjs`.** Kører atletens
og coachens standardvej for "upload og gå" (ordre 57) mod det samme klip.
`public/videocoach.html` køres UÆNDRET (ikke udtrukket som commit 2) i
headless Chromium; `src/videoCoachUpload.js` og `src/videoCoachSubmission.js`
importeres og kaldes direkte (ikke gen-implementeret). Kun de to
bro-værter (AthleteView.jsx's og Dashboard.jsx's postMessage-handlere) er
stand-ins, med præcis samme beskedprotokol — Supabase-klientens
netværks-/database-kald (storage-upload, insert/update af `video_analyses`)
er stubbet lokalt i en Node-side "tabel", ingen produktion rørt.

To fund fra selve udviklingen af test-broen (rettet i BROEN, ikke i
produktkoden):
- `videocoach.html` annoncerer `:ready` bevidst to gange (dobbelt
  sikkerhed mod tabte beskeder). En bro der svarer på begge udløser en
  dobbelt video-indlæsning midt i den første (`ERR_ABORTED`).
- Samme dobbelte svar udløser desuden `syncCoachSetupBridge` →
  `syncSetup`, som nulstiller `#liftSel` til coachens (tomme)
  opsætningskort-værdi, fordi denne test sætter løftet direkte via
  `:load-remote-video` i stedet for at gå gennem opsætningsskærmen
  først. Begge løst ved kun at sende `:config`/`:load-remote-video` én
  gang fra broen — se "Hvad er næste" for hvorfor dette muligvis peger på
  noget værd at kigge på i selve produktet, ikke kun i testen.

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler
  som på uændret main).
- `node --test src/*.test.js` — 48/48 grønne.
- `npm run gate:tracker` — grøn, uændret (~20-35s, samme rigge som før).
- `npm run verify:videocoach-clip` (ny) — grøn:
  - Fuld analyse (5 reps, ægte afkodning): 541 frames, ok=true,
    afvigelse fra facit mean 9.75px / max 20.09px, ~70-85s.
  - "Vis mig nu" (rep 1/3/5): 77 frames pr. vindue, ok=true, afvigelse
    mean op til 13.55px / max op til 31.04px, ~24-31s samlet.
  - Forhold (fuld/tre-vinduer, ÆGTE afkodning): 2.7-2.9× — det FØRSTE
    målte (ikke ekstrapolerede) tal for denne gevinst på rigtig video.
  - Tolerance: mean ≤15px / max ≤35px, begrundet i kameravaklens egen
    amplitude (~4.4px) plus reel H.264-kvantiseringsstøj — se scriptets
    kildekode for den fulde begrundelse.
- `npm run verify:videocoach-upload-flow` (ny) — grøn:
  - Atleten: "Video modtaget ✓" vist, præcis én ventende række oprettet
    (`analysis_state='awaiting_analysis'`, `status='draft'`), præcis én
    fil "uploadet" (stub).
  - Coachen: ægte sporing af hele klippet via browserens rigtige
    `requestVideoFrameCallback`-vej (IKKE commit 2's manuelle seek-loop)
    — 73.7s for at spore fra t=0.1s til klippets slutning (t=20s),
    dvs. ca. 3,7× langsommere end klippets egen varighed under headless
    CPU-belastning. Samme række opdateret til `analysis_state='complete'`,
    samme `client_analysis_id`, `athlete_id` og `source_mode` bevaret.
  - Kørselstid for hele scriptet: ca. 90-100 sekunder. Ikke lagt ind i
    `gate:tracker` af samme grund som commit 2.

Alle tre nye scripts er selvstændige (`npm run test:clip`,
`verify:videocoach-clip`, `verify:videocoach-upload-flow`) — ingen af dem
er lagt ind i `gate:tracker`, som ordren selv tillader ("er klippet for
tungt til hver kørsel, så gør klip-testen til et eget script og lad
gate'n køre det korte"). Et samlet `npm test`-lignende "kør det hele"
findes ikke i repoet i forvejen, så jeg har ikke tilføjet ét.

## Hvad er næste

**Værd at undersøge i selve produktet (ikke rettet her — uden for
ordrens grænser):** de to bro-fund fra commit 3 blev løst i TEST-broen,
men mekanismen der udløste dem — `videocoach.html`'s dobbelte
`:ready`-annoncering ramt af `Dashboard.jsx`'s ubetingede
`:load-remote-video`-afsendelse i sin egen `:ready`-handler (bekræftet
ved læsning af kildekoden, ikke kun antaget) — findes også i den ægte
kobling. Om det rammer en rigtig coach afhænger af, om coachen når at
klikke på skiven inden for de 800ms mellem de to annonceringer, og om
`#liftSel` allerede var sat via opsætningskortet FØR videoen blev åbnet.
Jeg har ikke set det ske i den ægte app — kun i denne tests forenklede
bro, som bevidst springer opsætningsskærmen over. Værd for Marc at
holde øje med, hvis en coach nogensinde oplever at løftet uventet er tomt
lige efter en afventende video er åbnet.

**Tekniske opfølgninger:**
- CRF 21 og tolerancerne (15/35px) er mine egne, begrundede valg — ingen
  af dem er hentet fra en eksisterende konvention i repoet. Værd at
  genbesøge, hvis en fremtidig ordre ændrer trackerens algoritme og
  disse grænser skal stramme sig.
- Klippet dækker kun squat/en lodret bevægelse. Bænk og dødløft har andre
  bevægelsesmønstre (mere vandret drift for bænk, en anden opstartspose
  for dødløft) — `make-test-clip.mjs`s parametre (TOP_Y/BOTTOM_Y, world-
  bevægelsen) er isolerede nok til at en fremtidig ordre kan tilføje flere
  scener uden at ændre selve genereringsmotoren.
- Ingen af de tre scripts er kørt gentagne gange for at måle varians i
  timing-tallene (kun determinismen i selve banen er verificeret — se
  Ærlige grænser). Et enkelt tal er rapporteret, ikke en fordeling.

## Ærlige grænser

- **Stadig ikke en rigtig telefonoptagelse.** Klippet er tegnet, ikke
  filmet — ingen linsestøj, ingen rullende lukker, ingen ægte
  belysningsændring, ingen menneskekrop der delvist dækker skiven. Det
  lukker hullet "ingen video-afkodning/seek/kompression er nogensinde
  testet", men lukker IKKE hullet "virker det på Marcs egen telefon".
- **Headless Chromium er ikke identisk med en telefonbrowser.** Ingen GPU-
  accelereret afkodning i dette miljø (bekræftet undervejs: et
  `video.play()`/`.pause()`-par alene malede intet frame i canvas'et —
  kun et eksplicit `seek` gav et ægte, læsbart billede, se commit 2 og 3's
  kildekodekommentarer). Coachens sporing tog 73.7s for at spore 19.9s
  video — 3,7× langsommere end selve klippet, i et miljø der efter alt at
  dømme er LANGSOMMERE end en almindelig bærbar/desktop, men ikke
  nødvendigvis repræsentativt for hverken en hurtig eller langsom telefon.
  Hastighedstallene her er stadig ikke et telefon-sekund-estimat.
- **Kun én "atlet" og ét sæt.** Ingen okklusion, ingen identitetsskifte
  midt i sættet, ingen touch-and-go uden pause — de svære scenarier
  tracker-live-bench.mjs allerede dækker analytisk er ikke gentaget her
  med rigtig video. At kombinere de to (rigtig afkodning OG de svære
  synteiske mønstre) er en naturlig næste ordre, ikke gjort her.
- **Commit 3's bro er en forenkling, ikke en 1:1 kopi af React-koden.**
  De eksporterede, rene funktioner (`validateVideoUploadRequest` osv.)
  køres for ægte — men selve `onAthleteVideoCoachMessage`/
  `onVideoCoachMessage`-lytterne i AthleteView.jsx/Dashboard.jsx er
  gen-skrevet som stand-ins, fordi de kræver en fuldt monteret
  React-komponent og en autentificeret Supabase-session (samme
  strukturelle grænse som ordre 41/70/73 alle har dokumenteret). Jeg har
  ikke kørt den fulde, ægte React-app mod klippet.
- **Ingen ægte Supabase-fejlstier afprøvet.** Stub-klienten simulerer kun
  den lykkelige vej (upload lykkes, insert lykkes, update lykkes) plus
  409-dubletten. En rigtig netværksfejl, RLS-afvisning eller
  race-condition mellem to samtidige gem er ikke afprøvet her.
