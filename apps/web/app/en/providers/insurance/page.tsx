import ProviderPageTemplate from '@/components/providers/ProviderPageTemplate';
import type { ProviderContent } from '@/components/providers/ProviderPageTemplate';

const CONTENT: ProviderContent = {
  hero: {
    badge: 'For Insurance Companies',
    title: 'Your Gateway to Integration with Egypt\'s Healthcare Ecosystem',
    subtitle: 'Triajji provides policy verification, pre-authorization requests, and claims processing — from all service providers in our network',
    cta: 'Contact Us for Integration',
    ctaHref: '/en/contact',
  },
  painPoints: [
    { icon: '📞', title: 'Manual Policy Verification', description: 'The clinic calls to verify — and sometimes the line is busy while the patient waits' },
    { icon: '📄', title: 'Paper-Based Claims', description: 'Piles of paper invoices requiring manual review — slow and error-prone' },
    { icon: '🏝️', title: 'Disconnected from Providers', description: 'No unified channel with hospitals, clinics, and labs' },
  ],
  features: [
    { icon: '✅', title: 'Instant Policy Verification', description: 'Providers verify the patient\'s policy on Triajji — instant response' },
    { icon: '📋', title: 'Digital Pre-Authorization Requests', description: 'Providers submit pre-auth requests digitally — and your team responds from the portal' },
    { icon: '💰', title: 'Unified Claims Processing', description: 'All claims from Triajji providers in one dashboard — organized and categorized' },
    { icon: '🔄', title: 'Automatic Periodic Settlement', description: 'Monthly settlement reports are generated automatically for each provider' },
    { icon: '📊', title: 'Claims Analytics', description: 'Most claimed services, approval rates, and time-based trends' },
    { icon: '🔌', title: 'Direct API Integration', description: 'When you sign the API agreement, direct and synchronized connection with your system' },
  ],
  steps: [
    { number: '1', title: 'Company Registration', description: 'Register your company with coverage details and provider network' },
    { number: '2', title: 'Use the Portal', description: 'Your team reviews and responds to requests from a dedicated dashboard' },
    { number: '3', title: 'API Integration (Optional)', description: 'When you sign the agreement, we connect directly with your system' },
  ],
  proofStats: [
    { value: '5', label: 'Insurance Companies Registered' },
    { value: '24 hr', label: 'Pre-Authorization SLA' },
    { value: '100%', label: 'Digital Claims Tracking' },
  ],
};

function InsuranceSVG() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-64 h-64 animate-[float_4s_ease-in-out_infinite]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield */}
      <path
        d="M100 30 L150 55 V110 C150 140 130 165 100 175 C70 165 50 140 50 110 V55 Z"
        fill="white"
        fillOpacity="0.15"
        stroke="#B45309"
        strokeWidth="2"
      />
      {/* Checkmark */}
      <path d="M80 100 L95 115 L125 80" stroke="#B45309" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Connected nodes */}
      <circle cx="30" cy="60" r="8" fill="#B45309" fillOpacity="0.3" />
      <circle cx="170" cy="60" r="8" fill="#B45309" fillOpacity="0.3" />
      <circle cx="30" cy="150" r="8" fill="#B45309" fillOpacity="0.3" />
      <circle cx="170" cy="150" r="8" fill="#B45309" fillOpacity="0.3" />
      {/* Connection lines */}
      <line x1="38" y1="60" x2="50" y2="65" stroke="#B45309" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.4" />
      <line x1="162" y1="60" x2="150" y2="65" stroke="#B45309" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.4" />
      <line x1="38" y1="150" x2="50" y2="130" stroke="#B45309" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.4" />
      <line x1="162" y1="150" x2="150" y2="130" stroke="#B45309" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.4" />
    </svg>
  );
}

export default function InsurancePageEn() {
  return (
    <ProviderPageTemplate
      lang="en"
      content={CONTENT}
      illustration={<InsuranceSVG />}
      accentColor="#B45309"
      accentClass="bg-amber-800"
      accentLight="bg-amber-50"
      accentText="text-amber-800"
    />
  );
}
