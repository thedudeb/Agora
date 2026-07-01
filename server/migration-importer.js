const crypto = require("node:crypto");

const SUPPORTED_SOURCES = ["generic-csv", "trello-json"];

function createMigrationPlan(options = {}) {
  const payload = String(options.payload || "");
  if (!payload.trim()) throw new Error("Migration payload is required");

  const source = normalizeSource(options.source || detectMigrationSource(payload, options.fileName));
  const adapter = migrationAdapters[source];
  if (!adapter) throw new Error(`Unsupported migration source: ${source}`);

  const imported = adapter.parse(payload, options);
  return buildMigrationPlan({
    source,
    sourceLabel: adapter.label,
    imported,
    mode: options.mode || "merge",
    workspaceName: options.workspaceName,
    existingSnapshot: options.existingSnapshot || {}
  });
}

function applyMigrationPlan(existingSnapshot = {}, plan = {}, options = {}) {
  validateMigrationPlan(plan);
  const mode = options.mode || plan.mode || "merge";
  const now = new Date().toISOString();
  const base = mode === "new-workspace" ? emptyWorkspace(plan.workspace?.name || "Imported Workspace") : cloneSnapshot(existingSnapshot);
  const rollback = cloneSnapshot(existingSnapshot);

  const existingProjectIds = new Set(arrayOf(base.projects).map((project) => project.id));
  const existingTaskIds = new Set(arrayOf(base.tasks).map((task) => task.id));
  const existingCommentIds = new Set(arrayOf(base.comments).map((comment) => comment.id));

  const projects = plan.projects
    .filter((project) => !existingProjectIds.has(project.id))
    .map((project) => ({ ...project, updatedAt: project.updatedAt || now }));
  const tasks = plan.tasks
    .filter((task) => !existingTaskIds.has(task.id))
    .map((task) => ({ ...task, updatedAt: task.updatedAt || now }));
  const comments = arrayOf(plan.comments)
    .filter((comment) => !existingCommentIds.has(comment.id))
    .map((comment) => ({ ...comment, updatedAt: comment.updatedAt || now }));

  const snapshot = normalizeSnapshot({
    ...base,
    workspace: mode === "new-workspace"
      ? { ...base.workspace, name: plan.workspace?.name || base.workspace.name }
      : base.workspace,
    projects: [...arrayOf(base.projects), ...projects],
    tasks: [...arrayOf(base.tasks), ...tasks],
    comments: [...arrayOf(base.comments), ...comments],
    importHistory: [
      {
        id: plan.importBatchId,
        source: plan.source,
        sourceLabel: plan.sourceLabel,
        mode,
        appliedAt: now,
        counts: {
          projects: projects.length,
          tasks: tasks.length,
          comments: comments.length
        },
        warnings: arrayOf(plan.warnings)
      },
      ...arrayOf(base.importHistory)
    ]
  });

  return {
    snapshot,
    rollback,
    applied: {
      mode,
      projects: projects.length,
      tasks: tasks.length,
      comments: comments.length,
      importBatchId: plan.importBatchId
    }
  };
}

function detectMigrationSource(payload = "", fileName = "") {
  const name = String(fileName || "").toLowerCase();
  const trimmed = String(payload || "").trim();
  if (name.endsWith(".csv")) return "generic-csv";
  if (name.includes("trello") || looksLikeTrelloJson(trimmed)) return "trello-json";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "trello-json";
  return "generic-csv";
}

function validateMigrationPlan(plan = {}) {
  const errors = [];
  if (!plan.importBatchId) errors.push("Plan is missing importBatchId.");
  if (!SUPPORTED_SOURCES.includes(plan.source)) errors.push(`Unsupported source: ${plan.source || "unknown"}.`);
  if (!Array.isArray(plan.projects)) errors.push("Plan projects must be an array.");
  if (!Array.isArray(plan.tasks)) errors.push("Plan tasks must be an array.");

  const projectIds = new Set();
  for (const [index, project] of arrayOf(plan.projects).entries()) {
    if (!project.id || !project.name) errors.push(`projects[${index}] needs id and name.`);
    if (project.id) projectIds.add(project.id);
  }
  for (const [index, task] of arrayOf(plan.tasks).entries()) {
    if (!task.id || !task.projectId || !task.title) errors.push(`tasks[${index}] needs id, projectId, and title.`);
    if (task.projectId && !projectIds.has(task.projectId)) errors.push(`tasks[${index}] references missing project ${task.projectId}.`);
  }

  if (errors.length) {
    const error = new Error(`Migration plan is invalid: ${errors.join(" ")}`);
    error.errors = errors;
    throw error;
  }

  return { ok: true, errors };
}

