# Optional 30-day pilot — draft for Stephen's review

Status: DRAFT. Not offered, not sent, not agreed. No pricing or discount terms here (see
offer-principles.md). Cortese must approve every item in writing before anything starts.

## Scope (one workflow)
Missed-call recovery for 607-723-6477, the number Cortese's website gives for takeout orders:
a caller who reaches a busy line can press 1 to receive one text with the existing menu
link (https://www.corteserestaurant.com/menu), then calls Cortese to order.
Callers who don't press 1 hear a short voice message. The service does not yet detect landlines:
a landline caller who presses 1 would trigger a send attempt that cannot be delivered (see gate 5).

Out of scope: online ordering, payments, reservations, POS/kitchen integration, changes to
Cortese's website or phone number.

## Before day 1 (gates)
1. Private live test on Stephen's phone passes: call → press 1 → text received → link opens.
2. Cortese-owned texting account (Cortese email, billing and admin; Stephen as invited developer).
3. Cortese approves greeting and text wording, active hours, and a daily text cap of [__].
4. Carrier confirms busy-forwarding that keeps the caller's number, and how to undo it.
5. A controlled forwarded call from a mobile and from a landline behaves correctly.
6. Hosting on persistent storage with a health check; the off switch is tested.
7. Sender eligibility and messaging setup approved (number type, any required registration).
8. Consent and opt-out wording reviewed for production (keypress consent, STOP/START, help text).
9. Named owners for monitoring, incident response and recovery, with a tested restore.
10. Retention and deletion policy for call and delivery records agreed with Cortese.
11. Security review of the deployed service, secrets and access completed.
Go-live requires every gate above, with evidence recorded in IMPLEMENTATION.md.

## During the 30 days
- Week 1: go live in the agreed hours; check daily for errors and STOP replies.
- Weeks 2–4: weekly one-page summary: forwarded calls, press-1 count, texts delivered,
  STOP count, issues. Counts are measured, never estimated or promised.
- Either side can pause at once: the text switch goes off, and the carrier forwarding is restored.

## Day 30
Review the numbers and staff feedback together. Options: stop (forwarding removed, records
deleted per the agreed retention), continue as is, or add a second workflow. Any paid
continuation is discussed and agreed separately before day 31.

## Responsibilities
- Stephen: setup, monitoring, weekly summary, fixes, rollback on request.
- Cortese: approvals, the carrier change, the account owner, one staff contact for questions.
