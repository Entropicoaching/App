# Rapport — ordre 226: seks sekunder til et værktøj: den døde Realtime-vægt ud, og målt rigtigt

## Gren

Gren `realtime-ud`, forgrenet fra `main` (`3eea22d`, ordrens egen base —
201 og Bhishaks 221 var allerede merget, live stod på `162abc6`).

- `ed02f68` — commit 1: 201's tre skærme igen, med devtools-throttling
- `e56cbd2` — commit 2: Realtime ud af hovedbundtet, bygget af undermodulerne
- `4354b51` — commit 3: måling efter — slår igennem, og den næste sten
- (denne rapport er commit 4, se hash i `git log` efter commit)

Arbejdstræet er rent efter hver commit. Ingen push. `public/videocoach.html`
og `e2e/coach-sporing*` er ikke rørt.

## Hvad ændret

201 fandt to konkrete rester: ~18 KB gzip død Realtime-vægt i
hovedbundtet, og mistanke om at Lighthouses SIMULEREDE throttling skjulte
en bekræftet forbedring i TTI-tallene. Denne ordre lukkede begge.

Commit 1 byggede `scripts/maal-kaeden.mjs` (`npm run maal:kaeden`) — 201's
tre skærme (Atletliste for coach, Dagens pas + Check-in for atlet, telefon
390px), men med `throttlingMethod: 'devtools'` (reel CDP-nedsættelse under
selve løbet) i stedet for Lighthouses standard-simulering, 5 løb, median.
Ingen kodeændring i appen. Baseline: Atletliste 6437ms, Dagens pas 6570ms,
Check-in 6546ms.

Commit 2 skrev `src/supabase.js` om: klienten bygges nu direkte af de fire
submoduler den faktisk bruger (`@supabase/auth-js`, `postgrest-js`,
`storage-js`, `functions-js`) i stedet for gennem `@supabase/supabase-js`,
som ALDRIG bruges for sin egen skyld — kun for dens sammensætning af netop
disse fire, PLUS en Realtime-klient (`realtime-js`/`phoenix.js`) appen
aldrig kalder. `@supabase/supabase-js`'s egen `SupabaseClient.ts` er læst
linje for linje og efterlignet præcist: samme `storageKey`-format
(`sb-<projekt-ref>-auth-token`, så eksisterende sessioner IKKE mister
login), samme apikey/Authorization-header-logik pr. kald, og selve
auth-klassen (`GoTrueClient`, importeret som `AuthClient` i supabase-js)
er den SAMME klasse — ingen ny auth-logik at stole på. Alle fire
submoduler har hver deres officielle "Standalone import for
bundle-sensitive environments"-eksempel i egen kildekode — dette er et
dokumenteret, sanktioneret mønster, ikke en hjemmelavet genvej.
`createAbortableUploadClient` (ordre 61, video-upload med reel
annullering) er forenklet til at genbruge den delte klients
bearer-opslag i stedet for at oprette en hel ny `GoTrueClient`-instans —
samme signal-baserede afbrydelse. `package.json`: `@supabase/supabase-js`
erstattet af de fire submoduler den selv afhang af (ingen ny afhængighed —
samme pakketræ; `@supabase/realtime-js` og `@supabase/phoenix` er nu VÆK
fra `node_modules`, ikke bare utrukket fra bundlet). Bundtstørrelse: 424,88
kB → 359,07 kB rå, 120,99 kB → 101,61 kB gzip (−19,38 kB gzip, ~16%), 96
moduler mod 113 før.

Commit 3 målte igen med samme script og fandt at gevinsten SLÅR IGENNEM
med devtools-throttling (Atletliste −262ms, Dagens pas −344ms, Check-in
−300ms — konsistent, over støjniveau) — modsat 201's fund med simulate.
Målet (under 2s) er stadig langt væk (~6,2s på alle tre skærme), så resten
af tiden gik til et vandfald (ikke committet som kode, kun tallet, jf.
ordrens grænse): den største resterende post er 682 KB scripts
(hovedbundt + Dashboard-chunk + videoCoachUpload-chunk), først
færdigdownloadet 5174ms inde i et 6163ms TTI-løb — FCP/LCP indtræffer lige
efter. Undervejs blev en ærlig grænse i selve MÅLEMETODEN fundet (ikke
denne ordres skyld, gælder hele serien siden 123): den lokale
måleservers `startStaticServer()` sender ukomprimerede bytes, ingen
gzip/br — se `docs/VALG-226.md` for detaljerne og hvorfor det betyder
alle TTI-tal i serien nok er mere pessimistiske end det produktion
reelt viser.

