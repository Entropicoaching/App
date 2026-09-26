# Kritik 421: Biblioteket og Lær skak efter 410 og 415

klar til klassen: ja, fordi de to ting der lærte eleven noget forkert (B1 og B2) ikke kan genskabes længere, og Marcs første time kører igennem på 390 px uden sidefejl: "Næste for dig" fører eleven fra Mat i 1 til Red din brik, hint-trappen virker, og "Stop matten" afviser nu at give dronningen væk.

Grundlag: skak `main` @ 8aa76ba (410 og 415 merget), kun læst via `git archive`. Headless Chrome, 390 x 844, touch. Målinger i `outputs/kritik-421/` (`bank-421`, `stopmatten-421`, `elev-421`, `time-421`, `.json` + `E-/S-/T-*.png`). `npm run verify:kritik-421` regner det hele efter.

## Fund (vigtigst først)

Ingen af dem lærer eleven noget forkert. De gør timen lidt glattere.

**N1 - Efter "Det sidder!" er der kun "Næste øvelse".** Når Mat i 1 sidder, står eleven med "Næste øvelse" (samme kompetence igen) og "‹ Biblioteket". Vejen videre ("Næste for dig: Dronningemat") ligger på oversigten, et tryk væk, men en 10-årig trykker på den store knap og bliver i Mat i 1 (`T-05-sidder-mat-i-1.png`). *Forslag:* når en kompetence lige er kommet til at sidde, skal den primære knap være "Næste for dig: <titel>" og "Næste øvelse" den sekundære.

**N2 - Tippet i Stop matten skubber brættets nederste række ud af skærmen.** På 390 x 844 er tip-teksten fire linjer, og række 1 med den hvide konge og dronning er halvt skåret af (`S-sm07-hint-1.png`). Eleven skal scrolle for at se den brik, ringen peger på. I Mat i 1 (to linjer) passer det (`T-03`). *Forslag:* kortere tip i Stop matten ("Hvilken brik giver mat? Slå den, dæk feltet eller giv luft - uden at give noget væk."), eller skjul forklaringen, mens et tip vises.

**N3 - "Patt er remis" i Lær skak: at sætte mat får standardbeskeden.** Dg7 (mat) giver "Et lovligt træk - men ikke det, opgaven beder om", ikke "Det er mat - opgaven er patt" (`elev-421.json`, trin "patt"). Lille.

**N4 - Rester fra B10 (uændret, som 415 selv skriver):** Afdækket 03CF0 godtager stadig ikke f3 som andet træk (`bank-421.json`: `f2f3` godtaget = false, facit g3g4). "Spring over"/"Start forfra" står stadig under brættet (skabelonen: `knap-laer-spring-over` og `knap-bib-forfra` efter `braet`).

**N5 - "Næste for dig" kender ikke Lær skak.** En helt ny elev får "Mat i 1" som første kort, ikke Lær skak. Marcs plan klarer det ("nye elever tager Lær skak først"), men kortet siger det ikke selv. *Forslag:* kortet viser Lær skak, indtil trin 12 (rokade) er gennemført.

## B1-B10 fra kritik 409

