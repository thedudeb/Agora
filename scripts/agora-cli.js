#!/usr/bin/env node
const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const checkFiles = [
  "src/app.js",
  "server/api.js",
  "server/storage.js",
  "server/static.js",
  "server/env.js",
  "server/smoke-test.js",
  "server/supabase-verify.js",
  "server/portable-fixtures-test.js",
  "scripts/capture-screenshots.js",
  "scripts/agora-cli.js",
  "desktop/electron/main.cjs",
  "desktop/electron/preload.cjs"
];

const commands = {
  help: {
    summary: "Show CLI help",
    run: async () => printHelp()
  },
  check: {
    summary: "Syntax-check app, server, desktop, and script files",
    run: async () => {
      for (const file of checkFiles) {
        await runStep(`node --check ${file}`, [process.execPath, ["--check", path.join(ROOT, file)]]);
      }
    }
  },
  fixtures: {
    summary: "Validate portable workspace and automation pack fixtures",
    run: async () => runStep("fixture validation", [process.execPath, [path.join(ROOT, "server", "portable-fixtures-test.js")]])
  },
  api: {
    summary: "Run the dependency-free API smoke test",
    run: async () => runStep("API smoke test", [process.execPath, [path.join(ROOT, "server", "smoke-test.js")]])
  },
  supabase: {
    summary: "Verify a real Supabase project from .env",
    run: async () => runStep("Supabase verification", [process.execPath, [path.join(ROOT, "server", "supabase-verify.js")]])
  },
  screenshots: {
    summary: "Refresh launch screenshots with local Chrome/Chromium",
    run: async () => runStep("screenshot capture", [process.execPath, [path.join(ROOT, "scripts", "capture-screenshots.js")]])
  },
  verify: {
    summary: "Run the standard power-user verification suite",
    run: async (args) => {
      const includeApi = !args.includes("--quick");
      const includeSupabase = args.includes("--supabase");
      await commands.check.run([]);
      await commands.fixtures.run([]);
      if (includeApi) await commands.api.run([]);
      else console.log("Skipping API smoke test because --quick was passed.");
      if (includeSupabase) await commands.supabase.run([]);
      else console.log("Skipping Supabase verification. Pass --supabase to include it.");
    }
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const [rawCommand = "help", ...args] = process.argv.slice(2);
  const command = normalizeCommand(rawCommand);
  if (!commands[command]) {
    console.error(`Unknown command: ${rawCommand}`);
    console.error("");
    printHelp();
    process.exitCode = 1;
    return;
  }

  await commands[command].run(args);
}

function normalizeCommand(command) {
  const aliases = {
    "--help": "help",
    "-h": "help",
    doctor: "verify",
    smoke: "api",
    test: "verify"
  };
  return aliases[command] || command;
}

async function runStep(label, [command, args]) {
  console.log("");
  console.log(`> ${label}`);
  await spawnCommand(command, args);
}

function spawnCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function printHelp() {
  console.log(`Agora CLI

Usage:
  npm run agora -- <command> [options]

Commands:
  verify [--quick] [--supabase]  Run check + fixtures + API smoke test
  check                         Syntax-check project files
  fixtures                      Validate portable fixtures
  api                           Run API smoke test
  supabase                      Verify real Supabase setup from .env
  screenshots                   Refresh launch screenshots
  help                          Show this help

Options:
  --quick       With verify, skip the API smoke test
  --supabase    With verify, include real Supabase verification

Examples:
  npm run agora -- verify
  npm run agora -- verify --quick
  npm run agora -- verify --supabase
  npm run agora -- screenshots
`);
}
