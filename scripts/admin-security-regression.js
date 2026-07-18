#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const app = ["app.js", "app-inbox.js", "app-recovery.js", "app-project-board.js", "app-runtime.js"]
  .map((file) => fs.readFileSync(path.join(root, "src", file), "utf8"))
  .join("\n");
const api = fs.readFileSync(path.join(root, "server", "api.js"), "utf8");
const icmContext = fs.readFileSync(path.join(root, "server", "icm-context.js"), "utf8");
const storage = fs.readFileSync(path.join(root, "server", "storage.js"), "utf8");
const concurrency = fs.readFileSync(path.join(root, "server", "concurrency.js"), "utf8");
const staticServer = fs.readFileSync(path.join(root, "server", "static.js"), "utf8");
const desktopMain = fs.readFileSync(path.join(root, "desktop", "electron", "main.cjs"), "utf8");
const mcpServer = fs.readFileSync(path.join(root, "scripts", "agora-mcp-server.js"), "utf8");
const workspaceRevisionMigration = fs.readFileSync(path.join(root, "server", "migrations", "006_workspace_revisions.sql"), "utf8");
const hostedVerifier = fs.readFileSync(path.join(root, "scripts", "hosted-env-verify.js"), "utf8");
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
assert(app.includes("function portableExportSnapshot()"), "portable exports must use a redacted export snapshot");
assert(app.includes("function redactExportInvitations"), "portable exports must redact invitation tokens");
assert(app.includes("function redactExportPortalLinks"), "portable exports must redact portal link tokens");
assert(!app.includes('searchParams.set("token", apiSession.token)'), "realtime events must not put bearer tokens in URLs");
assert(app.includes("connectRealtimeStream(connection)") && app.includes("Authorization: `Bearer ${apiSession.token}`"), "realtime events must authenticate with bearer headers");
assert(api.includes('await assertRateLimit(request, "invitation-lookup", 12);'), "public invitation lookup must be rate limited");
assert(api.includes("publicInvitationSummaries(workspaceInvitations(snapshot))"), "workspace/member reads must redact invitation tokens");
assert(api.includes("users: snapshotUsersOnly(existingSnapshot)") && api.includes("memberships: snapshotMembershipsOnly(existingSnapshot)"), "whole-workspace saves must preserve server-owned access state");
assert(api.includes('request.method === "PATCH"') && api.includes("updateWorkspaceMemberAccess"), "member access changes must use a guarded endpoint");
assert(api.includes("refreshSessionAccess(session, storage)"), "active sessions must refresh current membership permissions");
assert(api.includes("function assertAuthenticatedRequestRateLimits"), "authenticated API mutations must pass through user rate limits");
assert(api.includes("function assertRealtimeConnectionLimit"), "realtime streams must enforce concurrent connection limits");
assert(api.includes('response.setHeader("Retry-After"'), "rate-limited API responses must include Retry-After");
assert(api.includes('id: "api-rate-limit-coverage"'), "backend health must expose API rate-limit coverage");
assert(api.includes("incrementRateLimitBucket") && api.includes("AGORA_RATE_LIMIT_DRIVER"), "API must support a distributed rate-limit adapter");
assert(api.includes("recent429s") && api.includes("api_rate_limit_exceeded"), "rate-limit abuse must be observable and audited");
assert(hostedVerifier.includes("function checkRateLimiting") && hostedVerifier.includes("AGORA_RATE_LIMIT_DRIVER=supabase"), "hosted verifier must require distributed or edge rate limits");
assert(app.includes("function renderBackendRateLimitPanel"), "Backend Health UI must expose rate-limit controls and abuse signals");
assert(envExample.includes("AGORA_AUTHENTICATED_WRITE_RATE_LIMIT_ATTEMPTS"), ".env.example must document authenticated write rate limits");
assert(envExample.includes("AGORA_RATE_LIMIT_DRIVER=memory"), ".env.example must document rate limit driver selection");
assert(api.includes("function authorizedClientAiBaseUrl") && api.includes("AGORA_AI_ALLOWED_BASE_URLS"), "client AI base URLs must be admin gated and allowlisted");
assert(icmContext.includes("function icmObjectHash") && icmContext.includes('["useicm.com", "www.useicm.com"]'), "ICM context reads must use an explicit provider allowlist");
assert(icmContext.includes('redirect: "error"') && icmContext.includes("ICM_CONTEXT_LIMIT_BYTES") && icmContext.includes("ICM_CONTEXT_TIMEOUT_MS"), "ICM context reads must reject redirects and enforce size/time limits");
assert(api.includes('hasPermission(session, "integrations:write")') && api.includes('url.pathname === "/api/integrations/icm/context/preview"'), "ICM context preview must require integration permission");
assert(app.includes("untrusted import") && app.includes("contentHash"), "ICM captures must retain visible untrusted provenance");
assert(api.includes("function localCorsOriginsAllowed()"), "localhost CORS origins must be environment gated");
assert(hostedVerifier.includes("function checkCorsPolicy()"), "hosted verifier must fail unsafe production CORS policy");
assert(hostedVerifier.includes("AGORA_ALLOW_LOCALHOST_ORIGINS=false"), "hosted verifier must guide localhost CORS hardening");
assert(hostedVerifier.includes("AGORA_BACKUP_SCHEDULER_ENABLED=true"), "hosted verifier must require scheduled server backups");
assert(hostedVerifier.includes("function checkAiProvider()"), "hosted verifier must check AI provider hardening");
assert(hostedVerifier.includes("AGORA_SMTP_USER") && hostedVerifier.includes("AGORA_SMTP_PASSWORD"), "hosted verifier must require SMTP credentials");

