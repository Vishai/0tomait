# Deployment Manifest — spec v0.1

A deployment manifest describes a client environment and everything deployed into it, in a
form that can be read cold by an engineer or an agent who was not present for the original
engagement.

The canonical definition is [`deployment-manifest.schema.json`](./deployment-manifest.schema.json).
This document explains what each section is *for* and how to fill it in without producing
ceremony. A worked example is at
[`../examples/meridian-freight.manifest.json`](../examples/meridian-freight.manifest.json).

## Principles

**Write for a stranger under time pressure.** The reader is someone who inherited this on a
Monday and has a production problem. Not a reviewer, not the client, not your future self.

**Record absence explicitly.** "Nobody monitors this" and "unknown" are valid, useful
answers. A blank field means "not investigated" and reads as "fine", which is how handover
documents mislead people.

**Never store a secret.** Only its mechanism and its location. The manifest circulates more
widely than any credential should.

**Prefer the client's words.** Business purposes, glossary terms, and problem statements
should be recognizable to the client if read back to them. Technical restatements lose the
information that made them worth recording.

**One fact, one place.** Cross-reference by id rather than repeating. Repetition is how a
document starts contradicting itself.

## Format

JSON, validated by the schema. JSON was chosen over YAML so the validator and CI hook stay
dependency-free; if you would rather maintain YAML, convert on the way in — nothing in the
spec depends on the serialization.

Identifiers are kebab-case, stable, and unique within their collection. Once an id is
referenced, changing it is a breaking edit — treat ids as permanent.

Dates are `YYYY-MM-DD`.

## Sections

### `manifest`

Metadata about the document, not the client. `spec_version` pins the schema. `maintainer`
is the person accountable for this document being true *today* — not the person who wrote
it originally.

### `client`

Who they are and how they operate.

`business_summary` is the load-bearing field: how this company actually makes money, in two
or three sentences. If you cannot write it, you do not yet understand the deployment well
enough to maintain it, and everything downstream will be guesswork.

`contacts` must name real people with real decision rights. "The ops team" is not a
contact. `communication_norms` captures the operational reality of working with them —
who answers fast, who is a bottleneck, whose approval is required. This is the field that
saves a successor their first two weeks.

`timezone` and `operating_hours` exist because every schedule and change window in the rest
of the document is meaningless without them.

### `engagement`

What was bought and why, so a successor can judge whether the system still earns its
maintenance cost.

`outcomes` are the measurable results, with `baseline`, `target`, and — once known —
`actual`. Report `actual` honestly, including misses; a manifest that only records
successes is a sales document and will be read as one. Leave it unset rather than guessing.

`support_posture` describes what actually happens when this breaks at 2am, contractually
and in practice. Those two are frequently different, and the difference is the important
part.

`budget_notes` is included because commercial reality changes engineering decisions. Knowing
the retainer is shrinking tells a successor to favor reducing maintenance load over adding
capability.

### `systems`

Every system the deployment touches or depends on. Nothing else in the document makes sense
without this inventory.

`purpose` is what the business uses it for, not what the vendor says it does.

`criticality` drives change-window discipline: `core` means the business stops without it.

`access` records the authentication *method* and the `secret_location` — a vault path or
secret-manager reference. Never a value. `rotation` should say who performs it and how
often; "unknown, never rotated" is a genuinely useful answer and usually the true one.
`expires` on a credential is a time bomb the validator will warn about as it approaches.

`gotchas` is the most expensive field to reconstruct and the most valuable to a successor.
It is the accumulated knowledge of how this system behaves *in this client's configuration*
— the replica lag, the reused identifiers, the vendor's habit of renaming columns in minor
releases. Write these down as you hit them, not at the end.

`last_verified` is when someone confirmed the entry is still true. The validator warns past
90 days.

### `entities`

The business objects that matter and where truth about them lives. This is the client's
ontology in miniature, and it is what lets a stranger reason about the data without
reading every integration.

`definition` should note where the client's usage differs from the industry-standard
meaning — those divergences are exactly what an outsider gets wrong.

`source_of_truth` names the system that wins when copies disagree, and must reference a
declared system. `also_lives_in` lists the copies; treat each one as a future
reconciliation bug.

`identifier` is the field used to join this entity across systems, *and its format and
caveats*. This is usually the single most useful line in the manifest — "unique only within
a fiscal year" is the kind of detail that causes silent data corruption when it is missing.

`quirks` records the real-world data conditions that break naive implementations:
duplicates, soft-deleted rows that still appear in queries, historical format changes.

### `flows`

What was actually deployed.

`business_purpose` is the job this does for the client, in their language. If it reads like
a technical description, rewrite it — the technical description is in the code.

`steps` describe the path at a level a non-author can follow. Not a code walkthrough; that
goes stale immediately and the code is right there.

`systems` and `entities` are id references. They power impact analysis: when a vendor
announces a breaking change, the affected flows become a lookup.

