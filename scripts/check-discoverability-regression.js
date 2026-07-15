const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertMentions(relativePath, needles) {
  const source = read(relativePath);
  needles.forEach((needle) => {
    assert.ok(source.includes(needle), `${relativePath}: must mention ${needle}`);
  });
}

const criticalGates = [
  "npm run check",
  "npm run test:golden",
  "npm run test:modules",
  "npm run test:budgets",
  "npm run security"
];

assertMentions("docs/checks.md", [
  ...criticalGates,
  "npm run qa",
  "npm run test:board-commands",
  "npm run test:project-board-quality",
  "npm run test:importers",
  "npm run package:check",
  "npm run trust"
]);

assertMentions("README.md", [
  "docs/checks.md",
  "npm run check",
  "npm run test:golden",
  "npm run security"
]);

assertMentions("CONTRIBUTING.md", [
  "docs/checks.md",
  "npm run check",
  "npm run test:modules",
  "npm run test:budgets"
]);

assertMentions("docs/qa-gate.md", [
  "docs/checks.md",
  "npm run test:golden",
  "npm run test:modules",
  "npm run test:budgets"
]);

console.log("Check discoverability regression passed");
