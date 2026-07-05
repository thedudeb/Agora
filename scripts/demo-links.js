#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "demos", "workspaces.json");

const args = parseArgs(process.argv.slice(2));
const catalog = readCatalog();
const report = buildDemoLinks(catalog, args);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

function parseArgs(values) {
  return values.reduce((result, value) => {
    if (result.pending) {
      result[result.pending] = value;
      result.pending = "";
    } else if (value === "--base") result.pending = "base";
    else if (value.startsWith("--base=")) result.base = value.slice("--base=".length);
    else if (value === "--demo") result.pending = "demo";
    else if (value.startsWith("--demo=")) result.demo = value.slice("--demo=".length);
    else if (value === "--json") result.json = true;
    else if (value === "--markdown") result.markdown = true;
    else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
    return result;
  }, { base: "http://127.0.0.1:5174", demo: "", json: false, markdown: false, pending: "" });
}

function readCatalog() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  validateCatalog(catalog);
  return catalog;
}

function validateCatalog(catalog) {
  if (catalog.type !== "agora.demo-workspace-catalog") throw new Error("Demo catalog type is invalid");
  if (catalog.version !== 1) throw new Error("Demo catalog version must be 1");
  if (!Array.isArray(catalog.demos) || !catalog.demos.length) throw new Error("Demo catalog needs at least one demo");
  catalog.demos.forEach((demo) => {
    if (!demo.id || !demo.name || !demo.entryRoute) throw new Error("Every demo needs id, name, and entryRoute");
    if (!Array.isArray(demo.tour) || !demo.tour.length) throw new Error(`${demo.id} needs a tour`);
    ["storyBeats", "proofMoments", "nextClicks"].forEach((field) => {
      if (demo[field] && !Array.isArray(demo[field])) throw new Error(`${demo.id} ${field} must be an array`);
    });
  });
}

function buildDemoLinks(catalog, options = {}) {
  const demos = options.demo
    ? catalog.demos.filter((demo) => demo.id === options.demo)
    : catalog.demos;
  if (options.demo && !demos.length) throw new Error(`Unknown demo: ${options.demo}`);
  return {
    generatedAt: new Date().toISOString(),
    base: normalizeBaseUrl(options.base),
    catalog: {
      type: catalog.type,
      version: catalog.version,
      updatedAt: catalog.updatedAt,
      baseWorkspace: catalog.baseWorkspace
    },
    evaluationLinks: evaluationLinks(options.base),
    demos: demos.map((demo) => ({
      ...demo,
      entryUrl: routeUrl(options.base, demo.entryRoute),
      tour: demo.tour.map((stop) => ({
        ...stop,
        url: routeUrl(options.base, stop.route, stop)
      }))
    }))
  };
}

function evaluationLinks(base) {
  return [
    {
      label: "Start beta workspace",
      url: routeUrl(base, "beta", { demoAction: "startBetaWorkspace" }),
      use: "Loads the beta workspace and starts First 10 minutes mode."
    },
    {
      label: "Acme client launch story",
      url: routeUrl(base, "command-center", { demoAction: "sampleAgencyWorkspace" }),
      use: "Walks the default PM story: intake, scope, approval, timeline risk, client update, and recovery proof."
    },
    {
      label: "Agency PM deep dive",
      url: routeUrl(base, "command-center", { demoAction: "sampleAgencyWorkspace" }),
      use: "Creates a realistic agency sample and opens the PM command center."
    },
    {
      label: "Autopilot safety demo",
      url: routeUrl(base, "autopilot", { demoAction: "autopilotDemo" }),
      use: "Opens the safety-first automation review path."
    },
    {
      label: "Recovery proof",
      url: routeUrl(base, "data", { demoAction: "recoveryPlan" }),
      use: "Opens portable export, backups, restore, and offline contract proof."
    }
  ];
}

function normalizeBaseUrl(base) {
  return String(base || "http://127.0.0.1:5174").replace(/\/+$/, "");
}

function routeUrl(base, route, options = {}) {
  const url = new URL(normalizeBaseUrl(base));
  url.searchParams.set("route", route);
  Object.entries(options).forEach(([key, value]) => {
    if (["label", "route", "url", "use", "outcome"].includes(key)) return;
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value) || typeof value === "object") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function printReport(report) {
  if (args.markdown) {
    console.log(`# Agora Demo Links`);
    console.log("");
    console.log(`Base: ${report.base}`);
    console.log(`Workspace: ${report.catalog.baseWorkspace}`);
    console.log("");
    console.log("## Evaluation Links");
    report.evaluationLinks.forEach((link) => console.log(`- **${link.label}**: ${link.url} - ${link.use}`));
    report.demos.forEach((demo) => {
      console.log("");
      console.log(`## ${demo.name}`);
      console.log("");
      console.log(`${demo.description}`);
      console.log("");
      console.log(`Audience: ${demo.audience}`);
      console.log(`Highlights: ${demo.highlights.join(", ")}`);
      printMarkdownList("Story Beats", demo.storyBeats, (beat) => `${beat.label}: ${beat.outcome}`);
      printMarkdownList("Proof Moments", demo.proofMoments, (item) => item);
      printMarkdownList("What To Click Next", demo.nextClicks, (item) => item);
      console.log(`Entry: ${demo.entryUrl}`);
      console.log("");
      console.log("Tour:");
      demo.tour.forEach((stop) => console.log(`- ${stop.label}: ${stop.url}`));
    });
    return;
  }

  console.log("Agora demo links");
  console.log(`Base: ${report.base}`);
  console.log(`Workspace: ${report.catalog.baseWorkspace}`);
  console.log("");
  console.log("Evaluation links");
  report.evaluationLinks.forEach((link) => console.log(`- ${link.label}: ${link.url}`));
  report.demos.forEach((demo) => {
    console.log("");
    console.log(`${demo.name} (${demo.audience})`);
    console.log(`Entry: ${demo.entryUrl}`);
    console.log(`Highlights: ${demo.highlights.join(", ")}`);
    if (demo.storyBeats?.length) {
      console.log("Story beats:");
      demo.storyBeats.forEach((beat) => console.log(`- ${beat.label}: ${beat.outcome}`));
    }
    if (demo.nextClicks?.length) {
      console.log("What to click next:");
      demo.nextClicks.forEach((item) => console.log(`- ${item}`));
    }
    demo.tour.forEach((stop) => console.log(`- ${stop.label}: ${stop.url}`));
  });
}

function printMarkdownList(title, items, formatter) {
  if (!Array.isArray(items) || !items.length) return;
  console.log(`### ${title}`);
  console.log("");
  items.forEach((item) => console.log(`- ${formatter(item)}`));
  console.log("");
}

function printHelp() {
  console.log(`Agora demo links

Usage:
  npm run demo:links -- [--base https://demo.example.com] [--demo agency-command-center] [--markdown] [--json]
  npm run agora -- demo links [--base https://demo.example.com] [--markdown]

Options:
  --base <url>   App base URL. Default: http://127.0.0.1:5174
  --demo <id>    Print one demo from demos/workspaces.json
  --markdown     Print a Markdown handoff
  --json         Print machine-readable JSON
`);
}
