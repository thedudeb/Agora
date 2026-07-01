const fs = require("node:fs");
const path = require("node:path");
const {
  applyMigrationPlan,
  createMigrationPlan,
  detectMigrationSource,
  validateMigrationPlan
} = require("./migration-importer");

const ROOT = path.resolve(__dirname, "..");

function run() {
  const workspace = readJson("tests/fixtures/workspace.json");
  const csv = [
    "id,title,project,status,priority,due_date,assignee,description,tags",
    "legacy-1,\"Launch checklist\",\"Client Portal\",\"In Progress\",\"High\",\"2026-07-15\",\"Mara Ortiz\",\"Confirm portal copy and handoff tasks.\",\"client;launch\"",
    "legacy-2,\"Import legacy backlog\",\"Migration\",\"Todo\",\"Normal\",\"2026-07-18\",\"Sam Patel\",\"Move approved backlog items into Agora.\",\"migration\"",
    ",,\"Migration\",\"Todo\",\"Low\",\"2026-07-20\",\"\",\"Missing title should be skipped.\",\"bad-row\""
  ].join("\n");

  assert(detectMigrationSource(csv, "tasks.csv") === "generic-csv", "CSV detection failed");

  const plan = createMigrationPlan({
    source: "generic-csv",
    payload: csv,
    existingSnapshot: workspace,
    workspaceName: "Legacy Import"
  });

  validateMigrationPlan(plan);
  assert(plan.type === "agora.migration-plan", "plan type mismatch");
  assert(plan.source === "generic-csv", "plan source mismatch");
  assert(plan.counts.projects === 2, "plan should create two projects");
  assert(plan.counts.tasks === 2, "plan should create two tasks");
  assert(plan.counts.skipped === 1, "plan should record skipped rows");
  assert(plan.confidence >= 70, "plan confidence was too low");
  assert(plan.mappedFields.includes("title"), "title field was not mapped");
  assert(plan.warnings.some((warning) => warning.includes("skipped")), "skipped row warning missing");

  const importedTask = plan.tasks.find((task) => task.customFields.sourceId === "legacy-1");
  assert(importedTask, "source id metadata missing");
  assert(importedTask.status === "doing", "status normalization failed");
  assert(importedTask.priority === "high", "priority normalization failed");
  assert(importedTask.dueDate === "2026-07-15", "date normalization failed");
  assert(importedTask.tags.includes("generic-csv"), "source tag missing");
  assert(importedTask.customFields.importBatchId === plan.importBatchId, "import batch metadata missing");

  const applied = applyMigrationPlan(workspace, plan);
  assert(applied.applied.tasks === 2, "apply task count mismatch");
  assert(applied.snapshot.tasks.length === workspace.tasks.length + 2, "snapshot task merge failed");
  assert(applied.snapshot.importHistory[0].id === plan.importBatchId, "import history missing");
  assert(applied.rollback.tasks.length === workspace.tasks.length, "rollback snapshot should preserve original task count");

  const newWorkspace = applyMigrationPlan(workspace, { ...plan, mode: "new-workspace" });
  assert(newWorkspace.snapshot.workspace.name === "Legacy Import", "new workspace name mismatch");
  assert(newWorkspace.snapshot.tasks.length === 2, "new workspace should only include imported tasks");

  const trelloPayload = fs.readFileSync(path.join(ROOT, "tests/fixtures/trello-board.json"), "utf8");
  assert(detectMigrationSource(trelloPayload, "trello-board.json") === "trello-json", "Trello detection failed");
  const trelloPlan = createMigrationPlan({
    source: "trello-json",
    payload: trelloPayload,
    existingSnapshot: workspace
  });
  validateMigrationPlan(trelloPlan);
  assert(trelloPlan.source === "trello-json", "Trello plan source mismatch");
  assert(trelloPlan.counts.projects === 1, "Trello board should become one project");
  assert(trelloPlan.counts.tasks === 1, "Trello closed cards should be skipped");
  assert(trelloPlan.counts.comments === 1, "Trello comments should be preserved");
  assert(trelloPlan.tasks[0].title === "Approve launch brief", "Trello card title was not imported");
  assert(trelloPlan.tasks[0].status === "doing", "Trello list status was not mapped");
  assert(trelloPlan.tasks[0].customFields.sourceUrl.includes("trello.example"), "Trello source URL metadata missing");
  assert(trelloPlan.comments[0].body.includes("Client approved"), "Trello card comment missing");

  console.log("Migration importer test passed.");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run();
