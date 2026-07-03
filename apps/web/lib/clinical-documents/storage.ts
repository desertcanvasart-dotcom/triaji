/**
 * Clinical-document storage helpers.
 *
 * The `clinical-documents` bucket is PRIVATE. Rows in health_records store the
 * object's storage path in pdf_url/file_url (legacy rows stored a full public
 * URL, which never worked against the private bucket). Access goes through
 * GET /api/clinical-document/[id]/pdf, which authorizes the caller and
 * redirects to a short-lived signed URL.
 */

export const CLINICAL_DOCUMENTS_BUCKET = 'clinical-documents';

/** Signed-URL lifetime for on-demand PDF access (seconds). */
export const SIGNED_URL_TTL = 300;

/**
 * Normalize a stored pdf_url/file_url value to a bucket-relative storage path.
 * Handles both the new format (bare path, e.g. "patientId/TRJ-2026-00001.pdf")
 * and legacy rows that stored a full public URL.
 */
export function toStoragePath(stored: string): string {
  const marker = `/${CLINICAL_DOCUMENTS_BUCKET}/`;
  const idx = stored.indexOf(marker);
  return idx === -1 ? stored : stored.slice(idx + marker.length);
}

/** App-relative URL that serves a record's PDF via the authorized endpoint. */
export function clinicalDocumentPdfUrl(recordId: string): string {
  return `/api/clinical-document/${recordId}/pdf`;
}
