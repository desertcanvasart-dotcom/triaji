'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CallRow {
  id: string;
  session_start: string;
  call_duration_seconds: number | null;
  status: string;
  emergency_triggered: boolean;
  handoff_triggered: boolean;
  handoff_reason: string | null;
  recording_url: string | null;
  transcript_full: string | null;
  booking_id: string | null;
  chief_complaint_ar: string | null;
  call_sid: string | null;
  phone_number: string | null;
  specialty_name_ar: string | null;
  specialty_name_en: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
}

interface TenantOption {
  id: string;
  name: string;
}

interface CallLogClientProps {
  calls: CallRow[];
  isGlobalAdmin: boolean;
  tenants: TenantOption[];
  currentTenantFilter: string;
}

type SortField = 'session_start' | 'call_duration_seconds' | 'status';
type SortDirection = 'asc' | 'desc';

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + '*'.repeat(phone.length - 6) + phone.slice(-3);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(isoString: string): { time: string; date: string } {
  const d = new Date(isoString);
  return {
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

interface CallOutcome {
  label: string;
  badgeClass: string;
}

function getCallOutcome(call: CallRow): CallOutcome {
  if (call.status === 'completed' && call.booking_id) {
    return { label: '\u062D\u062C\u0632 \u0645\u0648\u0639\u062F', badgeClass: 'bg-green-100 text-green-800' };
  }
  if (call.status === 'escalated' && call.emergency_triggered) {
    return { label: '\u0637\u0648\u0627\u0631\u0626', badgeClass: 'bg-red-100 text-red-800' };
  }
  if (call.handoff_triggered) {
    return { label: '\u062A\u062D\u0648\u064A\u0644', badgeClass: 'bg-amber-100 text-amber-800' };
  }
  if (call.status === 'completed' && !call.booking_id) {
    return { label: '\u0628\u062F\u0648\u0646 \u062D\u062C\u0632', badgeClass: 'bg-gray-100 text-gray-800' };
  }
  if (call.status === 'abandoned') {
    return { label: '\u0644\u0645 \u064A\u064F\u0631\u062F', badgeClass: 'bg-gray-100 text-gray-800' };
  }
  return { label: call.status, badgeClass: 'bg-gray-100 text-gray-800' };
}

// ─── Analytics computation ──────────────────────────────────────────────────

interface AnalyticsStats {
  todaysCalls: number;
  avgDuration: string;
  bookingRate: string;
  handoffRate: string;
}

function computeAnalytics(calls: CallRow[]): AnalyticsStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysCalls = calls.filter((c) => new Date(c.session_start) >= today).length;

  const durations = calls
    .map((c) => c.call_duration_seconds)
    .filter((d): d is number => d !== null && d > 0);
  const avgSeconds =
    durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;
  const avgDuration = formatDuration(avgSeconds);

  const totalCalls = calls.length;
  const bookedCalls = calls.filter((c) => c.booking_id !== null).length;
  const handoffCalls = calls.filter((c) => c.handoff_triggered).length;

  const bookingRate = totalCalls > 0 ? ((bookedCalls / totalCalls) * 100).toFixed(1) : '0.0';
  const handoffRate = totalCalls > 0 ? ((handoffCalls / totalCalls) * 100).toFixed(1) : '0.0';

  return { todaysCalls, avgDuration, bookingRate, handoffRate };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CallLogClient({
  calls,
  isGlobalAdmin,
  tenants,
  currentTenantFilter,
}: CallLogClientProps) {
  const router = useRouter();

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('session_start');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Modal state
  const [recordingCall, setRecordingCall] = useState<CallRow | null>(null);
  const [transcriptCall, setTranscriptCall] = useState<CallRow | null>(null);

  // Analytics
  const analytics = useMemo(() => computeAnalytics(calls), [calls]);

  // Sorted calls
  const sortedCalls = useMemo(() => {
    const sorted = [...calls];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'session_start':
          cmp = new Date(a.session_start).getTime() - new Date(b.session_start).getTime();
          break;
        case 'call_duration_seconds':
          cmp = (a.call_duration_seconds ?? 0) - (b.call_duration_seconds ?? 0);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [calls, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function sortIndicator(field: SortField): string {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  function handleTenantChange(tenantId: string) {
    if (tenantId) {
      router.push(`/calls?tenant=${tenantId}`);
    } else {
      router.push('/calls');
    }
  }

  return (
    <div className="space-y-6">
      {/* Platform admin tenant filter */}
      {isGlobalAdmin && tenants.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Tenant:</label>
          <select
            value={currentTenantFilter}
            onChange={(e) => handleTenantChange(e.target.value)}
            className="input-field w-64"
          >
            <option value="">All Tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Today&apos;s Calls</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.todaysCalls}</p>
        </div>
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Duration</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.avgDuration}</p>
        </div>
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Booking Rate</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{analytics.bookingRate}%</p>
        </div>
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Handoff Rate</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{analytics.handoffRate}%</p>
        </div>
      </div>

      {/* Call Log Table */}
      {calls.length === 0 ? (
        <EmptyState
          icon="📞"
          title="No phone calls yet"
          description="Call logs will appear here once patients start calling."
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th
                    className="text-left px-6 py-3 text-sm font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort('session_start')}
                  >
                    Time{sortIndicator('session_start')}
                  </th>
                  <th
                    className="text-left px-6 py-3 text-sm font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort('call_duration_seconds')}
                  >
                    Duration{sortIndicator('call_duration_seconds')}
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                    Patient Phone
                  </th>
                  <th
                    className="text-left px-6 py-3 text-sm font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort('status')}
                  >
                    Status{sortIndicator('status')}
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                    Specialty
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                    Outcome
                  </th>
                  {isGlobalAdmin && !currentTenantFilter && (
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                      Tenant
                    </th>
                  )}
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCalls.map((call) => {
                  const { time, date } = formatTime(call.session_start);
                  const outcome = getCallOutcome(call);

                  return (
                    <tr
                      key={call.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      {/* Time */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{time}</p>
                        <p className="text-xs text-gray-500">{date}</p>
                      </td>

                      {/* Duration */}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDuration(call.call_duration_seconds)}
                      </td>

                      {/* Patient Phone (masked) */}
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                        {call.phone_number ? maskPhone(call.phone_number) : '—'}
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${outcome.badgeClass}`}
                          dir="rtl"
                        >
                          {outcome.label}
                        </span>
                      </td>

                      {/* Specialty */}
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {call.specialty_name_en ?? call.specialty_name_ar ?? '—'}
                      </td>

                      {/* Outcome / Chief Complaint */}
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate" dir="rtl">
                        {call.chief_complaint_ar ?? (call.handoff_reason ?? '—')}
                      </td>

                      {/* Tenant (platform admin only) */}
                      {isGlobalAdmin && !currentTenantFilter && (
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {call.tenant_name ?? '—'}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {call.recording_url && (
                            <button
                              onClick={() => setRecordingCall(call)}
                              className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                            >
                              Listen
                            </button>
                          )}
                          {call.transcript_full && (
                            <button
                              onClick={() => setTranscriptCall(call)}
                              className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                            >
                              Transcript
                            </button>
                          )}
                          {call.booking_id && (
                            <a
                              href={`/bookings?highlight=${call.booking_id}`}
                              className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                            >
                              Booking
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recording Modal */}
      <Modal
        open={recordingCall !== null}
        onClose={() => setRecordingCall(null)}
        title="Call Recording"
        maxWidth="max-w-lg"
      >
        {recordingCall && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Call Time</p>
                <p className="text-sm font-medium">
                  {new Date(recordingCall.session_start).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-medium">
                  {formatDuration(recordingCall.call_duration_seconds)}
                </p>
              </div>
              {recordingCall.phone_number && (
                <div>
                  <p className="text-xs text-gray-500">Patient Phone</p>
                  <p className="text-sm font-medium font-mono">
                    {maskPhone(recordingCall.phone_number)}
                  </p>
                </div>
              )}
              {recordingCall.call_sid && (
                <div>
                  <p className="text-xs text-gray-500">Call SID</p>
                  <p className="text-sm font-medium font-mono text-gray-500 truncate">
                    {recordingCall.call_sid}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                className="w-full"
                src={`/api/admin/calls/${recordingCall.id}/recording`}
              >
                Your browser does not support the audio element.
              </audio>
              <p className="text-xs text-gray-400 mt-2">
                Audio is proxied through the admin server for security.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Transcript Modal */}
      <Modal
        open={transcriptCall !== null}
        onClose={() => setTranscriptCall(null)}
        title="Call Transcript"
        maxWidth="max-w-2xl"
      >
        {transcriptCall && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Call Time</p>
                <p className="text-sm font-medium">
                  {new Date(transcriptCall.session_start).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-medium">
                  {formatDuration(transcriptCall.call_duration_seconds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCallOutcome(transcriptCall).badgeClass}`}
                >
                  {getCallOutcome(transcriptCall).label}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <TranscriptDisplay transcript={transcriptCall.transcript_full ?? ''} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Transcript Display ─────────────────────────────────────────────────────

interface TranscriptLine {
  role: 'system' | 'patient' | 'agent';
  text: string;
}

function parseTranscript(raw: string): TranscriptLine[] {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const trimmed = line.trim();

    // Try to detect role from prefix patterns like "Patient:", "Agent:", "System:"
    if (/^(patient|مريض)\s*:/i.test(trimmed)) {
      return { role: 'patient' as const, text: trimmed.replace(/^(patient|مريض)\s*:\s*/i, '') };
    }
    if (/^(agent|triaji|نظام|مساعد)\s*:/i.test(trimmed)) {
      return { role: 'agent' as const, text: trimmed.replace(/^(agent|triaji|نظام|مساعد)\s*:\s*/i, '') };
    }
    if (/^(system)\s*:/i.test(trimmed)) {
      return { role: 'system' as const, text: trimmed.replace(/^(system)\s*:\s*/i, '') };
    }

    // Fallback: treat as system/unknown
    return { role: 'system' as const, text: trimmed };
  });
}

function TranscriptDisplay({ transcript }: { transcript: string }) {
  const lines = parseTranscript(transcript);

  if (lines.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">No transcript available.</p>
    );
  }

  const roleStyles: Record<TranscriptLine['role'], { bg: string; label: string; align: string }> = {
    patient: { bg: 'bg-blue-50 border-blue-200', label: 'Patient', align: 'mr-8' },
    agent: { bg: 'bg-teal-50 border-teal-200', label: 'Triajji', align: 'ml-8' },
    system: { bg: 'bg-gray-50 border-gray-200', label: 'System', align: 'mx-4' },
  };

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      {lines.map((line, idx) => {
        const style = roleStyles[line.role];
        return (
          <div key={idx} className={`${style.align}`}>
            <div className={`rounded-lg border p-3 ${style.bg}`}>
              <p className="text-xs font-semibold text-gray-500 mb-1">{style.label}</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap" dir="auto">
                {line.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
