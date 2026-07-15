/* Agora Project and Board route rendering. Loaded after app.js so shared workspace helpers stay global. */

function renderProjectSummary(project) {
  const projectTasks = activeTasks().filter((task) => task.projectId === project.id);
  const progress = projectProgress(projectTasks);
  return `
    <article class="project-summary">
      <div>
        <h3>${escapeHtml(project.name)}</h3>
        <p>${escapeHtml(project.description)}</p>
        <div class="meta-row">
          <span>${escapeHtml(companyName(project.companyId))}</span>
          <span>${memberName(project.owner)}</span>
          <span>Due ${formatDate(project.dueDate)}</span>
        </div>
      </div>
      <div class="progress-block" aria-label="${progress}% complete">
        <strong>${progress}%</strong>
        <span class="progress-track"><span style="width: ${progress}%"></span></span>
      </div>
    </article>
  `;
}

function projectHealthSnapshot(project, tasks = getProjectTasks(project.id, false)) {
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter(isOverdue);
  const blockedTasks = openTasks.filter(isTaskBlocked);
  const approvals = state.approvals.filter((approval) => approval.projectId === project.id && approval.status !== "approved");
  const staleTasks = openTasks.filter((task) => daysBetween((task.updatedAt || task.createdAt || todayKey()).slice(0, 10), todayKey()) >= 7);
  const progress = projectProgress(tasks);
  const healthScore = clamp(
    100
      - overdueTasks.length * 12
      - blockedTasks.length * 10
      - approvals.length * 8
      - staleTasks.length * 5
      + Math.round(progress / 8),
    0,
    100
  );
  const confidence = healthScore >= 82 ? "High" : healthScore >= 58 ? "Medium" : "Low";
  const tone = healthScore >= 80 ? "green" : healthScore >= 55 ? "amber" : "red";
  return {
    openTasks,
    overdueTasks,
    blockedTasks,
    approvals,
    staleTasks,
    progress,
    healthScore,
    confidence,
    tone,
    company: projectCompany(project.id),
    owner: memberName(project.owner)
  };
}

function renderProjectHealthHeader(project, snapshot) {
  return `
    <div class="project-health-header" aria-label="Project health header">
      <article>
        <span>Health</span>
        <strong>${snapshot.healthScore}%</strong>
        <small>${snapshot.healthScore >= 80 ? "Execution is healthy" : snapshot.healthScore >= 55 ? "Watch pressure points" : "Needs PM intervention"}</small>
      </article>
      <article>
        <span>Confidence</span>
        <strong>${escapeHtml(snapshot.confidence)}</strong>
        <small>${snapshot.blockedTasks.length} blockers / ${snapshot.overdueTasks.length} overdue</small>
      </article>
      <article>
        <span>Owner</span>
        <strong>${escapeHtml(snapshot.owner)}</strong>
        <small>${snapshot.openTasks.length} open tasks</small>
      </article>
      <article>
        <span>Client / Company</span>
        <strong>${escapeHtml(snapshot.company?.name || companyName(project.companyId))}</strong>
        <small>${escapeHtml(snapshot.company?.type || "Workspace project")}</small>
      </article>
      <article>
        <span>Due date</span>
        <strong>${escapeHtml(formatDate(project.dueDate))}</strong>
        <small>${project.dueDate < todayKey() ? "Past due" : `${daysBetween(todayKey(), project.dueDate)} days left`}</small>
      </article>
    </div>
  `;
}

function renderProjectPageRoute() {
  const project = byId(state.projects, state.selectedProject);
  if (!project || isProjectArchived(project)) {
    state.selectedProject = "all";
    state.selectedRoute = "dashboard";
    renderDashboard();
    return;
  }

  const allProjectTasks = getProjectTasks(project.id, false);
  const filteredProjectTasks = getProjectTasks(project.id);
  const openTasks = allProjectTasks.filter((task) => task.status !== "done");
  const completedTasks = allProjectTasks.filter((task) => task.status === "done");
  const overdueTasks = allProjectTasks.filter(isOverdue);
  const milestones = getProjectMilestones(project.id);
  const projectTimeEntries = state.timeEntries.filter((entry) => byId(state.tasks, entry.taskId)?.projectId === project.id);
  const nextMilestone = [...milestones]
    .filter((milestone) => milestone.status !== "completed")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const progress = projectProgress(allProjectTasks);
  const healthSnapshot = projectHealthSnapshot(project, allProjectTasks);

  els.appView.innerHTML = `
    <section class="project-hero project-health-hero">
      <div>
        <p class="eyebrow">Project workspace</p>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.description)}</p>
        <div class="meta-row">
          <span>${escapeHtml(companyName(project.companyId))}</span>
          <span>Owner ${memberName(project.owner)}</span>
          <span>Start ${formatDate(project.startDate)}</span>
          <span>Due ${formatDate(project.dueDate)}</span>
          <span>${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"}</span>
        </div>
        <div class="inline-actions">
          <button class="button button-secondary" type="button" data-edit-project="${project.id}">Edit Project</button>
          <button class="button button-secondary" type="button" data-duplicate-project="${project.id}">Duplicate Project</button>
          <button class="button button-secondary button-danger" type="button" data-archive-project="${project.id}">Archive Project</button>
        </div>
      </div>
      <div class="project-progress-card">
        <span>Progress</span>
        <strong>${progress}%</strong>
        <span class="progress-track"><span style="width: ${progress}%"></span></span>
      </div>
      ${renderProjectHealthHeader(project, healthSnapshot)}
    </section>

    ${renderLaunchHandoffPacket(project.id)}

    <nav class="tab-list" aria-label="Project sections">
      ${projectTabButton("overview", "Overview")}
      ${projectTabButton("tasks", "Tasks")}
      ${projectTabButton("board", "Board")}
      ${projectTabButton("timeline", "Timeline")}
      ${projectTabButton("milestones", "Milestones")}
      ${projectTabButton("docs", "Docs")}
    </nav>

    ${state.selectedProjectTab === "overview" ? renderProjectOverview(project, {
      openTasks,
      completedTasks,
      overdueTasks,
      filteredProjectTasks,
      nextMilestone,
      milestones,
      trackedMinutes: sumMinutes(projectTimeEntries)
    }) : ""}
    ${state.selectedProjectTab === "tasks" ? renderProjectTasks(filteredProjectTasks) : ""}
    ${state.selectedProjectTab === "board" ? renderProjectBoard(filteredProjectTasks) : ""}
    ${state.selectedProjectTab === "timeline" ? renderProjectTimeline(project, filteredProjectTasks, milestones) : ""}
    ${state.selectedProjectTab === "milestones" ? renderProjectMilestones(milestones) : ""}
    ${state.selectedProjectTab === "docs" ? renderProjectDocs(project) : ""}
  `;
}

function projectTabButton(tab, label) {
  return `
    <button class="tab-button ${state.selectedProjectTab === tab ? "is-active" : ""}" type="button" data-project-tab="${tab}">
      ${label}
    </button>
  `;
}

function renderProjectOverview(project, details) {
  const { openTasks, completedTasks, overdueTasks, filteredProjectTasks, nextMilestone, milestones, trackedMinutes } = details;
  return `
    <div class="metric-grid">
      ${metric("Open tasks", openTasks.length)}
      ${metric("Completed", completedTasks.length)}
      ${metric("Overdue", overdueTasks.length)}
      ${metric("Milestones", milestones.length)}
      ${metric("Tracked", formatDuration(trackedMinutes))}
    </div>

    ${renderProjectCommandCenter(project, details)}
    ${renderProjectNextBestActions(project, details)}
    ${renderProjectRiskDecisionStrip(project, details)}
    ${renderProjectOverviewSynthesis(project, details)}

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Focus</p>
            <h2>Next work</h2>
          </div>
          <button class="button button-secondary" type="button" data-project-tab="tasks">Open tasks</button>
        </div>
        <div class="task-stack">
          ${filteredProjectTasks.filter((task) => task.status !== "done").slice(0, 5).map(renderTaskCard).join("") || emptyState("No open tasks match the current filters.", [
            { label: "Create Task", id: "new-task-button-project", detail: "Capture one concrete next step, assign an owner, and set a due date." },
            { label: "Clear Filters", route: "project" }
          ])}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Milestone</p>
            <h2>${nextMilestone ? "Coming up" : "No active milestone"}</h2>
          </div>
          <button class="button button-secondary" type="button" data-project-tab="milestones">View milestones</button>
        </div>
        ${nextMilestone ? renderMilestoneCard(nextMilestone) : emptyState(`${project.name} does not have an active milestone yet.`, { label: "Add Milestone", projectTab: "timeline", detail: "Anchor the delivery plan with a dated milestone before the team starts execution." })}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Pulse</p>
            <h2>Recent activity</h2>
          </div>
        </div>
        ${renderActivityList(getProjectActivity(project.id, 5))}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Audit trail</p>
            <h2>Change history</h2>
          </div>
          <span class="status-pill inbox-neutral">${projectHistoryEvents(project.id).length} events</span>
        </div>
        ${renderHistoryTimeline(projectHistoryEvents(project.id), "No changes have been recorded for this project yet.")}
      </section>
    </div>
  `;
}

function renderProjectOverviewSynthesis(project, details) {
  return `
    <div class="project-overview-synthesis">
      ${renderProjectRecentReality(project)}
      ${renderProjectAutopilotPanel(project)}
      ${renderProjectTeamLoadPanel(project, details)}
    </div>
  `;
}

function projectRecentRealityItems(projectId) {
  const memoryItems = projectMemoryTimelineItems()
    .filter((item) => item.projectId === projectId)
    .slice(0, 3)
    .map((item) => ({
      tone: item.tone || "blue",
      label: `Memory ${item.kind}`,
      title: item.title,
      detail: item.detail,
      meta: item.createdAt ? formatTimestamp(item.createdAt) : "",
      sortAt: item.createdAt || ""
    }));
  const activityItems = getProjectActivity(projectId, 3).map((activity) => ({
    tone: "neutral",
    label: "Activity",
    title: activity.message,
    detail: memberName(activity.memberId),
    meta: formatTimestamp(activity.createdAt),
    sortAt: activity.createdAt || ""
  }));
  const commentItems = state.comments
    .filter((comment) => comment.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 2)
    .map((comment) => ({
      tone: "blue",
      label: "Comment",
      title: comment.body.slice(0, 120),
      detail: memberName(comment.author),
      meta: formatTimestamp(comment.createdAt),
      sortAt: comment.createdAt || ""
    }));
  return [...memoryItems, ...commentItems, ...activityItems]
    .sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0))
    .slice(0, 5);
}

function renderProjectRecentReality(project) {
  const items = projectRecentRealityItems(project.id);
  return `
    <section class="panel project-reality-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Recent Reality</p>
          <h2>What changed lately</h2>
        </div>
        <button class="button button-secondary compact-button" type="button" data-route="memory">Open Memory</button>
      </div>
      <div class="project-reality-list">
        ${items.length ? items.map((item) => `
          <article>
            <span class="status-pill inbox-${item.tone}">${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.detail || "No detail")}</p>
            <small>${escapeHtml(item.meta || "Recent")}</small>
          </article>
        `).join("") : emptyState("Project Memory, comments, and activity will collect the latest reality for this project.")}
      </div>
    </section>
  `;
}

