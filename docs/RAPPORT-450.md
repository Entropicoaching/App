Ordre 450

# Rekorderne uden 4000 rækker ved hver åbning

Rekorderne fra 439 bruger nu et lille rekord-indeks på telefonen (under 1 kB). Ved hver
åbning henter appen kun de rækker, der er nyere end indekset, og først når Dagens pas kan
bruges. Målt headless på 390 × 844 med 4x CPU-drosling, mod e2e-mocken med ca. 4000
opdigtede sæt (median af 5 genåbninger):

| Profil | Rækker til rekorderne | Over nettet | Dagens pas brugbart | Nettet stille |
|---|---|---|---|---|
| Fast 3G | 3512 → **34** | 564 → **5,8 kB** | 6361 → 6407 ms (støj) | 12,2 → **9,6 s** |
| Slow 4G | 3512 → **34** | 564 → **5,8 kB** | 4438 → 4397 ms (støj) | 8,9 → **6,2 s** |

Dagens pas kommer lige så hurtigt frem som på `main`. Gevinsten fra 387 er altså ikke tabt,
men den er heller ikke blevet større. Det, der er vundet, er 558 kB mindre at hente pr.
åbning og et net, der er færdigt 2,6-2,7 s tidligere. Rekorderne fejres som før.

## Gren

`rekorder-let` fra `main` (`dd68c77`, 439 merget). Grenen er ikke pushet.
- blok 1: `30c8646` rekord-indekset, hentning efter Dagens pas, måling før/efter
- blok 2: commit efter `30c8646` med browsertests, 439's offline-bevis tilpasset og denne rapport

Én verificeringskommando pr. blok: `node outputs/450/verify-450.mjs --blok 1|2`. Hvert
trin skriver sin udskrift til `outputs/450/koersel-*.txt`.

## Hvad ændret

**Blok 1.**
- `src/athlete/rekordIndeks.js` (ny, rene funktioner): indekset gemmer kun maksima, dvs.
  bedste e1RM og flest reps pr. vægt pr. øvelse. Det er samme grundlag som 439's
  `bygGrundlag`. Det bygges én gang fra historikken. Bagefter holdes det ajour af to
  kilder:
  - ugens egne sæt fra `exerciseLogs`, også sæt i køen og uden fortrudte sæt;
  - de rækker, der er nyere end indekset.
- Den aktive uge og senere uger ligger i hver sin spand. Når en uge er forbi, lægges
  dens spand ned i "base". Den aktive uges sæt kommer derfor stadig altid fra
  `exerciseLogs`, som i 439, og indekset vokser ikke med historikken.
- `AthleteView.jsx`: appen henter ikke længere hele historikken i baggrunden ved åbning.
  Nu gør den sådan:
  - Den henter rækkerne, når ugens sæt er hentet (`setUgensLogsHentet` fra
    `fetchExerciseLogs`) og efter næste frame.
  - Den henter fra en uge før indeksets nyeste række. Da indekset kun er maksima, gør det
    ikke noget at se en række to gange.
  - Hvis hentningen fejler, bliver det logget, men der kommer ingen rød linje.
  - Fremgang henter stadig hele historikken, når fanen åbnes. Den lægges så også i
    indekset.
- `dinUge` bruger indeksets grundlag, og `rekordListe` tager nu et startgrundlag.
- Indekset ryddes ved log ud sammen med øjebliksbilledet (`offlineSnapshot.js`).
  Øjebliksbilledets gamle `rekordFoer` skrives ikke mere.
- `fremgangLogs.js`: `rekordRaekkerQuery` bruger samme felter, filtre og grænse og
  tilføjer `gte logged_at`.
- `outputs/450/maal.mjs`: målingen før/efter. Den bygger `main` i en midlertidig mappe
  uden for repoet og følger ellers samme metode som 387.

**Blok 2.**
- `outputs/450/genindlaes.mjs` (ny browsertest med den lange historik): første åbning
  henter 3512 rækker og bygger indekset (876 bytes). Genåbningen henter 34 rækker.
  Derefter:
  - Squat sæt 1 (100 × 5) fejres med "Ny rekord: Squat e1RM 117 kg, +3 kg".
  - Siden genindlæses, og der kommer ingen fejring igen.
  - Sæt 2 med samme vægt fejres ikke.
  - Sæt 3 (102,5 × 5) fejres med "e1RM 120 kg, +3 kg".
  - Efter endnu en genindlæsning er der stadig to fejringer i alt.
  - Fremgang viser de to rekorder én gang hver.
- `outputs/439/blok3.mjs` (offline-beviset) venter nu på rekord-indekset i stedet for
  `rekordFoer` i øjebliksbilledet. Beviset kræver det samme som før.

## Testresultat

- `npm run lint`: grøn. `npm run build`: grøn (før og efter browsertestene).
- Enhedstest: 53/53 grønne (`koersel-enhedstest.txt`). Nye er `rekordIndeks.test.js`
  (10) og én test af forespørgslen i `fremgangLogs.test.js`. Én enhedstest viser, at
  indeksets grundlag og ugens rekorder er præcis de samme som 439's udregning over hele
  historikken.
