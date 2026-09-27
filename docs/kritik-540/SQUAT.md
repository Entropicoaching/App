squat-artiklen klar naar Marc har valgt: ja

Alle tal i kapitel 3 og kapitel 7 er de samme som løftmodellens på main (`ca860bf`), og Setus U12-sætninger siger det, som `docs/REFERENCEKROPPE.md` siger. U15 siger det, som Hales m.fl. (2009) siger ifølge `docs/squat-litteratur.md`, kilde 4. Siden holder på 390 og 1280 px uden net. Der er fire små fund (U17-U20). Ingen af dem giver et forkert tal. De kan rettes i samme commit som Marcs valg, men artiklen er rigtig uden dem.

# Kritik 540, blok 1: squat-artiklen efter Setus 534

Bhishak, 27. sep 2026. Ordre 540 fra Dhruva via Marc. Planet coaching.

**Grundlag:** sitets gren `udgivelse-squat-min-krop` @ `9390990` (Setus 534, blok 1), hentet med `git archive` fra `entropi-coaching-site-wt2`. Træet står stadig på `vaerktoejer` og er ikke rørt. Løftmodellen er læst med `git show main:...` i `entropi-loeftmodel-dhruva` @ `ca860bf`. Setus `RAPPORT-534.md` og dhruvas `RAPPORT-dag-74.md` er læst.

**Sådan:** `outputs/kritik-540/squat-540.mjs` → `squat-540.json` og `S-*.png`, **24/24** tjek grønne.
- **Kilden:** kapitlernes tekst sammenholdes med `docs/REFERENCEKROPPE.md`, `docs/squat-litteratur.md`, `outputs/anatomi/tal-balanceret-lowbar.json` (kapitel 3), `outputs/fejl-marc/tal.json` (kapitel 7's to første fejl) og `outputs/fejlbilleder/tal-balanceret-lowbar.json` (kapitel 7's fire sidste).
- **Siden:** headless Chromium på 390 (touch) og 1280 px med alle folder åbne. Alt uden for huset er blokeret. Kapitel 3's tabel er læst i alle fem stillinger.

## Kapitel 3's tabel

| Hvad | Resultat |
|---|---|
| Tabellen på siden, 5 stillinger × 7 muskelgrupper, arm og andel af max | 35/35 = `outputs/anatomi/tal-balanceret-lowbar.json` på 390 og 1280 |
| Tekstens procenter (52-63 %, 85 %, 88-91 %, 38 %, 22 %, 41 %, 18 %, 75 %, 87-91 %, 57 %, 90 %, 94-96 %, 59 %, 42 %, 32 %) | alle rigtige |
| De fire billedtekster (skinneben, knæfleksion, hoftefleksion, torso) | alle rigtige |
| "24 mod 21 cm" og "2,0 mod 2,2 cm" ved sticking point mod bunden | rigtige (21,4 cm i REFERENCEKROPPE) |
| "Alle tal i kapitlet gælder den balancerede referencekrop med lowbar" | rigtigt. Tallene er fra den balancerede krop, 78 kg med 100 kg stang, lowbar, som U12 siger |

Afrunding: JSON-filen gemmer andelen med 3 decimaler. Soleus ved sticking point står som 0,945 i filen, og siden regner med fuld præcision og skriver 94 %, ligesom teksten ("94-96 %"). Det samme gælder baglårets arm stående (5,35 i filen og 5,4 på siden). Det er ikke en fejl.

På 390 har tabellen sit eget rullelag. Status-kolonnen ("ikke regnet …") er skåret af, til man ruller tabellen sidelæns (`S-390-kap3-tabel.png`). Det er som i 525 og ikke nyt.

## Kapitel 7

| Hvad | Resultat |
|---|---|
| Indledningen og begge momenttabeller for kun knæene og hoften tilbage | siger "antaget krop på 183 cm og 120 kg med 120 kg på stangen", som REFERENCEKROPPE |
| De seks momenttabeller (24 rækker) | alle = løftmodellens tal |
| 27 tal i tekst og billedtekster: vinkler, hæl 3,7 cm, stang foran midtfoden, momentarme, hoften og skulderen op, Good morning 9 cm / 12,6°, ankelgrænsen 35°, stangen 5 cm frem og for lidt dybde 8 cm | alle rigtige |
| Fejlkroppens arme 21,7 / 23,0 cm og momenter 435 / 497 Nm | = REFERENCEKROPPE |
| Den balancerede krops arme 20,5 / 21,4 cm og momenter 312 / 345 Nm | = REFERENCEKROPPE |

## U12 og U15

