/* Agora Data and Recovery route rendering. Loaded after app.js so shared workspace helpers stay global. */
function portableWorkspaceManifest() {
  const snapshot = portableExportSnapshot();
  const ai = aiSettings();
  const contract = snapshot.offlineStorageContract || offlineStorageContract();
  const companies = Array.isArray(state.companies) ? state.companies : [];
  const projects = Array.isArray(state.projects) ? state.projects : [];
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const automations = Array.isArray(state.automations) ? state.automations : [];
  const projectTemplates = Array.isArray(state.projectTemplates) ? state.projectTemplates : [];
  const documents = Array.isArray(state.documents) ? state.documents : [];
  const files = Array.isArray(state.files) ? state.files : [];
  const timeEntries = Array.isArray(state.timeEntries) ? state.timeEntries : [];
  const memoryIngestionContract = projectMemoryIngestionContract();
  return {
    type: "agora.portable-workspace",
    exportVersion: WORKSPACE_EXPORT_VERSION,
    schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
    exportedAt: snapshot.exportedAt,
    workspace: {
      id: state.workspace.id,
      name: state.workspace.name,
      slug: state.workspace.slug,
      visibility: state.workspace.visibility,
      storageMode: state.workspace.storageMode,
      backendTarget: state.workspace.backendTarget
    },
    counts: {
      companies: companies.length,
      projects: projects.length,
      tasks: tasks.length,
      members: workspaceMembers().length,
      automations: automations.length,
      templates: projectTemplates.length,
      documents: documents.length,
      files: files.length,
      autopilotLearningLog: normalizeAutopilotLearningLog(state.autopilotLearningLog).length,
      updateCaptures: normalizeUpdateCaptures(state.updateCaptures).length,
      updateExtractionPreviews: normalizeUpdateExtractionPreviews(state.updateExtractionPreviews).length,
      timeEntries: timeEntries.length,
      operatorActions: recentOperatorActions(50).length,
      operatorReviewQueue: operatorReviewQueueItems().length
    },
    portability: {
      canRunOffline: true,
      includesJsonSnapshot: true,
      includesCsvExports: true,
      includesAutomationPacks: true,
      includesOperatorLedger: true,
      includesProjectMemoryIngestionContract: true,
      includesOfflineStorageContract: true,
      restorePath: "Data > Import JSON can restore workspace.json into Agora."
    },
    projectMemoryIngestion: {
      type: memoryIngestionContract.type,
      version: memoryIngestionContract.version,
      supportedSources: memoryIngestionContract.supportedSources,
      connectorChannels: memoryIngestionContract.connectorChannels.map((channel) => channel.id),
      reviewFlow: memoryIngestionContract.reviewFlow
    },
    offlineStorageContract: {
      type: contract.type,
      version: contract.version,
      targets: contract.targets,
      localStores: contract.localStores.length,
      collections: contract.collections.length,
      syncQueueKey: contract.syncQueue.key
    },
    ai: {
      provider: ai.provider,
      model: ai.model,
      dataPolicy: ai.dataPolicy,
      auditMode: ai.auditMode,
      keySource: ai.keySource
    }
  };
}

function portableWorkspaceReadme() {
  const manifest = portableWorkspaceManifest();
  return [
    `# ${manifest.workspace.name} Portable Workspace`,
    "",
    `Exported: ${formatTimestamp(manifest.exportedAt)}`,
    `Schema: v${manifest.schemaVersion}`,
    "",
    "## What Is Included",
    "",
    `- ${manifest.counts.projects} projects and ${manifest.counts.tasks} tasks`,
    `- ${manifest.counts.automations} automation rules`,
    `- ${manifest.counts.templates} project templates`,
    `- ${manifest.counts.documents} docs and ${manifest.counts.files} files metadata records`,
    `- ${manifest.counts.operatorActions} AI operator action ledger entries`,
    `- Offline storage contract v${manifest.offlineStorageContract.version} for ${manifest.offlineStorageContract.targets.join(", ")}`,
    "",
    "## Restore",
    "",
    "Open Agora, go to Data, paste `workspace.json` into Import JSON, and choose whether to replace the current workspace or import it as a new workspace.",
    "",
    "## Open Source Portability Promise",
    "",
    "The bundle is plain JSON, CSV, and Markdown so a team can inspect it, archive it, transform it, or move it into another self-hosted system."
  ].join("\n");
}

function portableWorkspaceFiles() {
  const operatorBundle = operatorContextBundle();
  const contract = offlineStorageContract();
  return [
    { path: "README.md", kind: "markdown", content: portableWorkspaceReadme() },
    { path: "workspace.json", kind: "json", content: exportWorkspaceJson() },
    { path: "offline-storage-contract.json", kind: "json", content: JSON.stringify(contract, null, 2) },
    { path: "tasks.csv", kind: "csv", content: exportTasksCsv() },
    { path: "time.csv", kind: "csv", content: exportTimeCsv() },
    { path: "automations.json", kind: "json", content: JSON.stringify({ type: "agora.automations", exportVersion: 1, exportedAt: new Date().toISOString(), automations: state.automations }, null, 2) },
    { path: "templates.json", kind: "json", content: JSON.stringify({ type: "agora.project-templates", exportVersion: 1, exportedAt: new Date().toISOString(), templates: state.projectTemplates.map((template) => validateProjectTemplate(template, { preserveId: true })) }, null, 2) },
    { path: "operator-ledger.json", kind: "json", content: JSON.stringify(operatorBundle, null, 2) },
    { path: "audit-log.md", kind: "markdown", content: portableAuditLogMarkdown() },
    ...activeProjects().slice(0, 40).map((project) => ({
      path: `projects/${slugFromName(project.name)}.md`,
      kind: "markdown",
      content: portableProjectMarkdown(project)
    }))
  ];
}

