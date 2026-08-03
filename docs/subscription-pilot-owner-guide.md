# Pilotguide til Marc

Din opgave er at sikre adgang, lade testeren bruge produktet uden løbende hjælp
og notere de steder, hvor appen ikke forklarer sig selv.

Piloten må kun bruge Supabase shadow-projektet
`maxhsefxbrvsgolscqwh`. Brug aldrig produktionsprojektet, 1:1-atletdata eller
`profiles.role`. Testeren skal heller ikke inviteres ind i Supabase-
organisationen. Det ville give administrativ adgang og er ikke en løsning på
mailbegrænsningen.

## 1. Gør den offentlige adgang klar

`localhost` virker kun på din egen computer. En ekstern tester skal have en
offentlig HTTPS-adresse, og den samme adresse skal være tilladt som Auth
redirect-URL i shadow-projektet.

Kontrollér først:

1. Appen åbner på en telefon via
   `https://app.entropicoaching.dk/subscription.html`.
2. Supabase-dashboardets project ref er `maxhsefxbrvsgolscqwh`.
3. `.env.local` i app-worktreet indeholder shadow-URL, shadow project ref og en
   lokal `SUPABASE_SECRET_KEY` til owner-værktøjet.
4. Secret key ligger aldrig i dokumentation, terminalkommandoer, screenshots
   eller git.

Kør derefter:

```powershell
npm run verify:subscription-shadow-binding
npm run verify:subscription-public-build
```

Fortsæt kun ved `PASS shadow binding` og `PASS public subscription build`.
Public-buildet ligger lokalt i `dist-subscription-public` og indeholder kun
`subscription.html` og dens asset-bundle. Kommandoen publicerer ikke noget.

## 2. Sæt pilotoplysningerne én gang

Åbn PowerShell i app-worktreet. Ret e-mail, udløb og offentlig URL:

```powershell
$pilotEmail = 'tester@example.dk'
$pilotValidUntil = '2026-08-17T21:59:59Z'
$pilotUrl = 'https://app.entropicoaching.dk/subscription.html'
$pilotProject = 'maxhsefxbrvsgolscqwh'
```

Udløbet skal være et fremtidigt UTC-tidspunkt med `Z`. Vælg en reel slutdato
for piloten; værktøjet tillader højst 366 dage.

Kør den lokale preflight. Den foretager ingen netværkshandling:

```powershell
npm run owner:subscription-shadow-tester -- preflight --email $pilotEmail --valid-until $pilotValidUntil --redirect-to $pilotUrl
```

Forvent `state: DRY_RUN`, den rigtige e-mail, URL, udløbsdato og
`projectRef: maxhsefxbrvsgolscqwh`. Stop ved enhver afvigelse.

## 3. Vælg én invitationsvej

### A. Gratis manuel vej: følsomt invitationslink

Brug denne vej, hvis custom SMTP ikke er klar. Lav først et dry-run:

```powershell
npm run owner:subscription-shadow-tester -- invite-link --email $pilotEmail --valid-until $pilotValidUntil --redirect-to $pilotUrl
```

Når testeren sidder klar til at åbne linket, opretter du det faktiske link:

```powershell
npm run owner:subscription-shadow-tester -- invite-link --email $pilotEmail --valid-until $pilotValidUntil --redirect-to $pilotUrl --execute --confirm-project $pilotProject
```

Forvent `state: SENSITIVE_INVITE_LINK_CREATED` og `memberGranted: false`. Kopiér
`userId` til næste trin:

```powershell
$pilotUserId = '<USER-ID-FRA-OUTPUT>'
```

`actionLink` er et personligt loginlink. Det udløber hurtigt og giver adgang til
testerens Auth-konto, indtil det bruges eller udløber. Del det direkte med den
rigtige tester, mens personen er klar. Indsæt det aldrig i docs, git, en task,
et screenshot eller et delt notat.

En kort besked kan være:

> Her er dit personlige link til Entropi-piloten. Åbn det nu på den telefon og i
> den browser, du vil bruge til træning. Linket er personligt og udløber hurtigt.
> Skriv til mig, når du er logget ind.

### B. Mailvej: invitation via custom SMTP

Brug kun denne vej, når custom SMTP er sat op og testet. Kør først dry-run:

```powershell
npm run owner:subscription-shadow-tester -- invite --email $pilotEmail --valid-until $pilotValidUntil --redirect-to $pilotUrl
```

Send derefter invitationen:

```powershell
npm run owner:subscription-shadow-tester -- invite --email $pilotEmail --valid-until $pilotValidUntil --redirect-to $pilotUrl --execute --confirm-project $pilotProject
```

Forvent `state: INVITE_SENT` og `memberGranted: false`. Kopiér det returnerede
`userId` til `$pilotUserId` som vist ovenfor. Genudsend ikke automatisk ved et
uventet svar.