`human_in_the_loop` lists the points where a person must still act. These are the steps
that quietly stop working when that person changes role, and they are almost never
documented anywhere else.

`failure_mode.who_notices` must name a person or channel. If the honest answer is "nobody",
write "nobody" — the validator will flag it, and it should also appear under
`handoff.risks`.

`known_exceptions` are cases deliberately not handled. This field prevents a successor from
"fixing" an intentional carve-out and reintroducing a problem you already reasoned about.

### `decisions`

Why the system looks the way it does. The highest-value section, because it is the only one
that cannot be recovered by reading the code.

`context` describes the situation and pressures at the time, written so it still makes sense
a year later. Avoid references to conversations the reader was not part of.

`rejected` is required and must contain at least one alternative. A decision recorded
without its alternatives reads as arbitrary and gets reversed by accident. Record the
option that was genuinely tempting, not a strawman.

`revisit_when` states the condition that should reopen the decision. Decisions with expiry
conditions age far better than ones without — they can be retired deliberately instead of
either calcifying or being overturned on a hunch.

Record a decision when you chose between real alternatives, when you deliberately did not
do something, or when you would be annoyed to find someone had reversed it without asking.

### `constraints`

Rules the next engineer must not discover the hard way.

`kind` includes `political` deliberately. "Dana approved this project on the condition that
large invoices stay human-approved" is a real constraint with real consequences, and
omitting it because it is not technical is how good engineers damage relationships.

`consequence` is required: what breaks, legally or socially, if the rule is violated.
Constraints without stated consequences get optimized away by someone who assumes they were
arbitrary.

`source` should name a person or document. "Compliance said so" is not traceable.

### `runbook`

The operational surface: how to observe, change, and repair what is running.

`environments` covers how a new engineer gets access and who grants it — usually the longest
pole in onboarding, and worth stating in days.

`observability` states where logs live, what alerts fire, where they land, and who
acknowledges them. Include the gaps.

`procedures` are named, repeatable operations. Deploy, roll back, replay, rotate
credentials, onboard an engineer. Flows reference their deploy procedure by name and the
validator checks the link. Include `risk` — what this can damage if it goes wrong.

`known_failures` maps symptoms to causes and fixes, phrased using the words the operator
will actually see. This is what turns a 3am page into a lookup, and it is the section that
compounds fastest.

### `handoff`

The state of the world at the moment the original engineer stopped. Write it in the second
person, to a successor.

`unfinished` is work that was scoped and not completed — it was promised, and someone may
still be expecting it.

`debt` is shortcuts taken knowingly. Each entry records `why` (the pressure that justified
it) and `cost_to_fix`. Debt without its rationale looks like incompetence; with it, it
looks like judgment, which is usually the truth.

`risks` are things likely to break on their own, without anyone touching them. Dated risks
carry `trigger_date` and the validator warns as they approach.

`recommended_next` is what you would do with another two weeks, in priority order. This is
the most immediately actionable part of the document for whoever picks it up.

`blast_radius_notes` captures coupling that is not obvious from the code — "if you change X,
Y silently stops". Shared credentials, load-bearing folder paths, implicit ordering.

### `glossary`

Client-specific vocabulary. Almost always omitted, and almost always the reason an outsider
misreads the domain — including an agent, which will confidently interpret a term by its
common meaning.

Include terms whose meaning is client-specific, terms that collide with technical
vocabulary, and terms two departments use differently. `not_to_be_confused_with` is for the
collisions, which are the expensive ones.

## Validation

```
node fde-hub/tools/validate.js fde-hub/examples/meridian-freight.manifest.json
node fde-hub/tools/validate.js --strict path/to/manifest.json   # warnings also fail
```

Schema errors and lint errors exit non-zero. Warnings exit zero unless `--strict`.

Beyond the schema, the validator checks:

- **Referential integrity** — every id reference resolves to a declared system, entity,
  flow, or runbook procedure.
- **Duplicate ids** within a collection.
- **Credential leakage** — known key formats are errors; high-entropy strings are warnings.
- **Staleness** — `last_verified` older than 90 days.
- **Time bombs** — credential `expires` and risk `trigger_date` past or within 60 days.
- **Handover smells** — flows nobody monitors, systems no flow references, deployed flows
  with no recorded decisions, an empty glossary.

The example manifest is expected to emit two warnings. Both are deliberate: one system is
past its verification window, and one flow records that nobody watches its alerts on
weekends. They demonstrate that the checks fire on real content rather than only on
malformed input.

Wire it into CI so the document is validated rather than trusted.

## Extending

Add fields when a real engagement produces information that has nowhere to go, and when a
successor would be materially worse off without it. Do not add fields speculatively — this
spec earns its keep by being short enough that people actually complete it.

Bump `spec_version` on any change that would invalidate an existing manifest.
