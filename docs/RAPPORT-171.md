# Rapport — Ordre 171: Coach Briefing er Indbakken, og mailen skal holde kæft

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`coach-briefing-a`, forgrenet fra `main` (`838dece`). Tre commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `ea9bccf` | Navnet "Coach Briefing" ét sted i UI'en (sidebar, mobil-nav, topbar, sidens h1) + placeringsdokumentet opdateret |
| 2 | `566060e` | Måling af mailens nuværende udløsning/betingelser, uden at gætte — 7 mails/uge FØR ændring |
| 3 | (denne commit — se `git log -1 coach-briefing-a`) | De tre regler rettet i workflowet, tests opdateret, måling gentaget — 3 mails/uge EFTER |

Arbejdstræet er rent efter hver commit. Ingen push, ingen produktions-Supabase,
ingen kørsel mod Marcs rigtige n8n-instans.

## Hvad blev ændret

**Commit 1.** Marc valgte A fra `docs/COACH-BRIEFING-PLACERING.md`: Indbakken
ER Coach Briefing, ingen ny visning. Navnet stod hidtil kun i mailens
emnelinje — nu står det også i selve appen: desktop-sidebar, mobil-bundnav,
topbar-titel og siden-h1 (`src/Dashboard.jsx`, `src/dashboard/IndbakkeView.jsx`).
Ingen ny rute, ingen ny kø, badge-tallet uændret. Placeringsdokumentet
opdateret med beslutningen: A gennemført, B droppet.

**Commit 2 (måling, intet rettet).** Læste `n8n/coach-briefing-v1.json` og
`n8n/README.md`: cronen kører hver time 12–21 Europe/Copenhagen; der sendes
kun når (1) mindst ét fallback-værdigt element findes, (2) den dedupede kø
ikke er tom, (3) der ikke allerede er sendt en briefing samme kalenderdag, og
(4) kørslen er produktion, ikke manuel test. Der var **ingen** kontrol af
typen "denne konkrete ting er allerede nævnt" — kun kalenderdagen huskes; en
gemt digest-hash blev aldrig læst nogen steder. Kørte den faktiske node-kode
fra workflowet (samme genbrugsteknik som `n8n/preview-coach-briefing.mjs`
selv bruger) i et lokalt, ikke-committet script: 7 simulerede dage × 10
timelige kørsler med to uløste ting (en 2 døgn gammel ulæst besked, et 3 døgn
gammelt videoudkast) der aldrig blev løst, gav **7 mails den uge** — samme to
ting nævnt igen hver dag.

**Commit 3 (rettelsen).** Ændrede workflowet (`n8n/coach-briefing-v1.json` +
`n8n/build-coach-briefing.code`, som skal være byte-identiske og er det) så
det holder de tre regler fra ordren:

1. **Højst én mail i døgnet** — allerede eksisterende (`Skip if sent today`,
   kalenderdag Europe/Copenhagen). Ingen ændring nødvendig.
2. **Kun hvis mindst én ting har stået uløst i et helt døgn** — hævede
   beskeders alderskrav fra 6 til 24 timer i `Keep unresolved backup items`
   (matcher nu videoudkasts eksisterende 24-timers-krav). **Bevidst valg,
   noteret her:** aktive `alert`-træningssignaler har fortsat ingen
   aldersgrænse og kan stadig udløse mailen straks — RPC'en
   (`entropi_coach_briefing_v1`) leverer ikke noget "opstået"-tidsstempel for
   signaler, og at tilføje ét ville kræve en Supabase-migration, som ordren
   forbyder. Alerts er desuden allerede designet til at være akutte
   (rank 0 i køen både i appen og mailen) — at tvinge dem til også at vente
   et døgn ville modarbejde den akutte hensigt, så jeg har ladet dem være.
