#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const START_PORT = Number(process.env.AGORA_GOLDEN_PORT || 5300 + Math.floor(Math.random() * 1000));
const HOST = process.env.AGORA_GOLDEN_HOST || "127.0.0.1";
const BASE_URL = process.env.AGORA_GOLDEN_BASE_URL || "";
const CHROME_TIMEOUT_MS = readPositiveNumber(process.env.AGORA_GOLDEN_TIMEOUT_MS, 60000);
const ROUTE_WAIT_MS = readPositiveNumber(process.env.AGORA_GOLDEN_WAIT_MS, 5000);
const ARTIFACT_DIR = process.env.AGORA_GOLDEN_ARTIFACT_DIR || "";
const ONLY_FILTER = String(process.env.AGORA_GOLDEN_ONLY || "").trim().toLowerCase();
const SUITE_FILTER = String(process.env.AGORA_GOLDEN_SUITE || "").trim().toLowerCase();
const CHROME_OUTPUT_TAIL = 4000;
const CHROME_RETRY_COUNT = readNonNegativeNumber(process.env.AGORA_GOLDEN_RETRIES, 1);
const SCREENSHOT_TIMEOUT_MS = Math.min(
  CHROME_TIMEOUT_MS,
  readPositiveNumber(process.env.AGORA_GOLDEN_SCREENSHOT_TIMEOUT_MS, 30000)
);

const staticChecks = [
  {
    name: "App shell",
    path: "/",
    status: 200,
    contentType: "text/html",
    required: ["Agora", "app-view", "src/app.js"]
  },
  {
    name: "PWA manifest",
    path: "/manifest.webmanifest",
    status: 200,
    contentType: "application/manifest+json",
    required: ["Agora Project Management", "standalone", "agora-mobile-today.png"]
  },
  {
    name: "Offline fallback page",
    path: "/offline.html",
    status: 200,
    contentType: "text/html",
    required: ["Agora is offline", "Your local workspace remains on this device"]
  },
  {
    name: "Missing route uses offline fallback",
    path: "/missing-test-route",
    status: 404,
    contentType: "text/html",
    required: ["Agora is offline"]
  }
];

