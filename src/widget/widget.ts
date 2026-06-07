// @ts-nocheck
const statusEl = document.getElementById("status");
const annotationCountEl = document.getElementById("annotation-count");
const subtitleCountEl = document.getElementById("subtitle-count");
const warningCountEl = document.getElementById("warning-count");
const warningsEl = document.getElementById("warnings");
const focusPanel = document.getElementById("focus-panel");

let lastProjectData = null;

function numberFrom(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function render(result) {
  const data = result.structuredContent || {};
  lastProjectData = (result._meta && result._meta.projectData) || lastProjectData;
  const stats = data.stats || {};
  annotationCountEl.textContent = String(numberFrom(stats.annotationCount || data.total));
  subtitleCountEl.textContent = String(numberFrom(stats.subtitleCueCount));
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  warningCountEl.textContent = String(warnings.length);
  warningsEl.replaceChildren();
  for (const warning of warnings.slice(0, 8)) {
    const item = document.createElement("li");
    item.className = typeof warning.severity === "string" ? warning.severity : "info";
    item.textContent = "[" + String(warning.code || "INFO") + "] " + String(warning.message || "");
    warningsEl.appendChild(item);
  }
  if (warnings.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No warnings in the latest tool result.";
    warningsEl.appendChild(item);
  }
  statusEl.textContent = data.ok === false ? "Latest tool call returned an error" : "Latest tool result loaded";
  focusPanel.hidden = !lastProjectData || !window.openai || !window.openai.callTool;
}

async function callReviewPlan(focus, button) {
  if (!lastProjectData || !window.openai || !window.openai.callTool) return;
  button.disabled = true;
  try {
    await window.openai.callTool("create_review_plan", { projectData: lastProjectData, focus });
  } finally {
    button.disabled = false;
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (event.data && event.data.structuredContent) render(event.data);
});

document.querySelectorAll("[data-focus]").forEach((button) => {
  button.addEventListener("click", () => {
    void callReviewPlan(button.dataset.focus || "all", button);
  });
});
