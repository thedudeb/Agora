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

function sizeKb(relativePath) {
  return Math.ceil(fs.statSync(path.join(root, relativePath)).size / 1024);
}

function assertMax(actual, max, label) {
  assert.ok(actual <= max, `${label} is ${actual}, above budget ${max}`);
}

const lineBudgets = {
  "src/app.js": 43000,
  "src/app-project-board.js": 3000,
  "src/app-runtime.js": 3000,
  "src/app-recovery.js": 1600,
  "src/app-inbox.js": 900,
  "src/styles.css": 14600,
  "server/api.js": 8700
};

Object.entries(lineBudgets).forEach(([relativePath, maxLines]) => {
  assertMax(lineCount(relativePath), maxLines, `${relativePath} line count`);
});

const frontendModules = [
  "src/app.js",
  "src/app-project-board.js",
  "src/app-runtime.js",
  "src/app-recovery.js",
  "src/app-inbox.js",
  "src/project-launch.js"
];

const frontendLineTotal = frontendModules.reduce((total, relativePath) => total + lineCount(relativePath), 0);
assertMax(frontendLineTotal, 50500, "frontend module line total");

const sizeBudgetsKb = {
  "src/app.js": 1800,
  "src/app-project-board.js": 140,
  "src/app-runtime.js": 120,
  "src/app-recovery.js": 80,
  "src/app-inbox.js": 40,
  "src/styles.css": 300
};

Object.entries(sizeBudgetsKb).forEach(([relativePath, maxKb]) => {
  assertMax(sizeKb(relativePath), maxKb, `${relativePath} size KB`);
});

console.log("Performance budget checks passed");
