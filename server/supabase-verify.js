const { createServer } = require("./api");
const { createStorage } = require("./storage");

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
];

async function run() {
  assertSupabaseEnv();
  await verifySupabasePreflight();
  const workspaceId = process.env.AGORA_VERIFY_WORKSPACE_ID || `agora-verify-${Date.now().toString(36)}`;
  const storage = createStorage({
    driver: "supabase",
    workspaceId
  });
  const server = createServer({
    storage,
    allowDemoAuth: true,
    allowPasswordlessAuth: false
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  let step = "health";
  try {
    const health = await request(`${baseUrl}/api/health`);
    assert(health.ok === true, "health endpoint failed");
    assert(health.storage === "supabase", "API did not boot with Supabase storage");

    step = "admin demo login";
    const admin = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "mara" }
    });
    assert(admin.token, "admin demo login failed");
    assert(admin.permissions.includes("payments:write"), "admin session is missing payments permission");

    step = "member demo login";
    const member = await request(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      body: { memberId: "nina" }
    });
    assert(member.token, "member demo login failed");

    step = "workspace snapshot save";
    const workspaceSave = await request(`${baseUrl}/api/workspace`, {
      method: "PUT",
      token: admin.token,
      body: {
        snapshot: {
          workspace: {
            id: "workspace-acme",
            name: "Supabase Verify Studio",
            slug: "supabase-verify-studio"
          },
          projects: [],
          tasks: [],
          users: [],
          memberships: [],
          files: []
        }
      }
    });
    assert(workspaceSave.snapshot.workspace.name === "Supabase Verify Studio", "workspace snapshot save failed");

    step = "project create";
    const project = await request(`${baseUrl}/api/projects`, {
      method: "POST",
      token: admin.token,
      body: {
        project: {
          id: `${workspaceId}-project`,
          name: "Supabase Verification Project",
          companyId: "supabase-verify-company",
          owner: "mara"
        }
      }
    });
    assert(project.project.id === `${workspaceId}-project`, "project create failed");

    step = "task create";
    const task = await request(`${baseUrl}/api/tasks`, {
      method: "POST",
      token: admin.token,
      body: {
        task: {
          id: `${workspaceId}-task`,
          projectId: `${workspaceId}-project`,
          title: "Verify Supabase-backed task",
          assignee: "mara",
          status: "todo",
          priority: "high"
        }
      }
    });
    assert(task.task.title === "Verify Supabase-backed task", "task create failed");

    step = "blocked member notification settings";
    const blockedNotificationSettings = await requestError(`${baseUrl}/api/records/notificationSettings`, {
      method: "POST",
      token: member.token,
      body: {
        record: {
          id: "workspace-notifications",
          cadence: "daily"
        }
      }
    });
    assert(blockedNotificationSettings.status === 403, "member should not update notification settings");

    step = "notification settings upsert";
    const notificationSettings = await request(`${baseUrl}/api/records/notificationSettings`, {
      method: "POST",
      token: admin.token,
      body: {
        record: {
          id: "workspace-notifications",
          cadence: "daily",
          events: { assignment: true, overdue: true },
          channels: { inApp: true, webhook: false, email: false },
          delivery: { webhookUrl: "", emailAddress: "", sendResolved: false }
        }
      }
    });
    assert(notificationSettings.record.cadence === "daily", "notification settings upsert failed");

    step = "blocked member integrations";
    const blockedIntegrations = await requestError(`${baseUrl}/api/records/integrationSettings`, {
      method: "POST",
      token: member.token,
      body: {
        record: {
          id: "workspace-integrations",
          connections: []
        }
      }
    });
    assert(blockedIntegrations.status === 403, "member should not update integrations");

    step = "integration settings upsert";
    const integrations = await request(`${baseUrl}/api/records/integrationSettings`, {
      method: "POST",
      token: admin.token,
      body: {
        record: {
          id: "workspace-integrations",
          defaultOwner: "mara",
          webhookEndpoint: "",
          apiAccess: true,
          eventMirroring: false,
          connections: [
            {
              id: "slack",
              status: "planned",
              syncMode: "outbound",
              owner: "mara",
              notes: "Supabase verification",
              health: "planned",
              secretStatus: "missing",
              events: ["task_updated"]
            }
          ]
        }
      }
    });
    assert(integrations.record.connections.length === 1, "integration settings upsert failed");

    step = "member reminder upsert";
    const reminder = await request(`${baseUrl}/api/records/notificationReminders`, {
      method: "POST",
      token: member.token,
      body: {
        record: {
          id: `${workspaceId}-reminder`,
          sourceId: `${workspaceId}-task`,
          title: "Supabase due reminder",
          message: "The Supabase verifier expects this to fire.",
          remindAt: "2000-01-01",
          status: "scheduled"
        }
      }
    });
    assert(reminder.record.memberId === member.user.id, "member reminder was not canonicalized");

    step = "blocked member scheduler";
    const blockedScheduler = await requestError(`${baseUrl}/api/scheduler/notifications/run`, {
      method: "POST",
      token: member.token
    });
    assert(blockedScheduler.status === 403, "member should not run scheduler");

    step = "scheduler run";
    const scheduler = await request(`${baseUrl}/api/scheduler/notifications/run`, {
      method: "POST",
      token: admin.token
    });
    assert(scheduler.processed === 1, "scheduler did not process the due reminder");
    assert(scheduler.history[0].kind === "reminder-fired", "scheduler did not write notification history");

    step = "blocked member payment";
    const blockedPayment = await requestError(`${baseUrl}/api/payments/checkout-intent`, {
      method: "POST",
      token: member.token,
      body: {
        provider: "test",
        item: paymentItem(workspaceId)
      }
    });
    assert(blockedPayment.status === 403, "member should not create payment intents");

    step = "payment intent";
    const paymentIntent = await request(`${baseUrl}/api/payments/checkout-intent`, {
      method: "POST",
      token: admin.token,
      body: {
        provider: "test",
        item: paymentItem(workspaceId)
      }
    });
    assert(paymentIntent.intent.status === "requires_test_confirmation", "payment intent did not use test confirmation status");

    step = "payment event";
    const paymentEvent = await request(`${baseUrl}/api/payments/events`, {
      method: "POST",
      token: admin.token,
      body: {
        type: "checkout.test_completed",
        intentId: paymentIntent.intent.id
      }
    });
    assert(paymentEvent.entitlement.itemId === `${workspaceId}-template`, "payment event did not grant entitlement");
    assert(paymentEvent.entitlement.payoutSnapshot.charityName === "Open Project Fund", "entitlement payout metadata was not preserved");

    step = "file upload";
    const uploaded = await request(`${baseUrl}/api/files/upload`, {
      method: "POST",
      token: admin.token,
      body: {
        file: {
          id: `${workspaceId}-file`,
          projectId: `${workspaceId}-project`,
          taskId: `${workspaceId}-task`,
          title: "supabase-verify.txt",
          kind: "TXT",
          contentType: "text/plain",
          dataUrl: `data:text/plain;base64,${Buffer.from("Supabase storage verification").toString("base64")}`
        }
      }
    });
    assert(uploaded.file.storageProvider === "supabase", "file upload did not use Supabase Storage");

    step = "file download";
    const downloaded = await requestRaw(`${baseUrl}${uploaded.file.url}`, {
      token: admin.token
    });
    assert(downloaded.body.toString("utf8") === "Supabase storage verification", "file download returned unexpected content");

    step = "records round trip";
    const records = await request(`${baseUrl}/api/records`, {
      token: admin.token
    });
    assert(records.records.notificationSettings.some((item) => item.id === "workspace-notifications"), "notification settings did not round-trip from Supabase");
    assert(records.records.integrationSettings.some((item) => item.id === "workspace-integrations"), "integration settings did not round-trip from Supabase");
    assert(records.records.notificationHistory.some((item) => item.sourceId === `${workspaceId}-reminder`), "notification history did not round-trip from Supabase");
    assert(records.records.files.some((item) => item.id === `${workspaceId}-file`), "file record did not round-trip from Supabase");

    step = "backend health";
    const backendHealth = await request(`${baseUrl}/api/backend/health`, {
      token: admin.token
    });
    assert(backendHealth.storage === "supabase", "backend health did not report Supabase");
    assert(backendHealth.records.some((record) => record.key === "notificationHistory" && record.count >= 1), "backend health did not count notification history");
    assert(backendHealth.readiness.some((item) => item.id === "file-uploads" && item.ready), "backend health did not mark file uploads ready");

    step = "audit log";
    const audit = await request(`${baseUrl}/api/audit-log`, {
      token: admin.token
    });
    const actions = new Set(audit.events.map((event) => event.action));
    assert(actions.has("notification_scheduler_run"), "scheduler audit event missing");
    assert(actions.has("payment_entitlement_granted"), "payment entitlement audit event missing");
    assert(actions.has("file_upload"), "file upload audit event missing");

    console.log(`Supabase verification passed for workspace ${workspaceId}`);
  } catch (error) {
    error.message = [
      `Supabase verification failed for workspace ${workspaceId} during ${step}: ${error.message}`,
      "Check that both migrations ran, the storage bucket exists, and SUPABASE_SERVICE_ROLE_KEY is set only on the API/server environment."
    ].join("\n");
    throw error;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function assertSupabaseEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name] || process.env[name].includes("your-") || process.env[name] === "replace-me");
  if (missing.length) {
    throw new Error(`Missing Supabase verification environment: ${missing.join(", ")}`);
  }
}

