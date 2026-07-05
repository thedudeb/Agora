#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { buildDemoLinks, readCatalog } = require("./demo-links");

const ROOT = path.resolve(__dirname, "..");
const catalog = readCatalog();
const acmeDemo = catalog.demos.find((demo) => demo.id === "acme-client-launch");
const runbook = read("docs/hosted-demo-runbook.md");
const runbookSearch = runbook.toLowerCase();
const demoDocs = read("docs/demo-workspaces.md");
const acmeDocs = read("docs/acme-client-launch-demo.md");
const demoLinks = buildDemoLinks(catalog, { base: "https://demo.example.com", demo: "acme-client-launch" });
const acmeLinks = demoLinks.demos[0];

const checks = [
  check({
    title: "Canonical Acme demo exists first in the catalog",
    pass: catalog.demos[0]?.id === "acme-client-launch" && Boolean(acmeDemo),
    fix: "Keep acme-client-launch as the first/default demo in demos/workspaces.json."
  }),
  check({
    title: "Acme demo has a complete six-step route sequence",
    pass: acmeLinks?.tour?.length === 6 && [
      "command-center",
      "project-backlog",
      "visibility",
      "project",
      "reports",
      "data"
    ].every((route, index) => acmeLinks.tour[index]?.route === route),
    detail: acmeLinks?.tour?.map((stop) => stop.url).join(" | "),
    fix: "Keep the Acme tour aligned with the hosted demo handoff."
  }),
  check({
    title: "Hosted runbook documents safe public demo settings",
    pass: [
      "agora_demo_auth=false",
      "agora_passwordless_auth=false",
      "no real customer data",
      "reset cadence",
      "agora_golden_suite=demo npm run test:golden"
    ].every((token) => runbookSearch.includes(token)),
    fix: "Document safe auth, data hygiene, reset cadence, and demo golden QA in docs/hosted-demo-runbook.md."
  }),
  check({
    title: "Demo docs point at the hosted demo runbook",
    pass: demoDocs.includes("hosted-demo-runbook.md") && acmeDocs.includes("hosted-demo-runbook.md"),
    fix: "Link docs/hosted-demo-runbook.md from demo workspace and Acme handoff docs."
  }),
  check({
    title: "Generated hosted links include story proof routes",
    pass: [
      "route=command-center",
      "demoAction=sampleAgencyWorkspace",
      "route=project-backlog",
      "route=visibility",
      "route=project",
      "project=launch",
      "tab=timeline",
      "route=reports",
      "route=data",
      "demoAction=recoveryPlan"
    ].every((token) => JSON.stringify(acmeLinks).includes(token)),
    fix: "Keep demo-links route URL generation compatible with hosted Acme links."
  })
];

const summary = checks.reduce((counts, item) => {
  counts.total += 1;
  counts[item.status] += 1;
  return counts;
}, { total: 0, pass: 0, fail: 0 });

console.log("Hosted Demo Check");
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