function renderProjectAutopilotPanel(project) {
  const drifts = projectAutopilotDriftCards().filter((drift) => drift.projectId === project.id);
  const scenarios = projectAutopilotRecoveryScenarios(drifts).slice(0, 3);
  return `
    <section class="panel project-autopilot-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Autopilot for This Project</p>
          <h2>Drift and recovery proposals</h2>
        </div>
        <button class="button button-secondary compact-button" type="button" data-route="autopilot">Open Autopilot</button>
      </div>
      <div class="project-autopilot-summary">
        <article><span>Drift cards</span><strong>${drifts.length}</strong><small>${drifts[0]?.title || "No project-specific drift detected."}</small></article>
        <article><span>Recovery proposals</span><strong>${scenarios.length}</strong><small>${scenarios[0]?.strategy || "No recovery action waiting."}</small></article>
      </div>
      <div class="project-autopilot-list">
        ${scenarios.length ? scenarios.map((scenario) => `
          <article>
            <span class="status-pill inbox-${autopilotSeverityTone(scenario.severity)}">${escapeHtml(scenario.strategy)}</span>
            <strong>${escapeHtml(scenario.title)}</strong>
            <p>${escapeHtml(scenario.summary)}</p>
            <small>${scenario.confidence}% confidence / ${escapeHtml(scenario.driftTitle)}</small>
          </article>
        `).join("") : emptyState("Autopilot has no recovery proposal for this project right now.")}
      </div>
    </section>
  `;
}

function projectTeamLoadRows(projectId) {
  const tasks = getProjectTasks(projectId, false).filter((task) => task.status !== "done");
  return members
    .map((member) => {
      const owned = tasks.filter((task) => task.assignee === member.id);
      return {
        member,
        owned,
        blocked: owned.filter(isTaskBlocked).length,
        overdue: owned.filter(isOverdue).length,
        urgent: owned.filter((task) => task.priority === "urgent" || task.priority === "high").length
      };
    })
    .filter((row) => row.owned.length)
    .sort((a, b) => b.owned.length - a.owned.length || b.blocked - a.blocked)
    .slice(0, 6);
}

function renderProjectTeamLoadPanel(project, details) {
  const rows = projectTeamLoadRows(project.id);
  const overloaded = rows.filter((row) => row.owned.length >= 4 || row.blocked || row.overdue);
  return `
    <section class="panel project-team-load-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Team Load</p>
          <h2>Owner workload</h2>
        </div>
        <span class="status-pill ${overloaded.length ? "inbox-amber" : "inbox-green"}">${overloaded.length ? `${overloaded.length} watch` : "Balanced"}</span>
      </div>
      <div class="project-team-load-list">
        ${rows.length ? rows.map((row) => `
          <article>
            <div>
              <strong>${escapeHtml(row.member.name)}</strong>
              <p>${row.owned.length} open / ${row.urgent} high priority</p>
            </div>
            <div class="project-load-meter" aria-label="${row.member.name} workload">
              <span style="width: ${clamp(row.owned.length * 18, 8, 100)}%"></span>
            </div>
            <small>${row.blocked} blocked / ${row.overdue} overdue</small>
          </article>
        `).join("") : emptyState(`${project.name} has no assigned open work yet.`)}
      </div>
    </section>
  `;
}

function projectVisibilityWarnings(projectId) {
  return (clientVisibilityReviewData().warnings || []).filter((item) => item.projectId === projectId);
}

function projectAutopilotScenarios(projectId) {
  return projectAutopilotRecoveryScenarios().filter((scenario) => scenario.projectId === projectId).slice(0, 3);
}

function projectNextBestActions(project, details) {
  const { openTasks, overdueTasks, nextMilestone } = details;
  const blockedTasks = openTasks.filter(isTaskBlocked);
  const approvals = state.approvals.filter((approval) => approval.projectId === project.id && approval.status !== "approved");
  const visibilityWarnings = projectVisibilityWarnings(project.id);
  const autopilotScenarios = projectAutopilotScenarios(project.id);
  const raidItems = projectRaidItems(project.id).filter((item) => item.status !== "closed");
  const dueSoon = openTasks
    .filter((task) => task.dueDate && task.dueDate <= shiftDate(todayKey(), 7) && !isOverdue(task))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return [
    ...blockedTasks.slice(0, 2).map((task) => ({
      tone: "red",
      label: "Clear blocker",
      title: task.title,
      detail: `${openTaskDependencies(task).map((item) => item.title).join(", ") || "Dependency needs review"}`,
      action: "Open Task",
      taskId: task.id
    })),
    ...overdueTasks.slice(0, 2).map((task) => ({
      tone: "amber",
      label: "Recover overdue work",
      title: task.title,
      detail: `${memberName(task.assignee)} / due ${formatDate(task.dueDate)}`,
      action: "Open Task",
      taskId: task.id
    })),
    ...approvals.slice(0, 1).map((approval) => ({
      tone: "blue",
      label: "Chase approval",
      title: approval.title,
      detail: `${approvalStatusLabel(approval.status)} / due ${formatDate(approval.dueDate)}`,
      action: "Client Visibility",
      route: "visibility"
    })),
    ...autopilotScenarios.slice(0, 1).map((scenario) => ({
      tone: "amber",
      label: "Review Autopilot",
      title: scenario.title,
      detail: `${scenario.strategy} / ${scenario.confidence}% confidence`,
      action: "Open Autopilot",
      route: "autopilot"
    })),
    ...visibilityWarnings.slice(0, 1).map((warning) => ({
      tone: "amber",
      label: "Fix client packet",
      title: warning.title,
      detail: warning.warning,
      action: "Client Visibility",
      route: "visibility"
    })),
    ...raidItems.slice(0, 1).map((item) => ({
      tone: raidTone(item),
      label: "Resolve RAID",
      title: item.title,
      detail: `${raidTypeLabel(item.type)} / ${raidSeverityLabel(item.severity)}`,
      action: "Open Decisions",
      route: "decisions"
    })),
    ...dueSoon.slice(0, 1).map((task) => ({
      tone: "blue",
      label: "Protect date",
      title: task.title,
      detail: `${memberName(task.assignee)} / due ${formatDate(task.dueDate)}`,
      action: "Open Task",
      taskId: task.id
    })),
    !nextMilestone ? {
      tone: "neutral",
      label: "Add milestone",
      title: "Anchor the delivery plan",
      detail: "No upcoming milestone is set for this project.",
      action: "Open Timeline",
      projectTab: "timeline"
    } : null
  ].filter(Boolean).slice(0, 6);
}

function renderProjectNextBestActions(project, details) {
  const actions = projectNextBestActions(project, details);
  return `
    <section class="panel project-next-actions-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Next Best Actions</p>
          <h2>What should happen next</h2>
        </div>
        <span class="status-pill ${actions.length ? "inbox-amber" : "inbox-green"}">${actions.length ? `${actions.length} actions` : "Clear"}</span>
      </div>
      <div class="project-next-action-grid">
        ${actions.length ? actions.map((item) => `
          <article>
            <span class="status-pill inbox-${item.tone}">${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.detail)}</p>
            <button class="button button-secondary compact-button" type="button" ${item.taskId ? `data-edit-task="${escapeHtml(item.taskId)}"` : item.projectTab ? `data-project-tab="${escapeHtml(item.projectTab)}"` : `data-route="${escapeHtml(item.route)}"`}>${escapeHtml(item.action)}</button>
          </article>
        `).join("") : emptyState("No urgent project action is waiting. Use the time to groom scope, confirm dates, or prepare a client update.")}
      </div>
    </section>
  `;
}

