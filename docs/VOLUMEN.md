# Volumen pr. muskelgruppe — hvad tallene betyder

Ordre 177, første version. Ordre 185 tilføjede "denne uge: gennemført/
planlagt", en udviklingsgraf, og en redigeringsvej for kortlægningen (se
nedenfor). Kortet ligger på atletsidens "Oversigt"-fane.

## Hvad tallene er

For hver muskelgruppe viser kortet, for de seneste seks uger: hvor mange
**gennemførte** sæt der ramte den gruppe. To tal, adskilt med skråstreg:

- **Direkte** — sæt fra øvelser hvor gruppen er hovedbevægelsen (fx knæ ved
  squat). Hvert sæt tæller som 1.
- **I alt** — samme, plus sæt fra øvelser hvor gruppen er en væsentlig
  medvirkende (fx ryggen ved squat), talt med halv vægt. Forskellen mellem
  de to tal ER pointen: den viser hvor meget af belastningen der kommer fra
  øvelser gruppen kun er med i, ikke fører.

Sæt hvor atleten har trykket "skip" tæller aldrig med, uanset øvelse.

## Hvad tallene IKKE betyder

**Et sæt er ikke en måleenhed for belastning.** Kortet tæller hvor mange
sæt der blev gennemført — ikke hvor tungt, hvor hårdt eller hvor godt.
Konkret tæller tallene **ikke**:

- **Intensitet.** Et sæt på 60 kg og et sæt på 160 kg vejer det samme her.
- **Nærhed til failure.** Et sæt taget til RPE 6 og et sæt taget til RPE 10
  tæller ens.
- **Delvise gentagelser.** Et sæt med 3 ud af 5 planlagte reps tæller som et
  helt sæt, samme som et fuldført sæt.
- **Isolering mod flerledsøvelser.** En squat og en benstrækker tæller begge
  som ét sæt for knæstrækkerne, selvom de er meget forskellige øvelser at
  udføre og at mærke.

Kortet svarer på ét spørgsmål: *hvor mange gennemførte sæt landede på denne
gruppe*. Det er en oversættelse fra program til krop, ikke en dom om
kvaliteten af træningen.

## Planlagt mod gennemført — hvad det kan og ikke kan sige

Øverst i kortet står to tal side om side pr. muskelgruppe: **gennemført**
(samme tal som resten af kortet, denne uge) og **planlagt** — hvor mange sæt
programmet siger der skulle være, for de øvelser du har lagt ind i den uge.

**Hvad det kan sige.** Om ugen ser ud til at blive gennemført som skrevet,
eller om der er et gab mellem plan og virkelighed — og hvor stort.

**Hvad det ikke kan sige: HVORFOR der er et gab.** Kortet regner ikke det
ud, og lader være med at gætte. Et gab kan skyldes mindst tre ting:

- Sættene er ikke gennemført endnu (ugen er ikke slut).
- Programmet er ændret undervejs (en øvelse byttet ud, et sæt fjernet på
  atletens skærm) — "planlagt" viser stadig det oprindelige program.
- Atleten har sprunget sæt over.

Kortet viser kun tallene og en påmindelse om de tre muligheder — ikke hvilken
af dem der er den rigtige. Det kræver et coachøje på loggen.

**"–" er ikke det samme som "0".** Planlagt-tallet kan kun vises hvis den
aktuelle programuge har en kalenderdato (`weeks.start_date`). Har ugen ikke
det, viser kortet "–" — "planlagt er ukendt", ikke "der er ikke planlagt
noget". Fra ordre 204 er dette sjældnere: en ny uge får sin dato automatisk
(forrige uges dato + 7 dage, eller førstkommende mandag hvis programmet
ikke har en daterede uge endnu), og en programuge oprettet før ordre 204
kan få sin dato med ét tryk på **"Sæt datoer"** i Program-fanen (kun
synlig når programmet har mindst én daterede og én udaterede uge) — ikke
længere noget der kræver at coachen husker det fra gang til gang.

**Kun denne uge, ikke et helt forløb.** Til forskel fra resten af kortet
(seks-otte ugers historik) dækker planlagt/gennemført kun ÉN uge — den ugen
"nu" ligger i. Programuger følger ikke altid kalenderen (deload-uger,
huller), så et helt "planlagt"-vindue ville have flere huller end tal.

## "Ukendt øvelse" — hvorfor den ikke bare forsvinder

