# Rapport — Ordre 184: tag din egen fravalgt-liste

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`fravalgt-listen`, forgrenet fra `main` (`26f2d7a`). To commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `7d232b7` | Valg + begrundelse (alle 7 punkter fra FRAVALGT-175.md/RAPPORT-167.md vurderet) + baseline-måling |
| 2 | `0d0129c` | Fjernet fast dublet-kald af `fetchLatestMessages` ved hver sideindlæsning + måling |
| 3 | (denne commit) | Måling efter + opdateret fravalgt-liste + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Baggrund:** ordren bad mig læse min egen fravalgt-liste fra ordre 175 (og
den åbne del af ordre 167's) og vælge 2-3 punkter med bedst forhold mellem
gevinst og pris. Se `docs/VALG-184.md` for den fulde tabel over alle 7
punkter. Kort opsummeret: 2 punkter var allerede leveret i ordre 175
(lukkede), 3 punkter er udtrykkeligt forbudt af denne ordres grænser eller
kræver et testmiljø jeg ikke har — **kun ét punkt var reelt handlingsbart**:
`refreshCoachInbox()`s gentagne kald (FRAVALGT-175 #3).

Under undersøgelsen af det punkt fandt jeg at problemet har TO forskellige
mekanismer, ikke én:

1. **En fast dublet ved hver sideindlæsning** (ikke tidligere dokumenteret):
   `fetchAthletes()`s egen efterslæb-kæde kaldte `fetchLatestMessages()` for
   alle atleter, og den separate effekt bag `refreshCoachInbox()` kalder
   PRÆCIS samme funktion igen ved samme mount — fordi appens startvisning
   altid er enten `'list'` eller `'inbox'`. Beskeder blev derfor altid
   hentet to gange ved hvert eneste login/genindlæsning, uafhængigt af
   faneskift.
2. **Faneskift-dublet** (den oprindelige FRAVALGT-175 #3): et rent
   Forside↔Coach Briefing-skift genkører alle fire kald i
   `refreshCoachInbox()`, målt til 11 netværkskald på Indbakke-skærmen ved
   normal test-navigation.

**Rettelse 1 (commit 2) — den faste dublet fjernet.** Simpel fjernelse af ét
overflødigt funktionskald fra `fetchAthletes()`; ingen ny tilstand, intet
tidsvindue. `refreshCoachInbox()` dækker allerede beskederne ved mount.
Alle skrive-stier (fx `markMessagesRead`) kalder allerede `fetchLatestMessages`
eksplicit selv bagefter, så ingen anden sti mister sin opdatering.

**Faneskift-dubletten (mekanisme 2) blev IKKE leveret.** Jeg forsøgte en ny
teknik (tjek FØR nogen `setState`, i modsætning til ordre 175's tidsbaserede
vagt), men fandt igen en reproducerbar rendering-regression — denne gang
konsistent på DESKTOP-profilen (ingen CPU-kastration der, så ikke en
throttling-artefakt): 59-66ms → 359-361ms, to identiske målinger i træk.
Rullet tilbage samme dag, ingen kode fra dette forsøg er i noget commit. Se
`docs/FRAVALGT-184.md` punkt 2 for detaljer og hypoteser til en tredje
forsøgsrunde med et ægte trace-værktøj.

Under arbejdet fandt jeg desuden to NYE, ikke-afprøvede kandidater i samme
klasse (redundant genhentning ved rent faneskift) — `fetchCalendarWeeks`/
`fetchCalendarProgress` og oversigt/analyse-fanernes fire kald. Ikke rettet
her (ordren bad om at arbejde fra den eksisterende liste, ikke åbne nye
områder) — dokumenteret i `docs/FRAVALGT-184.md` punkt 3-4 til Dhruvas næste
ordre.

## Testresultat

**Coach-måling** (telefon 390px + desktop 1280px, samme metode som ordre 175 —
se note om målescript-fix nedenfor), median af 3 løb:

| Skærm | Netværkskald før→efter (commit 2) | Dom |
|---|---|---|
| Atletliste | 40 → **38** | "Føles som en hjemmeside der loader" (uændret — se Ærlige grænser) |
| Check-in-gennemgang | 6 → 6 (urørt) | "Føles som et værktøj" |
| Atletens uge | 0 → 0 (urørt) | "Føles som et værktøj" |
| Videoer | 14 → 14 (urørt) | "Føles som et værktøj" |
| Indbakke (Coach Briefing) | 11 → 11 (urørt — faneskift-dubletten er IKKE rettet, se ovenfor) | "Føles som et værktøj" |

Atletlistens TTI (telefon): ~5983ms → ~5817-5865ms. Perf-score stort set
uændret (56-70, samme støjniveau som ordre 175 rapporterede). Rå tal:
`outputs/maal-coach/2026-09-14.json` (før), `outputs/maal-coach/2026-09-14--efter-commit2.json`
(efter commit 2), `outputs/maal-coach/2026-09-14--slut.json` (slutmåling,
identisk med efter-commit2 da faneskift-forsøget blev rullet tilbage).
Forsøgets egne (ikke-leverede) tal: `outputs/maal-coach/2026-09-14--efter-commit3.json`
og `--efter-commit3-retry.json`.

**Gevinsten i tal:** -2 netværkskald pr. atletliste-besøg (40→38, samme
"faste duplikat"-gevinst gentaget ved hver eneste sideindlæsning, ikke kun
ved navigation). Beskeden i absolutte tal, men ærligt: TTI-faldet
(~150-200ms) ligger inden for målingens egen støj (se ordre 175's egne tal,
som varierede 5801-5847ms på tværs af løb uden nogen kodeændring) — den
sikre, målbare gevinst er netværkskaldet, ikke en garanteret følt
hastighedsforskel.

**npm run lint:** rent gennem begge commits.

**Verify-scripts:** alle 31 `verify:*`-scripts kørt, alle grønne.

**npm run e2e:** grøn (`atlet → coach, ende-til-ende`, 26,5s).

**npm run maal:telefon** (atletens side, regressionstjek — denne ordre rører
kun Dashboard.jsx/IndbakkeView.jsx): grøn, uændrede tal. Se
`outputs/maal/2026-09-14.json` og `outputs/maal/2026-09-14--slut.json`.

**Målescript-fix (del af commit 1):** `npm run maal:coach-telefon` kunne
ikke køre grønt ved ordrens start — to tekst-selektorer ("Indbakke",
"Vigtigst nu") i `scripts/maal-coach-telefon.mjs` var forældede efter en
tidligere, urelateret ordre (171) omdøbte sidebar-label og sidehoved til
"Coach Briefing". Rettet til nuværende tekst; ingen ændring i selve
målemetoden.

## Hvad er næste

Se `docs/FRAVALGT-184.md` for den fulde, kodefrie liste (erstatter
FRAVALGT-175.md som Dhruvas grundlag). Prioriteret:

1. **Atletlistens ~5,8-6,0s TTI** — stadig den klart største uløste
   flaskehals, stadig forbudt af "ingen omskrivning af Dashboard". Egen
   ordre.
2. **To nye, billige, lavrisiko-kandidater** (calendar/list-dedup,
   oversigt/analyse-dedup) — samme velafprøvede ref-mønster som ordre 175's
   rettelse 1, ikke afprøvet her. God kandidat til en hurtig ordre.
3. **Faneskift-dubletten, tredje forsøg** — kun med et ægte trace-værktøj,
   ellers samme uforklarede regression igen (nu set to gange, to teknikker).
4. Har betydning for Hara (mærkbart bedre-sporet): coachens forside er
   stadig den skærm der mest sandsynligt bidrager til en oplevet "arbejder
   ikke smooth" — denne ordre gjorde et lille, sikkert skridt (2 kald
   færre pr. besøg) men rørte ikke den reelle årsag (punkt 1).

## Ærlige grænser

- Kun ét af de tre-fire mulige punkter var reelt handlingsbart inden for
  denne ordres grænser (se `docs/VALG-184.md`) — leveret som to
  del-rettelser af samme grundpunkt, hvoraf kun den ene (den faste dublet)
  blev gennemført. Ordren bad om "to til tre punkter"; jeg leverer ét
  gennemført og ét ærligt dokumenteret, forsøgt-og-rullet-tilbage punkt,
  fremfor at opfinde arbejde uden for den eksisterende liste for at ramme et
  tal.
- Atletlistens netværkskald-gevinst (40→38) er reel og målt, men TTI-tallet
  den efterlader (~5,8-5,9s) er stadig inden for samme støjbånd ordre 175
  selv dokumenterede — nævnt åbent i stedet for at overdrive en lille,
  reel gevinst til en oplevet forskel.
- Faneskift-dublet-forsøgets desktop-regression (359-361ms, to identiske
  målinger) er reproducerbar, men UFORKLARET — jeg har ikke et trace-værktøj
  til rådighed her til at finde rodårsagen. Rullet tilbage fremfor leveret
  uforstået, samme princip ordre 175 fulgte.
- Målt mod `e2e/mock-supabase.mjs` (lokal mock), samme 45 attrap-atleter som
  ordre 175 brugte, ikke Marcs rigtige atletantal.
