const SCORE_STATUSES = new Set(["pass", "review", "not-tested"]);
const VERDICTS = new Set(["go", "wait", "stop", "not-set"]);

function cleanString(value, limit = 500) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function publicError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  throw error;
}

function normalizeScores(scores) {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return {};
  return Object.fromEntries(Object.entries(scores).slice(0, 20).map(([id, entry]) => [
    cleanString(id, 80),
    {
      status: SCORE_STATUSES.has(cleanString(entry?.status, 20)) ? cleanString(entry.status, 20) : "not-tested",
      note: cleanString(entry?.note, 500)
    }
  ]).filter(([id]) => id));
}

function boundedNumber(value, max = 100000) {
  return Math.min(max, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
}

function normalizeSparkzPilotReview(record = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) publicError("Sparkz pilot review must be an object");
  const projectId = cleanString(record.projectId, 160);
  if (!projectId) publicError("Sparkz pilot review requires projectId");
  const now = new Date().toISOString();
  const verdict = cleanString(record.verdict, 20);
  return {
    id: cleanString(record.id, 180) || `sparkz-pilot-${projectId}`,
    projectId,
    companyId: cleanString(record.companyId, 160),
    title: cleanString(record.title, 180) || "Sparkz pilot review",
    creatorName: cleanString(record.creatorName, 160),
    tokenlessLaunchAt: cleanString(record.tokenlessLaunchAt, 32),
    approvalTurnaroundHours: boundedNumber(record.approvalTurnaroundHours),
    updatePrepMinutes: boundedNumber(record.updatePrepMinutes),
    manualTransferMinutes: boundedNumber(record.manualTransferMinutes),
    boundaryIncidents: Math.round(boundedNumber(record.boundaryIncidents, 1000)),
    scores: normalizeScores(record.scores),
    verdict: VERDICTS.has(verdict) ? verdict : "not-set",
    verdictNote: cleanString(record.verdictNote, 1000),
    reviewerId: cleanString(record.reviewerId, 160),
    reviewedAt: cleanString(record.reviewedAt, 64),
    createdAt: cleanString(record.createdAt, 64) || now,
    updatedAt: now
  };
}

module.exports = { normalizeSparkzPilotReview };