function portableWorkspaceBundle() {
  const files = portableWorkspaceFiles();
  const manifest = portableWorkspaceManifest();
  return {
    ...manifest,
    manifest,
    files: files.map((file) => ({
      ...file,
      size: file.content.length
    }))
  };
}

function downloadPortableWorkspaceBundle() {
  if (!requireAdminAction("workspace-import", { deniedMessage: "Your role cannot export workspace recovery bundles" })) return;
  downloadJsonFile(`${slugFromName(state.workspace.name)}-portable-bundle-${todayKey()}.json`, JSON.stringify(portableWorkspaceBundle(), null, 2));
  addAuditEvent({
    action: "workspace_export",
    detail: `Downloaded portable recovery bundle for ${state.workspace.name}`,
    targetType: "workspace",
    targetId: state.workspace.id,
    metadata: { format: "portable-bundle" }
  });
  saveState();
  showToast("Portable workspace bundle downloaded", "success");
}

function downloadPortableWorkspaceManifest() {
  if (!requireAdminAction("workspace-import", { deniedMessage: "Your role cannot export workspace manifests" })) return;
  downloadTextFile(`${slugFromName(state.workspace.name)}-portable-manifest-${todayKey()}.md`, portableWorkspaceReadme(), "text/markdown");
  addAuditEvent({
    action: "workspace_export",
    detail: `Downloaded portable manifest for ${state.workspace.name}`,
    targetType: "workspace",
    targetId: state.workspace.id,
    metadata: { format: "portable-manifest" }
  });
  saveState();
  showToast("Portable manifest downloaded", "success");
}

function parsePortableWorkspaceInput(rawJson) {
  const parsed = JSON.parse(rawJson);
  if (parsed?.type === "agora.portable-workspace" && Array.isArray(parsed.files)) {
    const workspaceFile = parsed.files.find((file) => file.path === "workspace.json" && file.kind === "json");
    if (!workspaceFile?.content) throw new Error("Portable bundle is missing workspace.json");
    const snapshot = migrateWorkspaceSnapshot(JSON.parse(workspaceFile.content), { source: "portable-bundle" });
    return {
      snapshot,
      sourceType: "portable-bundle",
      manifest: parsed.manifest || parsed,
      fileCount: parsed.files.length,
      files: parsed.files.map((file) => ({ path: file.path, kind: file.kind, size: file.size || String(file.content || "").length }))
    };
  }

  return {
    snapshot: migrateWorkspaceSnapshot(parsed.snapshot && parsed.snapshot.workspace ? parsed.snapshot : parsed, { source: "workspace-json" }),
    sourceType: "workspace-json",
    manifest: parsed.manifest || null,
    fileCount: 1,
    files: []
  };
}

function portableImportPreview(rawJson) {
  const parsed = parsePortableWorkspaceInput(rawJson);
  const snapshot = parsed.snapshot || {};
  return {
    id: uid("portable-preview"),
    sourceType: parsed.sourceType,
    workspaceName: snapshot.workspace?.name || parsed.manifest?.workspace?.name || "Imported workspace",
    exportedAt: snapshot.exportedAt || parsed.manifest?.exportedAt || "",
    fileCount: parsed.fileCount,
    counts: {
      companies: Array.isArray(snapshot.companies) ? snapshot.companies.length : 0,
      projects: Array.isArray(snapshot.projects) ? snapshot.projects.length : 0,
      tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0,
      automations: Array.isArray(snapshot.automations) ? snapshot.automations.length : 0,
      templates: Array.isArray(snapshot.projectTemplates) ? snapshot.projectTemplates.length : 0,
      operatorActions: Array.isArray(snapshot.operatorActions) ? snapshot.operatorActions.length : 0
    },
    files: parsed.files.slice(0, 8),
    createdAt: new Date().toISOString()
  };
}

function importWorkspaceJson(rawJson, options = {}) {
  if (!requireAdminAction("workspace-import", { deniedMessage: "Your role cannot import or replace workspaces" })) return false;
  const parsed = parsePortableWorkspaceInput(rawJson);
  if (options.backupLabel) saveWorkspaceBackups([workspaceBackupRecord(options.backupLabel), ...loadWorkspaceBackups()]);
  applyWorkspaceSnapshot(parsed.snapshot);
  addAuditEvent({
    action: "workspace_import",
    detail: `Imported ${parsed.snapshot?.workspace?.name || "workspace"} into the current workspace`,
    targetType: "workspace",
    targetId: state.workspace.id,
    metadata: {
      sourceType: parsed.sourceType,
      backupCreated: Boolean(options.backupLabel),
      fileCount: parsed.fileCount || 1
    }
  });
  saveState();
  return true;
}

function normalizeWorkspaceBackup(backup) {
  if (!backup?.id || !backup?.snapshot) return null;
  const snapshotWorkspace = backup.snapshot.workspace || {};
  return {
    id: backup.id,
    workspaceId: backup.workspaceId || snapshotWorkspace.id || activeWorkspaceId,
    name: backup.name || snapshotWorkspace.name || "Untitled workspace",
    label: backup.label || "Manual backup",
    createdAt: backup.createdAt || new Date().toISOString(),
    snapshot: backup.snapshot
  };
}

