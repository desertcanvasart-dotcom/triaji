import ProviderPageTemplate from '@/components/providers/ProviderPageTemplate';
import type { ProviderContent } from '@/components/providers/ProviderPageTemplate';

const CONTENT: ProviderContent = {
  hero: {
    badge: 'For Hospitals',
    title: 'Transform Your Hospital into a Smart Healthcare Institution',
    subtitle: 'DoctorTrio connects your patients with your doctors, streamlines operations, and integrates with insurance and labs \u2014 all in one system',
    cta: 'Register Your Hospital Now',
    ctaHref: '/en/register/provider',
  },
  painPoints: [
    { icon: '\uD83D\uDCCB', title: 'Lost Paper Records', description: 'Patients arrive without medical history, and doctors start from scratch every visit' },
    { icon: '\u231B', title: 'Chaotic Appointment Management', description: 'Phone bookings, sudden cancellations, and wasted gaps in doctors\u2019 schedules' },
    { icon: '\uD83D\uDD0C', title: 'Disconnected Systems', description: 'Labs, pharmacy, and insurance each operate in isolation \u2014 no unified information flow' },
  ],
  features: [
    { icon: '\uD83E\uDDE0', title: 'Smart Pre-Arrival Triage', description: 'Patients triage their symptoms online \u2014 doctors receive a ready summary' },
    { icon: '\uD83D\uDCC5', title: 'Integrated Appointment Management', description: 'Online bookings and walk-ins \u2014 all in one dashboard' },
    { icon: '\uD83D\uDD17', title: 'HIS Integration', description: 'Compatible with Shifa, Neuron, and other systems via API' },
    { icon: '\uD83D\uDEE1\uFE0F', title: 'Insurance Processing', description: 'Policy verification, pre-authorization, and claims submission \u2014 automated' },
    { icon: '\uD83D\uDEA8', title: 'ICU Management', description: 'Real-time ICU bed availability for registered hospitals' },
    { icon: '\uD83D\uDCCA', title: 'Reports & Analytics', description: 'Doctor performance, revenue, and patient satisfaction \u2014 all in one report' },
  ],
  steps: [
    { number: '1', title: 'Register Your Hospital', description: 'Enter your hospital details and doctors in 10 minutes' },
    { number: '2', title: 'Connect Your Current System', description: 'We connect DoctorTrio to your HIS or you start with the base system' },
    { number: '3', title: 'Go Live', description: 'Your patients book, triage, and reach you \u2014 instantly' },
  ],
  proofStats: [
    { value: '8', label: 'HIS Types Supported' },
    { value: '100%', label: 'Data Encryption' },
    { value: '15 min', label: 'Average Setup Time' },
  ],
};

function HospitalSVG() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-64 h-64 animate-[float_4s_ease-in-out_infinite]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="40" y="60" width="120" height="120" rx="8" fill="white" fillOpacity="0.15" stroke="#0D7A7A" strokeWidth="2" />
      <rect x="88" y="30" width="24" height="50" rx="4" fill="#0D7A7A" />
      <rect x="76" y="42" width="48" height="24" rx="4" fill="#0D7A7A" />
      <rect x="56" y="80" width="20" height="20" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="90" y="80" width="20" height="20" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="124" y="80" width="20" height="20" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="56" y="112" width="20" height="20" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="90" y="112" width="20" height="20" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="124" y="112" width="20" height="20" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="85" y="148" width="30" height="32" rx="4" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

export default function HospitalsPageEn() {
  return (
    <ProviderPageTemplate
      lang="en"
      content={CONTENT}
      illustration={<HospitalSVG />}
      accentColor="#0D7A7A"
      accentClass="bg-teal-600"
      accentLight="bg-teal-50"
      accentText="text-teal-700"
    />
  );
}
