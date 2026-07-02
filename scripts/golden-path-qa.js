#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const START_PORT = Number(process.env.AGORA_GOLDEN_PORT || 5300 + Math.floor(Math.random() * 1000));
const HOST = process.env.AGORA_GOLDEN_HOST || "127.0.0.1";
const BASE_URL = process.env.AGORA_GOLDEN_BASE_URL || "";
const CHROME_TIMEOUT_MS = Number(process.env.AGORA_GOLDEN_TIMEOUT_MS || 60000);
const ROUTE_WAIT_MS = Number(process.env.AGORA_GOLDEN_WAIT_MS || 5000);
const ARTIFACT_DIR = process.env.AGORA_GOLDEN_ARTIFACT_DIR || "";

const staticChecks = [
  {
    name: "App shell",
    path: "/",
    status: 200,
    contentType: "text/html",
    required: ["Agora", "app-view", "src/app.js"]
  },
  {
    name: "PWA manifest",
    path: "/manifest.webmanifest",
    status: 200,
    contentType: "application/manifest+json",
    required: ["Agora Project Management", "standalone", "agora-mobile-today.png"]
  },
  {
    name: "Offline fallback page",
    path: "/offline.html",
    status: 200,
    contentType: "text/html",
    required: ["Agora is offline", "Your local workspace remains on this device"]
  },
  {
    name: "Missing route uses offline fallback",
    path: "/missing-test-route",
    status: 404,
    contentType: "text/html",
    required: ["Agora is offline"]
  }
];

