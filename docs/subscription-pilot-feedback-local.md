# Lokal pilotfeedback

Åbn `pilot-feedback.html` via subscription-devserveren. Fladen samler produktfeedback efter onboarding, program, sættelogning eller uge 2.

Den bruger hverken login, e-mail, netværkskald, Supabase eller brugerkonto. Poster findes kun i siden, indtil testpersonen vælger **Eksportér valideret JSON**. JSON-filen er bevidst enkel og mærket `localOnly: true`.

## Afgrænsning

Fladen er ikke til medicinske forhold, smerter, skader eller individuel træningsrådgivning. Det står også direkte i UI'et. Sådanne forhold håndteres uden for feedbackflowet med coach eller sundhedsfaglig person.

## Ved review

1. Testpersonen eksporterer filen lokalt.
2. Marc indsamler kun filer, han konkret har bedt om.
3. Produktændringer vurderes som hypotese mod den aktuelle benchmark; filen importeres ikke automatisk nogen steder.
