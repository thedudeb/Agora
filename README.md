# Agora

Open source project management for teams that want clarity without lock-in.

Agora is a self-hostable project management workspace inspired by tools like Asana and Nifty. It is designed for teams that need projects, tasks, views, collaboration, milestones, and visibility while keeping control of their data and workflow.

## Status

Agora is in early prototype development. The current app is a dependency-free browser prototype with seeded workspace data, local persistence, company portfolios, editable companies, daily task planning, project filters, task creation, subtasks, comments, activity, employee time tracking, list view, board view, calendar view, project workspaces, milestones, project timelines, and a My Work view.

## Run Locally

```sh
npm run dev
```

Then open `http://localhost:5174`.

The prototype stores changes in browser local storage. Use "Reset sample data" in the sidebar to restore the seeded workspace.

## Product Principles

- Clear enough for non-technical teams.
- Practical enough for day-to-day project work.
- Open enough to self-host, inspect, extend, and contribute to.
- Focused enough to avoid becoming a bloated all-in-one workspace.

## Planned MVP

- Workspaces, members, and roles.
- Projects with list, board, and calendar or timeline views.
- Tasks with assignees, due dates, priorities, comments, attachments, and subtasks.
- Project dashboards for progress, overdue work, milestones, and recent activity.
- Templates for common workflows such as product roadmaps, client delivery, campaigns, and operations.
- Self-hosting documentation, data export, and an initial integration surface.

## Repository Structure

- `prds/` contains product requirements and planning documents.
- `index.html` contains the first browser prototype shell.
- `src/` contains prototype application logic and styles.
- `assets/` contains brand and interface assets.
- `ROADMAP.md` outlines the release direction.
- `CONTRIBUTING.md` explains how to contribute.
- `.github/ISSUE_TEMPLATE/` contains starter issue templates.

## Name

In ancient Greece, the agora was a public gathering place for discussion, trade, and civic organization. This project uses that idea as a metaphor for a shared place where teams gather around their work.

## License

Agora is licensed under the GNU Affero General Public License v3.0. See `LICENSE` for details.
