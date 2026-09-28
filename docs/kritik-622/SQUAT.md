Kapitel 6 på squat bedre: ja. Squat-artiklen klar til Marcs læsning: ja

# Kritik 622, blok 1: squat-artiklens kapitel 6 efter Setus 615 (Bhishak)

## Hvad jeg målte

- **Sitet:** `udgivelse-squat-min-krop` @ `9ae75d5` (Setus 615: `2b0f368` og `9ae75d5`) og `f3c1684` (kapitel 6 før 615). Begge er hentet med `git archive` fra `entropi-coaching-site-wt2`, og træet er ikke rørt. Linjenumrene nedenfor er `artikel-squat.html` på `9ae75d5`.
- **Læst to gange:** som en kyndig træner (tallene, båndet og om kapitlet siger det, det lover) og som en nysgerrig løfter (kan jeg følge det på telefonen?). Kapitel 6 (484-542) og Forbehold (709-714) er læst fuldt. Jeg-formen og reglerne er tjekket i hele artiklen.
- **`outputs/kritik-622/squat-622.mjs`:** 19/19 grønne. Google Chrome headless på 390 med touch og 1280 med mus. Alt net uden for den lokale server er afbrudt, også Google Fonts. `LAES-SQUAT.html` er åbnet som `file://`. Resultater i `squat-622.json`, skærmbilleder `Q-*.png`.
- **`outputs/kritik-622/k6-enkelt-622.mjs`:** samme løftmodel-kopi og samme 200 seeds × 5 klik som Setus `k6-robust.mjs` (kun læst). Den tjekker to ting:
  - Alle 50 tal og 20 domme i de to tabeller er `k6-robust.json`'s inden for afrunding: 0 afvigelser.
  - Hvor tit ét klik, som en læser selv laver i Mål dit billede, giver samme "inden for"/"uden for" som tabellen, med Setus bånd (én klikspredning) og med to klikspredninger (`k6-enkelt-622.json`).

## Er kapitel 6 på squat bedre end det gamle på dødløft?

**Ja, og mere end i 613.** Q1-Q7 er rettet, og kapitlet har fået Marcs stemme tilbage.

- **Q1 lukket.** På 390 er tabellerne 350 px i en ramme på 350 px, med tre kolonner (Led 112, Kun knæene 119, Modellens squat 119 px). Ingen celle ligger uden for, og intet ruller. På `f3c1684` var de 640 px. "Kun knæene" er anden kolonne. Skærmbilledet (`Q-390-ny-k6.png`) kan læses.
- **Q2 lukket.** Ingen "alle fem/ti klik". Tabellernes tal er kameraets billede uden klikfejl, og dommen står som en andel (999 og 852 af 1000). Tallene er de samme som min 613-kørsel. Men båndet har fået en ny svaghed (R1).
- **Q3 lukket.** Svarlinjen (487) er et fund. Første afsnit (488) er i jeg-form og bruger Marcs egne sætninger: "I bevægelsen følger jeg mest stangen i forhold til skulder, hofte og knæ" står ordret i linje 145, midtfoden i linje 57 og 171, og "de to fejl jeg ser oftest" i linje 692. Titlen er uændret, og det er Marcs valg.
- **Q4 lukket.** Kapitlets brødtekst, tabeltekster og "Gå dybere" har intet forbehold. Forbehold nederst (712) har alle fem: "ikke en løfter", "ikke hvad en bestemt løfter gør", "inden for betyder ikke, at modellen rammer", klikfejlen og ét kamera, og usikkerheden i målingen. Det eneste, der er gået tabt, er 607's tolkning ("hvor de mødes, siger det noget om geometrien"). Den var ikke et forbehold.
- **Q5 og Q6 lukket.** Kapitlet siger "Den orange streg er midtfoden" (492), og sætningen om "står lavere" er slettet.
- **Q7 lukket.** LAES-SQUAT viser de to kapitler i 2,95x på 390 og 3,13x på 1280. De står under hinanden på telefonen og side om side på 1280, og teksten siger det. Det nye skærmbillede er `9ae75d5`'s kapitel (første linje er fundet, og Gyldighed er ude af "Gå dybere").
- **Tallene hænger sammen med kapitel 7.** Kun knæene i bunden måler 29,6°, 46,4°, 39,8°, 2,9 cm og 15,7 cm. Kapitel 7's figur siger knæ 30°, hofte 47°, torso 40°, 2,9 cm og 15,7 cm. Det passer bedre end 613's gennemsnit af fem klik.

