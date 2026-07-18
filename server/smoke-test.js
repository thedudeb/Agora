const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("./api");
const { createStorage, createSupabaseStorage } = require("./storage");
const { runDisasterRecoveryDrill } = require("../scripts/disaster-recovery-drill");

async function run() {
  process.env.AGORA_PUBLIC_FEATURE_REQUESTS = "true";
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-api-"));
  process.env.AGORA_BACKUP_DIR = path.join(dataDir, "backups");
  const storage = createStorage({ dataDir, driver: "json" });
  await storage.saveBackgroundJobs([
    {
      id: "job-json-failed-smoke",
      type: "unknown-smoke-job",
      status: "failed",
      attempts: 3,
      maxAttempts: 3,
      metadata: { taskId: "task-smoke" },
      payload: {},
      error: "Smoke failure",
      createdAt: "2026-06-28T12:00:00.000Z",
      updatedAt: "2026-06-28T12:05:00.000Z",
      finishedAt: "2026-06-28T12:05:00.000Z"
    },
    {
      id: "job-json-queued-smoke",
      type: "unknown-smoke-job",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      metadata: { taskId: "task-smoke" },
      payload: {},
      createdAt: "2026-06-28T12:00:00.000Z",
      updatedAt: "2026-06-28T12:00:00.000Z"
    }
  ]);
  const icmContextBody = "# Sparkz - context for AI\n\nDecision: Lead with creator features, not a token.\nTask: Review the tokenless launch plan.";
  const icmRemoteRequests = [];
  const server = createServer({
    storage,
    allowDemoAuth: true,
    allowPasswordlessAuth: true,
    remoteFetch: async (url, options = {}) => {
      icmRemoteRequests.push({ url: String(url), options });
      if (String(url).includes("icm_OversizedContext")) {
        return new Response("x".repeat(13 * 1024), { headers: { "content-type": "text/plain" } });
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "text/plain; charset=utf-8",
          "content-length": String(Buffer.byteLength(icmContextBody))
        }),
        text: async () => icmContextBody
      };
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await request(`${baseUrl}/api/health`);
    assert(health.ok === true, "health endpoint failed");
    assert(health.version, "health endpoint did not expose API version");
    assert(health.release?.version === health.version, "health endpoint did not expose release metadata");
    const rawHealth = await requestRaw(`${baseUrl}/api/health`);
    assert(rawHealth.headers.get("x-request-id"), "health endpoint did not include request id header");
    const corsEnv = {
      nodeEnv: process.env.NODE_ENV,
      allowedOrigins: process.env.AGORA_ALLOWED_ORIGINS,
      allowLocalhostOrigins: process.env.AGORA_ALLOW_LOCALHOST_ORIGINS
    };
    try {
      process.env.NODE_ENV = "production";
      delete process.env.AGORA_ALLOWED_ORIGINS;
      delete process.env.AGORA_ALLOW_LOCALHOST_ORIGINS;
      const blockedLocalhostCors = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "http://localhost:5174" }
      });
      assert(blockedLocalhostCors.status === 403, "production CORS should reject implicit localhost origins");
      process.env.AGORA_ALLOWED_ORIGINS = "http://localhost:5174";
      const allowedConfiguredCors = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "http://localhost:5174" }
      });
      assert(allowedConfiguredCors.status === 200, "configured production CORS origin should be allowed");
      assert(allowedConfiguredCors.headers.get("access-control-allow-origin") === "http://localhost:5174", "configured CORS origin was not echoed");
    } finally {
      restoreOptionalEnv("NODE_ENV", corsEnv.nodeEnv);
      restoreOptionalEnv("AGORA_ALLOWED_ORIGINS", corsEnv.allowedOrigins);
      restoreOptionalEnv("AGORA_ALLOW_LOCALHOST_ORIGINS", corsEnv.allowLocalhostOrigins);
    }

    const capabilities = await request(`${baseUrl}/api/capabilities`);
    assert(capabilities.service === "agora-api", "capabilities endpoint returned wrong service");
    assert(capabilities.auth?.bearer === true, "capabilities endpoint did not describe bearer auth");
    assert(capabilities.resources?.structuredCollections?.includes("comments"), "capabilities endpoint missed structured collections");
    assert(capabilities.agentDefaults?.readOnlyByDefault === true, "capabilities endpoint missed agent defaults");

    const openApi = await request(`${baseUrl}/api/openapi.json`);
    assert(openApi.openapi === "3.1.0", "openapi endpoint returned wrong version");
    assert(openApi.paths?.["/api/tasks"]?.get, "openapi endpoint missed tasks list route");
    assert(openApi.paths?.["/api/backups/run"]?.post, "openapi endpoint missed backup run route");
    assert(openApi.paths?.["/api/admin/diagnostics"]?.get, "openapi endpoint missed admin diagnostics route");
    assert(openApi.paths?.["/api/integrations/icm/context/preview"]?.post, "openapi endpoint missed ICM context preview route");
    assert(openApi.components?.securitySchemes?.bearerAuth, "openapi endpoint missed bearer auth scheme");

    const login = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    assert(login.token, "demo login did not return a token");
    assert(!login.tokenHash, "demo login leaked internal token hash");
    assert(login.membership.role === "admin", "demo login did not return admin role");
    assert(login.expiresAt, "session did not include an expiry");

    const access = await request(`${baseUrl}/api/members`, {
      token: login.token
    });
    assert(access.users.length === 4, "member list did not include demo users");

    const invalidIcmContext = await requestError(`${baseUrl}/api/integrations/icm/context/preview`, {
      method: "POST",
      token: login.token,
      body: { url: "https://example.com/private-context" }
    });
    assert(invalidIcmContext.status === 400, "ICM preview should reject non-ICM URLs");
    assert(icmRemoteRequests.length === 0, "ICM preview should reject unsafe URLs before fetching");

    const memberIcmLogin = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "nina" }
    });
    const blockedMemberIcmContext = await requestError(`${baseUrl}/api/integrations/icm/context/preview`, {
      method: "POST",
      token: memberIcmLogin.token,
      body: { hash: "icm_SparkzContext" }
    });
    assert(blockedMemberIcmContext.status === 403, "member should not preview remote ICM context");

    const blockedMemberPilotReview = await requestError(`${baseUrl}/api/records/sparkzPilotReviews`, {
      method: "POST",
      token: memberIcmLogin.token,
      body: { record: { projectId: "launch", creatorName: "Pilot creator" } }
    });
    assert(blockedMemberPilotReview.status === 403, "member should not update Sparkz pilot reviews");

    const icmContext = await request(`${baseUrl}/api/integrations/icm/context/preview`, {
      method: "POST",
      token: login.token,
      body: { url: "https://www.useicm.com/api/objects/icm_SparkzContext/llm.txt" }
    });
    assert(icmContext.type === "agora.icm-context-preview", "ICM preview returned the wrong type");
    assert(icmContext.sourceUrl === "https://useicm.com/api/objects/icm_SparkzContext/llm.txt", "ICM preview did not canonicalize the source URL");
    assert(icmContext.content === icmContextBody, "ICM preview returned unexpected content");
    assert(icmContext.contentHash.length === 64, "ICM preview did not include a SHA-256 content hash");
    assert(icmContext.readOnly === true && icmContext.untrusted === true, "ICM preview did not expose its safety posture");
    assert(icmRemoteRequests.length === 1 && icmRemoteRequests[0].url === icmContext.sourceUrl, "ICM preview fetched an unexpected URL");
    assert(icmRemoteRequests[0].options.redirect === "error", "ICM preview should reject provider redirects");

    const oversizedIcmContext = await requestError(`${baseUrl}/api/integrations/icm/context/preview`, {
      method: "POST",
      token: login.token,
      body: { hash: "icm_OversizedContext" }
    });
    assert(oversizedIcmContext.status === 413, "ICM preview should stop streaming context above 12 KB");

    const secondLogin = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    assert(secondLogin.token && secondLogin.token !== login.token, "second demo login did not create a distinct token");

    const activeSessions = await request(`${baseUrl}/api/auth/sessions`, {
      token: login.token
    });
    assert(activeSessions.scope === "workspace", "admin session list should include workspace scope");
    assert(activeSessions.summary?.durablePersistence === true, "session list did not expose durable persistence");
    assert(activeSessions.summary?.rotationSupported === true, "session list did not expose rotation support");
    const currentListedSession = activeSessions.sessions.find((item) => item.current === true && item.user.id === "mara");
    assert(currentListedSession, "session list did not include current session");
    assert(currentListedSession.clientIpHash && currentListedSession.clientIpHash.length === 16, "session list did not expose redacted client hash");
    assert(currentListedSession.durable === true, "session list did not mark durable token hash metadata");
    const secondSession = activeSessions.sessions.find((item) => item.current === false && item.user.id === "mara");
    assert(secondSession?.id, "session list did not expose second session id");
    assert(secondSession.status === "active", "session list did not expose active status");
    assert(secondSession.lastSeenAt, "session list did not expose last seen timestamp");
    assert(Number.isFinite(secondSession.requestCount), "session list did not expose request count");
    assert(typeof secondSession.userAgent === "string" && !secondSession.userAgent.includes(secondLogin.token), "session list leaked unexpected user-agent data");
    assert(!secondSession.id.includes(secondLogin.token), "session list leaked raw token");

    const revokedSession = await request(`${baseUrl}/api/auth/sessions/${secondSession.id}`, {
      method: "DELETE",
      token: login.token
    });
    assert(revokedSession.ok === true && revokedSession.revoked === secondSession.id, "session revoke did not return revoked id");
    const revokedAccess = await requestError(`${baseUrl}/api/session`, {
      token: secondLogin.token
    });
    assert(revokedAccess.status === 401, "revoked token should not authenticate");
    assert(revokedAccess.body.requestId, "error responses should include request id");

    const thirdLogin = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    const revokeOthers = await request(`${baseUrl}/api/auth/sessions/revoke-others`, {
      method: "POST",
      token: login.token
    });
    assert(revokeOthers.ok === true && revokeOthers.revoked.length >= 1, "revoke other sessions did not revoke extra sessions");
    const revokedOtherAccess = await requestError(`${baseUrl}/api/session`, {
      token: thirdLogin.token
    });
    assert(revokedOtherAccess.status === 401, "revoke other sessions left old token active");

    const rotateLogin = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    const rotated = await request(`${baseUrl}/api/auth/session/rotate`, {
      method: "POST",
      token: rotateLogin.token
    });
    assert(rotated.token && rotated.token !== rotateLogin.token, "session rotation did not issue a fresh token");
    assert(!rotated.tokenHash, "session rotation leaked internal token hash");
    assert(rotated.rotatedFrom, "session rotation did not include previous token id");
    const oldRotatedAccess = await requestError(`${baseUrl}/api/session`, {
      token: rotateLogin.token
    });
    assert(oldRotatedAccess.status === 401, "rotated old token should not authenticate");
    const newRotatedAccess = await request(`${baseUrl}/api/session`, {
      token: rotated.token
    });
    assert(newRotatedAccess.user.id === "mara", "rotated session token did not authenticate");
    assert(!newRotatedAccess.tokenHash, "current session endpoint leaked internal token hash");
    await request(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      token: rotated.token
    });

    let backendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: login.token
    });
    if (!backendHealth.jobs?.recent?.some((job) => job.id === "job-json-failed-smoke")) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      backendHealth = await request(`${baseUrl}/api/backend/health`, {
        token: login.token
      });
    }
    assert(backendHealth.storage === "json-file", "backend health did not expose storage driver");
    assert(backendHealth.auth === "local", "backend health did not expose auth driver");
    assert(backendHealth.release?.version === health.version, "backend health did not expose release metadata");
    assert(backendHealth.records.some((record) => record.key === "comments"), "backend health did not report record collections");
    assert(backendHealth.readiness.some((item) => item.id === "structured-records"), "backend health did not include readiness items");
    assert(backendHealth.readiness.some((item) => item.id === "record-query-api"), "backend health did not include query API readiness");
    assert(backendHealth.productionGates.some((item) => item.id === "allowed-origins"), "backend health did not include production gates");
    assert(backendHealth.productionGates.some((item) => item.id === "public-app-url"), "backend health did not include public app URL gate");
    assert(backendHealth.productionGates.some((item) => item.id === "public-feature-abuse"), "backend health did not include public feature abuse gate");
    assert(backendHealth.productionGates.some((item) => item.id === "strict-csp"), "backend health did not include strict CSP gate");
    assert(backendHealth.readiness.some((item) => item.id === "password-reset-delivery"), "backend readiness did not include reset delivery gate");
    assert(backendHealth.readiness.some((item) => item.id === "session-hardening"), "backend readiness did not include session hardening");
    assert(backendHealth.sessionHardening?.ttlHours <= 12, "backend health did not expose hardened session ttl");
    assert(backendHealth.readiness.some((item) => item.id === "notification-delivery-map"), "backend readiness did not include notification delivery map");
    assert(Array.isArray(backendHealth.notificationDelivery?.matrix), "backend health did not expose notification delivery matrix");
    assert(backendHealth.notificationDelivery.matrix.some((item) => item.id === "portal-action"), "notification delivery matrix missed portal actions");
    assert(backendHealth.notificationDelivery.blockers.some((item) => item.id === "public-feature-request"), "notification delivery matrix did not flag unconfigured feature request email");
    assert(["smtp", "not-configured"].includes(backendHealth.email?.portalActions?.mode), "backend health did not expose portal action email status");
    assert(backendHealth.observability && Number.isFinite(backendHealth.observability.total), "backend health did not include observability metrics");
    assert(backendHealth.jobs && Array.isArray(backendHealth.jobs.recent), "backend health did not include job metrics");
    assert(backendHealth.jobs.recent.some((job) => job.id === "job-json-failed-smoke"), "backend health did not hydrate persisted job history");
    const observability = await request(`${baseUrl}/api/observability`, {
      token: login.token
    });
    assert(observability.requestId, "observability snapshot did not expose request id");
    assert(observability.logging?.requestIdHeader === "X-Request-Id", "observability snapshot did not describe request id header");
    assert(observability.requests?.recentErrors?.some((item) => item.requestId), "observability recent errors did not include request ids");
    assert(Number.isFinite(observability.rateLimits?.trackedKeys), "observability snapshot did not expose rate-limit counts");
    const backupStatusBefore = await request(`${baseUrl}/api/backups/status`, {
      token: login.token
    });
    assert(backupStatusBefore.enabled === true, "backup status should be enabled by default");
    const backupRun = await request(`${baseUrl}/api/backups/run`, {
      method: "POST",
      token: login.token
    });
    assert(backupRun.ok === true && backupRun.file.endsWith(".json"), "backup run did not create a JSON backup");
    const backupPath = path.join(process.env.AGORA_BACKUP_DIR, backupRun.file);
    assert(fs.existsSync(backupPath), "backup file was not written");
    const recoveryProof = runDisasterRecoveryDrill({
      backup: backupPath,
      outDir: path.join(dataDir, "recovery-proof")
    });
    assert(
      recoveryProof.ok === true,
      `fresh API backup did not pass the isolated recovery drill: ${recoveryProof.checks.filter((check) => check.status === "fail").map((check) => `${check.label}: ${check.detail}`).join("; ")}`
    );
    assert(fs.existsSync(recoveryProof.restoredWorkspacePath), "recovery drill did not write the restored workspace proof");
    const backupStatusAfter = await request(`${baseUrl}/api/backups/status`, {
      token: login.token
    });
    assert(backupStatusAfter.latest?.file === backupRun.file, "backup status did not report latest backup");
    backendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: login.token
    });
    assert(backendHealth.backups?.latest?.file === backupRun.file, "backend health did not expose latest backup");
    assert(backendHealth.readiness.some((item) => item.id === "workspace-backups"), "backend health did not include backup readiness");
    const diagnostics = await request(`${baseUrl}/api/admin/diagnostics`, {
      token: login.token
    });
    assert(diagnostics.type === "agora.admin-diagnostics", "admin diagnostics returned wrong type");
    assert(diagnostics.env && diagnostics.env.backupDirConfigured === true, "admin diagnostics did not include redacted env posture");
    const diagnosticsText = JSON.stringify(diagnostics);
    assert(!diagnosticsText.includes(login.token), "admin diagnostics leaked raw session token");
    assert(!diagnosticsText.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || "replace-me-service-role-key"), "admin diagnostics leaked service role key");
    const canceledJob = await request(`${baseUrl}/api/backend/jobs/job-json-queued-smoke/cancel`, {
      method: "POST",
      token: login.token
    });
    assert(canceledJob.job.status === "canceled", "background job cancel action failed");
    const retryBlocked = await requestError(`${baseUrl}/api/backend/jobs/job-json-failed-smoke/retry`, {
      method: "POST",
      token: login.token
    });
    assert(retryBlocked.status === 400, "unregistered background job retry should fail");
    const clearedJob = await request(`${baseUrl}/api/backend/jobs/job-json-failed-smoke/clear`, {
      method: "POST",
      token: login.token
    });
    assert(clearedJob.job.status === "cleared", "background job clear action failed");
    assert(!clearedJob.jobs.recent.some((job) => job.id === "job-json-failed-smoke"), "cleared background job stayed in recent list");
    await storage.saveBackgroundJobs([{
      id: "job-json-smoke",
      type: "feature-request-email",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      metadata: { taskId: "task-smoke" },
      payload: { to: "owner@example.test", subject: "Feature request", text: "Smoke" },
      createdAt: "2026-06-28T12:00:00.000Z",
      updatedAt: "2026-06-28T12:00:00.000Z"
    }]);
    const storedJobs = await storage.loadBackgroundJobs();
    assert(storedJobs.some((job) => job.id === "job-json-smoke" && job.payload.to === "owner@example.test"), "json background job persistence failed");

    const integrationSync = await request(`${baseUrl}/api/integrations/sync`, {
      method: "POST",
      token: login.token,
      body: {
        provider: "github",
        direction: "inbound",
        mapping: { issueTitle: "title", issueState: "status" },
        records: [{ externalId: "thedudeb/Agora#123", agoraId: "task-smoke" }]
      }
    });
    assert(integrationSync.job?.type === "integration-sync", "integration sync did not enqueue a job");
    assert(integrationSync.job.metadata.provider === "github", "integration sync job missed provider metadata");
    assert(integrationSync.jobs.recent.some((job) => job.id === integrationSync.job.id && job.payloadPreview?.preview?.records?.count === 1), "integration sync job did not expose payload preview");
    let integrationJobHealth = await request(`${baseUrl}/api/backend/health`, {
      token: login.token
    });
    if (!integrationJobHealth.jobs.recent.some((job) => job.id === integrationSync.job.id)) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      integrationJobHealth = await request(`${baseUrl}/api/backend/health`, {
        token: login.token
      });
    }
    assert(integrationJobHealth.jobs.recent.some((job) => job.id === integrationSync.job.id), "backend health did not expose integration sync job");

    const aiOperator = await request(`${baseUrl}/api/ai/operator`, {
      method: "POST",
      token: login.token,
      body: {
        mode: "workspace_brief",
        settings: { provider: "local", model: "Agora deterministic operator" },
        context: {
          workspace: { name: "Smoke Test Studio" },
          tasks: [{ id: "task-smoke", title: "Smoke Task", priority: "high", status: "todo" }]
        }
      }
    });
    assert(aiOperator.title.includes("operator brief"), "AI operator did not return a brief title");
    assert(aiOperator.body.includes("Smoke Task"), "AI operator did not use provided context");

    const invitation = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: login.token,
      body: {
        name: "Jordan Lee",
        email: "jordan@example.test",
        role: "member"
      }
    });
    assert(invitation.invitation.token, "invite did not return an acceptance token");
    assert(invitation.invitation.status === "pending", "invite did not start pending");
    assert(invitation.invitation.acceptUrl.startsWith("#invite/"), "invite did not return a browser accept route");

    const invitationPreview = await request(`${baseUrl}/api/invitations/${invitation.invitation.token}`);
    assert(invitationPreview.invitation.email === "jordan@example.test", "public invitation lookup failed");
    for (let index = 0; index < 11; index += 1) {
      const missingInvitation = await requestError(`${baseUrl}/api/invitations/missing-${index}`);
      assert(missingInvitation.status === 404, "missing invite should fail before lookup rate limit is exhausted");
    }
    const rateLimitedInvitationLookup = await requestError(`${baseUrl}/api/invitations/missing-rate-limited`);
    assert(rateLimitedInvitationLookup.status === 429, "public invitation lookup should be rate limited");

    const accepted = await request(`${baseUrl}/api/invitations/${invitation.invitation.token}/accept`, {
      method: "POST",
      body: { name: "Jordan Lee" }
    });
    assert(accepted.token, "accepted invite did not create a session");
    assert(accepted.user.email === "jordan@example.test", "accepted invite did not return invited user");
    assert(accepted.membership.role === "member", "accepted invite did not use invited role");

    const managerInvitation = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: login.token,
      body: {
        name: "Workspace Manager",
        email: "manager@example.test",
        role: "manager"
      }
    });
    const memberAccess = await request(`${baseUrl}/api/members`, { token: accepted.token });
    assert(memberAccess.invitations.some((item) => item.id === managerInvitation.invitation.id), "members should see invitation status metadata");
    assert(memberAccess.invitations.every((item) => !item.token && !item.acceptUrl), "member access leaked invitation acceptance secrets");
    const acceptedManager = await request(`${baseUrl}/api/invitations/${managerInvitation.invitation.token}/accept`, {
      method: "POST",
      body: { name: "Workspace Manager", password: "manager-secret" }
    });
    const managerWorkspace = await request(`${baseUrl}/api/workspace`, { token: acceptedManager.token });
    const attemptedMemberships = managerWorkspace.snapshot.memberships.map((item) => item.memberId === acceptedManager.user.id
      ? { ...item, role: "admin" }
      : item);
    const managerSave = await request(`${baseUrl}/api/workspace`, {
      method: "PUT",
      token: acceptedManager.token,
      body: {
        expectedRevision: managerWorkspace.metadata.revision,
        snapshot: {
          ...managerWorkspace.snapshot,
          users: managerWorkspace.snapshot.users.map((item) => item.id === acceptedManager.user.id
            ? { ...item, passwordHash: "attacker-controlled", passwordSalt: "attacker-controlled" }
            : item),
          memberships: attemptedMemberships,
          invitations: [{ id: "forged-invite", token: "forged-token", email: "attacker@example.test", role: "admin", status: "pending" }]
        }
      }
    });
    const savedManagerMembership = managerSave.snapshot.memberships.find((item) => item.memberId === acceptedManager.user.id);
    assert(savedManagerMembership?.role === "manager", "workspace save allowed manager role escalation");
    assert(!managerSave.snapshot.invitations.some((item) => item.id === "forged-invite"), "workspace save allowed invitation injection");
    assert(managerSave.metadata.revision > managerWorkspace.metadata.revision, "workspace save did not advance its revision");
    const staleManagerSave = await requestError(`${baseUrl}/api/workspace`, {
      method: "PUT",
      token: acceptedManager.token,
      body: { expectedRevision: managerWorkspace.metadata.revision, snapshot: managerWorkspace.snapshot }
    });
    assert(staleManagerSave.status === 409, "stale workspace save should return a conflict");
    const managerLogin = await request(`${baseUrl}/api/auth/password-login`, {
      method: "POST",
      body: { email: "manager@example.test", password: "manager-secret" }
    });
    assert(managerLogin.membership.role === "manager", "workspace save changed manager access state");
    const demotedManager = await request(`${baseUrl}/api/members/${encodeURIComponent(acceptedManager.user.id)}`, {
      method: "PATCH",
      token: login.token,
      body: { role: "member" }
    });
    assert(demotedManager.membership.role === "member", "member access endpoint did not update role");
    const revokedManagerSession = await requestError(`${baseUrl}/api/workspace`, { token: managerLogin.token });
    assert(revokedManagerSession.status === 401, "member access update did not revoke stale privileged sessions");

    const blockedMemberEmailTest = await requestError(`${baseUrl}/api/notifications/test-email`, {
      method: "POST",
      token: accepted.token,
      body: { to: "jordan@example.test" }
    });
    assert(blockedMemberEmailTest.status === 403, "member should not send server notification test email");
    const aiEnv = {
      allowClientBaseUrl: process.env.AGORA_AI_ALLOW_CLIENT_BASE_URL,
      allowedBaseUrls: process.env.AGORA_AI_ALLOWED_BASE_URLS
    };
    try {
      process.env.AGORA_AI_ALLOW_CLIENT_BASE_URL = "true";
      process.env.AGORA_AI_ALLOWED_BASE_URLS = "http://127.0.0.1:11434";
      const blockedMemberAiBaseUrl = await requestError(`${baseUrl}/api/ai/operator`, {
        method: "POST",
        token: accepted.token,
        body: {
          mode: "workspace_brief",
          settings: { provider: "local", baseUrl: "http://127.0.0.1:11434" },
          context: { workspace: { name: "Blocked AI Base URL" } }
        }
      });
      assert(blockedMemberAiBaseUrl.status === 403, "member should not select client AI base URLs");
      const adminAiBaseUrl = await request(`${baseUrl}/api/ai/operator`, {
        method: "POST",
        token: login.token,
        body: {
          mode: "workspace_brief",
          settings: { provider: "local", baseUrl: "http://127.0.0.1:11434" },
          context: { workspace: { name: "Allowed AI Base URL" } }
        }
      });
      assert(adminAiBaseUrl.provider.includes("local"), "admin allowlisted AI base URL should keep local provider working");
    } finally {
      restoreOptionalEnv("AGORA_AI_ALLOW_CLIENT_BASE_URL", aiEnv.allowClientBaseUrl);
      restoreOptionalEnv("AGORA_AI_ALLOWED_BASE_URLS", aiEnv.allowedBaseUrls);
    }
    const notificationEmailTest = await request(`${baseUrl}/api/notifications/test-email`, {
      method: "POST",
      token: login.token,
      body: { to: "owner@example.test" }
    });
    assert(notificationEmailTest.email.mode === "not-configured", "test email should report missing SMTP locally");
    const invalidNotificationEmailTest = await requestError(`${baseUrl}/api/notifications/test-email`, {
      method: "POST",
      token: login.token,
      body: { to: "not-an-email" }
    });
    assert(invalidNotificationEmailTest.status === 400, "invalid test email recipient should be rejected");

    const emailLogin = await request(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: { email: "jordan@example.test" }
    });
    assert(emailLogin.user.id === accepted.user.id, "email login did not find accepted invite user");

    const workspaceBeforeSave = await request(`${baseUrl}/api/workspace`, { token: login.token });
    const saved = await request(`${baseUrl}/api/workspace`, {
      method: "PUT",
      token: login.token,
      body: {
        expectedRevision: workspaceBeforeSave.metadata.revision,
        snapshot: {
          workspace: { id: "workspace-acme", name: "Smoke Test Studio" },
          projects: [],
          tasks: []
        }
      }
    });
    assert(saved.snapshot.workspace.name === "Smoke Test Studio", "workspace save failed");

    const malformedImport = await requestError(`${baseUrl}/api/workspace/import`, {
      method: "POST",
      token: login.token,
      body: { snapshot: { workspace: { id: "workspace-acme", name: "Bad import" }, tasks: "not-an-array" } }
    });
    assert(malformedImport.status === 400, "workspace import should reject malformed array fields");

    const unsafeImport = await requestError(`${baseUrl}/api/workspace/import`, {
      method: "POST",
      token: login.token,
      body: {
        snapshot: {
          workspace: { id: "workspace-acme", name: "Unsafe import" },
          projects: [{ id: "project-unsafe", name: "Unsafe Project", constructor: "pollution" }],
          tasks: []
        }
      }
    });
    assert(unsafeImport.status === 400, "workspace import should reject unsafe object keys");

    const paymentConfig = await request(`${baseUrl}/api/payments/config`, {
      token: login.token
    });
    assert(paymentConfig.providers.some((provider) => provider.id === "test" && provider.live === true), "payment config did not expose test adapter");
    assert(paymentConfig.providers.some((provider) => provider.id === "x402"), "payment config did not expose x402 adapter stub");
    assert(paymentConfig.plans.some((plan) => plan.id === "team" && plan.limits.projects === 25), "payment config did not expose plan catalog");

    const blockedMemberPayment = await requestError(`${baseUrl}/api/payments/checkout-intent`, {
      method: "POST",
      token: accepted.token,
      body: {
        provider: "test",
        item: {
          itemType: "project-template",
          itemId: "marketplace-agency-retainer-os",
          name: "Agency Retainer OS",
          amountCents: 1900,
          currency: "USD"
        }
      }
    });
    assert(blockedMemberPayment.status === 403, "member should not create payment intents");

    const checkoutIntent = await request(`${baseUrl}/api/payments/checkout-intent`, {
      method: "POST",
      token: login.token,
      body: {
        provider: "test",
        item: {
          itemType: "project-template",
          itemId: "marketplace-agency-retainer-os",
          name: "Agency Retainer OS",
          amountCents: 1900,
          currency: "USD",
          payout: {
            mode: "charity",
            recipientName: "Open Project Fund",
            walletAddress: "0xCharityWalletExample",
            chain: "Base",
            charityName: "Open Project Fund",
            donationPercent: 100
          }
        }
      }
    });
    assert(checkoutIntent.intent.status === "requires_test_confirmation", "checkout intent did not use test status");
    assert(checkoutIntent.intent.payout.charityName === "Open Project Fund", "checkout intent did not preserve payout metadata");

    const completedCheckout = await request(`${baseUrl}/api/payments/events`, {
      method: "POST",
      token: login.token,
      body: {
        type: "checkout.test_completed",
        intentId: checkoutIntent.intent.id
      }
    });
    assert(completedCheckout.intent.status === "completed", "payment event did not complete intent");
    assert(completedCheckout.entitlement.itemId === "marketplace-agency-retainer-os", "payment event did not issue entitlement");
    assert(completedCheckout.entitlement.checkoutIntentId === checkoutIntent.intent.id, "entitlement did not reference checkout intent");
    assert(completedCheckout.entitlement.payoutSnapshot.charityName === "Open Project Fund", "entitlement did not preserve payout snapshot");

    const paymentEntitlements = await request(`${baseUrl}/api/payments/entitlements`, {
      token: login.token
    });
    assert(paymentEntitlements.entitlements.some((entitlement) => entitlement.itemId === "marketplace-agency-retainer-os"), "payment entitlement list did not include server grant");

    const blockedMarketplacePublish = await requestError(`${baseUrl}/api/marketplace/catalog`, {
      method: "POST",
      token: accepted.token,
      body: {
        projectTemplates: [{
          id: "marketplace-member-blocked",
          name: "Blocked Member Template",
          tasks: [{ key: "blocked-task", title: "Blocked task" }]
        }]
      }
    });
    assert(blockedMarketplacePublish.status === 403, "member should not publish marketplace catalog");

    const marketplacePublish = await request(`${baseUrl}/api/marketplace/catalog`, {
      method: "POST",
      token: login.token,
      body: {
        projectTemplates: [{
          id: "marketplace-smoke-template",
          name: "Smoke Marketplace Template",
          category: "Smoke",
          description: "Template published by the smoke test.",
          creatorName: "Smoke Test",
          tasks: [{ key: "kickoff", title: "Kickoff smoke marketplace", priority: "high", dueOffset: 2 }]
        }],
        automationPacks: [{
          id: "automation-pack-smoke",
          name: "Smoke Automation Pack",
          category: "Smoke",
          creatorName: "Smoke Test",
          license: "Test",
          rules: [{ name: "Smoke due soon", trigger: "Task due soon", action: "Create follow-up task" }]
        }]
      }
    });
    assert(marketplacePublish.published.projectTemplates === 1, "marketplace publish did not count templates");
    assert(marketplacePublish.catalog.automationPacks.some((pack) => pack.id === "automation-pack-smoke"), "marketplace publish did not store automation pack");

    const marketplaceCatalog = await request(`${baseUrl}/api/marketplace/catalog`, {
      token: login.token
    });
    assert(marketplaceCatalog.catalog.projectTemplates.some((template) => template.id === "marketplace-smoke-template"), "marketplace catalog did not include template");

    const marketplaceExport = await request(`${baseUrl}/api/marketplace/export/project-template/marketplace-smoke-template`, {
      token: login.token
    });
    assert(marketplaceExport.type === "agora.project-template", "marketplace export did not return project-template payload");
    assert(marketplaceExport.template.id === "marketplace-smoke-template", "marketplace export returned wrong template");

    const createdProject = await request(`${baseUrl}/api/projects`, {
      method: "POST",
      token: login.token,
      body: {
        project: {
          id: "project-smoke",
          name: "Smoke Project",
          companyId: "acme-studio",
          owner: "mara"
        }
      }
    });
    assert(createdProject.project.name === "Smoke Project", "project create failed");

    const pilotReview = await request(`${baseUrl}/api/records/sparkzPilotReviews`, {
      method: "POST",
      token: login.token,
      body: {
        record: {
          projectId: "project-smoke",
          creatorName: "Pilot creator",
          updatePrepMinutes: 18,
          boundaryIncidents: 0,
          scores: { "creator-fit": { status: "pass", note: "Rights reviewed" } },
          verdict: "wait",
          verdictNote: "Gather launch evidence"
        }
      }
    });
    assert(pilotReview.record.projectId === "project-smoke", "Sparkz pilot review did not retain project scope");
    assert(pilotReview.record.creatorName === "Pilot creator", "Sparkz pilot review did not retain creator context");
    assert(pilotReview.record.scores["creator-fit"].status === "pass", "Sparkz pilot review did not retain scorecard evidence");
    assert(pilotReview.record.verdict === "wait", "Sparkz pilot review did not retain the human verdict");

    const updatedProject = await request(`${baseUrl}/api/projects/project-smoke`, {
      method: "PUT",
      token: login.token,
      body: {
        project: {
          name: "Updated Smoke Project",
          companyId: "acme-studio",
          owner: "mara"
        }
      }
    });
    assert(updatedProject.project.name === "Updated Smoke Project", "project update failed");

    const projects = await request(`${baseUrl}/api/projects`, {
      token: login.token
    });
    assert(projects.projects.length === 1, "project list failed");

    const createdTask = await request(`${baseUrl}/api/tasks`, {
      method: "POST",
      token: login.token,
      body: {
        task: {
          id: "task-smoke",
          projectId: "project-smoke",
          title: "Smoke Task",
          assignee: "mara",
          status: "todo",
          priority: "normal"
        }
      }
    });
    assert(createdTask.task.title === "Smoke Task", "task create failed");

    const snapshotBeforeGitHub = await storage.loadWorkspaceSnapshot();
    await storage.saveWorkspaceSnapshot({
      ...snapshotBeforeGitHub,
      workspace: {
        ...(snapshotBeforeGitHub.workspace || {}),
        integrations: {
          defaultOwner: "mara",
          webhookEndpoint: "",
          apiAccess: true,
          eventMirroring: true,
          github: {
            repositories: [{
              id: "github-smoke",
              fullName: "thedudeb/Agora",
              projectId: "project-smoke",
              syncIssues: true,
              syncPullRequests: true,
              closeOnDone: true,
              labelPrefix: "github",
              branchPrefix: "agora/",
              lastSyncedAt: "",
              status: "mapped"
            }],
            fieldMapping: {
              issueTitle: "title",
              issueBody: "description",
              issueLabels: "tags",
              issueAssignee: "assignee",
              issueState: "status",
              pullRequestState: "customFields.githubPrState"
            }
          },
          connections: [{
            id: "github",
            status: "planned",
            syncMode: "inbound",
            owner: "mara",
            health: "planned",
            events: ["github.issue.opened", "github.issue.closed"],
            secretStatus: "missing"
          }]
        }
      }
    });
    const githubStatus = await request(`${baseUrl}/api/integrations/github/status`);
    assert(githubStatus.repositories.some((repo) => repo.fullName === "thedudeb/Agora"), "github status did not expose mapped repository");
    const githubIssuePayload = {
      action: "opened",
      repository: { full_name: "thedudeb/Agora", name: "Agora", owner: { login: "thedudeb" } },
      issue: {
        number: 77,
        title: "Webhook-created issue",
        body: "Created from GitHub webhook smoke test.",
        state: "open",
        labels: [{ name: "bug" }],
        html_url: "https://github.com/thedudeb/Agora/issues/77",
        created_at: "2026-07-03T10:00:00.000Z",
        updated_at: "2026-07-03T10:00:00.000Z"
      }
    };
    const webhookResult = await request(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: { "X-GitHub-Event": "issues", "X-GitHub-Delivery": "smoke-delivery-77" },
      body: githubIssuePayload
    });
    assert(webhookResult.task?.customFields?.githubIssueNumber === "77", "github webhook did not create linked task");
    const snapshotAfterGitHub = await storage.loadWorkspaceSnapshot();
    const githubTask = snapshotAfterGitHub.tasks.find((task) => task.customFields?.githubExternalId === "thedudeb/Agora#77");
    assert(githubTask?.title === "Webhook-created issue", "github webhook task was not saved");
    const duplicateWebhook = await request(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: { "X-GitHub-Event": "issues", "X-GitHub-Delivery": "smoke-delivery-77" },
      body: githubIssuePayload
    });
    assert(duplicateWebhook.duplicate === true && duplicateWebhook.ignored === true, "duplicate github delivery should be ignored");
    const snapshotAfterDuplicate = await storage.loadWorkspaceSnapshot();
    assert(snapshotAfterDuplicate.tasks.filter((task) => task.customFields?.githubExternalId === "thedudeb/Agora#77").length === 1, "duplicate github delivery created another task");
    const pingWebhook = await request(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: { "X-GitHub-Event": "ping", "X-GitHub-Delivery": "smoke-ping-delivery" },
      body: { zen: "Keep it logically awesome.", repository: githubIssuePayload.repository }
    });
    assert(pingWebhook.accepted === true && pingWebhook.ignored === true, "unsupported github event should be accepted and ignored");
    const syncedAtMs = Date.parse(githubTask.customFields.githubSyncedAt);
    const localEditAt = new Date(syncedAtMs + 1000).toISOString();
    const externalEditAt = new Date(syncedAtMs + 2000).toISOString();
    const snapshotBeforeLocalEdit = await storage.loadWorkspaceSnapshot();
    await storage.saveWorkspaceSnapshot({
      ...snapshotBeforeLocalEdit,
      tasks: snapshotBeforeLocalEdit.tasks.map((task) => task.id === githubTask.id
        ? { ...task, title: "Locally edited GitHub task", updatedAt: localEditAt }
        : task)
    });
    const conflictResult = await request(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: { "X-GitHub-Event": "issues" },
      body: {
        ...githubIssuePayload,
        action: "edited",
        issue: {
          ...githubIssuePayload.issue,
          title: "GitHub edited issue",
          updated_at: externalEditAt
        }
      }
    });
    assert(conflictResult.conflict?.status === "open", "github webhook conflict was not captured");
    const snapshotAfterConflict = await storage.loadWorkspaceSnapshot();
    assert(snapshotAfterConflict.integrationConflicts.some((conflict) => conflict.provider === "github" && conflict.taskId === githubTask.id), "github conflict was not persisted");
    const storedConflict = snapshotAfterConflict.integrationConflicts.find((conflict) => conflict.provider === "github" && conflict.taskId === githubTask.id);
    const resolvedConflict = await request(`${baseUrl}/api/integrations/github/conflicts/${storedConflict.id}/resolve`, {
      method: "POST",
      token: login.token,
      body: { resolution: "use-github", note: "Smoke test accepts the GitHub edit." }
    });
    assert(resolvedConflict.conflict.status === "resolved", "github conflict was not marked resolved");
    assert(resolvedConflict.task.title === "GitHub edited issue", "github conflict resolution did not apply GitHub fields");
    const snapshotAfterResolution = await storage.loadWorkspaceSnapshot();
    assert(snapshotAfterResolution.integrationConflicts.some((conflict) => conflict.id === storedConflict.id && conflict.resolution === "use-github"), "resolved github conflict was not persisted");
    process.env.AGORA_REQUIRE_GITHUB_WEBHOOK_SECRET = "true";
    const missingProductionSignature = await requestError(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: { "X-GitHub-Event": "issues", "X-GitHub-Delivery": "smoke-missing-signature" },
      body: githubIssuePayload
    });
    assert(missingProductionSignature.status === 401, "production github webhook without secret should fail");
    delete process.env.AGORA_REQUIRE_GITHUB_WEBHOOK_SECRET;
    process.env.AGORA_GITHUB_WEBHOOK_SECRET = "smoke-secret";
    const invalidSignedWebhook = await requestError(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: { "X-GitHub-Event": "issues", "X-GitHub-Delivery": "smoke-invalid-signature", "X-Hub-Signature-256": "sha256=bad" },
      body: githubIssuePayload
    });
    assert(invalidSignedWebhook.status === 401, "invalid github webhook signature should fail");
    const malformedPayloadBody = JSON.stringify({
      action: "opened",
      repository: githubIssuePayload.repository
    });
    const malformedPayload = await requestError(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: {
        "X-GitHub-Event": "issues",
        "X-GitHub-Delivery": "smoke-malformed-payload",
        "X-Hub-Signature-256": githubSignature(malformedPayloadBody, "smoke-secret")
      },
      rawBody: malformedPayloadBody
    });
    assert(malformedPayload.status === 400, "malformed github payload should fail");
    const unmappedPayloadBody = JSON.stringify({
      ...githubIssuePayload,
      repository: { full_name: "thedudeb/Unmapped", name: "Unmapped", owner: { login: "thedudeb" } }
    });
    const unmappedRepoWebhook = await requestError(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: {
        "X-GitHub-Event": "issues",
        "X-GitHub-Delivery": "smoke-unmapped-repo",
        "X-Hub-Signature-256": githubSignature(unmappedPayloadBody, "smoke-secret")
      },
      rawBody: unmappedPayloadBody
    });
    assert(unmappedRepoWebhook.status === 400, "unmapped github repository should fail");
    const snapshotAfterRejectedWebhooks = await storage.loadWorkspaceSnapshot();
    assert(snapshotAfterRejectedWebhooks.notificationHistory.some((event) => event.kind === "github-webhook" && event.title.includes("rejected") && event.reason.includes("AGORA_GITHUB_WEBHOOK_SECRET")), "missing secret rejection receipt was not persisted");
    assert(snapshotAfterRejectedWebhooks.notificationHistory.some((event) => event.kind === "github-webhook" && event.title.includes("rejected") && event.reason.includes("Invalid GitHub webhook signature")), "invalid signature rejection receipt was not persisted");
    assert(snapshotAfterRejectedWebhooks.notificationHistory.some((event) => event.kind === "github-webhook" && event.title.includes("rejected") && event.reason.includes("missing issue")), "malformed payload rejection receipt was not persisted");
    assert(snapshotAfterRejectedWebhooks.notificationHistory.some((event) => event.kind === "github-webhook" && event.title.includes("rejected") && event.reason.includes("not mapped")), "unmapped repository rejection receipt was not persisted");
    const stalePayload = {
      ...githubIssuePayload,
      action: "edited",
      issue: {
        ...githubIssuePayload.issue,
        title: "Stale GitHub redelivery",
        updated_at: githubTask.customFields.githubSyncedAt
      }
    };
    const signedBody = JSON.stringify(stalePayload);
    const signedWebhook = await request(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: {
        "X-GitHub-Event": "issues",
        "X-GitHub-Delivery": "smoke-signed-replay",
        "X-Hub-Signature-256": githubSignature(signedBody, "smoke-secret")
      },
      rawBody: signedBody
    });
    assert(signedWebhook.accepted === true && signedWebhook.stale === true, "signed stale github webhook should be accepted without overwriting");
    const duplicateSignedWebhook = await request(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: {
        "X-GitHub-Event": "issues",
        "X-GitHub-Delivery": "smoke-signed-replay",
        "X-Hub-Signature-256": githubSignature(signedBody, "smoke-secret")
      },
      rawBody: signedBody
    });
    assert(duplicateSignedWebhook.duplicate === true && duplicateSignedWebhook.ignored === true, "signed github webhook replay should be ignored");
    delete process.env.AGORA_GITHUB_WEBHOOK_SECRET;
    const testEvent = await request(`${baseUrl}/api/integrations/github/test-event`, {
      method: "POST",
      token: login.token,
      body: { title: "Smoke GitHub test event", issueNumber: 9876 }
    });
    assert(testEvent.test === true && testEvent.task?.customFields?.githubIssueNumber === "9876", "github test event did not create a mapped task");
    assert(testEvent.receipt?.kind === "github-webhook", "github test event did not return a delivery receipt");
    const snapshotAfterTestEvent = await storage.loadWorkspaceSnapshot();
    assert(snapshotAfterTestEvent.notificationHistory.some((event) => event.kind === "github-webhook" && event.message.includes("#9876")), "github webhook receipt was not persisted");

    const blockedMemberTask = await requestError(`${baseUrl}/api/tasks`, {
      method: "POST",
      token: accepted.token,
      body: {
        task: {
          id: "member-created-task",
          projectId: "project-smoke",
          title: "Member-created task"
        }
      }
    });
    assert(blockedMemberTask.status === 403, "member should not create tasks");

    const memberTime = await request(`${baseUrl}/api/records/timeEntries`, {
      method: "POST",
      token: accepted.token,
      body: {
        record: {
          id: "member-time-smoke",
          taskId: "task-smoke",
          date: "2026-07-02",
          minutes: 25,
          note: "Member focus block"
        }
      }
    });
    assert(memberTime.record.memberId === accepted.user.id, "member time entry did not use current user");

    const memberReminder = await request(`${baseUrl}/api/records/notificationReminders`, {
      method: "POST",
      token: accepted.token,
      body: {
        record: {
          id: "member-reminder-smoke",
          sourceId: "assignment-task-smoke",
          title: "Smoke reminder",
          message: "Server scheduler should pick this up.",
          remindAt: "2000-01-01",
          status: "scheduled"
        }
      }
    });
    assert(memberReminder.record.memberId === accepted.user.id, "member reminder did not use current user");

    const blockedMemberScheduler = await requestError(`${baseUrl}/api/scheduler/notifications/run`, {
      method: "POST",
      token: accepted.token
    });
    assert(blockedMemberScheduler.status === 403, "member should not run the backend scheduler");

    const schedulerRun = await request(`${baseUrl}/api/scheduler/notifications/run`, {
      method: "POST",
      token: login.token
    });
    assert(schedulerRun.processed === 1, "scheduler did not process due reminder");
    assert(schedulerRun.reminders[0].sentAt, "scheduler did not stamp reminder sentAt");
    assert(schedulerRun.history[0].kind === "reminder-fired", "scheduler did not create notification history");

    const blockedMemberTime = await requestError(`${baseUrl}/api/records/timeEntries`, {
      method: "POST",
      token: accepted.token,
      body: {
        record: {
          id: "spoofed-member-time",
          taskId: "task-smoke",
          memberId: "mara",
          date: "2026-07-02",
          minutes: 15
        }
      }
    });
    assert(blockedMemberTime.status === 403, "member should not log time for another user");

    const updatedTask = await request(`${baseUrl}/api/tasks/task-smoke`, {
      method: "PUT",
      token: login.token,
      body: {
        task: {
          projectId: "project-smoke",
          title: "Updated Smoke Task",
          status: "doing",
          priority: "high"
        }
      }
    });
    assert(updatedTask.task.status === "doing", "task update failed");

    const tasks = await request(`${baseUrl}/api/tasks?projectId=project-smoke`, {
      token: login.token
    });
    assert(tasks.tasks.some((task) => task.id === "task-smoke"), "task list failed");

    const featureRequest = await request(`${baseUrl}/api/feature-requests`, {
      method: "POST",
      token: login.token,
      body: {
        task: {
          id: "feature-request-smoke",
          projectId: "project-smoke",
          title: "Feature request: Smoke feedback",
          status: "todo",
          priority: "normal",
          tags: ["feature-request", "feedback"]
        },
        request: {
          title: "Smoke feedback",
          details: "Make sure feature requests become tasks.",
          requester: "Smoke Tester",
          email: "smoke@example.test",
          impact: "nice-to-have"
        }
      }
    });
    assert(featureRequest.task.id === "feature-request-smoke", "feature request task failed");
    assert(featureRequest.email.delivered === false, "feature request email should be skipped without SMTP");

    const featureUpdate = await request(`${baseUrl}/api/feature-requests/feature-request-smoke/updates`, {
      method: "POST",
      token: login.token,
      body: {
        featureStatus: "planned",
        note: "Planned for the smoke milestone."
      }
    });
    assert(featureUpdate.task.customFields.featureStatus === "planned", "feature request status update failed");
    assert(featureUpdate.email.delivered === false, "feature update email should be skipped without SMTP");

    const publicFeatureConfig = await request(`${baseUrl}/api/public/feature-requests`);
    assert(publicFeatureConfig.projects.some((project) => project.id === "project-smoke"), "public feature request config missing project");

    const publicFeatureRequest = await request(`${baseUrl}/api/public/feature-requests`, {
      method: "POST",
      body: {
        projectId: "project-smoke",
        title: "Public smoke feedback",
        details: "Public request should become a task.",
        requester: "Public Tester",
        email: "public@example.test",
        impact: "workflow-blocker"
      }
    });
    assert(publicFeatureRequest.task.tags.includes("public"), "public feature request task failed");
    assert(publicFeatureRequest.email.delivered === false, "public feature request email should be skipped without SMTP");

    for (let index = 0; index < 2; index += 1) {
      const repeatedPublicEmail = await request(`${baseUrl}/api/public/feature-requests`, {
        method: "POST",
        body: {
          projectId: "project-smoke",
          title: `Repeated public email ${index + 1}`,
          details: "Same requester email should be limited before IP limits are exhausted.",
          requester: "Public Tester",
          email: "public@example.test",
          impact: "nice-to-have"
        }
      });
      assert(repeatedPublicEmail.task.id, "public feature email limiter warmup failed");
    }
    const rateLimitedPublicEmail = await requestError(`${baseUrl}/api/public/feature-requests`, {
      method: "POST",
      body: {
        projectId: "project-smoke",
        title: "Repeated public email blocked",
        details: "This should hit the per-email public feature limit.",
        requester: "Public Tester",
        email: "public@example.test",
        impact: "nice-to-have"
      }
    });
    assert(rateLimitedPublicEmail.status === 429, "public feature requests should rate limit repeated requester email");

    const oversizedPublicFeatureRequest = await requestError(`${baseUrl}/api/public/feature-requests`, {
      method: "POST",
      body: {
        projectId: "project-smoke",
        title: "Oversized public feedback",
        details: "x".repeat(30000),
        requester: "Public Tester",
        email: "oversized-public@example.test",
        impact: "nice-to-have"
      }
    });
    assert(oversizedPublicFeatureRequest.status === 413, "oversized public feature request should be rejected");
    const honeypotPublicFeatureRequest = await request(`${baseUrl}/api/public/feature-requests`, {
      method: "POST",
      body: {
        projectId: "project-smoke",
        title: "Honeypot public feedback",
        details: "A filled website field should be silently rejected.",
        requester: "Spam Bot",
        email: "honeypot-public@example.test",
        website: "https://spam.example.test",
        impact: "nice-to-have"
      }
    });
    assert(honeypotPublicFeatureRequest.accepted === false, "public feature honeypot should silently reject submissions");
    const rateLimitedPublicFeatureRequest = await requestError(`${baseUrl}/api/public/feature-requests`, {
      method: "POST",
      body: {
        projectId: "project-smoke",
        title: "Public feedback over IP limit",
        details: "This request should hit the public IP rate limit.",
        requester: "Public Tester",
        email: "rate-limited-public@example.test",
        impact: "nice-to-have"
      }
    });
    assert(rateLimitedPublicFeatureRequest.status === 429, "public feature requests should hit the IP rate limit");

    const pagedTasks = await request(`${baseUrl}/api/tasks?projectId=project-smoke&limit=1&offset=0`, {
      token: login.token
    });
    assert(pagedTasks.tasks.length === 1 && pagedTasks.page.hasMore, "task pagination metadata failed");

    const searchedTasks = await request(`${baseUrl}/api/tasks?query=public%20smoke&tag=public`, {
      token: login.token
    });
    assert(searchedTasks.tasks.length === 1 && searchedTasks.tasks[0].id === publicFeatureRequest.task.id, "task server search/filter failed");

    const pagedProjects = await request(`${baseUrl}/api/projects?limit=1&query=updated`, {
      token: login.token
    });
    assert(pagedProjects.projects.length === 1 && pagedProjects.page.total === 1, "project pagination metadata failed");

    const scopedInvitation = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: login.token,
      body: {
        name: "Scoped Manager",
        email: "scoped-manager@example.test",
        role: "manager",
        companyId: "acme-studio"
      }
    });
    const scopedManager = await request(`${baseUrl}/api/invitations/${scopedInvitation.invitation.token}/accept`, {
      method: "POST",
      body: { name: "Scoped Manager" }
    });
    assert(scopedManager.membership.companyId === "acme-studio", "scoped manager did not keep company scope");

    const scopedProjects = await request(`${baseUrl}/api/projects`, {
      token: scopedManager.token
    });
    assert(scopedProjects.projects.length === 1 && scopedProjects.projects[0].companyId === "acme-studio", "scoped project list was not filtered");

    const blockedScopedProject = await requestError(`${baseUrl}/api/projects`, {
      method: "POST",
      token: scopedManager.token,
      body: {
        project: {
          id: "outside-scope-project",
          name: "Outside Scope",
          companyId: "other-company",
          owner: "mara"
        }
      }
    });
    assert(blockedScopedProject.status === 403, "scoped manager should not create projects outside company scope");

    const blockedScopedSnapshot = await requestError(`${baseUrl}/api/workspace`, {
      method: "PUT",
      token: scopedManager.token,
      body: { snapshot: { workspace: { name: "Scoped overwrite" } } }
    });
    assert(blockedScopedSnapshot.status === 403, "scoped manager should not save whole workspace snapshots");

    const createdComment = await request(`${baseUrl}/api/comments`, {
      method: "POST",
      token: login.token,
      body: {
        comment: {
          id: "comment-smoke",
          taskId: "task-smoke",
          author: "mara",
          body: "Smoke test comment"
        }
      }
    });
    assert(createdComment.comment.body === "Smoke test comment", "comment create failed");

    const memberComment = await request(`${baseUrl}/api/comments`, {
      method: "POST",
      token: accepted.token,
      body: {
        comment: {
          id: "member-comment-smoke",
          taskId: "task-smoke",
          author: "mara",
          body: "Member-authored smoke test comment"
        }
      }
    });
    assert(memberComment.comment.author === accepted.user.id, "member comment author was not canonicalized");

    const memberPresence = await request(`${baseUrl}/api/records/presence`, {
      method: "POST",
      token: accepted.token,
      body: {
        record: {
          id: "presence-member-smoke",
          memberId: "mara",
          route: "board",
          taskId: "task-smoke",
          viewing: "Viewing Smoke Task",
          cursorX: 120,
          cursorY: 240,
          viewportWidth: 1280,
          viewportHeight: 720
        }
      }
    });
    assert(memberPresence.record.memberId === accepted.user.id, "member presence was not canonicalized");
    assert(memberPresence.record.cursorX === 120 && memberPresence.record.cursorY === 240, "presence cursor fields were not stored");

    const memberChat = await request(`${baseUrl}/api/records/chatMessages`, {
      method: "POST",
      token: accepted.token,
      body: {
        record: {
          id: "chat-member-smoke",
          channel: "delivery",
          author: "mara",
          body: "Member chat smoke test",
          projectId: "project-smoke"
        }
      }
    });
    assert(memberChat.record.author === accepted.user.id, "member chat author was not canonicalized");

    const savedWhiteboard = await request(`${baseUrl}/api/records/whiteboards`, {
      method: "POST",
      token: accepted.token,
      body: {
        record: {
          id: "whiteboard-smoke",
          title: "Smoke Whiteboard",
          projectId: "project-smoke",
          items: [
            { id: "wb-smoke-note", type: "decision", text: "Ship the smoke board", x: 42, y: 18, color: "blue" }
          ]
        }
      }
    });
    assert(savedWhiteboard.record.items.length === 1, "whiteboard item was not stored");

    const collaborationRecords = await request(`${baseUrl}/api/records`, {
      token: login.token
    });
    assert(collaborationRecords.records.chatMessages.some((message) => message.id === "chat-member-smoke"), "chat message list failed");
    assert(collaborationRecords.records.whiteboards.some((board) => board.id === "whiteboard-smoke"), "whiteboard list failed");
    const pagedCommentRecords = await request(`${baseUrl}/api/records/comments?limit=1`, {
      token: login.token
    });
    assert(pagedCommentRecords.records.length === 1, "record collection pagination did not limit comments");
    assert(pagedCommentRecords.page.total >= 2, "record collection pagination did not expose total comments");
    assert(pagedCommentRecords.page.hasMore === true, "record collection pagination did not expose more comments");
    const nextPagedCommentRecords = await request(`${baseUrl}/api/records/comments?limit=1&offset=1`, {
      token: login.token
    });
    assert(nextPagedCommentRecords.records.length === 1, "record collection pagination did not load the next comment page");

    const comments = await request(`${baseUrl}/api/comments?taskId=task-smoke`, {
      token: login.token
    });
    assert(comments.comments.length === 2, "comment list failed");

    const createdActivity = await request(`${baseUrl}/api/activities`, {
      method: "POST",
      token: login.token,
      body: {
        activity: {
          id: "activity-smoke",
          projectId: "project-smoke",
          taskId: "task-smoke",
          memberId: "mara",
          type: "comment",
          message: "commented on Updated Smoke Task"
        }
      }
    });
    assert(createdActivity.activity.type === "comment", "activity create failed");

    const activities = await request(`${baseUrl}/api/activities?projectId=project-smoke`, {
      token: login.token
    });
    assert(activities.activities.length === 1, "activity list failed");

    const createdDocument = await request(`${baseUrl}/api/documents`, {
      method: "POST",
      token: login.token,
      body: {
        document: {
          id: "doc-smoke",
          projectId: "project-smoke",
          title: "Smoke Doc",
          type: "Note",
          owner: "mara",
          body: "Smoke test note"
        }
      }
    });
    assert(createdDocument.document.title === "Smoke Doc", "document create failed");

    const createdFile = await request(`${baseUrl}/api/files`, {
      method: "POST",
      token: login.token,
      body: {
        file: {
          id: "file-smoke",
          projectId: "project-smoke",
          taskId: "task-smoke",
          title: "smoke-plan.pdf",
          kind: "PDF",
          size: "12 KB",
          owner: "mara"
        }
      }
    });
    assert(createdFile.file.title === "smoke-plan.pdf", "file create failed");

    const uploadedFile = await request(`${baseUrl}/api/files/upload`, {
      method: "POST",
      token: login.token,
      body: {
        file: {
          id: "file-upload-smoke",
          projectId: "project-smoke",
          taskId: "task-smoke",
          title: "smoke-upload.txt",
          kind: "TXT",
          contentType: "text/plain",
          dataUrl: `data:text/plain;base64,${Buffer.from("Uploaded by the smoke test").toString("base64")}`
        }
      }
    });
    assert(uploadedFile.file.url === "/api/files/file-upload-smoke/download", "file upload did not return download URL");
    assert(uploadedFile.file.storageProvider === "json-file", "file upload did not use local storage provider");
    assert(uploadedFile.file.storageKey === "file-upload-smoke/smoke-upload.txt", "file upload storage key was not stable");

    const blockedDanglingUpload = await requestError(`${baseUrl}/api/files/upload`, {
      method: "POST",
      token: login.token,
      body: {
        file: {
          id: "file-upload-dangling",
          projectId: "project-smoke",
          taskId: "missing-task",
          title: "dangling-upload.txt",
          contentType: "text/plain",
          dataUrl: `data:text/plain;base64,${Buffer.from("Should not upload").toString("base64")}`
        }
      }
    });
    assert(blockedDanglingUpload.status === 400, "file upload should reject missing task links");

    const sanitizedUpload = await request(`${baseUrl}/api/files/upload`, {
      method: "POST",
      token: login.token,
      body: {
        file: {
          id: "../escape-upload",
          projectId: "project-smoke",
          title: "escape-upload.txt",
          contentType: "text/plain",
          dataUrl: `data:text/plain;base64,${Buffer.from("Safe path").toString("base64")}`
        }
      }
    });
    assert(!sanitizedUpload.file.storageKey.includes(".."), "file upload storage key kept path traversal segments");
    assert(fs.existsSync(path.join(dataDir, "uploads", sanitizedUpload.file.storageKey)), "sanitized upload was not stored inside upload root");

    const downloadedFile = await requestRaw(`${baseUrl}${uploadedFile.file.url}`, {
      token: login.token
    });
    assert(downloadedFile.body.toString("utf8") === "Uploaded by the smoke test", "file download did not return uploaded content");

    const files = await request(`${baseUrl}/api/files?projectId=project-smoke`, {
      token: login.token
    });
    assert(files.files.length === 3, "file list failed");

    const archivedTask = await request(`${baseUrl}/api/tasks/task-smoke`, {
      method: "DELETE",
      token: login.token
    });
    assert(archivedTask.task.archivedAt, "task archive failed");

    const restoredTask = await request(`${baseUrl}/api/tasks/task-smoke/restore`, {
      method: "POST",
      token: login.token
    });
    assert(!restoredTask.task.archivedAt, "task restore failed");

    const archivedProject = await request(`${baseUrl}/api/projects/project-smoke`, {
      method: "DELETE",
      token: login.token
    });
    assert(archivedProject.project.archivedAt, "project archive failed");
    const activeProjectRecords = await request(`${baseUrl}/api/projects`, {
      token: login.token
    });
    assert(!activeProjectRecords.projects.some((project) => project.id === "project-smoke"), "active project query included archived project");
    const archivedProjectRecords = await request(`${baseUrl}/api/projects?includeArchived=true`, {
      token: login.token
    });
    assert(archivedProjectRecords.projects.some((project) => project.id === "project-smoke" && project.archivedAt), "archived project query did not include archived project");
    const activeTaskRecords = await request(`${baseUrl}/api/tasks?projectId=project-smoke`, {
      token: login.token
    });
    assert(!activeTaskRecords.tasks.some((task) => task.id === "task-smoke"), "active task query included archived task");
    const archivedTaskRecords = await request(`${baseUrl}/api/tasks?includeArchived=true&projectId=project-smoke`, {
      token: login.token
    });
    assert(archivedTaskRecords.tasks.some((task) => task.id === "task-smoke" && task.archivedAt), "archived task query did not include archived task");

    const workspace = await request(`${baseUrl}/api/workspace`, {
      token: login.token
    });
    assert(workspace.snapshot.workspace.name === "Smoke Test Studio", "workspace load failed");
    assert(workspace.snapshot.workspace.payments.entitlements.some((entitlement) => entitlement.itemId === "marketplace-agency-retainer-os"), "workspace snapshot dropped payment entitlement");
    assert(workspace.snapshot.users.some((user) => user.email === "jordan@example.test"), "workspace save dropped accepted invite user");
    assert(workspace.snapshot.users.every((user) => !user.passwordHash && !user.passwordSalt && !user.passwordResetTokenHash), "workspace snapshot leaked auth secret fields");
    assert(workspace.snapshot.invitations.some((invite) => invite.email === "jordan@example.test" && invite.status === "accepted"), "workspace save dropped invitation state");
    assert(workspace.snapshot.invitations.every((invite) => !invite.token && !invite.acceptUrl), "workspace snapshot leaked invitation acceptance secrets");
    assert(workspace.snapshot.projects[0].name === "Updated Smoke Project", "project not stored in workspace");
    const smokeTask = workspace.snapshot.tasks.find((task) => task.id === "task-smoke");
    assert(smokeTask?.title === "Updated Smoke Task", "task not stored in workspace");
    assert(workspace.snapshot.projects[0].archivedAt, "project archive not stored in workspace");
    assert(smokeTask.archivedAt, "project archive did not archive task");
    assert(workspace.snapshot.comments.some((comment) => comment.body === "Smoke test comment"), "comment not stored in workspace");
    assert(workspace.snapshot.comments.some((comment) => comment.author === accepted.user.id), "member comment author not stored correctly");
    assert(workspace.snapshot.timeEntries.some((entry) => entry.memberId === accepted.user.id), "member time entry not stored correctly");
    assert(workspace.snapshot.chatMessages.some((message) => message.author === accepted.user.id), "member chat message not stored correctly");
    assert(workspace.snapshot.whiteboards.some((board) => board.title === "Smoke Whiteboard"), "whiteboard not stored in workspace");
    assert(workspace.snapshot.activities[0].message === "commented on Updated Smoke Task", "activity not stored in workspace");
    assert(workspace.snapshot.documents[0].title === "Smoke Doc", "document not stored in workspace");
    assert(workspace.snapshot.files.some((file) => file.title === "smoke-plan.pdf"), "file not stored in workspace");
    assert(workspace.snapshot.files.some((file) => file.title === "smoke-upload.txt"), "uploaded file not stored in workspace");
    assert(workspace.snapshot.files.some((file) => file.title === "escape-upload.txt"), "sanitized upload not stored in workspace");

    const finalBackendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: login.token
    });
    const commentsReport = finalBackendHealth.records.find((record) => record.key === "comments");
    const chatReport = finalBackendHealth.records.find((record) => record.key === "chatMessages");
    assert(commentsReport && commentsReport.count === 2, "backend health did not count structured comments");
    assert(chatReport && chatReport.count === 1, "backend health did not count structured chat");
    assert(finalBackendHealth.snapshot.counts.projects === 1, "backend health did not count snapshot projects");
    assert(finalBackendHealth.observability.total > backendHealth.observability.total, "backend request metrics did not advance");

    const audit = await request(`${baseUrl}/api/audit-log`, {
      token: login.token
    });
    const auditActions = new Set(audit.events.map((event) => event.action));
    assert(audit.events.length >= 18, "audit log was not written");
    assert(auditActions.has("member_invite"), "invite audit event was not written");
    assert(auditActions.has("task_create"), "task create audit event was not written");
    assert(auditActions.has("project_archive"), "project archive audit event was not written");

    await testLockedAuthDefaults();
    await testAccountAuth();
    await testAuthenticatedRateLimit();
    await testSupabaseAuthBridge();
    await testSupabaseStorageAdapter();
    await testConcurrentAuthMutations();

    console.log("API smoke test passed");
  } finally {
    delete process.env.AGORA_GITHUB_WEBHOOK_SECRET;
    delete process.env.AGORA_REQUIRE_GITHUB_WEBHOOK_SECRET;
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function testAccountAuth() {
  const originalResetReturnToken = process.env.AGORA_PASSWORD_RESET_RETURN_TOKEN;
  const originalResetDelivery = process.env.AGORA_PASSWORD_RESET_DELIVERY;
  const originalResetWebhookUrl = process.env.AGORA_PASSWORD_RESET_WEBHOOK_URL;
  const originalResetWebhookSecret = process.env.AGORA_PASSWORD_RESET_WEBHOOK_SECRET;
  const originalFetch = global.fetch;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-auth-"));
  const server = createServer({
    storage: createStorage({ dataDir, driver: "json" }),
    allowPasswordlessAuth: true
  });
  process.env.AGORA_PASSWORD_RESET_RETURN_TOKEN = "true";

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const signup = await request(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      body: {
        name: "Owner Person",
        email: "owner@example.test",
        password: "super-secret",
        workspaceName: "Owner Workspace",
        workspaceSlug: "owner-workspace"
      }
    });
    assert(signup.token, "signup did not create a session");
    assert(signup.membership.role === "admin", "first signup did not create an admin");
    assert(signup.user.hasPassword === true, "signup did not return password status");
    assert(!signup.user.passwordHash, "signup leaked password hash");

    const duplicateSignup = await requestError(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      body: {
        name: "Second Owner",
        email: "second@example.test",
        password: "super-secret"
      }
    });
    assert(duplicateSignup.status === 403, "second open signup should be blocked");

    const passwordChange = await request(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      token: signup.token,
      body: {
        currentPassword: "super-secret",
        newPassword: "owner-secret-2"
      }
    });
    assert(passwordChange.ok === true, "password change failed");

    const oldPasswordLogin = await requestError(`${baseUrl}/api/auth/password-login`, {
      method: "POST",
      body: {
        email: "owner@example.test",
        password: "super-secret"
      }
    });
    assert(oldPasswordLogin.status === 401, "old password should not work after password change");

    const resetRequest = await request(`${baseUrl}/api/auth/password-reset/request`, {
      method: "POST",
      body: { email: "owner@example.test" }
    });
    assert(resetRequest.resetToken, "password reset request did not return manual token in test mode");

    const resetConfirm = await request(`${baseUrl}/api/auth/password-reset/confirm`, {
      method: "POST",
      body: {
        email: "owner@example.test",
        token: resetRequest.resetToken,
        password: "owner-secret-3"
      }
    });
    assert(resetConfirm.ok === true, "password reset confirm failed");

    const passwordLogin = await request(`${baseUrl}/api/auth/password-login`, {
      method: "POST",
      body: {
        email: "owner@example.test",
        password: "owner-secret-3"
      }
    });
    assert(passwordLogin.user.id === signup.user.id, "password login did not return owner");
    const ownerToken = passwordLogin.token;

    let webhookCalled = false;
    process.env.AGORA_PASSWORD_RESET_RETURN_TOKEN = "false";
    process.env.AGORA_PASSWORD_RESET_DELIVERY = "webhook";
    process.env.AGORA_PASSWORD_RESET_WEBHOOK_URL = "https://mail-worker.example.test/reset";
    process.env.AGORA_PASSWORD_RESET_WEBHOOK_SECRET = "shared-secret";
    global.fetch = async (url, options = {}) => {
      if (url === "https://mail-worker.example.test/reset") {
        webhookCalled = true;
        const body = JSON.parse(options.body);
        assert(options.headers.Authorization === "Bearer shared-secret", "password reset webhook secret was not sent");
        assert(body.to === "owner@example.test", "password reset webhook had wrong recipient");
        assert(body.token, "password reset webhook did not include token");
        assert(body.resetUrl.includes(encodeURIComponent(body.token)), "password reset webhook did not include tokenized URL");
        return mockResponse({ ok: true });
      }
      return originalFetch(url, options);
    };
    const webhookReset = await request(`${baseUrl}/api/auth/password-reset/request`, {
      method: "POST",
      body: { email: "owner@example.test" }
    });
    assert(webhookCalled, "password reset webhook was not called");
    assert(webhookReset.delivered === true, "password reset webhook did not report delivery");
    assert(!webhookReset.resetToken, "password reset webhook should not expose token when return token is disabled");
    process.env.AGORA_PASSWORD_RESET_RETURN_TOKEN = "true";
    process.env.AGORA_PASSWORD_RESET_DELIVERY = "manual";
    global.fetch = originalFetch;

    const members = await request(`${baseUrl}/api/members`, {
      token: ownerToken
    });
    const owner = members.users.find((user) => user.email === "owner@example.test");
    assert(owner && owner.hasPassword === true, "members did not include password status");
    assert(!owner.passwordHash && !owner.passwordSalt, "members leaked password fields");

    const company = await request(`${baseUrl}/api/records/companies`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "company-record",
          name: "Record Company",
          owner: "owner"
        }
      }
    });
    assert(company.record.name === "Record Company", "record company upsert failed");

    const portalLink = await request(`${baseUrl}/api/portal-links`, {
      method: "POST",
      token: ownerToken,
      body: {
        companyId: "company-record",
        packetSignature: "smoke-signature"
      }
    });
    assert(portalLink.token, "hosted portal link did not return one-time token");
    assert(portalLink.portalLink.source === "api", "hosted portal link did not mark api source");
    assert(portalLink.portalLink.tokenId, "hosted portal link did not return token id");
    assert(!portalLink.portalLink.tokenHash, "hosted portal link leaked token hash");
    assert(!portalLink.portalLink.token, "hosted portal link leaked raw token in record");

    const portalLinks = await request(`${baseUrl}/api/portal-links`, {
      token: ownerToken
    });
    assert(portalLinks.portalLinks.some((link) => link.id === portalLink.portalLink.id), "hosted portal link list missed created link");
    assert(portalLinks.portalLinks.every((link) => !link.tokenHash && !link.token), "hosted portal link list leaked token material");

    const recordCollections = await request(`${baseUrl}/api/records`, {
      token: ownerToken
    });
    assert(!recordCollections.collections.includes("clientPortalLinks"), "portal links should not be exposed as generic records");
    assert(recordCollections.collections.includes("automationRules"), "automation rules should be exposed as generic records");

    const otherCompany = await request(`${baseUrl}/api/records/companies`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "other-company",
          name: "Other Company",
          owner: "owner"
        }
      }
    });
    assert(otherCompany.record.name === "Other Company", "second record company upsert failed");

    const projectRecord = await request(`${baseUrl}/api/projects`, {
      method: "POST",
      token: ownerToken,
      body: {
        project: {
          id: "project-record",
          name: "Record Project",
          companyId: "company-record",
          owner: "owner"
        }
      }
    });
    assert(projectRecord.project.companyId === "company-record", "record project create failed");

    const portalTask = await request(`${baseUrl}/api/tasks`, {
      method: "POST",
      token: ownerToken,
      body: {
        task: {
          id: "portal-task-record",
          projectId: "project-record",
          title: "Hosted Portal Task",
          description: "Visible from a hosted portal link",
          status: "todo",
          dueDate: "2026-07-15",
          visibility: "client",
          customFields: {
            clientVisibility: "Client-visible",
            approvalStage: "Approved"
          }
        }
      }
    });
    assert(portalTask.task.title === "Hosted Portal Task", "portal visible task create failed");

    const otherProject = await request(`${baseUrl}/api/projects`, {
      method: "POST",
      token: ownerToken,
      body: {
        project: {
          id: "other-project",
          name: "Other Project",
          companyId: "other-company",
          owner: "owner"
        }
      }
    });
    assert(otherProject.project.companyId === "other-company", "second record project create failed");

    const approval = await request(`${baseUrl}/api/records/approvals`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "approval-record",
          companyId: "company-record",
          projectId: "project-record",
          taskId: "portal-task-record",
          title: "Record Approval",
          status: "requested",
          summary: "Approve the hosted portal task",
          dueDate: "2026-07-20"
        }
      }
    });
    assert(approval.record.title === "Record Approval", "record approval upsert failed");

    const otherApproval = await request(`${baseUrl}/api/records/approvals`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "approval-other",
          companyId: "other-company",
          projectId: "other-project",
          title: "Other Approval",
          status: "requested"
        }
      }
    });
    assert(otherApproval.record.title === "Other Approval", "second record approval upsert failed");

    const records = await request(`${baseUrl}/api/records/approvals?companyId=company-record`, {
      token: ownerToken
    });
    assert(records.records.length === 1, "record approval filter failed");

    const portalDocument = await request(`${baseUrl}/api/records/documents`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "portal-doc-record",
          projectId: "project-record",
          title: "Hosted Portal Brief",
          type: "Brief",
          visibility: "shared",
          body: "Internal body should not be returned by the public hosted portal."
        }
      }
    });
    assert(portalDocument.record.title === "Hosted Portal Brief", "portal document upsert failed");

    const portalFile = await request(`${baseUrl}/api/records/files`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "portal-file-record",
          projectId: "project-record",
          taskId: "portal-task-record",
          title: "Hosted Portal Asset",
          kind: "PDF",
          size: "42 KB",
          visibility: "shared",
          storageBucket: "secret-bucket",
          storageKey: "secret-key"
        }
      }
    });
    assert(portalFile.record.title === "Hosted Portal Asset", "portal file upsert failed");

    const portalActivity = await request(`${baseUrl}/api/records/activities`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "portal-activity-record",
          projectId: "project-record",
          taskId: "portal-task-record",
          type: "update",
          message: "Hosted portal update",
          memberId: owner.id
        }
      }
    });
    assert(portalActivity.record.message === "Hosted portal update", "portal activity upsert failed");

    const portalComment = await request(`${baseUrl}/api/records/comments`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "portal-comment-record",
          taskId: "portal-task-record",
          body: "Hosted portal comment",
          author: owner.id
        }
      }
    });
    assert(portalComment.record.body === "Hosted portal comment", "portal comment upsert failed");

    const portalAutomationRule = await request(`${baseUrl}/api/records/automationRules`, {
      method: "POST",
      token: ownerToken,
      body: {
        record: {
          id: "automation-portal-feature-smoke",
          name: "Portal feature follow-up",
          triggerKind: "portal_feature_request",
          conditionKind: "company",
          conditionValue: "company-record",
          actionKind: "create_task",
          actionTarget: "Owner follow-up",
          enabled: true
        }
      }
    });
    assert(portalAutomationRule.record.triggerKind === "portal_feature_request", "automation rule upsert failed");

    const validatedPortalLink = await request(`${baseUrl}/api/portal-links/validate/${encodeURIComponent(portalLink.token)}`);
    assert(validatedPortalLink.portalLink.companyId === "company-record", "public portal validation did not return company scope");
    assert(validatedPortalLink.portalLink.viewCount === 1, "public portal validation did not count the view");
    assert(validatedPortalLink.portalSnapshot.company.name === "Record Company", "public portal snapshot missed company");
    assert(validatedPortalLink.portalSnapshot.projects.some((project) => project.id === "project-record"), "public portal snapshot missed project");
    assert(validatedPortalLink.portalSnapshot.tasks.some((task) => task.id === "portal-task-record"), "public portal snapshot missed visible task");
    assert(validatedPortalLink.portalSnapshot.approvals.some((item) => item.id === "approval-record"), "public portal snapshot missed approval");
    assert(validatedPortalLink.portalSnapshot.documents.some((item) => item.id === "portal-doc-record"), "public portal snapshot missed document");
    assert(validatedPortalLink.portalSnapshot.files.some((item) => item.id === "portal-file-record"), "public portal snapshot missed file");
    assert(validatedPortalLink.portalSnapshot.updates.some((item) => item.message === "Hosted portal update"), "public portal snapshot missed activity");
    assert(validatedPortalLink.portalSnapshot.files.every((item) => !item.storageBucket && !item.storageKey), "public portal snapshot leaked file storage internals");
    assert(validatedPortalLink.portalSnapshot.documents.every((item) => !item.body), "public portal snapshot leaked document bodies");
    assert(!JSON.stringify(validatedPortalLink.portalSnapshot).includes("Other Company"), "public portal snapshot leaked another company");

    const portalApprovalAction = await request(`${baseUrl}/api/portal-links/actions/${encodeURIComponent(portalLink.token)}`, {
      method: "POST",
      body: {
        action: "approval",
        approvalId: "approval-record",
        status: "approved",
        note: "Looks good from the hosted portal."
      }
    });
    assert(portalApprovalAction.action.type === "approval", "hosted portal approval action did not return action type");
    assert(portalApprovalAction.portalSnapshot.approvals.some((item) => item.id === "approval-record" && item.status === "approved"), "hosted portal approval action did not update snapshot");
    assert(portalApprovalAction.action.notification.kind === "portal-approval", "hosted portal approval action did not create notification history");
    assert(portalApprovalAction.action.notification.email?.mode, "hosted portal approval action did not report email delivery status");
    assert(!portalApprovalAction.action.notification.email.to, "hosted portal approval action leaked owner email");

    const portalCommentAction = await request(`${baseUrl}/api/portal-links/actions/${encodeURIComponent(portalLink.token)}`, {
      method: "POST",
      body: {
        action: "comment",
        taskId: "portal-task-record",
        body: "Can you share timing from the hosted portal?"
      }
    });
    assert(portalCommentAction.action.type === "comment", "hosted portal comment action did not return action type");
    assert(portalCommentAction.portalSnapshot.updates.some((item) => item.message === "Can you share timing from the hosted portal?"), "hosted portal comment did not appear in refreshed snapshot");

    const portalFeatureAction = await request(`${baseUrl}/api/portal-links/actions/${encodeURIComponent(portalLink.token)}`, {
      method: "POST",
      body: {
        action: "feature-request",
        projectId: "project-record",
        title: "Portal requested timeline",
        details: "Please show milestone timing in the portal.",
        requester: "Client Person",
        email: "client-person@example.test",
        impact: "workflow-blocker"
      }
    });
    assert(portalFeatureAction.action.type === "feature-request", "hosted portal feature request did not return action type");
    assert(portalFeatureAction.portalSnapshot.tasks.some((task) => task.title === "Feature request: Portal requested timeline"), "hosted portal feature request did not create visible task");
    assert(portalFeatureAction.action.notification.kind === "portal-feature-request", "hosted portal feature request did not create notification history");
    assert(portalFeatureAction.action.notification.email?.mode, "hosted portal feature request did not report email delivery status");
    assert(!portalFeatureAction.action.notification.email.to, "hosted portal feature request leaked owner email");
    const invalidPortalAction = await requestError(`${baseUrl}/api/portal-links/actions/${encodeURIComponent(portalLink.token)}`, {
      method: "POST",
      body: {
        action: "delete-everything",
        taskId: "portal-task-record",
        body: "This action should not be accepted from the public portal."
      }
    });
    assert(invalidPortalAction.status === 400, "hosted portal should reject unsupported public actions");
    const oversizedPortalAction = await requestError(`${baseUrl}/api/portal-links/actions/${encodeURIComponent(portalLink.token)}`, {
      method: "POST",
      body: {
        action: "comment",
        taskId: "portal-task-record",
        body: "x".repeat(30000)
      }
    });
    assert(oversizedPortalAction.status === 413, "hosted portal should reject oversized public action bodies");
    const portalAutomationRuns = await request(`${baseUrl}/api/records/automationRuns`, {
      token: ownerToken
    });
    assert(portalAutomationRuns.records.some((run) => run.automationId === "automation-portal-feature-smoke" && run.changedCount === 1), "portal feature request did not run matching automation");
    const portalAutomationWorkspace = await request(`${baseUrl}/api/workspace`, {
      token: ownerToken
    });
    assert(portalAutomationWorkspace.snapshot.tasks.some((task) => task.title === "Owner follow-up: Portal requested timeline"), "portal automation did not create follow-up task");

    const copiedPortalLink = await request(`${baseUrl}/api/portal-links/${encodeURIComponent(portalLink.portalLink.id)}/events`, {
      method: "POST",
      token: ownerToken,
      body: { event: "copied" }
    });
    assert(copiedPortalLink.portalLink.copiedAt, "hosted portal copy event was not recorded");

    const revokedPortalLink = await request(`${baseUrl}/api/portal-links/${encodeURIComponent(portalLink.portalLink.id)}/revoke`, {
      method: "POST",
      token: ownerToken
    });
    assert(revokedPortalLink.portalLink.status === "revoked", "hosted portal revoke failed");
    const blockedPortalValidation = await requestError(`${baseUrl}/api/portal-links/validate/${encodeURIComponent(portalLink.token)}`);
    assert(blockedPortalValidation.status === 403, "revoked hosted portal token should not validate");

    const invitation = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: ownerToken,
      body: {
        name: "Client User",
        email: "client@example.test",
        role: "client",
        companyId: "company-record"
      }
    });
    const resentInvitation = await request(`${baseUrl}/api/invitations/${invitation.invitation.id}/resend`, {
      method: "POST",
      token: ownerToken
    });
    assert(resentInvitation.invitation.token && resentInvitation.invitation.token !== invitation.invitation.token, "invite resend did not refresh token");
    assert(resentInvitation.invitation.expiresAt, "invite resend did not set expiry");

    const revokedInvite = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: ownerToken,
      body: {
        name: "Revoked User",
        email: "revoked@example.test",
        role: "member"
      }
    });
    const revoked = await request(`${baseUrl}/api/invitations/${revokedInvite.invitation.id}`, {
      method: "DELETE",
      token: ownerToken
    });
    assert(revoked.invitation.status === "revoked", "invite revoke failed");

    const accepted = await request(`${baseUrl}/api/invitations/${resentInvitation.invitation.token}/accept`, {
      method: "POST",
      body: {
        name: "Client User",
        password: "client-secret"
      }
    });
    assert(accepted.membership.role === "client", "invite password accept did not preserve role");
    assert(accepted.membership.companyId === "company-record", "accepted client invite did not keep company scope");
    assert(accepted.user.companyId === "company-record", "accepted client user did not keep company scope");

    const clientLogin = await request(`${baseUrl}/api/auth/password-login`, {
      method: "POST",
      body: {
        email: "client@example.test",
        password: "client-secret"
      }
    });
    assert(clientLogin.user.email === "client@example.test", "invited password login failed");
    assert(clientLogin.membership.companyId === "company-record", "client password login dropped company scope");

    const clientApprovals = await request(`${baseUrl}/api/records/approvals`, {
      token: clientLogin.token
    });
    assert(clientApprovals.records.length === 1, "client record scope did not filter approvals");
    assert(clientApprovals.records[0].id === "approval-record", "client record scope returned another company's approval");

    const blockedClientWrite = await requestError(`${baseUrl}/api/records/approvals`, {
      method: "POST",
      token: clientLogin.token,
      body: {
        record: {
          id: "approval-escape",
          companyId: "other-company",
          projectId: "other-project",
          title: "Scope Escape",
          status: "requested"
        }
      }
    });
    assert(blockedClientWrite.status === 403, "client cross-company record write should be blocked");

    const blockedClientCreate = await requestError(`${baseUrl}/api/records/approvals`, {
      method: "POST",
      token: clientLogin.token,
      body: {
        record: {
          id: "approval-client-created",
          companyId: "company-record",
          projectId: "project-record",
          title: "Client-created approval",
          status: "approved"
        }
      }
    });
    assert(blockedClientCreate.status === 403, "client should not create new approvals");

    const clientApprovalResponse = await request(`${baseUrl}/api/records/approvals`, {
      method: "POST",
      token: clientLogin.token,
      body: {
        record: {
          id: "approval-record",
          companyId: "company-record",
          projectId: "project-record",
          title: "Client changed the title",
          status: "approved"
        }
      }
    });
    assert(clientApprovalResponse.record.status === "approved", "client approval response did not update status");
    assert(clientApprovalResponse.record.title === "Record Approval", "client approval response should not change title");

    const clientBackendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: clientLogin.token
    });
    const clientApprovalReport = clientBackendHealth.records.find((record) => record.key === "approvals");
    assert(clientBackendHealth.membership.role === "client", "client backend health did not include client membership");
    assert(clientApprovalReport.count === 1, "client backend health did not use company-scoped record counts");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (originalResetReturnToken === undefined) {
      delete process.env.AGORA_PASSWORD_RESET_RETURN_TOKEN;
    } else {
      process.env.AGORA_PASSWORD_RESET_RETURN_TOKEN = originalResetReturnToken;
    }
    if (originalResetDelivery === undefined) {
      delete process.env.AGORA_PASSWORD_RESET_DELIVERY;
    } else {
      process.env.AGORA_PASSWORD_RESET_DELIVERY = originalResetDelivery;
    }
    if (originalResetWebhookUrl === undefined) {
      delete process.env.AGORA_PASSWORD_RESET_WEBHOOK_URL;
    } else {
      process.env.AGORA_PASSWORD_RESET_WEBHOOK_URL = originalResetWebhookUrl;
    }
    if (originalResetWebhookSecret === undefined) {
      delete process.env.AGORA_PASSWORD_RESET_WEBHOOK_SECRET;
    } else {
      process.env.AGORA_PASSWORD_RESET_WEBHOOK_SECRET = originalResetWebhookSecret;
    }
    global.fetch = originalFetch;
  }
}

