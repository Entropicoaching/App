# ORDRE 41 — Atletens første uge

Gren: `atletens-foerste-uge` (fra main `216a496`)

Commits:
- `99fb45b` — fix #1: vis fejl i stedet for tavs succes ved besked/kostlog-skrivning
- `b0180c6` — fix #2: løft Log/Spring over/RPE-vælger til 44px i sæt-loggeren
- `e29c382` — fix #3: glemt-adgangskode-flow
- (denne rapport, separat commit — se "Aflevering" nederst)

## Metode

Al kode på atlet-siden læst gennem i to uafhængige passer: én
sammenhængende gennemgang af hele filsættet, og én opdelt i seks
afgrænsede stykker (`AthleteView.jsx` i fem dele + `Auth.jsx`/`App.jsx`/
`supabase.js` samlet) læst hver for sig mod de samme fem
friktionskategorier, for at fange det den første gennemgang overså.
Filer: `src/AthleteView.jsx` (5985 linjer, hele filen), `src/Auth.jsx`,
`src/App.jsx`, `src/supabase.js`, `src/videoCoachSubmission.js`,
`src/athleteOnboarding*.js`. De to passers fund er samlet i listen
nedenfor (F1-F26 fra den første, G1-G13 fra krydstjekket). Ikke rørt eller
genlæst i detalje: coach-visningen (`Dashboard.jsx`), videocoach.html og
Coach Briefing — udtrykkeligt uden for scope.

Gennemgået i den lokale app på en ægte 390×844-viewport (headless Chrome via
DevTools Protocol med en rigtig device-metrics-override, ikke bare et smalt
vindue — se "Ærlige grænser" for hvorfor headless og ikke en rigtig
indlogget session). Login-skærmen er den ægte, uændrede app. De øvrige
skærme (sæt-logger, ny-adgangskode) er verificeret via en midlertidig,
ikke-committet preview-harness der genbruger den faktiske kildekode
(styles, logik-moduler) med syntetisk/fabrikeret indhold — se hvorfor
under "Ærlige grænser".

## Atletens vej, første login til afsluttet uge 2 — hvad koden faktisk gør

1. **Log ind / opret konto** (`Auth.jsx`) — email + adgangskode.
2. **Klik-guide ved første login** (ORDRE 38, uændret) — fire trin.
3. **Hjem** — ugekalender, "Mit program"-kort, parathed-CTA.
4. **Dagens parathed** — søvn/energi/motivation/stress/ømhed.
5. **Find og åbn en session** — tryk "Næste" i Hjem/Program, folder ud.
6. **Log et sæt** — vægt, reps, RPE, gentaget for hvert sæt/øvelse.
7. **Session markeret færdig** (✓), evt. valgfri træningsfeedback (1-5 + kommentar).
8. **Uge 2 starter** — samme skærme igen, nu uden nyhedsværdi.

Sideløbende, brugt hele ugen igennem: **Kostlog** (søgning, hurtig-log,
skabeloner, TDEE-estimat), **Beskeder** (to spor: Besked / Teknik & løft,
inkl. coachens delte videofeedback), **Mobilisering** (opvarmning +
mobilitet, genereret ud fra program + dagens ømhed), **Stævnedag**
(kun relevant med en stævneplan — sjældent i uge 1-2).

## Den fulde fundliste

Rangeret efter hyppighed × pris. **Fed** = de tre rettede.

### 1. Silent failures

