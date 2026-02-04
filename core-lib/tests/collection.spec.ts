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
        payloadJson: { work },
      },
    ]);
  });

  it("trims input fields with zod parsing", () => {
    const ids = ["work-2", "log-2"];
    const collection = new Collection({
      now: () => 1_700_000_000_500,
      idFactory: () => ids.shift() ?? "fallback",
    });

    const work = collection.addWork({
      displayTitle: "  Final Fantasy VI ",
      mediaTypeKey: "  media.game ",
    });

    expect(work.displayTitle).toBe("Final Fantasy VI");
    expect(work.mediaTypeKey).toBe("media.game");
  });

  it("supports explicit identifiers and timestamps", () => {
    let idCalls = 0;
    const collection = new Collection({
      now: () => 1_700_000_000_500,
      idFactory: () => {
        idCalls += 1;
        return "log-3";
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
    const ids = ["work-3", "log-4", "log-5"];
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
        id: "log-4",
        timestamp: 1_700_000_001_000,
        opType: "work.create",
        payloadJson: { work },
      },
      {
        id: "log-5",
        timestamp: 1_700_000_001_000,
        opType: "work.remove",
        payloadJson: { workId: "work-3", work },
      },
    ]);
  });

  it("returns copies to avoid external mutation", () => {
    const ids = ["work-4", "log-6"];
    const collection = new Collection({
      now: () => 1_700_000_002_000,
      idFactory: () => ids.shift() ?? "fallback",
    });

    const work = collection.addWork({
      displayTitle: "EarthBound",
      mediaTypeKey: "media.game",
    });

    work.displayTitle = "Changed";

    expect(collection.getWork("work-4")).toEqual({
      id: "work-4",
      displayTitle: "EarthBound",
      mediaTypeKey: "media.game",
      createdAt: 1_700_000_002_000,
      updatedAt: 1_700_000_002_000,
    });
  });

  it("rejects duplicate or missing work identifiers", () => {
    const collection = new Collection({
      now: () => 1_700_000_003_000,
      idFactory: () => "work-5",
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

  it("validates required fields with zod", () => {
    const collection = new Collection({
      now: () => 1_700_000_004_000,
      idFactory: () => "work-6",
    });

    expect(() =>
      collection.addWork({
        displayTitle: "  ",
        mediaTypeKey: "media.game",
      }),
    ).toThrow("Work input invalid for displayTitle");

    expect(() =>
      collection.addWork({
        displayTitle: "Mega Man X",
        mediaTypeKey: " ",
      }),
    ).toThrow("Work input invalid for mediaTypeKey");
  });

  it("uses crypto.randomUUID when available", () => {
    const ids = ["uuid-1", "uuid-2"];
    vi.stubGlobal("crypto", {
      randomUUID: () => ids.shift() ?? "uuid-fallback",
    });

    try {
      const collection = new Collection({ now: () => 1_700_000_004_500 });
      const work = collection.addWork({
        displayTitle: "Golden Sun",
        mediaTypeKey: "media.game",
      });

      expect(work.id).toBe("uuid-1");
      expect(collection.getChangeLog()[0]?.id).toBe("uuid-2");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to generated identifiers when crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    try {
      const collection = new Collection({ now: () => 1_700_000_005_000 });
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

  it("clones change log payloads for safety", () => {
    const ids = ["work-7", "log-7"];
    const collection = new Collection({
      now: () => 1_700_000_006_000,
      idFactory: () => ids.shift() ?? "fallback",
    });

    collection.addWork({
      displayTitle: "Castlevania",
      mediaTypeKey: "media.game",
    });

    const changeLog = collection.getChangeLog();
    const payload = changeLog[0]?.payloadJson as { work: { displayTitle: string } };

    payload.work.displayTitle = "Altered";

    expect(collection.getChangeLog()[0]?.payloadJson).toEqual({
      work: {
        id: "work-7",
        displayTitle: "Castlevania",
        mediaTypeKey: "media.game",
        createdAt: 1_700_000_006_000,
        updatedAt: 1_700_000_006_000,
      },
    });
  });

  it("uses JSON cloning when structuredClone is unavailable", () => {
    vi.stubGlobal("structuredClone", undefined);

    try {
      const ids = ["work-8", "log-8"];
      const collection = new Collection({
        now: () => 1_700_000_007_000,
        idFactory: () => ids.shift() ?? "fallback",
      });

      collection.addWork({
        displayTitle: "Advance Wars",
        mediaTypeKey: "media.game",
      });

      const payload = collection.getChangeLog()[0]?.payloadJson as {
        work: { displayTitle: string };
      };

      payload.work.displayTitle = "Altered";

      expect(collection.getChangeLog()[0]?.payloadJson).toEqual({
        work: {
          id: "work-8",
          displayTitle: "Advance Wars",
          mediaTypeKey: "media.game",
          createdAt: 1_700_000_007_000,
          updatedAt: 1_700_000_007_000,
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
