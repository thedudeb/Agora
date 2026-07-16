const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function lineCount(relativePath) {
  return read(relativePath).split(/\r?\n/).length;
}

function assertIncludes(relativePath, needle, message) {
  assert.ok(read(relativePath).includes(needle), `${relativePath}: ${message}`);
}

const packageJson = JSON.parse(read("package.json"));

assert.ok(fs.existsSync(path.join(root, "src/project-launch.js")), "project launch module must exist");
assert.ok(fs.existsSync(path.join(root, "src/project-launch.css")), "project launch stylesheet must exist");
assert.ok(fs.existsSync(path.join(root, "server/api-contracts.js")), "API contract module must exist");
assertIncludes("index.html", "./src/project-launch.js", "must load the launch module before app.js");
assertIncludes("index.html", "./src/project-launch.css", "must load the launch stylesheet");
assertIncludes("sw.js", "./src/project-launch.js?v=workspace-platform-v1", "must cache the launch module for offline reloads");
assertIncludes("sw.js", "./src/project-launch.css?v=workspace-platform-v1", "must cache the launch stylesheet for offline reloads");
assertIncludes("sw.js", "./src/app.js?v=workspace-platform-v13", "must cache the current app bundle version");
assertIncludes("sw.js", "./src/app-inbox.js?v=workspace-platform-v2", "must cache Inbox route rendering");
assertIncludes("sw.js", "./src/app-recovery.js?v=workspace-platform-v2", "must cache Data and Recovery route rendering");
assertIncludes("sw.js", "./src/app-project-board.js?v=workspace-platform-v4", "must cache Project and Board route rendering");
assertIncludes("sw.js", "./src/app-runtime.js?v=workspace-platform-v2", "must cache the runtime event wiring");
assertIncludes("sw.js", "./src/styles.css?v=workspace-platform-v18", "must cache the current base stylesheet version");
assertIncludes("src/app.js", "function renderHtml", "must define a named render helper for HTML assignment");
assertIncludes("src/app.js", 'renderHtml(els.appView, `', "launch route should use the named render helper");
assertIncludes("server/api.js", 'require("./api-contracts")', "must import shared API contracts");
assertIncludes("src/project-launch.js", "window.AgoraProjectLaunch", "must expose the launch module API");

assert.equal(packageJson.scripts["test:project-launch"], "node scripts/project-launch-unit-test.js");
assert.equal(packageJson.scripts["test:product-surfaces"], "node scripts/product-surface-regression.js");
assert.equal(packageJson.scripts["test:modules"], "node scripts/module-registry-regression.js");
assert.equal(packageJson.scripts["test:board-commands"], "node scripts/board-command-regression.js");
assert.equal(packageJson.scripts["test:budgets"], "node scripts/performance-budget-check.js");
assert.equal(packageJson.scripts["test:project-board-quality"], "node scripts/project-board-quality-check.js");
assert.equal(packageJson.scripts["test:check-discoverability"], "node scripts/check-discoverability-regression.js");
assert.equal(packageJson.scripts["test:contributor-docs"], "node scripts/contributor-docs-regression.js");
assert.equal(packageJson.scripts["test:a11y"], "node scripts/accessibility-regression.js");
assert.equal(packageJson.scripts["test:golden:inbox"], "AGORA_GOLDEN_ONLY=inbox npm run test:golden");
assert.equal(packageJson.scripts["test:golden:recovery"], "AGORA_GOLDEN_ONLY=recovery npm run test:golden");
assert.equal(packageJson.scripts["test:golden:board"], "AGORA_GOLDEN_ONLY=board npm run test:golden");
assert.equal(packageJson.scripts["test:golden:project"], "AGORA_GOLDEN_ONLY=project npm run test:golden");
assert.equal(packageJson.scripts["test:golden:mobile"], "AGORA_GOLDEN_SUITE=mobile npm run test:golden");
assert.equal(packageJson.scripts["test:golden:readiness"], "AGORA_GOLDEN_ONLY=readiness npm run test:golden");
assert.equal(packageJson.scripts["code:quality"], "node scripts/code-quality-check.js");

const ceilings = {
  "src/app.js": 47500,
  "server/api.js": 8700,
  "src/styles.css": 14500
};

Object.entries(ceilings).forEach(([relativePath, ceiling]) => {
  const count = lineCount(relativePath);
  assert.ok(count <= ceiling, `${relativePath} has ${count} lines, above quality ceiling ${ceiling}`);
});

console.log("Code quality checks passed");
