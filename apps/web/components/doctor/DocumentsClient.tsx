'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  specsForClinicMode,
  DOCTOR_DOCUMENT_MAX_BYTES,
  DOCTOR_DOCUMENT_MIME_TYPES,
  type DoctorDocumentSpec,
  type DoctorDocumentStatus,
  type DoctorDocumentType,
} from '@triaji/shared/constants/doctor-documents';

type Lang = 'ar' | 'en';

interface DoctorDocument {
  id: string;
  doc_type: DoctorDocumentType;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: DoctorDocumentStatus;
  review_note: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
}

interface Props {
  lang: Lang;
}

const COPY = {
  title: { ar: 'مستندات التوثيق', en: 'Verification documents' },
  intro: {
    ar: 'ارفع صور أو ملفات PDF واضحة للمستندات دي عشان نقدر نوثّق حسابك. تقدر ترفعهم واحد واحد، وحسابك تحت المراجعة.',
    en: 'Upload clear photos or PDFs of these documents so we can verify your account. You can add them one at a time while your account is under review.',
  },
  progress: { ar: 'المستندات المطلوبة', en: 'Required documents' },
  allDone: {
    ar: 'كل المستندات المطلوبة اترفعت. هنراجعها ونرد عليك.',
    en: 'All required documents are in. We will review them and get back to you.',
  },
  optional: { ar: 'اختياري', en: 'Optional' },
  required: { ar: 'مطلوب', en: 'Required' },
  choose: { ar: 'اختار ملف', en: 'Choose file' },
  replace: { ar: 'استبدال', en: 'Replace' },
  remove: { ar: 'حذف', en: 'Remove' },
  uploading: { ar: 'جاري الرفع...', en: 'Uploading...' },
  statusPending: { ar: 'تحت المراجعة', en: 'Under review' },
  statusApproved: { ar: 'تم القبول', en: 'Approved' },
  statusRejected: { ar: 'مرفوض', en: 'Rejected' },
  backToStatus: { ar: '← رجوع لحالة الحساب', en: '← Back to account status' },
  backToDashboard: { ar: '← رجوع للوحة التحكم', en: '← Back to dashboard' },
  limits: {
    ar: 'صور أو PDF، الحد الأقصى ١٠ ميجابايت للملف',
    en: 'Images or PDF, up to 10MB per file',
  },
  loadError: { ar: 'مش قادرين نحمّل المستندات', en: 'Could not load your documents' },
  tooBig: { ar: 'حجم الملف كبير. الحد الأقصى ١٠ ميجابايت', en: 'File too large. Maximum is 10MB' },
  badMime: {
    ar: 'الملف لازم يكون صورة أو PDF',
    en: 'File must be an image or a PDF',
  },
  migrationPending: {
    ar: 'رفع المستندات لسه مش متاح. جرّب تاني بعد شوية.',
    en: 'Document upload is not available yet. Please try again shortly.',
  },
} as const;

