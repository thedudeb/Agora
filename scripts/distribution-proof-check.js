#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const manifest = readJson("packaging/release-manifest.json");
const proofDoc = read("docs/distribution-proof.md");
const lowerProofDoc = proofDoc.toLowerCase();
const pkg = readJson("package.json");

const channels = manifest.channels || [];
const requiredSections = [
  "## Release Evidence Matrix",
  "## Manual Device Proof",
  "## Accepted Beta Gaps",
  "## Release Sign-Off Rule"
];
const requiredCommands = [
  "npm run distribution:check",
  "npm run distribution:evidence",
  "npm run package:check",
  "npm run verify:production",
  "npm run drill:recovery"
];

const checks = [
  check({
    title: "Distribution proof command is exposed",
    pass: pkg.scripts?.["distribution:check"] === "node scripts/distribution-proof-check.js",
    fix: "Add npm script distribution:check."
  }),
  check({
    title: "Distribution evidence helper is exposed",
    pass: pkg.scripts?.["distribution:evidence"] === "node scripts/distribution-evidence.js",
    fix: "Add npm script distribution:evidence."
  }),
  check({
    title: "Distribution proof doc has required release sections",
    pass: requiredSections.every((section) => proofDoc.includes(section)),
    fix: "Keep docs/distribution-proof.md structured as a per-release evidence ledger."
  }),
  check({
    title: "Every manifest channel appears in the evidence matrix",
    pass: channels.every((channel) => proofDoc.includes(`| ${channel.id} |`)),
    detail: channels.map((channel) => channel.id).join(", "),
    fix: "Add every release-manifest channel id to docs/distribution-proof.md."
  }),
  check({
    title: "Distribution proof names the required gate commands",
    pass: requiredCommands.every((command) => lowerProofDoc.includes(command.toLowerCase())),
    fix: "Add release gate commands to docs/distribution-proof.md."
  }),
  check({
    title: "Distribution proof records offline and rollback evidence",
    pass: ["airplane-mode", "offline", "rollback", "portable bundle", "server backup"].every((token) => lowerProofDoc.includes(token)),
    fix: "Document offline proof, rollback proof, portable bundle, and server backup evidence."
  })
];

const summary = checks.reduce((counts, item) => {
  counts.total += 1;
  counts[item.status] += 1;
  return counts;
}, { total: 0, pass: 0, fail: 0 });

console.log("Distribution Proof Check");
console.log(`Status: ${summary.fail ? "FAIL" : "PASS"}`);
console.log(`Summary: ${summary.pass}/${summary.total} passed`);
console.log("");
checks.forEach((item) => {
  console.log(`[${item.status === "pass" ? "PASS" : "FAIL"}] ${item.title}`);
  if (item.detail) console.log(`  Detail: ${item.detail}`);
  if (item.status === "fail" && item.fix) console.log(`  Fix: ${item.fix}`);
});

if (summary.fail) process.exitCode = 1;

function check({ title, pass, detail = "", fix = "" }) {
  return { title, status: pass ? "pass" : "fail", detail, fix };
}

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(relativePath) {
  const contents = read(relativePath);
  return contents ? JSON.parse(contents) : {};
}
