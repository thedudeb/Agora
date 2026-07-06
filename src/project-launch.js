(function () {
  function styleOptions(preferences = []) {
    return preferences.map((preference) => ({
      id: preference.id,
      label: preference.label,
      value: preference.value,
      detail: preference.detail,
      route: preference.route,
      projectTab: preference.projectTab || "",
      starterProfile: preference.starterProfile,
      boardTemplate: preference.boardTemplate
    }));
  }

  function sourceOptions() {
    return [
      {
        id: "fresh",
        label: "Fresh start",
        value: "Build the first project in Agora",
        detail: "Seed scope, owners, milestones, docs, and first-week operating tasks."
      },
      {
        id: "import",
        label: "Importing work",
        value: "Bring in tasks from another tool",
        detail: "Add migration preview, cleanup, mapping, and rollback work to the launch plan."
      },
      {
        id: "client",
        label: "Existing client",
        value: "Start from a client engagement",
        detail: "Prioritize handoff, visibility rules, approvals, and the first client update."
      },
      {
        id: "template",
        label: "Repeatable template",
        value: "Turn this into a reusable workflow",
        detail: "Add template review, checklist standardization, and future reuse tasks."
      }
    ];
  }

  function normalizeWizard(input = {}, users = [], defaults = {}, baseMembers = [], preferences = []) {
    const source = input && typeof input === "object" ? input : {};
    const styleIds = new Set(styleOptions(preferences).map((option) => option.id));
    const sourceIds = new Set(sourceOptions().map((option) => option.id));
    const validOwnerIds = new Set([
      ...baseMembers.map((member) => member.id),
      ...(Array.isArray(users) ? users : []).map((user) => user?.id).filter(Boolean)
    ]);

    return {
      style: styleIds.has(source.style) ? source.style : defaults?.style || "client",
      source: sourceIds.has(source.source) ? source.source : defaults?.source || "fresh",
      projectName: String(source.projectName || "").trim().slice(0, 120),
      companyName: String(source.companyName || "").trim().slice(0, 120),
      startDate: source.startDate || "",
      ownerId: validOwnerIds.has(source.ownerId) ? source.ownerId : "",
      clientVisible: source.clientVisible !== false,
      lastCreatedProjectId: String(source.lastCreatedProjectId || "")
    };
  }

  function styleById(preferences, styleId) {
    const options = styleOptions(preferences);
    return options.find((option) => option.id === styleId) || options[0];
  }

  function sourceById(sourceId) {
    const options = sourceOptions();
    return options.find((option) => option.id === sourceId) || options[0];
  }

  function plan(styleId, sourceId) {
    const base = {
      kanban: {
        durationDays: 21,
        tasks: [
          ["intake", "Capture all incoming work", "Define the initial card intake rules, owners, tags, and what belongs on the board.", "todo", "high", 1, ["intake", "kanban"], []],
          ["columns", "Confirm board workflow columns", "Review backlog, todo, doing, review, blocked, and done rules before the team starts moving cards.", "doing", "high", 2, ["board", "workflow"], ["intake"]],
          ["wip", "Set WIP and blocker rules", "Name work-in-progress limits, blocked-card policy, and escalation expectations.", "todo", "normal", 4, ["wip", "blockers"], ["columns"]],
          ["triage", "Run first board triage", "Prioritize the highest value cards, assign owners, and move the first committed work into Doing.", "todo", "high", 6, ["triage"], ["wip"]],
          ["review", "Schedule weekly flow review", "Create a recurring review habit for throughput, blocked work, aging cards, and next commitments.", "todo", "normal", 10, ["review"], ["triage"]]
        ],
        milestones: [["Board workflow ready", 3, ["intake", "columns"]], ["First flow review complete", 10, ["triage", "review"]]],
        docs: [["Kanban Operating Rules", "Board columns, entry rules, WIP limits, blocked-card policy, and review cadence."]],
        raid: ["Risk", "Board becomes a dumping ground without clear entry and triage rules."]
      },
      scrum: {
        durationDays: 14,
        tasks: [
          ["backlog", "Prepare sprint backlog", "Collect candidate work, acceptance criteria, estimates, dependencies, and release risk.", "todo", "high", 1, ["backlog", "sprint"], []],
          ["capacity", "Confirm sprint capacity", "Review holidays, focus time, owner capacity, and carryover before commitment.", "doing", "urgent", 1, ["capacity"], ["backlog"]],
          ["planning", "Run sprint planning", "Commit the sprint, name the sprint goal, and capture what will not be included.", "todo", "urgent", 2, ["planning"], ["capacity"]],
          ["standup", "Publish standup rhythm", "Define the daily standup prompt, blocker escalation path, and owner follow-up rule.", "todo", "normal", 3, ["standup"], ["planning"]],
          ["closeout", "Schedule review and retro", "Book sprint review, retro, carryover review, and follow-up owner assignment.", "todo", "normal", 12, ["retro"], ["standup"]]
        ],
        milestones: [["Sprint committed", 2, ["capacity", "planning"]], ["Sprint review ready", 12, ["closeout"]]],
        docs: [["Sprint Operating Agreement", "Sprint goal, capacity assumptions, done definition, ceremonies, and escalation path."]],
        raid: ["Assumption", "The team agrees to use sprint commitment as the source of truth for near-term work."]
      },
      timeline: {
        durationDays: 35,
        tasks: [
          ["scope", "Lock timeline scope", "Name deliverables, dependencies, constraints, and what is explicitly out of scope.", "doing", "urgent", 2, ["scope", "timeline"], []],
          ["milestones", "Map milestones and dependencies", "Create milestone dates, dependency order, critical path, and date-risk owner.", "todo", "high", 5, ["gantt", "dependencies"], ["scope"]],
          ["owners", "Assign owners and backups", "Confirm primary owners, backup owners, review windows, and decision makers.", "todo", "high", 7, ["owners"], ["milestones"]],
          ["risk", "Review date risk", "Inspect overdue risk, unclear dependencies, capacity conflicts, and client-visible timing promises.", "todo", "high", 10, ["risk"], ["owners"]],
          ["status", "Publish timeline status packet", "Create the first schedule update with dates, risks, decisions, and next changes.", "todo", "normal", 14, ["status"], ["risk"]]
        ],
        milestones: [["Timeline baseline approved", 7, ["scope", "milestones", "owners"]], ["First date-risk review", 14, ["risk", "status"]]],
        docs: [["Timeline Baseline", "Scope, milestone dates, dependencies, critical path, owners, risks, and change-control rules."]],
        raid: ["Risk", "Date promises may shift if dependency owners are not confirmed before kickoff."]
      },
      client: {
        durationDays: 28,
        tasks: [
          ["handoff", "Collect client handoff notes", "Capture goals, stakeholders, success criteria, open promises, and contract constraints.", "doing", "urgent", 1, ["client", "handoff"], []],
          ["kickoff", "Prepare kickoff agenda", "Write agenda, decision points, stakeholder map, questions, and meeting owner.", "todo", "high", 3, ["kickoff"], ["handoff"]],
          ["visibility", "Set client visibility rules", "Decide what clients can see, what stays internal, and who approves shared packets.", "todo", "high", 5, ["visibility", "portal"], ["kickoff"]],
          ["approval", "Create first approval request", "Package the first client decision with context, due date, reviewer, and next action.", "todo", "high", 7, ["approval"], ["visibility"]],
          ["update", "Draft first weekly client update", "Summarize progress, risks, approvals, decisions, and next commitments in client-safe language.", "todo", "normal", 10, ["status"], ["approval"]]
        ],
        milestones: [["Kickoff ready", 3, ["handoff", "kickoff"]], ["Client packet ready", 7, ["visibility", "approval"]], ["First update sent", 10, ["update"]]],
        docs: [["Client Launch Brief", "Goals, stakeholders, promises, visibility rules, approval path, and first-week risks."]],
        raid: ["Decision", "Confirm which project updates are client-visible before the first portal share."]
      },
      simple: {
        durationDays: 14,
        tasks: [
          ["goals", "Write the project goal", "Capture the outcome, owner, deadline, and first useful deliverable.", "doing", "high", 1, ["goal"], []],
          ["tasks", "List the first ten tasks", "Turn the project into small owned next actions with due dates and priorities.", "todo", "high", 2, ["tasks"], ["goals"]],
          ["owners", "Confirm owners", "Assign each open task and identify anything that needs a decision or external input.", "todo", "normal", 3, ["owners"], ["tasks"]],
          ["checkin", "Schedule first check-in", "Create a lightweight review habit for progress, blockers, and the next week.", "todo", "normal", 7, ["check-in"], ["owners"]]
        ],
        milestones: [["First plan ready", 3, ["goals", "tasks", "owners"]], ["First check-in complete", 7, ["checkin"]]],
        docs: [["Simple Project Brief", "Outcome, owners, first ten tasks, open decisions, and next check-in date."]],
        raid: ["Issue", "The first project needs one accountable owner before the team can rely on it."]
      }
    }[styleId] || {};

    const sourceExtras = {
      import: {
        tasks: [
          ["import-preview", "Preview source import", "Run the import preview, map statuses, inspect warnings, and create a backup before applying.", "todo", "urgent", 1, ["migration", "import"], []],
          ["import-cleanup", "Clean imported work", "Resolve duplicate cards, missing owners, unmapped statuses, and stale due dates after import.", "todo", "high", 4, ["migration"], ["import-preview"]]
        ],
        docs: [["Migration Notes", "Source tool, field mapping, skipped records, warnings, rollback point, and owner follow-up."]],
        raid: ["Risk", "Imported work may contain stale owners, duplicate tasks, or unmapped statuses until cleanup is complete."]
      },
      client: {
        tasks: [
          ["stakeholders", "Confirm client stakeholders", "Name client approvers, escalation contacts, meeting cadence, and decision owners.", "todo", "high", 2, ["client"], []],
          ["portal", "Stage client portal packet", "Prepare client-visible docs, approvals, task visibility, and portal link safety before sharing.", "todo", "high", 6, ["portal"], ["stakeholders"]]
        ],
        docs: [["Client Stakeholder Map", "Approvers, watchers, escalation path, communication cadence, and portal expectations."]],
        raid: ["Decision", "Client approvers and visibility rules need signoff before the portal link is shared."]
      },
      template: {
        tasks: [
          ["template-review", "Review reusable workflow", "Mark which tasks, docs, milestones, and intake questions should become the reusable template.", "todo", "normal", 5, ["template"], []],
          ["template-save", "Save project as template", "Create the reusable project template after the first run has real owner and timing evidence.", "todo", "normal", 12, ["template"], ["template-review"]]
        ],
        docs: [["Template Reuse Notes", "Reusable steps, configurable fields, owner assumptions, and what must change per project."]],
        raid: ["Assumption", "The first run will produce enough evidence to turn this workflow into a reusable template."]
      },
      fresh: {
        tasks: [
          ["backup", "Create first recovery checkpoint", "Create a backup before inviting the team or importing work into the new project.", "todo", "normal", 2, ["recovery"], []]
        ],
        docs: [["Launch Checklist", "First project setup, invite timing, backup plan, status cadence, and launch owner checklist."]],
        raid: ["Assumption", "The team is comfortable starting with an Agora-native plan before connecting external sources."]
      }
    }[sourceId] || {};

    return {
      durationDays: Math.max(base.durationDays || 21, 14),
      tasks: [...(sourceExtras.tasks || []), ...(base.tasks || [])],
      milestones: base.milestones || [],
      docs: [...(base.docs || []), ...(sourceExtras.docs || [])],
      raid: [base.raid, sourceExtras.raid].filter(Boolean)
    };
  }

  window.AgoraProjectLaunch = Object.freeze({
    styleOptions,
    sourceOptions,
    normalizeWizard,
    styleById,
    sourceById,
    plan
  });
})();
