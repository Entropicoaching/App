# Hvad jeg fravalgte (Ordre 211) — til Dhruvas næste ordre

## Klip-realisme (glat vending i bunden) — afprøvet, rullet tilbage, ikke billig

`docs/SVAR-211.md` finder at sporingen mister stangen præcis ved bunden af
rep 1 (t≈3,2s), hvor `scripts/make-test-clip.mjs`s gamle `worldY(t)` havde et
ØJEBLIKKELIGT fortegnsskifte i hastigheden (en ren trekantsbølge — konstant
fart ned, konstant fart op, ingen deceleration). Trackerens
bevægelsesforudsigelse (`pred=cur+vel*dt`) antager konstant hastighed mellem
frames; en uendelig-hurtig vending er ikke-fysisk og burde i teorien narre
netop den antagelse. Ordren selv pegede på præcis denne rettelse ("pause i
top og bund, varierende hastighed").

**Hvad jeg gjorde:** tilføjede en 0,3s pause i bunden af hver rep (parallelt
med den eksisterende HOLD_DUR-pause i toppen) og glattede begge vendinger med
`smoothstep` i stedet for lineære ramper (hastighed → 0 i begge ender af
hver ramp, ingen uendelig acceleration).

**Hvad jeg fandt ved test:** afgørende VÆRRE, ikke bedre.
`node e2e/coach-sporing-reliability.mjs` mod det glattede klip nåede aldrig
færdig — hverken inden for den normale 120s-grænse (3/3 kørsler) eller en
midlertidigt udvidet 300s-grænse (1/1 kørsel, stadig fastlåst ved
"Analyserer stangbanen · 98%" efter 308,4s). Mest sandsynlige forklaring
(ikke bekræftet yderligere): uden det tidlige sporingstab har trackeren
ALDRIG et fastfrosset, "stille" punkt at falde ind i sin egen
frame-springings-optimering (`VC_TRACKER_FAST`s `QUIET_NEEDED`-genvej, som et
dødt, ubevægeligt punkt opfylder perfekt) — den ægte, aktive sporing gennem
fem hele reps er simpelthen dyrere at beregne end den gamle, fejlbehæftede
kørsel der reelt kun sporede aktivt i 3,3 af 20 sekunder.

**Rullet helt tilbage:** `scripts/make-test-clip.mjs` og
`e2e/coach-sporing.spec.mjs`s test-timeout er begge tilbage til deres
oprindelige tilstand (`git diff` mod `main` viser ingen ændring i
`make-test-clip.mjs`). Ingen produktionskode rørt — kun et forsøg i selve
testklippet, forkastet igen samme ordre.

**Hvad det ville koste at forfølge videre:** finde ud af om sporingen rent
faktisk lykkes med et glat klip (bare langsommere), eller om den ALDRIG
lykkes — kræver en længere, tålmodig kørsel (15-20 min pr. forsøg) uden tids-
pres, formentlig i en session uden samtidig systembelastning fra andre
agenter (denne ordre delte maskinen med fire andre aktive Claude-sessioner,
hvilket sandsynligvis forværrede den i forvejen dyrere, aktive sporing).
**Egen ordre, med god tid og en rolig maskine, hvis det stadig er relevant
efter `docs/RAPPORT-211.md`s "Hvad er næste".**