const migrationAdapters = {
  "generic-csv": {
    label: "Generic CSV",
    parse(payload) {
      const rows = rowsFromCsv(payload);
      if (rows.length < 2) throw new Error("CSV needs a header row and at least one task row");
      const headers = rows[0].map(normalizeHeader);
      const records = rows.slice(1)
        .filter((row) => row.some((cell) => String(cell || "").trim()))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
      return rowsToImportedRecords(records, {
        source: "generic-csv",
        sourceLabel: "Generic CSV",
        mappedFields: mappedFields(headers),
        rawRows: records.length
      });
    }
  },
  "trello-json": {
    label: "Trello JSON",
    parse(payload) {
      return parseTrelloJson(payload);
    }
  }
};

function buildMigrationPlan({ source, sourceLabel, imported, mode, workspaceName, existingSnapshot }) {
  const now = new Date().toISOString();
  const importBatchId = `import-${source}-${crypto.randomUUID()}`;
  const companyId = firstCompanyId(existingSnapshot) || "company-import";
  const existingProjectNames = new Set(arrayOf(existingSnapshot.projects).map((project) => cleanString(project.name).toLowerCase()).filter(Boolean));
  const projectIds = new Set();
  const taskIds = new Set();
  const warnings = [...arrayOf(imported.warnings)];
  const errors = [...arrayOf(imported.errors)];

  const projects = arrayOf(imported.projects).map((project, index) => {
    const name = cleanString(project.name) || `${sourceLabel} Import`;
    const id = uniqueId(cleanString(project.id) || `project-${slugFromName(name)}`, projectIds);
    projectIds.add(id);
    if (existingProjectNames.has(name.toLowerCase())) warnings.push(`Project "${name}" already exists; imported project keeps a source-specific id.`);
    return {
      id,
      companyId: cleanString(project.companyId) || companyId,
      name,
      status: cleanString(project.status) || "active",
      owner: cleanString(project.owner),
      startDate: cleanDate(project.startDate),
      dueDate: cleanDate(project.dueDate),
      description: cleanString(project.description) || `Imported from ${sourceLabel}.`,
      customFields: sourceFields(source, importBatchId, project, index),
      createdAt: cleanString(project.createdAt) || now
    };
  });

  const projectBySourceKey = new Map();
  arrayOf(imported.projects).forEach((project, index) => {
    const mapped = projects[index];
    [project.sourceId, project.id, project.name].map(cleanString).filter(Boolean).forEach((key) => {
      projectBySourceKey.set(key, mapped);
    });
  });

  const defaultProject = projects[0] || {
    id: uniqueId(`project-${slugFromName(sourceLabel)}-import`, projectIds),
    companyId,
    name: `${sourceLabel} Import`,
    status: "active",
    owner: "",
    startDate: "",
    dueDate: "",
    description: `Imported from ${sourceLabel}.`,
    customFields: sourceFields(source, importBatchId, {}, 0),
    createdAt: now
  };
  if (!projects.length) projects.push(defaultProject);

  const tasks = [];
  let skippedTasks = Number(imported.skipped || 0);
  for (const [index, task] of arrayOf(imported.tasks).entries()) {
    const title = cleanString(task.title);
    if (!title) {
      skippedTasks += 1;
      continue;
    }
    const project = projectBySourceKey.get(cleanString(task.projectSourceId))
      || projectBySourceKey.get(cleanString(task.projectId))
      || projectBySourceKey.get(cleanString(task.projectName))
      || defaultProject;
    const id = uniqueId(cleanString(task.id) || `task-${slugFromName(title)}`, taskIds);
    taskIds.add(id);
    tasks.push({
      id,
      projectId: project.id,
      title,
      description: cleanString(task.description) || `Imported from ${sourceLabel}.`,
      assignee: cleanString(task.assignee),
      status: normalizeStatus(task.status),
      priority: normalizePriority(task.priority),
      startDate: cleanDate(task.startDate),
      dueDate: cleanDate(task.dueDate),
      tags: uniqueList([source, ...arrayOf(task.tags).map(cleanString)]),
      subtasks: arrayOf(task.subtasks),
      dependencies: arrayOf(task.dependencies),
      comments: [],
      customFields: sourceFields(source, importBatchId, task, index),
      createdAt: cleanString(task.createdAt) || now,
      sortOrder: Number.isFinite(Number(task.sortOrder)) ? Number(task.sortOrder) : index
    });
  }
  if (skippedTasks) warnings.push(`${skippedTasks} task row${skippedTasks === 1 ? "" : "s"} skipped because the title was missing.`);
  if (!tasks.length) errors.push("No importable tasks were found.");

  const comments = arrayOf(imported.comments).map((comment, index) => {
    const task = tasks.find((item) => item.customFields?.sourceId === cleanString(comment.taskSourceId) || item.id === cleanString(comment.taskId));
    return {
      id: cleanString(comment.id) || `comment-${source}-${crypto.randomUUID()}`,
      projectId: task?.projectId || "",
      taskId: task?.id || "",
      body: cleanString(comment.body),
      author: cleanString(comment.author),
      createdAt: cleanString(comment.createdAt) || now,
      customFields: sourceFields(source, importBatchId, comment, index)
    };
  }).filter((comment) => comment.taskId && comment.body);

  const plan = {
    type: "agora.migration-plan",
    version: 1,
    importBatchId,
    source,
    sourceLabel,
    mode: mode === "new-workspace" ? "new-workspace" : "merge",
    generatedAt: now,
    workspace: {
      name: cleanString(workspaceName) || `${sourceLabel} Import`
    },
    counts: {
      sourceRows: Number(imported.rawRows || 0),
      projects: projects.length,
      tasks: tasks.length,
      comments: comments.length,
      skipped: skippedTasks
    },
    confidence: confidenceScore({ mappedFields: imported.mappedFields, tasks: tasks.length, sourceRows: imported.rawRows, errors, warnings }),
    mappedFields: arrayOf(imported.mappedFields),
    warnings,
    errors,
    projects,
    tasks,
    comments,
    samples: tasks.slice(0, 8).map((task) => ({
      title: task.title,
      projectId: task.projectId,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate
    }))
  };
  if (errors.length) {
    const error = new Error(`Migration plan has ${errors.length} error${errors.length === 1 ? "" : "s"}`);
    error.plan = plan;
    throw error;
  }
  validateMigrationPlan(plan);
  return plan;
}

