#!/usr/bin/env node

const path = require("node:path");
const { loadEnvFile } = require("../server/env");

const ROOT = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
loadEnvFile(path.resolve(ROOT, args.env || ".env"));

const report = hostedEnvironmentReport({
  requireGithub: args.requireGithub,
  requirePublicFeatureRequests: args.requirePublicFeatureRequests
});

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

if (!report.ok) {
  process.exitCode = 1;
}

function parseArgs(values) {
  return values.reduce((result, value, index, list) => {
    if (result.pending) {
      result[result.pending] = value;
      result.pending = "";
    } else if (value === "--json") result.json = true;
    else if (value === "--require-github") result.requireGithub = true;
    else if (value === "--require-public-feature-requests") result.requirePublicFeatureRequests = true;
    else if (value === "--env") result.pending = "env";
    else if (value.startsWith("--env=")) result.env = value.slice("--env=".length);
    else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}${index < list.length - 1 ? "" : ""}`);
    }
    return result;
  }, { json: false, env: ".env", requireGithub: false, requirePublicFeatureRequests: false, pending: "" });
}

function hostedEnvironmentReport(options = {}) {
  const checks = [
    checkHostedDrivers(),
    checkSupabaseEnvironment(),
    checkHostedUrls(),
    checkCorsPolicy(),
    checkAuthHardening(),
    checkStrictCsp(),
    checkObservability(),
    checkBackups(),
    checkPasswordReset(),
    checkEmailDelivery(),
    checkAiProvider(),
    checkPublicFeatureRequests(options),
    checkRateLimiting(),
    checkGithubWebhook(options),
    checkOperationalLimits()
  ];
  const blockers = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");
  return {
    ok: blockers.length === 0,
    generatedAt: new Date().toISOString(),
    profile: "hosted-production",
    summary: {
      passing: checks.filter((check) => check.status === "pass").length,
      warnings: warnings.length,
      blockers: blockers.length,
      total: checks.length
    },
    checks
  };
}

function checkHostedDrivers() {
  const storage = env("AGORA_STORAGE_DRIVER");
  const auth = env("AGORA_AUTH_DRIVER");
  const done = storage === "supabase" && auth === "supabase";
  return gate({
    id: "hosted-drivers",
    label: "Hosted storage and auth drivers",
    done,
    detail: `${storage || "missing"} storage / ${auth || "missing"} auth`,
    fix: "Set AGORA_STORAGE_DRIVER=supabase and AGORA_AUTH_DRIVER=supabase for hosted production."
  });
}

function checkSupabaseEnvironment() {
  const url = env("SUPABASE_URL") || env("AGORA_SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY") || env("AGORA_SUPABASE_ANON_KEY");
  const service = env("SUPABASE_SERVICE_ROLE_KEY") || env("AGORA_SUPABASE_SERVICE_ROLE_KEY");
  const bucket = env("AGORA_SUPABASE_STORAGE_BUCKET");
  const missing = [];
  if (!validHttpsUrl(url) || placeholder(url)) missing.push("SUPABASE_URL");
  if (!secretish(anon)) missing.push("SUPABASE_ANON_KEY");
  if (!secretish(service)) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!bucket) missing.push("AGORA_SUPABASE_STORAGE_BUCKET");
  return gate({
    id: "supabase-environment",
    label: "Supabase environment",
    done: missing.length === 0,
    detail: missing.length ? `${missing.join(", ")} missing or placeholder` : `Supabase URL set, anon/service keys present, bucket ${bucket}`,
    fix: "Set real Supabase URL, anon key, service role key, and private storage bucket. Keep the service role key server-only."
  });
}

function checkHostedUrls() {
  const publicAppUrl = normalizedUrl(env("AGORA_PUBLIC_APP_URL") || env("AGORA_APP_URL"));
  const origins = listEnv("AGORA_ALLOWED_ORIGINS").map(normalizedUrl).filter(Boolean);
  const unsafeOrigins = origins.filter((origin) => !hostedHttpsOrigin(origin));
  const publicUrlReady = hostedHttpsOrigin(publicAppUrl);
  const publicOrigin = originFromUrl(publicAppUrl);
  const publicOriginAllowed = publicUrlReady && origins.includes(publicOrigin);
  return gate({
    id: "hosted-urls",
    label: "Hosted app URL and allowed origins",
    done: publicUrlReady && origins.length > 0 && unsafeOrigins.length === 0 && publicOriginAllowed,
    detail: publicUrlReady
      ? `${publicOrigin || publicAppUrl} public origin; ${origins.length} allowed origin${origins.length === 1 ? "" : "s"}`
      : "Public app URL is missing, not HTTPS, or points at localhost",
    fix: "Set AGORA_PUBLIC_APP_URL to the hosted HTTPS app URL and AGORA_ALLOWED_ORIGINS to exact HTTPS browser origins."
  });
}

function checkCorsPolicy() {
  const origins = listEnv("AGORA_ALLOWED_ORIGINS").map(normalizedUrl).filter(Boolean);
  const unsafeOrigins = origins.filter((origin) => !hostedHttpsOrigin(origin));
  const localhostAllowed = boolEnv("AGORA_ALLOW_LOCALHOST_ORIGINS");
  return gate({
    id: "cors-policy",
    label: "Production CORS policy",
    done: origins.length > 0 && unsafeOrigins.length === 0 && !localhostAllowed,
    detail: localhostAllowed
      ? "Implicit localhost origins are enabled"
      : unsafeOrigins.length ? `${unsafeOrigins.length} non-hosted origin${unsafeOrigins.length === 1 ? "" : "s"} configured` : "Only explicit hosted HTTPS origins are allowed",
    fix: "Set AGORA_ALLOW_LOCALHOST_ORIGINS=false and keep AGORA_ALLOWED_ORIGINS limited to exact hosted HTTPS browser origins."
  });
}

function checkAuthHardening() {
  const demo = boolEnv("AGORA_DEMO_AUTH");
  const passwordless = boolEnv("AGORA_PASSWORDLESS_AUTH");
  return gate({
    id: "auth-hardening",
    label: "Hosted auth hardening",
    done: !demo && !passwordless,
    detail: demo || passwordless ? "Demo or passwordless auth is enabled" : "Demo and passwordless auth are disabled",
    fix: "Set AGORA_DEMO_AUTH=false and AGORA_PASSWORDLESS_AUTH=false for hosted production."
  });
}

function checkStrictCsp() {
  const strict = boolEnv("AGORA_STRICT_CSP") || env("NODE_ENV") === "production";
  return gate({
    id: "strict-csp",
    label: "Strict CSP",
    done: strict,
    detail: strict ? "Strict CSP is enabled through AGORA_STRICT_CSP or NODE_ENV=production" : "Strict CSP is not enabled",
    fix: "Set AGORA_STRICT_CSP=true or NODE_ENV=production for hosted app/static servers."
  });
}

function checkObservability() {
  const structured = boolEnv("AGORA_STRUCTURED_LOGS") || env("NODE_ENV") === "production";
  return gate({
    id: "observability",
    label: "Request observability",
    done: structured,
    detail: structured ? "Structured request logs are enabled" : "Structured request logs are not enabled",
    fix: "Set AGORA_STRUCTURED_LOGS=true or NODE_ENV=production so hosted request IDs can be matched to API logs."
  });
}

function checkBackups() {
  const disabled = boolEnv("AGORA_BACKUP_DISABLED");
  const backupDir = env("AGORA_BACKUP_DIR");
  const retention = positiveNumber(env("AGORA_BACKUP_RETENTION_FILES"), 20);
  const scheduler = boolEnv("AGORA_BACKUP_SCHEDULER_ENABLED");
  return gate({
    id: "server-backups",
    label: "Server workspace backups",
    done: !disabled && Boolean(backupDir) && retention >= 3 && scheduler,
    detail: disabled
      ? "Backups are disabled"
      : backupDir ? `${retention} retained backup file${retention === 1 ? "" : "s"}; scheduler ${scheduler ? "enabled" : "disabled"}` : "Backup directory is not configured",
    fix: "Set AGORA_BACKUP_DIR to a durable mounted path, keep AGORA_BACKUP_DISABLED=false, retain at least 3 files, and enable AGORA_BACKUP_SCHEDULER_ENABLED=true."
  });
}

function checkPasswordReset() {
  const delivery = env("AGORA_PASSWORD_RESET_DELIVERY");
  const exposesToken = boolEnv("AGORA_PASSWORD_RESET_RETURN_TOKEN") || delivery === "manual";
  const webhookReady = delivery !== "webhook" || (validHttpsUrl(env("AGORA_PASSWORD_RESET_WEBHOOK_URL")) && secretish(env("AGORA_PASSWORD_RESET_WEBHOOK_SECRET")));
  return gate({
    id: "password-reset-delivery",
    label: "Password reset delivery",
    done: ["smtp", "webhook"].includes(delivery) && !exposesToken && webhookReady,
    detail: delivery ? `${delivery} delivery${exposesToken ? " with token exposure" : ""}` : "No reset delivery configured",
    fix: "Use AGORA_PASSWORD_RESET_DELIVERY=smtp or webhook, keep AGORA_PASSWORD_RESET_RETURN_TOKEN=false, and configure webhook URL/secret when using webhooks."
  });
}

function checkEmailDelivery() {
  const smtpHost = env("AGORA_SMTP_HOST") || env("SMTP_HOST");
  const smtpUser = env("AGORA_SMTP_USER") || env("SMTP_USER");
  const smtpPassword = env("AGORA_SMTP_PASSWORD") || env("SMTP_PASSWORD");
  const from = env("AGORA_EMAIL_FROM") || env("SMTP_FROM");
  const featureRecipient = env("AGORA_FEATURE_REQUEST_EMAIL") || env("AGORA_OWNER_EMAIL");
  const portalRecipient = env("AGORA_PORTAL_ACTION_EMAIL") || featureRecipient;
  const missing = [];
  if (!smtpHost) missing.push("AGORA_SMTP_HOST");
  if (!secretish(smtpUser)) missing.push("AGORA_SMTP_USER");
  if (!secretish(smtpPassword)) missing.push("AGORA_SMTP_PASSWORD");
  if (!from) missing.push("AGORA_EMAIL_FROM");
  if (!featureRecipient) missing.push("AGORA_FEATURE_REQUEST_EMAIL");
  if (!portalRecipient) missing.push("AGORA_PORTAL_ACTION_EMAIL or AGORA_FEATURE_REQUEST_EMAIL");
  return gate({
    id: "team-email-delivery",
    label: "Team email delivery",
    done: missing.length === 0,
    detail: missing.length ? `${missing.join(", ")} missing or placeholder` : "SMTP credentials, sender, and owner recipients are configured",
    fix: "Set SMTP host, credentials, sender, and owner recipient variables before inviting a real team."
  });
}

function checkAiProvider() {
  const provider = env("AGORA_AI_PROVIDER") || "local";
  const externalProvider = provider !== "local";
  const baseUrl = normalizedUrl(env("AGORA_AI_BASE_URL"));
  const key = env("AGORA_AI_API_KEY") || env("OPENAI_API_KEY");
  const clientBaseUrls = boolEnv("AGORA_AI_ALLOW_CLIENT_BASE_URL");
  const allowedBaseUrls = listEnv("AGORA_AI_ALLOWED_BASE_URLS").map(normalizedUrl).filter(Boolean);
  const unsafeAllowed = allowedBaseUrls.filter((url) => !hostedHttpsOrigin(url));
  const missing = [];
  if (externalProvider && !secretish(key)) missing.push("AGORA_AI_API_KEY or OPENAI_API_KEY");
  if (externalProvider && baseUrl && !hostedHttpsOrigin(baseUrl)) missing.push("hosted HTTPS AGORA_AI_BASE_URL");
  if (clientBaseUrls && !allowedBaseUrls.length) missing.push("AGORA_AI_ALLOWED_BASE_URLS");
  if (unsafeAllowed.length) missing.push("hosted HTTPS client AI allowlist URLs");
  return gate({
    id: "ai-provider-hardening",
    label: "AI provider hardening",
    done: missing.length === 0,
    detail: missing.length
      ? `${provider} provider needs ${missing.join(", ")}`
      : clientBaseUrls ? `${provider} provider with ${allowedBaseUrls.length} allowlisted client base URL${allowedBaseUrls.length === 1 ? "" : "s"}` : `${provider} provider uses server-owned configuration`,
    fix: "Keep AI keys server-side. Use hosted HTTPS base URLs, and only enable AGORA_AI_ALLOW_CLIENT_BASE_URL with AGORA_AI_ALLOWED_BASE_URLS."
  });
}

function checkPublicFeatureRequests(options = {}) {
  const enabled = boolEnv("AGORA_PUBLIC_FEATURE_REQUESTS");
  const ipLimit = positiveNumber(env("AGORA_PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS"), 6);
  const emailLimit = positiveNumber(env("AGORA_PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS"), 3);
  const bodyLimit = positiveNumber(env("AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES"), 24576);
  const saneLimits = ipLimit <= 20 && emailLimit <= 10 && bodyLimit <= 64 * 1024;
  if (options.requirePublicFeatureRequests && !enabled) {
    return gate({
      id: "public-feature-requests",
      label: "Public feature request intake",
      done: false,
      detail: "Public feature requests are required for this verifier run but disabled",
      fix: "Set AGORA_PUBLIC_FEATURE_REQUESTS=true and keep public abuse limits low."
    });
  }
  return gate({
    id: "public-feature-requests",
    label: "Public feature request intake",
    done: !enabled || saneLimits,
    detail: enabled ? `${ipLimit} IP attempts, ${emailLimit} email attempts, ${Math.round(bodyLimit / 1024)}KB body cap` : "Public feature requests are disabled",
    fix: "Keep public feature request body, IP, and email limits low before sharing the public feedback URL."
  });
}

function checkRateLimiting() {
  const driver = env("AGORA_RATE_LIMIT_DRIVER") || "memory";
  const edgeProtected = boolEnv("AGORA_EDGE_RATE_LIMITS_ENABLED");
  const writes = positiveNumber(env("AGORA_AUTHENTICATED_WRITE_RATE_LIMIT_ATTEMPTS"), 240);
  const expensive = positiveNumber(env("AGORA_EXPENSIVE_API_RATE_LIMIT_ATTEMPTS"), 30);
  const realtimeSession = positiveNumber(env("AGORA_REALTIME_CONNECTION_LIMIT_PER_SESSION"), 6);
  const sharedCounters = driver === "supabase";
  const saneLimits = writes <= 500 && expensive <= 60 && realtimeSession <= 12;
  return gate({
    id: "rate-limit-driver",
    label: "Distributed rate limiting",
    done: saneLimits && (sharedCounters || edgeProtected),
    detail: `${driver} limiter${edgeProtected ? " with edge/provider protection" : ""}; writes ${writes}/window; expensive ${expensive}/window; realtime ${realtimeSession}/session`,
    fix: "Set AGORA_RATE_LIMIT_DRIVER=supabase after running migration 005, or set AGORA_EDGE_RATE_LIMITS_ENABLED=true only when provider/edge limits protect every API worker."
  });
}

function checkGithubWebhook(options = {}) {
  const configured = secretish(env("AGORA_GITHUB_WEBHOOK_SECRET"));
  if (configured) {
    return gate({
      id: "github-webhook-secret",
      label: "GitHub webhook secret",
      done: true,
      detail: "GitHub webhook secret is configured",
      fix: "Rotate if it has been shared in logs, screenshots, or issue reports."
    });
  }
  if (options.requireGithub || boolEnv("AGORA_REQUIRE_GITHUB_WEBHOOK_SECRET")) {
    return gate({
      id: "github-webhook-secret",
      label: "GitHub webhook secret",
      done: false,
      detail: "GitHub webhook secret is required but missing",
      fix: "Set AGORA_GITHUB_WEBHOOK_SECRET before enabling production GitHub intake."
    });
  }
  return {
    id: "github-webhook-secret",
    label: "GitHub webhook secret",
    status: "warn",
    detail: "Missing; acceptable only if GitHub intake is not enabled yet",
    fix: "Set AGORA_GITHUB_WEBHOOK_SECRET before mapping production GitHub repositories."
  };
}

function checkOperationalLimits() {
  const sessionTtl = positiveNumber(env("AGORA_SESSION_TTL_SECONDS"), 28800);
  const inviteTtl = positiveNumber(env("AGORA_INVITATION_TTL_DAYS"), 14);
  const resetTtl = positiveNumber(env("AGORA_PASSWORD_RESET_TTL_MINUTES"), 30);
  return gate({
    id: "operational-limits",
    label: "Hosted token and invitation lifetimes",
    done: sessionTtl <= 60 * 60 * 12 && inviteTtl <= 30 && resetTtl <= 60,
    detail: `${Math.round(sessionTtl / 3600)}h sessions, ${inviteTtl}d invites, ${resetTtl}m reset tokens`,
    fix: "Keep AGORA_SESSION_TTL_SECONDS <= 43200, AGORA_INVITATION_TTL_DAYS <= 30, and AGORA_PASSWORD_RESET_TTL_MINUTES <= 60."
  });
}

function gate({ id, label, done, detail, fix }) {
  return {
    id,
    label,
    status: done ? "pass" : "fail",
    detail,
    fix
  };
}

function printReport(report) {
  console.log("Hosted Environment Verification");
  console.log(`${report.summary.passing}/${report.summary.total} passing, ${report.summary.warnings} warning${report.summary.warnings === 1 ? "" : "s"}, ${report.summary.blockers} blocker${report.summary.blockers === 1 ? "" : "s"}`);
  console.log("");
  report.checks.forEach((check) => {
    const label = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`- ${label} ${check.label}: ${check.detail}`);
    if (check.status !== "pass") console.log(`  Fix: ${check.fix}`);
  });
}

function printHelp() {
  console.log(`Hosted Environment Verification

Usage:
  node scripts/hosted-env-verify.js [--env .env] [--json] [--require-github] [--require-public-feature-requests]

Checks hosted production configuration without printing secret values.
`);
}

function env(name) {
  return String(process.env[name] || "").trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function listEnv(name) {
  return env(name).split(",").map((item) => item.trim()).filter(Boolean);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizedUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function originFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function hostedHttpsOrigin(value) {
  if (!validHttpsUrl(value)) return false;
  return !/localhost|127\.0\.0\.1|\[::1\]/i.test(value);
}

function placeholder(value) {
  return /your-|example|replace-me|localhost|127\.0\.0\.1/i.test(String(value || ""));
}

function secretish(value) {
  const text = String(value || "").trim();
  return text.length >= 12 && !placeholder(text);
}
