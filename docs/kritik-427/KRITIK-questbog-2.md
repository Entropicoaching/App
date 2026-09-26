# Kritik 427: questbogen efter 417 og 420

Matematik `main` @ `28ba81d` (417 og 420 merget), kun læst via en kopi.
Grundlag: `docs/kritik-427/STATUS-427.md` (blok 1: Q1-Q9 og modellen),
Anes kæde med to fejl i headless Chromium på 390 x 844
(`outputs/kritik-427/ane-427.mjs`, `ane-427.json`, `A-*.png`).

**Levende for en 10-årig: nej, fordi** hvilen rammer den, der regner, lige
så hårdt som den, der gætter. 10 af de 14 quests har 3 opgaver og kræver 3 af
3, så én fejl er nok til hvilen. En elev med 60 % rigtige møder
"Tak, fordi du prøvede" cirka 10 gange på 150 opgaver og får 3 belønninger.
En elev med 80 % møder den 8 gange. Resten er blevet levende: opgaverne
fortsætter historien (Q1), gæt giver intet (Q2), og "Hjælp Ane" står lige dér
(Q3). Belønningerne kan ses (Q4), og kæden mel → brød → hue er et lille
eventyr med en hue, man kan se. Rettes N1 og N2, er svaret ja.

## Fund

**N1. Én fejl i tre giver hvil (alvorligst).** `mestringsKrav(3)` er 3,
og 10 af 14 quests har 3 opgaver. Forløbene hos Mølleren har samme krav. Men
et ikke-mestret forløb siger "samme forløb med nye tal", og eleven bliver.
En ikke-mestret quest sender hende væk, til hun har mestret et andet forløb.
I modellen (`sim-427.json`, 4000 elever pr. linje, 150 opgaver):

| | belønninger | hvil | quest-forsøg der bliver hvil | første quest bliver hvil |
|---|---|---|---|---|
| 60 % rigtige | 2,8 | 9,9 | 78 % | 79 % |
| 80 % rigtige | 10,4 | 8,2 | 44 % | 50 % |
| gætter | 0,13 | 3,4 | 96 % | 81 % |

For en 10-årig, der regner, føles det som straf: hun har løst alle tre, og
personen går. Forslag til Ganita (kun regnet i min model, spillet er urørt):
en quest med 3 opgaver kræver **2 af 3** i første forsøg, 4 opgaver fortsat
3 af 4. Så får 60 %-eleven 5,3 belønninger og 3,1 hvil (37 % af forsøgene),
og 80 %-eleven 12,5 og 1,8. Prisen er gætteren: fra 0,13 til 0,87
belønninger i snit, og 54 % af gætterne får mindst én på 150 opgaver. Vil man
holde gætteren ude, kan kravet være "2 af 3, og den forkerte rettet i andet
forsøg" (et gæt i andet forsøg rammer halvdelen af gangene). Den regel har
jeg ikke regnet.

**N2. Hvile-teksten siger ikke, hvad hun skal gøre.** Den står i skærmen
lige efter sidste svar (`A-08`):

> Ane: "Tak, fordi du prøvede. 2 af 3 var rigtige i første forsøg, og jeg
> skal se 3, før det holder. Mestr et forløb mere, så kommer jeg igen med
> nye tal."

Den er høflig, men "Tak, fordi du prøvede" er det, man siger til den, der
ikke klarede det. "Jeg skal se 3, før det holder" siger, at hendes 2 ikke
holder. "Mestr et forløb mere" er fagsprog og nævner hverken hvilket eller
hvor, selvom svaret ("Del ligeligt" hos Mølleren) står lige under.
Questbogen siger det samme uden sted (`A-10`): "Kom tilbage, når du har
mestret et forløb mere, så har jeg nye tal til dig." Kortets linje klarer
det bedre: "Møllerdrengen venter på dig: "Del ligeligt" hos Mølleren."
Forslag: Ane: "Godt regnet! Én drillede, og jeg vil gerne se dig klare
dem alle. Klar "Del ligeligt" hos Mølleren lige her under, så har jeg nye
tal til dig." Brug samme navn på forløbet i questbogens lås, som `laasReplik`
allerede gør for forløb-kravet.

