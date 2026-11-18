#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const contract = JSON.parse(await readFile(join(here, "job-contract.json"), "utf8"));
const statePath = join(here, "state.json");
const latestPath = join(here, "latest.json");
const runsDir = join(here, "runs");
const checkedAt = new Date().toISOString();

await mkdir(runsDir, { recursive: true });

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { job_id: contract.job_id, findings: {} };
    throw error;
  }
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stripMarkup(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripMarkup(match[1]) : null;
}

function bookingLinks(html) {
  return [...html.matchAll(/href=["']([^"']*calendar\.app\.google[^"']*)["']/gi)].map(
    (match) => match[1],
  );
}

function finding({ scope, check, expected, observed, evidence, action, approval }) {
  const fingerprint = sha(`${contract.job_id}\n${scope}\n${check}\n${expected}`).slice(0, 16);
  return {
    fingerprint,
    scope,
    check,
    expected,
    observed,
    evidence,
    action,
    approval,
  };
}

async function fetchText(label, url) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "0tomait-revenue-path-agent/1.0" },
    });
    const text = await response.text();
    return {
      label,
      url,
      final_url: response.url,
      status: response.status,
      ok: response.ok,
      duration_ms: Date.now() - started,
      sha256: sha(text),
      title: titleOf(text),
      text,
    };
  } catch (error) {
    return {
      label,
      url,
      final_url: null,
      status: null,
      ok: false,
      duration_ms: Date.now() - started,
      sha256: null,
      title: null,
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sourceText(label, relativePath) {
  try {
    const text = await readFile(join(root, relativePath), "utf8");
    return {
      label,
      path: relativePath,
      ok: true,
      sha256: sha(text),
      title: titleOf(text),
      text,
    };
  } catch (error) {
    return {
      label,
      path: relativePath,
      ok: false,
      sha256: null,
      title: null,
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const [liveHome, liveDemo, booking, sourceHome, sourceDemo] = await Promise.all([
  fetchText("live_home", contract.sources.live_home),
  fetchText("live_demo", contract.sources.live_demo),
  fetchText("booking", contract.sources.booking),
  sourceText("source_home", contract.sources.source_home),
  sourceText("source_demo", contract.sources.source_demo),
]);

const sources = [liveHome, liveDemo, booking, sourceHome, sourceDemo];
const findings = [];

for (const source of sources) {
  if (!source.ok) {
    findings.push(
      finding({
        scope: source.label,
        check: "source_reachable",
        expected: "Source is readable and returns a successful response",
        observed: source.error ?? `HTTP ${source.status}`,
        evidence: source.url ?? source.path,
        action: "Investigate access or deployment before processing downstream checks",
        approval: "none",
      }),
    );
  }
}

for (const source of [liveHome, sourceHome]) {
  if (!source.ok) continue;
  const body = stripMarkup(source.text);
  for (const retiredOffer of contract.retired_offers) {
    if (body.includes(retiredOffer)) {
      findings.push(
        finding({
          scope: source.label,
          check: `retired_offer:${retiredOffer}`,
          expected: "Retired offers are absent from the approved revenue path",
          observed: `Found “${retiredOffer}”`,
          evidence: body.slice(Math.max(0, body.indexOf(retiredOffer) - 90), body.indexOf(retiredOffer) + retiredOffer.length + 120),
          action: source.label === "source_home" ? "Prepare a source repair" : "Verify the approved source has been deployed",
          approval: source.label === "source_home" ? "product owner approves copy and price changes" : "human approves deployment",
        }),
      );
    }
  }
}

for (const source of [liveHome, sourceHome]) {
  if (!source.ok) continue;
  const body = stripMarkup(source.text);
  for (const [key, value] of [
    ["headline", contract.approved_contract.headline],
    ["product_name", contract.approved_contract.product_name],
    ["price", contract.approved_contract.price],
  ]) {
    if (!body.includes(value)) {
      findings.push(
        finding({
          scope: source.label,
          check: `approved_contract:${key}`,
          expected: `Contains “${value}”`,
          observed: "Approved value was not found",
          evidence: source.url ?? source.path,
          action: source.label === "source_home" ? "Prepare a source repair" : "Verify the approved source has been deployed",
          approval: source.label === "source_home" ? "product owner approves source repair" : "human approves deployment",
        }),
      );
    }
  }

  const links = bookingLinks(source.text);
  if (!links.includes(contract.approved_contract.booking_url)) {
    findings.push(
      finding({
        scope: source.label,
        check: "approved_booking_url",
        expected: contract.approved_contract.booking_url,
        observed: links.length ? links.join(", ") : "No booking link found",
        evidence: source.url ?? source.path,
        action: source.label === "source_home" ? "Prepare a source repair" : "Verify the approved source has been deployed",
        approval: "human approves public journey changes",
      }),
    );
  }
}

if (booking.ok) {
  const expected = contract.approved_contract.booking_title_contains;
  if (!booking.title?.includes(expected)) {
    findings.push(
      finding({
        scope: "booking",
        check: "booking_title_contract",
        expected: `Booking title contains “${expected}”`,
        observed: booking.title ?? "No page title found",
        evidence: `${booking.final_url ?? booking.url} returned HTTP ${booking.status}`,
        action: "Ask the owner to rename the Google Calendar appointment schedule, then verify on the next run",
        approval: "owner must change an external account setting",
      }),
    );
  }
}

const previousState = await readState();
const nextFindingMap = { ...previousState.findings };
const activeFingerprints = new Set(findings.map((item) => item.fingerprint));

for (const item of findings) {
  const previous = previousState.findings[item.fingerprint];
  nextFindingMap[item.fingerprint] = {
    ...item,
    status: previous?.status === "acknowledged" ? "acknowledged" : "open",
    first_seen_at: previous?.first_seen_at ?? checkedAt,
    last_seen_at: checkedAt,
    occurrences: (previous?.occurrences ?? 0) + 1,
  };
}

for (const [fingerprint, item] of Object.entries(nextFindingMap)) {
  if (!activeFingerprints.has(fingerprint) && item.status !== "resolved") {
    nextFindingMap[fingerprint] = {
      ...item,
      status: "resolved",
      resolved_at: checkedAt,
    };
  }
}

let commit = null;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
} catch {}

const active = Object.values(nextFindingMap).filter((item) => item.status !== "resolved");
const runId = checkedAt.replace(/[:.]/g, "-");
const report = {
  schema_version: 1,
  run_id: runId,
  checked_at: checkedAt,
  job: {
    id: contract.job_id,
    name: contract.job_name,
    objective: contract.objective,
    schedule: contract.schedule,
  },
  source_commit: commit,
  summary: {
    sources_checked: sources.length,
    sources_ok: sources.filter((source) => source.ok).length,
    active_findings: active.length,
    requires_approval: active.filter((item) => item.approval !== "none").length,
    resolved_total: Object.values(nextFindingMap).filter((item) => item.status === "resolved").length,
  },
  sources: sources.map(({ text, ...source }) => source),
  active_findings: active,
  policy: contract.policy,
};

const nextState = {
  job_id: contract.job_id,
  updated_at: checkedAt,
  last_run_id: runId,
  findings: nextFindingMap,
};

await writeFile(join(runsDir, `${runId}.json`), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(latestPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);

console.log(JSON.stringify(report.summary));
if (active.length) process.exitCode = 2;