- **Samme rekorder som 439 på samme mock-historik**: 439's egen blok 1-test er kørt
  uændret mod den nye kode og er grøn (`koersel-439-blok1.json`). Den viser:
  - sæt 1 fejret med "e1RM 117 kg, +3 kg"; sæt 2 ikke fejret;
  - sæt 3 fejret og fortrudt; sæt 4 sprunget over og ikke fejret;
  - Fremgang med dagens rekord én gang.

  439's blok 2 ("din uge": 4/4 pas, 13.240 kg, 7 rekorder) er også grøn
  (`koersel-439-blok2.json`).
- **Ingen dobbelt fejring efter genindlæsning**: `genindlaes.mjs` er grøn med den lange
  historik (`genindlaes.json`, billeder `01-`/`02-*.png`).
- **Offline-rekord tæller én gang** (439's offline-bevis på indekset,
  `koersel-439-blok3.json`, billeder `03-`/`04-*.png`):
  - Indekset lå på telefonen (644 bytes), og derefter blev nettet slået fra.
  - Sæt 1 blev fejret, mens det lå i køen.
  - Da nettet kom tilbage, havde mocken sæt [1,2], og der var én fejring i alt.
  - Fremgang viste rekorden én gang.
- 414's offline-bevis (tid, hænger, fortryd-dør): grøn. `verify:athlete-silent-fails-5`,
  `verify:athlete-read-failures`, `verify:auth-logout-role-switch`: grønne.
- `npm run e2e` (atlet → coach, video, fejl, beskeder): grøn. `e2e:rolig-forside`: grøn.
- VideoCoach: alle 13 `verify:videocoach-*` er grønne. `verify:videocoach-clip` var rød
  i de to første kørsler (tidsgrænse 1,14x og 1,12x mod 1,1x) og grøn i den tredje
  (1,08x og 1,09x). VideoCoach er ikke rørt (ingen ændring i `public/`), og maskinen
  kørte samtidig 18 andre node-/chrome-processer. Alle tre kørsler står i loggen.

## Hvad er næste

Efter merge og push:
1. Første gang en atlet åbner den nye version med net, hentes historikken én gang, som
   før. Derefter henter appen kun det nyeste, typisk nogle dusin rækker i stedet for
   tusinder.
2. Atleten mærker ikke noget på forsiden. Appen er færdig med at hente 2-3 s tidligere på
   dårligt net og bruger ca. en halv MB mindre data pr. åbning.

**For Hara** (Coaching, delmål "Appen mærkbart bedre"): denne ordre sikrer, at 439's
rekorder ikke gør starten tungere. Dagens pas er lige så hurtig som før, og appen henter
558 kB mindre pr. åbning. Det er vedligehold af "mærkbart bedre", ikke en ny forbedring,
atleten kan se.

## Ærlige grænser

- **Tiden til Dagens pas er ikke blevet kortere**, kun lige så kort som før. På `main`
  startede den store hentning allerede før Dagens pas, men i mocken forsinkede den
  kortet mindre end 1 %. Den store forskel er data og tiden, til nettet er stille.
- Alt er målt headless mod mocken på 127.0.0.1, ikke på en rigtig telefon og ikke mod
  Supabase. Den lokale server gzipper ikke, så kB-tallene er rå byte. Mod prod vil 564 kB
  være mindre med gzip, og Supabases svartid kommer oveni.
- Historikken i målingen er opdigtet: ca. 3900 arkiv-sæt på én arkiv-uge i programmet
  plus 419's tre uger. En rigtig atlets historik fordeler sig på mange uger. Det ændrer
  ikke indeksets størrelse, men programmets egen hentning (`weeks`) er ikke målt med
  mange uger.
- Et sæt, der rettes eller slettes i en afsluttet uge, bliver i indekset med sin gamle
  værdi. Indekset er kun maksima og tager det, der var højst. Det kan kun betyde færre
  fejringer, aldrig en falsk. Det samme gælder et sæt fra en anden telefon, der først når
  serveren mere end en uge efter det blev logget. Det kommer med, når Fremgang åbnes.
- Er den aktive uge den første uge, hvor der er logget noget, rykker indekset ikke frem,
  og hele (den korte) historik hentes ved hver åbning, indtil ugen er forbi. For en ny
  atlet er det få rækker.
- "Din uge" regner nu ugens rekorder mod alle andre uger samlet. Før regnede den i
  datoorden. Et sæt fra en tidligere uge, der er logget efter denne uges sæt, tæller nu
  som "før". I mockens uger giver det samme resultat (7).
- Første åbning efter opdateringen henter stadig hele historikken én gang (3512 rækker i
  målingen), fordi 439's gamle grundlag i øjebliksbilledet ikke genbruges. Fejring uden
  net virker først, når den version har været åbnet med net én gang, som i 439.
- Coachens forhåndsvisning holder indekset i hukommelsen og henter hele historikken, som
  i 439. Det er ikke målt.
- 419's standardport 8997 var optaget af en anden proces (sandsynligvis Bhishak, 446).
  Verificeringen bruger derfor `UGE_MOCK_PORT=8987` i sin egen proces. 439's og 414's
  scripts overskrev deres egne bevisfiler under kørslen, og `e2e:rolig-forside`
  overskrev `outputs/330/`. De er sat tilbage med `git checkout`, og de nye resultater
  ligger i `outputs/450/koersel-439-*.json` og `koersel-414-*.json`.
- VideoCoach-clip-loggen indeholdt igen ffmpeg-metadata fra Marcs testvideo (sted,
  telefon, tid). Den er fjernet fra `outputs/450/koersel-videocoach-clip.txt` før commit.
