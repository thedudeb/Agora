const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");
const { URL } = require("node:url");
const { loadEnvFile } = require("./env");
const { createStorage } = require("./storage");

loadEnvFile();

const PORT = Number(process.env.AGORA_API_PORT || 8787);
const BODY_LIMIT_BYTES = 15 * 1024 * 1024;
const UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SCRYPT_COST = 16384;
const SESSION_TTL_MS = positiveNumber(process.env.AGORA_SESSION_TTL_SECONDS, 8 * 60 * 60) * 1000;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_ATTEMPTS = 8;
const PASSWORD_RESET_TTL_MS = positiveNumber(process.env.AGORA_PASSWORD_RESET_TTL_MINUTES, 30) * 60 * 1000;
const INVITATION_TTL_MS = positiveNumber(process.env.AGORA_INVITATION_TTL_DAYS, 14) * 24 * 60 * 60 * 1000;

const workspace = {
  id: "workspace-acme",
  name: "Acme Studio",
  slug: "acme-studio"
};

const demoUsers = [
  { id: "mara", name: "Mara Chen", email: "mara@acme.test" },
  { id: "eli", name: "Eli Stone", email: "eli@acme.test" },
  { id: "nina", name: "Nina Patel", email: "nina@acme.test" },
  { id: "sam", name: "Sam Rivera", email: "sam@acme.test" }
];

const demoMemberships = [
  { memberId: "mara", role: "admin", status: "active" },
  { memberId: "eli", role: "manager", status: "active" },
  { memberId: "nina", role: "member", status: "active" },
  { memberId: "sam", role: "manager", status: "active" }
];

const rolePermissions = {
  admin: ["workspace:read", "workspace:write", "workspace:import", "audit:read", "members:write", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write"],
  manager: ["workspace:read", "workspace:write", "audit:read", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write"],
  member: ["workspace:read", "time:write", "comments:write", "activity:write", "attachments:write"],
  client: ["workspace:read", "comments:write", "activity:write", "approvals:write"]
};

const recordCollections = {
  companies: { writePermission: "projects:write", normalizer: normalizeCompany, label: "company" },
  approvals: { writePermission: "approvals:write", normalizer: normalizeApproval, label: "approval" },
  timeEntries: { writePermission: "time:write", normalizer: normalizeTimeEntry, label: "time entry" },
  comments: { writePermission: "comments:write", normalizer: normalizeComment, label: "comment" },
  activities: { writePermission: "activity:write", normalizer: normalizeActivity, label: "activity" },
  documents: { writePermission: "attachments:write", normalizer: normalizeDocument, label: "document" },
  files: { writePermission: "attachments:write", normalizer: normalizeFile, label: "file" },
  presence: { writePermission: "workspace:read", normalizer: normalizePresence, label: "presence" },
  chatMessages: { writePermission: "comments:write", normalizer: normalizeChatMessage, label: "chat message" },
  whiteboards: { writePermission: "comments:write", normalizer: normalizeWhiteboard, label: "whiteboard" },
  notificationSettings: { writePermission: "workspace:write", normalizer: normalizeNotificationSettingsRecord, label: "notification settings" },
  notificationReminders: { writePermission: "workspace:read", normalizer: normalizeNotificationReminder, label: "notification reminder" },
  notificationHistory: { writePermission: "workspace:read", normalizer: normalizeNotificationHistoryEvent, label: "notification history" },
  inboxState: { writePermission: "workspace:read", normalizer: normalizeInboxStateRecord, label: "inbox state" },
  integrationSettings: { writePermission: "workspace:write", normalizer: normalizeIntegrationSettingsRecord, label: "integration settings" }
};

const sessions = new Map();
const rateLimits = new Map();
const paymentIntents = new Map();

function envFlag(name, fallback = false) {
  const value = cleanString(process.env[name]).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientIp(request) {
  const forwarded = cleanString(request.headers["x-forwarded-for"]).split(",")[0]?.trim();
  return forwarded || request.socket?.remoteAddress || "unknown";
}

function assertRateLimit(request, scope, limit = AUTH_RATE_LIMIT_ATTEMPTS, windowMs = AUTH_RATE_LIMIT_WINDOW_MS) {
  const now = Date.now();
  const key = `${clientIp(request)}:${scope}`;
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > limit) {
    publicError(429, "Too many attempts. Please wait before trying again.");
  }
}

function createServer(options = {}) {
  const storage = options.storage || createStorage();
  const allowDemoAuth = options.allowDemoAuth ?? envFlag("AGORA_DEMO_AUTH", false);
  const allowPasswordlessAuth = options.allowPasswordlessAuth ?? envFlag("AGORA_PASSWORDLESS_AUTH", false);

  return http.createServer(async (request, response) => {
    try {
      const corsAllowed = applyCors(request, response);
      if (request.method === "OPTIONS") {
        response.writeHead(corsAllowed ? 204 : 403);
        response.end();
        return;
      }
      if (!corsAllowed) {
        sendError(response, 403, "Origin not allowed");
        return;
      }

      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          service: "agora-api",
          storage: storage.driver || "json-file",
          auth: authDriverLabel(),
          workspace
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/demo-login") {
        if (!allowDemoAuth) {
          sendError(response, 404, "Demo auth is disabled");
          return;
        }
        assertRateLimit(request, "demo-login", 20);
        const body = await readJsonBody(request);
        const memberId = body.memberId || "mara";
        const user = demoUsers.find((item) => item.id === memberId);
        const membership = demoMemberships.find((item) => item.memberId === memberId);
        if (!user || !membership || membership.status !== "active") {
          sendError(response, 401, "Invalid demo user");
          return;
        }

        const session = createSession(user, membership);
        sendJson(response, 200, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        if (!allowPasswordlessAuth) {
          sendError(response, 404, "Passwordless auth is disabled");
          return;
        }
        const body = await readJsonBody(request);
        assertRateLimit(request, `passwordless:${normalizeEmail(body.email)}`);
        const session = await createEmailSession(storage, body.email);
        sendJson(response, 200, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/password-login") {
        const body = await readJsonBody(request);
        assertRateLimit(request, `password:${normalizeEmail(body.email)}`);
        const session = await createPasswordSession(storage, body.email, body.password);
        sendJson(response, 200, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/request") {
        const body = await readJsonBody(request);
        assertRateLimit(request, `password-reset:${normalizeEmail(body.email)}`, 5);
        const result = await requestPasswordReset(storage, body.email);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/confirm") {
        const body = await readJsonBody(request);
        assertRateLimit(request, `password-reset-confirm:${normalizeEmail(body.email)}`, 8);
        const result = await confirmPasswordReset(storage, body);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/signup") {
        assertRateLimit(request, "signup", 5);
        const body = await readJsonBody(request);
        const session = await createOwnerAccount(storage, body);
        sendJson(response, 201, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/supabase-login") {
        assertRateLimit(request, "supabase-login");
        const body = await readJsonBody(request);
        const session = await createSupabaseSessionFromAccessToken(storage, body.accessToken);
        sendJson(response, 200, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/supabase-password-signup") {
        assertRateLimit(request, "supabase-password-signup", 5);
        const body = await readJsonBody(request);
        const result = await createSupabasePasswordAccount(storage, body);
        sendJson(response, result.pendingConfirmation ? 202 : 201, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/supabase-password-login") {
        const body = await readJsonBody(request);
        assertRateLimit(request, `supabase-password:${normalizeEmail(body.email)}`);
        const session = await createSupabasePasswordSession(storage, body);
        sendJson(response, 200, session);
        return;
      }

      const invitationAcceptMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/accept$/);
      if (invitationAcceptMatch && request.method === "POST") {
        assertRateLimit(request, "invitation-accept", 12);
        const body = await readJsonBody(request);
        const session = await acceptInvitation(storage, decodeURIComponent(invitationAcceptMatch[1]), body.name, body.password);
        sendJson(response, 200, session);
        return;
      }

      const publicInvitationMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)$/);
      if (publicInvitationMatch && request.method === "GET") {
        const invitation = await getInvitation(storage, decodeURIComponent(publicInvitationMatch[1]));
        sendJson(response, 200, { invitation });
        return;
      }

      const session = await requireSession(request, response, storage);
      if (!session) return;

      if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        sessions.delete(session.token);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/session") {
        sendJson(response, 200, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/change-password") {
        const body = await readJsonBody(request);
        const result = await changePassword(storage, session, body);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/backend/health") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const health = await buildBackendHealth(storage, session);
        sendJson(response, 200, health);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/scheduler/notifications/due") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const reminders = await dueNotificationRemindersForScheduler(storage, session);
        sendJson(response, 200, {
          reminders,
          count: reminders.length,
          generatedAt: new Date().toISOString()
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/scheduler/notifications/run") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const result = await runNotificationScheduler(storage, {
          session,
          actorId: session.user.id,
          source: "manual"
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/payments/config") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        sendJson(response, 200, paymentConfig());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/payments/entitlements") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = await storage.loadWorkspaceSnapshot();
        sendJson(response, 200, { entitlements: paymentEntitlements(snapshot) });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/payments/checkout-intent") {
        if (!hasPermission(session, "workspace:write")) {
          sendError(response, 403, "Missing workspace write permission");
          return;
        }
        const body = await readJsonBody(request);
        const intent = createPaymentIntent(body, session);
        sendJson(response, 201, { intent });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/payments/events") {
        if (!hasPermission(session, "workspace:write")) {
          sendError(response, 403, "Missing workspace write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await handlePaymentEvent(storage, body, session);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ai/operator") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await runAiOperator(body, session);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/members") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = scopedSnapshot(await storage.loadWorkspaceSnapshot(), session);
        sendJson(response, 200, {
          users: publicUsers(workspaceUsers(snapshot)),
          memberships: workspaceMemberships(snapshot),
          invitations: workspaceInvitations(snapshot)
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/invitations") {
        if (!hasPermission(session, "members:write")) {
          sendError(response, 403, "Missing members write permission");
          return;
        }
        const snapshot = await storage.loadWorkspaceSnapshot();
        sendJson(response, 200, { invitations: workspaceInvitations(snapshot) });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/invitations") {
        if (!hasPermission(session, "members:write")) {
          sendError(response, 403, "Missing members write permission");
          return;
        }
        const body = await readJsonBody(request);
        const invitation = await createInvitation(storage, body, session);
        sendJson(response, 201, { invitation });
        return;
      }

      const invitationResendMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/resend$/);
      if (invitationResendMatch && request.method === "POST") {
        if (!hasPermission(session, "members:write")) {
          sendError(response, 403, "Missing members write permission");
          return;
        }
        const invitation = await resendInvitation(storage, decodeURIComponent(invitationResendMatch[1]), session);
        sendJson(response, 200, { invitation });
        return;
      }

      const invitationManageMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)$/);
      if (invitationManageMatch && request.method === "DELETE") {
        if (!hasPermission(session, "members:write")) {
          sendError(response, 403, "Missing members write permission");
          return;
        }
        const invitation = await revokeInvitation(storage, decodeURIComponent(invitationManageMatch[1]), session);
        sendJson(response, 200, { invitation });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/records") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = scopedSnapshot(await storage.loadWorkspaceSnapshot(), session);
        const records = Object.fromEntries(await Promise.all(Object.keys(recordCollections).map(async (key) => [
          key,
          await storage.loadRecords(key, scopedRecordFilters(session, {}))
        ])));
        sendJson(response, 200, {
          collections: Object.keys(recordCollections),
          records,
          snapshotFallback: !Object.values(records).some((items) => items.length) ? snapshot : undefined
        });
        return;
      }

      const recordMatch = url.pathname.match(/^\/api\/records\/([^/]+)$/);
      if (recordMatch && request.method === "GET") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const collectionKey = decodeURIComponent(recordMatch[1]);
        const config = recordCollections[collectionKey];
        if (!config) {
          sendError(response, 404, "Record collection not found");
          return;
        }
        const records = await storage.loadRecords(collectionKey, scopedRecordFilters(session, recordFiltersFromUrl(url)));
        sendJson(response, 200, { collection: collectionKey, records });
        return;
      }

      if (recordMatch && (request.method === "POST" || request.method === "PUT")) {
        const collectionKey = decodeURIComponent(recordMatch[1]);
        const config = recordCollections[collectionKey];
        if (!config) {
          sendError(response, 404, "Record collection not found");
          return;
        }
        if (!hasPermission(session, config.writePermission)) {
          sendError(response, 403, `Missing ${config.writePermission} permission`);
          return;
        }
        const body = await readJsonBody(request);
        const record = await upsertCollectionItem(
          storage,
          collectionKey,
          body.record || body[config.label.replace(" ", "")] || body,
          config.normalizer,
          session,
          `${collectionKey}_upsert`,
          (item) => `${config.label} ${item.title || item.name || item.id}`
        );
        sendJson(response, request.method === "POST" ? 201 : 200, { collection: collectionKey, record });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/projects") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = scopedSnapshot(await storage.loadWorkspaceSnapshot(), session);
        sendJson(response, 200, { projects: Array.isArray(snapshot.projects) ? snapshot.projects : [] });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const project = await upsertProject(storage, body.project || body, session, "project_create");
        sendJson(response, 201, { project });
        return;
      }

      const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      const projectRestoreMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/restore$/);
      if (projectRestoreMatch && request.method === "POST") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const project = await archiveProject(storage, decodeURIComponent(projectRestoreMatch[1]), session, false);
        sendJson(response, 200, { project });
        return;
      }

      if (projectMatch && request.method === "PUT") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const project = await upsertProject(storage, { ...(body.project || body), id: decodeURIComponent(projectMatch[1]) }, session, "project_update");
        sendJson(response, 200, { project });
        return;
      }

      if (projectMatch && request.method === "DELETE") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const project = await archiveProject(storage, decodeURIComponent(projectMatch[1]), session, true);
        sendJson(response, 200, { project });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/tasks") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = scopedSnapshot(await storage.loadWorkspaceSnapshot(), session);
        const projectId = url.searchParams.get("projectId");
        const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
        sendJson(response, 200, { tasks: projectId ? tasks.filter((task) => task.projectId === projectId) : tasks });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/tasks") {
        if (!hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing tasks write permission");
          return;
        }
        const body = await readJsonBody(request);
        const task = await upsertTask(storage, body.task || body, session, "task_create");
        sendJson(response, 201, { task });
        return;
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      const taskRestoreMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/restore$/);
      if (taskRestoreMatch && request.method === "POST") {
        if (!hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing tasks write permission");
          return;
        }
        const task = await archiveTask(storage, decodeURIComponent(taskRestoreMatch[1]), session, false);
        sendJson(response, 200, { task });
        return;
      }

      if (taskMatch && request.method === "PUT") {
        if (!hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing tasks write permission");
          return;
        }
        const body = await readJsonBody(request);
        const task = await upsertTask(storage, { ...(body.task || body), id: decodeURIComponent(taskMatch[1]) }, session, "task_update");
        sendJson(response, 200, { task });
        return;
      }

      if (taskMatch && request.method === "DELETE") {
        if (!hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing tasks write permission");
          return;
        }
        const task = await archiveTask(storage, decodeURIComponent(taskMatch[1]), session, true);
        sendJson(response, 200, { task });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/comments") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const taskId = url.searchParams.get("taskId");
        const comments = await storage.loadRecords("comments", scopedRecordFilters(session, { taskId }));
        sendJson(response, 200, { comments });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/comments") {
        if (!hasPermission(session, "comments:write")) {
          sendError(response, 403, "Missing comments write permission");
          return;
        }
        const body = await readJsonBody(request);
        const comment = await upsertCollectionItem(storage, "comments", body.comment || body, normalizeComment, session, "comment_create", (item) => `comment ${item.id}`);
        sendJson(response, 201, { comment });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/activities") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const taskId = url.searchParams.get("taskId");
        const projectId = url.searchParams.get("projectId");
        const activities = await storage.loadRecords("activities", scopedRecordFilters(session, { taskId, projectId }));
        sendJson(response, 200, { activities });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/activities") {
        if (!hasPermission(session, "activity:write")) {
          sendError(response, 403, "Missing activity write permission");
          return;
        }
        const body = await readJsonBody(request);
        const activity = await upsertCollectionItem(storage, "activities", body.activity || body, normalizeActivity, session, "activity_create", (item) => `activity ${item.type}`);
        sendJson(response, 201, { activity });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/documents") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const projectId = url.searchParams.get("projectId");
        const documents = await storage.loadRecords("documents", scopedRecordFilters(session, { projectId }));
        sendJson(response, 200, { documents });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/documents") {
        if (!hasPermission(session, "attachments:write")) {
          sendError(response, 403, "Missing attachments write permission");
          return;
        }
        const body = await readJsonBody(request);
        const document = await upsertCollectionItem(storage, "documents", body.document || body, normalizeDocument, session, "document_create", (item) => `document ${item.title}`);
        sendJson(response, 201, { document });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/files") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const projectId = url.searchParams.get("projectId");
        const files = await storage.loadRecords("files", scopedRecordFilters(session, { projectId }));
        sendJson(response, 200, { files });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/files") {
        if (!hasPermission(session, "attachments:write")) {
          sendError(response, 403, "Missing attachments write permission");
          return;
        }
        const body = await readJsonBody(request);
        const file = await upsertCollectionItem(storage, "files", body.file || body, normalizeFile, session, "file_create", (item) => `file ${item.title}`);
        sendJson(response, 201, { file });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/files/upload") {
        if (!hasPermission(session, "attachments:write")) {
          sendError(response, 403, "Missing attachments write permission");
          return;
        }
        const body = await readJsonBody(request);
        const file = await uploadFileRecord(storage, body, session);
        sendJson(response, 201, { file });
        return;
      }

      const fileDownloadMatch = url.pathname.match(/^\/api\/files\/([^/]+)\/download$/);
      if (fileDownloadMatch && request.method === "GET") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        await downloadFileRecord(storage, decodeURIComponent(fileDownloadMatch[1]), session, response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/workspace") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const document = await storage.loadWorkspace();
        if (document?.snapshot) {
          sendJson(response, 200, { ...document, snapshot: scopedSnapshot(document.snapshot, session) });
          return;
        }
        sendJson(response, 200, document || {
          metadata: {
            createdAt: null,
            updatedAt: null,
            storage: storage.driver || "json-file"
          },
          snapshot: null
        });
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/workspace") {
        if (!hasPermission(session, "workspace:write")) {
          sendError(response, 403, "Missing workspace write permission");
          return;
        }
        const body = await readJsonBody(request);
        const document = await saveWorkspaceSnapshot(storage, body.snapshot || body, session, "workspace_update");
        sendJson(response, 200, document);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/workspace/import") {
        if (!hasPermission(session, "workspace:import")) {
          sendError(response, 403, "Missing workspace import permission");
          return;
        }
        const body = await readJsonBody(request);
        const document = await saveWorkspaceSnapshot(storage, body.snapshot || body, session, "workspace_import");
        sendJson(response, 200, document);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/audit-log") {
        if (!hasPermission(session, "audit:read")) {
          sendError(response, 403, "Missing audit read permission");
          return;
        }
        sendJson(response, 200, { events: await storage.loadAuditLog() });
        return;
      }

      sendError(response, 404, "Route not found");
    } catch (error) {
      sendError(response, error.statusCode || 500, error.publicMessage || "Internal server error");
    }
  });
}

