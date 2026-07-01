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
    "id,title,project,status,priority,due_date,assignee,description,tags,completed_at,source_url,attachments,comments,comment_author,comment_created_at,closed",
    "legacy-1,\"Launch checklist\",\"Client Portal\",\"In Progress\",\"High\",\"2026-07-15\",\"Mara Ortiz\",\"Confirm portal copy and handoff tasks.\",\"client;launch\",\"\",\"https://legacy.example/tasks/1\",\"https://legacy.example/files/a.pdf;https://legacy.example/files/b.pdf\",\"Client wants launch copy by Friday.\",\"Mara Ortiz\",\"2026-07-03T10:00:00.000Z\",\"false\"",
    "legacy-2,\"Import legacy backlog\",\"Migration\",\"\",\"Normal\",\"2026-07-18\",\"Sam Patel\",\"Move approved backlog items into Agora.\",\"migration\",\"2026-07-05T12:30:00.000Z\",\"https://legacy.example/tasks/2\",\"\",\"\",\"\",\"\",\"true\"",
    ",,\"Migration\",\"Todo\",\"Low\",\"2026-07-20\",\"\",\"Missing title should be skipped.\",\"bad-row\",\"\",\"\",\"\",\"\",\"\",\"\",\"\""
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
  assert(plan.counts.comments === 1, "plan should preserve CSV task comments");
  assert(plan.counts.skipped === 1, "plan should record skipped rows");
  assert(plan.confidence >= 70, "plan confidence was too low");
  assert(plan.mappedFields.includes("title"), "title field was not mapped");
  assert(plan.mappedFields.includes("attachments"), "attachment field was not mapped");
  assert(plan.mappedFields.includes("comments"), "comment field was not mapped");
  assert(plan.warnings.some((warning) => warning.includes("skipped")), "skipped row warning missing");

  const importedTask = plan.tasks.find((task) => task.customFields.sourceId === "legacy-1");
  assert(importedTask, "source id metadata missing");
  assert(importedTask.status === "doing", "status normalization failed");
  assert(importedTask.priority === "high", "priority normalization failed");
  assert(importedTask.dueDate === "2026-07-15", "date normalization failed");
  assert(importedTask.tags.includes("generic-csv"), "source tag missing");
  assert(importedTask.customFields.sourceUrl === "https://legacy.example/tasks/1", "source URL metadata missing");
  assert(importedTask.customFields.attachmentUrls.length === 2, "attachment URLs metadata missing");
  assert(importedTask.customFields.importBatchId === plan.importBatchId, "import batch metadata missing");
  const completedTask = plan.tasks.find((task) => task.customFields.sourceId === "legacy-2");
  assert(completedTask.status === "done", "completed timestamp should imply done status");
  assert(completedTask.completedAt.startsWith("2026-07-05T12:30:00.000Z"), "completed timestamp was not preserved");
  assert(completedTask.archivedAt.startsWith("2026-07-05T12:30:00.000Z"), "closed CSV row should preserve archived timestamp");
  assert(plan.comments[0].body.includes("launch copy"), "CSV comment body missing");
  assert(plan.comments[0].taskId === importedTask.id, "CSV comment was not linked to imported task");

  const applied = applyMigrationPlan(workspace, plan);
  assert(applied.applied.tasks === 2, "apply task count mismatch");
  assert(applied.applied.comments === 1, "apply comment count mismatch");
  assert(applied.snapshot.tasks.length === workspace.tasks.length + 2, "snapshot task merge failed");
  assert(applied.snapshot.importHistory[0].id === plan.importBatchId, "import history missing");
  assert(applied.rollback.tasks.length === workspace.tasks.length, "rollback snapshot should preserve original task count");
  const reapplied = applyMigrationPlan(applied.snapshot, plan);
  assert(reapplied.applied.projects === 0, "duplicate source project should not be re-applied");
  assert(reapplied.applied.tasks === 0, "duplicate source task should not be re-applied");
  assert(reapplied.applied.comments === 0, "duplicate source comment should not be re-applied");

  const newWorkspace = applyMigrationPlan(workspace, { ...plan, mode: "new-workspace" });
  assert(newWorkspace.snapshot.workspace.name === "Legacy Import", "new workspace name mismatch");
  assert(newWorkspace.snapshot.tasks.length === 2, "new workspace should only include imported tasks");
  assert(newWorkspace.snapshot.comments.length === 1, "new workspace should include imported comments");

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

  const vendorSamples = [
    {
      source: "asana-csv",
      payload: "Task ID,Name,Project,Section,Assignee,Completed,Due Date,Notes,Tags\nasana-1,Publish launch page,Website,Launch,Mara,false,2026-07-22,Ship the landing page,marketing"
    },
    {
      source: "jira-csv",
      payload: "Issue key,Summary,Project name,Status,Priority,Assignee,Due date,Description,Labels\nAG-7,Fix onboarding bug,Agora,In Progress,High,Eli,2026-07-23,Resolve setup blocker,bug"
    },
    {
      source: "linear-csv",
      payload: "Identifier,Title,Team,Status,Priority,Assignee,Target Date,Description,Labels\nLIN-12,Design import review,Product,Review,Low,Nina,2026-07-24,Review migration UX,design"
    },
    {
      source: "clickup-csv",
      payload: "Task ID,Task Name,List,Status,Priority,Assignee,Due Date,Description,Tags\nCU-44,QA migrated workspace,Migration,to do,urgent,Sam,2026-07-25,Check imported data,qa"
    }
  ];

  for (const sample of vendorSamples) {
    const vendorPlan = createMigrationPlan({
      source: sample.source,
      payload: sample.payload,
      existingSnapshot: workspace
    });
    validateMigrationPlan(vendorPlan);
    assert(vendorPlan.source === sample.source, `${sample.source} plan source mismatch`);
    assert(vendorPlan.counts.tasks === 1, `${sample.source} should import one task`);
    assert(vendorPlan.tasks[0].customFields.sourceSystem === sample.source, `${sample.source} source metadata missing`);
    assert(vendorPlan.tasks[0].customFields.sourceId, `${sample.source} source id missing`);
    assert(vendorPlan.confidence >= 60, `${sample.source} confidence too low`);
  }

  console.log("Migration importer test passed.");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run();
