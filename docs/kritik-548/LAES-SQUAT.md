LAES-SQUAT hjælper Marc med at vælge: ja

Siden gør det, Marc bad om ("need to read what you think and compare it to existing"). Øverst står de tre svar, derefter de ni valg med Dhruvas anbefaling og Setus mening hver for sig, og så en sammenligning, der holder, når jeg tæller efter. Valgene er læst på 7,6 skærme på telefonen.

Tre ting bør Marc vide, før han svarer:
- **Valg 7 har ingen klar anbefaling.** "squat udgiv forslag" siger ikke, hvad der sker med forbeholdene.
- **Fire citater under "Dine stikord" er klippet midt i hans egen sætning, og et af dem er ikke hans ord.** Det står i afsnittet om Marcs ord.
- **Artiklen siger stadig "seks fejlbilleder i alt", men modellen har otte** (min U18 fra 540). Det står ikke på siden.

Ingen af de tre ændrer, hvad Marc kan svare i dag.

# Kritik 548, blok 2: LAES-SQUAT.html som Marc ville læse den

Bhishak, 27. sep 2026. Ordre 548. Siden er `C:\Users\Entropi\Desktop\LAES-SQUAT.html` (Setu 543, 1,2 MB). Den er læst mod Setus `RAPPORT-543.md` og kilderne i `entropi-coaching-site`:
- `artikel-squat-marcs-ord` @ `915e57b`
- `udgivelse-squat-min-krop` @ `9390990`
- `origin/main` @ `8df8846` (16. sep)

Setus kopier i `ordrer/kilder/setu-543/kilder/` er lig `git show` af de tre, når linjeskift ses bort fra. Siden, sitet og løftmodellen er ikke rørt.

**Målingen:** `outputs/kritik-548/laes-548.mjs` → `laes-548.json` og `L-*.png`. Siden er åbnet headless uden net på 390 px med touch og 1280 px med mus, i lys og mørk tilstand. Scriptet tjekker også Marcs citater mod kilderne og tæller to af artiklerne selv. **16/16** tjek grønne. Tjekkene beskriver, hvad siden gør, også fundene.

## Som Marc læser den

| | 390 px | 1280 px |
|---|---|---|
| Hele siden | 83 skærme | 59 skærme |
| De ni valg slut | 7,6 skærme | 5,0 |
| Sammenligningen slut | 15,2 | 9,3 |
| Marcs ord slut, artiklen begynder | 23,5 | 14,9 |

- Ingen vandret rulning, intet net, ingen JS- eller konsolfejl, alle billeder indlæst, i lys og mørk.
- Brødteksten er 17 px med god luft (`L-390-top.png`). Siden kan læses i sengen, og beslutningen ligger i de første otte skærme. Artiklen (60 skærme) er til at slå op i, ikke til at læse igennem før svaret.
- **Lave fund:**
  - Etiketterne ("Nu", "Forslag", "Setu") er 11,5 px, tallene i parentes i sammenligningen 11,2 px og det mindste 10,9 px. Setus tjek siger mindst 12 px.
  - Etiketten "Nu" har kontrast 4,3 i lys tilstand (under 4,5), i mørk mindst 6,6.
  - De fire links i indholdsfortegnelsen er 20 px høje. De er let at ramme, fordi de står alene på hver sin linje.

## De ni valg

Hvert valg har først én sætning om, hvad det handler om, uden fagord. Det er det, Marc skal forstå. Under den står den rigtige tekst eller kode ("NU", "FORSLAG"). Dér er fagordene, og dér skal de være, fordi det er det, der ændres. Talt i valgene:
- "commit" 5, "assets/" 5, "outputs/" 3, "noindex" og "sitemap" 2, "datePublished", "src=", "kildekode", "vis kilde", "HTTP 200", "main" og "gren" hver 1, og de ni koder (U2 … U13, N1/V8).
- **Valg 3** siger "først må findes af Google fra den dag", og det forklarer noindex godt nok.
- **Valg 4 og 9** er rent tekniske: en mappe og to mapper på sitet. Marc kan ikke vurdere dem ud fra teksten og behøver det ikke. Siden kunne sige det: "Et teknisk valg; du kan sige ja til anbefalingen uden at læse det."
- **Koderne** (U2, U13 …) er Setus og mine arbejdsnavne. De skader ikke, men de hjælper heller ikke Marc.

## Dhruvas anbefalinger

