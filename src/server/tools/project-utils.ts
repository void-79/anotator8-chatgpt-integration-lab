import type { NormalizedAnnotation, NormalizedProject, ValidationResult } from "../../shared/types.js";

export function projectStats(project: NormalizedProject) {
  const annotationTypes: Record<string, number> = {};
  const shapeTypes: Record<string, number> = {};
  for (const annotation of project.annotations) {
    annotationTypes[annotation.type] = (annotationTypes[annotation.type] ?? 0) + 1;
    shapeTypes[annotation.shapeType] = (shapeTypes[annotation.shapeType] ?? 0) + 1;
  }
  const subtitleCueCount = project.subtitles.reduce((sum, track) => sum + track.cueCount, 0);
  return {
    annotationCount: project.annotations.length,
    annotationTypes,
    shapeTypes,
    subtitleTrackCount: project.subtitles.length,
    subtitleCueCount,
    timelineTrackCount: project.timeline.length,
    warningCount: project.warnings.length + project.source.warnings.length,
    unknownFieldCount: Object.keys(project.unknownFields).length,
  };
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "open-ended";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function summarizeValidation(validation: ValidationResult): string[] {
  return [...validation.errors, ...validation.warnings].map((warning) => `[${warning.code}] ${warning.message}`);
}

export function filterAnnotations(
  annotations: readonly NormalizedAnnotation[],
  filters: Record<string, unknown> = {},
): NormalizedAnnotation[] {
  return annotations.filter((annotation) => {
    if (typeof filters.type === "string" && annotation.type !== filters.type) return false;
    if (typeof filters.label === "string") {
      const label = annotation.label?.toLowerCase() ?? "";
      if (!label.includes(filters.label.toLowerCase())) return false;
    }
    if (typeof filters.text === "string") {
      const text = annotation.text?.toLowerCase() ?? "";
      if (!text.includes(filters.text.toLowerCase())) return false;
    }
    if (typeof filters.confidenceMin === "number") {
      if (annotation.confidence === undefined || annotation.confidence < filters.confidenceMin) return false;
    }
    if (typeof filters.timeRange === "object" && filters.timeRange !== null) {
      const range = filters.timeRange as { startMs?: unknown; endMs?: unknown };
      if (typeof range.startMs === "number" && typeof range.endMs === "number") {
        const annotationEnd = annotation.temporal.endMs ?? Number.POSITIVE_INFINITY;
        if (annotation.temporal.startMs > range.endMs || annotationEnd < range.startMs) return false;
      }
    }
    return true;
  });
}