async function verifySupabasePreflight() {
  const requiredTables = [
    "agora_workspace_snapshots",
    "agora_audit_events",
    "agora_companies",
    "agora_files",
    "agora_notification_settings",
    "agora_notification_reminders",
    "agora_notification_history",
    "agora_inbox_state",
    "agora_integration_settings"
  ];
  for (const table of requiredTables) {
    await supabaseRequest(`/rest/v1/${table}?select=*&limit=1`, {
      label: `table ${table}`
    });
  }

  const bucket = process.env.AGORA_SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || "agora-files";
  await supabaseRequest(`/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    label: `storage bucket ${bucket}`
  });
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.AGORA_SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AGORA_SUPABASE_SERVICE_ROLE_KEY || "";
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.message || body.error || `Supabase returned ${response.status}`;
    throw new Error(`Supabase preflight failed for ${options.label || path}: ${message}`);
  }
}

function paymentItem(workspaceId) {
  return {
    itemType: "project-template",
    itemId: `${workspaceId}-template`,
    name: "Supabase Verification Template",
    amountCents: 100,
    currency: "USD",
    payout: {
      mode: "charity",
      recipientName: "Open Project Fund",
      walletAddress: "0xVerificationWallet",
      chain: "Base",
      charityName: "Open Project Fund",
      donationPercent: 100
    }
  };
}

async function request(url, options = {}) {
  const response = await requestRaw(url, options);
  let body = {};
  try {
    body = JSON.parse(response.body.toString("utf8"));
  } catch {
    body = {};
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${body.error || "Request failed"} (${response.status} ${options.method || "GET"} ${url})`);
  }
  return body;
}

async function requestError(url, options = {}) {
  const response = await requestRaw(url, options);
  let body = {};
  try {
    body = JSON.parse(response.body.toString("utf8"));
  } catch {
    body = {};
  }
  if (response.status >= 200 && response.status < 300) {
    throw new Error(`Expected request to fail: ${url}`);
  }
  return { status: response.status, body };
}

async function requestRaw(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return {
    status: response.status,
    headers: response.headers,
    body: Buffer.from(await response.arrayBuffer())
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
