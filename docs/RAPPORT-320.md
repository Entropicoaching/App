**main kan pushes: ja**

# Rapport — ordre 320: "ret" et klaret sæt uden at miste overblikket (to blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Bhishaks fund 1+3 (docs/KRITIK-314.md): "ret" på et klaret sæt var en 22×20 px knap der genbrugte `onUndoLastSet` — den slettede log-rækken og genåbnede sættet, hvilket fik `nextSetInSession` til at anse sættet for uloggede igen. Det gjorde senere sæt "usynlige" (ingen klaret-linje, fordi de nu lå EFTER det aktuelle sæt), og gen-godkendelse sprang stille forbi dem.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): ja — det retter en konkret dataflade-forvirring Marc selv rammer på telefonen (nr. 1 og 3 i Bhishaks fund), ikke kun en kosmetisk touch-target-fejl.

## Gren

Gren `ret-saet`, forgrenet fra `main` (`f726f91`).

- `6a47847` blok 1: "ret" redigerer in place (ny skrivevej genbrugt, 44 px trykflade, "Vis næste sæt"-label 44 px)
- denne commit: blok 2 (enhedstest, headless prøve på to viewports, `proever.mjs` som nr. 14, denne rapport)

Arbejdstræet er rent efter denne commit. Ingen push, ingen migration, ingen ny tabel, ingen atletdata. Coach-siden, Fremgang og Indbakken er ikke rørt.

## Hvad ændret

**Blok 1**
- `src/editLoggedSet.js` (ny): `applySetEdit(exerciseLogs, exerciseId, setNumber, payload)` — ren funktion, erstatter ALDRIG log-rækken (intet filter+genindsæt), kun dens felter opdateres. Samme mønster som `nextSet.js`/`setLogDefaults.js`.
- `src/AthleteView.jsx`:
  - `updateLoggedSet(exerciseId, setNumber, updates)` (ny funktion): genbruger den skrivevej der allerede findes — `persistSetLog` med den eksisterende rækkes id (UPDATE, ikke INSERT, ingen migration). Samme offline-mønster som `logSet`'s `localFallback` (`saveOfflineSet`/`clearOfflineSet`/`pendingSyncCount`), så "ret" også virker uden forbindelse.
  - `DagensPasCard`: "ret" på et klaret sæt åbner nu en redigerings-boks IN PLACE (samme sted i listen) i stedet for at slette rækken — felterne (vægt, og reps hvis ordinationen er redigerbar) forudfyldes med det loggede, med samme plus/minus-steppere som det aktuelle sæts felter. "Godkendt" kalder `onUpdateLoggedSet`; "Fortryd" lukker uden at kalde noget. Kun ét sæt kan redigeres ad gangen (andre "ret"-knapper er deaktiverede imens).
  - Fordi `pas.next` (det aktuelle sæt) aldrig røres af en redigering af et TIDLIGERE sæt, vender kortet automatisk tilbage til det sæt der var aktuelt før redigeringen — ingen særskilt "husk hvor vi var"-logik nødvendig.
  - "ret"-knappen: 44×44 px (var 22×20 px). "Vis næste sæt"-labelen: `minHeight: 44px`.
- `src/editLoggedSet.test.js` (ny, 3 tests): `applySetEdit` ændrer kun den ramte række (samme antal rækker før/efter, urørte rækker er samme reference), rammer intet ved ukendt sæt, og — regressionstesten for KRITIK-314 fund 3 — `nextSetInSession` peger stadig på sæt 4, uændret, efter en `applySetEdit` på sæt 2.

