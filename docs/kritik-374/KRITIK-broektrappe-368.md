# Kritik af brøktrappen efter 368, spillet som elev på en telefon

**Klar til klassen: ja.** Møllens 8 forløb kommer i den rækkefølge, som BROEK-TRAPPE.md lover. Hvert bevidst forkert svar gav et hint, der siger *hvorfor* netop det svar er forkert. Mestringen og låsene virker, og ingen elev sidder fast uden hjælp: efter to forkerte svar vises løsningen.

To ting bør Ganita rette før eller lige efter første time:
- **B1:** Kirken stiller trin 2 og 3 på dag 1.
- **B2:** Mølleren siger aldrig "du har gået hele brøktrappen", og ingen af de otte "klaret"-replikker vises.

Ingen af de to stopper en time. Læreren kan sige "start i Møllen".

Grundlag: `npm run verify:kritik-374` (`scripts/kritik-374.mjs`). Scriptet trækker matematik `main` (`423ac87`) ud med `git archive` og kører `spil.html` headless på 390x844 (touch, 2x) med en flygtig profil. Figuren hedder "Ravn", og der er ingen elevdata.

Eleven læser hver opgave og regner facit ud. I første runde af hvert forløb laver eleven bevidst den typiske fejl på alle opgaver fra forløbets *nye* trin: tæller og nævner byttet, talt de umalede, forkert nævner ved addition, kun nævneren ganget, "flere dele er større", glemt at dele helheden i grupper, tæller+tæller/nævner+nævner, og nævnerne lagt sammen i blandede tal. Mestringen skal så fejle. Derefter svarer eleven rigtigt og vælger det uforkortede svar (4/6 for 2/3), når det står der.

Eleven har også spillet Kirkens første forløb helt og har i forløb 7 trykket det samme forkerte svar tre gange. Alle svar og beskeder står i `maalinger.json` under `broek`, og skærmbillederne er `outputs/kritik-374/broek-*.png`. Konsollen var tom. Intet er rettet i matematik.

## Det der holder (målt)

| Løfte i BROEK-TRAPPE.md | Set i spillet |
|---|---|
| Forløb k: nyt trin, nyt, trinnet før, nyt, og fra forløb 5 ét ældre | Forløb 2 `[2,2,1,2]`, 3 `[3,3,2,3]`, 4 `[4,4,3,4]`, 5 `[5,5,4,5,3]`, 6 `[6,6,5,6,1]`, 7 `[7,7,6,7,1]`, 8 `[8,8,7,8,1]`. Andet gennemløb med nye tal følger samme mønster (fx 8: `[8,3,8,8,7]`...). Forløb 1 har tre opgaver fra trin 1. **Holder.** |
| Hint der siger hvorfor | Alle 47 forkerte svar fik et hint til netop det svar. Tre eksempler: "Du har lagt nævnerne sammen. Nævneren siger, hvilken slags dele det er: 7-dele plus 7-dele er stadig 7-dele." "Flere dele betyder MINDRE dele. Når sækken deles i 6, bliver hver del mindre end når den deles i 4." "4 er 1/8 af 32. Der skal bruges 3 af de lige store grupper, så gang med 3." **Holder.** |
| 4/6 er rigtigt for 2/3 | Uforkortede svar blev dømt rigtige med ros, fx "Rigtigt! 4/6 kan også skrives 2/3." og "Rigtigt! 8/12 kan også skrives 2/3.", i alle forløb, hvor de stod (`broek-01-ros.png`). **Holder.** |
| Mestring 3/4 i første forsøg, ellers samme forløb med nye tal | Med 1 af 4 rigtige i første forsøg: "Du kom igennem, og 1 af 4 var rigtige i første forsøg. Mølleren vil se mindst 3, før forløbet tæller som klaret. Her er det samme forløb med nye tal." Det nye gennemløb havde nye tal. Med alle rigtige gik spillet videre. Kravet står ved opgaverne ("mestret ved 4 rigtige i første forsøg"). **Holder.** |
| Grusgraven åbner på mestring af Møllens forløb 1-2 | Efter forløb 1 er den stadig låst ("Mestr Møllens forløb 1-2"). Efter forløb 2 er den åben. **Holder.** |
| Ingen elev sidder fast | Efter to forkerte svar på samme opgave kommer "Løsningen: Fælles nævner 9: 1/3 = 3/9 og 5/9 = 5/9. 3 + 5 = 8, altså 8/9 ..." og knappen Videre (`broek-07-loesning.png`). **Holder.** |
| Trykflader | Ingen knap under 44 px på Møllens skærme. |

## Fund

Alvor: **vigtigt** (en elev eller lærer bliver snydt for noget lovet), **irriterer**, **kosmetisk**.

