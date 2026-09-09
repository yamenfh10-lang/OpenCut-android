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

/** Per-clip crop presets (devhyper-style crop). "none" keeps source framing. */
export const CROP_PRESETS = [
  { id: "none", label: "None", ratio: null },
  { id: "16:9", label: "16:9", ratio: "16 / 9" },
  { id: "9:16", label: "9:16", ratio: "9 / 16" },
  { id: "1:1", label: "1:1", ratio: "1 / 1" },
  { id: "4:3", label: "4:3", ratio: "4 / 3" },
] as const;

export type CropPresetId = (typeof CROP_PRESETS)[number]["id"];

export function normalizeCrop(input: unknown): CropPresetId {
  return CROP_PRESETS.some((c) => c.id === input) ? (input as CropPresetId) : "none";
}

export function cropRatio(id: string | undefined): string | null {
  return CROP_PRESETS.find((c) => c.id === id)?.ratio ?? null;
}

/** Volume 0..2 (0 mute, 1 normal, up to 2x boost for export gain). */
export function normalizeVolume(input: unknown): number {
  const n = typeof input === "number" && Number.isFinite(input) ? input : 1;
  return Math.min(2, Math.max(0, n));
}

/** Fade seconds, clamped 0..10. */
export function normalizeFade(input: unknown): number {
  const n = typeof input === "number" && Number.isFinite(input) ? input : 0;
  return Math.min(10, Math.max(0, n));
}

/** Incoming clip transitions (CapCut-style). Preview-grade + manifest data. */
export const TRANSITIONS = [
  { id: "none", label: "None" },
  { id: "dissolve", label: "Dissolve" },
  { id: "wipe", label: "Wipe" },
  { id: "slide", label: "Slide" },
  { id: "fade-black", label: "Fade black" },
  { id: "zoom", label: "Zoom" },
] as const;

export type TransitionType = (typeof TRANSITIONS)[number]["id"];

export interface ClipTransition {
  type: TransitionType;
  /** Seconds, 0.2..2. */
  duration: number;
}

export function normalizeTransition(input: Partial<ClipTransition> | undefined): ClipTransition {
  const t = input ?? {};
  const type = TRANSITIONS.some((x) => x.id === t.type) ? (t.type as TransitionType) : "none";
  const duration =
    typeof t.duration === "number" && Number.isFinite(t.duration)
      ? Math.min(2, Math.max(0.2, t.duration))
      : 0.5;
  return { type, duration };
}

/** PIP / split-screen layouts (CapCut-style overlays). */
export const LAYOUTS = [
  { id: "full", label: "Full" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "pip-tl", label: "PIP TL" },
  { id: "pip-tr", label: "PIP TR" },
  { id: "pip-bl", label: "PIP BL" },
  { id: "pip-br", label: "PIP BR" },
  { id: "center", label: "Center" },
] as const;

export type LayoutId = (typeof LAYOUTS)[number]["id"];

export function normalizeLayout(input: unknown): LayoutId {
  return LAYOUTS.some((l) => l.id === input) ? (input as LayoutId) : "full";
}

export interface LayoutBox {
  top: string;
  left: string;
  width: string;
  height: string;
}

/** Absolute box for a layout inside a 16:9 stage. */
export function layoutBox(layout: LayoutId): LayoutBox {
  switch (layout) {
    case "left":
      return { top: "0%", left: "0%", width: "50%", height: "100%" };
    case "right":
      return { top: "0%", left: "50%", width: "50%", height: "100%" };
    case "pip-tl":
      return { top: "4%", left: "3%", width: "32%", height: "32%" };
    case "pip-tr":
      return { top: "4%", left: "65%", width: "32%", height: "32%" };
    case "pip-bl":
      return { top: "64%", left: "3%", width: "32%", height: "32%" };
    case "pip-br":
      return { top: "64%", left: "65%", width: "32%", height: "32%" };
    case "center":
      return { top: "20%", left: "20%", width: "60%", height: "60%" };
    case "full":
    default:
      return { top: "0%", left: "0%", width: "100%", height: "100%" };
  }
}

/** Sticker shapes rendered as inline SVG overlays. */
export const SHAPES = [
  { id: "rect", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "star", label: "Star" },
  { id: "arrow", label: "Arrow" },
  { id: "heart", label: "Heart" },
] as const;

export type ShapeId = (typeof SHAPES)[number]["id"];

export function normalizeShape(input: unknown): ShapeId {
  return SHAPES.some((s) => s.id === input) ? (input as ShapeId) : "rect";
}

export const SHAPE_COLORS = ["#fafafa", "#f87171", "#fbbf24", "#34d399", "#60a5fa", "#c084fc"] as const;

export function normalizeShapeColor(input: unknown): string {
  return typeof input === "string" && /^#[0-9a-fA-F]{6}$/.test(input) ? input : "#fafafa";
}

/** Recently-used filter preset ids (localStorage, AdjustSheet). */
const RECENT_FX_KEY = "oc_recent_fx_v1";

export function readRecentFx(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_FX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string").slice(0, 5);
  } catch {
    return [];
  }
}

export function pushRecentFx(id: string): string[] {
  const next = [id, ...readRecentFx().filter((x) => x !== id)].slice(0, 5);
  try {
    globalThis.localStorage?.setItem(RECENT_FX_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