const routeChecks = [
  {
    name: "Landing page ownership story",
    suite: "marketing",
    route: "landing",
    width: 1265,
    height: 900,
    required: [
      "Beta proof in progress",
      "release gates proven",
      "Try Acme Demo",
      "Own the work. Keep it portable. Run it offline. Audit the AI.",
      "Open ownership",
      "Built to beat closed work platforms",
      "Role-based starter workspaces",
      "Agency PM",
      "Open-source maintainer",
      "Power without sludge",
      "Integration launch",
      "No ads. No trackers. No borrowed attention."
    ]
  },
  {
    name: "Dashboard onboarding golden paths",
    suite: "first-run",
    route: "dashboard",
    width: 1265,
    height: 712,
    required: [
      "First client workspace",
      "Launch a real client workspace",
      "Create the client onboarding project",
      "Install the agency handoff workflow",
      "Export the recovery bundle",
      "Workspace health",
      "Workspace setup",
      "10 minute launch",
      "Guided evaluation",
      "Five proof points for real client delivery",
      "Load the client delivery workspace",
      "Audit recovery automation",
      "Agency PM",
      "Software lead",
      "Ops",
      "Project management style",
      "How do you like to run projects?",
      "Kanban board",
      "Scrum sprints",
      "Timeline / Gantt",
      "Client delivery",
      "Simple list",
      "Pick your launch path",
      "Create recovery proof",
      "Autopilot Demo",
      "What will AI do?",
      "one-click undo"
    ]
  },
  {
    name: "Guided launch flow",
    suite: "first-run",
    route: "launch",
    width: 1265,
    height: 712,
    required: [
      "Launch the first real project",
      "Launch progress",
      "Tell Agora how you run work.",
      "Project name",
      "Importing work",
      "Create Launch Plan",
      "Install the handoff workflow",
      "Prove recovery",
      "Invite the first teammate",
      "Try the Autopilot demo",
      "Safety Center",
      "Memory bridge",
      "Impact Simulator",
      "one-click undo"
    ]
  },
  {
    name: "Sample workspace launch path",
    suite: "first-run",
    route: "dashboard",
    query: { goldenAction: "sampleAgencyWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "Agency Client Delivery Demo",
      "Local sample",
      "leaves existing work untouched",
      "Guided evaluation",
      "Load the client delivery workspace",
      "Client onboarding launch",
      "Northstar Client",
      "Project management style",
      "Workspace setup"
    ]
  },
  {
    name: "Clean board starter empty state",
    suite: "first-run",
    route: "board",
    query: { goldenAction: "cleanWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "This board is ready for real work.",
      "Create the first card, import tasks from another tool",
      "Create Card",
      "Import Tasks",
      "Load Agency Sample"
    ]
  },
  {
    name: "Clean sprint starter empty state",
    suite: "first-run",
    route: "sprint",
    query: { goldenAction: "cleanWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "No sprint work is planned yet.",
      "load the Ops sprint sample",
      "Create Task",
      "Load Ops Sample",
      "Open Backlog"
    ]
  },
  {
    name: "Clean Data recovery empty state",
    suite: "first-run",
    route: "data",
    query: { goldenAction: "cleanWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "Create a recovery point before this workspace becomes important.",
      "Backups, portable bundles, and import previews",
      "Create Backup",
      "Import Tasks",
      "Open Recovery Plan"
    ]
  },
  {
    name: "Project Memory sample capture empty path",
    suite: "first-run",
    route: "memory",
    query: { goldenAction: "memorySampleCapture" },
    width: 1265,
    height: 712,
    required: [
      "Sample kickoff notes",
      "Structured Extraction Preview",
      "Approval owner is not confirmed",
      "Project Memory Timeline",
      "Date change"
    ]
  },
  {
    name: "PM command center",
    suite: "workspace",
    route: "command-center",
    width: 1265,
    height: 712,
    required: [
      "PM command center",
      "What needs attention now?",
      "Attention queue",
      "Highest-risk items",
      "Next best actions",
      "Client promises",
      "Team load",
      "Decision follow-up",
      "Open decisions",
      "Client visibility warnings",
      "Visibility warnings",
      "Decisions and RAID",
      "Feedback loop"
    ]
  },
  {
    name: "Command Inbox work queue",
    suite: "workspace",
    route: "inbox",
    width: 1265,
    height: 712,
    required: [
      "Command Inbox",
      "What needs you, what changed, and what can be cleared next",
      "Unified command queue",
      "Needs decision",
      "At risk",
      "Failed syncs",
      "AI review",
      "Feedback",
      "Daily sweep",
      "Daily command digest",
      "What changed, failed, and needs review",
      "Failed sync attempts",
      "Autopilot proposals",
      "Client visibility warnings",
      "Autopilot review digest"
    ]
  },
  {
    name: "Project Memory capture",
    suite: "workspace",
    route: "memory",
    width: 1265,
    height: 712,
    required: [
      "Project Memory",
      "Universal Update Capture",
      "Paste reality into Agora",
      "Offline-first capture",
      "Raw project memory inbox",
      "Captured updates",
      "Ready to parse",
      "Structured Extraction Preview",
      "Human Review + Apply",
      "tasks, blockers, decisions, risks, approvals, date changes, and comments",
      "Project Memory Timeline",
      "Important updates, decisions, and outcomes",
      "source snippets, structured previews, and applied outcomes",
      "Connector-ready Ingestion Contract",
      "One pipeline for every source",
      "Email forwarder",
      "Agora CLI",
      "MCP server",
      "Payload shape",
      "Meeting notes",
      "Capture Update"
    ]
  },
  {
    name: "Project Autopilot drift detector",
    suite: "workspace",
    route: "autopilot",
    width: 1265,
    height: 712,
    required: [
      "Project Autopilot",
      "Reality vs Plan Engine",
      "Project drift detector",
      "schedule, scope, approvals, blockers, workload, and client promises",
      "Reality sources",
      "Human approval",
      "Autopilot is preview-only until a person approves",
      "Autopilot Safety Center",
      "Allowed with approval",
      "Never automatic",
      "Audit required",
      "Rollback status",
      "One-click undo",
      "Recent Autopilot changes",
      "PM Autopilot Loop Closer",
      "From signal to reviewed action",
      "Queue Top Loops",
      "Expected outcome",
      "Open Review Queue",
      "Project Memory Autopilot Bridge",
      "Captured reality feeds drift detection",
      "Structured signals",
      "Feeds Autopilot",
      "Needs preview",
      "Memory signals in drift feed",
      "Recovery Scenario Builder",
      "Autopilot recovery proposals",
      "review-first",
      "Move deadline",
      "Impact Simulator",
      "Downstream",
      "Client promises",
      "Risk score",
      "Approve and Apply",
      "applies audited changes",
      "Autopilot Learning Log",
      "Workspace preferences",
      "Preferred strategy",
      "Reject",
      "Plan:",
      "Reality:"
    ]
  },
  {
    name: "Portfolio resource planning",
    suite: "workspace",
    route: "portfolio",
    width: 1265,
    height: 712,
    required: [
      "Portfolio",
      "Resource Planning",
      "Decide what work should exist",
      "Portfolio command center",
      "Health, dates, owners, confidence",
      "Capacity",
      "Team workload plan",
      "Portfolio decisions",
      "Leadership action log",
      "Scenario planning",
      "What-if tradeoffs",
      "Resource allocation editor",
      "Rebalance work",
      "Capacity planning",
      "Team availability by owner",
      "Priority scoring",
      "What should we prioritize?",
      "Backlog candidates",
      "Approve",
      "Move date +2w",
      "Rebalance Task"
    ]
  },
  {
    name: "Power-user Kanban board",
    suite: "workspace",
    route: "board",
    width: 1265,
    height: 712,
    required: [
      "Kanban controls",
      "Board system",
      "Board automation builder",
      "Card templates",
      "Checklist recipes",
      "Backlog / Triage",
      "Flow analytics",
      "Workflow",
      "Advanced Swimlanes",
      "Swimlanes",
      "Manual order",
      "Density",
      "WIP",
      "Saved board views",
      "Board health",
      "Descriptions",
      "Signals",
      "Add a card",
      "To do",
      "Doing",
      "Review",
      "Done"
    ]
  },
  {
    name: "Project Gantt timeline",
    suite: "workspace",
    route: "project",
    query: { project: "launch", tab: "timeline" },
    width: 1265,
    height: 712,
    required: [
      "Timeline",
      "Gantt",
      "Schedule and dependencies",
      "Week",
      "Month",
      "Quarter",
      "Critical path",
      "Slipped path",
      "Workload warnings",
      "Export Markdown",
      "Export JSON",
      "Add Milestone"
    ]
  },
  {
    name: "Project command center",
    suite: "workspace",
    route: "project",
    query: { project: "launch", tab: "overview" },
    width: 1265,
    height: 712,
    required: [
      "Project command center",
      "Project health",
      "Confidence",
      "Owner",
      "Client / Company",
      "Due date",
      "Next Best Actions",
      "What should happen next",
      "Risk and decisions strip",
      "Open RAID",
      "Pending decisions",
      "Recent Reality",
      "What changed lately",
      "Autopilot for This Project",
      "Drift and recovery proposals",
      "Team Load",
      "Owner workload",
      "Action queue",
      "Change history",
      "What to do next",
      "Timeline slip",
      "Client visibility",
      "Decision load"
    ]
  },
  {
    name: "Sprint command center",
    suite: "workspace",
    route: "sprint",
    width: 1265,
    height: 712,
    required: [
      "Sprint Command Center",
      "Beta sprint",
      "Sprint timeline",
      "Stories across Beta sprint",
      "peak",
      "Sprint planning",
      "Velocity target",
      "Recommended removals",
      "AI scrum master",
      "Copy standup brief",
      "Multi-sprint roadmap",
      "Carryover planner",
      "Roadmap sprint settings",
      "Scenario planning",
      "What-if forecast",
      "Jira / Linear / GitHub sync",
      "Sync payload preview",
      "Sprint review and retrospective",
      "Preview Close",
      "Confirm Close Sprint",
      "Closeout history",
      "Copy Markdown",
      "Close Sprint",
      "Sprint automation",
      "Preview sprint rules before enabling",
      "One-click presets",
      "Sprint automation audit trail",
      "Run Enabled Sprint Rules",
      "Enable Rule",
      "Burndown",
      "Burnup",
      "Forecast",
      "Scope changes",
      "Historical comparison",
      "Standup queue",
      "Readiness checks",
      "Scope and carryover",
      "Retro",
      "Definition of Done"
    ]
  },
  {
    name: "Decision log",
    suite: "workspace",
    route: "decisions",
    width: 1265,
    height: 712,
    required: [
      "Decision log",
      "Durable project decisions",
      "Decision Log 1.0",
      "Open decisions",
      "Client-visible",
      "Decision register"
    ]
  },
  {
    name: "Client visibility review",
    suite: "workspace",
    route: "visibility",
    width: 1265,
    height: 712,
    required: [
      "Client visibility review",
      "Preview what clients can see",
      "Preview as Client",
      "Share packet composer",
      "Ready to send checklist",
      "Client portal link",
      "Generate Link",
      "Email Draft",
      "Visible packet",
      "Visibility warnings",
      "Client-safe sharing",
      "Internal notes stay hidden unless",
      "Visibility audit trail",
      "Exposure changes",
      "Client-visible",
      "Shared",
      "Internal"
    ]
  },
  {
    name: "Operator agent review queue",
    suite: "ai",
    route: "operator",
    width: 1265,
    height: 712,
    required: [
      "AI command center",
      "Agent Review Queue",
      "Approve the action, not the magic",
      "Refresh Queue",
      "rationale",
      "affected records",
      "Trust and context"
    ]
  },
  {
    name: "Collaboration decision promotion",
    suite: "workspace",
    route: "collaboration",
    width: 1265,
    height: 712,
    required: [
      "Collaboration",
      "Workspace channels",
      "Whiteboard",
      "Log Decision",
      "Log"
    ]
  },
  {
    name: "Production readiness audit",
    suite: "release",
    route: "readiness",
    width: 1265,
    height: 712,
    required: [
      "Production readiness audit",
      "Hosted setup wizard",
      "Environment diagnostics",
      "Production readiness export",
      "First client workspace",
      "Hosted launch gates",
      "API and sync health",
      "Portable restore path",
      "Access and audit controls",
      "Power-user checks",
      "Strict CSP",
      "Dependency audit",
      "Download JSON",
      "Download Markdown",
      "Copy Report"
    ]
  },
  {
    name: "Release management ship room",
    suite: "release",
    route: "release",
    width: 1265,
    height: 712,
    required: [
      "Release Management",
      "Ship room",
      "Release Readiness Dashboard",
      "Production cockpit",
      "Evidence Bundle Viewer",
      "Release proof files",
      "Export Packet",
      "Release dashboard",
      "Upcoming releases",
      "Selected release",
      "Linked projects, sprints, and tasks",
      "Release checklist / gates",
      "Ship gates",
      "Release notes generator",
      "Draft changelog",
      "Export Evidence",
      "Download Notes"
    ]
  },
  {
    name: "Audit Log 2.0",
    suite: "security",
    route: "audit",
    width: 1265,
    height: 712,
    required: [
      "Audit trail",
      "Export Evidence Pack",
      "Evidence pack export includes audit CSV",
      "Security events",
      "Client portal activity",
      "AI/operator actions",
      "Integration failures",
      "Audit event detail drawer",
      "Raw metadata",
      "Before",
      "After"
    ]
  },
  {
    name: "Beta launch handoff",
    suite: "release",
    route: "beta",
    width: 1265,
    height: 712,
    required: [
      "Beta launch",
      "Can we send Agora to an outside team?",
      "Beta packet",
      "Beta workspace",
      "Start Beta Workspace",
      "Beta walkthrough",
      "First 5 minutes for a tester",
      "First 5 minutes mode",
      "Start 5-minute evaluation",
      "Evaluation scorecard",
      "Can Agora run this project?",
      "Needs work",
      "Beta exit proof",
      "Leave with my data",
      "Hosted onboarding",
      "Email diagnostics",
      "Copy Feedback Link",
      "Download Bundle",
      "Download Packet",
      "Download JSON",
      "Copy Markdown"
    ]
  },
  {
    name: "Evaluator landing path",
    suite: "release",
    route: "evaluate",
    width: 1265,
    height: 712,
    required: [
      "Evaluator mode",
      "Evaluate Agora in 5 minutes",
      "Review packet preview",
      "Shareable demo links",
      "Start Evaluation",
      "Restart Demo",
      "Reset Scorecard",
      "Copy Evaluator Link",
      "First 5 minutes mode",
      "Evaluation scorecard",
      "Download Packet"
    ]
  },
  {
    name: "Start beta workspace click path",
    suite: "release",
    route: "beta",
    query: { goldenAction: "startBetaWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "Agency Client Delivery Beta",
      "Client Onboarding Launch",
      "Northstar Labs",
      "Beta walkthrough",
      "Open client project",
      "Review portal status",
      "Triage a feature request",
      "Prove exit and recovery",
      "Leave with my data",
      "Download workspace JSON",
      "Tasks CSV",
      "Time CSV",
      "3 seeded beta requests",
      "Agency Client Delivery Beta is loaded with client work"
    ]
  },
  {
    name: "Direct beta demo link",
    suite: "release",
    route: "beta",
    query: { demoAction: "startBetaWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "Agency Client Delivery Beta",
      "First 5 minutes mode",
      "Run the five-minute path live",
      "Demo workspace created",
      "Reset Scorecard",
      "Evaluation scorecard",
      "Can Agora run this project?"
    ]
  },
  {
    name: "Template to project path",
    suite: "workspace",
    route: "templates",
    width: 1265,
    height: 712,
    required: [
      "Project template library",
      "Recommended first template",
      "Client Onboarding",
      "Create Client Project",
      "Template marketplace",
      "Create Customized Project",
      "Import shared template JSON"
    ]
  },
  {
    name: "Marketplace automation path",
    suite: "workspace",
    route: "marketplace",
    width: 1265,
    height: 712,
    required: [
      "Template marketplace",
      "Recommended first automation pack",
      "Agency Client Handoff",
      "Install Recommended Pack",
      "Install workflow packs",
      "Validation",
      "Creator",
      "License",
      "No template preview yet",
      "No automation pack preview yet"
    ]
  },
  {
    name: "Portable recovery path",
    suite: "data",
    route: "data",
    width: 1265,
    height: 712,
    required: [
      "Recovery confidence",
      "Backup first",
      "previewable rollback path",
      "Know you can leave and restore",
      "CLI inspect",
      "Portable workspace OS",
      "Download Bundle",
      "Open ownership advantage",
      "Lock-in risk receipt",
      "Auditable AI",
      "Migration safety",
      "Create Backup",
      "Import bundle",
      "Preview Bundle",
      "Migration wizard v1",
      "Move projects without losing the trail",
      "Apply safely",
      "Desktop and mobile readiness",
      "Workspace schema",
      "offline-storage-contract.json"
    ]
  },
  {
    name: "Settings production controls",
    suite: "admin",
    route: "settings",
    width: 1265,
    height: 712,
    required: [
      "Settings",
      "Hosted onboarding",
      "First real team path",
      "Open Members",
      "Open Sync",
      "Account",
      "Workspace",
      "Auto",
      "Members",
      "Plugins",
      "Jobs",
      "Sync",
      "Trust"
    ]
  },
  {
    name: "Settings sync and offline readiness",
    suite: "offline",
    route: "settings",
    query: { settingsTab: "sync" },
    width: 1265,
    height: 712,
    required: [
      "Backend health",
      "Conflict center",
      "Local data is safe while sync is blocked",
      "Copy Support Bundle",
      "Merge policy",
      "Offline apps",
      "Desktop and mobile readiness",
      "Native shell contract",
      "Local workspace",
      "Retry queue",
      "Portable restore"
    ]
  },
  {
    name: "Settings security posture",
    suite: "security",
    route: "settings",
    query: { settingsTab: "security" },
    width: 1265,
    height: 712,
    required: [
      "Current access",
      "Security Control Center",
      "Production controls and fixes",
      "GitHub webhook status",
      "Refresh Controls",
      "Admin readiness",
      "Shared guard helper",
      "Regression coverage",
      "Danger zone review",
      "Admin activity center",
      "Role preview",
      "Active sessions",
      "Offline security posture",
      "Local-first means the device matters",
      "Download Redacted Bundle",
      "Permission matrix"
    ]
  },
  {
    name: "Settings trust ownership proof",
    suite: "security",
    route: "settings",
    query: { settingsTab: "trust" },
    width: 1265,
    height: 712,
    required: [
      "Trust center",
      "Open, portable, auditable",
      "Trust Mode",
      "Turn on ownership highlights",
      "Exportable",
      "Reversible",
      "Open ownership advantage",
      "Portability over lock-in",
      "Offline-native continuity",
      "Auditable AI",
      "Lock-in risk receipt"
    ]
  },
  {
    name: "Settings feedback intake",
    suite: "feedback",
    route: "settings",
    query: { settingsTab: "feedback" },
    width: 1265,
    height: 712,
    required: [
      "Email diagnostics",
      "Invites, resets, and requester updates",
      "Feature request intake",
      "Public submit link",
      "Open Feature Requests",
      "Submit Internal Request"
    ]
  },
  {
    name: "Settings integration registry",
    suite: "admin",
    route: "settings",
    query: { settingsTab: "integrations" },
    width: 1265,
    height: 712,
    required: [
      "Connected tools",
      "Integration launch plan",
      "Priority connector playbooks",
      "Launch risk",
      "Connector registry",
      "Plugin connector bridge",
      "Auth, scopes, direction, and health",
      "GitHub Integration v1",
      "Issues and pull requests",
      "GitHub webhook intake",
      "GitHub setup checklist",
      "Replay protection",
      "Required in production",
      "Send Test GitHub Event",
      "Webhook delivery receipts",
      "Copy Webhook URL",
      "Keep Agora",
      "Use GitHub",
      "Merge",
      "Ignore",
      "Sync mapping layer",
      "GitHub issue to Agora task",
      "Queue GitHub Sync",
      "Linked work preview",
      "Repository"
    ]
  },
  {
    name: "Settings integration job console",
    suite: "admin",
    route: "settings",
    query: { settingsTab: "jobs" },
    width: 1265,
    height: 712,
    required: [
      "Integration job console",
      "Sync and worker jobs",
      "Refresh Jobs",
      "Integration sync lane",
      "All worker jobs",
      "Payload preview"
    ]
  },
  {
    name: "Settings plugin registry",
    suite: "admin",
    route: "settings",
    query: { settingsTab: "plugins" },
    width: 1265,
    height: 712,
    required: [
      "Plugin registry",
      "Local extension manifests",
      "Example Importer",
      "GitHub Connector",
      "Contribution registry",
      "Enabled plugin contributions",
      "connectors",
      "Plugin changes",
      "Manifest v1"
    ]
  },
  {
    name: "Project backlog pipeline",
    suite: "workspace",
    route: "project-backlog",
    width: 1265,
    height: 712,
    required: [
      "Capture future work",
      "Backlog projects",
      "Project intake",
      "Pipeline",
      "Approved",
      "Promote"
    ]
  },
  {
    name: "Acme demo triage request",
    suite: "demo",
    route: "command-center",
    query: { demoAction: "sampleAgencyWorkspace" },
    width: 1265,
    height: 712,
    required: [
      "PM command center",
      "What needs attention now?",
      "Attention queue",
      "Highest-risk items",
      "Next best actions",
      "Client promises",
      "Client visibility warnings",
      "Decisions and RAID"
    ]
  },
  {
    name: "Acme demo scope project",
    suite: "demo",
    route: "project-backlog",
    width: 1265,
    height: 712,
    required: [
      "Capture future work",
      "Backlog projects",
      "Project intake",
      "Pipeline",
      "Approved",
      "Promote"
    ]
  },
  {
    name: "Acme demo review approvals",
    suite: "demo",
    route: "visibility",
    width: 1265,
    height: 712,
    required: [
      "Client visibility review",
      "Preview what clients can see",
      "Share packet composer",
      "Client portal link",
      "Visible packet",
      "Visibility warnings",
      "Visibility audit trail"
    ]
  },
  {
    name: "Acme demo inspect timeline risk",
    suite: "demo",
    route: "project",
    query: { project: "launch", tab: "timeline" },
    width: 1265,
    height: 712,
    required: [
      "Timeline",
      "Gantt",
      "Schedule and dependencies",
      "Critical path",
      "Slipped path",
      "Workload warnings",
      "Export Markdown"
    ]
  },
  {
    name: "Acme demo draft client update",
    suite: "demo",
    route: "reports",
    width: 1265,
    height: 712,
    required: [
      "Status report",
      "Copy Report",
      "Delivery risk",
      "Team workload plan",
      "Company comparison",
      "Workload",
      "Risk queue"
    ]
  },
  {
    name: "Acme demo recovery proof",
    suite: "demo",
    route: "data",
    query: { demoAction: "recoveryPlan" },
    width: 1265,
    height: 712,
    required: [
      "Recovery confidence",
      "Backup first",
      "previewable rollback path",
      "Portable workspace OS",
      "Download Bundle",
      "Create Backup",
      "Import bundle",
      "Preview Bundle"
    ]
  },
  {
    name: "Mobile dashboard golden paths",
    suite: "mobile",
    route: "dashboard",
    width: 500,
    height: 844,
    required: [
      "First client workspace",
      "Launch a real client workspace",
      "Start With Client Onboarding",
      "Review Agency Handoff Pack",
      "Open Recovery Plan"
    ]
  },
  {
    name: "Mobile evaluator first screen",
    suite: "mobile",
    route: "evaluate",
    width: 500,
    height: 844,
    required: [
      "Evaluator mode",
      "Evaluate Agora in 5 minutes",
      "Start Evaluation",
      "Restart Demo",
      "Reset Scorecard",
      "Review packet preview"
    ]
  },
  {
    name: "Mobile app native offline plan",
    suite: "mobile",
    route: "settings",
    query: { settingsTab: "mobile" },
    width: 500,
    height: 844,
    required: [
      "Mobile app",
      "Install and alerts",
      "Native wrapper plan",
      "Planned iOS and Android targets",
      "Offline command center",
      "Phone jobs that must work without internet",
      "Desktop and mobile readiness",
      "Native shell contract"
    ]
  },
  {
    name: "Feature request triage",
    suite: "feedback",
    route: "feature-requests",
    width: 1265,
    height: 712,
    required: [
      "Feedback triage",
      "Beta feedback command center",
      "Needs response",
      "Feature Requests",
      "Request queue",
      "Copy Public Link"
    ]
  },
  {
    name: "Public feedback form",
    suite: "feedback",
    route: "feedback",
    width: 390,
    height: 760,
    required: [
      "Product feedback",
      "Feature title",
      "Your email",
      "Send Feature Request"
    ]
  }
];

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const chromePath = findChrome();
  const selectedRouteChecks = routeChecks.filter((check) => {
    const suiteMatches = !SUITE_FILTER || String(check.suite || "").toLowerCase() === SUITE_FILTER;
    const onlyText = `${check.name} ${check.suite || ""} ${check.route || ""}`.toLowerCase();
    const onlyMatches = !ONLY_FILTER || onlyText.includes(ONLY_FILTER);
    return suiteMatches && onlyMatches;
  });
  if (!selectedRouteChecks.length) {
    throw new Error(`No golden route checks matched filters: suite=${SUITE_FILTER || "all"} only=${ONLY_FILTER || "all"}`);
  }
  const server = BASE_URL
    ? { baseUrl: trimTrailingSlash(BASE_URL), stop: async () => {} }
    : await startStaticServer();

  try {
    for (const check of staticChecks) {
      let response = null;
      try {
        response = await requestUrlWithBody(`${server.baseUrl}${check.path}`);
        assertStaticSurface(check, response);
        console.log(`Passed ${check.name}`);
      } catch (error) {
        writeStaticFailureArtifact(check, response, error);
        throw error;
      }
    }

    for (const check of selectedRouteChecks) {
      const url = buildRouteUrl(server.baseUrl, check);
      let dom = "";
      try {
        console.log(`Running ${check.name} [${check.suite}]`);
        dom = await runRouteChromeWithRetry(chromePath, check, url);
        assertGoldenPath(check, dom);
        console.log(`Passed ${check.name} [${check.suite}]`);
      } catch (error) {
        await writeRouteFailureArtifacts(chromePath, check, url, dom, error);
        throw error;
      }
    }
  } finally {
    await server.stop();
  }

  console.log("");
  console.log(`Golden path QA passed: ${staticChecks.length} static checks, ${selectedRouteChecks.length} route checks`);
}

