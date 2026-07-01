#!/usr/bin/env node
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

const suites = [
  {
    name: "Power-user quick verification",
    command: process.execPath,
    args: [path.join(ROOT, "scripts", "agora-cli.js"), "verify", "--quick"]
  },
  {
    name: "Browser golden path QA",
    command: process.execPath,
    args: [path.join(ROOT, "scripts", "golden-path-qa.js")],
    env: {
      AGORA_GOLDEN_TIMEOUT_MS: process.env.AGORA_GOLDEN_TIMEOUT_MS || "120000"
    }
  }
];

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  console.log("Agora release QA");
  console.log("================");
  for (const suite of suites) {
    console.log("");
    console.log(`Running ${suite.name}...`);
    await runSuite(suite);
  }
  console.log("");
  console.log(`Release QA passed: ${suites.length} suites`);
}

function runSuite(suite) {
  return new Promise((resolve, reject) => {
    const child = spawn(suite.command, suite.args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...(suite.env || {})
      },
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${suite.name} failed with exit code ${code}`));
    });
  });
}
