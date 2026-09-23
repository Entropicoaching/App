Model: Claude Opus 5.5 (claude-opus-5-5) via Claude Code-launcheren; commits er signeret "Claude Opus 5.5" som medforfatter.

# Rapport: ordre 339, Bhishaks fire smaating paa forsiden, og "af 8 gentagelser"

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Bhishak (334) fandt fire smaating paa forsiden: F1 for lille tekst i ugestrimlen, F2 for smalle celler paa 360 px, F3 chips under folden midt i et pas og F5 en toast over overskriften. Derudover sagde "Vis mig nu"-banneret "af 8 gentagelser" som fast tekst (RAPPORT-333, punkt 3). Alle fem er rettet, og hver har nu en prøve der ville have fanget den. Betydning for Hara (Coaching-planeten, delmaal "Appen maerkbart bedre"): ja. Det er atletens forside midt i et pas, altsaa den skaerm der bruges mest.

## Gren

Grenen hedder `forside-finpuds` og er lavet fra `main` (`171095f`).

- `c534420` blok 1: F1, F2, F3 og F5 i `src/AthleteView.jsx` + prøver i `e2e/rolig-forside.spec.mjs`, `e2e/ret-saet.spec.mjs` og `e2e/saet-nu.spec.mjs`
- denne commit, blok 2: banneret i `public/videocoach.html`, prøven i `e2e/videocoach-flow.spec.mjs`, skaermbilleder i `outputs/339/` og denne rapport

Ingen push, ingen migration og ingen atletdata. Kun mock-seed og syntetisk klip. Coach-siden, Fremgang og Indbakken er ikke roert.

## Hvad aendret

**F1, strimlens tekst** (`WeekCalendar`): Ugedagen er gaaet fra 7,7 px til 10,4 px og "hvile"/status fra 6,4 px til 9,6 px. Prøven kraever mindst 10 px og mindst 9 px.

**F2, cellebredde** (`WeekCalendar`): Strimlen laaner 0,5rem af sidens margen i hver side, og mellemrummet er 0,35rem. Det giver celler paa **44,1 px paa 360** og 48,3 px paa 390. 330's krav om mindst 5 px luft mellem dagene holder stadig. Prøven kraever mindst 44 px pr. celle paa begge viewports.

**F3, chips over folden** (`DagensPasCard`): Klarede saet vises som standard i EEN linje: "✓ 3 saet klaret · senest 200kg × 4" med "↺ fortryd" og "vis / ret ▾". Et tryk folder de gamle "ret"-raekker ud. Staar et saet aabent til redigering, er listen altid foldet ud. "Fortryd sidste saet" har samme handling og samme tilgaengelige navn, men ligger nu i den kollapsede linje i stedet for i sin egen raekke i fuld bredde. Det sparer ca. 50 px. Kun kollapsen alene manglede 15 px paa 360x780. Med tre saet logget slutter chipsene nu ved **745 px** paa begge viewports (fold 780/844). Foer: 795 px paa 360 og "Mere" ved 905 paa 390.

**F5, toasten** (PR-toast og den almindelige flash): Toasten var `position: fixed` 10 px under topbaren. Nu ligger den i en plads i sidens flow (`toastSlot`, sticky under topbaren). Paa forsiden staar pladsen EFTER overskrift og strimmel. Et sticky element kan kun glide ned over indhold der kommer efter det, saa dagen kan ikke daekkes, heller ikke naar siden er rullet. Paa de andre faner ligger den lige under topbaren. Prøven kraever at toasten hverken overlapper h1 eller strimlen, maalt i den rulleposition siden har efter "Godkendt".

**"af 8 gentagelser"** (`vcPreviewBannerText`): Banneret siger nu fx "👁 Viser 3 udvalgte gentagelser (1., midt, sidste) · videoen sendes nu til din coach, som sporer resten". **Valg, der afviger fra ordrens ordlyd:** ordren bad om saettets faktiske antal og "3 af N". Det tal findes ikke i atlet-flowet. Presearch taeller pauser, ikke reps: e2e-klippet med 5 reps og pause i bunden gav 9 vinduer, og banneret sagde derfor "2 af 9" i foerste forsøg. Atleten udfylder heller ikke reps i VideoCoach, og broen fra appen sender ingen saet-kontekst. Et gaet N ville vaere en ny forkert paastand. Hjaelperen tager et `total` og skriver "3 af N" / "alle N", hvis en kalder en dag har et paalideligt tal.

## Testresultat

- `npm run lint`: groen.
- `npm run proever`, een ubrudt koersel: **92/92 groenne, 0 fejl, 0 sprunget over** (`outputs/339/proever.md`). Den inkluderer alle verify:*-scripts (bl.a. `verify:athlete-tap-targets`), `rolig-forside`, `ret-saet`, `saet-nu`, `dagens-pas` og `videocoach-flow`.
- Nye prøver: `rolig-forside` (F1 skriftstørrelse, F2 cellebredde ≥44, F3 chips over folden med tre saet logget, F5 ingen overlap med h1/strimmel) og `videocoach-flow` (intet "af n" forskelligt fra klippets `N_REPS`, og banneret skal sige hvor mange og hvilke).
- Skaermbilleder i `outputs/339/`: `390x844-*` og `360x780-*` (forside, forside hele, PR-toast, tre saet logget) plus `390x844-05-vis-mig-nu-banner.png`. Maalingerne fra begge viewports ligger i `taelling.json`.
- Specs skriver deres egne skaermbilleder til 314/320/330. De filer er sat tilbage, saa tidligere ordrers bevis er uroert.

## Hvad er naeste

1. Marc: se `outputs/339/360x780-04-tre-saet-logget.png` og `360x780-03-pr-toast.png`. Test paa telefonen at "vis / ret ▾" og "↺ fortryd" er til at ramme med kridt paa haenderne.
2. Skal banneret have "3 af N", kraever det et paalideligt reps-tal. Mulighederne er at appen sender det aktuelle saets reps med over broen, eller et reps-tal fra coachens fulde sporing. Det er en ny funktion, ikke en rettelse.
3. Rest fra 334: F4 (gaade efter spil), F6 (tryk paa dag forlader forsiden) og F8 (pauselinjen overlapper nav med 4 px) er ikke roert.

## Aerlige graenser

- "Over folden" er maalt mod `innerHeight`, samme maal som Bhishak brugte. Mens pausetimeren koerer, ligger pauselinjen (678–726 paa 360) oven paa chipsene (693–745), og bundnavigationen daekker fra ca. 722. Chipsene er altsaa over folden, men ikke fri af de faste bundlinjer i hvileperioden.
- Toasten skubber nu indholdet under sig ned i ca. 3 s (layoutskift) i stedet for at daekke det. Det er prisen for at den aldrig ligger over dagen.
- Ugestrimlens datotal var tomme i mock-seeden (ogsaa foer denne ordre). Skaermbillederne viser derfor cirkler uden tal.
- Alt er maalt i headless Chromium. Ingen rigtig telefon.

main kan pushes: ja
