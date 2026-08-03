# The handoff is the product

*A design note on what survives a forward-deployed engagement.*

## The failure mode

The forward-deployed model has a well-known ending. An engineer embeds with a client,
learns the business at a depth no statement of work captures, ships something that works,
and leaves. Six months later the integration breaks against a vendor upgrade, or the
business changes shape, and the client discovers they own an artifact nobody understands.
The code is readable. The reasoning is gone.

More documentation does not fix this. The client usually has plenty of documents. What
they lack is the specific, structured context that made the original engineer effective:
which system wins when two disagree, which constraint is regulatory and which is one
executive's preference, which gap in the automation is a bug and which was a deliberate
carve-out, and what the word "load" means in this building.

That context is the expensive part of the engagement. It is also stored nowhere except in
one person's head.

## The tempting wrong answer

The intuitive fix is a library of reusable flows: pre-built implementations for the
patterns that recur across clients. Document ingestion. Ticket triage. Reconciliation.
Approval routing.

It is the wrong thing to build first, for three reasons.

**Templates are commodity.** Every workflow platform ships thousands of them, and code
generation has made scaffolding the eightieth-percentile version of any integration close
to free. Nothing about a template library is defensible.

**An engagement earns its fee in the client-specific glue.** The undocumented ERP, the
auth story, the exception cases, the compliance constraint that surfaced in week three.
That glue differs at every client, which is exactly why it resists templating.

**Abstracting before you have implementations produces fiction.** A framework designed
against imagined clients gets designed around imagined problems. The first real
deployment breaks it, and the second breaks it differently.

## The thesis

The durable asset is a **structured, machine-readable description of the client
environment and everything deployed into it**, written to be read cold by someone who was
never there.

This inverts the usual emphasis. The flows are the deliverable the client bought. The
manifest is what makes the flows survivable.

Three things make it worth building now.

**It is the part that repeats.** Every engagement produces a different implementation and
the same shape of context. Systems, entities, decisions, constraints, and risks recur
even when nothing else does. A standard pays off exactly there.

**Maintenance is increasingly an agent's job, and agents are starved for context rather
than capability.** A coding agent can perform the refactor, chase the vendor API change,
and extend the flow. It cannot know that load numbers are only unique within a fiscal
year, or that invoices over $25,000 stay human-approved because the whole project was
approved on that condition. Give an agent the manifest and maintenance changes character.
Give it only the repository and it will do the wrong thing with confidence.

**A precedent validates the direction.** Palantir's Foundry ontology, considered apart
from the platform around it, is a semantic model of the business that outlives any
individual deployed engineer. Same bet, different scale. It is also the piece that made
their deployments sticky instead of disposable.

## Two boundaries

This should never be sold as a lock-in play. A manifest that makes a client easier to
leave sounds, to the party paying for it, like an odd thing to fund. The honest framing
is also the true one: the manifest is what makes the deployment maintainable at all,
whether by the next engineer, by the client's own staff, or by an agent. It shortens
time-to-value on day one and it is the reason the system still works in year two.
Portability follows as a consequence.

It is also no substitute for having done the work. Two real deployments teach more about
what belongs in this document than any amount of designing it in the abstract. The spec
in this repository is versioned at 0.x on purpose and expected to be wrong in specific
ways that only contact with real engagements will reveal.

## The design commitments

Six choices separate this from a documentation template. Each exists because of a
specific way handover documents fail.

**Decisions carry their rejected alternatives.** A decision recorded without its
alternatives reads as arbitrary, and a successor reverses it by accident. The rejected
options are what let the reasoning survive contact with someone who disagrees. Each
decision also carries a `revisit_when` condition, so it can be retired deliberately
instead of calcifying or being overturned on a hunch.

**Records carry their own expiry.** `last_verified` on every system and flow, `expires`
on credentials, `trigger_date` on dated risks. A manifest that silently stops being true
is worse than none, because it is trusted. Decay gets surfaced instead of assumed away.

**Secrets are pointers.** The manifest is meant to be readable by anyone who inherits the
account, so it can never be the place a credential lives. The validator enforces this.

**Absence is recorded out loud.** "Nobody watches this on weekends" is a finding. The
most dangerous handover artifacts stay silent about what is unowned. The validator flags
flows nobody monitors and systems nothing references.

**Everything cross-references, and a machine checks it.** Flows name the systems they
touch, entities name their source of truth, decisions name the flows they govern. Impact
analysis becomes a lookup: when a vendor announces a breaking change, the affected flows
fall out of a query instead of an archaeology project. And the document can be validated
in CI instead of rotting unnoticed.

**The deployment talks back.** Field reports capture friction, gaps, bugs, and usage
observations from the people who actually operate the system, with a recorded status and
resolution for each. Feedback that sits unanswered teaches people to stop reporting, so
the validator tracks report age, and a cluster of reports against one flow is read as a
redesign signal rather than a ticket backlog.

## How to tell if it is working

The test is concrete. A competent engineer who has never met the client reads the
manifest, gets access, and safely ships a change within a day. An agent handed the same
document makes decisions the original engineer would recognize as correct.

Every field in the spec should be justified against that test. Fields that fail it are
ceremony and should be cut.
