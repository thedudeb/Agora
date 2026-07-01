#!/usr/bin/env node
const crypto = require("node:crypto");
const readline = require("node:readline");
const { loadEnvFile } = require("../server/env");

loadEnvFile();

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_VERSION = "0.1.0";
const DEFAULT_API_URL = "http://127.0.0.1:8787";
const WRITE_ENV = "AGORA_MCP_ALLOW_WRITES";

const config = {
  apiUrl: cleanUrl(process.env.AGORA_API_URL || DEFAULT_API_URL),
  apiToken: cleanString(process.env.AGORA_API_TOKEN),
  allowWrites: envFlag(WRITE_ENV, false),
  clientName: cleanString(process.env.AGORA_MCP_CLIENT_NAME) || "MCP client"
};

const tools = [
  {
    name: "get_session",
    title: "Get Agora Session",
    description: "Return the authenticated Agora user, role, permissions, and company scope.",
    inputSchema: objectSchema({})
  },
  {
    name: "list_projects",
    title: "List Projects",
    description: "List Agora projects visible to the authenticated session.",
    inputSchema: objectSchema({
      query: stringProperty("Optional text search."),
      companyId: stringProperty("Optional company scope filter."),
      limit: integerProperty("Maximum projects to return.", 1, 500),
      offset: integerProperty("Offset for paging.", 0)
    })
  },
  {
    name: "list_tasks",
    title: "List Tasks",
    description: "List Agora tasks visible to the authenticated session, with optional filters.",
    inputSchema: objectSchema({
      query: stringProperty("Optional text search."),
      projectId: stringProperty("Optional project id."),
      companyId: stringProperty("Optional company id."),
      assignee: stringProperty("Optional assignee id or name filter."),
      status: stringProperty("Optional status filter."),
      priority: stringProperty("Optional priority filter."),
      tag: stringProperty("Optional tag filter."),
      limit: integerProperty("Maximum tasks to return.", 1, 500),
      offset: integerProperty("Offset for paging.", 0)
    })
  },
  {
    name: "get_task",
    title: "Get Task",
    description: "Return one task plus related comments and activity visible to the authenticated session.",
    inputSchema: objectSchema({
      taskId: requiredStringProperty("Task id.")
    }, ["taskId"])
  },
  {
    name: "get_project_status",
    title: "Get Project Status",
    description: "Summarize one project with task counts, due work, approvals, comments, and recent activity.",
    inputSchema: objectSchema({
      projectId: requiredStringProperty("Project id.")
    }, ["projectId"])
  },
  {
    name: "search_workspace",
    title: "Search Workspace",
    description: "Search visible projects, tasks, comments, activities, and approvals.",
    inputSchema: objectSchema({
      query: requiredStringProperty("Search query."),
      limit: integerProperty("Maximum total matches to return.", 1, 100)
    }, ["query"])
  },
  {
    name: "get_inbox_signals",
    title: "Get Inbox Signals",
    description: "Return due tasks, blocked work, pending approvals, mentions, and recent comments.",
    inputSchema: objectSchema({
      limit: integerProperty("Maximum signals to return.", 1, 100)
    })
  },
  {
    name: "create_task",
    title: "Create Task",
    description: `Create an Agora task. Disabled unless ${WRITE_ENV}=true.`,
    inputSchema: objectSchema({
      projectId: requiredStringProperty("Project id."),
      title: requiredStringProperty("Task title."),
      description: stringProperty("Optional task description."),
      assignee: stringProperty("Optional assignee."),
      status: stringProperty("Optional status."),
      priority: stringProperty("Optional priority."),
      dueDate: stringProperty("Optional ISO date."),
      tags: arrayProperty("Optional tags.", { type: "string" })
    }, ["projectId", "title"])
  },
  {
    name: "update_task_status",
    title: "Update Task Status",
    description: `Update a task status. Disabled unless ${WRITE_ENV}=true.`,
    inputSchema: objectSchema({
      taskId: requiredStringProperty("Task id."),
      status: requiredStringProperty("New task status.")
    }, ["taskId", "status"])
  },
  {
    name: "add_task_comment",
    title: "Add Task Comment",
    description: `Add a comment to a task. Disabled unless ${WRITE_ENV}=true.`,
    inputSchema: objectSchema({
      taskId: requiredStringProperty("Task id."),
      body: requiredStringProperty("Comment body."),
      projectId: stringProperty("Optional project id."),
      kind: stringProperty("Optional comment kind.")
    }, ["taskId", "body"])
  }
];

