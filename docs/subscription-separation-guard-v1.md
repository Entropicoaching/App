# Subscription-separation guard v1

Status: lokal, håndhævelig arkitekturgrænse. Den ændrer hverken hosting,
Supabase, Auth eller brugerdata.

## Formål

Entropi har to produkter, som må udvikle sig side om side uden at få fælles
adgang ved en fejl:

| Område | Nuværende 1:1-atletportal | Abonnementsprodukt / shadow-pilot |
| --- | --- | --- |
| Formål | Coach + navngivne atleter | Selvbetjent program, logning og senere member-adgang |
| Klient | `src/supabase.js` | `src/subscription/supabaseClient.js` |
| Session | Portalens standard Supabase-storage | Kun `entropi-sub-auth` |
| Autorisation | Eksisterende portalmodel (ikke et abonnementssignal) | Kun `sub_my_access_v1()` og `sub_*`-RLS |
| Data | Eksisterende portal-tabeller og atlethistorik | Kun `sub_*`-tabeller i det isolerede shadow-projekt |
| Hosting | Eksisterende app/PWA | Separat senere subscription-host; aldrig samme Pages-CNAME eller service worker |

`profiles.role` må ikke bruges i abonnementet. Den eksisterende
rolle-eskalering i portalen er et selvstændigt sikkerhedsspor og bliver ikke
"arvet" ind i subscription.

## Data- og auth-grænser

1. Subscription-klienten må kun forbinde til den faste shadow-ref
   `maxhsefxbrvsgolscqwh`, og kun med en anon-/publishable-key. `pilotConfig.js`
   fejler lukket ved anden ref eller secret/service-role-key.
2. Subscription må ikke importere `src/supabase.js`, portalens komponenter eller
   `appUpdate`. En import må enten være en pakke eller resolve under
   `src/subscription/`.
3. Sessionen skal bruge den særskilte nøgle `entropi-sub-auth`. Lokale
   subscription-drafts skal være brugerpræfikserede og må ikke rydde den nøgle.
4. Entitlement, programversion og assignment er server/service-styret. Klienten
   må ikke kunne skrive dem, og `profiles` er ikke en fallback.
5. En frivillig overgang til 1:1 er en senere, særskilt samtykkehandling. Den
   kopierer hverken logs, notes eller identitet automatisk.

## Hosting-grænser

- Subscription-buildet bruger `vite.subscription.config.js` med `publicDir:
  false` og det lokale output `dist-subscription-pilot`.
- Det betyder, at portalens `public/CNAME`, `public/sw.js`, manifest og
  PWA-assets ikke kan kopieres ind i subscription-buildet.
- Et senere abonnementssite får eget hostname og egen release-procedure. Det
  må ikke deployes med portalens GitHub Pages-CNAME eller dele service worker
  scope.

## Lokal gate

Kør før en ny subscription-import, miljøændring eller build-ændring:

```powershell
npm run verify:subscription-separation
```

Gaten læser kun lokale kildefiler. Den bekræfter den isolerede importgrænse,
storage-nøgle, fravær af `profiles.role`, subscription-entry uden PWA-artefakter
og `publicDir: false`. Den er ikke en Supabase-, hosting- eller
produktgodkendelse.

## Manuel checkliste ved næste port

- [ ] Den første pilot kører kun mod shadow-projektet, aldrig portalens projekt.
- [ ] Ingen 1:1-data, coach-noter eller `profiles.role` er tilføjet "for nemheds skyld".
- [ ] Den konkrete programversion og progression er fagligt godkendt af Marc.
- [ ] Subscription får senere eget hostnavn, egen cookie/session-test og egen
      release-checkliste.
- [ ] Overgang til 1:1 har en tydelig samtykkeskærm og dokumenteret dataliste.

Hvis én linje er rød: stop i subscription-sporet, og ret afgrænsningen før nye
features bygges. Det er billigere end at forsøge at splitte blandede konti og
træningshistorik bagefter.
