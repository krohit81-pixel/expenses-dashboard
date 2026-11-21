import { describe, expect, it } from "vitest";
import {
  MAX_STATEMENT_PDF_BYTES,
  statementUploadSizeError,
} from "./upload-limits";
import nextConfig from "../../../next.config";
describe("statement upload limits", () => {
  it("accepts files larger than the old 1 MB limit and exactly 4 MiB", () => {
    expect(statementUploadSizeError(1.5 * 1024 * 1024)).toBeNull();
    expect(statementUploadSizeError(MAX_STATEMENT_PDF_BYTES)).toBeNull();
  });
  it("rejects an oversized file with a clear message", () => {
    expect(statementUploadSizeError(MAX_STATEMENT_PDF_BYTES + 1)).toContain(
      "larger than 4 MB",
    );
  });
  it("leaves multipart room while staying below Vercel's default request ceiling", () => {
    const bodyLimit = nextConfig.experimental?.serverActions
      ?.bodySizeLimit as number;
    expect(bodyLimit).toBeGreaterThan(MAX_STATEMENT_PDF_BYTES + 20 * 1024);
    expect(bodyLimit).toBeLessThan(4_500_000);
  });
});
