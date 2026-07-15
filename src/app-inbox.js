/* Agora Inbox route rendering. Loaded after app.js so shared workspace helpers stay global. */
const COMMAND_INBOX_DECISION_TYPES = new Set(["approval", "sync conflict", "ai review", "feature request"]);
const COMMAND_INBOX_RISK_TYPES = new Set(["blocked", "overdue", "project risk"]);
const COMMAND_INBOX_SYNC_TYPES = new Set(["failed sync", "sync conflict"]);
const COMMAND_INBOX_TODAY_TYPES = new Set(["assignment", "due soon", "reminder", "mention", "watched", "comment", "activity"]);
const COMMAND_INBOX_URGENT_TYPES = new Set(["overdue", "blocked", "project risk", "assignment", "approval", "mention", "sync conflict", "failed sync", "ai review", "feature request"]);

function inboxRouteBuckets(items) {
  return items.reduce((buckets, item) => {
    const read = isInboxRead(item.id);
    if (!read) buckets.unreadItems.push(item);
    if (read) buckets.hasRead = true;
    if (COMMAND_INBOX_DECISION_TYPES.has(item.type)) {
      buckets.groups.decision.push(item);
      buckets.decisions += 1;
    }
    if (COMMAND_INBOX_RISK_TYPES.has(item.type)) {
      buckets.groups.risk.push(item);
      buckets.risks += 1;
    }
    if (COMMAND_INBOX_SYNC_TYPES.has(item.type)) {
      buckets.groups.sync.push(item);
      buckets.syncs += 1;
    }
    if (item.type === "ai review") buckets.groups.ai.push(item);
    if (item.type === "feature request") buckets.groups.feedback.push(item);
    if (COMMAND_INBOX_TODAY_TYPES.has(item.type)) buckets.groups.today.push(item);
    if (COMMAND_INBOX_URGENT_TYPES.has(item.type)) buckets.urgentItems.push(item);
    if (item.type === "due soon") buckets.dueItems.push(item);
    if (item.type === "mention" || item.type === "watched") buckets.mentionItems.push(item);
    return buckets;
  }, { unreadItems: [], urgentItems: [], dueItems: [], mentionItems: [], decisions: 0, risks: 0, syncs: 0, hasRead: false, groups: { decision: [], risk: [], sync: [], ai: [], feedback: [], today: [] } });
}

function commandInboxGroups(items, buckets = inboxRouteBuckets(items)) {
  return [
    {
      id: "decision",
      title: "Needs decision",
      description: "Approvals, conflicts, feedback responses, and AI proposals that need a human call.",
      items: buckets.groups.decision
    },
    {
      id: "risk",
      title: "At risk",
      description: "Blocked work, overdue tasks, and project health signals that can slip delivery.",
      items: buckets.groups.risk
    },
    {
      id: "sync",
      title: "Failed syncs",
      description: "Local changes that need retry, support details, or conflict handling.",
      items: buckets.groups.sync
    },
    {
      id: "ai",
      title: "AI review",
      description: "Operator proposals waiting for approval before they touch workspace data.",
      items: buckets.groups.ai
    },
    {
      id: "feedback",
      title: "Feedback",
      description: "Feature requests that need triage or requester follow-up.",
      items: buckets.groups.feedback
    },
    {
      id: "today",
      title: "Today",
      description: "Assigned, due-soon, reminder, mention, and collaboration signals for daily clearing.",
      items: buckets.groups.today
    }
  ];
}

function commandInboxItemSource(item) {
  if (item.sourceLabel) return item.sourceLabel;
  if (item.approvalId) return "Approvals";
  if (item.reviewId) return "AI Operator";
  if (item.syncId) return "Sync";
  if (item.type === "mention" || item.type === "watched" || item.type === "comment" || item.type === "activity") return "Collaboration";
  if (item.type === "assignment") return "My work";
  if (item.type === "due soon" || item.type === "overdue" || item.type === "reminder") return "Schedule";
  return "Workspace";
}

function commandInboxItemPriority(item) {
  if (item.priorityLabel) return item.priorityLabel;
  if (item.urgency >= 5) return "P0";
  if (item.urgency >= 4) return "P1";
  if (item.urgency >= 3) return "P2";
  return "P3";
}

