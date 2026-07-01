const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("./api");
const { createStorage, createSupabaseStorage } = require("./storage");

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-api-"));
  const server = createServer({
    storage: createStorage({ dataDir, driver: "json" }),
    allowDemoAuth: true,
    allowPasswordlessAuth: true
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await request(`${baseUrl}/api/health`);
    assert(health.ok === true, "health endpoint failed");

    const login = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    assert(login.token, "demo login did not return a token");
    assert(login.membership.role === "admin", "demo login did not return admin role");
    assert(login.expiresAt, "session did not include an expiry");

    const access = await request(`${baseUrl}/api/members`, {
      token: login.token
    });
    assert(access.users.length === 4, "member list did not include demo users");

    const backendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: login.token
    });
    assert(backendHealth.storage === "json-file", "backend health did not expose storage driver");
    assert(backendHealth.auth === "local", "backend health did not expose auth driver");
    assert(backendHealth.records.some((record) => record.key === "comments"), "backend health did not report record collections");
    assert(backendHealth.readiness.some((item) => item.id === "structured-records"), "backend health did not include readiness items");

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

    const accepted = await request(`${baseUrl}/api/invitations/${invitation.invitation.token}/accept`, {
      method: "POST",
      body: { name: "Jordan Lee" }
    });
    assert(accepted.token, "accepted invite did not create a session");
    assert(accepted.user.email === "jordan@example.test", "accepted invite did not return invited user");
    assert(accepted.membership.role === "member", "accepted invite did not use invited role");

    const emailLogin = await request(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: { email: "jordan@example.test" }
    });
    assert(emailLogin.user.id === accepted.user.id, "email login did not find accepted invite user");

    const saved = await request(`${baseUrl}/api/workspace`, {
      method: "PUT",
      token: login.token,
      body: {
        snapshot: {
          workspace: { id: "workspace-acme", name: "Smoke Test Studio" },
          projects: [],
          tasks: []
        }
      }
    });
    assert(saved.snapshot.workspace.name === "Smoke Test Studio", "workspace save failed");

    const paymentConfig = await request(`${baseUrl}/api/payments/config`, {
      token: login.token
    });
    assert(paymentConfig.providers.some((provider) => provider.id === "test" && provider.live === true), "payment config did not expose test adapter");
    assert(paymentConfig.providers.some((provider) => provider.id === "x402"), "payment config did not expose x402 adapter stub");

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
    assert(tasks.tasks.length === 1, "task list failed");

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

    const downloadedFile = await requestRaw(`${baseUrl}${uploadedFile.file.url}`, {
      token: login.token
    });
    assert(downloadedFile.body.toString("utf8") === "Uploaded by the smoke test", "file download did not return uploaded content");

    const files = await request(`${baseUrl}/api/files?projectId=project-smoke`, {
      token: login.token
    });
    assert(files.files.length === 2, "file list failed");

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

    const workspace = await request(`${baseUrl}/api/workspace`, {
      token: login.token
    });
    assert(workspace.snapshot.workspace.name === "Smoke Test Studio", "workspace load failed");
    assert(workspace.snapshot.workspace.payments.entitlements.some((entitlement) => entitlement.itemId === "marketplace-agency-retainer-os"), "workspace snapshot dropped payment entitlement");
    assert(workspace.snapshot.users.some((user) => user.email === "jordan@example.test"), "workspace save dropped accepted invite user");
    assert(workspace.snapshot.invitations.some((invite) => invite.email === "jordan@example.test" && invite.status === "accepted"), "workspace save dropped invitation state");
    assert(workspace.snapshot.projects[0].name === "Updated Smoke Project", "project not stored in workspace");
    assert(workspace.snapshot.tasks[0].title === "Updated Smoke Task", "task not stored in workspace");
    assert(workspace.snapshot.projects[0].archivedAt, "project archive not stored in workspace");
    assert(workspace.snapshot.tasks[0].archivedAt, "project archive did not archive task");
    assert(workspace.snapshot.comments.some((comment) => comment.body === "Smoke test comment"), "comment not stored in workspace");
    assert(workspace.snapshot.comments.some((comment) => comment.author === accepted.user.id), "member comment author not stored correctly");
    assert(workspace.snapshot.timeEntries.some((entry) => entry.memberId === accepted.user.id), "member time entry not stored correctly");
    assert(workspace.snapshot.chatMessages.some((message) => message.author === accepted.user.id), "member chat message not stored correctly");
    assert(workspace.snapshot.whiteboards.some((board) => board.title === "Smoke Whiteboard"), "whiteboard not stored in workspace");
    assert(workspace.snapshot.activities[0].message === "commented on Updated Smoke Task", "activity not stored in workspace");
    assert(workspace.snapshot.documents[0].title === "Smoke Doc", "document not stored in workspace");
    assert(workspace.snapshot.files.some((file) => file.title === "smoke-plan.pdf"), "file not stored in workspace");
    assert(workspace.snapshot.files.some((file) => file.title === "smoke-upload.txt"), "uploaded file not stored in workspace");

    const finalBackendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: login.token
    });
    const commentsReport = finalBackendHealth.records.find((record) => record.key === "comments");
    const chatReport = finalBackendHealth.records.find((record) => record.key === "chatMessages");
    assert(commentsReport && commentsReport.count === 2, "backend health did not count structured comments");
    assert(chatReport && chatReport.count === 1, "backend health did not count structured chat");
    assert(finalBackendHealth.snapshot.counts.projects === 1, "backend health did not count snapshot projects");

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
    await testSupabaseAuthBridge();
    await testSupabaseStorageAdapter();

    console.log("API smoke test passed");
  } finally {
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
      token: signup.token
    });
    const owner = members.users.find((user) => user.email === "owner@example.test");
    assert(owner && owner.hasPassword === true, "members did not include password status");
    assert(!owner.passwordHash && !owner.passwordSalt, "members leaked password fields");

    const company = await request(`${baseUrl}/api/records/companies`, {
      method: "POST",
      token: signup.token,
      body: {
        record: {
          id: "company-record",
          name: "Record Company",
          owner: "owner"
        }
      }
    });
    assert(company.record.name === "Record Company", "record company upsert failed");

    const otherCompany = await request(`${baseUrl}/api/records/companies`, {
      method: "POST",
      token: signup.token,
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
      token: signup.token,
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

    const otherProject = await request(`${baseUrl}/api/projects`, {
      method: "POST",
      token: signup.token,
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
      token: signup.token,
      body: {
        record: {
          id: "approval-record",
          companyId: "company-record",
          projectId: "project-record",
          title: "Record Approval",
          status: "requested"
        }
      }
    });
    assert(approval.record.title === "Record Approval", "record approval upsert failed");

    const otherApproval = await request(`${baseUrl}/api/records/approvals`, {
      method: "POST",
      token: signup.token,
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
      token: signup.token
    });
    assert(records.records.length === 1, "record approval filter failed");

    const invitation = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: signup.token,
      body: {
        name: "Client User",
        email: "client@example.test",
        role: "client",
        companyId: "company-record"
      }
    });
    const resentInvitation = await request(`${baseUrl}/api/invitations/${invitation.invitation.id}/resend`, {
      method: "POST",
      token: signup.token
    });
    assert(resentInvitation.invitation.token && resentInvitation.invitation.token !== invitation.invitation.token, "invite resend did not refresh token");
    assert(resentInvitation.invitation.expiresAt, "invite resend did not set expiry");

    const revokedInvite = await request(`${baseUrl}/api/invitations`, {
      method: "POST",
      token: signup.token,
      body: {
        name: "Revoked User",
        email: "revoked@example.test",
        role: "member"
      }
    });
    const revoked = await request(`${baseUrl}/api/invitations/${revokedInvite.invitation.id}`, {
      method: "DELETE",
      token: signup.token
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

    if (table === "agora_audit_events" && (!options.method || options.method === "GET")) {
      return mockResponse(auditEvents);
    }

    if (table === "agora_audit_events" && options.method === "POST") {
      auditEvents.unshift(body);
      return mockResponse([body]);
    }

    if (table.startsWith("agora_") && table !== "agora_workspace_snapshots" && table !== "agora_audit_events" && (!options.method || options.method === "GET")) {
      const workspaceId = parsed.searchParams.get("workspace_id")?.replace(/^eq\./, "");
      const projectId = parsed.searchParams.get("project_id")?.replace(/^eq\./, "");
      const rows = [...(records.get(table)?.values() || [])]
        .filter((row) => !workspaceId || row.workspace_id === workspaceId)
        .filter((row) => !projectId || row.project_id === projectId);
      return mockResponse(rows);
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

function mockResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
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
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  if (response.ok) {
    throw new Error(`Expected request to fail: ${url}`);
  }
  return { status: response.status, body };
}

async function requestRaw(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
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

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
