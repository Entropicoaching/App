# KRITIK: appen før Marcs push, anden gang (efter Vaidyas 456)

Main `e5089f7` (456 merget, ikke pushet). Prod står på `dc39052` (origin/main), og pushet sender 89 commits på én
gang. A1-A9 fra min 446 er målt igen med mine egne scenarier: alle ni er lukket (`STATUS-A1-A9.md`).

Her har jeg kørt Vaidyas kældertest (RAPPORT-456, punkt 1-8) headless, som Marc vil gøre den:
- Telefonen har først prod-versionen med dens service worker. "Push" er, at serveren skifter til main på samme
  adresse.
- Serveren sender `no-cache`, så kun service workeren kan hjælpe uden net.
- Syntetisk Testatlet med 130 ugers historik, ældre telefon (Slow 4G, 4× CPU, 390 px), e2e-mocken.
- Varianten "straks": Marc går i kælderen 3 s efter, at Dagens pas kan bruges. Varianten "vent": han venter, til
  rekorderne er bygget.

Tallene står i `outputs/kritik-464/kaelder-464.json` og `koersel-kaelder.txt`, billederne i `K-*.png`.

## Fund

**K1. Går Marc i kælderen lige efter første åbning, er kælderens rekorder væk fra PR-tidslinjen** (middel, i
kældertesten; lav for atleterne)
- I varianten "straks" fejler punkt 7: "PR-tidslinjen har kaelderens rekorder een gang hver" (0 i dag).
  - Squat 100 × 5 og bænkpres 70 × 8 blev ikke fejret og står ikke i `personal_records`.
  - I "vent" blev de fejret, står der én gang hver, og alle 17 tjek er grønne.
- Årsag: første åbning efter pushet bygger rekord-indekset af hele historikken. På den ældre telefon med 130 uger tager
  det ca. 5-6 s efter Dagens pas, og intet fejres, før det er bygget. Det er meningen (A4), og det bygges ikke uden net.
  `personal_records` skrives kun fra fejrede rekorder (A5), så de rekorder kommer aldrig i PR-tidslinjen.
- Det rammer én gang pr. atlet: det første pas efter pushet, hvis nettet forsvinder inden for de første sekunder.
  Atleten ser intet forkert; coachen mangler en rekord i PR-tidslinjen.
- Vaidyas punkt 2 siger kun "vent på Dagens pas". Så vil Marc se punkt 7 fejle og tro, at pushet er i stykker.
  Punkt 2 skal sige: bliv på net et minut efter, at Dagens pas er vist.

**N2. Supabase' "Max rows" under ca. 150 klipper andet end historikken** (middel, kun hvis prod står lavt)
- Med "Max rows" 100 og over 100 uger i programmet klipper loftet også ugerne (131 → 100), og ugerne hentes ikke side
  for side. Atleten ser "Ugens pas er klaret … Uge 100 er klaret" i stedet for ugens pas.
- Det var sådan før 456 også. Men Vaidyas tekst til Marc ("en lav værdi koster kun flere kald; sig til under 100")
  er for mild.
- Max rows skal være Supabase' standard 1000 (eller højere). Står den lavere, er det ikke klar til push.
- Prod's værdi er ikke læst (ingen kald mod prod).

**K2. Vaidyas punkt 1, 4 og 8 passer ikke helt** (lav, teksten)
- Punkt 1: `klar-til-push` er allerede merget i main (`e5089f7`). Marc skal kun pushe main. Det, der går ud, er
  alt siden `dc39052`, ikke kun 397-456.
- Punkt 3/4: "log et helt pas" og "luk appen midt i passet" kan ikke begge ske. Rækkefølgen, jeg har kørt, står i
  RAPPORT-464.
- Punkt 8: en revert af de tre commits (`4902c48`, `3849d8d`, `0f4aa10`) går ikke rent: `package.json` er i konflikt,
  fordi Dhruva løste den i mergen.
  - `git revert -m 1 e5089f7` går rent (`kaelder-464-revert.txt`, kun tjekket med `git apply --check`).
  - Det ruller kun 456 tilbage, ikke 397-455.

**N1. "Intet aktivt program" kort på coachens telefon** (lav): se STATUS-A1-A9. Samme slags som A7, og Vaidya har selv
skrevet det. Det er ikke rettet.

## Det, der holder (begge varianter)

- **Pushet når telefonen:** efter skiftet kører telefonen main-bundtet (to indlæsninger, den nye service worker tager
  over). Bundtet ligger i service workerens cache, før nettet forsvinder.
- **Kælderen:** "Spring over" uden net går videre til bænkpres sæt 3. Vurderingen 4 kan gives uden net.
- **Lukket og åbnet uden net:** Dagens pas står der efter 2,4-2,6 s uden login-skærm, og vægtfeltet er udfyldt (30).
- **Net igen:** "☁ 10 sæt gemt lokalt" forsvinder efter ca. 5 s, og køen er tom. Hvert sæt står én gang i databasen,
  springet som sprunget over, og vurderingen 4 er nået frem.
- **Coachen på telefonen, Log:** "Dag 1 — Squat · 9/10 SÆT · 1 SPRUNGET OVER · ★★★★☆", datoen "27. SEP 2026".
- **Kopien:** et dobbelttryk (150 ms) på "Kopiér seneste uge" giver én uge (132). Den kan slettes i appen med
  Slet → Bekræft, og kun den.
- **Konsollen:** ingen fejl.
- A1-A9 fra 446 er lukket (STATUS-A1-A9). Det, der holdt i 446, holder stadig: 38/38 sæt, ingen dubletter, rigtig
  tid, én fejring pr. rekord.

klar til push: ja, fordi A1-A9 er lukket og kældertesten holder på alle punkter, når Marc bliver på net et minut efter første åbning; K1 er en fejl i testens instruks (og et engangstab af en PR-række pr. atlet), ikke i appen, og N2 afhænger kun af, at prod's "Max rows" står på Supabase' standard 1000, hvilket Marc skal se efter før pushet.
