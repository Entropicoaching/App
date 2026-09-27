skaktime med klassens storm klar: nej (planen i 474 holder ikke 45 minutter og har tre fælder; siderne virker, og med planen nedenfor kan Marc holde timen i dag uden ny kode)

# Marcs skaktime på 45 minutter med klassens storm (Chaturanga 474)

Jeg har gået "Til Marc: en skaktime på 45 minutter" i `outputs/RAPPORT-474.md` igennem trin for trin:
- Læreren på 1280 px: `laerer.html` med to projektorvinduer.
- Eleverne på 390 px: `skak.html` på seks "pc'er" med hver sin browser, samme dato (28/9) og én pc med uret en dag
  bagud.
- En turnering med 25 syntetiske elever ("Elev 01".."Elev 25") over tre runder.

**Filer:** skak-repoets `main` (`9c5114f`, 474 og 478 merget), hentet read-only med `git show` og `git archive`.
Arbejdstræet `skak` havde Chaturangas igangværende 485, som jeg ikke har rørt.

**Kørsel:** script `outputs/kritik-483/skaktime-483.mjs`, målinger i `skaktime-483.json`, log i
`koersel-skaktime.txt` og billeder i `S-*.png`. Headless Chromium, file:// og intet netværk. Lærerens ur flyttes kun
med Playwrights `runFor`.

**Resultat:** 24 tjek grønne og 8 fund. Ingen JavaScript-fejl og ingen netværkskald.

## Hvad der virker

- **Koden:**
  - Fire pc'er med rigtig dato får samme kode (KP63), den samme som Node regner ud fra banken.
  - Pc'en med uret en dag bagud får RX6F og en knap med "(27/9)" i stedet for "(28/9)".
  - Tallinjen er rigtig på alle fire: "Dagens storm 28/9 · Gafler: 4 gåder løst. Kode KP63."
- **Stormens projektor:**
  - Nedtællingen og "Start!" kommer efter 5 s.
  - "Tiden er gået ..." kommer efter 3 min.
  - "Bedste borde" (top 10) bliver opdateret straks.
  - Stormbrættet står helt på skærmen på 390, når stormen starter.
  - "Træn: ..." står under "Her gik det galt" hos de to elever, der fejlede.
- **Turneringen med 25 elever:**
  - 12 borde og en fri runde, og alle 12 borde kan ses på projektoren i 1280×720.
  - Rundeuret siger "0:00 Tiden er gået" på både lærersiden og projektoren.
  - "Parr runde 2" er låst, indtil alle 12 resultater er inde.
  - Efter tre runder står "Turneringen er slut. Vinder: ..." der.
- **Elevens pc:**
  - Tid ude slutter partiet: "Bord 2: 0-1 på tid. Sig resultatet til læreren."
  - Mat og "Giv op" giver også bordlinjen.
  - Pc'en husker bordnummer og Frit 4+0 efter "Start forfra" og efter en genindlæsning (målt).

## Hvad der driller

