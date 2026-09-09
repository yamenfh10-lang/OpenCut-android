import { useState } from "react";
import { palette, radii, spacing } from "../../../theme";
import {
  COLOR_LABELS,
  FILTER_PRESETS,
  normalizeFilter,
  normalizeTransform,
} from "../../../lib/presets";
import { useTimelineStore } from "../../../stores/timeline";
import { hapticTick } from "../../../lib/native";

// Per-clip adjust: rename, trim, LumoCut-style filter presets + sliders,
// devhyper-style rotate/flip/scale, and color label. All offline-first.
export default function AdjustSheet({ onDone }: { onDone: () => void }) {
  const clips = useTimelineStore((s) => s.clips);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const selected = clips.find((c) => c.id === selectedClipId) ?? null;

  const [name, setName] = useState<string | null>(null);
  const [startStr, setStartStr] = useState<string | null>(null);
  const [durStr, setDurStr] = useState<string | null>(null);

  if (!selected) {
    return <p style={{ fontSize: 14, color: palette.muted }}>Select a clip first, then adjust it.</p>;
  }

  const st = useTimelineStore.getState();
  const filter = normalizeFilter(selected.filter);
  const transform = normalizeTransform(selected.transform);

  const numInput = (value: string, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function commitMeta() {
    const n = (name ?? selected!.name).trim();
    if (n && n !== selected!.name) st.renameClip(selected!.id, n.slice(0, 80));
    const start = Math.max(0, numInput(startStr ?? String(selected!.start), selected!.start));
    if (start !== selected!.start) st.moveClip(selected!.id, { start });
    const dur = Math.max(0.1, numInput(durStr ?? String(selected!.duration), selected!.duration));
    if (dur !== selected!.duration) st.setClipDuration(selected!.id, dur);
    setName(null);
    setStartStr(null);
    setDurStr(null);
    void hapticTick();
  }

  function setFilter(patch: Partial<typeof filter>) {
    st.setClipFilter(selected!.id, { ...filter, ...patch });
    void hapticTick();
  }

  function slider(label: string, value: number, min: number, max: number, step: number, onPick: (v: number) => void, format: (v: number) => string) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: palette.muted }}>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{label}</span>
          <strong style={{ color: palette.text, fontVariantNumeric: "tabular-nums" }}>{format(value)}</strong>
        </span>
        <input
          type="range"
          aria-label={label}
          className="oc-scrub"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onPick(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </label>
    );
  }

  const rotations = [0, 90, 180, 270] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <div style={{ fontSize: 13, color: palette.muted }}>
        Editing <strong style={{ color: palette.text }}>{selected.name}</strong>
      </div>

      <label style={{ fontSize: 13, color: palette.muted, display: "flex", flexDirection: "column", gap: 6 }}>
        Clip name
        <input
          type="text"
          value={name ?? selected.name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitMeta}
          maxLength={80}
          style={fieldStyle}
        />
      </label>

      <div style={{ display: "flex", gap: spacing.sm }}>
        <label style={{ flex: 1, fontSize: 13, color: palette.muted, display: "flex", flexDirection: "column", gap: 6 }}>
          Start (s)
          <input
            type="number" min={0} step={0.1}
            value={startStr ?? String(selected.start)}
            onChange={(e) => setStartStr(e.target.value)}
            onBlur={commitMeta}
            style={fieldStyle}
          />
        </label>
        <label style={{ flex: 1, fontSize: 13, color: palette.muted, display: "flex", flexDirection: "column", gap: 6 }}>
          Duration (s)
          <input
            type="number" min={0.1} step={0.1}
            value={durStr ?? String(selected.duration)}
            onChange={(e) => setDurStr(e.target.value)}
            onBlur={commitMeta}
            style={fieldStyle}
          />
        </label>
      </div>

      <div>
        <div style={sectionTitle}>Filter presets</div>
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          {FILTER_PRESETS.map((p) => {
            const active =
              filter.brightness === p.filter.brightness &&
              filter.contrast === p.filter.contrast &&
              filter.saturation === p.filter.saturation &&
              filter.grayscale === p.filter.grayscale &&
              filter.sepia === p.filter.sepia &&
              filter.invert === p.filter.invert;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  st.setClipFilter(selected.id, p.filter);
                  void hapticTick();
                }}
                aria-pressed={active}
                style={{
                  flex: "1 0 28%",
                  minHeight: 48,
                  borderRadius: radii.md,
                  border: active ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
                  background: active ? palette.cardElevated : palette.card,
                  color: palette.text,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        {slider("Brightness", filter.brightness, 0, 2, 0.05, (v) => setFilter({ brightness: v }), (v) => `${Math.round(v * 100)}%`)}
        {slider("Contrast", filter.contrast, 0, 2, 0.05, (v) => setFilter({ contrast: v }), (v) => `${Math.round(v * 100)}%`)}
        {slider("Saturation", filter.saturation, 0, 2, 0.05, (v) => setFilter({ saturation: v }), (v) => `${Math.round(v * 100)}%`)}
      </div>

      <div>
        <div style={sectionTitle}>Rotate & flip</div>
        <div style={{ display: "flex", gap: spacing.sm }}>
          {rotations.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                st.setClipTransform(selected.id, { ...transform, rotation: r });
                void hapticTick();
              }}
              aria-pressed={transform.rotation === r}
              style={chipStyle(transform.rotation === r)}
            >
              {r}°
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              st.setClipTransform(selected.id, { ...transform, flipH: !transform.flipH });
              void hapticTick();
            }}
            aria-pressed={transform.flipH}
            aria-label="Flip horizontal"
            style={chipStyle(transform.flipH)}
          >
            ⇄
          </button>
          <button
            type="button"
            onClick={() => {
              st.setClipTransform(selected.id, { ...transform, flipV: !transform.flipV });
              void hapticTick();
            }}
            aria-pressed={transform.flipV}
            aria-label="Flip vertical"
            style={chipStyle(transform.flipV)}
          >
            ⇅
          </button>
        </div>
      </div>

      <div>
        {slider("Scale", transform.scale, 0.25, 3, 0.05, (v) => {
          st.setClipTransform(selected.id, { ...transform, scale: v });
          void hapticTick();
        }, (v) => `${Math.round(v * 100)}%`)}
      </div>

      <div>
        <div style={sectionTitle}>Color label</div>
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          {COLOR_LABELS.map((c) => {
            const active = (selected.colorLabel ?? "none") === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  st.setClipColorLabel(selected.id, c.id);
                  void hapticTick();
                }}
                aria-pressed={active}
                aria-label={`Label ${c.label}`}
                title={c.label}
                style={{
                  minHeight: 48,
                  minWidth: 48,
                  borderRadius: radii.full,
                  border: active ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
                  background: c.color ?? "transparent",
                }}
              />
            );
          })}
        </div>
      </div>

      <button type="button" onClick={onDone} style={doneStyle}>
        Done
      </button>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  minHeight: 48,
  borderRadius: 12,
  border: "1px solid #3f3f46",
  background: "#1b1b1f",
  color: "#fafafa",
  padding: "0 12px",
  fontSize: 15,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  color: "#a1a1aa",
  marginBottom: 6,
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flex: "1 0 auto",
    minHeight: 48,
    padding: "0 12px",
    borderRadius: 12,
    border: active ? "2px solid #fafafa" : "1px solid #27272a",
    background: active ? "#232329" : "#1b1b1f",
    color: "#fafafa",
    fontWeight: 700,
    fontSize: 14,
  };
}

const doneStyle: React.CSSProperties = {
  minHeight: 48,
  borderRadius: 12,
  border: "1px solid #27272a",
  background: "transparent",
  color: "#fafafa",
};
