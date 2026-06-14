import { requireAdmin } from '@/lib/auth/session';
import PrescriptionDetail from '@/components/pharmacy/PrescriptionDetail';

interface PrescriptionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PrescriptionDetailPage({ params }: PrescriptionDetailPageProps) {
  const admin = await requireAdmin();
  const { id } = await params;
  const tenantId = admin.tenant_id;

  if (!tenantId) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-3 block">&#9888;&#65039;</span>
        <p className="text-gray-500">لا توجد صيدلية مرتبطة بحسابك</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">تفاصيل الوصفة</h1>
      <PrescriptionDetail routingId={id} />
    </div>
  );
}
