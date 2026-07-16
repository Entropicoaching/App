# Plan: kost-agent (punkt 3) og push-notifikationer (punkt 4)

Skrevet 2026-07-16 af Claude som del af forbedringer-1. De to punkter er bevidst
IKKE halv-implementeret — de kræver et par beslutninger fra Marc først.

## Kost-agent (create_meal_plan er klar og venter)

Anbefalet flow, i tråd med "levende men mindre in your face":

1. Coach-portalen, kost-sektionen: knap "Generér dagsplaner" der åbner et panel
   med kcal/protein-mål (forudfyldt fra athletes.kcal_target/protein_target
   eller beregnet: protein ≈ 2 g/kg, kcal ≈ 33 kcal/kg ud fra seneste kropsvægt).
2. En edge function (samme mønster som draft-next-week: coach-JWT, service role)
   bygger 2-3 dagsplaner fra en kurateret dansk fødevareliste (LOCAL_FOODS
   findes allerede i AthleteView) skaleret til målene, og viser PREVIEW til Marc.
3. Marc justerer/godkender -> funktionen kalder create_meal_plan RPC'en ->
   atleten ser dagene under Skabeloner og kan logge en hel dag med ét tryk.

Beslutning der kræves: skal dagsplanerne genereres regelbaseret (hurtigt,
forudsigeligt, men generisk) eller vil Marc selv skrive/redigere dem med appen
som "hurtig-indtaster"? Anbefaling: regelbaseret udkast + Marc-review, samme
princip som ugeplan-udkastene.

## Web push-notifikationer

Mål: "ny besked fra coach", "din session i dag kl. X" og "husk readiness".

1. VAPID-nøglepar genereres én gang; public key i frontend, private key som
   Supabase secret (kræver dashboard/CLI — kan ikke sættes via MCP).
2. Tabel push_subscriptions (athlete_id/user_id, endpoint, keys, created_at)
   med RLS så brugere kun kan indsætte/slette egne rækker.
3. sw.js udvides med 'push'- og 'notificationclick'-handlers (den håndterer
   i dag kun share-target; ingen app-caching — det holder vi fast i).
4. AthleteView: lille "Slå påmindelser til"-kort på forsiden (Notification.
   requestPermission + pushManager.subscribe -> gem i tabellen).
5. Edge function send-push (web-push npm-pakke) + triggers:
   - messages INSERT med sender_role='coach' -> push til atleten (pg_net/webhook)
   - cron (Supabase Scheduled Functions) kl. 07: session i dag? readiness logget?
6. iOS-krav: appen skal være "Føj til hjemmeskærm" (PWA) — det er den allerede.

Beslutning der kræves: hvilke af de tre notifikationstyper skal med i v1?
Anbefaling: start med beskeder (størst effekt, mindst støj).
