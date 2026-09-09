import { useState } from "react";
import { palette, radii, spacing, typeScale } from "../../../theme";
import { timelineDuration, useTimelineStore } from "../../../stores/timeline";
import type { MediaMetadata } from "../../../lib/engine";
import { hapticTick } from "../../../lib/native";
import { saveBlob } from "../../../lib/storage";

interface PickedItem {
  key: string;
  name: string;
  src: string;
  duration: number;
  meta: MediaMetadata;
  file: File;
}

export default function ImportSheet({ onDone }: { onDone: () => void }) {
  const [probe, setProbe] = useState("Pick video or audio from this device.");
  const [items, setItems] = useState<PickedItem[]>([]);
  const addClip = useTimelineStore((s) => s.addClip);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    for (const file of files) {
      try {
        const isImage = file.type.startsWith("image/");
        const { getMetadata } = await import("../../../lib/engine");
        const meta = isImage
          ? { duration: null, width: null, height: null, hasVideo: false, hasAudio: false }
          : await getMetadata(file);
        const src = URL.createObjectURL(file);
        setItems((prev) => [
          ...prev,
          {
            key: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            src,
            // Photos have no duration: default stills to 3s (devhyper-style).
            duration: meta.duration ?? (isImage ? 3 : 5),
            meta,
            file,
          },
        ]);
        setProbe(
          `Picked ${file.name} — duration=${meta.duration ?? (isImage ? "3 (photo)" : "?")}s ` +
            `video=${meta.hasVideo} ${meta.width ?? "?"}x${meta.height ?? "?"}`,
        );
      } catch (err) {
        setProbe(`Probe failed for ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    e.target.value = "";
  }

  async function append(item: PickedItem) {
    const start = timelineDuration(useTimelineStore.getState().clips);
    const isImage = item.file.type.startsWith("image/");
    const trackId = !isImage && item.meta.hasAudio && !item.meta.hasVideo ? "a1" : "v1";
    // Persist bytes offline-first (best effort), keep object URL for playback.
    try {
      await saveBlob(`media_${item.key}`, item.file);
    } catch {
      // storage unavailable — object URL still plays this session
    }
    const clip = addClip({
      trackId,
      name: item.name,
      start,
      duration: Math.max(0.5, item.duration),
      src: item.src,
      ...(isImage ? { kind: "image" as const } : {}),
    });
    useTimelineStore.getState().selectClip(clip.id);
    await hapticTick();
    setProbe(`Appended ${item.name} at ${start.toFixed(1)}s`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <label
        className="oc-spring"
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          border: `1px solid ${palette.borderStrong}`,
          background: palette.text,
          color: "#09090b",
          fontWeight: 800,
          fontSize: typeScale.bodyLarge,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        Pick media
        <input
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          onChange={(e) => void handlePick(e)}
          style={{ display: "none" }}
        />
      </label>
      <p style={{ fontSize: 13, color: palette.muted, margin: 0 }}>{probe}</p>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: palette.faint, margin: 0 }}>
          Nothing picked yet. Files stay on-device.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {items.map((item) => (
            <li
              key={item.key}
              style={{
                display: "flex",
                gap: spacing.sm,
                alignItems: "center",
                border: `1px solid ${palette.border}`,
                borderRadius: radii.md,
                padding: spacing.sm,
                background: palette.card,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 12, color: palette.muted }}>
                  {item.duration.toFixed(1)}s ·{" "}
                  {item.meta.hasVideo ? "video" : ""}
                  {item.meta.hasVideo && item.meta.hasAudio ? " + " : ""}
                  {item.meta.hasAudio ? "audio" : ""}
                  {!item.meta.hasVideo && !item.meta.hasAudio ? "unknown" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void append(item)}
                aria-label={`Append ${item.name} to timeline`}
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
                Add
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
