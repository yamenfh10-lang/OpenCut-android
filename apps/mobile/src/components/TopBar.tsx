import type { CSSProperties } from "react";

interface TopBarProps {
  duration: number;
  clipCount: number;
  saveLabel: string;
  exportLabel: string;
  busy: boolean;
  onSave: () => void;
  onExport: () => void;
}

const btn: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#f4f4f5",
  fontSize: 14,
  fontWeight: 600,
};

export default function TopBar({
  duration,
  clipCount,
  saveLabel,
  exportLabel,
  busy,
  onSave,
  onExport,
}: TopBarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px",
        borderBottom: "1px solid #27272a",
        background: "#0a0a0b",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <strong style={{ fontSize: 17, display: "block", lineHeight: 1.2 }}>OpenCut</strong>
        <span style={{ fontSize: 12, color: "#a1a1aa", fontVariantNumeric: "tabular-nums" }}>
          {duration.toFixed(1)}s · {clipCount} clips
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          aria-label="Save project"
          style={{ ...btn, opacity: busy ? 0.6 : 1 }}
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          aria-label="Export project"
          style={{ ...btn, opacity: busy ? 0.6 : 1, background: "#27272a" }}
        >
          {exportLabel}
        </button>
      </div>
    </header>
  );
}