| | Status | Bevis |
|---|---|---|
| **B1** Stop matten godtager dyre svar | **lukket** | Alle 8 øvelser på dybde 4 (39 min, samme tal som 409): intet godtaget svar taber 2+ mod det bedste, og pilen (`godeFoerste[0]`) er altid et af de bedste. sm07 Dg4+ (-12), sm03 Td3 (-6), sm08 Tc6 (-6) og sm02 Kg7 (-3) står som `dyre` og giver i browseren "Matten er stoppet - men ... Det koster dig en brik". sm01 Tb8 (-1) godtages stadig (under grænsen, men ikke pilen). `bank-421.json`, `stopmatten-421.json`, `S-sm07-*.png` |
| **B2** ulovlige Lær skak-stillinger | **lukket** | Alle 33 stillinger (fen/demoFen/spilFen) er regnet efter to gange (chess.js og en egen angrebs-regner, der stadig fanger de to 409-stillinger): ingen står i skak. Dronning-trinnet har kun dronningen (stjerner), trin 23 har kongen på h8 og blev gennemført. `E-33`, `E-40` |
| **B3** Tårn mod konge for svært | **lukket** | 50 træk, "3 af de sidste 4", "Gør kassen mindre" (4 øvelser) før partiet på stien. Kasse-eleven fra 409: 18, 12 og 41 træk, så sidder det efter 3 partier (før ca. 7). `E-22-*` |
| **B4** Oppositionen | **lukket** | 7 forskellige manøvrer (før 3). hint2 passer til trækket: "Gå til siden" / "Gå skråt frem" / "så må bonden gå". Løst → "Se den gå hele vejen". `bank-421.json` B4, `E-14`, `E-15` |
| **B5** hint = svaret | **lukket** | 1. tryk: tip + ring (0 pile), knappen hedder "Vis trækket". 2. tryk: pilen. Målt i Mat i 1 og alle fire Stop matten. `T-03`, `T-04` |
| **B6** ingen vej i oversigten | **lukket** | "Næste for dig" øverst, synlig uden scroll (y 274-388). Red din brik lige efter Slå den ubeskyttede, oppositionen før tårn mod konge. Kortet fører korrekt gennem de fem kompetencer i timen. Se N1 og N5. `T-01`, `T-07` |
| **B7** "Du er sort" efter trækket | **lukket** | 0 forekomster i hele Lær skak-kørslen (trin 1-23) |
| **B8** Rokér i tide uden valg | **lukket** | Alle 8: begge veje fri for brikker, præcis én lovlig rokade |
| **B9** patt i Dronningemat | **lukket** | dm01 Dg6 (patt) i browseren: "Patt! Kongen kan ikke flytte og står ikke i skak - det er uafgjort. Giv den et felt." `T-11` |
| **B10** småting | **delvist** | Lukket: "Gaflen ramte to ting ... du vandt et tårn", rokade-ringen står på c1, ulovligt stjerne-træk giver "Dertil kan løberen ikke gå". Åbent: 03CF0 f3 og knapperne under brættet (N4) |

## Marcs første time som elev (390 px)

Efter RAPPORT-415 "Hvad er næste", målt i `time-421.mjs`:

1. **Projektor.** Biblioteket åbner med "Næste for dig: Mat i 1" over folden. Tryk 1 på "Vis et hint": "Tip: Tjek alle dine skak - ét af dem er mat. Brikken i ringen skal flytte." + ring om dronningen. Tryk 2: pilen. Opgave 1 løses med hint ("Løst! ... rækken starter forfra"), opgave 2 uden ("1 af 5 i træk").
2. **Eleven selv** (en fejl eller et hint pr. kompetence): Mat i 1 sidder efter 9 øvelser, Dronningemat efter 8, Tårnmat efter 7. Kortet skifter hver gang til den næste.
3. **De hurtige:** Slå den ubeskyttede efter 6, Red din brik efter 7. Fejlbeskederne passer ("Nu kan modstanderen stadig vinde en brik ..."). Kortet viser derefter Baglinjemat. 37 øvelser i alt, realistisk på en lektion for de hurtige, 2-3 kompetencer for de fleste.
4. **Fælles: Stop matten sm07.** Dg4+ → "Matten er stoppet - men ... Det koster dig en brik." Sd2-f3 → "Løst!". Nu er det en god tavlesamtale og ikke en fælde.
5. **Genindlæsning:** "5 af 24 kompetencer sidder" og kortet står der stadig (samme pc).

Lær skak som ny elev: stjerne-trinnene virker (omvej → "Du brugte 6 træk. Det kan gøres på 4 - prøv igen", "Prøv igen" → "færrest mulige"), og hele vejen fra trin 1 til 23 er uden sidefejl.

## Hvad der holder

- Skakken: 409's dybde-4-tal genskabes præcist. Det, 415 lavede, er målt og ikke bare påstået.
- Beskederne siger nu, hvad der skete ("du vandt et tårn", "det koster dig en brik", "Patt!").
- Ingen sidefejl i fire browserkørsler (stopmatten, elev, time x2).
