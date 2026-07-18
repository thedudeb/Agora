const SPARKZ_TEMPLATE_ID = "marketplace-sparkz-creator-launch";
const SPARKZ_AUTOMATION_PACK_ID = "automation-pack-sparkz-launch-control";
const sparkzPilotScoreDefinitions = [
  { id: "creator-fit", label: "Creator fit and rights", detail: "Identity, ownership, quality, rights, and launch responsibility are reviewed.", taskTag: "review" },
  { id: "tokenless-experience", label: "Tokenless experience", detail: "Collectables, backing, boost participation, perks, and launch mechanics work before any token path.", taskTag: "tokenless" },
  { id: "collaborator-approvals", label: "Collaborator approvals", detail: "Participants, split intent, rationale, and approvals are inspectable without Agora executing a transaction.", taskTag: "splits" },
  { id: "public-language", label: "Public language and legal review", detail: "Messaging is feature-led and qualified legal review is recorded. This gate is not legal advice.", taskTag: "legal-review" },
  { id: "momentum-evidence", label: "Momentum evidence", detail: "Creator and community signals, risks, and qualitative outcomes support the final review.", taskTag: "momentum" },
  { id: "execution-boundary", label: "Execution boundary discipline", detail: "Agora did not custody keys, deploy tokens, execute splits, calculate returns, or become the canonical ledger.", taskTag: "decision" }
];

function sparkzPilotScoreStatus(value) {
  return ["pass", "review", "not-tested"].includes(value) ? value : "not-tested";
}

function sparkzPilotVerdict(value) {
  return ["go", "wait", "stop", "not-set"].includes(value) ? value : "not-set";
}

function normalizeSparkzPilotReview(record = {}, project = null) {
  const projectId = String(record.projectId || project?.id || "");
  const scores = Object.fromEntries(sparkzPilotScoreDefinitions.map((definition) => [definition.id, {
    status: sparkzPilotScoreStatus(record.scores?.[definition.id]?.status),
    note: String(record.scores?.[definition.id]?.note || "").slice(0, 500)
  }]));
  return {
    id: String(record.id || `sparkz-pilot-${projectId}`),
    projectId,
    companyId: String(record.companyId || project?.companyId || ""),
    title: "Sparkz pilot review",
    creatorName: String(record.creatorName || "").slice(0, 160),
    tokenlessLaunchAt: String(record.tokenlessLaunchAt || "").slice(0, 32),
    approvalTurnaroundHours: Math.max(0, Number(record.approvalTurnaroundHours) || 0),
    updatePrepMinutes: Math.max(0, Number(record.updatePrepMinutes) || 0),
    manualTransferMinutes: Math.max(0, Number(record.manualTransferMinutes) || 0),
    boundaryIncidents: Math.max(0, Math.round(Number(record.boundaryIncidents) || 0)),
    scores,
    verdict: sparkzPilotVerdict(record.verdict),
    verdictNote: String(record.verdictNote || "").slice(0, 1000),
    reviewerId: String(record.reviewerId || ""),
    reviewedAt: String(record.reviewedAt || ""),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString()
  };
}

function isSparkzPilotProject(project) {
  if (!project) return false;
  return getProjectTasks(project.id, false).some((task) => (task.tags || []).includes("sparkz"))
    || String(project.description || "").toLowerCase().includes("tokenless-first creator launch");
}

function sparkzPilotProject() {
  return activeProjects().find(isSparkzPilotProject) || null;
}

function sparkzPilotReviewForProject(project) {
  const record = (state.sparkzPilotReviews || []).find((item) => item.projectId === project.id);
  return normalizeSparkzPilotReview(record, project);
}

function upsertSparkzPilotReview(review) {
  const normalized = normalizeSparkzPilotReview(review, byId(state.projects, review.projectId));
  state.sparkzPilotReviews = [
    normalized,
    ...(state.sparkzPilotReviews || []).filter((item) => item.id !== normalized.id && item.projectId !== normalized.projectId)
  ];
  return normalized;
}

function sparkzPilotTaskByTag(projectId, tag) {
  return getProjectTasks(projectId, false).find((task) => (task.tags || []).includes(tag));
}

