# FDE Hub — client context spec

A standard for describing a client environment and everything deployed into it, so that a
forward-deployed engagement survives the engineer who built it.

The premise: the reusable asset from deployed engineering work is not a library of
implementations — those are commodity — it is the structured context that made the original
engineer effective. Which system wins when two disagree. Which constraint is regulatory and
which is one executive's preference. Which gap in the automation is a bug and which was a
deliberate carve-out. What the word "load" means in this building.

That context is what a successor needs, and it is what a coding agent needs in order to be
useful for maintenance rather than confidently wrong. It is currently stored nowhere except
in one person's head.

The argument in full is in [`docs/thesis.md`](./docs/thesis.md).

## Contents

| Path | What it is |
| --- | --- |
| [`spec/deployment-manifest.schema.json`](./spec/deployment-manifest.schema.json) | The schema. Canonical definition. |
| [`spec/SPEC.md`](./spec/SPEC.md) | Field-by-field guide — what each section is for and how to fill it in. |
| [`examples/meridian-freight.manifest.json`](./examples/meridian-freight.manifest.json) | A complete worked example. Fictional client, realistic mess. |
| [`tools/validate.js`](./tools/validate.js) | Zero-dependency validator: schema, referential integrity, staleness, credential leakage, handover smells. |
| [`docs/thesis.md`](./docs/thesis.md) | Why this and not a template library. |

## Quick start

```bash
node fde-hub/tools/validate.js fde-hub/examples/meridian-freight.manifest.json
```

To start a manifest for a real client, copy the example and replace it section by section.
The order that works: `client` and `glossary` first (they are pure listening), then
`systems`, then `entities`, then `flows` as you build them. Write `decisions` the day you
make them — reconstructing them later produces the sanitized version, which is the useless
version.

## What the validator enforces

Beyond schema conformance:

- **Referential integrity.** Flows reference systems, entities reference their source of
  truth, decisions reference flows. Dangling references are errors, because a manifest that
  no longer describes a coherent system is a manifest that misleads.
- **No secrets.** Known credential formats are errors; high-entropy strings are warnings.
  The manifest holds pointers to secrets, never values.
- **Staleness.** Systems and flows carry `last_verified`. Past 90 days you get a warning. A
  document that silently stops being true is worse than none, because it is trusted.
- **Time bombs.** Credential expiries and dated risks, flagged as they approach.
- **Handover smells.** Flows nobody monitors. Systems no flow references. Deployed flows
  with no recorded decisions. An empty glossary.

The example emits two warnings on purpose — a stale system entry and a flow with no weekend
monitoring — to show the checks firing on real content rather than only on malformed input.

## Status

Spec version 0.1, and deliberately provisional. It is written to be wrong in specific ways
that only contact with real engagements will reveal, and short enough that people actually
complete it. Fields get added when a real deployment produces information with nowhere to
go — not speculatively.
