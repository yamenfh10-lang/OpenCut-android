import { useState } from "react";
import { palette, radii, spacing } from "../../../theme";
import { timelineDuration, useTimelineStore } from "../../../stores/timeline";
import { hapticTick } from "../../../lib/native";

export default function AudioSheet({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState("Extract audio from the selected video, or pick a file.");
  const [busy, setBusy] = useState(false);
  const clips = useTimelineStore((s) => s.clips);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const addClip = useTimelineStore((s) => s.addClip);
  const selected = clips.find((c) => c.id === selectedClipId) ?? null;

  async function addAudioBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    let duration = 5;
    try {
      const { getMetadata } = await import("../../../lib/engine");
      const meta = await getMetadata(blob);
      if (meta.duration) duration = meta.duration;
    } catch {
      // keep fallback
    }
    const start = timelineDuration(useTimelineStore.getState().clips);
    const clip = addClip({ trackId: "a1", name, start, duration, src: url });
    useTimelineStore.getState().selectClip(clip.id);
    await hapticTick();
  }

  async function handleExtractSelected() {
    if (!selected?.src) {
      setStatus("Select a video clip with media first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(selected.src);
      const bytes = await res.blob();
      const { extractAudio } = await import("../../../lib/engine");
      const audio = await extractAudio(bytes);
      if (!audio) {
        setStatus("Could not extract audio offline from this file.");
        return;
      }
      await addAudioBlob(audio, `${selected.name} (audio)`);
      setStatus(`Extracted audio from “${selected.name}”.`);
    } catch (err) {
      setStatus(`Extract failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { extractAudio } = await import("../../../lib/engine");
      const audio = await extractAudio(file);
      await addAudioBlob(audio ?? file, audio ? `${file.name} (audio)` : file.name);
      setStatus(audio ? `Added audio from ${file.name}.` : `Added ${file.name} directly (already audio or passthrough).`);
    } catch (err) {
      setStatus(`Audio add failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <button
        type="button"
        onClick={() => void handleExtractSelected()}
        disabled={busy || !selected?.src}
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: "none",
          background: palette.text,
          color: "#09090b",
          fontWeight: 800,
          opacity: busy || !selected?.src ? 0.6 : 1,
        }}
      >
        {busy ? "Working…" : "Extract audio from selected clip"}
      </button>
      <label
        className="oc-spring"
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: `1px solid ${palette.borderStrong}`,
          background: palette.card,
          color: palette.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Pick audio / video file
        <input type="file" accept="video/*,audio/*" onChange={(e) => void handlePick(e)} style={{ display: "none" }} />
      </label>
      <p style={{ fontSize: 13, color: palette.muted, margin: 0 }} role="status">
        {status}
      </p>
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
