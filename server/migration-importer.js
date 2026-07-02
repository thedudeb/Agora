const crypto = require("node:crypto");

const SUPPORTED_SOURCES = ["generic-csv", "trello-json", "asana-csv", "jira-csv", "linear-csv", "clickup-csv"];

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

  const existingCommentIds = new Set(arrayOf(base.comments).map((comment) => comment.id));
  const existingProjectBySourceKey = new Map(arrayOf(base.projects).map((project) => [sourceRecordKey(project), project]).filter(([key]) => key));
  const existingTaskBySourceKey = new Map(arrayOf(base.tasks).map((task) => [sourceRecordKey(task), task]).filter(([key]) => key));
  const existingCommentBySourceKey = new Map(arrayOf(base.comments).map((comment) => [sourceRecordKey(comment), comment]).filter(([key]) => key));
  const projectIdRewrites = new Map();
  const taskIdRewrites = new Map();

  const projects = [];
  for (const project of plan.projects) {
    const existingProject = arrayOf(base.projects).find((item) => item.id === project.id) || existingProjectBySourceKey.get(sourceRecordKey(project));
    if (existingProject) {
      projectIdRewrites.set(project.id, existingProject.id);
      continue;
    }
    projects.push({ ...project, updatedAt: project.updatedAt || now });
    projectIdRewrites.set(project.id, project.id);
  }

  const tasks = [];
  for (const task of plan.tasks) {
    const existingTask = arrayOf(base.tasks).find((item) => item.id === task.id) || existingTaskBySourceKey.get(sourceRecordKey(task));
    if (existingTask) {
      taskIdRewrites.set(task.id, existingTask.id);
      continue;
    }
    tasks.push({
      ...task,
      projectId: projectIdRewrites.get(task.projectId) || task.projectId,
      updatedAt: task.updatedAt || now
    });
    taskIdRewrites.set(task.id, task.id);
  }
  const comments = arrayOf(plan.comments)
    .filter((comment) => !existingCommentIds.has(comment.id) && !existingCommentBySourceKey.has(sourceRecordKey(comment)))
    .map((comment) => ({
      ...comment,
      projectId: projectIdRewrites.get(comment.projectId) || comment.projectId,
      taskId: taskIdRewrites.get(comment.taskId) || comment.taskId,
      updatedAt: comment.updatedAt || now
    }))
    .filter((comment) => comment.taskId);

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
      return parseCsvSource(payload, "generic-csv", "Generic CSV");
    }
  },
  "trello-json": {
    label: "Trello JSON",
    parse(payload) {
      return parseTrelloJson(payload);
    }
  },
  "asana-csv": {
    label: "Asana CSV",
    parse(payload) {
      return parseCsvSource(payload, "asana-csv", "Asana CSV");
    }
  },
  "jira-csv": {
    label: "Jira CSV",
    parse(payload) {
      return parseCsvSource(payload, "jira-csv", "Jira CSV");
    }
  },
  "linear-csv": {
    label: "Linear CSV",
    parse(payload) {
      return parseCsvSource(payload, "linear-csv", "Linear CSV");
    }
  },
  "clickup-csv": {
    label: "ClickUp CSV",
    parse(payload) {
      return parseCsvSource(payload, "clickup-csv", "ClickUp CSV");
    }
  }
};