function loadWorkspaceBackups(workspaceId = activeWorkspaceId) {
  return workspaceBackupStore
    .load(workspaceId)
    .map(normalizeWorkspaceBackup)
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_WORKSPACE_BACKUPS);
}

function saveWorkspaceBackups(backups, workspaceId = activeWorkspaceId) {
  workspaceBackupStore.save(
    backups
      .map(normalizeWorkspaceBackup)
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, MAX_WORKSPACE_BACKUPS),
    workspaceId
  );
}

function workspaceBackupRecord(label = "Manual backup") {
  return {
    id: uid("backup"),
    workspaceId: activeWorkspaceId,
    name: state.workspace.name,
    label,
    createdAt: new Date().toISOString(),
    snapshot: workspaceSnapshot()
  };
}

function createWorkspaceBackup(label = "Manual backup") {
  if (!requireAdminAction("workspace-import", { deniedMessage: "Your role cannot create workspace backups" })) return;
  saveWorkspaceBackups([workspaceBackupRecord(label), ...loadWorkspaceBackups()]);
  addAuditEvent({
    action: "workspace_export",
    detail: `Created workspace backup: ${label}`,
    targetType: "workspace",
    targetId: state.workspace.id,
    metadata: { format: "local-backup" }
  });
  saveState();
  render();
  showToast("Workspace backup created", "success");
}

function restoreWorkspaceBackup(backupId) {
  if (!requireAdminAction("workspace-import", { deniedMessage: "Your role cannot restore workspace backups" })) return;
  const backup = loadWorkspaceBackups().find((item) => item.id === backupId);
  if (!backup) {
    showToast("Backup not found", "info");
    return;
  }

  applyWorkspaceSnapshot({
    ...backup.snapshot,
    selectedRoute: "data",
    workspace: {
      ...backup.snapshot.workspace,
      id: state.workspace.id,
      name: backup.snapshot.workspace?.name || state.workspace.name,
      slug: backup.snapshot.workspace?.slug || state.workspace.slug
    }
  });
  addAuditEvent({
    action: "workspace_restore",
    detail: `Restored workspace backup: ${backup.label}`,
    targetType: "workspace",
    targetId: state.workspace.id,
    metadata: { backupId }
  });
  saveState();
  render();
  showToast(`Restored ${backup.label}`, "success");
}

function deleteWorkspaceBackup(backupId) {
  const backups = loadWorkspaceBackups().filter((backup) => backup.id !== backupId);
  saveWorkspaceBackups(backups);
  render();
  showToast("Backup deleted", "success");
}

function downloadWorkspaceExport() {
  if (!requireAdminAction("workspace-import", { deniedMessage: "Your role cannot export workspace JSON" })) return;
  downloadJsonFile(`${slugFromName(state.workspace.name)}-${todayKey()}.json`, exportWorkspaceJson());
  addAuditEvent({
    action: "workspace_export",
    detail: `Downloaded workspace JSON for ${state.workspace.name}`,
    targetType: "workspace",
    targetId: state.workspace.id,
    metadata: { format: "workspace-json" }
  });
  saveState();
  showToast("Workspace export downloaded", "success");
}

function renderWorkspaceBackupList(backups) {
  if (!backups.length) {
    return emptyState(
      "No backups yet. Create one before a risky import or big workspace change.",
      { label: "Create Backup", commandId: "backup:create" }
    );
  }

  return `
    <div class="backup-list">
      ${backups.map((backup) => `
        <article class="backup-row">
          <div>
            <strong>${escapeHtml(backup.label)}</strong>
            <p>${escapeHtml(backup.name)} - ${escapeHtml(formatTimestamp(backup.createdAt))}</p>
          </div>
          <div class="backup-actions">
            <button class="button button-secondary" type="button" data-backup-restore="${backup.id}">Restore</button>
            <button class="button button-ghost" type="button" data-backup-delete="${backup.id}">Delete</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function portableRecoveryStatus() {
  const backups = loadWorkspaceBackups();
  const manifest = portableWorkspaceManifest();
  const files = portableWorkspaceFiles();
  const hasExport = state.auditEvents.some((event) => event.action === "workspace_export");
  const checks = [
    files.some((file) => file.path === "workspace.json"),
    files.some((file) => file.path === "offline-storage-contract.json"),
    files.some((file) => file.path === "README.md"),
    files.some((file) => file.path === "audit-log.md"),
    backups.length > 0 || hasExport
  ];
  return {
    backups,
    manifest,
    files,
    latestBackup: backups[0] || null,
    score: checks.filter(Boolean).length,
    total: checks.length
  };
}

function latestWorkspaceExportEvent() {
  return state.auditEvents
    .filter((event) => event.action === "workspace_export")
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}

function isRecentTimestamp(value, maxAgeHours = 24) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= maxAgeHours * 60 * 60 * 1000;
}

