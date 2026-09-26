Ordre 406

# Dagens pas uden net: Bhishaks O1, O2, O3 og O6 rettet

**Kort:** Efter et pas uden net viser Dagens pas nu de klarede sæt, når køen er sendt
("Sæt 4/4", også 28 s senere). Et tryk på et sæt, som serveren allerede har, laver ikke
længere en dublet, og sættet beholder sin første tid. Log ud nævner usendte sæt, og
login uden net siger "Ingen forbindelse". Fejl i køens runde bliver logget. Et sæt,
serveren bliver ved med at afvise, parkeres synligt. Invarianterne fra 403 holder
stadig i alle ti scenarier: intet sæt tabt, og ingen dublet af sig selv.

**Hara (Coaching, delmål "Appen mærkbart bedre"):** Det var det, der stod mellem Marc
og et push af offline-passet (397 + 401). Nu mangler kun Marcs kældertest nedenfor.

## Gren

`dagens-pas-offline-3` fra `main` @ `2598633` (397, 401 og kritik-403 er merget). Tre
commits:

- `7823a0a` blok 1: O1. Lytterne kalder den nyeste `flushOfflineSets`, og en hentning
  uden uge tømmer ikke listen.
- `eb93c6e` blok 2: O2, O3 og O6.
- blok 3 (commit efter `eb93c6e`): verificering, offline-bevis og denne rapport.

Intet er pushet. Der er ingen kald mod prod og ingen migrationer.

## Hvad ændret

**O1 (blok 1)**
- `src/AthleteView.jsx`: `flushRef` peger på den nyeste `flushOfflineSets` og sættes
  efter hvert render. Lytterne på `online` og `entropi:forbindelse`, kaldet ved
  app-start og 20-s-runden kalder `flushRef.current()`. Tidligere kaldte de lukningen
  fra første render, hvor `currentWeek` var null. Den forkerte eslint-kommentar
  ("alle friske ved kald") er fjernet.
- `src/athlete/laesninger.js`: `fetchExerciseLogs` uden uge returnerer med det samme.
  Den tømmer ikke længere Dagens pas.

**O2 (blok 2)**
- `src/athlete/saetSkrivning.js`: `insertSetLog` har fået `lookupFirst`. Det bruges,
  når række-id'et er nyt: der er ingen køpost og ingen `setWriteRef` fra denne åbning,
  og skærmen kender ingen række. Så slås (atlet, øvelse, sæt) op før INSERT. En øvelse
  hører til én dag i én uge, så øvelsens id dækker også uge og dag, ligesom i køens
  runde. Findes rækken, bliver det en UPDATE af den, og sættet beholder serverens
  `logged_at`. Fejler opslaget, returneres fejlen i stedet for et INSERT. Et sæt fra
  "Godkendt" ligger allerede i køen, og køens runde slår selv op igen. Det samme
  gælder `updateLoggedSet`. Opslaget er samlet i `findSetRow`, som både
  `insertSetLog` og køens runde bruger.
- **Mit valg:** på program-fanens egen Log-knap (ikke "Godkendt", og uden kø) giver et
  opslag, der fejler, den fejl og tilbagerulning, fanen altid har vist. Knappen lægger
  ikke sættet i køen. Ellers ville fanen skifte adfærd, og det låser
  `verify:athlete-write-failures`.

**O3 (blok 2)**
- `src/athlete/Ramme.jsx`: log ud tæller køen (`countOfflineSets`). Ligger der usendte
  sæt, spørger appen: "Log ud af Entropi? Du har N sæt, der ikke er sendt endnu. De
  sendes først, når du logger ind igen på denne telefon med net. Annuller, hvis du
  vil vente, til de er sendt." Atleten vælger selv mellem Annuller og Bekræft. Uden
  usendte sæt er teksten den samme som før. `AthleteView.jsx` sender `athleteId` med.
