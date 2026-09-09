import { useState } from "react";
import { palette, radii, spacing } from "../../../theme";
import { SHAPES, SHAPE_COLORS } from "../../../lib/presets";
import type { ShapeId } from "../../../lib/presets";
import { timelineDuration, useTimelineStore } from "../../../stores/timeline";
import { hapticTick } from "../../../lib/native";
import ShapeArt from "../ShapeArt";

export default function TextSheet({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [dur, setDur] = useState("3");
  const [note, setNote] = useState("");
  const [shape, setShape] = useState<ShapeId>("star");
  const [shapeColor, setShapeColor] = useState<string>(SHAPE_COLORS[0]);
  const addClip = useTimelineStore((s) => s.addClip);

  function handleAddShape() {
    const start = timelineDuration(useTimelineStore.getState().clips);
    const clip = addClip({
      trackId: "v1",
      name: `Sticker: ${shape}`,
      start,
      duration: 2,
      kind: "shape",
      shape,
      shapeColor,
    });
    useTimelineStore.getState().selectClip(clip.id);
    setNote(`Added ${shape} sticker at ${start.toFixed(1)}s.`);
    void hapticTick();
  }

  function handleAdd() {
    const title = text.trim() || "Title";
    const duration = Math.max(0.5, Number(dur) || 3);
    const start = timelineDuration(useTimelineStore.getState().clips);
    const clip = addClip({
      trackId: "v1",
      name: `TEXT: ${title.slice(0, 40)}`,
      start,
      duration,
      kind: "text",
      text: title,
    });
    useTimelineStore.getState().selectClip(clip.id);
    setNote(`Added “${title}” at ${start.toFixed(1)}s.`);
    setText("");
    void hapticTick();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <label style={{ fontSize: 13, color: palette.muted, display: "flex", flexDirection: "column", gap: 6 }}>
        Title text
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="My title"
          maxLength={60}
          style={{
            minHeight: 48,
            borderRadius: radii.md,
            border: `1px solid ${palette.borderStrong}`,
            background: palette.card,
            color: palette.text,
            padding: "0 12px",
            fontSize: 15,
          }}
        />
      </label>
      <label style={{ fontSize: 13, color: palette.muted, display: "flex", flexDirection: "column", gap: 6 }}>
        Duration (seconds)
        <input
          type="number"
          min={0.5}
          step={0.5}
          value={dur}
          onChange={(e) => setDur(e.target.value)}
          style={{
            minHeight: 48,
            borderRadius: radii.md,
            border: `1px solid ${palette.borderStrong}`,
            background: palette.card,
            color: palette.text,
            padding: "0 12px",
            fontSize: 15,
          }}
        />
      </label>
      <button
        type="button"
        onClick={handleAdd}
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: "none",
          background: palette.text,
          color: "#09090b",
          fontWeight: 800,
          fontSize: 15,
        }}
      >
        Add title card
      </button>

      <div style={{ fontSize: 13, color: palette.muted }}>Stickers</div>
      <div style={{ display: "flex", gap: spacing.sm }}>
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setShape(s.id)}
            aria-pressed={shape === s.id}
            aria-label={`Sticker shape ${s.label}`}
            style={{
              flex: 1,
              minHeight: 56,
              borderRadius: radii.md,
              border: shape === s.id ? "2px solid #fafafa" : "1px solid #27272a",
              background: shape === s.id ? "#232329" : "#1b1b1f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShapeArt shape={s.id} color={shapeColor} size={30} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: spacing.sm }}>
        {SHAPE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setShapeColor(c)}
            aria-pressed={shapeColor === c}
            aria-label={`Sticker color ${c}`}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: radii.full,
              border: shapeColor === c ? "2px solid #fafafa" : "1px solid #27272a",
              background: c,
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={handleAddShape}
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: "1px solid #3f3f46",
          background: "#1b1b1f",
          color: "#fafafa",
          fontWeight: 800,
          fontSize: 15,
        }}
      >
        Add sticker
      </button>
      {note ? <p style={{ fontSize: 12, color: palette.muted, margin: 0 }}>{note}</p> : null}
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
