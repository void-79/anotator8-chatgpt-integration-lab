import { findAnnotationsInputSchema, findAnnotationsOutputSchema } from "../schemas.js";
import { loadProjectInput } from "../storage.js";
import { adapter } from "../anotator8-adapter.js";
import type { ProjectInput } from "../../shared/types.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";
import { filterAnnotations } from "./project-utils.js";

export const findAnnotationsTool: ToolModule = {
  name: "find_annotations",
  title: "Find Annotations",
  description: "Filter normalized annotations by type, label/text substring, confidence if present, and time range.",
  inputSchema: findAnnotationsInputSchema,
  outputSchema: findAnnotationsOutputSchema,
  empty: { matches: [], total: 0, truncated: false, filters: {} },
  handler: async (args) => {
    const typed = args as ProjectInput & { filters?: Record<string, unknown>; limit?: number };
    const raw = await loadProjectInput(typed);
    const project = adapter.normalize(raw);
    const matches = filterAnnotations(project.annotations, typed.filters ?? {});
    const limit = typed.limit ?? 50;
    return success({
      matches: matches.slice(0, limit),
      total: matches.length,
      truncated: matches.length > limit,
      filters: typed.filters ?? {},
    });
  },
};
