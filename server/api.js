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
const PUBLIC_FEATURE_BODY_LIMIT_BYTES = positiveNumber(process.env.AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES, 24 * 1024);
const UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SCRYPT_COST = 16384;
const SESSION_TTL_MS = positiveNumber(process.env.AGORA_SESSION_TTL_SECONDS, 8 * 60 * 60) * 1000;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_ATTEMPTS = 8;
const PUBLIC_FEATURE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS = positiveNumber(process.env.AGORA_PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS, 6);
const PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS = positiveNumber(process.env.AGORA_PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS, 3);
const PASSWORD_RESET_TTL_MS = positiveNumber(process.env.AGORA_PASSWORD_RESET_TTL_MINUTES, 30) * 60 * 1000;
const INVITATION_TTL_MS = positiveNumber(process.env.AGORA_INVITATION_TTL_DAYS, 14) * 24 * 60 * 60 * 1000;
const PORTAL_LINK_TTL_MS = positiveNumber(process.env.AGORA_PORTAL_LINK_TTL_DAYS, 14) * 24 * 60 * 60 * 1000;
const PUBLIC_PORTAL_RATE_LIMIT_ATTEMPTS = positiveNumber(process.env.AGORA_PUBLIC_PORTAL_RATE_LIMIT_ATTEMPTS, 30);
const PUBLIC_PORTAL_RATE_LIMIT_WINDOW_MS = positiveNumber(process.env.AGORA_PUBLIC_PORTAL_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const API_VERSION = "0.1.0";

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
  admin: ["workspace:read", "workspace:write", "workspace:import", "audit:read", "members:write", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write"],
  manager: ["workspace:read", "workspace:write", "audit:read", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write"],
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
  notificationSettings: { writePermission: "notifications:write", normalizer: normalizeNotificationSettingsRecord, label: "notification settings" },
  notificationReminders: { writePermission: "workspace:read", normalizer: normalizeNotificationReminder, label: "notification reminder" },
  notificationHistory: { writePermission: "workspace:read", normalizer: normalizeNotificationHistoryEvent, label: "notification history" },
  inboxState: { writePermission: "workspace:read", normalizer: normalizeInboxStateRecord, label: "inbox state" },
  integrationSettings: { writePermission: "integrations:write", normalizer: normalizeIntegrationSettingsRecord, label: "integration settings" },
  automationRules: { writePermission: "projects:write", normalizer: normalizeAutomationRuleRecord, label: "automation rule" },
  automationRuns: { writePermission: "scheduler:run", normalizer: normalizeAutomationRunRecord, label: "automation run" }
};

const sessions = new Map();
const rateLimits = new Map();
const paymentIntents = new Map();
const backgroundJobs = [];
const backgroundJobHistory = [];
let backgroundJobRunning = false;
let backgroundJobDrainTimer = null;
let backgroundJobDrainAt = 0;
let backgroundJobStorage = null;
let backgroundJobHydration = null;
const requestMetrics = {
  startedAt: new Date().toISOString(),
  total: 0,
  errors: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
  byRoute: new Map(),
  recentErrors: []
};
const realtimeClients = new Set();
const BACKGROUND_JOB_MAX_QUEUE = positiveNumber(process.env.AGORA_BACKGROUND_JOB_MAX_QUEUE, 100);
const BACKGROUND_JOB_BASE_RETRY_MS = positiveNumber(process.env.AGORA_BACKGROUND_JOB_BASE_RETRY_MS, 5000);
const BACKGROUND_JOB_MAX_RETRY_MS = positiveNumber(process.env.AGORA_BACKGROUND_JOB_MAX_RETRY_MS, 60000);

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
  if (envFlag("AGORA_TRUST_PROXY", false)) {
    const forwarded = cleanString(request.headers["x-forwarded-for"]).split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return request.socket?.remoteAddress || "unknown";
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

function enqueueBackgroundJob(type, handler, metadata = {}, payload = {}) {
  const job = {
    id: `job-${crypto.randomUUID()}`,
    type,
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    metadata,
    payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  backgroundJobHistory.unshift(job);
  backgroundJobHistory.splice(100);
  if (backgroundJobs.length >= BACKGROUND_JOB_MAX_QUEUE) {
    job.status = "rejected";
    job.error = "Background job queue is full";
    job.finishedAt = job.updatedAt;
    persistBackgroundJobs();
    return job;
  }

  backgroundJobs.push({ job, handler, runAt: Date.now() });
  persistBackgroundJobs();
  scheduleBackgroundDrain();
  return job;
}

function initializeBackgroundJobs(storage) {
  if (!storage || typeof storage.loadBackgroundJobs !== "function") return;
  backgroundJobStorage = storage;
  backgroundJobHydration = storage.loadBackgroundJobs()
    .then((jobs) => {
      const persistedJobs = (Array.isArray(jobs) ? jobs : [])
        .map(normalizeBackgroundJob)
        .filter(Boolean)
        .slice(0, 100);
      const currentQueued = backgroundJobs.slice();
      const currentJobs = backgroundJobHistory.map(normalizeBackgroundJob).filter(Boolean);
      const mergedById = new Map();
      [...persistedJobs, ...currentJobs].forEach((job) => mergedById.set(job.id, job));
      const mergedJobs = Array.from(mergedById.values())
        .sort((a, b) => cleanString(b.updatedAt || b.createdAt).localeCompare(cleanString(a.updatedAt || a.createdAt)))
        .slice(0, 100);
      backgroundJobHistory.splice(0, backgroundJobHistory.length, ...mergedJobs);
      const queuedById = new Map(currentQueued.map((queued) => [queued.job.id, queued]));
      persistedJobs
        .filter((job) => shouldRequeuePersistedJob(job))
        .forEach((job) => {
          if (queuedById.has(job.id)) return;
          const queuedJob = {
            ...job,
            status: "queued",
            updatedAt: new Date().toISOString()
          };
          const nextRunAt = Date.parse(job.nextRunAt || "");
          queuedJob.nextRunAt = Number.isFinite(nextRunAt) ? new Date(nextRunAt).toISOString() : "";
          queuedById.set(job.id, {
            job: queuedJob,
            handler: null,
            runAt: Number.isFinite(nextRunAt) ? nextRunAt : Date.now()
          });
        });
      backgroundJobs.splice(0, backgroundJobs.length, ...queuedById.values());
      if (backgroundJobs.length) {
        persistBackgroundJobs();
        scheduleNextBackgroundJobDrain();
      }
    })
    .catch((error) => {
      console.error("Failed to load persisted background jobs:", error.message);
    });
}

function shouldRequeuePersistedJob(job) {
  return ["queued", "running"].includes(job.status) &&
    job.attempts < job.maxAttempts &&
    Boolean(backgroundJobHandler(job));
}

function persistBackgroundJobs() {
  if (!backgroundJobStorage || typeof backgroundJobStorage.saveBackgroundJobs !== "function") return;
  const jobs = backgroundJobHistory.map(serializeBackgroundJob).slice(0, 100);
  Promise.resolve(backgroundJobHydration)
    .catch(() => {})
    .then(() => backgroundJobStorage.saveBackgroundJobs(jobs))
    .catch((error) => {
      console.error("Failed to persist background jobs:", error.message);
    });
}

function serializeBackgroundJob(job = {}) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    metadata: job.metadata || {},
    payload: job.payload || {},
    error: job.error || "",
    createdAt: job.createdAt || "",
    updatedAt: job.updatedAt || "",
    nextRunAt: job.nextRunAt || "",
    finishedAt: job.finishedAt || ""
  };
}

function normalizeBackgroundJob(job = {}) {
  if (!job.id || !job.type) return null;
  const status = ["queued", "running", "succeeded", "failed", "rejected", "canceled", "cleared"].includes(job.status) ? job.status : "queued";
  const createdAt = cleanString(job.createdAt) || new Date().toISOString();
  return {
    id: cleanString(job.id),
    type: cleanString(job.type),
    status,
    attempts: Math.max(0, Number(job.attempts || 0)),
    maxAttempts: Math.max(1, Number(job.maxAttempts || 3)),
    metadata: job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata : {},
    payload: job.payload && typeof job.payload === "object" && !Array.isArray(job.payload) ? job.payload : {},
    error: cleanString(job.error),
    createdAt,
    updatedAt: cleanString(job.updatedAt) || createdAt,
    nextRunAt: cleanString(job.nextRunAt),
    finishedAt: cleanString(job.finishedAt)
  };
}

function backgroundJobPreviewValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 220 ? `${value.slice(0, 220)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return {
      count: value.length,
      sample: value.slice(0, depth > 1 ? 1 : 3).map((item) => backgroundJobPreviewValue(item, depth + 1))
    };
  }
  if (typeof value === "object") {
    const sensitivePattern = /(token|secret|password|authorization|signature|key)/i;
    return Object.fromEntries(Object.entries(value).slice(0, 12).map(([key, entryValue]) => [
      key,
      sensitivePattern.test(key) ? "[redacted]" : depth > 2 ? "[object]" : backgroundJobPreviewValue(entryValue, depth + 1)
    ]));
  }
  return String(value);
}

function backgroundJobPayloadPreview(job = {}) {
  const payload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload) ? job.payload : {};
  return {
    bytes: Buffer.byteLength(JSON.stringify(payload)),
    preview: backgroundJobPreviewValue(payload)
  };
}

function backgroundJobHandler(job, fallbackHandler = null) {
  if (fallbackHandler) return fallbackHandler;
  if (["feature-request-email", "feature-request-update-email", "invitation-email", "portal-action-email"].includes(job.type)) {
    return () => sendSmtpMail(job.payload || {});
  }
  if (job.type === "integration-sync") {
    return () => recordIntegrationSyncJob(job);
  }
  return null;
}

async function recordIntegrationSyncJob(job) {
  job.metadata = {
    ...(job.metadata || {}),
    processedAt: new Date().toISOString(),
    simulated: true
  };
  return job;
}

function scheduleBackgroundDrain(delayMs = 0) {
  if (backgroundJobRunning) return;
  const targetAt = Date.now() + Math.max(0, delayMs);
  if (backgroundJobDrainTimer && backgroundJobDrainAt <= targetAt) return;
  if (backgroundJobDrainTimer) clearTimeout(backgroundJobDrainTimer);
  backgroundJobDrainAt = targetAt;
  backgroundJobDrainTimer = setTimeout(() => {
    backgroundJobDrainTimer = null;
    backgroundJobDrainAt = 0;
    drainBackgroundJobs();
  }, Math.max(0, delayMs));
  if (typeof backgroundJobDrainTimer.unref === "function") backgroundJobDrainTimer.unref();
}

function drainBackgroundJobs() {
  if (backgroundJobRunning) return;
  const dueIndex = nextDueBackgroundJobIndex();
  if (dueIndex === -1) {
    scheduleNextBackgroundJobDrain();
    return;
  }
  backgroundJobRunning = true;
  queueMicrotask(async () => {
    try {
      while (true) {
        const nextIndex = nextDueBackgroundJobIndex();
        if (nextIndex === -1) break;
        const [queued] = backgroundJobs.splice(nextIndex, 1);
        const { job, handler } = queued;
        const activeHandler = backgroundJobHandler(job, handler);
        if (!activeHandler) {
          job.status = "failed";
          job.error = `No background job handler registered for ${job.type}`;
          job.updatedAt = new Date().toISOString();
          job.finishedAt = job.updatedAt;
          persistBackgroundJobs();
          continue;
        }
        job.status = "running";
        job.attempts += 1;
        job.nextRunAt = "";
        job.updatedAt = new Date().toISOString();
        persistBackgroundJobs();
        try {
          await activeHandler();
          job.status = "succeeded";
          job.finishedAt = new Date().toISOString();
          job.updatedAt = job.finishedAt;
          persistBackgroundJobs();
        } catch (error) {
          job.status = job.attempts < job.maxAttempts ? "queued" : "failed";
          job.error = error.message;
          job.updatedAt = new Date().toISOString();
          if (job.status === "queued") {
            queued.runAt = Date.now() + backgroundJobRetryDelay(job.attempts);
            job.nextRunAt = new Date(queued.runAt).toISOString();
            backgroundJobs.push(queued);
          } else {
            job.finishedAt = job.updatedAt;
            job.nextRunAt = "";
          }
          persistBackgroundJobs();
        }
      }
    } finally {
      backgroundJobRunning = false;
      scheduleNextBackgroundJobDrain();
    }
  });
}

function nextDueBackgroundJobIndex() {
  const now = Date.now();
  return backgroundJobs.findIndex((queued) => (queued.runAt || 0) <= now);
}

function scheduleNextBackgroundJobDrain() {
  if (!backgroundJobs.length) return;
  const nextRunAt = Math.min(...backgroundJobs.map((queued) => queued.runAt || Date.now()));
  scheduleBackgroundDrain(Math.max(0, nextRunAt - Date.now()));
}

function backgroundJobRetryDelay(attempts) {
  return Math.min(BACKGROUND_JOB_MAX_RETRY_MS, BACKGROUND_JOB_BASE_RETRY_MS * (2 ** Math.max(0, attempts - 1)));
}

function recordRequestMetric({ method, pathname, statusCode, durationMs }) {
  const route = `${method} ${normalizeMetricPath(pathname)}`;
  const failed = statusCode >= 500;
  requestMetrics.total += 1;
  requestMetrics.errors += failed ? 1 : 0;
  requestMetrics.totalDurationMs += durationMs;
  requestMetrics.maxDurationMs = Math.max(requestMetrics.maxDurationMs, durationMs);
  const current = requestMetrics.byRoute.get(route) || { route, count: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
  current.count += 1;
  current.errors += failed ? 1 : 0;
  current.totalDurationMs += durationMs;
  current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
  requestMetrics.byRoute.set(route, current);
  if (statusCode >= 400) {
    requestMetrics.recentErrors.unshift({
      route,
      statusCode,
      durationMs,
      at: new Date().toISOString()
    });
    requestMetrics.recentErrors.splice(20);
  }
}

function normalizeMetricPath(pathname) {
  return cleanString(pathname)
    .replace(/\/api\/tasks\/[^/]+/g, "/api/tasks/:id")
    .replace(/\/api\/projects\/[^/]+/g, "/api/projects/:id")
    .replace(/\/api\/feature-requests\/[^/]+/g, "/api/feature-requests/:id")
    .replace(/\/api\/invitations\/[^/]+/g, "/api/invitations/:token")
    .replace(/\/api\/records\/[^/]+/g, "/api/records/:collection")
    .replace(/\/api\/files\/[^/]+/g, "/api/files/:id");
}

function requestMetricsSnapshot() {
  const routes = Array.from(requestMetrics.byRoute.values())
    .map((route) => ({
      route: route.route,
      count: route.count,
      errors: route.errors,
      avgDurationMs: route.count ? Math.round(route.totalDurationMs / route.count) : 0,
      maxDurationMs: route.maxDurationMs
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return {
    startedAt: requestMetrics.startedAt,
    total: requestMetrics.total,
    errors: requestMetrics.errors,
    avgDurationMs: requestMetrics.total ? Math.round(requestMetrics.totalDurationMs / requestMetrics.total) : 0,
    maxDurationMs: requestMetrics.maxDurationMs,
    routes,
    recentErrors: requestMetrics.recentErrors
  };
}

function backgroundJobSnapshot() {
  return {
    queued: backgroundJobs.length,
    maxQueue: BACKGROUND_JOB_MAX_QUEUE,
    running: backgroundJobRunning,
    recent: backgroundJobHistory.filter((job) => job.status !== "cleared").slice(0, 20).map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      metadata: job.metadata,
      payloadPreview: backgroundJobPayloadPreview(job),
      error: job.error || "",
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      nextRunAt: job.nextRunAt || "",
      finishedAt: job.finishedAt || ""
    }))
  };
}

function backgroundJobAction(jobId, action) {
  const job = backgroundJobHistory.find((item) => item.id === jobId);
  if (!job) publicError(404, "Background job not found");
  const now = new Date().toISOString();

  if (action === "retry") {
    if (!backgroundJobHandler(job)) publicError(400, "Background job type cannot be retried");
    if (!["failed", "rejected", "canceled"].includes(job.status)) publicError(409, "Only failed, rejected, or canceled jobs can be retried");
    job.status = "queued";
    job.error = "";
    job.attempts = 0;
    job.nextRunAt = "";
    job.finishedAt = "";
    job.updatedAt = now;
    if (!backgroundJobs.some((queued) => queued.job.id === job.id)) {
      backgroundJobs.push({ job, handler: null, runAt: Date.now() });
    }
    persistBackgroundJobs();
    scheduleBackgroundDrain();
    return job;
  }

  if (action === "cancel") {
    if (job.status === "running") publicError(409, "Running jobs cannot be canceled");
    if (job.status !== "queued") publicError(409, "Only queued jobs can be canceled");
    backgroundJobs.splice(0, backgroundJobs.length, ...backgroundJobs.filter((queued) => queued.job.id !== job.id));
    job.status = "canceled";
    job.error = "";
    job.nextRunAt = "";
    job.finishedAt = now;
    job.updatedAt = now;
    persistBackgroundJobs();
    return job;
  }

  if (action === "clear") {
    if (job.status === "running") publicError(409, "Running jobs cannot be cleared");
    backgroundJobs.splice(0, backgroundJobs.length, ...backgroundJobs.filter((queued) => queued.job.id !== job.id));
    job.status = "cleared";
    job.nextRunAt = "";
    job.finishedAt = job.finishedAt || now;
    job.updatedAt = now;
    persistBackgroundJobs();
    return job;
  }

  publicError(404, "Background job action not found");
}

function apiCapabilitiesDocument() {
  return {
    service: "agora-api",
    version: API_VERSION,
    generatedAt: new Date().toISOString(),
    workspace: {
      id: workspace.id,
      slug: workspace.slug
    },
    docs: {
      api: "/api/openapi.json",
      agentContract: "docs/api-agent-contract.md",
      mcp: "docs/mcp-server.md"
    },
    auth: {
      bearer: true,
      publicEndpoints: [
        "GET /api/health",
        "GET /api/capabilities",
        "GET /api/openapi.json",
        "GET /api/public/feature-requests",
        "POST /api/public/feature-requests",
        "GET /api/integrations/github/status",
        "POST /api/integrations/github/webhook",
        "GET /api/invitations/:token",
        "POST /api/invitations/:token/accept",
        "GET /api/portal-links/validate/:token",
        "POST /api/portal-links/actions/:token"
      ],
      sessionEndpoints: [
        "POST /api/auth/password-login",
        "POST /api/auth/supabase-login",
        "POST /api/auth/logout",
        "GET /api/session"
      ]
    },
    resources: {
      canonical: ["projects", "tasks"],
      structuredCollections: Object.keys(recordCollections),
      integrationSync: "POST /api/integrations/sync",
      workspaceSnapshot: true,
      realtime: "GET /api/realtime/events"
    },
    permissions: rolePermissions,
    agentDefaults: {
      readOnlyByDefault: true,
      preferCanonicalWrites: true,
      requireConfirmationFor: [
        "workspace imports",
        "archive or restore actions",
        "external email or webhook sends",
        "payment actions",
        "membership or security changes"
      ]
    }
  };
}

function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Agora API",
      version: API_VERSION,
      summary: "Open source project management API for local-first teams and trusted automation clients."
    },
    servers: [
      {
        url: "http://127.0.0.1:8787",
        description: "Local Agora API"
      }
    ],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/health": {
        get: publicOperation("Service health", "Returns service health and active workspace metadata.")
      },
      "/api/capabilities": {
        get: publicOperation("API capabilities", "Returns auth, permissions, resources, and agent defaults.")
      },
      "/api/session": {
        get: operation("Current session", "Returns authenticated user, membership, permissions, and scope.")
      },
      "/api/projects": {
        get: operation("List projects", "Lists visible projects with limit, offset, query, and companyId filters."),
        post: operation("Create project", "Creates a project for sessions with project write permission.")
      },
      "/api/projects/{id}": {
        put: operation("Update project", "Updates a project for project-manager/admin roles."),
        delete: operation("Archive project", "Archives a project and its tasks.")
      },
      "/api/tasks": {
        get: operation("List tasks", "Lists visible tasks with project, company, assignee, status, priority, tag, and query filters."),
        post: operation("Create task", "Creates a task for sessions with task write permission.")
      },
      "/api/tasks/{id}": {
        put: operation("Update task", "Updates a task for sessions with task write permission."),
        delete: operation("Archive task", "Archives a task.")
      },
      "/api/records": {
        get: operation("List structured records", "Returns structured collections and bootstrap fallback data.")
      },
      "/api/records/{collection}": {
        get: operation("List collection records", "Lists a structured collection with scope-safe filters."),
        post: operation("Create or update collection record", "Writes one structured record with server-side permission checks.")
      },
      "/api/workspace": {
        get: operation("Get workspace snapshot", "Returns the current scoped workspace snapshot."),
        put: operation("Save workspace snapshot", "Saves a workspace snapshot for workspace-wide admin/project-manager roles.")
      },
      "/api/workspace/import": {
        post: operation("Import workspace", "Imports a workspace snapshot for admins.")
      },
      "/api/backend/health": {
        get: operation("Backend health", "Returns authenticated readiness, metrics, jobs, production gates, and session scope.")
      },
      "/api/integrations/sync": {
        post: operation("Queue integration sync", "Queues an inbound, outbound, or two-way provider sync job for sessions with integration write permission.")
      },
      "/api/integrations/github/status": {
        get: publicOperation("GitHub integration status", "Returns repository mapping, webhook readiness, and pending conflict counts without exposing secrets.")
      },
      "/api/integrations/github/webhook": {
        post: publicOperation("GitHub webhook intake", "Receives GitHub issue and pull-request webhooks, enforces signatures when required, blocks duplicate X-GitHub-Delivery replays, maps events to tasks, and records conflicts or rejected deliveries for review.")
      },
      "/api/integrations/github/conflicts/{id}/resolve": {
        post: operation("Resolve GitHub conflict", "Applies Keep Agora, Use GitHub, Merge, or Ignore decisions to an open GitHub conflict.")
      },
      "/api/integrations/github/test-event": {
        post: operation("Send GitHub test event", "Sends a realistic GitHub issue event through the same task mapping and receipt path as production webhooks.")
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer"
        }
      }
    },
    "x-agora": {
      capabilitiesUrl: "/api/capabilities",
      agentContract: "docs/api-agent-contract.md",
      structuredCollections: Object.keys(recordCollections)
    }
  };
}

function publicOperation(summary, description) {
  return {
    summary,
    description,
    security: [],
    responses: {
      200: { description: "OK" }
    }
  };
}

function operation(summary, description) {
  return {
    summary,
    description,
    responses: {
      200: { description: "OK" },
      401: { description: "Missing or invalid session" },
      403: { description: "Missing permission" }
    }
  };
}

function createServer(options = {}) {
  const storage = options.storage || createStorage();
  initializeBackgroundJobs(storage);
  const allowDemoAuth = options.allowDemoAuth ?? envFlag("AGORA_DEMO_AUTH", false);
  const allowPasswordlessAuth = options.allowPasswordlessAuth ?? envFlag("AGORA_PASSWORDLESS_AUTH", false);

  return http.createServer(async (request, response) => {
    const requestStartedAt = Date.now();
    const requestUrl = new URL(request.url, "http://localhost");
    response.on("finish", () => {
      recordRequestMetric({
        method: request.method,
        pathname: requestUrl.pathname,
        statusCode: response.statusCode,
        durationMs: Date.now() - requestStartedAt
      });
    });
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

      const url = requestUrl;

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          service: "agora-api",
          version: API_VERSION,
          storage: storage.driver || "json-file",
          auth: authDriverLabel(),
          workspace
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/capabilities") {
        sendJson(response, 200, apiCapabilitiesDocument());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/openapi.json") {
        sendJson(response, 200, openApiDocument());
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

      const publicPortalLinkMatch = url.pathname.match(/^\/api\/portal-links\/validate\/([^/]+)$/);
      if (publicPortalLinkMatch && request.method === "GET") {
        assertRateLimit(request, "public-portal-link", PUBLIC_PORTAL_RATE_LIMIT_ATTEMPTS, PUBLIC_PORTAL_RATE_LIMIT_WINDOW_MS);
        const result = await validatePortalLink(storage, decodeURIComponent(publicPortalLinkMatch[1]));
        sendJson(response, 200, result);
        return;
      }

      const publicPortalActionMatch = url.pathname.match(/^\/api\/portal-links\/actions\/([^/]+)$/);
      if (publicPortalActionMatch && request.method === "POST") {
        assertRateLimit(request, "public-portal-action", PUBLIC_PORTAL_RATE_LIMIT_ATTEMPTS, PUBLIC_PORTAL_RATE_LIMIT_WINDOW_MS);
        const body = await readJsonBody(request, PUBLIC_FEATURE_BODY_LIMIT_BYTES);
        const result = await handlePortalLinkAction(storage, decodeURIComponent(publicPortalActionMatch[1]), body);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/public/feature-requests") {
        if (!publicFeatureRequestsEnabled()) {
          sendError(response, 404, "Public feature requests are disabled");
          return;
        }
        const config = await publicFeatureRequestConfig(storage);
        sendJson(response, 200, config);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/public/feature-requests") {
        if (!publicFeatureRequestsEnabled()) {
          sendError(response, 404, "Public feature requests are disabled");
          return;
        }
        assertRateLimit(request, "public-feature-request", PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS, PUBLIC_FEATURE_RATE_LIMIT_WINDOW_MS);
        const body = await readJsonBody(request, PUBLIC_FEATURE_BODY_LIMIT_BYTES);
        if (cleanString(body.website || body.url || body.companyWebsite)) {
          sendJson(response, 202, { ok: true, accepted: false });
          return;
        }
        const email = optionalEmail(body.email);
        if (email) assertRateLimit(request, `public-feature-email:${email}`, PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS, 60 * 60 * 1000);
        const result = await createPublicFeatureRequest(storage, body);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/integrations/github/status") {
        const snapshot = await storage.loadWorkspaceSnapshot();
        sendJson(response, 200, githubIntegrationStatus(snapshot, storage));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/integrations/github/webhook") {
        assertRateLimit(request, "github-webhook", 120, 60 * 1000);
        const body = await readJsonBodyWithRaw(request, 1024 * 1024);
        try {
          verifyGitHubWebhookSignature(storage, request, body.raw);
          const deliveryId = githubWebhookDeliveryId(request);
          if (deliveryId && await githubWebhookDeliverySeen(storage, deliveryId)) {
            const receipt = await recordGitHubWebhookReceipt(storage, {
              deliveryId,
              eventName: githubWebhookEventName(request) || "unknown",
              action: cleanString(body.json?.action).toLowerCase(),
              repository: githubRepositoryFullName(body.json),
              number: body.json?.issue?.number || body.json?.pull_request?.number,
              outcome: "duplicate",
              reason: "Ignored duplicate GitHub webhook delivery"
            });
            sendJson(response, 202, { accepted: true, ignored: true, duplicate: true, receipt });
            return;
          }
          const result = await handleGitHubWebhook(storage, request, body.json, { deliveryId });
          sendJson(response, result.conflict || result.ignored ? 202 : 201, result);
        } catch (error) {
          await recordGitHubWebhookFailureReceipt(storage, request, body.json, error.publicMessage || "GitHub webhook rejected");
          throw error;
        }
        return;
      }

      const session = await requireSession(request, response, storage);
      if (!session) return;

      if (request.method === "GET" && url.pathname === "/api/realtime/events") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        openRealtimeStream(request, response, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        sessions.delete(session.token);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/session") {
        sendJson(response, 200, session);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/auth/sessions") {
        sendJson(response, 200, listActiveSessions(session));
        return;
      }

      const sessionRevokeMatch = url.pathname.match(/^\/api\/auth\/sessions\/([^/]+)$/);
      if (sessionRevokeMatch && request.method === "DELETE") {
        sendJson(response, 200, revokeActiveSession(session, decodeURIComponent(sessionRevokeMatch[1])));
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

      const backendJobActionMatch = url.pathname.match(/^\/api\/backend\/jobs\/([^/]+)\/(retry|cancel|clear)$/);
      if (backendJobActionMatch && request.method === "POST") {
        if (!hasPermission(session, "scheduler:run")) {
          sendError(response, 403, "Missing scheduler run permission");
          return;
        }
        const job = backgroundJobAction(decodeURIComponent(backendJobActionMatch[1]), backendJobActionMatch[2]);
        sendJson(response, 200, { job, jobs: backgroundJobSnapshot() });
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
        if (!hasPermission(session, "scheduler:run")) {
          sendError(response, 403, "Missing scheduler run permission");
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

      if (request.method === "POST" && url.pathname === "/api/notifications/test-email") {
        if (!hasPermission(session, "notifications:write")) {
          sendError(response, 403, "Missing notification write permission");
          return;
        }
        const body = await readJsonBody(request);
        const email = await sendNotificationTestEmail(body, session);
        sendJson(response, 200, { email });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/automations/run") {
        if (!hasPermission(session, "scheduler:run")) {
          sendError(response, 403, "Missing scheduler run permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await runAutomationRules(storage, {
          session,
          actorId: session.user.id,
          source: "manual",
          ruleId: cleanString(body.ruleId),
          triggerKind: cleanString(body.triggerKind)
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/integrations/sync") {
        if (!hasPermission(session, "integrations:write")) {
          sendError(response, 403, "Missing integrations write permission");
          return;
        }
        const body = await readJsonBody(request);
        const provider = cleanString(body.provider || "github").toLowerCase() || "github";
        const direction = ["inbound", "outbound", "two-way"].includes(cleanString(body.direction)) ? cleanString(body.direction) : "inbound";
        const job = enqueueBackgroundJob("integration-sync", null, {
          provider,
          direction,
          requestedBy: session.user.id,
          workspaceId: storage.workspaceId || workspace.id
        }, {
          provider,
          direction,
          mapping: body.mapping && typeof body.mapping === "object" && !Array.isArray(body.mapping) ? body.mapping : {},
          records: Array.isArray(body.records) ? body.records.slice(0, 100) : []
        });
        sendJson(response, job.status === "rejected" ? 202 : 201, { job, jobs: backgroundJobSnapshot() });
        return;
      }

      const githubConflictResolveMatch = url.pathname.match(/^\/api\/integrations\/github\/conflicts\/([^/]+)\/resolve$/);
      if (githubConflictResolveMatch && request.method === "POST") {
        if (!hasPermission(session, "integrations:write") || !hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing integration or task write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await resolveGitHubConflict(storage, decodeURIComponent(githubConflictResolveMatch[1]), body, session);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/integrations/github/test-event") {
        if (!hasPermission(session, "integrations:write") || !hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing integration or task write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await runGitHubTestEvent(storage, body, session);
        sendJson(response, 201, result);
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
        if (!hasPermission(session, "payments:write")) {
          sendError(response, 403, "Missing payments write permission");
          return;
        }
        const body = await readJsonBody(request);
        const intent = createPaymentIntent(body, session);
        sendJson(response, 201, { intent });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/payments/events") {
        if (!hasPermission(session, "payments:write")) {
          sendError(response, 403, "Missing payments write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await handlePaymentEvent(storage, body, session);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/marketplace/catalog") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = scopedSnapshot(await storage.loadWorkspaceSnapshot(), session);
        sendJson(response, 200, {
          catalog: marketplaceCatalogFromSnapshot(snapshot),
          generatedAt: new Date().toISOString()
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/marketplace/catalog") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await publishMarketplaceCatalog(storage, body, session);
        sendJson(response, 201, result);
        return;
      }

      const marketplaceExportMatch = url.pathname.match(/^\/api\/marketplace\/export\/([^/]+)\/([^/]+)$/);
      if (marketplaceExportMatch && request.method === "GET") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = scopedSnapshot(await storage.loadWorkspaceSnapshot(), session);
        const payload = marketplaceExportPayload(
          marketplaceExportMatch[1],
          decodeURIComponent(marketplaceExportMatch[2]),
          marketplaceCatalogFromSnapshot(snapshot)
        );
        sendJson(response, 200, payload);
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
        const result = await createInvitation(storage, body, session);
        sendJson(response, 201, result);
        return;
      }

      const invitationResendMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/resend$/);
      if (invitationResendMatch && request.method === "POST") {
        if (!hasPermission(session, "members:write")) {
          sendError(response, 403, "Missing members write permission");
          return;
        }
        const result = await resendInvitation(storage, decodeURIComponent(invitationResendMatch[1]), session);
        sendJson(response, 200, result);
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

      if (request.method === "GET" && url.pathname === "/api/portal-links") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const portalLinks = await listPortalLinks(storage, session);
        sendJson(response, 200, { portalLinks });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/portal-links") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await createPortalLink(storage, body, session);
        sendJson(response, 201, result);
        return;
      }

      const portalLinkEventMatch = url.pathname.match(/^\/api\/portal-links\/([^/]+)\/events$/);
      if (portalLinkEventMatch && request.method === "POST") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const portalLink = await recordPortalLinkEvent(storage, decodeURIComponent(portalLinkEventMatch[1]), body.event, session);
        sendJson(response, 200, { portalLink });
        return;
      }

      const portalLinkRotateMatch = url.pathname.match(/^\/api\/portal-links\/([^/]+)\/rotate$/);
      if (portalLinkRotateMatch && request.method === "POST") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await rotatePortalLink(storage, decodeURIComponent(portalLinkRotateMatch[1]), body, session);
        sendJson(response, 200, result);
        return;
      }

      const portalLinkRevokeMatch = url.pathname.match(/^\/api\/portal-links\/([^/]+)\/revoke$/);
      if (portalLinkRevokeMatch && request.method === "POST") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const portalLink = await revokePortalLink(storage, decodeURIComponent(portalLinkRevokeMatch[1]), session);
        sendJson(response, 200, { portalLink });
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
        const filters = scopedRecordFilters(session, recordFiltersFromUrl(url));
        const pageFilters = {
          ...filters,
          limit: clampInteger(url.searchParams.get("limit"), 1, 500, 100),
          offset: clampInteger(url.searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER, 0)
        };
        const result = typeof storage.loadRecordPage === "function"
          ? await storage.loadRecordPage(collectionKey, pageFilters)
          : paginateItems(await storage.loadRecords(collectionKey, filters), url.searchParams);
        sendJson(response, 200, {
          collection: collectionKey,
          records: result.records || result.items || [],
          page: result.page
        });
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
        const result = queryProjects(Array.isArray(snapshot.projects) ? snapshot.projects : [], url.searchParams);
        sendJson(response, 200, { projects: result.items, page: result.page });
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
        const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
        const result = queryTasks(Array.isArray(snapshot.tasks) ? snapshot.tasks : [], projects, url.searchParams);
        sendJson(response, 200, { tasks: result.items, page: result.page });
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

      if (request.method === "POST" && url.pathname === "/api/feature-requests") {
        if (!hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing tasks write permission");
          return;
        }
        const body = await readJsonBody(request);
        const task = await upsertTask(storage, body.task || body, session, "feature_request");
        const email = await deliverFeatureRequest({ task, request: body.request || {}, session });
        sendJson(response, 201, { task, email });
        return;
      }

      const featureRequestUpdateMatch = url.pathname.match(/^\/api\/feature-requests\/([^/]+)\/updates$/);
      if (featureRequestUpdateMatch && request.method === "POST") {
        if (!hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing tasks write permission");
          return;
        }
        const body = await readJsonBody(request);
        const result = await updateFeatureRequestStatus(storage, decodeURIComponent(featureRequestUpdateMatch[1]), body, session);
        sendJson(response, 200, result);
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
          sendJson(response, 200, publicWorkspaceDocument(document, session));
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
        sendJson(response, 200, publicWorkspaceDocument(document, session));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/workspace/import") {
        if (!hasPermission(session, "workspace:import")) {
          sendError(response, 403, "Missing workspace import permission");
          return;
        }
        const body = await readJsonBody(request);
        const document = await saveWorkspaceSnapshot(storage, body.snapshot || body, session, "workspace_import");
        sendJson(response, 200, publicWorkspaceDocument(document, session));
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
  const supabaseUrl = cleanString(process.env.SUPABASE_URL || process.env.AGORA_SUPABASE_URL);
  const supabaseAnonKey = cleanString(process.env.SUPABASE_ANON_KEY || process.env.AGORA_SUPABASE_ANON_KEY);
  const supabaseServiceKey = cleanString(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AGORA_SUPABASE_SERVICE_ROLE_KEY);
  const bucket = supabaseStorageBucket();
  const wantsSupabaseStorage = storageDriver === "supabase";
  const wantsSupabaseAuth = authDriver === "supabase";
  const productionTarget = wantsSupabaseStorage || wantsSupabaseAuth;
  const configuredAllowedOrigins = allowedOrigins();
  const passwordResetDelivery = cleanString(process.env.AGORA_PASSWORD_RESET_DELIVERY || "").toLowerCase();
  const exposesResetToken = envFlag("AGORA_PASSWORD_RESET_RETURN_TOKEN", false) || passwordResetDelivery === "manual";
  const demoAuthEnabled = envFlag("AGORA_DEMO_AUTH", false);
  const passwordlessAuthEnabled = envFlag("AGORA_PASSWORDLESS_AUTH", false);
  const trustProxy = envFlag("AGORA_TRUST_PROXY", false);
  const strictCsp = envFlag("AGORA_STRICT_CSP", false) || cleanString(process.env.NODE_ENV).toLowerCase() === "production";
  const publicAppUrl = cleanString(process.env.AGORA_PUBLIC_APP_URL || process.env.AGORA_APP_URL);
  const publicAppUrlHosted = /^https:\/\//i.test(publicAppUrl) && !/localhost|127\.0\.0\.1|\[::1\]/i.test(publicAppUrl);
  const publicFeatureBodyLimitKb = Math.round(PUBLIC_FEATURE_BODY_LIMIT_BYTES / 1024);
  const email = emailDeliveryDiagnostics();
  const notificationDelivery = notificationDeliveryAudit(email);
  const snapshotDocument = await storage.loadWorkspace();
  const snapshot = snapshotDocument?.snapshot || {};
  const githubRepositories = Array.isArray(snapshot.workspace?.integrations?.github?.repositories)
    ? snapshot.workspace.integrations.github.repositories
    : [];
  const githubConfigured = githubRepositories.length > 0;
  const githubWebhookSecretConfigured = Boolean(githubWebhookSecret());
  const githubWebhookSecretMandatory = githubWebhookSecretRequired(storage);
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
  const productionGates = [
    {
      id: "allowed-origins",
      label: "Allowed origins",
      done: !productionTarget || configuredAllowedOrigins.size > 0,
      detail: configuredAllowedOrigins.size
        ? `${configuredAllowedOrigins.size} browser origin${configuredAllowedOrigins.size === 1 ? "" : "s"} allowed`
        : productionTarget ? "No production browser origins configured" : "Localhost origins are allowed for development",
      fix: "Set AGORA_ALLOWED_ORIGINS to the exact hosted app origin before exposing the API."
    },
    {
      id: "public-app-url",
      label: "Public app URL",
      done: !productionTarget || publicAppUrlHosted,
      detail: publicAppUrl
        ? publicAppUrlHosted ? publicAppUrl : `${publicAppUrl} is not a hosted HTTPS URL`
        : productionTarget ? "No public app URL configured" : "Local app URL is acceptable for development",
      fix: "Set AGORA_PUBLIC_APP_URL to the HTTPS app URL used by invite, reset, and feature-request emails."
    },
    {
      id: "auth-entrypoints",
      label: "Auth entrypoints",
      done: !demoAuthEnabled && !passwordlessAuthEnabled,
      detail: demoAuthEnabled || passwordlessAuthEnabled
        ? "Demo or passwordless auth is enabled"
        : "Demo and passwordless auth are disabled",
      fix: "Keep AGORA_DEMO_AUTH=false and AGORA_PASSWORDLESS_AUTH=false outside trusted demos."
    },
    {
      id: "password-reset-delivery",
      label: "Password reset delivery",
      done: !productionTarget || ((passwordResetDelivery === "smtp" || passwordResetDelivery === "webhook") && !exposesResetToken),
      detail: passwordResetDelivery
        ? `${passwordResetDelivery} delivery${exposesResetToken ? " with browser token return" : ""}`
        : productionTarget ? "No reset delivery configured" : "Manual reset delivery is acceptable for local development",
      fix: "Use AGORA_PASSWORD_RESET_DELIVERY=smtp or webhook and keep AGORA_PASSWORD_RESET_RETURN_TOKEN=false for hosted production."
    },
    {
      id: "email-delivery",
      label: "Team email delivery",
      done: !productionTarget || (email.smtp.configured && email.from.configured && email.invitations.configured && email.featureRequests.configured && email.portalActions.configured),
      detail: email.smtp.configured
        ? `SMTP configured for invites, feedback, and portal actions${email.featureRequests.configured && email.portalActions.configured ? "" : "; owner recipient missing"}`
        : productionTarget ? "SMTP is not configured for invites, feature request, or portal action emails" : "SMTP is optional for local development",
      fix: "Set AGORA_SMTP_HOST, AGORA_EMAIL_FROM, and AGORA_PORTAL_ACTION_EMAIL or AGORA_FEATURE_REQUEST_EMAIL before inviting a real team."
    },
    {
      id: "public-feature-abuse",
      label: "Public feature abuse limits",
      done: !publicFeatureRequestsEnabled() || (PUBLIC_FEATURE_BODY_LIMIT_BYTES <= 64 * 1024 && PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS <= 20 && PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS <= 10),
      detail: publicFeatureRequestsEnabled()
        ? `${PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS} IP attempts, ${PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS} email attempts, ${publicFeatureBodyLimitKb}KB body cap`
        : "Public feature requests are disabled",
      fix: "Keep public request body, IP, and email rate limits low before sharing the public feedback URL."
    },
    {
      id: "strict-csp",
      label: "Strict CSP",
      done: !productionTarget || strictCsp,
      detail: strictCsp
        ? "Strict production CSP mode is enabled"
        : productionTarget ? "Strict CSP is not enabled for this hosted target" : "Development CSP allows local tooling",
      fix: "Set AGORA_STRICT_CSP=true or NODE_ENV=production for hosted app/static servers."
    },
    {
      id: "proxy-rate-limit-source",
      label: "Rate-limit IP source",
      done: true,
      detail: trustProxy
        ? "Trusted proxy mode reads X-Forwarded-For"
        : "Rate limits use the direct socket address",
      fix: "Only set AGORA_TRUST_PROXY=true behind a proxy that overwrites untrusted X-Forwarded-For headers."
    },
    {
      id: "github-webhook-secret",
      label: "GitHub webhook secret",
      done: !githubConfigured || !githubWebhookSecretMandatory || githubWebhookSecretConfigured,
      detail: githubConfigured
        ? githubWebhookSecretConfigured ? "GitHub webhook signatures are enforced" : githubWebhookSecretMandatory ? "GitHub webhook secret is missing" : "GitHub webhooks are unsigned in local mode"
        : "GitHub repositories are not mapped yet",
      fix: "Set AGORA_GITHUB_WEBHOOK_SECRET to the GitHub webhook secret before enabling production GitHub intake."
    }
  ];
  const readiness = [
    {
      id: "storage-driver",
      label: "Storage driver",
      done: Boolean(storageDriver),
      detail: wantsSupabaseStorage ? "Supabase adapter is active" : "Local JSON storage is active",
      fix: wantsSupabaseStorage
        ? "If records fail, confirm SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and migration 001."
        : "Set AGORA_STORAGE_DRIVER=supabase when you are ready to verify hosted persistence."
    },
    {
      id: "auth-driver",
      label: "Authentication driver",
      done: Boolean(authDriver),
      detail: wantsSupabaseAuth ? "Supabase Auth bearer tokens are accepted" : "Local/demo auth is active",
      fix: wantsSupabaseAuth
        ? "If sign-in fails, confirm SUPABASE_ANON_KEY and migration 002."
        : "Set AGORA_AUTH_DRIVER=supabase for hosted email/password auth and bearer-token exchange."
    },
    {
      id: "workspace-snapshot",
      label: "Workspace snapshot",
      done: Boolean(snapshotDocument?.snapshot),
      detail: snapshotDocument?.metadata?.updatedAt ? `Last saved ${snapshotDocument.metadata.updatedAt}` : "No saved API snapshot yet",
      fix: "Save the workspace from Settings or Data after connecting to the API."
    },
    {
      id: "structured-records",
      label: "Structured records",
      done: failedCollections.length === 0,
      detail: failedCollections.length
        ? `${failedCollections.length} collection${failedCollections.length === 1 ? "" : "s"} need attention`
        : `${collectionReports.length} collections are reachable`,
      fix: failedCollections.length
        ? `Check migration 001 and service-role table access. First failing collection: ${failedCollections[0]?.label || failedCollections[0]?.key}.`
        : "Structured collection reads are passing."
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
      detail: "Demo and passwordless auth are opt-in, sessions expire, and public auth endpoints are rate limited",
      fix: "Keep AGORA_DEMO_AUTH=false and AGORA_PASSWORDLESS_AUTH=false outside trusted demos."
    },
    {
      id: "file-uploads",
      label: "File uploads",
      done: true,
      detail: wantsSupabaseStorage
        ? `Supabase Storage bucket ${bucket} is configured for uploads`
        : "Local API uploads are stored outside browser local storage",
      fix: wantsSupabaseStorage
        ? `Create a private Supabase Storage bucket named ${bucket}, then run npm run test:supabase.`
        : "Set AGORA_SUPABASE_STORAGE_BUCKET when switching uploads to Supabase."
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
        : "Scheduler endpoints are available for cron or manual runs",
      fix: "Use AGORA_SCHEDULER_ENABLED=true for the API worker, or call the scheduler endpoint from trusted cron."
    },
    {
      id: "notification-delivery-map",
      label: "Notification delivery map",
      done: notificationDelivery.matrix.length >= 8,
      detail: `${notificationDelivery.matrix.length} notification route${notificationDelivery.matrix.length === 1 ? "" : "s"} mapped across in-app, scheduler, and email delivery`,
      fix: "Keep this route map current whenever a new notification event or email workflow is added."
    },
    {
      id: "notification-email-routes",
      label: "Notification email routes",
      done: !productionTarget || notificationDelivery.ready,
      detail: notificationDelivery.ready
        ? "Production email routes have their required SMTP and recipient settings"
        : `${notificationDelivery.blockers.length} email route${notificationDelivery.blockers.length === 1 ? "" : "s"} need configuration`,
      fix: notificationDelivery.blockers[0]?.fix || "Set SMTP and owner-recipient environment variables before relying on external notification email."
    },
    {
      id: "github-webhook-intake",
      label: "GitHub webhook intake",
      done: !githubConfigured || (!githubWebhookSecretMandatory || githubWebhookSecretConfigured),
      detail: githubConfigured
        ? `${githubRepositories.length} mapped repo${githubRepositories.length === 1 ? "" : "s"}; ${githubWebhookSecretConfigured ? "secret configured" : githubWebhookSecretMandatory ? "secret required" : "secret optional locally"}; replay protection enabled`
        : "No GitHub repositories mapped",
      fix: "Map each GitHub repository to an Agora project and set AGORA_GITHUB_WEBHOOK_SECRET before production."
    },
    {
      id: "record-query-api",
      label: "Record query API",
      done: true,
      detail: "Projects and tasks support paginated server-side query routes",
      fix: "Use /api/projects and /api/tasks with limit, offset, and filter params before falling back to workspace snapshots."
    },
    {
      id: "background-jobs",
      label: "Background jobs",
      done: backgroundJobs.length < BACKGROUND_JOB_MAX_QUEUE,
      detail: `${backgroundJobs.length}/${BACKGROUND_JOB_MAX_QUEUE} queued, ${backgroundJobHistory.filter((job) => job.status === "failed").length} recent failed`,
      fix: "If queued jobs keep growing, move the in-process queue to a durable worker."
    },
    {
      id: "team-email",
      label: "Team email",
      done: email.smtp.configured && email.from.configured,
      detail: email.smtp.configured ? "SMTP can queue invite, feature request, portal action, and requester update emails" : "SMTP is not configured yet",
      fix: "Set AGORA_SMTP_HOST, AGORA_SMTP_PORT, AGORA_EMAIL_FROM, and SMTP credentials when your provider requires auth."
    },
    ...productionGates,
    {
      id: "production-mode",
      label: "Production mode",
      done: wantsSupabaseStorage && wantsSupabaseAuth,
      detail: wantsSupabaseStorage && wantsSupabaseAuth
        ? "Supabase storage and Supabase Auth are both active"
        : "Set AGORA_STORAGE_DRIVER=supabase and AGORA_AUTH_DRIVER=supabase for production mode",
      fix: "After changing drivers, restart npm run dev:api, sign in again, refresh Backend Health, then run npm run test:supabase."
    },
    {
      id: "supabase-environment",
      label: "Supabase environment",
      done: !wantsSupabaseStorage && !wantsSupabaseAuth ? true : Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceKey),
      detail: !wantsSupabaseStorage && !wantsSupabaseAuth
        ? "Supabase credentials are not required for local JSON mode"
        : `${supabaseUrl ? "URL set" : "URL missing"} / ${supabaseAnonKey ? "anon key set" : "anon key missing"} / ${supabaseServiceKey ? "service role set" : "service role missing"}`,
      fix: "Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env. Keep the service role key server-only."
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
    productionGates,
    snapshot: {
      exists: Boolean(snapshotDocument?.snapshot),
      metadata: snapshotDocument?.metadata || null,
      counts: snapshotCounts
    },
    records: collectionReports,
    readiness,
    email,
    notificationDelivery,
    observability: requestMetricsSnapshot(),
    jobs: backgroundJobSnapshot(),
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

async function loadAutomationRules(storage, session = null) {
  const [snapshot, recordRules] = await Promise.all([
    storage.loadWorkspaceSnapshot(),
    storage.loadRecords("automationRules", session ? scopedRecordFilters(session, {}) : {})
  ]);
  const snapshotRules = Array.isArray(snapshot.automations) ? snapshot.automations : [];
  const rules = new Map();
  snapshotRules.forEach((rule) => {
    const normalized = normalizeAutomationRuleRecord({ ...rule, source: rule.source || "workspace" });
    rules.set(normalized.id, { ...normalized, storageSource: "snapshot" });
  });
  recordRules.forEach((rule) => {
    const normalized = normalizeAutomationRuleRecord({ ...rule, source: rule.source || "api" });
    rules.set(normalized.id, { ...normalized, storageSource: "record" });
  });
  return Array.from(rules.values()).filter((rule) => rule.enabled);
}

async function runAutomationRules(storage, options = {}) {
  const now = new Date().toISOString();
  const actorId = options.actorId || "automation";
  const source = options.source || "server";
  const context = { ...(options.context || {}), session: options.session || null };
  const requestedTrigger = cleanString(options.triggerKind);
  const requestedRuleId = cleanString(options.ruleId);
  const rules = (await loadAutomationRules(storage, options.session || null))
    .filter((rule) => !requestedRuleId || rule.id === requestedRuleId)
    .filter((rule) => !requestedTrigger || rule.triggerKind === requestedTrigger)
    .filter((rule) => automationRuleMatchesContext(rule, context));
  const runs = [];
  const changed = {
    tasks: [],
    activities: [],
    history: [],
    reminders: [],
    rules: []
  };

  for (const rule of rules) {
    const result = await applyAutomationRule(storage, rule, { ...context, actorId, source, now });
    const run = await recordAutomationRun(storage, rule, {
      actorId,
      source,
      status: "applied",
      changedCount: result.changedCount,
      triggerKind: rule.triggerKind,
      summary: result.summary || `${rule.name} ran`,
      createdAt: now
    });
    const stampedRule = await stampAutomationRuleRun(storage, rule, now);
    runs.push(run);
    changed.rules.push(stampedRule);
    changed.tasks.push(...result.tasks);
    changed.activities.push(...result.activities);
    changed.history.push(...result.history);
    changed.reminders.push(...result.reminders);
  }

  if (runs.length) {
    await storage.appendAuditEvent({
      actorId,
      action: "automation_rules_run",
      workspaceId: workspace.id,
      detail: `${source} ran ${runs.length} automation rule${runs.length === 1 ? "" : "s"}`,
      metadata: { triggerKind: requestedTrigger || "", changedCount: changed.tasks.length + changed.activities.length + changed.history.length + changed.reminders.length }
    });
  }

  return {
    ok: true,
    processed: runs.length,
    changedCount: changed.tasks.length + changed.activities.length + changed.history.length + changed.reminders.length,
    runs,
    ...changed,
    generatedAt: now
  };
}

function automationRuleMatchesContext(rule, context = {}) {
  if (!rule.enabled) return false;
  if (context.triggerKind && rule.triggerKind !== context.triggerKind) return false;
  if (!context.triggerKind && ["portal_feature_request", "portal_approval", "portal_comment", "import_completed"].includes(rule.triggerKind)) return false;
  if (rule.conditionKind === "any") return true;
  const value = rule.conditionValue.toLowerCase();
  if (!value) return true;
  const task = context.task || {};
  const project = context.project || {};
  const approval = context.approval || {};
  const link = context.link || {};
  if (rule.conditionKind === "project") return [task.projectId, project.id, approval.projectId, project.name].some((item) => cleanString(item).toLowerCase().includes(value));
  if (rule.conditionKind === "assignee") return [task.assignee, approval.owner, project.owner].some((item) => cleanString(item).toLowerCase().includes(value));
  if (rule.conditionKind === "company") return [project.companyId, approval.companyId, link.companyId, context.companyId, project.companyName].some((item) => cleanString(item).toLowerCase().includes(value));
  if (rule.conditionKind === "priority") return cleanString(task.priority || context.priority).toLowerCase() === value;
  if (rule.conditionKind === "tag") return Array.isArray(task.tags) && task.tags.some((tag) => cleanString(tag).toLowerCase() === value);
  return true;
}

async function applyAutomationRule(storage, rule, context = {}) {
  if (rule.triggerKind === "task_due_soon") return applyTaskScanAutomation(storage, rule, context, (task) => task.dueDate && daysFromToday(task.dueDate) >= 0 && daysFromToday(task.dueDate) <= 7);
  if (rule.triggerKind === "task_blocked") return applyTaskScanAutomation(storage, rule, context, (task) => Array.isArray(task.blockedBy) && task.blockedBy.length > 0);
  if (rule.triggerKind === "approval_pending") return applyApprovalScanAutomation(storage, rule, context);
  return applyAutomationAction(storage, rule, context);
}

async function applyTaskScanAutomation(storage, rule, context, predicate) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects.map(normalizeProject) : [];
  const tasks = (Array.isArray(snapshot.tasks) ? snapshot.tasks : [])
    .map(normalizeTask)
    .filter((task) => !task.archivedAt && task.status !== "done")
    .filter(predicate)
    .filter((task) => automationRuleMatchesContext(rule, {
      ...context,
      task,
      project: projects.find((project) => project.id === task.projectId) || {}
    }))
    .slice(0, 10);
  return applyAutomationActionToMany(storage, rule, context, tasks.map((task) => ({
    task,
    project: projects.find((project) => project.id === task.projectId) || {}
  })));
}

async function applyApprovalScanAutomation(storage, rule, context) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects.map(normalizeProject) : [];
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [];
  const approvals = (await storage.loadRecords("approvals", context.session ? scopedRecordFilters(context.session, {}) : {}))
    .map(normalizeApproval)
    .filter((approval) => approval.status !== "approved")
    .filter((approval) => automationRuleMatchesContext(rule, {
      ...context,
      approval,
      task: tasks.find((task) => task.id === approval.taskId) || {},
      project: projects.find((project) => project.id === approval.projectId) || {}
    }))
    .slice(0, 10);
  return applyAutomationActionToMany(storage, rule, context, approvals.map((approval) => ({
    approval,
    task: tasks.find((task) => task.id === approval.taskId) || tasks.find((task) => task.projectId === approval.projectId) || {},
    project: projects.find((project) => project.id === approval.projectId) || {}
  })));
}

async function applyAutomationActionToMany(storage, rule, context, items) {
  const total = { changedCount: 0, tasks: [], activities: [], history: [], reminders: [], summary: `${rule.name} ran` };
  for (const item of items) {
    const result = await applyAutomationAction(storage, rule, { ...context, ...item });
    total.changedCount += result.changedCount;
    total.tasks.push(...result.tasks);
    total.activities.push(...result.activities);
    total.history.push(...result.history);
    total.reminders.push(...result.reminders);
  }
  total.summary = `${rule.name} changed ${total.changedCount} item${total.changedCount === 1 ? "" : "s"}`;
  return total;
}

async function applyAutomationAction(storage, rule, context = {}) {
  const result = { changedCount: 0, tasks: [], activities: [], history: [], reminders: [], summary: `${rule.name} ran` };
  if (rule.actionKind === "create_task") {
    const task = await automationCreateTask(storage, rule, context);
    if (task) {
      result.tasks.push(task);
      result.changedCount += 1;
      result.summary = `Created ${task.title}`;
    }
    return result;
  }
  if (rule.actionKind === "set_risk" || rule.actionKind === "set_priority") {
    const task = await automationUpdateTask(storage, rule, context);
    if (task) {
      result.tasks.push(task);
      result.changedCount += 1;
      result.summary = `Updated ${task.title}`;
    }
    return result;
  }
  if (rule.actionKind === "schedule_reminder") {
    const reminder = await automationScheduleReminder(storage, rule, context);
    if (reminder) {
      result.reminders.push(reminder);
      result.changedCount += 1;
      result.summary = `Scheduled ${reminder.title}`;
    }
    return result;
  }
  if (rule.actionKind === "notify_channel") {
    const history = await automationNotify(storage, rule, context);
    result.history.push(history);
    result.changedCount += 1;
    result.summary = `Recorded notification ${history.title}`;
    return result;
  }
  const activity = await automationRecordActivity(storage, rule, context);
  result.activities.push(activity);
  result.changedCount += 1;
  result.summary = `Recorded activity ${activity.message}`;
  return result;
}

async function automationCreateTask(storage, rule, context = {}) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects.map(normalizeProject) : [];
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [];
  const sourceTask = context.task || {};
  const project = projects.find((item) => item.id === sourceTask.projectId)
    || projects.find((item) => item.id === context.project?.id)
    || projects.find((item) => item.companyId === context.link?.companyId)
    || projects.find((item) => !item.archivedAt);
  if (!project) return null;
  const now = context.now || new Date().toISOString();
  const subject = cleanString(context.title || sourceTask.title || context.approval?.title || "portal action");
  const task = normalizeTask({
    id: `automation-task-${crypto.randomUUID()}`,
    projectId: project.id,
    title: `${rule.actionTarget || "Follow up"}: ${subject}`,
    description: `Automation ${rule.name} created this from ${subject}.`,
    assignee: sourceTask.assignee || project.owner || "",
    status: "todo",
    priority: sourceTask.priority || "high",
    tags: ["automation", rule.triggerKind],
    customFields: { automationRuleId: rule.id },
    createdAt: now,
    updatedAt: now
  });
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    tasks: [task, ...tasks.filter((item) => item.id !== task.id)]
  }, {
    storage: storage.driver || "json-file",
    updatedBy: context.actorId || "automation",
    action: "automation_task_create"
  });
  return task;
}

async function automationUpdateTask(storage, rule, context = {}) {
  const sourceTask = context.task?.id ? context.task : null;
  if (!sourceTask) return null;
  const snapshot = await storage.loadWorkspaceSnapshot();
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [];
  const existing = tasks.find((task) => task.id === sourceTask.id);
  if (!existing) return null;
  const now = context.now || new Date().toISOString();
  const target = cleanString(rule.actionTarget) || (rule.actionKind === "set_priority" ? "high" : "High");
  const updated = normalizeTask(rule.actionKind === "set_priority"
    ? { ...existing, priority: target.toLowerCase(), updatedAt: now }
    : { ...existing, customFields: { ...existing.customFields, risk: target }, updatedAt: now });
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    tasks: tasks.map((task) => task.id === updated.id ? updated : task)
  }, {
    storage: storage.driver || "json-file",
    updatedBy: context.actorId || "automation",
    action: "automation_task_update"
  });
  return updated;
}

async function automationRecordActivity(storage, rule, context = {}) {
  const now = context.now || new Date().toISOString();
  return storage.upsertRecord("activities", normalizeActivity({
    id: `automation-activity-${crypto.randomUUID()}`,
    projectId: context.task?.projectId || context.project?.id || context.approval?.projectId || "",
    taskId: context.task?.id || context.approval?.taskId || "",
    memberId: context.task?.assignee || context.project?.owner || "",
    type: "automation_action",
    message: `${rule.name} handled ${automationContextTitle(context)}`,
    createdAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: context.actorId || "automation",
    action: "automation_activity"
  });
}

async function automationNotify(storage, rule, context = {}) {
  const now = context.now || new Date().toISOString();
  return storage.upsertRecord("notificationHistory", normalizeNotificationHistoryEvent({
    id: `notification-history-${crypto.randomUUID()}`,
    memberId: "",
    kind: "automation-notify",
    title: rule.name,
    message: `${rule.actionTarget || "Automation"}: ${automationContextTitle(context)}`,
    reason: `Triggered by ${rule.triggerKind}`,
    count: 1,
    channel: "automation",
    createdAt: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: context.actorId || "automation",
    action: "automation_notification"
  });
}

async function automationScheduleReminder(storage, rule, context = {}) {
  const now = context.now || new Date().toISOString();
  const remindAt = new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return storage.upsertRecord("notificationReminders", normalizeNotificationReminder({
    id: `notification-reminder-${crypto.randomUUID()}`,
    sourceId: rule.id,
    memberId: context.task?.assignee || context.project?.owner || "",
    taskId: context.task?.id || context.approval?.taskId || "",
    approvalId: context.approval?.id || "",
    projectId: context.task?.projectId || context.project?.id || context.approval?.projectId || "",
    companyId: context.link?.companyId || context.project?.companyId || context.approval?.companyId || "",
    title: rule.actionTarget || rule.name,
    message: `Automation reminder for ${automationContextTitle(context)}`,
    remindAt,
    repeat: "none",
    status: "scheduled",
    createdAt: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: context.actorId || "automation",
    action: "automation_reminder"
  });
}

async function recordAutomationRun(storage, rule, input = {}) {
  const now = input.createdAt || new Date().toISOString();
  return storage.upsertRecord("automationRuns", normalizeAutomationRunRecord({
    id: `automation-run-${crypto.randomUUID()}`,
    automationId: rule.id,
    triggerKind: input.triggerKind || rule.triggerKind,
    source: input.source || "server",
    status: input.status || "applied",
    changedCount: input.changedCount,
    summary: input.summary,
    createdAt: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: input.actorId || "automation",
    action: "automation_run"
  });
}

async function stampAutomationRuleRun(storage, rule, now = new Date().toISOString()) {
  const updated = normalizeAutomationRuleRecord({
    ...rule,
    lastRun: now,
    runCount: Number(rule.runCount || 0) + 1,
    updatedAt: now
  });
  if (rule.storageSource === "record") {
    return storage.upsertRecord("automationRules", updated, {
      storage: storage.driver || "json-file",
      updatedBy: "automation",
      action: "automation_rule_run_stamp"
    });
  }
  const snapshot = await storage.loadWorkspaceSnapshot();
  const automations = Array.isArray(snapshot.automations) ? snapshot.automations : [];
  if (automations.some((item) => item.id === rule.id)) {
    await storage.saveWorkspaceSnapshot({
      ...snapshot,
      automations: automations.map((item) => item.id === rule.id ? { ...item, lastRun: now, runCount: updated.runCount } : item)
    }, {
      storage: storage.driver || "json-file",
      updatedBy: "automation",
      action: "automation_rule_run_stamp"
    });
  }
  return updated;
}

function automationContextTitle(context = {}) {
  return cleanString(context.task?.title || context.approval?.title || context.title || context.comment?.body || "matching work").slice(0, 120);
}

function daysFromToday(dateValue) {
  const date = Date.parse(cleanString(dateValue).slice(0, 10));
  if (!Number.isFinite(date)) return Number.POSITIVE_INFINITY;
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  return Math.round((date - today) / (24 * 60 * 60 * 1000));
}

function paymentConfig() {
  return {
    mode: "test",
    testMode: true,
    plans: paymentPlanCatalog(),
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

function paymentPlanCatalog() {
  return [
    {
      id: "free",
      label: "Free",
      priceCents: 0,
      interval: "month",
      limits: { members: 3, projects: 3, entitlements: 1 },
      features: ["Workspace basics", "Public requests", "Manual exports"]
    },
    {
      id: "team",
      label: "Team",
      priceCents: 2900,
      interval: "month",
      limits: { members: 15, projects: 25, entitlements: 10 },
      features: ["Client portal", "Automation runs", "Priority imports"]
    },
    {
      id: "agency",
      label: "Agency",
      priceCents: 9900,
      interval: "month",
      limits: { members: null, projects: null, entitlements: null },
      features: ["Unlimited scale", "Advanced audit", "Dedicated launch support"]
    }
  ];
}

function queryProjects(projects, searchParams) {
  const query = cleanString(searchParams.get("query") || searchParams.get("q")).toLowerCase();
  const companyId = cleanString(searchParams.get("companyId"));
  const includeArchived = envBooleanParam(searchParams.get("includeArchived"), false);
  const filtered = projects
    .filter((project) => includeArchived || !project.archivedAt)
    .filter((project) => !companyId || project.companyId === companyId)
    .filter((project) => {
      if (!query) return true;
      return [project.name, project.description, project.owner, project.companyId]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => cleanString(b.updatedAt || b.createdAt || b.name).localeCompare(cleanString(a.updatedAt || a.createdAt || a.name)));
  return paginateItems(filtered, searchParams);
}

function queryTasks(tasks, projects, searchParams) {
  const query = cleanString(searchParams.get("query") || searchParams.get("q")).toLowerCase();
  const projectId = cleanString(searchParams.get("projectId"));
  const companyId = cleanString(searchParams.get("companyId"));
  const assignee = cleanString(searchParams.get("assignee"));
  const status = cleanString(searchParams.get("status"));
  const priority = cleanString(searchParams.get("priority"));
  const tag = cleanString(searchParams.get("tag"));
  const includeArchived = envBooleanParam(searchParams.get("includeArchived"), false);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const filtered = tasks
    .filter((task) => includeArchived || !task.archivedAt)
    .filter((task) => !projectId || task.projectId === projectId)
    .filter((task) => !companyId || projectById.get(task.projectId)?.companyId === companyId)
    .filter((task) => !assignee || task.assignee === assignee)
    .filter((task) => !status || task.status === status)
    .filter((task) => !priority || task.priority === priority)
    .filter((task) => !tag || (Array.isArray(task.tags) && task.tags.includes(tag)))
    .filter((task) => {
      if (!query) return true;
      const project = projectById.get(task.projectId);
      return [
        task.title,
        task.description,
        task.assignee,
        task.status,
        task.priority,
        Array.isArray(task.tags) ? task.tags.join(" ") : "",
        project?.name,
        project?.companyId
      ].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => cleanString(b.updatedAt || b.createdAt || b.title).localeCompare(cleanString(a.updatedAt || a.createdAt || a.title)));
  return paginateItems(filtered, searchParams);
}

function paginateItems(items, searchParams) {
  const total = items.length;
  const limit = clampInteger(searchParams.get("limit"), 1, 500, 100);
  const offset = clampInteger(searchParams.get("offset"), 0, Math.max(total, 0), 0);
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length;
  return {
    items: pageItems,
    page: {
      limit,
      offset,
      total,
      count: pageItems.length,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null
    }
  };
}

function envBooleanParam(value, fallback = false) {
  const normalized = cleanString(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function marketplaceCatalogFromSnapshot(snapshot = {}) {
  return normalizeMarketplaceCatalog(snapshot.workspace?.marketplace || {});
}

function normalizeMarketplaceCatalog(catalog = {}) {
  return {
    projectTemplates: Array.isArray(catalog.projectTemplates)
      ? catalog.projectTemplates.map(normalizeMarketplaceProjectTemplate).filter(Boolean).slice(0, 200)
      : [],
    automationPacks: Array.isArray(catalog.automationPacks)
      ? catalog.automationPacks.map(normalizeMarketplaceAutomationPack).filter(Boolean).slice(0, 200)
      : [],
    updatedAt: cleanString(catalog.updatedAt),
    updatedBy: cleanString(catalog.updatedBy)
  };
}

async function publishMarketplaceCatalog(storage, body = {}, session) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const existing = marketplaceCatalogFromSnapshot(snapshot);
  const incomingTemplates = Array.isArray(body.projectTemplates) ? body.projectTemplates : [];
  const incomingAutomationPacks = Array.isArray(body.automationPacks) ? body.automationPacks : [];
  const projectTemplates = mergeMarketplaceItems(
    existing.projectTemplates,
    incomingTemplates.map(normalizeMarketplaceProjectTemplate).filter(Boolean)
  );
  const automationPacks = mergeMarketplaceItems(
    existing.automationPacks,
    incomingAutomationPacks.map(normalizeMarketplaceAutomationPack).filter(Boolean)
  );
  if (!incomingTemplates.length && !incomingAutomationPacks.length) {
    publicError(400, "Publish at least one project template or automation pack");
  }

  const now = new Date().toISOString();
  const catalog = {
    projectTemplates,
    automationPacks,
    updatedAt: now,
    updatedBy: session.user.id
  };
  const nextSnapshot = {
    ...snapshot,
    workspace: {
      ...workspace,
      ...(snapshot.workspace || {}),
      marketplace: catalog
    }
  };
  await storage.saveWorkspaceSnapshot(nextSnapshot, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "marketplace_catalog_publish"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "marketplace_catalog_publish",
    workspaceId: workspace.id,
    detail: `${session.user.name} published ${incomingTemplates.length} project template${incomingTemplates.length === 1 ? "" : "s"} and ${incomingAutomationPacks.length} automation pack${incomingAutomationPacks.length === 1 ? "" : "s"}`
  });
  return {
    catalog,
    published: {
      projectTemplates: incomingTemplates.length,
      automationPacks: incomingAutomationPacks.length
    }
  };
}

function mergeMarketplaceItems(existing = [], incoming = []) {
  const byId = new Map();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values()).slice(0, 200);
}

function normalizeMarketplaceProjectTemplate(template = {}) {
  const source = template.template && typeof template.template === "object" ? template.template : template;
  const name = cleanString(source.name).slice(0, 120);
  if (!name) return null;
  const tasks = Array.isArray(source.tasks) ? source.tasks : [];
  if (!tasks.length) return null;
  return {
    id: cleanString(source.id) || `template-${slugFromName(name)}`,
    name,
    category: cleanString(source.category || "Community").slice(0, 80),
    description: cleanString(source.description || `Community template for ${name}`).slice(0, 320),
    owner: cleanString(source.owner || source.creatorId || "marketplace"),
    creatorName: cleanString(source.creatorName || sessionlessCreatorName(source)).slice(0, 96),
    durationDays: boundedInteger(source.durationDays || 14, 1, 365),
    priceCents: Math.max(0, Math.round(Number(source.priceCents) || 0)),
    currency: paymentCurrency(source.currency),
    payout: normalizePaymentPayout(source.payout || source),
    tasks: tasks.slice(0, 80).map((task, index) => ({
      key: cleanString(task.key || `task-${index + 1}`).slice(0, 80),
      title: cleanString(task.title || `Task ${index + 1}`).slice(0, 160),
      description: cleanString(task.description).slice(0, 1000),
      assignee: cleanString(task.assignee || "mara").slice(0, 80),
      priority: ["urgent", "high", "normal", "low"].includes(task.priority) ? task.priority : "normal",
      startOffset: boundedInteger(task.startOffset, 0, 365),
      dueOffset: boundedInteger(task.dueOffset ?? task.startOffset ?? 1, 0, 365),
      tags: Array.isArray(task.tags) ? task.tags.map(cleanString).filter(Boolean).slice(0, 8) : [],
      blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy.map(cleanString).filter(Boolean).slice(0, 12) : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(cleanString).filter(Boolean).slice(0, 20) : []
    })),
    milestones: Array.isArray(source.milestones) ? source.milestones.slice(0, 30).map((milestone, index) => ({
      title: cleanString(milestone.title || `Milestone ${index + 1}`).slice(0, 160),
      description: cleanString(milestone.description).slice(0, 1000),
      owner: cleanString(milestone.owner || "mara").slice(0, 80),
      dueOffset: boundedInteger(milestone.dueOffset || 7, 0, 365),
      status: ["planned", "active", "completed"].includes(milestone.status) ? milestone.status : "planned",
      taskKeys: Array.isArray(milestone.taskKeys) ? milestone.taskKeys.map(cleanString).filter(Boolean).slice(0, 20) : []
    })) : [],
    docs: Array.isArray(source.docs) ? source.docs.slice(0, 30).map((document, index) => ({
      title: cleanString(document.title || `Template Doc ${index + 1}`).slice(0, 160),
      type: cleanString(document.type || "Template").slice(0, 80),
      body: cleanString(document.body).slice(0, 10000)
    })) : [],
    intakeForm: source.intakeForm && typeof source.intakeForm === "object" ? {
      title: cleanString(source.intakeForm.title || `${name} Intake`).slice(0, 160),
      assignee: cleanString(source.intakeForm.assignee || "mara").slice(0, 80),
      description: cleanString(source.intakeForm.description || `Capture requests for ${name}.`).slice(0, 1000)
    } : null
  };
}

function normalizeMarketplaceAutomationPack(pack = {}) {
  const source = pack.pack && typeof pack.pack === "object" ? pack.pack : pack;
  const name = cleanString(source.name).slice(0, 120);
  if (!name) return null;
  const rules = Array.isArray(source.rules) ? source.rules : [];
  if (!rules.length) return null;
  const id = cleanString(source.id) || `automation-pack-${slugFromName(name)}`;
  return {
    id,
    name,
    category: cleanString(source.category || "Community").slice(0, 80),
    creatorName: cleanString(source.creatorName || "Community creator").slice(0, 96),
    license: cleanString(source.license || "Community workflow pack").slice(0, 96),
    description: cleanString(source.description || `Community automation pack for ${name}.`).slice(0, 320),
    rules: rules.slice(0, 30).map((rule, index) => ({
      id: cleanString(rule.id || `${id}-${index + 1}`),
      name: cleanString(rule.name || `Rule ${index + 1}`).slice(0, 160),
      trigger: cleanString(rule.trigger || "Task due soon").slice(0, 160),
      action: cleanString(rule.action || "Create follow-up task").slice(0, 160),
      triggerKind: cleanString(rule.triggerKind || "task_due_soon").slice(0, 80),
      conditionKind: cleanString(rule.conditionKind || "any").slice(0, 80),
      conditionValue: cleanString(rule.conditionValue).slice(0, 160),
      actionKind: cleanString(rule.actionKind || "create_task").slice(0, 80),
      actionTarget: cleanString(rule.actionTarget).slice(0, 240),
      enabled: rule.enabled !== false,
      marketplacePackId: id,
      source: "marketplace",
      creatorName: cleanString(source.creatorName || rule.creatorName || "Community creator").slice(0, 96),
      license: cleanString(source.license || rule.license || "Community workflow pack").slice(0, 96)
    }))
  };
}

function marketplaceExportPayload(type, id, catalog) {
  const normalizedType = cleanString(type);
  if (normalizedType === "project-template" || normalizedType === "project-templates") {
    const template = catalog.projectTemplates.find((item) => item.id === id);
    if (!template) publicError(404, "Marketplace project template not found");
    return {
      type: "agora.project-template",
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      template
    };
  }
  if (normalizedType === "automation-pack" || normalizedType === "automation-packs") {
    const pack = catalog.automationPacks.find((item) => item.id === id);
    if (!pack) publicError(404, "Marketplace automation pack not found");
    return {
      type: "agora.automation-pack",
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      pack
    };
  }
  publicError(400, "Unsupported marketplace export type");
}

function sessionlessCreatorName(source = {}) {
  return cleanString(source.creatorName || source.author || source.owner || "Community creator");
}

function slugFromName(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "item";
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

function listActiveSessions(currentSession) {
  const canSeeAll = hasPermission(currentSession, "members:write");
  const activeSessions = Array.from(sessions.values()).filter((item) => {
    if (isSessionExpired(item)) {
      sessions.delete(item.token);
      return false;
    }
    return canSeeAll || item.user.id === currentSession.user.id;
  });

  return {
    sessions: activeSessions.map((item) => publicSessionToken(item, currentSession)),
    scope: canSeeAll ? "workspace" : "self"
  };
}

function revokeActiveSession(currentSession, tokenId) {
  const target = Array.from(sessions.values()).find((item) => sessionTokenId(item.token) === tokenId);
  if (!target || isSessionExpired(target)) {
    if (target) sessions.delete(target.token);
    publicError(404, "Session token not found");
  }

  if (target.user.id !== currentSession.user.id && !hasPermission(currentSession, "members:write")) {
    publicError(403, "Missing members write permission");
  }

  sessions.delete(target.token);
  return {
    ok: true,
    revoked: sessionTokenId(target.token),
    current: target.token === currentSession.token
  };
}

function publicSessionToken(session, currentSession) {
  return {
    id: sessionTokenId(session.token),
    current: session.token === currentSession.token,
    user: session.user,
    membership: {
      role: session.membership.role,
      status: session.membership.status,
      companyId: cleanString(session.membership.companyId)
    },
    permissions: session.permissions,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  };
}

function sessionTokenId(token) {
  return crypto.createHash("sha256").update(cleanString(token)).digest("hex").slice(0, 24);
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

function publicWorkspaceDocument(document = {}, session) {
  return {
    ...document,
    snapshot: publicSnapshot(document.snapshot || {}, session)
  };
}

function publicSnapshot(snapshot = {}, session) {
  const scoped = scopedSnapshot(snapshot, session);
  return {
    ...scoped,
    users: publicUsers(workspaceUsers(scoped)),
    memberships: workspaceMemberships(scoped),
    invitations: workspaceInvitations(scoped)
  };
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

async function deliverFeatureRequest({ task, request, session }) {
  const to = cleanString(process.env.AGORA_FEATURE_REQUEST_EMAIL || process.env.AGORA_OWNER_EMAIL);
  if (!to) {
    return { mode: "not-configured", delivered: false, reason: "Set AGORA_FEATURE_REQUEST_EMAIL to receive feature request emails." };
  }

  const smtpHost = cleanString(process.env.AGORA_SMTP_HOST || process.env.SMTP_HOST);
  if (!smtpHost) {
    return { mode: "not-configured", delivered: false, reason: "Set AGORA_SMTP_HOST to send feature request emails." };
  }

  const payload = featureRequestPayload({ task, request, session, to });
  const job = enqueueBackgroundJob("feature-request-email", () => sendSmtpMail(payload), {
    to,
    taskId: task.id
  }, payload);
  if (job.status === "rejected") return { mode: "smtp", delivered: false, queued: false, jobId: job.id, reason: job.error, to };
  return { mode: "smtp", delivered: false, queued: true, jobId: job.id, to };
}

async function deliverFeatureRequestUpdate({ task, note, session }) {
  const to = cleanString(task.customFields?.requesterEmail);
  if (!to) {
    return { mode: "not-configured", delivered: false, reason: "Requester email is missing." };
  }
  if (!isValidEmailAddress(to)) {
    return { mode: "not-configured", delivered: false, reason: "Requester email is invalid." };
  }

  const smtpHost = cleanString(process.env.AGORA_SMTP_HOST || process.env.SMTP_HOST);
  if (!smtpHost) {
    return { mode: "not-configured", delivered: false, reason: "Set AGORA_SMTP_HOST to send requester update emails." };
  }

  const payload = featureRequestUpdatePayload({ task, note, session, to });
  const job = enqueueBackgroundJob("feature-request-update-email", () => sendSmtpMail(payload), {
    to,
    taskId: task.id
  }, payload);
  if (job.status === "rejected") return { mode: "smtp", delivered: false, queued: false, jobId: job.id, reason: job.error, to };
  return { mode: "smtp", delivered: false, queued: true, jobId: job.id, to };
}

async function deliverPortalActionEmail({ link, actionType, title, message, reason, companyName }) {
  const to = cleanString(process.env.AGORA_PORTAL_ACTION_EMAIL || process.env.AGORA_FEATURE_REQUEST_EMAIL || process.env.AGORA_OWNER_EMAIL);
  if (!to) {
    return { mode: "not-configured", delivered: false, reason: "Set AGORA_PORTAL_ACTION_EMAIL or AGORA_OWNER_EMAIL to receive portal action emails." };
  }
  if (!isValidEmailAddress(to)) {
    return { mode: "not-configured", delivered: false, reason: "Portal action recipient email is invalid." };
  }

  const smtpHost = cleanString(process.env.AGORA_SMTP_HOST || process.env.SMTP_HOST);
  if (!smtpHost) {
    return { mode: "not-configured", delivered: false, reason: "Set AGORA_SMTP_HOST to send portal action emails.", to };
  }

  const payload = portalActionEmailPayload({ link, actionType, title, message, reason, companyName, to });
  const job = enqueueBackgroundJob("portal-action-email", () => sendSmtpMail(payload), {
    to,
    linkId: link.id,
    companyId: link.companyId,
    actionType
  }, payload);
  if (job.status === "rejected") return { mode: "smtp", delivered: false, queued: false, jobId: job.id, reason: job.error, to };
  return { mode: "smtp", delivered: false, queued: true, jobId: job.id, to };
}

async function deliverInvitationEmail({ invitation, session }) {
  if (!invitation?.email) {
    return { mode: "not-configured", delivered: false, reason: "Invitation email is missing." };
  }

  const smtpHost = cleanString(process.env.AGORA_SMTP_HOST || process.env.SMTP_HOST);
  if (!smtpHost) {
    return { mode: "not-configured", delivered: false, reason: "Set AGORA_SMTP_HOST to send invitation emails." };
  }

  const payload = invitationEmailPayload({ invitation, session });
  const job = enqueueBackgroundJob("invitation-email", () => sendSmtpMail(payload), {
    to: invitation.email,
    invitationId: invitation.id
  }, payload);
  if (job.status === "rejected") return { mode: "smtp", delivered: false, queued: false, jobId: job.id, reason: job.error, to: invitation.email };
  return { mode: "smtp", delivered: false, queued: true, jobId: job.id, to: invitation.email };
}

function emailDeliveryDiagnostics() {
  const smtpHost = cleanString(process.env.AGORA_SMTP_HOST || process.env.SMTP_HOST);
  const smtpPort = positiveNumber(process.env.AGORA_SMTP_PORT || process.env.SMTP_PORT, envFlag("AGORA_SMTP_SECURE", false) ? 465 : 587);
  const smtpUser = cleanString(process.env.AGORA_SMTP_USER || process.env.SMTP_USER);
  const from = cleanString(process.env.AGORA_EMAIL_FROM || process.env.SMTP_FROM);
  const featureRecipient = cleanString(process.env.AGORA_FEATURE_REQUEST_EMAIL || process.env.AGORA_OWNER_EMAIL);
  const portalRecipient = cleanString(process.env.AGORA_PORTAL_ACTION_EMAIL || process.env.AGORA_FEATURE_REQUEST_EMAIL || process.env.AGORA_OWNER_EMAIL);
  const resetDelivery = cleanString(process.env.AGORA_PASSWORD_RESET_DELIVERY || "").toLowerCase();
  const resetWebhook = cleanString(process.env.AGORA_PASSWORD_RESET_WEBHOOK_URL);
  const exposesResetToken = envFlag("AGORA_PASSWORD_RESET_RETURN_TOKEN", false) || resetDelivery === "manual";
  const smtpConfigured = Boolean(smtpHost);
  return {
    smtp: {
      configured: smtpConfigured,
      host: smtpConfigured ? smtpHost : "",
      port: smtpPort,
      secure: envFlag("AGORA_SMTP_SECURE", smtpPort === 465),
      startTls: envFlag("AGORA_SMTP_STARTTLS", smtpPort !== 465),
      auth: smtpUser ? "configured" : "none"
    },
    from: {
      configured: Boolean(from),
      address: from ? "configured" : ""
    },
    invitations: {
      configured: smtpConfigured,
      mode: smtpConfigured ? "smtp" : "not-configured",
      detail: smtpConfigured ? "Workspace invitations queue SMTP email." : "Invitation links are created in-app but email is not configured."
    },
    featureRequests: {
      configured: smtpConfigured && Boolean(featureRecipient),
      mode: smtpConfigured && featureRecipient ? "smtp" : "not-configured",
      ownerRecipient: featureRecipient ? "configured" : "",
      detail: featureRecipient ? "Feature request owner email is set." : "Set AGORA_FEATURE_REQUEST_EMAIL for owner notifications."
    },
    portalActions: {
      configured: smtpConfigured && Boolean(portalRecipient),
      mode: smtpConfigured && portalRecipient ? "smtp" : "not-configured",
      ownerRecipient: portalRecipient ? "configured" : "",
      detail: portalRecipient
        ? "Hosted portal action emails are routed to the configured owner recipient."
        : "Set AGORA_PORTAL_ACTION_EMAIL or AGORA_OWNER_EMAIL for portal action emails."
    },
    passwordReset: {
      configured: resetDelivery === "smtp" ? smtpConfigured : resetDelivery === "webhook" ? Boolean(resetWebhook) : false,
      mode: resetDelivery || "not-configured",
      exposesResetToken,
      detail: resetDelivery
        ? `${resetDelivery} delivery${exposesResetToken ? " with browser token return" : ""}`
        : "Password reset delivery is not configured."
    },
    jobs: backgroundJobSnapshot()
  };
}

function notificationDeliveryAudit(email = emailDeliveryDiagnostics()) {
  const smtpReady = Boolean(email.smtp?.configured);
  const inviteReady = Boolean(email.invitations?.configured);
  const featureReady = Boolean(email.featureRequests?.configured);
  const portalReady = Boolean(email.portalActions?.configured);
  const route = ({ id, label, trigger, audience, inApp = true, emailMode = "none", ready = true, detail, fix = "", productionCritical = false }) => ({
    id,
    label,
    trigger,
    audience,
    inApp,
    emailMode,
    ready,
    productionCritical,
    detail,
    fix
  });
  const matrix = [
    route({
      id: "assignment",
      label: "Task assignment",
      trigger: "Task owner or assignee changes",
      audience: "Assigned workspace member",
      emailMode: "in-app",
      detail: "Inbox and browser notification preferences cover assignment signals."
    }),
    route({
      id: "mention-comment",
      label: "Mentions and comments",
      trigger: "Workspace comment or watched task activity",
      audience: "Mentioned or watching members",
      emailMode: "in-app",
      detail: "Comment, mention, and watched-task signals are routed through the in-app inbox."
    }),
    route({
      id: "due-reminder",
      label: "Due dates and reminders",
      trigger: "Manual reminder, due-soon, or overdue scheduler run",
      audience: "Responsible member",
      emailMode: "scheduler",
      detail: "Server scheduler writes reminder history and keeps due work visible."
    }),
    route({
      id: "approval-request",
      label: "Approval request",
      trigger: "Approval moves into requested or needs-changes",
      audience: "Project owner and review participants",
      emailMode: "in-app",
      detail: "Approval signals appear in the inbox and client approval digest."
    }),
    route({
      id: "portal-action",
      label: "Hosted portal action",
      trigger: "Client approves, comments, requests a feature, or opens a portal link",
      audience: "Workspace owner recipient",
      emailMode: portalReady ? "smtp" : "not-configured",
      ready: portalReady,
      productionCritical: true,
      detail: portalReady ? "Portal action owner email is ready." : email.portalActions?.detail || "Portal action email is not configured.",
      fix: "Set AGORA_SMTP_HOST and AGORA_PORTAL_ACTION_EMAIL or AGORA_OWNER_EMAIL."
    }),
    route({
      id: "public-feature-request",
      label: "Public feature request",
      trigger: "Public request form creates a task",
      audience: "Workspace owner recipient",
      emailMode: featureReady ? "smtp" : "not-configured",
      ready: featureReady,
      productionCritical: true,
      detail: featureReady ? "Public feature requests queue owner email." : email.featureRequests?.detail || "Feature request owner email is not configured.",
      fix: "Set AGORA_SMTP_HOST and AGORA_FEATURE_REQUEST_EMAIL or AGORA_OWNER_EMAIL."
    }),
    route({
      id: "feature-request-update",
      label: "Requester update",
      trigger: "Feature request status update includes a requester email",
      audience: "External requester",
      emailMode: smtpReady ? "smtp" : "not-configured",
      ready: smtpReady,
      productionCritical: true,
      detail: smtpReady ? "Requester updates can be emailed when the task has a requester email." : "SMTP is required to send requester updates.",
      fix: "Set AGORA_SMTP_HOST and AGORA_EMAIL_FROM before sending requester updates."
    }),
    route({
      id: "invitation",
      label: "Workspace invitation",
      trigger: "Admin invites or resends a member invite",
      audience: "Invited user",
      emailMode: inviteReady ? "smtp" : "not-configured",
      ready: inviteReady,
      productionCritical: true,
      detail: inviteReady ? "Invitation email can be queued through SMTP." : email.invitations?.detail || "Invitation email is not configured.",
      fix: "Set AGORA_SMTP_HOST and AGORA_EMAIL_FROM before inviting real teams."
    }),
    route({
      id: "digest-handoff",
      label: "Digest handoff",
      trigger: "Manual, daily, or weekly digest run",
      audience: "Configured workspace delivery recipient",
      emailMode: "handoff",
      detail: "The app prepares digest payloads for browser, webhook, and email handoff delivery."
    })
  ];
  const blockers = matrix
    .filter((item) => item.productionCritical && !item.ready)
    .map((item) => ({
      id: item.id,
      label: item.label,
      detail: item.detail,
      fix: item.fix
    }));
  return {
    ready: blockers.length === 0,
    blockers,
    matrix
  };
}

async function sendNotificationTestEmail(body = {}, session) {
  const providedRecipient = cleanString(body.to);
  if (providedRecipient && !isValidEmailAddress(providedRecipient)) {
    publicError(400, "Test email recipient is invalid");
  }
  const to = optionalEmail(providedRecipient) || optionalEmail(session.user.email);
  if (!to) {
    return { mode: "not-configured", delivered: false, reason: "Set an email recipient before sending a test notification." };
  }
  const email = emailDeliveryDiagnostics();
  if (!email.smtp.configured) {
    return { mode: "not-configured", delivered: false, reason: "Set AGORA_SMTP_HOST to send test notification emails." };
  }

  try {
    await sendSmtpMail({
      to,
      from: cleanString(process.env.AGORA_EMAIL_FROM || process.env.SMTP_FROM || "Agora <no-reply@localhost>"),
      subject: "Agora notification test",
      text: [
        "This is a test notification from Agora.",
        "",
        `Workspace: ${workspace.name}`,
        `Sent by: ${session.user.name || session.user.email}`,
        `Generated: ${new Date().toISOString()}`,
        "",
        "If you received this, SMTP delivery is working for Agora notification email."
      ].join("\n")
    });
    return { mode: "smtp", delivered: true };
  } catch (error) {
    return { mode: "smtp", delivered: false, reason: error.publicMessage || error.message || "SMTP test delivery failed." };
  }
}

function featureRequestPayload({ task, request, session, to }) {
  const projectName = cleanString(request.projectName || "");
  const requester = cleanString(request.requester || session.user.name || session.user.email);
  const requesterEmail = cleanString(request.email || session.user.email || "");
  const impact = cleanString(request.impactLabel || request.impact || task.customFields?.impact || "feature-request");
  const details = cleanString(request.details || task.description || "No details provided.");
  return {
    to,
    from: cleanString(process.env.AGORA_EMAIL_FROM || process.env.SMTP_FROM || "Agora <no-reply@localhost>"),
    subject: smtpHeader(`Agora feature request: ${task.title.replace(/^Feature request:\s*/i, "")}`),
    text: [
      "A feature request was submitted in Agora.",
      "",
      `Workspace: ${workspace.name}`,
      `Project: ${projectName || task.projectId}`,
      `Task: ${task.title}`,
      `Task ID: ${task.id}`,
      `Impact: ${impact}`,
      `Submitted by: ${requester}${requesterEmail ? ` <${requesterEmail}>` : ""}`,
      "",
      "Details:",
      details,
      "",
      "The request was also saved as a task on the board."
    ].join("\n")
  };
}

function invitationEmailPayload({ invitation, session }) {
  const appUrl = publicAppBaseUrl();
  const acceptUrl = `${appUrl}/#invite/${encodeURIComponent(invitation.token)}`;
  const invitedBy = session.user.name || session.user.email || "A workspace admin";
  const invitedName = invitation.name || invitation.email;
  return {
    to: invitation.email,
    from: cleanString(process.env.AGORA_EMAIL_FROM || process.env.SMTP_FROM || "Agora <no-reply@localhost>"),
    subject: smtpHeader(`Join ${workspace.name} on Agora`),
    text: [
      `Hi ${invitedName},`,
      "",
      `${invitedBy} invited you to ${workspace.name} on Agora.`,
      "",
      `Role: ${invitation.role}`,
      invitation.companyId ? `Company scope: ${invitation.companyId}` : "Company scope: Workspace-wide",
      `Accept invite: ${acceptUrl}`,
      `Expires: ${invitation.expiresAt || "No expiry set"}`,
      "",
      "If you were not expecting this invitation, you can ignore this email."
    ].join("\n")
  };
}

function featureRequestUpdatePayload({ task, note, session, to }) {
  const status = cleanString(task.customFields?.featureStatusLabel || task.customFields?.featureStatus || "updated");
  const requester = cleanString(task.customFields?.requester || to);
  return {
    to,
    from: cleanString(process.env.AGORA_EMAIL_FROM || process.env.SMTP_FROM || "Agora <no-reply@localhost>"),
    subject: smtpHeader(`Update on your Agora request: ${task.title.replace(/^Feature request:\s*/i, "")}`),
    text: [
      `Hi ${requester},`,
      "",
      `Your feature request is now ${status}.`,
      "",
      cleanString(note) || "No additional note was included.",
      "",
      `Request: ${task.title}`,
      `Updated by: ${session.user.name || session.user.email}`,
      "",
      "Thanks for helping improve Agora."
    ].join("\n")
  };
}

function portalActionEmailPayload({ link, actionType, title, message, reason, companyName, to }) {
  const appUrl = publicAppBaseUrl();
  const portalLabel = cleanString(companyName || link.companyName || link.companyId || "Client portal");
  const actionLabel = cleanString(actionType || "portal-action").replace(/^portal-/, "").replace(/-/g, " ");
  return {
    to,
    from: cleanString(process.env.AGORA_EMAIL_FROM || process.env.SMTP_FROM || "Agora <no-reply@localhost>"),
    subject: smtpHeader(`Agora portal action: ${title || actionLabel}`),
    text: [
      "A hosted client portal action was recorded in Agora.",
      "",
      `Workspace: ${workspace.name}`,
      `Client: ${portalLabel}`,
      `Action: ${actionLabel}`,
      `Portal link: ${link.tokenId || link.id}`,
      `Review: ${appUrl}/#client-portal`,
      "",
      cleanString(message || title || "A client used a hosted portal link."),
      "",
      "Reason:",
      cleanString(reason || "No additional detail was included.")
    ].join("\n")
  };
}

async function publicFeatureRequestConfig(storage) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const companies = Array.isArray(snapshot.companies) ? snapshot.companies : [];
  const projects = (Array.isArray(snapshot.projects) ? snapshot.projects : [])
    .filter((project) => !project.archivedAt)
    .map((project) => ({
      id: String(project.id),
      name: String(project.name || "Untitled project"),
      companyName: companies.find((company) => company.id === project.companyId)?.name || ""
    }));
  return {
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    projects
  };
}

