import { useEffect, useState } from "react";
import HomeScreen from "./components/home/HomeScreen";
import EditorScreen from "./components/editor/EditorScreen";
import FullscreenPreview from "./components/editor/FullscreenPreview";
import { palette } from "./theme";
import { setupDarkStatusBar } from "./lib/native";
import { saveProject } from "./lib/storage";
import type { ProjectDoc } from "./lib/storage";
import { useTimelineStore } from "./stores/timeline";

type Screen = "home" | "editor";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled");
  const [fullscreen, setFullscreen] = useState(false);
  // Bump to refresh the home draft list after returning from the editor.
  const [homeNonce, setHomeNonce] = useState(0);

  useEffect(() => {
    void setupDarkStatusBar();
  }, []);

  function openProject(doc: ProjectDoc) {
    setProjectId(doc.id);
    setProjectName(doc.name);
    setScreen("editor");
    setFullscreen(false);
  }

  async function handleBack() {
    // Persist before leaving the editor (offline-first, best effort).
    if (screen === "editor" && projectId) {
      try {
        const st = useTimelineStore.getState();
        await saveProject({
          id: projectId,
          name: projectName,
          updatedAt: Date.now(),
          timeline: { tracks: st.tracks, clips: st.clips, playhead: st.playhead },
        });
      } catch {
        // keep in-memory state; home will show last persisted list
      }
    }
    setFullscreen(false);
    setScreen("home");
    setHomeNonce((n) => n + 1);
  }

  async function handleRename(name: string) {
    setProjectName(name);
    if (projectId) {
      try {
        const st = useTimelineStore.getState();
        await saveProject({
          id: projectId,
          name,
          updatedAt: Date.now(),
          timeline: { tracks: st.tracks, clips: st.clips, playhead: st.playhead },
        });
      } catch {
        // ignore; rename still reflected in the app bar
      }
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: palette.background,
        color: palette.text,
        fontFamily: 'system-ui, -apple-system, "SF Pro Text", sans-serif',
        overscrollBehavior: "none",
      }}
    >
      {screen === "home" ? (
        <HomeScreen key={homeNonce} onOpen={openProject} />
      ) : projectId ? (
        <EditorScreen
          projectId={projectId}
          projectName={projectName}
          onProjectNameChange={(n) => void handleRename(n)}
          onBack={() => void handleBack()}
          onEnterFullscreen={() => setFullscreen(true)}
        />
      ) : null}
      {fullscreen && screen === "editor" ? (
        <FullscreenPreview onClose={() => setFullscreen(false)} />
      ) : null}
    </div>
  );
}
