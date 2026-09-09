// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { __closeStorageForTests } from "./lib/storage";
import { useTimelineStore } from "./stores/timeline";

async function clearDatabase(): Promise<void> {
  __closeStorageForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("opencut-mobile");
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("deleteDatabase failed"));
    request.onblocked = () => resolve();
  });
  __closeStorageForTests();
}

beforeEach(async () => {
  await clearDatabase();
  useTimelineStore.getState().loadTimeline(
    [
      { id: "v1", name: "Video 1", kind: "video" },
      { id: "a1", name: "Audio 1", kind: "audio" },
    ],
    [],
    0,
  );
});

describe("mobile screens", () => {
  it("home renders greeting, New Project, and empty state", async () => {
    render(<App />);
    expect(screen.getByText("OpenCut")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /create new project/i }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/no drafts yet/i)).toBeTruthy();
    });
  });

  it("home lists a saved draft with duration metadata", async () => {
    const { saveProject } = await import("./lib/storage");
    await saveProject({
      id: "draft1",
      name: "Beach cut",
      updatedAt: Date.now(),
      timeline: {
        tracks: [{ id: "v1", name: "Video 1", kind: "video" }],
        clips: [{ id: "c1", trackId: "v1", name: "A", start: 0, duration: 65 }],
        playhead: 0,
      },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Beach cut")).toBeTruthy();
    });
    // 65s formats as 1:05 on the draft card.
    expect(screen.getByText("1:05")).toBeTruthy();
  });
});
