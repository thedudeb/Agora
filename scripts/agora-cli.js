#!/usr/bin/env node
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const checkFiles = [
  "src/app.js",
  "server/api.js",
  "server/storage.js",
  "server/static.js",
  "server/env.js",
  "server/smoke-test.js",
  "server/supabase-verify.js",
  "server/portable-fixtures-test.js",
  "scripts/capture-screenshots.js",
  "scripts/agora-cli.js",
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
  api: {
    summary: "Run the dependency-free API smoke test",
    run: async () => runStep("API smoke test", [process.execPath, [path.join(ROOT, "server", "smoke-test.js")]])
  },
  supabase: {
    summary: "Verify a real Supabase project from .env",
    run: async () => runStep("Supabase verification", [process.execPath, [path.join(ROOT, "server", "supabase-verify.js")]])
  },
  screenshots: {
    summary: "Refresh launch screenshots with local Chrome/Chromium",
    run: async () => runStep("screenshot capture", [process.execPath, [path.join(ROOT, "scripts", "capture-screenshots.js")]])
  },
  bundle: {
    summary: "Inspect portable workspace bundles",
    run: async (args) => {
      const [subcommand, filePath] = args;
      if (subcommand !== "inspect" || !filePath) {
        throw new Error("Usage: npm run agora -- bundle inspect <file>");
      }
      inspectPortableBundle(filePath);
    }
  },
  marketplace: {
    summary: "Validate marketplace template and automation pack JSON",
    run: async (args) => {
      const [subcommand, filePath] = args;
      if (subcommand !== "validate" || !filePath) {
        throw new Error("Usage: npm run agora -- marketplace validate <file>");
      }
      validateMarketplaceFile(filePath);
    }
  },
  verify: {
    summary: "Run the standard power-user verification suite",
    run: async (args) => {
      const includeApi = !args.includes("--quick");
      const includeSupabase = args.includes("--supabase");
      await commands.check.run([]);
      await commands.fixtures.run([]);
      if (includeApi) await commands.api.run([]);
      else console.log("Skipping API smoke test because --quick was passed.");
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
  verify [--quick] [--supabase]  Run check + fixtures + API smoke test
  check                         Syntax-check project files
  fixtures                      Validate portable fixtures
  api                           Run API smoke test
  supabase                      Verify real Supabase setup from .env
  screenshots                   Refresh launch screenshots
  bundle inspect <file>         Inspect a portable workspace bundle
  marketplace validate <file>   Validate marketplace/template/automation JSON
  help                          Show this help

Options:
  --quick       With verify, skip the API smoke test
  --supabase    With verify, include real Supabase verification

Examples:
  npm run agora -- verify
  npm run agora -- verify --quick
  npm run agora -- verify --supabase
  npm run agora -- screenshots
  npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json
  npm run agora -- marketplace validate templates/marketplace.json
`);
}

function inspectPortableBundle(filePath) {
  const bundle = readJsonFile(filePath);
  const report = validatePortableBundle(bundle);
  printReport(report);
  if (report.errors.length) {
    throw new Error(`Portable bundle is invalid: ${report.errors.length} error${report.errors.length === 1 ? "" : "s"}`);
  }

  const workspaceFile = bundle.files.find((file) => file.path === "workspace.json" && file.kind === "json");
  const workspaceSnapshot = JSON.parse(workspaceFile.content);
  console.log("");
  console.log("Portable Bundle");
  console.log(`Workspace: ${bundle.workspace?.name || workspaceSnapshot.workspace?.name || "Unnamed"} (${bundle.workspace?.id || workspaceSnapshot.workspace?.id || "no-id"})`);
  console.log(`Export version: ${bundle.exportVersion}`);
  console.log(`Exported at: ${bundle.exportedAt || "unknown"}`);
  console.log(`Files: ${bundle.files.length}`);
  console.log("");
  console.log("Counts:");
  Object.entries(bundle.counts || bundleCountsFromSnapshot(workspaceSnapshot)).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
  console.log("");
  console.log("Included files:");
  bundle.files.forEach((file) => {
    console.log(`- ${file.path} (${file.kind || "unknown"}, ${Number(file.size || String(file.content || "").length)} bytes)`);
  });
}

function validateMarketplaceFile(filePath) {
  const payload = readJsonFile(filePath);
  const report = validateMarketplacePayload(payload);
  printReport(report);
  if (report.errors.length) {
    throw new Error(`Marketplace artifact is invalid: ${report.errors.length} error${report.errors.length === 1 ? "" : "s"}`);
  }

  console.log("");
  console.log("Marketplace artifact is valid.");
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

  ["README.md", "tasks.csv"].forEach((requiredPath) => {
    if (!bundle.files.some((file) => file.path === requiredPath)) {
      report.warnings.push(`Missing recommended file ${requiredPath}.`);
    }
  });

  return report;
}

function validateWorkspaceSnapshot(snapshot, report) {
  if (!isObject(snapshot)) {
    report.errors.push("workspace.json must be an object.");
    return;
  }
  if (!snapshot.workspace?.id) report.errors.push("workspace.json missing workspace.id.");
  if (!snapshot.workspace?.name) report.errors.push("workspace.json missing workspace.name.");
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
