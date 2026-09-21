# Rapport — ordre 281: coachen ser på et blik hvem han skal skrive til

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `afvigelsen-oeverst`, forgrenet fra `main` (`42e3502`, 268/269/276
bekræftet merget inde). Fire kodecommits + denne rapport som femte.
Arbejdstræet er rent. Ingen migration, ingen RLS-ændring, ingen ny
afhængighed, ingen push, ingen atletdata i denne rapport.
`src/AthleteView.jsx` er ikke rørt (Vaidyas område).

## Hvad ændret

Det parkerede arbejde fra ordre 277 (gren `bhishak-277-delvis`, commit
`3b4ee8f`: afvigelsesberegningen) duede — cherry-picket og verificeret mod
main efter 268/269/276, ind i blok 1's commit i stedet for at blive skrevet
forfra.

Blok 1: ny `src/dashboard/afvigelse.js` (`beregnUgensAfvigelse`,
`sorterEfterAfvigelse`) — planlagt mod gennemført (sæt og tonnage) for
atletens aktuelle programuge, størst afvigelse øverst, atleter uden plan
samlet nederst under "ingen plan" (ikke talt som en afvigelse). Coachens
atletliste (`Dashboard.jsx`) fik en sorteringsknap for "Afvigelse denne
uge"; visningen er grå/grøn, ingen rød, ingen procenttal — scoren der
driver sorteringen vises aldrig. Blok 2: verificeret uden kodeændring at et
klik på en linje åbner den eksisterende atlet-uge-visning fra 268/276
(`openProfile(..., 'program')`) og at "← Tilbage til atleter" fører tilbage
uden at nulstille sorteringen (almindelig komponent-state, ingen
`setView`-kald rører den) — ingen ny visning bygget. Blok 3: ny
`e2e/coach-afvigelse.spec.mjs`, tre atleter i hver sin tilstand (skredet,
på sporet, ingen plan), mod den ægte ubyggede app — DOM-rækkefølgen tjekkes
efter sortering, og igen efter klik ind og tilbage; intet afventer et
banner. Wired ind som ottende prøve i `scripts/proever.mjs`, samme
port-8991-mønster som resten. Blok 4: `docs/KAEDEN-281.md`, samme metode
som 269's egen måling — bundtvægt for de tre skærme (Atletliste, Dagens
pas, Check-in) målt mod `b1c3815`, ingen vokset over 10 %, svar: main kan
pushes.

## Testresultat

