# Subscription pilot: lokal smoke-/regressionskontrol

Kør:

```powershell
npm run verify:subscription-pilot-smoke
```

Kontrollen er bevidst lokal og deterministisk. Den bruger kun rene subscription-moduler og en in-memory `localStorage`-erstatning. Den åbner ikke browseren og bruger ikke netværk, Supabase, e-mail, credentials, login, betaling eller deploy.

Den bekræfter denne sammenhængende kunderejse:

1. Et styrkeløftvalg bevarer eksplicit low-bar og sumo, mens et uklart variantvalg fejler til manuel review.
2. Tre konkrete atletbelastninger er nødvendige, før et lokalt programudkast vises.
3. Uge 1 består af validerede sætrækker, med deterministiske tilstande for aktivt, gemt og kommende sæt.
4. Uge 2 er altid et synligt forslag, der kræver aktivt valg, og ændrer aldrig uge 1.
5. Et komplet lokalt snapshot kan genindlæses uden at gemme den rå e-mailadresse.
6. Feedback kan samles som et `localOnly`-artefakt.

En grøn kontrol er **ikke** en frigivelse. Den siger kun, at den lokale kontrakt stadig hænger sammen. Shadow-migrationer, rigtig login, invitationer, betaling, entitlement og publicering er eksplicit uden for denne kontrol.
