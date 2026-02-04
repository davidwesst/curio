export type Work = {
  id: string;
  displayTitle: string;
  mediaTypeKey: string;
  createdAt: number;
  updatedAt: number;
};

export type ChangeLogEntry = {
  id: string;
  timestamp: number;
  opType: string;
  payloadJson: unknown;
};

export type WorkInput = {
  id?: string;
  displayTitle: string;
  mediaTypeKey: string;
  createdAt?: number;
  updatedAt?: number;
};

export type CollectionOptions = {
  now?: () => number;
  idFactory?: () => string;
};

const fallbackId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `curio_${timestamp}_${random}`;
};

const defaultIdFactory = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return fallbackId();
};

const cloneWork = (work: Work): Work => ({ ...work });

const clonePayload = (payload: unknown): unknown => {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(payload);
  }
  return JSON.parse(JSON.stringify(payload)) as unknown;
};

const cloneChangeLogEntry = (entry: ChangeLogEntry): ChangeLogEntry => ({
  ...entry,
  payloadJson: clonePayload(entry.payloadJson),
});

export class Collection {
  private readonly works = new Map<string, Work>();
  private readonly changeLog: ChangeLogEntry[] = [];
  private readonly now: () => number;
  private readonly idFactory: () => string;

  constructor(options: CollectionOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  addWork(input: WorkInput): Work {
    const displayTitle = input.displayTitle.trim();
    if (!displayTitle) {
      throw new Error("Work display title is required.");
    }

    const mediaTypeKey = input.mediaTypeKey.trim();
    if (!mediaTypeKey) {
      throw new Error("Work media type key is required.");
    }

    const id = input.id ?? this.idFactory();
    if (this.works.has(id)) {
      throw new Error(`Work with id ${id} already exists.`);
    }

    const timestamp = this.now();
    const work: Work = {
      id,
      displayTitle,
      mediaTypeKey,
      createdAt: input.createdAt ?? timestamp,
      updatedAt: input.updatedAt ?? input.createdAt ?? timestamp,
    };

    this.works.set(work.id, work);
    this.recordChange("work.create", { work: cloneWork(work) });
    return cloneWork(work);
  }

  removeWork(id: string): Work {
    const existing = this.works.get(id);
    if (!existing) {
      throw new Error(`Work with id ${id} does not exist.`);
    }

    this.works.delete(id);
    this.recordChange("work.remove", { workId: id, work: cloneWork(existing) });
    return cloneWork(existing);
  }

  getWork(id: string): Work | undefined {
    const work = this.works.get(id);
    return work ? cloneWork(work) : undefined;
  }

  listWorks(): Work[] {
    return Array.from(this.works.values(), (work) => cloneWork(work));
  }

  getChangeLog(): ChangeLogEntry[] {
    return this.changeLog.map((entry) => cloneChangeLogEntry(entry));
  }

  private recordChange(opType: string, payloadJson: unknown): void {
    const entry: ChangeLogEntry = {
      id: this.idFactory(),
      timestamp: this.now(),
      opType,
      payloadJson,
    };
    this.changeLog.push(entry);
  }
}
