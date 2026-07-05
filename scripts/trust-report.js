#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));

const trackerNeedles = [
  "gtag(",
  "google-analytics",
  "googletagmanager",
  "segment.com",
  "mixpanel",
  "posthog",
  "plausible.io",
  "doubleclick.net",
  "facebook.net",
  "fbq("
];

const runtimeFiles = [
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "sw.js",
  "src/app.js",
  "src/boot.js",
  "server/api.js",
  "server/static.js"
];

const packageJson = readJson("package.json");
const scripts = packageJson.scripts || {};
const readme = read("README.md").toLowerCase();
const security = read("SECURITY.md").toLowerCase();
const api = read("server/api.js");
const staticServer = read("server/static.js");
const migrationConcierge = read("scripts/migration-concierge.js");
const migrationDocs = read("docs/migration-tool.md").toLowerCase();
const migrationConciergeIsReady = migrationConciergeReady();
const trustEvidenceMatrix = read("docs/trust-evidence-matrix.md").toLowerCase();
const aiDataPolicy = read("docs/ai-data-policy.md").toLowerCase();
const securityAuditReceipt = read("docs/security-audit-2026-07-05.md").toLowerCase();
const trustEvidenceMatrixIsReady = trustEvidenceMatrixReady();
const aiDataPolicyIsReady = aiDataPolicyReady();
const securityAuditReceiptIsReady = securityAuditReceiptReady();

