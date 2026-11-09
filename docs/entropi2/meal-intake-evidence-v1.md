# Indtagsreference v1 — lokalt udkast

Entropi Coach, BF98. **Ikke integreret, ikke en migration, ingen rigtig database,
ingen UI-release.** Kun de fem nye filer hører til kandidaten. Eksisterende logger,
planreferencer, måltal, katalog, flags og skriveværn er uændrede.

Den monterede `nutrition/controller.mjs` bruger `foodPortion` og
`nutritionContracts.saveWithIdentity/save`. Det gemmer kun atlet, dato, navn og fire
heltalsmakroer i `meal_logs`. Fødevareidentitet, præcise gram og mikroreference går
tabt. Gamle rækker, også planmåltider markeret spist, forbliver derfor ukendte for
mikronæringsstoffer. Planindhold er aldrig i sig selv dokumentation for indtag.

## Kontrakt og dataflow

Den rene `createIntakeEvidenceRequest({athleteId,date,requestId,grams,meal,food})`
validerer det originale `supportedFoodSnapshot` før normalisering. Kendt redaktionel
katalogmetadata valideres af den oprindelige kode og udelades fra SQL-snapshot.
Resultatet har `version:1` og de seks argumentfelter. Ingen UUID genereres automatisk.
En fremtidig skriver skal bevare samme request-UUID ved mistet svar og kalde
`public.record_meal_intake_evidence_v1(p_request jsonb)` én gang pr. bevidst logning.
Der er ingen klient, transport eller ny kaldesti i denne kandidat.

RPC'en returnerer uændret `{mealLog,evidence}`. En obligatorisk BEFORE INSERT-trigger
på **den nye evidenstabel alene** reserverer request-UUID, opretter sin egen NYE
`meal_logs`-række og indsætter evidensen i samme transaktion. Der er nu tre
atomiske writes. Triggeren validerer hele payloaden og UID-binding før første write
og indsætter parent med almindelig INSERT, aldrig ON CONFLICT/UPDATE/adoption.
`request_id = meal_log_id` er global UUID-identitet. En eksisterende manuel parent,
også med identiske værdier eller efter no-op UPDATE, kan aldrig få ny evidens.
Hver accepteret direkte evidens-INSERT bruger samme atomiske grænse som RPC'en;
to klient-inserts er ikke en gyldig oprettelsessti. Triggeren kontrollerer også
parentens aktuelle tuple under den oprindelige RLS og sætter evidensens tidsstempel.

`meal_intake_requests_v1` gemmer **kun request_id og athlete_id**. UUID-uniknøglen
reserveres før parent-oprettelsen. Et nøjagtigt genforsøg før sletning returnerer
samme par med oprindelige tidsstempler. Ændret dato, atlet, gram, navn, snapshot
eller ændret aktuel parent giver `23505/intake_request_conflict`. RPC'ens indre
subtransaktion fanger kun unique_violation og ruller alle forsøgte writes tilbage,
før den sammenligner eksisterende evidens og aktuel parent. Et manglende par giver
samme konflikt uden at afsløre en anden ejers data.

Den gamle autoriserede DELETE på `meal_logs` kaskadesletter stadig hele evidensen
med mad, gram, makroer og kilde. Request-bindingen består, så samme immutable
request-UUID efter en eksplicit sletning altid afvises med 23505 uden at genskabe
mad. En legitim ny intention kræver nyt UUID. Dette er teknisk identitetsretention,
ikke madhistorik: registeret indeholder ingen mad, mængde, makroer, kilde, dato,
meal-payload eller tidsstempel. Approller har ingen UPDATE/DELETE. En autoriseret
sletning af selve atleten fjerner registerbindingerne via den NYE tabels FK
`athlete_id -> athletes.id ON DELETE CASCADE`. Retentionsgarantien gælder mens
atletidentiteten findes; bevidst genskabelse af slettede atletidentiteter er ikke
en understøttet retry-procedure. Ingen trigger eller sletteprocedure tilføjes på
gamle tabeller, og deres eksisterende eventuelle dataoprydning ændres ikke.

