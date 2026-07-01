const { app, BrowserWindow, Menu, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const isMac = process.platform === "darwin";
let staticServer = null;
let staticOrigin = "";

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

function desktopSecurityHeaders() {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https://raw.githubusercontent.com",
      "connect-src 'self' http://127.0.0.1:* http://localhost:* https://*.supabase.co https:",
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
  const decodedPath = decodeURIComponent(urlPath);
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(root, `.${normalizedPath}`);
  const relativePath = path.relative(root, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath) ? filePath : "";
}

function startStaticServer() {
  const root = appRoot();
  staticServer = http.createServer((request, response) => {
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
        "Cache-Control": "no-store"
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

app.whenReady().then(createWindow).catch((error) => {
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
