export interface NormalizedResult {
  symptoms: string[];
  bodyParts: string[];
  severity: SeverityLevel | null;
  confidence: number;
  originalText: string;
}

export type SeverityLevel = 'mild' | 'moderate' | 'severe' | 'worst_ever';
