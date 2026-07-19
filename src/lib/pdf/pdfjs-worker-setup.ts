/**
 * Makes pdf.js use its own worker code in-process, without it trying to
 * dynamically load a separate worker file at runtime.
 *
 * v1.3.3: fixes a third instance of the same underlying problem as
 * dommatrix-polyfill.ts -- pdf.js does something clever to work around
 * not having a DOM/Worker in Node, and that cleverness doesn't survive
 * Vercel's deployment bundling. Here, pdf.js's own fallback ("fake
 * worker") tries to `import()` a worker script using a path it
 * constructs itself (`./pdf.worker.mjs`, relative to its own file);
 * after Next's webpack build rewrites that into a path under
 * `.next/server/chunks/`, the actual file isn't there at runtime,
 * producing "Setting up fake worker failed: Cannot find module
 * .../pdf.worker.mjs".
 *
 * pdf.js has a documented escape hatch for exactly this: if
 * `globalThis.pdfjsWorker.WorkerMessageHandler` is already set, it skips
 * the dynamic import entirely and uses that directly (see pdf.js's
 * `PDFWorker.#mainThreadWorkerMessageHandler` / `_setupFakeWorkerGlobal`
 * getters). Importing the worker module here is an ordinary static
 * import, which webpack bundles normally -- nothing left for a file
 * tracer to lose. Verified by deliberately pointing
 * `GlobalWorkerOptions.workerSrc` at a nonexistent path and confirming
 * extraction still succeeds once this is installed.
 */

import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";

export function installPdfjsWorker(): void {
  const target = globalThis as {
    pdfjsWorker?: { WorkerMessageHandler: unknown };
  };
  if (!target.pdfjsWorker) {
    target.pdfjsWorker = { WorkerMessageHandler };
  }
}
