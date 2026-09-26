# Kritik 416: questbogen i matematikspillet

Matematik `main` @ `89abfd2` (413 merget), kun læst via en kopi. Grundlag:
`docs/kritik-416/ELEVEN.md` (blok 1, ny figur, 390 px), `docs/kritik-416/QUESTENE.md`
(blok 2, alle 14 quests), målinger i `outputs/kritik-416/`.

**Levende for en 10-årig: nej, fordi** grunden, personen giver, og de
opgaver, der kommer bagefter, ikke hænger sammen i 9 af 14 quests (4 aldrig), så det at læse grunden
ikke betaler sig (Q1), og fordi den korteste vej
til to belønninger er at trykke på knapper uden at regne (Q2). Rammen er
ellers rigtig: det første "!" kommer efter 2 minutter, grunden bliver set,
takkekortet er et godt "dop", og Anes mel → brød → hue føles som et lille
eventyr. Rettes Q1-Q3, er svaret ja.

## Fund

**Q1. Grunden og opgaverne passer ikke sammen (alvorligst).** Over 300 salte
pr. quest: *Et nyt bed*, *Det nye klokkereb*, *Stien over bakken*, *Kassen skal
stemme* har **0 %** opgaver om det, personen bad om; *Lys*, *Æbler*, *Sten til
diget* 21-26 %. Den første quest en elev møder, *Mel til bageren*, gav i blok 1
tre opgaver om møllerens mark, der er sået. Årsagen er én: generatorerne er
stedets, med stedets personer. Før/forslag pr. quest i QUESTENE.md; kort:
en `kulisse`/`emne`-parameter i trin 1 af brøktrappen, i omkreds/areal/omregn
og i pris/kasse, som måletrappen allerede har (`KIRKE_KULISSE`).

**Q2. Gæt giver belønning og fuld erfaring.** 3 svarmuligheder og 3 forsøg:
den, der prøver knapperne oppefra, får altid "Rigtigt!" og +10, aldrig
"Løsningen" og 0. Gætte-eleven nåede niveau 3 på 7 opgaver uden at mestre
noget, derefter **Æbleboden efter 10 og Halstørklædet efter 20 opgaver**, og
niveau 7 efter 38. Forslag: +10 kun ved rigtigt i første forsøg (+5 i andet,
0 i tredje), og Æblerne/Kassen bag "Klar Landsbygadens forløb 1-2 med 3 af 4
rigtige i første forsøg" (samme mestringsregel som Møllen).

**Q3. Det første "!" kommer uden varsel.** Efter Møllens forløb 1 står "!" over
Ane i skærmen, men kun fordi rulningen tilfældigvis står der. Klaret-feltet og
"Byen vågner" nævner ikke Ane, "Questbogen 1 ny" står uden for skærmen, og
"Byen vågner" (stort kort med egen ring) konkurrerer med det. Forslag: én linje
nederst i klaret-feltet, når en quest lige er åbnet: "Ane, bagerkonen, står med
et ! ved møllen. Hun har brug for hjælp." med knappen "Hjælp Ane".

**Q4. Belønningen er synlig i øjeblikket, ikke bagefter.** På 390 px: Æbleboden
16 x 12 px, Ænderne 31 x 13 px i kortets nederste kant, Melsækkene 20 x 20 px;
med alle 14 klaret drukner de i landsbyens egne tegninger (Q-02). Huen
"daler ned" på portrættet 275 px over skærmen. Kun den nyeste titel vises
("Klokkerens hjælper" forsvinder, når "Sporvognens ven" kommer). Forslag:
belønningerne 1,5-2 gange større, et lille flag/mærke ved det, *man selv* har
fået; lad huen dale ned på takkekortets figur (den er i skærmen) og vis alle
titler i questbogens "Det du har fået".

**Q5. "Et nyt bed" bryder questbogens egen trin-regel.** Den åbner med Kirken
(Møllens forløb 1-3) og bruger måletrappens omkreds (trin 4) og areal (trin 5),
mens Grusgraven kan stå på 0 af 6 (set i blok 1). Forslag: kræv Grusgravens
forløb 4 (eller 5), eller giv den `maal1`/`maal2` med bed-kulisse.

**Q6. Genvejen gør ingenting.** "Stien over bakken" tegnes, men figuren går
ikke ad den (413 siger det). En 10-årig, der får en genvej, prøver den.
Forslag: når stien er klaret, går figuren ad stien mellem Grusgraven og
Sporvognen (FLIP-animationen har allerede to punkter; giv den et tredje).

**Q7. "Hvad nu?" mangler efter en quest.** Efter *Mel til bageren* er intet nyt
åbnet, og takkekortet siger ikke, hvad der skal til ("Mestr Møllens forløb 2,
så har Ane mere"). Efter genindlæsning nævner "Siden sidst" kun forløbet.
Forslag: brug `mangler()` til én linje på takkekortet, når `nyeQuests` er tom.

**Q8. Questbogen ligner et skema.** Første åbning: "Nye (1)" og derefter
"Låst (13)" med fagsprog ("Mestr Møllens forløb 1-2"). Forslag: vis kun de
låste quests hos folk, eleven har mødt eller kan se på kortet, og skriv
låsen som personens replik ("Kom tilbage, når du har hjulpet mølleren med
at dele ligeligt").

**Q9. Småting.** Graverens "!" står halvt oven på skiltet "Kirken og
Landsbygaden" (E-29). Stien ligger 27 % under "Sporvognen"-knappen og 14 % under
"Grusgraven".

## Hvad der holder

- Det første "!" efter 3 opgaver og ca. 2 minutter (8 tryk); 3½ minut med én
  fejl. 0 sidefejl i alle kørsler.
- Et tryk på "!" slår bogen op på den rigtige quest, og grunden står i
  skærmen uden at rulle, både i bogen og i panellet.
- Takkekortet (tak-replik, billede af tingen, "Du fik ... og den bliver
  stående", "Nyt i questbogen") er et rigtigt "dop" uden larm.
- Genindlæsning: sække, ænder, hue på portræt og kort, 3 klaret. Intet popper
  igen. En klaret quest har ingen "Hjælp"-knap.
- Kæderne er korte og logiske; låseteksterne er præcise.
- Sporvognens to quests (Inger, Poul) passer 100 % til grunden: sådan skal
  resten føles.
