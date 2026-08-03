#!/usr/bin/env node
/**
 * Deployment conformance checker.
 *
 * The validator checks the manifest as a document. This tool checks the
 * deployment itself: does the repository that was actually shipped line up
 * with the structures the method indicates? It is the mechanical half of
 * "the next engineer can take this from here."
 *
 * Checks, all limited to what a machine can honestly verify:
 *   1. A manifest exists in the repository and passes schema + lint.
 *   2. No secret values anywhere in the repository source.
 *   3. Each flow's code.location resolves to a real path in the repository.
 *   4. Runbook steps that invoke `npm run <script>` match package.json scripts.
 *   5. Walkthrough locations that point into the repository resolve to files.
 *   6. The manifest keeps up with the code (git history comparison).
 *   7. CI runs the manifest validator.
 *
 *   node fde-hub/tools/conform.js --repo path/to/deployment
 *   node fde-hub/tools/conform.js --repo . --manifest docs/client.manifest.json --patterns fde-hub/patterns
 *
 * Exit codes match the validator: errors fail, warnings fail only with --strict.
 * Zero runtime dependencies; git is invoked when available and skipped when not.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { validateSchema, lint, SCHEMA_PATH } = require('./validate.js');

const MANIFEST_LAG_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'a GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'a Slack token'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'an API key'],
  [/\b(?:password|passwd|pwd)\s*[:=]\s*["']\S{6,}["']/i, 'an inline password'],
];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', 'vendor']);
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.yml', '.yaml', '.md', '.sh', '.env', '.txt', '.toml', '.cfg', '.ini', '.html', '.css', '.py']);

function walkFiles(root, dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walkFiles(root, full, out);
    } else if (stat.isFile() && stat.size < 1024 * 1024) {
      out.push(full);
    }
  }
  return out;
}

function git(repo, args) {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// A location field is free text ("github.com/org/repo — services/pod-intake").
// Return the first token containing a path separator that exists under the repo,
// or null. Tokens that look like URLs or domains are skipped.
function resolveLocation(repo, location) {
  const tokens = (location || '').split(/[\s,;()]+/).filter((t) => t.includes('/'));
  for (const t of tokens) {
    if (/^[a-z]+:\/\//i.test(t) || /^[\w-]+\.[a-z]{2,}\//i.test(t)) continue;
    const clean = t.replace(/^\.\//, '').replace(/[.,;:]+$/, '');
    if (clean && fs.existsSync(path.join(repo, clean))) return clean;
  }
  return null;
}

function findManifest(repo) {
  const candidates = [];
  for (const dir of ['.', 'docs', 'manifest', 'fde']) {
    const full = path.join(repo, dir);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith('.manifest.json') || name === 'deployment-manifest.json') {
        candidates.push(path.join(full, name));
      }
    }
  }
  return candidates;
}

function conform(repo, manifestPath, patternsById) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const err = (at, message) => errors.push({ at, message });
  const warn = (at, message) => warnings.push({ at, message });
  const note = (at, message) => notes.push({ at, message });

  // 1. Manifest exists and validates.
  if (!manifestPath) {
    const found = findManifest(repo);
    if (!found.length) {
      err('manifest', 'no deployment manifest found in the repository. The manifest is the method; a deployment without one does not conform.');
      return { errors, warnings, notes, manifestPath: null };
    }
    if (found.length > 1) {
      warn('manifest', `multiple manifests found (${found.map((f) => path.relative(repo, f)).join(', ')}); checking the first. Pass --manifest to be explicit.`);
    }
    manifestPath = found[0];
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    err('manifest', `could not parse ${manifestPath}: ${e.message}`);
    return { errors, warnings, notes, manifestPath };
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const schemaErrors = [];
  validateSchema(manifest, schema, schema, '$', schemaErrors);
  if (schemaErrors.length) {
    schemaErrors.forEach((e) => err(`manifest ${e.at}`, e.message));
    return { errors, warnings, notes, manifestPath };
  }
  const lintResult = lint(manifest, Date.now(), patternsById);
  lintResult.errors.forEach((e) => err(`manifest ${e.at}`, e.message));
  lintResult.warnings.forEach((e) => warn(`manifest ${e.at}`, e.message));

  const relManifest = path.relative(repo, manifestPath);
  const flows = manifest.flows || [];

  // 2. Secret scan across the repository.
  const files = walkFiles(repo, repo, []);
  for (const file of files) {
    if (!TEXT_EXT.has(path.extname(file)) && !path.basename(file).startsWith('.env')) continue;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const [pattern, what] of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        err(path.relative(repo, file), `appears to contain ${what}. The method stores pointers to secrets, in code as in the manifest.`);
      }
    }
  }

  // 3. Flow code locations resolve.
  const flowPaths = {};
  flows.forEach((f) => {
    const location = (f.code || {}).location || '';
    const resolved = resolveLocation(repo, location);
    if (resolved) {
      flowPaths[f.id] = resolved;
    } else {
      warn(`flow ${f.id}`, `code.location ('${location}') resolves to nothing in this repository. Either the code moved and the manifest lagged, or the location needs a repo-relative path.`);
    }
  });

  // 4. Runbook npm scripts exist.
  let pkgScripts = null;
  const pkgPath = path.join(repo, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      pkgScripts = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {};
    } catch {
      warn('package.json', 'exists but could not be parsed.');
    }
  }
  const procedures = ((manifest.runbook || {}).procedures || []);
  procedures.forEach((p) => {
    (p.steps || []).forEach((step) => {
      const m = step.match(/npm run ([\w:-]+)/);
      if (m && pkgScripts && !(m[1] in pkgScripts)) {
        err(`runbook '${p.name}'`, `step invokes 'npm run ${m[1]}' and package.json has no such script. A runbook that names commands that do not exist fails at 3am, which is the one time it gets used.`);
      }
      if (m && pkgScripts === null) {
        note(`runbook '${p.name}'`, `step invokes 'npm run ${m[1]}' but the repository has no package.json to check it against.`);
      }
    });
  });

  // 5. Walkthrough assets that point into the repo exist.
  (manifest.walkthroughs || []).forEach((w) => {
    const tokens = (w.location || '').split(/[\s,;()]+/).filter((t) => t.includes('/') && !/^[a-z]+:\/\//i.test(t) && !/^[\w-]+\.[a-z]{2,}\//i.test(t));
    if (!tokens.length) return; // external asset, unverifiable here
    const resolved = resolveLocation(repo, w.location);
    if (!resolved) {
      warn(`walkthrough ${w.id}`, `location ('${w.location}') looks repo-relative but resolves to nothing. A missing walkthrough is discovered during a handover, which is the worst time.`);
    }
  });

  // 6. Manifest freshness against code, by git history.
  const gitOk = git(repo, ['rev-parse', '--git-dir']) !== null;
  if (gitOk) {
    const manifestDate = git(repo, ['log', '-1', '--format=%cs', '--', relManifest]);
    if (manifestDate) {
      for (const [flowId, codePath] of Object.entries(flowPaths)) {
        const codeDate = git(repo, ['log', '-1', '--format=%cs', '--', codePath]);
        if (!codeDate) continue;
        const lag = Math.round((Date.parse(codeDate) - Date.parse(manifestDate)) / DAY_MS);
        if (lag > MANIFEST_LAG_DAYS) {
          warn(`flow ${flowId}`, `code at ${codePath} last changed ${codeDate}, but the manifest last changed ${manifestDate}. ${lag} days of drift means the document is describing a previous system. Update the manifest in the same change as the code.`);
        }
      }
    } else {
      note('git', 'manifest has no commit history yet; freshness check skipped.');
    }
  } else {
    note('git', 'repository has no git history available; freshness check skipped.');
  }

  // 7. CI runs the validator.
  const ciDir = path.join(repo, '.github', 'workflows');
  let ciValidates = false;
  if (fs.existsSync(ciDir)) {
    for (const name of fs.readdirSync(ciDir)) {
      const text = fs.readFileSync(path.join(ciDir, name), 'utf8');
      if (/validate\.js|conform\.js/.test(text)) ciValidates = true;
    }
  }
  if (pkgScripts && Object.values(pkgScripts).some((s) => /validate\.js|conform\.js/.test(s))) {
    ciValidates = ciValidates || false; // a script exists; still needs CI to call it
  }
  if (!ciValidates) {
    warn('ci', 'no CI workflow runs the manifest validator. An unvalidated manifest is trusted instead of checked, and trust is how documents rot.');
  }

  return { errors, warnings, notes, manifestPath };
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

function report(label, items, symbol) {
  if (!items.length) return;
  console.log(`\n  ${symbol} ${label} (${items.length})`);
  for (const { at, message } of items) console.log(`      ${at}: ${message}`);
}

function main() {
  const args = process.argv.slice(2);
  const opt = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const repo = opt('--repo');
  const strict = args.includes('--strict');

  if (!repo || !fs.existsSync(repo)) {
    console.error('usage: node conform.js --repo <deployment-dir> [--manifest <path>] [--patterns <dir>] [--strict]');
    process.exit(2);
  }

  let patternsById = null;
  const patternsDir = opt('--patterns');
  if (patternsDir) {
    patternsById = {};
    for (const f of fs.readdirSync(patternsDir).filter((n) => n.endsWith('.pattern.json'))) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(patternsDir, f), 'utf8'));
        if (p.id) patternsById[p.id] = p;
      } catch {
        console.error(`skipping unreadable pattern ${f}`);
      }
    }
  }

  const manifestArg = opt('--manifest');
  const manifestPath = manifestArg ? path.resolve(manifestArg) : null;

  console.log(`\nconformance: ${path.resolve(repo)}`);
  const { errors, warnings, notes, manifestPath: used } = conform(path.resolve(repo), manifestPath, patternsById);
  if (used) console.log(`manifest: ${used}`);

  report('errors', errors, '✗');
  report('warnings', warnings, '!');
  report('notes', notes, '·');

  const failed = errors.length > 0 || (strict && warnings.length > 0);
  if (!errors.length && !warnings.length) {
    console.log('\n  ✓ the deployment conforms to the method');
  } else if (!errors.length) {
    console.log('\n  ✓ conforms, with warnings above');
  }
  console.log('');
  process.exit(failed ? 1 : 0);
}

main();
