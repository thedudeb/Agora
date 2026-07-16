#!/usr/bin/env node

const assert = require("node:assert");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const port = 19000 + Math.floor(Math.random() * 1000);
const child = spawn(process.execPath, [path.join(root, "server", "static.js")], {
  cwd: root,
  env: {
    ...process.env,
    AGORA_APP_HOST: "127.0.0.1",
    AGORA_APP_PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(() => {
  child.kill("SIGTERM");
});

async function run() {
  await waitForServer();
  assert.equal(await status("/index.html"), 200, "index should remain public");
  assert.equal(await status("/src/app.js"), 200, "application source should remain public");
  assert.equal(await status("/.env"), 403, ".env must not be served");
  assert.equal(await status("/.git/config"), 403, "Git metadata must not be served");
  assert.equal(await status("/server/data/workspace.json"), 403, "server data must not be served");
  assert.equal(await status("/%E0%A4%A"), 403, "malformed URL encoding must be rejected without crashing");
  assert.equal(await status("/index.html", "POST"), 405, "static server must reject write methods");
  console.log("Static server security test passed");
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Static server exited early: ${stderr.trim()}`);
    try {
      if (await status("/index.html") === 200) return;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Static server did not start: ${stderr.trim()}`);
}

function status(requestPath, method = "HEAD") {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", port, path: requestPath, method }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
}
