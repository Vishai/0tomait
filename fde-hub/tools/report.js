#!/usr/bin/env node
/**
 * Field report intake.
 *
 * Files an observation from the field into a deployment manifest: a bug, a
 * friction point, a gap, a usage note, or an idea. The point of a CLI is that
 * recording feedback becomes one command instead of hand-editing JSON, which
 * is the difference between feedback that gets captured and feedback that
 * evaporates in a Slack thread.
 *
 *   # file a report
 *   node fde-hub/tools/report.js <manifest.json> --kind friction --by marcus-bell \
 *     --flow pod-intake --channel "morning queue session" \
 *     "Handwritten load numbers are most of the queue and take the longest per item"
 *
 *   # see what is open
 *   node fde-hub/tools/report.js <manifest.json> --list
 *
 *   # close the loop
 *   node fde-hub/tools/report.js <manifest.json> --resolve fr-20260710-1 "Asked top carriers to add load numbers to subject lines"
 *   node fde-hub/tools/report.js <manifest.json> --decline fr-20260710-2 "Rebuild not worth it at current volume; revisit if it doubles"
 *
 * Zero dependencies, to match the rest of this repository.
 */

const fs = require('fs');

const KINDS = ['bug', 'friction', 'gap', 'usage', 'idea'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadManifest(path) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`could not read or parse ${path}: ${e.message}`);
    process.exit(1);
  }
  if (manifest.manifest === undefined) {
    console.error(`${path} does not look like a deployment manifest.`);
    process.exit(1);
  }
  return manifest;
}

function saveManifest(path, manifest) {
  manifest.manifest.updated = today();
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
}

function nextId(reports) {
  const stamp = today().replace(/-/g, '');
  const taken = new Set(reports.map((r) => r.id));
  let n = 1;
  while (taken.has(`fr-${stamp}-${n}`)) n++;
  return `fr-${stamp}-${n}`;
}

function opt(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function listReports(manifest) {
  const reports = manifest.field_reports || [];
  if (!reports.length) {
    console.log('no field reports recorded');
    return;
  }
  const open = reports.filter((r) => r.status === 'open' || r.status === 'acknowledged');
  const closed = reports.length - open.length;
  for (const r of open) {
    const where = r.flow_id ? ` [flow ${r.flow_id}]` : r.system_id ? ` [system ${r.system_id}]` : '';
    console.log(`${r.id}  ${r.status.padEnd(12)} ${r.kind.padEnd(8)} ${r.date}${where}`);
    console.log(`    ${r.report}`);
    console.log(`    reported by ${r.reported_by}${r.channel ? ` via ${r.channel}` : ''}`);
  }
  console.log(`\n${open.length} open, ${closed} closed`);
}

function closeReport(path, manifest, id, status, resolution) {
  if (!resolution) {
    console.error(`--${status === 'resolved' ? 'resolve' : 'decline'} needs the resolution text: what was done, or why it will not be.`);
    process.exit(2);
  }
  const report = (manifest.field_reports || []).find((r) => r.id === id);
  if (!report) {
    console.error(`no field report with id '${id}'. Use --list to see what exists.`);
    process.exit(1);
  }
  report.status = status;
  report.resolution = resolution;
  report.resolved_on = today();
  saveManifest(path, manifest);
  console.log(`${id} ${status}: ${resolution}`);
}

function addReport(path, manifest, args, text) {
  const kind = opt(args, '--kind');
  const by = opt(args, '--by');
  const flow = opt(args, '--flow');
  const system = opt(args, '--system');
  const channel = opt(args, '--channel');

  if (!KINDS.includes(kind)) {
    console.error(`--kind must be one of: ${KINDS.join(', ')}`);
    process.exit(2);
  }
  if (!by) {
    console.error('--by is required: who observed this. Credit the operator, even when the steward is typing.');
    process.exit(2);
  }
  if (!text || text.length < 15) {
    console.error('the report text is required and should say what was actually observed.');
    process.exit(2);
  }

  const flows = new Set((manifest.flows || []).map((f) => f.id));
  const systems = new Set((manifest.systems || []).map((s) => s.id));
  if (flow && !flows.has(flow)) {
    console.error(`unknown flow '${flow}'. Declared flows: ${[...flows].join(', ')}`);
    process.exit(1);
  }
  if (system && !systems.has(system)) {
    console.error(`unknown system '${system}'. Declared systems: ${[...systems].join(', ')}`);
    process.exit(1);
  }
  const peopleIds = new Set((manifest.people || []).map((p) => p.id));
  if (peopleIds.size && !peopleIds.has(by)) {
    console.error(`note: '${by}' is not in the people registry; the validator will flag it. Register them if they will appear again.`);
  }

  manifest.field_reports = manifest.field_reports || [];
  const entry = {
    id: nextId(manifest.field_reports),
    date: today(),
    kind,
    reported_by: by,
    ...(channel ? { channel } : {}),
    report: text,
    ...(flow ? { flow_id: flow } : {}),
    ...(system ? { system_id: system } : {}),
    status: 'open',
  };
  manifest.field_reports.push(entry);
  saveManifest(path, manifest);
  console.log(`filed ${entry.id} (${kind}${flow ? `, flow ${flow}` : ''})`);
}

function main() {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
  if (!path) {
    console.error('usage: node report.js <manifest.json> [--list | --resolve <id> "text" | --decline <id> "text" | --kind <kind> --by <person> [--flow <id>] [--system <id>] [--channel "..."] "report text"]');
    process.exit(2);
  }
  const manifest = loadManifest(path);

  if (args.includes('--list')) return listReports(manifest);

  const resolveId = opt(args, '--resolve');
  const declineId = opt(args, '--decline');
  const flagValues = new Set(
    ['--kind', '--by', '--flow', '--system', '--channel', '--resolve', '--decline']
      .map((f) => opt(args, f))
      .filter(Boolean)
  );
  const text = args.find((a) => !a.startsWith('--') && a !== path && !flagValues.has(a));

  if (resolveId) return closeReport(path, manifest, resolveId, 'resolved', text);
  if (declineId) return closeReport(path, manifest, declineId, 'declined', text);
  return addReport(path, manifest, args, text);
}

main();