function buildRouteUrl(baseUrl, check) {
  const params = new URLSearchParams({
    route: check.route,
    golden: String(Date.now())
  });
  Object.entries(check.query || {}).forEach(([key, value]) => {
    params.set(key, value);
  });
  return `${baseUrl}/?${params.toString()}`;
}

async function runRouteChromeWithRetry(chromePath, check, url) {
  const maxAttempts = CHROME_RETRY_COUNT + 1;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runChrome(chromePath, routeDomArgs(check, url), { label: check.name });
    } catch (error) {
      error.attempt = attempt;
      error.maxAttempts = maxAttempts;
      error.routeName = check.name;
      error.routeSuite = check.suite || "";
      lastError = error;
      if (!error.timedOut || attempt >= maxAttempts) throw error;
      console.warn(`Retrying ${check.name} [${check.suite}] after Chrome timeout (${attempt}/${maxAttempts})`);
    }
  }
  throw lastError;
}

function routeDomArgs(check, url) {
  return [
    "--headless=new",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--high-dpi-support=1",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--run-all-compositor-stages-before-draw",
    `--window-size=${check.width},${check.height}`,
    `--virtual-time-budget=${ROUTE_WAIT_MS}`,
    "--dump-dom",
    url
  ];
}

function assertStaticSurface(check, response) {
  if (response.statusCode !== check.status) {
    throw new Error(`${check.name} returned HTTP ${response.statusCode}, expected ${check.status}`);
  }
  const contentType = response.headers["content-type"] || "";
  if (!contentType.includes(check.contentType)) {
    throw new Error(`${check.name} returned content-type ${contentType || "(missing)"}, expected ${check.contentType}`);
  }
  assertSecurityHeaders(check.name, response.headers);
  const body = String(response.body || "");
  check.required.forEach((phrase) => {
    if (!body.includes(phrase)) {
      throw new Error(`${check.name} is missing expected text: ${phrase}`);
    }
  });
}