Kortet kender kun de øvelser der står i `src/volume/muskelkort.js`, plus
dem du selv har kortlagt via "Ret kortlægning" (se næste afsnit). En øvelse
ingen af de to kender (stavefejl, en ny øvelse, noget meget specifikt)
vises som sin egen linje — "Ukendt øvelse" — i stedet for at blive gættet
på eller skjult. Ser du den linje vokse, er det et tegn på at
kortlægningen mangler noget, ikke at atleten ikke har trænet — og nu kan du
rette det selv, med det samme.

## Sådan retter du en kortlægning

Fra ordre 185 behøver du ikke længere åbne kildekoden. Klik **"Ret
kortlægning"** øverst til højre i kortet:

1. **Vælg en øvelse.** Enten fra listen af ukendte øvelser (klik direkte —
   det er de øvelser der i dag lander som "Ukendt øvelse" i tabellen eller
   i planlagt-tallet), fra listen af kendte øvelser, eller skriv et helt
   nyt øvelsesnavn.
2. **Sæt grupper og andele.** Samme to-trins-skala som modellen altid har
   brugt: **Primær (1,0)** — gruppen driver øvelsens hovedbevægelse — eller
   **Medvirkende (0,5)** — gruppen bærer en væsentlig del af arbejdet, men
   er ikke hvad øvelsen er "for". Ingen andre tal findes, med vilje — et
   tredje tal ville lade som om modellen ved mere end den gør. Tilføj eller
   fjern grupper med knapperne ved siden af hver linje.
3. **Gem.** Rettelsen gælder med det samme, for alle atleter, og er tydeligt
   mærket **"Sat af Marc"** i redigeringsvinduet — til forskel fra
   **"Oprindeligt skøn"**, som er det modellen selv kom med (i
   `src/volume/muskelkort.js`, stadig kildekoden bag standardskønnet).
   Fortryder du, åbner du samme øvelse igen og trykker **"Fjern rettelse"**
   — den falder tilbage til det oprindelige skøn (eller til "ukendt", hvis
   øvelsen aldrig var kortlagt i koden).

**Hvor det gemmes.** Ordre 185 måtte ikke røre Supabase-skemaet, så
rettelserne blev gemt i browserens `localStorage` alene — **pr. browser,
ikke synkroniseret mellem dine enheder** (en rettelse lavet på telefonen sås
ikke på computeren, og omvendt). Fra ordre 209 er den grænse løftet:
rettelser gemmes i Supabase-tabellen `exercise_muscle_overrides`
(`docs/supabase/20260915-exercise_muscle_overrides.sql`), når migrationen er
kørt — en rettelse gælder da med det samme på alle dine enheder.
Redigeringsvinduet viser hvilken af de to der er i spil lige nu, øverst:
**"Gemmes på denne enhed"** (localStorage, endnu ikke migreret, eller ingen
forbindelse) eller **"Gemmes på din konto"** (Supabase). `src/volume/
rettelser.js` afgør det selv ved kørsel — intet du skal stille om. Findes
der lokale rettelser fra før migrationen, flyttes de op automatisk, én gang,
første gang tabellen findes.

**Den ærlige grænse der er tilbage.** Rettelser gælder stadig kun for
coachen der satte dem — der er endnu ingen visning der lader atleten selv
se sin coachs rettelser (se "Atletens egen visning" ovenfor, ordre 209's
commit 4 fandt ingen sådan visning i appen i dag).

## Atletens egen visning — findes ikke (ordre 209, commit 4)

Ordre 209's commit 4 skulle lade atletens egen visning af volumen læse
coachens rettelser, kun læsning — "Marcs rettelse skal gælde begge sider,
ellers taler coach og atlet om to forskellige tal" (ordrens egen ordlyd).
Den visning **findes ikke i appen i dag**: `src/volume/muskelkort.js`,
`beregn.js`, `planlagt.js` og `rettelser.js` bruges udelukkende fra
`src/dashboard/` (coachens side) — ingen import fra `AthleteView.jsx` eller
noget andet atlet-facing view. Der er derfor intet at koble op på i denne
ordre; noteret her i stedet for at bygge en visning ingen har bedt om endnu.

**Klar til når den bygges.** `exercise_muscle_overrides` (commit 1) er scopet
til coach-only RLS — kun `coach_id = auth.uid()` kan læse/skrive sine egne
rækker. En fremtidig atlet-visning kræver enten en ny, snævert scopet
SELECT-policy (atleten ser kun rækker fra sin egen coach, via
`athletes.coach_id`) eller en SECURITY DEFINER-funktion — ingen af delene
tilføjet her, for ikke at åbne en læsevej ingen kode bruger.

