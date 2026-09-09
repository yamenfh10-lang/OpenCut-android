import { create } from "zustand";
import type { ClipFilter, ClipTransform, ClipTransition, CropPresetId, LayoutId, ShapeId } from "../lib/presets";
import { normalizeCrop, normalizeFade, normalizeFilter, normalizeLayout, normalizeShape, normalizeShapeColor, normalizeTransform, normalizeTransition, normalizeVolume } from "../lib/presets";

// Written from scratch for OpenCut mobile. Inspired by the Clypra-style
// normalized timeline (tracks reference clips by id), no GPL code copied.

export interface TimelineClip {
  id: string;
  trackId: string;
  name: string;
  /** Start time on the track, in seconds. */
  start: number;
  /** Duration in seconds. */
  duration: number;
  src?: string;
  /** Playback rate. Optional for backwards compat; treat undefined as 1. */
  speed?: number;
  /**
   * Clip media kind. Optional for backwards compat; treat undefined as
   * "video" (old projects only had video/audio tracks and no text cards).
   */
  kind?: "video" | "audio" | "text" | "image" | "shape";
  /** Overlay text for `kind === "text"` title cards. Optional, backwards compatible. */
  text?: string;
  /** Color grade (LumoCut-style per-clip filter). Optional, defaults to neutral. */
  filter?: ClipFilter;
  /** Rotate / flip / scale (devhyper-style transform). Optional, defaults to identity. */
  transform?: ClipTransform;
  /** Color label id from COLOR_LABELS. Optional, "none" by default. */
  colorLabel?: string;
  /** Crop preset id from CROP_PRESETS (devhyper-style crop). Optional, "none". */
  crop?: CropPresetId;
  /** Volume gain 0..2 (devhyper-style audio level). Optional, default 1. */
  volume?: number;
  /** Fade in/out in seconds. Optional, default 0. */
  fadeIn?: number;
  fadeOut?: number;
  /** Incoming transition (CapCut-style). Optional. */
  transition?: ClipTransition;
  /** PIP / split-screen layout. Optional, default "full". */
  layout?: LayoutId;
  /** Sticker shape for `kind === "shape"`. Optional. */
  shape?: ShapeId;
  shapeColor?: string;
  /** Ken Burns slow-zoom for photo clips. Optional, default off. */
  kenburns?: boolean;
}

export interface TimelineMarker {
  id: string;
  /** Time on the timeline, in seconds. */
  time: number;
  label: string;
  /** MarkerColorId from MARKER_COLORS. */
  color: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  kind: "video" | "audio";
  /** Muted tracks play silent (preview) and flag the manifest. */
  muted?: boolean;
  /** Locked tracks reject structural edits (move/split/remove). */
  locked?: boolean;
}

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

export function normalizeSpeed(speed: unknown): number {
  const n = typeof speed === "number" && Number.isFinite(speed) ? speed : 1;
  return clamp(n, SPEED_MIN, SPEED_MAX);
}

export interface HistorySnapshot {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers: TimelineMarker[];
  playhead: number;
  selectedClipId: string | null;
}

