#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { createMigrationPlan, detectMigrationSource } = require("../server/migration-importer");

const ROOT = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const report = buildConciergeReport(args);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

if (!report.ok) {
  process.exitCode = 1;
}

function parseArgs(values) {
  return values.reduce((result, value) => {
    if (result.pending) {
      result[result.pending] = value;
      result.pending = "";
    } else if (value === "--source") result.pending = "source";
    else if (value.startsWith("--source=")) result.source = value.slice("--source=".length);
    else if (value === "--workspace") result.pending = "workspace";
    else if (value.startsWith("--workspace=")) result.workspace = value.slice("--workspace=".length);
    else if (value === "--backup") result.pending = "backup";
    else if (value.startsWith("--backup=")) result.backup = value.slice("--backup=".length);
    else if (value === "--mode") result.pending = "mode";
    else if (value.startsWith("--mode=")) result.mode = value.slice("--mode=".length);
    else if (value === "--workspace-name") result.pending = "workspaceName";
    else if (value.startsWith("--workspace-name=")) result.workspaceName = value.slice("--workspace-name=".length);
    else if (value === "--strict") result.strict = true;
    else if (value === "--json") result.json = true;
    else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else if (!result.file) result.file = value;
    else throw new Error(`Unknown option: ${value}`);
    return result;
  }, { file: "", source: "", workspace: "", backup: "", mode: "merge", workspaceName: "", strict: false, json: false, pending: "" });
}

function buildConciergeReport(options = {}) {
  if (!options.file) throw new Error("Usage: npm run migrate:concierge -- <export-file> [--source source] [--workspace workspace.json] [--backup backup.json]");
  const filePath = path.resolve(ROOT, options.file);
  const payload = fs.readFileSync(filePath, "utf8");
  const workspace = options.workspace ? readJson(options.workspace) : {};
  const source = options.source || detectMigrationSource(payload, filePath);
  const plan = createMigrationPlan({
    source,
    payload,
    fileName: filePath,
    existingSnapshot: workspace,
    mode: options.mode,
    workspaceName: options.workspaceName
  });
  const backup = inspectBackup(options.backup);
  const blockers = [];
  const warnings = [];
  const reviewStatus = plan.review?.status || "unknown";

  if (!options.workspace && options.mode !== "new-workspace") warnings.push("No workspace JSON was supplied; preview assumes an empty merge target.");
  if (!backup.ok) warnings.push(backup.detail);
  if (plan.counts.tasks === 0) blockers.push("No tasks were detected in the export.");
  if (reviewStatus === "risky") warnings.push("Import review is risky; map missing fields or choose new-workspace mode.");
  if (options.strict && (warnings.length || blockers.length)) blockers.push("Strict mode blocks until warnings are resolved.");

  const ok = blockers.length === 0;
  const fieldCoverage = migrationFieldCoverage(plan);
  const cleanupChecklist = migrationCleanupChecklist(plan);
  const rollbackPlan = migrationRollbackPlan(backup);
  const applyStrategy = migrationApplyStrategy(options, plan);
  const reviewerChecklist = migrationReviewerChecklist(plan, backup);
  return {
    ok,
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(ROOT, filePath),
    source,
    mode: plan.mode,
    importBatchId: plan.importBatchId,
    confidence: plan.confidence,
    reviewStatus,
    counts: plan.counts,
    mappedFields: plan.mappedFields,
    missingCoreFields: plan.review?.missingCoreFields || [],
    followUpCounts: plan.review?.followUpCounts || {},
    fieldCoverage,
    cleanupChecklist,
    rollbackPlan,
    applyStrategy,
    reviewerChecklist,
    warnings: [...plan.warnings, ...warnings],
    blockers,
    samples: plan.samples,
    backup,
    nextCommands: nextCommands(options, plan)
  };
}

function migrationFieldCoverage(plan = {}) {
  const mapped = new Set((plan.mappedFields || []).map(String));
  const fields = [
    ["title", "Task titles"],
    ["project", "Project/list grouping"],
    ["status", "Workflow status"],
    ["assignee", "Owners"],
    ["priority", "Priority"],
    ["due date", "Due dates"],
    ["description", "Descriptions"],
    ["tags", "Tags/labels"],
    ["source url", "Source links"],
    ["attachments", "Attachment links"],
    ["comments", "Comments"],
    ["completed", "Completed/closed state"]
  ];
  return fields.map(([id, label]) => ({
    id,
    label,
    mapped: mapped.has(id),
    importance: ["title", "project", "status", "assignee", "priority", "due date"].includes(id) ? "core" : "context"
  }));
}

