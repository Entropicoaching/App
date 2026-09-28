Maal dit billede stadig klar til sitet: ja

**Ja, og Setu skal kopiere den nye udgave nu.** Uger virker, som Yantra siger:
- datoorden, M5-filer, fotos og for mange uger siges
- ingen sidelæns rul på siden
- samme regning som Før og efter, tjekket mod siden selv

Mine fire nye fund er ét middel (M19) og tre lave. Ingen af dem stopper kopien. M19 bør rettes, før Marc peger trænere på Uger med mange uger.

**Setu kopierer fra løftmodellens `main` (`287210d`):** kun `dist/maal-billede/index.html` og `dist/maal-billede/maal-billede.js`.
- Sitets `vaerktoejer` (`1169b5f`) er blob for blob `4ca0c63` i `maal-billede`, `tre-loeft`, `min-krop` og `baenk-figurer`.
- I `dist` er kun de to filer ændret siden.
- Miniaturerne og de andre mapper er de samme.

# Kritik 628, blok 1: Mål dit billede efter Yantras 621 (Uger)

Bhishak, 28. sep 2026. Ordre 628.

**Løftmodellen:** `entropi-loeftmodel-dhruva` `main` @ `287210d` (merge af ordre-621), hentet med `git archive`. Intet træ er rørt. `docs/RAPPORT-dag-94.md` er læst. `-95.md` er ikke på `main`.

**Sitet:** `entropi-coaching-site-wt2` `vaerktoejer` @ `1169b5f`. Jeg har målt i sitets kopi med `main`'s `dist/maal-billede/` lagt oven i.

## Hvad jeg målte

To scripts, alle tjek grønne:
- `outputs/kritik-628/maal-628.mjs`: **18/18** (`maal-628.json`, `.log`, `M-*.png`)
- `outputs/kritik-628/hop-628.mjs`: **3/3** (`hop-628.json`, `.log`)

Opsætning:
- Google Chrome 154 headless: 390 med touch, 1280 med mus. Alt net uden for den lokale server er afbrudt. 0 netkald og 0 JS-fejl.
- **Filerne:** én måling er gemt med sidens egen Gem-knap. Min egen PNG-skriver (fra 610) har skrevet klik, dato, højde og fase om, så det giver en uge pr. fil.
- **Klikfejlen:** Yantras egen antagelse, én SD i hver retning: stangen 0,5 cm, midtfod, ankel og knæ 1,0 cm, hofte og skulder 1,5 cm.
- Kun syntetiske målinger. Billederne er grå flader.
- **Monte Carlo:** 2.000 forsøg pr. linje i node med sidens rene moduler.
  - Regningen er tjekket mod siden: tre forsøg med 12 uger givet siden som filer gav samme antal guldceller (0/0, 6/6, 0/0).
  - Uden det fjerne nav står stangens tre rækker som "samme kameraplads" og er ikke med i tallene. Tallene gælder de fem andre rækker.

## Yantras punkter (dag 94)

### 1. Uger på 390 px

Otte uger (dødløft ved gulvet, 3 runder hver) er valgt i blandet rækkefølge. Hoften går 0 → 6 cm op. Et foto og en fil uden endelse og type (M5) er med.

- **Rækkefølgen er rigtig:** kolonnerne står 3. aug. → 21. sep.
- **Fotoet siges:** "Ikke med: IMG_0001.PNG har ingen gemt måling."
- **Filen uden endelse er med.**
- **Sætningen:** "Nyeste (21. sep. 2026) mod ældste (3. aug. 2026). … Efter: hoften højere (ca. 6 cm), knæet mere strakt (ca. 8°) og overkroppen mere foroverbøjet (ca. 6°)." Det er rigtigt.
- **Siden ruller ikke sidelæns.** Tabellen er 894 px bred i en boks på 345 px, altså 2,6 skærmbredder.
  - Målets navn (104 px) bliver stående, når tabellen er rullet helt ud.
  - Man ser navnet og 2-3 uger ad gangen (`M-390-628-uger-rullet.png`).
  - Den mindste skrift er 11,7 px.
- **Kan en træner læse den?** Ja, rækkerne er læselige.
  - Men tabellen er 632 px høj for otte rækker. Det skyldes især stangens tre rækker: hver celle siger "+1,0 cm, samme kameraplads" over 2-4 linjer (M22).
