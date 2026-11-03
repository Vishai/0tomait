# fde-hub MCP server

The deployment-manifest toolchain, exposed over the Model Context Protocol. An
MCP-capable agent gets the method as tools instead of shell commands: validate a
manifest, compile the agent briefing, scaffold a pattern workbook, read and file field
reports.

This is the thesis as infrastructure. The manifest holds the context agents are starved
for; this server is the socket they plug into.

## Register

With Claude Code:

```bash
claude mcp add fde-hub -- node /absolute/path/to/fde-hub/mcp/server.js
```

Any other MCP client: stdio transport, command `node server.js`, no environment
variables, no dependencies.

## Tools

| Tool | What it does |
| --- | --- |
| `validate_manifest` | Full schema and lint pass, role coverage included, on a manifest path (defaults to the bundled reference example). |
| `compile_briefing` | Manifest in, agent briefing out: the context pack a maintenance agent works from. |
| `list_field_reports` | The open operator feedback on a deployment, with status. |
| `file_field_report` | Record an observation into the manifest with reporter credit and a lifecycle. Writes to the manifest file. |
| `scaffold_workbook` | Engagement workbook for a pattern, by bundled id or file path. |

Every tool is a thin wrapper over the corresponding CLI in `../tools/`, so the MCP
surface and the command line cannot drift apart.

## The loop this enables

An agent maintaining a deployment can, in one session: compile the briefing to load the
client's constraints, check `list_field_reports` for current friction, make its change
inside the recorded boundaries, file what it observed as a new field report, and
validate the manifest before committing. The evals in `../evals/` measure how well the
briefing half of that loop holds up.
