const STORAGE_KEY = "agora.workspace.v1";
const API_SESSION_KEY = "agora.api.session.v1";
const SIDEBAR_STATE_KEY = "agora.sidebar.v1";
const API_BASE_URL = (window.AGORA_API_BASE_URL || window.AGORA_CONFIG?.apiBaseUrl || "http://127.0.0.1:8787").replace(/\/+$/, "");

const workspaceStore = {
  load() {
    return window.localStorage.getItem(STORAGE_KEY);
  },
  save(nextState) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  },
  clear() {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

const apiSessionStore = {
  load() {
    const stored = window.localStorage.getItem(API_SESSION_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },
  save(session) {
    window.localStorage.setItem(API_SESSION_KEY, JSON.stringify(session));
  },
  clear() {
    window.localStorage.removeItem(API_SESSION_KEY);
  }
};

const sidebarDefaults = {
  home: true,
  work: true,
  manage: false,
  admin: false,
  projects: false
};

function loadSidebarState() {
  const stored = window.localStorage.getItem(SIDEBAR_STATE_KEY);
  if (!stored) return { ...sidebarDefaults };

  try {
    return { ...sidebarDefaults, ...JSON.parse(stored) };
  } catch {
    return { ...sidebarDefaults };
  }
}

function saveSidebarState() {
  window.localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(sidebarState));
}

function isCompactSidebarViewport() {
  return window.matchMedia?.("(max-width: 680px)").matches;
}

const statuses = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" }
];

const priorities = [
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" }
];

const members = [
  { id: "mara", name: "Mara Chen", role: "Product" },
  { id: "eli", name: "Eli Stone", role: "Engineering" },
  { id: "nina", name: "Nina Patel", role: "Design" },
  { id: "sam", name: "Sam Rivera", role: "Operations" }
];

const workspaceRoles = [
  { id: "admin", label: "Admin", description: "Can manage settings, members, templates, automations, and data exports." },
  { id: "manager", label: "Project Manager", description: "Can manage companies, projects, tasks, intake, reports, and delivery workflows." },
  { id: "member", label: "Member", description: "Can update assigned work, comments, docs, time, and daily planning." },
  { id: "client", label: "Client / Guest", description: "Can submit intake, review shared work, and follow selected project updates." }
];

const currentMemberId = "mara";

const routes = {
  dashboard: "Dashboard",
  portal: "Portal",
  daily: "Today",
  inbox: "Inbox",
  board: "Board",
  list: "List",
  calendar: "Calendar",
  "my-work": "My Work",
  time: "Time",
  reports: "Reports",
  templates: "Templates",
  automations: "Automations",
  docs: "Docs & Files",
  intake: "Intake",
  fields: "Custom Fields",
  data: "Data",
  settings: "Settings",
  companies: "Companies",
  company: "Company",
  project: "Project",
  invite: "Accept Invite"
};

const seedData = {
  selectedRoute: "dashboard",
  selectedProject: "all",
  selectedCompany: "all",
  selectedInviteToken: "",
  selectedProjectTab: "overview",
  selectedCalendarMonth: "2026-07",
  selectedDailyDate: "2026-06-27",
  filters: {
    company: "all",
    assignee: "all",
    status: "all",
    priority: "all",
    query: ""
  },
  dailyNotes: {
    "2026-06-27": "Focus: tighten the MVP story, keep the build small, and leave notes for tomorrow."
  },
  dailyPlans: {
    "task-1": { date: "2026-06-27", lane: "now" },
    "task-2": { date: "2026-06-27", lane: "next" },
    "task-7": { date: "2026-06-27", lane: "later" }
  },
  workspace: {
    id: "workspace-acme",
    name: "Acme Studio",
    slug: "acme-studio",
    visibility: "Private",
    defaultRole: "member",
    storageMode: "Browser local storage",
    backendTarget: "API + PostgreSQL"
  },
  memberships: [
    { memberId: "mara", role: "admin", status: "active" },
    { memberId: "eli", role: "manager", status: "active" },
    { memberId: "nina", role: "member", status: "active" },
    { memberId: "sam", role: "manager", status: "active" }
  ],
  users: [],
  invitations: [],
  inboxRead: [],
  inboxArchived: [],
  approvals: [
    {
      id: "approval-kickoff-checklist",
      companyId: "northstar-labs",
      projectId: "client-delivery",
      taskId: "task-4",
      title: "Kickoff checklist approval",
      requester: "sam",
      reviewer: "Jordan Lee",
      status: "requested",
      dueDate: "2026-07-08",
      summary: "Confirm the shared kickoff checklist before the first client delivery call.",
      createdAt: "2026-07-05T15:20:00.000Z"
    },
    {
      id: "approval-design-density",
      companyId: "brightline-health",
      projectId: "design-system",
      taskId: "task-6",
      title: "Task card density signoff",
      requester: "nina",
      reviewer: "Priya Shah",
      status: "needs-changes",
      dueDate: "2026-07-09",
      summary: "Client wants one more pass on compact metadata before approving the design system direction.",
      createdAt: "2026-07-06T10:45:00.000Z"
    },
    {
      id: "approval-launch-scope",
      companyId: "acme-studio",
      projectId: "launch",
      taskId: "task-1",
      title: "MVP scope approval",
      requester: "mara",
      reviewer: "Core team",
      status: "approved",
      dueDate: "2026-07-03",
      summary: "Release pillars approved for the public MVP scope.",
      createdAt: "2026-06-28T12:30:00.000Z"
    }
  ],
  companies: [
    {
      id: "acme-studio",
      name: "Acme Studio",
      type: "Internal",
      owner: "mara",
      status: "active",
      description: "The core team building Agora and running internal product delivery."
    },
    {
      id: "northstar-labs",
      name: "Northstar Labs",
      type: "Client",
      owner: "sam",
      status: "active",
      description: "Agency-style client delivery work with repeatable onboarding and handoff needs."
    },
    {
      id: "brightline-health",
      name: "Brightline Health",
      type: "Client",
      owner: "nina",
      status: "watch",
      description: "Design-heavy operational work where milestones and stakeholder visibility matter."
    }
  ],
  projects: [
    {
      id: "launch",
      name: "Agora MVP Launch",
      companyId: "acme-studio",
      description: "Define and ship the first public version of Agora.",
      owner: "mara",
      startDate: "2026-06-27",
      dueDate: "2026-08-21"
    },
    {
      id: "client-delivery",
      name: "Client Delivery Template",
      companyId: "northstar-labs",
      description: "Create a reusable workflow for agencies and service teams.",
      owner: "sam",
      startDate: "2026-07-01",
      dueDate: "2026-07-31"
    },
    {
      id: "design-system",
      name: "Design System",
      companyId: "brightline-health",
      description: "Establish core interaction patterns and reusable interface pieces.",
      owner: "nina",
      startDate: "2026-07-02",
      dueDate: "2026-08-07"
    }
  ],
  tasks: [
    {
      id: "task-1",
      projectId: "launch",
      title: "Finalize MVP scope",
      description: "Lock the first release around workspaces, projects, tasks, list, board, and basic collaboration.",
      assignee: "mara",
      status: "doing",
      priority: "urgent",
      startDate: "2026-06-27",
      dueDate: "2026-07-03",
      blockedBy: [],
      tags: ["planning", "mvp"],
      subtasks: [
        { id: "subtask-1-1", title: "Confirm release pillars", done: true },
        { id: "subtask-1-2", title: "Call out deferred enterprise scope", done: false },
        { id: "subtask-1-3", title: "Share scope with early contributors", done: false }
      ],
      customFields: {
        effort: "Large",
        risk: "High",
        budget: "0"
      },
      createdAt: "2026-06-27T12:00:00.000Z"
    },
    {
      id: "task-2",
      projectId: "launch",
      title: "Draft self-hosting setup",
      description: "Document the expected deployment story before implementation choices harden.",
      assignee: "eli",
      status: "todo",
      priority: "high",
      startDate: "2026-07-04",
      dueDate: "2026-07-10",
      blockedBy: ["task-1"],
      tags: ["docs", "ops"],
      subtasks: [
        { id: "subtask-2-1", title: "Outline local setup", done: true },
        { id: "subtask-2-2", title: "Draft deployment notes", done: false }
      ],
      customFields: {
        effort: "Medium",
        risk: "Medium",
        budget: "0"
      },
      createdAt: "2026-06-27T12:10:00.000Z"
    },
    {
      id: "task-3",
      projectId: "launch",
      title: "Write contribution guide",
      description: "Make it clear how contributors can help during product definition and early development.",
      assignee: "sam",
      status: "done",
      priority: "normal",
      startDate: "2026-06-27",
      dueDate: "2026-06-28",
      blockedBy: [],
      tags: ["community"],
      subtasks: [
        { id: "subtask-3-1", title: "Add issue labels", done: true },
        { id: "subtask-3-2", title: "Document first contribution path", done: true }
      ],
      createdAt: "2026-06-27T12:20:00.000Z"
    },
    {
      id: "task-4",
      projectId: "client-delivery",
      title: "Map agency onboarding flow",
      description: "Capture the default sections and milestones a client delivery project needs.",
      assignee: "sam",
      status: "review",
      priority: "high",
      startDate: "2026-07-01",
      dueDate: "2026-07-12",
      blockedBy: [],
      tags: ["template", "clients"],
      subtasks: [
        { id: "subtask-4-1", title: "Capture sales handoff", done: true },
        { id: "subtask-4-2", title: "Define client kickoff tasks", done: false }
      ],
      customFields: {
        effort: "Medium",
        risk: "Medium",
        budget: "2500"
      },
      createdAt: "2026-06-27T12:30:00.000Z"
    },
    {
      id: "task-5",
      projectId: "client-delivery",
      title: "Create sample project sections",
      description: "Draft Discovery, Planning, Delivery, Review, and Closeout sections.",
      assignee: "nina",
      status: "todo",
      priority: "normal",
      startDate: "2026-07-13",
      dueDate: "2026-07-17",
      blockedBy: ["task-4"],
      tags: ["template"],
      subtasks: [
        { id: "subtask-5-1", title: "Draft discovery section", done: false },
        { id: "subtask-5-2", title: "Draft delivery section", done: false }
      ],
      createdAt: "2026-06-27T12:40:00.000Z"
    },
    {
      id: "task-6",
      projectId: "design-system",
      title: "Define task card density",
      description: "Decide what metadata appears on compact task cards across board and dashboard views.",
      assignee: "nina",
      status: "doing",
      priority: "normal",
      startDate: "2026-07-02",
      dueDate: "2026-07-08",
      blockedBy: [],
      tags: ["design"],
      subtasks: [
        { id: "subtask-6-1", title: "Compare compact card metadata", done: true },
        { id: "subtask-6-2", title: "Validate mobile density", done: false }
      ],
      createdAt: "2026-06-27T12:50:00.000Z"
    },
    {
      id: "task-7",
      projectId: "design-system",
      title: "Sketch empty states",
      description: "Create useful empty states for new workspaces, empty projects, and filtered views.",
      assignee: "mara",
      status: "todo",
      priority: "low",
      startDate: "2026-07-09",
      dueDate: "2026-07-18",
      blockedBy: ["task-6"],
      tags: ["ux"],
      subtasks: [
        { id: "subtask-7-1", title: "Write empty project state", done: false },
        { id: "subtask-7-2", title: "Write filtered task state", done: false }
      ],
      createdAt: "2026-06-27T13:00:00.000Z"
    }
  ],
  milestones: [
    {
      id: "milestone-launch-alpha",
      projectId: "launch",
      title: "Prototype ready for contributors",
      description: "The repository has a runnable app shell, clear docs, and enough workflow shape for early feedback.",
      dueDate: "2026-07-12",
      owner: "mara",
      status: "on-track",
      taskIds: ["task-1", "task-2", "task-3"]
    },
    {
      id: "milestone-launch-public",
      projectId: "launch",
      title: "Public MVP scope locked",
      description: "Core release scope and self-hosting expectations are clear enough to start implementation planning.",
      dueDate: "2026-08-02",
      owner: "eli",
      status: "at-risk",
      taskIds: ["task-1", "task-2"]
    },
    {
      id: "milestone-client-template",
      projectId: "client-delivery",
      title: "Client delivery workflow drafted",
      description: "Agency teams can start from a useful default structure for repeatable client projects.",
      dueDate: "2026-07-22",
      owner: "sam",
      status: "on-track",
      taskIds: ["task-4", "task-5"]
    },
    {
      id: "milestone-design-language",
      projectId: "design-system",
      title: "Core interaction language",
      description: "Cards, task density, empty states, navigation, and project surfaces feel coherent across the app.",
      dueDate: "2026-07-28",
      owner: "nina",
      status: "planned",
      taskIds: ["task-6", "task-7"]
    }
  ],
  comments: [
    {
      id: "comment-1",
      taskId: "task-1",
      author: "mara",
      body: "I tightened this around workspaces, tasks, views, and collaboration. Anything that smells like enterprise portfolio management can wait.",
      createdAt: "2026-06-27T13:15:00.000Z"
    },
    {
      id: "comment-2",
      taskId: "task-1",
      author: "eli",
      body: "Agree. That scope is small enough to build well and still big enough to prove the product direction.",
      createdAt: "2026-06-27T13:30:00.000Z"
    },
    {
      id: "comment-3",
      taskId: "task-2",
      author: "eli",
      body: "I want the first setup guide to be boring in the best way: clone, configure env, run, deploy.",
      createdAt: "2026-06-27T14:05:00.000Z"
    },
    {
      id: "comment-4",
      taskId: "task-4",
      author: "sam",
      body: "This template should make the handoff from sales to delivery feel obvious for agency teams.",
      createdAt: "2026-06-27T14:22:00.000Z"
    }
  ],
  activities: [
    {
      id: "activity-1",
      projectId: "launch",
      taskId: "task-1",
      memberId: "mara",
      type: "task_status",
      message: "moved Finalize MVP scope to Doing",
      createdAt: "2026-06-27T13:05:00.000Z"
    },
    {
      id: "activity-2",
      projectId: "launch",
      taskId: "task-2",
      memberId: "eli",
      type: "comment",
      message: "commented on Draft self-hosting setup",
      createdAt: "2026-06-27T14:05:00.000Z"
    },
    {
      id: "activity-3",
      projectId: "client-delivery",
      taskId: "task-4",
      memberId: "sam",
      type: "task_status",
      message: "moved Map agency onboarding flow to Review",
      createdAt: "2026-06-27T14:18:00.000Z"
    },
    {
      id: "activity-4",
      projectId: "design-system",
      taskId: "task-6",
      memberId: "nina",
      type: "task_status",
      message: "moved Define task card density to Doing",
      createdAt: "2026-06-27T14:45:00.000Z"
    }
  ],
  customFields: [
    {
      id: "effort",
      name: "Effort",
      type: "select",
      options: ["Small", "Medium", "Large"]
    },
    {
      id: "risk",
      name: "Risk",
      type: "select",
      options: ["Low", "Medium", "High"]
    },
    {
      id: "budget",
      name: "Budget",
      type: "number",
      options: []
    }
  ],
  documents: [
    {
      id: "doc-launch-brief",
      projectId: "launch",
      title: "MVP Launch Brief",
      type: "Brief",
      owner: "mara",
      updatedAt: "2026-06-27T15:30:00.000Z",
      body: "Release scope, positioning, contributor story, and the first self-hosting path."
    },
    {
      id: "doc-client-kickoff",
      projectId: "client-delivery",
      title: "Client Kickoff Template",
      type: "Template",
      owner: "sam",
      updatedAt: "2026-07-02T13:10:00.000Z",
      body: "Reusable agenda, stakeholder notes, risks, open questions, and handoff checklist."
    },
    {
      id: "doc-design-principles",
      projectId: "design-system",
      title: "Interaction Principles",
      type: "Spec",
      owner: "nina",
      updatedAt: "2026-07-03T10:20:00.000Z",
      body: "Density, hierarchy, empty states, motion restraint, and core card behaviors."
    }
  ],
  files: [
    {
      id: "file-launch-map",
      projectId: "launch",
      title: "Launch messaging map.pdf",
      kind: "PDF",
      size: "1.8 MB",
      owner: "mara",
      updatedAt: "2026-06-28T09:45:00.000Z"
    },
    {
      id: "file-flow-sketch",
      projectId: "client-delivery",
      title: "Agency onboarding flow.fig",
      kind: "Design",
      size: "4.2 MB",
      owner: "nina",
      updatedAt: "2026-07-04T16:00:00.000Z"
    },
    {
      id: "file-export-sample",
      projectId: "design-system",
      title: "Task card density notes.csv",
      kind: "CSV",
      size: "320 KB",
      owner: "eli",
      updatedAt: "2026-07-05T11:35:00.000Z"
    }
  ],
  intakeForms: [
    {
      id: "form-client-request",
      title: "Client Work Request",
      projectId: "client-delivery",
      assignee: "sam",
      description: "Capture new client asks and turn approved requests into delivery tasks.",
      fields: [
        { id: "requester", label: "Requester", type: "text", required: true },
        { id: "company", label: "Company", type: "text", required: true },
        { id: "urgency", label: "Urgency", type: "select", options: ["Low", "Normal", "High"], required: true },
        { id: "details", label: "Request details", type: "textarea", required: true }
      ]
    },
    {
      id: "form-bug-report",
      title: "Product Bug Report",
      projectId: "launch",
      assignee: "eli",
      description: "Route product issues into the MVP launch backlog.",
      fields: [
        { id: "requester", label: "Reporter", type: "text", required: true },
        { id: "company", label: "Area", type: "text", required: true },
        { id: "urgency", label: "Severity", type: "select", options: ["Low", "Normal", "High"], required: true },
        { id: "details", label: "What happened?", type: "textarea", required: true }
      ]
    }
  ],
  intakeSubmissions: [
    {
      id: "submission-1",
      formId: "form-client-request",
      title: "Add client-facing kickoff checklist",
      requester: "Jordan Lee",
      company: "Northstar Labs",
      urgency: "High",
      details: "Clients need a shared kickoff checklist before the first delivery call.",
      taskId: "",
      createdAt: "2026-07-05T12:15:00.000Z"
    },
    {
      id: "submission-2",
      formId: "form-bug-report",
      title: "Calendar count looks confusing",
      requester: "Avery Kim",
      company: "Calendar",
      urgency: "Normal",
      details: "A stakeholder expected milestones and task counts to be separated in the month view.",
      taskId: "task-2",
      createdAt: "2026-07-06T09:30:00.000Z"
    }
  ],
  projectTemplates: [
    {
      id: "template-client-onboarding",
      name: "Client Onboarding",
      category: "Agency",
      description: "A ready-to-run client kickoff workspace with discovery, delivery, review, docs, intake, and milestones.",
      owner: "sam",
      durationDays: 30,
      tasks: [
        { key: "kickoff", title: "Run client kickoff", description: "Confirm goals, stakeholders, constraints, and success measures.", assignee: "sam", priority: "high", startOffset: 0, dueOffset: 3, tags: ["client", "kickoff"], blockedBy: [], subtasks: ["Confirm stakeholders", "Share agenda", "Capture success metrics"] },
        { key: "discovery", title: "Complete discovery brief", description: "Document client needs, constraints, risks, and open questions.", assignee: "mara", priority: "high", startOffset: 3, dueOffset: 8, tags: ["discovery"], blockedBy: ["kickoff"], subtasks: ["Interview owner", "Map risks", "Share brief"] },
        { key: "delivery", title: "Build delivery plan", description: "Turn the approved brief into milestones, owners, and delivery checkpoints.", assignee: "eli", priority: "normal", startOffset: 8, dueOffset: 16, tags: ["planning"], blockedBy: ["discovery"], subtasks: ["Create milestone map", "Assign owners"] },
        { key: "handoff", title: "Prepare stakeholder handoff", description: "Package decisions, files, timeline, and next steps for client stakeholders.", assignee: "nina", priority: "normal", startOffset: 16, dueOffset: 24, tags: ["handoff"], blockedBy: ["delivery"], subtasks: ["Collect files", "Write summary", "Schedule review"] }
      ],
      milestones: [
        { title: "Discovery approved", description: "Client goals, risks, and plan are aligned.", owner: "sam", dueOffset: 10, status: "planned", taskKeys: ["kickoff", "discovery"] },
        { title: "Delivery plan ready", description: "The working plan is staffed, sequenced, and ready to run.", owner: "eli", dueOffset: 20, status: "planned", taskKeys: ["delivery", "handoff"] }
      ],
      docs: [
        { title: "Client Kickoff Brief", type: "Template", body: "Goals, stakeholders, risks, decisions, and launch checklist for a new client workspace." },
        { title: "Delivery Plan", type: "Brief", body: "Milestones, dependencies, timeline, owners, and open decisions." }
      ],
      intakeForm: {
        title: "Client Change Request",
        assignee: "sam",
        description: "Capture new client asks after kickoff."
      }
    },
    {
      id: "template-software-launch",
      name: "Software Launch",
      category: "Product",
      description: "Launch planning for a software release with scope, docs, QA, community, and release readiness.",
      owner: "mara",
      durationDays: 42,
      tasks: [
        { key: "scope", title: "Lock release scope", description: "Confirm release pillars, deferred work, risks, and owner decisions.", assignee: "mara", priority: "urgent", startOffset: 0, dueOffset: 5, tags: ["launch", "scope"], blockedBy: [], subtasks: ["Confirm pillars", "Cut deferred scope", "Share release brief"] },
        { key: "docs", title: "Draft release docs", description: "Write setup, changelog, migration, and contributor notes.", assignee: "eli", priority: "high", startOffset: 5, dueOffset: 14, tags: ["docs"], blockedBy: ["scope"], subtasks: ["Setup guide", "Changelog", "FAQ"] },
        { key: "qa", title: "Run release QA", description: "Check core paths, empty states, responsive layouts, and smoke tests.", assignee: "nina", priority: "high", startOffset: 12, dueOffset: 24, tags: ["qa"], blockedBy: ["scope"], subtasks: ["Desktop smoke", "Mobile smoke", "Regression pass"] },
        { key: "announce", title: "Prepare launch announcement", description: "Draft announcement, screenshots, community notes, and launch checklist.", assignee: "sam", priority: "normal", startOffset: 20, dueOffset: 32, tags: ["community"], blockedBy: ["docs", "qa"], subtasks: ["Draft post", "Collect screenshots", "Schedule release"] }
      ],
      milestones: [
        { title: "Scope locked", description: "Release scope is approved and ready for implementation.", owner: "mara", dueOffset: 6, status: "planned", taskKeys: ["scope"] },
        { title: "Release candidate ready", description: "Docs, QA, and launch assets are ready for release review.", owner: "eli", dueOffset: 30, status: "planned", taskKeys: ["docs", "qa", "announce"] }
      ],
      docs: [
        { title: "Release Brief", type: "Brief", body: "Audience, promise, release scope, deferred scope, risks, and acceptance bar." },
        { title: "Launch Checklist", type: "Template", body: "Final QA, docs, messaging, issue labels, announcement, and post-launch monitoring." }
      ],
      intakeForm: {
        title: "Launch Feedback",
        assignee: "eli",
        description: "Route release feedback, bugs, and follow-up requests."
      }
    }
  ],
  taskTemplates: [
    {
      id: "task-template-client-review",
      name: "Client Review Task",
      description: "A repeatable review task with checklist, client risk, budget, and handoff tags.",
      assignee: "sam",
      priority: "high",
      durationDays: 5,
      tags: ["client", "review"],
      customFields: { effort: "Medium", risk: "Medium", budget: "1200" },
      subtasks: ["Collect feedback", "Resolve open questions", "Send recap"]
    },
    {
      id: "task-template-release-check",
      name: "Release Readiness Check",
      description: "A launch QA task for docs, layout checks, and release confidence.",
      assignee: "eli",
      priority: "urgent",
      durationDays: 4,
      tags: ["launch", "qa"],
      customFields: { effort: "Large", risk: "High", budget: "0" },
      subtasks: ["Run smoke test", "Check docs", "Verify mobile", "Capture release notes"]
    },
    {
      id: "task-template-design-pass",
      name: "Design Polish Pass",
      description: "A focused design pass for dense UI, empty states, and mobile responsiveness.",
      assignee: "nina",
      priority: "normal",
      durationDays: 3,
      tags: ["design", "polish"],
      customFields: { effort: "Small", risk: "Low", budget: "800" },
      subtasks: ["Review desktop", "Review mobile", "Document adjustments"]
    }
  ],
  automations: [
    {
      id: "automation-high-intake",
      name: "Convert high urgency intake",
      trigger: "Open intake urgency is High",
      action: "Create a task in the intake form project",
      enabled: true,
      lastRun: "",
      runCount: 0
    },
    {
      id: "automation-blocked-alert",
      name: "Flag blocked work",
      trigger: "Task has open dependencies",
      action: "Record an activity alert for the task owner",
      enabled: true,
      lastRun: "",
      runCount: 0
    },
    {
      id: "automation-due-risk",
      name: "Escalate due-soon risk",
      trigger: "Open task is due within 7 days",
      action: "Set Risk custom field to High",
      enabled: true,
      lastRun: "",
      runCount: 0
    },
    {
      id: "automation-milestone-watch",
      name: "Watch upcoming milestones",
      trigger: "Milestone is due within 14 days",
      action: "Record a milestone watch activity",
      enabled: true,
      lastRun: "",
      runCount: 0
    }
  ],
  automationHistory: [],
  timeEntries: [
    {
      id: "time-1",
      taskId: "task-1",
      memberId: "mara",
      date: "2026-06-27",
      minutes: 90,
      note: "PRD scope and release shape",
      billable: false,
      createdAt: "2026-06-27T15:00:00.000Z"
    },
    {
      id: "time-2",
      taskId: "task-2",
      memberId: "eli",
      date: "2026-06-28",
      minutes: 120,
      note: "Deployment notes and setup outline",
      billable: false,
      createdAt: "2026-06-28T11:00:00.000Z"
    },
    {
      id: "time-3",
      taskId: "task-4",
      memberId: "sam",
      date: "2026-07-02",
      minutes: 75,
      note: "Agency workflow mapping",
      billable: true,
      createdAt: "2026-07-02T16:15:00.000Z"
    },
    {
      id: "time-4",
      taskId: "task-6",
      memberId: "nina",
      date: "2026-07-03",
      minutes: 105,
      note: "Task card density exploration",
      billable: false,
      createdAt: "2026-07-03T14:45:00.000Z"
    },
    {
      id: "time-5",
      taskId: "task-5",
      memberId: "nina",
      date: "2026-07-04",
      minutes: 60,
      note: "Template section draft",
      billable: true,
      createdAt: "2026-07-04T12:10:00.000Z"
    }
  ]
};

