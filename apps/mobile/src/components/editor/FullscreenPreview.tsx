import { useRef, useState } from "react";
import { Minimize2, Pause, Play, X } from "lucide-react";
import { radii, spacing } from "../../theme";
import { timelineDuration, useTimelineStore } from "../../stores/timeline";

interface FullscreenPreviewProps {
  onClose: () => void;
}

export default function FullscreenPreview({ onClose }: FullscreenPreviewProps) {
  const clips = useTimelineStore((s) => s.clips);
  const playhead = useTimelineStore((s) => s.playhead);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const duration = timelineDuration(clips);
  const active =
    clips.find((c) => playhead >= c.start && playhead < c.start + c.duration) ??
    clips[0] ??
    null;

  async function toggle() {
    const v = videoRef.current;
    if (!v || !active?.src) return;
    try {
      if (v.paused) await v.play();
      else v.pause();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen preview"
      className="oc-fade-enter"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
          padding: `${spacing.sm}px ${spacing.md}px`,
        }}
      >
        <span style={{ fontSize: 14, color: "#fafafa", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {active?.name ?? "Preview"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit fullscreen preview"
          style={{
            minHeight: 48,
            minWidth: 48,
            borderRadius: radii.md,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {window.innerWidth > 0 ? <Minimize2 size={18} /> : <X size={18} />}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, padding: `0 ${spacing.md}px` }}>
        {active?.src ? (
          <video
            ref={videoRef}
            src={active.src}
            playsInline
            controls={false}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onClick={() => void toggle()}
            style={{ width: "100%", maxHeight: "100%", background: "#000", objectFit: "contain" }}
          />
        ) : (
          <div style={{ color: "#a1a1aa", fontSize: 14 }}>No media on the timeline yet.</div>
        )}
      </div>

      {/* Expanded timeline: scrubber + clip strip */}
      <div style={{ padding: `${spacing.md}px`, display: "flex", flexDirection: "column", gap: spacing.sm }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <button
            type="button"
            onClick={() => void toggle()}
            aria-label={playing ? "Pause" : "Play"}
            style={{
              minHeight: 52,
              minWidth: 52,
              borderRadius: radii.full,
              border: "none",
              background: "#fafafa",
              color: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {playing ? <Pause size={22} fill="#000" /> : <Play size={22} fill="#000" />}
          </button>
          <input
            type="range"
            aria-label="Scrub playhead fullscreen"
            className="oc-scrub"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={Math.min(playhead, Math.max(duration, 0.1))}
            onChange={(e) => setPlayhead(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: "#fafafa", fontVariantNumeric: "tabular-nums" }}>
            {playhead.toFixed(1)}s
          </span>
        </div>
        <div className="oc-lane" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {clips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setPlayhead(c.start + 0.01)}
              aria-label={`Jump to ${c.name}`}
              style={{
                flexShrink: 0,
                minHeight: 48,
                minWidth: 110,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                fontSize: 12,
                padding: "8px 10px",
                textAlign: "left",
              }}
            >
              <span style={{ display: "block", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </span>
              <span style={{ color: "#d4d4d8" }}>{c.start.toFixed(1)}s</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
