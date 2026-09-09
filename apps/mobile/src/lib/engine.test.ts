// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  exportProject,
  extractAudio,
  getMetadata,
  getThumbnail,
  renderPlaceholderThumbnail,
  resolutionToSize,
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

  it("resolutionToSize maps export presets", () => {
    expect(resolutionToSize("720p")).toEqual({ width: 1280, height: 720 });
    expect(resolutionToSize("1080p")).toEqual({ width: 1920, height: 1080 });
    expect(resolutionToSize("4K")).toEqual({ width: 3840, height: 2160 });
  });

  it("exportProject supports mp3 / audioOnly manifests", async () => {
    const out = await exportProject({ clips: [], format: "mp3" });
    expect(out).toBeInstanceOf(Blob);
    expect(out.size).toBeGreaterThan(0);
    const audioOnly = await exportProject({
      clips: [],
      format: "mp4",
      audioOnly: true,
      fps: 60,
      width: 1920,
      height: 1080,
    });
    expect(audioOnly).toBeInstanceOf(Blob);
    if (audioOnly.type === "application/json") {
      const manifest = JSON.parse(await audioOnly.text()) as {
        format: string;
        fps: number;
      };
      expect(manifest.format).toBe("mp3");
      expect(manifest.fps).toBe(60);
    }
  });

  it("extractAudio passes through audio blobs and nulls video offline", async () => {
    const audio = new Blob(["audio-bytes"], { type: "audio/mp4" });
    const back = await extractAudio(audio);
    expect(back).toBeInstanceOf(Blob);
    const video = new Blob(["not real video"], { type: "video/mp4" });
    const none = await extractAudio(video);
    expect(none === null || none instanceof Blob).toBe(true);
  });
});
