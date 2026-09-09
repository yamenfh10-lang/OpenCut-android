import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Maximize2, Pause, Play } from "lucide-react";
import { palette, radii, spacing, typeScale } from "../../theme";
import { clipSpeed, timelineDuration, useTimelineStore } from "../../stores/timeline";
import { hapticTick } from "../../lib/native";

interface PreviewAreaProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  onEnterFullscreen: () => void;
}

export default function PreviewArea({ videoRef, onEnterFullscreen }: PreviewAreaProps) {
  const clips = useTimelineStore((s) => s.clips);
  const playhead = useTimelineStore((s) => s.playhead);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);

  const duration = timelineDuration(clips);
  const selected = clips.find((c) => c.id === selectedClipId) ?? null;
  const underPlayhead =
    clips.find((c) => playhead >= c.start && playhead < c.start + c.duration) ?? null;
  const active = selected ?? underPlayhead ?? clips[0] ?? null;
  const speed = active ? clipSpeed(active) : 1;

  const [playing, setPlaying] = useState(false);
  const lastTap = useRef(0);

  // Keep element in sync with the global playhead + per-clip speed.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.playbackRate - speed) > 0.01) {
      try {
        v.playbackRate = speed;
      } catch {
        // ignore
      }
    }
    if (!active?.src) return;
    const target = Math.min(
      Math.max(0, playhead - active.start),
      Math.max(0, active.duration - 0.05),
    );
    if (Math.abs(v.currentTime - target) > 0.35) {
      try {
        v.currentTime = target;
      } catch {
        // metadata not ready
      }
    }
  }, [playhead, active, speed, videoRef]);

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

  function seekBy(delta: number) {
    setPlayhead(Math.max(0, playhead + delta));
    void hapticTick();
  }

  /** Tap toggles play; double-tap left/right seeks ∓5s. */
  function onTapZone(e: React.MouseEvent, side: "left" | "center" | "right") {
    const now = Date.now();
    const dt = now - lastTap.current;
    lastTap.current = now;
    if (dt < 320 && side !== "center") {
      e.stopPropagation();
      seekBy(side === "left" ? -5 : 5);
      return;
    }
    void toggle();
  }

  return (
    <section aria-label="Preview" style={{ background: "#000", position: "relative" }}>
      {!active?.src ? (
        <div style={{ textAlign: "center", padding: "30px 16px" }}>
          <div style={{ fontSize: typeScale.caption, color: palette.muted, letterSpacing: 2 }}>
            PREVIEW
          </div>
          <div style={{ fontSize: typeScale.display, fontVariantNumeric: "tabular-nums" }}>
            {playhead.toFixed(1)}s
          </div>
          <div style={{ fontSize: typeScale.caption, color: palette.faint }}>
            {clips.length === 0
              ? "Import a clip to begin"
              : `${clips.length} clip(s) — tap Import below`}
          </div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
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
              aspectRatio: "16 / 9",
              maxHeight: "32dvh",
              background: "#000",
              display: "block",
              objectFit: "contain",
            }}
          />
          {/* Gesture layer: left 30% = -5s, right 30% = +5s, center = play/pause */}
          <div style={{ position: "absolute", inset: 0, display: "flex" }} aria-hidden={false}>
            <button
              type="button"
              aria-label="Double-tap to go back 5 seconds"
              onClick={(e) => onTapZone(e, "left")}
              style={{ flex: 3, background: "transparent", border: "none", minHeight: 48 }}
            />
            <button
              type="button"
              aria-label={playing ? "Pause preview" : "Play preview"}
              onClick={(e) => onTapZone(e, "center")}
              style={{ flex: 4, background: "transparent", border: "none", minHeight: 48 }}
            >
              {!playing ? (
                <span
                  style={{
                    display: "inline-flex",
                    width: 56,
                    height: 56,
                    borderRadius: radii.full,
                    background: "rgba(0,0,0,0.55)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Play size={26} color="#fff" fill="#fff" />
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    width: 56,
                    height: 56,
                    borderRadius: radii.full,
                    background: "rgba(0,0,0,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Pause size={26} color="#fff" fill="#fff" />
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Double-tap to go forward 5 seconds"
              onClick={(e) => onTapZone(e, "right")}
              style={{ flex: 3, background: "transparent", border: "none", minHeight: 48 }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: spacing.md,
              right: spacing.md,
              bottom: spacing.sm,
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#fafafa",
                background: "rgba(0,0,0,0.6)",
                borderRadius: 8,
                padding: "4px 8px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "55%",
              }}
            >
              {active.name}
              {speed !== 1 ? ` · ${speed}x` : ""}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                color: "#fafafa",
                background: "rgba(0,0,0,0.6)",
                borderRadius: 8,
                padding: "4px 8px",
              }}
            >
              {playhead.toFixed(1)}s / {duration.toFixed(1)}s
            </span>
          </div>
          <button
            type="button"
            onClick={onEnterFullscreen}
            aria-label="Open fullscreen preview"
            style={{
              position: "absolute",
              top: spacing.sm,
              right: spacing.sm,
              minHeight: 48,
              minWidth: 48,
              borderRadius: radii.md,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Maximize2 size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