- `src/Auth.jsx` og `src/athleteOnboarding.js`: login uden net
  (`navigator.onLine === false`, eller et kald der ikke når frem:
  `AuthRetryableFetchError`, status 0, "Failed to fetch" og lignende) viser "Ingen
  forbindelse. Du kan logge ind, når du har net igen." Før stod der "tjek
  oplysningerne".
- `src/supabase.js`: kun kommentaren ved `signOutHard` er opdateret.

**O6 (blok 2)**
- `src/offlineSetQueue.js`: ny `noteOfflineSetFailure`. Den tæller fejl på køposten og
  husker den sidste fejlkode, men kun hvis posten stadig er den, der blev sendt. Et
  nyt "Godkendt" eller en rettelse starter forfra.
- `src/athlete/saetSkrivning.js`: fejl i køens runde, der hverken er "ingen net" eller
  23503, sluges ikke længere. Det gælder både opslaget og afsendelsen. Fejlen logges
  med `logFrontendError`, én gang pr. fejlkode. Afviser serveren sættet med en kode
  fem runder i træk, parkeres det. En kode er en Postgres- eller PostgREST-kode eller
  en JWT-fejl. Fejl uden kode (net, timeout, 5xx) tæller ikke.
- `src/athlete/DagensPasCard.jsx`: parkerede sæt vises i to grupper. Den ene er "…
  fordi coachen har ændret øvelsen" (23503, som før). Den anden er "N sæt kunne ikke
  sendes, efter flere forsøg. Skriv tallene til din coach: …".
- `updateLoggedSet`: kan køen ikke gemme rettelsen, og fejler skrivningen, siger appen
  ikke længere, at rettelsen ligger i køen. Den rulles tilbage på skærmen, og atleten
  ser "Rettelsen kunne ikke gemmes. Tjek din forbindelse og prøv igen." Feltet står
  åbent, så atleten kan prøve igen.
