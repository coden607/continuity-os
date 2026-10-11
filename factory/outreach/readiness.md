# Internal presentation readiness and offer notes

## Public demo — 2026-10-03
Public URL: https://cortese-digital-xwbq.vercel.app (production for Vercel project cortese-digital-xwbq).
Deployed commit verified: f6a3028553924b94c71cfc4cd682f7c7c571419a (PR #4 merge). Smoke run
37146502086 from a clean GitHub runner, with no cookies or login: HTTP 200 with no login redirect, CSP header present,
served index.html/app.js/styles.css byte-identical to that commit, markers and tel destinations
checked, and the browser walkthrough 99/99 at 1280, 414, 375 and 320px including axe.
Follow-up review fixes (focus after submit, reset when storage writes fail, wcag21a rules, pinned
browser tooling) land in a later commit; rerun the smoke workflow after it deploys and record that SHA here.

## Shareable preview — 2026-10-03 (superseded by the public demo above)
Both PR #4 previews redirect anonymous visitors to vercel.com/login (checked independently by
ChatGPT). Deployment Protection stays unchanged.

Option: a Vercel **Shareable Link** for the one PR #4 deployment in project `cortese-digital`
(the latest Ready deployment in the Vercel bot comment on PR #4; branch alias
cortese-digital-git-claude-de-d3f962-stephens-projects-8fbc16d0.vercel.app). Create the link only
after the final push, because every push makes a new deployment. It adds a
`_vercel_share` token that lets link holders view that deployment without a Vercel account. Project
protection settings are not changed, and the link can be revoked.

Approval Stephen must give (in writing, in this session or the PR):
"Create a Shareable Link for the cortese-digital PR #4 preview deployment, for Colleen only,
expiring [date] (or revoked after the walkthrough). I understand anyone holding the link can view
that deployment until it expires or is revoked."
Steps (Stephen, in the Vercel dashboard): open the deployment → Share → copy the link, setting an
expiry if offered. Test it in a private window, paste it into the email, revoke it after the review.
The Vercel connector in this session can't see the cortese-digital project (404), so Stephen
creates the link. Alternatives not recommended: disabling protection (changes project settings),
or production after merge (its protection scope is unverified).

## Verification — 2026-10-03 (branch claude/demo-verify-20261003, local; merged as f6a3028)
Local browser walkthrough (`npm run e2e`, Playwright/Chromium, CSP from public/vercel.json enforced,
all external requests blocked so no call, menu page or text is triggered):
- 77/77 checks with the axe-core audit (71 without it) at 1280px, 375px and 320px: reset, disclosure, menu link
  (official URL, new tab, noopener), both call actions = tel:+16077236477, required fields,
  Escape closes the dialog, local-date minimum, party of 2 at 18:00, staff counts, reviewing →
  confirm, second request → decline, reload persistence, reset survives reload, notes escaped
  (an injected tag rendered as text), no horizontal overflow, no console/CSP errors, storage write failure and
  fully blocked storage both keep working in memory.
- axe-core WCAG 2.1 AA + best-practice: 0 violations after fixes on guest, staff and dialog views.
- Fixed: eyebrow text contrast 4.39:1 → 5.73:1 (#7a6418); long unbroken notes overflowed
  the staff inbox by 9px at 320px (now wrap).
- `npm test` 24/24 (17 phone service + 7 demo invariants), `npm run typecheck` clean, Node 24.21.0.

Not verifiable from the build environment (egress proxy blocks *.vercel.app and corteserestaurant.com):
public no-login access of the Vercel URL, and the live menu page contents. Stephen must open the
demo URL in a private window and confirm it loads without a Vercel/GitHub login before sending.

Call destinations: the demo only dials 607-723-6477. Third-party listings (Yelp/Tripadvisor search
summaries, not the official site) describe 607-723-6477 as pizza & take-out and 607-723-6440 as
reservations. The demo does not show a reservation number; confirm with Cortese before adding one.

## Source state
Repository: Restaurants607/cortese-digital (private at inspection).
Original demo source: 9e9c5c151a1539cd7dc9012e5b453b6dc99d0f35 on feat/release-zero-concierge-demo.
Verification evidence below was gathered on later revisions; each section names its commit.
PR #2 remains open. GitHub Verify run 36973003352 passed October 2, 2026.
Both Vercel commit statuses report success. These checks do not establish browser readiness or live SMS delivery.
Current source includes a memory fallback after storage failures and derives the date minimum in local time, addressing the two earlier review concerns. Regression verification remains separate.

## Existing preview URLs
- https://cortese-digital-git-feat-rele-b3946f-stephens-projects-8fbc16d0.vercel.app
- https://cortese-digital-xwbq-git-feat-320638-stephens-projects-8fbc16d0.vercel.app

These are observed URLs from Vercel's PR comment, not yet browser-verified for external sharing. Vercel connector access returned 403 for the project's scope. Do not mark the package ready to send until the chosen URL works for a recipient without Stephen's login.

## Five-minute walkthrough
1. Reset synthetic records.
2. Show the guest screen and demo disclosure.
3. Inspect menu link and call destination without initiating a real restaurant call.
4. Submit a fictional party of two for a valid future local date at 18:00.
5. Verify staff inbox and counts.
6. Mark reviewing, confirm a fictional request, then test decline on a separate fictional request.
7. Reload to verify storage, then reset.
8. Repeat in a narrow phone viewport. Inspect console errors, required-field behavior, keyboard dialog close, and storage-unavailable behavior.
9. Do not include the earlier cart prototype until that version has its own verification and a clearly separate demo link.
10. Keep real phone/SMS tests on the authorized test recipient only.

## Offer decision
User requested no initial dollar pricing and suggested a free 30-day run plus 15% off.
Recommended proposal for later agreement: a 30-day pilot of ONE agreed workflow, followed by 15% off the first paid month of that workflow if Cortese chooses to continue. This discount period is a recommendation, not a settled term or a sent promise.
Agree scope, usage cap, provider costs, support, start date, stop procedure and paid continuation in writing before activating a pilot. Budget the free pilot so provider fees cannot grow without a cap.
Do not promise a free production rollout of every feature.
The first email invites a demo and discusses an optional scoped pilot. It leaves the discount and paid amounts for the follow-up conversation.

## Remaining blockers
- Browser verification of customer-share URL.
- Recipient/contact details.
- Separate verification of earlier ordering prototype if included.
- Controlled handset SMS and carrier forwarding evidence before offering a live phone pilot.
- Review/merge decision for PR #2.
