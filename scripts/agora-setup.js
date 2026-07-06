#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");

const args = parseArgs(process.argv.slice(2));
const result = runSetup(args);

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printResult(result);
}

function parseArgs(values) {
  return values.reduce((result, value) => {
    if (result.pending) {
      result[result.pending] = value;
      result.pending = "";
    } else if (value === "--profile") result.pending = "profile";
    else if (value.startsWith("--profile=")) result.profile = value.slice("--profile=".length);
    else if (value === "--dry-run") result.dryRun = true;
    else if (value === "--force") result.force = true;
    else if (value === "--json") result.json = true;
    else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
    return result;
  }, { profile: "local", dryRun: false, force: false, json: false, pending: "" });
}

function runSetup(options = {}) {
  const profile = ["local", "docker", "hosted"].includes(options.profile) ? options.profile : "local";
  const envExists = fs.existsSync(ENV_PATH);
  const directories = [
    "server/data",
    "server/data/backups",
    "server/data/uploads"
  ];
  const env = buildEnv(profile);
  const actions = [];

  if (envExists && !options.force) {
    actions.push({ status: "skipped", target: ".env", detail: ".env already exists; pass --force to regenerate it" });
  } else {
    actions.push({ status: options.dryRun ? "planned" : "written", target: ".env", detail: `${profile} profile environment` });
    if (!options.dryRun) fs.writeFileSync(ENV_PATH, env);
  }

  directories.forEach((dir) => {
    actions.push({ status: options.dryRun ? "planned" : "ready", target: dir, detail: "local persistent data directory" });
    if (!options.dryRun) fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  });

  return {
    ok: true,
    profile,
    dryRun: options.dryRun,
    envExists,
    actions,
    next: nextSteps(profile)
  };
}

function buildEnv(profile) {
  const base = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");
  const overrides = {
    local: {
      AGORA_APP_HOST: "127.0.0.1",
      AGORA_API_HOST: "127.0.0.1",
      AGORA_STORAGE_DRIVER: "json",
      AGORA_AUTH_DRIVER: "local",
      AGORA_ALLOWED_ORIGINS: "http://127.0.0.1:5174,http://localhost:5174",
      AGORA_PUBLIC_APP_URL: "http://127.0.0.1:5174",
      AGORA_BACKUP_DIR: "server/data/backups",
      AGORA_DEMO_AUTH: "false",
      AGORA_PASSWORDLESS_AUTH: "false"
    },
    docker: {
      AGORA_APP_HOST: "0.0.0.0",
      AGORA_API_HOST: "0.0.0.0",
      AGORA_STORAGE_DRIVER: "json",
      AGORA_AUTH_DRIVER: "local",
      AGORA_ALLOWED_ORIGINS: "http://127.0.0.1:5174,http://localhost:5174",
      AGORA_PUBLIC_APP_URL: "http://127.0.0.1:5174",
      AGORA_BACKUP_DIR: "/app/server/data/backups",
      AGORA_BACKUP_SCHEDULER_ENABLED: "true",
      AGORA_BACKUP_INTERVAL_HOURS: "24"
    },
    hosted: {
      AGORA_APP_HOST: "0.0.0.0",
      AGORA_API_HOST: "0.0.0.0",
      AGORA_STORAGE_DRIVER: "supabase",
      AGORA_AUTH_DRIVER: "supabase",
      AGORA_ALLOWED_ORIGINS: "https://your-agora-app.example.com",
      AGORA_PUBLIC_APP_URL: "https://your-agora-app.example.com",
      AGORA_STRICT_CSP: "true",
      AGORA_STRUCTURED_LOGS: "true",
      AGORA_RELEASE_CHANNEL: "production",
      AGORA_BACKUP_DIR: "/var/lib/agora/backups",
      AGORA_BACKUP_SCHEDULER_ENABLED: "true",
      AGORA_PUBLIC_FEATURE_REQUESTS: "false",
      AGORA_DEMO_AUTH: "false",
      AGORA_PASSWORDLESS_AUTH: "false",
      AGORA_PASSWORD_RESET_DELIVERY: "smtp"
    }
  }[profile];

  const lines = base.split(/\r?\n/);
  const seen = new Set();
  const patched = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) return line;
    const key = match[1];
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) return line;
    seen.add(key);
    return `${key}=${overrides[key]}`;
  });

  Object.entries(overrides).forEach(([key, value]) => {
    if (!seen.has(key)) patched.push(`${key}=${value}`);
  });

  return `${patched.join("\n").replace(/\n*$/, "")}\n`;
}

function nextSteps(profile) {
  if (profile === "docker") {
    return [
      "docker compose up --build",
      "open http://127.0.0.1:5174",
      "open http://127.0.0.1:8787/api/health"
    ];
  }
  if (profile === "hosted") {
    return [
      "fill Supabase, SMTP, origin, and backup secrets in .env",
      "run server/migrations/001 through 005 in Supabase",
      "npm run verify:hosted",
      "npm run rehearse:hosted"
    ];
  }
  return [
    "npm run dev",
    "npm run dev:api",
    "open http://127.0.0.1:5174"
  ];
}

function printResult(result) {
  console.log(`Agora setup (${result.profile}${result.dryRun ? ", dry run" : ""})`);
  result.actions.forEach((action) => {
    console.log(`- ${action.status}: ${action.target} - ${action.detail}`);
  });
  console.log("");
  console.log("Next:");
  result.next.forEach((step) => console.log(`- ${step}`));
}

function printHelp() {
  console.log(`Agora setup

Usage:
  npm run setup -- [--profile local|docker|hosted] [--dry-run] [--force]
  npm run agora -- setup [--profile local|docker|hosted] [--dry-run] [--force]

Options:
  --profile <name>  local, docker, or hosted. Default: local
  --dry-run         Show files and directories that would be created
  --force           Regenerate .env if it already exists
  --json            Print machine-readable JSON
`);
}