const resources = [
  {
    uri: "agora://workspace/summary",
    name: "Workspace Summary",
    description: "Session, backend health, project counts, and task counts for the authenticated Agora workspace.",
    mimeType: "application/json"
  },
  {
    uri: "agora://projects",
    name: "Projects",
    description: "Projects visible to the authenticated Agora session.",
    mimeType: "application/json"
  },
  {
    uri: "agora://tasks",
    name: "Tasks",
    description: "Recent tasks visible to the authenticated Agora session.",
    mimeType: "application/json"
  },
  {
    uri: "agora://inbox/signals",
    name: "Inbox Signals",
    description: "Due, blocked, approval, mention, and recent collaboration signals.",
    mimeType: "application/json"
  }
];

const handlers = {
  initialize: handleInitialize,
  ping: async () => ({}),
  "tools/list": async () => ({ tools }),
  "tools/call": handleToolCall,
  "resources/list": async () => ({ resources }),
  "resources/read": handleResourceRead,
  "prompts/list": async () => ({ prompts: [] })
};

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

input.on("line", (line) => {
  void handleLine(line);
});

input.on("close", () => {
  process.exit(0);
});

async function handleLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    writeResponse({
      jsonrpc: "2.0",
      id: null,
      error: jsonRpcError(-32700, `Parse error: ${error.message}`)
    });
    return;
  }

  if (Array.isArray(message)) {
    await Promise.all(message.map((item) => handleMessage(item)));
    return;
  }

  await handleMessage(message);
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") {
    writeResponse({ jsonrpc: "2.0", id: null, error: jsonRpcError(-32600, "Invalid request") });
    return;
  }

  if (message.method === "notifications/initialized" || !Object.prototype.hasOwnProperty.call(message, "id")) {
    return;
  }

  const id = message.id;
  const handler = handlers[message.method];
  if (!handler) {
    writeResponse({ jsonrpc: "2.0", id, error: jsonRpcError(-32601, `Unknown method: ${message.method}`) });
    return;
  }

  try {
    const result = await handler(message.params || {});
    writeResponse({ jsonrpc: "2.0", id, result });
  } catch (error) {
    writeResponse({
      jsonrpc: "2.0",
      id,
      error: jsonRpcError(error.code || -32000, error.message || "Agora MCP server error")
    });
  }
}

async function handleInitialize(params = {}) {
  return {
    protocolVersion: negotiatedProtocolVersion(params.protocolVersion),
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false }
    },
    serverInfo: {
      name: "agora-mcp",
      version: SERVER_VERSION
    },
    instructions: [
      "Agora MCP uses the authenticated Agora API as its source of truth.",
      `Set AGORA_API_URL when the API is not ${DEFAULT_API_URL}.`,
      "Set AGORA_API_TOKEN to a normal Agora session or Supabase access token.",
      `Write tools are disabled unless ${WRITE_ENV}=true.`
    ].join(" ")
  };
}

async function handleToolCall(params = {}) {
  const name = cleanString(params.name);
  const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};

  const toolHandlers = {
    get_session: getSession,
    list_projects: listProjects,
    list_tasks: listTasks,
    get_task: getTask,
    get_project_status: getProjectStatus,
    search_workspace: searchWorkspace,
    get_inbox_signals: getInboxSignals,
    create_task: createTask,
    update_task_status: updateTaskStatus,
    add_task_comment: addTaskComment
  };

  const handler = toolHandlers[name];
  if (!handler) {
    return toolError(`Unknown Agora tool: ${name}`);
  }

  try {
    const data = await handler(args);
    return toolResult(data);
  } catch (error) {
    return toolError(error.message || "Agora tool failed");
  }
}

