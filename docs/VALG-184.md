# Valg — Ordre 184: hvilke fravalgte punkter tages op

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Alle punkter fra de to fravalgt-lister, vurderet

| # | Punkt | Kilde | Gevinst | Pris | Valgt? |
|---|---|---|---|---|---|
| 1 | Atletlistens ~5,8s TTI | FRAVALGT-175 #1 | Størst kendte flaskehals på coachens hyppigst brugte skærm | Kræver en ægte omlægning af HVORNÅR Dashboard.jsx henter sine data | **Nej — denne ordres egne grænser forbyder eksplicit "ingen omskrivning af Dashboard"** |
| 2 | Atletliste top-25-visning | FRAVALGT-175 #2 | — | — | **Ikke relevant — allerede leveret i ordre 175 commit 2 (`e5c3e63`), lukket punkt** |
| 3 | `refreshCoachInbox()`s gentagne kald | FRAVALGT-175 #3 | Målt 11→1 netværkskald på Indbakke ved hurtige faneskift; samme mekanisme rammer FØRSTE sideindlæsning (se nedenfor) | Moderat — men en tidligere, tidsbaseret vagt gav en uforklaret rendering-regression (68ms→330-930ms) | **Ja — se nedenfor** |
| 4 | Videoer-fanens forudhentning | FRAVALGT-175 #4 | — | — | **Ikke relevant — allerede leveret i ordre 175 commit 2 (`e5c3e63`), lukket punkt** |
| 5 | Videocoach-forsidens resterende ~3,5s FCP | RAPPORT-167 | Reelt, men kræver at splitte sidens skal fra selve sporingsmotoren | Rører sporingskode | **Nej — denne ordres grænser forbyder eksplicit "videocoachens sporingskode"** |
| 6 | Logins resterende ~3s FCP (preconnect-teknik) | RAPPORT-167 | Ukendt — kunne ikke ærligt efterprøves i 167 heller | Kræver et ægte, sikkert Supabase-testmiljø; denne ordre kører stadig kun mod `e2e/mock-supabase.mjs` (localhost) hvor en preconnect intet beviser | **Nej — samme måleproblem består, ingen ny infrastruktur bygget her** |
| 7 | De tre harness-skærmes ægte tal | RAPPORT-167 | — | Samme infrastrukturkrav som #6 | **Nej — samme grund som #6** |

## Konklusion

Af de syv dokumenterede punkter er **kun ét** (#3) reelt handlingsbart inden for
denne ordres grænser lige nu: #1 og #5 er eksplicit forbudt af grænserne,
#2 og #4 er allerede leveret, og #6/#7 kræver et testmiljø jeg hverken har
eller må bygge her (ingen produktions-Supabase, intet nyt).

Under undersøgelsen af #3's mekanisme (`refreshCoachInbox()`) fandt jeg at
det samme problem rammer **hver eneste sideindlæsning**, ikke kun hurtige
faneskift: `fetchAthletes()`s egen efterslæb-kæde (linje ~820) kalder
`fetchLatestMessages(athleteIds)` — og den effekt der styrer
`refreshCoachInbox()` (linje ~736) kalder PRÆCIS samme funktion igen, lige
efter, fordi appens startvisning altid er enten `'list'` eller `'inbox'`
(`coachInboxEntryIntent()` har ingen tredje mulighed). Beskeder hentes derfor
altid to gange for alle atleter ved hver eneste login/genindlæsning — et rent
duplikat, ikke en tab-skifte-relateret race, og en tryggere delmængde af #3's
problem end den tidsbaserede vagt der gav regressionen sidst.

Leveres derfor som **to separate, selvstændigt målte rettelser** (samme
grundpunkt, to forskellige duplikat-mekanismer):

- **Commit 2:** fjern det faste duplikat ved sideindlæsning (billig, sikker —
  ingen ny tilstand, ingen tidsvindue, kun én overflødig funktionskald
  fjernet).
- **Commit 3:** genforsøg den tidsbaserede vagt mod faneskift-duplikatet, med
  en anden teknik end sidst (spring helt over FØR nogen `setState` kaldes,
  så et sprunget-over kald ikke selv udløser gen-renderinger) — måles
  isoleret; ruller tilbage igen hvis samme regression viser sig, jf. ordrens
  egen regel ("ramme du noget der kræver en større ændring, byg den ikke").

## Grundlag: dagens måling (før nogen rettelse)

`npm run maal:coach-telefon` kunne ikke køre grønt før denne ordre —
scriptets "Indbakke"-skærm brugte to tekst-selektorer
(`getByText('Indbakke', ...)`, `getByText('Vigtigst nu', ...)`) fra FØR ordre
171 omdøbte både sidebar-label og sidehoved til "Coach Briefing" (allerede
merget til main før denne ordres base). Rettet i `scripts/maal-coach-telefon.mjs`
til nuværende tekst (se selve diffen) — ren målescript-vedligehold, ingen
ændring i selve målemetoden. Se `outputs/maal-coach/2026-09-14.json` og
`outputs/maal/2026-09-14.json` for de fulde rå tal.

| Skærm (telefon) | FCP/render | TTI | Netværkskald | Dom |
|---|---|---|---|---|
| Atletliste | 3782ms | 5970-6020ms | 40 | "Føles som en hjemmeside der loader" |
| Check-in-gennemgang | 71-417ms (render) | n/a | 6 | "Føles som et værktøj" |
| Atletens uge | 51-225ms (render) | n/a | 0 | "Føles som et værktøj" |
| Videoer | 96-938ms (render) | n/a | 14 | "Føles som et værktøj" |
| Indbakke (Coach Briefing) | 66-503ms (render) | n/a | 11 | "Føles som et værktøj" |

`npm run maal:telefon` (atletens side, regressionstjek — røres ikke af denne
ordre): grøn, se `outputs/maal/2026-09-14.json`.
