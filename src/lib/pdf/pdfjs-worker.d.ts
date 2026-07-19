/**
 * pdfjs-dist ships this deep path (the worker script, imported directly
 * for its side effect -- see pdfjs-worker-setup.ts) without a type
 * declaration for it specifically. Minimal ambient declaration covering
 * just the one named export this app actually uses.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
