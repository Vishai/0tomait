# FDE Hub: client context spec and flow pattern library

A standard for making forward-deployed engagements survive the engineer who built them,
and for making the next engineer (or the next agent) productive on day one instead of
month three.

The premise: the reusable asset from deployed engineering work is the structured context
that made the original engineer effective, while the implementations themselves are
commodity. Which system wins when two disagree. Which constraint is regulatory and which
is one executive's preference. Which gap in the automation is a bug and which was a
deliberate carve-out. Who holds which role today, and who held it before. What the word
"load" means in this building.

The argument in full is in [`docs/thesis.md`](./docs/thesis.md).

## How the layers fit

```
patterns/          the stable, generic layer: flow shapes, design commitments,
                   ROLES, and the interview for the client-specific 20%
      |
      |  scaffold.js turns a pattern into an engagement workbook;
      |  filling in the workbook IS drafting the manifest entries
      v
manifest           the specific, living layer: this client's systems, entities,
                   decisions, constraints, and the PEOPLE currently in the roles
      |
      |  validate.js keeps the document honest; conform.js checks the
      |  shipped repository against it
      v
transitions        spaces say who decides; lineage is the family tree of who has
                   held each role; walkthroughs are how a role moves to the next
                   person without a two-week backlog
```

One idea runs through all three: **roles are stable, people are tenures, walkthroughs are
the transition edges.** A pattern defines the roles a flow needs to survive. A manifest
binds those roles to actual people as tenures in each flow's lineage. A staffing change
then becomes a procedure instead of a crisis: close the tenure with an exit note, open the
next one, deliver the walkthrough.

## Contents

| Path | What it is |
| --- | --- |
| [`spec/deployment-manifest.schema.json`](./spec/deployment-manifest.schema.json) | The manifest schema (v0.4). Canonical definition. |
| [`spec/flow-pattern.schema.json`](./spec/flow-pattern.schema.json) | The pattern schema (v0.1). |
| [`spec/SPEC.md`](./spec/SPEC.md) | Field-by-field guide covering what each section is for and how to fill it in. |
| [`patterns/`](./patterns/) | The flow pattern library: four patterns and the rules the library runs on. |
| [`examples/meridian-freight.manifest.json`](./examples/meridian-freight.manifest.json) | A complete worked example. Fictional client, realistic mess, including a staffing transition that went badly and what it taught. |
| [`tools/validate.js`](./tools/validate.js) | Zero-dependency validator for manifests and patterns, including role-coverage checks. |
| [`tools/conform.js`](./tools/conform.js) | Conformance checker: verifies a shipped deployment repository lines up with its manifest and the method. |
| [`tools/scaffold.js`](./tools/scaffold.js) | Turns a pattern into a per-client engagement workbook. |
| [`tools/brief.js`](./tools/brief.js) | Compiles a manifest into an agent briefing, the context pack that turns "an agent with repo access" into "an agent that knows the client". |
| [`tools/report.js`](./tools/report.js) | Field report intake: files bugs, friction, gaps, and usage notes into the manifest from the command line, and closes them with a recorded resolution. |
| [`docs/thesis.md`](./docs/thesis.md) | Why this instead of a template library first. |

## Quick start

```bash
# Validate the worked example, with role-coverage checks against the pattern library
# (expect deliberate warnings; see below)
node fde-hub/tools/validate.js --patterns fde-hub/patterns fde-hub/examples/meridian-freight.manifest.json

# Validate the pattern library itself
node fde-hub/tools/validate.js fde-hub/patterns/*.pattern.json

# Check a shipped deployment repository against its manifest and the method
node fde-hub/tools/conform.js --repo path/to/deployment

# Start an engagement: generate the workbook for a pattern
node fde-hub/tools/scaffold.js fde-hub/patterns/document-intake-match.pattern.json --out workbook.md

# Hand the deployment to a maintenance agent: compile the briefing
node fde-hub/tools/brief.js fde-hub/examples/meridian-freight.manifest.json --out CLAUDE.md
```

To start a manifest for a real client, copy the example and replace it section by section.
The order that works: `client` and `glossary` first (they are pure listening), then
`systems`, then `entities`, then `flows` as you build them, each flow via its pattern's
workbook where one fits. Write `decisions` the day you make them, and open lineage tenures
the day a role changes hands. Reconstructing either later produces the sanitized version,
which is the useless version.

## What the tooling enforces

The validator checks the manifest as a document. Beyond schema conformance:

- **Referential integrity.** Flows reference systems, entities their source of truth,
  decisions their flows, spaces their contents, tenures their walkthroughs. Dangling
  references are errors, because a manifest that no longer describes a coherent system is
  a manifest that misleads.
- **No secrets.** Known credential formats are errors; high-entropy strings are warnings.
  The manifest holds pointers to secrets, never values.
- **Staleness.** Systems and flows carry `last_verified` (warn past 90 days); walkthroughs
  carry `last_updated` (warn past 180, since a stale walkthrough trains people wrong with
  confidence).
- **Time bombs.** Credential expiries and dated risks, flagged as they approach.
- **Handover smells.** Flows nobody monitors. Systems no flow references. Deployed flows
  with no recorded decisions. An empty glossary.
- **Staffing smells.** Flows no space claims. Lineages with only closed tenures, which is
  an orphaned deployment. Inherited roles with no walkthrough on record. Every human step
  running through a single person.
- **People integrity** (v0.3). One registry for every human; dangling person references
  are errors, and a staffing change is one edit instead of five.
- **Role coverage** (`--patterns <dir>`). A flow's pattern declares the roles it needs to
  survive; the validator checks each one is held by an open tenure. The pattern's
  backup-operator requirement stops being advice and becomes a check.
- **Feedback hygiene** (v0.4). Field reports capture what operators observe: bugs,
  friction, gaps, usage. Closed reports need a recorded resolution, aging open reports
  get flagged, and a cluster of reports against one flow reads as a redesign signal.

The conformance checker (`conform.js`) closes the loop on the deployment itself: the
manifest must exist and validate, no secret values may appear in the repository, flow code
locations and walkthrough assets must resolve to real paths, runbook commands must match
real `package.json` scripts, the manifest must keep up with the code by git history, and
CI must run the validator. Run it in the deployment's CI and again at every handover.

The example emits two warnings and a handful of notes on purpose: a stale system entry, a
flow with no weekend monitoring, human steps concentrated in one person, and handovers
that happened without walkthroughs. The point is that the family tree mechanically
surfaces the same risks the prose sections could only assert.

## Status

Manifest spec 0.4, pattern spec 0.1, both deliberately provisional. Patterns enter the
library by extraction from real deployments or are labeled sketches; defaults graduate to
recommendations at three instantiations and never before. Fields get added when a real
deployment produces information with nowhere to go, never speculatively.
