// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { computePeaks, detectBeats } from "./audio";
import { buildSrt, buildVtt, cuesFromTextClips } from "./subtitles";

describe("audio analysis (pure)", () => {
  it("computePeaks downsamples to bars normalized 0..1", () => {
    const data = new Float32Array([0, 0.5, -1, 0.25, 0, 0, 0.8, -0.2]);
    const peaks = computePeaks(data, 4);
    expect(peaks).toHaveLength(4);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(1);
    expect(peaks[1]).toBeCloseTo(1);
    expect(computePeaks(new Float32Array([]), 4)).toEqual([0, 0, 0, 0]);
  });

  it("detectBeats finds onsets with min gap", () => {
    const peaks = [0.1, 0.9, 0.1, 0.1, 0.95, 0.1, 0.1, 0.9, 0.1];
    const beats = detectBeats(peaks, 9, { threshold: 0.45, minGapSec: 0.35 });
    expect(beats.length).toBeGreaterThanOrEqual(2);
    expect(detectBeats([0.1, 0.2, 0.1], 3)).toEqual([]);
    expect(detectBeats([], 0)).toEqual([]);
  });
});

describe("subtitles", () => {
  const clips = [
    { start: 0, duration: 2, text: "Hello", name: "TEXT: Hello" },
    { start: 5, duration: 1.5, text: "  World  ", name: "TEXT: World" },
    { start: 2, duration: 1, name: "no text here" },
  ];

  it("cuesFromTextClips filters, sorts and clamps", () => {
    const cues = cuesFromTextClips(clips);
    expect(cues).toHaveLength(2);
    expect(cues[0]?.text).toBe("Hello");
    expect(cues[1]?.text).toBe("World");
    expect(cues[1]?.start).toBe(5);
  });

  it("buildSrt numbers cues with comma timestamps", () => {
    const srt = buildSrt(cuesFromTextClips(clips));
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,000\nHello");
    expect(srt).toContain("2\n00:00:05,000 --> 00:00:06,500\nWorld");
  });

  it("buildVtt has header with dot timestamps", () => {
    const vtt = buildVtt(cuesFromTextClips(clips));
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:05.000 --> 00:00:06.500");
  });

  it("empty cues produce empty bodies", () => {
    expect(buildSrt([])).toBe("");
    expect(buildVtt([])).toBe("WEBVTT\n\n");
  });
});