const routeChecks = [
  {
    name: "Dashboard onboarding golden paths",
    suite: "first-run",
    route: "dashboard",
    width: 1265,
    height: 712,
    required: [
      "First client workspace",
      "Launch a real client workspace",
      "Create the client onboarding project",
      "Install the agency handoff workflow",
      "Export the recovery bundle",
      "Workspace setup"
    ]
  },
  {
    name: "Guided launch flow",
    suite: "first-run",
    route: "launch",
    width: 1265,
    height: 712,
    required: [
      "Launch the first client workspace",
      "Launch progress",
      "Create the client workspace",
      "Install the handoff workflow",
      "Prove recovery",
      "Invite the first teammate"
    ]
  },
  {
    name: "PM command center",
    suite: "workspace",
    route: "command-center",
    width: 1265,
    height: 712,
    required: [
      "PM command center",
      "What needs attention now?",
      "Attention queue",
      "Highest-risk items",
      "Next best actions",
      "Client promises",
      "Team load",
      "Decision follow-up",
      "Open decisions",
      "Client visibility warnings",
      "Visibility warnings",
      "Decisions and RAID",
      "Feedback loop"
    ]
  },
  {
    name: "Power-user Kanban board",
    suite: "workspace",
    route: "board",
    width: 1265,
    height: 712,
    required: [
      "Kanban controls",
      "Board system",
      "Board automation builder",
      "Card templates",
      "Checklist recipes",
      "Backlog / Triage",
      "Flow analytics",
      "Workflow",
      "Advanced Swimlanes",
      "Swimlanes",
      "Manual order",
      "Density",
      "WIP",
      "Saved board views",
      "Board health",
      "Descriptions",
      "Signals",
      "Add a card",
      "To do",
      "Doing",
      "Review",
      "Done"
    ]
  },
  {
    name: "Project Gantt timeline",
    suite: "workspace",
    route: "project",
    query: { project: "launch", tab: "timeline" },
    width: 1265,
    height: 712,
    required: [
      "Timeline",
      "Gantt",
      "Schedule and dependencies",
      "Week",
      "Month",
      "Quarter",
      "Critical path",
      "Slipped path",
      "Workload warnings",
      "Export Markdown",
      "Export JSON",
      "Add Milestone"
    ]
  },
  {
    name: "Project command center",
    suite: "workspace",
    route: "project",
    query: { project: "launch", tab: "overview" },
    width: 1265,
    height: 712,
    required: [
      "Project command center",
      "Project health",
      "Action queue",
      "What to do next",
      "Timeline slip",
      "Client visibility",
      "Decision load"
    ]
  },
  {
    name: "Sprint command center",
    suite: "workspace",
    route: "sprint",
    width: 1265,
    height: 712,
    required: [
      "Sprint Command Center",
      "Beta sprint",
      "Sprint timeline",
      "Stories across Beta sprint",
      "peak",
      "Sprint planning",
      "Velocity target",
      "Recommended removals",
      "Burndown",
      "Standup queue",
      "Readiness checks",
      "Scope and carryover",
      "Retro",
      "Definition of Done"
    ]
  },
  {
    name: "Decision log",
    suite: "workspace",
    route: "decisions",
    width: 1265,
    height: 712,
    required: [
      "Decision log",
      "Durable project decisions",
      "Decision Log 1.0",
      "Open decisions",
      "Client-visible",
      "Decision register"
    ]
  },
  {
    name: "Client visibility review",
    suite: "workspace",
    route: "visibility",
    width: 1265,
    height: 712,
    required: [
      "Client visibility review",
      "Preview what clients can see",
      "Preview as Client",
      "Share packet composer",
      "Ready to send checklist",
      "Client portal link",
      "Generate Link",
      "Email Draft",
      "Visible packet",
      "Visibility warnings",
      "Visibility audit trail",
      "Exposure changes",
      "Client-visible",
      "Shared",
      "Internal"
    ]
  },
  {
    name: "Collaboration decision promotion",
    suite: "workspace",
    route: "collaboration",
    width: 1265,
    height: 712,
    required: [
      "Collaboration",
      "Workspace channels",
      "Whiteboard",
      "Log Decision",
      "Log"
    ]
  },
  {
    name: "Production readiness audit",
    suite: "release",
    route: "readiness",
    width: 1265,
    height: 712,
    required: [
      "Production readiness audit",
      "First client workspace",
      "Hosted launch gates",
      "API and sync health",
      "Portable restore path",
      "Access and audit controls",
      "Power-user checks"
    ]
  },
  {
    name: "Beta launch handoff",
    suite: "release",
    route: "beta",
    width: 1265,
    height: 712,
    required: [
      "Beta launch",
      "Can we send Agora to an outside team?",
      "Beta packet",
      "Beta workspace",
      "Start Beta Workspace",
      "Beta walkthrough",
      "First 10 minutes for a tester",
      "Beta exit proof",
      "Leave with my data",
      "Hosted onboarding",
      "Email diagnostics",
      "Copy Feedback Link",
      "Download Bundle"
    ]
  },
  {
    name: "Start beta workspace click path",
    suite: "release",
    route: "beta",
    query: { goldenAction: "startBetaWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "Agency Client Delivery Beta",
      "Client Onboarding Launch",
      "Northstar Labs",
      "Beta walkthrough",
      "Open client project",
      "Review portal status",
      "Triage a feature request",
      "Prove exit and recovery",
      "Leave with my data",
      "Download workspace JSON",
      "Tasks CSV",
      "Time CSV",
      "3 seeded beta requests",
      "Agency Client Delivery Beta is loaded with client work"
    ]
  },
  {
    name: "Template to project path",
    suite: "workspace",
    route: "templates",
    width: 1265,
    height: 712,
    required: [
      "Project template library",
      "Recommended first template",
      "Client Onboarding",
      "Create Client Project",
      "Template marketplace",
      "Create Customized Project",
      "Import shared template JSON"
    ]
  },
  {
    name: "Marketplace automation path",
    suite: "workspace",
    route: "marketplace",
    width: 1265,
    height: 712,
    required: [
      "Template marketplace",
      "Recommended first automation pack",
      "Agency Client Handoff",
      "Install Recommended Pack",
      "Install workflow packs",
      "Validation",
      "Creator",
      "License",
      "No template preview yet",
      "No automation pack preview yet"
    ]
  },
  {
    name: "Portable recovery path",
    suite: "data",
    route: "data",
    width: 1265,
    height: 712,
    required: [
      "Recovery confidence",
      "Know you can leave and restore",
      "CLI inspect",
      "Portable workspace OS",
      "Download Bundle",
      "Create Backup",
      "Import bundle",
      "Preview Bundle",
      "Desktop and mobile readiness",
      "Workspace schema",
      "offline-storage-contract.json"
    ]
  },
  {
    name: "Settings production controls",
    suite: "admin",
    route: "settings",
    width: 1265,
    height: 712,
    required: [
      "Settings",
      "Hosted onboarding",
      "First real team path",
      "Open Members",
      "Open Sync",
      "Account",
      "Workspace",
      "Auto",
      "Members",
      "Sync",
      "Trust"
    ]
  },
  {
    name: "Settings sync and offline readiness",
    suite: "offline",
    route: "settings",
    query: { settingsTab: "sync" },
    width: 1265,
    height: 712,
    required: [
      "Backend health",
      "Offline apps",
      "Desktop and mobile readiness",
      "Local workspace",
      "Retry queue",
      "Portable restore"
    ]
  },
  {
    name: "Settings security posture",
    suite: "security",
    route: "settings",
    query: { settingsTab: "security" },
    width: 1265,
    height: 712,
    required: [
      "Current access",
      "Active sessions",
      "Offline security posture",
      "Local-first means the device matters",
      "Download Redacted Bundle",
      "Permission matrix"
    ]
  },
  {
    name: "Settings feedback intake",
    suite: "feedback",
    route: "settings",
    query: { settingsTab: "feedback" },
    width: 1265,
    height: 712,
    required: [
      "Email diagnostics",
      "Invites, resets, and requester updates",
      "Feature request intake",
      "Public submit link",
      "Open Feature Requests",
      "Submit Internal Request"
    ]
  },
  {
    name: "Project backlog pipeline",
    suite: "workspace",
    route: "project-backlog",
    width: 1265,
    height: 712,
    required: [
      "Capture future work",
      "Backlog projects",
      "Project intake",
      "Pipeline",
      "Approved",
      "Promote"
    ]
  },
  {
    name: "Mobile dashboard golden paths",
    suite: "mobile",
    route: "dashboard",
    width: 500,
    height: 844,
    required: [
      "First client workspace",
      "Launch a real client workspace",
      "Start With Client Onboarding",
      "Review Agency Handoff Pack",
      "Open Recovery Plan"
    ]
  },
  {
    name: "Feature request triage",
    suite: "feedback",
    route: "feature-requests",
    width: 1265,
    height: 712,
    required: [
      "Feedback triage",
      "Beta feedback command center",
      "Needs response",
      "Feature Requests",
      "Request queue",
      "Copy Public Link"
    ]
  },
  {
    name: "Public feedback form",
    suite: "feedback",
    route: "feedback",
    width: 390,
    height: 760,
    required: [
      "Product feedback",
      "Feature title",
      "Your email",
      "Send Feature Request"
    ]
  }
];

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const chromePath = findChrome();
  const server = BASE_URL
    ? { baseUrl: trimTrailingSlash(BASE_URL), stop: async () => {} }
    : await startStaticServer();

  try {
    for (const check of staticChecks) {
      let response = null;
      try {
        response = await requestUrlWithBody(`${server.baseUrl}${check.path}`);
        assertStaticSurface(check, response);
        console.log(`Passed ${check.name}`);
      } catch (error) {
        writeStaticFailureArtifact(check, response, error);
        throw error;
      }
    }

    for (const check of routeChecks) {
      const url = buildRouteUrl(server.baseUrl, check);
      let dom = "";
      try {
        dom = await runChrome(chromePath, [
          "--headless=new",
          "--disable-gpu",
          "--force-device-scale-factor=1",
          "--high-dpi-support=1",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-extensions",
          "--disable-background-networking",
          "--run-all-compositor-stages-before-draw",
          `--window-size=${check.width},${check.height}`,
          `--virtual-time-budget=${ROUTE_WAIT_MS}`,
          "--dump-dom",
          url
        ]);
        assertGoldenPath(check, dom);
        console.log(`Passed ${check.name} [${check.suite}]`);
      } catch (error) {
        await writeRouteFailureArtifacts(chromePath, check, url, dom, error);
        throw error;
      }
    }
  } finally {
    await server.stop();
  }

  console.log("");
  console.log(`Golden path QA passed: ${staticChecks.length} static checks, ${routeChecks.length} route checks`);
}

