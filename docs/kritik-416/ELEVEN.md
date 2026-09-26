# Ordre 416, blok 1: questbogen spillet af en 10-årig

Matematik `main` @ `89abfd2` (413 merget), kun læst: `git archive` til en kopi
i scratchpad, `spil.html` som committet (samme commit som `src/`). Kørt med
`node outputs/kritik-416/elev-416.mjs <kopi>`: headless Chromium, 390 x 844,
touch, 2x, flygtig profil, **ny figur** ("Ravn", et fantasinavn), ingen
forudsat tilstand. Målinger i `outputs/kritik-416/elev-416.json`, 30
skærmbilleder `E-01` til `E-30`. 0 sidefejl.

Eleven får intet at vide. Modellen (står også øverst i scriptet):
eleven kan regne og svarer rigtigt; trykker på den største nye knap på
skærmen; trykker på et "!" kun hvis det er inden for skærmen; læser tekst med
2,5 ord/s; 20 s pr. opgave. Tiderne nedenfor er **elevtid efter den model**,
ikke maskintid.

## Forløbet

| Elevtid | Tryk | Hvad sker |
|---|---|---|
| 0:39 | 3 | Figur lavet. Kortet og Møllens forløb 1 "Lige store dele". Ingen "!" endnu; knappen hedder bare "Questbogen" (E-02). |
| 2:05 | 8 | Forløb 1 mestret (3 af 3). Grønt "klaret"-felt og "Byen vågner"-kort. **Det første "!" står over Ane**, 24 px, gult, inden for skærmen (top 184 px), øverst i stakken (E-04, E-05). |
| 2:05 | 9 | Eleven trykker på "!". Questbogen åbner, slået op på "Mel til bageren", grunden står i skærmen uden at rulle (E-06). |
| ~2:40 | 10 | "Hjælp Ane": questen står i Møllens panel med navn, grunden igen, belønningen og første opgave, alt inden for skærmen (E-07). |
| 3:41 | 17 | Tre opgaver løst. Kortet ruller op, tre melsække popper frem ved møllen med ringen om; takkekortet står under kortet (E-08 til E-10). |
| 5:32 | 26 | Møllens forløb 2 mestret. **To "!"**: Ane igen ("Brød til alle") og Else på Landsbygaden (niveau 3 nået via questens erfaring) (E-13). |
| 7:06 | 35 | "Brød til alle" klaret: bagerhuen (E-15 til E-19). |
| 8:56 | 43 | Forløb 3 mestret. Tre "!" (Niels, Graveren, Else); Graverens står uden for skærmen (E-21). |
| 10:32 | 52 | "Ænderne i åen" klaret: ænder i åen (E-22 til E-27). |
| genindlæst | | Sækkene, ænderne, huen (portræt og kort) står der; "Questbogen 2 nye"; bogen: Nye 2, Klaret 3, Låst 9 (E-28 til E-30). |

## Svarene på ordrens spørgsmål

**Hvornår ser eleven det første "!", og hvor lang tid går der?**
Efter Møllens første forløb, 3 opgaver og 8 tryk, ca. 2 minutter elevtid for
en der svarer rigtigt. En elev med én fejl i første forsøg får forløbet om
med nye tal (mestring 3 af 3): ca. 3½ minut. 413's "inden for de første ti
minutter" holder.

**Trykker eleven på det?** Sandsynligvis, men af held. "!" står tilfældigvis
inden for skærmen, fordi rulningen står der, hvor eleven svarede, og kortets
nederste tredjedel er med. Der er **intet andet på skærmen, der peger på
det**: klaret-feltet og "Byen vågner" nævner ikke Ane, og "Questbogen 1 ny"
står uden for skærmen (scrollY 713). "Byen vågner" er det store, nye kort med
sin egen ring og knap, så "!" konkurrerer med to andre nyheder på samme
skærm. Det er ikke afprøvet med et barn, om 24 px gult "!" vinder (se fund Q2).

**Læser eleven grunden?** Den står to gange, begge gange uden at rulle: i
bogen (kursiv, i citationstegn, over "Hjælp Ane") og i panellet over
opgaven. Den er kort (17-20 ord). Så den **bliver set**. Men den **passer ikke
til det, der følger** i "Mel til bageren": Ane beder om hjælp til at dele
melsække, og alle tre opgaver handler om møllerens *mark*, der er *sået*
(E-07, `elev-416.json`). En 10-årig, der læser grunden, lærer at den er
ligegyldig (fund Q1).

**Klar tre quests, og se belønningerne.**
- *Melsække* (kort): popper frem, men er små på 390 px (ca. 25 px høje ved
  møllen, E-09). Takkekortet under kortet viser dem stort og siger "Den står nu
  på kortet og bliver stående". Godt "dop".
- *Bagerhuen* (figur): takkekortet viser figuren med huen (E-18), fint. Men
  selve "huen daler ned" sker på portrættet øverst på siden, **275 px over
  skærmen** (kortets top -275 px): animationen ses ikke (fund Q4).
- *Ænder i åen* (kort): popper frem helt nede i kortets kant under møllen,
  hver and ca. 10 px; uden ringen havde jeg ikke fundet dem (E-26). Takkekortet
  viser dem stort.

**Vil eleven videre?** Ja, på kort sigt: efter hver quest står der en ny
person med "!" og en belønning, man kan se i bogen. Men efter "Mel til
bageren" siger takkekortet ikke, hvad der er det næste ("Brød til alle" er
låst til forløb 2), og efter genindlæsning handler "Siden sidst"-linjen kun
om forløbet, ikke om questen (E-29).

**Genindlæs.** Alt står der: sække, ænder, hue på portræt og kort, 3 klaret i
bogen. Ingen "pop" igen. Holder.

## Andet set undervejs

- Else på Landsbygaden får "!" allerede efter Møllens forløb 2, fordi
  questenes +10 erfaring bringer eleven til niveau 3 (413 skriver det selv).
- Graverens "!" står halvt oven på skiltet "Kirken og Landsbygaden" (E-29).
- Questbogen viser alle 13 låste quests med belønning fra første åbning. Det
  frister, men det er en lang liste (se blok 2, eventyr eller opgaveliste).
