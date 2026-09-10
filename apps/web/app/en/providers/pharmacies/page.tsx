import ProviderPageTemplate from '@/components/providers/ProviderPageTemplate';
import type { ProviderContent } from '@/components/providers/ProviderPageTemplate';

const CONTENT: ProviderContent = {
  hero: {
    badge: 'For Pharmacies',
    title: 'The Prescription Arrives Before the Patient',
    subtitle: 'The doctor sends the prescription digitally, your pharmacy prepares it, and the patient comes to collect — no waiting and no errors',
    cta: 'Register Your Pharmacy Now',
    ctaHref: '/en/contact',
  },
  painPoints: [
    { icon: '📄', title: 'Reading Doctor Handwriting', description: 'The pharmacist wastes time decoding handwriting — and sometimes gets the medication name wrong' },
    { icon: '⌛', title: 'Waiting for Preparation', description: 'The patient stands waiting while the pharmacist searches for medications — a frustrating experience' },
    { icon: '📊', title: 'No Inventory Visibility', description: 'No way to know which medications are most in demand to optimize your stock' },
  ],
  features: [
    { icon: '📲', title: 'Digital Prescription Intake', description: 'Prescriptions come directly from the doctor — clear and accurate without handwriting' },
    { icon: '🔔', title: 'Patient Notification When Ready', description: 'The patient gets a WhatsApp message when the prescription is ready — they arrive at the right time' },
    { icon: '✅', title: 'Dispensing Confirmation', description: 'Record the dispensing in the system — and the doctor knows the patient received their medication' },
    { icon: '💰', title: 'Invoicing & Insurance', description: 'Calculate the copay and process insurance — all in the same system' },
    { icon: '📦', title: 'Delivery to Patient', description: 'Your pharmacy offers delivery? The patient orders through DoctorTrio' },
    { icon: '📊', title: 'Sales Reports', description: 'Most requested medications, daily revenue, and customer satisfaction' },
  ],
  steps: [
    { number: '1', title: 'Register Your Pharmacy', description: 'Add your medication catalog from the ready-made list or manually' },
    { number: '2', title: 'Receive Prescriptions', description: 'Prescriptions arrive on your reception dashboard — prepare them and notify the patient' },
    { number: '3', title: 'Record Dispensing', description: 'After pickup, record that the prescription was dispensed — the system is complete' },
  ],
  proofStats: [
    { value: '0', label: 'Reading Errors' },
    { value: '100%', label: 'Automatic Tracking' },
    { value: '3x', label: 'Preparation Speed' },
  ],
};

function PharmacySVG() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-64 h-64 animate-[float_4s_ease-in-out_infinite]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Pill capsule */}
      <rect x="30" y="70" width="70" height="35" rx="17.5" fill="white" fillOpacity="0.15" stroke="#D97706" strokeWidth="2" />
      <rect x="65" y="70" width="35" height="35" rx="17.5" fill="#D97706" fillOpacity="0.4" />
      {/* Phone */}
      <rect x="120" y="50" width="50" height="90" rx="10" fill="white" fillOpacity="0.15" stroke="#D97706" strokeWidth="2" />
      <rect x="126" y="58" width="38" height="66" rx="4" fill="#D97706" fillOpacity="0.1" />
      {/* Rx on phone */}
      <text x="145" y="100" textAnchor="middle" fill="#D97706" fontSize="22" fontWeight="bold">Rx</text>
      {/* Small pills */}
      <circle cx="50" cy="140" r="8" fill="#D97706" fillOpacity="0.3" />
      <circle cx="75" cy="150" r="6" fill="#D97706" fillOpacity="0.4" />
      <circle cx="95" cy="140" r="7" fill="#D97706" fillOpacity="0.25" />
    </svg>
  );
}

export default function PharmaciesPageEn() {
  return (
    <ProviderPageTemplate
      lang="en"
      content={CONTENT}
      illustration={<PharmacySVG />}
      accentColor="#D97706"
      accentClass="bg-amber-600"
      accentLight="bg-amber-50"
      accentText="text-amber-700"
    />
  );
}
