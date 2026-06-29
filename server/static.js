const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { loadEnvFile } = require("./env");

loadEnvFile();

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.AGORA_APP_PORT || 5174);
const HOST = process.env.AGORA_APP_HOST || "127.0.0.1";

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
  const decodedPath = decodeURIComponent(urlPath);
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(ROOT, `.${normalizedPath}`);
  const relativePath = path.relative(ROOT, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath) ? filePath : "";
}

function securityHeaders() {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https://raw.githubusercontent.com",
      "connect-src 'self' http://127.0.0.1:* http://localhost:* https://*.supabase.co",
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
