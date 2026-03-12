/**
 * Prompt Builder
 * Builds the full LLM prompt with system prompt, patient profile,
 * RAG context, emergency protocols, and conversation history.
 */

import { TRIAGE_SYSTEM_PROMPT } from '@triaji/shared/constants';
import type { PatientProfile, SessionMessage } from '@triaji/shared/types';
import type { BRSResult } from '@triaji/rules-engine';

interface RetrievedDoc {
  id: string;
  content_ar: string;
  similarity: number;
}

/**
 * Format patient profile for injection into the system prompt.
 */
function formatPatientProfile(profile: PatientProfile | null, brs: BRSResult | null): string {
  if (!profile) {
    return 'لا توجد بيانات طبية مسجلة للمريض.';
  }

  const lines: string[] = [];

  lines.push(`- العمر: ${profile.age} سنة`);
  lines.push(`- الجنس: ${profile.biological_sex === 'male' ? 'ذكر' : 'أنثى'}`);

  if (profile.height_cm && profile.weight_kg) {
    lines.push(`- الطول: ${profile.height_cm} سم، الوزن: ${profile.weight_kg} كجم`);
    if (profile.bmi) {
      lines.push(`- مؤشر كتلة الجسم: ${profile.bmi.toFixed(1)}`);
    }
  }

  // Smoking
  const smokingMap: Record<string, string> = {
    never: 'غير مدخن',
    current: 'مدخن حالي',
    former: 'مدخن سابق',
  };
  lines.push(`- التدخين: ${smokingMap[profile.smoking_status] ?? 'غير معروف'}`);

  // Blood Pressure
  const bpMap: Record<string, string> = {
    none: 'لا يوجد',
    controlled: 'مسيطر عليه بالأدوية',
    uncontrolled: 'غير مسيطر عليه',
    unknown: 'غير معروف',
  };
  lines.push(`- ضغط الدم: ${bpMap[profile.blood_pressure] ?? 'غير معروف'}`);

  // Diabetes
  if (profile.diabetes_type !== 'none') {
    const dtMap: Record<string, string> = {
      type1: 'النوع الأول',
      type2: 'النوع الثاني',
      unknown: 'غير محدد النوع',
    };
    const dcMap: Record<string, string> = {
      controlled: 'مسيطر عليه',
      uncontrolled: 'غير مسيطر عليه',
      unknown: 'غير معروف',
    };
    lines.push(`- السكر: ${dtMap[profile.diabetes_type] ?? ''} — ${dcMap[profile.diabetes_control] ?? ''}`);
  }

  // Cardiac
  if (profile.heart_condition === 'known') {
    lines.push('- مشاكل في القلب: نعم');
    if (profile.previous_heart_attack) lines.push('  - أزمة قلبية سابقة');
    if (profile.heart_surgery) lines.push('  - جراحة قلب سابقة');
  }

  // Kidney/Liver
  if (profile.kidney_disease === 'known') lines.push('- مرض كلى معروف');
  if (profile.liver_disease === 'known') lines.push('- مرض كبد معروف');

  // Chronic conditions
  if (profile.chronic_conditions.length > 0) {
    lines.push(`- أمراض مزمنة: ${profile.chronic_conditions.join('، ')}`);
  }

  // Allergies
  if (profile.known_allergies.length > 0) {
    lines.push(`- حساسية معروفة: ${profile.known_allergies.join('، ')}`);
  }

  // Medications
  if (profile.current_medications.length > 0) {
    lines.push(`- أدوية حالية: ${profile.current_medications.join('، ')}`);
  }

  // Previous surgeries
  if (profile.previous_surgeries.length > 0) {
    lines.push(`- عمليات سابقة: ${profile.previous_surgeries.join('، ')}`);
  }

  // BRS
  if (brs) {
    const riskMap: Record<string, string> = {
      low: 'منخفض',
      medium: 'متوسط',
      high: 'مرتفع',
    };
    lines.push(`\nدرجة المخاطر الخلفية (BRS): ${brs.score} — مستوى ${riskMap[brs.level] ?? brs.level}`);
    if (brs.factors.length > 0) {
      lines.push(`عوامل الخطر: ${brs.factors.join('، ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format RAG documents for injection into the system prompt.
 */
function formatRAGContext(docs: RetrievedDoc[]): string {
  if (docs.length === 0) {
    return 'لا توجد مراجع طبية متاحة لهذه الأعراض.';
  }

  return docs
    .map((doc, i) => `--- مرجع ${i + 1} (تطابق: ${(doc.similarity * 100).toFixed(0)}%) ---\n${doc.content_ar}`)
    .join('\n\n');
}

/**
 * Format emergency protocols for the system prompt.
 */
function formatEmergencyProtocols(): string {
  return `لو ظهرت أي من المؤشرات دي، فعّل بروتوكول الطوارئ فورًا:
- توقف القلب أو فقدان النبض → اتصل بالإسعاف فورًا
- أعراض سكتة دماغية (شلل مفاجئ، صعوبة كلام) → اتصل بالإسعاف
- ألم صدر شديد مع ضيق تنفس → اتصل بالإسعاف
- حساسية شديدة (تورم الوجه/الحلق) → اتصل بالإسعاف
- ضيق تنفس مانع الكلام → اتصل بالإسعاف
- تشنجات حرارية عند الأطفال → اتصل بالإسعاف
- حرارة عالية جدًا عند الرضع → طوارئ فورًا
- فقدان وعي → طوارئ فورًا
- علامات التهاب سحائي → طوارئ فورًا
- نزيف شديد مستمر → طوارئ فورًا
- صداع رعدي مفاجئ → طوارئ فورًا
- أزمة سكر (هبوط/ارتفاع شديد) → طوارئ فورًا`;
}

/**
 * Build the full system prompt with all template variables filled.
 */
export function buildSystemPrompt(
  profile: PatientProfile | null,
  brs: BRSResult | null,
  ragDocs: RetrievedDoc[]
): string {
  let prompt = TRIAGE_SYSTEM_PROMPT;

  prompt = prompt.replace('{{PATIENT_PROFILE}}', formatPatientProfile(profile, brs));
  prompt = prompt.replace('{{RAG_CONTEXT}}', formatRAGContext(ragDocs));
  prompt = prompt.replace('{{EMERGENCY_PROTOCOLS}}', formatEmergencyProtocols());

  return prompt;
}

/**
 * Build the messages array for the Anthropic API.
 * Includes full conversation history + the new patient message.
 */
export function buildMessages(
  history: SessionMessage[],
  newMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of history) {
    messages.push({
      role: msg.role === 'patient' ? 'user' : 'assistant',
      content: msg.content_ar,
    });
  }

  // Add the new patient message
  messages.push({ role: 'user', content: newMessage });

  return messages;
}
