import { requireAdmin } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function InsuranceNewRemittancePage() {
  await requireAdmin();
  // Redirect to main remittance page which has the create form built-in
  redirect('/insurance/remittance');
}
