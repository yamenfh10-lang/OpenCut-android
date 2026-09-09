import { useRef, useState } from "react";
import { palette, radii, spacing } from "../../../theme";
import { timelineDuration, useTimelineStore } from "../../../stores/timeline";
import { hapticTick } from "../../../lib/native";

export default function AudioSheet({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState("Extract audio from the selected video, or pick a file.");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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

  async function handleRecord() {
    // LumoCut-style voiceover: record mic straight onto the audio track.
    if (recording) {
      try {
        recorderRef.current?.stop();
      } catch {
        setRecording(false);
      }
      return;
    }
    try {
      const nav = globalThis.navigator as Navigator & {
        mediaDevices?: { getUserMedia: (c: { audio: boolean }) => Promise<MediaStream> };
      };
      const stream = await nav.mediaDevices?.getUserMedia({ audio: true });
      if (!stream) throw new Error("microphone unavailable");
      const MR =
        (globalThis as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
      if (!MR) throw new Error("recording unsupported on this device");
      const rec = new MR(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void (async () => {
          try {
            const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
            stream.getTracks().forEach((t) => t.stop());
            if (blob.size > 0) {
              await addAudioBlob(blob, `Voiceover ${new Date().toLocaleTimeString()}`);
              setStatus("Voiceover placed on the audio track.");
            } else {
              setStatus("Recording was empty — try again.");
            }
          } catch (err) {
            setStatus(`Voiceover failed: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            setRecording(false);
          }
        })();
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setStatus("Recording… tap again to stop.");
    } catch (err) {
      setStatus(`Mic unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <button
        type="button"
        onClick={() => void handleRecord()}
        disabled={busy}
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: recording ? `2px solid ${palette.danger}` : "none",
          background: recording ? "#1f1215" : palette.text,
          color: recording ? palette.danger : "#09090b",
          fontWeight: 800,
        }}
      >
        {recording ? "● Stop recording" : "● Record voiceover"}
      </button>
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
