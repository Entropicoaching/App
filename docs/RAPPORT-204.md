# Rapport — ordre 204: ugen får en dato af sig selv, så "planlagt" holder op med at være en streg

## Gren

Gren `ugen-faar-dato`, forgrenet fra `main` (`7d56e8a`, som allerede havde
min 192 og 196 samt Bhishaks 200 mergét ind — `git log --oneline -1 main`
ved start viste netop `7d56e8a`, så basen var ordrens forventede punkt).

- `287cda8` — commit 1: ny uge arver startdato automatisk
- `96e703b` — commit 2: "Sæt datoer" til eksisterende uger, ét tryk
- (denne rapport er commit 3, se hash i `git log` efter commit)

## Hvad ændret

**Commit 1.** Ny ren funktion `nextWeekStartDate` i nyt `src/weekDates.js`
(ingen Supabase, ingen React — samme princip som `src/volume/planlagt.js`):
forrige daterede uges dato (højeste `week_number` blandt eksisterende uger)
+ 7 dage; ingen daterede uger endnu → førstkommende mandag. Koblet ind
fem steder, som alle enten dublerede den samme udregning inline eller
manglede den:

- `ProgramTab.jsx`s "+ Ny uge"-knap og Periodiseringsplan-panelets
  datoforslag (to duplikerede inline-udregninger, nu ét kald).
- `Dashboard.jsx`s `openCalBlockBuilder` og `openPlanReview` (kalenderens
  blok-byggere, samme duplikering).
- Ny-atlet-flowets første uge (faldt tilbage til "i dag", nu til
  mandag-reglen som resten).
- **`copyWeek()` ("Kopiér seneste uge →") satte slet ikke `start_date`** —
  en reel bug: den formentlig hyppigste måde at forlænge et program på gav
  hver gang en udateret uge. Retter det, ligesom de øvrige.

Coachen kan stadig rette datoen i samme "Ny uge"-dialog som i dag —
funktionen sætter kun forslaget, ikke et låst felt.

**Commit 2.** Ny ren funktion `fillMissingWeekDates` (samme fil): finder
den første daterede uge i programmet og udregner datoer for de udaterede,
frem og tilbage i 7-dages-spring — rører aldrig en uge der allerede har en
dato. Ny knap **"Sæt datoer"** i `ProgramTab.jsx` (kun synlig når
programmet har mindst én daterede og én udaterede uge) viser et preview af
de udregnede datoer pr. uge, med "Annuller"/"Gem N dato(er)" — gemmer med
samme `supabase.from('weeks').update(...).eq('id', ...)`-kald resten af
uge-redigeringen allerede bruger (se "Gem tilknytninger"-knappen i samme
fil). Ny state `weekDateFill` i `Dashboard.jsx`, sendt til `ProgramTab`
som prop, samme mønster som `weekDraft`.

Fandt undervejs at knapperækken øverst i Program-fanen (`display:'flex'`
uden `flexWrap`) allerede var for smal til fire knapper ved 390px — den nye
femte knap gjorde det synligt værre (knapper skåret af i kanten, ingen
vandret scroll fordi en forældre har `overflowX:hidden`, så de bare blev
utilgængelige). Tilføjede `flexWrap:'wrap'` til den række, så alle knapper
(inkl. "Sæt datoer") reelt kan trykkes på en telefon.

Nyt verify-script `scripts/verify-ugen-faar-dato.mjs`
(`npm run verify:ugen-faar-dato`) kører den ægte, uændrede
`Dashboard.jsx`/`ProgramTab.jsx` mod e2e-mocken ved 1280px og 390px, med to
atleter der hver har ét program med én daterede og én udaterede uge (så de
to viewports kan køre uafhængigt i samme mock). Assertions mod mockens
`weeks`-tabel, ikke kun DOM-tekst: den udaterede uge fik den rigtige dato
(inkl. et bevidst månedsskift i 390px-tilfældet), den daterede uge er
urørt. Skærmbilleder i `outputs/ugen-faar-dato/`.

