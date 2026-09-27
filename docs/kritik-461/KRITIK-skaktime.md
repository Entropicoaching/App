# KRITIK-skaktime: Marcs skaktime med 11 elever

Ordre 461, blok 2 (Bhishak). Skak `main` `1791bc0`, kun læst via `git archive`. `laerer.html` er kørt headless på 1280 × 800 (Marcs skærm) med projektoren i eget vindue på 1920 × 1080. Navnene er kaldenavne ("Løven", "Tårnet" ...), ingen elever. Script: `outputs/kritik-461/skaktime-461.mjs`, målinger: `skaktime-461.json`, billeder: `b2-*.png`.

## Fund

- **T1 Eleverne starter partiet i en gådestilling (blokerer).** 454's plan er `skak.html → Spil → Mod en makker`. På en frisk pc åbner siden på Gåder, og Spil overtager gådens stilling, både mod en makker og mod computeren. Kun "Start forfra" og derefter "Ja" giver startstillingen. Med 11 elever driller det i timens første minut, på hver eneste pc. Det er E1 i ELEV-461 (`spil-start-461.json`, `b1-390-spil-start.png`).
- **T2 To elever med samme navn kan ikke skelnes (bør rettes).** "Bonden" to gange blev taget imod uden et ord ("Runde 1 er parret."). På projektoren og ved resultatknapperne står der to ens navne, så Marc kan ikke se, hvem der vandt ved hvilket bord. To elever med samme fornavn i en klasse på 11 er almindeligt. Forslag: advar ved dubletter, og bed om et forbogstav.
- **T3 Fire runder er standard for 11 elever (bør rettes).** `standardAntalRunder(11)` giver 4. 454's egen plan regner 10-12 minutter pr. runde, så fire runder tager 40-48 minutter, før der er sat op og kåret en vinder. Det passer ikke i en lektion på 45 minutter. Marc kan rette tallet, men standarden bør passe til en time (3), eller siden bør sige "ca. N min". Med 3 runder ender 6 % af turneringerne med delt førsteplads (4 % med 4 runder).
- **T4 Lange navne skubber stillingen ud over kanten (pynt).** Med navne på 18-20 tegn ("Dronningegambitten", "Springer-på-f3-Kalle") på 1920 × 1080 bliver navnene i parringerne afkortet med "…", og det er fint. I stillingen skubbes Buchholz-kolonnen derimod 12 px ud over panelets højre kant (`b2-1920-projektor-lange-navne.png`). Med almindelige fornavne sker det ikke (0 px, intet afskåret).
- **T5 Før første parti står eleven med fri runde øverst i stillingen (pynt).** Når runde 1 er parret, viser projektoren "1 Passanten 1" og de andre ti som "2 ... 0" (`b2-1920-projektor-runde1.png`). Den første stilling, klassen ser, udnævner den, der sidder over, til førende. Forslag: vis først stillingen, når runde 1 har et resultat, eller giv først det frie point, når runden er færdig.
- **T6 Delt førsteplads og Buchholz forklares ikke på projektoren (pynt).** Vores time endte "Vinder: Tårnet og Spyddet" (lige point og lige Buchholz). I 300 simulerede turneringer med 11 elever og 4 runder sker det i 4 %. I 26 % står flere på topscoren, og så afgør Buchholz vinderen. Lærersiden har linjen "Point, derefter Buchholz (modstandernes point)", men projektoren har ikke. En elev, der taber pladsen på Buchholz, ser kun et ukendt ord.
- **T7 "Sidder over: <navn>" står på projektoren (pynt).** Når Marc fjerner fluebenet ved en syg elev, viser projektoren elevens navn under parringerne ("Sidder over: Kongen", læst i `turneringprojektor.js`). Det er hensynsfuldt at kunne slå det fra, når eleven er syg eller gået hjem.
- **T8 Overskriften BUCHHOLZ er større og federe end de andre kolonneoverskrifter (pynt).** Det ses på alle projektorbillederne og ser ud som en stilfejl i `proj-bh`.

