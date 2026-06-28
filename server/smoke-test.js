const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("./api");
const { createStorage, createSupabaseStorage } = require("./storage");

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-api-"));
  const server = createServer({ storage: createStorage({ dataDir, driver: "json" }) });

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

    const access = await request(`${baseUrl}/api/members`, {
      token: login.token
    });
    assert(access.users.length === 4, "member list did not include demo users");

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

    const comments = await request(`${baseUrl}/api/comments?taskId=task-smoke`, {
      token: login.token
    });
    assert(comments.comments.length === 1, "comment list failed");

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

    const files = await request(`${baseUrl}/api/files?projectId=project-smoke`, {
      token: login.token
    });
    assert(files.files.length === 1, "file list failed");

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
    assert(workspace.snapshot.users.some((user) => user.email === "jordan@example.test"), "workspace save dropped accepted invite user");
    assert(workspace.snapshot.invitations.some((invite) => invite.email === "jordan@example.test" && invite.status === "accepted"), "workspace save dropped invitation state");
    assert(workspace.snapshot.projects[0].name === "Updated Smoke Project", "project not stored in workspace");
    assert(workspace.snapshot.tasks[0].title === "Updated Smoke Task", "task not stored in workspace");
    assert(workspace.snapshot.projects[0].archivedAt, "project archive not stored in workspace");
    assert(workspace.snapshot.tasks[0].archivedAt, "project archive did not archive task");
    assert(workspace.snapshot.comments[0].body === "Smoke test comment", "comment not stored in workspace");
    assert(workspace.snapshot.activities[0].message === "commented on Updated Smoke Task", "activity not stored in workspace");
    assert(workspace.snapshot.documents[0].title === "Smoke Doc", "document not stored in workspace");
    assert(workspace.snapshot.files[0].title === "smoke-plan.pdf", "file not stored in workspace");

    const audit = await request(`${baseUrl}/api/audit-log`, {
      token: login.token
    });
    assert(audit.events.length === 14, "audit log was not written");

    await testAccountAuth();
    await testSupabaseStorageAdapter();

    console.log("API smoke test passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function testAccountAuth() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-auth-"));
  const server = createServer({ storage: createStorage({ dataDir, driver: "json" }) });

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

    const passwordLogin = await request(`${baseUrl}/api/auth/password-login`, {
      method: "POST",
      body: {
        email: "owner@example.test",
        password: "super-secret"
      }
    });
    assert(passwordLogin.user.id === signup.user.id, "password login did not return owner");

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
    const accepted = await request(`${baseUrl}/api/invitations/${invitation.invitation.token}/accept`, {
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
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
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
  } finally {
    global.fetch = originalFetch;
  }
}

function mockResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
