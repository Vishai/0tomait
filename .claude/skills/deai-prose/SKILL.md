---
name: deai-prose
description: Sweep a file of AI-writing tells, replacing em dashes and contrast constructions with plain prose per this repo's style rules. Use on any new or edited copy, doc, or commit message before it ships.
---

# De-AI prose pass

Apply to the file or text the user names. These are this repository's non-negotiable
style rules for site copy, docs, commit messages, and PR bodies.

## The two tells to remove

1. **Em dashes (—).** Replace each with a period, colon, comma, or parentheses,
   choosing whichever keeps the sentence natural. Splitting into two sentences is
   usually better than a clever substitute.
2. **Contrast constructions**: "not X, but Y", "X, not Y", "this is not X — this is Y",
   "less X than Y". Restate as the direct claim. "Not a promise — a published method"
   becomes "The method is published." Keep a negation only when the argument genuinely
   is about ruling something out, and even then prefer "X should never be sold as Y"
   over the reflex pattern.

## Exemptions

- Verbatim quotes: the client testimonial, field-report text, validator output shown as
  output. Quotes keep their original punctuation exactly.
- Code, JSON, and identifiers.

## Secondary tells, fix on sight

- Scare quotes around ordinary words.
- Fragment-for-drama endings ("Including me.") restated as plain sentences.
- Rule-of-three padding where two items carry the meaning.
- Buzzwords standing in for a number or artifact; replace with the concrete thing or cut.

## Procedure

1. `grep -n "—" <file>` to count and locate em dashes; fix each in place.
2. Search for " not " and "n't " and inspect each hit for the contrast pattern.
3. Re-read the result aloud-in-your-head for rhythm; AI prose averages identical
   sentence lengths, so vary them.
4. Confirm zero em dashes remain outside exemptions: `grep -c "—" <file>`.
