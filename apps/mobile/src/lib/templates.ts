// Built-in ready-made project templates (CapCut-style: open and edit).
// All templates are offline-first: text cards + markers only, no media
// files needed. Written from scratch for OpenCut mobile.
import type { TimelineClip, TimelineMarker, TimelineTrack } from "../stores/timeline";
import type { ProjectAspect } from "./presets";

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  aspect: ProjectAspect;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers: TimelineMarker[];
}

function tracks(): TimelineTrack[] {
  return [
    { id: "v1", name: "Video 1", kind: "video" },
    { id: "a1", name: "Audio 1", kind: "audio" },
  ];
}

function textCard(
  id: string,
  text: string,
  start: number,
  duration: number,
  extra?: Partial<TimelineClip>,
): TimelineClip {
  return {
    id,
    trackId: "v1",
    name: `TEXT: ${text.slice(0, 32)}`,
    start,
    duration,
    kind: "text",
    text,
    ...extra,
  };
}

function marker(id: string, time: number, label: string, color: string): TimelineMarker {
  return { id, time, label, color };
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "shorts-opener",
    name: "Shorts Opener",
    description: "9:16 hook title + subtitle cards with beat markers. Import your clip after the titles.",
    aspect: "9:16",
    tracks: tracks(),
    clips: [
      textCard("tpl1_hook", "STOP SCROLLING", 0, 1.5, {
        colorLabel: "yellow",
        filter: { brightness: 1.05, contrast: 1.2, saturation: 1.3, grayscale: 0, sepia: 0, invert: 0 },
      }),
      textCard("tpl1_sub", "watch till the end", 1.5, 2, { colorLabel: "blue" }),
    ],
    markers: [
      marker("tpl1_m1", 0, "Hook", "red"),
      marker("tpl1_m2", 1.5, "Beat", "yellow"),
      marker("tpl1_m3", 3.5, "Payoff", "green"),
    ],
  },
  {
    id: "lower-third",
    name: "Lower Third",
    description: "16:9 name + role cards for interviews and talking-head videos.",
    aspect: "16:9",
    tracks: tracks(),
    clips: [
      textCard("tpl2_name", "YOUR NAME", 0, 4, { colorLabel: "blue" }),
      textCard("tpl2_role", "Role / Title", 0.6, 3.4, { colorLabel: "none" }),
    ],
    markers: [marker("tpl2_m1", 0, "Intro", "blue")],
  },
  {
    id: "slideshow",
    name: "Mini Slideshow",
    description: "1:1 three-card slideshow with graded looks. Replace cards with your photos.",
    aspect: "1:1",
    tracks: tracks(),
    clips: [
      textCard("tpl3_a", "CHAPTER ONE", 0, 2, {
        colorLabel: "mauve",
        filter: { brightness: 1, contrast: 1.15, saturation: 1.4, grayscale: 0, sepia: 0, invert: 0 },
      }),
      textCard("tpl3_b", "CHAPTER TWO", 2, 2, {
        colorLabel: "peach",
        filter: { brightness: 1.05, contrast: 0.9, saturation: 0.75, grayscale: 0, sepia: 0.4, invert: 0 },
      }),
      textCard("tpl3_c", "THE END", 4, 2, {
        colorLabel: "green",
        filter: { brightness: 0.95, contrast: 1.3, saturation: 0.2, grayscale: 0.6, sepia: 0, invert: 0 },
      }),
    ],
    markers: [
      marker("tpl3_m1", 0, "Ch 1", "purple"),
      marker("tpl3_m2", 2, "Ch 2", "purple"),
      marker("tpl3_m3", 4, "End", "green"),
    ],
  },
  {
    id: "end-screen",
    name: "End Screen CTA",
    description: "16:9 thanks + subscribe cards to close any video.",
    aspect: "16:9",
    tracks: tracks(),
    clips: [
      textCard("tpl4_thanks", "THANKS FOR WATCHING", 0, 2.5, { colorLabel: "green" }),
      textCard("tpl4_sub", "SUBSCRIBE", 2.5, 2.5, {
        colorLabel: "red",
        filter: { brightness: 1, contrast: 1.25, saturation: 1.5, grayscale: 0, sepia: 0, invert: 0 },
      }),
    ],
    markers: [marker("tpl4_m1", 2.5, "CTA", "red")],
  },
];

export function getTemplate(id: string): BuiltinTemplate | null {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) ?? null;
}
