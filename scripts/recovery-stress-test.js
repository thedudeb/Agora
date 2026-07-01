#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(ROOT, "tests", "fixtures");
const MAX_BACKUPS = 20;

main();

function main() {
  const baseSnapshot = readJsonFixture("workspace.json");
  const bundle = readJsonFixture("portable-workspace-bundle.json");
  const imported = parsePortableWorkspaceInput(JSON.stringify(bundle));

  validateWorkspaceSnapshot(baseSnapshot, "base fixture");
  validateWorkspaceSnapshot(imported.snapshot, "portable bundle workspace");
  assert(imported.preview.sourceType === "portable-bundle", "portable bundle should produce a portable preview");
  assert(imported.preview.counts.projects === 1, "portable preview should count projects");
  assert(imported.preview.counts.tasks === 1, "portable preview should count tasks");

  const backup = workspaceBackupRecord(baseSnapshot, "Before import");
  const importedState = applyWorkspaceSnapshot(createScratchWorkspace(), imported.snapshot);
  validateWorkspaceSnapshot(importedState, "imported replacement");
  assert(importedState.workspace.id === imported.snapshot.workspace.id, "replacement import should adopt workspace id");
  assert(importedState.projects[0].name === "Fixture Launch", "replacement import should include fixture project");

  importedState.tasks[0].title = "Mutated after import";
  assert(imported.snapshot.tasks[0].title === "Validate portable import", "import should not share task references with source snapshot");

  const restored = restoreWorkspaceBackup(importedState, backup);
  validateWorkspaceSnapshot(restored, "restored backup");
  assert(restored.workspace.id === importedState.workspace.id, "restore should preserve current workspace id");
  assert(restored.workspace.name === baseSnapshot.workspace.name, "restore should recover backup workspace name");
  assert(restored.tasks[0].title === "Validate portable import", "restore should recover original task title");

  const newWorkspace = importAsNewWorkspace(imported.snapshot, "Recovered Client Workspace");
  validateWorkspaceSnapshot(newWorkspace, "new workspace import");
  assert(newWorkspace.workspace.id !== imported.snapshot.workspace.id, "new workspace import should use a fresh id");
  assert(newWorkspace.workspace.name === "Recovered Client Workspace", "new workspace import should apply requested name");
  assert(newWorkspace.selectedRoute === "dashboard", "new workspace import should land on dashboard");

  const backups = normalizeWorkspaceBackups([
    workspaceBackupRecord(baseSnapshot, "Newest", "2026-07-02T00:00:00.000Z"),
    workspaceBackupRecord(imported.snapshot, "Oldest", "2026-07-01T00:00:00.000Z"),
    ...Array.from({ length: 24 }, (_, index) => workspaceBackupRecord(baseSnapshot, `Extra ${index}`, `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`))
  ]);
  assert(backups.length === MAX_BACKUPS, "backup list should be capped");
  assert(backups[0].label === "Newest", "backup list should sort newest first");
  assert(!backups.some((item) => item.label === "Extra 0"), "backup cap should discard oldest records");

  console.log("Recovery stress test passed");
}

function readJsonFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
}

function parsePortableWorkspaceInput(rawJson) {
  const parsed = JSON.parse(rawJson);
  if (parsed?.type === "agora.portable-workspace" && Array.isArray(parsed.files)) {
    const workspaceFile = parsed.files.find((file) => file.path === "workspace.json" && file.kind === "json");
    assert(workspaceFile?.content, "portable bundle needs workspace.json content");
    const snapshot = JSON.parse(workspaceFile.content);
    return {
      snapshot,
      preview: {
        sourceType: "portable-bundle",
        workspaceName: snapshot.workspace?.name || parsed.workspace?.name || "Imported workspace",
        counts: snapshotCounts(snapshot),
        files: parsed.files.map((file) => ({
          path: file.path,
          kind: file.kind,
          size: Number(file.size || String(file.content || "").length)
        }))
      }
    };
  }

  return {
    snapshot: parsed,
    preview: {
      sourceType: "workspace-json",
      workspaceName: parsed.workspace?.name || "Imported workspace",
      counts: snapshotCounts(parsed),
      files: []
    }
  };
}

