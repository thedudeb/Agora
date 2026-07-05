#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const manifest = readJson("packaging/release-manifest.json");
  const channels = selectChannels(manifest.channels || [], args.channels);
  if (channels.length === 0) {
    throw new Error("No distribution channels matched the requested filter.");
  }

  const generatedAt = new Date().toISOString();
  const commit = git(["rev-parse", "--short", "HEAD"]) || "unknown";
  const branch = git(["branch", "--show-current"]) || "unknown";
  const dirty = Boolean(git(["status", "--short"]));
  const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const bundleDir = args.out
    ? path.resolve(process.cwd(), args.out)
    : path.join(ROOT, "release", "evidence", `distribution-proof-${stamp}-${commit}`);

  const summary = {
    type: "agora.distribution-evidence",
    generatedAt,
    branch,
    commit,
    dirty,
    productVersion: manifest.productVersion || "unknown",
    release: args.release || `${manifest.productVersion || "0.1.0"} candidate`,
    bundleDir: path.relative(ROOT, bundleDir),
    channels: channels.map((channel) => evidenceChannel(channel))
  };

  fs.mkdirSync(bundleDir, { recursive: true });
  fs.writeFileSync(path.join(bundleDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(bundleDir, "README.md"), renderReadme(summary), "utf8");
  fs.writeFileSync(path.join(bundleDir, "release-candidate-paste.md"), renderReleaseCandidatePaste(summary), "utf8");

  console.log("Distribution Evidence Helper");
  console.log(`Release: ${summary.release}`);
  console.log(`Commit: ${summary.commit}${summary.dirty ? " (dirty)" : ""}`);
  console.log(`Channels: ${summary.channels.map((channel) => channel.id).join(", ")}`);
  console.log(`Evidence bundle: ${summary.bundleDir}`);
}

function evidenceChannel(channel) {
  return {
    id: channel.id,
    label: channel.label,
    artifactType: channel.artifactType,
    platforms: channel.platforms || [],
    entrypoint: channel.entrypoint,
    requiredFiles: channel.requiredFiles || [],
    verification: channel.verification || [],
    manualProof: manualProofFor(channel.id),
    acceptedRisk: acceptedRiskFor(channel.id)
  };
}

function renderReadme(summary) {
  return `# Distribution Evidence

- Generated: ${summary.generatedAt}
- Branch: ${summary.branch}
- Commit: ${summary.commit}
- Dirty worktree: ${summary.dirty ? "yes" : "no"}
- Product version: ${summary.productVersion}
- Release: ${summary.release}

Use this bundle to fill [docs/distribution-proof.md](../../../docs/distribution-proof.md) and the Platform Evidence table in [docs/release-candidate-v0.1-beta.md](../../../docs/release-candidate-v0.1-beta.md).

## Channel Checklist

${summary.channels.map(renderChannelSection).join("\n\n")}

## Sign-Off Checklist

- Every channel has evidence or an explicit accepted risk.
- At least one portable bundle is captured and linked.
- At least one server backup is captured and linked for API-backed releases.
- Rollback owner and rollback target are filled in the release candidate.
- The hosted demo evidence bundle is linked before broad sharing.
`;
}

function renderChannelSection(channel) {
  return `### ${channel.label} (${channel.id})

- Artifact: ${channel.artifactType}
- Platforms: ${channel.platforms.join(", ")}
- Entrypoint: \`${channel.entrypoint}\`

Required files:
${channel.requiredFiles.map((file) => `- [ ] \`${file}\``).join("\n")}

Verification commands:
${channel.verification.map((command) => `- [ ] \`${command}\``).join("\n")}

Manual proof:
${channel.manualProof.map((item) => `- [ ] ${item}`).join("\n")}

Evidence to paste:

\`\`\`md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: ${channel.acceptedRisk}
\`\`\``;
}

function renderReleaseCandidatePaste(summary) {
  return `# Release Candidate Platform Evidence Paste-In

Generated for ${summary.release} at ${summary.generatedAt}.

| Channel | Required Proof Before External Beta | Status |
| --- | --- | --- |
${summary.channels.map((channel) => `| ${escapeCell(channel.label)} | ${escapeCell([...channel.verification, ...channel.manualProof].join("; "))} | Pending evidence from ${summary.bundleDir} |`).join("\n")}
`;
}

