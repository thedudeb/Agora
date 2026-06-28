const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("./api");
const { createStorage } = require("./storage");

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-api-"));
  const server = createServer({ storage: createStorage({ dataDir }) });

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
    assert(audit.events.length === 12, "audit log was not written");

    console.log("API smoke test passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
