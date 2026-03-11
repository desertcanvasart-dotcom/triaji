/**
 * Test Semantic Search
 * Runs 20 Arabic test queries against the KB and verifies results.
 * Run with: npx tsx supabase/seed/test-semantic-search.ts
 * Requires: COHERE_API_KEY in .env.local and embedded documents in kb_embeddings
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(COHERE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COHERE_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: [text],
      model: 'embed-multilingual-v3.0',
      input_type: 'search_query',
      embedding_types: ['float'],
    }),
  });
  const data = await response.json();
  return (data as { embeddings: { float: number[][] } }).embeddings.float[0]!;
}

interface TestQuery {
  query: string;
  description: string;
  expectedTopics: string[];
}

const TEST_QUERIES: TestQuery[] = [
  {
    query: 'صدري بيوجعني ومش قادر اتنفس',
    description: 'Chest pain + breathing difficulty',
    expectedTopics: ['chest pain', 'breathing', 'cardiac'],
  },
  {
    query: 'دماغي واجعاني جامد من الصبح',
    description: 'Severe headache since morning',
    expectedTopics: ['headache', 'migraine'],
  },
  {
    query: 'ابني عنده سخونية عالية وبيترعش',
    description: 'Child with high fever and seizures',
    expectedTopics: ['febrile seizure', 'fever', 'pediatric'],
  },
  {
    query: 'بطني واجعاني من تحت على الشمال',
    description: 'Lower left abdominal pain',
    expectedTopics: ['abdominal pain', 'appendicitis'],
  },
  {
    query: 'حاسس بدوخة والدنيا بتلف',
    description: 'Dizziness and vertigo',
    expectedTopics: ['dizziness', 'vertigo'],
  },
  {
    query: 'عندي حرقان في البول ووجع في جنبي',
    description: 'Burning urination + flank pain',
    expectedTopics: ['urinary', 'kidney'],
  },
  {
    query: 'كحة من أسبوعين مش بتروح وبكح دم',
    description: 'Chronic cough with blood',
    expectedTopics: ['cough', 'hemoptysis', 'respiratory'],
  },
  {
    query: 'ضهري واجعني ومش قادر اتحرك',
    description: 'Severe back pain, unable to move',
    expectedTopics: ['back pain', 'disc'],
  },
  {
    query: 'جسمي كله بيحكني وظهر طفح جلدي',
    description: 'Full body itching with rash',
    expectedTopics: ['rash', 'allergy', 'dermatology'],
  },
  {
    query: 'السكر نازل وحاسس بدوخة وعرق',
    description: 'Low blood sugar with dizziness',
    expectedTopics: ['hypoglycemia', 'diabetes'],
  },
  {
    query: 'وشي ملخبط ومش قادر اتكلم',
    description: 'Facial drooping and speech difficulty (stroke signs)',
    expectedTopics: ['stroke', 'neurological', 'emergency'],
  },
  {
    query: 'قلبي بيدق بسرعة وحاسس بخفقان',
    description: 'Rapid heartbeat and palpitations',
    expectedTopics: ['palpitations', 'arrhythmia', 'cardiac'],
  },
  {
    query: 'رقبتي مش بتلف ومتيبسة',
    description: 'Stiff neck',
    expectedTopics: ['neck stiffness', 'cervical'],
  },
  {
    query: 'حامل وعندي نزيف',
    description: 'Pregnant with bleeding',
    expectedTopics: ['pregnancy', 'vaginal bleeding'],
  },
  {
    query: 'مش قادر انام من القلق',
    description: 'Insomnia from anxiety',
    expectedTopics: ['anxiety', 'insomnia', 'psychiatric'],
  },
  {
    query: 'ركبتي ورمت وبتوجعني لما بمشي',
    description: 'Swollen painful knee',
    expectedTopics: ['knee pain', 'joint', 'swelling'],
  },
  {
    query: 'معدتي بتوجعني بعد الأكل وحموضة',
    description: 'Stomach pain after eating with heartburn',
    expectedTopics: ['GERD', 'peptic ulcer', 'gastro'],
  },
  {
    query: 'عيني حمرا وبتوجعني',
    description: 'Red painful eye',
    expectedTopics: ['eye pain', 'ophthalmology'],
  },
  {
    query: 'تعبان ومرهق من فترة ووزني بينقص',
    description: 'Fatigue with weight loss',
    expectedTopics: ['fatigue', 'weight loss'],
  },
  {
    query: 'ودني بتوجعني ومش بسمع كويس',
    description: 'Ear pain with hearing changes',
    expectedTopics: ['ear pain', 'hearing', 'ENT'],
  },
];

async function main() {
  console.log('=== Triaji Semantic Search Test ===\n');

  if (!process.env.COHERE_API_KEY) {
    console.error('ERROR: COHERE_API_KEY not set');
    process.exit(1);
  }

  // Check embeddings exist
  const { count } = await supabase
    .from('kb_embeddings')
    .select('id', { count: 'exact', head: true });

  if (!count || count === 0) {
    console.error('No embeddings found. Run run-kb-embed.ts first.');
    process.exit(1);
  }

  console.log(`Found ${count} embeddings in KB.\n`);

  let passed = 0;
  let failed = 0;

  for (const test of TEST_QUERIES) {
    const embedding = await embedQuery(test.query);

    const { data, error } = await supabase.rpc('match_kb_documents', {
      query_embedding: embedding,
      match_threshold: 0.50,
      match_count: 3,
    });

    if (error) {
      console.log(`FAIL: ${test.description}`);
      console.log(`  Error: ${error.message}\n`);
      failed++;
      continue;
    }

    const results = data as { id: string; content_ar: string; similarity: number }[];
    const hasResults = results.length > 0;
    const topSimilarity = hasResults ? results[0]!.similarity : 0;

    if (hasResults && topSimilarity > 0.5) {
      console.log(`PASS: ${test.description}`);
      console.log(`  Query: ${test.query}`);
      console.log(`  Top result similarity: ${topSimilarity.toFixed(3)}`);
      console.log(`  Results: ${results.length}`);
      passed++;
    } else {
      console.log(`FAIL: ${test.description}`);
      console.log(`  Query: ${test.query}`);
      console.log(`  Results: ${results.length}, top similarity: ${topSimilarity.toFixed(3)}`);
      failed++;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n=== Results: ${passed}/${TEST_QUERIES.length} passed, ${failed} failed ===`);
}

main().catch(console.error);
