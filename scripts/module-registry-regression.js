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

function scriptSources() {
  return [...read("index.html").matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
}

function assertScriptBefore(first, second) {
  const sources = scriptSources();
  const firstIndex = sources.indexOf(first);
  const secondIndex = sources.indexOf(second);
  assert.ok(firstIndex >= 0, `index.html: missing script ${first}`);
  assert.ok(secondIndex >= 0, `index.html: missing script ${second}`);
  assert.ok(firstIndex < secondIndex, `index.html: ${first} must load before ${second}`);
}

function assertCached(scriptPath) {
  assertIncludes("sw.js", scriptPath, `service worker must cache ${scriptPath}`);
}

function assertSyntaxChecked(sourcePath) {
  assertIncludes("package.json", `node --check ${sourcePath}`, `package check must syntax-check ${sourcePath}`);
}

const moduleScripts = [
  "./src/app.js?v=workspace-platform-v13",
  "./src/app-inbox.js?v=workspace-platform-v2",
  "./src/app-recovery.js?v=workspace-platform-v2",
  "./src/app-project-board.js?v=workspace-platform-v4",
  "./src/app-runtime.js?v=workspace-platform-v2"
];

moduleScripts.slice(0, -1).forEach((script, index) => {
  assertScriptBefore(script, moduleScripts[index + 1]);
});
moduleScripts.forEach(assertCached);

[
  "src/app.js",
  "src/app-inbox.js",
  "src/app-recovery.js",
  "src/app-project-board.js",
  "src/app-runtime.js"
].forEach(assertSyntaxChecked);

assertIncludes("src/app.js", "function renderDataManagement()", "keeps Data route wrapper in the app bundle");
assertIncludes("src/app.js", "function renderProjectPage()", "keeps Project route wrapper in the app bundle");
assertIncludes("src/app.js", "function renderBoard()", "keeps Board route wrapper in the app bundle");
assertIncludes("src/app-recovery.js", "function renderDataManagementRoute", "keeps Data route implementation in recovery module");
assertIncludes("src/app-project-board.js", "function renderProjectPageRoute", "keeps Project route implementation in project-board module");
assertIncludes("src/app-project-board.js", "function renderBoardRoute", "keeps Board route implementation in project-board module");
assertIncludes("src/app-runtime.js", "render();", "keeps app bootstrap in runtime module");

console.log("Module registry regression checks passed");
