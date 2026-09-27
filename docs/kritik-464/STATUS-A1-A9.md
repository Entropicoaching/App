# Status: mine A1-A9 fra 446 på main efter Vaidyas 456

Main `e5089f7` (456 merget), målt 27. sep 2026. Jeg har kørt mine egne scenarier fra 446: kælderugen to gange,
grænsen, coachen på 390 og 1280 px og tiden. Derudover har jeg målt det, Vaidya ændrede ud over ordren. Alt er kørt
headless mod e2e-mocken med den syntetiske Testatlet på en ældre telefon (Slow 4G, 4× CPU, 390 px). Tallene står i
`outputs/kritik-464/`.

Min uændrede 446-verify er **rød på præcis fundene** mod de nye målinger (15 linjer "genskabes ikke / opdater KRITIK").
Vaidyas 456-verify er **grøn** mod de samme målinger (`koersel-verify-446-og-456.txt`).

| Fund | 446 | Nu (main `e5089f7`) | Status |
|---|---|---|---|
| A1 tomt vægtfelt efter genåbning uden net → 0 kg-sæt | tomt, 5 sæt med 0 kg | Rows sæt 2 står på "25" ("senest 25kg × 10"), 0 sæt med 0 kg (to uger) | lukket |
| A2 "Spring over" uden net | fejlbesked, sættet måtte godkendes | kortet går videre uden fejlbesked; coachen ser "1 SPRUNGET OVER" i pas 2 (390 og 1280) | lukket |
| A3 vurdering uden net går tabt | pas 1 og 2: – | [4, 3, –, 4] når frem, også hen over en genåbning | lukket |
| A4 falsk rekord ved lang historik | fejret (top uden for 4000 / loft 1000) | 3 af 3 uden fejring; "bedst før" 128; 4290 rækker på 6 sider, også med loft 1000 | lukket |
| A5 `personal_records` | kælderens rekorder manglede, dubletter | 7 fejret = 7 rækker, ingen dubletter; PR-tidslinjen har 70 × 8 og 80 × 6 | lukket |
| A6 dobbelttryk på "Kopiér seneste uge" | 2 uger | 1 uge ved 60, 120 og 250 ms (knappen er "Kopierer ugen …" og spærret) | lukket |
| A7 coachens forside mens den henter | "0 af 4 pas · Ingen logs" i ca. 5 s | aldrig "Ingen logs"/"0 af 4 pas"; "4 pas" undervejs (se N1) | lukket |
| A8 UTC-dato i Log og PR-tidslinjen | "2026-09-26" | "27. SEP 2026" i Log, "27 sep 2026" i PR-tidslinjen | lukket |
| A9 tung historik gør Dagens pas langsommere | 3,3 → 5,3 s | 3334 ms før 439 → **3307 ms** nu (median af 3); historikken er færdig efter 3,8 s og er 5 kB | lukket |

Det, der holdt i 446, holder stadig i begge kælderuger. Intet sæt er tabt, og der er ingen dubletter (38/38). Sættene
har tiden fra "Godkendt". Hver rekord fejres én gang og står én gang i Fremgang. RPE og noten når frem. Der er ingen
konsolfejl og intet vandret rul. Køen tømmes 8,3 s efter, at nettet er tilbage, også når appen lukkes midt i
afsendelsen.

## Det, Vaidya ændrede ud over ordren

**Rekord-indeks version 2** (`ekstra-464`): telefonen har et 450-indeks (version 1), der er bygget af en afskåret
historik (squat 114, toppen 128 mangler). Atleten logger 100 × 5 (e1RM 117) straks, når Dagens pas kan bruges.

| Loft ("Max rows") | Ved tryk | Bygget efter | Sider / rækker | Fejret under opbygning | 115 × 5 bagefter | Genåbnet |
|---|---|---|---|---|---|---|
| ingen (130 uger) | v2, ikke bygget | 5,3 s | 6 / 4291 | intet | "Ny rekord: Squat e1RM 134 kg, +6 kg" | 2 sider, 36 rækker |
| 1000 (130 uger) | v2, ikke bygget | 6,2 s | 6 / 4291 | intet | fejret | 2 sider, 36 rækker |
| 100 (90 uger) | v2, ikke bygget | 9,8 s | 31 / 2971 | intet | fejret | 2 sider, 36 rækker |

- Version 1 kasseres ved første åbning, og der fejres intet, mens indekset bygges.
- Bagefter er "bedst før" 128, og et rigtigt rekordsæt fejres.
- En genåbning henter kun det nye. Sæt 1 står én gang i databasen.
- Dagens pas bliver ikke langsommere af siderne: brugbart efter login var 4,3 s (intet loft) og 3,3 s (loft 100, 90 uger).
  Siderne hentes efter kortet.

**Side for side med loft 100 og 130 uger: fund N2.** Med "Max rows" 100 og over 100 uger i programmet klipper loftet
også `weeks`-kaldet (131 uger → 100). Det kald hentes ikke side for side. Atleten ser så "Søndag · Ugens pas er
klaret … Uge 100 er klaret" i stedet for ugens pas (`koersel-loft100-130uger.txt`). Med 60 uger er alt normalt.
- Det er ikke 456's fejl, for alle andre kald end historikken var klippet før 456 også.
- Men Vaidyas tekst til Marc passer ikke. Han skrev, at en lav "Max rows" kun koster flere kald, og at Marc skal sige
  til under 100.
- Rigtigt er: Max rows skal være mindst lige så høj som den længste liste, appen henter i ét kald: uger, logs til
  Volumen (op til 4000) og coachens lister. Supabase' standard er 1000, og den skal Marc se står der.

**Dagens pas på en droslet telefon** (`tid-464`, genåbning, median af 3):

| Historik | Før 439 (`412f2c1`) | Nu |
|---|---|---|
| let (114 sæt) | 962 ms | 995 ms |
| tung (4940 sæt) | 3334 ms | 3307 ms |

## Små fund

- **N1 (lav):** på coachens telefon (390) står atleten kort som "Intet aktivt program", før ugerne er hentet. Så kommer
  "Uge 131 · Styrke · 4 pas" og til sidst "4 af 4 pas · I dag" efter 8,9 s. Det er samme slags som A7, og Vaidya
  har selv skrevet det under ærlige grænser. Det er ikke rettet.
- **N2 (middel, kun hvis prod's Max rows er lav):** se ovenfor.
