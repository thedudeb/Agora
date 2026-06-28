const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(filePath = path.resolve(__dirname, "..", ".env")) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator === -1) return;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) return;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  });
}

module.exports = { loadEnvFile };
