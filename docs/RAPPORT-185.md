# Rapport — Ordre 185: volumen over tid, og Marc skal kunne rette den

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`volumen-over-tid`, forgrenet fra `main` (`26f2d7a`). Fire commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `3dc6f91` | `src/volume/planlagt.js` — planlagt mod gennemført for "denne uge" |
| 2 | `4379cab` | `src/dashboard/VolumenGraf.jsx` — udviklingsgraf, ingen graf-bibliotek |
| 3 | `2a0312a` | `src/volume/rettelser.js` + `KortlaegningRedigering.jsx` — Marc retter kortlægningen selv |
| 4 | `0592b53` | `docs/VOLUMEN.md` — to nye afsnit, skrevet til Marc |

Arbejdstræet er rent efter hver commit. Ingen push, ingen produktions-Supabase,
ingen migration, ingen atletdata (kun mockens attrapatlet "Testatlet").

## Hvad blev ændret

**Commit 1.** `beregnPlanlagtDenneUge(weeks, opts)`: planlagte sæt pr.
muskelgruppe for kalenderugen "nu" ligger i, talt fra programmet
(`weeks.start_date` → `sessions` → `exercises.sets`), samme
vægtning/kortlægning som de gennemførte sæt. Bevidst afgrænset til KUN
denne uge, ikke et helt vindue som de gennemførte sæts seks uger — en
programuge er ikke en kalenderuge, og de fleste uger har ikke
`start_date` sat (ordren selv beder om at vælge og notere, ikke spørge).
Uger uden `start_date` markeres `ugePlaceret:false`, så "planlagt" kan
vises som "–" i stedet for et vildledende "0". `VolumenKort.jsx` fik et
nyt "denne uge: gennemført/planlagt"-afsnit øverst, to tal side om side
pr. gruppe plus én linje om at forskellen kan skyldes at sæt ikke er
gennemført endnu, at programmet er ændret undervejs, eller at sæt er
sprunget over — ordrens egen ordlyd. `Dashboard.jsx` henter nu også
`weeks` for `oversigt`-fanen (udvidelse af den delte weeks+athleteLogs-
hentning fra ordre 175 — samme guard, ingen ekstra kald ved faneskift).

**Commit 2.** `VolumenGraf.jsx`: søjler for udviklingen de seneste otte
uger ("seks til otte", otte valgt som den mest oplysende ende — samme
princip ordre 177 selv brugte for sit "fire til seks"-valg). Ingen
graf-bibliotek, ingen ny afhængighed — almindelige `<div>`'er med
inline-højde. Hver muskelgruppe skalerer efter sin EGEN maks, ikke en
fælles skala, så en lille gruppe (biceps) ikke forsvinder ved siden af en
stor (knæ-strækkere). Layoutet er et responsivt grid (`auto-fill`), ikke
faste bredder — verificeret headless (Playwright) ved 390px og 1280px:
ingen vandret scroll på nogen af breddene, ingen browser-fejl.

**Commit 3.** `src/volume/rettelser.js`: gem/hent/fjern en rettelse pr.
øvelse, `localStorage` (samme injicerbare storage-mønster som
`readinessDraft.js`). `muskelkort.js`'s `slaaOevelseOp(navn, rettelser)`
slår nu Marcs rettelser op FØR den indbyggede kortlægning — en rettelse
vinder altid, og kan gøre en tidligere ukendt øvelse kendt. `beregn.js` og
`planlagt.js` giver `rettelser` uændret videre (udeladt = ingen rettelser,
opfører sig som før — bagudkompatibelt, ingen eksisterende test ændret i
sin egen forventning). `KortlaegningRedigering.jsx`: en lille modal på
kortet — vælg en kendt øvelse, en ukendt (klikbar liste bygget fra både
loggen og programmet), eller skriv et nyt navn; ret/tilføj/fjern
grupper og andele (kun PRIMÆR/MEDVIRKENDE, samme grænse som altid);
"Sat af Marc"-badge over for "Oprindeligt skøn". Round-trip verificeret
headless: gem en ny kortlægning → "Sat af Marc" vises → "Fjern
rettelse" → tilbage til udgangspunktet, ingen browser-fejl.
**Lagerbeslutning (noteret, ikke spurgt):** ordren forbød
Supabase-skemaændringer denne omgang, så rettelserne gemmes i
`localStorage` — den letteste holdbare vej appen allerede havde (samme
mønster som `entropi_my_athlete_id`). Den ærlige grænse: **ikke
synkroniseret mellem Marcs egne enheder**, og påvirker ikke atletens egen
visning. Hvad en rigtig løsning kræver er skrevet i både filens egen
kommentar og i `docs/VOLUMEN.md`.

