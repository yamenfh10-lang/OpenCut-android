import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { MediaMetadata } from "../lib/engine";
import { timelineDuration, useTimelineStore } from "../stores/timeline";

interface LibraryItem {
  key: string;
  name: string;
  src: string;
  duration: number;
  meta: MediaMetadata;
}

const importBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#f4f4f5",
  fontSize: 15,
  display: "block",
  textAlign: "center",
  cursor: "pointer",
};

const appendBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #52525b",
  background: "#27272a",
  color: "#f4f4f5",
  fontSize: 14,
  fontWeight: 600,
  flexShrink: 0,
};

function Thumb({ src, label }: { src: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    (async () => {
      try {
        const { getThumbnail } = await import("../lib/engine");
        const blob = await getThumbnail(src, 0);
        if (!alive || !blob) return;
        obj = URL.createObjectURL(blob);
        setUrl(obj);
      } catch {
        // Placeholder thumbnail stays when extraction is unavailable.
      }
    })();
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [src]);

  if (url) {
    return (
      <img
        src={url}
        alt={label}
        style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", background: "#000", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: 56,
        height: 56,
        borderRadius: 8,
        background: "#27272a",
        color: "#71717a",
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      No thumb
    </div>
  );
}

export default function Browser() {
  const [probe, setProbe] = useState<string>("No media probed yet.");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const addClip = useTimelineStore((s) => s.addClip);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    for (const file of files) {
      try {
        const { getMetadata } = await import("../lib/engine");
        const meta = await getMetadata(file);
        const src = URL.createObjectURL(file);
        const item: LibraryItem = {
          key: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          src,
          duration: meta.duration ?? 5,
          meta,
        };
        setLibrary((prev) => [...prev, item]);
        setProbe(
          `Picked ${file.name} — duration=${meta.duration ?? "?"}s ` +
            `video=${meta.hasVideo} ${meta.width ?? "?"}x${meta.height ?? "?"}`,
        );
      } catch (err) {
        setProbe(`Probe failed for ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    e.target.value = "";
  }

  function append(item: LibraryItem) {
    const start = timelineDuration(useTimelineStore.getState().clips);
    const trackId = item.meta.hasAudio && !item.meta.hasVideo ? "a1" : "v1";
    const clip = addClip({
      trackId,
      name: item.name,
      start,
      duration: Math.max(0.1, item.duration),
      src: item.src,
    });
    useTimelineStore.getState().selectClip(clip.id);
    setProbe(`Appended ${item.name} at ${start.toFixed(1)}s → ${trackId}`);
  }

  return (
    <div>
      <label style={importBtn}>
        Import video / audio
        <input type="file" accept="video/*,audio/*" multiple onChange={(e) => void handlePick(e)} style={{ display: "none" }} />
      </label>
      <p style={{ fontSize: 13, color: "#a1a1aa", margin: "8px 0" }}>{probe}</p>
      {library.length === 0 ? (
        <p style={{ fontSize: 13, color: "#52525b" }}>No imports yet. Pick a file above, then tap Append.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {library.map((item) => (
            <li
              key={item.key}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                border: "1px solid #27272a",
                borderRadius: 12,
                padding: 8,
                background: "#111113",
              }}
            >
              <Thumb src={item.src} label={item.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 12, color: "#a1a1aa" }}>
                  {item.duration.toFixed(1)}s · {item.meta.hasVideo ? "video" : ""}{item.meta.hasVideo && item.meta.hasAudio ? " + " : ""}{item.meta.hasAudio ? "audio" : ""}
                  {!item.meta.hasVideo && !item.meta.hasAudio ? "unknown" : ""}
                </div>
              </div>
              <button type="button" onClick={() => append(item)} aria-label={`Append ${item.name} to timeline`} style={appendBtn}>
                Append
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