function assertSecurityHeaders(name, headers) {
  const csp = headers["content-security-policy"] || "";
  const requiredCsp = ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"];
  requiredCsp.forEach((directive) => {
    if (!csp.includes(directive)) throw new Error(`${name} is missing CSP directive: ${directive}`);
  });
  const expected = {
    "x-content-type-options": "nosniff",
    "cross-origin-opener-policy": "same-origin",
    "referrer-policy": "strict-origin-when-cross-origin"
  };
  Object.entries(expected).forEach(([header, value]) => {
    if ((headers[header] || "").toLowerCase() !== value) {
      throw new Error(`${name} has invalid ${header}: ${headers[header] || "(missing)"}`);
    }
  });
}

function assertGoldenPath(check, dom) {
  const text = String(dom || "");
  const normalized = text.toLowerCase();
  if (!normalized.includes("data-agora-boot=\"ready\"")) {
    throw new Error(`${check.name} did not finish booting`);
  }
  if (normalized.includes("could not render") || normalized.includes("view error")) {
    throw new Error(`${check.name} rendered an error state: ${errorSnippet(text)}`);
  }
  if (normalized.includes("typeerror") || normalized.includes("referenceerror")) {
    throw new Error(`${check.name} rendered a JavaScript error string: ${errorSnippet(text)}`);
  }
  check.required.forEach((phrase) => {
    if (!normalized.includes(phrase.toLowerCase())) {
      throw new Error(`${check.name} is missing expected text: ${phrase}`);
    }
  });
}

