/**
 * Core types for Anotator8 × ChatGPT Integration Lab
 * Based on Anotator8 project file structure
 */

// ────────────────────────────────────────────────────
// Branded Types
// ────────────────────────────────────────────────────
export type ObjectID = string & { readonly __brand: 'ObjectID' };
export type VideoTime = number & { readonly __brand: 'VideoTime' };
export type NormalizedFloat = number & { readonly __brand: 'NormalizedFloat' };
export type HexColor = string & { readonly __brand: 'HexColor' };

// ────────────────────────────────────────────────────
// Video Source Types
// ────────────────────────────────────────────────────
export type VideoSourceKind = 'local-file' | 'direct-url' | 'youtube' | 'demo' | 'none';

export interface VideoSource {
  readonly kind: VideoSourceKind;
  readonly url?: string;
  readonly name?: string;
  readonly fileId?: string;
  readonly videoId?: string;
  readonly startSeconds?: number;
  readonly duration?: number;
}

// ────────────────────────────────────────────────────
// Spatial/Temporal/Visual Types
// ────────────────────────────────────────────────────
export interface SpatialData {
  readonly x: NormalizedFloat;
  readonly y: NormalizedFloat;
  readonly width: NormalizedFloat;
  readonly height: NormalizedFloat;
  readonly rotation: number;
  readonly zIndex: number;
}

export interface TemporalData {
  readonly startTime: VideoTime;
  readonly endTime: VideoTime | null;
  readonly duration: number;
}

export interface VisualData {
  readonly color: HexColor;
  readonly opacity: NormalizedFloat;
  readonly strokeWidth: number;
  readonly fill: HexColor | 'transparent';
}

// ────────────────────────────────────────────────────
// Annotation Types
// ────────────────────────────────────────────────────
export type AnnotationShapeType = 'rect' | 'circle' | 'polygon' | 'arrow' | 'freehand';
export type AnnotationType =
  | 'box'
  | 'polygon'
  | 'point'
  | 'arrow'
  | 'text'
  | 'image'
  | 'ellipse'
  | 'chapter'
  | 'highlight'
  | 'comment'
  | 'tag';

export interface VisualExtension {
  readonly shapeType: AnnotationShapeType;
  readonly textContent?: string;
  /** Base64-encoded Loro snapshot. Active in v24.0 GA. REPO_EVIDENCE: UDMNode.ts */
  readonly loroState?: string;
  readonly points?: ReadonlyArray<{ readonly x: NormalizedFloat; readonly y: NormalizedFloat }>;
  readonly fontSize?: number;
  readonly fontStyle?: 'normal' | 'italic' | 'bold';
  readonly annotationType?: AnnotationType;
}

export interface StudioExtension {
  readonly volumeMultiplier: number;
  readonly audioPan: number;
  readonly isLocked: boolean;
  readonly opacityKeyframes?: ReadonlyArray<{
    readonly timeOffset: number;
    readonly value: NormalizedFloat;
  }>;
}

export interface BlocksExtension {
  readonly blockLayoutType: 'grid' | 'flex' | 'absolute';
  readonly borderStyle: 'solid' | 'dashed' | 'none';
  readonly childConnectionIds: ReadonlyArray<ObjectID>;
}

/**
 * Code extension payload.
 * @deprecated Not in shipped demo path. Preserved for round-trip integrity.
 */
export interface CodeExtension {
  readonly codeLanguage: 'javascript' | 'typescript' | 'python';
  readonly sourceCode: string;
  readonly loroState?: string;
  readonly sandboxCapabilities: ReadonlyArray<string>;
}

export interface NodeExtensions {
  readonly visual?: VisualExtension;
  readonly studio?: StudioExtension;
  readonly blocks?: BlocksExtension;
  readonly code?: CodeExtension;
}

export interface SyncMetadata {
  readonly serverSeq: number;
  readonly localOpId: string;
  readonly nodeId: string;
  readonly lastSyncedAt: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly integrity: {
    readonly parentHash: string;
    readonly signature: string;
    readonly publicKey: string;
  };
}

export interface UDMNode {
  readonly id: ObjectID;
  readonly type: 'annotation' | 'element' | 'clip' | 'track';
  readonly spatial: SpatialData;
  readonly temporal: TemporalData;
  readonly visual: VisualData;
  readonly extensions: NodeExtensions;
  /** REPO_EVIDENCE: required in real Anotator8. Lab adapter warns (not fails) when missing. */
  readonly sync?: SyncMetadata;
  readonly parentId: ObjectID | null;
  readonly fractionalIndex: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  // FERPA / COPPA / GDPR compliance — REPO_EVIDENCE
  readonly ownerId?: string;
  readonly classroomId?: string;
  readonly isEducationRecord?: boolean;
  readonly dataResidency?: 'us-east' | 'eu-central' | 'us-west' | 'kz-central';
}

// ────────────────────────────────────────────────────
// Subtitle Types
// ────────────────────────────────────────────────────
export type AppLocale = 'en' | 'ru' | 'kk';

export interface SubtitleStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly color: string;
  readonly backgroundColor: string | 'transparent';
  readonly outlineColor: string | 'transparent';
  readonly outlineWidth: number;
  readonly shadow: boolean;
  readonly align: 'left' | 'center' | 'right';
  readonly verticalPosition: 'top' | 'middle' | 'bottom' | number;
}

export type SubtitleAnimation =
  | { readonly type: 'none' }
  | { readonly type: 'fade' }
  | { readonly type: 'slide' };

export interface SubtitleTrack {
  readonly id: string;
  readonly language: AppLocale;
  readonly label: string;
  readonly visible: boolean;
  readonly locked: boolean;
}

