# Brief: Udvælg opvarmningsøvelser til Entropi-appen

**Til en Claude-agent.** Din opgave er at udvælge og skrive opvarmningsøvelser til
en styrkeløfts-app. Du leverer to færdige JavaScript-objekter (`WARMUP_BASE` og
`WARMUP_ADDONS`) som indsættes direkte i appens kode. Læs hele briefen før du
begynder, og følg datastrukturen og stilen præcist.

---

## 1. Kontekst

Entropi er en træningsapp for styrkeløftere (squat, bænkpres, dødløft). Før hver
træning kan atleten åbne en **opvarmnings-guide**, der fører dem gennem en række
mobilitets-/aktiverings-øvelser én ad gangen, med en kort beskrivelse og enten et
rep-antal eller en nedtællings-timer.

I dag er guiden for **fastlåst**: der er præcis én hardkodet øvelse pr. "slot", ens
for alle atleter uanset niveau og dagsform. Vi vil gøre den **valgbar**: hver slot
skal tilbyde **2-4 alternativer**, så atleten kan vælge den variant der passer til
deres krop, niveau og hvad der er stramt i dag — uden at den samlede opvarmning
bliver længere (stadig ca. 4-6 øvelser i alt pr. session).

**Vigtigt:** Niveau styres IKKE af et eksplicit felt. Alternativerne i hver slot
skal i stedet dække et naturligt spænd — fra simple/tilgængelige til mere krævende
varianter — så atleten selv vælger det der giver mening. Beskriv aldrig en øvelse
som "for begyndere" / "for øvede"; lad selve øvelsen tale.

---

## 2. Sådan bruges øvelserne i appen

Opvarmningen sættes sammen af to dele:

1. **Base-slots** — bestemt af dagens primære løft (fokus). Atleten vælger fokus:
   `Squat`, `Bænkpres` eller `Dødløft` (og for dødløft: `Konventionel` eller `Sumo`).
   Hvert fokus har **3 base-slots** (fx hofte-mobilitet, aktivering,
   bevægelsesmønster). Disse er ALTID med.

2. **Problem-slots** — atleten kan valgfrit vælge **op til 2** områder der er
   stramme/tunge i dag (fx hofte, lyske, lænde). Hvert valgt område tilføjer ét slot.

Samlet = 3 base-slots + 0-2 problem-slots = **3-5 slots**. Hver slot viser sine
2-4 alternativer som valgknapper; atleten vælger ét (default = det første), og
guiden steper så gennem de valgte øvelser.

---

## 3. Output-datastruktur (følg PRÆCIST)

Lever to objekter. Hver slot har et `slot`-navn (kort, vises ikke nødvendigvis,
men bruges til struktur) og et `options`-array med 2-4 øvelser. **Hver øvelse**
har præcis disse felter:

```js
{
  id:    'sq-hofte-1',     // unik, kebab-case: <fokus/område>-<slot>-<nr>
  name:  'Bodyweight squat',   // kort øvelsesnavn (dansk hvor naturligt)
  desc:  'Stå med skulderbredde. Sæt dig så dybt ...',  // 1-3 sætninger, se §5
  label: '10 reps',        // hvad atleten skal gøre — se format nedenfor
  type:  'reps',           // 'reps' ELLER 'timer'
  duration: 30,            // KUN når type === 'timer'. Antal sekunder. Udelad ved 'reps'.
}
```

**`label`-format:**
- `type: 'reps'` → fx `'10 reps'`, `'10 reps pr. side'`, `'8 reps pr. ben'`, `'15 reps'`
- `type: 'timer'` → fx `'30 sek'`, `'20 sek pr. side'` — og sæt `duration` til sekundtallet (pr. side tæller som varigheden for én side).

### 3a. WARMUP_BASE — base-slots pr. fokus

Brug **præcis disse fire nøgler** (de matcher appens kode):

```js
const WARMUP_BASE = {
  'Squat': [
    { slot: '<slot-navn>', options: [ /* 2-4 øvelser */ ] },
    { slot: '<slot-navn>', options: [ /* 2-4 øvelser */ ] },
    { slot: '<slot-navn>', options: [ /* 2-4 øvelser */ ] },
  ],
  'Bænkpres': [ /* 3 slots */ ],
  'Dødløft — Konventionel': [ /* 3 slots */ ],
  'Dødløft — Sumo': [ /* 3 slots */ ],
}
```

Foreslået slot-tema pr. fokus (du må gerne justere navnene, men behold 3 slots der
dækker: led-mobilitet → muskel-aktivering → selve bevægelsesmønsteret):

- **Squat:** hofte-/ankel-mobilitet · balle-/lår-aktivering · squat-mønster
- **Bænkpres:** skulder-/bryst-mobilitet · scapula-/rotatorcuff-aktivering · pres-/bænk-mønster
- **Dødløft — Konventionel:** ryg-/hofte-mobilitet · balle-/baglår-aktivering · hip-hinge-mønster
- **Dødløft — Sumo:** hofte-/lyske-mobilitet (ekstern rotation, adduktorer) · balle-aktivering · sumo-stance-mønster

### 3b. WARMUP_ADDONS — problem-områder

Brug **præcis disse otte nøgler**:

