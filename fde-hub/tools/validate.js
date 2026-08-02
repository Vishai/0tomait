#!/usr/bin/env node
/**
 * Deployment manifest validator.
 *
 * Two passes:
 *   1. Schema validation against spec/deployment-manifest.schema.json.
 *   2. Lint rules that a JSON Schema cannot express — referential integrity,
 *      staleness, credential leakage, and the handover smells this spec exists
 *      to surface.
 *
 * Zero dependencies, to match the rest of this repository.
 *
 *   node fde-hub/tools/validate.js fde-hub/examples/meridian-freight.manifest.json
 *   node fde-hub/tools/validate.js --strict manifests/*.json
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', 'spec', 'deployment-manifest.schema.json');
const STALE_AFTER_DAYS = 90;
const EXPIRY_WARN_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Minimal JSON Schema validator — supports exactly the keywords the spec uses.
// ---------------------------------------------------------------------------

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`Only local refs are supported, got: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((node, key) => {
      if (node === undefined) throw new Error(`Unresolvable ref: ${ref}`);
      return node[key.replace(/~1/g, '/').replace(/~0/g, '~')];
    }, root);
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateSchema(value, schema, root, at, errors) {
  if (schema.$ref) return validateSchema(value, resolveRef(schema.$ref, root), root, at, errors);

  const fail = (message) => errors.push({ at, message });

  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = expected.some((t) => (t === 'number' ? actual === 'number' : t === actual));
    if (!ok) {
      fail(`expected ${expected.join(' or ')}, got ${actual}`);
      return; // Further checks would be noise.
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    fail(`must be ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    fail(`must be one of ${schema.enum.join(', ')} — got ${JSON.stringify(value)}`);
  }

  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      fail(`does not match required format ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) {
      fail(
        `is too thin at ${value.trim().length} characters (minimum ${schema.minLength}). ` +
          `This field is required to carry real content, not a placeholder.`
      );
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      fail(`needs at least ${schema.minItems} item(s), has ${value.length}`);
    }
    if (schema.items) {
      value.forEach((item, i) => validateSchema(item, schema.items, root, `${at}[${i}]`, errors));
    }
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) {
      if (value[key] === undefined) fail(`missing required field '${key}'`);
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = (schema.properties || {})[key];
      if (childSchema) {
        validateSchema(child, childSchema, root, `${at}.${key}`, errors);
      } else if (schema.additionalProperties === false && schema.properties) {
        fail(`unknown field '${key}' — not part of the spec`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Lint rules.
// ---------------------------------------------------------------------------

const HARD_SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'a GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'a Slack token'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'an API key'],
  [/\b(?:password|passwd|pwd)\s*[:=]\s*\S{6,}/i, 'an inline password'],
];

function looksHighEntropy(text) {
  const candidates = text.match(/[A-Za-z0-9+/=_-]{32,}/g) || [];
  return candidates.some(
    (token) => /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token)
  );
}

function walkStrings(node, at, visit) {
  if (typeof node === 'string') return visit(node, at);
  if (Array.isArray(node)) return node.forEach((v, i) => walkStrings(v, `${at}[${i}]`, visit));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walkStrings(v, `${at}.${k}`, visit);
  }
}

function daysBetween(fromIso, to) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  if (Number.isNaN(from)) return null;
  return Math.round((to - from) / DAY_MS);
}

function lint(manifest, now) {
  const errors = [];
  const warnings = [];
  const notes = [];

  const err = (at, message) => errors.push({ at, message });
  const warn = (at, message) => warnings.push({ at, message });
  const note = (at, message) => notes.push({ at, message });

  const systems = manifest.systems || [];
  const entities = manifest.entities || [];
  const flows = manifest.flows || [];

  const systemIds = new Set(systems.map((s) => s.id));
  const entityIds = new Set(entities.map((e) => e.id));
  const flowIds = new Set(flows.map((f) => f.id));

  // Duplicate identifiers.
  const collections = [
    ['systems', systems],
    ['entities', entities],
    ['flows', flows],
    ['decisions', manifest.decisions || []],
    ['constraints', manifest.constraints || []],
  ];
  for (const [name, items] of collections) {
    const seen = new Set();
    for (const item of items) {
      if (item && seen.has(item.id)) err(name, `duplicate id '${item.id}'`);
      if (item) seen.add(item.id);
    }
  }

  // Referential integrity. A dangling reference means the manifest no longer
  // describes a coherent system, which is exactly when it starts misleading people.
  const ref = (at, id, pool, kind) => {
    if (id !== undefined && !pool.has(id)) err(at, `references unknown ${kind} '${id}'`);
  };

  entities.forEach((e, i) => {
    ref(`entities[${i}].source_of_truth`, e.source_of_truth, systemIds, 'system');
    (e.also_lives_in || []).forEach((id, j) =>
      ref(`entities[${i}].also_lives_in[${j}]`, id, systemIds, 'system')
    );
  });

  flows.forEach((f, i) => {
    (f.systems || []).forEach((id, j) => ref(`flows[${i}].systems[${j}]`, id, systemIds, 'system'));
    (f.entities || []).forEach((id, j) => ref(`flows[${i}].entities[${j}]`, id, entityIds, 'entity'));
    const proc = f.code && f.code.deploy_procedure;
    const procNames = new Set(((manifest.runbook || {}).procedures || []).map((p) => p.name));
    if (proc && !procNames.has(proc)) {
      err(`flows[${i}].code.deploy_procedure`, `references unknown runbook procedure '${proc}'`);
    }
  });

  (manifest.decisions || []).forEach((d, i) =>
    (d.flow_ids || []).forEach((id, j) =>
      ref(`decisions[${i}].flow_ids[${j}]`, id, flowIds, 'flow')
    )
  );
  ((manifest.runbook || {}).known_failures || []).forEach((k, i) =>
    ref(`runbook.known_failures[${i}].flow_id`, k.flow_id, flowIds, 'flow')
  );
  ((manifest.handoff || {}).debt || []).forEach((d, i) =>
    ref(`handoff.debt[${i}].flow_id`, d.flow_id, flowIds, 'flow')
  );

  // Credentials. The manifest is meant to be readable by anyone who inherits the
  // account, which means it must never be the place a secret lives.
  walkStrings(manifest, '$', (text, at) => {
    for (const [pattern, what] of HARD_SECRET_PATTERNS) {
      if (pattern.test(text)) err(at, `appears to contain ${what}. Store a pointer, never a value.`);
    }
    if (looksHighEntropy(text)) {
      warn(at, 'contains a high-entropy string that may be a credential. Confirm it is a reference, not a value.');
    }
  });

  // Staleness. A manifest that quietly stops being true is worse than none,
  // so decay is surfaced rather than assumed away.
  const checkVerified = (at, date, label) => {
    const age = daysBetween(date, now);
    if (age === null) return;
    if (age > STALE_AFTER_DAYS) {
      warn(at, `${label} last verified ${age} days ago. Re-confirm it is still true, then update last_verified.`);
    }
  };
  systems.forEach((s, i) => checkVerified(`systems[${i}] (${s.id})`, s.last_verified, 'System'));
  flows.forEach((f, i) => checkVerified(`flows[${i}] (${f.id})`, f.last_verified, 'Flow'));

  const manifestAge = daysBetween((manifest.manifest || {}).updated, now);
  if (manifestAge !== null && manifestAge > STALE_AFTER_DAYS) {
    warn('manifest.updated', `this manifest has not been revised in ${manifestAge} days.`);
  }

  // Time bombs: credential expiries and dated risks approaching or already past.
  const checkDeadline = (at, date, label) => {
    const remaining = date ? -daysBetween(date, now) : null;
    if (remaining === null) return;
    if (remaining < 0) err(at, `${label} passed ${Math.abs(remaining)} days ago (${date}).`);
    else if (remaining <= EXPIRY_WARN_DAYS) warn(at, `${label} in ${remaining} days (${date}).`);
  };
  systems.forEach((s, i) =>
    checkDeadline(`systems[${i}] (${s.id}).access.expires`, (s.access || {}).expires, 'Credential expires')
  );
  ((manifest.handoff || {}).risks || []).forEach((r, i) =>
    checkDeadline(`handoff.risks[${i}].trigger_date`, r.trigger_date, 'Risk trigger date')
  );

  // Handover smells. These are the findings the spec exists to make visible.
  flows.forEach((f, i) => {
    const notices = ((f.failure_mode || {}).who_notices || '').toLowerCase();
    if (/\b(nobody|no one|none|unknown)\b/.test(notices)) {
      warn(`flows[${i}] (${f.id})`, 'nobody is recorded as noticing this flow failing. Record it as a risk if it is genuinely unmonitored.');
    }
    if ((f.human_in_the_loop || []).length && !(manifest.handoff || {}).current_owner) {
      warn(`flows[${i}] (${f.id})`, 'has manual steps but the deployment has no recorded owner.');
    }
  });

  const touched = new Set(flows.flatMap((f) => f.systems || []));
  systems.forEach((s, i) => {
    if (!touched.has(s.id)) {
      note(`systems[${i}] (${s.id})`, 'is declared but no flow references it. Either a dependency worth explaining, or a leftover.');
    }
  });

  if (!(manifest.decisions || []).length && flows.length) {
    warn('decisions', 'flows are deployed but no decisions are recorded. The reasoning behind them is the part a successor cannot recover from the code.');
  }
  if (!(manifest.glossary || []).length) {
    warn('glossary', 'is empty. Client vocabulary is the most common thing an outsider silently misreads.');
  }

  return { errors, warnings, notes };
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
  const strict = args.includes('--strict');
  const files = args.filter((a) => !a.startsWith('--'));

  if (!files.length) {
    console.error('usage: node validate.js [--strict] <manifest.json> [...]');
    process.exit(2);
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const now = Date.now();
  let failed = false;

  for (const file of files) {
    console.log(`\n${file}`);

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.log(`\n  ✗ could not read or parse: ${e.message}`);
      failed = true;
      continue;
    }

    const schemaErrors = [];
    validateSchema(manifest, schema, schema, '$', schemaErrors);

    // Lint against a structurally broken manifest produces noise, not signal.
    const { errors, warnings, notes } = schemaErrors.length
      ? { errors: [], warnings: [], notes: [] }
      : lint(manifest, now);

    report('schema errors', schemaErrors, '✗');
    report('errors', errors, '✗');
    report('warnings', warnings, '!');
    report('notes', notes, '·');

    const hardErrors = schemaErrors.length + errors.length;
    if (hardErrors || (strict && warnings.length)) failed = true;
    if (!hardErrors && !warnings.length && !notes.length) console.log('\n  ✓ valid, and nothing to flag');
    else if (!hardErrors) console.log(`\n  ✓ valid${warnings.length ? ' — see warnings above' : ''}`);
  }

  console.log('');
  process.exit(failed ? 1 : 0);
}

main();
