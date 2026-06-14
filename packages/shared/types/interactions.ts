// ─── Medication Interaction Types ────────────────────────────────────────────

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface InteractionResult {
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  mechanismAr: string;
  mechanismEn: string;
  consequenceAr: string;
  consequenceEn: string;
  recommendationAr: string;
  recommendationEn: string;
  egyptNoteAr?: string;
  source: 'local' | 'openfda';
}

export interface CheckResult {
  interactions: InteractionResult[];
  highestSeverity: InteractionSeverity | null;
  hasBlocker: boolean; // true if contraindicated or major
  checkSource: string;
}

export interface DrugInput {
  nameAr: string;
  nameEn: string | null;
}

export interface InteractionCheckRequest {
  newDrug: DrugInput;
  existingDrugs: DrugInput[];
  patientId: string;
  doctorAccountId: string;
  healthRecordId?: string;
}

export interface InteractionOverride {
  interactionId?: string;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  overrideReasonAr: string;
}
