const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DATA_DIR = path.join(__dirname, "data");
const DEFAULT_WORKSPACE_ID = "workspace-acme";

function createStorage(options = {}) {
  const driver = options.driver || process.env.AGORA_STORAGE_DRIVER || "json";
  if (driver === "supabase") return createSupabaseStorage(options);
  return createJsonStorage(options);
}

function createJsonStorage(options = {}) {
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

  async function loadWorkspace() {
    return readJson("workspace.json", null);
  }

  async function loadWorkspaceSnapshot() {
    return (await loadWorkspace())?.snapshot || {};
  }

  async function saveWorkspace(snapshot, metadata = {}) {
    const now = new Date().toISOString();
    const existing = await loadWorkspace();
    return writeJson("workspace.json", {
      metadata: {
        createdAt: existing?.metadata?.createdAt || now,
        updatedAt: now,
        ...metadata
      },
      snapshot
    });
  }

  async function saveWorkspaceSnapshot(snapshot, metadata = {}) {
    return (await saveWorkspace(snapshot, metadata)).snapshot;
  }

  async function loadAuditLog() {
    return readJson("audit-log.json", []);
  }

  async function appendAuditEvent(event) {
    const nextEvent = normalizeAuditEvent(event);
    const nextLog = [nextEvent, ...(await loadAuditLog())].slice(0, 200);
    writeJson("audit-log.json", nextLog);
    return nextEvent;
  }

  return {
    dataDir,
    driver: "json-file",
    loadWorkspace,
    loadWorkspaceSnapshot,
    saveWorkspace,
    saveWorkspaceSnapshot,
    loadAuditLog,
    appendAuditEvent
  };
}

function createSupabaseStorage(options = {}) {
  const supabaseUrl = trimTrailingSlash(options.supabaseUrl || process.env.SUPABASE_URL || process.env.AGORA_SUPABASE_URL || "");
  const serviceKey = options.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AGORA_SUPABASE_SERVICE_ROLE_KEY || "";
  const workspaceId = options.workspaceId || process.env.AGORA_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  async function request(table, query = "", requestOptions = {}) {
    if (typeof fetch !== "function") {
      throw new Error("Supabase storage requires a Node.js runtime with fetch support");
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
      method: requestOptions.method || "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(requestOptions.headers || {})
      },
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = body?.message || body?.error || `Supabase request failed with ${response.status}`;
      throw new Error(message);
    }
    return body;
  }

  async function loadWorkspace() {
    const rows = await request(
      "agora_workspace_snapshots",
      `?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,snapshot,metadata,created_at,updated_at&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return {
      metadata: {
        createdAt: row.created_at || row.metadata?.createdAt || null,
        updatedAt: row.updated_at || row.metadata?.updatedAt || null,
        storage: "supabase",
        ...(row.metadata || {})
      },
      snapshot: row.snapshot
    };
  }

  async function loadWorkspaceSnapshot() {
    return (await loadWorkspace())?.snapshot || {};
  }

  async function saveWorkspace(snapshot, metadata = {}) {
    const now = new Date().toISOString();
    const existing = await loadWorkspace();
    const nextMetadata = {
      createdAt: existing?.metadata?.createdAt || now,
      updatedAt: now,
      storage: "supabase",
      ...metadata
    };
    const rows = await request("agora_workspace_snapshots", "", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: {
        workspace_id: workspaceId,
        snapshot,
        metadata: nextMetadata,
        updated_at: now
      }
    });

    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      metadata: row?.metadata || nextMetadata,
      snapshot: row?.snapshot || snapshot
    };
  }

  async function saveWorkspaceSnapshot(snapshot, metadata = {}) {
    return (await saveWorkspace(snapshot, metadata)).snapshot;
  }

  async function loadAuditLog() {
    const rows = await request(
      "agora_audit_events",
      `?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*&order=created_at.desc&limit=200`
    );
    return Array.isArray(rows) ? rows.map(fromSupabaseAuditEvent) : [];
  }

  async function appendAuditEvent(event) {
    const nextEvent = normalizeAuditEvent({
      workspaceId,
      ...event
    });
    const rows = await request("agora_audit_events", "", {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: toSupabaseAuditEvent(nextEvent)
    });
    return fromSupabaseAuditEvent(Array.isArray(rows) ? rows[0] : nextEvent);
  }

  return {
    driver: "supabase",
    workspaceId,
    loadWorkspace,
    loadWorkspaceSnapshot,
    saveWorkspace,
    saveWorkspaceSnapshot,
    loadAuditLog,
    appendAuditEvent
  };
}

function normalizeAuditEvent(event) {
  return {
    id: event.id || `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: event.createdAt || new Date().toISOString(),
    actorId: event.actorId || "",
    action: event.action || "unknown",
    workspaceId: event.workspaceId || DEFAULT_WORKSPACE_ID,
    detail: event.detail || "",
    metadata: event.metadata || {}
  };
}

function toSupabaseAuditEvent(event) {
  return {
    id: event.id,
    workspace_id: event.workspaceId,
    actor_id: event.actorId || null,
    action: event.action,
    detail: event.detail,
    metadata: event.metadata || {},
    created_at: event.createdAt
  };
}

function fromSupabaseAuditEvent(row = {}) {
  return {
    id: row.id,
    createdAt: row.created_at || row.createdAt,
    actorId: row.actor_id || row.actorId || "",
    action: row.action,
    workspaceId: row.workspace_id || row.workspaceId,
    detail: row.detail || "",
    metadata: row.metadata || {}
  };
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

module.exports = {
  createStorage,
  createJsonStorage,
  createSupabaseStorage
};