async function handleResourceRead(params = {}) {
  const uri = cleanString(params.uri);
  let payload;

  if (uri === "agora://workspace/summary") payload = await workspaceSummary();
  else if (uri === "agora://projects") payload = await listProjects({ limit: 500 });
  else if (uri === "agora://tasks") payload = await listTasks({ limit: 500 });
  else if (uri === "agora://inbox/signals") payload = await getInboxSignals({ limit: 100 });
  else throw new Error(`Unknown Agora resource: ${uri}`);

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

async function getSession() {
  return apiRequest("GET", "/api/session");
}

async function listProjects(args = {}) {
  return apiRequest("GET", "/api/projects", {
    query: compactQuery({
      query: args.query,
      companyId: args.companyId,
      limit: clampInteger(args.limit, 1, 500, 100),
      offset: clampInteger(args.offset, 0, Number.MAX_SAFE_INTEGER, 0)
    })
  });
}

async function listTasks(args = {}) {
  return apiRequest("GET", "/api/tasks", {
    query: compactQuery({
      query: args.query,
      projectId: args.projectId,
      companyId: args.companyId,
      assignee: args.assignee,
      status: args.status,
      priority: args.priority,
      tag: args.tag,
      limit: clampInteger(args.limit, 1, 500, 100),
      offset: clampInteger(args.offset, 0, Number.MAX_SAFE_INTEGER, 0)
    })
  });
}

async function getTask(args = {}) {
  const taskId = requireString(args.taskId, "taskId");
  const tasks = await fetchAllPages("/api/tasks", "tasks", {}, 3000);
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found or not visible: ${taskId}`);

  const [comments, activities] = await Promise.all([
    apiRequest("GET", "/api/comments", { query: { taskId } }).catch(errorPayload("comments")),
    apiRequest("GET", "/api/activities", { query: { taskId } }).catch(errorPayload("activities"))
  ]);

  return {
    task,
    comments: comments.comments || [],
    activities: activities.activities || []
  };
}

async function getProjectStatus(args = {}) {
  const projectId = requireString(args.projectId, "projectId");
  const [projectsResponse, tasksResponse, approvalsResponse, commentsResponse, activitiesResponse] = await Promise.all([
    apiRequest("GET", "/api/projects", { query: { limit: 500 } }),
    apiRequest("GET", "/api/tasks", { query: { projectId, limit: 500 } }),
    apiRequest("GET", "/api/records/approvals", { query: { projectId, limit: 200 } }).catch(errorPayload("approvals")),
    apiRequest("GET", "/api/records/comments", { query: { projectId, limit: 200 } }).catch(errorPayload("comments")),
    apiRequest("GET", "/api/activities", { query: { projectId } }).catch(errorPayload("activities"))
  ]);

  const project = (projectsResponse.projects || []).find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found or not visible: ${projectId}`);

  const tasks = tasksResponse.tasks || [];
  const now = new Date();
  const counts = tasks.reduce((result, task) => {
    const status = normalizeStatus(task.status);
    result.total += 1;
    result.byStatus[status] = (result.byStatus[status] || 0) + 1;
    if (isDoneStatus(status)) result.done += 1;
    if (isBlockedTask(task)) result.blocked += 1;
    if (task.dueDate && new Date(task.dueDate) < now && !isDoneStatus(status)) result.overdue += 1;
    return result;
  }, { total: 0, done: 0, blocked: 0, overdue: 0, byStatus: {} });

  const approvalRecords = approvalsResponse.records || [];
  const pendingApprovals = approvalRecords.filter((approval) => !isDoneStatus(approval.status) && normalizeStatus(approval.status) !== "approved");

  return {
    project,
    counts,
    dueSoon: upcomingTasks(tasks, 10),
    pendingApprovals: pendingApprovals.slice(0, 10),
    recentComments: latestByDate(commentsResponse.records || commentsResponse.comments || [], 10),
    recentActivity: latestByDate(activitiesResponse.activities || activitiesResponse.records || [], 10)
  };
}

