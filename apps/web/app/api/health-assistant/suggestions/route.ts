/**
 * GET /api/health-assistant/suggestions
 * Generate dynamic suggested questions based on the patient's health data.
 *
 * Auth: patient (cookie-based)
 * Returns: { suggestions: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { loadAssistantContext } from '@/lib/health-assistant/context-loader';
import { generateSuggestedQuestions } from '@/lib/health-assistant/system-prompt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Read lang from query params
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') === 'en' ? 'en' : 'ar';

  try {
    const context = await loadAssistantContext(patient.patientId, lang);
    const suggestions = generateSuggestedQuestions(context, lang);

    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[HealthAssistant Suggestions] Error:', message);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
