import ChainProfilePage from '@/components/chain/ChainProfilePage';

interface PageProps {
  params: Promise<{ chainSlug: string }>;
}

export default async function ChainPageEn({ params }: PageProps) {
  const { chainSlug } = await params;
  return <ChainProfilePage slug={chainSlug} lang="en" />;
}