function renderProjectRiskDecisionStrip(project, details) {
  const { openTasks, overdueTasks } = details;
  const blockedTasks = openTasks.filter(isTaskBlocked);
  const approvals = state.approvals.filter((approval) => approval.projectId === project.id && approval.status !== "approved");
  const raidItems = projectRaidItems(project.id).filter((item) => item.status !== "closed");
  const visibilityWarnings = projectVisibilityWarnings(project.id);
  const autopilotScenarios = projectAutopilotScenarios(project.id);
  const rows = [
    { label: "Open RAID", value: raidItems.length, detail: raidItems[0]?.title || "No open risk, issue, decision, or change.", tone: raidItems.length ? "amber" : "green", route: "decisions" },
    { label: "Pending decisions", value: raidItems.filter((item) => item.type === "decision").length, detail: raidItems.find((item) => item.type === "decision")?.title || "No project decision is waiting.", tone: raidItems.some((item) => item.type === "decision") ? "blue" : "green", route: "decisions" },
    { label: "Approvals", value: approvals.length, detail: approvals[0]?.title || "No approval is blocking delivery.", tone: approvals.length ? "blue" : "green", route: "visibility" },
    { label: "Client visibility warnings", value: visibilityWarnings.length, detail: visibilityWarnings[0]?.warning || "Client packet is clear.", tone: visibilityWarnings.length ? "amber" : "green", route: "visibility" },
    { label: "Blocked / overdue", value: blockedTasks.length + overdueTasks.length, detail: `${blockedTasks.length} blocked / ${overdueTasks.length} overdue`, tone: blockedTasks.length || overdueTasks.length ? "red" : "green", projectTab: "tasks" },
    { label: "Autopilot review", value: autopilotScenarios.length, detail: autopilotScenarios[0]?.title || "No recovery proposal is waiting.", tone: autopilotScenarios.length ? "amber" : "neutral", route: "autopilot" }
  ];
  return `
    <section class="project-risk-strip" aria-label="Risk and decisions strip">
      ${rows.map((row) => `
        <button class="project-risk-pill" type="button" ${row.projectTab ? `data-project-tab="${escapeHtml(row.projectTab)}"` : `data-route="${escapeHtml(row.route)}"`}>
          <span class="status-pill inbox-${row.tone}">${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
          <small>${escapeHtml(row.detail)}</small>
        </button>
      `).join("")}
    </section>
  `;
}

function renderProjectCommandCenter(project, details) {
  const { openTasks, overdueTasks, filteredProjectTasks, nextMilestone, trackedMinutes } = details;
  const projectApprovals = state.approvals.filter((approval) => approval.projectId === project.id && approval.status !== "approved");
  const projectDocs = state.documents.filter((document) => document.projectId === project.id);
  const projectFiles = state.files.filter((file) => file.projectId === project.id);
  const raidItems = projectRaidItems(project.id);
  const openRaidItems = raidItems.filter((item) => item.status !== "closed");
  const readinessItems = realProjectReadinessItems(project);
  const readinessDone = readinessItems.filter((item) => item.done).length;
  const blockedTasks = openTasks.filter(isTaskBlocked);
  const progress = projectProgress(getProjectTasks(project.id, false));
  const scheduledTasks = getProjectTasks(project.id, false).filter((task) => task.dueDate);
  const slippedTasks = scheduledTasks.filter((task) => isOverdue(task) && task.status !== "done");
  const clientVisibleTasks = filteredProjectTasks.filter((task) => taskVisibility(task) !== "internal");
  const staleTasks = openTasks.filter((task) => daysBetween((task.updatedAt || task.createdAt || todayKey()).slice(0, 10), todayKey()) >= 7);
  const healthScore = clamp(
    100
      - overdueTasks.length * 12
      - blockedTasks.length * 10
      - projectApprovals.length * 8
      - staleTasks.length * 5
      - slippedTasks.length * 10
      + Math.round(progress / 8),
    0,
    100
  );
  const healthTone = healthScore >= 80 ? "inbox-green" : healthScore >= 55 ? "inbox-amber" : "inbox-red";
  const risks = [
    overdueTasks.length ? `${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "task" : "tasks"}` : "",
    blockedTasks.length ? `${blockedTasks.length} blocked ${blockedTasks.length === 1 ? "task" : "tasks"}` : "",
    projectApprovals.length ? `${projectApprovals.length} approval ${projectApprovals.length === 1 ? "needs" : "items need"} attention` : "",
    openRaidItems.filter((item) => ["risk", "issue", "change"].includes(item.type)).length ? `${openRaidItems.filter((item) => ["risk", "issue", "change"].includes(item.type)).length} RAID item${openRaidItems.length === 1 ? "" : "s"} open` : "",
    !nextMilestone ? "No upcoming milestone" : ""
  ].filter(Boolean);
  const nextTask = filteredProjectTasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => operatorTaskScore(b) - operatorTaskScore(a))[0];
  const nextRaid = openRaidItems
    .sort((a, b) => raidSeverityScore(b) - raidSeverityScore(a) || cleanString(a.dueDate).localeCompare(cleanString(b.dueDate)))[0];
  const actionQueue = [
    ...overdueTasks.map((task) => ({ id: task.id, label: "Overdue", title: task.title, detail: `${memberName(task.assignee)} / due ${formatDate(task.dueDate)}`, action: "Open", taskId: task.id, tone: "red" })),
    ...blockedTasks.map((task) => ({ id: task.id, label: "Blocked", title: task.title, detail: `${openTaskDependencies(task).length} open dependencies`, action: "Open", taskId: task.id, tone: "amber" })),
    ...projectApprovals.map((approval) => ({ id: approval.id, label: "Approval", title: approval.title, detail: `Due ${formatDate(approval.dueDate)}`, action: "Visibility", route: "visibility", tone: "blue" })),
    ...staleTasks.map((task) => ({ id: task.id, label: "Stale", title: task.title, detail: `Updated ${formatTimestamp(task.updatedAt || task.createdAt)}`, action: "Open", taskId: task.id, tone: "neutral" }))
  ].slice(0, 5);

  return `
    <section class="panel project-command-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Command center</p>
          <h2>Project command center</h2>
        </div>
        <div class="inline-actions">
          <button class="button button-secondary compact-button" type="button" data-route="reports">Open reports</button>
          <button class="button button-secondary compact-button" type="button" data-project-tab="timeline">Open timeline</button>
        </div>
      </div>
      <div class="project-command-hero">
        <article>
          <span>Project health</span>
          <strong>${healthScore}%</strong>
          <p>${healthScore >= 80 ? "Execution is healthy." : healthScore >= 55 ? "Watch the pressure points." : "Needs PM intervention."}</p>
        </article>
        <article>
          <span>Timeline slip</span>
          <strong>${slippedTasks.length}</strong>
          <p>${slippedTasks[0] ? `${escapeHtml(slippedTasks[0].title)} is past due.` : "No scheduled task has slipped."}</p>
        </article>
        <article>
          <span>Client visibility</span>
          <strong>${clientVisibleTasks.length}</strong>
          <p>${clientVisibleTasks.length ? "Client-facing work is in motion." : "No client-visible task is currently flagged."}</p>
        </article>
        <article>
          <span>Decision load</span>
          <strong>${openRaidItems.filter((item) => item.type === "decision").length}</strong>
          <p>${nextRaid?.type === "decision" ? escapeHtml(nextRaid.title) : "No decision is currently leading the queue."}</p>
        </article>
      </div>
      <div class="project-command-status">
        <span class="status-pill ${healthTone}">Health ${healthScore}%</span>
        <span class="status-pill ${blockedTasks.length ? "inbox-amber" : "inbox-green"}">${blockedTasks.length} blocked</span>
        <span class="status-pill ${projectApprovals.length ? "inbox-blue" : "inbox-green"}">${projectApprovals.length} approvals</span>
        <span class="status-pill ${staleTasks.length ? "inbox-amber" : "inbox-green"}">${staleTasks.length} stale</span>
      </div>
      <div class="project-action-queue">
        <div>
          <p class="eyebrow">Action queue</p>
          <h3>What to do next</h3>
        </div>
        ${actionQueue.length ? actionQueue.map((item) => `
          <article>
            <span class="status-pill inbox-${item.tone}">${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.detail)}</small>
            <button class="button button-secondary compact-button" type="button" ${item.taskId ? `data-edit-task="${item.taskId}"` : `data-route="${item.route}"`}>${escapeHtml(item.action)}</button>
          </article>
        `).join("") : `
          <article>
            <span class="status-pill inbox-green">Clear</span>
            <strong>No urgent project action</strong>
            <small>Use this window to groom scope, validate milestones, or prep client updates.</small>
            <button class="button button-secondary compact-button" type="button" data-project-tab="timeline">Review Timeline</button>
          </article>
        `}
      </div>
      <div class="project-command-grid">
        <article>
          <span>Next action</span>
          <strong>${escapeHtml(nextTask?.title || "Review project plan")}</strong>
          <p>${escapeHtml(nextTask ? operatorReasonForTask(nextTask) : "No active task is currently scoring as urgent.")}</p>
        </article>
        <article>
          <span>Risk posture</span>
          <strong>${risks.length || "Clear"}</strong>
          <p>${escapeHtml(risks.join(" - ") || "No immediate overdue, blocked, or approval risk detected.")}</p>
        </article>
        <article>
          <span>RAID focus</span>
          <strong>${escapeHtml(nextRaid?.title || "No open RAID item")}</strong>
          <p>${escapeHtml(nextRaid ? `${raidTypeLabel(nextRaid.type)} / ${raidSeverityLabel(nextRaid.severity)} / ${nextRaid.mitigation || nextRaid.detail}` : "Capture risks, assumptions, issues, decisions, and changes before kickoff.")}</p>
        </article>
        <article>
          <span>Approvals</span>
          <strong>${projectApprovals.length}</strong>
          <p>${escapeHtml(projectApprovals[0] ? `${projectApprovals[0].title} due ${formatDate(projectApprovals[0].dueDate)}` : "No open approval is blocking the project.")}</p>
        </article>
        <article>
          <span>Milestone</span>
          <strong>${escapeHtml(nextMilestone?.title || "No milestone")}</strong>
          <p>${escapeHtml(nextMilestone ? `${milestoneStatusLabel(nextMilestone.status)} / due ${formatDate(nextMilestone.dueDate)}` : "Add a milestone to anchor delivery.")}</p>
        </article>
        <article>
          <span>Client packet</span>
          <strong>${projectDocs.length + projectFiles.length}</strong>
          <p>${projectDocs.length} docs, ${projectFiles.length} files, ${projectApprovals.length} open approvals.</p>
        </article>
        <article>
          <span>Time</span>
          <strong>${formatDuration(trackedMinutes)}</strong>
          <p>${openTasks.length} open tasks remain in this project.</p>
        </article>
        <article>
          <span>Real project mode</span>
          <strong>${readinessDone}/${readinessItems.length}</strong>
          <p>${escapeHtml(readinessItems.find((item) => !item.done)?.detail || "Ready for a real project kickoff.")}</p>
        </article>
      </div>
      ${renderRealProjectReadinessPanel(readinessItems)}
      ${renderProjectRaidLog(project, raidItems)}
    </section>
  `;
}

function projectRaidItems(projectId) {
  return normalizeRaidItems(state.raidItems)
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => raidSeverityScore(b) - raidSeverityScore(a) || cleanString(a.dueDate).localeCompare(cleanString(b.dueDate)));
}

function raidSeverityScore(item) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[item?.severity] || 0;
}

function raidSeverityLabel(severity) {
  return { critical: "Critical", high: "High", medium: "Medium", low: "Low" }[severity] || "Medium";
}

function raidTypeLabel(type) {
  return {
    risk: "Risk",
    assumption: "Assumption",
    issue: "Issue",
    decision: "Decision",
    change: "Change"
  }[type] || "Risk";
}

function milestoneStatusLabel(status) {
  return {
    planned: "Planned",
    active: "Active",
    completed: "Completed",
    "at-risk": "At risk"
  }[status] || statusLabel(status);
}

function raidTone(item) {
  if (item.severity === "critical" || item.severity === "high" || item.type === "issue") return "red";
  if (item.severity === "medium" || item.type === "change") return "amber";
  if (item.type === "decision") return "blue";
  return "green";
}

function renderRealProjectReadinessPanel(items) {
  return `
    <div class="real-project-panel">
      <div class="real-project-grid">
        ${items.map((item) => `
          <article class="${item.done ? "is-done" : "is-open"}">
            <span>${item.done ? "OK" : "Next"}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderProjectRaidLog(project, items) {
  return `
    <div class="project-raid-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">RAID and decisions</p>
          <h3>${items.length} tracked ${items.length === 1 ? "item" : "items"}</h3>
        </div>
        <span class="status-pill ${items.some((item) => item.severity === "critical" || item.severity === "high") ? "inbox-red" : items.length ? "inbox-amber" : "inbox-green"}">${items.filter((item) => item.status !== "closed").length} open</span>
      </div>
      <div class="project-raid-list">
        ${items.length ? items.map(renderRaidItem).join("") : emptyState(`${project.name} has no RAID items yet.`, { label: "Open Decisions", route: "decisions", detail: "Track risks, assumptions, issues, decisions, and changes before they surprise the project." })}
      </div>
    </div>
  `;
}

function renderRaidItem(item) {
  return `
    <article class="raid-item raid-${item.type}">
      <span class="status-pill inbox-${raidTone(item)}">${escapeHtml(raidTypeLabel(item.type))}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail || item.mitigation || "No detail captured yet.")}</p>
        <small>${escapeHtml(raidSeverityLabel(item.severity))} / ${escapeHtml(item.status)} / Owner ${memberName(item.owner)}${item.dueDate ? ` / Due ${formatDate(item.dueDate)}` : ""}</small>
      </div>
    </article>
  `;
}

function renderProjectTasks(tasks) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Project tasks</p>
          <h2>${tasks.length} matching ${tasks.length === 1 ? "task" : "tasks"}</h2>
        </div>
        <button class="button button-secondary" type="button" id="new-task-button-project">New Task</button>
      </div>
      ${tasks.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(renderProjectTaskRow).join("")}
            </tbody>
          </table>
        </div>
      ` : emptyState("No project tasks match those filters.", [
        { label: "Create Task", id: "new-task-button-project", detail: "Start with the next owner-driven task, then schedule it from the timeline." },
        { label: "Open Board", projectTab: "board" }
      ])}
    </section>
  `;
}

function renderProjectTaskRow(task) {
  const checklist = subtaskSummary(task);
  const fields = renderTaskFieldChips(task);
  const dependencies = renderTaskDependencyChips(task);
  return `
    <tr>
      <td>
        <button class="table-task-button" type="button" data-edit-task="${task.id}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(task.description)}</span>
          ${checklist ? `<span>${escapeHtml(checklist)}</span>` : ""}
          ${dependencies}
          ${fields}
        </button>
      </td>
      <td>${memberName(task.assignee)}</td>
      <td>${selectControl("status", task.id, task.status, boardStatusOptions())}</td>
      <td>${selectControl("priority", task.id, task.priority, priorities)}</td>
      <td class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}</td>
      <td><button class="button button-secondary button-danger compact-button" type="button" data-archive-task="${task.id}">Archive</button></td>
    </tr>
  `;
}

function boardSortValue(task) {
  const order = Number(task.boardOrder ?? task.customFields?.boardOrder);
  return Number.isFinite(order) ? order : 100000 + state.tasks.findIndex((item) => item.id === task.id);
}

function boardOrderedTasks(tasks = []) {
  const sort = normalizeWorkspaceBoard(state.workspace.board).sort;
  const priorityOrder = new Map(priorities.map((priority, index) => [priority.id, index]));
  return [...tasks].sort((a, b) => {
    if (sort === "due") {
      const dueSort = String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
      if (dueSort) return dueSort;
    }
    if (sort === "priority") {
      const prioritySort = (priorityOrder.get(a.priority) ?? 99) - (priorityOrder.get(b.priority) ?? 99);
      if (prioritySort) return prioritySort;
    }
    const boardSort = boardSortValue(a) - boardSortValue(b);
    if (boardSort) return boardSort;
    return String(a.updatedAt || a.createdAt || "").localeCompare(String(b.updatedAt || b.createdAt || ""));
  });
}

