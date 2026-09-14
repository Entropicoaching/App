# Volumen pr. muskelgruppe — hvad tallene betyder

Ordre 177, første version. Kortet ligger på atletsidens "Oversigt"-fane.

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

## "Ukendt øvelse" — hvorfor den ikke bare forsvinder

Kortet kender kun de øvelser der står i `src/volume/muskelkort.js`. En
øvelse appen ikke genkender (stavefejl, en ny øvelse, noget meget
specifikt) vises som sin egen linje — "Ukendt øvelse" — i stedet for at
blive gættet på eller skjult. Ser du den linje vokse, er det et tegn på at
kortlægningen mangler noget, ikke at atleten ikke har trænet.

## Sådan retter du en forkert kortlægning

Åbn `src/volume/muskelkort.js`. Hver øvelse er en post med en liste af
grupper og en andel:

- `1` (PRIMÆR) — gruppen driver øvelsens hovedbevægelse.
- `0,5` (MEDVIRKENDE) — gruppen bærer en væsentlig del af arbejdet, men er
  ikke hvad øvelsen er "for".
- Ikke nævnt — gruppen tælles slet ikke med.

Ingen andre tal bruges — det ville lade som om modellen ved mere end den
gør. Hver linje skal have enten en litteraturkilde (typisk et opslag i
`entropi-loeftmodel/docs/muskler-litteratur.md`) eller ordet "skoen" plus en
kort begrundelse. Mangler en øvelse helt, tilføj den samme sted — den
falder til "ukendt" indtil da, aldrig til et gæt.

## Grænsen for denne version

Ugen er kalenderugen (mandag-søndag), ikke appens programuge — kortet
svarer på "hvornår blev kroppen belastet", ikke "hvilken uge i programmet
var det". Kun de muskelgrupper der allerede findes i `muskelkort.js` er
med (se filen for hvilke) — resten af kroppen (skuldre ud over de to
grupper der er der, mave, underarme, læg isoleret) er endnu ikke
kortlagt og vises derfor slet ikke, heller ikke som "ukendt". Dette er
første version, og den er bevidst holdt snæver frem for at gætte bredt.
