import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo & Title */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-teal-500 mb-3">تريجي</h1>
        <p className="text-xl text-navy-400">
          الدكتور الصح، في المكان الصح
        </p>
      </div>

      {/* Disclaimer */}
      <div className="max-w-lg bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800 text-center leading-relaxed">
        <p className="font-semibold mb-1">تنبيه مهم</p>
        <p>
          تريجي مرشد طبي ذكي — مش بديل عن الدكتور. مش بيشخّص ولا بيكتب علاج.
        </p>
        <p className="mt-1">
          لو عندك حالة طوارئ، اتصل بـ <span className="ltr-nums font-bold">123</span> فوراً.
        </p>
      </div>

      {/* Start Button */}
      <Link
        href="/ar/chat"
        className="bg-teal-500 hover:bg-teal-600 text-white font-semibold text-lg px-10 py-4 rounded-xl transition-colors shadow-lg hover:shadow-xl"
      >
        ابدأ الفرز الطبي
      </Link>

      {/* Footer Disclaimer */}
      <footer className="mt-16 text-center text-xs text-gray-400 max-w-md leading-relaxed">
        <p>هذا المساعد لا يحل محل الطبيب ولا يقدم تشخيصاً طبياً.</p>
        <p>أعراض الطوارئ تتطلب رعاية فورية في أقرب مستشفى.</p>
      </footer>
    </main>
  );
}
