import PaymentCheckout from '@/components/payment/PaymentCheckout';

export default async function ArabicPaymentPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <PaymentCheckout reference={reference} lang="ar" />;
}
