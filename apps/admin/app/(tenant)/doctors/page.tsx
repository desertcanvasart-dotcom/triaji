'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { showToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BulkUploadModal from '@/components/doctors/BulkUploadModal';

interface Doctor {
  id: string;
  name_ar: string;
  name_en: string | null;
  photo_url: string | null;
  consultation_fee_egp: number | null;
  is_active: boolean;
  average_rating: number | null;
  languages: string[];
  specialties: { name_ar: string; name_en: string };
  governorates: { name_ar: string; name_en: string; code: string };
}

const PAGE_SIZES = [10, 25, 50, 100, 250, 500] as const;

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [governorateFilter, setGovernorateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [feeMin, setFeeMin] = useState('');
  const [feeMax, setFeeMax] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Reference data
  const [specialties, setSpecialties] = useState<Array<{ id: string; name_en: string }>>([]);
  const [governorates, setGovernorates] = useState<Array<{ id: string; name_en: string; code: string }>>([]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Bulk selection / delete (selection is scoped to the current page)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.from('specialties').select('id, name_en').order('name_en').then(({ data }) => {
      setSpecialties(data ?? []);
    });
    supabase.from('governorates').select('id, name_en, code').order('name_en').then(({ data }) => {
      setGovernorates(data ?? []);
    });
  }, []);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    // Any reload can change which rows are on the page, so drop the selection
    // rather than risk acting on doctors the user can no longer see.
    setSelectedIds(new Set());
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (specialtyFilter) params.set('specialty', specialtyFilter);
    if (governorateFilter) params.set('governorate', governorateFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (languageFilter) params.set('language', languageFilter);
    if (feeMin) params.set('fee_min', feeMin);
    if (feeMax) params.set('fee_max', feeMax);
    params.set('sort_by', sortBy);
    params.set('sort_dir', sortDir);
    params.set('page', String(page));
    params.set('limit', String(pageSize));

    const res = await fetch(`/api/admin/doctors?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setDoctors(data.doctors ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.total_pages ?? 0);
    }
    setLoading(false);
  }, [search, specialtyFilter, governorateFilter, statusFilter, languageFilter, feeMin, feeMax, sortBy, sortDir, page, pageSize]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, specialtyFilter, governorateFilter, statusFilter, languageFilter, feeMin, feeMax, pageSize]);

  async function toggleActive(doctor: Doctor) {
    const res = await fetch(`/api/admin/doctors/${doctor.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !doctor.is_active }),
    });
    if (res.ok) {
      showToast(
        doctor.is_active ? 'Doctor deactivated.' : 'Doctor activated.',
        'success'
      );
      fetchDoctors();
    } else {
      showToast('Failed to update doctor status.', 'error');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = doctors.length > 0 && doctors.every((d) => next.has(d.id));
      if (allSelected) {
        doctors.forEach((d) => next.delete(d.id));
      } else {
        doctors.forEach((d) => next.add(d.id));
      }
      return next;
    });
  }

  async function performBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/doctors/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error ?? 'Failed to delete doctors.', 'error');
        return;
      }

      const deleted: number = data.deleted_count ?? 0;
      const blocked: number = Array.isArray(data.blocked) ? data.blocked.length : 0;

      if (deleted > 0 && blocked === 0) {
        showToast(`Deleted ${deleted} doctor(s).`, 'success');
      } else if (deleted > 0 && blocked > 0) {
        showToast(
          `Deleted ${deleted} doctor(s); ${blocked} skipped (have related records).`,
          'success'
        );
      } else {
        showToast(
          `No doctors deleted — ${blocked} have related records. Deactivate them instead.`,
          'error'
        );
      }

      // Refetch only when something was actually removed; otherwise keep the
      // selection so the user can act on the blocked rows (e.g. deactivate).
      if (deleted > 0) {
        fetchDoctors();
      }
    } catch {
      showToast('Failed to delete doctors.', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  function sortIcon(column: string) {
    if (sortBy !== column) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function clearFilters() {
    setSearch('');
    setSpecialtyFilter('');
    setGovernorateFilter('');
    setStatusFilter('');
    setLanguageFilter('');
    setFeeMin('');
    setFeeMax('');
    setPage(1);
  }

  const hasActiveFilters = search || specialtyFilter || governorateFilter || statusFilter || languageFilter || feeMin || feeMax;

  async function exportCsv() {
    setExporting(true);
    try {
      // Fetch all matching doctors (no pagination) for export
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (specialtyFilter) params.set('specialty', specialtyFilter);
      if (governorateFilter) params.set('governorate', governorateFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (languageFilter) params.set('language', languageFilter);
      if (feeMin) params.set('fee_min', feeMin);
      if (feeMax) params.set('fee_max', feeMax);
      params.set('limit', '500');
      params.set('page', '1');

      const res = await fetch(`/api/admin/doctors?${params.toString()}`);
      if (!res.ok) {
        showToast('Failed to export doctors.', 'error');
        return;
      }

      const data = await res.json();
      const rows: Doctor[] = data.doctors ?? [];

      if (rows.length === 0) {
        showToast('No doctors to export.', 'error');
        return;
      }

      const headers = [
        'name_ar', 'name_en', 'specialty', 'governorate',
        'consultation_fee_egp', 'languages', 'status', 'rating',
      ];

      const csvRows = rows.map((doc) => [
        escapeCsvField(doc.name_ar),
        escapeCsvField(doc.name_en ?? ''),
        escapeCsvField(doc.specialties?.name_en ?? ''),
        escapeCsvField(doc.governorates?.name_en ?? ''),
        doc.consultation_fee_egp ?? '',
        (doc.languages ?? ['ar']).join(';'),
        doc.is_active ? 'Active' : 'Inactive',
        doc.average_rating ?? '',
      ]);

      const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `doctors-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast(`Exported ${rows.length} doctor(s).`, 'success');
    } catch {
      showToast('Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  }

  // Selection (current page only)
  const selectedCount = selectedIds.size;
  const allOnPageSelected = doctors.length > 0 && doctors.every((d) => selectedIds.has(d.id));
  const someOnPageSelected = doctors.some((d) => selectedIds.has(d.id));

  // Pagination helpers
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  function getPageNumbers(): (number | '...')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          {total > 0 && (
            <p className="text-sm text-gray-500 mt-1">{total} doctor(s) total</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCsv}
            disabled={exporting || total === 0}
            className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            title="Export current view as CSV"
          >
            {exporting ? '...' : '📥'} Export CSV
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            📁 Bulk Upload
          </button>
          <Link href="/doctors/new" className="btn-primary">
            + Add Doctor
          </Link>
        </div>
      </div>

      {/* Basic Filters */}
      <div className="flex flex-wrap gap-3 mb-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-64"
        />
        <select
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
          className="input-field w-48"
        >
          <option value="">All Specialties</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>{s.name_en}</option>
          ))}
        </select>
        <select
          value={governorateFilter}
          onChange={(e) => setGovernorateFilter(e.target.value)}
          className="input-field w-48"
        >
          <option value="">All Governorates</option>
          {governorates.map((g) => (
            <option key={g.id} value={g.id}>{g.name_en}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${
            showAdvanced
              ? 'bg-teal-50 text-teal-700 border-teal-300'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          {showAdvanced ? '▾ Less Filters' : '▸ More Filters'}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
          >
            ✕ Clear All
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-full"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Language</label>
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="input-field w-full"
            >
              <option value="">All</option>
              <option value="ar">Arabic</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min Fee (EGP)</label>
            <input
              type="number"
              placeholder="0"
              value={feeMin}
              onChange={(e) => setFeeMin(e.target.value)}
              className="input-field w-full"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max Fee (EGP)</label>
            <input
              type="number"
              placeholder="Any"
              value={feeMax}
              onChange={(e) => setFeeMax(e.target.value)}
              className="input-field w-full"
              min="0"
            />
          </div>
        </div>
      )}

      {!showAdvanced && <div className="mb-6" />}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={pageSize > 50 ? 20 : 8} cols={8} />
      ) : doctors.length === 0 ? (
        <EmptyState
          icon="👨‍⚕️"
          title="No doctors found"
          description={hasActiveFilters
            ? 'No doctors match your current filters. Try adjusting or clearing them.'
            : 'Add your first doctor to get started.'}
          actionLabel={hasActiveFilters ? 'Clear Filters' : 'Add Doctor'}
          onAction={hasActiveFilters ? clearFilters : () => { window.location.href = '/doctors/new'; }}
        />
      ) : (
        <>
          {/* Bulk-selection toolbar */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between mb-3 px-4 py-2.5 rounded-lg border border-teal-200 bg-teal-50">
              <span className="text-sm font-medium text-teal-800">
                {selectedCount} selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger text-sm py-1.5"
                >
                  🗑 Delete selected
                </button>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="table-header px-6 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all doctors on this page"
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        checked={allOnPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                        }}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th
                      className="table-header px-6 py-3 cursor-pointer select-none hover:text-teal-700"
                      onClick={() => handleSort('name_ar')}
                    >
                      Name{sortIcon('name_ar')}
                    </th>
                    <th className="table-header px-6 py-3">Specialty</th>
                    <th className="table-header px-6 py-3">Governorate</th>
                    <th
                      className="table-header px-6 py-3 cursor-pointer select-none hover:text-teal-700"
                      onClick={() => handleSort('consultation_fee_egp')}
                    >
                      Fee (EGP){sortIcon('consultation_fee_egp')}
                    </th>
                    <th
                      className="table-header px-6 py-3 cursor-pointer select-none hover:text-teal-700"
                      onClick={() => handleSort('rating_avg')}
                    >
                      Rating{sortIcon('rating_avg')}
                    </th>
                    <th className="table-header px-6 py-3">Status</th>
                    <th className="table-header px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doc) => (
                    <tr
                      key={doc.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        selectedIds.has(doc.id) ? 'bg-teal-50/60' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${doc.name_en ?? doc.name_ar}`}
                          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {doc.photo_url ? (
                            <img
                              src={doc.photo_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold">
                              {doc.name_en?.[0] ?? doc.name_ar[0]}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900" dir="rtl">
                              {doc.name_ar}
                            </p>
                            {doc.name_en && (
                              <p className="text-xs text-gray-500">{doc.name_en}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">{doc.specialties?.name_en}</td>
                      <td className="table-cell">{doc.governorates?.name_en}</td>
                      <td className="table-cell">
                        {doc.consultation_fee_egp ? `${doc.consultation_fee_egp} EGP` : '—'}
                      </td>
                      <td className="table-cell">
                        {doc.average_rating
                          ? `${doc.average_rating.toFixed(1)} ⭐`
                          : '—'}
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => toggleActive(doc)}
                          className={`badge cursor-pointer ${
                            doc.is_active ? 'badge-green' : 'badge-gray'
                          }`}
                        >
                          {doc.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link
                            href={`/doctors/${doc.id}/edit`}
                            className="text-teal-600 hover:text-teal-800 text-sm font-medium"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/doctors/${doc.id}/availability`}
                            className="text-teal-600 hover:text-teal-800 text-sm font-medium"
                          >
                            Slots
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            {/* Left: rows per page */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Rows per page:</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="input-field w-20 text-sm py-1.5"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">
                Showing {startRow}–{endRow} of {total}
              </span>
            </div>

            {/* Right: page controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="pagination-btn"
                title="First page"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="pagination-btn"
                title="Previous page"
              >
                ‹
              </button>

              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`pagination-btn ${
                      page === p
                        ? 'bg-teal-600 text-white border-teal-600'
                        : ''
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="pagination-btn"
                title="Next page"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="pagination-btn"
                title="Last page"
              >
                »
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={performBulkDelete}
        title="Delete doctors permanently?"
        message={`This permanently deletes ${selectedCount} selected doctor(s). This can't be undone. Doctors with related records (bookings, history, etc.) are skipped automatically — deactivate those instead.`}
        confirmLabel={`Delete ${selectedCount}`}
        danger
        loading={deleting}
      />

      <BulkUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => fetchDoctors()}
      />
    </div>
  );
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
