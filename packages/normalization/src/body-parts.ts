/**
 * Egyptian Arabic body part aliases mapped to normalized body part codes.
 *
 * Each key is an Arabic alias (colloquial or formal) and
 * each value is the standardized English body part code.
 */
export const bodyPartsMap = new Map<string, string>([
  // Head
  ['راس', 'head'],
  ['رأس', 'head'],
  ['دماغ', 'head'],
  ['دماغي', 'head'],
  ['راسي', 'head'],

  // Chest
  ['صدر', 'chest'],
  ['صدري', 'chest'],

  // Abdomen
  ['بطن', 'abdomen'],
  ['بطني', 'abdomen'],
  ['كرش', 'abdomen'],

  // Back
  ['ضهر', 'back'],
  ['ظهر', 'back'],
  ['ضهري', 'back'],

  // Neck
  ['رقبة', 'neck'],
  ['رقبتي', 'neck'],

  // Arm / Hand
  ['ايد', 'arm'],
  ['إيد', 'arm'],
  ['ايدي', 'arm'],
  ['ذراع', 'arm'],
  ['ذراعي', 'arm'],

  // Leg
  ['رجل', 'leg'],
  ['رجلي', 'leg'],
  ['ساق', 'leg'],
  ['ساقي', 'leg'],

  // Knee
  ['ركبة', 'knee'],
  ['ركبتي', 'knee'],

  // Shoulder
  ['كتف', 'shoulder'],
  ['كتفي', 'shoulder'],

  // Face
  ['وش', 'face'],
  ['وشي', 'face'],
  ['وجه', 'face'],
  ['وجهي', 'face'],

  // Eye
  ['عين', 'eye'],
  ['عيني', 'eye'],
  ['عينيا', 'eye'],

  // Ear
  ['ودن', 'ear'],
  ['ودني', 'ear'],
  ['اذن', 'ear'],
  ['أذن', 'ear'],

  // Nose
  ['انف', 'nose'],
  ['أنف', 'nose'],
  ['مناخير', 'nose'],
  ['مناخيري', 'nose'],

  // Throat
  ['زور', 'throat'],
  ['زوري', 'throat'],
  ['حلق', 'throat'],
  ['حلقي', 'throat'],

  // Heart
  ['قلب', 'heart'],
  ['قلبي', 'heart'],

  // Stomach
  ['معدة', 'stomach'],
  ['معدتي', 'stomach'],

  // Kidney
  ['كلية', 'kidney'],
  ['كليتي', 'kidney'],
  ['كلاوي', 'kidney'],

  // Liver
  ['كبد', 'liver'],
  ['كبدي', 'liver'],
]);

/**
 * Extracts normalized body part codes from the given Arabic text.
 * Returns unique body part codes found in the input.
 */
export function extractBodyParts(text: string): string[] {
  const found = new Set<string>();

  for (const [alias, code] of bodyPartsMap) {
    if (text.includes(alias)) {
      found.add(code);
    }
  }

  return [...found];
}