**Blok 2**
- `e2e/ret-saet.spec.mjs` (ny) + `npm run e2e:ret-saet`: logger sæt 1-3 på Squat (4 sæt), retter sæt 2 (vægt +2,5 kg), tjekker at sæt 3 stadig står som klaret linje, at "Sæt 4/4" er uændret, og at mockens `exercise_logs` stadig har præcis tre rækker (ingen dublet/tabt række) med den opdaterede vægt. Dernæst en offline-scenarie (samme mønster som `e2e/fejl.spec.mjs`): retter sæt 1 med `context().setOffline(true)`, ser "☁ 1 sæt gemt lokalt", går online igen og bekræfter at rækken sendes uden dublet. Kørt på **390×844** og **360×780**, skærmbilleder i `outputs/320/`.
- `scripts/proever.mjs`: ny prøve nr. 14.
- `package.json`: `e2e:ret-saet`.
- `src/AthleteView.jsx`: to `aria-label`'er tilføjet på redigerings-boksens Godkendt/Fortryd-knapper (`Godkendt, ret sæt ${n}` / `Fortryd, ret sæt ${n}`), så prøven entydigt kan skelne dem fra det aktuelle sæts egne Godkendt/Fortryd-knapper. Ingen adfærdsændring.

## Testresultat

- `npm run lint`: ren.
- Enhedstests: `node --test src/editLoggedSet.test.js`: 3/3 grønne (heraf regressionstesten for KRITIK-314 fund 3).
- **Headless prøve** (`e2e/ret-saet.spec.mjs`, mod mock-Supabase og lokal vite, 390×844 og 360×780): sæt 1-3 logget, "ret" på sæt 2 (+2,5 kg) opdaterede den viste og den gemte vægt, sæt 3 forblev synligt som klaret linje, "Sæt 4/4" var uændret hele vejen, `exercise_logs` havde præcis tre rækker (ingen dublet). Offline-delen: "ret" på sæt 1 uden net viste "☁ 1 sæt gemt lokalt" (efter queueWrites fire forsøg, ~4s), gik online igen og blev sendt uden dublet. Ingen vandret overflow på nogen af skridtene.
- **Én ubrudt `npm run proever`, port 8991 tjekket først (fri): 86/86 grønne** (0 fejl, 0 sprunget over) — 35 enhedstestfiler (heraf 1 ny), 37 `verify:*` og 14 e2e (heraf 1 ny).
- `outputs/314/` og `outputs/ugen-faar-dato/` blev igen overskrevet af den fulde prøve-kørsel og rullet tilbage med `git checkout`, så de sporede skærmbilleder ikke er med i denne commit (samme kendte adfærd som i rapport 314/301/293).

## Hvad er næste

- Dhruva merger, Marc pusher (push = deploy).
- Efter push: prøv "ret" på telefonen midt i en rigtig øvelse — det er den ene ting der ikke kan bevises headless (ægte finger, ægte netværksudsving).
- Ingen opfølgende fund fra denne ordre; Bhishaks fund 1 og 3 (KRITIK-314) er lukket. Fund 2 (13×13 px-checkboxen) var allerede rettet i blok 1 sammen med fund 1.

## Ærlige grænser

- **Redigering af et sprunget-over ("Sprunget over") sæt sætter det til logget.** "ret" på et sæt der blev sprunget over, forudfylder tomme felter og gemmer det som et rigtigt logget sæt (`skipped: false`), hvis atleten trykker "Godkendt" — der er ingen særskilt "ret sprunget-over"-vej. Det er ikke testet i denne ordre (testscenariet bruger kun logget-sæt), og ordren nævnte ikke sprunget-over-sæt.
- **RPE ændres ikke af "ret".** Redigeringsboksen har kun vægt og reps (som ordrens eksempel: "vaegt op 2,5 kg"); den gemte RPE (`rpe_actual`) føres uændret videre. En atlet der vil rette RPE på et allerede logget sæt, kan ikke det via "ret" i denne ordre.
- **Kun ét sæt kan redigeres ad gangen** (de øvrige "ret"-knapper er deaktiverede, ikke skjulte, mens en redigering står åben) — en bevidst forenkling, ikke noget ordren krævede eksplicit.
- Alt er kørt headless mod mock-Supabase og lokal vite, ikke på en rigtig telefon og ikke mod produktion.

main kan pushes: ja
