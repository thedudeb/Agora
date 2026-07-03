#!/usr/bin/env node
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

const options = parseArgs(process.argv.slice(2));
const suites = buildSuites(options);

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const startedAt = new Date().toISOString();
  const results = [];

  if (!options.json) {
    console.log("Agora Hosted Deploy Rehearsal");
    console.log("=============================");
  }

  for (const suite of suites) {
    const result = await runSuite(suite);
    results.push(result);
    if (!result.ok && !options.keepGoing) break;
  }

  const report = {
    ok: results.every((result) => result.ok) && results.length === suites.length,
    startedAt,
    finishedAt: new Date().toISOString(),
    profile: options.quick ? "hosted-quick" : "hosted-production",
    envFile: options.env,
    suites: results
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (!report.ok) process.exitCode = 1;
}

function buildSuites(args) {
  const hostedArgs = [path.join(ROOT, "scripts", "hosted-env-verify.js"), "--env", args.env];
  if (args.requireGithub) hostedArgs.push("--require-github");
  if (args.requirePublicFeatureRequests) hostedArgs.push("--require-public-feature-requests");

  return [
    {
      id: "hosted-env",
      name: "Hosted environment verifier",
      command: process.execPath,
      args: hostedArgs,
      required: true
    },
    {
      id: args.skipAudit ? "security-local" : "security",
      name: args.skipAudit ? "Security checks without dependency audit" : "Security checks and dependency audit",
      command: args.skipAudit ? process.execPath : "npm",
      args: args.skipAudit
        ? [path.join(ROOT, "scripts", "agora-cli.js"), "check"]
        : ["run", "security"],
      required: true
    },
    ...(args.skipAudit ? [{
      id: "admin-security",
      name: "Admin security regression",
      command: process.execPath,
      args: [path.join(ROOT, "scripts", "admin-security-regression.js")],
      required: true
    }] : []),
    {
      id: "api-smoke",
      name: "API smoke, backup, and diagnostics proof",
      command: process.execPath,
      args: [path.join(ROOT, "server", "smoke-test.js")],
      required: true
    },
    ...(args.quick ? [] : [{
      id: "golden",
      name: "Browser golden path QA",
      command: process.execPath,
      args: [path.join(ROOT, "scripts", "golden-path-qa.js")],
      env: { AGORA_GOLDEN_TIMEOUT_MS: process.env.AGORA_GOLDEN_TIMEOUT_MS || "120000" },
      required: true
    }])
  ];
}

function runSuite(suite) {
  const startedAt = Date.now();
  if (!options.json) {
    console.log("");
    console.log(`Running ${suite.name}...`);
  }
  return new Promise((resolve) => {
    const child = spawn(suite.command, suite.args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...(suite.env || {})
      },
      stdio: options.json ? "pipe" : "inherit"
    });
    let output = "";
    if (options.json) {
      child.stdout.on("data", (chunk) => { output += chunk.toString(); });
      child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    }
    child.once("error", (error) => resolve({
      id: suite.id,
      name: suite.name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error.message,
      output: output.trim()
    }));
    child.once("exit", (code) => resolve({
      id: suite.id,
      name: suite.name,
      ok: code === 0,
      durationMs: Date.now() - startedAt,
      exitCode: code,
      output: options.json ? output.trim().slice(-4000) : undefined
    }));
  });
}

function printReport(report) {
  console.log("");
  console.log("Hosted deploy rehearsal report");
  console.log(`${report.ok ? "PASS" : "FAIL"} - ${report.suites.filter((suite) => suite.ok).length}/${report.suites.length} suites passed`);
  report.suites.forEach((suite) => {
    console.log(`- ${suite.ok ? "PASS" : "FAIL"} ${suite.name} (${suite.durationMs}ms)`);
  });
  if (!report.ok) {
    const failed = report.suites.find((suite) => !suite.ok);
    console.log("");
    console.log(`First failing suite: ${failed?.name || "unknown"}`);
  }
}

function parseArgs(values) {
  return values.reduce((result, value) => {
    if (result.pending) {
      result[result.pending] = value;
      result.pending = "";
    } else if (value === "--env") result.pending = "env";
    else if (value.startsWith("--env=")) result.env = value.slice("--env=".length);
    else if (value === "--quick") result.quick = true;
    else if (value === "--skip-audit") result.skipAudit = true;
    else if (value === "--keep-going") result.keepGoing = true;
    else if (value === "--json") result.json = true;
    else if (value === "--require-github") result.requireGithub = true;
    else if (value === "--require-public-feature-requests") result.requirePublicFeatureRequests = true;
    else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
    return result;
  }, {
    env: ".env",
    quick: false,
    skipAudit: false,
    keepGoing: false,
    json: false,
    requireGithub: false,
    requirePublicFeatureRequests: false,
    pending: ""
  });
}

function printHelp() {
  console.log(`Agora Hosted Deploy Rehearsal

Usage:
  npm run rehearse:hosted -- [--env .env] [--quick] [--skip-audit] [--json]

Runs hosted env verification, security checks, API smoke, backup/diagnostics proof, and browser golden QA.

Options:
  --env <file>                       Env file for hosted verification.
  --quick                            Skip browser golden path QA.
  --skip-audit                       Run syntax/security regression without npm audit.
  --keep-going                       Continue after a failing suite.
  --json                             Print machine-readable report.
  --require-github                   Require AGORA_GITHUB_WEBHOOK_SECRET.
  --require-public-feature-requests  Require public feature intake to be enabled.
`);
}