- **U12** (kapitel 2) er rigtig i alle tre sætninger: 78 kg med 100 kg, lår/skinneben/torso 42/42/50 cm, "ca. 171 til 174 cm" (en omregning og ikke et modeltal, og sådan står det), 183 cm og 120 kg antaget med 120 kg stang, samt 178 cm og 85 kg med 120 kg i squat.
- **U15** (kapitel 1, sticking point): "Hos 25 løftere ved en konkurrence var den lodrette stanghastighed 0,09 m/s ved sticking point og torsoen ca. 49° fra lodret (Hales m.fl., 2009)." Kilde 4 har det samme:
  - 25 løftere ved en regional konkurrence
  - abstraktet siger ordret "squat (0.09 m/s)" og "quantified at the sticking point"
  - torsoen var 40,6° mod vandret, altså 49° fra lodret
- 0,09 m/s står én gang, Hales står i referencelisten, og 0,11 m/s står stadig med Larsen m.fl. (2021a).

## Marcs stilregler

- **Tankestreger:** 0 i den synlige tekst på 390 og 1280 med alle folder åbne.
- **`[MARC`:** 0.
- **Atletnavne:** 0 (fornavnene fra appens `.gitignore`, ikke skrevet ud).
- **Dramatisk åbning:** nej. Indledningen er Marcs egen sætning om idealiseringen af én teknik.
- **Meta:** kapitel 6's første linje ("Squat-udgaven kommer, når der er film") er U6, som venter på Marcs valg. Ellers er der ingen meta.
- **Forbehold nederst:** feltet "Forbehold" står efter kapitel 8. Forbehold inde i teksten er U13, som også er Marcs valg (Setus forslag er at beholde dem).
- **Siden:** ingen vandret rulning, 0 JS-fejl og 0 filer, der mangler, på begge bredder. Én ekstern forespørgsel er blokeret (skrifttypen), og siden viser tekst uden den.

## Nye fund

| U | Alvor | Hvad | Ret |
|---|---|---|---|
| U17 | lav | Kapitel 7, "Gå dybere", "Modellen bag fejlbillederne": "Hvert fejlbillede er en afvigelse fra den balancerede referencekrops løste positur i bunden … Gælder balanceret krop, lowbar." Det passer ikke med U12, for de to første fejl er regnet på den antagne krop. Punktet lige under siger det rigtige | "De fire sidste fejlbilleder er hver en afvigelse fra den balancerede referencekrops løste positur i bunden." |
| U18 | lav | Samme fold: "Modellen har registreret seks fejlbilleder i alt: de fire med figur fra good morning og frem, plus knæ indad og bækkenets obliquitet." Løftmodellens liste på main har otte. Kun knæene og hoften tilbage er også med (for den balancerede krop, med andre tal end artiklens) | "Modellen har registreret otte fejlbilleder: de seks i dette kapitel og knæ indad og bækkenets obliquitet, som den ikke kan tegne." |
| U19 | lav | U12 siger, hvor hver krop gælder, men nævner ikke kapitel 6 og 8. Kapitel 6 bruger den samme antagne krop og skriver "Modellen får kroppens mål (183 cm, 120 kg)" uden "antaget". Kapitel 8 bruger den balancerede krop (0,9 og 3,3 cm). Indledningen siger "en opdigtet referencekrop" i ental | Kapitel 6: "(183 cm og 120 kg, antaget, samme krop som kapitel 7's to første fejlbilleder)". U12: "og kapitel 8". Hænger sammen med U5 og U6, så det kan tages i samme commit som Marcs valg |
| U20 | lav | "Min krop viser uden egne mål en gennemsnitlig løfter på 178 cm og 85 kg." "Min krop" er værktøjets navn, men det står som almindelig tekst i en artikel, hvor Marc skriver i første person. Det kan læses som Marcs egen krop | "Værktøjet Min krop viser …" eller et link til Min krop, når stien er valgt (N1/V8) |

## Dom

**squat-artiklen klar naar Marc har valgt: ja.**
- Tallene i kapitel 3 og 7 er de samme som løftmodellens, og kildens tal er gengivet rigtigt.
- U12 lukker det, jeg fandt i 502 og 525: læseren kan se, hvilken krop hvert tal står på.
- U17-U20 er tekst i folder og i én sætning. De bør rettes, men de ændrer ingen tal og er ikke en grund til at vente.

## Ærlige grænser

- **Ikke genregnet:** jeg har ikke kørt løftmodellens solver igen. Jeg sammenholder med de filer, den har skrevet på main (`outputs/*/tal*.json` og `docs/REFERENCEKROPPE.md`), og ikke med en ny kørsel.
- **Hales:** er kontrolleret gennem abstraktets citat i `squat-litteratur.md`, ikke i artiklens fulde tekst.
- **Ikke læst mod kilder:** kapitel 1, 2, 4, 5 og 8 ud over U12 og U15. Heller ikke Mål dit billede @ `6d3129e` på `vaerktoejer`, som Setu nævner. Mit tjek af fejlgenkendelsen er 536.
- **Browser:** kun headless Chromium på Windows. Ingen rigtig telefon.
