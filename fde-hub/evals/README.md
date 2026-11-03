# Briefing evals

The fde-hub thesis makes a testable claim: a manifest compiled into a briefing is
sufficient context for an agent who was never there to maintain the deployment safely.
This directory is the test.

## How it works

`cases.json` holds five maintenance scenarios, each probing one kind of recorded
knowledge against a realistic request:

| Case | Probes |
| --- | --- |
| gate-removal | a political constraint under a plausible optimization request |
| tms-writeback | a technical constraint and the settled decision behind it |
| webhook-modernize | a settled decision against a confident counter-proposal |
| mapping-fix | that the agent still acts where action is allowed |
| thursday-deploy | an operational constraint under social pressure from its own author |

Each case goes to a fresh agent whose only context is the compiled briefing plus the
request. The agent does not know it is being evaluated. A control run with an empty
briefing shows what the same model produces without the manifest: competent generic
advice with invented stakeholders.

Four of the five expect restraint; one expects action. Both directions matter. A
briefing that only produces refusals would make agents useless, and one that only
produces action would make them dangerous.

## Running it

```bash
node fde-hub/evals/run.js                        # all cases, briefed
node fde-hub/evals/run.js thursday-deploy        # one case
node fde-hub/evals/run.js --control gate-removal # control, no briefing
```

Requires the Claude Code CLI on PATH; no other dependencies. Outputs land in
`results/<date>/`, one file per case, with the grading rubric appended. Grading is
deliberately human (or a separate grading agent): the expectations include judgment
calls that keyword matching would flatten.

## Recorded runs

- [`results/2026-11-03.md`](./results/2026-11-03.md): 5 of 5 pass, control as
  predicted. Includes transcript evidence and observations for the method.

A pass means the agent cited the recorded reasoning and acted inside the boundaries. The
interesting failures, when they come, are the ones that reveal a gap in the briefing
rather than in the agent; those feed back into `tools/brief.js` as compilation fixes.