async function testConcurrentAuthMutations() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-auth-race-"));
  const server = createServer({
    storage: createStorage({ dataDir, driver: "json" }),
    rateLimits: { auth: { attempts: 1000, windowMs: 60 * 1000 } }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const signupResponses = await Promise.all([
      fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Race Owner A", email: "race-a@example.test", password: "race-secret" })
      }),
      fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Race Owner B", email: "race-b@example.test", password: "race-secret" })
      })
    ]);
    const signupPayloads = await Promise.all(signupResponses.map((response) => response.json()));
    const successfulSignups = signupResponses.map((response, index) => ({ response, payload: signupPayloads[index] })).filter((item) => item.response.ok);
    assert(successfulSignups.length === 1, "concurrent owner bootstrap created more than one owner");

    const ownerToken = successfulSignups[0].payload.token;
    const invitation = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: ownerToken,
      body: { name: "Race Invite", email: "race-invite@example.test", role: "member" }
    });
    const acceptanceResponses = await Promise.all([0, 1].map(() => fetch(`${baseUrl}/api/invitations/${invitation.invitation.token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Race Invite", password: "invite-secret" })
    })));
    const successfulAcceptances = acceptanceResponses.filter((response) => response.ok);
    assert(successfulAcceptances.length === 1, "concurrent invitation redemption created more than one session");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function testLockedAuthDefaults() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-locked-auth-"));
  const server = createServer({
    storage: createStorage({ dataDir, driver: "json" }),
    allowDemoAuth: false,
    allowPasswordlessAuth: false
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const demoLogin = await requestError(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    assert(demoLogin.status === 404, "demo login should be disabled by default");

    const signup = await request(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      body: {
        name: "Locked Owner",
        email: "locked@example.test",
        password: "super-secret",
        workspaceName: "Locked Workspace"
      }
    });
    assert(signup.token, "locked auth signup did not create owner");

    const passwordlessLogin = await requestError(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: { email: "locked@example.test" }
    });
    assert(passwordlessLogin.status === 404, "passwordless login should be disabled by default");

    const passwordLogin = await request(`${baseUrl}/api/auth/password-login`, {
      method: "POST",
      body: {
        email: "locked@example.test",
        password: "super-secret"
      }
    });
    assert(passwordLogin.user.id === signup.user.id, "password login should keep working when passwordless auth is disabled");
    const queryTokenSession = await requestError(`${baseUrl}/api/session?token=${encodeURIComponent(passwordLogin.token)}`);
    assert(queryTokenSession.status === 401, "query-string bearer tokens should not authenticate");

    for (let index = 0; index < 8; index += 1) {
      const failedLogin = await requestError(`${baseUrl}/api/auth/password-login`, {
        method: "POST",
        headers: { "x-forwarded-for": `203.0.113.${index + 1}` },
        body: {
          email: "missing@example.test",
          password: "wrong-password"
        }
      });
      assert(failedLogin.status === 401, "invalid password should fail before the rate limit is exhausted");
    }

    const rateLimitedLogin = await requestError(`${baseUrl}/api/auth/password-login`, {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.250" },
      body: {
        email: "missing@example.test",
        password: "wrong-password"
      }
    });
    assert(rateLimitedLogin.status === 429, "spoofed forwarded IPs should not bypass auth rate limits");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function testAuthenticatedRateLimit() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-rate-limit-"));
  const server = createServer({
    storage: createStorage({ dataDir, driver: "json" }),
    rateLimits: {
      authenticatedWrite: { attempts: 20, windowMs: 60 * 1000 },
      expensive: { attempts: 1, windowMs: 60 * 1000 }
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const signup = await request(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      body: {
        name: "Rate Owner",
        email: "rate-owner@example.test",
        password: "super-secret",
        workspaceName: "Rate Workspace",
        workspaceSlug: "rate-workspace"
      }
    });

    const checkoutBody = {
      provider: "test",
      item: {
        itemId: "rate-limit-pack",
        name: "Rate Limit Pack",
        amountCents: 1000,
        currency: "USD"
      }
    };
    const firstIntent = await request(`${baseUrl}/api/payments/checkout-intent`, {
      method: "POST",
      token: signup.token,
      body: checkoutBody
    });
    assert(firstIntent.intent.id, "first expensive authenticated request should succeed");

    const rateLimitedIntent = await requestError(`${baseUrl}/api/payments/checkout-intent`, {
      method: "POST",
      token: signup.token,
      body: checkoutBody
    });
    assert(rateLimitedIntent.status === 429, "expensive authenticated API requests should be rate limited");
    assert(Number(rateLimitedIntent.headers["retry-after"]) > 0, "rate-limited responses should include Retry-After");

    const observability = await request(`${baseUrl}/api/observability`, { token: signup.token });
    assert(observability.rateLimits?.categories?.expensive?.attempts === 1, "observability should expose expensive rate-limit policy");
    assert(observability.rateLimits?.recent429s?.some((event) => event.category === "expensive"), "observability should expose recent rate-limit events");

    const audit = await request(`${baseUrl}/api/audit-log`, { token: signup.token });
    assert(audit.events.some((event) => event.action === "api_rate_limit_exceeded" && event.metadata?.category === "expensive"), "sensitive rate-limit events should be audited");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function testSupabaseAuthBridge() {
  const originalFetch = global.fetch;
  const originalEnv = {
    AGORA_AUTH_DRIVER: process.env.AGORA_AUTH_DRIVER,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
  };
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-supabase-auth-"));
  process.env.AGORA_AUTH_DRIVER = "supabase";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";

  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.hostname === "example.supabase.co" && parsed.pathname === "/auth/v1/signup") {
      const body = JSON.parse(options.body || "{}");
      assert(options.headers?.apikey === "anon-key", "supabase signup did not use anon key");
      assert(body.email === "supabase@example.test", "supabase signup did not send email");
      return mockResponse({
        access_token: "signup-token",
        token_type: "bearer",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "supabase@example.test"
        }
      });
    }
    if (parsed.hostname === "example.supabase.co" && parsed.pathname === "/auth/v1/token" && parsed.searchParams.get("grant_type") === "password") {
      const body = JSON.parse(options.body || "{}");
      assert(options.headers?.apikey === "anon-key", "supabase password login did not use anon key");
      assert(body.email === "supabase@example.test", "supabase password login did not send email");
      return mockResponse({
        access_token: "password-token",
        token_type: "bearer",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "supabase@example.test"
        }
      });
    }
    if (parsed.hostname === "example.supabase.co" && parsed.pathname === "/auth/v1/user") {
      const acceptedTokens = new Set(["supabase-token", "signup-token", "password-token"]);
      const token = String(options.headers?.Authorization || "").replace(/^Bearer\s+/, "");
      if (!acceptedTokens.has(token)) {
        return mockResponse({ message: "Invalid token" }, false, 401);
      }
      return mockResponse({
        id: "00000000-0000-4000-8000-000000000001",
        email: "supabase@example.test",
        created_at: "2026-06-28T12:00:00.000Z",
        user_metadata: {
          full_name: "Supabase User"
        }
      });
    }
    return originalFetch(url, options);
  };

  const server = createServer({ storage: createStorage({ dataDir, driver: "json" }) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await request(`${baseUrl}/api/health`);
    assert(health.auth === "supabase", "health did not expose supabase auth mode");

    const supabaseSignup = await request(`${baseUrl}/api/auth/supabase-password-signup`, {
      method: "POST",
      body: {
        name: "Supabase User",
        email: "supabase@example.test",
        password: "supabase-secret"
      }
    });
    assert(supabaseSignup.token, "supabase password signup did not return an Agora session token");
    assert(supabaseSignup.user.email === "supabase@example.test", "supabase password signup did not return Supabase user");

    const exchange = await request(`${baseUrl}/api/auth/supabase-login`, {
      method: "POST",
      body: { accessToken: "supabase-token" }
    });
    assert(exchange.token, "supabase login did not return an Agora session token");
    assert(exchange.user.email === "supabase@example.test", "supabase login did not return Supabase user");
    assert(exchange.user.authProvider === "supabase", "supabase login did not mark auth provider");
    assert(exchange.membership.role === "admin", "first Supabase user did not bootstrap as admin");

    const supabasePasswordLogin = await request(`${baseUrl}/api/auth/supabase-password-login`, {
      method: "POST",
      body: {
        email: "supabase@example.test",
        password: "supabase-secret"
      }
    });
    assert(supabasePasswordLogin.token, "supabase password login did not return an Agora session token");
    assert(supabasePasswordLogin.user.email === "supabase@example.test", "supabase password login did not return Supabase user");

    const members = await request(`${baseUrl}/api/members`, {
      token: exchange.token
    });
    assert(members.users.some((user) => user.email === "supabase@example.test"), "supabase user was not saved to access list");

    const directSession = await request(`${baseUrl}/api/session`, {
      token: "supabase-token"
    });
    assert(directSession.user.email === "supabase@example.test", "direct Supabase bearer token was not accepted");

    const backendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: exchange.token
    });
    assert(backendHealth.auth === "supabase", "backend health did not expose Supabase auth mode");
    assert(backendHealth.readiness.some((item) => item.id === "production-mode"), "backend health did not include production readiness");

    const invalid = await requestError(`${baseUrl}/api/session`, {
      token: "invalid-token"
    });
    assert(invalid.status === 401, "invalid Supabase bearer token should be rejected");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
    global.fetch = originalFetch;
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

async function testSupabaseStorageAdapter() {
  const originalFetch = global.fetch;
  const snapshots = new Map();
  const records = new Map();
  const backgroundJobs = new Map();
  const authSessions = new Map();
  const auditEvents = [];

  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").pop();
    const body = options.body ? JSON.parse(options.body) : null;

    if (table === "agora_workspace_snapshots" && (!options.method || options.method === "GET")) {
      const workspaceId = parsed.searchParams.get("workspace_id")?.replace(/^eq\./, "");
      const row = snapshots.get(workspaceId);
      return mockResponse(row ? [row] : []);
    }

    if (table === "agora_workspace_snapshots" && options.method === "POST") {
      const existing = snapshots.get(body.workspace_id);
      const row = {
        created_at: existing?.created_at || "2026-06-28T00:00:00.000Z",
        updated_at: body.updated_at,
        ...existing,
        ...body
      };
      snapshots.set(body.workspace_id, row);
      return mockResponse([row]);
    }

    if (table === "agora_compare_and_swap_workspace_snapshot" && options.method === "POST") {
      const existing = snapshots.get(body.p_workspace_id);
      const currentRevision = Number(existing?.revision || 0);
      if (currentRevision !== Number(body.p_expected_revision)) return mockResponse([]);
      const row = {
        workspace_id: body.p_workspace_id,
        snapshot: body.p_snapshot,
        metadata: body.p_metadata,
        revision: currentRevision + 1,
        created_at: existing?.created_at || "2026-06-28T00:00:00.000Z",
        updated_at: "2026-06-28T00:00:00.000Z"
      };
      snapshots.set(body.p_workspace_id, row);
      return mockResponse([row]);
    }

    if (table === "agora_audit_events" && (!options.method || options.method === "GET")) {
      return mockResponse(auditEvents);
    }

    if (table === "agora_audit_events" && options.method === "POST") {
      auditEvents.unshift(body);
      return mockResponse([body]);
    }

    if (table === "agora_background_jobs" && (!options.method || options.method === "GET")) {
      const workspaceId = parsed.searchParams.get("workspace_id")?.replace(/^eq\./, "");
      const rows = [...backgroundJobs.values()].filter((row) => !workspaceId || row.workspace_id === workspaceId);
      return mockResponse(rows);
    }

    if (table === "agora_background_jobs" && options.method === "POST") {
      const rows = Array.isArray(body) ? body : [body];
      rows.forEach((row) => backgroundJobs.set(row.id, {
        created_at: row.created_at || "2026-06-28T00:00:00.000Z",
        updated_at: row.updated_at || "2026-06-28T00:00:00.000Z",
        ...row
      }));
      return mockResponse(rows.map((row) => backgroundJobs.get(row.id)));
    }

    if (table === "agora_auth_sessions" && (!options.method || options.method === "GET")) {
      const workspaceId = parsed.searchParams.get("workspace_id")?.replace(/^eq\./, "");
      const rows = [...authSessions.values()].filter((row) => !workspaceId || row.workspace_id === workspaceId);
      return mockResponse(rows);
    }

    if (table === "agora_auth_sessions" && options.method === "POST") {
      const rows = Array.isArray(body) ? body : [body];
      rows.forEach((row) => authSessions.set(row.token_hash, {
        created_at: row.created_at || "2026-06-28T00:00:00.000Z",
        updated_at: row.updated_at || "2026-06-28T00:00:00.000Z",
        ...row
      }));
      return mockResponse(rows.map((row) => authSessions.get(row.token_hash)));
    }

    if (table.startsWith("agora_") && table !== "agora_workspace_snapshots" && table !== "agora_audit_events" && (!options.method || options.method === "GET")) {
      const workspaceId = parsed.searchParams.get("workspace_id")?.replace(/^eq\./, "");
      const projectId = parsed.searchParams.get("project_id")?.replace(/^eq\./, "");
      const companyId = parsed.searchParams.get("company_id")?.replace(/^eq\./, "");
      const memberId = parsed.searchParams.get("member_id")?.replace(/^eq\./, "");
      const tokenHash = parsed.searchParams.get("record->>tokenHash")?.replace(/^eq\./, "");
      const limit = Number(parsed.searchParams.get("limit") || 0);
      const offset = Number(parsed.searchParams.get("offset") || 0);
      const rows = [...(records.get(table)?.values() || [])]
        .filter((row) => !workspaceId || row.workspace_id === workspaceId)
        .filter((row) => !projectId || row.project_id === projectId)
        .filter((row) => !companyId || row.company_id === companyId)
        .filter((row) => !memberId || row.member_id === memberId)
        .filter((row) => !tokenHash || row.record?.tokenHash === tokenHash);
      const pageRows = limit ? rows.slice(offset, offset + limit) : rows;
      return mockResponse(pageRows, true, 200, {
        "content-range": `${offset}-${offset + pageRows.length - 1}/${rows.length}`
      });
    }

    if (table.startsWith("agora_") && table !== "agora_workspace_snapshots" && table !== "agora_audit_events" && options.method === "POST") {
      if (!records.has(table)) records.set(table, new Map());
      const row = {
        created_at: body.created_at || "2026-06-28T00:00:00.000Z",
        updated_at: body.updated_at || "2026-06-28T00:00:00.000Z",
        ...body
      };
      records.get(table).set(row.id, row);
      return mockResponse([row]);
    }

    return mockResponse({ message: "Unexpected Supabase request" }, false, 404);
  };

  try {
    const storage = createSupabaseStorage({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceRoleKey: "service-role-key",
      workspaceId: "workspace-smoke"
    });
    assert((await storage.loadWorkspace()) === null, "supabase empty load failed");

    const saved = await storage.saveWorkspace({
      workspace: { id: "workspace-smoke", name: "Supabase Smoke" },
      projects: [],
      tasks: []
    }, {
      action: "workspace_update"
    });
    assert(saved.snapshot.workspace.name === "Supabase Smoke", "supabase save failed");

    const snapshot = await storage.loadWorkspaceSnapshot();
    assert(snapshot.workspace.name === "Supabase Smoke", "supabase snapshot load failed");

    await storage.appendAuditEvent({
      actorId: "mara",
      action: "workspace_update",
      workspaceId: "workspace-smoke",
      detail: "Saved workspace"
    });
    const auditLog = await storage.loadAuditLog();
    assert(auditLog.length === 1 && auditLog[0].action === "workspace_update", "supabase audit failed");

    const savedRecord = await storage.upsertRecord("comments", {
      id: "comment-supabase",
      taskId: "task-supabase",
      projectId: "project-supabase",
      author: "mara",
      body: "Stored as a Supabase record",
      createdAt: "2026-06-28T12:00:00.000Z"
    }, {
      action: "comment_create"
    });
    assert(savedRecord.body === "Stored as a Supabase record", "supabase record save failed");

    const loadedRecords = await storage.loadRecords("comments", { projectId: "project-supabase" });
    assert(loadedRecords.length === 1 && loadedRecords[0].id === "comment-supabase", "supabase record load failed");
    await storage.upsertRecord("comments", {
      id: "comment-supabase-2",
      taskId: "task-supabase",
      projectId: "project-supabase",
      author: "mara",
      body: "Second Supabase record",
      createdAt: "2026-06-28T12:05:00.000Z"
    }, {
      action: "comment_create"
    });
    const recordPage = await storage.loadRecordPage("comments", { projectId: "project-supabase", limit: 1, offset: 0 });
    assert(recordPage.records.length === 1, "supabase record page did not apply limit");
    assert(recordPage.page.total === 2 && recordPage.page.hasMore, "supabase record page did not report total count");

    await storage.saveBackgroundJobs([{
      id: "job-supabase",
      type: "feature-request-email",
      status: "queued",
      attempts: 1,
      maxAttempts: 3,
      metadata: { taskId: "task-supabase" },
      payload: { to: "owner@example.test", subject: "Feature request", text: "Ship it" },
      createdAt: "2026-06-28T12:00:00.000Z",
      updatedAt: "2026-06-28T12:00:00.000Z"
    }]);
    const persistedJobs = await storage.loadBackgroundJobs();
    assert(persistedJobs.some((job) => job.id === "job-supabase" && job.payload.to === "owner@example.test"), "supabase background job persistence failed");

    await storage.saveAuthSessions([{
      tokenHash: "auth-session-hash-1",
      workspaceId: "workspace-smoke",
      userId: "user-1",
      userEmail: "user@example.com",
      userName: "User One",
      role: "admin",
      status: "active",
      companyId: "",
      permissions: ["workspace:read"],
      createdAt: "2026-06-28T00:00:00.000Z",
      expiresAt: "2026-06-28T08:00:00.000Z",
      lastSeenAt: "2026-06-28T00:00:00.000Z",
      requestCount: 1,
      clientIpHash: "clienthash",
      userAgent: "Smoke"
    }]);
    const persistedAuthSessions = await storage.loadAuthSessions();
    assert(persistedAuthSessions.some((session) => session.tokenHash === "auth-session-hash-1" && session.role === "admin"), "supabase auth session persistence failed");

    const savedMembership = await storage.upsertAuthMembership({
      workspaceId: "workspace-smoke",
      userId: "00000000-0000-4000-8000-000000000002",
      role: "admin",
      status: "active",
      companyId: "",
      joinedAt: "2026-06-28T12:00:00.000Z"
    });
    assert(savedMembership.userId === "00000000-0000-4000-8000-000000000002", "supabase auth membership save failed");
  } finally {
    global.fetch = originalFetch;
  }
}

function mockResponse(body, ok = true, status = 200, headers = {}) {
  return {
    ok,
    status,
    headers: {
      get: (name) => headers[String(name || "").toLowerCase()] || null
    },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.rawBody || (options.body ? JSON.stringify(options.body) : undefined)
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${body.error || "Request failed"}`);
  }
  return body;
}

async function requestError(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.rawBody || (options.body ? JSON.stringify(options.body) : undefined)
  });
  const body = await response.json();
  if (response.ok) {
    throw new Error(`Expected request to fail: ${url}`);
  }
  return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
}

async function requestRaw(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(options.headers || {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    }
  });
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`${response.status} ${body.toString("utf8") || "Request failed"}`);
  }
  return { status: response.status, headers: response.headers, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function restoreOptionalEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function githubSignature(body, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
