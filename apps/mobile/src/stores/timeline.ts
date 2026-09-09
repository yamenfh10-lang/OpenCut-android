import { create } from "zustand";

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
}

export interface TimelineTrack {
  id: string;
  name: string;
  kind: "video" | "audio";
}

interface TimelineState {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  playhead: number;
  selectedClipId: string | null;
  setPlayhead: (time: number) => void;
  selectClip: (id: string | null) => void;
  addClip: (input: Omit<TimelineClip, "id"> & { id?: string }) => TimelineClip;
  splitClip: (clipId: string, at: number) => TimelineClip | null;
  moveClip: (clipId: string, next: { trackId?: string; start?: number }) => void;
  removeClip: (clipId: string) => void;
  renameClip: (clipId: string, name: string) => void;
  duplicateClip: (clipId: string) => TimelineClip | null;
  setClipDuration: (clipId: string, duration: number) => void;
  clearTimeline: () => void;
  loadTimeline: (
    tracks: TimelineTrack[],
    clips: TimelineClip[],
    playhead?: number,
  ) => void;
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

export const useTimelineStore = create<TimelineState>()((set) => ({
  tracks: initialTracks,
  clips: [],
  playhead: 0,
  selectedClipId: null,

  setPlayhead: (time) =>
    set({ playhead: Math.max(0, time) }),

  selectClip: (id) => set({ selectedClipId: id }),

  addClip: (input) => {
    const clip: TimelineClip = {
      id: input.id ?? uid("clip"),
      trackId: input.trackId,
      name: input.name,
      start: Math.max(0, input.start),
      duration: Math.max(0.1, input.duration),
      ...(input.src !== undefined ? { src: input.src } : {}),
    };
    set((s) => ({ clips: [...s.clips, clip] }));
    return clip;
  },

  splitClip: (clipId, at) => {
    let created: TimelineClip | null = null;
    set((s) => {
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
      };
      created = right;
      return {
        clips: s.clips.flatMap((c) =>
          c.id === clipId
            ? [{ ...c, duration: offset }, right]
            : [c],
        ),
      };
    });
    return created;
  },

  moveClip: (clipId, next) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              trackId: next.trackId ?? c.trackId,
              start: next.start !== undefined ? Math.max(0, next.start) : c.start,
            }
          : c,
      ),
    })),

  removeClip: (clipId) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== clipId),
      selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
    })),

  renameClip: (clipId, name) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === clipId ? { ...c, name } : c)),
    })),

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
      return { clips: [...s.clips, copy] };
    });
    return created;
  },

  setClipDuration: (clipId, duration) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, duration: Math.max(0.1, duration) } : c,
      ),
    })),

  clearTimeline: () => set({ clips: [], playhead: 0, selectedClipId: null }),

  loadTimeline: (tracks, clips, playhead = 0) =>
    set({
      tracks: tracks.map((t) => ({ ...t })),
      clips: clips.map((c) => ({ ...c })),
      playhead: Math.max(0, playhead),
      selectedClipId: null,
    }),
}));

export function clipsForTrack(clips: TimelineClip[], trackId: string): TimelineClip[] {
  return clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);
}

export function timelineDuration(clips: TimelineClip[]): number {
  return clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

export { clamp };
