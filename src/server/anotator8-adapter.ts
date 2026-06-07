import type {
  Anotator8ProjectRaw,
  IntegrationWarning,
  NormalizedAnnotation,
  NormalizedProject,
  NormalizedSubtitleTrack,
  NormalizedTimelineTrack,
  ProjectFilePayload,
  SubtitleCue,
  SubtitleTrack,
  UDMNode,
  ValidationResult,
  VideoSource,
} from "../shared/types.js";
import { IntegrationError } from "./errors.js";

const KNOWN_PROJECT_FIELDS = new Set([
  "version",
  "videoUrl",
  "videoSource",
  "locale",
  "classroomId",
  "classroomName",
  "subtitleTracks",
  "subtitleCues",
  "nodes",
]);

const SUPPORTED_ANNOTATION_TYPES = new Set([
  "box",
  "polygon",
  "point",
  "arrow",
  "text",
  "image",
  "ellipse",
  "chapter",
  "highlight",
  "comment",
  "tag",
]);

const SUPPORTED_SHAPES = new Set(["rect", "circle", "polygon", "arrow", "freehand"]);
const MAX_PROJECT_BYTES = 10 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function secondsToMs(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value * 1000);
}

function previewText(value: unknown): string {
  if (!isRecord(value)) return "";
  return String(value.en ?? value.ru ?? value.kk ?? "").slice(0, 120);
}

function makeWarning(
  code: string,
  message: string,
  severity: IntegrationWarning["severity"],
  path?: string,
): IntegrationWarning {
  return { code, message, severity, ...(path ? { path } : {}) };
}

export class Anotator8Adapter {
  parse(raw: Anotator8ProjectRaw): ProjectFilePayload {
    const approxSize = JSON.stringify(raw).length;
    if (approxSize > MAX_PROJECT_BYTES) {
      throw new IntegrationError("too_large_input", "Project payload exceeds 10MB.", "projectData");
    }
    if (!isRecord(raw)) {
      throw new IntegrationError("invalid_input", "Project payload must be a JSON object.", "projectData");
    }
    if (!Array.isArray(raw.nodes)) {
      throw new IntegrationError("missing_field", 'Project payload must contain a "nodes" array.', "nodes");
    }

    return {
      version: typeof raw.version === "string" ? raw.version : "unknown",
      videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl : undefined,
      videoSource: isRecord(raw.videoSource) ? (raw.videoSource as VideoSource) : undefined,
      locale: raw.locale === "en" || raw.locale === "ru" || raw.locale === "kk" ? raw.locale : undefined,
      classroomId: typeof raw.classroomId === "string" ? raw.classroomId : undefined,
      classroomName: typeof raw.classroomName === "string" ? raw.classroomName : undefined,
      subtitleTracks: Array.isArray(raw.subtitleTracks) ? (raw.subtitleTracks as SubtitleTrack[]) : undefined,
      subtitleCues: Array.isArray(raw.subtitleCues) ? (raw.subtitleCues as SubtitleCue[]) : undefined,
      nodes: raw.nodes as UDMNode[],
    };
  }

  normalize(raw: Anotator8ProjectRaw): NormalizedProject {
    const payload = this.parse(raw);
    const warnings: IntegrationWarning[] = [];
    const source = this.normalizeSource(payload, warnings);
    const annotations = this.normalizeAnnotations(payload.nodes, warnings);
    const subtitles = this.normalizeSubtitles(payload.subtitleTracks ?? [], payload.subtitleCues ?? []);
    const timeline = this.normalizeTimeline(payload.nodes, subtitles, warnings);

    return {
      version: payload.version,
      source,
      annotations,
      subtitles,
      timeline,
      metadata: {
        ...(payload.locale ? { locale: payload.locale } : {}),
        ...(payload.classroomId ? { classroomId: payload.classroomId } : {}),
        ...(payload.classroomName ? { classroomName: payload.classroomName } : {}),
      },
      unknownFields: this.collectUnknownFields(raw),
      warnings,
    };
  }

