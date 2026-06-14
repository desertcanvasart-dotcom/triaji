'use client';

import { useState, useEffect, useCallback } from 'react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';

interface ClinicalDocumentRecord {
  id: string;
  documentNumber: string;
  documentType: string;
  pdfUrl: string | null;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  createdAt: string;
  doctorName: string;
  patientName: string;
}

const TYPE_BADGES: Record<string, { icon: string; label: string; className: string }> = {
  prescription: { icon: '\uD83D\uDC8A', label: '\u0631\u0648\u0634\u062A\u0629', className: 'badge-green' },
  lab_order: { icon: '\uD83E\uDDEA', label: '\u062A\u062D\u0627\u0644\u064A\u0644', className: 'badge-amber' },
  imaging_order: { icon: '\uD83D\uDCE1', label: '\u0623\u0634\u0639\u0629', className: 'badge-blue' },
  consultation_summary: { icon: '\uD83D\uDCCB', label: '\u0645\u0644\u062E\u0635 \u0627\u0633\u062A\u0634\u0627\u0631\u0629', className: 'badge-gray' },
};

const TYPE_OPTIONS = [
  { value: 'all', label: '\u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639' },
  { value: 'prescription', label: '\uD83D\uDC8A \u0631\u0648\u0634\u062A\u0629' },
  { value: 'lab_order', label: '\uD83E\uDDEA \u062A\u062D\u0627\u0644\u064A\u0644' },
  { value: 'imaging_order', label: '\uD83D\uDCE1 \u0623\u0634\u0639\u0629' },
  { value: 'consultation_summary', label: '\uD83D\uDCCB \u0645\u0644\u062E\u0635 \u0627\u0633\u062A\u0634\u0627\u0631\u0629' },
];

export default function ClinicalDocumentsAuditPage() {
  const [documents, setDocuments] = useState<ClinicalDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 25;

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (typeFilter !== 'all') {
      params.set('document_type', typeFilter);
    }
    if (doctorSearch.trim()) {
      params.set('doctor_name', doctorSearch.trim());
    }

    const res = await fetch(`/api/admin/clinical-documents?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [page, typeFilter, doctorSearch]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const totalPages = Math.ceil(total / limit);

  function handleSearch() {
    setDoctorSearch(searchInput);
    setPage(1);
  }

  function getTypeBadge(docType: string) {
    const badge = TYPE_BADGES[docType];
    if (!badge) {
      return <span className="badge badge-gray">{docType}</span>;
    }
    return (
      <span className={`badge ${badge.className}`}>
        {badge.icon} {badge.label}
      </span>
    );
  }

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {'\u0648\u062B\u0627\u0626\u0642 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0627\u0644\u0633\u0631\u064A\u0631\u064A\u0629'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {'\u0633\u062C\u0644 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0648\u062B\u0627\u0626\u0642 \u0627\u0644\u0633\u0631\u064A\u0631\u064A\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629 \u0645\u0646 \u0627\u0644\u0623\u0637\u0628\u0627\u0621'} ({total} {'\u0648\u062B\u064A\u0642\u0629'})
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 items-end flex-wrap">
        <div>
          <label htmlFor="type-filter" className="block text-xs font-medium text-gray-600 mb-1">
            {'\u0646\u0648\u0639 \u0627\u0644\u0648\u062B\u064A\u0642\u0629'}
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input-field text-sm w-48"
            dir="rtl"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="doctor-search" className="block text-xs font-medium text-gray-600 mb-1">
            {'\u0628\u062D\u062B \u0628\u0627\u0633\u0645 \u0627\u0644\u0637\u0628\u064A\u0628'}
          </label>
          <div className="flex gap-2">
            <input
              id="doctor-search"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder={'\u0627\u0633\u0645 \u0627\u0644\u0637\u0628\u064A\u0628...'}
              className="input-field text-sm w-56"
              dir="rtl"
            />
            <button
              onClick={handleSearch}
              className="btn-secondary text-sm"
            >
              {'\u0628\u062D\u062B'}
            </button>
            {doctorSearch && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setDoctorSearch('');
                  setPage(1);
                }}
                className="btn-secondary text-sm"
              >
                {'\u0645\u0633\u062D'}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={'\uD83D\uDCC4'}
          title={'\u0644\u0627 \u062A\u0648\u062C\u062F \u0648\u062B\u0627\u0626\u0642'}
          description={
            typeFilter !== 'all' || doctorSearch
              ? '\u0644\u0627 \u062A\u0648\u062C\u062F \u0648\u062B\u0627\u0626\u0642 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0644\u062A\u0631.'
              : '\u0644\u0627 \u062A\u0648\u062C\u062F \u0648\u062B\u0627\u0626\u0642 \u0633\u0631\u064A\u0631\u064A\u0629 \u0645\u0639\u062A\u0645\u062F\u0629 \u0645\u0646 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0628\u0639\u062F.'
          }
        />
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="table-header px-6 py-3 text-right">{'\u0631\u0642\u0645 \u0627\u0644\u0648\u062B\u064A\u0642\u0629'}</th>
                    <th className="table-header px-6 py-3 text-right">{'\u0627\u0644\u0646\u0648\u0639'}</th>
                    <th className="table-header px-6 py-3 text-right">{'\u0627\u0644\u0637\u0628\u064A\u0628'}</th>
                    <th className="table-header px-6 py-3 text-right">{'\u0627\u0644\u0645\u0631\u064A\u0636'}</th>
                    <th className="table-header px-6 py-3 text-right">{'\u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628'}</th>
                    <th className="table-header px-6 py-3 text-right">{'\u0627\u0644\u062A\u0627\u0631\u064A\u062E'}</th>
                    <th className="table-header px-6 py-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-gray-900" dir="ltr">
                          {doc.documentNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getTypeBadge(doc.documentType)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {doc.doctorName}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">
                          {doc.patientName}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {doc.whatsappSent ? (
                          <span className="badge badge-green">{'\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644'}</span>
                        ) : (
                          <span className="badge badge-gray">{'\u0644\u0645 \u064A\u0631\u0633\u0644'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(doc.createdAt).toLocaleDateString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <br />
                        <span className="text-xs text-gray-400" dir="ltr">
                          {new Date(doc.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {doc.pdfUrl ? (
                          <a
                            href={doc.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:text-teal-800 text-sm font-medium"
                          >
                            {'\u0639\u0631\u0636 PDF'}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">{'\u2014'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                {'\u0635\u0641\u062D\u0629'} {page} {'\u0645\u0646'} {totalPages} ({total} {'\u0648\u062B\u064A\u0642\u0629'})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {'\u0627\u0644\u0633\u0627\u0628\u0642'}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {'\u0627\u0644\u062A\u0627\u0644\u064A'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