function migrationCleanupChecklist(plan = {}) {
  const review = plan.review || {};
  const counts = review.followUpCounts || {};
  const items = [
    {
      id: "owners",
      label: "Assign missing owners",
      count: Number(counts.unassignedTasks || 0),
      done: Number(counts.unassignedTasks || 0) === 0,
      detail: "Imported tasks without owners should be assigned before the workspace is invited into."
    },
    {
      id: "dates",
      label: "Add missing due dates",
      count: Number(counts.unscheduledTasks || 0),
      done: Number(counts.unscheduledTasks || 0) === 0,
      detail: "Unscheduled imported work should get dates or be moved into backlog."
    },
    {
      id: "skipped",
      label: "Review skipped rows",
      count: Number(counts.skippedRows || plan.counts?.skipped || 0),
      done: Number(counts.skippedRows || plan.counts?.skipped || 0) === 0,
      detail: "Skipped rows usually need title mapping or cleanup in the source export."
    },
    {
      id: "warnings",
      label: "Resolve warnings",
      count: (plan.warnings || []).length,
      done: !(plan.warnings || []).length,
      detail: "Warnings do not always block import, but they should be understood before apply."
    }
  ];
  return items;
}

function migrationRollbackPlan(backup = {}) {
  return {
    ready: Boolean(backup.ok),
    status: backup.status || "missing",
    detail: backup.detail || "No rollback evidence supplied.",
    steps: backup.ok
      ? [
          "Keep this backup unchanged until the imported workspace is accepted.",
          "Apply into a copied workspace JSON or use new-workspace mode first.",
          "If review fails, restore the referenced backup or keep the original workspace active."
        ]
      : [
          "Create a portable workspace bundle or server backup before applying.",
          "Keep the backup beside the import report.",
          "Apply only after rollback evidence is available."
        ]
  };
}

function migrationApplyStrategy(options = {}, plan = {}) {
  const output = `imported-${plan.importBatchId || "workspace"}.json`;
  return {
    mode: plan.mode,
    safestMode: plan.mode === "new-workspace" ? "new-workspace" : "merge with reviewed backup",
    previewCommand: [
      "npm run agora -- migrate preview",
      shellQuote(options.file),
      "--source",
      shellQuote(plan.source)
    ].join(" "),
    applyCommand: nextCommands(options, plan).find((command) => command.startsWith("npm run agora -- migrate apply")) || "",
    output,
    handoff: "Open the imported JSON as a separate review artifact before replacing the active workspace."
  };
}

function migrationReviewerChecklist(plan = {}, backup = {}) {
  return [
    {
      label: "Fields mapped",
      done: !(plan.review?.missingCoreFields || []).length,
      detail: (plan.review?.missingCoreFields || []).length
        ? `Missing: ${(plan.review?.missingCoreFields || []).join(", ")}`
        : "Core fields are mapped."
    },
    {
      label: "Samples believable",
      done: (plan.samples || []).length > 0,
      detail: (plan.samples || []).slice(0, 3).map((sample) => sample.title).join(", ") || "No task samples available."
    },
    {
      label: "Rollback covered",
      done: Boolean(backup.ok),
      detail: backup.ok ? backup.detail : "Add --backup <file> before apply."
    },
    {
      label: "Cleanup understood",
      done: (plan.review?.recommendedActions || []).length <= 1 && !(plan.review?.blockers || []).length,
      detail: (plan.review?.recommendedActions || []).join(" ") || "No extra cleanup actions."
    }
  ];
}

function inspectBackup(backupPath = "") {
  if (!backupPath) {
    return {
      ok: false,
      status: "missing",
      detail: "No backup file was supplied; export a portable bundle or run a server backup before applying."
    };
  }
  try {
    const absolutePath = path.resolve(ROOT, backupPath);
    const backup = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    const isServerBackup = backup.type === "agora.workspace-backup" && backup.version === 1 && backup.snapshot;
    const isPortableBundle = backup.type === "agora.portable-workspace" || Array.isArray(backup.files);
    return {
      ok: Boolean(isServerBackup || isPortableBundle),
      status: isServerBackup ? "server-backup" : isPortableBundle ? "portable-bundle" : "unknown",
      file: path.relative(ROOT, absolutePath),
      detail: isServerBackup
        ? `Server backup for ${backup.workspace?.name || "workspace"} generated ${backup.generatedAt || "unknown"}`
        : isPortableBundle ? "Portable workspace bundle supplied" : "Backup file is not an Agora server backup or portable bundle"
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      file: backupPath,
      detail: `Backup could not be read: ${error.message}`
    };
  }
}