function commandInboxPriorityTone(item) {
  const priority = commandInboxItemPriority(item);
  if (priority === "P0") return "red";
  if (priority === "P1") return "amber";
  if (priority === "P2") return "blue";
  return "neutral";
}

function commandInboxDailyBrief(items, buckets = inboxRouteBuckets(items)) {
  const top = buckets.unreadItems[0] || items[0];
  return {
    unread: buckets.unreadItems.length,
    decisions: buckets.decisions,
    risks: buckets.risks,
    syncs: buckets.syncs,
    summary: top
      ? `${top.title} is the top item to clear first.`
      : "No active command items need attention right now."
  };
}

function inboxClearDayItems(items) {
  const priorityTypes = new Set(["approval", "sync conflict", "ai review", "feature request", "blocked", "overdue", "project risk", "assignment", "mention", "due soon", "reminder"]);
  return items
    .filter((item) => !isInboxRead(item.id) && priorityTypes.has(item.type))
    .slice(0, 6);
}

function renderInboxClearDayPanel(items) {
  const queue = inboxClearDayItems(items);
  const top = queue[0] || items.find((item) => !isInboxRead(item.id)) || items[0];
  const clearedCount = items.filter((item) => isInboxRead(item.id) || isInboxArchived(item.id)).length;
  const total = items.length;
  return `
    <section class="panel inbox-clear-day-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Clear the day</p>
          <h2>${top ? "One decision at a time." : "The command queue is clear."}</h2>
        </div>
        <span class="status-pill ${queue.length ? "inbox-amber" : "inbox-green"}">${clearedCount}/${total} cleared</span>
      </div>
      ${top ? `
        <article class="inbox-clear-focus">
          <div>
            <span class="status-pill inbox-${top.tone}">${escapeHtml(top.type)}</span>
            <strong>${escapeHtml(top.title)}</strong>
            <p>${escapeHtml(top.message)}</p>
            <small>${escapeHtml(inboxItemReason(top))}</small>
          </div>
          <div class="inbox-clear-actions">
            ${top.approvalId ? `<button class="button button-primary" type="button" data-approval-action="approved" data-approval-id="${top.approvalId}" data-inbox-id="${top.id}">Approve</button>` : ""}
            ${top.taskId ? `<button class="button button-primary" type="button" data-inbox-plan="${top.taskId}" data-inbox-id="${top.id}">Plan Today</button>` : ""}
            ${top.taskId ? `<button class="button button-secondary" type="button" data-edit-task="${top.taskId}" data-inbox-id="${top.id}">Open</button>` : ""}
            ${!top.taskId && top.projectId ? `<button class="button button-secondary" type="button" data-project-id="${escapeHtml(top.projectId)}">Open Project</button>` : ""}
            <button class="button button-secondary" type="button" data-inbox-remind="tomorrow" data-inbox-id="${top.id}">Tomorrow</button>
            <button class="button button-secondary" type="button" data-inbox-clear="${top.id}">Clear</button>
          </div>
        </article>
        <div class="inbox-clear-queue">
          ${queue.slice(1, 5).map((item) => `
            <button type="button" ${item.taskId ? `data-edit-task="${item.taskId}" data-inbox-id="${item.id}"` : item.projectId ? `data-project-id="${escapeHtml(item.projectId)}"` : `data-inbox-read="${item.id}"`}>
              <span class="status-pill inbox-${item.tone}">${escapeHtml(commandInboxItemPriority(item))}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(commandInboxItemSource(item))}</small>
            </button>
          `).join("")}
        </div>
      ` : emptyState("Nothing needs clearing right now.")}
    </section>
  `;
}

