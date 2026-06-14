/**
 * Response Parser
 * Extracts structured JSON from Claude's response when the AI
 * determines a specialty or detects an emergency.
 */

export interface SpecialtyDetermination {
  emergency: false;
  determined_specialty_en: string;
  determined_specialty_ar: string;
  confidence: number;
  urgency: 'routine' | 'urgent' | 'emergency';
  extracted_symptoms: string[];
  summary_ar: string;
  reasoning: string;
}

export interface EmergencyDetermination {
  emergency: true;
  escalation_type: 'emergency_room' | 'call_ambulance' | 'urgent_same_day';
  reason_ar: string;
  instructions_ar: string;
}

export type AIDetermination = SpecialtyDetermination | EmergencyDetermination;

export interface ParsedResponse {
  /** The text portion of the AI's response (Arabic) */
  textResponse: string;
  /** Parsed determination if present, null if still asking follow-up questions */
  determination: AIDetermination | null;
  /** Whether the session should be considered complete */
  sessionComplete: boolean;
}

/**
 * Parse the AI's response to extract any structured JSON determination.
 * The AI may include a JSON block at the end of its response when it has
 * enough information to determine a specialty or detect an emergency.
 */
export function parseAIResponse(response: string): ParsedResponse {
  // Try to extract JSON from code block
  const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

  if (!jsonBlockMatch) {
    // No JSON block — AI is still asking follow-up questions
    return {
      textResponse: response.trim(),
      determination: null,
      sessionComplete: false,
    };
  }

  const jsonStr = jsonBlockMatch[1]!;
  // Text is everything before the JSON block
  const textBefore = response.slice(0, jsonBlockMatch.index).trim();

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (parsed.emergency === true) {
      const emergency: EmergencyDetermination = {
        emergency: true,
        escalation_type: (parsed.escalation_type as EmergencyDetermination['escalation_type']) ?? 'emergency_room',
        reason_ar: (parsed.reason_ar as string) ?? '',
        instructions_ar: (parsed.instructions_ar as string) ?? '',
      };
      return {
        textResponse: textBefore || emergency.instructions_ar,
        determination: emergency,
        sessionComplete: true,
      };
    }

    if (parsed.determined_specialty_en || parsed.determined_specialty_ar) {
      const specialty: SpecialtyDetermination = {
        emergency: false,
        determined_specialty_en: (parsed.determined_specialty_en as string) ?? '',
        determined_specialty_ar: (parsed.determined_specialty_ar as string) ?? '',
        confidence: (parsed.confidence as number) ?? 0.7,
        urgency: (parsed.urgency as SpecialtyDetermination['urgency']) ?? 'routine',
        extracted_symptoms: (parsed.extracted_symptoms as string[]) ?? [],
        summary_ar: (parsed.summary_ar as string) ?? '',
        reasoning: (parsed.reasoning as string) ?? '',
      };
      // If Claude emitted a JSON determination block, it has decided on a specialty.
      // The system prompt already instructs Claude to only emit JSON at confidence >= 0.7,
      // so we trust the AI's decision and always mark the session as complete.
      return {
        textResponse: textBefore || specialty.summary_ar,
        determination: specialty,
        sessionComplete: true,
      };
    }
  } catch {
    // JSON parse error — treat as plain text response
  }

  return {
    textResponse: response.trim(),
    determination: null,
    sessionComplete: false,
  };
}
