import { createAdminClient } from '@/lib/supabase/server';

const COHERE_API_KEY = process.env['COHERE_API_KEY'] ?? '';
const COHERE_EMBED_URL = 'https://api.cohere.com/v1/embed';

/**
 * Split text into chunks with overlap for embedding.
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlap: number = 50
): string[] {
  if (!text || text.trim().length === 0) return [];

  // Rough token estimate: 1 token ≈ 4 chars for Arabic
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;

  // Split on double newlines (paragraphs)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      // Split long paragraphs on single newlines
      const lines = paragraph.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        if (line.length > maxChars) {
          // Split on sentence boundaries (Arabic punctuation)
          const sentences = line.split(/(?<=[.!?۔؟!])\s+/);
          for (const sentence of sentences) {
            if ((currentChunk + '\n' + sentence).length > maxChars && currentChunk.length > 0) {
              chunks.push(currentChunk.trim());
              // Keep overlap from end of previous chunk
              currentChunk = currentChunk.slice(-overlapChars) + '\n' + sentence;
            } else {
              currentChunk = currentChunk ? currentChunk + '\n' + sentence : sentence;
            }
          }
        } else if ((currentChunk + '\n' + line).length > maxChars && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = currentChunk.slice(-overlapChars) + '\n' + line;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n' + line : line;
        }
      }
    } else if ((currentChunk + '\n\n' + paragraph).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = currentChunk.slice(-overlapChars) + '\n\n' + paragraph;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

/**
 * Embed a single text chunk using Cohere API.
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!COHERE_API_KEY) {
    throw new Error('COHERE_API_KEY is not set.');
  }

  const response = await fetch(COHERE_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      texts,
      model: 'embed-multilingual-v3.0',
      input_type: 'search_document',
      truncate: 'END',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cohere API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.embeddings as number[][];
}

/**
 * Embed a query text for search.
 */
export async function embedQuery(text: string): Promise<number[]> {
  if (!COHERE_API_KEY) {
    throw new Error('COHERE_API_KEY is not set.');
  }

  const response = await fetch(COHERE_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      texts: [text],
      model: 'embed-multilingual-v3.0',
      input_type: 'search_query',
      truncate: 'END',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cohere API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.embeddings[0] as number[];
}

/**
 * Full embedding pipeline for a document.
 */
export async function embedDocument(documentId: string): Promise<{
  success: boolean;
  chunksEmbedded: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  // Fetch document
  const { data: doc, error: fetchError } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (fetchError || !doc) {
    return { success: false, chunksEmbedded: 0, error: 'Document not found.' };
  }

  const contentToEmbed = doc.content_ar ?? doc.content_en ?? '';
  if (!contentToEmbed) {
    return { success: false, chunksEmbedded: 0, error: 'No content to embed.' };
  }

  try {
    // Chunk the text
    const chunks = chunkText(contentToEmbed);

    // Delete existing embeddings for this document
    await supabase
      .from('kb_embeddings')
      .delete()
      .eq('document_id', documentId);

    // Embed chunks in batches of 96 (Cohere limit)
    const batchSize = 96;
    let totalEmbedded = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await embedTexts(batch);

      const inserts = batch.map((chunk, idx) => ({
        document_id: documentId,
        chunk_index: i + idx,
        chunk_text: chunk,
        embedding: JSON.stringify(embeddings[idx]),
      }));

      const { error: insertError } = await supabase
        .from('kb_embeddings')
        .insert(inserts);

      if (insertError) {
        return {
          success: false,
          chunksEmbedded: totalEmbedded,
          error: `Embedding insert failed: ${insertError.message}`,
        };
      }

      totalEmbedded += batch.length;
    }

    return { success: true, chunksEmbedded: totalEmbedded };
  } catch (err) {
    return {
      success: false,
      chunksEmbedded: 0,
      error: err instanceof Error ? err.message : 'Unknown embedding error.',
    };
  }
}