function createScratchWorkspace() {
  return {
    selectedRoute: "dashboard",
    selectedProject: "all",
    selectedCompany: "all",
    workspace: {
      id: "workspace-scratch",
      name: "Scratch Workspace",
      slug: "scratch-workspace"
    },
    companies: [],
    projects: [],
    tasks: [],
    automations: [],
    projectTemplates: [],
    operatorActions: []
  };
}

function applyWorkspaceSnapshot(currentState, snapshot) {
  return {
    ...clone(currentState),
    ...clone(snapshot),
    selectedRoute: snapshot.selectedRoute || "dashboard",
    selectedProject: snapshot.selectedProject || "all",
    selectedCompany: snapshot.selectedCompany || "all"
  };
}

function restoreWorkspaceBackup(currentState, backup) {
  const snapshot = clone(backup.snapshot);
  return applyWorkspaceSnapshot(currentState, {
    ...snapshot,
    selectedRoute: "data",
    workspace: {
      ...snapshot.workspace,
      id: currentState.workspace.id,
      name: snapshot.workspace?.name || currentState.workspace.name,
      slug: snapshot.workspace?.slug || currentState.workspace.slug
    }
  });
}

function importAsNewWorkspace(snapshot, name) {
  const next = clone(snapshot);
  next.workspace = {
    ...next.workspace,
    id: uniqueWorkspaceId(name),
    name,
    slug: slugFromName(name)
  };
  return applyWorkspaceSnapshot(createScratchWorkspace(), {
    ...next,
    selectedRoute: "dashboard",
    selectedProject: "all",
    selectedCompany: "all"
  });
}

function workspaceBackupRecord(snapshot, label = "Manual backup", createdAt = "2026-07-01T00:00:00.000Z") {
  return {
    id: `backup-${slugFromName(label)}-${createdAt.slice(0, 10)}`,
    workspaceId: snapshot.workspace?.id || "workspace",
    name: snapshot.workspace?.name || "Untitled workspace",
    label,
    createdAt,
    snapshot: clone(snapshot)
  };
}

function normalizeWorkspaceBackups(backups) {
  return backups
    .filter((backup) => backup?.id && backup?.snapshot)
    .map((backup) => ({
      id: backup.id,
      workspaceId: backup.workspaceId || backup.snapshot.workspace?.id || "workspace",
      name: backup.name || backup.snapshot.workspace?.name || "Untitled workspace",
      label: backup.label || "Manual backup",
      createdAt: backup.createdAt || new Date().toISOString(),
      snapshot: clone(backup.snapshot)
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_BACKUPS);
}

function validateWorkspaceSnapshot(snapshot, label) {
  assert(isObject(snapshot), `${label} must be an object`);
  assert(snapshot.workspace?.id, `${label} needs workspace.id`);
  assert(snapshot.workspace?.name, `${label} needs workspace.name`);
  ["companies", "projects", "tasks", "automations"].forEach((key) => {
    assert(Array.isArray(snapshot[key]), `${label} needs ${key} array`);
  });
  snapshot.projects.forEach((project, index) => {
    assert(project.id && project.companyId && project.name, `${label} project ${index} needs id, companyId, and name`);
  });
  snapshot.tasks.forEach((task, index) => {
    assert(task.id && task.projectId && task.title, `${label} task ${index} needs id, projectId, and title`);
  });
}

function snapshotCounts(snapshot) {
  return {
    companies: Array.isArray(snapshot.companies) ? snapshot.companies.length : 0,
    projects: Array.isArray(snapshot.projects) ? snapshot.projects.length : 0,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0,
    automations: Array.isArray(snapshot.automations) ? snapshot.automations.length : 0,
    templates: Array.isArray(snapshot.projectTemplates) ? snapshot.projectTemplates.length : 0,
    operatorActions: Array.isArray(snapshot.operatorActions) ? snapshot.operatorActions.length : 0
  };
}

function uniqueWorkspaceId(name) {
  return `workspace-${slugFromName(name)}-imported`;
}

function slugFromName(name) {
  return String(name || "workspace")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "workspace";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