**F1 — `sendAthleteMessage` rydder feltet uanset udfald.** `AthleteView.jsx`
(nu rettet, se commit `99fb45b` for før-koden). Skrev direkte til Supabase
uden at tjekke `{ error }`, ryddede beskedfeltet EFTERFØLGENDE uanset om
skrivningen lykkedes. Koster: en besked til coachen (fx "jeg har ondt i
knæet, hvad gør jeg") forsvinder sporløst ved et netværksdrop, uden fejl,
uden mulighed for at prøve igen — atleten tror den er sendt. Høj frekvens
(beskeder sendes løbende hele ugen), høj pris (aktivt datatab, ikke bare
manglende feedback). **Over stregen — rettet (fix #1).**

**F2 — otte kostlog-funktioner har samme mønster.** `quickLogFood`,
`copyYesterday`, `saveTemplate`, `logTemplate`, `addFromSearch`,
`quickAddSearchFood`, `deleteLog`, `saveEditLog`. Samme rå
`await supabase.from('meal_logs'/'meal_templates')...` uden fejltjek.
Koster: et måltid logges tilsyneladende ("+ tilføjet"-toast, listen
genindlæses), men landede aldrig i databasen — kalorie/makro-totalen er
stille forkert resten af dagen (og for TDEE-estimatet, dage frem). Meget høj
frekvens (kostlog sker flere gange dagligt, uge 1 OG uge 2). **Over
stregen — rettet (fix #1), sammen med F1.**

**F3 — `markTrackRead` (læst-markering) har intet fejltjek.** Lav pris:
ingen datatab, kun at en ulæst-badge kan hænge ved lidt for længe.
**Under stregen.**

**F4 — `skipSet` / `skipExercise` / `unskipSet` har intet fejltjek.** Rå
insert/update/delete, ingen fejlvisning. Selvkorrigerende ved
`fetchExerciseLogs` bagefter (viser den faktiske DB-tilstand), men uden at
fortælle atleten hvorfor et "spring over"-tryk ikke slog igennem. Moderat
frekvens (springes over når man ikke når hele programmet), lav-moderat
pris (forvirring, ikke datatab). **Under stregen — mindre end F1/F2, men
samme rettelse (`runGuardedWrite`) kunne dække den i en senere ordre.**

**F5 — `markGoodAndSave` (Stævnedag) opdaterer lokal state uanset RPC-fejl.**
`AthleteView.jsx`, konkurrence-forsøg-logikken. Kalder
`supabase.rpc('update_competition_max', ...)` uden at tjekke fejl, og
opdaterer `athlete.squat/bench/deadlift` i UI'en alligevel. Høj pris (falsk
tro på at konkurrencemaks er gemt), men lav frekvens i uge 1-2 (kun relevant
med en aktiv stævneplan, sjældent så tidligt). **Under stregen på grund af
frekvens — værd at rette før en stævnesæson, ikke i denne runde.**

**F6 — PR-detektionens SELECT-fejl behandles som "ingen tidligere data".**
`logSet`, PR-blokken: `const { data: prData } = await supabase.from
('personal_records').select(...)` uden fejltjek — en fejl giver `rows=[]`,
hvilket koden tolker som "atletens allerførste registrering" og gemmer en
ny baseline-PR. Kan give en duplikeret/forkert PR-baseline ved en
netværksfluktuation. Rammer coachens data, ikke direkte atleten i
øjeblikket. **Under stregen — datakvalitetsfund, ikke atlet-friktion.**

**F7 — `saveReadiness` viser den rå Supabase-fejlbesked.** `setReadinessError
(error.message)` — ikke tavs, men uforståelig/teknisk hvis den nogensinde
rammer (en simpel enkelt-række-insert fejler sjældent). **Under stregen.**

### 2. Datatab ved lukket fane midt i noget

**F8 — utastet vægt/reps/RPE/note i sæt-loggeren lever kun i React-state.**
Lukkes fanen før "Log" er trykket, er det tastede væk. Universel
web-adfærd, lav pris (10 sekunder at gentaste). **Under stregen.**

**F9 — utastet chatbesked lever kun i React-state.** Samme som F8, marginalt
højere pris (en længere besked kan gå tabt), stadig lav frekvens for
"lukker fanen midt i en sætning". **Under stregen.**

**F10 — VideoCoach-udkastkøen er allerede robust** (localStorage-kø,
eksponentiel retry, "online"-lytter, flash-besked ved succes/fejl/varig
fejl — `src/videoCoachSubmission.js` + broen i `AthleteView.jsx`). Ikke et
fund — nævnt for at vise at teamet allerede ved hvordan man bygger dette
rigtigt; det er bare ikke brugt konsekvent andre steder (se F1/F2).

### 3. Tommelfinger / 44px

**F11+F12 — "Log", "Spring over" og RPE-vælgeren i sæt-loggeren, ~24-33px
høje.** Det mest gentagne tryk i hele appen: hvert sæt, hver træning, begge
uger. "Log" og "Spring over" lå desuden side om side med modsatte effekter.
Meget høj frekvens, moderat-høj pris (fejltryk, især med svedige hænder,
som ordren selv nævner). **Over stregen — rettet (fix #2).**

**F13 — hurtig-tilføj "+" i kostsøgning, 30×30px cirkel.** Lavere frekvens
end Log-knappen (et par gange dagligt, ikke pr. sæt). **Under stregen.**

**F14 — redigér/slet-ikoner (✎/✕) på kostlog-rækker.** Ingen defineret
trykflade, kun skriftstørrelse. Moderat frekvens. **Under stregen.**

**F15 — kontomenuens "⋯"-knap.** ~20px. Lav frekvens (åbnes sjældent).
**Under stregen.**

**F16 — "✕ fjern" / "✕ Afslut" i mobilitet.** Små, men ufarlige/fortrydbare
handlinger, lav frekvens. **Under stregen.**

### 4. Jargon / forhåndsviden

**F17 — "TDEE" vises uforklaret i Kostlog** (`Estimeret TDEE`, ingen
info-knap — i modsætning til RPE, som HAR en "ℹ"-forklaring). Vist hver dag
i kostfanen, men panelet er skjult som standard og kræver ingen handling for
at ignorere. Moderat frekvens, lav-moderat pris (forvirring, ikke
blokerende). **Under stregen.**

**F18 — de to beskedspor ("Besked" / "Teknik & løft") forklares ingen
steder**, hverken i klik-guiden fra ORDRE 38 eller i selve Beskeder-fanen.
En ny atlet kan sende et teknik-spørgsmål i det forkerte spor. Moderat
frekvens, lav-moderat pris (coachen ser det bare i det andet spor — ikke
tabt, bare forsinket/forvirrende). **Under stregen.**

**F19 — RPE er IKKE et fund.** Har allerede en "ℹ"-knap
(`setShowRpeGuide`) direkte ved siden af vælgeren i sæt-loggeren. Nævnt for
at vise at ordrens bekymring om jargon allerede er løst for det vigtigste
tilfælde.

**F20 — "SBD"-toggle på Stævnedag.** Niche-skærm, atleter der når dertil
kender allerede udtrykket. **Under stregen.**

### 5. Stille i uge 2

**F21 — Kostlogs TDEE-trend er skjult bag et manuelt fold-ud og kræver
nok data.** Ingen daglig makro-trend synlig i normalvisningen. Svagt fund.
**Under stregen.**

**F22 — Parathed viser ingen udvikling efter gemt log** (kun "gemt",
ingen "din parathed er steget/faldet siden i går" — selvom
`readiness_score` allerede beregnes). Det er den mest daglige, mest
rutineprægede handling i appen, og den eneste af de daglige rutiner der
IKKE spejler noget tilbage. Moderat fund — kandidat til en senere ordre,
men vurderet under de tre valgte, fordi det ikke koster atleten noget
konkret (ingen fejl, intet tab) — det er en forspildt mulighed, ikke en
friktion. **Under stregen.**

**F23 — Mobilitet/opvarmning er IKKE et stille-i-uge-2-fund.** Genererer et
frisk forslag hver gang, ud fra ugens program og dagens ømhedsregistrering
— reelt det modsatte af stillestående.

**F24 — Vægt- og styrke-trend findes allerede** (Hjem: vægt-trend
"↑/↓ Xkg siden forrige uge"; Program: "Styrkeudvikling"). Ikke et fund.

### 6. Manglende selvbetjening

**F25 — ingen "glemt adgangskode"-vej overhovedet.** Intet link, ingen
`resetPasswordForEmail`, ingen håndtering af et recovery-link
(`detectSessionInUrl` var sat til `false`). En atlet der glemmer sin
adgangskode i uge 1 eller 2 (almindeligt, især for en ny konto) er
totalt spærret ude — kan ikke logge ind, kan ikke nulstille selv, må
kontakte Marc direkte. Det er præcis den situation delmålet
"Appen mærkbart bedre for atleterne" (uden skub, uden Marc ved siden af)
handler om at undgå. Lavere/usikker frekvens end F1/F2/F11 (rammer ikke
alle, og ikke nødvendigvis i uge 1-2), men den højeste enkeltstående pris
i hele fundlisten: total lockout, ingen vej tilbage uden Marc. **Over
stregen — rettet (fix #3), fordi prisen er så høj at selv en lavere
frekvens vejer tungt, og fordi det er en komplet manglende evne, ikke en
gradvis friktion.**

**F26 — "Glemt adgangskode?"-linket jeg selv tilføjede er et lille
tekstlink** (`padding: '0.4rem 0'`, ingen `minHeight`). Lav frekvens
(bruges typisk højst én gang), lav pris. Noteret ærligt som en mindre
efterladt uskarphed i egen rettelse — ikke rettet i denne runde.

### Yderligere fund fra en bredere, parallel gennemgang

Den første gennemgang af fundlisten (F1-F26 ovenfor) blev lavet i én
sammenhængende læsning af hele filen. Jeg krydstjekkede den bagefter mod en
uafhængig, opdelt gennemgang af de samme filer (seks afgrænsede stykker,
læst hver for sig mod de samme fem kategorier) for at fange det den første
gennemgang kan have overset. Det gav 13 fund mere. Ingen af dem ændrer de
tre valgte — se begrundelsen nedenfor — men flere er tætte nok til at høre
hjemme i listen, ikke kun som en fodnote.

**G1 — `fetchProgram` og stort set alle andre `fetch*`-funktioner tjekker
ikke `{ error }`.** Slår hentningen af atletens uge/program fejl (netværk,
midlertidig RLS-forsinkelse ved cold-start), er resultatet `undefined`, og
koden viser den SAMME tomme-tilstand som en atlet uden program overhovedet
("Dit program er på vej" / "Intet program tilknyttet endnu"). En helt ny
atlet i uge 1, som ikke har noget at sammenligne med, kan ikke se forskel
på "min coach er ikke færdig endnu" og "noget gik galt, prøv igen" — den
mest forvirrende variant af silent failure i hele gennemgangen, fordi den
rammer præcis der hvor en ny atlet har mindst grundlag for at gennemskue
den. **Tættest på at komme over stregen af alle de nye fund** — se
begrundelse nedenfor for hvorfor den alligevel ikke fortrængte F1/F2.

**G2 — `undoDelete` (Fortryd-knappen efter en slettet måltidslogning) har
samme uskærmede mønster som F1/F2, men kom IKKE med i fix #1.** Samme fil,
samme funktionsfamilie (`deleteLog` lige ved siden af blev rettet).
Ærlig udeladelse, ikke en bevidst nedprioritering — en hurtig opfølgning
bør tage den med samme `runGuardedWrite`.

**G3 — "Spring resten over", "Auto-udfyld" og "Gem feedback" (session-
niveau i Program-fanen) har heller ikke fejl/pending-visning.** Samme
familie som F1/F2/G2, lavere frekvens (én gang pr. session, ikke pr. sæt).

**G4 — `logSet` erstatter stiltiende den PLANLAGTE RPE med den FAKTISKE,
hvis atleten ikke selv rører RPE-vælgeren.** En atlet der ikke kender denne
konvention aner ikke at "sin egen" indsats-registrering nogle gange er
coachens plan, ikke hans egen oplevelse. Jargon/datakvalitet på samme tid.

**G5 — Hviletimere i mobilisering (`ExerciseTimer`, `MobilityGuideStep`)
tæller ned med `setTimeout`, ikke et tidsstempel.** Låses telefonen midt i
et 45-sekunders hold (almindeligt — man lægger telefonen, strækker sig),
driver nedtællingen eller springer uforudsigeligt ved genoptagelse, uden
nogen besked om at den er upålidelig i baggrunden.

**G6 — Ingen "send linket igen"-vej, hvis atleten aldrig får/åbner selve
bekræftelsesmailen ved oprettelse.** Adskilt fra fix #3 (glemt
adgangskode, som forudsætter en FÆRDIG konto) — dette rammer FØR kontoen
overhovedet er brugbar. Kun en generisk "bekræft din email"-besked ved
næste loginforsøg, ingen vej til at få et nyt link.

**G7 — `signOutHard` (kontomenuens "Log ud") har ingen bekræftelse.** Ét
fejltryk logger fuldt ud og genindlæser siden, ingen fortryd.

**G8 — Kontomenuens "⋯"-knap (F15 ovenfor) er ikke bare lille (~20px) — den
er den ENESTE vej til at logge ud, genstarte klik-guiden, eller skifte
til coach-visning.** Lav frekvens ændrer ikke ved at det er eneste
adgangsvej til tre vigtige handlinger.

**G9 — Program-fanens blok-skift-chips ("‹ forrige blok" / "næste blok ›")
er ~17px høje med nul vandret padding.** Lavere frekvens end sæt-loggeren
(navigeres sjældnere end der logges sæt), men blandt de mindste
trykflader i hele appen.

**G10 — Parathedsformens "Log parathed"-knap (~27px) og vægtlogningens
"Ret"-knap (~17px)** har samme underdimensionerede mønster som F11/F12,
bare uden for sæt-loggeren. Parathed logges dagligt.

**G11 — Auth.jsx's tilstandsskift ("Opret her" / "Log ind" / "Har du en
konto?") er almindelige `<span onClick>` uden nogen padding.** Sidder
nederst på login-skærmen, hvor en tommelfinger nemmest rammer forkert.

**G12 — Parathedsformens felter (søvn/energi/motivation/stress/ømhed)
lever kun i React-state, ligesom F8/F9.** Samme mønster, anden skærm —
lukkes fanen midt i udfyldningen, er alt tastet væk.

**G13 — Session-vurderingens 1-5-knapper er 40×40px** — tættere på 44px
end de fleste andre fund her, men stadig lige under. Lav frekvens (én
gang pr. session, valgfri).

## Hvorfor netop disse tre, og ikke de tre letteste

F1/F2 (silent failures) var IKKE de letteste — de krævede at læse ni
separate funktioner og forstå hvorfor `logSet` og VideoCoach allerede var
robuste, mens kostlog/beskeder ikke var det, for at være sikker på fejlen
var reel og ikke allerede dækket et andet sted. F11/F12 (44px) var den mest
oplagte at pege på — men blev valgt fordi den rammer den højeste faktiske
frekvens i hele appen (hvert eneste sæt), ikke fordi den var nem. F25
(glemt adgangskode) var den SVÆREST at bygge rigtigt (krævede at ændre
`detectSessionInUrl`, forstå en URL-race mod `PASSWORD_RECOVERY`-eventet,
og bygge en hel ny skærm) — den blev alligevel valgt over lettere,
hyppigere fund (som F14 eller F17), fordi dens pris er kategorisk
anderledes: total spærring versus friktion.

**Om G1 (fetchProgram), den tætteste nye kandidat:** den blev overvejet
seriøst til at erstatte et af de tre, men gjorde det ikke, af to grunde.
For det første er den i familie med F1/F2, ikke en ny slags fund — samme
"tavs fejl ved skrivning/læsning uden fejltjek"-mønster, bare på
læsesiden af en RPC/fetch i stedet for skrivesiden. At rette F1/F2 løser
IKKE G1 (det er en anden kodesti), men de deler årsag og løsningsform, så
værdien af at rette begge i samme ordre er lavere end at sprede sig over
tre reelt forskellige problemtyper (skrivefejl, trykflader, manglende
selvbetjening). For det andet er frekvensen lavere end F1/F2 — den rammer
kun ved en fejl PRÆCIS i det vindue hvor programmet hentes (app-åbning,
sjældnere end hver besked/hvert måltid), mod F1/F2's "hver gang noget
skrives". G1 er dokumenteret her, ikke rettet, og er den mest oplagte
kandidat til en hurtig opfølgning sammen med G2/G3 (samme
`runGuardedWrite`-mønster kan dække alle tre).

## Hvad blev ændret (opsummeret — se de tre commit-beskeder for detaljer)

- **Fix #1:** `src/athleteWriteGuard.js` (ny, ren + testet), koblet ind i
  ni skrivefunktioner i `AthleteView.jsx`. Test: `src/athleteWriteGuard.test.js`
  + `scripts/verify-athlete-write-failures.mjs`.
- **Fix #2:** `minHeight: '44px'` på "Log", "Spring over" og RPE-vælgeren i
  `AthleteView.jsx`. Test: `scripts/verify-athlete-tap-targets.mjs`.
- **Fix #3:** `src/Auth.jsx` (reset-tilstand), `src/supabase.js`
  (`detectSessionInUrl: true` + `isPasswordRecoveryUrl`), `src/App.jsx`
  (viser den nye skærm før normal visning), `src/SetNewPassword.jsx` (ny).
  Test: `scripts/verify-athlete-password-reset.mjs`.

Ingen skemaændring i nogen af de tre — `resetPasswordForEmail` og
`updateUser` er indbyggede Supabase Auth-kald, ingen ny tabel/kolonne.

**Driftsafhængighed for fix #3 (ikke en SQL-migration, men samme princip —
skal tjekkes af Marc før den virker i produktion):** Supabase-projektets
Auth → URL Configuration → Redirect URLs skal have appens URL
(`https://app.entropicoaching.dk` eller den relevante origin) på listen,
ellers fejler selve nulstillings-linket i mailen, selvom koden her er
korrekt.

## Testresultat

`npm run lint` — 0 fejl (12 præeksisterende React-hook-advarsler, urørt).
`node --test src/*.test.js` — 41/41 grønne (3 nye fra
`athleteWriteGuard.test.js`). De tre nye verify-scripts
(`verify:athlete-write-failures`, `verify:athlete-tap-targets`,
`verify:athlete-password-reset`) — grønne, og hver bekræftet til rent
faktisk at fange sin egen regression (testet ved bevidst at
sabotere koden og se scriptet fejle, derefter reverte).
Sidetjekket: `verify:athlete-onboarding(-guide)`, `verify:athlete-first-day-flow`,
`verify:athlete-training-inputs`, `verify:coach-inbox-flow`,
`verify:coach-priority`, `verify:progression-state` — alle fortsat grønne,
ingen regression. (`verify:auth-logout-and-role-switch` fejler fortsat med
samme fejl som på uændret main — præeksisterende, urørt, ikke min kode.)

## De tre rettede steder — før/efter, set på smal viewport

**Fix #1 (fejl i stedet for tavs succes).** Bygget en lille demo der
kalder den samme `runGuardedWrite`-funktion som `sendAthleteMessage`/
kostlog nu bruger, med et simuleret netværksdrop. Før: intet ville være
sket synligt (feltet ryddes, "Log"-knappen ville stadig vise ✓, listen
genindlæses uden det nye punkt). Efter: "Log"-knappen skifter IKKE til ✓,
og en rød fejl-linje vises: "Beskeden blev ikke sendt. Tjek din forbindelse
og prøv igen." — set direkte i skærmbilledet.

**Fix #2 (44px).** Samme sæt-logger-række, kopieret fra den faktiske
kildekode. Før: "Log" og "Spring over" var synligt kompakte,
tæt sammen. Efter: begge knapper og RPE-vælgeren er tydeligt større,
behagelige at ramme med en tommelfinger, uden at rykke ved layoutet
omkring dem (rækken vokser bare naturligt i højden).

**Fix #3 (glemt adgangskode).** Set direkte i den ægte, kørende app (intet
login krævet for denne del):
1. Login-skærmen viser nu "Glemt adgangskode?" under adgangskode-feltet.
2. Klik skifter til en ren reset-skærm: kun email-felt + "Send
   nulstillingslink" + "Har du en konto? Log ind".
3. Udfyldt med en syntetisk, ikke-leverbar testadresse
   (`...@example.invalid`, RFC 2606 — rammer ingen rigtig person, ingen
   Supabase-skrivning, kun et Auth-kald) og sendt: Supabase svarede uden
   fejl, og den neutrale bekræftelse vises korrekt
   ("Hvis ... har en konto, er der sendt en mail...").
4. Åbnet appen med en (uægte) recovery-URL i hashen: landede korrekt på
   "Ny adgangskode"-skærmen i stedet for den normale app — viste
   "Bekræfter linket..." fordi tokenet ikke var ægte (se grænse nedenfor).
5. Selve "sæt ny adgangskode"-formularen (verificeret i en preview med
   `ready=true`, da jeg ikke kan fremtvinge en ægte session) renderer
   korrekt: ét feltnavn "Ny adgangskode", "Gem adgangskode"-knap.

Punkt 1-2 (login-skærmen med "Glemt adgangskode?", og reset-skærmen efter
klik) er efterfølgende gentaget uafhængigt mod den ægte, kørende app (samme
390×844-CDP-metode) som en del af den redaktionelle gennemgang af denne
rapport — begge skærme renderede identisk med det beskrevne.

## Ærlige grænser

- **Ingen af de tre rettelser er set med en rigtig, indlogget atlet.** Lokal
  dev peger på PRODUKTIONS-Supabase (samme begrænsning som ORDRE 38), og
  jeg må hverken oprette en testkonto der eller bruge en rigtig atlets
  login. Alt visuelt bevis ovenfor er enten den ægte, uautentificerede
  login-skærm, eller en midlertidig, ikke-committet preview-harness der
  genbruger den faktiske kildekode (styles + logik-moduler importeret
  direkte, ikke kopieret) med tydeligt syntetisk indhold.
- **Fix #3's fulde runde — modtage en rigtig mail, klikke det rigtige
  link, lande med en ægte session — er slet ikke afprøvet**, og kan
  strukturelt ikke afprøves uden en rigtig e-mail-indbakke. Jeg har
  verificeret de to halvdele hver for sig (anmodning virker mod den ægte
  Supabase Auth; recovery-URL'en router korrekt til den nye skærm) samt
  koblingen mellem dem i kildekoden (source-assertions), men ikke den
  ende-til-ende oplevelse en atlet rent faktisk får.
- **Om Redirect URLs allerede er sat op i Supabase Auth ved jeg ikke** —
  det kan jeg ikke se eller ændre herfra. Skal tjekkes af Marc.
- **Fund om "stille i uge 2" (F21, F22) er de svageste i listen** — jeg kan
  se HVAD skærmene viser, men ikke om en atlet reelt oplever dem som
  kedelige efter 10-14 dages brug. Det kræver at se en rigtig atlet, ikke
  kodelæsning.
- **F18 (de to beskedspor er uforklarede)** er en antagelse om at det er
  forvirrende — jeg har ikke set en atlet rent faktisk sende i det forkerte
  spor, kun at intet i UI'en forklarer forskellen.
- Alle fund uden for de tre rettede er ikke rettet, kun dokumenteret her —
  det er efter ordrens eget princip: listen er lige så meget værd som
  rettelserne.

## Hvad er næste

Højeste prioritet til en opfølgning: **G1** (`fetchProgram` og de øvrige
`fetch*`-funktioners manglende fejltjek — den tætteste kandidat der ikke kom
med denne runde) sammen med **G2/G3** (samme `runGuardedWrite`-mønster som
fix #1, bare på de steder der ikke nåede med: `undoDelete`,
"spring resten over"/"auto-udfyld"/"gem feedback"). Alle fire genbruger
infrastruktur der allerede findes efter denne ordre og er derfor billige at
tage i én kort opfølgning.

Dernæst: **F4** (skip-funktionerne, samme mønster) og **G9/G10** (blok-skift-
chips, parathed/vægt-knapper — samme 44px-mønster som fix #2). **G7**
(ingen bekræftelse ved log ud) og **G6** (intet "send igen"-link ved
ubekræftet signup) er begge små, selvstændige rettelser der ikke kræver ny
infrastruktur.

F25's driftsafhængighed (Redirect URLs) bør bekræftes af Marc snarest,
ellers virker glemt-adgangskode-funktionen ikke i praksis selvom koden er
korrekt.
