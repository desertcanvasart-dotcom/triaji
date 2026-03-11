/**
 * Auto-Embed Pipeline
 * Handles embedding kb_documents on save.
 * Chunks content, generates embeddings via Cohere, stores in kb_embeddings.
 */

import { embedTexts, chunkText, EMBEDDING_MODEL } from './cohere';
import { createServerClient } from '@triaji/shared/supabase';

interface EmbedResult {
  documentId: string;
  chunksCreated: number;
  success: boolean;
  error?: string;
}

/**
 * Embed a single KB document. Chunks the Arabic content, generates embeddings,
 * and upserts into kb_embeddings table.
 *
 * Call this whenever a kb_document is created or updated.
 */
export async function embedDocument(documentId: string): Promise<EmbedResult> {
  const supabase = createServerClient();

  // Fetch the document
  const { data: doc, error: fetchError } = await supabase
    .from('kb_documents')
    .select('id, content_ar, title_ar')
    .eq('id', documentId)
    .single();

  if (fetchError || !doc) {
    return {
      documentId,
      chunksCreated: 0,
      success: false,
      error: fetchError?.message ?? 'Document not found',
    };
  }

  // Delete existing embeddings for this document (re-embed on update)
  await supabase
    .from('kb_embeddings')
    .delete()
    .eq('document_id', documentId);

  // Chunk the content (prepend title for context)
  const fullText = `${doc.title_ar}\n\n${doc.content_ar}`;
  const chunks = chunkText(fullText);

  if (chunks.length === 0) {
    return { documentId, chunksCreated: 0, success: true };
  }

  // Embed all chunks in a single API call (up to 96)
  let embeddings: number[][];
  try {
    embeddings = await embedTexts(chunks, 'search_document');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown embedding error';
    return { documentId, chunksCreated: 0, success: false, error: message };
  }

  // Insert embeddings into kb_embeddings
  const rows = chunks.map((chunkText, index) => ({
    document_id: documentId,
    chunk_index: index,
    chunk_text: chunkText,
    embedding: JSON.stringify(embeddings[index]),
    embedding_model: EMBEDDING_MODEL,
  }));

  const { error: insertError } = await supabase
    .from('kb_embeddings')
    .insert(rows);

  if (insertError) {
    return {
      documentId,
      chunksCreated: 0,
      success: false,
      error: insertError.message,
    };
  }

  return { documentId, chunksCreated: chunks.length, success: true };
}

/**
 * Embed multiple KB documents. Processes them sequentially to respect
 * Cohere rate limits.
 */
export async function embedDocuments(documentIds: string[]): Promise<EmbedResult[]> {
  const results: EmbedResult[] = [];
  for (const docId of documentIds) {
    const result = await embedDocument(docId);
    results.push(result);
  }
  return results;
}

/**
 * Re-embed all active KB documents. Used for bulk reprocessing
 * (e.g., after model upgrade or content migration).
 */
export async function reembedAll(): Promise<{ total: number; succeeded: number; failed: number }> {
  const supabase = createServerClient();

  const { data: docs, error } = await supabase
    .from('kb_documents')
    .select('id')
    .eq('is_active', true);

  if (error || !docs) {
    throw new Error(`Failed to fetch documents: ${error?.message}`);
  }

  const ids = docs.map((d) => d.id as string);
  const results = await embedDocuments(ids);

  return {
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}
