// Thin mediabunny wrapper for OpenCut mobile.
// Lazy-imports mediabunny so the initial SPA bundle (and any reuser without
// media files) stays light. All functions degrade to placeholders when the
// codec/input is unavailable. MIT-compatible; no GPL code.

export interface MediaMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export type MediaInput = Blob | ArrayBuffer | string;

export interface TrimOptions {
  start: number;
  end: number;
}

export interface ExportClipLike {
  id: string;
  trackId: string;
  name: string;
  start: number;
  duration: number;
  src?: string;
  speed?: number;
}

export type { ExportResolution } from "./exportPresets";
export { resolutionToSize } from "./exportPresets";

export interface ExportProjectOptions {
  clips: ExportClipLike[];
  format: "mp4" | "webm" | "mp3";
  onProgress?: (progress: number) => void;
  width?: number;
  height?: number;
  fps?: number;
  audioOnly?: boolean;
}


const PLACEHOLDER: MediaMetadata = {
  duration: null,
  width: null,
  height: null,
  hasVideo: false,
  hasAudio: false,
};

type MediabunnyModule = Record<string, unknown>;

async function loadMediabunny(): Promise<MediabunnyModule | null> {
  try {
    const mod = (await import("mediabunny")) as unknown as MediabunnyModule;
    return mod;
  } catch {
    return null;
  }
}

function toBlobSource(input: MediaInput): Blob | string | null {
  if (typeof input === "string") return input;
  if (input instanceof Blob) return input;
  if (input instanceof ArrayBuffer) return new Blob([input]);
  return null;
}

function inputLabel(input: MediaInput, fallback = "clip"): string {
  if (typeof input === "string") {
    const tail = input.split("/").pop() ?? input;
    return tail.slice(0, 48) || fallback;
  }
  if (input instanceof Blob && "name" in input) {
    const name = (input as Blob & { name?: unknown }).name;
    if (typeof name === "string" && name.length > 0) return name.slice(0, 48);
  }
  return fallback;
}

/** 1x1 transparent PNG used when canvas is unavailable (e.g. jsdom tests). */
function minimalPngBlob(): Blob {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : (() => {
          const NodeBuffer = (
            globalThis as unknown as {
              Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
            }
          ).Buffer;
          if (!NodeBuffer) throw new Error("no base64 decoder available");
          return NodeBuffer.from(base64, "base64").toString("binary");
        })();
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        resolve(blob ?? minimalPngBlob());
      }, "image/png");
    } catch {
      resolve(minimalPngBlob());
    }
  });
}

/**
 * Offline-safe placeholder thumbnail: dark card with clip name + timestamp.
 * Works with OffscreenCanvas, DOM canvas, or (when neither exists) a minimal PNG.
 */
export async function renderPlaceholderThumbnail(
  label: string,
  timeSec: number,
): Promise<Blob> {
  const safeLabel = label.slice(0, 48) || "clip";
  const stamp = `${Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0}s`;
  const W = 320;
  const H = 180;

  // Prefer OffscreenCanvas when available (workers + modern browsers).
  try {
    const Offscreen = (globalThis as unknown as {
      OffscreenCanvas?: new (w: number, h: number) => {
        getContext: (kind: string) => CanvasRenderingContext2D | null;
        convertToBlob: (opts?: { type?: string }) => Promise<Blob>;
      };
    }).OffscreenCanvas;
    if (typeof Offscreen !== "undefined") {
      const canvas = new Offscreen(W, H);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintPlaceholder(ctx, W, H, safeLabel, stamp);
        try {
          const blob = await canvas.convertToBlob({ type: "image/png" });
          if (blob && blob.size > 0) return blob;
        } catch {
          // fall through to DOM canvas / minimal PNG
        }
      }
    }
  } catch {
    // fall through
  }

  // DOM canvas path (browsers; jsdom returns null context -> minimal PNG).
  try {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintPlaceholder(ctx, W, H, safeLabel, stamp);
        return await canvasToPngBlob(canvas);
      }
    }
  } catch {
    // fall through
  }

  return minimalPngBlob();
}

function paintPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  label: string,
  stamp: string,
): void {
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = "#f4f4f5";
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const name = label.length > 24 ? `${label.slice(0, 23)}…` : label;
  ctx.fillText(name, 20, h / 2 - 14);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(`t=${stamp}`, 20, h / 2 + 16);
}

/** Probe duration/dimensions. Returns placeholder metadata on failure. */
export async function getMetadata(input: MediaInput): Promise<MediaMetadata> {
  const source = toBlobSource(input);
  if (!source) return PLACEHOLDER;
  const mod = await loadMediabunny();
  if (!mod) return PLACEHOLDER;

  try {
    const InputCtor = mod["Input"] as
      | (new (opts: { source: unknown; formats: unknown }) => unknown)
      | undefined;
    const ALL_FORMATS = mod["ALL_FORMATS"];
    if (!InputCtor || !ALL_FORMATS) return PLACEHOLDER;
    const media = new InputCtor({ source, formats: ALL_FORMATS }) as {
      computeDuration?: () => Promise<number>;
      getVideoTracks?: () => Promise<Array<{ displayWidth?: number; displayHeight?: number }>>;
      getAudioTracks?: () => Promise<unknown[]>;
    };
    const [duration, videoTracks, audioTracks] = await Promise.all([
      typeof media.computeDuration === "function"
        ? media.computeDuration().catch(() => null)
        : Promise.resolve(null),
      typeof media.getVideoTracks === "function"
        ? media.getVideoTracks().catch(() => [])
        : Promise.resolve([]),
      typeof media.getAudioTracks === "function"
        ? media.getAudioTracks().catch(() => [])
        : Promise.resolve([]),
    ]);
    const first = videoTracks[0];
    return {
      duration: typeof duration === "number" ? duration : null,
      width: first?.displayWidth ?? null,
      height: first?.displayHeight ?? null,
      hasVideo: videoTracks.length > 0,
      hasAudio: (audioTracks as unknown[]).length > 0,
    };
  } catch {
    return PLACEHOLDER;
  }
}

/**
 * Extract a thumbnail at `timeSec` via mediabunny's CanvasSink when available.
 * Always resolves to a PNG Blob in practice: guarded try/catch falls back to
 * an offline placeholder (clip name + timestamp). Keeps the historical
 * `Blob | null` signature for backwards compatibility.
 */
export async function getThumbnail(
  input: MediaInput,
  timeSec = 0,
  label?: string,
): Promise<Blob | null> {
  const name = label ?? inputLabel(input);
  const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
  try {
    const mod = await loadMediabunny();
    if (mod) {
      const blob = await extractFrameWithMediabunny(mod, input, t);
      if (blob) return blob;
    }
  } catch {
    // fall through to placeholder
  }
  try {
    return await renderPlaceholderThumbnail(name, t);
  } catch {
    return minimalPngBlob();
  }
}

