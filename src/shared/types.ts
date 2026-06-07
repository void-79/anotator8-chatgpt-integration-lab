export type Anotator8ProjectRaw = unknown;

export type AppLocale = "en" | "ru" | "kk";
export type WarningSeverity = "info" | "warning" | "error";
export type IntegrationErrorCode =
  | "invalid_input"
  | "unsupported_project_version"
  | "too_large_input"
  | "missing_field"
  | "internal_error"
  | "unsupported_capability";

export interface IntegrationWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: WarningSeverity;
  readonly path?: string;
}

export interface IntegrationErrorShape {
  readonly code: IntegrationErrorCode;
  readonly message: string;
  readonly path?: string;
}

export type VideoSource =
  | {
      readonly kind: "local-file";
      readonly fileId: string;
      readonly objectUrl?: string;
      readonly name: string;
      readonly duration?: number;
    }
  | {
      readonly kind: "direct-url";
      readonly url: string;
      readonly duration?: number;
    }
  | {
      readonly kind: "youtube";
      readonly url: string;
      readonly videoId: string;
      readonly startSeconds?: number;
      readonly duration?: number;
    }
  | {
      readonly kind: "demo";
      readonly url: string;
    };

export interface SpatialData {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation?: number;
  readonly zIndex?: number;
}

export interface TemporalData {
  readonly startTime: number;
  readonly endTime: number | null;
  readonly duration?: number;
}

export interface VisualData {
  readonly color: string;
  readonly opacity: number;
  readonly strokeWidth?: number;
  readonly fill?: string;
}

export interface VisualExtension {
  readonly shapeType?: string;
  readonly textContent?: string;
  readonly points?: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  readonly fontSize?: number;
  readonly fontStyle?: "normal" | "italic" | "bold";
  readonly annotationType?: string;
  readonly loroState?: string;
}

export interface StudioExtension {
  readonly volumeMultiplier?: number;
  readonly audioPan?: number;
  readonly isLocked?: boolean;
  readonly opacityKeyframes?: ReadonlyArray<{ readonly timeOffset: number; readonly value: number }>;
}

export interface UDMNode {
  readonly id?: string;
  readonly type?: string;
  readonly spatial?: SpatialData;
  readonly temporal?: TemporalData;
  readonly visual?: VisualData;
  readonly extensions?: {
    readonly visual?: VisualExtension;
    readonly studio?: StudioExtension;
    readonly blocks?: unknown;
    readonly code?: unknown;
  };
  readonly sync?: unknown;
  readonly parentId?: string | null;
  readonly fractionalIndex?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly deletedAt?: string | null;
  readonly ownerId?: string;
  readonly classroomId?: string;
  readonly isEducationRecord?: boolean;
  readonly dataResidency?: string;
}

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
  readonly style?: unknown;
  readonly animation?: unknown;
}

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

export interface NormalizedAnnotation {
  readonly id: string;
  readonly type: string;
  readonly shapeType: string;
  readonly label?: string;
  readonly confidence?: number;
  readonly spatial: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: number;
    readonly zIndex: number;
  };
  readonly temporal: {
    readonly startMs: number;
    readonly endMs: number | null;
    readonly durationMs?: number;
  };
  readonly visual: {
    readonly color: string;
    readonly opacity: number;
    readonly fill: string;
    readonly strokeWidth: number;
  };
  readonly text?: string;
  readonly parentId?: string | null;
  readonly warnings: IntegrationWarning[];
}

export interface NormalizedSubtitleTrack {
  readonly id: string;
  readonly language: AppLocale;
  readonly label: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly cueCount: number;
  readonly cues: ReadonlyArray<{
    readonly id: string;
    readonly startMs: number;
    readonly endMs: number;
    readonly textPreview: string;
    readonly warnings: IntegrationWarning[];
  }>;
  readonly warnings: IntegrationWarning[];
}

export interface NormalizedTimelineTrack {
  readonly id: string;
  readonly type: "annotation" | "subtitle" | "unknown";
  readonly itemCount: number;
  readonly warnings: IntegrationWarning[];
}

export interface NormalizedProject {
  readonly version: string;
  readonly source: {
    readonly kind: "none" | "local" | "direct-url" | "youtube" | "unknown";
    readonly label?: string;
    readonly url?: string;
    readonly durationMs?: number;
    readonly warnings: IntegrationWarning[];
  };
  readonly annotations: NormalizedAnnotation[];
  readonly subtitles: NormalizedSubtitleTrack[];
  readonly timeline: NormalizedTimelineTrack[];
  readonly metadata: Record<string, unknown>;
  readonly unknownFields: Record<string, unknown>;
  readonly warnings: IntegrationWarning[];
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: IntegrationWarning[];
  readonly warnings: IntegrationWarning[];
  readonly checks: ReadonlyArray<{
    readonly name: string;
    readonly passed: boolean;
    readonly evidence: string;
  }>;
}

export type ProjectInput =
  | { readonly projectData: unknown; readonly fixtureId?: never }
  | { readonly projectData?: never; readonly fixtureId: "sample-project" };