- Ikke rørt: den ødelagte kø-JSON (O6's tredje punkt). Ordren nævnte den ikke.

**Tests og beviser**
- `src/offlineDagensPas.test.js`: to nye tests. Den ene tæller og nulstiller fejl i
  køen. Den anden tjekker, at login uden net giver "Ingen forbindelse", og at forkert
  kode stadig giver "forkert".
- `outputs/406/scenarier.mjs`: en kopi af Bhishaks `outputs/kritik-403/scenarier.mjs`.
  Kopien bygger til sin egen mappe og skriver til `outputs/406/`. I `log-ud` prøver
  atleten også at logge ind uden net. Der er kommet et tiende scenarie,
  `o2-anden-telefon`: telefon A er åbnet med net, telefon B logger sæt 1, og A trykker
  "Godkendt" på "Sæt 1/4".
- `outputs/406/verify-406.mjs`: en kopi af `verify-kritik-403.mjs` med forventningen
  vendt for O1, O2 og O3. O5 skal stadig kunne genskabes.
- `outputs/406/offline-bevis.mjs`: en kopi af 401's bevis med én ændring i `haenger`
  (se Testresultat).
- Kørselslogs ligger som `outputs/406/koersel-*.txt`, fordi `*.log` er gitignored.

## Testresultat

- **`npm run verify:kritik-403`: rød, som ordren ventede.** Alle ni scenarier kørte, og
  alle invarianter holdt. Det eneste, der fejlede, var:
  `O1 genskabes ikke laengere`, `O2 genskabes ikke laengere` og
  `O3 genskabes ikke laengere` (`outputs/406/koersel-verify-kritik-403.txt`). Kørslen
  overskriver Bhishaks resultater i `outputs/kritik-403/`. Dem har jeg gendannet med
  `git checkout`, så hans bevis står uændret.
- **`node outputs/406/verify-406.mjs` (kopien med den nye forventning): grøn.** Første
  fulde kørsel af alle ti scenarier fejlede kun på "RAPPORT-406.md mangler", fordi
  rapporten ikke var skrevet endnu (`outputs/406/koersel-verify-406.txt`).
  Resultaterne:
  - online-start: `[1,1,1,0]`, og Dagens pas viser "Sæt 4/4" efter afsendelsen (før:
    "Sæt 1/4").
  - aabn-med-net: `[1,1,1,0]` og "Sæt 4/4", også 28 s senere (før: "Sæt 1/4").
  - to-faner: `[1,1,0,0]`, og begge faner viser "Sæt 3/4" (før: "Sæt 1/4").
  - o2-anden-telefon: `[1,0,0,0]`, og sæt 1 har stadig B's tid. Kontrolkørslen mod
    commit 1 (før O2-rettelsen) gav `[2,0,0,0]`
    (`outputs/406/resultat-o2-anden-telefon-foer-rettelsen.json`).
  - log-ud: spørgsmålet nævner "Du har 2 sæt, der ikke er sendt endnu". Login uden net
    siger "Ingen forbindelse. Du kan logge ind, når du har net igen." Log ind med net
    igen gav `[1,1,0,0]`.
  - kaelder: squat `[1,1,1,1]`, bænk `[1,0]`, og tiden fra "Godkendt" er bevaret.
  - haenger: markeret efter 8,3 s, `[1,1,1,0]`. skift-atlet og sw-opdatering er
    uændrede og rene.
  - forkert-ur: stadig 7 dage bagud (O5 er ikke en del af ordren).
  - Efter rapporten: `VERIFY406_KUN_RESULTATER=1 node outputs/406/verify-406.mjs` er
    grøn (`outputs/406/koersel-verify-406-efter-rapport.txt`).
- **Offline-beviset.** `outputs/401/offline-bevis.mjs` uændret: `tid` er grøn, `haenger`
  er rød på "det første INSERT nåede frem til mocken" (0 ≠ 1). Det er ventet efter O2.
  Et nyt sæt slår nu op før INSERT, og på hængende wifi er det opslaget, der hænger.
  Så bliver INSERT'et aldrig sendt. Sættet blev stadig markeret og lagt i køen. Min
  kopi `outputs/406/offline-bevis.mjs` lader sæt 2's opslag få sit svar. Så er det
  INSERT'et, der når frem uden svar, præcis som i 401: **begge grønne.** Resultatet
  var markering efter 8,0 s, sendt af sig selv efter 18,9 s, `[1,1,1,0]` og ingen
  dublet af sæt 2. Logs: `koersel-offline-bevis-401.txt` og
  `koersel-offline-bevis-406.txt`. 401's egne filer er gendannet.
- `npm run build`: grøn. `npm run lint`: grøn.
- `node --test` på `offlineDagensPas`, `offlineSetQueue`, `editLoggedSet` og
  `authSignOut`: 31 af 31 grønne.
- Grønne `verify:*`: `athlete-write-failures`, `auth-logout-role-switch`,
  `athlete-silent-fails-5`, `athlete-silent-fail-visibility`,
  `athlete-password-reset` og `athlete-onboarding`.
- Grønne e2e: `e2e:dagens-pas`, `e2e:ret-saet`, `e2e:saet-nu` og `e2e:atlet`. De
  overskriver skærmbilleder i `outputs/314` og `outputs/320`. Dem har jeg gendannet.

## Hvad er næste

**Unik indeks (forslag til en senere migration, kræver ordre fra Marc):**

```sql
-- 1. Find dubletter først (skal ryddes, ellers fejler indekset):
select exercise_id, set_number, count(*), array_agg(id order by logged_at) as ids
from exercise_logs group by exercise_id, set_number having count(*) > 1;
-- 2. Når de er ryddet:
create unique index concurrently exercise_logs_et_saet_en_raekke
  on exercise_logs (exercise_id, set_number);
```

Kolonnerne, der faktisk skal til, er `(exercise_id, set_number)`. En øvelse hører til
én session i én uge, og ugen har ét `athlete_id`, så atlet, uge og dag er givet af
øvelsen. `athlete_id` kan tages med som `(athlete_id, exercise_id, set_number)`. Det
ændrer ikke, hvad der er unikt, men det er ikke nødvendigt. Et sprunget sæt
(`skipped = true`) er den samme række som et logget, så indekset skal ikke være
partielt. Med indekset bliver et samtidigt INSERT fra to telefoner til 23505. Det
fanger `insertSetLog` allerede og laver om til en UPDATE af rækken.

**Marcs kældertest** (RAPPORT-401 med Bhishaks tilføjelse), på en rigtig telefon:
1. **Åbn appen med net først**, og vent, til Dagens pas er vist. Log sæt 1 med net.
2. Slå flytilstand til. Log sæt 2 og 3, og se "☁ 2 sæt gemt lokalt".
3. Luk appen helt, og åbn den igen uden net: Dagens pas viser de 3 klarede sæt og "Sæt
   4/4".
4. Slå net til igen. Inden for ca. 20 s forsvinder "gemt lokalt". **Tjek, at Dagens pas
   stadig viser de klarede sæt ("Sæt 4/4"), og ikke "Sæt 1/4".**
5. Luk og åbn appen med net: de klarede sæt står der stadig.
6. I coach-visningen: sæt 1-3 står én gang hver med tiden fra "Godkendt".
7. Slå flytilstand til, log sæt 4, og vælg ⋯ → Log ud. Spørgsmålet skal sige "Du har 1
   sæt, der ikke er sendt endnu". Tryk Annuller, slå net til, og se sættet blive sendt.

Grønt dér betyder klar til push.

Kan stadig vente (Bhishaks vurdering): O4 (fortryd-sletningen synkront i køen), O5
(urets afvigelse), O7 (8-s-uret først, når kaldet sendes), O8 (én lagernøgle pr. sæt)
og O6's ødelagte kø-JSON.

## Ærlige grænser

- **Alt er målt mod e2e-mocken, headless**, ikke mod prod og ikke på en telefon. Det
  indekset bygger på (øvelse → session → uge → atlet), har jeg fra mockens seed og
  koden. Prod-skemaet har jeg ikke læst (ingen kald mod prod).
- **Uden unik indeks er O2 kun næsten lukket.** Trykker to telefoner "Godkendt" på
  samme sæt i samme sekund, kan begge opslag se "ingen række", og så bliver det
  stadig to rækker. Opslaget fanger det almindelige tilfælde: rækken kom før.
- **Opslaget koster et kald.** Et nyt sæt online koster nu ét GET mere før INSERT'et.
  På hængende wifi er det opslaget, der rammer 8-s-grænsen. Resultatet er det samme:
  sættet markeres og ligger i køen.
- **Parkering er et gæt på "serveren siger nej".** Grænsen er fem runder med en
  Postgres-, PostgREST- eller JWT-kode (ca. 100 s med 20-s-runden). Er et token
  udløbet, og kan det ikke fornyes i fem runder, parkeres sættet. Tallene står da på
  skærmen, men sættet sendes ikke igen af sig selv. Parkering efter fejl er ikke
  genskabt i browseren. Den er dækket af en enhedstest af tælleren og læst i koden.
- **Uden for filerne i ordren** har jeg rørt `src/Auth.jsx` og
  `src/athleteOnboarding.js`, fordi teksten "Ingen forbindelse" på login-skærmen
  hører til der. Jeg har også rørt `src/athlete/DagensPasCard.jsx`, fordi den synlige
  markering for parkerede sæt står der. Alle tre steder er ændringen lille.
- Ved app-start med net kører den første afsendelse stadig, før ugen er hentet. Den
  henter så ikke igen (uge = null), men den tømmer heller ikke noget. Skærmen viser
  køens sæt ovenpå serverens, til næste hentning. Det er det, `aabn-med-net` måler som
  "Sæt 4/4".
- Chromiums offline-emulering melder ikke altid `online` efter en genindlæsning (som
  i 397 og 403). I `kaelder` blev køen sendt af 20-s-runden efter ca. 24 s.
