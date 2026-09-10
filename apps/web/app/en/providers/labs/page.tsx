import ProviderPageTemplate from '@/components/providers/ProviderPageTemplate';
import type { ProviderContent } from '@/components/providers/ProviderPageTemplate';

const CONTENT: ProviderContent = {
  hero: {
    badge: 'For Labs',
    title: 'Connect Your Lab to Thousands of Doctors on DoctorTrio',
    subtitle: 'Orders come to you online, patients book their appointments, and results are automatically returned to the patient record',
    cta: 'Register Your Lab Now',
    ctaHref: '/en/contact',
  },
  painPoints: [
    { icon: '📄', title: 'Paper-Based Orders', description: 'The doctor writes a paper order, the patient carries it, and sometimes it gets lost on the way' },
    { icon: '📞', title: 'Manual Result Notifications', description: 'A staff member calls each patient individually — wasting time and sometimes missing someone' },
    { icon: '🏝️', title: 'Disconnected from the Ecosystem', description: 'The doctor doesn\'t know if results are ready or not — and the patient is stuck in the middle' },
  ],
  features: [
    { icon: '📋', title: 'Digital Order Intake', description: 'Orders come directly from the doctor with full details — no paper needed' },
    { icon: '📅', title: 'Integrated Appointment Booking', description: 'Patients book their lab appointment through DoctorTrio directly' },
    { icon: '⚡', title: 'Automatic Result Delivery', description: 'Results are sent to the patient record and the doctor automatically — no phone calls' },
    { icon: '🔗', title: 'Connected to the Doctor Network', description: 'Every doctor registered on DoctorTrio can send you orders directly' },
    { icon: '💰', title: 'Online Invoicing & Payment', description: 'Patients pay before the visit — no money left waiting' },
    { icon: '📊', title: 'Performance Reports', description: 'Order count, turnaround time, and revenue — all in one report' },
  ],
  steps: [
    { number: '1', title: 'Register Your Lab', description: 'Add your test catalog and prices — from the ready-made list or manually' },
    { number: '2', title: 'Activate Reception', description: 'Your lab receptionist receives orders directly from the screen' },
    { number: '3', title: 'Deliver Results', description: 'Upload the results and they are automatically sent to the patient and doctor' },
  ],
  proofStats: [
    { value: '35+', label: 'Test Types in Catalog' },
    { value: '0', label: 'Paper Required' },
    { value: '100%', label: 'Automatic Notifications' },
  ],
};

function LabSVG() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-64 h-64 animate-[float_4s_ease-in-out_infinite]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Test tube 1 */}
      <rect x="55" y="50" width="20" height="80" rx="10" fill="white" fillOpacity="0.15" stroke="#059669" strokeWidth="2" />
      <rect x="55" y="90" width="20" height="40" rx="10" fill="#059669" fillOpacity="0.4" />
      {/* Test tube 2 */}
      <rect x="90" y="40" width="20" height="90" rx="10" fill="white" fillOpacity="0.15" stroke="#059669" strokeWidth="2" />
      <rect x="90" y="85" width="20" height="45" rx="10" fill="#059669" fillOpacity="0.5" />
      {/* Test tube 3 */}
      <rect x="125" y="55" width="20" height="75" rx="10" fill="white" fillOpacity="0.15" stroke="#059669" strokeWidth="2" />
      <rect x="125" y="95" width="20" height="35" rx="10" fill="#059669" fillOpacity="0.3" />
      {/* Data dots flowing */}
      <circle cx="65" cy="150" r="4" fill="#059669" fillOpacity="0.8" />
      <circle cx="85" cy="160" r="3" fill="#059669" fillOpacity="0.6" />
      <circle cx="100" cy="155" r="5" fill="#059669" fillOpacity="0.7" />
      <circle cx="120" cy="165" r="3" fill="#059669" fillOpacity="0.5" />
      <circle cx="135" cy="150" r="4" fill="#059669" fillOpacity="0.8" />
      {/* Connecting lines */}
      <path d="M65 150 L85 160 L100 155 L120 165 L135 150" stroke="#059669" strokeWidth="1.5" strokeDasharray="3 3" fillOpacity="0" />
    </svg>
  );
}

export default function LabsPageEn() {
  return (
    <ProviderPageTemplate
      lang="en"
      content={CONTENT}
      illustration={<LabSVG />}
      accentColor="#059669"
      accentClass="bg-emerald-600"
      accentLight="bg-emerald-50"
      accentText="text-emerald-700"
    />
  );
}