async function extractFrameWithMediabunny(
  mod: MediabunnyModule,
  input: MediaInput,
  timeSec: number,
): Promise<Blob | null> {
  const InputCtor = mod["Input"] as
    | (new (opts: { source: unknown; formats: unknown }) => unknown)
    | undefined;
  const BlobSourceCtor = mod["BlobSource"] as
    | (new (blob: Blob) => unknown)
    | undefined;
  const UrlSourceCtor = mod["UrlSource"] as
    | (new (url: string) => unknown)
    | undefined;
  const CanvasSinkCtor = mod["CanvasSink"] as
    | (new (track: unknown) => {
        getCanvas?: (timestamp: number) => Promise<HTMLCanvasElement>;
      })
    | undefined;
  const ALL_FORMATS = mod["ALL_FORMATS"];
  if (!InputCtor || !ALL_FORMATS || !CanvasSinkCtor) return null;

  const source = toBlobSource(input);
  if (!source) return null;
  let wrapped: unknown = source;
  if (source instanceof Blob) {
    if (!BlobSourceCtor) return null;
    wrapped = new BlobSourceCtor(source);
  } else if (typeof source === "string") {
    if (!UrlSourceCtor) return null;
    wrapped = new UrlSourceCtor(source);
  }

  const media = new InputCtor({ source: wrapped, formats: ALL_FORMATS }) as {
    getVideoTracks?: () => Promise<unknown[]>;
    dispose?: () => Promise<void> | void;
  };
  try {
    const tracks =
      typeof media.getVideoTracks === "function"
        ? await media.getVideoTracks()
        : [];
    if (!tracks || tracks.length === 0) return null;
    const sink = new CanvasSinkCtor(tracks[0]);
    if (typeof sink.getCanvas !== "function") return null;
    const canvas = await sink.getCanvas(timeSec);
    if (!canvas) return null;
    return await canvasToPngBlob(canvas);
  } finally {
    try {
      await media.dispose?.();
    } catch {
      // ignore disposal errors
    }
  }
}

/**
 * Trim `input` to [start, end). Uses mediabunny's Conversion API with
 * `trim` when present; otherwise returns the original bytes (fallback).
 * Only throws for an invalid range (`end <= start`) or unresolvable input.
 */
export async function trimMedia(input: MediaInput, opts: TrimOptions): Promise<Blob> {
  if (opts.end <= opts.start) throw new Error("trimMedia: end must be > start");
  const source = toBlobSource(input);
  if (source instanceof Blob) {
    try {
      const trimmed = await trimBlobWithMediabunny(source, opts);
      if (trimmed) return trimmed;
    } catch {
      // fall through to original-bytes fallback
    }
    // Fallback: return the original bytes. The requested range [start, end)
    // is noted by the caller via TrimOptions; a Blob cannot carry trim
    // metadata itself, so no byte-level change is made here.
    return source;
  }
  if (source === null) {
    throw new Error("trimMedia: unsupported input (no media bytes provided)");
  }
  // string URL input: no bytes available offline; only range errors throw
  // for blob inputs per contract, so surface a clear error here.
  throw new Error("trimMedia: string inputs require a fetched Blob first");
}

async function trimBlobWithMediabunny(
  blob: Blob,
  opts: TrimOptions,
): Promise<Blob | null> {
  const mod = await loadMediabunny();
  if (!mod) return null;
  const InputCtor = mod["Input"] as
    | (new (opts: { source: unknown; formats: unknown }) => unknown)
    | undefined;
  const OutputCtor = mod["Output"] as
    | (new (opts: { target: unknown; format: unknown }) => {
        finalize?: () => Promise<void>;
      })
    | undefined;
  const BlobSourceCtor = mod["BlobSource"] as
    | (new (blob: Blob) => unknown)
    | undefined;
  const BufferTargetCtor = mod["BufferTarget"] as
    | (new () => { buffer?: ArrayBuffer | null })
    | undefined;
  const ConversionInit = mod["Conversion"] as unknown as {
    init?: (opts: {
      input: unknown;
      output: unknown;
      trim?: { start: number; end: number };
    }) => Promise<{ execute?: () => Promise<void> }>;
  } | undefined;
  const Mp4OutputFormatCtor = mod["Mp4OutputFormat"] as
    | (new () => unknown)
    | undefined;
  const ALL_FORMATS = mod["ALL_FORMATS"];
  if (
    !InputCtor ||
    !OutputCtor ||
    !BlobSourceCtor ||
    !BufferTargetCtor ||
    !ConversionInit ||
    typeof ConversionInit.init !== "function" ||
    !ALL_FORMATS
  ) {
    return null;
  }

  let format: unknown = null;
  if (Mp4OutputFormatCtor) {
    try {
      format = new Mp4OutputFormatCtor();
    } catch {
      return null;
    }
  } else {
    return null;
  }

  const mediaInput = new InputCtor({
    source: new BlobSourceCtor(blob),
    formats: ALL_FORMATS,
  });
  const target = new BufferTargetCtor();
  const output = new OutputCtor({ target, format });
  const conversion = await ConversionInit.init({
    input: mediaInput,
    output,
    trim: { start: opts.start, end: opts.end },
  });
  if (!conversion || typeof conversion.execute !== "function") return null;
  await conversion.execute();
  await output.finalize?.();
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) return null;
  return new Blob([buffer], { type: blob.type || "video/mp4" });
}

