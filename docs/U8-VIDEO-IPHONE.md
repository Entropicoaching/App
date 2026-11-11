# U8: kan det nye videomodul sende fra iPhone med filvælger? (ordre 78, 11. nov. 2026)

**Svar: nej, ikke med samme pålidelighed som U4. Atletens videoside bliver på `public/videocoach.html`.**

## Hvorfor

1. **Modulet sender ikke noget selv.** `src/entropi2/videocoach/` er tilstand og visning. `uploadController.mjs` linje 4 siger det selv: kun metadata og håndtag, intet medie, ingen transport, ingen klient. Filvalg (`onChooseSource`), klargøring (`prepare`) og upload (`upload`) skal leveres af værten. Intet i appen importerer modulet i dag, og `DEFAULT_VIDEOCOACH` er `false`.
2. **Modulet kræver et klip på højst 15 sekunder, lavet på telefonen.** `uploadController.mjs` linje 57 til 59 afviser alt, hvor `prepare` ikke giver et klip på højst 15 s, der passer til det valgte udsnit. Den eneste klipper i repoet, `src/videoCompression2.mjs` linje 55 til 58, bruger `video.captureStream`. Den findes ikke i Safari på iPhone, og koden siger det selv: "Denne browser kan ikke klippe video". Det er grunden til, at videoOptag2 er slukket.
3. **En anden klipper er ikke bevist.** Man kan tegne videoen på et lærred og optage lærredet (`canvas.captureStream` og `MediaRecorder` findes i Safari). Det koder om i realtid, mister lyd uden ekstra arbejde og er ikke prøvet på en rigtig iPhone. Det giver ikke U4's pålidelighed, og det kan ikke vises headless.
4. **At flytte siden kræver ændringer i `AthleteView.jsx`,** som er hash-låst af tre prøver.

## Den gamle side virker allerede med filvælger på iPhone

`public/videocoach.html` linje 1076 bruger `<input type="file" accept="video/*">` uden `capture`. Atleten vælger altså en fil, også på iPhone, og U4's pålidelighed ligger netop der: 50 MB afvises før upload, "Prøv igen" uden at vælge filen igen, og samme `clientAnalysisId`, så der ikke kommer to videoer.

## Hvad der skal til senere

Enten send hele filen (højst 50 MB) og gem det valgte udsnit som metadata, så klipningen sker hos coachen. Det ændrer modulets kontrakt og er en produktbeslutning. Eller byg og prøv en lærredsklipper på en rigtig iPhone, før siden flyttes.