async function searchWorkspace(args = {}) {
  const query = requireString(args.query, "query").toLowerCase();
  const limit = clampInteger(args.limit, 1, 100, 25);
  const [projects, tasks, comments, activities, approvals] = await Promise.all([
    fetchAllPages("/api/projects", "projects", {}, 1000),
    fetchAllPages("/api/tasks", "tasks", {}, 3000),
    fetchAllPages("/api/records/comments", "records", {}, 1000).catch(() => []),
    fetchAllPages("/api/activities", "activities", {}, 1000).catch(() => []),
    fetchAllPages("/api/records/approvals", "records", {}, 1000).catch(() => [])
  ]);

  const matches = [];
  addMatches(matches, "project", projects, query, ["id", "name", "title", "description", "status"]);
  addMatches(matches, "task", tasks, query, ["id", "title", "description", "status", "priority", "assignee"]);
  addMatches(matches, "comment", comments, query, ["id", "body", "text", "authorName", "taskId", "projectId"]);
  addMatches(matches, "activity", activities, query, ["id", "type", "body", "text", "summary", "taskId", "projectId"]);
  addMatches(matches, "approval", approvals, query, ["id", "title", "description", "status", "taskId", "projectId"]);

  return {
    query,
    matches: matches.slice(0, limit),
    truncated: matches.length > limit
  };
}

