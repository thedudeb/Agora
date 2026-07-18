#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { loadEnvFile } = require("../server/env");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED_MIGRATIONS = [
  "server/migrations/001_supabase_storage.sql",
  "server/migrations/002_supabase_auth_rls.sql",
  "server/migrations/003_background_jobs.sql",
  "server/migrations/004_auth_sessions.sql",
  "server/migrations/005_rate_limit_buckets.sql",
  "server/migrations/006_workspace_revisions.sql",
  "server/migrations/007_sparkz_pilot_reviews.sql"
];

const args = parseArgs(process.argv.slice(2));
loadEnvFile(path.resolve(ROOT, args.env || ".env"));

const report = buildUpgradeSafetyReport(args);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

if (!report.ok) {
  process.exitCode = 1;
}

function parseArgs(values) {
  return values.reduce((result, value) => {
    if (result.pending) {
      result[result.pending] = value;
      result.pending = "";
    } else if (value === "--json") result.json = true;
    else if (value === "--allow-missing-backup") result.allowMissingBackup = true;
    else if (value === "--env") result.pending = "env";
    else if (value.startsWith("--env=")) result.env = value.slice("--env=".length);
    else if (value === "--backup") result.pending = "backup";
    else if (value.startsWith("--backup=")) result.backup = value.slice("--backup=".length);
    else if (value === "--max-age-hours") result.pending = "maxAgeHours";
    else if (value.startsWith("--max-age-hours=")) result.maxAgeHours = value.slice("--max-age-hours=".length);
    else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
    return result;
  }, {
    json: false,
    env: ".env",
    backup: "",
    maxAgeHours: "48",
    allowMissingBackup: false,
    pending: ""
  });
}

function buildUpgradeSafetyReport(options = {}) {
  const checks = [
    checkPackageVersion(),
    checkMigrationFiles(),
    checkBackupConfiguration(options),
    checkBackupArtifact(options)
  ];
  const blockers = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");
  return {
    ok: blockers.length === 0,
    generatedAt: new Date().toISOString(),
    profile: "upgrade-safety",
    summary: {
      passing: checks.filter((check) => check.status === "pass").length,
      warnings: warnings.length,
      blockers: blockers.length,
      total: checks.length
    },
    checks
  };
}

function checkPackageVersion() {
  const packagePath = path.join(ROOT, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const valid = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version || "");
    return gate({
      id: "package-version",
      label: "Release version metadata",
      done: valid,
      detail: valid ? `package.json version ${pkg.version}` : "package.json version is missing or not semver-like",
      fix: "Set package.json version before tagging or announcing an upgrade."
    });
  } catch (error) {
    return fail("package-version", "Release version metadata", `Could not read package.json: ${error.message}`, "Restore a valid package.json before upgrading.");
  }
}

function checkMigrationFiles() {
  const missing = [];
  const empty = [];
  REQUIRED_MIGRATIONS.forEach((migration) => {
    const filePath = path.join(ROOT, migration);
    if (!fs.existsSync(filePath)) {
      missing.push(migration);
      return;
    }
    if (fs.statSync(filePath).size === 0) empty.push(migration);
  });
  const done = missing.length === 0 && empty.length === 0;
  const detail = done
    ? `${REQUIRED_MIGRATIONS.length} required Supabase migration files present`
    : `${missing.concat(empty).join(", ")} missing or empty`;
  return gate({
    id: "migration-files",
    label: "Required migration files",
    done,
    detail,
    fix: "Keep all numbered Supabase migration files in the release artifact and run pending migrations before traffic cutover."
  });
}

function checkBackupConfiguration(options = {}) {
  const explicitBackup = Boolean(options.backup);
  const disabled = boolEnv("AGORA_BACKUP_DISABLED");
  const backupDir = env("AGORA_BACKUP_DIR");
  const retention = positiveNumber(env("AGORA_BACKUP_RETENTION_FILES"), 20);
  const configured = explicitBackup || Boolean(backupDir);
  if (options.allowMissingBackup && !configured && !disabled) {
    return warn(
      "backup-configuration",
      "Server backup configuration",
      "No backup directory or explicit backup file provided; allowed for local dry-run only",
      "Set AGORA_BACKUP_DIR to durable storage or pass --backup <file> before a real production upgrade."
    );
  }
  return gate({
    id: "backup-configuration",
    label: "Server backup configuration",
    done: !disabled && configured && retention >= 3,
    detail: disabled
      ? "Server backups are disabled"
      : configured ? `${explicitBackup ? "Explicit backup file" : backupDir}; ${retention} retained file${retention === 1 ? "" : "s"}` : "No backup directory or explicit backup file provided",
    fix: "Set AGORA_BACKUP_DIR to durable storage or pass --backup <file>, keep backups enabled, and retain at least 3 files."
  });
}

