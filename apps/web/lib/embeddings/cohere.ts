/**
 * Cohere Embedding Client
 * Uses embed-multilingual-v3 for Arabic text embeddings (1024 dimensions).
 * Server-side only — never call from client components.
 */

const COHERE_API_URL = 'https://api.cohere.com/v2/embed';
const EMBEDDING_MODEL = 'embed-multilingual-v3.0';
const EMBEDDING_DIMENSIONS = 1024;

interface CohereEmbedResponse {
  id: string;
  embeddings: {
    float: number[][];
  };
  texts: string[];
  meta: {
    api_version: { version: string };
    billed_units: { input_tokens: number };
  };
}

interface CohereErrorResponse {
  message: string;
}

function getCohereApiKey(): string {
  const key = process.env.COHERE_API_KEY;
  if (!key) {
    throw new Error('COHERE_API_KEY environment variable is not set');
  }
  return key;
}

/**
 * Embed a single text string. Returns a 1024-dimensional float array.
 */
export async function embedText(
  text: string,
  inputType: 'search_document' | 'search_query' = 'search_document'
): Promise<number[]> {
  const result = await embedTexts([text], inputType);
  const embedding = result[0];
  if (!embedding) {
    throw new Error('Cohere returned empty embedding result');
  }
  return embedding;
}

/**
 * Embed multiple texts in a single API call. Max 96 texts per call.
 * Returns array of 1024-dimensional float arrays.
 */
export async function embedTexts(
  texts: string[],
  inputType: 'search_document' | 'search_query' = 'search_document'
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > 96) {
    throw new Error('Cohere embed API supports max 96 texts per call');
  }

  const response = await fetch(COHERE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getCohereApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts,
      model: EMBEDDING_MODEL,
      input_type: inputType,
      embedding_types: ['float'],
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as CohereErrorResponse;
    throw new Error(`Cohere API error (${response.status}): ${error.message}`);
  }

  const data = (await response.json()) as CohereEmbedResponse;
  return data.embeddings.float;
}

/**
 * Chunk a long Arabic text into smaller pieces for embedding.
 * Splits on paragraph boundaries first, then sentence boundaries if needed.
 * Target: ~500 characters per chunk (Arabic is denser than English).
 */
export function chunkText(text: string, maxChunkSize: number = 500): string[] {
  if (text.length <= maxChunkSize) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) continue;

    if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());

      if (paragraph.length <= maxChunkSize) {
        currentChunk = paragraph;
      } else {
        // Split long paragraph by sentences (Arabic period ، or .)
        const sentences = paragraph.split(/(?<=[.،؟!])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
            currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          }
        }
      }
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
