/** File bytes; the Server Action body also includes multipart fields and headers. */
export const MAX_STATEMENT_PDF_BYTES = 4 * 1024 * 1024;
export const STATEMENT_UPLOAD_SIZE_ERROR =
  "This PDF is larger than 4 MB. Choose a PDF of 4 MB or less.";
export function statementUploadSizeError(size: number): string | null {
  return size > MAX_STATEMENT_PDF_BYTES ? STATEMENT_UPLOAD_SIZE_ERROR : null;
}
