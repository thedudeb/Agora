#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "ecosystem", "extension-points.json");
const PLUGIN_DOC = fs.readFileSync(path.join(ROOT, "docs", "plugin-architecture.md"), "utf8");
const MCP_DOC = fs.readFileSync(path.join(ROOT, "docs", "mcp-server.md"), "utf8");
const PLUGIN_README = fs.readFileSync(path.join(ROOT, "plugins", "README.md"), "utf8");
const MCP_SERVER = fs.readFileSync(path.join(ROOT, "scripts", "agora-mcp-server.js"), "utf8");

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const errors = validateRegistry(registry);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: errors.length === 0, errors, registry }, null, 2));
} else if (errors.length) {
  console.error("Agora ecosystem check failed");
  errors.forEach((error) => console.error(`- ${error}`));
} else {
  console.log(`Agora ecosystem check passed: ${registry.extensionPoints.length} extension points, ${registry.examplePlugins.length} example plugins`);
}

if (errors.length) process.exitCode = 1;

function validateRegistry(payload) {
  const errors = [];
  if (payload.type !== "agora.extension-registry") errors.push("Registry type must be agora.extension-registry.");
  if (payload.version !== 1) errors.push("Registry version must be 1.");
  if (!Array.isArray(payload.extensionPoints) || !payload.extensionPoints.length) errors.push("Registry needs extensionPoints.");

  const keys = new Set();
  for (const point of payload.extensionPoints || []) {
    if (!point.key || !point.label || !point.surface || !point.status) errors.push(`Extension point ${point.key || "unknown"} is incomplete.`);
    if (keys.has(point.key)) errors.push(`Duplicate extension point: ${point.key}`);
    keys.add(point.key);
    if (!PLUGIN_DOC.includes(point.key) && !PLUGIN_README.includes(point.key)) errors.push(`Extension point ${point.key} is not documented in plugin docs.`);
  }

  for (const pluginPath of payload.examplePlugins || []) {
    const manifestPath = path.join(ROOT, pluginPath, "plugin.json");
    if (!fs.existsSync(manifestPath)) {
      errors.push(`Example plugin missing: ${pluginPath}`);
      continue;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.type !== "agora.plugin") errors.push(`${pluginPath} is not an Agora plugin.`);
    Object.keys(manifest.contributes || {}).forEach((key) => {
      if (!keys.has(key)) errors.push(`${pluginPath} contributes unknown extension point ${key}.`);
    });
  }

  for (const tool of payload.mcpSurfaces?.tools || []) {
    if (!MCP_DOC.includes(tool) || !MCP_SERVER.includes(tool)) errors.push(`MCP tool ${tool} must be documented and implemented.`);
  }
  for (const resource of payload.mcpSurfaces?.resources || []) {
    if (!MCP_DOC.includes(resource) || !MCP_SERVER.includes(resource)) errors.push(`MCP resource ${resource} must be documented and implemented.`);
  }
  for (const prompt of payload.mcpSurfaces?.prompts || []) {
    if (!MCP_DOC.includes(prompt) || !MCP_SERVER.includes(prompt)) errors.push(`MCP prompt ${prompt} must be documented and implemented.`);
  }

  return errors;
}