function recoveryExportReadinessItems() {
  const recovery = portableRecoveryStatus();
  const latestExport = latestWorkspaceExportEvent();
  const queue = apiSyncQueueSummary();
  const hasRestorePreview = Boolean(state.portableImportPreview || state.switcherImportPreview || state.switcherImportRollback);
  const latestBackupAt = recovery.latestBackup?.createdAt || "";
  const latestExportAt = latestExport?.createdAt || "";
  return [
    {
      label: "Fresh backup",
      done: Boolean(recovery.latestBackup && isRecentTimestamp(latestBackupAt, 24)),
      value: recovery.latestBackup ? formatTimestamp(latestBackupAt) : "Missing",
      detail: recovery.latestBackup ? "A local rollback point exists for this browser workspace." : "Create a local backup before imports, API restores, or major edits.",
      action: "create-backup",
      actionLabel: "Create Backup"
    },
    {
      label: "Portable bundle",
      done: Boolean(latestExport && isRecentTimestamp(latestExportAt, 24)),
      value: latestExport ? formatTimestamp(latestExportAt) : "Not downloaded",
      detail: "The bundle contains workspace JSON, Markdown, CSV, automations, templates, audit history, and the offline contract.",
      action: "download-bundle",
      actionLabel: "Download Bundle"
    },
    {
      label: "Restore preview",
      done: hasRestorePreview,
      value: hasRestorePreview ? "Preview available" : "Preview first",
      detail: "Use bundle preview or Migration Studio before replacing the current workspace.",
      action: "open-import",
      actionLabel: "Open Import"
    },
    {
      label: "Sync safety",
      done: queue.total === 0 || queue.conflicts === 0,
      value: queue.total ? `${queue.total} queued` : "Queue clear",
      detail: queue.conflicts ? `${queue.conflicts} sync conflict${queue.conflicts === 1 ? "" : "s"} need review before claiming cloud parity.` : "Local work remains recoverable even when API sync is unavailable.",
      action: "sync",
      actionLabel: "Review Sync"
    },
    {
      label: "Offline contract",
      done: recovery.files.some((file) => file.path === "offline-storage-contract.json"),
      value: `v${recovery.manifest.offlineStorageContract.version}`,
      detail: `${recovery.manifest.offlineStorageContract.targets.length} native/PWA target${recovery.manifest.offlineStorageContract.targets.length === 1 ? "" : "s"} documented for offline app handoff.`,
      action: "download-manifest",
      actionLabel: "Download Manifest"
    }
  ];
}

function ownershipQuestionRows() {
  const items = recoveryExportReadinessItems();
  const byLabel = Object.fromEntries(items.map((item) => [item.label, item]));
  const ai = aiOperatorTrustState();
  const migrationPreview = normalizeSwitcherImportPreview(state.switcherImportPreview);
  return [
    {
      question: "Can we leave?",
      answer: byLabel["Portable bundle"]?.done ? "Yes" : "Not yet",
      tone: byLabel["Portable bundle"]?.done ? "green" : "amber",
      detail: byLabel["Portable bundle"]?.detail || "Download the portable bundle first."
    },
    {
      question: "Can we recover?",
      answer: byLabel["Fresh backup"]?.done ? "Yes" : "Create backup",
      tone: byLabel["Fresh backup"]?.done ? "green" : "amber",
      detail: byLabel["Fresh backup"]?.detail || "Create a rollback point before risky work."
    },
    {
      question: "Can we switch tools safely?",
      answer: migrationPreview ? `${migrationPreview.stats.confidence}% preview` : "Preview first",
      tone: migrationPreview ? (migrationPreview.stats.confidence >= 80 ? "green" : "amber") : "neutral",
      detail: migrationPreview ? `${migrationPreview.stats.tasks} tasks mapped with ${migrationPreview.warnings.length} warning${migrationPreview.warnings.length === 1 ? "" : "s"}.` : "Use Migration Studio before applying any external export."
    },
    {
      question: "Can we audit AI?",
      answer: ai.actionLedgerEntries ? `${ai.actionLedgerEntries} entries` : "No actions yet",
      tone: ai.actionLedgerEntries ? "green" : "neutral",
      detail: `${ai.auditMode}; ${ai.permissionSummary}.`
    },
    {
      question: "Can we work offline?",
      answer: byLabel["Offline contract"]?.done ? "Documented" : "Review",
      tone: byLabel["Offline contract"]?.done ? "green" : "amber",
      detail: byLabel["Offline contract"]?.detail || "Review offline app readiness before field use."
    }
  ];
}