Unikindekset på request-registeret serialiserer konkurrerende oprettelser af samme
UUID gennem PostgreSQLs normale venten på commit/rollback. Vinderen kan kun committe
alle tre rækker; taberen kan kun returnere et præcist eksisterende par eller en
konflikt. Ved fejl i parent, evidens-CHECK/RLS eller ydertransaktion rulles også
registeret tilbage. Efterfølgende parent-læsning låses FOR SHARE. Andre
isolationsniveauers serialiseringsfejl er fejl og må genprøves med samme UUID.
Dette er et transaktions-/unikhedsargument; flere samtidige forbindelser er ikke
stresstestet i PGlite. Ingen advisory locks eller sessionsmarkører anvendes.

Evidensen gemmer version, fødevaresnapshot, gram, navn, fire makroer og tidsstempel.
`meal_intake_evidence_v1_macros(jsonb)` er en ren, immutable, invoker-validator,
også anvendt af tabellens CHECK. SQL og model kræver alle fire makroreferencer og
bruger BF98 `nutritionValues/roundNutrition`: positiv Math.round med dens faste
1024×EPSILON-tolerance. Makroer skal kunne være PostgreSQL integer.

Tekniske grænser, ikke kostråd: dato 1900-01-01..9999-12-31; gram >0..100000,
højst seks decimaler; request JSON højst 20000 bytes, SQL-fødevaresnapshot 16384
bytes; id 128 tegn, navn/tilstand/verifikationsstatus 256, kildecitat 2048,
måltidsnavn 512. Kontroltegn og trimmet tom tekst afvises. SQL bruger den eksplicitte ECMAScript
WhiteSpace/LineTerminator-mængde fra JS trim/trimStart, også NBSP, BOM, U+2028,
U+2029 og U+3000; kvitteringspræfikset kontrolleres efter trimStart med samme mængde.
Danske navne, tegnsætning, øvrig gyldig Unicode og originale kildestrenge bevares. Snapshot har præcis de seks
oprindelige felter, kilde præcis citation/verification og alle 15 næringsfelter.
Hver reference er null eller endeligt tal 0..1e12; makroer må ikke være null.
Teksttal, ukendte felter, ugyldige datoer, overflow og dagskvitteringsnavne afvises
før skrivning. JS-modellen tillader højst 1000 rækker pr. inputliste.

Fødevare-id og kildens versionstekst bevares særskilt fra kontraktversion 1.
Rå/kogt/tilberedning sammenlægges aldrig. Kilde, verifikationsstreng og id er
**brugeroplyste ved DB-grænsen**, ikke serverattesterede officielle værdier eller
målt faktisk næringsoptag. Ingen art, mærke, tilberedningsudbytte eller næringsværdi
udledes fra navn. Ukendt null bliver aldrig nul.

`readIntakeEvidence(parent,evidence,{athleteId,date})` validerer aktuel parent-ID,
atlet, dato, navn og fire makroer. Manglende, ugyldig eller forældet evidens giver
null. `summarizeIntakeEvidence` bruger kun samme atlet/dag, udelader dagskvitteringer
og afviser tvetydige dubletter. Ni mikrostoffer beregnes som reference pr.100g ×
præcise registrerede gram/100. Hvert stof har `knownRows`, `unknownRows`,
`knownSubtotal`, `complete` og `total`. Total er null ved enhver ukendt række;
kendt nul er gyldigt. Tom dag er `no-recorded-food`, aldrig komplet nul.
Komplet betyder kun komplette referencer for de leverede registreringer, ikke at
hele dagens mad er logget, eller at behov er dækket. Ingen kliniske grænser eller
procenter. Modellen hverken autoriserer brugeren eller stoler på aggregerede counts.
Den fremtidige læser skal hente komplette aktuelle RLS-afgrænsede parent- og
evidensrækker; et gammelt netværkssvar kan ikke afsløre en senere redigering.

## RLS og rettigheder

