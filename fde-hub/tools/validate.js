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
const PATTERN_SCHEMA_PATH = path.join(__dirname, '..', 'spec', 'flow-pattern.schema.json');
const STALE_AFTER_DAYS = 90;
const WALKTHROUGH_STALE_DAYS = 180;
const FIELD_REPORT_STALE_DAYS = 45;
const FIELD_REPORT_CLUSTER = 3;
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

  if (schema.anyOf) {
    const attempts = schema.anyOf.map((sub) => {
      const subErrors = [];
      validateSchema(value, sub, root, at, subErrors);
      return subErrors;
    });
    if (!attempts.some((e) => e.length === 0)) {
      errors.push(...attempts.reduce((a, b) => (b.length < a.length ? b : a)));
    }
    return;
  }

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

function lint(manifest, now, patternsById) {
  const errors = [];
  const warnings = [];
  const notes = [];

  const err = (at, message) => errors.push({ at, message });
  const warn = (at, message) => warnings.push({ at, message });
  const note = (at, message) => notes.push({ at, message });

  const systems = manifest.systems || [];
  const entities = manifest.entities || [];
  const flows = manifest.flows || [];
  const people = manifest.people || [];
  const peopleIds = new Set(people.map((p) => p.id));
  const displayName = (ref) => {
    const p = people.find((x) => x.id === ref);
    return p ? p.name : ref;
  };

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
    ['spaces', manifest.spaces || []],
    ['walkthroughs', manifest.walkthroughs || []],
    ['people', people],
    ['field_reports', manifest.field_reports || []],
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

  // People (spec 0.3): humans live in one registry; everything else points at it.
  const personField = (at, value) => {
    if (value === undefined) return;
    if (typeof value === 'string') {
      if (!peopleIds.has(value)) err(at, `references unknown person '${value}'`);
    } else if (people.length) {
      note(at, 'is an inline contact. Centralize this person in people[] and reference them by id — a staffing change should be one edit, not a scavenger hunt.');
    }
  };
  personField('manifest.maintainer', (manifest.manifest || {}).maintainer);
  systems.forEach((s, i) => personField(`systems[${i}] (${s.id}).system_owner`, s.system_owner));
  (manifest.spaces || []).forEach((s, i) => {
    personField(`spaces[${i}] (${s.id}).decision_maker`, s.decision_maker);
    personField(`spaces[${i}] (${s.id}).delegate`, s.delegate);
  });
  personField('handoff.current_owner', (manifest.handoff || {}).current_owner);

  const specVersion = (manifest.manifest || {}).spec_version;
  if (specVersion === '0.3' && !people.length) {
    err('people', 'spec 0.3 centralizes humans in the people registry — it is required and missing or empty.');
  }
  if (!people.length && !((manifest.client || {}).contacts || []).length) {
    warn('people', 'no humans are recorded anywhere. A manifest with no people in it is a dead document.');
  }
  if (people.length) {
    const referenced = new Set();
    const collect = (v) => {
      if (typeof v === 'string') referenced.add(v);
    };
    collect((manifest.manifest || {}).maintainer);
    systems.forEach((s) => collect(s.system_owner));
    (manifest.spaces || []).forEach((s) => {
      collect(s.decision_maker);
      collect(s.delegate);
    });
    collect((manifest.handoff || {}).current_owner);
    [...flows, ...systems].forEach((x) => (x.lineage || []).forEach((t) => collect(t.person)));
    people.forEach((p, i) => {
      if (!referenced.has(p.id)) {
        note(`people[${i}] (${p.id})`, 'is registered but nothing references them. Either a contact worth keeping context on, or a leftover.');
      }
    });
  }

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

  // Stewardship layer (spec 0.2): spaces, lineage, walkthroughs. Staffing is
  // where deployments actually die, so its gaps are surfaced like any other.
  const spaces = manifest.spaces || [];
  const walkthroughs = manifest.walkthroughs || [];
  const walkthroughIds = new Set(walkthroughs.map((w) => w.id));

  spaces.forEach((s, i) => {
    (s.flows || []).forEach((id, j) => ref(`spaces[${i}].flows[${j}]`, id, flowIds, 'flow'));
    (s.systems || []).forEach((id, j) => ref(`spaces[${i}].systems[${j}]`, id, systemIds, 'system'));
  });
  if (spaces.length) {
    const claimed = new Set(spaces.flatMap((s) => s.flows || []));
    flows.forEach((f, i) => {
      if (!claimed.has(f.id)) {
        warn(`flows[${i}] (${f.id})`, 'belongs to no space — no decision maker is on record for changes to it.');
      }
    });
  }

  walkthroughs.forEach((w, i) => {
    ((w.covers || {}).flows || []).forEach((id, j) =>
      ref(`walkthroughs[${i}].covers.flows[${j}]`, id, flowIds, 'flow')
    );
    ((w.covers || {}).systems || []).forEach((id, j) =>
      ref(`walkthroughs[${i}].covers.systems[${j}]`, id, systemIds, 'system')
    );
    const age = daysBetween(w.last_updated, now);
    if (age !== null && age > WALKTHROUGH_STALE_DAYS) {
      warn(
        `walkthroughs[${i}] (${w.id})`,
        `not updated in ${age} days. A stale walkthrough trains people wrong with confidence — re-verify it against the current system.`
      );
    }
  });

  const lintLineage = (at, lineage, hasHumanSteps) => {
    const open = [];
    (lineage || []).forEach((t, i) => {
      if (t.to !== undefined) {
        const span = daysBetween(t.from, Date.parse(`${t.to}T00:00:00Z`));
        if (span !== null && span < 0) {
          err(`${at}.lineage[${i}]`, `tenure ends (${t.to}) before it begins (${t.from})`);
        }
      } else {
        open.push(t);
      }
      if (t.trained_via !== undefined && !walkthroughIds.has(t.trained_via)) {
        err(`${at}.lineage[${i}]`, `trained_via references unknown walkthrough '${t.trained_via}'`);
      }
      if (people.length && !peopleIds.has(t.person)) {
        err(`${at}.lineage[${i}]`, `person '${t.person}' is not in the people registry`);
      }
      if (t.to === undefined && t.mode === 'inherited' && t.trained_via === undefined) {
        note(
          `${at}.lineage[${i}]`,
          `${displayName(t.person)} inherited '${t.role}' with no walkthrough on record. If the handover happened informally, that knowledge now exists only in conversation.`
        );
      }
    });
    if (lineage && lineage.length && !open.length) {
      warn(at, 'lineage records only closed tenures — every role here is currently unheld. That is an orphaned deployment, not a documentation gap.');
    }
    if (hasHumanSteps && open.length) {
      const operators = new Set(open.filter((t) => t.role !== 'steward').map((t) => displayName(t.person)));
      if (operators.size === 1) {
        note(at, `every human step runs through one person (${[...operators][0]}). The family tree shows no backup — a planned absence becomes an outage.`);
      }
    }
  };
  flows.forEach((f, i) => lintLineage(`flows[${i}] (${f.id})`, f.lineage, (f.human_in_the_loop || []).length > 0));
  systems.forEach((s, i) => lintLineage(`systems[${i}] (${s.id})`, s.lineage, false));

  // Role coverage: a flow's pattern declares the roles it needs to survive;
  // the family tree shows which are actually held. Requires --patterns <dir>.
  if (patternsById) {
    flows.forEach((f, i) => {
      if (!f.pattern) return;
      const p = patternsById[f.pattern];
      if (!p) {
        warn(`flows[${i}] (${f.id})`, `names pattern '${f.pattern}', which is not in the loaded pattern library.`);
        return;
      }
      const openRoles = new Set((f.lineage || []).filter((t) => t.to === undefined).map((t) => t.role));
      (p.human_roles || []).forEach((r) => {
        if (!openRoles.has(r.role)) {
          warn(
            `flows[${i}] (${f.id})`,
            `pattern '${p.id}' declares role '${r.role}' and no open tenure holds it. The pattern's position is that this flow does not survive without that role staffed.`
          );
        }
      });
      if (f.trigger && !((p.base_shape || {}).trigger_kinds || []).includes(f.trigger.kind)) {
        note(
          `flows[${i}] (${f.id})`,
          `trigger kind '${f.trigger.kind}' deviates from pattern '${p.id}' (${p.base_shape.trigger_kinds.join(', ')}). Deviations are data — record it in the pattern's instantiations.`
        );
      }
    });
  }

  if ((manifest.manifest || {}).spec_version === '0.2') {
    flows.forEach((f, i) => {
      if (!f.lineage || !f.lineage.length) {
        note(`flows[${i}] (${f.id})`, "has no lineage recorded. Even 'built and still held by the author' is worth a line — it is the start of the family tree.");
      }
    });
  }

  // Field reports (spec 0.4): the deployment's feedback channel. Feedback that
  // sits unanswered teaches people to stop reporting, so age and clustering
  // are surfaced alongside referential integrity.
  const reportsList = manifest.field_reports || [];
  const unresolvedByFlow = {};
  reportsList.forEach((r, i) => {
    const at = `field_reports[${i}] (${r.id})`;
    ref(`${at}.flow_id`, r.flow_id, flowIds, 'flow');
    ref(`${at}.system_id`, r.system_id, systemIds, 'system');
    if (people.length && r.reported_by && !peopleIds.has(r.reported_by)) {
      note(`${at}.reported_by`, `'${r.reported_by}' is not in the people registry. Register them if they will appear again; reporters deserve credit that survives.`);
    }
    const closed = r.status === 'resolved' || r.status === 'declined';
    if (closed && !r.resolution) {
      err(at, `status is '${r.status}' but no resolution is recorded. What was done, or why it will not be, is the part the next person needs.`);
    }
    if (!closed) {
      const age = daysBetween(r.date, now);
      if (age !== null && age > FIELD_REPORT_STALE_DAYS) {
        warn(at, `${r.kind} report open ${age} days with no resolution. Feedback that sits unanswered teaches people to stop reporting.`);
      }
      if (r.flow_id && (r.kind === 'bug' || r.kind === 'friction' || r.kind === 'gap')) {
        unresolvedByFlow[r.flow_id] = (unresolvedByFlow[r.flow_id] || 0) + 1;
      }
    }
  });
  for (const [flowId, count] of Object.entries(unresolvedByFlow)) {
    if (count >= FIELD_REPORT_CLUSTER) {
      warn(`field_reports (flow ${flowId})`, `${count} unresolved reports against one flow. A cluster is a redesign signal, not a ticket backlog.`);
    }
  }

  return { errors, warnings, notes };
}

