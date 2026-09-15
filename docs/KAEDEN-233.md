# Måling — ordre 233 commit 1's forudindlæsning

`npm run maal:kaeden`, 5 løb pr. skærm (median), devtools-throttling, telefon
390×844, samme metode som 226/228/231. FØR = `d7ba5d4` (main, ordrens base,
ingen forudindlæsning). EFTER = `6c9ead1` (denne gren, commit 1).

Login (rigtigt, mod mock) sker FØR målingen for hver rolle, så det cachede
rolle-gæt (ordre 201) allerede er skrevet til `localStorage` når de 5
Lighthouse-løb kører — ellers ville "intet gæt" gøre commit 1's greb en
no-op i selve målingen.

| Skærm | TTI FØR | TTI EFTER | Diff |
| --- | --- | --- | --- |
| Atletliste (coach) | 7198ms | 7014ms | -184ms |
| Dagens pas (atlet) | 5803ms | 5751ms | -52ms |
| Check-in (atlet) | 5793ms | 5835ms | +42ms |

Rå data: `outputs/_seneste/maal-kaeden/2026-09-15--233-commit1-foer.json` og
`.../2026-09-15--233-commit1-efter.json` (gitignored, samme sti-konvention
som tidligere `maal:kaeden`-kørsler).

## Mekanisk bekræftelse

Et engangsscript (ikke committet, samme metode som 201's egen
waterfall-diagnose) bekræftede at greebet virker som tilsigtet: med en
cachet 'coach'-rolle i `localStorage` indsætter index.html's inline-script
et `<link rel="modulepreload">` for `Dashboard-*.js`, og browseren starter
selve hentningen af den chunk ~5ms efter hovedbundtets egen request (reelt
parallelt). På `d7ba5d4` (før commit 1) er der intet sådant link, og
chunken hentes først når hovedbundtets modulgraf har kørt appens `lazy
import()` — markant senere.

## Ærligt

Samme fund som `docs/RAPPORT-201.md`: greebet er MEKANISK bekræftet (chunken
starter tidligere, parallelt med hovedbundtet i stedet for bagefter), men
slår ikke tydeligt igennem i den aggregerede TTI. Atletliste (-184ms) er den
største forskel og ligger lige på kanten af den støj tidligere ordrer
(231: 0-67ms) har set mellem identiske builds — for stor til at afvise som
ren støj, for lille (ét før/efter-par, ikke gentagne builds) til at kalde
en sikker gevinst. Dagens pas (-52ms) og Check-in (+42ms) er begge inden for
normal støj og modsiger hinandens retning. Ingen dom fældet her — jf.
ordrens egen grænse ("Ingen dom fra Marc; kun tal og 'alt virker som før'").