function dailyCommandDigestRows(items) {
  const syncQueue = apiSyncQueueSummary();
  const visibilityWarnings = clientVisibilityReviewData().warnings || [];
  const autopilotScenarios = projectAutopilotRecoveryScenarios();
  const featureRequests = featureRequestTasks().filter((task) => !["shipped", "declined"].includes(featureRequestStatus(task)));
  const pendingDecisions = items.filter((item) => ["approval", "sync conflict", "ai review"].includes(item.type));
  const changed = items.filter((item) => ["mention", "watched", "comment", "activity", "feature request"].includes(item.type));
  return [
    {
      label: "Needs decision",
      value: pendingDecisions.length,
      tone: pendingDecisions.length ? "amber" : "green",
      detail: "Approvals, sync conflicts, and AI proposals waiting for a human call.",
      route: "inbox"
    },
    {
      label: "What changed",
      value: changed.length,
      tone: changed.length ? "blue" : "neutral",
      detail: "Mentions, watched tasks, comments, activity, and requester updates since the last sweep.",
      route: "inbox"
    },
    {
      label: "Failed sync attempts",
      value: syncQueue.total,
      tone: syncQueue.conflicts ? "red" : syncQueue.total ? "amber" : "green",
      detail: syncQueue.total ? `${syncQueue.pending} pending / ${syncQueue.conflicts} conflicts / ${syncQueue.highAttempts} repeated attempts.` : "No local writes are blocked.",
      route: "settings",
      settingsTab: "sync"
    },
    {
      label: "Autopilot proposals",
      value: autopilotScenarios.length,
      tone: autopilotScenarios.length ? "amber" : "neutral",
      detail: "Recovery scenarios that need Safety Center review, impact simulation, approval, or rejection.",
      route: "autopilot"
    },
    {
      label: "Feature requests",
      value: featureRequests.length,
      tone: featureRequests.length ? "blue" : "neutral",
      detail: "Open requester asks that may need triage, owner updates, or client follow-up.",
      route: "feature-requests"
    },
    {
      label: "Client visibility warnings",
      value: visibilityWarnings.length,
      tone: visibilityWarnings.length ? "amber" : "green",
      detail: "Client-visible items missing owner, due date, reviewer, or approval context.",
      route: "visibility"
    }
  ];
}

