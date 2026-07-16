const { app, BrowserWindow, Menu, ipcMain, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const isMac = process.platform === "darwin";
let staticServer = null;
let staticOrigin = "";
const secureSessionFile = "agora-api-session.bin";
const publicRootFiles = new Set([
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/sw.js"
]);
const publicPathPrefixes = ["/assets/", "/src/"];

function appRoot() {
  if (process.env.AGORA_DESKTOP_ROOT) return path.resolve(process.env.AGORA_DESKTOP_ROOT);
  if (app.isPackaged) return path.join(process.resourcesPath, "app-root");
  return path.resolve(__dirname, "..", "..");
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function envFlag(name, fallback = false) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function cspList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function isProductionCsp() {
  return envFlag("AGORA_STRICT_CSP", app.isPackaged) || String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function desktopSecurityHeaders() {
  const production = isProductionCsp();
  const connectSrc = production
    ? ["'self'", "https://*.supabase.co", ...cspList(process.env.AGORA_CSP_CONNECT_SRC || process.env.AGORA_ALLOWED_ORIGINS)]
    : ["'self'", "http://127.0.0.1:*", "http://localhost:*", "https://*.supabase.co", "https:"];
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      `connect-src ${Array.from(new Set(connectSrc)).join(" ")}`,
      "font-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff"
  };
}

function safeDesktopFile(root, urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return "";
  }
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const publicPath = publicRootFiles.has(normalizedPath)
    || publicPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
  if (!publicPath || normalizedPath.split("/").some((segment) => segment.startsWith("."))) return "";
  const filePath = path.resolve(root, `.${normalizedPath}`);
  const relativePath = path.relative(root, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath) ? filePath : "";
}

function startStaticServer() {
  const root = appRoot();
  staticServer = http.createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method || "GET")) {
      response.writeHead(405, { ...desktopSecurityHeaders(), Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method Not Allowed");
      return;
    }
    const url = new URL(request.url, "http://127.0.0.1");
    const filePath = safeDesktopFile(root, url.pathname);
    if (!filePath) {
      response.writeHead(403, { ...desktopSecurityHeaders(), "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, body) => {
      if (error) {
        response.writeHead(404, { ...desktopSecurityHeaders(), "Content-Type": "text/html; charset=utf-8" });
        response.end(fs.readFileSync(path.join(root, "offline.html")));
        return;
      }

      response.writeHead(200, {
        ...desktopSecurityHeaders(),
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Agora-Offline-Capable": "true"
      });
      response.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    staticServer.once("error", reject);
    staticServer.listen(0, "127.0.0.1", () => {
      const { port } = staticServer.address();
      staticOrigin = `http://127.0.0.1:${port}`;
      resolve(staticOrigin);
    });
  });
}

function secureSessionPath() {
  return path.join(app.getPath("userData"), secureSessionFile);
}

function secureSessionAvailable() {
  return Boolean(safeStorage?.isEncryptionAvailable?.());
}

function assertTrustedIpcEvent(event) {
  const frameUrl = event.senderFrame?.url || "";
  try {
    if (new URL(frameUrl).origin === staticOrigin) return;
  } catch {
    // Fall through to the denial below.
  }
  throw new Error("Agora secure storage is only available to the desktop app origin");
}

function readSecureSession() {
  if (!secureSessionAvailable()) return { ok: false, available: false, value: "" };
  const filePath = secureSessionPath();
  if (!fs.existsSync(filePath)) return { ok: true, available: true, value: "" };
  const encrypted = fs.readFileSync(filePath);
  return {
    ok: true,
    available: true,
    value: safeStorage.decryptString(encrypted)
  };
}

function writeSecureSession(value) {
  if (!secureSessionAvailable()) return { ok: false, available: false };
  const text = String(value || "");
  if (Buffer.byteLength(text, "utf8") > 64 * 1024) {
    throw new Error("Agora session payload is too large for secure storage");
  }
  const encrypted = safeStorage.encryptString(text);
  fs.mkdirSync(path.dirname(secureSessionPath()), { recursive: true });
  fs.writeFileSync(secureSessionPath(), encrypted, { mode: 0o600 });
  return { ok: true, available: true };
}

function clearSecureSession() {
  const filePath = secureSessionPath();
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return { ok: true, available: secureSessionAvailable() };
}

function registerSecureSessionIpc() {
  ipcMain.handle("agora-secure-session:available", (event) => {
    assertTrustedIpcEvent(event);
    return { ok: true, available: secureSessionAvailable() };
  });
  ipcMain.handle("agora-secure-session:load", (event) => {
    assertTrustedIpcEvent(event);
    return readSecureSession();
  });
  ipcMain.handle("agora-secure-session:save", (event, value) => {
    assertTrustedIpcEvent(event);
    return writeSecureSession(value);
  });
  ipcMain.handle("agora-secure-session:clear", (event) => {
    assertTrustedIpcEvent(event);
    return clearSecureSession();
  });
}

function appMenu(window) {
  return Menu.buildFromTemplate([
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => window.loadURL(`${staticOrigin}/#dashboard`)
        },
        {
          label: "Open Today",
          accelerator: "CmdOrCtrl+2",
          click: () => window.loadURL(`${staticOrigin}/#daily`)
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Agora on GitHub",
          click: () => shell.openExternal("https://github.com/thedudeb/Agora")
        }
      ]
    }
  ]);
}

function isInternalDesktopUrl(url) {
  try {
    return new URL(url).origin === staticOrigin;
  } catch {
    return false;
  }
}

async function createWindow() {
  const origin = await startStaticServer();
  const window = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1080,
    minHeight: 720,
    title: "Agora",
    backgroundColor: "#f6f5f0",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternalDesktopUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!isInternalDesktopUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  Menu.setApplicationMenu(appMenu(window));
  window.once("ready-to-show", () => window.show());
  await window.loadURL(origin);
}

app.whenReady().then(() => {
  registerSecureSessionIpc();
  return createWindow();
}).catch((error) => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  staticServer?.close();
});
