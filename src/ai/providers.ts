import { createFireworks } from '@ai-sdk/fireworks';
import { createOpenAI } from '@ai-sdk/openai';
import {
  extractReasoningMiddleware,
  LanguageModelV1,
  wrapLanguageModel,
} from 'ai';
import { getEncoding } from 'js-tiktoken';

import { ModelConfig } from '../types';
import { RecursiveCharacterTextSplitter } from './text-splitter';

// Providers
const openai = process.env.OPENAI_KEY
  ? createOpenAI({
      apiKey: process.env.OPENAI_KEY,
      baseURL: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1',
    })
  : undefined;

const fireworks = process.env.FIREWORKS_KEY
  ? createFireworks({
      apiKey: process.env.FIREWORKS_KEY,
    })
  : undefined;

const customModel = process.env.CUSTOM_MODEL
  ? openai?.(process.env.CUSTOM_MODEL, {
      structuredOutputs: true,
    })
  : undefined;

// Models

const deepSeekR1Model = fireworks
  ? wrapLanguageModel({
      model: fireworks(
        'accounts/fireworks/models/deepseek-r1',
      ) as LanguageModelV1,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  : undefined;

// Updated getModel function to accept user configuration
export function getModel(modelConfig?: ModelConfig): LanguageModelV1 {
  // Custom model override takes precedence
  if (customModel) {
    return customModel;
  }

  // Use user-configured model or default to gpt-5-mini
  const variant = modelConfig?.variant || 'gpt-5-mini';
  const reasoningEffort = modelConfig?.reasoning?.effort || 'medium';
  const verbosity = modelConfig?.text?.verbosity || 'medium';

  // Prefer Fireworks R1 if available, otherwise use GPT-5
  if (deepSeekR1Model) {
    return deepSeekR1Model;
  }

  // Create GPT model with user configuration
  // For now, fallback to latest available models until GPT-5 is officially supported
  let modelId: string;
  switch (variant) {
    case 'gpt-5':
    case 'gpt-5-mini':
    case 'gpt-5-nano':
      // Fallback to GPT-4 variants until GPT-5 is available
      modelId = 'gpt-4o-mini';
      break;
    default:
      modelId = 'gpt-4o-mini';
  }

  const model = openai?.(modelId as any, {
    structuredOutputs: true,
  });

  if (!model) {
    throw new Error('No model found - please check your OPENAI_KEY');
  }

  return model as LanguageModelV1;
}

const MinChunkSize = 140;
const encoder = getEncoding('o200k_base');

// trim prompt to maximum context size
export function trimPrompt(
  prompt: string,
  contextSize = Number(process.env.CONTEXT_SIZE) || 128_000,
) {
  if (!prompt) {
    return '';
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? '';

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}