| Valg | Anbefaling | Rimelig? |
|---|---|---|
| 1 Sætningen til Min krop | forslaget | Ja. Den fjerner den eneste opfordring |
| 2 Første linje i kapitel 6 | forslaget | Ja. Den nuværende lover en film, der ikke findes |
| 3 Datoen | dagen Marc siger ja | Ja |
| 4 Min krops mappe | assets/min-krop | Ja. Squat kan udgives uden værktøjssiden |
| 5 Titel og beskrivelse | behold | Ja. Setu siger ærligt, at begge er hans forkortelser |
| 6 "Marcs" eller "mit" | "mit" | Ja. Setus note om, at 183/120 så bliver Marcs krop, er det vigtigste på hele siden. Det svarer på min U19 fra 540 |
| 7 Forbehold i teksten | "behold, men flyt dem nederst, **hvis** de bryder reglen" | **Uklar.** Anbefalingen siger ikke, hvilke forbehold der bryder reglen. Så siger "squat udgiv forslag" ikke, hvad der sker med dem. Setu har en konkret plan (slet de to i indledningen, fjern de to om Marcs egen erfaring, behold resten). Artiklen på siden har ikke valg 7 med |
| 8 Ordrenumre i koden | egen commit | Ja. Setu tilføjer rigtigt, at Yantras filer også skal rettes |
| 9 outputs/ og scripts/ | fjern i egen commit | Ja. Tre af filerne svarede HTTP 200 i en tidligere kritik (ikke gentaget her) |

**Setus mening er tydeligt adskilt i valgene**, under sin egen etiket "SETU" efter "DHRUVA ANBEFALER". Den er enig i 1-6, 8 og 9 og delvist uenig i 7 med en grund.

Uden for valgene er den ikke mærket. I sammenligningen ("Det, der er svært: …") og i noterne under Marcs ord står Setus vurderinger uden etiket, fx "Mere præcist og tungere.", "Det er en stærkere påstand, end stikordet bærer" og "En faglig holdning, som ikke står i Marcs stikord". De er rimelige og nyttige, men Marc kan ikke se, om det er Setus eller Dhruvas mening. En linje øverst i de to afsnit ("noterne er Setus") ville løse det.

## Sammenligningen

Talt selv i samme browser på `8df8846`, med Setus definition (intro og artiklens krop uden folde og referencer):

| | Setu | Mig | Overskrifter (Setu / mig) | Tankestreger |
|---|---|---|---|---|
| Deload | 1.055 ord, 9 min. | 1.071 ord, "9 min. læsning" | 7 / 7 | Setu 6. Mig 7, hvoraf den ene er "30-50 procent" (et interval med tankestreg på sitet) |
| Hvad laver en coach | 696 ord, 7 min. | 701 ord, "7 min. læsning" | 6 / 6 | 1 / 1 |
| Squat 21. sep | 453 | 453 | | |

- Forskellen er under 2 % og kommer af tal: min ordregel tæller "30" og "10RM" med. **Tallene holder.**
- **Retfærdig?** Ja, med én præcisering. Siden siger "Ord er intro og brødtekst", men tallet tæller også overskrifter, figurtekster og tabeller med.
  - For de seks andre betyder det lidt (ingen figurer).
  - For squat er brødteksten alene 4.288 ord (Setus egen `maal-543.json`), ikke 5.510. Squat er altså ca. 5 gange så lang som de andre i brødtekst, ikke ca. 6.
  - Det ændrer ikke dommen "langt længere", men 5.510 og 453 er ikke brødtekst.
- Hvordan de seks åbner og slutter er citeret ordret (deload og coach kontrolleret).
- Den er fair i tonen: den siger både, hvad der virker (jeg-form, rolig åbning, dommernes krav til sidst), og hvad der er svært (12 gange så lang, det meste er modellen og litteraturen).

## Marcs egne ord

Alle 54 citater under "Dine ord mod den nye tekst" står ordret i deres kilde (`laes-548.json`, C):
- 7 "Dine stikord 13. sep" i `outputs/SVAR-squat.md` på `artikel-squat-marcs-ord`,
- 1 "Dine svar 26. sep" i ORDRE-Setu-398,
- 12 "21. sep" i artiklen på `915e57b`,
- 34 "Nu" i artiklen på `9390990`.

Men fire ting er ikke rigtige:

1. **Fire stikord er klippet, hvor kildens linje slutter, midt i Marcs sætning.** Setu citerer højst én linje, og memoet har linjeskift inde i sætningerne:
   - "… og hvilke positioner der tillader et" mangler **"konkurrencegodkendt squat."** Netop dét er Marcs pointe om konkurrencen. Og noten under siger "At de to trækker hver sin vej, er ikke i stikordene", mens det klippede stikord viser, at Marc satte følelse og konkurrence side om side.
   - "… der gør at man ikke kan have en fast" mangler "placering så langt nede."
   - "… hvad der fungerer for" mangler "atleten, og derefter bygge de svage punkter op."
   - "bias afsløres (fx med" mangler "goblet squat), …".
