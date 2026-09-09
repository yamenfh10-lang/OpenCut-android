import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Maximize2, Pause, Play, StepBack, StepForward } from "lucide-react";
import { palette, radii, spacing, typeScale } from "../../theme";
import { clipSpeed, timelineDuration, useTimelineStore } from "../../stores/timeline";
import { FRAME_STEP, cropRatio, cssFilter, cssTransform, normalizeVolume } from "../../lib/presets";
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
  const crop = active ? cropRatio(active.crop) : null;

  const [playing, setPlaying] = useState(false);
  const lastTap = useRef(0);

  // Keep element in sync with the global playhead + per-clip speed/volume.
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
    const vol = active ? Math.min(1, normalizeVolume(active.volume)) : 1;
    if (Math.abs(v.volume - vol) > 0.01) {
      try {
        v.volume = vol;
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

  function stepFrame(dir: 1 | -1) {
    // Frame-accurate stepping (devhyper-style precise seeking, 30fps grid).
    const stepped = Math.round((playhead + dir * FRAME_STEP) / FRAME_STEP) * FRAME_STEP;
    setPlayhead(Math.max(0, Number(stepped.toFixed(3))));
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
      {!active || (!active.src && active.kind !== "text") ? (
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
      ) : active.kind === "image" && active.src ? (
        <div style={{ position: "relative" }}>
          <img
            src={active.src}
            alt={active.name}
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              maxHeight: "32dvh",
              background: "#000",
              display: "block",
              objectFit: "contain",
              filter: cssFilter(active.filter),
              transform: cssTransform(active.transform),
            }}
          />
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
      ) : active.kind === "text" ? (
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              maxHeight: "32dvh",
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: spacing.lg,
              filter: cssFilter(active.filter),
              transform: cssTransform(active.transform),
            }}
          >
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                textAlign: "center",
                color: "#fafafa",
                textShadow: "0 2px 12px rgba(0,0,0,0.8)",
              }}
            >
              {active.text || active.name}
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
      ) : (
        <div style={{ position: "relative" }}>
          <div
            style={
              crop
                ? {
                    width: "100%",
                    aspectRatio: crop,
                    maxHeight: "32dvh",
                    overflow: "hidden",
                    background: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }
                : undefined
            }
          >
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
              height: crop ? "100%" : undefined,
              aspectRatio: crop ? undefined : "16 / 9",
              maxHeight: crop ? undefined : "32dvh",
              background: "#000",
              display: "block",
              objectFit: crop ? "cover" : "contain",
              filter: active ? cssFilter(active.filter) : "none",
              transform: active ? cssTransform(active.transform) : "none",
            }}
          />
          </div>
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
            <span style={{ display: "flex", gap: 4, pointerEvents: "auto" }}>
              <button
                type="button"
                onClick={() => stepFrame(-1)}
                aria-label="Step back one frame"
                style={{
                  minHeight: 40,
                  minWidth: 40,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <StepBack size={16} />
              </button>
              <button
                type="button"
                onClick={() => stepFrame(1)}
                aria-label="Step forward one frame"
                style={{
                  minHeight: 40,
                  minWidth: 40,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <StepForward size={16} />
              </button>
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