For en nysgerrig løfter er kapitlet nu kortere (831 ord mod 1010) og kan læses på telefonen. Første afsnit siger, hvad Marc kigger efter, og derefter, at billedet er modellens. En kyndig træner ser stadig, at det er en selvtest. Men det står nu ærligt i teksten, og en squat, der passer i artiklen, er stadig bedre end et dødløft, der ikke gør.

## Jeg-formen

- **Holder hele vejen:** 0 "Marc"/"Marcs" i den synlige tekst før forfatterlinjen (41-748), på både 390 og 1280. Det eneste "Marc" er forfatternavnet.
- **Kapitel 6 har jeg-form igen** i linje 488 ("følger jeg", "mit eget klip", "jeg ser oftest").
- **Setus spørgsmål 1 (kun Marcs egne udsagn?):** tre af de fire er Marcs egne. "Indtil mit eget klip fra siden er klar" er ikke. Det er et løfte i Marcs navn, som står i Dhruvas ordre ("indtil Marcs eget klip kommer") og i kildekommentaren FILM-KLIP, men ikke i noget, Marc selv har skrevet. LAES-SQUAT nævner det for Marc ("siger, at billedet er modellens, indtil dit eget klip er klar"), men spørger ham ikke. Se R5.

## Brud på skrivereglerne

- **Tankestreger:** 0 i den synlige tekst. "2,2-2,9°" er en bindestreg.
- **Dramatisk åbning:** ingen. Kapitlet åbner med svarlinjen.
- **Atletnavne:** ingen.
- **Opfordringer:** ingen i kapitel 6. Linje 398 ("Skriv dine egne mål ind") er uændret og er valg 1 i LAES-SQUAT.
- **Meta om struktur:** "Metoden vises her" er ude. Linje 488's "De seks punkter i Mål dit billede er ..." beskriver værktøjet, ikke kapitlet, og er i orden.
- **Forbehold oppe i teksten:** ingen i kapitel 6 (se Q4).
- **Sprog:** svarlinjen (487) "Målingen skiller kun knæene fra ..." kan læses, som om målingen kun skiller knæene. "måler modellens egen squat som modellen" (507, 526) er tungt. Formuleringen i 487 er min egen fra 613 (R6).

## Figurerne på 390 og 1280 uden net

- **Figurerne:** begge SVG'er indlæses. De er 324 px brede på 390 og 230 px på 1280. Der er 0 JS-fejl, 0 fejl 404 og ingen sidelæns rulning. Det eneste afbrudte kald er Google Fonts, og så falder skriften tilbage.
- **Tabellerne:** 350/350 px på 390 og 656/656 px på 1280. De ruller ikke.
- **Skriften på 390** er 10,9 px for tallene og 10,2 px for afvigelsen og modellens tal, mod 15,5 px i brødteksten. Det kan læses i skærmbilledet, men det er i underkanten (R4, Setus spørgsmål 3).
- **Uden en modelkolonne:** modellens tal står under leddets navn ("model 48,5°"), og hver celle viser afvigelsen. Det er klart nok.

## Viser LAES-SQUAT.html gammel og ny, så Marc kan vælge på mobilen?

**Ja:**
- Boksen øverst har begge svarlinjer og nævner `2b0f368` og `9ae75d5`.
- Begge kapitler er skarpe skærmbilleder, der kan rulles, og det nye er `9ae75d5`'s.
- Der er 0 JS-fejl og ingen sidelæns rulning på 390 og 1280.
- Afsnittet "Bhishaks fund og hvad der er gjort" står under dem.

