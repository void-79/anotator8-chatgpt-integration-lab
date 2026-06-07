import { summarizeAnnotationsInputSchema, summarizeAnnotationsOutputSchema } from "../schemas.js";
import { loadProjectInput } from "../storage.js";
import { adapter } from "../anotator8-adapter.js";
import type { ProjectInput } from "../../shared/types.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";

export const summarizeAnnotationsTool: ToolModule = {
  name: "summarize_annotations",
  title: "Summarize Annotations",
  description: "Summarize actual annotation distribution by type, shape, label presence, and temporal span without inventing labels or objects.",
  inputSchema: summarizeAnnotationsInputSchema,
  outputSchema: summarizeAnnotationsOutputSchema,
  empty: {
    total: 0,
    byType: {},
    byShape: {},
    byLabelPresence: { labeled: 0, unlabeled: 0 },
    temporalDistribution: { startMs: 0, endMs: 0, rangeMs: 0 },
    warnings: [],
  },
  handler: async (args) => {
    const raw = await loadProjectInput(args as ProjectInput);
    const project = adapter.normalize(raw);
    const byType: Record<string, number> = {};
    const byShape: Record<string, number> = {};
    let labeled = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const annotation of project.annotations) {
      byType[annotation.type] = (byType[annotation.type] ?? 0) + 1;
      byShape[annotation.shapeType] = (byShape[annotation.shapeType] ?? 0) + 1;
      if (annotation.label) labeled += 1;
      min = Math.min(min, annotation.temporal.startMs);
      max = Math.max(max, annotation.temporal.endMs ?? annotation.temporal.startMs);
    }
    const startMs = min === Number.POSITIVE_INFINITY ? 0 : min;
    return success({
      total: project.annotations.length,
      byType,
      byShape,
      byLabelPresence: { labeled, unlabeled: project.annotations.length - labeled },
      temporalDistribution: { startMs, endMs: max, rangeMs: Math.max(0, max - startMs) },
      warnings: project.warnings,
    });
  },
};
