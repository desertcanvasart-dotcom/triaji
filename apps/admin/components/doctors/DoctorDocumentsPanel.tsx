'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';
import {
  specsForClinicMode,
  documentLabel,
  type DoctorDocumentStatus,
  type DoctorDocumentType,
} from '@triaji/shared/constants/doctor-documents';

interface DoctorDocumentRow {
  id: string;
  doc_type: DoctorDocumentType;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: DoctorDocumentStatus;
  review_note: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  url: string | null;
}

interface Props {
  registrationId: string;
  clinicMode: 'independent' | 'own_clinic' | 'existing_clinic' | null | undefined;
  foreignDegree?: boolean;
  onReviewed?: () => void;
}

/**
 * The uploaded verification documents for one registration, reviewed one by one.
 * Signed URLs come from the API and expire in five minutes, so the panel refetches
 * rather than caching them.
 */
export default function DoctorDocumentsPanel({ registrationId, clinicMode, foreignDegree, onReviewed }: Props) {
  const [documents, setDocuments] = useState<DoctorDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [migrationPending, setMigrationPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/admin/doctor-verification/${registrationId}/documents`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setLoadError(data?.error ?? 'Could not load documents.');
        setDocuments([]);
        return;
      }

      setDocuments(data.documents ?? []);
      setMigrationPending(!!data.migration_pending);
    } catch {
      setLoadError('Could not reach the server.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(docId: string, status: 'approved' | 'rejected', note?: string) {
    setBusyId(docId);
    const res = await fetch(
      `/api/admin/doctor-verification/${registrationId}/documents/${docId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_note: note ?? null }),
      }
    );
    setBusyId(null);

    if (!res.ok) {
      const data = await res.json();
      showToast(data.error ?? 'Could not update the document.', 'error');
      return;
    }

    setRejectingId(null);
    setRejectNote('');
    await load();
    onReviewed?.();
  }

  const specs = specsForClinicMode(clinicMode, foreignDegree);
  const byType = new Map(documents.map((d) => [d.doc_type, d]));
  const missingRequired = specs.filter((s) => s.required && !byType.has(s.type));

  if (loading) {
    return <p className="text-sm text-gray-500 px-6 py-4">Loading documents…</p>;
  }

  if (loadError) {
    return (
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
        <p className="text-sm text-red-700">{loadError}</p>
        <button className="text-teal-700 hover:underline text-sm font-medium" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  if (migrationPending) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 px-6 py-4">
        Document review needs migration 068 applied to the database first.
      </p>
    );
  }

  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">
          This doctor has not uploaded any documents yet.
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {documentLabel(doc.doc_type, 'en')}
                  <span className={`ml-2 badge ${statusClass(doc.status)}`}>{doc.status}</span>
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {doc.file_name} · {(doc.size_bytes / 1024).toFixed(0)} KB ·{' '}
                  {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                {doc.status === 'rejected' && doc.review_note && (
                  <p className="text-xs text-red-600 mt-1">Reason: {doc.review_note}</p>
                )}

                {rejectingId === doc.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="input-field text-xs flex-1"
                      placeholder="Why is it being rejected? The doctor sees this."
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="text-red-600 hover:underline text-sm font-medium disabled:opacity-50"
                      disabled={busyId === doc.id || !rejectNote.trim()}
                      onClick={() => review(doc.id, 'rejected', rejectNote)}
                    >
                      Confirm
                    </button>
                    <button
                      className="text-gray-400 hover:underline text-sm"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectNote('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-700 hover:underline text-sm font-medium"
                  >
                    View
                  </a>
                )}
                {doc.status !== 'approved' && (
                  <button
                    className="text-green-600 hover:underline text-sm font-medium disabled:opacity-50"
                    disabled={busyId === doc.id}
                    onClick={() => review(doc.id, 'approved')}
                  >
                    Approve
                  </button>
                )}
                {doc.status !== 'rejected' && rejectingId !== doc.id && (
                  <button
                    className="text-red-600 hover:underline text-sm font-medium disabled:opacity-50"
                    disabled={busyId === doc.id}
                    onClick={() => setRejectingId(doc.id)}
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {missingRequired.length > 0 && (
        <p className="text-xs text-amber-700 mt-3">
          Still missing: {missingRequired.map((s) => s.label_en).join(', ')}
        </p>
      )}
    </div>
  );
}

function statusClass(status: DoctorDocumentStatus): string {
  return status === 'approved' ? 'badge-green' : status === 'rejected' ? 'badge-red' : 'badge-amber';
}
