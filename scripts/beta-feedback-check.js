#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const pkg = readJson("package.json");
const loopDoc = read("docs/beta-feedback-loop.md");
const notes = read("docs/beta-notes.md");
const script = read("docs/beta-test-script.md");
const golden = read("scripts/golden-path-qa.js");
const app = read("src/app.js");
const api = read("server/api.js");
const lowerLoopDoc = loopDoc.toLowerCase();

const checks = [
  check({
    title: "Beta feedback command is exposed",
    pass: pkg.scripts?.["beta:check"] === "node scripts/beta-feedback-check.js",
    fix: "Add npm script beta:check."
  }),
  check({
    title: "Beta feedback loop doc defines testers, intake, triage, email, and data safety",
    pass: [
      "## Tester Profile",
      "## Intake Paths",
      "## Triage Cadence",
      "## Core Workflow Scorecard",
      "## Email And Taskboard Proof",
      "## Data Safety"
    ].every((section) => loopDoc.includes(section)),
    fix: "Keep docs/beta-feedback-loop.md structured as the beta operating loop."
  }),
  check({
    title: "Beta docs link the feedback loop",
    pass: notes.includes("beta-feedback-loop.md") && script.includes("beta-feedback-loop.md"),
    fix: "Link docs/beta-feedback-loop.md from beta notes and beta test script."
  }),
  check({
    title: "Beta test script scores the core Acme workflow before wishlist collection",
    pass: [
      "## Core Workflow Scorecard",
      "First win",
      "Client request to work",
      "Client safety",
      "Recovery trust",
      "Portability",
      "Feedback loop",
      "before collecting wishlist ideas"
    ].every((token) => script.includes(token)),
    fix: "Keep docs/beta-test-script.md focused on the Acme scorecard before power-user follow-up."
  }),
  check({
    title: "App exposes feedback form and request board routes",
    pass: ["feedback: renderPublicFeedbackForm", "\"feature-requests\":", "Feature Requests", "Feature request added to the taskboard"].every((token) => app.includes(token)),
    fix: "Keep public feedback and feature request taskboard surfaces available."
  }),
  check({
    title: "API keeps public feature requests opt-in and email-aware",
    pass: ["AGORA_PUBLIC_FEATURE_REQUESTS", "AGORA_FEATURE_REQUEST_EMAIL", "createPublicFeatureRequest"].every((token) => api.includes(token)),
    fix: "Keep public feature requests opt-in, rate-limited, and owner-email aware."
  }),
  check({
    title: "Golden QA covers feedback surfaces",
    pass: ["suite: \"feedback\"", "Beta feedback command center", "Public feedback form", "Send Feature Request"].every((token) => golden.includes(token)),
    fix: "Keep feedback route and public form in browser golden-path QA."
  }),
  check({
    title: "Beta loop records privacy and no-real-data guidance",
    pass: ["real customer data", "service role", "private emails", "portable bundle", "rate limits"].every((token) => lowerLoopDoc.includes(token)),
    fix: "Document what beta testers should not enter and how feedback is rate-limited/exportable."
  })
];

const summary = checks.reduce((counts, item) => {
  counts.total += 1;
  counts[item.status] += 1;
  return counts;
}, { total: 0, pass: 0, fail: 0 });

console.log("Beta Feedback Loop Check");
console.log(`Status: ${summary.fail ? "FAIL" : "PASS"}`);
console.log(`Summary: ${summary.pass}/${summary.total} passed`);
console.log("");
checks.forEach((item) => {
  console.log(`[${item.status === "pass" ? "PASS" : "FAIL"}] ${item.title}`);
  if (item.status === "fail" && item.fix) console.log(`  Fix: ${item.fix}`);
});

if (summary.fail) process.exitCode = 1;

function check({ title, pass, fix = "" }) {
  return { title, status: pass ? "pass" : "fail", fix };
}

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(relativePath) {
  const contents = read(relativePath);
  return contents ? JSON.parse(contents) : {};
}