3. **Aldrig en gentagelse inden for tre dage** — `Build briefing` husker nu,
   via workflow-static-data, hvornår hver enkelt opgave (stabil nøgle: samme
   som dedup-nøglen, fx `message-<athlete>-<track>`) sidst blev nævnt, og
   holder den tilbage i tre døgn. Er ALT det der stadig er uløst allerede
   nævnt inden for tre dage, bygges der slet ingen mail. `Record successful
   delivery` skriver stemplet, kun efter en faktisk afsendelse. Manuelle/
   editor-preview-kørsler springer denne undertrykkelse over (ligesom de
   allerede sprang dagsspærren over), så forhåndsvisningen altid viser hele
   den aktuelle kø. Emnelinjen er ændret til det format Marc bad om:
   `Coach Briefing: N ting har ventet et døgn`.

`n8n/verify-workflows.mjs` er opdateret til de nye regler: strammere
alderskrav i testdata (inkl. et nyt negativt eksempel, en besked der er for
"kun" 10 timer gammel og derfor korrekt holdes ude), ny emnelinje-tekst, og
fem nye assertions for tre-dages-reglen (delvis undertrykkelse, fuld
undertrykkelse → ingen mail, gentaget mere end tre dage senere → medtaget
igen, preview springer reglen over, `Record successful delivery` stempler
korrekt). `n8n/README.md` beskriver de tre regler og det opdaterede
alderskrav.

## Testresultat

**Målingen gentaget på samme uge (samme to uløste ting, samme 7×10
kørselsmønster):**

| | Før (commit 2) | Efter (commit 3) |
|---|---|---|
| Mails den simulerede uge | **7** (hver dag kl. 12) | **3** (dag 1, dag 4, dag 7) |

Efter-mønsteret viser reglen virker præcis som tiltænkt: samme sag nævnes
igen først når tre hele døgn er gået (dag 1 → dag 4 → dag 7), ikke hver dag.

**npm run lint:** rent.
**npm run verify:n8n:** grøn (inkl. de nye tre-dages-tests).
**npm run verify:coach-inbox-flow:** grøn (uberørt af denne ordre, kørt for
sikkerheds skyld da IndbakkeView.jsx blev rørt i commit 1).
**npm run verify:coach-priority:** grøn (uberørt — ingen ændring af
`buildCoachPriorityItems`' rangering, som ordren forbød).
**npm run e2e:** GRØN efter at rette `e2e/coach.spec.mjs`'s `getByText('Indbakke', ...)`
til `'Coach Briefing'` (commit 1's navneskift ramte selektoren) — "atlet →
coach, ende-til-ende (glat rejse + video + fejl + beskeder)", 25.1s.

## Hvad er næste

- **Alerts' manglende alderstempel** er den ene ærlige mangel i regel 2 (se
  Grænser). Skal RPC'en (`entropi_coach_briefing_v1`) udvides med et
  "opstået"-tidsstempel for signaler, er det en Supabase-migration — egen
  ordre, egen godkendelse.
- Har betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"):
  Marc oplevede selv mailen som spam ("det spammer min mail relativt meget")
  — det er nu rettet strukturelt (7→3 mails/uge i denne måling, og aldrig
  samme sag to gange på tre dage), samtidig med at navnet "Coach Briefing"
  nu er synligt i appen i stedet for kun i en emnelinje.

## Ærlige grænser

- Regel 2's undtagelse for `alert`-signaler (ingen 24-timers-ventetid) er et
  bevidst, begrundet valg, ikke noget der er dobbelttjekket med Marc — se
  ræsonnementet under "Hvad blev ændret", commit 3, punkt 2.
- Målingen af "mails/uge" er en lokal simulering af selve node-koden fra
  workflowet (ikke en rigtig n8n-kørsel eller en rigtig SMTP-afsendelse) med
  ét fast scenarie (to uløste ting, ingen nye ting, intet løst undervejs).
  Den beviser mekanikken (dagsspærre + 24-timers-krav + tre-dages-
  undertrykkelse) virker som beskrevet — den er ikke en produktionsmåling.
- Jeg har ikke kørt den fulde `verify:*`-suite (30+ scripts) — kun `verify:n8n`
  (rørt direkte), `verify:coach-inbox-flow` og `verify:coach-priority` (deler
  fil/kontrakt med det jeg ændrede i commit 1).