- **Er det tydeligt, at forskellen er fra den ældste uge? Ikke i selve tabellen (M20).**
  - Hverken kolonnernes hoved eller cellerne siger det. Det står i indledningen over knappen og i forklaringen under tabellen, 647 px under tabellens top.
  - Er tabellen rullet ud til de nyeste uger, er den ældste uges kolonne ude af syne.
  - Så ligner "+7,9 cm" under 14. sep. og "+5,9 cm" under 21. sep. to ugers ændringer: "hoften faldt 2 cm den sidste uge". Men begge er fra 3. aug.

### 2. Mange celler og målefejlen (M19)

SAMME stilling alle uger, altså ingen ændring, med Yantras klikfejl:

| | 2 uger | 8 uger | 12 uger |
|---|---|---|---|
| guld et sted i tabellen, 3 runder | 9,2 % | **40,9 %** | **49,6 %** |
| guld et sted i tabellen, 1 runde | 12,7 % | **46,9 %** | **59,4 %** |
| den nyeste kolonne i guld (= sætningen), 3 runder | 9,2 % | 9,8 % | 9,2 % |
| guld i to uger i træk, samme retning, et sted, 3 runder | 0 % | 5,6 % | 8,6 % |

- **Hver celle for sig holder Før og efters rate:** ca. 2,2 % af cellerne.
- **Men tabellen har mange celler:** 35 med 8 uger og 55 med 12. Så halvdelen af alle tabeller uden ændring har mindst én guldcelle.
- **Guldet er spredte enkeltceller.** Kun 1,3 % har en hel række i guld i mindst halvdelen af ugerne. Den ældste uges klikfejl trækker altså ikke en hel række med sig.
- **Sætningen er i orden:** den taler kun om den nyeste mod den ældste og holder Før og efters rate (9-12 %).

**En rigtig ændring:** hoften 5 cm højere fra uge 5 (12 uger, 3 runder):
- guld et sted: 99,8 %
- nyeste kolonne: 83,3 %
- to i træk et sted: 94,2 %

**Mit svar på Yantras spørgsmål:** vis ikke kun den nyeste i guld. Så mister træneren det, Uger er til: at se, hvornår noget skete.
- Lad guld kræve **to uger i træk over grænsen i samme retning**. Den første af de to kan få guld, når den anden kommer.
- Det tager tabeller uden ændring fra 41-59 % med guld ned til 6-12 %. En hoftehøjde, der ændres 5 cm, findes stadig i 94 %.
- En enkelt celle over grænsen kan stå med almindelig skrift uden ≈.
- Kan det ikke nås nu, så lad forklaringen under tabellen sige det: "Med mange uger står enkelte celler i guld ved et tilfælde. Stol mest på en ændring, der står i flere uger i træk."

### 3. Fælles krop mod filens egen

Dødløftfiler, alle gemt med 180 cm:

| Hvad | Hoftens højde uge 1 → 3 | Forskel uge 3 | Status siger |
|---|---|---|---|
| a) frisk side | 66,82 → 68,89 cm | +2,07 cm | "3 målinger målt med kroppens længder som skala." |
| b) uge 2 gemt med 175 (en tastefejl) | samme som a | +2,07 cm | intet om 175 |
| c) siden har allerede 165 cm (forrige atlet) | **61,25 → 63,15 cm** | **+1,90 cm** | intet om 165 eller 180 |
| d) sidens fase er squattens bund | samme som a | +2,07 cm | |

**Er det rigtigt at bruge sidens fælles krop? Ja.** Det er samme atlet, så én krop er det rigtige.
- b viser, at en tastefejl i én uge ikke flytter tallene.
- d viser, at sidens egen fase ikke smitter af på filernes.
- Vinklerne er ens i alle fire.

**Men c er et lavt fund (M21):**
- Står der allerede en anden højde på siden, fx fra den atlet, træneren målte før, bliver alle ugerne regnet med den.
- cm-rækkerne bliver ca. 8 % forkerte.
- Hverken filernes 180 eller sidens 165 står i status.

### 4. hop563 med faste billedtider

**Ja, det er en god erstatning.**

**Mit eget tjek:** `fastVideo(bane)` er kodet i Chrome fire gange for hver af de fire baner: to gange ubelastet og med CPU'en drosslet 6x og 20x (CDP, kun min egen side). **Klippet er byte for byte det samme alle fire gange** (79 billeder).
- En belastet maskine kan altså ikke længere give testen et andet klip.
- Koden tager 90-180 ms, eller 650-990 ms drosslet 20x.