## "Stå på skuldre" — free-exercise-db (ordre 192)

Fra ordre 192 kender kortet et tredje lag ud over "din egen rettelse" og
"den indbyggede kortlægning" (se ovenfor): en genereret liste bygget af
`scripts/byg-muskelkort.mjs` fra [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(Andrew Jarombek m.fl.), licens **The Unlicense** (public domain). Scriptet
henter kilden ÉN GANG (mod et fast commit-SHA, ikke `main`) og skriver
`src/volume/muskelkort.generet.json` — appen henter aldrig noget udefra,
kun en udvikler der kører scriptet gør. Opslagsrækkefølgen i `slaaOevelseOp`
er uændret i princippet, nu tre lag: **din rettelse** → **den indbyggede
kortlægning** (kurateret, kilde pr. linje) → **den genererede** (kildens
egen kategorisering, se grænse nedenfor). Det indbyggede vinder altid over
det genererede, hvis samme øvelse findes begge steder.

**Hvad der kom med.** Af kildens 876 øvelser er 431 med: kun `category`
"strength" (292 udelukket — stretching, cardio, plyometrics, strongman,
powerlifting, olympic weightlifting er ikke med i denne version), og kun
udstyr Marcs atleter bruger — barbell, dumbbell, cable, machine, kropsvægt,
kettlebell, elastik (74 udelukket for andet udstyr). 126 danske
alias/navne (fx "Håndvægt bænkpres", "Hacksquat med stang") peger på samme
post som kildens engelske navn, så Marc ikke behøver skrive engelsk.

**Kildens grænse, ikke Marcs faglige dom.** free-exercise-db grupperer
muskler grovere end vi gerne ville: dens "shoulders" dækker forreste,
midterste og bageste skulder under ét, men vores model har kun
`anteriorDeltoid` (forreste skulder) at putte det i. En genereret post der
rammer `anteriorDeltoid` betyder derfor "kilden mener denne øvelse rammer
skulderen", ikke nødvendigvis "specifikt den forreste del" — til forskel
fra de indbyggede bænkpres/skulderpres-poster, hvor det ER efterprøvet.
Fem af kildens muskler har slet ingen sikker oversættelse og er udeladt
frem for gættet på: **hamstrings, mavemuskler (abdominals), underarme
(forearms), traps og midt-ryg (middle back)**, plus adductors/abductors/
neck i mindre omfang — se `_meta.udeladteMuskler` i den genererede fil for
præcise tal. En øvelse hvor ALLE dens muskler falder i denne udeladte
gruppe (79 af kildens 876) er slet ikke med, frem for at stå der med en tom
gruppeliste.

**Marcs rettelse vinder stadig altid** — er en genereret post forkert eller
for grov, retter du den samme vej som før (se "Sådan retter du en
kortlægning" ovenfor), og rettelsen slår igennem uanset hvilket af de tre
lag øvelsen ellers ville være kommet fra.

**Målt effekt.** Før ordre 192 kendte kortet 26 øvelser (den indbyggede
liste). Efter kender det 570 distinkte opslagsnavne (26 indbygget + 431
genereret + 126 dansk alias, minus enkelte overlap) — en udvidelse på 544.
E2E-mockens eget seed-data (`e2e/mock-supabase.mjs` via `e2e/fixtures.mjs`)
logger kun én øvelse ("Squat"), som allerede var kendt før ordren — mockens
tynde øvelsesdata kan derfor ikke selv vise bredden, kun kortets egen
optælling kan. Bundle-vækst: Dashboard-chunken voksede fra 266,50 KB til
320,43 KB (+53,93 KB, under ordrens 60 KB-grænse), gzip +6,61 KB.

## Grænsen for denne version

Ugen er kalenderugen (mandag-søndag), ikke appens programuge — kortet
svarer på "hvornår blev kroppen belastet", ikke "hvilken uge i programmet
var det". Kun de muskelgrupper der allerede findes i `muskelkort.js` er
med (se filen for hvilke) — resten af kroppen (skuldre ud over de to
grupper der er der, mave, underarme, læg isoleret) er endnu ikke
kortlagt og vises derfor slet ikke, heller ikke som "ukendt". Dette er
første version, og den er bevidst holdt snæver frem for at gætte bredt.