| | Trin i planen | Fund | Alvor | Ret sådan |
|---|---|---|---|---|
| S1 | 15-42 min, turneringen | **3 runder à 9 min når ikke at være færdige kl. 42.** Mellem runderne skal Marc taste 12 resultater (14 tryk i runde 1 med "på tid"), trykke "Parr runde n" og så "Nulstil" + "Start uret" (2 tryk, uret starter ikke selv). Og 22 af 24 spillere skal flytte bord (målt fra runde 1 til 2). Med 2-3 min pr. skift er det 9 + 3 + 9 + 3 + 9 = 33 min plus opstart, ikke 27. Timen slutter ca. kl. 50, eller runde 3 skæres af. | høj | 2 runder à 10 min med 4+0 (23 min med skiftet), eller 3 runder à 7 min med 3+0. Se planen nedenfor. |
| S2 | 6, eleverne vælger ur | **Uret står som standard på "Intet", og "Frit" starter på 15 min + 10 s tillæg.** Glemmer et bord at skifte, slutter partiet aldrig på tid. Glemmer det tillægget, kan et parti vare langt over 9 min. Det er 5 handlinger pr. pc (Spil, Bord nr., Frit, 4, 0), og på 390 ligger urvalget under folden (y 1000). | høj | Stil alle pc'er før timen; pc'en husker det (målt). Chaturanga: en knap "4+0" (eller "3+0") ved siden af 5+0. |
| S3 | 6, "Vis på projektoren" | **Stormens projektorvindue skifter ikke til turneringen.** Marc skal lukke det, åbne turneringens eget vindue og trække det over på projektoren midt i timen. Planen siger "Vis på projektoren". Den knap åbner laget i lærerens *eget* vindue, og står det på bærbarens skærm, ser klassen det ikke. | middel | I planen: "Luk vinduet" på stormens projektor, så "Åbn projektorvisningen i eget vindue" under Klassens turnering, og træk det over. Chaturanga: ét projektorvindue for hele timen, der følger lærerens fane. |
| S4 | 2, eleverne trykker | **Den store brune knap er "Start stormen", ikke "Dagens storm".** På 390 er "Start stormen" primær (y 1157), og "Dagens storm (28/9)" står under den som sekundær (y 1209). Hele stormkortet ligger under folden, når Gåder åbnes (y 915 på en 844 px skærm). En elev, der trykker den store knap, får tilfældige gåder, ingen kode og ingen linje til læreren (bord 6 i kørslen). | middel | I planen: "tryk den lyse knap *Dagens storm*". Chaturanga: gør "Dagens storm" til den store knap, når en klassens storm er i gang, eller stil den øverst. |
| S5 | 4, "Tjek, at alle har samme kode" | **Hverken projektoren eller lærersiden viser dagens kode.** `laerer.html` har ikke gådebanken og kan ikke regne den ud. Marc kan kun sammenligne børnenes koder med hinanden. Datoen står derimod begge steder. | middel | I planen: "Tjek, at der står 28/9 på knappen, som på projektoren." Det fanger pc'en med forkert dato (målt: "(27/9)"). Chaturanga: projektoren skriver "Der skal stå 28/9 på din knap". |
| S6 | 6, "kan nå at slutte inden for rundeuret" | **Kun hvis bordet starter inden for det første minut.** 4+0 er op til 8 min ur-tid. Et bord, der starter 90 s for sent, spiller stadig ved 0:00 og slutter på tid 26 s efter. Og "Parr runde 2" er låst, til det sidste resultat er inde, så ét sent bord holder hele klassen. | middel | 3+0 med 7 min, eller 4+0 med 10 min, og i planen: "start uret, når alle sidder". |
| S7 | Hvad er et "bord" | **Planen siger ikke, hvor mange pc'er der er, eller hvad "bord" betyder.** I stormen er bordet den pc, tallet kommer fra, og i turneringen er det parringens nummer, som skifter hver runde. Med 25 elever og ét parti pr. pc (Mod en makker) er der 12-13 pc'er, så to elever deler pc'en i stormen. | middel | I planen: sedler "Bord 1..12" på pc'erne; eleverne flytter hen til den pc, projektoren siger, og pc'ens "Bord nr." passer så altid. Stormen tages i par på bordets pc. |
| S8 | 1 og 7, navne og stillingen | **At taste 25 navne (199 tegn) står i planen kl. 15.** Det tager 1-3 min midt i timen. I 1280×720 ses kun 21 af 25 i "Stilling". I 1024×768 ses alle 25, men småt (ca. 19 px pr. række), og farveknapperne ligger oven i titlen "Klassens turnering". | lav | Navnene før timen (de bliver på pc'en). Chaturanga: kompakte rækker eller to spalter over 20 elever, og titlen fri af knapperne i 1024. |

## Tid: planen mod det, der skal trykkes

| Planens minut | Hvad der skal ske | Målt/talt | Holder? |
|---|---|---|---|
| Før timen (planen: 2 min) | Tema og stormens projektorvindue | 2 tryk + træk vinduet over | ja, men navne, sedler og pc'ernes ur mangler (S2, S7, S8) |
| 0-5 | Eleverne: Gåder, tema, find knappen | 3 tryk + rul (kortet ligger under folden på 390) | ja, hvis pc'erne er stillet før timen |
| 5-8 | Stormen | 5 s nedtælling, 3 s "Start!", 3 min | ja |
| 8-12 | 12 borde siger deres tal | 36 tryk/feltskift, 30 tegn | ja (ca. 2 min) |
| 12-15 | Samtale, "Træn: ..." | knappen findes hos dem, der fejlede | ja |
| 15-42 | Navne, projektorskift, 3 runder à 9 min | 199 tegn, projektorskift, 5 handlinger pr. pc, 3 × 9 min + 2 skift à 2-3 min + 14/12/12 resultattryk | **nej**, ca. 36 min (S1) |
| 42-45 | Stillingen | 21 af 25 ses i 1280×720 | halvt (S8) |

Hvor lang tid et barn bruger på at flytte sig og finde sit bord, kan en headless browser ikke måle. De 2-3 min pr.
skift er mit skøn for 22 børn, der flytter. Resten er talt eller målt.

## Planen, som den holder i dag (uden ny kode)

**Før timen (10 min):**
- Sedler "Bord 1..12" på pc'erne.
- På hver pc:
  - Spil → Mod en makker → Bord nr. = sedlens tal → Skakur Frit 4 min, 0 sek.
  - Gåder → tema Gafler.
  - Pc'en husker det hele.
- `laerer.html`:
  - Klassens turnering: skriv navnene, sæt "Antal runder" til 2 og rundeuret til 10 min ("Sæt uret"). Tryk ikke Start
    endnu.
  - Klassens storm: tema Gafler → Åbn projektorvisningen i eget vindue → træk det over på projektoren.

**Timen:**
1. **0-5:** To og to ved en pc. "Gåder → rul ned → den *lyse* knap *Dagens storm (28/9)*. Tjek, at der står 28/9 som
   på projektoren. Tryk, når der står Start!"
2. **5-8:** Start nedtællingen. Stormen kører.
3. **8-12:** Hvert bord siger sit tal, og Marc skriver bord + antal ind.
4. **12-15:** Samtale og "Træn: ...". Fjern fluebenet ved dem, der ikke er her. Tryk "Start turneringen og parr
   runde 1".
5. **15-16:** Stormens projektor: Luk vinduet. Turneringen: Åbn projektorvisningen i eget vindue → træk det over.
6. **16-27:** Eleverne sætter sig ved det bord, projektoren siger. Når alle sidder: Start uret (10 min).
7. **27-30:** Resultaterne ind (tid ude: tryk resultatet + "på tid") → Parr runde 2 → Nulstil → Start uret, når alle
   sidder.
8. **30-40:** Runde 2.
9. **40-45:** Resultaterne ind → "Stilling" på projektoren.

Lektie: "Dagens storm igen" giver de samme gåder, så de kan slå deres eget tal.

Vil Marc have tre runder, så brug 3+0 og 7 min pr. runde. Det holder også (7 + 3 + 7 + 3 + 7 = 27 min), men 3+0 er
hurtigt for begyndere, og flere partier slutter på tid.

Ingen rigtige elever er brugt, kun "Elev 01".."Elev 25".
