# Entropi n8n workflows

## Coach Briefing v1

`coach-briefing-v1.json` is an inactive, importable n8n workflow. The app is the
primary coach inbox. Every hour from 12:00 through 21:00 Europe/Copenhagen the
workflow asks Supabase for open inbox metadata and sends at most one compact
fallback email per calendar day only when an important item remains unresolved.
The file has been import-tested against n8n Community Edition 2.31.6.

It includes:

- unread athlete-message counts that are at least 6 hours old, grouped by athlete
  and conversation track;
- pending VideoCoach drafts at least 24 hours old (metadata only, never video files);
- active `alert` training signals that are neither acknowledged nor snoozed;
- duplicate suppression based on the last successfully delivered briefing.

Context-level signals and newly received messages/videos stay in the app and do
not trigger email. Missing or invalid timestamps fail safe into the fallback email
instead of silently hiding an unresolved item.

The subject, heading and footer explicitly describe the message as an automatic
safety net for an unresolved app item rather than a daily or morning briefing.

## Automation Error Monitor v1

`automation-error-monitor-v1.json` is a shared Error Trigger workflow for
production failures. `Coach Briefing v1` references it through
`settings.errorWorkflow`.

The alert contains only the workflow name, failed node, execution id, execution
mode, time and a loopback-only n8n execution link. Raw error messages, stack
traces, payloads, athlete data and credentials are deliberately excluded.
Repeated failures from the same workflow are limited to one email every six
hours. The cooldown is recorded only after SMTP succeeds.

Deployment order matters:

1. Import the error monitor and bind the existing coach SMTP credential.
2. Publish the error monitor.
3. Import and publish the coach briefing with its `errorWorkflow` setting.
4. Restart n8n and verify both published versions plus the briefing link.

Error workflows run for production failures only. Manual/test executions do not
trigger the monitor, which prevents an accidental test email during validation.

Message bodies, coach notes, video files and storage URLs are deliberately not
returned by the database function or passed through n8n.

## Required setup

1. The required `supabase/sql/coach-briefing-v1.sql` migration was applied to
   production on 2026-07-26 after Marc's explicit approval.
2. Import `coach-briefing-v1.json` into n8n. Keep the workflow inactive.
3. Create an n8n **Supabase** credential using the project URL and the service
   role secret. Never paste this secret into the workflow or repository.
4. Open **Fetch coach briefing** and select that Supabase credential.
5. Create/select an SMTP credential in **Send coach briefing** using the
   `coach@entropicoaching.dk` mailbox. Keep its password in n8n only.
6. The project URL, verified coach profile id, recipient email and live app URL
   are already filled in.
7. Run **Manual test** once and inspect every node's output before activating.
8. Confirm the email contains counts and metadata only, and that its button opens
   the live Entropi app.
9. Activate the workflow only after the manual checks pass.
10. Verify daily suppression using two real scheduled executions on the same
    Copenhagen calendar day. n8n does not persist workflow static data during
    ordinary manual tests, so this particular check cannot be proven by clicking
    **Manual test** twice.

## Failure and privacy behavior

- No fallback-worthy items: `Keep unresolved backup items` returns no items, so
  the mail server is not called.
- Already delivered today: `Skip if sent today` returns no items.
- Mail delivery failure: delivery state is not updated, so the briefing can retry later.
- Supabase failure: the workflow fails before email and appears in n8n's
  execution log.
- Successful delivery: only the digest hash and delivery timestamp are stored in
  workflow static data.

## Coach inbox deep link

The email button uses `https://app.entropicoaching.dk/?coach=inbox`. An
authenticated coach lands directly in the coach inbox; an unauthenticated coach
signs in first and then lands there because the query parameter is preserved.
