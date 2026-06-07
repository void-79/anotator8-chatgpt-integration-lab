/**
 * Anotator8 Adapter - Normalizes Anotator8 project data for MCP tools
 * Isolates Anotator8-specific schema from tool implementations
 */

import type {
  ProjectFilePayload,
  NormalizedProject,
  NormalizedAnnotation,
  NormalizedVideoSource,
  NormalizedSubtitleTrack,
  NormalizedTimelineTrack,
  IntegrationWarning,
  AnnotationType,
  AnnotationShapeType,
  VideoSource,
  UDMNode,
  SubtitleTrack,
  SubtitleCue,
  AppLocale,
} from '../shared/types.js';

// ────────────────────────────────────────────────────
// Adapter Options
// ────────────────────────────────────────────────────
export interface AdapterOptions {
  readonly maxAnnotations?: number;
  readonly preserveUnknownFields?: boolean;
}

// ────────────────────────────────────────────────────
// Anotator8 Adapter Class
// ────────────────────────────────────────────────────
export class Anotator8Adapter {
  private readonly options: Required<AdapterOptions>;

  constructor(options: AdapterOptions = {}) {
    this.options = {
      maxAnnotations: options.maxAnnotations ?? 10000,
      preserveUnknownFields: options.preserveUnknownFields ?? true,
    };
  }

  /**
   * Parse raw project data into NormalizedProject
   * @throws Error if input exceeds MAX_PROJECT_SIZE bytes
   */
  normalize(raw: unknown): NormalizedProject {
    // Enforce documented size limit (10MB default)
    const jsonString = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const MAX_PROJECT_SIZE = 10 * 1024 * 1024; // 10MB
    if (jsonString.length > MAX_PROJECT_SIZE) {
      throw new Error(
        `Project data exceeds maximum size of ${MAX_PROJECT_SIZE} bytes (received ${jsonString.length} bytes). ` +
        `Consider splitting the project or reducing annotation density.`
      );
    }

    const payload = this.parsePayload(raw);
    const warnings: IntegrationWarning[] = [];

    // Normalize video source
    const source = this.normalizeVideoSource(payload.videoSource, payload.videoUrl, warnings);

    // Normalize annotations (UDMNodes)
    const annotations = this.normalizeAnnotations(payload.nodes, warnings);

    // Normalize subtitle tracks
    const subtitleTracks = this.normalizeSubtitleTracks(
      payload.subtitleTracks ?? [],
      payload.subtitleCues ?? [],
      warnings
    );

    // Build timeline tracks from nodes
    const timelineTracks = this.buildTimelineTracks(payload.nodes);

    // Collect unknown fields from the raw object (before parsing into ProjectFilePayload)
    const unknownFields = this.collectUnknownFields(raw);

    // Compute stats
    const stats = this.computeStats(annotations, payload.subtitleCues ?? []);

    return {
      version: payload.version,
      source,
      annotations,
      subtitleTracks,
      timelineTracks,
      metadata: {
        locale: payload.locale,
        classroomId: payload.classroomId,
        classroomName: payload.classroomName,
      },
      unknownFields,
      warnings,
      stats,
    };
  }

  /**
   * Parse raw input into ProjectFilePayload with validation
   */
  private parsePayload(raw: unknown): ProjectFilePayload {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error('Project file must be an object');
    }

    const obj = raw as Record<string, unknown>;

    if (!Array.isArray(obj.nodes)) {
      throw new Error('Project file must contain a "nodes" array');
    }

