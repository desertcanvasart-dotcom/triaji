/**
 * Consent scopes — the vocabulary the patient picks from, and what each choice
 * actually permits a doctor to see.
 *
 * Two vocabularies exist and have to be reconciled here:
 *  - the UI's, on the privacy screen ('full', 'vitals_only', …)
 *  - the database's `consent_scope` enum ('full_record', 'recent_only', …)
 *
 * Keeping the mapping in one place is the point: a scope the patient chose but
 * nothing enforced would be a privacy promise the product doesn't keep.
 */

/** What the patient picks. */
export const UI_SCOPES = [
  'full',
  'vitals_only',
  'lab_results',
  'medications',
  'conditions',
] as const;

export type UiScope = (typeof UI_SCOPES)[number];

/** `consent_scope` in the database (migration 042, extended by 069). */
export type DbScope =
  | 'full_record'
  | 'recent_only'
  | 'specific_conditions'
  | 'vitals_only'
  | 'lab_results'
  | 'medications';

const UI_TO_DB: Record<UiScope, DbScope> = {
  full: 'full_record',
  vitals_only: 'vitals_only',
  lab_results: 'lab_results',
  medications: 'medications',
  conditions: 'specific_conditions',
};

const DB_TO_UI: Record<DbScope, UiScope> = {
  full_record: 'full',
  recent_only: 'full',
  specific_conditions: 'conditions',
  vitals_only: 'vitals_only',
  lab_results: 'lab_results',
  medications: 'medications',
};

export function isUiScope(value: unknown): value is UiScope {
  return typeof value === 'string' && (UI_SCOPES as readonly string[]).includes(value);
}

export function toDbScope(scope: UiScope): DbScope {
  return UI_TO_DB[scope];
}

/** For display — an unrecognised value falls back to the most restrictive read. */
export function toUiScope(scope: string | null | undefined): UiScope {
  if (scope && scope in DB_TO_UI) return DB_TO_UI[scope as DbScope];
  return 'conditions';
}

/** The sections of a patient record a scope opens up. */
export interface ScopeSections {
  profileBase: boolean;
  allergies: boolean;
  chronicConditions: boolean;
  medications: boolean;
  vitals: boolean;
  labResults: boolean;
  prescriptions: boolean;
  protocols: boolean;
  alerts: boolean;
  followUps: boolean;
  gpNotes: boolean;
  referrals: boolean;
}

const ALL: ScopeSections = {
  profileBase: true,
  allergies: true,
  chronicConditions: true,
  medications: true,
  vitals: true,
  labResults: true,
  prescriptions: true,
  protocols: true,
  alerts: true,
  followUps: true,
  gpNotes: true,
  referrals: true,
};

const NONE: ScopeSections = {
  profileBase: false,
  allergies: false,
  chronicConditions: false,
  medications: false,
  vitals: false,
  labResults: false,
  prescriptions: false,
  protocols: false,
  alerts: false,
  followUps: false,
  gpNotes: false,
  referrals: false,
};

/**
 * Allergies ride along with every scope: withholding them from a doctor the
 * patient deliberately gave access to is a safety risk, not a privacy win.
 */
const BASE: ScopeSections = { ...NONE, profileBase: true, allergies: true };

/**
 * A GP relationship is a standing clinical role rather than a one-off grant, so
 * it sees the whole record — that is what confirming a GP means.
 */
export function sectionsForGp(): ScopeSections {
  return ALL;
}

export function sectionsForScope(dbScope: string | null | undefined): ScopeSections {
  switch (toUiScope(dbScope)) {
    case 'full':
      return ALL;
    case 'vitals_only':
      return { ...BASE, vitals: true, followUps: true };
    case 'lab_results':
      return { ...BASE, labResults: true };
    case 'medications':
      return { ...BASE, medications: true, prescriptions: true };
    case 'conditions':
      return { ...BASE, chronicConditions: true, protocols: true, alerts: true };
    default:
      return BASE;
  }
}