interface TimelineState {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers: TimelineMarker[];
  playhead: number;
  selectedClipId: string | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  setPlayhead: (time: number) => void;
  selectClip: (id: string | null) => void;
  addClip: (input: Omit<TimelineClip, "id"> & { id?: string }) => TimelineClip;
  splitClip: (clipId: string, at: number) => TimelineClip | null;
  moveClip: (clipId: string, next: { trackId?: string; start?: number }) => void;
  removeClip: (clipId: string) => void;
  renameClip: (clipId: string, name: string) => void;
  duplicateClip: (clipId: string) => TimelineClip | null;
  setClipDuration: (clipId: string, duration: number) => void;
  setClipSpeed: (clipId: string, speed: number) => void;
  setClipFilter: (clipId: string, filter: Partial<ClipFilter>) => void;
  setClipTransform: (clipId: string, transform: Partial<ClipTransform>) => void;
  setClipColorLabel: (clipId: string, colorLabel: string) => void;
  setClipCrop: (clipId: string, crop: string) => void;
  setClipVolume: (clipId: string, volume: number) => void;
  setClipFade: (clipId: string, fade: { fadeIn?: number; fadeOut?: number }) => void;
  setClipTransition: (clipId: string, transition: Partial<ClipTransition>) => void;
  setClipLayout: (clipId: string, layout: string) => void;
  setClipShape: (clipId: string, shape: { shape?: string; shapeColor?: string }) => void;
  setClipKenBurns: (clipId: string, on: boolean) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  rippleDeleteClip: (clipId: string) => void;
  addMarker: (input: { time: number; label?: string; color?: string }) => TimelineMarker;
  removeMarker: (markerId: string) => void;
  renameMarker: (markerId: string, label: string) => void;
  clearTimeline: () => void;
  loadTimeline: (
    tracks: TimelineTrack[],
    clips: TimelineClip[],
    playhead?: number,
    markers?: TimelineMarker[],
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const initialTracks: TimelineTrack[] = [
  { id: "v1", name: "Video 1", kind: "video" },
  { id: "a1", name: "Audio 1", kind: "audio" },
];

const HISTORY_CAP = 50;

function trackOf(s: TimelineState, clipId: string): TimelineTrack | undefined {
  const clip = s.clips.find((c) => c.id === clipId);
  if (!clip) return undefined;
  return s.tracks.find((t) => t.id === clip.trackId);
}

function isLocked(s: TimelineState, clipId: string): boolean {
  return trackOf(s, clipId)?.locked === true;
}

function takeSnapshot(s: TimelineState): HistorySnapshot {
  return {
    tracks: s.tracks.map((t) => ({ ...t })),
    clips: s.clips.map((c) => ({ ...c, filter: c.filter ? { ...c.filter } : undefined, transform: c.transform ? { ...c.transform } : undefined })),
    markers: s.markers.map((m) => ({ ...m })),
    playhead: s.playhead,
    selectedClipId: s.selectedClipId,
  };
}

function pushHistory(
  s: TimelineState,
  next: Partial<Pick<TimelineState, "tracks" | "clips" | "markers" | "playhead" | "selectedClipId">>,
): Partial<TimelineState> {
  const snap = takeSnapshot(s);
  const past = [...s.past, snap].slice(-HISTORY_CAP);
  return { ...next, past, future: [] };
}

export const useTimelineStore = create<TimelineState>()((set, get) => ({
  tracks: initialTracks,
  clips: [],
  markers: [],
  playhead: 0,
  selectedClipId: null,
  past: [],
  future: [],

  setPlayhead: (time) => set({ playhead: Math.max(0, time) }),

  selectClip: (id) => set({ selectedClipId: id }),

  addClip: (input) => {
    const clip: TimelineClip = {
      id: input.id ?? uid("clip"),
      trackId: input.trackId,
      name: input.name,
      start: Math.max(0, input.start),
      duration: Math.max(0.1, input.duration),
      ...(input.src !== undefined ? { src: input.src } : {}),
      speed: normalizeSpeed(input.speed),
    };
    set((s) => pushHistory(s, { clips: [...s.clips, clip] }));
    return clip;
  },

  splitClip: (clipId, at) => {
    let created: TimelineClip | null = null;
    set((s) => {
      if (isLocked(s, clipId)) return s;
      const target = s.clips.find((c) => c.id === clipId);
      if (!target) return s;
      const offset = at - target.start;
      if (offset <= 0 || offset >= target.duration) return s;
      const right: TimelineClip = {
        ...target,
        id: uid("clip"),
        name: `${target.name} (2)`,
        start: at,
        duration: target.duration - offset,
        speed: normalizeSpeed(target.speed),
      };
      created = right;
      return pushHistory(s, {
        clips: s.clips.flatMap((c) =>
          c.id === clipId
            ? [{ ...c, duration: offset }, right]
            : [c],
        ),
      });
    });
    return created;
  },

  moveClip: (clipId, next) =>
    set((s) => {
      if (isLocked(s, clipId)) return s;
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                trackId: next.trackId ?? c.trackId,
                start: next.start !== undefined ? Math.max(0, next.start) : c.start,
              }
            : c,
        ),
      });
    }),

