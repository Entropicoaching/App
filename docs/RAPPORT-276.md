# Rapport — ordre 276: atletens uge skal holde på en telefon (fire blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `atletens-uge-holder`, forgrenet fra egen gren `atletens-uge` (ordre 268
er ikke merget til `main` endnu ved denne ordres start — `git log --oneline
-1 main` viste stadig `03ca364`, ordre 267 — så basen er `atletens-uge`,
som ordren selv beder om i det tilfælde). Fire commits (denne rapport er
den fjerde; blok 3 fik ingen commit, se nedenfor). Arbejdstræet er rent.
Ingen migration, ingen ny tabel, ingen ny afhængighed, ingen push, ingen
atletdata i denne rapport. `e2e/` og `scripts/proever.mjs` er ikke rørt.

**Pr. blok:**
1. Blok 1 (de tilstande der ikke er den pæne) — **klaret**.
2. Blok 2 (sidste uge ved siden af denne) — **klaret**.
3. Blok 3 (det 269 fandt) — **sprunget over** (ingen `docs/RAPPORT-269.md`
   findes endnu, se nedenfor).
4. Commit 4 (prøve og rapport) — **klaret**.

## Hvad ændret

Blok 1: `UgensStatusKort.jsx`s dagsrække (`DagRaekke`) stabler nu sæt- og
tonnagetal LODRET i stedet for side om side, så et femcifret tonnage-tal
("12345kg / 12345kg") altid har plads ved 360px uden at klemmes sammen med
sæt-tallet — `wordBreak: 'break-word'` som sidste sikkerhedsnet. En uge
uden nogen planlagt træning overhovedet viser nu "Ingen træning planlagt
denne uge endnu." i stedet for at forsvinde helt (den tidligere adfærd
skjulte hele kortet, hvilket på en tom skærm kan læses som en fejl snarere
end "her er der ikke noget endnu"). En uge med planlagt træning, men intet
logget endnu (typisk mandag morgen), får en kort linje ("Ingen sæt logget i
ugen endnu — kom i gang i Dagens pas") i stedet for en tavs væg af "0/X
sæt". Ingen ny beregning (`ugeStatus.js` urørt). "Lange forløbs-/
øvelsesnavne" er ikke en risiko for denne fil — den har ikke vist
sessionstitler siden ordre 268 commit 3 (fjernet dengang pga. en
e2e-lokator-kollision) og viser ingen øvelsesnavne noget sted.

Blok 2: en tredje knap, "Sidste uge", føjet til `UgensStatusKort.jsx`s
toggle. Samme dagsliste som "Denne uge", men hver dag med en planlagt
session viser nu også sidste programuges tal for samme ugedag, dæmpet og
ufarvet under denne uges egen linje — "Sidste uge: 2/4 sæt · 1000kg /
2000kg" — uden farve, ros eller pil, som ordren selv kræver. "Sidste uge" =
programugen med `week_number - 1` (fundet i `allWeeks`, `AthleteView.jsx`);
findes den ikke (fx uge 1), siger visningen "Ingen tidligere uge endnu."
Ingen ny beregning: samme `beregnUgeDage` (ordre 268 commit 1) kørt på
forrige uge i stedet for den aktive. Genbruger "Hele forløbet"s allerede
lazy-hentede `forloebLogs` (`fetchForloebLogs`) — select udvidet med
`exercise_id` (som `beregnUgeDage` matcher på, til forskel fra
`beregnForloebUger`), ingen ny hentning tilføjet.

Blok 3: sprunget over. `docs/RAPPORT-269.md` findes ikke — hverken på
`main`, på nogen anden gren, eller i `entropi-app-wt2` (Bhishaks
arbejdstræ). Det eneste ordre 269-relaterede jeg fandt i `entropi-app-wt2`
er `docs/KAEDEN-269.md` (en bundtstørrelses-måling, commit 3) og to
commits på grenen `atletflader-bevist` (commit 1 + commit 3, ingen commit
2, intet afsluttende rapport-dokument) — ordre 269 er tydeligvis ikke
færdig endnu, og navngiver derfor ingen fejl at rette. Ingen kodeændring
for denne blok.

Commit 4: `scripts/verify-atletens-uge-holder.mjs` (`npm run
verify:atletens-uge-holder`) — samme mock+vite-mønster som ordre 268's egen
`verify-atletens-uge.mjs`, egen minimal seed pr. scenarie (ikke
`e2e/fixtures.mjs`s `buildSeed`, som ikke let kan give en helt sessionsløs
uge eller et bevidst femcifret tal). Tre scenarier ved 360px: (A) tom uge,
(B) halv uge med et bevidst femcifret tonnage-tal, (C) "Sidste uge" side om
side med denne (blok 2). Alle tre asserterer både DOM-teksten og fraværet
af vandret rulning (`document.documentElement.scrollWidth -
clientWidth <= 1`). Samme grænse som ordre 268's script: ligger i
`scripts/`, ikke `e2e/` — importerer kun (læser) `e2e/mock-supabase.mjs` og
`e2e/harness.mjs`, ingen af de filer ændret. `scripts/proever.mjs` finder
scriptet automatisk (læser `verify:*` fra `package.json`).

## Testresultat

- **`npm run lint`:** rent efter alle commits.
- **`npm run build`:** grøn efter alle commits — `AthleteView` lander på
  146,3 kB (39,6 kB gzip).
- **Enhedstests (`src/athlete/ugeStatus.test.js`):** fortsat 9/9 grønne —
  ingen ny beregning i denne ordre, så ingen nye tests var påkrævet.
- **`scripts/verify-atletens-uge-holder.mjs` (`npm run
  verify:atletens-uge-holder`, commit 4):** 3/3 scenarier grønne — tom uge,
  halv uge med femcifret tal, og "Sidste uge" side om side, alle ved 360px
  uden vandret rulning. Skærmbilleder gennemset manuelt
  (`outputs/_seneste/e2e/atletens-uge-holder-0{1,2,3}-*.png`) — ingen
  afskåret tekst.
- **`scripts/verify-atletens-uge.mjs` (ordre 268's egen prøve):** stadig
  grøn efter blok 2's tekstformat-ændring (assertionen opdateret til det
  nye ét-linjes format).
- **`npm run proever`:** **69/69 grønne** (0 fejl, 0 sprunget over), kørt
  efter alle commits — inkl. den nye `verify:atletens-uge-holder`, ordre
  268's `verify:atletens-uge`, og hele den delte `e2e (run-all.mjs)`-sekvens.

## Hvad er næste

1. Blok 3 venter reelt på ordre 269 selv — når `docs/RAPPORT-269.md`
   findes (på `main` eller i `entropi-app-wt2`) og navngiver konkrete fejl
   i atletfladerne, kan en efterfølgende ordre rette dem i samme ånd
   ("under tredive linjer hver").
2. "Sidste uge" sammenligner kun på ÉN uge tilbage (week_number - 1) — ikke
   et glidende vindue. Det matcher ordrens egen ordlyd ("sidste uge"), men
   er værd at nævne hvis en fremtidig ordre ønsker længere tilbage.
3. For Hara: appen holder nu synligt på en telefon i et tæt
   omklædningsrum, uanset om ugen er tom, halv eller har usædvanligt store
   tal — det er præcis den slags Marc ellers selv skulle opdage og melde
   tilbage.

**Tre linjer til Marc:** "Ugen som planlagt" knækker ikke længere ved 360px,
uanset om ugen er tom, halv, eller tallene er blevet usædvanligt store, og
atleten kan nu sammenligne denne uge med sidste uge uden at det bliver en
dom. Blok 3 (rettelser fra 269's fund) venter på at 269 selv bliver
færdig — der er intet at rette endnu.

## Ærlige grænser

- Blok 3 er ikke udført — ingen fejl fra ordre 269 er rettet, fordi ordre
  269 endnu ikke har afleveret en navngivende rapport. Dette er ikke en
  gætning; jeg har tjekket `main`, alle grene og `entropi-app-wt2` direkte.
- 360px-robustheden er bevist for de scenarier scriptet dækker (tom uge,
  ét-sessions halv uge med store tal, to-ugers sammenligning) — en uge med
  MANGE samtidige sessioner på én dag, eller en atlet med et meget langt
  forløb (mange uger) i "Hele forløbet"-visningen, er kun verificeret
  visuelt/manuelt, ikke af en dedikeret prøve.
- "Sidste uge" kræver at `forloebLogs` er hentet (samme lazy-hentning som
  "Hele forløbet") — første klik på "Sidste uge" viser derfor kortvarigt
  "Henter…", ikke øjeblikkeligt data, ligesom "Hele forløbet" allerede gjorde.
- Ikke afprøvet mod produktion (samme stående grænse som 131/210/228/248/
  256/259/268).
