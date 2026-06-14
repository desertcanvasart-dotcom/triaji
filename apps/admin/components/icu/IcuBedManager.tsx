'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface IcuUnit {
  id: string;
  tenant_id: string;
  unit_type: string;
  unit_name_ar: string;
  unit_name_en: string | null;
  total_beds: number;
  available_beds: number;
  floor_ar: string | null;
  floor_en: string | null;
  phone_direct: string | null;
  accepts_transfers: boolean;
  is_active: boolean;
  updated_at: string;
}

type DecrementReason = 'New admission' | 'External transfer in' | 'Bed maintenance' | 'Other';
type IncrementReason = 'Patient discharged' | 'Patient transferred out' | 'Maintenance complete' | 'Other';

const DECREMENT_REASONS: DecrementReason[] = [
  'New admission',
  'External transfer in',
  'Bed maintenance',
  'Other',
];

const INCREMENT_REASONS: IncrementReason[] = [
  'Patient discharged',
  'Patient transferred out',
  'Maintenance complete',
  'Other',
];

interface PendingAction {
  unitId: string;
  direction: 'increment' | 'decrement';
}

export default function IcuBedManager({ tenantId }: { tenantId: string }) {
  const [units, setUnits] = useState<IcuUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/icu/units');
      if (!res.ok) throw new Error('Failed to fetch ICU units');
      const data = await res.json();
      setUnits((data.units as IcuUnit[]).filter((u) => u.is_active));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnits();

    // Subscribe to real-time changes on icu_units
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`icu_units:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'icu_units',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchUnits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchUnits]);

  async function handleBedChange(unitId: string, direction: 'increment' | 'decrement', reason: string) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return;

    const newAvailable =
      direction === 'increment'
        ? unit.available_beds + 1
        : unit.available_beds - 1;

    if (newAvailable < 0 || newAvailable > unit.total_beds) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/icu/units/${unitId}/beds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          available_beds: newAvailable,
          change_reason: reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update beds');
      }

      // Optimistic update
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? { ...u, available_beds: newAvailable, updated_at: new Date().toISOString() }
            : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
      setPendingAction(null);
      setSelectedReason('');
    }
  }

  function getTimeSinceUpdate(updatedAt: string): string {
    const diff = Date.now() - new Date(updatedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">Loading ICU units...</div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">No ICU units configured yet.</p>
        <a href="/icu/setup" className="btn-primary inline-block">
          Set Up ICU Units
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ICU Bed Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Update bed availability in real time.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchUnits();
          }}
          className="btn-secondary text-sm"
        >
          Refresh All
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {units.map((unit) => {
          const occupied = unit.total_beds - unit.available_beds;
          const isFullyOccupied = unit.available_beds === 0;
          const isPendingThis = pendingAction?.unitId === unit.id;

          return (
            <div
              key={unit.id}
              className={`bg-white rounded-xl border p-5 ${
                isFullyOccupied ? 'border-red-300' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {unit.unit_name_en || unit.unit_name_ar}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {unit.floor_en || unit.floor_ar || 'No floor'}
                    {unit.phone_direct ? ` | ${unit.phone_direct}` : ''}
                  </p>
                </div>
                {isFullyOccupied && (
                  <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                    Fully occupied
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm mb-3">
                <div>
                  <span className="text-gray-500">Total: </span>
                  <span className="font-semibold">{unit.total_beds}</span>
                </div>
                <div>
                  <span className="text-gray-500">Occupied: </span>
                  <span className="font-semibold text-red-600">{occupied}</span>
                </div>
                <div>
                  <span className="text-gray-500">Available: </span>
                  <span className={`font-semibold ${isFullyOccupied ? 'text-red-600' : 'text-green-600'}`}>
                    {unit.available_beds}
                  </span>
                </div>
              </div>

              {/* Visual bed indicators */}
              <div className="flex flex-wrap gap-1 mb-4">
                {Array.from({ length: unit.total_beds }, (_, i) => (
                  <span
                    key={i}
                    className={`inline-block w-3 h-3 rounded-full ${
                      i < occupied ? 'bg-red-400' : 'bg-green-400'
                    }`}
                    title={i < occupied ? 'Occupied' : 'Available'}
                  />
                ))}
              </div>

              {/* Action buttons */}
              {!isPendingThis && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (unit.available_beds >= unit.total_beds) return;
                      setPendingAction({ unitId: unit.id, direction: 'increment' });
                      setSelectedReason('');
                    }}
                    disabled={unit.available_beds >= unit.total_beds || updating}
                    className="flex-1 bg-green-50 text-green-700 border border-green-200 rounded-lg py-2 text-sm font-semibold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Free Bed
                  </button>
                  <button
                    onClick={() => {
                      if (unit.available_beds <= 0) return;
                      setPendingAction({ unitId: unit.id, direction: 'decrement' });
                      setSelectedReason('');
                    }}
                    disabled={unit.available_beds <= 0 || updating}
                    className="flex-1 bg-red-50 text-red-700 border border-red-200 rounded-lg py-2 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    - Occupy Bed
                  </button>
                </div>
              )}

              {/* Reason selection */}
              {isPendingThis && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    {pendingAction.direction === 'increment' ? 'Reason for freeing bed:' : 'Reason for occupying bed:'}
                  </p>
                  <div className="space-y-1.5">
                    {(pendingAction.direction === 'increment' ? INCREMENT_REASONS : DECREMENT_REASONS).map(
                      (reason) => (
                        <button
                          key={reason}
                          onClick={() => setSelectedReason(reason)}
                          className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-all ${
                            selectedReason === reason
                              ? 'bg-teal-100 text-teal-800 border border-teal-300'
                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {reason}
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setPendingAction(null);
                        setSelectedReason('');
                      }}
                      className="flex-1 text-sm text-gray-600 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (selectedReason) {
                          handleBedChange(unit.id, pendingAction.direction, selectedReason);
                        }
                      }}
                      disabled={!selectedReason || updating}
                      className="flex-1 btn-primary text-sm py-1.5 disabled:opacity-50"
                    >
                      {updating ? 'Updating...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}

              {/* Last updated */}
              <p className="text-xs text-gray-400 mt-3">
                Last updated: {getTimeSinceUpdate(unit.updated_at)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