**Commit 3 (denne).** `docs/VOLUMEN.md`s "–"-afsnit opdateret: beskrev før
kun at "planlagt" kræver en kalenderdato coachen selv skal sætte — nævner
nu at nye uger får den automatisk, og at gamle uger kan få den med ét tryk
på "Sæt datoer".

## Testresultat

- `npm run lint`: grøn.
- Alle 34 `verify:*`-scripts (inkl. den nye `verify:ugen-faar-dato`,
  kørt som del af hele sættet, ikke isoleret): **grønne**.
- `npm run e2e`: grøn ("atlet → coach, ende-til-ende", 24,9s).
- `npm run build`: grøn, ingen kompileringsfejl.
- `node --test src/weekDates.test.js`: 13/13 grøn — `nextWeekStartDate`
  (mandag-reglen, forrige-uge+7, månedsskift, årsskift, både for den
  daterede og den mandags-afledte gren) og `fillMissingWeekDates` (frem og
  tilbage fra ankeret, ingen ændring af allerede daterede uger, tomt
  resultat når intet anker findes, månedsskift ved tilbageregning).
- **Måling mod mocken** (midlertidigt script, ikke committet — samme
  princip som RAPPORT-185's egne midlertidige verifikationsscripts):
  simulerer en coach der lægger 5 uger ind via "Kopiér seneste uge →" uden
  selv at røre datofeltet.
  - Uger med dato — **før**: 1/5 (kun uge 1, fra dengang `+ Ny uge` allerede
    prefillede), **efter**: 5/5.
  - `beregnPlanlagtDenneUge` (`src/volume/planlagt.js`, ordre 185): før gav
    `ugePlaceret: false` for den aktuelle uge → VolumenKort viser "–"; efter
    gav `ugePlaceret: true` med `grupper.kneeExtensors: { direkte: 4, ialt:
    4 }` → VolumenKort viser et tal.

## Hvad er næste

- Et program hvor **ingen** uge overhovedet har en dato, har intet anker at
  regne fra — "Sæt datoer" vises slet ikke der (viser sig kun når mindst én
  daterede og én udaterede uge findes), og den allerførste uge i et nyt
  program falder fortsat tilbage til mandags-reglen, ikke en dato coachen
  eksplicit har bekræftet. For de fleste programmer er det uproblematisk
  (uge 1 er ofte "start mandag efter oprettelse"), men et program der er
  bevidst forskudt fra mandag kræver stadig ét manuelt tryk i den
  eksisterende "Rediger"-dialog.
- Har betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
  bedre") — retter direkte den vane-afhængighed min egen ordre 185-rapport
  pegede på som næste skridt, uden ny afhængighed eller skemaændring.

## Ærlige grænser

- **Målingen (før/efter 1/5 → 5/5) er en kode-simulation, ikke en optælling
  af Marcs rigtige, eksisterende programmer** — ordren forbyder
  produktions-Supabase og atletdata, så der findes intet lovligt grundlag
  for at måle den faktiske andel udaterede uger i hans virkelige data. Tallet
  beviser mekanismen (samme rene funktion, samme kald som appen bruger),
  ikke hvor meget det konkret løser for hans eksisterende programmer.
- `verify:ugen-faar-dato` dækker "Sæt datoer"-knappens fulde flow i
  browseren, men **ikke** `copyWeek()`s nye automatiske dato i browseren —
  kun via `weekDates.test.js`s rene funktionstest af selve reglen. Et
  fremtidigt e2e-tjek af selve "Kopiér seneste uge →"-knappen ville lukke
  det hul.
- `flexWrap`-rettelsen er verificeret visuelt (skærmbilleder ved 390px/
  1280px, ingen vandret scroll) og funktionelt (samme verify-script), men
  ikke performance-målt — ingen grund til at forvente en ændring (ingen ny
  render-sti), men det er ikke eftervist med `maal:*`.
- Ingen atletdata i filer eller rapport. `e2e/fixtures.mjs` er urørt (den
  nye verify-scripts egen seed bygges oven på `buildSeed()`, ikke ved at
  ændre den delte fixture). Ingen push, ingen produktions-Supabase, ingen
  skemaændring — `start_date`-kolonnen fandtes allerede.