function renderDailyCommandDigestPanel(items) {
  const rows = dailyCommandDigestRows(items);
  const reviewCount = rows.filter((row) => Number(row.value || 0) > 0).length;
  return `
    <section class="panel daily-command-digest-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Daily command digest</p>
          <h2>What changed, failed, and needs review</h2>
        </div>
        <span class="status-pill ${reviewCount ? "inbox-amber" : "inbox-green"}">${reviewCount ? `${reviewCount} review` : "Clear"}</span>
      </div>
      <div class="daily-command-digest-grid">
        ${rows.map((row) => `
          <article>
            <span class="status-pill inbox-${row.tone}">${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
            <p>${escapeHtml(row.detail)}</p>
            <button class="button button-secondary compact-button" type="button" ${row.settingsTab ? `data-open-settings-tab="${escapeHtml(row.settingsTab)}"` : `data-route="${escapeHtml(row.route)}"`}>Review</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderInbox() {
  const items = getInboxItems();
  const buckets = inboxRouteBuckets(items);
  const groups = commandInboxGroups(items, buckets);
  const dailyBrief = commandInboxDailyBrief(items, buckets);
  const briefs = operatorBriefs(3);
  const pulse = workspacePulse();

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Unread", buckets.unreadItems.length)}
      ${metric("Decisions", dailyBrief.decisions)}
      ${metric("At risk", dailyBrief.risks)}
      ${metric("Failed syncs", dailyBrief.syncs)}
    </div>

    <section class="panel command-inbox-hero">
      <div>
        <p class="eyebrow">Command Inbox</p>
        <h2>What needs you, what changed, and what can be cleared next</h2>
        <p>${escapeHtml(dailyBrief.summary)}</p>
      </div>
      <div class="command-inbox-brief">
        <article>
          <span>Clear first</span>
          <strong>${buckets.urgentItems[0] ? escapeHtml(buckets.urgentItems[0].title) : "Nothing urgent"}</strong>
          <small>${buckets.urgentItems[0] ? escapeHtml(buckets.urgentItems[0].message) : "The workspace is quiet."}</small>
        </article>
        <article>
          <span>Daily sweep</span>
          <strong>${buckets.dueItems.length + buckets.mentionItems.length}</strong>
          <small>due-soon, mention, and watched-task signals</small>
        </article>
      </div>
    </section>

    ${renderInboxClearDayPanel(items)}

    <div class="command-center-grid">
      <section class="panel inbox-panel command-inbox-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Work queue</p>
            <h2>Unified command queue</h2>
          </div>
          <div class="inbox-header-actions">
            <button class="button button-secondary" type="button" data-inbox-bulk="read" ${items.length ? "" : "disabled"}>Mark All Read</button>
            <button class="button button-secondary" type="button" data-inbox-bulk="archive-read" ${buckets.hasRead ? "" : "disabled"}>Clear Read</button>
          </div>
        </div>
        <div class="inbox-lanes">
          ${groups.map(renderInboxLaneGroup).join("")}
        </div>
      </section>

      ${renderDailyCommandDigestPanel(items)}
      ${renderNotificationDigestPanel()}
      ${renderNotificationRoleDefaultsPanel()}
      ${renderNotificationPreferencesPanel()}
      ${renderNotificationRemindersPanel()}
      ${renderInboxIntelligencePanel(items)}
      ${renderNotificationHistoryPanel()}

      <section class="panel operator-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Live workspace</p>
            <h2>Operator pulse</h2>
          </div>
        </div>
        ${renderWorkspacePulse(pulse)}
        <div class="operator-brief-list">
          ${briefs.length ? briefs.map(renderOperatorBrief).join("") : emptyState("No active projects need attention.")}
        </div>
      </section>
    </div>
  `;
}

function renderWorkspacePulse(pulse) {
  return `
    <div class="workspace-pulse">
      <div class="presence-row" aria-label="Active collaborators">
        ${pulse.activeMembers.map((member) => `<span class="presence-pill"><span class="avatar">${member.name.split(" ").map((part) => part[0]).join("")}</span>${escapeHtml(member.name)}</span>`).join("")}
      </div>
      <div class="pulse-metrics">
        <span><strong>${pulse.activeMembers.length}</strong> active</span>
        <span><strong>${pulse.liveViewers.length}</strong> live now</span>
        <span><strong>${pulse.recentActivity.length}</strong> signals</span>
        <span><strong>${pulse.handoffs.length}</strong> handoffs</span>
      </div>
      ${pulse.liveViewers.length ? `
        <div class="live-viewer-list">
          ${pulse.liveViewers.map((presence) => `
            <span>${escapeHtml(memberName(presence.memberId))}: ${escapeHtml(presence.viewing)}</span>
          `).join("")}
        </div>
      ` : ""}
      ${pulse.handoffs.length ? `
        <div class="pulse-handoffs">
          ${pulse.handoffs.map((task) => `
            <button class="pulse-handoff" type="button" data-edit-task="${task.id}">
              <span>${escapeHtml(projectName(task.projectId))}</span>
              <strong>${escapeHtml(task.title)}</strong>
            </button>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderInboxLane(title, items) {
  return `
    <section class="inbox-lane">
      <div class="inbox-lane-header">
        <h3>${escapeHtml(title)}</h3>
        <span>${items.length}</span>
      </div>
      <div class="inbox-list">
        ${items.length ? items.slice(0, 6).map((item) => renderInboxItem(item, title)).join("") : emptyState("Nothing here right now.")}
      </div>
    </section>
  `;
}

function renderInboxLaneGroup(group) {
  return `
    <section class="inbox-lane command-inbox-lane" data-command-inbox-group="${escapeHtml(group.id)}">
      <div class="inbox-lane-header">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.description)}</p>
        </div>
        <span>${group.items.length}</span>
      </div>
      <div class="inbox-list">
        ${group.items.length ? group.items.slice(0, 7).map((item) => renderInboxItem(item, group.title)).join("") : emptyState("Nothing here right now.")}
      </div>
    </section>
  `;
}

function inboxLaneTitles(item) {
  const lanes = [];
  if (["approval", "sync conflict", "ai review", "feature request"].includes(item.type)) lanes.push("Needs decision");
  if (["blocked", "overdue", "project risk"].includes(item.type)) lanes.push("At risk");
  if (["failed sync", "sync conflict"].includes(item.type)) lanes.push("Failed syncs");
  if (item.type === "ai review") lanes.push("AI review");
  if (item.type === "feature request") lanes.push("Feedback");
  if (["assignment", "due soon", "reminder", "mention", "watched", "comment", "activity"].includes(item.type)) lanes.push("Today");
  return lanes.length ? lanes : ["Today"];
}

function primaryInboxLane(item) {
  const lanes = inboxLaneTitles(item);
  if (lanes.includes("Needs action")) return "Needs action";
  return lanes[0];
}

function inboxItemReason(item) {
  const task = item.taskId ? byId(state.tasks, item.taskId) : null;
  const project = item.projectId ? byId(state.projects, item.projectId) : null;
  const projectLabel = project ? ` in ${project.name}` : "";
  if (item.type === "assignment") return `You are the assignee${projectLabel}, and the task is still open.`;
  if (item.type === "overdue") return `The due date has passed${task?.dueDate ? `: ${formatFullDate(task.dueDate)}` : ""}.`;
  if (item.type === "due soon") return `The task is due within the next 7 days${task?.dueDate ? `: ${formatFullDate(task.dueDate)}` : ""}.`;
  if (item.type === "mention") return "A teammate mentioned you in a comment.";
  if (item.type === "watched") return "You watch this task, and someone else changed it.";
  if (item.type === "comment") return "A teammate commented on visible work.";
  if (item.type === "approval") return "An approval is waiting or needs changes.";
  if (item.type === "reminder") return "You asked Agora to bring this item back.";
  if (item.type === "blocked") return "This task has open dependencies and needs an unblocker.";
  if (item.type === "project risk") return "Project health is below target based on overdue, blocked, due-soon, and approval signals.";
  if (item.type === "failed sync") return "A local API write failed and is waiting in the retry queue.";
  if (item.type === "sync conflict") return "A local write conflicts with server data and needs a merge decision.";
  if (item.type === "ai review") return "The Operator proposed an action that needs explicit human approval.";
  if (item.type === "feature request") return "A feedback item needs triage or requester follow-up.";
  return "Recent activity matches your current workspace filters.";
}

function renderInboxActions(item, isPrimary) {
  const read = isInboxRead(item.id);
  if (!isPrimary) {
    return `
      ${item.taskId ? `<button class="button button-secondary" type="button" data-edit-task="${item.taskId}" data-inbox-id="${item.id}">Open</button>` : ""}
      <button class="button button-secondary" type="button" data-inbox-read="${item.id}">${read ? "Mark Unread" : "Mark Read"}</button>
    `;
  }

  return `
    ${item.approvalId ? `<button class="button button-primary" type="button" data-approval-action="approved" data-approval-id="${item.approvalId}" data-inbox-id="${item.id}">Approve</button>` : ""}
    ${item.approvalId ? `<button class="button button-secondary" type="button" data-approval-action="needs-changes" data-approval-id="${item.approvalId}" data-inbox-id="${item.id}">Needs Changes</button>` : ""}
    ${item.reviewId ? `<button class="button button-primary" type="button" data-agent-review-approve="${escapeHtml(item.reviewId)}">Approve AI</button>` : ""}
    ${item.reviewId ? `<button class="button button-secondary" type="button" data-agent-review-reject="${escapeHtml(item.reviewId)}">Reject AI</button>` : ""}
    ${item.syncId ? `<button class="button button-primary" type="button" data-sync-item-action="retry" data-sync-id="${escapeHtml(item.syncId)}" ${apiSession ? "" : "disabled"}>Retry Sync</button>` : ""}
    ${item.syncId ? `<button class="button button-secondary" type="button" data-sync-item-action="open" data-sync-id="${escapeHtml(item.syncId)}">Open Record</button>` : ""}
    ${item.syncId ? `<button class="button button-secondary" type="button" data-sync-item-action="copy" data-sync-id="${escapeHtml(item.syncId)}">Copy Details</button>` : ""}
    ${item.taskId ? `<button class="button button-secondary" type="button" data-inbox-plan="${item.taskId}" data-inbox-id="${item.id}">Plan Today</button>` : ""}
    ${item.taskId ? `<button class="button button-secondary" type="button" data-edit-task="${item.taskId}" data-inbox-id="${item.id}">Open</button>` : ""}
    ${!item.taskId && item.projectId ? `<button class="button button-secondary" type="button" data-project-id="${escapeHtml(item.projectId)}">Open Project</button>` : ""}
    ${item.type === "feature request" ? `<button class="button button-secondary" type="button" data-route="feature-requests">Request Board</button>` : ""}
    <button class="button button-secondary" type="button" data-inbox-remind="tomorrow" data-inbox-id="${item.id}">Remind Tomorrow</button>
    <button class="button button-secondary" type="button" data-inbox-remind="next-week" data-inbox-id="${item.id}">Next Week</button>
    <button class="button button-secondary" type="button" data-inbox-snooze="${item.id}">Snooze</button>
    ${item.reminderId ? `<button class="button button-secondary" type="button" data-reminder-dismiss="${item.reminderId}">Dismiss Reminder</button>` : ""}
    <button class="button button-secondary" type="button" data-inbox-read="${item.id}">${read ? "Mark Unread" : "Mark Read"}</button>
    <button class="button button-secondary" type="button" data-inbox-clear="${item.id}">Clear</button>
  `;
}

function renderOperatorBrief(brief) {
  const tone = brief.health < 45 ? "red" : brief.health < 70 ? "amber" : "green";
  const company = projectCompany(brief.project.id);
  return `
    <article class="operator-brief">
      <div>
        <span class="status-pill inbox-${tone}">${brief.health}% health</span>
        <h3>${escapeHtml(brief.project.name)}</h3>
        <p>${escapeHtml(brief.summary)}</p>
      </div>
      <div class="operator-actions">
        <span>Next: ${escapeHtml(brief.nextAction)}</span>
        ${brief.latestActivity ? `<small>Last change ${formatTimestamp(brief.latestActivity.createdAt)}</small>` : "<small>No recent activity</small>"}
      </div>
      <div class="operator-action-row">
        <button class="button button-primary" type="button" data-operator-action="${brief.actionType}" data-operator-project="${brief.project.id}">Run action</button>
        <button class="button button-secondary" type="button" data-ai-project-brief="${brief.project.id}">Draft brief</button>
        ${company?.type === "Client" ? `<button class="button button-secondary" type="button" data-company-update="${company.id}">Client update</button>` : ""}
        <button class="button button-secondary" type="button" data-project-id="${brief.project.id}">Open project</button>
      </div>
      <div class="operator-metrics">
        <span><strong>${brief.blocked.length}</strong> blocked</span>
        <span><strong>${brief.dueSoon.length}</strong> due soon</span>
        <span><strong>${brief.approvals.length}</strong> approvals</span>
      </div>
    </article>
  `;
}

function renderInboxItem(item, laneTitle = "") {
  const read = isInboxRead(item.id);
  const primaryLane = primaryInboxLane(item);
  const isPrimary = laneTitle === primaryLane || !laneTitle;
  const laneTitles = inboxLaneTitles(item);
  const secondaryLanes = laneTitles.filter((lane) => lane !== laneTitle);
  return `
    <article class="inbox-item ${read ? "is-read" : "is-unread"} ${isPrimary ? "" : "is-contextual"}">
      <div class="inbox-main">
        <div class="inbox-item-kicker">
          <span class="status-pill inbox-${item.tone}">${escapeHtml(item.type)}</span>
          <span class="status-pill inbox-${commandInboxPriorityTone(item)}">${escapeHtml(commandInboxItemPriority(item))}</span>
          <span class="status-pill inbox-neutral">${escapeHtml(commandInboxItemSource(item))}</span>
          ${isPrimary ? "" : `<span class="status-pill inbox-neutral">Actions in ${escapeHtml(primaryLane)}</span>`}
          ${secondaryLanes.map((lane) => `<span class="status-pill inbox-neutral">Also ${escapeHtml(lane)}</span>`).join("")}
        </div>
        <button class="table-task-button" type="button" ${item.taskId ? `data-edit-task="${item.taskId}" data-inbox-id="${item.id}"` : ""}>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.message)}</span>
        </button>
        <p class="inbox-reason"><strong>Why:</strong> ${escapeHtml(inboxItemReason(item))}</p>
        <div class="meta-row">
          <span>${escapeHtml(projectName(item.projectId))}</span>
          <span>${formatTimestamp(item.createdAt)}</span>
          ${read ? "<span>Read</span>" : "<span>Unread</span>"}
        </div>
      </div>
      <div class="inbox-actions">
        ${renderInboxActions(item, isPrimary)}
      </div>
    </article>
  `;
}
