# RAPPORT-171 — Coach Briefing er Indbakken, og mailen skal holde kæft

Gren: `coach-briefing-a` (base: `main`).

## Commit 2 — måling: hvor meget sender mailen faktisk

Kilde: `n8n/coach-briefing-v1.json`, `n8n/README.md`. Intet ændret i denne commit.

**Hvornår udløses den.** Node `Daily catch-up 12:00–21:00` er en cron-trigger
(`0 0 12-21 * * *`, tidszone Europe/Copenhagen) — kører hver hele time fra
12:00 til og med 21:00, altså 10 gange i døgnet. Der er også en `Manual test`-
trigger, men manuelle/editor-kørsler stoppes eksplicit af node
`Block test delivery`, før SMTP-noden — de kan aldrig sende en rigtig mail.

**Hvilken betingelse afgør om der sendes.** Alle fire skal være opfyldt:

1. Mindst ét "fallback-værdigt" element findes (node `Keep unresolved backup
   items`): en ulæst besked der er ≥ 6 timer gammel, et videoudkast der er
   ≥ 24 timer gammelt, eller et aktivt `alert`-træningssignal (ubekræftet og
   ikke udsat — ingen aldersgrænse på alerts i dag).
2. Den dedupede, prioriterede kø er ikke tom efter det (node `Build briefing`
   returnerer intet ved en tom kø — ingen tom mail).
3. Der er ikke allerede sendt en briefing samme kalenderdag, Europe/
   Copenhagen (node `Skip if sent today`: sammenligner `state.lastDeliveredDate`
   med dagens dato — kun i produktionskørsler, manuelle preview-kørsler
   springer denne kontrol over).
4. Kørslen er en produktionskørsel, ikke en manuel/editor-test (node
   `Block test delivery`).

**Hvad sker der hvis samme ting stadig er uløst i morgen.** Workflowet
husker i dag KUN kalenderdagen for sidste levering (`lastDeliveredDate`) og
gemmer en digest-hash (`lastDigestHash`) — men denne hash bliver aldrig læst
eller sammenlignet noget sted i workflowet, kun skrevet. Der findes altså
ingen kontrol af typen "denne konkrete ting er allerede nævnt". Er den samme
besked/det samme videoudkast/signal stadig uløst i morgen, nævnes den igen i
morgen, og igen i overmorgen — hver dag, uændret, indtil den bliver løst i
appen.

**Målingsmetode.** Kørte de faktiske node-kodestrenge fra
`n8n/coach-briefing-v1.json` (samme genbrugsteknik som
`n8n/preview-coach-briefing.mjs` selv bruger til at bygge sit forhåndsvisning
— node-koden hentes og eksekveres direkte fra JSON-filen, intet gættet) i et
lokalt, ikke-committet engangsscript. Simulerede 7 dage × 10 timelige
kørsler (12-21, Europe/Copenhagen) med persisterende workflow-static-data på
tværs af kørslerne (som n8n selv gør), og attrapdata for "et par uløste
ting" der aldrig bliver besvaret hele ugen: én ulæst besked (2 døgn gammel
ved ugens start) og ét videoudkast (3 døgn gammelt ved ugens start).

**Resultat (FØR ændring i commit 3): 7 mails på den simulerede uge** — én
kl. 12:00 hver dag, med nøjagtig de samme to uløste ting nævnt igen og igen,
fordi intet i dag forhindrer en daglig gentagelse af samme sag.
