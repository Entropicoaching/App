# Rapport — Ordre 201: kæden før Dashboard

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`kaeden-foer-dashboard`, forgrenet fra `coachen-sporer-e2e-2` (ordre 200,
endnu ikke merget til `main` da denne ordre startede — `main` stod på
`08c8c0a`, ordre 193 og 192 merget, 200 ikke). To commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `acf8f95` | Hovedbundtets indhold + to afprøvede greb, ingen rettelser |
| 2 | `7cfe30d` | Rollen huskes lokalt, rolleopslaget blokerer ikke længere første tegning |
| 3 | (denne commit) | Måling efter + dom + rapport |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Baggrund:** ordre 193 fandt at ~5,6 af atletlistens ~5,8 sekunder ligger
FØR Dashboard.jsx monteres, i en ren sekventiel kæde: hovedbundtet (2,9s) →
App.jsx's rolleopslag (0,6s, venter på bundtet) → Dashboard-chunken (2,1s,
venter på rolleopslaget). Grænsen forbød at røre App.jsx dengang. Denne
ordre løftede netop den grænse.

**Commit 1 — hvad der reelt fylder.** Kortlagt hovedbundtet med
`rollup-plugin-visualizer` (midlertidig dev-afhængighed, `package.json`
urørt). `react-dom` dominerer (99 KB gzip, kan ikke undværes). Det ægte
fund: **`@supabase/supabase-js`s Realtime-klient (phoenix.js +
RealtimeChannel + RealtimeClient, ~18 KB gzip, ~13% af det gzippede bundt)
er ALDRIG brugt** — appen kalder kun `supabase.storage` (videoupload),
aldrig `.channel()`. Ikke fjernet denne ordre (kræver enten at røre
`src/supabase.js`, uden for de tilladte filer, eller at alias'e et
tredjepartsbibliotek i byggekonfigurationen — for risikabelt at gøre
sikkert på den tid der var til rådighed). Se `docs/VALG-201.md`.

**Commit 2 — to greb afprøvet fra "stå på skuldre"-listen, ét beholdt.**
Første kandidat (hent BEGGE lazy-chunks spekulativt, parallelt med
rolleopslaget) blev **målbart værre** — telefon-TTI 6005ms→7318ms — fordi
den throttlede mobilprofils begrænsede båndbredde deles mellem de to
samtidige chunk-hentninger; rullet tilbage med det samme. Anden kandidat
(rollen huskes lokalt fra sidste succesfulde opslag, med korrekt fallback
når den er forkert) blev implementeret: `localStorage` gemmer rollen pr.
bruger-id efter hvert succesfuldt opslag; et cachet gæt viser den gættede
visning MED DET SAMME, mens det ægte opslag stadig bekræfter/retter i
baggrunden. En dedikeret waterfall-diagnose bekræftede MEKANISK at
Dashboard-chunken nu begynder at downloade ~250-700ms tidligere — men den
aggregerede TTI-måling (Lighthouses simulerede throttling) viste ingen klar
ændring. Se `docs/VALG-201.md` for hvorfor.

## Testresultat

**Tabel — før/efter, telefon 390px**, median af 3 løb:

| Skærm | TTI FØR | TTI EFTER | Dom |
|---|---|---|---|
| Atletliste (coach) | 6005ms | 5994ms | "Føles som en hjemmeside der loader" (uændret) |
| Dagens pas (atlet) | 6140ms | 6139ms | "Føles som en hjemmeside der loader" (uændret) |
| Check-in (atlet) | 6136ms | 5991ms | "Føles som en hjemmeside der loader" (uændret — inden for normal støj) |

De øvrige skærme (Check-in-gennemgang, Atletens uge, Videoer, Indbakke,
Login, Videocoach-forside, Sæt-logger) er urørt og forbliver som før —
"føles som et værktøj" hvor de allerede gjorde det.

**Min egen dom:** uændret på begge sider. Kæden er verificerbart brudt
(chunken starter tidligere), men det slår ikke igennem i de tal målingen
kan vise pålideligt. Se "Ærlige grænser" for hvorfor jeg stadig beholder
rettelsen.

**npm run lint:** rent gennem begge commits.

