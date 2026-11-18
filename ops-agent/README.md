# Revenue path reliability agent job

This is the executable evidence behind `agent-job.html`. It audits the real 0tomait
revenue path: the public home page, public demo, repository source, and Google Calendar
booking page.

The watcher is deterministic. It reads the approved contract from `job-contract.json`,
collects source evidence, gives each finding a stable fingerprint, and keeps the queue in
`state.json`. Each run writes a complete record to `runs/` and updates `latest.json`.

Run it from the repository root:

```bash
node ops-agent/run.mjs
```

Exit code `0` means the contract is clear. Exit code `2` means one or more findings need
work. Network or source-read failures become queue items instead of disappearing.

## Where the agentic work starts

The watcher decides which class of work exists:

- Source repairs can be prepared on an isolated branch.
- Merges, deployments, public prices, and public claims wait for human approval.
- External account settings stay assigned to the account owner.
- A later run verifies the changed production state before resolving the item.

For this public demonstration, queue state is committed as JSON so every claim is
inspectable. A client deployment would use the client's database or work queue and its
actual tool permissions. Secrets and private client data never belong in this repository.
