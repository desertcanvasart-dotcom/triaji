/**
 * Health Assistant — System Prompt Builder
 * Constructs the bilingual system prompt from patient context data.
 * Also generates dynamic suggested questions based on patient state.
 */

import type { AssistantContext } from '@triaji/shared/types';

// ─── System Prompt ──────────────────────────────────────────────────────────

/**
 * Build the full system prompt for the health assistant conversation.
 * Injects all patient data and enforces safety rules.
 */
export function buildSystemPrompt(context: AssistantContext): string {
  const isAr = context.lang === 'ar';

  const coreRules = isAr
    ? `## القواعد الأساسية (يجب الالتزام بها دائمًا):
1. **التزم بالبيانات فقط**: أجب فقط بناءً على البيانات الطبية المتاحة للمريض. لا تخترع معلومات.
2. **لا تشخّص**: لا تقدم أي تشخيص طبي. قل "الدكتور هو اللي يقدر يشخّص حالتك".
3. **لا تقترح أدوية جديدة**: لا توصي بأي دواء جديد أو تغيير جرعة. قل "لازم تسأل الدكتور الأول".
4. **لا تناقض الدكتور**: لا تعارض أي خطة علاجية أو توصية من الدكتور المعالج.
5. **حوّل للدكتور**: لو السؤال يحتاج رأي طبي متخصص، وجّه المريض لدكتوره أو أقرب طوارئ.
6. **طمّن المريض**: كن داعمًا ومطمئنًا. استخدم لغة بسيطة وودية.
7. **كن مختصرًا**: الرد من 4-5 جمل بحد أقصى. لا تطوّل.`
    : `## Core Rules (must always follow):
1. **Stay grounded**: Only answer based on the patient's available medical data. Never fabricate information.
2. **No diagnosis**: Never provide a medical diagnosis. Say "Your doctor is the one who can diagnose your condition."
3. **No new medications**: Never recommend new medication or dosage changes. Say "You need to ask your doctor first."
4. **Don't contradict the doctor**: Never oppose any treatment plan or recommendation from the treating physician.
5. **Refer to doctor**: If the question requires specialized medical opinion, direct the patient to their doctor or nearest ER.
6. **Be reassuring**: Be supportive and calming. Use simple, friendly language.
7. **Be concise**: Maximum 4-5 sentences per response. Keep it brief.`;

  const roleIntro = isAr
    ? `أنت مساعد صحي ذكي اسمه "ترياجي". أنت بتساعد المريض يفهم بياناته الطبية ويسأل أسئلة عن صحته.
أنت مش دكتور ومش بديل للدكتور. أنت بتشرح البيانات بطريقة بسيطة ومفهومة.
اتكلم بالعامية المصرية بأسلوب ودود ومطمئن.`
    : `You are an intelligent health assistant called "Triajji". You help the patient understand their medical data and ask questions about their health.
You are not a doctor and not a substitute for a doctor. You explain data in a simple, understandable way.
Speak in a friendly and reassuring tone.`;

  // ─── Patient Data Injection ─────────────────────────────────────────────

  const nameLabel = isAr ? 'اسم المريض' : 'Patient name';
  const ageLabel = isAr ? 'السن' : 'Age';
  const sexLabel = isAr ? 'الجنس' : 'Sex';
  const govLabel = isAr ? 'المحافظة' : 'Governorate';
  const riskLabel = isAr ? 'مستوى الخطورة' : 'Risk level';

  const sexDisplay = isAr
    ? (context.patientSex === 'male' ? 'ذكر' : 'أنثى')
    : context.patientSex;

  const riskDisplay = isAr
    ? ({ low: 'منخفض', medium: 'متوسط', high: 'مرتفع' }[context.brsLevel])
    : context.brsLevel;

  let patientSection = `
## ${isAr ? 'بيانات المريض' : 'Patient Data'}:
- ${nameLabel}: ${context.patientFirstName}
- ${ageLabel}: ${context.patientAge}
- ${sexLabel}: ${sexDisplay}
- ${govLabel}: ${context.patientGovernorate}
- ${riskLabel}: ${riskDisplay}`;

  // Chronic conditions
  if (context.chronicConditions.length > 0) {
    const label = isAr ? 'الأمراض المزمنة' : 'Chronic conditions';
    patientSection += `\n- ${label}: ${context.chronicConditions.join('، ')}`;
  }

  // Allergies
  if (context.allergies.length > 0) {
    const label = isAr ? 'الحساسية' : 'Allergies';
    patientSection += `\n- ${label}: ${context.allergies.join('، ')}`;
  }

  // Family history
  if (context.familyHistory.length > 0) {
    const label = isAr ? 'التاريخ العائلي' : 'Family history';
    const items = context.familyHistory.map((fh) => `${fh.conditionAr} (${fh.relation})`);
    patientSection += `\n- ${label}: ${items.join('، ')}`;
  }

  // Current medications
  if (context.currentMedications.length > 0) {
    const label = isAr ? 'الأدوية الحالية' : 'Current medications';
    patientSection += `\n\n### ${label}:`;
    for (const med of context.currentMedications) {
      const name = isAr ? med.nameAr : (med.nameEn ?? med.nameAr);
      const freq = isAr ? med.frequencyAr : (med.frequencyEn ?? med.frequencyAr);
      patientSection += `\n- ${name} ${med.dose} — ${freq} (${med.forConditionAr})`;
    }
  }

  // Lab results
  if (context.recentLabResults.length > 0) {
    const label = isAr ? 'نتائج التحاليل الأخيرة' : 'Recent lab results';
    patientSection += `\n\n### ${label}:`;
    for (const lab of context.recentLabResults) {
      const name = isAr ? lab.testNameAr : (lab.testNameEn ?? lab.testNameAr);
      const abnormalFlag = lab.isAbnormal ? (isAr ? ' ⚠️ خارج النطاق' : ' ⚠️ abnormal') : '';
      const refRange = lab.referenceRange ? ` (${isAr ? 'النطاق' : 'ref'}: ${lab.referenceRange})` : '';
      patientSection += `\n- ${name}: ${lab.value} ${lab.unit}${refRange}${abnormalFlag} — ${lab.date.slice(0, 10)}`;
    }
  }

  // Vitals trends
  if (context.vitalsTrend.length > 0) {
    const label = isAr ? 'اتجاه العلامات الحيوية' : 'Vital signs trends';
    const trendLabels = isAr
      ? { improving: 'تحسن', stable: 'مستقر', worsening: 'تدهور' }
      : { improving: 'improving', stable: 'stable', worsening: 'worsening' };
    patientSection += `\n\n### ${label}:`;
    for (const vital of context.vitalsTrend) {
      const lastValue = vital.values[vital.values.length - 1];
      patientSection += `\n- ${vital.vitalType}: ${lastValue} (${trendLabels[vital.trend]})`;
    }
  }

  // Active prescriptions
  if (context.activePrescriptions.length > 0) {
    const label = isAr ? 'الوصفات الطبية الحالية' : 'Active prescriptions';
    patientSection += `\n\n### ${label}:`;
    for (const rx of context.activePrescriptions) {
      const name = isAr ? rx.nameAr : (rx.nameEn ?? rx.nameAr);
      const dispensedLabel = rx.dispensed
        ? (isAr ? 'تم صرفها' : 'dispensed')
        : (isAr ? 'لم تُصرف بعد' : 'not dispensed');
      patientSection += `\n- ${name} ${rx.dose} — ${rx.frequencyAr} (${rx.prescribingDoctorAr}) [${dispensedLabel}]`;
    }
  }

  // Recent encounters
  if (context.recentEncounters.length > 0) {
    const label = isAr ? 'آخر زيارات الدكتور' : 'Recent doctor visits';
    patientSection += `\n\n### ${label}:`;
    for (const enc of context.recentEncounters) {
      patientSection += `\n- ${enc.date.slice(0, 10)}: ${enc.doctorNameAr} (${enc.specialty}) — ${enc.chiefComplaintAr}`;
      if (enc.planAr) {
        patientSection += `\n  ${isAr ? 'الخطة' : 'Plan'}: ${enc.planAr}`;
      }
    }
  }

  // Follow-ups
  if (context.overdueFollowUps.length > 0) {
    const label = isAr ? 'متابعات متأخرة' : 'Overdue follow-ups';
    patientSection += `\n\n### ${label}:`;
    for (const fu of context.overdueFollowUps) {
      patientSection += `\n- ⚠️ ${fu.reasonAr} — ${isAr ? 'مطلوب قبل' : 'due'}: ${fu.dueDate.slice(0, 10)} (${fu.doctorNameAr})`;
    }
  }

  if (context.upcomingFollowUps.length > 0) {
    const label = isAr ? 'متابعات قادمة' : 'Upcoming follow-ups';
    patientSection += `\n\n### ${label}:`;
    for (const fu of context.upcomingFollowUps) {
      patientSection += `\n- ${fu.reasonAr} — ${fu.dueDate.slice(0, 10)} (${fu.doctorNameAr})`;
    }
  }

  // Protocol compliance
  if (context.protocolStatus.length > 0) {
    const label = isAr ? 'بروتوكولات العلاج' : 'Treatment protocols';
    patientSection += `\n\n### ${label}:`;
    for (const proto of context.protocolStatus) {
      const compLabel = isAr ? 'نسبة الالتزام' : 'compliance';
      patientSection += `\n- ${proto.conditionAr}: ${compLabel} ${proto.compliancePct}%`;
      if (proto.overdueTests.length > 0) {
        const overdueLabel = isAr ? 'فحوصات متأخرة' : 'overdue tests';
        patientSection += ` — ${overdueLabel}: ${proto.overdueTests.join('، ')}`;
      }
    }
  }

  // GP doctor
  if (context.gpDoctorNameAr) {
    const label = isAr ? 'طبيب الأسرة' : 'Family doctor';
    patientSection += `\n\n### ${label}:`;
    patientSection += `\n- ${context.gpDoctorNameAr}`;
    if (context.gpDoctorSpecialty) {
      patientSection += ` (${context.gpDoctorSpecialty})`;
    }
  }

  // ─── Topics ─────────────────────────────────────────────────────────────

  const allowedTopics = isAr
    ? `## المواضيع المسموحة:
- شرح نتائج التحاليل والفحوصات
- شرح الأدوية وآثارها الجانبية
- شرح الأمراض المزمنة وطرق التعامل معها
- تذكير بالمتابعات والمواعيد
- نصائح صحية عامة (نظام غذائي، رياضة، نوم)
- شرح ما قاله الدكتور في آخر زيارة
- حالة الالتزام بالبروتوكولات العلاجية`
    : `## Allowed topics:
- Explaining lab results and test findings
- Explaining medications and their side effects
- Explaining chronic conditions and how to manage them
- Reminding about follow-ups and appointments
- General health tips (diet, exercise, sleep)
- Explaining what the doctor said in the last visit
- Treatment protocol compliance status`;

  const declinedTopics = isAr
    ? `## المواضيع المرفوضة (ارفض بأدب ووجّه للدكتور):
- طلب تشخيص حالة جديدة
- طلب وصف دواء جديد أو تغيير جرعة
- أسئلة عن حالات مرضية ليست في بيانات المريض
- طلب رأي طبي ثاني يعارض الدكتور المعالج
- أي موضوع غير طبي أو صحي`
    : `## Declined topics (politely decline and refer to doctor):
- Requesting a new diagnosis
- Requesting new medication or dosage changes
- Questions about conditions not in the patient's data
- Requesting a second opinion that contradicts the treating doctor
- Any non-medical or non-health topic`;

  return `${roleIntro}

${coreRules}

${patientSection}

${allowedTopics}

${declinedTopics}`;
}

