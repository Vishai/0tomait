# CLAUDE.md

Context for agents working on this repository. Read this before changing anything;
it is the briefing for this deployment, and this deployment is a production website.

## What this is

Two things live here:

1. **The website** (`index.html`, `demo.html`, `win.html`): the public site for 0tomait,
   a forward-deployed AI engineering practice. Served by Cloudflare Pages.
2. **`fde-hub/`**: the published method. A deployment-manifest spec, a flow pattern
   library, and zero-dependency tooling. Start with `fde-hub/README.md` and
   `fde-hub/docs/thesis.md` before touching anything in it.

## Hard rules

- **Merging to `main` deploys to production** at 0tomait.com, automatically, within about
  a minute. Never commit directly to `main`; branch, open a PR, merge deliberately.
- **Never commit a secret**, a credential, or a real client's private details. The whole
  repo is public and the whole repo is served as a website.
- **The site has no build step, by design.** Each page is one self-contained HTML file
  with inline CSS and JS. Do not introduce bundlers, frameworks, or node_modules for the
  site. The only external resources allowed are Google Fonts (see `_headers` CSP).
- **`win.html` must keep its filename and URL.** Printed QR codes point at it.
- **The client testimonial in `index.html` is a verbatim quote.** Never edit its wording
  or punctuation.
- **Meridian Freight is fictional and must stay labeled as fictional** everywhere it
  appears: the example manifest, `demo.html`, and anything derived from them. The tool
  recreations on `demo.html` carry visible "recreation" labels; keep them.

## Prose style, non-negotiable

Applies to all site copy, documentation, commit messages, and PR bodies:

- No em dashes. Use periods, colons, commas, or parentheses.
- No "not X, but Y" contrast constructions. State the claim directly.
- Plain sentences over fragments. Concrete numbers over adjectives.
- Quoted material is exempt: the testimonial, validator output shown as output, and
  field-report text keep their original punctuation.

## Design system (the site)

- Type: IBM Plex Sans for prose, IBM Plex Mono for kickers, labels, metrics, artifacts.
- Palette tokens live in each page's `:root`: ink `#1e293b`, accent teal `#0d9488`,
  paper `#f8fafc`, hairline `#e2e8f0`, terminal panels `#0f172a`.
- Layout grammar: left-aligned sections with mono index kickers (`01 / THE PROBLEM`),
  definition rows with hairline separators, terminal panels as the signature element,
  sharp corners (3-6px radius). No emoji as icons. No pill badges, no gradient text,
  no card grids with icon headers.

## fde-hub discipline

- Any change to `spec/deployment-manifest.schema.json` that alters meaning: bump
  `spec_version`, update the enum, document it in `spec/SPEC.md` including the changelog,
  and keep earlier manifest versions valid where possible.
- Patterns are extracted from real deployments or marked `provisional`. Every variation
  default needs a `default_because` traceable to something real.
- The example manifest (`fde-hub/examples/meridian-freight.manifest.json`) doubles as the
  test fixture. It intentionally emits two warnings and several notes; the expected
  output is documented in `spec/SPEC.md`. Do not "fix" those warnings.
- Tools in `fde-hub/tools/` are zero-dependency Node by policy. No npm installs.

## Verify after any change

```bash
# fde-hub changes:
node fde-hub/tools/validate.js --patterns fde-hub/patterns fde-hub/examples/meridian-freight.manifest.json
node fde-hub/tools/validate.js fde-hub/patterns/*.pattern.json
node fde-hub/tools/brief.js fde-hub/examples/meridian-freight.manifest.json > /dev/null

# site changes: check tag balance per page (open/close counts for div, span, section),
# then re-read the changed section rendered in a browser or preview before merging.
```

The `/fde-check` skill runs the full suite; the `/deai-prose` skill applies the prose
rules to a file. Use them.

## Voice

The site and docs argue one thesis: automation should survive its engineer. New copy
should serve that argument in the client's language, with honest gaps stated plainly.
When in doubt, read `demo.html` for register and `fde-hub/docs/thesis.md` for substance.
