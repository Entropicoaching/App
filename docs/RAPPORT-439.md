Ordre 439

# Atleten mærker fremgang: nye rekorder fejres på sættet, står i Fremgang med dato, og ugen slutter med "din uge"

Alle mål er taget headless i Chromium ved 390 × 844 (telefon, touch) mod e2e-mocken med den
syntetiske uge fra `outputs/419/uge-faelles.mjs` (opdigtet Testatlet, tre forgangne uger, hvor
hovedløftene stiger 2,5 kg pr. uge). Ingen atletdata, ingen kald mod prod, ingen migrationer.

## Gren

`rekorder` fra `main` (`0fbe9d4`, 433 merget). Grenen er ikke pushet.
- blok 1: `a03868a` rekorder: fejring på sættet, "Dine rekorder" i Fremgang
- blok 2: `c805b13` "din uge"-kortet
- blok 3: commit efter `c805b13` med build, offline-bevis, VideoCoach-test og denne rapport

Én verificeringskommando pr. blok: `node outputs/439/verify-439.mjs --blok 1|2|3`
(`--no-build` genbruger `dist/`).

## Hvad ændret

**Blok 1: rekorder.**
- `src/athlete/rekorder.js` (ny, rene funktioner). En rekord er et gennemført sæt (vægt > 0,
  reps > 0, ikke sprunget over), som enten giver øvelsens højeste e1RM (Epley, hele kg, så der
  aldrig står "+0 kg"), eller flest reps på en vægt, der er løftet før. Øvelsens første sæt er
  ingen rekord, for der er intet at slå. Alt regnes ud fra `exercise_logs`, som appen allerede
  har (Fremgangs historik plus ugens sæt). Der er intet nyt i databasen.
- Dagens pas: "🏆 Ny rekord: Squat e1RM 117 kg, +3 kg" står på kortet lige over "1 sæt klaret" i
  5 sekunder (`01-rekord-paa-saettet.png`). Fejringen kommer, så snart sættet ligger i den lokale
  kø, altså også uden net. Den kommer én gang pr. sæt og værdi, og "fortryd" fjerner den. Fra
  Program-fanens Log-knap står den i toast-pladsen og først, når serveren har sættet.
- Fremgang: et nyt kort, "Dine rekorder", med de 10 nyeste rekorder, hver med dato
  (`02-fremgang-rekorder.png`). Ugens sæt tages fra `exerciseLogs` og ikke fra serverens kopi,
  så et sæt fra køen, et fortrudt sæt og et sendt sæt tæller præcis én gang.
- Historikken (`fetchFremgangLogs`) hentes nu også i baggrunden, når appen åbnes, og ikke kun når
  Fremgang åbnes. Rekord-grundlaget fra tidligere uger (maksima pr. øvelse, ca. 0,5 kB) lægges i
  øjebliksbilledet på telefonen, så en rekord også kendes, når appen åbnes uden net.
- Den gamle toast ("Ny personlig rekord (vægt)" ud fra `personal_records`) er væk, ellers ville
  samme sæt blive fejret to gange. Rækken i `personal_records` skrives som før.
- Tre tjek fulgte med: `verify-athlete-silent-fails-5` (ny regel: fejring kun når sættet er gemt,
  i køen eller efter fejltjekket), `verify-athlete-jargon-explained` ("rekord" skrevet ud, ingen
  "PR", intet udråbstegn) og `e2e/rolig-forside` (leder efter "Ny rekord:"). Samme krav som før.

**Blok 2: "din uge".**
- `src/athlete/dinUge.js` + `DinUgeKort.jsx` (nye). Når ugens sidste pas er klaret, står et kort
  på forsiden under Dagens pas: "Uge 4 er klaret." med pas (4/4), samlet tonnage (kun gennemførte
  sæt), antallet af ugens rekorder med listen (samme regel som blok 1) og atletens egne
  vurderinger 1-5 pr. pas (`03-din-uge.png`).
- Én valgfri linje til coachen. Den sendes som en helt almindelig besked (`messages`, spor
  "besked", "Om uge 4: …"), og telefonen husker, at ugen er sendt (`04-din-uge-sendt.png`). I
  coachens forhåndsvisning står kortet uden linjen.
- Coachen ser intet nyt: målt i forløbet skriver appen kun til `exercise_logs`, `sessions`
  (vurderingen, som før) og `messages`.

## Testresultat

- `npm run lint`: grøn. `npm run build`: grøn (`outputs/439/koersel-build.txt`).
- Enhedstest: `node --test src/athlete/*.test.js src/fremgangLogs.test.js`: 31/31 (nye:
  `rekorder.test.js` 10, `dinUge.test.js` 7).
