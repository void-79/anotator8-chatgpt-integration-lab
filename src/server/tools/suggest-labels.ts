import { suggestLabelsInputSchema, suggestLabelsOutputSchema } from "../schemas.js";
import { loadProjectInput } from "../storage.js";
import { adapter } from "../anotator8-adapter.js";
import type { ProjectInput } from "../../shared/types.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";
import { formatMs } from "./project-utils.js";

export const suggestLabelsTool: ToolModule = {
  name: "suggest_labels",
  title: "Suggest Label Review Tasks",
  description: "Identify missing or weak annotation labels. This tool does not invent semantic labels; proposedLabel is null unless the current label can be normalized deterministically.",
  inputSchema: suggestLabelsInputSchema,
  outputSchema: suggestLabelsOutputSchema,
  empty: { suggestions: [], limitations: [] },
  handler: async (args) => {
    const typed = args as ProjectInput & { includeAlreadyLabeled?: boolean };
    const raw = await loadProjectInput(typed);
    const project = adapter.normalize(raw);
    const suggestions = project.annotations
      .filter((annotation) => typed.includeAlreadyLabeled || !annotation.label)
      .map((annotation) => {
        const current = annotation.label;
        const trimmed = current?.trim();
        const normalized = trimmed && trimmed !== current ? trimmed : null;
        return {
          annotationId: annotation.id,
          ...(current ? { currentLabel: current } : {}),
          proposedLabel: normalized,
          reason: current
            ? "Existing label has deterministic whitespace cleanup available or was included by request."
            : `Missing label on ${annotation.type} annotation at ${formatMs(annotation.temporal.startMs)}.`,
          requiresHumanChoice: normalized === null,
        };
      });

    return success({
      suggestions,
      limitations: [
        "No semantic object labels are invented.",
        "Use Anotator8 UI or a future patch/proposal tool to apply any label changes.",
      ],
    });
  },
};