**B1. Kirken stiller trin 2 og 3, før Møllen har introduceret dem. Alvor: vigtigt.**
- Sted: Kirken, forløb 1 "Det du allerede kan", åben fra start.
- Målt: de tre opgaver er trin 1, 2 og 3 (`kirkenFoerst`, `broek-00-kirken-trin3.png`: "Én dag delte mølleren en sæk i 3 lige store dele, en anden dag i 4 ... Hvilken portion var størst?"). Eleven har endnu ikke åbnet Møllen.
- Hvad eleven oplever: titlen "Det du allerede kan" og replikken "lad os se, hvad du husker" spørger om noget, eleven ikke har lært.
- BROEK-TRAPPE.md siger, at Kirken "aldrig kræver et trin, Møllen ikke har introduceret". Det holder kun, hvis eleven har været i Møllens forløb 3 først. Trappens regel 1 ("Ingen opgave kræver et trin, eleven ikke har mødt") brydes altså i landsbyen, selvom Møllen overholder den.
- Forslag: lås Kirken på Møllens forløb 3, eller lad Kirkens første forløb bruge trin 1 alene.

**B2. Mølleren siger aldrig, at trappen er gået, og ingen "klaret"-replik vises. Alvor: vigtigt.**
- Sted: afslutningen af hvert forløb, især forløb 8.
- Målt: efter forløb 8 står der kun "Alle 8 forløb klaret — Mølleren har intet mere til dig lige nu." (`broek-99-slut.png`). Ordene "hele brøktrappen" står ingen steder på siden (`slut.heleTrappenNaevnt: false`).
- I koden bliver `quest.replikker[1]` aldrig vist. Kun `replikker[0]` renderes (`spil-app.js` linje 455). Det gælder alle forløb og alle steder.
- RAPPORT-368 siger: "'Du har gået hele brøktrappen' siges kun efter forløb 8". Det passer ikke med det, eleven ser. Eleven, der netop har mestret blandede tal, får ingen afslutning. Forløbet skifter bare til det næste.

**B3. Hintet lander ved skærmens underkant. Alvor: irriterer.**
- Målt: 27-28 af 47 hint sluttede under vinduets bund (844 px) i to kørsler, op til 43 px nede (`hintSynlig`).
- Svarknapperne ligger nederst, og hintet kommer under dem. Den sidste linje eller boksens kant er ofte skåret (`broek-02-hint-trin2.png`).
- En elev, der gætter igen uden at rulle, ser måske ikke "hvorfor".

**B4. "Du har ganget med 1" ved brøk af en mængde. Alvor: irriterer (fagligt forvirrende).**
- Sted: trin 6, når tælleren er 1.
- Målt: "Mølleren har 15 sække mel. 1/3 af dem skal til bageren." Eleven svarer 15 (glemmer helheden og giver hele bunken) og får "Du har ganget med 1, men ikke delt i 3 lige store grupper først."
- Eleven har ikke ganget. Eleven har svaret med hele mængden. Hintet burde sige "15 er alle sækkene. Del dem i 3 lige store grupper, og tag én."
- I samme familie er svarmuligheden 18 til "1/2 af 12", som er mere end hele bunken. Den er ikke forkert, men en elev kan afvise den uden at regne.

**B5. Hint 2 er det samme som hint 1. Alvor: irriterer.**
- Når eleven trykker det samme forkerte svar igen, står der "Hint 2 af 2" med præcis samme tekst (fx "Du har skrevet begge brøker med nævneren 9, men glemt at gange tællerne ...").
- Det andet hint giver ingen ny hjælp, fx en udregnet mellemregning. En elev, der ikke forstod første gang, får samme sætning og derefter facit.

**B6. Mestring uden en hjælp mere, når den fejler igen og igen. Alvor: irriterer (ikke set som en blokering).**
- Et forløb, der ikke er mestret, gives igen med nye tal, i det uendelige, og hver gang med samme slags hint.
- Der kommer ingen lettere opgave og ingen besked som "spørg læreren". Eleven kommer altid videre til næste opgave, så eleven sidder ikke fast. Men en elev, der fejler forløb 7 tre gange, kan blive i Møllen i en hel time uden at blive fanget.
- Mestringen gemmes kun i hukommelsen, så læreren kan ikke se det bagefter (det er med vilje: ingen elevdata).

**B7. Tankestreg i hver besked. Alvor: kosmetisk.**
- "Ikke helt — Hint 1 af 2." og "Alle 8 forløb klaret — Mølleren ...". Flere replikker har også en em-dash, fx "Fælles nævner — det er hele hemmeligheden." og "Regnestykket går op — akkurat som sækkene.".
- Det er ikke en regel for spillet, men det bryder husets stil.

**B8. Svarmuligheder, der er hele. Alvor: kosmetisk.**
- Trin 1 viser "5/5", "3/3" eller "2/2" som forkerte svar. Fx "10 felter, 5 malet: 5/5 ; 1/2 ; 10/5".
- Det er gyldige distraktorer, men hintet til dem er det generelle "Tæl de malede felter ...", ikke hvorfor 5/5 er hele hjulet.

## Rækkefølge for Ganita

1. B2: vis `replikker[1]` efter et mestret forløb. Det er en linje i `spil-app.js`, og forløb 8's sætning kommer så med.
2. B1: lås Kirken på Møllens forløb 3, eller begræns dens første forløb.
3. B4 og B5: hint-tekster i `broek-trappe.js`.
4. B3: flyt hintet over svarknapperne, eller rul det ind i syne.
5. B6-B8, når der er tid.
