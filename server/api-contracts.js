const workspace = {
  id: "workspace-acme",
  name: "Acme Studio",
  slug: "acme-studio"
};

const demoUsers = [
  { id: "mara", name: "Mara Chen", email: "mara@acme.test" },
  { id: "eli", name: "Eli Stone", email: "eli@acme.test" },
  { id: "nina", name: "Nina Patel", email: "nina@acme.test" },
  { id: "sam", name: "Sam Rivera", email: "sam@acme.test" }
];

const demoMemberships = [
  { memberId: "mara", role: "admin", status: "active" },
  { memberId: "eli", role: "manager", status: "active" },
  { memberId: "nina", role: "member", status: "active" },
  { memberId: "sam", role: "manager", status: "active" }
];

const rolePermissions = {
  admin: ["workspace:read", "workspace:write", "workspace:import", "audit:read", "members:write", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write"],
  manager: ["workspace:read", "workspace:write", "audit:read", "projects:write", "tasks:write", "time:write", "comments:write", "activity:write", "attachments:write", "approvals:write", "notifications:write", "integrations:write", "scheduler:run", "payments:write"],
  member: ["workspace:read", "time:write", "comments:write", "activity:write", "attachments:write"],
  client: ["workspace:read", "comments:write", "activity:write", "approvals:write"]
};

module.exports = {
  workspace,
  demoUsers,
  demoMemberships,
  rolePermissions
};