function rowsToImportedRecords(rows, context = {}) {
  const projectNames = new Map();
  const tasks = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    const title = fieldValue(row, ["title", "task", "name", "task_name", "card_name", "item_name", "summary"]);
    if (!title) {
      skipped += 1;
      return;
    }
    const projectName = fieldValue(row, ["project", "list", "board", "space", "folder", "group", "section", "workspace"]) || `${context.sourceLabel || "Generic"} Import`;
    if (!projectNames.has(projectName.toLowerCase())) {
      projectNames.set(projectName.toLowerCase(), {
        id: `project-${slugFromName(projectName)}`,
        sourceId: projectName,
        name: projectName,
        description: `Imported from ${context.sourceLabel || "Generic CSV"}.`
      });
    }
    tasks.push({
      id: fieldValue(row, ["id", "task_id", "card_id", "item_id"]) || `task-${slugFromName(title)}`,
      sourceId: fieldValue(row, ["id", "task_id", "card_id", "item_id"]) || `${index + 1}`,
      projectSourceId: projectName,
      projectName,
      title,
      description: fieldValue(row, ["description", "notes", "details", "body"]),
      assignee: fieldValue(row, ["assignee", "owner", "person", "assigned_to"]),
      status: fieldValue(row, ["status", "state", "column"]),
      priority: fieldValue(row, ["priority", "importance"]),
      dueDate: fieldValue(row, ["due", "due_date", "deadline", "date"]),
      startDate: fieldValue(row, ["start", "start_date"]),
      tags: splitList(fieldValue(row, ["tags", "labels"])),
      rawFields: row,
      sortOrder: index
    });
  });
  return {
    rawRows: context.rawRows ?? rows.length,
    skipped,
    mappedFields: context.mappedFields || mappedFields(Object.keys(rows[0] || {})),
    warnings: skipped ? [`${skipped} row${skipped === 1 ? "" : "s"} skipped because no task title was detected.`] : [],
    projects: Array.from(projectNames.values()),
    tasks,
    comments: []
  };
}