```js
const WARMUP_ADDONS = {
  'Hofte / baller':   { slot: 'Hofte / baller',   options: [ /* 2-4 øvelser */ ] },
  'Lyske / inderlår': { slot: 'Lyske / inderlår', options: [ /* 2-4 øvelser */ ] },
  'Lænde':            { slot: 'Lænde',            options: [ /* 2-4 øvelser */ ] },
  'Øvre ryg':         { slot: 'Øvre ryg',         options: [ /* 2-4 øvelser */ ] },
  'Ankel':            { slot: 'Ankel',            options: [ /* 2-4 øvelser */ ] },
  'Knæ':              { slot: 'Knæ',              options: [ /* 2-4 øvelser */ ] },
  'Skulder':          { slot: 'Skulder',          options: [ /* 2-4 øvelser */ ] },
  'Nakke / trapez':   { slot: 'Nakke / trapez',   options: [ /* 2-4 øvelser */ ] },
}
```

Hvert område skal tilbyde 2-4 målrettede øvelser til netop det område (mobilitet
og/eller aktivering), så atleten kan vælge den der rammer deres stramhed.

---

## 4. Eksempel — så du rammer stilen (NUVÆRENDE indhold)

Sådan ser de nuværende (faste) øvelser ud. Stilen på `desc`, `label`, `type` og
`duration` skal matche dette. Du udvider blot til 2-4 valg pr. slot:

```js
// Squat (i dag 3 faste — gør hver til en slot med 2-4 valg)
{ name: 'Bodyweight squat', desc: 'Stå med skulderbredde. Sæt dig så dybt ned som muligt og hold et par sekunder fornede — hælene skal blive i gulvet. Fokus på at åbne hofterne.', label: '10 reps', type: 'reps' },
{ name: 'Hip circles', desc: 'Stå på ét ben, løft det andet knæ til hoftehøjde og lav store, langsomme cirkler med hoften — udad og bagud. Åbner hofteleddet i alle retninger.', label: '10 reps pr. side', type: 'reps' },
{ name: 'Glute bridge', desc: 'Lig på ryggen med bøjede knæ og fødder fladt i gulvet. Skub hofterne op og klem ballerne hårdt i toppen — hold et sekund. Sænk roligt ned.', label: '15 reps', type: 'reps' },

// Sumo-specifik (bemærk fokus på lyske/ekstern rotation)
{ name: 'Sumo squat med pause', desc: 'Stå bredt med tæerne pegende udad — samme bredde som din sumo-stance. Sæt dig roligt ned og hold et par sekunder fornede. Aktiverer lysken og åbner hofteleddet til din stance.', label: '10 reps', type: 'reps' },
{ name: 'Adduktor stretch siddende', desc: 'Sid på gulvet med benene spredt bredt ud til siderne. Læn langsomt fremad fra hoften med ret ryg og hold. Mærk strækket i inderlårene — afgørende for sumo-stance.', label: '30 sek', type: 'timer', duration: 30 },

// Problem-område eksempel (i dag 1 fast pr. område — gør til 2-4 valg)
'Øvre ryg': { name: 'Thorax extension over rulle', desc: 'Læg en rullet håndklæde eller skumrulle tværs under øvre ryg mellem skulderbladene. Læn forsigtigt bagover med hænderne bag nakken og åbn brystet mod loftet.', label: '30 sek', type: 'timer', duration: 30 },
```

---

## 5. Stil- og kvalitetskrav til `desc`

- **Sprog:** dansk, du-form, rolig og instruerende — som en god coach der står ved siden af.
- **Længde:** 1-3 sætninger. Konkret nok til at udføre øvelsen korrekt UDEN billede.
- **Indhold:** start-position → bevægelse → hvad man skal mærke/fokusere på. Nævn
  gerne hvilket led/muskelgruppe øvelsen rammer, og hvorfor det hjælper netop det løft.
- **Ingen udstyr** ud over hvad der er normalt i et styrkeløftsmiljø (stang, skumrulle,
  håndklæde, væg, bænk, evt. elastik). Antag ikke specialudstyr.
- **Variation i en slot:** de 2-4 valg skal være reelt forskellige (fx ét stræk, én
  aktivering, ét bevægelsesmønster — eller forskellige sværhedsgrader), så valget
  giver mening. Undgå tre næsten ens varianter.
- **Sikkerhed:** ingen øvelser der belaster en kold krop hårdt; opvarmning skal være
  let og forberedende, ikke trættende.

---

## 6. Faglige rammer

- Målgruppe: voksne styrkeløftere, blandet niveau (motionist → konkurrence).
- Tre konkurrenceløft: squat, bænkpres, dødløft. Dødløft trænes både konventionelt
  og sumo — sumo kræver markant mere hofte-ekstern-rotation og adduktor/lyske-mobilitet.
- Opvarmningen skal forberede netop dagens løft (specifik mobilitet + aktivering),
  ikke være en generisk full-body rutine.
- Hold det effektivt: en hel opvarmning (3-5 slots × 1 valgt øvelse) bør kunne klares
  på 5-10 minutter.

---

## 7. Leverance

Lever **ét svar** med de to færdige objekter `WARMUP_BASE` og `WARMUP_ADDONS` i en
enkelt JavaScript-kodeblok, klar til at paste ind. Krav til leverancen:

- Gyldig JS (objekt-literaler, trailing commas ok). Ingen kommentarer nødvendige.
- Alle `id` unikke.
- `type: 'timer'` har altid et `duration` (sekunder); `type: 'reps'` har aldrig `duration`.
- Brug de eksakt angivne nøgler i §3a og §3b — hverken flere eller færre.
- 3 slots pr. fokus; 2-4 options pr. slot; 2-4 options pr. problem-område.

Når du er færdig: skriv kort (3-5 linjer) hvilke valg du traf for variation/niveau,
så coachen hurtigt kan vurdere og evt. bede om justeringer.