function renderRecoveryExportReadinessPanel() {
  const items = recoveryExportReadinessItems();
  const doneCount = items.filter((item) => item.done).length;
  const nextAction = items.find((item) => !item.done) || items[1];
  const questions = ownershipQuestionRows();
  return `
    <section class="panel recovery-handoff-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Export and restore readiness</p>
          <h2>${doneCount === items.length ? "This workspace is exit-ready." : "Make recovery believable before handoff."}</h2>
        </div>
        <span class="status-pill ${doneCount === items.length ? "inbox-green" : "inbox-amber"}">${doneCount}/${items.length}</span>
      </div>
      <p class="panel-note">Use this as the preflight before customer imports, API restores, self-hosted handoff, or offline app testing. It calls out the next safest action instead of making users infer it from separate export panels.</p>
      <div class="ownership-question-grid">
        ${questions.map((item) => `
          <article>
            <span class="status-pill inbox-${item.tone}">${escapeHtml(item.answer)}</span>
            <strong>${escapeHtml(item.question)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </article>
        `).join("")}
      </div>
      <div class="recovery-handoff-grid">
        ${items.map((item) => `
          <article class="${item.done ? "is-ready" : "needs-action"}">
            <span>${item.done ? "Ready" : "Check"}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <em>${escapeHtml(item.value)}</em>
            <small>${escapeHtml(item.detail)}</small>
          </article>
        `).join("")}
      </div>
      <div class="data-actions">
        <span class="status-pill ${nextAction.done ? "inbox-green" : "inbox-blue"}">Next: ${escapeHtml(nextAction.label)}</span>
        ${nextAction.action === "sync"
          ? `<button class="button button-primary" type="button" data-onboarding-action="sync">${escapeHtml(nextAction.actionLabel)}</button>`
          : nextAction.action === "open-import"
            ? `<button class="button button-primary" type="button" data-route="data">${escapeHtml(nextAction.actionLabel)}</button>`
            : `<button class="button button-primary" type="button" data-recovery-action="${escapeHtml(nextAction.action)}">${escapeHtml(nextAction.actionLabel)}</button>`}
        <button class="button button-secondary" type="button" data-recovery-action="download-bundle">Download Bundle</button>
        <button class="button button-secondary" type="button" data-recovery-action="download-manifest">Download Manifest</button>
      </div>
    </section>
  `;
}

function openRecoveryPlanFlow() {
  state.selectedRoute = "data";
  openSidebarGroupForRoute("data");
  saveState();
  render();
  showToast("Recovery plan is ready to review", "success");
}

function recoveryConfidenceReceiptRows() {
  const status = portableRecoveryStatus();
  const latestExport = latestWorkspaceExportEvent();
  const queue = apiSyncQueueSummary();
  const hasRestorePreview = Boolean(state.portableImportPreview || state.switcherImportPreview || state.switcherImportRollback);
  const contract = status.manifest.offlineStorageContract;
  return [
    { label: "Receipt", value: `${status.score}/${status.total} ready`, detail: status.score === status.total ? "Backup, bundle, manifest, audit log, and offline contract are all present." : "Create a backup and download the bundle before a serious handoff." },
    { label: "Rollback point", value: status.latestBackup ? formatTimestamp(status.latestBackup.createdAt) : "Missing", detail: status.latestBackup ? `${status.backups.length} local backup${status.backups.length === 1 ? "" : "s"} available in this browser.` : "No browser-local restore point exists yet." },
    { label: "Portable export", value: latestExport ? formatTimestamp(latestExport.createdAt) : "Not recorded", detail: `${status.files.length} bundle file${status.files.length === 1 ? "" : "s"} cover workspace JSON, CSV, Markdown, audit log, and templates.` },
    { label: "Offline target", value: `v${contract.version}`, detail: `${contract.targets.join(", ")} with ${contract.collections} offline collections documented.` },
    { label: "Restore rehearsal", value: hasRestorePreview ? "Previewed" : "Preview first", detail: hasRestorePreview ? "A bundle or migration preview is available before replacing workspace data." : "Use import preview before claiming the bundle is safely restorable." },
    { label: "Not covered", value: queue.conflicts ? `${queue.conflicts} conflict${queue.conflicts === 1 ? "" : "s"}` : "Cloud parity", detail: queue.total ? `${queue.total} sync item${queue.total === 1 ? "" : "s"} still need cloud review.` : "This receipt proves local portability; API backups still depend on connected sync." }
  ];
}

function renderRecoveryConfidenceReceipt() {
  const rows = recoveryConfidenceReceiptRows();
  return `
    <section class="panel recovery-confidence-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Recovery receipt</p>
          <h2>Proof a project owner can understand.</h2>
        </div>
        <span class="status-pill inbox-blue">Live proof</span>
      </div>
      <p class="panel-note">A plain-English receipt for exports, rollback, offline app readiness, restore rehearsal, and the one thing still not guaranteed by a local bundle.</p>
      <div class="recovery-confidence-grid">
        ${rows.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></article>`).join("")}
      </div>
      <div class="data-actions">
        <button class="button button-primary" type="button" data-recovery-action="download-bundle">Download Bundle</button>
        <button class="button button-secondary" type="button" data-recovery-action="create-backup">Create Backup</button>
        <button class="button button-secondary" type="button" data-recovery-action="download-manifest">Download Manifest</button>
      </div>
    </section>
  `;
}

function renderPortableRecoveryConfidencePanel() {
  const status = portableRecoveryStatus();
  const counts = status.manifest.counts;
  const latestBackup = status.latestBackup ? formatTimestamp(status.latestBackup.createdAt) : "No local backup yet";
  return `
    <section class="panel recovery-confidence-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Recovery confidence</p>
          <h2>Know you can leave and restore</h2>
        </div>
        <span class="status-pill ${status.score >= Math.max(3, status.total - 1) ? "inbox-green" : "inbox-amber"}">${status.score}/${status.total} ready</span>
      </div>
      <p class="panel-note">The portable bundle includes workspace JSON, Markdown, CSV, automations, templates, audit history, and operator context. Use the CLI inspect path before imports or handoffs.</p>
      <div class="recovery-confidence-grid">
        <article>
          <span>Bundle files</span>
          <strong>${status.files.length}</strong>
          <small>${counts.projects} projects / ${counts.tasks} tasks</small>
        </article>
        <article>
          <span>Offline contract</span>
          <strong>v${status.manifest.offlineStorageContract.version}</strong>
          <small>${status.manifest.offlineStorageContract.targets.length} app targets / ${status.manifest.offlineStorageContract.collections} collections</small>
        </article>
        <article>
          <span>Local backups</span>
          <strong>${status.backups.length}</strong>
          <small>${escapeHtml(latestBackup)}</small>
        </article>
        <article>
          <span>Restore path</span>
          <strong>Preview first</strong>
          <small>Import bundle, then choose new workspace or replace</small>
        </article>
        <article>
          <span>CLI inspect</span>
          <strong>Available</strong>
          <small>npm run agora -- bundle inspect &lt;bundle.json&gt;</small>
        </article>
      </div>
      <div class="data-actions">
        <button class="button button-primary" type="button" data-recovery-action="download-bundle">Download Bundle</button>
        <button class="button button-secondary" type="button" data-recovery-action="create-backup">Create Backup</button>
        <button class="button button-secondary" type="button" data-recovery-action="download-manifest">Download Manifest</button>
      </div>
    </section>
  `;
}

function renderWorkspaceSchemaPanel() {
  const history = normalizeMigrationHistory(state.migrationHistory);
  const latest = history[0];
  return `
    <section class="panel workspace-schema-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Compatibility</p>
          <h2>Workspace schema</h2>
        </div>
        <span class="status-pill inbox-green">v${CURRENT_WORKSPACE_SCHEMA_VERSION}</span>
      </div>
      <div class="switcher-report-grid">
        <article>
          <span>Current schema</span>
          <strong>v${Number(state.schemaVersion || CURRENT_WORKSPACE_SCHEMA_VERSION)}</strong>
          <small>Used for local storage, imports, API snapshots, and portable bundles.</small>
        </article>
        <article>
          <span>Export version</span>
          <strong>${WORKSPACE_EXPORT_VERSION}</strong>
          <small>Portable bundle format remains stable while schema migrations upgrade workspace data.</small>
        </article>
        <article>
          <span>Last migration</span>
          <strong>${latest ? `v${latest.fromVersion} -> v${latest.toVersion}` : "None"}</strong>
          <small>${latest ? `${escapeHtml(latest.source)} / ${escapeHtml(formatTimestamp(latest.createdAt))}` : "This workspace already matches the current schema."}</small>
        </article>
        <article>
          <span>History</span>
          <strong>${history.length}</strong>
          <small>${history.length ? history.slice(0, 2).flatMap((entry) => entry.applied).join(", ") : "No compatibility upgrades recorded."}</small>
        </article>
      </div>
    </section>
  `;
}

function renderDataManagementRoute() {
  const taskCsv = exportTasksCsv();
  const timeCsv = exportTimeCsv();
  const backups = loadWorkspaceBackups();
  const demoAction = new URLSearchParams(window.location.search).get("demoAction") || "";
  const showAcmeCompletion = demoAction === "recoveryPlan";

  els.appView.innerHTML = `
    ${renderRouteHeader({
      eyebrow: "Data",
      title: "Keep the workspace portable and recoverable",
      description: "Back up the browser workspace, verify API sync, inspect bundle contents, and restore safely before risky changes.",
      actions: [
        { label: "Open Recovery Plan", commandId: "recovery:plan", primary: true },
        { label: "Create Backup", commandId: "backup:create" }
      ]
    })}

    ${renderAcmePathGuide({
      step: "6 of 6",
      title: "Leave with recovery proof.",
      detail: backups.length ? `${backups.length} local backup${backups.length === 1 ? "" : "s"} exist; export a portable bundle before real customer work.` : "Create a backup and download a portable bundle before imports, browser resets, or API restores.",
      proof: "A tester should trust that the workspace can be backed up, moved, restored, or self-hosted.",
      nextLabel: "Create backup",
      commandId: "backup:create"
    })}

    ${showAcmeCompletion ? renderAcmeCompletionReceipt() : ""}

    <div class="metric-grid">
      ${metric("Projects", activeProjects().length)}
      ${metric("Tasks", activeTasks().length)}
      ${metric("Time entries", state.timeEntries.length)}
      ${metric("Backups", backups.length)}
    </div>

    ${renderTrustMoment("recovery")}
    ${!backups.length ? starterEmptyState("data") : ""}

    ${renderRecoveryExportReadinessPanel()}
    ${renderRecoveryConfidenceReceipt()}
    ${renderPortableRecoveryConfidencePanel()}
    ${renderOpenOwnershipAdvantagePanel()}
    ${renderOfflineAppReadinessPanel()}
    ${renderWorkspaceSchemaPanel()}

    <div class="data-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Backend</p>
            <h2>API sync</h2>
          </div>
          <span class="status-pill ${apiConnectionTone()}">${escapeHtml(apiStatusLabel("offline"))}</span>
        </div>
        <div class="api-sync-card">
          <div>
            <strong>${escapeHtml(apiConnectionLabel())}</strong>
            <p>${apiSession ? `${escapeHtml(realtimeStatusLabel())} - Last saved ${escapeHtml(apiLastSyncedLabel())}` : "Local mode is safe for planning, imports, exports, and recovery. Connect from Settings when this workspace needs team or server sync."}</p>
          </div>
          <div class="data-actions">
            <button class="button button-primary" type="button" id="api-load-workspace" ${apiSession ? "" : "disabled"}>Load Records</button>
            <button class="button button-secondary" type="button" id="api-save-workspace" ${apiSession ? "" : "disabled"}>Save Snapshot</button>
            <button class="button button-secondary" type="button" id="api-restore-workspace-snapshot" ${apiSession ? "" : "disabled"}>Restore Snapshot</button>
            <button class="button button-secondary" type="button" id="api-import-workspace" ${apiSession ? "" : "disabled"}>Import to API</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Portable workspace</p>
            <h2>JSON export</h2>
          </div>
          <div class="data-actions">
            <button class="button button-secondary" type="button" id="refresh-export">Refresh</button>
            <button class="button button-secondary" type="button" id="download-json-export">Download</button>
          </div>
        </div>
        <textarea class="export-textarea" id="json-export" rows="18" readonly>${escapeHtml(exportWorkspaceJson())}</textarea>
      </section>

      <section class="panel portable-workspace-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Portable workspace OS</p>
            <h2>Full bundle</h2>
          </div>
          <span class="status-pill inbox-green">Open files</span>
        </div>
        <p class="panel-note">Download a plain JSON bundle with Markdown, CSV, automations, templates, audit history, and operator context so your workspace can move without asking permission.</p>
        <div class="portable-file-grid">
          ${portableWorkspaceFiles().slice(0, 8).map((file) => `
            <article>
              <strong>${escapeHtml(file.path)}</strong>
              <span>${escapeHtml(file.kind)} / ${file.content.length.toLocaleString()} chars</span>
            </article>
          `).join("")}
        </div>
        <div class="data-actions">
          <button class="button button-primary" type="button" id="download-portable-bundle">Download Bundle</button>
          <button class="button button-secondary" type="button" id="download-portable-manifest">Download Manifest</button>
          <button class="button button-secondary" type="button" id="backup-create-from-portable">Create Backup</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Local safety net</p>
            <h2>Backups</h2>
          </div>
          <button class="button button-primary" type="button" id="backup-create">Create Backup</button>
        </div>
        <p class="panel-note">Backups stay in this browser for the active workspace. Create one before imports, bulk edits, or API restores.</p>
        ${renderWorkspaceBackupList(backups)}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Tables</p>
            <h2>CSV exports</h2>
          </div>
        </div>
        <div class="export-stack">
          <label>
            <span>Tasks CSV</span>
            <textarea class="export-textarea" id="task-csv-export" rows="8" readonly>${escapeHtml(taskCsv)}</textarea>
          </label>
          <label>
            <span>Time CSV</span>
            <textarea class="export-textarea" id="time-csv-export" rows="8" readonly>${escapeHtml(timeCsv)}</textarea>
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Restore</p>
            <h2>Import JSON</h2>
          </div>
        </div>
        <div class="import-panel">
          <textarea id="json-import" rows="12" placeholder="Paste an Agora JSON export"></textarea>
          <div class="data-actions import-actions">
            <button class="button button-secondary" type="button" id="import-json-new-workspace">Import as New Workspace</button>
            <button class="button button-primary" type="button" id="import-json">Replace Current Workspace</button>
          </div>
        </div>
      </section>

      <section class="panel portable-workspace-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Portable restore</p>
            <h2>Import bundle</h2>
          </div>
          <span class="status-pill inbox-blue">Bundle or workspace.json</span>
        </div>
        <div class="import-panel">
          <textarea id="portable-import-payload" rows="10" placeholder="Paste an Agora portable bundle JSON or the workspace.json file from a bundle"></textarea>
          ${renderPortableImportPreview()}
          <div class="data-actions import-actions">
            <button class="button button-secondary" type="button" id="portable-import-preview">Preview Bundle</button>
            <button class="button button-secondary" type="button" id="portable-import-new">Import as New Workspace</button>
            <button class="button button-primary" type="button" id="portable-import-replace">Replace Current Workspace</button>
          </div>
        </div>
      </section>

      <section class="panel switcher-import-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Migration Studio</p>
            <h2>Bring work into Agora</h2>
          </div>
          <span class="status-pill inbox-blue">Preview first</span>
        </div>
        <div class="settings-form">
          ${renderSwitcherWizardSteps()}
          <label>
            <span>Source</span>
            <select id="switcher-source">
              ${["Asana", "ClickUp", "monday", "Trello", "Jira", "Linear", "Generic CSV"].map((source) => `<option value="${source}">${source}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Format</span>
            <select id="switcher-format">
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label>
            <span>Apply mode</span>
            <select id="switcher-mode">
              <option value="merge">Merge into current workspace</option>
              <option value="new-workspace">Create new workspace</option>
            </select>
          </label>
          <label class="wide-field">
            <span>Export payload</span>
            <textarea id="switcher-import-payload" rows="10" placeholder="Paste a CSV task export or Trello board JSON. Agora will preview mapped projects, tasks, skipped rows, warnings, and source trace metadata before applying anything."></textarea>
          </label>
          ${renderSwitcherSourceCards()}
          ${renderSwitcherSourceGuide()}
          <div class="switcher-safety-grid">
            <article>
              <strong>1. Preview</strong>
              <span>Map columns, sample imported tasks, and spot skipped rows before changes.</span>
            </article>
            <article>
              <strong>2. Backup</strong>
              <span>Agora creates a local recovery snapshot before applying an import.</span>
            </article>
            <article>
              <strong>3. Rollback</strong>
              <span>The last applied import can restore the previous workspace state.</span>
            </article>
          </div>
          <p class="settings-help">This importer creates missing projects, maps common task fields, keeps source ids on imported records, and creates a backup before changing the workspace. It is intentionally conservative so messy exports do not overwrite existing work.</p>
          <div class="data-actions import-actions">
            <button class="button button-secondary" type="button" id="switcher-sample-csv">Copy Sample CSV</button>
            <button class="button button-secondary" type="button" id="switcher-sample-trello">Copy Trello JSON</button>
            <button class="button button-primary" type="button" id="switcher-import-button">Preview Import</button>
          </div>
        </div>
        ${renderSwitcherImportPreview()}
        ${renderSwitcherImportRollback()}
        ${renderSwitcherImportHistory()}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Migration</p>
            <h2>Backend readiness</h2>
          </div>
        </div>
        ${renderBackendChecklist()}
      </section>
    </div>
  `;
}

function switcherSourcePresets() {
  return [
    {
      id: "trello",
      source: "Trello",
      format: "json",
      label: "Trello",
      status: "JSON board",
      detail: "Cards, lists, labels, members, due dates, and source URLs.",
      sample: "trello"
    },
    {
      id: "asana",
      source: "Asana",
      format: "csv",
      label: "Asana",
      status: "CSV export",
      detail: "Tasks, projects or sections, owners, completion, due dates.",
      sample: "csv"
    },
    {
      id: "jira",
      source: "Jira",
      format: "csv",
      label: "Jira",
      status: "CSV issues",
      detail: "Summary, project, status, assignee, priority, due dates.",
      sample: "csv"
    },
    {
      id: "linear",
      source: "Linear",
      format: "csv",
      label: "Linear",
      status: "CSV list",
      detail: "Title, team, status, owner, priority, labels, dates.",
      sample: "csv"
    }
  ];
}

function renderSwitcherWizardSteps() {
  const preview = normalizeSwitcherImportPreview(state.switcherImportPreview);
  const rollback = normalizeSwitcherImportRollback(state.switcherImportRollback);
  const steps = [
    {
      label: "Choose source",
      done: true,
      detail: "Pick the tool and export format."
    },
    {
      label: "Paste export",
      done: Boolean(preview),
      detail: preview ? `${preview.stats.rows} rows parsed.` : "CSV or Trello JSON stays local until applied."
    },
    {
      label: "Review mapping",
      done: Boolean(preview && preview.stats.confidence >= 55),
      detail: preview ? `${preview.stats.confidence}% confidence, ${preview.warnings.length} warnings.` : "Preview shows mapped fields and skipped rows."
    },
    {
      label: "Apply safely",
      done: Boolean(rollback),
      detail: rollback ? "Rollback is available for the last merge import." : "Agora creates a backup before changes."
    }
  ];

  return `
    <div class="switcher-wizard-shell">
      <div class="switcher-wizard-copy">
        <span class="status-pill inbox-blue">Migration wizard v1</span>
        <strong>Move projects without losing the trail</strong>
        <small>Source ids, import batches, previews, backups, and rollback stay visible through the whole flow.</small>
      </div>
      <div class="switcher-wizard-steps">
        ${steps.map((step, index) => `
          <article class="${step.done ? "is-complete" : ""}">
            <span>${index + 1}</span>
            <strong>${escapeHtml(step.label)}</strong>
            <small>${escapeHtml(step.detail)}</small>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSwitcherSourceCards() {
  return `
    <div class="switcher-source-grid">
      ${switcherSourcePresets().map((preset) => `
        <button class="switcher-source-card" type="button" data-switcher-preset="${escapeHtml(preset.id)}">
          <span>${escapeHtml(preset.status)}</span>
          <strong>${escapeHtml(preset.label)}</strong>
          <small>${escapeHtml(preset.detail)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function renderSwitcherSourceGuide() {
  const guides = [
    ["Generic CSV", "Maps common task columns like title, project, status, assignee, priority, due date, description, and tags."],
    ["Trello", "Paste a Trello board JSON export. Open cards become tasks, lists become status, labels become tags, card URLs stay as source links."],
    ["Asana", "Use CSV export today. Project/section/name/assignee/completed/due fields map into Agora tasks."],
    ["Jira", "Use CSV export today. Summary/project/status/assignee/priority/due fields map into Agora tasks."],
    ["Linear", "Use CSV or JSON list exports today. Title/team/status/assignee/priority/due fields map into Agora tasks."],
    ["ClickUp", "Use CSV export today. Task name/list/status/assignee/priority/due fields map into Agora tasks."]
  ];
  return `
    <div class="switcher-report-grid">
      ${guides.slice(0, 3).map(([label, detail]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${label === "Trello" ? "JSON ready" : "CSV ready"}</strong>
          <small>${escapeHtml(detail)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPortableImportPreview() {
  const preview = state.portableImportPreview;
  if (!preview) {
    return `
      <div class="switcher-preview-empty">
        <strong>No portable import preview yet</strong>
        <span>Preview first to confirm counts and import mode. Nothing changes until you choose restore, merge, or append.</span>
      </div>
    `;
  }

  return `
    <div class="switcher-preview-panel portable-import-preview">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Review</p>
          <h3>${escapeHtml(preview.workspaceName)}</h3>
        </div>
        <span class="status-pill inbox-neutral">${preview.sourceType === "portable-bundle" ? "Portable bundle" : "Workspace JSON"}</span>
      </div>
      <div class="metric-grid compact-metrics">
        ${metric("Files", preview.fileCount)}
        ${metric("Projects", preview.counts.projects)}
        ${metric("Tasks", preview.counts.tasks)}
        ${metric("Automations", preview.counts.automations)}
        ${metric("Templates", preview.counts.templates)}
        ${metric("Operator actions", preview.counts.operatorActions)}
      </div>
      ${preview.files?.length ? `
        <div class="portable-file-grid">
          ${preview.files.map((file) => `
            <article>
              <strong>${escapeHtml(file.path)}</strong>
              <span>${escapeHtml(file.kind)} / ${Number(file.size || 0).toLocaleString()} chars</span>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}
