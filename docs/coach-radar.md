# Coachens radar

Radaren hjælper coachen med at vælge, hvem der skal have opmærksomhed i dag.
Den summerer faste regler. Der er ingen AI eller automatiske beskeder og ingen
ændringer af træningsplaner. Ét kort på coachens forside viser højst fem atleter
åbent. Resten kan åbnes med "Vis alle". Et tryk på atletens navn åbner den
eksisterende atletvisning, fanen `hub`, med retur til coachlisten.

## Flag og afgrænsning

`src/entropi2/coach/radar/flag.mjs` eksporterer
`DEFAULT_COACH_RADAR = false`. Kun dette separate flag eller den eksplicitte
boolean `coachRadarEnabled: true` til `CoachView` tænder kortet. Dashboardet
sender ikke denne prop i dag. En fremtidig frigivelse kan ændre konstanten efter
kontrol. Entropi 2 kan være tændt, mens radaren fortsat er slukket.
Der læses ikke URL, storage eller miljøvariabler. OFF monterer ikke radaren,
starter ingen læsninger og ændrer ikke den eksisterende opgaveliste.
Kortet monteres ikke i indbakken. Ugestudiet og atletsiden er ikke ændret.

## Regler og vægte

Vægtene justeres samlet i `RADAR_WEIGHTS` i `radar/rules.mjs`.
Hver regel giver sin vægt én gang pr. atlet. Mange beskeder eller sæt forøger
ikke vægten. Det holder store logmængder fra at dominere listen.

| Regel | Point | Krav |
| --- | ---: | --- |
| Smerte stiger | 55 | Samme navngivne kropsområde, ugesnit stiger mindst 2 på skalaen 0 til 10 |
| Besked venter på svar | 50 | Seneste besked i mindst ét af sporene besked og teknik kommer fra atleten |
| Video venter på feedback | 45 | Unik video med `status: draft` og `source_mode: athlete_submission` |
| Pas uden log | 35 | Mindst ét planlagt pas uden registreret sæt i den senest afsluttede programuge |
| RPE stiger | 30 | Ugesnit af dagens gennemsnit stiger mindst 1 på skalaen 0 til 10 |
| Dagsformen falder | 25 | `readiness_score` falder mindst 10 i ugesnit på skalaen 0 til 100 |
| Søvnen falder | 20 | `sleep_hours` falder mindst 1 time i ugesnit |
| Ingen træningslog i 5 dage | 20 | Komplet læsning uden ikke-sprunget log i dag og de foregående 4 dage |
| Blokken slutter snart | 15 | Slutdato for den aktuelle navngivne blok ligger fra i dag til og med om 7 dage |
| Stævne snart | 10 | `competition_date` ligger fra i dag til og med om 21 dage |

Alle fire trends sammenligner dag 13 til 7 før i dag med dag 6 før i dag til
og med i dag. Begge vinduer kræver mindst tre forskellige registrerede dage.
Den nyeste registrering må højst være to dage gammel. RPE beregnes først som
gennemsnit pr. dag, så en dag med mange sæt ikke vejer mere. Manglende målinger
udelades, de sættes aldrig til nul. Smerte kræver heltal og samme kropsområde;
ømhed (`soreness_level`) bruges ikke som smerte.

## Rækkefølge og forklaring

Atleter uden et påvist signal udelades. Listen sorteres efter samlet pointtal,
derefter højeste enkeltvægt og til sidst atlet-id i fast tegnrækkefølge.
Navne og inputrækkefølge påvirker ikke prioriteringen. Ved lige signalvægt
afgør regelens faste nøgle den korte begrundelse. Kortet viser den tungeste
begrundelse pr. atlet. "Grundlag for X point" viser hver medvirkende regel,
dens vægt og grundlag. Summer og begrundelser kan dermed efterregnes.

## Datagrundlag og ærlige mangler

`model.mjs` bruger den allerede afgrænsede coachkontekst fra `coachHomeModel`.
Den kræver synlig atlet, korrekt coachejer, roster og københavnsk dato.
Beskeder og videoer bruger kun komplette, aktuelle kilder. En læst besked
kan stadig vente på svar; ulæsttælleren er derfor ikke i sig selv et signal.
Et senere coachsvar fjerner signalet. Samme tidsstempel med forskellige
afsendere er tvetydigt og tæller ikke, hvis sammenfaldet er på sporets nyeste
tidsstempel. En entydig nyere besked rydder ældre sammenfald, uanset rækkefølgen
i input. Ugyldige beskeder gør fortsat sporet ukendt. Coachens egne videokladder tæller ikke.

