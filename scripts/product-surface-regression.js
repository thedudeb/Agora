const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function includes(relativePath, needle, message) {
  assert.ok(read(relativePath).includes(needle), `${relativePath}: ${message}`);
}

includes("index.html", "./src/app-runtime.js?v=workspace-platform-v1", "loads runtime wiring after the app bundle");
includes("sw.js", "./src/app-runtime.js?v=workspace-platform-v1", "caches runtime wiring for offline reloads");
includes("package.json", "node --check src/app-runtime.js", "syntax-checks runtime wiring");

includes("src/app.js", "function launchHandoffPacket", "keeps launch handoff packet derivation");
includes("src/app.js", "Launch handoff packet", "renders launch handoff proof");
includes("src/app.js", "function renderInboxClearDayPanel", "keeps clear-day inbox mode");
includes("src/app.js", "data-inbox-remind=\"tomorrow\"", "keeps clear-day snooze action");
includes("src/app.js", "function renderRecoveryConfidenceReceipt", "keeps recovery receipt");
includes("src/app.js", "Not covered", "keeps recovery limitation disclosure");
includes("src/app.js", "workspace-trust-strip", "keeps workspace trust proof strip");
includes("src/app.js", "AI audit", "keeps AI audit proof point");
includes("src/app.js", "Client safety", "keeps client-safety proof point");

includes("src/app-runtime.js", "document.addEventListener(\"click\"", "keeps delegated click handling in runtime");
includes("src/app-runtime.js", "render();", "keeps app bootstrap in runtime");

console.log("Product surface regression checks passed");