function sparkzPilotSignals(project) {
  const tasks = getProjectTasks(project.id, false).filter((task) => (task.tags || []).includes("sparkz"));
  const openTasks = tasks.filter((task) => task.status !== "done");
  const blockedTasks = openTasks.filter(isTaskBlocked);
  const overdueTasks = openTasks.filter(isOverdue);
  const documents = state.documents.filter((document) => document.projectId === project.id);
  const captures = normalizeUpdateCaptures(state.updateCaptures).filter((capture) => capture.projectId === project.id);
  const approvals = state.approvals.filter((approval) => approval.projectId === project.id);
  const pendingApprovals = approvals.filter((approval) => approval.status !== "approved");
  const launchTask = sparkzPilotTaskByTag(project.id, "launch");
  const decisionTask = sparkzPilotTaskByTag(project.id, "decision");
  const completed = tasks.filter((task) => task.status === "done").length;
  return {
    tasks,
    openTasks,
    blockedTasks,
    overdueTasks,
    documents,
    captures,
    approvals,
    pendingApprovals,
    launchTask,
    decisionTask,
    completion: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    evidenceCount: documents.length + captures.length,
    daysRunning: Math.max(0, daysBetween(project.startDate || todayKey(), todayKey()))
  };
}

function sparkzPilotStatus(review, signals) {
  if (review.verdict !== "not-set" && review.reviewedAt) return { label: "Decision recorded", tone: "green" };
  if (signals.launchTask?.status === "done" || review.tokenlessLaunchAt) return { label: "Live pilot", tone: "blue" };
  return { label: "Pre-launch", tone: "amber" };
}

function sparkzPilotScoreCounts(review) {
  return Object.values(review.scores).reduce((counts, entry) => {
    counts[entry.status] += 1;
    return counts;
  }, { pass: 0, review: 0, "not-tested": 0 });
}

function sparkzPilotSuggestedReview(review, signals) {
  const counts = sparkzPilotScoreCounts(review);
  if (review.boundaryIncidents > 0) return "Boundary incident needs resolution before any graduation decision.";
  if (signals.blockedTasks.length || signals.overdueTasks.length) return "Recover blocked or overdue launch work before the final review.";
  if (counts["not-tested"] || counts.review) return "Complete every scorecard gate and resolve review notes.";
  if (signals.decisionTask?.status !== "done") return "Evidence is review-ready; record the human graduation decision.";
  return "Pilot evidence and the graduation task are complete. Confirm the recorded verdict and external handoff.";
}

