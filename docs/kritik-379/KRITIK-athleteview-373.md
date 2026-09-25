# Kritik: atletens app efter ordre 373 (AthleteView delt i moduler)

Ordre 379, blok 2. Bhishak har kun kritiseret og intet rettet.

- **Live:** `e524d5e` (ordren siger, at atleterne har den version).
- **Efter:** `main` = `c8aa336` (merge af 373).

Begge versioner er trukket ud med `git archive` og kørt med vite i e2e-mode mod samme mock som 373: `e2e/mock-supabase.mjs` og `buildSeed({ withMeasuredVideo: true })` fra hver versions egen `e2e/fixtures.mjs`, plus samme stævnedato som 373's skærmbilledscript. Det er kun seedens syntetiske atlet, så der er ingen atletdata. Kørslen var headless Chromium på 390×844 med berøring, samme dag og samme forløb for begge.

Script: `node scripts/kritik-379.mjs --kun atlet`. Billeder: `outputs/kritik-379/atlet-live/` og `atlet-efter/`. Tal: `maalinger.json` → `atlet`.

## Hvad der blev gjort (som en atlet)

1. Log ind, og se forsiden (skærm og hele siden).
2. **Dagens pas:** læs kortet, og tryk **Godkendt** på det aktuelle sæt.
3. **VideoCoach:** tryk "Film et sæt", læs hvad iframen viser, og luk den *inde fra* VideoCoach (✕).
4. "Mere" på forsiden (hele siden): ugen som planlagt, program, parathed, besked, kropsvægt, kost-linjen og VideoCoach-kortet.
5. **Program** og **Kost** (hele siden).
6. **Bundnav:** tryk hver af de 8 faner, og læs overskriften.

## Resultat

| Skærm | Live → efter, pixel-afvigelse |
|---|---|
| 01-forside | 0 % |
| 01-forside-hel | 0 % |
| 02-efter-godkendt | 0 % |
| 03-video-1 (VideoCoach åben) | 0 % i første kørsel, 3,99 % i den fulde `verify:kritik-379`-kørsel (se A5) |
| 04-forside-mere (hele siden, 3.021 px) | 0 % |
| 05-program | 0 % |
| 06-kost | 0 % |
| 07-bundnav-sidste | 0 % |

(pixelmatch, threshold 0, på billederne som de er, uden maskering.) Tallene er fra første kørsel (`--kun atlet`). I den fulde kørsel var 7 af 8 igen 0 %.

Adfærden er ens i de to versioner:

- **Forsidens tekst** er tegn for tegn den samme.
- **Dagens pas** før Godkendt: "Sæt 2/4 · Squat · Anbefalet: 80kg · 4 SÆT × 4-6 · RPE 8", med "✓ 1 sæt klaret · senest 80kg × 4". Efter Godkendt er teksten ens i begge.
- **VideoCoach:** knappen "FILM ET SÆT" er 113×52 px. Den åbner `videocoach.html` i en dialog, og iframen viser "FILM ET SÆT · Se svaret med det samme …". ✕ inde i VideoCoach lukker dialogen igen i begge versioner (broen virker).
- **Kost:** "0 / ? kcal", "0 / ? g" og samme TDEE-tekst i begge.
- **Bundnav:** de samme 8 faner (Hjem, Program, Volumen, Fremgang, Kost, Mobilitet, Beskeder, Stævne), og hver åbner samme overskrift ("Base.", "Din volumen.", "Bliver du stærkere?", "Kostlog.", "Hvad har du brug for?", "Din coach.", "71 dage til stævne.").
- **Fejl:** 0 sidefejl, 0 `console.error` og 0 HTTP-svar ≥ 400 i begge.
- **Layout:** siden er 390 px bred (ingen vandret rulning), og der er 0 trykflader under 44 px på forsiden.

Sammen med 373's egne 11 skærme (også 0 %), 44/44 verify og 11 e2e-specs er det nu set to gange uafhængigt: **atleten kan ikke se forskel.**

## Fund

| # | Hvor | Hvad | Alvor |
|---|---|---|---|
| A1 | hele appen | **Intet ser anderledes ud, og intet virker anderledes** på de skærme og handlinger ordren nævner. | - |
| A2 | opstart | Chunken `AthleteView` er 11,4 kB større (2,8 kB gzip), ifølge 373's egen måling. Atleten henter den ved opstart. Jeg har ikke målt indlæsningstid på en rigtig telefon, og det har 373 heller ikke. På wifi er det ubetydeligt, på 3G i et kældercenter ca. 0,1 s. | lav |
| A3 | push-indhold | `main` indeholder mere end 373 siden `e524d5e`: `src/coachBriefingRules.js` (+430 linjer, ny fil med test, ordre 370) og en ændring på 6 linjer i `src/coachPriority.js`. Det er coachens side, ikke atletens, og derfor ikke kritiseret her. Marc skal vide, at et push også sender dem ud. | info |
| A5 | VideoCoach-iframen | I den fulde kørsel afveg `03-video-1` 3,99 % (`outputs/kritik-379/atlet-diff-03-video-1.png`). Live-billedet er taget, før iframens webfont (IBM Plex Mono) var indlæst, så teksten står i reserveskrift (Courier). Placering, tekst og knapper er de samme. Det er timing i mit script (1,5 s efter tryk), ikke 373: `src/` rører ikke iframen, og ved første kørsel var billedet 0 %. `public/videocoach.html` er dog ændret siden `e524d5e`, af ordre 355 (hold stangen på hurtig dødløft-nedtur, kun trackerkode, ingen layout). Den ændring går også ud med et push. | info |
| A4 | forside, "Mere" (begge versioner) | Et helsidebillede viser pauselinjen og bundnavet midt på siden (y ≈ 740). Det er et artefakt af helsidebilledet (faste elementer), ikke noget atleten ser. Det er ens før og efter. | - |

## Klar til push: **ja**

Fordi alle 8 skærme er pixel-identiske med den version, atleterne har i dag. Sæt-logning, VideoCoach (åbn og luk via broen), kost og alle 8 faner opfører sig ens, og der er ingen fejl i konsol eller netværk. Det eneste, atleten kan mærke, er 2,8 kB ekstra gzip ved opstart.

Forbehold: "ja" gælder atletens app. Pushet tager også coach-ændringerne i A3 og trackerændringen i A5 (ordre 355) med. Dem har denne ordre ikke set.
