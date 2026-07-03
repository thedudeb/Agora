#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_TARGET = path.join(ROOT, "plugins");
const MANIFEST_NAME = "plugin.json";
const MANIFEST_TYPE = "agora.plugin";
const SUPPORTED_MANIFEST_VERSION = 1;
const allowedPermissions = new Set([
  "workspace:read",
  "projects:read",
  "projects:write",
  "tasks:read",
  "tasks:write",
  "comments:write",
  "activity:write",
  "attachments:write",
  "approvals:write",
  "notifications:write",
  "integrations:write",
  "scheduler:run"
]);
const contributionKeys = new Set([
  "commands",
  "connectors",
  "views",
  "importers",
  "templates",
  "automationPacks",
  "mcpTools",
  "settingsPanels"
]);

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const targetArg = args.find((arg) => !arg.startsWith("--"));
  const target = path.resolve(ROOT, targetArg || DEFAULT_TARGET);
  const manifests = findManifests(target);
  const results = manifests.map(validateManifestFile);
  const errors = results.flatMap((result) => result.errors.map((error) => `${result.relativePath}: ${error}`));

  if (json) {
    console.log(JSON.stringify({ ok: errors.length === 0, manifests: results, errors }, null, 2));
  } else {
    results.forEach((result) => {
      const status = result.errors.length ? "failed" : "passed";
      console.log(`${status} ${result.relativePath}`);
      result.errors.forEach((error) => console.log(`  - ${error}`));
    });
    if (!results.length) console.log(`No ${MANIFEST_NAME} files found in ${path.relative(ROOT, target) || "."}`);
  }

  if (errors.length) process.exitCode = 1;
}

function findManifests(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return path.basename(target) === MANIFEST_NAME ? [target] : [];
  const direct = path.join(target, MANIFEST_NAME);
  if (fs.existsSync(direct)) return [direct];
  return fs.readdirSync(target, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(target, entry.name, MANIFEST_NAME))
    .filter((manifestPath) => fs.existsSync(manifestPath));
}

function validateManifestFile(manifestPath) {
  const relativePath = path.relative(ROOT, manifestPath);
  const errors = [];
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return { path: manifestPath, relativePath, id: "", errors: [`Invalid JSON: ${error.message}`] };
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push("Manifest must be a JSON object.");
  } else {
    validateString(manifest, "id", errors, { pattern: /^[a-z0-9][a-z0-9-]{2,63}$/ });
    validateString(manifest, "name", errors, { minLength: 3, maxLength: 80 });
    validateString(manifest, "version", errors, { pattern: /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i });
    validateString(manifest, "description", errors, { minLength: 12, maxLength: 240 });
    if (manifest.type !== MANIFEST_TYPE) errors.push(`type must be "${MANIFEST_TYPE}".`);
    if (manifest.manifestVersion !== SUPPORTED_MANIFEST_VERSION) errors.push(`manifestVersion must be ${SUPPORTED_MANIFEST_VERSION}.`);
    validatePermissions(manifest.permissions, errors);
    validateRuntime(manifest.runtime, errors);
    validateContributes(manifest.contributes, errors);
  }

  return {
    path: manifestPath,
    relativePath,
    id: manifest?.id || "",
    name: manifest?.name || "",
    version: manifest?.version || "",
    errors
  };
}

function validateString(manifest, key, errors, options = {}) {
  const value = manifest[key];
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${key} is required.`);
    return;
  }
  if (options.minLength && value.trim().length < options.minLength) errors.push(`${key} must be at least ${options.minLength} characters.`);
  if (options.maxLength && value.trim().length > options.maxLength) errors.push(`${key} must be ${options.maxLength} characters or fewer.`);
  if (options.pattern && !options.pattern.test(value.trim())) errors.push(`${key} has an invalid format.`);
}

function validatePermissions(permissions, errors) {
  if (!Array.isArray(permissions)) {
    errors.push("permissions must be an array.");
    return;
  }
  const seen = new Set();
  permissions.forEach((permission) => {
    if (typeof permission !== "string" || !allowedPermissions.has(permission)) {
      errors.push(`unsupported permission "${permission}".`);
    }
    if (seen.has(permission)) errors.push(`duplicate permission "${permission}".`);
    seen.add(permission);
  });
}

function validateRuntime(runtime, errors) {
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
    errors.push("runtime must describe how the plugin runs.");
    return;
  }
  const mode = runtime.mode;
  if (!["none", "api", "iframe"].includes(mode)) errors.push("runtime.mode must be one of none, api, or iframe.");
  if (mode === "iframe") {
    validateString(runtime, "entry", errors, { minLength: 1, maxLength: 180 });
    if (String(runtime.entry || "").startsWith("http")) errors.push("runtime.entry must be a local plugin asset, not a remote URL.");
  }
}

function validateContributes(contributes, errors) {
  if (!contributes || typeof contributes !== "object" || Array.isArray(contributes)) {
    errors.push("contributes must be an object.");
    return;
  }
  Object.keys(contributes).forEach((key) => {
    if (!contributionKeys.has(key)) errors.push(`unsupported contribution key "${key}".`);
    if (!Array.isArray(contributes[key])) errors.push(`contributes.${key} must be an array.`);
  });
  const total = Object.values(contributes).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
  if (!total) errors.push("contributes must include at least one command, connector, view, importer, template, automation pack, MCP tool, or settings panel.");
}

main();
