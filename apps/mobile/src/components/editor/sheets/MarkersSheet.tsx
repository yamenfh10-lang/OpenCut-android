import { useState } from "react";
import { palette, radii, spacing } from "../../../theme";
import { MARKER_COLORS, markerColor } from "../../../lib/presets";
import { useTimelineStore } from "../../../stores/timeline";
import { hapticHeavy, hapticTick } from "../../../lib/native";

// LumoCut-style colored timeline markers: add at playhead, jump, rename, delete.
export default function MarkersSheet({ onDone }: { onDone: () => void }) {
  const markers = useTimelineStore((s) => s.markers);
  const clips = useTimelineStore((s) => s.clips);
  const playhead = useTimelineStore((s) => s.playhead);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<string>("red");
  const [jumpTo, setJumpTo] = useState("");
  const [beatsBusy, setBeatsBusy] = useState(false);
  const [beatsNote, setBeatsNote] = useState("");

  const sorted = [...markers].sort((a, b) => a.time - b.time);

  async function handleAutoBeats() {
    // Spectral-flux beat detection on the selected (or first) audio clip.
    const st = useTimelineStore.getState();
    const target =
      clips.find((c) => c.id === st.selectedClipId && c.src) ??
      clips.find((c) => c.src && (c.kind === "audio" || c.trackId === "a1"));
    if (!target?.src) {
      setBeatsNote("Select an audio clip first.");
      return;
    }
    setBeatsBusy(true);
    try {
      const res = await fetch(target.src);
      const blob = await res.blob();
      const { detectBeatsInBlob } = await import("../../../lib/audio");
      const beats = await detectBeatsInBlob(blob);
      if (beats.length === 0) {
        setBeatsNote("No clear beats found in this clip.");
        return;
      }
      const capped = beats.slice(0, 64);
      for (const t of capped) {
        st.addMarker({ time: t, label: `Beat ${t.toFixed(1)}s`, color: "yellow" });
      }
      setBeatsNote(`Added ${capped.length} beat markers.`);
      await hapticTick();
    } catch (err) {
      setBeatsNote(`Beat detection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBeatsBusy(false);
    }
  }

  async function handleAdd() {
    useTimelineStore.getState().addMarker({
      time: playhead,
      label: label.trim() || `Marker ${playhead.toFixed(1)}s`,
      color,
    });
    setLabel("");
    await hapticTick();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <div style={{ display: "flex", gap: spacing.sm }}>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`Label @ ${playhead.toFixed(1)}s`}
          maxLength={60}
          aria-label="Marker label"
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: radii.md,
            border: `1px solid ${palette.borderStrong}`,
            background: palette.card,
            color: palette.text,
            padding: "0 12px",
            fontSize: 15,
          }}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          aria-label="Add marker at playhead"
          style={{
            minHeight: 48,
            padding: "0 16px",
            borderRadius: radii.md,
            border: "none",
            background: palette.text,
            color: "#09090b",
            fontWeight: 800,
          }}
        >
          Add
        </button>
      </div>

      <div style={{ display: "flex", gap: spacing.sm }}>
        {MARKER_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.id)}
            aria-pressed={color === c.id}
            aria-label={`Marker color ${c.label}`}
            title={c.label}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: radii.md,
              border: color === c.id ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
              background: c.color,
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: spacing.sm }}>
        <input
          type="number"
          min={0}
          step={0.1}
          value={jumpTo}
          onChange={(e) => setJumpTo(e.target.value)}
          placeholder="Go to seconds…"
          aria-label="Jump to time in seconds"
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: radii.md,
            border: `1px solid ${palette.borderStrong}`,
            background: palette.card,
            color: palette.text,
            padding: "0 12px",
            fontSize: 15,
            fontVariantNumeric: "tabular-nums",
          }}
        />
        <button
          type="button"
          onClick={() => {
            const t = Number(jumpTo);
            if (Number.isFinite(t) && t >= 0) {
              setPlayhead(t);
              void hapticTick();
            }
          }}
          aria-label="Jump to time"
          style={{
            minHeight: 48,
            padding: "0 16px",
            borderRadius: radii.md,
            border: `1px solid ${palette.borderStrong}`,
            background: palette.cardElevated,
            color: palette.text,
            fontWeight: 700,
          }}
        >
          Go
        </button>
      </div>

      <button
        type="button"
        onClick={() => void handleAutoBeats()}
        disabled={beatsBusy}
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: `1px solid ${palette.borderStrong}`,
          background: palette.card,
          color: palette.text,
          fontWeight: 800,
          opacity: beatsBusy ? 0.6 : 1,
        }}
      >
        {beatsBusy ? "Listening…" : "♫ Auto-detect beats → markers"}
      </button>
      {beatsNote ? (
        <p style={{ fontSize: 12, color: palette.muted, margin: 0 }} role="status">
          {beatsNote}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: palette.faint, margin: 0 }}>
          No markers yet. Markers snap the playhead and survive saves.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {sorted.map((m) => (
            <li
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                border: `1px solid ${palette.border}`,
                borderRadius: radii.md,
                padding: spacing.sm,
                background: palette.card,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  transform: "rotate(45deg)",
                  background: markerColor(m.color),
                  flexShrink: 0,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setPlayhead(m.time);
                  void hapticTick();
                }}
                aria-label={`Jump to marker ${m.label}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  color: palette.text,
                  textAlign: "left",
                  padding: 0,
                  minHeight: 48,
                }}
              >
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.label}
                </span>
                <span style={{ display: "block", fontSize: 12, color: palette.muted, fontVariantNumeric: "tabular-nums" }}>
                  {m.time.toFixed(1)}s
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  useTimelineStore.getState().removeMarker(m.id);
                  void hapticHeavy();
                }}
                aria-label={`Delete marker ${m.label}`}
                style={{
                  minHeight: 48,
                  minWidth: 48,
                  borderRadius: radii.md,
                  border: `1px solid ${palette.dangerBorder}`,
                  background: "transparent",
                  color: palette.danger,
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onDone}
        style={{
          minHeight: 48,
          borderRadius: radii.md,
          border: `1px solid ${palette.border}`,
          background: "transparent",
          color: palette.text,
        }}
      >
        Done
      </button>
    </div>
  );
}
