import { useEffect, useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { palette, radii, spacing, spring } from "../../theme";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Fractional snap points (0-1 of viewport height). First is default. */
  snapPoints?: number[];
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  snapPoints = [0.55, 0.88],
}: BottomSheetProps) {
  const [snapIndex, setSnapIndex] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startSnapHeight = useRef(0);

  useEffect(() => {
    if (open) {
      setSnapIndex(0);
      setDragY(0);
      setDragging(false);
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const snap = snapPoints[Math.min(snapIndex, snapPoints.length - 1)] ?? 0.55;
  const sheetHeightDvh = Math.round(snap * 100);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    startY.current = t.clientY;
    startSnapHeight.current = dragY;
    setDragging(true);
  }

  function onTouchMove(e: TouchEvent) {
    if (!dragging) return;
    const t = e.touches[0];
    if (!t) return;
    const delta = t.clientY - startY.current;
    // Only allow downward drag to dismiss / snap down; upward snaps up.
    setDragY(startSnapHeight.current + delta);
  }

  function onTouchEnd() {
    if (!dragging) return;
    setDragging(false);
    if (dragY > 110) {
      // Swipe-down to close.
      setDragY(0);
      onClose();
      return;
    }
    if (dragY < -70 && snapIndex < snapPoints.length - 1) {
      setSnapIndex((i) => Math.min(i + 1, snapPoints.length - 1));
    } else if (dragY > 40 && snapIndex > 0) {
      setSnapIndex((i) => Math.max(i - 1, 0));
    }
    setDragY(0);
  }

  return (
    <div
      role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 60 }}
      className="oc-fade-enter"
    >
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: palette.scrim,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={dragging ? undefined : "oc-spring"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: `${sheetHeightDvh}dvh`,
          minHeight: "32dvh",
          display: "flex",
          flexDirection: "column",
          background: palette.surface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          borderTop: `1px solid ${palette.border}`,
          transform: dragging ? `translateY(${Math.max(0, dragY)}px)` : "translateY(0)",
          transitionDuration: dragging ? "0ms" : `${spring.baseMs}ms`,
          overflow: "hidden",
          paddingBottom: `env(safe-area-inset-bottom, 0px)`,
        }}
      >
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            padding: `${spacing.sm}px ${spacing.lg}px ${spacing.xs}px`,
            touchAction: "pan-y",
            cursor: "grab",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 40,
              height: 5,
              borderRadius: radii.full,
              background: palette.borderStrong,
              margin: "0 auto",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <strong style={{ fontSize: 17 }}>{title}</strong>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {snapPoints.length > 1 ? (
                <div style={{ display: "flex", gap: 4 }} aria-hidden>
                  {snapPoints.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: radii.full,
                        background:
                          i === snapIndex ? palette.text : palette.borderStrong,
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title}`}
                style={{
                  minHeight: 48,
                  minWidth: 48,
                  borderRadius: radii.full,
                  border: `1px solid ${palette.border}`,
                  background: palette.card,
                  color: palette.text,
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: `0 ${spacing.lg}px ${spacing.xl}px` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