function parseTrelloJson(payload) {
  const parsed = JSON.parse(payload);
  const board = parsed && typeof parsed === "object" ? parsed : {};
  const lists = new Map(arrayOf(board.lists).map((list) => [list.id, list]));
  const labels = new Map(arrayOf(board.labels).map((label) => [label.id, label]));
  const members = new Map(arrayOf(board.members).map((member) => [member.id, member.fullName || member.username || member.id]));
  const projects = [{
    id: `project-${slugFromName(board.name || "trello-board")}`,
    sourceId: board.id || board.name || "trello-board",
    name: board.name || "Trello Board",
    description: board.desc || "Imported from Trello."
  }];
  const tasks = arrayOf(board.cards).filter((card) => !card.closed).map((card, index) => {
    const list = lists.get(card.idList) || {};
    return {
      id: `task-${slugFromName(card.name || card.id || `card-${index + 1}`)}`,
      sourceId: card.id || card.shortLink || `${index + 1}`,
      sourceUrl: card.url || card.shortUrl || "",
      projectSourceId: projects[0].sourceId,
      title: card.name || `Trello card ${index + 1}`,
      description: card.desc || "",
      assignee: arrayOf(card.idMembers).map((id) => members.get(id)).filter(Boolean).join(", "),
      status: list.name || "",
      priority: "",
      dueDate: card.due || "",
      startDate: card.start || "",
      tags: arrayOf(card.idLabels).map((id) => labels.get(id)?.name).filter(Boolean),
      rawFields: {
        idList: card.idList,
        listName: list.name || "",
        closed: Boolean(card.closed),
        dueComplete: Boolean(card.dueComplete),
        sourceUrl: card.url || card.shortUrl || ""
      },
      sortOrder: Number.isFinite(Number(card.pos)) ? Number(card.pos) : index
    };
  });
  const comments = arrayOf(board.actions)
    .filter((action) => action.type === "commentCard" && action.data?.card?.id && action.data?.text)
    .map((action) => ({
      id: `comment-trello-${action.id}`,
      taskSourceId: action.data.card.id,
      body: action.data.text,
      author: action.memberCreator?.fullName || action.memberCreator?.username || "",
      createdAt: action.date,
      sourceId: action.id
    }));
  return {
    rawRows: arrayOf(board.cards).length,
    mappedFields: ["title", "project", "assignee", "status", "due date", "description", "tags", "comments"],
    warnings: board.closed ? ["The Trello board is closed; open cards were still prepared for import."] : [],
    projects,
    tasks,
    comments
  };
}

function rowsFromCsv(payload) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const text = String(payload || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((cellValue) => String(cellValue || "").trim()));
}

function mappedFields(headers = []) {
  const groups = [
    ["title", ["title", "task", "name", "task_name", "card_name", "item_name", "summary"]],
    ["project", ["project", "list", "board", "space", "folder", "group", "section", "workspace"]],
    ["assignee", ["assignee", "owner", "person", "assigned_to"]],
    ["status", ["status", "state", "column"]],
    ["priority", ["priority", "importance"]],
    ["due date", ["due", "due_date", "deadline", "date"]],
    ["description", ["description", "notes", "details", "body"]],
    ["tags", ["tags", "labels"]]
  ];
  const headerSet = new Set(headers.map(normalizeHeader));
  return groups
    .filter(([, aliases]) => aliases.some((alias) => headerSet.has(normalizeHeader(alias))))
    .map(([label]) => label);
}

