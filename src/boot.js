window.AGORA_BOOT_ERRORS = [];

function markAgoraBootError(error) {
  const message = error?.message || error?.reason?.message || error?.reason || "Unknown startup error";
  const location = error?.filename ? ` at ${error.filename}:${error.lineno || 0}:${error.colno || 0}` : "";
  const stack = error?.error?.stack || error?.reason?.stack || "";
  const detail = `${String(message)}${location}${stack ? `\n${stack}` : ""}`;
  window.AGORA_BOOT_ERRORS.push(detail);
  document.documentElement.dataset.agoraBootError = detail;
}

window.addEventListener("error", markAgoraBootError);
window.addEventListener("unhandledrejection", markAgoraBootError);
document.documentElement.dataset.agoraBoot = "watching";
