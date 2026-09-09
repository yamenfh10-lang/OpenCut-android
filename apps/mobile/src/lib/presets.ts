// Shared presets ported as IDEAS from LumoCut (MIT) and devhyper
// open-video-editor (GPL — inspiration only, all code below is written
// from scratch for OpenCut mobile): filter presets, transforms, clip color
// labels, marker colors, project aspects, plus CSS builders for preview.

export interface ClipFilter {
  brightness: number; // 0..2, default 1
  contrast: number; // 0..2, default 1
  saturation: number; // 0..2, default 1
  grayscale: number; // 0..1, default 0
  sepia: number; // 0..1, default 0
  invert: number; // 0..1, default 0
}

export const DEFAULT_FILTER: ClipFilter = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  grayscale: 0,
  sepia: 0,
  invert: 0,
};

export function normalizeFilter(input: Partial<ClipFilter> | undefined): ClipFilter {
  const f = input ?? {};
  const num = (v: unknown, fallback: number, min: number, max: number): number => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    brightness: num(f.brightness, 1, 0, 2),
    contrast: num(f.contrast, 1, 0, 2),
    saturation: num(f.saturation, 1, 0, 2),
    grayscale: num(f.grayscale, 0, 0, 1),
    sepia: num(f.sepia, 0, 0, 1),
    invert: num(f.invert, 0, 0, 1),
  };
}

export function isDefaultFilter(f: ClipFilter | undefined): boolean {
  if (!f) return true;
  return (
    f.brightness === 1 &&
    f.contrast === 1 &&
    f.saturation === 1 &&
    f.grayscale === 0 &&
    f.sepia === 0 &&
    f.invert === 0
  );
}

export function cssFilter(f: ClipFilter | undefined): string {
  const n = normalizeFilter(f);
  if (isDefaultFilter(n)) return "none";
  return (
    `brightness(${n.brightness}) contrast(${n.contrast}) ` +
    `saturate(${n.saturation}) grayscale(${n.grayscale}) ` +
    `sepia(${n.sepia}) invert(${n.invert})`
  );
}

export interface FilterPreset {
  id: string;
  label: string;
  filter: ClipFilter;
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", label: "None", filter: { ...DEFAULT_FILTER } },
  {
    id: "bw",
    label: "B&W",
    filter: { ...DEFAULT_FILTER, grayscale: 1, contrast: 1.1 },
  },
  {
    id: "sepia",
    label: "Sepia",
    filter: { ...DEFAULT_FILTER, sepia: 0.8, contrast: 1.05 },
  },
  {
    id: "invert",
    label: "Invert",
    filter: { ...DEFAULT_FILTER, invert: 1 },
  },
  {
    id: "vivid",
    label: "Vivid",
    filter: { ...DEFAULT_FILTER, saturation: 1.6, contrast: 1.15 },
  },
  {
    id: "faded",
    label: "Faded",
    filter: { ...DEFAULT_FILTER, contrast: 0.85, saturation: 0.7, brightness: 1.08 },
  },
  {
    id: "noir",
    label: "Noir",
    filter: { ...DEFAULT_FILTER, grayscale: 1, contrast: 1.4, brightness: 0.95 },
  },
];

export type Rotation = 0 | 90 | 180 | 270;

export interface ClipTransform {
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  scale: number; // 0.25..3, default 1
}

export const DEFAULT_TRANSFORM: ClipTransform = {
  rotation: 0,
  flipH: false,
  flipV: false,
  scale: 1,
};

export function normalizeTransform(input: Partial<ClipTransform> | undefined): ClipTransform {
  const t = input ?? {};
  const rot = t.rotation === 90 || t.rotation === 180 || t.rotation === 270 ? t.rotation : 0;
  const scale =
    typeof t.scale === "number" && Number.isFinite(t.scale)
      ? Math.min(3, Math.max(0.25, t.scale))
      : 1;
  return {
    rotation: rot,
    flipH: t.flipH === true,
    flipV: t.flipV === true,
    scale,
  };
}

export function isDefaultTransform(t: ClipTransform | undefined): boolean {
  if (!t) return true;
  return t.rotation === 0 && !t.flipH && !t.flipV && t.scale === 1;
}

export function cssTransform(t: ClipTransform | undefined): string {
  const n = normalizeTransform(t);
  const parts: string[] = [];
  if (n.rotation !== 0) parts.push(`rotate(${n.rotation}deg)`);
  if (n.flipH || n.flipV) {
    parts.push(`scale(${n.flipH ? -1 : 1}, ${n.flipV ? -1 : 1})`);
  }
  if (n.scale !== 1) parts.push(`scale(${n.scale})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

/** Clip color labels (7, LumoCut-style catppuccin-ish set). "none" = default. */
export const COLOR_LABELS = [
  { id: "none", label: "None", color: null },
  { id: "red", label: "Red", color: "#f87171" },
  { id: "peach", label: "Peach", color: "#fab387" },
  { id: "yellow", label: "Yellow", color: "#f9e2af" },
  { id: "green", label: "Green", color: "#a6e3a1" },
  { id: "blue", label: "Blue", color: "#89b4fa" },
  { id: "mauve", label: "Mauve", color: "#cba6f7" },
] as const;

export type ColorLabelId = (typeof COLOR_LABELS)[number]["id"];

export function colorLabelColor(id: string | undefined): string | null {
  const found = COLOR_LABELS.find((c) => c.id === id);
  return found && found.color ? found.color : null;
}

/** Timeline marker colors (6, LumoCut-style). */
export const MARKER_COLORS = [
  { id: "red", label: "Red", color: "#f87171" },
  { id: "orange", label: "Orange", color: "#fb923c" },
  { id: "yellow", label: "Yellow", color: "#fbbf24" },
  { id: "green", label: "Green", color: "#34d399" },
  { id: "blue", label: "Blue", color: "#60a5fa" },
  { id: "purple", label: "Purple", color: "#c084fc" },
] as const;

export type MarkerColorId = (typeof MARKER_COLORS)[number]["id"];

export function markerColor(id: string | undefined): string {
  return MARKER_COLORS.find((c) => c.id === id)?.color ?? MARKER_COLORS[0].color;
}

export type ProjectAspect = "16:9" | "9:16" | "1:1";

export const ASPECTS: { id: ProjectAspect; label: string; ratio: string }[] = [
  { id: "16:9", label: "Landscape 16:9", ratio: "16 / 9" },
  { id: "9:16", label: "Shorts 9:16", ratio: "9 / 16" },
  { id: "1:1", label: "Square 1:1", ratio: "1 / 1" },
];

export function aspectRatio(aspect: string | undefined): string {
  return ASPECTS.find((a) => a.id === aspect)?.ratio ?? "16 / 9";
}

/** Frame-accurate helpers (default 30fps timeline grid). */
export const FRAME_RATE = 30;
export const FRAME_STEP = 1 / FRAME_RATE;

export function snapToFrame(time: number, fps = FRAME_RATE): number {
  return Math.round(time * fps) / fps;
}
