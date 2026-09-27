skakken stadig klar til eleverne: ja
kendte partier er rigtige: ja

# Skakken efter Chaturangas 544: temaer fra lichess og kendte partier (kritik 552, blok 1)

Målt 27. sep 2026 på skak `main` @ `5e6756c` (544 er merget). 547 (`bibliotek-547`) er
**ikke** merget i `main`, så den er ikke vurderet her; skak-træet står på den gren og er ikke
rørt. Alt er hentet med `git archive`.

Eleven er min elev fra 517-540: 12 år, headless Chromium uden net, 360 og 390 px med touch
(tap) og 1280 px med mus. Hun trykker sig frem og spiller sit eget træk først (mat i 1, ellers
største slag, ellers skak, ellers tilfældigt), før hun løser.

| Script | Hvad | Resultat |
|---|---|---|
| `outputs/kritik-552/partier-552.mjs` | De ti partier mod min reference, udsagnene i historierne regnet efter på brættet, andre træk der også vinder | 41/41 |
| `outputs/kritik-552/skak-552.mjs` | "Øv et tema" (alle 12 temaer løst) og alle ti kendte partier på 360, 390 og 1280 | 41/41 |
| `outputs/kritik-552/rul-552.mjs` | Hvad eleven ser lige efter et tryk på et kendt parti og på "Øv gafler" | se K13 |
| `outputs/kritik-552/pulje-552.mjs` | Hvor gåderne i hvert tema kommer fra | se K17 |

## Øv et tema

- **Temaerne er på dansk og rigtige.** 13 knapper ("Som de kommer" + 12): "Øv mat i 1", "Øv mat
  i 2", "Øv mat på bagerste række", "Øv gafler", "Øv bindinger", "Øv spyd", "Øv afdækkede
  angreb", "Øv ofre", "Øv mellemtræk", "Øv angreb på f7", "Øv forvandling", "Øv slutspil". Intet
  engelsk på knapperne. Forklaringerne passer til temaerne og er til at forstå for en 12-årig
  ("Én brik angriber to på én gang. Modstanderen kan kun redde den ene."). Knapperne er 59-80 px
  høje på telefonen.
- **Hvert tema giver en gåde med netop det tema** på alle tre bredder (slået op i appens fem
  banker). "Du øver: Gaffel (0 løst)" står over brættet, og efter løsningen "1 løst" ved knappen.
  Et forkert træk giver "Ikke den vej. Tag trækket tilbage og prøv igen.", og det kan tages
  tilbage.
- **Sværheden er rigtig for en ny elev.** Gåderne følger elevens rating: en ny elev fik gåder på
  437-825 i de 12 temaer, og efter 10 gåder stod ratingen på 853. Lichess-gåderne går op til
  1800, men de kommer først, når ratingen er der.
- **Licenslinjen står under gåderne** på alle bredder: "Gåderne med temaer er fra lichess.org's
  åbne gådedatabase (database.lichess.org, fri til alle, CC0)." Lichess står også i appens
  licenstekst.
- 0 netkald, 0 fejl på siden, ingen vandret rulning.

## Kendte partier: hvert parti

Min reference er standardopgivelsen af de ti partier, som jeg kender dem fra de kendte samlinger.
Den er skrevet efter hukommelsen og ikke hentet fra nettet (ingen net i ordren).
`partier-552.mjs` sammenligner hvert halvtræk i appen (partiet frem til gåden + løsningen) med
den.

| Parti | Spillere, sted, år | Træk | Historien regnet efter | Usikkert |
|---|---|---|---|---|
| Partiet i operaen | Morphy - hertugen af Braunschweig og grev Isouard, Paris 1858 | 33/33 rigtige, slutter 17.Td8# | Mat med tårn og løber, de to brikker han havde tilbage: rigtigt | Datoen (oktober eller 2. november 1858) svinger; år og sted gør ikke |
| Det udødelige parti | Anderssen - Kieseritzky, London 1851 | 45/45, slutter 23.Le7# | Mat med de tre lette brikker, begge tårne, en løber og dronningen ofret: rigtigt. Venskabsparti under London 1851: rigtigt | Enkelte gamle kilder bytter træk 18-19 (Lxg1/Dxa1+); appen har standardopgivelsen |
| Det stedsegrønne parti | Anderssen - Dufresne, Berlin 1852 | 47/47, slutter 24.Lxe7# | Dronningeofret på d7 og mat med to løbere: rigtigt | - |
| Dronningeofret på d8 | Réti - Tartakower, Wien 1910 | 21/21, slutter 11.Ld8# | 10.Lg5+ er dobbeltskak fra løber og tårn, mat i 11. træk: rigtigt | Et friparti, ikke et turneringsparti; "to af tidens stærkeste spillere" er for meget i 1910 (K16) |
| Kongejagten | Edward Lasker - Thomas, London 1912 | 35/35, slutter 18.Kd2# | Kongen går g8-h7-h6-g5-f4-f3-g2-g1: rigtigt | - (men se K14) |
| To løbere ofres | Emanuel Lasker - Bauer, Amsterdam 1889 | 43 halvtræk rigtige (gåden stopper ved 22.Dd7; partiet gik til 33.Dg7+) | Løberne ofres på h7 og g7; verdensmester i 27 år (1894-1921): rigtigt | - |
| Tårnet, der ikke kan slås | Steinitz - von Bardeleben, Hastings 1895 | 49/49, slutter 25.Txh7+ | Von Bardeleben forlod salen: rigtigt. "kan ikke slå uden at blive sat mat": kun delvis (K15) | - |
| Rubinsteins udødelige | Rotlewi - Rubinstein, Łódź 1907 | 50/50, slutter 25...Th3 | Dronningen står og slås (22...Txc3 23.gxh4), tårnoffer på d2: rigtigt | Spillet 26. dec. 1907; nogle samlinger skriver 1907/08. Łódź hørte dengang til det russiske kejserrige, ikke til et selvstændigt Polen |
| Guldmønterne | Levitsky - Marshall, Breslau 1912 | 46/46, slutter 23...Dg3 | Dronningen på g3 kan slås på tre måder (Dxg3, fxg3, hxg3): rigtigt | Guldmønterne er Marshalls egen fortælling; appen skriver "ifølge historien" (godt) |
| Tårnofferet på h1 | Bent Larsen - Spasskij, Beograd 1970 | 34/34, slutter 17...gxf1=D+ | 17 træk, tårnofferet 14...Th1, Larsen ved førstebrættet foran Fischer, Spasskij verdensmester: rigtigt | - |