async function buildBackendHealth(storage, session) {
  const storageDriver = storage.driver || "json-file";
  const authDriver = authDriverLabel();
  const snapshotDocument = await storage.loadWorkspace();
  const snapshot = snapshotDocument?.snapshot || {};
  const collectionReports = await Promise.all(Object.entries(recordCollections).map(async ([key, config]) => {
    try {
      const records = await storage.loadRecords(key, scopedRecordFilters(session, {}));
      return {
        key,
        label: config.label,
        status: "ready",
        count: Array.isArray(records) ? records.length : 0,
        writePermission: config.writePermission
      };
    } catch (error) {
      return {
        key,
        label: config.label,
        status: "error",
        count: 0,
        writePermission: config.writePermission,
        error: error.message
      };
    }
  }));
  const failedCollections = collectionReports.filter((collection) => collection.status !== "ready");
  const snapshotCollections = ["projects", "tasks", "users", "memberships", "invitations"];
  const snapshotCounts = Object.fromEntries(snapshotCollections.map((key) => [
    key,
    Array.isArray(snapshot[key]) ? snapshot[key].length : 0
  ]));
  const readiness = [
    {
      id: "storage-driver",
      label: "Storage driver",
      done: Boolean(storageDriver),
      detail: storageDriver === "supabase" ? "Supabase adapter is active" : "Local JSON storage is active"
    },
    {
      id: "auth-driver",
      label: "Authentication driver",
      done: Boolean(authDriver),
      detail: authDriver === "supabase" ? "Supabase Auth bearer tokens are accepted" : "Local/demo auth is active"
    },
    {
      id: "workspace-snapshot",
      label: "Workspace snapshot",
      done: Boolean(snapshotDocument?.snapshot),
      detail: snapshotDocument?.metadata?.updatedAt ? `Last saved ${snapshotDocument.metadata.updatedAt}` : "No saved API snapshot yet"
    },
    {
      id: "structured-records",
      label: "Structured records",
      done: failedCollections.length === 0,
      detail: failedCollections.length
        ? `${failedCollections.length} collection${failedCollections.length === 1 ? "" : "s"} need attention`
        : `${collectionReports.length} collections are reachable`
    },
    {
      id: "client-scope",
      label: "Client scoping",
      done: true,
      detail: sessionCompanyId(session) ? `Scoped to ${sessionCompanyId(session)}` : "Workspace role can see full workspace"
    },
    {
      id: "auth-hardening",
      label: "Auth hardening",
      done: !envFlag("AGORA_DEMO_AUTH", false) && !envFlag("AGORA_PASSWORDLESS_AUTH", false),
      detail: "Demo and passwordless auth are opt-in, sessions expire, and public auth endpoints are rate limited"
    },
    {
      id: "file-uploads",
      label: "File uploads",
      done: true,
      detail: storageDriver === "supabase"
        ? `Supabase Storage bucket ${supabaseStorageBucket()} is configured for uploads`
        : "Local API uploads are stored outside browser local storage"
    },
    {
      id: "audit-log",
      label: "Audit log",
      done: hasPermission(session, "audit:read"),
      detail: hasPermission(session, "audit:read") ? "Audit events are available to admins and project managers" : "Current role cannot read audit events"
    },
    {
      id: "notification-scheduler",
      label: "Notification scheduler",
      done: true,
      detail: envFlag("AGORA_SCHEDULER_ENABLED", false)
        ? "API scheduler worker is enabled"
        : "Scheduler endpoints are available for cron or manual runs"
    },
    {
      id: "production-mode",
      label: "Production mode",
      done: storageDriver === "supabase" && authDriver === "supabase",
      detail: storageDriver === "supabase" && authDriver === "supabase"
        ? "Supabase storage and Supabase Auth are both active"
        : "Set AGORA_STORAGE_DRIVER=supabase and AGORA_AUTH_DRIVER=supabase for production mode"
    }
  ];

  return {
    ok: failedCollections.length === 0,
    service: "agora-api",
    storage: storageDriver,
    auth: authDriver,
    workspace,
    workspaceId: storage.workspaceId || workspace.id,
    user: session.user,
    membership: session.membership,
    permissions: session.permissions,
    productionMode: storageDriver === "supabase" && authDriver === "supabase",
    snapshot: {
      exists: Boolean(snapshotDocument?.snapshot),
      metadata: snapshotDocument?.metadata || null,
      counts: snapshotCounts
    },
    records: collectionReports,
    readiness,
    generatedAt: new Date().toISOString()
  };
}

function schedulerRecordFilters(session) {
  if (!session) return {};
  const filters = scopedRecordFilters(session, {});
  if (hasPermission(session, "members:write")) return filters;
  return {
    ...filters,
    memberId: session.user.id
  };
}

async function dueNotificationRemindersForScheduler(storage, session = null) {
  const today = new Date().toISOString().slice(0, 10);
  const reminders = await storage.loadRecords("notificationReminders", schedulerRecordFilters(session));
  return reminders
    .filter((reminder) => reminder.status === "scheduled")
    .filter((reminder) => cleanString(reminder.remindAt) <= today)
    .filter((reminder) => !cleanString(reminder.sentAt))
    .sort((a, b) => cleanString(a.remindAt).localeCompare(cleanString(b.remindAt)));
}

async function runNotificationScheduler(storage, options = {}) {
  const reminders = await dueNotificationRemindersForScheduler(storage, options.session || null);
  const now = new Date().toISOString();
  const actorId = options.actorId || "scheduler";
  const source = options.source || "worker";
  const processed = [];

  for (const reminder of reminders) {
    const nextReminder = {
      ...reminder,
      sentAt: now,
      updatedAt: now
    };
    const savedReminder = await storage.upsertRecord("notificationReminders", nextReminder, {
      storage: storage.driver || "json-file",
      updatedBy: actorId,
      action: "notification_scheduler_reminder_sent"
    });
    const history = await storage.upsertRecord("notificationHistory", {
      id: `notification-history-${crypto.randomUUID()}`,
      memberId: reminder.memberId || "",
      kind: "reminder-fired",
      title: reminder.title || "Reminder",
      message: reminder.message || "Reminder is due.",
      reason: `Scheduled for ${reminder.remindAt}.`,
      count: 1,
      channel: "server scheduler",
      createdAt: now,
      updatedAt: now
    }, {
      storage: storage.driver || "json-file",
      updatedBy: actorId,
      action: "notification_scheduler_history"
    });
    processed.push({ reminder: savedReminder, history });
  }

  if (processed.length) {
    await storage.appendAuditEvent({
      actorId,
      action: "notification_scheduler_run",
      workspaceId: workspace.id,
      detail: `${source} scheduler processed ${processed.length} reminder${processed.length === 1 ? "" : "s"}`
    });
  }

  return {
    ok: true,
    processed: processed.length,
    reminders: processed.map((item) => item.reminder),
    history: processed.map((item) => item.history),
    generatedAt: now
  };
}

function paymentConfig() {
  return {
    mode: "test",
    testMode: true,
    providers: [
      {
        id: "test",
        label: "Server test adapter",
        configured: true,
        live: true,
        detail: "Issues server-side entitlements without moving money."
      },
      {
        id: "stripe",
        label: "Stripe",
        configured: Boolean(cleanString(process.env.STRIPE_SECRET_KEY || process.env.AGORA_STRIPE_SECRET_KEY)),
        live: false,
        detail: "Stubbed until Stripe checkout is configured on the API server."
      },
      {
        id: "x402",
        label: "x402",
        configured: envFlag("AGORA_X402_ENABLED", false),
        live: false,
        detail: "Stubbed until an x402 facilitator/wallet adapter is configured on the API server."
      },
      {
        id: "manual",
        label: "Manual invoice",
        configured: true,
        live: false,
        detail: "Records manual-payment intent metadata for admin review."
      }
    ]
  };
}