Når flaget er tændt, bruger `read.mjs` den eksisterende, rolleautoriserede
`notesClient`, som allerede gives til coachskærmen. To begrænsede læseforløb
henter 14 dages `exercise_logs` og `readiness_logs` for den synlige roster.
Der oprettes ingen klient, tabel, migration, autorisation eller ny adgang.
Readiness bruger samme `select('*')` som den eksisterende readiness-læser,
fordi gamle installationer kan mangle smertefelter. Kun atlet-id, dato,
dagsform, søvn, smerte, kropsområde og kilde projiceres videre. Uden
smertefelter vises intet smertesignal. Ingen profilcache læses.

Læsninger pagineres med forespurgte sider på 2.000 rækker, indtil en fejlfri
tom side beviser slutningen. En kort ikke-tom side tæller ikke som slutning:
serverens "Max rows" kan være lavere end den forespurgte sidestørrelse.
Næste offset er det faktisk modtagne antal rækker, også UTC-rækker uden for
det lokale datovindue. Træningslogs sorteres stigende efter `logged_at, id`;
readiness efter `logged_date, athlete_id`. De unikke sidste nøgler gør siderne
stabile ved ens tidsstempler. Dubletter kontrolleres også på tværs af sider.
Forløbet kræver færre end 10.000 modtagne rækker og højst 100 sider inklusive
den tomme slutside. Rammegrænser, dubletter, forkerte atlet-id'er, ugyldige
datoer, fejl og delvise svar gør hele den berørte kilde ukendt og kasserer
allerede læste sider. En komplet tom træningslæsning kan bevise
fravær af log i fem dage. En manglende eller afkortet læsning kan ikke.
Det synlige kort siger, når data mangler, og viser fortsat uafhængige,
dokumenterede signaler. En komplet tom radar siger kun, at dens regler ikke
har fundet signaler i det indlæste grundlag.

Kalenderens `actionSessions` skal have kendte pas-id'er og antal planlagte
sæt. Kun den senest afsluttede programuge med start inden for de 14 dage
bruges til missede pas. Et sæt med pas-id beviser en log, ikke at hele passet
er færdiggjort. Der opfindes ingen ugedag ud fra pasrækkefølge. Aktuelle,
uafsluttede uger giver ikke et signal om manglende pas.
Blokslut kræver en entydig aktiv uge og et bloknavn. Den sidste planlagte
uge med samme sammenhængende bloknavn slutter seks dage efter sin start.
Udaterede uger eller tvetydigt genbrug af bloknavne skjuler signalet.

Datoer er kalenderdage i Europe/Copenhagen. Træningsforespørgslen har brede
UTC-grænser, og resultatet filtreres efter københavnske dage, også ved
sommertidsskift. Et svar indfanger ejer, dag og roster ved start. Komponentens
oprydningsfunktion afviser ældre svar ved en nyere læsning, ejerskift eller
afmontering. Et nyt læsegrundlag eller et tryk på "Opdater radar" skjuler
det gamle resultat, mens den nye læsning er i gang.

## Verifikation

`rules.test.mjs`, `read.test.mjs`, `model.test.mjs`, `component.test.mjs` og `correction.test.mjs`
kan køres med Node 24 uden installation:

```text
node --test --test-concurrency=1 src/entropi2/coach/radar/*.test.mjs
```

Komponentprøverne bruger de faktiske kopierede moduler med et syntetisk
elementtræ og hooks fra repoets eksisterende `prog5Dom.mjs`. De dækker
1, 12 og 40 konstruerede atleter, rækkefølge, fold, begrundelser, profilkald,
OFF og forældede svar. Dette er ikke React DOM, browserprøver eller visuel
mobilgodkendelse. Ejer-, dato-, scope-, fejl-, datagrænse- og trendprøver
bruger udelukkende syntetiske data. Fuld suite og build tilhører Dhurva ved
fletning; den særskilte friske kontrol tilhører K-R1-E2-COACH-RADAR1.