// ─── Suggested Questions ────────────────────────────────────────────────────

/**
 * Generate up to 3 contextual suggested questions based on the patient's data.
 * Prioritizes: abnormal labs > overdue follow-ups > active prescriptions > recent encounters > chronic conditions
 */
export function generateSuggestedQuestions(
  context: AssistantContext,
  lang: 'ar' | 'en' = 'ar'
): string[] {
  const suggestions: string[] = [];
  const isAr = lang === 'ar';

  // 1. Abnormal lab results
  const abnormalLabs = context.recentLabResults.filter((l) => l.isAbnormal);
  if (abnormalLabs.length > 0 && suggestions.length < 3) {
    const testName = isAr ? abnormalLabs[0]!.testNameAr : (abnormalLabs[0]!.testNameEn ?? abnormalLabs[0]!.testNameAr);
    suggestions.push(
      isAr
        ? `ايه معنى إن ${testName} خارج النطاق؟`
        : `What does it mean that ${testName} is out of range?`
    );
  }

  // 2. Overdue follow-ups
  if (context.overdueFollowUps.length > 0 && suggestions.length < 3) {
    suggestions.push(
      isAr
        ? 'ليه محتاج أراجع الدكتور؟'
        : 'Why do I need to see the doctor?'
    );
  }

  // 3. Active prescriptions — ask about side effects
  if (context.activePrescriptions.length > 0 && suggestions.length < 3) {
    const drugName = isAr
      ? context.activePrescriptions[0]!.nameAr
      : (context.activePrescriptions[0]!.nameEn ?? context.activePrescriptions[0]!.nameAr);
    suggestions.push(
      isAr
        ? `ايه تأثيرات ${drugName}؟`
        : `What are the side effects of ${drugName}?`
    );
  }

  // 4. Recent encounter — what did the doctor say
  if (context.recentEncounters.length > 0 && suggestions.length < 3) {
    suggestions.push(
      isAr
        ? 'ايه اللي قاله الدكتور في آخر زيارة؟'
        : 'What did the doctor say in the last visit?'
    );
  }

  // 5. Chronic conditions — how to manage
  if (context.chronicConditions.length > 0 && suggestions.length < 3) {
    const condition = context.chronicConditions[0]!;
    suggestions.push(
      isAr
        ? `إزاي أتعامل مع ${condition}؟`
        : `How do I manage ${condition}?`
    );
  }

  // 6. Protocol compliance
  const lowCompliance = context.protocolStatus.filter((p) => p.compliancePct < 80);
  if (lowCompliance.length > 0 && suggestions.length < 3) {
    suggestions.push(
      isAr
        ? 'ايه اللي محتاج أعمله عشان ألتزم بالبروتوكول؟'
        : 'What do I need to do to comply with my treatment protocol?'
    );
  }

  // 7. Vitals worsening
  const worseningVitals = context.vitalsTrend.filter((v) => v.trend === 'worsening');
  if (worseningVitals.length > 0 && suggestions.length < 3) {
    suggestions.push(
      isAr
        ? `ليه ${worseningVitals[0]!.vitalType} بيزيد عندي؟`
        : `Why is my ${worseningVitals[0]!.vitalType} getting worse?`
    );
  }

  // Fallback if no data-driven suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      isAr
        ? 'ايه النصائح الصحية المهمة ليا؟'
        : 'What are the important health tips for me?'
    );
  }

  return suggestions.slice(0, 3);
}
