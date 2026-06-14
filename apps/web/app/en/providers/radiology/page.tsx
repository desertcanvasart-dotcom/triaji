import ProviderPageTemplate from '@/components/providers/ProviderPageTemplate';
import type { ProviderContent } from '@/components/providers/ProviderPageTemplate';

const CONTENT: ProviderContent = {
  hero: {
    badge: 'For Radiology Centers',
    title: 'Connect Your Center to All Triajji Doctors — Radiology Appointments Without Phone Calls',
    subtitle: 'The doctor orders the scan, the patient books their appointment with you, and the report goes back to the doctor automatically',
    cta: 'Register Your Center Now',
    ctaHref: '/en/register/provider',
  },
  painPoints: [
    { icon: '📞', title: 'Phone-Based Bookings', description: 'The receptionist spends their time answering calls instead of serving the patient in front of them' },
    { icon: '📄', title: 'Paper-Based Reports', description: 'The patient takes the report on paper and has to deliver it to the doctor themselves' },
    { icon: '⏰', title: 'Suddenly Full Schedules', description: 'No visibility into available times — the patient calls and sometimes there\'s no slot' },
  ],
  features: [
    { icon: '📋', title: 'Digital Radiology Orders', description: 'The doctor sends you the order directly with their diagnosis and full requirements' },
    { icon: '📅', title: 'Smart Appointment Scheduling', description: 'Patients see available times and book what suits them — 24/7' },
    { icon: '🖼️', title: 'Digital Report Delivery', description: 'Reports and images are sent to the doctor and patient automatically' },
    { icon: '💰', title: 'Pre-Payment Online', description: 'Patients pay at booking time — no wasted time at the cashier' },
    { icon: '🔗', title: 'Connected to the Referral Network', description: 'Every doctor on Triajji can refer their patients to your center directly' },
    { icon: '📊', title: 'Revenue Reports', description: 'Daily and monthly revenue and performance per machine — all in one dashboard' },
  ],
  steps: [
    { number: '1', title: 'Register Your Center', description: 'Add your services (CT, MRI, ultrasound...) and appointment times' },
    { number: '2', title: 'Receive Orders', description: 'Orders come from doctors directly to your reception dashboard' },
    { number: '3', title: 'Deliver Reports Digitally', description: 'Upload the report and images — the doctor and patient receive them instantly' },
  ],
  proofStats: [
    { value: '19+', label: 'Radiology Services in Catalog' },
    { value: '24/7', label: 'Booking Available' },
    { value: '0', label: 'Paper in the Process' },
  ],
};

function RadiologySVG() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-64 h-64 animate-[float_4s_ease-in-out_infinite]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* MRI ring outer */}
      <ellipse cx="100" cy="100" rx="70" ry="70" fill="none" stroke="#7C3AED" strokeWidth="3" strokeOpacity="0.3" />
      {/* MRI ring inner */}
      <ellipse cx="100" cy="100" rx="50" ry="50" fill="white" fillOpacity="0.1" stroke="#7C3AED" strokeWidth="2" />
      {/* Scan lines */}
      <line x1="100" y1="50" x2="100" y2="150" stroke="#7C3AED" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.5" />
      <line x1="50" y1="100" x2="150" y2="100" stroke="#7C3AED" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.5" />
      {/* Center body silhouette */}
      <ellipse cx="100" cy="90" rx="15" ry="18" fill="#7C3AED" fillOpacity="0.2" />
      <rect x="88" y="108" width="24" height="30" rx="8" fill="#7C3AED" fillOpacity="0.15" />
      {/* Scan glow dots */}
      <circle cx="100" cy="50" r="4" fill="#7C3AED" fillOpacity="0.8" />
      <circle cx="150" cy="100" r="4" fill="#7C3AED" fillOpacity="0.8" />
      <circle cx="100" cy="150" r="4" fill="#7C3AED" fillOpacity="0.8" />
      <circle cx="50" cy="100" r="4" fill="#7C3AED" fillOpacity="0.8" />
    </svg>
  );
}

export default function RadiologyPageEn() {
  return (
    <ProviderPageTemplate
      lang="en"
      content={CONTENT}
      illustration={<RadiologySVG />}
      accentColor="#7C3AED"
      accentClass="bg-purple-600"
      accentLight="bg-purple-50"
      accentText="text-purple-700"
    />
  );
}