**N3. Hintet til 2/2 siger to ting, der modsiger hinanden.** Eleven i
Møllens første forløb vælger 2/2, når 2 af 4 stykker er sået (`A-02`):

> Ikke helt. Hint 1 af 2: 2/2 er én hel, men kun nogle af stykkerne er
> sået. 2/2 sammenligner de såede med resten. En brøk af helheden skal have
> ALLE 4 stykker i nævneren.

To hint-grunde rammer samme svar, fordi 2 såede og 2 usåede også giver 2/2.
Så får hun begge. Den første er rigtig for hende, men den anden forvirrer.
Det er brøktrappens hint, ikke questbogens, men det er den første fejl, en
elev laver på vej til Ane. Forslag: når to grunde giver samme tekst, vis kun
den første.

**N4. "Hvad nu?" efter huen peger på en, hun ikke kan finde.** Efter *Brød
til alle* (`A-15`): "Hvad nu? Karen: "Kom tilbage, når du har hjulpet Hans
med "Sten til diget" og du har hjulpet Else med "Æbler til gaden".""
Karen, Hans og Else står ikke på kortet, og Grusgraven og Landsbygaden er
låste. Det er Q7, der kun er halvt lukket: `naesteEfter` finder en quest,
der venter på denne, men hos folk, hun ikke har mødt (Q8's regel gælder ikke
her). Forslag: tag kun en næste quest hos en synlig person, og ellers
Mølleren: "Klar "Hvilken portion er størst?" hos Mølleren, så står Niels med
et !."

**N5. Q9 er åben (lille).** Stien ligger 28 % under "Sporvognen" og 14 %
under "Grusgraven". Stendiget ligger 22 % under "Skoven og Søen"
(`browser-427.json`).

## Teksterne, hun møder, når hun fejler eller skal hvile

Alle står i skærmen på 390 px, når de kommer (`ane-427.json`, `inde: true`).

| Hvornår | Tekst (kort) | Venlig | Klar | Siger hvad hun skal |
|---|---|---|---|---|
| Fejl 1 (forløb 1) | "Ikke helt. Hint 1 af 2: 2/2 er én hel ... 2/2 sammenligner ..." | ja | nej (N3) | ja: prøv igen |
| Forløbet ikke mestret | "Du kom igennem, og 2 af 3 var rigtige ... Her er det samme forløb med nye tal." | ja | ja | ja: hun er allerede i gang |
| Fejl 2 (Anes quest) | "Ikke helt. Hint 1 af 2: Nævneren ... Her er det 6." | ja | ja | ja |
| Ane hviler | "Tak, fordi du prøvede ... Mestr et forløb mere ..." | halvt (N2) | ja | nej: hvilket, hvor? |
| Questbogen mens hun hviler | "Kom tilbage, når du har mestret et forløb mere ..." | ja | halvt | nej: intet sted |
| Kortet mens hun hviler | "Møllerdrengen venter på dig: "Del ligeligt" hos Mølleren." | ja | ja | ja |
| Forløb 2 mestret | "Ane, bagerkonen, står med et ! ved møllen ..." + "Hjælp Ane" | ja | ja | ja |

## Hvad der holder

- Hele kæden går uden omveje: forløb 1 → "Hjælp Ane" → hvil → forløb 2 →
  "Hjælp Ane" igen → Melsækkene → "Nyt i questbogen: Brød til alle" → "!"
  → Bagerhuen på takkekortet og på portrættet. Med to fejl tager den 10 min
  elevtid. 0 sidefejl.
- Efter hvilen står eleven ved det rigtige forløb ("Del ligeligt"), og Ane
  kommer igen med nye tal, så snart det er mestret. Hvilen er kort for den,
  der regner (median 7-10 opgaver).
- Gæt giver næsten ingen belønning: browser-gætteren fik 0 på 150 opgaver,
  og i modellen får 12 % af gætterne én.
- Alle 14 quests har opgaver om det, personen bad om.
