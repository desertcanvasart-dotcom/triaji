'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import LoadError from '@/components/ui/LoadError';
import { showToast } from '@/components/ui/Toast';

interface KBDocument {
  id: string;
  collection: string;
  title_ar: string;
  title_en: string | null;
  language: string;
  is_active: boolean;
  updated_at: string;
}

const COLLECTIONS = [
  'conditions', 'symptoms', 'specialty_map', 'emergency_protocols',
  'egypt_context', 'risk_modifiers', 'follow_up_questions',
];

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [reembedding, setReembedding] = useState(false);

  // Test query state
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<Array<{
    document_id: string;
    title: string;
    chunk_text: string;
    similarity: number;
  }>>([]);
  const [testLoading, setTestLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (collectionFilter) params.set('collection', collectionFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/kb?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setLoadError(data?.error ?? 'Could not load knowledge base documents.');
        setDocuments([]);
        return;
      }
      setDocuments(data.documents ?? []);
    } catch {
      setLoadError('Could not reach the server.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [collectionFilter, statusFilter, search]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  async function handleReembedAll() {
    setReembedding(true);
    const res = await fetch('/api/admin/kb/embed-all', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      showToast(`Re-embedded ${data.succeeded}/${data.total} documents.`, 'success');
    } else {
      showToast('Re-embedding failed.', 'error');
    }
    setReembedding(false);
  }

  async function handleTestQuery() {
    if (!testQuery.trim()) return;
    setTestLoading(true);
    const res = await fetch('/api/admin/kb/test-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: testQuery }),
    });
    if (res.ok) {
      const data = await res.json();
      setTestResults(data.results ?? []);
    } else {
      showToast('Test query failed.', 'error');
    }
    setTestLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <div className="flex gap-3">
          <button onClick={handleReembedAll} disabled={reembedding} className="btn-secondary">
            {reembedding ? 'Re-embedding...' : 'Re-embed All'}
          </button>
          <Link href="/knowledge-base/new" className="btn-primary">
            Add Document
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-64"
        />
        <select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          className="input-field w-48"
        >
          <option value="">All Collections</option>
          {COLLECTIONS.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-36"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={fetchDocs} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No documents found"
          description="Add knowledge base documents to improve triage accuracy."
          actionLabel="Add Document"
          onAction={() => window.location.href = '/knowledge-base/new'}
        />
      ) : (
        <div className="card p-0 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header px-6 py-3">Title</th>
                  <th className="table-header px-6 py-3">Collection</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Last Updated</th>
                  <th className="table-header px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900" dir="rtl">{doc.title_ar}</p>
                      {doc.title_en && <p className="text-xs text-gray-500">{doc.title_en}</p>}
                    </td>
                    <td className="table-cell">
                      <span className="badge badge-teal">{doc.collection.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${doc.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {doc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">
                      {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/knowledge-base/${doc.id}/edit`} className="text-teal-600 hover:text-teal-800 text-sm font-medium">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Knowledge Base */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Knowledge Base</h2>
        <p className="text-sm text-gray-500 mb-3">Enter symptoms in Arabic to test retrieval.</p>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            dir="rtl"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="أعراض المريض..."
            className="input-field flex-1"
          />
          <button onClick={handleTestQuery} disabled={testLoading} className="btn-primary">
            {testLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {testResults.length > 0 && (
          <div className="space-y-3">
            {testResults.map((r, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-gray-900">{r.title}</p>
                  <span className="badge badge-teal">{(r.similarity * 100).toFixed(1)}%</span>
                </div>
                <p className="text-sm text-gray-600" dir="rtl">{r.chunk_text?.slice(0, 200)}...</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