Nye objekter: tabellerne `meal_intake_evidence_v1` og `meal_intake_requests_v1`,
hver med SELECT/INSERT-politikker, validatoren `meal_intake_evidence_v1_macros(jsonb)`,
RPC'en `record_meal_intake_evidence_v1(jsonb)` samt triggerfunktionen og triggeren
`meal_intake_evidence_v1_create_parent` på evidenstabellen. Alle tre funktioner er
SECURITY INVOKER med fast search_path. PUBLIC, anon, authenticated og service_role
får eksplicit REVOKE på alle nye tabeller/funktioner. Kun authenticated får
SELECT/INSERT på begge tabeller og EXECUTE på validator/RPC. Ingen
UPDATE/DELETE/TRUNCATE, nye roller, schemas, extensions eller definer.

Triggerfunktionen har ingen EXECUTE-grant til approller. PostgreSQL kontrollerer
EXECUTE ved CREATE TRIGGER; den allerede oprettede obligatoriske trigger kører
stadig som invoker ved INSERT. Approller kan hverken kalde triggerfunktionen
direkte, oprette en trigger med den eller deaktivere den på evidenstabellen.
Disse ACL'er er testet under brede syntetiske projekt-defaults. Tabellens ejer har
normale PostgreSQL-ejerbeføjelser; approller må ikke være ejer eller BYPASSRLS.

Ny adgang kræver ikke-null auth.uid, en eksisterende athletes.id-række med
ikke-null user_id og præcis `(user_id=auth.uid() OR coach_id=auth.uid())`.
Denne v1 afviser også en coachs indtagsskrivning for en endnu ikke UID-tilknyttet
atlet. Athletes.id er aldrig bruger-ID. Email, rollemetadata og cachet coachstatus
giver ingen ny adgang. Parentens aktuelle atlet/dato skal matche ved evidenslæsning. Ved INSERT
håndhæver triggeren ny parent samt præcis atlet/dato/navn/makroer. INSERT-RLS på
evidens kontrollerer UID-bindingen; den forsøger ikke at læse en parent fra det
ydre statements snapshot, da parenten netop er oprettet af BEFORE-triggeren. Coachskifte gælder ved næste forespørgsel.

Den gamle `meal_logs_all` bruger **email ELLER coach-ID**, ikke UID alene.
Den ændres ikke. UID-ejeren med afvigende gammel email kan derfor blive afvist af
den oprindelige INSERT/SELECT; RPC'en omgår aldrig det. RLS er også aktiv på
athletes. Invoker kræver underliggende INSERT-grants; direkte evidens-INSERT er
nu en valideret **atomisk nyoprettelse**, aldrig tilknytning af eksisterende parent.
En direkte INSERT i registeret kan alene reservere/pensionere en UUID inden for
samme autoriserede atletscope. Den kan ikke autorisere senere tilknytning eller
omgå triggeren; efterfølgende oprettelse med den UUID afvises. Fremtidige klienter
skal bruge RPC'en og en ny UUID pr. ny intention.

Registerets SELECT/INSERT-politikker bruger samme aktuelle UID/coach- og
ikke-null-user_id-binding, også når parenten er slettet. Coachskifte ophæver
straks den tidligere coachs registeradgang. Registeret giver aldrig fødevareadgang.
Tabellens CHECK og triggeren håndhæver datakvalitet og atomisk binding ved direkte
INSERT. Ingen gamle grants, policies, funktioner eller triggere ændres.

## Senere separat aktivering

Kræver frisk separat same-engine Codex-review af den præcise hashbundne pakke,
uafhængige syntetiske SQL/modelcases, koordinators fulde suite/build og en særskilt
præcis produktionsgodkendelse for Entropi Coach `dsqgaxwgtcbqgphsofav`.
Først derefter en navngiven, godkendt SQL-procedure med preflight/efterkontrol.
Fremtidig UI skal anvende normal skriver, menneskehandling og OFF-som-standard-flag
efter verificeret DB-kontrakt. Denne opgave implementerer ingen aktivering.

Mindste metadata-preflight/efterkontrol (foreslåede læsninger, **ikke kørt her**):

