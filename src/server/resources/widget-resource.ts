import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const widgetUri = "ui://anotator8/review-widget.html";

async function readWidgetFile(name: string): Promise<string> {
  return readFile(resolve(root, "src", "widget", name), "utf8");
}

export function widgetResourceUri(): string {
  return widgetUri;
}

export function registerWidgetResource(server: McpServer): void {
  registerAppResource(
    server,
    "Anotator8 Review Widget",
    widgetUri,
    {
      description: "Read-only project summary and warning panel for Anotator8 ChatGPT review.",
      _meta: {
        ui: {
          prefersBorder: true,
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
        },
      },
    },
    async () => {
      const [html, css, js] = await Promise.all([
        readWidgetFile("index.html"),
        readWidgetFile("styles.css"),
        readWidgetFile("widget.ts"),
      ]);
      return {
        contents: [
          {
            uri: widgetUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: `${html}\n<style>${css}</style>\n<script>${js}</script>`,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: {
                  connectDomains: [],
                  resourceDomains: [],
                },
              },
            },
          },
        ],
      };
    },
  );
}
