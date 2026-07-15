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

includes("index.html", "./src/app-runtime.js?v=workspace-platform-v2", "loads runtime wiring after the app bundle");
includes("index.html", "./src/app-inbox.js?v=workspace-platform-v2", "loads Inbox route rendering after the app bundle");
includes("index.html", "./src/app-recovery.js?v=workspace-platform-v2", "loads Data and Recovery route rendering after the app bundle");
includes("index.html", "./src/app-project-board.js?v=workspace-platform-v4", "loads Project and Board route rendering before runtime wiring");
includes("sw.js", "./src/app-runtime.js?v=workspace-platform-v2", "caches runtime wiring for offline reloads");
includes("sw.js", "./src/app-inbox.js?v=workspace-platform-v2", "caches Inbox route rendering for offline reloads");
includes("sw.js", "./src/app-recovery.js?v=workspace-platform-v2", "caches Data and Recovery route rendering for offline reloads");
includes("sw.js", "./src/app-project-board.js?v=workspace-platform-v4", "caches Project and Board route rendering for offline reloads");
includes("package.json", "node --check src/app-runtime.js", "syntax-checks runtime wiring");
includes("package.json", "node --check src/app-inbox.js", "syntax-checks Inbox route rendering");
includes("package.json", "node --check src/app-recovery.js", "syntax-checks Data and Recovery route rendering");
includes("package.json", "node --check src/app-project-board.js", "syntax-checks Project and Board route rendering");

includes("src/app.js", "function launchHandoffPacket", "keeps launch handoff packet derivation");
includes("src/app.js", "Launch handoff packet", "renders launch handoff proof");
includes("src/app-inbox.js", "function renderInboxClearDayPanel", "keeps clear-day inbox mode");
includes("src/app-inbox.js", "data-inbox-remind=\"tomorrow\"", "keeps clear-day snooze action");
includes("src/app-recovery.js", "function renderRecoveryConfidenceReceipt", "keeps recovery receipt");
includes("src/app-recovery.js", "Not covered", "keeps recovery limitation disclosure");
includes("src/app-project-board.js", "function renderProjectPageRoute", "keeps project route rendering");
includes("src/app-project-board.js", "function renderBoardRoute", "keeps board route rendering");
includes("src/app-project-board.js", "function renderProjectGantt", "keeps project Gantt rendering");
includes("src/app-project-board.js", "function renderBoardControls", "keeps power-user board controls");
includes("src/app.js", "workspace-trust-strip", "keeps workspace trust proof strip");
includes("src/app.js", "AI audit", "keeps AI audit proof point");
includes("src/app.js", "Client safety", "keeps client-safety proof point");

includes("src/app-runtime.js", "document.addEventListener(\"click\"", "keeps delegated click handling in runtime");
includes("src/app-runtime.js", "render();", "keeps app bootstrap in runtime");

console.log("Product surface regression checks passed");
