const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function includes(relativePath, needle, message) {
  assert.ok(read(relativePath).includes(needle), `${relativePath}: ${message}`);
}

includes("index.html", 'class="skip-link" href="#main-content"', "keeps a keyboard skip link to the main landmark");
includes("index.html", '<main class="main-content" id="main-content" tabindex="-1" aria-labelledby="page-title" aria-describedby="route-status">', "keeps a named, focusable main landmark");
includes("index.html", 'id="route-status" aria-live="polite" aria-atomic="true"', "keeps route changes announced politely");
includes("index.html", 'id="toast-region" aria-live="polite" aria-atomic="true"', "keeps toast messages in a live region");
includes("index.html", 'aria-controls="search-results" aria-expanded="false"', "keeps global search disclosure state");
includes("index.html", 'id="search-results" role="region" aria-label="Search results"', "keeps search results named for assistive tech");
includes("index.html", '<dialog class="modal" id="task-dialog" aria-labelledby="task-form-title"', "keeps task dialog labelled");
includes("index.html", '<dialog class="modal command-dialog" id="command-dialog" aria-labelledby="command-dialog-title"', "keeps command dialog labelled");
includes("src/app.js", 'els.searchInput?.setAttribute("aria-expanded", String(!els.searchResults.hidden));', "opens search disclosure state with results");
includes("src/app-runtime.js", 'els.searchInput?.setAttribute("aria-expanded", "false");', "closes search disclosure state from runtime interactions");
includes("src/styles.css", ":where(a, button, input, select, textarea, [tabindex]):focus-visible", "keeps global focus-visible treatment");

console.log("Accessibility regression checks passed");