function paymentEntitlements(snapshot = {}) {
  const payments = snapshot.workspace?.payments || {};
  return Array.isArray(payments.entitlements) ? payments.entitlements.map(normalizeServerEntitlement).filter(Boolean).slice(0, 100) : [];
}

function createPaymentIntent(body = {}, session) {
  const item = normalizePaymentItem(body.item || body);
  const provider = cleanString(body.provider || "test").toLowerCase();
  const supported = new Set(["test", "manual", "stripe", "x402"]);
  if (!supported.has(provider)) publicError(400, "Unsupported payment provider");
  if (provider === "stripe" || provider === "x402") {
    publicError(400, `${provider} payments are not live yet. Use the server test adapter.`);
  }
  const now = new Date().toISOString();
  const intent = {
    id: `pay-intent-${crypto.randomUUID()}`,
    provider,
    mode: "test",
    status: provider === "test" ? "requires_test_confirmation" : "requires_manual_review",
    workspaceId: workspace.id,
    userId: session.user.id,
    item,
    amountCents: item.amountCents,
    currency: item.currency,
    payout: item.payout,
    createdAt: now,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
  paymentIntents.set(intent.id, intent);
  return intent;
}

async function handlePaymentEvent(storage, body = {}, session) {
  const type = cleanString(body.type || "checkout.test_completed");
  if (!["checkout.test_completed", "checkout.completed", "manual_payment.confirmed"].includes(type)) {
    publicError(400, "Unsupported payment event type");
  }
  const intentId = cleanString(body.intentId || body.intent?.id);
  const intent = paymentIntents.get(intentId);
  if (!intent) publicError(404, "Payment intent not found");
  if (intent.workspaceId !== workspace.id) publicError(403, "Payment intent belongs to another workspace");
  if (intent.status === "completed") {
    return { intent, entitlement: null, duplicate: true };
  }
  if (intent.provider !== "test" && type !== "manual_payment.confirmed") {
    publicError(400, "Only the server test adapter can auto-complete checkout events");
  }

  const snapshot = await storage.loadWorkspaceSnapshot();
  const entitlement = normalizeServerEntitlement({
    id: `entitlement-${crypto.randomUUID()}`,
    itemType: intent.item.itemType,
    itemId: intent.item.itemId,
    source: intent.provider === "manual" ? "manual" : intent.provider === "test" ? "test" : "payment",
    status: "active",
    amountCents: intent.amountCents,
    currency: intent.currency,
    note: `Server-issued entitlement from ${intent.provider} checkout intent`,
    grantedAt: new Date().toISOString(),
    expiresAt: "",
    checkoutIntentId: intent.id,
    provider: intent.provider,
    payoutSnapshot: intent.payout
  });
  const existing = paymentEntitlements(snapshot);
  const nextEntitlements = [entitlement, ...existing.filter((item) => !(item.itemType === entitlement.itemType && item.itemId === entitlement.itemId))].slice(0, 100);
  const nextSnapshot = {
    ...snapshot,
    workspace: {
      ...workspace,
      ...(snapshot.workspace || {}),
      payments: {
        ...((snapshot.workspace || {}).payments || {}),
        entitlements: nextEntitlements
      }
    }
  };
  await storage.saveWorkspaceSnapshot(nextSnapshot, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "payment_entitlement_granted"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "payment_entitlement_granted",
    workspaceId: workspace.id,
    detail: `${session.user.name} granted ${intent.item.name || intent.item.itemId} via ${intent.provider} checkout intent`
  });
  intent.status = "completed";
  intent.completedAt = new Date().toISOString();
  paymentIntents.set(intent.id, intent);
  return { intent, entitlement };
}

function normalizePaymentItem(item = {}) {
  const itemType = cleanString(item.itemType || "project-template");
  if (itemType !== "project-template" && itemType !== "feature") publicError(400, "Unsupported payment item type");
  const itemId = cleanString(item.itemId || item.id);
  if (!itemId) publicError(400, "Payment item id is required");
  const amountCents = Math.max(0, Math.round(Number(item.amountCents ?? item.priceCents ?? 0)));
  if (amountCents <= 0) publicError(400, "Payment item amount must be greater than zero");
  const currency = paymentCurrency(item.currency);
  return {
    itemType,
    itemId,
    name: cleanString(item.name).slice(0, 120),
    amountCents,
    currency,
    payout: normalizePaymentPayout(item.payout || {})
  };
}

function normalizePaymentPayout(payout = {}) {
  const mode = ["creator", "charity", "split"].includes(cleanString(payout.mode)) ? cleanString(payout.mode) : "creator";
  return {
    mode,
    recipientName: cleanString(payout.recipientName).slice(0, 96),
    walletAddress: cleanString(payout.walletAddress).slice(0, 160),
    chain: cleanString(payout.chain || "Not set").slice(0, 40),
    charityName: cleanString(payout.charityName).slice(0, 96),
    donationPercent: boundedInteger(payout.donationPercent, 0, 100),
    note: cleanString(payout.note).slice(0, 180)
  };
}

function normalizeServerEntitlement(entitlement = {}) {
  const itemId = cleanString(entitlement.itemId);
  if (!itemId) return null;
  return {
    id: cleanString(entitlement.id) || `entitlement-${crypto.randomUUID()}`,
    itemType: entitlement.itemType === "feature" ? "feature" : "project-template",
    itemId,
    source: ["test", "manual", "payment", "promo"].includes(entitlement.source) ? entitlement.source : "payment",
    status: ["active", "revoked", "expired"].includes(entitlement.status) ? entitlement.status : "active",
    amountCents: Math.max(0, Math.round(Number(entitlement.amountCents) || 0)),
    currency: paymentCurrency(entitlement.currency),
    note: cleanString(entitlement.note),
    grantedAt: entitlement.grantedAt || new Date().toISOString(),
    expiresAt: cleanString(entitlement.expiresAt),
    checkoutIntentId: cleanString(entitlement.checkoutIntentId),
    provider: cleanString(entitlement.provider),
    payoutSnapshot: normalizePaymentPayout(entitlement.payoutSnapshot || {})
  };
}

function paymentCurrency(currency) {
  const value = cleanString(currency || "USD").toUpperCase();
  return ["USD", "USDC", "CAD", "EUR", "GBP"].includes(value) ? value : "USD";
}

function boundedInteger(value, min, max) {
  const parsed = Math.round(Number(value) || 0);
  return Math.max(min, Math.min(max, parsed));
}

async function runAiOperator(body, session) {
  const config = aiProviderConfig(body.settings || {});
  const context = compactAiContext(body.context || {});
  const mode = body.mode ? String(body.mode) : "workspace_brief";

  if (config.provider === "local") {
    return localAiOperatorResult(mode, context, config, session);
  }

  const prompt = buildAiOperatorPrompt(mode, context, session);
  const content = await callAiProvider(config, prompt);
  return {
    mode,
    provider: providerLabel(config),
    title: aiTitleForMode(mode, context),
    body: content,
    actions: aiActionsForMode(mode, context),
    generatedAt: new Date().toISOString()
  };
}

function aiProviderConfig(settings = {}) {
  const provider = String(settings.provider || process.env.AGORA_AI_PROVIDER || "local").toLowerCase();
  const model = String(settings.model || process.env.AGORA_AI_MODEL || defaultAiModel(provider));
  const configuredBaseUrl = process.env.AGORA_AI_BASE_URL || "";
  const clientBaseUrlAllowed = process.env.AGORA_AI_ALLOW_CLIENT_BASE_URL === "true";
  const clientBaseUrl = clientBaseUrlAllowed ? String(settings.baseUrl || "") : "";
  const baseUrl = (configuredBaseUrl || clientBaseUrl || defaultAiBaseUrl(provider)).replace(/\/+$/, "");
  const apiKey = process.env.AGORA_AI_API_KEY || process.env.OPENAI_API_KEY || "";

  return { provider, model, baseUrl, apiKey };
}

function defaultAiModel(provider) {
  if (provider === "ollama") return "llama3.1";
  if (provider === "openai" || provider === "custom") return "gpt-4o-mini";
  return "Agora deterministic operator";
}

function defaultAiBaseUrl(provider) {
  if (provider === "ollama") return "http://127.0.0.1:11434";
  if (provider === "openai" || provider === "custom") return "https://api.openai.com/v1";
  return "";
}

function providerLabel(config) {
  return `${config.provider}${config.model ? ` / ${config.model}` : ""}`;
}

function compactAiContext(context) {
  return {
    workspace: pickFields(context.workspace, ["name", "slug", "visibility"]),
    project: pickFields(context.project, ["id", "name", "description", "dueDate", "owner", "companyId"]),
    company: pickFields(context.company, ["id", "name", "type", "status"]),
    brief: pickFields(context.brief, ["health", "progress", "summary", "nextAction", "actionType"]),
    tasks: compactItems(context.tasks, ["id", "title", "description", "status", "priority", "dueDate", "assignee", "projectId", "blockedBy"], 12),
    approvals: compactItems(context.approvals, ["id", "title", "summary", "status", "reviewer", "projectId"], 8),
    activities: compactItems(context.activities, ["type", "message", "createdAt", "projectId", "taskId"], 8),
    documents: compactItems(context.documents, ["title", "type", "updatedAt", "projectId"], 8)
  };
}

function pickFields(source, fields) {
  if (!source || typeof source !== "object") return {};
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function compactItems(items, fields, limit) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((item) => pickFields(item, fields));
}

function buildAiOperatorPrompt(mode, context, session) {
  return [
    "You are Agora Operator, an AI project-management copilot for an open-source, self-hostable project management app.",
    "Be concise, practical, and action-oriented. Do not invent private data. Return plain markdown, not JSON.",
    `Current user: ${session.user.name} (${session.membership.role}).`,
    `Mode: ${mode}.`,
    "",
    "Workspace context:",
    JSON.stringify(context, null, 2),
    "",
    "Write a useful operator response with: executive summary, risks, recommended next actions, and a short update draft when relevant."
  ].join("\n");
}

async function callAiProvider(config, prompt) {
  if (config.provider === "ollama") return callOllama(config, prompt);
  return callOpenAiCompatible(config, prompt);
}

async function callOpenAiCompatible(config, prompt) {
  if (!config.apiKey) {
    publicError(400, "AI provider key is missing. Set AGORA_AI_API_KEY or OPENAI_API_KEY on the API server.");
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a concise project-management operator." },
        { role: "user", content: prompt }
      ]
    })
  });

  const body = await parseProviderResponse(response);
  const content = body.choices?.[0]?.message?.content;
  if (!content) publicError(502, "AI provider returned an empty response");
  return String(content).trim();
}

async function callOllama(config, prompt) {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      messages: [
        { role: "system", content: "You are a concise project-management operator." },
        { role: "user", content: prompt }
      ]
    })
  });

  const body = await parseProviderResponse(response);
  const content = body.message?.content || body.response;
  if (!content) publicError(502, "Ollama returned an empty response");
  return String(content).trim();
}

async function parseProviderResponse(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const message = body.error?.message || body.error || `AI provider request failed with ${response.status}`;
    publicError(response.status >= 400 && response.status < 500 ? 400 : 502, String(message));
  }
  return body;
}

function localAiOperatorResult(mode, context, config, session) {
  const projectName = context.project?.name || "the workspace";
  const brief = context.brief || {};
  const tasks = Array.isArray(context.tasks) ? context.tasks : [];
  const approvals = Array.isArray(context.approvals) ? context.approvals : [];
  const blocked = tasks.filter((task) => Array.isArray(task.blockedBy) && task.blockedBy.length);
  const urgent = tasks.filter((task) => task.priority === "urgent" || task.priority === "high");
  const nextTask = blocked[0] || urgent[0] || tasks.find((task) => task.status !== "done") || tasks[0];

  return {
    mode,
    provider: providerLabel(config),
    title: aiTitleForMode(mode, context),
    body: [
      `Generated for ${session.user.name} from Agora's local deterministic operator.`,
      "",
      brief.summary || `${projectName} has ${tasks.length} visible tasks and ${approvals.length} pending approval signals.`,
      nextTask ? `Next best move: ${nextTask.title}.` : "Next best move: review the workspace and pick the highest-impact task.",
      blocked.length ? `Risk: ${blocked.length} blocked task${blocked.length === 1 ? "" : "s"} need owner follow-up.` : "Risk: no blocked tasks are visible in this context.",
      approvals.length ? `Approval follow-up: ${approvals[0].title || "pending approval"} is the first review to chase.` : "Approval follow-up: no pending approvals in this context.",
      "",
      "Suggested update:",
      `${projectName}: ${brief.nextAction || "review the active work, close blockers, and post a concise status update"}.`
    ].join("\n"),
    actions: aiActionsForMode(mode, context),
    generatedAt: new Date().toISOString()
  };
}

function aiTitleForMode(mode, context) {
  if (mode === "project_brief") return `${context.project?.name || "Project"} operator brief`;
  if (mode === "client_update") return `${context.company?.name || "Client"} update draft`;
  if (mode === "daily_plan") return "Daily operator plan";
  return `${context.workspace?.name || "Workspace"} operator brief`;
}

function aiActionsForMode(mode, context) {
  const projectId = context.project?.id || "";
  if (mode === "project_brief") {
    return [
      { label: "Save to Docs", type: "save_doc", projectId },
      { label: "Plan next action", type: "plan_action", projectId }
    ];
  }
  if (mode === "daily_plan") {
    return [{ label: "Generate Today", type: "generate_today" }];
  }
  return [
    { label: "Draft workspace brief", type: "save_doc", projectId },
    { label: "Review risks", type: "review_risks" }
  ];
}