const checks = [
  check({
    id: "privacy-promise",
    category: "Product promise",
    title: "README states the no ads, no trackers, no lock-in promise",
    pass: readme.includes("without ads, trackers, or lock-in"),
    evidence: ["README.md"],
    fix: "Keep the public positioning explicit so evaluators can inspect the promise quickly."
  }),
  check({
    id: "runtime-trackers",
    category: "Privacy",
    title: "Runtime files contain no known third-party tracking tokens",
    pass: trackerFindings().length === 0,
    evidence: runtimeFiles,
    detail: trackerFindings().length ? trackerFindings().join("; ") : "No tracker tokens found in runtime files.",
    fix: "Remove analytics/tracker snippets from runtime files or document and gate them explicitly."
  }),
  check({
    id: "server-only-secrets",
    category: "Security",
    title: "Security policy keeps production secrets server-only",
    pass: ["service-role", "ai provider keys", "stripe", "smtp", "webhook secrets"].every((needle) => security.includes(needle)),
    evidence: ["SECURITY.md"],
    fix: "Document secret handling for Supabase, AI providers, payment adapters, SMTP, and webhooks."
  }),
  check({
    id: "static-security-headers",
    category: "Security",
    title: "Static server emits browser security headers",
    pass: ["Content-Security-Policy", "Cross-Origin-Opener-Policy", "Referrer-Policy"].every((needle) => staticServer.includes(needle)),
    evidence: ["server/static.js"],
    fix: "Set CSP, COOP, and Referrer-Policy headers from the static app server."
  }),
  check({
    id: "api-security-headers",
    category: "Security",
    title: "API emits defensive response headers",
    pass: ["X-Content-Type-Options", "Referrer-Policy", "Cross-Origin-Opener-Policy"].every((needle) => api.includes(needle)),
    evidence: ["server/api.js"],
    fix: "Set baseline security headers on API responses."
  }),
  check({
    id: "admin-diagnostics",
    category: "Operations",
    title: "API exposes redacted admin diagnostics and release metadata",
    pass: ["function releaseMetadata", "buildAdminDiagnostics", "/api/admin/diagnostics", "AGORA_RELEASE_COMMIT"].every((needle) => api.includes(needle)),
    evidence: ["server/api.js", "docs/deployment.md"],
    fix: "Keep release metadata and redacted diagnostics available for production support."
  }),
  check({
    id: "backup-drill",
    category: "Recovery",
    title: "Disaster recovery drill is documented and runnable",
    pass: Boolean(scripts["drill:recovery"]) && exists("scripts/disaster-recovery-drill.js") && exists("docs/disaster-recovery-drill.md"),
    evidence: ["scripts/disaster-recovery-drill.js", "docs/disaster-recovery-drill.md"],
    fix: "Expose an isolated restore drill so operators can prove backups restore cleanly."
  }),
  check({
    id: "upgrade-gate",
    category: "Operations",
    title: "Production upgrades have a preflight gate",
    pass: Boolean(scripts["verify:upgrade"]) && exists("scripts/upgrade-safety-check.js") && exists("docs/upgrade-checklist.md"),
    evidence: ["scripts/upgrade-safety-check.js", "docs/upgrade-checklist.md"],
    fix: "Keep migration and backup freshness checks in the upgrade path."
  }),
  check({
    id: "portable-workspace",
    category: "Portability",
    title: "Portable workspace contract is documented and fixture-backed",
    pass: exists("docs/portable-workspace.md") && exists("tests/fixtures/portable-workspace-bundle.json") && Boolean(scripts["test:fixtures"]),
    evidence: ["docs/portable-workspace.md", "tests/fixtures/portable-workspace-bundle.json"],
    fix: "Maintain fixture-backed portable exports so teams can leave or restore without lock-in."
  }),
  check({
    id: "migration-concierge",
    category: "Portability",
    title: "Migration concierge verifies safe competitor imports",
    pass: migrationConciergeIsReady,
    detail: migrationConciergeIsReady ? "Concierge covers field coverage, cleanup, rollback, apply strategy, reviewer checklist, and regression tests." : "",
    evidence: ["scripts/migration-concierge.js", "scripts/migration-concierge-test.js", "docs/migration-tool.md"],
    fix: "Keep migration preflight, report sections, docs, and regression coverage available before importing third-party exports."
  }),
  check({
    id: "hosted-readiness",
    category: "Operations",
    title: "Hosted production readiness checks are documented and runnable",
    pass: Boolean(scripts["verify:hosted"]) && exists("scripts/hosted-env-verify.js") && exists("docs/hosted-launch-runbook.md"),
    evidence: ["scripts/hosted-env-verify.js", "docs/hosted-launch-runbook.md"],
    fix: "Expose hosted environment checks for production launches."
  }),
  check({
    id: "ecosystem-contract",
    category: "Extensibility",
    title: "Plugin and MCP ecosystem contract is inspectable",
    pass: Boolean(scripts.ecosystem) && exists("ecosystem/extension-points.json") && exists("docs/ecosystem.md"),
    evidence: ["ecosystem/extension-points.json", "docs/ecosystem.md"],
    fix: "Keep extension points declared, permissioned, and validated."
  }),
  check({
    id: "trust-evidence-matrix",
    category: "Customer evidence",
    title: "Buyer trust evidence matrix maps claims to proof",
    pass: trustEvidenceMatrixIsReady,
    detail: trustEvidenceMatrixIsReady ? "Evidence matrix covers claims, evidence files, verification commands, cadence, AI, audits, recovery, migration, and extensions." : "",
    evidence: ["docs/trust-evidence-matrix.md", "docs/trust-center.md"],
    fix: "Restore the evidence matrix with claim, artifact, command, and cadence coverage for buyer/security review."
  }),
  check({
    id: "ai-data-policy",
    category: "AI governance",
    title: "AI data policy documents provider defaults and controls",
    pass: aiDataPolicyIsReady,
    detail: aiDataPolicyIsReady ? "AI policy covers external-provider defaults, server-only keys, context minimization, previews, rationale, audit, undo, and provider review." : "",
    evidence: ["docs/ai-data-policy.md", "SECURITY.md", "docs/api-agent-contract.md", "docs/project-autopilot.md"],
    fix: "Keep AI provider defaults, data-use rules, user controls, audit evidence, and provider review requirements documented."
  }),
  check({
    id: "security-audit-receipt",
    category: "Security",
    title: "Security and dependency audit receipt is recorded",
    pass: securityAuditReceiptIsReady,
    detail: securityAuditReceiptIsReady ? "Security audit receipt includes verification commands, npm audit commands, results, and remaining follow-up." : "",
    evidence: ["docs/security-audit-2026-07-05.md", "package.json", "desktop/package-lock.json"],
    fix: "Record the latest security audit, dependency audit commands, results, and unresolved follow-up before release."
  }),
  check({
    id: "trust-center-doc",
    category: "Customer evidence",
    title: "Trust Center documentation exists for evaluators",
    pass: exists("docs/trust-center.md"),
    evidence: ["docs/trust-center.md"],
    fix: "Add a Trust Center doc that explains the report, evidence, and operator cadence."
  })
];

const summary = checks.reduce((counts, item) => {
  counts.total += 1;
  counts[item.status] += 1;
  return counts;
}, { total: 0, pass: 0, fail: 0 });

