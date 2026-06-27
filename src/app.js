const STORAGE_KEY = "agora.workspace.v1";

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

const currentMemberId = "mara";

const routes = {
  dashboard: "Dashboard",
  daily: "Today",
  board: "Board",
  list: "List",
  calendar: "Calendar",
  "my-work": "My Work",
  time: "Time",
  companies: "Companies",
  company: "Company",
  project: "Project"
};

const seedData = {
  selectedRoute: "dashboard",
  selectedProject: "all",
  selectedCompany: "all",
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
      dueDate: "2026-07-03",
      tags: ["planning", "mvp"],
      subtasks: [
        { id: "subtask-1-1", title: "Confirm release pillars", done: true },
        { id: "subtask-1-2", title: "Call out deferred enterprise scope", done: false },
        { id: "subtask-1-3", title: "Share scope with early contributors", done: false }
      ],
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
      dueDate: "2026-07-10",
      tags: ["docs", "ops"],
      subtasks: [
        { id: "subtask-2-1", title: "Outline local setup", done: true },
        { id: "subtask-2-2", title: "Draft deployment notes", done: false }
      ],
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
      dueDate: "2026-06-28",
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
      dueDate: "2026-07-12",
      tags: ["template", "clients"],
      subtasks: [
        { id: "subtask-4-1", title: "Capture sales handoff", done: true },
        { id: "subtask-4-2", title: "Define client kickoff tasks", done: false }
      ],
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
      dueDate: "2026-07-17",
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
      dueDate: "2026-07-08",
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
      dueDate: "2026-07-18",
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

const els = {
  appView: document.querySelector("#app-view"),
  pageTitle: document.querySelector("#page-title"),
  projectList: document.querySelector("#project-list"),
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

function loadState() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
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

function normalizeState(nextState) {
  return {
    ...nextState,
    selectedCalendarMonth: nextState.selectedCalendarMonth || seedData.selectedCalendarMonth,
    selectedDailyDate: nextState.selectedDailyDate || todayKey(),
    dailyNotes: { ...seedData.dailyNotes, ...(nextState.dailyNotes || {}) },
    dailyPlans: { ...seedData.dailyPlans, ...(nextState.dailyPlans || {}) },
    companies: nextState.companies.map((company) => ({
      type: "Client",
      status: "active",
      description: "",
      ...company
    })),
    tasks: nextState.tasks.map((task) => ({
      ...task,
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
    }))
  };
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function byId(collection, id) {
  return collection.find((item) => item.id === id);
}

function memberName(id) {
  return byId(members, id)?.name || "Unassigned";
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
  return state.tasks.filter((task) => dailyPlan(task.id)?.date === date && dailyPlan(task.id)?.lane === lane);
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
  return state.tasks.filter((task) => {
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
  const tasks = useFilters ? getFilteredTasks() : state.tasks;
  return tasks.filter((task) => task.projectId === projectId);
}

function getProjectMilestones(projectId) {
  return state.milestones.filter((milestone) => milestone.projectId === projectId);
}

function getCompanyProjects(companyId) {
  return state.projects.filter((project) => project.companyId === companyId);
}

function getCompanyTasks(companyId) {
  const projectIds = new Set(getCompanyProjects(companyId).map((project) => project.id));
  return state.tasks.filter((task) => projectIds.has(task.projectId));
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
    if (!task) return false;

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

function milestoneProgress(milestone) {
  const linkedTasks = milestone.taskIds.map((taskId) => byId(state.tasks, taskId)).filter(Boolean);
  return projectProgress(linkedTasks);
}

function addActivity({ projectId, taskId = "", memberId = currentMemberId, type, message }) {
  state.activities = [{
    id: uid("activity"),
    projectId,
    taskId,
    memberId,
    type,
    message,
    createdAt: new Date().toISOString()
  }, ...state.activities];
}

function setRoute(route) {
  state.selectedRoute = route;
  if (route !== "project") state.selectedProjectTab = "overview";
  if (route !== "company") state.selectedCompany = "all";
  saveState();
  render();
}

function setProject(projectId) {
  state.selectedProject = projectId;
  state.selectedRoute = projectId === "all" ? "dashboard" : "project";
  state.selectedProjectTab = "overview";
  if (projectId !== "all") state.filters.company = projectCompany(projectId)?.id || "all";
  saveState();
  render();
}

function setCompany(companyId) {
  state.selectedCompany = companyId;
  state.selectedRoute = companyId === "all" ? "companies" : "company";
  state.filters.company = companyId;
  state.selectedProject = "all";
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
}

function updateProjectDate(id, field, date) {
  const project = byId(state.projects, id);
  if (!project || project[field] === date) return;

  state.projects = state.projects.map((item) => item.id === id ? { ...item, [field]: date } : item);
  addActivity({
    projectId: id,
    type: "project_date",
    message: `changed project ${field === "startDate" ? "start" : "due"} date to ${formatFullDate(date)}`
  });
  saveState();
  render();
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

  if (previous.title !== next.title || previous.description !== next.description || previous.dueDate !== next.dueDate || previous.projectId !== next.projectId) {
    addActivity({
      projectId: next.projectId,
      taskId: next.id,
      type: "task_update",
      message: `updated ${next.title}`
    });
  }
}

function render() {
  const selectedProject = byId(state.projects, state.selectedProject);
  const selectedCompany = byId(state.companies, state.selectedCompany);
  els.pageTitle.textContent = state.selectedRoute === "project" && selectedProject
    ? selectedProject.name
    : state.selectedRoute === "company" && selectedCompany
      ? selectedCompany.name
      : routes[state.selectedRoute];
  document.querySelectorAll("[data-route]").forEach((item) => {
    const isCompaniesRoute = item.dataset.route === "companies" && state.selectedRoute === "company";
    item.classList.toggle("is-active", item.dataset.route === state.selectedRoute || isCompaniesRoute);
  });

  renderSidebarProjects();
  renderFilters();

  if (state.selectedRoute === "project") renderProjectPage();
  if (state.selectedRoute === "company") renderCompanyPage();
  if (state.selectedRoute === "daily") renderDailyTasks();
  if (state.selectedRoute === "board") renderBoard();
  if (state.selectedRoute === "list") renderList();
  if (state.selectedRoute === "calendar") renderCalendar();
  if (state.selectedRoute === "my-work") renderMyWork();
  if (state.selectedRoute === "time") renderTimeTracking();
  if (state.selectedRoute === "companies") renderCompanies();
  if (state.selectedRoute === "dashboard") renderDashboard();
}

function renderSidebarProjects() {
  const allCount = state.tasks.length;
  const projectButtons = state.projects.map((project) => {
    const taskCount = state.tasks.filter((task) => task.projectId === project.id).length;
    return `
      <button class="project-pill ${state.selectedProject === project.id ? "is-active" : ""}" type="button" data-project-id="${project.id}">
        <span>${escapeHtml(project.name)}</span>
        <small>${taskCount}</small>
      </button>
    `;
  }).join("");

  els.projectList.innerHTML = `
    <button class="project-pill ${state.selectedProject === "all" ? "is-active" : ""}" type="button" data-project-id="all">
      <span>All projects</span>
      <small>${allCount}</small>
    </button>
    ${projectButtons}
  `;
}

function renderFilters() {
  const projectOptions = state.filters.company === "all"
    ? state.projects
    : state.projects.filter((project) => project.companyId === state.filters.company);

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
    ${members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}
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

function renderDashboard() {
  const tasks = getFilteredTasks();
  const visibleProjects = state.filters.company === "all"
    ? state.projects
    : state.projects.filter((project) => project.companyId === state.filters.company);
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
        <span><strong>${formatDuration(trackedMinutes)}</strong> tracked</span>
      </div>
      <div class="progress-block" aria-label="${progress}% complete">
        <strong>${progress}%</strong>
        <span class="progress-track"><span style="width: ${progress}%"></span></span>
      </div>
      <div class="tag-row">
        <span>${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"}</span>
      </div>
      <button class="button button-secondary" type="button" data-edit-company="${company.id}">Edit Company</button>
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
  const projectTasks = state.tasks.filter((task) => task.projectId === project.id);
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
  if (!project) {
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
  return `
    <tr>
      <td>
        <button class="table-task-button" type="button" data-edit-task="${task.id}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(task.description)}</span>
          ${checklist ? `<span>${escapeHtml(checklist)}</span>` : ""}
        </button>
      </td>
      <td>${memberName(task.assignee)}</td>
      <td>${selectControl("status", task.id, task.status, statuses)}</td>
      <td>${selectControl("priority", task.id, task.priority, priorities)}</td>
      <td class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}</td>
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

  container.innerHTML = `
    <div class="collaboration-grid">
      <section>
        <div class="collaboration-header">
          <p class="eyebrow">Comments</p>
          <span>${comments.length}</span>
        </div>
        <div class="comment-list">
          ${comments.length ? comments.map(renderComment).join("") : emptyState("No comments yet.")}
        </div>
        <div class="comment-composer">
          <textarea id="comment-body" rows="3" placeholder="Add a comment"></textarea>
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
              ${members.map((member) => `<option value="${member.id}" ${member.id === currentMemberId ? "selected" : ""}>${member.name}</option>`).join("")}
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

function renderTimeTracking() {
  const entries = getFilteredTimeEntries();
  const billableEntries = entries.filter((entry) => entry.billable);
  const employeeRows = members.map((member) => {
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
  return `
    <article class="task-card" draggable="true" data-task-id="${task.id}">
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
      <div class="tag-row">
        ${task.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderTaskRow(task) {
  const company = projectCompany(task.projectId);
  const checklist = subtaskSummary(task);
  return `
    <tr>
      <td>
        <button class="table-task-button" type="button" data-edit-task="${task.id}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(task.description)}</span>
          ${checklist ? `<span>${escapeHtml(checklist)}</span>` : ""}
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
    </tr>
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
  document.querySelector("#task-due-date").value = task?.dueDate || "";
  document.querySelector("#task-tags").value = task?.tags?.join(", ") || "";
  draftSubtasks = taskSubtasks(task || {}).map((subtask) => ({ ...subtask }));
  els.taskFormTitle.textContent = task ? "Edit Task" : "New Task";

  const availableProjects = state.filters.company === "all"
    ? state.projects
    : state.projects.filter((project) => project.companyId === state.filters.company);
  const projectOptions = availableProjects.length ? availableProjects : state.projects;
  const selectedProject = task?.projectId || (state.selectedProject === "all" ? projectOptions[0]?.id : state.selectedProject);
  fillSelect("#task-project", projectOptions, selectedProject, "name");
  fillSelect("#task-assignee", members, task?.assignee || members[0].id, "name");
  fillSelect("#task-status", statuses, task?.status || "todo", "label");
  fillSelect("#task-priority", priorities, task?.priority || "normal", "label");
  renderTaskCollaboration(task?.id || "");
  renderTaskSubtasks();
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
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  dialog.close();
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

  state.comments = [{
    id: uid("comment"),
    taskId,
    author: currentMemberId,
    body,
    createdAt: new Date().toISOString()
  }, ...state.comments];

  addActivity({
    projectId: task.projectId,
    taskId,
    type: "comment",
    message: `commented on ${task.title}`
  });

  saveState();
  renderTaskCollaboration(taskId);
  render();
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

  state.timeEntries = [{
    id: uid("time"),
    taskId,
    memberId,
    date,
    minutes,
    note,
    billable,
    createdAt: new Date().toISOString()
  }, ...state.timeEntries];

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
}

function addQuickDailyTime(taskId, minutes = 30) {
  const task = byId(state.tasks, taskId);
  if (!task) return;

  state.timeEntries = [{
    id: uid("time"),
    taskId,
    memberId: currentMemberId,
    date: state.selectedDailyDate,
    minutes,
    note: "Daily focus block",
    billable: false,
    createdAt: new Date().toISOString()
  }, ...state.timeEntries];

  addActivity({
    projectId: task.projectId,
    taskId,
    type: "time_log",
    message: `logged ${formatDuration(minutes)} on ${task.title}`
  });
  saveState();
  render();
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) setRoute(routeButton.dataset.route);

  const projectButton = event.target.closest("[data-project-id]");
  if (projectButton) setProject(projectButton.dataset.projectId);

  const companyButton = event.target.closest("[data-company-id]");
  if (companyButton) setCompany(companyButton.dataset.companyId);

  const newCompanyButton = event.target.closest("#new-company-button");
  if (newCompanyButton) {
    populateCompanyForm();
    openDialog(els.companyDialog);
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
  }

  const dailyTodayButton = event.target.closest("[data-daily-today]");
  if (dailyTodayButton) {
    state.selectedDailyDate = todayKey();
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
    populateTaskForm(byId(state.tasks, editButton.dataset.editTask));
    openDialog(els.taskDialog);
  }

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) closeDialog(document.querySelector(`#${closeButton.dataset.closeDialog}`));
});

document.addEventListener("change", (event) => {
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

document.querySelector("#seed-reset").addEventListener("click", () => {
  state = structuredClone(seedData);
  saveState();
  render();
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
    dueDate: document.querySelector("#task-due-date").value,
    tags: document.querySelector("#task-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    subtasks: draftSubtasks,
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
});

render();