De øvrige fund fra blok 1 (E2-E10 i ELEV-461) hører til computerdelen og efter-partiet, ikke til turneringstimen: E2 (Træn-knappen sletter partiet), E3 (en ny elev kan ikke afslutte), E4 (boksen siger altid Red din brik), E5 (en fri dronning bliver til "du tabte"), E6 (engelske bogstaver), E7 (dubletter blandt vendepunkterne), E8 (brik eller lektie forkert), E9 (pile der forsvinder) og E10 (to maskine-tegn).

klar til en skaktime: nej, fordi det første, eleverne ser i Spil → Mod en makker, er en gådestilling og ikke startstillingen (T1); alt i lærerens turnering holdt med 11 elever, så når T1 er rettet (eller "Spil → Start forfra → Ja" står på tavlen), er timen klar.

## Hvad holdt

Timen er gået igennem som i RAPPORT-454, med 11 elever og fire runder:
- **Navnene:** en tom linje og mellemrum efter navnene blev renset væk. Optællingen sagde "11 spillere, 4 runder, én sidder over hver runde (fri runde = 1 point)".
- **Projektoren i eget vindue:** knappen åbner `laerer.html#projektor`. På 1920 × 1080 rullede den aldrig, hverken lodret eller vandret, i nogen runde. Parringerne står i 41 px og stillingen i 41 px. Den mindste tekst (fri runde, overskrifter) er 25 px. "Stilling" alene viser vinderen med fed skrift og ♛ på 40 px. Resultater, Marc trykker, står på projektoren med det samme.
- **Resultater:** et andet resultat erstatter et forkert, og samme knap igen fjerner det. "Parr runde N" er låst, til alle borde har et resultat. At parre tog 34-60 ms.
- **Parringen:** fire forskellige elever fik fri runde (den nederste i runde 1), og ingen mødte den samme to gange. Farverne er højst 2 skæve, og ingen fik tre ens i træk.
- **I 300 turneringer i Node med 11 elever og tilfældige resultater:**
  - 0 omkampe og 0 fejl;
  - hver runde har præcis én fri runde, ingen får to, og den går altid til en af de laveste, der ikke har haft den;
  - 0 tilfælde af tre ens farver i træk;
  - pointforskellen ved et bord er højst 1 (ved 25 % af bordene);
  - højst 3 ms pr. parring.
- **Uheld:** en syg elev (flueben fjernet) blev ikke parret, og runde 2 fik 5 borde uden fri runde. "Fortryd parringen af runde 3" virker. En elev, der kom for sent, kom med i runde 3 ("Nykommeren er med fra næste runde."). Et resultat i runde 1 kan rettes, og stillingen regnes om.
- **Gem:** "Gem stillingen som fil" giver `turnering-2026-09-27-runde-4.csv` med BOM, alle 11 navne og de 4 fri runder. Sikkerhedskopien har alle 4 runder.
- **Slet:** "Slet turneringen og alle navne" fjerner navnene fra browserens lager (tilbage er kun `skak-laerer-fane-v1` og `skak-laerer-projektor-tema-v1`, uden navne), fra lærersiden og fra projektorvinduet ("Ingen turnering endnu"). Efter genindlæsning er de også væk.
- **Resten:** ingen JavaScript-fejl, intet netværk, og lærersiden ruller ikke sidelæns på 1280.

## Marcs time mandag (hvis T1 ikke er rettet)

1. Skriv på tavlen: **Spil → Mod en makker → Start forfra → Ja**.
2. Sæt runder til 3 i stedet for 4 (T3), og skriv to ens fornavne med forbogstav (T2).
3. Resten som i RAPPORT-454: projektoren i eget vindue, resultater ved bordene, "Parr runde N", Stilling alene til sidst, Gem stillingen som fil, Slet navnene.
