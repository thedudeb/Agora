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

const hints = {
  lines: "Move route-specific rendering into an owned route module, or trim repeated derivations before raising the budget.",
  frontendTotal: "Split large product surfaces into focused modules and keep shared helpers in src/app.js only when they are truly reused.",
  size: "Remove duplicated markup/data tables, defer non-critical proof content, or split cached route modules before increasing the asset budget."
};

function assertMax(actual, max, label, hint) {
  assert.ok(actual <= max, `${label} is ${actual}, above budget ${max}. ${hint}`);
}

const lineBudgets = {
  "src/app.js": 43000,
  "src/app-project-board.js": 3000,
  "src/sparkz-pilot.js": 700,
  "src/app-runtime.js": 3000,
  "src/app-recovery.js": 1600,
  "src/app-inbox.js": 900,
  "src/styles.css": 14600,
  "server/api.js": 8700
};

Object.entries(lineBudgets).forEach(([relativePath, maxLines]) => {
  assertMax(lineCount(relativePath), maxLines, `${relativePath} line count`, hints.lines);
});

const frontendModules = [
  "src/app.js",
  "src/app-project-board.js",
  "src/sparkz-pilot.js",
  "src/app-runtime.js",
  "src/app-recovery.js",
  "src/app-inbox.js",
  "src/project-launch.js"
];

const frontendLineTotal = frontendModules.reduce((total, relativePath) => total + lineCount(relativePath), 0);
assertMax(frontendLineTotal, 50500, "frontend module line total", hints.frontendTotal);

const sizeBudgetsKb = {
  "src/app.js": 1800,
  "src/app-project-board.js": 140,
  "src/sparkz-pilot.js": 40,
  "src/app-runtime.js": 120,
  "src/app-recovery.js": 80,
  "src/app-inbox.js": 40,
  "src/styles.css": 300
};

Object.entries(sizeBudgetsKb).forEach(([relativePath, maxKb]) => {
  assertMax(sizeKb(relativePath), maxKb, `${relativePath} size KB`, hints.size);
});

console.log("Performance budget checks passed");
