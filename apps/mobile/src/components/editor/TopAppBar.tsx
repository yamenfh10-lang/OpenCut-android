import { useState } from "react";
import { ChevronLeft, Redo2, Share, Undo2 } from "lucide-react";
import { palette, radii, spacing } from "../../theme";
import { useTimelineStore } from "../../stores/timeline";

interface TopAppBarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onBack: () => void;
  onExport: () => void;
}

const iconBtn: React.CSSProperties = {
  minHeight: 48,
  minWidth: 48,
  borderRadius: radii.md,
  border: `1px solid ${palette.border}`,
  background: palette.card,
  color: palette.text,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function TopAppBar({
  projectName,
  onProjectNameChange,
  onBack,
  onExport,
}: TopAppBarProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const undo = useTimelineStore((s) => s.undo);
  const redo = useTimelineStore((s) => s.redo);
  const pastLen = useTimelineStore((s) => s.past.length);
  const futureLen = useTimelineStore((s) => s.future.length);
  const canUndo = pastLen > 0;
  const canRedo = futureLen > 0;

  const shown = draft ?? projectName;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderBottom: `1px solid ${palette.border}`,
        background: palette.background,
      }}
    >
      <button type="button" onClick={onBack} aria-label="Back to projects" style={iconBtn}>
        <ChevronLeft size={22} />
      </button>
      <input
        aria-label="Project name"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = (draft ?? projectName).trim();
          setDraft(null);
          if (v && v !== projectName) onProjectNameChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        spellCheck={false}
        maxLength={60}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 48,
          background: "transparent",
          border: "none",
          color: palette.text,
          fontSize: 17,
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      />
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        style={{ ...iconBtn, opacity: canUndo ? 1 : 0.35 }}
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        style={{ ...iconBtn, opacity: canRedo ? 1 : 0.35 }}
      >
        <Redo2 size={18} />
      </button>
      <button
        type="button"
        onClick={onExport}
        aria-label="Export project"
        className="oc-spring"
        style={{
          minHeight: 48,
          padding: "0 16px",
          borderRadius: radii.md,
          border: "none",
          background: palette.text,
          color: "#09090b",
          fontWeight: 800,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Share size={16} strokeWidth={2.5} />
        Export
      </button>
    </header>
  );
}