async function getInboxSignals(args = {}) {
  const limit = clampInteger(args.limit, 1, 100, 50);
  const [tasks, approvals, comments] = await Promise.all([
    fetchAllPages("/api/tasks", "tasks", {}, 3000),
    fetchAllPages("/api/records/approvals", "records", {}, 1000).catch(() => []),
    fetchAllPages("/api/records/comments", "records", {}, 1000).catch(() => [])
  ]);

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const signals = [];

  for (const task of tasks) {
    const status = normalizeStatus(task.status);
    if (isDoneStatus(status)) continue;
    if (isBlockedTask(task)) signals.push(signal("blocked_task", task, task.title, "Task appears blocked."));
    if (task.dueDate) {
      const due = new Date(task.dueDate);
      if (due < now) signals.push(signal("overdue_task", task, task.title, `Due ${task.dueDate}.`));
      else if (due <= soon) signals.push(signal("due_soon_task", task, task.title, `Due ${task.dueDate}.`));
    }
  }

  for (const approval of approvals) {
    const status = normalizeStatus(approval.status);
    if (!isDoneStatus(status) && status !== "approved") {
      signals.push(signal("pending_approval", approval, approval.title || approval.name || approval.id, "Approval is still open."));
    }
  }

  for (const comment of latestByDate(comments, 25)) {
    const text = cleanString(comment.body || comment.text || comment.message);
    if (text.includes("@")) {
      signals.push(signal("mention", comment, comment.taskId || comment.projectId || comment.id, text.slice(0, 240)));
    } else {
      signals.push(signal("recent_comment", comment, comment.taskId || comment.projectId || comment.id, text.slice(0, 240)));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    signals: latestByDate(signals, limit)
  };
}

async function createTask(args = {}) {
  assertWritesAllowed();
  const projectId = requireString(args.projectId, "projectId");
  const title = requireString(args.title, "title");
  const task = {
    id: `task-${crypto.randomUUID()}`,
    projectId,
    title,
    description: cleanString(args.description),
    assignee: cleanString(args.assignee),
    status: cleanString(args.status) || "todo",
    priority: cleanString(args.priority) || "medium",
    dueDate: cleanString(args.dueDate),
    tags: Array.isArray(args.tags) ? args.tags.map(cleanString).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const result = await apiRequest("POST", "/api/tasks", { body: { task } });
  result.mcpAudit = await recordMcpActivity("create_task", {
    projectId,
    taskId: result.task?.id || task.id,
    message: `${config.clientName} created task "${title}" through MCP.`
  });
  return result;
}

async function updateTaskStatus(args = {}) {
  assertWritesAllowed();
  const taskId = requireString(args.taskId, "taskId");
  const status = requireString(args.status, "status");
  const taskResponse = await getTask({ taskId });
  const task = {
    ...taskResponse.task,
    status,
    updatedAt: new Date().toISOString()
  };

  const result = await apiRequest("PUT", `/api/tasks/${encodeURIComponent(taskId)}`, { body: { task } });
  result.mcpAudit = await recordMcpActivity("update_task_status", {
    projectId: result.task?.projectId || task.projectId,
    taskId,
    message: `${config.clientName} changed task "${result.task?.title || task.title || taskId}" to ${status} through MCP.`
  });
  return result;
}

async function addTaskComment(args = {}) {
  assertWritesAllowed();
  const taskId = requireString(args.taskId, "taskId");
  const body = requireString(args.body, "body");
  const taskResponse = cleanString(args.projectId) ? null : await getTask({ taskId }).catch(() => null);
  const projectId = cleanString(args.projectId) || cleanString(taskResponse?.task?.projectId);
  const comment = {
    id: `comment-${crypto.randomUUID()}`,
    taskId,
    projectId,
    body,
    kind: cleanString(args.kind) || "mcp",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const result = await apiRequest("POST", "/api/comments", { body: { comment } });
  result.mcpAudit = await recordMcpActivity("add_task_comment", {
    projectId: result.comment?.projectId || comment.projectId,
    taskId,
    message: `${config.clientName} added a task comment through MCP.`
  });
  return result;
}

async function recordMcpActivity(toolName, details = {}) {
  const projectId = cleanString(details.projectId);
  if (!projectId) {
    return {
      recorded: false,
      reason: "No projectId was available for the MCP activity record."
    };
  }

  try {
    const activity = {
      id: `activity-mcp-${crypto.randomUUID()}`,
      projectId,
      taskId: cleanString(details.taskId),
      type: "mcp_tool",
      message: `${details.message || `${config.clientName} used ${toolName} through MCP.`} Tool: ${toolName}.`,
      createdAt: new Date().toISOString()
    };
    const response = await apiRequest("POST", "/api/activities", { body: { activity } });
    return {
      recorded: true,
      activity: response.activity
    };
  } catch (error) {
    return {
      recorded: false,
      error: error.message
    };
  }
}

async function workspaceSummary() {
  const [session, health, projectsResponse, tasksResponse] = await Promise.all([
    apiRequest("GET", "/api/session"),
    apiRequest("GET", "/api/backend/health").catch(errorPayload("backendHealth")),
    apiRequest("GET", "/api/projects", { query: { limit: 1 } }),
    apiRequest("GET", "/api/tasks", { query: { limit: 1 } })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    apiUrl: config.apiUrl,
    writesEnabled: config.allowWrites,
    session,
    backendHealth: health,
    projectPage: projectsResponse.page || null,
    taskPage: tasksResponse.page || null
  };
}

async function fetchAllPages(pathname, key, baseQuery = {}, maxItems = 1000) {
  const pageSize = Math.min(500, Math.max(1, maxItems));
  const all = [];
  let offset = 0;

  while (all.length < maxItems) {
    const response = await apiRequest("GET", pathname, {
      query: compactQuery({ ...baseQuery, limit: pageSize, offset })
    });
    const items = Array.isArray(response[key]) ? response[key] : [];
    all.push(...items);

    const page = response.page || {};
    const total = Number(page.total);
    if (items.length === 0 || items.length < pageSize || (Number.isFinite(total) && all.length >= total)) break;
    offset += items.length;
  }

  return all.slice(0, maxItems);
}

async function apiRequest(method, pathname, options = {}) {
  requireApiToken();
  const url = new URL(pathname, `${config.apiUrl}/`);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const headers = {
    accept: "application/json",
    authorization: `Bearer ${config.apiToken}`
  };
  const request = { method, headers };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    request.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, request);
  const text = await response.text();
  const payload = text ? parseJson(text) : {};
  if (!response.ok) {
    const message = payload?.error || payload?.message || text || `${method} ${url.pathname} failed`;
    throw new Error(`Agora API ${response.status}: ${message}`);
  }
  return payload;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function requireApiToken() {
  if (!config.apiToken) {
    throw new Error("Set AGORA_API_TOKEN to an Agora session token before using Agora MCP tools.");
  }
}

function assertWritesAllowed() {
  if (!config.allowWrites) {
    throw new Error(`Write tool refused. Set ${WRITE_ENV}=true only for trusted local MCP clients, then retry.`);
  }
}

function toolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data
  };
}

function toolError(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message
      }
    ]
  };
}