2. **Under "Forbehold" står som "Dine stikord": "Ikke besvaret. Modellens egne grænser står i løftmodellens dokumentation og må".** Det er Dhruvas note om, at Marc ikke svarede, og den er også klippet ("… må gengives derfra, uden at der lægges holdninger i munden på Marc."). Det er ikke Marcs ord.
3. **Kropstyper, "Står der stadig":** den nye sætning ("De tre kropstyper i panelet … er referencepunkter og ikke målte atleter") står over stikordet "Se hvad der føles bedre for atleten …". De handler ikke om det samme. Parret siger, at noget af Marc står der stadig, men det gør det ikke her.
4. **Svarene fra 26. sep** kaldes øverst "dine egne ord, skrevet ned af Dhruva". I ORDRE-Setu-398 står de under "Marcs svar (26. sep, ordret i substans …)" i tredje person ("Det han ser paa …"). De er Marcs indhold, men ikke hans ord. Setus rapport siger det, men siden gør ikke.

Det vigtigste står rigtigt: at indledningen er stærkere end stikordet ("oftere … end til fremgang"), at "trial and error" og "ingen fast regel" er væk, og at to forbehold er sat på Marcs egen erfaring.

## Det siden ikke fortæller

- **Valg 7 ved "squat udgiv forslag":** hvad der sker med de 15 forbehold og 12 kildemærker "Modelvalg" i teksten. Anbefalingen er betinget, og forhåndsvisningen har ikke valg 7 med.
- **"Seks fejlbilleder i alt"** står stadig i kapitel 7's fold ("Modellen har registreret seks fejlbilleder i alt"), mens modellen har otte (min U18 fra 540). Det er en faktafejl i den tekst, Marc siger ja til, og den er ikke et af de ni valg.
- **At citaterne er klippet** (se ovenfor), og at et "stikord" er Dhruvas note.
- **At "udgiv" ikke udgiver med det samme:**
  - `UDGIV-SQUAT.ps1` kræver, at sitets træ står på `udgivelse-squat-min-krop` (i dag `vaerktoejer`),
  - valg 6 og 8 kræver Yantra,
  - valg 8 og 9 er egne commits først.

  Det står i Setus rapport, ikke på siden. Marc bør vide, at hans ja starter tre agenter, før noget er live.
- **Hvad der sker med artiklens tal, hvis han siger nej til 6** ("et klip"): 183/120 står så stadig uden "antaget" i kapitel 6 (min U19). Setu siger det kun halvt.
- Resten af min 540 er lukket eller på siden: U17 ("hvert fejlbillede" er væk), U19 (valg 6) og U20 ("Min krop viser uden egne mål en gennemsnitlig løfter").
- Fejlgenkendelsen fra blok 1 ("Mål dit billede") er ikke i artiklen. L6 og L9 rører derfor ikke Marcs valg.

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| S1 | middel | Valg 7: anbefalingen er betinget, så "squat udgiv forslag" er udefineret for forbeholdene | Dhruva vælger en konkret handling (fx Setus: slet 2 øverst, fjern 2 på Marcs erfaring, behold resten) |
| S2 | middel | Fire stikord klippet midt i Marcs sætning; "konkurrencegodkendt squat" mangler lige der, hvor noten siger, at konkurrencen ikke står i stikordene | Citér hele sætningen, også over linjeskift |
| S3 | middel | "Dine stikord" under Forbehold er Dhruvas note "Ikke besvaret …" | Mærk den "Dhruvas note" eller fjern den |
| S4 | lav | Kropstyper: "står der stadig"-parret handler om to forskellige ting | Par stikordet med "skal både føles bedst og kunne godkendes" |
| S5 | lav | Svarene 26. sep kaldes "dine egne ord", men er "ordret i substans" i 3. person | "dit indhold, skrevet ned af Dhruva" |
| S6 | lav | Setus vurderinger i sammenligningen og noterne står uden etiket | Én linje: noterne er Setus |
| S7 | lav | "Ord er intro og brødtekst": tallet tæller overskrifter, figurtekster og tabeller med (squat brødtekst 4.288, ikke 5.510) | Sig det i "Sådan er det målt" |
| S8 | lav | "Seks fejlbilleder i alt" i artiklen, modellen har otte (U18 fra 540); ikke på siden | Ret i artiklen før udgivelse, med de andre små |
| S9 | lav | Etiketter 11,5 px, parenteser 11,2 px, mindst 10,9 px; "Nu" kontrast 4,3 i lys | 12 px og lidt mørkere etiket |

## Ærlige grænser

- **Jeg har læst siden som Marc,** men jeg er ikke Marc. "Kan læses i sengen" er min vurdering af 17 px brødtekst og 7,6 skærme til valgene.
- **Kun headless Chromium på Windows,** ikke hans telefon. Filen skal mailes til telefonen.
- **Talt selv på to af de seks** (deload og coach) plus squat 21. sep. Squat nu er ikke talt selv: dens tabeller og figurer tegnes af sitets scripts, som ikke var med i min kopi.
- **Fagord i valgene er talt med en fast liste.** Om de er forklaret godt nok, er min vurdering.
- **Artiklen på siden er Setus stillbillede** med valg 1, 2 og 6 sat ind. Jeg har ikke læst alle 60 skærme igen. Tallene i kapitel 3 og 7 tjekkede jeg i 540.
- Ingen atletnavne, ingen ændring af siden, sitet eller løftmodellen.
