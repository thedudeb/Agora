const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixturesDir = path.join(root, "tests", "fixtures");

function readJsonFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateWorkspaceSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === "object", "workspace snapshot must be an object");
  assert(snapshot.workspace?.id, "workspace snapshot needs workspace.id");
  assert(snapshot.workspace?.name, "workspace snapshot needs workspace.name");
  assert(Array.isArray(snapshot.companies), "workspace snapshot needs companies array");
  assert(Array.isArray(snapshot.projects), "workspace snapshot needs projects array");
  assert(Array.isArray(snapshot.tasks), "workspace snapshot needs tasks array");
  assert(Array.isArray(snapshot.automations), "workspace snapshot needs automations array");
  assert(snapshot.projects.every((project) => project.id && project.companyId && project.name), "projects need id, companyId, and name");
  assert(snapshot.tasks.every((task) => task.id && task.projectId && task.title), "tasks need id, projectId, and title");
}

function validateAutomationPack(payload) {
  assert(payload.type === "agora.automation-pack", "automation pack needs agora.automation-pack type");
  assert(payload.exportVersion === 1, "automation pack needs exportVersion 1");
  assert(payload.pack?.id, "automation pack needs pack.id");
  assert(payload.pack?.name, "automation pack needs pack.name");
  assert(Array.isArray(payload.pack.rules) && payload.pack.rules.length, "automation pack needs rules");
  payload.pack.rules.forEach((rule) => {
    assert(rule.name, "automation rule needs name");
    assert(rule.triggerKind, `automation rule ${rule.name} needs triggerKind`);
    assert(rule.actionKind, `automation rule ${rule.name} needs actionKind`);
  });
}

function validatePortableBundle(bundle) {
  assert(bundle.type === "agora.portable-workspace", "portable bundle needs agora.portable-workspace type");
  assert(bundle.exportVersion === 1, "portable bundle needs exportVersion 1");
  assert(bundle.workspace?.id, "portable bundle needs workspace.id");
  assert(Array.isArray(bundle.files), "portable bundle needs files array");
  const workspaceFile = bundle.files.find((file) => file.path === "workspace.json" && file.kind === "json");
  assert(workspaceFile?.content, "portable bundle needs workspace.json file content");
  validateWorkspaceSnapshot(JSON.parse(workspaceFile.content));
  assert(bundle.files.some((file) => file.path === "README.md"), "portable bundle should include README.md");
  assert(bundle.files.some((file) => file.path === "tasks.csv"), "portable bundle should include tasks.csv");
}

function main() {
  validateWorkspaceSnapshot(readJsonFixture("workspace.json"));
  validateAutomationPack(readJsonFixture("automation-pack.json"));
  validatePortableBundle(readJsonFixture("portable-workspace-bundle.json"));
  console.log("Portable fixture validation passed");
}

main();
