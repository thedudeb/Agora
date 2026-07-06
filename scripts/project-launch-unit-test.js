const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/project-launch.js"), "utf8");
const sandbox = { window: {} };

vm.runInNewContext(source, sandbox, { filename: "src/project-launch.js" });

const launch = sandbox.window.AgoraProjectLaunch;
const preferences = [
  {
    id: "kanban",
    label: "Kanban",
    value: "Board flow",
    detail: "Track flow",
    route: "board",
    starterProfile: "board",
    boardTemplate: "kanban"
  },
  {
    id: "scrum",
    label: "Scrum",
    value: "Sprint flow",
    detail: "Track sprints",
    route: "sprints",
    starterProfile: "scrum",
    boardTemplate: "sprint"
  }
];

assert.ok(launch, "AgoraProjectLaunch is exported on window");
assert.equal(typeof launch.normalizeWizard, "function");
assert.deepEqual(
  Array.from(launch.styleOptions(preferences), (option) => option.id),
  ["kanban", "scrum"]
);
assert.deepEqual(
  Array.from(launch.sourceOptions(), (option) => option.id),
  ["fresh", "import", "client", "template"]
);

const normalized = launch.normalizeWizard(
  {
    style: "unknown",
    source: "client",
    projectName: `  ${"A".repeat(160)}  `,
    companyName: "  Acme  ",
    ownerId: "mara",
    clientVisible: false,
    lastCreatedProjectId: 42
  },
  [{ id: "mara" }],
  { style: "scrum", source: "fresh" },
  [],
  preferences
);

assert.equal(normalized.style, "scrum");
assert.equal(normalized.source, "client");
assert.equal(normalized.projectName.length, 120);
assert.equal(normalized.companyName, "Acme");
assert.equal(normalized.ownerId, "mara");
assert.equal(normalized.clientVisible, false);
assert.equal(normalized.lastCreatedProjectId, "42");

const plan = launch.plan("kanban", "import");

assert.ok(plan.durationDays >= 21);
assert.equal(plan.tasks[0][0], "import-preview");
assert.ok(plan.tasks.some((task) => task[0] === "triage"));
assert.ok(plan.docs.some((doc) => doc[0] === "Migration Notes"));
assert.equal(plan.raid.length, 2);

assert.equal(launch.styleById(preferences, "missing").id, "kanban");
assert.equal(launch.sourceById("missing").id, "fresh");

console.log("Project launch module unit tests passed");
