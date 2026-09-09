import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTimelineStore } from "../stores/timeline";

const field: CSSProperties = {
  minHeight: 44,
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#f4f4f5",
  fontSize: 15,
};

const actionBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #52525b",
  background: "#27272a",
  color: "#f4f4f5",
  fontSize: 14,
  fontWeight: 600,
  flex: 1,
};

const dangerBtn: CSSProperties = {
  ...actionBtn,
  border: "1px solid #7f1d1d",
  background: "#27272a",
};

// Rename / duration have no dedicated store action, so compose via
// remove + add with the same id (store file itself stays untouched).
function replaceClipFields(id: string, patch: { name?: string; duration?: number }) {
  const st = useTimelineStore.getState();
  const cur = st.clips.find((c) => c.id === id);
  if (!cur) return;
  const next = {
    ...cur,
    name: patch.name ?? cur.name,
    duration: Math.max(0.1, patch.duration ?? cur.duration),
    start: Math.max(0, cur.start),
  };
  st.removeClip(id);
  st.addClip({
    id: next.id,
    trackId: next.trackId,
    name: next.name,
    start: next.start,
    duration: next.duration,
    ...(next.src !== undefined ? { src: next.src } : {}),
  });
  st.selectClip(id);
}

export default function Inspector() {
  const clips = useTimelineStore((s) => s.clips);
  const tracks = useTimelineStore((s) => s.tracks);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const playhead = useTimelineStore((s) => s.playhead);
  const addClip = useTimelineStore((s) => s.addClip);
  const splitClip = useTimelineStore((s) => s.splitClip);
  const moveClip = useTimelineStore((s) => s.moveClip);
  const removeClip = useTimelineStore((s) => s.removeClip);

  const selected = clips.find((c) => c.id === selectedClipId) ?? null;

  const [name, setName] = useState("");
  const [startDraft, setStartDraft] = useState("0");
  const [durDraft, setDurDraft] = useState("0");
  const [note, setNote] = useState("");

  useEffect(() => {
    setName(selected?.name ?? "");
    setStartDraft(String(selected?.start ?? 0));
    setDurDraft(String(selected?.duration ?? 0));
    setNote("");
  }, [selected?.id, selected?.name, selected?.start, selected?.duration, selected?.trackId]);

  if (!selected) {
    return (
      <div style={{ fontSize: 14 }}>
        <strong>Inspector</strong>
        <p style={{ color: "#a1a1aa" }}>Tap a clip in the timeline to inspect it.</p>
      </div>
    );
  }

  function commitName() {
    const v = name.trim();
    if (!v || v === selected?.name) return;
    if (!selected) return;
    replaceClipFields(selected.id, { name: v });
    setNote(`Renamed to “${v}”.`);
  }

  function commitStart(raw: string) {
    setStartDraft(raw);
    const v = Number(raw);
    if (!selected || !Number.isFinite(v)) return;
    moveClip(selected.id, { start: Math.max(0, v) });
  }

  function commitDuration(raw: string) {
    setDurDraft(raw);
    const v = Number(raw);
    if (!selected || !Number.isFinite(v) || v < 0.1) return;
    replaceClipFields(selected.id, { duration: v });
  }

  function duplicate() {
    if (!selected) return;
    const copy = addClip({
      trackId: selected.trackId,
      name: `${selected.name} copy`,
      start: selected.start + selected.duration,
      duration: selected.duration,
      ...(selected.src !== undefined ? { src: selected.src } : {}),
    });
    useTimelineStore.getState().selectClip(copy.id);
    setNote(`Duplicated as “${copy.name}”.`);
  }

  function splitAtPlayhead() {
    if (!selected) return;
    const created = splitClip(selected.id, playhead);
    if (!created) {
      setNote("Playhead must be inside the clip to split.");
    } else {
      setNote(`Split at ${playhead.toFixed(1)}s.`);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <strong style={{ fontSize: 14 }}>Inspector</strong>
      <label style={{ fontSize: 13, color: "#a1a1aa", display: "flex", flexDirection: "column", gap: 6 }}>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          style={field}
        />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ fontSize: 13, color: "#a1a1aa", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          Start (s)
          <input
            type="number"
            min={0}
            step={0.1}
            value={startDraft}
            onChange={(e) => commitStart(e.target.value)}
            style={field}
          />
        </label>
        <label style={{ fontSize: 13, color: "#a1a1aa", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          Duration (s)
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={durDraft}
            onChange={(e) => commitDuration(e.target.value)}
            style={field}
          />
        </label>
      </div>
      <label style={{ fontSize: 13, color: "#a1a1aa", display: "flex", flexDirection: "column", gap: 6 }}>
        Track
        <select
          value={selected.trackId}
          onChange={(e) => moveClip(selected.id, { trackId: e.target.value })}
          style={{ ...field, minHeight: 44 }}
        >
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={duplicate} aria-label="Duplicate clip" style={actionBtn}>
          Duplicate
        </button>
        <button type="button" onClick={splitAtPlayhead} aria-label="Split clip at playhead" style={actionBtn}>
          Split @ {playhead.toFixed(1)}s
        </button>
        <button
          type="button"
          onClick={() => removeClip(selected.id)}
          aria-label="Delete clip"
          style={dangerBtn}
        >
          Delete
        </button>
      </div>
      {note ? <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>{note}</p> : null}
    </div>
  );
}
