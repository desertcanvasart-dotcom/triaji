import Link from 'next/link';
import DoctorFeatureGrid from '@/components/landing/DoctorFeatureGrid';

export default function DoctorLandingPage() {
  return (
    <div className="min-h-screen bg-white font-cairo">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold text-navy-500"
          >
            دكتور تريو
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/ar/doctor/login"
              className="px-4 py-2 text-sm font-medium text-navy-500 border border-navy-500 rounded-lg hover:bg-navy-50 transition-colors"
            >
              دخول الأطباء
            </Link>
            <Link
              href="/ar/doctor/register"
              className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors"
            >
              سجّل كطبيب
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-500 leading-tight mb-6">
            وصّل مع مرضاك بشكل أذكى
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl mx-auto">
            دكتور تريو بيوفرلك ملخص طبي شامل لكل مريض قبل الكشف — بناءً على أعراضه، تاريخه الطبي، ودرجة خطورة حالته.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/ar/doctor/register"
              className="px-8 py-3 text-lg font-semibold text-white bg-teal-500 rounded-xl hover:bg-teal-600 transition-colors"
            >
              سجّل كطبيب مجاناً
            </Link>
            <Link
              href="/ar/doctor/login"
              className="px-8 py-3 text-lg font-semibold text-navy-500 border-2 border-navy-500 rounded-xl hover:bg-navy-50 transition-colors"
            >
              دخول
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-navy-500 mb-3">
              ملخص قبل الكشف
            </h3>
            <p className="text-gray-600 leading-relaxed">
              شوف أعراض المريض، درجة الخطورة، والتوصية التخصصية قبل ما يدخل عليك — من غير ما يحكي من الأول.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-navy-500 mb-3">
              تقييم فوري للزيارات الطارئة
            </h3>
            <p className="text-gray-600 leading-relaxed">
              قدّر تشغّل نظام الفرز على مريض قدامك في العيادة وتاخد ملخص منظم في دقيقة.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-bold text-navy-500 mb-3">
              إدارة مواعيدك
            </h3>
            <p className="text-gray-600 leading-relaxed">
              شوف مواعيدك القادمة عبر دكتور تريو وادّر أوقات فراغك من لوحة تحكم بسيطة.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-navy-500 text-center mb-14">
            إزاي بيشتغل؟
          </h2>
          <div className="flex flex-col gap-12">
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-bold">
                1
              </div>
              <p className="text-lg text-gray-700 pt-2">
                سجّل بـ رقم نقابة الأطباء المصرية
              </p>
            </div>
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-bold">
                2
              </div>
              <p className="text-lg text-gray-700 pt-2">
                راجع ملخصات مرضاك قبل كل كشف
              </p>
            </div>
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-bold">
                3
              </div>
              <p className="text-lg text-gray-700 pt-2">
                اشتغل بكفاءة أكتر — وفر وقتك ووقت مرضاك
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Doctor tools (relocated from the homepage) */}
      <DoctorFeatureGrid lang="ar" />

      {/* Registration CTA Banner */}
      <section className="py-16 px-4 bg-teal-500">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
            ابدأ مجاناً — لا يوجد رسوم للأطباء في المرحلة التجريبية
          </h2>
          <Link
            href="/ar/doctor/register"
            className="inline-block px-10 py-4 text-lg font-bold text-teal-500 bg-white rounded-xl hover:bg-gray-50 transition-colors"
          >
            سجّل دلوقتي
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-navy-500">
        <p className="text-center text-sm text-gray-300">
          © 2026 دكتور تريو — جميع الحقوق محفوظة
        </p>
      </footer>
    </div>
  );
}
