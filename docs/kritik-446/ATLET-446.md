# Kritik 446, blok 1: atleten i kælderen

Målt mod main `dd68c77` (397–439 merget, ikke pushet). Før 439 er `412f2c1`. Alt er kørt headless mod e2e-mocken
med den opdigtede Testatlet. Der er ingen kald mod prod og ingen atletdata.

**Telefonen:** 390 × 844 med touch og iPhone-UA. Den er drosslet som en ældre telefon: Lighthouse' Slow 4G (150 ms,
1,6 Mbit/s ned, 750 kbit/s op) og 4× langsommere CPU. Appen er bygget mod mocken og kører med `public/sw.js`, som
i produktion.

**Historik:** "Let" er 3 uger, 114 sæt. "Tung" er 130 uger med 4 pas pr. uge, i alt 4940 sæt, hvoraf 4290 tæller
med vægt. Tung ligger over appens grænse på 4000.

Scripts, rå tal og skærmbilleder ligger i `outputs/kritik-446/` (`tid-446`, `graense-446` og `uge-446`, `.mjs` +
`.json`, `U-*.png`, `G-*.png`).

## 1. Tid til Dagens pas er brugbart (før og efter 439)

"Brugbart" betyder, at kortet viser et sæt, vægtfeltet er udfyldt, og Godkendt kan trykkes. Målingen er median af
3 genåbninger med drosling, efter ét login.

| Historik | Før 439 | Efter 439 | Historik-kaldet (efter) |
|---|---|---|---|
| Let (114 sæt) | 1,0 s | 1,0 s | 15 kB, færdigt efter 1,3 s |
| Tung (4940 sæt) | 3,3 s | **5,3 s** | **623 kB**, færdigt efter **7,7 s** |

- Med let historik koster 439 ingenting.
- Med tung historik kommer Dagens pas ca. **2 s senere** end før 439. Historik-kaldet (op til 4000 rækker med
  øvelsesnavn) deler den langsomme linje med ugens egne kald. En åbning henter 1,4 MB i alt mod 0,77 MB før.
- Rekord-grundlaget er først klar ca. 2,6 s efter, at kortet er brugbart (uge-kørslen). Logges første sæt i det
  vindue, fejres en rekord ikke (439's egen grænse: hellere ingen fejring end en falsk).
- Første login på den ældre telefon: 8,0 s til brugbart. Genåbning med net: 5,1 s. Genåbning uden net: 2,1 s.

## 2. Rekorden mod rækkegrænsen (`graense-446`)

Den opdigtede atlet squattede engang 110 × 5 (e1RM 128). I dag løftes 100 × 5 (e1RM 117), som ikke er en rekord.

| Den gamle top ligger | Rækker hentet | "Bedst før" appen ser | Fejring |
|---|---|---|---|
| 130 uger tilbage | 4000 (appens grænse) | 114 | **"Ny rekord: Squat e1RM 117 kg, +3 kg" (falsk)** |
| 60 uger tilbage | 4000 | 128 | ingen (rigtigt) |
| 60 uger tilbage, Supabase-loft 1000 | 1000 | 114 | **"Ny rekord" (falsk)** |

Rekorden regnes kun ud fra de nyeste 4000 sæt. PostgREST's "Max rows" er 1000 i et nyt Supabase-projekt. Står prod
sådan, er det kun de nyeste 1000 sæt, altså ca. 5–6 måneder for en atlet med 4 pas om ugen. Prod's indstilling er
ikke læst. Fejringen kommer også i "din uge" og i Fremgang.

## 3. En hel uge (`uge-446`)

Scenariet:
- Pas 1 med net til og med squat sæt 4. Så forsvinder nettet (kælderen).
- Resten af pas 1 og hele pas 2 uden net: rekord uden net, RPE 9 og en note, "Spring over", vurdering af passet, og
  appen lukkes og åbnes igen midt i pas 2.
- Nettet kommer tilbage, og appen lukkes midt i afsendelsen (efter 18 skrivninger, 15 sæt stadig i køen).
- Pas 3 og 4 med net, "din uge" med en linje til coachen, Fremgang og en video.

**Holder:**
- **Intet sæt tabt, ingen dubletter:** 38 af 38 sæt står i mocken, hvert én gang, også efter lukningen midt i
  afsendelsen. Køen var tom 8,5 s efter, at nettet kom tilbage.
- **Rigtig tid:** alle 38 sæt har tiden fra "Godkendt" (afvigelse 0,0–0,2 s), også de 17, der blev sendt senere.
- **Rekorder én gang:** 7 rekorder, hver fejret én gang (også hen over genåbningerne), 7 forskellige i Fremgang og 7
  i "din uge". Rekorden uden net (bænkpres 70 × 8) blev fejret på kortet med det samme.
- RPE 9 og noten fra kælderen nåede frem.
- Genåbnet uden net står Dagens pas på det rigtige sæt (Rows 2/3) med "12 sæt gemt lokalt". Der kommer ingen
  login-skærm.
- Video: én kvittering, "Video modtaget ✓", efter ca. 1 s og én række. Ingen konsolfejl og ingen vandret rul på
  390 px.

**Fund (uddybet i `KRITIK-app-push.md`):**
- **"Spring over" virker ikke uden net.** Kortet bliver stående på Bænkpres 4/4, og der kommer en kort fejlbesked,
  "Sættet kunne ikke springes over". Atleten kan kun komme videre ved at godkende et sæt, atleten ikke lavede. I
  scriptet blev det derfor et gennemført sæt, som coachen ser som lavet.
- **Vurderingen af passet virker ikke uden net.** "Feedbacken blev ikke gemt". Linjen bliver stående, men efter
  genåbningen er den væk. Pas 1 og 2 fik aldrig en vurdering. "din uge" viser "–" for begge.
- **Vægtfeltet er tomt efter genåbning uden net** på øvelser uden "Anbefalet" (Rows, Triceps), selvom kortet selv
  siger "senest 25kg × 10". Godkendt gemmer så **0 kg**: 5 sæt i ugen. Tonnagen i "din uge" og coachens tal bliver
  forkerte, og Fremgang ser ikke sættene.
- **Rekorder fra kælderen kommer aldrig i `personal_records`.** Den gamle PR-registrering kører kun, når serveren
  svarer i samme tryk. Køens afsendelse gør den ikke. Samtidig giver den med net **dubletter**, når to sæt logges,
  før den første registrering er færdig: bænkpres 72,5 × 6 står 3 gange, og dødløft 140 × 3, pause squat 85 × 4 og
  squat 95 × 6 står 2 gange hver. Det er den tabel, coachens PR-tidslinje og "Dine rekorder" under "Mere" læser.
