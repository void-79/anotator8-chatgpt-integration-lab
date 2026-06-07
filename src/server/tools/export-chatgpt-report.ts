import { exportReportInputSchema, exportReportOutputSchema } from "../schemas.js";
import { loadProjectInput } from "../storage.js";
import { adapter } from "../anotator8-adapter.js";
import type { ProjectInput } from "../../shared/types.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";
import { projectStats } from "./project-utils.js";

export const exportChatgptReportTool: ToolModule = {
  name: "export_chatgpt_report",
  title: "Export ChatGPT Report",
  description: "Generate a portable JSON or Markdown report. The report is returned to the caller only; no file is written.",
  inputSchema: exportReportInputSchema,
  outputSchema: exportReportOutputSchema,
  empty: {},
  handler: async (args) => {
    const typed = args as ProjectInput & { format?: "markdown" | "json"; includeUnknownFields?: boolean };
    const raw = await loadProjectInput(typed);
    const project = adapter.normalize(raw);
    const validation = adapter.validate(raw);
    const stats = projectStats(project);
    const date = new Date().toISOString().slice(0, 10);
    const format = typed.format ?? "markdown";

    if (format === "json") {
      const report = {
        generatedAt: new Date().toISOString(),
        project: {
          version: project.version,
          source: project.source,
          stats,
          metadata: project.metadata,
        },
        validation,
        annotations: project.annotations,
        subtitles: project.subtitles,
        timeline: project.timeline,
        ...(typed.includeUnknownFields ? { unknownFields: project.unknownFields } : {}),
      };
      return success({
        format,
        filename: `anotator8-chatgpt-report-${date}.json`,
        content: JSON.stringify(report, null, 2),
      });
    }

    const lines = [
      "# Anotator8 ChatGPT Review Report",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Project version: ${project.version}`,
      `Video source: ${project.source.kind}${project.source.label ? ` (${project.source.label})` : ""}`,
      "",
      "## Counts",
      "",
      `- Annotations: ${stats.annotationCount}`,
      `- Subtitle tracks: ${stats.subtitleTrackCount}`,
      `- Subtitle cues: ${stats.subtitleCueCount}`,
      `- Timeline tracks: ${stats.timelineTrackCount}`,
      `- Unknown top-level fields: ${stats.unknownFieldCount}`,
      "",
      "## Validation",
      "",
      `Status: ${validation.valid ? "valid" : "invalid"}`,
      ...validation.errors.map((error) => `- ERROR [${error.code}] ${error.message}`),
      ...validation.warnings.map((warning) => `- WARNING [${warning.code}] ${warning.message}`),
      "",
      "## Annotation Types",
      "",
      ...Object.entries(stats.annotationTypes).map(([type, count]) => `- ${type}: ${count}`),
      "",
      "## Limitations",
      "",
      "- This report is generated from supplied project JSON only.",
      "- Video bytes are not inspected.",
      "- Unknown fields are preserved by the adapter but not interpreted.",
    ];

    return success({
      format,
      filename: `anotator8-chatgpt-report-${date}.md`,
      content: lines.join("\n"),
    });
  },
};
