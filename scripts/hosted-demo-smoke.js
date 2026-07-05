#!/usr/bin/env node
const http = require("node:http");
const https = require("node:https");
const { spawn } = require("node:child_process");
const { buildDemoLinks, readCatalog } = require("./demo-links");

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  if (!args.base) {
    printHelp();
    throw new Error("Missing required --base <url>");
  }

  const base = normalizeBase(args.base);
  const catalog = readCatalog();
  const report = buildDemoLinks(catalog, { base, demo: "acme-client-launch" });
  const acme = report.demos[0];
  const routeChecks = hostedRouteChecks(report);
  const checks = [
    check("Base URL is HTTPS", base.startsWith("https://") || args.allowHttp, `base=${base}`, "Use HTTPS for public demos, or pass --allow-http for local rehearsals."),
    check("Acme demo has six tour links", acme?.tour?.length === 6, `${acme?.tour?.length || 0} links`, "Keep acme-client-launch aligned with the hosted demo runbook."),
    check("Generated links use hosted base", JSON.stringify(acme).includes(base), base, "Generate links with the public hosted app URL.")
  ];

  if (!args.noLive) {
    for (const route of routeChecks) {
      const result = await requestRoute(route.url, args.timeoutMs);
      checks.push(check(`${route.label} responds`, result.ok, `${result.statusCode || "ERR"} ${route.url}`, result.error || "Expected HTTP 2xx/3xx/4xx but not a network failure or 5xx."));
    }
  }

  let goldenResult = null;
  if (args.golden) {
    goldenResult = await runGolden(base);
    checks.push(check("Hosted Acme golden path passes", goldenResult.ok, `exitCode=${goldenResult.exitCode}`, "Run AGORA_GOLDEN_BASE_URL=<url> AGORA_GOLDEN_SUITE=demo npm run test:golden and fix route failures."));
  }

  const summary = checks.reduce((counts, item) => {
    counts.total += 1;
    counts[item.status] += 1;
    return counts;
  }, { total: 0, pass: 0, fail: 0 });

  console.log("Hosted Demo Smoke Check");
  console.log(`Base: ${base}`);
  console.log(`Mode: ${args.noLive ? "links-only" : args.golden ? "live+golden" : "live"}`);
  console.log(`Status: ${summary.fail ? "FAIL" : "PASS"}`);
  console.log(`Summary: ${summary.pass}/${summary.total} passed`);
  console.log("");
  checks.forEach((item) => {
    console.log(`[${item.status === "pass" ? "PASS" : "FAIL"}] ${item.title}`);
    if (item.detail) console.log(`  Detail: ${item.detail}`);
    if (item.status === "fail" && item.fix) console.log(`  Fix: ${item.fix}`);
  });
  console.log("");
  console.log("Acme links:");
  acme.tour.forEach((stop) => console.log(`- ${stop.label}: ${stop.url}`));

  if (goldenResult?.output) {
    console.log("");
    console.log("Golden output:");
    console.log(goldenResult.output.trim());
  }

  if (summary.fail) process.exitCode = 1;
}

function parseArgs(values) {
  return values.reduce((result, value) => {
    if (result.pending) {
      result[result.pending] = value;
      result.pending = "";
    } else if (value === "--base") result.pending = "base";
    else if (value.startsWith("--base=")) result.base = value.slice("--base=".length);
    else if (value === "--no-live") result.noLive = true;
    else if (value === "--allow-http") result.allowHttp = true;
    else if (value === "--golden") result.golden = true;
    else if (value === "--timeout") result.pending = "timeoutMs";
    else if (value.startsWith("--timeout=")) result.timeoutMs = Number(value.slice("--timeout=".length));
    else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
    return result;
  }, { base: "", noLive: false, allowHttp: false, golden: false, timeoutMs: 10000, pending: "" });
}

function hostedRouteChecks(report) {
  const acme = report.demos[0];
  return [
    { label: "Landing", url: routeWith(report.base, "landing") },
    { label: "Public feedback", url: routeWith(report.base, "feedback") },
    { label: "Acme entry", url: acme.entryUrl },
    ...acme.tour.map((stop) => ({ label: stop.label, url: stop.url }))
  ];
}

function routeWith(base, route) {
  const url = new URL(base);
  url.searchParams.set("route", route);
  return url.toString();
}

function requestRoute(url, timeoutMs) {
  return new Promise((resolve) => {
    const client = url.startsWith("https://") ? https : http;
    const request = client.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      response.on("end", () => {
        const statusCode = response.statusCode || 0;
        resolve({ ok: statusCode >= 200 && statusCode < 500, statusCode });
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("request timed out"));
    });
    request.on("error", (error) => {
      resolve({ ok: false, statusCode: 0, error: error.message });
    });
  });
}

function runGolden(base) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", "test:golden"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AGORA_GOLDEN_BASE_URL: base,
        AGORA_GOLDEN_SUITE: "demo"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("exit", (code) => {
      resolve({ ok: code === 0, exitCode: code, output });
    });
  });
}

function check(title, pass, detail = "", fix = "") {
  return { title, status: pass ? "pass" : "fail", detail, fix };
}

function normalizeBase(base) {
  const url = new URL(base);
  return url.toString().replace(/\/+$/, "");
}

function printHelp() {
  console.log(`Hosted demo smoke check

Usage:
  npm run demo:hosted:check -- --base https://demo.example.com
  npm run demo:hosted:check -- --base https://demo.example.com --golden
  npm run demo:hosted:check -- --base https://demo.example.com --no-live

Options:
  --base <url>    Hosted app URL.
  --golden        Also run AGORA_GOLDEN_BASE_URL=<base> AGORA_GOLDEN_SUITE=demo npm run test:golden.
  --no-live       Validate generated hosted links without network requests.
  --allow-http    Allow http:// URLs for local rehearsals.
  --timeout <ms>  Request timeout. Default: 10000.
`);
}
