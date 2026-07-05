#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const manifest = readJson("packaging/release-manifest.json");
const pkg = readJson("package.json");
const requiredFiles = [
  "docs/release-candidate-v0.1-beta.md",
  "docs/release-candidate-handoff-template.md",
  "docs/release-checklist.md",
  "docs/qa-gate.md",
  "docs/acme-client-launch-demo.md",
  "docs/screenshot-demo-plan.md",
  "packaging/release-manifest.json"
];
const requiredGateCommands = [
  "npm run release:check",
  "npm run demo:check",
  "npm run package:check",
  "npm run trust",
  "npm run qa",
  "npm run security",
  "npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict"
];
const candidateDoc = read("docs/release-candidate-v0.1-beta.md");
const releaseChecklist = read("docs/release-checklist.md");

const checks = [
  check({
    id: "release-script",
    title: "Root package exposes the release candidate check",
    pass: pkg.scripts?.["release:check"] === "node scripts/release-candidate-check.js",
    fix: "Add npm script release:check."
  }),
  check({
    id: "required-files",
    title: "Release candidate handoff files exist",
    pass: missing(requiredFiles).length === 0,
    detail: missing(requiredFiles).length ? missing(requiredFiles).join(", ") : requiredFiles.join(", "),
    fix: "Restore missing release handoff files."
  }),
  check({
    id: "manifest-gate",
    title: "Release manifest declares the full release gate",
    pass: requiredGateCommands.every((command) => (manifest.releaseGate || []).includes(command)),
    detail: (manifest.releaseGate || []).join(" | "),
    fix: "Keep packaging/release-manifest.json releaseGate aligned with the documented release gate."
  }),
  check({
    id: "manifest-artifacts",
    title: "Release manifest points at the live candidate and handoff template",
    pass: ["docs/release-candidate-v0.1-beta.md", "docs/release-candidate-handoff-template.md"].every((file) => (manifest.handoffArtifacts || []).includes(file)),
    detail: (manifest.handoffArtifacts || []).join(", "),
    fix: "Add the live candidate doc and template to manifest.handoffArtifacts."
  }),
  check({
    id: "candidate-sections",
    title: "Live candidate doc has decision, evidence, demo, platform, and rollback sections",
    pass: [
      "## Release Decision",
      "## Evidence Ledger",
      "## Acme Demo Gate",
      "## Platform Evidence",
      "## Known Gaps",
      "## Rollback Plan"
    ].every((token) => candidateDoc.includes(token)),
    fix: "Keep docs/release-candidate-v0.1-beta.md structured as the live release record."
  }),
  check({
    id: "checklist-link",
    title: "Release checklist points operators at release:check",
    pass: releaseChecklist.includes("npm run release:check"),
    fix: "Add release:check to docs/release-checklist.md verification commands."
  })
];

const summary = checks.reduce((counts, item) => {
  counts.total += 1;
  counts[item.status] += 1;
  return counts;
}, { total: 0, pass: 0, fail: 0 });

console.log("Release Candidate Discipline Check");
console.log(`Status: ${summary.fail ? "FAIL" : "PASS"}`);
console.log(`Summary: ${summary.pass}/${summary.total} passed`);
console.log("");
checks.forEach((item) => {
  console.log(`[${item.status === "pass" ? "PASS" : "FAIL"}] ${item.title}`);
  if (item.detail) console.log(`  Detail: ${item.detail}`);
  if (item.status === "fail" && item.fix) console.log(`  Fix: ${item.fix}`);
});

if (summary.fail) process.exitCode = 1;

function check({ id, title, pass, detail = "", fix = "" }) {
  return { id, title, status: pass ? "pass" : "fail", detail, fix };
}

function missing(files) {
  return files.filter((file) => !fs.existsSync(path.join(ROOT, file)));
}

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(relativePath) {
  const contents = read(relativePath);
  return contents ? JSON.parse(contents) : {};
}
