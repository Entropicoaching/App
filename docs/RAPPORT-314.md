**main kan pushes: ja**

# Rapport — ordre 314: Dagens pas, atleten skal altid vide hvilket sæt der er nu (to blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Det Marc mærker på telefonen efter push

1. **Kun det sæt man er på, har fulde felter.** "Sæt 2 af 4" står tydeligt øverst på Dagens pas-kortet, og kun det sæt har vægt/reps/RPE-felter og "Godkendt".
2. **Klarede sæt står kompakt.** Hvert sæt du allerede har godkendt på samme øvelse er nu én linje ("Sæt 1: 80kg × 4, RPE 8") med et lille "ret"-tryk, der genåbner præcis det sæt til redigering.
3. **Næste sæt er højst én dæmpet linje** ("Næste: 4 reps @ 80 kg") — ingen felter, ingen "Godkendt". Kan slås fra med et lille afkrydsningsfelt ("Vis næste sæt") lige der, i stedet for i en separat indstillingsside (findes ikke i appen i dag).
4. **Vægt- og reps-rækken brækker ikke længere** ved 360-390px (Bhishaks F4, docs/KRITIK-288.md) — vægt står for sig, reps+RPE for sig, ingen knap er længere skilt fra sit felt.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): ja. Det retter den konkrete forvirring Marc selv rapporterede fra telefonen, og lukker samtidig F4, som stod som "ret efter push (høj)" i kritikken af 288.

## Gren

Gren `saet-nu`, forgrenet fra `main` (`c49c8c3`).

- `1aac128` blok 1: kortet (kun aktuelt sæt har fulde felter, klarede sæt kompakte, næste sæt dæmpet + til/fra), F4-rettelsen, enhedstest for at overskriften følger det aktuelle sæt
- denne commit: blok 2 (headless prøve på to viewports, `proever.mjs` som nr. 13, denne rapport)

Arbejdstræet er rent. Ingen push, ingen migration, ingen ny tabel, ingen atletdata, ingen skrivning mod Supabase. Coach-siden, Fremgang og offline-køen er ikke rørt.

## Hvad ændret

**Blok 1**
- `src/AthleteView.jsx` (`DagensPasCard`): ny `exerciseLogs`-prop (var ikke sendt med til kortet før). Sæt 1..`setNumber-1` på den aktuelle øvelse vises som kompakte linjer (skippede sæt: "Sprunget over"); "ret" kalder `onUndoLastSet(ex.id, n)` — den eksisterende `undoLoggedSet`-funktion sletter log-rækken og genåbner netop det sætnummer, uændret logik, kun et nyt kaldested. Næste sæt (hvis der er et på øvelsen) vises som én linje ud fra samme forudfyldnings-logik som feltet selv ville have brugt (anbefalet/forslag/sidste gang for vægt, ordinationens minimum eller sidste gang for reps), plus et afkrydsningsfelt der gemmer valget.
- `src/nextSetPreview.js` (ny): `loadShowNextSetPreview`/`saveShowNextSetPreview`, samme mønster som `restPause.js` (storage sendes eksplicit, default `localStorage`, enhver fejl sluger sig selv). Ingen `athleteId`-scope — det er en visningspræference for enheden, ikke atletdata.
- **F4-rettelsen:** vægt-kontrollerne (−, felt, +) står nu i deres egen række; reps-kontrollerne (×, −, felt, +) og RPE-mærkatet i en anden. Regnestykke først: fire 44px-trykflader + to felter + et RPE-mærkat kan ikke være på én linje i en ~310px kortflade uden at gå under 44px (se "Ærlige grænser") — derfor to rækker, ikke én smallere.
- `src/nextSet.test.js`: ny test, "overskriften ('Sæt X af Y') følger det aktuelle sæt, når et sæt godkendes" — `findDagensPas` før/efter en log-række på sæt 1, og efter hele øvelsen er logget (springer til næste øvelse).
- `src/nextSetPreview.test.js` (ny, 4 tests): gem/hent, overskriv, fejlende storage vælter ikke.

