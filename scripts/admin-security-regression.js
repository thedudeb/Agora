#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const api = fs.readFileSync(path.join(root, "server", "api.js"), "utf8");
const staticServer = fs.readFileSync(path.join(root, "server", "static.js"), "utf8");
const desktopMain = fs.readFileSync(path.join(root, "desktop", "electron", "main.cjs"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "qa.yml"), "utf8");
const rootPackage = fs.readFileSync(path.join(root, "package.json"), "utf8");
const packageJson = JSON.parse(rootPackage);
const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");

function has(text) {
  assert(app.includes(text), `Missing expected admin security contract: ${text}`);
}

[
  'id: "workspace-import"',
  'id: "member-role-change"',
  'id: "sprint-close"',
  'id: "sprint-automation-run"',
  'id: "scheduler-run"',
  'id: "integrations-update"',
  'id: "payment-settings"',
  'id: "notification-delivery"',
  'id: "roadmap-delete"',
  'id: "automation-delete"'
].forEach(has);

[
  'requireAdminAction("workspace-import"',
  'requireAdminAction("member-role-change"',
  'requireAdminAction("sprint-close"',
  'requireAdminAction("sprint-automation-run"',
  'requireAdminAction("scheduler-run"',
  'requireAdminAction("integrations-update"',
  'requireAdminAction("payment-settings"',
  'requireAdminAction("notification-delivery"',
  'requireAdminAction("roadmap-delete"',
  'requireAdminAction("automation-delete"'
].forEach(has);

[
  'adminActionId: readinessAction.id',
  'requiredPermission: readinessAction.permission',
  'restoreHint: restoreHint || readinessAction?.restoreHint',
  'action: "workspace_import"',
  'action: "workspace_export"',
  'action: "workspace_restore"',
  'action: "sprint_close"',
  'action: "sprint_close_undo"',
  'action: "automation_delete"',
  'action: "payment_settings_update"',
  'action: "integrations_update"',
  'action: "scheduler_run"'
].forEach(has);

const roleMapMatch = app.match(/function rolePermissionMap\(\) \{\n  return \{([\s\S]*?)\n  \};\n\}/);
assert(roleMapMatch, "rolePermissionMap() contract was not found");
const roleMapSource = roleMapMatch[1];
assert(/admin: \[[^\]]*"workspace:import"/.test(roleMapSource), "admin must keep workspace import/export permission");
assert(!/manager: \[[^\]]*"workspace:import"/.test(roleMapSource), "manager must not receive workspace import/export permission");
assert(!/member: \[[^\]]*"payments:write"/.test(roleMapSource), "member must not receive payment admin permission");
assert(!/client: \[[^\]]*"projects:write"/.test(roleMapSource), "client must not receive project admin permission");

assert(api.includes('return envFlag("AGORA_PUBLIC_FEATURE_REQUESTS", false);'), "public feature requests must default to disabled");
assert(envExample.includes("AGORA_PUBLIC_FEATURE_REQUESTS=false"), ".env.example must keep public feature requests opt-in");
assert(api.includes('["__proto__", "constructor", "prototype"].includes(key)'), "workspace import must reject prototype pollution keys");
assert(api.includes("validateWorkspaceSnapshotShape(snapshot);"), "workspace import must validate snapshot shape before persistence");
assert(api.includes('validateRequiredStringRecords(snapshot.tasks, "tasks", ["id", "projectId", "title"])'), "workspace import must require core task fields");

assert(staticServer.includes("function isProductionCsp()"), "static server must expose production CSP mode");
assert(staticServer.includes("AGORA_STRICT_CSP"), "static server must support strict CSP flag");
assert(staticServer.includes("const connectSrc = production") && staticServer.includes('"https://*.supabase.co"') && staticServer.includes('"https:"'), "static server must split production and development connect sources");
assert(api.includes('id: "strict-csp"'), "backend health must expose strict CSP as a production gate");
assert(api.includes('Set AGORA_STRICT_CSP=true or NODE_ENV=production'), "strict CSP gate must include a concrete hosted fix");
assert(desktopMain.includes("function isProductionCsp()"), "desktop shell must expose production CSP mode");
assert(desktopMain.includes('envFlag("AGORA_STRICT_CSP", app.isPackaged)'), "packaged desktop builds must default to strict CSP");

assert(rootPackage.includes('"audit": "npm audit --audit-level=moderate && npm --prefix desktop audit --audit-level=moderate"'), "root package must expose dependency audit script");
assert(app.includes(`version: "${packageJson.version}"`), "browser release metadata must match package.json version");
assert(api.includes('const API_VERSION = packageJson.version || "0.1.0";'), "API version must come from package.json");
assert(workflow.includes("node-version: \"22\""), "CI must use a Node version supported by desktop security tooling");
assert(workflow.includes("npm run audit"), "CI must run dependency audit");

console.log("Admin security regression checks passed");
