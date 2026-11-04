# Entropi Coaching: tracking, runde 3

Grundlag: den aktuelle ORDER R2-TRACK-PLAN2, de tre fastlåste Marc-beslutninger og offentlig kildekopi på `e6c232dd9e9132793052ca05ca2143eba533abff` (release/entropi-samlet-neste). Levering1 er genbrugt og rettet. Dette er rene modeller, syntetiske prøver, en DRAFT-migration og en visningsspecifikation. Ingen skærm er koblet til, ingen fetch eller automatisk programændring er tilføjet. Entropi 2-flags og eksisterende OFF-adfærd bevares.

## Én sandhed for readiness

`src/athlete/laesninger.js:saveReadiness` skriver allerede `readiness_logs` med sleep_hours, energy, motivation, stress, soreness_level, sore_zones og readiness_score. `src/athlete/HjemTab.jsx` viser skalaankrene. Søvn er timer; energi, motivation, stress og ømhed er heltal 1–5. Ømhed 1 betyder ingen ømhed, 5 meget øm. Den eksisterende formular og skrivevej bevares.

Beslutning: sleep_hours, energy, stress, soreness_level og ømhedssteder oprettes **ikke** i tracking_daily_v1. Ingen 0–10-konvertering af ømhed. Ny tabel indeholder kun sleep_quality (heltal 1–5), pain (heltal 0–10) og pain_location (1–120 tegn præcis når pain > 0). Mindst én af sleep_quality/pain kræves. Ét svar pr. atlet+lokal dato. 0 smerte er et aktivt svar; manglende svar er null. Tabellen mærker kun `athlete_manual`.

`normalizeDailyExtras` returnerer kun disse ekstra felter og afviser readiness-felter, også hvis de er null. Den har ingen database- eller lagerskrivning. `summarizeWellbeing` læser readiness og ekstra rækker som to separate kilder og sammenføjer dem i hukommelsen på athlete_id+logged_date. Et felt findes kun i sin egen kilde. Duplikerede datoer inden for samme kilde afvises; integrationen skal afklare konflikter ved kilden og må ikke tage et vilkårligt gennemsnit. Andre atleter og datoer uden for ugen tælles ikke.

En senere samlet formular skal kalde den eksisterende readiness-skrivevej én gang og gemme ekstra felter separat. De to bekræftelser skal vises ærligt, da de ikke er én transaktion. Denne ordre implementerer ingen ny readiness-skrivevej og ændrer ikke den nuværende formular.

## Eksisterende byggeblokke bruges direkte

`weeklyReview.mjs` importerer og kalder de fire eksisterende moduler i samme mappe. De omskrives ikke. Input er rå historikrækker med eksplicit athlete_id, ikke en egen skalar-envelope. Kompositionen filtrerer alle rækker til valgt atlet før beregning. null betyder ikke tilgængelig/ufuldstændig historik; [] er en fuldstændig tom historik. Fetchfejl og delvise sider skal afleveres som null, aldrig som et færdigt delresultat. Caller leverer også den valgte atlets nuværende mål og eksplicit weekEnd. Ingen implicit klokke.

| Modul | Faktisk kontrakt på basen | Ugeevaluering |
|---|---|---|
| load.mjs / load | exercise_logs + eksplicit dato; rullende 7/28 dage, eksisterende sæt-deduplikering, kg × gennemførte reps. Kronisk er 28-dages sum / 4; mindst ét måleligt sæt i hvert 7-dages interval. | Bevar days/weeks, acuteLoad, chronicLoad, acuteChronicRatio og signal. Registreret volumenforhold uden for [0,8;1,5] giver flag. Tomme dage beviser ikke hvile, og forholdet er ingen skadesprognose. |
| strengthTrend.mjs / buildStrengthTrend | 12 mandagsuger; e1RM med eksisterende Epley-funktion, navngivne varianter adskilt. Kun afsluttede uger bruges; seneste fire skal have observationer for flag. | Bevar løft/uger/slope. Flag ved fald strengt over 5 % fra fire ugers top eller tre uger uden ny top. Ingen egen -2 %-regel eller medianadapter. |
| nutritionTrend.mjs / nutritionTrend | meal_logs og nuværende kcal_target/protein_target; fire kalenderuger. Signal bruger de seneste syv loggede datoer på tværs af hele den leverede historik. Mindst fire strengt under 80 % protein. | Bevar rå modulegenskaber og recent-datoer. Tekst siger **registreret protein mod nuværende mål**. Det er hverken daterede historiske mål eller bevis for komplette kostdage. Manglende mål/ukendte måltider giver intet signal. |
| weightTrend.mjs / weightTrend | weight_logs, atlet-id og kalenderdato; seneste gyldige created_at vinder pr. dato. Mindst tre målte dage i hver af tre adskilte 7-dages perioder. | Bevar daily, average, weeklyChange, previousWeeklyChange og fastChange. Flag kræver to ændringer strengt over 1 % i samme retning. Ingen egen 14-dages regel. |

