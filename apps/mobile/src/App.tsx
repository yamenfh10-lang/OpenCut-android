import { useState } from "react";
import type { CSSProperties } from "react";
import Browser from "./components/Browser";
import Inspector from "./components/Inspector";
import Preview from "./components/Preview";
import Timeline from "./components/Timeline";
import TopBar from "./components/TopBar";
import { timelineDuration, useTimelineStore } from "./stores/timeline";

type Tab = "browser" | "inspector";

const shell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  background: "#0a0a0b",
  color: "#f4f4f5",
  fontFamily: "system-ui, -apple-system, sans-serif",
  overscrollBehavior: "none",
};

const tabBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#f4f4f5",
  fontSize: 15,
  flex: 1,
  textTransform: "capitalize",
};

function blobToBase64Data(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("base64 encode failed"));
    r.readAsDataURL(blob);
  });
}

export default function App() {
  const [tab, setTab] = useState<Tab>("browser");
  const clips = useTimelineStore((s) => s.clips);
  const duration = timelineDuration(clips);

  const [saveLabel, setSaveLabel] = useState("Save");
  const [exportLabel, setExportLabel] = useState("Export");
  const [status, setStatus] = useState("Import a clip to begin.");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    setSaveLabel("Saving…");
    try {
      const st = useTimelineStore.getState();
      const fallbackSnapshot = {
        tracks: st.tracks,
        clips: st.clips,
        playhead: st.playhead,
        selectedClipId: st.selectedClipId,
        savedAt: new Date().toISOString(),
      };
      let via = "local";
      try {
        // Dynamic import keeps ../lib/storage out of the initial bundle.
        const mod = await import("./lib/storage");
        await mod.saveProject({
          id: "mobile-project",
          name: "Mobile project",
          updatedAt: Date.now(),
          timeline: { tracks: st.tracks, clips: st.clips, playhead: st.playhead },
        });
        via = "storage";
      } catch {
        localStorage.setItem("opencut-mobile-project", JSON.stringify(fallbackSnapshot));
      }
      setStatus(`Saved ${st.clips.length} clip(s) via ${via}.`);
      setSaveLabel("Save");
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setSaveLabel("Retry");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    setExportLabel("Exporting…");
    try {
      const st = useTimelineStore.getState();
      // Dynamic import keeps the engine (and mediabunny) out of the initial bundle.
      const { exportProject } = await import("./lib/engine");
      const blob = await exportProject({
        clips: st.clips,
        format: "mp4",
        onProgress: (p: number) => setExportLabel(`Exporting… ${Math.round(p * 100)}%`),
      });
      const fileName = blob.type === "application/json" ? "opencut-export.json" : "opencut-export.mp4";

      let shared = false;
      try {
        const [{ Share }, { Directory, Filesystem }] = await Promise.all([
          import("@capacitor/share"),
          import("@capacitor/filesystem"),
        ]);
        const data = await blobToBase64Data(blob);
        const written = await Filesystem.writeFile({
          path: fileName,
          data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: "OpenCut export",
          text: "OpenCut timeline export",
          url: written.uri,
          dialogTitle: "Share export",
        });
        shared = true;
      } catch {
        shared = false;
      }

      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      setStatus(shared ? "Export shared via system sheet." : "Export downloaded in browser.");
      setExportLabel("Export");
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
      setExportLabel("Retry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={shell}>
      <TopBar
        duration={duration}
        clipCount={clips.length}
        saveLabel={saveLabel}
        exportLabel={exportLabel}
        busy={busy}
        onSave={() => void handleSave()}
        onExport={() => void handleExport()}
      />
      <Preview />
      <div style={{ display: "flex", gap: 8, padding: 8 }}>
        {(["browser", "inspector"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            style={{ ...tabBtn, background: tab === t ? "#3f3f46" : "#18181b" }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 8px" }}>
        {tab === "browser" ? <Browser /> : <Inspector />}
        <p style={{ fontSize: 12, color: "#71717a", margin: "8px 0 0" }} role="status">
          {status}
        </p>
      </div>
      <Timeline />
    </div>
  );
}