async function createPublicFeatureRequest(storage, body) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = (Array.isArray(snapshot.projects) ? snapshot.projects : []).filter((project) => !project.archivedAt);
  if (!projects.length) publicError(503, "No active projects are available for feature requests.");
  const projectId = cleanString(body.projectId);
  const project = projects.find((item) => item.id === projectId);
  if (!project) publicError(400, "Choose a valid feature request project");
  const title = cleanString(body.title).slice(0, 120);
  if (!title) publicError(400, "Feature request title is required");
  const requesterEmail = optionalEmail(body.email);
  const impact = normalizeFeatureImpact(body.impact);
  const now = new Date().toISOString();
  const request = {
    projectId: project.id,
    projectName: project.name,
    title,
    details: cleanString(body.details).slice(0, 4000),
    requester: cleanString(body.requester).slice(0, 80),
    email: requesterEmail,
    impact,
    impactLabel: featureImpactLabel(impact)
  };
  const task = await upsertTask(storage, {
    id: `feature-public-${crypto.randomUUID()}`,
    projectId: project.id,
    title: `Feature request: ${title}`,
    description: featureRequestDescriptionText(request),
    assignee: project.owner || "",
    status: "todo",
    priority: featureImpactPriority(impact),
    startDate: now.slice(0, 10),
    tags: ["feature-request", "feedback", "public", ...(impact === "bug-regression" ? ["bug"] : [])],
    customFields: {
      requestType: "feature-request",
      featureStatus: "new",
      featureStatusLabel: "New",
      source: "public",
      submittedAt: now,
      requester: request.requester,
      requesterEmail,
      impact: request.impactLabel
    },
    createdAt: now,
    updatedAt: now
  }, featureRequestSystemSession(), "public_feature_request");
  const email = await deliverFeatureRequest({ task, request, session: featureRequestSystemSession() });
  return { task, email };
}