`sections.<område>.data` er det oprindelige modulresultat, eller null hvis historikken ikke er tilgængelig. status er ready kun når modulets eget signalgrundlag kan afgøres; intet signal er i sig selv ikke bevis for tilstrækkelige data. Styrke-ready betyder mindst ét vurderbart løft; de andre løfts mangler skal stadig vises pr. løft. Ingen cache, flagskrivning, netværk eller lageradgang indgår.

## Recovery, pas og menneskelig planlægning

Ugens søvn, søvnkvalitet, energi, stress og soreness_level kræver mindst fire forskellige observerede datoer pr. felt. Gennemsnit dannes kun af egne kendte værdier. Flag: søvn <6 timer, søvnkvalitet <=2/5, energi <=2/5, stress >=4/5 og ømhed >=4/5. Smerte >=7/10 giver prioritet allerede ved én observation. Alle flag rummer periode, tærskel, datoer og egne værdier; smerte har sted. Intet gættes fra readiness_score.

Planlagte og bekræftede gennemførte pas leveres særskilt. Et programmeret pas er ikke en gennemførelse, og et videoupload er ikke et gennemført pas. Under 75 % af planlagte pas giver opmærksomhed; 0 planlagte giver notPlanned og null procent. Ekstra pas skal ikke tælles som planlagte. Manglende tal forbliver insufficient.

Smerte står først; derefter øvrige signaler i stabil orden. Der er intet cyklusinput til ugeevalueringen. `planning.automaticChanges` er altid false. noFlags kræver alle fire vurderbare domæner, alle seks recoveryfelter og kendte planlagte pas; teksten betyder kun ingen flag i de registrerede data. Andre tilstande er reviewPain, review og insufficient.

## Cyklus og samtykke

tracking_cycle_v1 gemmer alene egne observationer: bleeding (none/spotting/light/medium/heavy), valgfri cycle_day 1–120 og note højst 1000 tegn. Ingen beregnet fase, fertilitet, sundhedsscore eller indirekte cyklussignal. tracking_cycle_consent_v1 har separat PK athlete_id+coach_id og sharing_enabled default false. Gem observation og del er to handlinger.

RLS og eksplicitte grants på alle tre tabeller: kun ejeren kan skrive; ejeren kan altid læse egne data. Coachen kan læse almindelige ekstra felter. Cyklus kræver både nuværende coachrelation og aktivt samtykke til netop denne coach. Ny coach arver intet. Ejeren kan tilbagekalde eller slette samtykket også efter coachskift; genaktivering kræver nuværende coach. Ingen adgang giver heller ingen count/metadata i `projectCycle`; nægtet sti læser ikke rækkerne. Dette klientværn erstatter ikke RLS.

## Identitetsværn og manglende basemigrationer

