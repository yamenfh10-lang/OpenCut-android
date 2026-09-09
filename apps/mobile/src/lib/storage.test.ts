// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __closeStorageForTests,
  deleteProject,
  getBlob,
  listProjects,
  loadProject,
  saveBlob,
  saveProject,
} from "./storage";
import type { ProjectDoc } from "./storage";

function doc(id: string, updatedAt: number, name = id): ProjectDoc {
  return {
    id,
    name,
    updatedAt,
    timeline: {
      tracks: [{ id: "v1", name: "Video 1", kind: "video" }],
      clips: [{ id: "c1", trackId: "v1", name: "A", start: 0, duration: 2 }],
      playhead: 1,
    },
  };
}

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
});

describe("storage", () => {
  it("save/load roundtrips a project", async () => {
    await saveProject(doc("p1", 100));
    const loaded = await loadProject("p1");
    expect(loaded?.id).toBe("p1");
    expect(loaded?.timeline.playhead).toBe(1);
    expect(loaded?.timeline.clips).toHaveLength(1);
    expect(loaded?.timeline.tracks).toHaveLength(1);
  });

  it("loadProject returns null for missing ids", async () => {
    expect(await loadProject("missing")).toBeNull();
  });

  it("listProjects sorts by updatedAt desc and deleteProject removes", async () => {
    await saveProject(doc("old", 10));
    await saveProject(doc("new", 50));
    const listed = await listProjects();
    expect(listed.map((p) => p.id)).toEqual(["new", "old"]);
    await deleteProject("new");
    expect(await loadProject("new")).toBeNull();
    expect((await listProjects()).map((p) => p.id)).toEqual(["old"]);
  });

  it("saveBlob/getBlob roundtrips media bytes", async () => {
    const blob = new Blob(["media-bytes"], { type: "video/mp4" });
    await saveBlob("media1", blob);
    const back = await getBlob("media1");
    expect(back).toBeInstanceOf(Blob);
    expect(await back?.text()).toBe("media-bytes");
  });

  it("getBlob returns null for missing ids", async () => {
    expect(await getBlob("missing")).toBeNull();
  });
});
