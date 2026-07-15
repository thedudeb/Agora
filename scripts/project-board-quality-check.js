const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(relativePath, needle, message) {
  assert.ok(read(relativePath).includes(needle), `${relativePath}: ${message}`);
}

const source = read("src/app-project-board.js");

assertIncludes("src/app-project-board.js", "function createBoardRenderContext", "must keep a single board render context");
assertIncludes("src/app-project-board.js", "groups: boardSwimlaneGroups(activeBoardTasks, board)", "must derive board swimlanes once per render");
assertIncludes("src/app-project-board.js", "taskOrder: new Map(state.tasks.map((task, index) => [task.id, index]))", "must avoid repeated state.tasks.findIndex calls during board sorting");
assertIncludes("src/app-project-board.js", "const fallbackIndex = context?.taskOrder?.get(task.id)", "board sort fallback must use the render-context task order map");
assertIncludes("src/app-project-board.js", "allProjectTasks,", "project overview details must receive the precomputed project task set");
assertIncludes("src/app-project-board.js", "const { allProjectTasks, openTasks, overdueTasks, filteredProjectTasks, nextMilestone, trackedMinutes } = details;", "project command center must consume precomputed project tasks");
assertIncludes("src/app-project-board.js", "const rows = projectTeamLoadRows(project.id, details.openTasks);", "team load panel must reuse open project tasks");

const commandCenterStart = source.indexOf("function renderProjectCommandCenter(project, details)");
const commandCenterEnd = source.indexOf("function projectRaidItems", commandCenterStart);
assert.ok(commandCenterStart >= 0 && commandCenterEnd > commandCenterStart, "src/app-project-board.js: could not locate renderProjectCommandCenter");
const commandCenter = source.slice(commandCenterStart, commandCenterEnd);
assert.ok(!commandCenter.includes("getProjectTasks(project.id, false)"), "src/app-project-board.js: renderProjectCommandCenter must not recompute all project tasks");

const kanbanStart = source.indexOf("function renderKanbanBoard(tasks");
const kanbanEnd = source.indexOf("function renderProjectBoard", kanbanStart);
assert.ok(kanbanStart >= 0 && kanbanEnd > kanbanStart, "src/app-project-board.js: could not locate renderKanbanBoard");
const kanban = source.slice(kanbanStart, kanbanEnd);
assert.ok(kanban.includes("const context = createBoardRenderContext(tasks);"), "src/app-project-board.js: renderKanbanBoard must create a shared render context");
assert.ok(kanban.includes("renderBoardColumn(column, group.tasks, context)"), "src/app-project-board.js: renderKanbanBoard must pass context to column rendering");

console.log("Project board quality checks passed");
