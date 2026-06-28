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

    const workspace = await request(`${baseUrl}/api/workspace`, {
      token: login.token
    });
    assert(workspace.snapshot.workspace.name === "Smoke Test Studio", "workspace load failed");
    assert(workspace.snapshot.projects[0].name === "Updated Smoke Project", "project not stored in workspace");
    assert(workspace.snapshot.tasks[0].title === "Updated Smoke Task", "task not stored in workspace");

    const audit = await request(`${baseUrl}/api/audit-log`, {
      token: login.token
    });
    assert(audit.events.length === 5, "audit log was not written");

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
