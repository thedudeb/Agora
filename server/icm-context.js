const crypto = require("node:crypto");

const ICM_CONTEXT_LIMIT_BYTES = 12 * 1024;
const ICM_CONTEXT_TIMEOUT_MS = 10000;

function publicError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  throw error;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function icmObjectHash(value) {
  const raw = cleanString(value);
  const directMatch = raw.match(/^icm_[A-Za-z0-9_-]{4,96}$/);
  if (directMatch) return directMatch[0];

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    publicError(400, "Enter an ICM hash or public ICM llm.txt URL");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || !["useicm.com", "www.useicm.com"].includes(hostname) || parsed.username || parsed.password || parsed.port) {
    publicError(400, "ICM context must use the public HTTPS useicm.com endpoint");
  }
  const pathMatch = parsed.pathname.match(/^\/api\/objects\/(icm_[A-Za-z0-9_-]{4,96})\/llm\.txt\/?$/);
  if (!pathMatch || parsed.search || parsed.hash) {
    publicError(400, "ICM context URL must point to /api/objects/<hash>/llm.txt");
  }
  return pathMatch[1];
}

async function readBoundedText(response) {
  if (!response.body?.getReader) return String(await response.text());
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    totalBytes += chunk.length;
    if (totalBytes > ICM_CONTEXT_LIMIT_BYTES) {
      await reader.cancel().catch(() => {});
      publicError(413, "ICM context exceeds the 12 KB preview limit");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

async function previewIcmContext(body = {}, remoteFetch = fetch) {
  const hash = icmObjectHash(body.hash || body.url);
  const sourceUrl = `https://useicm.com/api/objects/${encodeURIComponent(hash)}/llm.txt`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ICM_CONTEXT_TIMEOUT_MS);
  try {
    const response = await remoteFetch(sourceUrl, {
      method: "GET",
      headers: { Accept: "text/plain, text/markdown;q=0.9" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response?.ok) {
      const notFound = response?.status === 404;
      publicError(notFound ? 404 : 502, notFound ? "ICM context was not found" : "ICM context provider returned an error");
    }
    const contentType = cleanString(response.headers?.get?.("content-type")).toLowerCase();
    if (contentType && !contentType.startsWith("text/plain") && !contentType.startsWith("text/markdown")) {
      publicError(502, "ICM context provider returned an unsupported content type");
    }
    const declaredLength = Number(response.headers?.get?.("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > ICM_CONTEXT_LIMIT_BYTES) {
      publicError(413, "ICM context exceeds the 12 KB preview limit");
    }
    const content = (await readBoundedText(response)).replace(/\r\n?/g, "\n").trim();
    const contentBytes = Buffer.byteLength(content);
    if (!content) publicError(422, "ICM context is empty");
    if (contentBytes > ICM_CONTEXT_LIMIT_BYTES) publicError(413, "ICM context exceeds the 12 KB preview limit");
    if (content.includes("\0")) publicError(422, "ICM context contains unsupported content");
    const title = content.split("\n").map((line) => line.replace(/^#+\s*/, "").trim()).find(Boolean)?.slice(0, 160) || `ICM context ${hash}`;
    return {
      type: "agora.icm-context-preview",
      version: 1,
      provider: "icm",
      hash,
      title,
      sourceUrl,
      retrievedAt: new Date().toISOString(),
      contentHash: crypto.createHash("sha256").update(content).digest("hex"),
      contentLength: contentBytes,
      content,
      readOnly: true,
      untrusted: true
    };
  } catch (error) {
    if (error?.statusCode) throw error;
    if (error?.name === "AbortError") publicError(504, "ICM context request timed out");
    publicError(502, "Could not read public ICM context");
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { icmObjectHash, previewIcmContext, readBoundedText };
