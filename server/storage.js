const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DATA_DIR = path.join(__dirname, "data");

function createStorage(options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.AGORA_DATA_DIR || DEFAULT_DATA_DIR);

  function ensureDataDir() {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  function filePath(name) {
    return path.join(dataDir, name);
  }

  function readJson(name, fallback) {
    try {
      return JSON.parse(fs.readFileSync(filePath(name), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  }

  function writeJson(name, value) {
    ensureDataDir();
    const target = filePath(name);
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(temp, target);
    return value;
  }

  function loadWorkspace() {
    return readJson("workspace.json", null);
  }

  function loadWorkspaceSnapshot() {
    return loadWorkspace()?.snapshot || {};
  }

  function saveWorkspace(snapshot, metadata = {}) {
    const now = new Date().toISOString();
    const existing = loadWorkspace();
    return writeJson("workspace.json", {
      metadata: {
        createdAt: existing?.metadata?.createdAt || now,
        updatedAt: now,
        ...metadata
      },
      snapshot
    });
  }

  function saveWorkspaceSnapshot(snapshot, metadata = {}) {
    return saveWorkspace(snapshot, metadata).snapshot;
  }

  function loadAuditLog() {
    return readJson("audit-log.json", []);
  }

  function appendAuditEvent(event) {
    const nextEvent = {
      id: event.id || `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      ...event
    };
    const nextLog = [nextEvent, ...loadAuditLog()].slice(0, 200);
    writeJson("audit-log.json", nextLog);
    return nextEvent;
  }

  return {
    dataDir,
    loadWorkspace,
    loadWorkspaceSnapshot,
    saveWorkspace,
    saveWorkspaceSnapshot,
    loadAuditLog,
    appendAuditEvent
  };
}

module.exports = {
  createStorage
};