function createSession(user, membership) {
  const token = crypto.randomUUID();
  const session = buildSession(user, membership, token);
  sessions.set(token, session);
  return session;
}

function buildSession(user, membership, token) {
  const now = Date.now();
  return {
    token,
    user: publicUser(user),
    workspace,
    membership,
    permissions: rolePermissions[membership.role] || [],
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
  };
}

async function requireSession(request, response, storage) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const session = sessions.get(token);
  if (session) {
    if (isSessionExpired(session)) {
      sessions.delete(token);
      sendError(response, 401, "Session expired");
      return null;
    }
    return session;
  }

  if (token && supabaseAuthEnabled()) {
    return createSupabaseSessionFromAccessToken(storage, token, { persist: false });
  }

  sendError(response, 401, "Authentication required");
  return null;
}

function isSessionExpired(session) {
  const expiresAt = Date.parse(session?.expiresAt || "");
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function supabaseAuthEnabled() {
  const driver = cleanString(process.env.AGORA_AUTH_DRIVER || "local").toLowerCase();
  return driver === "supabase" || driver === "hybrid";
}

function authDriverLabel() {
  return supabaseAuthEnabled() ? "supabase" : "local";
}

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

function isClientSession(session) {
  return session?.membership?.role === "client";
}

function sessionCompanyId(session) {
  return cleanString(session?.membership?.companyId || session?.user?.companyId);
}

function scopedSnapshot(snapshot = {}, session) {
  const companyId = sessionCompanyId(session);
  if (!companyId && !isClientSession(session)) return snapshot;
  if (!companyId) {
    return {
      ...snapshot,
      companies: [],
      projects: [],
      tasks: [],
      approvals: [],
      documents: [],
      files: [],
      comments: [],
      activities: [],
      presence: [],
      chatMessages: [],
      whiteboards: [],
      timeEntries: [],
      milestones: [],
      intakeForms: [],
      intakeSubmissions: [],
      users: [session.user],
      memberships: [session.membership],
      invitations: []
    };
  }

  const projects = (Array.isArray(snapshot.projects) ? snapshot.projects : []).filter((project) => project.companyId === companyId);
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = (Array.isArray(snapshot.tasks) ? snapshot.tasks : []).filter((task) => projectIds.has(task.projectId));
  const taskIds = new Set(tasks.map((task) => task.id));
  const filterByProject = (items = []) => items.filter((item) => !item.projectId || projectIds.has(item.projectId));
  const filterByTask = (items = []) => items.filter((item) => !item.taskId || taskIds.has(item.taskId));

  return {
    ...snapshot,
    companies: (Array.isArray(snapshot.companies) ? snapshot.companies : []).filter((company) => company.id === companyId),
    projects,
    tasks,
    approvals: filterByProject((Array.isArray(snapshot.approvals) ? snapshot.approvals : []).filter((approval) => !approval.companyId || approval.companyId === companyId)),
    documents: filterByProject(Array.isArray(snapshot.documents) ? snapshot.documents : []),
    files: filterByProject(Array.isArray(snapshot.files) ? snapshot.files : []),
    comments: filterByTask(Array.isArray(snapshot.comments) ? snapshot.comments : []),
    activities: filterByProject(filterByTask(Array.isArray(snapshot.activities) ? snapshot.activities : [])),
    presence: filterByProject(filterByTask(Array.isArray(snapshot.presence) ? snapshot.presence : [])),
    chatMessages: filterByProject(Array.isArray(snapshot.chatMessages) ? snapshot.chatMessages : []),
    whiteboards: filterByProject(Array.isArray(snapshot.whiteboards) ? snapshot.whiteboards : []),
    timeEntries: filterByTask(Array.isArray(snapshot.timeEntries) ? snapshot.timeEntries : []),
    milestones: filterByProject(Array.isArray(snapshot.milestones) ? snapshot.milestones : []),
    intakeForms: filterByProject(Array.isArray(snapshot.intakeForms) ? snapshot.intakeForms : []),
    intakeSubmissions: [],
    users: publicUsers(workspaceUsers(snapshot)).filter((user) => user.id === session.user.id),
    memberships: workspaceMemberships(snapshot).filter((membership) => membership.memberId === session.user.id),
    invitations: []
  };
}

function scopedRecordFilters(session, filters = {}) {
  if (!sessionCompanyId(session)) return filters;
  return {
    ...filters,
    companyId: sessionCompanyId(session) || filters.companyId || ""
  };
}

async function createEmailSession(storage, email) {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await storage.loadWorkspaceSnapshot();
  const user = workspaceUsers(snapshot).find((item) => normalizeEmail(item.email) === normalizedEmail);
  if (!user) publicError(401, "No active account found for that email");

  const membership = workspaceMemberships(snapshot).find((item) => item.memberId === user.id && item.status === "active");
  if (!membership) publicError(401, "No active workspace membership found for that email");

  return createSession(user, membership);
}

async function createPasswordSession(storage, email, password) {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await storage.loadWorkspaceSnapshot();
  const user = workspaceUsers(snapshot).find((item) => normalizeEmail(item.email) === normalizedEmail);
  if (!user || !verifyPassword(password, user)) publicError(401, "Invalid email or password");

  const membership = workspaceMemberships(snapshot).find((item) => item.memberId === user.id && item.status === "active");
  if (!membership) publicError(401, "No active workspace membership found for that email");

  return createSession(user, membership);
}

async function requestPasswordReset(storage, email) {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await storage.loadWorkspaceSnapshot();
  const users = snapshotUsersOnly(snapshot);
  const user = users.find((item) => normalizeEmail(item.email) === normalizedEmail);
  const response = {
    ok: true,
    delivery: envFlag("AGORA_PASSWORD_RESET_RETURN_TOKEN", false) ? "manual-token" : "email-provider-required",
    message: "If that account exists, a password reset token has been prepared."
  };
  if (!user) return response;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
  const delivery = await deliverPasswordReset(user, token, expiresAt);
  const nextUsers = users.map((item) => item.id === user.id ? {
    ...item,
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpiresAt: expiresAt
  } : item);
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: nextUsers,
    memberships: snapshotMembershipsOnly(snapshot),
    invitations: workspaceInvitations(snapshot)
  }, {
    storage: storage.driver || "json-file",
    updatedBy: user.id,
    action: "password_reset_request"
  });
  await storage.appendAuditEvent({
    actorId: user.id,
    action: "password_reset_request",
    workspaceId: workspace.id,
    detail: `${user.name} requested a password reset`
  });

  return {
    ...response,
    delivery: delivery.mode,
    delivered: delivery.delivered,
    expiresAt,
    ...(delivery.exposeToken ? { resetToken: token } : {})
  };
}

async function deliverPasswordReset(user, token, expiresAt) {
  const mode = cleanString(process.env.AGORA_PASSWORD_RESET_DELIVERY || "").toLowerCase();
  const exposeToken = mode === "manual" || envFlag("AGORA_PASSWORD_RESET_RETURN_TOKEN", false);
  if (!mode || mode === "manual") {
    return { mode: mode || "not-configured", delivered: false, exposeToken };
  }

  const payload = passwordResetPayload(user, token, expiresAt);
  if (mode === "smtp") {
    try {
      await sendSmtpMail(payload);
    } catch (error) {
      publicError(502, `SMTP password reset delivery failed: ${error.message}`);
    }
    return { mode, delivered: true, exposeToken };
  }
  if (mode === "webhook") {
    await sendPasswordResetWebhook(payload);
    return { mode, delivered: true, exposeToken };
  }

  publicError(500, `Unsupported password reset delivery mode: ${mode}`);
}

function passwordResetPayload(user, token, expiresAt) {
  const appUrl = cleanString(process.env.AGORA_PUBLIC_APP_URL || process.env.AGORA_APP_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
  const resetUrl = `${appUrl}/#settings?resetToken=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
  return {
    to: user.email,
    name: user.name || user.email,
    from: cleanString(process.env.AGORA_EMAIL_FROM || process.env.SMTP_FROM || "Agora <no-reply@localhost>"),
    subject: "Reset your Agora password",
    text: [
      `Hi ${user.name || user.email},`,
      "",
      "A password reset was requested for your Agora account.",
      "",
      `Reset token: ${token}`,
      `Reset link: ${resetUrl}`,
      `Expires: ${expiresAt}`,
      "",
      "If you did not request this reset, you can ignore this message."
    ].join("\n"),
    token,
    resetUrl,
    expiresAt
  };
}

async function sendPasswordResetWebhook(payload) {
  const webhookUrl = cleanString(process.env.AGORA_PASSWORD_RESET_WEBHOOK_URL);
  if (!webhookUrl) publicError(500, "AGORA_PASSWORD_RESET_WEBHOOK_URL is required for webhook password reset delivery");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.AGORA_PASSWORD_RESET_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.AGORA_PASSWORD_RESET_WEBHOOK_SECRET}` } : {})
    },
    body: JSON.stringify({
      type: "agora.password_reset",
      to: payload.to,
      name: payload.name,
      subject: payload.subject,
      text: payload.text,
      token: payload.token,
      resetUrl: payload.resetUrl,
      expiresAt: payload.expiresAt
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    publicError(502, body || "Password reset webhook delivery failed");
  }
}

async function sendSmtpMail(payload) {
  const host = cleanString(process.env.AGORA_SMTP_HOST || process.env.SMTP_HOST);
  const port = positiveNumber(process.env.AGORA_SMTP_PORT || process.env.SMTP_PORT, envFlag("AGORA_SMTP_SECURE", false) ? 465 : 587);
  const user = cleanString(process.env.AGORA_SMTP_USER || process.env.SMTP_USER);
  const password = cleanString(process.env.AGORA_SMTP_PASSWORD || process.env.SMTP_PASSWORD);
  const secure = envFlag("AGORA_SMTP_SECURE", port === 465);
  const startTls = envFlag("AGORA_SMTP_STARTTLS", !secure);
  if (!host) publicError(500, "AGORA_SMTP_HOST is required for SMTP password reset delivery");

  let client = await openSmtpConnection({ host, port, secure });
  const session = smtpSession(client);
  await session.expect([220]);
  await session.command(`EHLO ${smtpLocalName()}`, [250]);
  if (!secure && startTls) {
    await session.command("STARTTLS", [220]);
    client = tls.connect({ socket: client, servername: host });
    await new Promise((resolve, reject) => {
      client.once("secureConnect", resolve);
      client.once("error", reject);
    });
    session.replaceSocket(client);
    await session.command(`EHLO ${smtpLocalName()}`, [250]);
  }
  if (user || password) {
    await session.command("AUTH LOGIN", [334]);
    await session.command(Buffer.from(user).toString("base64"), [334]);
    await session.command(Buffer.from(password).toString("base64"), [235]);
  }

  await session.command(`MAIL FROM:<${emailAddress(payload.from)}>`, [250]);
  await session.command(`RCPT TO:<${emailAddress(payload.to)}>`, [250, 251]);
  await session.command("DATA", [354]);
  await session.command(smtpMessage(payload), [250], "\r\n.\r\n");
  await session.command("QUIT", [221]).catch(() => {});
}

function openSmtpConnection({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const client = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    client.once(secure ? "secureConnect" : "connect", () => resolve(client));
    client.once("error", reject);
    client.setTimeout(15000, () => {
      client.destroy();
      reject(new Error("SMTP connection timed out"));
    });
  });
}

function smtpSession(socket) {
  let client = socket;
  let buffer = "";
  const pending = [];
  const onData = (chunk) => {
    buffer += chunk.toString("utf8");
    drain();
  };
  const drain = () => {
    if (!pending.length) return;
    const lineEnd = buffer.search(/\r?\n/);
    if (lineEnd === -1) return;
    const lines = buffer.split(/\r?\n/);
    const completeIndex = lines.findIndex((line) => /^\d{3} /.test(line));
    if (completeIndex === -1) return;
    const responseLines = lines.slice(0, completeIndex + 1).join("\n");
    buffer = lines.slice(completeIndex + 1).join("\n");
    const { codes, resolve, reject } = pending.shift();
    const code = Number(responseLines.slice(0, 3));
    if (codes.includes(code)) {
      resolve(responseLines);
    } else {
      reject(new Error(`SMTP command failed: ${responseLines}`));
    }
    drain();
  };
  client.on("data", onData);
  return {
    replaceSocket(nextSocket) {
      client.off("data", onData);
      client = nextSocket;
      client.on("data", onData);
    },
    expect(codes) {
      return new Promise((resolve, reject) => {
        pending.push({ codes, resolve, reject });
        drain();
      });
    },
    async command(command, codes, terminator = "\r\n") {
      client.write(`${command}${terminator}`);
      return this.expect(codes);
    }
  };
}

