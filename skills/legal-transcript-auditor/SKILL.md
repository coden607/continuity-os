---
name: legal-transcript-auditor
description: Converts hearing or trial transcripts/minutes into a source-grounded ruling, objection, concession, and appellate-preservation ledger. Use for court transcripts, hearing minutes, oral rulings, and post-hearing review.
metadata:
  type: workflow
  version: "1.0"
---

# Legal Transcript Auditor

Use the transcript/minutes as the controlling source for what occurred in court. Never reconstruct missing dialogue.

## Extract
For every material event record:
- page/line or page reference;
- speaker;
- exact short quotation when wording matters;
- issue;
- objection/request;
- grounds actually stated;
- opponent response;
- court ruling;
- relief granted/denied;
- whether the ruling was definitive;
- preservation status;
- follow-up required.

## Distinctions
Keep separate:
- counsel representation vs evidence;
- prosecutor concession vs court order;
- tentative comment vs ruling;
- request vs granted relief;
- transcript silence vs proof something did not occur.

## Preservation audit
Flag missing specificity, missing ruling, missing proffer/offer of proof, unraised constitutional ground, unrequested remedy, incomplete exhibit/reference, and reconsideration issues. Do not claim waiver/forfeiture without verifying governing law.

## Output
Produce:
1. verified hearing chronology;
2. ruling ledger;
3. preservation ledger;
4. unresolved issues;
5. next-hearing action list;
6. authorities requiring verification.

For New York criminal matters, pair with `legal-war-room` and its New York criminal live-court reference.