```sql
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
and table_name in ('athletes','meal_logs','meal_intake_evidence_v1','meal_intake_requests_v1')
order by table_name,ordinal_position;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public'
and tablename in ('athletes','meal_logs','meal_intake_evidence_v1','meal_intake_requests_v1');
select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl,
pg_get_userbyid(c.relowner) owner from pg_class c
join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
and c.relname in ('athletes','meal_logs','meal_intake_evidence_v1','meal_intake_requests_v1');
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,
p.prorettype::regtype,p.provolatile,p.prosecdef,p.proacl,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='auth' and p.proname in ('uid','email','jwt'))
or (n.nspname='public' and p.proname in
('meal_intake_evidence_v1_macros','record_meal_intake_evidence_v1','meal_intake_evidence_v1_create_parent'));
select d.defaclrole::regrole,d.defaclnamespace::regnamespace,
d.defaclobjtype,d.defaclacl from pg_default_acl d
where d.defaclnamespace in (0,'public'::regnamespace);
select conname,pg_get_constraintdef(oid) from pg_constraint
where conrelid in (to_regclass('public.meal_intake_evidence_v1'),to_regclass('public.meal_intake_requests_v1'));
select tgname,tgrelid::regclass,pg_get_triggerdef(oid) from pg_trigger
where tgrelid='public.meal_intake_evidence_v1'::regclass and not tgisinternal;
```

Stop ved objektnavnekollision eller afvigende gamle typer/policies/rettigheder;
ingen automatisk CREATE OR REPLACE eller schema-reparation. Testroller og
JWT-shim i PGlite er kun fixture-infrastruktur og bliver aldrig produktions-SQL.
Ingen brugerdata skal læses i preflight. Lokalt kører én Node-testproces ad gangen,
én PGlite-fixture lukket i finally, 1024 MiB heap, testtimeout 45s/ydre 90s.

Rollbackplan før aktivering: ved fejl i udkastets BEGIN/COMMIT rulles de nye
objekter tilbage; gamle brugerækker berøres ikke. En særskilt godkendt oprydning
kan kun overvejes før aktivering og efter bekræftet fravær af nye data/afhængigheder:
drop den nye RPC, evidenstabellen med egne policies/trigger, triggerfunktionen,
request-registeret med egne policies og til sidst validatoren. Ingen CASCADE på objektdrop og aldrig drop/ændring af gamle objekter.
Efter aktivering: stop ny klientfunktion og bevar både parent- og evidensdata;
ingen destruktiv automatisk rollback. Eventuelle rettighedsændringer kræver deres
egen præcise godkendelse. Ingen produktionskommando er udført.

Grundlag: fastlåste offentlige BF98-moduler, READONLY columns/pg_policies-metadata,
Supabase public docs om invoker/RLS/ACL og fastlåst changelog om eksplicitte grants.
Ingen netværksopslag eller læsning af rigtige atlet-/måltidsrækker i dette arbejde.

## SOURCE2/MAX3 og lokal verifikation

SOURCE1 blev reproduceret med begge Unicode-modprøver, direkte legacy-adoption og
slettet-UUID-genforsøg. SOURCE2 lukker dem med de uændrede rene modelmoduler.
Den eneste ændrede eksisterende SOURCE1-SQL-testforventning er forkert dato ved
direkte tilknytning af en eksisterende parent: gammel INSERT-RLS gav 42501; den
obligatoriske nye parent-INSERT giver nu 23505 på den gamle primærnøgle. Afvisningen
bevares; alle tre rækketal og parentens præcise indhold kontrolleres uændret.
Andre oprindelige test-orakler bevares. Flere nye cases dækker Unicode, direkte
atomisk oprettelse, no-op UPDATE, pensionering, ACL/RLS og registeroprydning.

Dette er producentens lokale testbevis. Frisk separat same-engine Codex-kontrol
af den endelige SOURCE2-pakke er stadig påkrævet og kan ikke erstattes af genkørsel
af de fastlåste SOURCE1-reviewcases. Ingen integration eller aktivering er udført.