function parseCsvSource(payload, source, sourceLabel) {
  const rows = rowsFromCsv(payload);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one task row");
  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
  return rowsToImportedRecords(records, {
    source,
    sourceLabel,
    mappedFields: mappedFields(headers),
    rawRows: records.length
  });
}

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
    const status = normalizeStatus(task.status);
    taskIds.add(id);
    tasks.push({
      id,
      projectId: project.id,
      title,
      description: cleanString(task.description) || `Imported from ${sourceLabel}.`,
      assignee: cleanString(task.assignee),
      status,
      priority: normalizePriority(task.priority),
      startDate: cleanDate(task.startDate),
      dueDate: cleanDate(task.dueDate),
      tags: uniqueList([source, ...arrayOf(task.tags).map(cleanString)]),
      subtasks: arrayOf(task.subtasks),
      dependencies: arrayOf(task.dependencies),
      comments: [],
      customFields: sourceFields(source, importBatchId, task, index),
      createdAt: cleanString(task.createdAt) || now,
      updatedAt: cleanString(task.updatedAt) || "",
      completedAt: cleanDateTime(task.completedAt) || (status === "done" ? cleanDateTime(task.updatedAt || task.dueDate) : ""),
      archivedAt: cleanDateTime(task.archivedAt),
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

  const counts = {
    sourceRows: Number(imported.rawRows || 0),
    projects: projects.length,
    tasks: tasks.length,
    comments: comments.length,
    skipped: skippedTasks
  };
  const mapped = arrayOf(imported.mappedFields);
  const confidence = confidenceScore({ mappedFields: mapped, tasks: tasks.length, sourceRows: imported.rawRows, errors, warnings });
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
    counts,
    confidence,
    mappedFields: mapped,
    warnings,
    errors,
    review: migrationReadinessReview({
      confidence,
      mappedFields: mapped,
      warnings,
      errors,
      counts,
      tasks
    }),
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

function migrationReadinessReview({ confidence = 0, mappedFields = [], warnings = [], errors = [], counts = {}, tasks = [] } = {}) {
  const coreFields = ["title", "project", "status", "assignee", "priority", "due date"];
  const mappedSet = new Set(arrayOf(mappedFields).map(cleanString));
  const missingCoreFields = coreFields.filter((field) => !mappedSet.has(field));
  const unmappedImportantFields = missingCoreFields.filter((field) => field !== "title");
  const unassignedTasks = arrayOf(tasks).filter((task) => !cleanString(task.assignee)).length;
  const unscheduledTasks = arrayOf(tasks).filter((task) => !cleanString(task.dueDate)).length;
  const blockers = [...arrayOf(errors)];
  if (!counts.tasks) blockers.push("No importable tasks were found.");
  if (!mappedSet.has("title")) blockers.push("No task title/name column was detected.");

  const recommendedActions = [];
  if (blockers.length) recommendedActions.push("Fix blockers in the source export before applying this migration.");
  if (unmappedImportantFields.length) recommendedActions.push(`Review missing mappings: ${unmappedImportantFields.join(", ")}.`);
  if (counts.skipped) recommendedActions.push(`Inspect ${counts.skipped} skipped row${counts.skipped === 1 ? "" : "s"} in the source file.`);
  if (unassignedTasks) recommendedActions.push(`Assign owners for ${unassignedTasks} imported task${unassignedTasks === 1 ? "" : "s"} after import.`);
  if (unscheduledTasks) recommendedActions.push(`Add due dates for ${unscheduledTasks} imported task${unscheduledTasks === 1 ? "" : "s"} after import.`);
  if (!recommendedActions.length) recommendedActions.push("Preview samples, create a backup, then apply the import.");
  const status = blockers.length
    ? "blocked"
    : confidence < 55
      ? "risky"
      : confidence < 80 || unmappedImportantFields.length || warnings.length
        ? "review"
        : "ready";

  return {
    status,
    blockers,
    missingCoreFields,
    warnings: arrayOf(warnings),
    recommendedActions,
    followUpCounts: {
      unassignedTasks,
      unscheduledTasks,
      skippedRows: Number(counts.skipped || 0)
    }
  };
}

function rowsToImportedRecords(rows, context = {}) {
  const projectNames = new Map();
  const tasks = [];
  const comments = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    const title = fieldValue(row, ["title", "task", "name", "task_name", "card_name", "item_name", "summary"]);
    if (!title) {
      skipped += 1;
      return;
    }
    const projectName = fieldValue(row, ["project", "project_name", "list", "board", "space", "folder", "group", "section", "workspace", "team", "team_name"]) || `${context.sourceLabel || "Generic"} Import`;
    if (!projectNames.has(projectName.toLowerCase())) {
      projectNames.set(projectName.toLowerCase(), {
        id: `project-${slugFromName(projectName)}`,
        sourceId: projectName,
        name: projectName,
        description: `Imported from ${context.sourceLabel || "Generic CSV"}.`
      });
    }
    const sourceId = fieldValue(row, ["id", "task_id", "card_id", "item_id", "issue_key", "key", "identifier"]) || `${index + 1}`;
    const completedAt = fieldValue(row, ["completed_at", "completed_date", "completion_date", "resolved_at", "resolutiondate", "closed_at"]);
    const updatedAt = fieldValue(row, ["updated", "updated_at", "modified", "last_modified"]);
    const archivedFlag = truthyField(fieldValue(row, ["archived", "closed"]));
    const archivedAt = fieldValue(row, ["archived_at", "archived_date", "closed_at"]) || (archivedFlag ? updatedAt || completedAt : "");
    const sourceUrl = fieldValue(row, ["source_url", "task_url", "issue_url", "card_url", "url", "link", "permalink"]);
    const attachmentUrls = splitList(fieldValue(row, ["attachments", "attachment", "attachment_url", "attachment_urls", "files", "file_urls"]));
    const commentBody = fieldValue(row, ["comment", "comments", "latest_comment", "last_comment"]);
    tasks.push({
      id: sourceId || `task-${slugFromName(title)}`,
      sourceId,
      sourceUrl,
      attachmentUrls,
      projectSourceId: projectName,
      projectName,
      title,
      description: fieldValue(row, ["description", "notes", "details", "body"]),
      assignee: fieldValue(row, ["assignee", "owner", "person", "assigned_to"]),
      status: fieldValue(row, ["status", "state", "column", "completed", "complete", "resolution"]) || (completedAt ? "completed" : archivedAt ? "closed" : ""),
      priority: fieldValue(row, ["priority", "importance"]),
      dueDate: fieldValue(row, ["due", "due_date", "due_on", "deadline", "date", "target_date"]),
      startDate: fieldValue(row, ["start", "start_date", "created", "created_at"]),
      createdAt: fieldValue(row, ["created", "created_at"]),
      updatedAt,
      completedAt,
      archivedAt,
      tags: splitList(fieldValue(row, ["tags", "labels"])),
      rawFields: row,
      sortOrder: index
    });
    if (commentBody) {
      comments.push({
        id: `comment-${context.source || "csv"}-${slugFromName(sourceId)}-${index + 1}`,
        taskSourceId: sourceId,
        body: commentBody,
        author: fieldValue(row, ["comment_author", "author", "creator", "created_by"]),
        createdAt: fieldValue(row, ["comment_created_at", "comment_date", "created", "created_at"]),
        sourceId: `${sourceId}:comment:${index + 1}`,
        rawFields: row
      });
    }
  });
  return {
    rawRows: context.rawRows ?? rows.length,
    skipped,
    mappedFields: context.mappedFields || mappedFields(Object.keys(rows[0] || {})),
    warnings: skipped ? [`${skipped} row${skipped === 1 ? "" : "s"} skipped because no task title was detected.`] : [],
    projects: Array.from(projectNames.values()),
    tasks,
    comments
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
    ["project", ["project", "project_name", "list", "board", "space", "folder", "group", "section", "workspace", "team", "team_name"]],
    ["assignee", ["assignee", "owner", "person", "assigned_to"]],
    ["status", ["status", "state", "column"]],
    ["priority", ["priority", "importance"]],
    ["due date", ["due", "due_date", "due_on", "deadline", "date", "target_date"]],
    ["description", ["description", "notes", "details", "body"]],
    ["tags", ["tags", "labels"]],
    ["source url", ["source_url", "task_url", "issue_url", "card_url", "url", "link", "permalink"]],
    ["attachments", ["attachments", "attachment", "attachment_url", "attachment_urls", "files", "file_urls"]],
    ["comments", ["comment", "comments", "latest_comment", "last_comment"]],
    ["completed", ["completed_at", "completed_date", "completion_date", "resolved_at", "resolutiondate", "closed_at"]]
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

function truthyField(value) {
  return ["true", "yes", "y", "1", "closed", "archived"].includes(cleanString(value).toLowerCase());
}

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeSource(source) {
  const normalized = String(source || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (["csv", "generic", "generic-csv"].includes(normalized)) return "generic-csv";
  if (["trello", "trello-json", "json"].includes(normalized)) return "trello-json";
  if (["asana", "asana-csv"].includes(normalized)) return "asana-csv";
  if (["jira", "jira-csv"].includes(normalized)) return "jira-csv";
  if (["linear", "linear-csv"].includes(normalized)) return "linear-csv";
  if (["clickup", "clickup-csv"].includes(normalized)) return "clickup-csv";
  return normalized;
}

function normalizeStatus(value) {
  const normalized = cleanString(value).toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return "done";
  if (["false", "no", "n", "0"].includes(normalized)) return "todo";
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

function cleanDateTime(value) {
  const raw = cleanString(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString();
}

function sourceFields(sourceSystem, importBatchId, record = {}, index = 0) {
  const attachmentUrls = uniqueList([
    ...arrayOf(record.attachmentUrls),
    ...splitList(record.attachmentUrls)
  ]);
  return {
    ...(record.customFields && typeof record.customFields === "object" ? record.customFields : {}),
    sourceSystem,
    sourceId: cleanString(record.sourceId || record.id || `${index + 1}`),
    sourceUrl: cleanString(record.sourceUrl),
    ...(attachmentUrls.length ? { attachmentUrls } : {}),
    importBatchId,
    importedAt: new Date().toISOString(),
    rawFields: record.rawFields && typeof record.rawFields === "object" ? record.rawFields : undefined
  };
}

function sourceRecordKey(record = {}) {
  const fields = record.customFields && typeof record.customFields === "object" ? record.customFields : {};
  const sourceSystem = cleanString(fields.sourceSystem || record.sourceSystem);
  const sourceId = cleanString(fields.sourceId || record.sourceId || record.id);
  if (!sourceSystem || !sourceId) return "";
  return `${sourceSystem}:${sourceId}`;
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