const report = {
  type: "agora.trust-report",
  generatedAt: new Date().toISOString(),
  ok: summary.fail === 0,
  summary,
  checks
};

if (args.has("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

if (!report.ok) process.exitCode = 1;

function check({ id, category, title, pass, detail = "", evidence = [], fix = "" }) {
  return {
    id,
    category,
    title,
    status: pass ? "pass" : "fail",
    detail,
    evidence,
    fix
  };
}

function trackerFindings() {
  return runtimeFiles.flatMap((file) => {
    const contents = read(file).toLowerCase();
    return trackerNeedles
      .filter((needle) => contents.includes(needle))
      .map((needle) => `${file}: ${needle}`);
  });
}

function migrationConciergeReady() {
  const requiredScriptTokens = [
    "migrationFieldCoverage",
    "migrationCleanupChecklist",
    "migrationRollbackPlan",
    "migrationApplyStrategy",
    "migrationReviewerChecklist"
  ];
  const requiredDocTokens = [
    "field coverage",
    "cleanup checklist",
    "rollback plan",
    "reviewer checklist",
    "apply strategy"
  ];
  return Boolean(scripts["migrate:concierge"]) &&
    Boolean(scripts["test:importers"]?.includes("migration-concierge-test")) &&
    exists("scripts/migration-concierge.js") &&
    exists("scripts/migration-concierge-test.js") &&
    exists("docs/migration-tool.md") &&
    requiredScriptTokens.every((needle) => migrationConcierge.includes(needle)) &&
    requiredDocTokens.every((needle) => migrationDocs.includes(needle));
}

function trustEvidenceMatrixReady() {
  const requiredTokens = [
    "trust claim",
    "verification command",
    "review cadence",
    "npm run trust",
    "dependency audits",
    "ai operator actions",
    "competitor migrations",
    "extension surfaces"
  ];
  return exists("docs/trust-evidence-matrix.md") &&
    exists("docs/trust-center.md") &&
    requiredTokens.every((needle) => trustEvidenceMatrix.includes(needle));
}

function aiDataPolicyReady() {
  const requiredPolicyTokens = [
    "agora works without an external ai provider",
    "external ai provider keys must stay on the api server",
    "agora_ai_allow_client_base_url=false",
    "smallest useful context",
    "proposed change before it is applied",
    "plain-language rationale",
    "audit event or operator ledger",
    "undo or recovery path",
    "provider review checklist"
  ];
  const requiredSecurityTokens = [
    "ai provider keys server-only",
    "agora_ai_allow_client_base_url=false"
  ];
  return exists("docs/ai-data-policy.md") &&
    exists("SECURITY.md") &&
    exists("docs/api-agent-contract.md") &&
    exists("docs/project-autopilot.md") &&
    requiredPolicyTokens.every((needle) => aiDataPolicy.includes(needle)) &&
    requiredSecurityTokens.every((needle) => security.includes(needle));
}

function securityAuditReceiptReady() {
  const requiredTokens = [
    "security audit - 2026-07-05",
    "npm run test:admin-security",
    "npm audit --audit-level=moderate",
    "npm --prefix desktop audit --audit-level=moderate",
    "no moderate-or-higher dependency vulnerabilities",
    "remaining follow-up"
  ];
  return exists("docs/security-audit-2026-07-05.md") &&
    requiredTokens.every((needle) => securityAuditReceipt.includes(needle));
}

function printReport(payload) {
  console.log("Trust Center Report");
  console.log(`Status: ${payload.ok ? "PASS" : "FAIL"}`);
  console.log(`Generated: ${payload.generatedAt}`);
  console.log(`Summary: ${payload.summary.pass}/${payload.summary.total} passed`);
  console.log("");
  payload.checks.forEach((item) => {
    const marker = item.status === "pass" ? "PASS" : "FAIL";
    console.log(`[${marker}] ${item.title}`);
    console.log(`  Category: ${item.category}`);
    if (item.detail) console.log(`  Detail: ${item.detail}`);
    if (item.evidence.length) console.log(`  Evidence: ${item.evidence.join(", ")}`);
    if (item.status === "fail" && item.fix) console.log(`  Fix: ${item.fix}`);
  });
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function readJson(relativePath) {
  const contents = read(relativePath);
  if (!contents) return {};
  return JSON.parse(contents);
}
