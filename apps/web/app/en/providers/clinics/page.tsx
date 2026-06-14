import ProviderPageTemplate from '@/components/providers/ProviderPageTemplate';
import type { ProviderContent } from '@/components/providers/ProviderPageTemplate';

const CONTENT: ProviderContent = {
  hero: {
    badge: 'For Clinics',
    title: 'Your Clinic Deserves a Smart System That Lets You Focus on the Patient',
    subtitle: 'Instant waitlist, online bookings, invoices, and reports — all without complexity',
    cta: 'Register Your Clinic for Free',
    ctaHref: '/en/register/provider',
  },
  painPoints: [
    { icon: '📞', title: 'Phone-Based Bookings', description: 'Your receptionist spends half the day on the phone and appointments are still chaotic' },
    { icon: '✍️', title: 'Manual Invoicing', description: 'Calculating amounts manually, paper receipts, and no end-of-day report' },
    { icon: '🧾', title: 'No Financial Visibility', description: 'You don\'t know what you earned this week or month — numbers aren\'t in one place' },
  ],
  features: [
    { icon: '👥', title: 'Instant Waitlist', description: 'Add a patient to the queue with one tap — and the patient knows their turn via WhatsApp' },
    { icon: '📅', title: 'Online + Walk-in Bookings', description: 'Patients book online or walk in without an appointment — all on the same screen' },
    { icon: '💰', title: 'Automatic Invoicing', description: 'Invoices are generated instantly and sent to the patient as a PDF via WhatsApp' },
    { icon: '📊', title: 'Daily & Monthly Reports', description: 'Revenue, expenses, net profit — one-click Excel report' },
    { icon: '🏢', title: 'Multi-Doctor Support', description: 'Clinic with multiple doctors? Each doctor gets their own dashboard, schedule, and queue' },
    { icon: '💳', title: 'Online Payment', description: 'Patients pay via Fawry, card, or Vodafone Cash — before or after the visit' },
  ],
  steps: [
    { number: '1', title: 'Register Your Clinic', description: 'Clinic name, specialty, doctors — in 5 minutes' },
    { number: '2', title: 'Configure Settings', description: 'Working hours, booking mode, prices — all from the dashboard' },
    { number: '3', title: 'Start Receiving Patients', description: 'The receptionist opens the screen and starts — no complex training needed' },
  ],
  proofStats: [
    { value: '5 min', label: 'Setup Time' },
    { value: '0', label: 'Training Required' },
    { value: '3x', label: 'Reception Speed' },
  ],
};

function ClinicSVG() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-64 h-64 animate-[float_4s_ease-in-out_infinite]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Desk */}
      <rect x="30" y="110" width="140" height="10" rx="4" fill="white" fillOpacity="0.2" stroke="#4F46E5" strokeWidth="2" />
      <rect x="50" y="120" width="8" height="40" rx="2" fill="#4F46E5" fillOpacity="0.5" />
      <rect x="142" y="120" width="8" height="40" rx="2" fill="#4F46E5" fillOpacity="0.5" />
      {/* Monitor */}
      <rect x="65" y="60" width="70" height="50" rx="6" fill="white" fillOpacity="0.15" stroke="#4F46E5" strokeWidth="2" />
      <rect x="96" y="110" width="8" height="10" fill="#4F46E5" fillOpacity="0.5" />
      {/* Queue number on screen */}
      <text x="100" y="92" textAnchor="middle" fill="#4F46E5" fontSize="24" fontWeight="bold">07</text>
      {/* People circles */}
      <circle cx="30" cy="170" r="10" fill="#4F46E5" fillOpacity="0.3" />
      <circle cx="55" cy="170" r="10" fill="#4F46E5" fillOpacity="0.4" />
      <circle cx="80" cy="170" r="10" fill="#4F46E5" fillOpacity="0.5" />
    </svg>
  );
}

export default function ClinicsPageEn() {
  return (
    <ProviderPageTemplate
      lang="en"
      content={CONTENT}
      illustration={<ClinicSVG />}
      accentColor="#4F46E5"
      accentClass="bg-indigo-600"
      accentLight="bg-indigo-50"
      accentText="text-indigo-700"
    />
  );
}
