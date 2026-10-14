'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from '@triaji/shared/i18n';

interface DisplayData {
  doctor: { name_ar: string | null; name_en: string | null; title_ar: string | null };
  clinic: { ar: string | null; en: string | null };
  now_serving: { number: number; name: string } | null;
  up_next: { number: number; name: string }[];
  waiting_count: number;
}

const POLL_MS = 5_000;

const T = {
  nowServing:  { ar: 'الدور الآن', en: 'Now serving' },
  pleaseEnter: { ar: 'اتفضل ادخل', en: 'Please come in' },
  upNext:      { ar: 'الدور الجاي', en: 'Up next' },
  waiting:     { ar: 'في الانتظار', en: 'waiting' },
  noOne:       { ar: 'استنى شوية — هننادي على أول رقم حالاً', en: 'Please wait — the first number will be called shortly' },
  emptyNext:   { ar: 'مفيش حد في الانتظار', en: 'No one waiting' },
  enableSound: { ar: 'اضغط لتشغيل الصوت وملء الشاشة', en: 'Tap to enable sound and full screen' },
  invalid:     { ar: 'الرابط ده مش صالح. افتح رابط الشاشة من صفحة "يوم العمل".', en: 'This link is not valid. Open the screen link from the "Today" page.' },
  offline:     { ar: 'جاري إعادة الاتصال...', en: 'Reconnecting...' },
  doctor:      { ar: 'د.', en: 'Dr.' },
};

const NUM_LOCALE: Record<Lang, string> = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' };

/** Two-tone chime from the Web Audio API — no audio file to load. */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 660].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.35 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.35);
    osc.stop(now + i * 0.35 + 0.65);
  });
}

export default function QueueDisplay({ token, lang }: { token: string; lang: Lang }) {
  const t = (k: keyof typeof T) => T[k][lang];
  const [data, setData] = useState<DisplayData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [offline, setOffline] = useState(false);
  const [armed, setArmed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const audio = useRef<AudioContext | null>(null);
  const lastServing = useRef<number | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (res.status === 404) {
        setInvalid(true);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as DisplayData;
      const serving = next.now_serving?.number ?? null;
      // Chime and flash when a new number is called (not on the first load).
      if (lastServing.current !== undefined && serving !== null && serving !== lastServing.current) {
        setFlash(true);
        setTimeout(() => setFlash(false), 4000);
        if (audio.current) playChime(audio.current);
      }
      lastServing.current = serving;
      setData(next);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [token]);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    const clock = setInterval(() => setNow(new Date()), 15_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  function arm() {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = new Ctx();
      playChime(audio.current);
    } catch {
      // Sound is optional.
    }
    document.documentElement.requestFullscreen?.().catch(() => {});
    setArmed(true);
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  if (invalid) {
    return (
      <main dir={dir} className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-8 text-center">
        <p className="text-2xl max-w-xl">{t('invalid')}</p>
      </main>
    );
  }

  const doctorName = lang === 'en' ? (data?.doctor.name_en ?? data?.doctor.name_ar) : data?.doctor.name_ar;
  const clinicName = lang === 'en' ? (data?.clinic.en ?? data?.clinic.ar) : data?.clinic.ar;
  const time = now.toLocaleTimeString(NUM_LOCALE[lang], { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' });

  return (
    <main dir={dir} className="min-h-screen bg-slate-950 text-white flex flex-col select-none overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 sm:px-10 py-5 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-2xl sm:text-4xl font-bold truncate">
            {doctorName ? `${t('doctor')} ${doctorName}` : ' '}
          </p>
          {clinicName && <p className="text-base sm:text-xl text-slate-400 truncate">{clinicName}</p>}
        </div>
        <div className="text-end shrink-0">
          <p className="text-3xl sm:text-5xl font-semibold tabular-nums">{time}</p>
          {offline && <p className="text-sm text-amber-400 mt-1">{t('offline')}</p>}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 sm:p-10">
        {/* Now serving */}
        <section
          className={`lg:col-span-2 rounded-3xl flex flex-col items-center justify-center text-center p-8 transition-colors duration-700 ${
            flash ? 'bg-amber-500 text-slate-950' : 'bg-teal-700'
          }`}
        >
          <p className={`text-3xl sm:text-5xl font-semibold ${flash ? 'text-slate-900' : 'text-teal-100'}`}>{t('nowServing')}</p>
          {data?.now_serving ? (
            <>
              <p className="font-black leading-none tabular-nums text-[9rem] sm:text-[14rem] lg:text-[18rem] my-4">
                {data.now_serving.number}
              </p>
              {data.now_serving.name && <p className="text-4xl sm:text-6xl font-bold">{data.now_serving.name}</p>}
              <p className={`text-2xl sm:text-3xl mt-4 ${flash ? 'text-slate-900' : 'text-teal-100'}`}>{t('pleaseEnter')}</p>
            </>
          ) : (
            <p className="text-3xl sm:text-4xl text-teal-100 mt-8 max-w-2xl">{t('noOne')}</p>
          )}
        </section>

        {/* Up next */}
        <section className="rounded-3xl bg-slate-900 p-6 sm:p-8 flex flex-col">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-200">{t('upNext')}</h2>
            {data && data.waiting_count > 0 && (
              <p className="text-lg sm:text-2xl text-slate-400 tabular-nums">
                {data.waiting_count} {t('waiting')}
              </p>
            )}
          </div>
          {data && data.up_next.length > 0 ? (
            <ol className="space-y-4">
              {data.up_next.map((p) => (
                <li key={p.number} className="flex items-center gap-5 rounded-2xl bg-slate-800 px-5 py-4">
                  <span className="text-5xl sm:text-6xl font-black tabular-nums text-amber-400 min-w-[4ch]">{p.number}</span>
                  <span className="text-2xl sm:text-3xl text-slate-200 truncate">{p.name}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-2xl text-slate-500">{t('emptyNext')}</p>
          )}
        </section>
      </div>

      {!armed && (
        <button
          type="button"
          onClick={arm}
          className="fixed bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-white/10 hover:bg-white/20 px-6 py-3 text-lg text-white backdrop-blur"
        >
          🔔 {t('enableSound')}
        </button>
      )}
    </main>
  );
}
