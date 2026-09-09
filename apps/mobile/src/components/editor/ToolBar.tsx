import {
  AudioLines,
  Camera,
  Gauge,
  Scissors,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { palette, radii, spacing, typeScale } from "../../theme";

export type ToolId = "import" | "split" | "speed" | "text" | "audio" | "snapshot" | "delete";

interface ToolBarProps {
  activeTool: ToolId | null;
  onTool: (tool: ToolId) => void;
  hasSelection: boolean;
}

const tools: { id: ToolId; label: string; icon: LucideIcon }[] = [
  { id: "import", label: "Import", icon: Upload },
  { id: "split", label: "Split", icon: Scissors },
  { id: "speed", label: "Speed", icon: Gauge },
  { id: "text", label: "Text", icon: Type },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "snapshot", label: "Snapshot", icon: Camera },
  { id: "delete", label: "Delete", icon: Trash2 },
];

export default function ToolBar({ activeTool, onTool, hasSelection }: ToolBarProps) {
  return (
    <nav
      aria-label="Editing tools"
      style={{
        display: "flex",
        gap: spacing.xs,
        overflowX: "auto",
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderTop: `1px solid ${palette.border}`,
        borderBottom: `1px solid ${palette.border}`,
        background: palette.surface,
      }}
      className="oc-lane"
    >
      {tools.map((t) => {
        const Icon = t.icon;
        const needsSelection = t.id === "split" || t.id === "speed" || t.id === "delete";
        const disabled = needsSelection && !hasSelection;
        const active = activeTool === t.id;
        const danger = t.id === "delete";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTool(t.id)}
            disabled={disabled}
            aria-label={t.label}
            aria-pressed={active}
            className="oc-spring"
            style={{
              flex: "1 0 auto",
              minHeight: 48,
              minWidth: 64,
              padding: "6px 8px",
              borderRadius: radii.md,
              border: active
                ? `2px solid ${palette.text}`
                : `1px solid ${danger ? palette.dangerBorder : palette.border}`,
              background: active ? palette.cardElevated : palette.card,
              color: danger ? palette.danger : disabled ? palette.faint : palette.text,
              opacity: disabled ? 0.4 : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: typeScale.caption, fontWeight: 600 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
