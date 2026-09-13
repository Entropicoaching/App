# RAPPORT — ORDRE 155: e2e del 2 — video, beskeder og det der går galt

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`e2e-del-2` fra `e2e-atlet-til-coach` (ordre 153, ikke merget endnu):

1. `1d77194` — video op og gå: rigtig storage i mocken (`e2e/mock-supabase.mjs`'s objektlager+RPC+fejlinjektion, UUID-fixtures, `e2e/video-upload.spec.mjs`)
2. `457610f` — coachen gennemgår videoen (`e2e/video-review.spec.mjs`)
3. `d03619d` — det der går galt (`e2e/fejl.spec.mjs`)
4. (dette commit) — beskeder (`e2e/beskeder.spec.mjs`) + `docs/E2E.md` opdateret + denne rapport

Træet er rent ved aflevering.

## Hvad ændret

Byggede videre på ordre 153's mock i stedet for at starte forfra. Fire ting:

**Rigtig storage** (var en kvittering-stub): `e2e/mock-supabase.mjs` har nu et
ægte in-memory objektlager — multipart-upload (parset fra bunden, samme form
`@supabase/storage-js` rent faktisk sender), signeret URL (`/object/sign/...`),
og hentning med Range-støtte. Læst i storage-js's kilde før det blev skrevet.

**Fejlinjektion**: `POST /__e2e/fault` lader en test bede mocken svare `500`
eller afbryde forbindelsen på næste kald mod en given sti — bruges af
`fejl.spec.mjs` uden at appens kode rører ved det.

**Fire nye specs**, alle klikket igennem den ÆGTE app (`public/videocoach.html`
inklusive, samme iframe-bro som produktion):
- `video-upload.spec.mjs`: atleten filmer/vælger en video → "Send til coach"
  → tilbage i dagens pas uden at vente. Testklippet ordren peger på
  (`test-clips/vis-mig-nu-4-reps-realistisk.mp4`) findes ikke i dette repo
  (git-ignoreret persondata) — brugt ordrens eget alternativ, et 2s
  syntetisk klip (ffmpeg-static, allerede en devDependency).
- `video-review.spec.mjs`: coachen åbner den afventende video i broen
  (beviser signeret-URL-stien), og skriver/godkender/deler tekst-feedback på
  en seedet, "allerede sporet" video (se ærlig grænse).
- `fejl.spec.mjs`: et sæt logget uden net (aldrig en dobbelt-række via
  `page.setOffline`), en afvist videoupload hvor "prøv igen" virker (aldrig
  to rækker via `/__e2e/fault`).
- `beskeder.spec.mjs`: atlet sender → coach ser ulæst-tælleren 1 → svarer →
  atleten ser svaret.

Fixture-id'er er konverteret til ægte UUID'er (v4-formede, faste) —
`src/videoCoachUpload.js`'s `buildVideoUploadPath()` afviser ellers uploaden
før den når mocken. Squat har nu 4 sæt (var 3) — det fjerde er bevidst
efterladt ulogget til fejl-scenariet (en frisk INSERT, ikke en UPDATE, er
nødvendig for reelt at bevise "aldrig dobbelt-rækker").

Hvert nyt spec-skridt bruger sin egen friske login/browserside i stedet for
at dele én lang session — se `run-all.mjs`'s `step()`-hjælper: enklere og
mere robust end at holde styr på hvilken fane/tilstand ni skridt efterlader
hinanden i.

## Testresultat

- `npm run lint`: grøn.
- Alle 32 `verify:*`: grønne (ingen ændring i `src/` denne ordre).
- `npm run e2e:atlet` / `e2e:coach` (ordre 153, uændret adfærd): grønne, ~7,7s / ~4,7s.
- `npm run e2e` (alle ni skridt: glat rejse, video op, coach gennemgår,
  atlet ser feedback, offline-sæt, afvist upload, beskeder frem og tilbage):
  grøn, ~28,8s.

## Hvad er næste

Coachens EGEN stangbane-sporing (den manuelle klik-igennem-analyse i
VideoCoach) er stadig ikke e2e-provet — det kræver en video med en faktisk
sporbar skive, samme problem `scripts/make-test-clip.mjs` løser for
tracker-testen isoleret. En fremtidig ordre kunne genbruge/tilpasse den
generator til et rigtigt sporings-klik-igennem her. Ellers: udvid
`e2e/fixtures.mjs`/mockens `EMBEDS`/`rpcHandlers` i takt med at flere flows
(kost, stævne, PR-tidslinje) skal ende-til-ende-proves, jf. opskriften i
`docs/E2E.md`.

## Ærlige grænser

Samme grænser som ordre 153 (mocken er ikke en fuld PostgREST-klon; RLS,
ægte Postgres-constraints og mail-bekræftelse simuleres ikke), plus: (1)
video-reviewets tekst-feedback-kæde er proved mod en video SEEDET som
"allerede sporet" — selve sporings-algoritmen (bar-path/plade-genkendelse)
køres ikke; broen/signeret-URL/afspilning ER proved ægte, mod den video
atleten faktisk uploadede i commit 1. (2) "Timeout" er i mocken en
øjeblikkelig forbindelsesafbrydelse, ikke et ægte 12s-hæng op til appens
`fetchWithTimeout`-grænse — samme brugeroplevede udfald, bevidst valgt for
ikke at gøre suiten langsom. (3) Ni friske logins i `npm run e2e` frem for
delt sessionstilstand koster nogle sekunder ekstra runtime, men er langt
mere robust — vurderet en god handel på ~29s total.

## Betydning for Hara

Lukker resten af det hul kritikerpakken (ordre 147) pegede på: nu er også de
tunge veje (video, det der går galt, beskeder) — ikke kun den glatte rejse
fra ordre 153 — bevist ende-til-ende med en rigtig browser mod en rigtig
backend-formet kontrakt. Relevant for delmålet "Appen mærkbart bedre".
