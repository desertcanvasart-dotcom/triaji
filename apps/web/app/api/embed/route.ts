/**
 * POST /api/embed
 * Embeds a single KB document by ID.
 * Used by admin panel when saving/updating KB documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedDocument } from '@/lib/embeddings/pipeline';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { documentId?: string };

    if (!body.documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    const result = await embedDocument(body.documentId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, documentId: result.documentId },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
      success: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
