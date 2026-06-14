/**
 * OpenFDA Drug Interaction Checker
 * Queries the FDA drug label endpoint for interaction text,
 * then uses Claude (Haiku) to extract structured severity and
 * bilingual mechanism/consequence/recommendation.
 */

import type { InteractionResult } from '@triaji/shared/types';
import Anthropic from '@anthropic-ai/sdk';

// ─── Anthropic Client ────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

// ─── OpenFDA Lookup ──────────────────────────────────────────────────────────

export async function checkOpenFDA(
  drugAName: string,
  drugBName: string
): Promise<InteractionResult | null> {
  try {
    const response = await fetch(
      `https://api.fda.gov/drug/label.json?` +
        `search=openfda.generic_name:"${encodeURIComponent(drugAName)}"` +
        `+AND+drug_interactions:"${encodeURIComponent(drugBName)}"` +
        `&limit=1`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) return null;
    const data = await response.json();

    if (!data.results?.length) return null;
    const interactionText = data.results[0].drug_interactions?.[0];
    if (!interactionText) return null;

    return await parseInteractionWithClaude(interactionText, drugAName, drugBName);
  } catch {
    return null; // Graceful degradation
  }
}

// ─── Claude Extraction ───────────────────────────────────────────────────────

async function parseInteractionWithClaude(
  fdaText: string,
  drugA: string,
  drugB: string
): Promise<InteractionResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are a clinical pharmacology assistant.
Extract the drug interaction between ${drugA} and ${drugB} from this FDA drug label text.

FDA text: "${fdaText.substring(0, 2000)}"

Respond ONLY with JSON (no markdown):
{
  "severity": "contraindicated" | "major" | "moderate" | "minor" | "none",
  "mechanism_en": "brief mechanism in one sentence",
  "consequence_en": "clinical consequence",
  "recommendation_en": "what prescriber should do",
  "mechanism_ar": "الآلية بالعربي",
  "consequence_ar": "العاقبة بالعربي",
  "recommendation_ar": "التوصية بالعربي",
  "confidence": 0.0-1.0
}

If no clinically significant interaction between these two drugs: {"severity": "none"}`,
        },
      ],
    });

    const firstBlock = response.content[0];
    const text = firstBlock && 'text' in firstBlock ? firstBlock.text : '';
    const result = JSON.parse(text);

    if (result.severity === 'none' || result.confidence < 0.7) return null;

    return {
      drugA,
      drugB,
      severity: result.severity,
      mechanismAr: result.mechanism_ar,
      mechanismEn: result.mechanism_en,
      consequenceAr: result.consequence_ar,
      consequenceEn: result.consequence_en,
      recommendationAr: result.recommendation_ar,
      recommendationEn: result.recommendation_en,
      source: 'openfda',
    };
  } catch {
    return null;
  }
}