function boardSwimlaneGroups(tasks = []) {
  const board = normalizeWorkspaceBoard(state.workspace.board);
  if (board.swimlane === "assignee") {
    const groups = workspaceMembers().map((member) => ({
      id: member.id,
      label: member.name,
      tasks: tasks.filter((task) => task.assignee === member.id)
    }));
    const unassigned = tasks.filter((task) => !task.assignee);
    return [...groups.filter((group) => group.tasks.length), ...(unassigned.length ? [{ id: "unassigned", label: "Unassigned", tasks: unassigned }] : [])];
  }
  if (board.swimlane === "priority") {
    return priorities
      .map((priority) => ({ id: priority.id, label: priority.label, tasks: tasks.filter((task) => task.priority === priority.id) }))
      .filter((group) => group.tasks.length);
  }
  if (board.swimlane === "company") {
    return state.companies
      .map((company) => ({ id: company.id, label: company.name, tasks: tasks.filter((task) => projectCompany(task.projectId).id === company.id) }))
      .filter((group) => group.tasks.length);
  }
  if (board.swimlane === "blocked") {
    const blocked = tasks.filter(isTaskBlocked);
    const flowing = tasks.filter((task) => !isTaskBlocked(task));
    return [
      blocked.length ? { id: "blocked", label: "Blocked", tasks: blocked } : null,
      flowing.length ? { id: "flowing", label: "Flowing", tasks: flowing } : null
    ].filter(Boolean);
  }
  if (board.swimlane === "overdue") {
    const overdue = tasks.filter(isOverdue);
    const onTrack = tasks.filter((task) => !isOverdue(task));
    return [
      overdue.length ? { id: "overdue", label: "Overdue", tasks: overdue } : null,
      onTrack.length ? { id: "on-track", label: "On track", tasks: onTrack } : null
    ].filter(Boolean);
  }
  if (board.swimlane === "stale") {
    const stale = tasks.filter((task) => task.status !== "done" && daysBetween((task.updatedAt || task.createdAt || todayKey()).slice(0, 10), todayKey()) >= 7);
    const fresh = tasks.filter((task) => !stale.some((item) => item.id === task.id));
    return [
      stale.length ? { id: "stale", label: "Needs movement", tasks: stale } : null,
      fresh.length ? { id: "fresh", label: "Recently touched", tasks: fresh } : null
    ].filter(Boolean);
  }
  if (board.swimlane === "review") {
    const review = tasks.filter((task) => task.status === "review");
    const other = tasks.filter((task) => task.status !== "review");
    return [
      review.length ? { id: "review", label: "Review queue", tasks: review } : null,
      other.length ? { id: "other", label: "Other active work", tasks: other } : null
    ].filter(Boolean);
  }
  if (board.swimlane === "client") {
    const visible = tasks.filter((task) => taskVisibility(task) !== "internal");
    const internal = tasks.filter((task) => taskVisibility(task) === "internal");
    return [
      visible.length ? { id: "client-visible", label: "Client-visible", tasks: visible } : null,
      internal.length ? { id: "internal", label: "Internal", tasks: internal } : null
    ].filter(Boolean);
  }
  if (board.swimlane === "tag") {
    const tag = board.swimlaneValue.toLowerCase();
    const tagged = tag ? tasks.filter((task) => task.tags.some((item) => item.toLowerCase() === tag)) : [];
    const rest = tag ? tasks.filter((task) => !task.tags.some((item) => item.toLowerCase() === tag)) : tasks;
    return [
      tagged.length ? { id: `tag-${tag}`, label: `Tagged ${board.swimlaneValue}`, tasks: tagged } : null,
      rest.length ? { id: "untagged", label: tag ? "Everything else" : "Choose a tag", tasks: rest } : null
    ].filter(Boolean);
  }
  return [{ id: "all", label: "All work", tasks }];
}

function boardHealthStats(tasks = []) {
  const board = normalizeWorkspaceBoard(state.workspace.board);
  const columns = board.columns.filter((column) => column.enabled);
  const visibleTasks = tasks.filter((task) => task.status !== "done");
  const overWip = columns.filter((column) => {
    const count = tasks.filter((task) => task.status === column.id).length;
    return column.wipLimit > 0 && count > column.wipLimit;
  }).length;
  const stale = visibleTasks.filter((task) => daysBetween((task.updatedAt || task.createdAt || todayKey()).slice(0, 10), todayKey()) >= 7).length;
  const blocked = visibleTasks.filter(isTaskBlocked).length;
  const overdue = visibleTasks.filter(isOverdue).length;
  const unowned = visibleTasks.filter((task) => !task.assignee).length;
  const review = tasks.filter((task) => task.status === "review").length;
  return { overWip, stale, blocked, overdue, unowned, review };
}

function renderBoardHealthStrip(tasks = []) {
  const stats = boardHealthStats(tasks);
  const board = normalizeWorkspaceBoard(state.workspace.board);
  const undo = board.lastUndo;
  return `
    <section class="board-health-strip" aria-label="Board health">
      <div>
        <p class="eyebrow">Board health</p>
        <strong>${tasks.length} visible cards</strong>
      </div>
      <span class="status-pill ${stats.overWip ? "inbox-red" : "inbox-green"}">${stats.overWip} over WIP</span>
      <span class="status-pill ${stats.blocked ? "inbox-red" : "inbox-green"}">${stats.blocked} blocked</span>
      <span class="status-pill ${stats.overdue ? "inbox-red" : "inbox-green"}">${stats.overdue} overdue</span>
      <span class="status-pill ${stats.stale ? "inbox-amber" : "inbox-green"}">${stats.stale} stale</span>
      <span class="status-pill ${stats.unowned ? "inbox-amber" : "inbox-green"}">${stats.unowned} unowned</span>
      <span class="status-pill inbox-blue">${stats.review} in review</span>
      ${undo ? `<button class="button button-secondary compact-button" type="button" data-board-undo>Undo ${escapeHtml(undo.label || "last action")}</button>` : ""}
    </section>
  `;
}

