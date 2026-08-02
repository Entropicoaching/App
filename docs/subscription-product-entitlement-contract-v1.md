# Subscription entitlement contract v1

Status: implemented and verified in `entropi-subscription-shadow`
(`maxhsefxbrvsgolscqwh`) only. Entitlement state is the authority; `profiles.role`
is never an input.

- **Free:** may read the single fixed `start-2@1` programme and their own
  persisted workout/programme history. Free cannot receive or generate a member
  programme, create a progression decision, or persist a new workout/set log.
- **Member:** an active `member` entitlement grants the exact assigned,
  published full-gym track. The reviewed tracks are beginner/øvet,
  strength/powerlifting, 2/3 days and 4 days only for øvet. Member may persist
  workouts and make the existing conservative progression decision.
- **Trial:** exactly the member contract with `source = trial` and a normal
  `valid_until`, normally 14 days. There is no separate trial role.
- **Expiry:** effective tier becomes free automatically. Existing owner-bound
  history stays readable. New workout persistence, assignment, proposal and
  decision paths fail closed even with guessed IDs or backdated payloads.

This contract adds no payment, Stripe, billing, coaching feedback or video
analysis feature.
