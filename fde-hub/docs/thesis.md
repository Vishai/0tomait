# The handoff is the product

*A design note on what actually survives a forward-deployed engagement.*

## The failure mode

The forward-deployed model has a well-known ending. An engineer embeds with a client,
learns their business at a depth no statement of work captures, ships something that
works, and leaves. Six months later the integration breaks against a vendor upgrade, or
the business changes shape, and the client discovers they own an artifact nobody
understands. The code is readable. The *reasoning* is gone.

This is not a documentation problem, and it is not solved by writing more of it. The
client usually has plenty of documents. What they lack is the specific, structured
context that made the original engineer effective: which system wins when two disagree,
which constraint is regulatory and which is one executive's preference, which gap in the
automation is a bug and which was a deliberate carve-out, and what the word "load" means
in this building.

That context is the expensive part of the engagement. It is also the part that is
currently stored nowhere except in one person's head.

## The tempting wrong answer

The intuitive fix is a library of reusable flows — a hub of pre-built implementations for
the patterns that recur across clients, customized per deployment. Document ingestion.
Ticket triage. Reconciliation. Approval routing.

It is the wrong thing to build first, for three reasons.

**Templates are commodity.** Every workflow platform ships thousands of them, and code
generation has made scaffolding the eightieth-percentile version of any integration close
to free. Nothing about a template library is defensible.

**The value was never in the eighty percent.** It is in the twenty percent of glue: this
client's undocumented ERP, their auth story, their exception cases, the compliance
constraint that surfaced in week three. That twenty percent is definitionally
non-templatable — it is the part that differs.

**Abstracting before you have implementations produces fiction.** A framework designed
against imagined clients gets designed around imagined problems. The first real
deployment breaks it, and the second breaks it differently.

## The thesis

The durable asset is not the implementation library. It is a **structured, machine-readable
description of the client environment and everything deployed into it** — written to be
read cold by someone who was not there.

This inverts the usual emphasis. The flows are the deliverable the client bought. The
manifest is the deliverable that makes the flows survivable.

Three things make this worth building now rather than later:

**It is the reusable part.** Every engagement produces a different implementation and the
same *shape* of context. Systems, entities, decisions, constraints, and risks recur even
when nothing else does. That is where a standard pays off.

**Maintenance is increasingly an agent's job, and agents are bottlenecked on context, not
capability.** A coding agent can perform the refactor, chase the vendor API change, and
extend the flow. What it cannot do is know that load numbers are only unique within a
fiscal year, or that invoices over $25,000 stay human-approved because that was the
condition the whole project was approved under. Give an agent the manifest and the
maintenance problem substantially changes character. Give it only the repository and it
will confidently do the wrong thing.

**It has a precedent that validates the direction.** Palantir's Foundry ontology is,
stripped of the platform around it, a semantic model of the business that outlives any
individual deployed engineer. That is the same bet at a different scale — and it is the
piece that made their deployments sticky rather than disposable.

## What this is not

It is not a lock-in play, and it should not be sold as one. A manifest that makes a client
easier to leave sounds, to the party paying for it, like an odd thing to fund. The honest
framing is the one that is also true: the manifest is what makes the deployment
maintainable at all — by the next engineer, by the client's own staff, or by an agent. It
shortens time-to-value on day one, and it is the reason the system still works in year
two. Portability is a consequence, not the pitch.

It is also not a substitute for having done the work. Two real deployments teach more
about what belongs in this document than any amount of designing it in the abstract. The
spec in this repository is deliberately versioned at 0.1 and expected to be wrong in
specific ways that only contact with real engagements will reveal.

## The design commitments

Five choices distinguish this from a documentation template, and each one exists because
of a specific way handover documents fail.

**Decisions carry their rejected alternatives.** A decision recorded without its
alternatives reads as arbitrary, and a successor reverses it by accident. The rejected
options are what make the reasoning survive contact with someone who disagrees with it.
Each decision also carries a `revisit_when` condition, so it can be retired deliberately
rather than either calcifying or being overturned on a hunch.

**Records carry their own expiry.** `last_verified` on every system and flow, `expires` on
credentials, `trigger_date` on dated risks. A manifest that silently stops being true is
worse than no manifest, because it is trusted. Decay is surfaced rather than assumed away.

**Secrets are pointers, never values.** The manifest is meant to be readable by anyone who
inherits the account, which means it can never be the place a credential lives. The
validator enforces this.

**Absence is recorded explicitly.** "Nobody watches this on weekends" is a finding, not a
gap in the document. The most dangerous handover artifacts are the ones that are silent
about what is unowned. The validator flags flows nobody monitors and systems nothing
references.

**Everything is cross-referenced and checkable.** Flows name the systems they touch;
entities name their source of truth; decisions name the flows they govern. That makes
impact analysis mechanical — when a vendor announces a breaking change, the affected flows
are a lookup rather than an archaeology project — and it means the document can be
validated in CI instead of rotting unnoticed.

## How to tell if this is working

The test is not whether the document is complete. It is whether a competent engineer who
has never met the client can read it, get access, and safely ship a change within a day —
and whether an agent handed the same document makes decisions the original engineer would
recognize as correct.

Everything in the spec should be justified against that test. Fields that do not serve it
are ceremony and should be cut.