function smtpMessage(payload) {
  return [
    `From: ${payload.from}`,
    `To: ${payload.to}`,
    `Subject: ${payload.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    payload.text.replace(/^\./gm, "..")
  ].join("\r\n");
}

function emailAddress(value) {
  const match = cleanString(value).match(/<([^>]+)>/);
  return match ? match[1] : cleanString(value);
}

function smtpLocalName() {
  return cleanString(process.env.AGORA_SMTP_LOCAL_NAME) || "agora.local";
}

async function confirmPasswordReset(storage, body) {
  const email = normalizeEmail(body.email);
  const token = cleanString(body.token);
  if (!token) publicError(400, "Password reset token is required");
  const passwordFields = createPasswordFields(body.password);
  const snapshot = await storage.loadWorkspaceSnapshot();
  const users = snapshotUsersOnly(snapshot);
  const user = users.find((item) => normalizeEmail(item.email) === email);
  const tokenHash = hashResetToken(token);
  const expiresAt = Date.parse(user?.passwordResetExpiresAt || "");
  if (!user || user.passwordResetTokenHash !== tokenHash || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    publicError(401, "Password reset token is invalid or expired");
  }

  const nextUsers = users.map((item) => item.id === user.id ? {
    ...item,
    ...passwordFields,
    passwordResetTokenHash: "",
    passwordResetExpiresAt: ""
  } : item);
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: nextUsers,
    memberships: snapshotMembershipsOnly(snapshot),
    invitations: workspaceInvitations(snapshot)
  }, {
    storage: storage.driver || "json-file",
    updatedBy: user.id,
    action: "password_reset_confirm"
  });
  await storage.appendAuditEvent({
    actorId: user.id,
    action: "password_reset_confirm",
    workspaceId: workspace.id,
    detail: `${user.name} reset their password`
  });
  return { ok: true };
}

async function changePassword(storage, session, body) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const users = snapshotUsersOnly(snapshot);
  const user = users.find((item) => item.id === session.user.id);
  if (!user) publicError(404, "Password account not found");
  if (!verifyPassword(body.currentPassword, user)) publicError(401, "Current password is incorrect");

  const passwordFields = createPasswordFields(body.newPassword);
  const nextUsers = users.map((item) => item.id === user.id ? {
    ...item,
    ...passwordFields,
    passwordResetTokenHash: "",
    passwordResetExpiresAt: ""
  } : item);
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: nextUsers,
    memberships: snapshotMembershipsOnly(snapshot),
    invitations: workspaceInvitations(snapshot)
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "password_change"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "password_change",
    workspaceId: workspace.id,
    detail: `${session.user.name} changed their password`
  });
  return { ok: true };
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(cleanString(token)).digest("hex");
}

async function createSupabaseSessionFromAccessToken(storage, accessToken, options = {}) {
  const token = cleanString(accessToken);
  if (!token) publicError(401, "Supabase access token is required");

  const supabaseUser = await fetchSupabaseUser(token);
  const { user, membership } = await syncSupabaseAuthUser(storage, supabaseUser);
  return options.persist === false
    ? buildSession(user, membership, token)
    : createSession(user, membership);
}

async function createSupabasePasswordAccount(storage, body) {
  if (!supabaseAuthEnabled()) publicError(404, "Supabase Auth is disabled");
  const email = normalizeEmail(body.email);
  const password = cleanString(body.password);
  const name = cleanString(body.name) || email.split("@")[0];
  if (!email || !password) publicError(400, "Supabase sign up requires email and password");

  const authResult = await supabaseAuthRequest("/auth/v1/signup", {
    email,
    password,
    data: {
      full_name: name,
      name
    }
  });
  const accessToken = cleanString(authResult.access_token);
  if (!accessToken) {
    return {
      pendingConfirmation: true,
      email,
      message: "Supabase created the account. Confirm the email address, then sign in."
    };
  }
  return createSupabaseSessionFromAccessToken(storage, accessToken);
}

async function createSupabasePasswordSession(storage, body) {
  if (!supabaseAuthEnabled()) publicError(404, "Supabase Auth is disabled");
  const email = normalizeEmail(body.email);
  const password = cleanString(body.password);
  if (!email || !password) publicError(400, "Supabase sign in requires email and password");

  const authResult = await supabaseAuthRequest("/auth/v1/token?grant_type=password", {
    email,
    password
  });
  const accessToken = cleanString(authResult.access_token);
  if (!accessToken) publicError(401, "Supabase did not return an access token");
  return createSupabaseSessionFromAccessToken(storage, accessToken);
}

async function supabaseAuthRequest(pathname, body) {
  const { supabaseUrl, anonKey } = supabaseAuthConfig();
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    publicError(response.status === 400 ? 401 : response.status, result.msg || result.message || result.error_description || "Supabase Auth request failed");
  }
  return result;
}

function supabaseAuthConfig() {
  const supabaseUrl = cleanString(process.env.SUPABASE_URL || process.env.AGORA_SUPABASE_URL).replace(/\/+$/, "");
  const anonKey = cleanString(process.env.SUPABASE_ANON_KEY || process.env.AGORA_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !anonKey) {
    publicError(500, "Supabase auth requires SUPABASE_URL and SUPABASE_ANON_KEY on the API server");
  }
  return { supabaseUrl, anonKey };
}

async function fetchSupabaseUser(accessToken) {
  const { supabaseUrl, anonKey } = supabaseAuthConfig();

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    publicError(401, body.msg || body.message || "Supabase access token is invalid");
  }
  if (!body.id || !body.email) {
    publicError(401, "Supabase user response did not include id and email");
  }
  return body;
}

async function syncSupabaseAuthUser(storage, supabaseUser) {
  const email = normalizeEmail(supabaseUser.email);
  const now = new Date().toISOString();
  const snapshot = await storage.loadWorkspaceSnapshot();
  const storedUsers = snapshotUsersOnly(snapshot);
  const memberships = snapshotMembershipsOnly(snapshot);
  const invitations = workspaceInvitations(snapshot);
  const existingUser = workspaceUsers(snapshot).find((item) => item.id === supabaseUser.id || normalizeEmail(item.email) === email);
  const pendingInvitation = invitations.find((item) => normalizeEmail(item.email) === email && item.status === "pending");
  const existingMembership = memberships.find((item) => item.memberId === supabaseUser.id || (existingUser && item.memberId === existingUser.id));
  const canBootstrapOwner = storedUsers.length === 0 && memberships.length === 0;

  if (!existingMembership && !pendingInvitation && !canBootstrapOwner) {
    publicError(403, "No active Agora membership exists for this Supabase user");
  }

  const metadata = supabaseUser.user_metadata || {};
  const user = {
    ...(existingUser || {}),
    id: supabaseUser.id,
    name: cleanString(metadata.full_name || metadata.name || existingUser?.name) || email.split("@")[0],
    email,
    role: "Supabase Auth",
    companyId: pendingInvitation?.companyId || existingUser?.companyId || existingMembership?.companyId || "",
    createdAt: existingUser?.createdAt || supabaseUser.created_at || now,
    authProvider: "supabase"
  };
  const membership = {
    memberId: user.id,
    role: existingMembership?.role || pendingInvitation?.role || "admin",
    status: "active",
    companyId: pendingInvitation?.companyId || existingMembership?.companyId || "",
    invitedBy: pendingInvitation?.invitedBy || existingMembership?.invitedBy || "",
    joinedAt: existingMembership?.joinedAt || now,
    authProvider: "supabase"
  };
  const nextInvitations = pendingInvitation
    ? invitations.map((item) => item.id === pendingInvitation.id ? {
      ...item,
      status: "accepted",
      acceptedAt: now,
      acceptedBy: user.id
    } : item)
    : invitations;
  const nextUsers = [user, ...storedUsers.filter((item) => item.id !== user.id && normalizeEmail(item.email) !== email)];
  const nextMemberships = [membership, ...memberships.filter((item) => item.memberId !== user.id && item.memberId !== existingUser?.id)];

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: nextUsers,
    memberships: nextMemberships,
    invitations: nextInvitations
  }, {
    storage: storage.driver || "json-file",
    updatedBy: user.id,
    action: pendingInvitation ? "supabase_member_accept_invite" : canBootstrapOwner ? "supabase_owner_bootstrap" : "supabase_auth_login"
  });
  if (typeof storage.upsertAuthMembership === "function") {
    await storage.upsertAuthMembership({
      workspaceId: storage.workspaceId || workspace.id,
      userId: user.id,
      role: membership.role,
      status: membership.status,
      companyId: membership.companyId,
      invitedBy: membership.invitedBy,
      joinedAt: membership.joinedAt
    });
  }
  await storage.appendAuditEvent({
    actorId: user.id,
    action: pendingInvitation ? "supabase_member_accept_invite" : canBootstrapOwner ? "supabase_owner_bootstrap" : "supabase_auth_login",
    workspaceId: workspace.id,
    detail: `${user.name} signed in with Supabase Auth`
  });

  return { user, membership };
}

async function createOwnerAccount(storage, body) {
  const email = normalizeEmail(body.email);
  const name = cleanString(body.name) || email.split("@")[0];
  const passwordFields = createPasswordFields(body.password);
  const snapshot = await storage.loadWorkspaceSnapshot();
  const storedUsers = snapshotUsersOnly(snapshot);
  const existingUser = workspaceUsers(snapshot).find((item) => normalizeEmail(item.email) === email);
  if (existingUser) publicError(409, "An account already exists for that email");

  const pendingInvitation = workspaceInvitations(snapshot).find((item) => normalizeEmail(item.email) === email && item.status === "pending");
  if (storedUsers.length > 0 && !pendingInvitation) {
    publicError(403, "Workspace already has an owner. Ask an admin for an invitation.");
  }

  const now = new Date().toISOString();
  const user = {
    id: createUserId(email),
    name,
    email,
    role: "Workspace owner",
    companyId: pendingInvitation?.companyId || "",
    createdAt: now,
    ...passwordFields
  };
  const membership = {
    memberId: user.id,
    role: pendingInvitation?.role || "admin",
    status: "active",
    companyId: pendingInvitation?.companyId || "",
    invitedBy: pendingInvitation?.invitedBy || "",
    joinedAt: now
  };
  const nextInvitations = pendingInvitation
    ? workspaceInvitations(snapshot).map((item) => item.id === pendingInvitation.id ? {
      ...item,
      status: "accepted",
      acceptedAt: now,
      acceptedBy: user.id
    } : item)
    : workspaceInvitations(snapshot);
  const nextWorkspace = {
    ...workspace,
    ...(snapshot.workspace || {}),
    name: cleanString(body.workspaceName) || snapshot.workspace?.name || workspace.name,
    slug: cleanString(body.workspaceSlug) || snapshot.workspace?.slug || workspace.slug
  };

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    workspace: nextWorkspace,
    users: [user, ...storedUsers],
    memberships: [membership, ...snapshotMembershipsOnly(snapshot).filter((item) => item.memberId !== user.id)],
    invitations: nextInvitations
  }, {
    storage: storage.driver || "json-file",
    updatedBy: user.id,
    action: pendingInvitation ? "member_accept_invite" : "account_signup"
  });
  await storage.appendAuditEvent({
    actorId: user.id,
    action: pendingInvitation ? "member_accept_invite" : "account_signup",
    workspaceId: workspace.id,
    detail: `${user.name} created a password account`
  });

  return createSession(user, membership);
}

async function createInvitation(storage, body, session) {
  const invitation = normalizeInvitationInput(body, session);
  const snapshot = await storage.loadWorkspaceSnapshot();
  const users = workspaceUsers(snapshot);
  const memberships = workspaceMemberships(snapshot);
  const invitations = workspaceInvitations(snapshot);
  const email = normalizeEmail(invitation.email);
  const existingUser = users.find((user) => normalizeEmail(user.email) === email);
  const existingMembership = existingUser
    ? memberships.find((membership) => membership.memberId === existingUser.id && membership.status === "active")
    : null;
  if (existingMembership) publicError(409, "That email already has workspace access");

  const pending = invitations.find((item) => normalizeEmail(item.email) === email && item.status === "pending");
  const nextInvitation = pending ? {
    ...pending,
    name: invitation.name || pending.name,
    role: invitation.role,
    companyId: invitation.companyId,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
    invitedBy: session.user.id,
    updatedAt: new Date().toISOString()
  } : invitation;
  const nextInvitations = pending
    ? invitations.map((item) => item.id === pending.id ? nextInvitation : item)
    : [nextInvitation, ...invitations];

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: snapshotUsersOnly(snapshot),
    memberships: snapshotMembershipsOnly(snapshot),
    invitations: nextInvitations
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "member_invite"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "member_invite",
    workspaceId: workspace.id,
    detail: `${session.user.name} invited ${nextInvitation.email}`
  });
  return publicInvitation(nextInvitation);
}

async function resendInvitation(storage, invitationId, session) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const invitations = workspaceInvitations(snapshot);
  const invitation = invitations.find((item) => item.id === invitationId);
  if (!invitation) publicError(404, "Invitation not found");
  if (invitation.status === "accepted") publicError(409, "Accepted invitations cannot be resent");

  const nextInvitation = {
    ...invitation,
    status: "pending",
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
    invitedBy: session.user.id,
    updatedAt: new Date().toISOString()
  };
  const nextInvitations = invitations.map((item) => item.id === invitation.id ? nextInvitation : item);
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: snapshotUsersOnly(snapshot),
    memberships: snapshotMembershipsOnly(snapshot),
    invitations: nextInvitations
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "member_invite_resend"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "member_invite_resend",
    workspaceId: workspace.id,
    detail: `${session.user.name} resent an invitation to ${nextInvitation.email}`
  });
  return publicInvitation(nextInvitation);
}

async function revokeInvitation(storage, invitationId, session) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const invitations = workspaceInvitations(snapshot);
  const invitation = invitations.find((item) => item.id === invitationId);
  if (!invitation) publicError(404, "Invitation not found");
  if (invitation.status === "accepted") publicError(409, "Accepted invitations cannot be revoked");

  const nextInvitation = {
    ...invitation,
    status: "revoked",
    token: "",
    updatedAt: new Date().toISOString()
  };
  const nextInvitations = invitations.map((item) => item.id === invitation.id ? nextInvitation : item);
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: snapshotUsersOnly(snapshot),
    memberships: snapshotMembershipsOnly(snapshot),
    invitations: nextInvitations
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "member_invite_revoke"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "member_invite_revoke",
    workspaceId: workspace.id,
    detail: `${session.user.name} revoked an invitation to ${nextInvitation.email}`
  });
  return publicInvitation(nextInvitation);
}

async function getInvitation(storage, token) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const invitation = workspaceInvitations(snapshot).find((item) => item.token === token);
  if (!invitation) publicError(404, "Invitation not found");
  if (invitation.status !== "pending") publicError(410, "Invitation is no longer active");
  if (isInvitationExpired(invitation)) publicError(410, "Invitation has expired");
  return publicInvitation(invitation);
}

async function acceptInvitation(storage, token, name, password) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const invitations = workspaceInvitations(snapshot);
  const invitation = invitations.find((item) => item.token === token && item.status === "pending");
  if (!invitation) publicError(404, "Invitation not found or already used");
  if (isInvitationExpired(invitation)) publicError(410, "Invitation has expired");

  const now = new Date().toISOString();
  const users = snapshotUsersOnly(snapshot);
  const memberships = snapshotMembershipsOnly(snapshot);
  const existingUser = workspaceUsers(snapshot).find((user) => normalizeEmail(user.email) === normalizeEmail(invitation.email));
  const user = existingUser || {
    id: createUserId(invitation.email),
    name: cleanString(name) || invitation.name || invitation.email.split("@")[0],
    email: invitation.email,
    role: "Team",
    companyId: invitation.companyId,
    createdAt: now
  };
  const passwordFields = password ? createPasswordFields(password) : {};
  const nextUsers = existingUser
    ? users.map((item) => item.id === existingUser.id ? { ...item, name: cleanString(name) || item.name, companyId: invitation.companyId || item.companyId || "", ...passwordFields } : item)
    : [{ ...user, ...passwordFields }, ...users];
  const nextMembership = {
    memberId: user.id,
    role: invitation.role,
    status: "active",
    companyId: invitation.companyId,
    invitedBy: invitation.invitedBy,
    joinedAt: now
  };
  const nextMemberships = memberships.some((membership) => membership.memberId === user.id)
    ? memberships.map((membership) => membership.memberId === user.id ? { ...membership, ...nextMembership } : membership)
    : [nextMembership, ...memberships];
  const nextInvitations = invitations.map((item) => item.id === invitation.id ? {
    ...item,
    status: "accepted",
    acceptedAt: now,
    acceptedBy: user.id
  } : item);

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    users: nextUsers,
    memberships: nextMemberships,
    invitations: nextInvitations
  }, {
    storage: storage.driver || "json-file",
    updatedBy: user.id,
    action: "member_accept_invite"
  });
  await storage.appendAuditEvent({
    actorId: user.id,
    action: "member_accept_invite",
    workspaceId: workspace.id,
    detail: `${user.name} accepted an invitation`
  });

  return createSession({ ...user, ...passwordFields }, nextMembership);
}

function workspaceUsers(snapshot = {}) {
  const users = new Map();
  demoUsers.forEach((user) => users.set(user.id, user));
  snapshotUsersOnly(snapshot).forEach((user) => users.set(user.id, user));
  return Array.from(users.values());
}

function publicUser(user = {}) {
  return {
    id: cleanString(user.id),
    name: cleanString(user.name),
    email: normalizeEmail(user.email),
    role: cleanString(user.role) || "Team",
    companyId: cleanString(user.companyId),
    createdAt: cleanString(user.createdAt),
    authProvider: cleanString(user.authProvider),
    hasPassword: Boolean(user.passwordHash && user.passwordSalt)
  };
}

function publicUsers(users) {
  return users.map(publicUser);
}

function workspaceMemberships(snapshot = {}) {
  const memberships = new Map();
  demoMemberships.forEach((membership) => memberships.set(membership.memberId, membership));
  snapshotMembershipsOnly(snapshot).forEach((membership) => memberships.set(membership.memberId, membership));
  return Array.from(memberships.values());
}

function workspaceInvitations(snapshot = {}) {
  return Array.isArray(snapshot.invitations) ? snapshot.invitations.map(normalizeStoredInvitation) : [];
}

function isInvitationExpired(invitation) {
  const expiresAt = Date.parse(invitation?.expiresAt || "");
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function snapshotUsersOnly(snapshot = {}) {
  return Array.isArray(snapshot.users) ? snapshot.users.map(normalizeStoredUser).filter(Boolean) : [];
}

function snapshotMembershipsOnly(snapshot = {}) {
  return Array.isArray(snapshot.memberships) ? snapshot.memberships.map(normalizeStoredMembership).filter(Boolean) : [];
}

function mergeSnapshotAccess(existingSnapshot = {}, incomingSnapshot = {}) {
  const users = mergeById(snapshotUsersOnly(existingSnapshot), snapshotUsersOnly(incomingSnapshot), "id");
  const memberships = mergeById(snapshotMembershipsOnly(existingSnapshot), snapshotMembershipsOnly(incomingSnapshot), "memberId");
  const invitations = mergeById(workspaceInvitations(existingSnapshot), workspaceInvitations(incomingSnapshot), "id");

  return {
    ...incomingSnapshot,
    users,
    memberships,
    invitations
  };
}

function mergeById(existingItems, incomingItems, key) {
  const next = new Map();
  existingItems.forEach((item) => next.set(item[key], item));
  incomingItems.forEach((item) => next.set(item[key], { ...(next.get(item[key]) || {}), ...item }));
  return Array.from(next.values());
}

function normalizeInvitationInput(body, session) {
  const email = normalizeEmail(body.email);
  const role = cleanString(body.role || "member");
  if (!rolePermissions[role]) publicError(400, "Invitation role is invalid");

  const now = new Date().toISOString();
  return {
    id: `invite-${crypto.randomUUID()}`,
    token: crypto.randomUUID(),
    email,
    name: cleanString(body.name),
    role,
    companyId: cleanString(body.companyId),
    status: "pending",
    invitedBy: session.user.id,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString()
  };
}

function normalizeStoredInvitation(invitation) {
  return {
    id: cleanString(invitation.id) || `invite-${crypto.randomUUID()}`,
    token: cleanString(invitation.token) || crypto.randomUUID(),
    email: normalizeEmail(invitation.email),
    name: cleanString(invitation.name),
    role: rolePermissions[invitation.role] ? invitation.role : "member",
    companyId: cleanString(invitation.companyId),
    status: cleanString(invitation.status) || "pending",
    invitedBy: cleanString(invitation.invitedBy),
    acceptedBy: cleanString(invitation.acceptedBy),
    createdAt: cleanString(invitation.createdAt) || new Date().toISOString(),
    updatedAt: cleanString(invitation.updatedAt),
    acceptedAt: cleanString(invitation.acceptedAt),
    expiresAt: cleanString(invitation.expiresAt)
  };
}

function normalizeStoredUser(user) {
  if (!user?.id || !user?.email) return null;
  return {
    id: cleanString(user.id),
    name: cleanString(user.name) || cleanString(user.email),
    email: normalizeEmail(user.email),
    role: cleanString(user.role) || "Team",
    companyId: cleanString(user.companyId),
    createdAt: cleanString(user.createdAt),
    passwordHash: cleanString(user.passwordHash),
    passwordSalt: cleanString(user.passwordSalt),
    passwordKeyLength: Number(user.passwordKeyLength || 0),
    passwordCost: Number(user.passwordCost || 0),
    passwordResetTokenHash: cleanString(user.passwordResetTokenHash),
    passwordResetExpiresAt: cleanString(user.passwordResetExpiresAt),
    authProvider: cleanString(user.authProvider)
  };
}

function normalizeStoredMembership(membership) {
  if (!membership?.memberId) return null;
  return {
    memberId: cleanString(membership.memberId),
    role: rolePermissions[membership.role] ? membership.role : "member",
    status: cleanString(membership.status) || "active",
    companyId: cleanString(membership.companyId),
    invitedBy: cleanString(membership.invitedBy),
    joinedAt: cleanString(membership.joinedAt),
    authProvider: cleanString(membership.authProvider)
  };
}

function publicInvitation(invitation) {
  return {
    ...invitation,
    acceptUrl: `#invite/${invitation.token}`
  };
}