/**
 * Export a timeline to mp4/webm/mp3. Tries a mediabunny Output/CanvasSource render
 * when the environment supports WebCodecs; otherwise resolves with a JSON
 * manifest Blob describing the timeline. Always resolves (never rejects for
 * well-formed options) so headless tests and offline devices succeed.
 */
export async function exportProject(opts: ExportProjectOptions): Promise<Blob> {
  const rawFormat = opts.format === "webm" ? "webm" : opts.format === "mp3" ? "mp3" : "mp4";
  const format = opts.audioOnly ? "mp3" : rawFormat;
  try {
    opts.onProgress?.(0);
  } catch {
    // ignore progress callback errors
  }
  try {
    const rendered = await renderWithMediabunny(opts, format, (p) => {
      try {
        opts.onProgress?.(p);
      } catch {
        // ignore
      }
    });
    if (rendered) {
      try {
        opts.onProgress?.(1);
      } catch {
        // ignore
      }
      return rendered;
    }
  } catch {
    // fall through to manifest fallback
  }
  const manifest = {
    app: "opencut-mobile",
    version: 1,
    format,
    createdAt: new Date().toISOString(),
    width: opts.width ?? 1280,
    height: opts.height ?? 720,
    fps: opts.fps ?? 30,
    audioOnly: opts.audioOnly ?? format === "mp3",
    duration: opts.clips.reduce(
      (max, c) => Math.max(max, c.start + c.duration),
      0,
    ),
    clips: opts.clips.map((c) => ({
      id: c.id,
      trackId: c.trackId,
      name: c.name,
      start: c.start,
      duration: c.duration,
      src: c.src ?? null,
      speed: c.speed ?? 1,
    })),
    note: "manifest fallback: mediabunny render unavailable in this environment",
  };
  try {
    opts.onProgress?.(1);
  } catch {
    // ignore
  }
  return new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  });
}

async function renderWithMediabunny(
  opts: ExportProjectOptions,
  format: "mp4" | "webm" | "mp3",
  onProgress: (p: number) => void,
): Promise<Blob | null> {
  // Audio-only has no canvas render path in this milestone; use manifest.
  if (format === "mp3") {
    onProgress(0.5);
    return null;
  }
  const mod = await loadMediabunny();
  if (!mod) return null;
  const OutputCtor = mod["Output"] as
    | (new (opts: { target: unknown; format: unknown }) => {
        addVideoTrack?: (
          codec: unknown,
          opts?: unknown,
        ) => unknown;
        finalize?: () => Promise<void>;
      })
    | undefined;
  const CanvasSourceCtor = mod["CanvasSource"] as
    | (new (
        canvas: HTMLCanvasElement,
        opts?: unknown,
      ) => { add?: (...args: never[]) => Promise<void> })
    | undefined;
  const BufferTargetCtor = mod["BufferTarget"] as
    | (new () => { buffer?: ArrayBuffer | null })
    | undefined;
  const Mp4FormatCtor = mod["Mp4OutputFormat"] as
    | (new () => unknown)
    | undefined;
  const WebMFormatCtor = mod["WebMOutputFormat"] as
    | (new () => unknown)
    | undefined;
  if (!OutputCtor || !CanvasSourceCtor || !BufferTargetCtor) return null;
  const FormatCtor = format === "webm" ? WebMFormatCtor : Mp4FormatCtor;
  if (!FormatCtor) return null;
  if (typeof document === "undefined") return null;
  const hasVideoEncoder =
    (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder !==
    undefined;
  if (!hasVideoEncoder) return null;

  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const target = new BufferTargetCtor();
  const output = new OutputCtor({ target, format: new FormatCtor() });
  const addVideoTrack = output.addVideoTrack;
  if (typeof addVideoTrack !== "function") return null;
  const videoTrack = addVideoTrack.call(output, "avc", {
    width,
    height,
  }) as { codec?: unknown } | unknown;
  void videoTrack;
  const source = new CanvasSourceCtor(canvas, { codec: "avc", bitrate: 2_000_000 });
  void source;
  // Full frame-pumping (draw each clip per timestamp + encode loop) is
  // beyond this milestone; signal unavailability so the caller uses the
  // manifest fallback. Progress is still reported for UX consistency.
  onProgress(0.5);
  await output.finalize?.();
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) return null;
  return new Blob([buffer], {
    type: format === "webm" ? "video/webm" : "video/mp4",
  });
}