function manualProofFor(channelId) {
  const proof = {
    source: [
      "Start from a clean checkout or source archive.",
      "Open the app locally and export a portable workspace bundle.",
      "Record OS, Node version, and browser used."
    ],
    "docker-compose": [
      "Boot app and API services from Docker Compose.",
      "Confirm the API data volume persists after restart.",
      "Record backup path or backup artifact."
    ],
    hosted: [
      "Confirm hosted app URL and API health endpoint.",
      "Open Backend Health and record persistence, email, backup, and public-surface status.",
      "Submit a feature request or invite email if enabled."
    ],
    "pwa-offline": [
      "Install from Android Chrome or a desktop browser.",
      "Launch in airplane mode or with networking disabled.",
      "Create a local edit and export a portable bundle while offline."
    ],
    "desktop-macos": [
      "Pack on macOS and record signing/notarization status.",
      "Launch with networking disabled.",
      "Create a local edit and export a portable bundle."
    ],
    "desktop-windows": [
      "Pack on Windows and record signing status.",
      "Install/uninstall or launch portable executable.",
      "Launch with networking disabled, create a local edit, and export a portable bundle."
    ],
    cli: [
      "Run quick verification from a fresh shell.",
      "Inspect at least one portable bundle.",
      "Generate demo links for the release demo URL."
    ],
    "mcp-server": [
      "Run the MCP integration test.",
      "Confirm read-only default behavior.",
      "Record whether write tools are enabled and why."
    ],
    "portable-data": [
      "Validate portable workspace fixtures.",
      "Preview an import before applying it.",
      "Run a restore drill from the selected backup or bundle."
    ]
  };
  return proof[channelId] || ["Capture operator, environment, commands, artifacts, notes, and accepted risk."];
}

function acceptedRiskFor(channelId) {
  const risks = {
    "desktop-macos": "Unsigned/not notarized is acceptable for v0.1 beta only if release notes repeat it.",
    "desktop-windows": "Unsigned installer is acceptable for v0.1 beta only if release notes repeat it.",
    "pwa-offline": "Native iOS/Android wrappers are not shipped; offline mobile proof is PWA-only.",
    "docker-compose": "Registry publishing and digest pinning are not required until public container distribution."
  };
  return risks[channelId] || "None recorded yet.";
}

function selectChannels(channels, selected) {
  if (selected.length === 0) return channels;
  const allowed = new Set(selected);
  return channels.filter((channel) => allowed.has(channel.id));
}

function parseArgs(values) {
  const result = { channels: [], out: "", release: "", help: false, pending: "" };
  for (const value of values) {
    if (result.pending) {
      assignPending(result, value);
    } else if (value === "--channel") result.pending = "channel";
    else if (value.startsWith("--channel=")) addChannels(result, value.slice("--channel=".length));
    else if (value === "--out") result.pending = "out";
    else if (value.startsWith("--out=")) result.out = value.slice("--out=".length);
    else if (value === "--release") result.pending = "release";
    else if (value.startsWith("--release=")) result.release = value.slice("--release=".length);
    else if (value === "--help" || value === "-h") result.help = true;
    else throw new Error(`Unknown option: ${value}`);
  }
  if (result.pending) throw new Error(`Missing value for --${result.pending}`);
  return result;
}

function assignPending(result, value) {
  if (result.pending === "channel") addChannels(result, value);
  else result[result.pending] = value;
  result.pending = "";
}

function addChannels(result, value) {
  value.split(",").map((item) => item.trim()).filter(Boolean).forEach((item) => result.channels.push(item));
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function git(argsList) {
  const result = spawnSync("git", argsList, { cwd: ROOT, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function printHelp() {
  console.log(`Distribution evidence helper

Usage:
  npm run distribution:evidence
  npm run distribution:evidence -- --release v0.1-beta
  npm run distribution:evidence -- --channel hosted,pwa-offline
  npm run distribution:evidence -- --out /private/tmp/agora-distribution-evidence

Options:
  --release <name>  Release/candidate label for the generated bundle.
  --channel <id>    Limit output to one or more channel IDs. Can be comma-separated.
  --out <dir>       Evidence output directory. Default: release/evidence/distribution-proof-<timestamp>-<commit>.
`);
}
