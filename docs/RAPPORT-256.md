# Rapport — ordre 256: live-appen efter pushen: målt, ikke antaget, og "gemmes på din konto" bevist

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `live-efter-push`, forgrenet fra `main` (`b1c3815`, live efter Marcs
push 16. sep — ordrens egen base). To commits (denne rapport er den tredje).
Arbejdstræet er rent. Ingen ændring i `src/` eller `public/`, ingen ny
afhængighed, ingen push, ingen atletdata. Ingen skrivning til
produktions-Supabase i nogen af de to commits.

## Hvad ændret

`scripts/maal-produktion.mjs` (uændret, genbrugt fra ordre 228) kørt mod
den nuværende live app (`b1c3815`, `https://app.entropicoaching.dk/`), 5
løb, telefon 390×844, devtools-throttling, frisk Chrome-proces pr. løb —
samme metode som 228. Login-/landingsskærmen er den eneste skærm der er
nåelig uden et ægte produktionslogin (samme grænse 131/210/228/248 hver for
sig har fundet): TTI 2090ms, hovedscript 101962B over ledningen (afkodet
359120B, ~28 % — gzip bekræftet igen). 228s sidste kendte produktionstal var
2204ms/121304B. Der findes ingen gemt TTI-måling af produktionen fra lige
før dette push (`21e1b2f`) — ordre 248 tjekkede kun konsolfejl og fejlede
netværkskald der (0 og 0), ingen Lighthouse-kørsel — så forskellen ovenfor
dækker hele 226-248-seriens ændringer, ikke isoleret Marcs seneste push, og
raden i `docs/MAALINGER.md` siger det sådan. Atletliste, Dagens pas og
Check-in kunne, som ved 131/210/228/248, ikke måles mod live — der findes
stadig ingen produktions-testkonto, og at oprette én er en
produktions-Supabase-skrivning ingen ordre (denne iberegnet) har mandat til.
For commit 2 ("gemmes på din konto") stoppede arbejdet ved samme
login-blokade, allerede før Volumen-vinduet kunne åbnes overhovedet — se
`docs/VALG-256.md` for den fulde begrundelse, tabellen over hvad der (ikke)
blev set, og et selvstændigt fund undervejs: `docs/OVERLEVERING.md` (ordre
239) sagde migration 209 endnu ikke var kørt mod produktion, mens denne
ordre selv antager den var kørt 15. sep — uafklaret herfra uden login, så
selv en bekræftet konto ville ikke alene have afgjort sagen.

## Testresultat

- **`npm run lint`:** rent.
- **Ingen `verify:*`-scripts rører dette område** (ingen kode ændret i
  `src/` eller `public/` — kun `docs/` og målingsoutput).
- **Produktionsmåling (`maal:produktion`, `b1c3815`, 5 løb, 390×844):**

  | Måling | TTI | Hovedscript over ledningen | Hovedscript afkodet |
  | --- | --- | --- | --- |
  | 228 (`162abc6`, sidste kendte produktionstal) | 2204ms | 121304B | 424917B |
  | 256 (`b1c3815`, i dag) | 2090ms | 101962B | 359120B |

- **Commit 2 (produktionslogin):** intet kørt — se `docs/VALG-256.md`s
  tabel ("hvad der blev set" = ingenting, ét trin ad gangen, med hvorfor).

## Hvad er næste

1. Atletliste, Dagens pas og Check-in er stadig ikke målt eller
   funktionstestet direkte mod live, og "Gemmes på din konto" er stadig
   ikke bevist mod produktion. Begge kræver en ægte produktions-coach-konto
   som ingen ordre må oprette uden Marcs direkte, navngivne godkendelse
   (jf. `AGENTS.md`, `docs/VALG-256.md`).
2. Om migrationen `exercise_muscle_overrides` faktisk er kørt mod
   produktion er uafklaret herfra — `docs/OVERLEVERING.md` sagde nej
   (ordre 239), denne ordre antager ja. Marc kan afgøre det selv med ét
   blik: åbn Volumen pr. muskelgruppe på telefonen, se om linjen siger
   "Gemmes på din konto" eller "Gemmes på denne enhed".
3. For Hara: ingen ny funktionel ændring for atleter i denne ordre — det er
   et målepunkt (produktionens TTI faldt yderligere efter Marcs push) plus
   en ærlig "kan ikke bekræftes herfra"-konklusion for muskel-rettelserne,
   ikke en forbedring i sig selv.

**Tre linjer til Marc:** Produktionen svarer hurtigere end sidst målt —
2090ms mod 228s 2204ms (−114ms), hovedscriptet 102 kB over ledningen mod
121 kB før. "Gemmes på din konto" er IKKE bevist mod live i denne ordre —
ingen produktions-testkonto findes, og det er uafklaret herfra om
muskel-migrationen overhovedet er kørt endnu. Tjek selv på telefonen: åbn
Volumen pr. muskelgruppe og se hvad linjen siger.

## Ærlige grænser

- Kun login-/landingsskærmen er reelt målt mod produktion. Atletliste,
  Dagens pas, Check-in og "Gemmes på din konto"-flowet er IKKE afprøvet mod
  live i denne ordre — samme stående blokade som 131/210/228/248: ingen
  produktions-testkonto findes noget sted i dette træ.
- Før/efter-tallet for login-skærmen (2204ms → 2090ms) er IKKE en isoleret
  måling af Marcs seneste push alene — der findes ingen gemt
  produktionsmåling for `21e1b2f` (kun en 0-fejl konsoltjek fra ordre 248),
  så tallet dækker hele serien siden 228.
- Om migration 209 (`exercise_muscle_overrides`) er kørt mod produktion er
  uafklaret herfra — `docs/OVERLEVERING.md` (ordre 239) og denne ordres
  egen antagelse modsiger hinanden, og uden produktionslogin kan ingen af
  delene bekræftes fra dette træ.
- Kun 5 løb pr. side, samme session, samme maskine — ikke en tidsspredt
  stikprøve (samme forbehold hele måleserien siden 226 selv navngiver).