**Blok 2**
- `e2e/saet-nu.spec.mjs` (ny) + `npm run e2e:saet-nu`: logger tre sæt i træk på Squat (4 sæt) på **390×844** og **360×780**, egen mock pr. viewport (frisk `buildSeed()`, samme port 8991 genbrugt sekventielt — vite startes én gang, mock og browserkontekst genskabes mellem de to viewports). Skærmbillede før og efter hvert "Godkendt"-tryk i `outputs/314/`. Tjekker efter hvert tryk: `document.documentElement.scrollWidth` ≤ viewportbredden (ingen vandret overflow), "Sæt N af 4" matcher det aktuelle sæt, alle tidligere sæt (og kun dem) står som "Sæt n: …"-linjer, og næste sæt-linjen ("Næste: 4 reps @ 80 kg") står når der er et næste sæt på øvelsen.
- `scripts/proever.mjs`: ny prøve nr. 13.
- `package.json`: `e2e:saet-nu`.

## Testresultat

- `npm run lint`: ren.
- Enhedstests: `node --test src/nextSet.test.js src/nextSetPreview.test.js`: 19/19 (heraf 4 nye + 1 ny).
- `npm run e2e:dagens-pas`, `e2e:dagens-pas-historik`, `e2e:atlet-uge`: grønne, uændrede (kortets eksisterende adfærd for forudfyldning, pause, fortryd, offline-kø er urørt).
- **Headless prøve** (`e2e/saet-nu.spec.mjs`, mod mock-Supabase og lokal vite, 390×844 og 360×780): tre sæt logget i træk på begge bredder. Ved hvert tryk: ingen vandret overflow, "Sæt N af 4" stemte, klarede sæt stod kompakt (og det aktuelle sæt stod aldrig som en klaret linje), næste sæt-linjen viste "Næste: 4 reps @ 80 kg" indtil sidste sæt (4/4), hvor den korrekt forsvandt sammen med til/fra-boksen. Skærmbilleder gennemset i `outputs/314/`: ingen brudt række, fortryd-knap og næste-linje ligger under hinanden uden overlap med bunden af kortet.
- **Én ubrudt `npm run proever`, port 8991 tjekket først (fri): 84/84 grønne** (0 fejl, 0 sprunget over) — 34 enhedstestfiler, 37 `verify:*` og 13 e2e, herunder den nye `saet-nu.spec.mjs`.
- `outputs/ugen-faar-dato/` blev igen overskrevet af prøven og rullet tilbage med `git checkout`, så de sporede skærmbilleder ikke er med i commit'en (samme kendte adfærd som i rapport 293/301).

## Hvad er næste

- Dhruva merger, Marc pusher (push = deploy).
- Efter push: log tre-fire rigtige sæt på telefonen og se om "Sæt N af M" + de kompakte linjer opleves som Marc beskrev det — det er den ene ting, der ikke kan bevises headless.
- Ingen opfølgende fund fra denne ordre; F4 fra docs/KRITIK-288.md er lukket. De øvrige F6-F14 er stadig urørt.

## Ærlige grænser

- **F4-fixen er to rækker, ikke én.** Jeg har regnet på det: fire 44px-trykflader + to felter + RPE-mærkatet kræver ca. 400-470px i bredden; en ~310px kortflade (360-390px skærm minus padding) kan ikke rumme det uden enten at gå under 44px-touch-target-reglen (som selv står i kritikken som noget der skal RETTES, F7) eller at bryde ordinationen midt i en feltgruppe (den oprindelige fejl). To rækker — vægt for sig, reps+RPE for sig — er valget, ikke bogstaveligt "én linje" for hele rækken.
- **"Ret" på et klaret sæt sletter og genåbner sættet** (samme funktion som "Fortryd sidste sæt", `undoLoggedSet`) — det er ikke en ny redigerings-UI. Retter man et TIDLIGERE sæt, mens senere sæt på samme øvelse allerede er logget (fx retter sæt 1 mens sæt 2-3 står klar), bliver kortet "Sæt 1 af 4" igen, og sæt 2-3 er midlertidigt usynlige (ingen klaret-linje for dem, fordi de nu ligger EFTER det aktuelle sæt) — de dukker op igen, når sæt 1 er godkendt på ny. Det er en eksisterende begrænsning i `nextSetInSession` (finder altid det første ulogget sæt i rækkefølge, ingen understøttelse af "huller"), ikke noget jeg har rettet eller forværret.
- **"Indstillingen" for næste sæt-visning er en afkrydsning på selve kortet**, ikke en separat indstillingsside — appen har ingen i dag, og ordren bad mig kun læse afsnittet om sætlisten i Dagens pas. Præferencen er pr. enhed (localStorage), ikke pr. atlet/konto.
- Alt er kørt headless mod mock-Supabase og lokal vite, ikke på en rigtig telefon og ikke mod produktion.

main kan pushes: ja