Alle spillere, steder og år er rigtige. Ingen træk afviger fra min reference.

**I appen** (alle tre bredder): hvert parti står rigtigt på brættet, "Hvid trækker (Paul Morphy).
Find det træk, der blev spillet." (sort i tre af partierne), historien er skjult til gåden er
løst og vises så ordret, flueben i listen, "Næste kendte parti" (ikke efter det sidste),
"10 af 10 løst" også efter genindlæsning. Elevens eget første træk giver "Ikke den vej".

**Andre træk, der også vinder:** i ingen af partierne findes et andet mat i 1 eller et mat i 2
med skak, bortset fra 18.O-O-O# i kongejagten (se K14). Så "Ikke den vej" rammer ikke et træk,
der er lige så godt, så vidt min søgning rækker (mat i 1 og 2 med skak; ikke længere
kombinationer).

**Sproget for en 12-årig:** "rådede sammen" og "adelsmænd" er gammeldags, men forstås i
sammenhængen. "Dobbeltskak" og "løberoffer" er skakord; en elev, der ikke kender dem, kan stadig
følge historien. Det er ikke et fund.

## Fund

| # | Alvor | Fund |
|---|---|---|
| K13 | middel | **Brættet er ikke på skærmen efter trykket.** På telefonen ligger "Kendte partier" og "Øv et tema" under brættet. Efter et tryk på "Partiet i operaen" står brættet 1,9 skærme over (360 px) og 1,6 skærme over (390 px), og "Hvid trækker (Paul Morphy) ..." er heller ikke på skærmen. Det eneste, der ændrer sig, er at knappen bliver markeret og titlen "Partiet i operaen (Paris 1858)" dukker op nederst (`K-390-4-efter-tryk.png`). Appen ruller til `#gaade-titel`, der står under listen. Efter "Øv gafler" står brættet 1,3-1,6 skærme over (`K-390-5-efter-tema.png`). På 1280 er brættet 0,9 skærm over efter et kendt parti og delvis synligt efter et tema. En 12-årig tror, der ikke skete noget. |
| K14 | lav | **Kongejagten: O-O-O# bliver kaldt det, Lasker spillede.** O-O-O# godtages (rigtigt, det er også mat), men beskeden er "Løst! Præcis sådan spillede Edward Lasker." Lasker spillede 18.Kd2#. Det er netop det, partiet er kendt for (O-O-O# havde været endnu smukkere). En elev, der fortæller klassen det, får det forkert. |
| K15 | lav | **Steinitz: "som sort ikke kan slå uden at blive sat mat"** gælder kun kongen. 22...Dxe7 giver ikke mat: 23.Txc8+ Txc8 24.Dxc8+ vinder en officer (regnet efter på brættet). Rigtigere: "som sort ikke kan slå: med kongen bliver han sat mat, med dronningen taber han en officer". |
| K16 | lav | **Réti-Tartakower:** "et af de korteste partier mellem to af tidens stærkeste spillere" passer ikke helt i 1910, hvor Réti var 21 og Tartakower 23; de blev først blandt de bedste senere, og det var et friparti. "en dobbeltskak fra løber og tårn gav mat i 11. træk" kan læses, som om dobbeltskakken var mat; dobbeltskakken kom i 10. træk, og løberen satte mat i 11. |
| K17 | lav | **"Øv et tema" og de nye gåder:** i seks temaer (mat i 1, mat i 2, gaffel, binding, spyd, afdækket angreb) er lichess-gåderne fra 544 kun 3-15 % af puljen; resten er de gamle banker uden modstanderens træk markeret. I de seks andre er der kun 15 gåder under rating 900 pr. tema, så en begynder, der øver "ofre" meget, får hurtigt gåder over sit niveau eller de samme igen. Ikke forkert, men RAPPORT-544's "modstanderens træk markeret" gælder kun en del af gåderne. |

Åbne fra 540: K12 er lavet i 547, som ikke er merget; den er ikke målt igen her.

## Dom

**skakken stadig klar til eleverne: ja.** Temaerne virker, er på dansk og følger elevens
niveau, licensen står der, og intet er gået i stykker. K13 bør rettes før en time, hvor eleverne
selv skal finde de kendte partier på telefonen (rul til brættet efter trykket).

**kendte partier er rigtige: ja.** Alle ti partier har rigtige spillere, sted, år og træk, og
historiernes udsagn holder på brættet. To sætninger bør skarpes (K15, K16), og beskeden efter
O-O-O# bør sige, at Lasker spillede Kd2# (K14).

## Ærlige grænser

- Min reference er min hukommelse af de kendte opgivelser, ikke et opslag. Hvor jeg er usikker,
  står det i tabellen. Et parti, som både Chaturanga og jeg husker forkert på samme måde, ville
  ikke blive fanget.
- Søgningen efter andre vindende træk går kun til mat i 1 og mat i 2 med skak.
- Eleven er et script, ikke et barn. Sproget er vurderet af mig.
- 547 er ikke merget og ikke målt.