function jsonRpcError(code, message) {
  return { code, message };
}

function negotiatedProtocolVersion(requested) {
  return requested === PROTOCOL_VERSION ? requested : PROTOCOL_VERSION;
}

function writeResponse(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function objectSchema(properties, required = []) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function requiredStringProperty(description) {
  return { type: "string", minLength: 1, description };
}

function stringProperty(description) {
  return { type: "string", description };
}

function integerProperty(description, minimum = 0, maximum) {
  const property = { type: "integer", minimum, description };
  if (maximum) property.maximum = maximum;
  return property;
}

function arrayProperty(description, items) {
  return { type: "array", items, description };
}

function requireString(value, name) {
  const cleaned = cleanString(value);
  if (!cleaned) throw new Error(`${name} is required.`);
  return cleaned;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanUrl(value) {
  return cleanString(value).replace(/\/+$/, "") || DEFAULT_API_URL;
}

function envFlag(name, fallback = false) {
  const value = cleanString(process.env[name]).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function compactQuery(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeStatus(value) {
  return cleanString(value).toLowerCase().replace(/\s+/g, "-") || "unknown";
}

function isDoneStatus(status) {
  return ["done", "complete", "completed", "approved", "closed", "archived"].includes(normalizeStatus(status));
}

function isBlockedTask(task) {
  const status = normalizeStatus(task.status);
  const tags = Array.isArray(task.tags) ? task.tags.map(normalizeStatus) : [];
  return status.includes("block") || tags.some((tag) => tag.includes("block"));
}

function upcomingTasks(tasks, limit) {
  const now = new Date();
  return tasks
    .filter((task) => task.dueDate && !isDoneStatus(task.status) && new Date(task.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, limit);
}

function latestByDate(items, limit) {
  return [...items]
    .sort((a, b) => dateValue(b) - dateValue(a))
    .slice(0, limit);
}

function dateValue(item) {
  const value = item.updatedAt || item.createdAt || item.timestamp || item.date || item.dueDate;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function signal(type, source, title, description) {
  return {
    type,
    id: `${type}:${source.id || crypto.randomUUID()}`,
    sourceId: source.id,
    projectId: source.projectId,
    taskId: source.taskId || source.id,
    title: cleanString(title) || source.id || type,
    description: cleanString(description),
    createdAt: source.updatedAt || source.createdAt || source.dueDate || new Date().toISOString()
  };
}

function addMatches(matches, type, records, query, fields) {
  for (const record of records) {
    const haystack = fields.map((field) => stringifyValue(record[field])).join(" ").toLowerCase();
    if (!haystack.includes(query)) continue;
    matches.push({
      type,
      id: record.id,
      projectId: record.projectId,
      taskId: record.taskId || (type === "task" ? record.id : undefined),
      title: record.title || record.name || record.id,
      status: record.status,
      excerpt: excerpt(record, fields, query)
    });
  }
}

function stringifyValue(value) {
  if (Array.isArray(value)) return value.join(" ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === undefined || value === null ? "" : String(value);
}

function excerpt(record, fields, query) {
  const text = fields.map((field) => stringifyValue(record[field])).join(" ");
  const lower = text.toLowerCase();
  const index = lower.indexOf(query);
  if (index < 0) return text.slice(0, 220);
  const start = Math.max(0, index - 80);
  return text.slice(start, start + 220).trim();
}

function errorPayload(label) {
  return (error) => ({
    unavailable: true,
    label,
    error: error.message
  });
}