  validate(raw: Anotator8ProjectRaw): ValidationResult {
    const errors: IntegrationWarning[] = [];
    const warnings: IntegrationWarning[] = [];
    const checks: Array<{ name: string; passed: boolean; evidence: string }> = [];
    let payload: ProjectFilePayload;

    try {
      payload = this.parse(raw);
      checks.push({ name: "Project payload shape", passed: true, evidence: "nodes array present" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(makeWarning("PARSE_ERROR", message, "error", "projectData"));
      checks.push({ name: "Project payload shape", passed: false, evidence: message });
      return { valid: false, errors, warnings, checks };
    }

    if (payload.version !== "24.0.0") {
      warnings.push(makeWarning("UNKNOWN_VERSION", `Observed project version "${payload.version}".`, "warning", "version"));
    }
    checks.push({ name: "Version observed", passed: true, evidence: payload.version });

    const ids = new Set<string>();
    payload.nodes.forEach((node, index) => {
      const path = `nodes[${index}]`;
      if (!node.id) {
        errors.push(makeWarning("MISSING_ID", "Node is missing id.", "error", `${path}.id`));
      } else if (ids.has(node.id)) {
        errors.push(makeWarning("DUPLICATE_ID", `Duplicate node id "${node.id}".`, "error", `${path}.id`));
      } else {
        ids.add(node.id);
      }

      if (node.type && !["annotation", "element", "clip", "track"].includes(node.type)) {
        warnings.push(makeWarning("UNKNOWN_NODE_TYPE", `Unknown node type "${node.type}".`, "warning", `${path}.type`));
      }

      if (!node.spatial) {
        errors.push(makeWarning("MISSING_SPATIAL", "Node is missing spatial data.", "error", `${path}.spatial`));
      } else if (
        node.spatial.x < 0 ||
        node.spatial.y < 0 ||
        node.spatial.x > 1 ||
        node.spatial.y > 1 ||
        node.spatial.width <= 0 ||
        node.spatial.height <= 0
      ) {
        warnings.push(makeWarning("INVALID_SPATIAL_RANGE", "Node spatial values are outside normalized bounds.", "warning", `${path}.spatial`));
      }

      if (!node.temporal) {
        errors.push(makeWarning("MISSING_TEMPORAL", "Node is missing temporal data.", "error", `${path}.temporal`));
      } else if (node.temporal.endTime !== null && node.temporal.endTime < node.temporal.startTime) {
        warnings.push(makeWarning("BROKEN_TIME_RANGE", "Node endTime is earlier than startTime.", "warning", `${path}.temporal`));
      }

      const annotationType = node.extensions?.visual?.annotationType;
      if (annotationType && !SUPPORTED_ANNOTATION_TYPES.has(annotationType)) {
        warnings.push(makeWarning("UNKNOWN_ANNOTATION_TYPE", `Unknown annotation type "${annotationType}".`, "warning", `${path}.extensions.visual.annotationType`));
      }
    });

    checks.push({
      name: "Node ids",
      passed: !errors.some((warning) => warning.code === "MISSING_ID" || warning.code === "DUPLICATE_ID"),
      evidence: `${ids.size} unique ids across ${payload.nodes.length} nodes`,
    });

    const trackIds = new Set((payload.subtitleTracks ?? []).map((track) => track.id));
    for (const [index, cue] of (payload.subtitleCues ?? []).entries()) {
      if (!trackIds.has(cue.trackId)) {
        warnings.push(makeWarning("ORPHANED_SUBTITLE_CUE", `Cue "${cue.id}" references missing track "${cue.trackId}".`, "warning", `subtitleCues[${index}].trackId`));
      }
      if (cue.endTime <= cue.startTime) {
        errors.push(makeWarning("INVALID_CUE_RANGE", `Cue "${cue.id}" endTime must be greater than startTime.`, "error", `subtitleCues[${index}]`));
      }
    }

    checks.push({
      name: "Subtitle cue ranges",
      passed: !errors.some((warning) => warning.code === "INVALID_CUE_RANGE"),
      evidence: `${payload.subtitleCues?.length ?? 0} cue(s) checked`,
    });

    checks.push({
      name: "Subtitle track references",
      passed: !warnings.some((warning) => warning.code === "ORPHANED_SUBTITLE_CUE"),
      evidence: `${trackIds.size} track(s) checked`,
    });

    if (!payload.videoSource && !payload.videoUrl) {
      warnings.push(makeWarning("MISSING_SOURCE_METADATA", "No persisted video source metadata is present.", "warning", "videoSource"));
    }
    checks.push({
      name: "Video source metadata",
      passed: Boolean(payload.videoSource || payload.videoUrl),
      evidence: payload.videoSource?.kind ?? (payload.videoUrl ? "videoUrl" : "none"),
    });

    return { valid: errors.length === 0, errors, warnings, checks };
  }

  private normalizeSource(payload: ProjectFilePayload, warnings: IntegrationWarning[]): NormalizedProject["source"] {
    const sourceWarnings: IntegrationWarning[] = [];
    const source = payload.videoSource;
    if (!source && !payload.videoUrl) {
      sourceWarnings.push(makeWarning("NO_SOURCE", "No video source is persisted in the project.", "info", "videoSource"));
      return { kind: "none", warnings: sourceWarnings };
    }
    if (source?.kind === "local-file") {
      if (source.objectUrl?.startsWith("blob:")) {
        sourceWarnings.push(makeWarning("LOCAL_BLOB_NOT_PORTABLE", "Local blob URLs are intentionally not persisted as portable media.", "warning", "videoSource.objectUrl"));
      }
      return {
        kind: "local",
        label: source.name,
        durationMs: secondsToMs(source.duration) ?? undefined,
        warnings: sourceWarnings,
      };
    }
    if (source?.kind === "direct-url") {
      return {
        kind: "direct-url",
        label: source.url,
        url: source.url,
        durationMs: secondsToMs(source.duration) ?? undefined,
        warnings: sourceWarnings,
      };
    }
    if (source?.kind === "youtube") {
      return {
        kind: "youtube",
        label: source.videoId,
        url: source.url,
        durationMs: secondsToMs(source.duration) ?? undefined,
        warnings: sourceWarnings,
      };
    }
    if (source?.kind === "demo") {
      return { kind: "direct-url", label: "demo", url: source.url, warnings: sourceWarnings };
    }
    if (payload.videoUrl) {
      sourceWarnings.push(makeWarning("INFERRED_SOURCE", "Source kind inferred from videoUrl because videoSource is absent.", "info", "videoUrl"));
      const isYoutube = /youtube\.com|youtu\.be/i.test(payload.videoUrl);
      return {
        kind: isYoutube ? "youtube" : "direct-url",
        label: payload.videoUrl,
        url: payload.videoUrl,
        warnings: sourceWarnings,
      };
    }
    warnings.push(makeWarning("UNKNOWN_SOURCE", "Video source is present but unsupported.", "warning", "videoSource"));
    return { kind: "unknown", warnings: sourceWarnings };
  }

  private normalizeAnnotations(nodes: readonly UDMNode[], warnings: IntegrationWarning[]): NormalizedAnnotation[] {
    const annotations: NormalizedAnnotation[] = [];
    nodes.forEach((node, index) => {
      if (node.deletedAt) return;
      if (node.type && node.type !== "annotation") return;
      if (!node.id || !node.spatial || !node.temporal || !node.visual) {
        warnings.push(makeWarning("ANNOTATION_SKIPPED", "A node is missing required annotation fields.", "warning", `nodes[${index}]`));
        return;
      }
      const nodeWarnings: IntegrationWarning[] = [];
      const visual = node.extensions?.visual;
      const rawShape = visual?.shapeType ?? "rect";
      const rawType = visual?.annotationType ?? this.typeFromShape(rawShape);
      const shapeType = SUPPORTED_SHAPES.has(rawShape) ? rawShape : "unknown";
      const type = SUPPORTED_ANNOTATION_TYPES.has(rawType) ? rawType : "unknown";
      if (type === "unknown") {
        nodeWarnings.push(makeWarning("UNKNOWN_ANNOTATION_TYPE", `Unsupported annotation type "${rawType}".`, "warning", `nodes[${index}].extensions.visual.annotationType`));
      }
      if (shapeType === "unknown") {
        nodeWarnings.push(makeWarning("UNKNOWN_SHAPE_TYPE", `Unsupported shape type "${rawShape}".`, "warning", `nodes[${index}].extensions.visual.shapeType`));
      }
      const label = typeof visual?.textContent === "string" && visual.textContent.trim() ? visual.textContent.trim() : undefined;
      annotations.push({
        id: node.id,
        type,
        shapeType,
        ...(label ? { label, text: label } : {}),
        spatial: {
          x: asNumber(node.spatial.x),
          y: asNumber(node.spatial.y),
          width: asNumber(node.spatial.width),
          height: asNumber(node.spatial.height),
          rotation: asNumber(node.spatial.rotation),
          zIndex: asNumber(node.spatial.zIndex),
        },
        temporal: {
          startMs: secondsToMs(node.temporal.startTime) ?? 0,
          endMs: secondsToMs(node.temporal.endTime),
          ...(typeof node.temporal.duration === "number" ? { durationMs: Math.round(node.temporal.duration * 1000) } : {}),
        },
        visual: {
          color: String(node.visual.color),
          opacity: asNumber(node.visual.opacity, 1),
          fill: typeof node.visual.fill === "string" ? node.visual.fill : "transparent",
          strokeWidth: asNumber(node.visual.strokeWidth, 1),
        },
        parentId: node.parentId ?? null,
        warnings: nodeWarnings,
      });
    });
    return annotations;
  }

  private normalizeSubtitles(tracks: readonly SubtitleTrack[], cues: readonly SubtitleCue[]): NormalizedSubtitleTrack[] {
    return tracks.map((track) => {
      const trackCues = cues.filter((cue) => cue.trackId === track.id);
      return {
        id: track.id,
        language: track.language,
        label: track.label,
        visible: track.visible,
        locked: track.locked,
        cueCount: trackCues.length,
        cues: trackCues.map((cue) => ({
          id: cue.id,
          startMs: secondsToMs(cue.startTime) ?? 0,
          endMs: secondsToMs(cue.endTime) ?? 0,
          textPreview: previewText(cue.text),
          warnings: cue.endTime <= cue.startTime
            ? [makeWarning("INVALID_CUE_RANGE", "Cue endTime must be greater than startTime.", "error")]
            : [],
        })),
        warnings: [],
      };
    });
  }

  private normalizeTimeline(
    nodes: readonly UDMNode[],
    subtitles: readonly NormalizedSubtitleTrack[],
    warnings: IntegrationWarning[],
  ): NormalizedTimelineTrack[] {
    const explicitTracks = nodes.filter((node) => node.type === "track" && node.id);
    const timeline: NormalizedTimelineTrack[] = explicitTracks.map((node) => ({
      id: node.id as string,
      type: "annotation",
      itemCount: nodes.filter((candidate) => candidate.parentId === node.id).length,
      warnings: [],
    }));
    if (timeline.length === 0 && nodes.some((node) => node.type === "annotation")) {
      timeline.push({ id: "annotations", type: "annotation", itemCount: nodes.filter((node) => node.type === "annotation").length, warnings: [] });
      warnings.push(makeWarning("IMPLICIT_TIMELINE", "No explicit timeline tracks found; annotations are grouped into an implicit track.", "info", "nodes"));
    }
    for (const subtitle of subtitles) {
      timeline.push({ id: `subtitle:${subtitle.id}`, type: "subtitle", itemCount: subtitle.cueCount, warnings: subtitle.warnings });
    }
    return timeline;
  }

  private collectUnknownFields(raw: unknown): Record<string, unknown> {
    if (!isRecord(raw)) return {};
    const unknown: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!KNOWN_PROJECT_FIELDS.has(key)) unknown[key] = value;
    }
    return unknown;
  }

  private typeFromShape(shape: string): string {
    switch (shape) {
      case "circle":
        return "ellipse";
      case "polygon":
        return "polygon";
      case "arrow":
        return "arrow";
      case "freehand":
        return "highlight";
      case "rect":
      default:
        return "box";
    }
  }
}

export const adapter = new Anotator8Adapter();
