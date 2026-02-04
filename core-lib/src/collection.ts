import { z } from "zod";

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

const workInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  displayTitle: z.string().trim().min(1),
  mediaTypeKey: z.string().trim().min(1),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

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

const parseWorkInput = (input: WorkInput): WorkInput => {
  const result = workInputSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".") ?? "input";
    const message = issue?.message ?? "Invalid work input.";
    throw new Error(`Work input invalid for ${path}: ${message}`);
  }
  return result.data;
};

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
    const parsed = parseWorkInput(input);
    const id = parsed.id ?? this.idFactory();
    if (this.works.has(id)) {
      throw new Error(`Work with id ${id} already exists.`);
    }

    const timestamp = this.now();
    const work: Work = {
      id,
      displayTitle: parsed.displayTitle,
      mediaTypeKey: parsed.mediaTypeKey,
      createdAt: parsed.createdAt ?? timestamp,
      updatedAt: parsed.updatedAt ?? parsed.createdAt ?? timestamp,
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
