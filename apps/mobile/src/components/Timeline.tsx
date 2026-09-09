import type { CSSProperties } from "react";
import { clipsForTrack, timelineDuration, useTimelineStore } from "../stores/timeline";

const nudgeBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#f4f4f5",
  fontSize: 14,
  fontWeight: 600,
  flex: 1,
};

export default function Timeline() {
  const tracks = useTimelineStore((s) => s.tracks);
  const clips = useTimelineStore((s) => s.clips);
  const playhead = useTimelineStore((s) => s.playhead);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const selectClip = useTimelineStore((s) => s.selectClip);
  const moveClip = useTimelineStore((s) => s.moveClip);

  const duration = timelineDuration(clips);
  const max = Math.max(duration, 0.1);
  const selected = clips.find((c) => c.id === selectedClipId) ?? null;

  function nudgeClip(delta: number) {
    if (!selected) return;
    moveClip(selected.id, { start: Math.max(0, selected.start + delta) });
  }

  return (
    <section
      aria-label="Timeline"
      style={{
        borderTop: "1px solid #27272a",
        padding: "8px 12px calc(env(safe-area-inset-bottom, 0px) + 8px)",
        background: "#111113",
        maxHeight: "38dvh",
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 6 }}>TIMELINE</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          aria-label="Nudge playhead back 1 second"
          onClick={() => setPlayhead(Math.max(0, playhead - 1))}
          style={{ ...nudgeBtn, flex: "0 0 auto" }}
        >
          −1s
        </button>
        <input
          type="range"
          aria-label="Scrub playhead"
          min={0}
          max={max}
          step={0.1}
          value={Math.min(playhead, max)}
          onChange={(e) => setPlayhead(Number(e.target.value))}
          style={{ flex: 1, minHeight: 44, minWidth: 44, accentColor: "#e4e4e7" }}
        />
        <button
          type="button"
          aria-label="Nudge playhead forward 1 second"
          onClick={() => setPlayhead(playhead + 1)}
          style={{ ...nudgeBtn, flex: "0 0 auto" }}
        >
          +1s
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#71717a", marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
        {playhead.toFixed(1)}s / {duration.toFixed(1)}s
        {selected ? ` · selected: ${selected.name}` : ""}
      </div>
      {selected ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            aria-label="Nudge selected clip back 1 second"
            onClick={() => nudgeClip(-1)}
            style={nudgeBtn}
          >
            ◀ Clip −1s
          </button>
          <button
            type="button"
            aria-label="Nudge selected clip forward 1 second"
            onClick={() => nudgeClip(1)}
            style={nudgeBtn}
          >
            Clip +1s ▶
          </button>
        </div>
      ) : null}
      {tracks.map((t) => {
        const trackClips = clipsForTrack(clips, t.id);
        return (
          <div key={t.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#d4d4d8", marginBottom: 4 }}>{t.name}</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {trackClips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectClip(c.id)}
                  title="Tap to select"
                  aria-pressed={selectedClipId === c.id}
                  style={{
                    minHeight: 48,
                    minWidth: 120,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: selectedClipId === c.id ? "2px solid #e4e4e7" : "1px solid #52525b",
                    background: t.kind === "video" ? "#27272a" : "#1c1917",
                    color: "#f4f4f5",
                    fontSize: 13,
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#a1a1aa" }}>
                    {c.start.toFixed(1)}s · {c.duration.toFixed(1)}s
                  </div>
                </button>
              ))}
              {trackClips.length === 0 && <span style={{ fontSize: 12, color: "#52525b" }}>Empty</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
