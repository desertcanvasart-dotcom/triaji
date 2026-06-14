import { createServerClient } from '@triaji/shared/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ChainBranchFinder from '@/components/lab/ChainBranchFinder';

// ─── English Branch Finder Page ─────────────────────────────────────────────

interface Props {
  params: Promise<{ labSlug: string }>;
}

export default async function LabBranchesPageEn({ params }: Props) {
  const { labSlug } = await params;
  const supabase = createServerClient();

  // Check if this slug is a chain code
  const { data: chain } = await supabase
    .from('lab_chains')
    .select('code, name_ar, name_en')
    .eq('code', labSlug)
    .eq('is_active', true)
    .single();

  // Also try matching by tenant slug
  let chainData = chain;
  if (!chainData) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name_ar, name_en, slug')
      .eq('slug', labSlug)
      .in('tier', ['lab', 'radiology'])
      .eq('is_active', true)
      .single();

    if (!tenant) notFound();

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
    <div className="min-h-screen bg-gray-50" dir="ltr">
      {/* Header */}
      <header className="bg-teal-700 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href={`/en/lab/${labSlug}`}
            className="text-teal-200 hover:text-white text-sm mb-2 inline-block"
          >
            &larr; Back
          </Link>
          <h1 className="text-xl font-bold">{chainData.name_en} Branches</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <ChainBranchFinder
          chainCode={chainData.code}
          chainNameAr={chainData.name_ar}
          chainNameEn={chainData.name_en}
          lang="en"
        />
      </div>
    </div>
  );
}
