import { afterEach, describe, expect, it } from "vitest";

import { installPdfjsWorker } from "./pdfjs-worker-setup";

describe("installPdfjsWorker", () => {
  afterEach(() => {
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
  });

  it("sets globalThis.pdfjsWorker.WorkerMessageHandler", () => {
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
    installPdfjsWorker();
    const target = globalThis as {
      pdfjsWorker?: { WorkerMessageHandler: unknown };
    };
    expect(target.pdfjsWorker?.WorkerMessageHandler).toBeDefined();
  });

  it("doesn't override an already-present pdfjsWorker", () => {
    const sentinel = { WorkerMessageHandler: "already-set" };
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = sentinel;
    installPdfjsWorker();
    expect((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker).toBe(
      sentinel,
    );
  });
});
