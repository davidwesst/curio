import { describe, expect, it, vi } from "vitest";
import { Collection } from "../src/index";

describe("Collection", () => {
  it("adds a work and records a change log entry", () => {
    const ids = ["work-1", "log-1"];
    const collection = new Collection({
      now: () => 1_700_000_000_000,
      idFactory: () => ids.shift() ?? "fallback",
    });

    const work = collection.addWork({
      displayTitle: "Chrono Trigger",
      mediaTypeKey: "media.game",
    });

    expect(work).toEqual({
      id: "work-1",
      displayTitle: "Chrono Trigger",
      mediaTypeKey: "media.game",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });
    expect(collection.getWork("work-1")).toEqual(work);
    expect(collection.listWorks()).toEqual([work]);
    expect(collection.getChangeLog()).toEqual([
      {
        id: "log-1",
        timestamp: 1_700_000_000_000,
        opType: "work.create",
        payloadJson: { workId: "work-1" },
      },
    ]);
  });

  it("supports explicit identifiers and timestamps", () => {
    let idCalls = 0;
    const collection = new Collection({
      now: () => 1_700_000_000_500,
      idFactory: () => {
        idCalls += 1;
        return "log-2";
      },
    });

    const work = collection.addWork({
      id: "work-custom",
      displayTitle: "Final Fantasy VI",
      mediaTypeKey: "media.game",
      createdAt: 1_600_000_000_000,
      updatedAt: 1_600_000_100_000,
    });

    expect(work).toEqual({
      id: "work-custom",
      displayTitle: "Final Fantasy VI",
      mediaTypeKey: "media.game",
      createdAt: 1_600_000_000_000,
      updatedAt: 1_600_000_100_000,
    });
    expect(idCalls).toBe(1);
  });

  it("removes a work and records a change log entry", () => {
    const ids = ["work-2", "log-3", "log-4"];
    const collection = new Collection({
      now: () => 1_700_000_001_000,
      idFactory: () => ids.shift() ?? "fallback",
    });

    const work = collection.addWork({
      displayTitle: "Super Metroid",
      mediaTypeKey: "media.game",
    });

    const removed = collection.removeWork(work.id);

    expect(removed).toEqual(work);
    expect(collection.listWorks()).toEqual([]);
    expect(collection.getChangeLog()).toEqual([
      {
        id: "log-3",
        timestamp: 1_700_000_001_000,
        opType: "work.create",
        payloadJson: { workId: "work-2" },
      },
      {
        id: "log-4",
        timestamp: 1_700_000_001_000,
        opType: "work.remove",
        payloadJson: { workId: "work-2" },
      },
    ]);
  });

  it("rejects duplicate or missing work identifiers", () => {
    const collection = new Collection({
      now: () => 1_700_000_002_000,
      idFactory: () => "work-3",
    });

    collection.addWork({
      id: "work-dup",
      displayTitle: "EarthBound",
      mediaTypeKey: "media.game",
    });

    expect(() =>
      collection.addWork({
        id: "work-dup",
        displayTitle: "EarthBound",
        mediaTypeKey: "media.game",
      }),
    ).toThrow("Work with id work-dup already exists.");

    expect(() => collection.removeWork("missing")).toThrow(
      "Work with id missing does not exist.",
    );
  });

  it("validates required fields", () => {
    const collection = new Collection({
      now: () => 1_700_000_003_000,
      idFactory: () => "work-4",
    });

    expect(() =>
      collection.addWork({
        displayTitle: "  ",
        mediaTypeKey: "media.game",
      }),
    ).toThrow("Work display title is required.");

    expect(() =>
      collection.addWork({
        displayTitle: "Mega Man X",
        mediaTypeKey: " ",
      }),
    ).toThrow("Work media type key is required.");
  });

  it("falls back to generated identifiers when crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    try {
      const collection = new Collection({ now: () => 1_700_000_004_000 });
      const work = collection.addWork({
        displayTitle: "Metroid Prime",
        mediaTypeKey: "media.game",
      });

      expect(work.id).toMatch(/^curio_/);
      expect(collection.getChangeLog()[0]?.id).toMatch(/^curio_/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
