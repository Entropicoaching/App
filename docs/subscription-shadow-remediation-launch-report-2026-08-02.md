# Subscription shadow remediation launch report

## Decision: READY FOR SHADOW PILOT

Exclusive remote target: `entropi-subscription-shadow`, project ref
`maxhsefxbrvsgolscqwh`. The forward-only `sub-12` migration committed. No
production/generic project, 1:1 object, `profiles` row, billing, deployment,
commit or push was touched.

The critical expiry defect is closed at the public RPC boundary. Free sees only
`start-2`; active member sees the exact assignment and can persist; a normal
14-day entitlement behaves as member; expiry becomes free while retaining
read-only history and rejecting new persistence. Guessed assignment IDs,
altered idempotency replays, cross-user access and `profiles.role = coach` all
failed closed. BQA-01 through BQA-07 and the explicit Free/Member/Trial cases
passed. QA writes were removed and retained evidence returned to 3 workouts / 3
sets. No password was changed.

Advisor security returned from 6 to the exact baseline 3 warnings: the three
new public `SECURITY DEFINER` RPC findings are gone. Performance remains 7 info
items by count, but the three new missing-FK-index findings are fixed. The four
attributable items are now honest unused-index notices for required covering
indexes on currently empty week-two tables; none was disabled, dismissed or
removed to improve the score.

Local readiness passed: exact shadow binding, 12-file backend contract,
50-file client contract, 93/93 tests and pilot build. A real password-login
probe was not run because the retained identities' passwords were explicitly
left unchanged; authenticated/RLS/RPC behaviour was exercised with isolated
shadow JWT-role simulation instead.

This is approval for a closed shadow pilot only—not production, billing, open
signup or sale. Monitor the week-two indexes once real pilot rows exist and
rerun Advisor before any broader launch.
