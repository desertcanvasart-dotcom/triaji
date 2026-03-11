import type { KBCollection, EscalationType } from './enums';

// ─── Knowledge Base Document ─────────────────────────────────────────────────

export interface KBDocument {
  id: string;
  tenant_id: string | null;
  collection: KBCollection;
  title_ar: string;
  title_en: string | null;
  content_ar: string;
  content_en: string | null;
  metadata: Record<string, unknown>;
  version: number;
  is_active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Knowledge Base Embedding ────────────────────────────────────────────────

export interface KBEmbedding {
  id: string;
  document_id: string;
  chunk_index: number;
  content_ar: string;
  embedding: number[];
  token_count: number;
  created_at: string;
}

// ─── Emergency Trigger ───────────────────────────────────────────────────────

export interface EmergencyTrigger {
  id: string;
  name: string;
  description_ar: string;
  symptom_conditions: Record<string, unknown>;
  profile_conditions: Record<string, unknown>;
  response_ar: string;
  escalation_type: EscalationType;
  priority: number;
  is_active: boolean;
}
