#!/usr/bin/env node
/**
 * Agent briefing compiler.
 *
 * Compiles a deployment manifest into a context pack for a maintenance agent —
 * the CLAUDE.md-style briefing that turns "an agent with repo access" into "an
 * agent that knows the client". Constraints become imperatives, spaces become
 * approval rules, gotchas become warnings, known exceptions become do-not-fix
 * markers, and the glossary becomes vocabulary.
 *
 * This is the operational half of the fde-hub thesis: maintenance agents are
 * bottlenecked on context, not capability. The manifest holds the context;
 * this tool puts it in front of the agent.
 *
 *   node fde-hub/tools/brief.js fde-hub/examples/meridian-freight.manifest.json
 *   node fde-hub/tools/brief.js <manifest.json> --out CLAUDE.md
 *
 * Zero dependencies, to match the rest of this repository.
 */

const fs = require('fs');

const STALE_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function makePersonResolver(manifest) {
  const people = manifest.people || [];
  return (ref) => {
    if (ref === undefined) return null;
    if (typeof ref === 'string') {
      const p = people.find((x) => x.id === ref);
      return p || { name: ref, role: '' };
    }
    return ref; // legacy inline contact
  };
}

function personLine(p) {
  if (!p) return 'unrecorded';
  const org = p.org ? ` (${p.org})` : '';
  const notes = p.notes ? ` ${p.notes}` : '';
  return `**${p.name}**${org} — ${p.role}.${notes}`;
}

function ageDays(iso, now) {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.round((now - t) / DAY_MS);
}