export interface SubtitleCue {
  readonly id: string;
  readonly trackId: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly text: Record<AppLocale, string>;
  readonly style: SubtitleStyle;
  readonly animation: SubtitleAnimation;
}

// ────────────────────────────────────────────────────
// Project File Types
// ────────────────────────────────────────────────────
export const PROJECT_FILE_VERSION = '24.0.0';

export interface ProjectFilePayload {
  readonly version: string;
  readonly videoUrl?: string;
  readonly videoSource?: VideoSource;
  readonly locale?: AppLocale;
  readonly classroomId?: string;
  readonly classroomName?: string;
  readonly subtitleTracks?: SubtitleTrack[];
  readonly subtitleCues?: SubtitleCue[];
  readonly nodes: UDMNode[];
}

// ────────────────────────────────────────────────────
// Integration Warning Type
// ────────────────────────────────────────────────────
export type WarningSeverity = 'info' | 'warning' | 'error';

export interface IntegrationWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: WarningSeverity;
  readonly field?: string;
}

// ────────────────────────────────────────────────────
// Normalized Integration Model
// ────────────────────────────────────────────────────
export interface NormalizedVideoSource {
  readonly kind: 'none' | 'local' | 'direct-url' | 'youtube' | 'unknown';
  readonly label?: string;
  readonly durationMs?: number;
  readonly url?: string;
  readonly warnings: IntegrationWarning[];
}

export interface NormalizedAnnotation {
  readonly id: ObjectID;
  readonly type: AnnotationType;
  readonly shapeType: AnnotationShapeType | 'unknown';
  readonly spatial: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly temporal: {
    readonly startMs: number;
    readonly endMs: number | null;
  };
  readonly visual: {
    readonly color: string;
    readonly opacity: number;
    readonly fill: string;
  };
  readonly text?: string;
  /**
   * Full preserved NodeExtensions payload (visual|studio|blocks|code).
   * REPO_EVIDENCE: Anotator8 UDMNode NodeExtensions has all four.
   * The lab normalizes `visual` into the typed fields above; the rest
   * (and any unrecognized sub-fields) are kept here verbatim.
   */
  readonly extensions: Record<string, unknown>;
  readonly warnings: IntegrationWarning[];
}

export interface NormalizedSubtitleTrack {
  readonly id: string;
  readonly language: AppLocale;
  readonly label: string;
  readonly visible: boolean;
  readonly cueCount: number;
}

export interface NormalizedTimelineTrack {
  readonly id: string;
  readonly type: 'annotation' | 'subtitle' | 'unknown';
  readonly nodeCount: number;
}

export interface NormalizedProject {
  readonly version: string;
  readonly source: NormalizedVideoSource;
  readonly annotations: NormalizedAnnotation[];
  readonly subtitleTracks: NormalizedSubtitleTrack[];
  readonly timelineTracks: NormalizedTimelineTrack[];
  readonly metadata: {
    readonly locale?: AppLocale;
    readonly classroomId?: string;
    readonly classroomName?: string;
  };
  readonly unknownFields: Record<string, unknown>;
  readonly warnings: IntegrationWarning[];
  readonly stats: {
    readonly totalAnnotations: number;
    readonly annotationTypes: Record<AnnotationType, number>;
    readonly shapeTypes: Record<AnnotationShapeType, number>;
    readonly subtitleCueCount: number;
    readonly hasTemporalData: boolean;
    readonly hasVisualExtensions: boolean;
  };
}

// ────────────────────────────────────────────────────
// Tool Result Types
// ────────────────────────────────────────────────────
export interface ToolResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly warnings?: IntegrationWarning[];
}

export interface CapabilitiesResult {
  readonly supportedFeatures: readonly string[];
  readonly limitations: readonly string[];
  readonly annotationTypes: readonly AnnotationType[];
  readonly supportedSubtitleLanguages: readonly AppLocale[];
}

export interface InspectProjectResult {
  readonly projectId: string;
  readonly version: string;
  readonly source: {
    readonly kind: string;
    readonly label: string;
    readonly durationMs: number;
    readonly warnings: readonly string[];
  };
  readonly stats: {
    readonly totalAnnotations: number;
    readonly byType: Record<string, number>;
    readonly byShape: Record<string, number>;
    readonly hasTemporalData: boolean;
    readonly hasVisualExtensions: boolean;
  };
  readonly rawSummary: {
    readonly nodeCount: number;
    readonly trackCount: number;
    readonly version: string;
  };
  readonly warnings: readonly string[];
}

export interface ValidateProjectResult {
  readonly valid: boolean;
  readonly errors: IntegrationWarning[];
  readonly warnings: IntegrationWarning[];
  readonly checks: readonly {
    readonly name: string;
    readonly passed: boolean;
    readonly message?: string;
  }[];
}

export interface SummarizeAnnotationsResult {
  readonly total: number;
  readonly byType: Record<AnnotationType, number>;
  readonly byShape: Record<AnnotationShapeType, number>;
  readonly temporalDistribution: {
    readonly start: number;
    readonly end: number;
    readonly range: number;
  };
  readonly visualSummary: {
    readonly uniqueColors: number;
    readonly opaqueCount: number;
    readonly transparentCount: number;
  };
}

export interface FindAnnotationsResult {
  readonly matches: NormalizedAnnotation[];
  readonly total: number;
  readonly filters: Record<string, unknown>;
}

export interface ReviewPlanResult {
  readonly sections: readonly {
    readonly title: string;
    readonly checks: readonly {
      readonly description: string;
      readonly priority: 'high' | 'medium' | 'low';
      readonly type: 'issue' | 'suggestion' | 'verification';
    }[];
  }[];
  readonly estimatedTime: string;
}

export interface ExportReportResult {
  readonly format: 'markdown' | 'json';
  readonly content: string;
  readonly filename: string;
}
