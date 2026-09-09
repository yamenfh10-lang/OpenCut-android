import { useState } from "react";
import { palette, radii, spacing, typeScale } from "../../../theme";
import { resolutionToSize } from "../../../lib/exportPresets";
import type { ExportResolution } from "../../../lib/exportPresets";
import { useTimelineStore } from "../../../stores/timeline";
import { hapticNotify, hapticTick, shareOrDownload } from "../../../lib/native";

type Format = "mp4" | "webm";

const resolutions: ExportResolution[] = ["720p", "1080p", "4K"];
const fpsOptions = [30, 60];
const formats: Format[] = ["mp4", "webm"];

export default function ExportSheet({ aspect, onDone }: { aspect: string; onDone: () => void }) {
  const [resolution, setResolution] = useState<ExportResolution>("1080p");
  const [fps, setFps] = useState(30);
  const [format, setFormat] = useState<Format>("mp4");
  const [audioOnly, setAudioOnly] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState("Choose quality, then export.");
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    setProgress(0);
    setStatus("Rendering…");
    try {
      const st = useTimelineStore.getState();
      let { width, height } = resolutionToSize(resolution);
      if (aspect === "9:16") [width, height] = [height, width];
      else if (aspect === "1:1") width = height = Math.min(width, height);
      const { exportProject } = await import("../../../lib/engine");
      const blob = await exportProject({
        clips: st.clips,
        markers: st.markers,
        aspect,
        format: audioOnly ? "mp3" : format,
        width,
        height,
        fps,
        audioOnly,
        onProgress: (p) => setProgress(p),
      });
      const ext = blob.type === "application/json" ? "json" : audioOnly ? "mp3" : format;
      const fileName = `opencut-${resolution}-${fps}fps.${ext}`;
      setStatus("Sharing…");
      const how = await shareOrDownload(blob, fileName);
      setStatus(how === "shared" ? "Export shared via system sheet." : "Export downloaded.");
      await hapticNotify();
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function chip<T extends string | number>(opts: {
    value: T;
    current: T;
    label: string;
    onPick: (v: T) => void;
  }) {
    const active = opts.value === opts.current;
    return (
      <button
        key={String(opts.value)}
        type="button"
        onClick={() => {
          opts.onPick(opts.value);
          void hapticTick();
        }}
        aria-pressed={active}
        aria-label={opts.label}
        style={{
          flex: "1 0 auto",
          minHeight: 48,
          padding: "0 14px",
          borderRadius: radii.md,
          border: active ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
          background: active ? palette.cardElevated : palette.card,
          color: palette.text,
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {opts.label}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <div>
        <div style={{ fontSize: 13, color: palette.muted, marginBottom: 6 }}>
          Resolution · canvas {aspect}
        </div>
        <div style={{ display: "flex", gap: spacing.sm }}>
          {resolutions.map((r) =>
            chip({ value: r, current: resolution, label: r, onPick: setResolution }),
          )}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, color: palette.muted, marginBottom: 6 }}>Frame rate</div>
        <div style={{ display: "flex", gap: spacing.sm }}>
          {fpsOptions.map((f) =>
            chip({ value: f, current: fps, label: `${f} fps`, onPick: setFps }),
          )}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, color: palette.muted, marginBottom: 6 }}>Format</div>
        <div style={{ display: "flex", gap: spacing.sm }}>
          {formats.map((f) =>
            chip({
              value: f,
              current: format,
              label: f.toUpperCase(),
              onPick: (v) => {
                setFormat(v);
                if (v === "mp4" || v === "webm") setAudioOnly(false);
              },
            }),
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={audioOnly}
        onClick={() => {
          setAudioOnly((v) => !v);
          void hapticTick();
        }}
        style={{
          minHeight: 48,
          borderRadius: radii.md,
          border: audioOnly ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
          background: palette.card,
          color: palette.text,
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
        }}
      >
        <span>Audio-only MP3</span>
        <span style={{ fontSize: typeScale.caption, color: palette.muted }}>
          {audioOnly ? "ON" : "OFF"}
        </span>
      </button>

      {progress !== null ? (
        <div aria-label="Export progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ height: 8, borderRadius: 999, background: palette.card, overflow: "hidden" }}>
            <div
              className="oc-spring"
              style={{
                height: "100%",
                width: `${Math.round(progress * 100)}%`,
                background: palette.text,
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: palette.muted, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(progress * 100)}%
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={busy}
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: "none",
          background: palette.text,
          color: "#09090b",
          fontWeight: 800,
          fontSize: 15,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Exporting…" : "Export"}
      </button>
      <p style={{ fontSize: 12, color: palette.muted, margin: 0 }} role="status">
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
        Close
      </button>
    </div>
  );
}
