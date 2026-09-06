# ORDRE 70 — jargon og selvbetjening

Spor (Harā): `spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a` ("Appen mærkbart
bedre for atleterne"), under `goal-coaching-vaerdigt-produkt` ("Coaching der
er et værdigt produkt"), planet Entropi Coaching.

## Gren

`jargon-og-selvbetjening`, fra `main` `bab8087` (ordre 68 merget).

Commits:
- `af5ef04` — fix #1: F17+F18 — TDEE, e1RM, PR og de to beskedspor forklaret
- `e4921fa` — fix #2: G6+G7+G11 — selvbetjening ved ubekræftet email og log ud
- (denne rapport, separat commit)

Rent træ. De utrackede `drafts-*`-mapper og
`docs/videocoach/ENT0092-AUDIT-EE6D8A8.md` er urørt.

## Hvad ændret

**Commit 1 — F17+F18: jargon**

**F17 — "TDEE" i Kostlog.** Fik en fast, altid synlig linje lige under tallet
(ikke gemt bag fold-ud, i modsætning til resten af TDEE-kortets detaljer):
"Det din krop cirka bruger på en dag, regnet af dine egne vejninger og din
kost." — Marcs sprog, ingen hjælpeside.

**To flere fund af samme slags, fundet under selve gennemgangen (ikke i
ordre 41's liste):**
- **"e1RM"** i Program-fanens styrkeudviklings-graf ("bedste e1RM pr. uge,
  kg") stod helt uforklaret — værre end TDEE, fordi det er en forkortelse
  af en forkortelse. Fik en linje: "e1RM er et regnestykke ud fra din vægt
  og dine reps, der viser hvor stærk du cirka er lige nu — ikke et forsøg
  du faktisk har taget."
- **"PR"** i PR-toasten ("Ny vægt-PR", "Ny rep-PR") — løst ved at skrive
  ordet ud i stedet for forkortelsen ("Ny personlig rekord (vægt)"/"(reps)"),
  samme behandling som RPE allerede fik i en tidligere ordre. Fjernede
  samtidig toastens afsluttende udråbstegn (ordrens tekstregel).

**RPE er bevidst ikke rørt** — den har allerede en fuld infoknap
("ℹ" → RPE-skala-modal) fra en tidligere ordre (ordre 41's fund F19), som
er en bedre løsning end en enkelt linje. Verificeret stadig til stede.

**F18 — de to beskedspor.** Undersøgte hvad de faktisk er: "Beskeder" og
"Teknik & løft" er IKKE bare to faner på samme data — de gemmer beskeder
med et forskelligt `category`-felt afhængigt af hvilket spor man skriver
fra (`category: msgTrack` ved afsendelse), og "Teknik & løft" fletter
desuden coachens delte videofeedback (`sharedVideoAnalyses`) ind i tråden.
De er altså reelt forskellige, ikke en tilfældig UI-opdeling af den samme
ting — **konklusion: de skal IKKE slås sammen.** Løsningen blev derfor en
fast, altid synlig linje under fane-rækken der siger hvad det aktive spor
er til, i stedet for den gamle tom-tilstand-tekst der kun var synlig så
længe der ingen beskeder var:
- "Teknik & løft": "Til spørgsmål om teknik og løft, og til coachens
  videofeedback."
- "Beskeder": "Til alt andet — status, spørgsmål og det der ellers fylder."

**Commit 2 — G6+G7+G11: selvbetjening**

**G6 — send bekræftelseslink igen.** Der var ingen vej til et nyt
bekræftelseslink, hvis en ny atlet aldrig fik eller åbnede den første mail
ved oprettelse — kun en generisk "email not confirmed"-fejl ved næste
loginforsøg, ingen udvej uden Marc. Login-fejlen genkendes nu særskilt
(samme mønster som `athleteAuthErrorMessage` allerede bruger), og der vises
et "Send bekræftelseslink igen"-link der kalder `supabase.auth.resend({
type: 'signup', email })`. Samme neutrale, korte stil som glemt-adgangskode-
flowet fra ordre 41.

**G7 — log ud-bekræftelse.** Kontomenuens "Log ud" loggede fuldt ud og
genindlæste siden på ét tryk, uden fortryd — et fejltryk midt i en session
gav ingen vej tilbage. Genbruger nu appens EGEN eksisterende
bekræftelses-dialog (`askConfirm`/`confirmDialog`, allerede brugt til
"Spring resten over" og "Auto-udfyld" i sæt-loggeren), med teksten "Log ud
af Entropi? Du skal logge ind igen for at fortsætte." Ingen ny UI-komponent
bygget — kun koblet til det der allerede findes.

**Valgt oveni, som den tredje ("højst én mere ... hvis den er lige så
billig"): G11.** Auth.jsx's tilstandsskift nederst på login-skærmen ("Ingen
konto? Opret her" / "Har du en konto? Log ind") var almindelige
`<span onClick>` uden nogen padding eller `minHeight` — sad dér hvor en
tommelfinger nemmest rammer forkert, mens "Glemt adgangskode?" lige ovenover
allerede havde fået 44px i ordre 41. Valgt fordi det er billigere end G6/G7
(to linjers style-tilføjelse, samme allerede-etablerede `minHeight: '44px'`-
mønster, ingen ny logik) og retter en reel uens-behandling på samme skærm.

**Ikke valgt fra G5-G13:** G9/G10/G13 er samme 44px-mønster, men på andre
skærme (blok-skift, parathed/vægt, session-vurdering) — ikke selvbetjening,
og der var kun plads til én ekstra i denne ordre. G8 (kontomenuen er eneste
vej til tre handlinger) kræver en navigationsændring, ikke en
enkelt-linje-rettelse. G5/G12 (timer-drift, mistet parathedsformular ved
lukket fane) er andre kategorier (drift/datatab), ikke selvbetjening.

**Verifikationsscripts (nye)**

- `scripts/verify-athlete-jargon-explained.mjs` — TDEE, e1RM, PR og de to
  beskedspor har hver deres forklaring; bekræfter samtidig via kildekoden
  at de to spor rent faktisk er forskellige (`category: msgTrack`).
- `scripts/verify-athlete-self-service.mjs` — resend-flowet er koblet til
  et rigtigt Supabase-kald, log ud spørger om bekræftelse, og Auth.jsx's
  tilstandsskift har 44px.

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler
  som på uændret main, urørt).
- `node --test src/*.test.js` — 48/48 grønne, ingen ny testfil nødvendig
  (rene tekst-/JSX-ændringer, dækket af de to nye verify-scripts i stedet).
- `npm run verify:athlete-jargon-explained` — grøn (ny).
- `npm run verify:athlete-self-service` — grøn (ny).
- `npm run gate:tracker` — grøn (uændret, videocoach er urørt).
- Sidetjekket, alle fortsat grønne: `verify:athlete-password-reset`,
  `verify:athlete-onboarding`, `verify:athlete-onboarding-guide`,
  `verify:athlete-tap-targets`, `verify:athlete-write-failures`,
  `verify:coach-inbox-flow`, `verify:coach-priority`,
  `verify:progression-state`.
- `verify:auth-logout-role-switch` og `verify:athlete-first-day-flow`
  fejler fortsat, men med PRÆCIS samme fejl som på uændret `main` (bekræftet
  ved at køre begge scripts mod `main` uden mine ændringer — den ene fejler
  identisk allerede der, den anden hasher et kodeafsnit,
  `calcReadinessScore`→`fetchProgram`, som jeg slet ikke har rørt, og som
  allerede ikke matcher den forventede hash på `main`). Begge
  præeksisterende, ikke min kode.

**Headless på smal viewport (390×844)**

- **Den ægte, uændrede login-skærm** (ingen loginforsøg): TDEE-relaterede
  ændringer rører ikke denne skærm, men bekræftede at G11-rettelsen (større
  trykflade på "Opret her") ikke har flyttet layoutet.
- **TDEE-linjen og log ud-bekræftelsen**: AthleteView.jsx kan ikke mountes
  direkte uden en ægte, indlogget atlet-session mod PRODUKTIONS-Supabase
  (mange `supabase.from()`-kæder i data-hentningen, som jeg hverken må eller
  kan stubbe uden en større indsats). I stedet genbrugte jeg de nøjagtige
  JSX-blokke og style-værdier fra selve rettelserne (TDEE-kortet,
  kontomenuen, bekræftelses-dialogen), kopieret ordret ind i en midlertidig,
  ikke-committet preview-harness med syntetisk indhold — samme metode som
  ordre 41 brugte til sæt-loggeren. Set: TDEE-linjen sidder synligt lige
  under tallet uden at forstyrre layoutet; klik på "Log ud" åbner nu
  bekræftelses-dialogen ("Log ud af Entropi? ... / Annuller / Bekræft") i
  stedet for at logge ud med det samme. Harnesset er slettet efter brug,
  ingen spor tilbage i grenen.
- **G6 (send bekræftelseslink igen)**: verificeret i en tilsvarende
  midlertidig harness der mounter den ÆGTE, uændrede `Auth.jsx` og kun
  erstatter de to netværkskald (`signInWithPassword`, `resend`) med
  deterministiske stubs — ingen rigtigt login-forsøg, ingen skrivning mod
  produktion. Set: et login med en syntetisk email giver "Bekræft din email
  via linket, før du logger ind." + et synligt "Send bekræftelseslink
  igen"-link; klik på linket kalder det rigtige `supabase.auth.resend(...)`
  (bekræftet via en konsol-log i stubben) og viser "Der er sendt et nyt
  bekræftelseslink til ...".

## Hvad er næste

Fra ordre 41's fundliste er nu tilbage (ikke rettet, kun dokumenteret):

- **G1** (`fetchProgram` m.fl. uden fejltjek) — stadig den tætteste
  kandidat, ikke selvbetjening eller jargon, hører til en fremtidig
  "stille fejl"-ordre.
- **G2/G3, F4, F5, F6, F7, F13-F16, F21, F22** — uændret siden ordre 41/68,
  ingen af dem er jargon eller selvbetjening.
- **G8** — kontomenuens "⋯" er eneste vej til log ud, guide-genstart og
  rolleskift. Kræver en navigationsændring, ikke en enkelt rettelse.
- **G9/G10/G13** — samme 44px-mønster som G11, men på blok-skift-chips,
  parathed/vægt-knapper og session-vurderingsknapper. Billige, men uden for
  denne ordres to temaer (jargon, selvbetjening).
- **G5, G12** — timer-drift ved baggrundslås og mistet parathedsformular ved
  lukket fane. Andre kategorier (drift/datatab), ikke rørt.
- **F25's driftsafhængighed** (Supabase Redirect URLs) er stadig ubekræftet
  af Marc, uafhængigt af denne ordre.

Højeste prioritet til en fortsat "selvbetjening"-runde: G9/G10/G13 (samme
44px-mønster, billigt) og G8 (kræver en bevidst beslutning om
navigation, ikke kun en style-fix).

## Ærlige grænser

- Ingen af de fire jargon-forklaringer eller de tre selvbetjeningsrettelser
  er set med en rigtig, indlogget atlet — samme strukturelle begrænsning som
  ordre 41 og 68 (lokal dev peger på PRODUKTIONS-Supabase, jeg må hverken
  oprette en testkonto der eller bruge en rigtig atlets login).
- TDEE-linjen og log ud-bekræftelsen er set i en preview-harness der
  genbruger de nøjagtige style-værdier og JSX-tekst fra rettelserne, men
  IKKE den fuldt mountede `AthleteView`-komponent — jeg kan derfor ikke
  garantere at der ikke er en uforudset visuel kollision med noget andet på
  den rigtige Kostlog-side (fx en anden komponent der også lægger sig lige
  under TDEE-kortet). Kildekode-diffen er lille og lokal, så risikoen
  vurderes lav, men det er en antagelse, ikke en observation.
- G6's fulde runde (en atlet der rent faktisk ikke fik den første mail,
  klikker "Send igen", modtager en ny mail, klikker det nye link) er ikke
  afprøvet ende-til-ende — kun at UI'en kalder det rigtige Supabase-kald.
  Samme begrænsning som ordre 41 dokumenterede for glemt-adgangskode-flowet.
- Om de to beskedspor rent faktisk forvirrer en ny atlet (F18's oprindelige
  antagelse) er stadig ikke bekræftet med en rigtig atlet — kun at de er
  reelt forskellige i kildekoden, hvilket betyder forklaring var det rigtige
  valg frem for sammenlægning.