assert(staticServer.includes("function isProductionCsp()"), "static server must expose production CSP mode");
assert(staticServer.includes("AGORA_STRICT_CSP"), "static server must support strict CSP flag");
assert(staticServer.includes("PUBLIC_ROOT_FILES") && staticServer.includes("PUBLIC_PATH_PREFIXES"), "static server must use an explicit public-file allowlist");
assert(staticServer.includes('segment.startsWith(".")'), "static server must reject hidden paths");
assert(staticServer.includes("const connectSrc = production") && staticServer.includes('"https://*.supabase.co"') && staticServer.includes('"https:"'), "static server must split production and development connect sources");
assert(api.includes('id: "strict-csp"'), "backend health must expose strict CSP as a production gate");
assert(api.includes('Set AGORA_STRICT_CSP=true or NODE_ENV=production'), "strict CSP gate must include a concrete hosted fix");
assert(desktopMain.includes("function isProductionCsp()"), "desktop shell must expose production CSP mode");
assert(desktopMain.includes('envFlag("AGORA_STRICT_CSP", app.isPackaged)'), "packaged desktop builds must default to strict CSP");
assert(desktopMain.includes("safeStorage") && desktopMain.includes("agora-secure-session:save"), "desktop shell must expose OS-backed secure session storage");
assert(desktopMain.includes("assertTrustedIpcEvent"), "desktop secure session IPC must verify the app origin");
assert(app.includes("function hydrateSecureApiSession()"), "browser app must hydrate desktop secure API sessions");
assert(app.includes("storageRemove(API_SESSION_KEY)") && app.includes("desktopSecureSessionStore"), "desktop API sessions must migrate out of plain localStorage");
assert(fs.readFileSync(path.join(root, "desktop", "electron", "preload.cjs"), "utf8").includes("secureSession"), "desktop preload must expose the secure session bridge");

assert(rootPackage.includes('"audit": "npm audit --audit-level=moderate && npm --prefix desktop audit --audit-level=moderate"'), "root package must expose dependency audit script");
assert(packageJson.scripts["test:static-security"] === "node scripts/static-security-test.js", "security checks must include live static-file probes");
assert(concurrency.includes("WORKSPACE_REVISION") && storage.includes("workspaceConflictError"), "workspace storage must reject stale revisions");
assert(workspaceRevisionMigration.includes("agora_compare_and_swap_workspace_snapshot"), "Supabase must compare-and-swap workspace revisions");
assert(app.includes("workspaceRevision") && app.includes("expectedRevision"), "browser workspace saves must carry revision tokens");
assert(app.includes("reportLocalPersistenceFailure") && !app.includes("apiSyncQueue.filter((entry) => entry.id !== id)].slice"), "offline persistence must surface failures and retain queued writes");
assert(mcpServer.includes("AGORA_API_URL must use HTTPS for non-loopback hosts"), "MCP bearer tokens must require HTTPS outside loopback");
assert(app.includes(`version: "${packageJson.version}"`), "browser release metadata must match package.json version");
assert(api.includes('const API_VERSION = packageJson.version || "0.1.0";'), "API version must come from package.json");
assert(workflow.includes("node-version: \"22\""), "CI must use a Node version supported by desktop security tooling");
assert(workflow.includes("npm run audit"), "CI must run dependency audit");

console.log("Admin security regression checks passed");
