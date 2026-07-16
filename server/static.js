const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { loadEnvFile } = require("./env");

loadEnvFile();

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.AGORA_APP_PORT || 5174);
const HOST = process.env.AGORA_APP_HOST || "127.0.0.1";
const PUBLIC_ROOT_FILES = new Set([
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/sw.js"
]);
const PUBLIC_PATH_PREFIXES = ["/assets/", "/src/", "/release/evidence/"];

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

function safeFilePath(urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return "";
  }
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const publicPath = PUBLIC_ROOT_FILES.has(normalizedPath)
    || PUBLIC_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
  if (!publicPath || normalizedPath.split("/").some((segment) => segment.startsWith("."))) return "";
  const filePath = path.resolve(ROOT, `.${normalizedPath}`);
  const relativePath = path.relative(ROOT, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath) ? filePath : "";
}

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
  return envFlag("AGORA_STRICT_CSP", false) || String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function securityHeaders() {
  const production = isProductionCsp();
  const connectSrc = production
    ? ["'self'", "https://*.supabase.co", ...cspList(process.env.AGORA_CSP_CONNECT_SRC || process.env.AGORA_ALLOWED_ORIGINS)]
    : ["'self'", "http://127.0.0.1:*", "http://localhost:*", "https://*.supabase.co", "https:"];
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self'${production ? "" : " https://unpkg.com"}`,
      `style-src 'self' 'unsafe-inline'${production ? "" : " https://unpkg.com"}`,
      `img-src 'self' data:${production ? "" : " https://raw.githubusercontent.com"}`,
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

const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method || "GET")) {
    response.writeHead(405, { ...securityHeaders(), Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method Not Allowed");
    return;
  }
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const filePath = safeFilePath(url.pathname);
  if (!filePath) {
    response.writeHead(403, { ...securityHeaders(), "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, body) => {
    if (error) {
      response.writeHead(404, { ...securityHeaders(), "Content-Type": "text/html; charset=utf-8" });
      response.end(fs.readFileSync(path.join(ROOT, "offline.html")));
      return;
    }

    response.writeHead(200, {
      ...securityHeaders(),
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try AGORA_APP_PORT=${PORT + 1} npm run dev`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Agora app listening at http://${HOST}:${PORT}`);
});