function errorSnippet(dom) {
  const text = String(dom || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const markerIndex = text.toLowerCase().indexOf("could not render");
  const start = markerIndex === -1 ? 0 : Math.max(0, markerIndex - 80);
  return text.slice(start, start + 240);
}

function writeStaticFailureArtifact(check, response, error) {
  if (!ARTIFACT_DIR) return;
  const baseName = safeArtifactName(check.name);
  const headers = response?.headers ? JSON.stringify(response.headers, null, 2) : "{}";
  const body = response?.body || "";
  writeArtifact(`${baseName}.txt`, [
    `Check: ${check.name}`,
    `Path: ${check.path}`,
    `Error: ${error.message || error}`,
    "",
    "Headers:",
    headers,
    "",
    "Body:",
    body
  ].join("\n"));
}

async function writeRouteFailureArtifacts(chromePath, check, url, dom, error) {
  if (!ARTIFACT_DIR) return;
  const baseName = safeArtifactName(check.name);
  writeArtifact(`${baseName}.html`, dom || `<!-- No DOM captured: ${escapeComment(error.message || error)} -->`);
  writeArtifact(`${baseName}.txt`, [
    `Check: ${check.name}`,
    `Suite: ${check.suite || ""}`,
    `URL: ${url}`,
    `Viewport: ${check.width}x${check.height}`,
    `Timed out: ${error.timedOut ? "yes" : "no"}`,
    `Attempt: ${error.attempt || 1}${error.maxAttempts ? ` of ${error.maxAttempts}` : ""}`,
    `Error: ${error.message || error}`,
    "",
    "Chrome stdout tail:",
    tailOutput(error.stdout),
    "",
    "Chrome stderr tail:",
    tailOutput(error.stderr)
  ].join("\n"));

  const screenshotPath = path.join(artifactDirectory(), `${baseName}.png`);
  try {
    await runChrome(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--force-device-scale-factor=1",
      "--high-dpi-support=1",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${check.width},${check.height}`,
      `--virtual-time-budget=${ROUTE_WAIT_MS}`,
      `--screenshot=${screenshotPath}`,
      url
    ], { label: `${check.name} screenshot`, timeoutMs: SCREENSHOT_TIMEOUT_MS });
  } catch (screenshotError) {
    writeArtifact(`${baseName}-screenshot-error.txt`, screenshotError.message || String(screenshotError));
  }
}

function artifactDirectory() {
  const directory = path.resolve(ROOT, ARTIFACT_DIR);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function writeArtifact(fileName, content) {
  fs.writeFileSync(path.join(artifactDirectory(), fileName), content);
}

function safeArtifactName(value) {
  return String(value || "golden-path")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "golden-path";
}

function escapeComment(value) {
  return String(value).replace(/--/g, "- -");
}

function tailOutput(value) {
  const text = String(value || "").trim();
  if (!text) return "(empty)";
  return text.slice(-CHROME_OUTPUT_TAIL);
}

async function startStaticServer() {
  const port = await findOpenPort(START_PORT);
  const child = spawn(process.execPath, [path.join(ROOT, "server", "static.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      AGORA_APP_HOST: HOST,
      AGORA_APP_PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  const baseUrl = `http://${HOST}:${port}`;
  await waitForServer(baseUrl, child, () => logs);
  return {
    baseUrl,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1500);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  };
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);

  const found = candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

  if (!found) {
    throw new Error("Chrome or Chromium was not found. Set CHROME_BIN to a local Chrome-compatible binary.");
  }

  return found;
}

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    const tryPort = () => {
      const probe = net.createServer();
      probe.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          port += 1;
          tryPort();
          return;
        }
        reject(error);
      });
      probe.once("listening", () => {
        probe.close(() => resolve(port));
      });
      probe.listen(port, HOST);
    };
    tryPort();
  });
}

