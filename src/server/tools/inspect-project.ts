import { inspectProjectInputSchema, inspectProjectOutputSchema } from "../schemas.js";
import { loadProjectInput } from "../storage.js";
import { adapter } from "../anotator8-adapter.js";
import type { ProjectInput } from "../../shared/types.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";
import { projectStats } from "./project-utils.js";

export const inspectProjectTool: ToolModule = {
  name: "inspect_project",
  title: "Inspect Anotator8 Project",
  description: "Normalize an Anotator8 project and return source metadata, annotation counts, subtitles, timeline health, warnings, and unsupported fields.",
  inputSchema: inspectProjectInputSchema,
  outputSchema: inspectProjectOutputSchema,
  empty: { warnings: [], unsupportedFields: [] },
  handler: async (args) => {
    const raw = await loadProjectInput(args as ProjectInput);
    const project = adapter.normalize(raw);
    const output = {
      projectId: typeof (args as { projectId?: unknown }).projectId === "string" ? (args as { projectId: string }).projectId : project.version,
      version: project.version,
      source: project.source,
      stats: projectStats(project),
      warnings: [...project.source.warnings, ...project.warnings],
      unsupportedFields: Object.keys(project.unknownFields),
    };
    return {
      ...success(output),
      _meta: {
        projectData: raw,
        normalizedProject: project,
      },
    };
  },
};
