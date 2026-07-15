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

[
  "CONTRIBUTING.md",
  "docs/contributor-path.md",
  "docs/starter-issues.md"
].forEach((relativePath) => {
  assertIncludes(relativePath, "checks.md", "must point contributors to the checks index");
  assertIncludes(relativePath, "npm run check", "must include the default local verification command");
});

assertIncludes("CONTRIBUTING.md", "docs/architecture.md", "must point frontend contributors to the architecture map");
assertIncludes("CONTRIBUTING.md", "docs/starter-issues.md", "must point contributors to starter issues");

assertIncludes("docs/contributor-path.md", "npm run test:golden", "must include browser verification guidance for UI work");
assertIncludes("docs/contributor-path.md", "npm run security", "must include security verification guidance");
assertIncludes("docs/contributor-path.md", "npm run test:importers", "must include migration fixture verification");

const starterIssues = read("docs/starter-issues.md");
[
  "npm run demo:check",
  "npm run release:check",
  "npm run test:golden:mobile",
  "npm run test:fixtures",
  "npm run trust",
  "npm run test:mcp",
  "npm run test:plugins"
].forEach((command) => {
  assert.ok(starterIssues.includes(command), `docs/starter-issues.md: must include focused command ${command}`);
});

console.log("Contributor docs regression passed");
