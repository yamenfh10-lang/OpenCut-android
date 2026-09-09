import { palette, radii, spacing } from "../../../theme";
import { SPEED_MAX, SPEED_MIN, clipSpeed, useTimelineStore } from "../../../stores/timeline";
import { hapticTick } from "../../../lib/native";

const presets = [0.25, 0.5, 1, 1.5, 2, 4];

export default function SpeedSheet() {
  const clips = useTimelineStore((s) => s.clips);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const setClipSpeed = useTimelineStore((s) => s.setClipSpeed);
  const selected = clips.find((c) => c.id === selectedClipId) ?? null;
  const current = selected ? clipSpeed(selected) : 1;

  if (!selected) {
    return <p style={{ fontSize: 14, color: palette.muted }}>Select a clip first, then adjust its speed.</p>;
  }

  async function apply(v: number) {
    setClipSpeed(selected!.id, v);
    await hapticTick();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <div style={{ fontSize: 14, color: palette.muted }}>
        {selected.name} — <strong style={{ color: palette.text }}>{current.toFixed(2)}x</strong>
      </div>
      <input
        type="range"
        aria-label="Clip playback speed"
        className="oc-scrub"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={0.25}
        value={current}
        onChange={(e) => void apply(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => void apply(p)}
            aria-pressed={current === p}
            aria-label={`Set speed ${p}x`}
            style={{
              flex: "1 0 28%",
              minHeight: 48,
              borderRadius: radii.md,
              border: current === p ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
              background: current === p ? palette.cardElevated : palette.card,
              color: palette.text,
              fontWeight: 700,
            }}
          >
            {p}x
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: palette.faint, margin: 0 }}>
        Range {SPEED_MIN}x–{SPEED_MAX}x. Old projects without a speed play at 1x.
      </p>
    </div>
  );
}