function publicFeatureRequestsEnabled() {
  return envFlag("AGORA_PUBLIC_FEATURE_REQUESTS", false);
}

async function updateFeatureRequestStatus(storage, taskId, body, session) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const task = (Array.isArray(snapshot.tasks) ? snapshot.tasks : []).find((item) => item.id === taskId);
  if (!task) publicError(404, "Feature request not found");
  if (!isFeatureRequestTaskRecord(task)) publicError(400, "Task is not a feature request");
  const project = (Array.isArray(snapshot.projects) ? snapshot.projects : []).find((item) => item.id === task.projectId);
  if (!project) publicError(400, "Feature request project is not in this workspace");
  assertProjectCompanyScope(project, session);

  const featureStatus = normalizeFeatureStatus(body.featureStatus || body.status);
  const now = new Date().toISOString();
  const nextTask = await upsertTask(storage, {
    ...task,
    customFields: {
      ...(task.customFields || {}),
      featureStatus,
      featureStatusLabel: featureStatusLabel(featureStatus),
      lastRequesterUpdate: cleanString(body.note).slice(0, 4000),
      lastRequesterUpdateAt: now
    },
    updatedAt: now
  }, session, "feature_request_update");
  const email = await deliverFeatureRequestUpdate({ task: nextTask, note: body.note, session });
  return { task: nextTask, email };
}

