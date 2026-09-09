import { useState } from "react";
import { palette, radii, spacing } from "../../../theme";
import { timelineDuration, useTimelineStore } from "../../../stores/timeline";
import { hapticTick } from "../../../lib/native";

export default function TextSheet({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [dur, setDur] = useState("3");
  const [note, setNote] = useState("");
  const addClip = useTimelineStore((s) => s.addClip);

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
