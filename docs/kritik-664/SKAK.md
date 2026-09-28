Skakken stadig klar til Marcs klasse: ja

Bhishak, ordre 664 blok 2, 28. sep. 2026. Skakken efter Chaturangas 657 (merget) og 663 (committet, ikke merget), set som en elev på 12 år (360 og 390 touch) og som Marc foran klassen (1280, mus).

**Kort sagt.** Slutkortet efter en temastorm er nu roligt. Der står én ros, én linje med temaets tal, søjlerne og "Ingen forkerte træk. Flot!". Ingen rekord over alle temaer og ingen "(−0 s)". Fanerne er 44 px på en telefon, og ingen knap på den første skærm i Gåder og Spil er under 44 px. Det, der stadig er rodet, er småt:

- Startkortet viser stadig to rekorder.
- Søjlerne har intet navn.
- Datoen og " - " står der stadig.
- I Spil på 360 står brættet lidt under kanten.

## Hvad jeg målte

- **Før** = skak `main` @ `85a4236` (657 merget). **Efter** = `ordre-663` @ `66bbcaf` (tre blokke committet, ikke merget). Chaturangas `outputs/RAPPORT-657.md` (main) og `outputs/RAPPORT-663.md` (ordre-663) er læst.
- Begge er hentet med `git archive`. Skak-træet er ikke rørt.
- `outputs/kritik-664/skak-664.mjs` kører i headless Chromium på 360 × 740, 360 × 640 og 390 × 844 med touch og på 1280 × 800 med mus. Uret er Playwrights, mandag 28. sep. 2026 kl. 10. Alt net er blokeret (0 kald), og der var 0 JS-fejl. Tallene står i `skak-664.json`, billederne i `S664-*.png`.
- Lageret er syntetisk og det samme som i 656: fem stormer, Gafler-rekord 4, rekord over alle 20.
- På hver skærm er spillet to Gafler-stormer med tryk på brættet:
  - **D:** 5 løst, 0 fejl, ny Gafler-rekord.
  - **E:** et forkert træk først, så 3 løst, Gafler-rekord 12, altså ingen ny rekord. Det er det, 663 bad mig prøve.

## Slutkortet

| Slutkort | Bredde | Før (657) | Efter (663) |
|---|---|---|---|
| D: 5 løst, 0 fejl, ny rekord | 390 | 62 ord, 13 tal, 4 linjer med "rekord"/"bedst", "(−0 s)", 373 px | 40 ord, 7 tal, 2 linjer, intet "(−0 s)", 296 px |
| E: 1 fejl, 3 løst, ingen rekord | 390 | 81 ord, 15 tal, 3 linjer med "rekord"/"bedst", 477 px | 64 ord, 11 tal, 1 linje, 421 px |
| D og E | 360, 360 × 640, 1280 | samme mønster | samme mønster, ingen vandret rulning |

**D efter 663** (`S664-efter-390-3-slutkort-0-fejl.png`):

> Tiden er gået! Du løste 5 gåder.
> [Ny storm] [Tilbage til gåderne]
> Ny Gafler-rekord!
> Gafler, bedst: i dag 5 · uge 5 · rekord 5.
> Flest rigtige i træk: 5 (+3 s bonustid)
> Sværeste løste gåde: rating 555
> Ingen forkerte træk. Flot!

En 12-årig ser, at hun slog sin rekord, og at hun ikke lavede fejl. Hun ved, hvad hun skal: "Ny storm" er den brune knap øverst. Det er roligt og tydeligt. S13 og S14 er lukket.

**E efter 663** (`S664-efter-360-4-slutkort-1-fejl.png`) har ni linjer:

- "Tiden er gået! Du løste 3 gåder."
- "Gafler, bedst: i dag 12 · uge 12 · rekord 12."
- "1 forkert træk (−10 s)", "Flest rigtige i træk: 3", "Sværeste løste gåde: rating 545"
- "Her gik det galt - træn det i biblioteket"
- "Gaffel: 1 af 4 gik galt", "Træn: Gaffel med springeren"
- "Se løsningen på gåderne, der gik galt", "Gåde 1: Gaffel"

Det er ærligt og roligt nok: ingen rekord, som hun ikke slog, og søjlen viser, at hun lå under sidst. På 360 står "Ny storm" og "Tilbage til gåderne" under hinanden, så kortet bliver langt (473 px). Kortet siger "Gafler" øverst og "Gaffel" tre gange længere nede (S18). En 11-årig forstår det, men det er to ord for det samme på ét kort.

## Fanerne og brættet

| Måling | Skærm | Før (657) | Efter (663) |
|---|---|---|---|
| Fanernes højde | 360, 390 | 42 px | 44 px |
| Mellem de to rækker | 360, 390 | 3,2 px | 2 px |
| Tryk midt i mellemrummet rammer | 360, 390 | ingen fane | ingen fane |
| Knapper under 44 px på første skærm, Gåder og Spil | 360, 390 | de seks faner | ingen |
| Brættets bund, Gåder | 360 × 640 | 9 px over kanten | 6 px over kanten |
| Brættets bund, Gåder | 390 × 844 | 183 px over | 180 px over |
| Brættets bund, Spil | 360 × 740 | 21 px under kanten | 24 px under kanten |
| Brættets bund, Spil | 360 × 640 | 121 px under | 124 px under |
| Brættets bund, Spil | 390 × 844 | 105 px over | 102 px over |

