'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChainStats {
  branchCount: number;
  testMappingCount: number;
  ordersThisMonth: number;
}

interface ChainRow {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  hotline: string | null;
  has_api: boolean;
  api_contract_signed: boolean;
  api_live_date: string | null;
  payment_via_triaji: boolean;
  is_active: boolean;
  stats: ChainStats;
}

type ApiStatus = 'live' | 'contract_signed' | 'not_connected';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getApiStatus(chain: ChainRow): ApiStatus {
  if (chain.has_api && chain.api_contract_signed) return 'live';
  if (chain.api_contract_signed) return 'contract_signed';
  return 'not_connected';
}

const STATUS_BADGE: Record<ApiStatus, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-green-100 text-green-800' },
  contract_signed: { label: 'Contract Signed', className: 'bg-yellow-100 text-yellow-800' },
  not_connected: { label: 'Not Connected', className: 'bg-red-100 text-red-800' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ChainsPage() {
  const [chains, setChains] = useState<ChainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [testingCode, setTestingCode] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ code: string; success: boolean; message: string } | null>(null);
  const [importResult, setImportResult] = useState<{ code: string; type: string; message: string } | null>(null);

  const branchFileRef = useRef<HTMLInputElement>(null);
  const testFileRef = useRef<HTMLInputElement>(null);

  // ─── Fetch chains ─────────────────────────────────────────────────────

  const fetchChains = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/chains');
      if (res.ok) {
        const data = await res.json();
        setChains(data.chains ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  // ─── Test API ─────────────────────────────────────────────────────────

  const handleTestApi = async (code: string) => {
    setTestingCode(code);
    setTestResult(null);

    try {
      const res = await fetch(`/api/admin/chains/${code}/test`, { method: 'POST' });
      const data = await res.json();

      setTestResult({
        code,
        success: data.success ?? false,
        message: data.success
          ? `API verified. Test order ID: ${data.testOrderId ?? 'N/A'}`
          : `Failed at step "${data.step ?? 'unknown'}": ${data.error ?? 'Unknown error'}`,
      });

      if (data.success) {
        fetchChains(); // Refresh to show updated status
      }
    } catch {
      setTestResult({
        code,
        success: false,
        message: 'Network error while testing API',
      });
    } finally {
      setTestingCode(null);
    }
  };

  // ─── Import branches ─────────────────────────────────────────────────

  const handleImportBranches = async (code: string, file: File) => {
    setImportResult(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch(`/api/admin/chains/${code}/import-branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult({
          code,
          type: 'branches',
          message: `Imported ${data.imported} branches. Total: ${data.totalBranches ?? data.imported}`,
        });
        fetchChains();
      } else {
        setImportResult({
          code,
          type: 'branches',
          message: `Error: ${data.error}`,
        });
      }
    } catch (err) {
      setImportResult({
        code,
        type: 'branches',
        message: `Failed to parse file: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
      });
    }
  };

  // ─── Import test mappings ────────────────────────────────────────────

  const handleImportTests = async (code: string, file: File) => {
    setImportResult(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch(`/api/admin/chains/${code}/import-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult({
          code,
          type: 'tests',
          message: `Imported ${data.imported} test mappings. Total: ${data.totalMappings ?? data.imported}`,
        });
        fetchChains();
      } else {
        setImportResult({
          code,
          type: 'tests',
          message: `Error: ${data.error}`,
        });
      }
    } catch (err) {
      setImportResult({
        code,
        type: 'tests',
        message: `Failed to parse file: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
      });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Lab Chain Management</h1>
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Lab Chain Management</h1>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {chains.map((chain) => {
          const status = getApiStatus(chain);
          const badge = STATUS_BADGE[status];
          const isExpanded = expandedCode === chain.code;

          return (
            <div key={chain.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{chain.name_en}</h2>
                    <p className="text-sm text-gray-500" dir="rtl">{chain.name_ar}</p>
                  </div>
                  {/* Logo placeholder */}
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold text-gray-400">
                    {chain.code.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* API Status */}
                <div className="mb-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                    <span className={`w-2 h-2 rounded-full mr-1.5 ${
                      status === 'live' ? 'bg-green-500' :
                      status === 'contract_signed' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    {badge.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-900">{chain.stats.branchCount}</p>
                    <p className="text-xs text-gray-500">Branches</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-900">{chain.stats.testMappingCount}</p>
                    <p className="text-xs text-gray-500">Test Maps</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-900">{chain.stats.ordersThisMonth}</p>
                    <p className="text-xs text-gray-500">Orders/mo</p>
                  </div>
                </div>

                {/* Hotline */}
                {chain.hotline && (
                  <p className="text-xs text-gray-400 mt-3">Hotline: {chain.hotline}</p>
                )}
              </div>

              {/* Expand/Collapse */}
              <div className="border-t border-gray-100">
                <button
                  onClick={() => setExpandedCode(isExpanded ? null : chain.code)}
                  className="w-full px-6 py-3 text-sm text-teal-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  {isExpanded ? 'Hide Tools' : 'Manage'}
                </button>
              </div>

              {/* Expanded Tools */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-6 space-y-4 bg-gray-50">
                  {/* Test API */}
                  <div>
                    <button
                      onClick={() => handleTestApi(chain.code)}
                      disabled={testingCode === chain.code}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {testingCode === chain.code ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Testing...
                        </span>
                      ) : (
                        'Test API Connection'
                      )}
                    </button>
                    {testResult?.code === chain.code && (
                      <div className={`mt-2 text-xs p-2 rounded-lg ${
                        testResult.success
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>

                  {/* Import Branches */}
                  <div>
                    <input
                      ref={branchFileRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportBranches(chain.code, file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => branchFileRef.current?.click()}
                      className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      Import Branches (JSON)
                    </button>
                  </div>

                  {/* Import Test Mappings */}
                  <div>
                    <input
                      ref={testFileRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportTests(chain.code, file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => testFileRef.current?.click()}
                      className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      Import Test Mapping (JSON)
                    </button>
                  </div>

                  {/* Import result */}
                  {importResult?.code === chain.code && (
                    <div className={`text-xs p-2 rounded-lg ${
                      importResult.message.startsWith('Error')
                        ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'
                    }`}>
                      {importResult.message}
                    </div>
                  )}

                  {/* Payment toggle */}
                  <div className="flex items-center justify-between bg-white rounded-lg p-3">
                    <span className="text-sm text-gray-700">Payment via DoctorTrio</span>
                    <button
                      onClick={async () => {
                        await fetch('/api/admin/chains', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            code: chain.code,
                            payment_via_triaji: !chain.payment_via_triaji,
                          }),
                        });
                        fetchChains();
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        chain.payment_via_triaji ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          chain.payment_via_triaji ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* API Live Date */}
                  {chain.api_live_date && (
                    <p className="text-xs text-gray-400">
                      API live since: {new Date(chain.api_live_date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {chains.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No lab chains found.</p>
        </div>
      )}
    </div>
  );
}