function buildRouteUrl(baseUrl, check) {
  const params = new URLSearchParams({
    route: check.route,
    golden: String(Date.now())
  });
  Object.entries(check.query || {}).forEach(([key, value]) => {
    params.set(key, value);
  });
  return `${baseUrl}/?${params.toString()}`;
}

function assertStaticSurface(check, response) {
  if (response.statusCode !== check.status) {
    throw new Error(`${check.name} returned HTTP ${response.statusCode}, expected ${check.status}`);
  }
  const contentType = response.headers["content-type"] || "";
  if (!contentType.includes(check.contentType)) {
    throw new Error(`${check.name} returned content-type ${contentType || "(missing)"}, expected ${check.contentType}`);
  }
  assertSecurityHeaders(check.name, response.headers);
  const body = String(response.body || "");
  check.required.forEach((phrase) => {
    if (!body.includes(phrase)) {
      throw new Error(`${check.name} is missing expected text: ${phrase}`);
    }
  });
}

function assertSecurityHeaders(name, headers) {
  const csp = headers["content-security-policy"] || "";
  const requiredCsp = ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"];
  requiredCsp.forEach((directive) => {
    if (!csp.includes(directive)) throw new Error(`${name} is missing CSP directive: ${directive}`);
  });
  const expected = {
    "x-content-type-options": "nosniff",
    "cross-origin-opener-policy": "same-origin",
    "referrer-policy": "strict-origin-when-cross-origin"
  };
  Object.entries(expected).forEach(([header, value]) => {
    if ((headers[header] || "").toLowerCase() !== value) {
      throw new Error(`${name} has invalid ${header}: ${headers[header] || "(missing)"}`);
    }
  });
}

