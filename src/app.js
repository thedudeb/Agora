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

const routes = {
  dashboard: "Dashboard",
  board: "Board",
  list: "List",
  "my-work": "My Work"
};

const seedData = {
  selectedRoute: "dashboard",
  selectedProject: "all",
  filters: {
    assignee: "all",
    status: "all",
    priority: "all",
    query: ""
  },
  projects: [
    {
      id: "launch",
      name: "Agora MVP Launch",
      description: "Define and ship the first public version of Agora.",
      owner: "mara",
      dueDate: "2026-08-21"
    },
    {
      id: "client-delivery",
      name: "Client Delivery Template",
      description: "Create a reusable workflow for agencies and service teams.",
      owner: "sam",
      dueDate: "2026-07-31"
    },
    {
      id: "design-system",
      name: "Design System",
      description: "Establish core interaction patterns and reusable interface pieces.",
      owner: "nina",
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
      createdAt: "2026-06-27T13:00:00.000Z"
    }
  ]
};

let state = loadState();

const els = {
  appView: document.querySelector("#app-view"),
  pageTitle: document.querySelector("#page-title"),
  projectList: document.querySelector("#project-list"),
  searchInput: document.querySelector("#search-input"),
  projectFilter: document.querySelector("#project-filter"),
  assigneeFilter: document.querySelector("#assignee-filter"),
  statusFilter: document.querySelector("#status-filter"),
  priorityFilter: document.querySelector("#priority-filter"),
  taskDialog: document.querySelector("#task-dialog"),
  taskForm: document.querySelector("#task-form"),
  taskFormTitle: document.querySelector("#task-form-title"),
  projectDialog: document.querySelector("#project-dialog"),
  projectForm: document.querySelector("#project-form")
};

function loadState() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(seedData);

  try {
    return { ...structuredClone(seedData), ...JSON.parse(stored) };
  } catch {
    return structuredClone(seedData);
  }
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

function statusLabel(id) {
  return byId(statuses, id)?.label || id;
}

function priorityLabel(id) {
  return byId(priorities, id)?.label || id;
}

function formatDate(date) {
  if (!date) return "No date";
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
      task.tags.join(" ")
    ].join(" ").toLowerCase();

    return (
      (state.selectedProject === "all" || task.projectId === state.selectedProject) &&
      (state.filters.assignee === "all" || task.assignee === state.filters.assignee) &&
      (state.filters.status === "all" || task.status === state.filters.status) &&
      (state.filters.priority === "all" || task.priority === state.filters.priority) &&
      (!query || haystack.includes(query))
    );
  });
}

function setRoute(route) {
  state.selectedRoute = route;
  saveState();
  render();
}

function setProject(projectId) {
  state.selectedProject = projectId;
  saveState();
  render();
}

function updateTask(id, updates) {
  state.tasks = state.tasks.map((task) => task.id === id ? { ...task, ...updates } : task);
  saveState();
  render();
}

function render() {
  els.pageTitle.textContent = routes[state.selectedRoute];
  document.querySelectorAll("[data-route]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.route === state.selectedRoute);
  });

  renderSidebarProjects();
  renderFilters();

  if (state.selectedRoute === "board") renderBoard();
  if (state.selectedRoute === "list") renderList();
  if (state.selectedRoute === "my-work") renderMyWork();
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
  els.searchInput.value = state.filters.query;
  els.projectFilter.innerHTML = `
    <option value="all">All projects</option>
    ${state.projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}
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

  els.projectFilter.value = state.selectedProject;
  els.assigneeFilter.value = state.filters.assignee;
  els.statusFilter.value = state.filters.status;
  els.priorityFilter.value = state.filters.priority;
}

function renderDashboard() {
  const tasks = getFilteredTasks();
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
          ${state.projects.map(renderProjectSummary).join("")}
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
  const done = projectTasks.filter((task) => task.status === "done").length;
  const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
  return `
    <article class="project-summary">
      <div>
        <h3>${escapeHtml(project.name)}</h3>
        <p>${escapeHtml(project.description)}</p>
        <div class="meta-row">
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

function renderTaskCard(task) {
  return `
    <article class="task-card" draggable="true" data-task-id="${task.id}">
      <button class="task-card-main" type="button" data-edit-task="${task.id}">
        <span class="task-project">${escapeHtml(projectName(task.projectId))}</span>
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(task.description)}</span>
      </button>
      <div class="task-meta">
        <span class="avatar">${memberName(task.assignee).split(" ").map((part) => part[0]).join("")}</span>
        <span class="priority priority-${task.priority}">${priorityLabel(task.priority)}</span>
        <span class="${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.dueDate)}</span>
      </div>
      <div class="tag-row">
        ${task.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderTaskRow(task) {
  return `
    <tr>
      <td>
        <button class="table-task-button" type="button" data-edit-task="${task.id}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(task.description)}</span>
        </button>
      </td>
      <td>${escapeHtml(projectName(task.projectId))}</td>
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
  els.taskFormTitle.textContent = task ? "Edit Task" : "New Task";

  const selectedProject = task?.projectId || (state.selectedProject === "all" ? state.projects[0]?.id : state.selectedProject);
  fillSelect("#task-project", state.projects, selectedProject, "name");
  fillSelect("#task-assignee", members, task?.assignee || members[0].id, "name");
  fillSelect("#task-status", statuses, task?.status || "todo", "label");
  fillSelect("#task-priority", priorities, task?.priority || "normal", "label");
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
  document.querySelector("#project-due-date").value = "";
  fillSelect("#project-owner", members, members[0].id, "name");
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

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) setRoute(routeButton.dataset.route);

  const projectButton = event.target.closest("[data-project-id]");
  if (projectButton) setProject(projectButton.dataset.projectId);

  const editButton = event.target.closest("[data-edit-task]");
  if (editButton) {
    populateTaskForm(byId(state.tasks, editButton.dataset.editTask));
    openDialog(els.taskDialog);
  }

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) closeDialog(document.querySelector(`#${closeButton.dataset.closeDialog}`));
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
  const select = event.target.closest("[data-inline-field]");
  if (!select) return;
  updateTask(select.dataset.taskId, { [select.dataset.inlineField]: select.value });
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
    createdAt: byId(state.tasks, id)?.createdAt || new Date().toISOString()
  };

  if (byId(state.tasks, id)) {
    state.tasks = state.tasks.map((item) => item.id === id ? task : item);
  } else {
    state.tasks = [task, ...state.tasks];
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
    description: document.querySelector("#project-description").value.trim(),
    owner: document.querySelector("#project-owner").value,
    dueDate: document.querySelector("#project-due-date").value
  };

  state.projects = [project, ...state.projects];
  state.selectedProject = project.id;
  saveState();
  closeDialog(els.projectDialog);
  render();
});

render();

