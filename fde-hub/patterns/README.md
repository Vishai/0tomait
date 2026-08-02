# Flow pattern library

Reusable flow shapes for forward-deployed work. A pattern ships the stable 80% — the
shape, the design commitments, the staffing roles, and the interview checklist for
discovering the client-specific 20% — and deliberately never ships finished code. Code is
cheap to generate and different at every client; the shape, the roles, and the questions
are what actually repeat.

## The rules this library runs on

**Extracted, not invented.** A pattern enters the library by being distilled from a real
deployment, or it enters marked `provisional` and says so out loud. `maturity` records the
provenance honestly, and the validator repeats it every time a provisional pattern is
touched. The confidence bar is three: until three instantiations exist, every default is a
hypothesis with evidence attached, not a recommendation.

**The glue checklist is the product.** The value of an FDE engagement was never the 80%
that templates cover — it is the 20% of client-specific glue. Each pattern's
`glue_checklist` is that 20% turned into an interview, with every answer routed to its
home in the deployment manifest. Filling in the workbook *is* drafting the manifest.

**Deviations are data.** Each pattern carries its own family tree — `instantiations`, with
how every deployment deviated from the base shape. Deviations flow back: three clients
deviating the same way means the pattern is wrong, not the clients. That is how a default
gets flipped (see `gated-batch-action`'s identity-map default, inverted by recorded debt
from the reference deployment).

**Roles are stable; people are tenures.** Every pattern declares its `human_roles` — the
staffing the flow needs to survive, with cadence and a walkthrough outline per role. The
client manifest binds those roles to actual people as lineage tenures, and the walkthrough
outline becomes a client-specific walkthrough asset. This is the transition mechanism: the
role persists across staff changes; only the tenure and the walkthrough delivery change.

## The patterns

| Pattern | Problem it addresses | Maturity |
| --- | --- | --- |
| [`document-intake-match`](./document-intake-match.pattern.json) | Paperwork arrives through a human channel and someone matches it to records by hand | extracted (1) |
| [`gated-batch-action`](./gated-batch-action.pattern.json) | A rhythmic manual run — invoicing, payments, filings — with a judgment gate | extracted (1) |
| [`human-review-queue`](./human-review-queue.pattern.json) | The residue every automation produces, and the staffing that keeps it from becoming the backlog | extracted (1) |
| [`two-system-reconciliation`](./two-system-reconciliation.pattern.json) | The same object in two systems, drifting | provisional |

## Using a pattern

```bash
# Check it is well-formed and honest about itself
node fde-hub/tools/validate.js fde-hub/patterns/document-intake-match.pattern.json

# Generate the engagement workbook
node fde-hub/tools/scaffold.js fde-hub/patterns/document-intake-match.pattern.json --out workbook.md

# Later: hold the client manifest to the pattern's staffing requirements
node fde-hub/tools/validate.js --patterns fde-hub/patterns path/to/client.manifest.json
```

With `--patterns`, the validator enforces role coverage: every role a flow's pattern
declares must be held by an open tenure in that flow's lineage. A pattern requiring a
backup-operator is no longer advice — an unstaffed role is a warning with the pattern's
reasoning attached.

The workbook walks the instantiation in order: fit check, glue interview, variation
decisions, staffing plan, failure design, manifest obligations, metrics baseline, and a
starter flow entry for the client manifest. The starter fragment fails validation until
every TODO is resolved — the validator is the checklist.

Then, per variation decision made, write a manifest `decisions[]` entry with the rejected
options. Per role, open a lineage tenure and build the walkthrough from the pattern's
outline *before* you need it. When the deployment ships, add yourself to the pattern's
`instantiations` with your deviations.

## Contributing a pattern

The bar: it must have happened, or be labeled as a sketch. Beyond that —

- `not_for` must contain at least one situation where the pattern looks right and is
  wrong. Patterns fail by being applied, not by being unknown.
- Every variation point's default needs a `default_because` traceable to something real —
  a recorded decision, a recorded debt, a measured number.
- Every role needs a walkthrough outline good enough that a stranger could run the
  handover from it.
- If the pattern bounds anything — a split cap, a threshold, a percentage heuristic — say
  where the number came from and mark it placeholder if it is one.
