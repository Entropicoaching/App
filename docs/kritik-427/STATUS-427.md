# Status 427: mine fund fra 416 på matematik `main` @ `28ba81d`

Matematik (417 og 420 merget) er kun læst via `git archive` til en kopi i
scratch med en junction til `node_modules`. Intet i matematik er rettet.
Mine 416-scripts er kopieret til `outputs/kritik-427/` (`*-427.mjs`), så
de skriver her og 416's bevis står urørt. Kun én ændring i scripts ud over
navnene: `elev-427` gemmer også linjen under klaret-feltet (`.klaret-ny-quest`,
kom i 420), og `questene-427` har fem ekstra ord i ordlisten (se Q1).

| Fund | Hvad 416 sagde | Status | Bevis (427) |
|---|---|---|---|
| Q1 | Grunden og opgaverne passer ikke (4 quests 0 %) | lukket | `questene-427.json`: alle 14 quests 100 % på 300 salte. De fire 0 %-quests (bed, klokkereb, sti, kasse) er 100 % med 416's **uændrede** ordliste. For 5 quests var min liste for snæver til 417's nye skabeloner (kringle, ællinger, alterlys, markedets boder); jeg har læst hver skabelon, der ikke passede, og de passer alle, så ordene er tilføjet. Mel til bageren i blok 1: 3 af 3 opgaver om Anes mel. |
| Q2 | Gæt giver belønning og fuld erfaring | lukket | `browser-427.json`: 416's gætter (uændret) på 150 opgaver: **0 quests klaret, 0 belønninger** (416: Æbleboden efter 10, Halstørklædet efter 20). Hun starter Æblerne efter 77 opgaver og kommer aldrig igennem. Hun når dog niveau 11 (se ærlige grænser; niveauet laves om i 426, ikke rørt her). |
| Q3 | Det første "!" kommer uden varsel | lukket | `elev-427.json`, `E-05`: under Mølleren står "Ane, bagerkonen, står med et ! ved møllen og har brug for din hjælp." og knappen "Hjælp Ane", før "Byen vågner". Første "!" efter 125 s og 8 tryk. |
| Q4 | Belønningerne er for små, huen daler uden for skærmen, kun nyeste titel | lukket | `browser-427.json`: alle 9 ting 37-80 px (416: Æbleboden 16 x 12, Ænderne 31 x 13). Et flag i figurens farve står ved hver ("På kortet står et lille flag i din farve", `E-30`). Questbogen har gruppen "Dine titler". Huen daler på takkekortet, ikke på portrættet (`hueNed` 0 på portrættet); det ses i blok 2. |
| Q5 | "Et nyt bed" bryder trin-reglen | lukket | `questene-427.json`: 0 trin-brud (416: `nyt-bed`). Bedet kræver nu Grusgravens forløb 4. |
| Q6 | Genvejen gør ingenting | lukket | Kun set i koden: `spil-app.js` (417): `genvejRute` og `tokenEl.dataset.rute = "stien"`, og takkekortet siger "Når du går mellem Grusgraven og Sporvognen, går du ad den." Jeg har ikke målt gangen i browseren. |
| Q7 | "Hvad nu?" mangler efter en quest | delvist | `elev-427.json`: efter Mel til bageren: "Hvad nu? Ane: "Kom tilbage, når du har mestret "Del ligeligt" hos Mølleren."" Godt. Efter **Brød til alle** peger den på Karen: "Kom tilbage, når du har hjulpet Hans med "Sten til diget" og du har hjulpet Else med "Æbler til gaden"." Hun, Hans og Else står ikke på kortet endnu, og Grusgraven og Landsbygaden er låst. |
| Q8 | Questbogen ligner et skema | lukket | `E-30`: intet "Låst"-afsnit. Der står "11 mere i landsbyen har brug for hjælp. Du møder dem, når du kommer videre." |
| Q9 | Graverens "!" over skiltet, stien under stedknapperne | åben | `browser-427.json`: stien ligger stadig 28 % under "Sporvognen" og 14 % under "Grusgraven". Stendiget ligger 22 % under "Skoven og Søen". Blomsterbedet ligger 7 % under "Kirken og Landsbygaden". 420 siger selv, at Q9 ikke er rørt. |

## 60 %- og 80 %-eleven (sim-427.json)

Modellen står i `outputs/kritik-427/sim-427.mjs`. Den bruger spillets egne regelfunktioner. Eleven er en terning: rigtigt i første forsøg med sandsynlighed p. Hun tager først et "!", ellers næste forløb på første åbne sted. 150 opgaver, 4000 elever pr. p.

| | gætter (1/3) | 60 % | 80 % | 90 % |
|---|---|---|---|---|
| belønninger på 150 opgaver (snit / median) | 0,13 / 0 | 2,8 / 3 | 10,4 / 10 | 13,0 / 13 |
| elever uden belønning | 88 % | 3 % | 0 % | 0 % |
| "hvil" på 150 opgaver (snit / median) | 3,4 / 4 | **9,9 / 10** | **8,2 / 8** | 3,6 / 3 |
| quest-forsøg, der ender i hvil | 96 % | **78 %** | **44 %** | 22 % |
| første quest (Mel til bageren) ender i hvil | 81 % | 79 % | 50 % | 27 % |
| hvil igen hos samme person (snit) | 2,0 | 6,6 | 3,6 | 0,9 |
| opgaver fra hvil til nye tal (median) | 20 | 10 | 7 | 5 |
| har Bagerhuen efter 150 opgaver | 1 % | 64 % | 100 % | 100 % |

**Årsagen er én regel:** 10 af de 14 quests har 3 opgaver, og
`mestringsKrav(3)` er 3. Én fejl i en 3-opgavers quest giver altså hvil.
En 60 %-elev møder "Tak, fordi du prøvede" cirka hver 15. opgave, oftest hos
Møllens tre quests (Anes to og Niels'). En 80 %-elev møder den i hver
anden quest, og halvdelen af 80 %-eleverne får den allerede på den første
quest, de nogensinde prøver.

Modellen er min: en terning, ikke et barn, og hendes valg af næste skridt
er mit. 420's model gav 60 %-eleven 4 belønninger; min giver 2,8, fordi
min elev bliver ved Møllen i stedet for at gå til Landsbygaden fra niveau 3.
