import { cookies } from 'next/headers';
import { verifyPatientToken } from './patient-token';

export async function getAuthenticatedPatient(): Promise<{ phone: string; patientId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('patient-token')?.value;
  if (!token) return null;
  const payload = verifyPatientToken(token);
  if (!payload) return null;
  return { phone: payload.phone, patientId: payload.patientId };
}
