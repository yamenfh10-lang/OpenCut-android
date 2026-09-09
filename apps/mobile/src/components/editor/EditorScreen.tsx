import { useRef, useState } from "react";
import type { RefObject } from "react";
import { palette, spacing } from "../../theme";
import { useTimelineStore } from "../../stores/timeline";
import type { ProjectDoc } from "../../lib/storage";
import { loadProject, saveBlob, saveProject } from "../../lib/storage";
import { hapticHeavy, hapticTick, shareOrDownload } from "../../lib/native";
import BottomSheet from "../sheet/BottomSheet";
import TopAppBar from "./TopAppBar";
import PreviewArea from "./PreviewArea";
import ToolBar from "./ToolBar";
import type { ToolId } from "./ToolBar";
import TimelineView from "./TimelineView";
import ImportSheet from "./sheets/ImportSheet";
import SpeedSheet from "./sheets/SpeedSheet";
import AdjustSheet from "./sheets/AdjustSheet";
import MarkersSheet from "./sheets/MarkersSheet";
import TextSheet from "./sheets/TextSheet";
import AudioSheet from "./sheets/AudioSheet";
import ExportSheet from "./sheets/ExportSheet";

interface EditorScreenProps {
  projectId: string;
  projectName: string;
  projectAspect: string;
  onProjectNameChange: (name: string) => void;
  onBack: () => void;
  onEnterFullscreen: () => void;
}

type SheetId = "import" | "speed" | "adjust" | "markers" | "text" | "audio" | "export" | null;

const sheetTitles: Record<Exclude<SheetId, null>, string> = {
  import: "Import media",
  speed: "Speed",
  adjust: "Adjust clip",
  markers: "Markers",
  text: "Add text",
  audio: "Audio",
  export: "Export",
};

export default function EditorScreen({
  projectId,
  projectName,
  projectAspect,
  onProjectNameChange,
  onBack,
  onEnterFullscreen,
}: EditorScreenProps) {
  const [sheet, setSheet] = useState<SheetId>(null);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState("Tap Import to add your first clip.");
  const videoRef: RefObject<HTMLVideoElement | null> = useRef<HTMLVideoElement | null>(null);

  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const hasSelection = selectedClipId !== null;

  async function persistQuietly() {
    try {
      const st = useTimelineStore.getState();
      const existing = await loadExisting(projectId);
      await saveProject({
        id: projectId,
        name: projectName,
        updatedAt: Date.now(),
        timeline: { tracks: st.tracks, clips: st.clips, markers: st.markers, playhead: st.playhead },
        ...(existing ? {} : {}),
      });
    } catch {
      // offline-first: editor state still lives in zustand
    }
  }

  async function loadExisting(id: string): Promise<ProjectDoc | null> {
    try {
      return await loadProject(id);
    } catch {
      return null;
    }
  }

  async function handleTool(tool: ToolId) {
    const st = useTimelineStore.getState();
    switch (tool) {
      case "import":
        setActiveTool("import");
        setSheet("import");
        await hapticTick();
        break;
      case "speed":
        if (!st.selectedClipId) break;
        setActiveTool("speed");
        setSheet("speed");
        await hapticTick();
        break;
      case "adjust":
        if (!st.selectedClipId) break;
        setActiveTool("adjust");
        setSheet("adjust");
        await hapticTick();
        break;
      case "markers":
        setActiveTool("markers");
        setSheet("markers");
        await hapticTick();
        break;
      case "text":
        setActiveTool("text");
        setSheet("text");
        await hapticTick();
        break;
      case "audio":
        setActiveTool("audio");
        setSheet("audio");
        await hapticTick();
        break;
      case "split": {
        const id = st.selectedClipId;
        if (!id) break;
        const created = st.splitClip(id, st.playhead);
        if (!created) {
          setStatus("Move the playhead inside the selected clip to split.");
        } else {
          setStatus(`Split at ${st.playhead.toFixed(1)}s.`);
          await hapticHeavy();
          void persistQuietly();
        }
        break;
      }
      case "snapshot":
        await handleSnapshot();
        break;
      case "delete": {
        const id = st.selectedClipId;
        if (!id) break;
        st.removeClip(id);
        setStatus("Clip deleted — undo is available up top.");
        await hapticHeavy();
        void persistQuietly();
        break;
      }
    }
  }

  async function handleSnapshot() {
    const v = videoRef.current;
    if (!v || !v.src) {
      setStatus("Play a clip first, then take a snapshot.");
      return;
    }
    try {
      const { captureVideoFrame } = await import("../../lib/engine");
      const blob = await captureVideoFrame(v, "snapshot");
      const key = `snapshot_${Date.now()}`;
      try {
        await saveBlob(key, blob);
      } catch {
        // still share even if persistence failed
      }
      const how = await shareOrDownload(blob, `opencut-snapshot-${Date.now()}.png`);
      setStatus(
        how === "shared" ? "Snapshot saved + shared." : "Snapshot saved + downloaded.",
      );
      await hapticTick();
    } catch (err) {
      setStatus(`Snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function closeSheet() {
    setSheet(null);
    setActiveTool(null);
    void persistQuietly();
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: palette.background,
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <TopAppBar
        projectName={projectName}
        onProjectNameChange={onProjectNameChange}
        onBack={onBack}
        onExport={() => {
          setActiveTool(null);
          setSheet("export");
          void hapticTick();
        }}
      />
      <div style={{ flexShrink: 0 }}>
        <PreviewArea videoRef={videoRef} onEnterFullscreen={onEnterFullscreen} />
      </div>
      <ToolBar activeTool={activeTool} onTool={(t) => void handleTool(t)} hasSelection={hasSelection} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <TimelineView zoom={zoom} onZoomChange={setZoom} />
        <p role="status" style={{ fontSize: 12, color: palette.faint, margin: `0 ${spacing.md}px ${spacing.md}px` }}>
          {status}
        </p>
      </div>

      <BottomSheet
        open={sheet !== null}
        onClose={closeSheet}
        title={sheet ? sheetTitles[sheet] : ""}
      >
        {sheet === "import" ? <ImportSheet onDone={closeSheet} /> : null}
        {sheet === "speed" ? <SpeedSheet /> : null}
        {sheet === "adjust" ? <AdjustSheet onDone={closeSheet} /> : null}
        {sheet === "markers" ? <MarkersSheet onDone={closeSheet} /> : null}
        {sheet === "text" ? <TextSheet onDone={closeSheet} /> : null}
        {sheet === "audio" ? <AudioSheet onDone={closeSheet} /> : null}
        {sheet === "export" ? <ExportSheet aspect={projectAspect} onDone={closeSheet} /> : null}
      </BottomSheet>
    </div>
  );
}