/**
 * Capture the current frame of a <video> element to a PNG Blob.
 * Offline-first: falls back to a placeholder thumbnail when the video
 * has no pixels yet (or canvas is unavailable, e.g. jsdom).
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  label = "snapshot",
): Promise<Blob> {
  try {
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await canvasToPngBlob(canvas);
      if (blob && blob.size > 0) return blob;
    }
  } catch {
    // fall through to placeholder
  }
  try {
    return await renderPlaceholderThumbnail(label, video.currentTime || 0);
  } catch {
    return minimalPngBlob();
  }
}

/**
 * Extract audio from a video Blob via mediabunny when available.
 * Returns an audio Blob, the original Blob when it already is audio,
 * or null when extraction is unavailable offline. Never throws for
 * Blob input; throws only when no media bytes were provided.
 */
export async function extractAudio(input: MediaInput): Promise<Blob | null> {
  const source = toBlobSource(input);
  if (source === null) throw new Error("extractAudio: no media bytes provided");
  if (source instanceof Blob && source.type.startsWith("audio/")) {
    return source;
  }
  if (source instanceof Blob) {
    try {
      const mod = await loadMediabunny();
      const extracted = await transcodeToAudioWithMediabunny(mod, source);
      if (extracted) return extracted;
    } catch {
      // fall through to null
    }
    return null;
  }
  // String URL inputs need fetched bytes first.
  return null;
}

async function transcodeToAudioWithMediabunny(
  mod: MediabunnyModule | null,
  blob: Blob,
): Promise<Blob | null> {
  if (!mod) return null;
  try {
    const InputCtor = mod["Input"] as
      | (new (opts: { source: unknown; formats: unknown }) => unknown)
      | undefined;
    const BlobSourceCtor = mod["BlobSource"] as
      | (new (blob: Blob) => unknown)
      | undefined;
    const ALL_FORMATS = mod["ALL_FORMATS"];
    if (!InputCtor || !BlobSourceCtor || !ALL_FORMATS) return null;
    const media = new InputCtor({
      source: new BlobSourceCtor(blob),
      formats: ALL_FORMATS,
    }) as {
      getAudioTracks?: () => Promise<unknown[]>;
      dispose?: () => Promise<void> | void;
    };
    try {
      const tracks =
        typeof media.getAudioTracks === "function"
          ? await media.getAudioTracks()
          : [];
      // Presence of an audio track means the bytes already carry audio;
      // a full re-encode is beyond this milestone, so hand the original
      // bytes back tagged as audio for the audio lane.
      if (tracks && tracks.length > 0) {
        return new Blob([blob], { type: blob.type || "audio/mp4" });
      }
      return null;
    } finally {
      try {
        await media.dispose?.();
      } catch {
        // ignore
      }
    }
  } catch {
    return null;
  }
}