`src/dashboard/atletHandlinger.js:139` sender en vilkårlig payload til athletes.update. Den fastlåste kildepakke indeholder **ingen supabase/migrations/**. Derfor kan de eksisterende athletes-grants/policies ikke efterlæses her, og der hævdes intet om deres faktiske tilladelser. `scripts/proeve-migration-v3/skema-minimalt.sql` er kun et syntetisk skema og dokumenterer selv sin ufuldstændighed.

DRAFT tilføjer derfor et defensivt `tracking_guard_athlete_identity_v1` BEFORE UPDATE-værn på athletes. Ved bruger-JWT eller authenticated/anon rolle afvises ændret user_id med SQLSTATE 42501, med netop én undtagelse: `old.user_id is null and new.user_id = auth.uid() and auth.uid() is distinct from old.coach_id`. Det tillader første kontokobling for atleten selv, også inde i en SECURITY DEFINER-funktion. Undtagelsen skal være TRUE; SQL UNKNOWN giver ingen tilladelse. Coachen kan hverken koble en ukoblet atlet til sig selv eller til andre, og allerede koblede identiteter kan ikke ændres af brugere. Normal profilredigering og uændret user_id tillades. SECURITY INVOKER, låst search_path og fratagede direkte execute-grants; ingen privilegeret læsefunktion. En betroet administrativ forbindelse uden bruger-JWT kan fortsat foretage konto-linkning.

PGlite-fixturen giver bevidst coachen tabelbred UPDATE og permissiv coach-policy. Den har en ukoblet atlet og en særskilt syntetisk SECURITY DEFINER-claim-funktion. Den prøver vellykket første self-claim, afvist coach-claim via direkte UPDATE og definer, manglende JWT, senere identitetsskift, almindelig navneredigering og uændret identitet. Den syntetiske claim-funktion er bevidst permissiv og er ikke en rekonstruktion af produktionens adgangskrav. Dette er et testkrav, **ikke et kørt PostgreSQL-bevis i denne worker**: PGlite er ikke tilgængelig og installation er forbudt. Den rigtige `claim_athlete_profile_v3` og athletes-politik/grants findes ikke i kildekopien. Marc skal før kørsel kontrollere dem i Supabase, især SECURITY DEFINER/ejer, search_path, execute-grants, autorisation af den rigtige ukoblede profil samt andre skrivere af user_id. Triggeren giver ikke i sig selv ret til en bestemt profil. Både PGlite-kørslen og skemagennemgangen er åbne gates.

## Migration og rollback

UP: `supabase/migrations/20261103210000_tracking_v1_DRAFT.sql`. DOWN: `supabase/sql/20261103210000_tracking_v1_DRAFT_ROLLBACK.sql`. Kun UP ligger i migrationsmappen. DRAFT-suffix er ikke en teknisk Supabase-eksklusion: ingen automatisk anvendelse må ske før særskilt godkendelse. Ingen SQL er kørt mod en rigtig database.

UP opretter tre trackingtabeller med constraints, indekser, kolonnegrants og tvungen RLS, samt ovenstående ene identitetstrigger. Ingen eksisterende policy/grant ændres. DOWN fjerner cycle -> consent -> daily og derefter egen trigger/funktion i én transaktion uden CASCADE. Gamle tabeller bevares. DOWN sletter nye data og fjerner identitetsværnet; afhængig UI skal være deaktiveret først. Retention/eksport og konto-linkningsflow skal afklares i særskilt godkendt drift.

Prøver opdages af appens eksisterende npm-test-runner. Alle prøver i berørt trackingmappe køres rekursivt før/efter i egen offentlige kopi; se TESTOUTPUT.md og ADAPTER.md for den fokuserede harness. PGlite-prøven har synlig SKIP, når afhængigheden mangler, og den gate må ikke bortforklares som PASS. Dhurva kører fuld suite og build ved samling. Frisk separat K-R2-TRACK-PLAN2-kontrol kræves af det præcise slutprodukt.

## Senere spor

Mobil og ur: mulige selvvalgte kilder er Apple Health/HealthKit, Google Health Connect og leverandøreksport. Søvn, HRV med metode, hvilepuls og skridt er idéer til en separat integrationsopgave. Ingen API-løfter er verificeret her, ingen integration eller netværk udført. Før implementering kræves kilde-id, enhed/metode, lokal dato+tidszone, deduplikering, primær kilde pr. felt, separat samtykke, retention og sikker tokenhåndtering. Cyklus må aldrig følge med et generelt sundhedstilvalg.

Entropi Adaptiv er et separat produkt. Kontrakter og visningsprincipper kan inspirere en særskilt opgave; ingen kode, schema, brugeridentiteter, adgang eller data flyttes i denne ordre.