function renderBoardMobileTabs(columns) {
  const board = normalizeWorkspaceBoard(state.workspace.board);
  return `
    <div class="board-mobile-tabs" role="tablist" aria-label="Board columns">
      ${columns.map((column) => `
        <button class="compact-button ${board.mobileColumn === column.id ? "is-active" : ""}" type="button" data-board-mobile-column="${column.id}" role="tab" aria-selected="${board.mobileColumn === column.id ? "true" : "false"}">
          ${escapeHtml(column.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderBoardColumnMenu(column) {
  if (openBoardMenuColumn !== column.id) return "";
  const columns = boardStatusOptions();
  const nextColumn = columns[columns.findIndex((item) => item.id === column.id) + 1];
  return `
    <div class="board-column-menu" role="menu">
      <button type="button" data-board-menu-action="add" data-board-menu-column="${column.id}">Add card</button>
      <button type="button" data-board-menu-action="rename" data-board-menu-column="${column.id}">Rename column</button>
      <button type="button" data-board-menu-action="wip" data-board-menu-column="${column.id}">Set WIP limit</button>
      <button type="button" data-board-menu-action="collapse" data-board-menu-column="${column.id}">Collapse column</button>
      ${nextColumn ? `<button type="button" data-board-menu-action="move-all" data-board-menu-column="${column.id}" data-board-menu-target="${nextColumn.id}">Move all to ${escapeHtml(nextColumn.label)}</button>` : ""}
      ${column.id === "done" ? `<button type="button" data-board-menu-action="archive" data-board-menu-column="${column.id}">Archive visible cards</button>` : ""}
    </div>
  `;
}

function renderBoardAutomationBuilder() {
  const boardAutomations = state.automations.filter((automation) => ["board_card_moved", "board_card_added", "board_review_ready"].includes(automation.triggerKind));
  return `
    <div class="board-automation-builder">
      <div>
        <p class="eyebrow">Board automation builder</p>
        <strong>${boardAutomations.length} board rule${boardAutomations.length === 1 ? "" : "s"}</strong>
      </div>
      <label>
        <span>When</span>
        <select id="board-automation-trigger">
          ${["board_card_moved", "board_review_ready", "board_card_added"].map((id) => `<option value="${id}">${escapeHtml(automationTriggerLabel(id))}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Filter</span>
        <select id="board-automation-condition">
          ${["any", "status", "project", "assignee", "company", "priority", "tag"].map((id) => `<option value="${id}">${escapeHtml(automationConditionOptions.find((option) => option.id === id)?.label || id)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Value</span>
        <input id="board-automation-condition-value" placeholder="Review, Acme, high, launch">
      </label>
      <label>
        <span>Then</span>
        <select id="board-automation-action">
          ${["assign_owner", "set_priority", "add_tag", "create_task", "schedule_reminder", "notify_channel", "draft_update"].map((id) => `<option value="${id}">${escapeHtml(automationActionLabel(id))}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Target</span>
        <input id="board-automation-target" placeholder="Nina, high, client-ready">
      </label>
      <button class="button button-primary compact-button" type="button" data-board-automation-save>Save Rule</button>
      <button class="button button-secondary compact-button" type="button" data-board-automation-preset="review">Review preset</button>
      <button class="button button-secondary compact-button" type="button" data-board-automation-preset="quick-add">Quick-add preset</button>
    </div>
  `;
}

function renderBoardTemplatePanel() {
  const projectId = boardQuickAddProjectId();
  return `
    <div class="board-template-panel">
      <div>
        <p class="eyebrow">Card templates</p>
        <strong>${state.taskTemplates.length} saved templates</strong>
      </div>
      <label>
        <span>Task template</span>
        <select id="board-task-template" ${state.taskTemplates.length ? "" : "disabled"}>
          ${state.taskTemplates.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Column</span>
        <select id="board-template-status">
          ${boardStatusOptions().map((status) => `<option value="${status.id}">${escapeHtml(status.label)}</option>`).join("")}
        </select>
      </label>
      <button class="button button-primary compact-button" type="button" data-board-template-create ${state.taskTemplates.length && projectId ? "" : "disabled"}>Create From Template</button>
      <div class="board-recipe-list" aria-label="Checklist recipes">
        <span>Checklist recipes</span>
        ${boardCardRecipes.map((recipe) => `<button class="button button-secondary compact-button" type="button" data-board-recipe="${recipe.id}" ${projectId ? "" : "disabled"}>${escapeHtml(recipe.name)}</button>`).join("")}
      </div>
    </div>
  `;
}

function renderBoardBacklogPanel(tasks = []) {
  const backlogTasks = tasks.filter(isBoardBacklogTask);
  const readyTasks = backlogTasks.filter((task) => !isTaskBlocked(task) && (!task.dueDate || !isOverdue(task))).slice(0, 6);
  return `
    <section class="panel board-backlog-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Backlog / Triage</p>
          <h2>${backlogTasks.length} groomed ${backlogTasks.length === 1 ? "card" : "cards"}</h2>
        </div>
        <span class="status-pill inbox-blue">${readyTasks.length} ready</span>
      </div>
      <form class="board-backlog-composer" data-board-backlog-create>
        <input name="title" placeholder="Capture a backlog card before it hits the active board" aria-label="Backlog card title">
        <button class="button button-secondary compact-button" type="submit">Add Backlog</button>
      </form>
      <div class="board-backlog-list">
        ${backlogTasks.length ? backlogTasks.slice(0, 8).map((task) => `
          <article class="board-backlog-item">
            <div>
              <strong>${escapeHtml(task.title)}</strong>
              <span>${escapeHtml(projectName(task.projectId))} / ${priorityLabel(task.priority)}${task.dueDate ? ` / ${formatDate(task.dueDate)}` : ""}</span>
            </div>
            <div>
              <button class="button button-primary compact-button" type="button" data-board-promote="${task.id}">Promote</button>
              <button class="button button-secondary compact-button" type="button" data-edit-task="${task.id}">Open</button>
            </div>
          </article>
        `).join("") : emptyState("No backlog cards yet. Capture uncertain work here before it reaches the active board.")}
      </div>
    </section>
  `;
}

function boardFlowAnalytics(tasks = []) {
  const activeTasks = boardActiveTasks(tasks);
  const openTasks = activeTasks.filter((task) => task.status !== "done");
  const doneThisWeek = activeTasks.filter((task) => task.status === "done" && daysBetween((task.updatedAt || task.createdAt || todayKey()).slice(0, 10), todayKey()) <= 7);
  const activeAges = openTasks.map((task) => daysBetween((task.createdAt || task.updatedAt || todayKey()).slice(0, 10), todayKey()));
  const staleAges = openTasks.map((task) => daysBetween((task.updatedAt || task.createdAt || todayKey()).slice(0, 10), todayKey()));
  const avgAge = activeAges.length ? Math.round(activeAges.reduce((total, age) => total + age, 0) / activeAges.length) : 0;
  const agingWip = activeAges.filter((age) => age >= 14).length;
  const blocked = openTasks.filter(isTaskBlocked).length;
  const overdue = openTasks.filter(isOverdue).length;
  const stale = staleAges.filter((age) => age >= 7).length;
  const columns = boardColumns().map((column) => {
    const columnTasks = activeTasks.filter((task) => task.status === column.id);
    return {
      ...column,
      count: columnTasks.length,
      blocked: columnTasks.filter(isTaskBlocked).length,
      aging: columnTasks.filter((task) => daysBetween((task.createdAt || task.updatedAt || todayKey()).slice(0, 10), todayKey()) >= 14).length
    };
  });
  const bottleneck = columns
    .filter((column) => column.id !== "done")
    .sort((a, b) => {
      const aPressure = a.wipLimit ? a.count / a.wipLimit : a.count;
      const bPressure = b.wipLimit ? b.count / b.wipLimit : b.count;
      return bPressure - aPressure || b.blocked - a.blocked || b.aging - a.aging;
    })[0];
  return {
    throughput: doneThisWeek.length,
    avgAge,
    agingWip,
    blocked,
    overdue,
    stale,
    bottleneck
  };
}

function renderBoardFlowAnalytics(tasks = []) {
  const flow = boardFlowAnalytics(tasks);
  return `
    <section class="board-flow-panel" aria-label="Flow analytics">
      <div>
        <p class="eyebrow">Flow analytics</p>
        <strong>${flow.bottleneck?.label || "No"} bottleneck</strong>
        <span>${flow.bottleneck ? `${flow.bottleneck.count} cards / ${flow.bottleneck.blocked} blocked / ${flow.bottleneck.aging} aging` : "No active bottleneck detected"}</span>
      </div>
      <article>
        <span>Throughput</span>
        <strong>${flow.throughput}</strong>
        <small>done this week</small>
      </article>
      <article>
        <span>Avg age</span>
        <strong>${flow.avgAge}d</strong>
        <small>open WIP</small>
      </article>
      <article>
        <span>Aging WIP</span>
        <strong>${flow.agingWip}</strong>
        <small>14d+</small>
      </article>
      <article>
        <span>Blocked time</span>
        <strong>${flow.blocked}</strong>
        <small>blocked cards</small>
      </article>
      <article>
        <span>Risk</span>
        <strong>${flow.overdue + flow.stale}</strong>
        <small>overdue/stale</small>
      </article>
    </section>
  `;
}

function renderBoardControls() {
  const board = normalizeWorkspaceBoard(state.workspace.board);
  const boardViews = state.savedViews.filter((view) => view.route === "board");
  const currentBoardView = currentSavedViewId();
  return `
    <section class="panel board-control-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Kanban controls</p>
          <h2>Board system</h2>
        </div>
        <span class="status-pill inbox-blue">${board.columns.filter((column) => column.wipLimit).length} WIP limits</span>
      </div>
      ${renderBoardAutomationBuilder()}
      ${renderBoardTemplatePanel()}
      <div class="board-view-row">
        <label>
          <span>Saved board views</span>
          <select id="board-view-select">
            <option value="">Custom board view</option>
            ${boardViews.map((view) => `<option value="${view.id}" ${view.id === currentBoardView ? "selected" : ""}>${view.pinned ? "Pinned - " : ""}${escapeHtml(view.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>View name</span>
          <input id="board-view-name" placeholder="Standup, Client review, Ops">
        </label>
        <button class="button button-secondary compact-button" type="button" data-board-save-view>Save View</button>
        <button class="button button-secondary compact-button" type="button" data-board-delete-view="${escapeHtml(currentBoardView)}" ${currentBoardView ? "" : "disabled"}>Forget View</button>
      </div>
      <div class="board-control-grid">
        <label>
          <span>Workflow</span>
          <select id="board-template">
            <option value="">Custom board</option>
            ${boardWorkflowTemplates.map((template) => `<option value="${template.id}">${escapeHtml(template.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Advanced Swimlanes</span>
          <select id="board-swimlane">
            ${[
              ["none", "No swimlanes"],
              ["assignee", "By assignee"],
              ["priority", "By priority"],
              ["company", "By company"],
              ["blocked", "Blocked vs flowing"],
              ["overdue", "Overdue vs on track"],
              ["stale", "Needs movement"],
              ["review", "Review queue"],
              ["client", "Client-visible"],
              ["tag", "Specific tag"]
            ].map(([id, label]) => `<option value="${id}" ${board.swimlane === id ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Lane tag</span>
          <input value="${escapeHtml(board.swimlaneValue)}" placeholder="launch, client, bug" data-board-swimlane-value>
        </label>
        <label>
          <span>Sort</span>
          <select id="board-sort">
            ${[
              ["manual", "Manual order"],
              ["due", "Due date"],
              ["priority", "Priority"]
            ].map(([id, label]) => `<option value="${id}" ${board.sort === id ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Density</span>
          <select id="board-density">
            ${[
              ["comfortable", "Comfortable"],
              ["compact", "Compact"],
              ["minimal", "Minimal"]
            ].map(([id, label]) => `<option value="${id}" ${board.density === id ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        ${board.columns.map((column) => `
          <label>
            <span>${escapeHtml(column.label)} WIP</span>
            <input type="number" min="0" max="99" value="${column.wipLimit}" data-board-wip="${column.id}">
          </label>
        `).join("")}
      </div>
      <div class="board-card-toggle-row" aria-label="Card detail toggles">
        ${Object.entries({
          description: "Descriptions",
          meta: "Meta",
          signals: "Signals",
          tags: "Tags",
          actions: "Actions"
        }).map(([field, labelText]) => `
          <label>
            <input type="checkbox" data-board-card-field="${field}" ${board.cardFields[field] ? "checked" : ""}>
            <span>${labelText}</span>
          </label>
        `).join("")}
      </div>
      <div class="board-label-grid">
        ${board.columns.map((column) => `
          <label>
            <span>${escapeHtml(statuses.find((status) => status.id === column.id)?.label || column.id)}</span>
            <input value="${escapeHtml(column.label)}" maxlength="32" data-board-label="${column.id}">
          </label>
        `).join("")}
      </div>
    </section>
  `;
}

function renderBoardColumn(column, tasks) {
  const columnTasks = boardOrderedTasks(tasks.filter((task) => task.status === column.id));
  const overLimit = column.wipLimit > 0 && columnTasks.length > column.wipLimit;
  const atLimit = column.wipLimit > 0 && columnTasks.length === column.wipLimit;
  const board = normalizeWorkspaceBoard(state.workspace.board);
  const collapsed = board.collapsed.includes(column.id);
  return `
    <section class="board-column ${overLimit ? "is-over-wip" : atLimit ? "is-at-wip" : ""} ${collapsed ? "is-collapsed" : ""} ${board.mobileColumn === column.id ? "is-mobile-active" : ""}" data-status="${column.id}">
      <div class="board-column-header">
        <div>
          <h2>${escapeHtml(column.label)}</h2>
          ${column.wipLimit ? `<small>WIP ${columnTasks.length}/${column.wipLimit}</small>` : `<small>${columnTasks.length} task${columnTasks.length === 1 ? "" : "s"}</small>`}
        </div>
        <div class="board-column-actions">
          <span>${columnTasks.length}</span>
          <button class="icon-button compact-button" type="button" data-board-menu="${column.id}" aria-label="Open ${escapeHtml(column.label)} column menu">&hellip;</button>
          <button class="icon-button compact-button" type="button" data-board-collapse="${column.id}" aria-label="${collapsed ? "Expand" : "Collapse"} ${escapeHtml(column.label)}">${collapsed ? "+" : "-"}</button>
        </div>
      </div>
      ${renderBoardColumnMenu(column)}
      ${collapsed ? "" : `
        <form class="board-quick-add" data-board-quick-add="${column.id}">
          <input name="title" placeholder="Add a card to ${escapeHtml(column.label)}" aria-label="Add a card to ${escapeHtml(column.label)}">
          <button class="button button-secondary compact-button" type="submit">Add</button>
        </form>
        <div class="task-stack" data-drop-status="${column.id}">
          ${columnTasks.length ? columnTasks.map(renderTaskCard).join("") : emptyState("No tasks here.", [
            { label: "Add a card", commandId: "create:task", detail: "Use the quick-add field above to capture the next piece of work for this lane." },
            { label: "Import Tasks", commandId: "migration:open" },
            { label: "Load Sample", onboardingAction: "sample:agency" }
          ])}
        </div>
      `}
    </section>
  `;
}

function renderKanbanBoard(tasks, { controls = false, label = "Task board" } = {}) {
  const board = normalizeWorkspaceBoard(state.workspace.board);
  const columns = board.columns.filter((column) => column.enabled && (board.showDone || column.id !== "done"));
  const activeBoardTasks = boardActiveTasks(tasks);
  const groups = boardSwimlaneGroups(activeBoardTasks);
  const boardMarkup = groups.map((group) => `
    <section class="board-swimlane" data-board-lane="${escapeHtml(group.id)}">
      ${board.swimlane === "none" ? "" : `
        <div class="board-swimlane-header">
          <h2>${escapeHtml(group.label)}</h2>
          <span>${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"}</span>
        </div>
      `}
      <div class="board board-density-${escapeHtml(board.density)}" aria-label="${escapeHtml(label)}${board.swimlane === "none" ? "" : ` - ${escapeHtml(group.label)}`}">
        ${columns.map((column) => renderBoardColumn(column, group.tasks)).join("")}
      </div>
    </section>
  `).join("");
  return `${controls ? `${renderBoardControls()}${renderBoardBacklogPanel(tasks)}${renderBoardFlowAnalytics(activeBoardTasks)}${renderBoardHealthStrip(activeBoardTasks)}${renderBoardMobileTabs(columns)}` : ""}${boardMarkup}`;
}

function renderProjectBoard(tasks) {
  return renderKanbanBoard(tasks, { label: "Project task board" });
}

function renderProjectTimeline(project, tasks, milestones) {
  const datedTasks = tasks.filter((task) => task.dueDate);
  const undatedTasks = tasks.filter((task) => !task.dueDate);
  const criticalTasks = tasks.filter((task) => ganttTaskRisk(task).critical);
  const slippedTasks = tasks.filter((task) => ganttTaskRisk(task).slipped);
  const blockedTasks = tasks.filter((task) => openTaskDependencies(task).length);
  const gantt = renderProjectGantt(project, tasks, milestones);
  const timelineItems = [
    project.startDate ? {
      id: `${project.id}-start`,
      type: "project",
      label: "Project start",
      title: project.name,
      date: project.startDate,
      description: "Planned project kickoff."
    } : null,
    ...milestones.filter((milestone) => milestone.dueDate).map((milestone) => ({
      id: milestone.id,
      type: "milestone",
      label: "Milestone",
      title: milestone.title,
      date: milestone.dueDate,
      description: milestone.description,
      status: milestone.status
    })),
    ...datedTasks.map((task) => ({
      id: task.id,
      type: "task",
      label: "Task due",
      title: task.title,
      date: task.dueDate,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee
    })),
    project.dueDate ? {
      id: `${project.id}-end`,
      type: "project",
      label: "Project due",
      title: project.name,
      date: project.dueDate,
      description: "Target project completion."
    } : null
  ].filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Plan</p>
          <h2>Timeline</h2>
        </div>
        <div class="panel-actions">
          <button class="button button-secondary compact-button" type="button" data-export-timeline="markdown" data-project-id="${project.id}">Export Markdown</button>
          <button class="button button-secondary compact-button" type="button" data-export-timeline="json" data-project-id="${project.id}">Export JSON</button>
        </div>
      </div>

      ${renderAcmePathGuide({
        step: "4 of 6",
        title: "Spot delivery risk before writing the client update.",
        detail: `${criticalTasks.length} critical path item${criticalTasks.length === 1 ? "" : "s"}, ${slippedTasks.length} slipped item${slippedTasks.length === 1 ? "" : "s"}, and ${blockedTasks.length} dependency risk${blockedTasks.length === 1 ? "" : "s"} are visible in this plan.`,
        proof: "A tester should be able to explain schedule risk without understanding the whole data model.",
        nextLabel: "Draft client update",
        nextRoute: "reports"
      })}

      <div class="timeline-controls">
        <label>
          <span>Project start</span>
          <input type="date" value="${project.startDate || ""}" data-project-date="startDate" data-project-id="${project.id}">
        </label>
        <label>
          <span>Project due</span>
          <input type="date" value="${project.dueDate || ""}" data-project-date="dueDate" data-project-id="${project.id}">
        </label>
      </div>

      <form class="timeline-milestone-composer" data-timeline-milestone-create="${project.id}">
        <label>
          <span>Milestone</span>
          <input name="title" placeholder="Design signoff, Beta launch, Client approval">
        </label>
        <label>
          <span>Date</span>
          <input name="dueDate" type="date" value="${project.dueDate || todayKey()}">
        </label>
        <label>
          <span>Status</span>
          <select name="status">
            ${["planned", "at-risk", "completed"].map((status) => `<option value="${status}">${status.replace("-", " ")}</option>`).join("")}
          </select>
        </label>
        <button class="button button-secondary compact-button" type="submit">Add Milestone</button>
      </form>

      ${renderTimelineWorkloadWarnings(project, tasks)}
      ${gantt}

      <div class="timeline-list">
        ${timelineItems.length ? timelineItems.map(renderTimelineItem).join("") : starterEmptyState("timeline", {
          message: "Add dates to tasks or milestones to build this timeline.",
          actions: [
            { label: "Add Milestone", projectTab: "timeline", detail: "Create a dated milestone above, or add due dates to project tasks." },
            { label: "Open Tasks", projectTab: "tasks" },
            { label: "Load Software Sample", onboardingAction: "sample:software" }
          ]
        })}
      </div>

      ${undatedTasks.length ? `
        <div class="undated-panel">
          <div>
            <p class="eyebrow">Unscheduled</p>
            <h3>No-date tasks</h3>
          </div>
          <div class="undated-list">
            ${undatedTasks.map(renderUndatedTask).join("")}
          </div>
        </div>
      ` : ""}
    </section>
  `;
}

function ganttZoomWindow(rangeStart, rangeEnd) {
  const zoom = ["week", "month", "quarter"].includes(state.selectedGanttZoom) ? state.selectedGanttZoom : "month";
  const minDays = { week: 7, month: 30, quarter: 90 }[zoom];
  const actualDays = Math.max(1, daysBetween(rangeStart, rangeEnd));
  const totalDays = Math.max(minDays, actualDays);
  return {
    zoom,
    rangeStart,
    rangeEnd: totalDays === actualDays ? rangeEnd : shiftDate(rangeStart, totalDays),
    totalDays
  };
}

function ganttTaskSchedule(task, rangeStart, totalDays) {
  const start = taskStartDate(task);
  const end = task.dueDate || start;
  const offset = Math.max(0, daysBetween(rangeStart, start));
  const duration = Math.max(1, daysBetween(start, end) + 1);
  const left = Math.min(100, (offset / totalDays) * 100);
  const width = Math.max(4, Math.min(100 - left, (duration / totalDays) * 100));
  return { start, end, left, width, duration };
}

function ganttTaskBaseline(task) {
  const baselineStart = task.customFields?.baselineStart || "";
  const baselineDue = task.customFields?.baselineDue || "";
  if (!baselineStart || !baselineDue) return null;
  const startDelta = daysBetween(baselineStart, taskStartDate(task));
  const dueDelta = daysBetween(baselineDue, task.dueDate || taskStartDate(task));
  return { baselineStart, baselineDue, startDelta, dueDelta };
}

function renderGanttBaseline(task, rangeStart, totalDays) {
  const baseline = ganttTaskBaseline(task);
  if (!baseline) return "";
  const schedule = ganttTaskSchedule({
    ...task,
    startDate: baseline.baselineStart,
    dueDate: baseline.baselineDue
  }, rangeStart, totalDays);
  const drift = baseline.dueDelta;
  return `
    <span class="gantt-baseline" style="left: ${schedule.left}%; width: ${schedule.width}%;" title="Baseline ${escapeHtml(formatDate(baseline.baselineStart))} - ${escapeHtml(formatDate(baseline.baselineDue))}"></span>
    <span class="gantt-baseline-delta ${drift > 0 ? "is-late" : drift < 0 ? "is-early" : ""}">
      ${drift === 0 ? "On baseline" : `${Math.abs(drift)}d ${drift > 0 ? "late" : "early"}`}
    </span>
  `;
}

function ganttTaskRisk(task) {
  const openDependencies = openTaskDependencies(task);
  const slipped = task.dueDate && isOverdue(task) && task.status !== "done";
  const critical = slipped || openDependencies.length || task.priority === "urgent" || task.priority === "high";
  return {
    openDependencies,
    slipped,
    critical,
    label: slipped ? "Slipped path" : critical ? "Critical path" : "On track"
  };
}

function ganttDependencyConnectors(tasks, rangeStart, totalDays) {
  const rowIndex = new Map(tasks.map((task, index) => [task.id, index]));
  return tasks.flatMap((task) => taskDependencies(task).map((dependency) => {
    if (!rowIndex.has(dependency.id)) return null;
    const from = ganttTaskSchedule(dependency, rangeStart, totalDays);
    const to = ganttTaskSchedule(task, rangeStart, totalDays);
    const fromRow = rowIndex.get(dependency.id);
    const toRow = rowIndex.get(task.id);
    const top = Math.min(fromRow, toRow) * 92 + 46;
    const height = Math.max(12, Math.abs(toRow - fromRow) * 92);
    const left = Math.min(96, Math.max(0, from.left + from.width));
    const width = Math.max(4, Math.min(100 - left, to.left - left));
    return {
      id: `${dependency.id}-${task.id}`,
      top,
      height,
      left,
      width,
      blocked: openTaskDependencies(task).some((item) => item.id === dependency.id)
    };
  }).filter(Boolean));
}

function renderGanttInsights(tasks) {
  const critical = tasks.filter((task) => ganttTaskRisk(task).critical);
  const slipped = tasks.filter((task) => ganttTaskRisk(task).slipped);
  const blocked = tasks.filter((task) => openTaskDependencies(task).length);
  const latest = [...tasks].sort((a, b) => String(b.dueDate || "").localeCompare(String(a.dueDate || "")))[0];
  return `
    <div class="gantt-insights" aria-label="Critical path insights">
      <article><span>Critical path</span><strong>${critical.length}</strong><small>high-risk scheduled tasks</small></article>
      <article><span>Slipped path</span><strong>${slipped.length}</strong><small>overdue scheduled tasks</small></article>
      <article><span>Dependency risk</span><strong>${blocked.length}</strong><small>waiting on open work</small></article>
      <article><span>Final scheduled finish</span><strong>${latest ? formatDate(latest.dueDate) : "None"}</strong><small>${latest ? escapeHtml(latest.title) : "No scheduled tasks"}</small></article>
    </div>
  `;
}

function renderGanttZoomControls() {
  return `
    <div class="gantt-zoom-controls" aria-label="Gantt zoom controls">
      ${[
        ["week", "Week"],
        ["month", "Month"],
        ["quarter", "Quarter"]
      ].map(([id, label]) => `<button class="compact-button ${state.selectedGanttZoom === id ? "is-active" : ""}" type="button" data-gantt-zoom="${id}">${label}</button>`).join("")}
    </div>
  `;
}

function renderProjectGantt(project, tasks, milestones) {
  const scheduledTasks = tasks.filter((task) => task.dueDate);
  if (!scheduledTasks.length) return starterEmptyState("timeline", {
    message: "Add task start and due dates to build a Gantt chart.",
    detail: "A useful Gantt starts with at least one task that has start and due dates.",
    actions: [
      { label: "Open Tasks", projectTab: "tasks" },
      { label: "Add Milestone", projectTab: "timeline" },
      { label: "Load Software Sample", onboardingAction: "sample:software" }
    ]
  });

  const dates = [
    project.startDate,
    project.dueDate,
    ...scheduledTasks.flatMap((task) => [taskStartDate(task), task.dueDate]),
    ...milestones.map((milestone) => milestone.dueDate)
  ].filter(Boolean).sort();
  const zoomWindow = ganttZoomWindow(dates[0], dates[dates.length - 1]);
  const rangeStart = zoomWindow.rangeStart;
  const rangeEnd = zoomWindow.rangeEnd;
  const totalDays = zoomWindow.totalDays;
  const ticks = Array.from({ length: 5 }, (_, index) => shiftDate(rangeStart, Math.round((totalDays * index) / 4)));
  const visibleMilestones = milestones.filter((milestone) => milestone.dueDate);
  const orderedTasks = scheduledTasks.sort((a, b) => taskStartDate(a).localeCompare(taskStartDate(b)));
  const connectors = ganttDependencyConnectors(orderedTasks, rangeStart, totalDays);

  return `
    <section class="gantt-panel" aria-label="Project Gantt schedule">
      <div class="gantt-header">
        <div>
          <p class="eyebrow">Gantt</p>
          <h3>Schedule and dependencies</h3>
        </div>
        <div class="meta-row">
          <span>${formatDate(rangeStart)} - ${formatDate(rangeEnd)}</span>
          <span>${scheduledTasks.filter(isTaskBlocked).length} blocked</span>
        </div>
      </div>
      ${renderGanttZoomControls()}
      ${renderGanttInsights(scheduledTasks)}
      <div class="gantt-scale" aria-hidden="true">
        <span></span>
        <div>
          ${ticks.map((tick) => `<span>${formatDate(tick)}</span>`).join("")}
        </div>
      </div>
      <div class="gantt-list" data-gantt-start="${rangeStart}" data-gantt-total-days="${totalDays}">
        <div class="gantt-connectors" aria-hidden="true">
          ${connectors.map((connector) => `
            <span class="gantt-connector ${connector.blocked ? "is-blocked" : ""}" style="top: ${connector.top}px; left: ${connector.left}%; width: ${connector.width}%; height: ${connector.height}px;"></span>
          `).join("")}
        </div>
        ${orderedTasks.map((task) => renderGanttTaskRow(task, rangeStart, totalDays, visibleMilestones)).join("")}
      </div>
    </section>
  `;
}

function renderGanttTaskRow(task, rangeStart, totalDays, milestones) {
  const { start, end, left, width } = ganttTaskSchedule(task, rangeStart, totalDays);
  const dependencies = taskDependencies(task);
  const risk = ganttTaskRisk(task);
  const openDependencies = risk.openDependencies;

  return `
    <article class="gantt-row ${openDependencies.length ? "is-blocked" : ""} ${risk.critical ? "is-critical" : ""} ${risk.slipped ? "is-slipped" : ""}">
      <div class="gantt-label">
        <button class="table-task-button" type="button" data-edit-task="${task.id}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${memberName(task.assignee)} - ${statusLabel(task.status)} - ${risk.label}</span>
        </button>
        <div class="gantt-date-controls">
          <input type="date" value="${start}" data-task-start="${task.id}" aria-label="Change task start date">
          <input type="date" value="${end}" data-task-date="${task.id}" aria-label="Change task due date">
        </div>
      </div>
      <div class="gantt-track">
        ${milestones.map((milestone) => {
          const markerLeft = Math.min(100, Math.max(0, (daysBetween(rangeStart, milestone.dueDate) / totalDays) * 100));
          return `<span class="gantt-marker" style="left: ${markerLeft}%" title="${escapeHtml(milestone.title)}"></span>`;
        }).join("")}
        ${renderGanttBaseline(task, rangeStart, totalDays)}
        <span class="gantt-bar priority-${task.priority}" draggable="true" data-gantt-drag="${task.id}" style="left: ${left}%; width: ${width}%;">
          <button type="button" data-gantt-shift="${task.id}" data-gantt-shift-days="-1" aria-label="Move ${escapeHtml(task.title)} one day earlier">&lsaquo;</button>
          <span>${formatDate(start)} - ${formatDate(end)}</span>
          <button type="button" data-gantt-shift="${task.id}" data-gantt-shift-days="1" aria-label="Move ${escapeHtml(task.title)} one day later">&rsaquo;</button>
        </span>
      </div>
      <div class="gantt-dependencies">
        ${dependencies.length ? `Waits on ${dependencies.map((dependency) => escapeHtml(dependency.title)).join(", ")}` : "No blockers"}
        ${openDependencies.length ? `<strong>${openDependencies.length} open</strong>` : ""}
        <button class="button button-secondary compact-button" type="button" data-gantt-baseline="${task.id}">${ganttTaskBaseline(task) ? "Reset baseline" : "Set baseline"}</button>
      </div>
    </article>
  `;
}

function renderTimelineItem(item) {
  const isPast = parseDateValue(item.date) && parseDateValue(item.date) < new Date() && item.status !== "done";
  const detail = item.type === "task"
    ? `${memberName(item.assignee)} - ${priorityLabel(item.priority)} - ${statusLabel(item.status)}`
    : item.type === "milestone"
      ? item.status.replace("-", " ")
      : item.description;

  return `
    <article class="timeline-item timeline-${item.type} ${isPast ? "is-late" : ""}">
      <div class="timeline-date">
        <strong>${formatDate(item.date)}</strong>
        <span>${item.label}</span>
      </div>
      <div class="timeline-marker" aria-hidden="true"></div>
      <div class="timeline-card">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <div class="meta-row">
            <span>${escapeHtml(detail)}</span>
            ${isPast ? "<span class=\"is-overdue\">Past due</span>" : ""}
          </div>
        </div>
        ${item.type === "task" ? `<input class="timeline-date-input" type="date" value="${item.date}" data-task-date="${item.id}" aria-label="Change task due date">` : ""}
        ${item.type === "milestone" ? `<input class="timeline-date-input" type="date" value="${item.date}" data-milestone-date="${item.id}" aria-label="Change milestone due date">` : ""}
      </div>
    </article>
  `;
}

function renderUndatedTask(task) {
  return `
    <article class="undated-task">
      <button class="table-task-button" type="button" data-edit-task="${task.id}">
        <strong>${escapeHtml(task.title)}</strong>
        <span>${memberName(task.assignee)} - ${priorityLabel(task.priority)}</span>
      </button>
      <input class="timeline-date-input" type="date" data-task-date="${task.id}" aria-label="Add task due date">
    </article>
  `;
}

function renderProjectMilestones(milestones) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Plan</p>
          <h2>Milestones</h2>
        </div>
      </div>
      <div class="milestone-list">
        ${milestones.length ? milestones.map(renderMilestoneCard).join("") : emptyState("No milestones have been planned for this project.", { label: "Open Timeline", projectTab: "timeline", detail: "Add launch, review, approval, and delivery dates from the timeline composer." })}
      </div>
    </section>
  `;
}

function renderMilestoneCard(milestone) {
  const progress = milestoneProgress(milestone);
  const linkedTasks = milestone.taskIds.map((taskId) => byId(state.tasks, taskId)).filter(Boolean);
  return `
    <article class="milestone-card">
      <div class="milestone-main">
        <div>
          <span class="status-pill status-${milestone.status}">${escapeHtml(milestone.status.replace("-", " "))}</span>
          <h3>${escapeHtml(milestone.title)}</h3>
          <p>${escapeHtml(milestone.description)}</p>
        </div>
        <div class="meta-row">
          <span>${memberName(milestone.owner)}</span>
          <span>Due ${formatDate(milestone.dueDate)}</span>
          <span>${linkedTasks.length} linked ${linkedTasks.length === 1 ? "task" : "tasks"}</span>
        </div>
      </div>
      <div class="progress-block" aria-label="${progress}% complete">
        <strong>${progress}%</strong>
        <span class="progress-track"><span style="width: ${progress}%"></span></span>
      </div>
    </article>
  `;
}

function renderActivityList(activities) {
  if (!activities.length) return emptyState("No activity has been recorded yet.");

  return `
    <div class="activity-list">
      ${activities.map((activity) => `
        <article class="activity-item">
          <span class="avatar">${memberName(activity.memberId).split(" ").map((part) => part[0]).join("")}</span>
          <div>
            <p><strong>${memberName(activity.memberId)}</strong> ${escapeHtml(activity.message)}</p>
            <small>${formatTimestamp(activity.createdAt)}</small>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function taskRealtimeSummary(taskId) {
  const comments = getTaskComments(taskId);
  const activities = getTaskActivity(taskId, 1);
  const latestComment = comments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const latestActivity = activities[0];
  const latestTimestamp = [latestComment?.createdAt, latestActivity?.createdAt, realtimeLastChangedAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];
  return {
    label: realtimeStatusLabel(),
    detail: latestTimestamp ? `Latest change ${formatTimestamp(latestTimestamp)}` : "Waiting for live workspace changes"
  };
}

function renderTaskDetailSummary(task = null) {
  const container = document.querySelector("#task-detail-summary");
  if (!container) return;
  const project = task ? byId(state.projects, task.projectId) : null;
  const comments = task ? openCommentCount(task.id) : 0;
  const timeMinutes = task ? sumMinutes(getTaskTimeEntries(task.id)) : 0;
  const dependencies = task ? openTaskDependencies(task).length : 0;
  const downstream = task ? tasksBlockedBy(task.id).length : 0;
  const visibility = task ? taskVisibility(task) : "internal";
  const dueText = task?.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date";
  const healthTone = task && isOverdue(task) ? "inbox-red" : dependencies ? "inbox-amber" : "inbox-green";

  container.innerHTML = `
    <div class="task-record-strip">
      <div>
        <p class="eyebrow">Task record</p>
        <strong>${escapeHtml(task?.title || "Draft task")}</strong>
        <span>${escapeHtml(project?.name || "Choose a project")} / ${task ? memberName(task.assignee) : "Assign owner"} / ${dueText}</span>
      </div>
      <span class="status-pill ${healthTone}">${task ? statusLabel(task.status) : "Draft"}</span>
      <span class="status-pill inbox-neutral">${task ? priorityLabel(task.priority) : "Priority"}</span>
      <span class="status-pill ${dependencies ? "inbox-amber" : "inbox-green"}">${dependencies} blockers</span>
      <span class="status-pill inbox-blue">${comments} open comments</span>
      <span class="status-pill inbox-neutral">${formatDuration(timeMinutes)}</span>
      <span class="status-pill ${visibility !== "internal" ? "inbox-blue" : "inbox-neutral"}">${escapeHtml(visibilityLabel(visibility))}</span>
    </div>
    <div class="task-record-actions">
      ${task ? `<button class="button button-secondary compact-button" type="button" data-task-plan-today="${task.id}">Plan Today</button>` : ""}
      ${task && task.status !== "done" ? `<button class="button button-primary compact-button" type="button" data-task-complete="${task.id}">Mark Done</button>` : ""}
      ${task ? `<button class="button button-secondary compact-button" type="button" data-project-id="${task.projectId}">Open Project</button>` : ""}
      ${downstream ? `<span>${downstream} downstream ${downstream === 1 ? "task" : "tasks"}</span>` : ""}
    </div>
  `;
}

function renderTaskCollaboration(taskId = "") {
  const container = document.querySelector("#task-collaboration");
  if (!container) return;

  if (!taskId) {
    container.innerHTML = `
      <div class="collaboration-grid">
        <section>
          <p class="eyebrow">Comments</p>
          ${emptyState("Save this task before adding comments.")}
        </section>
        <section>
          <p class="eyebrow">Activity</p>
          ${emptyState("Activity will appear after the task is saved.")}
        </section>
      </div>
    `;
    return;
  }

  const comments = getTaskComments(taskId);
  const rootComments = rootTaskComments(taskId);
  const openComments = openCommentCount(taskId);
  const activities = getTaskActivity(taskId, 5);
  const presence = collaborationPresenceForTask(taskId);
  const liveViewers = livePresenceMembers({ taskId });
  const realtime = taskRealtimeSummary(taskId);
  const watching = isWatchingTask(taskId);
  const watcherCount = taskWatchers(taskId).length;

  container.innerHTML = `
    <div class="realtime-strip ${realtimeLastError ? "has-error" : ""}">
      <span class="presence-pill ${apiSession && !realtimeLastError ? "is-live" : ""}">${escapeHtml(realtime.label)}</span>
      <small>${escapeHtml(realtime.detail)}</small>
      <button class="button button-secondary compact-button" type="button" data-toggle-watch-task="${taskId}">${watching ? "Watching" : "Watch"}</button>
      <small>${watcherCount} watcher${watcherCount === 1 ? "" : "s"}</small>
    </div>
    ${renderTaskEditLockStrip(taskId)}
    <div class="collaboration-grid">
      <section>
        <div class="collaboration-header">
          <p class="eyebrow">Comments</p>
          <span>${openComments}/${comments.length}</span>
        </div>
        ${liveViewers.length ? `
          <div class="live-viewer-row" aria-label="Viewing this task now">
            ${liveViewers.map(({ member, presence: viewerPresence }) => `
              <span class="presence-pill is-live"><span class="avatar">${member.name.split(" ").map((part) => part[0]).join("")}</span>${escapeHtml(member.name)} now</span>
              <small>${escapeHtml(viewerPresence.viewing)}</small>
            `).join("")}
          </div>
        ` : ""}
        <div class="presence-row" aria-label="Collaborators">
          ${presence.map((member) => `<span class="presence-pill"><span class="avatar">${member.name.split(" ").map((part) => part[0]).join("")}</span>${escapeHtml(member.name)}</span>`).join("")}
        </div>
        <div class="comment-list">
          ${rootComments.length ? rootComments.map((comment) => renderComment(comment)).join("") : emptyState("No comments yet.")}
        </div>
        <div class="comment-composer">
          <div class="comment-composer-options">
            <label>
              <span>Type</span>
              <select id="comment-kind">
                <option value="comment">Comment</option>
                <option value="question">Question</option>
                <option value="decision">Decision</option>
              </select>
            </label>
            <label>
              <span>Reply to</span>
              <select id="comment-parent">
                <option value="">New thread</option>
                ${rootComments.map((comment) => `<option value="${comment.id}">${escapeHtml(`${memberName(comment.author)}: ${comment.body.slice(0, 42)}`)}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="mention-picker" aria-label="Mention teammates">
            ${workspaceMembers().map((member) => `
              <label>
                <input type="checkbox" data-comment-mention="${member.id}">
                <span>@${escapeHtml(member.name.split(" ")[0] || member.name)}</span>
              </label>
            `).join("")}
          </div>
          <textarea id="comment-body" rows="3" placeholder="Add a comment or @mention a teammate"></textarea>
          <button class="button button-secondary" type="button" id="comment-submit">Comment</button>
        </div>
      </section>
      <section>
        <p class="eyebrow">Activity</p>
        ${renderActivityList(activities)}
      </section>
      <section>
        <p class="eyebrow">Change history</p>
        ${renderHistoryTimeline(taskHistoryEvents(taskId), "No changes have been recorded for this task yet.")}
      </section>
    </div>
  `;
}

function renderTaskSubtasks() {
  const container = document.querySelector("#task-subtasks");
  if (!container) return;
  const doneCount = draftSubtasks.filter((subtask) => subtask.done).length;

  container.innerHTML = `
    <div class="subtask-panel">
      <div class="collaboration-header">
        <p class="eyebrow">Checklist</p>
        <span>${doneCount}/${draftSubtasks.length}</span>
      </div>
      <div class="subtask-list">
        ${draftSubtasks.length ? draftSubtasks.map(renderDraftSubtask).join("") : emptyState("No checklist items yet.")}
      </div>
      <div class="subtask-composer">
        <input id="subtask-title" placeholder="Add checklist item">
        <button class="button button-secondary" type="button" id="subtask-submit">Add Item</button>
      </div>
    </div>
  `;
}

function renderDraftSubtask(subtask) {
  return `
    <article class="subtask-item ${subtask.done ? "is-done" : ""}">
      <label>
        <input type="checkbox" data-toggle-subtask="${subtask.id}" ${subtask.done ? "checked" : ""}>
        <span>${escapeHtml(subtask.title)}</span>
      </label>
      <button class="icon-button" type="button" data-delete-subtask="${subtask.id}" aria-label="Remove checklist item">x</button>
    </article>
  `;
}

function addDraftSubtask() {
  const input = document.querySelector("#subtask-title");
  const title = input?.value.trim();
  if (!title) return;

  draftSubtasks = [...draftSubtasks, { id: uid("subtask"), title, done: false }];
  renderTaskSubtasks();
}

function toggleDraftSubtask(id, done) {
  draftSubtasks = draftSubtasks.map((subtask) => subtask.id === id ? { ...subtask, done } : subtask);
  renderTaskSubtasks();
}

function deleteDraftSubtask(id) {
  draftSubtasks = draftSubtasks.filter((subtask) => subtask.id !== id);
  renderTaskSubtasks();
}

function renderTaskTimeTracking(taskId = "") {
  const container = document.querySelector("#task-time");
  if (!container) return;

  if (!taskId) {
    container.innerHTML = `
      <div>
        <p class="eyebrow">Time tracking</p>
        ${emptyState("Save this task before logging time.")}
      </div>
    `;
    return;
  }

  const entries = getTaskTimeEntries(taskId);
  const totalMinutes = sumMinutes(entries);
  const canPickMember = canLogTimeForOthers();
  let timeMembers = canPickMember ? workspaceMembers() : workspaceMembers().filter((member) => member.id === activeMemberId());
  if (!timeMembers.length && apiSession?.user) timeMembers = [{ role: "Team", ...apiSession.user }];
  const selectedTimeMember = activeMemberId();

  container.innerHTML = `
    <div class="task-time-grid">
      <section>
        <div class="collaboration-header">
          <p class="eyebrow">Time tracking</p>
          <span>${formatDuration(totalMinutes)}</span>
        </div>
        <div class="time-entry-form">
          <label>
            <span>Employee</span>
            <select id="time-member" ${canPickMember ? "" : "disabled"}>
              ${timeMembers.map((member) => `<option value="${member.id}" ${member.id === selectedTimeMember ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input id="time-date" type="date" value="${new Date().toISOString().slice(0, 10)}">
          </label>
          <label>
            <span>Minutes</span>
            <input id="time-minutes" type="number" min="5" step="5" value="30">
          </label>
          <label class="checkbox-label">
            <input id="time-billable" type="checkbox">
            <span>Billable</span>
          </label>
          <label class="time-note-field">
            <span>Note</span>
            <input id="time-note" placeholder="What did they work on?">
          </label>
          <button class="button button-secondary" type="button" id="time-submit">Log Time</button>
        </div>
      </section>
      <section>
        <p class="eyebrow">Task time log</p>
        ${entries.length ? `
          <div class="task-time-list">
            ${entries.map(renderTaskTimeEntry).join("")}
          </div>
        ` : emptyState("No time has been logged for this task.")}
      </section>
    </div>
  `;
}

function renderTaskDependencies(task = null) {
  const container = document.querySelector("#task-dependencies");
  if (!container) return;

  const selectedProjectId = document.querySelector("#task-project")?.value || task?.projectId || state.selectedProject;
  const currentTaskId = task?.id || "";
  const currentDependencies = new Set(task?.blockedBy || []);
  const availableTasks = activeTasks()
    .filter((candidate) => candidate.id !== currentTaskId)
    .filter((candidate) => selectedProjectId === "all" || candidate.projectId === selectedProjectId);
  const openDependencies = task ? openTaskDependencies(task) : [];
  const downstreamTasks = task ? tasksBlockedBy(task.id) : [];

  container.innerHTML = `
    <div class="dependency-panel">
      <div class="collaboration-header">
        <p class="eyebrow">Dependencies</p>
        <span>${openDependencies.length}</span>
      </div>
      ${task && openDependencies.length ? `
        <div class="dependency-alert">
          Blocked by ${openDependencies.map((dependency) => escapeHtml(dependency.title)).join(", ")}
        </div>
      ` : ""}
      <div class="dependency-grid">
        <section>
          <h3>Blocked by</h3>
          <div class="dependency-option-list">
            ${availableTasks.length ? availableTasks.map((candidate) => `
              <label class="dependency-option">
                <input type="checkbox" data-task-dependency value="${candidate.id}" ${currentDependencies.has(candidate.id) ? "checked" : ""}>
                <span>
                  <strong>${escapeHtml(candidate.title)}</strong>
                  <small>${statusLabel(candidate.status)} - due ${formatDate(candidate.dueDate)}</small>
                </span>
              </label>
            `).join("") : emptyState("No other project tasks can block this task yet.")}
          </div>
        </section>
        <section>
          <h3>Blocking</h3>
          ${downstreamTasks.length ? `
            <div class="dependency-stack">
              ${downstreamTasks.map((blockedTask) => `
                <button class="table-task-button dependency-linked-task" type="button" data-edit-task="${blockedTask.id}">
                  <strong>${escapeHtml(blockedTask.title)}</strong>
                  <span>${statusLabel(blockedTask.status)} - ${memberName(blockedTask.assignee)}</span>
                </button>
              `).join("")}
            </div>
          ` : emptyState(task ? "This task is not blocking other work." : "Save this task to see downstream blockers.")}
        </section>
      </div>
    </div>
  `;
}

function renderTaskCustomFields(task = null) {
  const container = document.querySelector("#task-custom-fields");
  if (!container) return;

  if (!state.customFields.length) {
    container.innerHTML = `
      <div>
        <p class="eyebrow">Custom fields</p>
        ${emptyState("Add custom fields to track task-specific metadata.")}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div>
      <p class="eyebrow">Custom fields</p>
      <div class="custom-field-grid">
        ${state.customFields.map((field) => {
          const value = task?.customFields?.[field.id] || "";
          if (field.type === "select") {
            return `
              <label>
                <span>${escapeHtml(field.name)}</span>
                <select data-custom-field="${field.id}">
                  <option value="">None</option>
                  ${(field.options || []).map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
                </select>
              </label>
            `;
          }
          return `
            <label>
              <span>${escapeHtml(field.name)}</span>
              <input data-custom-field="${field.id}" type="${field.type === "number" ? "number" : "text"}" value="${escapeHtml(value)}">
            </label>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTaskTimeEntry(entry) {
  return `
    <article class="task-time-entry">
      <div>
        <strong>${memberName(entry.memberId)}</strong>
        <span>${formatDate(entry.date)} - ${entry.billable ? "Billable" : "Internal"}</span>
        <p>${escapeHtml(entry.note || "No note")}</p>
      </div>
      <strong>${formatDuration(entry.minutes)}</strong>
    </article>
  `;
}

function renderCommentBody(body) {
  return escapeHtml(body).replace(/@([a-z0-9._-]+)/gi, '<span class="mention-token">@$1</span>');
}

function commentKindLabel(kind) {
  return {
    comment: "Comment",
    question: "Question",
    decision: "Decision"
  }[normalizeCommentKind(kind)] || "Comment";
}

function commentTone(comment) {
  if (comment.status === "resolved") return "green";
  if (comment.kind === "decision") return "blue";
  if (comment.kind === "question") return "amber";
  return "neutral";
}

function renderCommentMentionChips(comment) {
  const mentioned = mentionedMembers(comment);
  if (!mentioned.length) return "";
  return `
    <div class="comment-mentions" aria-label="Mentioned teammates">
      ${mentioned.map((member) => `<span class="mention-token">@${escapeHtml(member.name.split(" ")[0] || member.name)}</span>`).join("")}
    </div>
  `;
}

function renderComment(comment, depth = 0) {
  const replies = commentReplies(comment.id);
  const canManage = comment.author === activeMemberId() || canWrite("comments:write");
  return `
    <article class="comment-item ${comment.status === "resolved" ? "is-resolved" : ""} ${depth ? "is-reply" : ""}">
      <span class="avatar">${memberName(comment.author).split(" ").map((part) => part[0]).join("")}</span>
      <div>
        <div class="comment-meta">
          <span>
            <strong>${memberName(comment.author)}</strong>
            <span class="status-pill inbox-${commentTone(comment)}">${escapeHtml(comment.status === "resolved" ? "Resolved" : commentKindLabel(comment.kind))}</span>
          </span>
          <small>${formatTimestamp(comment.updatedAt || comment.createdAt)}</small>
        </div>
        <p>${renderCommentBody(comment.body)}</p>
        ${renderCommentMentionChips(comment)}
        <div class="comment-actions">
          ${depth ? "" : `<button class="button button-secondary compact-button" type="button" data-comment-reply="${comment.id}">Reply</button>`}
          ${comment.kind === "decision" ? "" : `<button class="button button-secondary compact-button" type="button" data-comment-kind="decision" data-comment-id="${comment.id}">Mark Decision</button>`}
          ${canManage ? `<button class="button button-secondary compact-button" type="button" data-comment-status="${comment.status === "resolved" ? "open" : "resolved"}" data-comment-id="${comment.id}">${comment.status === "resolved" ? "Reopen" : "Resolve"}</button>` : ""}
        </div>
        ${replies.length ? `<div class="comment-replies">${replies.map((reply) => renderComment(reply, depth + 1)).join("")}</div>` : ""}
      </div>
    </article>
  `;
}

function renderBoardRoute() {
  const tasks = getFilteredTasks();
  const hasWorkspaceWork = activeTasks().length || activeProjects().length;
  els.appView.innerHTML = `
    ${!hasWorkspaceWork ? starterEmptyState("board") : ""}
    ${renderKanbanBoard(tasks, { controls: true, label: "Task board" })}
  `;
}
