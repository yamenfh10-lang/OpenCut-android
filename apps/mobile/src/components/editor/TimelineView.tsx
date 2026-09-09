import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { palette, radii, spacing, typeScale } from "../../theme";
import { clipsForTrack, timelineDuration, useTimelineStore } from "../../stores/timeline";
import type { TimelineClip } from "../../stores/timeline";
import { colorLabelColor, markerColor } from "../../lib/presets";
import { hapticHeavy, hapticTick } from "../../lib/native";

const PX_PER_SEC = 56;

function ClipThumb({ clip }: { clip: TimelineClip }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!clip.src) return;
    let alive = true;
    let obj: string | null = null;
    (async () => {
      try {
        const { getThumbnail } = await import("../../lib/engine");
        const blob = await getThumbnail(clip.src as string, 0, clip.name);
        if (!alive || !blob) return;
        obj = URL.createObjectURL(blob);
        setUrl(obj);
      } catch {
        // placeholder stays
      }
    })();
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [clip.src, clip.name]);

  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: 34, objectFit: "cover", display: "block", borderRadius: 6 }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: 34,
        borderRadius: 6,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        color: palette.faint,
      }}
    >
      {clip.name.slice(0, 8) || "clip"}
    </div>
  );
}

function ClipCard({
  clip,
  kind,
  selected,
  width,
  onSelect,
  onDelete,
}: {
  clip: TimelineClip;
  kind: "video" | "audio";
  selected: boolean;
  width: number;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const labelColor = colorLabelColor(clip.colorLabel);

  return (
    <div style={{ position: "relative", flexShrink: 0, width }}>
      {/* Red delete backdrop revealed on swipe */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radii.md,
          background: "#3f1215",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: spacing.md,
          color: palette.danger,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Delete
      </div>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select clip ${clip.name}`}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (!t) return;
          startX.current = t.clientX;
          setSwiping(true);
        }}
        onTouchMove={(e) => {
          if (!swiping) return;
          const t = e.touches[0];
          if (!t) return;
          const dx = t.clientX - startX.current;
          // Only leftward swipe reveals delete.
          setOffsetX(Math.min(0, dx));
        }}
        onTouchEnd={() => {
          setSwiping(false);
          if (offsetX < -72) {
            setOffsetX(0);
            void (async () => {
              await hapticHeavy();
              onDelete();
            })();
          } else {
            setOffsetX(0);
          }
        }}
        className={swiping ? undefined : "oc-spring"}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          minHeight: 48,
          padding: 6,
          borderRadius: radii.md,
          border: selected ? `2px solid ${palette.text}` : `1px solid ${palette.borderStrong}`,
          borderTop: labelColor ? `4px solid ${labelColor}` : undefined,
          background: kind === "video" ? palette.cardElevated : "#221d19",
          color: palette.text,
          textAlign: "left",
          transform: `translateX(${offsetX}px)`,
        }}
      >
        <ClipThumb clip={clip} />
        <span
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {clip.name}
          {clip.speed !== undefined && clip.speed !== 1 ? ` · ${clip.speed}x` : ""}
        </span>
        <span style={{ display: "block", fontSize: 11, color: palette.muted, fontVariantNumeric: "tabular-nums" }}>
          {clip.start.toFixed(1)}s · {clip.duration.toFixed(1)}s
        </span>
      </button>
    </div>
  );
}

interface TimelineViewProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export default function TimelineView({ zoom, onZoomChange }: TimelineViewProps) {
  const tracks = useTimelineStore((s) => s.tracks);
  const clips = useTimelineStore((s) => s.clips);
  const markers = useTimelineStore((s) => s.markers);
  const playhead = useTimelineStore((s) => s.playhead);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const selectClip = useTimelineStore((s) => s.selectClip);
  const removeClip = useTimelineStore((s) => s.removeClip);

  const duration = timelineDuration(clips);
  const max = Math.max(duration, 5);
  const pinchDist = useRef<number | null>(null);

  // Magnetic-snap ticks: snap playhead to nearest whole second within 0.12s.
  function snapped(v: number): number {
    const near = Math.round(v);
    return Math.abs(v - near) < 0.12 ? near : v;
  }

  const ticks = Array.from({ length: Math.ceil(max) + 1 }, (_, i) => i);

  return (
    <section
      aria-label="Timeline"
      style={{
        background: palette.background,
        padding: `${spacing.sm}px ${spacing.md}px calc(env(safe-area-inset-bottom, 0px) + 12px)`,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        minHeight: 0,
      }}
      onTouchMove={(e) => {
        // Pinch-to-zoom on the timeline (two-finger).
        if (e.touches.length === 2) {
          const a = e.touches[0];
          const b = e.touches[1];
          if (!a || !b) return;
          const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          if (pinchDist.current !== null) {
            const delta = d - pinchDist.current;
            if (Math.abs(delta) > 6) {
              onZoomChange(Math.min(3, Math.max(0.5, zoom + (delta > 0 ? 0.15 : -0.15))));
              pinchDist.current = d;
            }
          } else {
            pinchDist.current = d;
          }
        }
      }}
      onTouchEnd={() => {
        pinchDist.current = null;
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        <button
          type="button"
          aria-label="Zoom out timeline"
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
          style={{
            minHeight: 48,
            minWidth: 48,
            borderRadius: radii.md,
            border: `1px solid ${palette.border}`,
            background: palette.card,
            color: palette.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Minus size={18} />
        </button>
        <input
          type="range"
          aria-label="Scrub playhead"
          className="oc-scrub"
          min={0}
          max={max}
          step={0.1}
          value={Math.min(playhead, max)}
          onChange={(e) => setPlayhead(snapped(Number(e.target.value)))}
          onPointerUp={() => void hapticTick()}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          aria-label="Zoom in timeline"
          onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
          style={{
            minHeight: 48,
            minWidth: 48,
            borderRadius: radii.md,
            border: `1px solid ${palette.border}`,
            background: palette.card,
            color: palette.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus size={18} />
        </button>
      </div>

      <div style={{ fontSize: typeScale.caption, color: palette.muted, fontVariantNumeric: "tabular-nums" }}>
        {playhead.toFixed(1)}s / {duration.toFixed(1)}s · {Math.round(zoom * 100)}%
      </div>

      {/* Ruler with magnetic-snap visual ticks */}
      <div
        aria-hidden
        style={{
          position: "relative",
          height: 18,
          transform: `scaleX(${zoom})`,
          transformOrigin: "left center",
        }}
      >
        {ticks.map((t) => {
          const isSnapTarget = Math.abs(playhead - t) < 0.12;
          return (
            <span
              key={t}
              style={{
                position: "absolute",
                left: `${(t / max) * 100}%`,
                top: 0,
                width: 2,
                height: isSnapTarget ? 16 : 9,
                background: isSnapTarget ? palette.text : palette.borderStrong,
                borderRadius: 2,
              }}
            />
          );
        })}
        {/* Playhead needle */}
        <span
          style={{
            position: "absolute",
            left: `${(Math.min(playhead, max) / max) * 100}%`,
            top: -2,
            width: 3,
            height: 22,
            background: palette.text,
            borderRadius: 2,
          }}
        />
        {/* Marker diamonds (LumoCut-style): tap jumps the playhead */}
        {markers.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setPlayhead(m.time);
              void hapticTick();
            }}
            aria-label={`Jump to marker ${m.label}`}
            title={m.label}
            style={{
              position: "absolute",
              left: `calc(${(Math.min(m.time, max) / max) * 100}% - 6px)`,
              top: 1,
              width: 12,
              height: 12,
              transform: "rotate(45deg)",
              background: markerColor(m.color),
              border: "1px solid rgba(0,0,0,0.5)",
              borderRadius: 2,
              padding: 0,
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, overflowY: "auto" }}>
        {tracks.map((t) => {
          const lane = clipsForTrack(clips, t.id);
          return (
            <div key={t.id}>
              <div style={{ fontSize: typeScale.caption, color: palette.muted, marginBottom: 4 }}>
                {t.name}
              </div>
              <div
                className="oc-lane"
                style={{
                  display: "flex",
                  gap: spacing.sm,
                  overflowX: "auto",
                  paddingBottom: 4,
                  transform: `scaleX(${zoom})`,
                  transformOrigin: "left center",
                }}
              >
                {lane.map((c) => (
                  <ClipCard
                    key={c.id}
                    clip={c}
                    kind={t.kind}
                    selected={selectedClipId === c.id}
                    width={Math.max(120, c.duration * PX_PER_SEC)}
                    onSelect={() => {
                      selectClip(c.id);
                      void hapticTick();
                    }}
                    onDelete={() => removeClip(c.id)}
                  />
                ))}
                {lane.length === 0 && (
                  <span style={{ fontSize: 12, color: palette.faint, minHeight: 48, display: "flex", alignItems: "center" }}>
                    Empty — import clips above
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: palette.faint, margin: 0 }}>
        Tap a card to select · swipe left on a card to delete · pinch or use +/− to zoom
      </p>
    </section>
  );
}