function normalizeEmail(email) {
  const value = cleanString(email).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) publicError(400, "A valid email is required");
  return value;
}

function cleanString(value) {
  return value == null ? "" : String(value).trim();
}

function createUserId(email) {
  const base = normalizeEmail(email).split("@")[0].replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "user";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function createPasswordFields(password) {
  const value = cleanString(password);
  if (value.length < 8) publicError(400, "Password must be at least 8 characters");

  const salt = crypto.randomBytes(16).toString("hex");
  return {
    passwordHash: hashPassword(value, salt),
    passwordSalt: salt,
    passwordKeyLength: PASSWORD_KEY_LENGTH,
    passwordCost: PASSWORD_SCRYPT_COST
  };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH, { N: PASSWORD_SCRYPT_COST }).toString("hex");
}

function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(hashPassword(cleanString(password), user.passwordSalt), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function saveWorkspaceSnapshot(storage, snapshot, session, action) {
  validateSnapshot(snapshot);
  if (sessionCompanyId(session)) {
    publicError(403, "Company-scoped sessions must use structured project, task, and record endpoints");
  }
  const existingSnapshot = await storage.loadWorkspaceSnapshot();
  const mergedSnapshot = mergeSnapshotAccess(existingSnapshot, snapshot);
  const document = await storage.saveWorkspace(mergedSnapshot, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} saved a workspace snapshot`
  });
  return document;
}

async function upsertProject(storage, project, session, action) {
  const incomingProject = requireRecord(project, "Project");
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const existingProject = projects.find((item) => item.id === incomingProject.id);
  const nextProject = normalizeProject(existingProject ? { ...existingProject, ...incomingProject } : incomingProject);
  assertProjectCompanyScope(nextProject, session);
  const exists = Boolean(existingProject);
  const nextProjects = exists
    ? projects.map((item) => item.id === nextProject.id ? { ...item, ...nextProject } : item)
    : [nextProject, ...projects];

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    projects: nextProjects
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} ${exists ? "updated" : "created"} project ${nextProject.name}`
  });
  return nextProjects.find((item) => item.id === nextProject.id);
}

async function upsertTask(storage, task, session, action) {
  const incomingTask = requireRecord(task, "Task");
  const snapshot = await storage.loadWorkspaceSnapshot();
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const existingTask = tasks.find((item) => item.id === incomingTask.id);
  const nextTask = normalizeTask(existingTask ? { ...existingTask, ...incomingTask } : incomingTask);
  const project = projects.find((item) => item.id === nextTask.projectId);
  if (!project) publicError(400, "Task project is not in this workspace");
  assertProjectCompanyScope(project, session);
  const exists = Boolean(existingTask);
  const nextTasks = exists
    ? tasks.map((item) => item.id === nextTask.id ? { ...item, ...nextTask } : item)
    : [nextTask, ...tasks];

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    tasks: nextTasks
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} ${exists ? "updated" : "created"} task ${nextTask.title}`
  });
  return nextTasks.find((item) => item.id === nextTask.id);
}

async function archiveProject(storage, projectId, session, archived) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const project = projects.find((item) => item.id === projectId);
  if (!project) publicError(404, "Project not found");
  assertProjectCompanyScope(project, session);

  const timestamp = new Date().toISOString();
  const nextProject = normalizeProject({
    ...project,
    archivedAt: archived ? timestamp : "",
    archivedBy: archived ? session.user.id : "",
    restoredAt: archived ? project.restoredAt || "" : timestamp
  });
  const nextProjects = projects.map((item) => item.id === projectId ? nextProject : item);
  const nextTasks = archived
    ? (Array.isArray(snapshot.tasks) ? snapshot.tasks : []).map((task) => task.projectId === projectId ? normalizeTask({
      ...task,
      archivedAt: task.archivedAt || timestamp,
      archivedBy: task.archivedBy || session.user.id
    }) : task)
    : snapshot.tasks;

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    projects: nextProjects,
    tasks: nextTasks
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: archived ? "project_archive" : "project_restore"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: archived ? "project_archive" : "project_restore",
    workspaceId: workspace.id,
    detail: `${session.user.name} ${archived ? "archived" : "restored"} project ${nextProject.name}`
  });
  return nextProject;
}

async function archiveTask(storage, taskId, session, archived) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const task = tasks.find((item) => item.id === taskId);
  if (!task) publicError(404, "Task not found");
  const project = projects.find((item) => item.id === task.projectId);
  if (!project) publicError(400, "Task project is not in this workspace");
  assertProjectCompanyScope(project, session);

  const timestamp = new Date().toISOString();
  const nextTask = normalizeTask({
    ...task,
    archivedAt: archived ? timestamp : "",
    archivedBy: archived ? session.user.id : "",
    restoredAt: archived ? task.restoredAt || "" : timestamp
  });
  const nextTasks = tasks.map((item) => item.id === taskId ? nextTask : item);

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    tasks: nextTasks
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: archived ? "task_archive" : "task_restore"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: archived ? "task_archive" : "task_restore",
    workspaceId: workspace.id,
    detail: `${session.user.name} ${archived ? "archived" : "restored"} task ${nextTask.title}`
  });
  return nextTask;
}

function assertProjectCompanyScope(project, session) {
  const companyId = sessionCompanyId(session);
  if (!companyId) return;
  if (project.companyId !== companyId) {
    publicError(403, "Project is outside the company scope");
  }
}

async function upsertCollectionItem(storage, key, item, normalizer, session, action, detailLabel) {
  const incomingItem = prepareRecordForSession(key, item, session);
  const snapshot = await storage.loadWorkspaceSnapshot();
  const existingItems = await storage.loadRecords(key, scopedRecordFilters(session, {}));
  const existingItem = existingItems.find((entry) => entry.id === incomingItem.id);
  const normalizedItem = enrichRecordScopeFields(normalizer(existingItem ? { ...existingItem, ...incomingItem } : incomingItem), snapshot);
  const nextItem = applySessionRecordPolicy(key, normalizedItem, existingItem, session);
  assertCanWriteScopedRecord(key, nextItem, snapshot, session);
  const savedItem = await storage.upsertRecord(key, nextItem, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} saved ${detailLabel(savedItem)}`
  });
  return savedItem;
}

