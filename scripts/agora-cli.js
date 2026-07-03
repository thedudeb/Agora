#!/usr/bin/env node
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { applyMigrationPlan, createMigrationPlan } = require("../server/migration-importer");

const ROOT = path.resolve(__dirname, "..");

const checkFiles = [
  "src/app.js",
  "server/api.js",
  "server/storage.js",
  "server/static.js",
  "server/env.js",
  "server/smoke-test.js",
  "server/mcp-integration-test.js",
  "server/migration-importer.js",
  "server/migration-importer-test.js",
  "server/supabase-verify.js",
  "server/portable-fixtures-test.js",
  "scripts/recovery-stress-test.js",
  "scripts/capture-screenshots.js",
  "scripts/golden-path-qa.js",
  "scripts/admin-security-regression.js",
  "scripts/release-qa.js",
  "scripts/agora-cli.js",
  "scripts/agora-mcp-server.js",
  "scripts/agora-plugin-check.js",
  "scripts/hosted-env-verify.js",
  "scripts/hosted-deploy-rehearsal.js",
  "desktop/electron/main.cjs",
  "desktop/electron/preload.cjs"
];

const commands = {
  help: {
    summary: "Show CLI help",
    run: async () => printHelp()
  },
  check: {
    summary: "Syntax-check app, server, desktop, and script files",
    run: async () => {
      for (const file of checkFiles) {
        await runStep(`node --check ${file}`, [process.execPath, ["--check", path.join(ROOT, file)]]);
      }
    }
  },
  fixtures: {
    summary: "Validate portable workspace and automation pack fixtures",
    run: async () => runStep("fixture validation", [process.execPath, [path.join(ROOT, "server", "portable-fixtures-test.js")]])
  },
  recovery: {
    summary: "Stress-test backup, portable import, and restore semantics",
    run: async () => runStep("recovery stress test", [process.execPath, [path.join(ROOT, "scripts", "recovery-stress-test.js")]])
  },
  api: {
    summary: "Run the dependency-free API smoke test",
    run: async () => runStep("API smoke test", [process.execPath, [path.join(ROOT, "server", "smoke-test.js")]])
  },
  mcp: {
    summary: "Run the MCP server integration test",
    run: async () => runStep("MCP integration test", [process.execPath, [path.join(ROOT, "server", "mcp-integration-test.js")]])
  },
  importers: {
    summary: "Validate migration importer planning and apply behavior",
    run: async () => runStep("migration importer test", [process.execPath, [path.join(ROOT, "server", "migration-importer-test.js")]])
  },
  supabase: {
    summary: "Verify a real Supabase project from .env",
    run: async () => runStep("Supabase verification", [process.execPath, [path.join(ROOT, "server", "supabase-verify.js")]])
  },
  screenshots: {
    summary: "Refresh launch screenshots with local Chrome/Chromium",
    run: async () => runStep("screenshot capture", [process.execPath, [path.join(ROOT, "scripts", "capture-screenshots.js")]])
  },
  golden: {
    summary: "Run browser QA for onboarding and golden paths",
    run: async () => runStep("golden path QA", [process.execPath, [path.join(ROOT, "scripts", "golden-path-qa.js")]])
  },
  hosted: {
    summary: "Verify hosted production environment configuration",
    run: async (args) => runStep("hosted environment verification", [process.execPath, [path.join(ROOT, "scripts", "hosted-env-verify.js"), ...args]])
  },
  "rehearse-hosted": {
    summary: "Run hosted deploy rehearsal checks",
    run: async (args) => runStep("hosted deploy rehearsal", [process.execPath, [path.join(ROOT, "scripts", "hosted-deploy-rehearsal.js"), ...args]])
  },
  qa: {
    summary: "Run release QA: quick verification plus browser golden paths",
    run: async () => runStep("release QA", [process.execPath, [path.join(ROOT, "scripts", "release-qa.js")]])
  },
  bundle: {
    summary: "Inspect portable workspace bundles",
    run: async (args) => {
      const { positional, options } = parseOptions(args);
      const [subcommand, filePath] = positional;
      if (subcommand !== "inspect" || !filePath) {
        throw new Error("Usage: npm run agora -- bundle inspect <file> [--json]");
      }
      inspectPortableBundle(filePath, options);
    }
  },
  launch: {
    summary: "Check first-client launch readiness from a portable bundle",
    run: async (args) => {
      const { positional, options } = parseOptions(args);
      const [subcommand, filePath] = positional;
      if (subcommand !== "check" || !filePath) {
        throw new Error("Usage: npm run agora -- launch check <bundle.json> [--strict] [--json]");
      }
      checkLaunchReadiness(filePath, options);
    }
  },
  marketplace: {
    summary: "Validate marketplace template and automation pack JSON",
    run: async (args) => {
      const { positional, options } = parseOptions(args);
      const [subcommand, filePath] = positional;
      if (subcommand !== "validate" || !filePath) {
        throw new Error("Usage: npm run agora -- marketplace validate <file> [--json]");
      }
      validateMarketplaceFile(filePath, options);
    }
  },
  migrate: {
    summary: "Preview or apply project migrations from CSV or Trello JSON",
    run: async (args) => {
      const { positional, options } = parseOptions(args);
      const [subcommand, filePath] = positional;
      if (!["preview", "apply"].includes(subcommand) || !filePath) {
        throw new Error("Usage: npm run agora -- migrate preview <file> [--source generic-csv|trello-json|asana-csv|jira-csv|linear-csv|clickup-csv] [--workspace workspace.json] [--mode merge|new-workspace] [--json]\n       npm run agora -- migrate apply <file> --workspace workspace.json --out imported-workspace.json [--source generic-csv|trello-json|asana-csv|jira-csv|linear-csv|clickup-csv] [--mode merge|new-workspace]");
      }
      runMigrationCommand(subcommand, filePath, options);
    }
  },
  verify: {
    summary: "Run the standard power-user verification suite",
    run: async (args) => {
      const includeApi = !args.includes("--quick");
      const includeSupabase = args.includes("--supabase");
      await commands.check.run([]);
      await commands.fixtures.run([]);
      await commands.recovery.run([]);
      await commands.importers.run([]);
      if (includeApi) await commands.api.run([]);
      else console.log("Skipping API smoke test because --quick was passed.");
      if (includeApi) await commands.mcp.run([]);
      else console.log("Skipping MCP integration test because --quick was passed.");
      if (includeSupabase) await commands.supabase.run([]);
      else console.log("Skipping Supabase verification. Pass --supabase to include it.");
    }
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const [rawCommand = "help", ...args] = process.argv.slice(2);
  const command = normalizeCommand(rawCommand);
  if (!commands[command]) {
    console.error(`Unknown command: ${rawCommand}`);
    console.error("");
    printHelp();
    process.exitCode = 1;
    return;
  }

  await commands[command].run(args);
}

function normalizeCommand(command) {
  const aliases = {
    "--help": "help",
    "-h": "help",
    doctor: "verify",
    smoke: "api",
    test: "verify"
  };
  return aliases[command] || command;
}

async function runStep(label, [command, args]) {
  console.log("");
  console.log(`> ${label}`);
  await spawnCommand(command, args);
}

function spawnCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function printHelp() {
  console.log(`Agora CLI

Usage:
  npm run agora -- <command> [options]

Commands:
  verify [--quick] [--supabase]  Run check + fixtures + recovery + API smoke
  check                         Syntax-check project files
  fixtures                      Validate portable fixtures
  recovery                      Stress-test backup/import/restore semantics
  api                           Run API smoke test
  mcp                           Run MCP integration test
  importers                     Validate migration importer behavior
  supabase                      Verify real Supabase setup from .env
  screenshots                   Refresh launch screenshots
  golden                        Run onboarding/golden-path browser QA
  hosted [--json]               Verify hosted production environment config
  rehearse-hosted [--quick]     Run hosted deploy rehearsal checks
  bundle inspect <file> [--json] Inspect a portable workspace bundle
  launch check <bundle>         Check first-client launch readiness
  marketplace validate <file>   Validate marketplace/template/automation JSON
  migrate preview <file>        Preview a migration plan from CSV or Trello JSON
  migrate apply <file>          Apply a migration plan to a workspace JSON file
  help                          Show this help

Options:
  --quick       With verify, skip the API smoke test
  --supabase    With verify, include real Supabase verification
  --strict      With launch check, fail when readiness items are incomplete
  --json        Print machine-readable JSON for inspect/check/validate

Examples:
  npm run agora -- verify
  npm run agora -- verify --quick
  npm run agora -- verify --supabase
  npm run agora -- recovery
  npm run agora -- screenshots
  npm run agora -- golden
  npm run agora -- hosted
  npm run agora -- hosted --require-github
  npm run agora -- rehearse-hosted --env tests/fixtures/hosted-production.env --quick --skip-audit
  npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json
  npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json --json
  npm run agora -- launch check tests/fixtures/portable-workspace-bundle.json --strict
  npm run agora -- marketplace validate templates/marketplace.json
  npm run agora -- migrate preview tests/fixtures/trello-board.json --source trello-json
  npm run agora -- migrate preview tasks.csv --source generic-csv --json
  npm run agora -- migrate preview asana-export.csv --source asana-csv
`);
}

function parseOptions(args) {
  return args.reduce((result, arg) => {
    const pendingKey = result.pendingKey;
    if (pendingKey) {
      result.options[pendingKey] = arg;
      result.pendingKey = "";
    } else if (arg === "--json") result.options.json = true;
    else if (arg === "--strict") result.options.strict = true;
    else if (arg.startsWith("--") && arg.includes("=")) {
      const [key, ...valueParts] = arg.slice(2).split("=");
      result.options[optionKey(key)] = valueParts.join("=");
    } else if (["--source", "--workspace", "--out", "--mode", "--workspace-name"].includes(arg)) {
      result.pendingKey = optionKey(arg.slice(2));
    } else result.positional.push(arg);
    return result;
  }, { positional: [], options: { json: false, strict: false }, pendingKey: "" });
}

function optionKey(key) {
  return String(key || "").replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function runMigrationCommand(subcommand, filePath, options = {}) {
  const payloadPath = path.resolve(ROOT, filePath);
  const payload = fs.readFileSync(payloadPath, "utf8");
  const workspace = options.workspace ? readJsonFile(options.workspace) : {};
  const plan = createMigrationPlan({
    payload,
    fileName: payloadPath,
    source: options.source,
    mode: options.mode,
    workspaceName: options.workspaceName,
    existingSnapshot: workspace
  });

  if (subcommand === "preview") {
    if (options.json) printJson({ plan });
    else printMigrationPlan(plan);
    return;
  }

  if (!options.workspace) throw new Error("migrate apply requires --workspace <workspace.json>");
  if (!options.out) throw new Error("migrate apply requires --out <imported-workspace.json>");
  const result = applyMigrationPlan(workspace, plan, { mode: options.mode || plan.mode });
  fs.writeFileSync(path.resolve(ROOT, options.out), `${JSON.stringify(result.snapshot, null, 2)}\n`);
  if (options.json) printJson({ plan, applied: result.applied, out: options.out });
  else {
    printMigrationPlan(plan);
    console.log("");
    console.log("Applied Migration");
    console.log(`Mode: ${result.applied.mode}`);
    console.log(`Projects: ${result.applied.projects}`);
    console.log(`Tasks: ${result.applied.tasks}`);
    console.log(`Comments: ${result.applied.comments}`);
    console.log(`Wrote: ${options.out}`);
  }
}

function printMigrationPlan(plan) {
  console.log("Migration Preview");
  console.log(`Source: ${plan.sourceLabel} (${plan.source})`);
  console.log(`Mode: ${plan.mode}`);
  console.log(`Confidence: ${plan.confidence}%`);
  console.log(`Import batch: ${plan.importBatchId}`);
  if (plan.review) {
    console.log(`Readiness: ${plan.review.status}`);
  }
  console.log("");
  console.log("Counts:");
  Object.entries(plan.counts).forEach(([key, value]) => console.log(`- ${key}: ${value}`));
  if (plan.mappedFields.length) {
    console.log("");
    console.log(`Mapped fields: ${plan.mappedFields.join(", ")}`);
  }
  if (plan.warnings.length) {
    console.log("");
    console.log("Warnings:");
    plan.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  if (plan.review?.blockers?.length) {
    console.log("");
    console.log("Blockers:");
    plan.review.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  if (plan.review?.missingCoreFields?.length) {
    console.log("");
    console.log(`Missing core fields: ${plan.review.missingCoreFields.join(", ")}`);
  }
  if (plan.review?.recommendedActions?.length) {
    console.log("");
    console.log("Recommended actions:");
    plan.review.recommendedActions.forEach((action) => console.log(`- ${action}`));
  }
  if (plan.samples.length) {
    console.log("");
    console.log("Samples:");
    plan.samples.forEach((sample) => console.log(`- ${sample.title} (${sample.status}, ${sample.priority})`));
  }
}

function inspectPortableBundle(filePath, options = {}) {
  const bundle = readJsonFile(filePath);
  const inspection = portableBundleInspection(bundle);
  const { report, workspaceSnapshot, counts } = inspection;
  if (options.json) {
    printJson({
      report,
      workspace: workspaceSummary(bundle, workspaceSnapshot),
      counts,
      files: portableFileSummary(bundle)
    });
  } else {
    printReport(report);
  }
  if (report.errors.length) {
    throw new Error(`Portable bundle is invalid: ${report.errors.length} error${report.errors.length === 1 ? "" : "s"}`);
  }

  if (options.json) return;

  console.log("");
  console.log("Portable Bundle");
  const workspace = workspaceSummary(bundle, workspaceSnapshot);
  console.log(`Workspace: ${workspace.name} (${workspace.id})`);
  console.log(`Export version: ${bundle.exportVersion}`);
  console.log(`Exported at: ${bundle.exportedAt || "unknown"}`);
  console.log(`Files: ${bundle.files.length}`);
  console.log("");
  console.log("Counts:");
  Object.entries(counts).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
  console.log("");
  console.log("Included files:");
  portableFileSummary(bundle).forEach((file) => {
    console.log(`- ${file.path} (${file.kind || "unknown"}, ${Number(file.size || String(file.content || "").length)} bytes)`);
  });
}

function validateMarketplaceFile(filePath, options = {}) {
  const payload = readJsonFile(filePath);
  const report = validateMarketplacePayload(payload);
  if (options.json) printJson({ report });
  else printReport(report);
  if (report.errors.length) {
    throw new Error(`Marketplace artifact is invalid: ${report.errors.length} error${report.errors.length === 1 ? "" : "s"}`);
  }

  if (!options.json) {
    console.log("");
    console.log("Marketplace artifact is valid.");
  }
}

function checkLaunchReadiness(filePath, options = {}) {
  const bundle = readJsonFile(filePath);
  const inspection = portableBundleInspection(bundle);
  const readiness = launchReadinessReport(inspection);

  if (options.json) {
    printJson({
      report: inspection.report,
      readiness,
      workspace: workspaceSummary(bundle, inspection.workspaceSnapshot),
      counts: inspection.counts
    });
  } else {
    printReport(inspection.report);
  }

  if (inspection.report.errors.length) {
    throw new Error(`Portable bundle is invalid: ${inspection.report.errors.length} error${inspection.report.errors.length === 1 ? "" : "s"}`);
  }

  if (options.json) {
    if (options.strict && readiness.open.length) {
      throw new Error(`Launch readiness failed: ${readiness.open.length} incomplete item${readiness.open.length === 1 ? "" : "s"}`);
    }
    return;
  }

  console.log("");
  console.log("Launch Readiness");
  console.log(`${readiness.done}/${readiness.total} ready (${readiness.status})`);
  readiness.items.forEach((item) => {
    console.log(`- ${item.done ? "OK" : "NEXT"} ${item.label}: ${item.detail}`);
  });

  if (readiness.nextActions.length) {
    console.log("");
    console.log("Next actions:");
    readiness.nextActions.forEach((action) => console.log(`- ${action}`));
  }

  if (options.strict && readiness.open.length) {
    throw new Error(`Launch readiness failed: ${readiness.open.length} incomplete item${readiness.open.length === 1 ? "" : "s"}`);
  }
}

function portableBundleInspection(bundle) {
  const report = validatePortableBundle(bundle);
  const workspaceSnapshot = workspaceSnapshotFromBundle(bundle, report);
  return {
    report,
    workspaceSnapshot,
    counts: bundle.counts || bundleCountsFromSnapshot(workspaceSnapshot),
    files: portableFileSummary(bundle)
  };
}

function workspaceSnapshotFromBundle(bundle, report = createReport("Portable bundle")) {
  const workspaceFile = Array.isArray(bundle.files)
    ? bundle.files.find((file) => file.path === "workspace.json" && file.kind === "json")
    : null;
  if (!workspaceFile?.content) return {};
  try {
    return JSON.parse(workspaceFile.content);
  } catch (error) {
    if (!report.errors.some((item) => item.startsWith("workspace.json is not valid JSON"))) {
      report.errors.push(`workspace.json is not valid JSON: ${error.message}`);
    }
    return {};
  }
}

function workspaceSummary(bundle, snapshot = {}) {
  return {
    id: bundle.workspace?.id || snapshot.workspace?.id || "no-id",
    name: bundle.workspace?.name || snapshot.workspace?.name || "Unnamed",
    slug: bundle.workspace?.slug || snapshot.workspace?.slug || ""
  };
}

function portableFileSummary(bundle) {
  if (!Array.isArray(bundle.files)) return [];
  return bundle.files.map((file) => ({
    path: file.path || "",
    kind: file.kind || "unknown",
    size: Number(file.size || String(file.content || "").length)
  }));
}

function launchReadinessReport({ workspaceSnapshot, files, counts }) {
  const filePaths = new Set(files.map((file) => file.path));
  const pendingInvitations = Array.isArray(workspaceSnapshot.invitations)
    ? workspaceSnapshot.invitations.filter((invitation) => invitation.status === "pending")
    : [];
  const activeMemberships = Array.isArray(workspaceSnapshot.memberships)
    ? workspaceSnapshot.memberships.filter((membership) => membership.status !== "revoked")
    : [];
  const automations = Array.isArray(workspaceSnapshot.automations) ? workspaceSnapshot.automations : [];
  const templates = Array.isArray(workspaceSnapshot.projectTemplates) ? workspaceSnapshot.projectTemplates : [];
  const items = [
    {
      label: "Workspace identity",
      done: Boolean(workspaceSnapshot.workspace?.id && workspaceSnapshot.workspace?.name),
      detail: workspaceSnapshot.workspace?.name || "workspace.json should include workspace id and name",
      action: "Export a fresh portable bundle from Data."
    },
    {
      label: "Client project",
      done: Number(counts.projects || 0) > 0,
      detail: `${Number(counts.projects || 0)} project${Number(counts.projects || 0) === 1 ? "" : "s"} in bundle`,
      action: "Create the first client project through Launch Flow."
    },
    {
      label: "Actionable tasks",
      done: Number(counts.tasks || 0) > 0,
      detail: `${Number(counts.tasks || 0)} task${Number(counts.tasks || 0) === 1 ? "" : "s"} in bundle`,
      action: "Create or import template tasks before launch."
    },
    {
      label: "Starter workflow",
      done: templates.length > 0 || automations.length > 0,
      detail: `${templates.length} template${templates.length === 1 ? "" : "s"}, ${automations.length} automation${automations.length === 1 ? "" : "s"}`,
      action: "Install the client onboarding template or agency handoff pack."
    },
    {
      label: "Recovery files",
      done: ["workspace.json", "README.md", "tasks.csv"].every((filePath) => filePaths.has(filePath)),
      detail: `${files.length} portable file${files.length === 1 ? "" : "s"} included`,
      action: "Download a full portable bundle with JSON, Markdown, and CSV files."
    },
    {
      label: "Team access",
      done: activeMemberships.length > 1 || pendingInvitations.length > 0,
      detail: `${activeMemberships.length} active membership${activeMemberships.length === 1 ? "" : "s"}, ${pendingInvitations.length} pending invite${pendingInvitations.length === 1 ? "" : "s"}`,
      action: "Invite the first teammate or confirm role memberships."
    }
  ];
  const open = items.filter((item) => !item.done);
  return {
    status: open.length ? "incomplete" : "ready",
    done: items.length - open.length,
    total: items.length,
    items,
    open: open.map((item) => item.label),
    nextActions: open.map((item) => item.action)
  };
}

function validateMarketplacePayload(payload) {
  const report = createReport("Marketplace artifact");
  if (!isObject(payload)) {
    report.errors.push("JSON root must be an object.");
    return report;
  }

  if (payload.type === "agora.automation-pack") {
    validateAutomationPack(payload, report);
    return report;
  }

  if (payload.type === "agora.project-template") {
    validateProjectTemplate(payload.template, report, "template");
    return report;
  }

  if (payload.type === "agora.project-templates") {
    validateTemplateList(payload.templates, report, "templates");
    return report;
  }

  if (payload.type === "agora.template-marketplace") {
    validateTemplateList(payload.templates, report, "templates");
    if (payload.version !== 1) report.warnings.push("Expected marketplace version 1.");
    return report;
  }

  if (payload.type === "agora.automation-packs") {
    validateAutomationPackList(payload.packs, report, "packs");
    return report;
  }

  if (payload.type) {
    report.errors.push(`Unsupported marketplace type: ${payload.type}`);
    return report;
  }

  validateProjectTemplate(payload, report, "template");
  return report;
}

function validatePortableBundle(bundle) {
  const report = createReport("Portable bundle");
  if (!isObject(bundle)) {
    report.errors.push("JSON root must be an object.");
    return report;
  }

  if (bundle.type !== "agora.portable-workspace") report.errors.push("Expected type agora.portable-workspace.");
  if (bundle.exportVersion !== 1) report.errors.push("Expected exportVersion 1.");
  if (!bundle.workspace?.id) report.errors.push("Missing workspace.id.");
  if (!bundle.workspace?.name) report.warnings.push("Missing workspace.name.");
  if (!Array.isArray(bundle.files)) {
    report.errors.push("Missing files array.");
    return report;
  }

  const filePaths = new Set();
  bundle.files.forEach((file, index) => {
    if (!file.path) report.errors.push(`files[${index}] is missing path.`);
    if (file.path && filePaths.has(file.path)) report.warnings.push(`Duplicate file path: ${file.path}.`);
    if (file.path) filePaths.add(file.path);
    if (!file.kind) report.warnings.push(`files[${index}] is missing kind.`);
    if (typeof file.content !== "string") report.errors.push(`${file.path || `files[${index}]`} content must be a string.`);
  });

  const workspaceFile = bundle.files.find((file) => file.path === "workspace.json" && file.kind === "json");
  if (!workspaceFile?.content) {
    report.errors.push("Missing workspace.json file content.");
  } else {
    try {
      validateWorkspaceSnapshot(JSON.parse(workspaceFile.content), report);
    } catch (error) {
      report.errors.push(`workspace.json is not valid JSON: ${error.message}`);
    }
  }

  ["README.md", "tasks.csv", "offline-storage-contract.json"].forEach((requiredPath) => {
    if (!bundle.files.some((file) => file.path === requiredPath)) {
      report.warnings.push(`Missing recommended file ${requiredPath}.`);
    }
  });

  const contractFile = bundle.files.find((file) => file.path === "offline-storage-contract.json" && file.kind === "json");
  if (contractFile?.content) {
    try {
      const contract = JSON.parse(contractFile.content);
      if (contract.type !== "agora.offline-storage-contract") report.warnings.push("offline-storage-contract.json has an unexpected type.");
      if (contract.version !== 1) report.warnings.push("offline-storage-contract.json should use version 1.");
      if (!Array.isArray(contract.collections) || !contract.collections.includes("tasks")) report.warnings.push("offline-storage-contract.json should list workspace collections.");
      if (!contract.syncQueue?.key) report.warnings.push("offline-storage-contract.json should document the sync queue key.");
    } catch (error) {
      report.errors.push(`offline-storage-contract.json is not valid JSON: ${error.message}`);
    }
  }

  return report;
}

function validateWorkspaceSnapshot(snapshot, report) {
  if (!isObject(snapshot)) {
    report.errors.push("workspace.json must be an object.");
    return;
  }
  if (!snapshot.workspace?.id) report.errors.push("workspace.json missing workspace.id.");
  if (!snapshot.workspace?.name) report.errors.push("workspace.json missing workspace.name.");
  if (!snapshot.schemaVersion) report.warnings.push("workspace.json missing schemaVersion; Agora will migrate it on import.");
  ["companies", "projects", "tasks", "automations"].forEach((key) => {
    if (!Array.isArray(snapshot[key])) report.errors.push(`workspace.json missing ${key} array.`);
  });
  if (Array.isArray(snapshot.projects)) {
    snapshot.projects.forEach((project, index) => {
      if (!project.id || !project.companyId || !project.name) {
        report.errors.push(`projects[${index}] needs id, companyId, and name.`);
      }
    });
  }
  if (Array.isArray(snapshot.tasks)) {
    snapshot.tasks.forEach((task, index) => {
      if (!task.id || !task.projectId || !task.title) {
        report.errors.push(`tasks[${index}] needs id, projectId, and title.`);
      }
    });
  }
}

function validateTemplateList(templates, report, label) {
  if (!Array.isArray(templates) || !templates.length) {
    report.errors.push(`${label} must be a non-empty array.`);
    return;
  }
  const ids = new Set();
  templates.forEach((template, index) => {
    validateProjectTemplate(template, report, `${label}[${index}]`);
    if (template?.id) {
      if (ids.has(template.id)) report.warnings.push(`Duplicate template id: ${template.id}.`);
      ids.add(template.id);
    }
  });
  report.summary.templates = templates.length;
}

function validateProjectTemplate(template, report, label) {
  if (!isObject(template)) {
    report.errors.push(`${label} must be an object.`);
    return;
  }
  if (!template.id) report.errors.push(`${label} missing id.`);
  if (!template.name) report.errors.push(`${label} missing name.`);
  if (!template.category) report.warnings.push(`${label} missing category.`);
  if (!template.description) report.warnings.push(`${label} missing description.`);
  if (!Array.isArray(template.tasks)) {
    report.errors.push(`${label} missing tasks array.`);
    return;
  }
  const taskKeys = new Set();
  template.tasks.forEach((task, index) => {
    const taskLabel = `${label}.tasks[${index}]`;
    if (!task.key) report.errors.push(`${taskLabel} missing key.`);
    if (!task.title) report.errors.push(`${taskLabel} missing title.`);
    if (task.key && taskKeys.has(task.key)) report.warnings.push(`${label} has duplicate task key ${task.key}.`);
    if (task.key) taskKeys.add(task.key);
    if (Array.isArray(task.blockedBy)) {
      task.blockedBy.forEach((key) => {
        if (!taskKeys.has(key) && !template.tasks.some((candidate) => candidate.key === key)) {
          report.warnings.push(`${taskLabel} blockedBy references unknown key ${key}.`);
        }
      });
    }
  });
  if (Array.isArray(template.milestones)) {
    template.milestones.forEach((milestone, index) => {
      (milestone.taskKeys || []).forEach((key) => {
        if (!taskKeys.has(key)) report.warnings.push(`${label}.milestones[${index}] references unknown task key ${key}.`);
      });
    });
  }
  if (Number(template.priceCents || 0) > 0 && !template.creatorName) {
    report.warnings.push(`${label} is priced but missing creatorName.`);
  }
}

function validateAutomationPackList(packs, report, label) {
  if (!Array.isArray(packs) || !packs.length) {
    report.errors.push(`${label} must be a non-empty array.`);
    return;
  }
  packs.forEach((pack, index) => validateAutomationPack({ type: "agora.automation-pack", exportVersion: 1, pack }, report, `${label}[${index}]`));
}

function validateAutomationPack(payload, report, label = "pack") {
  if (payload.type !== "agora.automation-pack") report.errors.push("Expected type agora.automation-pack.");
  if (payload.exportVersion !== 1) report.errors.push("Expected exportVersion 1.");
  const pack = payload.pack;
  if (!isObject(pack)) {
    report.errors.push(`${label} must include pack object.`);
    return;
  }
  if (!pack.id) report.errors.push(`${label} missing id.`);
  if (!pack.name) report.errors.push(`${label} missing name.`);
  if (!pack.category) report.warnings.push(`${label} missing category.`);
  if (!pack.creatorName) report.warnings.push(`${label} missing creatorName.`);
  if (!pack.license) report.warnings.push(`${label} missing license.`);
  if (!Array.isArray(pack.rules) || !pack.rules.length) {
    report.errors.push(`${label} needs at least one rule.`);
    return;
  }
  const ruleNames = new Set();
  pack.rules.forEach((rule, index) => {
    const ruleLabel = `${label}.rules[${index}]`;
    if (!rule.name) report.errors.push(`${ruleLabel} missing name.`);
    if (!rule.triggerKind) report.errors.push(`${ruleLabel} missing triggerKind.`);
    if (!rule.actionKind) report.errors.push(`${ruleLabel} missing actionKind.`);
    if (rule.name && ruleNames.has(rule.name)) report.warnings.push(`${label} has duplicate rule name ${rule.name}.`);
    if (rule.name) ruleNames.add(rule.name);
  });
  report.summary.automationRules = pack.rules.length;
}

function readJsonFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON file ${filePath}: ${error.message}`);
  }
}

function bundleCountsFromSnapshot(snapshot) {
  return {
    companies: Array.isArray(snapshot.companies) ? snapshot.companies.length : 0,
    projects: Array.isArray(snapshot.projects) ? snapshot.projects.length : 0,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0,
    automations: Array.isArray(snapshot.automations) ? snapshot.automations.length : 0,
    templates: Array.isArray(snapshot.projectTemplates) ? snapshot.projectTemplates.length : 0,
    operatorActions: Array.isArray(snapshot.operatorActions) ? snapshot.operatorActions.length : 0
  };
}

function createReport(label) {
  return {
    label,
    errors: [],
    warnings: [],
    summary: {}
  };
}

function printReport(report) {
  console.log(`${report.label}: ${report.errors.length ? "invalid" : "valid"}`);
  if (Object.keys(report.summary).length) {
    Object.entries(report.summary).forEach(([key, value]) => console.log(`- ${key}: ${value}`));
  }
  report.warnings.forEach((warning) => console.log(`Warning: ${warning}`));
  report.errors.forEach((error) => console.log(`Error: ${error}`));
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