function nextCommands(options = {}, plan = {}) {
  const commandBase = [
    "npm run agora -- migrate apply",
    shellQuote(options.file),
    "--source",
    shellQuote(plan.source),
    "--workspace",
    shellQuote(options.workspace || "workspace.json"),
    "--out",
    shellQuote(`imported-${plan.importBatchId || "workspace"}.json`)
  ];
  if (options.mode) commandBase.push("--mode", shellQuote(options.mode));
  if (options.workspaceName) commandBase.push("--workspace-name", shellQuote(options.workspaceName));
  return [
    options.backup ? "Keep the referenced backup until the imported workspace has been reviewed." : "Create a backup before applying this import.",
    commandBase.join(" "),
    "Open Data > Replace Current Workspace only after reviewing the imported JSON."
  ];
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"));
}

function shellQuote(value) {
  const text = String(value || "");
  return /^[A-Za-z0-9_./:-]+$/.test(text) ? text : JSON.stringify(text);
}

function printReport(report) {
  console.log("Agora migration concierge");
  console.log(`Source: ${report.sourceFile} (${report.source})`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Confidence: ${report.confidence}% / ${report.reviewStatus}`);
  console.log(`Counts: ${Object.entries(report.counts).map(([key, value]) => `${key} ${value}`).join(", ")}`);
  console.log(`Backup: ${report.backup.status} - ${report.backup.detail}`);
  if (report.mappedFields.length) console.log(`Mapped fields: ${report.mappedFields.join(", ")}`);
  if (report.missingCoreFields.length) console.log(`Missing core fields: ${report.missingCoreFields.join(", ")}`);
  console.log("");
  console.log("Field Coverage:");
  report.fieldCoverage.forEach((field) => {
    console.log(`- ${field.mapped ? "OK" : "Review"} ${field.label} (${field.importance})`);
  });
  console.log("");
  console.log("Cleanup Checklist:");
  report.cleanupChecklist.forEach((item) => {
    console.log(`- ${item.done ? "OK" : "Review"} ${item.label}: ${item.count}`);
  });
  console.log("");
  console.log("Rollback Plan:");
  console.log(`- ${report.rollbackPlan.ready ? "Ready" : "Missing"}: ${report.rollbackPlan.detail}`);
  report.rollbackPlan.steps.forEach((step) => console.log(`- ${step}`));
  console.log("");
  console.log("Reviewer Checklist:");
  report.reviewerChecklist.forEach((item) => {
    console.log(`- ${item.done ? "OK" : "Review"} ${item.label}: ${item.detail}`);
  });
  if (report.warnings.length) {
    console.log("");
    console.log("Warnings:");
    report.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  if (report.blockers.length) {
    console.log("");
    console.log("Blockers:");
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  if (report.samples.length) {
    console.log("");
    console.log("Samples:");
    report.samples.forEach((sample) => console.log(`- ${sample.title} (${sample.status}, ${sample.priority})`));
  }
  console.log("");
  console.log("Apply Strategy:");
  console.log(`- Mode: ${report.applyStrategy.mode}`);
  console.log(`- Safest path: ${report.applyStrategy.safestMode}`);
  console.log(`- Preview: ${report.applyStrategy.previewCommand}`);
  console.log(`- Handoff: ${report.applyStrategy.handoff}`);
  console.log("");
  console.log("Next:");
  report.nextCommands.forEach((command) => console.log(`- ${command}`));
}

function printHelp() {
  console.log(`Agora migration concierge

Usage:
  npm run migrate:concierge -- <export-file> [--source source] [--workspace workspace.json] [--backup backup.json]
  npm run agora -- concierge <export-file> [--source source] [--workspace workspace.json] [--backup backup.json]

Options:
  --source <source>          generic-csv, trello-json, asana-csv, jira-csv, linear-csv, or clickup-csv
  --workspace <file>         Existing Agora workspace JSON for merge previews
  --backup <file>            Server backup or portable bundle proving rollback coverage
  --mode <mode>              merge or new-workspace
  --workspace-name <name>    Imported workspace name for new-workspace mode
  --strict                   Fail when warnings are present
  --json                     Print machine-readable JSON
`);
}
