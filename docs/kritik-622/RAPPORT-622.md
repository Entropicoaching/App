Ordre 622: efterkritik af Setus 615, squat-artiklens kapitel 6 (Q1-Q7) og Instagram 2 og 3 (Bhishak)

**Domme:**
- **Kapitel 6 på squat bedre: ja.**
- **Squat-artiklen klar til Marcs læsning: ja.**
- **Instagram 1-6 klar til Marcs godkendelse: ja.** Ingen numre skal rettes. I7 (nr. 3's fodnote) er en lille valgfri rettelse.

## Gren

Grenen er `kritik-622`, lavet fra `main` @ `55b7e2a` (merge af kritik-617) i `entropi-app-kritik`. Ingen push, ingen merge og ingen sub-agenter. Filer kun under `docs/kritik-622/` og `outputs/kritik-622/`.

- Commit 1 `fef7204` kritik 622 blok 1: squat-artiklens kapitel 6 efter Setus 615.
- Commit 2: kritik 622 blok 2, Instagram og denne rapport. Hashen står i `git log`.

Målt på:
- **Sitet:** `udgivelse-squat-min-krop` @ `9ae75d5` (Setus `2b0f368` og `9ae75d5`) og `f3c1684` (før 615), hentet med `git archive`. `entropi-coaching-site-wt2` er ikke rørt.
- **Setus 615:** `ordrer/kilder/setu-615/` (`RAPPORT-615.md`, `k6-robust.json`, `foer-606/`) og løftmodel-kopien `setu-607/lm`, kun læst.
- **Instagram:** `ordrer/kilder/setu-606/` og `Desktop/LAES-INSTAGRAM.html`, kun læst.
- **LAES-SQUAT:** `Desktop/LAES-SQUAT.html`, kun læst.

## Hvad ændret

Intet på sitet, i løftmodellen, i Setus filer eller på læsesiderne. Kun mine målinger og dokumenter.

### Blok 1: squat (`docs/kritik-622/SQUAT.md`)

**Q1-Q7 er lukket.**
- Tabellerne er 350/350 px på 390, og ingen celle ligger uden for rammen.
- Der står ingen "alle fem klik" længere. Dommen står som 999 og 852 af 1000.
- Svarlinjen er et fund.
- Kapitel 6 har jeg-form igen med Marcs egne sætninger (145, 57/171, 692).
- Forbehold nederst rummer alle fem forbehold fra kapitlet.
- Midtfoden er orange, og "står lavere" er ude.
- LAES-SQUAT er skarp (2,95x) og står under hinanden på telefonen.
- Alle 50 tal og 20 domme i tabellerne er `k6-robust.json`'s.
- Jeg-formen holder hele vejen, med 0 "Marcs" og 0 tankestreger.

**Nye fund:**
- **R1 (middel):** "Inden for" er nu én klikspredning om kameraets billede uden klikfejl. Et enkelt klik, som det en læser selv laver, giver tabellens dom på alle fem tal for modellens egen squat ved kun 19-21 %. Hoften for kun knæene ved sticking point stemmer ved 49 %.
  - Med to klikspredninger ændres ingen af de 20 domme.
  - Ét klik stemmer så ved 94-96 % pr. tal og 77-90 % på alle fem.
- **R2-R7 (lav):**
  - R2: "runder" bruges i to betydninger.
  - R3: LAES-SQUAT's valg 2 er forældet (nævner den gamle linje og 607's script).
  - R4: tabellernes små tal er 10,2 px på 390.
  - R5: "Indtil mit eget klip fra siden er klar" er et løfte, Marc ikke selv har skrevet.
  - R6: svarlinjens "skiller kun knæene" kan læses to veje.
  - R7: farvelogikken fremhæver kontrolkolonnen, og "44 min." er ikke regnet om.

### Blok 2: Instagram (`docs/kritik-622/INSTAGRAM.md`)

- **I1, I2, I3 og I5 er lukket.**
  - Nr. 2: skulderen holder ca. 54 % mindre, og hofte, lænd, knæ og ankel holder mere. Slide 5 starter med "Modellen har ingen muskler".
  - Nr. 3: "ca. 10 cm kortere", og den ulæselige sætning er ude. "Skub fra benene" står i stedet for "leg drive". Bænkene er ca. 140 px i 360 px, og buen kan ses.
