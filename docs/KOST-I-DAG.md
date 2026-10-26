# Entropi Coach: kost i dag

Den nye første visning er slået fra som standard. Kontakten gælder kun den
aktuelle browser og ændrer ingen Supabase-indstillinger.

Slå til i browserens konsol, og genindlæs siden:

```js
localStorage.setItem('entropi:kost-i-dag', 'true')
location.reload()
```

Slå fra igen:

```js
localStorage.removeItem('entropi:kost-i-dag')
location.reload()
```

Første visning viser dagens mål, loggede mængder og én fødevaresøgning til
logning. Historik, redigering, skabeloner og makrofordeling åbnes med
**Historik og detaljer**. Tilbageknappen vender altid tilbage til dags dato.

Historikken viser rå kalorietal. TDEE kræver mindst syv forskellige logdatoer
med kendte kalorietal og den eksisterende beregnings øvrige datakrav. Fremtidige
datoer, ugyldige datoer og ukendte kalorietal tæller ikke med. Flere måltider
samme dag tæller som én dato. Der indføres ingen nye trendfortolkninger.

Decimaler bruger den eksisterende `parseInputNumber` til både komma og punktum.
Læsefejl og indlæsning vises særskilt fra en kendt tom dag. Et fejlet logforsøg
bevarer den valgte fødevare og mængde.

Kontrol:

```sh
npm test
npm run build
node e2e/kost-i-dag.test.js
```

Browserprøven bruger den eksisterende Playwright-runtime og lokal Chromium.
Den bruger opdigtede data og en lokal backend, uden `.env`-filer. Den sammenligner
også HTML med kontakten slået fra mod `origin/main` (kan vælges med
`KOST_BASE_REF`). Skærmbilleder gemmes i `work/kost-i-dag/`, eller i mappen fra
`KOST_SCREENSHOT_DIR`. Billeder spores ikke i git.

To eksisterende testproblemer er rettet for at gøre den samlede suite grøn:
PNG/MP4 med store filendelser ignoreres også på Linux, og migrationsprøven
opsamler underprocessens output i en midlertidig fil, fordi miljøets Node-runtime
mister asynkront konsoloutput gennem pipes. Databasekode er uændret.