**Yantras tests:** `hop563` + `hop621` på `main` er 13/13 grønne to gange (20 s hver). Den gamle `hop563` på `4ca0c63` er 10/10 grøn (23 s) på samme maskine.
- Jeg har ikke belastet hele maskinen. Andre agenter kører på den.

**Det, testen mister:**
- Klippet er ikke længere optaget i realtid med tabte billeder.
- Det er dog ikke `hop563`'s opgave. Hoppets regning (sekant og gulv) er det samme, og grænsen er strammet fra 0,12 s til 0,05 s.
- Tabte billeder og variabel billedrate prøves af 571 og 586. Dem har jeg ikke kørt.

### 5. Kanter

- **16 filer:** 15 dødløftuger, heraf én uden dato, og én squat.
  - Det giver to tabeller.
  - Dødløftets har 12 kolonner: den ældste og de 11 nyeste. "Uden dato" står sidst.
  - Noten siger "3 uger mellem den ældste og de 11 nyeste er ikke vist".
  - Squatten siger "Kun én uge i denne fase".
- **M18 fra 617 står stadig på 621.** Efter Byt siger noten over billedet stadig "Før er gemt senere end efter; tryk Byt …". 621 har ikke rørt det.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M19 | middel | Uger uden ændring har guld et sted i 41 % (8 uger) og 50 % (12 uger) af tabellerne med 3 runder, og i 47-59 % med 1 runde. Hver celle har Før og efters grænse, men tabellen har 35-55 celler. Siden siger det ikke. | Yantra: guld kun når to uger i træk er over grænsen i samme retning. Falske fald til 6-12 %, og en hofte, der går 5 cm op, findes stadig i 94 %. Ellers mindst en sætning i forklaringen: "Med mange uger står enkelte celler i guld ved et tilfælde; stol mest på en ændring, der står i flere uger i træk." |
| M20 | lav | "Forskellen fra den ældste" står ikke i tabellen. Rullet ud på 390 ses den ældste kolonne ikke, og tallene ligner ændringer fra ugen før. | Yantra: skriv det i den faste celle øverst til venstre, "Mål (forskel fra 3. aug.)", eller under hver dato "mod 3. aug.". |
| M21 | lav | Står der allerede en anden højde på siden, regnes alle ugerne med den (cm-rækkerne ca. 8 % forkerte ved 165 mod 180). Status nævner ingen højde, heller ikke når filerne har en anden. | Yantra: status "målt med 180 cm fra siden"; og hvis filernes højde er en anden: "Filerne er gemt med 180 cm; siden bruger 165." |
| M22 | lav | Stangens tre rækker siger "…, samme kameraplads" i hver celle over 2-4 linjer, så tabellen er 632 px høj på 390. | Yantra: kort mærke i cellen (fx "kamera*") og én forklaring under tabellen. |
| M18 | lav | Står fra 617 (noten efter Byt). | Yantra |

**Ingen af dem stopper Setus kopi.**

## Ærlige grænser

- **Ingen telefon:** headless Chrome 154 på Windows med Playwrights touch.
  - Sidelæns rul med en finger er ikke prøvet. Jeg har sat `scrollLeft`.
  - Om Fotos eller Filer på en iPhone kan vælge flere PNG'er urørte på én gang, ved jeg ikke. Det står stadig til Marc.
- **Klikfejlen er Yantras antagne, ikke målt på en træner.** Er rigtige klik værre, bliver M19 værre. Grænsen løfter sig dog med den målte spredning mellem runderne.
  - Tallene er uden det fjerne nav, altså uden stangens rækker. Med navet klikket er der flere celler og mere guld.
- **Kun dødløft ved gulvet** i Monte Carlo. Squat og bænk er ikke målt.
- **Filerne er skrevet om af mig,** ikke gemt af en træner uge for uge. Datoerne er mine.
- **Hvad en træner forstår** (M20, M22) er min vurdering, ikke prøvet på en træner.
- **Kørt:** kun mine egne scripts og Yantras `hop563`/`hop621` i en arkivkopi. Ikke hele Yantras suite.
- **Grænserne:** ingen rigtige atleter eller klip. Løftmodellen og sitet er ikke rørt.
