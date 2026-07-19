const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "assets", "screenshots");
const START_PORT = Number(process.env.AGORA_SCREENSHOT_PORT || 5199);
const HOST = process.env.AGORA_SCREENSHOT_HOST || "127.0.0.1";
const BASE_URL = process.env.AGORA_SCREENSHOT_BASE_URL || "";
const CHROME_TIMEOUT_MS = Number(process.env.AGORA_SCREENSHOT_TIMEOUT_MS || 30000);
const ROUTE_WAIT_MS = Number(process.env.AGORA_SCREENSHOT_WAIT_MS || 5000);

const captures = [
  { route: "landing", file: "agora-landing.png", width: 1265, height: 712, expectedText: ["Agora"] },
  { route: "command-center", query: { demoAction: "sampleAgencyWorkspace" }, file: "agora-acme-command-center.png", width: 1265, height: 712, expectedText: ["PM command center", "Client promises"] },
  { route: "project-backlog", file: "agora-acme-project-backlog.png", width: 1265, height: 712, expectedText: ["Backlog projects", "Project intake"] },
  { route: "visibility", file: "agora-acme-client-visibility.png", width: 1265, height: 712, expectedText: ["Client visibility review", "Visibility warnings"] },
  { route: "project", query: { project: "launch", tab: "timeline" }, file: "agora-acme-timeline-risk.png", width: 1265, height: 712, expectedText: ["Timeline", "Gantt"] },
  { route: "reports", file: "agora-acme-client-update.png", width: 1265, height: 712, expectedText: ["Status report", "Delivery risk"] },
  { route: "data", query: { demoAction: "recoveryPlan" }, file: "agora-acme-recovery-proof.png", width: 1265, height: 712, expectedText: ["Recovery confidence", "Portable workspace OS"] },
  { route: "permissions", file: "permissions-audit-desktop.png", width: 1265, height: 712, expectedText: ["Role and Operator audit", "Operator guardrails"] },
  { route: "operator", file: "operator-trust-desktop.png", width: 1265, height: 712, expectedText: ["Operator workspace", "Trust and context"] },
  { route: "marketplace", query: { golden: "screenshot", goldenAction: "startSparkzPilot", presentation: "sparkz-pilot" }, file: "agora-sparkz-pilot.png", width: 1265, height: 1000, expectedText: ["Sparkz pilot cockpit", "Pilot scorecard"] },
  { route: "marketplace", query: { golden: "screenshot-mobile", goldenAction: "startSparkzPilot", presentation: "sparkz-pilot" }, file: "agora-mobile-sparkz-pilot.png", width: 500, height: 844, expectedText: ["Sparkz pilot cockpit", "Pilot scorecard"] },
  { route: "daily", file: "agora-mobile-today.png", width: 500, height: 844, expectedText: ["Today"] }
];

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const chromePath = findChrome();
  const server = BASE_URL
    ? { baseUrl: trimTrailingSlash(BASE_URL), stop: async () => {} }
    : await startStaticServer();

  const written = [];

  try {
    for (const capture of captures) {
      const url = buildCaptureUrl(server.baseUrl, capture);
      const dom = await runChrome(chromePath, [
        "--headless=new",
        "--disable-gpu",
        "--force-device-scale-factor=1",
        "--high-dpi-support=1",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-smooth-scrolling",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        `--window-size=${capture.width},${capture.height}`,
        `--virtual-time-budget=${ROUTE_WAIT_MS}`,
        "--dump-dom",
        url
      ]);
      assertRouteRendered(capture, dom);

      const outputPath = path.join(OUT_DIR, capture.file);
      await runChrome(chromePath, [
        "--headless=new",
        "--disable-gpu",
        "--force-device-scale-factor=1",
        "--high-dpi-support=1",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-smooth-scrolling",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        `--window-size=${capture.width},${capture.height}`,
        `--virtual-time-budget=${ROUTE_WAIT_MS}`,
        `--screenshot=${outputPath}`,
        url
      ]);

      const size = fs.statSync(outputPath).size;
      if (size < 1000) {
        throw new Error(`Screenshot ${capture.file} looks empty (${size} bytes)`);
      }
      written.push(outputPath);
      console.log(`Captured ${capture.file} from ${capture.route} (${capture.width}x${capture.height})`);
    }
  } finally {
    await server.stop();
  }

  console.log("");
  console.log("Updated screenshots:");
  written.forEach((file) => console.log(`- ${path.relative(ROOT, file)}`));
}

function assertRouteRendered(capture, dom) {
  const normalized = String(dom || "").toLowerCase();
  if (!normalized.includes("data-agora-boot=\"ready\"")) {
    throw new Error(`Route ${capture.route} did not finish booting`);
  }
  if (normalized.includes("could not render") || normalized.includes("view error")) {
    throw new Error(`Route ${capture.route} rendered an error state`);
  }
  const missing = (capture.expectedText || [routeTitle(capture.route)]).filter((text) => !normalized.includes(String(text).toLowerCase()));
  if (missing.length) {
    throw new Error(`Route ${capture.route} did not render expected screenshot text: ${missing.join(", ")}`);
  }
}

function buildCaptureUrl(baseUrl, capture) {
  const url = new URL(baseUrl);
  url.searchParams.set("route", capture.route);
  Object.entries(capture.query || {}).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set("screenshot", String(Date.now()));
  return url.toString();
}

function routeTitle(route) {
  const titles = {
    data: "Data",
    daily: "Today",
    landing: "Agora",
    launch: "Launch Flow",
    readiness: "Readiness"
  };
  return titles[route] || route.charAt(0).toUpperCase() + route.slice(1);
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
        reject(new Error(`Screenshot server exited early:\n${logsForError()}`));
        return;
      }
      requestUrl(baseUrl).then(resolve).catch((error) => {
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

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) resolve();
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