- 1, 4, 5 og 6 er ikke rørt. Alle seks har 0 regelbrud.
- LAES-INSTAGRAM viser alle 24 nuværende PNG byte for byte.
- **I7 (lav, ny):** fodnoten "middel svagt bagved" på nr. 3 passer ikke til det nye layout.
- I4 og I6 står åbne som valgfri.

## Testresultat

| Kommando | Resultat |
|---|---|
| `node outputs/kritik-622/squat-622.mjs` | 19/19 grønne |
| `node outputs/kritik-622/k6-enkelt-622.mjs <artikel-squat.html på 9ae75d5>` | 200 seeds × 5 klik. Artiklen mod `k6-robust`: 0 afvigelser (`k6-enkelt-622.json`) |
| `node outputs/kritik-622/insta-622.mjs` | 14/14 grønne |
| `node outputs/kritik-622/verify-kritik-622.mjs --blok 1` | grøn |
| `node outputs/kritik-622/verify-kritik-622.mjs --blok 2` | grøn |
| `npm run lint` | grøn |

## Hvad er næste

- **Marc:**
  - Vælger `squat kapitel 6: ny` eller `gammel` i LAES-SQUAT.html. Min anbefaling er ny.
  - Svarer `instagram ok 1-6`.
- **Setu retter på `udgivelse-squat-min-krop`, hvis Marc vælger ny (før udgivelsen, ikke før Marcs læsning):**
  - **R1:** båndet bliver to klikspredninger (4,5-5,9° på vinklerne, 2,0 cm og 2,5-2,7 cm på stangen). Tabelteksten siger: "'Inden for' betyder inden for to gange spredningen af ét klik, hvor ca. 95 % af enkelte klik lander." "Båndet" (533) rettes. Cellerne og dommene er de samme, og `k6-enkelt-622.mjs` viser det.
  - **R2:** "ved 999 af 1000 klik" (507, 526, 535) og "i 200 serier af fem" (533), også i LAES-SQUAT.
  - **R3:** LAES-SQUAT valg 2: med ny er linjen fundet i 487, og 615's `UDGIV-SQUAT.ps1` beholder den.
  - **R5:** spørg Marc i LAES-SQUAT, om løftet "Indtil mit eget klip fra siden er klar" må stå. Siger han nej, bliver det til "Billedet her er modellens egen tegning af en low bar-squat, ...".
  - **R4, R6 og R7 (valgfri):** `.mom-model` til .7rem under 480 px, "fejlen kun knæene" i 487 og "giver modellens tal" i 507/526, og læsetiden regnet om ved udgivelsen.
- **Setu retter i Instagram (valgfrit):** I7, nr. 3's fodnote til "lille og stor i blåt, middel i gråt". Kør derefter `node lav.mjs 3` og `node laeseside.mjs` igen.
- **Yantra (uændret fra 607):** jeg-formen skal ind i løftmodellens `maaltOverModel.js`. Hvis R1 tages, skal båndet i `k6-robust.mjs`/Mål dit billede følge med.
- **Hara (Coaching-planeten, spor løftartikler):**
  - Squat-artiklen er klar til Marcs læsning og valg af kapitel 6. Én middel rettelse (R1) bør ind før udgivelsen.
  - Instagram-serien er klar til Marcs godkendelse.

## Ærlige grænser

- Alt er målt i headless Chrome på Windows, ikke på en rigtig telefon og ikke i Instagram.
- `k6-enkelt-622.mjs` bruger Setus løftmodel-kopi, kamera, klikfejl og seeds. Den viser, hvor tit ét klik giver tabellens dom, ikke om modellen er rigtig.
- Tallene i dødløft- og bænkopslagene er ikke regnet igen i løftmodellen.
- "Ikke rørt" for Instagram 1, 4, 5 og 6 er målt på filernes tid, ikke byte for byte, for der findes ingen kopi fra før 615.
- "Bedre" og "klar" er min dom. Marc vælger.
- Hele squat-artiklen er ikke læst fagligt forfra. Kapitel 6 og Forbehold er læst fuldt, og jeg-formen og reglerne er tjekket i hele artiklen.
- Ingen push, ingen merge, ingen sub-agenter og ingen rigtige atleter eller klip.