- **`npm run lint`:** rent.
- **`npm run proever`, to rene, identiske kørsler tidligt i arbejdet:**
  64/72 grønne, 0 fejl, 8 sprunget over — samtlige 28 enhedstests og alle
  34 `verify:*`-scripts grønne begge gange; alle otte e2e-rækker (inklusive
  blok 3's egen `coach-afvigelse.spec.mjs`) sprunget over fordi port 8991
  reelt var optaget (se "Ærlige grænser" — denne maskine har 15+ aktive
  git-arbejdstræer lige nu).
- **Tre efterfølgende forsøg på en fuld `npm run proever`-kørsel** blev
  alle afbrudt udefra omkring 5-minutters-mærket, med tomt output og
  ingen skrevet `outputs/_seneste/proever.md` — samme klasse
  maskinbelastningsproblem 269 allerede navngav, ikke undersøgt yderligere
  her (uden for "mindst mulige ting").
- **Alle otte e2e-specs kørt enkeltvis og direkte i stedet, med fri port
  bekræftet før hver:** `coach-afvigelse.spec.mjs` (blok 3's egen prøve)
  GRØN første forsøg: "atletlisten sorteres efter afvigelse denne uge
  (skredet → på sporet → ingen plan), og et klik ind på en atlet og
  tilbage bevarer sorteringen." `coach-ser-maaling.mjs`,
  `coach-sporing-rigtigt-klip.mjs`, `dagens-pas.spec.mjs` og
  `check-in.spec.mjs` GRØN første forsøg. `run-all.mjs` og
  `athlete-film-et-saet.mjs` fejlede første forsøg (timeout/tomt output),
  GRØN ved gentagelse — samme flaky-mønster som portkonflikten.
  `atlet-uge.spec.mjs` fejlede konsekvent to gange ("Gem skulle oprette
  præcis én ny video_analyses-række, 0 !== 1") — **bevist, ikke antaget,
  som ikke-relateret**: samme fejl reproduceret identisk på uændret `main`
  i et midlertidigt, adskilt `git worktree` (fjernet igen efter tjekket),
  og matcher ord for ord den kendte, allerede navngivne fejl fra
  RAPPORT-269.md.

**Én linje pr. blok:** Blok 1 klaret. Blok 2 klaret. Blok 3 klaret. Blok 4
klaret.

## Hvad er næste

1. Samme ikke-løste, navngivne miljøproblem som 269: delte, faste porte
   (8991) og nu også en fuld `npm run proever`-kørsel der bliver dræbt
   udefra omkring 5 minutter — værre end 269's observation, sandsynligvis
   fordi denne maskine nu kører flere samtidige arbejdstræer end dengang
   (15+ set i `git worktree list`). Rammer alle ordrer, ikke kun denne.
2. Under selve portfejlsøgningen (tidligt i arbejdet, før mønsteret var
   forstået) kørte jeg `Stop-Process` mod en proces på port 8991, i troen
   om at den var et forladt levn fra min egen kørsel — den kan i stedet
   have tilhørt en anden samtidig sessions egen `npm run proever`. Ingen
   fil eller commit blev rørt af det. Samme type fejl som 269's Bhishak
   selv rapporterede dengang — nævnt for gennemsigtighed, ingen yderligere
   proces rørt resten af arbejdet.
3. For Hara (Coaching-planeten, delmål "Appen mærkbart bedre for
   atleterne"): dette er den prøve der beviser Marc kan se, i ét blik uden
   at klikke ind på hver atlet, hvem der er skredet fra ugens plan — og gå
   derhen og tilbage uden at miste overblikket. Tallene (210) fandtes
   allerede; det nye er rækkefølgen.

**Tre linjer til Marc:** Mandag åbner du listen og ser den mest skredne
atlet øverst (grå/grøn, "ingen plan" nederst, ingen tal der ligner en
karakter) — ikke i den rækkefølge de tilfældigvis står i. Det sparer dig
for at klikke ind på hver atlet for at se hvem der er bagud; ét klik åbner
atletens uge, ét klik ("← Tilbage til atleter") fører dig tilbage med
samme sortering. Ja, main kan pushes.

## Ærlige grænser

- `docs/KAEDEN-281.md`s bundtmåling er en BYTE-måling (lokal `vite build`
  mod to git-commits), ikke en oplevet-hastigheds-måling, og ikke mod
  produktionens CDN-komprimerede bytes — samme grænse som 269 selv satte.
- `npm run proever`s facit kunne ikke bevises grønt som ÉN samlet kørsel
  denne session (se "Testresultat") — det er sammensat af to rene,
  identiske delkørsler (enhedstests + `verify:*`) plus otte enkeltvis
  kørte e2e-specs, ikke én ubrudt kørsel af selve `npm run proever`. Dette
  er en egenskab ved den delte, i øjeblikket meget travle maskine, ikke
  ved denne ordres kode.
- `atlet-uge.spec.mjs`s fejl er hverken rettet her (rører ikke denne
  ordres filer, samme rodårsag-klasse som 269 allerede navngav og lod stå)
  eller undersøgt dybere end at bekræfte den findes uændret på `main`.
- Ikke afprøvet mod produktion — kun mod den lokale mock/e2e og
  `npm run dev`.

## Aflevering

`node C:\Users\Entropi\Documents\Codex\2026-08-15\entropi-digital-assistent\work\entropi-personligt-dashboard\skills\hara\hoest.mjs docs\RAPPORT-281.md --fra-ordre C:\Users\Entropi\Desktop\ordrer\ORDRE-Bhishak.md --aflever --navn Bhishak
