const STORAGE_KEY = "agora.workspace.v1";
const WORKSPACE_REGISTRY_KEY = "agora.workspaces.v1";
const ACTIVE_WORKSPACE_ID_KEY = "agora.activeWorkspaceId.v1";
const API_SESSION_KEY = "agora.api.session.v1";
const SIDEBAR_STATE_KEY = "agora.sidebar.v1";
const API_SYNC_QUEUE_KEY = "agora.api.syncQueue.v1";
const MAX_WORKSPACE_BACKUPS = 12;
const REALTIME_POLL_MS = 30000;
const API_BASE_URL = configuredApiBaseUrl();

function configuredApiBaseUrl() {
  const fallback = "http://127.0.0.1:8787";
  const stored = storageGet("agora.api.baseUrl") || "";
  const candidate = window.AGORA_API_BASE_URL || window.AGORA_CONFIG?.apiBaseUrl || stored || fallback;
  try {
    return new URL(candidate, window.location.origin).origin.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function storageGet(key) {
  try {
    return window.localStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Local persistence is best-effort when browser storage is unavailable.
  }
}

function storageRemove(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Local persistence is best-effort when browser storage is unavailable.
  }
}

function workspaceSnapshotKey(workspaceId) {
  return `agora.workspace.snapshot.${workspaceId}.v1`;
}

function workspaceBackupKey(workspaceId = activeWorkspaceId) {
  return `agora.workspace.backups.${workspaceId}.v1`;
}

function fallbackWorkspaceRegistry() {
  return [
    {
      id: seedData?.workspace?.id || "workspace-acme",
      name: seedData?.workspace?.name || "Acme Studio",
      slug: seedData?.workspace?.slug || "acme-studio",
      status: "active",
      template: "demo",
      createdAt: "2026-06-27T12:00:00.000Z",
      updatedAt: new Date().toISOString()
    }
  ];
}

function normalizeWorkspaceRegistry(registry) {
  const fallback = fallbackWorkspaceRegistry();
  const source = Array.isArray(registry) && registry.length ? registry : fallback;
  const seen = new Set();
  const normalized = source
    .filter((workspace) => workspace?.id)
    .map((workspace) => ({
      id: workspace.id,
      name: workspace.name || "Untitled workspace",
      slug: workspace.slug || workspace.id,
      status: workspace.status === "archived" ? "archived" : "active",
      template: workspace.template || "custom",
      createdAt: workspace.createdAt || new Date().toISOString(),
      updatedAt: workspace.updatedAt || new Date().toISOString()
    }))
    .filter((workspace) => {
      if (seen.has(workspace.id)) return false;
      seen.add(workspace.id);
      return true;
    });
  return normalized.length ? normalized : fallback;
}

function loadWorkspaceRegistry() {
  const stored = storageGet(WORKSPACE_REGISTRY_KEY);
  if (!stored) return normalizeWorkspaceRegistry();

  try {
    return normalizeWorkspaceRegistry(JSON.parse(stored));
  } catch {
    return normalizeWorkspaceRegistry();
  }
}

function saveWorkspaceRegistry() {
  storageSet(WORKSPACE_REGISTRY_KEY, JSON.stringify(workspaceRegistry));
}

function registryWorkspace(workspaceId = activeWorkspaceId) {
  return workspaceRegistry.find((workspace) => workspace.id === workspaceId) || workspaceRegistry.find((workspace) => workspace.status !== "archived") || workspaceRegistry[0];
}

function loadActiveWorkspaceId(registry) {
  const stored = storageGet(ACTIVE_WORKSPACE_ID_KEY);
  const active = registry.find((workspace) => workspace.id === stored && workspace.status !== "archived")
    || registry.find((workspace) => workspace.status !== "archived")
    || registry[0];
  return active?.id || "workspace-acme";
}

function saveActiveWorkspaceId(workspaceId) {
  storageSet(ACTIVE_WORKSPACE_ID_KEY, workspaceId);
}

const workspaceStore = {
  load() {
    return storageGet(workspaceSnapshotKey(activeWorkspaceId)) || storageGet(STORAGE_KEY);
  },
  save(nextState) {
    storageSet(workspaceSnapshotKey(activeWorkspaceId), JSON.stringify(nextState));
    storageSet(STORAGE_KEY, JSON.stringify(nextState));
  },
  clear() {
    storageRemove(workspaceSnapshotKey(activeWorkspaceId));
  }
};

const workspaceBackupStore = {
  load(workspaceId = activeWorkspaceId) {
    const stored = storageGet(workspaceBackupKey(workspaceId));
    if (!stored) return [];

    try {
      const backups = JSON.parse(stored);
      return Array.isArray(backups) ? backups : [];
    } catch {
      return [];
    }
  },
  save(backups, workspaceId = activeWorkspaceId) {
    storageSet(workspaceBackupKey(workspaceId), JSON.stringify(backups));
  },
  clear(workspaceId = activeWorkspaceId) {
    storageRemove(workspaceBackupKey(workspaceId));
  }
};

const apiSessionStore = {
  load() {
    const stored = storageGet(API_SESSION_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },
  save(session) {
    storageSet(API_SESSION_KEY, JSON.stringify(session));
  },
  clear() {
    storageRemove(API_SESSION_KEY);
  }
};

const apiSyncQueueStore = {
  load() {
    const stored = storageGet(API_SYNC_QUEUE_KEY);
    if (!stored) return [];

    try {
      const queue = JSON.parse(stored);
      return Array.isArray(queue) ? queue : [];
    } catch {
      return [];
    }
  },
  save(queue) {
    storageSet(API_SYNC_QUEUE_KEY, JSON.stringify(queue));
  },
  clear() {
    storageRemove(API_SYNC_QUEUE_KEY);
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
  const stored = storageGet(SIDEBAR_STATE_KEY);
  if (!stored) return { ...sidebarDefaults };

  try {
    return { ...sidebarDefaults, ...JSON.parse(stored) };
  } catch {
    return { ...sidebarDefaults };
  }
}

function saveSidebarState() {
  storageSet(SIDEBAR_STATE_KEY, JSON.stringify(sidebarState));
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

const featureRequestStatuses = [
  { id: "new", label: "New" },
  { id: "triaged", label: "Triaged" },
  { id: "planned", label: "Planned" },
  { id: "shipped", label: "Shipped" },
  { id: "declined", label: "Declined" }
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

const settingsTabs = [
  { id: "account", label: "Account" },
  { id: "workspace", label: "Workspace" },
  { id: "feedback", label: "Feedback" },
  { id: "trust", label: "Trust" },
  { id: "members", label: "Members" },
  { id: "integrations", label: "Integrations" },
  { id: "payments", label: "Payments" },
  { id: "sync", label: "Sync" },
  { id: "security", label: "Security" },
  { id: "developer", label: "Developer" }
];

const paymentProviderOptions = [
  { id: "none", label: "Disabled" },
  { id: "stripe", label: "Stripe" },
  { id: "x402", label: "x402" },
  { id: "manual", label: "Manual invoice" }
];

const paymentCurrencyOptions = ["USD", "USDC", "CAD", "EUR", "GBP"];

const paymentPlanOptions = [
  {
    id: "free",
    label: "Free",
    priceLabel: "$0/mo",
    description: "For solo setup and small internal trials.",
    limits: { members: 3, projects: 3, entitlements: 1 },
    features: ["Workspace basics", "Public requests", "Manual exports"]
  },
  {
    id: "team",
    label: "Team",
    priceLabel: "$29/mo",
    description: "For active teams running client work in Agora.",
    limits: { members: 15, projects: 25, entitlements: 10 },
    features: ["Client portal", "Automation runs", "Priority imports"]
  },
  {
    id: "agency",
    label: "Agency",
    priceLabel: "$99/mo",
    description: "For multi-client operations and heavier governance.",
    limits: { members: null, projects: null, entitlements: null },
    features: ["Unlimited scale", "Advanced audit", "Dedicated launch support"]
  }
];

const entitlementSourceOptions = [
  { id: "test", label: "Test grant" },
  { id: "manual", label: "Manual grant" },
  { id: "payment", label: "Payment" },
  { id: "promo", label: "Promo" }
];

const templatePayoutModes = [
  { id: "creator", label: "Creator wallet" },
  { id: "charity", label: "Charity wallet" },
  { id: "split", label: "Creator + charity split" }
];

const templatePayoutChains = ["Not set", "Base", "Ethereum", "Solana", "Polygon", "Bitcoin", "Other"];

const dashboardWidgetCatalog = [
  { id: "projects", label: "Active Projects", description: "Project health and current delivery lanes." },
  { id: "goals", label: "Goals", description: "Objective progress and portfolio risk." },
  { id: "capacity", label: "Capacity", description: "Team load and available capacity." },
  { id: "operator", label: "Operator Signals", description: "AI/operator risk queue." },
  { id: "due-soon", label: "Due Soon", description: "Upcoming tasks from the active filters." },
  { id: "mobile", label: "Mobile App", description: "PWA install and mobile roadmap." }
];

const integrationCatalog = [
  {
    id: "slack",
    name: "Slack",
    category: "Chat",
    description: "Route inbox alerts, watched task mentions, and project status changes into team channels.",
    signals: ["Mentions", "Task updates", "Daily digest"]
  },
  {
    id: "github",
    name: "GitHub",
    category: "Development",
    description: "Link issues, pull requests, release milestones, and engineering task status.",
    signals: ["Issues", "Pull requests", "Releases"]
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Files",
    description: "Attach shared files and keep project docs discoverable from the workspace.",
    signals: ["Files", "Docs", "Folders"]
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Calendar",
    description: "Mirror due dates, milestones, review meetings, and focus blocks.",
    signals: ["Due dates", "Milestones", "Focus time"]
  },
  {
    id: "zapier",
    name: "Zapier",
    category: "Automation",
    description: "Send Agora events into no-code automations and receive intake triggers from other apps.",
    signals: ["Webhooks", "Intake", "Automation"]
  },
  {
    id: "webhooks",
    name: "Custom Webhooks",
    category: "API",
    description: "Publish workspace events to a self-hosted endpoint with a signing-secret workflow.",
    signals: ["Outbound events", "Signed payloads", "Retries"]
  },
  {
    id: "api",
    name: "Agora API",
    category: "API",
    description: "Use authenticated API access for internal tools, reporting scripts, and custom adapters.",
    signals: ["Records", "Snapshots", "Audit log"]
  }
];

const integrationStatuses = [
  { id: "planned", label: "Planned" },
  { id: "connected", label: "Connected" },
  { id: "paused", label: "Paused" },
  { id: "disabled", label: "Disabled" }
];

const integrationSyncModes = [
  { id: "none", label: "No sync" },
  { id: "inbound", label: "Inbound" },
  { id: "outbound", label: "Outbound" },
  { id: "two-way", label: "Two-way" }
];

const integrationEventOptions = ["task.updated", "approval.requested", "comment.created", "file.shared", "daily.digest", "intake.submitted"];

const automationTriggerOptions = [
  { id: "task_due_soon", label: "Task due soon" },
  { id: "task_blocked", label: "Task is blocked" },
  { id: "intake_high", label: "High urgency intake" },
  { id: "approval_pending", label: "Approval pending" },
  { id: "milestone_due", label: "Milestone due soon" }
];

const automationConditionOptions = [
  { id: "any", label: "Any matching record" },
  { id: "project", label: "Specific project" },
  { id: "assignee", label: "Specific assignee" },
  { id: "company", label: "Specific company" },
  { id: "priority", label: "Specific priority" }
];

const automationActionOptions = [
  { id: "create_task", label: "Create follow-up task" },
  { id: "set_risk", label: "Set risk field" },
  { id: "add_activity", label: "Record activity" },
  { id: "draft_update", label: "Draft client update" },
  { id: "notify_channel", label: "Notify integration channel" }
];

const aiPermissionDefaults = {
  createTasks: true,
  planToday: true,
  editDocs: true,
  manageApprovals: true,
  readClientData: true,
  integrationEvents: true
};

const aiPermissionOptions = [
  { id: "createTasks", label: "Create tasks", description: "Operator can add recovery, unblock, and approval follow-up tasks." },
  { id: "planToday", label: "Plan Today", description: "Operator can move work into the Today plan and leave planning notes." },
  { id: "editDocs", label: "Draft docs", description: "Operator can create client updates and generated workspace docs." },
  { id: "manageApprovals", label: "Approvals", description: "Operator can request approvals and chase pending approvals." },
  { id: "readClientData", label: "Client data", description: "Operator can use client companies, portals, approvals, docs, and files as context." },
  { id: "integrationEvents", label: "Integration events", description: "Operator can trigger adapter health and integration digest checks." }
];

const aiPermissionPresets = [
  {
    id: "safe",
    label: "Safe",
    description: "Read-only planning help with no client context or applied changes.",
    permissions: {
      createTasks: false,
      planToday: false,
      editDocs: false,
      manageApprovals: false,
      readClientData: false,
      integrationEvents: false
    }
  },
  {
    id: "project-pm",
    label: "Project PM",
    description: "Can create and plan internal work, but cannot touch client docs or approvals.",
    permissions: {
      createTasks: true,
      planToday: true,
      editDocs: false,
      manageApprovals: false,
      readClientData: false,
      integrationEvents: false
    }
  },
  {
    id: "client-pm",
    label: "Client PM",
    description: "Can draft client updates and approvals with preview, rationale, and undo.",
    permissions: {
      createTasks: true,
      planToday: true,
      editDocs: true,
      manageApprovals: true,
      readClientData: true,
      integrationEvents: false
    }
  },
  {
    id: "ops-admin",
    label: "Ops Admin",
    description: "Full operator scope, including integration event checks.",
    permissions: { ...aiPermissionDefaults }
  }
];

const automationMarketplacePacks = [
  {
    id: "automation-pack-agency-handoff",
    name: "Agency Client Handoff",
    category: "Agency",
    creatorName: "Agora Community",
    license: "MIT-style workflow pack",
    description: "Catch risky client delivery moments, draft updates, and keep approvals moving without building rules from scratch.",
    rules: [
      {
        name: "Draft weekly client update",
        triggerKind: "task_due_soon",
        conditionKind: "company",
        conditionValue: "Client",
        actionKind: "draft_update",
        actionTarget: "client update",
        enabled: true
      },
      {
        name: "Chase pending client approval",
        triggerKind: "approval_pending",
        conditionKind: "company",
        conditionValue: "Client",
        actionKind: "create_task",
        actionTarget: "approval follow-up",
        enabled: true
      }
    ]
  },
  {
    id: "automation-pack-founder-ops",
    name: "Founder Ops",
    category: "Operations",
    creatorName: "Agora Community",
    license: "MIT-style workflow pack",
    description: "A lightweight operator pack for small teams that need due-soon work surfaced and blockers logged fast.",
    rules: [
      {
        name: "Plan high-risk due-soon work",
        triggerKind: "task_due_soon",
        conditionKind: "priority",
        conditionValue: "High",
        actionKind: "create_task",
        actionTarget: "today follow-up",
        enabled: true
      },
      {
        name: "Log blocked work for standup",
        triggerKind: "task_blocked",
        conditionKind: "any",
        conditionValue: "",
        actionKind: "add_activity",
        actionTarget: "standup note",
        enabled: true
      }
    ]
  },
  {
    id: "automation-pack-release-control",
    name: "Release Control",
    category: "Software",
    creatorName: "Agora Community",
    license: "MIT-style workflow pack",
    description: "Watch milestones, raise risky launch tasks, and create a trail for engineering release coordination.",
    rules: [
      {
        name: "Watch release milestones",
        triggerKind: "milestone_due",
        conditionKind: "any",
        conditionValue: "",
        actionKind: "add_activity",
        actionTarget: "release watch",
        enabled: true
      },
      {
        name: "Escalate blocked launch work",
        triggerKind: "task_blocked",
        conditionKind: "project",
        conditionValue: "Launch",
        actionKind: "set_risk",
        actionTarget: "High",
        enabled: true
      }
    ]
  }
];

const themePresets = [
  {
    id: "auto",
    label: "Auto",
    description: "Follow your browser or OS light and dark appearance.",
    swatches: ["#f6f5f0", "#76b7ad", "#151817"]
  },
  {
    id: "agora",
    label: "Agora",
    description: "Warm neutral workspace with the classic Agora teal accent.",
    swatches: ["#f6f5f0", "#245a58", "#dce8e5"]
  },
  {
    id: "night",
    label: "Night",
    description: "Low-glare dark surfaces for long planning sessions.",
    swatches: ["#151817", "#76b7ad", "#263432"]
  },
  {
    id: "cobalt",
    label: "Cobalt",
    description: "Cooler product-team palette with a sharper blue accent.",
    swatches: ["#f4f7fb", "#2f5f9d", "#dde8fb"]
  },
  {
    id: "olive",
    label: "Olive",
    description: "Quiet operations palette for delivery teams and client work.",
    swatches: ["#f5f4ec", "#536b38", "#e4ead7"]
  }
];

const densityOptions = [
  { id: "comfortable", label: "Comfortable" },
  { id: "compact", label: "Compact" }
];

const currentMemberId = "mara";

const marketplaceProjectTemplates = [
  {
    id: "marketplace-nonprofit-grant",
    name: "Nonprofit Grant Campaign",
    category: "Nonprofit",
    description: "Coordinate grant research, narrative drafts, budget package, board review, submission, and follow-up reporting.",
    owner: "mara",
    durationDays: 42,
    tasks: [
      { key: "research", title: "Research grant fit", description: "Confirm eligibility, program fit, deadlines, and submission requirements.", assignee: "mara", priority: "high", startOffset: 0, dueOffset: 5, tags: ["grant", "research"], blockedBy: [], subtasks: ["Check eligibility", "Capture deadline", "List required attachments"] },
      { key: "narrative", title: "Draft grant narrative", description: "Write need, program design, impact model, and implementation plan.", assignee: "nina", priority: "urgent", startOffset: 5, dueOffset: 18, tags: ["writing", "impact"], blockedBy: ["research"], subtasks: ["Need statement", "Program plan", "Impact measures"] },
      { key: "budget", title: "Prepare grant budget", description: "Build budget, match notes, staff allocations, and finance assumptions.", assignee: "sam", priority: "high", startOffset: 10, dueOffset: 22, tags: ["budget", "finance"], blockedBy: ["research"], subtasks: ["Budget draft", "Narrative notes", "Finance review"] },
      { key: "review", title: "Run board and partner review", description: "Collect feedback from leadership, finance, and program partners.", assignee: "eli", priority: "normal", startOffset: 22, dueOffset: 32, tags: ["review"], blockedBy: ["narrative", "budget"], subtasks: ["Leadership review", "Partner feedback", "Final edits"] },
      { key: "submit", title: "Submit grant package", description: "Finalize forms, attachments, signatures, and submission receipt.", assignee: "mara", priority: "urgent", startOffset: 32, dueOffset: 38, tags: ["submission"], blockedBy: ["review"], subtasks: ["Upload attachments", "Final proof", "Save receipt"] },
      { key: "followup", title: "Plan reporting follow-up", description: "Create award follow-up, reporting calendar, and measurement owner list.", assignee: "sam", priority: "normal", startOffset: 38, dueOffset: 42, tags: ["reporting"], blockedBy: ["submit"], subtasks: ["Reporting dates", "Metric owners", "Archive package"] }
    ],
    milestones: [
      { title: "Grant package drafted", description: "Narrative and budget are ready for review.", owner: "mara", dueOffset: 24, status: "planned", taskKeys: ["narrative", "budget"] },
      { title: "Grant submitted", description: "Application package is submitted and receipt is saved.", owner: "mara", dueOffset: 38, status: "planned", taskKeys: ["submit"] }
    ],
    docs: [
      { title: "Grant Narrative Outline", type: "Template", body: "Need, program model, implementation, impact measures, and sustainability." },
      { title: "Grant Budget Notes", type: "Brief", body: "Budget assumptions, match, staff allocations, restricted funds, and reporting requirements." }
    ],
    intakeForm: {
      title: "Grant Opportunity Intake",
      assignee: "mara",
      description: "Capture grant opportunities, eligibility notes, and submission deadlines."
    }
  },
  {
    id: "marketplace-podcast-season",
    name: "Podcast Season Production",
    category: "Media",
    description: "Plan and produce a podcast season from concept and guests through recording, editing, publishing, and promotion.",
    owner: "nina",
    durationDays: 56,
    tasks: [
      { key: "season-brief", title: "Define season brief", description: "Lock theme, audience, episode count, tone, and release cadence.", assignee: "nina", priority: "high", startOffset: 0, dueOffset: 6, tags: ["podcast", "strategy"], blockedBy: [], subtasks: ["Theme", "Audience", "Episode count"] },
      { key: "guest-list", title: "Confirm guests and topics", description: "Build guest list, outreach notes, topics, and scheduling windows.", assignee: "sam", priority: "high", startOffset: 6, dueOffset: 18, tags: ["guests"], blockedBy: ["season-brief"], subtasks: ["Guest shortlist", "Outreach", "Topic notes"] },
      { key: "record", title: "Record interviews", description: "Schedule sessions, capture audio, collect releases, and log raw files.", assignee: "eli", priority: "urgent", startOffset: 18, dueOffset: 34, tags: ["recording"], blockedBy: ["guest-list"], subtasks: ["Session schedule", "Audio check", "Release forms"] },
      { key: "edit", title: "Edit season episodes", description: "Edit audio, write show notes, pull clips, and run quality review.", assignee: "nina", priority: "high", startOffset: 28, dueOffset: 48, tags: ["editing"], blockedBy: ["record"], subtasks: ["Episode edits", "Show notes", "Clip list"] },
      { key: "publish", title: "Publish and promote season", description: "Schedule episodes, publish assets, social clips, newsletter, and partner notes.", assignee: "mara", priority: "normal", startOffset: 48, dueOffset: 56, tags: ["launch", "promotion"], blockedBy: ["edit"], subtasks: ["Schedule episodes", "Newsletter", "Social clips"] }
    ],
    milestones: [
      { title: "Guests confirmed", description: "Season guests and episode topics are locked.", owner: "sam", dueOffset: 20, status: "planned", taskKeys: ["guest-list"] },
      { title: "Season ready to publish", description: "Edited episodes and launch assets are ready.", owner: "nina", dueOffset: 50, status: "planned", taskKeys: ["edit", "publish"] }
    ],
    docs: [
      { title: "Season Brief", type: "Brief", body: "Season premise, audience, episode list, guests, cadence, and goals." },
      { title: "Episode Checklist", type: "Template", body: "Guest release, audio, edit, show notes, clips, metadata, and publish QA." }
    ],
    intakeForm: {
      title: "Guest Pitch Intake",
      assignee: "sam",
      description: "Collect guest pitches, topics, and availability."
    }
  },
  {
    id: "marketplace-hiring-pipeline",
    name: "Hiring Pipeline",
    category: "People",
    description: "Run a structured hiring search with role definition, sourcing, interviews, decision loops, offer, and onboarding handoff.",
    owner: "sam",
    durationDays: 35,
    tasks: [
      { key: "role", title: "Define role scorecard", description: "Align responsibilities, must-haves, interview criteria, and hiring panel.", assignee: "sam", priority: "urgent", startOffset: 0, dueOffset: 4, tags: ["hiring", "role"], blockedBy: [], subtasks: ["Role outcomes", "Criteria", "Panel"] },
      { key: "sourcing", title: "Launch sourcing plan", description: "Post role, identify candidates, source referrals, and prepare outreach.", assignee: "mara", priority: "high", startOffset: 4, dueOffset: 12, tags: ["sourcing"], blockedBy: ["role"], subtasks: ["Post role", "Referral request", "Outreach copy"] },
      { key: "screen", title: "Screen candidates", description: "Run initial screens, update scorecards, and shortlist candidates.", assignee: "eli", priority: "high", startOffset: 10, dueOffset: 18, tags: ["screening"], blockedBy: ["sourcing"], subtasks: ["Phone screens", "Scorecards", "Shortlist"] },
      { key: "interviews", title: "Run interview loop", description: "Schedule interviews, collect panel notes, and identify follow-up gaps.", assignee: "nina", priority: "high", startOffset: 18, dueOffset: 28, tags: ["interviews"], blockedBy: ["screen"], subtasks: ["Schedule loop", "Collect notes", "Debrief"] },
      { key: "offer", title: "Prepare offer and onboarding handoff", description: "Finalize offer, references, acceptance notes, and onboarding starter plan.", assignee: "sam", priority: "urgent", startOffset: 28, dueOffset: 35, tags: ["offer", "onboarding"], blockedBy: ["interviews"], subtasks: ["References", "Offer package", "Onboarding handoff"] }
    ],
    milestones: [
      { title: "Role open", description: "Scorecard and sourcing plan are ready.", owner: "sam", dueOffset: 5, status: "planned", taskKeys: ["role"] },
      { title: "Candidate selected", description: "Interview loop is complete and decision is captured.", owner: "sam", dueOffset: 30, status: "planned", taskKeys: ["interviews", "offer"] }
    ],
    docs: [
      { title: "Role Scorecard", type: "Template", body: "Responsibilities, competencies, must-haves, nice-to-haves, interview rubric, and panel notes." },
      { title: "Hiring Debrief", type: "Brief", body: "Candidate strengths, concerns, evidence, panel recommendation, and follow-up questions." }
    ],
    intakeForm: {
      title: "Hiring Request",
      assignee: "sam",
      description: "Capture a new role request, urgency, budget, and hiring manager notes."
    }
  },
  {
    id: "marketplace-agency-retainer-os",
    name: "Agency Retainer OS",
    category: "Premium",
    description: "A paid-style operating system for retainers: client health, monthly planning, approvals, scope control, billing notes, and renewal prep.",
    owner: "mara",
    creatorName: "Agora Community Lab",
    durationDays: 30,
    priceCents: 1900,
    currency: "USD",
    payout: {
      mode: "charity",
      recipientName: "Open Project Fund",
      walletAddress: "0xCharityWalletExample",
      chain: "Base",
      charityName: "Open Project Fund",
      donationPercent: 100,
      note: "Demo payout route for charity-directed premium templates."
    },
    tasks: [
      { key: "health", title: "Score client health", description: "Review delivery confidence, open risks, relationship strength, and renewal signals.", assignee: "mara", priority: "high", startOffset: 0, dueOffset: 3, tags: ["retainer", "health"], blockedBy: [], subtasks: ["Delivery score", "Relationship score", "Renewal signal"] },
      { key: "plan", title: "Plan monthly outcomes", description: "Turn client goals into a scoped monthly plan with owners and acceptance criteria.", assignee: "sam", priority: "urgent", startOffset: 2, dueOffset: 7, tags: ["planning"], blockedBy: ["health"], subtasks: ["Outcome list", "Owner map", "Acceptance criteria"] },
      { key: "scope", title: "Review scope and change requests", description: "Compare requested work to retainer scope and prepare change-order recommendations.", assignee: "eli", priority: "high", startOffset: 7, dueOffset: 14, tags: ["scope"], blockedBy: ["plan"], subtasks: ["Scope check", "Change requests", "Recommendation"] },
      { key: "approval", title: "Collect client approvals", description: "Package deliverables, decision notes, and approval requests for the client portal.", assignee: "nina", priority: "normal", startOffset: 14, dueOffset: 22, tags: ["approval"], blockedBy: ["scope"], subtasks: ["Deliverables", "Decision log", "Approval request"] },
      { key: "billing", title: "Prepare billing and renewal notes", description: "Capture billable context, expansion ideas, renewal risks, and next-month commitments.", assignee: "mara", priority: "normal", startOffset: 22, dueOffset: 30, tags: ["billing", "renewal"], blockedBy: ["approval"], subtasks: ["Billing notes", "Expansion ideas", "Next-month plan"] }
    ],
    milestones: [
      { title: "Monthly plan approved", description: "Client-facing monthly outcomes are approved.", owner: "sam", dueOffset: 8, status: "planned", taskKeys: ["plan"] },
      { title: "Retainer review complete", description: "Billing, renewal, and next-month notes are ready.", owner: "mara", dueOffset: 30, status: "planned", taskKeys: ["billing"] }
    ],
    docs: [
      { title: "Client Health Scorecard", type: "Template", body: "Delivery health, relationship health, risks, opportunities, renewal signal, and owner notes." },
      { title: "Retainer Scope Log", type: "Brief", body: "Included work, out-of-scope requests, change-order notes, approvals, and billing context." }
    ],
    intakeForm: {
      title: "Retainer Request Intake",
      assignee: "mara",
      description: "Capture client requests, urgency, scope fit, and approval needs."
    }
  }
];

const routes = {
  landing: "Agora",
  dashboard: "Dashboard",
  launch: "Launch Flow",
  portal: "Portal",
  daily: "Today",
  inbox: "Inbox",
  board: "Board",
  list: "List",
  calendar: "Calendar",
  "my-work": "My Work",
  time: "Time",
  operator: "Operator",
  collaboration: "Collaboration",
  reports: "Reports",
  goals: "Goals",
  marketplace: "Marketplace",
  templates: "Templates",
  automations: "Automations",
  docs: "Docs & Files",
  intake: "Intake",
  "feature-requests": "Feature Requests",
  fields: "Custom Fields",
  audit: "Audit Log",
  permissions: "Permissions",
  readiness: "Readiness",
  data: "Data",
  settings: "Settings",
  companies: "Companies",
  company: "Company",
  project: "Project",
  invite: "Accept Invite",
  feedback: "Feedback"
};

const tutorialSteps = [
  {
    id: "dashboard",
    route: "dashboard",
    target: "setup",
    title: "Start with your workspace setup",
    body: "Use the setup panel to choose demo data or a clean workspace, name the workspace, add a company, create a project, invite teammates, and connect the API."
  },
  {
    id: "navigation",
    route: "dashboard",
    target: "sidebar",
    title: "Move through the workspace",
    body: "The sidebar groups the app into Home, Work, Manage, Admin, and Projects. Open the groups you need and jump between project views without losing your filters."
  },
  {
    id: "filters",
    route: "dashboard",
    target: "toolbar",
    title: "Use filters as your command layer",
    body: "Filter by company, project, assignee, status, and priority. Save common views when you want a repeatable command center for standups or client check-ins."
  },
  {
    id: "work",
    route: "board",
    target: "view",
    title: "Run work from the core views",
    body: "Board, List, Calendar, and My Work are different lenses on the same tasks. Use whichever view fits the meeting or job in front of you."
  },
  {
    id: "today",
    route: "daily",
    target: "view",
    title: "Plan the day",
    body: "Today gives each person a focused daily task page. Pull work into Now, Next, or Later and keep daily notes next to the plan."
  },
  {
    id: "inbox",
    route: "inbox",
    target: "view",
    title: "Triage notifications",
    body: "Inbox collects due-soon work, assignments, comments, mentions, watched tasks, and activity that needs attention. Mark items read or plan them for Today."
  },
  {
    id: "settings",
    route: "settings",
    settingsTab: "sync",
    target: "settings",
    title: "Connect and understand sync",
    body: "Settings separates Account, Workspace, Members, Integrations, Sync, Security, and Developer tools. The Sync tab shows where records live and what still needs repair."
  },
  {
    id: "create",
    route: "dashboard",
    target: "topbar",
    title: "Create work quickly",
    body: "Use New Project and New Task from the top bar whenever you need to capture work. Agora keeps the same data available across board, list, calendar, reports, and client views."
  }
];

const seedData = {
  selectedRoute: "landing",
  selectedProject: "all",
  selectedCompany: "all",
  selectedInviteToken: "",
  selectedProjectTab: "overview",
  selectedSettingsTab: "account",
  selectedCalendarMonth: "2026-07",
  selectedDailyDate: "2026-06-27",
  onboarding: {
    dismissed: false,
    sampleMode: "demo",
    completedAt: "",
    wizardActive: false,
    wizardStep: 0,
    notificationsReviewed: false,
    templatesReviewed: false
  },
  tutorial: {
    active: false,
    step: 0,
    completedAt: ""
  },
  filters: {
    company: "all",
    assignee: "all",
    status: "all",
    priority: "all",
    query: ""
  },
  savedViews: [
    {
      id: "view-my-urgent",
      name: "My urgent work",
      route: "my-work",
      selectedProject: "all",
      selectedCompany: "all",
      filters: {
        company: "all",
        assignee: "mara",
        status: "all",
        priority: "urgent",
        query: ""
      },
      createdAt: "2026-06-27T09:00:00.000Z"
    }
  ],
  dailyNotes: {
    "2026-06-27": "Focus: tighten the MVP story, keep the build small, and leave notes for tomorrow."
  },
  dailyPlans: {
    "task-1": { date: "2026-06-27", lane: "now" },
    "task-2": { date: "2026-06-27", lane: "next" },
    "task-7": { date: "2026-06-27", lane: "later" }
  },
  dashboardWidgets: [
    { id: "projects", visible: true },
    { id: "goals", visible: true },
    { id: "capacity", visible: true },
    { id: "operator", visible: true },
    { id: "due-soon", visible: true },
    { id: "mobile", visible: false }
  ],
  dashboardLayouts: [
    {
      id: "layout-command-center",
      name: "Command Center",
      widgets: [
        { id: "projects", visible: true },
        { id: "goals", visible: true },
        { id: "capacity", visible: true },
        { id: "operator", visible: true },
        { id: "due-soon", visible: true },
        { id: "mobile", visible: false }
      ],
      createdAt: "2026-06-27T12:00:00.000Z",
      updatedAt: "2026-06-27T12:00:00.000Z"
    },
    {
      id: "layout-mobile-ops",
      name: "Mobile Ops",
      widgets: [
        { id: "projects", visible: true },
        { id: "goals", visible: false },
        { id: "capacity", visible: true },
        { id: "operator", visible: true },
        { id: "due-soon", visible: true },
        { id: "mobile", visible: true }
      ],
      createdAt: "2026-06-27T12:05:00.000Z",
      updatedAt: "2026-06-27T12:05:00.000Z"
    }
  ],
  selectedDashboardLayoutId: "layout-command-center",
  switcherImportPreview: null,
  switcherImportRollback: null,
  workspace: {
    id: "workspace-acme",
    name: "Acme Studio",
    slug: "acme-studio",
    visibility: "Private",
    defaultRole: "member",
    storageMode: "Browser local storage",
    backendTarget: "API + PostgreSQL",
    theme: {
      preset: "auto",
      density: "comfortable"
    },
    ai: {
      provider: "local",
      model: "Agora deterministic operator",
      baseUrl: "",
      keySource: "Server environment",
      dataPolicy: "Workspace only",
      promptTemplate: "Transparent project operator",
      auditMode: "Preview, rationale, undo",
      permissions: { ...aiPermissionDefaults }
    },
    integrations: {
      defaultOwner: "mara",
      webhookEndpoint: "",
      apiAccess: true,
      eventMirroring: true,
      connections: [
        {
          id: "api",
          status: "connected",
          syncMode: "two-way",
          owner: "mara",
          notes: "Local API is the canonical adapter surface for self-hosted integrations.",
          lastSyncedAt: "2026-06-27T12:00:00.000Z",
          health: "healthy",
          events: ["task.updated", "approval.requested", "comment.created"],
          secretStatus: "configured"
        },
        {
          id: "webhooks",
          status: "planned",
          syncMode: "outbound",
          owner: "eli",
          notes: "Use signed outbound events for automations and external reporting.",
          lastSyncedAt: "",
          health: "needs-config",
          events: ["task.updated", "approval.requested"],
          secretStatus: "missing"
        },
        {
          id: "github",
          status: "planned",
          syncMode: "inbound",
          owner: "eli",
          notes: "Map pull requests and issues back to project tasks.",
          lastSyncedAt: "",
          health: "planned",
          events: ["task.updated"],
          secretStatus: "not-required"
        }
      ]
    },
    capacity: {
      weeklyMinutes: 1800,
      focusTargetPercent: 80,
      warnAtPercent: 85,
      overloadAtPercent: 105,
      memberOverrides: [
        { memberId: "mara", weeklyMinutes: 1500 },
        { memberId: "sam", weeklyMinutes: 1800 }
      ]
    },
    payments: {
      provider: "none",
      planId: "free",
      currency: "USD",
      spendingCapCents: 0,
      marketplacePayments: false,
      clientPortalPayments: false,
      agentPayments: false,
      x402Experimental: false,
      entitlements: [],
      audit: [
        {
          id: "payment-audit-seed",
          action: "payment_foundation_ready",
          provider: "none",
          currency: "USD",
          amountCents: 0,
          status: "ready",
          note: "Payments are disabled until a provider is connected.",
          createdAt: "2026-06-27T12:00:00.000Z"
        }
      ]
    }
  },
  memberships: [
    { memberId: "mara", role: "admin", status: "active" },
    { memberId: "eli", role: "manager", status: "active" },
    { memberId: "nina", role: "member", status: "active" },
    { memberId: "sam", role: "manager", status: "active" }
  ],
  users: [],
  invitations: [],
  auditEvents: [
    {
      id: "audit-seed-workspace",
      actorId: "mara",
      action: "workspace_seed",
      detail: "Sample workspace created",
      source: "local",
      createdAt: "2026-06-27T12:00:00.000Z"
    }
  ],
  inboxRead: [],
  inboxArchived: [],
  inboxSnoozed: {},
  notificationSettings: {
    events: {
      assignment: true,
      overdue: true,
      due: true,
      mention: true,
      watched: true,
      comment: true,
      activity: false,
      approval: true
    },
    digests: {
      myWork: true,
      approvals: true,
      blockers: true,
      quietProjects: false
    },
    channels: {
      inApp: true,
      browser: false,
      webhook: false,
      email: false
    },
    cadence: "daily",
    delivery: {
      webhookUrl: "",
      emailAddress: "",
      sendResolved: false
    }
  },
  notificationHistory: [],
  notificationReminders: [],
  taskWatchers: {},
  chatMessages: [
    {
      id: "chat-seed-1",
      channel: "general",
      author: "mara",
      body: "Use this channel for workspace-level questions, launch notes, and decisions that do not belong on one task.",
      createdAt: "2026-06-27T14:00:00.000Z"
    },
    {
      id: "chat-seed-2",
      channel: "delivery",
      author: "sam",
      body: "Client approval notes are easier to track if we link the task after the decision is made.",
      projectId: "client-delivery",
      createdAt: "2026-06-27T14:15:00.000Z"
    }
  ],
  whiteboards: [
    {
      id: "whiteboard-launch-map",
      title: "Launch Planning Canvas",
      projectId: "launch",
      items: [
        { id: "wb-note-1", type: "note", text: "Importer paths reduce switching friction.", x: 8, y: 14, color: "green" },
        { id: "wb-note-2", type: "risk", text: "Dashboard widgets need saved layouts.", x: 38, y: 24, color: "amber" },
        { id: "wb-note-3", type: "decision", text: "Keep chat lightweight until API persistence is ready.", x: 66, y: 12, color: "blue" }
      ]
    }
  ],
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
  raidItems: [
    {
      id: "raid-client-scope",
      type: "risk",
      projectId: "client-delivery",
      companyId: "northstar-labs",
      title: "Client kickoff scope may expand after discovery",
      detail: "Stakeholders are still adding asks after the initial onboarding plan.",
      owner: "sam",
      severity: "high",
      status: "open",
      mitigation: "Confirm acceptance criteria and route additions through the approval packet.",
      dueDate: "2026-07-10",
      createdAt: "2026-07-05T09:00:00.000Z"
    },
    {
      id: "raid-launch-email",
      type: "assumption",
      projectId: "launch",
      companyId: "acme-studio",
      title: "SMTP will be configured before public feedback launch",
      detail: "Owner/requester updates depend on hosted email delivery being ready.",
      owner: "mara",
      severity: "medium",
      status: "watching",
      mitigation: "Keep feature request status visible in-app until email verification passes.",
      dueDate: "2026-07-12",
      createdAt: "2026-07-05T09:20:00.000Z"
    },
    {
      id: "raid-design-density-decision",
      type: "decision",
      projectId: "design-system",
      companyId: "brightline-health",
      title: "Use compact cards for dense delivery boards",
      detail: "Client prefers more tasks visible per board column for weekly review.",
      owner: "nina",
      severity: "medium",
      status: "decided",
      mitigation: "Apply compact density preset and document the client-facing board layout.",
      dueDate: "2026-07-09",
      createdAt: "2026-07-06T11:30:00.000Z"
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
  goals: [
    {
      id: "goal-open-source-launch",
      title: "Launch a credible open source project management alternative",
      owner: "mara",
      companyId: "acme-studio",
      status: "active",
      period: "Q3 2026",
      targetDate: "2026-08-15",
      projectIds: ["launch"],
      keyResults: [
        { id: "kr-launch-scope", title: "MVP scope approved and documented", progress: 72, target: "100%" },
        { id: "kr-launch-self-hosting", title: "Self-hosting path tested by early contributors", progress: 48, target: "5 testers" },
        { id: "kr-launch-community", title: "Contribution loop ready for public feedback", progress: 61, target: "10 issues labeled" }
      ]
    },
    {
      id: "goal-client-delivery-repeatability",
      title: "Make client delivery repeatable across managed companies",
      owner: "sam",
      companyId: "northstar-labs",
      status: "active",
      period: "Q3 2026",
      targetDate: "2026-08-01",
      projectIds: ["client-delivery"],
      keyResults: [
        { id: "kr-client-onboarding", title: "Agency onboarding template installed and approved", progress: 58, target: "1 reusable template" },
        { id: "kr-client-approvals", title: "Client approvals routed through portal", progress: 65, target: "90% portal approvals" },
        { id: "kr-client-time", title: "Billable delivery work tracked weekly", progress: 52, target: "100% tracked" }
      ]
    },
    {
      id: "goal-design-system-polish",
      title: "Raise product polish without slowing daily execution",
      owner: "nina",
      companyId: "brightline-health",
      status: "active",
      period: "Q3 2026",
      targetDate: "2026-08-07",
      projectIds: ["design-system"],
      keyResults: [
        { id: "kr-density", title: "Task card density validated on mobile and desktop", progress: 64, target: "2 breakpoints" },
        { id: "kr-empty-states", title: "Empty states written for new and filtered views", progress: 35, target: "8 states" },
        { id: "kr-accessibility", title: "Accessibility polish stays above release bar", progress: 70, target: "No blocker issues" }
      ]
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
    },
    {
      id: "template-finance-close",
      name: "Finance Close",
      category: "Finance",
      description: "A month-end finance project with reconciliation, review, variance analysis, reporting, and leadership signoff.",
      owner: "sam",
      durationDays: 18,
      tasks: [
        { key: "close-calendar", title: "Confirm close calendar", description: "Lock dates, owners, source systems, dependencies, and review windows.", assignee: "sam", priority: "high", startOffset: 0, dueOffset: 2, tags: ["finance", "close"], blockedBy: [], subtasks: ["Confirm owners", "Publish close dates", "List source systems"] },
        { key: "reconcile", title: "Reconcile accounts", description: "Review bank, revenue, expense, payroll, and balance sheet accounts.", assignee: "eli", priority: "urgent", startOffset: 2, dueOffset: 8, tags: ["finance", "reconciliation"], blockedBy: ["close-calendar"], subtasks: ["Bank reconciliation", "Revenue check", "Expense check", "Balance sheet check"] },
        { key: "variance", title: "Prepare variance analysis", description: "Compare actuals to forecast, identify drivers, and write concise explanations.", assignee: "mara", priority: "high", startOffset: 8, dueOffset: 12, tags: ["forecast", "analysis"], blockedBy: ["reconcile"], subtasks: ["Revenue variance", "Expense variance", "Cash movement"] },
        { key: "reporting", title: "Package finance report", description: "Prepare summary, dashboard screenshots, risks, and recommended follow-ups.", assignee: "nina", priority: "normal", startOffset: 12, dueOffset: 16, tags: ["reporting"], blockedBy: ["variance"], subtasks: ["Draft summary", "Attach exports", "Check formatting"] },
        { key: "signoff", title: "Collect leadership signoff", description: "Resolve open questions and capture approval for the finalized finance package.", assignee: "sam", priority: "high", startOffset: 16, dueOffset: 18, tags: ["approval"], blockedBy: ["reporting"], subtasks: ["Review open questions", "Send final package", "Archive close notes"] }
      ],
      milestones: [
        { title: "Accounts reconciled", description: "Core accounts are checked and ready for analysis.", owner: "eli", dueOffset: 9, status: "planned", taskKeys: ["reconcile"] },
        { title: "Finance package approved", description: "The month-end report is reviewed and signed off.", owner: "sam", dueOffset: 18, status: "planned", taskKeys: ["variance", "reporting", "signoff"] }
      ],
      docs: [
        { title: "Close Checklist", type: "Template", body: "Owners, due dates, source systems, reconciliation checklist, and signoff log." },
        { title: "Finance Report Outline", type: "Brief", body: "Executive summary, variance notes, cash movement, risks, and follow-up actions." }
      ],
      intakeForm: {
        title: "Finance Close Request",
        assignee: "sam",
        description: "Capture finance questions, report requests, and close blockers."
      }
    },
    {
      id: "template-art-exhibition",
      name: "Art Exhibition",
      category: "Creative",
      description: "A gallery or art show workflow for curating work, production, installation, promotion, opening night, and teardown.",
      owner: "nina",
      durationDays: 45,
      tasks: [
        { key: "theme", title: "Define exhibition concept", description: "Clarify theme, audience, curatorial point of view, and experience goals.", assignee: "nina", priority: "high", startOffset: 0, dueOffset: 5, tags: ["creative", "concept"], blockedBy: [], subtasks: ["Draft concept", "Confirm audience", "List constraints"] },
        { key: "artists", title: "Confirm artists and works", description: "Finalize participating artists, artwork list, dimensions, and lender details.", assignee: "mara", priority: "high", startOffset: 5, dueOffset: 14, tags: ["artists", "curation"], blockedBy: ["theme"], subtasks: ["Send invites", "Collect artwork details", "Confirm rights"] },
        { key: "production", title: "Plan production and installation", description: "Map layout, lighting, labels, framing, insurance, shipping, and install crew.", assignee: "sam", priority: "urgent", startOffset: 12, dueOffset: 28, tags: ["production", "install"], blockedBy: ["artists"], subtasks: ["Floor plan", "Shipping plan", "Label copy", "Install schedule"] },
        { key: "promotion", title: "Launch exhibition promotion", description: "Prepare imagery, press notes, mailing list, social posts, and opening invitations.", assignee: "nina", priority: "normal", startOffset: 18, dueOffset: 34, tags: ["marketing", "press"], blockedBy: ["theme"], subtasks: ["Press blurb", "Invite list", "Social assets"] },
        { key: "opening", title: "Run opening night", description: "Coordinate staff, run of show, guest list, artist remarks, and issue response.", assignee: "sam", priority: "high", startOffset: 35, dueOffset: 42, tags: ["event"], blockedBy: ["production", "promotion"], subtasks: ["Guest list", "Run of show", "Staff roles"] },
        { key: "teardown", title: "Close and return works", description: "Pack work, confirm condition reports, return loans, and archive show materials.", assignee: "eli", priority: "normal", startOffset: 42, dueOffset: 45, tags: ["archive"], blockedBy: ["opening"], subtasks: ["Condition reports", "Return schedule", "Archive assets"] }
      ],
      milestones: [
        { title: "Curation locked", description: "Concept, artists, and core works are confirmed.", owner: "nina", dueOffset: 15, status: "planned", taskKeys: ["theme", "artists"] },
        { title: "Installation ready", description: "Production plan, promotion, and opening run of show are ready.", owner: "sam", dueOffset: 35, status: "planned", taskKeys: ["production", "promotion"] },
        { title: "Show closed", description: "Works are returned and exhibition archive is complete.", owner: "eli", dueOffset: 45, status: "planned", taskKeys: ["teardown"] }
      ],
      docs: [
        { title: "Curatorial Brief", type: "Brief", body: "Concept, artists, works, audience, layout notes, and interpretive text." },
        { title: "Opening Night Run of Show", type: "Template", body: "Timeline, staff roles, guest list, remarks, vendor contacts, and contingency notes." }
      ],
      intakeForm: {
        title: "Artwork Submission",
        assignee: "nina",
        description: "Collect artist submissions, artwork details, and installation notes."
      }
    },
    {
      id: "template-marketing-campaign",
      name: "Marketing Campaign",
      category: "Marketing",
      description: "A campaign workspace for positioning, creative production, channel planning, launch, and performance review.",
      owner: "mara",
      durationDays: 35,
      tasks: [
        { key: "brief", title: "Write campaign brief", description: "Define audience, offer, message, channels, timeline, and success metrics.", assignee: "mara", priority: "urgent", startOffset: 0, dueOffset: 5, tags: ["brief", "strategy"], blockedBy: [], subtasks: ["Audience", "Offer", "Metrics"] },
        { key: "creative", title: "Produce creative assets", description: "Create copy, visuals, landing page content, and ad variants.", assignee: "nina", priority: "high", startOffset: 5, dueOffset: 18, tags: ["creative"], blockedBy: ["brief"], subtasks: ["Copy", "Visuals", "Landing page", "Ad variants"] },
        { key: "channels", title: "Build channel plan", description: "Map email, social, paid, partner, and organic launch sequence.", assignee: "sam", priority: "normal", startOffset: 8, dueOffset: 20, tags: ["channels"], blockedBy: ["brief"], subtasks: ["Email", "Social", "Paid", "Partner"] },
        { key: "launch", title: "Launch campaign", description: "Schedule assets, QA tracking, publish channels, and monitor first-day performance.", assignee: "eli", priority: "high", startOffset: 20, dueOffset: 28, tags: ["launch"], blockedBy: ["creative", "channels"], subtasks: ["QA links", "Schedule posts", "Monitor launch"] },
        { key: "retro", title: "Review campaign performance", description: "Analyze results, learnings, channel performance, and follow-up experiments.", assignee: "mara", priority: "normal", startOffset: 28, dueOffset: 35, tags: ["reporting"], blockedBy: ["launch"], subtasks: ["Pull metrics", "Write learnings", "Suggest next tests"] }
      ],
      milestones: [
        { title: "Campaign brief approved", description: "Campaign direction and metrics are approved.", owner: "mara", dueOffset: 6, status: "planned", taskKeys: ["brief"] },
        { title: "Campaign live", description: "Creative and channels are published.", owner: "eli", dueOffset: 28, status: "planned", taskKeys: ["creative", "channels", "launch"] }
      ],
      docs: [
        { title: "Campaign Brief", type: "Brief", body: "Audience, promise, offer, message, channel plan, launch dates, and metrics." },
        { title: "Performance Recap", type: "Template", body: "Results, channel breakdown, learnings, assets, and recommended experiments." }
      ],
      intakeForm: {
        title: "Campaign Request",
        assignee: "mara",
        description: "Capture campaign ideas, audience notes, deadlines, and creative needs."
      }
    },
    {
      id: "template-research-sprint",
      name: "Research Sprint",
      category: "Research",
      description: "A compact research project for questions, recruiting, interviews, synthesis, and decision-ready recommendations.",
      owner: "mara",
      durationDays: 21,
      tasks: [
        { key: "questions", title: "Frame research questions", description: "Clarify decisions, assumptions, research questions, and success criteria.", assignee: "mara", priority: "high", startOffset: 0, dueOffset: 3, tags: ["research", "planning"], blockedBy: [], subtasks: ["Decision list", "Assumptions", "Research questions"] },
        { key: "recruit", title: "Recruit participants", description: "Define screener, invite participants, and confirm interview schedule.", assignee: "sam", priority: "high", startOffset: 3, dueOffset: 8, tags: ["recruiting"], blockedBy: ["questions"], subtasks: ["Screener", "Invite list", "Schedule"] },
        { key: "interviews", title: "Run interviews", description: "Conduct sessions, capture notes, and tag recurring signals.", assignee: "nina", priority: "urgent", startOffset: 8, dueOffset: 14, tags: ["interviews"], blockedBy: ["recruit"], subtasks: ["Interview guide", "Session notes", "Signal tags"] },
        { key: "synthesis", title: "Synthesize insights", description: "Cluster themes, map confidence, and identify product or workflow implications.", assignee: "mara", priority: "high", startOffset: 14, dueOffset: 18, tags: ["synthesis"], blockedBy: ["interviews"], subtasks: ["Theme clusters", "Evidence table", "Confidence notes"] },
        { key: "readout", title: "Share research readout", description: "Present insights, recommendations, open questions, and next experiments.", assignee: "eli", priority: "normal", startOffset: 18, dueOffset: 21, tags: ["readout"], blockedBy: ["synthesis"], subtasks: ["Slides", "Recommendations", "Next steps"] }
      ],
      milestones: [
        { title: "Participants confirmed", description: "Research recruiting is complete.", owner: "sam", dueOffset: 8, status: "planned", taskKeys: ["recruit"] },
        { title: "Insights delivered", description: "The team has a decision-ready research readout.", owner: "mara", dueOffset: 21, status: "planned", taskKeys: ["synthesis", "readout"] }
      ],
      docs: [
        { title: "Research Plan", type: "Brief", body: "Questions, audience, method, schedule, risks, and decision criteria." },
        { title: "Interview Guide", type: "Template", body: "Intro script, consent, warmup, topic questions, probes, and closeout." }
      ],
      intakeForm: {
        title: "Research Request",
        assignee: "mara",
        description: "Collect product, customer, or workflow questions for future research."
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
      triggerKind: "intake_high",
      conditionKind: "any",
      conditionValue: "",
      actionKind: "create_task",
      actionTarget: "intake triage",
      enabled: true,
      lastRun: "",
      runCount: 0
    },
    {
      id: "automation-blocked-alert",
      name: "Flag blocked work",
      trigger: "Task has open dependencies",
      action: "Record an activity alert for the task owner",
      triggerKind: "task_blocked",
      conditionKind: "any",
      conditionValue: "",
      actionKind: "add_activity",
      actionTarget: "task owner",
      enabled: true,
      lastRun: "",
      runCount: 0
    },
    {
      id: "automation-due-risk",
      name: "Escalate due-soon risk",
      trigger: "Open task is due within 7 days",
      action: "Set Risk custom field to High",
      triggerKind: "task_due_soon",
      conditionKind: "priority",
      conditionValue: "high",
      actionKind: "set_risk",
      actionTarget: "High",
      enabled: true,
      lastRun: "",
      runCount: 0
    },
    {
      id: "automation-milestone-watch",
      name: "Watch upcoming milestones",
      trigger: "Milestone is due within 14 days",
      action: "Record a milestone watch activity",
      triggerKind: "milestone_due",
      conditionKind: "any",
      conditionValue: "",
      actionKind: "add_activity",
      actionTarget: "project activity",
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

let workspaceRegistry = loadWorkspaceRegistry();
let activeWorkspaceId = loadActiveWorkspaceId(workspaceRegistry);
let state = loadState();
let apiSession = apiSessionStore.load();
let apiSyncQueue = apiSyncQueueStore.load();
let networkOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
let backendHealth = apiSession?.backendHealth || null;
let auditEvents = [];
let auditLoading = false;
let marketplaceApiCatalog = null;
let marketplaceApiLoading = false;
let realtimePollTimer = null;
let realtimeEventSource = null;
let realtimeEventRefreshTimer = null;
let realtimeEventReconnectTimer = null;
let realtimeTransportStatus = "polling";
let realtimeLastRefreshAt = "";
let realtimeLastChangedAt = "";
let realtimeLastError = "";
let realtimeChangeCount = 0;
let sidebarState = loadSidebarState();
let invitePreview = null;
let invitePreviewToken = "";
let invitePreviewLoading = false;
let publicFeatureConfig = null;
let publicFeatureConfigLoading = false;
let pwaInstallPrompt = null;
let pwaInstallReady = false;
let notificationPermissionState = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
let lenis = null;
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const darkModeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

const els = {
  appView: document.querySelector("#app-view"),
  mainContent: document.querySelector("#main-content"),
  pageTitle: document.querySelector("#page-title"),
  routeStatus: document.querySelector("#route-status"),
  connectionBanner: document.querySelector("#connection-banner"),
  workspaceSwitcher: document.querySelector("#workspace-switcher"),
  workspaceCreate: document.querySelector("#workspace-create"),
  workspaceDuplicate: document.querySelector("#workspace-duplicate"),
  workspaceArchive: document.querySelector("#workspace-archive"),
  projectList: document.querySelector("#project-list"),
  projectSectionCount: document.querySelector("#project-section-count"),
  navInboxCount: document.querySelector("#nav-inbox-count"),
  notificationCount: document.querySelector("#notification-count"),
  toastRegion: document.querySelector("#toast-region"),
  tutorialOverlay: document.querySelector("#tutorial-overlay"),
  searchInput: document.querySelector("#search-input"),
  searchResults: document.querySelector("#search-results"),
  companyFilter: document.querySelector("#company-filter"),
  projectFilter: document.querySelector("#project-filter"),
  assigneeFilter: document.querySelector("#assignee-filter"),
  statusFilter: document.querySelector("#status-filter"),
  priorityFilter: document.querySelector("#priority-filter"),
  savedViewFilter: document.querySelector("#saved-view-filter"),
  savedViewName: document.querySelector("#saved-view-name"),
  saveViewButton: document.querySelector("#save-view-button"),
  updateViewButton: document.querySelector("#update-view-button"),
  renameViewButton: document.querySelector("#rename-view-button"),
  pinViewButton: document.querySelector("#pin-view-button"),
  deleteViewButton: document.querySelector("#delete-view-button"),
  taskDialog: document.querySelector("#task-dialog"),
  taskForm: document.querySelector("#task-form"),
  taskFormTitle: document.querySelector("#task-form-title"),
  featureRequestDialog: document.querySelector("#feature-request-dialog"),
  featureRequestForm: document.querySelector("#feature-request-form"),
  projectDialog: document.querySelector("#project-dialog"),
  projectForm: document.querySelector("#project-form"),
  companyDialog: document.querySelector("#company-dialog"),
  companyForm: document.querySelector("#company-form"),
  companyFormTitle: document.querySelector("#company-form-title"),
  workspaceDialog: document.querySelector("#workspace-dialog"),
  workspaceForm: document.querySelector("#workspace-form"),
  workspaceFormTitle: document.querySelector("#workspace-form-title"),
  commandDialog: document.querySelector("#command-dialog"),
  commandInput: document.querySelector("#command-input"),
  commandResults: document.querySelector("#command-results"),
  shortcutsDialog: document.querySelector("#shortcuts-dialog")
};

let draftSubtasks = [];
let commandPaletteSelection = 0;
let shortcutLeaderActive = false;
let shortcutLeaderTimer = null;
let toastTimers = new Map();
let lastFocusedBeforeDialog = null;
let lastPresenceSignature = "";
let lastPresenceSyncedAt = 0;
let lastPointer = null;
let lastPointerSyncedAt = 0;
let liveRefreshInFlight = false;
let taskEditSnapshots = new Map();
let staleTaskOverrideId = "";

function initSmoothScroll() {
  if (!window.Lenis || reducedMotionQuery?.matches) return;

  lenis = new window.Lenis({
    autoRaf: true,
    anchors: true,
    lerp: 0.12,
    wheelMultiplier: 0.9,
    touchMultiplier: 1,
    prevent: (node) => Boolean(node?.closest?.("[data-lenis-prevent]"))
  });
  document.documentElement.classList.add("has-lenis");
}

function destroySmoothScroll() {
  lenis?.destroy();
  lenis = null;
  document.documentElement.classList.remove("has-lenis");
}

function handleReducedMotionChange() {
  destroySmoothScroll();
  if (!reducedMotionQuery?.matches) initSmoothScroll();
}

function refreshSmoothScroll() {
  window.requestAnimationFrame(() => lenis?.resize?.());
}

function loadState() {
  const stored = workspaceStore.load();
  if (!stored) return normalizeState(workspaceSnapshotForRegistry(registryWorkspace(activeWorkspaceId)));

  try {
    const parsed = JSON.parse(stored);
    const base = structuredClone(seedData);
    return normalizeState({
      ...base,
      ...parsed,
      filters: { ...base.filters, ...parsed.filters }
    });
  } catch {
    return normalizeState(structuredClone(seedData));
  }
}

function slugFromName(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "workspace";
}

function uniqueWorkspaceId(name) {
  const base = `workspace-${slugFromName(name)}`;
  const existing = new Set(workspaceRegistry.map((workspace) => workspace.id));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function workspaceSnapshotForRegistry(workspaceMeta) {
  const base = structuredClone(seedData);
  const meta = workspaceMeta || registryWorkspace(activeWorkspaceId) || fallbackWorkspaceRegistry()[0];
  return {
    ...base,
    selectedRoute: "dashboard",
    workspace: {
      ...base.workspace,
      id: meta.id,
      name: meta.name,
      slug: meta.slug || slugFromName(meta.name)
    }
  };
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

function updateActiveWorkspaceRegistryFromState() {
  const now = new Date().toISOString();
  const existing = registryWorkspace(activeWorkspaceId);
  const nextEntry = {
    id: activeWorkspaceId,
    name: state.workspace.name || existing?.name || "Untitled workspace",
    slug: state.workspace.slug || existing?.slug || activeWorkspaceId,
    status: existing?.status || "active",
    template: existing?.template || state.onboarding?.sampleMode || "custom",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  workspaceRegistry = normalizeWorkspaceRegistry([
    nextEntry,
    ...workspaceRegistry.filter((workspace) => workspace.id !== activeWorkspaceId)
  ]);
  saveWorkspaceRegistry();
  saveActiveWorkspaceId(activeWorkspaceId);
}

function normalizeState(nextState) {
  const companies = Array.isArray(nextState.companies) ? nextState.companies : seedData.companies;
  const projects = Array.isArray(nextState.projects) ? nextState.projects : seedData.projects;
  const tasks = Array.isArray(nextState.tasks) ? nextState.tasks : seedData.tasks;
  return {
    ...nextState,
    selectedInviteToken: nextState.selectedInviteToken || "",
    selectedSettingsTab: nextState.selectedSettingsTab || seedData.selectedSettingsTab,
    selectedCalendarMonth: nextState.selectedCalendarMonth || seedData.selectedCalendarMonth,
    selectedDailyDate: nextState.selectedDailyDate || todayKey(),
    templateLibrary: {
      category: "all",
      query: "",
      selectedProjectTemplateId: "",
      ...(nextState.templateLibrary || {})
    },
    onboarding: {
      ...seedData.onboarding,
      ...(nextState.onboarding || {}),
      wizardStep: clamp(Number((nextState.onboarding || {}).wizardStep || 0), 0, 6)
    },
    tutorial: {
      ...seedData.tutorial,
      ...(nextState.tutorial || {}),
      step: clamp(Number((nextState.tutorial || {}).step || 0), 0, tutorialSteps.length - 1)
    },
    workspace: {
      ...seedData.workspace,
      ...(nextState.workspace || {}),
      theme: normalizeWorkspaceTheme((nextState.workspace || {}).theme),
      ai: {
        ...seedData.workspace.ai,
        ...((nextState.workspace || {}).ai || {}),
        permissions: normalizeAiPermissions((nextState.workspace || {}).ai?.permissions)
      },
      integrations: normalizeWorkspaceIntegrations((nextState.workspace || {}).integrations),
      capacity: normalizeWorkspaceCapacity((nextState.workspace || {}).capacity),
      payments: normalizeWorkspacePayments((nextState.workspace || {}).payments)
    },
    memberships: Array.isArray(nextState.memberships) ? nextState.memberships : seedData.memberships,
    users: Array.isArray(nextState.users) ? nextState.users : [],
    invitations: Array.isArray(nextState.invitations) ? nextState.invitations : [],
    auditEvents: Array.isArray(nextState.auditEvents) ? nextState.auditEvents : seedData.auditEvents,
    savedViews: normalizeSavedViews(nextState.savedViews),
    dailyNotes: Object.prototype.hasOwnProperty.call(nextState, "dailyNotes") ? nextState.dailyNotes || {} : seedData.dailyNotes,
    dailyPlans: Object.prototype.hasOwnProperty.call(nextState, "dailyPlans") ? nextState.dailyPlans || {} : seedData.dailyPlans,
    dashboardWidgets: normalizeDashboardWidgets(nextState.dashboardWidgets),
    dashboardLayouts: normalizeDashboardLayouts(nextState.dashboardLayouts),
    selectedDashboardLayoutId: normalizeSelectedDashboardLayoutId(nextState.selectedDashboardLayoutId, nextState.dashboardLayouts),
    switcherImportPreview: normalizeSwitcherImportPreview(nextState.switcherImportPreview),
    switcherImportRollback: normalizeSwitcherImportRollback(nextState.switcherImportRollback),
    portableImportPreview: nextState.portableImportPreview && typeof nextState.portableImportPreview === "object" ? nextState.portableImportPreview : null,
    templateImportPreview: nextState.templateImportPreview && typeof nextState.templateImportPreview === "object" ? nextState.templateImportPreview : null,
    automationPackImportPreview: nextState.automationPackImportPreview && typeof nextState.automationPackImportPreview === "object" ? nextState.automationPackImportPreview : null,
    inboxRead: Array.isArray(nextState.inboxRead) ? nextState.inboxRead : [],
    inboxArchived: Array.isArray(nextState.inboxArchived) ? nextState.inboxArchived : [],
    inboxSnoozed: normalizeInboxSnoozed(nextState.inboxSnoozed),
    notificationSettings: normalizeNotificationSettings(nextState.notificationSettings),
    notificationHistory: normalizeNotificationHistory(nextState.notificationHistory),
    notificationReminders: normalizeNotificationReminders(nextState.notificationReminders),
    deletedProjectTemplateIds: Array.isArray(nextState.deletedProjectTemplateIds) ? nextState.deletedProjectTemplateIds : [],
    taskWatchers: normalizeTaskWatchers(nextState.taskWatchers),
    presence: Array.isArray(nextState.presence) ? nextState.presence : [],
    chatMessages: normalizeChatMessages(nextState.chatMessages),
    whiteboards: normalizeWhiteboards(nextState.whiteboards),
    approvals: Array.isArray(nextState.approvals) ? nextState.approvals : seedData.approvals,
    comments: normalizeComments(nextState.comments),
    raidItems: normalizeRaidItems(nextState.raidItems),
    customFields: Array.isArray(nextState.customFields) ? nextState.customFields : seedData.customFields,
    documents: Array.isArray(nextState.documents) ? nextState.documents : seedData.documents,
    files: Array.isArray(nextState.files) ? nextState.files : seedData.files,
    intakeForms: Array.isArray(nextState.intakeForms) ? nextState.intakeForms : seedData.intakeForms,
    intakeSubmissions: Array.isArray(nextState.intakeSubmissions) ? nextState.intakeSubmissions : seedData.intakeSubmissions,
    projectTemplates: normalizeProjectTemplates(nextState.projectTemplates, nextState.deletedProjectTemplateIds),
    taskTemplates: Array.isArray(nextState.taskTemplates) ? nextState.taskTemplates : seedData.taskTemplates,
    automations: normalizeAutomations(nextState.automations),
    automationHistory: Array.isArray(nextState.automationHistory) ? nextState.automationHistory : [],
    operatorActions: Array.isArray(nextState.operatorActions) ? nextState.operatorActions : [],
    companies: companies.map(normalizeCompanyRecord),
    projects: projects.map(normalizeProjectRecord),
    goals: normalizeGoals(nextState.goals, projects, companies),
    tasks: tasks.map(normalizeTaskRecord)
  };
}

function saveState() {
  applyWorkspaceTheme();
  updateActiveWorkspaceRegistryFromState();
  workspaceStore.save(state);
}

function normalizeWorkspaceTheme(theme = {}) {
  const preset = themePresets.some((item) => item.id === theme.preset) ? theme.preset : seedData.workspace.theme.preset;
  const density = densityOptions.some((item) => item.id === theme.density) ? theme.density : seedData.workspace.theme.density;
  return { preset, density };
}

function resolvedWorkspaceThemePreset(theme = state?.workspace?.theme) {
  const normalized = normalizeWorkspaceTheme(theme);
  if (normalized.preset === "auto") return darkModeQuery?.matches ? "night" : "agora";
  return normalized.preset;
}

function normalizeDashboardWidgets(widgets = []) {
  const source = Array.isArray(widgets) ? widgets : seedData.dashboardWidgets;
  const byId = new Map(source.map((widget) => [widget?.id, widget]));
  return dashboardWidgetCatalog.map((widget) => ({
    id: widget.id,
    visible: byId.has(widget.id) ? byId.get(widget.id)?.visible !== false : true
  }));
}

function normalizeDashboardLayouts(layouts = []) {
  const source = Array.isArray(layouts) && layouts.length ? layouts : seedData.dashboardLayouts;
  return source
    .filter((layout) => layout && typeof layout === "object")
    .map((layout) => ({
      id: layout.id || uid("dashboard-layout"),
      name: String(layout.name || "Untitled dashboard").trim().slice(0, 64),
      widgets: normalizeDashboardWidgets(layout.widgets),
      createdAt: layout.createdAt || new Date().toISOString(),
      updatedAt: layout.updatedAt || layout.createdAt || new Date().toISOString()
    }))
    .filter((layout) => layout.name)
    .slice(0, 12);
}

function normalizeSelectedDashboardLayoutId(selectedId, layouts = []) {
  const normalizedLayouts = normalizeDashboardLayouts(layouts);
  if (normalizedLayouts.some((layout) => layout.id === selectedId)) return selectedId;
  return normalizedLayouts[0]?.id || "";
}

function normalizeSwitcherImportPreview(preview = null) {
  if (!preview || typeof preview !== "object") return null;
  const projects = Array.isArray(preview.projects) ? preview.projects.map(normalizeProjectRecord).filter((project) => project.id && project.name) : [];
  const tasks = Array.isArray(preview.tasks) ? preview.tasks.map(normalizeTaskRecord).filter((task) => task.id && task.title) : [];
  const mappedFields = Array.isArray(preview.mappedFields) ? preview.mappedFields.map((field) => String(field || "").trim()).filter(Boolean).slice(0, 12) : [];
  const warnings = Array.isArray(preview.warnings) ? preview.warnings.map((warning) => String(warning || "").trim()).filter(Boolean).slice(0, 8) : [];
  if (!tasks.length) return null;
  return {
    id: preview.id || uid("switcher-preview"),
    source: String(preview.source || "Generic CSV").slice(0, 48),
    sourceSystem: String(preview.sourceSystem || switcherSourceId(preview.source || "Generic CSV")).slice(0, 48),
    importBatchId: String(preview.importBatchId || "").slice(0, 120),
    mode: ["merge", "new-workspace"].includes(preview.mode) ? preview.mode : "merge",
    createdAt: preview.createdAt || new Date().toISOString(),
    stats: {
      rows: Number(preview.stats?.rows || tasks.length),
      projects: projects.length,
      tasks: tasks.length,
      skipped: Number(preview.stats?.skipped || 0),
      mappedFields: Number(preview.stats?.mappedFields || mappedFields.length),
      confidence: Math.max(0, Math.min(100, Number(preview.stats?.confidence || 0)))
    },
    mappedFields,
    warnings,
    projects,
    tasks,
    samples: Array.isArray(preview.samples) ? preview.samples.slice(0, 6) : tasks.slice(0, 6).map((task) => ({
      title: task.title,
      projectName: projects.find((project) => project.id === task.projectId)?.name || task.projectId || "Imported project",
      assignee: memberName(task.assignee),
      status: task.status,
      priority: task.priority,
      sourceId: task.customFields?.sourceId || ""
    }))
  };
}

function normalizeSwitcherImportRollback(rollback = null) {
  if (!rollback || typeof rollback !== "object" || !rollback.id || !rollback.snapshot) return null;
  return {
    id: rollback.id,
    source: String(rollback.source || "Import").slice(0, 48),
    createdAt: rollback.createdAt || new Date().toISOString(),
    summary: rollback.summary || "Last import can be rolled back.",
    backupId: rollback.backupId || "",
    stats: {
      projects: Number(rollback.stats?.projects || 0),
      tasks: Number(rollback.stats?.tasks || 0)
    },
    snapshot: rollback.snapshot
  };
}

function defaultNotificationSettings() {
  return structuredClone(seedData.notificationSettings || {
    events: {},
    digests: {},
    channels: {},
    cadence: "daily"
  });
}

function normalizeNotificationSettings(settings = null) {
  const defaults = defaultNotificationSettings();
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    events: {
      ...defaults.events,
      ...(source.events || {})
    },
    digests: {
      ...defaults.digests,
      ...(source.digests || {})
    },
    channels: {
      ...defaults.channels,
      ...(source.channels || {})
    },
    delivery: {
      ...defaults.delivery,
      ...(source.delivery || {}),
      webhookUrl: String(source.delivery?.webhookUrl || defaults.delivery?.webhookUrl || "").trim().slice(0, 300),
      emailAddress: String(source.delivery?.emailAddress || defaults.delivery?.emailAddress || "").trim().slice(0, 180),
      sendResolved: Boolean(source.delivery?.sendResolved ?? defaults.delivery?.sendResolved)
    },
    cadence: ["daily", "weekly", "manual"].includes(source.cadence) ? source.cadence : defaults.cadence
  };
}

function normalizeInboxSnoozed(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([id, until]) => [String(id), String(until || "")])
    .filter(([id, until]) => id && until));
}

function normalizeNotificationHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((event) => ({
      id: event.id || uid("notification-history"),
      kind: event.kind || "digest",
      title: event.title || "Notification event",
      message: event.message || "",
      reason: event.reason || "",
      count: Number(event.count || 0),
      channel: event.channel || "in-app",
      createdAt: event.createdAt || new Date().toISOString()
    }))
    .slice(0, 50);
}

function normalizeNotificationReminders(reminders = []) {
  return (Array.isArray(reminders) ? reminders : [])
    .filter((reminder) => reminder && typeof reminder === "object")
    .map((reminder) => ({
      id: reminder.id || uid("reminder"),
      sourceId: String(reminder.sourceId || ""),
      taskId: String(reminder.taskId || ""),
      approvalId: String(reminder.approvalId || ""),
      projectId: String(reminder.projectId || ""),
      title: String(reminder.title || "Reminder").trim().slice(0, 140),
      message: String(reminder.message || "").trim().slice(0, 260),
      remindAt: String(reminder.remindAt || ""),
      repeat: ["none", "daily", "weekly"].includes(reminder.repeat) ? reminder.repeat : "none",
      status: ["scheduled", "sent", "dismissed"].includes(reminder.status) ? reminder.status : "scheduled",
      createdAt: reminder.createdAt || new Date().toISOString(),
      sentAt: reminder.sentAt || ""
    }))
    .filter((reminder) => reminder.sourceId && reminder.remindAt)
    .slice(0, 100);
}

function normalizeCommentKind(kind = "comment") {
  return ["comment", "question", "decision"].includes(kind) ? kind : "comment";
}

function normalizeCommentStatus(status = "open") {
  return ["open", "resolved"].includes(status) ? status : "open";
}

function normalizeComments(comments = []) {
  const source = Array.isArray(comments) ? comments : seedData.comments;
  return source
    .filter((comment) => comment && typeof comment === "object")
    .map((comment) => {
      const mentionIds = Array.isArray(comment.mentionIds) ? comment.mentionIds.map(String).filter(Boolean) : [];
      return {
        id: comment.id || uid("comment"),
        taskId: String(comment.taskId || ""),
        parentId: String(comment.parentId || "") === String(comment.id || "") ? "" : String(comment.parentId || ""),
        author: String(comment.author || currentMemberId),
        body: String(comment.body || "").trim().slice(0, 1200),
        kind: normalizeCommentKind(comment.kind),
        status: normalizeCommentStatus(comment.status),
        mentionIds: Array.from(new Set(mentionIds)),
        resolvedAt: comment.resolvedAt ? String(comment.resolvedAt) : "",
        resolvedBy: comment.resolvedBy ? String(comment.resolvedBy) : "",
        createdAt: comment.createdAt || new Date().toISOString(),
        updatedAt: comment.updatedAt || comment.createdAt || new Date().toISOString()
      };
    })
    .filter((comment) => comment.taskId && comment.body)
    .slice(0, 500);
}

function normalizeChatMessages(messages = []) {
  const source = Array.isArray(messages) ? messages : seedData.chatMessages;
  return source
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      id: message.id || uid("chat"),
      channel: ["general", "delivery", "product", "client"].includes(message.channel) ? message.channel : "general",
      author: members.some((member) => member.id === message.author) ? message.author : currentMemberId,
      body: String(message.body || "").trim().slice(0, 600),
      projectId: String(message.projectId || ""),
      linkType: ["task", "document", "approval"].includes(message.linkType) ? message.linkType : "",
      linkId: String(message.linkId || ""),
      createdAt: message.createdAt || new Date().toISOString()
    }))
    .filter((message) => message.body)
    .slice(0, 200);
}

function normalizeWhiteboards(whiteboards = []) {
  const source = Array.isArray(whiteboards) ? whiteboards : seedData.whiteboards;
  return source
    .filter((board) => board && typeof board === "object")
    .map((board) => ({
      id: board.id || uid("whiteboard"),
      title: String(board.title || "Untitled board").trim().slice(0, 96),
      projectId: String(board.projectId || ""),
      items: Array.isArray(board.items) ? board.items.map((item) => ({
        id: item.id || uid("wb-note"),
        type: ["note", "risk", "decision"].includes(item.type) ? item.type : "note",
        text: String(item.text || "").trim().slice(0, 180),
        x: clamp(Math.round(Number(item.x) || 8), 0, 86),
        y: clamp(Math.round(Number(item.y) || 10), 0, 78),
        color: ["green", "amber", "blue", "neutral"].includes(item.color) ? item.color : "neutral"
      })).filter((item) => item.text).slice(0, 40) : []
    }))
    .filter((board) => board.title)
    .slice(0, 20);
}

function normalizeRaidItems(items = []) {
  const source = Array.isArray(items) ? items : seedData.raidItems || [];
  return source
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const type = ["risk", "assumption", "issue", "decision", "change"].includes(item.type) ? item.type : "risk";
      const severity = ["low", "medium", "high", "critical"].includes(item.severity) ? item.severity : "medium";
      const status = ["open", "watching", "mitigating", "decided", "closed"].includes(item.status) ? item.status : "open";
      return {
        id: item.id || uid("raid"),
        type,
        projectId: String(item.projectId || ""),
        companyId: String(item.companyId || ""),
        title: String(item.title || "Untitled RAID item").trim().slice(0, 140),
        detail: String(item.detail || "").trim().slice(0, 280),
        owner: members.some((member) => member.id === item.owner) ? item.owner : currentMemberId,
        severity,
        status,
        mitigation: String(item.mitigation || "").trim().slice(0, 280),
        dueDate: item.dueDate || "",
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
      };
    })
    .filter((item) => item.title)
    .slice(0, 200);
}

function normalizeIntegrationConnection(connection = {}) {
  const catalogItem = integrationCatalog.find((item) => item.id === connection.id);
  if (!catalogItem) return null;
  const memberIds = new Set(members.map((member) => member.id));
  const events = Array.isArray(connection.events)
    ? connection.events.filter((eventName) => integrationEventOptions.includes(eventName))
    : catalogItem.signals.slice(0, 2).map((signal) => signal.toLowerCase().replace(/[^a-z0-9]+/g, ".")).filter((eventName) => integrationEventOptions.includes(eventName));
  return {
    id: catalogItem.id,
    status: integrationStatuses.some((option) => option.id === connection.status) ? connection.status : "planned",
    syncMode: integrationSyncModes.some((option) => option.id === connection.syncMode) ? connection.syncMode : "none",
    owner: memberIds.has(connection.owner) ? connection.owner : "",
    notes: String(connection.notes || "").trim().slice(0, 180),
    lastSyncedAt: connection.lastSyncedAt || "",
    health: ["healthy", "planned", "needs-config", "error"].includes(connection.health) ? connection.health : connection.status === "connected" ? "healthy" : "planned",
    events: events.length ? events : ["task.updated"],
    secretStatus: ["configured", "missing", "not-required"].includes(connection.secretStatus) ? connection.secretStatus : catalogItem.id === "api" || catalogItem.id === "google-calendar" ? "not-required" : "missing"
  };
}

function normalizeWorkspaceIntegrations(integrations = {}) {
  const fallback = seedData.workspace.integrations || {};
  const storedConnections = Array.isArray(integrations.connections) ? integrations.connections : fallback.connections || [];
  const byId = new Map(storedConnections.map((connection) => [connection?.id, connection]));
  const memberIds = new Set(members.map((member) => member.id));
  return {
    defaultOwner: memberIds.has(integrations.defaultOwner) ? integrations.defaultOwner : fallback.defaultOwner || currentMemberId,
    webhookEndpoint: String(integrations.webhookEndpoint || "").trim().slice(0, 240),
    apiAccess: Object.prototype.hasOwnProperty.call(integrations, "apiAccess") ? Boolean(integrations.apiAccess) : Boolean(fallback.apiAccess),
    eventMirroring: Object.prototype.hasOwnProperty.call(integrations, "eventMirroring") ? Boolean(integrations.eventMirroring) : Boolean(fallback.eventMirroring),
    connections: integrationCatalog.map((catalogItem) => normalizeIntegrationConnection({
      id: catalogItem.id,
      ...(byId.get(catalogItem.id) || {})
    })).filter(Boolean)
  };
}

function normalizeAutomationRule(automation = {}) {
  const triggerKind = automationTriggerOptions.some((option) => option.id === automation.triggerKind) ? automation.triggerKind : triggerKindFromText(automation.trigger);
  const actionKind = automationActionOptions.some((option) => option.id === automation.actionKind) ? automation.actionKind : actionKindFromText(automation.action);
  const conditionKind = automationConditionOptions.some((option) => option.id === automation.conditionKind) ? automation.conditionKind : "any";
  return {
    id: automation.id || uid("automation"),
    name: String(automation.name || "Untitled automation").trim().slice(0, 80),
    trigger: String(automation.trigger || automationTriggerLabel(triggerKind)).trim().slice(0, 160),
    action: String(automation.action || automationActionLabel(actionKind)).trim().slice(0, 180),
    triggerKind,
    conditionKind,
    conditionValue: String(automation.conditionValue || "").trim().slice(0, 80),
    actionKind,
    actionTarget: String(automation.actionTarget || "").trim().slice(0, 96),
    enabled: automation.enabled !== false,
    lastRun: automation.lastRun || "",
    runCount: Number(automation.runCount || 0),
    marketplacePackId: String(automation.marketplacePackId || "").trim().slice(0, 96),
    source: String(automation.source || "").trim().slice(0, 48),
    creatorName: String(automation.creatorName || "").trim().slice(0, 96),
    installedAt: automation.installedAt || "",
    license: String(automation.license || "").trim().slice(0, 96)
  };
}

function normalizeAutomations(automations = []) {
  const source = Array.isArray(automations) ? automations : seedData.automations;
  return source.map(normalizeAutomationRule).filter((automation) => automation.name).slice(0, 50);
}

function normalizeAiPermissions(permissions = {}) {
  return Object.fromEntries(
    aiPermissionOptions.map((option) => [
      option.id,
      Object.prototype.hasOwnProperty.call(permissions, option.id)
        ? Boolean(permissions[option.id])
        : aiPermissionDefaults[option.id]
    ])
  );
}

function triggerKindFromText(value = "") {
  const text = String(value).toLowerCase();
  if (text.includes("intake")) return "intake_high";
  if (text.includes("blocked") || text.includes("dependencies")) return "task_blocked";
  if (text.includes("approval")) return "approval_pending";
  if (text.includes("milestone")) return "milestone_due";
  return "task_due_soon";
}

function actionKindFromText(value = "") {
  const text = String(value).toLowerCase();
  if (text.includes("risk")) return "set_risk";
  if (text.includes("update")) return "draft_update";
  if (text.includes("notify")) return "notify_channel";
  if (text.includes("activity") || text.includes("alert")) return "add_activity";
  return "create_task";
}

function automationTriggerLabel(triggerKind) {
  return automationTriggerOptions.find((option) => option.id === triggerKind)?.label || "Task due soon";
}

function automationActionLabel(actionKind) {
  return automationActionOptions.find((option) => option.id === actionKind)?.label || "Create follow-up task";
}

function normalizeWorkspaceCapacity(capacity = {}) {
  const fallback = seedData.workspace.capacity || {};
  const memberIds = new Set(members.map((member) => member.id));
  const overrides = Array.isArray(capacity.memberOverrides) ? capacity.memberOverrides : fallback.memberOverrides || [];
  return {
    weeklyMinutes: clamp(Math.round(Number(capacity.weeklyMinutes ?? fallback.weeklyMinutes ?? 1800)), 300, 3600),
    focusTargetPercent: clamp(Math.round(Number(capacity.focusTargetPercent ?? fallback.focusTargetPercent ?? 80)), 40, 100),
    warnAtPercent: clamp(Math.round(Number(capacity.warnAtPercent ?? fallback.warnAtPercent ?? 85)), 50, 140),
    overloadAtPercent: clamp(Math.round(Number(capacity.overloadAtPercent ?? fallback.overloadAtPercent ?? 105)), 60, 180),
    memberOverrides: overrides
      .filter((override) => override && memberIds.has(override.memberId))
      .map((override) => ({
        memberId: override.memberId,
        weeklyMinutes: clamp(Math.round(Number(override.weeklyMinutes) || fallback.weeklyMinutes || 1800), 300, 3600)
      }))
      .slice(0, 50)
  };
}

function normalizeGoals(goals = [], projects = [], companies = []) {
  const source = Array.isArray(goals) ? goals : seedData.goals;
  const projectIds = new Set((Array.isArray(projects) ? projects : seedData.projects).map((project) => project.id));
  const companyIds = new Set((Array.isArray(companies) ? companies : seedData.companies).map((company) => company.id));
  return source
    .filter((goal) => goal && typeof goal === "object")
    .map((goal) => ({
      id: goal.id || uid("goal"),
      title: String(goal.title || "Untitled goal").trim().slice(0, 120),
      owner: members.some((member) => member.id === goal.owner) ? goal.owner : currentMemberId,
      companyId: companyIds.has(goal.companyId) ? goal.companyId : "",
      status: ["active", "at-risk", "paused", "complete"].includes(goal.status) ? goal.status : "active",
      period: String(goal.period || "Current").trim().slice(0, 40),
      targetDate: goal.targetDate || "",
      projectIds: Array.isArray(goal.projectIds) ? goal.projectIds.filter((projectId) => projectIds.has(projectId)).slice(0, 12) : [],
      keyResults: Array.isArray(goal.keyResults) ? goal.keyResults.map((result) => ({
        id: result.id || uid("kr"),
        title: String(result.title || "Key result").trim().slice(0, 120),
        progress: clamp(Math.round(Number(result.progress) || 0), 0, 100),
        target: String(result.target || "").trim().slice(0, 80)
      })).slice(0, 8) : []
    }))
    .filter((goal) => goal.title)
    .slice(0, 50);
}

function normalizePaymentEntitlements(entitlements = []) {
  if (!Array.isArray(entitlements)) return [];
  return entitlements
    .filter((entitlement) => entitlement && typeof entitlement === "object")
    .map((entitlement) => ({
      id: entitlement.id || uid("entitlement"),
      itemType: entitlement.itemType === "feature" ? "feature" : "project-template",
      itemId: String(entitlement.itemId || ""),
      source: entitlementSourceOptions.some((option) => option.id === entitlement.source) ? entitlement.source : "manual",
      status: entitlement.status === "revoked" || entitlement.status === "expired" ? entitlement.status : "active",
      amountCents: Math.max(0, Math.round(Number(entitlement.amountCents) || 0)),
      currency: paymentCurrencyOptions.includes(entitlement.currency) ? entitlement.currency : "USD",
      note: String(entitlement.note || ""),
      grantedAt: entitlement.grantedAt || new Date().toISOString(),
      expiresAt: entitlement.expiresAt || "",
      checkoutIntentId: String(entitlement.checkoutIntentId || ""),
      provider: String(entitlement.provider || ""),
      payoutSnapshot: normalizeTemplatePayout({ payout: entitlement.payoutSnapshot || entitlement.payout || {} })
    }))
    .filter((entitlement) => entitlement.itemId)
    .slice(0, 100);
}

function normalizeTemplatePayout(template = {}) {
  const payout = template.payout && typeof template.payout === "object" ? template.payout : {};
  const mode = templatePayoutModes.some((option) => option.id === payout.mode) ? payout.mode : "creator";
  const chain = templatePayoutChains.includes(payout.chain) ? payout.chain : "Not set";
  return {
    mode,
    recipientName: String(payout.recipientName || template.creatorName || "").trim().slice(0, 96),
    walletAddress: String(payout.walletAddress || "").trim().slice(0, 160),
    chain,
    charityName: String(payout.charityName || "").trim().slice(0, 96),
    donationPercent: clamp(Math.round(Number(payout.donationPercent) || 0), 0, 100),
    note: String(payout.note || "").trim().slice(0, 180)
  };
}

function normalizeWorkspacePayments(payments = {}) {
  const fallback = seedData.workspace.payments;
  const provider = paymentProviderOptions.some((item) => item.id === payments.provider) ? payments.provider : fallback.provider;
  const planId = paymentPlanOptions.some((item) => item.id === payments.planId) ? payments.planId : fallback.planId || "free";
  const currency = paymentCurrencyOptions.includes(payments.currency) ? payments.currency : fallback.currency;
  const spendingCapCents = Math.max(0, Math.round(Number(payments.spendingCapCents) || 0));
  const audit = Array.isArray(payments.audit) ? payments.audit : fallback.audit;
  return {
    provider,
    planId,
    currency,
    spendingCapCents,
    marketplacePayments: provider !== "none" && Boolean(payments.marketplacePayments),
    clientPortalPayments: provider !== "none" && Boolean(payments.clientPortalPayments),
    agentPayments: provider !== "none" && Boolean(payments.agentPayments),
    x402Experimental: provider === "x402" && Boolean(payments.x402Experimental),
    entitlements: normalizePaymentEntitlements(payments.entitlements),
    audit: audit
      .filter((event) => event && typeof event === "object")
      .map((event) => ({
        id: event.id || uid("payment-audit"),
        action: event.action || "payment_event",
        provider: paymentProviderOptions.some((item) => item.id === event.provider) ? event.provider : provider,
        currency: paymentCurrencyOptions.includes(event.currency) ? event.currency : currency,
        amountCents: Math.max(0, Math.round(Number(event.amountCents) || 0)),
        status: event.status || "recorded",
        note: event.note || "",
        createdAt: event.createdAt || new Date().toISOString()
      }))
      .slice(0, 50)
  };
}

function applyWorkspaceTheme() {
  const theme = normalizeWorkspaceTheme(state?.workspace?.theme);
  const resolvedPreset = resolvedWorkspaceThemePreset(theme);
  document.body.dataset.theme = resolvedPreset;
  document.body.dataset.themePreference = theme.preset;
  document.body.dataset.density = theme.density;
  const activePreset = themePresets.find((preset) => preset.id === resolvedPreset) || themePresets.find((preset) => preset.id === "agora");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", activePreset.swatches[1]);
}

function isNetworkOnline() {
  return networkOnline;
}

function isLocalApiBaseUrl() {
  try {
    const hostname = new URL(API_BASE_URL, window.location.href).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname);
  } catch {
    return false;
  }
}

function canAttemptApiRequest() {
  return isNetworkOnline() || isLocalApiBaseUrl();
}

async function apiRequest(path, options = {}) {
  if (!canAttemptApiRequest()) {
    throw new Error("Device is offline. Local changes are saved on this device and will retry when the network returns.");
  }

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
  backendHealth = session?.backendHealth || backendHealth;
  apiSessionStore.save(session);
  startRealtimePolling();
}

function clearApiSession() {
  apiSession = null;
  backendHealth = null;
  auditEvents = [];
  apiSessionStore.clear();
  stopRealtimePolling();
}

function saveApiSyncQueue() {
  apiSyncQueueStore.save(apiSyncQueue);
}

function queueApiSyncFailure({ label, path, method = "POST", body = {}, error = "", baseRevision = "", status = "", conflict = null }) {
  const id = `${method}:${path}:${body?.project?.id || body?.task?.id || body?.record?.id || JSON.stringify(body).slice(0, 80)}`;
  const existing = apiSyncQueue.find((entry) => entry.id === id);
  const item = {
    id,
    label,
    path,
    method,
    body,
    error: String(error || "API sync failed"),
    baseRevision: baseRevision || existing?.baseRevision || body?.task?.createdAt || body?.project?.createdAt || "",
    status: status || existing?.status || "pending",
    conflict: conflict || existing?.conflict || null,
    offline: !canAttemptApiRequest(),
    attempts: (existing?.attempts || 0) + 1,
    updatedAt: new Date().toISOString()
  };
  apiSyncQueue = [item, ...apiSyncQueue.filter((entry) => entry.id !== id)].slice(0, 50);
  saveApiSyncQueue();
}

function clearApiSyncQueueItem(id) {
  apiSyncQueue = apiSyncQueue.filter((item) => item.id !== id);
  saveApiSyncQueue();
}

function queuedSyncRecord(item) {
  if (item?.body?.task) return { collection: "tasks", key: "task", record: item.body.task };
  if (item?.body?.project) return { collection: "projects", key: "project", record: item.body.project };
  return null;
}

function recordRevisionValue(record = {}) {
  return record.updatedAt || record.createdAt || record.restoredAt || record.archivedAt || "";
}

function revisionIsAfter(a = "", b = "") {
  const left = Date.parse(a || "");
  const right = Date.parse(b || "");
  return Number.isFinite(left) && Number.isFinite(right) && left > right;
}

async function fetchRemoteQueuedRecord(item) {
  const queued = queuedSyncRecord(item);
  if (!queued?.record?.id) return null;
  const path = queued.collection === "tasks" ? "/api/tasks" : "/api/projects";
  const key = queued.collection;
  const records = await fetchApiCollectionPages(path, key);
  return records.find((record) => record.id === queued.record.id) || null;
}

async function detectQueuedSyncConflict(item) {
  const queued = queuedSyncRecord(item);
  if (!queued || item.status === "conflict") return null;
  if (item.method === "POST" && !item.baseRevision) return null;
  const remote = await fetchRemoteQueuedRecord(item);
  if (!remote) return null;
  const remoteRevision = recordRevisionValue(remote);
  const localRevision = recordRevisionValue(queued.record);
  const baseRevision = item.baseRevision || localRevision;
  if (!remoteRevision || !baseRevision) return null;
  if (!revisionIsAfter(remoteRevision, baseRevision) || remoteRevision === localRevision) return null;
  return {
    collection: queued.collection,
    local: queued.record,
    remote,
    baseRevision,
    localRevision,
    remoteRevision,
    detectedAt: new Date().toISOString()
  };
}

function markApiSyncQueueConflict(item, conflict) {
  apiSyncQueue = apiSyncQueue.map((entry) => entry.id === item.id
    ? {
        ...entry,
        status: "conflict",
        conflict,
        error: "Server record changed while this local update was queued.",
        updatedAt: new Date().toISOString()
      }
    : entry);
  saveApiSyncQueue();
}

async function refreshBackendHealth(options = {}) {
  if (!apiSession) {
    backendHealth = null;
    if (!options.silent) render();
    return null;
  }

  try {
    const health = await apiRequest("/api/backend/health");
    backendHealth = health;
    saveApiSession({
      ...apiSession,
      backendHealth: health,
      apiHealth: {
        ok: health.ok,
        service: health.service,
        storage: health.storage,
        auth: health.auth,
        workspace: health.workspace
      },
      storageDriver: health.storage,
      lastBackendCheckedAt: health.generatedAt
    });
    if (!options.silent) {
      render();
      showToast("Backend health refreshed", "success");
    }
    return health;
  } catch (error) {
    backendHealth = {
      ok: false,
      storage: apiSession.storageDriver || "unknown",
      auth: apiSession.apiHealth?.auth || "unknown",
      readiness: [{
        id: "backend-health",
        label: "Backend health",
        done: false,
        detail: error.message
      }],
      records: [],
      generatedAt: new Date().toISOString()
    };
    if (!options.silent) {
      render();
      showToast(`Backend health failed: ${error.message}`, "info");
    }
    return null;
  }
}

async function runBackendJobAction(jobId, action) {
  if (!apiSession) {
    showToast("Connect to the API before managing background jobs", "info");
    return;
  }
  if (!canWrite("scheduler:run")) {
    showToast("Your role cannot manage background jobs", "info");
    return;
  }
  try {
    const result = await apiRequest(`/api/backend/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(action)}`, {
      method: "POST"
    });
    backendHealth = {
      ...(backendHealth || {}),
      jobs: result.jobs || backendHealth?.jobs || {},
      generatedAt: new Date().toISOString()
    };
    saveApiSession({
      ...apiSession,
      backendHealth
    });
    render();
    showToast(`Background job ${action} complete`, "success");
  } catch (error) {
    showToast(`Background job ${action} failed: ${error.message}`, "info");
  }
}

async function loadAuditLogFromApi(options = {}) {
  if (!apiSession) {
    if (!options.silent) showToast("Connect to the API from Settings first", "info");
    return;
  }

  auditLoading = true;
  if (!options.silent) render();
  try {
    const result = await apiRequest("/api/audit-log");
    auditEvents = Array.isArray(result.events) ? result.events : [];
    if (!options.silent) showToast("Audit log refreshed", "success");
  } catch (error) {
    if (!options.silent) showToast(`Audit log failed: ${error.message}`, "info");
  } finally {
    auditLoading = false;
    if (!options.silent || state.selectedRoute === "audit") render();
  }
}

async function retryApiSyncQueue() {
  if (!apiSession) {
    showToast("Connect to the API before retrying sync", "info");
    return;
  }
  if (!apiSyncQueue.length) {
    showToast("No failed API syncs to retry", "info");
    return;
  }
  if (!canAttemptApiRequest()) {
    render();
    showToast("Agora is offline. Keep working locally; sync will retry when the network returns.", "info");
    return;
  }

  const queue = [...apiSyncQueue].reverse();
  let synced = 0;
  for (const item of queue) {
    try {
      const conflict = await detectQueuedSyncConflict(item);
      if (conflict) {
        markApiSyncQueueConflict(item, conflict);
        continue;
      }
      const result = await apiRequest(item.path, {
        method: item.method,
        body: item.body
      });
      if (result.project) mergeCoreRecordsFromApi({ projects: [result.project] });
      if (result.task) mergeCoreRecordsFromApi({ tasks: [result.task] });
      if (result.collection && result.record) mergeCollectionFromApi(result.collection, [result.record]);
      clearApiSyncQueueItem(item.id);
      synced += 1;
    } catch (error) {
      queueApiSyncFailure({ ...item, error: error.message });
    }
  }
  await refreshBackendHealth({ silent: true });
  if (synced) saveState();
  render();
  const conflictCount = apiSyncQueue.filter((item) => item.status === "conflict").length;
  showToast(
    conflictCount
      ? `${conflictCount} queued sync${conflictCount === 1 ? "" : "s"} need conflict review`
      : synced ? `Retried ${synced} API sync${synced === 1 ? "" : "s"}` : "API sync retry still blocked",
    synced && !conflictCount ? "success" : "info"
  );
}

async function resolveApiSyncConflict(itemId, resolution) {
  const item = apiSyncQueue.find((entry) => entry.id === itemId);
  if (!item) return;
  const queued = queuedSyncRecord(item);
  if (resolution === "drop") {
    clearApiSyncQueueItem(item.id);
    render();
    showToast("Queued sync dropped", "success");
    return;
  }
  if (resolution === "server") {
    const remote = item.conflict?.remote || await fetchRemoteQueuedRecord(item);
    if (remote && queued?.collection) {
      if (queued.collection === "tasks") mergeCoreRecordsFromApi({ tasks: [remote] });
      if (queued.collection === "projects") mergeCoreRecordsFromApi({ projects: [remote] });
      saveState();
    }
    clearApiSyncQueueItem(item.id);
    render();
    showToast("Server version kept", "success");
    return;
  }
  if (resolution === "local") {
    try {
      const result = await apiRequest(item.path, {
        method: item.method,
        body: item.body
      });
      if (result.project) mergeCoreRecordsFromApi({ projects: [result.project] });
      if (result.task) mergeCoreRecordsFromApi({ tasks: [result.task] });
      clearApiSyncQueueItem(item.id);
      saveState();
      render();
      showToast("Local version synced", "success");
    } catch (error) {
      queueApiSyncFailure({ ...item, status: "conflict", error: error.message });
      render();
      showToast(`Local sync still blocked: ${error.message}`, "info");
    }
  }
}

function notificationSettingsRecord() {
  return {
    id: "notification-settings-default",
    title: "Notification settings",
    ...notificationSettings(),
    updatedAt: new Date().toISOString()
  };
}

function inboxStateRecord() {
  return {
    id: "inbox-state-default",
    memberId: activeMemberId(),
    title: "Inbox state",
    read: state.inboxRead || [],
    archived: state.inboxArchived || [],
    snoozed: state.inboxSnoozed || {},
    updatedAt: new Date().toISOString()
  };
}

function integrationSettingsRecord() {
  return {
    id: "integration-settings-default",
    title: "Integration settings",
    ...integrationSettings(),
    updatedAt: new Date().toISOString()
  };
}

function syncNotificationSettingsToApi(action = "Notification settings synced") {
  syncRecordToApi("notificationSettings", notificationSettingsRecord(), action, false);
}

function syncInboxStateToApi(action = "Inbox state synced") {
  syncRecordToApi("inboxState", inboxStateRecord(), action, false);
}

function syncIntegrationSettingsToApi(action = "Integration settings synced") {
  syncRecordToApi("integrationSettings", integrationSettingsRecord(), action, false);
}

const structuredRecordCollections = [
  "companies",
  "approvals",
  "timeEntries",
  "comments",
  "activities",
  "documents",
  "files",
  "presence",
  "chatMessages",
  "whiteboards",
  "notificationSettings",
  "notificationReminders",
  "notificationHistory",
  "inboxState",
  "integrationSettings"
];

function mergeRecordsById(existingItems = [], incomingItems = []) {
  const next = new Map();
  existingItems.forEach((item) => next.set(item.id, item));
  incomingItems.forEach((item) => next.set(item.id, { ...(next.get(item.id) || {}), ...item }));
  return Array.from(next.values());
}

function collectionSignature(items = []) {
  return JSON.stringify(items.map((item) => ({
    id: item.id,
    updatedAt: item.updatedAt || item.createdAt || item.lastActiveAt || "",
    status: item.status || "",
    title: item.title || item.name || item.body || item.message || "",
    memberId: item.memberId || item.author || item.owner || ""
  })));
}

function normalizeCompanyRecord(company = {}) {
  return {
    type: "Client",
    status: "active",
    description: "",
    ...company
  };
}

function normalizeCollectionRecords(collection, items = []) {
  if (collection === "companies") return items.map(normalizeCompanyRecord).filter((company) => company.id);
  if (collection === "comments") return normalizeComments(items);
  if (collection === "chatMessages") return normalizeChatMessages(items);
  if (collection === "whiteboards") return normalizeWhiteboards(items);
  if (collection === "notificationReminders") return normalizeNotificationReminders(items);
  if (collection === "notificationHistory") return normalizeNotificationHistory(items);
  return items;
}

function mergeCollectionFromApi(collection, incoming = [], options = {}) {
  if (collection === "notificationSettings") return mergeNotificationSettingsFromApi(incoming);
  if (collection === "inboxState") return mergeInboxStateFromApi(incoming);
  if (collection === "integrationSettings") return mergeIntegrationSettingsFromApi(incoming);
  const current = Array.isArray(state[collection]) ? state[collection] : [];
  const incomingItems = normalizeCollectionRecords(collection, incoming);
  if (!incomingItems.length && !options.replaceEmpty) return false;
  const nextItems = options.authoritative || options.replaceEmpty
    ? incomingItems
    : mergeRecordsById(current, incomingItems);
  if (collectionSignature(nextItems) === collectionSignature(current)) return false;
  state[collection] = nextItems;
  return true;
}

function mergeNotificationSettingsFromApi(incoming = []) {
  const record = Array.isArray(incoming) ? incoming[0] : null;
  if (!record) return false;
  const currentSignature = JSON.stringify(notificationSettings());
  state.notificationSettings = normalizeNotificationSettings(record);
  return JSON.stringify(notificationSettings()) !== currentSignature;
}

function mergeInboxStateFromApi(incoming = []) {
  const record = Array.isArray(incoming) ? incoming[0] : null;
  if (!record) return false;
  const currentSignature = JSON.stringify({
    read: state.inboxRead,
    archived: state.inboxArchived,
    snoozed: state.inboxSnoozed
  });
  state.inboxRead = Array.isArray(record.read) ? record.read.map(String) : state.inboxRead;
  state.inboxArchived = Array.isArray(record.archived) ? record.archived.map(String) : state.inboxArchived;
  state.inboxSnoozed = normalizeInboxSnoozed(record.snoozed);
  return JSON.stringify({
    read: state.inboxRead,
    archived: state.inboxArchived,
    snoozed: state.inboxSnoozed
  }) !== currentSignature;
}

function mergeIntegrationSettingsFromApi(incoming = []) {
  const record = Array.isArray(incoming) ? incoming[0] : null;
  if (!record) return false;
  const currentSignature = JSON.stringify(integrationSettings());
  state.workspace = {
    ...state.workspace,
    integrations: normalizeWorkspaceIntegrations(record)
  };
  return JSON.stringify(integrationSettings()) !== currentSignature;
}

function normalizeProjectRecord(project = {}) {
  return {
    archivedAt: "",
    archivedBy: "",
    restoredAt: "",
    ...project,
    updatedAt: project.updatedAt || project.createdAt || new Date().toISOString()
  };
}

function normalizeTaskRecord(task = {}) {
  return {
    archivedAt: "",
    archivedBy: "",
    restoredAt: "",
    ...task,
    startDate: task.startDate || task.createdAt?.slice(0, 10) || "",
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
    blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    customFields: task.customFields && typeof task.customFields === "object" ? task.customFields : {}
  };
}

function normalizeProjectTemplates(templates, deletedIds = []) {
  const existing = Array.isArray(templates) ? templates : [];
  const deleted = new Set(Array.isArray(deletedIds) ? deletedIds : []);
  const existingIds = new Set(existing.map((template) => template?.id).filter(Boolean));
  const missingBuiltIns = seedData.projectTemplates.filter((template) => !deleted.has(template.id) && !existingIds.has(template.id));
  return [...existing, ...missingBuiltIns].filter((template) => template?.id && template?.name);
}

function coreRecordSignature({ projects = state.projects, tasks = state.tasks } = {}) {
  return JSON.stringify({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      companyId: project.companyId,
      owner: project.owner,
      startDate: project.startDate,
      dueDate: project.dueDate,
      archivedAt: project.archivedAt || "",
      restoredAt: project.restoredAt || ""
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      assignee: task.assignee,
      status: task.status,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      updatedAt: task.updatedAt || task.createdAt || "",
      archivedAt: task.archivedAt || "",
      restoredAt: task.restoredAt || ""
    }))
  });
}

function mergeCoreRecordsFromApi({ projects = [], tasks = [] } = {}, options = {}) {
  const incomingProjects = Array.isArray(projects) ? projects.map(normalizeProjectRecord).filter((project) => project.id) : [];
  const incomingTasks = Array.isArray(tasks) ? tasks.map(normalizeTaskRecord).filter((task) => task.id) : [];
  if (!incomingProjects.length && !incomingTasks.length && !options.replaceEmpty) return false;

  const previousSignature = coreRecordSignature();
  const authoritative = options.authoritative === true || options.replaceEmpty;
  const hasRemoteCore = incomingProjects.length || incomingTasks.length || options.replaceEmpty;
  state.projects = hasRemoteCore && authoritative
    ? incomingProjects
    : incomingProjects.length || options.replaceEmpty
      ? mergeRecordsById(state.projects, incomingProjects).map(normalizeProjectRecord)
      : state.projects;
  state.tasks = hasRemoteCore && authoritative
    ? incomingTasks
    : incomingTasks.length || options.replaceEmpty
      ? mergeRecordsById(state.tasks, incomingTasks).map(normalizeTaskRecord)
      : state.tasks;
  return coreRecordSignature() !== previousSignature;
}

async function loadCoreRecordsFromApi(options = {}) {
  if (!apiSession) return false;

  const [projectsResult, tasksResult] = await Promise.all([
    fetchApiCollectionPages("/api/projects", "projects", { includeArchived: "true" }),
    fetchApiCollectionPages("/api/tasks", "tasks", { includeArchived: "true" })
  ]);
  const changed = mergeCoreRecordsFromApi({
    projects: projectsResult,
    tasks: tasksResult
  }, { authoritative: true, ...options });

  if (changed) {
    markRealtimeChanged();
    saveState();
  }
  return changed;
}

async function fetchApiCollectionPages(path, key, params = {}) {
  const limit = params.limit || 500;
  let offset = params.offset || 0;
  const records = [];

  while (true) {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).filter(([name]) => !["limit", "offset"].includes(name))),
      limit: String(limit),
      offset: String(offset)
    });
    const result = await apiRequest(`${path}?${query}`);
    records.push(...(Array.isArray(result[key]) ? result[key] : []));
    if (!result.page?.hasMore) break;
    offset = Number(result.page.nextOffset);
    if (!Number.isFinite(offset)) break;
  }

  return records;
}

function markRealtimeChanged() {
  realtimeLastChangedAt = new Date().toISOString();
  realtimeChangeCount += 1;
  realtimeLastError = "";
}

function realtimeStatusLabel() {
  if (!canAttemptApiRequest()) return "Offline";
  if (!apiSession) return "Browser only";
  if (realtimeLastError) return "Sync needs attention";
  if (realtimeTransportStatus === "events") return "Realtime events";
  if (realtimeLastChangedAt) return `Live ${formatTimestamp(realtimeLastChangedAt)}`;
  if (apiSession.lastSyncedAt) return `Synced ${formatTimestamp(apiSession.lastSyncedAt)}`;
  return "Live polling";
}

async function loadStructuredRecordsFromApi(options = {}) {
  if (!apiSession) return false;

  const collections = options.collections || structuredRecordCollections;
  const recordsByCollection = await Promise.all(collections.map(async (collection) => ({
    collection,
    records: await fetchApiCollectionPages(`/api/records/${encodeURIComponent(collection)}`, "records")
  })));
  let changed = false;

  recordsByCollection.forEach(({ collection, records }) => {
    const incoming = Array.isArray(records) ? records : [];
    if (!incoming.length) return;
    changed = mergeCollectionFromApi(collection, incoming, { authoritative: collection === "companies" }) || changed;
  });

  if (changed) {
    markRealtimeChanged();
    saveState();
  }
  return changed;
}

function startRealtimePolling() {
  stopRealtimePolling();
  if (!apiSession) return;
  realtimePollTimer = window.setInterval(pollApiForWorkspaceChanges, REALTIME_POLL_MS);
  startRealtimeEvents();
}

function stopRealtimePolling() {
  if (realtimePollTimer) {
    window.clearInterval(realtimePollTimer);
    realtimePollTimer = null;
  }
  stopRealtimeEvents();
}

function realtimeEventsUrl() {
  const url = new URL(`${API_BASE_URL}/api/realtime/events`, window.location.href);
  url.searchParams.set("token", apiSession.token);
  return url.toString();
}

function stopRealtimeEvents() {
  if (realtimeEventRefreshTimer) {
    window.clearTimeout(realtimeEventRefreshTimer);
    realtimeEventRefreshTimer = null;
  }
  if (realtimeEventReconnectTimer) {
    window.clearTimeout(realtimeEventReconnectTimer);
    realtimeEventReconnectTimer = null;
  }
  if (realtimeEventSource) {
    realtimeEventSource.close();
    realtimeEventSource = null;
  }
  realtimeTransportStatus = apiSession ? "polling" : "offline";
}

function startRealtimeEvents() {
  if (!apiSession || !apiSession.token || !canAttemptApiRequest() || typeof EventSource === "undefined") {
    realtimeTransportStatus = apiSession ? "polling" : "offline";
    return;
  }
  if (realtimeEventSource) return;
  if (realtimeEventReconnectTimer) {
    window.clearTimeout(realtimeEventReconnectTimer);
    realtimeEventReconnectTimer = null;
  }

  realtimeTransportStatus = "connecting";
  realtimeEventSource = new EventSource(realtimeEventsUrl());
  realtimeEventSource.addEventListener("connected", () => {
    realtimeTransportStatus = "events";
    realtimeLastError = "";
    if (["collaboration", "dashboard", "inbox", "settings"].includes(state.selectedRoute)) render();
  });
  realtimeEventSource.addEventListener("heartbeat", () => {
    realtimeTransportStatus = "events";
  });
  realtimeEventSource.onmessage = handleRealtimeEventMessage;
  ["workspace", "project", "task", "record"].forEach((eventName) => {
    realtimeEventSource.addEventListener(eventName, handleRealtimeEventMessage);
  });
  realtimeEventSource.onerror = () => {
    realtimeTransportStatus = "polling";
    realtimeEventSource?.close();
    realtimeEventSource = null;
    if (!realtimeEventReconnectTimer && apiSession && canAttemptApiRequest()) {
      realtimeEventReconnectTimer = window.setTimeout(() => {
        realtimeEventReconnectTimer = null;
        startRealtimeEvents();
      }, 5000);
    }
  };
}

function handleRealtimeEventMessage(event) {
  let payload = {};
  try {
    payload = JSON.parse(event.data || "{}");
  } catch {
    return;
  }
  if (payload.actorId && payload.actorId === activeMemberId()) return;
  scheduleRealtimeEventRefresh(payload);
}

function scheduleRealtimeEventRefresh(payload = {}) {
  if (!apiSession || !canAttemptApiRequest()) return;
  if (realtimeEventRefreshTimer) window.clearTimeout(realtimeEventRefreshTimer);
  realtimeEventRefreshTimer = window.setTimeout(async () => {
    realtimeEventRefreshTimer = null;
    if (payload.type === "workspace" || payload.type === "project" || payload.type === "task") {
      await pollApiForWorkspaceChanges();
    }
    await refreshLiveCollaborationFromApi({ rerender: ["collaboration", "dashboard", "inbox"].includes(state.selectedRoute) });
  }, 250);
}

async function pollApiForWorkspaceChanges() {
  if (!apiSession || document.hidden || apiSyncQueue.length || !canAttemptApiRequest()) return;

  try {
    let changed = await loadCoreRecordsFromApi();
    changed = await loadStructuredRecordsFromApi() || changed;
    const remoteDocument = await apiRequest("/api/workspace");
    const updatedAt = remoteDocument.metadata?.updatedAt || "";
    const hasSnapshotChange = Boolean(remoteDocument.snapshot && updatedAt && updatedAt !== apiSession.lastSyncedAt && updatedAt !== realtimeLastRefreshAt);

    if (hasSnapshotChange) {
      const openTaskId = document.querySelector("#task-dialog[open] #task-id")?.value || "";
      const previousRevision = openTaskId ? taskRevision(byId(state.tasks, openTaskId)) : "";
      realtimeLastRefreshAt = updatedAt;
      applyWorkspaceSnapshot(remoteDocument.snapshot);
      changed = await loadCoreRecordsFromApi() || changed;
      changed = await loadStructuredRecordsFromApi() || changed;
      changed = true;
      markRealtimeChanged();
      saveApiSession({ ...apiSession, lastSyncedAt: updatedAt, storageDriver: remoteDocument.metadata.storage || apiSession.storageDriver });
      handleOpenTaskRemoteRefresh(openTaskId, previousRevision);
    }

    if (!changed) return;

    if (state.selectedRoute !== "settings" && state.selectedRoute !== "data") {
      render();
    }
    showToast("Live workspace updates applied", "success");
  } catch (error) {
    if (error.message === "Session expired") {
      clearApiSession();
      render();
      showToast("API session expired. Sign in again from Settings.", "info");
    } else {
      realtimeLastError = error.message || "Realtime refresh failed";
    }
  }
}

function handleOpenTaskRemoteRefresh(openTaskId, previousRevision = "") {
  if (!openTaskId) return;
  const task = byId(state.tasks, openTaskId);
  if (!task) return;
  const nextRevision = taskRevision(task);
  if (previousRevision && nextRevision && previousRevision !== nextRevision && taskEditSnapshots.get(openTaskId) !== nextRevision) {
    showTaskEditWarning(task);
  }
  renderTaskCollaboration(openTaskId);
  renderTaskTimeTracking(openTaskId);
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

function offlineCapabilityLabel() {
  if (!isNetworkOnline() && apiSession && !isLocalApiBaseUrl()) return "Offline, sync queued";
  if (!isNetworkOnline()) return "Offline local mode";
  if (apiSession) return "Online sync ready";
  return "Offline-first local";
}

function offlineCapabilityDetail() {
  if (!isNetworkOnline() && apiSession && !isLocalApiBaseUrl()) {
    return apiSyncQueue.length
      ? `${apiSyncQueue.length} local change${apiSyncQueue.length === 1 ? "" : "s"} waiting to retry.`
      : "Keep working locally; new API changes will queue until the network returns.";
  }
  if (!isNetworkOnline()) return "Workspace data, exports, imports, and core task workflows stay available on this device.";
  if (apiSession) return apiSyncQueue.length ? "Queued changes can retry now." : "API sync is available, with local storage still protecting the current device.";
  return "No account or API is required for local planning, editing, import, export, and review.";
}

function offlineCapabilityTone() {
  if (!isNetworkOnline() && apiSession && !isLocalApiBaseUrl()) return "inbox-amber";
  return "inbox-green";
}

function apiStatusLabel(offlineLabel = "browser only") {
  if (!isNetworkOnline() && apiSession && !isLocalApiBaseUrl()) return "offline queued";
  if (!isNetworkOnline()) return "offline local";
  if (!apiSession) return offlineLabel;
  return apiBackendLabel().replace(" connected", "");
}

function apiConnectionTone() {
  if (!isNetworkOnline() && apiSession && !isLocalApiBaseUrl()) return "inbox-amber";
  if (!isNetworkOnline()) return "inbox-green";
  return apiSession ? "inbox-green" : "inbox-neutral";
}

function isClientSession() {
  return apiSession?.membership?.role === "client";
}

function clientCompanyId() {
  return apiSession?.membership?.companyId || apiSession?.user?.companyId || state.companies.find((company) => company.type === "Client")?.id || state.companies[0]?.id || "";
}

function clientAllowedRoutes() {
  return new Set(["portal", "invite", "feedback"]);
}

function canAccessRoute(route) {
  if (isClientSession()) return clientAllowedRoutes().has(route);
  if (!apiSession) return true;
  const routePermissions = {
    audit: "audit:read",
    permissions: "audit:read",
    readiness: "workspace:read",
    data: "workspace:import",
    settings: "workspace:read",
    reports: "workspace:read",
    goals: "workspace:read",
    marketplace: "projects:write",
    templates: "projects:write",
    automations: "projects:write",
    fields: "projects:write",
    companies: "projects:write",
    company: "projects:write",
    intake: "projects:write",
    operator: "workspace:read",
    collaboration: "workspace:read"
  };
  const permission = routePermissions[route];
  return permission ? hasApiPermission(permission) : true;
}

function currentWorkspaceRole() {
  return apiSession?.membership?.role || "admin";
}

function hasApiPermission(permission) {
  return !apiSession || apiSession.permissions?.includes(permission);
}

function currentMembership() {
  return apiSession?.membership || state.memberships.find((membership) => membership.memberId === activeMemberId()) || null;
}

function currentCompanyAccess() {
  const membership = currentMembership();
  const companyIds = Array.isArray(membership?.companyIds) ? membership.companyIds : [];
  const singleCompanyId = membership?.companyId || apiSession?.user?.companyId || "";
  return Array.from(new Set([...companyIds, singleCompanyId].filter(Boolean)));
}

function hasCompanyScope() {
  return currentCompanyAccess().length > 0;
}

function canAccessCompany(companyId) {
  if (!companyId) return true;
  const access = currentCompanyAccess();
  return !access.length || access.includes(companyId);
}

function canAccessProject(projectOrId) {
  const project = typeof projectOrId === "string" ? byId(state.projects, projectOrId) : projectOrId;
  return Boolean(project && canAccessCompany(project.companyId));
}

function canAccessTask(task) {
  return Boolean(task && canAccessProject(task.projectId));
}

function canWrite(permission) {
  return hasApiPermission(permission);
}

function canSaveWholeWorkspace() {
  return Boolean(apiSession && hasApiPermission("workspace:write") && !hasCompanyScope());
}

function canUseSettingsTab(tabId) {
  if (!apiSession) return true;
  const role = currentWorkspaceRole();
  if (role === "client") return false;
  if (tabId === "members" || tabId === "security") return role === "admin";
  if (tabId === "integrations") return hasApiPermission("integrations:write") || hasApiPermission("notifications:write");
  if (tabId === "payments") return hasApiPermission("payments:write");
  if (tabId === "workspace" || tabId === "sync" || tabId === "developer" || tabId === "trust") return role === "admin" || role === "manager";
  return true;
}

function settingsTabFallback(tabId) {
  if (settingsTabs.some((tab) => tab.id === tabId && canUseSettingsTab(tab.id))) return tabId;
  return settingsTabs.find((tab) => canUseSettingsTab(tab.id))?.id || "account";
}

function renderSettingsTabs(activeTab) {
  return `
    <div class="settings-tabs" role="tablist" aria-label="Settings sections">
      ${settingsTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const canUseTab = canUseSettingsTab(tab.id);
        return `
          <button
            class="settings-tab ${isActive ? "is-active" : ""}"
            type="button"
            role="tab"
            data-settings-tab="${tab.id}"
            aria-selected="${isActive ? "true" : "false"}"
            ${canUseTab ? "" : "disabled aria-disabled=\"true\""}
          >${escapeHtml(tab.label)}</button>
        `;
      }).join("")}
    </div>
  `;
}

function renderSettingsSectionIntro(activeTab) {
  const sections = {
    account: ["Account access", "Sign in, change passwords, and connect the browser to the API."],
    workspace: ["Workspace defaults", "Set the name, role defaults, theme, capacity, and deployment readiness."],
    trust: ["Trust posture", "Review portability, privacy, AI rationale, and auditability."],
    members: ["Team governance", "Confirm ownership, invite authority, client scope, and offboarding posture."],
    integrations: ["Connected tools", "Plan sync adapters, notification delivery, and AI provider settings."],
    payments: ["Marketplace payments", "Configure provider planning, spend caps, entitlements, and audit events."],
    sync: ["Backend sync", "Save, load, repair, and verify API/Supabase health."],
    security: ["Access controls", "Inspect current access, roles, permissions, and operator guardrails."],
    developer: ["Developer readiness", "Inspect backend health, records, queues, and launch checks."]
  };
  const [title, detail] = sections[activeTab] || sections.account;
  return `
    <section class="settings-section-intro">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </section>
  `;
}

function renderRouteHeader({ eyebrow = "", title, description = "", actions = [] }) {
  return `
    <section class="route-header">
      <div>
        ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
        <h1>${escapeHtml(title)}</h1>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </div>
      ${actions.length ? `
        <div class="route-header-actions">
          ${actions.map((action) => `
            <button
              class="button ${action.primary ? "button-primary" : "button-secondary"}"
              type="button"
              ${action.commandId ? `data-command-id="${escapeHtml(action.commandId)}"` : ""}
              ${action.route ? `data-route="${escapeHtml(action.route)}"` : ""}
              ${action.id ? `id="${escapeHtml(action.id)}"` : ""}
              ${action.disabled ? "disabled" : ""}
            >${escapeHtml(action.label)}</button>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function createBlankWorkspaceState(options = {}) {
  const blank = structuredClone(seedData);
  const owner = members[0];
  const now = new Date().toISOString();
  const workspaceId = options.id || activeWorkspaceId;
  const workspaceName = options.name || "New Agora Workspace";
  return normalizeState({
    ...blank,
    selectedRoute: "dashboard",
    selectedProject: "all",
    selectedCompany: "all",
    selectedSettingsTab: "account",
    savedViews: [],
    dailyNotes: {},
    dailyPlans: {},
    dashboardWidgets: normalizeDashboardWidgets(seedData.dashboardWidgets),
    dashboardLayouts: normalizeDashboardLayouts(seedData.dashboardLayouts),
    selectedDashboardLayoutId: seedData.selectedDashboardLayoutId,
    switcherImportPreview: null,
    inboxRead: [],
    inboxArchived: [],
    inboxSnoozed: {},
    notificationHistory: [],
    notificationSettings: normalizeNotificationSettings(),
    taskWatchers: {},
    presence: [],
    chatMessages: [],
    whiteboards: [],
    approvals: [],
    comments: [],
    activities: [],
    documents: [],
    files: [],
    timeEntries: [],
    intakeForms: [],
    intakeSubmissions: [],
    companies: [],
    projects: [],
    tasks: [],
    milestones: [],
    users: [],
    invitations: [],
    auditEvents: [
      {
        id: `audit-clean-start-${workspaceId}-${Date.now()}`,
        actorId: owner.id,
        action: "workspace_clean_start",
        detail: "Clean workspace created",
        source: "local",
        createdAt: now
      }
    ],
    memberships: [{ memberId: owner.id, role: "admin", status: "active" }],
    workspace: {
      ...blank.workspace,
      id: workspaceId,
      name: workspaceName,
      slug: options.slug || slugFromName(workspaceName),
      visibility: "Private"
    },
    onboarding: {
      dismissed: false,
      sampleMode: "clean",
      completedAt: ""
    }
  });
}

function onboardingItems() {
  const activeMemberships = state.memberships.filter((membership) => membership.status !== "revoked");
  const customUserIds = new Set((state.users || []).map((user) => user.id));
  const setupMemberships = state.onboarding?.sampleMode === "clean"
    ? activeMemberships.filter((membership) => membership.memberId === members[0].id || customUserIds.has(membership.memberId))
    : activeMemberships;
  const hasChosenDataMode = ["demo", "clean", "import", "template"].includes(state.onboarding?.sampleMode);
  const hasWorkspaceName = Boolean(state.workspace.name && state.workspace.name !== "New Agora Workspace");
  const hasCompany = visibleCompanies().length > 0;
  const hasProject = activeProjects().length > 0;
  const hasTeam = setupMemberships.length > 1 || state.invitations.some((invitation) => invitation.status === "pending");
  const hasApi = Boolean(apiSession);
  return [
    {
      id: "data",
      label: "Data mode",
      detail: state.onboarding?.sampleMode === "clean"
        ? "Clean workspace"
        : state.onboarding?.sampleMode === "import"
          ? "Imported workspace"
          : state.onboarding?.sampleMode === "template"
            ? "Template workspace"
            : "Demo workspace",
      done: hasChosenDataMode,
      action: "start-clean"
    },
    {
      id: "workspace",
      label: "Workspace",
      detail: hasWorkspaceName ? state.workspace.name : "Name the workspace",
      done: hasWorkspaceName,
      action: "workspace"
    },
    {
      id: "company",
      label: "First company",
      detail: hasCompany ? `${visibleCompanies().length} active` : "Create a company",
      done: hasCompany,
      action: "company"
    },
    {
      id: "project",
      label: "First project",
      detail: hasProject ? `${activeProjects().length} active` : "Create a project",
      done: hasProject,
      action: "project"
    },
    {
      id: "team",
      label: "Team access",
      detail: hasTeam ? `${setupMemberships.length} member${setupMemberships.length === 1 ? "" : "s"}` : "Invite a teammate",
      done: hasTeam,
      action: "invite"
    },
    {
      id: "api",
      label: "Backend",
      detail: apiSession ? apiBackendLabel() : "Browser local",
      done: hasApi,
      action: "account"
    },
    {
      id: "notifications",
      label: "Notifications",
      detail: state.onboarding?.notificationsReviewed ? "Preferences reviewed" : "Choose alerts and delivery",
      done: Boolean(state.onboarding?.notificationsReviewed),
      action: "notifications"
    },
    {
      id: "templates",
      label: "Templates",
      detail: state.onboarding?.templatesReviewed ? "Starter workflow reviewed" : "Pick starter workflows",
      done: Boolean(state.onboarding?.templatesReviewed),
      action: "review-templates"
    }
  ];
}

function onboardingWizardSteps() {
  const items = Object.fromEntries(onboardingItems().map((item) => [item.id, item]));
  const storageMode = apiSession ? apiBackendLabel() : "Browser local storage";
  return [
    {
      id: "data",
      eyebrow: "Step 1",
      title: "Choose how this workspace starts",
      body: "Start with demo data, a clean workspace, an import, or a template. This controls the shape of the first project experience.",
      done: items.data?.done,
      detail: items.data?.detail || "Choose a data mode",
      primaryAction: state.onboarding?.sampleMode === "clean" ? "use-demo" : "start-clean",
      primaryLabel: state.onboarding?.sampleMode === "clean" ? "Use Demo Data" : "Start Clean",
      secondaryAction: "import",
      secondaryLabel: "Import"
    },
    {
      id: "workspace",
      eyebrow: "Step 2",
      title: "Name the workspace and set defaults",
      body: "Set the workspace name, visibility, default role, theme, density, and backend target before inviting people in.",
      done: items.workspace?.done,
      detail: items.workspace?.detail || "Name the workspace",
      primaryAction: "workspace",
      primaryLabel: "Open Workspace Settings"
    },
    {
      id: "structure",
      eyebrow: "Step 3",
      title: "Create the first company and project",
      body: "Agora works best once it has a company scope and a real project. That unlocks reporting, templates, company views, and project dashboards.",
      done: Boolean(items.company?.done && items.project?.done),
      detail: `${items.company?.detail || "No company"} / ${items.project?.detail || "No project"}`,
      primaryAction: items.company?.done ? "project" : "company",
      primaryLabel: items.company?.done ? "Create Project" : "Create Company",
      secondaryAction: "templates",
      secondaryLabel: "Use Template"
    },
    {
      id: "team",
      eyebrow: "Step 4",
      title: "Invite the people who need access",
      body: "Add teammates or clients, review roles, and confirm company-scoped access before real work starts moving through Agora.",
      done: items.team?.done,
      detail: items.team?.detail || "Invite a teammate",
      primaryAction: "invite",
      primaryLabel: "Open Members"
    },
    {
      id: "backend",
      eyebrow: "Step 5",
      title: "Connect storage and sync",
      body: "Use browser storage for solo exploration, or connect the API/Supabase path before a team depends on the workspace.",
      done: items.api?.done,
      detail: storageMode,
      primaryAction: apiSession ? "sync" : "account",
      primaryLabel: apiSession ? "Open Sync" : "Connect API"
    },
    {
      id: "notifications",
      eyebrow: "Step 6",
      title: "Review notification delivery",
      body: "Decide which alerts belong in the inbox, browser notifications, webhook payloads, or email handoff before launch.",
      done: items.notifications?.done,
      detail: items.notifications?.detail || "Choose alerts and delivery",
      primaryAction: "notifications",
      primaryLabel: "Open Notifications",
      secondaryAction: "mark-notifications",
      secondaryLabel: "Mark Reviewed"
    },
    {
      id: "templates",
      eyebrow: "Step 7",
      title: "Pick starter workflows",
      body: "Install or review templates for the kind of work this team runs: client delivery, software, finance, art, marketing, research, or internal ops.",
      done: items.templates?.done,
      detail: `${state.projectTemplates.length} built-in templates available`,
      primaryAction: "review-templates",
      primaryLabel: "Open Templates",
      secondaryAction: "mark-templates",
      secondaryLabel: "Mark Reviewed"
    }
  ];
}

function onboardingScore() {
  const items = onboardingItems();
  return {
    done: items.filter((item) => item.done).length,
    total: items.length
  };
}

function isOnboardingComplete() {
  const score = onboardingScore();
  return score.done === score.total;
}

function onboardingNextAction() {
  return onboardingItems().find((item) => !item.done) || {
    label: "Workspace ready",
    detail: "Core setup is complete.",
    action: "sync"
  };
}

function shouldShowOnboardingPanel() {
  return !state.onboarding?.dismissed || !isOnboardingComplete();
}

function renderConnectionBanner() {
  if (!els.connectionBanner) return;
  if (state.selectedRoute === "landing") {
    els.connectionBanner.hidden = true;
    els.connectionBanner.innerHTML = "";
    return;
  }

  const score = onboardingScore();
  const setupComplete = score.done === score.total;
  const syncLabel = offlineCapabilityLabel();
  const queueLabel = apiSyncQueue.length ? `${apiSyncQueue.length} queued` : "Queue clear";
  els.connectionBanner.hidden = false;
  els.connectionBanner.innerHTML = `
    <div>
      <span class="status-pill ${offlineCapabilityTone()}">${escapeHtml(syncLabel)}</span>
      <strong>${escapeHtml(state.workspace.name)}</strong>
      <small>${escapeHtml(offlineCapabilityDetail())} / ${escapeHtml(queueLabel)}</small>
    </div>
    <div class="connection-actions">
      ${setupComplete ? `<span class="status-pill inbox-green">Setup complete</span>` : `<span class="status-pill inbox-amber">${score.done}/${score.total} setup</span>`}
      ${setupComplete ? "" : `<button class="button button-secondary compact-button" type="button" data-onboarding-action="show">Continue setup</button>`}
      <button class="button button-secondary compact-button" type="button" data-tutorial-action="start">${state.tutorial?.completedAt ? "Tutorial" : "Start Tutorial"}</button>
      <button class="button button-secondary compact-button" type="button" data-onboarding-action="sync">Sync</button>
    </div>
  `;
}

function renderOnboardingPanel() {
  if (!shouldShowOnboardingPanel()) return "";
  const score = onboardingScore();
  const setupComplete = score.done === score.total;
  const wizard = renderOnboardingWizard();
  const nextAction = onboardingNextAction();
  return `
    <section class="panel onboarding-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">First run</p>
          <h2>Workspace setup</h2>
        </div>
        <span class="status-pill ${setupComplete ? "inbox-green" : "inbox-amber"}">${score.done}/${score.total}</span>
      </div>
      <div class="onboarding-next-action">
        <div>
          <span>${setupComplete ? "Ready" : "Recommended next"}</span>
          <strong>${escapeHtml(nextAction.label)}</strong>
          <p>${escapeHtml(nextAction.detail || "")}</p>
        </div>
        <button class="button button-primary compact-button" type="button" data-onboarding-action="${escapeHtml(nextAction.action || "wizard")}">${setupComplete ? "Review Sync" : "Continue"}</button>
      </div>
      <div class="onboarding-choice-row">
        <button class="button button-primary" type="button" data-onboarding-action="wizard">${state.onboarding?.wizardActive ? "Hide Wizard" : "Open Wizard"}</button>
        <button class="button ${state.onboarding?.sampleMode === "demo" ? "button-primary" : "button-secondary"}" type="button" data-onboarding-action="use-demo">Use Demo Data</button>
        <button class="button ${state.onboarding?.sampleMode === "clean" ? "button-primary" : "button-secondary"}" type="button" data-onboarding-action="start-clean">Start Clean</button>
        <button class="button ${state.onboarding?.sampleMode === "import" ? "button-primary" : "button-secondary"}" type="button" data-onboarding-action="import">Import CSV</button>
        <button class="button ${state.onboarding?.sampleMode === "template" ? "button-primary" : "button-secondary"}" type="button" data-onboarding-action="templates">Use Template</button>
        <button class="button button-secondary" type="button" data-onboarding-action="dismiss">${setupComplete ? "Done" : "Hide"}</button>
      </div>
      ${wizard}
      <div class="onboarding-grid">
        ${onboardingItems().map((item) => `
          <article class="setup-step ${item.done ? "is-done" : "is-open"}">
            <span>${item.done ? "OK" : "Next"}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </div>
            <button class="button button-secondary compact-button" type="button" data-onboarding-action="${item.action}">${item.done ? "Open" : "Start"}</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOnboardingWizard() {
  if (!state.onboarding?.wizardActive) return "";
  const steps = onboardingWizardSteps();
  const index = clamp(Number(state.onboarding?.wizardStep || 0), 0, steps.length - 1);
  const step = steps[index];
  const completeCount = steps.filter((item) => item.done).length;
  return `
    <div class="onboarding-wizard" role="region" aria-label="First-run onboarding wizard">
      <div class="wizard-rail" aria-label="Setup steps">
        ${steps.map((item, stepIndex) => `
          <button class="wizard-step ${stepIndex === index ? "is-active" : ""} ${item.done ? "is-done" : ""}" type="button" data-onboarding-step="${stepIndex}" aria-current="${stepIndex === index ? "step" : "false"}">
            <span>${stepIndex + 1}</span>
            <strong>${escapeHtml(item.title)}</strong>
          </button>
        `).join("")}
      </div>
      <div class="wizard-card">
        <div class="wizard-card-header">
          <div>
            <p class="eyebrow">${escapeHtml(step.eyebrow)}</p>
            <h3>${escapeHtml(step.title)}</h3>
          </div>
          <span class="status-pill ${step.done ? "inbox-green" : "inbox-amber"}">${step.done ? "Ready" : "Needs action"}</span>
        </div>
        <p>${escapeHtml(step.body)}</p>
        <div class="wizard-detail">
          <span>${step.done ? "OK" : "Next"}</span>
          <strong>${escapeHtml(step.detail)}</strong>
        </div>
        ${renderOnboardingInlineForm(step)}
        <div class="wizard-actions">
          <button class="button button-secondary compact-button" type="button" data-onboarding-action="wizard-prev" ${index === 0 ? "disabled" : ""}>Back</button>
          ${step.secondaryAction ? `<button class="button button-secondary compact-button" type="button" data-onboarding-action="${escapeHtml(step.secondaryAction)}">${escapeHtml(step.secondaryLabel)}</button>` : ""}
          <button class="button button-primary compact-button" type="button" data-onboarding-action="${escapeHtml(step.primaryAction)}">${escapeHtml(step.primaryLabel)}</button>
          <button class="button button-secondary compact-button" type="button" data-onboarding-action="${index === steps.length - 1 ? "wizard-finish" : "wizard-next"}">${index === steps.length - 1 ? "Finish" : "Next"}</button>
        </div>
        <div class="wizard-progress" aria-label="${completeCount} of ${steps.length} setup steps complete">
          <span style="width: ${(completeCount / steps.length) * 100}%"></span>
        </div>
      </div>
    </div>
  `;
}

function renderOnboardingInlineForm(step) {
  if (step.id === "workspace") {
    return `
      <div class="wizard-inline-form">
        <label>
          <span>Workspace name</span>
          <input id="onboarding-workspace-name" value="${escapeHtml(state.workspace.name)}">
        </label>
        <label>
          <span>Slug</span>
          <input id="onboarding-workspace-slug" value="${escapeHtml(state.workspace.slug)}">
        </label>
        <button class="button button-secondary compact-button" type="button" data-onboarding-inline="workspace">Save Workspace</button>
      </div>
    `;
  }

  if (step.id === "structure") {
    const firstCompany = visibleCompanies()[0] || state.companies[0] || {};
    return `
      <div class="wizard-inline-form">
        <label>
          <span>Company</span>
          <input id="onboarding-company-name" value="${escapeHtml(firstCompany.name || "Acme Studio")}" placeholder="Acme Studio">
        </label>
        <label>
          <span>First project</span>
          <input id="onboarding-project-name" value="${escapeHtml(activeProjects()[0]?.name || "Launch plan")}" placeholder="Launch plan">
        </label>
        <button class="button button-secondary compact-button" type="button" data-onboarding-inline="structure">Create Structure</button>
      </div>
    `;
  }

  if (step.id === "team") {
    return `
      <div class="wizard-inline-form">
        <label>
          <span>Name</span>
          <input id="onboarding-invite-name" placeholder="Jordan Lee">
        </label>
        <label>
          <span>Email</span>
          <input id="onboarding-invite-email" type="email" placeholder="jordan@company.com">
        </label>
        <label>
          <span>Role</span>
          <select id="onboarding-invite-role">
            ${workspaceRoles.map((role) => `<option value="${role.id}" ${role.id === state.workspace.defaultRole ? "selected" : ""}>${escapeHtml(role.label)}</option>`).join("")}
          </select>
        </label>
        <button class="button button-secondary compact-button" type="button" data-onboarding-inline="invite">${apiSession ? "Send Invite" : "Save Draft Invite"}</button>
      </div>
    `;
  }

  if (step.id === "backend") {
    return `
      <div class="wizard-inline-form">
        <label class="wizard-wide-field">
          <span>API URL</span>
          <input id="onboarding-api-url" value="${escapeHtml(API_BASE_URL)}" placeholder="http://127.0.0.1:8787">
        </label>
        <button class="button button-secondary compact-button" type="button" data-onboarding-inline="api-url">Save API URL</button>
        <button class="button button-secondary compact-button" type="button" data-onboarding-action="sync">Open Sync</button>
      </div>
    `;
  }

  return "";
}

function launchReadinessItems() {
  const setup = onboardingScore();
  const backups = loadWorkspaceBackups();
  const enabledAutomations = state.automations.filter((automation) => automation.enabled);
  const docsAndFiles = state.documents.length + state.files.length;
  const realProject = realProjectReadinessItems();
  const hasTeamAccess = state.memberships.filter((membership) => membership.status !== "revoked").length > 1
    || state.invitations.some((invitation) => invitation.status === "pending");
  const backendReady = apiSession && backendReadinessItems().every((item) => item.done);
  return [
    {
      label: "Real project mode",
      detail: `${realProject.filter((item) => item.done).length}/${realProject.length} PM gates ready`,
      done: realProject.every((item) => item.done),
      commandId: "route:dashboard"
    },
    {
      label: "Workspace setup",
      detail: `${setup.done}/${setup.total} setup steps complete`,
      done: setup.done === setup.total,
      commandId: "tutorial:start"
    },
    {
      label: "Server sync",
      detail: apiSession ? apiConnectionLabel() : "Connect API or Supabase before team use",
      done: Boolean(apiSession),
      commandId: "settings:sync"
    },
    {
      label: "Local recovery",
      detail: backups.length ? `${backups.length} backup${backups.length === 1 ? "" : "s"} available` : "Create a backup before imports or API restores",
      done: backups.length > 0,
      commandId: "backup:create"
    },
    {
      label: "Team access",
      detail: hasTeamAccess ? "Members or invitations are configured" : "Invite a teammate and review roles",
      done: hasTeamAccess,
      commandId: "settings:members"
    },
    {
      label: "Workflow defaults",
      detail: `${state.projectTemplates.length} project templates, ${enabledAutomations.length} enabled automations`,
      done: state.projectTemplates.length > 0 && enabledAutomations.length > 0,
      commandId: "route:templates"
    },
    {
      label: "Backend readiness",
      detail: backendReady ? "Connected backend checks are passing" : "Connect API and review health checks",
      done: Boolean(backendReady),
      commandId: "route:data"
    },
    {
      label: "Knowledge base",
      detail: docsAndFiles ? `${docsAndFiles} docs/files in the workspace` : "Add docs or files for project context",
      done: docsAndFiles > 0,
      commandId: "route:docs"
    }
  ];
}

function realProjectTarget() {
  const selected = byId(state.projects, state.selectedProject);
  if (selected && !isProjectArchived(selected)) return selected;
  return activeProjects()[0] || null;
}

function realProjectReadinessItems(project = realProjectTarget()) {
  const backups = loadWorkspaceBackups();
  const hasRecoveryEvidence = backups.length > 0 || state.auditEvents.some((event) => event.action === "workspace_export");
  const projectTasks = project ? getProjectTasks(project.id, false) : [];
  const projectRaid = project ? projectRaidItems(project.id) : [];
  const projectApprovals = project ? state.approvals.filter((approval) => approval.projectId === project.id && approval.status !== "approved") : [];
  const hasScopedClient = project ? state.memberships.some((membership) => membership.role === "client" && membership.companyId === project.companyId && membership.status !== "revoked") : false;
  const hasClientPreview = project ? projectApprovals.length > 0 || state.documents.some((document) => document.projectId === project.id) || state.files.some((file) => file.projectId === project.id) : false;
  return [
    {
      label: "API source of truth",
      done: Boolean(apiSession),
      detail: apiSession ? apiConnectionLabel() : "Connect API before making Agora the project record."
    },
    {
      label: "Recovery exported",
      done: hasRecoveryEvidence,
      detail: hasRecoveryEvidence ? "Backup or portable export evidence exists." : "Create a backup or portable bundle before kickoff."
    },
    {
      label: "Project has work",
      done: Boolean(project && projectTasks.length),
      detail: project ? `${projectTasks.length} task${projectTasks.length === 1 ? "" : "s"} in ${project.name}.` : "Create or select a project."
    },
    {
      label: "RAID tracked",
      done: projectRaid.some((item) => item.status !== "closed"),
      detail: projectRaid.length ? `${projectRaid.length} risks, assumptions, issues, decisions, or changes tracked.` : "Capture at least one RAID/decision item."
    },
    {
      label: "Client preview safe",
      done: hasScopedClient || hasClientPreview,
      detail: hasScopedClient ? "A client role is company-scoped." : hasClientPreview ? "Client-facing approvals or assets exist for preview." : "Scope a client or stage client-facing assets."
    },
    {
      label: "Status report ready",
      done: Boolean(project && projectTasks.some((task) => task.status !== "done")),
      detail: project ? "Reports can generate a project status packet." : "Select a project before the first shareout."
    }
  ];
}

function renderLaunchReadinessPanel() {
  const items = launchReadinessItems();
  const doneCount = items.filter((item) => item.done).length;
  return `
    <section class="panel readiness-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Launch readiness</p>
          <h2>Production setup</h2>
        </div>
        <span class="status-pill ${doneCount === items.length ? "inbox-green" : "inbox-amber"}">${doneCount}/${items.length}</span>
      </div>
      <div class="readiness-grid">
        ${items.map((item) => `
          <article class="readiness-item ${item.done ? "is-done" : "is-open"}">
            <span>${item.done ? "OK" : "Next"}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </div>
            <button class="button button-secondary compact-button" type="button" data-command-id="${escapeHtml(item.commandId)}">${item.done ? "Open" : "Fix"}</button>
          </article>
        `).join("")}
      </div>
      <div class="readiness-actions">
        <button class="button button-primary" type="button" id="open-command-palette">Open Command Palette</button>
        <span>Press <kbd>Cmd K</kbd> or <kbd>Ctrl K</kbd> anywhere in Agora.</span>
      </div>
    </section>
  `;
}

function teamLaunchChecklistItems() {
  const backups = loadWorkspaceBackups();
  const hasOwner = state.memberships.some((membership) => membership.role === "admin" && membership.status !== "revoked");
  const hasInvites = state.invitations.some((invitation) => invitation.status === "pending")
    || state.memberships.filter((membership) => membership.status !== "revoked").length > 1;
  const hasSupabasePlan = state.workspace.backendTarget.toLowerCase().includes("supabase") || apiSession?.apiHealth?.storage === "supabase";
  const hasOperatorPreset = operatorPermissionSummary() !== `${aiPermissionOptions.length}/${aiPermissionOptions.length} allowed`
    || state.auditEvents.some((event) => event.action === "ai_operator_permission_preset");
  const hasPortableRecovery = state.portableImportPreview || backups.length || state.auditEvents.some((event) => event.action === "workspace_export");
  return [
    {
      label: "Connect API",
      detail: apiSession ? apiConnectionLabel() : "Connect the API before team use",
      done: Boolean(apiSession),
      commandId: "settings:sync"
    },
    {
      label: "Create owner",
      detail: hasOwner ? "Workspace admin is configured" : "Create or confirm the first admin",
      done: hasOwner,
      commandId: "settings:members"
    },
    {
      label: "Invite team",
      detail: hasInvites ? "Team access exists" : "Invite teammates and review roles",
      done: hasInvites,
      commandId: "settings:members"
    },
    {
      label: "Configure Supabase",
      detail: hasSupabasePlan ? "Supabase path is selected or connected" : "Review Supabase storage/auth setup",
      done: Boolean(hasSupabasePlan),
      commandId: "route:data"
    },
    {
      label: "Test backups",
      detail: backups.length ? `${backups.length} local backup${backups.length === 1 ? "" : "s"}` : "Create a local backup",
      done: backups.length > 0,
      commandId: "backup:create"
    },
    {
      label: "Choose Operator preset",
      detail: hasOperatorPreset ? `Preset scope: ${operatorPermissionSummary()}` : "Pick Safe, Project PM, Client PM, or Ops Admin",
      done: hasOperatorPreset,
      commandId: "route:operator"
    },
    {
      label: "Export recovery bundle",
      detail: hasPortableRecovery ? "Recovery path has local evidence" : "Download a portable bundle from Data",
      done: Boolean(hasPortableRecovery),
      commandId: "route:data"
    }
  ];
}

function renderTeamLaunchChecklistPanel() {
  const items = teamLaunchChecklistItems();
  const doneCount = items.filter((item) => item.done).length;
  return `
    <section class="panel team-launch-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Production onboarding</p>
          <h2>Launch Agora for your team</h2>
        </div>
        <span class="status-pill ${doneCount === items.length ? "inbox-green" : "inbox-amber"}">${doneCount}/${items.length}</span>
      </div>
      <div class="team-launch-list">
        ${items.map((item, index) => `
          <article class="team-launch-item ${item.done ? "is-done" : "is-open"}">
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </div>
            <button class="button button-secondary compact-button" type="button" data-command-id="${escapeHtml(item.commandId)}">${item.done ? "Review" : "Start"}</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function goldenPathItems() {
  const installedMarketplaceTemplates = marketplaceProjectTemplates.filter((template) => state.projectTemplates.some((item) => item.id === template.id || item.name.toLowerCase() === template.name.toLowerCase()));
  const installedAutomationPacks = automationMarketplacePacks.filter(automationMarketplaceInstalled);
  const backups = loadWorkspaceBackups();
  const hasPortableEvidence = Boolean(state.portableImportPreview)
    || backups.length > 0
    || state.auditEvents.some((event) => event.action === "workspace_export");
  return [
    {
      id: "template-project",
      eyebrow: "Step 1",
      title: "Create the client onboarding project",
      detail: installedMarketplaceTemplates.length
        ? `${installedMarketplaceTemplates.length} marketplace template${installedMarketplaceTemplates.length === 1 ? "" : "s"} installed`
        : "Use the Client Onboarding template to create the first real workspace",
      done: activeProjects().length > 0 && state.projectTemplates.length > 0,
      commandId: "template:recommended",
      actionLabel: "Start With Client Onboarding"
    },
    {
      id: "automation-pack",
      eyebrow: "Step 2",
      title: "Install the agency handoff workflow",
      detail: installedAutomationPacks.length
        ? `${installedAutomationPacks.length} automation pack${installedAutomationPacks.length === 1 ? "" : "s"} installed`
        : "Add approval follow-ups and weekly client-update drafting",
      done: installedAutomationPacks.length > 0 || state.automations.some((automation) => automation.source === "marketplace" || automation.source === "imported"),
      commandId: "automation:recommended",
      actionLabel: "Review Agency Handoff Pack"
    },
    {
      id: "portable-recovery",
      eyebrow: "Step 3",
      title: "Export the recovery bundle",
      detail: hasPortableEvidence
        ? "Portable recovery has local evidence"
        : "Prove the workspace can leave, restore, and survive a handoff",
      done: hasPortableEvidence,
      commandId: "recovery:plan",
      actionLabel: "Open Recovery Plan"
    }
  ];
}

function renderGoldenPathPanel() {
  const items = goldenPathItems();
  const doneCount = items.filter((item) => item.done).length;
  return `
    <section class="panel golden-path-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">First client workspace</p>
          <h2>Launch a real client workspace</h2>
        </div>
        <span class="status-pill ${doneCount === items.length ? "inbox-green" : "inbox-amber"}">${doneCount}/${items.length} ready</span>
      </div>
      <p class="panel-note">Agora’s first product spine is simple: create a client onboarding project, install the agency handoff workflow, then export a recovery bundle so the workspace is useful and portable on day one.</p>
      <div class="golden-path-grid">
        ${items.map((item) => `
          <article class="golden-path-card ${item.done ? "is-done" : "is-open"}">
            <span>${escapeHtml(item.eyebrow)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.detail)}</p>
            <button class="button button-secondary compact-button" type="button" data-command-id="${escapeHtml(item.commandId)}">${escapeHtml(item.actionLabel)}</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function activeTutorialStep() {
  const index = clamp(Number(state.tutorial?.step || 0), 0, tutorialSteps.length - 1);
  return {
    index,
    step: tutorialSteps[index]
  };
}

function renderTutorialOverlay() {
  if (!els.tutorialOverlay) return;
  const isActive = Boolean(state.tutorial?.active);
  document.body.dataset.tutorialTarget = isActive ? activeTutorialStep().step.target : "";
  document.body.classList.toggle("is-tutorial-active", isActive);

  if (!isActive) {
    els.tutorialOverlay.hidden = true;
    els.tutorialOverlay.innerHTML = "";
    return;
  }

  const { index, step } = activeTutorialStep();
  els.tutorialOverlay.hidden = false;
  els.tutorialOverlay.innerHTML = `
    <div class="tutorial-card" role="dialog" aria-label="Agora tutorial">
      <div class="tutorial-progress">
        <span>${index + 1}/${tutorialSteps.length}</span>
        <button class="icon-button" type="button" data-tutorial-action="close" aria-label="Close tutorial">x</button>
      </div>
      <p class="eyebrow">Tutorial mode</p>
      <h2>${escapeHtml(step.title)}</h2>
      <p>${escapeHtml(step.body)}</p>
      <div class="tutorial-actions">
        <button class="button button-secondary compact-button" type="button" data-tutorial-action="prev" ${index === 0 ? "disabled" : ""}>Back</button>
        <button class="button button-secondary compact-button" type="button" data-tutorial-action="restart">Restart</button>
        <button class="button button-primary compact-button" type="button" data-tutorial-action="${index === tutorialSteps.length - 1 ? "finish" : "next"}">${index === tutorialSteps.length - 1 ? "Done" : "Next"}</button>
      </div>
    </div>
  `;
}

function renderThemeOption(theme) {
  const active = state.workspace.theme?.preset === theme.id;
  const resolved = theme.id === "auto" ? `Currently ${themePresets.find((preset) => preset.id === resolvedWorkspaceThemePreset())?.label || "Agora"}` : theme.description;
  return `
    <label class="theme-option ${active ? "is-active" : ""}">
      <input type="radio" name="workspace-theme" value="${theme.id}" ${active ? "checked" : ""}>
      <span class="theme-swatches" aria-hidden="true">
        ${theme.swatches.map((color) => `<i style="background: ${color}"></i>`).join("")}
      </span>
      <strong>${escapeHtml(theme.label)}</strong>
      <small>${escapeHtml(resolved)}</small>
    </label>
  `;
}

function productionReadinessItems() {
  const hasApi = Boolean(apiSession);
  const health = backendHealth || apiSession?.backendHealth || {};
  const productionGates = Array.isArray(health.productionGates) ? health.productionGates : [];
  const failedProductionGates = productionGates.filter((gate) => !gate.done);
  return [
    {
      label: "Supabase or API connected",
      done: hasApi,
      detail: hasApi ? apiBackendLabel() : "Connect Settings to the API before production launch."
    },
    {
      label: "Backend health checked",
      done: Boolean(health.generatedAt || apiSession?.lastBackendCheckedAt),
      detail: health.generatedAt ? `Last checked ${formatTimestamp(health.generatedAt)}` : "Run Backend Health after connecting."
    },
    {
      label: "Hosted launch gates",
      done: productionGates.length > 0 && failedProductionGates.length === 0,
      detail: productionGates.length
        ? failedProductionGates.length
          ? `${failedProductionGates.length} gate${failedProductionGates.length === 1 ? "" : "s"} need attention`
          : `${productionGates.length} gates passing`
        : "Refresh Backend Health to inspect CORS, auth, reset, and proxy gates."
    },
    {
      label: "Auth driver selected",
      done: Boolean(health.auth || apiSession?.apiHealth?.auth),
      detail: health.auth || apiSession?.apiHealth?.auth || "Use local auth for dev or Supabase Auth for hosted installs."
    },
    {
      label: "Role model configured",
      done: state.memberships.length >= workspaceMembers().length && Boolean(state.workspace.defaultRole),
      detail: `${state.memberships.length} active memberships, default role ${state.workspace.defaultRole}.`
    },
    {
      label: "Data export path verified",
      done: state.tasks.length > 0 && state.projects.length > 0,
      detail: "JSON and CSV export are available from Data."
    },
    {
      label: "PWA shell ready",
      done: Boolean(navigator.serviceWorker),
      detail: pwaStatusLabel()
    },
    {
      label: "Theme selected",
      done: Boolean(state.workspace.theme?.preset),
      detail: `${themePresets.find((theme) => theme.id === state.workspace.theme?.preset)?.label || "Agora"} / ${state.workspace.theme?.density || "comfortable"}`
    }
  ];
}

function productionReadinessScore() {
  const items = productionReadinessItems();
  return {
    done: items.filter((item) => item.done).length,
    total: items.length
  };
}

function hostedLaunchRunbookItems() {
  const health = backendHealth || apiSession?.backendHealth || {};
  const productionGates = Array.isArray(health.productionGates) ? health.productionGates : [];
  const failedProductionGates = productionGates.filter((gate) => !gate.done);
  const publicUrlGate = productionGates.find((gate) => gate.id === "public-app-url");
  const publicFeatureGate = productionGates.find((gate) => gate.id === "public-feature-abuse");
  const recovery = portableRecoveryStatus();
  const payments = paymentSettings();
  return [
    {
      label: "Hosted environment",
      done: productionGates.length > 0 && failedProductionGates.length === 0,
      detail: productionGates.length ? `${productionGates.length - failedProductionGates.length}/${productionGates.length} backend gates passing.` : "Refresh Backend Health after sign-in."
    },
    {
      label: "Supabase persistence",
      done: Boolean(health.productionMode),
      detail: health.productionMode ? "Storage and Auth are both running in Supabase mode." : `${health.storage || "local"} storage / ${health.auth || "local"} auth.`
    },
    {
      label: "Public surface guarded",
      done: Boolean(publicUrlGate?.done && publicFeatureGate?.done),
      detail: publicFeatureGate?.detail || "Backend Health checks public URL and feedback limits."
    },
    {
      label: "Recovery bundle",
      done: recovery.score >= 3,
      detail: `${recovery.score}/4 recovery checks ready before cutover.`
    },
    {
      label: "Billing posture",
      done: Boolean(payments.planId),
      detail: `${paymentPlan(payments.planId).label} plan selected; provider is ${paymentProviderLabel(payments.provider)}.`
    }
  ];
}

function renderProductionReadinessPanel() {
  return `
    <div class="readiness-list">
      ${productionReadinessItems().map((item) => `
        <article class="readiness-item ${item.done ? "is-done" : "is-pending"}">
          <span>${item.done ? "OK" : "Next"}</span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.detail)}</p>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderHostedLaunchRunbookPanel() {
  const items = hostedLaunchRunbookItems();
  const doneCount = items.filter((item) => item.done).length;
  return `
    <div class="hosted-launch-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Hosted launch</p>
          <h3>Cutover runbook</h3>
        </div>
        <span class="status-pill ${doneCount === items.length ? "inbox-green" : "inbox-amber"}">${doneCount}/${items.length}</span>
      </div>
      <div class="hosted-launch-grid">
        ${items.map((item) => `
          <article class="${item.done ? "is-done" : "is-pending"}">
            <span>${item.done ? "OK" : "Next"}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </article>
        `).join("")}
      </div>
      <div class="hosted-launch-command">
        <code>npm run launch:check</code>
        <span>Run this after deployment, then verify desktop, phone, and tablet widths before inviting the first real team.</span>
      </div>
    </div>
  `;
}

function renderPermissionMatrix() {
  const permissions = [
    ["workspace:read", "Read workspace"],
    ["workspace:write", "Edit workspace"],
    ["members:write", "Manage members"],
    ["projects:write", "Manage projects"],
    ["tasks:write", "Manage tasks"],
    ["comments:write", "Comment"],
    ["time:write", "Log time"],
    ["approvals:write", "Approvals"],
    ["notifications:write", "Notification settings"],
    ["integrations:write", "Integrations"],
    ["scheduler:run", "Run scheduler"],
    ["payments:write", "Payments"],
    ["audit:read", "Audit log"]
  ];
  const rolePermissions = {
    admin: ["workspace:read", "workspace:write", "members:write", "projects:write", "tasks:write", "comments:write", "time:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write", "audit:read"],
    manager: ["workspace:read", "workspace:write", "projects:write", "tasks:write", "comments:write", "time:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write", "audit:read"],
    member: ["workspace:read", "comments:write", "time:write"],
    client: ["workspace:read", "comments:write", "approvals:write"]
  };

  return `
    <section class="panel permission-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Permissions</p>
          <h2>Role matrix</h2>
        </div>
      </div>
      <div class="permission-matrix" role="table" aria-label="Role permission matrix">
        <div class="permission-row permission-head" role="row">
          <span role="columnheader">Permission</span>
          ${workspaceRoles.map((role) => `<strong role="columnheader">${escapeHtml(role.label)}</strong>`).join("")}
        </div>
        ${permissions.map(([permission, label]) => `
          <div class="permission-row" role="row">
            <span role="rowheader">${escapeHtml(label)}</span>
            ${workspaceRoles.map((role) => `<span class="${rolePermissions[role.id]?.includes(permission) ? "is-allowed" : "is-denied"}">${rolePermissions[role.id]?.includes(permission) ? "Yes" : "No"}</span>`).join("")}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCurrentAccessPanel() {
  const role = workspaceRoles.find((item) => item.id === currentWorkspaceRole());
  const membership = currentMembership();
  const companyIds = currentCompanyAccess();
  const scopeLabel = companyIds.length
    ? companyIds.map(companyName).join(", ")
    : "Workspace-wide";
  const permissions = apiSession?.permissions || [
    "workspace:read",
    "workspace:write",
    "workspace:import",
    "audit:read",
    "members:write",
    "projects:write",
    "tasks:write",
    "time:write",
    "comments:write",
    "activity:write",
    "attachments:write",
    "approvals:write"
  ];

  return `
    <section class="panel access-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Session</p>
          <h2>Current access</h2>
        </div>
        <span class="status-pill ${apiSession ? "inbox-green" : "inbox-neutral"}">${apiSession ? "Signed in" : "Local admin"}</span>
      </div>
      <div class="access-summary-grid">
        <article>
          <span>User</span>
          <strong>${escapeHtml(apiSession?.user?.name || memberName(activeMemberId()))}</strong>
          <p>${escapeHtml(apiSession?.user?.email || "Browser-only session")}</p>
        </article>
        <article>
          <span>Role</span>
          <strong>${escapeHtml(role?.label || currentWorkspaceRole())}</strong>
          <p>${escapeHtml(role?.description || "Full prototype access while offline.")}</p>
        </article>
        <article>
          <span>Company scope</span>
          <strong>${escapeHtml(scopeLabel)}</strong>
          <p>${hasCompanyScope() ? "Navigation and work views are filtered to assigned companies." : "Can see all companies in this workspace."}</p>
        </article>
      </div>
      <div class="permission-chip-list" aria-label="Current session permissions">
        ${permissions.map((permission) => `<span class="status-pill inbox-neutral">${escapeHtml(permission)}</span>`).join("")}
      </div>
      ${membership?.invitedBy ? `<p class="settings-help">Invited by ${escapeHtml(memberName(membership.invitedBy))}${membership.joinedAt ? ` on ${escapeHtml(formatDate(membership.joinedAt.slice(0, 10)))}` : ""}.</p>` : ""}
    </section>
  `;
}

function renderApiAccountPanel() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Account</p>
          <h2>Identity and sign in</h2>
        </div>
        <span class="status-pill ${apiConnectionTone()}">${escapeHtml(apiStatusLabel())}</span>
      </div>
      <div class="api-sync-card">
        <div>
          <strong>${escapeHtml(apiConnectionLabel())}</strong>
          <p>${apiSession ? `${escapeHtml(realtimeStatusLabel())} - Last saved ${escapeHtml(apiLastSyncedLabel())}` : "Start the API server, create the workspace owner account, or connect as a demo member."}</p>
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
          <button class="button button-secondary" type="button" id="api-supabase-password-signup">Supabase Sign Up</button>
          <button class="button button-secondary" type="button" id="api-supabase-password-login">Supabase Sign In</button>
          <label>
            <span>Current password</span>
            <input id="api-current-password" type="password" placeholder="Current password">
          </label>
          <label>
            <span>New password</span>
            <input id="api-new-password" type="password" placeholder="8+ characters">
          </label>
          <button class="button button-secondary" type="button" id="api-password-change" ${apiSession ? "" : "disabled"}>Change Password</button>
          <label>
            <span>Reset email</span>
            <input id="api-reset-email" type="email" placeholder="teammate@company.com">
          </label>
          <label>
            <span>Reset token</span>
            <input id="api-reset-token" placeholder="Paste token">
          </label>
          <label>
            <span>Reset password</span>
            <input id="api-reset-password" type="password" placeholder="8+ characters">
          </label>
          <button class="button button-secondary" type="button" id="api-password-reset-request">Request Reset</button>
          <button class="button button-secondary" type="button" id="api-password-reset-confirm">Confirm Reset</button>
          <label class="wide-field">
            <span>Supabase access token</span>
            <textarea id="api-supabase-token" rows="2" placeholder="Advanced: paste a Supabase Auth access_token"></textarea>
          </label>
          <button class="button button-secondary" type="button" id="api-supabase-login">Use Supabase Token</button>
          <label>
            <span>Demo member</span>
            <select id="api-member">
              ${members.map((member) => `<option value="${member.id}" ${member.id === (apiSession?.user?.id || currentMemberId) ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
            </select>
          </label>
          <button class="button button-primary" type="button" id="api-connect">${apiSession ? "Switch User" : "Connect to API"}</button>
          <button class="button button-secondary" type="button" id="api-disconnect" ${apiSession ? "" : "disabled"}>Disconnect</button>
        </div>
      </div>
    </section>
  `;
}

function renderApiStatePanel() {
  const recordSourceLabel = apiSession ? "API records" : "Browser snapshot";
  const syncSources = [
    { label: "Companies", count: state.companies.length, source: "/api/records", detail: "Company records and scopes." },
    { label: "Projects", count: state.projects.length, source: "/api/projects", detail: "Project metadata and company ownership." },
    { label: "Tasks", count: state.tasks.length, source: "/api/tasks", detail: "Task CRUD, assignments, status, dates, and custom fields." },
    {
      label: "Collaboration",
      count: state.comments.length + state.activities.length + state.documents.length + state.files.length + state.timeEntries.length,
      source: "/api/records",
      detail: "Comments, activity, docs, files, time, approvals, and presence."
    },
    { label: "Snapshot", count: 1, source: "/api/workspace", detail: "Portable whole-workspace save and restore path." }
  ];
  const checkedAt = backendHealth?.generatedAt || apiSession?.lastBackendCheckedAt || "";

  return `
    <section class="panel api-state-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Source of truth</p>
          <h2>API state</h2>
        </div>
        <span class="status-pill ${apiConnectionTone()}">${escapeHtml(apiBackendLabel())}</span>
      </div>
      <div class="api-state-grid">
        <article>
          <span>Connection</span>
          <strong>${escapeHtml(offlineCapabilityLabel())}</strong>
          <p>${escapeHtml(offlineCapabilityDetail())}</p>
        </article>
        <article>
          <span>Writes</span>
          <strong>${canSaveWholeWorkspace() ? "Whole workspace" : apiSession ? "Scoped session" : "Local only"}</strong>
          <p>${canSaveWholeWorkspace() ? "Save to API is enabled, with local changes retained on this device." : apiSession ? "Create and update individual records; failed API writes enter the local retry queue." : "Create, edit, export, and import without a backend connection."}</p>
        </article>
        <article>
          <span>Queue</span>
          <strong>${apiSyncQueue.length ? `${apiSyncQueue.length} pending` : "Clear"}</strong>
          <p>${apiSyncQueue.length ? "Retry after the API is healthy or the network returns." : "No failed syncs are waiting."}</p>
        </article>
        <article>
          <span>Health check</span>
          <strong>${checkedAt ? escapeHtml(formatTimestamp(checkedAt)) : "Not checked"}</strong>
          <p>${backendHealth?.productionMode ? "Production mode is ready." : "Refresh backend health for the latest server report."}</p>
        </article>
        <article>
          <span>App shell</span>
          <strong>${window.AGORA_DESKTOP?.offlineCapable ? "Bundled Mac app" : "Installable PWA"}</strong>
          <p>${window.AGORA_DESKTOP?.offlineCapable ? "Packaged assets launch without internet. API sync remains optional." : "Service worker caches the app shell for home-screen and offline reloads."}</p>
        </article>
      </div>
      <div class="source-list">
        ${syncSources.map((source) => `
          <article class="source-row">
            <div>
              <strong>${escapeHtml(source.label)}</strong>
              <p>${escapeHtml(source.detail)}</p>
            </div>
            <span>${Number(source.count).toLocaleString()}</span>
            <code>${escapeHtml(apiSession ? source.source : recordSourceLabel)}</code>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderApiSyncQueueItem(item) {
  const queued = queuedSyncRecord(item);
  const conflict = item.status === "conflict" && item.conflict;
  return `
    <article class="${conflict ? "is-conflict" : ""}">
      <div>
        <strong>${escapeHtml(item.label || item.path)}</strong>
        <p>${escapeHtml(item.error)} - ${escapeHtml(formatTimestamp(item.updatedAt))}</p>
        ${queued?.record ? `<small>${escapeHtml(queued.collection)} / ${escapeHtml(queued.record.title || queued.record.name || queued.record.id)}</small>` : ""}
        ${conflict ? `
          <small>Local ${escapeHtml(formatTimestamp(conflict.localRevision || recordRevisionValue(conflict.local)))} / Server ${escapeHtml(formatTimestamp(conflict.remoteRevision || recordRevisionValue(conflict.remote)))}</small>
        ` : ""}
      </div>
      ${conflict ? `
        <div class="sync-conflict-actions">
          <button class="button button-secondary compact-button" type="button" data-sync-conflict="local" data-sync-id="${escapeHtml(item.id)}">Keep Local</button>
          <button class="button button-secondary compact-button" type="button" data-sync-conflict="server" data-sync-id="${escapeHtml(item.id)}">Use Server</button>
          <button class="button button-secondary compact-button" type="button" data-sync-conflict="drop" data-sync-id="${escapeHtml(item.id)}">Drop</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderApiSyncPanel() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Sync</p>
          <h2>Save, load, and repair</h2>
        </div>
        <span class="status-pill ${apiConnectionTone()}">${escapeHtml(apiStatusLabel())}</span>
      </div>
      <div class="api-sync-card">
        <div>
          <strong>${escapeHtml(apiConnectionLabel())}</strong>
          <p>${apiSession ? `${escapeHtml(realtimeStatusLabel())} - Last saved ${escapeHtml(apiLastSyncedLabel())}` : "Connect an account before saving or loading backend workspace data."}</p>
        </div>
        <div class="data-actions">
          <button class="button button-primary" type="button" id="api-load-workspace" ${apiSession ? "" : "disabled"}>Load Records</button>
          <button class="button button-secondary" type="button" id="api-save-workspace" ${canSaveWholeWorkspace() ? "" : "disabled"}>Save Snapshot</button>
          <button class="button button-secondary" type="button" id="api-restore-workspace-snapshot" ${apiSession ? "" : "disabled"}>Restore Snapshot</button>
          <button class="button button-secondary" type="button" id="api-sync-retry" ${apiSession && apiSyncQueue.length ? "" : "disabled"}>Retry Failed Syncs</button>
          <button class="button button-secondary" type="button" id="backend-health-refresh" ${apiSession ? "" : "disabled"}>Refresh Health</button>
        </div>
      </div>
      ${apiSyncQueue.length ? `
        <div class="sync-queue-list">
          ${apiSyncQueue.slice(0, 5).map(renderApiSyncQueueItem).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderAiProviderChecklist(ai) {
  const items = [
    {
      label: "Provider mode",
      done: Boolean(ai.provider),
      detail: aiProviderLabel()
    },
    {
      label: "Model name",
      done: Boolean(ai.model),
      detail: ai.model || "Choose the model your server adapter should call."
    },
    {
      label: "Server-held key",
      done: ai.provider === "local" || ai.keySource === "Server environment" || ai.keySource === "Self-hosted secret store",
      detail: ai.provider === "local" ? "No key needed for deterministic local mode." : "Keep provider secrets out of the browser."
    },
    {
      label: "Base URL",
      done: ai.provider === "local" || Boolean(ai.baseUrl),
      detail: ai.baseUrl || "Use the API server default unless a provider needs a custom endpoint."
    }
  ];

  return `
    <div class="readiness-list compact-readiness">
      ${items.map((item) => `
        <article class="readiness-item ${item.done ? "is-done" : "is-pending"}">
          <span>${item.done ? "OK" : "Next"}</span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.detail)}</p>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPaymentsSettingsPanel(payments) {
  const canManagePayments = canWrite("payments:write");
  const currentPlan = paymentPlan(payments.planId);
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Plans</p>
          <h2>Billing catalog</h2>
        </div>
        <span class="status-pill inbox-blue">${escapeHtml(currentPlan.label)}</span>
      </div>
      ${renderPaymentPlanCatalog(payments)}
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Payments</p>
          <h2>Provider foundation</h2>
        </div>
        <span class="status-pill ${payments.provider === "none" ? "inbox-neutral" : "inbox-blue"}">${escapeHtml(paymentProviderLabel(payments.provider))}</span>
      </div>
      <div class="settings-form">
        <label>
          <span>Plan</span>
          <select id="payment-plan" ${canManagePayments ? "" : "disabled"}>
            ${paymentPlanOptions.map((option) => `<option value="${option.id}" ${option.id === payments.planId ? "selected" : ""}>${escapeHtml(option.label)} - ${escapeHtml(option.priceLabel)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Provider</span>
          <select id="payment-provider" ${canManagePayments ? "" : "disabled"}>
            ${paymentProviderOptions.map((option) => `<option value="${option.id}" ${option.id === payments.provider ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Currency</span>
          <select id="payment-currency" ${canManagePayments ? "" : "disabled"}>
            ${paymentCurrencyOptions.map((option) => `<option value="${option}" ${option === payments.currency ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Spend cap</span>
          <input id="payment-spending-cap" type="number" min="0" step="0.01" value="${escapeHtml(paymentDollarsInputValue(payments.spendingCapCents))}" ${canManagePayments ? "" : "disabled"}>
        </label>
        <label>
          <span>Mode</span>
          <input value="${payments.provider === "none" ? "Planning only" : "Provider configured"}" disabled>
        </label>
        <label class="toggle-row">
          <input id="payment-marketplace" type="checkbox" ${payments.marketplacePayments ? "checked" : ""} ${canManagePayments ? "" : "disabled"}>
          <span>Enable paid marketplace templates</span>
        </label>
        <label class="toggle-row">
          <input id="payment-client-portal" type="checkbox" ${payments.clientPortalPayments ? "checked" : ""} ${canManagePayments ? "" : "disabled"}>
          <span>Enable client portal payments</span>
        </label>
        <label class="toggle-row">
          <input id="payment-agent-spend" type="checkbox" ${payments.agentPayments ? "checked" : ""} ${canManagePayments ? "" : "disabled"}>
          <span>Allow capped agent/tool spend</span>
        </label>
        <label class="toggle-row">
          <input id="payment-x402-experimental" type="checkbox" ${payments.x402Experimental ? "checked" : ""} ${canManagePayments ? "" : "disabled"}>
          <span>x402 experimental mode</span>
        </label>
        <p class="settings-help">Payment providers are configuration only in this prototype. Keep provider secrets on the API server, require caps for automated spend, and treat x402 as experimental until the server adapter is implemented.</p>
        ${renderPaymentsChecklist(payments)}
        <button class="button button-primary" type="button" id="payments-save" ${canManagePayments ? "" : "disabled"}>Save Payment Settings</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Ledger</p>
          <h2>Payment audit</h2>
        </div>
        <button class="button button-secondary compact-button" type="button" id="payment-test-event" ${payments.provider === "none" || !canManagePayments ? "disabled" : ""}>Record Test</button>
      </div>
      <div class="payment-audit-list">
        ${payments.audit.length ? payments.audit.map(renderPaymentAuditEvent).join("") : emptyState("No payment events yet.")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Access</p>
          <h2>Entitlements</h2>
        </div>
        <span class="status-pill inbox-neutral">${payments.entitlements.filter((entitlement) => entitlementIsActive(entitlement)).length} active</span>
      </div>
      ${renderEntitlementGrantForm(payments)}
      <div class="payment-entitlement-list">
        ${payments.entitlements.length ? payments.entitlements.map(renderPaymentEntitlement).join("") : emptyState("No paid feature or template access has been granted yet.")}
      </div>
    </section>
  `;
}

function renderPaymentPlanCatalog(payments) {
  const usage = paymentUsageSnapshot(payments);
  return `
    <div class="payment-plan-grid">
      ${paymentPlanOptions.map((plan) => {
        const selected = plan.id === payments.planId;
        return `
          <article class="payment-plan-card ${selected ? "is-selected" : ""}">
            <div class="payment-plan-card-header">
              <div>
                <strong>${escapeHtml(plan.label)}</strong>
                <span>${escapeHtml(plan.description)}</span>
              </div>
              <b>${escapeHtml(plan.priceLabel)}</b>
            </div>
            <div class="payment-limit-list">
              ${renderPaymentLimit("Members", usage.members, plan.limits.members)}
              ${renderPaymentLimit("Active projects", usage.projects, plan.limits.projects)}
              ${renderPaymentLimit("Paid grants", usage.entitlements, plan.limits.entitlements)}
            </div>
            <div class="payment-plan-features">
              ${plan.features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join("")}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderPaymentLimit(label, used, limit) {
  const percent = paymentLimitPercent(used, limit);
  return `
    <div class="payment-limit-row">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(paymentLimitStatus(used, limit))}</strong>
      </div>
      <i style="--limit-percent: ${percent}%"></i>
    </div>
  `;
}

function renderPaymentsChecklist(payments) {
  const providerActive = payments.provider !== "none";
  const plan = paymentPlan(payments.planId);
  const items = [
    {
      label: "Plan selected",
      done: Boolean(plan),
      detail: `${plan.label} catalog limits are visible before provider wiring.`
    },
    {
      label: "Provider chosen",
      done: providerActive,
      detail: providerActive ? paymentProviderLabel(payments.provider) : "Payments are disabled by default."
    },
    {
      label: "Server-held secrets",
      done: payments.provider === "none" || payments.provider === "manual",
      detail: payments.provider === "none" ? "No secret needed yet." : "Wire secrets through the API server before live charges."
    },
    {
      label: "Spend cap",
      done: !payments.agentPayments || payments.spendingCapCents > 0,
      detail: payments.spendingCapCents ? `${formatPaymentAmount(payments.spendingCapCents, payments.currency)} cap` : "Set a cap before agent/tool spend."
    },
    {
      label: "x402 lab gate",
      done: payments.provider !== "x402" || payments.x402Experimental,
      detail: payments.provider === "x402" ? "Experimental mode must stay explicit." : "Only needed for x402 experiments."
    }
  ];

  return `
    <div class="readiness-list compact-readiness">
      ${items.map((item) => `
        <article class="readiness-item ${item.done ? "is-done" : "is-pending"}">
          <span>${item.done ? "OK" : "Next"}</span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.detail)}</p>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPaymentAuditEvent(event) {
  return `
    <article class="payment-audit-event">
      <div>
        <strong>${escapeHtml(event.action.replaceAll("_", " "))}</strong>
        <p>${escapeHtml(event.note || paymentProviderLabel(event.provider))}</p>
      </div>
      <div>
        <span class="status-pill inbox-neutral">${escapeHtml(event.status)}</span>
        <span>${escapeHtml(formatPaymentAmount(event.amountCents, event.currency))}</span>
        <small>${escapeHtml(formatTimestamp(event.createdAt))}</small>
      </div>
    </article>
  `;
}

function renderEntitlementGrantForm(payments) {
  const templates = paidMarketplaceTemplates();
  const hasLockedTemplates = templates.some((template) => !hasEntitlementForItem("project-template", template.id));
  const canManagePayments = canWrite("payments:write");
  const grantHelp = apiSession
    ? "API-connected grants create a server checkout intent, complete it through the test/manual adapter, and store a server-issued entitlement."
    : "Offline test grants unlock gated marketplace items locally and record a payment audit event without moving money.";
  if (!templates.length) {
    return `<p class="settings-help">Paid marketplace templates will appear here once the marketplace includes premium packs.</p>`;
  }
  return `
    <div class="entitlement-grant-form">
      <label>
        <span>Grant access to</span>
        <select id="entitlement-template" ${canManagePayments ? "" : "disabled"}>
          ${templates.map((template) => {
            const unlocked = hasEntitlementForItem("project-template", template.id);
            return `<option value="${template.id}" ${unlocked ? "disabled" : ""}>${escapeHtml(template.name)} - ${escapeHtml(marketplaceTemplatePriceLabel(template))}${unlocked ? " - unlocked" : ""}</option>`;
          }).join("")}
        </select>
      </label>
      <label>
        <span>Grant source</span>
        <select id="entitlement-source" ${canManagePayments ? "" : "disabled"}>
          ${entitlementSourceOptions.map((option) => `<option value="${option.id}" ${option.id === "test" ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <button class="button button-secondary" type="button" id="payment-grant-entitlement" ${hasLockedTemplates && canManagePayments ? "" : "disabled"}>Grant Access</button>
    </div>
    <p class="settings-help">${escapeHtml(grantHelp)}</p>
  `;
}

function renderPaymentEntitlement(entitlement) {
  const active = entitlementIsActive(entitlement);
  return `
    <article class="payment-entitlement">
      <div>
        <strong>${escapeHtml(entitlementItemLabel(entitlement))}</strong>
        <p>${escapeHtml(entitlement.note || `${entitlementSourceLabel(entitlement.source)} access`)}</p>
      </div>
      <div>
        <span class="status-pill ${active ? "inbox-green" : "inbox-neutral"}">${active ? "Active" : escapeHtml(entitlement.status)}</span>
        <span>${escapeHtml(formatPaymentAmount(entitlement.amountCents, entitlement.currency))}</span>
        <small>${escapeHtml(formatTimestamp(entitlement.grantedAt))}</small>
      </div>
    </article>
  `;
}

function integrationSettings() {
  return normalizeWorkspaceIntegrations(state.workspace?.integrations);
}

function integrationStatusLabel(status) {
  return integrationStatuses.find((option) => option.id === status)?.label || "Planned";
}

function integrationSyncLabel(syncMode) {
  return integrationSyncModes.find((option) => option.id === syncMode)?.label || "No sync";
}

function renderIntegrationsHubPanel() {
  const integrations = integrationSettings();
  const canManageIntegrations = canWrite("integrations:write");
  const connected = integrations.connections.filter((connection) => connection.status === "connected");
  const planned = integrations.connections.filter((connection) => connection.status === "planned");
  const outbound = integrations.connections.filter((connection) => connection.syncMode === "outbound" || connection.syncMode === "two-way");
  const healthy = integrations.connections.filter((connection) => connection.health === "healthy");
  return `
    <section class="panel integrations-hub-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Integrations</p>
          <h2>Connected tools</h2>
        </div>
        <span class="status-pill ${connected.length ? "inbox-green" : "inbox-neutral"}">${connected.length}/${integrationCatalog.length} connected</span>
      </div>
      <div class="integration-summary-grid">
        ${metric("Connected", connected.length)}
        ${metric("Planned", planned.length)}
        ${metric("Outbound", outbound.length)}
        ${metric("Healthy", healthy.length)}
      </div>
      <div class="settings-form integrations-admin-form">
        <label>
          <span>Default owner</span>
          <select id="integration-default-owner">
            ${workspaceMembers().map((member) => `<option value="${member.id}" ${member.id === integrations.defaultOwner ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Webhook endpoint</span>
          <input id="integration-webhook-endpoint" value="${escapeHtml(integrations.webhookEndpoint)}" placeholder="https://hooks.example.com/agora">
        </label>
        <label class="toggle-row">
          <input id="integration-api-access" type="checkbox" ${integrations.apiAccess ? "checked" : ""}>
          <span>Enable API adapter access</span>
        </label>
        <label class="toggle-row">
          <input id="integration-event-mirroring" type="checkbox" ${integrations.eventMirroring ? "checked" : ""}>
          <span>Mirror workspace events to integrations</span>
        </label>
      </div>
      ${renderNotificationDeliveryIntegrationPanel()}
      <div class="integration-grid">
        ${integrationCatalog.map((catalogItem) => renderIntegrationCard(catalogItem, integrations.connections.find((connection) => connection.id === catalogItem.id))).join("")}
      </div>
      <div class="integration-action-row">
        <button class="button button-secondary" type="button" id="integration-test-event" ${canManageIntegrations ? "" : "disabled"}>Log Test Event</button>
        <button class="button button-primary" type="button" id="integrations-save" ${canManageIntegrations ? "" : "disabled"}>Save Integrations</button>
      </div>
    </section>
  `;
}

function renderNotificationDeliveryIntegrationPanel() {
  const settings = notificationSettings();
  const canManageNotifications = canWrite("notifications:write");
  const payloadPreview = {
    source: "agora",
    type: "notification_digest",
    workspaceId: state.workspace.id,
    channels: notificationDeliveryChannels(settings),
    createdAt: new Date().toISOString()
  };
  return `
    <section class="notification-delivery-integration">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Notification delivery</p>
          <h2>Webhook and email handoff</h2>
        </div>
        <span class="status-pill ${settings.channels.webhook || settings.channels.email ? "inbox-green" : "inbox-neutral"}">${escapeHtml(notificationDeliveryChannels(settings))}</span>
      </div>
      <div class="notification-delivery-grid">
        <label>
          <span>Webhook URL</span>
          <input id="notification-webhook-url" type="url" value="${escapeHtml(settings.delivery.webhookUrl)}" placeholder="https://hooks.example.com/agora" ${canManageNotifications ? "" : "disabled"}>
        </label>
        <label>
          <span>Email recipient</span>
          <input id="notification-email-address" type="email" value="${escapeHtml(settings.delivery.emailAddress)}" placeholder="ops@example.com" ${canManageNotifications ? "" : "disabled"}>
        </label>
        <label class="checkbox-label notification-resolved-toggle">
          <input type="checkbox" id="notification-send-resolved" ${settings.delivery.sendResolved ? "checked" : ""} ${canManageNotifications ? "" : "disabled"}>
          <span>Include resolved items in delivery payloads</span>
        </label>
        <button class="button button-primary compact-button" type="button" id="notification-save-delivery" ${canManageNotifications ? "" : "disabled"}>Save Delivery</button>
      </div>
      <div class="notification-delivery-preview">
        <div>
          <strong>Server handoff contract</strong>
          <p>Agora prepares webhook and email payloads locally. A self-hosted worker can POST the copied payload or mail it through your provider.</p>
        </div>
        <pre>${escapeHtml(JSON.stringify(payloadPreview, null, 2))}</pre>
      </div>
    </section>
  `;
}

function renderIntegrationCard(catalogItem, connection = {}) {
  const status = connection.status || "planned";
  const syncMode = connection.syncMode || "none";
  const owner = connection.owner || integrationSettings().defaultOwner;
  const statusClass = status === "connected" ? "inbox-green" : status === "paused" ? "inbox-amber" : "inbox-neutral";
  const healthClass = connection.health === "healthy" ? "inbox-green" : connection.health === "error" ? "inbox-red" : connection.health === "needs-config" ? "inbox-amber" : "inbox-neutral";
  const events = Array.isArray(connection.events) ? connection.events : ["task.updated"];
  return `
    <article class="integration-card">
      <div class="integration-card-header">
        <div>
          <span>${escapeHtml(catalogItem.category)}</span>
          <h3>${escapeHtml(catalogItem.name)}</h3>
        </div>
        <span class="status-pill ${statusClass}">${escapeHtml(integrationStatusLabel(status))}</span>
      </div>
      <p>${escapeHtml(catalogItem.description)}</p>
      <div class="integration-health-row">
        <span class="status-pill ${healthClass}">${escapeHtml(connection.health || "planned")}</span>
        <span>${escapeHtml(connection.secretStatus || "missing")} secret</span>
        <span>${events.length} events</span>
      </div>
      <div class="integration-signal-list">
        ${catalogItem.signals.map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}
      </div>
      <div class="integration-control-grid">
        <label>
          <span>Status</span>
          <select data-integration-status="${catalogItem.id}">
            ${integrationStatuses.map((option) => `<option value="${option.id}" ${option.id === status ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sync</span>
          <select data-integration-sync="${catalogItem.id}">
            ${integrationSyncModes.map((option) => `<option value="${option.id}" ${option.id === syncMode ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Owner</span>
          <select data-integration-owner="${catalogItem.id}">
            <option value="">Unassigned</option>
            ${workspaceMembers().map((member) => `<option value="${member.id}" ${member.id === owner ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Notes</span>
          <input data-integration-notes="${catalogItem.id}" value="${escapeHtml(connection.notes || "")}" placeholder="Adapter notes">
        </label>
        <label>
          <span>Health</span>
          <select data-integration-health="${catalogItem.id}">
            ${["planned", "needs-config", "healthy", "error"].map((option) => `<option value="${option}" ${option === connection.health ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Secret</span>
          <select data-integration-secret="${catalogItem.id}">
            ${["missing", "configured", "not-required"].map((option) => `<option value="${option}" ${option === connection.secretStatus ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="integration-event-grid">
        ${integrationEventOptions.map((eventName) => `
          <label class="checkbox-label">
            <input type="checkbox" data-integration-event="${catalogItem.id}" value="${eventName}" ${events.includes(eventName) ? "checked" : ""}>
            <span>${escapeHtml(eventName)}</span>
          </label>
        `).join("")}
      </div>
      <small>${connection.lastSyncedAt ? `Last synced ${escapeHtml(formatTimestamp(connection.lastSyncedAt))}` : `${escapeHtml(integrationSyncLabel(syncMode))} adapter not synced yet`}</small>
    </article>
  `;
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

function aiSettings() {
  const settings = {
    ...seedData.workspace.ai,
    ...(state.workspace.ai || {})
  };
  return {
    ...settings,
    permissions: normalizeAiPermissions(settings.permissions)
  };
}

function aiProviderLabel() {
  const settings = aiSettings();
  return settings.provider === "local"
    ? "Local deterministic"
    : `${settings.provider}${settings.model ? ` / ${settings.model}` : ""}`;
}

function aiProviderNeedsApi() {
  return aiSettings().provider !== "local";
}

function aiConnectionSummary() {
  if (!aiProviderNeedsApi()) return "Local operator";
  if (!apiSession) return "Connect API to use provider";
  return "Server adapter ready";
}

function operatorPermissions() {
  return aiSettings().permissions;
}

function operatorPermissionSummary() {
  const permissions = operatorPermissions();
  const allowed = aiPermissionOptions.filter((option) => permissions[option.id]);
  return `${allowed.length}/${aiPermissionOptions.length} allowed`;
}

function canOperatorApplyType(type) {
  const permissions = operatorPermissions();
  if (type === "task" || type === "approval_chase") return permissions.createTasks;
  if (type === "approval_request") return permissions.manageApprovals;
  if (type === "client_update") return permissions.editDocs && permissions.readClientData;
  if (type === "plan") return permissions.planToday;
  if (type === "integration_digest" || type === "command_integration-digest") return permissions.integrationEvents;
  return true;
}

function aiOperatorTrustState() {
  const settings = aiSettings();
  return {
    provider: settings.provider,
    providerLabel: aiProviderLabel(),
    model: settings.model || "Not set",
    baseUrl: settings.baseUrl || "Server default",
    keySource: settings.keySource,
    dataPolicy: settings.dataPolicy,
    promptTemplate: settings.promptTemplate,
    auditMode: settings.auditMode,
    connection: aiConnectionSummary(),
    externalProvider: aiProviderNeedsApi(),
    serverSideSecretsOnly: settings.provider === "local" || settings.keySource !== "Browser",
    actionLedgerEntries: recentOperatorActions(50).length,
    permissions: normalizeAiPermissions(settings.permissions),
    permissionSummary: operatorPermissionSummary()
  };
}

function operatorContextBundle() {
  const context = workspaceAiContext();
  const permissions = operatorPermissions();
  return {
    type: "agora.ai-operator-context",
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: {
      id: state.workspace.id,
      name: state.workspace.name,
      slug: state.workspace.slug
    },
    trust: aiOperatorTrustState(),
    sources: operatorDataSourcesFor("workspace_brief"),
    visibleContext: {
      brief: context.brief,
      tasks: context.tasks,
      approvals: permissions.manageApprovals && permissions.readClientData ? context.approvals : [],
      activities: context.activities,
      documents: permissions.editDocs ? context.documents.filter((document) => permissions.readClientData || projectCompany(document.projectId)?.type !== "Client") : []
    },
    actionLedger: recentOperatorActions(50),
    generatedDocs: recentOperatorDocuments(12)
  };
}

function downloadOperatorContextBundle() {
  downloadJsonFile(`${slugFromName(state.workspace.name)}-operator-context-${todayKey()}.json`, JSON.stringify(operatorContextBundle(), null, 2));
  showToast("Operator context exported", "success");
}

function enableLocalOperatorMode() {
  state.workspace = {
    ...state.workspace,
    ai: {
      ...aiSettings(),
      provider: "local",
      model: "Agora deterministic operator",
      baseUrl: "",
      keySource: "Not required",
      dataPolicy: "No external AI",
      auditMode: "Preview, rationale, undo"
    }
  };
  addAuditEvent({
    action: "ai_operator_local_mode",
    detail: "Switched the AI Operator to local deterministic mode"
  });
  saveState();
  render();
  showToast("Local operator mode enabled", "success");
}

function saveOperatorPermissions() {
  const permissions = { ...operatorPermissions() };
  document.querySelectorAll("[data-operator-permission]").forEach((input) => {
    permissions[input.dataset.operatorPermission] = Boolean(input.checked);
  });
  state.workspace = {
    ...state.workspace,
    ai: {
      ...aiSettings(),
      permissions: normalizeAiPermissions(permissions)
    }
  };
  addAuditEvent({
    action: "ai_operator_permissions_update",
    detail: `Updated Operator permissions: ${operatorPermissionSummary()}`
  });
  saveState();
  render();
  showToast("Operator permissions saved", "success");
}

function applyOperatorPermissionPreset(presetId) {
  const preset = aiPermissionPresets.find((item) => item.id === presetId);
  if (!preset) return;
  state.workspace = {
    ...state.workspace,
    ai: {
      ...aiSettings(),
      permissions: normalizeAiPermissions(preset.permissions)
    }
  };
  addAuditEvent({
    action: "ai_operator_permission_preset",
    detail: `Applied ${preset.label} Operator permission preset`
  });
  saveState();
  render();
  showToast(`${preset.label} preset applied`, "success");
}

function paymentSettings() {
  return normalizeWorkspacePayments(state.workspace?.payments);
}

function paymentPlan(planId = paymentSettings().planId) {
  return paymentPlanOptions.find((plan) => plan.id === planId) || paymentPlanOptions[0];
}

function paymentUsageSnapshot(payments = paymentSettings()) {
  return {
    members: Array.isArray(members) ? members.length : 0,
    projects: activeProjects().length,
    entitlements: payments.entitlements.filter((entitlement) => entitlementIsActive(entitlement)).length
  };
}

function paymentLimitStatus(used, limit) {
  if (limit === null || limit === undefined) return "Unlimited";
  return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
}

function paymentLimitPercent(used, limit) {
  if (!limit) return 100;
  return clamp(Math.round((used / limit) * 100), 0, 100);
}

function paymentEntitlements() {
  return paymentSettings().entitlements;
}

function entitlementSourceLabel(source) {
  return entitlementSourceOptions.find((option) => option.id === source)?.label || "Manual grant";
}

function entitlementItemLabel(entitlement) {
  if (entitlement.itemType === "project-template") {
    return byId(state.projectTemplates, entitlement.itemId)?.name
      || marketplaceProjectTemplates.find((template) => template.id === entitlement.itemId)?.name
      || entitlement.itemId;
  }
  return entitlement.itemId.replaceAll("-", " ");
}

function entitlementIsActive(entitlement, now = new Date()) {
  if (!entitlement || entitlement.status !== "active") return false;
  if (!entitlement.expiresAt) return true;
  return new Date(entitlement.expiresAt).getTime() > now.getTime();
}

function entitlementForItem(itemType, itemId) {
  return paymentEntitlements().find((entitlement) => entitlement.itemType === itemType && entitlement.itemId === itemId && entitlementIsActive(entitlement));
}

function hasEntitlementForItem(itemType, itemId) {
  return Boolean(entitlementForItem(itemType, itemId));
}

function paymentProviderLabel(provider = paymentSettings().provider) {
  return paymentProviderOptions.find((option) => option.id === provider)?.label || "Disabled";
}

function formatPaymentAmount(cents = 0, currency = "USD") {
  if (currency === "USDC") return `${(Number(cents) / 100).toFixed(2)} USDC`;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((Number(cents) || 0) / 100);
  } catch {
    return `${((Number(cents) || 0) / 100).toFixed(2)} ${currency}`;
  }
}

function paymentDollarsInputValue(cents = 0) {
  const value = (Number(cents) || 0) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function marketplaceTemplatePrice(template) {
  return {
    cents: Math.max(0, Math.round(Number(template.priceCents) || 0)),
    currency: paymentCurrencyOptions.includes(template.currency) ? template.currency : "USD"
  };
}

function marketplaceTemplatePriceLabel(template) {
  const price = marketplaceTemplatePrice(template);
  return price.cents ? formatPaymentAmount(price.cents, price.currency) : "Free";
}

function templatePayoutSettings(template) {
  return normalizeTemplatePayout(template);
}

function templateCreatorLabel(template) {
  return template.creatorName || memberName(template.owner) || "Community creator";
}

function templatePayoutModeLabel(mode) {
  return templatePayoutModes.find((option) => option.id === mode)?.label || "Creator wallet";
}

function templatePayoutLabel(template) {
  if (!marketplaceTemplatePrice(template).cents) return "Free template";
  const payout = templatePayoutSettings(template);
  if (payout.mode === "charity") return `Fees to ${payout.charityName || payout.recipientName || "charity"}`;
  if (payout.mode === "split") return `${payout.donationPercent}% to ${payout.charityName || "charity"}`;
  return `Fees to ${payout.recipientName || "creator"}`;
}

function templateWalletLabel(template) {
  const payout = templatePayoutSettings(template);
  if (!payout.walletAddress) return "Wallet not set";
  return `${payout.chain || "Wallet"} / ${payout.walletAddress}`;
}

function marketplaceTemplateRequiresEntitlement(template) {
  return marketplaceTemplatePrice(template).cents > 0;
}

function marketplaceTemplateIsUnlocked(template) {
  return !marketplaceTemplateRequiresEntitlement(template) || hasEntitlementForItem("project-template", template.id);
}

function paidMarketplaceTemplates() {
  return marketplaceProjectTemplates.filter(marketplaceTemplateRequiresEntitlement);
}

function templateTrustWarnings(template) {
  const warnings = [];
  const price = marketplaceTemplatePrice(template);
  const payout = templatePayoutSettings(template);
  if (!template.creatorName) warnings.push("Creator name missing");
  if (price.cents && !payout.walletAddress) warnings.push("Paid template has no payout wallet");
  if (!Array.isArray(template.tasks) || !template.tasks.length) warnings.push("No tasks included");
  if (!template.description) warnings.push("Description missing");
  return warnings;
}

function automationPackTrustWarnings(pack) {
  const warnings = [];
  if (!pack.creatorName) warnings.push("Creator name missing");
  if (!pack.license) warnings.push("License missing");
  if (!Array.isArray(pack.rules) || !pack.rules.length) warnings.push("No rules included");
  return warnings;
}

async function requestAiOperator(mode, context) {
  return apiRequest("/api/ai/operator", {
    method: "POST",
    body: {
      mode,
      settings: aiSettings(),
      context
    }
  });
}

async function runAiOperator(mode, context, fallbackBody) {
  if (!aiProviderNeedsApi()) {
    return {
      provider: aiProviderLabel(),
      title: aiTitleForMode(mode, context),
      body: fallbackBody,
      source: "local"
    };
  }

  if (!apiSession) {
    showToast("Connect to the API to use this AI provider. Using local operator.", "info");
    return {
      provider: "Local fallback",
      title: aiTitleForMode(mode, context),
      body: fallbackBody,
      source: "local"
    };
  }

  try {
    const result = await requestAiOperator(mode, context);
    return {
      provider: result.provider || aiProviderLabel(),
      title: result.title || aiTitleForMode(mode, context),
      body: result.body || fallbackBody,
      actions: result.actions || [],
      source: "server"
    };
  } catch (error) {
    showToast(`AI provider unavailable: ${error.message}. Using local operator.`, "info");
    return {
      provider: "Local fallback",
      title: aiTitleForMode(mode, context),
      body: fallbackBody,
      source: "local"
    };
  }
}

function aiTitleForMode(mode, context) {
  if (mode === "project_brief") return `${context.project?.name || "Project"} operator brief`;
  if (mode === "client_update") return `${context.company?.name || "Client"} update draft`;
  if (mode === "daily_plan") return "Daily operator plan";
  return `${state.workspace.name} operator brief`;
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
  const projects = Array.isArray(state.projects) ? state.projects : [];
  return Boolean(task?.archivedAt || isProjectArchived(byId(projects, task?.projectId)));
}

function activeProjects() {
  const projects = Array.isArray(state.projects) ? state.projects : [];
  return projects.filter((project) => !isProjectArchived(project) && canAccessProject(project));
}

function activeTasks() {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  return tasks.filter((task) => !isTaskArchived(task) && canAccessTask(task));
}

function visibleCompanies() {
  const companies = Array.isArray(state.companies) ? state.companies : [];
  return companies.filter((company) => canAccessCompany(company.id));
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

function activeMemberId() {
  return apiSession?.user?.id || currentMemberId;
}

function canLogTimeForOthers() {
  return hasApiPermission("members:write");
}

function taskRevision(task) {
  return task?.updatedAt || task?.createdAt || "";
}

function isPresenceActive(presence) {
  const lastActive = new Date(presence.lastActiveAt || presence.updatedAt || 0).getTime();
  return presence.status === "online" && Number.isFinite(lastActive) && Date.now() - lastActive < 120000;
}

function currentPresenceRecord({ taskId = "" } = {}) {
  const memberId = activeMemberId();
  const task = taskId ? byId(state.tasks, taskId) : null;
  const projectId = task?.projectId || (state.selectedProject !== "all" ? state.selectedProject : "");
  const routeLabel = routes[state.selectedRoute] || "Workspace";
  const viewing = task
    ? `Viewing ${task.title}`
    : projectId
      ? `Viewing ${projectName(projectId)}`
      : `Viewing ${routeLabel}`;
  const now = new Date().toISOString();

  return {
    id: `presence-${state.workspace.id}-${memberId}`,
    memberId,
    route: state.selectedRoute,
    projectId,
    taskId,
    viewing,
    cursorX: lastPointer?.x ?? null,
    cursorY: lastPointer?.y ?? null,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    status: document.hidden ? "away" : "online",
    lastActiveAt: now,
    updatedAt: now
  };
}

function upsertLocalPresence(record) {
  const presence = Array.isArray(state.presence) ? state.presence : [];
  state.presence = [
    record,
    ...presence.filter((presenceItem) => presenceItem.id !== record.id)
  ].slice(0, 50);
}

function heartbeatPresence({ force = false, taskId = "" } = {}) {
  const record = currentPresenceRecord({ taskId });
  const signature = `${record.memberId}:${record.route}:${record.projectId}:${record.taskId}:${record.status}`;
  const shouldSync = force || signature !== lastPresenceSignature || Date.now() - lastPresenceSyncedAt > 25000;
  if (!shouldSync) return;

  lastPresenceSignature = signature;
  lastPresenceSyncedAt = Date.now();
  upsertLocalPresence(record);
  saveState();
  syncRecordToApi("presence", record, "Presence synced", false);
  renderPresenceCursors();
}

function livePresenceRecords({ taskId = "" } = {}) {
  return (Array.isArray(state.presence) ? state.presence : [])
    .filter(isPresenceActive)
    .filter((presence) => presence.memberId !== activeMemberId())
    .filter((presence) => !taskId || presence.taskId === taskId)
    .sort((a, b) => new Date(b.lastActiveAt || b.updatedAt) - new Date(a.lastActiveAt || a.updatedAt));
}

function livePresenceMembers({ taskId = "" } = {}) {
  return livePresenceRecords({ taskId })
    .map((presence) => ({
      presence,
      member: byId(workspaceMembers(), presence.memberId)
    }))
    .filter((item) => item.member)
    .slice(0, 5);
}

function currentOpenTaskId() {
  return document.querySelector("#task-dialog[open] #task-id")?.value || "";
}

function isSamePresenceSurface(presence) {
  if (presence.route !== state.selectedRoute) return false;
  const openTaskId = currentOpenTaskId();
  if (openTaskId || presence.taskId) return presence.taskId === openTaskId;
  if (state.selectedRoute === "project") return presence.projectId === state.selectedProject;
  if (state.selectedRoute === "company") return presence.projectId === state.selectedProject || !presence.projectId;
  return true;
}

function remoteCursorRecords() {
  return livePresenceRecords({})
    .filter(isSamePresenceSurface)
    .filter((presence) => presence.cursorX !== null && presence.cursorY !== null)
    .filter((presence) => presence.cursorX !== undefined && presence.cursorY !== undefined)
    .filter((presence) => Number.isFinite(Number(presence.cursorX)) && Number.isFinite(Number(presence.cursorY)))
    .slice(0, 6);
}

function renderPresenceCursors() {
  let layer = document.querySelector("#presence-cursors");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "presence-cursors";
    layer.className = "presence-cursor-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }

  const cursors = remoteCursorRecords();
  layer.hidden = !cursors.length;
  layer.innerHTML = cursors.map((presence) => {
    const scaleX = window.innerWidth / Math.max(1, Number(presence.viewportWidth || window.innerWidth));
    const scaleY = window.innerHeight / Math.max(1, Number(presence.viewportHeight || window.innerHeight));
    const x = Math.max(0, Math.min(window.innerWidth - 120, Number(presence.cursorX) * scaleX));
    const y = Math.max(0, Math.min(window.innerHeight - 36, Number(presence.cursorY) * scaleY));
    return `
      <span class="presence-cursor" style="transform: translate(${Math.round(x)}px, ${Math.round(y)}px);">
        <span class="presence-cursor-point"></span>
        <span class="presence-cursor-label">${escapeHtml(memberName(presence.memberId))}</span>
      </span>
    `;
  }).join("");
}

function handlePointerPresence(event) {
  lastPointer = { x: event.clientX, y: event.clientY };
  if (!apiSession || Date.now() - lastPointerSyncedAt < 1200) return;
  lastPointerSyncedAt = Date.now();
  heartbeatPresence({ force: true, taskId: currentOpenTaskId() });
}

async function refreshLiveCollaborationFromApi({ rerender = false } = {}) {
  if (!apiSession || liveRefreshInFlight) return false;
  liveRefreshInFlight = true;

  try {
    let changed = false;
    for (const collection of ["presence", "comments", "activities", "approvals", "documents", "files", "timeEntries", "chatMessages", "whiteboards"]) {
      const incoming = await fetchApiCollectionPages(`/api/records/${encodeURIComponent(collection)}`, "records");
      if (!incoming.length) continue;
      changed = mergeCollectionFromApi(collection, incoming) || changed;
    }
    if (changed) {
      markRealtimeChanged();
      saveState();
      const openTaskId = document.querySelector("#task-dialog[open] #task-id")?.value || "";
      if (openTaskId) {
        renderTaskCollaboration(openTaskId);
        renderTaskTimeTracking(openTaskId);
      }
      renderPresenceCursors();
      if (rerender || ["dashboard", "inbox"].includes(state.selectedRoute)) render();
    }
    return changed;
  } catch (error) {
    return false;
  } finally {
    liveRefreshInFlight = false;
  }
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

function operatorTaskScore(task, date = todayKey()) {
  let score = 0;
  if (isOverdue(task)) score += 100;
  if (isTaskBlocked(task)) score += 80;
  if (task.dueDate === date) score += 70;
  if (task.assignee === activeMemberId()) score += 40;
  if (task.priority === "urgent") score += 35;
  if (task.priority === "high") score += 25;
  if (task.dueDate && task.dueDate <= shiftDate(date, 7)) score += 20;
  score += getTaskComments(task.id).length * 3;
  score += getTaskActivity(task.id, 3).length * 2;
  return score;
}

function operatorReasonForTask(task, date = todayKey()) {
  if (isOverdue(task)) return `Overdue since ${formatDate(task.dueDate)}`;
  if (isTaskBlocked(task)) return `Blocked by ${openTaskDependencies(task).map((item) => item.title).join(", ")}`;
  if (task.dueDate === date) return "Due today";
  if (task.priority === "urgent" || task.priority === "high") return `${priorityLabel(task.priority)} priority`;
  if (task.assignee === activeMemberId()) return "Assigned to you";
  return "Relevant workspace signal";
}

function dailyOperatorPlan(date = state.selectedDailyDate) {
  const candidates = activeTasks()
    .filter((task) => task.status !== "done")
    .filter((task) => !isPlannedForDate(task, date))
    .map((task) => ({
      task,
      score: operatorTaskScore(task, date),
      reason: operatorReasonForTask(task, date)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    now: candidates.slice(0, 1),
    next: candidates.slice(1, 3),
    later: candidates.slice(3, 6)
  };
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

function downloadTextFile(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadJsonFile(filename, json) {
  downloadTextFile(filename, json, "application/json");
}

function uniqueTemplateId(candidateId) {
  const base = String(candidateId || "template").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "template";
  if (!state.projectTemplates.some((template) => template.id === base)) return base;
  return `${base}-${Date.now().toString(36)}`;
}

function normalizeTemplateTags(tags) {
  return Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8) : [];
}

function validateProjectTemplate(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("Template must be an object");
  const template = input.template && typeof input.template === "object" ? input.template : input;
  const name = String(template.name || "").trim();
  if (!name) throw new Error("Template needs a name");
  const tasks = Array.isArray(template.tasks) ? template.tasks : [];
  if (!tasks.length) throw new Error("Template needs at least one task");
  const validMemberIds = new Set(members.map((member) => member.id));
  const validPriorities = new Set(priorities.map((priority) => priority.id));
  const taskKeys = new Set();
  const normalizedTasks = tasks.slice(0, 60).map((task, index) => {
    const key = String(task.key || `task-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `task-${index + 1}`;
    if (taskKeys.has(key)) throw new Error(`Duplicate task key: ${key}`);
    taskKeys.add(key);
    const title = String(task.title || "").trim();
    if (!title) throw new Error(`Task ${index + 1} needs a title`);
    return {
      key,
      title,
      description: String(task.description || ""),
      assignee: validMemberIds.has(task.assignee) ? task.assignee : currentMemberId,
      priority: validPriorities.has(task.priority) ? task.priority : "normal",
      startOffset: Math.max(0, Number(task.startOffset || 0)),
      dueOffset: Math.max(0, Number(task.dueOffset || task.startOffset || 1)),
      tags: normalizeTemplateTags(task.tags),
      blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy.map(String).filter((keyValue) => taskKeys.has(keyValue)) : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks.map((subtask) => String(subtask).trim()).filter(Boolean).slice(0, 12) : []
    };
  });

  const normalized = {
    id: options.preserveId ? String(template.id || `template-${slugFromName(name)}`) : uniqueTemplateId(template.id || `template-${slugFromName(name)}`),
    name,
    category: String(template.category || "Community").trim() || "Community",
    description: String(template.description || `Community template for ${name}`),
    owner: validMemberIds.has(template.owner) ? template.owner : currentMemberId,
    creatorName: String(template.creatorName || memberName(template.owner) || "Community creator").trim().slice(0, 96),
    durationDays: Math.max(1, Number(template.durationDays || 14)),
    priceCents: Math.max(0, Math.round(Number(template.priceCents) || 0)),
    currency: paymentCurrencyOptions.includes(template.currency) ? template.currency : "USD",
    payout: normalizeTemplatePayout(template),
    tasks: normalizedTasks,
    milestones: Array.isArray(template.milestones) ? template.milestones.slice(0, 20).map((milestone, index) => ({
      title: String(milestone.title || `Milestone ${index + 1}`),
      description: String(milestone.description || ""),
      owner: validMemberIds.has(milestone.owner) ? milestone.owner : currentMemberId,
      dueOffset: Math.max(0, Number(milestone.dueOffset || 7)),
      status: ["planned", "active", "completed"].includes(milestone.status) ? milestone.status : "planned",
      taskKeys: Array.isArray(milestone.taskKeys) ? milestone.taskKeys.map(String).filter((key) => taskKeys.has(key)) : []
    })) : [],
    docs: Array.isArray(template.docs) ? template.docs.slice(0, 20).map((document, index) => ({
      title: String(document.title || `Template Doc ${index + 1}`),
      type: String(document.type || "Template"),
      body: String(document.body || "")
    })) : [],
    intakeForm: template.intakeForm && typeof template.intakeForm === "object" ? {
      title: String(template.intakeForm.title || `${name} Intake`),
      assignee: validMemberIds.has(template.intakeForm.assignee) ? template.intakeForm.assignee : currentMemberId,
      description: String(template.intakeForm.description || `Capture requests for ${name}.`)
    } : {
      title: `${name} Intake`,
      assignee: currentMemberId,
      description: `Capture requests for ${name}.`
    }
  };
  return normalized;
}

function projectTemplateExportPayload(template) {
  return {
    type: "agora.project-template",
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    template: validateProjectTemplate(template, { preserveId: true })
  };
}

function exportProjectTemplateJson(template) {
  return JSON.stringify(projectTemplateExportPayload(template), null, 2);
}

function downloadProjectTemplate(templateId) {
  const template = byId(state.projectTemplates, templateId) || marketplaceProjectTemplates.find((item) => item.id === templateId);
  if (!template) return;
  if (marketplaceProjectTemplates.some((item) => item.id === template.id) && !marketplaceTemplateIsUnlocked(template)) {
    showToast("Grant access before exporting this premium template", "info");
    return;
  }
  downloadJsonFile(`${slugFromName(template.name)}-agora-template.json`, exportProjectTemplateJson(template));
  showToast("Template JSON downloaded", "success");
}

function parseProjectTemplatePayload(rawJson, options = {}) {
  const parsed = JSON.parse(rawJson);
  const sources = Array.isArray(parsed.templates) ? parsed.templates : [parsed.template || parsed];
  const templates = sources
    .filter((item) => item && typeof item === "object")
    .map((item) => validateProjectTemplate(item, { preserveId: Boolean(options.preserveId) }));
  if (!templates.length) throw new Error("Template JSON did not include any templates");
  return {
    type: parsed.type || "agora.project-template",
    exportVersion: parsed.exportVersion || parsed.version || 1,
    exportedAt: parsed.exportedAt || "",
    templates
  };
}

function projectTemplateImportPreview(rawJson) {
  const payload = parseProjectTemplatePayload(rawJson, { preserveId: true });
  const installedKeys = new Set(state.projectTemplates.flatMap((template) => [template.id, template.name.toLowerCase()]));
  const creatorNames = new Set(payload.templates.map(templateCreatorLabel));
  const warnings = [];
  payload.templates.forEach((template) => {
    templateTrustWarnings(template).forEach((warning) => warnings.push(`${template.name}: ${warning}`));
    if (installedKeys.has(template.id) || installedKeys.has(template.name.toLowerCase())) warnings.push(`${template.name}: already installed`);
  });
  if (payload.exportVersion !== 1) warnings.push(`Export version ${payload.exportVersion} may need review`);
  return {
    id: uid("template-import-preview"),
    type: payload.type,
    typeLabel: payload.type === "agora.template-marketplace" ? "Template marketplace" : "Template JSON",
    exportedAt: payload.exportedAt,
    templateCount: payload.templates.length,
    newCount: payload.templates.filter((template) => !installedKeys.has(template.id) && !installedKeys.has(template.name.toLowerCase())).length,
    taskCount: payload.templates.reduce((total, template) => total + template.tasks.length, 0),
    milestoneCount: payload.templates.reduce((total, template) => total + template.milestones.length, 0),
    docCount: payload.templates.reduce((total, template) => total + template.docs.length, 0),
    premiumCount: payload.templates.filter(marketplaceTemplateRequiresEntitlement).length,
    creatorCount: creatorNames.size,
    intakeCount: payload.templates.filter((template) => template.intakeForm).length,
    warningCount: warnings.length,
    warnings: warnings.slice(0, 8),
    templates: payload.templates.map((template) => ({
      id: template.id,
      name: template.name,
      category: template.category,
      tasks: template.tasks.length,
      priceLabel: marketplaceTemplatePriceLabel(template),
      installed: installedKeys.has(template.id) || installedKeys.has(template.name.toLowerCase())
    })),
    createdAt: new Date().toISOString()
  };
}

function importProjectTemplateJson(rawJson) {
  const payload = parseProjectTemplatePayload(rawJson);
  const importedTemplates = payload.templates;
  const importedIds = new Set(importedTemplates.map((template) => template.id));
  const importedNames = new Set(importedTemplates.map((template) => template.name.toLowerCase()));
  state.projectTemplates = [
    ...importedTemplates,
    ...state.projectTemplates.filter((item) => !importedIds.has(item.id) && !importedNames.has(item.name.toLowerCase()))
  ];
  state.templateLibrary = {
    ...(state.templateLibrary || {}),
    category: "all",
    query: "",
    selectedProjectTemplateId: importedTemplates[0]?.id || ""
  };
  state.templateImportPreview = null;
  saveState();
  render();
  showToast(`Imported ${importedTemplates.length} template${importedTemplates.length === 1 ? "" : "s"}`, "success");
}

function csvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportTasksCsv() {
  const headers = ["id", "title", "project", "company", "assignee", "status", "priority", "startDate", "dueDate", "blockedBy", "tags"];
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const rows = tasks.map((task) => [
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
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const timeEntries = Array.isArray(state.timeEntries) ? state.timeEntries : [];
  const rows = timeEntries.map((entry) => {
    const task = byId(tasks, entry.taskId);
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

function portableAuditLogMarkdown() {
  const events = (Array.isArray(state.auditEvents) ? state.auditEvents : [])
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 40);
  if (!events.length) return "# Audit Log\n\nNo local audit events are available yet.\n";
  return [
    "# Audit Log",
    "",
    ...events.map((event) => [
      `## ${event.action || "event"}`,
      `- Time: ${event.createdAt ? formatTimestamp(event.createdAt) : "Unknown"}`,
      `- Actor: ${memberName(event.actorId) || event.actorId || "Unknown"}`,
      `- Impact: ${auditImpactLevel(event)}`,
      `- Detail: ${event.detail || "No detail"}`
    ].join("\n"))
  ].join("\n\n");
}

function portableProjectMarkdown(project) {
  const projectTasks = getProjectTasks(project.id, false);
  const company = projectCompany(project.id);
  return [
    `# ${project.name}`,
    "",
    `Company: ${company?.name || "No company"}`,
    `Status: ${project.status}`,
    `Owner: ${memberName(project.owner)}`,
    `Progress: ${projectProgress(projectTasks)}%`,
    "",
    "## Open Tasks",
    projectTasks.length ? projectTasks.map((task) => `- [${task.status === "done" ? "x" : " "}] ${task.title} / ${memberName(task.assignee)} / ${task.dueDate || "No due date"}`).join("\n") : "No tasks yet.",
    "",
    "## Recent Activity",
    getProjectActivity(project.id, 8).length ? getProjectActivity(project.id, 8).map((activity) => `- ${formatTimestamp(activity.createdAt)}: ${activity.message}`).join("\n") : "No recent activity."
  ].join("\n");
}

function portableWorkspaceManifest() {
  const snapshot = workspaceSnapshot();
  const ai = aiSettings();
  const companies = Array.isArray(state.companies) ? state.companies : [];
  const projects = Array.isArray(state.projects) ? state.projects : [];
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const automations = Array.isArray(state.automations) ? state.automations : [];
  const projectTemplates = Array.isArray(state.projectTemplates) ? state.projectTemplates : [];
  const documents = Array.isArray(state.documents) ? state.documents : [];
  const files = Array.isArray(state.files) ? state.files : [];
  const timeEntries = Array.isArray(state.timeEntries) ? state.timeEntries : [];
  return {
    type: "agora.portable-workspace",
    exportVersion: 1,
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
      timeEntries: timeEntries.length,
      operatorActions: recentOperatorActions(50).length
    },
    portability: {
      canRunOffline: true,
      includesJsonSnapshot: true,
      includesCsvExports: true,
      includesAutomationPacks: true,
      includesOperatorLedger: true,
      restorePath: "Data > Import JSON can restore workspace.json into Agora."
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
    "",
    "## What Is Included",
    "",
    `- ${manifest.counts.projects} projects and ${manifest.counts.tasks} tasks`,
    `- ${manifest.counts.automations} automation rules`,
    `- ${manifest.counts.templates} project templates`,
    `- ${manifest.counts.documents} docs and ${manifest.counts.files} files metadata records`,
    `- ${manifest.counts.operatorActions} AI operator action ledger entries`,
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
  return [
    { path: "README.md", kind: "markdown", content: portableWorkspaceReadme() },
    { path: "workspace.json", kind: "json", content: exportWorkspaceJson() },
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
  downloadJsonFile(`${slugFromName(state.workspace.name)}-portable-bundle-${todayKey()}.json`, JSON.stringify(portableWorkspaceBundle(), null, 2));
  showToast("Portable workspace bundle downloaded", "success");
}

function downloadPortableWorkspaceManifest() {
  downloadTextFile(`${slugFromName(state.workspace.name)}-portable-manifest-${todayKey()}.md`, portableWorkspaceReadme(), "text/markdown");
  showToast("Portable manifest downloaded", "success");
}

function parsePortableWorkspaceInput(rawJson) {
  const parsed = JSON.parse(rawJson);
  if (parsed?.type === "agora.portable-workspace" && Array.isArray(parsed.files)) {
    const workspaceFile = parsed.files.find((file) => file.path === "workspace.json" && file.kind === "json");
    if (!workspaceFile?.content) throw new Error("Portable bundle is missing workspace.json");
    const snapshot = JSON.parse(workspaceFile.content);
    return {
      snapshot,
      sourceType: "portable-bundle",
      manifest: parsed.manifest || parsed,
      fileCount: parsed.files.length,
      files: parsed.files.map((file) => ({ path: file.path, kind: file.kind, size: file.size || String(file.content || "").length }))
    };
  }

  return {
    snapshot: parsed.snapshot && parsed.snapshot.workspace ? parsed.snapshot : parsed,
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
  const parsed = parsePortableWorkspaceInput(rawJson);
  if (options.backupLabel) saveWorkspaceBackups([workspaceBackupRecord(options.backupLabel), ...loadWorkspaceBackups()]);
  applyWorkspaceSnapshot(parsed.snapshot);
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
  saveWorkspaceBackups([workspaceBackupRecord(label), ...loadWorkspaceBackups()]);
  render();
  showToast("Workspace backup created", "success");
}

function restoreWorkspaceBackup(backupId) {
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
  downloadJsonFile(`${slugFromName(state.workspace.name)}-${todayKey()}.json`, exportWorkspaceJson());
  showToast("Workspace export downloaded", "success");
}

function backendReadinessItems() {
  const remoteItems = Array.isArray(backendHealth?.readiness) ? backendHealth.readiness : [];
  const baseItems = remoteItems.length ? remoteItems : [
    { label: "Storage adapter", done: true, detail: "Browser local storage is active until the API is connected." },
    { label: "Workspace metadata", done: true, detail: "Workspace settings are stored in the local snapshot." },
    { label: "Role model", done: true, detail: "Admin, manager, member, and client roles are available." },
    { label: "JSON export/import", done: true, detail: "Portable workspace exports are available." },
    { label: "API health", done: false, detail: "Connect to the API to inspect live backend readiness." }
  ];

  return [
    ...baseItems,
    {
      id: "failed-sync-queue",
      label: "Failed sync queue",
      done: apiSyncQueue.length === 0,
      detail: apiSyncQueue.length ? `${apiSyncQueue.length} local change${apiSyncQueue.length === 1 ? "" : "s"} waiting to retry` : "No failed API syncs are queued"
    }
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

function normalizeSavedViews(value) {
  const views = Array.isArray(value) ? value : seedData.savedViews;
  return views
    .filter((view) => view && view.id && view.name)
    .map((view) => ({
      id: String(view.id),
      name: String(view.name),
      route: routes[view.route] ? view.route : "dashboard",
      selectedProject: view.selectedProject || "all",
      selectedCompany: view.selectedCompany || "all",
      filters: {
        ...seedData.filters,
        ...(view.filters || {})
      },
      pinned: Boolean(view.pinned),
      createdAt: view.createdAt || new Date().toISOString()
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt));
}

function currentViewSnapshot(name) {
  return {
    id: uid("view"),
    name,
    route: state.selectedRoute,
    selectedProject: state.selectedProject,
    selectedCompany: state.selectedCompany,
    filters: { ...state.filters },
    createdAt: new Date().toISOString()
  };
}

function currentSavedViewId() {
  const current = JSON.stringify({
    route: state.selectedRoute,
    selectedProject: state.selectedProject,
    selectedCompany: state.selectedCompany,
    filters: state.filters
  });
  return state.savedViews.find((view) => JSON.stringify({
    route: view.route,
    selectedProject: view.selectedProject,
    selectedCompany: view.selectedCompany,
    filters: view.filters
  }) === current)?.id || "";
}

function saveCurrentView() {
  const fallbackName = `${routes[state.selectedRoute] || "Workspace"} view`;
  const name = els.savedViewName?.value.trim() || fallbackName;
  if (!name) return;
  const existing = state.savedViews.find((view) => view.name.toLowerCase() === name.toLowerCase());
  const nextView = {
    ...currentViewSnapshot(name),
    id: existing?.id || uid("view"),
    pinned: Boolean(existing?.pinned),
    createdAt: existing?.createdAt || new Date().toISOString()
  };
  state.savedViews = [
    nextView,
    ...state.savedViews.filter((view) => view.id !== nextView.id)
  ].slice(0, 20);
  saveState();
  render();
  if (els.savedViewName) els.savedViewName.value = "";
  showToast("Saved view added", "success");
}

function updateCurrentSavedView() {
  const viewId = els.savedViewFilter?.value || currentSavedViewId();
  const view = state.savedViews.find((item) => item.id === viewId);
  if (!view) {
    showToast("Choose a saved view to update", "info");
    return;
  }
  const nextView = {
    ...currentViewSnapshot(view.name),
    id: view.id,
    pinned: Boolean(view.pinned),
    createdAt: view.createdAt
  };
  state.savedViews = normalizeSavedViews([nextView, ...state.savedViews.filter((item) => item.id !== view.id)]);
  saveState();
  render();
  showToast(`Updated ${view.name}`, "success");
}

function renameCurrentSavedView() {
  const viewId = els.savedViewFilter?.value || currentSavedViewId();
  const view = state.savedViews.find((item) => item.id === viewId);
  const name = els.savedViewName?.value.trim();
  if (!view || !name) {
    showToast("Choose a view and enter a new name", "info");
    return;
  }
  state.savedViews = normalizeSavedViews(state.savedViews.map((item) => item.id === view.id ? { ...item, name } : item));
  saveState();
  render();
  if (els.savedViewName) els.savedViewName.value = "";
  showToast("Saved view renamed", "success");
}

function togglePinnedSavedView() {
  const viewId = els.savedViewFilter?.value || currentSavedViewId();
  const view = state.savedViews.find((item) => item.id === viewId);
  if (!view) {
    showToast("Choose a saved view to pin", "info");
    return;
  }
  state.savedViews = normalizeSavedViews(state.savedViews.map((item) => item.id === view.id ? { ...item, pinned: !item.pinned } : item));
  saveState();
  render();
  showToast(view.pinned ? "Saved view unpinned" : "Saved view pinned", "success");
}

function applySavedView(viewId) {
  const view = state.savedViews.find((item) => item.id === viewId);
  if (!view) return;
  state.filters = { ...seedData.filters, ...view.filters };
  state.selectedProject = view.selectedProject || "all";
  state.selectedCompany = view.selectedCompany || "all";
  state.selectedRoute = routeFallback(view.route);
  if (state.selectedRoute === "project" && !byId(state.projects, state.selectedProject)) {
    state.selectedRoute = "dashboard";
    state.selectedProject = "all";
  }
  if (state.selectedRoute === "company" && !byId(state.companies, state.selectedCompany)) {
    state.selectedRoute = "companies";
    state.selectedCompany = "all";
  }
  openSidebarGroupForRoute(state.selectedRoute);
  saveState();
  render();
  showToast(`Loaded ${view.name}`, "success");
}

function deleteCurrentSavedView() {
  const viewId = els.savedViewFilter?.value || currentSavedViewId();
  const view = state.savedViews.find((item) => item.id === viewId);
  if (!view) {
    showToast("Choose a saved view to forget", "info");
    return;
  }
  state.savedViews = state.savedViews.filter((item) => item.id !== view.id);
  saveState();
  render();
  showToast(`Forgot ${view.name}`, "success");
}

function globalSearchResults() {
  const query = state.filters.query.trim().toLowerCase();
  if (query.length < 2) return [];

  const matches = (values) => values.filter(Boolean).join(" ").toLowerCase().includes(query);
  const taskResults = activeTasks()
    .filter((task) => matches([
      task.title,
      task.description,
      projectName(task.projectId),
      companyName(projectCompany(task.projectId)?.id),
      memberName(task.assignee),
      task.tags.join(" ")
    ]))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      type: "Task",
      title: task.title,
      detail: `${projectName(task.projectId)} - ${statusLabel(task.status)} - ${memberName(task.assignee)}`,
      route: "task",
      taskId: task.id
    }));

  const projectResults = activeProjects()
    .filter((project) => matches([project.name, project.description, companyName(project.companyId), memberName(project.owner)]))
    .slice(0, 4)
    .map((project) => ({
      id: project.id,
      type: "Project",
      title: project.name,
      detail: `${companyName(project.companyId)} - due ${formatDate(project.dueDate)}`,
      route: "project",
      projectId: project.id
    }));

  const companyResults = visibleCompanies()
    .filter((company) => matches([company.name, company.description, company.type, memberName(company.owner)]))
    .slice(0, 3)
    .map((company) => ({
      id: company.id,
      type: "Company",
      title: company.name,
      detail: `${company.type} - ${company.status}`,
      route: "company",
      companyId: company.id
    }));

  const documentResults = getVisibleDocuments()
    .filter((document) => matches([document.title, document.type, document.body, projectName(document.projectId)]))
    .slice(0, 3)
    .map((document) => ({
      id: document.id,
      type: "Doc",
      title: document.title,
      detail: `${document.type} - ${projectName(document.projectId)}`,
      route: "project",
      projectId: document.projectId
    }));

  const peopleResults = workspaceMembers()
    .filter((member) => matches([member.name, member.role, member.email]))
    .slice(0, 3)
    .map((member) => ({
      id: member.id,
      type: "Person",
      title: member.name,
      detail: member.role || "Workspace member",
      route: "my-work",
      assignee: member.id
    }));

  return [...taskResults, ...projectResults, ...companyResults, ...documentResults, ...peopleResults].slice(0, 10);
}

function renderSearchResults() {
  if (!els.searchResults) return;
  const query = state.filters.query.trim();
  const results = globalSearchResults();
  els.searchResults.hidden = query.length < 2;
  if (els.searchResults.hidden) {
    els.searchResults.innerHTML = "";
    return;
  }

  els.searchResults.innerHTML = `
    <div class="search-results-header">
      <strong>${results.length ? "Jump to" : "No matches"}</strong>
      <span>${escapeHtml(query)}</span>
    </div>
    <div class="search-result-list">
      ${results.length ? results.map(renderSearchResult).join("") : `<p>No task, project, company, doc, or person matches this search.</p>`}
    </div>
  `;
}

function renderSearchResult(result) {
  return `
    <button
      class="search-result"
      type="button"
      data-search-route="${result.route}"
      data-search-task="${result.taskId || ""}"
      data-search-project="${result.projectId || ""}"
      data-search-company="${result.companyId || ""}"
      data-search-assignee="${result.assignee || ""}"
    >
      <span>${escapeHtml(result.type)}</span>
      <strong>${escapeHtml(result.title)}</strong>
      <small>${escapeHtml(result.detail)}</small>
    </button>
  `;
}

function openSearchResult(button) {
  if (!button) return;
  const taskId = button.dataset.searchTask || "";
  const projectId = button.dataset.searchProject || "";
  const companyId = button.dataset.searchCompany || "";
  const assignee = button.dataset.searchAssignee || "";
  els.searchResults.hidden = true;

  if (taskId) {
    const task = byId(state.tasks, taskId);
    if (task) {
      state.selectedProject = task.projectId;
      state.selectedRoute = "project";
      state.selectedProjectTab = "tasks";
      saveState();
      render();
      openTaskDialog(task);
    }
    return;
  }
  if (projectId) {
    setProject(projectId);
    return;
  }
  if (companyId) {
    setCompany(companyId);
    return;
  }
  if (assignee) {
    state.filters.assignee = assignee;
    state.selectedRoute = "my-work";
    saveState();
    render();
    return;
  }
  setRoute(button.dataset.searchRoute || "dashboard");
}

function commandPaletteBaseItems() {
  const enabledAutomations = state.automations.filter((automation) => automation.enabled).length;
  const backupCount = loadWorkspaceBackups().length;
  return [
    {
      id: "create:task",
      title: "New task",
      detail: "Capture work in the current workspace",
      group: "Create",
      keywords: "task todo issue card"
    },
    {
      id: "create:feature-request",
      title: "Feature request",
      detail: "Send feedback to the taskboard and owner inbox",
      group: "Create",
      keywords: "feature request feedback idea product",
      disabled: !canWrite("tasks:write")
    },
    {
      id: "create:project",
      title: "New project",
      detail: "Start a project with owner, company, and dates",
      group: "Create",
      keywords: "project milestone launch"
    },
    {
      id: "create:company",
      title: "New company",
      detail: "Add a client, internal group, partner, or vendor",
      group: "Create",
      keywords: "client account portfolio"
    },
    {
      id: "backup:create",
      title: "Create workspace backup",
      detail: `${backupCount} local backup${backupCount === 1 ? "" : "s"} saved for this workspace`,
      group: "Data",
      keywords: "backup restore export json safety"
    },
    {
      id: "route:data",
      title: "Open Data",
      detail: "Backups, JSON import/export, CSV exports, and API sync",
      group: "Navigate",
      keywords: "backup import export api sync"
    },
    {
      id: "api:save",
      title: "Save workspace to API",
      detail: apiSession ? apiConnectionLabel() : "Connect to the API first",
      group: "Sync",
      keywords: "server database supabase sync",
      disabled: !apiSession || !canSaveWholeWorkspace()
    },
    {
      id: "api:load",
      title: "Load workspace from API",
      detail: apiSession ? "Restore the latest API snapshot" : "Connect to the API first",
      group: "Sync",
      keywords: "server database restore snapshot",
      disabled: !apiSession
    },
    {
      id: "settings:sync",
      title: "Open sync settings",
      detail: "Connect API, Supabase, health checks, and failed syncs",
      group: "Setup",
      keywords: "api supabase backend deploy"
    },
    {
      id: "settings:members",
      title: "Invite and manage members",
      detail: "Roles, invitations, and company-scoped access",
      group: "Setup",
      keywords: "team users roles permissions invite"
    },
    {
      id: "view:save",
      title: "Save current view",
      detail: "Turn the active filters into a reusable workspace view",
      group: "Workflow",
      keywords: "filter saved view standup"
    },
    {
      id: "automations:run",
      title: "Run enabled automations",
      detail: `${enabledAutomations} automation${enabledAutomations === 1 ? "" : "s"} enabled`,
      group: "Workflow",
      keywords: "rules alerts automate",
      disabled: enabledAutomations === 0
    },
    {
      id: "operator:brief",
      title: "Draft workspace brief",
      detail: "Ask the AI operator for the highest-signal risks and next actions",
      group: "AI",
      keywords: "operator ai summary risks"
    },
    {
      id: "today:generate",
      title: "Generate Today plan",
      detail: "Plan due, urgent, and high-signal work for the day",
      group: "Daily",
      keywords: "daily today planning"
    },
    {
      id: "tutorial:start",
      title: "Start tutorial",
      detail: "Walk through setup, navigation, sync, and daily work",
      group: "Help",
      keywords: "guide help onboarding"
    },
    {
      id: "onboarding:wizard",
      title: "Open setup wizard",
      detail: "Finish workspace, team, backend, notifications, and templates",
      group: "Help",
      keywords: "first run setup onboarding wizard launch"
    },
    {
      id: "launch:workspace",
      title: "Launch first workspace",
      detail: "Run the guided client template, automation, recovery, and invite flow",
      group: "Golden path",
      keywords: "launch first client workspace guided flow onboarding"
    },
    {
      id: "readiness:open",
      title: "Open readiness audit",
      detail: "Review launch, backend, recovery, permissions, and production gates",
      group: "Admin",
      keywords: "production readiness audit launch gates security recovery"
    },
    {
      id: "template:recommended",
      title: "Start with Client Onboarding",
      detail: "Open the recommended first template for a complete client project flow",
      group: "Golden path",
      keywords: "template client onboarding first project recommended"
    },
    {
      id: "automation:recommended",
      title: "Review Agency Handoff Pack",
      detail: "Open the recommended workflow pack for client approvals and updates",
      group: "Golden path",
      keywords: "automation marketplace workflow pack agency handoff client approvals"
    },
    {
      id: "recovery:plan",
      title: "Open Recovery Plan",
      detail: "Review portable bundle contents, backups, and restore readiness",
      group: "Golden path",
      keywords: "portable recovery bundle backup restore export inspect"
    },
    {
      id: "shortcuts:open",
      title: "Open keyboard shortcuts",
      detail: "View command, create, backup, search, and navigation keys",
      group: "Help",
      keywords: "keyboard shortcuts hotkeys help"
    }
  ];
}

function commandPaletteRouteItems() {
  return Object.entries(routes)
    .filter(([route]) => !["invite", "project", "company"].includes(route))
    .map(([route, label]) => ({
      id: `route:${route}`,
      title: `Open ${label}`,
      detail: `Go to ${label}`,
      group: "Navigate",
      keywords: `${route} page view`
    }));
}

function commandPaletteSearchItems(query) {
  if (query.trim().length < 2) return [];
  const previousQuery = state.filters.query;
  state.filters.query = query;
  const results = globalSearchResults().slice(0, 6);
  state.filters.query = previousQuery;
  return results.map((result, index) => ({
    id: `search:${index}`,
    title: result.title,
    detail: result.detail,
    group: result.type,
    keywords: `${result.type} ${result.detail}`,
    searchResult: result
  }));
}

function commandPaletteItems() {
  const query = els.commandInput?.value.trim() || "";
  const haystackQuery = query.toLowerCase();
  const items = [
    ...commandPaletteBaseItems(),
    ...commandPaletteRouteItems(),
    ...commandPaletteSearchItems(query)
  ];
  if (!haystackQuery) return items.slice(0, 16);

  return items
    .filter((item) => [item.title, item.detail, item.group, item.keywords].join(" ").toLowerCase().includes(haystackQuery))
    .slice(0, 16);
}

function commandPaletteAllItems() {
  return [
    ...commandPaletteBaseItems(),
    ...commandPaletteRouteItems(),
    ...commandPaletteSearchItems(els.commandInput?.value.trim() || "")
  ];
}

function renderCommandPalette() {
  if (!els.commandResults) return;
  const items = commandPaletteItems();
  commandPaletteSelection = clamp(commandPaletteSelection, 0, Math.max(items.length - 1, 0));
  els.commandResults.innerHTML = items.length ? items.map((item, index) => `
    <button
      class="command-result ${index === commandPaletteSelection ? "is-selected" : ""}"
      type="button"
      role="option"
      aria-selected="${index === commandPaletteSelection ? "true" : "false"}"
      data-command-id="${escapeHtml(item.id)}"
      ${item.disabled ? "disabled" : ""}
    >
      <span>${escapeHtml(item.group)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.detail)}</small>
    </button>
  `).join("") : emptyState("No commands match that search.");
}

function openCommandPalette(initialQuery = "") {
  commandPaletteSelection = 0;
  els.commandInput.value = initialQuery;
  renderCommandPalette();
  openDialog(els.commandDialog);
  window.setTimeout(() => els.commandInput?.select(), 0);
}

function closeCommandPalette() {
  if (els.commandDialog?.open) closeDialog(els.commandDialog);
}

function openShortcutsDialog() {
  closeCommandPalette();
  openDialog(els.shortcutsDialog);
}

function isShortcutTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

function isBlockingShortcutDialogOpen() {
  return [els.taskDialog, els.featureRequestDialog, els.projectDialog, els.companyDialog, els.workspaceDialog]
    .some((dialog) => dialog?.open);
}

function clearShortcutLeader() {
  shortcutLeaderActive = false;
  if (shortcutLeaderTimer) window.clearTimeout(shortcutLeaderTimer);
  shortcutLeaderTimer = null;
}

function beginShortcutLeader() {
  shortcutLeaderActive = true;
  if (shortcutLeaderTimer) window.clearTimeout(shortcutLeaderTimer);
  shortcutLeaderTimer = window.setTimeout(clearShortcutLeader, 1800);
  showToast("Go to: D Dashboard, T Today, B Board, I Inbox, S Settings", "info");
}

function runGoToShortcut(key) {
  const routeByKey = {
    d: "dashboard",
    t: "daily",
    b: "board",
    i: "inbox",
    s: "settings"
  };
  const route = routeByKey[key];
  clearShortcutLeader();
  if (!route) {
    showToast("No shortcut for that destination", "info");
    return;
  }
  setRoute(route);
}

function focusGlobalSearch() {
  els.searchInput?.focus();
  els.searchInput?.select();
  renderSearchResults();
}

function handleGlobalShortcut(event) {
  const key = event.key.toLowerCase();
  const isCommandShortcut = (event.metaKey || event.ctrlKey) && key === "k";
  if (isCommandShortcut) {
    event.preventDefault();
    openCommandPalette();
    return true;
  }

  if (els.commandDialog?.open) {
    const items = commandPaletteItems();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      commandPaletteSelection = items.length ? (commandPaletteSelection + 1) % items.length : 0;
      renderCommandPalette();
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      commandPaletteSelection = items.length ? (commandPaletteSelection - 1 + items.length) % items.length : 0;
      renderCommandPalette();
      return true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = items[commandPaletteSelection];
      if (selected) executeCommand(selected.id);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
      return true;
    }
    return false;
  }

  if (els.shortcutsDialog?.open) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog(els.shortcutsDialog);
      return true;
    }
    return false;
  }

  if (isShortcutTypingTarget(event.target)) {
    if (event.key === "Escape" && event.target === els.searchInput) {
      event.preventDefault();
      els.searchResults.hidden = true;
      els.searchInput.blur();
      return true;
    }
    return false;
  }
  if (isBlockingShortcutDialogOpen()) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  if (shortcutLeaderActive) {
    event.preventDefault();
    runGoToShortcut(key);
    return true;
  }

  if (key === "g") {
    event.preventDefault();
    beginShortcutLeader();
    return true;
  }

  if (event.key === "?") {
    event.preventDefault();
    openShortcutsDialog();
    return true;
  }

  const commandByKey = {
    n: "create:task",
    p: "create:project",
    b: "backup:create"
  };
  if (commandByKey[key]) {
    event.preventDefault();
    executeCommand(commandByKey[key]);
    return true;
  }

  if (event.key === "/") {
    event.preventDefault();
    focusGlobalSearch();
    return true;
  }

  return false;
}

function setSettingsTab(tab) {
  state.selectedRoute = "settings";
  state.selectedSettingsTab = settingsTabFallback(tab);
  openSidebarGroupForRoute("settings");
  saveState();
  render();
}

function openCommandSearchResult(result) {
  if (result.taskId) {
    const task = byId(state.tasks, result.taskId);
    if (task) {
      state.selectedProject = task.projectId;
      state.selectedRoute = "project";
      state.selectedProjectTab = "tasks";
      saveState();
      render();
      openTaskDialog(task);
    }
    return;
  }
  if (result.projectId) {
    setProject(result.projectId);
    return;
  }
  if (result.companyId) {
    setCompany(result.companyId);
    return;
  }
  if (result.assignee) {
    state.filters.assignee = result.assignee;
    state.selectedRoute = "my-work";
    saveState();
    render();
    return;
  }
  setRoute(result.route || "dashboard");
}

function executeCommand(commandId) {
  const item = commandPaletteAllItems().find((command) => command.id === commandId);
  if (!item || item.disabled) return;
  closeCommandPalette();

  if (item.searchResult) {
    openCommandSearchResult(item.searchResult);
    return;
  }

  if (commandId.startsWith("route:")) {
    setRoute(commandId.replace("route:", ""));
    return;
  }

  if (commandId === "create:task") {
    if (!canWrite("tasks:write")) {
      showToast("Your role cannot create tasks", "info");
      return;
    }
    populateTaskForm();
    openDialog(els.taskDialog);
    return;
  }

  if (commandId === "create:feature-request") {
    openFeatureRequestDialog();
    return;
  }

  if (commandId === "feature:clear-filters") {
    state.featureRequestFilters = { status: "all", source: "all", impact: "all" };
    saveState();
    render();
    return;
  }

  if (commandId === "create:project") {
    if (!canWrite("projects:write")) {
      showToast("Your role cannot create projects", "info");
      return;
    }
    populateProjectForm();
    openDialog(els.projectDialog);
    return;
  }

  if (commandId === "create:company") {
    if (!canWrite("projects:write")) {
      showToast("Your role cannot manage companies", "info");
      return;
    }
    populateCompanyForm();
    openDialog(els.companyDialog);
    return;
  }

  if (commandId === "backup:create") {
    state.selectedRoute = "data";
    saveState();
    createWorkspaceBackup("Command palette backup");
    return;
  }

  if (commandId === "api:save") {
    saveWorkspaceToApi();
    return;
  }

  if (commandId === "api:load") {
    loadWorkspaceFromApi();
    return;
  }

  if (commandId === "settings:sync") {
    setSettingsTab("sync");
    return;
  }

  if (commandId === "settings:members") {
    setSettingsTab("members");
    return;
  }

  if (commandId === "view:save") {
    saveCurrentView();
    return;
  }

  if (commandId === "automations:run") {
    runAllAutomations();
    return;
  }

  if (commandId === "operator:brief") {
    generateWorkspaceBrief();
    return;
  }

  if (commandId === "today:generate") {
    generateTodayPlan();
    return;
  }

  if (commandId === "tutorial:start") {
    startTutorial();
    return;
  }

  if (commandId === "onboarding:wizard") {
    openOnboardingWizard();
    return;
  }

  if (commandId === "launch:workspace") {
    openLaunchWorkspaceFlow();
    return;
  }

  if (commandId === "readiness:open") {
    setRoute("readiness");
    return;
  }

  if (commandId === "template:recommended") {
    openRecommendedTemplateFlow();
    return;
  }

  if (commandId === "automation:recommended") {
    openRecommendedAutomationFlow();
    return;
  }

  if (commandId === "recovery:plan") {
    openRecoveryPlanFlow();
    return;
  }

  if (commandId === "shortcuts:open") openShortcutsDialog();
}

function normalizeTaskWatchers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([taskId, watchers]) => [
    taskId,
    Array.from(new Set((Array.isArray(watchers) ? watchers : []).filter(Boolean).map(String)))
  ]));
}

function taskWatchers(taskId) {
  return Array.isArray(state.taskWatchers?.[taskId]) ? state.taskWatchers[taskId] : [];
}

function isWatchingTask(taskId, memberId = activeMemberId()) {
  return taskWatchers(taskId).includes(memberId);
}

function setTaskWatching(taskId, shouldWatch, memberId = activeMemberId()) {
  const watchers = new Set(taskWatchers(taskId));
  if (shouldWatch) watchers.add(memberId);
  else watchers.delete(memberId);
  state.taskWatchers = {
    ...(state.taskWatchers || {}),
    [taskId]: Array.from(watchers)
  };
}

function toggleTaskWatch(taskId) {
  const task = byId(state.tasks, taskId);
  if (!task) return;
  const shouldWatch = !isWatchingTask(taskId);
  setTaskWatching(taskId, shouldWatch);
  saveState();
  renderTaskCollaboration(taskId);
  renderNotificationBadges();
  showToast(shouldWatch ? "Watching task" : "Stopped watching task", "success");
}

function mentionToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function memberMentionTokens(member) {
  const nameParts = String(member.name || "").split(/\s+/).filter(Boolean);
  return new Set([
    mentionToken(member.id),
    mentionToken(member.email?.split("@")[0]),
    mentionToken(nameParts[0]),
    mentionToken(member.name)
  ].filter(Boolean));
}

function mentionTokensFromText(value) {
  return Array.from(String(value || "").matchAll(/@([a-z0-9._-]+)/gi)).map((match) => mentionToken(match[1])).filter(Boolean);
}

function mentionedMembers(comment) {
  const tokens = new Set(mentionTokensFromText(comment.body));
  const explicitMentions = new Set(Array.isArray(comment.mentionIds) ? comment.mentionIds : []);
  if (!tokens.size && !explicitMentions.size) return [];
  return workspaceMembers().filter((member) => {
    if (explicitMentions.has(member.id)) return true;
    const memberTokens = memberMentionTokens(member);
    return Array.from(tokens).some((token) => memberTokens.has(token));
  });
}

function isMentionedInComment(comment, memberId = activeMemberId()) {
  return mentionedMembers(comment).some((member) => member.id === memberId);
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

function notificationSettings() {
  return normalizeNotificationSettings(state.notificationSettings);
}

function inboxEventKey(type) {
  if (type === "due soon") return "due";
  if (type === "watched") return "watched";
  return String(type || "").replace(/[^a-z0-9]+/g, "");
}

function isNotificationTypeEnabled(type) {
  const key = inboxEventKey(type);
  return notificationSettings().events[key] !== false;
}

function inboxSnoozedUntil(id) {
  const until = state.inboxSnoozed?.[id] || "";
  if (!until) return "";
  const timestamp = new Date(until).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() ? until : "";
}

function snoozeInboxItem(id, until = shiftDate(todayKey(), 1)) {
  markInboxRead(id);
  state.inboxSnoozed = {
    ...(state.inboxSnoozed || {}),
    [id]: `${until}T09:00:00.000Z`
  };
}

function reminderDateForPreset(preset) {
  if (preset === "next-week") return shiftDate(todayKey(), 7);
  if (preset === "later-today") return todayKey();
  return shiftDate(todayKey(), 1);
}

function activeNotificationReminders() {
  return normalizeNotificationReminders(state.notificationReminders)
    .filter((reminder) => reminder.status === "scheduled")
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
}

function dueNotificationReminders() {
  const today = todayKey();
  return activeNotificationReminders().filter((reminder) => reminder.remindAt <= today);
}

function pendingNotificationReminderAlerts() {
  return dueNotificationReminders().filter((reminder) => !reminder.sentAt);
}

function reminderInboxItems() {
  return dueNotificationReminders().map((reminder) => ({
    id: `reminder-${reminder.id}`,
    type: "reminder",
    tone: "blue",
    title: reminder.title,
    message: reminder.message || "You asked Agora to bring this back.",
    taskId: reminder.taskId,
    projectId: reminder.projectId,
    approvalId: reminder.approvalId,
    reminderId: reminder.id,
    createdAt: `${reminder.remindAt}T09:00:00.000Z`,
    urgency: 3
  }));
}

function scheduleInboxReminder(itemId, preset = "tomorrow") {
  const item = getInboxItems({ includeArchived: true }).find((candidate) => candidate.id === itemId);
  if (!item) {
    showToast("That notification is no longer available", "info");
    return;
  }
  const remindAt = reminderDateForPreset(preset);
  const existing = activeNotificationReminders().find((reminder) => reminder.sourceId === item.id && reminder.remindAt === remindAt);
  if (existing) {
    showToast(`Reminder already set for ${formatFullDate(remindAt)}`, "info");
    return;
  }
  const reminder = {
    id: uid("reminder"),
    sourceId: item.id,
    taskId: item.taskId || "",
    approvalId: item.approvalId || "",
    projectId: item.projectId || "",
    title: item.title,
    message: item.message,
    remindAt,
    repeat: "none",
    status: "scheduled",
    createdAt: new Date().toISOString(),
    sentAt: ""
  };
  state.notificationReminders = normalizeNotificationReminders([reminder, ...(state.notificationReminders || [])]);
  syncRecordToApi("notificationReminders", { ...reminder, memberId: activeMemberId() }, "Reminder synced", false);
  logNotificationHistory({
    kind: "reminder",
    title: reminder.title,
    message: `Reminder scheduled for ${formatFullDate(remindAt)}.`,
    reason: item.message,
    channel: "in-app"
  });
  markInboxRead(item.id);
  syncInboxStateToApi();
  saveState();
  render();
  showToast(`Reminder set for ${formatFullDate(remindAt)}`, "success");
}

function dismissNotificationReminder(reminderId) {
  let changedReminder = null;
  state.notificationReminders = normalizeNotificationReminders(state.notificationReminders).map((reminder) => (
    reminder.id === reminderId
      ? (changedReminder = { ...reminder, status: "dismissed", sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      : reminder
  ));
  if (changedReminder) syncRecordToApi("notificationReminders", { ...changedReminder, memberId: activeMemberId() }, "Reminder synced", false);
  saveState();
  render();
  showToast("Reminder dismissed", "success");
}

async function showReminderBrowserNotification(reminder) {
  if (notificationPermissionState !== "granted") return false;
  const options = {
    body: reminder.message || "You asked Agora to bring this back.",
    icon: "./assets/agora-mark.svg",
    badge: "./assets/agora-mark.svg",
    tag: `agora-reminder-${reminder.id}`,
    data: {
      route: "inbox",
      reminderId: reminder.id,
      taskId: reminder.taskId || ""
    }
  };
  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration?.showNotification) {
    await registration.showNotification(`Reminder: ${reminder.title}`, options);
  } else if (typeof Notification !== "undefined") {
    new Notification(`Reminder: ${reminder.title}`, options);
  }
  return true;
}

async function runNotificationReminderScheduler({ silent = true } = {}) {
  const pending = pendingNotificationReminderAlerts();
  if (!pending.length) return 0;
  let delivered = 0;
  const now = new Date().toISOString();
  const settings = notificationSettings();

  for (const reminder of pending) {
    let channel = "in-app";
    if (settings.channels.browser) {
      try {
        const didNotify = await showReminderBrowserNotification(reminder);
        if (didNotify) {
          delivered += 1;
          channel = "browser + in-app";
        }
      } catch {
        channel = "in-app";
      }
    }
    logNotificationHistory({
      kind: "reminder-fired",
      title: reminder.title,
      message: reminder.message || "Reminder is due.",
      reason: `Scheduled for ${formatFullDate(reminder.remindAt)}.`,
      channel
    });
  }

  state.notificationReminders = normalizeNotificationReminders(state.notificationReminders).map((reminder) => (
    pending.some((item) => item.id === reminder.id)
      ? { ...reminder, sentAt: now }
      : reminder
  ));
  pending.forEach((reminder) => {
    syncRecordToApi("notificationReminders", { ...reminder, memberId: activeMemberId(), sentAt: now, updatedAt: now }, "Reminder synced", false);
  });
  saveState();
  renderNotificationBadges();
  if (state.selectedRoute === "inbox") render();
  if (!silent) showToast(`${pending.length} reminder ${pending.length === 1 ? "is" : "are"} due`, delivered ? "success" : "info");
  return pending.length;
}

function logNotificationHistory({ kind = "digest", title, message, reason = "", count = 0, channel = "in-app" }) {
  const event = {
    id: uid("notification-history"),
    kind,
    title,
    message,
    reason,
    count,
    channel,
    createdAt: new Date().toISOString()
  };
  state.notificationHistory = [event, ...(state.notificationHistory || [])].slice(0, 50);
  syncRecordToApi("notificationHistory", { ...event, memberId: activeMemberId() }, "Notification history synced", false);
  return event;
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
  const memberId = activeMemberId();
  const items = [];

  visibleTasks.forEach((task) => {
    if (task.status !== "done" && task.assignee === memberId) {
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
    .filter((comment) => comment.author !== memberId)
    .filter((comment) => visibleTaskIds.has(comment.taskId))
    .forEach((comment) => {
      const task = byId(state.tasks, comment.taskId);
      const mentioned = isMentionedInComment(comment, memberId);
      const watched = isWatchingTask(comment.taskId, memberId);
      items.push({
        id: mentioned ? `mention-${comment.id}` : watched ? `watch-comment-${comment.id}` : `comment-${comment.id}`,
        type: mentioned ? "mention" : watched ? "watched" : "comment",
        tone: mentioned ? "blue" : watched ? "amber" : "green",
        title: task?.title || "Task comment",
        message: mentioned
          ? `${memberName(comment.author)} mentioned you: ${comment.body}`
          : watched
            ? `${memberName(comment.author)} commented on a task you watch: ${comment.body}`
            : `${memberName(comment.author)} commented: ${comment.body}`,
        taskId: comment.taskId,
        projectId: task?.projectId || "",
        createdAt: comment.createdAt,
        urgency: mentioned ? 4 : watched ? 3 : 1
      });
    });

  state.activities
    .filter((activity) => activity.memberId !== memberId)
    .filter((activity) => !activity.taskId || visibleTaskIds.has(activity.taskId))
    .slice(0, 12)
    .forEach((activity) => {
      const watched = activity.taskId && isWatchingTask(activity.taskId, memberId);
      items.push({
        id: watched ? `watch-activity-${activity.id}` : `activity-${activity.id}`,
        type: watched ? "watched" : "activity",
        tone: watched ? "amber" : "neutral",
        title: activity.taskId ? byId(state.tasks, activity.taskId)?.title || projectName(activity.projectId) : projectName(activity.projectId),
        message: watched ? `${memberName(activity.memberId)} updated a task you watch: ${activity.message}.` : `${memberName(activity.memberId)} ${activity.message}.`,
        taskId: activity.taskId,
        projectId: activity.projectId,
        createdAt: activity.createdAt,
        urgency: watched ? 3 : 0
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

  items.push(...reminderInboxItems());

  return items
    .filter((item) => includeArchived || !isInboxArchived(item.id))
    .filter((item) => isNotificationTypeEnabled(item.type))
    .filter((item) => !inboxSnoozedUntil(item.id))
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
  const updates = [...state.activities, ...state.comments]
    .filter((item) => projects.some((project) => project.id === item.projectId || byId(state.tasks, item.taskId)?.projectId === project.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    projects,
    tasks,
    openTasks,
    approvals,
    pendingApprovals: approvals.filter((approval) => approval.status !== "approved"),
    files,
    documents,
    updates,
    progress: projectProgress(tasks),
    updatedAt: updates[0]?.createdAt || ""
  };
}

function portalDecisionItems(companyId) {
  const portal = companyPortalSnapshot(companyId);
  return portal.pendingApprovals.slice(0, 5).map((approval) => {
    const task = byId(state.tasks, approval.taskId);
    const project = byId(state.projects, approval.projectId);
    const assets = [...portal.documents, ...portal.files]
      .filter((asset) => asset.projectId === approval.projectId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 3);
    const latestUpdate = portal.updates.find((update) => update.projectId === approval.projectId || byId(state.tasks, update.taskId)?.projectId === approval.projectId);
    return {
      approval,
      task,
      project,
      assets,
      latestUpdate,
      overdue: approval.dueDate && approval.dueDate < todayKey(),
      dueSoon: approval.dueDate && approval.dueDate <= shiftDate(todayKey(), 3)
    };
  });
}

function portalDecisionReadiness(companyId) {
  const decisions = portalDecisionItems(companyId);
  const overdue = decisions.filter((item) => item.overdue).length;
  const dueSoon = decisions.filter((item) => item.dueSoon).length;
  return {
    decisions,
    overdue,
    dueSoon,
    label: overdue ? "Late decisions" : dueSoon ? "Needs review" : decisions.length ? "Ready for review" : "No decisions",
    tone: overdue ? "red" : dueSoon ? "amber" : decisions.length ? "blue" : "green"
  };
}

function renderPortalDecisionRoom(companyId, { client = false } = {}) {
  const readiness = portalDecisionReadiness(companyId);
  const decisions = readiness.decisions;
  const content = `
    <div class="portal-list-header">
      <h3>Decision room</h3>
      <span>${decisions.length} open</span>
    </div>
    <div class="decision-room-summary">
      <span class="status-pill inbox-${readiness.tone}">${escapeHtml(readiness.label)}</span>
      <p>${decisions.length ? "Approvals are bundled with source work, latest updates, and shared assets so external stakeholders can decide without hunting through internal workspace noise." : "No client decisions are waiting right now."}</p>
    </div>
    <div class="decision-room-list">
      ${decisions.length ? decisions.map(renderPortalDecisionItem).join("") : emptyState("No decision packet is needed right now.")}
    </div>
  `;

  if (client) {
    return `
      <section class="panel portal-decision-room">
        ${content}
      </section>
    `;
  }

  return `
    <div class="portal-list portal-decision-room">
      ${content}
    </div>
  `;
}

function renderPortalDecisionItem(item) {
  const { approval, task, project, assets, latestUpdate } = item;
  return `
    <article class="decision-room-item ${item.overdue ? "is-overdue" : ""}">
      <div>
        <span class="status-pill inbox-${approvalTone(approval.status)}">${escapeHtml(approvalStatusLabel(approval.status))}</span>
        <h4>${escapeHtml(approval.title)}</h4>
        <p>${escapeHtml(approval.summary)}</p>
        <div class="meta-row">
          <span>${escapeHtml(project?.name || projectName(approval.projectId))}</span>
          <span>Due ${formatDate(approval.dueDate)}</span>
          <span>${task ? `Source: ${escapeHtml(task.title)}` : "No source task"}</span>
        </div>
      </div>
      <div class="decision-room-context">
        <small>${latestUpdate ? `Latest update: ${escapeHtml(latestUpdate.message || latestUpdate.body || "Workspace update")}` : "No recent update attached."}</small>
        <small>${assets.length ? `Packet assets: ${escapeHtml(assets.map((asset) => asset.title).join(", "))}` : "No shared assets attached yet."}</small>
      </div>
    </article>
  `;
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
  const actionType = overdue[0]
    ? "recover"
    : blocked[0]
      ? "unblock"
      : approvals[0]
        ? "approval"
        : dueSoon[0]
          ? "plan"
          : openTasks[0]
            ? "advance"
            : "update";
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
    actionType,
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

function projectAiContext(project) {
  const brief = operatorBriefForProject(project);
  const projectTasks = getProjectTasks(project.id, false);
  return {
    workspace: state.workspace,
    project,
    company: projectCompany(project.id),
    brief,
    tasks: projectTasks,
    approvals: getProjectApprovals(project.id).filter((approval) => approval.status !== "approved"),
    activities: getProjectActivity(project.id, 8),
    documents: state.documents.filter((document) => document.projectId === project.id)
  };
}

function workspaceAiContext() {
  const projects = visibleReportProjects();
  const briefs = operatorBriefs(6);
  return {
    workspace: state.workspace,
    brief: {
      summary: `${projects.length} active projects, ${activeTasks().length} open tasks, and ${getInboxItems().filter((item) => !isInboxRead(item.id)).length} unread inbox items.`,
      nextAction: briefs[0]?.nextAction || "Review the highest-risk project"
    },
    tasks: activeTasks().sort((a, b) => operatorTaskScore(b) - operatorTaskScore(a)).slice(0, 12),
    approvals: state.approvals.filter((approval) => approval.status !== "approved"),
    activities: state.activities.slice(0, 8),
    documents: state.documents.slice(0, 8)
  };
}

function recentOperatorDocuments(limit = 4) {
  return state.documents
    .filter((document) => document.type === "Operator Brief" || document.type === "Workspace Brief" || /operator brief/i.test(document.title))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit);
}

function operatorActionSuggestions(limit = 6) {
  return operatorBriefs(limit)
    .map(operatorActionSuggestionForBrief)
    .filter(Boolean);
}

function operatorActionSuggestionForBrief(brief) {
  const sourceTask = brief.overdue[0] || brief.blocked[0] || brief.dueSoon[0] || getProjectTasks(brief.project.id, false).find((task) => task.status !== "done");
  const approval = brief.approvals[0];
  const company = projectCompany(brief.project.id);
  const base = {
    id: `suggest-${brief.project.id}-${brief.actionType}`,
    projectId: brief.project.id,
    projectName: brief.project.name,
    companyId: company?.id || "",
    sourceTaskId: sourceTask?.id || "",
    approvalId: approval?.id || "",
    health: brief.health,
    impact: `${brief.health}% health / ${brief.blocked.length} blocked / ${brief.approvals.length} approvals`
  };

  if (brief.actionType === "recover" && sourceTask) {
    return {
      ...base,
      type: "task",
      title: `Create recovery task for ${sourceTask.title}`,
      summary: `Adds a high-priority recovery task, plans it for Today, and logs the operator decision.`,
      confirmLabel: "Create Task"
    };
  }
  if (brief.actionType === "unblock" && sourceTask) {
    return {
      ...base,
      type: "task",
      title: `Create unblock task for ${sourceTask.title}`,
      summary: `Creates a follow-up to identify the blocker, owner, and next date.`,
      confirmLabel: "Create Task"
    };
  }
  if (brief.actionType === "approval" && approval) {
    return {
      ...base,
      type: "approval_chase",
      title: `Chase approval: ${approval.title}`,
      summary: `Creates an approval follow-up task for ${approval.reviewer} and keeps it visible in Today.`,
      confirmLabel: "Chase Approval"
    };
  }
  if (brief.actionType === "plan" && sourceTask) {
    return {
      ...base,
      type: "plan",
      title: `Plan ${sourceTask.title} for Today`,
      summary: `Moves the task into the Now lane and posts an operator note explaining why.`,
      confirmLabel: "Plan Today"
    };
  }
  if (company?.type === "Client" && sourceTask && !approval) {
    return {
      ...base,
      type: "approval_request",
      title: `Request approval for ${sourceTask.title}`,
      summary: `Creates a client approval request with a reviewer, due date, and source task attached.`,
      confirmLabel: "Request Approval"
    };
  }
  if (company?.type === "Client") {
    return {
      ...base,
      type: "client_update",
      title: `Draft client update for ${company.name}`,
      summary: `Creates a client-facing update from open work, pending approvals, and next actions.`,
      confirmLabel: "Draft Update"
    };
  }
  if (sourceTask) {
    return {
      ...base,
      type: "plan",
      title: `Advance ${sourceTask.title}`,
      summary: `Plans the next step and posts a short operator note.`,
      confirmLabel: "Plan Next"
    };
  }
  return null;
}

function recentOperatorActions(limit = 6) {
  return (Array.isArray(state.operatorActions) ? state.operatorActions : [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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
    .map((memberId) => byId(workspaceMembers(), memberId))
    .filter(Boolean)
    .slice(0, 4);
}

function workspacePulse() {
  const recentActivity = [...state.activities]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12);
  const recentComments = [...state.comments]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);
  const liveMembers = livePresenceMembers().map((item) => item.member);
  const activeMemberIds = new Set([
    currentMemberId,
    ...recentActivity.map((activity) => activity.memberId),
    ...recentComments.map((comment) => comment.author)
  ]);
  const handoffs = activeTasks()
    .filter((task) => task.status !== "done")
    .filter((task) => getTaskComments(task.id).length || getTaskActivity(task.id, 2).length)
    .sort((a, b) => new Date((getTaskActivity(b.id, 1)[0] || {}).createdAt || b.createdAt) - new Date((getTaskActivity(a.id, 1)[0] || {}).createdAt || a.createdAt))
    .slice(0, 3);

  return {
    activeMembers: liveMembers.length ? liveMembers : [...activeMemberIds].map((memberId) => byId(workspaceMembers(), memberId)).filter(Boolean).slice(0, 5),
    liveViewers: livePresenceRecords().slice(0, 5),
    recentActivity,
    handoffs
  };
}

function liveWorkspacePresence() {
  const current = currentPresenceRecord({ taskId: currentOpenTaskId() });
  const remote = livePresenceRecords({}).slice(0, 8);
  const records = [current, ...remote].filter((presence, index, list) => list.findIndex((item) => item.memberId === presence.memberId) === index);
  return records.map((presence) => ({
    presence,
    member: byId(workspaceMembers(), presence.memberId) || { id: presence.memberId, name: memberName(presence.memberId), role: "Member" }
  }));
}

function liveEditingSignals(limit = 5) {
  return livePresenceRecords({})
    .filter((presence) => presence.taskId)
    .map((presence) => ({
      presence,
      member: byId(workspaceMembers(), presence.memberId),
      task: byId(state.tasks, presence.taskId)
    }))
    .filter((item) => item.member && item.task)
    .slice(0, limit);
}

function recentMentionSignals(limit = 5) {
  const memberId = activeMemberId();
  return [...state.comments]
    .filter((comment) => isMentionedInComment(comment, memberId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function renderLiveCollaborationPanel() {
  const presence = liveWorkspacePresence();
  const editing = liveEditingSignals();
  const mentions = recentMentionSignals();

  return `
    <section class="panel live-collaboration-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Live workspace</p>
          <h2>Presence and handoffs</h2>
        </div>
        <span class="status-pill ${apiSession ? "inbox-green" : "inbox-neutral"}">${apiSession ? "Realtime ready" : "Local preview"}</span>
      </div>
      <div class="live-collaboration-grid">
        <div>
          <h3>Online now</h3>
          <div class="presence-row">
            ${presence.length ? presence.map(({ member, presence: record }) => `
              <span class="presence-pill ${isPresenceActive(record) ? "is-live" : ""}">
                <span class="avatar">${escapeHtml(member.name.split(" ").map((part) => part[0]).join(""))}</span>
                ${escapeHtml(member.name)}
                <small>${escapeHtml(record.viewing || routes[record.route] || "Workspace")}</small>
              </span>
            `).join("") : emptyState("No live collaborators yet.")}
          </div>
        </div>
        <div>
          <h3>Editing signals</h3>
          <div class="live-signal-list">
            ${editing.length ? editing.map(({ member, task, presence: record }) => `
              <article>
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(task.title)}</span>
                <small>${escapeHtml(projectName(task.projectId))} - ${formatTimestamp(record.lastActiveAt || record.updatedAt)}</small>
              </article>
            `).join("") : emptyState("No one else is inside a task right now.")}
          </div>
        </div>
        <div>
          <h3>Mentions for you</h3>
          <div class="live-signal-list">
            ${mentions.length ? mentions.map((comment) => {
              const task = byId(state.tasks, comment.taskId);
              return `
                <article>
                  <strong>${escapeHtml(memberName(comment.author))}</strong>
                  <span>${renderCommentBody(comment.body)}</span>
                  <small>${task ? escapeHtml(task.title) : escapeHtml(projectName(comment.projectId))} - ${formatTimestamp(comment.createdAt)}</small>
                </article>
              `;
            }).join("") : emptyState("No recent mentions for the active member.")}
          </div>
        </div>
      </div>
    </section>
  `;
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

function rootTaskComments(taskId) {
  const taskComments = getTaskComments(taskId);
  const ids = new Set(taskComments.map((comment) => comment.id));
  return taskComments.filter((comment) => !comment.parentId || !ids.has(comment.parentId));
}

function commentReplies(commentId) {
  return state.comments
    .filter((comment) => comment.parentId === commentId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function openCommentCount(taskId) {
  return getTaskComments(taskId).filter((comment) => comment.status !== "resolved").length;
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

function addAuditEvent({
  action,
  detail,
  actorId = activeMemberId(),
  source = apiSession ? "api-ready" : "local",
  targetType = "workspace",
  targetId = state.workspace?.id || "",
  impact = "low",
  reversible = true,
  restoreHint = "Tracked in local workspace history.",
  metadata = {}
}) {
  const event = {
    id: uid("audit"),
    actorId,
    action,
    detail,
    source,
    targetType,
    targetId,
    impact,
    reversible,
    restoreHint,
    metadata,
    session: apiSession ? "authenticated" : "local-demo",
    createdAt: new Date().toISOString()
  };
  state.auditEvents = [event, ...(state.auditEvents || [])].slice(0, 250);
  return event;
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
  addAuditEvent({
    actorId: memberId,
    action: type,
    detail: message
  });
  syncActivityToApi(activity);
  return activity;
}

function archiveTask(taskId) {
  const task = byId(state.tasks, taskId);
  if (!task || isTaskArchived(task)) return;
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot archive tasks", "info");
    return;
  }

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
  addAuditEvent({
    action: "task_archive_control",
    detail: `Archived task ${task.title}`,
    targetType: "task",
    targetId: task.id,
    impact: "medium",
    reversible: false,
    restoreHint: "Restore from a workspace backup or API snapshot if this was accidental.",
    metadata: {
      projectId: task.projectId,
      archivedAt
    }
  });
  saveState();
  render();
  showToast("Task archived", "success");
  syncTaskArchiveToApi(taskId);
}

function archiveProject(projectId) {
  const project = byId(state.projects, projectId);
  if (!project || isProjectArchived(project)) return;
  if (!canWrite("projects:write")) {
    showToast("Your role cannot archive projects", "info");
    return;
  }

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
  addAuditEvent({
    action: "project_archive_control",
    detail: `Archived project ${project.name} and ${projectTaskIds.size} linked ${projectTaskIds.size === 1 ? "task" : "tasks"}`,
    targetType: "project",
    targetId: project.id,
    impact: "high",
    reversible: false,
    restoreHint: "Restore from a workspace backup or API snapshot if this was accidental.",
    metadata: {
      archivedAt,
      affectedTasks: projectTaskIds.size
    }
  });
  state.selectedProject = "all";
  state.selectedRoute = "dashboard";
  saveState();
  render();
  showToast("Project archived", "success");
  syncProjectArchiveToApi(projectId);
}

function duplicateProject(projectId) {
  const project = byId(state.projects, projectId);
  if (!project || isProjectArchived(project)) return;
  if (!canWrite("projects:write")) {
    showToast("Your role cannot duplicate projects", "info");
    return;
  }

  const now = new Date().toISOString();
  const nextProject = {
    ...project,
    id: uid("project"),
    name: `${project.name} Copy`,
    startDate: project.startDate || todayKey(),
    dueDate: project.dueDate || "",
    archivedAt: "",
    archivedBy: ""
  };
  const sourceTasks = getProjectTasks(project.id, false);
  const taskIds = {};
  const tasks = sourceTasks.map((task) => {
    const taskId = uid("task");
    taskIds[task.id] = taskId;
    return {
      ...task,
      id: taskId,
      projectId: nextProject.id,
      title: task.title,
      status: task.status === "done" ? "todo" : task.status,
      archivedAt: "",
      archivedBy: "",
      createdAt: now,
      updatedAt: now,
      subtasks: (task.subtasks || []).map((subtask) => ({ ...subtask, id: uid("subtask"), done: false }))
    };
  }).map((task) => ({
    ...task,
    blockedBy: (task.blockedBy || []).map((id) => taskIds[id]).filter(Boolean)
  }));
  const milestones = getProjectMilestones(project.id).map((milestone) => ({
    ...milestone,
    id: uid("milestone"),
    projectId: nextProject.id,
    taskIds: (milestone.taskIds || []).map((id) => taskIds[id]).filter(Boolean)
  }));

  state.projects = [nextProject, ...state.projects];
  state.tasks = [...tasks, ...state.tasks];
  state.milestones = [...milestones, ...state.milestones];
  addActivity({
    projectId: nextProject.id,
    type: "project_duplicate",
    message: `duplicated project ${project.name}`
  });
  state.selectedProject = nextProject.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "overview";
  saveState();
  render();
  showToast("Project duplicated", "success");
  syncProjectToApi(nextProject, "Project duplicated in API", true);
}

function setRoute(route) {
  state.selectedRoute = routeFallback(route);
  if (route !== "invite") state.selectedInviteToken = "";
  if (route !== "project") state.selectedProjectTab = "overview";
  if (state.selectedRoute === "settings") state.selectedSettingsTab = settingsTabFallback(state.selectedSettingsTab);
  if (route !== "company") state.selectedCompany = "all";
  openSidebarGroupForRoute(state.selectedRoute);
  saveState();
  render();
  if (state.selectedRoute === "audit" && apiSession && !auditEvents.length) {
    loadAuditLogFromApi();
  }
}

function resetWorkspaceViewState() {
  state.selectedRoute = "dashboard";
  state.selectedProject = "all";
  state.selectedCompany = "all";
  state.selectedInviteToken = "";
  state.selectedProjectTab = "overview";
  state.filters = { ...seedData.filters };
  openSidebarGroupForRoute("dashboard");
}

function switchWorkspace(workspaceId) {
  const workspace = workspaceRegistry.find((item) => item.id === workspaceId && item.status !== "archived");
  if (!workspace || workspace.id === activeWorkspaceId) return;
  saveState();
  activeWorkspaceId = workspace.id;
  saveActiveWorkspaceId(activeWorkspaceId);
  state = loadState();
  resetWorkspaceViewState();
  saveState();
  render();
  showToast(`Switched to ${workspace.name}`, "success");
}

function populateWorkspaceForm(action) {
  const current = registryWorkspace(activeWorkspaceId);
  const titleByAction = {
    create: "New Workspace",
    duplicate: "Duplicate Workspace",
    archive: "Archive Workspace"
  };
  const helpByAction = {
    create: "Create a clean local workspace with its own browser-saved snapshot.",
    duplicate: "Copy the current workspace into a new local workspace.",
    archive: `Archive ${current?.name || "this workspace"} and switch to another active workspace.`
  };
  const defaultName = action === "duplicate" ? `${state.workspace.name} Copy` : action === "archive" ? current?.name || state.workspace.name : "New Agora Workspace";
  document.querySelector("#workspace-dialog-action").value = action;
  document.querySelector("#workspace-dialog-name").value = defaultName;
  document.querySelector("#workspace-dialog-name").disabled = action === "archive";
  document.querySelector("#workspace-dialog-name-field").hidden = action === "archive";
  document.querySelector("#workspace-dialog-help").textContent = helpByAction[action] || "";
  document.querySelector("#workspace-submit").textContent = action === "archive" ? "Archive Workspace" : "Save Workspace";
  els.workspaceFormTitle.textContent = titleByAction[action] || "Workspace";
}

function createWorkspaceWithName(name) {
  const workspaceName = name.trim();
  const workspaceId = uniqueWorkspaceId(workspaceName);
  const now = new Date().toISOString();
  saveState();
  workspaceRegistry = normalizeWorkspaceRegistry([
    {
      id: workspaceId,
      name: workspaceName,
      slug: slugFromName(workspaceName),
      status: "active",
      template: "clean",
      createdAt: now,
      updatedAt: now
    },
    ...workspaceRegistry
  ]);
  saveWorkspaceRegistry();
  activeWorkspaceId = workspaceId;
  saveActiveWorkspaceId(activeWorkspaceId);
  state = createBlankWorkspaceState({ id: workspaceId, name: workspaceName, slug: slugFromName(workspaceName) });
  resetWorkspaceViewState();
  saveState();
  render();
  showToast(`Created ${workspaceName}`, "success");
}

function duplicateWorkspaceWithName(name) {
  const source = registryWorkspace(activeWorkspaceId);
  const workspaceName = name.trim();
  const workspaceId = uniqueWorkspaceId(workspaceName);
  const now = new Date().toISOString();
  saveState();
  const snapshot = normalizeState({
    ...workspaceSnapshot(),
    selectedRoute: "dashboard",
    selectedProject: "all",
    selectedCompany: "all",
    workspace: {
      ...state.workspace,
      id: workspaceId,
      name: workspaceName,
      slug: slugFromName(workspaceName)
    },
    onboarding: {
      ...state.onboarding,
      dismissed: false,
      sampleMode: state.onboarding?.sampleMode || source?.template || "custom"
    }
  });
  workspaceRegistry = normalizeWorkspaceRegistry([
    {
      id: workspaceId,
      name: workspaceName,
      slug: slugFromName(workspaceName),
      status: "active",
      template: source?.template || "duplicate",
      createdAt: now,
      updatedAt: now
    },
    ...workspaceRegistry
  ]);
  saveWorkspaceRegistry();
  activeWorkspaceId = workspaceId;
  saveActiveWorkspaceId(activeWorkspaceId);
  state = snapshot;
  resetWorkspaceViewState();
  saveState();
  render();
  showToast(`Duplicated ${source?.name || "workspace"}`, "success");
}

function createWorkspaceFromSwitcher() {
  populateWorkspaceForm("create");
  openDialog(els.workspaceDialog);
}

function duplicateWorkspaceFromSwitcher() {
  populateWorkspaceForm("duplicate");
  openDialog(els.workspaceDialog);
}

function archiveActiveWorkspace() {
  const activeWorkspaces = workspaceRegistry.filter((workspace) => workspace.status !== "archived");
  if (activeWorkspaces.length <= 1) {
    showToast("Keep at least one active workspace", "info");
    return;
  }
  populateWorkspaceForm("archive");
  openDialog(els.workspaceDialog);
}

function archiveActiveWorkspaceConfirmed() {
  const activeWorkspaces = workspaceRegistry.filter((workspace) => workspace.status !== "archived");
  if (activeWorkspaces.length <= 1) {
    showToast("Keep at least one active workspace", "info");
    return;
  }
  const workspace = registryWorkspace(activeWorkspaceId);
  if (!workspace) return;
  saveState();
  workspaceRegistry = workspaceRegistry.map((item) => item.id === workspace.id ? { ...item, status: "archived", updatedAt: new Date().toISOString() } : item);
  const next = workspaceRegistry.find((item) => item.status !== "archived");
  saveWorkspaceRegistry();
  activeWorkspaceId = next.id;
  saveActiveWorkspaceId(activeWorkspaceId);
  state = loadState();
  resetWorkspaceViewState();
  saveState();
  render();
  showToast(`Archived ${workspace.name}`, "success");
}

function saveWorkspaceDialog() {
  const action = document.querySelector("#workspace-dialog-action")?.value || "create";
  const name = document.querySelector("#workspace-dialog-name")?.value.trim() || "";
  if (action !== "archive" && !name) {
    showToast("Workspace name is required", "info");
    return;
  }
  if (action === "create") createWorkspaceWithName(name);
  if (action === "duplicate") duplicateWorkspaceWithName(name);
  if (action === "archive") archiveActiveWorkspaceConfirmed();
  closeDialog(els.workspaceDialog);
}

function syncRouteToTutorialStep() {
  if (!state.tutorial?.active) return;
  const { step } = activeTutorialStep();
  state.selectedRoute = routeFallback(step.route || "dashboard");
  if (step.settingsTab) state.selectedSettingsTab = settingsTabFallback(step.settingsTab);
  if (state.selectedRoute !== "project") state.selectedProjectTab = "overview";
  if (state.selectedRoute !== "company") state.selectedCompany = "all";
  openSidebarGroupForRoute(state.selectedRoute);
}

function startTutorial(step = 0) {
  state.tutorial = {
    ...state.tutorial,
    active: true,
    step: clamp(step, 0, tutorialSteps.length - 1)
  };
  syncRouteToTutorialStep();
  saveState();
  render();
}

function handleTutorialAction(action) {
  const current = clamp(Number(state.tutorial?.step || 0), 0, tutorialSteps.length - 1);
  if (action === "start") {
    startTutorial(state.tutorial?.completedAt ? 0 : current);
    return;
  }

  if (action === "next") {
    startTutorial(current + 1);
    return;
  }

  if (action === "prev") {
    startTutorial(current - 1);
    return;
  }

  if (action === "restart") {
    startTutorial(0);
    return;
  }

  if (action === "close" || action === "finish") {
    state.tutorial = {
      ...state.tutorial,
      active: false,
      step: action === "finish" ? tutorialSteps.length - 1 : current,
      completedAt: action === "finish" ? new Date().toISOString() : state.tutorial?.completedAt || ""
    };
    saveState();
    render();
    showToast(action === "finish" ? "Tutorial complete" : "Tutorial closed", action === "finish" ? "success" : "info");
  }
}

function openOnboardingWizard(step = state.onboarding?.wizardStep || 0) {
  const maxStep = onboardingWizardSteps().length - 1;
  state.onboarding = {
    ...state.onboarding,
    dismissed: false,
    wizardActive: true,
    wizardStep: clamp(Number(step || 0), 0, maxStep)
  };
  state.selectedRoute = "dashboard";
  openSidebarGroupForRoute("dashboard");
  saveState();
  render();
}

function saveOnboardingWorkspaceInline() {
  const name = document.querySelector("#onboarding-workspace-name")?.value.trim() || "";
  const slug = document.querySelector("#onboarding-workspace-slug")?.value.trim() || slugFromName(name);
  if (!name || !slug) {
    showToast("Workspace name and slug are required", "info");
    return;
  }

  state.workspace = {
    ...state.workspace,
    name,
    slug
  };
  addAuditEvent({
    action: "workspace_onboarding_update",
    detail: `Updated onboarding workspace details for ${name}`
  });
  saveState();
  render();
  showToast("Workspace details saved", "success");
}

function saveOnboardingStructureInline() {
  if (!canWrite("projects:write")) {
    showToast("Your role cannot create companies or projects", "info");
    return;
  }

  const companyName = document.querySelector("#onboarding-company-name")?.value.trim() || "";
  const projectName = document.querySelector("#onboarding-project-name")?.value.trim() || "";
  if (!companyName || !projectName) {
    showToast("Company and project names are required", "info");
    return;
  }

  const now = new Date().toISOString();
  const existingCompany = state.companies.find((company) => company.name.toLowerCase() === companyName.toLowerCase());
  const company = existingCompany || normalizeCompanyRecord({
    id: uid("company"),
    name: companyName,
    description: "Created during first-run setup.",
    type: "Client",
    owner: activeMemberId(),
    status: "Active"
  });
  if (!existingCompany) {
    state.companies = [company, ...state.companies];
  }

  const existingProject = state.projects.find((project) => project.name.toLowerCase() === projectName.toLowerCase());
  const project = existingProject || normalizeProjectRecord({
    id: uid("project"),
    name: projectName,
    companyId: company.id,
    description: "Created during first-run setup.",
    owner: activeMemberId(),
    startDate: todayKey(),
    dueDate: "",
    createdAt: now,
    updatedAt: now
  });
  if (!existingProject) {
    state.projects = [project, ...state.projects];
    addActivity({
      projectId: project.id,
      type: "project_create",
      message: `created project ${project.name} from onboarding`
    });
  }

  state.filters.company = company.id;
  state.selectedCompany = company.id;
  state.selectedProject = project.id;
  state.selectedRoute = "dashboard";
  state.onboarding = {
    ...state.onboarding,
    dismissed: false,
    wizardActive: true,
    wizardStep: 3
  };
  saveState();
  render();
  if (!existingCompany) syncRecordToApi("companies", company, "Company created in API", false);
  if (!existingProject) syncProjectToApi(project, "Project created in API", false);
  showToast(existingProject ? "Workspace structure already exists" : "Company and project created", "success");
}

async function saveOnboardingInviteInline() {
  const name = document.querySelector("#onboarding-invite-name")?.value.trim() || "";
  const email = document.querySelector("#onboarding-invite-email")?.value.trim() || "";
  const role = document.querySelector("#onboarding-invite-role")?.value || state.workspace.defaultRole;
  const companyId = state.filters.company !== "all" ? state.filters.company : state.companies[0]?.id || "";
  if (!email) {
    showToast("Invite requires an email address", "info");
    return;
  }

  if (apiSession) {
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
      addAuditEvent({
        action: "member_invite",
        detail: `Invited ${invitation.email} as ${invitation.role || role} from onboarding`
      });
      saveState();
      render();
      showToast(`Invite created for ${invitation.email}`, "success");
      return;
    } catch (error) {
      showToast(`Invite failed: ${error.message}`, "info");
      return;
    }
  }

  const invitation = {
    id: uid("invite"),
    token: uid("invite-token"),
    name,
    email,
    role,
    companyId,
    status: "pending",
    invitedBy: activeMemberId(),
    acceptUrl: "#invite/local-draft",
    createdAt: new Date().toISOString(),
    expiresAt: ""
  };
  state.invitations = [
    invitation,
    ...state.invitations.filter((item) => item.email !== email)
  ];
  addAuditEvent({
    action: "member_invite_draft",
    detail: `Prepared local invite draft for ${email}`
  });
  saveState();
  render();
  showToast("Draft invite saved locally. Connect the API to send it.", "success");
}

function saveOnboardingApiUrlInline() {
  persistApiBaseUrl(document.querySelector("#onboarding-api-url")?.value.trim() || "");
}

function handleOnboardingInlineAction(action) {
  if (action === "workspace") {
    saveOnboardingWorkspaceInline();
    return;
  }
  if (action === "structure") {
    saveOnboardingStructureInline();
    return;
  }
  if (action === "invite") {
    saveOnboardingInviteInline();
    return;
  }
  if (action === "api-url") {
    saveOnboardingApiUrlInline();
  }
}

function handleOnboardingAction(action) {
  const wizardSteps = onboardingWizardSteps();
  const wizardIndex = clamp(Number(state.onboarding?.wizardStep || 0), 0, wizardSteps.length - 1);

  if (action === "wizard") {
    state.onboarding = {
      ...state.onboarding,
      dismissed: false,
      wizardActive: !state.onboarding?.wizardActive,
      wizardStep: wizardIndex
    };
    state.selectedRoute = "dashboard";
    openSidebarGroupForRoute("dashboard");
    saveState();
    render();
    return;
  }

  if (action === "wizard-next" || action === "wizard-prev") {
    state.onboarding = {
      ...state.onboarding,
      dismissed: false,
      wizardActive: true,
      wizardStep: clamp(wizardIndex + (action === "wizard-next" ? 1 : -1), 0, wizardSteps.length - 1)
    };
    saveState();
    render();
    return;
  }

  if (action === "wizard-finish") {
    state.onboarding = {
      ...state.onboarding,
      dismissed: isOnboardingComplete(),
      wizardActive: false,
      completedAt: isOnboardingComplete() ? new Date().toISOString() : state.onboarding?.completedAt || ""
    };
    saveState();
    render();
    showToast(isOnboardingComplete() ? "Setup complete" : "Wizard saved. Finish the remaining setup steps when ready.", isOnboardingComplete() ? "success" : "info");
    return;
  }

  if (action === "mark-notifications" || action === "mark-templates") {
    state.onboarding = {
      ...state.onboarding,
      dismissed: false,
      wizardActive: true,
      notificationsReviewed: action === "mark-notifications" ? true : Boolean(state.onboarding?.notificationsReviewed),
      templatesReviewed: action === "mark-templates" ? true : Boolean(state.onboarding?.templatesReviewed)
    };
    saveState();
    render();
    showToast(action === "mark-notifications" ? "Notification setup reviewed" : "Template setup reviewed", "success");
    return;
  }

  if (action === "use-demo") {
    const nextState = normalizeState({
      ...structuredClone(seedData),
      selectedRoute: "dashboard",
      onboarding: {
        dismissed: false,
        sampleMode: "demo",
        completedAt: "",
        wizardActive: true,
        wizardStep: 1
      }
    });
    state = nextState;
    saveState();
    render();
    showToast("Demo workspace loaded", "success");
    return;
  }

  if (action === "start-clean") {
    state = createBlankWorkspaceState();
    state.onboarding = {
      ...state.onboarding,
      wizardActive: true,
      wizardStep: 1
    };
    saveState();
    render();
    showToast("Clean workspace started", "success");
    return;
  }

  if (action === "dismiss") {
    state.onboarding = {
      ...state.onboarding,
      dismissed: true,
      completedAt: isOnboardingComplete() ? new Date().toISOString() : state.onboarding?.completedAt || ""
    };
    saveState();
    render();
    showToast(isOnboardingComplete() ? "Setup complete" : "Setup hidden", "success");
    return;
  }

  if (action === "show") {
    openOnboardingWizard();
    return;
  }

  if (action === "import") {
    state.onboarding = { ...state.onboarding, dismissed: false, sampleMode: "import" };
    state.selectedRoute = "data";
    openSidebarGroupForRoute("data");
    saveState();
    render();
    showToast("Paste a CSV or JSON export to preview the import", "info");
    return;
  }

  if (action === "templates") {
    state.onboarding = { ...state.onboarding, dismissed: false, sampleMode: "template", templatesReviewed: true };
    state.selectedRoute = "templates";
    openSidebarGroupForRoute("templates");
    saveState();
    render();
    showToast("Choose a template to start with structured work", "info");
    return;
  }

  if (action === "review-templates") {
    state.onboarding = { ...state.onboarding, dismissed: false, templatesReviewed: true };
    state.selectedRoute = "templates";
    openSidebarGroupForRoute("templates");
    saveState();
    render();
    showToast("Review starter templates and marketplace packs", "info");
    return;
  }

  if (action === "project") {
    if (!canWrite("projects:write")) {
      showToast("Your role cannot create projects", "info");
      return;
    }
    if (!state.companies.length) {
      populateCompanyForm();
      openDialog(els.companyDialog);
      showToast("Create a company before the first project", "info");
      return;
    }
    populateProjectForm();
    openDialog(els.projectDialog);
    return;
  }

  if (action === "company") {
    if (!canWrite("projects:write")) {
      showToast("Your role cannot manage companies", "info");
      return;
    }
    populateCompanyForm();
    openDialog(els.companyDialog);
    return;
  }

  if (action === "notifications") {
    state.onboarding = { ...state.onboarding, dismissed: false, notificationsReviewed: true };
    state.selectedRoute = "settings";
    state.selectedSettingsTab = "integrations";
    openSidebarGroupForRoute("settings");
    saveState();
    render();
    showToast("Review notification preferences and delivery settings", "info");
    return;
  }

  if (["account", "sync", "workspace", "invite"].includes(action)) {
    state.selectedRoute = "settings";
    state.selectedSettingsTab = action === "invite" ? "members" : action;
    openSidebarGroupForRoute("settings");
    saveState();
    render();
  }
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

function routeFeedbackFromLocation({ shouldRender = false } = {}) {
  const route = new URLSearchParams(window.location.search).get("route");
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  if (route !== "feedback" && hash !== "feedback") return false;

  state.selectedRoute = "feedback";
  state.selectedInviteToken = "";
  state.selectedProject = "all";
  state.selectedCompany = "all";
  saveState();
  if (shouldRender) render();
  return true;
}

function routeFromLocation({ shouldRender = false } = {}) {
  const route = new URLSearchParams(window.location.search).get("route");
  if (!route) return false;
  const nextRoute = routeFallback(route.trim());
  if (!routes[nextRoute]) return false;
  state.selectedRoute = nextRoute;
  if (nextRoute !== "project") state.selectedProjectTab = "overview";
  openSidebarGroupForRoute(nextRoute);
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
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot edit tasks", "info");
    render();
    return;
  }
  const next = { ...previous, ...updates, updatedAt: new Date().toISOString() };
  state.tasks = state.tasks.map((task) => task.id === id ? next : task);
  recordTaskChanges(previous, next);
  saveState();
  render();
  showToast(`${next.title} updated`, "success");
  syncTaskToApi(next, "Task synced to API", false, recordRevisionValue(previous));
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

  state.projects = state.projects.map((item) => item.id === id ? { ...item, [field]: date, updatedAt: new Date().toISOString() } : item);
  const nextProject = byId(state.projects, id);
  addActivity({
    projectId: id,
    type: "project_date",
    message: `changed project ${field === "startDate" ? "start" : "due"} date to ${formatFullDate(date)}`
  });
  saveState();
  render();
  showToast("Project date updated", "success");
  syncProjectToApi(nextProject, "Project synced to API", false, recordRevisionValue(project));
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
  applyWorkspaceTheme();
  const allowedRoute = routeFallback(state.selectedRoute);
  if (allowedRoute !== state.selectedRoute) {
    state.selectedRoute = allowedRoute;
    state.selectedProject = "all";
    state.selectedCompany = isClientSession() ? clientCompanyId() : state.selectedCompany;
    saveState();
  }
  if (state.selectedProject !== "all" && !canAccessProject(state.selectedProject)) {
    state.selectedProject = "all";
    state.selectedRoute = "dashboard";
    saveState();
  }
  if (state.selectedCompany !== "all" && !canAccessCompany(state.selectedCompany)) {
    state.selectedCompany = "all";
    state.filters.company = "all";
    saveState();
  }
  if (state.filters.company !== "all" && !canAccessCompany(state.filters.company)) {
    state.filters.company = "all";
    saveState();
  }
  const selectedProject = byId(state.projects, state.selectedProject);
  const selectedCompany = byId(state.companies, state.selectedCompany);
  els.pageTitle.textContent = state.selectedRoute === "project" && selectedProject
    ? selectedProject.name
    : state.selectedRoute === "company" && selectedCompany
      ? selectedCompany.name
      : routes[state.selectedRoute];
  document.title = state.selectedRoute === "landing" ? "Agora - Open Source Project Management" : `${els.pageTitle.textContent} - Agora`;
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
  renderSearchResults();
  renderNotificationBadges();
  renderPermissionChrome();
  renderWorkspaceSwitcher();
  renderConnectionBanner();
  document.querySelector(".brand small").textContent = state.workspace.name;
  document.body.classList.toggle("is-landing-route", state.selectedRoute === "landing");

  const routeRenderers = {
    landing: renderLandingPage,
    launch: renderLaunchWorkspaceFlow,
    portal: renderClientPortal,
    project: renderProjectPage,
    company: renderCompanyPage,
    daily: renderDailyTasks,
    inbox: renderInbox,
    board: renderBoard,
    list: renderList,
    calendar: renderCalendar,
    "my-work": renderMyWork,
    time: renderTimeTracking,
    operator: renderOperatorCenter,
    collaboration: renderCollaborationHub,
    reports: renderReports,
    goals: renderGoals,
    marketplace: renderMarketplaceHub,
    templates: renderTemplates,
    automations: renderAutomations,
    docs: renderDocsAndFiles,
    intake: renderIntake,
    "feature-requests": renderFeatureRequests,
    fields: renderCustomFields,
    audit: renderAuditLog,
    permissions: renderPermissionsAudit,
    readiness: renderProductionReadinessAudit,
    data: renderDataManagement,
    settings: renderSettings,
    companies: renderCompanies,
    invite: renderInviteAcceptance,
    feedback: renderPublicFeedbackForm,
    dashboard: renderDashboard
  };

  try {
    routeRenderers[state.selectedRoute]?.();
  } catch (error) {
    console.error("Agora route render error", error);
    els.appView.innerHTML = `
      <section class="panel">
        <p class="eyebrow">View error</p>
        <h2>${escapeHtml(routes[state.selectedRoute] || "View")} could not render</h2>
        <p>${escapeHtml(error.message || "Something went wrong while rendering this view.")}</p>
      </section>
    `;
  }
  renderTutorialOverlay();
  heartbeatPresence();
  renderPresenceCursors();
  refreshSmoothScroll();
}

function sidebarGroupForRoute(route) {
  if (["landing", "dashboard", "launch", "portal", "daily", "inbox"].includes(route)) return "home";
  if (["board", "list", "calendar", "my-work", "time", "operator", "collaboration"].includes(route)) return "work";
  if (["reports", "goals", "marketplace", "templates", "automations", "docs", "intake", "fields", "companies", "company"].includes(route)) return "manage";
  if (["audit", "permissions", "readiness", "data", "settings"].includes(route)) return "admin";
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
    item.hidden = !canAccessRoute(item.dataset.route);
  });
  document.querySelectorAll("[data-nav-group]").forEach((group) => {
    group.hidden = !group.querySelector(".nav-item:not([hidden])");
  });
  const newProjectButton = document.querySelector("#new-project-button");
  if (newProjectButton) {
    newProjectButton.hidden = client;
    newProjectButton.disabled = !canWrite("projects:write");
    newProjectButton.title = canWrite("projects:write") ? "" : "Your role cannot create projects.";
  }
  const newTaskButton = document.querySelector("#new-task-button");
  if (newTaskButton) {
    newTaskButton.hidden = client;
    newTaskButton.disabled = !canWrite("tasks:write");
    newTaskButton.title = canWrite("tasks:write") ? "" : "Your role cannot create tasks.";
  }
  const featureRequestButton = document.querySelector("#feature-request-button");
  if (featureRequestButton) {
    featureRequestButton.hidden = client;
    featureRequestButton.disabled = !canWrite("tasks:write");
    featureRequestButton.title = canWrite("tasks:write") ? "" : "Your role cannot submit feature requests.";
  }
  const notificationButton = document.querySelector("#notification-button");
  if (notificationButton) notificationButton.hidden = client;
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

function renderWorkspaceSwitcher() {
  if (!els.workspaceSwitcher) return;
  const activeWorkspaces = workspaceRegistry.filter((workspace) => workspace.status !== "archived");
  els.workspaceSwitcher.innerHTML = activeWorkspaces.map((workspace) => `
    <option value="${escapeHtml(workspace.id)}" ${workspace.id === activeWorkspaceId ? "selected" : ""}>
      ${escapeHtml(workspace.name)}
    </option>
  `).join("");
  els.workspaceSwitcher.disabled = activeWorkspaces.length <= 1;
  if (els.workspaceArchive) {
    els.workspaceArchive.disabled = activeWorkspaces.length <= 1;
    els.workspaceArchive.title = activeWorkspaces.length <= 1 ? "Keep at least one active workspace." : "Archive workspace";
  }
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
  const companyOptions = visibleCompanies();
  const projectOptions = state.filters.company === "all"
    ? activeProjects()
    : activeProjects().filter((project) => project.companyId === state.filters.company);

  els.searchInput.value = state.filters.query;
  els.companyFilter.innerHTML = `
    <option value="all">All companies</option>
    ${companyOptions.map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join("")}
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
  if (els.savedViewFilter) {
    const activeSavedViewId = currentSavedViewId();
    els.savedViewFilter.innerHTML = `
      <option value="">${activeSavedViewId ? "Saved view" : "Custom view"}</option>
      ${state.savedViews.map((view) => `<option value="${view.id}">${view.pinned ? "Pinned - " : ""}${escapeHtml(view.name)}</option>`).join("")}
    `;
    els.savedViewFilter.value = activeSavedViewId;
  }

  els.companyFilter.value = state.filters.company;
  els.projectFilter.value = state.selectedProject;
  els.assigneeFilter.value = state.filters.assignee;
  els.statusFilter.value = state.filters.status;
  els.priorityFilter.value = state.filters.priority;
  const hasSavedView = Boolean(currentSavedViewId() || els.savedViewFilter?.value);
  [els.updateViewButton, els.renameViewButton, els.pinViewButton, els.deleteViewButton].filter(Boolean).forEach((button) => {
    button.disabled = !hasSavedView;
  });
  const pinnedView = state.savedViews.find((view) => view.id === (els.savedViewFilter?.value || currentSavedViewId()));
  if (els.pinViewButton) els.pinViewButton.textContent = pinnedView?.pinned ? "Unpin" : "Pin";
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
          <span>iPhone safe areas</span>
          <span>iPad layouts</span>
        </div>
        <div class="mobile-roadmap-list">
          <article>
            <strong>Next native step</strong>
            <p>Keep the PWA as the canonical mobile surface, then wrap the proven flows for app-store distribution.</p>
          </article>
          <article>
            <strong>Offline capture</strong>
            <p>Queue tasks, comments, and time entries locally before syncing through the API.</p>
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderLandingPage() {
  els.appView.innerHTML = `
    <article class="landing-page">
      <section class="landing-hero">
        <nav class="landing-nav" aria-label="Landing">
          <div class="landing-brand">
            <img src="./assets/agora-mark.svg" alt="" width="38" height="38">
            <strong>Agora</strong>
          </div>
          <div>
            <button class="button button-secondary" type="button" data-route="dashboard">Open App</button>
            <button class="button button-primary" type="button" data-route="settings">Connect API</button>
          </div>
        </nav>

        <div class="landing-hero-copy">
          <p class="eyebrow">Open source project management</p>
          <h1>Agora</h1>
          <p class="landing-lede">Open source project management without ads, trackers, or lock-in. Run projects, clients, daily work, approvals, docs, automations, and time tracking from a self-hostable workspace your team can actually own.</p>
          <div class="landing-actions">
            <button class="button button-primary" type="button" data-command-id="launch:workspace">Launch Workspace</button>
            <button class="button button-secondary" type="button" data-route="portal">View Client Portal</button>
          </div>
          <div class="landing-proof-row" aria-label="Product promises">
            <span>No ads</span>
            <span>Self-hostable</span>
            <span>Portable exports</span>
            <span>Auditable AI</span>
          </div>
        </div>
      </section>

      <section class="landing-section landing-problem">
        <div>
          <p class="eyebrow">The problem</p>
          <h2>Project tools became noisy places to rent your own workflow.</h2>
        </div>
        <div class="landing-problem-grid">
          <article>
            <span>01</span>
            <h3>Work is scattered</h3>
            <p>Tasks, client updates, files, time, and approvals drift into separate tools, so managers spend the day reconciling instead of leading.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Teams lose context</h3>
            <p>Stakeholders need visibility, but most tools either expose too much internal noise or force project managers to make status reports by hand.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Software watches back</h3>
            <p>Ads, trackers, upsells, and closed data models turn operational software into another channel you do not fully control.</p>
          </article>
        </div>
      </section>

      <section class="landing-section landing-solution">
        <div class="landing-solution-copy">
          <p class="eyebrow">The answer</p>
          <h2>A calmer operating layer for modern teams.</h2>
          <p>Agora brings project management into one workspace: boards, lists, calendars, daily planning, company views, client portals, docs, files, intake, notifications, reports, templates, automations, and structured API storage.</p>
          <button class="button button-primary" type="button" data-route="templates">Explore Templates</button>
        </div>
        <div class="landing-signal-stack" aria-label="Agora capabilities">
          <article><strong>Client-ready operations</strong><span>Company-scoped visibility, approvals, time, reports, and portals for multi-client work.</span></article>
          <article><strong>Open data path</strong><span>Local JSON today, portable bundles, API sync, and Supabase-backed records when ready.</span></article>
          <article><strong>AI with receipts</strong><span>Operator actions use permissions, previews, rationale, audit logs, and undo paths.</span></article>
          <article><strong>No ads, ever</strong><span>The workspace exists to organize work, not monetize attention.</span></article>
        </div>
      </section>

      <section class="landing-section landing-product-proof">
        <div class="landing-product-copy">
          <p class="eyebrow">Product proof</p>
          <h2>The launch story is already visible in the app.</h2>
          <p>Dashboard readiness, board work, inbox signals, marketplace packs, mobile planning, and portable exports all live in the same dependency-free prototype.</p>
        </div>
        <div class="landing-product-frame">
          <img src="./assets/screenshots/agora-dashboard.png" alt="Agora dashboard showing workspace setup and launch readiness.">
        </div>
        <div class="landing-proof-metrics" aria-label="Launch proof points">
          <article><strong>Browser local first</strong><span>Run the app without trackers or external services.</span></article>
          <article><strong>Self-hosting path</strong><span>Connect the dependency-free API and optional Supabase storage.</span></article>
          <article><strong>Portable workspace</strong><span>Export JSON, CSV, Markdown, templates, automations, audit, and operator context.</span></article>
          <article><strong>Permissioned AI</strong><span>Preview Operator actions with rationale, audit logs, and undo paths.</span></article>
        </div>
      </section>

      <section class="landing-section landing-choice">
        <div>
          <p class="eyebrow">Why teams choose Agora</p>
          <h2>Project clarity with ownership built in.</h2>
        </div>
        <div class="landing-choice-grid">
          <article>
            <span>Own your data</span>
            <p>Export portable bundles, keep local backups, connect the API when ready, and use Supabase without surrendering the workspace.</p>
          </article>
          <article>
            <span>No ads</span>
            <p>Agora is built as team infrastructure, not an attention surface, behavioral feed, or upsell maze.</p>
          </article>
          <article>
            <span>Client-ready</span>
            <p>Company views, portals, approvals, reports, and time tracking support agencies and multi-client teams.</p>
          </article>
          <article>
            <span>AI with receipts</span>
            <p>Operator actions are permissioned, previewable, logged with rationale, and designed with undo paths where possible.</p>
          </article>
          <article>
            <span>Open marketplace</span>
            <p>Project templates and automation packs move as JSON, with creator, pricing, and charity payout metadata.</p>
          </article>
        </div>
      </section>

      <section class="landing-section landing-no-ads">
        <div>
          <p class="eyebrow">The promise</p>
          <h2>No ads. No trackers. No borrowed attention.</h2>
        </div>
        <p>Agora is designed as open source infrastructure for teams. Your project workspace should not become an ad surface, a behavioral data feed, or a hostage negotiation with your own exports.</p>
      </section>
    </article>
  `;
}

function discussionLinkTargets(projectId = "") {
  const projectTasks = activeTasks()
    .filter((task) => !projectId || task.projectId === projectId)
    .slice(0, 20)
    .map((task) => ({ type: "task", id: task.id, label: `Task: ${task.title}` }));
  const projectDocs = state.documents
    .filter((document) => !projectId || document.projectId === projectId)
    .slice(0, 12)
    .map((document) => ({ type: "document", id: document.id, label: `Doc: ${document.title}` }));
  const projectApprovals = state.approvals
    .filter((approval) => approval.status !== "approved")
    .filter((approval) => !projectId || approval.projectId === projectId)
    .slice(0, 12)
    .map((approval) => ({ type: "approval", id: approval.id, label: `Approval: ${approval.title}` }));
  return [...projectTasks, ...projectDocs, ...projectApprovals];
}

function parseDiscussionLink(value = "") {
  const [linkType, ...rest] = String(value || "").split(":");
  const linkId = rest.join(":");
  if (!["task", "document", "approval"].includes(linkType) || !linkId) return { linkType: "", linkId: "" };
  return { linkType, linkId };
}

function discussionLinkLabel(message) {
  if (message.linkType === "task") return byId(state.tasks, message.linkId)?.title || "Linked task";
  if (message.linkType === "document") return byId(state.documents, message.linkId)?.title || "Linked doc";
  if (message.linkType === "approval") return byId(state.approvals, message.linkId)?.title || "Linked approval";
  return "";
}

function discussionLinkProjectId(link) {
  if (link.linkType === "task") return byId(state.tasks, link.linkId)?.projectId || "";
  if (link.linkType === "document") return byId(state.documents, link.linkId)?.projectId || "";
  if (link.linkType === "approval") return byId(state.approvals, link.linkId)?.projectId || "";
  return "";
}

function projectDiscussionRows() {
  return activeProjects().map((project) => {
    const messages = state.chatMessages.filter((message) => message.projectId === project.id);
    const linked = messages.filter((message) => message.linkType);
    return {
      project,
      messages,
      linked,
      lastMessage: [...messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    };
  }).filter((row) => row.messages.length || getProjectTasks(row.project.id, false).length).slice(0, 6);
}

function renderCollaborationHub() {
  const messages = [...state.chatMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-30);
  const activeBoard = state.whiteboards[0] || { id: "", title: "Workspace Canvas", projectId: "", items: [] };
  const decisions = activeBoard.items.filter((item) => item.type === "decision").length;
  const risks = activeBoard.items.filter((item) => item.type === "risk").length;
  const liveMembers = liveWorkspacePresence();
  const editingSignals = liveEditingSignals();
  const discussionRows = projectDiscussionRows();
  const linkTargets = discussionLinkTargets();

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Messages", state.chatMessages.length)}
      ${metric("Boards", state.whiteboards.length)}
      ${metric("Decisions", decisions)}
      ${metric("Risks", risks)}
      ${metric("Live now", liveMembers.length)}
      ${metric("Editing", editingSignals.length)}
    </div>

      ${renderLiveCollaborationPanel()}

      <div class="collab-hub-grid">
      <section class="panel project-discussion-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Discussions</p>
            <h2>Project rooms</h2>
          </div>
          <span class="status-pill ${realtimeTransportStatus === "events" ? "inbox-green" : "inbox-neutral"}">${realtimeTransportStatus === "events" ? "Event stream" : "Polling fallback"}</span>
        </div>
        <div class="project-discussion-list">
          ${discussionRows.length ? discussionRows.map(renderProjectDiscussionRow).join("") : emptyState("Project-linked discussions will appear after the first message.")}
        </div>
      </section>

      <section class="panel workspace-chat-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Chat</p>
            <h2>Workspace channels</h2>
          </div>
          <span class="status-pill inbox-blue">Local first</span>
        </div>
        <div class="chat-message-list">
          ${messages.length ? messages.map(renderWorkspaceChatMessage).join("") : emptyState("No workspace messages yet.")}
        </div>
        <div class="workspace-chat-composer">
          <label>
            <span>Channel</span>
            <select id="chat-channel">
              ${["general", "delivery", "product", "client"].map((channel) => `<option value="${channel}">#${channel}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select id="chat-project">
              <option value="">No project link</option>
              ${activeProjects().map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Link</span>
            <select id="chat-link">
              <option value="">No linked object</option>
              ${linkTargets.map((target) => `<option value="${target.type}:${target.id}">${escapeHtml(target.label)}</option>`).join("")}
            </select>
          </label>
          <label class="wide-field">
            <span>Message</span>
            <textarea id="chat-message-body" rows="3" placeholder="Share a decision, blocker, update, or @mention"></textarea>
          </label>
          <button class="button button-primary" type="button" id="chat-send">Send Message</button>
        </div>
      </section>

      <section class="panel whiteboard-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Whiteboard</p>
            <h2>${escapeHtml(activeBoard.title)}</h2>
          </div>
          <span class="status-pill inbox-neutral">${activeBoard.items.length} notes</span>
        </div>
        <div class="whiteboard-canvas" aria-label="${escapeHtml(activeBoard.title)} board">
          ${activeBoard.items.length ? activeBoard.items.map(renderWhiteboardItem).join("") : emptyState("Add a note to start the canvas.")}
        </div>
        <div class="whiteboard-composer">
          <label>
            <span>Type</span>
            <select id="whiteboard-item-type">
              <option value="note">Note</option>
              <option value="decision">Decision</option>
              <option value="risk">Risk</option>
            </select>
          </label>
          <label>
            <span>Color</span>
            <select id="whiteboard-item-color">
              <option value="green">Green</option>
              <option value="amber">Amber</option>
              <option value="blue">Blue</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
          <label class="wide-field">
            <span>Note</span>
            <input id="whiteboard-item-text" placeholder="Add a note, decision, or risk">
          </label>
          <button class="button button-secondary" type="button" id="whiteboard-add-note">Add to Board</button>
        </div>
      </section>
    </div>
  `;
}

function renderWorkspaceChatMessage(message) {
  const linkLabel = discussionLinkLabel(message);
  return `
    <article class="workspace-chat-message">
      <span class="avatar">${memberName(message.author).split(" ").map((part) => part[0]).join("")}</span>
      <div>
        <div class="chat-message-meta">
          <strong>${escapeHtml(memberName(message.author))}</strong>
          <small>#${escapeHtml(message.channel)} ${message.projectId ? `/ ${escapeHtml(projectName(message.projectId))}` : ""} / ${escapeHtml(formatTimestamp(message.createdAt))}</small>
        </div>
        <p>${renderCommentBody(message.body)}</p>
        ${linkLabel ? `<span class="discussion-link-pill">${escapeHtml(message.linkType)}: ${escapeHtml(linkLabel)}</span>` : ""}
      </div>
    </article>
  `;
}

function renderProjectDiscussionRow(row) {
  return `
    <article class="project-discussion-row">
      <div>
        <strong>${escapeHtml(row.project.name)}</strong>
        <span>${row.lastMessage ? escapeHtml(row.lastMessage.body.slice(0, 90)) : "No messages yet"}</span>
        <small>${row.lastMessage ? `${escapeHtml(memberName(row.lastMessage.author))} / ${escapeHtml(formatTimestamp(row.lastMessage.createdAt))}` : `${getProjectTasks(row.project.id, false).length} tasks ready for discussion`}</small>
      </div>
      <div class="project-discussion-stats">
        <span>${row.messages.length} messages</span>
        <span>${row.linked.length} linked</span>
      </div>
    </article>
  `;
}

function renderWhiteboardItem(item) {
  return `
    <article class="whiteboard-note whiteboard-${item.color} whiteboard-${item.type}" style="left: ${item.x}%; top: ${item.y}%;">
      <span>${escapeHtml(item.type)}</span>
      <strong>${escapeHtml(item.text)}</strong>
    </article>
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
    ${renderRouteHeader({
      eyebrow: "Dashboard",
      title: "Launch the first client workspace",
      description: "Start with the client onboarding project, add the agency handoff workflow, then prove recovery before inviting the team.",
      actions: [
        { label: "Launch Workspace", commandId: "launch:workspace", primary: true },
        { label: "Open Today", route: "daily" }
      ]
    })}
    ${renderWorkspaceTrustStrip()}
    ${renderGoldenPathPanel()}

    <div class="metric-grid">
      ${metric("Open tasks", openTasks.length)}
      ${metric("Completed", completedTasks.length)}
      ${metric("Overdue", overdueTasks.length)}
      ${metric("Progress", `${completionRate}%`)}
    </div>

    <div class="dashboard-support-grid">
      ${renderOnboardingPanel()}
      ${renderLaunchReadinessPanel()}
      ${renderTeamLaunchChecklistPanel()}
    </div>

    ${renderDashboardBuilder()}

    <div class="dashboard-grid">
      ${renderDashboardWidgets({ visibleProjects, dueSoonTasks, tasks, timeEntries: getFilteredTimeEntries() })}
    </div>
  `;
}

function workspaceTrustSignals() {
  const recovery = portableRecoveryStatus();
  const latestBackup = recovery.latestBackup ? `Latest backup ${formatTimestamp(recovery.latestBackup.createdAt)}` : "Create a backup before risky imports";
  const health = backendHealth || apiSession?.backendHealth || {};
  const productionGates = Array.isArray(health.productionGates) ? health.productionGates : [];
  const failedProductionGates = productionGates.filter((gate) => !gate.done);
  const backendValue = health.productionMode ? "Production" : apiSession ? "API connected" : "Local";
  const backendDetail = apiSession
    ? `${apiBackendLabel()} / ${apiLastSyncedLabel()}`
    : "Browser storage until API is connected";
  const securityValue = productionGates.length
    ? failedProductionGates.length
      ? `${failedProductionGates.length} gate${failedProductionGates.length === 1 ? "" : "s"} open`
      : "Gates pass"
    : apiSession
      ? "Check gates"
      : "Local mode";
  const securityDetail = productionGates.length
    ? failedProductionGates.length
      ? "Refresh health after fixing hosted launch gates"
      : `${productionGates.length} hosted launch gates passing`
    : apiSession
      ? "Refresh backend health for hosted auth, CORS, and proxy gates"
      : "No hosted surface is active in this browser workspace";

  return [
    {
      label: "Recovery",
      value: `${recovery.score}/4 ready`,
      detail: recovery.score >= 3 ? "Portable bundle and recovery evidence are available" : latestBackup,
      tone: recovery.score >= 3 ? "inbox-green" : "inbox-amber",
      commandId: "recovery:plan"
    },
    {
      label: "Backend",
      value: backendValue,
      detail: backendDetail,
      tone: health.productionMode ? "inbox-green" : apiSession ? "inbox-blue" : "inbox-neutral",
      commandId: "settings:sync"
    },
    {
      label: "Security",
      value: securityValue,
      detail: securityDetail,
      tone: productionGates.length
        ? failedProductionGates.length ? "inbox-amber" : "inbox-green"
        : apiSession ? "inbox-amber" : "inbox-neutral",
      commandId: "settings:sync"
    }
  ];
}

function renderWorkspaceTrustStrip() {
  return `
    <section class="workspace-trust-strip" aria-label="Workspace trust indicators">
      ${workspaceTrustSignals().map((signal) => `
        <article class="workspace-trust-card">
          <div>
            <span class="status-pill ${signal.tone}">${escapeHtml(signal.label)}</span>
            <strong>${escapeHtml(signal.value)}</strong>
            <small>${escapeHtml(signal.detail)}</small>
          </div>
          <button class="button button-secondary compact-button" type="button" data-command-id="${escapeHtml(signal.commandId)}">Review</button>
        </article>
      `).join("")}
    </section>
  `;
}

function openLaunchWorkspaceFlow() {
  state.selectedRoute = "launch";
  openSidebarGroupForRoute("launch");
  saveState();
  render();
}

function launchWorkspaceItems() {
  const template = recommendedFirstTemplate();
  const pack = recommendedAutomationPack();
  const recovery = portableRecoveryStatus();
  const hasTeamAccess = state.memberships.filter((membership) => membership.status !== "revoked").length > 1
    || state.invitations.some((invitation) => invitation.status === "pending");
  const hasClientProject = activeProjects().length > 0 && state.companies.some((company) => company.status !== "Archived");
  return [
    {
      label: "Client workspace",
      detail: hasClientProject ? `${activeProjects().length} active project${activeProjects().length === 1 ? "" : "s"} ready` : "Create the client and first project.",
      done: hasClientProject,
      action: "Create Structure"
    },
    {
      label: "Starter template",
      detail: template ? `${template.name} is available for project setup.` : "Add or import a project template.",
      done: Boolean(template && state.projectTemplates.length),
      action: "Review Template"
    },
    {
      label: "Handoff automation",
      detail: pack ? automationMarketplaceInstalled(pack) ? `${pack.name} is installed.` : `${pack.name} is ready to install.` : "Add an automation pack.",
      done: Boolean(pack && automationMarketplaceInstalled(pack)),
      action: "Install Pack"
    },
    {
      label: "Recovery proof",
      detail: recovery.score >= 3 ? "Portable recovery has local evidence." : "Create a backup and export the bundle.",
      done: recovery.score >= 3,
      action: "Create Backup"
    },
    {
      label: "Team invite",
      detail: hasTeamAccess ? "Members or pending invitations are configured." : "Prepare the first teammate invite.",
      done: hasTeamAccess,
      action: "Prep Invite"
    }
  ];
}

function renderLaunchProgressPanel() {
  const items = launchWorkspaceItems();
  const doneCount = items.filter((item) => item.done).length;
  return `
    <section class="panel launch-progress-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Launch progress</p>
          <h2>${doneCount}/${items.length} ready</h2>
        </div>
        <span class="status-pill ${doneCount === items.length ? "inbox-green" : "inbox-amber"}">${doneCount === items.length ? "Ready" : "In progress"}</span>
      </div>
      <div class="launch-step-grid">
        ${items.map((item, index) => `
          <article class="launch-step ${item.done ? "is-done" : "is-open"}">
            <span>${item.done ? "OK" : index + 1}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.detail)}</p>
            <small>${escapeHtml(item.done ? "Complete" : item.action)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLaunchClientSetupPanel() {
  const firstClient = state.companies.find((company) => company.type === "Client" && company.status !== "Archived") || visibleCompanies()[0] || {};
  const firstProject = activeProjects()[0] || {};
  return `
    <section class="panel launch-flow-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 1</p>
          <h2>Create the client workspace</h2>
        </div>
        <span class="status-pill ${activeProjects().length ? "inbox-green" : "inbox-amber"}">${activeProjects().length ? "Project ready" : "Needs project"}</span>
      </div>
      <div class="launch-inline-form">
        <label>
          <span>Client</span>
          <input id="onboarding-company-name" value="${escapeHtml(firstClient.name || "First Client")}" placeholder="First Client">
        </label>
        <label>
          <span>Project</span>
          <input id="onboarding-project-name" value="${escapeHtml(firstProject.name || "Client onboarding launch")}" placeholder="Client onboarding launch">
        </label>
        <button class="button button-primary" type="button" data-onboarding-inline="structure">Create Structure</button>
        <button class="button button-secondary" type="button" data-command-id="template:recommended">Review Template</button>
      </div>
    </section>
  `;
}

function renderLaunchAutomationSetupPanel() {
  const pack = recommendedAutomationPack();
  const installed = pack ? automationMarketplaceInstalled(pack) : false;
  return `
    <section class="panel launch-flow-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 2</p>
          <h2>Install the handoff workflow</h2>
        </div>
        <span class="status-pill ${installed ? "inbox-green" : "inbox-amber"}">${installed ? "Installed" : "Ready"}</span>
      </div>
      <p class="panel-note">${pack ? escapeHtml(pack.description) : "Automation packs add repeatable approval follow-ups and client update habits."}</p>
      <div class="launch-action-row">
        ${pack ? `<button class="button button-primary" type="button" data-install-automation-pack="${escapeHtml(pack.id)}" ${installed ? "disabled" : ""}>${installed ? "Installed" : "Install Pack"}</button>` : ""}
        <button class="button button-secondary" type="button" data-command-id="automation:recommended">Review Marketplace</button>
      </div>
    </section>
  `;
}

function renderLaunchRecoverySetupPanel() {
  const recovery = portableRecoveryStatus();
  const latestBackup = recovery.latestBackup ? formatTimestamp(recovery.latestBackup.createdAt) : "No backup yet";
  return `
    <section class="panel launch-flow-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 3</p>
          <h2>Prove recovery</h2>
        </div>
        <span class="status-pill ${recovery.score >= 3 ? "inbox-green" : "inbox-amber"}">${recovery.score}/4 ready</span>
      </div>
      <div class="launch-fact-grid">
        <article><strong>${recovery.files.length}</strong><span>Bundle files</span></article>
        <article><strong>${recovery.backups.length}</strong><span>Local backups</span></article>
        <article><strong>${escapeHtml(latestBackup)}</strong><span>Latest backup</span></article>
      </div>
      <div class="launch-action-row">
        <button class="button button-primary" type="button" data-recovery-action="create-backup">Create Backup</button>
        <button class="button button-secondary" type="button" data-recovery-action="download-bundle">Download Bundle</button>
        <button class="button button-secondary" type="button" data-command-id="recovery:plan">Open Recovery Plan</button>
      </div>
    </section>
  `;
}

function renderLaunchInviteSetupPanel() {
  const hasTeamAccess = state.memberships.filter((membership) => membership.status !== "revoked").length > 1
    || state.invitations.some((invitation) => invitation.status === "pending");
  return `
    <section class="panel launch-flow-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Step 4</p>
          <h2>Invite the first teammate</h2>
        </div>
        <span class="status-pill ${hasTeamAccess ? "inbox-green" : "inbox-neutral"}">${hasTeamAccess ? "Access ready" : apiSession ? "API invite" : "Draft invite"}</span>
      </div>
      <div class="launch-inline-form">
        <label>
          <span>Name</span>
          <input id="onboarding-invite-name" placeholder="Jordan Lee">
        </label>
        <label>
          <span>Email</span>
          <input id="onboarding-invite-email" type="email" placeholder="jordan@company.com">
        </label>
        <label>
          <span>Role</span>
          <select id="onboarding-invite-role">
            ${workspaceRoles.map((role) => `<option value="${role.id}" ${role.id === state.workspace.defaultRole ? "selected" : ""}>${escapeHtml(role.label)}</option>`).join("")}
          </select>
        </label>
        <button class="button button-primary" type="button" data-onboarding-inline="invite">${apiSession ? "Send Invite" : "Save Draft Invite"}</button>
        <button class="button button-secondary" type="button" data-command-id="settings:members">Open Members</button>
      </div>
    </section>
  `;
}

function renderLaunchWorkspaceFlow() {
  const items = launchWorkspaceItems();
  const doneCount = items.filter((item) => item.done).length;
  els.appView.innerHTML = `
    ${renderRouteHeader({
      eyebrow: "Launch flow",
      title: "Launch the first client workspace",
      description: "Create the client project, install the handoff workflow, prove recovery, and prepare the first teammate invite from one focused path.",
      actions: [
        { label: "Open Dashboard", route: "dashboard" },
        { label: "Open Command Palette", id: "open-command-palette", primary: true }
      ]
    })}

    ${renderLaunchProgressPanel()}

    <div class="launch-flow-grid">
      ${renderLaunchClientSetupPanel()}
      ${renderLaunchAutomationSetupPanel()}
      ${renderLaunchRecoverySetupPanel()}
      ${renderLaunchInviteSetupPanel()}
    </div>

    ${doneCount === items.length ? `
      <section class="panel launch-complete-panel">
        <div>
          <p class="eyebrow">Ready</p>
          <h2>This workspace has a launch spine.</h2>
          <p class="panel-note">The first client project, workflow automation, recovery evidence, and team access are in place. From here, Today and Inbox become the daily operating loop.</p>
        </div>
        <div class="launch-action-row">
          <button class="button button-primary" type="button" data-route="daily">Open Today</button>
          <button class="button button-secondary" type="button" data-route="inbox">Open Inbox</button>
        </div>
      </section>
    ` : ""}
  `;
}

function readinessScore(items) {
  return {
    done: items.filter((item) => item.done).length,
    total: items.length
  };
}

function readinessTone(score) {
  if (score.done === score.total) return "green";
  if (score.done / Math.max(score.total, 1) >= 0.65) return "amber";
  return "red";
}

function productionAuditRecoveryItems() {
  const recovery = portableRecoveryStatus();
  const hasExport = state.auditEvents.some((event) => event.action === "workspace_export");
  return [
    {
      label: "Portable bundle",
      done: recovery.files.some((file) => file.path === "workspace.json") && recovery.files.some((file) => file.path === "README.md"),
      detail: `${recovery.files.length} files available in the generated bundle`
    },
    {
      label: "Local backup",
      done: recovery.backups.length > 0,
      detail: recovery.backups.length ? `${recovery.backups.length} backup${recovery.backups.length === 1 ? "" : "s"} saved` : "Create a backup before imports, restores, or launch changes"
    },
    {
      label: "Export evidence",
      done: hasExport || recovery.backups.length > 0,
      detail: hasExport ? "Workspace export appears in the audit trail" : "Download a bundle or create a backup to leave evidence"
    },
    {
      label: "Restore preview",
      done: Boolean(state.portableImportPreview || state.switcherImportPreview),
      detail: state.portableImportPreview || state.switcherImportPreview ? "An import preview has been reviewed" : "Preview a restore before replacing live workspace data"
    }
  ];
}

function productionAuditAccessItems() {
  const activeMemberships = state.memberships.filter((membership) => membership.status !== "revoked");
  const admins = activeMemberships.filter((membership) => membership.role === "admin");
  const pendingInvites = state.invitations.filter((invitation) => invitation.status === "pending");
  const operatorSummary = operatorPermissionSummary();
  return [
    {
      label: "Admin owner",
      done: admins.length > 0,
      detail: admins.length ? `${admins.length} admin${admins.length === 1 ? "" : "s"} configured` : "At least one admin should own billing, exports, and access"
    },
    {
      label: "Team access",
      done: activeMemberships.length > 1 || pendingInvites.length > 0,
      detail: `${activeMemberships.length} active member${activeMemberships.length === 1 ? "" : "s"}, ${pendingInvites.length} pending invite${pendingInvites.length === 1 ? "" : "s"}`
    },
    {
      label: "Default role",
      done: Boolean(state.workspace.defaultRole && state.workspace.defaultRole !== "admin"),
      detail: `Default role: ${state.workspace.defaultRole || "not set"}`
    },
    {
      label: "Operator guardrails",
      done: Boolean(operatorSummary),
      detail: `AI/operator permissions: ${operatorSummary}`
    },
    {
      label: "Audit trail",
      done: state.auditEvents.length > 0 || auditEvents.length > 0,
      detail: `${state.auditEvents.length + auditEvents.length} local/server event${state.auditEvents.length + auditEvents.length === 1 ? "" : "s"} visible`
    }
  ];
}

function productionAuditSections() {
  return [
    {
      id: "launch",
      eyebrow: "Launch",
      title: "First client workspace",
      items: launchWorkspaceItems(),
      actions: [{ label: "Open Launch Flow", commandId: "launch:workspace" }]
    },
    {
      id: "production",
      eyebrow: "Production",
      title: "Hosted launch gates",
      items: productionReadinessItems(),
      actions: [{ label: "Open Settings", route: "settings" }]
    },
    {
      id: "backend",
      eyebrow: "Backend",
      title: "API and sync health",
      items: backendReadinessItems(),
      actions: [
        { label: "Refresh Health", id: "backend-health-refresh", disabled: !apiSession },
        { label: "Open Sync", commandId: "settings:sync" }
      ]
    },
    {
      id: "recovery",
      eyebrow: "Recovery",
      title: "Portable restore path",
      items: productionAuditRecoveryItems(),
      actions: [
        { label: "Create Backup", commandId: "backup:create" },
        { label: "Open Recovery Plan", commandId: "recovery:plan" }
      ]
    },
    {
      id: "access",
      eyebrow: "Security",
      title: "Access and audit controls",
      items: productionAuditAccessItems(),
      actions: [
        { label: "Open Permissions", route: "permissions" },
        { label: "Open Audit", route: "audit" }
      ]
    }
  ];
}

function renderProductionAuditSection(section) {
  const score = readinessScore(section.items);
  const tone = readinessTone(score);
  return `
    <section class="panel readiness-audit-section readiness-audit-${section.id}">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(section.eyebrow)}</p>
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        <span class="status-pill inbox-${tone}">${score.done}/${score.total}</span>
      </div>
      <div class="readiness-audit-list">
        ${section.items.map((item) => `
          <article class="readiness-audit-item ${item.done ? "is-done" : "is-open"}">
            <span>${item.done ? "OK" : "Next"}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail || "")}</p>
            </div>
          </article>
        `).join("")}
      </div>
      <div class="readiness-audit-actions">
        ${section.actions.map((action) => `
          <button
            class="button ${action.primary ? "button-primary" : "button-secondary"} compact-button"
            type="button"
            ${action.commandId ? `data-command-id="${escapeHtml(action.commandId)}"` : ""}
            ${action.route ? `data-route="${escapeHtml(action.route)}"` : ""}
            ${action.id ? `id="${escapeHtml(action.id)}"` : ""}
            ${action.disabled ? "disabled" : ""}
          >${escapeHtml(action.label)}</button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderReadinessCliPanel() {
  return `
    <section class="panel readiness-cli-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">CLI</p>
          <h2>Power-user checks</h2>
        </div>
        <span class="status-pill inbox-blue">scriptable</span>
      </div>
      <div class="readiness-command-list">
        <code>npm run agora -- launch check &lt;bundle.json&gt;</code>
        <code>npm run agora -- launch check &lt;bundle.json&gt; --strict</code>
        <code>npm run agora -- bundle inspect &lt;bundle.json&gt; --json</code>
        <code>npm run launch:check</code>
      </div>
    </section>
  `;
}

function renderProductionReadinessAudit() {
  const sections = productionAuditSections();
  const allItems = sections.flatMap((section) => section.items);
  const score = readinessScore(allItems);
  const tone = readinessTone(score);
  const recovery = portableRecoveryStatus();
  const health = backendHealth || apiSession?.backendHealth || {};
  els.appView.innerHTML = `
    ${renderRouteHeader({
      eyebrow: "Readiness",
      title: "Production readiness audit",
      description: "A single operational view for launch flow, hosted gates, backend sync, recovery, permissions, and audit confidence.",
      actions: [
        { label: "Open Launch Flow", commandId: "launch:workspace", primary: true },
        { label: "Create Backup", commandId: "backup:create" }
      ]
    })}

    <div class="metric-grid">
      ${metric("Overall", `${score.done}/${score.total}`)}
      ${metric("Status", tone === "green" ? "Ready" : tone === "amber" ? "Close" : "Needs work")}
      ${metric("Backend", health.productionMode ? "Production" : apiSession ? "Connected" : "Local")}
      ${metric("Backups", recovery.backups.length)}
      ${metric("Audit events", state.auditEvents.length + auditEvents.length)}
      ${metric("Failed syncs", apiSyncQueue.length)}
    </div>

    ${renderWorkspaceTrustStrip()}

    <div class="readiness-audit-grid">
      ${sections.map(renderProductionAuditSection).join("")}
      ${renderReadinessCliPanel()}
    </div>
  `;
}

function activeDashboardWidgets() {
  return normalizeDashboardWidgets(state.dashboardWidgets).filter((widget) => widget.visible);
}

function renderDashboardBuilder() {
  const widgets = normalizeDashboardWidgets(state.dashboardWidgets);
  const layouts = normalizeDashboardLayouts(state.dashboardLayouts);
  const selectedLayout = layouts.find((layout) => layout.id === state.selectedDashboardLayoutId) || layouts[0];
  return `
    <section class="panel dashboard-builder-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Dashboard builder</p>
          <h2>Workspace command center</h2>
        </div>
        <span class="status-pill inbox-blue">${widgets.filter((widget) => widget.visible).length}/${widgets.length} widgets</span>
      </div>
      <div class="dashboard-layout-controls">
        <label>
          <span>Saved layout</span>
          <select id="dashboard-layout-select">
            ${layouts.map((layout) => `<option value="${layout.id}" ${layout.id === selectedLayout?.id ? "selected" : ""}>${escapeHtml(layout.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Layout name</span>
          <input id="dashboard-layout-name" value="${escapeHtml(selectedLayout?.name || "Command Center")}" placeholder="Dashboard layout name">
        </label>
        <button class="button button-secondary compact-button" type="button" id="dashboard-apply-layout">Apply</button>
        <button class="button button-primary compact-button" type="button" id="dashboard-save-named-layout">Save Layout</button>
      </div>
      <div class="dashboard-widget-picker">
        ${dashboardWidgetCatalog.map((widget) => {
          const enabled = widgets.find((item) => item.id === widget.id)?.visible !== false;
          return `
            <label class="toggle-row">
              <input type="checkbox" data-dashboard-widget="${widget.id}" ${enabled ? "checked" : ""}>
              <span><strong>${escapeHtml(widget.label)}</strong><small>${escapeHtml(widget.description)}</small></span>
            </label>
          `;
        }).join("")}
      </div>
      <button class="button button-secondary compact-button" type="button" id="dashboard-save-layout">Update Visible Widgets</button>
    </section>
  `;
}

function renderDashboardWidgets(context) {
  const renderers = {
    projects: () => renderDashboardProjectsWidget(context.visibleProjects),
    goals: renderDashboardGoalsWidget,
    capacity: () => renderDashboardCapacityWidget(context.tasks, context.timeEntries),
    operator: renderDashboardOperatorWidget,
    "due-soon": () => renderDashboardDueSoonWidget(context.dueSoonTasks),
    mobile: renderMobileAppPanel
  };
  return activeDashboardWidgets().map((widget) => renderers[widget.id]?.() || "").join("") || emptyState(
    "Turn on dashboard widgets to build a command center.",
    { label: "Open Settings", route: "settings" }
  );
}

function renderDashboardProjectsWidget(visibleProjects) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Projects</p>
          <h2>Active work</h2>
        </div>
      </div>
      <div class="project-summary-list">
        ${visibleProjects.length ? visibleProjects.map(renderProjectSummary).join("") : emptyState(
          "No projects match the selected company.",
          { label: "Start Client Workspace", commandId: "template:recommended" }
        )}
      </div>
    </section>
  `;
}

function renderDashboardGoalsWidget() {
  const rows = goalRows().slice(0, 3);
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Goals</p>
          <h2>Objective progress</h2>
        </div>
        <button class="button button-secondary compact-button" type="button" data-route="goals">Open Goals</button>
      </div>
      <div class="goal-ladder dashboard-goal-list">
        ${rows.length ? rows.map(renderGoalLadderRow).join("") : emptyState(
          "No active goals yet.",
          { label: "Open Goals", route: "goals" }
        )}
      </div>
    </section>
  `;
}

function renderDashboardCapacityWidget(tasks, timeEntries) {
  const rows = capacityRows(tasks, timeEntries).sort((a, b) => b.utilization - a.utilization).slice(0, 4);
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Capacity</p>
          <h2>Team load</h2>
        </div>
        <button class="button button-secondary compact-button" type="button" data-route="reports">Reports</button>
      </div>
      <div class="workload-report-list dashboard-workload-list">
        ${rows.map(renderWorkloadReportRow).join("")}
      </div>
    </section>
  `;
}

function renderDashboardOperatorWidget() {
  return `
    <section class="panel operator-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">AI operator</p>
          <h2>What needs attention</h2>
        </div>
      </div>
      <div class="operator-brief-list">
        ${operatorBriefs(3).map(renderOperatorBrief).join("") || emptyState(
          "No active risks right now.",
          { label: "Draft Brief", commandId: "operator:brief" }
        )}
      </div>
    </section>
  `;
}

function renderDashboardDueSoonWidget(dueSoonTasks) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Due next</p>
          <h2>Upcoming tasks</h2>
        </div>
      </div>
      <div class="task-stack">
        ${dueSoonTasks.length ? dueSoonTasks.map(renderTaskCard).join("") : emptyState(
          "No upcoming tasks match the current filters.",
          { label: "Generate Today Plan", commandId: "today:generate" }
        )}
      </div>
    </section>
  `;
}

function renderOperatorCenter() {
  const briefs = operatorBriefs(6);
  const operatorDocs = recentOperatorDocuments();
  const suggestedActions = operatorActionSuggestions(6);
  const actionLog = recentOperatorActions(6);
  const openRisks = briefs.filter((brief) => brief.health < 70);
  const blockedTasks = activeTasks().filter(isTaskBlocked);
  const approvalCount = state.approvals.filter((approval) => approval.status !== "approved").length;

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Provider", aiProviderLabel())}
      ${metric("Adapter", aiConnectionSummary())}
      ${metric("Risks", openRisks.length)}
      ${metric("Approvals", approvalCount)}
    </div>

    <div class="operator-center-grid">
      <section class="panel operator-command-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">AI command center</p>
            <h2>Operator workspace</h2>
          </div>
          <span class="status-pill inbox-blue">${escapeHtml(aiConnectionSummary())}</span>
        </div>
        <div class="operator-command-copy">
          <p>Generate a workspace brief, draft project updates, and turn the highest-risk signals into planned work.</p>
        </div>
        <div class="operator-command-actions">
          <button class="button button-primary" type="button" id="ai-workspace-brief">Draft Workspace Brief</button>
          <button class="button button-secondary" type="button" data-operator-command="triage">Triage Risks</button>
          <button class="button button-secondary" type="button" data-operator-command="approval-packet">Approval Packet</button>
          <button class="button button-secondary" type="button" data-operator-command="portal-updates">Portal Updates</button>
          <button class="button button-secondary" type="button" data-operator-command="integration-digest">Integration Digest</button>
          <button class="button button-secondary" type="button" id="ai-generate-today">Generate Today</button>
          <button class="button button-secondary" type="button" data-route="settings">AI Settings</button>
        </div>
        <div class="operator-signal-grid">
          <div>
            <strong>${blockedTasks.length}</strong>
            <span>blocked tasks</span>
          </div>
          <div>
            <strong>${getInboxItems().filter((item) => !isInboxRead(item.id)).length}</strong>
            <span>unread signals</span>
          </div>
          <div>
            <strong>${operatorDocs.length}</strong>
            <span>operator docs</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Preview before apply</p>
            <h2>Suggested actions</h2>
          </div>
        </div>
        <div class="operator-suggestion-list">
          ${suggestedActions.length ? suggestedActions.map(renderOperatorActionSuggestion).join("") : emptyState("No operator actions are ready to apply.")}
        </div>
      </section>

      ${renderOperatorTrustPanel()}

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Applied</p>
            <h2>Action log</h2>
          </div>
        </div>
        <div class="operator-action-log">
          ${actionLog.length ? actionLog.map(renderOperatorActionLogRow).join("") : emptyState("Applied operator actions will appear here.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Generated</p>
            <h2>Operator docs</h2>
          </div>
        </div>
        <div class="operator-doc-list">
          ${operatorDocs.length ? operatorDocs.map(renderOperatorDocRow).join("") : emptyState("No operator docs yet. Draft a workspace or project brief to start the queue.")}
        </div>
      </section>

      <section class="panel operator-panel wide-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Risk queue</p>
            <h2>Suggested action plan</h2>
          </div>
        </div>
        <div class="operator-brief-list">
          ${briefs.length ? briefs.map(renderOperatorBrief).join("") : emptyState("No active project risks right now.")}
        </div>
      </section>
    </div>
  `;
}

function renderOperatorTrustPanel() {
  const trust = aiOperatorTrustState();
  const context = workspaceAiContext();
  return `
    <section class="panel operator-trust-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Bring your own AI</p>
          <h2>Trust and context</h2>
        </div>
        <span class="status-pill ${trust.externalProvider ? "inbox-amber" : "inbox-green"}">${escapeHtml(trust.connection)}</span>
      </div>
      <div class="operator-trust-grid">
        <article>
          <span>Provider</span>
          <strong>${escapeHtml(trust.providerLabel)}</strong>
          <small>${escapeHtml(trust.keySource)}</small>
        </article>
        <article>
          <span>Data policy</span>
          <strong>${escapeHtml(trust.dataPolicy)}</strong>
          <small>${escapeHtml(trust.promptTemplate)}</small>
        </article>
        <article>
          <span>Visible context</span>
          <strong>${context.tasks.length} tasks</strong>
          <small>${context.approvals.length} approvals / ${context.documents.length} docs</small>
        </article>
        <article>
          <span>Audit mode</span>
          <strong>${escapeHtml(trust.auditMode)}</strong>
          <small>${trust.actionLedgerEntries} ledger entries</small>
        </article>
        <article>
          <span>Permissions</span>
          <strong>${escapeHtml(trust.permissionSummary)}</strong>
          <small>Admin-governed operator scope</small>
        </article>
      </div>
      <div class="operator-source-list">
        ${operatorDataSourcesFor("workspace_brief integration").map((source) => `<span>${escapeHtml(source)}</span>`).join("")}
      </div>
      <div class="operator-preset-list">
        ${aiPermissionPresets.map((preset) => `
          <button class="operator-preset-button" type="button" data-operator-permission-preset="${preset.id}">
            <strong>${escapeHtml(preset.label)}</strong>
            <span>${escapeHtml(preset.description)}</span>
          </button>
        `).join("")}
      </div>
      <div class="operator-permission-list">
        ${aiPermissionOptions.map((option) => `
          <label class="operator-permission-row">
            <input type="checkbox" data-operator-permission="${option.id}" ${trust.permissions[option.id] ? "checked" : ""}>
            <span>
              <strong>${escapeHtml(option.label)}</strong>
              <small>${escapeHtml(option.description)}</small>
            </span>
          </label>
        `).join("")}
      </div>
      <div class="operator-command-actions">
        <button class="button button-primary" type="button" id="operator-permissions-save">Save Permissions</button>
        <button class="button button-primary" type="button" id="operator-context-export">Export Context</button>
        <button class="button button-secondary" type="button" id="operator-local-mode">Use Local Mode</button>
        <button class="button button-secondary" type="button" data-route="settings">AI Settings</button>
      </div>
    </section>
  `;
}

function renderOperatorActionSuggestion(action) {
  const allowed = canOperatorApplyType(action.type);
  return `
    <article class="operator-action-card">
      <div>
        <span class="status-pill inbox-${allowed ? action.health < 45 ? "red" : action.health < 70 ? "amber" : "green" : "neutral"}">${allowed ? escapeHtml(action.impact) : "Permission blocked"}</span>
        <h3>${escapeHtml(action.title)}</h3>
        <p>${escapeHtml(action.summary)}</p>
        <small>${escapeHtml(action.projectName)}</small>
      </div>
      <div class="operator-action-row">
        <button class="button button-primary compact-button" type="button" data-operator-apply="${action.type}" data-operator-project="${action.projectId}" data-operator-task="${action.sourceTaskId}" data-operator-approval="${action.approvalId}" data-operator-company="${action.companyId}" ${allowed ? "" : "disabled"}>${escapeHtml(action.confirmLabel)}</button>
        <button class="button button-secondary compact-button" type="button" data-project-id="${action.projectId}">Open Project</button>
      </div>
    </article>
  `;
}

function renderOperatorActionLogRow(action) {
  const canUndo = action.undoType && action.undoRecordId && action.status !== "undone";
  return `
    <article class="operator-log-row">
      <div>
        <span class="status-pill inbox-neutral">${escapeHtml(action.status || "applied")}</span>
        <h3>${escapeHtml(action.title)}</h3>
        <p>${escapeHtml(action.detail || "")}</p>
        ${action.rationale ? `<p><strong>Rationale:</strong> ${escapeHtml(action.rationale)}</p>` : ""}
        ${Array.isArray(action.dataSources) && action.dataSources.length ? `<div class="tag-row">${action.dataSources.map((source) => `<span>${escapeHtml(source)}</span>`).join("")}</div>` : ""}
        <small>${escapeHtml(formatTimestamp(action.createdAt))} / ${escapeHtml(memberName(action.memberId || currentMemberId))}</small>
      </div>
      ${canUndo ? `<button class="button button-secondary compact-button" type="button" data-operator-undo="${action.id}">Undo</button>` : ""}
    </article>
  `;
}

function renderOperatorDocRow(document) {
  return `
    <article class="operator-doc-row">
      <div>
        <span class="status-pill inbox-neutral">${escapeHtml(document.type)}</span>
        <h3>${escapeHtml(document.title)}</h3>
        <p>${escapeHtml(projectName(document.projectId))} - Updated ${escapeHtml(formatTimestamp(document.updatedAt))}</p>
      </div>
      <button class="button button-secondary compact-button" type="button" data-route="docs">Open Docs</button>
    </article>
  `;
}

function renderDailyTasks() {
  const date = state.selectedDailyDate;
  const smartTasks = smartDailyTasks(date);
  const operatorPlan = dailyOperatorPlan(date);
  const operatorSuggestionCount = operatorPlan.now.length + operatorPlan.next.length + operatorPlan.later.length;
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
          <button class="button button-primary" type="button" id="ai-generate-today" ${operatorSuggestionCount ? "" : "disabled"}>Generate Today</button>
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
            <p class="eyebrow">AI operator</p>
            <h2>Daily plan</h2>
          </div>
          <span class="status-pill inbox-blue">${escapeHtml(aiProviderLabel())}</span>
        </div>
        ${renderDailyOperatorPreview(operatorPlan)}
        <div class="daily-smart-list">
          ${unplannedSmartTasks.length ? unplannedSmartTasks.map(renderDailySmartTask).join("") : emptyState("No unplanned work is asking for attention.")}
        </div>
      </section>
    </div>
  `;
}

function renderDailyOperatorPreview(plan) {
  const items = [
    ...plan.now.map((item) => ({ ...item, lane: "Now" })),
    ...plan.next.map((item) => ({ ...item, lane: "Next" })),
    ...plan.later.map((item) => ({ ...item, lane: "Later" }))
  ];

  if (!items.length) return emptyState("The operator does not see unplanned high-signal work for this day.");

  return `
    <div class="ai-plan-preview">
      ${items.map(({ task, reason, lane }) => `
        <article class="ai-plan-item">
          <span>${escapeHtml(lane)}</span>
          <strong>${escapeHtml(task.title)}</strong>
          <small>${escapeHtml(reason)}</small>
        </article>
      `).join("")}
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

function notificationDigestRows() {
  const settings = notificationSettings();
  const openTasks = activeTasks().filter((task) => task.status !== "done");
  const myTasks = openTasks.filter((task) => task.assignee === activeMemberId());
  const pendingApprovals = getPendingApprovals().filter((approval) => projectMatchesContext(approval.projectId));
  const blockedTasks = openTasks.filter(isTaskBlocked);
  const quietProjects = activeProjects().filter((project) => !getProjectActivity(project.id, 1).length);

  return [
    {
      id: "myWork",
      title: "My work digest",
      enabled: settings.digests.myWork !== false,
      count: myTasks.length,
      message: `${myTasks.filter(isOverdue).length} overdue, ${dueSoonTasks(myTasks).length} due soon, ${myTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length} high priority.`,
      reason: "Assigned work, overdue tasks, due-soon dates, and priority."
    },
    {
      id: "approvals",
      title: "Client approvals digest",
      enabled: settings.digests.approvals !== false,
      count: pendingApprovals.length,
      message: `${pendingApprovals.filter((approval) => approval.status === "needs-changes").length} need changes and ${pendingApprovals.filter((approval) => approval.status === "requested").length} are waiting.`,
      reason: "Open approval requests and client review states."
    },
    {
      id: "blockers",
      title: "Blocked work digest",
      enabled: settings.digests.blockers !== false,
      count: blockedTasks.length,
      message: `${blockedTasks.length} blocked ${blockedTasks.length === 1 ? "task" : "tasks"} across ${new Set(blockedTasks.map((task) => task.projectId)).size} ${blockedTasks.length === 1 ? "project" : "projects"}.`,
      reason: "Tasks with unresolved dependencies."
    },
    {
      id: "quietProjects",
      title: "Quiet projects digest",
      enabled: settings.digests.quietProjects !== false,
      count: quietProjects.length,
      message: `${quietProjects.length} active ${quietProjects.length === 1 ? "project has" : "projects have"} no recent activity.`,
      reason: "Active projects without recent activity records."
    }
  ];
}

function notificationDeliveryChannels(settings = notificationSettings()) {
  const channels = ["in-app"];
  if (settings.channels.browser && notificationPermissionState === "granted") channels.push("browser");
  if (settings.channels.webhook && settings.delivery.webhookUrl) channels.push("webhook preview");
  if (settings.channels.email && settings.delivery.emailAddress) channels.push("email handoff");
  return channels.join(" + ");
}

function notificationDigestPayload(row) {
  return {
    source: "agora",
    workspaceId: state.workspace.id,
    workspaceName: state.workspace.name,
    type: "notification_digest",
    digestId: row.id,
    title: row.title,
    message: row.message,
    reason: row.reason,
    count: row.count,
    cadence: notificationSettings().cadence,
    createdAt: new Date().toISOString()
  };
}

async function copyDigestPayload(digestId) {
  const row = notificationDigestRows().find((digest) => digest.id === digestId);
  if (!row) return;
  const payload = JSON.stringify(notificationDigestPayload(row), null, 2);
  if (!navigator.clipboard?.writeText) {
    showToast("Clipboard is not available in this browser", "info");
    return;
  }
  await navigator.clipboard.writeText(payload);
  logNotificationHistory({
    kind: "webhook-payload",
    title: row.title,
    message: "Webhook payload copied for delivery testing.",
    reason: row.reason,
    count: row.count,
    channel: "clipboard"
  });
  saveState();
  render();
  showToast("Webhook payload copied", "success");
}

function renderNotificationDigestPanel() {
  const settings = notificationSettings();
  const canManageNotifications = canWrite("notifications:write");
  const rows = notificationDigestRows();
  return `
    <section class="panel notification-digest-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Delivery</p>
          <h2>Notification digests</h2>
        </div>
        <select id="notification-cadence" aria-label="Digest cadence" ${canManageNotifications ? "" : "disabled"}>
          ${["daily", "weekly", "manual"].map((cadence) => `<option value="${cadence}" ${settings.cadence === cadence ? "selected" : ""}>${cadence}</option>`).join("")}
        </select>
      </div>
      <div class="digest-list">
        ${rows.map((row) => `
          <article class="digest-row ${row.enabled ? "" : "is-muted"}">
            <label class="checkbox-label">
              <input type="checkbox" data-digest-rule="${row.id}" ${row.enabled ? "checked" : ""} ${canManageNotifications ? "" : "disabled"}>
              <span>${escapeHtml(row.title)}</span>
            </label>
            <strong>${row.count}</strong>
            <p>${escapeHtml(row.message)}</p>
            <small>${escapeHtml(row.reason)}</small>
            <div class="digest-actions">
              <button class="button button-secondary compact-button" type="button" data-digest-payload="${row.id}">Copy Payload</button>
              <button class="button button-secondary compact-button" type="button" data-digest-run="${row.id}" ${row.enabled ? "" : "disabled"}>Send Digest</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderNotificationPreferencesPanel() {
  const settings = notificationSettings();
  const canManageNotifications = canWrite("notifications:write");
  const eventOptions = [
    ["assignment", "Assignments"],
    ["overdue", "Overdue"],
    ["due", "Due soon"],
    ["reminder", "Reminders"],
    ["mention", "Mentions"],
    ["watched", "Watched tasks"],
    ["comment", "Comments"],
    ["approval", "Approvals"],
    ["activity", "Activity"]
  ];
  return `
    <section class="panel notification-preferences-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Preferences</p>
          <h2>What reaches you</h2>
        </div>
        <span class="status-pill ${settings.channels.browser || settings.channels.webhook || settings.channels.email ? "inbox-green" : "inbox-neutral"}">${escapeHtml(notificationDeliveryChannels(settings))}</span>
      </div>
      <div class="notification-pref-grid">
        ${eventOptions.map(([id, label]) => `
          <label class="checkbox-label">
            <input type="checkbox" data-notification-event="${id}" ${settings.events[id] !== false ? "checked" : ""} ${canManageNotifications ? "" : "disabled"}>
            <span>${escapeHtml(label)}</span>
          </label>
        `).join("")}
      </div>
      <div class="notification-channel-row">
        <label class="checkbox-label">
          <input type="checkbox" data-notification-channel="inApp" ${settings.channels.inApp !== false ? "checked" : ""} ${canManageNotifications ? "" : "disabled"}>
          <span>In-app inbox</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" data-notification-channel="browser" ${settings.channels.browser ? "checked" : ""} ${canManageNotifications ? "" : "disabled"}>
          <span>Browser alerts</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" data-notification-channel="webhook" ${settings.channels.webhook ? "checked" : ""} ${canManageNotifications ? "" : "disabled"}>
          <span>Webhook</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" data-notification-channel="email" ${settings.channels.email ? "checked" : ""} ${canManageNotifications ? "" : "disabled"}>
          <span>Email handoff</span>
        </label>
        <button class="button button-secondary compact-button" type="button" id="notification-request" ${notificationPermissionState === "unsupported" || notificationPermissionState === "granted" ? "disabled" : ""}>Enable Permission</button>
        <button class="button button-secondary compact-button" type="button" id="notification-test" ${notificationPermissionState === "granted" ? "" : "disabled"}>Test</button>
      </div>
      <div class="notification-delivery-summary">
        <span>${escapeHtml(settings.delivery.webhookUrl || "No webhook URL")}</span>
        <span>${escapeHtml(settings.delivery.emailAddress || "No email handoff")}</span>
        <button class="button button-secondary compact-button" type="button" data-open-settings-tab="integrations" ${canManageNotifications ? "" : "disabled"}>Manage Delivery</button>
      </div>
    </section>
  `;
}

function renderNotificationRemindersPanel() {
  const reminders = activeNotificationReminders();
  const dueCount = reminders.filter((reminder) => reminder.remindAt <= todayKey()).length;
  const canRunServerScheduler = canWrite("scheduler:run");
  return `
    <section class="panel notification-reminders-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Follow-up</p>
          <h2>Reminders</h2>
        </div>
        <div class="panel-actions">
          <span class="status-pill ${dueCount ? "inbox-amber" : "inbox-neutral"}">${dueCount ? `${dueCount} due` : `${reminders.length} scheduled`}</span>
          <button class="button button-secondary compact-button" type="button" id="notification-reminder-check" ${reminders.length ? "" : "disabled"}>Check Now</button>
          <button class="button button-secondary compact-button" type="button" id="notification-server-scheduler" ${apiSession && canRunServerScheduler ? "" : "disabled"}>Run Server</button>
        </div>
      </div>
      <div class="reminder-list">
        ${reminders.length ? reminders.slice(0, 6).map((reminder) => `
          <article class="reminder-row ${reminder.remindAt <= todayKey() ? "is-due" : ""}">
            <div>
              <strong>${escapeHtml(reminder.title)}</strong>
              <p>${escapeHtml(reminder.message || projectName(reminder.projectId))}</p>
              <small>${formatFullDate(reminder.remindAt)}${reminder.repeat !== "none" ? ` - repeats ${escapeHtml(reminder.repeat)}` : ""}</small>
            </div>
            <button class="button button-secondary compact-button" type="button" data-reminder-dismiss="${reminder.id}">Dismiss</button>
          </article>
        `).join("") : emptyState("Use Remind Tomorrow or Next Week on inbox cards to bring work back here.")}
      </div>
    </section>
  `;
}

function inboxIntelligenceRows(items) {
  const groups = [
    {
      id: "attention",
      title: "Needs action",
      tone: "red",
      items: items.filter((item) => primaryInboxLane(item) === "Needs action"),
      reason: "Assignments, approvals, mentions, reminders, and overdue work are promoted here first."
    },
    {
      id: "timeline",
      title: "Time sensitive",
      tone: "amber",
      items: items.filter((item) => item.type === "overdue" || item.type === "due soon" || item.type === "reminder"),
      reason: "Agora groups due dates and reminders so planning does not get buried in activity."
    },
    {
      id: "collaboration",
      title: "Collaboration",
      tone: "blue",
      items: items.filter((item) => item.type === "mention" || item.type === "watched" || item.type === "comment" || item.type === "activity"),
      reason: "Comments, watched-task updates, and teammate activity are kept together for review."
    }
  ];
  return groups.map((group) => ({
    ...group,
    unread: group.items.filter((item) => !isInboxRead(item.id)).length,
    sample: group.items[0]
  }));
}

function renderInboxIntelligencePanel(items) {
  const rows = inboxIntelligenceRows(items);
  return `
    <section class="panel notification-intelligence-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Signals</p>
          <h2>Why these surfaced</h2>
        </div>
        <span class="status-pill inbox-neutral">${items.length} signals</span>
      </div>
      <div class="notification-intelligence-list">
        ${rows.map((row) => `
          <article>
            <span class="status-pill inbox-${row.tone}">${row.unread} unread</span>
            <strong>${escapeHtml(row.title)}</strong>
            <p>${escapeHtml(row.reason)}</p>
            <small>${row.sample ? escapeHtml(`Top signal: ${row.sample.title}`) : "No matching signals right now."}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderNotificationHistoryPanel() {
  const history = normalizeNotificationHistory(state.notificationHistory).slice(0, 6);
  return `
    <section class="panel notification-history-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">History</p>
          <h2>What fired and why</h2>
        </div>
        <span class="status-pill inbox-neutral">${history.length}</span>
      </div>
      <div class="notification-history-list">
        ${history.length ? history.map((event) => `
          <article>
            <span class="status-pill inbox-blue">${escapeHtml(event.kind)}</span>
            <strong>${escapeHtml(event.title)}</strong>
            <p>${escapeHtml(event.message)}</p>
            <small>${escapeHtml(event.reason || event.channel)} - ${formatTimestamp(event.createdAt)}</small>
          </article>
        `).join("") : emptyState("Digest sends and browser alert tests will appear here.")}
      </div>
    </section>
  `;
}

function renderInbox() {
  const items = getInboxItems();
  const unreadItems = items.filter((item) => !isInboxRead(item.id));
  const urgentItems = items.filter((item) => item.type === "overdue" || item.type === "assignment" || item.type === "approval" || item.type === "mention");
  const approvalItems = items.filter((item) => item.type === "approval");
  const dueItems = items.filter((item) => item.type === "due soon");
  const activityItems = items.filter((item) => item.type === "comment" || item.type === "activity" || item.type === "mention" || item.type === "watched");
  const mentionItems = items.filter((item) => item.type === "mention" || item.type === "watched");
  const briefs = operatorBriefs(3);
  const pulse = workspacePulse();

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Unread", unreadItems.length)}
      ${metric("Needs action", urgentItems.length)}
      ${metric("Due soon", dueItems.length)}
      ${metric("Mentions", mentionItems.length)}
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

      ${renderNotificationDigestPanel()}
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

function inboxLaneTitles(item) {
  const lanes = [];
  if (item.type === "overdue" || item.type === "assignment" || item.type === "approval" || item.type === "mention" || item.type === "reminder") lanes.push("Needs action");
  if (item.type === "approval") lanes.push("Approvals");
  if (item.type === "due soon" || item.type === "reminder") lanes.push("Due soon");
  if (item.type === "comment" || item.type === "activity" || item.type === "mention" || item.type === "watched") lanes.push("Activity");
  return lanes.length ? lanes : ["Activity"];
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
    ${item.taskId ? `<button class="button button-secondary" type="button" data-inbox-plan="${item.taskId}" data-inbox-id="${item.id}">Plan Today</button>` : ""}
    ${item.taskId ? `<button class="button button-secondary" type="button" data-edit-task="${item.taskId}" data-inbox-id="${item.id}">Open</button>` : ""}
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

function renderCompanies() {
  const companies = state.filters.company === "all"
    ? visibleCompanies()
    : visibleCompanies().filter((company) => company.id === state.filters.company);
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
        <button class="button button-primary" type="button" id="new-company-button" ${canWrite("projects:write") ? "" : "disabled"}>New Company</button>
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
  const recentUpdates = portal.updates.slice(0, 5);

  return `
    <section class="panel portal-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Client portal</p>
          <h2>${escapeHtml(company.name)} portal</h2>
        </div>
        <div class="portal-actions">
          <button class="button button-secondary" type="button" data-copy-portal-packet="${company.id}">Copy Share Packet</button>
          <button class="button button-primary" type="button" data-company-update="${company.id}">Draft Update</button>
        </div>
      </div>
      <div class="portal-grid">
        <article class="portal-status-card">
          <span class="status-pill inbox-${portal.pendingApprovals.length ? "amber" : "green"}">${portal.pendingApprovals.length ? "Needs client" : "Clear"}</span>
          <h3>${portal.progress}% complete</h3>
          <p>${portal.openTasks.length} open ${portal.openTasks.length === 1 ? "task" : "tasks"} across ${portal.projects.length} ${portal.projects.length === 1 ? "project" : "projects"}.</p>
          <small>${portal.updatedAt ? `Updated ${formatTimestamp(portal.updatedAt)}` : "No recent updates"}</small>
        </article>

        ${renderPortalDecisionRoom(company.id)}

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

        <div class="portal-list">
          <div class="portal-list-header">
            <h3>Recent updates</h3>
            <span>${recentUpdates.length}</span>
          </div>
          ${recentUpdates.length ? recentUpdates.map(renderPortalUpdateRow).join("") : emptyState("No recent portal updates yet.")}
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
  const featureRequests = portal.tasks.filter(isFeatureRequestTask).slice(0, 6);
  const sharedAssets = [...portal.documents, ...portal.files]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6);
  const recentUpdates = portal.updates.slice(0, 5);

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
      ${renderPortalDecisionRoom(company.id, { client: true })}

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
            <p class="eyebrow">Requests</p>
            <h2>Feature request status</h2>
          </div>
          <span class="status-pill inbox-blue">${featureRequests.length}</span>
        </div>
        <div class="portal-list">
          ${featureRequests.length ? featureRequests.map(renderClientFeatureRequestSummary).join("") : emptyState("No feature requests are visible yet.")}
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

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Updates</p>
            <h2>Latest activity</h2>
          </div>
        </div>
        <div class="portal-list">
          ${recentUpdates.length ? recentUpdates.map(renderPortalUpdateRow).join("") : emptyState("No recent updates are visible yet.")}
        </div>
      </section>
    </div>
  `;
}

function renderPortalUpdateRow(update) {
  const task = update.taskId ? byId(state.tasks, update.taskId) : null;
  const projectId = update.projectId || task?.projectId || "";
  return `
    <article class="portal-asset-row">
      <div>
        <strong>${escapeHtml(update.message || update.body || "Workspace update")}</strong>
        <span>${escapeHtml(projectName(projectId))} / ${escapeHtml(memberName(update.memberId || update.author || currentMemberId))}</span>
      </div>
      <small>${formatTimestamp(update.createdAt)}</small>
    </article>
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

function renderClientFeatureRequestSummary(task) {
  const status = featureRequestStatus(task);
  return `
    <article class="portal-asset-row">
      <div>
        <span class="status-pill inbox-${status === "shipped" ? "green" : status === "declined" ? "neutral" : "blue"}">${escapeHtml(featureRequestStatusLabel(status))}</span>
        <strong>${escapeHtml(task.title.replace(/^Feature request:\s*/i, ""))}</strong>
        <span>${escapeHtml(task.customFields?.impact || "Nice to have")} / ${escapeHtml(featureRequestLifecycleSummary(task))}</span>
      </div>
      <small>${task.customFields?.lastRequesterUpdateAt ? formatTimestamp(task.customFields.lastRequesterUpdateAt) : formatTimestamp(task.updatedAt || task.createdAt)}</small>
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

    ${renderProjectCommandCenter(project, details)}

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
        ${nextMilestone ? renderMilestoneCard(nextMilestone) : emptyState(`${project.name} does not have an active milestone yet.`)}
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
        ${items.length ? items.map(renderRaidItem).join("") : emptyState(`${project.name} has no RAID items yet.`)}
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

function capacitySettings() {
  return normalizeWorkspaceCapacity(state.workspace?.capacity);
}

function memberCapacityMinutes(memberId) {
  const settings = capacitySettings();
  return settings.memberOverrides.find((override) => override.memberId === memberId)?.weeklyMinutes || settings.weeklyMinutes;
}

function taskPlannedMinutes(task) {
  if (!task || task.status === "done") return 0;
  const baseByPriority = {
    urgent: 360,
    high: 240,
    normal: 150,
    low: 90
  };
  let minutes = baseByPriority[task.priority] || 150;
  if (isTaskBlocked(task)) minutes += 75;
  if (isOverdue(task)) minutes += 120;
  if (dueSoonTasks([task]).length) minutes += 60;
  minutes += Math.min((task.subtasks || []).length, 5) * 20;
  return minutes;
}

function memberCapacityRow(member, tasks, timeEntries) {
  const assignedTasks = tasks.filter((task) => task.assignee === member.id);
  const openTasks = assignedTasks.filter((task) => task.status !== "done");
  const blockedTasks = assignedTasks.filter(isTaskBlocked);
  const dueSoon = dueSoonTasks(assignedTasks);
  const plannedMinutes = openTasks.reduce((total, task) => total + taskPlannedMinutes(task), 0);
  const loggedMinutes = sumMinutes(timeEntries.filter((entry) => entry.memberId === member.id));
  const capacityMinutes = memberCapacityMinutes(member.id);
  const utilization = capacityMinutes ? Math.round((Math.max(plannedMinutes, loggedMinutes) / capacityMinutes) * 100) : 0;
  const settings = capacitySettings();
  const status = utilization >= settings.overloadAtPercent
    ? "overloaded"
    : utilization >= settings.warnAtPercent
      ? "at-risk"
      : utilization < 45 && openTasks.length <= 1
        ? "available"
        : "steady";
  return {
    member,
    assignedTasks,
    openTasks,
    blockedTasks,
    dueSoon,
    plannedMinutes,
    loggedMinutes,
    capacityMinutes,
    utilization: clamp(utilization, 0, 220),
    remainingMinutes: capacityMinutes - Math.max(plannedMinutes, loggedMinutes),
    status
  };
}

function capacityRows(tasks, timeEntries) {
  return workspaceMembers().map((member) => memberCapacityRow(member, tasks, timeEntries));
}

function capacityStatusLabel(status) {
  return {
    overloaded: "Overloaded",
    "at-risk": "At risk",
    available: "Available",
    steady: "Steady"
  }[status] || "Steady";
}

function capacityStatusClass(status) {
  return status === "overloaded" ? "inbox-red" : status === "at-risk" ? "inbox-amber" : status === "available" ? "inbox-blue" : "inbox-green";
}

function renderCapacityPlanningPanel(rows) {
  const settings = capacitySettings();
  const overloaded = rows.filter((row) => row.status === "overloaded");
  const available = rows.filter((row) => row.status === "available" || row.remainingMinutes > 240);
  const averageUtilization = rows.length ? Math.round(rows.reduce((total, row) => total + row.utilization, 0) / rows.length) : 0;
  return `
    <section class="panel capacity-planning-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Capacity</p>
          <h2>Team workload plan</h2>
        </div>
        <span class="status-pill ${overloaded.length ? "inbox-red" : averageUtilization >= settings.warnAtPercent ? "inbox-amber" : "inbox-green"}">${averageUtilization}% average</span>
      </div>
      <div class="capacity-summary-grid">
        ${metric("Weekly capacity", formatDuration(rows.reduce((total, row) => total + row.capacityMinutes, 0)))}
        ${metric("Planned load", formatDuration(rows.reduce((total, row) => total + row.plannedMinutes, 0)))}
        ${metric("At risk", rows.filter((row) => row.status === "at-risk" || row.status === "overloaded").length)}
        ${metric("Available", available.length)}
      </div>
      <div class="capacity-settings-row">
        <span>Default ${escapeHtml(formatDuration(settings.weeklyMinutes))} / week</span>
        <span>Warn ${settings.warnAtPercent}%</span>
        <span>Overload ${settings.overloadAtPercent}%</span>
        <span>Focus target ${settings.focusTargetPercent}%</span>
      </div>
      <div class="capacity-action-list">
        ${overloaded.length ? overloaded.map((row) => `<article><strong>Rebalance ${escapeHtml(row.member.name)}</strong><span>${escapeHtml(formatDuration(Math.abs(row.remainingMinutes)))} over capacity. Move due-soon work to ${escapeHtml(available[0]?.member.name || "an available teammate")}.</span></article>`).join("") : `<article><strong>No overload detected</strong><span>Current assignment load is inside the configured capacity thresholds.</span></article>`}
      </div>
    </section>
  `;
}

function renderReports() {
  const { tasks, projects, timeEntries, submissions } = reportTaskScope();
  const projectRows = projects.map((project) => projectReport(project, tasks, timeEntries, submissions));
  const reportCompanies = state.filters.company === "all"
    ? visibleCompanies()
    : visibleCompanies().filter((company) => company.id === state.filters.company);
  const companyRows = reportCompanies.map((company) => companyReport(company, tasks, timeEntries, submissions));
  const openTasks = tasks.filter((task) => task.status !== "done");
  const blockedTasks = tasks.filter(isTaskBlocked);
  const overdueTasks = tasks.filter(isOverdue);
  const openIntake = submissions.filter((submission) => !submission.taskId);
  const scopedProjectIds = new Set(projects.map((project) => project.id));
  const openRaidItems = normalizeRaidItems(state.raidItems).filter((item) => scopedProjectIds.has(item.projectId) && item.status !== "closed");
  const averageHealth = projectRows.length
    ? Math.round(projectRows.reduce((total, row) => total + row.health, 0) / projectRows.length)
    : 100;
  const workloadRows = capacityRows(tasks, timeEntries);
  const statusReport = workspaceStatusReport({ projectRows, companyRows, openTasks, blockedTasks, overdueTasks, openIntake, timeEntries, averageHealth, workloadRows });

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Health", `${averageHealth}%`)}
      ${metric("Open work", openTasks.length)}
      ${metric("Blocked", blockedTasks.length)}
      ${metric("RAID", openRaidItems.length)}
      ${metric("Tracked", formatDuration(sumMinutes(timeEntries)))}
    </div>

    <section class="panel status-report-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Shareout</p>
          <h2>Status report</h2>
        </div>
        <button class="button button-primary compact-button" type="button" id="copy-status-report">Copy Report</button>
      </div>
      <textarea class="export-textarea status-report-output" id="status-report-output" rows="12" readonly>${escapeHtml(statusReport)}</textarea>
    </section>

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

      ${renderCapacityPlanningPanel(workloadRows)}

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
          ${workloadRows.map(renderWorkloadReportRow).join("")}
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

function workspaceStatusReport({ projectRows, companyRows, openTasks, blockedTasks, overdueTasks, openIntake, timeEntries, averageHealth, workloadRows = [] }) {
  const scope = [
    state.filters.company !== "all" ? companyName(state.filters.company) : "All companies",
    state.selectedProject !== "all" ? projectName(state.selectedProject) : "All projects",
    state.filters.assignee !== "all" ? memberName(state.filters.assignee) : "",
    state.filters.status !== "all" ? statusLabel(state.filters.status) : "",
    state.filters.priority !== "all" ? priorityLabel(state.filters.priority) : ""
  ].filter(Boolean).join(" / ");
  const riskiest = [...projectRows].sort((a, b) => a.health - b.health).slice(0, 3);
  const topCompanies = [...companyRows].sort((a, b) => a.health - b.health).slice(0, 3);
  const nextTasks = [...openTasks]
    .sort((a, b) => operatorTaskScore(b) - operatorTaskScore(a))
    .slice(0, 5);
  const overloaded = workloadRows.filter((row) => row.status === "overloaded");
  const atRisk = workloadRows.filter((row) => row.status === "at-risk");
  const available = workloadRows.filter((row) => row.status === "available" || row.remainingMinutes > 240);
  const scopedProjectIds = new Set(projectRows.map((row) => row.project.id));
  const raidItems = normalizeRaidItems(state.raidItems)
    .filter((item) => !scopedProjectIds.size || scopedProjectIds.has(item.projectId))
    .filter((item) => item.status !== "closed")
    .sort((a, b) => raidSeverityScore(b) - raidSeverityScore(a))
    .slice(0, 6);

  return [
    `# ${state.workspace.name} Status Report`,
    "",
    `Generated: ${formatFullDate(todayKey())}`,
    `Scope: ${scope}`,
    "",
    "## Summary",
    `- Portfolio health: ${averageHealth}%`,
    `- Open work: ${openTasks.length}`,
    `- Blocked: ${blockedTasks.length}`,
    `- Overdue: ${overdueTasks.length}`,
    `- Open intake: ${openIntake.length}`,
    `- Tracked time: ${formatDuration(sumMinutes(timeEntries))}`,
    `- Capacity risk: ${overloaded.length} overloaded, ${atRisk.length} at risk, ${available.length} available.`,
    "",
    "## Projects To Watch",
    ...(riskiest.length ? riskiest.map((row) => `- ${row.project.name}: ${row.health}% health, ${row.overdue.length} overdue, ${row.blocked.length} blocked, ${formatDuration(row.trackedMinutes)} tracked.`) : ["- No matching projects."]),
    "",
    "## Company Snapshot",
    ...(topCompanies.length ? topCompanies.map((row) => `- ${row.company.name}: ${row.health}% health across ${row.projectCount} ${row.projectCount === 1 ? "project" : "projects"}.`) : ["- No matching companies."]),
    "",
    "## Risks, Assumptions, Issues, Decisions",
    ...(raidItems.length ? raidItems.map((item) => `- ${raidTypeLabel(item.type)}: ${item.title} (${raidSeverityLabel(item.severity)}, ${item.status}, owner ${memberName(item.owner)}${item.dueDate ? `, due ${formatDate(item.dueDate)}` : ""}). ${item.mitigation || item.detail}`.trim()) : ["- No open RAID items match the current filters."]),
    "",
    "## Next Actions",
    ...(nextTasks.length ? nextTasks.map((task) => `- ${task.title}: ${operatorReasonForTask(task)} (${projectName(task.projectId)}).`) : ["- No open next actions match the current filters."])
  ].join("\n");
}

async function copyStatusReport() {
  const report = document.querySelector("#status-report-output")?.value || "";
  if (!report) return;
  try {
    await navigator.clipboard.writeText(report);
    showToast("Status report copied", "success");
  } catch {
    document.querySelector("#status-report-output")?.select();
    showToast("Status report selected", "info");
  }
}

function portalSharePacket(companyId) {
  const company = byId(state.companies, companyId);
  if (!company) return "";
  const portal = companyPortalSnapshot(companyId);
  const openTasks = portal.openTasks.slice(0, 6);
  const approvals = portal.pendingApprovals.slice(0, 6);
  const decisions = portalDecisionItems(companyId).slice(0, 6);
  const assets = [...portal.documents, ...portal.files]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6);
  return [
    `# ${company.name} Portal Update`,
    "",
    `Progress: ${portal.progress}% complete across ${portal.projects.length} ${portal.projects.length === 1 ? "project" : "projects"}.`,
    `Open work: ${portal.openTasks.length}. Pending approvals: ${portal.pendingApprovals.length}. Shared assets: ${portal.documents.length + portal.files.length}.`,
    "",
    "## Approvals",
    ...(approvals.length ? approvals.map((approval) => `- ${approval.title}: ${approvalStatusLabel(approval.status)} by ${formatDate(approval.dueDate)}. ${approval.summary || ""}`.trim()) : ["- No approvals are pending."]),
    "",
    "## Decision Packet",
    ...(decisions.length ? decisions.map((item) => `- Review: ${item.approval.title}. Requested by ${memberName(item.approval.requester)} for ${item.approval.reviewer}. Source: ${item.task?.title || "No source task"}. Assets: ${item.assets.length ? item.assets.map((asset) => asset.title).join(", ") : "No shared assets attached"}.`) : ["- No decision packet is needed right now."]),
    "",
    "## Next Work",
    ...(openTasks.length ? openTasks.map((task) => `- ${task.title}: ${statusLabel(task.status)}, due ${formatDate(task.dueDate)}.`) : ["- No open work is visible right now."]),
    "",
    "## Shared Assets",
    ...(assets.length ? assets.map((asset) => `- ${asset.title} (${asset.type || asset.kind}) in ${projectName(asset.projectId)}.`) : ["- No shared docs or files yet."])
  ].join("\n");
}

async function copyPortalSharePacket(companyId) {
  const packet = portalSharePacket(companyId);
  if (!packet) return;
  try {
    await navigator.clipboard.writeText(packet);
    showToast("Portal share packet copied", "success");
  } catch {
    showToast("Portal packet ready in the generated client update flow", "info");
  }
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

function renderWorkloadReportRow(row) {
  const width = clamp(row.utilization, 0, 140);
  return `
    <article class="workload-report-row">
      <div>
        <span class="avatar">${row.member.name.split(" ").map((part) => part[0]).join("")}</span>
        <div>
          <h3>${escapeHtml(row.member.name)}</h3>
          <p>${escapeHtml(row.member.role)} - ${escapeHtml(capacityStatusLabel(row.status))}</p>
        </div>
      </div>
      <span class="status-pill ${capacityStatusClass(row.status)}">${row.utilization}%</span>
      <div class="workload-bar ${row.status === "overloaded" ? "workload-danger" : row.status === "at-risk" ? "workload-warn" : ""}" aria-label="${row.utilization}% capacity utilization">
        <span style="width: ${width}%"></span>
        <strong>${escapeHtml(formatDuration(Math.max(row.plannedMinutes, row.loggedMinutes)))} / ${escapeHtml(formatDuration(row.capacityMinutes))}</strong>
      </div>
      <div class="portfolio-report-metrics">
        <span>${row.openTasks.length} open</span>
        <span>${row.blockedTasks.length} blocked</span>
        <span>${row.dueSoon.length} due soon</span>
        <span>${formatDuration(row.loggedMinutes)} logged</span>
      </div>
    </article>
  `;
}

function goalRows() {
  return state.goals.map((goal) => {
    const linkedProjects = goal.projectIds.map((projectId) => byId(state.projects, projectId)).filter(Boolean);
    const linkedTasks = state.tasks.filter((task) => goal.projectIds.includes(task.projectId));
    const projectRows = linkedProjects.map((project) => projectReport(project, linkedTasks, state.timeEntries || [], state.intakeSubmissions || []));
    const keyResultProgress = goal.keyResults.length
      ? Math.round(goal.keyResults.reduce((total, result) => total + result.progress, 0) / goal.keyResults.length)
      : 0;
    const projectProgressScore = projectRows.length
      ? Math.round(projectRows.reduce((total, row) => total + row.progress, 0) / projectRows.length)
      : keyResultProgress;
    const progress = goal.keyResults.length && projectRows.length
      ? Math.round((keyResultProgress + projectProgressScore) / 2)
      : Math.max(keyResultProgress, projectProgressScore);
    const blocked = linkedTasks.filter(isTaskBlocked);
    const overdue = linkedTasks.filter(isOverdue);
    const health = reportHealthScore({ progress, overdue: overdue.length, blocked: blocked.length, openIntake: 0 });
    return {
      goal,
      linkedProjects,
      linkedTasks,
      projectRows,
      keyResultProgress,
      progress,
      blocked,
      overdue,
      health
    };
  });
}

function renderGoals() {
  const rows = goalRows().filter((row) => state.filters.company === "all" || row.goal.companyId === state.filters.company);
  const activeRows = rows.filter((row) => row.goal.status === "active");
  const atRiskRows = rows.filter((row) => row.health < 70 || row.goal.status === "at-risk");
  const averageProgress = rows.length ? Math.round(rows.reduce((total, row) => total + row.progress, 0) / rows.length) : 0;
  const linkedProjects = new Set(rows.flatMap((row) => row.goal.projectIds));

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Active goals", activeRows.length)}
      ${metric("At risk", atRiskRows.length)}
      ${metric("Avg progress", `${averageProgress}%`)}
      ${metric("Linked projects", linkedProjects.size)}
    </div>

    <section class="panel goal-ladder-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Strategy</p>
          <h2>Objective ladder</h2>
        </div>
        <span class="status-pill ${atRiskRows.length ? "inbox-amber" : "inbox-green"}">${rows.length} goals</span>
      </div>
      <div class="goal-ladder">
        ${rows.length ? rows.map(renderGoalLadderRow).join("") : emptyState("No goals match the current filters.")}
      </div>
    </section>

    <div class="goals-grid">
      ${rows.length ? rows.map(renderGoalCard).join("") : emptyState("No goals yet. Add company objectives to connect strategy to projects.")}
    </div>
  `;
}

function renderGoalLadderRow(row) {
  return `
    <article>
      <span>${escapeHtml(row.goal.period)}</span>
      <strong>${escapeHtml(row.goal.title)}</strong>
      <small>${escapeHtml(companyName(row.goal.companyId))} / ${escapeHtml(memberName(row.goal.owner))}</small>
      <div class="progress-track"><span style="width: ${row.progress}%"></span></div>
    </article>
  `;
}

function renderGoalCard(row) {
  const healthTone = row.health < 45 ? "red" : row.health < 70 ? "amber" : "green";
  return `
    <article class="goal-card">
      <div class="goal-card-header">
        <div>
          <p class="eyebrow">${escapeHtml(row.goal.period)} / ${escapeHtml(companyName(row.goal.companyId))}</p>
          <h2>${escapeHtml(row.goal.title)}</h2>
        </div>
        <span class="status-pill inbox-${healthTone}">${row.health}% health</span>
      </div>
      <div class="goal-meta-grid">
        <span><strong>${row.progress}%</strong> progress</span>
        <span><strong>${escapeHtml(memberName(row.goal.owner))}</strong> owner</span>
        <span><strong>${row.overdue.length}</strong> overdue</span>
        <span><strong>${row.blocked.length}</strong> blocked</span>
      </div>
      <div class="progress-block" aria-label="${row.progress}% complete">
        <strong>${row.progress}%</strong>
        <span class="progress-track"><span style="width: ${row.progress}%"></span></span>
      </div>
      <div class="key-result-list">
        ${row.goal.keyResults.map(renderKeyResult).join("")}
      </div>
      <div class="goal-project-list">
        ${row.projectRows.length ? row.projectRows.map(renderGoalProjectRow).join("") : emptyState("No linked projects yet.")}
      </div>
    </article>
  `;
}

function renderKeyResult(result) {
  return `
    <article class="key-result-row">
      <div>
        <strong>${escapeHtml(result.title)}</strong>
        <small>${escapeHtml(result.target || "Target not set")}</small>
      </div>
      <span>${result.progress}%</span>
      <div class="progress-track"><span style="width: ${result.progress}%"></span></div>
    </article>
  `;
}

function renderGoalProjectRow(row) {
  return `
    <article class="goal-project-row">
      <button class="table-task-button" type="button" data-project-id="${row.project.id}">
        <strong>${escapeHtml(row.project.name)}</strong>
        <span>${row.progress}% progress / ${row.health}% health</span>
      </button>
      <span class="status-pill ${row.health < 70 ? "inbox-amber" : "inbox-green"}">${row.openTasks.length} open</span>
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

function projectTemplateCategories() {
  return Array.from(new Set(state.projectTemplates.map((template) => template.category).filter(Boolean))).sort();
}

function templateSearchHaystack(template) {
  return [
    template.name,
    template.category,
    template.description,
    ...(template.tasks || []).flatMap((task) => [task.title, task.description, ...(task.tags || [])]),
    ...(template.milestones || []).map((milestone) => milestone.title),
    ...(template.docs || []).map((document) => document.title)
  ].join(" ").toLowerCase();
}

function filteredProjectTemplates() {
  const category = state.templateLibrary?.category || "all";
  const query = (state.templateLibrary?.query || "").trim().toLowerCase();
  return state.projectTemplates.filter((template) => {
    const matchesCategory = category === "all" || template.category === category;
    const matchesQuery = !query || templateSearchHaystack(template).includes(query);
    return matchesCategory && matchesQuery;
  });
}

function selectedProjectTemplate(templates = filteredProjectTemplates()) {
  const selectedId = state.templateLibrary?.selectedProjectTemplateId;
  return templates.find((template) => template.id === selectedId) || templates[0] || state.projectTemplates[0] || null;
}

function recommendedFirstTemplate() {
  return byId(state.projectTemplates, "template-client-onboarding") || state.projectTemplates[0] || null;
}

function openRecommendedTemplateFlow() {
  const template = recommendedFirstTemplate();
  if (!template) {
    setRoute("templates");
    return;
  }
  state.templateLibrary = {
    ...(state.templateLibrary || {}),
    category: template.category || "all",
    query: "",
    selectedProjectTemplateId: template.id
  };
  state.selectedRoute = "templates";
  openSidebarGroupForRoute("templates");
  saveState();
  render();
  showToast(`${template.name} is ready to customize`, "success");
}

function renderRecommendedTemplatePanel(template) {
  if (!template) return "";
  return `
    <section class="panel recommended-template-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Recommended first template</p>
          <h2>${escapeHtml(template.name)}</h2>
        </div>
        <span class="status-pill inbox-green">Golden path</span>
      </div>
      <p class="panel-note">Start here when you want to prove Agora with real client work: kickoff, discovery, delivery planning, handoff, docs, intake, and milestones in one project.</p>
      <div class="recommended-template-grid">
        <span><strong>${template.tasks.length}</strong><small>Tasks</small></span>
        <span><strong>${template.milestones.length}</strong><small>Milestones</small></span>
        <span><strong>${template.docs.length}</strong><small>Docs</small></span>
        <span><strong>${template.durationDays}</strong><small>Days</small></span>
      </div>
      <div class="marketplace-actions">
        <button class="button button-secondary" type="button" data-preview-project-template="${template.id}">Preview Tasks</button>
        <button class="button button-primary" type="button" data-use-project-template="${template.id}">Create Client Project</button>
      </div>
    </section>
  `;
}

function marketplaceHubStats() {
  const installedMarketplaceTemplates = marketplaceProjectTemplates.filter((template) => state.projectTemplates.some((item) => item.id === template.id || item.name.toLowerCase() === template.name.toLowerCase()));
  const installedAutomationPacks = automationMarketplacePacks.filter(automationMarketplaceInstalled);
  const premiumTemplates = marketplaceProjectTemplates.filter(marketplaceTemplateRequiresEntitlement);
  const authoredRules = state.automations.filter((automation) => automation.source !== "marketplace" && automation.source !== "imported");
  return {
    projectTemplates: marketplaceProjectTemplates.length,
    installedTemplates: installedMarketplaceTemplates.length,
    automationPacks: automationMarketplacePacks.length,
    installedAutomationPacks: installedAutomationPacks.length,
    premiumTemplates: premiumTemplates.length,
    authoredRules: authoredRules.length
  };
}

function marketplaceApiStats() {
  return {
    projectTemplates: Array.isArray(marketplaceApiCatalog?.projectTemplates) ? marketplaceApiCatalog.projectTemplates.length : 0,
    automationPacks: Array.isArray(marketplaceApiCatalog?.automationPacks) ? marketplaceApiCatalog.automationPacks.length : 0,
    updatedAt: marketplaceApiCatalog?.updatedAt || ""
  };
}

function renderMarketplaceHub() {
  const stats = marketplaceHubStats();
  els.appView.innerHTML = `
    ${renderRouteHeader({
      eyebrow: "Marketplace",
      title: "Install and share portable workflows",
      description: "Use project templates and automation packs as plain JSON building blocks for repeatable client delivery.",
      actions: [
        { label: "Review Agency Handoff Pack", commandId: "automation:recommended", primary: true },
        { label: "Open Templates", route: "templates" }
      ]
    })}

    <div class="metric-grid">
      ${metric("Templates", `${stats.installedTemplates}/${stats.projectTemplates}`)}
      ${metric("Automation packs", `${stats.installedAutomationPacks}/${stats.automationPacks}`)}
      ${metric("Premium packs", stats.premiumTemplates)}
      ${metric("Rules to share", stats.authoredRules)}
    </div>

    <div class="marketplace-hub-grid">
      <section class="panel marketplace-command-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Community hub</p>
            <h2>Install, import, export</h2>
          </div>
          <span class="status-pill inbox-blue">Open JSON</span>
        </div>
        <p class="panel-note">Marketplace items are portable by design: install starter workflows, export unlocked project templates, import automation packs, and publish your own rule packs as plain JSON.</p>
        <div class="marketplace-command-grid">
          <article>
            <strong>1. Start faster</strong>
            <span>Install project templates for agency, finance, creative, software, research, nonprofit, and media workflows.</span>
          </article>
          <article>
            <strong>2. Share operations</strong>
            <span>Export automation packs with creator, category, and license metadata.</span>
          </article>
          <article>
            <strong>3. Keep it portable</strong>
            <span>Every marketplace item can move by JSON before a hosted registry exists.</span>
          </article>
        </div>
        <div class="marketplace-actions">
          <button class="button button-secondary" type="button" data-route="templates">Open Templates</button>
          <button class="button button-secondary" type="button" data-route="automations">Open Automations</button>
          <button class="button button-primary" type="button" data-route="data">Export Workspace</button>
        </div>
      </section>

      ${renderTemplateMarketplacePanel()}
      ${renderMarketplaceApiPanel()}
      ${renderAutomationMarketplacePanel()}
      ${renderAutomationPackAuthorPanel()}
    </div>
  `;
}

function renderMarketplaceApiPanel() {
  const stats = marketplaceApiStats();
  const authoredRules = state.automations.filter((automation) => automation.source !== "marketplace" && automation.source !== "imported");
  return `
    <section class="panel marketplace-api-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Hosted registry</p>
          <h2>Marketplace API</h2>
        </div>
        <span class="status-pill ${apiSession ? "inbox-green" : "inbox-neutral"}">${apiSession ? "API connected" : "Offline"}</span>
      </div>
      <p class="panel-note">Publish local project templates and authored automation rules to the Agora API, then load the hosted catalog into another workspace.</p>
      <div class="marketplace-api-grid">
        <article>
          <strong>${state.projectTemplates.length}</strong>
          <span>Local templates ready to publish</span>
        </article>
        <article>
          <strong>${authoredRules.length}</strong>
          <span>Authored automation rules</span>
        </article>
        <article>
          <strong>${stats.projectTemplates}</strong>
          <span>API templates loaded</span>
        </article>
        <article>
          <strong>${stats.automationPacks}</strong>
          <span>API automation packs loaded</span>
        </article>
      </div>
      <div class="marketplace-actions">
        <button class="button button-primary" type="button" id="marketplace-api-publish" ${apiSession && !marketplaceApiLoading ? "" : "disabled"}>${marketplaceApiLoading ? "Working" : "Publish Local Catalog"}</button>
        <button class="button button-secondary" type="button" id="marketplace-api-load" ${apiSession && !marketplaceApiLoading ? "" : "disabled"}>Load API Catalog</button>
      </div>
      <small>${stats.updatedAt ? `API catalog updated ${escapeHtml(formatTimestamp(stats.updatedAt))}` : "Connect the API and publish once to make the hosted registry available."}</small>
    </section>
  `;
}

function renderTemplates() {
  const projectTemplateTaskCount = state.projectTemplates.reduce((total, template) => total + template.tasks.length, 0);
  const projectTemplateDocCount = state.projectTemplates.reduce((total, template) => total + template.docs.length, 0);
  const templates = filteredProjectTemplates();
  const selectedTemplate = selectedProjectTemplate(templates);
  const recommendedTemplate = recommendedFirstTemplate();
  if (selectedTemplate && state.templateLibrary.selectedProjectTemplateId !== selectedTemplate.id) {
    state.templateLibrary.selectedProjectTemplateId = selectedTemplate.id;
  }

  els.appView.innerHTML = `
    ${renderRouteHeader({
      eyebrow: "Templates",
      title: "Start from proven project patterns",
      description: "Create the first client workspace from Client Onboarding, then save, import, or share templates as your process matures.",
      actions: [
        { label: "Start Client Onboarding", commandId: "template:recommended", primary: true },
        { label: "Open Marketplace", route: "marketplace" }
      ]
    })}

    <div class="metric-grid">
      ${metric("Project templates", state.projectTemplates.length)}
      ${metric("Marketplace", marketplaceProjectTemplates.length)}
      ${metric("Task templates", state.taskTemplates.length)}
      ${metric("Template tasks", projectTemplateTaskCount)}
      ${metric("Template docs", projectTemplateDocCount)}
    </div>

    ${renderRecommendedTemplatePanel(recommendedTemplate)}

    <div class="templates-grid">
      <section class="panel template-library-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Starter packs</p>
            <h2>Project template library</h2>
          </div>
        </div>
        <div class="template-library-toolbar">
          <label class="search-control template-search-control">
            <span>Search templates</span>
            <input id="template-search" type="search" value="${escapeHtml(state.templateLibrary?.query || "")}" placeholder="Finance, art, launch, research">
          </label>
          <div class="template-category-list" aria-label="Template categories">
            ${["all", ...projectTemplateCategories()].map((category) => `
              <button class="template-category-chip ${category === (state.templateLibrary?.category || "all") ? "is-active" : ""}" type="button" data-template-category="${escapeHtml(category)}">
                ${category === "all" ? "All" : escapeHtml(category)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="template-composer">
          <label>
            <span>Template name</span>
            <input id="project-template-name" placeholder="Client launch pack">
          </label>
          <label>
            <span>Creator</span>
            <input id="project-template-creator" placeholder="Creator or organization">
          </label>
          <label>
            <span>Source project</span>
            <select id="project-template-source">
              ${activeProjects().map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Price</span>
            <input id="project-template-price" type="number" min="0" step="0.01" placeholder="0.00">
          </label>
          <label>
            <span>Currency</span>
            <select id="project-template-currency">
              ${paymentCurrencyOptions.map((currency) => `<option value="${currency}">${escapeHtml(currency)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Payout mode</span>
            <select id="project-template-payout-mode">
              ${templatePayoutModes.map((mode) => `<option value="${mode.id}">${escapeHtml(mode.label)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Recipient / wallet owner</span>
            <input id="project-template-payout-recipient" placeholder="Creator, charity, or org">
          </label>
          <label>
            <span>Wallet chain</span>
            <select id="project-template-payout-chain">
              ${templatePayoutChains.map((chain) => `<option value="${chain}">${escapeHtml(chain)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Wallet address</span>
            <input id="project-template-payout-wallet" placeholder="0x..., solana address, or payment handle">
          </label>
          <label>
            <span>Charity</span>
            <input id="project-template-payout-charity" placeholder="Charity or fund name">
          </label>
          <label>
            <span>Donation %</span>
            <input id="project-template-donation-percent" type="number" min="0" max="100" step="1" value="0">
          </label>
          <button class="button button-secondary" type="button" id="project-template-create">Save Project Template</button>
        </div>
        <div class="template-list">
          ${templates.length ? templates.map((template) => renderProjectTemplateCard(template, selectedTemplate?.id === template.id)).join("") : emptyState(
            "No project templates match that search.",
            { label: "Open Marketplace", route: "marketplace" }
          )}
        </div>
      </section>

      <div class="template-side-stack">
        ${renderProjectTemplatePreview(selectedTemplate)}
        ${renderTemplateMarketplacePanel()}
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Reusable work</p>
              <h2>Task templates</h2>
            </div>
          </div>
          <div class="template-composer">
            <label>
              <span>Template name</span>
              <input id="task-template-name" placeholder="Weekly client review">
            </label>
            <label>
              <span>Source task</span>
              <select id="task-template-source">
                ${activeTasks().map((task) => `<option value="${task.id}">${escapeHtml(task.title)}</option>`).join("")}
              </select>
            </label>
            <button class="button button-secondary" type="button" id="task-template-create">Save Task Template</button>
          </div>
          <div class="template-list">
            ${state.taskTemplates.map(renderTaskTemplateCard).join("")}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderTemplateMarketplacePanel() {
  return `
    <section class="panel template-marketplace-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Community</p>
          <h2>Template marketplace</h2>
        </div>
      </div>
      <div class="marketplace-list">
        ${marketplaceProjectTemplates.map(renderMarketplaceTemplateCard).join("")}
      </div>
      <div class="template-import-panel">
        <label>
          <span>Import shared template JSON</span>
          <textarea id="template-import-json" rows="6" placeholder="Paste an Agora project-template or template-marketplace JSON export"></textarea>
        </label>
        ${renderProjectTemplateImportPreview()}
        <div class="marketplace-actions">
          <button class="button button-secondary" type="button" id="template-import-preview">Preview JSON</button>
          <button class="button button-primary" type="button" id="template-import-button">Install Templates</button>
        </div>
      </div>
    </section>
  `;
}

function renderMarketplaceTrustFacts(facts, warnings = []) {
  return `
    <div class="marketplace-trust-grid">
      ${facts.map((fact) => `
        <span>
          <strong>${escapeHtml(fact.value)}</strong>
          <small>${escapeHtml(fact.label)}</small>
        </span>
      `).join("")}
    </div>
    ${warnings.length ? `
      <div class="marketplace-warning-list">
        ${warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}
      </div>
    ` : ""}
  `;
}

function renderTemplateTrustFacts(template, { installed = false } = {}) {
  const warnings = templateTrustWarnings(template);
  return renderMarketplaceTrustFacts([
    { label: "Validation", value: warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "Validated" },
    { label: "Creator", value: templateCreatorLabel(template) },
    { label: "Access", value: installed ? "Installed" : marketplaceTemplatePriceLabel(template) },
    { label: "Contents", value: `${template.tasks.length} tasks` },
    { label: "Payout", value: templatePayoutLabel(template) }
  ], warnings);
}

function renderMarketplaceTemplateCard(template) {
  const installed = state.projectTemplates.some((item) => item.id === template.id || item.name.toLowerCase() === template.name.toLowerCase());
  const priceLabel = marketplaceTemplatePriceLabel(template);
  const requiresEntitlement = marketplaceTemplateRequiresEntitlement(template);
  const unlocked = marketplaceTemplateIsUnlocked(template);
  const locked = requiresEntitlement && !unlocked;
  return `
    <article class="marketplace-template-card ${installed ? "is-installed" : ""} ${locked ? "is-locked" : ""}">
      <div>
        <div class="marketplace-card-kicker">
          <span class="status-pill ${installed ? "inbox-green" : "inbox-blue"}">${installed ? "Installed" : escapeHtml(template.category)}</span>
          <span class="status-pill inbox-neutral">${escapeHtml(priceLabel)}</span>
          ${requiresEntitlement ? `<span class="status-pill ${unlocked ? "inbox-green" : "inbox-amber"}">${unlocked ? "Unlocked" : "Gated"}</span>` : ""}
        </div>
        <h3>${escapeHtml(template.name)}</h3>
        <p>${escapeHtml(template.description)}</p>
        <p class="template-payout-summary">${escapeHtml(templateCreatorLabel(template))} - ${escapeHtml(templatePayoutLabel(template))}</p>
        <div class="template-meta">
          <span>${template.tasks.length} tasks</span>
          <span>${template.milestones.length} milestones</span>
          <span>${template.docs.length} docs</span>
          <span>${template.durationDays} days</span>
        </div>
        ${renderTemplateTrustFacts(template, { installed })}
      </div>
      <div class="marketplace-actions">
        <button class="button button-secondary compact-button" type="button" data-export-marketplace-template="${template.id}" ${locked ? "disabled" : ""}>Export JSON</button>
        ${locked ? `<button class="button button-secondary compact-button" type="button" data-grant-template-entitlement="${template.id}">Grant Test Access</button>` : ""}
        <button class="button button-primary compact-button" type="button" data-install-marketplace-template="${template.id}" ${installed || locked ? "disabled" : ""}>${installed ? "Installed" : locked ? "Locked" : "Install"}</button>
      </div>
    </article>
  `;
}

function renderProjectTemplateImportPreview() {
  const preview = state.templateImportPreview;
  if (!preview) {
    return `
      <div class="switcher-preview-empty">
        <strong>No template preview yet</strong>
        <span>Preview shared JSON to see template counts, creator metadata, pricing, and warnings before installing.</span>
      </div>
    `;
  }

  return `
    <div class="switcher-preview-panel template-import-preview">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(preview.typeLabel)}</p>
          <h3>${preview.templateCount} template${preview.templateCount === 1 ? "" : "s"} ready</h3>
        </div>
        <span class="status-pill ${preview.warningCount ? "inbox-amber" : "inbox-green"}">${preview.warningCount ? `${preview.warningCount} warnings` : "Validated"}</span>
      </div>
      <p class="panel-note">${preview.newCount}/${preview.templateCount} new to this workspace. Includes ${preview.taskCount} tasks, ${preview.milestoneCount} milestones, and ${preview.docCount} docs.</p>
      <div class="marketplace-trust-grid">
        <span><strong>${preview.premiumCount}</strong><small>Premium</small></span>
        <span><strong>${preview.creatorCount}</strong><small>Creators</small></span>
        <span><strong>${preview.intakeCount}</strong><small>Intake forms</small></span>
        <span><strong>${preview.exportedAt ? formatDate(preview.exportedAt) : "Unknown"}</strong><small>Exported</small></span>
      </div>
      <div class="switcher-preview-list">
        ${preview.templates.map((template) => `
          <article>
            <strong>${escapeHtml(template.name)}</strong>
            <span>${escapeHtml(template.category)} / ${template.tasks} tasks / ${escapeHtml(template.priceLabel)}${template.installed ? " / already installed" : ""}</span>
          </article>
        `).join("")}
      </div>
      ${preview.warnings.length ? `
        <div class="marketplace-warning-list">
          ${preview.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderProjectTemplateCard(template, isSelected = false) {
  const companies = visibleCompanies();
  const defaultCompany = state.filters.company === "all" ? companies[0]?.id : state.filters.company;
  return `
    <article class="template-card ${isSelected ? "is-selected" : ""}" data-project-template-card="${template.id}">
      <div>
        <span class="status-pill inbox-blue">${escapeHtml(template.category)}</span>
        <h3>${escapeHtml(template.name)}</h3>
        <p>${escapeHtml(template.description)}</p>
        <p class="template-payout-summary">${escapeHtml(templateCreatorLabel(template))} - ${escapeHtml(templatePayoutLabel(template))}</p>
        <div class="template-meta">
          <span>${template.tasks.length} tasks</span>
          <span>${template.milestones.length} milestones</span>
          <span>${template.docs.length} docs</span>
          <span>${template.durationDays} days</span>
          <span>${escapeHtml(marketplaceTemplatePriceLabel(template))}</span>
          <span>${template.intakeForm ? "Includes intake" : "No intake"}</span>
        </div>
      </div>
      <div class="template-controls">
        <label>
          <span>Company</span>
          <select data-template-company>
            ${companies.map((company) => `<option value="${company.id}" ${company.id === defaultCompany ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}
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
        <button class="button button-secondary" type="button" data-preview-project-template="${template.id}">Preview</button>
        <button class="button button-secondary" type="button" data-export-project-template="${template.id}">Export JSON</button>
        <button class="button button-primary" type="button" data-use-project-template="${template.id}">Create Project</button>
        <button class="button button-secondary button-danger" type="button" data-delete-project-template="${template.id}">Delete Template</button>
      </div>
    </article>
  `;
}

function renderProjectTemplatePreview(template) {
  if (!template) {
    return `
      <section class="panel template-preview-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Preview</p>
            <h2>Template details</h2>
          </div>
        </div>
        ${emptyState(
          "Choose a template to preview its tasks, milestones, docs, and setup options.",
          { label: "Start Client Onboarding", commandId: "template:recommended" }
        )}
      </section>
    `;
  }
  const companies = visibleCompanies();
  const defaultCompany = state.filters.company === "all" ? companies[0]?.id : state.filters.company;
  return `
    <section class="panel template-preview-panel" data-template-preview="${template.id}">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(template.category)} template</p>
          <h2>${escapeHtml(template.name)}</h2>
        </div>
        <span class="status-pill inbox-green">${template.durationDays} days</span>
      </div>
      <p class="template-preview-description">${escapeHtml(template.description)}</p>
      <div class="template-preview-badges">
        <span>${template.tasks.length} tasks</span>
        <span>${template.milestones.length} milestones</span>
        <span>${template.docs.length} docs</span>
        <span>${escapeHtml(marketplaceTemplatePriceLabel(template))}</span>
        <span>${template.intakeForm ? "Intake included" : "No intake form"}</span>
      </div>
      <div class="template-payout-panel">
        <strong>${escapeHtml(templateCreatorLabel(template))}</strong>
        <span>${escapeHtml(templatePayoutLabel(template))}</span>
        <small>${escapeHtml(templateWalletLabel(template))}</small>
      </div>
      <div class="template-preview-form">
        <label>
          <span>Company</span>
          <select id="template-preview-company">
            ${companies.map((company) => `<option value="${company.id}" ${company.id === defaultCompany ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Start</span>
          <input id="template-preview-start" type="date" value="${todayKey()}">
        </label>
        <label>
          <span>Project owner</span>
          <select id="template-preview-owner">
            ${workspaceMembers().map((member) => `<option value="${member.id}" ${member.id === template.owner ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
          </select>
        </label>
        <label class="wide-field">
          <span>Project name</span>
          <input id="template-preview-name" placeholder="${escapeHtml(template.name)}">
        </label>
      </div>
      <div class="template-preview-grid">
        <section>
          <h3>Included tasks</h3>
          <div class="template-task-checklist">
            ${template.tasks.map((task) => `
              <label>
                <input type="checkbox" data-template-task-key="${escapeHtml(task.key)}" checked>
                <span>
                  <strong>${escapeHtml(task.title)}</strong>
                  <small>${memberName(task.assignee)} - ${priorityLabel(task.priority)} - day ${task.startOffset} to ${task.dueOffset}</small>
                </span>
              </label>
            `).join("")}
          </div>
        </section>
        <section>
          <h3>Milestones and docs</h3>
          <div class="template-preview-stack">
            ${template.milestones.map((milestone) => `
              <article>
                <strong>${escapeHtml(milestone.title)}</strong>
                <span>Day ${milestone.dueOffset} - ${memberName(milestone.owner)}</span>
              </article>
            `).join("")}
            ${template.docs.map((document) => `
              <article>
                <strong>${escapeHtml(document.title)}</strong>
                <span>${escapeHtml(document.type)}</span>
              </article>
            `).join("")}
          </div>
        </section>
      </div>
      <div class="template-preview-actions">
        <button class="button button-secondary" type="button" data-export-project-template="${template.id}">Export JSON</button>
        <button class="button button-primary" type="button" id="template-preview-create">Create Customized Project</button>
      </div>
    </section>
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
        <button class="button button-secondary button-danger" type="button" data-delete-task-template="${template.id}">Delete Template</button>
      </div>
    </article>
  `;
}

function automationMarketplaceInstalled(pack) {
  return pack.rules.every((rule) => state.automations.some((automation) => automation.marketplacePackId === pack.id && automation.name === rule.name));
}

function recommendedAutomationPack() {
  return byId(automationMarketplacePacks, "automation-pack-agency-handoff") || automationMarketplacePacks[0] || null;
}

function openRecommendedAutomationFlow() {
  const pack = recommendedAutomationPack();
  state.selectedRoute = "marketplace";
  openSidebarGroupForRoute("marketplace");
  saveState();
  render();
  if (pack) showToast(`${pack.name} is ready to review`, "success");
}

function automationMarketplacePackPayload(pack) {
  return {
    type: "agora.automation-pack",
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    pack: {
      ...pack,
      rules: pack.rules.map((rule) => normalizeAutomationRule({
        ...rule,
        id: `${pack.id}-${slugFromName(rule.name)}`,
        marketplacePackId: pack.id,
        source: "marketplace",
        creatorName: pack.creatorName,
        license: pack.license
      }))
    }
  };
}

function parseAutomationPackPayload(rawJson) {
  const parsed = JSON.parse(rawJson);
  const pack = parsed.pack && typeof parsed.pack === "object" ? parsed.pack : parsed;
  const name = String(pack.name || "").trim();
  if (!name) throw new Error("Automation pack needs a name");
  const rules = Array.isArray(pack.rules) ? pack.rules : [];
  if (!rules.length) throw new Error("Automation pack needs at least one rule");
  const packId = String(pack.id || `automation-pack-${slugFromName(name)}`).trim().slice(0, 96);
  const creatorName = String(pack.creatorName || "Community creator").trim().slice(0, 96);
  const license = String(pack.license || "Community workflow pack").trim().slice(0, 96);
  const normalizedPack = {
    id: packId,
    name,
    category: String(pack.category || "Community").trim().slice(0, 80) || "Community",
    creatorName,
    license,
    description: String(pack.description || `Community automation pack for ${name}.`).trim().slice(0, 240),
    rules: rules.slice(0, 20).map((rule, index) => normalizeAutomationRule({
      ...rule,
      id: rule.id || `${packId}-${index + 1}`,
      marketplacePackId: packId,
      source: "imported",
      creatorName,
      license,
      lastRun: "",
      runCount: 0
    }))
  };
  return {
    type: parsed.type || "agora.automation-pack",
    exportVersion: parsed.exportVersion || 1,
    exportedAt: parsed.exportedAt || "",
    pack: normalizedPack
  };
}

function automationPackImportPreview(rawJson) {
  const payload = parseAutomationPackPayload(rawJson);
  const existingKeys = new Set(state.automations.map((automation) => `${automation.marketplacePackId || ""}:${automation.name}`));
  const duplicateCount = payload.pack.rules.filter((rule) => existingKeys.has(`${payload.pack.id}:${rule.name}`)).length;
  const warnings = automationPackTrustWarnings(payload.pack);
  if (duplicateCount) warnings.push(`${duplicateCount} rule${duplicateCount === 1 ? "" : "s"} already installed`);
  return {
    id: uid("automation-pack-preview"),
    packId: payload.pack.id,
    name: payload.pack.name,
    category: payload.pack.category,
    creatorName: payload.pack.creatorName,
    license: payload.pack.license,
    description: payload.pack.description,
    ruleCount: payload.pack.rules.length,
    duplicateCount,
    warningCount: warnings.length,
    warnings,
    exportedAt: payload.exportedAt,
    rules: payload.pack.rules.map((rule) => ({
      name: rule.name,
      trigger: rule.trigger,
      action: rule.action,
      enabled: rule.enabled
    })),
    createdAt: new Date().toISOString()
  };
}

function renderAutomationPackTrustFacts(pack, { installed = false, duplicateCount = 0, warnings = null } = {}) {
  const warningList = warnings || automationPackTrustWarnings(pack);
  return renderMarketplaceTrustFacts([
    { label: "Validation", value: warningList.length ? `${warningList.length} warning${warningList.length === 1 ? "" : "s"}` : "Validated" },
    { label: "Creator", value: pack.creatorName || "Community creator" },
    { label: "License", value: pack.license || "Not set" },
    { label: "Rules", value: installed ? "Installed" : `${Math.max(0, pack.rules.length - duplicateCount)}/${pack.rules.length} new` }
  ], warningList);
}

function renderAutomationMarketplacePanel() {
  const recommendedPack = recommendedAutomationPack();
  return `
    <section class="panel automation-marketplace-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Open automation marketplace</p>
          <h2>Install workflow packs</h2>
        </div>
        <span class="status-pill inbox-blue">${automationMarketplacePacks.length} packs</span>
      </div>
      <p class="panel-note">Community packs are plain JSON rules. Install them locally, export them, remix them, and share them with another Agora workspace.</p>
      ${renderRecommendedAutomationPackPanel(recommendedPack)}
      <div class="automation-pack-list">
        ${automationMarketplacePacks.map((pack) => {
          const installed = automationMarketplaceInstalled(pack);
          return `
            <article class="automation-pack-card ${installed ? "is-installed" : ""}">
              <div>
                <div class="marketplace-card-kicker">
                  <span class="status-pill inbox-neutral">${escapeHtml(pack.category)}</span>
                  <span class="status-pill ${installed ? "inbox-green" : "inbox-blue"}">${installed ? "Installed" : `${pack.rules.length} rules`}</span>
                </div>
                <h3>${escapeHtml(pack.name)}</h3>
                <p>${escapeHtml(pack.description)}</p>
                <small>${escapeHtml(pack.creatorName)} / ${escapeHtml(pack.license)}</small>
                ${renderAutomationPackTrustFacts(pack, { installed })}
              </div>
              <div class="automation-pack-rules">
                ${pack.rules.map((rule) => `<span>${escapeHtml(rule.name)}</span>`).join("")}
              </div>
              <div class="marketplace-actions">
                <button class="button button-primary compact-button" type="button" data-install-automation-pack="${pack.id}" ${installed ? "disabled" : ""}>Install Pack</button>
                <button class="button button-secondary compact-button" type="button" data-export-automation-pack="${pack.id}">Export JSON</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
      <div class="automation-pack-import">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Community import</p>
            <h3>Import automation pack JSON</h3>
          </div>
        </div>
        <textarea id="automation-pack-import-payload" rows="8" placeholder="Paste an Agora automation pack JSON export"></textarea>
        ${renderAutomationPackImportPreview()}
        <div class="marketplace-actions">
          <button class="button button-secondary" type="button" id="automation-pack-import-preview">Preview Pack</button>
          <button class="button button-primary" type="button" id="automation-pack-import-install">Install Imported Pack</button>
        </div>
      </div>
    </section>
  `;
}

function renderRecommendedAutomationPackPanel(pack) {
  if (!pack) return "";
  const installed = automationMarketplaceInstalled(pack);
  return `
    <section class="recommended-automation-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Recommended first automation pack</p>
          <h3>${escapeHtml(pack.name)}</h3>
        </div>
        <span class="status-pill ${installed ? "inbox-green" : "inbox-blue"}">${installed ? "Installed" : `${pack.rules.length} rules`}</span>
      </div>
      <p>${escapeHtml(pack.description)}</p>
      <div class="recommended-automation-grid">
        <span><strong>${pack.rules.length}</strong><small>Rules</small></span>
        <span><strong>${escapeHtml(pack.category)}</strong><small>Category</small></span>
        <span><strong>${escapeHtml(pack.creatorName)}</strong><small>Creator</small></span>
        <span><strong>${escapeHtml(pack.license)}</strong><small>License</small></span>
      </div>
      <div class="automation-pack-rules">
        ${pack.rules.map((rule) => `<span>${escapeHtml(rule.name)}</span>`).join("")}
      </div>
      <div class="marketplace-actions">
        <button class="button button-primary" type="button" data-install-automation-pack="${escapeHtml(pack.id)}" ${installed ? "disabled" : ""}>${installed ? "Pack Installed" : "Install Recommended Pack"}</button>
        <button class="button button-secondary" type="button" data-export-automation-pack="${escapeHtml(pack.id)}">Export JSON</button>
      </div>
    </section>
  `;
}

function renderAutomationPackImportPreview() {
  const preview = state.automationPackImportPreview;
  if (!preview) {
    return `
      <div class="switcher-preview-empty">
        <strong>No automation pack preview yet</strong>
        <span>Preview a community pack before installing its rules.</span>
      </div>
    `;
  }

  return `
    <div class="switcher-preview-panel automation-pack-preview">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(preview.category)}</p>
          <h3>${escapeHtml(preview.name)}</h3>
        </div>
        <span class="status-pill ${preview.duplicateCount ? "inbox-amber" : "inbox-green"}">${preview.ruleCount - preview.duplicateCount}/${preview.ruleCount} new</span>
      </div>
      <p class="panel-note">${escapeHtml(preview.description)}</p>
      ${renderAutomationPackTrustFacts({
        creatorName: preview.creatorName,
        license: preview.license,
        rules: preview.rules
      }, { duplicateCount: preview.duplicateCount, warnings: preview.warnings })}
      <div class="automation-pack-rules">
        ${preview.rules.map((rule) => `<span>${escapeHtml(rule.name)}</span>`).join("")}
      </div>
      <small>${escapeHtml(preview.creatorName)} / ${escapeHtml(preview.license)}</small>
    </div>
  `;
}

function renderAutomationPackAuthorPanel() {
  return `
    <section class="panel automation-author-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Pack authoring</p>
          <h2>Share your automations</h2>
        </div>
        <span class="status-pill inbox-blue">${state.automations.length} available</span>
      </div>
      <p class="panel-note">Turn selected workspace rules into an open JSON pack with creator, category, and license metadata.</p>
      <div class="automation-pack-author-form">
        <label>
          <span>Pack name</span>
          <input id="automation-pack-name" placeholder="Client delivery safeguards">
        </label>
        <label>
          <span>Category</span>
          <input id="automation-pack-category" placeholder="Agency, Operations, Software">
        </label>
        <label>
          <span>Creator</span>
          <input id="automation-pack-creator" value="${escapeHtml(memberName(activeMemberId()) || state.workspace.name)}">
        </label>
        <label>
          <span>License</span>
          <input id="automation-pack-license" value="MIT-style workflow pack">
        </label>
        <label class="wide-field">
          <span>Description</span>
          <textarea id="automation-pack-description" rows="3" placeholder="What problem does this pack solve?"></textarea>
        </label>
      </div>
      <div class="automation-pack-selection">
        ${state.automations.length ? state.automations.map((automation) => `
          <label class="automation-pack-select-row">
            <input type="checkbox" data-author-automation="${automation.id}" checked>
            <span>
              <strong>${escapeHtml(automation.name)}</strong>
              <small>${escapeHtml(automation.trigger)} -> ${escapeHtml(automation.action)}</small>
            </span>
          </label>
        `).join("") : emptyState(
          "Create an automation rule before exporting a pack.",
          { label: "Review Agency Handoff Pack", commandId: "automation:recommended" }
        )}
      </div>
      <div class="marketplace-actions">
        <button class="button button-secondary" type="button" id="automation-pack-select-all" ${state.automations.length ? "" : "disabled"}>Select All</button>
        <button class="button button-secondary" type="button" id="automation-pack-clear-selection" ${state.automations.length ? "" : "disabled"}>Clear</button>
        <button class="button button-primary" type="button" id="automation-pack-export" ${state.automations.length ? "" : "disabled"}>Export Pack</button>
      </div>
    </section>
  `;
}

function renderAutomations() {
  const enabled = state.automations.filter((automation) => automation.enabled);
  const recentHistory = state.automationHistory.slice(0, 8);
  const suggestions = automationSuggestions();

  els.appView.innerHTML = `
    ${renderRouteHeader({
      eyebrow: "Automations",
      title: "Make the handoff workflow repeatable",
      description: "Install safe workflow packs, author local rules, and keep automation runs auditable and reversible.",
      actions: [
        { label: "Review Agency Handoff Pack", commandId: "automation:recommended", primary: true },
        { label: "Open Marketplace", route: "marketplace" }
      ]
    })}

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
        <div class="automation-composer">
          <input type="hidden" id="automation-id">
          <label>
            <span>Rule name</span>
            <input id="automation-name" placeholder="Escalate overdue client work">
          </label>
          <label>
            <span>Trigger</span>
            <select id="automation-trigger-kind">
              ${automationTriggerOptions.map((option) => `<option value="${option.id}">${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Condition</span>
            <select id="automation-condition-kind">
              ${automationConditionOptions.map((option) => `<option value="${option.id}">${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Condition value</span>
            <input id="automation-condition-value" placeholder="Project, assignee, company, or priority">
          </label>
          <label>
            <span>Action</span>
            <select id="automation-action-kind">
              ${automationActionOptions.map((option) => `<option value="${option.id}">${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Action target</span>
            <input id="automation-action-target" placeholder="High, #delivery, client update, owner">
          </label>
          <label class="checkbox-label automation-enabled-control">
            <input id="automation-enabled" type="checkbox" checked>
            <span>Enabled</span>
          </label>
          <button class="button button-secondary" type="button" id="automation-create">Save Rule</button>
        </div>
        <div class="automation-list">
          ${state.automations.map(renderAutomationCard).join("")}
        </div>
      </section>

      ${renderAutomationMarketplacePanel()}

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Audit</p>
            <h2>Run history</h2>
          </div>
        </div>
        <div class="automation-history-list">
          ${recentHistory.length ? recentHistory.map(renderAutomationHistory).join("") : emptyState(
            "Automations have not run yet.",
            { label: "Run Enabled", commandId: "automations:run" }
          )}
        </div>
      </section>

      ${renderAutomationPackAuthorPanel()}

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

function workspaceGovernanceItems() {
  const roleMap = rolePermissionMap();
  const activeMemberships = state.memberships.filter((membership) => membership.status !== "revoked");
  const admins = activeMemberships.filter((membership) => membership.role === "admin");
  const inviteRoles = workspaceRoles
    .filter((role) => (roleMap[role.id] || []).includes("members:write"))
    .map((role) => role.label);
  const clientMemberships = activeMemberships.filter((membership) => membership.role === "client");
  const scopedClients = clientMemberships.filter((membership) => membership.companyId);
  const pendingInvites = state.invitations.filter((invitation) => invitation.status === "pending");
  const revokedCount = state.memberships.filter((membership) => membership.status === "revoked").length;
  return [
    {
      label: "Workspace owner",
      done: admins.length > 0,
      detail: admins.length ? `${admins.length} admin${admins.length === 1 ? "" : "s"} can own billing, exports, and member access.` : "Add or confirm at least one admin before launch."
    },
    {
      label: "Invite authority",
      done: inviteRoles.length > 0,
      detail: inviteRoles.length ? `${inviteRoles.join(", ")} can invite and manage roles.` : "No role can manage invitations yet."
    },
    {
      label: "Client visibility",
      done: clientMemberships.length === 0 || scopedClients.length === clientMemberships.length,
      detail: clientMemberships.length
        ? `${scopedClients.length}/${clientMemberships.length} client member${clientMemberships.length === 1 ? "" : "s"} scoped to a company.`
        : "Client roles are available and should be company-scoped when invited."
    },
    {
      label: "Open invitations",
      done: pendingInvites.length === 0,
      detail: pendingInvites.length ? `${pendingInvites.length} pending invitation${pendingInvites.length === 1 ? "" : "s"} need follow-up.` : "No pending invitations are waiting."
    },
    {
      label: "Offboarding path",
      done: true,
      detail: revokedCount ? `${revokedCount} revoked membership${revokedCount === 1 ? "" : "s"} retained in the audit trail.` : "Revoke access, keep audit history, and restore from backup if a change was wrong."
    }
  ];
}

function renderWorkspaceGovernancePanel() {
  const items = workspaceGovernanceItems();
  const doneCount = items.filter((item) => item.done).length;
  return `
    <section class="panel workspace-governance-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Workspace governance</p>
          <h2>Ownership and access model</h2>
        </div>
        <span class="status-pill ${doneCount === items.length ? "inbox-green" : "inbox-amber"}">${doneCount}/${items.length}</span>
      </div>
      <p class="panel-note">Before this becomes a team system, Agora needs a crisp answer for who owns the workspace, who can invite people, what clients can see, and how access changes are recovered.</p>
      <div class="readiness-list governance-list">
        ${items.map((item) => `
          <article class="readiness-item ${item.done ? "is-done" : "is-pending"}">
            <span>${item.done ? "OK" : "Next"}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  const roleById = Object.fromEntries(workspaceRoles.map((role) => [role.id, role]));
  const teamMembers = workspaceMembers();
  const ai = aiSettings();
  const payments = paymentSettings();
  const capacity = capacitySettings();
  const pendingInvitations = state.invitations.filter((invitation) => invitation.status === "pending");
  const memberships = teamMembers.map((member) => ({
    ...member,
    membership: state.memberships.find((item) => item.memberId === member.id) || {
      memberId: member.id,
      role: state.workspace.defaultRole,
      status: "active"
    }
  }));
  const activeSettingsTab = settingsTabFallback(state.selectedSettingsTab);
  if (state.selectedSettingsTab !== activeSettingsTab) state.selectedSettingsTab = activeSettingsTab;

  els.appView.innerHTML = `
    ${renderRouteHeader({
      eyebrow: "Settings",
      title: "Set up the workspace for a real team",
      description: "Connect accounts, confirm ownership, tune roles, verify sync, and keep deployment readiness visible.",
      actions: [
        { label: "Open Members", commandId: "settings:members", primary: true },
        { label: "Open Sync", commandId: "settings:sync" }
      ]
    })}

    <div class="metric-grid">
      ${metric("Members", memberships.length)}
      ${metric("Roles", workspaceRoles.length)}
      ${metric("Companies", state.companies.length)}
      ${metric("Storage", apiBackendLabel())}
      ${metric("Theme", state.workspace.theme?.preset === "auto" ? `Auto / ${themePresets.find((theme) => theme.id === resolvedWorkspaceThemePreset())?.label || "Agora"}` : themePresets.find((theme) => theme.id === state.workspace.theme?.preset)?.label || "Agora")}
      ${metric("Payments", paymentProviderLabel(payments.provider))}
    </div>

    ${renderSettingsTabs(activeSettingsTab)}
    ${renderSettingsSectionIntro(activeSettingsTab)}

    <div class="settings-grid settings-section settings-section-${activeSettingsTab}">
      ${activeSettingsTab === "account" ? `
      ${renderApiAccountPanel()}
      ` : ""}

      ${activeSettingsTab === "workspace" ? `
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
          <div class="wide-field theme-picker" role="radiogroup" aria-label="Workspace theme">
            <span>Theme</span>
            <div class="theme-option-grid">
              ${themePresets.map(renderThemeOption).join("")}
            </div>
          </div>
          <label>
            <span>Density</span>
            <select id="workspace-density">
              ${densityOptions.map((option) => `<option value="${option.id}" ${option.id === state.workspace.theme?.density ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Default weekly capacity</span>
            <input id="workspace-capacity-hours" type="number" min="5" max="60" step="1" value="${Math.round(capacity.weeklyMinutes / 60)}">
          </label>
          <label>
            <span>Focus target %</span>
            <input id="workspace-focus-target" type="number" min="40" max="100" step="5" value="${capacity.focusTargetPercent}">
          </label>
          <label>
            <span>Warn at %</span>
            <input id="workspace-capacity-warn" type="number" min="50" max="140" step="5" value="${capacity.warnAtPercent}">
          </label>
          <label>
            <span>Overload at %</span>
            <input id="workspace-capacity-overload" type="number" min="60" max="180" step="5" value="${capacity.overloadAtPercent}">
          </label>
          <button class="button button-primary" type="button" id="workspace-save">Save Settings</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Launch checklist</p>
            <h2>Deploy confidence</h2>
          </div>
          <span class="status-pill ${productionReadinessScore().done === productionReadinessScore().total ? "inbox-green" : "inbox-amber"}">${productionReadinessScore().done}/${productionReadinessScore().total}</span>
        </div>
        ${renderProductionReadinessPanel()}
      </section>
      ` : ""}

      ${activeSettingsTab === "feedback" ? `
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Feedback loop</p>
            <h2>Feature request intake</h2>
          </div>
          <button class="button button-secondary" type="button" id="copy-feature-request-link">Copy Public Link</button>
        </div>
        <div class="settings-form">
          <label>
            <span>Public submit link</span>
            <input value="${escapeHtml(featureRequestPublicLink())}" readonly>
          </label>
          <p class="settings-help">Public submissions save as feature-request tasks through the API. Owner emails use AGORA_FEATURE_REQUEST_EMAIL and the existing SMTP settings.</p>
          <div class="settings-actions">
            <button class="button button-secondary" type="button" data-route="feature-requests">Open Feature Requests</button>
            <button class="button button-primary" type="button" id="feature-request-button-inline">Submit Internal Request</button>
          </div>
        </div>
      </section>
      ` : ""}

      ${activeSettingsTab === "trust" ? `
      ${renderTrustCenterPanel()}
      ` : ""}

      ${activeSettingsTab === "integrations" ? `
      ${renderIntegrationsHubPanel()}

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Bring your own AI</p>
            <h2>Operator provider</h2>
          </div>
          <span class="status-pill inbox-blue">${escapeHtml(aiProviderLabel())}</span>
        </div>
        <div class="settings-form">
          <label>
            <span>Provider</span>
            <select id="ai-provider">
              ${[
                ["local", "Local deterministic"],
                ["openai", "OpenAI-compatible"],
                ["ollama", "Ollama"],
                ["custom", "Custom endpoint"]
              ].map(([value, label]) => `<option value="${value}" ${ai.provider === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Model</span>
            <input id="ai-model" value="${escapeHtml(ai.model)}" placeholder="gpt-4.1-mini, llama3.1, local">
          </label>
          <label>
            <span>Base URL</span>
            <input id="ai-base-url" value="${escapeHtml(ai.baseUrl)}" placeholder="https://api.openai.com/v1 or http://localhost:11434">
          </label>
          <label>
            <span>API key source</span>
            <select id="ai-key-source">
              ${["Server environment", "Self-hosted secret store", "Not required"].map((option) => `<option value="${option}" ${ai.keySource === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Data policy</span>
            <select id="ai-data-policy">
              ${["Workspace only", "Company scoped", "Local summaries only", "No external AI"].map((option) => `<option value="${option}" ${ai.dataPolicy === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Prompt template</span>
            <select id="ai-prompt-template">
              ${["Transparent project operator", "Client delivery PM", "Engineering release PM", "Agency operations"].map((option) => `<option value="${option}" ${ai.promptTemplate === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Audit mode</span>
            <select id="ai-audit-mode">
              ${["Preview, rationale, undo", "Preview only", "Apply with activity log", "Disabled"].map((option) => `<option value="${option}" ${ai.auditMode === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <p class="settings-help">Agora uses the local deterministic operator by default. External providers run through the API server; put keys in .env with AGORA_AI_API_KEY or OPENAI_API_KEY. Browser-saved base URLs are only used when the server enables AGORA_AI_ALLOW_CLIENT_BASE_URL.</p>
          ${renderAiProviderChecklist(ai)}
          <button class="button button-primary" type="button" id="ai-save-settings">Save AI Settings</button>
        </div>
      </section>

      ${renderMobileAppPanel()}
      ` : ""}

      ${activeSettingsTab === "members" ? `
      ${renderWorkspaceGovernancePanel()}

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
                <div class="member-access-controls">
                  <label>
                    <span class="sr-only">Role for ${escapeHtml(member.name)}</span>
                    <select data-member-role="${member.id}" aria-label="Role for ${escapeHtml(member.name)}">
                      ${workspaceRoles.map((option) => `<option value="${option.id}" ${option.id === member.membership.role ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                    </select>
                  </label>
                  <label>
                    <span class="sr-only">Company access for ${escapeHtml(member.name)}</span>
                    <select data-member-company="${member.id}" aria-label="Company access for ${escapeHtml(member.name)}">
                      <option value="" ${member.membership.companyId ? "" : "selected"}>Workspace-wide</option>
                      ${state.companies.map((company) => `<option value="${company.id}" ${company.id === member.membership.companyId ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}
                    </select>
                  </label>
                </div>
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
      ` : ""}

      ${activeSettingsTab === "sync" ? `
      ${renderApiStatePanel()}
      ${renderApiSyncPanel()}
      ` : ""}

      ${activeSettingsTab === "payments" ? `
      ${renderPaymentsSettingsPanel(payments)}
      ` : ""}

      ${activeSettingsTab === "security" ? `
      ${renderCurrentAccessPanel()}
      ${renderPermissionMatrix()}
      ` : ""}

      ${activeSettingsTab === "developer" ? `
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Developer</p>
            <h2>Backend readiness</h2>
          </div>
        </div>
        ${renderBackendChecklist()}
      </section>
      ` : ""}
    </div>
  `;
}

function renderInvitationRow(invitation, roleById) {
  const role = roleById[invitation.role]?.label || invitation.role || "Member";
  const invitedBy = invitation.invitedBy ? memberName(invitation.invitedBy) : "Workspace admin";
  const date = invitation.acceptedAt || invitation.updatedAt || invitation.createdAt || "";
  const company = invitation.companyId ? companyName(invitation.companyId) : "Workspace-wide";
  const pending = invitation.status === "pending";
  const expires = invitation.expiresAt ? `Expires ${formatTimestamp(invitation.expiresAt)}` : "";

  return `
    <article class="invitation-row">
      <div>
        <h3>${escapeHtml(invitation.name || invitation.email)}</h3>
        <p>${escapeHtml(invitation.email)} - ${escapeHtml(role)} - ${escapeHtml(company)} - invited by ${escapeHtml(invitedBy)}</p>
        ${expires ? `<p>${escapeHtml(expires)}</p>` : ""}
        ${invitation.status === "pending" ? `<code>${escapeHtml(invitation.acceptUrl || `#invite/${invitation.token || ""}`)}</code>` : ""}
      </div>
      <div>
        <span class="status-pill ${invitation.status === "accepted" ? "inbox-green" : "inbox-amber"}">${escapeHtml(invitation.status || "pending")}</span>
        <small>${date ? escapeHtml(formatDate(date.slice(0, 10))) : ""}</small>
        ${pending ? `
          <button class="button button-secondary compact-button" type="button" data-invite-resend="${invitation.id}" ${apiSession ? "" : "disabled"}>Resend</button>
          <button class="button button-secondary compact-button" type="button" data-invite-revoke="${invitation.id}" ${apiSession ? "" : "disabled"}>Revoke</button>
        ` : ""}
      </div>
    </article>
  `;
}

async function loadPublicFeatureRequestConfig() {
  if (publicFeatureConfigLoading) return;
  publicFeatureConfigLoading = true;
  try {
    const result = await apiRequest("/api/public/feature-requests");
    publicFeatureConfig = result;
  } catch (error) {
    publicFeatureConfig = { error: error.message, workspace: state.workspace, projects: [] };
  } finally {
    publicFeatureConfigLoading = false;
    if (state.selectedRoute === "feedback") render();
  }
}

function renderPublicFeedbackForm() {
  if (!publicFeatureConfig && !publicFeatureConfigLoading) {
    loadPublicFeatureRequestConfig();
  }
  const projects = publicFeatureConfig?.projects || [];
  const hasProjects = projects.length > 0;
  const disabled = !hasProjects || publicFeatureConfigLoading;
  els.appView.innerHTML = `
    <section class="panel public-feedback-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Product feedback</p>
          <h2>Request a feature for ${escapeHtml(publicFeatureConfig?.workspace?.name || state.workspace.name)}</h2>
        </div>
        <span class="status-pill ${hasProjects ? "inbox-green" : "inbox-amber"}">${publicFeatureConfigLoading ? "Loading" : hasProjects ? "Open" : "API needed"}</span>
      </div>
      <form class="settings-form" id="public-feature-request-form">
        <label class="sr-only" aria-hidden="true">
          <span>Website</span>
          <input id="public-feature-website" tabindex="-1" autocomplete="off">
        </label>
        <label>
          <span>Feature title</span>
          <input id="public-feature-title" required maxlength="120" placeholder="Add client approval reminders" ${disabled ? "disabled" : ""}>
        </label>
        <label>
          <span>Details</span>
          <textarea id="public-feature-details" rows="5" placeholder="What problem would this solve?" ${disabled ? "disabled" : ""}></textarea>
        </label>
        <div class="form-grid">
          <label>
            <span>Project</span>
            <select id="public-feature-project" required ${disabled ? "disabled" : ""}>
              ${projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Impact</span>
            <select id="public-feature-impact" required ${disabled ? "disabled" : ""}>
              <option value="nice-to-have">Nice to have</option>
              <option value="workflow-blocker">Workflow blocker</option>
              <option value="revenue-risk">Revenue risk</option>
              <option value="bug-regression">Bug or regression</option>
            </select>
          </label>
          <label>
            <span>Your name</span>
            <input id="public-feature-requester" maxlength="80" placeholder="Jordan Lee" ${disabled ? "disabled" : ""}>
          </label>
          <label>
            <span>Your email</span>
            <input id="public-feature-email" type="email" maxlength="120" placeholder="jordan@example.com" ${disabled ? "disabled" : ""}>
          </label>
        </div>
        ${publicFeatureConfig?.error ? `<p class="settings-help is-overdue">${escapeHtml(publicFeatureConfig.error)}</p>` : ""}
        <button class="button button-primary" type="submit" ${disabled ? "disabled" : ""}>Send Feature Request</button>
      </form>
    </section>
  `;
}

function trustCenterStats() {
  const backups = loadWorkspaceBackups();
  const aiActions = Array.isArray(state.operatorActions) ? state.operatorActions : [];
  const undoableActions = aiActions.filter((action) => action.undoType && action.status !== "undone");
  return {
    backups: backups.length,
    exports: ["JSON", "CSV", "Markdown"].length,
    aiActions: aiActions.length,
    undoableActions: undoableActions.length,
    auditEvents: (state.auditEvents || []).length + (auditEvents || []).length,
    apiMode: apiSession ? "API connected" : "Local first"
  };
}

function renderTrustCenterPanel() {
  const stats = trustCenterStats();
  const ai = aiSettings();
  const recentActions = recentOperatorActions(8);
  return `
    <section class="panel trust-center-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Trust center</p>
          <h2>Open, portable, auditable</h2>
        </div>
        <span class="status-pill inbox-green">No ads / no lock-in</span>
      </div>
      <div class="trust-grid">
        <article class="trust-card">
          <span>Data portability</span>
          <strong>${stats.exports} export formats</strong>
          <p>Workspace JSON, task CSV, time CSV, Markdown reports, portal share packets, and local backups keep your project history portable.</p>
        </article>
        <article class="trust-card">
          <span>AI transparency</span>
          <strong>${stats.aiActions} actions logged</strong>
          <p>${escapeHtml(ai.auditMode || "Preview, rationale, undo")} with visible rationale, data sources, and undo controls for AI-created work.</p>
        </article>
        <article class="trust-card">
          <span>Privacy posture</span>
          <strong>${escapeHtml(ai.dataPolicy || "Workspace only")}</strong>
          <p>Provider keys stay server-side, local mode needs no external AI, and client/company scopes limit what collaborators can see.</p>
        </article>
        <article class="trust-card">
          <span>Auditability</span>
          <strong>${stats.auditEvents} events</strong>
          <p>${escapeHtml(stats.apiMode)} with local/server audit trails, integration health events, and rollbackable automation runs.</p>
        </article>
      </div>
      <div class="trust-export-row">
        <button class="button button-secondary" type="button" data-route="data">Open Exports</button>
        <button class="button button-secondary" type="button" data-route="audit">Open Audit Log</button>
        <button class="button button-primary" type="button" data-route="operator">Review AI Ledger</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">AI action ledger</p>
          <h2>Recent rationale</h2>
        </div>
        <span class="status-pill inbox-neutral">${stats.undoableActions} undoable</span>
      </div>
      <div class="operator-action-log">
        ${recentActions.length ? recentActions.map(renderOperatorActionLogRow).join("") : emptyState("AI/operator actions will appear here with rationale and undo metadata.")}
      </div>
    </section>
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
  return {
    backups,
    manifest,
    files,
    latestBackup: backups[0] || null,
    score: [
      files.some((file) => file.path === "workspace.json"),
      files.some((file) => file.path === "README.md"),
      files.some((file) => file.path === "audit-log.md"),
      backups.length > 0 || hasExport
    ].filter(Boolean).length
  };
}

function openRecoveryPlanFlow() {
  state.selectedRoute = "data";
  openSidebarGroupForRoute("data");
  saveState();
  render();
  showToast("Recovery plan is ready to review", "success");
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
        <span class="status-pill ${status.score >= 3 ? "inbox-green" : "inbox-amber"}">${status.score}/4 ready</span>
      </div>
      <p class="panel-note">The portable bundle includes workspace JSON, Markdown, CSV, automations, templates, audit history, and operator context. Use the CLI inspect path before imports or handoffs.</p>
      <div class="recovery-confidence-grid">
        <article>
          <span>Bundle files</span>
          <strong>${status.files.length}</strong>
          <small>${counts.projects} projects / ${counts.tasks} tasks</small>
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

function renderDataManagement() {
  const taskCsv = exportTasksCsv();
  const timeCsv = exportTimeCsv();
  const backups = loadWorkspaceBackups();

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

    <div class="metric-grid">
      ${metric("Projects", activeProjects().length)}
      ${metric("Tasks", activeTasks().length)}
      ${metric("Time entries", state.timeEntries.length)}
      ${metric("Backups", backups.length)}
    </div>

    ${renderPortableRecoveryConfidencePanel()}

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
            <p>${apiSession ? `${escapeHtml(realtimeStatusLabel())} - Last saved ${escapeHtml(apiLastSyncedLabel())}` : "Connect from Settings to save or load workspace snapshots through the API."}</p>
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
        <span>Preview first to confirm workspace counts before restoring.</span>
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

function renderSwitcherImportPreview() {
  const preview = normalizeSwitcherImportPreview(state.switcherImportPreview);
  if (!preview) {
    return `
      <div class="switcher-preview-empty">
        <strong>No import preview yet</strong>
        <span>Paste an export and preview it before applying changes.</span>
      </div>
    `;
  }

  const confidenceTone = preview.stats.confidence >= 80 ? "green" : preview.stats.confidence >= 55 ? "amber" : "red";
  return `
    <div class="switcher-preview-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Review</p>
          <h3>${escapeHtml(preview.source)} import preview</h3>
        </div>
        <span class="status-pill inbox-neutral">${escapeHtml(formatTimestamp(preview.createdAt))}</span>
      </div>
      <div class="metric-grid compact-metrics">
        ${metric("Rows read", preview.stats.rows)}
        ${metric("Tasks ready", preview.stats.tasks)}
        ${metric("Projects", preview.stats.projects)}
        ${metric("Skipped", preview.stats.skipped)}
        ${metric("Confidence", `${preview.stats.confidence}%`)}
        ${metric("Traceable", preview.tasks.filter((task) => task.customFields?.sourceId).length)}
      </div>
      ${renderSwitcherImportReport(preview)}
      <div class="switcher-mapping-panel">
        <div>
          <span class="status-pill inbox-${confidenceTone}">${preview.stats.confidence >= 80 ? "Strong mapping" : preview.stats.confidence >= 55 ? "Review mapping" : "Low confidence"}</span>
          <span class="status-pill inbox-neutral">${preview.mode === "new-workspace" ? "New workspace" : "Merge mode"}</span>
        </div>
        <p>Mapped fields: ${preview.mappedFields.length ? preview.mappedFields.map((field) => escapeHtml(field)).join(", ") : "none detected"}</p>
        ${preview.warnings.length ? `
          <div class="switcher-warning-list">
            ${preview.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}
          </div>
        ` : ""}
      </div>
      <div class="switcher-preview-list">
        ${preview.samples.map((sample) => `
          <article>
            <strong>${escapeHtml(sample.title || "Untitled task")}</strong>
            <span>${escapeHtml(sample.projectName || "Imported project")} / ${escapeHtml(sample.assignee || "Unassigned")} / ${escapeHtml(sample.status || "todo")} / ${escapeHtml(sample.priority || "normal")}${sample.sourceId ? ` / ${escapeHtml(sample.sourceId)}` : ""}</span>
          </article>
        `).join("")}
      </div>
      <div class="data-actions import-actions">
        <button class="button button-primary" type="button" id="switcher-apply-preview">Apply Import</button>
        <button class="button button-secondary" type="button" id="switcher-clear-preview">Clear Preview</button>
      </div>
    </div>
  `;
}

function renderSwitcherImportReport(preview) {
  const expectedChange = preview.mode === "new-workspace"
    ? "Creates a separate workspace from the import preview."
    : `Adds ${preview.stats.tasks} tasks and ${preview.stats.projects} new projects to this workspace.`;
  const warningLabel = preview.warnings.length ? `${preview.warnings.length} warnings` : "No warnings";
  return `
    <div class="switcher-report-grid">
      <article>
        <span>Apply mode</span>
        <strong>${preview.mode === "new-workspace" ? "New workspace" : "Merge"}</strong>
        <small>${escapeHtml(expectedChange)}</small>
      </article>
      <article>
        <span>Field coverage</span>
        <strong>${preview.stats.mappedFields} mapped</strong>
        <small>${escapeHtml(preview.mappedFields.join(", ") || "No known fields detected.")}</small>
      </article>
      <article>
        <span>Review load</span>
        <strong>${escapeHtml(warningLabel)}</strong>
        <small>${preview.stats.skipped ? `${preview.stats.skipped} skipped rows need source cleanup.` : "No skipped rows in this preview."}</small>
      </article>
      <article>
        <span>Source trace</span>
        <strong>${preview.tasks.filter((task) => task.customFields?.sourceId).length} tasks</strong>
        <small>${escapeHtml(preview.importBatchId || "Import batch will be created on apply.")}</small>
      </article>
    </div>
  `;
}

function renderSwitcherImportRollback() {
  const rollback = normalizeSwitcherImportRollback(state.switcherImportRollback);
  if (!rollback) return "";

  return `
    <div class="switcher-rollback-panel">
      <div>
        <strong>Last import recovery</strong>
        <span>${escapeHtml(rollback.summary)} ${escapeHtml(formatTimestamp(rollback.createdAt))}</span>
        <small>${rollback.stats.tasks} ${rollback.stats.tasks === 1 ? "task" : "tasks"} and ${rollback.stats.projects} ${rollback.stats.projects === 1 ? "project" : "projects"} can be rolled back.</small>
      </div>
      <button class="button button-secondary" type="button" id="switcher-rollback-import">Rollback Last Import</button>
    </div>
  `;
}

function renderAuditLog() {
  const localEvents = Array.isArray(state.auditEvents) ? state.auditEvents : [];
  const serverEvents = Array.isArray(auditEvents) ? auditEvents : [];
  const events = mergeRecordsById(localEvents, serverEvents)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 100);
  const actions = Array.from(new Set(events.map((event) => event.action).filter(Boolean))).slice(0, 12);
  const highImpact = events.filter((event) => auditImpactLevel(event) === "high");
  const irreversible = events.filter((event) => event.reversible === false);

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Events", events.length)}
      ${metric("Actors", new Set(events.map((event) => event.actorId).filter(Boolean)).size)}
      ${metric("Actions", actions.length)}
      ${metric("High impact", highImpact.length)}
      ${metric("Irreversible", irreversible.length)}
      ${metric("Local", localEvents.length)}
      ${metric("Server", serverEvents.length)}
      ${metric("Status", auditLoading ? "Loading" : apiSession ? "Connected" : "Offline")}
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>Audit trail</h2>
        </div>
        <button class="button button-secondary" type="button" id="audit-refresh" ${apiSession ? "" : "disabled"}>${auditLoading ? "Refreshing" : "Refresh"}</button>
      </div>
      <div class="audit-toolbar">
        ${actions.length ? actions.map((action) => `<span class="status-pill inbox-neutral">${escapeHtml(action)}</span>`).join("") : `<span class="status-pill inbox-neutral">No audit events yet</span>`}
      </div>
      <div class="audit-risk-grid">
        <article>
          <strong>${highImpact.length}</strong>
          <span>High-impact events</span>
          <small>Archives, restores, API imports, payment settings, and admin-level changes should leave a visible trail.</small>
        </article>
        <article>
          <strong>${irreversible.length}</strong>
          <span>Needs backup restore</span>
          <small>Events marked permanent explain the restore path instead of pretending undo exists everywhere.</small>
        </article>
        <article>
          <strong>${new Set(events.map((event) => event.targetType || "workspace")).size}</strong>
          <span>Target types</span>
          <small>Events are grouped by workspace, project, task, approval, automation, integration, and payment surfaces.</small>
        </article>
      </div>
      <div class="audit-list">
        ${events.length ? events.map(renderAuditEvent).join("") : emptyState(apiSession ? "Refresh to load API audit events." : "Make a local change to start the audit trail.")}
      </div>
    </section>
  `;
}

function auditImpactLevel(event) {
  if (["low", "medium", "high"].includes(event?.impact)) return event.impact;
  const action = String(event?.action || "").toLowerCase();
  if (action.includes("archive") || action.includes("restore") || action.includes("payment") || action.includes("api")) return "high";
  if (action.includes("approval") || action.includes("automation") || action.includes("workspace")) return "medium";
  return "low";
}

function auditImpactTone(event) {
  const impact = auditImpactLevel(event);
  if (impact === "high") return "red";
  if (impact === "medium") return "amber";
  return "green";
}

function renderAuditEvent(event) {
  const target = [event.targetType, event.targetId].filter(Boolean).join(":") || "workspace";
  const restoreHint = event.restoreHint || (event.reversible === false ? "Restore from backup if needed." : "Tracked as a reversible workspace change.");
  return `
    <article class="audit-event audit-impact-${auditImpactLevel(event)}">
      <div>
        <div class="audit-event-kicker">
          <span class="status-pill inbox-blue">${escapeHtml(event.action || "event")}</span>
          <span class="status-pill inbox-${auditImpactTone(event)}">${escapeHtml(auditImpactLevel(event))} impact</span>
          <span class="status-pill ${event.reversible === false ? "inbox-amber" : "inbox-green"}">${event.reversible === false ? "backup restore" : "reversible"}</span>
        </div>
        <h3>${escapeHtml(event.detail || "Workspace event")}</h3>
        <p>${escapeHtml(memberName(event.actorId) || event.actorId || "System")} - ${escapeHtml(formatTimestamp(event.createdAt))} - ${escapeHtml(event.source || "server")}</p>
        <small>${escapeHtml(target)} - ${escapeHtml(restoreHint)}</small>
      </div>
      <code>${escapeHtml(event.id || "")}</code>
    </article>
  `;
}

function permissionCatalog() {
  return [
    ["workspace:read", "Read workspace"],
    ["workspace:write", "Edit workspace"],
    ["workspace:import", "Import workspace"],
    ["audit:read", "Read audit log"],
    ["members:write", "Manage members"],
    ["projects:write", "Manage projects"],
    ["tasks:write", "Manage tasks"],
    ["time:write", "Log time"],
    ["comments:write", "Comment"],
    ["activity:write", "Activity"],
    ["attachments:write", "Docs and files"],
    ["approvals:write", "Approvals"],
    ["notifications:write", "Notifications"],
    ["integrations:write", "Integrations"],
    ["scheduler:run", "Run scheduler"],
    ["payments:write", "Payments"]
  ];
}

function rolePermissionMap() {
  return {
    admin: ["workspace:read", "workspace:write", "workspace:import", "audit:read", "members:write", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write"],
    manager: ["workspace:read", "workspace:write", "audit:read", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write"],
    member: ["workspace:read", "time:write", "comments:write", "activity:write", "attachments:write"],
    client: ["workspace:read", "comments:write", "activity:write", "approvals:write"]
  };
}

function permissionsAuditRows() {
  const memberships = Array.isArray(state.memberships) ? state.memberships : [];
  return workspaceMembers().map((member) => {
    const membership = memberships.find((item) => item.memberId === member.id) || {};
    const roleId = membership.role || member.role || state.workspace.defaultRole || "member";
    const role = workspaceRoles.find((item) => item.id === roleId);
    const companyIds = Array.isArray(membership.companyIds) ? membership.companyIds : membership.companyId ? [membership.companyId] : [];
    return {
      member,
      roleId,
      roleLabel: role?.label || roleId,
      companyScope: companyIds.length ? companyIds.map(companyName).join(", ") : "Workspace-wide",
      permissions: rolePermissionMap()[roleId] || []
    };
  });
}

function permissionRiskFlags(rows = permissionsAuditRows()) {
  const permissions = operatorPermissions();
  const ai = aiSettings();
  return [
    {
      label: "Admins",
      value: rows.filter((row) => row.roleId === "admin").length,
      tone: rows.filter((row) => row.roleId === "admin").length > 1 ? "amber" : "green",
      detail: "Keep admin count intentionally small before production."
    },
    {
      label: "Workspace imports",
      value: rows.filter((row) => row.permissions.includes("workspace:import")).length,
      tone: rows.filter((row) => row.permissions.includes("workspace:import")).length > 1 ? "amber" : "green",
      detail: "Import permission can replace the API source of truth."
    },
    {
      label: "Operator client data",
      value: permissions.readClientData ? "Allowed" : "Blocked",
      tone: permissions.readClientData ? "amber" : "green",
      detail: "Client context should be intentional for BYO AI providers."
    },
    {
      label: "AI provider",
      value: aiProviderLabel(),
      tone: ai.provider === "local" ? "green" : "amber",
      detail: ai.provider === "local" ? "Local deterministic operator only." : `${aiProviderLabel()} runs through the API server.`
    }
  ];
}

function renderPermissionsAudit() {
  const rows = permissionsAuditRows();
  const roleMap = rolePermissionMap();
  const operatorAllowed = aiPermissionOptions.filter((option) => operatorPermissions()[option.id]);
  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Members", rows.length)}
      ${metric("Admins", rows.filter((row) => row.roleId === "admin").length)}
      ${metric("Roles", workspaceRoles.length)}
      ${metric("Operator", operatorPermissionSummary())}
      ${metric("API mode", apiSession ? "Connected" : "Local")}
    </div>

    <section class="panel permissions-audit-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>Role and Operator audit</h2>
        </div>
        <button class="button button-secondary" type="button" data-route="settings">Open Settings</button>
      </div>
      <div class="permissions-risk-grid">
        ${permissionRiskFlags(rows).map((flag) => `
          <article>
            <span class="status-pill inbox-${flag.tone}">${escapeHtml(flag.label)}</span>
            <strong>${escapeHtml(flag.value)}</strong>
            <small>${escapeHtml(flag.detail)}</small>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="panel permissions-audit-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Access matrix</p>
          <h2>Workspace roles</h2>
        </div>
        <span class="status-pill inbox-neutral">${permissionCatalog().length} permissions</span>
      </div>
      <div class="permission-matrix permissions-audit-matrix" role="table" aria-label="Workspace role permissions">
        <div class="permission-row permission-head" role="row">
          <span role="columnheader">Permission</span>
          ${workspaceRoles.map((role) => `<strong role="columnheader">${escapeHtml(role.label)}</strong>`).join("")}
        </div>
        ${permissionCatalog().map(([permission, label]) => `
          <div class="permission-row" role="row">
            <span role="rowheader">${escapeHtml(label)}</span>
            ${workspaceRoles.map((role) => `<span class="${roleMap[role.id]?.includes(permission) ? "is-allowed" : "is-denied"}">${roleMap[role.id]?.includes(permission) ? "Yes" : "No"}</span>`).join("")}
          </div>
        `).join("")}
      </div>
    </section>

    <section class="panel permissions-audit-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Members</p>
          <h2>Scope review</h2>
        </div>
        <span class="status-pill inbox-blue">${rows.filter((row) => row.companyScope !== "Workspace-wide").length} scoped</span>
      </div>
      <div class="permissions-member-list">
        ${rows.map((row) => `
          <article>
            <div>
              <strong>${escapeHtml(row.member.name)}</strong>
              <span>${escapeHtml(row.member.email || row.member.role || "Team member")}</span>
            </div>
            <span class="status-pill inbox-neutral">${escapeHtml(row.roleLabel)}</span>
            <span>${escapeHtml(row.companyScope)}</span>
            <small>${row.permissions.length} permissions</small>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="panel permissions-audit-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Operator guardrails</p>
          <h2>AI permissions</h2>
        </div>
        <span class="status-pill ${operatorAllowed.length === aiPermissionOptions.length ? "inbox-amber" : "inbox-green"}">${operatorAllowed.length}/${aiPermissionOptions.length} allowed</span>
      </div>
      <div class="operator-permission-grid">
        ${aiPermissionOptions.map((option) => {
          const allowed = operatorPermissions()[option.id];
          return `
            <article class="${allowed ? "is-allowed" : "is-denied"}">
              <span>${allowed ? "Allowed" : "Blocked"}</span>
              <strong>${escapeHtml(option.label)}</strong>
              <small>${escapeHtml(option.description)}</small>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderBackendChecklist() {
  const records = Array.isArray(backendHealth?.records) ? backendHealth.records : [];
  const checkedAt = backendHealth?.generatedAt || apiSession?.lastBackendCheckedAt || "";
  return `
    <div class="backend-health-summary">
      <article>
        <span>Storage</span>
        <strong>${escapeHtml(backendHealth?.storage || apiSession?.storageDriver || state.workspace.storageMode)}</strong>
      </article>
      <article>
        <span>Auth</span>
        <strong>${escapeHtml(backendHealth?.auth || apiSession?.apiHealth?.auth || "local")}</strong>
      </article>
      <article>
        <span>Production</span>
        <strong>${backendHealth?.productionMode ? "Ready" : "Not yet"}</strong>
      </article>
      <article>
        <span>Last check</span>
        <strong>${checkedAt ? escapeHtml(formatTimestamp(checkedAt)) : "Never"}</strong>
      </article>
    </div>
    <div class="backend-actions">
      <button class="button button-secondary compact-button" type="button" id="backend-health-refresh" ${apiSession ? "" : "disabled"}>Refresh Health</button>
      <button class="button button-secondary compact-button" type="button" id="api-sync-retry" ${apiSession && apiSyncQueue.length ? "" : "disabled"}>Retry Failed Syncs</button>
    </div>
    ${renderBackendObservabilityPanel()}
    <div class="backend-checklist">
      ${backendReadinessItems().map((item) => `
        <article class="backend-item ${item.done ? "is-done" : "is-pending"}">
          <span>${item.done ? "OK" : "!"}</span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.detail || "")}</p>
            ${item.fix && !item.done ? `<small>${escapeHtml(item.fix)}</small>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
    <div class="backend-launch-block">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Production path</p>
          <h3>Launch readiness</h3>
        </div>
        <span class="status-pill ${productionReadinessScore().done === productionReadinessScore().total ? "inbox-green" : "inbox-amber"}">${productionReadinessScore().done}/${productionReadinessScore().total}</span>
      </div>
      ${renderProductionReadinessPanel()}
      ${renderHostedLaunchRunbookPanel()}
    </div>
    ${records.length ? `
      <div class="backend-record-list">
        ${records.map((record) => `
          <article class="${record.status === "ready" ? "is-ready" : "is-pending"}">
            <strong>${escapeHtml(record.key)}</strong>
            <span>${escapeHtml(record.status)} / ${Number(record.count || 0)}</span>
          </article>
        `).join("")}
      </div>
    ` : ""}
    ${apiSyncQueue.length ? `
      <div class="sync-queue-list">
        ${apiSyncQueue.slice(0, 5).map(renderApiSyncQueueItem).join("")}
      </div>
    ` : ""}
  `;
}

function renderBackendObservabilityPanel() {
  const metrics = backendHealth?.observability || {};
  const jobs = backendHealth?.jobs || {};
  const routes = Array.isArray(metrics.routes) ? metrics.routes.slice(0, 6) : [];
  const recentJobs = Array.isArray(jobs.recent) ? jobs.recent.slice(0, 8) : [];
  return `
    <div class="backend-health-summary">
      <article>
        <span>Requests</span>
        <strong>${Number(metrics.total || 0)}</strong>
      </article>
      <article>
        <span>Server errors</span>
        <strong>${Number(metrics.errors || 0)}</strong>
      </article>
      <article>
        <span>Avg latency</span>
        <strong>${Number(metrics.avgDurationMs || 0)}ms</strong>
      </article>
      <article>
        <span>Jobs queued</span>
        <strong>${Number(jobs.queued || 0)}</strong>
      </article>
    </div>
    ${routes.length ? `
      <div class="backend-record-list">
        ${routes.map((route) => `
          <article class="${route.errors ? "is-pending" : "is-ready"}">
            <strong>${escapeHtml(route.route)}</strong>
            <span>${Number(route.count || 0)} req / ${Number(route.avgDurationMs || 0)}ms avg</span>
          </article>
        `).join("")}
      </div>
    ` : ""}
    <div class="backend-job-console">
      <div class="panel-header compact-panel-header">
        <div>
          <p class="eyebrow">Worker jobs</p>
          <h3>Background queue</h3>
        </div>
        <span class="status-pill ${Number(jobs.queued || 0) ? "inbox-amber" : "inbox-green"}">${Number(jobs.queued || 0)}/${Number(jobs.maxQueue || 0)} queued</span>
      </div>
      ${recentJobs.length ? `
        <div class="backend-job-list">
          ${recentJobs.map(renderBackendJobRow).join("")}
        </div>
      ` : `<p class="empty-state">No background jobs yet.</p>`}
    </div>
  `;
}

function renderBackendJobRow(job = {}) {
  const status = job.status || "queued";
  const canManageJobs = Boolean(apiSession && canWrite("scheduler:run") && job.id);
  const retryable = canManageJobs && ["failed", "rejected", "canceled"].includes(status);
  const cancelable = canManageJobs && status === "queued";
  const clearable = canManageJobs && ["succeeded", "failed", "rejected", "canceled"].includes(status);
  const tone = status === "succeeded"
    ? "inbox-green"
    : status === "queued" || status === "running"
      ? "inbox-amber"
      : "inbox-red";
  const metadata = job.metadata || {};
  const detail = [
    metadata.taskId ? `Task ${metadata.taskId}` : "",
    job.nextRunAt ? `Next ${formatTimestamp(job.nextRunAt)}` : "",
    job.error ? job.error : ""
  ].filter(Boolean).join(" / ");
  return `
    <article class="backend-job-row">
      <div>
        <span class="status-pill ${tone}">${escapeHtml(status)}</span>
        <strong>${escapeHtml(job.type || "background-job")}</strong>
        <p>${escapeHtml(detail || `Updated ${formatTimestamp(job.updatedAt || job.createdAt || new Date().toISOString())}`)}</p>
      </div>
      <div class="backend-job-meta">
        <span>${Number(job.attempts || 0)}/${Number(job.maxAttempts || 3)} tries</span>
        <span>${job.updatedAt ? escapeHtml(formatTimestamp(job.updatedAt)) : "Not run"}</span>
      </div>
      <div class="backend-job-actions">
        <button class="button button-secondary compact-button" type="button" data-backend-job-action="retry" data-backend-job-id="${escapeHtml(job.id || "")}" ${retryable ? "" : "disabled"}>Retry</button>
        <button class="button button-secondary compact-button" type="button" data-backend-job-action="cancel" data-backend-job-id="${escapeHtml(job.id || "")}" ${cancelable ? "" : "disabled"}>Cancel</button>
        <button class="button button-secondary button-danger compact-button" type="button" data-backend-job-action="clear" data-backend-job-id="${escapeHtml(job.id || "")}" ${clearable ? "" : "disabled"}>Clear</button>
      </div>
    </article>
  `;
}

function renderAutomationCard(automation) {
  const preview = automationPreview(automation);
  return `
    <article class="automation-card ${automation.enabled ? "is-enabled" : "is-disabled"}">
      <div>
        <span class="status-pill ${automation.enabled ? "inbox-green" : "inbox-neutral"}">${automation.enabled ? "enabled" : "paused"}</span>
        <h3>${escapeHtml(automation.name)}</h3>
        <p><strong>When:</strong> ${escapeHtml(automation.trigger)}${automation.conditionKind !== "any" ? ` / ${escapeHtml(automationConditionOptions.find((option) => option.id === automation.conditionKind)?.label || "Condition")}: ${escapeHtml(automation.conditionValue || "not set")}` : ""}</p>
        <p><strong>Then:</strong> ${escapeHtml(automation.action)}${automation.actionTarget ? ` / ${escapeHtml(automation.actionTarget)}` : ""}</p>
        ${automation.source === "marketplace" ? `<p class="automation-source">Pack: ${escapeHtml(automation.creatorName || "Community")} / ${escapeHtml(automation.license || "Open workflow")}</p>` : ""}
        <div class="automation-preview">
          <span>${escapeHtml(preview.label)}</span>
          <strong>${escapeHtml(preview.value)}</strong>
          <small>${escapeHtml(preview.detail)}</small>
        </div>
        <div class="meta-row">
          <span>${automation.runCount || 0} runs</span>
          <span>${automation.lastRun ? formatTimestamp(automation.lastRun) : "Never run"}</span>
        </div>
      </div>
      <div class="automation-actions">
        <button class="button button-secondary" type="button" data-edit-automation="${automation.id}">Edit</button>
        <button class="button button-secondary" type="button" data-toggle-automation="${automation.id}">${automation.enabled ? "Pause" : "Enable"}</button>
        <button class="button button-primary" type="button" data-run-automation="${automation.id}" ${automation.enabled ? "" : "disabled"}>Run</button>
        <button class="button button-secondary button-danger" type="button" data-delete-automation="${automation.id}">Delete</button>
      </div>
    </article>
  `;
}

function automationPreview(automation) {
  const rule = normalizeAutomationRule(automation);
  if (rule.triggerKind === "intake_high") {
    const highSubmissions = getVisibleIntakeSubmissions().filter((submission) => submission.urgency === "High" || submission.urgency === "Urgent");
    return {
      label: "Preview",
      value: `${highSubmissions.length} intake ${highSubmissions.length === 1 ? "item" : "items"}`,
      detail: `Would ${automationActionLabel(rule.actionKind).toLowerCase()}${rule.actionTarget ? `: ${rule.actionTarget}` : ""}.`
    };
  }
  if (rule.triggerKind === "task_blocked") {
    const blocked = matchingAutomationTasks(rule).filter(isTaskBlocked);
    return {
      label: "Preview",
      value: `${blocked.length} blocked`,
      detail: `Would ${automationActionLabel(rule.actionKind).toLowerCase()} for matching blocked work.`
    };
  }
  if (rule.triggerKind === "task_due_soon") {
    const due = dueSoonTasks(matchingAutomationTasks(rule));
    return {
      label: "Preview",
      value: `${due.length} due soon`,
      detail: `Would ${automationActionLabel(rule.actionKind).toLowerCase()} for due-soon work.`
    };
  }
  if (rule.triggerKind === "milestone_due") {
    const milestones = state.milestones.filter((milestone) => milestone.status !== "completed" && daysBetween(todayKey(), milestone.dueDate) <= 14);
    return {
      label: "Preview",
      value: `${milestones.length} milestones`,
      detail: "Would watch upcoming milestones and create project activity."
    };
  }
  if (rule.triggerKind === "approval_pending") {
    const approvals = state.approvals.filter((approval) => approval.status !== "approved");
    return {
      label: "Preview",
      value: `${approvals.length} approvals`,
      detail: `Would ${automationActionLabel(rule.actionKind).toLowerCase()} for pending approvals.`
    };
  }
  return {
    label: "Preview",
    value: rule.enabled ? "Ready" : "Draft",
    detail: "Run this rule manually to record its impact in history."
  };
}

function renderAutomationHistory(run) {
  const automation = byId(state.automations, run.automationId);
  const canRollback = run.rollbackAvailable && run.status !== "rolled-back";
  return `
    <article class="automation-history-item">
      <div>
        <strong>${escapeHtml(automation?.name || "Automation")}</strong>
        <span>${formatTimestamp(run.createdAt)}${run.status === "rolled-back" ? " / rolled back" : ""}</span>
      </div>
      <div>
        <span>${run.changedCount} ${run.changedCount === 1 ? "change" : "changes"}</span>
        ${canRollback ? `<button class="button button-secondary compact-button" type="button" data-automation-rollback="${run.id}">Rollback</button>` : ""}
      </div>
    </article>
  `;
}

function renderDocsAndFiles() {
  const documents = getVisibleDocuments();
  const files = getVisibleFiles();
  const projectIdsWithAssets = new Set([...documents.map((document) => document.projectId), ...files.map((file) => file.projectId)]);

  els.appView.innerHTML = `
    <div class="metric-grid">
      ${metric("Documents", documents.length)}
      ${metric("Files", files.length)}
      ${metric("Projects", projectIdsWithAssets.size)}
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
          <label class="wide-field">
            <span>Upload</span>
            <input id="file-upload" type="file">
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
          ${file.storageProvider ? `<span>${escapeHtml(file.storageProvider)}</span>` : ""}
        </div>
      </div>
      ${file.url ? `<button class="button button-secondary compact-button" type="button" data-file-download="${file.id}">Download</button>` : ""}
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
  const liveViewers = livePresenceRecords({ taskId: task.id }).length;
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
        ${liveViewers ? `<span class="live-task-chip">Live ${liveViewers}</span>` : ""}
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
  const liveViewers = livePresenceRecords({ taskId: task.id }).length;
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
      <td class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}${liveViewers ? `<br><span class="live-task-chip">Live ${liveViewers}</span>` : ""}</td>
      <td><button class="button button-secondary button-danger compact-button" type="button" data-archive-task="${task.id}">Archive</button></td>
    </tr>
  `;
}

function featureRequestTasks() {
  const order = new Map(featureRequestStatuses.map((status, index) => [status.id, index]));
  return activeTasks()
    .filter(isFeatureRequestTask)
    .sort((a, b) => {
      const statusSort = (order.get(featureRequestStatus(a)) ?? 0) - (order.get(featureRequestStatus(b)) ?? 0);
      if (statusSort !== 0) return statusSort;
      return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
    });
}

function featureRequestFilteredTasks() {
  const filters = state.featureRequestFilters || {};
  return featureRequestTasks()
    .filter((task) => !filters.status || filters.status === "all" || featureRequestStatus(task) === filters.status)
    .filter((task) => !filters.source || filters.source === "all" || featureRequestSource(task) === filters.source)
    .filter((task) => !filters.impact || filters.impact === "all" || task.customFields?.impact === filters.impact);
}

function featureRequestSource(task) {
  return task?.customFields?.source || (task?.tags?.includes("public") ? "public" : "in-app");
}

function featureRequestSourceLabel(source) {
  return source === "public" ? "Public form" : source === "api" ? "API" : "In-app";
}

function featureRequestAgeDays(task) {
  const created = Date.parse(task.createdAt || task.updatedAt || "");
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

function featureRequestNeedsTriage(task) {
  return featureRequestStatus(task) === "new" && featureRequestAgeDays(task) >= 2;
}

function featureRequestLifecycleSummary(task) {
  const status = featureRequestStatus(task);
  if (status === "shipped") return "Requester can be told what changed.";
  if (status === "declined") return "Requester should get a short reason.";
  if (status === "planned") return "Ready for roadmap or sprint planning.";
  if (status === "triaged") return "Impact understood; waiting on prioritization.";
  return featureRequestNeedsTriage(task) ? "Needs triage; older than 2 days." : "New request waiting for first review.";
}

function featureRequestSuggestedUpdate(status) {
  return {
    new: "Thanks, we received this and will review it shortly.",
    triaged: "We reviewed this and are evaluating priority and fit.",
    planned: "This is planned; we will share timing when it is scheduled.",
    shipped: "This has shipped. Here is what changed...",
    declined: "We are not moving forward right now because..."
  }[status] || "Short update to email the requester";
}

function featureRequestPublicLink() {
  return `${window.location.origin}${window.location.pathname}#feedback`;
}

function renderFeatureRequests() {
  const requests = featureRequestTasks();
  const visibleRequests = featureRequestFilteredTasks();
  const counts = featureRequestStatuses.map((status) => ({
    ...status,
    count: requests.filter((task) => featureRequestStatus(task) === status.id).length
  }));
  const publicCount = requests.filter((task) => featureRequestSource(task) === "public").length;
  const staleNewCount = requests.filter(featureRequestNeedsTriage).length;
  const requesterUpdates = requests.filter((task) => task.customFields?.lastRequesterUpdateAt).length;

  els.appView.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Feedback triage</p>
          <h2>${requests.length} feature ${requests.length === 1 ? "request" : "requests"}</h2>
        </div>
        <div class="portal-actions">
          <button class="button button-secondary" type="button" id="copy-feature-request-link">Copy Public Link</button>
          <button class="button button-primary" type="button" id="feature-request-button-inline">New Request</button>
        </div>
      </div>
      <div class="metric-grid">
        ${counts.map((status) => metric(status.label, status.count)).join("")}
      </div>
      <div class="feature-request-insights">
        <article>
          <span>Public source</span>
          <strong>${publicCount}</strong>
          <small>${requests.length ? Math.round((publicCount / requests.length) * 100) : 0}% of request intake</small>
        </article>
        <article class="${staleNewCount ? "is-hot" : ""}">
          <span>Triage SLA</span>
          <strong>${staleNewCount}</strong>
          <small>${staleNewCount ? "new requests older than 2 days" : "all new requests are fresh"}</small>
        </article>
        <article>
          <span>Requester updates</span>
          <strong>${requesterUpdates}</strong>
          <small>${requests.length ? `${Math.round((requesterUpdates / requests.length) * 100)}% have updates` : "no requests yet"}</small>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Pipeline</p>
          <h2>Request queue</h2>
        </div>
        <span class="status-pill inbox-blue">${escapeHtml(featureRequestPublicLink())}</span>
      </div>
      <div class="feature-request-filterbar">
        <label>
          <span>Status</span>
          <select data-feature-filter="status">
            <option value="all">All statuses</option>
            ${featureRequestStatuses.map((status) => `<option value="${status.id}" ${state.featureRequestFilters?.status === status.id ? "selected" : ""}>${escapeHtml(status.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select data-feature-filter="source">
            <option value="all">All sources</option>
            <option value="public" ${state.featureRequestFilters?.source === "public" ? "selected" : ""}>Public form</option>
            <option value="in-app" ${state.featureRequestFilters?.source === "in-app" ? "selected" : ""}>In-app</option>
          </select>
        </label>
        <label>
          <span>Impact</span>
          <select data-feature-filter="impact">
            <option value="all">All impact</option>
            ${["Nice to have", "Workflow blocker", "Revenue risk", "Bug or regression"].map((impact) => `<option value="${impact}" ${state.featureRequestFilters?.impact === impact ? "selected" : ""}>${escapeHtml(impact)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="feature-request-list">
        ${visibleRequests.length ? visibleRequests.map(renderFeatureRequestRow).join("") : emptyState(requests.length ? "No requests match these filters." : "No feature requests yet.", { label: requests.length ? "Clear Filters" : "Open Request Form", commandId: requests.length ? "feature:clear-filters" : "create:feature-request" })}
      </div>
    </section>
  `;
}

function renderFeatureRequestRow(task) {
  const requester = task.customFields?.requester || "Unknown";
  const requesterEmail = task.customFields?.requesterEmail || "";
  const impact = task.customFields?.impact || "Nice to have";
  const status = featureRequestStatus(task);
  const lastUpdate = task.customFields?.lastRequesterUpdateAt || "";
  const source = featureRequestSource(task);
  const age = featureRequestAgeDays(task);
  const needsTriage = featureRequestNeedsTriage(task);
  return `
    <article class="feature-request-row ${needsTriage ? "needs-triage" : ""}">
      <div>
        <div class="feature-request-chip-row">
          <span class="status-pill inbox-neutral">${escapeHtml(impact)}</span>
          <span class="status-pill ${source === "public" ? "inbox-blue" : "inbox-neutral"}">${escapeHtml(featureRequestSourceLabel(source))}</span>
          <span class="status-pill ${needsTriage ? "inbox-amber" : "inbox-green"}">${age ? `${age}d old` : "today"}</span>
        </div>
        <h3>${escapeHtml(task.title.replace(/^Feature request:\s*/i, ""))}</h3>
        <p>${escapeHtml(task.description.split("\n").slice(-1)[0] || task.description)}</p>
        <small>${escapeHtml(projectName(task.projectId))} - ${escapeHtml(requester)}${requesterEmail ? ` - ${escapeHtml(requesterEmail)}` : ""}</small>
        <small>${escapeHtml(featureRequestLifecycleSummary(task))}</small>
        ${lastUpdate ? `<small>Last requester update ${escapeHtml(formatTimestamp(lastUpdate))}</small>` : ""}
      </div>
      <div class="feature-request-controls">
        <label>
          <span>Pipeline</span>
          <select data-feature-status-task="${escapeHtml(task.id)}">
            ${featureRequestStatuses.map((option) => `<option value="${option.id}" ${option.id === status ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Requester update</span>
          <textarea rows="2" data-feature-update-note="${escapeHtml(task.id)}" placeholder="${escapeHtml(featureRequestSuggestedUpdate(status))}"></textarea>
        </label>
        <div class="feature-request-actions">
          <button class="button button-secondary compact-button" type="button" data-edit-task="${escapeHtml(task.id)}">Open Task</button>
          <button class="button button-primary compact-button" type="button" data-feature-email-update="${escapeHtml(task.id)}" ${requesterEmail ? "" : "disabled"}>Email Update</button>
        </div>
      </div>
    </article>
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

function emptyState(message, action = null) {
  return `
    <div class="empty-state">
      <span>${escapeHtml(message)}</span>
      ${action ? `
        <div class="empty-state-actions">
          <button
            class="button button-secondary compact-button"
            type="button"
            ${action.commandId ? `data-command-id="${escapeHtml(action.commandId)}"` : ""}
            ${action.route ? `data-route="${escapeHtml(action.route)}"` : ""}
            ${action.id ? `id="${escapeHtml(action.id)}"` : ""}
            ${action.disabled ? "disabled" : ""}
          >${escapeHtml(action.label)}</button>
        </div>
      ` : ""}
    </div>
  `;
}

function populateTaskForm(task = null) {
  document.querySelector("#task-id").value = task?.id || "";
  document.querySelector("#task-edit-warning").hidden = true;
  document.querySelector("#task-edit-warning").innerHTML = "";
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
  if (task?.id) {
    taskEditSnapshots.set(task.id, taskRevision(task));
    staleTaskOverrideId = "";
    heartbeatPresence({ force: true, taskId: task.id });
  } else {
    heartbeatPresence({ force: true });
  }
  renderTaskCollaboration(task?.id || "");
  renderTaskSubtasks();
  renderTaskDependencies(task);
  renderTaskCustomFields(task);
  renderTaskTimeTracking(task?.id || "");
}

function openFeatureRequestDialog() {
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot submit feature requests", "info");
    return;
  }
  if (!activeProjects().length) {
    showToast("Create a project before sending feature requests", "info");
    return;
  }
  populateFeatureRequestForm();
  openDialog(els.featureRequestDialog);
}

function populateFeatureRequestForm() {
  const projectOptions = activeProjects();
  const selectedProject = projectOptions.some((project) => project.id === state.selectedProject)
    ? state.selectedProject
    : projectOptions[0]?.id;
  fillSelect("#feature-request-project", projectOptions, selectedProject, "name");
  document.querySelector("#feature-request-title-input").value = "";
  document.querySelector("#feature-request-details").value = "";
  document.querySelector("#feature-request-impact").value = "nice-to-have";
  document.querySelector("#feature-request-requester").value = apiSession?.user?.name || memberName(activeMemberId());
  document.querySelector("#feature-request-email").value = apiSession?.user?.email || "";
}

function featureRequestPriority(impact) {
  if (impact === "workflow-blocker" || impact === "bug-regression") return "urgent";
  if (impact === "revenue-risk") return "high";
  return "normal";
}

function isFeatureRequestTask(task) {
  return task?.customFields?.requestType === "feature-request" || task?.tags?.includes("feature-request");
}

function featureRequestStatus(task) {
  const status = task?.customFields?.featureStatus === "reviewing" ? "triaged" : task?.customFields?.featureStatus || "new";
  return featureRequestStatuses.some((item) => item.id === status) ? status : "new";
}

function featureRequestStatusLabel(status) {
  return featureRequestStatuses.find((item) => item.id === status)?.label || "New";
}

function featureRequestImpactLabel(impact) {
  return {
    "nice-to-have": "Nice to have",
    "workflow-blocker": "Workflow blocker",
    "revenue-risk": "Revenue risk",
    "bug-regression": "Bug or regression"
  }[impact] || "Nice to have";
}

function featureRequestDescription({ requester, email, impact, details }) {
  return [
    `Requester: ${requester || "Unknown"}`,
    `Email: ${email || "Not provided"}`,
    `Impact: ${featureRequestImpactLabel(impact)}`,
    "",
    details || "No additional details provided."
  ].join("\n");
}

function createFeatureRequestTask(payload) {
  const now = new Date().toISOString();
  const task = normalizeTaskRecord({
    id: uid("task"),
    projectId: payload.projectId,
    title: `Feature request: ${payload.title}`,
    description: featureRequestDescription(payload),
    assignee: activeMemberId(),
    status: "todo",
    priority: featureRequestPriority(payload.impact),
    startDate: todayKey(),
    dueDate: "",
    blockedBy: [],
    tags: ["feature-request", "feedback", ...(payload.impact === "bug-regression" ? ["bug"] : [])],
    subtasks: [],
    customFields: {
      requestType: "feature-request",
      featureStatus: "new",
      source: payload.source || "in-app",
      submittedAt: now,
      requester: payload.requester,
      requesterEmail: payload.email,
      impact: featureRequestImpactLabel(payload.impact)
    },
    createdAt: now,
    updatedAt: now
  });

  state.tasks = [task, ...state.tasks];
  state.selectedRoute = "board";
  state.selectedProject = "all";
  state.filters = { ...state.filters, assignee: "all", status: "all", priority: "all", query: "" };
  openSidebarGroupForRoute("board");
  addActivity({
    projectId: task.projectId,
    taskId: task.id,
    type: "task_create",
    message: `captured feature request ${payload.title}`
  });
  saveState();
  closeDialog(els.featureRequestDialog);
  render();
  showToast("Feature request added to the taskboard", "success");
  syncFeatureRequestToApi(task, payload);
}

function showTaskEditWarning(task) {
  const warning = document.querySelector("#task-edit-warning");
  if (!warning || !task) return;
  warning.hidden = false;
  warning.innerHTML = `
    <strong>This task changed since you opened it.</strong>
    <span>Latest update: ${formatTimestamp(taskRevision(task))}. Review the latest activity, then press Save Task again to overwrite.</span>
  `;
}

function fillSelect(selector, options, selectedValue, labelKey) {
  const select = document.querySelector(selector);
  select.innerHTML = options.map((option) => (
    `<option value="${option.id}" ${option.id === selectedValue ? "selected" : ""}>${escapeHtml(option[labelKey])}</option>`
  )).join("");
}

function populateProjectForm(project = null) {
  document.querySelector("#project-id").value = project?.id || "";
  document.querySelector("#project-name").value = project?.name || "";
  document.querySelector("#project-description").value = project?.description || "";
  document.querySelector("#project-start-date").value = project?.startDate || "";
  document.querySelector("#project-due-date").value = project?.dueDate || "";
  fillSelect("#project-company", state.companies, project?.companyId || (state.filters.company === "all" ? state.companies[0].id : state.filters.company), "name");
  fillSelect("#project-owner", members, project?.owner || members[0].id, "name");
  document.querySelector("#project-form-title").textContent = project ? "Edit Project" : "New Project";
  document.querySelector("#project-form .button-primary").textContent = project ? "Save Project" : "Create Project";
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

  const mentionIds = Array.from(document.querySelectorAll("[data-comment-mention]:checked"))
    .map((input) => input.dataset.commentMention)
    .filter(Boolean);
  const kind = normalizeCommentKind(document.querySelector("#comment-kind")?.value || "comment");
  const parentId = document.querySelector("#comment-parent")?.value || "";
  const now = new Date().toISOString();
  const comment = {
    id: uid("comment"),
    taskId,
    parentId,
    author: activeMemberId(),
    body,
    kind,
    status: "open",
    mentionIds,
    resolvedAt: "",
    resolvedBy: "",
    createdAt: now,
    updatedAt: now
  };
  state.comments = normalizeComments([comment, ...state.comments]);
  setTaskWatching(taskId, true);
  mentionedMembers(comment).forEach((member) => {
    if (member.id === activeMemberId()) return;
    logNotificationHistory({
      kind: "mention",
      title: `Mentioned ${member.name}`,
      message: `${memberName(activeMemberId())} mentioned ${member.name} on ${task.title}.`,
      reason: body.slice(0, 180),
      channel: "in-app"
    });
  });

  addActivity({
    projectId: task.projectId,
    taskId,
    type: kind === "decision" ? "decision" : "comment",
    message: `${parentId ? "replied on" : kind === "decision" ? "recorded a decision on" : "commented on"} ${task.title}`
  });

  saveState();
  renderTaskCollaboration(taskId);
  render();
  showToast("Comment added", "success");
  syncCommentToApi(comment, "Comment synced to API");
}

function setCommentReplyTarget(commentId) {
  const parentSelect = document.querySelector("#comment-parent");
  const bodyInput = document.querySelector("#comment-body");
  if (!parentSelect || !bodyInput) return;
  parentSelect.value = commentId;
  bodyInput.focus();
  showToast("Reply target selected", "info");
}

function updateCommentRecord(commentId, updates = {}) {
  const existing = state.comments.find((comment) => comment.id === commentId);
  if (!existing) return;
  const now = new Date().toISOString();
  const nextComment = {
    ...existing,
    ...updates,
    kind: updates.kind ? normalizeCommentKind(updates.kind) : normalizeCommentKind(existing.kind),
    status: updates.status ? normalizeCommentStatus(updates.status) : normalizeCommentStatus(existing.status),
    updatedAt: now
  };
  if (updates.status === "resolved") {
    nextComment.resolvedAt = now;
    nextComment.resolvedBy = activeMemberId();
  } else if (updates.status === "open") {
    nextComment.resolvedAt = "";
    nextComment.resolvedBy = "";
  }
  state.comments = normalizeComments(state.comments.map((comment) => comment.id === commentId ? nextComment : comment));
  const task = byId(state.tasks, nextComment.taskId);
  if (task) {
    addActivity({
      projectId: task.projectId,
      taskId: task.id,
      type: nextComment.status === "resolved" ? "comment_resolved" : nextComment.kind === "decision" ? "decision" : "comment_update",
      message: nextComment.status === "resolved"
        ? `resolved a thread on ${task.title}`
        : nextComment.kind === "decision"
          ? `marked a decision on ${task.title}`
          : `updated a comment on ${task.title}`
    });
  }
  saveState();
  renderTaskCollaboration(nextComment.taskId);
  render();
  showToast(nextComment.status === "resolved" ? "Thread resolved" : nextComment.kind === "decision" ? "Decision recorded" : "Comment updated", "success");
  syncCommentToApi(nextComment, "Comment synced to API");
}

function addTaskTimeEntry() {
  const taskId = document.querySelector("#task-id").value;
  const task = byId(state.tasks, taskId);
  const minutes = Number(document.querySelector("#time-minutes")?.value || 0);
  const memberId = canLogTimeForOthers() ? (document.querySelector("#time-member")?.value || activeMemberId()) : activeMemberId();
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
    memberId: activeMemberId(),
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

  const now = new Date().toISOString();
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
    createdAt: now,
    updatedAt: now
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

function createProjectFromTemplate(templateId, { companyId, name, startDate = todayKey(), ownerId = "", taskKeys = null } = {}) {
  const template = byId(state.projectTemplates, templateId);
  const targetCompanyId = companyId || (state.filters.company === "all" ? state.companies[0].id : state.filters.company);
  if (!template || !targetCompanyId) return null;
  const includedTaskKeys = Array.isArray(taskKeys) && taskKeys.length ? new Set(taskKeys) : null;
  const templateTasks = includedTaskKeys
    ? template.tasks.filter((templateTask) => includedTaskKeys.has(templateTask.key))
    : template.tasks;

  const project = {
    id: uid("project"),
    name: name || template.name,
    companyId: targetCompanyId,
    description: template.description,
    owner: ownerId || template.owner,
    startDate,
    dueDate: shiftDate(startDate, template.durationDays)
  };
  const taskIdsByKey = {};
  const tasks = templateTasks.map((templateTask) => {
    const taskId = uid("task");
    const now = new Date().toISOString();
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
      createdAt: now,
      updatedAt: now
    };
  }).map((task, index) => ({
    ...task,
    blockedBy: (templateTasks[index].blockedBy || []).map((key) => taskIdsByKey[key]).filter(Boolean)
  }));
  const milestones = template.milestones
    .filter((milestone) => !includedTaskKeys || milestone.taskKeys.some((key) => includedTaskKeys.has(key)))
    .map((milestone) => ({
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

function saveProjectAsTemplate() {
  const sourceProjectId = document.querySelector("#project-template-source")?.value;
  const project = byId(state.projects, sourceProjectId);
  const name = document.querySelector("#project-template-name")?.value.trim() || `${project?.name || "Project"} Template`;
  const creatorName = document.querySelector("#project-template-creator")?.value.trim() || memberName(project?.owner) || "Community creator";
  const priceCents = Math.max(0, Math.round(Number(document.querySelector("#project-template-price")?.value || 0) * 100));
  const currency = document.querySelector("#project-template-currency")?.value || "USD";
  const payoutMode = document.querySelector("#project-template-payout-mode")?.value || "creator";
  const payoutRecipient = document.querySelector("#project-template-payout-recipient")?.value.trim() || creatorName;
  const payoutChain = document.querySelector("#project-template-payout-chain")?.value || "Not set";
  const payoutWallet = document.querySelector("#project-template-payout-wallet")?.value.trim() || "";
  const payoutCharity = document.querySelector("#project-template-payout-charity")?.value.trim() || "";
  const donationPercent = clamp(Math.round(Number(document.querySelector("#project-template-donation-percent")?.value || 0)), 0, 100);
  if (!project) {
    showToast("Choose a source project", "info");
    return;
  }
  const startDate = project.startDate || todayKey();
  const tasks = getProjectTasks(project.id, false);
  const taskKeys = Object.fromEntries(tasks.map((task, index) => [task.id, `task-${index + 1}`]));
  const template = {
    id: uid("template"),
    name,
    category: companyName(project.companyId) || "Custom",
    description: project.description || `Reusable template from ${project.name}`,
    owner: project.owner,
    creatorName,
    durationDays: Math.max(7, daysBetween(startDate, project.dueDate || shiftDate(startDate, 14))),
    priceCents,
    currency,
    payout: {
      mode: payoutMode,
      recipientName: payoutRecipient,
      walletAddress: payoutWallet,
      chain: payoutChain,
      charityName: payoutCharity,
      donationPercent,
      note: priceCents ? "Creator-defined payout route. Payment adapters should verify destination details server-side before moving funds." : ""
    },
    tasks: tasks.map((task, index) => ({
      key: taskKeys[task.id] || `task-${index + 1}`,
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      priority: task.priority,
      startOffset: daysBetween(startDate, task.startDate || startDate),
      dueOffset: daysBetween(startDate, task.dueDate || shiftDate(startDate, 7)),
      tags: [...(task.tags || [])],
      blockedBy: (task.blockedBy || []).map((id) => taskKeys[id]).filter(Boolean),
      subtasks: (task.subtasks || []).map((subtask) => subtask.title)
    })),
    milestones: getProjectMilestones(project.id).map((milestone) => ({
      title: milestone.title,
      description: milestone.description,
      dueOffset: daysBetween(startDate, milestone.dueDate || shiftDate(startDate, 14)),
      owner: milestone.owner,
      status: milestone.status,
      taskKeys: (milestone.taskIds || []).map((id) => taskKeys[id]).filter(Boolean)
    })),
    docs: state.documents.filter((document) => document.projectId === project.id).map((document) => ({
      title: document.title,
      type: document.type,
      body: document.body
    })),
    intakeForm: {
      title: `${name} intake`,
      assignee: project.owner,
      description: `Collect requests for ${name}.`
    }
  };
  state.projectTemplates = [template, ...state.projectTemplates.filter((item) => item.name.toLowerCase() !== name.toLowerCase())];
  saveState();
  render();
  showToast("Project template saved", "success");
}

function saveTaskAsTemplate() {
  const sourceTaskId = document.querySelector("#task-template-source")?.value;
  const task = byId(state.tasks, sourceTaskId);
  const name = document.querySelector("#task-template-name")?.value.trim() || task?.title || "Task Template";
  if (!task) {
    showToast("Choose a source task", "info");
    return;
  }
  const template = {
    id: uid("task-template"),
    name,
    description: task.description || `Reusable task template from ${task.title}`,
    assignee: task.assignee,
    priority: task.priority,
    durationDays: Math.max(1, daysBetween(task.startDate || todayKey(), task.dueDate || shiftDate(todayKey(), 3))),
    tags: [...(task.tags || [])],
    subtasks: (task.subtasks || []).map((subtask) => subtask.title),
    customFields: { ...(task.customFields || {}) }
  };
  state.taskTemplates = [template, ...state.taskTemplates.filter((item) => item.name.toLowerCase() !== name.toLowerCase())];
  saveState();
  render();
  showToast("Task template saved", "success");
}

function deleteProjectTemplate(templateId) {
  if (seedData.projectTemplates.some((template) => template.id === templateId)) {
    state.deletedProjectTemplateIds = Array.from(new Set([...(state.deletedProjectTemplateIds || []), templateId]));
  }
  state.projectTemplates = state.projectTemplates.filter((template) => template.id !== templateId);
  saveState();
  render();
  showToast("Project template deleted", "success");
}

function deleteTaskTemplate(templateId) {
  state.taskTemplates = state.taskTemplates.filter((template) => template.id !== templateId);
  saveState();
  render();
  showToast("Task template deleted", "success");
}

function installMarketplaceTemplate(templateId) {
  const template = marketplaceProjectTemplates.find((item) => item.id === templateId);
  if (!template) return;
  if (state.projectTemplates.some((item) => item.id === template.id || item.name.toLowerCase() === template.name.toLowerCase())) {
    showToast("Template is already installed", "info");
    return;
  }
  if (!marketplaceTemplateIsUnlocked(template)) {
    showToast("Grant access before installing this premium template", "info");
    return;
  }
  const installedTemplate = validateProjectTemplate(template, { preserveId: true });
  state.projectTemplates = [installedTemplate, ...state.projectTemplates];
  state.templateLibrary = {
    ...(state.templateLibrary || {}),
    category: "all",
    query: "",
    selectedProjectTemplateId: installedTemplate.id
  };
  saveState();
  render();
  showToast(`${installedTemplate.name} installed`, "success");
}

function marketplacePaymentItem(template) {
  const price = marketplaceTemplatePrice(template);
  return {
    itemType: "project-template",
    itemId: template.id,
    name: template.name,
    amountCents: price.cents,
    currency: price.currency,
    payout: templatePayoutSettings(template)
  };
}

function upsertPaymentEntitlement(entitlement, event) {
  const normalized = normalizePaymentEntitlements([entitlement])[0];
  if (!normalized) return null;
  const payments = paymentSettings();
  state.workspace = {
    ...state.workspace,
    payments: {
      ...payments,
      entitlements: [
        normalized,
        ...payments.entitlements.filter((item) => !(item.itemType === normalized.itemType && item.itemId === normalized.itemId))
      ].slice(0, 100),
      audit: event ? [event, ...payments.audit].slice(0, 50) : payments.audit
    }
  };
  return normalized;
}

function grantLocalMarketplaceTemplateEntitlement(template, source = "test") {
  const item = marketplacePaymentItem(template);
  const payments = paymentSettings();
  const entitlement = {
    id: uid("entitlement"),
    itemType: item.itemType,
    itemId: item.itemId,
    source: entitlementSourceOptions.some((option) => option.id === source) ? source : "test",
    status: "active",
    amountCents: item.amountCents,
    currency: item.currency,
    note: `${entitlementSourceLabel(source)} for ${template.name}`,
    grantedAt: new Date().toISOString(),
    expiresAt: "",
    provider: payments.provider,
    payoutSnapshot: item.payout
  };
  const event = {
    id: uid("payment-audit"),
    action: "entitlement_granted",
    provider: payments.provider,
    currency: item.currency,
    amountCents: item.amountCents,
    status: "granted",
    note: `${template.name} unlocked by ${entitlementSourceLabel(entitlement.source).toLowerCase()}`,
    createdAt: new Date().toISOString()
  };
  upsertPaymentEntitlement(entitlement, event);
  addAuditEvent({
    action: "entitlement_granted",
    detail: `Granted access to ${template.name}`
  });
  saveState();
  render();
  showToast(`${template.name} unlocked`, "success");
}

async function grantServerMarketplaceTemplateEntitlement(template, source = "test") {
  const item = marketplacePaymentItem(template);
  const provider = source === "manual" ? "manual" : "test";
  const intentResult = await apiRequest("/api/payments/checkout-intent", {
    method: "POST",
    body: { provider, item }
  });
  const eventResult = await apiRequest("/api/payments/events", {
    method: "POST",
    body: {
      type: provider === "manual" ? "manual_payment.confirmed" : "checkout.test_completed",
      intentId: intentResult.intent.id
    }
  });
  if (!eventResult.entitlement && eventResult.duplicate) {
    showToast("Template access is already active on the API", "info");
    return;
  }
  if (!eventResult.entitlement) throw new Error("API did not return an entitlement");
  const event = {
    id: uid("payment-audit"),
    action: "server_entitlement_granted",
    provider: eventResult.intent?.provider || provider,
    currency: item.currency,
    amountCents: item.amountCents,
    status: "granted",
    note: `${template.name} unlocked by API checkout intent`,
    createdAt: new Date().toISOString()
  };
  upsertPaymentEntitlement(eventResult.entitlement, event);
  addAuditEvent({
    action: "payment_entitlement_granted",
    detail: `API granted access to ${template.name}`
  });
  saveState();
  render();
  showToast(`${template.name} unlocked via API`, "success");
}

async function grantMarketplaceTemplateEntitlement(templateId, source = "test") {
  if (!canWrite("payments:write")) {
    showToast("Your role cannot grant payment entitlements", "info");
    return;
  }
  const template = marketplaceProjectTemplates.find((item) => item.id === templateId);
  if (!template || !marketplaceTemplateRequiresEntitlement(template)) {
    showToast("Choose a premium marketplace template", "info");
    return;
  }
  if (hasEntitlementForItem("project-template", template.id)) {
    showToast("Template access is already active", "info");
    return;
  }
  if (!apiSession) {
    grantLocalMarketplaceTemplateEntitlement(template, source);
    return;
  }
  try {
    await grantServerMarketplaceTemplateEntitlement(template, source);
  } catch (error) {
    showToast(`API entitlement failed: ${error.message}`, "info");
  }
}

async function grantSelectedPaymentEntitlement() {
  const templateId = document.querySelector("#entitlement-template")?.value || "";
  const source = document.querySelector("#entitlement-source")?.value || "test";
  await grantMarketplaceTemplateEntitlement(templateId, source);
}

function restoreTextareaValue(selector, value) {
  const textarea = document.querySelector(selector);
  if (textarea) textarea.value = value;
}

function previewProjectTemplateImportPayload() {
  const textarea = document.querySelector("#template-import-json");
  const rawJson = textarea?.value.trim() || "";
  if (!rawJson) {
    showToast("Paste template JSON first", "info");
    return;
  }
  try {
    state.templateImportPreview = projectTemplateImportPreview(rawJson);
    saveState();
    render();
    restoreTextareaValue("#template-import-json", rawJson);
    showToast("Template preview ready", "success");
  } catch (error) {
    showToast(`Template preview failed: ${error.message}`, "info");
  }
}

function importProjectTemplateFromTextarea() {
  const textarea = document.querySelector("#template-import-json");
  const rawJson = textarea?.value.trim() || "";
  if (!rawJson) {
    showToast("Paste template JSON first", "info");
    return;
  }
  try {
    importProjectTemplateJson(rawJson);
  } catch (error) {
    showToast(`Template import failed: ${error.message}`, "info");
  }
}

function createTaskFromSubmissionRecord(submission, form) {
  const now = new Date().toISOString();
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
    createdAt: now,
    updatedAt: now
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

async function createFileRecord() {
  const selectedFile = document.querySelector("#file-upload")?.files?.[0] || null;
  const title = document.querySelector("#file-title")?.value.trim() || selectedFile?.name || "";
  const projectId = document.querySelector("#file-project")?.value;
  const kind = document.querySelector("#file-kind")?.value.trim() || (selectedFile ? fileKindFromBrowserFile(selectedFile) : "File");
  const size = document.querySelector("#file-size")?.value.trim() || (selectedFile ? formatBrowserFileSize(selectedFile.size) : "Unknown size");
  if (!title || !projectId) return;

  const file = {
    id: uid("file"),
    projectId,
    title,
    kind,
    size,
    owner: currentMemberId,
    updatedAt: new Date().toISOString(),
    contentType: selectedFile?.type || "",
    url: ""
  };

  if (selectedFile && apiSession) {
    try {
      const dataUrl = await readBrowserFileAsDataUrl(selectedFile);
      const result = await apiRequest("/api/files/upload", {
        method: "POST",
        body: {
          file: {
            ...file,
            fileName: selectedFile.name,
            dataUrl
          }
        }
      });
      state.files = [result.file, ...state.files.filter((item) => item.id !== result.file.id)];
      addActivity({
        projectId,
        type: "file_upload",
        message: `uploaded file ${result.file.title}`
      });
      saveState();
      render();
      showToast("File uploaded to API", "success");
      return;
    } catch (error) {
      showToast(`Upload failed: ${error.message}. Saving metadata locally.`, "info");
    }
  }

  state.files = [file, ...state.files];
  addActivity({
    projectId,
    type: selectedFile ? "file_queue" : "file_create",
    message: `${selectedFile ? "queued" : "added"} file ${title}`
  });
  saveState();
  render();
  showToast(selectedFile && !apiSession ? "File metadata saved. Connect API to upload bytes." : "File added", "success");
  syncFileToApi(file, "File metadata synced to API");
}

function readBrowserFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File could not be read"));
    reader.readAsDataURL(file);
  });
}

function fileKindFromBrowserFile(file) {
  const extension = file.name.split(".").pop();
  return extension && extension !== file.name ? extension.toUpperCase() : (file.type.split("/")[1] || "File").toUpperCase();
}

function formatBrowserFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadFileFromApi(fileId) {
  const file = byId(state.files, fileId);
  if (!apiSession || !file?.url) {
    showToast("This file does not have an API download yet", "info");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${file.url}`, {
      headers: {
        Authorization: `Bearer ${apiSession.token}`
      }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Download failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.title || "agora-file";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("File download started", "success");
  } catch (error) {
    showToast(`Download failed: ${error.message}`, "info");
  }
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

function createProjectFromPreview() {
  const preview = document.querySelector("[data-template-preview]");
  const templateId = preview?.dataset.templatePreview;
  if (!templateId) return;
  const taskKeys = Array.from(preview.querySelectorAll("[data-template-task-key]:checked")).map((input) => input.dataset.templateTaskKey);
  if (!taskKeys.length) {
    showToast("Keep at least one task in the project", "info");
    return;
  }
  const created = createProjectFromTemplate(templateId, {
    companyId: document.querySelector("#template-preview-company")?.value,
    name: document.querySelector("#template-preview-name")?.value.trim() || undefined,
    startDate: document.querySelector("#template-preview-start")?.value || todayKey(),
    ownerId: document.querySelector("#template-preview-owner")?.value,
    taskKeys
  });
  if (!created) return;

  state.selectedProject = created.project.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "overview";
  state.filters.company = created.project.companyId;
  saveState();
  render();
  showToast("Customized project created", "success");
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

function automationRollbackState() {
  return {
    tasks: structuredClone(state.tasks),
    activities: structuredClone(state.activities),
    documents: structuredClone(state.documents),
    approvals: structuredClone(state.approvals),
    intakeSubmissions: structuredClone(state.intakeSubmissions),
    dailyPlans: structuredClone(state.dailyPlans || {})
  };
}

function updateAutomationRun(ruleId, changedCount, rollbackState = null) {
  const now = new Date().toISOString();
  state.automations = state.automations.map((automation) => automation.id === ruleId
    ? { ...automation, lastRun: now, runCount: Number(automation.runCount || 0) + 1 }
    : automation);
  state.automationHistory = [{
    id: uid("automation-run"),
    automationId: ruleId,
    changedCount,
    rollbackState,
    rollbackAvailable: Boolean(rollbackState && changedCount),
    status: "applied",
    createdAt: now
  }, ...state.automationHistory].slice(0, 20);
}

function runAutomation(ruleId) {
  const rawAutomation = byId(state.automations, ruleId);
  if (!rawAutomation) return 0;
  const automation = normalizeAutomationRule(rawAutomation);
  if (!automation.enabled) return 0;

  let changedCount = 0;
  const rollbackState = automationRollbackState();
  if (automation.triggerKind === "intake_high") {
    state.intakeSubmissions
      .filter((submission) => !submission.taskId && submission.urgency === "High")
      .forEach((submission) => {
        const form = byId(state.intakeForms, submission.formId);
        if (!form) return;
        createTaskFromSubmissionRecord(submission, form);
        changedCount += 1;
      });
  }

  if (automation.triggerKind === "task_blocked") {
    matchingAutomationTasks(automation)
      .filter(isTaskBlocked)
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

  if (automation.triggerKind === "task_due_soon") {
    dueSoonTasks(matchingAutomationTasks(automation))
      .filter((task) => task.customFields?.risk !== "High")
      .forEach((task) => {
        changedCount += applyAutomationAction(automation, task);
      });
  }

  if (automation.triggerKind === "milestone_due") {
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

  if (automation.triggerKind === "approval_pending") {
    state.approvals
      .filter((approval) => approval.status !== "approved")
      .filter((approval) => automation.conditionKind !== "company" || companyName(approval.companyId).toLowerCase().includes(automation.conditionValue.toLowerCase()) || approval.companyId === automation.conditionValue)
      .forEach((approval) => {
        const task = byId(state.tasks, approval.taskId) || getProjectTasks(approval.projectId, false).find((item) => item.status !== "done");
        if (task) changedCount += applyAutomationAction(automation, task, approval);
      });
  }

  updateAutomationRun(ruleId, changedCount, changedCount ? rollbackState : null);
  saveState();
  render();
  showToast(changedCount ? `Automation ran on ${changedCount} ${changedCount === 1 ? "item" : "items"}` : "Automation ran with no changes", changedCount ? "success" : "info");
  return changedCount;
}

function rollbackAutomationRun(runId) {
  const run = state.automationHistory.find((item) => item.id === runId);
  if (!run?.rollbackState || run.status === "rolled-back") {
    showToast("No rollback is available for that run", "info");
    return;
  }

  state.tasks = run.rollbackState.tasks || state.tasks;
  state.activities = run.rollbackState.activities || state.activities;
  state.documents = run.rollbackState.documents || state.documents;
  state.approvals = run.rollbackState.approvals || state.approvals;
  state.intakeSubmissions = run.rollbackState.intakeSubmissions || state.intakeSubmissions;
  state.dailyPlans = run.rollbackState.dailyPlans || state.dailyPlans;
  state.automationHistory = state.automationHistory.map((item) => item.id === runId
    ? { ...item, status: "rolled-back", rolledBackAt: new Date().toISOString() }
    : item);
  saveState();
  render();
  showToast("Automation run rolled back", "success");
}

function matchingAutomationTasks(automation) {
  return activeTasks().filter((task) => {
    if (task.status === "done") return false;
    const value = automation.conditionValue.toLowerCase();
    if (automation.conditionKind === "project") return projectName(task.projectId).toLowerCase().includes(value) || task.projectId === automation.conditionValue;
    if (automation.conditionKind === "assignee") return memberName(task.assignee).toLowerCase().includes(value) || task.assignee === automation.conditionValue;
    if (automation.conditionKind === "company") return projectCompany(task.projectId).name.toLowerCase().includes(value) || projectCompany(task.projectId).id === automation.conditionValue;
    if (automation.conditionKind === "priority") return task.priority === value || priorityLabel(task.priority).toLowerCase() === value;
    return true;
  });
}

function applyAutomationAction(automation, task, approval = null) {
  if (!task) return 0;
  if (automation.actionKind === "set_risk") {
    state.tasks = state.tasks.map((item) => item.id === task.id ? {
      ...item,
      customFields: { ...(item.customFields || {}), risk: automation.actionTarget || "High" }
    } : item);
    addActivity({
      projectId: task.projectId,
      taskId: task.id,
      type: "automation_risk",
      message: `set risk for ${task.title} to ${automation.actionTarget || "High"}`
    });
    return 1;
  }
  if (automation.actionKind === "create_task") {
    const project = byId(state.projects, task.projectId);
    if (!project) return 0;
    createOperatorTask({
      project,
      sourceTask: task,
      title: `${automation.actionTarget || "Follow up"}: ${task.title}`,
      description: `Automation ${automation.name} created this follow-up from ${task.title}.`,
      assignee: task.assignee,
      priority: task.priority === "urgent" ? "urgent" : "high",
      tags: ["automation"]
    });
    return 1;
  }
  if (automation.actionKind === "draft_update") {
    const document = draftCompanyUpdate(projectCompany(task.projectId).id);
    return document ? 1 : 0;
  }
  if (automation.actionKind === "notify_channel") {
    addActivity({
      projectId: task.projectId,
      taskId: task.id,
      type: "automation_notify",
      message: `would notify ${automation.actionTarget || "connected channel"} about ${approval?.title || task.title}`
    });
    return 1;
  }
  addActivity({
    projectId: task.projectId,
    taskId: task.id,
    memberId: task.assignee,
    type: "automation_action",
    message: `${automation.name} recorded activity for ${approval?.title || task.title}`
  });
  return 1;
}

function toggleAutomation(ruleId) {
  state.automations = state.automations.map((automation) => automation.id === ruleId ? { ...automation, enabled: !automation.enabled } : automation);
  saveState();
  render();
  showToast("Automation updated", "success");
}

function installAutomationMarketplacePack(packId) {
  const pack = automationMarketplacePacks.find((item) => item.id === packId);
  if (!pack) return;
  const existingNames = new Set(state.automations.map((automation) => `${automation.marketplacePackId}:${automation.name}`));
  const installedAt = new Date().toISOString();
  const rules = pack.rules
    .filter((rule) => !existingNames.has(`${pack.id}:${rule.name}`))
    .map((rule) => normalizeAutomationRule({
      ...rule,
      id: uid("automation"),
      trigger: automationTriggerLabel(rule.triggerKind),
      action: automationActionLabel(rule.actionKind),
      marketplacePackId: pack.id,
      source: "marketplace",
      creatorName: pack.creatorName,
      installedAt,
      license: pack.license
    }));

  if (!rules.length) {
    showToast("Automation pack is already installed", "info");
    return;
  }

  state.automations = [...rules, ...state.automations].slice(0, 50);
  addAuditEvent({
    action: "automation_pack_install",
    detail: `Installed ${pack.name} automation pack with ${rules.length} rules`
  });
  saveState();
  render();
  showToast(`Installed ${pack.name}`, "success");
}

function exportAutomationMarketplacePack(packId) {
  const pack = automationMarketplacePacks.find((item) => item.id === packId);
  if (!pack) return;
  downloadJsonFile(`${slugFromName(pack.name)}-automation-pack.json`, JSON.stringify(automationMarketplacePackPayload(pack), null, 2));
  showToast("Automation pack exported", "success");
}

function authoredAutomationPackForApi() {
  const rules = state.automations
    .filter((automation) => automation.source !== "marketplace" && automation.source !== "imported")
    .slice(0, 20);
  if (!rules.length) return null;
  const name = `${state.workspace.name} Workflow Pack`;
  const pack = {
    id: `automation-pack-${slugFromName(state.workspace.slug || state.workspace.name)}-local`,
    name,
    category: "Workspace",
    creatorName: memberName(activeMemberId()) || state.workspace.name,
    license: "Workspace-authored workflow pack",
    description: `Automation rules shared from ${state.workspace.name}.`,
    rules: rules.map((rule) => automationRuleForPack(rule, {
      name,
      creatorName: memberName(activeMemberId()) || state.workspace.name,
      license: "Workspace-authored workflow pack"
    }))
  };
  return pack;
}

async function publishMarketplaceCatalogToApi() {
  if (!apiSession) {
    showToast("Connect the API before publishing marketplace packs", "info");
    return;
  }
  marketplaceApiLoading = true;
  render();
  try {
    const automationPack = authoredAutomationPackForApi();
    const result = await apiRequest("/api/marketplace/catalog", {
      method: "POST",
      body: {
        projectTemplates: state.projectTemplates.map((template) => projectTemplateExportPayload(template).template),
        automationPacks: automationPack ? [automationPack] : []
      }
    });
    marketplaceApiCatalog = result.catalog;
    addAuditEvent({
      action: "marketplace_catalog_publish",
      detail: `Published ${result.published?.projectTemplates || 0} templates and ${result.published?.automationPacks || 0} automation packs to the API`,
      targetType: "marketplace",
      impact: "medium"
    });
    showToast("Marketplace catalog published to API", "success");
  } catch (error) {
    showToast(`Marketplace publish failed: ${error.message}`, "info");
  } finally {
    marketplaceApiLoading = false;
    saveState();
    render();
  }
}

function mergeApiMarketplaceCatalog(catalog = {}) {
  const incomingTemplates = Array.isArray(catalog.projectTemplates) ? catalog.projectTemplates : [];
  const incomingPacks = Array.isArray(catalog.automationPacks) ? catalog.automationPacks : [];
  const templateIds = new Set(marketplaceProjectTemplates.map((template) => template.id));
  incomingTemplates.forEach((template) => {
    try {
      const normalized = validateProjectTemplate(template, { preserveId: true });
      if (!templateIds.has(normalized.id)) {
        marketplaceProjectTemplates.push(normalized);
        templateIds.add(normalized.id);
      }
    } catch {
      // Hosted marketplace items are optional; skip malformed entries without breaking the hub.
    }
  });
  const packIds = new Set(automationMarketplacePacks.map((pack) => pack.id));
  incomingPacks.forEach((pack) => {
    try {
      const normalized = parseAutomationPackPayload(JSON.stringify({ type: "agora.automation-pack", pack })).pack;
      if (!packIds.has(normalized.id)) {
        automationMarketplacePacks.push(normalized);
        packIds.add(normalized.id);
      }
    } catch {
      // Same defensive behavior as templates: keep the rest of the catalog usable.
    }
  });
}

async function loadMarketplaceCatalogFromApi() {
  if (!apiSession) {
    showToast("Connect the API before loading marketplace packs", "info");
    return;
  }
  marketplaceApiLoading = true;
  render();
  try {
    const result = await apiRequest("/api/marketplace/catalog");
    marketplaceApiCatalog = result.catalog;
    mergeApiMarketplaceCatalog(result.catalog);
    showToast("Marketplace catalog loaded from API", "success");
  } catch (error) {
    showToast(`Marketplace load failed: ${error.message}`, "info");
  } finally {
    marketplaceApiLoading = false;
    render();
  }
}

function previewAutomationPackImportPayload() {
  const textarea = document.querySelector("#automation-pack-import-payload");
  const rawJson = textarea?.value.trim();
  if (!rawJson) {
    showToast("Paste an automation pack JSON export first", "info");
    return;
  }

  try {
    state.automationPackImportPreview = automationPackImportPreview(rawJson);
    saveState();
    render();
    restoreTextareaValue("#automation-pack-import-payload", rawJson);
    showToast("Automation pack preview ready", "success");
  } catch (error) {
    showToast(`Pack preview failed: ${error.message}`, "info");
  }
}

function installAutomationPackImportPayload() {
  const textarea = document.querySelector("#automation-pack-import-payload");
  const rawJson = textarea?.value.trim();
  if (!rawJson) {
    showToast("Paste an automation pack JSON export first", "info");
    return;
  }

  try {
    const payload = parseAutomationPackPayload(rawJson);
    const installedAt = new Date().toISOString();
    const existingKeys = new Set(state.automations.map((automation) => `${automation.marketplacePackId || ""}:${automation.name}`));
    const importedRules = payload.pack.rules
      .filter((rule) => !existingKeys.has(`${payload.pack.id}:${rule.name}`))
      .map((rule) => normalizeAutomationRule({
        ...rule,
        id: uid("automation"),
        marketplacePackId: payload.pack.id,
        source: "imported",
        creatorName: payload.pack.creatorName,
        installedAt,
        license: payload.pack.license
      }));
    if (!importedRules.length) {
      showToast("That automation pack is already installed", "info");
      return;
    }

    state.automations = [...importedRules, ...state.automations].slice(0, 50);
    state.automationPackImportPreview = null;
    addAuditEvent({
      action: "automation_pack_import",
      detail: `Imported ${payload.pack.name} automation pack with ${importedRules.length} rules`
    });
    saveState();
    render();
    showToast(`Imported ${payload.pack.name}`, "success");
  } catch (error) {
    showToast(`Pack import failed: ${error.message}`, "info");
  }
}

function selectedAutomationPackRuleIds() {
  return [...document.querySelectorAll("[data-author-automation]:checked")]
    .map((input) => input.dataset.authorAutomation)
    .filter(Boolean);
}

function automationRuleForPack(rule, pack) {
  return normalizeAutomationRule({
    ...rule,
    id: `${slugFromName(pack.name)}-${slugFromName(rule.name)}`,
    marketplacePackId: slugFromName(pack.name),
    source: "community",
    creatorName: pack.creatorName,
    installedAt: "",
    license: pack.license,
    lastRun: "",
    runCount: 0
  });
}

function exportAuthoredAutomationPack() {
  const name = document.querySelector("#automation-pack-name")?.value.trim() || "";
  const category = document.querySelector("#automation-pack-category")?.value.trim() || "Community";
  const creatorName = document.querySelector("#automation-pack-creator")?.value.trim() || memberName(activeMemberId()) || state.workspace.name;
  const license = document.querySelector("#automation-pack-license")?.value.trim() || "MIT-style workflow pack";
  const description = document.querySelector("#automation-pack-description")?.value.trim() || "";
  const selectedIds = selectedAutomationPackRuleIds();
  if (!name) {
    showToast("Add a pack name first", "info");
    return;
  }
  if (!selectedIds.length) {
    showToast("Select at least one automation rule", "info");
    return;
  }

  const pack = {
    id: `automation-pack-${slugFromName(name)}`,
    name,
    category,
    creatorName,
    license,
    description: description || `Community automation pack for ${name}.`,
    rules: selectedIds
      .map((id) => byId(state.automations, id))
      .filter(Boolean)
      .map((rule) => automationRuleForPack(rule, { name, creatorName, license }))
  };
  downloadJsonFile(`${slugFromName(name)}-automation-pack.json`, JSON.stringify({
    type: "agora.automation-pack",
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    pack
  }, null, 2));
  showToast("Automation pack exported", "success");
}

function setAutomationPackAuthorSelection(checked) {
  document.querySelectorAll("[data-author-automation]").forEach((input) => {
    input.checked = checked;
  });
}

function saveAutomationRule() {
  const id = document.querySelector("#automation-id")?.value || uid("automation");
  const existing = byId(state.automations, id);
  const name = document.querySelector("#automation-name")?.value.trim();
  const triggerKind = document.querySelector("#automation-trigger-kind")?.value || "task_due_soon";
  const conditionKind = document.querySelector("#automation-condition-kind")?.value || "any";
  const conditionValue = document.querySelector("#automation-condition-value")?.value.trim() || "";
  const actionKind = document.querySelector("#automation-action-kind")?.value || "create_task";
  const actionTarget = document.querySelector("#automation-action-target")?.value.trim() || "";
  const trigger = automationTriggerLabel(triggerKind);
  const action = automationActionLabel(actionKind);
  const enabled = Boolean(document.querySelector("#automation-enabled")?.checked);

  if (!name || !trigger || !action) {
    showToast("Add a name, trigger, and action", "info");
    return;
  }

  const rule = {
    id,
    name,
    trigger,
    action,
    triggerKind,
    conditionKind,
    conditionValue,
    actionKind,
    actionTarget,
    enabled,
    lastRun: existing?.lastRun || "",
    runCount: Number(existing?.runCount || 0),
    marketplacePackId: existing?.marketplacePackId || "",
    source: existing?.source || "",
    creatorName: existing?.creatorName || "",
    installedAt: existing?.installedAt || "",
    license: existing?.license || ""
  };

  state.automations = existing
    ? state.automations.map((automation) => automation.id === id ? rule : automation)
    : [rule, ...state.automations];
  saveState();
  render();
  showToast(existing ? "Automation updated" : "Automation created", "success");
}

function editAutomationRule(ruleId) {
  const automation = byId(state.automations, ruleId);
  if (!automation) return;
  const idInput = document.querySelector("#automation-id");
  const nameInput = document.querySelector("#automation-name");
  const triggerInput = document.querySelector("#automation-trigger");
  const actionInput = document.querySelector("#automation-action");
  const triggerKindInput = document.querySelector("#automation-trigger-kind");
  const conditionKindInput = document.querySelector("#automation-condition-kind");
  const conditionValueInput = document.querySelector("#automation-condition-value");
  const actionKindInput = document.querySelector("#automation-action-kind");
  const actionTargetInput = document.querySelector("#automation-action-target");
  const enabledInput = document.querySelector("#automation-enabled");
  if (idInput) idInput.value = automation.id;
  if (nameInput) {
    nameInput.value = automation.name;
    nameInput.focus();
  }
  if (triggerInput) triggerInput.value = automation.trigger;
  if (actionInput) actionInput.value = automation.action;
  if (triggerKindInput) triggerKindInput.value = automation.triggerKind || triggerKindFromText(automation.trigger);
  if (conditionKindInput) conditionKindInput.value = automation.conditionKind || "any";
  if (conditionValueInput) conditionValueInput.value = automation.conditionValue || "";
  if (actionKindInput) actionKindInput.value = automation.actionKind || actionKindFromText(automation.action);
  if (actionTargetInput) actionTargetInput.value = automation.actionTarget || "";
  if (enabledInput) enabledInput.checked = automation.enabled;
  showToast("Automation loaded for editing", "info");
}

function deleteAutomationRule(ruleId) {
  state.automations = state.automations.filter((automation) => automation.id !== ruleId);
  state.automationHistory = state.automationHistory.filter((run) => run.automationId !== ruleId);
  saveState();
  render();
  showToast("Automation deleted", "success");
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
  return document;
}

function createOperatorTask({ project, sourceTask = null, title, description, assignee, priority = "high", dueOffset = 1, tags = [] }) {
  const existing = activeTasks().find((task) => task.projectId === project.id && task.title === title && task.status !== "done");
  if (existing) {
    planTaskForDate(existing.id, "next", todayKey());
    state.selectedRoute = "daily";
    state.selectedDailyDate = todayKey();
    saveState();
    render();
    showToast("Existing operator task planned for Today", "info");
    return existing;
  }

  const now = new Date().toISOString();
  const task = {
    id: uid("task"),
    projectId: project.id,
    title,
    description,
    assignee: assignee || project.owner || currentMemberId,
    status: "todo",
    priority,
    startDate: todayKey(),
    dueDate: shiftDate(todayKey(), dueOffset),
    blockedBy: [],
    tags: ["operator", ...tags],
    subtasks: sourceTask ? [
      { id: uid("subtask"), title: `Review ${sourceTask.title}`, done: false },
      { id: uid("subtask"), title: "Post next owner and next date", done: false }
    ] : [
      { id: uid("subtask"), title: "Confirm owner", done: false },
      { id: uid("subtask"), title: "Share update", done: false }
    ],
    customFields: {
      effort: "Small",
      risk: priority === "urgent" ? "High" : "Medium"
    },
    createdAt: now,
    updatedAt: now
  };

  state.tasks = [task, ...state.tasks];
  planTaskForDate(task.id, "next", todayKey());
  addActivity({
    projectId: project.id,
    taskId: sourceTask?.id || task.id,
    type: "operator_action",
    message: `created operator follow-up ${task.title}`
  });
  syncTaskToApi(task, "Operator task synced to API", true);
  return task;
}

function addOperatorComment(task, body) {
  const comment = {
    id: uid("comment"),
    taskId: task.id,
    author: currentMemberId,
    body,
    createdAt: new Date().toISOString()
  };
  state.comments = [comment, ...state.comments];
  addActivity({
    projectId: task.projectId,
    taskId: task.id,
    type: "operator_comment",
    message: `added an operator note to ${task.title}`
  });
  syncCommentToApi(comment, "Operator note synced to API");
  return comment;
}

function operatorRationaleFor(type, projectId = "", taskId = "") {
  const task = taskId ? byId(state.tasks, taskId) : null;
  const project = projectId ? byId(state.projects, projectId) : null;
  if (type.includes("approval")) return "Approval work is pending or client-facing delivery needs an explicit review trail.";
  if (type.includes("client_update")) return "Client-facing stakeholders need a concise status packet from the current portal state.";
  if (type.includes("plan")) return task ? operatorReasonForTask(task) : "The Operator selected the highest-signal open work for today.";
  if (type.includes("integration")) return "Connected adapters should expose health, event subscriptions, and last-sync evidence.";
  return project ? `Project health, due dates, blockers, and recent activity indicated ${project.name} needed action.` : "Workspace signals indicated this action would reduce delivery risk.";
}

function operatorDataSourcesFor(type) {
  const sources = ["tasks", "projects", "activity"];
  if (type.includes("approval")) sources.push("approvals");
  if (type.includes("client_update")) sources.push("client portal", "docs", "files");
  if (type.includes("integration")) sources.push("integration settings", "audit log");
  return Array.from(new Set(sources));
}

function logOperatorAction({ type, title, detail, projectId = "", taskId = "", status = "applied", rationale = "", dataSources = [], undoType = "", undoRecordId = "" }) {
  const action = {
    id: uid("operator-action"),
    type,
    title,
    detail,
    projectId,
    taskId,
    status,
    rationale: rationale || operatorRationaleFor(type, projectId, taskId),
    dataSources: dataSources.length ? dataSources : operatorDataSourcesFor(type),
    undoType,
    undoRecordId,
    memberId: activeMemberId(),
    createdAt: new Date().toISOString()
  };
  state.operatorActions = [action, ...(Array.isArray(state.operatorActions) ? state.operatorActions : [])].slice(0, 50);
  addActivity({
    projectId,
    taskId,
    type: "operator_apply",
    message: `applied operator action ${title}`
  });
  return action;
}

function createOperatorApprovalRequest(project, sourceTask = null) {
  const company = projectCompany(project.id);
  const now = new Date().toISOString();
  const approval = {
    id: uid("approval-operator"),
    projectId: project.id,
    taskId: sourceTask?.id || "",
    companyId: company?.id || project.companyId || "",
    title: `Approval request: ${sourceTask?.title || project.name}`,
    summary: sourceTask
      ? `Operator generated approval request for ${sourceTask.title}. Confirm scope, next date, and owner.`
      : `Operator generated approval request for ${project.name}. Confirm the next milestone and client-facing status.`,
    reviewer: company?.type === "Client" ? `${company.name} reviewer` : "Project reviewer",
    requester: activeMemberId(),
    status: "requested",
    dueDate: shiftDate(todayKey(), 2),
    createdAt: now,
    updatedAt: now
  };
  state.approvals = [approval, ...state.approvals];
  syncRecordToApi("approvals", approval, "Approval request synced to API");
  return approval;
}

function draftOperatorClientUpdate(companyId) {
  const document = draftCompanyUpdate(companyId);
  if (!document) return null;
  logOperatorAction({
    type: "client_update",
    title: `Drafted client update for ${companyName(companyId)}`,
    detail: "Created a client-facing status update in Docs.",
    projectId: document?.projectId || "",
    undoType: "document",
    undoRecordId: document?.id || ""
  });
  return document;
}

function runOperatorCommand(command) {
  let changedCount = 0;
  if (command === "triage") {
    operatorActionSuggestions(3).filter((action) => canOperatorApplyType(action.type)).forEach((action) => {
      applyOperatorSuggestion(action.type, action.projectId, action.sourceTaskId, action.approvalId, action.companyId);
      changedCount += 1;
    });
  } else if (command === "approval-packet") {
    const candidate = operatorActionSuggestions(6).find((action) => (action.type === "approval_request" || action.type === "approval_chase") && canOperatorApplyType(action.type));
    if (candidate) {
      applyOperatorSuggestion(candidate.type, candidate.projectId, candidate.sourceTaskId, candidate.approvalId, candidate.companyId);
      changedCount += 1;
    }
  } else if (command === "portal-updates") {
    if (!canOperatorApplyType("client_update")) {
      showToast("Operator is not allowed to draft client updates", "info");
      return;
    }
    state.companies
      .filter((company) => company.type === "Client")
      .slice(0, 3)
      .forEach((company) => {
        if (draftOperatorClientUpdate(company.id)) changedCount += 1;
      });
  } else if (command === "integration-digest") {
    if (!operatorPermissions().integrationEvents) {
      showToast("Operator is not allowed to run integration events", "info");
      return;
    }
    recordIntegrationTestEvent();
    logOperatorAction({
      type: "integration_digest",
      title: "Prepared integration digest",
      detail: "Updated connected adapter health and logged an integration test event."
    });
    changedCount += 1;
  }

  if (!changedCount) {
    showToast("Operator command had nothing to apply", "info");
    return;
  }
  logOperatorAction({
    type: `command_${command}`,
    title: `Ran ${command.replaceAll("-", " ")} command`,
    detail: `Applied ${changedCount} ${changedCount === 1 ? "change" : "changes"} from the Operator command center.`
  });
  saveState();
  render();
  showToast(`Operator command applied ${changedCount} ${changedCount === 1 ? "change" : "changes"}`, "success");
}

function undoOperatorAction(actionId) {
  const action = (Array.isArray(state.operatorActions) ? state.operatorActions : []).find((item) => item.id === actionId);
  if (!action || !action.undoType || action.status === "undone") {
    showToast("This action cannot be undone", "info");
    return;
  }

  if (action.undoType === "task") {
    state.tasks = state.tasks.filter((task) => task.id !== action.undoRecordId);
    if (state.dailyPlans) delete state.dailyPlans[action.undoRecordId];
  } else if (action.undoType === "approval") {
    state.approvals = state.approvals.filter((approval) => approval.id !== action.undoRecordId);
  } else if (action.undoType === "document") {
    state.documents = state.documents.filter((document) => document.id !== action.undoRecordId);
  } else if (action.undoType === "daily-plan") {
    if (state.dailyPlans) delete state.dailyPlans[action.undoRecordId];
  } else {
    showToast("This action cannot be undone yet", "info");
    return;
  }

  state.operatorActions = state.operatorActions.map((item) => item.id === actionId
    ? { ...item, status: "undone", undoneAt: new Date().toISOString() }
    : item);
  addActivity({
    projectId: action.projectId,
    taskId: action.taskId,
    type: "operator_undo",
    message: `undid operator action ${action.title}`
  });
  saveState();
  render();
  showToast("Operator action undone", "success");
}

function applyOperatorSuggestion(type, projectId, taskId = "", approvalId = "", companyId = "") {
  if (!canOperatorApplyType(type)) {
    showToast("Operator permission blocks that action", "info");
    return;
  }

  const project = byId(state.projects, projectId);
  if (!project) return;

  const task = taskId ? byId(state.tasks, taskId) : null;
  const approval = approvalId ? byId(state.approvals, approvalId) : null;

  if (type === "task") {
    const created = createOperatorTask({
      project,
      sourceTask: task,
      title: task && isTaskBlocked(task) ? `Unblock: ${task.title}` : `Recovery plan: ${task?.title || project.name}`,
      description: task
        ? `Operator generated follow-up for ${task.title}. Confirm the owner, blocker, next date, and status update.`
        : `Operator generated follow-up for ${project.name}. Confirm the next owner and next date.`,
      assignee: task?.assignee || project.owner,
      priority: task && isOverdue(task) ? "urgent" : "high",
      dueOffset: 1,
      tags: ["applied"]
    });
    logOperatorAction({
      type,
      title: `Created ${created.title}`,
      detail: "Created and planned an operator follow-up task.",
      projectId,
      taskId: created.id,
      undoType: "task",
      undoRecordId: created.id
    });
  } else if (type === "approval_chase") {
    const created = createOperatorTask({
      project,
      sourceTask: task || byId(state.tasks, approval?.taskId),
      title: `Chase approval: ${approval?.title || project.name}`,
      description: `Operator generated approval chase${approval ? ` for ${approval.reviewer}: ${approval.summary}` : "."}`,
      assignee: approval?.requester || project.owner,
      priority: "high",
      dueOffset: 1,
      tags: ["approval", "applied"]
    });
    logOperatorAction({
      type,
      title: `Queued approval chase for ${approval?.title || project.name}`,
      detail: "Created an approval chase task and planned it for Today.",
      projectId,
      taskId: created.id,
      undoType: "task",
      undoRecordId: created.id
    });
  } else if (type === "approval_request") {
    const createdApproval = createOperatorApprovalRequest(project, task);
    logOperatorAction({
      type,
      title: `Requested approval for ${createdApproval.title}`,
      detail: `New approval routed to ${createdApproval.reviewer}.`,
      projectId,
      taskId: task?.id || "",
      undoType: "approval",
      undoRecordId: createdApproval.id
    });
  } else if (type === "client_update") {
    if (!draftOperatorClientUpdate(companyId || project.companyId || projectCompany(project.id)?.id)) return;
  } else if (type === "plan") {
    const targetTask = task || getProjectTasks(project.id, false).find((item) => item.status !== "done");
    if (!targetTask) return;
    planTaskForDate(targetTask.id, "now", todayKey());
    addOperatorComment(targetTask, `Operator planned this for Today because ${operatorReasonForTask(targetTask).toLowerCase()}.`);
    logOperatorAction({
      type,
      title: `Planned ${targetTask.title} for Today`,
      detail: "Moved the task into the Now lane and posted an operator note.",
      projectId,
      taskId: targetTask.id,
      undoType: "daily-plan",
      undoRecordId: targetTask.id
    });
  }

  saveState();
  render();
  showToast("Operator action applied", "success");
}

function generateTodayPlan() {
  const date = state.selectedDailyDate;
  const plan = dailyOperatorPlan(date);
  const laneEntries = [
    ...plan.now.map((item) => ({ ...item, lane: "now" })),
    ...plan.next.map((item) => ({ ...item, lane: "next" })),
    ...plan.later.map((item) => ({ ...item, lane: "later" }))
  ];

  if (!laneEntries.length) {
    showToast("No high-signal work to plan", "info");
    return;
  }

  laneEntries.forEach(({ task, lane }) => {
    planTaskForDate(task.id, lane, date);
  });

  const noteLines = [
    `AI operator plan (${aiProviderLabel()})`,
    ...laneEntries.map(({ task, lane, reason }) => `- ${lane.toUpperCase()}: ${task.title} - ${reason}`)
  ];
  state.dailyNotes = {
    ...state.dailyNotes,
    [date]: [state.dailyNotes?.[date], noteLines.join("\n")].filter(Boolean).join("\n\n")
  };

  addActivity({
    projectId: laneEntries[0].task.projectId,
    type: "ai_daily_plan",
    message: `generated a daily operator plan for ${formatFullDate(date)}`
  });
  saveState();
  render();
  showToast(`Generated ${laneEntries.length} planned ${laneEntries.length === 1 ? "task" : "tasks"}`, "success");
}

function projectOperatorBriefBody(project) {
  const brief = operatorBriefForProject(project);
  const tasks = getProjectTasks(project.id, false);
  const recentActivity = getProjectActivity(project.id, 5);
  const approvals = getProjectApprovals(project.id).filter((approval) => approval.status !== "approved");
  const liveViewers = livePresenceRecords({}).filter((presence) => presence.projectId === project.id);

  return [
    `${project.name} operator brief`,
    `Generated by ${aiProviderLabel()}.`,
    "",
    brief.summary,
    `Next action: ${brief.nextAction}.`,
    "",
    "Signals",
    `- Health: ${brief.health}%`,
    `- Progress: ${brief.progress}%`,
    `- Open tasks: ${tasks.filter((task) => task.status !== "done").length}`,
    `- Blocked: ${brief.blocked.length}`,
    `- Due soon: ${brief.dueSoon.length}`,
    `- Pending approvals: ${approvals.length}`,
    liveViewers.length ? `- Live viewers: ${liveViewers.map((presence) => memberName(presence.memberId)).join(", ")}` : "- Live viewers: none right now",
    "",
    "Recommended actions",
    ...[brief.blocked[0], brief.overdue[0], brief.dueSoon[0]].filter(Boolean).map((task) => `- ${task.title}: ${operatorReasonForTask(task)}.`),
    approvals[0] ? `- Approval: follow up on ${approvals[0].title} with ${approvals[0].reviewer}.` : "- Approval: no pending approval chase needed.",
    "",
    "Recent activity",
    ...(recentActivity.length ? recentActivity.map((activity) => `- ${formatTimestamp(activity.createdAt)}: ${memberName(activity.memberId)} ${activity.message}.`) : ["- No recent activity."])
  ].join("\n");
}

function workspaceOperatorBriefBody() {
  const briefs = operatorBriefs(5);
  const openTasks = activeTasks().filter((task) => task.status !== "done");
  const blocked = openTasks.filter(isTaskBlocked);
  const approvals = state.approvals.filter((approval) => approval.status !== "approved");

  return [
    `${state.workspace.name} operator brief`,
    `Generated by ${aiProviderLabel()}.`,
    "",
    `${activeProjects().length} active projects, ${openTasks.length} open tasks, ${blocked.length} blocked tasks, and ${approvals.length} pending approvals.`,
    "",
    "Highest-risk projects",
    ...(briefs.length ? briefs.map((brief) => `- ${brief.project.name}: ${brief.health}% health. ${brief.nextAction}.`) : ["- No active project risks visible."]),
    "",
    "Recommended actions",
    ...openTasks
      .sort((a, b) => operatorTaskScore(b) - operatorTaskScore(a))
      .slice(0, 5)
      .map((task) => `- ${task.title}: ${operatorReasonForTask(task)}.`),
    "",
    "Workspace update draft",
    `${state.workspace.name}: focus today on ${briefs[0]?.nextAction || "reviewing active work and clearing the highest-signal blockers"}.`
  ].join("\n");
}

async function generateProjectBrief(projectId) {
  const project = byId(state.projects, projectId);
  if (!project) return;

  showToast("Drafting project brief", "info");
  const aiResult = await runAiOperator("project_brief", projectAiContext(project), projectOperatorBriefBody(project));
  const document = {
    id: uid("doc-brief"),
    projectId,
    title: aiResult.title || `${project.name} operator brief`,
    type: "Operator Brief",
    owner: activeMemberId(),
    updatedAt: new Date().toISOString(),
    body: aiResult.body
  };
  state.documents = [document, ...state.documents];
  addActivity({
    projectId,
    type: "ai_project_brief",
    message: `generated an operator brief for ${project.name}`
  });
  saveState();
  render();
  showToast(`Project brief drafted in Docs (${aiResult.provider})`, "success");
  syncDocumentToApi(document, "Operator brief synced to API");
}

async function generateWorkspaceBrief() {
  const project = visibleReportProjects()[0] || activeProjects()[0];
  if (!project) {
    showToast("Create a project before drafting a workspace brief", "info");
    return;
  }

  showToast("Drafting workspace brief", "info");
  const aiResult = await runAiOperator("workspace_brief", workspaceAiContext(), workspaceOperatorBriefBody());
  const document = {
    id: uid("doc-workspace-brief"),
    projectId: project.id,
    title: aiResult.title || `${state.workspace.name} operator brief`,
    type: "Workspace Brief",
    owner: activeMemberId(),
    updatedAt: new Date().toISOString(),
    body: aiResult.body
  };
  state.documents = [document, ...state.documents];
  addActivity({
    projectId: project.id,
    type: "ai_workspace_brief",
    message: `generated a workspace operator brief for ${state.workspace.name}`
  });
  saveState();
  render();
  showToast(`Workspace brief drafted in Docs (${aiResult.provider})`, "success");
  syncDocumentToApi(document, "Workspace brief synced to API");
}

function runOperatorAction(actionType, projectId) {
  const project = byId(state.projects, projectId);
  if (!project) return;

  const brief = operatorBriefForProject(project);
  const company = projectCompany(project.id);
  const sourceTask = brief.overdue[0] || brief.blocked[0] || brief.dueSoon[0] || getProjectTasks(project.id, false).find((task) => task.status !== "done");
  const approval = brief.approvals[0];

  if (actionType === "recover" && sourceTask) {
    createOperatorTask({
      project,
      sourceTask,
      title: `Recovery plan: ${sourceTask.title}`,
      description: `Operator generated follow-up for overdue work in ${project.name}. Confirm the blocker, reset the due date, and post a recovery note.`,
      assignee: sourceTask.assignee,
      priority: "urgent",
      dueOffset: 1,
      tags: ["recovery"]
    });
  } else if (actionType === "unblock" && sourceTask) {
    const blockers = openTaskDependencies(sourceTask).map((task) => task.title).join(", ") || "unconfirmed blocker";
    createOperatorTask({
      project,
      sourceTask,
      title: `Unblock: ${sourceTask.title}`,
      description: `Operator generated unblock task. Current blocker: ${blockers}. Decide the next owner and remove the dependency once resolved.`,
      assignee: project.owner || sourceTask.assignee,
      priority: "high",
      dueOffset: 1,
      tags: ["unblock"]
    });
  } else if (actionType === "approval" && approval) {
    createOperatorTask({
      project,
      sourceTask: sourceTask || byId(state.tasks, approval.taskId),
      title: `Chase approval: ${approval.title}`,
      description: `Operator generated approval chase for ${approval.reviewer}. Summary: ${approval.summary}`,
      assignee: approval.requester || project.owner,
      priority: "high",
      dueOffset: 1,
      tags: ["approval"]
    });
  } else if (actionType === "plan" && sourceTask) {
    planTaskForDate(sourceTask.id, "now", todayKey());
    addOperatorComment(sourceTask, `Operator planned this for Today because it is due ${formatDate(sourceTask.dueDate)}.`);
  } else if (actionType === "advance" && sourceTask) {
    addOperatorComment(sourceTask, `Operator next step: advance this task, confirm the next owner, and leave a short status update for ${project.name}.`);
    planTaskForDate(sourceTask.id, "next", todayKey());
  } else {
    draftCompanyUpdate(company?.id || state.companies[0]?.id);
    return;
  }

  state.selectedRoute = "daily";
  state.selectedDailyDate = todayKey();
  saveState();
  render();
  showToast("Operator action queued for Today", "success");
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
  const themePreset = document.querySelector('input[name="workspace-theme"]:checked')?.value || state.workspace.theme?.preset;
  const density = document.querySelector("#workspace-density")?.value || state.workspace.theme?.density;
  const existingCapacity = capacitySettings();
  const weeklyCapacityHours = Number(document.querySelector("#workspace-capacity-hours")?.value || existingCapacity.weeklyMinutes / 60);
  const focusTargetPercent = Number(document.querySelector("#workspace-focus-target")?.value || existingCapacity.focusTargetPercent);
  const warnAtPercent = Number(document.querySelector("#workspace-capacity-warn")?.value || existingCapacity.warnAtPercent);
  const overloadAtPercent = Number(document.querySelector("#workspace-capacity-overload")?.value || existingCapacity.overloadAtPercent);
  if (!name || !slug) return;

  state.workspace = {
    ...state.workspace,
    name,
    slug,
    visibility,
    defaultRole,
    theme: normalizeWorkspaceTheme({ preset: themePreset, density }),
    capacity: normalizeWorkspaceCapacity({
      ...existingCapacity,
      weeklyMinutes: weeklyCapacityHours * 60,
      focusTargetPercent,
      warnAtPercent,
      overloadAtPercent
    }),
    backendTarget: backendTarget || state.workspace.backendTarget
  };
  addAuditEvent({
    action: "workspace_settings_update",
    detail: `Updated workspace settings for ${state.workspace.name}`
  });
  saveState();
  render();
  showToast("Workspace settings saved", "success");
}

function saveAiSettings() {
  const provider = document.querySelector("#ai-provider")?.value || "local";
  const model = document.querySelector("#ai-model")?.value.trim() || (provider === "local" ? "Agora deterministic operator" : "");
  const baseUrl = document.querySelector("#ai-base-url")?.value.trim() || "";
  const keySource = document.querySelector("#ai-key-source")?.value || "Server environment";
  const dataPolicy = document.querySelector("#ai-data-policy")?.value || "Workspace only";
  const promptTemplate = document.querySelector("#ai-prompt-template")?.value || "Transparent project operator";
  const auditMode = document.querySelector("#ai-audit-mode")?.value || "Preview, rationale, undo";

  state.workspace = {
    ...state.workspace,
    ai: {
      provider,
      model,
      baseUrl,
      keySource,
      dataPolicy,
      promptTemplate,
      auditMode,
      permissions: operatorPermissions()
    }
  };
  saveState();
  render();
  showToast("AI operator settings saved", "success");
}

function saveIntegrationSettings() {
  if (!canWrite("integrations:write")) {
    showToast("Your role cannot manage integrations", "info");
    return;
  }
  const existing = integrationSettings();
  const existingById = new Map(existing.connections.map((connection) => [connection.id, connection]));
  const connections = integrationCatalog.map((catalogItem) => {
    const previous = existingById.get(catalogItem.id) || {};
    const status = document.querySelector(`[data-integration-status="${catalogItem.id}"]`)?.value || previous.status || "planned";
    const syncMode = document.querySelector(`[data-integration-sync="${catalogItem.id}"]`)?.value || previous.syncMode || "none";
    const owner = document.querySelector(`[data-integration-owner="${catalogItem.id}"]`)?.value || "";
    const notes = document.querySelector(`[data-integration-notes="${catalogItem.id}"]`)?.value || "";
    const health = document.querySelector(`[data-integration-health="${catalogItem.id}"]`)?.value || previous.health || "planned";
    const secretStatus = document.querySelector(`[data-integration-secret="${catalogItem.id}"]`)?.value || previous.secretStatus || "missing";
    const events = Array.from(document.querySelectorAll(`[data-integration-event="${catalogItem.id}"]:checked`)).map((input) => input.value);
    return normalizeIntegrationConnection({
      id: catalogItem.id,
      status,
      syncMode,
      owner,
      notes,
      health,
      secretStatus,
      events,
      lastSyncedAt: status === "connected" && previous.status !== "connected" ? new Date().toISOString() : previous.lastSyncedAt
    });
  }).filter(Boolean);

  state.workspace = {
    ...state.workspace,
    integrations: normalizeWorkspaceIntegrations({
      defaultOwner: document.querySelector("#integration-default-owner")?.value || existing.defaultOwner,
      webhookEndpoint: document.querySelector("#integration-webhook-endpoint")?.value || "",
      apiAccess: document.querySelector("#integration-api-access")?.checked,
      eventMirroring: document.querySelector("#integration-event-mirroring")?.checked,
      connections
    })
  };
  addAuditEvent({
    action: "integrations_update",
    detail: `Updated ${connections.filter((connection) => connection.status === "connected").length} connected integrations`
  });
  syncIntegrationSettingsToApi();
  saveState();
  render();
  showToast("Integrations saved", "success");
}

function saveDashboardLayout() {
  state.dashboardWidgets = dashboardWidgetCatalog.map((widget) => ({
    id: widget.id,
    visible: document.querySelector(`[data-dashboard-widget="${widget.id}"]`)?.checked !== false
  }));
  state.dashboardLayouts = normalizeDashboardLayouts(state.dashboardLayouts).map((layout) => (
    layout.id === state.selectedDashboardLayoutId
      ? { ...layout, widgets: state.dashboardWidgets, updatedAt: new Date().toISOString() }
      : layout
  ));
  addAuditEvent({
    action: "dashboard_layout_update",
    detail: `Saved ${state.dashboardWidgets.filter((widget) => widget.visible).length} dashboard widgets`
  });
  saveState();
  render();
  showToast("Dashboard layout saved", "success");
}

function saveNamedDashboardLayout() {
  const widgets = dashboardWidgetCatalog.map((widget) => ({
    id: widget.id,
    visible: document.querySelector(`[data-dashboard-widget="${widget.id}"]`)?.checked !== false
  }));
  const name = document.querySelector("#dashboard-layout-name")?.value.trim() || "Untitled dashboard";
  const selectedId = document.querySelector("#dashboard-layout-select")?.value || state.selectedDashboardLayoutId || "";
  const layouts = normalizeDashboardLayouts(state.dashboardLayouts);
  const existing = layouts.find((layout) => layout.id === selectedId && layout.name.toLowerCase() === name.toLowerCase());
  const now = new Date().toISOString();
  const layout = {
    id: existing?.id || uid("dashboard-layout"),
    name,
    widgets,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  state.dashboardWidgets = widgets;
  state.dashboardLayouts = normalizeDashboardLayouts([
    layout,
    ...layouts.filter((item) => item.id !== layout.id)
  ]);
  state.selectedDashboardLayoutId = layout.id;
  addAuditEvent({
    action: "dashboard_named_layout_save",
    detail: `Saved dashboard layout ${layout.name}`
  });
  saveState();
  render();
  showToast(`Saved ${layout.name}`, "success");
}

function applyDashboardLayout() {
  const selectedId = document.querySelector("#dashboard-layout-select")?.value || state.selectedDashboardLayoutId;
  const layout = normalizeDashboardLayouts(state.dashboardLayouts).find((item) => item.id === selectedId);
  if (!layout) {
    showToast("Pick a dashboard layout first", "info");
    return;
  }

  state.dashboardWidgets = normalizeDashboardWidgets(layout.widgets);
  state.selectedDashboardLayoutId = layout.id;
  addAuditEvent({
    action: "dashboard_named_layout_apply",
    detail: `Applied dashboard layout ${layout.name}`
  });
  saveState();
  render();
  showToast(`Applied ${layout.name}`, "success");
}

function sendWorkspaceChatMessage() {
  const body = document.querySelector("#chat-message-body")?.value.trim() || "";
  if (!body) {
    showToast("Write a message first", "info");
    return;
  }
  const link = parseDiscussionLink(document.querySelector("#chat-link")?.value || "");
  const selectedProjectId = document.querySelector("#chat-project")?.value || discussionLinkProjectId(link);
  const message = {
    id: uid("chat"),
    channel: document.querySelector("#chat-channel")?.value || "general",
    author: activeMemberId(),
    body,
    projectId: selectedProjectId,
    linkType: link.linkType,
    linkId: link.linkId,
    createdAt: new Date().toISOString()
  };
  state.chatMessages = normalizeChatMessages([
    ...state.chatMessages,
    message
  ]);
  addAuditEvent({ action: "chat_message", detail: "Posted a workspace chat message" });
  saveState();
  render();
  syncRecordToApi("chatMessages", message, "Chat synced to API", false);
  showToast("Message sent", "success");
}

function addWhiteboardNote() {
  const text = document.querySelector("#whiteboard-item-text")?.value.trim() || "";
  if (!text) {
    showToast("Write a board note first", "info");
    return;
  }
  const boards = state.whiteboards.length ? [...state.whiteboards] : normalizeWhiteboards([{ title: "Workspace Canvas", items: [] }]);
  const board = boards[0];
  const nextIndex = board.items.length;
  const item = {
    id: uid("wb-note"),
    type: document.querySelector("#whiteboard-item-type")?.value || "note",
    text,
    x: 8 + (nextIndex * 19) % 74,
    y: 12 + (nextIndex * 17) % 62,
    color: document.querySelector("#whiteboard-item-color")?.value || "green"
  };
  boards[0] = {
    ...board,
    items: [...board.items, item]
  };
  state.whiteboards = normalizeWhiteboards(boards);
  addAuditEvent({ action: "whiteboard_note", detail: `Added ${item.type} to ${board.title}` });
  saveState();
  render();
  syncRecordToApi("whiteboards", state.whiteboards[0], "Whiteboard synced to API", false);
  showToast("Board note added", "success");
}

function recordIntegrationTestEvent() {
  if (!canWrite("integrations:write")) {
    showToast("Your role cannot test integrations", "info");
    return;
  }
  const integrations = integrationSettings();
  const connected = integrations.connections.filter((connection) => connection.status === "connected");
  const now = new Date().toISOString();
  state.workspace = {
    ...state.workspace,
    integrations: normalizeWorkspaceIntegrations({
      ...integrations,
      connections: integrations.connections.map((connection) => connection.status === "connected"
        ? { ...connection, health: "healthy", lastSyncedAt: now }
        : connection)
    })
  };
  addAuditEvent({
    action: "integration_test_event",
    detail: connected.length
      ? `Test event queued for ${connected.map((connection) => integrationCatalog.find((item) => item.id === connection.id)?.name || connection.id).join(", ")}`
      : "Test event recorded with no connected integrations"
  });
  saveState();
  render();
  showToast(connected.length ? "Integration test event logged" : "No connected integrations yet", connected.length ? "success" : "info");
}

function savePaymentSettings() {
  if (!canWrite("payments:write")) {
    showToast("Your role cannot manage payments", "info");
    return;
  }
  const provider = document.querySelector("#payment-provider")?.value || "none";
  const planId = document.querySelector("#payment-plan")?.value || "free";
  const currency = document.querySelector("#payment-currency")?.value || "USD";
  const capValue = Number(document.querySelector("#payment-spending-cap")?.value || 0);
  const spendingCapCents = Math.max(0, Math.round(capValue * 100));
  const nextPayments = normalizeWorkspacePayments({
    ...paymentSettings(),
    provider,
    planId,
    currency,
    spendingCapCents,
    marketplacePayments: document.querySelector("#payment-marketplace")?.checked,
    clientPortalPayments: document.querySelector("#payment-client-portal")?.checked,
    agentPayments: document.querySelector("#payment-agent-spend")?.checked,
    x402Experimental: document.querySelector("#payment-x402-experimental")?.checked
  });
  const event = {
    id: uid("payment-audit"),
    action: "payment_settings_update",
    provider: nextPayments.provider,
    currency: nextPayments.currency,
    amountCents: nextPayments.spendingCapCents,
    status: "saved",
    note: `${paymentPlan(nextPayments.planId).label} plan with ${paymentProviderLabel(nextPayments.provider)} configured for ${nextPayments.currency}`,
    createdAt: new Date().toISOString()
  };

  state.workspace = {
    ...state.workspace,
    payments: {
      ...nextPayments,
      audit: [event, ...nextPayments.audit].slice(0, 50)
    }
  };
  addAuditEvent({
    action: "payment_settings_update",
    detail: `Payments set to ${paymentPlan(nextPayments.planId).label} / ${paymentProviderLabel(nextPayments.provider)} with ${formatPaymentAmount(nextPayments.spendingCapCents, nextPayments.currency)} cap`
  });
  saveState();
  render();
  showToast("Payment settings saved", "success");
}

function recordTestPaymentEvent() {
  if (!canWrite("payments:write")) {
    showToast("Your role cannot test payments", "info");
    return;
  }
  const payments = paymentSettings();
  if (payments.provider === "none") {
    showToast("Choose a payment provider first", "info");
    return;
  }
  const amountCents = payments.spendingCapCents ? Math.min(payments.spendingCapCents, 500) : 500;
  const event = {
    id: uid("payment-audit"),
    action: "payment_test_event",
    provider: payments.provider,
    currency: payments.currency,
    amountCents,
    status: "test",
    note: "Prototype payment event recorded locally. No money moved.",
    createdAt: new Date().toISOString()
  };
  state.workspace = {
    ...state.workspace,
    payments: {
      ...payments,
      audit: [event, ...payments.audit].slice(0, 50)
    }
  };
  addAuditEvent({
    action: "payment_test_event",
    detail: `Recorded ${formatPaymentAmount(amountCents, payments.currency)} ${paymentProviderLabel(payments.provider)} test event`
  });
  saveState();
  render();
  showToast("Test payment event recorded", "success");
}

function updateMemberRole(memberId, role) {
  if (!workspaceMembers().some((member) => member.id === memberId) || !workspaceRoles.some((item) => item.id === role)) return;
  if (!canWrite("members:write")) {
    showToast("Your role cannot manage members", "info");
    render();
    return;
  }

  const existing = state.memberships.some((membership) => membership.memberId === memberId);
  state.memberships = existing
    ? state.memberships.map((membership) => membership.memberId === memberId ? { ...membership, role } : membership)
    : [...state.memberships, { memberId, role, status: "active" }];
  addAuditEvent({
    action: "member_role_update",
    detail: `Changed ${memberName(memberId)} role to ${workspaceRoles.find((item) => item.id === role)?.label || role}`
  });
  saveState();
  render();
  showToast("Member role updated", "success");
}

function updateMemberCompanyAccess(memberId, companyId) {
  if (!workspaceMembers().some((member) => member.id === memberId)) return;
  if (companyId && !byId(state.companies, companyId)) return;
  if (!canWrite("members:write")) {
    showToast("Your role cannot manage company access", "info");
    render();
    return;
  }

  const existingMembership = state.memberships.find((membership) => membership.memberId === memberId);
  const nextMembership = {
    memberId,
    role: existingMembership?.role || state.workspace.defaultRole,
    status: existingMembership?.status || "active",
    ...(companyId ? { companyId } : {})
  };
  state.memberships = existingMembership
    ? state.memberships.map((membership) => membership.memberId === memberId ? { ...membership, companyId } : membership)
    : [...state.memberships, nextMembership];
  addAuditEvent({
    action: "member_company_scope_update",
    detail: `Changed ${memberName(memberId)} company scope to ${companyId ? companyName(companyId) : "workspace-wide"}`
  });
  saveState();
  render();
  showToast("Company access updated", "success");
}

function importWorkspaceFromTextarea() {
  const textarea = document.querySelector("#json-import");
  const rawJson = textarea?.value.trim();
  if (!rawJson) return;

  try {
    importWorkspaceJson(rawJson, { backupLabel: "Before JSON import" });
    render();
    showToast("Workspace imported", "success");
  } catch (error) {
    showToast("Import failed: check the JSON format", "info");
  }
}

function importWorkspaceAsNewFromTextarea() {
  const textarea = document.querySelector("#json-import");
  const rawJson = textarea?.value.trim();
  if (!rawJson) return;

  importWorkspaceAsNewFromPayload(rawJson);
}

function importWorkspaceAsNewFromPayload(rawJson) {
  try {
    const parsed = parsePortableWorkspaceInput(rawJson).snapshot;
    const sourceWorkspace = parsed.workspace || {};
    const workspaceName = `${sourceWorkspace.name || "Imported Workspace"} Import`;
    const workspaceId = uniqueWorkspaceId(workspaceName);
    const now = new Date().toISOString();
    const base = structuredClone(seedData);
    saveState();
    workspaceRegistry = normalizeWorkspaceRegistry([
      {
        id: workspaceId,
        name: workspaceName,
        slug: slugFromName(workspaceName),
        status: "active",
        template: "import",
        createdAt: now,
        updatedAt: now
      },
      ...workspaceRegistry
    ]);
    saveWorkspaceRegistry();
    activeWorkspaceId = workspaceId;
    saveActiveWorkspaceId(activeWorkspaceId);
    state = normalizeState({
      ...base,
      ...parsed,
      selectedRoute: "dashboard",
      selectedProject: "all",
      selectedCompany: "all",
      filters: { ...base.filters, ...(parsed.filters || {}) },
      workspace: {
        ...base.workspace,
        ...(parsed.workspace || {}),
        id: workspaceId,
        name: workspaceName,
        slug: slugFromName(workspaceName)
      },
      onboarding: {
        ...base.onboarding,
        ...(parsed.onboarding || {}),
        dismissed: false,
        sampleMode: "import"
      }
    });
    resetWorkspaceViewState();
    saveState();
    render();
    showToast(`Imported ${workspaceName}`, "success");
  } catch {
    showToast("Import failed: check the JSON format", "info");
  }
}

function previewPortableImportPayload() {
  const textarea = document.querySelector("#portable-import-payload");
  const rawJson = textarea?.value.trim();
  if (!rawJson) {
    showToast("Paste a portable bundle or workspace JSON first", "info");
    return;
  }

  try {
    state.portableImportPreview = portableImportPreview(rawJson);
    saveState();
    renderDataManagement();
    const nextTextarea = document.querySelector("#portable-import-payload");
    if (nextTextarea) nextTextarea.value = rawJson;
    showToast("Portable import preview ready", "success");
  } catch (error) {
    showToast(`Portable import failed: ${error.message}`, "info");
  }
}

function importPortablePayload(mode = "new-workspace") {
  const textarea = document.querySelector("#portable-import-payload");
  const rawJson = textarea?.value.trim();
  if (!rawJson) {
    showToast("Paste a portable bundle or workspace JSON first", "info");
    return;
  }

  try {
    if (mode === "replace") {
      importWorkspaceJson(rawJson, { backupLabel: "Before portable import" });
      state.portableImportPreview = null;
      saveState();
      render();
      showToast("Portable workspace imported", "success");
      return;
    }
    state.portableImportPreview = null;
    importWorkspaceAsNewFromPayload(rawJson);
  } catch (error) {
    showToast(`Portable import failed: ${error.message}`, "info");
  }
}

function importSwitcherPayload() {
  const source = document.querySelector("#switcher-source")?.value || "Generic CSV";
  const format = document.querySelector("#switcher-format")?.value || "csv";
  const mode = document.querySelector("#switcher-mode")?.value || "merge";
  const payload = document.querySelector("#switcher-import-payload")?.value.trim() || "";
  if (!payload) {
    showToast("Paste an export payload first", "info");
    return;
  }
  try {
    const rows = format === "json" ? rowsFromSwitcherJson(payload) : rowsFromSwitcherCsv(payload);
    const preview = prepareSwitcherImport(rows, source);
    preview.mode = mode === "new-workspace" ? "new-workspace" : "merge";
    state.switcherImportPreview = normalizeSwitcherImportPreview(preview);
    addAuditEvent({
      action: "switcher_import_preview",
      detail: `Previewed ${preview.stats.tasks} tasks from ${source}`,
      targetType: "import",
      targetId: preview.id,
      impact: "low",
      reversible: true,
      metadata: {
        mode: preview.mode,
        confidence: preview.stats.confidence,
        mappedFields: preview.mappedFields
      }
    });
    saveState();
    renderDataManagement();
    showToast(`Preview ready: ${preview.stats.tasks} tasks`, "success");
  } catch (error) {
    showToast(`Import failed: ${error.message}`, "info");
  }
}

function switcherSampleCsvPayload() {
  return [
    "title,project,status,priority,due_date,assignee,description",
    "\"Launch checklist\",\"Client Portal\",\"In Progress\",\"High\",\"2026-07-15\",\"Mara Ortiz\",\"Confirm portal copy and handoff tasks.\"",
    "\"Import legacy backlog\",\"Migration\",\"Todo\",\"Normal\",\"2026-07-18\",\"Sam Patel\",\"Move approved backlog items into Agora.\""
  ].join("\n");
}

function switcherSampleTrelloPayload() {
  return JSON.stringify({
    id: "board-sample",
    name: "Trello Sample Board",
    lists: [
      { id: "list-todo", name: "To Do" },
      { id: "list-doing", name: "Doing" }
    ],
    labels: [
      { id: "label-client", name: "client" },
      { id: "label-launch", name: "launch" }
    ],
    members: [
      { id: "member-mara", username: "mara", fullName: "Mara Ortiz" }
    ],
    cards: [
      {
        id: "card-launch-brief",
        name: "Approve launch brief",
        desc: "Confirm final launch brief with client.",
        idList: "list-doing",
        idLabels: ["label-client", "label-launch"],
        idMembers: ["member-mara"],
        due: "2026-07-21T12:00:00.000Z",
        closed: false,
        url: "https://trello.example/cards/card-launch-brief"
      }
    ]
  }, null, 2);
}

function copySwitcherSampleCsv() {
  const payload = switcherSampleCsvPayload();
  const textarea = document.querySelector("#switcher-import-payload");
  if (textarea && !textarea.value.trim()) {
    textarea.value = payload;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(payload)
      .then(() => showToast("Sample CSV copied", "success"))
      .catch(() => showToast("Sample CSV added to the import box", "info"));
  } else {
    showToast("Sample CSV added to the import box", "info");
  }
}

function copySwitcherSampleTrello() {
  const payload = switcherSampleTrelloPayload();
  const textarea = document.querySelector("#switcher-import-payload");
  const format = document.querySelector("#switcher-format");
  const source = document.querySelector("#switcher-source");
  if (textarea && !textarea.value.trim()) textarea.value = payload;
  if (format) format.value = "json";
  if (source) source.value = "Trello";
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(payload)
      .then(() => showToast("Sample Trello JSON copied", "success"))
      .catch(() => showToast("Sample Trello JSON added to the import box", "info"));
  } else {
    showToast("Sample Trello JSON added to the import box", "info");
  }
}

function rowsFromSwitcherJson(payload) {
  const parsed = JSON.parse(payload);
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.cards) && Array.isArray(parsed.lists)) return rowsFromTrelloJson(parsed);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.tasks)) return parsed.tasks;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.cards)) return parsed.cards;
  if (Array.isArray(parsed.data)) return parsed.data;
  throw new Error("JSON did not include a task array");
}

function rowsFromTrelloJson(board) {
  const lists = new Map((board.lists || []).map((list) => [list.id, list]));
  const labels = new Map((board.labels || []).map((label) => [label.id, label]));
  const membersById = new Map((board.members || []).map((member) => [member.id, member.fullName || member.username || member.id]));
  return (board.cards || [])
    .filter((card) => !card.closed)
    .map((card) => {
      const list = lists.get(card.idList) || {};
      return {
        id: card.id || card.shortLink || "",
        title: card.name || "",
        project: board.name || "Trello Import",
        board: board.name || "Trello Import",
        status: list.name || "",
        column: list.name || "",
        description: card.desc || "",
        assignee: (card.idMembers || []).map((id) => membersById.get(id)).filter(Boolean).join(", "),
        due_date: card.due || "",
        tags: (card.idLabels || []).map((id) => labels.get(id)?.name).filter(Boolean).join(", "),
        source_url: card.url || card.shortUrl || "",
        source_id: card.id || card.shortLink || "",
        raw_trello_list: list.name || ""
      };
    });
}

function rowsFromSwitcherCsv(payload) {
  const rows = parseCsvRows(payload);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one task");
  const headers = rows[0].map((header) => normalizeImportHeader(header));
  return rows.slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function parseCsvRows(payload) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < payload.length; index += 1) {
    const char = payload[index];
    const next = payload[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
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
  return rows;
}

function normalizeImportHeader(header) {
  return String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function importValue(row, keys) {
  for (const key of keys) {
    const normalized = normalizeImportHeader(key);
    if (Object.prototype.hasOwnProperty.call(row, normalized) && String(row[normalized] || "").trim()) return String(row[normalized]).trim();
    if (Object.prototype.hasOwnProperty.call(row, key) && String(row[key] || "").trim()) return String(row[key]).trim();
  }
  return "";
}

function importRowHeaders(rows = []) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}).map(normalizeImportHeader).filter(Boolean))));
}

function importMappedFields(headers = []) {
  const groups = [
    ["title", ["title", "task", "name", "task_name", "card_name", "item_name", "summary"]],
    ["project", ["project", "list", "board", "space", "folder", "group", "section", "workspace"]],
    ["assignee", ["assignee", "owner", "person", "assigned_to"]],
    ["status", ["status", "state", "column"]],
    ["priority", ["priority", "importance"]],
    ["due date", ["due", "due_date", "deadline", "date"]],
    ["description", ["description", "notes", "details", "body"]]
  ];
  const headerSet = new Set(headers.map(normalizeImportHeader));
  return groups
    .filter(([, aliases]) => aliases.some((alias) => headerSet.has(normalizeImportHeader(alias))))
    .map(([label]) => label);
}

function switcherPreviewConfidence({ rows, tasks, skipped, mappedFields }) {
  if (!rows) return 0;
  const fieldScore = Math.min(55, mappedFields.length * 9);
  const taskScore = Math.round((tasks / rows) * 35);
  const skipPenalty = Math.min(25, Math.round((skipped / rows) * 40));
  return Math.max(10, Math.min(100, fieldScore + taskScore + 10 - skipPenalty));
}

function switcherPreviewWarnings({ mappedFields, skipped, rows, source }) {
  const warnings = [];
  if (!mappedFields.includes("title")) warnings.push("No title/name column was detected. Rows without titles are skipped.");
  if (!mappedFields.includes("project")) warnings.push("No project/list column was detected. Tasks will use a default import project.");
  if (!mappedFields.includes("assignee")) warnings.push("No assignee column was detected. Tasks will be assigned to the active user.");
  if (!mappedFields.includes("due date")) warnings.push("No due-date column was detected. Imported tasks will not appear on deadline views until dates are added.");
  if (skipped) warnings.push(`${skipped} ${skipped === 1 ? "row was" : "rows were"} skipped because required task data was missing.`);
  if (rows > 100) warnings.push(`${source} export has ${rows} rows. Preview samples are limited, so review the imported project after apply.`);
  return warnings;
}

function prepareSwitcherImport(rows, source) {
  const now = new Date().toISOString();
  const sourceSystem = switcherSourceId(source);
  const importBatchId = uid(`import-${sourceSystem}`);
  const headers = importRowHeaders(rows);
  const mappedFields = importMappedFields(headers);
  const existingProjectNames = new Map(state.projects.map((project) => [project.name.toLowerCase(), project]));
  const nextProjects = [...state.projects];
  const nextTasks = [...state.tasks];
  const preparedProjects = [];
  const preparedTasks = [];
  const samples = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const title = importValue(row, ["title", "task", "name", "task_name", "card_name", "item_name", "summary"]);
    if (!title) {
      skipped += 1;
      return;
    }
    const projectNameValue = importValue(row, ["project", "list", "board", "space", "folder", "group", "section", "workspace"]) || `${source} Import`;
    const projectKey = projectNameValue.toLowerCase();
    let project = existingProjectNames.get(projectKey);
    if (!project) {
      project = normalizeProjectRecord({
        id: uniqueImportedId(`project-${slugFromName(projectNameValue)}`, nextProjects),
        name: projectNameValue,
        companyId: state.filters.company !== "all" ? state.filters.company : state.companies[0]?.id || "",
        description: `Imported from ${source}.`,
        owner: activeMemberId(),
        startDate: todayKey(),
        dueDate: "",
        customFields: {
          sourceSystem,
          sourceId: projectNameValue,
          sourceUrl: "",
          importBatchId,
          importedAt: now
        }
      });
      nextProjects.push(project);
      preparedProjects.push(project);
      existingProjectNames.set(projectKey, project);
    }
    const task = normalizeTaskRecord({
      id: uniqueImportedId(`task-${slugFromName(title)}`, nextTasks),
      projectId: project.id,
      title,
      description: importValue(row, ["description", "notes", "details", "body"]) || `Imported from ${source}.`,
      assignee: importMemberId(importValue(row, ["assignee", "owner", "person", "assigned_to"])),
      status: importStatus(importValue(row, ["status", "state", "column"])),
      priority: importPriority(importValue(row, ["priority", "importance"])),
      dueDate: importDate(importValue(row, ["due", "due_date", "deadline", "date"])),
      startDate: importDate(importValue(row, ["start", "start_date"])),
      customFields: {
        sourceSystem,
        sourceId: importValue(row, ["source_id", "id", "task_id", "card_id", "item_id"]) || `${sourceSystem}-${index + 1}`,
        sourceUrl: importValue(row, ["source_url", "url", "link", "permalink"]),
        importBatchId,
        importedAt: now,
        rawFields: { ...row }
      },
      blockedBy: [],
      tags: [source.toLowerCase().replaceAll(" ", "-")],
      subtasks: [],
      createdAt: now
    });
    task.sortOrder = index;
    nextTasks.push(task);
    preparedTasks.push(task);
    samples.push({
      title: task.title,
      projectName: project.name,
      assignee: memberName(task.assignee),
      status: task.status,
      priority: task.priority,
      sourceId: task.customFields.sourceId
    });
  });

  if (!preparedTasks.length) throw new Error("No tasks found in import payload");
  const confidence = switcherPreviewConfidence({ rows: rows.length, tasks: preparedTasks.length, skipped, mappedFields });
  const warnings = switcherPreviewWarnings({ mappedFields, skipped, rows: rows.length, source });
  return {
    id: uid("switcher-preview"),
    source,
    sourceSystem,
    importBatchId,
    mode: "merge",
    createdAt: now,
    stats: {
      rows: rows.length,
      projects: preparedProjects.length,
      tasks: preparedTasks.length,
      skipped,
      mappedFields: mappedFields.length,
      confidence
    },
    mappedFields,
    warnings,
    projects: preparedProjects,
    tasks: preparedTasks,
    samples: samples.slice(0, 6)
  };
}

function switcherSourceId(source) {
  return String(source || "generic-csv").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "generic-csv";
}

function applySwitcherRows(rows, source) {
  const preview = prepareSwitcherImport(rows, source);
  return applySwitcherPreview(preview);
}

function applySwitcherImportPreview() {
  const preview = normalizeSwitcherImportPreview(state.switcherImportPreview);
  if (!preview) {
    showToast("Preview an import before applying it", "info");
    return;
  }
  const result = applySwitcherPreview(preview);
  showToast(preview.mode === "new-workspace" ? `Created workspace with ${result.tasks} imported tasks` : `Imported ${result.tasks} tasks and ${result.projects} projects`, "success");
}

function applySwitcherPreview(preview) {
  const backup = workspaceBackupRecord(`Before ${preview.source} import`);
  const rollbackSnapshot = structuredClone(state);
  saveWorkspaceBackups([backup, ...loadWorkspaceBackups()]);
  if (preview.mode === "new-workspace") {
    const result = applySwitcherPreviewAsWorkspace(preview, backup);
    return result;
  }
  const projectIds = new Set(state.projects.map((project) => project.id));
  const taskIds = new Set(state.tasks.map((task) => task.id));
  const projects = preview.projects.filter((project) => !projectIds.has(project.id));
  const tasks = preview.tasks.filter((task) => !taskIds.has(task.id));
  state.projects = [...state.projects, ...projects];
  state.tasks = [...state.tasks, ...tasks];
  state.switcherImportPreview = null;
  state.switcherImportRollback = {
    id: uid("switcher-rollback"),
    source: preview.source,
    createdAt: new Date().toISOString(),
    summary: `Restore workspace to before the ${preview.source} import.`,
    backupId: backup.id,
    stats: {
      projects: projects.length,
      tasks: tasks.length
    },
    snapshot: rollbackSnapshot
  };
  state.onboarding = {
    ...state.onboarding,
    sampleMode: "import",
    dismissed: false
  };
  addAuditEvent({
    action: "switcher_import",
    detail: `Imported ${tasks.length} tasks from ${preview.source}`,
    targetType: "import",
    targetId: preview.id,
    impact: "medium",
    reversible: true,
    restoreHint: "Use Rollback Last Import from Data or restore the pre-import backup.",
    metadata: {
      mode: preview.mode,
      backupId: backup.id,
      projects: projects.length,
      tasks: tasks.length
    }
  });
  saveState();
  render();
  return { projects: projects.length, tasks: tasks.length };
}

function applySwitcherPreviewAsWorkspace(preview, backup) {
  const workspaceName = `${preview.source} Import`;
  const workspaceId = uniqueWorkspaceId(workspaceName);
  const now = new Date().toISOString();
  const companyId = state.filters.company !== "all" ? state.filters.company : state.companies[0]?.id || seedData.companies[0]?.id || "";
  const base = structuredClone(seedData);
  const importCompany = byId(state.companies, companyId) || base.companies[0] || seedData.companies[0];
  const companies = importCompany ? [normalizeCompanyRecord({
    ...importCompany,
    id: companyId || importCompany.id || "company-import",
    name: importCompany.name || `${preview.source} Import`
  })] : [];
  const projects = preview.projects.map((project) => normalizeProjectRecord({
    ...project,
    companyId: companyId || project.companyId
  }));
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = preview.tasks
    .filter((task) => projectIds.has(task.projectId))
    .map(normalizeTaskRecord);

  workspaceRegistry = normalizeWorkspaceRegistry([
    {
      id: workspaceId,
      name: workspaceName,
      slug: slugFromName(workspaceName),
      status: "active",
      template: "import",
      createdAt: now,
      updatedAt: now
    },
    ...workspaceRegistry
  ]);
  saveWorkspaceRegistry();
  activeWorkspaceId = workspaceId;
  saveActiveWorkspaceId(activeWorkspaceId);
  state = normalizeState({
    ...base,
    selectedRoute: "dashboard",
    selectedProject: "all",
    selectedCompany: "all",
    filters: { ...base.filters },
    workspace: {
      ...base.workspace,
      id: workspaceId,
      name: workspaceName,
      slug: slugFromName(workspaceName)
    },
    companies,
    projects,
    tasks,
    comments: [],
    activities: [],
    documents: [],
    files: [],
    approvals: [],
    timeEntries: [],
    switcherImportPreview: null,
    switcherImportRollback: null,
    onboarding: {
      ...base.onboarding,
      dismissed: false,
      sampleMode: "import",
      completedAt: ""
    },
    auditEvents: [
      {
        id: uid("audit"),
        actorId: activeMemberId(),
        action: "switcher_import_workspace",
        detail: `Created import workspace from ${preview.source}`,
        source: "local",
        targetType: "import",
        targetId: preview.id,
        impact: "medium",
        reversible: true,
        restoreHint: "Switch workspaces or restore the source workspace backup if needed.",
        metadata: {
          backupId: backup.id,
          projects: projects.length,
          tasks: tasks.length
        },
        createdAt: now
      }
    ]
  });
  resetWorkspaceViewState();
  saveState();
  render();
  return { projects: projects.length, tasks: tasks.length };
}

function rollbackLastSwitcherImport() {
  const rollback = normalizeSwitcherImportRollback(state.switcherImportRollback);
  if (!rollback) {
    showToast("No import rollback is available", "info");
    return;
  }
  state = normalizeState({
    ...rollback.snapshot,
    switcherImportRollback: null,
    switcherImportPreview: null
  });
  addAuditEvent({
    action: "switcher_import_rollback",
    detail: `Rolled back ${rollback.source} import`,
    targetType: "import",
    targetId: rollback.id,
    impact: "medium",
    reversible: false,
    restoreHint: "The workspace was restored to the pre-import snapshot.",
    metadata: {
      projects: rollback.stats.projects,
      tasks: rollback.stats.tasks
    }
  });
  saveState();
  render();
  showToast("Last import rolled back", "success");
}

function clearSwitcherImportPreview() {
  state.switcherImportPreview = null;
  saveState();
  renderDataManagement();
  showToast("Import preview cleared", "info");
}

function uniqueImportedId(base, collection) {
  const existing = new Set(collection.map((item) => item.id));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function importMemberId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return workspaceMembers().find((member) => member.id === normalized || member.name.toLowerCase() === normalized || member.email?.toLowerCase() === normalized)?.id || activeMemberId();
}

function importStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["done", "complete", "completed", "closed", "resolved"].includes(normalized)) return "done";
  if (["doing", "in progress", "in_progress", "active", "working"].includes(normalized)) return "doing";
  if (["review", "qa", "blocked review"].includes(normalized)) return "review";
  return "todo";
}

function importPriority(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["urgent", "critical", "highest", "p0"].includes(normalized)) return "urgent";
  if (["high", "p1"].includes(normalized)) return "high";
  if (["low", "minor", "p3"].includes(normalized)) return "low";
  return "normal";
}

function importDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
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
    await refreshBackendHealth({ silent: true });
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
    await refreshBackendHealth({ silent: true });
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
    await refreshBackendHealth({ silent: true });
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
    await refreshBackendHealth({ silent: true });
    render();
    showToast(`Signed in as ${session.user.name}`, "success");
  } catch (error) {
    showToast(`Password sign in failed: ${error.message}`, "info");
  }
}

async function signUpWithSupabasePassword() {
  const name = document.querySelector("#api-account-name")?.value.trim();
  const email = document.querySelector("#api-email")?.value.trim();
  const password = document.querySelector("#api-password")?.value;
  if (!email || !password) {
    showToast("Enter email and password for Supabase sign up", "info");
    return;
  }

  try {
    const health = await apiRequest("/api/health");
    const result = await apiRequest("/api/auth/supabase-password-signup", {
      method: "POST",
      body: {
        name,
        email,
        password
      }
    });
    if (result.pendingConfirmation) {
      showToast("Supabase account created. Confirm your email, then sign in.", "success");
      return;
    }
    saveApiSession({
      ...result,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    await refreshBackendHealth({ silent: true });
    render();
    showToast(`Signed up with Supabase as ${result.user.name}`, "success");
  } catch (error) {
    showToast(`Supabase sign up failed: ${error.message}`, "info");
  }
}

async function signInWithSupabasePassword() {
  const email = document.querySelector("#api-email")?.value.trim();
  const password = document.querySelector("#api-password")?.value;
  if (!email || !password) {
    showToast("Enter email and password for Supabase sign in", "info");
    return;
  }

  try {
    const health = await apiRequest("/api/health");
    const session = await apiRequest("/api/auth/supabase-password-login", {
      method: "POST",
      body: { email, password }
    });
    saveApiSession({
      ...session,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    await refreshBackendHealth({ silent: true });
    render();
    showToast(`Signed in with Supabase as ${session.user.name}`, "success");
  } catch (error) {
    showToast(`Supabase sign in failed: ${error.message}`, "info");
  }
}

async function changeApiPassword() {
  if (!apiSession) {
    showToast("Sign in before changing your password", "info");
    return;
  }
  const currentPassword = document.querySelector("#api-current-password")?.value || "";
  const newPassword = document.querySelector("#api-new-password")?.value || "";
  if (!currentPassword || !newPassword) {
    showToast("Enter current and new password", "info");
    return;
  }

  try {
    await apiRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword }
    });
    render();
    showToast("Password changed", "success");
  } catch (error) {
    showToast(`Password change failed: ${error.message}`, "info");
  }
}

async function requestApiPasswordReset() {
  const email = document.querySelector("#api-reset-email")?.value.trim() || document.querySelector("#api-email")?.value.trim() || "";
  if (!email) {
    showToast("Enter the account email first", "info");
    return;
  }

  try {
    const result = await apiRequest("/api/auth/password-reset/request", {
      method: "POST",
      body: { email }
    });
    const tokenInput = document.querySelector("#api-reset-token");
    if (result.resetToken && tokenInput) tokenInput.value = result.resetToken;
    showToast(result.resetToken ? "Reset token generated" : "Reset requested. Check your configured delivery path.", "success");
  } catch (error) {
    showToast(`Reset request failed: ${error.message}`, "info");
  }
}

async function confirmApiPasswordReset() {
  const email = document.querySelector("#api-reset-email")?.value.trim() || document.querySelector("#api-email")?.value.trim() || "";
  const token = document.querySelector("#api-reset-token")?.value.trim() || "";
  const password = document.querySelector("#api-reset-password")?.value || "";
  if (!email || !token || !password) {
    showToast("Enter email, reset token, and new password", "info");
    return;
  }

  try {
    await apiRequest("/api/auth/password-reset/confirm", {
      method: "POST",
      body: { email, token, password }
    });
    render();
    showToast("Password reset complete", "success");
  } catch (error) {
    showToast(`Reset failed: ${error.message}`, "info");
  }
}

async function signInWithSupabaseToken() {
  const accessToken = document.querySelector("#api-supabase-token")?.value.trim();
  if (!accessToken) {
    showToast("Paste a Supabase access token", "info");
    return;
  }

  try {
    const health = await apiRequest("/api/health");
    const session = await apiRequest("/api/auth/supabase-login", {
      method: "POST",
      body: { accessToken }
    });
    saveApiSession({
      ...session,
      apiHealth: health,
      storageDriver: health.storage
    });
    await syncAccessFromApi();
    await refreshBackendHealth({ silent: true });
    render();
    showToast(`Connected with Supabase Auth as ${session.user.name}`, "success");
  } catch (error) {
    showToast(`Supabase auth failed: ${error.message}`, "info");
  }
}

function disconnectApiSession() {
  clearApiSession();
  render();
  showToast("API session disconnected", "success");
}

function persistApiBaseUrl(rawUrl) {
  if (!rawUrl) {
    showToast("API URL is required", "info");
    return;
  }

  try {
    const url = new URL(rawUrl);
    const normalizedUrl = url.origin.replace(/\/+$/, "");
    storageSet("agora.api.baseUrl", normalizedUrl);
    showToast("API URL saved. Reloading Agora.", "success");
    window.setTimeout(() => window.location.reload(), 400);
  } catch (error) {
    showToast("Enter a valid API URL, like http://127.0.0.1:8787", "info");
  }
}

function saveApiBaseUrl() {
  persistApiBaseUrl(document.querySelector("#api-base-url")?.value.trim() || "");
}

async function syncAccessFromApi(options = {}) {
  if (!apiSession) return;

  const access = await apiRequest("/api/members");
  state.users = Array.isArray(access.users)
    ? access.users.filter((user) => !members.some((member) => member.id === user.id))
    : state.users;
  state.memberships = Array.isArray(access.memberships) ? access.memberships : state.memberships;
  state.invitations = Array.isArray(access.invitations) ? access.invitations : state.invitations;
  saveState();
  if (options.includeWorkspaceRecords === false) return;
  await loadCoreRecordsFromApi();
  await loadStructuredRecordsFromApi();
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
    addAuditEvent({
      action: "member_invite",
      detail: `Invited ${invitation.email} as ${invitation.role || role}`
    });
    saveState();
    render();
    showToast(`Invite created for ${invitation.email}`, "success");
  } catch (error) {
    showToast(`Invite failed: ${error.message}`, "info");
  }
}

async function resendWorkspaceInvite(invitationId) {
  if (!apiSession) {
    showToast("Connect to the API before resending invites", "info");
    return;
  }

  try {
    const result = await apiRequest(`/api/invitations/${encodeURIComponent(invitationId)}/resend`, {
      method: "POST"
    });
    const invitation = result.invitation;
    state.invitations = [
      invitation,
      ...state.invitations.filter((item) => item.id !== invitation.id)
    ];
    addAuditEvent({
      action: "member_invite_resend",
      detail: `Resent invite to ${invitation.email}`
    });
    saveState();
    render();
    showToast(`Invite refreshed for ${invitation.email}`, "success");
  } catch (error) {
    showToast(`Invite resend failed: ${error.message}`, "info");
  }
}

async function revokeWorkspaceInvite(invitationId) {
  if (!apiSession) {
    showToast("Connect to the API before revoking invites", "info");
    return;
  }

  try {
    const result = await apiRequest(`/api/invitations/${encodeURIComponent(invitationId)}`, {
      method: "DELETE"
    });
    const invitation = result.invitation;
    state.invitations = state.invitations.map((item) => item.id === invitation.id ? invitation : item);
    addAuditEvent({
      action: "member_invite_revoke",
      detail: `Revoked invite to ${invitation.email}`
    });
    saveState();
    render();
    showToast(`Invite revoked for ${invitation.email}`, "success");
  } catch (error) {
    showToast(`Invite revoke failed: ${error.message}`, "info");
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
    await refreshBackendHealth({ silent: true });
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
  if (!canSaveWholeWorkspace()) {
    if (!options.silent) showToast("Company-scoped sessions save through project, task, and record updates", "info");
    return;
  }

  try {
    const document = await apiRequest("/api/workspace", {
      method: "PUT",
      body: { snapshot: workspaceSnapshot() }
    });
    saveApiSession({ ...apiSession, lastSyncedAt: document.metadata.updatedAt, storageDriver: document.metadata.storage || apiSession.storageDriver });
    await refreshBackendHealth({ silent: true });
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
    let changed = await loadCoreRecordsFromApi();
    changed = await loadStructuredRecordsFromApi() || changed;
    saveApiSession({ ...apiSession, lastSyncedAt: new Date().toISOString() });
    await refreshBackendHealth({ silent: true });
    render();
    showToast(changed ? "Records loaded from API" : "API records are already current", "success");
  } catch (error) {
    showToast(`API record load failed: ${error.message}`, "info");
  }
}

async function restoreWorkspaceSnapshotFromApi() {
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
    saveWorkspaceBackups([workspaceBackupRecord("Before API restore"), ...loadWorkspaceBackups()]);
    applyWorkspaceSnapshot(document.snapshot);
    await loadCoreRecordsFromApi();
    await loadStructuredRecordsFromApi();
    saveApiSession({ ...apiSession, lastSyncedAt: document.metadata.updatedAt, storageDriver: document.metadata.storage || apiSession.storageDriver });
    await refreshBackendHealth({ silent: true });
    render();
    showToast("Workspace snapshot restored from API", "success");
  } catch (error) {
    showToast(`API snapshot restore failed: ${error.message}`, "info");
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
    await refreshBackendHealth({ silent: true });
    render();
    showToast("JSON imported to API", "success");
  } catch (error) {
    showToast(`API import failed: ${error.message}`, "info");
  }
}

async function syncProjectToApi(project, action = "Project synced", isNew = false, baseRevision = "") {
  if (!apiSession) return;

  try {
    const result = await apiRequest(isNew ? "/api/projects" : `/api/projects/${encodeURIComponent(project.id)}`, {
      method: isNew ? "POST" : "PUT",
      body: { project }
    });
    if (result.project && mergeCoreRecordsFromApi({ projects: [result.project] })) {
      saveState();
      render();
    }
    showToast(action, "success");
  } catch (error) {
    queueApiSyncFailure({
      label: action,
      path: isNew ? "/api/projects" : `/api/projects/${encodeURIComponent(project.id)}`,
      method: isNew ? "POST" : "PUT",
      body: { project },
      baseRevision,
      error: error.message
    });
    showToast(`Local change saved. API project sync failed: ${error.message}`, "info");
  }
}

async function syncTaskToApi(task, action = "Task synced", isNew = false, baseRevision = "") {
  if (!apiSession) return;

  try {
    const result = await apiRequest(isNew ? "/api/tasks" : `/api/tasks/${encodeURIComponent(task.id)}`, {
      method: isNew ? "POST" : "PUT",
      body: { task }
    });
    if (result.task && mergeCoreRecordsFromApi({ tasks: [result.task] })) {
      saveState();
      render();
    }
    showToast(action, "success");
  } catch (error) {
    queueApiSyncFailure({
      label: action,
      path: isNew ? "/api/tasks" : `/api/tasks/${encodeURIComponent(task.id)}`,
      method: isNew ? "POST" : "PUT",
      body: { task },
      baseRevision,
      error: error.message
    });
    showToast(`Local change saved. API task sync failed: ${error.message}`, "info");
  }
}

async function syncFeatureRequestToApi(task, request) {
  if (!apiSession) return;

  try {
    const result = await apiRequest("/api/feature-requests", {
      method: "POST",
      body: { task, request }
    });
    if (result.task && mergeCoreRecordsFromApi({ tasks: [result.task] })) {
      saveState();
      render();
    }
    if (result.email?.delivered) {
      showToast("Feature request emailed", "success");
    } else if (result.email?.queued) {
      showToast("Feature request email queued", "success");
    } else {
      showToast("Feature request saved. Email delivery is not configured.", "info");
    }
  } catch (error) {
    queueApiSyncFailure({
      label: "Feature request",
      path: "/api/feature-requests",
      method: "POST",
      body: { task, request },
      error: error.message
    });
    showToast(`Feature request saved locally. Email/API sync failed: ${error.message}`, "info");
  }
}

function updateFeatureRequestStatus(taskId, featureStatus) {
  const task = byId(state.tasks, taskId);
  if (!task || !isFeatureRequestTask(task)) return;
  updateTask(taskId, {
    customFields: {
      ...(task.customFields || {}),
      featureStatus
    }
  });
}

async function sendFeatureRequestUpdate(taskId) {
  const task = byId(state.tasks, taskId);
  if (!task || !isFeatureRequestTask(task)) return;
  const requesterEmail = task.customFields?.requesterEmail || "";
  if (!requesterEmail) {
    showToast("This request does not have a requester email", "info");
    return;
  }
  if (!apiSession) {
    showToast("Connect the API before emailing requester updates", "info");
    return;
  }

  const note = Array.from(document.querySelectorAll("[data-feature-update-note]"))
    .find((input) => input.dataset.featureUpdateNote === taskId)
    ?.value.trim() || "";
  const featureStatus = featureRequestStatus(task);
  try {
    const result = await apiRequest(`/api/feature-requests/${encodeURIComponent(taskId)}/updates`, {
      method: "POST",
      body: { featureStatus, note }
    });
    if (result.task && mergeCoreRecordsFromApi({ tasks: [result.task] })) {
      saveState();
      render();
    }
    showToast(result.email?.delivered || result.email?.queued ? "Requester update email queued" : "Requester update saved. Email delivery is not configured.", result.email?.delivered || result.email?.queued ? "success" : "info");
  } catch (error) {
    showToast(`Requester update failed: ${error.message}`, "info");
  }
}

async function copyFeatureRequestLink() {
  if (!navigator.clipboard?.writeText) {
    showToast("Clipboard is not available in this browser", "info");
    return;
  }
  await navigator.clipboard.writeText(featureRequestPublicLink());
  showToast("Feature request link copied", "success");
}

async function submitPublicFeatureRequest() {
  const title = document.querySelector("#public-feature-title")?.value.trim() || "";
  const projectId = document.querySelector("#public-feature-project")?.value || "";
  if (!title || !projectId) {
    showToast("Feature requests need a title and project", "info");
    return;
  }

  try {
    const result = await apiRequest("/api/public/feature-requests", {
      method: "POST",
      body: {
        title,
        projectId,
        details: document.querySelector("#public-feature-details")?.value.trim() || "",
        requester: document.querySelector("#public-feature-requester")?.value.trim() || "",
        email: document.querySelector("#public-feature-email")?.value.trim() || "",
        impact: document.querySelector("#public-feature-impact")?.value || "nice-to-have",
        website: document.querySelector("#public-feature-website")?.value || ""
      }
    });
    document.querySelector("#public-feature-request-form")?.reset();
    showToast(result.email?.delivered || result.email?.queued ? "Feature request sent and email queued" : "Feature request sent to the board", "success");
  } catch (error) {
    showToast(`Feature request failed: ${error.message}`, "info");
  }
}

async function syncTaskArchiveToApi(taskId) {
  if (!apiSession) return;

  try {
    const result = await apiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE"
    });
    if (result.task && mergeCoreRecordsFromApi({ tasks: [result.task] })) {
      saveState();
      render();
    }
    showToast("Task archive synced to API", "success");
  } catch (error) {
    queueApiSyncFailure({
      label: "Task archive",
      path: `/api/tasks/${encodeURIComponent(taskId)}`,
      method: "DELETE",
      body: {},
      error: error.message
    });
    showToast(`Local change saved. API task archive failed: ${error.message}`, "info");
  }
}

async function syncProjectArchiveToApi(projectId) {
  if (!apiSession) return;

  try {
    const result = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE"
    });
    if (result.project && mergeCoreRecordsFromApi({ projects: [result.project] })) {
      saveState();
      render();
    }
    showToast("Project archive synced to API", "success");
  } catch (error) {
    queueApiSyncFailure({
      label: "Project archive",
      path: `/api/projects/${encodeURIComponent(projectId)}`,
      method: "DELETE",
      body: {},
      error: error.message
    });
    showToast(`Local change saved. API project archive failed: ${error.message}`, "info");
  }
}

async function syncRecordToApi(collection, record, action = "Record synced", showSuccess = true) {
  if (!apiSession) return;

  try {
    const result = await apiRequest(`/api/records/${encodeURIComponent(collection)}`, {
      method: "POST",
      body: { record }
    });
    if (result.record) {
      mergeCollectionFromApi(collection, [result.record]);
      saveState();
      const openTaskId = document.querySelector("#task-dialog[open] #task-id")?.value || "";
      if (openTaskId && ["comments", "activities", "timeEntries", "presence"].includes(collection)) {
        renderTaskCollaboration(openTaskId);
        renderTaskTimeTracking(openTaskId);
      }
    }
    if (showSuccess) showToast(action, "success");
  } catch (error) {
    queueApiSyncFailure({
      label: action,
      path: `/api/records/${encodeURIComponent(collection)}`,
      method: "POST",
      body: { record },
      error: error.message
    });
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

async function runServerNotificationScheduler() {
  if (!apiSession) {
    showToast("Connect to the API before running the server scheduler", "info");
    return;
  }
  if (!canWrite("scheduler:run")) {
    showToast("Your role cannot run the server scheduler", "info");
    return;
  }
  try {
    const result = await apiRequest("/api/scheduler/notifications/run", {
      method: "POST"
    });
    let changed = false;
    if (Array.isArray(result.reminders)) {
      changed = mergeCollectionFromApi("notificationReminders", result.reminders) || changed;
    }
    if (Array.isArray(result.history)) {
      changed = mergeCollectionFromApi("notificationHistory", result.history) || changed;
    }
    if (changed) {
      markRealtimeChanged();
      saveState();
      render();
    }
    showToast(result.processed ? `Server scheduler processed ${result.processed} reminder${result.processed === 1 ? "" : "s"}` : "No due reminders on the server", result.processed ? "success" : "info");
  } catch (error) {
    showToast(`Server scheduler failed: ${error.message}`, "info");
  }
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

function handleNetworkOnline() {
  const wasOffline = !networkOnline;
  networkOnline = true;
  if (!wasOffline) return;

  render();
  showToast(apiSyncQueue.length && apiSession ? "Back online. Retrying queued changes." : "Back online", "success");
  if (apiSession) startRealtimeEvents();
  if (apiSession && apiSyncQueue.length) {
    retryApiSyncQueue();
  } else if (apiSession) {
    refreshBackendHealth({ silent: true }).then(() => render()).catch(() => {});
  }
}

function handleNetworkOffline() {
  if (!networkOnline) return;
  networkOnline = false;
  stopRealtimeEvents();
  render();
  showToast("Agora is offline. Keep working; local changes stay on this device.", "info");
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
  logNotificationHistory({
    kind: "browser-test",
    title,
    message: options.body,
    reason: "Manual browser notification test.",
    channel: "browser"
  });
  saveState();
  render();
  showToast("Test notification sent", "success");
}

function updateNotificationEventPreference(eventType, enabled) {
  if (!canWrite("notifications:write")) {
    showToast("Your role cannot manage notification settings", "info");
    render();
    return;
  }
  const settings = notificationSettings();
  state.notificationSettings = {
    ...settings,
    events: {
      ...settings.events,
      [eventType]: enabled
    }
  };
  syncNotificationSettingsToApi();
  saveState();
  render();
  showToast(`${enabled ? "Enabled" : "Muted"} ${eventType} notifications`, "success");
}

function updateDigestPreference(digestId, enabled) {
  if (!canWrite("notifications:write")) {
    showToast("Your role cannot manage notification digests", "info");
    render();
    return;
  }
  const settings = notificationSettings();
  state.notificationSettings = {
    ...settings,
    digests: {
      ...settings.digests,
      [digestId]: enabled
    }
  };
  syncNotificationSettingsToApi();
  saveState();
  render();
  showToast(`${enabled ? "Enabled" : "Paused"} digest`, "success");
}

function updateNotificationChannel(channelId, enabled) {
  if (!canWrite("notifications:write")) {
    showToast("Your role cannot manage notification channels", "info");
    render();
    return;
  }
  const settings = notificationSettings();
  state.notificationSettings = {
    ...settings,
    channels: {
      ...settings.channels,
      [channelId]: enabled
    }
  };
  syncNotificationSettingsToApi();
  saveState();
  render();
  showToast(`${enabled ? "Enabled" : "Disabled"} ${channelId} alerts`, "success");
}

function updateNotificationCadence(cadence) {
  if (!canWrite("notifications:write")) {
    showToast("Your role cannot manage notification cadence", "info");
    render();
    return;
  }
  const settings = notificationSettings();
  state.notificationSettings = {
    ...settings,
    cadence: ["daily", "weekly", "manual"].includes(cadence) ? cadence : settings.cadence
  };
  syncNotificationSettingsToApi();
  saveState();
  render();
  showToast("Digest cadence updated", "success");
}

function saveNotificationDeliverySettings() {
  if (!canWrite("notifications:write")) {
    showToast("Your role cannot manage notification delivery", "info");
    return;
  }
  const settings = notificationSettings();
  const webhookUrl = document.querySelector("#notification-webhook-url")?.value.trim() || "";
  const emailAddress = document.querySelector("#notification-email-address")?.value.trim() || "";
  const sendResolved = Boolean(document.querySelector("#notification-send-resolved")?.checked);
  state.notificationSettings = {
    ...settings,
    delivery: {
      ...settings.delivery,
      webhookUrl,
      emailAddress,
      sendResolved
    }
  };
  addAuditEvent({
    action: "notification_delivery_update",
    detail: `Updated notification delivery channels: ${notificationDeliveryChannels(state.notificationSettings)}`
  });
  syncNotificationSettingsToApi();
  saveState();
  render();
  showToast("Delivery settings saved", "success");
}

function runNotificationDigest(digestId) {
  const row = notificationDigestRows().find((digest) => digest.id === digestId);
  if (!row || !row.enabled) {
    showToast("Digest is paused", "info");
    return;
  }
  const settings = notificationSettings();
  const channels = notificationDeliveryChannels(settings);
  logNotificationHistory({
    kind: "digest",
    title: row.title,
    message: row.message,
    reason: `${settings.cadence} digest: ${row.reason}`,
    count: row.count,
    channel: channels
  });
  if (settings.channels.browser && notificationPermissionState === "granted") {
    const options = {
      body: row.message,
      icon: "./assets/agora-mark.svg",
      badge: "./assets/agora-mark.svg"
    };
    navigator.serviceWorker?.getRegistration?.().then((registration) => {
      if (registration?.showNotification) registration.showNotification(row.title, options);
      else new Notification(row.title, options);
    });
  }
  if (settings.channels.webhook && settings.delivery.webhookUrl) {
    logNotificationHistory({
      kind: "webhook-preview",
      title: row.title,
      message: `Prepared digest payload for ${settings.delivery.webhookUrl}.`,
      reason: "Copy Payload shows the exact JSON body to POST from a server integration.",
      count: row.count,
      channel: "webhook preview"
    });
  }
  if (settings.channels.email && settings.delivery.emailAddress) {
    logNotificationHistory({
      kind: "email-handoff",
      title: row.title,
      message: `Prepared email handoff for ${settings.delivery.emailAddress}.`,
      reason: "Agora stores the handoff locally until a mail provider is connected.",
      count: row.count,
      channel: "email handoff"
    });
  }
  saveState();
  render();
  showToast("Digest sent to notification history", "success");
}

document.addEventListener("click", (event) => {
  const toastDismissButton = event.target.closest("[data-toast-dismiss]");
  if (toastDismissButton) {
    dismissToast(toastDismissButton.dataset.toastDismiss);
    return;
  }

  const searchResult = event.target.closest("[data-search-route]");
  if (searchResult) {
    openSearchResult(searchResult);
    return;
  }

  if (!event.target.closest(".search-control") && !event.target.closest("#search-results") && els.searchResults) {
    els.searchResults.hidden = true;
  }

  const sidebarToggle = event.target.closest("[data-sidebar-toggle]");
  if (sidebarToggle) {
    const groupId = sidebarToggle.dataset.sidebarToggle;
    sidebarState[groupId] = !sidebarState[groupId];
    saveSidebarState();
    renderSidebarGroups();
    return;
  }

  const settingsTabButton = event.target.closest("[data-settings-tab]");
  if (settingsTabButton && !settingsTabButton.disabled) {
    state.selectedSettingsTab = settingsTabFallback(settingsTabButton.dataset.settingsTab);
    saveState();
    render();
    return;
  }

  const openSettingsTabButton = event.target.closest("[data-open-settings-tab]");
  if (openSettingsTabButton) {
    state.selectedRoute = "settings";
    state.selectedSettingsTab = settingsTabFallback(openSettingsTabButton.dataset.openSettingsTab);
    openSidebarGroupForRoute("settings");
    saveState();
    render();
    return;
  }

  const onboardingActionButton = event.target.closest("[data-onboarding-action]");
  if (onboardingActionButton) {
    handleOnboardingAction(onboardingActionButton.dataset.onboardingAction);
    return;
  }

  const onboardingStepButton = event.target.closest("[data-onboarding-step]");
  if (onboardingStepButton) {
    openOnboardingWizard(Number(onboardingStepButton.dataset.onboardingStep));
    return;
  }

  const onboardingInlineButton = event.target.closest("[data-onboarding-inline]");
  if (onboardingInlineButton) {
    handleOnboardingInlineAction(onboardingInlineButton.dataset.onboardingInline);
    return;
  }

  const tutorialActionButton = event.target.closest("[data-tutorial-action]");
  if (tutorialActionButton) {
    handleTutorialAction(tutorialActionButton.dataset.tutorialAction);
    return;
  }

  const commandButton = event.target.closest("[data-command-id]");
  if (commandButton) {
    executeCommand(commandButton.dataset.commandId);
    return;
  }

  const openCommandPaletteButton = event.target.closest("#open-command-palette");
  if (openCommandPaletteButton) {
    openCommandPalette();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) setRoute(routeButton.dataset.route);

  const createDocButton = event.target.closest("#doc-create");
  if (createDocButton) createDocument();

  const createFileButton = event.target.closest("#file-create");
  if (createFileButton) createFileRecord();

  const downloadFileButton = event.target.closest("[data-file-download]");
  if (downloadFileButton) {
    downloadFileFromApi(downloadFileButton.dataset.fileDownload);
    return;
  }

  const submitIntakeButton = event.target.closest("[data-submit-intake]");
  if (submitIntakeButton) submitIntakeRequest(submitIntakeButton.dataset.submitIntake);

  const copyFeatureLinkButton = event.target.closest("#copy-feature-request-link");
  if (copyFeatureLinkButton) {
    copyFeatureRequestLink();
    return;
  }

  const inlineFeatureButton = event.target.closest("#feature-request-button-inline");
  if (inlineFeatureButton) {
    openFeatureRequestDialog();
    return;
  }

  const featureUpdateButton = event.target.closest("[data-feature-email-update]");
  if (featureUpdateButton) {
    sendFeatureRequestUpdate(featureUpdateButton.dataset.featureEmailUpdate);
    return;
  }

  const convertSubmissionButton = event.target.closest("[data-convert-submission]");
  if (convertSubmissionButton) convertSubmissionToTask(convertSubmissionButton.dataset.convertSubmission);

  const createFieldButton = event.target.closest("#field-create");
  if (createFieldButton) createCustomField();

  const copyStatusReportButton = event.target.closest("#copy-status-report");
  if (copyStatusReportButton) copyStatusReport();

  const copyPortalPacketButton = event.target.closest("[data-copy-portal-packet]");
  if (copyPortalPacketButton) {
    copyPortalSharePacket(copyPortalPacketButton.dataset.copyPortalPacket);
    return;
  }

  const dashboardSaveLayoutButton = event.target.closest("#dashboard-save-layout");
  if (dashboardSaveLayoutButton) {
    saveDashboardLayout();
    return;
  }

  const dashboardSaveNamedLayoutButton = event.target.closest("#dashboard-save-named-layout");
  if (dashboardSaveNamedLayoutButton) {
    saveNamedDashboardLayout();
    return;
  }

  const dashboardApplyLayoutButton = event.target.closest("#dashboard-apply-layout");
  if (dashboardApplyLayoutButton) {
    applyDashboardLayout();
    return;
  }

  const chatSendButton = event.target.closest("#chat-send");
  if (chatSendButton) {
    sendWorkspaceChatMessage();
    return;
  }

  const whiteboardAddButton = event.target.closest("#whiteboard-add-note");
  if (whiteboardAddButton) {
    addWhiteboardNote();
    return;
  }

  const installMarketplaceTemplateButton = event.target.closest("[data-install-marketplace-template]");
  if (installMarketplaceTemplateButton) {
    installMarketplaceTemplate(installMarketplaceTemplateButton.dataset.installMarketplaceTemplate);
    return;
  }

  const grantTemplateEntitlementButton = event.target.closest("[data-grant-template-entitlement]");
  if (grantTemplateEntitlementButton) {
    grantMarketplaceTemplateEntitlement(grantTemplateEntitlementButton.dataset.grantTemplateEntitlement, "test");
    return;
  }

  const exportMarketplaceTemplateButton = event.target.closest("[data-export-marketplace-template]");
  if (exportMarketplaceTemplateButton) {
    downloadProjectTemplate(exportMarketplaceTemplateButton.dataset.exportMarketplaceTemplate);
    return;
  }

  const exportProjectTemplateButton = event.target.closest("[data-export-project-template]");
  if (exportProjectTemplateButton) {
    downloadProjectTemplate(exportProjectTemplateButton.dataset.exportProjectTemplate);
    return;
  }

  const importTemplateButton = event.target.closest("#template-import-button");
  if (importTemplateButton) {
    importProjectTemplateFromTextarea();
    return;
  }

  const previewTemplateImportButton = event.target.closest("#template-import-preview");
  if (previewTemplateImportButton) {
    previewProjectTemplateImportPayload();
    return;
  }

  const templateCategoryButton = event.target.closest("[data-template-category]");
  if (templateCategoryButton) {
    state.templateLibrary = {
      ...(state.templateLibrary || {}),
      category: templateCategoryButton.dataset.templateCategory || "all",
      selectedProjectTemplateId: ""
    };
    saveState();
    render();
    return;
  }

  const previewProjectTemplateButton = event.target.closest("[data-preview-project-template]");
  if (previewProjectTemplateButton) {
    state.templateLibrary = {
      ...(state.templateLibrary || {}),
      selectedProjectTemplateId: previewProjectTemplateButton.dataset.previewProjectTemplate
    };
    saveState();
    render();
    return;
  }

  const templatePreviewCreateButton = event.target.closest("#template-preview-create");
  if (templatePreviewCreateButton) {
    createProjectFromPreview();
    return;
  }

  const useProjectTemplateButton = event.target.closest("[data-use-project-template]");
  if (useProjectTemplateButton) {
    createProjectTemplateFromButton(useProjectTemplateButton);
    return;
  }

  const useTaskTemplateButton = event.target.closest("[data-use-task-template]");
  if (useTaskTemplateButton) {
    createTaskTemplateFromButton(useTaskTemplateButton);
    return;
  }

  const createProjectTemplateButton = event.target.closest("#project-template-create");
  if (createProjectTemplateButton) {
    saveProjectAsTemplate();
    return;
  }

  const createTaskTemplateButton = event.target.closest("#task-template-create");
  if (createTaskTemplateButton) {
    saveTaskAsTemplate();
    return;
  }

  const deleteProjectTemplateButton = event.target.closest("[data-delete-project-template]");
  if (deleteProjectTemplateButton) {
    deleteProjectTemplate(deleteProjectTemplateButton.dataset.deleteProjectTemplate);
    return;
  }

  const deleteTaskTemplateButton = event.target.closest("[data-delete-task-template]");
  if (deleteTaskTemplateButton) {
    deleteTaskTemplate(deleteTaskTemplateButton.dataset.deleteTaskTemplate);
    return;
  }

  const templateSubmissionButton = event.target.closest("[data-template-submission]");
  if (templateSubmissionButton) createProjectFromSubmission(templateSubmissionButton.dataset.templateSubmission);

  const runAutomationButton = event.target.closest("[data-run-automation]");
  if (runAutomationButton) runAutomation(runAutomationButton.dataset.runAutomation);

  const rollbackAutomationButton = event.target.closest("[data-automation-rollback]");
  if (rollbackAutomationButton) {
    rollbackAutomationRun(rollbackAutomationButton.dataset.automationRollback);
    return;
  }

  const toggleAutomationButton = event.target.closest("[data-toggle-automation]");
  if (toggleAutomationButton) toggleAutomation(toggleAutomationButton.dataset.toggleAutomation);

  const installAutomationPackButton = event.target.closest("[data-install-automation-pack]");
  if (installAutomationPackButton) {
    installAutomationMarketplacePack(installAutomationPackButton.dataset.installAutomationPack);
    return;
  }

  const exportAutomationPackButton = event.target.closest("[data-export-automation-pack]");
  if (exportAutomationPackButton) {
    exportAutomationMarketplacePack(exportAutomationPackButton.dataset.exportAutomationPack);
    return;
  }

  const marketplaceApiPublishButton = event.target.closest("#marketplace-api-publish");
  if (marketplaceApiPublishButton) {
    publishMarketplaceCatalogToApi();
    return;
  }

  const marketplaceApiLoadButton = event.target.closest("#marketplace-api-load");
  if (marketplaceApiLoadButton) {
    loadMarketplaceCatalogFromApi();
    return;
  }

  const automationPackImportPreviewButton = event.target.closest("#automation-pack-import-preview");
  if (automationPackImportPreviewButton) {
    previewAutomationPackImportPayload();
    return;
  }

  const automationPackImportInstallButton = event.target.closest("#automation-pack-import-install");
  if (automationPackImportInstallButton) {
    installAutomationPackImportPayload();
    return;
  }

  const automationPackSelectAllButton = event.target.closest("#automation-pack-select-all");
  if (automationPackSelectAllButton) {
    setAutomationPackAuthorSelection(true);
    return;
  }

  const automationPackClearButton = event.target.closest("#automation-pack-clear-selection");
  if (automationPackClearButton) {
    setAutomationPackAuthorSelection(false);
    return;
  }

  const automationPackExportButton = event.target.closest("#automation-pack-export");
  if (automationPackExportButton) {
    exportAuthoredAutomationPack();
    return;
  }

  const saveAutomationButton = event.target.closest("#automation-create");
  if (saveAutomationButton) {
    saveAutomationRule();
    return;
  }

  const editAutomationButton = event.target.closest("[data-edit-automation]");
  if (editAutomationButton) {
    editAutomationRule(editAutomationButton.dataset.editAutomation);
    return;
  }

  const deleteAutomationButton = event.target.closest("[data-delete-automation]");
  if (deleteAutomationButton) {
    deleteAutomationRule(deleteAutomationButton.dataset.deleteAutomation);
    return;
  }

  const runAllAutomationsButton = event.target.closest("#automation-run-all");
  if (runAllAutomationsButton) runAllAutomations();

  const automationSuggestionButton = event.target.closest("[data-automation-suggestion]");
  if (automationSuggestionButton) logAutomationSuggestion(automationSuggestionButton.dataset.automationSuggestion);

  const generateTodayButton = event.target.closest("#ai-generate-today");
  if (generateTodayButton) {
    generateTodayPlan();
    return;
  }

  const workspaceBriefButton = event.target.closest("#ai-workspace-brief");
  if (workspaceBriefButton) {
    generateWorkspaceBrief();
    return;
  }

  const projectBriefButton = event.target.closest("[data-ai-project-brief]");
  if (projectBriefButton) {
    generateProjectBrief(projectBriefButton.dataset.aiProjectBrief);
    return;
  }

  const operatorActionButton = event.target.closest("[data-operator-action]");
  if (operatorActionButton) {
    runOperatorAction(operatorActionButton.dataset.operatorAction, operatorActionButton.dataset.operatorProject);
    return;
  }

  const operatorCommandButton = event.target.closest("[data-operator-command]");
  if (operatorCommandButton) {
    runOperatorCommand(operatorCommandButton.dataset.operatorCommand);
    return;
  }

  const operatorApplyButton = event.target.closest("[data-operator-apply]");
  if (operatorApplyButton) {
    applyOperatorSuggestion(
      operatorApplyButton.dataset.operatorApply,
      operatorApplyButton.dataset.operatorProject,
      operatorApplyButton.dataset.operatorTask || "",
      operatorApplyButton.dataset.operatorApproval || "",
      operatorApplyButton.dataset.operatorCompany || ""
    );
    return;
  }

  const operatorUndoButton = event.target.closest("[data-operator-undo]");
  if (operatorUndoButton) {
    undoOperatorAction(operatorUndoButton.dataset.operatorUndo);
    return;
  }

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
  if (companyUpdateButton) {
    draftCompanyUpdate(companyUpdateButton.dataset.companyUpdate);
    return;
  }

  const workspaceSaveButton = event.target.closest("#workspace-save");
  if (workspaceSaveButton) saveWorkspaceSettings();

  const aiSaveButton = event.target.closest("#ai-save-settings");
  if (aiSaveButton) {
    saveAiSettings();
    return;
  }

  const operatorContextExportButton = event.target.closest("#operator-context-export");
  if (operatorContextExportButton) {
    downloadOperatorContextBundle();
    return;
  }

  const operatorLocalModeButton = event.target.closest("#operator-local-mode");
  if (operatorLocalModeButton) {
    enableLocalOperatorMode();
    return;
  }

  const operatorPermissionPresetButton = event.target.closest("[data-operator-permission-preset]");
  if (operatorPermissionPresetButton) {
    applyOperatorPermissionPreset(operatorPermissionPresetButton.dataset.operatorPermissionPreset);
    return;
  }

  const operatorPermissionsSaveButton = event.target.closest("#operator-permissions-save");
  if (operatorPermissionsSaveButton) {
    saveOperatorPermissions();
    return;
  }

  const integrationsSaveButton = event.target.closest("#integrations-save");
  if (integrationsSaveButton) {
    saveIntegrationSettings();
    return;
  }

  const integrationTestButton = event.target.closest("#integration-test-event");
  if (integrationTestButton) {
    recordIntegrationTestEvent();
    return;
  }

  const paymentsSaveButton = event.target.closest("#payments-save");
  if (paymentsSaveButton) {
    savePaymentSettings();
    return;
  }

  const paymentGrantEntitlementButton = event.target.closest("#payment-grant-entitlement");
  if (paymentGrantEntitlementButton) {
    grantSelectedPaymentEntitlement();
    return;
  }

  const paymentTestButton = event.target.closest("#payment-test-event");
  if (paymentTestButton) {
    recordTestPaymentEvent();
    return;
  }

  const pwaInstallButton = event.target.closest("#pwa-install");
  if (pwaInstallButton) installPwa();

  const notificationRequestButton = event.target.closest("#notification-request");
  if (notificationRequestButton) requestNotificationPermission();

  const notificationTestButton = event.target.closest("#notification-test");
  if (notificationTestButton) sendTestNotification();

  const notificationSaveDeliveryButton = event.target.closest("#notification-save-delivery");
  if (notificationSaveDeliveryButton) {
    saveNotificationDeliverySettings();
    return;
  }

  const notificationReminderCheckButton = event.target.closest("#notification-reminder-check");
  if (notificationReminderCheckButton) {
    runNotificationReminderScheduler({ silent: false });
    return;
  }

  const notificationServerSchedulerButton = event.target.closest("#notification-server-scheduler");
  if (notificationServerSchedulerButton) {
    runServerNotificationScheduler();
    return;
  }

  const digestRunButton = event.target.closest("[data-digest-run]");
  if (digestRunButton) {
    runNotificationDigest(digestRunButton.dataset.digestRun);
    return;
  }

  const digestPayloadButton = event.target.closest("[data-digest-payload]");
  if (digestPayloadButton) {
    copyDigestPayload(digestPayloadButton.dataset.digestPayload).catch(() => showToast("Could not copy payload", "info"));
    return;
  }

  const importJsonButton = event.target.closest("#import-json");
  if (importJsonButton) importWorkspaceFromTextarea();

  const importJsonNewWorkspaceButton = event.target.closest("#import-json-new-workspace");
  if (importJsonNewWorkspaceButton) importWorkspaceAsNewFromTextarea();

  const portableImportPreviewButton = event.target.closest("#portable-import-preview");
  if (portableImportPreviewButton) {
    previewPortableImportPayload();
    return;
  }

  const portableImportNewButton = event.target.closest("#portable-import-new");
  if (portableImportNewButton) {
    importPortablePayload("new-workspace");
    return;
  }

  const portableImportReplaceButton = event.target.closest("#portable-import-replace");
  if (portableImportReplaceButton) {
    importPortablePayload("replace");
    return;
  }

  const switcherImportButton = event.target.closest("#switcher-import-button");
  if (switcherImportButton) {
    importSwitcherPayload();
    return;
  }

  const switcherSampleButton = event.target.closest("#switcher-sample-csv");
  if (switcherSampleButton) {
    copySwitcherSampleCsv();
    return;
  }

  const switcherSampleTrelloButton = event.target.closest("#switcher-sample-trello");
  if (switcherSampleTrelloButton) {
    copySwitcherSampleTrello();
    return;
  }

  const switcherApplyPreviewButton = event.target.closest("#switcher-apply-preview");
  if (switcherApplyPreviewButton) {
    applySwitcherImportPreview();
    return;
  }

  const switcherClearPreviewButton = event.target.closest("#switcher-clear-preview");
  if (switcherClearPreviewButton) {
    clearSwitcherImportPreview();
    return;
  }

  const refreshExportButton = event.target.closest("#refresh-export");
  if (refreshExportButton) renderDataManagement();

  const downloadExportButton = event.target.closest("#download-json-export");
  if (downloadExportButton) downloadWorkspaceExport();

  const downloadPortableBundleButton = event.target.closest("#download-portable-bundle");
  if (downloadPortableBundleButton) {
    downloadPortableWorkspaceBundle();
    return;
  }

  const recoveryActionButton = event.target.closest("[data-recovery-action]");
  if (recoveryActionButton) {
    if (recoveryActionButton.dataset.recoveryAction === "download-bundle") downloadPortableWorkspaceBundle();
    if (recoveryActionButton.dataset.recoveryAction === "create-backup") createWorkspaceBackup("Recovery plan checkpoint");
    if (recoveryActionButton.dataset.recoveryAction === "download-manifest") downloadPortableWorkspaceManifest();
    return;
  }

  const downloadPortableManifestButton = event.target.closest("#download-portable-manifest");
  if (downloadPortableManifestButton) {
    downloadPortableWorkspaceManifest();
    return;
  }

  const backupCreateButton = event.target.closest("#backup-create");
  if (backupCreateButton) createWorkspaceBackup();

  const portableBackupCreateButton = event.target.closest("#backup-create-from-portable");
  if (portableBackupCreateButton) createWorkspaceBackup("Portable bundle checkpoint");

  const backupRestoreButton = event.target.closest("[data-backup-restore]");
  if (backupRestoreButton) {
    restoreWorkspaceBackup(backupRestoreButton.dataset.backupRestore);
    return;
  }

  const backupDeleteButton = event.target.closest("[data-backup-delete]");
  if (backupDeleteButton) {
    deleteWorkspaceBackup(backupDeleteButton.dataset.backupDelete);
    return;
  }

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

  const apiSupabasePasswordSignupButton = event.target.closest("#api-supabase-password-signup");
  if (apiSupabasePasswordSignupButton) signUpWithSupabasePassword();

  const apiSupabasePasswordLoginButton = event.target.closest("#api-supabase-password-login");
  if (apiSupabasePasswordLoginButton) signInWithSupabasePassword();

  const apiPasswordChangeButton = event.target.closest("#api-password-change");
  if (apiPasswordChangeButton) changeApiPassword();

  const apiPasswordResetRequestButton = event.target.closest("#api-password-reset-request");
  if (apiPasswordResetRequestButton) requestApiPasswordReset();

  const apiPasswordResetConfirmButton = event.target.closest("#api-password-reset-confirm");
  if (apiPasswordResetConfirmButton) confirmApiPasswordReset();

  const apiSupabaseLoginButton = event.target.closest("#api-supabase-login");
  if (apiSupabaseLoginButton) signInWithSupabaseToken();

  const apiDisconnectButton = event.target.closest("#api-disconnect");
  if (apiDisconnectButton) disconnectApiSession();

  const backendHealthRefreshButton = event.target.closest("#backend-health-refresh");
  if (backendHealthRefreshButton) {
    refreshBackendHealth();
    return;
  }

  const backendJobActionButton = event.target.closest("[data-backend-job-action]");
  if (backendJobActionButton) {
    runBackendJobAction(backendJobActionButton.dataset.backendJobId, backendJobActionButton.dataset.backendJobAction);
    return;
  }

  const auditRefreshButton = event.target.closest("#audit-refresh");
  if (auditRefreshButton) {
    loadAuditLogFromApi();
    return;
  }

  const apiSyncRetryButton = event.target.closest("#api-sync-retry");
  if (apiSyncRetryButton) {
    retryApiSyncQueue();
    return;
  }

  const syncConflictButton = event.target.closest("[data-sync-conflict]");
  if (syncConflictButton) {
    resolveApiSyncConflict(syncConflictButton.dataset.syncId, syncConflictButton.dataset.syncConflict);
    return;
  }

  const inviteMemberButton = event.target.closest("#invite-member");
  if (inviteMemberButton) inviteWorkspaceMember();

  const inviteResendButton = event.target.closest("[data-invite-resend]");
  if (inviteResendButton) {
    resendWorkspaceInvite(inviteResendButton.dataset.inviteResend);
    return;
  }

  const inviteRevokeButton = event.target.closest("[data-invite-revoke]");
  if (inviteRevokeButton) {
    revokeWorkspaceInvite(inviteRevokeButton.dataset.inviteRevoke);
    return;
  }

  const acceptInviteButton = event.target.closest("#invite-accept");
  if (acceptInviteButton) acceptWorkspaceInvite();

  const apiSaveButton = event.target.closest("#api-save-workspace");
  if (apiSaveButton) saveWorkspaceToApi();

  const apiLoadButton = event.target.closest("#api-load-workspace");
  if (apiLoadButton) loadWorkspaceFromApi();

  const apiRestoreSnapshotButton = event.target.closest("#api-restore-workspace-snapshot");
  if (apiRestoreSnapshotButton) restoreWorkspaceSnapshotFromApi();

  const apiImportButton = event.target.closest("#api-import-workspace");
  if (apiImportButton) importWorkspaceToApi();

  const switcherRollbackButton = event.target.closest("#switcher-rollback-import");
  if (switcherRollbackButton) {
    rollbackLastSwitcherImport();
    return;
  }

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

  const editProjectButton = event.target.closest("[data-edit-project]");
  if (editProjectButton) {
    const project = byId(state.projects, editProjectButton.dataset.editProject);
    if (project) {
      populateProjectForm(project);
      openDialog(els.projectDialog);
    }
    return;
  }

  const duplicateProjectButton = event.target.closest("[data-duplicate-project]");
  if (duplicateProjectButton) {
    duplicateProject(duplicateProjectButton.dataset.duplicateProject);
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
    if (!canWrite("projects:write")) {
      showToast("Your role cannot manage companies", "info");
      return;
    }
    populateCompanyForm();
    openDialog(els.companyDialog);
  }

  const newProjectTaskButton = event.target.closest("#new-task-button-project");
  if (newProjectTaskButton) {
    if (!canWrite("tasks:write")) {
      showToast("Your role cannot create tasks", "info");
      return;
    }
    populateTaskForm();
    openDialog(els.taskDialog);
  }

  const editCompanyButton = event.target.closest("[data-edit-company]");
  if (editCompanyButton) {
    if (!canWrite("projects:write")) {
      showToast("Your role cannot edit companies", "info");
      return;
    }
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
    syncInboxStateToApi();
    saveState();
    render();
    showToast(isInboxRead(id) ? "Notification marked read" : "Notification marked unread", "success");
  }

  const inboxClearButton = event.target.closest("[data-inbox-clear]");
  if (inboxClearButton) {
    archiveInboxItem(inboxClearButton.dataset.inboxClear);
    syncInboxStateToApi();
    saveState();
    render();
    showToast("Notification cleared", "success");
  }

  const inboxSnoozeButton = event.target.closest("[data-inbox-snooze]");
  if (inboxSnoozeButton) {
    snoozeInboxItem(inboxSnoozeButton.dataset.inboxSnooze);
    syncInboxStateToApi();
    saveState();
    render();
    showToast("Notification snoozed until tomorrow", "success");
    return;
  }

  const inboxRemindButton = event.target.closest("[data-inbox-remind]");
  if (inboxRemindButton) {
    scheduleInboxReminder(inboxRemindButton.dataset.inboxId, inboxRemindButton.dataset.inboxRemind);
    return;
  }

  const reminderDismissButton = event.target.closest("[data-reminder-dismiss]");
  if (reminderDismissButton) {
    dismissNotificationReminder(reminderDismissButton.dataset.reminderDismiss);
    return;
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
    syncInboxStateToApi();
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

  const commentReplyButton = event.target.closest("[data-comment-reply]");
  if (commentReplyButton) {
    setCommentReplyTarget(commentReplyButton.dataset.commentReply);
    return;
  }

  const commentStatusButton = event.target.closest("[data-comment-status]");
  if (commentStatusButton) {
    updateCommentRecord(commentStatusButton.dataset.commentId, { status: commentStatusButton.dataset.commentStatus });
    return;
  }

  const commentKindButton = event.target.closest("[data-comment-kind]");
  if (commentKindButton) {
    updateCommentRecord(commentKindButton.dataset.commentId, { kind: commentKindButton.dataset.commentKind });
    return;
  }

  const watchTaskButton = event.target.closest("[data-toggle-watch-task]");
  if (watchTaskButton) {
    toggleTaskWatch(watchTaskButton.dataset.toggleWatchTask);
    return;
  }

  const timeButton = event.target.closest("#time-submit");
  if (timeButton) addTaskTimeEntry();

  const editButton = event.target.closest("[data-edit-task]");
  if (editButton) {
    if (!canWrite("tasks:write")) {
      showToast("Your role cannot edit tasks", "info");
      return;
    }
    if (editButton.dataset.inboxId) {
      markInboxRead(editButton.dataset.inboxId);
      syncInboxStateToApi();
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

  const memberCompanySelect = event.target.closest("[data-member-company]");
  if (memberCompanySelect) {
    updateMemberCompanyAccess(memberCompanySelect.dataset.memberCompany, memberCompanySelect.value);
    return;
  }

  const taskProjectSelect = event.target.closest("#task-project");
  if (taskProjectSelect) {
    const taskId = document.querySelector("#task-id")?.value;
    renderTaskDependencies(taskId ? byId(state.tasks, taskId) : null);
  }

  const subtaskCheckbox = event.target.closest("[data-toggle-subtask]");
  if (subtaskCheckbox) toggleDraftSubtask(subtaskCheckbox.dataset.toggleSubtask, subtaskCheckbox.checked);

  const notificationEventToggle = event.target.closest("[data-notification-event]");
  if (notificationEventToggle) {
    updateNotificationEventPreference(notificationEventToggle.dataset.notificationEvent, notificationEventToggle.checked);
    return;
  }

  const notificationChannelToggle = event.target.closest("[data-notification-channel]");
  if (notificationChannelToggle) {
    updateNotificationChannel(notificationChannelToggle.dataset.notificationChannel, notificationChannelToggle.checked);
    return;
  }

  const digestRuleToggle = event.target.closest("[data-digest-rule]");
  if (digestRuleToggle) {
    updateDigestPreference(digestRuleToggle.dataset.digestRule, digestRuleToggle.checked);
    return;
  }

  const notificationCadenceSelect = event.target.closest("#notification-cadence");
  if (notificationCadenceSelect) {
    updateNotificationCadence(notificationCadenceSelect.value);
    return;
  }
});

document.addEventListener("keydown", (event) => {
  if (handleGlobalShortcut(event)) return;

  if (event.key === "Enter" && event.target.closest("#subtask-title")) {
    event.preventDefault();
    addDraftSubtask();
  }
});

document.querySelector("#new-task-button").addEventListener("click", () => {
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot create tasks", "info");
    return;
  }
  populateTaskForm();
  openDialog(els.taskDialog);
});

document.querySelector("#feature-request-button").addEventListener("click", openFeatureRequestDialog);

document.querySelector("#new-project-button").addEventListener("click", () => {
  if (!canWrite("projects:write")) {
    showToast("Your role cannot create projects", "info");
    return;
  }
  populateProjectForm();
  openDialog(els.projectDialog);
});

[els.taskDialog, els.featureRequestDialog, els.projectDialog, els.companyDialog, els.workspaceDialog, els.commandDialog, els.shortcutsDialog].filter(Boolean).forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (dialog === els.taskDialog) {
      const taskId = document.querySelector("#task-id")?.value || "";
      if (taskId) taskEditSnapshots.delete(taskId);
      staleTaskOverrideId = "";
      heartbeatPresence({ force: true });
    }
    restoreDialogFocus();
  });
});

els.workspaceForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveWorkspaceDialog();
});

document.querySelector("#seed-reset").addEventListener("click", () => {
  state = structuredClone(seedData);
  saveState();
  render();
  showToast("Sample data reset", "success");
});

els.workspaceSwitcher?.addEventListener("change", (event) => {
  switchWorkspace(event.target.value);
});

els.workspaceCreate?.addEventListener("click", createWorkspaceFromSwitcher);
els.workspaceDuplicate?.addEventListener("click", duplicateWorkspaceFromSwitcher);
els.workspaceArchive?.addEventListener("click", archiveActiveWorkspace);

els.commandInput?.addEventListener("input", () => {
  commandPaletteSelection = 0;
  renderCommandPalette();
});

els.searchInput.addEventListener("input", (event) => {
  state.filters.query = event.target.value;
  saveState();
  render();
});

els.searchInput.addEventListener("focus", renderSearchResults);

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

els.savedViewFilter?.addEventListener("change", (event) => {
  if (event.target.value) applySavedView(event.target.value);
});

els.saveViewButton?.addEventListener("click", saveCurrentView);
els.updateViewButton?.addEventListener("click", updateCurrentSavedView);
els.renameViewButton?.addEventListener("click", renameCurrentSavedView);
els.pinViewButton?.addEventListener("click", togglePinnedSavedView);
els.deleteViewButton?.addEventListener("click", deleteCurrentSavedView);

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

  const featureStatusSelect = event.target.closest("[data-feature-status-task]");
  if (featureStatusSelect) {
    updateFeatureRequestStatus(featureStatusSelect.dataset.featureStatusTask, featureStatusSelect.value);
    return;
  }

  const featureFilterSelect = event.target.closest("[data-feature-filter]");
  if (featureFilterSelect) {
    state.featureRequestFilters = {
      status: "all",
      source: "all",
      impact: "all",
      ...(state.featureRequestFilters || {}),
      [featureFilterSelect.dataset.featureFilter]: featureFilterSelect.value
    };
    saveState();
    render();
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
  const templateSearch = event.target.closest("#template-search");
  if (templateSearch) {
    const cursor = templateSearch.selectionStart || templateSearch.value.length;
    state.templateLibrary = {
      ...(state.templateLibrary || {}),
      query: templateSearch.value,
      selectedProjectTemplateId: ""
    };
    saveState();
    render();
    const nextSearch = document.querySelector("#template-search");
    if (nextSearch) {
      nextSearch.focus();
      nextSearch.setSelectionRange(cursor, cursor);
    }
    return;
  }

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

els.appView.addEventListener("submit", (event) => {
  if (event.target.closest("#public-feature-request-form")) {
    event.preventDefault();
    submitPublicFeatureRequest();
  }
});

els.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot save tasks", "info");
    return;
  }
  const id = document.querySelector("#task-id").value || uid("task");
  const existingTask = byId(state.tasks, id);
  if (existingTask && staleTaskOverrideId !== id && taskEditSnapshots.get(id) && taskEditSnapshots.get(id) !== taskRevision(existingTask)) {
    staleTaskOverrideId = id;
    showTaskEditWarning(existingTask);
    showToast("Task changed since you opened it", "info");
    return;
  }
  const now = new Date().toISOString();
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
    createdAt: existingTask?.createdAt || now,
    updatedAt: now
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
  taskEditSnapshots.delete(id);
  staleTaskOverrideId = "";
  closeDialog(els.taskDialog);
  render();
  showToast(existingTask ? "Task updated" : "Task created", "success");
  syncTaskToApi(task, existingTask ? "Task synced to API" : "Task created in API", !existingTask, taskEditSnapshots.get(id) || recordRevisionValue(existingTask));
});

els.featureRequestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot submit feature requests", "info");
    return;
  }

  const title = document.querySelector("#feature-request-title-input").value.trim();
  const projectId = document.querySelector("#feature-request-project").value;
  if (!title || !projectId) {
    showToast("Feature requests need a title and project", "info");
    return;
  }

  createFeatureRequestTask({
    projectId,
    projectName: byId(state.projects, projectId)?.name || projectId,
    title,
    details: document.querySelector("#feature-request-details").value.trim(),
    requester: document.querySelector("#feature-request-requester").value.trim(),
    email: document.querySelector("#feature-request-email").value.trim(),
    impact: document.querySelector("#feature-request-impact").value,
    impactLabel: featureRequestImpactLabel(document.querySelector("#feature-request-impact").value)
  });
});

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("projects:write")) {
    showToast("Your role cannot save projects", "info");
    return;
  }
  const id = document.querySelector("#project-id").value || uid("project");
  const existingProject = byId(state.projects, id);
  const now = new Date().toISOString();
  const project = {
    id,
    name: document.querySelector("#project-name").value.trim(),
    companyId: document.querySelector("#project-company").value,
    description: document.querySelector("#project-description").value.trim(),
    owner: document.querySelector("#project-owner").value,
    startDate: document.querySelector("#project-start-date").value,
    dueDate: document.querySelector("#project-due-date").value,
    createdAt: existingProject?.createdAt || now,
    updatedAt: now,
    archivedAt: existingProject?.archivedAt || "",
    archivedBy: existingProject?.archivedBy || ""
  };

  if (existingProject) {
    state.projects = state.projects.map((item) => item.id === id ? project : item);
    addActivity({
      projectId: project.id,
      type: "project_update",
      message: `updated project ${project.name}`
    });
  } else {
    state.projects = [project, ...state.projects];
    addActivity({
      projectId: project.id,
      type: "project_create",
      message: `created project ${project.name}`
    });
  }
  state.selectedProject = project.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "overview";
  saveState();
  closeDialog(els.projectDialog);
  render();
  showToast(existingProject ? "Project updated" : "Project created", "success");
  syncProjectToApi(project, existingProject ? "Project synced to API" : "Project created in API", !existingProject, recordRevisionValue(existingProject));
});

els.companyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("projects:write")) {
    showToast("Your role cannot manage companies", "info");
    return;
  }
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
  if (!routeInviteFromLocation({ shouldRender: true })) {
    routeFeedbackFromLocation({ shouldRender: true });
  }
});

window.addEventListener("pointermove", handlePointerPresence, { passive: true });

window.addEventListener("focus", () => {
  heartbeatPresence({ force: true });
  refreshLiveCollaborationFromApi({ rerender: ["dashboard", "inbox"].includes(state.selectedRoute) });
  pollApiForWorkspaceChanges();
});

document.addEventListener("visibilitychange", () => {
  heartbeatPresence({ force: true });
  if (!document.hidden) pollApiForWorkspaceChanges();
});

window.addEventListener("online", handleNetworkOnline);
window.addEventListener("offline", handleNetworkOffline);

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

if (reducedMotionQuery?.addEventListener) {
  reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
} else if (reducedMotionQuery?.addListener) {
  reducedMotionQuery.addListener(handleReducedMotionChange);
}

function handleColorSchemeChange() {
  if (state.workspace.theme?.preset !== "auto") return;
  applyWorkspaceTheme();
  if (state.selectedRoute === "settings") render();
}

if (darkModeQuery?.addEventListener) {
  darkModeQuery.addEventListener("change", handleColorSchemeChange);
} else if (darkModeQuery?.addListener) {
  darkModeQuery.addListener(handleColorSchemeChange);
}

initSmoothScroll();
registerServiceWorker();
startRealtimePolling();
window.setInterval(() => {
  runNotificationReminderScheduler();
}, 60000);
runNotificationReminderScheduler();
window.setInterval(() => {
  const taskId = document.querySelector("#task-dialog[open] #task-id")?.value || "";
  heartbeatPresence({ taskId });
  refreshLiveCollaborationFromApi();
}, 15000);

if (!routeInviteFromLocation() && !routeFeedbackFromLocation() && !routeFromLocation()) {
  openSidebarGroupForRoute(state.selectedRoute);
}
render();
document.documentElement.dataset.agoraBoot = "ready";