let state = loadState();
let apiSession = apiSessionStore.load();
let sidebarState = loadSidebarState();
let invitePreview = null;
let invitePreviewToken = "";
let invitePreviewLoading = false;
let pwaInstallPrompt = null;
let pwaInstallReady = false;
let notificationPermissionState = typeof Notification === "undefined" ? "unsupported" : Notification.permission;

const els = {
  appView: document.querySelector("#app-view"),
  mainContent: document.querySelector("#main-content"),
  pageTitle: document.querySelector("#page-title"),
  routeStatus: document.querySelector("#route-status"),
  projectList: document.querySelector("#project-list"),
  projectSectionCount: document.querySelector("#project-section-count"),
  navInboxCount: document.querySelector("#nav-inbox-count"),
  notificationCount: document.querySelector("#notification-count"),
  toastRegion: document.querySelector("#toast-region"),
  searchInput: document.querySelector("#search-input"),
  companyFilter: document.querySelector("#company-filter"),
  projectFilter: document.querySelector("#project-filter"),
  assigneeFilter: document.querySelector("#assignee-filter"),
  statusFilter: document.querySelector("#status-filter"),
  priorityFilter: document.querySelector("#priority-filter"),
  taskDialog: document.querySelector("#task-dialog"),
  taskForm: document.querySelector("#task-form"),
  taskFormTitle: document.querySelector("#task-form-title"),
  projectDialog: document.querySelector("#project-dialog"),
  projectForm: document.querySelector("#project-form"),
  companyDialog: document.querySelector("#company-dialog"),
  companyForm: document.querySelector("#company-form"),
  companyFormTitle: document.querySelector("#company-form-title")
};

let draftSubtasks = [];
let toastTimers = new Map();
let lastFocusedBeforeDialog = null;

function loadState() {
  const stored = workspaceStore.load();
  if (!stored) return structuredClone(seedData);

  try {
    const parsed = JSON.parse(stored);
    const base = structuredClone(seedData);
    return normalizeState({
      ...base,
      ...parsed,
      filters: { ...base.filters, ...parsed.filters }
    });
  } catch {
    return structuredClone(seedData);
  }
}

function applyWorkspaceSnapshot(snapshot) {
  const base = structuredClone(seedData);
  state = normalizeState({
    ...base,
    ...snapshot,
    filters: { ...base.filters, ...(snapshot.filters || {}) }
  });
  saveState();
}

function normalizeState(nextState) {
  return {
    ...nextState,
    selectedInviteToken: nextState.selectedInviteToken || "",
    selectedCalendarMonth: nextState.selectedCalendarMonth || seedData.selectedCalendarMonth,
    selectedDailyDate: nextState.selectedDailyDate || todayKey(),
    workspace: { ...seedData.workspace, ...(nextState.workspace || {}) },
    memberships: Array.isArray(nextState.memberships) ? nextState.memberships : seedData.memberships,
    users: Array.isArray(nextState.users) ? nextState.users : [],
    invitations: Array.isArray(nextState.invitations) ? nextState.invitations : [],
    dailyNotes: { ...seedData.dailyNotes, ...(nextState.dailyNotes || {}) },
    dailyPlans: { ...seedData.dailyPlans, ...(nextState.dailyPlans || {}) },
    inboxRead: Array.isArray(nextState.inboxRead) ? nextState.inboxRead : [],
    inboxArchived: Array.isArray(nextState.inboxArchived) ? nextState.inboxArchived : [],
    approvals: Array.isArray(nextState.approvals) ? nextState.approvals : seedData.approvals,
    customFields: Array.isArray(nextState.customFields) ? nextState.customFields : seedData.customFields,
    documents: Array.isArray(nextState.documents) ? nextState.documents : seedData.documents,
    files: Array.isArray(nextState.files) ? nextState.files : seedData.files,
    intakeForms: Array.isArray(nextState.intakeForms) ? nextState.intakeForms : seedData.intakeForms,
    intakeSubmissions: Array.isArray(nextState.intakeSubmissions) ? nextState.intakeSubmissions : seedData.intakeSubmissions,
    projectTemplates: Array.isArray(nextState.projectTemplates) ? nextState.projectTemplates : seedData.projectTemplates,
    taskTemplates: Array.isArray(nextState.taskTemplates) ? nextState.taskTemplates : seedData.taskTemplates,
    automations: Array.isArray(nextState.automations) ? nextState.automations : seedData.automations,
    automationHistory: Array.isArray(nextState.automationHistory) ? nextState.automationHistory : [],
    companies: nextState.companies.map((company) => ({
      type: "Client",
      status: "active",
      description: "",
      ...company
    })),
    projects: nextState.projects.map((project) => ({
      archivedAt: "",
      archivedBy: "",
      restoredAt: "",
      ...project
    })),
    tasks: nextState.tasks.map((task) => ({
      archivedAt: "",
      archivedBy: "",
      restoredAt: "",
      ...task,
      startDate: task.startDate || task.createdAt?.slice(0, 10) || "",
      blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      customFields: task.customFields && typeof task.customFields === "object" ? task.customFields : {}
    }))
  };
}