// Pattern files get a lighter pass: schema conformance plus the checks that
// keep a pattern honest about itself.
function lintPattern(pattern) {
  const errors = [];
  const warnings = [];
  const notes = [];

  const seen = new Set();
  (pattern.variation_points || []).forEach((v, i) => {
    if (seen.has(v.id)) errors.push({ at: `variation_points[${i}]`, message: `duplicate id '${v.id}'` });
    seen.add(v.id);
    const choices = (v.options || []).map((o) => o.choice);
    if (v.default !== undefined && !choices.includes(v.default)) {
      errors.push({
        at: `variation_points[${i}] (${v.id})`,
        message: `default '${v.default}' is not one of the listed options (${choices.join(', ')})`,
      });
    }
  });

  if ((pattern.maturity || {}).status === 'provisional') {
    notes.push({ at: 'maturity', message: 'provisional — designed, not yet extracted from a shipped deployment. Treat every default as a hypothesis.' });
  }
  if (!(pattern.instantiations || []).length) {
    notes.push({ at: 'instantiations', message: 'no instantiations recorded. A pattern with no deployments behind it is a sketch; say so when reaching for it.' });
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
  const patternsIdx = args.indexOf('--patterns');
  const patternsDir = patternsIdx >= 0 ? args[patternsIdx + 1] : null;
  const files = args.filter((a, i) => !a.startsWith('--') && (patternsIdx < 0 || i !== patternsIdx + 1));

  if (!files.length) {
    console.error('usage: node validate.js [--strict] [--patterns <dir>] <manifest-or-pattern.json> [...]');
    console.error('       pattern files are detected by their pattern_version field');
    console.error('       --patterns enables role-coverage checks on manifests whose flows name a pattern');
    process.exit(2);
  }

  let patternsById = null;
  if (patternsDir) {
    patternsById = {};
    for (const f of fs.readdirSync(patternsDir).filter((n) => n.endsWith('.pattern.json'))) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(patternsDir, f), 'utf8'));
        if (p.id) patternsById[p.id] = p;
      } catch (e) {
        console.error(`skipping unreadable pattern ${f}: ${e.message}`);
      }
    }
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const patternSchema = JSON.parse(fs.readFileSync(PATTERN_SCHEMA_PATH, 'utf8'));
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

    const isPattern = manifest.pattern_version !== undefined;
    const activeSchema = isPattern ? patternSchema : schema;
    const schemaErrors = [];
    validateSchema(manifest, activeSchema, activeSchema, '$', schemaErrors);

    // Lint against a structurally broken document produces noise, not signal.
    const { errors, warnings, notes } = schemaErrors.length
      ? { errors: [], warnings: [], notes: [] }
      : isPattern
        ? lintPattern(manifest)
        : lint(manifest, now, patternsById);

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
