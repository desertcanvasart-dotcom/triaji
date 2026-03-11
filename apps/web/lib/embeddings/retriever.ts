/**
 * RAG Retriever
 * Semantic search against kb_embeddings via pgvector.
 * Uses Cohere for query embedding, Supabase RPC for vector search.
 */

import { embedText } from './cohere';
import { createServerClient } from '@triaji/shared/supabase';

interface RetrievedDocument {
  id: string;
  content_ar: string;
  similarity: number;
}

interface RetrieveOptions {
  /** Minimum similarity threshold (0.0 - 1.0). Default: 0.70 */
  threshold?: number;
  /** Maximum number of documents to return. Default: 8 */
  maxResults?: number;
  /** Filter by relevant specialties (name_en values) */
  filterSpecialties?: string[];
  /** Filter by patient risk level */
  filterRiskLevel?: string;
}

/**
 * Retrieve relevant KB documents for a set of symptoms.
 * 1. Joins symptoms into a single Arabic query string
 * 2. Embeds the query using Cohere (search_query type)
 * 3. Runs pgvector cosine similarity search via Supabase RPC
 * 4. Returns ranked results above the similarity threshold
 */
export async function retrieveKBDocuments(
  symptoms: string[],
  options: RetrieveOptions = {}
): Promise<RetrievedDocument[]> {
  const {
    threshold = 0.70,
    maxResults = 8,
    filterSpecialties,
    filterRiskLevel,
  } = options;

  if (symptoms.length === 0) return [];

  // Build Arabic query text from symptom codes
  const queryText = symptoms.join(' ، ');

  // Embed the query (use search_query input type for retrieval)
  const queryEmbedding = await embedText(queryText, 'search_query');

  // Vector search via Supabase RPC
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('match_kb_documents', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: maxResults,
    filter_specialties: filterSpecialties ?? null,
    filter_risk_level: filterRiskLevel ?? null,
  });

  if (error) {
    console.error('RAG retrieval error:', error.message);
    return [];
  }

  return (data ?? []) as RetrievedDocument[];
}

/**
 * Retrieve documents using raw Arabic text (not pre-normalized symptoms).
 * Useful for free-form patient input that hasn't been normalized yet.
 */
export async function retrieveByText(
  arabicText: string,
  options: RetrieveOptions = {}
): Promise<RetrievedDocument[]> {
  const {
    threshold = 0.70,
    maxResults = 8,
    filterSpecialties,
    filterRiskLevel,
  } = options;

  if (!arabicText.trim()) return [];

  const queryEmbedding = await embedText(arabicText, 'search_query');

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('match_kb_documents', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: maxResults,
    filter_specialties: filterSpecialties ?? null,
    filter_risk_level: filterRiskLevel ?? null,
  });

  if (error) {
    console.error('RAG retrieval error:', error.message);
    return [];
  }

  return (data ?? []) as RetrievedDocument[];
}
