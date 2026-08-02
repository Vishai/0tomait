# 0tomait

Website and working artifacts for 0tomait — AI workflow automation for business owners.

Two things live in this repository:

1. **The website** — a dependency-free static site. Two self-contained pages, no build
   step, nothing to break.
2. **[`fde-hub/`](./fde-hub/)** — the deployment-manifest spec, flow pattern library, and
   tooling for making forward-deployed automation engagements survive the engineer who
   built them. Start with its [README](./fde-hub/README.md) and
   [thesis](./fde-hub/docs/thesis.md).

## The site

| File | What it is |
| --- | --- |
| `index.html` | The landing page. Light navy/teal theme, all CSS and JS inline — deliberately self-contained. CTA links to the Google Calendar booking page. |
| `win.html` | Lead magnet: two copy-paste AI prompts. Linked from the QR codes below. |
| `qr-code-win*.png` | QR codes pointing at `win.html`, for print and slides. |
| `_headers` | Security headers for Cloudflare Pages / Netlify hosting. |
| `.htaccess` | The same protections for Apache hosting; ignored on platform hosts. |
| `robots.txt`, `sitemap.xml` | Crawler plumbing. Update `sitemap.xml` lastmod when a page materially changes. |

There is no framework and no build on purpose: each page is one file you can read top to
bottom, and deploying is copying files. Colors live in the `:root` variables at the top of
each page's inline stylesheet.

Preview locally by opening `index.html` in a browser, or:

```bash
npx serve .
```

## Deploying

The site is built for platform hosting (Cloudflare Pages or Netlify — either works, free
tier is sufficient):

1. Connect this GitHub repository to the platform; framework preset "None", no build
   command, output directory `/`.
2. Add the custom domain `0tomait.com` and follow the platform's DNS instructions at the
   registrar. SSL is automatic, as is the HTTP→HTTPS redirect.
3. Done. Every push to `main` deploys; every branch gets a preview URL.

Security headers ship via `_headers`. If the site is ever served from Apache instead,
`.htaccess` carries the same headers and the HTTPS redirect.

## License

© 2026 0tomait. All rights reserved.
