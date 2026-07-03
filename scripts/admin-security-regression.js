#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");

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

console.log("Admin security regression checks passed");
