import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ChainBranchFinder from '@/components/lab/ChainBranchFinder';

// ─── Arabic Branch Finder Page ──────────────────────────────────────────────

interface Props {
  params: Promise<{ labSlug: string }>;
}

export default async function LabBranchesPageAr({ params }: Props) {
  const { labSlug } = await params;
  const supabase = createServerClient();

  // Check if this slug is a chain code
  const { data: chain } = await supabase
    .from('lab_chains')
    .select('code, name_ar, name_en')
    .eq('code', labSlug)
    .eq('is_active', true)
    .single();

  // Also try matching by tenant slug (chain lab may have a tenant entry)
  let chainData = chain;
  if (!chainData) {
    // Attempt to find a tenant with this slug that has a linked chain
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name_ar, name_en, slug')
      .eq('slug', labSlug)
      .in('tier', ['lab', 'radiology'])
      .eq('is_active', true)
      .single();

    if (!tenant) notFound();

    // Check if tenant is a chain lab
    const { data: linkedChain } = await supabase
      .from('lab_chains')
      .select('code, name_ar, name_en')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!linkedChain) notFound();
    chainData = linkedChain;
  }

  if (!chainData) notFound();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-teal-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href={`/ar/lab/${labSlug}`}
            className="text-teal-200 hover:text-white text-sm mb-2 inline-block"
          >
            ← رجوع
          </Link>
          <h1 className="text-xl font-bold">فروع {chainData.name_ar}</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <ChainBranchFinder
          chainCode={chainData.code}
          chainNameAr={chainData.name_ar}
          chainNameEn={chainData.name_en}
          lang="ar"
        />
      </div>
    </div>
  );
}