function waitForServer(baseUrl, child, logsForError) {
  const deadline = Date.now() + 10000;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (child.exitCode !== null) {
        reject(new Error(`Golden path QA server exited early:\n${logsForError()}`));
        return;
      }
      requestUrlWithBody(baseUrl).then(resolve).catch((error) => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${baseUrl}: ${error.message}\n${logsForError()}`));
          return;
        }
        setTimeout(check, 150);
      });
    };
    check();
  });
}

function requestUrlWithBody(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body
          });
        }
        else reject(new Error(`HTTP ${response.statusCode}`));
      });
    });
    request.on("error", reject);
    request.setTimeout(2000, () => {
      request.destroy(new Error("request timed out"));
    });
  });
}

function runChrome(chromePath, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(options.timeoutMs || CHROME_TIMEOUT_MS);
    const label = options.label || "Chrome";
    let settled = false;
    const child = spawn(chromePath, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectChromeError(`${label} timed out after ${timeoutMs}ms`, {
        timedOut: true,
        stdout,
        stderr,
        reject
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        if (settled) return;
        settled = true;
        resolve(stdout);
        return;
      }
      rejectChromeError(`${label} exited with code ${code}`, {
        code,
        stdout,
        stderr,
        reject
      });
    });

    function rejectChromeError(message, details) {
      if (settled) return;
      settled = true;
      const error = new Error([
        message,
        "",
        "stdout:",
        tailOutput(details.stdout),
        "",
        "stderr:",
        tailOutput(details.stderr)
      ].join("\n"));
      error.exitCode = details.code;
      error.stdout = details.stdout;
      error.stderr = details.stderr;
      error.timedOut = Boolean(details.timedOut);
      details.reject(error);
    }
  });
}

function readNonNegativeNumber(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function readPositiveNumber(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
