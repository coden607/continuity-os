---
name: ny-criminal-evidence-gate
description: Performs New York criminal evidentiary issue-spotting and courtroom objection analysis, including Sandoval, Molineux/Ventimiglia, hearsay, foundation, impeachment, confrontation, and preservation.
metadata:
  type: workflow
  version: "1.0"
---

# New York Criminal Evidence Gate

Use for pretrial evidentiary rulings and live courtroom events.

## First classify the proposed use
Do not analyze prior misconduct generically. Determine whether the evidence is offered:
- to impeach an accused who testifies (Sandoval);
- on the People's case for a non-propensity purpose (Molineux/Ventimiglia);
- for another impeachment purpose;
- as direct/background/completeness evidence;
- for a non-hearsay purpose or hearsay exception.

## Evidence gate
Test relevance, unfair prejudice, personal knowledge, foundation, authentication, hearsay, confrontation, lay/expert opinion, character/propensity, completeness, cumulative proof and limiting instructions.

## Live output
Return:
1. OBJECT OR NOT?
2. exact objection;
3. legal basis;
4. prosecutor's strongest response;
5. defense rebuttal;
6. requested remedy;
7. preservation step;
8. best controlling authority.

## Sandoval ledger
For each conviction/bad act record age, nature, similarity, credibility bearing, proposed inquiry, defense prejudice, ruling, excluded details, and preservation.

## Molineux/Ventimiglia ledger
Record asserted non-propensity purpose, material issue, relevance, necessity, prejudice, notice/procedure, limiting instruction, ruling and preservation.

Never treat a Sandoval ruling as authorization for propensity evidence. Verify current Court of Appeals and controlling Appellate Division authority before finalizing a high-stakes recommendation.

Pair with `legal-war-room` for full adversarial and appellate review.
