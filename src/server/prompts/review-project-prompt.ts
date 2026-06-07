import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerReviewProjectPrompt(server: McpServer): void {
  server.registerPrompt(
    "review_anotator8_project",
    {
      title: "Review Anotator8 Project",
      description: "Guide ChatGPT to inspect, validate, summarize, and create a manual review plan for an Anotator8 project.",
      argsSchema: {
        focus: z.enum(["all", "annotations", "subtitles", "timeline", "source"]).default("all"),
      },
    },
    ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Review the supplied Anotator8 project using the Anotator8 MCP tools.",
              "Call inspect_project first, then validate_project, then summarize_annotations.",
              `Use create_review_plan with focus=${focus}.`,
              "Do not invent labels, objects, video contents, or unsupported fields.",
              "Separate detected data problems from optional review suggestions.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
