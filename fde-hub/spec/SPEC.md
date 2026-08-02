# Deployment Manifest — spec v0.3

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

### `people` *(v0.3)*

The person registry: the single home for every human in the manifest. Every other
person-bearing field — `maintainer`, `system_owner`, `decision_maker`, `delegate`,
`current_owner`, `tenure.person` — references an entry here by id, so a staffing change is
one edit rather than a scavenger hunt across five sections.

Entries must name real people with real decision rights; "the ops team" is not a person.
`notes` carries how to work with them effectively — response habits, availability windows
— kept professional, because the client reads this document. Departed people stay in the
registry: their tenures still reference them, and history should not dangle. A defunct
team can be modeled as an entry when its tenures predate individual attribution.

The validator enforces the registry wherever one exists: unknown references are errors,
inline contacts alongside a registry are flagged for migration, and registered people
nothing references are noted as possible leftovers.

### `client`

Who they are and how they operate.

`business_summary` is the load-bearing field: how this company actually makes money, in two
or three sentences. If you cannot write it, you do not yet understand the deployment well
enough to maintain it, and everything downstream will be guesswork.

`communication_norms` captures the cross-cutting reality of working with the client —
which decisions wait on whose cadence, which availability windows gate the schedule.
Per-person norms belong on the people entries. (`contacts` remains for pre-0.3 manifests;
the people registry replaces it.)

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

## The stewardship layer *(v0.2)*

Deployments die of staffing more often than of code. v0.2 adds three sections that make
staffing fluidity visible instead of surprising, built on one idea: **roles are stable,
people are tenures, walkthroughs are the transition edges.**

The progression this supports is the one every deployment should make:

1. **Person-shaped** — the job is "ask Marcus". This is where every deployment starts and
   where most of them die.
2. **Role-shaped** — the job is "the queue-operator, currently Marcus". The role is named,
   its cadence and duties are written down (usually inherited from the flow's pattern),
   and Marcus holds it as an open tenure.
3. **Transferable** — the role plus a walkthrough plus tenure mechanics. A staffing change
   is now a procedure, not a crisis: close the outgoing tenure with an `exit_note`, open
   the incoming one, deliver the walkthrough and record it in `trained_via`.

### `spaces` *(v0.2)*

Business domains, each with a named decision maker: the person whose yes is required
before changing anything inside it. This answers the question a successor cannot answer
from code — *who do I ask?* — and it is where staffing escalations land, because queue
overload and unfilled roles are staffing decisions, which belong to the space's decision
maker rather than to the engineer.

`decision_maker` is one name, not a committee. `delegate` records who answers in their
absence *and the limit of what the delegate can approve* — the limit is the useful part.
A space with no delegate is a real configuration (the reference manifest's client-it space
has exactly one gatekeeper); record it and plan around it.

Every flow should belong to a space. The validator warns about flows no space claims.

### `lineage` — the family tree *(v0.2)*

On every flow and system: the list of tenures — who has held which role on it, from when
to when, and how each tenure ended. An open tenure (no `to` date) is a current holder.

The two most valuable fields are the uncomfortable ones. `exit_note` records how a tenure
ended and what was lost — write it when it happens, because the sanitized version written
later is useless. `trained_via` links the tenure to the walkthrough that transferred the
role; its *absence* on an inherited tenure is itself a finding, and the validator says so:
the knowledge moved in conversation, if at all.

Role names come from the flow's pattern where one exists (`steward`, `queue-operator`,
`approver`, …), which is what lets a plug-in engineer read a manifest and know what each
role means without asking.

### `walkthroughs` *(v0.2)*

The transition assets — recordings, documents, pairing scripts, checklists — that move a
role from one person to the next. Each is a pointer to where the asset lives, not the
content itself, with the role it trains into and what it covers.

`last_updated` matters more than it looks: a walkthrough that predates the system it
describes trains people wrong *with confidence*, which is worse than no walkthrough. The
validator warns past 180 days.

The outline for a walkthrough comes from the pattern: every pattern role carries
`transition_walkthrough_must_cover`, and the client walkthrough is that outline made
specific. Build it before it is needed — the reference manifest's family tree records a
departure that happened before the walkthrough existed, and the two-week backlog that
followed.

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
- **Stewardship smells** *(v0.2)* — flows no space claims; lineages with only closed
  tenures (an orphaned deployment); inherited tenures with no walkthrough on record;
  every human step running through a single person; stale walkthroughs; tenure dates that
  end before they begin.
- **People integrity** *(v0.3)* — person references that resolve to nobody; tenures naming
  people outside the registry; inline contacts where a registry exists; registered people
  nothing references; a 0.3 manifest with no registry at all.
- **Role coverage** *(v0.3, with `--patterns <dir>`)* — for each flow that names a pattern,
  every role the pattern declares must be held by an open tenure. The pattern's position
  is that the flow does not survive unstaffed roles; the validator makes that position
  enforceable. Trigger kinds that deviate from the pattern are noted as data for the
  pattern's instantiations.

The validator also accepts flow pattern files (detected by their `pattern_version` field),
checking them against `flow-pattern.schema.json` plus pattern-specific lint: defaults must
be listed options, and provisional or uninstantiated patterns are flagged as sketches.

The example manifest is expected to emit two warnings and a handful of notes, all
deliberate: a system past its verification window, a flow nobody watches on weekends,
human steps concentrated in one person, and handovers that happened without walkthroughs.
They demonstrate that the checks fire on real content rather than only on malformed input
— and that the family tree mechanically surfaces the same risks the prose sections could
only assert.

Wire it into CI so the document is validated rather than trusted.

## Compiling for agents

`tools/brief.js` compiles a manifest into an agent briefing — a CLAUDE.md-style context
pack for a maintenance agent. Constraints become imperatives, spaces become approval
rules, gotchas become warnings, known exceptions become do-not-fix markers, and the
glossary becomes vocabulary. This is the operational half of the thesis: agents are
bottlenecked on context, not capability, and the manifest is where the context lives.

```
node fde-hub/tools/brief.js path/to/manifest.json --out CLAUDE.md
```

The briefing is a lossy view; it says so in its own header and directs the agent back to
the manifest as the source of truth.

## Extending

Add fields when a real engagement produces information that has nowhere to go, and when a
successor would be materially worse off without it. Do not add fields speculatively — this
spec earns its keep by being short enough that people actually complete it.

Bump `spec_version` on any change that would invalidate an existing manifest.

## Changelog

**0.3** — the person registry. Adds top-level `people` as the single home for every human;
`maintainer`, `system_owner`, `decision_maker`, `delegate`, `current_owner`, and
`tenure.person` become id references into it. Fixes 0.2's structural flaw: the same person
scattered across five sections, each mention a separate edit when staffing changed.
`client.contacts` becomes optional legacy. 0.1/0.2 manifests remain schema-valid (person
fields accept inline contacts); the lint requires the registry at 0.3 and flags inline
contacts wherever a registry exists.

**0.2** — the stewardship layer. Adds `spaces` (business domains with named decision
makers), `lineage` on flows and systems (the family tree of tenures), `walkthroughs`
(transition assets, referenced from tenures via `trained_via`), and `pattern` on flows
(provenance link to the pattern library). All additions are optional: a valid 0.1 manifest
remains valid under 0.2.

**0.1** — initial spec.
