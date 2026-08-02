# Subscription pilot v1 — local review foundation

## Finished element

`subscription-pilot-release-bundle.html` is the single local entrypoint for
the V1 pilot review. It gathers three distinct tester surfaces:

1. `customer-journey.html`: onboarding, explicit movement variants, starting
   loads, week-one set logging and an explicit week-two choice.
2. `pilot-program-review.html`: the local 2-day pilot program as a review
   artifact, never as a real assignment.
3. `pilot-feedback.html`: voluntary, validated `localOnly` JSON feedback.

The appropriate status is **ready for local tester review**. It does not mean
ready for shadow, production, open signup, payment, e-mail or sales.

## Deterministic completion check

From this worktree run:

```powershell
npm run verify:subscription-pilot-completion
```

The command first proves that all required pages, local React entrypoints and
guards exist. It then runs, sequentially:

- subscription unit tests;
- local pilot smoke control;
- product-separation guard;
- the isolated subscription Vite build.

The verifier has no network endpoint, credential, Supabase client, shadow call,
mail, payment or publishing action. A green result only establishes that the
local package is coherent and can be reviewed.

## Data boundaries

- The customer journey writes only a browser-local demo snapshot. The demo ID
  is derived from the test e-mail; the raw e-mail is not retained in it.
- Feedback is not sent anywhere. The tester can explicitly export a local JSON
  file for Marc to review.
- Do not use local feedback for pain, injury, illness or individual coaching.
- The subscription product has a separate session boundary and must not use
  1:1 portal tables, `profiles.role`, PWA assets, CNAME or existing sessions.

## Next non-local gate

Only after both product review and Marc's explicit approval may a separate
shadow-pilot task evaluate the documented shadow backend path. That task must
prove the correct project binding before any DRAFT migration is considered. It
is intentionally outside this V1 package.
