import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Maximize2, Pause, Play, StepBack, StepForward } from "lucide-react";
import { palette, radii, spacing, typeScale } from "../../theme";
import { clipSpeed, timelineDuration, useTimelineStore } from "../../stores/timeline";
import {
  FRAME_STEP,
  cropRatio,
  cssFilter,
  cssTransform,
  layoutBox,
  normalizeLayout,
  normalizeShape,
  normalizeShapeColor,
  normalizeVolume,
} from "../../lib/presets";
import type { ClipFilter, ClipTransform } from "../../lib/presets";
import { hapticTick } from "../../lib/native";
import ShapeArt from "./ShapeArt";

interface PreviewAreaProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  onEnterFullscreen: () => void;
}

export default function PreviewArea({ videoRef, onEnterFullscreen }: PreviewAreaProps) {
  const tracks = useTimelineStore((s) => s.tracks);
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
  const layout = normalizeLayout(active?.layout);
  const box = layoutBox(layout);
  const pip = layout !== "full";
  const trackMuted = active
    ? tracks.find((t) => t.id === active.trackId)?.muted === true
    : false;

  // Video opacity from fade in/out (devhyper-style video fades).
  let opacity = 1;
  if (active) {
    const rel = playhead - active.start;
    const remain = active.start + active.duration - playhead;
    if ((active.fadeIn ?? 0) > 0) opacity = Math.min(opacity, Math.max(0, rel / (active.fadeIn as number)));
    if ((active.fadeOut ?? 0) > 0) opacity = Math.min(opacity, Math.max(0, remain / (active.fadeOut as number)));
  }

  // Entrance transition when the active clip changes (CapCut-style).
  const [entrance, setEntrance] = useState<{ id: string; type: string; dur: number } | null>(null);
  const prevId = useRef<string | null>(null);
  useEffect(() => {
    if (active && active.id !== prevId.current) {
      prevId.current = active.id;
      const tr = active.transition;
      if (tr && tr.type !== "none") setEntrance({ id: active.id, type: tr.type, dur: tr.duration });
      else setEntrance(null);
    } else if (!active) {
      prevId.current = null;
      setEntrance(null);
    }
  }, [active]);
  const entranceAnim =
    entrance && active && entrance.id === active.id
      ? (`oc-tr-${entrance.type} ${entrance.dur}s ease-out` as const)
      : undefined;

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
    const vol = active && !trackMuted ? Math.min(1, normalizeVolume(active.volume)) : active ? 0 : 1;
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
  }, [playhead, active, speed, trackMuted, videoRef]);

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

  const fullscreenBtn = (
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
  );

  const timeChips = (
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
          maxWidth: "45%",
        }}
      >
        {active?.name ?? ""}
        {active && active.speed !== undefined && active.speed !== 1 ? ` · ${active.speed}x` : ""}
      </span>
      <span
        style={{
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
      <span style={{ display: "flex", gap: 4, pointerEvents: "auto", marginLeft: "auto" }}>
        <button
          type="button"
          onClick={() => stepFrame(-1)}
          aria-label="Step back one frame"
          style={frameBtn}
        >
          <StepBack size={16} />
        </button>
        <button
          type="button"
          onClick={() => stepFrame(1)}
          aria-label="Step forward one frame"
          style={frameBtn}
        >
          <StepForward size={16} />
        </button>
      </span>
    </div>
  );

  if (!active || (!active.src && active.kind !== "text" && active.kind !== "shape")) {
    return (
      <section aria-label="Preview" style={{ background: "#000", position: "relative" }}>
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
      </section>
    );
  }

  // Text / sticker overlays render on a black stage.
  if (active.kind === "text" || active.kind === "shape") {
    return (
      <section aria-label="Preview" style={{ background: "#000", position: "relative" }}>
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
            opacity,
            animation: entranceAnim,
          }}
          onAnimationEnd={() => setEntrance(null)}
        >
          {active.kind === "text" ? (
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
          ) : (
            <ShapeArt
              shape={normalizeShape(active.shape)}
              color={normalizeShapeColor(active.shapeColor)}
              size={110}
            />
          )}
        </div>
        {fullscreenBtn}
      </section>
    );
  }

  return (
    <section aria-label="Preview" style={{ background: "#000", position: "relative" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          maxHeight: "32dvh",
          background: "#000",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: pip ? "absolute" : "relative",
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            opacity,
            animation: entranceAnim,
            border: pip ? "1px solid rgba(255,255,255,0.35)" : undefined,
            borderRadius: pip ? 8 : undefined,
            overflow: "hidden",
            background: "#000",
          }}
          onAnimationEnd={() => setEntrance(null)}
        >
          {active.kind === "image" && active.src ? (
            <img
              src={active.src}
              alt={active.name}
              style={mediaStyle(crop, active)}
            />
          ) : (
            <video
              ref={videoRef}
              src={active.src}
              playsInline
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              style={mediaStyle(crop, active)}
            />
          )}
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
              <span style={playBadge("rgba(0,0,0,0.55)")}>
                <Play size={26} color="#fff" fill="#fff" />
              </span>
            ) : (
              <span style={playBadge("rgba(0,0,0,0.35)")}>
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
        {timeChips}
        {fullscreenBtn}
      </div>
    </section>
  );
}

function mediaStyle(
  crop: string | null,
  active: { filter?: ClipFilter; transform?: ClipTransform },
): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    background: "#000",
    display: "block",
    objectFit: crop ? "cover" : "contain",
    filter: cssFilter(active.filter),
    transform: cssTransform(active.transform),
  };
}

const frameBtn: React.CSSProperties = {
  minHeight: 40,
  minWidth: 40,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function playBadge(background: string): React.CSSProperties {
  return {
    display: "inline-flex",
    width: 56,
    height: 56,
    borderRadius: 999,
    background,
    alignItems: "center",
    justifyContent: "center",
  };
}
