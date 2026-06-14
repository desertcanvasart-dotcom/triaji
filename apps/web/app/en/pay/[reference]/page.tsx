import PaymentCheckout from '@/components/payment/PaymentCheckout';

export default async function EnglishPaymentPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <PaymentCheckout reference={reference} lang="en" />;
}
