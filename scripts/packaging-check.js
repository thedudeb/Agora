#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));

const manifest = readJson("packaging/release-manifest.json");
const rootPackage = readJson("package.json");
const desktopPackage = readJson("desktop/package.json");
const webManifest = readJson("manifest.webmanifest");
const dockerfile = read("Dockerfile");
const compose = read("docker-compose.yml");

const checks = [
  check({
    id: "manifest-shape",
    title: "Release manifest declares packaging channels",
    pass: manifest.type === "agora.release-manifest" && Array.isArray(manifest.channels) && manifest.channels.length >= 5,
    detail: `${manifest.channels?.length || 0} channels declared`,
    fix: "Add packaging/release-manifest.json with the source, Docker, hosted, PWA, desktop, and portable channels."
  }),
  check({
    id: "channel-ids",
    title: "Packaging channel IDs are unique",
    pass: unique(channelIds()).length === channelIds().length,
    detail: channelIds().join(", "),
    fix: "Give every release channel a stable unique id."
  }),
  check({
    id: "channel-required-files",
    title: "Every channel's required files exist",
    pass: missingRequiredFiles().length === 0,
    detail: missingRequiredFiles().length ? missingRequiredFiles().join("; ") : "All required files are present.",
    fix: "Restore missing packaging evidence files or remove stale references from the manifest."
  }),
  check({
    id: "root-commands",
    title: "Root package exposes required release commands",
    pass: missingRootCommands().length === 0,
    detail: missingRootCommands().length ? missingRootCommands().join(", ") : manifest.requiredRootCommands.join(", "),
    fix: "Add missing npm scripts to package.json."
  }),
  check({
    id: "desktop-commands",
    title: "Desktop package exposes macOS and Windows packaging commands",
    pass: missingDesktopCommands().length === 0,
    detail: missingDesktopCommands().length ? missingDesktopCommands().join(", ") : manifest.requiredDesktopCommands.join(", "),
    fix: "Add missing Electron packaging scripts under desktop/package.json."
  }),
  check({
    id: "docker-stack",
    title: "Docker packaging includes separate app and API services with persistent data",
    pass: ["services:", "app:", "api:", "agora-data:", "AGORA_BACKUP_DIR"].every((needle) => compose.includes(needle)) && dockerfile.includes("npm ci --omit=dev"),
    evidence: ["Dockerfile", "docker-compose.yml"],
    fix: "Keep app/API services separate and persist API data/backups in a named volume."
  }),
  check({
    id: "pwa-offline",
    title: "PWA packaging includes install metadata, icons, screenshots, and offline shell",
    pass: webManifest.display === "standalone" && Array.isArray(webManifest.icons) && webManifest.icons.length >= 2 && Array.isArray(webManifest.screenshots) && webManifest.screenshots.length >= 1 && exists("offline.html") && exists("sw.js"),
    evidence: ["manifest.webmanifest", "offline.html", "sw.js"],
    fix: "Keep PWA install metadata, icons, screenshots, service worker, and offline shell in sync."
  }),
  check({
    id: "desktop-offline-bundle",
    title: "Desktop package bundles the local app shell resources",
    pass: desktopExtraResources().includes("../index.html") && desktopExtraResources().includes("../offline.html") && desktopExtraResources().includes("../src") && desktopExtraResources().includes("../assets"),
    evidence: ["desktop/package.json"],
    fix: "Bundle the web app, assets, service worker, manifest, and offline page into desktop releases."
  }),
  check({
    id: "packaging-doc",
    title: "Packaging documentation exists",
    pass: exists("docs/packaging.md"),
    evidence: ["docs/packaging.md"],
    fix: "Document the release matrix, checks, and per-channel handoff notes."
  })
];

const summary = checks.reduce((counts, item) => {
  counts.total += 1;
  counts[item.status] += 1;
  return counts;
}, { total: 0, pass: 0, fail: 0 });

const report = {
  type: "agora.packaging-report",
  generatedAt: new Date().toISOString(),
  ok: summary.fail === 0,
  summary,
  channels: manifest.channels || [],
  checks
};

if (args.has("--json")) console.log(JSON.stringify(report, null, 2));
else printReport(report);

if (!report.ok) process.exitCode = 1;

function check({ id, title, pass, detail = "", evidence = [], fix = "" }) {
  return { id, title, status: pass ? "pass" : "fail", detail, evidence, fix };
}

function printReport(payload) {
  console.log("Packaging Readiness Report");
  console.log(`Status: ${payload.ok ? "PASS" : "FAIL"}`);
  console.log(`Generated: ${payload.generatedAt}`);
  console.log(`Summary: ${payload.summary.pass}/${payload.summary.total} passed`);
  console.log("");
  console.log("Release channels:");
  payload.channels.forEach((channel) => {
    console.log(`- ${channel.label} (${channel.id}): ${channel.artifactType}`);
  });
  console.log("");
  payload.checks.forEach((item) => {
    const marker = item.status === "pass" ? "PASS" : "FAIL";
    console.log(`[${marker}] ${item.title}`);
    if (item.detail) console.log(`  Detail: ${item.detail}`);
    if (item.evidence.length) console.log(`  Evidence: ${item.evidence.join(", ")}`);
    if (item.status === "fail" && item.fix) console.log(`  Fix: ${item.fix}`);
  });
}

function channelIds() {
  return (manifest.channels || []).map((channel) => channel.id).filter(Boolean);
}

function missingRequiredFiles() {
  return (manifest.channels || []).flatMap((channel) => {
    return (channel.requiredFiles || [])
      .filter((file) => !exists(file))
      .map((file) => `${channel.id}: ${file}`);
  });
}

function missingRootCommands() {
  const scripts = rootPackage.scripts || {};
  return (manifest.requiredRootCommands || []).filter((command) => !scripts[command]);
}

function missingDesktopCommands() {
  const scripts = desktopPackage.scripts || {};
  return (manifest.requiredDesktopCommands || []).filter((command) => !scripts[command]);
}

function desktopExtraResources() {
  const resources = desktopPackage.build?.extraResources || [];
  return resources.map((resource) => resource.from).filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function readJson(relativePath) {
  const contents = read(relativePath);
  if (!contents) return {};
  return JSON.parse(contents);
}
