// Tiny static module for export presets.
// Kept separate from engine.ts (which is lazy-loaded) so importing a
// resolution preset never pulls mediabunny into the main bundle.

export type ExportResolution = "720p" | "1080p" | "4K";

export function resolutionToSize(res: ExportResolution): {
  width: number;
  height: number;
} {
  switch (res) {
    case "720p":
      return { width: 1280, height: 720 };
    case "1080p":
      return { width: 1920, height: 1080 };
    case "4K":
      return { width: 3840, height: 2160 };
  }
}
