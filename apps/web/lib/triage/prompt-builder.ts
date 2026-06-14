/**
 * Prompt Builder
 * Builds the full LLM prompt with system prompt, patient profile,
 * RAG context, emergency protocols, and conversation history.
 */

import { TRIAGE_SYSTEM_PROMPT, TRIAGE_SYSTEM_PROMPT_EN } from '@triaji/shared/constants';
import type { Lang } from '@triaji/shared/i18n';
import type { PatientProfile, SessionMessage } from '@triaji/shared/types';
import type { StructuredPatientProfile } from '@triaji/shared/types';
import type { BRSResult } from '@triaji/rules-engine';

interface RetrievedDoc {
  id: string;
  content_ar: string;
  similarity: number;
}

/**
 * Format patient profile for injection into the system prompt.
 * Prefers structured data when available, falls back to legacy free-text fields.
 */
function formatPatientProfile(
  profile: PatientProfile | null,
  brs: BRSResult | null,
  structured?: StructuredPatientProfile | null
): string {
  if (!profile) {
    return 'لا توجد بيانات طبية مسجلة للمريض.';
  }

  const lines: string[] = [];

  // Paediatric context
  const isPaediatric = (profile as Record<string, unknown>).is_paediatric === true;
  const dateOfBirth = (profile as Record<string, unknown>).date_of_birth as string | undefined;

  if (isPaediatric && dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    const ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    const ageYears = Math.floor(ageMonths / 12);
    const remainingMonths = ageMonths % 12;

    lines.push('--- هذه الجلسة عن طفل ---');
    if (ageMonths < 24) {
      lines.push(`- العمر: ${ageMonths} شهراً`);
    } else if (remainingMonths > 0) {
      lines.push(`- العمر: ${ageYears} سنة و ${remainingMonths} شهور`);
    } else {
      lines.push(`- العمر: ${ageYears} سنة`);
    }
    lines.push(`- الجنس: ${profile.biological_sex === 'male' ? 'ذكر' : 'أنثى'}`);

    // Paediatric urgency thresholds for AI
    lines.push('');
    lines.push('⚠️ عتبات الطوارئ للأطفال:');
    if (ageMonths < 3) {
      lines.push('- حرارة ≥ 38.0°C = طوارئ (رضيع أقل من 3 شهور)');
    } else if (ageMonths <= 36) {
      lines.push('- حرارة ≥ 38.5°C = حالة عاجلة (3-36 شهر)');
    }
    lines.push('- أي تشنج = طوارئ');
    lines.push('- صعوبة تنفس = طوارئ');
    lines.push('- طفح جلدي مع حرارة = حالة عاجلة');
    lines.push('- وجه الأسئلة للوالد/ة وليس للطفل');
    lines.push('- أحل المريض لطبيب أطفال وليس باطنة');
  } else {
    lines.push(`- العمر: ${profile.age} سنة`);
    lines.push(`- الجنس: ${profile.biological_sex === 'male' ? 'ذكر' : 'أنثى'}`);
  }

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
  if (profile.smoking_status !== 'never' && profile.cigarettes_per_day) {
    lines.push(`  - ${profile.cigarettes_per_day} سيجارة/يوم — منذ ${profile.smoking_years ?? '?'} سنة`);
  }

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

  // ─── Structured data (preferred) or legacy free-text fallback ───

  // Allergies
  if (structured?.allergies && structured.allergies.length > 0) {
    const names = structured.allergies.map(
      (a) => a.allergy_options?.name_ar ?? a.allergy_code
    );
    lines.push(`- الحساسية: ${names.join('، ')}`);
  } else if (profile.known_allergies?.length > 0) {
    lines.push(`- حساسية معروفة: ${profile.known_allergies.join('، ')}`);
  }

  // Chronic conditions
  if (structured?.chronicConditions && structured.chronicConditions.length > 0) {
    const names = structured.chronicConditions.map(
      (c) => c.chronic_condition_options?.name_ar ?? c.condition_code
    );
    lines.push(`- الأمراض المزمنة: ${names.join('، ')}`);
  } else if (profile.chronic_conditions?.length > 0) {
    lines.push(`- أمراض مزمنة: ${profile.chronic_conditions.join('، ')}`);
  }

  // Medications
  if (structured?.medications && structured.medications.length > 0) {
    lines.push('- الأدوية الحالية:');
    for (const med of structured.medications) {
      const parts = [med.drug_name_ar];
      if (med.dose) parts.push(`(${med.dose})`);
      if (med.frequency_ar) parts.push(`— ${med.frequency_ar}`);
      if (med.for_condition_ar) parts.push(`— ${med.for_condition_ar}`);
      lines.push(`  - ${parts.join(' ')}`);
    }
  } else if (profile.current_medications?.length > 0) {
    lines.push(`- أدوية حالية: ${profile.current_medications.join('، ')}`);
  }

  // Surgeries
  if (structured?.surgeries && structured.surgeries.length > 0) {
    const names = structured.surgeries.map((s) => {
      const name = s.surgery_options?.name_ar ?? s.surgery_code;
      return s.year_approximate ? `${name} (${s.year_approximate})` : name;
    });
    lines.push(`- العمليات السابقة: ${names.join('، ')}`);
  } else if (profile.previous_surgeries?.length > 0) {
    lines.push(`- عمليات سابقة: ${profile.previous_surgeries.join('، ')}`);
  }

  // Family history (new — structured only)
  if (structured?.familyHistory && structured.familyHistory.length > 0) {
    lines.push('- التاريخ العائلي:');
    const relationMap: Record<string, string> = {
      father: 'الأب',
      mother: 'الأم',
      sibling: 'أخ/أخت',
      paternal_grandparent: 'جد/ة (أب)',
      maternal_grandparent: 'جد/ة (أم)',
    };
    // Group by relation
    const byRelation = new Map<string, string[]>();
    for (const fh of structured.familyHistory) {
      const rel = relationMap[fh.relation] ?? fh.relation;
      const name = fh.family_history_options?.name_ar ?? fh.condition_code;
      if (!byRelation.has(rel)) byRelation.set(rel, []);
      byRelation.get(rel)!.push(name);
    }
    for (const [rel, conditions] of byRelation) {
      lines.push(`  - ${rel}: ${conditions.join('، ')}`);
    }
  }

  // Reproductive health (female only)
  if (profile.biological_sex === 'female' && profile.pregnancy_status) {
    const pregMap: Record<string, string> = {
      not_pregnant: 'غير حامل',
      pregnant: 'حامل',
      breastfeeding: 'مرضعة',
      trying_to_conceive: 'تحاول الحمل',
    };
    if (profile.pregnancy_status !== 'not_pregnant' || profile.menopause_status) {
      lines.push(`- الحالة الإنجابية: ${pregMap[profile.pregnancy_status] ?? ''}`);
    }
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
 * Supports Arabic (default) and English prompts.
 */
export function buildSystemPrompt(
  profile: PatientProfile | null,
  brs: BRSResult | null,
  ragDocs: RetrievedDoc[],
  lang: Lang = 'ar',
  structured?: StructuredPatientProfile | null
): string {
  let prompt = lang === 'en' ? TRIAGE_SYSTEM_PROMPT_EN : TRIAGE_SYSTEM_PROMPT;

  prompt = prompt.replace('{{PATIENT_PROFILE}}', formatPatientProfile(profile, brs, structured));
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
