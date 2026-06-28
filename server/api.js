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
  admin: ["workspace:read", "workspace:write", "workspace:import", "audit:read", "members:write", "projects:write", "tasks:write", "comments:write", "activity:write", "attachments:write"],
  manager: ["workspace:read", "workspace:write", "audit:read", "projects:write", "tasks:write", "comments:write", "activity:write", "attachments:write"],
  member: ["workspace:read", "comments:write", "activity:write", "attachments:write"],
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
          storage: storage.driver || "json-file",
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
        const snapshot = await storage.loadWorkspaceSnapshot();
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
        const snapshot = await storage.loadWorkspaceSnapshot();
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
        const snapshot = await storage.loadWorkspaceSnapshot();
        const taskId = url.searchParams.get("taskId");
        const comments = Array.isArray(snapshot.comments) ? snapshot.comments : [];
        sendJson(response, 200, { comments: taskId ? comments.filter((comment) => comment.taskId === taskId) : comments });
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
        const snapshot = await storage.loadWorkspaceSnapshot();
        const taskId = url.searchParams.get("taskId");
        const projectId = url.searchParams.get("projectId");
        let activities = Array.isArray(snapshot.activities) ? snapshot.activities : [];
        if (taskId) activities = activities.filter((activity) => activity.taskId === taskId);
        if (projectId) activities = activities.filter((activity) => activity.projectId === projectId);
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
        const snapshot = await storage.loadWorkspaceSnapshot();
        const projectId = url.searchParams.get("projectId");
        const documents = Array.isArray(snapshot.documents) ? snapshot.documents : [];
        sendJson(response, 200, { documents: projectId ? documents.filter((document) => document.projectId === projectId) : documents });
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
        const snapshot = await storage.loadWorkspaceSnapshot();
        const projectId = url.searchParams.get("projectId");
        const files = Array.isArray(snapshot.files) ? snapshot.files : [];
        sendJson(response, 200, { files: projectId ? files.filter((file) => file.projectId === projectId) : files });
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

      if (request.method === "GET" && url.pathname === "/api/workspace") {
        if (!hasPermission(session, "workspace:read")) {
          sendError(response, 403, "Missing workspace read permission");
          return;
        }
        sendJson(response, 200, await storage.loadWorkspace() || {
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

async function saveWorkspaceSnapshot(storage, snapshot, session, action) {
  validateSnapshot(snapshot);
  const document = await storage.saveWorkspace(snapshot, {
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
  const existingTask = tasks.find((item) => item.id === incomingTask.id);
  const nextTask = normalizeTask(existingTask ? { ...existingTask, ...incomingTask } : incomingTask);
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
  const task = tasks.find((item) => item.id === taskId);
  if (!task) publicError(404, "Task not found");

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

async function upsertCollectionItem(storage, key, item, normalizer, session, action, detailLabel) {
  const snapshot = await storage.loadWorkspaceSnapshot();
  const collection = Array.isArray(snapshot[key]) ? snapshot[key] : [];
  const incomingItem = requireRecord(item, "Item");
  const existingItem = collection.find((entry) => entry.id === incomingItem.id);
  const nextItem = normalizer(existingItem ? { ...existingItem, ...incomingItem } : incomingItem);
  const nextCollection = existingItem
    ? collection.map((entry) => entry.id === nextItem.id ? { ...entry, ...nextItem } : entry)
    : [nextItem, ...collection];

  await storage.saveWorkspaceSnapshot({
    ...snapshot,
    [key]: nextCollection
  }, {
    storage: storage.driver || "json-file",
    updatedBy: session.user.id,
    action
  });
  await storage.appendAuditEvent({
    actorId: session.user.id,
    action,
    workspaceId: workspace.id,
    detail: `${session.user.name} saved ${detailLabel(nextItem)}`
  });
  return nextCollection.find((entry) => entry.id === nextItem.id);
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
    url: file.url ? String(file.url) : ""
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
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