**Commit 4.** `docs/VOLUMEN.md`, to nye afsnit: "Planlagt mod
gennemført — hvad det kan og ikke kan sige" (de tre mulige årsager til et
gab, og hvorfor "–" ikke er "0"), og en ny "Sådan retter du en
kortlægning" der erstatter den gamle "åbn `muskelkort.js`"-vejledning med
den nye UI-vej, inklusive lagergrænsen ovenfor.

## Testresultat

**npm run lint:** rent.
**node --test (alle `.test.js` under `src/`):** 184/184 grønne — 160 fra
`main`, 24 nye: `planlagt.test.js` (9, ny fil), `rettelser.test.js` (9, ny
fil), `beregn.test.js` (+1, rettelser-threading), `muskelkort.test.js`
(+5, rettelser-overlay).
**npm run e2e:** GRØN — "atlet → coach, ende-til-ende", 27,2s.
**Alle 31 `verify:*`-scripts + `verify:n8n`:** 32/32 grønne, inklusive
`verify:auth-logout-role-switch`, som ordre 177's rapport noterede som
fejlende på `main` dengang — den er rettet siden (af en anden ordre,
ikke denne), bekræftet grøn her.
**npm run build:** grøn, ingen kompileringsfejl.
**Headless browserverifikation** (Playwright, 390px telefon + 1280px
desktop, samme metode som `scripts/maal-*.mjs`): VolumenKort med de nye
afsnit renderer uden vandret scroll på nogen af breddene; redigerings-
modalens gem/vis-badge/fjern-flow kørt igennem uden browser-fejl.
Midlertidige verifikationsscripts og skærmbilleder er ikke committet
(kun brugt til at se resultatet, slettet efter brug).

## Hvad er næste

- Planlagt-tallet virker kun for uger med en sat kalenderdato
  (`weeks.start_date`) — mange programuger har den ikke. Næste naturlige
  skridt er ikke ny kode, men vane: sæt datoen når en uge lægges ind, så
  "planlagt" reelt kan vises.
- Rettelserne er browser-lokale. Vokser brugen af "Ret kortlægning" til
  noget Marc bruger fra flere enheder, er næste skridt en rigtig
  Supabase-tabel (skitseret i `docs/VOLUMEN.md` og i
  `rettelser.js`'s egen kommentar) — en fremtidig ordre, ikke denne.
- Kortlægningen i `muskelkort.js` dækker stadig kun ~30 øvelser (ordre
  177's egen grænse). Med "Ret kortlægning" kan Marc nu selv lukke
  huller løbende i stedet for at vente på en kode-ordre — men den
  indbyggede liste er ikke udvidet i denne ordre.
- Har betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
  bedre"): kortet gik fra "et øjebliksbillede coachen ikke kunne rette"
  til "en udvikling coachen kan se OG rette selv, når kortlægningen er
  forkert". Det var ordrens egen "hvorfor" — en kortlægning man ikke kan
  rette holder op med at blive brugt den dag den er forkert et sted.

## Ærlige grænser

- **Planlagt/gennemført dækker kun DENNE uge**, ikke et helt forløb — se
  begrundelse i commit 1 og `docs/VOLUMEN.md`. En coach der vil se
  planlagt-mod-gennemført hen over flere uger kan ikke det endnu.
- **Rettelserne er `localStorage`, ikke Supabase** — ikke synkroniseret
  mellem enheder, og en ryddet browser (eller privat vindue) mister dem.
  Bevidst grænse denne ordre, ikke en fejl — se commit 3 og
  `docs/VOLUMEN.md`.
- **Redigeringsvinduets "ukendte øvelser"-liste bygges fra det data der
  allerede er hentet** (den viste atlets logs + program) — den er ikke en
  global liste over alle ukendte øvelser på tværs af alle atleter. En
  øvelse der kun er ukendt hos en anden atlet dukker ikke op her, før
  Marc besøger den atlets oversigt.
- **Udviklingsgrafens søjler skalerer pr. gruppe**, ikke på en fælles
  skala — bevidst (ellers ville små grupper være usynlige), men betyder
  at søjlehøjder IKKE må sammenlignes visuelt mellem to forskellige
  rækker, kun inden for samme række. Nævnt i kortets egen fodnote.
- Ingen ny test af selve React-renderingen af `VolumenGraf.jsx`/
  `KortlaegningRedigering.jsx` som unit-tests (kun rene funktioner i
  `src/volume/*.test.js` er dækket der) — de to UI-komponenter er i
  stedet verificeret headless med Playwright, samme niveau `WeeklyTonnageChart`/
  `E1RMChart` i `AthleteView.jsx` allerede har (ingen af dem har heller
  dedikerede unit-tests).
