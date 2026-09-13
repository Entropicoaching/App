# Ordre 167, commit 1 — de fem skærme, målt

Metode: Lighthouse mobilprofil (390×844, Lighthouse's indbyggede simulerede
4x CPU-nedsættelse + langsomt netværk — samme metode som ordre 163's Del 1),
3 løb pr. skærm, medianen brugt. `node scripts/maal-atlet-telefon.mjs foer`.
Ingen rettelser i denne commit.

## Tabel

| Skærm | Tid til synligt (FCP) | Tid til trykbar (TTI) | Layoutskift (CLS) | Netværkskald før brugbar | Dom |
|---|---|---|---|---|---|
| Login | 3078 ms | 5554 ms | 0 | 12 | **Føles som en hjemmeside der loader** |
| Dagens pas | 691 ms | 901 ms | 0 | 2 | Føles som en app |
| Sæt-logger | 761 ms | 901 ms | 0 | 4 | Føles som en app |
| Check-in | 693 ms | 797 ms | 0 | 2 | Føles som en app |
| Videocoach-forside | 4845 ms | 4845 ms | 0,0006 | 5 | **Føles som en hjemmeside der loader** |

Skærmbilleder: `outputs/167-foer/*.png`. Rå tal (alle 3 løb pr. skærm):
`outputs/167-foer/MAALING.json`.

## Vigtig ærlig grænse — hvorfor kun to af de fem tal er til at stole på

"Dagens pas", "Sæt-logger" og "Check-in" er isolerede, statiske harnesses (samme
metode og begrundelse som `scripts/maal-app.mjs` allerede har etableret i dette
repo, ordre 123): AthleteView.jsx kræver en levende Supabase-session for
overhovedet at boote, og det er forbudt at bruge produktions-Supabase eller
atletdata her. Harnessene bruger den ÆGTE, uændrede `src/repsPrescription.js`
og ægte inline-stilarter, men er i sig selv trivielt lette (ingen React, intet
bundt, ingen session) — deres perfekte tal (perf 100, TTI < 1s) måler
harnessens EGEN vægt, IKKE den ægte autentificerede app. Den ægte
AthleteView-chunk vejer 251 KB (build-output, se ordre 163's rapport) og deler
SAMME opstartsskal (index.html, main.jsx, service worker) som Login — hvilket
betyder: den fejl jeg fandt på Login (næste afsnit) rammer efter al
sandsynlighed disse tre skærme LIGE SÅ HÅRDT i den ægte app, selvom harnessene
her ikke kan vise det (forsøgt, se kommentar i
`scripts/maal-atlet-telefon.mjs` — SW-registrering nåede ikke sin
install→activate-cyklus inden for disse letvægts-harnessers målevindue).

De to tal jeg KAN stole på fuldt ud — fordi de måler den ægte, uændrede app
uden nogen session — er **Login** og **Videocoach-forside**. Begge scorer
dårligt, og begge har en konkret, fundet årsag (se nedenfor).

## Fund 1 — Login genindlæser sig selv (dobbelt alt)

Netværkslog for Login viser HVER ressource hentet TO gange inden for ét
sideindlæsnings-forløb: `/`, `/assets/index-*.js` (415 KB!), CSS, manifest,
`icon.svg`, `version.json` — alt sammen dobbelt, med et nyt `version.json?ts=`
tidsstempel på anden omgang. Det er ikke støj: siden genindlæser sig selv midt
i indlæsningen.

Årsag, fundet i `src/appUpdate.js`:

```js
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (refreshing) return
  refreshing = true
  location.reload()
})
```

`self.clients.claim()` i `public/sw.js`'s `activate`-håndtering får
`controllerchange` til at fyre på ENHVER klient der lige har registreret
service workeren for FØRSTE gang — ikke kun når en ÆGTE opdatering afløser en
gammel worker. Uden en vagt mod dette genindlæser koden altså siden midt i
indlæsningen for enhver bruger uden en tidligere aktiv service worker: en helt
ny bruger, en ryddet cache, en privat fane, eller enhver telefon der (som her)
ikke havde workeren fra før. Det er ikke et sjældent tilfælde — det er
førstegangs-normen. Rettes i commit 2 (én linje, en vagt der kun genindlæser
ved en ÆGTE afløsning).

## Fund 2 — Videocoach-forsiden blokerer på en ekstern skrifttype

`public/videocoach.html`'s `<head>` har en render-blokerende, synkron
`<link rel="stylesheet" href="https://fonts.googleapis.com/...">` — browseren
skal DNS-opslå, TLS-forbinde og hente denne EKSTERNE ressource færdig før den
kan begynde at tegne noget som helst, oveni det 526 KB store, ét-fils
HTML-dokument selv. Ingen dobbelt-hentning her (siden genindlæser sig ikke) —
men skrifttypen ligger unødvendigt i den kritiske sti. Rettes i commit 2 med
den almindelige "preload + swap"-teknik (ingen ny afhængighed, rører intet af
sporingskoden — kun `<head>`).

## Hvad der IKKE fejler

Layoutskift (CLS) er praktisk talt nul på alle fem skærme allerede — "reservér
plads så intet hopper" er ikke et reelt problem her, så jeg bruger ikke tid på
at "fixe" noget der allerede virker.