function prepareRecordForSession(key, item, session) {
  const record = requireRecord(item, "Item");
  if (key === "comments") return { ...record, author: session.user.id };
  if (key === "chatMessages") return { ...record, author: session.user.id };
  if (key === "activities") return { ...record, memberId: session.user.id };
  if (key === "documents" || key === "files") return { ...record, owner: session.user.id };
  if (key === "presence" && !hasPermission(session, "members:write")) return { ...record, memberId: session.user.id };
  if (key === "timeEntries" && !record.memberId) return { ...record, memberId: session.user.id };
  if (key === "notificationReminders" || key === "notificationHistory" || key === "inboxState") {
    return { ...record, memberId: session.user.id };
  }
  return record;
}

function applySessionRecordPolicy(key, record, existingItem, session) {
  if (key === "timeEntries" && record.memberId !== session.user.id && !hasPermission(session, "members:write")) {
    publicError(403, "Time entries can only be logged for the current user");
  }

  if (key === "approvals" && isClientSession(session)) {
    if (!existingItem) publicError(403, "Clients can only respond to existing approvals");
    return {
      ...existingItem,
      status: record.status || existingItem.status,
      updatedAt: record.updatedAt || new Date().toISOString()
    };
  }

  if ((key === "notificationReminders" || key === "notificationHistory" || key === "inboxState") && record.memberId !== session.user.id && !hasPermission(session, "members:write")) {
    publicError(403, "Notification records can only be updated for the current user");
  }

  return record;
}

function enrichRecordScopeFields(record, snapshot = {}) {
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const task = record.taskId ? tasks.find((item) => item.id === record.taskId) : null;
  const projectId = record.projectId || task?.projectId || "";
  const project = projectId ? projects.find((item) => item.id === projectId) : null;
  return {
    ...record,
    projectId: projectId || record.projectId || "",
    companyId: project?.companyId || record.companyId || ""
  };
}

function assertCanWriteScopedRecord(key, record, snapshot = {}, session) {
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const task = record.taskId ? tasks.find((item) => item.id === record.taskId) : null;
  const projectId = record.projectId || task?.projectId || "";
  const project = projectId ? projects.find((item) => item.id === projectId) : null;

  if (record.taskId && !task) publicError(400, "Record task is not in this workspace");
  if (record.taskId && record.projectId && task.projectId !== record.projectId) {
    publicError(400, "Record project does not match task");
  }
  if (projectId && !project) publicError(400, "Record project is not in this workspace");
  if (project?.companyId && record.companyId && record.companyId !== project.companyId) {
    publicError(400, "Record company does not match project");
  }
  if (key === "presence" && record.memberId !== session.user.id && !hasPermission(session, "members:write")) {
    publicError(403, "Presence can only be updated for the current user");
  }
  if ((key === "notificationReminders" || key === "notificationHistory" || key === "inboxState") && record.memberId !== session.user.id && !hasPermission(session, "members:write")) {
    publicError(403, "Notification records can only be updated for the current user");
  }

  const companyId = sessionCompanyId(session);
  if (!companyId) return;
  if (record.companyId && record.companyId !== companyId) {
    publicError(403, "Record is outside the company scope");
  }
  if (project && project.companyId !== companyId) {
    publicError(403, "Project is outside the company scope");
  }
}

async function uploadFileRecord(storage, body, session) {
  const fileInput = requireRecord(body.file || body, "File upload");
  const snapshot = await storage.loadWorkspaceSnapshot();
  const id = cleanString(fileInput.id) || `file-${crypto.randomUUID()}`;
  const title = cleanString(fileInput.title || fileInput.fileName || fileInput.name);
  const projectId = cleanString(fileInput.projectId);
  if (!title || !projectId) publicError(400, "File upload requires title and projectId");

  const content = decodeUploadContent(fileInput);
  const normalizedTitle = sanitizeFileName(title);
  const metadata = await persistFileObject(storage, {
    id,
    fileName: normalizedTitle,
    contentType: content.contentType,
    buffer: content.buffer
  });
  const file = await upsertCollectionItem(storage, "files", {
    id,
    projectId,
    taskId: cleanString(fileInput.taskId),
    title: title || normalizedTitle,
    kind: cleanString(fileInput.kind) || fileKindFromName(normalizedTitle),
    size: formatBytes(content.buffer.length),
    owner: session.user.id,
    updatedAt: new Date().toISOString(),
    url: `/api/files/${encodeURIComponent(id)}/download`,
    contentType: content.contentType,
    storageProvider: metadata.storageProvider,
    storageBucket: metadata.storageBucket,
    storageKey: metadata.storageKey
  }, normalizeFile, session, "file_upload", (item) => `file ${item.title}`);
  return file;
}

function decodeUploadContent(fileInput) {
  const raw = cleanString(fileInput.dataUrl || fileInput.base64 || fileInput.content);
  if (!raw) publicError(400, "File upload requires base64 content");

  const dataUrlMatch = raw.match(/^data:([^;,]+)?;base64,(.+)$/);
  const contentType = cleanString(fileInput.contentType || dataUrlMatch?.[1]) || "application/octet-stream";
  const base64 = dataUrlMatch ? dataUrlMatch[2] : raw;
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    publicError(400, "File upload content is not valid base64");
  }
  if (!buffer.length) publicError(400, "File upload is empty");
  if (buffer.length > UPLOAD_LIMIT_BYTES) publicError(413, `File upload must be ${formatBytes(UPLOAD_LIMIT_BYTES)} or smaller`);
  return { buffer, contentType };
}

async function persistFileObject(storage, file) {
  if ((storage.driver || "json-file") === "supabase") {
    return uploadSupabaseFileObject(file);
  }
  const uploadRoot = path.join(storage.dataDir || path.join(__dirname, "data"), "uploads");
  const storageKey = `${file.id}/${file.fileName}`;
  const outputPath = path.join(uploadRoot, file.id, file.fileName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, file.buffer);
  return {
    storageProvider: "json-file",
    storageBucket: "",
    storageKey
  };
}

async function uploadSupabaseFileObject(file) {
  const supabaseUrl = cleanString(process.env.SUPABASE_URL || process.env.AGORA_SUPABASE_URL).replace(/\/+$/, "");
  const serviceKey = cleanString(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AGORA_SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceKey) {
    publicError(500, "Supabase file uploads require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API server");
  }

  const bucket = supabaseStorageBucket();
  const storageKey = `${workspace.id}/${file.id}/${file.fileName}`;
  const objectPath = storageKey.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": file.contentType,
      "x-upsert": "true"
    },
    body: file.buffer
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    publicError(response.status === 404 ? 500 : response.status, body.message || "Supabase Storage upload failed");
  }
  return {
    storageProvider: "supabase",
    storageBucket: bucket,
    storageKey
  };
}

async function downloadFileRecord(storage, fileId, session, response) {
  const files = await storage.loadRecords("files", scopedRecordFilters(session, {}));
  const file = files.find((item) => item.id === fileId);
  if (!file) {
    sendError(response, 404, "File not found");
    return;
  }

  const body = await readFileObject(storage, file);
  const contentType = cleanString(file.contentType) || "application/octet-stream";
  setSecurityHeaders(response);
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${sanitizeFileName(file.title || file.id)}"`,
    "Cache-Control": "private, no-store"
  });
  response.end(body);
}

async function readFileObject(storage, file) {
  if (file.storageProvider === "supabase") {
    const supabaseUrl = cleanString(process.env.SUPABASE_URL || process.env.AGORA_SUPABASE_URL).replace(/\/+$/, "");
    const serviceKey = cleanString(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AGORA_SUPABASE_SERVICE_ROLE_KEY);
    if (!supabaseUrl || !serviceKey) publicError(500, "Supabase file download is not configured");
    const bucket = cleanString(file.storageBucket) || supabaseStorageBucket();
    const objectPath = cleanString(file.storageKey).split("/").map(encodeURIComponent).join("/");
    const remote = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    });
    if (!remote.ok) publicError(remote.status === 404 ? 404 : 502, "File object could not be downloaded");
    return Buffer.from(await remote.arrayBuffer());
  }

  const uploadRoot = path.join(storage.dataDir || path.join(__dirname, "data"), "uploads");
  const storageKey = cleanString(file.storageKey);
  const filePath = path.resolve(uploadRoot, storageKey);
  const relativePath = path.relative(uploadRoot, filePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    publicError(400, "Stored file path is invalid");
  }
  try {
    return fs.readFileSync(filePath);
  } catch {
    publicError(404, "File object is missing from storage");
  }
}

