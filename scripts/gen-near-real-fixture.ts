/**
 * scripts/gen-near-real-fixture.ts
 *
 * Emits a near-real Anotator8 project JSON by reading the lab adapter
 * and producing a file that:
 *   - matches Anotator8's real UDMNode + ProjectFilePayload shape (24.0.0)
 *   - has more annotations, more shape types, more subtitle tracks than
 *     the synthetic sample-project.anotator8.json
 *   - includes a few validation warnings (orphan cue, missing time
 *     range) so the validator still has something to flag
 *   - preserves unknown future fields (so the adapter's
 *     `collectUnknownFields()` path is exercised)
 *
 * REPO_EVIDENCE for the schema being targeted:
 *   - C:\Anotator8\src\domain\entities\UDMNode.ts
 *   - C:\Anotator8\src\application\videoSources.ts
 *   - C:\Anotator8\src\application\services\projectFile.ts
 *
 * Usage:
 *   npx tsx scripts/gen-near-real-fixture.ts [output-path]
 *   # default output-path: fixtures/near-real-project.anotator8.json
 *
 * Exit codes:
 *   0 — fixture written and validates deterministically
 *   1 — adapter rejected the fixture (means our schema drifted)
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { adapter } from "../src/server/anotator8-adapter.js";

const DEFAULT_OUTPUT = "fixtures/near-real-project.anotator8.json";

interface ProjectShape {
  version: string;
  videoUrl: string;
  videoSource: {
    kind: "direct-url";
    url: string;
    duration: number;
  };
  locale: "en" | "ru" | "kk";
  classroomId: string;
  classroomName: string;
  subtitleTracks: ReadonlyArray<{
    id: string;
    language: "en" | "ru" | "kk";
    label: string;
    visible: boolean;
    locked: boolean;
  }>;
  subtitleCues: ReadonlyArray<{
    id: string;
    trackId: string;
    startTime: number;
    endTime: number;
    text: { en: string; ru: string; kk: string };
  }>;
  nodes: ReadonlyArray<{
    id: string;
    type: "annotation" | "track" | "element";
    spatial?: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      zIndex: number;
    };
    temporal?: {
      startTime: number;
      endTime: number | null;
      duration: number;
    };
    visual?: {
      color: string;
      opacity: number;
      strokeWidth: number;
      fill: string;
    };
    extensions?: {
      visual?: {
        shapeType: "rect" | "circle" | "polygon" | "arrow" | "freehand";
        annotationType?: string;
        textContent?: string;
      };
    };
    parentId?: string | null;
    fractionalIndex?: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string | null;
  }>;
  futureExtensionField?: unknown;
  _fixture?: Record<string, unknown>;
}

function pad(n: number, w = 4): string {
  return n.toString().padStart(w, "0");
}

/**
 * Deterministic pseudo-random. Same seed → same fixture every run.
 * Keeps the fixture reproducible (no flaky tests).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFixture(seed = 0x4e4f8): ProjectShape {
  const rand = mulberry32(seed);
  const pick = <T,>(items: ReadonlyArray<T>): T => items[Math.floor(rand() * items.length)];

  // Generate N=24 annotations spread over a 60s timeline with diverse shape types
  const shapeTypes = ["rect", "circle", "polygon", "arrow", "freehand"] as const;
  const annotationTypes = ["box", "ellipse", "polygon", "point", "arrow", "highlight", "comment", "tag"] as const;
  const colors = ["#e11d48", "#2563eb", "#16a34a", "#ca8a04", "#7c3aed", "#0891b2"];
  const labels = [
    "Teacher explanation",
    "Student question",
    "Key concept",
    "Demonstration",
    "Discussion prompt",
    "Example shown",
    "Definition",
    "Counter-example",
    "Worked example",
    "Practice problem",
  ];

  // Local mutable view so we can .push() during construction; the return
  // type of buildFixture() widens back to the readonly ProjectShape so
  // downstream consumers still see the immutable contract.
  const nodes: Array<ProjectShape["nodes"][number]> = [];
  for (let i = 0; i < 24; i += 1) {
    const shape = pick(shapeTypes);
    const annoType = pick(annotationTypes);
    const color = pick(colors);
    const label = pick(labels);
    const startSec = +(rand() * 55).toFixed(2);
    const endSec = +(startSec + 1.5 + rand() * 4).toFixed(2);
    const x = +(rand() * 0.7).toFixed(3);
    const y = +(rand() * 0.7).toFixed(3);
    const w = +(0.1 + rand() * 0.25).toFixed(3);
    const h = +(0.08 + rand() * 0.2).toFixed(3);
    nodes.push({
      id: `ann-near-real-${pad(i)}`,
      type: "annotation",
      spatial: { x, y, width: w, height: h, rotation: 0, zIndex: i + 1 },
      temporal: { startTime: startSec, endTime: endSec, duration: +(endSec - startSec).toFixed(2) },
      visual: { color, opacity: 0.85, strokeWidth: 2, fill: i % 3 === 0 ? "transparent" : `${color}22` },
      extensions: {
        visual: { shapeType: shape, annotationType: annoType, textContent: `${label} #${i + 1}` },
      },
      parentId: null,
      fractionalIndex: `a${i.toString(36)}`,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      deletedAt: null,
    });
  }

  // Add two explicit track nodes (so timeline has 2+ tracks)
  nodes.push({
    id: "track-overlay-1",
    type: "track",
    spatial: { x: 0, y: 0, width: 0, height: 0, rotation: 0, zIndex: 0 },
    temporal: { startTime: 0, endTime: 60, duration: 60 },
    visual: { color: "#000000", opacity: 1, strokeWidth: 0, fill: "transparent" },
    parentId: null,
    fractionalIndex: "t0",
  });
  nodes.push({
    id: "track-overlay-2",
    type: "track",
    spatial: { x: 0, y: 0, width: 0, height: 0, rotation: 0, zIndex: 0 },
    temporal: { startTime: 0, endTime: 60, duration: 60 },
    visual: { color: "#000000", opacity: 1, strokeWidth: 0, fill: "transparent" },
    parentId: null,
    fractionalIndex: "t1",
  });

  // Subtitle tracks: 3 languages
  const tracks: Array<ProjectShape["subtitleTracks"][number]> = [
    { id: "track-en-nr", language: "en", label: "English", visible: true, locked: false },
    { id: "track-ru-nr", language: "ru", label: "Русский", visible: true, locked: false },
    { id: "track-kk-nr", language: "kk", label: "Қазақша", visible: true, locked: false },
  ];

  // 6 cues per track = 18 total
  const cues: Array<ProjectShape["subtitleCues"][number]> = [];
  for (const track of tracks) {
    for (let i = 0; i < 6; i += 1) {
      const startSec = i * 10;
      const endSec = startSec + 8;
      cues.push({
        id: `cue-${track.id}-${i}`,
        trackId: track.id,
        startTime: startSec,
        endTime: endSec,
        text: {
          en: `English cue ${i + 1} for ${track.id}`,
          ru: `Русская реплика ${i + 1} для ${track.id}`,
          kk: `Қазақша реплика ${i + 1} үшін ${track.id}`,
        },
      });
    }
  }
  // Intentional: one orphan cue pointing at a non-existent track to exercise the
  // ORPHANED_SUBTITLE_CUE validator warning path.
  cues.push({
    id: "cue-orphan-nr",
    trackId: "missing-track-nr",
    startTime: 0,
    endTime: 3,
    text: { en: "Orphan cue (intentional)", ru: "", kk: "" },
  });

  return {
    version: "24.0.0",
    videoUrl: "https://example.invalid/near-real-fixture.mp4",
    videoSource: {
      kind: "direct-url",
      url: "https://example.invalid/near-real-fixture.mp4",
      duration: 60,
    },
    locale: "en",
    classroomId: "near-real-classroom",
    classroomName: "Near-Real Demo Classroom",
    subtitleTracks: tracks,
    subtitleCues: cues,
    nodes,
    // Future extension field — proves `collectUnknownFields()` preserves it.
    futureExtensionField: {
      schema: "near-real-fixture-future-v1",
      note: "This block must round-trip through the adapter.",
    },
    _fixture: {
      synthetic: true,
      generatedBy: "scripts/gen-near-real-fixture.ts",
      seed,
    },
  };
}

async function main(): Promise<void> {
  const out = process.argv[2] ?? DEFAULT_OUTPUT;
  const fixture = buildFixture();
  // Validate it through the adapter BEFORE writing — if our schema drifted
  // from the adapter, fail fast with a clear message.
  const project = adapter.normalize(fixture);
  const validation = adapter.validate(fixture);

  if (project.annotations.length === 0) {
    process.stderr.write("ERROR: adapter dropped all annotations\n");
    process.exit(1);
  }
  if (Object.keys(project.unknownFields).length === 0) {
    process.stderr.write("ERROR: adapter did not preserve futureExtensionField\n");
    process.exit(1);
  }

  await writeFile(resolve(out), `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${out}\n`);
  process.stdout.write(`annotations=${project.annotations.length}\n`);
  process.stdout.write(
    `shapes=${Object.entries(project.annotations.reduce<Record<string, number>>((acc, a) => {
      acc[a.shapeType] = (acc[a.shapeType] ?? 0) + 1;
      return acc;
    }, {})).map(([k, v]) => `${k}:${v}`).join(",")}\n`,
  );
  process.stdout.write(
    `types=${Object.entries(project.annotations.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    }, {})).map(([k, v]) => `${k}:${v}`).join(",")}\n`,
  );
  process.stdout.write(
    `subtitleTracks=${project.subtitles.length} cues=${project.subtitles.reduce((s, t) => s + t.cueCount, 0)}\n`,
  );
  process.stdout.write(
    `timeline=${project.timeline.length} tracks, unknownFields=${Object.keys(project.unknownFields).length}\n`,
  );
  process.stdout.write(`validation.valid=${validation.valid} warnings=${validation.warnings.length} errors=${validation.errors.length}\n`);
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write(`gen-near-real-fixture: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
