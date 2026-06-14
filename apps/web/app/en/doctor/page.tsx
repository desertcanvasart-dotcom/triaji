import Link from 'next/link';

export default function DoctorLandingPage() {
  return (
    <div className="min-h-screen bg-white" dir="ltr">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold text-navy-500"
          >
            Triajji
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/en/doctor/login"
              className="px-4 py-2 text-sm font-medium text-navy-500 border border-navy-500 rounded-lg hover:bg-navy-50 transition-colors"
            >
              Doctor login
            </Link>
            <Link
              href="/en/doctor/register"
              className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors"
            >
              Register as a doctor
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-500 leading-tight mb-6">
            Connect with your patients smarter
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl mx-auto">
            Triajji gives you a complete patient summary before every consultation — based on their symptoms, medical history, and risk level.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/en/doctor/register"
              className="px-8 py-3 text-lg font-semibold text-white bg-teal-500 rounded-xl hover:bg-teal-600 transition-colors"
            >
              Register as a doctor — free
            </Link>
            <Link
              href="/en/doctor/login"
              className="px-8 py-3 text-lg font-semibold text-navy-500 border-2 border-navy-500 rounded-xl hover:bg-navy-50 transition-colors"
            >
              Login
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
              Pre-consultation summary
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Review your patient's symptoms, risk level, and specialty recommendation before they walk in — no need to start from scratch.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-navy-500 mb-3">
              Instant walk-in assessment
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Run a triage assessment on a walk-in patient right in your clinic and get an organized summary in under a minute.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-bold text-navy-500 mb-3">
              Manage your appointments
            </h3>
            <p className="text-gray-600 leading-relaxed">
              View your upcoming appointments via Triajji and manage your availability from a simple dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-navy-500 text-center mb-14">
            How does it work?
          </h2>
          <div className="flex flex-col gap-12">
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-bold">
                1
              </div>
              <p className="text-lg text-gray-700 pt-2">
                Register with your Egyptian Medical Syndicate number
              </p>
            </div>
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-bold">
                2
              </div>
              <p className="text-lg text-gray-700 pt-2">
                Review your patient summaries before every consultation
              </p>
            </div>
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center text-xl font-bold">
                3
              </div>
              <p className="text-lg text-gray-700 pt-2">
                Work more efficiently — save your time and your patients' time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Registration CTA Banner */}
      <section className="py-16 px-4 bg-teal-500">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
            Start for free — no fees for doctors during the beta phase
          </h2>
          <Link
            href="/en/doctor/register"
            className="inline-block px-10 py-4 text-lg font-bold text-teal-500 bg-white rounded-xl hover:bg-gray-50 transition-colors"
          >
            Register now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-navy-500">
        <p className="text-center text-sm text-gray-300">
          © 2026 Triajji — All rights reserved
        </p>
      </footer>
    </div>
  );
}
