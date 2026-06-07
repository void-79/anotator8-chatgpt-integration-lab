import { z } from "zod";
import { listFixtureIds } from "../storage.js";
import { listCapabilitiesOutputSchema } from "../schemas.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";

export const listCapabilitiesTool: ToolModule = {
  name: "list_capabilities",
  title: "List Anotator8 Capabilities",
  description: "Return supported read-only ChatGPT integration features and limitations.",
  inputSchema: {},
  outputSchema: listCapabilitiesOutputSchema,
  empty: {
    supportedFeatures: [],
    limitations: [],
    annotationTypes: [],
    supportedSubtitleLanguages: [],
    fixtureIds: [],
  },
  handler: async () =>
    success({
      supportedFeatures: [
        "inspect_project",
        "validate_project",
        "summarize_annotations",
        "find_annotations",
        "suggest_labels",
        "create_review_plan",
        "export_chatgpt_report",
      ],
      limitations: [
        "Read-only MVP: no silent mutation tools are implemented.",
        "Project JSON is supplied directly or loaded from allowlisted fixtures only.",
        "Video bytes are not uploaded, decoded, or previewed by this server.",
        "Unknown Anotator8 fields are preserved in the adapter but reported as unsupported.",
        "Bearer token auth is demo-grade; production deployment needs official OAuth.",
        "Maximum project input size is 10MB.",
      ],
      annotationTypes: ["box", "ellipse", "arrow", "polygon", "point", "text", "image", "chapter", "highlight", "comment", "tag"],
      supportedSubtitleLanguages: ["en", "ru", "kk"],
      fixtureIds: listFixtureIds(),
    }),
};

export const listCapabilitiesOutputShape = z.object(listCapabilitiesOutputSchema.shape);