function assertGoldenPath(check, dom) {
  const text = String(dom || "");
  const normalized = text.toLowerCase();
  if (!normalized.includes("data-agora-boot=\"ready\"")) {
    throw new Error(`${check.name} did not finish booting`);
  }
  if (normalized.includes("could not render") || normalized.includes("view error")) {
    throw new Error(`${check.name} rendered an error state: ${errorSnippet(text)}`);
  }
  if (normalized.includes("typeerror") || normalized.includes("referenceerror")) {
    throw new Error(`${check.name} rendered a JavaScript error string: ${errorSnippet(text)}`);
  }
  check.required.forEach((phrase) => {
    if (!normalized.includes(phrase.toLowerCase())) {
      throw new Error(`${check.name} is missing expected text: ${phrase}`);
    }
  });
}

function errorSnippet(dom) {
  const text = String(dom || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const markerIndex = text.toLowerCase().indexOf("could not render");
  const start = markerIndex === -1 ? 0 : Math.max(0, markerIndex - 80);
  return text.slice(start, start + 240);
}

function writeStaticFailureArtifact(check, response, error) {
  if (!ARTIFACT_DIR) return;
  const baseName = safeArtifactName(check.name);
  const headers = response?.headers ? JSON.stringify(response.headers, null, 2) : "{}";
  const body = response?.body || "";
  writeArtifact(`${baseName}.txt`, [
    `Check: ${check.name}`,
    `Path: ${check.path}`,
    `Error: ${error.message || error}`,
    "",
    "Headers:",
    headers,
    "",
    "Body:",
    body
  ].join("\n"));
}

async function writeRouteFailureArtifacts(chromePath, check, url, dom, error) {
  if (!ARTIFACT_DIR) return;
  const baseName = safeArtifactName(check.name);
  writeArtifact(`${baseName}.html`, dom || `<!-- No DOM captured: ${escapeComment(error.message || error)} -->`);
  writeArtifact(`${baseName}.txt`, [
    `Check: ${check.name}`,
    `Suite: ${check.suite || ""}`,
    `URL: ${url}`,
    `Viewport: ${check.width}x${check.height}`,
    `Error: ${error.message || error}`
  ].join("\n"));

  if (!dom) return;
  const screenshotPath = path.join(artifactDirectory(), `${baseName}.png`);
  try {
    await runChrome(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--force-device-scale-factor=1",
      "--high-dpi-support=1",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${check.width},${check.height}`,
      `--virtual-time-budget=${ROUTE_WAIT_MS}`,
      `--screenshot=${screenshotPath}`,
      url
    ]);
  } catch (screenshotError) {
    writeArtifact(`${baseName}-screenshot-error.txt`, screenshotError.message || String(screenshotError));
  }
}

function artifactDirectory() {
  const directory = path.resolve(ROOT, ARTIFACT_DIR);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function writeArtifact(fileName, content) {
  fs.writeFileSync(path.join(artifactDirectory(), fileName), content);
}

function safeArtifactName(value) {
  return String(value || "golden-path")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "golden-path";
}

function escapeComment(value) {
  return String(value).replace(/--/g, "- -");
}

async function startStaticServer() {
  const port = await findOpenPort(START_PORT);
  const child = spawn(process.execPath, [path.join(ROOT, "server", "static.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      AGORA_APP_HOST: HOST,
      AGORA_APP_PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  const baseUrl = `http://${HOST}:${port}`;
  await waitForServer(baseUrl, child, () => logs);
  return {
    baseUrl,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1500);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  };
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);

  const found = candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

  if (!found) {
    throw new Error("Chrome or Chromium was not found. Set CHROME_BIN to a local Chrome-compatible binary.");
  }

  return found;
}

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    const tryPort = () => {
      const probe = net.createServer();
      probe.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          port += 1;
          tryPort();
          return;
        }
        reject(error);
      });
      probe.once("listening", () => {
        probe.close(() => resolve(port));
      });
      probe.listen(port, HOST);
    };
    tryPort();
  });
}

function waitForServer(baseUrl, child, logsForError) {
  const deadline = Date.now() + 10000;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (child.exitCode !== null) {
        reject(new Error(`Golden path QA server exited early:\n${logsForError()}`));
        return;
      }
      requestUrlWithBody(baseUrl).then(resolve).catch((error) => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${baseUrl}: ${error.message}\n${logsForError()}`));
          return;
        }
        setTimeout(check, 150);
      });
    };
    check();
  });
}

function requestUrlWithBody(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body
          });
        }
        else reject(new Error(`HTTP ${response.statusCode}`));
      });
    });
    request.on("error", reject);
    request.setTimeout(2000, () => {
      request.destroy(new Error("request timed out"));
    });
  });
}

function runChrome(chromePath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(chromePath, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Chrome timed out after ${CHROME_TIMEOUT_MS}ms`));
    }, CHROME_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`Chrome exited with code ${code}\n${stderr.trim()}`));
    });
  });
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
