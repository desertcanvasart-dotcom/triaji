export interface RulesInput {
  /** Normalised symptom codes (e.g. 'chest_pain', 'shortness_of_breath') */
  symptoms: string[];
  /** Original Arabic patient text */
  rawText: string;
  profile: {
    age: number | null;
    biologicalSex: 'male' | 'female' | null;
    smokingStatus: 'never' | 'current' | 'former';
    bloodPressure: 'none' | 'controlled' | 'uncontrolled' | 'unknown';
    diabetesType: 'none' | 'type1' | 'type2' | 'unknown';
    diabetesControl: 'controlled' | 'uncontrolled' | 'unknown' | 'na';
    heartCondition: 'none' | 'known' | 'unknown';
    previousHeartAttack: boolean;
    brs: number;
    riskLevel: 'low' | 'medium' | 'high';
    familyHistory?: {
      heartDisease: boolean;
      heartAttack: boolean;
      stroke: boolean;
      hypertension: boolean;
      diabetes: boolean;
      cancer: boolean;
    };
    /** Paediatric fields */
    isPaediatric?: boolean;
    ageMonths?: number; // precise age in months for children
  };
}

export interface EmergencyResult {
  triggered: boolean;
  ruleName: string | null;
  escalationType: 'emergency_room' | 'call_ambulance' | 'urgent_same_day' | null;
  responseAr: string | null;
  /** Lower number = higher priority (1 is most critical) */
  priority: number | null;
}

export interface BRSResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface RulesResult {
  emergency: EmergencyResult;
  brs: BRSResult;
  urgencyLevel: 'routine' | 'urgent' | 'emergency';
}

export interface IcuBedInfo {
  hospitalNameAr: string;
  hospitalNameEn: string;
  unitType: string;
  availableBeds: number;
  distanceKm: number;
  phoneDirect: string | null;
}

export interface EmergencyWithICUResult extends EmergencyResult {
  nearbyIcuBeds?: IcuBedInfo[];
}
