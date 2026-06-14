'use client';

import { useState, useRef, type DragEvent } from 'react';
import { showToast } from '@/components/ui/Toast';

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface UploadResult {
  total_rows: number;
  inserted: number;
  skipped: number;
  validation_errors: RowError[];
  insert_errors: string[];
}

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUploadModal({ open, onClose, onSuccess }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.csv')) {
      setFile(dropped);
      setResult(null);
    } else {
      showToast('Please upload a .csv file.', 'error');
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/doctors/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error ?? 'Upload failed.', 'error');
        setUploading(false);
        return;
      }

      setResult(data as UploadResult);

      if (data.inserted > 0) {
        showToast(`Successfully added ${data.inserted} doctor(s).`, 'success');
        onSuccess();
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }

    setUploading(false);
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    setDragOver(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Bulk Upload Doctors</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template download */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Step 1:</strong> Download the CSV template, fill in your doctors&apos; data, then upload.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="/api/admin/doctors/csv-template"
                download
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                📄 Download Template
              </a>
              <span className="text-xs text-blue-600">
                Required columns: name_ar, specialty, governorate
              </span>
            </div>
          </div>

          {/* Reference info */}
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
              Column guide &amp; accepted values
            </summary>
            <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-2 text-gray-700">
              <p><strong>name_ar</strong> — Arabic name (required, min 10 characters)</p>
              <p><strong>name_en</strong> — English name (optional)</p>
              <p><strong>specialty</strong> — English or Arabic name, e.g. &quot;Cardiology&quot; or &quot;أمراض القلب&quot;</p>
              <p><strong>governorate</strong> — English name, Arabic name, or 3-letter code, e.g. &quot;Cairo&quot; or &quot;CAI&quot;</p>
              <p><strong>consultation_fee_egp</strong> — Number (optional)</p>
              <p><strong>languages</strong> — Comma-separated: ar, en, fr (defaults to &quot;ar&quot;)</p>
              <p><strong>bio_ar</strong> — Arabic biography (optional)</p>
              <p><strong>title_ar</strong> — Arabic title (defaults to &quot;د.&quot;)</p>
              <p><strong>latitude / longitude</strong> — Clinic coordinates (optional)</p>
            </div>
          </details>

          {/* Drop zone */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              <strong>Step 2:</strong> Upload your CSV file
            </p>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-teal-400 bg-teal-50'
                  : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div>
                  <p className="text-green-700 font-medium">📎 {file.name}</p>
                  <p className="text-sm text-green-600 mt-1">
                    {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500 text-lg mb-1">📁</p>
                  <p className="text-gray-600 font-medium">
                    Drag &amp; drop your CSV file here
                  </p>
                  <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{result.total_rows}</p>
                  <p className="text-xs text-gray-500">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                  <p className="text-xs text-green-600">Inserted</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${result.skipped > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${result.skipped > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                    {result.skipped}
                  </p>
                  <p className={`text-xs ${result.skipped > 0 ? 'text-red-600' : 'text-gray-500'}`}>Skipped</p>
                </div>
              </div>

              {/* Validation errors */}
              {result.validation_errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    Validation Errors ({result.validation_errors.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.validation_errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-700">
                        <strong>Row {err.row}</strong> [{err.field}]: {err.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Insert errors */}
              {result.insert_errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800 mb-2">
                    Database Errors ({result.insert_errors.length})
                  </p>
                  {result.insert_errors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-700">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button onClick={handleClose} className="btn-secondary">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload & Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