- **Blok 1** (`koersel-blok1.txt`): sæt 1 (100 × 5) fejret med "Ny rekord: Squat e1RM 117 kg,
  +3 kg". Sæt 2 (samme vægt) blev ikke fejret. Sæt 3 (102,5 × 5) blev fejret og derefter
  fortrudt: fejringen forsvandt, og sættet blev logget igen på 100 kg uden fejring. Sæt 4 på 105
  kg blev sprunget over og ikke fejret. I Fremgang står dagens rekord præcis én gang, med dato;
  den fortrudte står der ikke.
- **Blok 2** (`koersel-blok2.txt`): kortet kom først efter ugens allersidste sæt og viste 4/4
  pas, 13.240 kg (= mockens 38 gennemførte sæt) og 7 rekorder. Vurderingerne 4, 3, 5 skiftede
  til 4, 3, 5, 4, da Dag 4 blev vurderet. Linjen gav én besked i mocken, og efter genåbning stod
  den stadig som sendt, uden en ekstra besked.
- **Blok 3, offline-bevis** (`koersel-blok3-offline-bevis.txt`, `05-`/`06-*.png`): appen blev
  logget ind online, service workeren tog siden, og grundlaget lå på telefonen. Så blev nettet
  slået fra, og appen blev åbnet igen fra telefonen. Squat sæt 1 blev fejret, mens sættet lå i
  den lokale kø, og ingen skrivning af sættet blev forsøgt. Sæt 2 blev ikke fejret. Da nettet kom
  tilbage, blev køen tømt af sig selv, og mocken har én række pr. sæt. Der var én fejring i alt,
  og Fremgang viser dagens rekord én gang.
- 414's offline-bevis igen, som regressionstjek (`logSet` er ændret): tid, hænger og
  fortryd-dør er alle grønne (`koersel-offline-bevis-414.txt`).
- Alle 15 `verify:athlete-*` og `verify:atletens-uge(-holder)` er grønne. `npm run e2e`
  (run-all: atlet → coach, video, fejl, beskeder) er grøn (`koersel-e2e.txt`). Det samme er
  `e2e:dagens-pas`, `e2e:ret-saet`, `e2e:saet-nu`, `e2e:atlet-uge` og `e2e:rolig-forside`.
- VideoCoach: alle 13 `verify:videocoach-*` er grønne (`koersel-videocoach-*.txt`).
  VideoCoach-trackeren er ikke rørt.

## Hvad er næste

Efter push ser atleterne:
1. Et nyt personligt rekord fejres roligt på sættet, fx "Ny rekord: Squat e1RM 117 kg, +3 kg", også i kælderen uden net.
2. Fremgang har "Dine rekorder" med dato, nyeste først.
3. Når ugens sidste pas er klaret: "din uge" med pas, tonnage, ugens rekorder, egne vurderinger og én linje til coachen.

**For Hara** (Coaching, delmål "Appen mærkbart bedre"): atleterne får nu to øjeblikke, hvor de
kan mærke fremgangen: rekorden på sættet og ugens opsummering. Begge regnes ud fra data, appen
allerede har. Coachen får kun ugens linje, som en almindelig besked.

## Ærlige grænser

- Fejringen kræver, at historikken kendes (hentet i denne åbning eller gemt på telefonen fra en
  tidligere åbning med net). En telefon, der aldrig har åbnet denne version med net, fejrer
  intet, indtil historikken er hentet. Det er bevidst: hellere ingen fejring end en falsk.
- Nu hentes op til 4000 historik-rækker i baggrunden ved hver åbning (før skete det kun, når
  Fremgang blev åbnet). Det er én ekstra læsning. Hastigheden på en rigtig telefon mod prod er
  ikke målt.
- Kropsvægtsøvelser (vægt 0) giver aldrig rekord. e1RM (Epley) er et skøn, især ved mange reps.
  En rettelse af et allerede logget sæt ("ret") fejres ikke, men står i Fremgang, hvis den giver
  en rekord. Sæt fra "udfyld resten" tæller som gennemførte.
- Stiger et løft flere gange i samme uge, står hver stigning som sin egen rekord. I den
  syntetiske uge giver det 7.
- "Dine rekorder" bag "Mere" på forsiden læser stadig `personal_records`, mens de nye rekorder
  regnes ud fra loggen. De to kan vise forskellige tal. Jeg har ikke rørt det gamle kort.
- Program-fanens vej (toast efter serverens svar) er kun tjekket statisk og ikke i browseren.
- `e2e:fremgang` er rød, også på `main`: den leder efter teksten "kg e1RM" fra før 422. Den er
  ikke rettet her. `scripts/kritik-334.mjs` (et gammelt kritik-script, ikke et `verify:*`) leder
  efter "Ny personlig rekord" og vil fejle, hvis det køres.
- VideoCoach-clip-loggen indeholdt igen ffmpeg-metadata fra Marcs testvideo (sted, telefon,
  tid). Den er fjernet fra `outputs/439/koersel-videocoach-clip.txt` før commit.
- Alt er målt headless mod mocken, ikke på en rigtig telefon.
