import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { timelineDuration, useTimelineStore } from "../stores/timeline";

const ctrlBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#f4f4f5",
  fontSize: 14,
  fontWeight: 600,
};

export default function Preview() {
  const clips = useTimelineStore((s) => s.clips);
  const playhead = useTimelineStore((s) => s.playhead);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);

  const duration = timelineDuration(clips);
  const selected = clips.find((c) => c.id === selectedClipId) ?? null;
  const underPlayhead =
    clips.find((c) => playhead >= c.start && playhead < c.start + c.duration) ?? null;
  const active = selected ?? underPlayhead ?? clips[0] ?? null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Keep the video element roughly in sync with the global playhead.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active?.src) return;
    const target = Math.min(
      Math.max(0, playhead - active.start),
      Math.max(0, active.duration - 0.05),
    );
    if (Math.abs(v.currentTime - target) > 0.35) {
      try {
        v.currentTime = target;
      } catch {
        // Ignore seek errors before metadata loads.
      }
    }
  }, [playhead, active]);

  async function toggle() {
    const v = videoRef.current;
    if (!v || !active?.src) return;
    try {
      if (v.paused) {
        await v.play();
      } else {
        v.pause();
      }
    } catch {
      setPlaying(false);
    }
  }

  function seek(delta: number) {
    const next = Math.max(0, playhead + delta);
    setPlayhead(next);
    const v = videoRef.current;
    if (v && active) {
      const target = Math.min(
        Math.max(0, next - active.start),
        Math.max(0, active.duration - 0.05),
      );
      try {
        v.currentTime = target;
      } catch {
        // Ignore until metadata is ready.
      }
    }
  }

  return (
    <section
      aria-label="Preview"
      style={{
        background: "#000",
        borderBottom: "1px solid #27272a",
        padding: "8px 12px 10px",
      }}
    >
      {!active?.src ? (
        <div style={{ textAlign: "center", padding: "28px 16px" }}>
          <div style={{ fontSize: 13, color: "#a1a1aa" }}>PREVIEW</div>
          <div style={{ fontSize: 28, fontVariantNumeric: "tabular-nums" }}>
            {playhead.toFixed(1)}s
          </div>
          <div style={{ fontSize: 12, color: "#71717a" }}>
            {clips.length === 0 ? "Import a clip to begin" : `${clips.length} clip(s) on timeline`}
          </div>
        </div>
      ) : (
        <div>
          <video
            ref={videoRef}
            src={active.src}
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            style={{
              width: "100%",
              maxHeight: 240,
              borderRadius: 12,
              background: "#000",
              display: "block",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "#d4d4d8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {active.name}
            </span>
            <span style={{ fontSize: 13, color: "#a1a1aa", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {playhead.toFixed(1)}s / {duration.toFixed(1)}s
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" aria-label="Back 5 seconds" onClick={() => seek(-5)} style={ctrlBtn}>
              −5s
            </button>
            <button type="button" aria-label="Back 1 second" onClick={() => seek(-1)} style={ctrlBtn}>
              −1s
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => void toggle()}
              style={{ ...ctrlBtn, minWidth: 76, background: "#27272a" }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button type="button" aria-label="Forward 1 second" onClick={() => seek(1)} style={ctrlBtn}>
              +1s
            </button>
            <button type="button" aria-label="Forward 5 seconds" onClick={() => seek(5)} style={ctrlBtn}>
              +5s
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