function sanitizeFileName(value) {
  return cleanString(value).replace(/[/\\?%*:|"<>]/g, "-").slice(0, 160) || "file";
}

function fileKindFromName(fileName) {
  const ext = path.extname(fileName).replace(".", "").toUpperCase();
  return ext || "File";
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function supabaseStorageBucket() {
  return cleanString(process.env.AGORA_SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET) || "agora-files";
}

function normalizeProject(project) {
  requireRecord(project, "Project");
  if (!project.id || !project.name) {
    publicError(400, "Project requires id and name");
  }
  return {
    id: String(project.id),
    name: String(project.name),
    companyId: project.companyId ? String(project.companyId) : "",
    description: project.description ? String(project.description) : "",
    owner: project.owner ? String(project.owner) : "",
    startDate: project.startDate ? String(project.startDate) : "",
    dueDate: project.dueDate ? String(project.dueDate) : "",
    archivedAt: project.archivedAt ? String(project.archivedAt) : "",
    archivedBy: project.archivedBy ? String(project.archivedBy) : "",
    restoredAt: project.restoredAt ? String(project.restoredAt) : ""
  };
}

function normalizeCompany(company) {
  requireRecord(company, "Company");
  if (!company.id || !company.name) {
    publicError(400, "Company requires id and name");
  }
  return {
    id: String(company.id),
    name: String(company.name),
    type: company.type ? String(company.type) : "Client",
    owner: company.owner ? String(company.owner) : "",
    status: company.status ? String(company.status) : "active",
    description: company.description ? String(company.description) : ""
  };
}

function normalizeTask(task) {
  requireRecord(task, "Task");
  if (!task.id || !task.projectId) {
    publicError(400, "Task requires id and projectId");
  }
  return {
    id: String(task.id),
    projectId: String(task.projectId),
    title: task.title ? String(task.title) : "Untitled task",
    description: task.description ? String(task.description) : "",
    assignee: task.assignee ? String(task.assignee) : "",
    status: task.status ? String(task.status) : "todo",
    priority: task.priority ? String(task.priority) : "normal",
    startDate: task.startDate ? String(task.startDate) : "",
    dueDate: task.dueDate ? String(task.dueDate) : "",
    blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy.map(String) : [],
    tags: Array.isArray(task.tags) ? task.tags.map(String) : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    customFields: task.customFields && typeof task.customFields === "object" && !Array.isArray(task.customFields) ? task.customFields : {},
    createdAt: task.createdAt ? String(task.createdAt) : new Date().toISOString(),
    updatedAt: task.updatedAt ? String(task.updatedAt) : new Date().toISOString(),
    archivedAt: task.archivedAt ? String(task.archivedAt) : "",
    archivedBy: task.archivedBy ? String(task.archivedBy) : "",
    restoredAt: task.restoredAt ? String(task.restoredAt) : ""
  };
}

function normalizeComment(comment) {
  requireRecord(comment, "Comment");
  if (!comment.id || !comment.taskId || !comment.body) {
    publicError(400, "Comment requires id, taskId, and body");
  }
  return {
    id: String(comment.id),
    taskId: String(comment.taskId),
    author: comment.author ? String(comment.author) : "",
    body: String(comment.body),
    createdAt: comment.createdAt ? String(comment.createdAt) : new Date().toISOString()
  };
}

function normalizeChatMessage(message) {
  requireRecord(message, "Chat message");
  if (!message.id || !message.body) {
    publicError(400, "Chat message requires id and body");
  }
  const channel = cleanString(message.channel);
  return {
    id: String(message.id),
    channel: ["general", "delivery", "product", "client"].includes(channel) ? channel : "general",
    author: message.author ? String(message.author) : "",
    body: cleanString(message.body).slice(0, 600),
    projectId: message.projectId ? String(message.projectId) : "",
    createdAt: message.createdAt ? String(message.createdAt) : new Date().toISOString()
  };
}

function normalizeWhiteboard(board) {
  requireRecord(board, "Whiteboard");
  if (!board.id || !board.title) {
    publicError(400, "Whiteboard requires id and title");
  }
  return {
    id: String(board.id),
    title: cleanString(board.title).slice(0, 96),
    projectId: board.projectId ? String(board.projectId) : "",
    items: Array.isArray(board.items) ? board.items.map(normalizeWhiteboardItem).filter(Boolean).slice(0, 80) : [],
    updatedAt: board.updatedAt ? String(board.updatedAt) : new Date().toISOString()
  };
}

function normalizeWhiteboardItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const text = cleanString(item.text).slice(0, 180);
  if (!text) return null;
  const type = cleanString(item.type);
  const color = cleanString(item.color);
  return {
    id: item.id ? String(item.id) : `wb-note-${crypto.randomUUID()}`,
    type: ["note", "risk", "decision"].includes(type) ? type : "note",
    text,
    x: clampInteger(item.x, 0, 86, 8),
    y: clampInteger(item.y, 0, 78, 10),
    color: ["green", "amber", "blue", "neutral"].includes(color) ? color : "neutral"
  };
}

function normalizeNotificationSettingsRecord(record) {
  requireRecord(record, "Notification settings");
  const channels = record.channels && typeof record.channels === "object" && !Array.isArray(record.channels) ? record.channels : {};
  const events = record.events && typeof record.events === "object" && !Array.isArray(record.events) ? record.events : {};
  const digests = record.digests && typeof record.digests === "object" && !Array.isArray(record.digests) ? record.digests : {};
  const delivery = record.delivery && typeof record.delivery === "object" && !Array.isArray(record.delivery) ? record.delivery : {};
  return {
    id: cleanString(record.id) || "notification-settings-default",
    title: "Notification settings",
    events,
    digests,
    channels,
    cadence: ["daily", "weekly", "manual"].includes(cleanString(record.cadence)) ? cleanString(record.cadence) : "daily",
    delivery: {
      webhookUrl: cleanString(delivery.webhookUrl).slice(0, 300),
      emailAddress: cleanString(delivery.emailAddress).slice(0, 180),
      sendResolved: Boolean(delivery.sendResolved)
    },
    updatedAt: record.updatedAt ? String(record.updatedAt) : new Date().toISOString()
  };
}

function normalizeNotificationReminder(reminder) {
  requireRecord(reminder, "Notification reminder");
  if (!reminder.id || !reminder.sourceId || !reminder.remindAt) {
    publicError(400, "Notification reminder requires id, sourceId, and remindAt");
  }
  const repeat = cleanString(reminder.repeat);
  const status = cleanString(reminder.status);
  return {
    id: String(reminder.id),
    memberId: reminder.memberId ? String(reminder.memberId) : "",
    sourceId: String(reminder.sourceId),
    taskId: reminder.taskId ? String(reminder.taskId) : "",
    approvalId: reminder.approvalId ? String(reminder.approvalId) : "",
    projectId: reminder.projectId ? String(reminder.projectId) : "",
    companyId: reminder.companyId ? String(reminder.companyId) : "",
    title: cleanString(reminder.title || "Reminder").slice(0, 140),
    message: cleanString(reminder.message).slice(0, 260),
    remindAt: String(reminder.remindAt),
    repeat: ["none", "daily", "weekly"].includes(repeat) ? repeat : "none",
    status: ["scheduled", "sent", "dismissed"].includes(status) ? status : "scheduled",
    createdAt: reminder.createdAt ? String(reminder.createdAt) : new Date().toISOString(),
    sentAt: reminder.sentAt ? String(reminder.sentAt) : "",
    updatedAt: reminder.updatedAt ? String(reminder.updatedAt) : new Date().toISOString()
  };
}

function normalizeNotificationHistoryEvent(event) {
  requireRecord(event, "Notification history event");
  if (!event.id || !event.title) {
    publicError(400, "Notification history event requires id and title");
  }
  return {
    id: String(event.id),
    memberId: event.memberId ? String(event.memberId) : "",
    kind: cleanString(event.kind || "digest").slice(0, 48),
    title: cleanString(event.title).slice(0, 160),
    message: cleanString(event.message).slice(0, 500),
    reason: cleanString(event.reason).slice(0, 500),
    count: Math.max(0, Math.round(Number(event.count) || 0)),
    channel: cleanString(event.channel || "in-app").slice(0, 80),
    createdAt: event.createdAt ? String(event.createdAt) : new Date().toISOString(),
    updatedAt: event.updatedAt ? String(event.updatedAt) : event.createdAt ? String(event.createdAt) : new Date().toISOString()
  };
}

function normalizeInboxStateRecord(record) {
  requireRecord(record, "Inbox state");
  const snoozed = record.snoozed && typeof record.snoozed === "object" && !Array.isArray(record.snoozed) ? record.snoozed : {};
  return {
    id: cleanString(record.id) || "inbox-state-default",
    memberId: record.memberId ? String(record.memberId) : "",
    title: "Inbox state",
    read: Array.isArray(record.read) ? record.read.map(String).slice(0, 500) : [],
    archived: Array.isArray(record.archived) ? record.archived.map(String).slice(0, 500) : [],
    snoozed: Object.fromEntries(Object.entries(snoozed).map(([id, until]) => [String(id), String(until || "")]).filter(([id, until]) => id && until)),
    updatedAt: record.updatedAt ? String(record.updatedAt) : new Date().toISOString()
  };
}

function normalizeIntegrationSettingsRecord(record) {
  requireRecord(record, "Integration settings");
  const connections = Array.isArray(record.connections) ? record.connections : [];
  return {
    id: cleanString(record.id) || "integration-settings-default",
    title: "Integration settings",
    defaultOwner: cleanString(record.defaultOwner),
    webhookEndpoint: cleanString(record.webhookEndpoint).slice(0, 240),
    apiAccess: Boolean(record.apiAccess),
    eventMirroring: Boolean(record.eventMirroring),
    connections: connections.map(normalizeIntegrationConnectionRecord).filter(Boolean).slice(0, 40),
    updatedAt: record.updatedAt ? String(record.updatedAt) : new Date().toISOString()
  };
}

function normalizeIntegrationConnectionRecord(connection = {}) {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) return null;
  const id = cleanString(connection.id);
  if (!id) return null;
  const status = cleanString(connection.status);
  const syncMode = cleanString(connection.syncMode);
  const health = cleanString(connection.health);
  const secretStatus = cleanString(connection.secretStatus);
  return {
    id,
    status: ["planned", "connected", "paused"].includes(status) ? status : "planned",
    syncMode: ["none", "inbound", "outbound", "two-way"].includes(syncMode) ? syncMode : "none",
    owner: cleanString(connection.owner),
    health: ["planned", "healthy", "needs-config", "error"].includes(health) ? health : "planned",
    secretStatus: ["missing", "stored", "rotate"].includes(secretStatus) ? secretStatus : "missing",
    events: Array.isArray(connection.events) ? connection.events.map(String).slice(0, 20) : [],
    notes: cleanString(connection.notes).slice(0, 300),
    lastSyncedAt: connection.lastSyncedAt ? String(connection.lastSyncedAt) : ""
  };
}

function normalizeActivity(activity) {
  requireRecord(activity, "Activity");
  if (!activity.id || !activity.projectId || !activity.type || !activity.message) {
    publicError(400, "Activity requires id, projectId, type, and message");
  }
  return {
    id: String(activity.id),
    projectId: String(activity.projectId),
    taskId: activity.taskId ? String(activity.taskId) : "",
    memberId: activity.memberId ? String(activity.memberId) : "",
    type: String(activity.type),
    message: String(activity.message),
    createdAt: activity.createdAt ? String(activity.createdAt) : new Date().toISOString()
  };
}

function normalizePresence(presence) {
  requireRecord(presence, "Presence");
  if (!presence.id || !presence.memberId) {
    publicError(400, "Presence requires id and memberId");
  }
  const cursorX = optionalNumber(presence.cursorX);
  const cursorY = optionalNumber(presence.cursorY);
  const viewportWidth = optionalNumber(presence.viewportWidth);
  const viewportHeight = optionalNumber(presence.viewportHeight);
  return {
    id: String(presence.id),
    memberId: String(presence.memberId),
    route: presence.route ? String(presence.route) : "dashboard",
    projectId: presence.projectId ? String(presence.projectId) : "",
    taskId: presence.taskId ? String(presence.taskId) : "",
    viewing: presence.viewing ? String(presence.viewing) : "",
    cursorX,
    cursorY,
    viewportWidth,
    viewportHeight,
    status: presence.status ? String(presence.status) : "online",
    lastActiveAt: presence.lastActiveAt ? String(presence.lastActiveAt) : new Date().toISOString(),
    updatedAt: presence.updatedAt ? String(presence.updatedAt) : new Date().toISOString()
  };
}

function clampInteger(value, min, max, fallback) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDocument(document) {
  requireRecord(document, "Document");
  if (!document.id || !document.projectId || !document.title) {
    publicError(400, "Document requires id, projectId, and title");
  }
  return {
    id: String(document.id),
    projectId: String(document.projectId),
    title: String(document.title),
    type: document.type ? String(document.type) : "Note",
    owner: document.owner ? String(document.owner) : "",
    updatedAt: document.updatedAt ? String(document.updatedAt) : new Date().toISOString(),
    body: document.body ? String(document.body) : ""
  };
}

function normalizeFile(file) {
  requireRecord(file, "File");
  if (!file.id || !file.projectId || !file.title) {
    publicError(400, "File requires id, projectId, and title");
  }
  return {
    id: String(file.id),
    projectId: String(file.projectId),
    taskId: file.taskId ? String(file.taskId) : "",
    title: String(file.title),
    kind: file.kind ? String(file.kind) : "File",
    size: file.size ? String(file.size) : "Unknown size",
    owner: file.owner ? String(file.owner) : "",
    updatedAt: file.updatedAt ? String(file.updatedAt) : new Date().toISOString(),
    url: file.url ? String(file.url) : "",
    contentType: file.contentType ? String(file.contentType) : "",
    storageProvider: file.storageProvider ? String(file.storageProvider) : "",
    storageBucket: file.storageBucket ? String(file.storageBucket) : "",
    storageKey: file.storageKey ? String(file.storageKey) : ""
  };
}

function normalizeApproval(approval) {
  requireRecord(approval, "Approval");
  if (!approval.id || !approval.projectId || !approval.title) {
    publicError(400, "Approval requires id, projectId, and title");
  }
  return {
    id: String(approval.id),
    companyId: approval.companyId ? String(approval.companyId) : "",
    projectId: String(approval.projectId),
    taskId: approval.taskId ? String(approval.taskId) : "",
    title: String(approval.title),
    requester: approval.requester ? String(approval.requester) : "",
    reviewer: approval.reviewer ? String(approval.reviewer) : "",
    status: approval.status ? String(approval.status) : "requested",
    dueDate: approval.dueDate ? String(approval.dueDate) : "",
    summary: approval.summary ? String(approval.summary) : "",
    createdAt: approval.createdAt ? String(approval.createdAt) : new Date().toISOString(),
    updatedAt: approval.updatedAt ? String(approval.updatedAt) : ""
  };
}

function normalizeTimeEntry(entry) {
  requireRecord(entry, "Time entry");
  if (!entry.id || !entry.taskId || !entry.memberId) {
    publicError(400, "Time entry requires id, taskId, and memberId");
  }
  const minutes = Number(entry.minutes || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) publicError(400, "Time entry minutes must be greater than zero");
  return {
    id: String(entry.id),
    taskId: String(entry.taskId),
    memberId: String(entry.memberId),
    date: entry.date ? String(entry.date) : new Date().toISOString().slice(0, 10),
    minutes,
    note: entry.note ? String(entry.note) : "",
    billable: Boolean(entry.billable),
    createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString()
  };
}

function recordFiltersFromUrl(url) {
  return {
    projectId: url.searchParams.get("projectId") || "",
    taskId: url.searchParams.get("taskId") || "",
    companyId: url.searchParams.get("companyId") || "",
    memberId: url.searchParams.get("memberId") || ""
  };
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    publicError(400, `${label} must be an object`);
  }
  return value;
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    const error = new Error("Workspace snapshot must be an object");
    error.statusCode = 400;
    error.publicMessage = "Workspace snapshot must be an object";
    throw error;
  }
}

function publicError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  throw error;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > BODY_LIMIT_BYTES) {
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        error.publicMessage = "Request body is too large";
        reject(error);
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        const error = new Error("Invalid JSON body");
        error.statusCode = 400;
        error.publicMessage = "Invalid JSON body";
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function applyCors(request, response) {
  setSecurityHeaders(response);
  const origin = cleanString(request.headers.origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (!origin) return true;
  if (!isAllowedOrigin(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  return true;
}

function isAllowedOrigin(origin) {
  const allowed = allowedOrigins();
  if (allowed.has(origin)) return true;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) && url.protocol === "http:";
  } catch {
    return false;
  }
}

function allowedOrigins() {
  return new Set(cleanString(process.env.AGORA_ALLOWED_ORIGINS)
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean));
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
}

function sendJson(response, statusCode, value) {
  setSecurityHeaders(response);
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

if (require.main === module) {
  const storage = createStorage();
  const server = createServer({ storage });
  if (envFlag("AGORA_SCHEDULER_ENABLED", false)) {
    const intervalMs = positiveNumber(process.env.AGORA_SCHEDULER_INTERVAL_SECONDS, 60) * 1000;
    windowlessInterval(() => {
      runNotificationScheduler(storage, { source: "worker" }).catch((error) => {
        console.error(`Agora scheduler failed: ${error.message}`);
      });
    }, intervalMs);
  }
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Agora API listening at http://127.0.0.1:${PORT}`);
  });
}

function windowlessInterval(callback, intervalMs) {
  callback();
  return setInterval(callback, intervalMs);
}

module.exports = {
  createServer,
  rolePermissions,
  runNotificationScheduler
};
