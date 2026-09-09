// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, getTemplate } from "./templates";
import {
  FILTER_PRESETS,
  aspectRatio,
  colorLabelColor,
  cropRatio,
  cssFilter,
  cssTransform,
  isDefaultFilter,
  layoutBox,
  markerColor,
  normalizeCrop,
  normalizeFade,
  normalizeFilter,
  normalizeLayout,
  normalizeShape,
  normalizeShapeColor,
  normalizeTransform,
  normalizeTransition,
  normalizeVolume,
  snapToFrame,
} from "./presets";

describe("builtin templates", () => {
  it("ships at least 7 offline templates with valid timelines", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(7);
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.tracks.length).toBeGreaterThan(0);
      expect(t.clips.length).toBeGreaterThan(0);
      for (const c of t.clips) {
        expect(c.duration).toBeGreaterThan(0);
        expect(c.start).toBeGreaterThanOrEqual(0);
      }
      for (const m of t.markers) {
        expect(m.time).toBeGreaterThanOrEqual(0);
        expect(m.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("getTemplate resolves by id and misses unknown ids", () => {
    expect(getTemplate("shorts-opener")?.aspect).toBe("9:16");
    expect(getTemplate("nope")).toBeNull();
  });
});

describe("presets", () => {
  it("filter presets normalize and build CSS", () => {
    expect(FILTER_PRESETS.length).toBeGreaterThan(3);
    expect(isDefaultFilter(undefined)).toBe(true);
    expect(cssFilter(undefined)).toBe("none");
    const bw = FILTER_PRESETS.find((p) => p.id === "bw");
    expect(bw).toBeTruthy();
    expect(cssFilter(bw?.filter)).toContain("grayscale(1)");
    expect(normalizeFilter({ brightness: 99 }).brightness).toBe(2);
  });

  it("transform helpers clamp and build CSS", () => {
    expect(cssTransform(undefined)).toBe("none");
    expect(normalizeTransform({ rotation: 45 as never }).rotation).toBe(0);
    expect(cssTransform({ rotation: 90, flipH: false, flipV: false, scale: 1 })).toBe(
      "rotate(90deg)",
    );
  });

  it("label/marker/aspect lookups fall back safely", () => {
    expect(colorLabelColor("red")).toBeTruthy();
    expect(colorLabelColor("nope")).toBeNull();
    expect(markerColor("blue")).toBeTruthy();
    expect(markerColor(undefined)).toBeTruthy();
    expect(aspectRatio("9:16")).toBe("9 / 16");
    expect(aspectRatio("weird")).toBe("16 / 9");
  });

  it("snapToFrame quantizes to the 30fps grid", () => {
    expect(snapToFrame(0.1)).toBeCloseTo(0.1, 3);
    expect(snapToFrame(0.11)).toBeCloseTo(0.1, 3);
    expect(snapToFrame(1)).toBe(1);
  });

  it("crop/volume/fade normalize safely", () => {
    expect(normalizeCrop("9:16")).toBe("9:16");
    expect(normalizeCrop("bogus")).toBe("none");
    expect(cropRatio("1:1")).toBe("1 / 1");
    expect(cropRatio(undefined)).toBeNull();
    expect(normalizeVolume(0)).toBe(0);
    expect(normalizeVolume(99)).toBe(2);
    expect(normalizeVolume(undefined)).toBe(1);
    expect(normalizeFade(2.5)).toBeCloseTo(2.5);
    expect(normalizeFade(-1)).toBe(0);
    expect(normalizeFade(99)).toBe(10);
  });

  it("transitions/layouts/shapes normalize safely", () => {
    expect(normalizeTransition({ type: "dissolve", duration: 9 }).duration).toBe(2);
    expect(normalizeTransition({ type: "bogus" as never }).type).toBe("none");
    expect(normalizeLayout("pip-br")).toBe("pip-br");
    expect(normalizeLayout("bogus")).toBe("full");
    expect(layoutBox("left")).toMatchObject({ left: "0%", width: "50%" });
    expect(normalizeShape("heart")).toBe("heart");
    expect(normalizeShape("bogus")).toBe("rect");
    expect(normalizeShapeColor("#ff0000")).toBe("#ff0000");
    expect(normalizeShapeColor("red")).toBe("#fafafa");
  });
});
