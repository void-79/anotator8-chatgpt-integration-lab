import { validateProjectInputSchema, validateProjectOutputSchema } from "../schemas.js";
import { loadProjectInput } from "../storage.js";
import { adapter } from "../anotator8-adapter.js";
import type { ProjectInput } from "../../shared/types.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";

export const validateProjectTool: ToolModule = {
  name: "validate_project",
  title: "Validate Anotator8 Project",
  description: "Check project consistency: ids, time ranges, subtitle cue references, source metadata, and unsupported node or annotation types.",
  inputSchema: validateProjectInputSchema,
  outputSchema: validateProjectOutputSchema,
  empty: { valid: false, errors: [], warnings: [], checks: [] },
  handler: async (args) => {
    const raw = await loadProjectInput(args as ProjectInput);
    const validation = adapter.validate(raw);
    return success(validation);
  },
};