function checkBackupArtifact(options = {}) {
  const backupPath = resolveBackupPath(options);
  if (!backupPath) {
    return options.allowMissingBackup
      ? warn("backup-artifact", "Latest backup artifact", "No backup file found; allowed for local dry-run only", "Run POST /api/backups/run before a real production upgrade.")
      : fail("backup-artifact", "Latest backup artifact", "No backup file found", "Run POST /api/backups/run or pass --backup <server-backup.json> before upgrading.");
  }

  try {
    const raw = fs.readFileSync(backupPath, "utf8");
    const backup = JSON.parse(raw);
    const maxAgeHours = positiveNumber(options.maxAgeHours, 48);
    const ageHours = backup.generatedAt ? (Date.now() - Date.parse(backup.generatedAt)) / 36e5 : Infinity;
    const counts = backup.counts || {};
    const validCounts = ["companies", "projects", "tasks", "users", "memberships", "auditEvents"]
      .every((key) => Number.isFinite(counts[key]) && counts[key] >= 0);
    const done = backup.type === "agora.workspace-backup"
      && backup.version === 1
      && backup.snapshot
      && backup.workspace?.id
      && backup.workspace?.name
      && Number.isFinite(ageHours)
      && ageHours >= -0.25
      && ageHours <= maxAgeHours
      && validCounts;
    return gate({
      id: "backup-artifact",
      label: "Latest backup artifact",
      done,
      detail: done
        ? `${path.relative(ROOT, backupPath)} for ${backup.workspace.name}; generated ${backup.generatedAt}`
        : backupArtifactProblem(backup, ageHours, maxAgeHours, validCounts),
      fix: "Create a fresh server backup, confirm it is valid JSON, and keep the file reachable before applying migrations or deploying new API code."
    });
  } catch (error) {
    return fail("backup-artifact", "Latest backup artifact", `Could not parse ${path.relative(ROOT, backupPath)}: ${error.message}`, "Create a new server backup and rerun the upgrade safety check.");
  }
}

function resolveBackupPath(options = {}) {
  if (options.backup) return path.resolve(ROOT, options.backup);
  const backupDir = env("AGORA_BACKUP_DIR");
  if (!backupDir) return "";
  try {
    const dir = path.resolve(backupDir);
    const latest = fs.readdirSync(dir)
      .filter((file) => /^agora-workspace-backup-.*\.json$/.test(file))
      .map((file) => {
        const filePath = path.join(dir, file);
        return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    return latest?.filePath || "";
  } catch {
    return "";
  }
}

function backupArtifactProblem(backup, ageHours, maxAgeHours, validCounts) {
  const problems = [];
  if (backup.type !== "agora.workspace-backup") problems.push("type is not agora.workspace-backup");
  if (backup.version !== 1) problems.push("version is not 1");
  if (!backup.snapshot) problems.push("snapshot missing");
  if (!backup.workspace?.id || !backup.workspace?.name) problems.push("workspace identity missing");
  if (!Number.isFinite(ageHours)) problems.push("generatedAt missing or invalid");
  else if (ageHours < -0.25) problems.push("generatedAt is in the future");
  else if (ageHours > maxAgeHours) problems.push(`backup is ${Math.round(ageHours)}h old; max ${maxAgeHours}h`);
  if (!validCounts) problems.push("counts are missing or invalid");
  return problems.join("; ");
}

function gate({ id, label, done, detail, fix }) {
  return { id, label, status: done ? "pass" : "fail", detail, fix };
}

function fail(id, label, detail, fix) {
  return { id, label, status: "fail", detail, fix };
}

function warn(id, label, detail, fix) {
  return { id, label, status: "warn", detail, fix };
}

function env(key) {
  return String(process.env[key] || "").trim();
}

function boolEnv(key) {
  return ["1", "true", "yes", "on"].includes(env(key).toLowerCase());
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function printReport(report) {
  console.log("Agora upgrade safety check");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Result: ${report.ok ? "PASS" : "FAIL"} (${report.summary.passing}/${report.summary.total} passing, ${report.summary.warnings} warnings, ${report.summary.blockers} blockers)`);
  console.log("");
  report.checks.forEach((check) => {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${marker}] ${check.label}`);
    console.log(`  ${check.detail}`);
    if (check.status !== "pass") console.log(`  Fix: ${check.fix}`);
  });
}

function printHelp() {
  console.log(`Agora upgrade safety check

Usage:
  npm run verify:upgrade -- [options]
  npm run agora -- upgrade check [options]

Options:
  --env <file>              Load environment values from a file
  --backup <file>           Validate this server backup instead of scanning AGORA_BACKUP_DIR
  --max-age-hours <hours>   Maximum acceptable backup age, default 48
  --allow-missing-backup    Warn instead of fail when no backup exists; local dry-runs only
  --json                    Print machine-readable JSON
`);
}