**Svagheder:**
- Valg 2 (U6, kapitel 6's første linje) har ikke fået det nye kapitel med. Boksen "Dit spørgsmål 28. sep" siger stadig: "Med den nye udgave er linjen Metoden vises her på en low bar-squat., og 607's udgivelsesscript beholder den". Den linje findes ikke længere, og udgivelsen bruger 615's script (R3).
- "Hele artiklen" nederst har stadig den gamle kapitel 6, og det står der. Forbehold nederst i den nye udgave kan ikke ses på siden. Kun listen Q4 beskriver det.

## Fund

| Fund | Alvor | Hvad | Hvad Setu gør |
|---|---|---|---|
| R1 | middel | "Inden for" betyder nu, at billedet uden klikfejl er højst én klikspredning fra modellen. Men en læser, der klikker sit eget billede én gang, får klikfejlen med. Så giver ét klik samme dom som tabellen i 66-70 % af tilfældene for hvert tal på modellens egen squat, og alle fem stemmer kun ved 19 % (bund) og 21 % (sticking point). "Måler som modellen på alle fem tal" passer altså til kameraet, ikke til en læsers klik. Hoften for kun knæene ved sticking point (-2,7° mod 2,9°) stemmer ved 49 %, altså plat eller krone (Setus spørgsmål 2). Med båndet sat til to klikspredninger ændres ingen af de 20 domme i tabellerne. Ét klik stemmer så ved 94-96 % pr. tal og alle fem ved 80-81 % (kun knæene ved sticking point 77 %, hoften 86 %). | Sæt båndet til to klikspredninger (4,5-5,9° på vinklerne, 2,0 cm og 2,5-2,7 cm på stangen), og skriv i tabelteksten: "'Inden for' betyder inden for to gange spredningen af ét klik, hvor ca. 95 % af enkelte klik lander." Ret tallene i "Båndet" (533). Cellerne, farverne og dommene er de samme. |
| R2 | lav | "Runder" betyder to ting. "999 af 1000 runder klik" (507, 526) og "de 2000 runder" (535) er ét klik, men "i 200 runder af fem" (533) er fem klik. | Skriv "ved 999 af 1000 klik" (507, 526, 535) og "i 200 serier af fem" (533). Ret også LAES-SQUAT's "999 af 1000 runder klik". |
| R3 | lav | LAES-SQUAT valg 2 (U6) siger stadig, at den nye linje er "Metoden vises her på en low bar-squat." og henviser til 607's script. | Skriv, at med ny er linjen fundet i 487, og at 615's `UDGIV-SQUAT.ps1` beholder den ved `-U6 forslag`. |
| R4 | lav | På 390 er afvigelsen og modellens tal i tabellerne 10,2 px (.64rem), mod 15,5 px i brødteksten. Det kan læses, men det er småt på en telefon. | Eventuelt `.mom-model` til .7rem under 480 px. Der er plads, for kolonnerne er 112-119 px, og den længste tekst ("-16,6°, uden for") fylder ca. 105 px. Mål igen. |
| R5 | lav | "Indtil mit eget klip fra siden er klar" (488) er et løfte i Marcs navn, som han ikke selv har skrevet. Kommer klippet aldrig, står løftet i den udgivne artikel. | Spørg Marc direkte i LAES-SQUAT (fx `squat klip: ja/nej`). Siger han nej, bliver sætningen til "Billedet her er modellens egen tegning af en low bar-squat, ...". |
| R6 | lav | Svarlinjen (487) "Målingen skiller kun knæene fra ..." kan læses, som om målingen kun skiller knæene. "Måler modellens egen squat som modellen" (507, 526) er tungt. | Fx "Målingen skiller fejlen kun knæene fra modellens squat på ..." og "I bunden giver modellens egen squat modellens tal på alle fem." Linje 487 er Marcs valg (valg 2). |
| R7 | lav | Farverne: "inden for" er orange og "uden for" grå. Det er kontrolkolonnen (modellens squat, orange hele vejen ned), der lyser, ikke det, kapitlet finder. "44 min. læsning" (48) er ikke regnet om (Setu siger det selv). | Valgfrit: byt farvelogikken i kapitel 6, så "uden for" er fremhævet. Regn læsetiden om ved udgivelsen. |

## Setus fem spørgsmål

1. **Jeg-formen i 488:** tre af de fire er Marcs egne ord. "Indtil mit eget klip" er ikke (R5).
2. **"Inden for spredningen af ét klik":** rimelig for kameraet, for mild for en læsers eget klik (R1). Med to klikspredninger står alle domme, og de holder for et enkelt klik.
3. **Tabellerne på en telefon:** de kan læses i headless på 390, og tre kolonner er klart nok. Skriften er i underkanten (R4). Ikke set på en rigtig telefon.
4. **Forbehold nederst:** rummer alt, hvad der var forbehold i kapitel 6 (Q4).
5. **Instagram:** se `INSTAGRAM.md`.

## Ærlige grænser

- Headless Chrome på Windows, ikke en rigtig telefon.
- `k6-enkelt-622.mjs` bruger Setus kopi af løftmodellen (`setu-607/lm`) og hans kamera, klikfejl og seeds. Den viser, hvor tit ét klik giver tabellens dom, ikke om modellen er rigtig.
- Tallet ved to klikspredninger (ca. 95 %) er målt for modellens egen squat. For kun knæene ved sticking point ligger hoften -2,7° fra modellen og giver derfor færre (86 %).
- "Bedre" og "klar til læsning" er min dom. Marc vælger. R1-R7 blokerer ikke hans læsning, men R1 bør rettes før udgivelsen.
- Ingen push, ingen merge, ingen sub-agenter og ingen rigtige atleter eller klip.
