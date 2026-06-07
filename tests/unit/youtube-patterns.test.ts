/**
 * REPO_EVIDENCE: C:\Anotator8\src\application\videoSources.ts:38-44
 *
 * Anotator8's parseYouTubeVideoId accepts 5 URL shapes:
 *   1. https://www.youtube.com/watch?v=ID
 *   2. https://youtu.be/ID
 *   3. https://www.youtube.com/embed/ID
 *   4. https://www.youtube.com/shorts/ID
 *   5. https://www.youtube.com/live/ID
 *
 * The lab adapter's parseYouTubeVideoId helper must match the real product
 * shape. If Anotator8 adds a 6th pattern (e.g. youtube.com/clip/ID), the
 * lab will need to be updated in lockstep.
 */
import { describe, expect, it } from "vitest";
import { adapter, parseYouTubeVideoId } from "../../src/server/anotator8-adapter.js";

const POSITIVE_CASES = [
  { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
  { url: "https://youtu.be/dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
  { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
  { url: "https://www.youtube.com/shorts/dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
  { url: "https://www.youtube.com/live/dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
];

const NEGATIVE_CASES = [
  "https://example.com/video.mp4",
  "https://vimeo.com/12345",
  "https://www.youtube.com/",
  "not a url at all",
  "",
];

describe("parseYouTubeVideoId (REPO_EVIDENCE: Anotator8 videoSources.ts)", () => {
  for (const c of POSITIVE_CASES) {
    it(`parses ${c.url}`, () => {
      expect(parseYouTubeVideoId(c.url)).toBe(c.id);
    });
  }

  for (const url of NEGATIVE_CASES) {
    it(`returns null for ${JSON.stringify(url)}`, () => {
      expect(parseYouTubeVideoId(url)).toBeNull();
    });
  }
});

describe("adapter normalize: inferred YouTube source", () => {
  for (const c of POSITIVE_CASES) {
    it(`infers kind=youtube for ${c.url}`, () => {
      const result = adapter.normalize({ version: "24.0.0", videoUrl: c.url, nodes: [] });
      expect(result.source.kind).toBe("youtube");
      if (result.source.kind === "youtube") {
        expect(result.source.label).toContain(c.id);
      }
    });
  }

  it("does NOT infer youtube for non-YouTube URLs", () => {
    const result = adapter.normalize({ version: "24.0.0", videoUrl: "https://example.com/video.mp4", nodes: [] });
    expect(result.source.kind).toBe("direct-url");
  });
});
