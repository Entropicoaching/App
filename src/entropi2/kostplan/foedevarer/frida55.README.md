# Afgrænset DTU Frida5.5-valg i coachens måltidsformular

40 generiske fødevarer, valgt på tværs af 22 officielle FoodGroupID'er. De præcise danske navne og FoodID'er står i `frida55.provenance.json`. `frida55.mjs` giver nye id'er `frida55:<FoodID>` og eksporterer `COACH_FOODS = [...FOODS, ...FRIDA_FOODS]`; de første 200 objekter er de eksisterende objekter i samme rækkefølge. Det generelle `index.mjs` er uændret. Atletvisningens separate importgren får ingen Frida-eksport herfra. Coachens Dashboard → coachEntry → PortalPlan → portalModel har nu kun en let, statisk loaderimport. `frida55Loader.mjs` har én dynamisk import af `frida55.mjs`, som derefter importerer dataasset. Frida-data er ikke i den statiske coach-, atlet- eller general-index-gren.

I den aktiverede coachfane vælger man **Åbn kostplan med Frida-fødevarer**, før editoren åbnes. Det indlæser det bundtede katalog asynkront, viser indlæsning/fejl/genforsøg og konstruerer først derefter den eksisterende editor og controller med alle 240 valg. Den almindelige **Kostplan**-åbning beholder det eksisterende katalog og den synkrone legacy-adfærd. Valget låses før første controller; en gammel startcallback kan ikke skifte katalog på en igangværende editor. Der er ingen automatisk opgradering af en allerede åben legacy-session.

Frida-valget er en synlig, almindelig `button type="button"` med sit fulde handlingsnavn. Den oprindelige Kostplan-disclosure starter stadig lukket uden formular, input eller select. Ingen ny effect-hook kræves i den lukkede portal. En DOM-ref pensionerer startcallbacks synkront ved afmontering; referenceindlæsningens layout-livscyklus monteres først efter det udtrykkelige Frida-valg. `frida55.boundary.test.mjs` efterprøver lukket/legacy-åbning og pensionerede callbacks med faktisk ReactDOM/StrictMode. De tre oprindelige regressionsfiler køres uændret separat.

Indlæsning foretager ingen gemning eller aktivering. Close/OFF/unmount og coach-/atlet-/datoskift pensionerer afventende resultater. En færdig editor beholder sin controller og indtastede, ugemte felter gennem luk/åbn og læseopdateringer. Ved fejl konstrueres ingen erstatningscontroller; en gemt Frida-kladde ændres ikke til en legacy-kladde. Genforsøg indlæser igen. Der er intet globalt/preloadet katalogcache og ingen fødevare-API; kun den almindelige ESM-modulcache anvendes.

De oprindelige VM-fixtures uden dynamic-import callback er uændrede og efterprøver den almindelige legacy-åbning. De kan ikke efterprøve Frida-tilgængelighed. De nye `frida55.normal.fixture.mjs`, `frida55.lazy.test.mjs` og `frida55.react.test.mjs` bruger faktiske normale produktimporter og faktisk ReactDOM/StrictMode med en lokal syntetisk DOM-vært. De ændrer hverken produktmoduler, de oprindelige fixtures eller DOM-prototyper for at gøre Frida tilgængelig.

`coach/portalModel.mjs` tager et valgfrit `catalog`-argument med uændret FOODS-default og giver kataloget til den eksisterende controller. Den eksisterende `MealDraftImport` bruger `snapshot.foods`. Formularen bevarer nøjagtige gram. Valg og anvendelse er lokale; den eksisterende særskilte gemning og aktivering bruges uændret. Ingen gamle kladder, opskrifter eller planer migreres. Gramgeneratoren og dens forslag beholder deres oprindelige 200 fødevarer: generatorens egen validering accepterer kun det katalog. Frida vælges i den navngivne manuelle måltidsformular.

Alle værdier gælder 100 g spiselig del af den præcist navngivne tilstand. Intet rå/kogt-udbytte, ingen mærkevarealiaser eller individuel næringsdækning udledes. Manglende normaliserede rækker bliver `null`; numerisk nul forbliver nul. Der bruges deklarationsparametre 359/317/318, og leucin 180 omregnes fra mg til g ved division med 1000. Andre parametre og enheder fremgår af provenance. Originale XML-tal bevares som tekst i revisionsasset; runtime bruger JavaScripts/Pythons binary64 uden decimalafrunding.

Den uændrede snapshotkontrakt tillader `source.citation` og `source.verification`. Citationen bevarer DOI, FoodID og alle originale `[ParameterID, Source, SourceFood]`-tupler, inklusive flere Source-id'er og literal `NULL`. Provenance-asset indeholder de originale ResVal, normaliserede rækkenumre, wide-celler, enheder og bibliografirækker. Runtime importerer ikke det større revisionsasset.

Kilde: Marija Langwagen, Jette Jacobsen, Tue Christensen and Anders Poulsen: Den Danske Fødevaredatabase, Frida version 5.5, November 2025, DTU Fødevareinstituttet. [DOI 10.11583/DTU.29500682.v8](https://doi.org/10.11583/DTU.29500682.v8), article 29500682, version 8. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Ændring: afgrænset udvalg, enhedskonvertering af leucin og omformning til appens eksisterende snapshotformat. Original-XLSX er uændret, SHA256 `6b1952a35df3c0d4d7b2699ae0a3e377add42b231108309329b40256ef600e5e`.

Originale uddrag fra workbook Readme/Source (fulde rækker i provenance):

> Data og tekster fra http://frida.fooddata.dk må ikke kopieres eller på anden måde gengives uden tydelig kildeangivelse.

> Oplysningerne på dette websted er alene beregnet til almen orientering.

Source 1001:

> Anslået værdi på basis af forskellige kilder eller ved skøn fra værdi på nært stående produkt

Source 1003:

> Værdi beregnet ved omregning af forskellige analysedata

Officiel reference betyder gennemsnitsdata; det betyder ikke, at hver værdi er individuelt målt, komplet eller præcis for en mærkevare.

Offline reproduktion fra de leverede fastlåste inputkopier:

```text
python scripts/check-frida55.py --inputs <worker-input-folder>
python scripts/check-frida55.test.py
node --experimental-vm-modules --test --test-concurrency=1 src/entropi2/kostplan/foedevarer/frida55.test.mjs src/entropi2/kostplan/coach/frida55.lazy.test.mjs src/entropi2/kostplan/coach/frida55.react.test.mjs
```

Kontrolscriptet verificerer hele worker-manifestet og alle original-XLSX-dele; parser original ZIP/XML med Python stdlib og kræver overensstemmelse mellem Data_Normalised, Data_Table, Food og Parameter. Root-afledte JSON-projektioner bruges ikke som nærings-orakel. `--write` er en særskilt regenerering af de to assets.

Source1-kontrolscriptets CLI indeholder det oprindelige input-manifests hash og filnavne. Det er bevaret uændret og kan ikke bruges direkte mod denne rundes omnummererede input. Workerens selvstændige `VERIFY-DATA.py` kontrollerer de nuværende fastlåste original-XLSX-input og alle 600 celler uden at importere kildeparseren. Dets enhedstests kan fortsat køres direkte.
