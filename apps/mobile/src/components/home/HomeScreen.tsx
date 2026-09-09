import { useEffect, useState } from "react";
import { Clapperboard, Film, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { palette, radii, safe, spacing, typeScale } from "../../theme";
import { hapticHeavy, hapticTick } from "../../lib/native";
import { listProjects, loadProject, saveProject, deleteProject } from "../../lib/storage";
import type { ProjectDoc } from "../../lib/storage";
import { ASPECTS } from "../../lib/presets";
import type { ProjectAspect } from "../../lib/presets";
import { BUILTIN_TEMPLATES } from "../../lib/templates";
import { timelineDuration } from "../../stores/timeline";
import { useTimelineStore } from "../../stores/timeline";

interface HomeScreenProps {
  onOpen: (project: ProjectDoc) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatUpdatedAt(ts: number): string {
  try {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatDuration(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function defaultTracks() {
  return [
    { id: "v1", name: "Video 1", kind: "video" as const },
    { id: "a1", name: "Audio 1", kind: "audio" as const },
  ];
}

function EmptyState() {
  return (
    <div
      style={{
        border: `1px dashed ${palette.borderStrong}`,
        borderRadius: radii.lg,
        padding: spacing.xxl,
        textAlign: "center",
        background: palette.surface,
      }}
    >
      {/* Inline SVG illustration — no emoji, no copied assets. */}
      <svg
        width="96"
        height="72"
        viewBox="0 0 96 72"
        role="img"
        aria-label="Empty projects illustration"
        style={{ margin: "0 auto", display: "block" }}
      >
        <rect x="8" y="20" width="80" height="44" rx="10" fill="#1b1b1f" stroke="#3f3f46" strokeWidth="2" />
        <rect x="8" y="20" width="80" height="12" rx="6" fill="#27272a" />
        <circle cx="48" cy="46" r="10" fill="none" stroke="#a1a1aa" strokeWidth="2" />
        <path d="M45 41l7 5-7 5z" fill="#a1a1aa" />
        <rect x="18" y="8" width="60" height="10" rx="4" fill="#232329" stroke="#3f3f46" strokeWidth="1.5" transform="rotate(-4 48 13)" />
      </svg>
      <p style={{ fontSize: typeScale.title, fontWeight: 700, margin: `${spacing.lg}px 0 4px` }}>
        No drafts yet
      </p>
      <p style={{ fontSize: typeScale.body, color: palette.muted, margin: 0 }}>
        Tap New Project to start cutting. Everything stays offline on this device.
      </p>
    </div>
  );
}

export default function HomeScreen({ onOpen }: HomeScreenProps) {
  const [drafts, setDrafts] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [aspect, setAspect] = useState<ProjectAspect>("16:9");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const loadTimeline = useTimelineStore((s) => s.loadTimeline);

  async function refresh() {
    setLoading(true);
    try {
      const docs = await listProjects();
      setDrafts(docs);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      await hapticTick();
      const id = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const count = drafts.length + 1;
      const doc: ProjectDoc = {
        id,
        name: `Untitled ${count}`,
        updatedAt: Date.now(),
        aspect,
        timeline: { tracks: defaultTracks(), clips: [], markers: [], playhead: 0 },
      };
      try {
        await saveProject(doc);
      } catch {
        // Storage may be unavailable in some web contexts; still open in-memory.
      }
      loadTimeline(doc.timeline.tracks, doc.timeline.clips, 0, doc.timeline.markers ?? []);
      const fresh = await loadProject(id).catch(() => null);
      onOpen(fresh ?? doc);
    } finally {
      setCreating(false);
      void refresh();
    }
  }

  async function handleOpen(doc: ProjectDoc) {
    await hapticTick();
    try {
      const full = await loadProject(doc.id);
      const target = full ?? doc;
      loadTimeline(target.timeline.tracks, target.timeline.clips, target.timeline.playhead, target.timeline.markers ?? []);
      onOpen(target);
    } catch {
      loadTimeline(doc.timeline.tracks, doc.timeline.clips, doc.timeline.playhead, doc.timeline.markers ?? []);
      onOpen(doc);
    }
  }

  async function handleUseTemplate(templateId: string) {
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || creating) return;
    setCreating(true);
    try {
      await hapticTick();
      const id = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const doc: ProjectDoc = {
        id,
        name: tpl.name,
        updatedAt: Date.now(),
        aspect: tpl.aspect,
        timeline: {
          tracks: tpl.tracks.map((t) => ({ ...t })),
          clips: tpl.clips.map((c) => ({ ...c })),
          markers: tpl.markers.map((m) => ({ ...m })),
          playhead: 0,
        },
      };
      try {
        await saveProject(doc);
      } catch {
        // still open in-memory when storage is unavailable
      }
      loadTimeline(doc.timeline.tracks, doc.timeline.clips, 0, doc.timeline.markers ?? []);
      const fresh = await loadProject(id).catch(() => null);
      onOpen(fresh ?? doc);
    } finally {
      setCreating(false);
      void refresh();
    }
  }

  async function handleDelete(id: string) {
    await hapticHeavy();
    try {
      await deleteProject(id);
    } catch {
      // ignore; still drop from local list
    }
    setConfirmDeleteId(null);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: `${safe.top(12)} ${safe.right()} 24px ${safe.left()}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing.lg,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: palette.card,
            border: `1px solid ${palette.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Clapperboard size={22} color={palette.text} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: typeScale.caption, color: palette.muted }}>{greeting()}</div>
          <strong style={{ fontSize: typeScale.largeTitle, letterSpacing: -0.3 }}>OpenCut</strong>
        </div>
      </header>

      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={creating}
        aria-label="Create new project"
        className="oc-spring"
        style={{
          minHeight: 56,
          borderRadius: radii.lg,
          border: `1px solid ${palette.borderStrong}`,
          background: palette.text,
          color: "#09090b",
          fontSize: typeScale.bodyLarge,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: creating ? 0.7 : 1,
        }}
      >
        <Plus size={20} strokeWidth={2.5} />
        {creating ? "Creating…" : "New Project"}
      </button>

      <div>
        <div style={{ fontSize: typeScale.caption, color: palette.muted, marginBottom: 6 }}>
          Canvas
        </div>
        <div style={{ display: "flex", gap: spacing.sm }}>
          {ASPECTS.map((a) => {
            const active = aspect === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAspect(a.id);
                  void hapticTick();
                }}
                aria-pressed={active}
                aria-label={`New projects use ${a.label}`}
                className="oc-spring"
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: radii.md,
                  border: active ? `2px solid ${palette.text}` : `1px solid ${palette.border}`,
                  background: active ? palette.cardElevated : palette.card,
                  color: palette.text,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {a.id}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <strong style={{ fontSize: typeScale.title }}>Templates</strong>
        <span style={{ fontSize: typeScale.caption, color: palette.faint }}>
          Ready to edit
        </span>
      </div>

      <div
        role="list"
        aria-label="Ready-made templates"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}
      >
        {BUILTIN_TEMPLATES.map((t) => (
          <div
            key={t.id}
            role="listitem"
            style={{
              borderRadius: radii.lg,
              overflow: "hidden",
              background: palette.surface,
              border: `1px solid ${palette.border}`,
            }}
          >
            <button
              type="button"
              onClick={() => void handleUseTemplate(t.id)}
              disabled={creating}
              aria-label={`Use template ${t.name}`}
              className="oc-spring"
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                textAlign: "left",
                opacity: creating ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  aspectRatio: "16 / 9",
                  background: palette.card,
                  gap: 6,
                }}
              >
                <LayoutTemplate size={26} color={palette.muted} />
                <span style={{ fontSize: 12, fontWeight: 800, color: palette.muted }}>
                  {t.aspect}
                </span>
              </span>
              <span style={{ display: "block", padding: spacing.sm }}>
                <span style={{ display: "block", fontSize: typeScale.body, fontWeight: 700 }}>
                  {t.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: typeScale.caption,
                    color: palette.muted,
                    marginTop: 2,
                  }}
                >
                  {t.description}
                </span>
              </span>
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <strong style={{ fontSize: typeScale.title }}>Drafts</strong>
        <span style={{ fontSize: typeScale.caption, color: palette.faint }}>
          {loading ? "Loading…" : `${drafts.length} project${drafts.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden
              style={{
                height: 168,
                borderRadius: radii.lg,
                background: palette.surface,
                border: `1px solid ${palette.border}`,
              }}
            />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          role="list"
          aria-label="Project drafts"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}
        >
          {drafts.map((d) => {
            const dur = timelineDuration(d.timeline.clips);
            const firstSrc = d.timeline.clips.find((c) => c.src)?.src;
            const confirming = confirmDeleteId === d.id;
            return (
              <div
                key={d.id}
                role="listitem"
                style={{
                  borderRadius: radii.lg,
                  overflow: "hidden",
                  background: palette.surface,
                  border: `1px solid ${palette.border}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleOpen(d)}
                  aria-label={`Open project ${d.name}`}
                  className="oc-spring"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      aspectRatio: "16 / 9",
                      background: palette.card,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {firstSrc ? (
                      // Draft thumbnail: best-effort <img>, falls back to icon art.
                      <img
                        src={firstSrc}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : null}
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        opacity: firstSrc ? 0 : 1,
                      }}
                    >
                      <Film size={28} color={palette.faint} />
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        right: 6,
                        bottom: 6,
                        fontSize: 11,
                        fontVariantNumeric: "tabular-nums",
                        background: "rgba(0,0,0,0.72)",
                        color: "#fafafa",
                        borderRadius: 6,
                        padding: "2px 6px",
                      }}
                    >
                      {formatDuration(dur)}
                    </span>
                  </span>
                  <span style={{ display: "block", padding: spacing.sm }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: typeScale.body,
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.name}
                    </span>
                    <span style={{ display: "block", fontSize: typeScale.caption, color: palette.muted }}>
                      {formatUpdatedAt(d.updatedAt)} · {d.timeline.clips.length} clip
                      {d.timeline.clips.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
                {confirming ? (
                  <span
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      padding: `0 ${spacing.sm}px ${spacing.sm}px`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void handleDelete(d.id)}
                      aria-label={`Confirm delete ${d.name}`}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        borderRadius: radii.md,
                        border: `1px solid ${palette.dangerBorder}`,
                        background: "#1f1215",
                        color: palette.danger,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      aria-label="Cancel delete"
                      style={{
                        flex: 1,
                        minHeight: 48,
                        borderRadius: radii.md,
                        border: `1px solid ${palette.border}`,
                        background: palette.card,
                        color: palette.text,
                        fontSize: 14,
                      }}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <span style={{ display: "flex", padding: `0 ${spacing.sm}px ${spacing.sm}px` }}>
                    <button
                      type="button"
                      aria-label={`Delete project ${d.name} (long-press also works)`}
                      onClick={() => setConfirmDeleteId(d.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setConfirmDeleteId(d.id);
                      }}
                      style={{
                        minHeight: 40,
                        minWidth: 40,
                        marginLeft: "auto",
                        borderRadius: radii.md,
                        border: "none",
                        background: "transparent",
                        color: palette.faint,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                )}
                {/* Long-press to delete (touch): arm the inline confirm. */}
                <span
                  aria-hidden
                  onTouchStart={(e) => {
                    const t = setTimeout(() => setConfirmDeleteId(d.id), 550);
                    (e.target as HTMLElement).dataset["lpTimer"] = String(t as unknown as number);
                  }}
                  onTouchEnd={(e) => {
                    const raw = (e.target as HTMLElement).dataset["lpTimer"];
                    if (raw) clearTimeout(Number(raw));
                  }}
                  style={{ display: "none" }}
                />
              </div>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 12, color: palette.faint, margin: 0 }}>
        Long-press a draft (or tap the trash icon) to delete. Tap a card to open it.
      </p>
    </div>
  );
}
