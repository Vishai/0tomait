#!/usr/bin/env node
/**
 * Flow workbook generator.
 *
 * Takes a flow pattern and emits the engagement workbook for instantiating it
 * at a client: the fit check, the glue interview, the variation decisions, the
 * staffing plan, and a starter manifest fragment. Markdown out.
 *
 * The workbook is the bridge between the pattern library (stable, generic) and
 * the deployment manifest (specific, alive). Everything it asks for has a home
 * in the manifest — filling in the workbook IS drafting the manifest entries.
 *
 *   node fde-hub/tools/scaffold.js fde-hub/patterns/document-intake-match.pattern.json
 *   node fde-hub/tools/scaffold.js <pattern.json> --out workbook.md
 *
 * Zero dependencies, to match the rest of this repository.
 */

const fs = require('fs');

function starterFragment(p) {
  const operationalRoles = p.human_roles.filter((r) => r.role !== 'steward');
  return {
    id: 'todo-flow-id',
    name: 'TODO',
    pattern: p.id,
    business_purpose: 'TODO — the job this does for the client, in their language, not yours',
    trigger: { kind: p.base_shape.trigger_kinds[0], detail: 'TODO' },
    steps: p.base_shape.steps,
    systems: ['todo-system-id'],
    entities: ['todo-entity-id'],
    code: {
      location: 'TODO — repository and path, or platform and project',
      runtime: 'TODO — where it executes',
      deploy_procedure: 'TODO — must name a runbook procedure',
    },
    human_in_the_loop: operationalRoles.map((r) => `TODO — where the ${r.role} acts, and what happens when they are away`),
    lineage: [
      { role: 'steward', person: 'TODO', from: 'TODO', mode: 'built' },
      ...operationalRoles.map((r) => ({
        role: r.role,
        person: 'TODO',
        from: 'TODO',
        mode: 'inherited',
        trained_via: 'todo-walkthrough-id',
      })),
    ],
    failure_mode: {
      on_failure: 'TODO — retry, queue, halt, or fall back to manual',
      who_notices: "TODO — a named person or channel; 'nobody' is a finding",
      tolerable_downtime: 'TODO — how long before the business feels it',
    },
    known_exceptions: [],
    last_verified: 'TODO',
  };
}

function workbook(p) {
  const L = [];
  const add = (s = '') => L.push(s);

  add(`# Flow workbook — ${p.name}`);
  add();
  add(`Pattern: \`${p.id}\` · Maturity: **${p.maturity.status}** — ${p.maturity.evidence}`);
  add();
  add(`> ${p.problem}`);
  add();

  add('## Fit check');
  add();
  add('Most of these should be true at the client before going further:');
  add();
  for (const s of p.signals) add(`- [ ] ${s}`);
  add();
  add('If **any** of these is true, stop — this pattern looks right and is wrong:');
  add();
  for (const s of p.not_for) add(`- ${s}`);
  add();

  add('## 1 · The glue interview');
  add();
  add('The client-specific 20%. Every answer has a home in the manifest — write it there, not here.');
  add();
  add('| Question | Why it matters | Record it in |');
  add('| --- | --- | --- |');
  for (const g of p.glue_checklist) add(`| ${g.question} | ${g.why_it_matters} | \`${g.recorded_in}\` |`);
  add();

  add('## 2 · Variation decisions');
  add();
  add('Each choice becomes a manifest decision — record the rejected options and a revisit condition.');
  add();
  for (const v of p.variation_points) {
    add(`### ${v.question}`);
    add();
    add('| Choice | When it is right | What it costs |');
    add('| --- | --- | --- |');
    for (const o of v.options) add(`| \`${o.choice}\` | ${o.when} | ${o.consequence} |`);
    add();
    add(`**Default:** \`${v.default}\` — ${v.default_because}`);
    add();
  }

  add('## 3 · Staffing');
  add();
  add('Roles are the stable unit; people hold them as tenures in the flow\'s lineage. For each role: open a tenure, name the holder, and build the walkthrough before you need it — not after the person leaves.');
  add();
  for (const r of p.human_roles) {
    add(`### ${r.role}`);
    add();
    add(`${r.does} *(${r.cadence})*`);
    add();
    add('The transition walkthrough must cover:');
    add();
    for (const c of r.transition_walkthrough_must_cover) add(`- [ ] ${c}`);
    add();
  }

  add('## 4 · Failure design');
  add();
  add('Pre-answered — adapt the responses, do not rediscover the failures in production.');
  add();
  add('| Failure | Design response |');
  add('| --- | --- |');
  for (const f of p.failure_design) add(`| ${f.failure} | ${f.response} |`);
  add();

  add('## 5 · Manifest obligations');
  add();
  add(`- **Systems:** ${p.manifest_bindings.systems}`);
  add(`- **Entities:** ${p.manifest_bindings.entities}`);
  add();
  add('Decisions you will inevitably make — record them the day you make them:');
  add();
  add('| Topic | The tension |');
  add('| --- | --- |');
  for (const d of p.manifest_bindings.decisions_expected) add(`| ${d.topic} | ${d.tension} |`);
  add();
  if ((p.manifest_bindings.constraints_expected || []).length) {
    add('Constraints to expect:');
    add();
    for (const c of p.manifest_bindings.constraints_expected) add(`- ${c}`);
    add();
  }

  add('## 6 · Metrics to baseline before building');
  add();
  add('| Metric | Should move | Note |');
  add('| --- | --- | --- |');
  for (const m of p.metrics) add(`| ${m.metric} | ${m.direction} | ${m.note || ''} |`);
  add();

  add('## 7 · Starter flow entry');
  add();
  add('Paste into the client manifest and replace every TODO. The fragment fails validation until each one is resolved — that is the point: the validator is the checklist.');
  add();
  add('```json');
  add(JSON.stringify(starterFragment(p), null, 2));
  add('```');
  add();

  add('## Prior instantiations');
  add();
  if ((p.instantiations || []).length) {
    for (const inst of p.instantiations) {
      add(`**${inst.client}** — flow \`${inst.flow_id}\` in \`${inst.manifest}\``);
      add();
      for (const d of inst.deviations || []) add(`- ${d}`);
      add();
    }
    add('Expect to deviate too — and record your deviations back into the pattern. Three instantiations deviating the same way means the pattern is wrong, not the clients.');
  } else {
    add('None recorded. This pattern is a hypothesis — record yours as its first evidence.');
  }
  add();

  return L.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const files = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));

  if (files.length !== 1) {
    console.error('usage: node scaffold.js <pattern.json> [--out workbook.md]');
    process.exit(2);
  }

  let pattern;
  try {
    pattern = JSON.parse(fs.readFileSync(files[0], 'utf8'));
  } catch (e) {
    console.error(`could not read or parse ${files[0]}: ${e.message}`);
    process.exit(1);
  }
  if (pattern.pattern_version === undefined) {
    console.error(`${files[0]} is not a flow pattern (no pattern_version field). Validate it first.`);
    process.exit(1);
  }

  const md = workbook(pattern);
  if (outPath) {
    fs.writeFileSync(outPath, md);
    console.error(`wrote ${outPath}`);
  } else {
    console.log(md);
  }
}

main();