    return {
      version: typeof obj.version === 'string' ? obj.version : 'unknown',
      videoUrl: typeof obj.videoUrl === 'string' ? obj.videoUrl : undefined,
      videoSource: obj.videoSource as VideoSource | undefined,
      locale: this.normalizeLocale(obj.locale),
      classroomId: typeof obj.classroomId === 'string' ? obj.classroomId : undefined,
      classroomName: typeof obj.classroomName === 'string' ? obj.classroomName : undefined,
      subtitleTracks: Array.isArray(obj.subtitleTracks)
        ? (obj.subtitleTracks as SubtitleTrack[])
        : undefined,
      subtitleCues: Array.isArray(obj.subtitleCues) ? (obj.subtitleCues as SubtitleCue[]) : undefined,
      nodes: obj.nodes as UDMNode[],
    };
  }

  /**
   * Validate a UDMNode structure
   */
  private isValidNode(node: UDMNode): boolean {
    if (typeof node.id !== 'string') return false;
    if (!['annotation', 'element', 'clip', 'track'].includes(node.type)) return false;
    if (!this.isValidSpatial(node.spatial)) return false;
    if (!this.isValidTemporal(node.temporal)) return false;
    if (!this.isValidVisual(node.visual)) return false;
    return true;
  }

  private isValidSpatial(s: unknown): boolean {
    if (typeof s !== 'object' || s === null) return false;
    const spatial = s as Record<string, unknown>;
    return (
      typeof spatial.x === 'number' &&
      typeof spatial.y === 'number' &&
      typeof spatial.width === 'number' &&
      typeof spatial.height === 'number'
    );
  }

  private isValidTemporal(t: unknown): boolean {
    if (typeof t !== 'object' || t === null) return false;
    const temporal = t as Record<string, unknown>;
    return typeof temporal.startTime === 'number';
  }

  private isValidVisual(v: unknown): boolean {
    if (typeof v !== 'object' || v === null) return false;
    const visual = v as Record<string, unknown>;
    return typeof visual.color === 'string';
  }

  /**
   * YouTube URL patterns — mirrors `application/videoSources.ts` in Anotator8.
   * 5 patterns: watch, youtu.be, embed, shorts, live.
   * REPO_EVIDENCE: C:\Anotator8\src\application\videoSources.ts
   */
  private static readonly YOUTUBE_PATTERNS: ReadonlyArray<RegExp> = [
    /(?:youtube\.com\/watch\?v=)([\w-]{6,})/i,
    /(?:youtu\.be\/)([\w-]{6,})/i,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
    /(?:youtube\.com\/live\/)([\w-]{6,})/i,
  ];

  /**
   * Try to extract a YouTube video id from a URL.
   * Returns the id or null.
   */
  private matchYouTubeId(input: string): string | null {
    for (const pattern of Anotator8Adapter.YOUTUBE_PATTERNS) {
      const m = input.match(pattern);
      if (m?.[1]) return m[1];
    }
    return null;
  }

  /**
   * Normalize video source
   */
  private normalizeVideoSource(
    videoSource: VideoSource | undefined,
    videoUrl: string | undefined,
    warnings: IntegrationWarning[]
  ): NormalizedVideoSource {
    if (!videoSource && !videoUrl) {
      return {
        kind: 'none',
        warnings: [{ code: 'NO_SOURCE', message: 'No video source configured', severity: 'info' }],
      };
    }

    // Handle videoSource if present
    if (videoSource) {
      return this.normalizeVideoSourceInput(videoSource);
    }

    // Infer from videoUrl — try full YouTube patterns first
    if (videoUrl) {
      const ytId = this.matchYouTubeId(videoUrl);
      if (ytId) {
        return {
          kind: 'youtube',
          label: `YouTube: ${ytId}`,
          url: videoUrl,
          warnings: [
            {
              code: 'INFERRED_SOURCE',
              message: `Video source inferred as YouTube (id=${ytId}) from videoUrl`,
              severity: 'info',
            },
          ],
        };
      }
      return {
        kind: 'direct-url',
        label: videoUrl,
        url: videoUrl,
        warnings: [],
      };
    }

    return {
      kind: 'unknown',
      warnings: [{ code: 'UNKNOWN_SOURCE', message: 'Could not determine video source type', severity: 'warning' }],
    };
  }

  private normalizeVideoSourceInput(videoSource: unknown): NormalizedVideoSource {
    if (typeof videoSource !== 'object' || videoSource === null) {
      return {
        kind: 'unknown',
        warnings: [{ code: 'INVALID_SOURCE', message: 'Video source is not an object', severity: 'warning' }],
      };
    }

    const vs = videoSource as Record<string, unknown>;

    switch (vs.kind) {
      case 'local-file':
        return {
          kind: 'local',
          label: String(vs.name ?? 'local file'),
          durationMs: this.normalizeDuration(vs.duration),
          warnings: [],
        };
      case 'direct-url':
        return {
          kind: 'direct-url',
          label: String(vs.url ?? 'direct URL'),
          url: String(vs.url),
          durationMs: this.normalizeDuration(vs.duration),
          warnings: [],
        };
      case 'youtube':
        return {
          kind: 'youtube',
          label: `YouTube: ${String(vs.videoId ?? vs.url)}`,
          url: String(vs.url),
          durationMs: this.normalizeDuration(vs.duration),
          warnings: [],
        };
      case 'demo':
        return {
          kind: 'direct-url',
          label: 'Demo video',
          url: String(vs.url),
          warnings: [],
        };
      default:
        return {
          kind: 'unknown',
          warnings: [{ code: 'UNKNOWN_SOURCE_KIND', message: `Unknown video source kind: ${String(vs.kind)}`, severity: 'warning' }],
        };
    }
  }

  private normalizeDuration(d: unknown): number | undefined {
    if (typeof d === 'number' && d > 0) return d * 1000; // Assume seconds if small
    return undefined;
  }

  /**
   * Normalize annotations (UDMNodes)
   */
  private normalizeAnnotations(nodes: UDMNode[], warnings: IntegrationWarning[]): NormalizedAnnotation[] {
    const annotations: NormalizedAnnotation[] = [];
    let skipped = 0;

    for (const node of nodes) {
      if (annotations.length >= this.options.maxAnnotations) {
        skipped++;
        continue;
      }

      try {
        annotations.push(this.normalizeNode(node, warnings));
      } catch {
        skipped++;
      }
    }

    if (skipped > 0) {
      warnings.push({
        code: 'NODES_SKIPPED',
        message: `${skipped} node(s) skipped due to limits or errors`,
        severity: 'info',
      });
    }

    return annotations;
  }

  private normalizeNode(node: UDMNode, warnings: IntegrationWarning[]): NormalizedAnnotation {
    const nodeWarnings: IntegrationWarning[] = [];

    // Determine annotation type from extensions
    const { type, shapeType } = this.extractAnnotationType(node, nodeWarnings);

    // Extract text content if present
    const text = node.extensions.visual?.textContent;

    // Preserve ALL extensions as raw record (visual, studio, blocks, code).
    // REPO_EVIDENCE: UDMNode NodeExtensions includes visual|studio|blocks|code
    // (C:\Anotator8\src\domain\entities\UDMNode.ts). Lab only normalizes visual
    // — others must be preserved for round-trip / porting integrity.
    const preservedExtensions = this.captureNodeExtensions(node);

    // Warn if SyncMetadata is missing (real Anotator8 requires it; lab is graceful).
    // REPO_EVIDENCE: UDMNode.sync is required in Anotator8.
    if (!node.sync) {
      nodeWarnings.push({
        code: 'MISSING_SYNC_METADATA',
        message: 'Node is missing required SyncMetadata; ChatGPT integration will treat it as unsynced.',
        severity: 'warning',
      });
    }

    // Warn if v24.0 Loro snapshot is present but unexpectedly empty.
    // REPO_EVIDENCE: VisualExtension.loroState is "Active in v24.0 GA".
    if (node.extensions.visual?.loroState === '') {
      nodeWarnings.push({
        code: 'EMPTY_LORO_STATE',
        message: 'Visual extension has empty loroState — likely mid-edit snapshot.',
        severity: 'info',
      });
    }

    return {
      id: node.id,
      type,
      shapeType,
      spatial: {
        x: node.spatial.x,
        y: node.spatial.y,
        width: node.spatial.width,
        height: node.spatial.height,
      },
      temporal: {
        startMs: node.temporal.startTime,
        endMs: node.temporal.endTime,
      },
      visual: {
        color: node.visual.color,
        opacity: node.visual.opacity,
        fill: typeof node.visual.fill === 'string' ? node.visual.fill : 'transparent',
      },
      text,
      extensions: preservedExtensions,
      warnings: nodeWarnings,
    };
  }

  /**
   * Capture the full extensions object so blocks / code / studio / visual.loroState
   * survive normalization unchanged. Returns an empty object when extensions is missing.
   */
  private captureNodeExtensions(node: UDMNode): Record<string, unknown> {
    if (!node.extensions || typeof node.extensions !== 'object') return {};
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.extensions)) {
      if (value === undefined) continue;
      result[key] = value as unknown;
    }
    return result;
  }

  private extractAnnotationType(
    node: UDMNode,
    warnings: IntegrationWarning[]
  ): { type: AnnotationType; shapeType: AnnotationShapeType } {
    const visual = node.extensions.visual;

    if (!visual) {
      warnings.push({
        code: 'NO_VISUAL_EXTENSION',
        message: 'Node has no visual extension',
        severity: 'info',
      });
      return { type: 'box', shapeType: 'rect' };
    }

    const shapeType = visual.shapeType || 'rect';
    const annotationType = visual.annotationType || this.shapeToAnnotationType(shapeType);

    return { type: annotationType, shapeType };
  }

  private shapeToAnnotationType(shape: AnnotationShapeType): AnnotationType {
    const map: Record<AnnotationShapeType, AnnotationType> = {
      rect: 'box',
      circle: 'ellipse',
      polygon: 'polygon',
      arrow: 'arrow',
      freehand: 'highlight',
    };
    return map[shape] || 'box';
  }

  /**
   * Normalize subtitle tracks
   */
  private normalizeSubtitleTracks(
    tracks: SubtitleTrack[],
    cues: SubtitleCue[],
    warnings: IntegrationWarning[]
  ): NormalizedSubtitleTrack[] {
    const cueCountByTrack = new Map<string, number>();
    for (const cue of cues) {
      cueCountByTrack.set(cue.trackId, (cueCountByTrack.get(cue.trackId) ?? 0) + 1);
    }

    return tracks.map((track) => ({
      id: track.id,
      language: track.language,
      label: track.label,
      visible: track.visible,
      cueCount: cueCountByTrack.get(track.id) ?? 0,
    }));
  }

  /**
   * Build timeline tracks from nodes
   */
  private buildTimelineTracks(nodes: UDMNode[]): NormalizedTimelineTrack[] {
    const trackMap = new Map<string, NormalizedTimelineTrack>();

    for (const node of nodes) {
      if (node.type === 'track') {
        trackMap.set(node.id, {
          id: node.id,
          type: 'annotation',
          nodeCount: 1,
        });
      }
    }

    // If no explicit tracks, create a default one
    if (trackMap.size === 0 && nodes.length > 0) {
      return [{
        id: 'default',
        type: 'annotation',
        nodeCount: nodes.length,
      }];
    }

    return Array.from(trackMap.values());
  }

  /**
   * Collect unknown fields for preservation from the raw input object
   */
  private collectUnknownFields(raw: unknown): Record<string, unknown> {
    if (!this.options.preserveUnknownFields) return {};

    const knownFields = new Set([
      'version', 'videoUrl', 'videoSource', 'locale',
      'classroomId', 'classroomName', 'subtitleTracks',
      'subtitleCues', 'nodes',
    ]);

    const unknown: Record<string, unknown> = {};
    if (typeof raw === 'object' && raw !== null) {
      for (const [key, value] of Object.entries(raw)) {
        if (!knownFields.has(key)) {
          unknown[key] = value;
        }
      }
    }
    return unknown;
  }

  /**
   * Compute statistics
   */
  private computeStats(annotations: NormalizedAnnotation[], cues: SubtitleCue[]): NormalizedProject['stats'] {
    const annotationTypes: Record<AnnotationType, number> = {
      box: 0, polygon: 0, point: 0, arrow: 0, text: 0,
      image: 0, ellipse: 0, chapter: 0, highlight: 0,
      comment: 0, tag: 0,
    };

    const shapeTypes: Record<AnnotationShapeType, number> = {
      rect: 0, circle: 0, polygon: 0, arrow: 0, freehand: 0,
    };

    let hasTemporal = false;
    let hasVisualExt = false;
    let uniqueColors = new Set<string>();

    for (const ann of annotations) {
      annotationTypes[ann.type]++;
      if (ann.shapeType in shapeTypes) {
        shapeTypes[ann.shapeType as AnnotationShapeType]++;
      }
      if (ann.temporal.endMs !== null) hasTemporal = true;
      if (ann.text) hasVisualExt = true;
      uniqueColors.add(ann.visual.color);
    }

    return {
      totalAnnotations: annotations.length,
      annotationTypes,
      shapeTypes,
      subtitleCueCount: cues.length,
      hasTemporalData: hasTemporal,
      hasVisualExtensions: hasVisualExt,
    };
  }

  /**
   * Normalize locale
   */
  private normalizeLocale(locale: unknown): AppLocale | undefined {
    if (locale === 'en' || locale === 'ru' || locale === 'kk') {
      return locale;
    }
    return undefined;
  }

  /**
   * Validate project consistency
   */
  validate(raw: unknown): {
    valid: boolean;
    errors: IntegrationWarning[];
    warnings: IntegrationWarning[];
    checks: Array<{ name: string; passed: boolean; message?: string }>;
  } {
    const errors: IntegrationWarning[] = [];
    const warnings: IntegrationWarning[] = [];
    const checks: Array<{ name: string; passed: boolean; message?: string }> = [];

    // Check 1: Valid JSON structure
    try {
      this.parsePayload(raw);
      checks.push({ name: 'Valid JSON structure', passed: true });
    } catch (e) {
      errors.push({ code: 'PARSE_ERROR', message: String(e), severity: 'error' });
      checks.push({ name: 'Valid JSON structure', passed: false, message: String(e) });
      return { valid: false, errors, warnings, checks };
    }

    const payload = this.parsePayload(raw);

    // Check 2: Version compatibility
    checks.push({
      name: 'Version compatibility',
      passed: true,
      message: `Version: ${payload.version}`,
    });

    // Check 3: Nodes have IDs
    const nodesWithoutId = payload.nodes.filter((n) => !n.id);
    if (nodesWithoutId.length > 0) {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: `${nodesWithoutId.length} node(s) missing ID`,
        severity: 'error',
      });
      checks.push({ name: 'All nodes have IDs', passed: false });
    } else {
      checks.push({ name: 'All nodes have IDs', passed: true });
    }

    // Check 4: Valid time ranges
    const invalidTimeRanges = payload.nodes.filter(
      (n) => n.temporal && n.temporal.endTime !== null && n.temporal.endTime < n.temporal.startTime
    );
    if (invalidTimeRanges.length > 0) {
      warnings.push({
        code: 'INVALID_TIME_RANGE',
        message: `${invalidTimeRanges.length} annotation(s) with endTime < startTime`,
        severity: 'warning',
      });
      checks.push({ name: 'Valid time ranges', passed: false });
    } else {
      checks.push({ name: 'Valid time ranges', passed: true });
    }

    // Check 5: Spatial bounds
    const outOfBounds = payload.nodes.filter(
      (n) =>
        n.spatial &&
        (n.spatial.x < 0 || n.spatial.y < 0 ||
          n.spatial.x > 1 || n.spatial.y > 1 ||
          n.spatial.width <= 0 || n.spatial.height <= 0)
    );
    if (outOfBounds.length > 0) {
      warnings.push({
        code: 'OUT_OF_BOUNDS',
        message: `${outOfBounds.length} annotation(s) with out-of-bounds spatial data`,
        severity: 'warning',
      });
      checks.push({ name: 'Spatial bounds valid', passed: false });
    } else {
      checks.push({ name: 'Spatial bounds valid', passed: true });
    }

    // Check 6: Orphaned subtitle cues
    if (payload.subtitleTracks && payload.subtitleCues) {
      const trackIds = new Set(payload.subtitleTracks.map((t) => t.id));
      const orphanedCues = payload.subtitleCues.filter((c) => !trackIds.has(c.trackId));
      if (orphanedCues.length > 0) {
        warnings.push({
          code: 'ORPHANED_CUES',
          message: `${orphanedCues.length} cue(s) referencing non-existent track`,
          severity: 'warning',
        });
        checks.push({ name: 'Subtitle cue track references valid', passed: false });
      } else {
        checks.push({ name: 'Subtitle cue track references valid', passed: true });
      }
    }

    // Check 7: Subtitle cue time validity
    if (payload.subtitleCues) {
      const invalidCues = payload.subtitleCues.filter((c) => c.endTime <= c.startTime);
      if (invalidCues.length > 0) {
        errors.push({
          code: 'INVALID_CUE_TIME',
          message: `${invalidCues.length} subtitle cue(s) with invalid time range`,
          severity: 'error',
        });
        checks.push({ name: 'Subtitle cue times valid', passed: false });
      } else {
        checks.push({ name: 'Subtitle cue times valid', passed: true });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checks,
    };
  }
}

// ────────────────────────────────────────────────────
// Singleton instance
// ────────────────────────────────────────────────────
export const adapter = new Anotator8Adapter();