function saveState() {
  workspaceStore.save(state);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(apiSession?.token ? { Authorization: `Bearer ${apiSession.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "API request failed");
  }
  return body;
}

function saveApiSession(session) {
  apiSession = session;
  apiSessionStore.save(session);
}

function clearApiSession() {
  apiSession = null;
  apiSessionStore.clear();
}

const structuredRecordCollections = ["companies", "approvals", "timeEntries", "comments", "activities", "documents", "files"];

function mergeRecordsById(existingItems = [], incomingItems = []) {
  const next = new Map();
  existingItems.forEach((item) => next.set(item.id, item));
  incomingItems.forEach((item) => next.set(item.id, { ...(next.get(item.id) || {}), ...item }));
  return Array.from(next.values());
}

async function loadStructuredRecordsFromApi() {
  if (!apiSession) return false;

  const result = await apiRequest("/api/records");
  const records = result.records || {};
  let changed = false;

  structuredRecordCollections.forEach((collection) => {
    const incoming = Array.isArray(records[collection]) ? records[collection] : [];
    if (!incoming.length) return;
    state[collection] = mergeRecordsById(state[collection], incoming);
    changed = true;
  });

  if (changed) saveState();
  return changed;
}

function apiConnectionLabel() {
  if (!apiSession) return "Browser storage";
  return `${apiSession.user.name} / ${apiSession.membership.role}`;
}

function apiBackendLabel() {
  if (!apiSession) return state.workspace.storageMode;
  const storage = apiSession.storageDriver || apiSession.apiHealth?.storage || apiSession.lastStorage || "";
  if (storage === "supabase") return "Supabase connected";
  if (storage === "json-file") return "JSON API connected";
  return "API connected";
}

function apiStatusLabel(offlineLabel = "browser only") {
  if (!apiSession) return offlineLabel;
  return apiBackendLabel().replace(" connected", "");
}

function apiConnectionTone() {
  return apiSession ? "inbox-green" : "inbox-neutral";
}

function isClientSession() {
  return apiSession?.membership?.role === "client";
}

function clientCompanyId() {
  return apiSession?.membership?.companyId || apiSession?.user?.companyId || state.companies.find((company) => company.type === "Client")?.id || state.companies[0]?.id || "";
}

function clientAllowedRoutes() {
  return new Set(["portal", "invite"]);
}

function canAccessRoute(route) {
  if (!isClientSession()) return true;
  return clientAllowedRoutes().has(route);
}

function routeFallback(route) {
  if (canAccessRoute(route)) return route;
  return isClientSession() ? "portal" : "dashboard";
}

function pwaStatusLabel() {
  if (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone) return "installed";
  return pwaInstallReady ? "ready" : "browser";
}

function pwaInstallHelp() {
  if (pwaStatusLabel() === "installed") return "Agora is running in app mode from this device.";
  if (pwaInstallReady) return "Install Agora to your home screen for a focused mobile workspace.";
  return "Use your browser's Add to Home Screen action if the install prompt is not available.";
}

function notificationStatusLabel() {
  if (notificationPermissionState === "unsupported") return "Notifications unsupported";
  return `Notifications ${notificationPermissionState}`;
}

function apiLastSyncedLabel() {
  return apiSession?.lastSyncedAt ? formatTimestamp(apiSession.lastSyncedAt) : "Not synced";
}

function byId(collection, id) {
  return collection.find((item) => item.id === id);
}

function isProjectArchived(project) {
  return Boolean(project?.archivedAt);
}

function isTaskArchived(task) {
  return Boolean(task?.archivedAt || isProjectArchived(byId(state.projects, task?.projectId)));
}

function activeProjects() {
  return state.projects.filter((project) => !isProjectArchived(project));
}

function activeTasks() {
  return state.tasks.filter((task) => !isTaskArchived(task));
}

function workspaceMembers() {
  const customUsers = Array.isArray(state.users) ? state.users : [];
  const userById = new Map();

  [...members, ...customUsers].forEach((member) => {
    if (!member?.id) return;
    userById.set(member.id, {
      role: "Team",
      ...member,
      name: member.name || member.email || "Invited member"
    });
  });

  return Array.from(userById.values());
}

function memberName(id) {
  return byId(workspaceMembers(), id)?.name || "Unassigned";
}

function projectName(id) {
  return byId(state.projects, id)?.name || "Unknown project";
}

function projectCompany(projectId) {
  const project = byId(state.projects, projectId);
  return byId(state.companies, project?.companyId) || state.companies[0];
}

function companyName(id) {
  return byId(state.companies, id)?.name || "Unknown company";
}

function statusLabel(id) {
  return byId(statuses, id)?.label || id;
}

function priorityLabel(id) {
  return byId(priorities, id)?.label || id;
}

function projectMatchesContext(projectId) {
  const project = byId(state.projects, projectId);
  return (
    project &&
    !isProjectArchived(project) &&
    (state.filters.company === "all" || project?.companyId === state.filters.company) &&
    (state.selectedProject === "all" || projectId === state.selectedProject)
  );
}

function getVisibleDocuments() {
  const query = state.filters.query.trim().toLowerCase();
  return state.documents
    .filter((document) => projectMatchesContext(document.projectId))
    .filter((document) => {
      const haystack = [document.title, document.type, document.body, projectName(document.projectId), memberName(document.owner)].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getVisibleFiles() {
  const query = state.filters.query.trim().toLowerCase();
  return state.files
    .filter((file) => projectMatchesContext(file.projectId))
    .filter((file) => {
      const haystack = [file.title, file.kind, projectName(file.projectId), memberName(file.owner)].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getVisibleIntakeSubmissions() {
  return state.intakeSubmissions
    .filter((submission) => {
      const form = byId(state.intakeForms, submission.formId);
      return form && projectMatchesContext(form.projectId);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function customFieldValue(task, field) {
  const value = task.customFields?.[field.id];
  if (value === undefined || value === null || value === "") return "";
  if (field.type === "number" && field.id === "budget") return `$${Number(value).toLocaleString()}`;
  return String(value);
}

function visibleTaskCustomFields(task) {
  return state.customFields
    .map((field) => ({ ...field, value: customFieldValue(task, field) }))
    .filter((field) => field.value);
}

function workspaceSnapshot() {
  return {
    ...state,
    exportedAt: new Date().toISOString(),
    exportVersion: 1
  };
}

function exportWorkspaceJson() {
  return JSON.stringify(workspaceSnapshot(), null, 2);
}

function csvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportTasksCsv() {
  const headers = ["id", "title", "project", "company", "assignee", "status", "priority", "startDate", "dueDate", "blockedBy", "tags"];
  const rows = state.tasks.map((task) => [
    task.id,
    task.title,
    projectName(task.projectId),
    companyName(projectCompany(task.projectId)?.id),
    memberName(task.assignee),
    statusLabel(task.status),
    priorityLabel(task.priority),
    task.startDate,
    task.dueDate,
    taskDependencies(task).map((dependency) => dependency.title).join("; "),
    task.tags.join("; ")
  ]);

  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
}

function exportTimeCsv() {
  const headers = ["id", "date", "employee", "task", "project", "minutes", "billable", "note"];
  const rows = state.timeEntries.map((entry) => {
    const task = byId(state.tasks, entry.taskId);
    return [
      entry.id,
      entry.date,
      memberName(entry.memberId),
      task?.title || "Unknown task",
      task ? projectName(task.projectId) : "Unknown project",
      entry.minutes,
      entry.billable ? "yes" : "no",
      entry.note
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
}

function importWorkspaceJson(rawJson) {
  const parsed = JSON.parse(rawJson);
  applyWorkspaceSnapshot(parsed);
}

function backendReadinessItems() {
  return [
    { label: "Storage adapter", done: true },
    { label: "Workspace metadata", done: true },
    { label: "Role model", done: true },
    { label: "JSON export/import", done: true },
    { label: "CSV task/time export", done: true },
    { label: "API endpoints", done: true },
    { label: "Database migrations", done: false },
    { label: "Authentication", done: false }
  ];
}

function isTaskVisibleForContext(task) {
  if (isTaskArchived(task)) return false;

  const query = state.filters.query.trim().toLowerCase();
  const haystack = [
    task.title,
    task.description,
    projectName(task.projectId),
    companyName(projectCompany(task.projectId)?.id),
    memberName(task.assignee),
    task.tags.join(" "),
    visibleTaskCustomFields(task).map((field) => `${field.name} ${field.value}`).join(" "),
    taskDependencies(task).map((dependency) => dependency.title).join(" "),
    taskSubtasks(task).map((subtask) => subtask.title).join(" ")
  ].join(" ").toLowerCase();

  return (
    (state.filters.company === "all" || projectCompany(task.projectId)?.id === state.filters.company) &&
    (state.selectedProject === "all" || task.projectId === state.selectedProject) &&
    (state.filters.status === "all" || task.status === state.filters.status) &&
    (state.filters.priority === "all" || task.priority === state.filters.priority) &&
    (!query || haystack.includes(query))
  );
}

function isInboxRead(id) {
  return state.inboxRead.includes(id);
}

function isInboxArchived(id) {
  return state.inboxArchived.includes(id);
}

function markInboxRead(id) {
  if (!state.inboxRead.includes(id)) state.inboxRead = [...state.inboxRead, id];
}

function archiveInboxItem(id) {
  markInboxRead(id);
  if (!state.inboxArchived.includes(id)) state.inboxArchived = [...state.inboxArchived, id];
}

function unreadInboxCount() {
  return getInboxItems().filter((item) => !isInboxRead(item.id)).length;
}

function renderNotificationBadges() {
  const count = unreadInboxCount();
  [els.navInboxCount, els.notificationCount].filter(Boolean).forEach((badge) => {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
  });
  const notificationButton = document.querySelector("#notification-button");
  if (notificationButton) {
    notificationButton.setAttribute("aria-label", count ? `Open notifications, ${count} unread` : "Open notifications");
  }
  const inboxItem = document.querySelector('[data-route="inbox"]');
  if (inboxItem) {
    inboxItem.setAttribute("aria-label", count ? `Inbox, ${count} unread` : "Inbox");
  }
}

function showToast(message, tone = "info") {
  if (!els.toastRegion) return;

  const id = uid("toast");
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.dataset.toastId = id;
  toast.setAttribute("role", tone === "success" ? "status" : "alert");

  const text = document.createElement("span");
  text.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "toast-close";
  closeButton.dataset.toastDismiss = id;
  closeButton.setAttribute("aria-label", "Dismiss notification");
  closeButton.textContent = "x";

  toast.append(text, closeButton);
  els.toastRegion.prepend(toast);

  const timer = window.setTimeout(() => dismissToast(id), 4200);
  toastTimers.set(id, timer);
}

function dismissToast(id) {
  const toast = els.toastRegion?.querySelector(`[data-toast-id="${id}"]`);
  if (!toast) return;

  const timer = toastTimers.get(id);
  if (timer) window.clearTimeout(timer);
  toastTimers.delete(id);
  toast.remove();
}

function getInboxItems({ includeArchived = false } = {}) {
  const today = todayKey();
  const dueSoon = shiftDate(today, 7);
  const visibleTasks = activeTasks().filter(isTaskVisibleForContext);
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const items = [];

  visibleTasks.forEach((task) => {
    if (task.status !== "done" && task.assignee === currentMemberId) {
      items.push({
        id: `assignment-${task.id}`,
        type: "assignment",
        tone: "blue",
        title: task.title,
        message: `Assigned to ${memberName(task.assignee)} in ${projectName(task.projectId)}.`,
        taskId: task.id,
        projectId: task.projectId,
        createdAt: task.createdAt,
        urgency: 2
      });
    }

    if (isOverdue(task)) {
      items.push({
        id: `overdue-${task.id}`,
        type: "overdue",
        tone: "red",
        title: task.title,
        message: `Past due since ${formatFullDate(task.dueDate)}.`,
        taskId: task.id,
        projectId: task.projectId,
        createdAt: `${task.dueDate}T23:59:00.000Z`,
        urgency: 4
      });
    } else if (task.status !== "done" && task.dueDate && task.dueDate <= dueSoon) {
      items.push({
        id: `due-${task.id}`,
        type: "due soon",
        tone: "amber",
        title: task.title,
        message: `Due ${formatFullDate(task.dueDate)} in ${projectName(task.projectId)}.`,
        taskId: task.id,
        projectId: task.projectId,
        createdAt: `${task.dueDate}T09:00:00.000Z`,
        urgency: 3
      });
    }
  });

  state.comments
    .filter((comment) => comment.author !== currentMemberId)
    .filter((comment) => visibleTaskIds.has(comment.taskId))
    .forEach((comment) => {
      const task = byId(state.tasks, comment.taskId);
      items.push({
        id: `comment-${comment.id}`,
        type: "comment",
        tone: "green",
        title: task?.title || "Task comment",
        message: `${memberName(comment.author)} commented: ${comment.body}`,
        taskId: comment.taskId,
        projectId: task?.projectId || "",
        createdAt: comment.createdAt,
        urgency: 1
      });
    });

  state.activities
    .filter((activity) => activity.memberId !== currentMemberId)
    .filter((activity) => !activity.taskId || visibleTaskIds.has(activity.taskId))
    .slice(0, 12)
    .forEach((activity) => {
      items.push({
        id: `activity-${activity.id}`,
        type: "activity",
        tone: "neutral",
        title: activity.taskId ? byId(state.tasks, activity.taskId)?.title || projectName(activity.projectId) : projectName(activity.projectId),
        message: `${memberName(activity.memberId)} ${activity.message}.`,
        taskId: activity.taskId,
        projectId: activity.projectId,
        createdAt: activity.createdAt,
        urgency: 0
      });
    });

  state.approvals
    .filter((approval) => approval.status !== "approved")
    .filter((approval) => projectMatchesContext(approval.projectId))
    .forEach((approval) => {
      items.push({
        id: `approval-${approval.id}`,
        type: "approval",
        tone: approvalTone(approval.status),
        title: approval.title,
        message: `${approval.reviewer} ${approval.status === "needs-changes" ? "requested changes" : "needs to review"}: ${approval.summary}`,
        taskId: approval.taskId,
        projectId: approval.projectId,
        approvalId: approval.id,
        createdAt: approval.createdAt,
        urgency: approval.status === "needs-changes" ? 4 : 3
      });
    });

  return items
    .filter((item) => includeArchived || !isInboxArchived(item.id))
    .sort((a, b) => {
      const unreadSort = Number(isInboxRead(a.id)) - Number(isInboxRead(b.id));
      if (unreadSort !== 0) return unreadSort;
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateInputLabel(date) {
  return formatFullDate(date);
}

function shiftDate(date, offset) {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

function dailyPlan(taskId) {
  return state.dailyPlans?.[taskId] || null;
}

function isPlannedForDate(task, date) {
  return dailyPlan(task.id)?.date === date;
}

function planTaskForDate(taskId, lane = "next", date = state.selectedDailyDate) {
  state.dailyPlans = {
    ...state.dailyPlans,
    [taskId]: { date, lane }
  };
}

function unplanTask(taskId) {
  const nextPlans = { ...state.dailyPlans };
  delete nextPlans[taskId];
  state.dailyPlans = nextPlans;
}

function dailyLaneTasks(lane, date = state.selectedDailyDate) {
  return activeTasks().filter((task) => dailyPlan(task.id)?.date === date && dailyPlan(task.id)?.lane === lane);
}

function smartDailyTasks(date = state.selectedDailyDate) {
  const targetDate = parseDateValue(date);
  return getFilteredTasks()
    .filter((task) => task.status !== "done")
    .filter((task) => {
      const dueDate = parseDateValue(task.dueDate);
      return (
        isPlannedForDate(task, date) ||
        task.assignee === currentMemberId ||
        (dueDate && targetDate && dueDate <= targetDate)
      );
    })
    .sort((a, b) => {
      const aPlanned = isPlannedForDate(a, date) ? 0 : 1;
      const bPlanned = isPlannedForDate(b, date) ? 0 : 1;
      if (aPlanned !== bPlanned) return aPlanned - bPlanned;
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    });
}

function taskSubtasks(task) {
  return Array.isArray(task.subtasks) ? task.subtasks : [];
}

function subtaskStats(task) {
  const subtasks = taskSubtasks(task);
  const done = subtasks.filter((subtask) => subtask.done).length;
  return { total: subtasks.length, done };
}

function subtaskSummary(task) {
  const { total, done } = subtaskStats(task);
  if (!total) return "";
  return `${done}/${total} checklist`;
}

function taskDependencies(task) {
  return (task?.blockedBy || []).map((taskId) => byId(state.tasks, taskId)).filter((dependency) => dependency && !isTaskArchived(dependency));
}

function openTaskDependencies(task) {
  return taskDependencies(task).filter((dependency) => dependency.status !== "done");
}

function isTaskBlocked(task) {
  return openTaskDependencies(task).length > 0;
}

function tasksBlockedBy(taskId) {
  return activeTasks().filter((task) => task.blockedBy?.includes(taskId));
}

function taskStartDate(task) {
  return task.startDate || task.createdAt?.slice(0, 10) || task.dueDate || todayKey();
}

function daysBetween(startDate, endDate) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  if (!start || !end) return 0;
  return Math.round((end - start) / 86400000);
}

function sameStringSet(first = [], second = []) {
  if (first.length !== second.length) return false;
  const secondSet = new Set(second);
  return first.every((item) => secondSet.has(item));
}

function monthLabel(month) {
  const parsed = new Date(`${month}-01T12:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function shiftMonth(month, offset) {
  const parsed = new Date(`${month}-01T12:00:00`);
  parsed.setMonth(parsed.getMonth() + offset);
  return parsed.toISOString().slice(0, 7);
}

function calendarDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return "No date";
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatFullDate(date) {
  if (!date) return "No date";
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function parseDateValue(date) {
  return date ? new Date(`${date}T12:00:00`) : null;
}

function formatTimestamp(timestamp) {
  const parsed = new Date(timestamp);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.dueDate}T00:00:00`) < today;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredTasks() {
  const query = state.filters.query.trim().toLowerCase();
  return activeTasks().filter((task) => {
    const haystack = [
      task.title,
      task.description,
      projectName(task.projectId),
      memberName(task.assignee),
      task.tags.join(" "),
      taskSubtasks(task).map((subtask) => subtask.title).join(" ")
    ].join(" ").toLowerCase();

    return (
      (state.filters.company === "all" || projectCompany(task.projectId)?.id === state.filters.company) &&
      (state.selectedProject === "all" || task.projectId === state.selectedProject) &&
      (state.filters.assignee === "all" || task.assignee === state.filters.assignee) &&
      (state.filters.status === "all" || task.status === state.filters.status) &&
      (state.filters.priority === "all" || task.priority === state.filters.priority) &&
      (!query || haystack.includes(query))
    );
  });
}

function getProjectTasks(projectId, useFilters = true) {
  const tasks = useFilters ? getFilteredTasks() : activeTasks();
  return tasks.filter((task) => task.projectId === projectId);
}

function getProjectMilestones(projectId) {
  return state.milestones.filter((milestone) => milestone.projectId === projectId);
}

function getCompanyProjects(companyId) {
  return activeProjects().filter((project) => project.companyId === companyId);
}

function getCompanyTasks(companyId) {
  const projectIds = new Set(getCompanyProjects(companyId).map((project) => project.id));
  return activeTasks().filter((task) => projectIds.has(task.projectId));
}

function getCompanyMilestones(companyId) {
  const projectIds = new Set(getCompanyProjects(companyId).map((project) => project.id));
  return state.milestones.filter((milestone) => projectIds.has(milestone.projectId));
}

function getCompanyTimeEntries(companyId) {
  const projectIds = new Set(getCompanyProjects(companyId).map((project) => project.id));
  return state.timeEntries.filter((entry) => projectIds.has(byId(state.tasks, entry.taskId)?.projectId));
}

function getCompanyActivity(companyId, limit = 6) {
  const projectIds = new Set(getCompanyProjects(companyId).map((project) => project.id));
  return state.activities
    .filter((activity) => projectIds.has(activity.projectId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function approvalStatusLabel(status) {
  return {
    requested: "Requested",
    "needs-changes": "Needs changes",
    approved: "Approved"
  }[status] || status || "Requested";
}

function approvalTone(status) {
  if (status === "approved") return "green";
  if (status === "needs-changes") return "amber";
  return "blue";
}

function getPendingApprovals() {
  return state.approvals.filter((approval) => approval.status !== "approved");
}

function getProjectApprovals(projectId) {
  return state.approvals
    .filter((approval) => approval.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getCompanyApprovals(companyId) {
  const projectIds = new Set(getCompanyProjects(companyId).map((project) => project.id));
  return state.approvals
    .filter((approval) => approval.companyId === companyId || projectIds.has(approval.projectId))
    .sort((a, b) => {
      const statusSort = Number(a.status === "approved") - Number(b.status === "approved");
      if (statusSort !== 0) return statusSort;
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    });
}

function companyPortalSnapshot(companyId) {
  const projects = getCompanyProjects(companyId);
  const tasks = getCompanyTasks(companyId);
  const approvals = getCompanyApprovals(companyId);
  const files = state.files.filter((file) => projects.some((project) => project.id === file.projectId));
  const documents = state.documents.filter((document) => projects.some((project) => project.id === document.projectId));
  const openTasks = tasks.filter((task) => task.status !== "done");

  return {
    projects,
    tasks,
    openTasks,
    approvals,
    pendingApprovals: approvals.filter((approval) => approval.status !== "approved"),
    files,
    documents,
    progress: projectProgress(tasks),
    updatedAt: [...state.activities, ...state.comments]
      .filter((item) => projects.some((project) => project.id === item.projectId || byId(state.tasks, item.taskId)?.projectId === project.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt || ""
  };
}

function operatorBriefForProject(project) {
  const tasks = getProjectTasks(project.id, false);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdue = tasks.filter(isOverdue);
  const blocked = tasks.filter(isTaskBlocked);
  const dueSoon = dueSoonTasks(tasks);
  const approvals = getProjectApprovals(project.id).filter((approval) => approval.status !== "approved");
  const latestActivity = getProjectActivity(project.id, 1)[0];
  const progress = projectProgress(tasks);
  const health = reportHealthScore({ progress, overdue: overdue.length, blocked: blocked.length, openIntake: approvals.length });
  const nextAction = overdue[0]
    ? `Recover ${overdue[0].title}`
    : blocked[0]
      ? `Unblock ${blocked[0].title}`
      : approvals[0]
        ? `Chase ${approvals[0].title}`
        : dueSoon[0]
          ? `Close ${dueSoon[0].title}`
          : openTasks[0]
            ? `Advance ${openTasks[0].title}`
            : "Prepare client update";

  return {
    project,
    progress,
    health,
    overdue,
    blocked,
    dueSoon,
    approvals,
    latestActivity,
    nextAction,
    summary: `${project.name} is ${progress}% complete with ${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}, ${blocked.length} blocked, and ${approvals.length} pending ${approvals.length === 1 ? "approval" : "approvals"}.`
  };
}

function operatorBriefs(limit = 4) {
  return visibleReportProjects()
    .map(operatorBriefForProject)
    .sort((a, b) => {
      const riskSort = a.health - b.health;
      if (riskSort !== 0) return riskSort;
      return b.approvals.length - a.approvals.length;
    })
    .slice(0, limit);
}

function collaborationPresenceForTask(taskId) {
  const task = byId(state.tasks, taskId);
  if (!task) return [];

  const memberIds = new Set([
    task.assignee,
    ...getTaskComments(taskId).map((comment) => comment.author),
    ...getTaskActivity(taskId, 8).map((activity) => activity.memberId)
  ]);

  return [...memberIds]
    .map((memberId) => byId(members, memberId))
    .filter(Boolean)
    .slice(0, 4);
}

function automationSuggestions() {
  const pendingApprovals = getPendingApprovals();
  const blockedTasks = activeTasks().filter((task) => task.status !== "done" && isTaskBlocked(task));
  const dueTasks = dueSoonTasks(activeTasks());
  const staleProjects = activeProjects().filter((project) => !getProjectActivity(project.id, 1).length);

  return [
    {
      id: "suggestion-client-update",
      title: "Friday client update",
      description: "Generate a status recap for every client company with open work, pending approvals, and next actions.",
      impact: `${state.companies.filter((company) => company.type === "Client").length} client companies`,
      ready: true
    },
    {
      id: "suggestion-approval-chase",
      title: "Approval chase",
      description: "When an approval is still requested near its due date, add an inbox item and activity note for the project manager.",
      impact: `${pendingApprovals.length} pending approvals`,
      ready: pendingApprovals.length > 0
    },
    {
      id: "suggestion-blocker-digest",
      title: "Blocker digest",
      description: "Group blocked tasks by company and create a daily operator brief.",
      impact: `${blockedTasks.length} blocked tasks`,
      ready: blockedTasks.length > 0
    },
    {
      id: "suggestion-due-soon",
      title: "Due-soon daily plan",
      description: "Plan urgent work into Today when a task is due within 7 days and assigned to the active user.",
      impact: `${dueTasks.length} due-soon tasks`,
      ready: dueTasks.length > 0
    },
    {
      id: "suggestion-stale-project",
      title: "Stale project nudge",
      description: "Flag active projects that have no recent activity so PMs can follow up.",
      impact: `${staleProjects.length} quiet projects`,
      ready: staleProjects.length > 0
    }
  ];
}

function getTaskComments(taskId) {
  return state.comments
    .filter((comment) => comment.taskId === taskId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getProjectActivity(projectId, limit = 6) {
  return state.activities
    .filter((activity) => activity.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function getTaskActivity(taskId, limit = 6) {
  return state.activities
    .filter((activity) => activity.taskId === taskId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function getTaskTimeEntries(taskId) {
  return state.timeEntries
    .filter((entry) => entry.taskId === taskId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getFilteredTimeEntries() {
  return state.timeEntries.filter((entry) => {
    const task = byId(state.tasks, entry.taskId);
    if (!task || isTaskArchived(task)) return false;

    return (
      (state.filters.company === "all" || projectCompany(task.projectId)?.id === state.filters.company) &&
      (state.selectedProject === "all" || task.projectId === state.selectedProject) &&
      (state.filters.assignee === "all" || entry.memberId === state.filters.assignee)
    );
  });
}

function sumMinutes(entries) {
  return entries.reduce((total, entry) => total + Number(entry.minutes || 0), 0);
}

function projectProgress(tasks) {
  const done = tasks.filter((task) => task.status === "done").length;
  return tasks.length ? Math.round((done / tasks.length) * 100) : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dueSoonTasks(tasks, days = 7) {
  const today = todayKey();
  const limit = shiftDate(today, days);
  return tasks.filter((task) => !isTaskArchived(task) && task.status !== "done" && task.dueDate && task.dueDate >= today && task.dueDate <= limit);
}

function reportHealthScore({ progress, overdue, blocked, openIntake }) {
  return clamp(progress - overdue * 9 - blocked * 8 - openIntake * 4, 0, 100);
}

function visibleReportProjects() {
  return activeProjects().filter((project) => (
    (state.filters.company === "all" || project.companyId === state.filters.company) &&
    (state.selectedProject === "all" || project.id === state.selectedProject)
  ));
}

function reportTaskScope() {
  const tasks = getFilteredTasks();
  const projects = visibleReportProjects();
  const projectIds = new Set(projects.map((project) => project.id));
  return {
    tasks,
    projects,
    projectIds,
    timeEntries: getFilteredTimeEntries().filter((entry) => projectIds.has(byId(state.tasks, entry.taskId)?.projectId)),
    submissions: getVisibleIntakeSubmissions().filter((submission) => {
      const form = byId(state.intakeForms, submission.formId);
      return form && projectIds.has(form.projectId);
    })
  };
}

function projectReport(project, tasks, timeEntries, submissions) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const openTasks = projectTasks.filter((task) => task.status !== "done");
  const overdue = projectTasks.filter(isOverdue);
  const blocked = projectTasks.filter(isTaskBlocked);
  const dueSoon = dueSoonTasks(projectTasks);
  const trackedMinutes = sumMinutes(timeEntries.filter((entry) => byId(state.tasks, entry.taskId)?.projectId === project.id));
  const openIntake = submissions.filter((submission) => {
    const form = byId(state.intakeForms, submission.formId);
    return form?.projectId === project.id && !submission.taskId;
  });
  const progress = projectProgress(projectTasks);

  return {
    project,
    tasks: projectTasks,
    openTasks,
    overdue,
    blocked,
    dueSoon,
    openIntake,
    trackedMinutes,
    progress,
    health: reportHealthScore({ progress, overdue: overdue.length, blocked: blocked.length, openIntake: openIntake.length })
  };
}

function companyReport(company, tasks, timeEntries, submissions) {
  const projectIds = new Set(getCompanyProjects(company.id).map((project) => project.id));
  const companyTasks = tasks.filter((task) => projectIds.has(task.projectId));
  const openTasks = companyTasks.filter((task) => task.status !== "done");
  const overdue = companyTasks.filter(isOverdue);
  const blocked = companyTasks.filter(isTaskBlocked);
  const dueSoon = dueSoonTasks(companyTasks);
  const companySubmissions = submissions.filter((submission) => {
    const form = byId(state.intakeForms, submission.formId);
    return form && projectIds.has(form.projectId);
  });
  const openIntake = companySubmissions.filter((submission) => !submission.taskId);
  const trackedMinutes = sumMinutes(timeEntries.filter((entry) => projectIds.has(byId(state.tasks, entry.taskId)?.projectId)));
  const progress = projectProgress(companyTasks);

  return {
    company,
    projectCount: projectIds.size,
    tasks: companyTasks,
    openTasks,
    overdue,
    blocked,
    dueSoon,
    openIntake,
    trackedMinutes,
    progress,
    health: reportHealthScore({ progress, overdue: overdue.length, blocked: blocked.length, openIntake: openIntake.length })
  };
}

function milestoneProgress(milestone) {
  const linkedTasks = milestone.taskIds.map((taskId) => byId(state.tasks, taskId)).filter(Boolean);
  return projectProgress(linkedTasks);
}

function addActivity({ projectId, taskId = "", memberId = currentMemberId, type, message }) {
  const activity = {
    id: uid("activity"),
    projectId,
    taskId,
    memberId,
    type,
    message,
    createdAt: new Date().toISOString()
  };
  state.activities = [activity, ...state.activities];
  syncActivityToApi(activity);
  return activity;
}

function archiveTask(taskId) {
  const task = byId(state.tasks, taskId);
  if (!task || isTaskArchived(task)) return;

  const archivedAt = new Date().toISOString();
  state.tasks = state.tasks.map((item) => item.id === taskId ? {
    ...item,
    archivedAt,
    archivedBy: currentMemberId
  } : item);
  unplanTask(taskId);
  addActivity({
    projectId: task.projectId,
    taskId,
    type: "task_archive",
    message: `archived ${task.title}`
  });
  saveState();
  render();
  showToast("Task archived", "success");
  syncTaskArchiveToApi(taskId);
}

function archiveProject(projectId) {
  const project = byId(state.projects, projectId);
  if (!project || isProjectArchived(project)) return;

  const archivedAt = new Date().toISOString();
  const projectTaskIds = new Set(state.tasks.filter((task) => task.projectId === projectId).map((task) => task.id));
  state.projects = state.projects.map((item) => item.id === projectId ? {
    ...item,
    archivedAt,
    archivedBy: currentMemberId
  } : item);
  state.tasks = state.tasks.map((task) => projectTaskIds.has(task.id) ? {
    ...task,
    archivedAt: task.archivedAt || archivedAt,
    archivedBy: task.archivedBy || currentMemberId
  } : task);
  projectTaskIds.forEach(unplanTask);
  addActivity({
    projectId,
    type: "project_archive",
    message: `archived project ${project.name}`
  });
  state.selectedProject = "all";
  state.selectedRoute = "dashboard";
  saveState();
  render();
  showToast("Project archived", "success");
  syncProjectArchiveToApi(projectId);
}

function setRoute(route) {
  state.selectedRoute = routeFallback(route);
  if (route !== "invite") state.selectedInviteToken = "";
  if (route !== "project") state.selectedProjectTab = "overview";
  if (route !== "company") state.selectedCompany = "all";
  openSidebarGroupForRoute(state.selectedRoute);
  saveState();
  render();
}

function inviteTokenFromLocation() {
  const queryToken = new URLSearchParams(window.location.search).get("invite");
  if (queryToken) return queryToken.trim();

  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash.startsWith("invite/")) return "";
  return decodeURIComponent(hash.slice("invite/".length)).trim();
}

function routeInviteFromLocation({ shouldRender = false } = {}) {
  const token = inviteTokenFromLocation();
  if (!token) return false;

  state.selectedRoute = "invite";
  state.selectedInviteToken = token;
  state.selectedProject = "all";
  state.selectedCompany = "all";
  saveState();
  if (shouldRender) render();
  return true;
}

function setProject(projectId) {
  if (isClientSession()) {
    setRoute("portal");
    return;
  }
  state.selectedProject = projectId;
  state.selectedRoute = projectId === "all" ? "dashboard" : "project";
  state.selectedProjectTab = "overview";
  if (projectId !== "all") state.filters.company = projectCompany(projectId)?.id || "all";
  openSidebarGroupForRoute(state.selectedRoute);
  saveState();
  render();
}

function setCompany(companyId) {
  if (isClientSession()) {
    setRoute("portal");
    return;
  }
  state.selectedCompany = companyId;
  state.selectedRoute = companyId === "all" ? "companies" : "company";
  state.filters.company = companyId;
  state.selectedProject = "all";
  openSidebarGroupForRoute(state.selectedRoute);
  saveState();
  render();
}

function updateTask(id, updates) {
  const previous = byId(state.tasks, id);
  if (!previous) return;
  const next = { ...previous, ...updates };
  state.tasks = state.tasks.map((task) => task.id === id ? next : task);
  recordTaskChanges(previous, next);
  saveState();
  render();
  showToast(`${next.title} updated`, "success");
  syncTaskToApi(next, "Task synced to API");
}

function planTaskToday(taskId) {
  if (!byId(state.tasks, taskId)) return;
  planTaskForDate(taskId, "next", todayKey());
  state.selectedDailyDate = todayKey();
  saveState();
  render();
  showToast("Task planned for Today", "success");
}

function completeTask(taskId) {
  const task = byId(state.tasks, taskId);
  if (!task || task.status === "done") return;
  updateTask(taskId, { status: "done" });
}

function updateMilestoneDate(id, dueDate) {
  const milestone = byId(state.milestones, id);
  if (!milestone || milestone.dueDate === dueDate) return;

  state.milestones = state.milestones.map((item) => item.id === id ? { ...item, dueDate } : item);
  addActivity({
    projectId: milestone.projectId,
    type: "milestone_date",
    message: `moved milestone ${milestone.title} to ${formatFullDate(dueDate)}`
  });
  saveState();
  render();
  showToast("Milestone date updated", "success");
}

function updateProjectDate(id, field, date) {
  const project = byId(state.projects, id);
  if (!project || project[field] === date) return;

  state.projects = state.projects.map((item) => item.id === id ? { ...item, [field]: date } : item);
  const nextProject = byId(state.projects, id);
  addActivity({
    projectId: id,
    type: "project_date",
    message: `changed project ${field === "startDate" ? "start" : "due"} date to ${formatFullDate(date)}`
  });
  saveState();
  render();
  showToast("Project date updated", "success");
  syncProjectToApi(nextProject, "Project synced to API");
}

function recordTaskChanges(previous, next) {
  if (previous.status !== next.status) {
    addActivity({
      projectId: next.projectId,
      taskId: next.id,
      type: "task_status",
      message: `moved ${next.title} to ${statusLabel(next.status)}`
    });
  }

  if (previous.priority !== next.priority) {
    addActivity({
      projectId: next.projectId,
      taskId: next.id,
      type: "task_priority",
      message: `changed ${next.title} priority to ${priorityLabel(next.priority)}`
    });
  }

  if (previous.assignee !== next.assignee) {
    addActivity({
      projectId: next.projectId,
      taskId: next.id,
      type: "task_assignee",
      message: `assigned ${next.title} to ${memberName(next.assignee)}`
    });
  }

  if (previous.title !== next.title || previous.description !== next.description || previous.dueDate !== next.dueDate || previous.startDate !== next.startDate || previous.projectId !== next.projectId) {
    addActivity({
      projectId: next.projectId,
      taskId: next.id,
      type: "task_update",
      message: `updated ${next.title}`
    });
  }

  if (!sameStringSet(previous.blockedBy || [], next.blockedBy || [])) {
    addActivity({
      projectId: next.projectId,
      taskId: next.id,
      type: "task_dependency",
      message: `updated dependencies for ${next.title}`
    });
  }
}

function render() {
  const allowedRoute = routeFallback(state.selectedRoute);
  if (allowedRoute !== state.selectedRoute) {
    state.selectedRoute = allowedRoute;
    state.selectedProject = "all";
    state.selectedCompany = isClientSession() ? clientCompanyId() : state.selectedCompany;
    saveState();
  }
  const selectedProject = byId(state.projects, state.selectedProject);
  const selectedCompany = byId(state.companies, state.selectedCompany);
  els.pageTitle.textContent = state.selectedRoute === "project" && selectedProject
    ? selectedProject.name
    : state.selectedRoute === "company" && selectedCompany
      ? selectedCompany.name
      : routes[state.selectedRoute];
  document.title = `${els.pageTitle.textContent} - Agora`;
  if (els.routeStatus) els.routeStatus.textContent = `${els.pageTitle.textContent} view loaded.`;
  document.querySelectorAll("[data-route]").forEach((item) => {
    const isCompaniesRoute = item.dataset.route === "companies" && state.selectedRoute === "company";
    const isActive = item.dataset.route === state.selectedRoute || isCompaniesRoute;
    item.classList.toggle("is-active", isActive);
    if (item.classList.contains("brand")) return;
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });
  renderSidebarGroups();

  renderSidebarProjects();
  renderFilters();
  renderNotificationBadges();
  renderPermissionChrome();
  document.querySelector(".brand small").textContent = state.workspace.name;

  if (state.selectedRoute === "portal") renderClientPortal();
  if (state.selectedRoute === "project") renderProjectPage();
  if (state.selectedRoute === "company") renderCompanyPage();
  if (state.selectedRoute === "daily") renderDailyTasks();
  if (state.selectedRoute === "inbox") renderInbox();
  if (state.selectedRoute === "board") renderBoard();
  if (state.selectedRoute === "list") renderList();
  if (state.selectedRoute === "calendar") renderCalendar();
  if (state.selectedRoute === "my-work") renderMyWork();
  if (state.selectedRoute === "time") renderTimeTracking();
  if (state.selectedRoute === "reports") renderReports();
  if (state.selectedRoute === "templates") renderTemplates();
  if (state.selectedRoute === "automations") renderAutomations();
  if (state.selectedRoute === "docs") renderDocsAndFiles();
  if (state.selectedRoute === "intake") renderIntake();
  if (state.selectedRoute === "fields") renderCustomFields();
  if (state.selectedRoute === "data") renderDataManagement();
  if (state.selectedRoute === "settings") renderSettings();
  if (state.selectedRoute === "companies") renderCompanies();
  if (state.selectedRoute === "invite") renderInviteAcceptance();
  if (state.selectedRoute === "dashboard") renderDashboard();
}

function sidebarGroupForRoute(route) {
  if (["dashboard", "portal", "daily", "inbox"].includes(route)) return "home";
  if (["board", "list", "calendar", "my-work", "time"].includes(route)) return "work";
  if (["reports", "templates", "automations", "docs", "intake", "fields", "companies", "company"].includes(route)) return "manage";
  if (["data", "settings"].includes(route)) return "admin";
  if (route === "project") return "projects";
  if (route === "invite") return "";
  return "";
}

function renderPermissionChrome() {
  const client = isClientSession();
  document.body.classList.toggle("is-client-session", client);
  document.querySelectorAll("[data-route]").forEach((item) => {
    if (item.classList.contains("brand")) {
      item.hidden = false;
      return;
    }
    item.hidden = client && !canAccessRoute(item.dataset.route);
  });
  document.querySelectorAll("[data-nav-group]").forEach((group) => {
    group.hidden = client && !group.querySelector(".nav-item:not([hidden])");
  });
  ["#new-project-button", "#new-task-button", "#notification-button"].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) element.hidden = client;
  });
}

function renderSidebarGroups() {
  document.querySelectorAll("[data-nav-group]").forEach((group) => {
    const groupId = group.dataset.navGroup;
    const isOpen = Boolean(sidebarState[groupId]);
    const toggle = group.querySelector("[data-sidebar-toggle]");

    group.classList.toggle("is-open", isOpen);
    if (toggle) toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function openSidebarGroupForRoute(route) {
  const groupId = sidebarGroupForRoute(route);
  if (!groupId) return;

  if (isCompactSidebarViewport()) {
    sidebarState = {
      ...sidebarState,
      home: groupId === "home",
      work: groupId === "work",
      manage: groupId === "manage",
      admin: groupId === "admin",
      projects: groupId === "projects"
    };
    saveSidebarState();
    return;
  }

  if (sidebarState[groupId]) return;

  sidebarState = {
    ...sidebarState,
    [groupId]: true
  };
  saveSidebarState();
}

function renderSidebarProjects() {
  const projects = activeProjects();
  const tasks = activeTasks();
  const allCount = tasks.length;
  const projectButtons = projects.map((project) => {
    const taskCount = tasks.filter((task) => task.projectId === project.id).length;
    const isSelected = state.selectedProject === project.id;
    return `
      <button class="project-pill ${isSelected ? "is-active" : ""}" type="button" data-project-id="${project.id}" ${isSelected ? 'aria-current="page"' : ""} aria-label="${escapeHtml(project.name)}, ${taskCount} active ${taskCount === 1 ? "task" : "tasks"}">
        <span>${escapeHtml(project.name)}</span>
        <small>${taskCount}</small>
      </button>
    `;
  }).join("");

  els.projectList.innerHTML = `
    <button class="project-pill ${state.selectedProject === "all" ? "is-active" : ""}" type="button" data-project-id="all" ${state.selectedProject === "all" ? 'aria-current="page"' : ""} aria-label="All projects, ${allCount} active ${allCount === 1 ? "task" : "tasks"}">
      <span>All projects</span>
      <small>${allCount}</small>
    </button>
    ${projectButtons}
  `;
  if (els.projectSectionCount) els.projectSectionCount.textContent = String(projects.length);
}

function renderFilters() {
  const projectOptions = state.filters.company === "all"
    ? activeProjects()
    : activeProjects().filter((project) => project.companyId === state.filters.company);

  els.searchInput.value = state.filters.query;
  els.companyFilter.innerHTML = `
    <option value="all">All companies</option>
    ${state.companies.map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join("")}
  `;
  els.projectFilter.innerHTML = `
    <option value="all">All projects</option>
    ${projectOptions.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}
  `;
  els.assigneeFilter.innerHTML = `
    <option value="all">Everyone</option>
    ${workspaceMembers().map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}
  `;
  els.statusFilter.innerHTML = `
    <option value="all">Any status</option>
    ${statuses.map((status) => `<option value="${status.id}">${status.label}</option>`).join("")}
  `;
  els.priorityFilter.innerHTML = `
    <option value="all">Any priority</option>
    ${priorities.map((priority) => `<option value="${priority.id}">${priority.label}</option>`).join("")}
  `;

  els.companyFilter.value = state.filters.company;
  els.projectFilter.value = state.selectedProject;
  els.assigneeFilter.value = state.filters.assignee;
  els.statusFilter.value = state.filters.status;
  els.priorityFilter.value = state.filters.priority;
}

function renderMobileAppPanel() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Mobile app</p>
          <h2>Install & alerts</h2>
        </div>
        <span class="status-pill inbox-blue">${escapeHtml(pwaStatusLabel())}</span>
      </div>
      <div class="mobile-app-panel">
        <div>
          <strong>Agora PWA</strong>
          <p>${escapeHtml(pwaInstallHelp())} ${escapeHtml(notificationStatusLabel())}.</p>
        </div>
        <div class="data-actions">
          <button class="button button-primary" type="button" id="pwa-install" ${pwaInstallReady ? "" : "disabled"}>Install App</button>
          <button class="button button-secondary" type="button" id="notification-request" ${notificationPermissionState === "unsupported" || notificationPermissionState === "granted" ? "disabled" : ""}>Enable Alerts</button>
          <button class="button button-secondary" type="button" id="notification-test" ${notificationPermissionState === "granted" ? "" : "disabled"}>Test Alert</button>
        </div>
        <div class="mobile-capability-list">
          <span>Offline shell</span>
          <span>Home screen install</span>
          <span>Touch task actions</span>
          <span>Notification-ready</span>
        </div>
      </div>
    </section>
  `;
}

function renderDashboard() {
  const tasks = getFilteredTasks();
  const visibleProjects = state.filters.company === "all"
    ? activeProjects()
    : activeProjects().filter((project) => project.companyId === state.filters.company);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const completedTasks = tasks.filter((task) => task.status === "done");
  const overdueTasks = tasks.filter(isOverdue);
  const dueSoonTasks = [...openTasks]
    .filter((task) => task.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Open tasks", openTasks.length)}
      ${metric("Completed", completedTasks.length)}
      ${metric("Overdue", overdueTasks.length)}
      ${metric("Progress", `${completionRate}%`)}
    </div>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Projects</p>
            <h2>Active work</h2>
          </div>
        </div>
        <div class="project-summary-list">
          ${visibleProjects.length ? visibleProjects.map(renderProjectSummary).join("") : emptyState("No projects match the selected company.")}
        </div>
      </section>

      ${renderMobileAppPanel()}

      <section class="panel operator-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">AI operator</p>
            <h2>What needs attention</h2>
          </div>
        </div>
        <div class="operator-brief-list">
          ${operatorBriefs(3).map(renderOperatorBrief).join("") || emptyState("No active risks right now.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Due next</p>
            <h2>Upcoming tasks</h2>
          </div>
        </div>
        <div class="task-stack">
          ${dueSoonTasks.length ? dueSoonTasks.map(renderTaskCard).join("") : emptyState("No upcoming tasks match the current filters.")}
        </div>
      </section>
    </div>
  `;
}

function renderDailyTasks() {
  const date = state.selectedDailyDate;
  const smartTasks = smartDailyTasks(date);
  const plannedTasks = ["now", "next", "later"].flatMap((lane) => dailyLaneTasks(lane, date));
  const plannedIds = new Set(plannedTasks.map((task) => task.id));
  const unplannedSmartTasks = smartTasks.filter((task) => !plannedIds.has(task.id));
  const completedToday = plannedTasks.filter((task) => task.status === "done");
  const loggedToday = state.timeEntries.filter((entry) => entry.date === date);
  const note = state.dailyNotes?.[date] || "";

  els.appView.innerHTML = `
    <section class="daily-hero">
      <div>
        <p class="eyebrow">Daily task page</p>
        <h2>${dateInputLabel(date)}</h2>
        <div class="daily-date-controls">
          <button class="icon-button" type="button" data-daily-shift="-1" aria-label="Previous day">&lt;</button>
          <input type="date" value="${date}" data-daily-date aria-label="Daily task date">
          <button class="button button-secondary" type="button" data-daily-today>Today</button>
          <button class="icon-button" type="button" data-daily-shift="1" aria-label="Next day">&gt;</button>
        </div>
      </div>
      <label class="daily-note">
        <span>Daily note</span>
        <textarea id="daily-note" rows="5" placeholder="Notes, blockers, standup, decisions">${escapeHtml(note)}</textarea>
      </label>
    </section>

    <div class="metric-grid">
      ${metric("Planned", plannedTasks.length)}
      ${metric("Smart inbox", unplannedSmartTasks.length)}
      ${metric("Completed", completedToday.length)}
      ${metric("Logged", formatDuration(sumMinutes(loggedToday)))}
    </div>

    <div class="daily-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Plan</p>
            <h2>Today lanes</h2>
          </div>
        </div>
        <div class="daily-lanes">
          ${renderDailyLane("now", "Now")}
          ${renderDailyLane("next", "Next")}
          ${renderDailyLane("later", "Later")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Suggested</p>
            <h2>Smart inbox</h2>
          </div>
        </div>
        <div class="daily-smart-list">
          ${unplannedSmartTasks.length ? unplannedSmartTasks.map(renderDailySmartTask).join("") : emptyState("No unplanned work is asking for attention.")}
        </div>
      </section>
    </div>
  `;
}

function renderDailyLane(lane, label) {
  const tasks = dailyLaneTasks(lane);
  return `
    <section class="daily-lane">
      <div class="board-column-header">
        <h3>${label}</h3>
        <span>${tasks.length}</span>
      </div>
      <div class="daily-task-stack">
        ${tasks.length ? tasks.map((task) => renderDailyTask(task, lane)).join("") : emptyState(`Nothing in ${label.toLowerCase()}.`)}
      </div>
    </section>
  `;
}

function renderDailyTask(task, lane) {
  const checklist = subtaskSummary(task);
  return `
    <article class="daily-task-card ${task.status === "done" ? "is-done" : ""}">
      <button class="task-card-main" type="button" data-edit-task="${task.id}">
        <span class="task-project">${escapeHtml(projectCompany(task.projectId).name)} / ${escapeHtml(projectName(task.projectId))}</span>
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(task.description)}</span>
      </button>
      <div class="task-meta">
        <span class="avatar">${memberName(task.assignee).split(" ").map((part) => part[0]).join("")}</span>
        <span class="priority priority-${task.priority}">${priorityLabel(task.priority)}</span>
        <span class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}</span>
        ${checklist ? `<span>${escapeHtml(checklist)}</span>` : ""}
      </div>
      <div class="daily-actions">
        ${lane !== "now" ? `<button class="button button-secondary" type="button" data-daily-plan="now" data-task-id="${task.id}">Now</button>` : ""}
        ${lane !== "next" ? `<button class="button button-secondary" type="button" data-daily-plan="next" data-task-id="${task.id}">Next</button>` : ""}
        ${lane !== "later" ? `<button class="button button-secondary" type="button" data-daily-plan="later" data-task-id="${task.id}">Later</button>` : ""}
        <button class="button button-secondary" type="button" data-daily-action="log" data-task-id="${task.id}">Log 30m</button>
        <button class="button button-secondary" type="button" data-daily-action="tomorrow" data-task-id="${task.id}">Tomorrow</button>
        <button class="button button-primary" type="button" data-daily-action="done" data-task-id="${task.id}">Done</button>
      </div>
    </article>
  `;
}

function renderDailySmartTask(task) {
  const reason = isOverdue(task)
    ? "Overdue"
    : task.dueDate === state.selectedDailyDate
      ? "Due today"
      : task.assignee === currentMemberId
        ? "Assigned to you"
        : "Suggested";

  return `
    <article class="daily-smart-card">
      <button class="table-task-button" type="button" data-edit-task="${task.id}">
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(projectName(task.projectId))} - ${reason}</span>
      </button>
      <div class="daily-actions">
        <button class="button button-secondary" type="button" data-daily-plan="now" data-task-id="${task.id}">Now</button>
        <button class="button button-secondary" type="button" data-daily-plan="next" data-task-id="${task.id}">Next</button>
        <button class="button button-secondary" type="button" data-daily-plan="later" data-task-id="${task.id}">Later</button>
      </div>
    </article>
  `;
}

function renderInbox() {
  const items = getInboxItems();
  const unreadItems = items.filter((item) => !isInboxRead(item.id));
  const urgentItems = items.filter((item) => item.type === "overdue" || item.type === "assignment" || item.type === "approval");
  const dueItems = items.filter((item) => item.type === "due soon");
  const activityItems = items.filter((item) => item.type === "comment" || item.type === "activity");
  const approvalItems = items.filter((item) => item.type === "approval");
  const briefs = operatorBriefs(3);

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Unread", unreadItems.length)}
      ${metric("Needs action", urgentItems.length)}
      ${metric("Due soon", dueItems.length)}
      ${metric("Approvals", approvalItems.length)}
    </div>

    <div class="command-center-grid">
      <section class="panel inbox-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Command center</p>
            <h2>Inbox</h2>
          </div>
          <div class="inbox-header-actions">
            <button class="button button-secondary" type="button" data-inbox-bulk="read" ${items.length ? "" : "disabled"}>Mark All Read</button>
            <button class="button button-secondary" type="button" data-inbox-bulk="archive-read" ${items.some((item) => isInboxRead(item.id)) ? "" : "disabled"}>Clear Read</button>
          </div>
        </div>
        <div class="inbox-lanes">
          ${renderInboxLane("Needs action", urgentItems)}
          ${renderInboxLane("Approvals", approvalItems)}
          ${renderInboxLane("Due soon", dueItems)}
          ${renderInboxLane("Activity", activityItems)}
        </div>
      </section>

      <section class="panel operator-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">AI operator</p>
            <h2>Project briefs</h2>
          </div>
        </div>
        <div class="operator-brief-list">
          ${briefs.length ? briefs.map(renderOperatorBrief).join("") : emptyState("No active projects need attention.")}
        </div>
      </section>
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
        ${items.length ? items.slice(0, 6).map(renderInboxItem).join("") : emptyState("Nothing here right now.")}
      </div>
    </section>
  `;
}

function renderOperatorBrief(brief) {
  const tone = brief.health < 45 ? "red" : brief.health < 70 ? "amber" : "green";
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
      <div class="operator-metrics">
        <span><strong>${brief.blocked.length}</strong> blocked</span>
        <span><strong>${brief.dueSoon.length}</strong> due soon</span>
        <span><strong>${brief.approvals.length}</strong> approvals</span>
      </div>
    </article>
  `;
}

function renderInboxItem(item) {
  const read = isInboxRead(item.id);
  return `
    <article class="inbox-item ${read ? "is-read" : "is-unread"}">
      <div class="inbox-main">
        <span class="status-pill inbox-${item.tone}">${escapeHtml(item.type)}</span>
        <button class="table-task-button" type="button" ${item.taskId ? `data-edit-task="${item.taskId}" data-inbox-id="${item.id}"` : ""}>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.message)}</span>
        </button>
        <div class="meta-row">
          <span>${escapeHtml(projectName(item.projectId))}</span>
          <span>${formatTimestamp(item.createdAt)}</span>
          ${read ? "<span>Read</span>" : "<span>Unread</span>"}
        </div>
      </div>
      <div class="inbox-actions">
        ${item.approvalId ? `<button class="button button-primary" type="button" data-approval-action="approved" data-approval-id="${item.approvalId}" data-inbox-id="${item.id}">Approve</button>` : ""}
        ${item.approvalId ? `<button class="button button-secondary" type="button" data-approval-action="needs-changes" data-approval-id="${item.approvalId}" data-inbox-id="${item.id}">Needs Changes</button>` : ""}
        ${item.taskId ? `<button class="button button-secondary" type="button" data-inbox-plan="${item.taskId}" data-inbox-id="${item.id}">Plan Today</button>` : ""}
        ${item.taskId ? `<button class="button button-secondary" type="button" data-edit-task="${item.taskId}" data-inbox-id="${item.id}">Open</button>` : ""}
        <button class="button button-secondary" type="button" data-inbox-read="${item.id}">${read ? "Mark Unread" : "Mark Read"}</button>
        <button class="button button-secondary" type="button" data-inbox-clear="${item.id}">Clear</button>
      </div>
    </article>
  `;
}

function renderCompanies() {
  const companies = state.filters.company === "all"
    ? state.companies
    : state.companies.filter((company) => company.id === state.filters.company);
  const allCompanyTasks = companies.flatMap((company) => getCompanyTasks(company.id));
  const openTasks = allCompanyTasks.filter((task) => task.status !== "done");
  const overdueTasks = allCompanyTasks.filter(isOverdue);
  const trackedMinutes = sumMinutes(companies.flatMap((company) => getCompanyTimeEntries(company.id)));

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Companies", companies.length)}
      ${metric("Projects", companies.reduce((total, company) => total + getCompanyProjects(company.id).length, 0))}
      ${metric("Open tasks", openTasks.length)}
      ${metric("Tracked", formatDuration(trackedMinutes))}
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Portfolio</p>
          <h2>Companies</h2>
        </div>
        <button class="button button-primary" type="button" id="new-company-button">New Company</button>
      </div>
      <div class="company-grid">
        ${companies.map(renderCompanyCard).join("")}
      </div>
    </section>
  `;
}

function renderCompanyCard(company) {
  const projects = getCompanyProjects(company.id);
  const tasks = getCompanyTasks(company.id);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueTasks = tasks.filter(isOverdue);
  const milestones = getCompanyMilestones(company.id);
  const trackedMinutes = sumMinutes(getCompanyTimeEntries(company.id));
  const progress = projectProgress(tasks);
  const portal = companyPortalSnapshot(company.id);

  return `
    <article class="company-card">
      <button class="company-card-main" type="button" data-company-id="${company.id}">
        <span class="status-pill status-${company.status}">${escapeHtml(company.status)}</span>
        <h3>${escapeHtml(company.name)}</h3>
        <p>${escapeHtml(company.description)}</p>
      </button>
      <div class="meta-row">
        <span>${escapeHtml(company.type)}</span>
        <span>Owner ${memberName(company.owner)}</span>
      </div>
      <div class="company-metrics">
        <span><strong>${projects.length}</strong> projects</span>
        <span><strong>${openTasks.length}</strong> open</span>
        <span><strong>${overdueTasks.length}</strong> overdue</span>
        <span><strong>${portal.pendingApprovals.length}</strong> approvals</span>
      </div>
      <div class="progress-block" aria-label="${progress}% complete">
        <strong>${progress}%</strong>
        <span class="progress-track"><span style="width: ${progress}%"></span></span>
      </div>
      <div class="tag-row">
        <span>${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"}</span>
        <span>${portal.documents.length + portal.files.length} shared assets</span>
        <span>${formatDuration(trackedMinutes)} tracked</span>
      </div>
      <button class="button button-secondary" type="button" data-edit-company="${company.id}">Edit Company</button>
    </article>
  `;
}

function renderCompanyPortal(company) {
  const portal = companyPortalSnapshot(company.id);
  const latestApprovals = portal.approvals.slice(0, 4);
  const sharedAssets = [...portal.documents, ...portal.files]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

  return `
    <section class="panel portal-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Client portal</p>
          <h2>${escapeHtml(company.name)} portal</h2>
        </div>
        <button class="button button-primary" type="button" data-company-update="${company.id}">Draft Update</button>
      </div>
      <div class="portal-grid">
        <article class="portal-status-card">
          <span class="status-pill inbox-${portal.pendingApprovals.length ? "amber" : "green"}">${portal.pendingApprovals.length ? "Needs client" : "Clear"}</span>
          <h3>${portal.progress}% complete</h3>
          <p>${portal.openTasks.length} open ${portal.openTasks.length === 1 ? "task" : "tasks"} across ${portal.projects.length} ${portal.projects.length === 1 ? "project" : "projects"}.</p>
          <small>${portal.updatedAt ? `Updated ${formatTimestamp(portal.updatedAt)}` : "No recent updates"}</small>
        </article>

        <div class="portal-list">
          <div class="portal-list-header">
            <h3>Approvals</h3>
            <span>${portal.pendingApprovals.length} pending</span>
          </div>
          ${latestApprovals.length ? latestApprovals.map(renderApprovalRow).join("") : emptyState("No approvals for this company yet.")}
        </div>

        <div class="portal-list">
          <div class="portal-list-header">
            <h3>Shared assets</h3>
            <span>${sharedAssets.length}</span>
          </div>
          ${sharedAssets.length ? sharedAssets.map((asset) => `
            <article class="portal-asset-row">
              <div>
                <strong>${escapeHtml(asset.title)}</strong>
                <span>${escapeHtml(asset.type || asset.kind)} / ${escapeHtml(projectName(asset.projectId))}</span>
              </div>
              <small>${formatTimestamp(asset.updatedAt)}</small>
            </article>
          `).join("") : emptyState("No shared docs or files yet.")}
        </div>
      </div>
    </section>
  `;
}

function renderClientPortal() {
  const companyId = clientCompanyId();
  const company = byId(state.companies, companyId);
  if (!company) {
    els.appView.innerHTML = `
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Client portal</p>
            <h2>Portal unavailable</h2>
          </div>
        </div>
        ${emptyState("No company is assigned to this client account yet.")}
      </section>
    `;
    return;
  }

  const portal = companyPortalSnapshot(company.id);
  const visibleTasks = portal.tasks.filter((task) => task.status !== "done").slice(0, 6);
  const sharedAssets = [...portal.documents, ...portal.files]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6);

  els.appView.innerHTML = `
    <section class="project-hero portal-hero">
      <div>
        <p class="eyebrow">Client portal</p>
        <h2>${escapeHtml(company.name)}</h2>
        <p>${escapeHtml(company.description || "Shared project visibility, approvals, files, and updates.")}</p>
        <div class="meta-row">
          <span>${portal.projects.length} ${portal.projects.length === 1 ? "project" : "projects"}</span>
          <span>${portal.pendingApprovals.length} pending approvals</span>
          <span>${portal.progress}% complete</span>
        </div>
      </div>
      <div class="project-progress-card">
        <span>Portal status</span>
        <strong>${portal.pendingApprovals.length ? "Needs review" : "On track"}</strong>
        <span>${portal.updatedAt ? `Updated ${formatTimestamp(portal.updatedAt)}` : "No recent updates"}</span>
        <button class="button button-secondary" type="button" id="api-disconnect">Sign Out</button>
      </div>
    </section>

    <div class="metric-grid">
      ${metric("Open tasks", portal.openTasks.length)}
      ${metric("Approvals", portal.pendingApprovals.length)}
      ${metric("Shared assets", sharedAssets.length)}
      ${metric("Progress", `${portal.progress}%`)}
    </div>

    <div class="client-portal-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Approvals</p>
            <h2>Review queue</h2>
          </div>
        </div>
        <div class="portal-list">
          ${portal.approvals.length ? portal.approvals.map(renderApprovalRow).join("") : emptyState("No approvals are waiting on you.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Shared work</p>
            <h2>Docs & files</h2>
          </div>
        </div>
        <div class="portal-list">
          ${sharedAssets.length ? sharedAssets.map((asset) => `
            <article class="portal-asset-row">
              <div>
                <strong>${escapeHtml(asset.title)}</strong>
                <span>${escapeHtml(asset.type || asset.kind)} / ${escapeHtml(projectName(asset.projectId))}</span>
              </div>
              <small>${formatTimestamp(asset.updatedAt)}</small>
            </article>
          `).join("") : emptyState("No shared assets yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Projects</p>
            <h2>Status summary</h2>
          </div>
        </div>
        <div class="project-summary-list">
          ${portal.projects.length ? portal.projects.map(renderProjectSummary).join("") : emptyState("No shared projects yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Next up</p>
            <h2>Open work</h2>
          </div>
        </div>
        <div class="task-stack">
          ${visibleTasks.length ? visibleTasks.map(renderClientTaskSummary).join("") : emptyState("No open work is visible right now.")}
        </div>
      </section>
    </div>
  `;
}

function renderClientTaskSummary(task) {
  return `
    <article class="client-task-summary">
      <div>
        <strong>${escapeHtml(task.title)}</strong>
        <p>${escapeHtml(task.description)}</p>
        <div class="meta-row">
          <span>${escapeHtml(projectName(task.projectId))}</span>
          <span>${statusLabel(task.status)}</span>
          <span>${formatDate(task.dueDate)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderApprovalRow(approval) {
  return `
    <article class="approval-row">
      <div>
        <span class="status-pill inbox-${approvalTone(approval.status)}">${escapeHtml(approvalStatusLabel(approval.status))}</span>
        <h3>${escapeHtml(approval.title)}</h3>
        <p>${escapeHtml(approval.summary)}</p>
        <small>${escapeHtml(projectName(approval.projectId))} / due ${formatDate(approval.dueDate)} / reviewer ${escapeHtml(approval.reviewer)}</small>
      </div>
      <div class="approval-actions">
        ${approval.status !== "approved" ? `<button class="button button-primary compact-button" type="button" data-approval-action="approved" data-approval-id="${approval.id}">Approve</button>` : ""}
        ${approval.status !== "needs-changes" ? `<button class="button button-secondary compact-button" type="button" data-approval-action="needs-changes" data-approval-id="${approval.id}">Changes</button>` : ""}
      </div>
    </article>
  `;
}

function renderCompanyPage() {
  const company = byId(state.companies, state.selectedCompany);
  if (!company) {
    state.selectedCompany = "all";
    state.selectedRoute = "companies";
    renderCompanies();
    return;
  }

  const projects = getCompanyProjects(company.id);
  const tasks = getCompanyTasks(company.id);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueTasks = tasks.filter(isOverdue);
  const milestones = getCompanyMilestones(company.id);
  const trackedMinutes = sumMinutes(getCompanyTimeEntries(company.id));
  const nextMilestones = [...milestones]
    .filter((milestone) => milestone.status !== "completed")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);

  els.appView.innerHTML = `
    <section class="project-hero">
      <div>
        <p class="eyebrow">Company portfolio</p>
        <h2>${escapeHtml(company.name)}</h2>
        <p>${escapeHtml(company.description)}</p>
        <div class="meta-row">
          <span>${escapeHtml(company.type)}</span>
          <span>Owner ${memberName(company.owner)}</span>
          <span>${escapeHtml(company.status)}</span>
        </div>
      </div>
      <div class="project-progress-card">
        <span>Tracked time</span>
        <strong>${formatDuration(trackedMinutes)}</strong>
        <span>${projects.length} ${projects.length === 1 ? "project" : "projects"}</span>
        <button class="button button-secondary" type="button" data-edit-company="${company.id}">Edit Company</button>
      </div>
    </section>

    <div class="metric-grid">
      ${metric("Projects", projects.length)}
      ${metric("Open tasks", openTasks.length)}
      ${metric("Overdue", overdueTasks.length)}
      ${metric("Milestones", milestones.length)}
    </div>

    ${renderCompanyPortal(company)}

    <div class="company-detail-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Projects</p>
            <h2>Active work</h2>
          </div>
        </div>
        <div class="project-summary-list">
          ${projects.length ? projects.map(renderProjectSummary).join("") : emptyState("No projects for this company yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Milestones</p>
            <h2>Coming up</h2>
          </div>
        </div>
        <div class="milestone-list">
          ${nextMilestones.length ? nextMilestones.map(renderMilestoneCard).join("") : emptyState("No active milestones for this company.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Pulse</p>
            <h2>Recent activity</h2>
          </div>
        </div>
        ${renderActivityList(getCompanyActivity(company.id, 6))}
      </section>
    </div>
  `;
}

function metric(label, value) {
  return `
    <section class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </section>
  `;
}

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

function renderProjectPage() {
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

  els.appView.innerHTML = `
    <section class="project-hero">
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
          <button class="button button-secondary button-danger" type="button" data-archive-project="${project.id}">Archive Project</button>
        </div>
      </div>
      <div class="project-progress-card">
        <span>Progress</span>
        <strong>${progress}%</strong>
        <span class="progress-track"><span style="width: ${progress}%"></span></span>
      </div>
    </section>

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
          ${filteredProjectTasks.filter((task) => task.status !== "done").slice(0, 5).map(renderTaskCard).join("") || emptyState("No open tasks match the current filters.")}
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
        ${nextMilestone ? renderMilestoneCard(nextMilestone) : emptyState(`${escapeHtml(project.name)} does not have an active milestone yet.`)}
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
    </div>
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
      ` : emptyState("No project tasks match those filters.")}
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
      <td>${selectControl("status", task.id, task.status, statuses)}</td>
      <td>${selectControl("priority", task.id, task.priority, priorities)}</td>
      <td class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}</td>
      <td><button class="button button-secondary button-danger compact-button" type="button" data-archive-task="${task.id}">Archive</button></td>
    </tr>
  `;
}

function renderProjectBoard(tasks) {
  return `
    <div class="board" aria-label="Project task board">
      ${statuses.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status.id);
        return `
          <section class="board-column" data-status="${status.id}">
            <div class="board-column-header">
              <h2>${status.label}</h2>
              <span>${columnTasks.length}</span>
            </div>
            <div class="task-stack" data-drop-status="${status.id}">
              ${columnTasks.length ? columnTasks.map(renderTaskCard).join("") : emptyState("No tasks here.")}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderProjectTimeline(project, tasks, milestones) {
  const datedTasks = tasks.filter((task) => task.dueDate);
  const undatedTasks = tasks.filter((task) => !task.dueDate);
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
      </div>

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

      ${gantt}

      <div class="timeline-list">
        ${timelineItems.length ? timelineItems.map(renderTimelineItem).join("") : emptyState("Add dates to tasks or milestones to build this timeline.")}
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

function renderProjectGantt(project, tasks, milestones) {
  const scheduledTasks = tasks.filter((task) => task.dueDate);
  if (!scheduledTasks.length) return emptyState("Add task start and due dates to build a Gantt chart.");

  const dates = [
    project.startDate,
    project.dueDate,
    ...scheduledTasks.flatMap((task) => [taskStartDate(task), task.dueDate]),
    ...milestones.map((milestone) => milestone.dueDate)
  ].filter(Boolean).sort();
  const rangeStart = dates[0];
  const rangeEnd = dates[dates.length - 1];
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd));
  const ticks = Array.from({ length: 5 }, (_, index) => shiftDate(rangeStart, Math.round((totalDays * index) / 4)));
  const visibleMilestones = milestones.filter((milestone) => milestone.dueDate);

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
      <div class="gantt-scale" aria-hidden="true">
        <span></span>
        <div>
          ${ticks.map((tick) => `<span>${formatDate(tick)}</span>`).join("")}
        </div>
      </div>
      <div class="gantt-list">
        ${scheduledTasks
          .sort((a, b) => taskStartDate(a).localeCompare(taskStartDate(b)))
          .map((task) => renderGanttTaskRow(task, rangeStart, totalDays, visibleMilestones))
          .join("")}
      </div>
    </section>
  `;
}

function renderGanttTaskRow(task, rangeStart, totalDays, milestones) {
  const start = taskStartDate(task);
  const end = task.dueDate || start;
  const offset = Math.max(0, daysBetween(rangeStart, start));
  const duration = Math.max(1, daysBetween(start, end) + 1);
  const left = Math.min(100, (offset / totalDays) * 100);
  const width = Math.max(4, Math.min(100 - left, (duration / totalDays) * 100));
  const dependencies = taskDependencies(task);
  const openDependencies = openTaskDependencies(task);

  return `
    <article class="gantt-row ${openDependencies.length ? "is-blocked" : ""}">
      <div class="gantt-label">
        <button class="table-task-button" type="button" data-edit-task="${task.id}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${memberName(task.assignee)} - ${statusLabel(task.status)}</span>
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
        <span class="gantt-bar priority-${task.priority}" style="left: ${left}%; width: ${width}%;">
          <span>${formatDate(start)} - ${formatDate(end)}</span>
        </span>
      </div>
      <div class="gantt-dependencies">
        ${dependencies.length ? `Waits on ${dependencies.map((dependency) => escapeHtml(dependency.title)).join(", ")}` : "No blockers"}
        ${openDependencies.length ? `<strong>${openDependencies.length} open</strong>` : ""}
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
        ${milestones.length ? milestones.map(renderMilestoneCard).join("") : emptyState("No milestones have been planned for this project.")}
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
  const activities = getTaskActivity(taskId, 5);
  const presence = collaborationPresenceForTask(taskId);

  container.innerHTML = `
    <div class="collaboration-grid">
      <section>
        <div class="collaboration-header">
          <p class="eyebrow">Comments</p>
          <span>${comments.length}</span>
        </div>
        <div class="presence-row" aria-label="Collaborators">
          ${presence.map((member) => `<span class="presence-pill"><span class="avatar">${member.name.split(" ").map((part) => part[0]).join("")}</span>${escapeHtml(member.name)}</span>`).join("")}
        </div>
        <div class="comment-list">
          ${comments.length ? comments.map(renderComment).join("") : emptyState("No comments yet.")}
        </div>
        <div class="comment-composer">
          <textarea id="comment-body" rows="3" placeholder="Add a comment or @mention a teammate"></textarea>
          <button class="button button-secondary" type="button" id="comment-submit">Comment</button>
        </div>
      </section>
      <section>
        <p class="eyebrow">Activity</p>
        ${renderActivityList(activities)}
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
            <select id="time-member">
              ${workspaceMembers().map((member) => `<option value="${member.id}" ${member.id === currentMemberId ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
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

function renderComment(comment) {
  return `
    <article class="comment-item">
      <span class="avatar">${memberName(comment.author).split(" ").map((part) => part[0]).join("")}</span>
      <div>
        <div class="comment-meta">
          <strong>${memberName(comment.author)}</strong>
          <small>${formatTimestamp(comment.createdAt)}</small>
        </div>
        <p>${escapeHtml(comment.body)}</p>
      </div>
    </article>
  `;
}

function renderBoard() {
  const tasks = getFilteredTasks();
  els.appView.innerHTML = `
    <div class="board" aria-label="Task board">
      ${statuses.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status.id);
        return `
          <section class="board-column" data-status="${status.id}">
            <div class="board-column-header">
              <h2>${status.label}</h2>
              <span>${columnTasks.length}</span>
            </div>
            <div class="task-stack" data-drop-status="${status.id}">
              ${columnTasks.length ? columnTasks.map(renderTaskCard).join("") : emptyState("No tasks here.")}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderList() {
  const tasks = getFilteredTasks();
  els.appView.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Tasks</p>
          <h2>${tasks.length} matching ${tasks.length === 1 ? "task" : "tasks"}</h2>
        </div>
      </div>
      ${tasks.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(renderTaskRow).join("")}
            </tbody>
          </table>
        </div>
      ` : emptyState("No tasks match those filters.")}
    </section>
  `;
}

function renderCalendar() {
  const tasks = getFilteredTasks().filter((task) => task.dueDate);
  const projectIds = new Set(tasks.map((task) => task.projectId));
  const milestones = state.milestones.filter((milestone) => {
    if (!milestone.dueDate) return false;
    const project = byId(state.projects, milestone.projectId);
    return (
      (!project || state.filters.company === "all" || project.companyId === state.filters.company) &&
      (state.selectedProject === "all" || milestone.projectId === state.selectedProject) &&
      (state.selectedProject !== "all" || state.filters.company === "all" || projectIds.has(milestone.projectId) || project?.companyId === state.filters.company)
    );
  });
  const monthStart = new Date(`${state.selectedCalendarMonth}-01T12:00:00`);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const itemsByDate = [...tasks.map((task) => ({
    id: task.id,
    type: "task",
    title: task.title,
    projectId: task.projectId,
    date: task.dueDate,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee
  })), ...milestones.map((milestone) => ({
    id: milestone.id,
    type: "milestone",
    title: milestone.title,
    projectId: milestone.projectId,
    date: milestone.dueDate,
    status: milestone.status,
    priority: "normal",
    assignee: milestone.owner
  }))].reduce((grouped, item) => {
    grouped[item.date] = [...(grouped[item.date] || []), item];
    return grouped;
  }, {});
  const monthItems = Object.values(itemsByDate).flat().filter((item) => item.date.startsWith(state.selectedCalendarMonth));
  const openMonthTasks = tasks.filter((task) => task.dueDate.startsWith(state.selectedCalendarMonth) && task.status !== "done");

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Scheduled", monthItems.length)}
      ${metric("Open tasks", openMonthTasks.length)}
      ${metric("Milestones", milestones.filter((milestone) => milestone.dueDate.startsWith(state.selectedCalendarMonth)).length)}
      ${metric("Overdue", tasks.filter(isOverdue).length)}
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Plan</p>
          <h2>${monthLabel(state.selectedCalendarMonth)}</h2>
        </div>
        <div class="calendar-actions">
          <button class="icon-button" type="button" data-calendar-shift="-1" aria-label="Previous month">&lt;</button>
          <button class="button button-secondary" type="button" data-calendar-today>Today</button>
          <button class="icon-button" type="button" data-calendar-shift="1" aria-label="Next month">&gt;</button>
        </div>
      </div>
      <div class="calendar-grid" aria-label="${monthLabel(state.selectedCalendarMonth)} calendar">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}
        ${days.map((date) => renderCalendarDay(date, itemsByDate[calendarDateKey(date)] || [], monthStart.getMonth())).join("")}
      </div>
    </section>
  `;
}

function renderCalendarDay(date, items, activeMonth) {
  const key = calendarDateKey(date);
  const isMuted = date.getMonth() !== activeMonth;
  const today = calendarDateKey(new Date()) === key;
  return `
    <section class="calendar-day ${isMuted ? "is-muted" : ""} ${today ? "is-today" : ""}">
      <div class="calendar-date">${date.getDate()}</div>
      <div class="calendar-items">
        ${items.slice(0, 4).map(renderCalendarItem).join("")}
        ${items.length > 4 ? `<span class="calendar-more">+${items.length - 4} more</span>` : ""}
      </div>
    </section>
  `;
}

function renderCalendarItem(item) {
  const isTask = item.type === "task";
  return `
    <button class="calendar-item calendar-${item.type}" type="button" ${isTask ? `data-edit-task="${item.id}"` : ""}>
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(projectName(item.projectId))}</span>
    </button>
  `;
}

function renderMyWork() {
  if (state.filters.assignee === "all") {
    state.filters.assignee = members[0].id;
    saveState();
    renderFilters();
  }

  const tasks = getFilteredTasks();
  const grouped = statuses.map((status) => ({
    ...status,
    tasks: tasks.filter((task) => task.status === status.id)
  }));

  els.appView.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Assigned to</p>
          <h2>${memberName(state.filters.assignee)}</h2>
        </div>
      </div>
      <div class="work-lanes">
        ${grouped.map((group) => `
          <section class="work-lane">
            <div class="board-column-header">
              <h3>${group.label}</h3>
              <span>${group.tasks.length}</span>
            </div>
            <div class="task-stack">
              ${group.tasks.length ? group.tasks.map(renderTaskCard).join("") : emptyState("Nothing assigned.")}
            </div>
          </section>
        `).join("")}
      </div>
    </section>
  `;
}

function renderReports() {
  const { tasks, projects, timeEntries, submissions } = reportTaskScope();
  const projectRows = projects.map((project) => projectReport(project, tasks, timeEntries, submissions));
  const visibleCompanies = state.filters.company === "all"
    ? state.companies
    : state.companies.filter((company) => company.id === state.filters.company);
  const companyRows = visibleCompanies.map((company) => companyReport(company, tasks, timeEntries, submissions));
  const openTasks = tasks.filter((task) => task.status !== "done");
  const blockedTasks = tasks.filter(isTaskBlocked);
  const overdueTasks = tasks.filter(isOverdue);
  const openIntake = submissions.filter((submission) => !submission.taskId);
  const averageHealth = projectRows.length
    ? Math.round(projectRows.reduce((total, row) => total + row.health, 0) / projectRows.length)
    : 100;

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Health", `${averageHealth}%`)}
      ${metric("Open work", openTasks.length)}
      ${metric("Blocked", blockedTasks.length)}
      ${metric("Tracked", formatDuration(sumMinutes(timeEntries)))}
    </div>

    <div class="reports-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Project health</p>
            <h2>Delivery risk</h2>
          </div>
        </div>
        <div class="report-card-list">
          ${projectRows.length ? projectRows
            .sort((a, b) => a.health - b.health)
            .map(renderProjectReportCard)
            .join("") : emptyState("No projects match the current report filters.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Portfolio</p>
            <h2>Company comparison</h2>
          </div>
        </div>
        <div class="portfolio-report-list">
          ${companyRows.length ? companyRows
            .sort((a, b) => a.health - b.health)
            .map(renderCompanyReportRow)
            .join("") : emptyState("No companies match the current report filters.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">People</p>
            <h2>Workload</h2>
          </div>
        </div>
        <div class="workload-report-list">
          ${workspaceMembers().map((member) => renderWorkloadReportRow(member, tasks, timeEntries)).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Attention</p>
            <h2>Risk queue</h2>
          </div>
        </div>
        ${renderRiskQueue(overdueTasks, blockedTasks, openIntake)}
      </section>
    </div>
  `;
}

function renderProjectReportCard(row) {
  return `
    <article class="report-card">
      <div class="report-card-main">
        <button class="table-task-button" type="button" data-project-id="${row.project.id}">
          <strong>${escapeHtml(row.project.name)}</strong>
          <span>${escapeHtml(companyName(row.project.companyId))} - ${memberName(row.project.owner)}</span>
        </button>
        ${renderHealthBar(row.health)}
      </div>
      <div class="report-metrics">
        <span><strong>${row.openTasks.length}</strong> open</span>
        <span><strong>${row.overdue.length}</strong> overdue</span>
        <span><strong>${row.blocked.length}</strong> blocked</span>
        <span><strong>${row.dueSoon.length}</strong> due soon</span>
        <span><strong>${row.openIntake.length}</strong> intake</span>
        <span><strong>${formatDuration(row.trackedMinutes)}</strong> tracked</span>
      </div>
    </article>
  `;
}

function renderCompanyReportRow(row) {
  return `
    <article class="portfolio-report-row">
      <button class="table-task-button" type="button" data-company-id="${row.company.id}">
        <strong>${escapeHtml(row.company.name)}</strong>
        <span>${row.projectCount} ${row.projectCount === 1 ? "project" : "projects"} - owner ${memberName(row.company.owner)}</span>
      </button>
      ${renderHealthBar(row.health)}
      <div class="portfolio-report-metrics">
        <span>${row.openTasks.length} open</span>
        <span>${row.overdue.length} overdue</span>
        <span>${row.blocked.length} blocked</span>
        <span>${formatDuration(row.trackedMinutes)}</span>
      </div>
    </article>
  `;
}

function renderWorkloadReportRow(member, tasks, timeEntries) {
  const assignedTasks = tasks.filter((task) => task.assignee === member.id);
  const openTasks = assignedTasks.filter((task) => task.status !== "done");
  const blockedTasks = assignedTasks.filter(isTaskBlocked);
  const dueSoon = dueSoonTasks(assignedTasks);
  const loggedMinutes = sumMinutes(timeEntries.filter((entry) => entry.memberId === member.id));
  const loadScore = clamp(openTasks.length * 16 + dueSoon.length * 12 + blockedTasks.length * 10, 0, 100);

  return `
    <article class="workload-report-row">
      <div>
        <span class="avatar">${member.name.split(" ").map((part) => part[0]).join("")}</span>
        <div>
          <h3>${member.name}</h3>
          <p>${member.role}</p>
        </div>
      </div>
      <div class="workload-bar" aria-label="${loadScore}% workload">
        <span style="width: ${loadScore}%"></span>
      </div>
      <div class="portfolio-report-metrics">
        <span>${openTasks.length} open</span>
        <span>${blockedTasks.length} blocked</span>
        <span>${dueSoon.length} due soon</span>
        <span>${formatDuration(loggedMinutes)}</span>
      </div>
    </article>
  `;
}

function renderRiskQueue(overdueTasks, blockedTasks, openIntake) {
  const risks = [
    ...overdueTasks.map((task) => ({ type: "Overdue", tone: "red", title: task.title, detail: `${projectName(task.projectId)} - due ${formatDate(task.dueDate)}`, taskId: task.id })),
    ...blockedTasks.map((task) => ({ type: "Blocked", tone: "amber", title: task.title, detail: `Waiting on ${openTaskDependencies(task).map((dependency) => dependency.title).join(", ")}`, taskId: task.id })),
    ...openIntake.map((submission) => {
      const form = byId(state.intakeForms, submission.formId);
      return { type: "Intake", tone: "green", title: submission.title, detail: `${form?.title || "Request"} - ${submission.requester}`, submissionId: submission.id };
    })
  ];

  if (!risks.length) return emptyState("No overdue, blocked, or open intake items match the current filters.");

  return `
    <div class="risk-list">
      ${risks.slice(0, 8).map((risk) => `
        <article class="risk-item">
          <span class="status-pill inbox-${risk.tone}">${escapeHtml(risk.type)}</span>
          <button class="table-task-button" type="button" ${risk.taskId ? `data-edit-task="${risk.taskId}"` : ""}>
            <strong>${escapeHtml(risk.title)}</strong>
            <span>${escapeHtml(risk.detail)}</span>
          </button>
        </article>
      `).join("")}
    </div>
  `;
}

function renderHealthBar(score) {
  const tone = score < 50 ? "danger" : score < 75 ? "warn" : "good";
  return `
    <div class="health-bar health-${tone}" aria-label="${score}% health">
      <span style="width: ${score}%"></span>
      <strong>${score}%</strong>
    </div>
  `;
}

function renderTemplates() {
  const projectTemplateTaskCount = state.projectTemplates.reduce((total, template) => total + template.tasks.length, 0);
  const projectTemplateDocCount = state.projectTemplates.reduce((total, template) => total + template.docs.length, 0);

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Project templates", state.projectTemplates.length)}
      ${metric("Task templates", state.taskTemplates.length)}
      ${metric("Template tasks", projectTemplateTaskCount)}
      ${metric("Template docs", projectTemplateDocCount)}
    </div>

    <div class="templates-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Starter packs</p>
            <h2>Project templates</h2>
          </div>
        </div>
        <div class="template-list">
          ${state.projectTemplates.map(renderProjectTemplateCard).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Reusable work</p>
            <h2>Task templates</h2>
          </div>
        </div>
        <div class="template-list">
          ${state.taskTemplates.map(renderTaskTemplateCard).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderProjectTemplateCard(template) {
  const defaultCompany = state.filters.company === "all" ? state.companies[0]?.id : state.filters.company;
  return `
    <article class="template-card" data-project-template-card="${template.id}">
      <div>
        <span class="status-pill inbox-blue">${escapeHtml(template.category)}</span>
        <h3>${escapeHtml(template.name)}</h3>
        <p>${escapeHtml(template.description)}</p>
        <div class="template-meta">
          <span>${template.tasks.length} tasks</span>
          <span>${template.milestones.length} milestones</span>
          <span>${template.docs.length} docs</span>
          <span>${template.durationDays} days</span>
        </div>
      </div>
      <div class="template-controls">
        <label>
          <span>Company</span>
          <select data-template-company>
            ${state.companies.map((company) => `<option value="${company.id}" ${company.id === defaultCompany ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Start</span>
          <input type="date" data-template-start value="${todayKey()}">
        </label>
        <label class="wide-field">
          <span>Project name</span>
          <input data-template-name placeholder="${escapeHtml(template.name)}">
        </label>
        <button class="button button-primary" type="button" data-use-project-template="${template.id}">Create Project</button>
      </div>
    </article>
  `;
}

function renderTaskTemplateCard(template) {
  const defaultProject = state.selectedProject === "all" ? activeProjects()[0]?.id : state.selectedProject;
  return `
    <article class="template-card" data-task-template-card="${template.id}">
      <div>
        <span class="status-pill inbox-green">${escapeHtml(priorityLabel(template.priority))}</span>
        <h3>${escapeHtml(template.name)}</h3>
        <p>${escapeHtml(template.description)}</p>
        <div class="template-meta">
          <span>${memberName(template.assignee)}</span>
          <span>${template.durationDays} days</span>
          <span>${template.subtasks.length} checklist</span>
        </div>
      </div>
      <div class="template-controls">
        <label class="wide-field">
          <span>Project</span>
          <select data-task-template-project>
            ${activeProjects().map((project) => `<option value="${project.id}" ${project.id === defaultProject ? "selected" : ""}>${escapeHtml(project.name)}</option>`).join("")}
          </select>
        </label>
        <button class="button button-secondary" type="button" data-use-task-template="${template.id}">Create Task</button>
      </div>
    </article>
  `;
}

function renderAutomations() {
  const enabled = state.automations.filter((automation) => automation.enabled);
  const recentHistory = state.automationHistory.slice(0, 8);
  const suggestions = automationSuggestions();

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Rules", state.automations.length)}
      ${metric("Enabled", enabled.length)}
      ${metric("Runs", state.automations.reduce((total, automation) => total + Number(automation.runCount || 0), 0))}
      ${metric("Recent changes", recentHistory.reduce((total, run) => total + Number(run.changedCount || 0), 0))}
    </div>

    <div class="automation-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Rules</p>
            <h2>Automations</h2>
          </div>
          <button class="button button-primary" type="button" id="automation-run-all" ${enabled.length ? "" : "disabled"}>Run Enabled</button>
        </div>
        <div class="automation-list">
          ${state.automations.map(renderAutomationCard).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Audit</p>
            <h2>Run history</h2>
          </div>
        </div>
        <div class="automation-history-list">
          ${recentHistory.length ? recentHistory.map(renderAutomationHistory).join("") : emptyState("Automations have not run yet.")}
        </div>
      </section>

      <section class="panel automation-suggestion-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Recommended</p>
            <h2>Human automations</h2>
          </div>
        </div>
        <div class="automation-suggestion-list">
          ${suggestions.map(renderAutomationSuggestion).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderAutomationSuggestion(suggestion) {
  return `
    <article class="automation-suggestion ${suggestion.ready ? "is-ready" : ""}">
      <div>
        <span class="status-pill inbox-${suggestion.ready ? "green" : "neutral"}">${suggestion.ready ? "Ready" : "Watch"}</span>
        <h3>${escapeHtml(suggestion.title)}</h3>
        <p>${escapeHtml(suggestion.description)}</p>
        <small>${escapeHtml(suggestion.impact)}</small>
      </div>
      <button class="button button-secondary compact-button" type="button" data-automation-suggestion="${suggestion.id}">Log Idea</button>
    </article>
  `;
}

function renderSettings() {
  const roleById = Object.fromEntries(workspaceRoles.map((role) => [role.id, role]));
  const teamMembers = workspaceMembers();
  const pendingInvitations = state.invitations.filter((invitation) => invitation.status === "pending");
  const memberships = teamMembers.map((member) => ({
    ...member,
    membership: state.memberships.find((item) => item.memberId === member.id) || {
      memberId: member.id,
      role: state.workspace.defaultRole,
      status: "active"
    }
  }));

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Members", memberships.length)}
      ${metric("Roles", workspaceRoles.length)}
      ${metric("Companies", state.companies.length)}
      ${metric("Storage", apiBackendLabel())}
    </div>

    <div class="settings-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Connection</p>
            <h2>API sync</h2>
          </div>
          <span class="status-pill ${apiConnectionTone()}">${escapeHtml(apiStatusLabel())}</span>
        </div>
        <div class="api-sync-card">
          <div>
            <strong>${escapeHtml(apiConnectionLabel())}</strong>
            <p>${apiSession ? `Last synced ${escapeHtml(apiLastSyncedLabel())}` : "Start the API server, create the workspace owner account, or connect as a demo member."}</p>
          </div>
          <div class="api-sync-form">
            <label class="api-url-field">
              <span>API URL</span>
              <input id="api-base-url" value="${escapeHtml(API_BASE_URL)}" placeholder="http://127.0.0.1:8787">
            </label>
            <button class="button button-secondary" type="button" id="api-url-save">Save API URL</button>
            <label>
              <span>Name</span>
              <input id="api-account-name" placeholder="Workspace owner" value="${escapeHtml(apiSession?.user?.name || "")}">
            </label>
            <label>
              <span>Email</span>
              <input id="api-email" type="email" placeholder="teammate@company.com" value="${escapeHtml(apiSession?.user?.email || "")}">
            </label>
            <label>
              <span>Password</span>
              <input id="api-password" type="password" placeholder="8+ characters">
            </label>
            <button class="button button-primary" type="button" id="api-password-signup">Create Owner</button>
            <button class="button button-secondary" type="button" id="api-password-login">Password Sign In</button>
            <button class="button button-secondary" type="button" id="api-email-login">Sign In</button>
            <label>
              <span>Demo member</span>
              <select id="api-member">
                ${members.map((member) => `<option value="${member.id}" ${member.id === (apiSession?.user?.id || currentMemberId) ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
              </select>
            </label>
            <button class="button button-primary" type="button" id="api-connect">${apiSession ? "Switch User" : "Connect to API"}</button>
            <button class="button button-secondary" type="button" id="api-disconnect" ${apiSession ? "" : "disabled"}>Disconnect</button>
          </div>
          <div class="data-actions">
            <button class="button button-primary" type="button" id="api-save-workspace" ${apiSession ? "" : "disabled"}>Save to API</button>
            <button class="button button-secondary" type="button" id="api-load-workspace" ${apiSession ? "" : "disabled"}>Load from API</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Workspace</p>
            <h2>Settings</h2>
          </div>
        </div>
        <div class="settings-form">
          <label>
            <span>Name</span>
            <input id="workspace-name" value="${escapeHtml(state.workspace.name)}">
          </label>
          <label>
            <span>Slug</span>
            <input id="workspace-slug" value="${escapeHtml(state.workspace.slug)}">
          </label>
          <label>
            <span>Visibility</span>
            <select id="workspace-visibility">
              ${["Private", "Invite only", "Public"].map((option) => `<option value="${option}" ${option === state.workspace.visibility ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Default role</span>
            <select id="workspace-default-role">
              ${workspaceRoles.map((role) => `<option value="${role.id}" ${role.id === state.workspace.defaultRole ? "selected" : ""}>${escapeHtml(role.label)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Storage mode</span>
            <input value="${escapeHtml(state.workspace.storageMode)}" disabled>
          </label>
          <label>
            <span>Backend target</span>
            <input id="workspace-backend-target" value="${escapeHtml(state.workspace.backendTarget)}">
          </label>
          <button class="button button-primary" type="button" id="workspace-save">Save Settings</button>
        </div>
      </section>

      ${renderMobileAppPanel()}

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Access</p>
            <h2>Members and roles</h2>
          </div>
        </div>
        <div class="member-role-list">
          ${memberships.map((member) => {
            const role = roleById[member.membership.role] || roleById[state.workspace.defaultRole];
            return `
              <article class="member-role-row">
                <div>
                  <span class="avatar">${member.name.split(" ").map((part) => part[0]).join("")}</span>
                  <div>
                    <h3>${escapeHtml(member.name)}</h3>
                    <p>${escapeHtml(member.role)} - ${escapeHtml(role?.description || "")}</p>
                  </div>
                </div>
                <select data-member-role="${member.id}" aria-label="Role for ${escapeHtml(member.name)}">
                  ${workspaceRoles.map((option) => `<option value="${option.id}" ${option.id === member.membership.role ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                </select>
              </article>
            `;
          }).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Invitations</p>
            <h2>Invite members</h2>
          </div>
          <span class="status-pill inbox-neutral">${pendingInvitations.length} pending</span>
        </div>
        <div class="invite-form">
          <label>
            <span>Name</span>
            <input id="invite-name" placeholder="Jordan Lee">
          </label>
          <label>
            <span>Email</span>
            <input id="invite-email" type="email" placeholder="jordan@company.com">
          </label>
          <label>
            <span>Role</span>
            <select id="invite-role">
              ${workspaceRoles.map((role) => `<option value="${role.id}" ${role.id === state.workspace.defaultRole ? "selected" : ""}>${escapeHtml(role.label)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Company access</span>
            <select id="invite-company">
              <option value="">Workspace-wide</option>
              ${state.companies.map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join("")}
            </select>
          </label>
          <button class="button button-primary" type="button" id="invite-member" ${apiSession ? "" : "disabled"}>Send Invite</button>
        </div>
        <div class="invitation-list">
          ${state.invitations.length ? state.invitations.map((invitation) => renderInvitationRow(invitation, roleById)).join("") : emptyState("No invitations yet.")}
        </div>
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

function renderInvitationRow(invitation, roleById) {
  const role = roleById[invitation.role]?.label || invitation.role || "Member";
  const invitedBy = invitation.invitedBy ? memberName(invitation.invitedBy) : "Workspace admin";
  const date = invitation.acceptedAt || invitation.updatedAt || invitation.createdAt || "";
  const company = invitation.companyId ? companyName(invitation.companyId) : "Workspace-wide";

  return `
    <article class="invitation-row">
      <div>
        <h3>${escapeHtml(invitation.name || invitation.email)}</h3>
        <p>${escapeHtml(invitation.email)} - ${escapeHtml(role)} - ${escapeHtml(company)} - invited by ${escapeHtml(invitedBy)}</p>
        ${invitation.status === "pending" ? `<code>${escapeHtml(invitation.acceptUrl || `#invite/${invitation.token || ""}`)}</code>` : ""}
      </div>
      <div>
        <span class="status-pill ${invitation.status === "accepted" ? "inbox-green" : "inbox-amber"}">${escapeHtml(invitation.status || "pending")}</span>
        <small>${date ? escapeHtml(formatDate(date.slice(0, 10))) : ""}</small>
      </div>
    </article>
  `;
}

function renderInviteAcceptance() {
  const token = state.selectedInviteToken;
  const preview = invitePreviewToken === token ? invitePreview : null;
  const roleLabel = workspaceRoles.find((role) => role.id === preview?.role)?.label || preview?.role || "Member";
  const canAcceptInvite = Boolean(token && preview && preview.status === "pending");

  if (token && invitePreviewToken !== token && !invitePreviewLoading) {
    loadInvitationPreview(token);
  }

  els.appView.innerHTML = `
    <section class="invite-accept-panel panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Workspace invitation</p>
          <h2>Join ${escapeHtml(state.workspace.name)}</h2>
        </div>
        <span class="status-pill ${preview?.status === "accepted" ? "inbox-green" : "inbox-blue"}">${escapeHtml(preview?.status || "pending")}</span>
      </div>
      <div class="invite-accept-body">
        <div>
          <h3>${preview ? escapeHtml(preview.name || preview.email) : "Accept your invitation"}</h3>
          <p>${preview ? `You were invited as ${escapeHtml(roleLabel)}. Confirm your name to activate your workspace access.` : "Loading invitation details from the Agora API."}</p>
          ${token ? `<code>${escapeHtml(token)}</code>` : `<p class="is-overdue">This invite link is missing a token.</p>`}
        </div>
        <div class="invite-accept-form">
          <label>
            <span>Name</span>
            <input id="invite-accept-name" placeholder="Your name" value="${escapeHtml(preview?.name || "")}" ${canAcceptInvite ? "" : "disabled"}>
          </label>
          <label>
            <span>Password</span>
            <input id="invite-accept-password" type="password" placeholder="Optional, 8+ characters" ${canAcceptInvite ? "" : "disabled"}>
          </label>
          <button class="button button-primary" type="button" id="invite-accept" ${canAcceptInvite ? "" : "disabled"}>Accept Invite</button>
          <button class="button button-secondary" type="button" data-route="settings">Back to Settings</button>
        </div>
      </div>
    </section>
  `;
}

function renderDataManagement() {
  const taskCsv = exportTasksCsv();
  const timeCsv = exportTimeCsv();

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Projects", activeProjects().length)}
      ${metric("Tasks", activeTasks().length)}
      ${metric("Time entries", state.timeEntries.length)}
      ${metric("Sync", apiSession ? apiBackendLabel() : "Browser only")}
    </div>

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
            <p>${apiSession ? `Last synced ${escapeHtml(apiLastSyncedLabel())}` : "Connect from Settings to save or load workspace snapshots through the API."}</p>
          </div>
          <div class="data-actions">
            <button class="button button-primary" type="button" id="api-save-workspace" ${apiSession ? "" : "disabled"}>Save to API</button>
            <button class="button button-secondary" type="button" id="api-load-workspace" ${apiSession ? "" : "disabled"}>Load from API</button>
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
          <button class="button button-secondary" type="button" id="refresh-export">Refresh</button>
        </div>
        <textarea class="export-textarea" id="json-export" rows="18" readonly>${escapeHtml(exportWorkspaceJson())}</textarea>
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
          <button class="button button-primary" type="button" id="import-json">Import Workspace</button>
        </div>
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

function renderBackendChecklist() {
  return `
    <div class="backend-checklist">
      ${backendReadinessItems().map((item) => `
        <article class="backend-item ${item.done ? "is-done" : "is-pending"}">
          <span>${item.done ? "OK" : ""}</span>
          <strong>${escapeHtml(item.label)}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderAutomationCard(automation) {
  return `
    <article class="automation-card ${automation.enabled ? "is-enabled" : "is-disabled"}">
      <div>
        <span class="status-pill ${automation.enabled ? "inbox-green" : "inbox-neutral"}">${automation.enabled ? "enabled" : "paused"}</span>
        <h3>${escapeHtml(automation.name)}</h3>
        <p><strong>When:</strong> ${escapeHtml(automation.trigger)}</p>
        <p><strong>Then:</strong> ${escapeHtml(automation.action)}</p>
        <div class="meta-row">
          <span>${automation.runCount || 0} runs</span>
          <span>${automation.lastRun ? formatTimestamp(automation.lastRun) : "Never run"}</span>
        </div>
      </div>
      <div class="automation-actions">
        <button class="button button-secondary" type="button" data-toggle-automation="${automation.id}">${automation.enabled ? "Pause" : "Enable"}</button>
        <button class="button button-primary" type="button" data-run-automation="${automation.id}" ${automation.enabled ? "" : "disabled"}>Run</button>
      </div>
    </article>
  `;
}

function renderAutomationHistory(run) {
  const automation = byId(state.automations, run.automationId);
  return `
    <article class="automation-history-item">
      <div>
        <strong>${escapeHtml(automation?.name || "Automation")}</strong>
        <span>${formatTimestamp(run.createdAt)}</span>
      </div>
      <span>${run.changedCount} ${run.changedCount === 1 ? "change" : "changes"}</span>
    </article>
  `;
}

function renderDocsAndFiles() {
  const documents = getVisibleDocuments();
  const files = getVisibleFiles();
  const activeProjects = new Set([...documents.map((document) => document.projectId), ...files.map((file) => file.projectId)]);

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Documents", documents.length)}
      ${metric("Files", files.length)}
      ${metric("Projects", activeProjects.size)}
      ${metric("Updated", documents.length + files.length)}
    </div>

    <div class="docs-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Knowledge base</p>
            <h2>Project docs</h2>
          </div>
        </div>
        <div class="doc-composer">
          <label>
            <span>Title</span>
            <input id="doc-title" placeholder="Project brief">
          </label>
          <label>
            <span>Project</span>
            <select id="doc-project">
              ${activeProjects().map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select id="doc-type">
              ${["Brief", "Spec", "Template", "Note"].map((type) => `<option value="${type}">${type}</option>`).join("")}
            </select>
          </label>
          <label class="wide-field">
            <span>Summary</span>
            <textarea id="doc-body" rows="3" placeholder="What should the team know?"></textarea>
          </label>
          <button class="button button-secondary" type="button" id="doc-create">Add Doc</button>
        </div>
        <div class="doc-list">
          ${documents.length ? documents.map(renderDocumentCard).join("") : emptyState("No docs match the current filters.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Attachments</p>
            <h2>Files</h2>
          </div>
        </div>
        <div class="file-composer">
          <label>
            <span>File name</span>
            <input id="file-title" placeholder="launch-plan.pdf">
          </label>
          <label>
            <span>Project</span>
            <select id="file-project">
              ${activeProjects().map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Kind</span>
            <input id="file-kind" placeholder="PDF, Design, CSV">
          </label>
          <label>
            <span>Size</span>
            <input id="file-size" placeholder="1.2 MB">
          </label>
          <button class="button button-secondary" type="button" id="file-create">Add File</button>
        </div>
        <div class="file-list">
          ${files.length ? files.map(renderFileCard).join("") : emptyState("No files match the current filters.")}
        </div>
      </section>
    </div>
  `;
}

function renderDocumentCard(document) {
  return `
    <article class="doc-card">
      <div>
        <span class="status-pill inbox-blue">${escapeHtml(document.type)}</span>
        <h3>${escapeHtml(document.title)}</h3>
        <p>${escapeHtml(document.body)}</p>
        <div class="meta-row">
          <span>${escapeHtml(projectName(document.projectId))}</span>
          <span>${memberName(document.owner)}</span>
          <span>${formatTimestamp(document.updatedAt)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderFileCard(file) {
  return `
    <article class="file-card">
      <div class="file-icon">${escapeHtml(file.kind.slice(0, 3).toUpperCase())}</div>
      <div>
        <h3>${escapeHtml(file.title)}</h3>
        <div class="meta-row">
          <span>${escapeHtml(projectName(file.projectId))}</span>
          <span>${escapeHtml(file.size)}</span>
          <span>${memberName(file.owner)}</span>
          <span>${formatTimestamp(file.updatedAt)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderProjectDocs(project) {
  const documents = state.documents.filter((document) => document.projectId === project.id);
  const files = state.files.filter((file) => file.projectId === project.id);
  return `
    <div class="docs-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Knowledge base</p>
            <h2>${documents.length} docs</h2>
          </div>
        </div>
        <div class="doc-list">
          ${documents.length ? documents.map(renderDocumentCard).join("") : emptyState("No docs have been added to this project yet.")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Attachments</p>
            <h2>${files.length} files</h2>
          </div>
        </div>
        <div class="file-list">
          ${files.length ? files.map(renderFileCard).join("") : emptyState("No files have been added to this project yet.")}
        </div>
      </section>
    </div>
  `;
}

function renderIntake() {
  const submissions = getVisibleIntakeSubmissions();
  const openSubmissions = submissions.filter((submission) => !submission.taskId);
  const highUrgency = submissions.filter((submission) => submission.urgency === "High");

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Forms", state.intakeForms.length)}
      ${metric("Open requests", openSubmissions.length)}
      ${metric("Converted", submissions.length - openSubmissions.length)}
      ${metric("High urgency", highUrgency.length)}
    </div>

    <div class="intake-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Request capture</p>
            <h2>Forms</h2>
          </div>
        </div>
        <div class="intake-form-list">
          ${state.intakeForms.map(renderIntakeForm).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Queue</p>
            <h2>Submissions</h2>
          </div>
        </div>
        <div class="submission-list">
          ${submissions.length ? submissions.map(renderSubmissionCard).join("") : emptyState("No intake submissions match the current filters.")}
        </div>
      </section>
    </div>
  `;
}

function renderIntakeForm(form) {
  return `
    <article class="intake-form-card" data-intake-form-card="${form.id}">
      <div>
        <span class="status-pill inbox-green">${escapeHtml(projectName(form.projectId))}</span>
        <h3>${escapeHtml(form.title)}</h3>
        <p>${escapeHtml(form.description)}</p>
      </div>
      <div class="intake-field-grid">
        <label>
          <span>Title</span>
          <input data-intake-title placeholder="Short request title">
        </label>
        <label>
          <span>Requester</span>
          <input data-intake-requester placeholder="Name">
        </label>
        <label>
          <span>Company / area</span>
          <input data-intake-company placeholder="Company or area">
        </label>
        <label>
          <span>Urgency</span>
          <select data-intake-urgency>
            ${["Low", "Normal", "High"].map((option) => `<option value="${option}">${option}</option>`).join("")}
          </select>
        </label>
        <label class="wide-field">
          <span>Details</span>
          <textarea data-intake-details rows="3" placeholder="What is being requested?"></textarea>
        </label>
      </div>
      <button class="button button-secondary" type="button" data-submit-intake="${form.id}">Submit Request</button>
    </article>
  `;
}

function renderSubmissionCard(submission) {
  const form = byId(state.intakeForms, submission.formId);
  const task = submission.taskId ? byId(state.tasks, submission.taskId) : null;
  return `
    <article class="submission-card ${submission.taskId ? "is-converted" : ""}">
      <div>
        <span class="status-pill ${submission.urgency === "High" ? "inbox-red" : "inbox-amber"}">${escapeHtml(submission.urgency)}</span>
        <h3>${escapeHtml(submission.title)}</h3>
        <p>${escapeHtml(submission.details)}</p>
        <div class="meta-row">
          <span>${escapeHtml(form?.title || "Unknown form")}</span>
          <span>${escapeHtml(submission.company)}</span>
          <span>${escapeHtml(submission.requester)}</span>
          <span>${formatTimestamp(submission.createdAt)}</span>
        </div>
      </div>
      ${task ? `
        <button class="button button-secondary" type="button" data-edit-task="${task.id}">Open Task</button>
      ` : `
        <div class="submission-actions">
          <button class="button button-secondary" type="button" data-template-submission="${submission.id}">Use Template</button>
          <button class="button button-primary" type="button" data-convert-submission="${submission.id}">Create Task</button>
        </div>
      `}
    </article>
  `;
}

function renderCustomFields() {
  const fieldsWithUsage = state.customFields.map((field) => ({
    ...field,
    usage: activeTasks().filter((task) => customFieldValue(task, field)).length
  }));

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Fields", state.customFields.length)}
      ${metric("Used values", fieldsWithUsage.reduce((total, field) => total + field.usage, 0))}
      ${metric("Select fields", state.customFields.filter((field) => field.type === "select").length)}
      ${metric("Number fields", state.customFields.filter((field) => field.type === "number").length)}
    </div>

    <div class="fields-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Task metadata</p>
            <h2>Custom fields</h2>
          </div>
        </div>
        <div class="field-list">
          ${fieldsWithUsage.map(renderCustomFieldCard).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Add field</p>
            <h2>New metadata</h2>
          </div>
        </div>
        <div class="field-composer">
          <label>
            <span>Name</span>
            <input id="field-name" placeholder="Sprint, Client cost, Risk">
          </label>
          <label>
            <span>Type</span>
            <select id="field-type">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select</option>
            </select>
          </label>
          <label class="wide-field">
            <span>Select options</span>
            <input id="field-options" placeholder="Low, Medium, High">
          </label>
          <button class="button button-secondary" type="button" id="field-create">Add Field</button>
        </div>
      </section>
    </div>
  `;
}

function renderCustomFieldCard(field) {
  return `
    <article class="field-card">
      <div>
        <h3>${escapeHtml(field.name)}</h3>
        <p>${escapeHtml(field.type)}${field.options?.length ? ` - ${field.options.map((option) => escapeHtml(option)).join(", ")}` : ""}</p>
      </div>
      <strong>${field.usage}</strong>
    </article>
  `;
}

function renderTimeTracking() {
  const entries = getFilteredTimeEntries();
  const billableEntries = entries.filter((entry) => entry.billable);
  const employeeRows = workspaceMembers().map((member) => {
    const memberEntries = entries.filter((entry) => entry.memberId === member.id);
    return {
      ...member,
      entries: memberEntries,
      minutes: sumMinutes(memberEntries),
      billableMinutes: sumMinutes(memberEntries.filter((entry) => entry.billable))
    };
  }).filter((member) => member.minutes > 0);
  const recentEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Tracked time", formatDuration(sumMinutes(entries)))}
      ${metric("Billable", formatDuration(sumMinutes(billableEntries)))}
      ${metric("Employees", employeeRows.length)}
      ${metric("Entries", entries.length)}
    </div>

    <div class="time-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Employees</p>
            <h2>Timesheet summary</h2>
          </div>
        </div>
        ${employeeRows.length ? `
          <div class="time-summary-list">
            ${employeeRows.map(renderEmployeeTimeSummary).join("")}
          </div>
        ` : emptyState("No time entries match the current filters.")}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Recent</p>
            <h2>Time log</h2>
          </div>
        </div>
        ${recentEntries.length ? renderTimeEntryTable(recentEntries) : emptyState("No time has been logged yet.")}
      </section>
    </div>
  `;
}

function renderEmployeeTimeSummary(member) {
  const projectIds = new Set(member.entries.map((entry) => byId(state.tasks, entry.taskId)?.projectId).filter(Boolean));
  const companyIds = new Set([...projectIds].map((projectId) => projectCompany(projectId)?.id).filter(Boolean));
  const billablePercent = member.minutes ? Math.round((member.billableMinutes / member.minutes) * 100) : 0;

  return `
    <article class="employee-time-card">
      <div>
        <span class="avatar">${member.name.split(" ").map((part) => part[0]).join("")}</span>
        <div>
          <h3>${member.name}</h3>
          <p>${member.role}</p>
        </div>
      </div>
      <div class="time-summary-metrics">
        <span><strong>${formatDuration(member.minutes)}</strong> total</span>
        <span><strong>${formatDuration(member.billableMinutes)}</strong> billable</span>
        <span><strong>${companyIds.size}</strong> ${companyIds.size === 1 ? "company" : "companies"}</span>
        <span><strong>${billablePercent}%</strong> billable mix</span>
      </div>
    </article>
  `;
}

function renderTimeEntryTable(entries) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Employee</th>
            <th>Task</th>
            <th>Project</th>
            <th>Time</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(renderTimeEntryRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTimeEntryRow(entry) {
  const task = byId(state.tasks, entry.taskId);
  const company = task ? projectCompany(task.projectId) : null;
  return `
    <tr>
      <td>${formatDate(entry.date)}</td>
      <td>${memberName(entry.memberId)}</td>
      <td>
        <button class="table-task-button" type="button" data-edit-task="${entry.taskId}">
          <strong>${escapeHtml(task?.title || "Unknown task")}</strong>
          <span>${escapeHtml(entry.note || "No note")}</span>
        </button>
      </td>
      <td>
        <span class="table-kicker">${escapeHtml(company?.name || "Unknown company")}</span>
        ${escapeHtml(task ? projectName(task.projectId) : "Unknown project")}
      </td>
      <td>${formatDuration(entry.minutes)}</td>
      <td>${entry.billable ? "Billable" : "Internal"}</td>
    </tr>
  `;
}

function renderTaskCard(task) {
  const company = projectCompany(task.projectId);
  const checklist = subtaskSummary(task);
  const fields = renderTaskFieldChips(task);
  const dependencies = renderTaskDependencyChips(task);
  return `
    <article class="task-card ${isTaskBlocked(task) ? "is-blocked" : ""}" draggable="true" data-task-id="${task.id}">
      <button class="task-card-main" type="button" data-edit-task="${task.id}">
        <span class="task-project">${escapeHtml(company.name)} / ${escapeHtml(projectName(task.projectId))}</span>
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(task.description)}</span>
      </button>
      <div class="task-meta">
        <span class="avatar">${memberName(task.assignee).split(" ").map((part) => part[0]).join("")}</span>
        <span class="priority priority-${task.priority}">${priorityLabel(task.priority)}</span>
        <span class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}</span>
        ${checklist ? `<span>${escapeHtml(checklist)}</span>` : ""}
      </div>
      ${dependencies}
      <div class="tag-row">
        ${task.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
      ${fields}
      <div class="task-card-actions">
        <button class="button button-secondary compact-button" type="button" data-edit-task="${task.id}">Open</button>
        <button class="button button-secondary compact-button" type="button" data-task-plan-today="${task.id}">Today</button>
        <button class="button button-primary compact-button" type="button" data-task-complete="${task.id}" ${task.status === "done" ? "disabled" : ""}>Done</button>
        <button class="button button-secondary button-danger compact-button" type="button" data-archive-task="${task.id}">Archive</button>
      </div>
    </article>
  `;
}

function renderTaskRow(task) {
  const company = projectCompany(task.projectId);
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
      <td>
        <span class="table-kicker">${escapeHtml(company.name)}</span>
        ${escapeHtml(projectName(task.projectId))}
      </td>
      <td>${memberName(task.assignee)}</td>
      <td>${selectControl("status", task.id, task.status, statuses)}</td>
      <td>${selectControl("priority", task.id, task.priority, priorities)}</td>
      <td class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}</td>
      <td><button class="button button-secondary button-danger compact-button" type="button" data-archive-task="${task.id}">Archive</button></td>
    </tr>
  `;
}

function renderTaskDependencyChips(task) {
  const dependencies = taskDependencies(task);
  const openDependencies = dependencies.filter((dependency) => dependency.status !== "done");
  const downstreamCount = tasksBlockedBy(task.id).length;
  if (!dependencies.length && !downstreamCount) return "";

  return `
    <span class="dependency-chip-row">
      ${openDependencies.length ? `<span class="dependency-chip is-blocked">Blocked by ${openDependencies.length}</span>` : ""}
      ${dependencies.length && !openDependencies.length ? "<span class=\"dependency-chip is-clear\">Dependencies clear</span>" : ""}
      ${downstreamCount ? `<span class="dependency-chip">Blocks ${downstreamCount}</span>` : ""}
    </span>
  `;
}

function renderTaskFieldChips(task) {
  const fields = visibleTaskCustomFields(task);
  if (!fields.length) return "";

  return `
    <span class="field-chip-row">
      ${fields.map((field) => `<span>${escapeHtml(field.name)}: ${escapeHtml(field.value)}</span>`).join("")}
    </span>
  `;
}

function selectControl(field, taskId, value, options) {
  return `
    <select class="inline-select" data-inline-field="${field}" data-task-id="${taskId}">
      ${options.map((option) => `<option value="${option.id}" ${option.id === value ? "selected" : ""}>${option.label}</option>`).join("")}
    </select>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function populateTaskForm(task = null) {
  document.querySelector("#task-id").value = task?.id || "";
  document.querySelector("#task-title").value = task?.title || "";
  document.querySelector("#task-description").value = task?.description || "";
  document.querySelector("#task-start-date").value = task?.startDate || "";
  document.querySelector("#task-due-date").value = task?.dueDate || "";
  document.querySelector("#task-tags").value = task?.tags?.join(", ") || "";
  draftSubtasks = taskSubtasks(task || {}).map((subtask) => ({ ...subtask }));
  els.taskFormTitle.textContent = task ? "Edit Task" : "New Task";

  const availableProjects = state.filters.company === "all"
    ? activeProjects()
    : activeProjects().filter((project) => project.companyId === state.filters.company);
  const projectOptions = availableProjects.length ? availableProjects : activeProjects();
  const selectedProject = task?.projectId || (state.selectedProject === "all" ? projectOptions[0]?.id : state.selectedProject);
  fillSelect("#task-project", projectOptions, selectedProject, "name");
  fillSelect("#task-assignee", members, task?.assignee || members[0].id, "name");
  fillSelect("#task-status", statuses, task?.status || "todo", "label");
  fillSelect("#task-priority", priorities, task?.priority || "normal", "label");
  renderTaskCollaboration(task?.id || "");
  renderTaskSubtasks();
  renderTaskDependencies(task);
  renderTaskCustomFields(task);
  renderTaskTimeTracking(task?.id || "");
}

function fillSelect(selector, options, selectedValue, labelKey) {
  const select = document.querySelector(selector);
  select.innerHTML = options.map((option) => (
    `<option value="${option.id}" ${option.id === selectedValue ? "selected" : ""}>${escapeHtml(option[labelKey])}</option>`
  )).join("");
}

function populateProjectForm() {
  document.querySelector("#project-name").value = "";
  document.querySelector("#project-description").value = "";
  document.querySelector("#project-start-date").value = "";
  document.querySelector("#project-due-date").value = "";
  fillSelect("#project-company", state.companies, state.filters.company === "all" ? state.companies[0].id : state.filters.company, "name");
  fillSelect("#project-owner", members, members[0].id, "name");
}

function populateCompanyForm(company = null) {
  document.querySelector("#company-id").value = company?.id || "";
  document.querySelector("#company-name").value = company?.name || "";
  document.querySelector("#company-description").value = company?.description || "";
  document.querySelector("#company-type").value = company?.type || "Client";
  document.querySelector("#company-status").value = company?.status || "active";
  fillSelect("#company-owner", members, company?.owner || members[0].id, "name");
  els.companyFormTitle.textContent = company ? "Edit Company" : "New Company";
}

function openDialog(dialog) {
  lastFocusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  window.setTimeout(() => {
    const focusTarget = dialog.querySelector("[autofocus], input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])")
      || dialog.querySelector("button:not([disabled])");
    focusTarget?.focus();
  }, 0);
}

function closeDialog(dialog) {
  dialog.close();
}

function restoreDialogFocus() {
  if (lastFocusedBeforeDialog?.isConnected) lastFocusedBeforeDialog.focus();
  lastFocusedBeforeDialog = null;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function addTaskComment() {
  const taskId = document.querySelector("#task-id").value;
  const bodyInput = document.querySelector("#comment-body");
  const body = bodyInput?.value.trim();
  const task = byId(state.tasks, taskId);
  if (!task || !body) return;

  const comment = {
    id: uid("comment"),
    taskId,
    author: currentMemberId,
    body,
    createdAt: new Date().toISOString()
  };
  state.comments = [comment, ...state.comments];

  addActivity({
    projectId: task.projectId,
    taskId,
    type: "comment",
    message: `commented on ${task.title}`
  });

  saveState();
  renderTaskCollaboration(taskId);
  render();
  showToast("Comment added", "success");
  syncCommentToApi(comment, "Comment synced to API");
}

function addTaskTimeEntry() {
  const taskId = document.querySelector("#task-id").value;
  const task = byId(state.tasks, taskId);
  const minutes = Number(document.querySelector("#time-minutes")?.value || 0);
  const memberId = document.querySelector("#time-member")?.value || currentMemberId;
  const date = document.querySelector("#time-date")?.value;
  const note = document.querySelector("#time-note")?.value.trim() || "";
  const billable = Boolean(document.querySelector("#time-billable")?.checked);

  if (!task || !date || minutes <= 0) return;

  const entry = {
    id: uid("time"),
    taskId,
    memberId,
    date,
    minutes,
    note,
    billable,
    createdAt: new Date().toISOString()
  };
  state.timeEntries = [entry, ...state.timeEntries];

  addActivity({
    projectId: task.projectId,
    taskId,
    memberId,
    type: "time_log",
    message: `logged ${formatDuration(minutes)} on ${task.title}`
  });

  saveState();
  renderTaskTimeTracking(taskId);
  renderTaskCollaboration(taskId);
  render();
  showToast(`Logged ${formatDuration(minutes)}`, "success");
  syncRecordToApi("timeEntries", entry, "Time entry synced to API");
}

function addQuickDailyTime(taskId, minutes = 30) {
  const task = byId(state.tasks, taskId);
  if (!task) return;

  const entry = {
    id: uid("time"),
    taskId,
    memberId: currentMemberId,
    date: state.selectedDailyDate,
    minutes,
    note: "Daily focus block",
    billable: false,
    createdAt: new Date().toISOString()
  };
  state.timeEntries = [entry, ...state.timeEntries];

  addActivity({
    projectId: task.projectId,
    taskId,
    type: "time_log",
    message: `logged ${formatDuration(minutes)} on ${task.title}`
  });
  saveState();
  render();
  showToast(`Logged ${formatDuration(minutes)} for today`, "success");
  syncRecordToApi("timeEntries", entry, "Time entry synced to API");
}

function templateCompanyId(card) {
  return card?.querySelector("[data-template-company]")?.value || (state.filters.company === "all" ? state.companies[0].id : state.filters.company);
}

function createTaskFromTemplate(templateId, projectId) {
  const template = byId(state.taskTemplates, templateId);
  const project = byId(state.projects, projectId);
  if (!template || !project) return null;

  const task = {
    id: uid("task"),
    projectId,
    title: template.name,
    description: template.description,
    assignee: template.assignee,
    status: "todo",
    priority: template.priority,
    startDate: todayKey(),
    dueDate: shiftDate(todayKey(), template.durationDays),
    blockedBy: [],
    tags: [...template.tags],
    subtasks: template.subtasks.map((title) => ({ id: uid("subtask"), title, done: false })),
    customFields: { ...template.customFields },
    createdAt: new Date().toISOString()
  };

  state.tasks = [task, ...state.tasks];
  addActivity({
    projectId,
    taskId: task.id,
    type: "template_task",
    message: `created ${task.title} from a task template`
  });
  return task;
}

function createProjectFromTemplate(templateId, { companyId, name, startDate = todayKey() } = {}) {
  const template = byId(state.projectTemplates, templateId);
  const targetCompanyId = companyId || (state.filters.company === "all" ? state.companies[0].id : state.filters.company);
  if (!template || !targetCompanyId) return null;

  const project = {
    id: uid("project"),
    name: name || template.name,
    companyId: targetCompanyId,
    description: template.description,
    owner: template.owner,
    startDate,
    dueDate: shiftDate(startDate, template.durationDays)
  };
  const taskIdsByKey = {};
  const tasks = template.tasks.map((templateTask) => {
    const taskId = uid("task");
    taskIdsByKey[templateTask.key] = taskId;
    return {
      id: taskId,
      projectId: project.id,
      title: templateTask.title,
      description: templateTask.description,
      assignee: templateTask.assignee,
      status: "todo",
      priority: templateTask.priority,
      startDate: shiftDate(startDate, templateTask.startOffset),
      dueDate: shiftDate(startDate, templateTask.dueOffset),
      blockedBy: [],
      tags: [...templateTask.tags],
      subtasks: templateTask.subtasks.map((title) => ({ id: uid("subtask"), title, done: false })),
      customFields: {
        effort: templateTask.priority === "urgent" || templateTask.priority === "high" ? "Large" : "Medium",
        risk: templateTask.priority === "urgent" ? "High" : "Medium",
        budget: "0"
      },
      createdAt: new Date().toISOString()
    };
  }).map((task, index) => ({
    ...task,
    blockedBy: (template.tasks[index].blockedBy || []).map((key) => taskIdsByKey[key]).filter(Boolean)
  }));
  const milestones = template.milestones.map((milestone) => ({
    id: uid("milestone"),
    projectId: project.id,
    title: milestone.title,
    description: milestone.description,
    dueDate: shiftDate(startDate, milestone.dueOffset),
    owner: milestone.owner,
    status: milestone.status,
    taskIds: milestone.taskKeys.map((key) => taskIdsByKey[key]).filter(Boolean)
  }));
  const documents = template.docs.map((document) => ({
    id: uid("doc"),
    projectId: project.id,
    title: document.title,
    type: document.type,
    owner: template.owner,
    updatedAt: new Date().toISOString(),
    body: document.body
  }));
  const intakeForm = {
    id: uid("form"),
    title: template.intakeForm.title,
    projectId: project.id,
    assignee: template.intakeForm.assignee,
    description: template.intakeForm.description,
    fields: [
      { id: "requester", label: "Requester", type: "text", required: true },
      { id: "company", label: "Company / area", type: "text", required: true },
      { id: "urgency", label: "Urgency", type: "select", options: ["Low", "Normal", "High"], required: true },
      { id: "details", label: "Request details", type: "textarea", required: true }
    ]
  };

  state.projects = [project, ...state.projects];
  state.tasks = [...tasks, ...state.tasks];
  state.milestones = [...milestones, ...state.milestones];
  state.documents = [...documents, ...state.documents];
  state.intakeForms = [intakeForm, ...state.intakeForms];
  addActivity({
    projectId: project.id,
    type: "template_project",
    message: `created project ${project.name} from ${template.name}`
  });
  return { project, tasks, milestones, documents, intakeForm };
}

function createTaskFromSubmissionRecord(submission, form) {
  const task = {
    id: uid("task"),
    projectId: form.projectId,
    title: submission.title,
    description: `${submission.details}\n\nRequester: ${submission.requester}\nSource: ${form.title}`,
    assignee: form.assignee,
    status: "todo",
    priority: submission.urgency === "High" ? "high" : "normal",
    startDate: todayKey(),
    dueDate: "",
    blockedBy: [],
    tags: ["intake"],
    subtasks: [],
    customFields: {
      risk: submission.urgency === "High" ? "High" : "Medium"
    },
    createdAt: new Date().toISOString()
  };

  state.tasks = [task, ...state.tasks];
  state.intakeSubmissions = state.intakeSubmissions.map((item) => item.id === submission.id ? { ...item, taskId: task.id } : item);
  addActivity({
    projectId: task.projectId,
    taskId: task.id,
    type: "intake_convert",
    message: `converted request ${submission.title} to a task`
  });
  return task;
}

function createDocument() {
  const title = document.querySelector("#doc-title")?.value.trim();
  const projectId = document.querySelector("#doc-project")?.value;
  const type = document.querySelector("#doc-type")?.value || "Note";
  const body = document.querySelector("#doc-body")?.value.trim();
  if (!title || !projectId) return;

  const document = {
    id: uid("doc"),
    projectId,
    title,
    type,
    owner: currentMemberId,
    updatedAt: new Date().toISOString(),
    body: body || "No summary yet."
  };
  state.documents = [document, ...state.documents];

  addActivity({
    projectId,
    type: "doc_create",
    message: `added doc ${title}`
  });
  saveState();
  render();
  showToast("Doc added", "success");
  syncDocumentToApi(document, "Doc synced to API");
}

function createFileRecord() {
  const title = document.querySelector("#file-title")?.value.trim();
  const projectId = document.querySelector("#file-project")?.value;
  const kind = document.querySelector("#file-kind")?.value.trim() || "File";
  const size = document.querySelector("#file-size")?.value.trim() || "Unknown size";
  if (!title || !projectId) return;

  const file = {
    id: uid("file"),
    projectId,
    title,
    kind,
    size,
    owner: currentMemberId,
    updatedAt: new Date().toISOString()
  };
  state.files = [file, ...state.files];

  addActivity({
    projectId,
    type: "file_create",
    message: `added file ${title}`
  });
  saveState();
  render();
  showToast("File added", "success");
  syncFileToApi(file, "File synced to API");
}

function submitIntakeRequest(formId) {
  const formCard = document.querySelector(`[data-intake-form-card="${formId}"]`);
  const form = byId(state.intakeForms, formId);
  if (!formCard || !form) return;

  const title = formCard.querySelector("[data-intake-title]")?.value.trim();
  const requester = formCard.querySelector("[data-intake-requester]")?.value.trim();
  const company = formCard.querySelector("[data-intake-company]")?.value.trim();
  const urgency = formCard.querySelector("[data-intake-urgency]")?.value || "Normal";
  const details = formCard.querySelector("[data-intake-details]")?.value.trim();
  if (!title || !requester || !details) return;

  state.intakeSubmissions = [{
    id: uid("submission"),
    formId,
    title,
    requester,
    company: company || companyName(projectCompany(form.projectId)?.id),
    urgency,
    details,
    taskId: "",
    createdAt: new Date().toISOString()
  }, ...state.intakeSubmissions];

  saveState();
  render();
  showToast("Request submitted", "success");
}

function convertSubmissionToTask(submissionId) {
  const submission = byId(state.intakeSubmissions, submissionId);
  const form = submission ? byId(state.intakeForms, submission.formId) : null;
  if (!submission || !form || submission.taskId) return;

  const task = createTaskFromSubmissionRecord(submission, form);
  saveState();
  render();
  showToast("Request converted to task", "success");
  if (task) syncTaskToApi(task, "Task created in API", true);
}

function createProjectTemplateFromButton(button) {
  const card = button.closest("[data-project-template-card]");
  const templateId = button.dataset.useProjectTemplate;
  const created = createProjectFromTemplate(templateId, {
    companyId: templateCompanyId(card),
    name: card?.querySelector("[data-template-name]")?.value.trim() || undefined,
    startDate: card?.querySelector("[data-template-start]")?.value || todayKey()
  });
  if (!created) return;

  state.selectedProject = created.project.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "overview";
  state.filters.company = created.project.companyId;
  saveState();
  render();
  showToast("Project template applied", "success");
  syncProjectToApi(created.project, "Project created in API", true);
  created.tasks.forEach((task) => syncTaskToApi(task, "Template task synced to API", true));
}

function createTaskTemplateFromButton(button) {
  const card = button.closest("[data-task-template-card]");
  const projectId = card?.querySelector("[data-task-template-project]")?.value || activeProjects()[0]?.id;
  const task = createTaskFromTemplate(button.dataset.useTaskTemplate, projectId);
  if (!task) return;

  state.selectedProject = projectId;
  state.selectedRoute = "project";
  state.selectedProjectTab = "tasks";
  saveState();
  render();
  showToast("Task template applied", "success");
  syncTaskToApi(task, "Task created in API", true);
}

function createProjectFromSubmission(submissionId) {
  const submission = byId(state.intakeSubmissions, submissionId);
  if (!submission || submission.taskId) return;

  const matchedCompany = state.companies.find((company) => company.name.toLowerCase() === submission.company.toLowerCase());
  const templateId = submission.formId === "form-client-request" ? "template-client-onboarding" : "template-software-launch";
  const created = createProjectFromTemplate(templateId, {
    companyId: matchedCompany?.id || (state.filters.company === "all" ? state.companies[0].id : state.filters.company),
    name: submission.title,
    startDate: todayKey()
  });
  if (!created) return;

  state.intakeSubmissions = state.intakeSubmissions.map((item) => item.id === submissionId ? { ...item, taskId: created.tasks[0]?.id || "" } : item);
  state.selectedProject = created.project.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "overview";
  state.filters.company = created.project.companyId;
  saveState();
  render();
  showToast("Project created from intake template", "success");
  syncProjectToApi(created.project, "Project created in API", true);
  created.tasks.forEach((task) => syncTaskToApi(task, "Template task synced to API", true));
}

function createCustomField() {
  const name = document.querySelector("#field-name")?.value.trim();
  const type = document.querySelector("#field-type")?.value || "text";
  const options = document.querySelector("#field-options")?.value.split(",").map((option) => option.trim()).filter(Boolean) || [];
  if (!name) return;

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || uid("field");
  if (state.customFields.some((field) => field.id === id)) {
    showToast("Field already exists", "info");
    return;
  }

  state.customFields = [...state.customFields, {
    id,
    name,
    type,
    options: type === "select" ? options : []
  }];
  saveState();
  render();
  showToast("Custom field added", "success");
}

function updateAutomationRun(ruleId, changedCount) {
  const now = new Date().toISOString();
  state.automations = state.automations.map((automation) => automation.id === ruleId
    ? { ...automation, lastRun: now, runCount: Number(automation.runCount || 0) + 1 }
    : automation);
  state.automationHistory = [{
    id: uid("automation-run"),
    automationId: ruleId,
    changedCount,
    createdAt: now
  }, ...state.automationHistory].slice(0, 20);
}

function runAutomation(ruleId) {
  const automation = byId(state.automations, ruleId);
  if (!automation || !automation.enabled) return 0;

  let changedCount = 0;
  if (ruleId === "automation-high-intake") {
    state.intakeSubmissions
      .filter((submission) => !submission.taskId && submission.urgency === "High")
      .forEach((submission) => {
        const form = byId(state.intakeForms, submission.formId);
        if (!form) return;
        createTaskFromSubmissionRecord(submission, form);
        changedCount += 1;
      });
  }

  if (ruleId === "automation-blocked-alert") {
    state.tasks
      .filter((task) => task.status !== "done" && isTaskBlocked(task))
      .forEach((task) => {
        addActivity({
          projectId: task.projectId,
          taskId: task.id,
          memberId: task.assignee,
          type: "automation_blocked",
          message: `flagged blocked work on ${task.title}`
        });
        changedCount += 1;
      });
  }

  if (ruleId === "automation-due-risk") {
    dueSoonTasks(activeTasks())
      .filter((task) => task.customFields?.risk !== "High")
      .forEach((task) => {
        state.tasks = state.tasks.map((item) => item.id === task.id ? {
          ...item,
          customFields: { ...(item.customFields || {}), risk: "High" }
        } : item);
        addActivity({
          projectId: task.projectId,
          taskId: task.id,
          type: "automation_risk",
          message: `escalated risk for ${task.title}`
        });
        changedCount += 1;
      });
  }

  if (ruleId === "automation-milestone-watch") {
    const today = todayKey();
    const limit = shiftDate(today, 14);
    state.milestones
      .filter((milestone) => milestone.status !== "completed" && milestone.dueDate >= today && milestone.dueDate <= limit)
      .forEach((milestone) => {
        addActivity({
          projectId: milestone.projectId,
          memberId: milestone.owner,
          type: "automation_milestone",
          message: `flagged upcoming milestone ${milestone.title}`
        });
        changedCount += 1;
      });
  }

  updateAutomationRun(ruleId, changedCount);
  saveState();
  render();
  showToast(changedCount ? `Automation ran on ${changedCount} ${changedCount === 1 ? "item" : "items"}` : "Automation ran with no changes", changedCount ? "success" : "info");
  return changedCount;
}

function toggleAutomation(ruleId) {
  state.automations = state.automations.map((automation) => automation.id === ruleId ? { ...automation, enabled: !automation.enabled } : automation);
  saveState();
  render();
  showToast("Automation updated", "success");
}

function runAllAutomations() {
  const enabledIds = state.automations.filter((automation) => automation.enabled).map((automation) => automation.id);
  let total = 0;
  enabledIds.forEach((id) => {
    total += runAutomation(id);
  });
  showToast(total ? `Automations ran on ${total} ${total === 1 ? "item" : "items"}` : "Automations ran with no changes", total ? "success" : "info");
}

function updateApprovalStatus(approvalId, status, inboxId = "") {
  const approval = byId(state.approvals, approvalId);
  if (!approval || !["approved", "needs-changes", "requested"].includes(status)) return;

  const nextApproval = {
    ...approval,
    status,
    updatedAt: new Date().toISOString()
  };
  state.approvals = state.approvals.map((item) => item.id === approvalId ? nextApproval : item);

  addActivity({
    projectId: approval.projectId,
    taskId: approval.taskId,
    type: "approval",
    message: `${status === "approved" ? "approved" : "requested changes for"} ${approval.title}`
  });

  if (inboxId) archiveInboxItem(inboxId);
  saveState();
  render();
  showToast(status === "approved" ? "Approval marked approved" : "Approval marked needs changes", "success");
  syncRecordToApi("approvals", nextApproval, "Approval synced to API");
}

function draftCompanyUpdate(companyId) {
  const company = byId(state.companies, companyId);
  if (!company) return;

  const portal = companyPortalSnapshot(companyId);
  const briefs = portal.projects.map(operatorBriefForProject);
  const body = [
    `${company.name} update`,
    `Progress: ${portal.progress}% complete across ${portal.projects.length} projects.`,
    `Open work: ${portal.openTasks.length} tasks. Pending approvals: ${portal.pendingApprovals.length}.`,
    "",
    ...briefs.map((brief) => `- ${brief.project.name}: ${brief.summary} Next action: ${brief.nextAction}.`)
  ].join("\n");
  const projectId = portal.projects[0]?.id || activeProjects()[0]?.id;
  if (!projectId) return;

  const document = {
    id: uid("doc-update"),
    projectId,
    title: `${company.name} client update`,
    type: "Client Update",
    owner: currentMemberId,
    updatedAt: new Date().toISOString(),
    body
  };

  state.documents = [document, ...state.documents];
  addActivity({
    projectId,
    type: "client_update",
    message: `drafted a client update for ${company.name}`
  });
  saveState();
  render();
  showToast("Client update drafted in Docs", "success");
  syncDocumentToApi(document, "Client update synced to API");
}

function logAutomationSuggestion(suggestionId) {
  const suggestion = automationSuggestions().find((item) => item.id === suggestionId);
  if (!suggestion) return;

  if (state.automations.some((automation) => automation.id === suggestionId)) {
    showToast("Automation idea is already in the rule list", "info");
    return;
  }

  state.automations = [{
    id: suggestion.id,
    name: suggestion.title,
    trigger: suggestion.description,
    action: "Drafted from Agora recommendation",
    enabled: false,
    lastRun: "",
    runCount: 0
  }, ...state.automations];

  saveState();
  render();
  showToast("Automation idea added as a draft rule", "success");
}

function saveWorkspaceSettings() {
  const name = document.querySelector("#workspace-name")?.value.trim();
  const slug = document.querySelector("#workspace-slug")?.value.trim();
  const visibility = document.querySelector("#workspace-visibility")?.value || state.workspace.visibility;
  const defaultRole = document.querySelector("#workspace-default-role")?.value || state.workspace.defaultRole;
  const backendTarget = document.querySelector("#workspace-backend-target")?.value.trim();
  if (!name || !slug) return;

  state.workspace = {
    ...state.workspace,
    name,
    slug,
    visibility,
    defaultRole,
    backendTarget: backendTarget || state.workspace.backendTarget
  };
  saveState();
  render();
  showToast("Workspace settings saved", "success");
}

function updateMemberRole(memberId, role) {
  if (!workspaceMembers().some((member) => member.id === memberId) || !workspaceRoles.some((item) => item.id === role)) return;

  const existing = state.memberships.some((membership) => membership.memberId === memberId);
  state.memberships = existing
    ? state.memberships.map((membership) => membership.memberId === memberId ? { ...membership, role } : membership)
    : [...state.memberships, { memberId, role, status: "active" }];
  saveState();
  render();
  showToast("Member role updated", "success");
}

function importWorkspaceFromTextarea() {
  const textarea = document.querySelector("#json-import");
  const rawJson = textarea?.value.trim();
  if (!rawJson) return;

  try {
    importWorkspaceJson(rawJson);
    render();
    showToast("Workspace imported", "success");
  } catch (error) {
    showToast("Import failed: check the JSON format", "info");
  }
}

async function connectApiSession() {
  const memberId = document.querySelector("#api-member")?.value || currentMemberId;

  try {
    const health = await apiRequest("/api/health");
    const session = await apiRequest("/api/auth/demo-login", {
      method: "POST",
      body: { memberId }
    });
    saveApiSession({
      ...session,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    render();
    showToast(`Connected to API as ${session.user.name}`, "success");
  } catch (error) {
    clearApiSession();
    render();
    showToast("API unavailable. Start npm run dev:api and try again.", "info");
  }
}

async function signInWithEmail() {
  const email = document.querySelector("#api-email")?.value.trim();
  if (!email) {
    showToast("Enter an email address", "info");
    return;
  }

  try {
    const health = await apiRequest("/api/health");
    const session = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email }
    });
    saveApiSession({
      ...session,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    render();
    showToast(`Signed in as ${session.user.name}`, "success");
  } catch (error) {
    showToast(`Sign in failed: ${error.message}`, "info");
  }
}

async function signUpWithPassword() {
  const name = document.querySelector("#api-account-name")?.value.trim();
  const email = document.querySelector("#api-email")?.value.trim();
  const password = document.querySelector("#api-password")?.value;
  if (!name || !email || !password) {
    showToast("Enter name, email, and password", "info");
    return;
  }

  try {
    const health = await apiRequest("/api/health");
    const session = await apiRequest("/api/auth/signup", {
      method: "POST",
      body: {
        name,
        email,
        password,
        workspaceName: state.workspace.name,
        workspaceSlug: state.workspace.slug
      }
    });
    saveApiSession({
      ...session,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    await saveWorkspaceToApi({ silent: true });
    render();
    showToast(`Owner account created for ${session.user.name}`, "success");
  } catch (error) {
    showToast(`Account setup failed: ${error.message}`, "info");
  }
}

async function signInWithPassword() {
  const email = document.querySelector("#api-email")?.value.trim();
  const password = document.querySelector("#api-password")?.value;
  if (!email || !password) {
    showToast("Enter email and password", "info");
    return;
  }

  try {
    const health = await apiRequest("/api/health");
    const session = await apiRequest("/api/auth/password-login", {
      method: "POST",
      body: { email, password }
    });
    saveApiSession({
      ...session,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    render();
    showToast(`Signed in as ${session.user.name}`, "success");
  } catch (error) {
    showToast(`Password sign in failed: ${error.message}`, "info");
  }
}

function disconnectApiSession() {
  clearApiSession();
  render();
  showToast("API session disconnected", "success");
}

function saveApiBaseUrl() {
  const rawUrl = document.querySelector("#api-base-url")?.value.trim() || "";
  if (!rawUrl) {
    showToast("API URL is required", "info");
    return;
  }

  try {
    const url = new URL(rawUrl);
    const normalizedUrl = url.origin.replace(/\/+$/, "");
    localStorage.setItem("agora.api.baseUrl", normalizedUrl);
    showToast("API URL saved. Reloading Agora.", "success");
    window.setTimeout(() => window.location.reload(), 400);
  } catch (error) {
    showToast("Enter a valid API URL, like http://127.0.0.1:8787", "info");
  }
}

async function syncAccessFromApi() {
  if (!apiSession) return;

  const access = await apiRequest("/api/members");
  state.users = Array.isArray(access.users)
    ? access.users.filter((user) => !members.some((member) => member.id === user.id))
    : state.users;
  state.memberships = Array.isArray(access.memberships) ? access.memberships : state.memberships;
  state.invitations = Array.isArray(access.invitations) ? access.invitations : state.invitations;
  saveState();
}

async function inviteWorkspaceMember() {
  if (!apiSession) {
    showToast("Connect to the API before sending invites", "info");
    return;
  }

  const name = document.querySelector("#invite-name")?.value.trim() || "";
  const email = document.querySelector("#invite-email")?.value.trim() || "";
  const role = document.querySelector("#invite-role")?.value || state.workspace.defaultRole;
  const companyId = document.querySelector("#invite-company")?.value || "";
  if (!email) {
    showToast("Invite requires an email address", "info");
    return;
  }

  try {
    const result = await apiRequest("/api/invitations", {
      method: "POST",
      body: { name, email, role, companyId }
    });
    const invitation = result.invitation;
    state.invitations = [
      invitation,
      ...state.invitations.filter((item) => item.id !== invitation.id && item.email !== invitation.email)
    ];
    saveState();
    render();
    showToast(`Invite created for ${invitation.email}`, "success");
  } catch (error) {
    showToast(`Invite failed: ${error.message}`, "info");
  }
}

async function loadInvitationPreview(token) {
  invitePreviewLoading = true;
  invitePreviewToken = token;
  invitePreview = null;

  try {
    const result = await apiRequest(`/api/invitations/${encodeURIComponent(token)}`);
    invitePreview = result.invitation;
  } catch (error) {
    invitePreview = {
      token,
      name: "",
      email: "Invitation unavailable",
      role: "member",
      status: "missing"
    };
    showToast(`Invite lookup failed: ${error.message}`, "info");
  } finally {
    invitePreviewLoading = false;
    if (state.selectedRoute === "invite" && state.selectedInviteToken === token) render();
  }
}

async function acceptWorkspaceInvite() {
  const token = state.selectedInviteToken;
  const name = document.querySelector("#invite-accept-name")?.value.trim() || invitePreview?.name || "";
  const password = document.querySelector("#invite-accept-password")?.value || "";
  if (!token) {
    showToast("Invite token is missing", "info");
    return;
  }
  if (!name) {
    showToast("Enter your name to accept the invite", "info");
    return;
  }

  try {
    const health = await apiRequest("/api/health");
    const session = await apiRequest(`/api/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      body: { name, password }
    });
    saveApiSession({
      ...session,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    state.selectedRoute = "dashboard";
    state.selectedInviteToken = "";
    invitePreview = null;
    invitePreviewToken = "";
    saveState();
    window.history.replaceState(null, "", "#dashboard");
    render();
    showToast(`Welcome to ${state.workspace.name}, ${session.user.name}`, "success");
  } catch (error) {
    showToast(`Invite accept failed: ${error.message}`, "info");
  }
}

async function saveWorkspaceToApi(options = {}) {
  if (!apiSession) {
    if (!options.silent) showToast("Connect to the API from Settings first", "info");
    return;
  }

  try {
    const document = await apiRequest("/api/workspace", {
      method: "PUT",
      body: { snapshot: workspaceSnapshot() }
    });
    saveApiSession({ ...apiSession, lastSyncedAt: document.metadata.updatedAt, storageDriver: document.metadata.storage || apiSession.storageDriver });
    if (!options.silent) {
      render();
      showToast("Workspace saved to API", "success");
    }
  } catch (error) {
    if (!options.silent) showToast(`API save failed: ${error.message}`, "info");
    throw error;
  }
}

async function loadWorkspaceFromApi() {
  if (!apiSession) {
    showToast("Connect to the API from Settings first", "info");
    return;
  }

  try {
    const document = await apiRequest("/api/workspace");
    if (!document.snapshot) {
      showToast("No API workspace snapshot has been saved yet", "info");
      return;
    }
    applyWorkspaceSnapshot(document.snapshot);
    await loadStructuredRecordsFromApi();
    saveApiSession({ ...apiSession, lastSyncedAt: document.metadata.updatedAt, storageDriver: document.metadata.storage || apiSession.storageDriver });
    render();
    showToast("Workspace loaded from API", "success");
  } catch (error) {
    showToast(`API load failed: ${error.message}`, "info");
  }
}

async function importWorkspaceToApi() {
  if (!apiSession) {
    showToast("Connect to the API from Settings first", "info");
    return;
  }

  const rawJson = document.querySelector("#json-import")?.value.trim();
  if (!rawJson) {
    showToast("Paste a JSON export before importing to the API", "info");
    return;
  }

  try {
    const snapshot = JSON.parse(rawJson);
    const document = await apiRequest("/api/workspace/import", {
      method: "POST",
      body: { snapshot }
    });
    saveApiSession({ ...apiSession, lastSyncedAt: document.metadata.updatedAt, storageDriver: document.metadata.storage || apiSession.storageDriver });
    render();
    showToast("JSON imported to API", "success");
  } catch (error) {
    showToast(`API import failed: ${error.message}`, "info");
  }
}

async function syncProjectToApi(project, action = "Project synced", isNew = false) {
  if (!apiSession) return;

  try {
    await apiRequest(isNew ? "/api/projects" : `/api/projects/${encodeURIComponent(project.id)}`, {
      method: isNew ? "POST" : "PUT",
      body: { project }
    });
    showToast(action, "success");
  } catch (error) {
    showToast(`Local change saved. API project sync failed: ${error.message}`, "info");
  }
}

async function syncTaskToApi(task, action = "Task synced", isNew = false) {
  if (!apiSession) return;

  try {
    await apiRequest(isNew ? "/api/tasks" : `/api/tasks/${encodeURIComponent(task.id)}`, {
      method: isNew ? "POST" : "PUT",
      body: { task }
    });
    showToast(action, "success");
  } catch (error) {
    showToast(`Local change saved. API task sync failed: ${error.message}`, "info");
  }
}

async function syncTaskArchiveToApi(taskId) {
  if (!apiSession) return;

  try {
    await apiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE"
    });
    showToast("Task archive synced to API", "success");
  } catch (error) {
    showToast(`Local change saved. API task archive failed: ${error.message}`, "info");
  }
}

async function syncProjectArchiveToApi(projectId) {
  if (!apiSession) return;

  try {
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE"
    });
    showToast("Project archive synced to API", "success");
  } catch (error) {
    showToast(`Local change saved. API project archive failed: ${error.message}`, "info");
  }
}

async function syncRecordToApi(collection, record, action = "Record synced", showSuccess = true) {
  if (!apiSession) return;

  try {
    await apiRequest(`/api/records/${encodeURIComponent(collection)}`, {
      method: "POST",
      body: { record }
    });
    if (showSuccess) showToast(action, "success");
  } catch (error) {
    showToast(`Local change saved. API ${collection} sync failed: ${error.message}`, "info");
  }
}

async function syncCommentToApi(comment, action = "Comment synced") {
  await syncRecordToApi("comments", comment, action);
}

async function syncActivityToApi(activity) {
  await syncRecordToApi("activities", activity, "Activity synced", false);
}

async function syncDocumentToApi(document, action = "Doc synced") {
  await syncRecordToApi("documents", document, action);
}

async function syncFileToApi(file, action = "File synced") {
  await syncRecordToApi("files", file, action);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./sw.js")
    .then(() => {
      if (state.selectedRoute === "settings") {
        render();
      }
    })
    .catch(() => showToast("Offline shell could not be registered", "info"));
}

async function installPwa() {
  if (!pwaInstallPrompt) {
    showToast("Use your browser's Add to Home Screen action to install Agora", "info");
    return;
  }

  pwaInstallPrompt.prompt();
  const choice = await pwaInstallPrompt.userChoice;
  pwaInstallPrompt = null;
  pwaInstallReady = false;
  render();
  showToast(choice.outcome === "accepted" ? "Agora install started" : "Install dismissed", choice.outcome === "accepted" ? "success" : "info");
}

async function requestNotificationPermission() {
  if (typeof Notification === "undefined") {
    notificationPermissionState = "unsupported";
    render();
    showToast("Notifications are not supported in this browser", "info");
    return;
  }

  notificationPermissionState = await Notification.requestPermission();
  render();
  showToast(notificationPermissionState === "granted" ? "Notifications enabled" : "Notifications not enabled", notificationPermissionState === "granted" ? "success" : "info");
}

async function sendTestNotification() {
  if (notificationPermissionState !== "granted") {
    showToast("Enable notifications before testing alerts", "info");
    return;
  }

  const title = "Agora";
  const options = {
    body: "Mobile notifications are ready for task and inbox alerts.",
    icon: "./assets/agora-mark.svg",
    badge: "./assets/agora-mark.svg"
  };

  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration?.showNotification) {
    registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
  showToast("Test notification sent", "success");
}

document.addEventListener("click", (event) => {
  const toastDismissButton = event.target.closest("[data-toast-dismiss]");
  if (toastDismissButton) {
    dismissToast(toastDismissButton.dataset.toastDismiss);
    return;
  }

  const sidebarToggle = event.target.closest("[data-sidebar-toggle]");
  if (sidebarToggle) {
    const groupId = sidebarToggle.dataset.sidebarToggle;
    sidebarState[groupId] = !sidebarState[groupId];
    saveSidebarState();
    renderSidebarGroups();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) setRoute(routeButton.dataset.route);

  const createDocButton = event.target.closest("#doc-create");
  if (createDocButton) createDocument();

  const createFileButton = event.target.closest("#file-create");
  if (createFileButton) createFileRecord();

  const submitIntakeButton = event.target.closest("[data-submit-intake]");
  if (submitIntakeButton) submitIntakeRequest(submitIntakeButton.dataset.submitIntake);

  const convertSubmissionButton = event.target.closest("[data-convert-submission]");
  if (convertSubmissionButton) convertSubmissionToTask(convertSubmissionButton.dataset.convertSubmission);

  const createFieldButton = event.target.closest("#field-create");
  if (createFieldButton) createCustomField();

  const useProjectTemplateButton = event.target.closest("[data-use-project-template]");
  if (useProjectTemplateButton) createProjectTemplateFromButton(useProjectTemplateButton);

  const useTaskTemplateButton = event.target.closest("[data-use-task-template]");
  if (useTaskTemplateButton) createTaskTemplateFromButton(useTaskTemplateButton);

  const templateSubmissionButton = event.target.closest("[data-template-submission]");
  if (templateSubmissionButton) createProjectFromSubmission(templateSubmissionButton.dataset.templateSubmission);

  const runAutomationButton = event.target.closest("[data-run-automation]");
  if (runAutomationButton) runAutomation(runAutomationButton.dataset.runAutomation);

  const toggleAutomationButton = event.target.closest("[data-toggle-automation]");
  if (toggleAutomationButton) toggleAutomation(toggleAutomationButton.dataset.toggleAutomation);

  const runAllAutomationsButton = event.target.closest("#automation-run-all");
  if (runAllAutomationsButton) runAllAutomations();

  const automationSuggestionButton = event.target.closest("[data-automation-suggestion]");
  if (automationSuggestionButton) logAutomationSuggestion(automationSuggestionButton.dataset.automationSuggestion);

  const approvalActionButton = event.target.closest("[data-approval-action]");
  if (approvalActionButton) {
    updateApprovalStatus(
      approvalActionButton.dataset.approvalId,
      approvalActionButton.dataset.approvalAction,
      approvalActionButton.dataset.inboxId || ""
    );
    return;
  }

  const companyUpdateButton = event.target.closest("[data-company-update]");
  if (companyUpdateButton) draftCompanyUpdate(companyUpdateButton.dataset.companyUpdate);

  const workspaceSaveButton = event.target.closest("#workspace-save");
  if (workspaceSaveButton) saveWorkspaceSettings();

  const pwaInstallButton = event.target.closest("#pwa-install");
  if (pwaInstallButton) installPwa();

  const notificationRequestButton = event.target.closest("#notification-request");
  if (notificationRequestButton) requestNotificationPermission();

  const notificationTestButton = event.target.closest("#notification-test");
  if (notificationTestButton) sendTestNotification();

  const importJsonButton = event.target.closest("#import-json");
  if (importJsonButton) importWorkspaceFromTextarea();

  const refreshExportButton = event.target.closest("#refresh-export");
  if (refreshExportButton) renderDataManagement();

  const apiConnectButton = event.target.closest("#api-connect");
  if (apiConnectButton) connectApiSession();

  const apiUrlSaveButton = event.target.closest("#api-url-save");
  if (apiUrlSaveButton) saveApiBaseUrl();

  const apiEmailLoginButton = event.target.closest("#api-email-login");
  if (apiEmailLoginButton) signInWithEmail();

  const apiPasswordSignupButton = event.target.closest("#api-password-signup");
  if (apiPasswordSignupButton) signUpWithPassword();

  const apiPasswordLoginButton = event.target.closest("#api-password-login");
  if (apiPasswordLoginButton) signInWithPassword();

  const apiDisconnectButton = event.target.closest("#api-disconnect");
  if (apiDisconnectButton) disconnectApiSession();

  const inviteMemberButton = event.target.closest("#invite-member");
  if (inviteMemberButton) inviteWorkspaceMember();

  const acceptInviteButton = event.target.closest("#invite-accept");
  if (acceptInviteButton) acceptWorkspaceInvite();

  const apiSaveButton = event.target.closest("#api-save-workspace");
  if (apiSaveButton) saveWorkspaceToApi();

  const apiLoadButton = event.target.closest("#api-load-workspace");
  if (apiLoadButton) loadWorkspaceFromApi();

  const apiImportButton = event.target.closest("#api-import-workspace");
  if (apiImportButton) importWorkspaceToApi();

  const taskPlanTodayButton = event.target.closest("[data-task-plan-today]");
  if (taskPlanTodayButton) {
    planTaskToday(taskPlanTodayButton.dataset.taskPlanToday);
    return;
  }

  const taskCompleteButton = event.target.closest("[data-task-complete]");
  if (taskCompleteButton) {
    completeTask(taskCompleteButton.dataset.taskComplete);
    return;
  }

  const archiveProjectButton = event.target.closest("[data-archive-project]");
  if (archiveProjectButton) {
    archiveProject(archiveProjectButton.dataset.archiveProject);
    return;
  }

  const archiveTaskButton = event.target.closest("[data-archive-task]");
  if (archiveTaskButton) {
    archiveTask(archiveTaskButton.dataset.archiveTask);
    return;
  }

  const projectButton = event.target.closest("[data-project-id]");
  if (projectButton) setProject(projectButton.dataset.projectId);

  const companyButton = event.target.closest("[data-company-id]");
  if (companyButton) setCompany(companyButton.dataset.companyId);

  const newCompanyButton = event.target.closest("#new-company-button");
  if (newCompanyButton) {
    populateCompanyForm();
    openDialog(els.companyDialog);
  }

  const newProjectTaskButton = event.target.closest("#new-task-button-project");
  if (newProjectTaskButton) {
    populateTaskForm();
    openDialog(els.taskDialog);
  }

  const editCompanyButton = event.target.closest("[data-edit-company]");
  if (editCompanyButton) {
    populateCompanyForm(byId(state.companies, editCompanyButton.dataset.editCompany));
    openDialog(els.companyDialog);
  }

  const subtaskButton = event.target.closest("#subtask-submit");
  if (subtaskButton) addDraftSubtask();

  const deleteSubtaskButton = event.target.closest("[data-delete-subtask]");
  if (deleteSubtaskButton) deleteDraftSubtask(deleteSubtaskButton.dataset.deleteSubtask);

  const previousMonthButton = event.target.closest("[data-calendar-shift]");
  if (previousMonthButton) {
    state.selectedCalendarMonth = shiftMonth(state.selectedCalendarMonth, Number(previousMonthButton.dataset.calendarShift));
    saveState();
    render();
  }

  const todayButton = event.target.closest("[data-calendar-today]");
  if (todayButton) {
    state.selectedCalendarMonth = new Date().toISOString().slice(0, 7);
    saveState();
    render();
  }

  const dailyPlanButton = event.target.closest("[data-daily-plan]");
  if (dailyPlanButton) {
    planTaskForDate(dailyPlanButton.dataset.taskId, dailyPlanButton.dataset.dailyPlan);
    saveState();
    render();
    showToast("Task planned for Today", "success");
  }

  const dailyActionButton = event.target.closest("[data-daily-action]");
  if (dailyActionButton) {
    const taskId = dailyActionButton.dataset.taskId;
    const action = dailyActionButton.dataset.dailyAction;
    const plan = dailyPlan(taskId);

    if (action === "done") {
      updateTask(taskId, { status: "done" });
      return;
    }

    if (action === "tomorrow") {
      planTaskForDate(taskId, plan?.lane || "next", shiftDate(state.selectedDailyDate, 1));
      saveState();
      render();
      showToast("Task moved to tomorrow", "success");
      return;
    }

    if (action === "log") {
      addQuickDailyTime(taskId);
      return;
    }
  }

  const dailyShiftButton = event.target.closest("[data-daily-shift]");
  if (dailyShiftButton) {
    state.selectedDailyDate = shiftDate(state.selectedDailyDate, Number(dailyShiftButton.dataset.dailyShift));
    saveState();
    render();
    showToast("Daily date updated", "success");
  }

  const dailyTodayButton = event.target.closest("[data-daily-today]");
  if (dailyTodayButton) {
    state.selectedDailyDate = todayKey();
    saveState();
    render();
    showToast("Showing today", "success");
  }

  const inboxPlanButton = event.target.closest("[data-inbox-plan]");
  if (inboxPlanButton) {
    planTaskForDate(inboxPlanButton.dataset.inboxPlan, "next", todayKey());
    markInboxRead(inboxPlanButton.dataset.inboxId);
    state.selectedRoute = "daily";
    state.selectedDailyDate = todayKey();
    saveState();
    render();
    showToast("Task planned for Today", "success");
  }

  const inboxReadButton = event.target.closest("[data-inbox-read]");
  if (inboxReadButton) {
    const id = inboxReadButton.dataset.inboxRead;
    state.inboxRead = isInboxRead(id)
      ? state.inboxRead.filter((itemId) => itemId !== id)
      : [...state.inboxRead, id];
    saveState();
    render();
    showToast(isInboxRead(id) ? "Notification marked read" : "Notification marked unread", "success");
  }

  const inboxClearButton = event.target.closest("[data-inbox-clear]");
  if (inboxClearButton) {
    archiveInboxItem(inboxClearButton.dataset.inboxClear);
    saveState();
    render();
    showToast("Notification cleared", "success");
  }

  const inboxBulkButton = event.target.closest("[data-inbox-bulk]");
  if (inboxBulkButton) {
    const items = getInboxItems();
    if (inboxBulkButton.dataset.inboxBulk === "read") {
      state.inboxRead = Array.from(new Set([...state.inboxRead, ...items.map((item) => item.id)]));
      showToast("All notifications marked read", "success");
    }
    if (inboxBulkButton.dataset.inboxBulk === "archive-read") {
      const readIds = items.filter((item) => isInboxRead(item.id)).map((item) => item.id);
      state.inboxArchived = Array.from(new Set([...state.inboxArchived, ...readIds]));
      showToast("Read notifications cleared", "success");
    }
    saveState();
    render();
  }

  const projectTabButton = event.target.closest("[data-project-tab]");
  if (projectTabButton) {
    state.selectedProjectTab = projectTabButton.dataset.projectTab;
    saveState();
    render();
  }

  const commentButton = event.target.closest("#comment-submit");
  if (commentButton) addTaskComment();

  const timeButton = event.target.closest("#time-submit");
  if (timeButton) addTaskTimeEntry();

  const editButton = event.target.closest("[data-edit-task]");
  if (editButton) {
    if (editButton.dataset.inboxId) {
      markInboxRead(editButton.dataset.inboxId);
      saveState();
      renderNotificationBadges();
    }
    populateTaskForm(byId(state.tasks, editButton.dataset.editTask));
    openDialog(els.taskDialog);
  }

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) closeDialog(document.querySelector(`#${closeButton.dataset.closeDialog}`));
});

document.addEventListener("change", (event) => {
  const memberRoleSelect = event.target.closest("[data-member-role]");
  if (memberRoleSelect) {
    updateMemberRole(memberRoleSelect.dataset.memberRole, memberRoleSelect.value);
    return;
  }

  const taskProjectSelect = event.target.closest("#task-project");
  if (taskProjectSelect) {
    const taskId = document.querySelector("#task-id")?.value;
    renderTaskDependencies(taskId ? byId(state.tasks, taskId) : null);
  }

  const subtaskCheckbox = event.target.closest("[data-toggle-subtask]");
  if (subtaskCheckbox) toggleDraftSubtask(subtaskCheckbox.dataset.toggleSubtask, subtaskCheckbox.checked);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.closest("#subtask-title")) {
    event.preventDefault();
    addDraftSubtask();
  }
});

document.querySelector("#new-task-button").addEventListener("click", () => {
  populateTaskForm();
  openDialog(els.taskDialog);
});

document.querySelector("#new-project-button").addEventListener("click", () => {
  populateProjectForm();
  openDialog(els.projectDialog);
});

[els.taskDialog, els.projectDialog, els.companyDialog].filter(Boolean).forEach((dialog) => {
  dialog.addEventListener("close", restoreDialogFocus);
});

document.querySelector("#seed-reset").addEventListener("click", () => {
  state = structuredClone(seedData);
  saveState();
  render();
  showToast("Sample data reset", "success");
});

els.searchInput.addEventListener("input", (event) => {
  state.filters.query = event.target.value;
  saveState();
  render();
});

els.companyFilter.addEventListener("change", (event) => {
  state.filters.company = event.target.value;
  state.selectedProject = "all";
  if (state.selectedRoute === "company") {
    state.selectedCompany = event.target.value;
    state.selectedRoute = event.target.value === "all" ? "companies" : "company";
  }
  saveState();
  render();
});

els.projectFilter.addEventListener("change", (event) => {
  setProject(event.target.value);
});

els.assigneeFilter.addEventListener("change", (event) => {
  state.filters.assignee = event.target.value;
  saveState();
  render();
});

els.statusFilter.addEventListener("change", (event) => {
  state.filters.status = event.target.value;
  saveState();
  render();
});

els.priorityFilter.addEventListener("change", (event) => {
  state.filters.priority = event.target.value;
  saveState();
  render();
});

els.appView.addEventListener("change", (event) => {
  const dailyDateInput = event.target.closest("[data-daily-date]");
  if (dailyDateInput) {
    state.selectedDailyDate = dailyDateInput.value || todayKey();
    saveState();
    render();
    return;
  }

  const select = event.target.closest("[data-inline-field]");
  if (select) {
    updateTask(select.dataset.taskId, { [select.dataset.inlineField]: select.value });
    return;
  }

  const taskDateInput = event.target.closest("[data-task-date]");
  if (taskDateInput) {
    updateTask(taskDateInput.dataset.taskDate, { dueDate: taskDateInput.value });
    return;
  }

  const taskStartInput = event.target.closest("[data-task-start]");
  if (taskStartInput) {
    updateTask(taskStartInput.dataset.taskStart, { startDate: taskStartInput.value });
    return;
  }

  const milestoneDateInput = event.target.closest("[data-milestone-date]");
  if (milestoneDateInput) {
    updateMilestoneDate(milestoneDateInput.dataset.milestoneDate, milestoneDateInput.value);
    return;
  }

  const projectDateInput = event.target.closest("[data-project-date]");
  if (projectDateInput) {
    updateProjectDate(projectDateInput.dataset.projectId, projectDateInput.dataset.projectDate, projectDateInput.value);
  }
});

els.appView.addEventListener("input", (event) => {
  const dailyNote = event.target.closest("#daily-note");
  if (!dailyNote) return;
  state.dailyNotes = {
    ...state.dailyNotes,
    [state.selectedDailyDate]: dailyNote.value
  };
  saveState();
});

els.appView.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-task-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.taskId);
});

els.appView.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-drop-status]")) event.preventDefault();
});

els.appView.addEventListener("drop", (event) => {
  const dropZone = event.target.closest("[data-drop-status]");
  if (!dropZone) return;
  event.preventDefault();
  updateTask(event.dataTransfer.getData("text/plain"), { status: dropZone.dataset.dropStatus });
});

els.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#task-id").value || uid("task");
  const existingTask = byId(state.tasks, id);
  const task = {
    id,
    projectId: document.querySelector("#task-project").value,
    title: document.querySelector("#task-title").value.trim(),
    description: document.querySelector("#task-description").value.trim(),
    assignee: document.querySelector("#task-assignee").value,
    status: document.querySelector("#task-status").value,
    priority: document.querySelector("#task-priority").value,
    startDate: document.querySelector("#task-start-date").value,
    dueDate: document.querySelector("#task-due-date").value,
    blockedBy: Array.from(document.querySelectorAll("[data-task-dependency]:checked")).map((input) => input.value),
    tags: document.querySelector("#task-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    subtasks: draftSubtasks,
    customFields: Array.from(document.querySelectorAll("[data-custom-field]")).reduce((values, input) => {
      if (input.value !== "") values[input.dataset.customField] = input.value;
      return values;
    }, {}),
    createdAt: existingTask?.createdAt || new Date().toISOString()
  };

  if (existingTask) {
    state.tasks = state.tasks.map((item) => item.id === id ? task : item);
    recordTaskChanges(existingTask, task);
  } else {
    state.tasks = [task, ...state.tasks];
    addActivity({
      projectId: task.projectId,
      taskId: task.id,
      type: "task_create",
      message: `created ${task.title}`
    });
  }

  saveState();
  closeDialog(els.taskDialog);
  render();
  showToast(existingTask ? "Task updated" : "Task created", "success");
  syncTaskToApi(task, existingTask ? "Task synced to API" : "Task created in API", !existingTask);
});

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const project = {
    id: uid("project"),
    name: document.querySelector("#project-name").value.trim(),
    companyId: document.querySelector("#project-company").value,
    description: document.querySelector("#project-description").value.trim(),
    owner: document.querySelector("#project-owner").value,
    startDate: document.querySelector("#project-start-date").value,
    dueDate: document.querySelector("#project-due-date").value
  };

  state.projects = [project, ...state.projects];
  addActivity({
    projectId: project.id,
    type: "project_create",
    message: `created project ${project.name}`
  });
  state.selectedProject = project.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "overview";
  saveState();
  closeDialog(els.projectDialog);
  render();
  showToast("Project created", "success");
  syncProjectToApi(project, "Project created in API", true);
});

els.companyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#company-id").value || uid("company");
  const existingCompany = byId(state.companies, id);
  const company = {
    id,
    name: document.querySelector("#company-name").value.trim(),
    description: document.querySelector("#company-description").value.trim(),
    type: document.querySelector("#company-type").value,
    owner: document.querySelector("#company-owner").value,
    status: document.querySelector("#company-status").value
  };

  if (existingCompany) {
    state.companies = state.companies.map((item) => item.id === id ? company : item);
  } else {
    state.companies = [company, ...state.companies];
  }

  state.selectedCompany = id;
  state.filters.company = id;
  state.selectedProject = "all";
  state.selectedRoute = "company";
  saveState();
  closeDialog(els.companyDialog);
  render();
  showToast(existingCompany ? "Company updated" : "Company created", "success");
  syncRecordToApi("companies", company, existingCompany ? "Company synced to API" : "Company created in API");
});

window.addEventListener("hashchange", () => {
  routeInviteFromLocation({ shouldRender: true });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pwaInstallPrompt = event;
  pwaInstallReady = true;
  if (state.selectedRoute === "settings") render();
});

window.addEventListener("appinstalled", () => {
  pwaInstallPrompt = null;
  pwaInstallReady = false;
  showToast("Agora installed", "success");
  if (state.selectedRoute === "settings") render();
});

registerServiceWorker();

if (!routeInviteFromLocation()) {
  openSidebarGroupForRoute(state.selectedRoute);
}
render();
