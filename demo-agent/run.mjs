#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(await readFile(join(here, "job-contract.json"), "utf8"));
const fixture = JSON.parse(await readFile(join(here, "fixture.json"), "utf8"));
const receipt = (kind, value) => `${kind}_${createHash("sha256").update(value).digest("hex").slice(0, 10)}`;

if (fixture.contract.status !== "signed" || fixture.crm.stage !== "won") {
  throw new Error("Trigger rejected: the contract must be signed and the CRM deal must be won.");
}

const projectId = receipt("prj", fixture.case_id);
const checklistId = receipt("chk", `${fixture.case_id}:onboarding`);
const invoiceId = receipt("inv", `${fixture.contract.id}:${fixture.contract.value_usd}`);
const eventId = receipt("evt", `${fixture.case_id}:kickoff`);

const timeline = [
  { at: "09:14", verb: "TRIGGER", detail: "Signed contract matched to the won CRM deal", evidence: `${fixture.contract.id} ↔ ${fixture.crm.deal_id}` },
  { at: "09:15", verb: "RECONCILE", detail: "Checked contract, CRM, billing, project workspace, and calendar", evidence: "5 source records read; 3 missing handoff artifacts" },
  { at: "09:16", verb: "DECIDE", detail: "Classified the case as a dropped post-sale handoff", evidence: "contract signed + deal won + no invoice + no project + no kickoff" },
  { at: "09:18", verb: "ACT", detail: "Created the project shell and onboarding checklist", evidence: `${projectId}; ${checklistId}` },
  { at: "09:19", verb: "PREPARE", detail: "Drafted the deposit invoice and kickoff invitation", evidence: `${invoiceId}; approval required before external send` },
  { at: "09:20", verb: "HOLD", detail: "Paused at the financial and external-communication boundary", evidence: "owner approval request APR-1042" },
  { at: "09:22", verb: "RESUME", detail: "Owner approved the invoice send and kickoff invitation", evidence: "APR-1042 approved; scope unchanged" },
  { at: "09:23", verb: "ACT", detail: "Sent the deposit invoice and proposed kickoff window", evidence: `${invoiceId}; delivery receipt accepted` },
  { at: "09:30", verb: "VERIFY", detail: "Payment callback matched to the invoice and contract", evidence: `${invoiceId}; payment status paid` },
  { at: "09:32", verb: "COMPLETE", detail: "Kickoff booked and all five systems reconciled", evidence: `${eventId}; 0 exceptions remaining` }
];

const output = {
  demo_notice: "Executable composite demonstration data. No real client record or live account is represented.",
  job: contract,
  case_id: fixture.case_id,
  status: "complete",
  summary: {
    contract_value_usd: fixture.contract.value_usd,
    systems_reconciled: contract.sources.length,
    approval_gates: 1,
    exceptions_remaining: 0,
    minutes_to_ready: 18
  },
  before: {
    contract: "signed",
    crm: "won",
    invoice: "missing",
    payment: "missing",
    project: "missing",
    kickoff: "missing"
  },
  after: {
    contract: "linked",
    crm: "delivery ready",
    invoice: "paid",
    payment: "verified",
    project: projectId,
    onboarding: checklistId,
    kickoff: eventId
  },
  timeline,
  completion_ledger: [
    { requirement: "Contract linked to won deal", evidence: `${fixture.contract.id} ↔ ${fixture.crm.deal_id}`, status: "verified" },
    { requirement: "Deposit paid", evidence: `${invoiceId} / payment callback matched`, status: "verified" },
    { requirement: "Project ready", evidence: `${projectId} + ${checklistId}`, status: "verified" },
    { requirement: "Kickoff scheduled", evidence: eventId, status: "verified" },
    { requirement: "No exception remains", evidence: "5 systems reconciled after final callback", status: "verified" }
  ]
};

await writeFile(join(here, "latest.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.summary, null, 2));
