#!/usr/bin/env node
/**
 * Briefing eval runner.
 *
 * Compiles the agent briefing from a manifest, then sends each eval case to a
 * fresh `claude -p` invocation whose only context is that briefing plus the
 * case prompt. Outputs land in evals/results/<date>/ for grading against the
 * expectations in cases.json.
 *
 * Grading stays human (or a separate grading agent): the expectations include
 * judgment calls that keyword matching would flatten.
 *
 *   node fde-hub/evals/run.js                       # all cases
 *   node fde-hub/evals/run.js gate-removal          # one case
 *   node fde-hub/evals/run.js --control gate-removal  # control run, no briefing
 *
 * Requires the Claude Code CLI (`claude`) on PATH. Zero other dependencies.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const MANIFEST = path.join(ROOT, 'examples', 'meridian-freight.manifest.json');

function compileBriefing() {
  return execFileSync('node', [path.join(ROOT, 'tools', 'brief.js'), MANIFEST], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

function buildPrompt(c, briefing) {
  const header =
    'You are a maintenance engineer who has just inherited a client deployment. ' +
    'The briefing below is your ONLY source of knowledge about this client. ' +
    'Do not use tools, do not search, do not read files. Answer from the briefing alone.\n\n';
  const task = `\n\nREQUEST:\n${c.prompt}\n\nRespond with: ${c.ask_for} Concrete and under 250 words.`;
  if (!briefing) {
    return header + '=== BRIEFING START ===\n(no briefing available)\n=== BRIEFING END ===' + task;
  }
  return header + '=== BRIEFING START ===\n' + briefing + '\n=== BRIEFING END ===' + task;
}

function main() {
  const args = process.argv.slice(2);
  const control = args.includes('--control');
  const wanted = args.filter((a) => !a.startsWith('--'));
  const cases = CASES.cases.filter((c) => !wanted.length || wanted.includes(c.id));
  if (!cases.length) {
    console.error(`no matching cases. Available: ${CASES.cases.map((c) => c.id).join(', ')}`);
    process.exit(2);
  }

  const briefing = control ? null : compileBriefing();
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = path.join(__dirname, 'results', stamp + (control ? '-control' : ''));
  fs.mkdirSync(outDir, { recursive: true });

  for (const c of cases) {
    process.stderr.write(`running ${c.id}${control ? ' (control)' : ''}...\n`);
    let answer;
    try {
      answer = execFileSync('claude', ['-p', buildPrompt(c, briefing)], {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        timeout: 300000,
      });
    } catch (e) {
      answer = `RUN FAILED: ${e.message}`;
    }
    const out = [
      `# ${c.id}${control ? ' (control: no briefing)' : ''}`,
      '',
      `Probes: ${c.probes}`,
      '',
      '## Prompt',
      '',
      c.prompt,
      '',
      '## Agent response',
      '',
      answer.trim(),
      '',
      '## Grade against cases.json expectations',
      '',
      '- Verdict expected: ' + c.expect.verdict,
      '- Must cite: ' + c.expect.must_cite.join('; '),
      '- Result: PASS / FAIL / PARTIAL (grader fills in, with evidence)',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(outDir, `${c.id}.md`), out);
  }
  console.log(`results in ${outDir}; grade each file against cases.json`);
}

main();
