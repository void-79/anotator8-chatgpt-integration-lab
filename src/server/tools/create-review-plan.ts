import { createReviewPlanInputSchema, createReviewPlanOutputSchema } from "../schemas.js";
import { loadProjectInput } from "../storage.js";
import { adapter } from "../anotator8-adapter.js";
import type { ProjectInput } from "../../shared/types.js";
import type { ToolModule } from "./tool-types.js";
import { success } from "./tool-types.js";
import { projectStats, summarizeValidation } from "./project-utils.js";

export const createReviewPlanTool: ToolModule = {
  name: "create_review_plan",
  title: "Create Review Plan",
  description: "Create a manual review checklist that separates detected project problems from optional suggestions.",
  inputSchema: createReviewPlanInputSchema,
  outputSchema: createReviewPlanOutputSchema,
  empty: { focus: "all", detectedProblems: [], suggestions: [], checklist: [] },
  handler: async (args) => {
    const typed = args as ProjectInput & { focus?: "all" | "annotations" | "subtitles" | "timeline" | "source" };
    const raw = await loadProjectInput(typed);
    const project = adapter.normalize(raw);
    const validation = adapter.validate(raw);
    const focus = typed.focus ?? "all";
    const stats = projectStats(project);
    const detectedProblems = summarizeValidation(validation);
    const checklist = [];

    if (focus === "all" || focus === "source") {
      checklist.push({
        area: "source",
        priority: project.source.kind === "none" ? "high" as const : "medium" as const,
        kind: project.source.kind === "none" ? "detected-problem" as const : "manual-check" as const,
        text: `Verify video source (${project.source.kind}) and duration metadata before review.`,
      });
    }
    if (focus === "all" || focus === "annotations") {
      checklist.push({
        area: "annotations",
        priority: "medium" as const,
        kind: "manual-check" as const,
        text: `Review ${stats.annotationCount} annotations for placement, timing, and label clarity.`,
      });
      if (project.annotations.some((annotation) => !annotation.label)) {
        checklist.push({
          area: "annotations",
          priority: "medium" as const,
          kind: "detected-problem" as const,
          text: "Some annotations have no label/text content.",
        });
      }
    }
    if (focus === "all" || focus === "subtitles") {
      checklist.push({
        area: "subtitles",
        priority: validation.warnings.some((warning) => warning.code === "ORPHANED_SUBTITLE_CUE") ? "high" as const : "low" as const,
        kind: validation.warnings.some((warning) => warning.code === "ORPHANED_SUBTITLE_CUE") ? "detected-problem" as const : "manual-check" as const,
        text: `Check ${stats.subtitleCueCount} subtitle cues across ${stats.subtitleTrackCount} track(s).`,
      });
    }
    if (focus === "all" || focus === "timeline") {
      checklist.push({
        area: "timeline",
        priority: "low" as const,
        kind: "manual-check" as const,
        text: `Inspect ${stats.timelineTrackCount} normalized timeline track(s), including implicit tracks if present.`,
      });
    }

    return success({
      focus,
      detectedProblems,
      suggestions: [
        "Use find_annotations to inspect dense time windows before changing project data.",
        "Keep any future mutation flow patch-based and reversible.",
      ],
      checklist,
    });
  },
};