function featureRequestSystemSession() {
  return {
    user: { id: "public-feedback", name: "Public Feedback", email: "" },
    workspace,
    membership: { memberId: "public-feedback", role: "manager", status: "active" },
    permissions: rolePermissions.manager,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
}

function isFeatureRequestTaskRecord(task) {
  return task?.customFields?.requestType === "feature-request" || (Array.isArray(task?.tags) && task.tags.includes("feature-request"));
}

function normalizeFeatureStatus(value) {
  const status = cleanString(value).toLowerCase();
  if (status === "reviewing") return "triaged";
  return ["new", "triaged", "planned", "shipped", "declined"].includes(status) ? status : "new";
}

function featureStatusLabel(status) {
  return {
    new: "New",
    triaged: "Triaged",
    planned: "Planned",
    shipped: "Shipped",
    declined: "Declined"
  }[normalizeFeatureStatus(status)];
}

function normalizeFeatureImpact(value) {
  const impact = cleanString(value).toLowerCase();
  return ["nice-to-have", "workflow-blocker", "revenue-risk", "bug-regression"].includes(impact) ? impact : "nice-to-have";
}

function optionalEmail(value) {
  const email = cleanString(value);
  return isValidEmailAddress(email) ? email : "";
}

function isValidEmailAddress(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanString(value));
}

