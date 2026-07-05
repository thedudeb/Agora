#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function run() {
  const jsonResult = runConcierge(["--json"]);
  const report = JSON.parse(jsonResult.stdout);

  assert(report.ok === true, "concierge report should pass with fixture backup");
  assert(Array.isArray(report.fieldCoverage), "fieldCoverage should be present");
  assert(report.fieldCoverage.some((field) => field.id === "priority" && field.mapped === false), "priority coverage should be reviewable");
  assert(Array.isArray(report.cleanupChecklist), "cleanupChecklist should be present");
  assert(report.cleanupChecklist.some((item) => item.id === "skipped"), "skipped-row cleanup item should be present");
  assert(report.rollbackPlan?.ready === true, "rollback plan should be ready with bundle backup");
  assert(report.rollbackPlan.steps.length >= 3, "rollback plan should include steps");
  assert(report.applyStrategy?.previewCommand?.includes("migrate preview"), "apply strategy should include preview command");
  assert(report.applyStrategy?.applyCommand?.includes("migrate apply"), "apply strategy should include apply command");
  assert(report.reviewerChecklist?.some((item) => item.label === "Fields mapped" && item.done === false), "reviewer checklist should flag missing priority mapping");
  assert(report.nextCommands.some((command) => command.includes("Replace Current Workspace")), "next commands should include handoff guidance");

  const textResult = runConcierge([]);
  assert(textResult.stdout.includes("Field Coverage:"), "text report should include Field Coverage section");
  assert(textResult.stdout.includes("Cleanup Checklist:"), "text report should include Cleanup Checklist section");
  assert(textResult.stdout.includes("Rollback Plan:"), "text report should include Rollback Plan section");
  assert(textResult.stdout.includes("Apply Strategy:"), "text report should include Apply Strategy section");

  console.log("Migration concierge test passed.");
}

function runConcierge(extraArgs) {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, "scripts", "migration-concierge.js"),
    "tests/fixtures/trello-board.json",
    "--source",
    "trello-json",
    "--workspace",
    "tests/fixtures/workspace.json",
    "--backup",
    "tests/fixtures/portable-workspace-bundle.json",
    ...extraArgs
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Migration concierge exited with ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run();