function sparkzPilotReviewFromForm(project) {
  const current = sparkzPilotReviewForProject(project);
  const value = (selector) => document.querySelector(selector)?.value || "";
  const number = (selector) => Math.max(0, Number(value(selector)) || 0);
  const scores = Object.fromEntries(sparkzPilotScoreDefinitions.map((definition) => [definition.id, {
    status: sparkzPilotScoreStatus(current.scores[definition.id]?.status),
    note: value(`[data-sparkz-pilot-note="${definition.id}"]`).trim().slice(0, 500)
  }]));
  return normalizeSparkzPilotReview({
    ...current,
    creatorName: value("#sparkz-pilot-creator").trim(),
    tokenlessLaunchAt: value("#sparkz-pilot-launch-date"),
    approvalTurnaroundHours: number("#sparkz-pilot-approval-hours"),
    updatePrepMinutes: number("#sparkz-pilot-update-minutes"),
    manualTransferMinutes: number("#sparkz-pilot-transfer-minutes"),
    boundaryIncidents: number("#sparkz-pilot-boundary-incidents"),
    scores,
    verdict: value("#sparkz-pilot-verdict"),
    verdictNote: value("#sparkz-pilot-verdict-note").trim(),
    reviewerId: activeMemberId(),
    reviewedAt: value("#sparkz-pilot-verdict") === "not-set" ? "" : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, project);
}

function updateSparkzPilotScore(projectId, scoreId, status) {
  if (!canWrite("projects:write")) {
    showToast("Your role cannot update the pilot review", "info");
    return;
  }
  const project = byId(state.projects, projectId);
  if (!project || !sparkzPilotScoreDefinitions.some((item) => item.id === scoreId)) return;
  const review = sparkzPilotReviewFromForm(project);
  review.scores[scoreId].status = sparkzPilotScoreStatus(status);
  upsertSparkzPilotReview(review);
  saveState();
  render();
}

function saveSparkzPilotReview(projectId) {
  if (!canWrite("projects:write")) {
    showToast("Your role cannot update the pilot review", "info");
    return;
  }
  const project = byId(state.projects, projectId);
  if (!project) return;
  const review = upsertSparkzPilotReview(sparkzPilotReviewFromForm(project));
  addAuditEvent({
    action: "sparkz_pilot_review_update",
    detail: `Updated Sparkz pilot review for ${project.name}`,
    targetType: "sparkzPilotReview",
    targetId: review.id,
    metadata: { projectId, verdict: review.verdict, boundaryIncidents: review.boundaryIncidents }
  });
  saveState();
  render();
  showToast("Sparkz pilot review saved", "success");
  syncRecordToApi("sparkzPilotReviews", review, "Sparkz pilot review synced to API", false);
}

function sparkzPilotPacket(project) {
  const review = sparkzPilotReviewForProject(project);
  const signals = sparkzPilotSignals(project);
  const taskRows = signals.tasks.map((task) => `| ${task.title.replaceAll("|", "\\|")} | ${statusLabel(task.status)} | ${memberName(task.assignee)} | ${task.dueDate || "Not set"} |`);
  return [
    `# ${project.name} - Sparkz Pilot Evidence`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Creator: ${review.creatorName || "Not recorded"}`,
    `Pilot owner: ${memberName(project.owner)}`,
    `Tokenless launch: ${review.tokenlessLaunchAt || (signals.launchTask?.status === "done" ? "Task marked complete" : "Not launched")}`,
    `Verdict: ${review.verdict === "not-set" ? "Not recorded" : review.verdict.toUpperCase()}`,
    `Verdict note: ${review.verdictNote || "No decision note"}`,
    "",
    "## Operational Signals",
    "",
    `- Workflow completion: ${signals.completion}%`,
    `- Blocked / overdue: ${signals.blockedTasks.length} / ${signals.overdueTasks.length}`,
    `- Evidence records: ${signals.evidenceCount}`,
    `- Pending approvals: ${signals.pendingApprovals.length}`,
    `- Approval turnaround: ${review.approvalTurnaroundHours || 0} hours`,
    `- Update preparation: ${review.updatePrepMinutes || 0} minutes`,
    `- Manual external transfer: ${review.manualTransferMinutes || 0} minutes`,
    `- Execution-boundary incidents: ${review.boundaryIncidents}`,
    "",
    "## Review Gates",
    "",
    ...sparkzPilotScoreDefinitions.map((definition) => `- **${definition.label}:** ${review.scores[definition.id].status}. ${review.scores[definition.id].note || "No reviewer note."}`),
    "",
    "## Work Evidence",
    "",
    "| Work | Status | Owner | Due |",
    "| --- | --- | --- | --- |",
    ...taskRows,
    "",
    "## Product Boundary",
    "",
    "Agora coordinates work, evidence, approvals, risks, and decisions. It does not custody keys, deploy tokens, execute splits, calculate returns, or act as the canonical ledger. External systems remain responsible for financial and on-chain execution.",
    ""
  ].join("\n");
}

function exportSparkzPilot(projectId, format) {
  const project = byId(state.projects, projectId);
  if (!project) return;
  const filename = `${slugFromName(project.name)}-sparkz-pilot`;
  if (format === "json") {
    downloadJsonFile(`${filename}.json`, JSON.stringify({
      type: "agora.sparkz-pilot-evidence",
      version: 1,
      exportedAt: new Date().toISOString(),
      project,
      review: sparkzPilotReviewForProject(project),
      signals: sparkzPilotSignals(project)
    }, null, 2));
    showToast("Sparkz pilot JSON downloaded", "success");
    return;
  }
  const markdown = sparkzPilotPacket(project);
  if (format === "copy") {
    copyCommandText(markdown, "Sparkz pilot packet copied").catch(() => showToast("Could not copy pilot packet", "info"));
    return;
  }
  downloadTextFile(`${filename}.md`, markdown, "text/markdown");
  showToast("Sparkz pilot packet downloaded", "success");
}

async function startOrOpenSparkzPilot() {
  const existing = sparkzPilotProject();
  if (existing) {
    state.selectedProject = existing.id;
    state.selectedRoute = "project";
    state.selectedProjectTab = "pilot";
    state.filters.company = existing.companyId;
    openSidebarGroupForRoute("project");
    saveState();
    render();
    showToast("Opened the active Sparkz pilot", "success");
    return;
  }
  if (!canWrite("projects:write")) {
    showToast("Your role cannot start a pilot project", "info");
    return;
  }
  let template = byId(state.projectTemplates, SPARKZ_TEMPLATE_ID);
  if (!template) {
    const marketplaceTemplate = marketplaceProjectTemplates.find((item) => item.id === SPARKZ_TEMPLATE_ID);
    template = marketplaceTemplate ? validateProjectTemplate(marketplaceTemplate, { preserveId: true }) : null;
    if (template) state.projectTemplates = [template, ...state.projectTemplates];
  }
  const company = visibleCompanies()[0] || state.companies[0];
  const created = template ? createProjectFromTemplate(template.id, {
    companyId: company?.id,
    name: "Sparkz Creator Pilot",
    startDate: todayKey()
  }) : null;
  if (!created) {
    showToast("Sparkz pilot could not be created", "info");
    return;
  }
  const review = upsertSparkzPilotReview({ projectId: created.project.id, companyId: created.project.companyId });
  if (!state.automations.some((rule) => rule.marketplacePackId === SPARKZ_AUTOMATION_PACK_ID)) {
    installAutomationMarketplacePack(SPARKZ_AUTOMATION_PACK_ID);
  }
  addAuditEvent({
    action: "sparkz_pilot_start",
    detail: `Started Sparkz creator pilot ${created.project.name}`,
    targetType: "project",
    targetId: created.project.id,
    metadata: { templateId: SPARKZ_TEMPLATE_ID }
  });
  state.selectedProject = created.project.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "pilot";
  state.filters.company = created.project.companyId;
  saveState();
  render();
  showToast("Sparkz pilot workspace is ready", "success");
  await syncProjectToApi(created.project, "Sparkz pilot project synced to API", true);
  for (const task of created.tasks) {
    await syncTaskToApi(task, "Sparkz pilot task synced to API", true);
  }
  await syncRecordToApi("sparkzPilotReviews", review, "Sparkz pilot review synced to API", false);
}

function renderSparkzPilotScorecard(project, review, canEdit) {
  const counts = sparkzPilotScoreCounts(review);
  return `
    <section class="panel sparkz-pilot-scorecard">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Human review gates</p>
          <h2>Pilot scorecard</h2>
        </div>
        <div class="scorecard-summary">
          <span class="status-pill inbox-green">${counts.pass} pass</span>
          <span class="status-pill inbox-amber">${counts.review} review</span>
          <span class="status-pill inbox-neutral">${counts["not-tested"]} untested</span>
        </div>
      </div>
      <div class="sparkz-pilot-score-list">
        ${sparkzPilotScoreDefinitions.map((definition) => {
          const entry = review.scores[definition.id];
          const task = sparkzPilotTaskByTag(project.id, definition.taskTag);
          return `
            <article>
              <div>
                <span class="status-pill ${entry.status === "pass" ? "inbox-green" : entry.status === "review" ? "inbox-amber" : "inbox-neutral"}">${escapeHtml(entry.status)}</span>
                <strong>${escapeHtml(definition.label)}</strong>
                <p>${escapeHtml(definition.detail)}</p>
                <small>${task ? `${escapeHtml(task.title)} / ${escapeHtml(statusLabel(task.status))}` : "No linked workflow task"}</small>
              </div>
              <div class="scorecard-controls" role="group" aria-label="${escapeHtml(definition.label)} score">
                ${["pass", "review", "not-tested"].map((status) => `<button class="button ${entry.status === status ? "button-primary" : "button-secondary"} compact-button" type="button" aria-pressed="${entry.status === status}" data-sparkz-pilot-score="${definition.id}" data-sparkz-pilot-status="${status}" data-sparkz-pilot-project="${escapeHtml(project.id)}" ${canEdit ? "" : "disabled"}>${status === "not-tested" ? "Untested" : status === "pass" ? "Pass" : "Review"}</button>`).join("")}
              </div>
              <label>
                <span>Reviewer note</span>
                <input data-sparkz-pilot-note="${definition.id}" value="${escapeHtml(entry.note)}" maxlength="500" placeholder="Evidence, concern, or next action" ${canEdit ? "" : "disabled"}>
              </label>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderSparkzPilotTab(project) {
  const review = sparkzPilotReviewForProject(project);
  const signals = sparkzPilotSignals(project);
  const status = sparkzPilotStatus(review, signals);
  const canEdit = canWrite("projects:write");
  const editDisabled = canEdit ? "" : "disabled";
  return `
    <div class="sparkz-pilot-shell">
      <section class="sparkz-pilot-header">
        <div>
          <p class="eyebrow">Creator launch pilot</p>
          <h2>Sparkz pilot cockpit</h2>
          <p>Run the tokenless launch, measure the operating burden, inspect evidence, and record a human go, wait, or stop decision.</p>
        </div>
        <div class="sparkz-pilot-header-actions">
          <span class="status-pill inbox-${status.tone}">${status.label}</span>
          <button class="button button-secondary compact-button" type="button" data-sparkz-pilot-export="markdown" data-sparkz-pilot-project="${escapeHtml(project.id)}">Export Packet</button>
          <button class="button button-secondary compact-button" type="button" data-sparkz-pilot-export="json" data-sparkz-pilot-project="${escapeHtml(project.id)}">Export JSON</button>
        </div>
      </section>

      <div class="sparkz-pilot-metrics">
        ${metric("Workflow", `${signals.completion}%`)}
        ${metric("Days running", signals.daysRunning)}
        ${metric("Evidence", signals.evidenceCount)}
        ${metric("Blocked / overdue", `${signals.blockedTasks.length} / ${signals.overdueTasks.length}`)}
        ${metric("Pending approvals", signals.pendingApprovals.length)}
        ${metric("Boundary incidents", review.boundaryIncidents)}
      </div>

      <section class="panel sparkz-pilot-measurement">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Pilot measurement</p>
            <h2>Record what automation cannot infer</h2>
          </div>
          <span class="status-pill ${review.boundaryIncidents ? "inbox-red" : "inbox-green"}">${review.boundaryIncidents ? "Boundary review" : "Boundary clear"}</span>
        </div>
        <p class="panel-note">These values measure whether Agora and the ICM bridge remove operational work. Do not enter wallet keys, private financial data, or transaction instructions.</p>
        <div class="sparkz-pilot-form">
          <label><span>Creator or project</span><input id="sparkz-pilot-creator" value="${escapeHtml(review.creatorName)}" placeholder="Creator name or public project name" ${editDisabled}></label>
          <label><span>Tokenless launch date</span><input id="sparkz-pilot-launch-date" type="date" value="${escapeHtml(review.tokenlessLaunchAt)}" ${editDisabled}></label>
          <label><span>Approval turnaround (hours)</span><input id="sparkz-pilot-approval-hours" type="number" min="0" step="0.5" value="${review.approvalTurnaroundHours}" ${editDisabled}></label>
          <label><span>Update preparation (minutes)</span><input id="sparkz-pilot-update-minutes" type="number" min="0" step="1" value="${review.updatePrepMinutes}" ${editDisabled}></label>
          <label><span>Manual external transfer (minutes)</span><input id="sparkz-pilot-transfer-minutes" type="number" min="0" step="1" value="${review.manualTransferMinutes}" ${editDisabled}></label>
          <label><span>Execution-boundary incidents</span><input id="sparkz-pilot-boundary-incidents" type="number" min="0" step="1" value="${review.boundaryIncidents}" ${editDisabled}></label>
        </div>
      </section>

      ${renderSparkzPilotScorecard(project, review, canEdit)}

      <section class="panel sparkz-pilot-decision">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Human decision</p>
            <h2>Go, wait, or stop</h2>
          </div>
          <span class="status-pill ${review.verdict === "go" ? "inbox-green" : review.verdict === "stop" ? "inbox-red" : "inbox-amber"}">${review.verdict === "not-set" ? "Not decided" : review.verdict.toUpperCase()}</span>
        </div>
        <p class="panel-note">${escapeHtml(sparkzPilotSuggestedReview(review, signals))}</p>
        <div class="sparkz-pilot-decision-form">
          <label><span>Decision</span><select id="sparkz-pilot-verdict" ${editDisabled}><option value="not-set" ${review.verdict === "not-set" ? "selected" : ""}>Not decided</option><option value="go" ${review.verdict === "go" ? "selected" : ""}>Go</option><option value="wait" ${review.verdict === "wait" ? "selected" : ""}>Wait</option><option value="stop" ${review.verdict === "stop" ? "selected" : ""}>Stop</option></select></label>
          <label class="wide-field"><span>Decision rationale</span><textarea id="sparkz-pilot-verdict-note" rows="4" maxlength="1000" placeholder="Evidence, unresolved risks, conditions, and external handoff" ${editDisabled}>${escapeHtml(review.verdictNote)}</textarea></label>
          <button class="button button-primary" type="button" data-sparkz-pilot-save="${escapeHtml(project.id)}" ${editDisabled}>Save Pilot Review</button>
          <button class="button button-secondary" type="button" data-sparkz-pilot-export="copy" data-sparkz-pilot-project="${escapeHtml(project.id)}">Copy Evidence Packet</button>
        </div>
        <div class="sparkz-pilot-boundary">
          <strong>Agora stops at coordination and evidence.</strong>
          <span>Token deployment, custody, splits, balances, votes, and financial execution remain in reviewed external systems.</span>
        </div>
      </section>
    </div>
  `;
}