## Testresultat

`npm run lint`: rent ved alle tre kodecommits.

Enhedstest (`node --test "src/**/*.test.js"`): alle 231 grønne.

Alle 34 `verify:*`-scripts: grønne (én, `verify:videocoach-upload`,
assertede på `supabase.js`s gamle kildetekst-form for abort-signalet —
opdateret til den nye samme-garanti-form, ikke svækket).

`npm run e2e`: grøn (26,1s, port 8991 var fri).

`npm run build`: grøn ved alle tre kodecommits, bundtstørrelse rapporteret
under "Hvad ændret".

`npm run maal:kaeden`: kørt tre gange (commit 1's baseline, commit 3's
efter-måling) — tallene står under "Hvad ændret" og i `docs/VALG-226.md`.

## Hvad er næste

1. Efterprøv gzip/brotli-antagelsen fra commit 3's vandfald FØR endnu et
   måle-baseret greb forsøges — hvis den holder, er hele måleseriens
   TTI-tal (175→...→226) for pessimistiske, og afstanden til 2s-målet er
   nok væsentligt mindre end 6,2s.
2. Hvis afstanden stadig er stor derefter: script-overførslen (682 KB) er
   næste konkrete post — "tunge moduler ud af hovedbundtet og ind i
   chunks" (201's tredje, uafprøvede kandidat) passer direkte på den.

Tre linjer til Marc: Nej, du mærker det højst sandsynligt ikke direkte på
din telefon endnu — TTI er stadig ~6,2s, samme "hjemmeside der loader"-
følelse som før. Men målingen selv blev mere ærlig (devtools i stedet for
simulate viser nu reelle gevinster), og 18 KB gzip-vægt appen aldrig brugte
er væk for godt. Næste sten hedder "efterprøv om produktion rent faktisk
serverer gzip" — det kan vise sig at hele afstanden til 2s er mindre end
den vi tror.

## Ærlige grænser

- Devtools-throttlingens absolutte TTI-tal (~6,2s) er sandsynligvis for
  pessimistiske: den lokale målemetodes statiske server sender
  ukomprimerede JS-bytes (682 KB rå mod ~145 KB gzip), et mønster der har
  været sandt i HELE måleserien siden ordre 123, ikke noget denne ordre
  indførte. Før/efter-sammenligningen inden i denne ordre (commit 1 mod
  commit 3) er stadig gyldig — samme skævhed på begge sider — men den
  ABSOLUTTE afstand til 2s-målet er ikke pålidelig ud fra disse tal alene.
  Ikke verificeret direkte mod `app.entropicoaching.dk`s rigtige
  response-headers her (ville ligge uden for denne ordres afgrænsning).
- `scripts/maal-kaeden.mjs` genbruger 43 attrap-atlet-navne fra
  `scripts/maal-coach-telefon.mjs` (ordre 175) kopieret, ikke importeret
  — samme bevidste duplikering-fremfor-delt-import-konvention resten af
  måleserien allerede følger, for aldrig at kunne bryde et andet
  målescript ved et uheld.
- Commit 2's omskrivning af `src/supabase.js` er efterprøvet grundigt
  (linje-for-linje læsning af `@supabase/supabase-js`s egen kildekode,
  alle 34 `verify:*` + 231 enhedstest + `npm run e2e` grønne), men dækker
  IKKE produktions-Supabase (kun mock/lokal, jf. ordrens grænse) — en
  reel session/RLS-adfærd i produktion er ikke bekræftet af denne ordre,
  kun logisk udledt af at samme `GoTrueClient`/`PostgrestClient`/
  `StorageClient`/`FunctionsClient`-klasser bruges, bare konstrueret
  direkte i stedet for gennem `@supabase/supabase-js`s wrapper.
- Har betydning for Hara (mærkbart bedre-sporet): denne ordre lukkede IKKE
  hullet til 2s, men fjernede en bekræftet, unødvendig bundtvægt OG
  rettede måleseriens egen throttling-metode, samt fandt en potentielt
  stor systematisk skævhed i alle tidligere TTI-tal (ukomprimeret
  test-server) — værd for Hara at vide FØR flere greb af denne klasse
  vurderes ud fra de gamle tal alene.
