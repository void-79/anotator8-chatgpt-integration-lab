import { z } from "zod";

export const warningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  path: z.string().optional(),
});

export const errorSchema = z.object({
  code: z.enum([
    "invalid_input",
    "unsupported_project_version",
    "too_large_input",
    "missing_field",
    "internal_error",
    "unsupported_capability",
  ]),
  message: z.string(),
  path: z.string().optional(),
});

export const projectInputSchema = {
  projectData: z.unknown().optional().describe("Raw Anotator8 .anatator.json project payload."),
  fixtureId: z.enum(["sample-project"]).optional().describe("Built-in demo fixture id."),
};

export const normalizedSourceSchema = z.object({
  kind: z.enum(["none", "local", "direct-url", "youtube", "unknown"]),
  label: z.string().optional(),
  url: z.string().optional(),
  durationMs: z.number().optional(),
  warnings: z.array(warningSchema),
});

export const normalizedAnnotationSchema = z.object({
  id: z.string(),
  type: z.string(),
  shapeType: z.string(),
  label: z.string().optional(),
  confidence: z.number().optional(),
  spatial: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number(),
    zIndex: z.number(),
  }),
  temporal: z.object({
    startMs: z.number(),
    endMs: z.number().nullable(),
    durationMs: z.number().optional(),
  }),
  visual: z.object({
    color: z.string(),
    opacity: z.number(),
    fill: z.string(),
    strokeWidth: z.number(),
  }),
  text: z.string().optional(),
  parentId: z.string().nullable().optional(),
  warnings: z.array(warningSchema),
});

export const normalizedSubtitleTrackSchema = z.object({
  id: z.string(),
  language: z.enum(["en", "ru", "kk"]),
  label: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  cueCount: z.number(),
  cues: z.array(
    z.object({
      id: z.string(),
      startMs: z.number(),
      endMs: z.number(),
      textPreview: z.string(),
      warnings: z.array(warningSchema),
    }),
  ),
  warnings: z.array(warningSchema),
});

export const normalizedTimelineTrackSchema = z.object({
  id: z.string(),
  type: z.enum(["annotation", "subtitle", "unknown"]),
  itemCount: z.number(),
  warnings: z.array(warningSchema),
});

export const baseOutputShape = {
  ok: z.boolean(),
  error: errorSchema.nullable(),
};

export const listCapabilitiesOutputSchema = z.object({
  ...baseOutputShape,
  supportedFeatures: z.array(z.string()),
  limitations: z.array(z.string()),
  annotationTypes: z.array(z.string()),
  supportedSubtitleLanguages: z.array(z.string()),
  fixtureIds: z.array(z.string()),
});

export const inspectProjectInputSchema = {
  ...projectInputSchema,
  projectId: z.string().optional(),
};

export const inspectProjectOutputSchema = z.object({
  ...baseOutputShape,
  projectId: z.string().optional(),
  version: z.string().optional(),
  source: normalizedSourceSchema.optional(),
  stats: z
    .object({
      annotationCount: z.number(),
      annotationTypes: z.record(z.string(), z.number()),
      shapeTypes: z.record(z.string(), z.number()),
      subtitleTrackCount: z.number(),
      subtitleCueCount: z.number(),
      timelineTrackCount: z.number(),
      warningCount: z.number(),
      unknownFieldCount: z.number(),
    })
    .optional(),
  warnings: z.array(warningSchema),
  unsupportedFields: z.array(z.string()),
});

export const validateProjectInputSchema = projectInputSchema;
export const validateProjectOutputSchema = z.object({
  ...baseOutputShape,
  valid: z.boolean(),
  errors: z.array(warningSchema),
  warnings: z.array(warningSchema),
  checks: z.array(z.object({ name: z.string(), passed: z.boolean(), evidence: z.string() })),
});

export const summarizeAnnotationsInputSchema = projectInputSchema;
export const summarizeAnnotationsOutputSchema = z.object({
  ...baseOutputShape,
  total: z.number(),
  byType: z.record(z.string(), z.number()),
  byShape: z.record(z.string(), z.number()),
  byLabelPresence: z.object({ labeled: z.number(), unlabeled: z.number() }),
  temporalDistribution: z.object({ startMs: z.number(), endMs: z.number(), rangeMs: z.number() }),
  warnings: z.array(warningSchema),
});

export const findAnnotationsInputSchema = {
  ...projectInputSchema,
  filters: z
    .object({
      type: z.string().optional(),
      label: z.string().optional(),
      text: z.string().optional(),
      confidenceMin: z.number().min(0).max(1).optional(),
      timeRange: z.object({ startMs: z.number(), endMs: z.number() }).optional(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
};

export const findAnnotationsOutputSchema = z.object({
  ...baseOutputShape,
  matches: z.array(normalizedAnnotationSchema),
  total: z.number(),
  truncated: z.boolean(),
  filters: z.record(z.string(), z.unknown()),
});

export const suggestLabelsInputSchema = {
  ...projectInputSchema,
  includeAlreadyLabeled: z.boolean().default(false),
};

export const suggestLabelsOutputSchema = z.object({
  ...baseOutputShape,
  suggestions: z.array(
    z.object({
      annotationId: z.string(),
      currentLabel: z.string().optional(),
      proposedLabel: z.string().nullable(),
      reason: z.string(),
      requiresHumanChoice: z.boolean(),
    }),
  ),
  limitations: z.array(z.string()),
});

export const createReviewPlanInputSchema = {
  ...projectInputSchema,
  focus: z.enum(["all", "annotations", "subtitles", "timeline", "source"]).default("all"),
};

export const createReviewPlanOutputSchema = z.object({
  ...baseOutputShape,
  focus: z.string(),
  detectedProblems: z.array(z.string()),
  suggestions: z.array(z.string()),
  checklist: z.array(
    z.object({
      area: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      kind: z.enum(["detected-problem", "manual-check", "suggestion"]),
      text: z.string(),
    }),
  ),
});

export const exportReportInputSchema = {
  ...projectInputSchema,
  format: z.enum(["markdown", "json"]).default("markdown"),
  includeUnknownFields: z.boolean().default(false),
};

export const exportReportOutputSchema = z.object({
  ...baseOutputShape,
  format: z.enum(["markdown", "json"]).optional(),
  filename: z.string().optional(),
  content: z.string().optional(),
});

export const toolOutputSchemas = {
  list_capabilities: listCapabilitiesOutputSchema,
  inspect_project: inspectProjectOutputSchema,
  validate_project: validateProjectOutputSchema,
  summarize_annotations: summarizeAnnotationsOutputSchema,
  find_annotations: findAnnotationsOutputSchema,
  suggest_labels: suggestLabelsOutputSchema,
  create_review_plan: createReviewPlanOutputSchema,
  export_chatgpt_report: exportReportOutputSchema,
};
