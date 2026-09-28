Skakken stadig klar til Marcs klasse: ja

Bhishak, ordre 656 blok 2, 28. sep. 2026. Skakken efter Chaturangas 649 (stormens ord "Alle:" og "Ny Gafler-rekord!", søjlerne på 44 px), set som en elev på 12 år (360 og 390 touch) og som Marc foran klassen (1280).

**Kort sagt.** 649 er to små, rigtige rettelser, og de virker. "Alle:" kan ikke længere læses som en sum, "Ny Gafler-rekord!" lover ikke for meget, og søjlerne kan rammes med en finger uden at starte en storm. Intet er blevet dårligere. Det, der stadig er rodet, er slutkortet: fire linjer med rekorder og tal under hinanden, og det er det kort, en elev ser efter hver storm.

## Hvad jeg målte

- Skak `main` @ `ea0e6f1` (merge af `ordre-649`), hentet med `git archive` til en midlertidig mappe. Skak-træet er ikke rørt. Chaturangas `outputs/RAPPORT-649.md` er læst.
- `outputs/kritik-656/skak-656.mjs`: headless Chromium (skaks playwright), 360 × 740, 360 × 640 og 390 × 844 med touch (×2), 1280 × 800 med mus. Alt net blokeret (0 kald), uret låst på mandag 28. sep. 10:00, 0 JS-fejl. Tal i `skak-656.json`, billeder `S656-*.png`.
- Syntetisk lager, samme som Chaturangas eget tjek (fem stormer bag sig, Gafler-rekord 4, rekord over alle 20), så tallene kan lægges ved siden af hans.
- Stormen er spillet med tryk: fem Gafler-gåder løst ved at slå stillingen op i gådebanken, så løb uret ud.

## Stormens ord

| Hvor | 360 | 390 | 1280 |
|---|---|---|---|
| Startkortet: "Alle: bedst 10 i dag · bedst 10 denne uge." | 1 linje | 1 linje | 1 linje |
| Slutkortet: rosen | "Ny Gafler-rekord!" | samme | samme |
| Slutkortet: "Ny rekord" over alle temaer (20 står) | vises ikke | vises ikke | vises ikke |
| Slutkortet: temalinjen "Gafler: bedst 5 i dag · bedst 5 denne uge · rekord 5." | 2 linjer, "rekord 5." alene | 2 linjer, "rekord 5." alene | 1 linje |

- **"Alle:"** er bedre end "I alt:". En 12-årig læser "Alle: bedst 10 i dag" som "den bedste af alle mine stormer i dag", ikke som en sum.
- **"Ny Gafler-rekord!"** i grønt er kort og glad, og ordet "rekord" står igen i linjen under. Godt.
- **Men** lige under rosen står "Din rekord på denne enhed: 20 gåder (9 i træk)." Eleven har lige fået at vide, at hun har ny rekord (5), og næste linje siger, at hendes rekord er 20. Det er to forskellige rekorder (temaet og alle temaer), og kortet forklarer ikke forskellen (S13).

## Søjlerne

- Hver søjle er en knap på 22 × 44 px på alle fire størrelser, uden mellemrum mellem dem.
- Tryk 6 px under den nyeste søjle: boblen "6 gåder (den nyeste)" kommer, og ingen storm starter (alle fire størrelser).
- Tryk midt mellem de to første søjler rammer en søjle, ikke baggrunden.
- "Dagens storm" kan rammes 2 px under sin overkant; luften fra søjlerne ned til den er 18 px.
- Ingen vandret rulning, hverken på startkortet eller slutkortet.
- Som elev: boblen står pænt ved siden af søjlerne og skjuler intet (`S656-360x640-3-boble.png`). Men **søjlerne har ingen overskrift**. Man ved ikke, at de er ens sidste stormer, før man trykker (S15).

## Marc foran klassen (1280)

- Gåde-fanen på 1280: brættet til venstre, stormens kort til højre, "Dagens storm (28/9)" står på første skærm (y 532), uden at rulle (`S656-1280-1-gaader.png`). Det er let at sige "tryk på Dagens storm" til en klasse.
- På telefonen står stormens kort under brættet (360: y 908, 1,2 skærme nede; 360 × 640: 1,4 skærme). Knappen "Storm" øverst ved "Vi finder dit niveau" er der; hvor den fører hen, har jeg ikke målt.
- Lærersiden: fire faner øverst (turnering, storm, koder, opgavebank), 1,17 skærme på 1280, rolig (`S656-1280-5-laerer.png`).
- **Ville Marc skamme sig? Nej.** Farverne er rolige, knapperne er store og tydelige, og startkortet siger kort, hvad Dagens storm og Tilfældig storm er. Det han kunne stoppe op ved, er slutkortets tal-trappe, hvis en elev spørger "hvorfor står der ny rekord, når min rekord er 20?"

## Det, der stadig er rodet

1. **Slutkortets rekorder (S13).** Under "Ny Gafler-rekord!" står tre linjer med tal: rekord 20 (9 i træk), Alle: 10 og 10, Gafler: 5, 5, rekord 5. Fire rekord-agtige tal til én storm. Efter hver storm er det her eleven kigger.
2. **"0 forkerte træk (−0 s)" (S14).** Et minus nul er mærkeligt for en 12-årig, og linjen "Ingen forkerte træk. Flot!" længere nede siger det samme.
3. **Søjler uden navn (S15)** og "rekord 5." alene på anden linje på 360 og 390 (#33, kendt fra Chaturanga). Småting, men de gør kortet mindre roligt.

## Fund

| Fund | Alvor | Hvad | Forslag til Chaturanga |
|---|---|---|---|
| S13 | middel | Slutkortet: "Ny Gafler-rekord!" og lige under "Din rekord på denne enhed: 20 gåder". To rekorder uden forskel forklaret; fire linjer tal. | Vis kun den linje, der hører til stormen (temaets), og læg "Din rekord på denne enhed" og "Alle:" bag en fold eller væk fra slutkortet. |
| S14 | lav | "0 forkerte træk (−0 s)" plus "Ingen forkerte træk. Flot!" siger det samme to gange med et minus nul. | Ved 0: vis kun "Ingen forkerte træk. Flot!". |
| S15 | lav | Søjlerne har ingen overskrift; man skal trykke for at vide, hvad de er. | Et lille "Dine sidste stormer" over dem. |
| S16 | lav | "Dagens storm (28/9)" (datoen i parentes) og bindestreg som tankestreg i to tekster ("10 sekunder - rigtige i træk", "videre - forkert"). | "Dagens storm" uden dato, og komma eller punktum i stedet for " - ". |

#33 ("rekord 5." alene på anden linje på 360 og 390) står allerede på Chaturangas liste.

## Ærlige grænser

- **Ingen rigtig 12-årig eller klasse har set det.** "Læser som", "roligt" og "skamme sig" er mit skøn ud fra skærmbillederne; linjer, knapstørrelser og tryk er målt.
- Touch er emuleret i Chromium (`hasTouch`); en rigtig telefon eller Safari kan flytte et tryk anderledes. Det gælder både søjlerne og "Dagens storm".
- Det syntetiske lager er Chaturangas og hænger ikke helt sammen: "bedst 10 i dag" mens søjlerne højst viser 6. Det er mit datavalg, ikke et fund i spillet.
- Én storm (Gafler, 5 løst, 0 forkerte). En storm med fejl eller uden ny rekord giver et andet slutkort.
- Headless Chromium på Windows, ikke en skole-pc eller projektor. Knappen "Storm" øverst og lærersidens storm-fane er ikke prøvet.
