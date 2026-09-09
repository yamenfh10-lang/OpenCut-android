// Subtitle export (SRT/VTT) built from text clips on the timeline.
// Pure functions, fully testable headless. Inspired by LumoCut's
// subtitle export (SRT/VTT) — code written from scratch.

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function srtTimestamp(secs: number): string {
  const t = Math.max(0, secs);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
}

function vttTimestamp(secs: number): string {
  return srtTimestamp(secs).replace(",", ".");
}

export function buildSrt(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${srtTimestamp(c.start)} --> ${srtTimestamp(c.end)}\n${c.text}`)
    .join("\n\n")
    .concat(cues.length > 0 ? "\n" : "");
}

export function buildVtt(cues: SubtitleCue[]): string {
  const body = cues
    .map((c) => `${vttTimestamp(c.start)} --> ${vttTimestamp(c.end)}\n${c.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}${cues.length > 0 ? "\n" : ""}`;
}

export interface TextClipLike {
  start: number;
  duration: number;
  text?: string;
  name: string;
}

/** Collect subtitle cues from text-kind clips, sorted by start. */
export function cuesFromTextClips(clips: TextClipLike[]): SubtitleCue[] {
  return clips
    .filter((c) => typeof c.text === "string" && c.text.trim().length > 0)
    .sort((a, b) => a.start - b.start)
    .map((c) => ({
      start: Math.max(0, c.start),
      end: Math.max(0, c.start + Math.max(0.1, c.duration)),
      text: (c.text as string).trim().slice(0, 500),
    }));
}