function fieldValue(row, keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    if (Object.prototype.hasOwnProperty.call(row, normalized) && cleanString(row[normalized])) return cleanString(row[normalized]);
    if (Object.prototype.hasOwnProperty.call(row, key) && cleanString(row[key])) return cleanString(row[key]);
  }
  return "";
}

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeSource(source) {
  const normalized = String(source || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (["csv", "generic", "generic-csv"].includes(normalized)) return "generic-csv";
  if (["trello", "trello-json", "json"].includes(normalized)) return "trello-json";
  return normalized;
}

function normalizeStatus(value) {
  const normalized = cleanString(value).toLowerCase();
  if (["done", "complete", "completed", "closed", "resolved", "deployed"].includes(normalized)) return "done";
  if (["doing", "in progress", "in_progress", "active", "working", "started"].includes(normalized)) return "doing";
  if (["review", "qa", "testing", "blocked review"].includes(normalized)) return "review";
  return "todo";
}

function normalizePriority(value) {
  const normalized = cleanString(value).toLowerCase();
  if (["urgent", "critical", "highest", "p0"].includes(normalized)) return "urgent";
  if (["high", "p1"].includes(normalized)) return "high";
  if (["low", "minor", "p3"].includes(normalized)) return "low";
  return "normal";
}

function cleanDate(value) {
  const raw = cleanString(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function sourceFields(sourceSystem, importBatchId, record = {}, index = 0) {
  return {
    ...(record.customFields && typeof record.customFields === "object" ? record.customFields : {}),
    sourceSystem,
    sourceId: cleanString(record.sourceId || record.id || `${index + 1}`),
    sourceUrl: cleanString(record.sourceUrl),
    importBatchId,
    importedAt: new Date().toISOString(),
    rawFields: record.rawFields && typeof record.rawFields === "object" ? record.rawFields : undefined
  };
}

function normalizeSnapshot(snapshot = {}) {
  return {
    workspace: snapshot.workspace || { id: "workspace-import", name: "Imported Workspace", slug: "imported-workspace" },
    companies: arrayOf(snapshot.companies),
    projects: arrayOf(snapshot.projects),
    tasks: arrayOf(snapshot.tasks),
    comments: arrayOf(snapshot.comments),
    activities: arrayOf(snapshot.activities),
    documents: arrayOf(snapshot.documents),
    files: arrayOf(snapshot.files),
    approvals: arrayOf(snapshot.approvals),
    timeEntries: arrayOf(snapshot.timeEntries),
    automations: arrayOf(snapshot.automations),
    projectTemplates: arrayOf(snapshot.projectTemplates),
    operatorActions: arrayOf(snapshot.operatorActions),
    importHistory: arrayOf(snapshot.importHistory),
    exportVersion: snapshot.exportVersion || 1,
    exportedAt: snapshot.exportedAt || new Date().toISOString()
  };
}

function emptyWorkspace(name) {
  const workspaceName = cleanString(name) || "Imported Workspace";
  return normalizeSnapshot({
    workspace: {
      id: `workspace-${slugFromName(workspaceName)}-${crypto.randomUUID().slice(0, 8)}`,
      name: workspaceName,
      slug: slugFromName(workspaceName)
    },
    companies: [{
      id: "company-import",
      name: "Imported Company",
      type: "Internal",
      owner: "",
      status: "Active"
    }]
  });
}

function confidenceScore({ mappedFields: fields = [], tasks = 0, sourceRows = 0, errors = [], warnings = [] }) {
  if (errors.length) return 0;
  const fieldScore = Math.min(55, fields.length * 8);
  const taskScore = sourceRows ? Math.round((tasks / sourceRows) * 35) : 20;
  const warningPenalty = Math.min(25, warnings.length * 5);
  return Math.max(10, Math.min(100, fieldScore + taskScore + 10 - warningPenalty));
}

function firstCompanyId(snapshot = {}) {
  return arrayOf(snapshot.companies)[0]?.id || "";
}

function looksLikeTrelloJson(payload) {
  if (!payload.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed?.cards) && Array.isArray(parsed?.lists);
  } catch {
    return false;
  }
}

function uniqueId(base, existing) {
  const safeBase = slugFromName(base) || crypto.randomUUID();
  let candidate = safeBase;
  let index = 2;
  while (existing.has(candidate)) {
    candidate = `${safeBase}-${index}`;
    index += 1;
  }
  return candidate;
}

function slugFromName(value) {
  return cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "import";
}

function splitList(value) {
  return cleanString(value).split(/[;,|]/).map(cleanString).filter(Boolean);
}

function uniqueList(values) {
  return Array.from(new Set(values.map(cleanString).filter(Boolean)));
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return String(value || "").trim();
}

function cloneSnapshot(value) {
  return JSON.parse(JSON.stringify(normalizeSnapshot(value)));
}

module.exports = {
  SUPPORTED_SOURCES,
  applyMigrationPlan,
  createMigrationPlan,
  detectMigrationSource,
  migrationAdapters,
  validateMigrationPlan
};
