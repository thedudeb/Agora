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

assertIncludes("src/app-project-board.js", 'commandId: "board:show-all"', "filtered board empty state must expose the show-all command");
assertIncludes("src/app-project-board.js", "No cards match the current board filters.", "filtered board empty state must explain why the board is blank");
assertIncludes("src/app-project-board.js", "Your cards are still safe.", "filtered board empty state must reassure users that data is not gone");
assertIncludes("src/app-project-board.js", "function createBoardRenderContext", "board rendering must keep the shared render context");

const appSource = read("src/app.js");
const commandStart = appSource.indexOf('if (commandId === "board:show-all")');
assert.ok(commandStart >= 0, "src/app.js: executeCommand must handle board:show-all");
const commandBlock = appSource.slice(commandStart, appSource.indexOf('if (commandId === "create:project")', commandStart));

[
  'state.selectedProject = "all";',
  'company: "all"',
  'assignee: "all"',
  'status: "all"',
  'priority: "all"',
  'query: ""',
  "renderFilters();",
  "render();",
  'showToast("Board filters cleared", "success");'
].forEach((needle) => {
  assert.ok(commandBlock.includes(needle), `src/app.js: board:show-all must include ${needle}`);
});

console.log("Board command regression checks passed");
