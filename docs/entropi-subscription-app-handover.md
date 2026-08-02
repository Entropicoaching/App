# Entropi abonnementsapp — pausepunkt

## Aktiv status · 2. august 2026

Launch-repairen er gennemført lokalt mod **kun** Supabase shadow
`entropi-subscription-shadow` (`maxhsefxbrvsgolscqwh`). Afsnittet nedenfor fra
1. august er bevaret som historik, men er ikke længere den aktuelle status.

- Den inviterede pilot har fortsat ét aktivt member-entitlement og ingen
  efterladt test-member eller assignment. Efter login får kontoen derfor præcis
  én naturlig `Sæt dit program op`-vej.
- `sub-13-member-self-setup.DRAFT.sql` og den isolerede tier-funktion i
  `sub-14-isolated-access-v2.DRAFT.sql` er kørt i shadow. Ingen produktionsdata,
  `profiles.role`, 1:1-atletdata eller eksisterende 1:1-politikker er brugt.
- Setup-RPC'en er owner-bound, idempotent og opretter member + første assignment
  atomisk fra brugerens programvalg og rå baseline-input. Et autentificeret
  pilot-dry-run blev afsluttet med `ROLLBACK`; kontrol bagefter viste 0 pilot-
  members og 0 assignments.
- Memberflowet dækker onboarding, 1RM eller tungt sæt, 2/3/4 dage,
  nybegynder/øvet, Full Gym/Hjemmetræning, valgte squat-/dødløftvarianter,
  komplet uge-1-log, ugereview og en fortsættende, eksplicit uge-N-cyklus.
- Uge 2 er ikke længere et endepunkt. En komplet passende gym-uge foreslår ét
  fast +2,5 kg-trin; negative signaler holder belastningen. Rejsen er manuelt
  kørt til uge 3 og genoptaget korrekt efter refresh.
- Member har nu fast navigation til dagens pas, aktuelt program og historik med
  seneste pas, sammenlignelige hovedløft og ugevurderinger. Et igangværende pas
  kan lukkes og genoptages uden at kassere kladden. Alle genererbare øvelser har
  korte danske teknikfokuspunkter ved programmet og det aktive sæt.
- Sikker historikgenopretning placerer et eksisterende medlem på næste kendte
  pas på en ny enhed. Rejsen er bundet til shadow-tildelingens immutable
  programindhold, og hele den understøttede aktive historik bruges sidevist til
  recovery. Ugyldig eller tvetydig historik fejler lukket og starter aldrig
  medlemmet lydløst forfra på uge 1.
- Den fulde programmatrix er testet for 96 kombinationer; mobilflow M18 er kørt
  ved 390 × 844 px helt til accepteret uge 2 med 32/32 uge-1-sæt.
- Aktiv lokal pilot-URL: `http://localhost:5199/subscription.html`.
- Ingen deploy- eller produktionshandling. Branchleveringen dokumenteres i den
  afsluttende launch-rapport; shadow og produktion holdes fortsat adskilt.

Åbne manuelle beviser: Marc skal stadig klikke et rigtigt magic-link fra sin
mail og gennemføre offline → online-synk i den aktive shadow-session. Et pas
hvor samtlige sæt springes over bevares lokalt, men den nuværende
completed-set-RPC kan ikke persistere et sådant pas uden at fremstille falske
sætdata. Tidsrecepter har countdown, men aktiveres ikke før RPC'en kan gemme
varighed som sekunder.

## Historisk pausepunkt · 1. august 2026

Status pr. 2026-08-01: **parkeret bevidst før migration og frontend-integration**.

De seks oprindelige shadow-udkast nedenfor er historik. Den aktuelle
fail-closed kontrakt er `sub-01`–`sub-11`, er ikke kørt af denne opgave og er
dokumenteret i `subscription-shadow-backend-safe-path.md`.

Det færdige fundament i skyggeprojektet `maxhsefxbrvsgolscqwh`:

- Seks additive `sub_*`-SQL-udkast er afprøvet i skyggen, aldrig i produktion.
- `free` ser kun `start-2`; `member` ser de tre testprogrammer.
- En bruger med selvskrevet `profiles.role='coach'` får ingen ekstra adgang i abonnementssporet.
- Direkte kald til den parametriserede tier-funktion afvises.
- En free-bruger kan ikke tildele sig et kendt member-program.
- Træningshistorik er adskilt pr. bruger; ejerens egne sæt kan logges.
- Supabase Advisor viste ingen nye sikkerheds- eller performanceproblemer.

Bevidst ikke gjort:

- Ingen ændring i produktionsprojektet.
- Ingen frontend koblet på Supabase.
- Ingen betaling, Stripe, deploy, repository-oprettelse eller DNS.
- Ingen commit eller push.
- Programmerne er kun testindhold; katalogets størrelse er ikke en produktbeslutning endnu.

Når sporet genoptages:

1. Claude Code implementerer frontend-forbindelsen mod **skyggeprojektet** ud fra `entropi-subscription-app-slice2-plan.md`.
2. Codex gennemgår adgang, dataejerskab og UX mod den aftalte free/member-grænse.
3. Først derefter besluttes produktionsmigration, deploy-spor og betaling som selvstændige opgaver.

Nuværende prioritet: Entropi Coaching-brandet, hjemmeside og den lokale content-pipeline.