**Alle 31 `verify:*`-scripts:** grønne, inklusive
`verify:auth-logout-role-switch` (rollen ryddes korrekt ved log ud, ingen
regression i auth-flowet).

**npm run e2e:** grøn (24,0s).

**Målet (under 2s TTI for forsiden på telefonprofilen) er IKKE nået.**
TTI står ved ~6,0s, praktisk talt uændret. Hvad der stopper: se "Hvad er
næste".

## Hvad er næste

1. **Den bekræftede ~18 KB gzip døde Realtime-vægt** (commit 1's fund) —
   den mest konkrete, størrelsesmæssigt kvantificerede rest i selve
   hovedbundtet. Kræver enten (a) at erstatte
   `@supabase/supabase-js`-klienten i `src/supabase.js` med separate,
   allerede-installerede undermoduler (`@supabase/postgrest-js` +
   `@supabase/auth-js` + `@supabase/storage-js`), eller (b) en
   byggekonfigurations-alias der stubber `realtime-js` væk — begge kræver
   mere tid til at verificere sikkert end denne ordre havde.
2. **Hvorfor en bekræftet ~250-700ms tidligere chunk-start ikke slår
   igennem i TTI** — værd at forstå før flere greb af samme klasse
   forsøges. Mistanke: Lighthouses standard SIMULEREDE throttling (ikke
   `devtools`-metoden) bygger sin tidsmodel på en uthrottlet sides
   afhængighedsgraf, ikke en reelt throttlet afspilning — en ren
   JS-scheduling-forskel under ét sekund kan forsvinde i den model. Et
   fremtidigt forsøg burde måle med `throttlingMethod: 'devtools'`
   konsekvent, ikke kun i en ad hoc-probe.
3. **Tredje kandidat fra "stå på skuldre"-listen ("tunge moduler ud af
   hovedbundtet og ind i chunks")** — ikke afprøvet denne ordre (samme
   Realtime-fund som punkt 1 er den mest oplagte kandidat, og kræver
   samme afvejning).
4. Har betydning for Hara (mærkbart bedre-sporet): denne ordre lukkede
   IKKE hullet — men den GØR næste forsøg billigere: et konkret,
   størrelsesbestemt fund (Realtime-vægten) og en forklaret,
   ikke-gættet grund til hvorfor et mekanisk korrekt greb ikke viste sig
   i målingen.

## Ærlige grænser

- Jeg beholder commit 2's rettelse selvom den ikke flyttede nogen af de
  målte TTI-tal. Begrundelsen: den er BEVIST mekanisk korrekt (en
  dedikeret, devtools-throttlet waterfall viser chunken starte tidligere),
  sikker (ingen regression i lint/e2e/verify, `auth-logout-role-switch`
  specifikt grøn), og retter en reel, unødvendig ventetid — selvom
  værktøjerne her ikke kan bevise gevinsten i et enkelt TTI-tal. Jeg har
  ikke skjult at TTI-tallet er uændret.
- Det FØRSTE greb (spekulativ parallel-hentning af begge chunks) er det
  klareste, mest håndgribelige fund i hele denne ordre: en idé der lød
  rigtig på papiret (og som JEG selv skitserede i ordre 193's rapport)
  var reelt en regression under båndbredde-begrænsning. Nævnt fuldt ud,
  ikke pyntet på.
- Jeg har ikke haft tid til at verificere om `@supabase/supabase-js`s
  Realtime-klient sikkert kan fjernes uden at bryde noget — kun at den
  ALDRIG kaldes nogen steder i `src/`. En fremtidig ordre der forsøger
  det bør stadig køre den fulde `verify:*`-suite og `npm run e2e` efter,
  ikke antage at "ikke brugt i kildekoden" er nok bevis alene.
- Målt mod `e2e/mock-supabase.mjs` (lokal mock), 45 attrap-atleter, samme
  metode og samme begrænsning som hele denne målingsserie (175→184→190→
  193→200→201).
- Denne session har kørt uafbrudt gennem seks ordrer (175-stilen
  målingsserien plus e2e-forsøgene) — muligt bidrag til den målestøj der
  gjorde et under-1-sekunds greb svært at bekræfte i aggregerede tal. Ikke
  bekræftet som årsag, kun nævnt som en rimelig mistanke.
