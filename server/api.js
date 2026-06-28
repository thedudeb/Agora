const http = require("node:http");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const { createStorage } = require("./storage");

const PORT = Number(process.env.AGORA_API_PORT || 8787);
const BODY_LIMIT_BYTES = 5 * 1024 * 1024;

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
  admin: ["workspace:read", "workspace:write", "workspace:import", "audit:read", "members:write", "projects:write", "tasks:write"],
  manager: ["workspace:read", "workspace:write", "audit:read", "projects:write", "tasks:write"],
  member: ["workspace:read"],
  client: ["workspace:read"]
};

const sessions = new Map();

function createServer(options = {}) {
  const storage = options.storage || createStorage();

  return http.createServer(async (request, response) => {
    try {
      applyCors(request, response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          service: "agora-api",
          storage: "json-file",
          workspace
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/demo-login") {
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

      const session = requireSession(request, response);
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

      if (request.method === "GET" && url.pathname === "/api/projects") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = storage.loadWorkspaceSnapshot();
        sendJson(response, 200, { projects: Array.isArray(snapshot.projects) ? snapshot.projects : [] });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const project = upsertProject(storage, body.project || body, session, "project_create");
        sendJson(response, 201, { project });
        return;
      }

      const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch && request.method === "PUT") {
        if (!hasPermission(session, "projects:write")) {
          sendError(response, 403, "Missing projects write permission");
          return;
        }
        const body = await readJsonBody(request);
        const project = upsertProject(storage, { ...(body.project || body), id: decodeURIComponent(projectMatch[1]) }, session, "project_update");
        sendJson(response, 200, { project });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/tasks") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        const snapshot = storage.loadWorkspaceSnapshot();
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
        const task = upsertTask(storage, body.task || body, session, "task_create");
        sendJson(response, 201, { task });
        return;
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch && request.method === "PUT") {
        if (!hasPermission(session, "tasks:write")) {
          sendError(response, 403, "Missing tasks write permission");
          return;
        }
        const body = await readJsonBody(request);
        const task = upsertTask(storage, { ...(body.task || body), id: decodeURIComponent(taskMatch[1]) }, session, "task_update");
        sendJson(response, 200, { task });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/workspace") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        sendJson(response, 200, storage.loadWorkspace() || {
          metadata: {
            createdAt: null,
            updatedAt: null,
            storage: "json-file"
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
        const document = saveWorkspaceSnapshot(storage, body.snapshot || body, session, "workspace_update");
        sendJson(response, 200, document);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/workspace/import") {
        if (!hasPermission(session, "workspace:import")) {
          sendError(response, 403, "Missing workspace import permission");
          return;
        }
        const body = await readJsonBody(request);
        const document = saveWorkspaceSnapshot(storage, body.snapshot || body, session, "workspace_import");
        sendJson(response, 200, document);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/audit-log") {
        if (!hasPermission(session, "audit:read")) {
          sendError(response, 403, "Missing audit read permission");
          return;
        }
        sendJson(response, 200, { events: storage.loadAuditLog() });
        return;
      }

      sendError(response, 404, "Route not found");
    } catch (error) {
      sendError(response, error.statusCode || 500, error.publicMessage || "Internal server error");
    }
  });
}

function createSession(user, membership) {
  const token = crypto.randomUUID();
  const session = {
    token,
    user,
    workspace,
    membership,
    permissions: rolePermissions[membership.role] || [],
    createdAt: new Date().toISOString()
  };
  sessions.set(token, session);
  return session;
}

function requireSession(request, response) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const session = sessions.get(token);
  if (!session) {
    sendError(response, 401, "Authentication required");
    return null;
  }
  return session;
}

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

function saveWorkspaceSnapshot(storage, snapshot, session, action) {
  validateSnapshot(snapshot);
  const document = storage.saveWorkspace(snapshot, {
    storage: "json-file",
    updatedBy: session.user.id,
    action
  });
  storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} saved a workspace snapshot`
  });
  return document;
}

function upsertProject(storage, project, session, action) {
  const incomingProject = requireRecord(project, "Project");
  const snapshot = storage.loadWorkspaceSnapshot();
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const existingProject = projects.find((item) => item.id === incomingProject.id);
  const nextProject = normalizeProject(existingProject ? { ...existingProject, ...incomingProject } : incomingProject);
  const exists = Boolean(existingProject);
  const nextProjects = exists
    ? projects.map((item) => item.id === nextProject.id ? { ...item, ...nextProject } : item)
    : [nextProject, ...projects];

  storage.saveWorkspaceSnapshot({
    ...snapshot,
    projects: nextProjects
  }, {
    storage: "json-file",
    updatedBy: session.user.id,
    action
  });
  storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} ${exists ? "updated" : "created"} project ${nextProject.name}`
  });
  return nextProjects.find((item) => item.id === nextProject.id);
}

function upsertTask(storage, task, session, action) {
  const incomingTask = requireRecord(task, "Task");
  const snapshot = storage.loadWorkspaceSnapshot();
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const existingTask = tasks.find((item) => item.id === incomingTask.id);
  const nextTask = normalizeTask(existingTask ? { ...existingTask, ...incomingTask } : incomingTask);
  const exists = Boolean(existingTask);
  const nextTasks = exists
    ? tasks.map((item) => item.id === nextTask.id ? { ...item, ...nextTask } : item)
    : [nextTask, ...tasks];

  storage.saveWorkspaceSnapshot({
    ...snapshot,
    tasks: nextTasks
  }, {
    storage: "json-file",
    updatedBy: session.user.id,
    action
  });
  storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} ${exists ? "updated" : "created"} task ${nextTask.title}`
  });
  return nextTasks.find((item) => item.id === nextTask.id);
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
    dueDate: project.dueDate ? String(project.dueDate) : ""
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
    createdAt: task.createdAt ? String(task.createdAt) : new Date().toISOString()
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
  const origin = request.headers.origin || "*";
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Agora API listening at http://127.0.0.1:${PORT}`);
  });
}

module.exports = {
  createServer,
  rolePermissions
};
