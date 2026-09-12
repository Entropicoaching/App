# Coach Briefing — Indbakke eller egen visning? (ordre 137 · commit 3)

**Kilde:** `n8n/README.md`, `src/coachPriority.js`, `src/dashboard/IndbakkeView.jsx`.
Ordren pegede på RAPPORT-100/105 (parathed/opvarmning) — de rører ikke Coach
Briefing (tjekket i git-historikken); n8n's README er autoritativ og
bekræfter RAPPORT-130's tolkning.

## Hvad Marc gør i dag

"Coach Briefing" findes ikke som en tredje visning. Det er to kanaler ind til
**samme** kø (`buildCoachPriorityItems`): appens Indbakke (`view === 'inbox'`,
`IndbakkeView.jsx`, 187 linjer) og en n8n-mail (`Coach Briefing v1`) der kun
sendes når noget vigtigt har stået uløst en hel dag — eksplicit skrevet som
"sikkerhedsnet", ikke en selvstændig oversigt. Mailens link peger tilbage på
samme Indbakke, så mail-klik og sidebar-klik lander samme sted.

**Klik fra atletlisten:** 1 (sidebar "Indbakke", altid synlig, med badge-tal).

## To muligheder

**A. Behold som i dag — Indbakke ER Coach Briefing.**
Ingen kode at bygge om; app og mail deler allerede samme kontrakt. Ulempe:
"Coach Briefing" findes kun i mailens emnelinje, ikke i appens UI.

**B. Byg en selvstændig "Coach Briefing"-visning** (kort morgen-opsummering,
adskilt fra den løbende Indbakke-kø).
Fordel: matcher navnet Marc rent faktisk bruger. Ulempe: reel ny
funktionalitet (to køer at holde i sync), ikke en omdøbning.

**Vaidyas anbefaling:** A — men det er Marcs kald.
