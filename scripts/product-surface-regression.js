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

includes("index.html", "./src/app-runtime.js?v=workspace-platform-v4", "loads runtime wiring after the app bundle");
includes("index.html", "./src/app-inbox.js?v=workspace-platform-v2", "loads Inbox route rendering after the app bundle");
includes("index.html", "./src/app-recovery.js?v=workspace-platform-v2", "loads Data and Recovery route rendering after the app bundle");
includes("index.html", "./src/app-project-board.js?v=workspace-platform-v5", "loads Project and Board route rendering before runtime wiring");
includes("index.html", "./src/icm-context.css?v=workspace-platform-v1", "loads focused ICM context bridge styles");
includes("index.html", "./src/sparkz-pilot.js?v=workspace-platform-v1", "loads the Sparkz pilot module");
includes("index.html", "./src/sparkz-pilot.css?v=workspace-platform-v1", "loads focused Sparkz pilot styles");
includes("sw.js", "./src/app-runtime.js?v=workspace-platform-v4", "caches runtime wiring for offline reloads");
includes("sw.js", "./src/app-inbox.js?v=workspace-platform-v2", "caches Inbox route rendering for offline reloads");
includes("sw.js", "./src/app-recovery.js?v=workspace-platform-v2", "caches Data and Recovery route rendering for offline reloads");
includes("sw.js", "./src/app-project-board.js?v=workspace-platform-v5", "caches Project and Board route rendering for offline reloads");
includes("sw.js", "./src/icm-context.css?v=workspace-platform-v1", "caches ICM context bridge styles for offline reloads");
includes("sw.js", "./src/sparkz-pilot.js?v=workspace-platform-v1", "caches the Sparkz pilot module for offline reloads");
includes("sw.js", "./src/sparkz-pilot.css?v=workspace-platform-v1", "caches Sparkz pilot styles for offline reloads");
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
includes("src/app.js", "marketplace-sparkz-creator-launch", "keeps the Sparkz creator-launch template");
includes("src/app.js", "automation-pack-sparkz-launch-control", "keeps the Sparkz launch-control automations");
includes("src/sparkz-pilot.js", "function startOrOpenSparkzPilot", "keeps the one-click Sparkz pilot path");
includes("src/sparkz-pilot.js", "function sparkzPilotPacket", "keeps exportable Sparkz pilot evidence");
includes("src/sparkz-pilot.js", "Execution boundary discipline", "keeps the external-execution review gate");
includes("src/sparkz-pilot.js", 'aria-pressed="${entry.status === status}"', "exposes selected Sparkz score states accessibly");
includes("src/sparkz-pilot.js", 'const canEdit = canWrite("projects:write")', "keeps Sparkz pilot editing permission-aware");
includes("server/sparkz-pilot.js", "function normalizeSparkzPilotReview", "normalizes synced Sparkz pilot reviews");
includes("server/migrations/007_sparkz_pilot_reviews.sql", "agora_sparkz_pilot_reviews", "persists Sparkz pilot reviews in Supabase");
includes("src/app.js", "function previewIcmContext", "keeps the read-only ICM Project Memory bridge");
includes("src/app.js", "icmContextInputValue = value", "preserves ICM input across loading and provider errors");
includes("src/app.js", "This exact ICM context version is already captured", "keeps ICM context deduplication");
includes("src/app-runtime.js", "#memory-icm-preview", "wires ICM preview through delegated runtime events");
includes("templates/marketplace.json", "marketplace-sparkz-creator-launch", "keeps the portable Sparkz marketplace artifact");
includes("docs/sparkz-launch-pack.md", "Agora coordinates the work, evidence, approvals, risks, and decisions", "documents the Sparkz product boundary");

includes("src/app-runtime.js", "document.addEventListener(\"click\"", "keeps delegated click handling in runtime");
includes("src/app-runtime.js", "render();", "keeps app bootstrap in runtime");

console.log("Product surface regression checks passed");
