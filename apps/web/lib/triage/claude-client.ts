/**
 * Claude API Client
 * Wraps the Anthropic SDK for triage conversations.
 * Supports text and vision (image) content.
 * Server-side only.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlockParam, ImageBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { CLAUDE_MODEL } from '@triaji/shared/constants';

const MODEL = CLAUDE_MODEL;
const MAX_TOKENS = 1024;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ImageContent {
  type: 'base64';
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
}

export interface ClaudeMessageWithImages {
  role: 'user' | 'assistant';
  content: string;
  images?: ImageContent[];
}

/**
 * Build Anthropic API message format, optionally with image content blocks.
 */
function buildMessageParams(messages: ClaudeMessageWithImages[]): MessageParam[] {
  return messages.map((msg) => {
    if (msg.role === 'assistant' || !msg.images || msg.images.length === 0) {
      return { role: msg.role, content: msg.content };
    }

    // User message with images — build content blocks
    const contentBlocks: ContentBlockParam[] = [];

    for (const img of msg.images) {
      const imageBlock: ImageBlockParam = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.data,
        },
      };
      contentBlocks.push(imageBlock);
    }

    contentBlocks.push({ type: 'text', text: msg.content });

    return { role: msg.role, content: contentBlocks };
  });
}

/**
 * Call Claude with a system prompt and conversation messages.
 * Returns the assistant's text response.
 */
export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[]
): Promise<string> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  return textBlock.text;
}

/**
 * Call Claude with vision support (images in messages).
 * Used when patient attaches symptom photos.
 */
export async function callClaudeWithVision(
  systemPrompt: string,
  messages: ClaudeMessageWithImages[]
): Promise<string> {
  const anthropic = getClient();
  const messageParams = buildMessageParams(messages);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: messageParams,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  return textBlock.text;
}