- **Fanerne** er nu 44 px, og en 12-årig rammer dem. Et tryk præcis i de 2 px mellem rækkerne rammer ingen fane i headless Chromium (før 3,2 px, samme resultat). En rigtig telefon retter sædvanligvis sådan et tryk til den nærmeste fane, men det er ikke målt (S20).
- **I Spil på 360 × 740** står "Hvem vil du spille mod?" over brættet (`S664-efter-360-1-spil.png`), og brættets nederste række er skåret af (S19). Det er rimeligt, at valget kommer først. Men på en lille telefon ser eleven ikke hele brættet, før hun har valgt. 663 gjorde det 3 px værre, og Chaturanga har det selv på listen (nr. 4).

## Marc foran klassen

- **1280, Gåder** (`S664-efter-1280-2-startkort.png`): brættet til venstre og stormens kort til højre. "Dagens storm (28/9)" er den brune knap, og under den står i én sætning, hvad den gør. Marc kan sige "tryk på Dagens storm" og pege.
- **Startkortet med Gafler valgt** viser stadig "Din rekord på denne enhed: 20 gåder (9 i træk)." med fed skrift. Fire linjer længere nede står "Gafler, bedst: i dag 4 · uge 4 · rekord 4." (S17).
  - 663 skriver, at rekorden over alle temaer "står stadig på startkortet under Blandet". Målt står den der også, når Gafler er valgt.
  - To rekorder på samme kort, uden at det siges hvorfor, er det samme, som S13 var på slutkortet.
- **1280, et slutkort på projektoren:** roligt. Marc kan vise en elevs slutkort frem uden at skulle forklare fire slags rekorder.
- 1280 har knapper på 40 px (temaerne, "Mod computeren", tidsvalget) og søjlerne på 22 × 44. Med mus er det i orden.

**Ville Marc skamme sig over at vise det frem?** Nej. Skakken er det roligste af de to spil. Slutkortet er nu kort og venligt.

## Det, der stadig er rodet

1. **S17 (middel, ny):** startkortet med et tema valgt viser både "Din rekord på denne enhed: 20" (fed) og temaets "rekord 4". Det er det samme problem, som S13 var på slutkortet, nu på startkortet.
2. **S15 og S16 (lave, fra 656):** søjlerne har intet navn. "Dagens storm (28/9)" har en dato, som ingen elev har brug for. " - " står som tankestreg i "Forkert træk koster 10 sekunder - rigtige i træk giver ekstra tid" og "Her gik det galt - træn det i biblioteket".
3. **S18 og S19 (lave, nye):** "Gafler"/"Gaffel" på samme slutkort. I Spil på 360 × 740 står brættet 24 px under kanten.

## Fund

| Nr. | Alvor | Hvad | Hvor |
|---|---|---|---|
| S13 | lukket (663) | Slutkortet efter en temastorm viser kun temaets linje: 2 linjer med "rekord"/"bedst" (før 4) | slutkortet |
| S14 | lukket (663) | Ingen "0 forkerte træk (−0 s)" ved nul fejl; kun "Ingen forkerte træk. Flot!" | slutkortet |
| S15 | lav | Søjlerne har intet navn ("Dine sidste stormer") | start- og slutkort |
| S16 | lav | "Dagens storm (28/9)" og " - " som tankestreg i to tekster | startkort, slutkort |
| S17 | middel (ny) | Startkortet med et tema valgt viser "Din rekord på denne enhed: 20" (fed) over temaets "rekord 4" | startkortet |
| S18 | lav (ny) | "Gafler" og "Gaffel" på samme slutkort; på 360 står de to knapper under hinanden, og kortet med fejl er 473 px | slutkortet med fejl |
| S19 | lav (kendt) | Spil på 360 × 740: brættet 24 px under kanten ved første visning (før 21); 360 × 640: 124 px | Spil |
| S20 | lav (ny) | Et tryk præcis i de 2 px mellem fanerækkerne rammer ingen fane (headless; en rigtig telefons tilretning er ikke målt) | fanerne |

## Ærlige grænser

- **Ingen rigtig 12-årig, klasse eller projektor har set det.** "Roligt", "tydeligt" og "skamme sig" er mit skøn ud fra skærmbilleder og målte tal.
- 663 er ikke merget. Hvis Marc merger den, er det, der er målt her, det, eleverne får.
- Lageret er syntetisk og hænger ikke helt sammen: "i dag 12" er lagt ind, uden at en storm i dag gav 12. En rigtig elev med 3 løste ser det samme kort, men med sine egne tal.
- Én fejl og én temastorm (Gafler). Mat, Spyd, Bindinger og Slutspil er ikke spillet. En blandet storm er ikke spillet her; 663 målte den selv.
- Touch er emuleret i headless Chromium på Windows. Det er ikke en rigtig telefon, Safari eller skole-pc. Et tryk i mellemrummet mellem fanerne er målt med `elementFromPoint`, ikke med en finger.