## 4. Vent på første login og kontrollér status

Login alene giver ikke member-adgang. Når testeren har åbnet invitationen og
skrevet “Jeg er logget ind”, kører du:

```powershell
npm run owner:subscription-shadow-tester -- status --email $pilotEmail --user-id $pilotUserId --execute --confirm-project $pilotProject
```

Fortsæt kun, når alle fire felter er rigtige:

- `invited: true`
- `confirmed: true`
- `loggedInAfterInvite: true`
- `readyForActivation: true`

Hvis ét felt er `false`, skal årsagen løses. Opret ikke en ny bruger eller et
entitlement ved siden af.

## 5. Aktivér den tidsbegrænsede member-adgang

Kontrollér aktiveringsplanen uden netværk:

```powershell
npm run owner:subscription-shadow-tester -- activate --email $pilotEmail --user-id $pilotUserId --valid-until $pilotValidUntil
```

Aktivér derefter gennem den kontrollerede service-RPC:

```powershell
npm run owner:subscription-shadow-tester -- activate --email $pilotEmail --user-id $pilotUserId --valid-until $pilotValidUntil --execute --confirm-project $pilotProject
```

Forvent `state: MEMBER_ACTIVATED`, `tier: member` og den aftalte udløbsdato. Bed
testeren genindlæse appen. En ny tester skal nu få én vej videre:
**Sæt dit program op**.

Skriv aldrig direkte i `sub_entitlements` eller `sub_assignments`. Værktøjet
bruger et deterministisk request-id, så samme aktivering kan kontrolleres uden
at oprette en ny adgang.

## Mail og Entropi-tekst

Siden 3. juni 2026 kan nye Supabase free-tier-projekter ikke tilpasse auth-mails
med Supabases standard-SMTP. Standard-SMTP sender desuden normalt kun til
pre-authorized adresser eller projektets organisationsteam. En ekstern tester
skal ikke gøres til teammedlem. Brug det manuelle `invite-link` eller opsæt
custom SMTP.

Brandede Invite- og Magic Link-mails kræver custom SMTP. SMTP-bruger og
adgangskode må kun ligge i Supabases beskyttede konfiguration.

**Invite-emne:** `Din adgang til Entropi-piloten`

```html
<p>Du er inviteret til at teste Entropis træningsapp.</p>
<p>Åbn adgangen på den telefon og i den browser, du vil bruge til træning.</p>
<p><a href="{{ .ConfirmationURL }}">Åbn din adgang</a></p>
<p>Linket er personligt og udløber af sikkerhedsgrunde.</p>
<p>Marc · Entropi Coaching</p>
```

**Magic Link-emne:** `Dit login til Entropi`

```html
<p>Dit login til Entropi er klar.</p>
<p><a href="{{ .ConfirmationURL }}">Åbn din træning</a></p>
<p>Hvis du ikke bad om linket, kan du ignorere mailen.</p>
<p>Marc · Entropi Coaching</p>
```

Se [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp) og
[Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Følg testen uden at overtage den

Lad testeren læse og vælge selv. Hjælp først, når personen reelt ikke kan komme
videre. Notér tidspunktet, hvad testeren forventede, og hvad der skete.

Hold især øje med:

- om valgte træningsdage, træningssted og løftevarianter følger med i programmet;
- om baseline kan udfyldes uden et nyt maxtest;
- om et pas kan lukkes med **Gem og gå tilbage** og fortsættes uden datatab;
- om vægt, reps og RPE er bevaret efter genindlæsning;
- om passet ender på **Gemt**, eller bliver stående lokalt;
- om **Historik**, **Program**, ugevurdering og næste uge giver mening.

Efter første pas: “Kunne du have gjort det samme uden mig?” Efter første uge:
“Hvis det kostede 100 kr. om måneden i dag, hvad skulle være bedre, før du
fortsatte?” Notér svaret ordret.

## Når noget går galt

Tag et screenshot før I nulstiller noget. Notér klokkeslæt, telefon, browser,
netværksstatus og den præcise tekst.

- **Gemt på denne enhed · synkroniserer:** Gå online, behold siden åben og log
  ikke sættene igen.
- **Kunne ikke synkronisere · prøv igen:** Tryk én gang på statusfeltet. Stop og
  dokumentér, hvis fejlen fortsætter.
- **Et igangværende pas ser tomt ud:** Ryd ikke browserdata. Kladden kan ligge
  lokalt.
- **Forkert variant, manglende afsluttet pas eller en anden persons data:** Stop
  straks, log ud og behandl det som P0/P1.
- **Free i stedet for member:** Kontrollér e-mail, `userId`, status-output og
  `validUntil`. Opret ikke en parallel adgang.

Adgangen udløber automatisk. Øjeblikkelig spærring, sletning eller forlængelse
er en særskilt, kontrolleret shadow-opgave. Undgå manuelle tabelrettelser.
