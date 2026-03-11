/**
 * KB Embedding Runner
 * Embeds all kb_documents using Cohere embed-multilingual-v3.
 * Run with: npx tsx supabase/seed/run-kb-embed.ts
 * Requires: COHERE_API_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(__dirname, '../../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  process.env[key] = value;
}

const COHERE_API_URL = 'https://api.cohere.com/v2/embed';
const EMBEDDING_MODEL = 'embed-multilingual-v3.0';
const MAX_CHUNK_SIZE = 500;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) return [text];
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (!para.trim()) continue;
    if (current.length + para.length + 2 <= MAX_CHUNK_SIZE) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) chunks.push(current.trim());
      if (para.length <= MAX_CHUNK_SIZE) {
        current = para;
      } else {
        const sentences = para.split(/(?<=[.،؟!])\s+/);
        current = '';
        for (const s of sentences) {
          if (current.length + s.length + 1 <= MAX_CHUNK_SIZE) {
            current = current ? `${current} ${s}` : s;
          } else {
            if (current) chunks.push(current.trim());
            current = s;
          }
        }
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('COHERE_API_KEY not set in .env.local');

  const response = await fetch(COHERE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts,
      model: EMBEDDING_MODEL,
      input_type: 'search_document',
      embedding_types: ['float'],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Cohere error (${response.status}): ${(err as { message: string }).message}`);
  }

  const data = await response.json();
  return (data as { embeddings: { float: number[][] } }).embeddings.float;
}

async function main() {
  console.log('=== Triaji KB Embed Pipeline ===\n');

  // Check for Cohere key
  if (!process.env.COHERE_API_KEY) {
    console.error('ERROR: COHERE_API_KEY not set in .env.local');
    console.error('Get a key from https://dashboard.cohere.com/api-keys');
    process.exit(1);
  }

  // Check existing embeddings
  const { count: existingCount } = await supabase
    .from('kb_embeddings')
    .select('id', { count: 'exact', head: true });

  if (existingCount && existingCount > 0) {
    console.log(`Found ${existingCount} existing embeddings. Clearing...`);
    await supabase.from('kb_embeddings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Cleared.\n');
  }

  // Fetch all active documents
  const { data: docs, error } = await supabase
    .from('kb_documents')
    .select('id, title_ar, content_ar')
    .eq('is_active', true)
    .order('created_at');

  if (error || !docs) {
    console.error('Failed to fetch documents:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${docs.length} documents to embed.\n`);

  // Process each document
  let totalChunks = 0;
  let processed = 0;
  const batchSize = 20; // Process 20 docs at a time for Cohere batching

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const allChunks: { docId: string; chunkIndex: number; text: string }[] = [];

    for (const doc of batch) {
      const fullText = `${doc.title_ar}\n\n${doc.content_ar}`;
      const chunks = chunkText(fullText);
      for (let ci = 0; ci < chunks.length; ci++) {
        allChunks.push({ docId: doc.id, chunkIndex: ci, text: chunks[ci]! });
      }
    }

    // Embed all chunks in this batch (max 96 per Cohere call)
    const texts = allChunks.map((c) => c.text);
    let embeddings: number[][];

    try {
      if (texts.length <= 96) {
        embeddings = await embedBatch(texts);
      } else {
        embeddings = [];
        for (let j = 0; j < texts.length; j += 96) {
          const sub = texts.slice(j, j + 96);
          const subEmb = await embedBatch(sub);
          embeddings.push(...subEmb);
        }
      }
    } catch (err) {
      console.error(`Error embedding batch ${i}:`, (err as Error).message);
      continue;
    }

    // Insert into kb_embeddings
    const rows = allChunks.map((chunk, idx) => ({
      document_id: chunk.docId,
      chunk_index: chunk.chunkIndex,
      chunk_text: chunk.text,
      embedding: JSON.stringify(embeddings[idx]),
      embedding_model: EMBEDDING_MODEL,
    }));

    const { error: insertError } = await supabase
      .from('kb_embeddings')
      .insert(rows);

    if (insertError) {
      console.error(`Insert error for batch ${i}:`, insertError.message);
    } else {
      totalChunks += rows.length;
      processed += batch.length;
    }

    console.log(`  Processed ${processed}/${docs.length} docs (${totalChunks} chunks total)`);

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone! ${totalChunks} embeddings created from ${processed} documents.`);
}

main().catch(console.error);
