/**
 * Anotator8 Review Widget — runs inside the ChatGPT iframe.
 *
 * Supports TWO bridges, picked at runtime:
 *
 * 1. **MCP Apps host bridge** (preferred, Apps SDK protocolVersion 2026-01-26).
 *    Communicates with the host via JSON-RPC over `postMessage` using
 *    `ui/initialize` / `ui/notifications/initialized` and `tools/call`.
 *    OFFICIAL_DOC_EVIDENCE: https://developers.openai.com/apps-sdk/quickstart
 *
 * 2. **Legacy `window.openai.callTool` bridge** (Apps SDK 1.x, deprecated but
 *    still supported by ChatGPT for backwards compatibility).
 *
 * Every button is wired to a real tool call. If neither bridge is present
 * the focus buttons are hidden, per the "no fake UI controls" rule.
 */
// @ts-nocheck — iframe/widget, no type definitions from the host.
const statusEl = document.getElementById("status");
const annotationCountEl = document.getElementById("annotation-count");
const subtitleCountEl = document.getElementById("subtitle-count");
const warningCountEl = document.getElementById("warning-count");
const warningsEl = document.getElementById("warnings");
const focusPanel = document.getElementById("focus-panel");
const bridgeInfo = document.getElementById("bridge-info");

let lastProjectData = null;
let lastToolResult = null;

const BRIDGE_PROTOCOL_VERSION = "2026-01-26";
const APP_INFO = { name: "anotator8-review-widget", version: "0.2.0" };

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
  focusPanel.hidden = !hasUsableBridge() || !lastProjectData;
  if (bridgeInfo) bridgeInfo.textContent = describeBridge();
}

// ────────────────────────────────────────────────────────
// Bridge 1: MCP Apps host bridge (postMessage JSON-RPC)
// OFFICIAL_DOC_EVIDENCE: Apps SDK quickstart — "ui/initialize" + "tools/call"
// ────────────────────────────────────────────────────────
let bridgeReady = null;
let rpcId = 0;
const pending = new Map();

function rpcNotify(method, params) {
  window.parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
}

function rpcRequest(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++rpcId;
    pending.set(id, { resolve, reject });
    window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
  });
}

function initAppsHostBridge() {
  const appCapabilities = {};
  let resolved = false;
  bridgeReady = rpcRequest("ui/initialize", {
    appInfo: APP_INFO,
    appCapabilities,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
  })
    .then(() => {
      rpcNotify("ui/notifications/initialized", {});
      resolved = true;
    })
    .catch(() => {
      // Host does not speak MCP Apps bridge — leave resolved=false.
      bridgeReady = null;
    });
  return () => resolved;
}

async function callToolViaAppsBridge(name, args) {
  if (!bridgeReady) return null;
  await bridgeReady;
  return rpcRequest("tools/call", { name, arguments: args });
}

// ────────────────────────────────────────────────────────
// Bridge 2: legacy window.openai.callTool
// ────────────────────────────────────────────────────────
function callToolViaLegacyBridge(name, args) {
  if (typeof window.openai === "undefined" || typeof window.openai.callTool !== "function") {
    return null;
  }
  return window.openai.callTool(name, args);
}

// ────────────────────────────────────────────────────────
// Dispatch + bridge detection
// ────────────────────────────────────────────────────────
function hasUsableBridge() {
  return Boolean(bridgeReady) || (typeof window.openai !== "undefined" && typeof window.openai.callTool === "function");
}

function describeBridge() {
  if (bridgeReady) return "bridge: mcp-apps-host";
  if (typeof window.openai !== "undefined" && typeof window.openai.callTool === "function") {
    return "bridge: legacy-window.openai";
  }
  return "bridge: none (read-only display only)";
}

async function callReviewPlan(focus, button) {
  button.disabled = true;
  try {
    const args = { projectData: lastProjectData, focus };
    const result =
      (await callToolViaAppsBridge("create_review_plan", args)) ||
      (await callToolViaLegacyBridge("create_review_plan", args));
    if (result) lastToolResult = result;
  } finally {
    button.disabled = false;
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;

  // Apps-bridge: respond to JSON-RPC responses
  if (typeof message.id === "number" && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(message.error);
    else resolve(message.result);
    return;
  }

  // Apps-bridge: react to model-initiated tool results
  if (typeof message.method === "string" && message.method === "ui/notifications/tool-result") {
    if (message.params) render(message.params);
    return;
  }

  // Legacy bridge: window.openai injects result events
  if (message.structuredContent) {
    render(message);
  }
});

document.querySelectorAll("[data-focus]").forEach((button) => {
  button.addEventListener("click", () => {
    void callReviewPlan(button.dataset.focus || "all", button);
  });
});

// Attempt Apps-bridge handshake; if it rejects, legacy bridge will be tried.
initAppsHostBridge();
