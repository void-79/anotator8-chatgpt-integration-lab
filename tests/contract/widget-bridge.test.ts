/**
 * Widget bridge contract.
 *
 * The widget is embedded in src/widget/widget.ts and read by
 * src/server/resources/widget-resource.ts. We assert on the source
 * directly because the widget is not executed in jsdom.
 *
 * OFFICIAL_DOC_EVIDENCE: Apps SDK quickstart 2026-01-26 (ui/initialize,
 * ui/notifications/initialized, tools/call over postMessage). Apps SDK
 * 1.x legacy bridge (window.openai.callTool) is still supported.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const widgetTs = readFileSync("src/widget/widget.ts", "utf8");
const widgetHtml = readFileSync("src/widget/index.html", "utf8");
const widgetCss = readFileSync("src/widget/styles.css", "utf8");

describe("widget: bridge support", () => {
  it("declares MCP Apps host bridge protocol version 2026-01-26", () => {
    expect(widgetTs).toContain('"2026-01-26"');
  });

  it("calls ui/initialize over postMessage (new bridge)", () => {
    expect(widgetTs).toContain('"ui/initialize"');
    expect(widgetTs).toContain('"ui/notifications/initialized"');
    expect(widgetTs).toContain('"tools/call"');
  });

  it("falls back to window.openai.callTool (legacy bridge)", () => {
    expect(widgetTs).toContain("window.openai.callTool");
  });

  it("hides focus buttons when no bridge is detected", () => {
    expect(widgetTs).toContain("focusPanel.hidden");
    expect(widgetTs).toContain("hasUsableBridge");
  });

  it("uses textContent only (CSP-safe, no innerHTML)", () => {
    // The widget must avoid innerHTML for XSS safety under ChatGPT's CSP.
    expect(widgetTs).not.toContain("innerHTML");
    expect(widgetTs).toContain("textContent");
  });
});

describe("widget: HTML/CSS contract", () => {
  it("exposes a bridge-info span in the DOM", () => {
    expect(widgetHtml).toContain('id="bridge-info"');
  });

  it("exposes the focus buttons ChatGPT users can click", () => {
    expect(widgetHtml).toContain('data-focus="annotations"');
    expect(widgetHtml).toContain('data-focus="subtitles"');
    expect(widgetHtml).toContain('data-focus="timeline"');
  });

  it("styles .bridge-info as monospace", () => {
    expect(widgetCss).toContain(".bridge-info");
  });
});