function featureImpactLabel(impact) {
  return {
    "nice-to-have": "Nice to have",
    "workflow-blocker": "Workflow blocker",
    "revenue-risk": "Revenue risk",
    "bug-regression": "Bug or regression"
  }[normalizeFeatureImpact(impact)];
}

function featureImpactPriority(impact) {
  if (impact === "workflow-blocker" || impact === "bug-regression") return "urgent";
  if (impact === "revenue-risk") return "high";
  return "normal";
}

function featureRequestDescriptionText(request) {
  return [
    `Requester: ${request.requester || "Unknown"}`,
    `Email: ${request.email || "Not provided"}`,
    `Impact: ${featureImpactLabel(request.impact)}`,
    "",
    request.details || "No additional details provided."
  ].join("\n");
}

function passwordResetPayload(user, token, expiresAt) {
  const appUrl = publicAppBaseUrl();
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

function publicAppBaseUrl() {
  return cleanString(process.env.AGORA_PUBLIC_APP_URL || process.env.AGORA_APP_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
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

function smtpHeader(value) {
  return cleanString(value).replace(/[\r\n]+/g, " ").slice(0, 240);
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
  const publicInvite = publicInvitation(nextInvitation);
  const emailDelivery = await deliverInvitationEmail({ invitation: publicInvite, session });
  return { invitation: publicInvite, email: emailDelivery };
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
  const publicInvite = publicInvitation(nextInvitation);
  const emailDelivery = await deliverInvitationEmail({ invitation: publicInvite, session });
  return { invitation: publicInvite, email: emailDelivery };
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

async function listPortalLinks(storage, session) {
  const links = await storage.loadRecords("clientPortalLinks", scopedRecordFilters(session, {}));
  return links
    .map(publicPortalLink)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createPortalLink(storage, body, session, options = {}) {
  const companyId = cleanString(body.companyId);
  const company = await requirePortalCompany(storage, companyId, session);
  const now = new Date().toISOString();
  const token = createPortalToken();
  const link = normalizeClientPortalLinkRecord({
    id: `portal-link-${crypto.randomUUID()}`,
    companyId,
    tokenHash: hashPortalToken(token),
    tokenId: portalTokenId(token),
    status: "active",
    createdBy: session.user.id,
    createdAt: now,
    expiresAt: portalLinkExpiry(body.expiresAt),
    packetSignature: cleanString(body.packetSignature),
    copiedAt: "",
    emailedAt: "",
    viewedAt: "",
    viewCount: 0
  });

  const existingLinks = await storage.loadRecords("clientPortalLinks", scopedRecordFilters(session, { companyId }));
  await Promise.all(existingLinks
    .filter((item) => portalLinkStatus(item) === "active")
    .map((item) => storage.upsertRecord("clientPortalLinks", normalizeClientPortalLinkRecord({
      ...item,
      status: "revoked",
      revokedAt: now,
      updatedAt: now
    }), {
      storage: storage.driver || "json-file",
      updatedBy: session.user.id,
      action: options.revokeAction || "client_portal_link_rotate"
    })));

  const savedLink = await storage.upsertRecord("clientPortalLinks", link, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: options.action || "client_portal_link_generate"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: options.action || "client_portal_link_generate",
    workspaceId: workspace.id,
    detail: `${session.user.name} ${options.verb || "generated"} a hosted portal link for ${company.name}`,
    metadata: { companyId, linkId: savedLink.id, tokenId: savedLink.tokenId, expiresAt: savedLink.expiresAt }
  });
  broadcastRealtimeEvent({
    type: "record",
    collection: "clientPortalLinks",
    action: options.action || "client_portal_link_generate",
    id: savedLink.id,
    companyId,
    actorId: session.user.id
  });
  return { portalLink: publicPortalLink(savedLink), token };
}

async function rotatePortalLink(storage, linkId, body, session) {
  const existingLink = await getPortalLinkRecord(storage, linkId, session);
  return createPortalLink(storage, {
    companyId: existingLink.companyId,
    expiresAt: body.expiresAt,
    packetSignature: cleanString(body.packetSignature) || existingLink.packetSignature
  }, session, {
    action: "client_portal_link_rotate",
    verb: "rotated"
  });
}

async function revokePortalLink(storage, linkId, session) {
  const link = await getPortalLinkRecord(storage, linkId, session);
  if (portalLinkStatus(link) === "revoked") return publicPortalLink(link);
  const now = new Date().toISOString();
  const savedLink = await storage.upsertRecord("clientPortalLinks", normalizeClientPortalLinkRecord({
    ...link,
    status: "revoked",
    revokedAt: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "client_portal_link_revoke"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "client_portal_link_revoke",
    workspaceId: workspace.id,
    detail: `${session.user.name} revoked a hosted portal link`,
    metadata: { companyId: savedLink.companyId, linkId: savedLink.id, tokenId: savedLink.tokenId }
  });
  return publicPortalLink(savedLink);
}

async function recordPortalLinkEvent(storage, linkId, event, session) {
  const normalizedEvent = cleanString(event);
  const fieldsByEvent = {
    copied: "copiedAt",
    emailed: "emailedAt"
  };
  const field = fieldsByEvent[normalizedEvent];
  if (!field) publicError(400, "Portal link event is invalid");
  const link = await getPortalLinkRecord(storage, linkId, session);
  const now = new Date().toISOString();
  const savedLink = await storage.upsertRecord("clientPortalLinks", normalizeClientPortalLinkRecord({
    ...link,
    [field]: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: `client_portal_link_${normalizedEvent}`
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: `client_portal_link_${normalizedEvent}`,
    workspaceId: workspace.id,
    detail: `${session.user.name} ${normalizedEvent} a hosted portal link`,
    metadata: { companyId: savedLink.companyId, linkId: savedLink.id, tokenId: savedLink.tokenId }
  });
  return publicPortalLink(savedLink);
}

async function validatePortalLink(storage, token) {
  const link = await activePortalLinkFromToken(storage, token);
  const now = new Date().toISOString();
  const savedLink = await storage.upsertRecord("clientPortalLinks", normalizeClientPortalLinkRecord({
    ...link,
    viewedAt: now,
    viewCount: Number(link.viewCount || 0) + 1,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: "portal-link",
    action: "client_portal_link_view"
  });
  await storage.appendAuditEvent({
    actorId: "portal-link",
    action: "client_portal_link_view",
    workspaceId: workspace.id,
    detail: "A hosted portal link was viewed",
    metadata: { companyId: savedLink.companyId, linkId: savedLink.id, tokenId: savedLink.tokenId }
  });
  return {
    portalLink: publicPortalLink(savedLink),
    portalSnapshot: await publicPortalSnapshotForLink(storage, savedLink)
  };
}

async function activePortalLinkFromToken(storage, token) {
  const tokenHash = hashPortalToken(token);
  if (!tokenHash) publicError(404, "Portal link not found");
  const links = await storage.loadRecords("clientPortalLinks", { tokenHash });
  const link = links.find((item) => item.tokenHash === tokenHash);
  if (!link) publicError(404, "Portal link not found");
  const status = portalLinkStatus(link);
  if (status !== "active") publicError(status === "expired" ? 410 : 403, `Portal link is ${status}`);
  return normalizeClientPortalLinkRecord(link);
}

async function handlePortalLinkAction(storage, token, body = {}) {
  const link = await activePortalLinkFromToken(storage, token);
  const action = cleanString(body.action || body.type);
  if (action === "approval") {
    return portalApprovalAction(storage, link, body);
  }
  if (action === "comment") {
    return portalCommentAction(storage, link, body);
  }
  if (action === "feature-request") {
    return portalFeatureRequestAction(storage, link, body);
  }
  publicError(400, "Portal action is invalid");
}

async function portalApprovalAction(storage, link, body = {}) {
  const approvalId = cleanString(body.approvalId);
  const status = cleanString(body.status);
  if (!approvalId || !["approved", "needs-changes", "requested"].includes(status)) {
    publicError(400, "Portal approval action requires approvalId and a valid status");
  }

  const approval = await portalApprovalRecord(storage, link.companyId, approvalId);
  const now = new Date().toISOString();
  const savedApproval = await storage.upsertRecord("approvals", normalizeApproval({
    ...approval,
    status,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: "portal-link",
    action: "client_portal_approval_action"
  });
  const note = cleanString(body.note).slice(0, 1200);
  let comment = null;
  if (note && approval.taskId) {
    comment = await storage.upsertRecord("comments", normalizeComment({
      id: `portal-comment-${crypto.randomUUID()}`,
      taskId: approval.taskId,
      author: "portal-link",
      body: note,
      kind: status === "approved" ? "decision" : "comment",
      createdAt: now,
      updatedAt: now
    }), {
      storage: storage.driver || "json-file",
      updatedBy: "portal-link",
      action: "client_portal_comment"
    });
  }
  const activity = await portalActivity(storage, {
    projectId: approval.projectId,
    taskId: approval.taskId,
    type: "approval",
    message: `${status === "approved" ? "approved" : status === "needs-changes" ? "requested changes for" : "reopened"} ${approval.title}`
  });
  const notification = await recordPortalNotification(storage, link, {
    kind: "portal-approval",
    title: `Portal approval ${status === "approved" ? "approved" : status === "needs-changes" ? "needs changes" : "reopened"}`,
    message: `${approval.title} was updated from a hosted portal link.`,
    reason: note || "Client used a hosted portal action."
  });
  await storage.appendAuditEvent({
    actorId: "portal-link",
    action: "client_portal_approval_action",
    workspaceId: workspace.id,
    detail: `Hosted portal ${status} ${approval.title}`,
    metadata: { companyId: link.companyId, linkId: link.id, tokenId: link.tokenId, approvalId: approval.id, status }
  });
  await runAutomationRules(storage, {
    actorId: "portal-link",
    source: "portal",
    triggerKind: "portal_approval",
    context: {
      triggerKind: "portal_approval",
      link,
      approval: savedApproval,
      task: approval.taskId ? await portalTaskRecord(storage, link.companyId, approval.taskId).catch(() => ({})) : {},
      title: approval.title,
      status
    }
  });
  return portalActionResponse(storage, link, {
    type: "approval",
    approval: publicPortalApproval(savedApproval, [], [], []),
    comment,
    activity,
    notification
  });
}

async function portalCommentAction(storage, link, body = {}) {
  const taskId = cleanString(body.taskId);
  const text = cleanString(body.body || body.comment).slice(0, 1200);
  if (!taskId || !text) publicError(400, "Portal comment requires taskId and body");
  const task = await portalTaskRecord(storage, link.companyId, taskId);
  const now = new Date().toISOString();
  const comment = await storage.upsertRecord("comments", normalizeComment({
    id: `portal-comment-${crypto.randomUUID()}`,
    taskId: task.id,
    author: "portal-link",
    body: text,
    kind: "comment",
    createdAt: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: "portal-link",
    action: "client_portal_comment"
  });
  const activity = await portalActivity(storage, {
    projectId: task.projectId,
    taskId: task.id,
    type: "comment",
    message: `commented on ${task.title}`
  });
  const notification = await recordPortalNotification(storage, link, {
    kind: "portal-comment",
    title: "Portal comment",
    message: `A client commented on ${task.title}.`,
    reason: text
  });
  await storage.appendAuditEvent({
    actorId: "portal-link",
    action: "client_portal_comment",
    workspaceId: workspace.id,
    detail: `Hosted portal comment on ${task.title}`,
    metadata: { companyId: link.companyId, linkId: link.id, tokenId: link.tokenId, taskId: task.id }
  });
  await runAutomationRules(storage, {
    actorId: "portal-link",
    source: "portal",
    triggerKind: "portal_comment",
    context: {
      triggerKind: "portal_comment",
      link,
      task,
      comment,
      title: task.title
    }
  });
  return portalActionResponse(storage, link, { type: "comment", comment, activity, notification });
}

async function portalFeatureRequestAction(storage, link, body = {}) {
  const title = cleanString(body.title).slice(0, 120);
  const details = cleanString(body.details || body.description).slice(0, 1200);
  if (!title) publicError(400, "Portal feature request requires a title");
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = (Array.isArray(snapshot.projects) ? snapshot.projects : [])
    .map(normalizeProject)
    .filter((project) => project.companyId === link.companyId && !project.archivedAt);
  if (!projects.length) publicError(503, "No shared project is available for portal feature requests");
  const requestedProjectId = cleanString(body.projectId);
  const project = projects.find((item) => item.id === requestedProjectId) || projects[0];
  const now = new Date().toISOString();
  const requester = cleanString(body.requester).slice(0, 80) || "Portal client";
  const requesterEmail = cleanString(body.email).slice(0, 120);
  const impact = cleanString(body.impact).slice(0, 80) || "nice-to-have";
  const task = normalizeTask({
    id: `feature-${crypto.randomUUID()}`,
    projectId: project.id,
    title: `Feature request: ${title}`,
    description: [
      details,
      "",
      `Requested from hosted portal by ${requester}${requesterEmail ? ` <${requesterEmail}>` : ""}.`
    ].join("\n").trim(),
    status: "todo",
    priority: impact === "workflow-blocker" || impact === "bug-regression" ? "urgent" : impact === "revenue-risk" ? "high" : "normal",
    tags: ["feature-request", "portal"],
    visibility: "shared",
    customFields: {
      requestType: "feature-request",
      source: "portal",
      requester,
      requesterEmail,
      impact,
      featureStatus: "new",
      clientVisibility: "Shared"
    },
    createdAt: now,
    updatedAt: now
  });
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    tasks: [task, ...tasks.filter((item) => item.id !== task.id)]
  }, {
    storage: storage.driver || "json-file",
    updatedBy: "portal-link",
    action: "client_portal_feature_request"
  });
  const activity = await portalActivity(storage, {
    projectId: task.projectId,
    taskId: task.id,
    type: "feature-request",
    message: `submitted ${task.title}`
  });
  const notification = await recordPortalNotification(storage, link, {
    kind: "portal-feature-request",
    title: "Portal feature request",
    message: `${requester} submitted ${title}.`,
    reason: details || "Client submitted a hosted portal feature request."
  });
  await storage.appendAuditEvent({
    actorId: "portal-link",
    action: "client_portal_feature_request",
    workspaceId: workspace.id,
    detail: `Hosted portal feature request ${title}`,
    metadata: { companyId: link.companyId, linkId: link.id, tokenId: link.tokenId, taskId: task.id, projectId: project.id }
  });
  await runAutomationRules(storage, {
    actorId: "portal-link",
    source: "portal",
    triggerKind: "portal_feature_request",
    context: {
      triggerKind: "portal_feature_request",
      link,
      task,
      project,
      title,
      priority: task.priority
    }
  });
  return portalActionResponse(storage, link, { type: "feature-request", task, activity, notification });
}

async function portalActionResponse(storage, link, action) {
  return {
    ok: true,
    portalLink: publicPortalLink(link),
    portalSnapshot: await publicPortalSnapshotForLink(storage, link),
    action
  };
}

async function portalApprovalRecord(storage, companyId, approvalId) {
  const approvals = await storage.loadRecords("approvals", {});
  const approval = approvals.map(normalizeApproval).find((item) => item.id === approvalId);
  if (!approval) publicError(404, "Portal approval not found");
  const snapshot = await storage.loadWorkspaceSnapshot();
  const project = (Array.isArray(snapshot.projects) ? snapshot.projects : []).map(normalizeProject).find((item) => item.id === approval.projectId);
  if (approval.companyId !== companyId && project?.companyId !== companyId) publicError(403, "Portal approval is outside this company");
  if (!isPortalVisibleRecord(approval, "approval")) publicError(403, "Portal approval is not client visible");
  return approval;
}

async function portalTaskRecord(storage, companyId, taskId) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const projects = (Array.isArray(snapshot.projects) ? snapshot.projects : []).map(normalizeProject);
  const task = (Array.isArray(snapshot.tasks) ? snapshot.tasks : []).map(normalizeTask).find((item) => item.id === taskId);
  const project = task ? projects.find((item) => item.id === task.projectId) : null;
  if (!task || !project) publicError(404, "Portal task not found");
  if (project.companyId !== companyId) publicError(403, "Portal task is outside this company");
  if (!isPortalVisibleRecord(task, "task")) publicError(403, "Portal task is not client visible");
  return task;
}

async function portalActivity(storage, input = {}) {
  const now = new Date().toISOString();
  return storage.upsertRecord("activities", normalizeActivity({
    id: `portal-activity-${crypto.randomUUID()}`,
    projectId: input.projectId,
    taskId: input.taskId || "",
    memberId: "portal-link",
    type: input.type || "portal",
    message: input.message || "used the hosted portal",
    createdAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: "portal-link",
    action: "client_portal_activity"
  });
}

async function recordPortalNotification(storage, link, input = {}) {
  const now = new Date().toISOString();
  const title = input.title || "Hosted portal action";
  const message = input.message || "A client used a hosted portal link.";
  const reason = input.reason || `Portal link ${link.tokenId}`;
  const email = await deliverPortalActionEmail({
    link,
    actionType: input.kind || "portal-action",
    title,
    message,
    reason,
    companyName: input.companyName
  });
  const notification = await storage.upsertRecord("notificationHistory", normalizeNotificationHistoryEvent({
    id: `notification-history-${crypto.randomUUID()}`,
    memberId: "",
    kind: input.kind || "portal-action",
    title,
    message,
    reason,
    count: input.count || 1,
    channel: email.queued || email.delivered ? "hosted portal + email" : "hosted portal",
    createdAt: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: "portal-link",
    action: "client_portal_notification"
  });
  return { ...notification, email: portalEmailDeliveryStatus(email) };
}

function portalEmailDeliveryStatus(email = {}) {
  return {
    mode: cleanString(email.mode || "not-configured"),
    delivered: Boolean(email.delivered),
    queued: Boolean(email.queued),
    reason: cleanString(email.reason).slice(0, 240),
    recipient: email.to ? "configured" : ""
  };
}

async function getPortalLinkRecord(storage, linkId, session) {
  const links = await storage.loadRecords("clientPortalLinks", scopedRecordFilters(session, {}));
  const link = links.find((item) => item.id === linkId);
  if (!link) publicError(404, "Portal link not found");
  if (sessionCompanyId(session) && link.companyId !== sessionCompanyId(session)) {
    publicError(403, "Portal link is outside the company scope");
  }
  return normalizeClientPortalLinkRecord(link);
}

async function requirePortalCompany(storage, companyId, session) {
  if (!companyId) publicError(400, "Portal link companyId is required");
  if (sessionCompanyId(session) && companyId !== sessionCompanyId(session)) {
    publicError(403, "Portal link company is outside the session scope");
  }
  const snapshot = await storage.loadWorkspaceSnapshot();
  const companies = await portalCompanies(storage, snapshot);
  const company = companies.find((item) => item.id === companyId);
  if (!company) publicError(400, "Portal link company is not in this workspace");
  return company;
}

async function publicPortalSnapshotForLink(storage, link) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const companies = await portalCompanies(storage, snapshot);
  const company = companies.find((item) => item.id === link.companyId);
  if (!company) publicError(404, "Portal company not found");

  const users = workspaceUsers(snapshot);
  const projects = (Array.isArray(snapshot.projects) ? snapshot.projects : [])
    .map(normalizeProject)
    .filter((project) => project.companyId === company.id && !project.archivedAt)
    .map(publicPortalProject);
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = (Array.isArray(snapshot.tasks) ? snapshot.tasks : [])
    .map(normalizeTask)
    .filter((task) => projectIds.has(task.projectId) && !task.archivedAt && isPortalVisibleRecord(task, "task"))
    .map((task) => publicPortalTask(task, projects, users));
  const visibleTaskIds = new Set(tasks.map((task) => task.id));
  const visibleProjectIds = new Set(projects.filter((project) => tasks.some((task) => task.projectId === project.id)).map((project) => project.id));
  const approvals = (await storage.loadRecords("approvals", {}))
    .map(normalizeApproval)
    .filter((approval) => (approval.companyId === company.id || projectIds.has(approval.projectId)) && isPortalVisibleRecord(approval, "approval"))
    .map((approval) => publicPortalApproval(approval, projects, tasks, users))
    .sort((a, b) => {
      const statusSort = Number(a.status === "approved") - Number(b.status === "approved");
      if (statusSort !== 0) return statusSort;
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    });
  const documents = (await storage.loadRecords("documents", {}))
    .map(normalizeDocument)
    .filter((document) => projectIds.has(document.projectId) && isPortalVisibleRecord(document, "document"))
    .map((document) => publicPortalDocument(document, projects));
  const files = (await storage.loadRecords("files", {}))
    .map(normalizeFile)
    .filter((file) => projectIds.has(file.projectId) && isPortalVisibleRecord(file, "file"))
    .map((file) => publicPortalFile(file, projects));
  const updates = [
    ...(await storage.loadRecords("activities", {})).map(normalizeActivity).map((activity) => publicPortalActivity(activity, projects, tasks, users)),
    ...(await storage.loadRecords("comments", {})).map(normalizeComment).map((comment) => publicPortalComment(comment, projects, tasks, users))
  ]
    .filter((update) => {
      if (update.taskId) return visibleTaskIds.has(update.taskId);
      return Boolean(update.projectId && visibleProjectIds.has(update.projectId));
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 25);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const pendingApprovals = approvals.filter((approval) => approval.status !== "approved");
  const updatedAt = updates[0]?.createdAt || tasks[0]?.updatedAt || projects[0]?.updatedAt || "";

  return {
    generatedAt: new Date().toISOString(),
    link: publicPortalLink(link),
    company: publicPortalCompany(company),
    projects: projects.map((project) => ({
      ...project,
      progress: portalProgress(tasks.filter((task) => task.projectId === project.id))
    })),
    tasks,
    openTasks,
    approvals,
    pendingApprovals,
    documents,
    files,
    updates,
    progress: portalProgress(tasks),
    updatedAt
  };
}

async function portalCompanies(storage, snapshot = {}) {
  const snapshotCompanies = Array.isArray(snapshot.companies) ? snapshot.companies : [];
  const recordCompanies = await storage.loadRecords("companies", {}).catch(() => []);
  return mergeById(snapshotCompanies, recordCompanies, "id").map(normalizeCompany);
}

function publicPortalCompany(company) {
  return {
    id: company.id,
    name: company.name,
    type: company.type,
    description: company.description,
    status: company.status
  };
}

function publicPortalProject(project) {
  return {
    id: project.id,
    name: project.name,
    companyId: project.companyId,
    description: project.description,
    owner: project.owner,
    startDate: project.startDate,
    dueDate: project.dueDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function publicPortalTask(task, projects, users) {
  return {
    id: task.id,
    projectId: task.projectId,
    projectName: portalProjectName(projects, task.projectId),
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    assigneeName: portalMemberName(users, task.assignee),
    status: task.status,
    priority: task.priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    tags: task.tags,
    visibility: portalRecordVisibility(task, "task"),
    customFields: publicPortalCustomFields(task.customFields),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function publicPortalApproval(approval, projects, tasks, users) {
  return {
    id: approval.id,
    companyId: approval.companyId,
    projectId: approval.projectId,
    projectName: portalProjectName(projects, approval.projectId),
    taskId: approval.taskId,
    taskTitle: tasks.find((task) => task.id === approval.taskId)?.title || "",
    title: approval.title,
    requester: approval.requester,
    requesterName: portalMemberName(users, approval.requester),
    reviewer: approval.reviewer,
    reviewerName: portalMemberName(users, approval.reviewer) || approval.reviewer,
    status: approval.status,
    dueDate: approval.dueDate,
    summary: approval.summary,
    visibility: portalRecordVisibility(approval, "approval"),
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt
  };
}

function publicPortalDocument(document, projects) {
  return {
    id: document.id,
    projectId: document.projectId,
    projectName: portalProjectName(projects, document.projectId),
    title: document.title,
    type: document.type,
    owner: document.owner,
    updatedAt: document.updatedAt,
    visibility: portalRecordVisibility(document, "document")
  };
}

function publicPortalFile(file, projects) {
  return {
    id: file.id,
    projectId: file.projectId,
    taskId: file.taskId,
    projectName: portalProjectName(projects, file.projectId),
    title: file.title,
    kind: file.kind,
    size: file.size,
    contentType: file.contentType,
    updatedAt: file.updatedAt,
    visibility: portalRecordVisibility(file, "file")
  };
}

function publicPortalActivity(activity, projects, tasks, users) {
  const task = tasks.find((item) => item.id === activity.taskId);
  const projectId = activity.projectId || task?.projectId || "";
  return {
    id: activity.id,
    projectId,
    projectName: portalProjectName(projects, projectId),
    taskId: activity.taskId,
    taskTitle: task?.title || "",
    type: activity.type,
    message: activity.message,
    actorName: portalMemberName(users, activity.memberId),
    createdAt: activity.createdAt
  };
}

function publicPortalComment(comment, projects, tasks, users) {
  const task = tasks.find((item) => item.id === comment.taskId);
  const projectId = task?.projectId || "";
  return {
    id: comment.id,
    projectId,
    projectName: portalProjectName(projects, projectId),
    taskId: comment.taskId,
    taskTitle: task?.title || "",
    type: "comment",
    message: comment.body,
    actorName: portalMemberName(users, comment.author),
    createdAt: comment.createdAt
  };
}

function publicPortalCustomFields(fields = {}) {
  const allowed = ["impact", "requester", "requesterEmail", "featureStatus", "requestType", "source", "lastRequesterUpdateAt", "approvalStage", "clientVisibility"];
  return Object.fromEntries(allowed.map((key) => [key, cleanString(fields[key])]).filter(([, value]) => value));
}

function portalProjectName(projects, projectId) {
  return projects.find((project) => project.id === projectId)?.name || "Shared project";
}

function portalMemberName(users, memberId) {
  return cleanString(users.find((user) => user.id === memberId)?.name || memberId);
}

function portalProgress(tasks) {
  const done = tasks.filter((task) => task.status === "done").length;
  return tasks.length ? Math.round((done / tasks.length) * 100) : 0;
}

function isPortalVisibleRecord(record = {}, kind = "task") {
  return portalRecordVisibility(record, kind) !== "internal";
}

function portalRecordVisibility(record = {}, kind = "task") {
  if (kind === "task") {
    const featureFallback = cleanString(record.customFields?.featureSource) === "public" || /^Feature request:/i.test(cleanString(record.title)) ? "shared" : "internal";
    return portalVisibilityValue(record.visibility || record.clientVisibility || record.customFields?.clientVisibility || featureFallback);
  }
  const fallback = {
    approval: "client",
    document: "shared",
    file: "shared"
  }[kind] || "internal";
  return portalVisibilityValue(record.visibility || record.clientVisibility || record.customFields?.clientVisibility || fallback);
}

function portalVisibilityValue(value) {
  const normalized = cleanString(value).toLowerCase();
  if (["client", "portal", "public", "external", "client-visible", "client visible"].includes(normalized)) return "client";
  if (["shared", "team", "stakeholder"].includes(normalized)) return "shared";
  return "internal";
}

function publicPortalLink(link = {}) {
  const normalized = normalizeClientPortalLinkRecord(link);
  return {
    id: normalized.id,
    companyId: normalized.companyId,
    tokenId: normalized.tokenId,
    source: "api",
    status: portalLinkStatus(normalized),
    createdBy: normalized.createdBy,
    createdAt: normalized.createdAt,
    expiresAt: normalized.expiresAt,
    revokedAt: normalized.revokedAt,
    copiedAt: normalized.copiedAt,
    emailedAt: normalized.emailedAt,
    viewedAt: normalized.viewedAt,
    viewCount: normalized.viewCount,
    packetSignature: normalized.packetSignature,
    updatedAt: normalized.updatedAt
  };
}

function portalLinkStatus(link = {}) {
  if (!link?.id) return "missing";
  if (link.status === "revoked" || link.revokedAt) return "revoked";
  const expiresAt = Date.parse(link.expiresAt || "");
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return "expired";
  return "active";
}

function portalLinkExpiry(value) {
  const parsed = Date.parse(cleanString(value));
  if (Number.isFinite(parsed) && parsed > Date.now()) return new Date(parsed).toISOString();
  return new Date(Date.now() + PORTAL_LINK_TTL_MS).toISOString();
}

function createPortalToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashPortalToken(token) {
  const value = cleanString(token);
  return value ? crypto.createHash("sha256").update(value).digest("hex") : "";
}

function portalTokenId(token) {
  return hashPortalToken(token).slice(0, 24);
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
  broadcastRealtimeEvent({
    type: "workspace",
    action,
    actorId: session.user.id
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
  broadcastRealtimeEvent({
    type: "project",
    collection: "projects",
    action,
    id: nextProject.id,
    companyId: nextProject.companyId || "",
    actorId: session.user.id
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
  broadcastRealtimeEvent({
    type: "task",
    collection: "tasks",
    action,
    id: nextTask.id,
    projectId: nextTask.projectId,
    companyId: project.companyId || "",
    actorId: session.user.id
  });
  return nextTasks.find((item) => item.id === nextTask.id);
}

function githubWebhookActorSession() {
  return {
    user: { id: "github-webhook", name: "GitHub Webhook", email: "" },
    membership: { role: "admin", status: "active", companyId: "" },
    permissions: rolePermissions.admin
  };
}

function githubIntegrationStatus(snapshot = {}, storage) {
  const integrations = snapshot.workspace?.integrations || {};
  const github = integrations.github || {};
  const connection = (Array.isArray(integrations.connections) ? integrations.connections : []).find((item) => item.id === "github") || {};
  const repositories = Array.isArray(github.repositories) ? github.repositories : [];
  const conflicts = Array.isArray(snapshot.integrationConflicts) ? snapshot.integrationConflicts : [];
  const webhookSecretConfigured = Boolean(cleanString(process.env.AGORA_GITHUB_WEBHOOK_SECRET));
  const webhookSecretRequired = githubWebhookSecretRequired(storage);
  return {
    provider: "github",
    configured: repositories.length > 0,
    webhookEndpoint: "/api/integrations/github/webhook",
    webhookSecretConfigured,
    webhookSecretRequired,
    replayProtection: true,
    connection: {
      status: cleanString(connection.status || "planned"),
      health: cleanString(connection.health || "planned"),
      syncMode: cleanString(connection.syncMode || "inbound"),
      lastSyncedAt: cleanString(connection.lastSyncedAt)
    },
    repositories: repositories.map((repo) => ({
      fullName: cleanString(repo.fullName),
      projectId: cleanString(repo.projectId),
      syncIssues: repo.syncIssues !== false,
      syncPullRequests: repo.syncPullRequests !== false,
      lastSyncedAt: cleanString(repo.lastSyncedAt),
      status: cleanString(repo.status || "mapped")
    })),
    conflicts: conflicts.filter((conflict) => cleanString(conflict.provider) === "github" && cleanString(conflict.status || "open") === "open").length
  };
}

function githubWebhookSecretRequired(storage) {
  return cleanString(storage?.driver || process.env.AGORA_STORAGE_DRIVER).toLowerCase() === "supabase"
    || authDriverLabel() === "supabase"
    || envFlag("AGORA_REQUIRE_GITHUB_WEBHOOK_SECRET", false);
}

function verifyGitHubWebhookSignature(storage, request, rawBody) {
  const secret = githubWebhookSecret();
  if (!secret) {
    if (githubWebhookSecretRequired(storage)) {
      publicError(401, "AGORA_GITHUB_WEBHOOK_SECRET is required for production GitHub webhooks");
    }
    return;
  }
  const signature = cleanString(request.headers["x-hub-signature-256"]);
  if (!signature.startsWith("sha256=")) publicError(401, "Missing GitHub webhook signature");
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const provided = Buffer.from(signature, "utf8");
  const target = Buffer.from(expected, "utf8");
  if (provided.length !== target.length || !crypto.timingSafeEqual(provided, target)) {
    publicError(401, "Invalid GitHub webhook signature");
  }
}

function githubWebhookSecret() {
  return cleanString(process.env.AGORA_GITHUB_WEBHOOK_SECRET);
}

function githubWebhookEventName(request) {
  return cleanString(request.headers["x-github-event"]).toLowerCase();
}

function githubWebhookDeliveryId(request) {
  return cleanString(request.headers["x-github-delivery"]).slice(0, 120);
}

function githubRepositoryFullName(payload = {}) {
  return cleanString(payload.repository?.full_name || [
    payload.repository?.owner?.login,
    payload.repository?.name
  ].filter(Boolean).join("/"));
}

function githubExternalId(repoFullName, item = {}) {
  const number = cleanString(item.number);
  return repoFullName && number ? `${repoFullName}#${number}` : "";
}

function githubIssueStatus(issue = {}) {
  return cleanString(issue.state) === "closed" ? "done" : "todo";
}

function githubPullRequestState(pullRequest = {}) {
  if (pullRequest.merged === true || cleanString(pullRequest.merged_at)) return "merged";
  return cleanString(pullRequest.state || "open");
}

function githubLabels(labels = []) {
  return (Array.isArray(labels) ? labels : [])
    .map((label) => cleanString(label.name || label))
    .filter(Boolean)
    .slice(0, 12);
}

function githubTaskFromIssue({ issue, repo, repoConfig, existingTask }) {
  const now = new Date().toISOString();
  const externalId = githubExternalId(repo, issue);
  return normalizeTask({
    ...(existingTask || {}),
    id: existingTask?.id || `github-issue-${slugFromName(externalId)}`,
    projectId: repoConfig.projectId,
    title: cleanString(issue.title).slice(0, 180) || `GitHub issue #${cleanString(issue.number)}`,
    description: cleanString(issue.body).slice(0, 5000),
    status: githubIssueStatus(issue),
    priority: existingTask?.priority || "normal",
    tags: Array.from(new Set([...(existingTask?.tags || []), ...githubLabels(issue.labels), repoConfig.labelPrefix || "github"].filter(Boolean))).slice(0, 16),
    customFields: {
      ...(existingTask?.customFields || {}),
      source: "github",
      githubRepo: repo,
      githubIssueNumber: cleanString(issue.number),
      githubExternalId: externalId,
      githubIssueState: cleanString(issue.state || "open"),
      githubUrl: cleanString(issue.html_url),
      githubSyncedAt: now,
      githubUpdatedAt: cleanString(issue.updated_at || now)
    },
    createdAt: existingTask?.createdAt || cleanString(issue.created_at) || now,
    updatedAt: now
  });
}

function githubTaskWithPullRequest({ pullRequest, repo, repoConfig, existingTask }) {
  const now = new Date().toISOString();
  const externalId = githubExternalId(repo, pullRequest);
  return normalizeTask({
    ...(existingTask || {}),
    id: existingTask?.id || `github-pr-${slugFromName(externalId)}`,
    projectId: existingTask?.projectId || repoConfig.projectId,
    title: existingTask?.title || cleanString(pullRequest.title).slice(0, 180) || `GitHub PR #${cleanString(pullRequest.number)}`,
    description: existingTask?.description || cleanString(pullRequest.body).slice(0, 5000),
    status: githubPullRequestState(pullRequest) === "merged" ? "done" : existingTask?.status || "review",
    priority: existingTask?.priority || "normal",
    tags: Array.from(new Set([...(existingTask?.tags || []), repoConfig.labelPrefix || "github", "pull-request"].filter(Boolean))).slice(0, 16),
    customFields: {
      ...(existingTask?.customFields || {}),
      source: "github",
      githubRepo: repo,
      githubPrNumber: cleanString(pullRequest.number),
      githubPrState: githubPullRequestState(pullRequest),
      githubPullRequestId: externalId,
      githubPrUrl: cleanString(pullRequest.html_url),
      githubSyncedAt: now,
      githubUpdatedAt: cleanString(pullRequest.updated_at || now)
    },
    createdAt: existingTask?.createdAt || cleanString(pullRequest.created_at) || now,
    updatedAt: now
  });
}

function findGitHubLinkedTask(tasks = [], repo, item = {}, type = "issue") {
  const number = cleanString(item.number);
  return tasks.find((task) => {
    const fields = task.customFields || {};
    if (cleanString(fields.githubRepo) !== repo) return false;
    if (type === "pull_request") return cleanString(fields.githubPrNumber) === number || cleanString(fields.githubPullRequestId) === githubExternalId(repo, item);
    return cleanString(fields.githubIssueNumber) === number || cleanString(fields.githubExternalId) === githubExternalId(repo, item);
  });
}

function hasGitHubSyncConflict(existingTask, githubUpdatedAt) {
  if (!existingTask) return false;
  const lastSyncedAt = cleanString(existingTask.customFields?.githubSyncedAt);
  if (!lastSyncedAt) return false;
  const localUpdatedAt = cleanString(existingTask.updatedAt);
  return Date.parse(localUpdatedAt) > Date.parse(lastSyncedAt) && Date.parse(githubUpdatedAt) > Date.parse(lastSyncedAt);
}

function isStaleGitHubWebhook(existingTask, githubUpdatedAt) {
  if (!existingTask) return false;
  const lastSyncedAt = cleanString(existingTask.customFields?.githubSyncedAt);
  if (!lastSyncedAt) return false;
  return Date.parse(githubUpdatedAt) <= Date.parse(lastSyncedAt);
}

function githubConflictRecord({ eventName, action, repo, existingTask, incomingTask, externalUpdatedAt }) {
  const now = new Date().toISOString();
  return {
    id: `github-conflict-${slugFromName(`${repo}-${incomingTask.customFields?.githubIssueNumber || incomingTask.customFields?.githubPrNumber || incomingTask.id}`)}`,
    provider: "github",
    status: "open",
    eventName,
    action,
    repo,
    taskId: existingTask.id,
    taskTitle: existingTask.title,
    externalId: incomingTask.customFields?.githubExternalId || incomingTask.customFields?.githubPullRequestId || "",
    localRevision: cleanString(existingTask.updatedAt),
    externalRevision: cleanString(externalUpdatedAt),
    local: {
      title: existingTask.title,
      description: existingTask.description,
      status: existingTask.status,
      tags: existingTask.tags || []
    },
    external: {
      title: incomingTask.title,
      description: incomingTask.description,
      status: incomingTask.status,
      tags: incomingTask.tags || []
    },
    createdAt: now,
    updatedAt: now
  };
}

async function recordGitHubWebhookReceipt(storage, details = {}) {
  const now = new Date().toISOString();
  const repo = cleanString(details.repository || details.repo);
  const eventName = cleanString(details.eventName || "github");
  const action = cleanString(details.action || "received");
  const number = cleanString(details.number);
  const outcome = cleanString(details.outcome || "accepted");
  const deliveryId = cleanString(details.deliveryId);
  const deliverySuffix = deliveryId ? ` delivery:${deliveryId}` : "";
  const receiptId = deliveryId && !["duplicate", "rejected"].includes(outcome)
    ? `github-webhook-delivery-${slugFromName(deliveryId)}`
    : `github-webhook-${outcome}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  return storage.upsertRecord("notificationHistory", normalizeNotificationHistoryEvent({
    id: receiptId,
    kind: "github-webhook",
    title: `GitHub ${eventName} ${outcome}`,
    message: [repo, number ? `#${number}` : "", action, details.taskId ? `task ${details.taskId}` : ""].filter(Boolean).join(" / "),
    reason: `${cleanString(details.reason || `GitHub webhook ${outcome}`)}${deliverySuffix}`.slice(0, 500),
    count: Number(details.count || 1),
    channel: "github webhook",
    createdAt: now,
    updatedAt: now
  }), {
    storage: storage.driver || "json-file",
    updatedBy: "github-webhook",
    action: "github_webhook_receipt"
  });
}

async function githubWebhookDeliverySeen(storage, deliveryId) {
  const cleanDeliveryId = cleanString(deliveryId);
  if (!cleanDeliveryId) return false;
  const receiptId = `github-webhook-delivery-${slugFromName(cleanDeliveryId)}`;
  const receipts = await storage.loadRecords("notificationHistory", {});
  return receipts.some((receipt) => receipt.kind === "github-webhook" && (
    receipt.id === receiptId || (!cleanString(receipt.id).startsWith("github-webhook-rejected-")
      && !cleanString(receipt.id).startsWith("github-webhook-duplicate-")
      && cleanString(receipt.reason).includes(`delivery:${cleanDeliveryId}`))
  ));
}

async function recordGitHubWebhookFailureReceipt(storage, request, payload = {}, reason = "GitHub webhook rejected") {
  try {
    return await recordGitHubWebhookReceipt(storage, {
      deliveryId: githubWebhookDeliveryId(request),
      eventName: githubWebhookEventName(request) || "unknown",
      action: cleanString(payload?.action).toLowerCase(),
      repository: githubRepositoryFullName(payload),
      number: payload?.issue?.number || payload?.pull_request?.number,
      outcome: "rejected",
      reason
    });
  } catch (receiptError) {
    console.warn("Failed to record GitHub webhook rejection", receiptError.message);
    return null;
  }
}

async function handleGitHubWebhook(storage, request, payload = {}, options = {}) {
  const eventName = githubWebhookEventName(request);
  const action = cleanString(payload.action).toLowerCase();
  if (!["issues", "pull_request"].includes(eventName)) {
    const receipt = await recordGitHubWebhookReceipt(storage, {
      deliveryId: options.deliveryId,
      eventName: eventName || "unknown",
      action,
      outcome: "ignored",
      reason: `Unsupported GitHub event ${eventName || "unknown"}`
    });
    return { accepted: true, ignored: true, receipt, reason: `Unsupported GitHub event ${eventName || "unknown"}` };
  }
  const repo = githubRepositoryFullName(payload);
  if (!repo) publicError(400, "GitHub webhook requires repository.full_name");
  const snapshot = await storage.loadWorkspaceSnapshot();
  const integrations = snapshot.workspace?.integrations || {};
  const github = integrations.github || {};
  const repoConfig = (Array.isArray(github.repositories) ? github.repositories : []).find((item) => cleanString(item.fullName).toLowerCase() === repo.toLowerCase());
  if (!repoConfig?.projectId) publicError(400, "GitHub repository is not mapped to an Agora project");

  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [];
  const item = eventName === "issues" ? payload.issue : payload.pull_request;
  if (!item || typeof item !== "object") publicError(400, "GitHub webhook payload is missing issue or pull_request");
  const existingTask = findGitHubLinkedTask(tasks, repo, item, eventName);
  const externalUpdatedAt = cleanString(item.updated_at || new Date().toISOString());
  const incomingTask = eventName === "issues"
    ? githubTaskFromIssue({ issue: item, repo, repoConfig, existingTask })
    : githubTaskWithPullRequest({ pullRequest: item, repo, repoConfig, existingTask });

  if (existingTask && isStaleGitHubWebhook(existingTask, externalUpdatedAt)) {
    const receipt = await recordGitHubWebhookReceipt(storage, {
      deliveryId: options.deliveryId,
      eventName,
      action,
      repository: repo,
      number: item.number,
      outcome: "stale",
      taskId: existingTask.id,
      reason: "Ignored stale GitHub redelivery"
    });
    return { accepted: true, ignored: true, stale: true, receipt, task: existingTask };
  }

  if (existingTask && hasGitHubSyncConflict(existingTask, externalUpdatedAt)) {
    const conflict = githubConflictRecord({ eventName, action, repo, existingTask, incomingTask, externalUpdatedAt });
    const conflicts = Array.isArray(snapshot.integrationConflicts) ? snapshot.integrationConflicts : [];
    await storage.saveWorkspaceSnapshot({
      ...snapshot,
      integrationConflicts: [conflict, ...conflicts.filter((item) => item.id !== conflict.id)].slice(0, 100)
    }, {
      storage: storage.driver || "json-file",
      updatedBy: "github-webhook",
      action: "github_webhook_conflict"
    });
    await storage.appendAuditEvent({
      actorId: "github-webhook",
      action: "github_webhook_conflict",
      workspaceId: workspace.id,
      detail: `GitHub ${eventName} ${repo} #${cleanString(item.number)} needs conflict review`
    });
    const receipt = await recordGitHubWebhookReceipt(storage, {
      deliveryId: options.deliveryId,
      eventName,
      action,
      repository: repo,
      number: item.number,
      outcome: "conflict",
      taskId: existingTask.id,
      reason: "GitHub event created a conflict review"
    });
    return { accepted: true, receipt, conflict, task: existingTask };
  }

  const task = await upsertTask(storage, incomingTask, githubWebhookActorSession(), existingTask ? "github_webhook_task_update" : "github_webhook_task_create");
  const latestSnapshot = await storage.loadWorkspaceSnapshot();
  const latestIntegrations = latestSnapshot.workspace?.integrations || {};
  const now = new Date().toISOString();
  await storage.saveWorkspaceSnapshot({
    ...latestSnapshot,
    workspace: {
      ...(latestSnapshot.workspace || {}),
      integrations: {
        ...latestIntegrations,
        github: {
          ...(latestIntegrations.github || {}),
          repositories: (Array.isArray(latestIntegrations.github?.repositories) ? latestIntegrations.github.repositories : []).map((item) => cleanString(item.fullName).toLowerCase() === repo.toLowerCase()
            ? { ...item, lastSyncedAt: now, status: "mapped" }
            : item)
        },
        connections: (Array.isArray(latestIntegrations.connections) ? latestIntegrations.connections : []).map((connection) => connection.id === "github"
          ? { ...connection, status: "connected", health: "healthy", lastSyncedAt: now, secretStatus: cleanString(process.env.AGORA_GITHUB_WEBHOOK_SECRET) ? "configured" : connection.secretStatus || "missing" }
          : connection)
      }
    }
  }, {
    storage: storage.driver || "json-file",
    updatedBy: "github-webhook",
    action: "github_webhook_sync"
  });
  const receipt = await recordGitHubWebhookReceipt(storage, {
    deliveryId: options.deliveryId,
    eventName,
    action,
    repository: repo,
    number: item.number,
    outcome: existingTask ? "updated" : "created",
    taskId: task.id,
    reason: existingTask ? "GitHub webhook updated an Agora task" : "GitHub webhook created an Agora task"
  });
  return { accepted: true, eventName, action, repository: repo, receipt, task };
}

async function runGitHubTestEvent(storage, body = {}, session) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const github = snapshot.workspace?.integrations?.github || {};
  const repositories = Array.isArray(github.repositories) ? github.repositories : [];
  const repoConfig = repositories.find((repo) => cleanString(repo.fullName) && cleanString(repo.projectId));
  if (!repoConfig) publicError(400, "Map a GitHub repository before sending a test event");
  const now = new Date().toISOString();
  const issueNumber = Math.max(9000, Math.round(Number(body.issueNumber || 9000 + (Date.now() % 999))));
  const payload = {
    action: cleanString(body.action || "opened") || "opened",
    repository: {
      full_name: cleanString(repoConfig.fullName),
      name: cleanString(repoConfig.fullName).split("/")[1] || "repo",
      owner: { login: cleanString(repoConfig.fullName).split("/")[0] || "owner" }
    },
    issue: {
      number: issueNumber,
      title: cleanString(body.title || "Agora test GitHub issue"),
      body: cleanString(body.body || `Test event sent by ${session.user.name} from Agora Settings.`),
      state: cleanString(body.state || "open"),
      labels: [{ name: cleanString(repoConfig.labelPrefix || "agora") }, { name: "test-webhook" }],
      html_url: `https://github.com/${cleanString(repoConfig.fullName)}/issues/${issueNumber}`,
      created_at: now,
      updated_at: now
    }
  };
  const result = await handleGitHubWebhook(storage, { headers: { "x-github-event": "issues" } }, payload);
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "github_test_webhook",
    workspaceId: workspace.id,
    detail: `${session.user.name} sent a GitHub test webhook for ${repoConfig.fullName} #${issueNumber}`
  });
  return {
    ...result,
    test: true,
    payload: {
      repository: repoConfig.fullName,
      issueNumber,
      title: payload.issue.title
    }
  };
}

function githubConflictResolutionValue(value) {
  const resolution = cleanString(value).toLowerCase();
  if (["keep-agora", "agora", "local"].includes(resolution)) return "keep-agora";
  if (["use-github", "github", "external", "server"].includes(resolution)) return "use-github";
  if (resolution === "merge") return "merge";
  if (["ignore", "ignored", "drop"].includes(resolution)) return "ignore";
  return "merge";
}

function githubConflictResolvedTask(existingTask, conflict, resolution) {
  const now = new Date().toISOString();
  const external = conflict.external || {};
  const local = conflict.local || {};
  if (resolution === "keep-agora" || resolution === "ignore") {
    return normalizeTask({
      ...existingTask,
      customFields: {
        ...(existingTask.customFields || {}),
        githubConflictResolution: resolution,
        githubConflictResolvedAt: now
      },
      updatedAt: now
    });
  }
  if (resolution === "use-github") {
    return normalizeTask({
      ...existingTask,
      title: cleanString(external.title) || existingTask.title,
      description: Object.prototype.hasOwnProperty.call(external, "description") ? cleanString(external.description) : existingTask.description,
      status: cleanString(external.status) || existingTask.status,
      tags: Array.isArray(external.tags) ? external.tags.map(cleanString).filter(Boolean).slice(0, 16) : existingTask.tags,
      customFields: {
        ...(existingTask.customFields || {}),
        githubSyncedAt: now,
        githubUpdatedAt: cleanString(conflict.externalRevision) || now,
        githubConflictResolution: resolution,
        githubConflictResolvedAt: now
      },
      updatedAt: now
    });
  }
  return normalizeTask({
    ...existingTask,
    title: cleanString(external.title || local.title || existingTask.title),
    description: cleanString(local.description || existingTask.description || external.description),
    status: cleanString(external.status || existingTask.status),
    tags: Array.from(new Set([
      ...(Array.isArray(local.tags) ? local.tags : existingTask.tags || []),
      ...(Array.isArray(external.tags) ? external.tags : [])
    ].map(cleanString).filter(Boolean))).slice(0, 16),
    customFields: {
      ...(existingTask.customFields || {}),
      githubSyncedAt: now,
      githubUpdatedAt: cleanString(conflict.externalRevision) || now,
      githubConflictResolution: resolution,
      githubConflictResolvedAt: now
    },
    updatedAt: now
  });
}

async function resolveGitHubConflict(storage, conflictId, body = {}, session) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const conflicts = Array.isArray(snapshot.integrationConflicts) ? snapshot.integrationConflicts : [];
  const conflict = conflicts.find((item) => item.id === conflictId);
  if (!conflict) publicError(404, "GitHub conflict not found");
  if (cleanString(conflict.provider) !== "github") publicError(400, "Conflict is not a GitHub conflict");
  if (cleanString(conflict.status || "open") !== "open") publicError(409, "GitHub conflict is already closed");
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [];
  const existingTask = tasks.find((task) => task.id === conflict.taskId);
  if (!existingTask) publicError(404, "Conflict task not found");
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const project = projects.find((item) => item.id === existingTask.projectId);
  if (!project) publicError(400, "Conflict task project is not in this workspace");
  assertProjectCompanyScope(project, session);

  const resolution = githubConflictResolutionValue(body.resolution || body.action);
  const resolvedAt = new Date().toISOString();
  const nextConflict = {
    ...conflict,
    status: resolution === "ignore" ? "ignored" : "resolved",
    resolution,
    resolutionNote: cleanString(body.note).slice(0, 500),
    resolvedAt,
    resolvedBy: session.user.id,
    updatedAt: resolvedAt
  };
  const nextTask = githubConflictResolvedTask(existingTask, conflict, resolution);
  const nextTasks = tasks.map((task) => task.id === existingTask.id ? nextTask : task);
  const nextConflicts = conflicts.map((item) => item.id === conflict.id ? nextConflict : item);

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    tasks: nextTasks,
    integrationConflicts: nextConflicts
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action: "github_conflict_resolve"
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action: "github_conflict_resolve",
    workspaceId: workspace.id,
    detail: `${session.user.name} resolved GitHub conflict for ${nextTask.title} with ${resolution}`
  });
  broadcastRealtimeEvent({
    type: "task",
    collection: "tasks",
    action: "github_conflict_resolve",
    id: nextTask.id,
    projectId: nextTask.projectId,
    companyId: project.companyId || "",
    actorId: session.user.id
  });
  return {
    conflict: nextConflict,
    task: nextTask,
    conflicts: nextConflicts
  };
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
  broadcastRealtimeEvent({
    type: "project",
    collection: "projects",
    action: archived ? "project_archive" : "project_restore",
    id: nextProject.id,
    companyId: nextProject.companyId || "",
    actorId: session.user.id
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
  broadcastRealtimeEvent({
    type: "task",
    collection: "tasks",
    action: archived ? "task_archive" : "task_restore",
    id: nextTask.id,
    projectId: nextTask.projectId,
    companyId: project.companyId || "",
    actorId: session.user.id
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
  broadcastRealtimeEvent({
    type: "record",
    collection: key,
    action,
    id: savedItem.id,
    projectId: savedItem.projectId || "",
    taskId: savedItem.taskId || "",
    companyId: savedItem.companyId || "",
    actorId: session.user.id
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
  assertUploadScope(fileInput, snapshot, session);

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

function assertUploadScope(fileInput, snapshot = {}, session) {
  const projectId = cleanString(fileInput.projectId);
  const taskId = cleanString(fileInput.taskId);
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const project = projects.find((item) => item.id === projectId);
  if (!project) publicError(400, "File upload project is not in this workspace");
  assertProjectCompanyScope(project, session);
  if (!taskId) return;
  const task = tasks.find((item) => item.id === taskId);
  if (!task) publicError(400, "File upload task is not in this workspace");
  if (task.projectId !== projectId) publicError(400, "File upload project does not match task");
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
  const safeFileId = sanitizeStoragePathSegment(file.id);
  if ((storage.driver || "json-file") === "supabase") {
    return uploadSupabaseFileObject({ ...file, safeFileId });
  }
  const uploadRoot = path.join(storage.dataDir || path.join(__dirname, "data"), "uploads");
  const storageKey = `${safeFileId}/${file.fileName}`;
  const outputPath = path.join(uploadRoot, safeFileId, file.fileName);
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
  const storageKey = `${sanitizeStoragePathSegment(workspace.id)}/${file.safeFileId || sanitizeStoragePathSegment(file.id)}/${file.fileName}`;
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

function sanitizeStoragePathSegment(value) {
  return cleanString(value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 120) || crypto.randomUUID();
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
    restoredAt: project.restoredAt ? String(project.restoredAt) : "",
    createdAt: project.createdAt ? String(project.createdAt) : new Date().toISOString(),
    updatedAt: project.updatedAt ? String(project.updatedAt) : project.createdAt ? String(project.createdAt) : new Date().toISOString()
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

function normalizeClientPortalLinkRecord(record) {
  requireRecord(record, "Client portal link");
  const tokenHash = cleanString(record.tokenHash);
  const tokenId = cleanString(record.tokenId) || tokenHash.slice(0, 24);
  if (!record.id || !record.companyId || !tokenHash) {
    publicError(400, "Client portal link requires id, companyId, and tokenHash");
  }
  return {
    id: String(record.id),
    companyId: String(record.companyId),
    tokenHash,
    tokenId,
    status: cleanString(record.status) === "revoked" ? "revoked" : "active",
    createdBy: cleanString(record.createdBy),
    createdAt: record.createdAt ? String(record.createdAt) : new Date().toISOString(),
    expiresAt: record.expiresAt ? String(record.expiresAt) : new Date(Date.now() + PORTAL_LINK_TTL_MS).toISOString(),
    revokedAt: record.revokedAt ? String(record.revokedAt) : "",
    copiedAt: record.copiedAt ? String(record.copiedAt) : "",
    emailedAt: record.emailedAt ? String(record.emailedAt) : "",
    viewedAt: record.viewedAt ? String(record.viewedAt) : "",
    viewCount: Math.max(0, Number(record.viewCount || 0)),
    packetSignature: cleanString(record.packetSignature),
    updatedAt: record.updatedAt ? String(record.updatedAt) : record.createdAt ? String(record.createdAt) : new Date().toISOString()
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
    boardOrder: Number.isFinite(Number(task.boardOrder ?? task.sortOrder ?? task.customFields?.boardOrder)) ? Number(task.boardOrder ?? task.sortOrder ?? task.customFields?.boardOrder) : 0,
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
  const kind = cleanString(comment.kind);
  const status = cleanString(comment.status);
  return {
    id: String(comment.id),
    taskId: String(comment.taskId),
    parentId: comment.parentId ? String(comment.parentId) : "",
    author: comment.author ? String(comment.author) : "",
    body: String(comment.body),
    kind: ["comment", "question", "decision"].includes(kind) ? kind : "comment",
    status: ["open", "resolved"].includes(status) ? status : "open",
    mentionIds: Array.isArray(comment.mentionIds) ? comment.mentionIds.map(String) : [],
    resolvedAt: comment.resolvedAt ? String(comment.resolvedAt) : "",
    resolvedBy: comment.resolvedBy ? String(comment.resolvedBy) : "",
    createdAt: comment.createdAt ? String(comment.createdAt) : new Date().toISOString(),
    updatedAt: comment.updatedAt ? String(comment.updatedAt) : comment.createdAt ? String(comment.createdAt) : new Date().toISOString()
  };
}

function normalizeChatMessage(message) {
  requireRecord(message, "Chat message");
  if (!message.id || !message.body) {
    publicError(400, "Chat message requires id and body");
  }
  const channel = cleanString(message.channel);
  const linkType = cleanString(message.linkType);
  return {
    id: String(message.id),
    channel: ["general", "delivery", "product", "client"].includes(channel) ? channel : "general",
    author: message.author ? String(message.author) : "",
    body: cleanString(message.body).slice(0, 600),
    projectId: message.projectId ? String(message.projectId) : "",
    linkType: ["task", "document", "approval"].includes(linkType) ? linkType : "",
    linkId: message.linkId ? String(message.linkId) : "",
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

function normalizeAutomationRuleRecord(rule) {
  requireRecord(rule, "Automation rule");
  const triggerKind = cleanString(rule.triggerKind || triggerKindFromAutomationText(rule.trigger));
  const actionKind = cleanString(rule.actionKind || actionKindFromAutomationText(rule.action));
  const conditionKind = cleanString(rule.conditionKind || "any");
  const createdAt = rule.createdAt ? String(rule.createdAt) : new Date().toISOString();
  return {
    id: cleanString(rule.id) || `automation-${crypto.randomUUID()}`,
    name: cleanString(rule.name || "Untitled automation").slice(0, 100),
    trigger: cleanString(rule.trigger || automationTriggerLabel(triggerKind)).slice(0, 180),
    action: cleanString(rule.action || automationActionLabel(actionKind)).slice(0, 200),
    triggerKind: ["task_due_soon", "task_blocked", "intake_high", "approval_pending", "milestone_due", "portal_feature_request", "portal_approval", "portal_comment", "import_completed"].includes(triggerKind) ? triggerKind : "task_due_soon",
    conditionKind: ["any", "project", "assignee", "company", "priority", "tag"].includes(conditionKind) ? conditionKind : "any",
    conditionValue: cleanString(rule.conditionValue).slice(0, 100),
    actionKind: ["create_task", "set_risk", "set_priority", "add_activity", "draft_update", "notify_channel", "schedule_reminder"].includes(actionKind) ? actionKind : "create_task",
    actionTarget: cleanString(rule.actionTarget).slice(0, 120),
    enabled: rule.enabled !== false,
    lastRun: cleanString(rule.lastRun),
    runCount: Math.max(0, Math.round(Number(rule.runCount || 0))),
    marketplacePackId: cleanString(rule.marketplacePackId).slice(0, 120),
    source: cleanString(rule.source).slice(0, 64),
    creatorName: cleanString(rule.creatorName).slice(0, 120),
    installedAt: cleanString(rule.installedAt),
    license: cleanString(rule.license).slice(0, 120),
    createdAt,
    updatedAt: rule.updatedAt ? String(rule.updatedAt) : createdAt
  };
}

function normalizeAutomationRunRecord(run) {
  requireRecord(run, "Automation run");
  const createdAt = run.createdAt ? String(run.createdAt) : new Date().toISOString();
  return {
    id: cleanString(run.id) || `automation-run-${crypto.randomUUID()}`,
    automationId: cleanString(run.automationId),
    triggerKind: cleanString(run.triggerKind).slice(0, 80),
    source: cleanString(run.source || "server").slice(0, 64),
    status: ["applied", "failed", "rolled-back"].includes(cleanString(run.status)) ? cleanString(run.status) : "applied",
    changedCount: Math.max(0, Math.round(Number(run.changedCount || 0))),
    summary: cleanString(run.summary).slice(0, 260),
    createdAt,
    updatedAt: run.updatedAt ? String(run.updatedAt) : createdAt
  };
}

function triggerKindFromAutomationText(value = "") {
  const text = cleanString(value).toLowerCase();
  if (text.includes("portal") && text.includes("feature")) return "portal_feature_request";
  if (text.includes("portal") && text.includes("approval")) return "portal_approval";
  if (text.includes("portal") && text.includes("comment")) return "portal_comment";
  if (text.includes("import")) return "import_completed";
  if (text.includes("intake")) return "intake_high";
  if (text.includes("blocked")) return "task_blocked";
  if (text.includes("approval")) return "approval_pending";
  if (text.includes("milestone")) return "milestone_due";
  return "task_due_soon";
}

function actionKindFromAutomationText(value = "") {
  const text = cleanString(value).toLowerCase();
  if (text.includes("priority")) return "set_priority";
  if (text.includes("risk")) return "set_risk";
  if (text.includes("reminder")) return "schedule_reminder";
  if (text.includes("notify")) return "notify_channel";
  if (text.includes("activity") || text.includes("comment")) return "add_activity";
  if (text.includes("update")) return "draft_update";
  return "create_task";
}

function automationTriggerLabel(triggerKind) {
  return ({
    task_due_soon: "Task due soon",
    task_blocked: "Task is blocked",
    intake_high: "High urgency intake",
    approval_pending: "Approval pending",
    milestone_due: "Milestone due soon",
    portal_feature_request: "Portal feature request submitted",
    portal_approval: "Portal approval changed",
    portal_comment: "Portal comment added",
    import_completed: "Import completed"
  })[triggerKind] || "Task due soon";
}

function automationActionLabel(actionKind) {
  return ({
    create_task: "Create follow-up task",
    set_risk: "Set risk field",
    set_priority: "Set priority",
    add_activity: "Record activity",
    draft_update: "Draft client update",
    notify_channel: "Notify integration channel",
    schedule_reminder: "Schedule reminder"
  })[actionKind] || "Create follow-up task";
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
  if (value === null || value === undefined || value === "") return fallback;
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
  validateSafeJsonObject(snapshot, "snapshot", 0);
  validateWorkspaceSnapshotShape(snapshot);
}

function validateSafeJsonObject(value, label, depth) {
  if (depth > 12) publicError(400, `${label} is too deeply nested`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item && typeof item === "object") validateSafeJsonObject(item, `${label}[${index}]`, depth + 1);
    });
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach((key) => {
    if (["__proto__", "constructor", "prototype"].includes(key)) {
      publicError(400, `${label} contains unsafe key ${key}`);
    }
    const nextValue = value[key];
    if (nextValue && typeof nextValue === "object") validateSafeJsonObject(nextValue, `${label}.${key}`, depth + 1);
  });
}

function validateWorkspaceSnapshotShape(snapshot) {
  const arrayFields = {
    companies: 1000,
    projects: 5000,
    tasks: 25000,
    milestones: 10000,
    comments: 50000,
    activities: 50000,
    timeEntries: 50000,
    approvals: 10000,
    documents: 10000,
    files: 10000,
    intakeForms: 5000,
    intakeSubmissions: 25000,
    users: 5000,
    memberships: 5000,
    invitations: 5000,
    projectTemplates: 5000,
    taskTemplates: 5000,
    automationRules: 5000,
    automationRuns: 25000,
    notificationHistory: 25000,
    notificationReminders: 10000,
    raidItems: 10000,
    goals: 5000,
    projectBacklog: 10000,
    chatMessages: 25000,
    whiteboards: 5000,
    dashboards: 1000,
    savedViews: 1000,
    auditEvents: 25000
  };
  Object.entries(arrayFields).forEach(([field, limit]) => {
    if (snapshot[field] === undefined) return;
    if (!Array.isArray(snapshot[field])) publicError(400, `Workspace snapshot ${field} must be an array`);
    if (snapshot[field].length > limit) publicError(413, `Workspace snapshot ${field} exceeds ${limit} records`);
    snapshot[field].forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        publicError(400, `Workspace snapshot ${field}[${index}] must be an object`);
      }
    });
  });
  if (snapshot.workspace !== undefined && (!snapshot.workspace || typeof snapshot.workspace !== "object" || Array.isArray(snapshot.workspace))) {
    publicError(400, "Workspace snapshot workspace must be an object");
  }
  validateRequiredStringRecords(snapshot.projects, "projects", ["id", "name"]);
  validateRequiredStringRecords(snapshot.tasks, "tasks", ["id", "projectId", "title"]);
  validateRequiredStringRecords(snapshot.companies, "companies", ["id", "name"]);
}

function validateRequiredStringRecords(records, field, keys) {
  if (!Array.isArray(records)) return;
  records.forEach((record, index) => {
    keys.forEach((key) => {
      if (!cleanString(record[key])) publicError(400, `Workspace snapshot ${field}[${index}].${key} is required`);
    });
  });
}

function publicError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  throw error;
}

function readJsonBody(request, limitBytes = BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      raw += chunk;
      if (Buffer.byteLength(raw) > limitBytes) {
        tooLarge = true;
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        error.publicMessage = "Request body is too large";
        reject(error);
      }
    });
    request.on("end", () => {
      if (tooLarge) return;
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

function readJsonBodyWithRaw(request, limitBytes = BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limitBytes) {
        tooLarge = true;
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        error.publicMessage = "Request body is too large";
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({ raw: "", json: {} });
        return;
      }
      try {
        resolve({ raw, json: JSON.parse(raw) });
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
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-GitHub-Event, X-GitHub-Delivery, X-Hub-Signature-256");
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

function writeRealtimeEvent(response, event) {
  response.write(`event: ${event.type || "workspace"}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function openRealtimeStream(request, response, session) {
  setSecurityHeaders(response);
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  const client = {
    id: crypto.randomUUID(),
    memberId: session.user.id,
    companyId: sessionCompanyId(session),
    response
  };
  realtimeClients.add(client);
  writeRealtimeEvent(response, {
    type: "connected",
    clientId: client.id,
    memberId: client.memberId,
    generatedAt: new Date().toISOString()
  });
  const heartbeat = setInterval(() => {
    writeRealtimeEvent(response, { type: "heartbeat", generatedAt: new Date().toISOString() });
  }, 25000);
  request.on("close", () => {
    clearInterval(heartbeat);
    realtimeClients.delete(client);
  });
}

function broadcastRealtimeEvent(event = {}) {
  const payload = {
    ...event,
    generatedAt: event.generatedAt || new Date().toISOString()
  };
  for (const client of realtimeClients) {
    if (payload.companyId && client.companyId && payload.companyId !== client.companyId) continue;
    try {
      writeRealtimeEvent(client.response, payload);
    } catch {
      realtimeClients.delete(client);
    }
  }
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
