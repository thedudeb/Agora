#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const full = args.has("--full");
const includeBrowser = args.has("--browser") || full;
const updateDocs = !args.has("--no-doc-update");

const commands = [
  gate("release-check", "npm", ["run", "release:check"], "Release candidate discipline"),
  gate("demo-check", "npm", ["run", "demo:check"], "Hosted demo readiness"),
  gate("distribution-check", "npm", ["run", "distribution:check"], "Distribution proof ledger"),
  gate("beta-check", "npm", ["run", "beta:check"], "Beta feedback loop"),
  gate("package-check", "npm", ["run", "package:check"], "Packaging manifest"),
  gate("trust", "npm", ["run", "trust"], "Trust evidence")
];

if (includeBrowser) {
  commands.push(
    gate("golden-demo", "npm", ["run", "test:golden"], "Acme demo browser golden path", { AGORA_GOLDEN_SUITE: "demo" }),
    gate("golden-feedback", "npm", ["run", "test:golden"], "Feedback browser golden path", { AGORA_GOLDEN_SUITE: "feedback" })
  );
}

if (full) {
  commands.push(
    gate("qa", "npm", ["run", "qa"], "Full release QA"),
    gate("security", "npm", ["run", "security"], "Security gate")
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const commit = git(["rev-parse", "--short", "HEAD"]) || "unknown";
  const branch = git(["branch", "--show-current"]) || "unknown";
  const dirty = Boolean(git(["status", "--short"]));
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const bundleDir = path.join(ROOT, "release", "evidence", `${stamp}-${commit}`);
  fs.mkdirSync(bundleDir, { recursive: true });

  const results = [];
  for (const command of commands) {
    console.log(`Running ${command.label}...`);
    const result = await runCommand(command, bundleDir);
    results.push(result);
    console.log(`${result.ok ? "PASS" : "FAIL"} ${command.label} (${result.durationMs}ms)`);
    if (!result.ok && !args.has("--keep-going")) break;
  }

  const summary = {
    type: "agora.release-evidence",
    generatedAt,
    branch,
    commit,
    dirty,
    mode: full ? "full" : includeBrowser ? "browser" : "local",
    ok: results.every((result) => result.ok) && results.length === commands.length,
    bundleDir: path.relative(ROOT, bundleDir),
    commands: results
  };

  writeJson(path.join(bundleDir, "summary.json"), summary);
  fs.writeFileSync(path.join(bundleDir, "README.md"), renderBundleReadme(summary), "utf8");

  if (updateDocs) updateReleaseCandidate(summary);

  console.log("");
  console.log(`Evidence bundle: ${summary.bundleDir}`);
  console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
  if (!summary.ok) process.exitCode = 1;
}

function gate(id, command, commandArgs, label, env = {}) {
  return { id, command, args: commandArgs, label, env };
}

function runCommand(command, bundleDir) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command.command, command.args, {
      cwd: ROOT,
      env: { ...process.env, ...command.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      stderr += `${error.message}\n`;
    });
    child.once("exit", (code) => {
      const durationMs = Date.now() - startedAt;
      const ok = code === 0;
      const outputPath = `${command.id}.txt`;
      const payload = [
        `$ ${command.command} ${command.args.join(" ")}`,
        "",
        stdout.trim(),
        stderr.trim() ? `\n[stderr]\n${stderr.trim()}` : "",
        "",
        `exitCode=${code}`,
        `durationMs=${durationMs}`
      ].join("\n").trimEnd() + "\n";
      fs.writeFileSync(path.join(bundleDir, outputPath), payload, "utf8");
      resolve({
        id: command.id,
        label: command.label,
        command: `${command.command} ${command.args.join(" ")}`,
        env: command.env,
        ok,
        exitCode: code,
        durationMs,
        output: outputPath
      });
    });
  });
}

function renderBundleReadme(summary) {
  return `# Agora Release Evidence

- Generated: ${summary.generatedAt}
- Branch: ${summary.branch}
- Commit: ${summary.commit}
- Dirty worktree: ${summary.dirty ? "yes" : "no"}
- Mode: ${summary.mode}
- Status: ${summary.ok ? "PASS" : "FAIL"}

## Commands

| Gate | Status | Output |
| --- | --- | --- |
${summary.commands.map((command) => `| ${command.label} | ${command.ok ? "PASS" : "FAIL"} | [${command.output}](./${command.output}) |`).join("\n")}

## Remaining Manual Evidence

- Hosted production verify still needs the real hosted environment, backup, and bundle.
- Public demo proof still needs the real demo URL.
- Platform/device proof still needs source, Docker, hosted, PWA, macOS, Windows, CLI, MCP, and portable-data sign-off in docs/distribution-proof.md.
- Beta cohort proof still needs real tester intake and feature-request follow-up evidence.
`;
}

function updateReleaseCandidate(summary) {
  const rcPath = path.join(ROOT, "docs", "release-candidate-v0.1-beta.md");
  const current = fs.readFileSync(rcPath, "utf8");
  const section = `
## Latest Local Evidence Bundle

- Generated: ${summary.generatedAt}
- Commit: ${summary.commit}
- Dirty worktree: ${summary.dirty ? "yes" : "no"}
- Mode: ${summary.mode}
- Status: ${summary.ok ? "PASS" : "FAIL"}
- Bundle: [${summary.bundleDir}](../${summary.bundleDir}/README.md)

| Gate | Status | Evidence |
| --- | --- | --- |
${summary.commands.map((command) => `| ${command.label} | ${command.ok ? "PASS" : "FAIL"} | [${command.output}](../${summary.bundleDir}/${command.output}) |`).join("\n")}

Manual evidence still required: hosted demo URL, hosted production verify, real device/offline checks, release backup, portable bundle, and beta tester follow-up.
`;
  const marker = "## Latest Local Evidence Bundle";
  const nextHeading = "\n## Acme Demo Gate";
  let updated;
  if (current.includes(marker)) {
    const start = current.indexOf(marker);
    const end = current.indexOf(nextHeading, start);
    updated = `${current.slice(0, start)}${section}${current.slice(end)}`;
  } else {
    const insertAt = current.indexOf(nextHeading);
    updated = `${current.slice(0, insertAt)}${section}${current.slice(insertAt)}`;
  }
  fs.writeFileSync(rcPath, updated, "utf8");
}

function git(argsList) {
  const result = spawnSync("git", argsList, { cwd: ROOT, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
