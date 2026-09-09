// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  SPEED_MAX,
  SPEED_MIN,
  clipSpeed,
  clipsForTrack,
  normalizeSpeed,
  timelineDuration,
  useTimelineStore,
} from "./timeline";
import type { TimelineClip, TimelineTrack } from "./timeline";

const videoTrack: TimelineTrack = { id: "v1", name: "Video 1", kind: "video" };
const audioTrack: TimelineTrack = { id: "a1", name: "Audio 1", kind: "audio" };

function reset(): void {
  useTimelineStore.getState().loadTimeline([videoTrack, audioTrack], [], 0);
}

beforeEach(() => {
  reset();
});

describe("timeline store", () => {
  it("addClip appends and clamps start/duration", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: -2, duration: 0 });
    expect(clip.start).toBe(0);
    expect(clip.duration).toBeCloseTo(0.1);
    expect(useTimelineStore.getState().clips).toHaveLength(1);
  });

  it("splitClip divides a clip at an offset", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 10 });
    const right = useTimelineStore.getState().splitClip(clip.id, 4);
    expect(right).not.toBeNull();
    expect(right?.start).toBe(4);
    expect(right?.duration).toBeCloseTo(6);
    const left = useTimelineStore
      .getState()
      .clips.find((c) => c.id === clip.id);
    expect(left?.duration).toBeCloseTo(4);
  });

  it("splitClip rejects out-of-range splits", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 4 });
    expect(useTimelineStore.getState().splitClip(clip.id, 0)).toBeNull();
    expect(useTimelineStore.getState().splitClip(clip.id, 4)).toBeNull();
    expect(useTimelineStore.getState().splitClip("missing", 1)).toBeNull();
  });

  it("moveClip and removeClip update state", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    useTimelineStore.getState().moveClip(clip.id, { start: 5 });
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.start,
    ).toBe(5);
    useTimelineStore.getState().moveClip(clip.id, { trackId: "a1" });
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.trackId,
    ).toBe("a1");
    useTimelineStore.getState().removeClip(clip.id);
    expect(useTimelineStore.getState().clips).toHaveLength(0);
  });

  it("renameClip changes the clip name", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    useTimelineStore.getState().renameClip(clip.id, "B");
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.name,
    ).toBe("B");
  });

  it("duplicateClip clones after the original", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 1, duration: 3 });
    const copy = useTimelineStore.getState().duplicateClip(clip.id);
    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(clip.id);
    expect(copy?.name).toBe("A copy");
    expect(copy?.start).toBeCloseTo(4);
    expect(copy?.duration).toBeCloseTo(3);
    expect(useTimelineStore.getState().clips).toHaveLength(2);
    expect(useTimelineStore.getState().duplicateClip("missing")).toBeNull();
  });

  it("setClipDuration clamps to a positive minimum", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    useTimelineStore.getState().setClipDuration(clip.id, 5);
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.duration,
    ).toBe(5);
    useTimelineStore.getState().setClipDuration(clip.id, -1);
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.duration,
    ).toBeCloseTo(0.1);
  });

  it("clearTimeline empties clips and resets playhead", () => {
    useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    useTimelineStore.getState().setPlayhead(7);
    useTimelineStore.getState().clearTimeline();
    const state = useTimelineStore.getState();
    expect(state.clips).toHaveLength(0);
    expect(state.playhead).toBe(0);
    expect(state.selectedClipId).toBeNull();
    // tracks are preserved
    expect(state.tracks).toHaveLength(2);
  });

  it("loadTimeline hydrates tracks/clips/playhead", () => {
    const clips: TimelineClip[] = [
      { id: "c1", trackId: "v1", name: "A", start: 0, duration: 2 },
      { id: "c2", trackId: "v1", name: "B", start: 5, duration: 1 },
    ];
    useTimelineStore.getState().loadTimeline([videoTrack], clips, 3);
    const state = useTimelineStore.getState();
    expect(state.tracks).toHaveLength(1);
    expect(state.clips).toHaveLength(2);
    expect(state.playhead).toBe(3);
  });

  it("clipsForTrack sorts and timelineDuration measures", () => {
    useTimelineStore.getState().addClip({
      trackId: "v1",
      name: "B",
      start: 5,
      duration: 2,
    });
    useTimelineStore.getState().addClip({
      trackId: "v1",
      name: "A",
      start: 0,
      duration: 2,
    });
    const { clips } = useTimelineStore.getState();
    expect(clipsForTrack(clips, "v1").map((c) => c.name)).toEqual(["A", "B"]);
    expect(timelineDuration(clips)).toBeCloseTo(7);
    expect(timelineDuration([])).toBe(0);
  });

  it("addClip defaults speed to 1 and keeps old clips working", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    expect(clip.speed).toBe(1);
    expect(clipSpeed(clip)).toBe(1);
    // Old persisted clips without a speed field still play at 1x.
    expect(clipSpeed({})).toBe(1);
    expect(clipSpeed({ speed: undefined })).toBe(1);
    expect(normalizeSpeed(undefined)).toBe(1);
  });

  it("setClipSpeed clamps to 0.25x–4x", () => {
    const clip = useTimelineStore
      .getState()
      .addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    useTimelineStore.getState().setClipSpeed(clip.id, 2);
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.speed,
    ).toBe(2);
    useTimelineStore.getState().setClipSpeed(clip.id, 99);
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.speed,
    ).toBe(SPEED_MAX);
    useTimelineStore.getState().setClipSpeed(clip.id, 0.01);
    expect(
      useTimelineStore.getState().clips.find((c) => c.id === clip.id)?.speed,
    ).toBe(SPEED_MIN);
  });

  it("split and duplicate preserve speed", () => {
    const clip = useTimelineStore.getState().addClip({
      trackId: "v1",
      name: "A",
      start: 0,
      duration: 8,
      speed: 2,
    });
    const right = useTimelineStore.getState().splitClip(clip.id, 3);
    expect(right?.speed).toBe(2);
    const copy = useTimelineStore.getState().duplicateClip(clip.id);
    expect(copy?.speed).toBe(2);
  });

  it("undo/redo restores mutations with canUndo/canRedo", () => {
    const st = () => useTimelineStore.getState();
    expect(st().canUndo()).toBe(false);
    expect(st().canRedo()).toBe(false);
    const clip = st().addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    expect(st().canUndo()).toBe(true);
    st().renameClip(clip.id, "B");
    expect(st().clips.find((c) => c.id === clip.id)?.name).toBe("B");
    st().undo();
    expect(st().clips.find((c) => c.id === clip.id)?.name).toBe("A");
    expect(st().canRedo()).toBe(true);
    st().redo();
    expect(st().clips.find((c) => c.id === clip.id)?.name).toBe("B");
    st().removeClip(clip.id);
    expect(st().clips).toHaveLength(0);
    st().undo();
    expect(st().clips).toHaveLength(1);
    st().redo();
    expect(st().clips).toHaveLength(0);
  });

  it("setClipFilter/setClipTransform normalize values", () => {
    const st = () => useTimelineStore.getState();
    const clip = st().addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    st().setClipFilter(clip.id, { brightness: 9, grayscale: 1 });
    const f = st().clips.find((c) => c.id === clip.id)?.filter;
    expect(f?.brightness).toBe(2);
    expect(f?.grayscale).toBe(1);
    st().setClipTransform(clip.id, { rotation: 45 as never, scale: 99 });
    const t = st().clips.find((c) => c.id === clip.id)?.transform;
    expect(t?.rotation).toBe(0);
    expect(t?.scale).toBe(3);
    st().setClipTransform(clip.id, { rotation: 90, flipH: true });
    expect(st().clips.find((c) => c.id === clip.id)?.transform).toMatchObject({
      rotation: 90,
      flipH: true,
    });
  });

  it("setClipColorLabel stores the label id", () => {
    const st = () => useTimelineStore.getState();
    const clip = st().addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    st().setClipColorLabel(clip.id, "red");
    expect(st().clips.find((c) => c.id === clip.id)?.colorLabel).toBe("red");
  });

  it("markers add/rename/remove roundtrip with undo", () => {
    const st = () => useTimelineStore.getState();
    const m = st().addMarker({ time: 2.5, label: "Intro", color: "blue" });
    expect(m.time).toBeCloseTo(2.5);
    expect(st().markers).toHaveLength(1);
    st().renameMarker(m.id, "Hook");
    expect(st().markers[0]?.label).toBe("Hook");
    st().undo();
    expect(st().markers[0]?.label).toBe("Intro");
    st().redo();
    expect(st().markers[0]?.label).toBe("Hook");
    st().removeMarker(m.id);
    expect(st().markers).toHaveLength(0);
    st().undo();
    expect(st().markers).toHaveLength(1);
  });

  it("loadTimeline hydrates markers and clears history", () => {
    const st = () => useTimelineStore.getState();
    st().addClip({ trackId: "v1", name: "A", start: 0, duration: 1 });
    st().loadTimeline([videoTrack], [], 0, [{ id: "m1", time: 1, label: "One", color: "red" }]);
    expect(st().markers).toHaveLength(1);
    expect(st().canUndo()).toBe(false);
  });

  it("crop/volume/fade actions clamp and persist with undo", () => {
    const st = () => useTimelineStore.getState();
    const clip = st().addClip({ trackId: "v1", name: "A", start: 0, duration: 2 });
    st().setClipCrop(clip.id, "9:16");
    expect(st().clips.find((c) => c.id === clip.id)?.crop).toBe("9:16");
    st().setClipCrop(clip.id, "bogus");
    expect(st().clips.find((c) => c.id === clip.id)?.crop).toBe("none");
    st().setClipVolume(clip.id, 0);
    expect(st().clips.find((c) => c.id === clip.id)?.volume).toBe(0);
    st().setClipVolume(clip.id, 99);
    expect(st().clips.find((c) => c.id === clip.id)?.volume).toBe(2);
    st().setClipFade(clip.id, { fadeIn: 1.5, fadeOut: -2 });
    expect(st().clips.find((c) => c.id === clip.id)?.fadeIn).toBeCloseTo(1.5);
    expect(st().clips.find((c) => c.id === clip.id)?.fadeOut).toBe(0);
    st().undo();
    expect(st().clips.find((c) => c.id === clip.id)?.fadeIn).toBeUndefined();
  });

  it("new mutations clear the redo stack and history caps at 50", () => {
    const st = () => useTimelineStore.getState();
    st().addClip({ trackId: "v1", name: "A", start: 0, duration: 1 });
    st().undo();
    expect(st().canRedo()).toBe(true);
    st().addClip({ trackId: "v1", name: "B", start: 0, duration: 1 });
    expect(st().canRedo()).toBe(false);
    for (let i = 0; i < 60; i++) {
      st().addClip({ trackId: "v1", name: `C${i}`, start: i, duration: 1 });
    }
    expect(st().past.length).toBeLessThanOrEqual(50);
  });
});
