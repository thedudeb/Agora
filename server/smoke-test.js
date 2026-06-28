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

    const workspace = await request(`${baseUrl}/api/workspace`, {
      token: login.token
    });
    assert(workspace.snapshot.workspace.name === "Smoke Test Studio", "workspace load failed");

    const audit = await request(`${baseUrl}/api/audit-log`, {
      token: login.token
    });
    assert(audit.events.length === 1, "audit log was not written");

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