  removeClip: (clipId) =>
    set((s) => {
      if (isLocked(s, clipId)) return s;
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.filter((c) => c.id !== clipId),
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
      });
    }),

  renameClip: (clipId, name) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, name } : c)),
      });
    }),

  duplicateClip: (clipId) => {
    let created: TimelineClip | null = null;
    set((s) => {
      const target = s.clips.find((c) => c.id === clipId);
      if (!target) return s;
      const copy: TimelineClip = {
        ...target,
        id: uid("clip"),
        name: `${target.name} copy`,
        start: target.start + target.duration,
      };
      created = copy;
      return pushHistory(s, { clips: [...s.clips, copy] });
    });
    return created;
  },

  setClipDuration: (clipId, duration) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, duration: Math.max(0.1, duration) } : c,
        ),
      });
    }),

  setClipSpeed: (clipId, speed) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, speed: normalizeSpeed(speed) } : c,
        ),
      });
    }),

  setClipFilter: (clipId, filter) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, filter: normalizeFilter(filter) } : c,
        ),
      });
    }),

  setClipTransform: (clipId, transform) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, transform: normalizeTransform(transform) } : c,
        ),
      });
    }),

  setClipColorLabel: (clipId, colorLabel) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, colorLabel } : c)),
      });
    }),

  setClipCrop: (clipId, crop) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, crop: normalizeCrop(crop) } : c,
        ),
      });
    }),

  setClipVolume: (clipId, volume) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, volume: normalizeVolume(volume) } : c,
        ),
      });
    }),

  setClipFade: (clipId, fade) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                fadeIn: fade.fadeIn !== undefined ? normalizeFade(fade.fadeIn) : c.fadeIn,
                fadeOut: fade.fadeOut !== undefined ? normalizeFade(fade.fadeOut) : c.fadeOut,
              }
            : c,
        ),
      });
    }),

  setClipTransition: (clipId, transition) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, transition: normalizeTransition(transition) } : c,
        ),
      });
    }),

  setClipLayout: (clipId, layout) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, layout: normalizeLayout(layout) } : c,
        ),
      });
    }),

  setClipShape: (clipId, shape) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) =>
          c.id === clipId
            ? {
                ...c,
                ...(shape.shape !== undefined ? { shape: normalizeShape(shape.shape) } : {}),
                ...(shape.shapeColor !== undefined
                  ? { shapeColor: normalizeShapeColor(shape.shapeColor) }
                  : {}),
              }
            : c,
        ),
      });
    }),

  setClipKenBurns: (clipId, on) =>
    set((s) => {
      if (!s.clips.some((c) => c.id === clipId)) return s;
      return pushHistory(s, {
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, kenburns: on === true } : c)),
      });
    }),

  toggleTrackMute: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, muted: !(t.muted === true) } : t)),
    })),

  toggleTrackLock: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, locked: !(t.locked === true) } : t)),
    })),

  rippleDeleteClip: (clipId) =>
    set((s) => {
      // Remove the clip and close the gap: later clips on the same track
      // shift left by the removed duration.
      if (isLocked(s, clipId)) return s;
      const target = s.clips.find((c) => c.id === clipId);
      if (!target) return s;
      const end = target.start + target.duration;
      return pushHistory(s, {
        clips: s.clips
          .filter((c) => c.id !== clipId)
          .map((c) =>
            c.trackId === target.trackId && c.start >= end
              ? { ...c, start: Math.max(target.start, c.start - target.duration) }
              : c,
          ),
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
      });
    }),

  addMarker: (input) => {
    const marker: TimelineMarker = {
      id: uid("marker"),
      time: Math.max(0, input.time),
      label: (input.label ?? "").slice(0, 60) || `Marker ${input.time.toFixed(1)}s`,
      color: input.color ?? "red",
    };
    set((s) => pushHistory(s, { markers: [...s.markers, marker] }));
    return marker;
  },

  removeMarker: (markerId) =>
    set((s) => {
      if (!s.markers.some((m) => m.id === markerId)) return s;
      return pushHistory(s, { markers: s.markers.filter((m) => m.id !== markerId) });
    }),

  renameMarker: (markerId, label) =>
    set((s) => {
      if (!s.markers.some((m) => m.id === markerId)) return s;
      const name = label.slice(0, 60) || "Marker";
      return pushHistory(s, {
        markers: s.markers.map((m) => (m.id === markerId ? { ...m, label: name } : m)),
      });
    }),

  clearTimeline: () =>
    set((s) => pushHistory(s, { clips: [], playhead: 0, selectedClipId: null })),

  loadTimeline: (tracks, clips, playhead = 0, markers = []) =>
    set({
      tracks: tracks.map((t) => ({ ...t })),
      clips: clips.map((c) => ({ ...c })),
      markers: markers.map((m) => ({ ...m })),
      playhead: Math.max(0, playhead),
      selectedClipId: null,
      past: [],
      future: [],
    }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      const current = takeSnapshot(s);
      return {
        tracks: prev.tracks.map((t) => ({ ...t })),
        clips: prev.clips.map((c) => ({ ...c })),
        markers: prev.markers.map((m) => ({ ...m })),
        playhead: prev.playhead,
        selectedClipId: prev.selectedClipId,
        past: s.past.slice(0, -1),
        future: [...s.future, current].slice(-HISTORY_CAP),
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[s.future.length - 1];
      if (!next) return s;
      const current = takeSnapshot(s);
      return {
        tracks: next.tracks.map((t) => ({ ...t })),
        clips: next.clips.map((c) => ({ ...c })),
        markers: next.markers.map((m) => ({ ...m })),
        playhead: next.playhead,
        selectedClipId: next.selectedClipId,
        past: [...s.past, current].slice(-HISTORY_CAP),
        future: s.future.slice(0, -1),
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

export function clipsForTrack(clips: TimelineClip[], trackId: string): TimelineClip[] {
  return clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);
}

export function timelineDuration(clips: TimelineClip[]): number {
  return clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

/** Effective playback rate for a clip (undefined => 1 for old projects). */
export function clipSpeed(clip: Pick<TimelineClip, "speed">): number {
  return normalizeSpeed(clip.speed);
}

export { clamp };
