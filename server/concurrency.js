const WORKSPACE_REVISION = Symbol.for("agora.workspaceRevision");

function createAsyncLock() {
  let tail = Promise.resolve();
  return {
    async acquire() {
      const previous = tail;
      let releaseNext;
      tail = new Promise((resolve) => {
        releaseNext = resolve;
      });
      await previous;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        releaseNext();
      };
    }
  };
}

function stampWorkspaceRevision(snapshot, revision) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  Object.defineProperty(snapshot, WORKSPACE_REVISION, {
    value: normalizeRevision(revision),
    enumerable: true,
    configurable: true
  });
  return snapshot;
}

function snapshotRevision(snapshot) {
  return Number.isInteger(snapshot?.[WORKSPACE_REVISION]) ? snapshot[WORKSPACE_REVISION] : null;
}

function normalizeRevision(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function workspaceConflictError() {
  const error = new Error("Workspace changed since it was loaded");
  error.code = "WORKSPACE_CONFLICT";
  error.statusCode = 409;
  error.publicMessage = "Workspace changed since it was loaded. Reload and retry your change.";
  return error;
}

module.exports = {
  createAsyncLock,
  normalizeRevision,
  snapshotRevision,
  stampWorkspaceRevision,
  workspaceConflictError
};
