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
assertIncludes("sw.js", "./src/app.js?v=workspace-platform-v7", "must cache the current app bundle version");
assertIncludes("sw.js", "./src/styles.css?v=workspace-platform-v15", "must cache the current base stylesheet version");
assertIncludes("src/app.js", "function renderHtml", "must define a named render helper for HTML assignment");
assertIncludes("src/app.js", 'renderHtml(els.appView, `', "launch route should use the named render helper");
assertIncludes("server/api.js", 'require("./api-contracts")', "must import shared API contracts");
assertIncludes("src/project-launch.js", "window.AgoraProjectLaunch", "must expose the launch module API");

assert.equal(packageJson.scripts["test:project-launch"], "node scripts/project-launch-unit-test.js");
assert.equal(packageJson.scripts["code:quality"], "node scripts/code-quality-check.js");

const ceilings = {
  "src/app.js": 47500,
  "server/api.js": 8600,
  "src/styles.css": 14500
};

Object.entries(ceilings).forEach(([relativePath, ceiling]) => {
  const count = lineCount(relativePath);
  assert.ok(count <= ceiling, `${relativePath} has ${count} lines, above quality ceiling ${ceiling}`);
});

console.log("Code quality checks passed");
