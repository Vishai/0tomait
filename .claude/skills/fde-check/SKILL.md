---
name: fde-check
description: Run this repository's full verification suite, covering the fde-hub manifest, patterns, tooling, and site page structure. Use after any change to fde-hub or the site pages, and before any PR.
---

# fde-check: full verification suite

Run every step; report failures with their output, and stop on errors.

## 1. Manifest and patterns

```bash
node fde-hub/tools/validate.js --patterns fde-hub/patterns fde-hub/examples/meridian-freight.manifest.json
node fde-hub/tools/validate.js fde-hub/patterns/*.pattern.json
```

Expected: exit 0. The example manifest intentionally emits two warnings (a stale system
entry, a flow nobody watches on weekends) plus several notes; those are documented
behavior, never something to fix. New or changed warnings beyond the documented set are
findings.

## 2. Tooling smoke tests

```bash
node fde-hub/tools/brief.js fde-hub/examples/meridian-freight.manifest.json > /dev/null
node fde-hub/tools/scaffold.js fde-hub/patterns/document-intake-match.pattern.json > /dev/null
node fde-hub/tools/report.js fde-hub/examples/meridian-freight.manifest.json --list > /dev/null
```

Expected: exit 0 on each.

## 3. Conformance self-check

Build a throwaway fixture repo if testing conform.js behavior, or skip when the change
does not touch `conform.js`. Reference: `fde-hub/spec/SPEC.md`, Conformance section.

## 4. Site page structure (when any page changed)

For each changed page, verify tag balance (count open vs close for `div`, `span`,
`section`, `style`, `script`, allowing Prettier-split closers like `</span\n>`), confirm
zero em dashes outside the testimonial, and confirm required marks are present:
`demo.html` carries its "recreation" labels and fictional-client note; `win.html` keeps
its filename; every page keeps its `<title>`, canonical, and OG tags.

## 5. Before merging

Merging to `main` deploys to production. Re-read the diff once, in full, as the last
step before opening the PR.
