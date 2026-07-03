const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createServer } = require("./api");
const { createStorage } = require("./storage");

const ROOT = path.resolve(__dirname, "..");

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agora-mcp-"));
  const storage = createStorage({ dataDir, driver: "json" });
  const server = createServer({
    storage,
    allowDemoAuth: true
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  let readClient;
  let writeClient;
  try {
    const login = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    assert(login.token, "demo login did not return a token");

    const project = await request(`${baseUrl}/api/projects`, {
      method: "POST",
      token: login.token,
      body: {
        project: {
          id: "mcp-project",
          name: "MCP Launch Project",
          status: "active"
        }
      }
    });
    assert(project.project.id === "mcp-project", "project seed failed");

    const task = await request(`${baseUrl}/api/tasks`, {
      method: "POST",
      token: login.token,
      body: {
        task: {
          id: "mcp-task",
          projectId: "mcp-project",
          title: "Wire MCP integration",
          description: "Confirm MCP can read Agora and refuses writes by default.",
          status: "todo",
          priority: "high",
          dueDate: "2026-07-10",
          tags: ["mcp", "blocked"]
        }
      }
    });
    assert(task.task.id === "mcp-task", "task seed failed");

    readClient = await McpClient.start({
      AGORA_API_URL: baseUrl,
      AGORA_API_TOKEN: login.token,
      AGORA_MCP_ALLOW_WRITES: "false"
    });

    const initialized = await readClient.call("initialize", {
      protocolVersion: "2025-06-18"
    });
    assert(initialized.protocolVersion === "2025-06-18", "mcp initialize returned wrong protocol version");

    const tools = await readClient.call("tools/list");
    assert(tools.tools.some((item) => item.name === "list_tasks"), "mcp tools did not include list_tasks");
    assert(tools.tools.some((item) => item.name === "create_task"), "mcp tools did not include create_task");
    assert(tools.tools.some((item) => item.name === "get_workspace_health"), "mcp tools did not include get_workspace_health");

    const health = await readClient.tool("get_workspace_health");
    assert(health.ok === true, "mcp workspace health did not report ok");
    assert(typeof health.storage === "string" && health.storage, "mcp workspace health did not expose storage driver");

    const projects = await readClient.tool("list_projects", { query: "MCP Launch" });
    assert(projects.projects.some((item) => item.id === "mcp-project"), "mcp list_projects missed seeded project");

    const tasks = await readClient.tool("list_tasks", { projectId: "mcp-project" });
    assert(tasks.tasks.some((item) => item.id === "mcp-task"), "mcp list_tasks missed seeded task");

    const taskDetails = await readClient.tool("get_task", { taskId: "mcp-task" });
    assert(taskDetails.task.title === "Wire MCP integration", "mcp get_task returned wrong task");

    const projectStatus = await readClient.tool("get_project_status", { projectId: "mcp-project" });
    assert(projectStatus.counts.total >= 1, "mcp project status did not count tasks");
    assert(projectStatus.counts.blocked >= 1, "mcp project status did not detect blocked work");

    const search = await readClient.tool("search_workspace", { query: "integration" });
    assert(search.matches.some((item) => item.id === "mcp-task"), "mcp search missed seeded task");

    const inbox = await readClient.tool("get_inbox_signals");
    assert(inbox.signals.some((item) => item.type === "blocked_task"), "mcp inbox signals missed blocked task");

    const resources = await readClient.call("resources/list");
    assert(resources.resources.some((item) => item.uri === "agora://workspace/summary"), "mcp resources missing workspace summary");
    assert(resources.resources.some((item) => item.uri === "agora://backend/health"), "mcp resources missing backend health");

    const summary = await readClient.call("resources/read", { uri: "agora://workspace/summary" });
    const summaryPayload = JSON.parse(summary.contents[0].text);
    assert(summaryPayload.writesEnabled === false, "read client unexpectedly enabled writes");

    const healthResource = await readClient.call("resources/read", { uri: "agora://backend/health" });
    const healthPayload = JSON.parse(healthResource.contents[0].text);
    assert(healthPayload.ok === true, "mcp backend health resource did not return API health");

    const prompts = await readClient.call("prompts/list");
    assert(prompts.prompts.some((item) => item.name === "standup_digest"), "mcp prompts missing standup_digest");
    assert(prompts.prompts.some((item) => item.name === "project_risk_review"), "mcp prompts missing project_risk_review");

    const prompt = await readClient.call("prompts/get", {
      name: "project_risk_review",
      arguments: { projectId: "mcp-project" }
    });
    assert(prompt.messages?.[0]?.content?.text.includes("mcp-project"), "mcp project risk prompt missed project id");

    const blockedWrite = await readClient.call("tools/call", {
      name: "create_task",
      arguments: {
        projectId: "mcp-project",
        title: "Should not be created"
      }
    });
    assert(blockedWrite.isError === true, "mcp write should fail when writes are disabled");
    assert(blockedWrite.content[0].text.includes("AGORA_MCP_ALLOW_WRITES"), "blocked write did not explain write gate");

    writeClient = await McpClient.start({
      AGORA_API_URL: baseUrl,
      AGORA_API_TOKEN: login.token,
      AGORA_MCP_ALLOW_WRITES: "true",
      AGORA_MCP_CLIENT_NAME: "MCP integration test"
    });
    await writeClient.call("initialize", { protocolVersion: "2025-06-18" });

    const created = await writeClient.tool("create_task", {
      projectId: "mcp-project",
      title: "Created through MCP",
      status: "todo",
      priority: "medium",
      tags: ["mcp"]
    });
    assert(created.task?.id, "mcp create_task did not return task");
    assert(created.task.title === "Created through MCP", "mcp create_task returned wrong title");
    assert(created.mcpAudit?.recorded === true, "mcp create_task did not record activity");

    const comment = await writeClient.tool("add_task_comment", {
      taskId: created.task.id,
      projectId: "mcp-project",
      body: "MCP integration comment"
    });
    assert(comment.comment?.id, "mcp add_task_comment did not return comment");
    assert(comment.mcpAudit?.recorded === true, "mcp add_task_comment did not record activity");

    const updated = await writeClient.tool("update_task_status", {
      taskId: created.task.id,
      status: "done"
    });
    assert(updated.task?.status === "done", "mcp update_task_status did not update task");
    assert(updated.mcpAudit?.recorded === true, "mcp update_task_status did not record activity");

    const apiTasks = await request(`${baseUrl}/api/tasks?projectId=mcp-project`, {
      token: login.token
    });
    const apiCreatedTask = apiTasks.tasks.find((item) => item.id === created.task.id);
    assert(apiCreatedTask?.status === "done", "API did not persist MCP task status update");

    const apiComments = await request(`${baseUrl}/api/comments?taskId=${encodeURIComponent(created.task.id)}`, {
      token: login.token
    });
    assert(apiComments.comments.some((item) => item.body === "MCP integration comment"), "API did not persist MCP comment");

    const apiActivities = await request(`${baseUrl}/api/activities?projectId=mcp-project`, {
      token: login.token
    });
    const mcpActivities = apiActivities.activities.filter((item) => item.type === "mcp_tool" && item.taskId === created.task.id);
    assert(mcpActivities.length >= 3, "API did not persist MCP activity records");
    assert(mcpActivities.some((item) => item.message.includes("MCP integration test")), "MCP activity did not include client name");

    console.log("MCP integration test passed.");
  } finally {
    if (readClient) readClient.close();
    if (writeClient) writeClient.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

class McpClient {
  constructor(child) {
    this.child = child;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";

    child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("exit", (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`MCP server exited with code ${code}`));
      }
      this.pending.clear();
    });
  }

  static async start(env) {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", "agora-mcp-server.js")], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const client = new McpClient(child);
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    return client;
  }

  call(method, params = {}) {
    const id = this.nextId++;
    const message = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP call timed out: ${method}`));
      }, 5000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      this.child.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  async tool(name, args = {}) {
    const result = await this.call("tools/call", { name, arguments: args });
    assert(result.isError !== true, `mcp tool failed: ${name}: ${result.content?.[0]?.text || "unknown error"}`);
    if (result.structuredContent) return result.structuredContent;
    return JSON.parse(result.content[0].text);
  }

  handleStdout(chunk) {
    this.buffer += String(chunk);
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line) this.handleMessage(line);
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  handleMessage(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid MCP JSON response: ${error.message}`);
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message || "MCP error"));
      return;
    }
    pending.resolve(message.result);
  }

  close() {
    this.child.stdin.end();
    this.child.kill();
  }
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body;
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed: ${response.status} ${payload.error || text}`);
  }
  return payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