export default function DocumentsClient({ lang }: Props) {
  const isRtl = lang === 'ar';
  const [documents, setDocuments] = useState<DoctorDocument[]>([]);
  const [specs, setSpecs] = useState<DoctorDocumentSpec[]>(specsForClinicMode('independent'));
  const [verificationStatus, setVerificationStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyType, setBusyType] = useState<DoctorDocumentType | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/documents?locale=${lang}`);
      if (!res.ok) {
        setError(COPY.loadError[lang]);
        return;
      }
      const data = await res.json();
      setDocuments(data.documents ?? []);
      setSpecs(specsForClinicMode(data.clinic_mode, Boolean(data.foreign_degree)));
      setVerificationStatus(data.verification_status ?? 'pending');
      setError(data.migration_pending ? COPY.migrationPending[lang] : '');
    } catch {
      setError(COPY.loadError[lang]);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(type: DoctorDocumentType, file: File) {
    setError('');

    if (file.size > DOCTOR_DOCUMENT_MAX_BYTES) {
      setError(COPY.tooBig[lang]);
      return;
    }
    if (!DOCTOR_DOCUMENT_MIME_TYPES.includes(file.type as (typeof DOCTOR_DOCUMENT_MIME_TYPES)[number])) {
      setError(COPY.badMime[lang]);
      return;
    }

    setBusyType(type);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('doc_type', type);

      const res = await fetch(`/api/doctor/documents?locale=${lang}`, { method: 'POST', body });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? COPY.loadError[lang]);
        return;
      }
      await load();
    } catch {
      setError(COPY.loadError[lang]);
    } finally {
      setBusyType(null);
    }
  }

  async function remove(doc: DoctorDocument) {
    setBusyType(doc.doc_type);
    try {
      const res = await fetch(`/api/doctor/documents/${doc.id}?locale=${lang}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? COPY.loadError[lang]);
        return;
      }
      await load();
    } finally {
      setBusyType(null);
    }
  }

  const byType = new Map(documents.map((d) => [d.doc_type, d]));
  const requiredSpecs = specs.filter((s) => s.required);
  const satisfied = requiredSpecs.filter((s) => {
    const doc = byType.get(s.type);
    return doc && doc.status !== 'rejected';
  }).length;

  const backHref = verificationStatus === 'verified'
    ? `/${lang}/doctor/dashboard`
    : `/${lang}/doctor/pending`;
  const backLabel = verificationStatus === 'verified'
    ? COPY.backToDashboard[lang]
    : COPY.backToStatus[lang];

  return (
    <div className="min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <nav className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-teal-600">
            {isRtl ? 'دكتور تريو' : 'DoctorTrio'}
          </Link>
          <Link href={backHref} className="text-sm font-semibold text-gray-500 hover:text-teal-600">
            {backLabel}
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 pt-8 pb-20">
        <h1 className="text-2xl font-bold text-[#1A2F4A] mb-2">{COPY.title[lang]}</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">{COPY.intro[lang]}</p>

        {!loading && requiredSpecs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-gray-700">{COPY.progress[lang]}</span>
              <span className="text-gray-500 ltr-nums" dir="ltr">
                {satisfied} / {requiredSpecs.length}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 transition-all"
                style={{ width: `${(satisfied / requiredSpecs.length) * 100}%` }}
              />
            </div>
            {satisfied === requiredSpecs.length && (
              <p className="text-xs text-teal-700 mt-2">{COPY.allDone[lang]}</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-28 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {specs.map((spec) => (
              <DocumentRow
                key={spec.type}
                lang={lang}
                spec={spec}
                doc={byType.get(spec.type)}
                busy={busyType === spec.type}
                onUpload={(file) => upload(spec.type, file)}
                onRemove={remove}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">{COPY.limits[lang]}</p>
      </main>
    </div>
  );
}

function DocumentRow({
  lang,
  spec,
  doc,
  busy,
  onUpload,
  onRemove,
}: {
  lang: Lang;
  spec: DoctorDocumentSpec;
  doc?: DoctorDocument;
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: (doc: DoctorDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = lang === 'ar' ? spec.label_ar : spec.label_en;
  const hint = lang === 'ar' ? spec.hint_ar : spec.hint_en;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">
            {label}
            <span
              className={`ms-2 text-xs font-normal ${
                spec.required ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {spec.required ? COPY.required[lang] : COPY.optional[lang]}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>
        {doc && <StatusBadge lang={lang} status={doc.status} />}
      </div>

      {doc?.status === 'rejected' && doc.review_note && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{doc.review_note}</p>
      )}

      <div className="flex items-center gap-3 mt-3">
        <input
          ref={inputRef}
          type="file"
          accept={DOCTOR_DOCUMENT_MIME_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={busy || doc?.status === 'approved'}
          onClick={() => inputRef.current?.click()}
          className="text-sm font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? COPY.uploading[lang] : doc ? COPY.replace[lang] : COPY.choose[lang]}
        </button>

        {doc && doc.status !== 'approved' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(doc)}
            className="text-sm text-gray-400 hover:text-red-600 disabled:opacity-40"
          >
            {COPY.remove[lang]}
          </button>
        )}

        {doc && (
          <span className="text-xs text-gray-400 truncate ms-auto max-w-[45%]" dir="ltr">
            {doc.file_name}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ lang, status }: { lang: Lang; status: DoctorDocumentStatus }) {
  const map = {
    pending: { text: COPY.statusPending[lang], className: 'bg-amber-50 text-amber-700' },
    approved: { text: COPY.statusApproved[lang], className: 'bg-teal-50 text-teal-700' },
    rejected: { text: COPY.statusRejected[lang], className: 'bg-red-50 text-red-700' },
  }[status];

  return (
    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${map.className}`}>
      {map.text}
    </span>
  );
}
