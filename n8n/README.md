# Entropi n8n workflows

## Coach Briefing v1

`coach-briefing-v1.json` is an inactive, importable n8n workflow. The app is the
primary coach inbox. Every hour from 12:00 through 21:00 Europe/Copenhagen the
workflow asks Supabase for open inbox metadata and sends at most one compact
fallback email per calendar day only when an important item remains unresolved.
The file has been import-tested against n8n Community Edition 2.31.6.
The fallback now mirrors the app's work order: active alerts first, then the
oldest unresolved message or video. It names one next task before showing the
rest of the queue, so email and app cannot give the coach competing priorities.

It includes:

- a fail-closed contract check for the RPC schema version, timestamp, coach
  identity, required arrays and item-level metadata before any prioritization or
  email logic runs;
- unread athlete-message counts that are at least 6 hours old, grouped by athlete
  and conversation track;
- a briefing total aligned with the app badge: each grouped conversation track
  counts as one coach task, while each conversation row still shows its actual
  number of unread messages;
- pending VideoCoach drafts at least 24 hours old (metadata only, never video files);
- active `alert` training signals that are neither acknowledged nor snoozed;
- one deduplicated, ordered task list with the same priority contract as the app;
- duplicate suppression based on the last successfully delivered briefing.
- an explicit test-delivery gate: manual/editor runs can render the fallback
  email for inspection but can never reach the SMTP node.
- a clearly synthetic `Eksempelatlet` item when a manual/editor preview has no
  real fallback-worthy items; production remains empty and sends nothing.

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

0. For a release that changes the coach deep link, deploy and verify the app
   first. Existing briefing links still open the ordinary inbox during this step.
1. Import the error monitor and bind the existing coach SMTP credential.
2. Publish the error monitor.
3. Import and publish the coach briefing with its `errorWorkflow` setting.
4. Restart n8n and verify both published versions plus the briefing link.

For an update where the error monitor is unchanged, keep its reviewed published
version and update only the coach briefing after the app deployment is verified.

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
7. Run **Manual test** once and inspect the output through **Frame fallback
   email**. The workflow stops at **Block test delivery**, before SMTP.
8. Confirm the email names one **Næste opgave**, shows the ordered queue, contains
   counts and metadata only, and that its button opens the live Entropi app.
9. Activate the workflow only after the manual checks pass.
10. Verify daily suppression using two real scheduled executions on the same
    Copenhagen calendar day. n8n does not persist workflow static data during
    ordinary manual tests, so this particular check cannot be proven by clicking
    **Manual test** twice.

The secret-free Windows runtime blueprint lives in `n8n/local-runtime/`. It pins
the tested n8n version and tracks startup, crash-recovery and removal scripts.
Never copy it over an existing runtime folder: preserve the installed `data/`
folder and its encrypted credentials. The local deployment verifier compares the
installed operational files with this reviewed blueprint and fails on drift.
The backup task runs daily at 19:30, catches up when the computer becomes
available and retains 14 consistent local database/config snapshots outside the
repository. The config is required to decrypt credentials, so the backup folder
must never be uploaded or shared. Restore remains a deliberate manual operation.

## Failure and privacy behavior

- No fallback-worthy items: `Keep unresolved backup items` returns no items, so
  the mail server is not called.
- Malformed or mismatched RPC response: `Validate briefing contract` throws a
  metadata-only error without response values, so the shared error monitor can
  report the failed node instead of the workflow silently treating bad data as an
  empty inbox.
- Already delivered today: `Skip if sent today` returns no items.
- Manual/editor execution: daily suppression is bypassed for preview, then
  `Block test delivery` returns no items before SMTP. No email is sent.
- Empty manual/editor preview: `Keep unresolved backup items` inserts one
  synthetic `Eksempelatlet` message so the email layout can be inspected. The
  synthetic item exists only inside that test execution.
- Mail delivery failure: delivery state is not updated, so the briefing can retry later.
- Supabase failure: the workflow fails before email and appears in n8n's
  execution log.
- Successful delivery: only the digest hash and delivery timestamp are stored in
  workflow static data.

## Coach inbox deep link

The email button uses `https://app.entropicoaching.dk/?coach=inbox&focus=next`.
The `focus=next` intent carries no athlete identifier. After a complete inbox
refresh, the app opens the current top-priority task once and removes `focus`
from the URL. A partial refresh stays in the inbox instead of opening stale work.
An unauthenticated coach signs in first and then lands there because the query
parameters are preserved.

## Local safety verification

Run `npm run verify:n8n` after editing either workflow. The verifier
checks node and connection integrity, inactive source files, absence of committed
credential bindings, the linked error monitor, schedule, RPC contract behavior,
synthetic preview isolation, app-aligned priority order, duplicate handling,
same-day suppression and the test-only SMTP gate. The verifier also requires the
embedded n8n Code node to match `n8n/build-coach-briefing.code` exactly.

For a safe local visual check of the final fallback email, run
`npm run preview:n8n-briefing` and open `http://127.0.0.1:4179`. The preview uses
synthetic athletes, does not call Supabase and cannot send email. Its `/meta`
endpoint exposes only the generated subject, count, digest and priority version.

On the configured Entropi Windows machine, run
`powershell -ExecutionPolicy Bypass -File n8n/verify-local-deployment.ps1` to
health-check local n8n, export both live workflows to a temporary folder and
compare them with the repository files. The check reports only pass/fail status;
it never prints credential bindings or workflow payloads, and its exports are
deleted immediately afterwards. Run it from a PowerShell session that can read
Task Scheduler. It also verifies that `Entropi n8n` starts the expected local
launcher through the reviewed hidden PowerShell command and working directory,
has one enabled logon trigger for the current interactive user, runs without a
time or battery cutoff, prevents duplicate instances, catches up after a missed
start and keeps its secondary Task Scheduler restart policy. An isolated fake-n8n test
also proves that the launcher itself retries a failed child process after one
minute without stopping or modifying the live n8n process. The same verifier
checks the dedicated daily backup task plus the age, required files, size and
SHA-256 manifest of the latest completed snapshot without printing secrets. It
also restores the snapshot into a temporary n8n user folder and proves that both
reviewed workflows can be exported from it before deleting the temporary copy.

The live comparison is expected to fail while a reviewed source change is still
waiting for deployment. It must turn green after the approved import and publish
steps; otherwise the live workflow and repository source are not in sync.
