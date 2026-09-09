// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  exportProject,
  getMetadata,
  getThumbnail,
  renderPlaceholderThumbnail,
  trimMedia,
} from "./engine";

describe("engine fallbacks", () => {
  it("renderPlaceholderThumbnail resolves to a PNG blob", async () => {
    const blob = await renderPlaceholderThumbnail("my clip", 1.5);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("getThumbnail falls back to a PNG placeholder offline", async () => {
    const input = new Blob(["not real video"], { type: "text/plain" });
    const thumb = await getThumbnail(input, 2.5, "test clip");
    expect(thumb).toBeInstanceOf(Blob);
    expect((thumb as Blob).type).toBe("image/png");
    expect((thumb as Blob).size).toBeGreaterThan(0);
  });

  it("trimMedia returns the original blob for a valid range", async () => {
    const input = new Blob(["framebytes"], { type: "video/mp4" });
    const out = await trimMedia(input, { start: 0, end: 1 });
    expect(out).toBeInstanceOf(Blob);
    expect(out.size).toBe(input.size);
  });

  it("trimMedia throws only for end <= start", async () => {
    const input = new Blob(["framebytes"], { type: "video/mp4" });
    await expect(trimMedia(input, { start: 1, end: 1 })).rejects.toThrow();
    await expect(trimMedia(input, { start: 2, end: 1 })).rejects.toThrow();
  });

  it("exportProject resolves with a manifest fallback and reports progress", async () => {
    const onProgress = vi.fn();
    const out = await exportProject({
      clips: [
        { id: "c1", trackId: "v1", name: "A", start: 0, duration: 2 },
      ],
      format: "mp4",
      onProgress,
    });
    expect(out).toBeInstanceOf(Blob);
    expect(out.size).toBeGreaterThan(0);
    expect(onProgress).toHaveBeenCalled();
    // Manifest fallback is JSON; a real mp4 render would be video/*.
    if (out.type === "application/json") {
      const manifest = JSON.parse(await out.text()) as {
        format: string;
        clips: unknown[];
      };
      expect(manifest.format).toBe("mp4");
      expect(manifest.clips).toHaveLength(1);
    }
  });

  it("exportProject supports webm", async () => {
    const out = await exportProject({ clips: [], format: "webm" });
    expect(out).toBeInstanceOf(Blob);
    expect(out.size).toBeGreaterThan(0);
  });

  it("getMetadata resolves to a metadata object on garbage input", async () => {
    const meta = await getMetadata(
      new Blob(["hello"], { type: "text/plain" }),
    );
    expect(meta).toHaveProperty("duration");
    expect(meta).toHaveProperty("hasVideo");
    expect(meta).toHaveProperty("hasAudio");
  });
});