function compile(manifest, sourcePath) {
  const person = makePersonResolver(manifest);
  const now = Date.now();
  const L = [];
  const add = (s = '') => L.push(s);

  const systems = manifest.systems || [];
  const flows = manifest.flows || [];
  const systemName = (id) => {
    const s = systems.find((x) => x.id === id);
    return s ? s.name : id;
  };

  const c = manifest.client || {};
  add(`# Agent briefing — ${c.name || 'unknown client'}`);
  add();
  add(`> Compiled from the deployment manifest (\`${sourcePath}\`, updated ${(manifest.manifest || {}).updated || 'unknown'}).`);
  add('> The manifest is the source of truth and this briefing is a lossy view of it. When they disagree, trust the manifest — then fix whichever one is wrong.');
  add();

  // --- Context ---------------------------------------------------------------
  add('## Who you are working for');
  add();
  add(c.business_summary || '');
  add();
  if (c.timezone || c.operating_hours) {
    add(`Timezone ${c.timezone || 'unknown'}. ${c.operating_hours || ''}`.trim());
    add();
  }
  const e = manifest.engagement || {};
  if (e.status || e.support_posture) {
    add(`Engagement status: **${e.status || 'unknown'}**. ${e.support_posture || ''}`.trim());
    add();
  }
  if (e.budget_notes) {
    add(`Commercial context: ${e.budget_notes}`);
    add();
  }

  // --- Hard rules ------------------------------------------------------------
  const constraints = manifest.constraints || [];
  if (constraints.length) {
    add('## Hard rules — never violate these');
    add();
    for (const k of constraints) {
      add(`- **${k.rule}** (${k.kind}) — ${k.consequence}${k.source ? ` *[source: ${k.source}]*` : ''}`);
    }
    add();
  }

  // --- Approval boundaries ---------------------------------------------------
  const spaces = manifest.spaces || [];
  if (spaces.length) {
    add('## Before you change anything: approval boundaries');
    add();
    add('Every part of this deployment belongs to a space with a named decision maker. A change you cannot place confidently inside a delegate\'s authority goes to the decision maker — stop and ask rather than inferring permission.');
    add();
    for (const s of spaces) {
      add(`### ${s.name}`);
      add();
      add(s.purpose);
      add();
      add(`- Decision maker: ${personLine(person(s.decision_maker))}`);
      if (s.delegate) add(`- Delegate: ${personLine(person(s.delegate))}`);
      const contents = [
        ...(s.flows || []).map((id) => `flow \`${id}\``),
        ...(s.systems || []).map((id) => `system \`${id}\``),
      ];
      if (contents.length) add(`- Covers: ${contents.join(', ')}`);
      if (s.notes) add(`- ${s.notes}`);
      add();
    }
  }

  // --- Conduct ---------------------------------------------------------------
  add('## Your conduct as maintainer');
  add();
  add('- Never write a secret value anywhere — not in code, config, commit messages, or this manifest. The manifest stores pointers to secrets, only.');
  add('- When you verify that a system or flow entry still matches reality, update its `last_verified` date in the manifest. When you change a flow, update its manifest entry in the same change.');
  add('- When you choose between real alternatives, record it in `decisions[]` with the rejected options and a revisit condition — the reasoning is the part the next maintainer cannot recover from your code.');
  add('- Deploy only through the named runbook procedures, inside the change windows above.');
  add('- Entries under `known_exceptions` are deliberate carve-outs, each with recorded reasoning. Do not "fix" them without reading the linked decision and getting the space owner\'s approval.');
  add('- If a person named in this briefing has changed roles or left, update the lineage before relying on any staffing assumption here.');
  add();

  // --- Systems ---------------------------------------------------------------
  if (systems.length) {
    add('## Systems you will touch');
    add();
    for (const s of systems) {
      add(`### ${s.name} (\`${s.id}\`, ${s.criticality})`);
      add();
      add(s.purpose);
      add();
      if (s.system_owner) add(`- Owner: ${personLine(person(s.system_owner))}`);
      if (s.access) {
        add(`- Access: ${s.access.method}; credential at \`${s.access.secret_location}\`${s.access.expires ? ` — **expires ${s.access.expires}**` : ''}`);
      }
      const age = s.last_verified ? ageDays(s.last_verified, now) : null;
      add(`- Last verified ${s.last_verified || 'never'}${age !== null && age > STALE_AFTER_DAYS ? ` — **STALE (${age} days): re-verify before relying on this entry**` : ''}`);
      for (const g of s.gotchas || []) add(`- ⚠ ${g}`);
      add();
    }
  }

  // --- Data ------------------------------------------------------------------
  const entities = manifest.entities || [];
  if (entities.length) {
    add('## Data: the objects and their traps');
    add();
    for (const en of entities) {
      add(`### ${en.name} (\`${en.id}\`)`);
      add();
      add(en.definition);
      add();
      add(`- Join on: ${en.identifier}`);
      add(`- Source of truth: ${systemName(en.source_of_truth)}${(en.also_lives_in || []).length ? `; copies in ${en.also_lives_in.map(systemName).join(', ')}` : ''}`);
      if (en.sensitivity) add(`- Sensitivity: ${en.sensitivity}`);
      for (const q of en.quirks || []) add(`- ⚠ ${q}`);
      add();
    }
  }

  // --- Flows -----------------------------------------------------------------
  if (flows.length) {
    add('## Deployed flows');
    add();
    for (const f of flows) {
      add(`### ${f.name} (\`${f.id}\`${f.pattern ? `, pattern \`${f.pattern}\`` : ''})`);
      add();
      add(f.business_purpose);
      add();
      if (f.trigger) add(`- Trigger: ${f.trigger.kind} — ${f.trigger.detail}`);
      if (f.code) add(`- Code: ${f.code.location}${f.code.deploy_procedure ? `; deploy via runbook procedure "${f.code.deploy_procedure}"` : ''}`);
      const fm = f.failure_mode || {};
      if (fm.on_failure) add(`- On failure: ${fm.on_failure} Noticed by: ${fm.who_notices || 'unrecorded'}${fm.tolerable_downtime ? ` Tolerable downtime: ${fm.tolerable_downtime}` : ''}`);
      const open = (f.lineage || []).filter((t) => t.to === undefined);
      if (open.length) {
        add(`- Currently staffed: ${open.map((t) => `${t.role} → ${(person(t.person) || {}).name || t.person}`).join('; ')}`);
      }
      for (const h of f.human_in_the_loop || []) add(`- Human step: ${h}`);
      for (const x of f.known_exceptions || []) add(`- Deliberate exception (do not fix): ${x}`);
      add();
    }
  }

  // --- Settled decisions -----------------------------------------------------
  const decisions = manifest.decisions || [];
  if (decisions.length) {
    add('## Settled decisions — do not reverse casually');
    add();
    add('Each of these was made against real alternatives, recorded in the manifest with the reasoning. Reopen one only when its revisit condition holds, and record the reopening as a new decision.');
    add();
    for (const d of decisions) {
      add(`- **${d.decision}** Reopen when: ${d.revisit_when || 'no condition recorded — treat as firm'}`);
    }
    add();
  }

  // --- When things break -----------------------------------------------------
  const rb = manifest.runbook || {};
  if ((rb.known_failures || []).length) {
    add('## When things break: known failures');
    add();
    add('| Symptom | Cause | Fix |');
    add('| --- | --- | --- |');
    for (const k of rb.known_failures) add(`| ${k.symptom} | ${k.cause} | ${k.fix} |`);
    add();
  }
  if ((rb.procedures || []).length) {
    add('Runbook procedures (full steps in the manifest):');
    add();
    for (const p of rb.procedures) add(`- **${p.name}** — ${p.when}${p.risk ? ` *Risk: ${p.risk}*` : ''}`);
    add();
  }
  if ((rb.observability || {}).logs) {
    add(`Logs: ${rb.observability.logs} Alerting: ${rb.observability.alerting || 'unrecorded'}`);
    add();
  }

  // --- Dates that matter -----------------------------------------------------
  const dates = [];
  systems.forEach((s) => {
    if ((s.access || {}).expires) dates.push({ date: s.access.expires, what: `credential for ${s.name} expires` });
  });
  ((manifest.handoff || {}).risks || []).forEach((r) => {
    if (r.trigger_date) dates.push({ date: r.trigger_date, what: r.risk });
  });
  if (dates.length) {
    dates.sort((a, b) => (a.date < b.date ? -1 : 1));
    add('## Dates that matter');
    add();
    for (const d of dates) add(`- **${d.date}** — ${d.what}`);
    add();
  }

  // --- Open field reports ----------------------------------------------------
  const openReports = (manifest.field_reports || []).filter(
    (r) => r.status === 'open' || r.status === 'acknowledged'
  );
  if (openReports.length) {
    add('## Known friction: open field reports');
    add();
    add('These came from the people who operate the system. Treat them as the most current information in this briefing, and close the loop in the manifest when you act on one.');
    add();
    for (const r of openReports) {
      const who = (person(r.reported_by) || {}).name || r.reported_by;
      const where = r.flow_id ? ` (flow \`${r.flow_id}\`)` : r.system_id ? ` (system \`${r.system_id}\`)` : '';
      add(`- **${r.kind}**${where}: ${r.report} *(${who}, ${r.date})*`);
    }
    add();
  }

  // --- Handoff state ---------------------------------------------------------
  const h = manifest.handoff || {};
  if ((h.blast_radius_notes || '').length) {
    add('## Blast radius — coupling the code will not show you');
    add();
    add(h.blast_radius_notes);
    add();
  }
  if ((h.debt || []).length) {
    add('Known debt (each was a deliberate trade — the manifest records why):');
    add();
    for (const d of h.debt) add(`- ${d.what} *Cost to fix: ${d.cost_to_fix}*`);
    add();
  }

  // --- Vocabulary ------------------------------------------------------------
  const glossary = manifest.glossary || [];
  if (glossary.length) {
    add('## Vocabulary — what words mean in this building');
    add();
    add('| Term | Means here | Not to be confused with |');
    add('| --- | --- | --- |');
    for (const g of glossary) add(`| ${g.term} | ${g.means} | ${g.not_to_be_confused_with || ''} |`);
    add();
  }

  return L.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const files = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));

  if (files.length !== 1) {
    console.error('usage: node brief.js <manifest.json> [--out CLAUDE.md]');
    process.exit(2);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(files[0], 'utf8'));
  } catch (err) {
    console.error(`could not read or parse ${files[0]}: ${err.message}`);
    process.exit(1);
  }
  if (manifest.pattern_version !== undefined || manifest.manifest === undefined) {
    console.error(`${files[0]} does not look like a deployment manifest. Validate it first.`);
    process.exit(1);
  }

  const md = compile(manifest, files[0]);
  if (outPath) {
    fs.writeFileSync(outPath, md);
    console.error(`wrote ${outPath}`);
  } else {
    console.log(md);
  }
}

main();
