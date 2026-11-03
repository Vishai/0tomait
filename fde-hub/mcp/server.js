#!/usr/bin/env node
/**
 * fde-hub MCP server.
 *
 * Exposes the deployment-manifest toolchain over the Model Context Protocol
 * (stdio transport), so any MCP-capable agent can validate a manifest, compile
 * the agent briefing, scaffold a pattern workbook, and read or file field
 * reports as first-class tools instead of shell commands.
 *
 * This is the thesis as infrastructure: the manifest holds the context agents
 * are starved for, and this server is the socket they plug into.
 *
 * Register with Claude Code:
 *   claude mcp add fde-hub -- node /absolute/path/to/fde-hub/mcp/server.js
 *
 * Zero dependencies. Implements the stdio framing and the methods agents use:
 * initialize, tools/list, tools/call, ping.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const HUB = path.join(__dirname, '..');
const TOOLS_DIR = path.join(HUB, 'tools');
const DEFAULT_MANIFEST = path.join(HUB, 'examples', 'meridian-freight.manifest.json');
const PATTERNS_DIR = path.join(HUB, 'patterns');

const PROTOCOL_VERSION = '2024-11-05';

// ---------------------------------------------------------------------------
// Tool implementations: thin wrappers over the existing zero-dep CLIs, so the
// MCP surface and the command line can never drift apart.
// ---------------------------------------------------------------------------

function runTool(script, args) {
  try {
    const out = execFileSync('node', [path.join(TOOLS_DIR, script), ...args], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60000,
    });
    return { text: out.trim() || '(no output)', isError: false };
  } catch (e) {
    const detail = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
    return { text: detail || e.message, isError: e.status !== 0 && e.status !== undefined ? true : true };
  }
}

function resolveManifest(p) {
  const resolved = p ? path.resolve(p) : DEFAULT_MANIFEST;
  if (!fs.existsSync(resolved)) {
    return { error: `manifest not found: ${resolved}` };
  }
  return { path: resolved };
}

const TOOLS = [
  {
    name: 'validate_manifest',
    description:
      'Validate a deployment manifest: schema, referential integrity, staleness, credential leakage, time bombs, staffing smells, feedback hygiene, and (always, via the bundled pattern library) role coverage. Returns the findings. Exit state is reflected in isError.',
    inputSchema: {
      type: 'object',
      properties: {
        manifest_path: {
          type: 'string',
          description: 'Path to the manifest JSON. Omit for the bundled reference example.',
        },
        strict: { type: 'boolean', description: 'Treat warnings as failures.' },
      },
    },
    run(args) {
      const m = resolveManifest(args.manifest_path);
      if (m.error) return { text: m.error, isError: true };
      const a = ['--patterns', PATTERNS_DIR, m.path];
      if (args.strict) a.unshift('--strict');
      return runTool('validate.js', a);
    },
  },
  {
    name: 'compile_briefing',
    description:
      'Compile a deployment manifest into the agent briefing: the context pack a maintenance agent works from. Constraints become hard rules, spaces become approval boundaries, open field reports surface as current friction. Returns the briefing as markdown.',
    inputSchema: {
      type: 'object',
      properties: {
        manifest_path: {
          type: 'string',
          description: 'Path to the manifest JSON. Omit for the bundled reference example.',
        },
      },
    },
    run(args) {
      const m = resolveManifest(args.manifest_path);
      if (m.error) return { text: m.error, isError: true };
      return runTool('brief.js', [m.path]);
    },
  },
  {
    name: 'list_field_reports',
    description:
      'List the open field reports on a deployment manifest: the bugs, friction, gaps, and usage notes operators have filed, with status. The most current information about a deployment.',
    inputSchema: {
      type: 'object',
      properties: {
        manifest_path: {
          type: 'string',
          description: 'Path to the manifest JSON. Omit for the bundled reference example.',
        },
      },
    },
    run(args) {
      const m = resolveManifest(args.manifest_path);
      if (m.error) return { text: m.error, isError: true };
      return runTool('report.js', [m.path, '--list']);
    },
  },
  {
    name: 'file_field_report',
    description:
      'File a field report into a deployment manifest: an observation from operating the system. Credits the reporter, keeps their words, opens the lifecycle. Writes to the manifest file.',
    inputSchema: {
      type: 'object',
      properties: {
        manifest_path: {
          type: 'string',
          description: 'Path to the manifest JSON. Omit for the bundled reference example.',
        },
        kind: {
          type: 'string',
          enum: ['bug', 'friction', 'gap', 'usage', 'idea'],
          description: 'bug: misbehaves. friction: works but fights the user. gap: should cover and does not. usage: observation. idea: suggestion.',
        },
        reported_by: {
          type: 'string',
          description: "Person id from the manifest's people registry, or a name.",
        },
        report: {
          type: 'string',
          description: "What was observed, close to the reporter's own words.",
        },
        flow_id: { type: 'string', description: 'Flow the report concerns, if any.' },
        system_id: { type: 'string', description: 'System the report concerns, if any.' },
        channel: { type: 'string', description: 'How it arrived: a queue session, a run summary, a remark.' },
      },
      required: ['kind', 'reported_by', 'report'],
    },
    run(args) {
      const m = resolveManifest(args.manifest_path);
      if (m.error) return { text: m.error, isError: true };
      const a = [m.path, '--kind', args.kind, '--by', args.reported_by];
      if (args.flow_id) a.push('--flow', args.flow_id);
      if (args.system_id) a.push('--system', args.system_id);
      if (args.channel) a.push('--channel', args.channel);
      a.push(args.report);
      return runTool('report.js', a);
    },
  },
  {
    name: 'scaffold_workbook',
    description:
      'Generate the engagement workbook for a flow pattern: fit check, glue interview, variation decisions, staffing plan, and a starter manifest fragment. Pass a pattern id from the bundled library (document-intake-match, gated-batch-action, human-review-queue, two-system-reconciliation) or a path to a pattern file.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Pattern id from the bundled library, or a path to a .pattern.json file.',
        },
      },
      required: ['pattern'],
    },
    run(args) {
      let p = args.pattern;
      if (!p.endsWith('.json')) p = path.join(PATTERNS_DIR, `${p}.pattern.json`);
      if (!fs.existsSync(p)) return { text: `pattern not found: ${p}`, isError: true };
      return runTool('scaffold.js', [p]);
    },
  },
];

// ---------------------------------------------------------------------------
// MCP stdio plumbing: newline-delimited JSON-RPC 2.0.
// ---------------------------------------------------------------------------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handle(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'fde-hub', version: '0.1.0' },
    });
  }
  if (method === 'notifications/initialized' || (method && method.startsWith('notifications/'))) {
    return; // notifications take no response
  }
  if (method === 'ping') {
    return reply(id, {});
  }
  if (method === 'tools/list') {
    return reply(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) return replyError(id, -32602, `unknown tool: ${params.name}`);
    const { text, isError } = tool.run(params.arguments || {});
    return reply(id, { content: [{ type: 'text', text }], isError: !!isError });
  }
  if (id !== undefined) {
    return replyError(id, -32601, `method not found: ${method}`);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // not JSON; ignore rather than crash the transport
    }
    try {
      handle(msg);
    } catch (e) {
      if (msg.id !== undefined) replyError(msg.id, -32603, e.message);
    }
  }
});
process.stdin.on('end', () => process.exit(0));
